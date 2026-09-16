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
  definirProfilDocumentaire, emettreDocumentDrive, previsualiserDocument,
  type DemandeDocument, type MethodePdf,
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

/** La DEMANDE de fabrique, lue depuis le formulaire — une seule lecture, pour l'aperçu et l'émission. */
function lireDemande(formData: FormData): { ok: true; demande: DemandeDocument } | { ok: false; error: string } {
  const type = (fdStr(formData, "type") ?? "") as TypeDocumentCommercial;
  if (!TYPES_DOCUMENT.includes(type)) return { ok: false, error: "Nature de pièce inconnue : facture, bon de commande ou devis." };
  const mode = fdStr(formData, "modePaiement");
  const modePaiement = mode && (MODES_PAIEMENT as readonly string[]).includes(mode) ? (mode as ModePaiement) : null;

  // LES LIGNES : des listes parallèles, une entrée par ligne saisie, dans l'ordre de l'écran.
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
  const lu = lireDemande(formData);
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
  const lu = lireDemande(formData);
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
    message: r.dejaEmis
      ? `${libelle} ${r.reference} existait déjà pour ${r.tiers} : rendu tel quel, rien de nouveau n'a été émis.`
      : `${libelle} ${r.reference} émis${r.type === "FACTURE" ? "e" : ""} au nom de ${r.societe.nom} pour ${r.tiers}.`,
  };
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
