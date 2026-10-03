"use server";

/**
 * LE BOUTON DES FINANCES — composer une FACTURE ou un BON DE COMMANDE (ou un devis) au format de
 * la société, sur son papier en-tête, en Word et en PDF, depuis l'écran du registre.
 *
 * ── CE QUE CE FICHIER N'EST PAS ────────────────────────────────────────────────────────────
 *
 * Ce n'est pas un second générateur de pièces. La fabrique (`platform/in-process/artifact/
 * factory.ts`) existait pour Adam : numéro atomique, identité légale, papier en-tête, montants
 * calculés par le code, pièce inscrite au registre Legal, fichiers dans le Drive. Ces actions ne
 * font que TRADUIRE un formulaire en demande de fabrique (§118.5 : deux chemins d'émission
 * finiraient par diverger sur un arrondi ou un numéro), et l'APERÇU est la même composition
 * jouée à blanc. La porte est celle de la fabrique — `legalWriteAllowed`, la même que l'écran et
 * qu'Adam : les Finances émettent factures et bons de commande, Legal émet tout.
 *
 * ── POURQUOI DES LISTES DE CHAMPS ET PAS UN JSON ────────────────────────────────────────────
 *
 * Les lignes arrivent en LISTES parallèles (`ligneDesignation[]`, `ligneQuantite[]`…) : c'est ce
 * que le contrat d'action sait DÉCRIRE (§118.73 — `getAll("…")` est une liste nommée), donc ce
 * que la carte de confirmation d'Adam et le chemin générique savent lire. Un JSON opaque dans un
 * champ « spec » serait décrit comme un texte, et personne ne saurait quoi y mettre.
 */

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { MODES_PAIEMENT, TYPES_DOCUMENT, type ModePaiement, type TypeDocumentCommercial } from "@/lib/artifact/factory/commercial";
import {
  definirProfilDocumentaire, emettreDocumentDrive, previsualiserDocument, reviserDocumentDrive,
  type DemandeDocument, type MethodePdf, type ModificationsDocument,
} from "@/platform/in-process/artifact/factory";

/** « 2 500 000,00 » (espaces, insécables, virgule) → 2500000 ; vide ou illisible → null. */
function nombre(v: string | null | undefined): number | null {
  const s = (v ?? "").replace(/[\s  ]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Un pourcentage saisi (« 19 », « 2,5 ») → une fraction (0,19) ; vide → null. */
const fraction = (v: string | null | undefined): number | null => {
  const n = nombre(v);
  return n === null ? null : n / 100;
};

const texte = (formData: FormData, cle: string): string | null => {
  const v = fdStr(formData, cle);
  return v && v.trim() ? v.trim() : null;
};

/**
 * LES LIGNES : des listes parallèles, une entrée par ligne saisie, dans l'ordre de l'écran — une seule
 * lecture pour la composition et pour la révision d'une pièce émise (§118.194) : deux lecteurs de la même
 * saisie finiraient par arrondir ou couper différemment.
 */
function lireLignes(formData: FormData): DemandeDocument["lignes"] {
  const designations = formData.getAll("ligneDesignation").map(String);
  const details = formData.getAll("ligneDetails").map(String);
  const quantites = formData.getAll("ligneQuantite").map(String);
  const prix = formData.getAll("lignePrix").map(String);
  const remises = formData.getAll("ligneRemise").map(String);
  const tvas = formData.getAll("ligneTva").map(String);
  const sections = formData.getAll("ligneSection").map(String);
  const lignes: DemandeDocument["lignes"] = designations.map((designation, i) => {
    const section = sections[i] === "1" || sections[i] === "true";
    return {
      designation: designation.trim(),
      section,
      details: (details[i] ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
      // Une ligne chiffrée dont la quantité ou le prix est illisible arrive à NaN : la fabrique la
      // REFUSE en nommant la ligne, au lieu qu'un zéro silencieux fasse une pièce fausse.
      quantite: section ? 0 : (nombre(quantites[i]) ?? Number.NaN),
      prixUnitaire: section ? 0 : (nombre(prix[i]) ?? Number.NaN),
      remise: fraction(remises[i]),
      tva: fraction(tvas[i]),
    };
  });
  return lignes;
}

/**
 * La DEMANDE de fabrique, lue depuis le formulaire — une seule lecture, pour l'aperçu et l'émission.
 * Les lignes arrivent DÉJÀ lues : l'appelant appelle `lireLignes` lui-même, parce que la dérivation des
 * contrats ne suit qu'un niveau de délégation (§118.87c) — lues ici, à deux niveaux, elles disparaissaient
 * de ce que l'action déclare recevoir. Et il les lit dans une instruction À PART : un appel imbriqué
 * (`lireDemande(formData, lireLignes(formData))`) n'est pas reconnu comme une délégation — mesuré, ce
 * sont alors TOUS les autres champs de la demande qui disparaissaient du contrat.
 */
function lireDemande(formData: FormData, lignes: DemandeDocument["lignes"]): { ok: true; demande: DemandeDocument } | { ok: false; error: string } {
  const type = (fdStr(formData, "type") ?? "") as TypeDocumentCommercial;
  if (!TYPES_DOCUMENT.includes(type)) return { ok: false, error: "Nature de pièce inconnue : facture, bon de commande ou devis." };
  const mode = fdStr(formData, "modePaiement");
  const modePaiement = mode && (MODES_PAIEMENT as readonly string[]).includes(mode) ? (mode as ModePaiement) : null;

  const libellesTaxes = formData.getAll("taxeLibelle").map(String);
  const tauxTaxes = formData.getAll("taxeTaux").map(String);
  const taxes = libellesTaxes
    .map((libelle, i) => ({ libelle: libelle.trim(), taux: fraction(tauxTaxes[i]) ?? Number.NaN }))
    .filter((t) => t.libelle || Number.isFinite(t.taux));

  const contactNom = texte(formData, "contactNom");
  const contactTelephone = texte(formData, "contactTelephone");
  const livraisonAdresse = texte(formData, "livraisonAdresse");
  const livraisonDelai = texte(formData, "livraisonDelai");
  const validite = nombre(fdStr(formData, "validiteJours"));

  return {
    ok: true,
    demande: {
      type,
      societe: texte(formData, "societe"),
      tiers: {
        nom: texte(formData, "tiersNom") ?? "",
        adresse: texte(formData, "tiersAdresse"),
        telephone: texte(formData, "tiersTelephone"),
        email: texte(formData, "tiersEmail"),
        rc: texte(formData, "tiersRc"),
        nif: texte(formData, "tiersNif"),
        ai: texte(formData, "tiersAi"),
        nis: texte(formData, "tiersNis"),
      },
      numeroClient: texte(formData, "numeroClient"),
      lignes,
      date: texte(formData, "date"),
      echeance: type === "FACTURE" ? texte(formData, "echeance") : null,
      validiteJours: type === "DEVIS" && validite !== null && Number.isInteger(validite) ? validite : null,
      tvaDefaut: fraction(fdStr(formData, "tvaDefaut")),
      remiseGlobale: fraction(fdStr(formData, "remiseGlobale")),
      modePaiement,
      conditionsPaiement: texte(formData, "conditionsPaiement"),
      objet: texte(formData, "objet"),
      referenceAmont: texte(formData, "referenceAmont"),
      referenceAmontDate: texte(formData, "referenceAmontDate"),
      contact: contactNom || contactTelephone ? { nom: contactNom, telephone: contactTelephone } : null,
      taxes: taxes.length ? taxes : null,
      livraison: livraisonAdresse || livraisonDelai ? { adresse: livraisonAdresse, delai: livraisonDelai } : null,
      notes: texte(formData, "notes"),
      letterheadId: texte(formData, "letterheadId"),
      chainFromId: texte(formData, "chainFromId"),
      forcerDoublon: fdStr(formData, "forcerDoublon") === "1",
      // Les pièces composées depuis l'écran se rangent par nature : « Factures émises », etc.
      dossier: type === "FACTURE" ? "Factures émises" : type === "BON_DE_COMMANDE" ? "Bons de commande émis" : "Devis émis",
    },
  };
}

export interface ApercuPiece {
  ok: true;
  societe: { id: string; nom: string };
  numeroProchain: string;
  motif: string | null;
  papierEnTete: { id: string; nom: string } | null;
  identiteIncomplete: string[];
  totaux: { totalHt: number; totalTaxes: number; totalTva: number; timbre: number; totalTtc: number; enLettres: string; taxes: { libelle: string; taux: number; montant: number }[]; tva: { taux: number; montant: number }[] } | null;
  bloquants: string[];
  avertissements: string[];
  peutEmettre: boolean;
  pdfParEditeur: boolean;
}

/**
 * L'APERÇU — la même composition que l'émission, à blanc : totaux, somme en lettres, numéro
 * prévu, papier en-tête, et ce qui bloquerait. Rien n'est écrit, aucun numéro n'est consommé.
 */
export async function previsualiserPieceCommerciale(_prev: ApercuPiece | { ok: false; error: string } | undefined, formData: FormData): Promise<ApercuPiece | { ok: false; error: string }> {
  const user = await requireUser();
  const lignes = lireLignes(formData);
  const lu = lireDemande(formData, lignes);
  if (!lu.ok) return lu;
  const r = await previsualiserDocument(user, lu.demande);
  if (!r.ok) return { ok: false, error: r.motif };
  return {
    ok: true,
    societe: r.societe, numeroProchain: r.numeroProchain, motif: r.motif, papierEnTete: r.papierEnTete, identiteIncomplete: r.identiteIncomplete,
    totaux: r.totaux
      ? {
        totalHt: r.totaux.totalHt, totalTaxes: r.totaux.totalTaxes, totalTva: r.totaux.totalTva, timbre: r.totaux.timbre, totalTtc: r.totaux.totalTtc, enLettres: r.totaux.enLettres,
        taxes: r.totaux.taxes.map((x) => ({ libelle: x.libelle, taux: x.taux, montant: x.montant })),
        tva: r.totaux.tva.map((x) => ({ taux: x.taux, montant: x.montant })),
      }
      : null,
    bloquants: r.bloquants, avertissements: r.avertissements, peutEmettre: r.peutEmettre, pdfParEditeur: r.pdfParEditeur,
  };
}

export interface ResultatEmission extends ActionResult {
  reference?: string;
  legalDocumentId?: string;
  docxNodeId?: string;
  docxNom?: string;
  pdfNodeId?: string | null;
  pdfNom?: string | null;
  pdfMethode?: MethodePdf | null;
  totalTtc?: number;
  dejaEmis?: boolean;
  surPapierEnTete?: boolean;
  avertissements?: string[];
}

/**
 * ÉMET la pièce : numéro du compteur de la société (au motif de son profil), Word sur le papier
 * en-tête, PDF (éditeur Office ou rendu du serveur), pièce au registre Legal — par la fabrique,
 * sous les droits de la personne.
 */
export async function emettrePieceCommerciale(_prev: ResultatEmission | undefined, formData: FormData): Promise<ResultatEmission> {
  const user = await requireUser();
  const lignes = lireLignes(formData);
  const lu = lireDemande(formData, lignes);
  if (!lu.ok) return { ok: false, error: lu.error };
  const r = await emettreDocumentDrive(user, lu.demande);
  if (!r.ok) return { ok: false, error: r.motif + (r.bloquants?.length ? ` — ${r.bloquants.slice(0, 3).join(" ; ")}` : "") };
  revalidatePath("/legal");
  revalidatePath(`/legal/${r.legalDocumentId}`);
  revalidatePath("/finances");
  const libelle = r.type === "FACTURE" ? "Facture" : r.type === "DEVIS" ? "Devis" : "Bon de commande";
  return {
    ok: true, id: r.legalDocumentId, reference: r.reference, legalDocumentId: r.legalDocumentId,
    docxNodeId: r.docx.nodeId, docxNom: r.docx.nom, pdfNodeId: r.pdf?.nodeId ?? null, pdfNom: r.pdf?.nom ?? null, pdfMethode: r.pdf?.methode ?? null,
    totalTtc: r.totaux.totalTtc, dejaEmis: r.dejaEmis, surPapierEnTete: r.surPapierEnTete, avertissements: r.avertissements,
    message: (r.dejaEmis
      ? `${libelle} ${r.reference} existait déjà pour ${r.tiers} : rendu tel quel, rien de nouveau n'a été émis.`
      : `${libelle} ${r.reference} émis${r.type === "FACTURE" ? "e" : ""} au nom de ${r.societe.nom} pour ${r.tiers}.`)
      // Un BC émis attend son centre de validation (§118.148) : l'écran le dit, dans la même phrase.
      + (r.reserveBonDeCommande ? ` ${r.reserveBonDeCommande}` : ""),
  };
}

export interface ResultatRevision extends ActionResult {
  reference?: string;
  version?: number;
}

/**
 * RÉVISER UNE PIÈCE ÉMISE depuis sa fiche (§118.194 — audit 360°, R15) — un devis ou un bon de commande :
 * même numéro, nouvelle version du Word et du PDF, historique au registre, et la fiche suit le fichier
 * (montant, partie, échéance). La fabrique savait réviser ; seul le dossier promotionnel l'appelait, et la
 * fiche Legal n'offrait que le formulaire générique — qui changeait le montant sans toucher au fichier.
 *
 * Ce que le formulaire ne porte pas ne s'écrit pas (§118.152) ; la version que l'écran a montrée est exigée
 * (`versionVue`), et le motif l'est après tout ce qui refuserait la révision — c'est la fabrique qui tient
 * l'ordre, pour tous ses appelants. Une facture émise ne se révise pas : la fabrique le refuse et dit quoi faire.
 */
export async function reviserPieceCommerciale(_prev: ResultatRevision | undefined, formData: FormData): Promise<ResultatRevision> {
  const user = await requireUser();
  const legalDocumentId = fdStr(formData, "legalDocumentId");
  if (!legalDocumentId) return { ok: false, error: "Pièce introuvable." };
  const vue = nombre(fdStr(formData, "versionVue"));
  const modifications: ModificationsDocument = {};
  if (formData.has("ligneDesignation")) modifications.lignes = lireLignes(formData);
  if (formData.has("objet")) modifications.objet = texte(formData, "objet");
  if (formData.has("notes")) modifications.notes = texte(formData, "notes");
  if (formData.has("validiteJours")) {
    const v = nombre(fdStr(formData, "validiteJours"));
    modifications.validiteJours = v !== null && Number.isInteger(v) ? v : null;
  }
  if (formData.has("livraisonAdresse") || formData.has("livraisonDelai")) {
    modifications.livraison = {
      ...(formData.has("livraisonAdresse") ? { adresse: texte(formData, "livraisonAdresse") } : {}),
      ...(formData.has("livraisonDelai") ? { delai: texte(formData, "livraisonDelai") } : {}),
    };
  }
  if (formData.has("contactNom") || formData.has("contactTelephone")) {
    modifications.contact = {
      ...(formData.has("contactNom") ? { nom: texte(formData, "contactNom") } : {}),
      ...(formData.has("contactTelephone") ? { telephone: texte(formData, "contactTelephone") } : {}),
    };
  }
  if (Object.keys(modifications).length === 0) return { ok: false, error: "Rien à réviser : la révision porte sur les lignes, l'objet, les notes, la validité, la livraison ou le contact." };
  const r = await reviserDocumentDrive(user, {
    legalDocumentId, modifications, motif: texte(formData, "motif"),
    versionVue: vue !== null && Number.isInteger(vue) ? vue : null, exigerMotif: true,
  });
  if (!r.ok) return { ok: false, error: r.motif + (r.bloquants?.length ? ` — ${r.bloquants.slice(0, 3).join(" ; ")}` : "") };
  revalidatePath("/legal");
  revalidatePath(`/legal/${legalDocumentId}`);
  const libelle = r.type === "DEVIS" ? "Devis" : "Bon de commande";
  return {
    ok: true, id: legalDocumentId, reference: r.reference, version: r.version,
    message: `${libelle} ${r.reference} révisé : version ${r.version}, ${formaterTtc(r.totaux.totalTtc)} TTC — le Word, le PDF et la fiche disent la même chose.`
      + (r.reserveBonDeCommande ? ` ${r.reserveBonDeCommande}` : ""),
  };
}

/** « 1 234 567,89 DZD » — la phrase du résultat ; les totaux viennent de la fabrique, jamais du navigateur. */
function formaterTtc(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DZD`;
}

/**
 * RÈGLE le motif de numérotation d'une nature de pièce pour une société (« {n:3}/FS/{aa} ») —
 * ceux qui tiennent la papeterie seulement, comme le reste du profil documentaire.
 */
export async function reglerNumerotationPieces(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const type = (fdStr(formData, "type") ?? "") as TypeDocumentCommercial;
  if (!TYPES_DOCUMENT.includes(type)) return { ok: false, error: "Nature de pièce inconnue." };
  const motif = texte(formData, "motif");
  const r = await definirProfilDocumentaire(user, { societe: texte(formData, "societe"), numerotation: { [type]: motif } });
  if (!r.ok) return { ok: false, error: r.motif };
  revalidatePath("/legal");
  const applique = r.profil.reglages.numerotation[type];
  return { ok: true, message: applique ? `Motif enregistré : ${applique}.` : "Motif effacé : retour à la numérotation par défaut." };
}
