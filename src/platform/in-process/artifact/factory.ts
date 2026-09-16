/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FABRIQUE DE DOCUMENTS, VUE D'ADAM — « fais-moi un devis Adventum pour la Pharmacie
 * Centrale », « émets les 25 bons de commande de la liste », « prépare le dossier du comité en
 * Excel, PowerPoint et Word ».
 *
 * ── UNE PIÈCE ÉMISE EST UNE PIÈCE DU REGISTRE LEGAL (§17) ───────────────────────────────
 *
 * Un devis, un bon de commande, une facture : la chaîne d'achat que Legal tient déjà (natures
 * QUOTE → PURCHASE_ORDER → INVOICE, `chainFromId`, règlement d'une facture). La fabrique n'y
 * ajoute pas un second registre : elle CRÉE la pièce là, avec son numéro, son montant, son
 * fichier dans le Drive, et range la spécification complète dans `custom.fabrique` — c'est ce
 * qui permet de la RÉVISER (un devis v2) et de reconnaître un doublon.
 *
 * ── LE NUMÉRO EST ATTRIBUÉ APRÈS TOUT CE QUI PEUT ÉCHOUER, ET AVEC LA PIÈCE ─────────────
 *
 * La composition est jouée à blanc (numéro « PROVISOIRE ») : règles, mise en page, relecture,
 * contrôle. Si quelque chose bloque, aucun numéro n'est consommé. Puis, dans UNE transaction :
 * le compteur avance et la pièce naît au registre (`etat: EN_COURS`). Le fichier s'écrit
 * ensuite ; si l'écriture échoue, la pièce numérotée reste visible au registre sans fichier, et
 * la même demande la RETROUVE par son empreinte et la termine au lieu de numéroter à nouveau.
 * Une numérotation de factures continue par construction, pas par discipline.
 *
 * ── MÊMES DROITS QUE L'ÉCRAN (§7) ───────────────────────────────────────────────────────
 *
 * `legalWriteAllowed` — la porte d'écriture du registre, celle du formulaire Legal et des
 * actions du vocabulaire « facture ». La société est celle de la personne (`canEditCompanyId`),
 * jamais une société qu'elle ne fait que voir. Le papier en-tête est celui de la bibliothèque
 * de cette société ; le profil documentaire, tenu par ceux qui tiennent la papeterie.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { legalWriteAllowed } from "@/lib/legal/invoices";
import { canManageLetterheads, letterheadsFor } from "@/lib/office/letterhead";
import { canEditCompanyId, getMyCompanies, moneyEntityOf, type CompanyLite } from "@/lib/company";
import { getBlob } from "@/lib/drive-storage";
import { recordAudit } from "@/lib/audit";
import { docxToPdf } from "@/lib/payslip/to-pdf";
import { convertConfigured, convertDocument } from "@/lib/office-convert";
import { appBaseUrl, makeEditToken } from "@/lib/onlyoffice";
import { portsArtefact } from "@/platform/in-process/artifact/ports";
import { construireDocumentCommercial } from "@/lib/artifact/factory/build";
import { empreinteDocument } from "@/lib/artifact/factory/empreinte";
import {
  ajouterJours, formaterDzd, formaterNumero, LIBELLE_TYPE, NATURE_LEGALE, TAUX_TVA_ADMIS, titreDocument,
  TYPES_DOCUMENT, validerMotifNumero, verifierSpecCommerciale,
  type LigneCommerciale, type ModePaiement, type PartieCommerciale, type SpecDocumentCommercial, type TaxeAdditionnelle, type TotauxCommerciaux, type TypeDocumentCommercial,
} from "@/lib/artifact/factory/commercial";
import { construireDossier } from "@/lib/artifact/factory/dossier";
import { charteDe, lireMarque, mentionsDe, resumerMarque, signatairePour, type Charte, type Marque } from "@/lib/brand/model";
import type { DonneesCanoniques } from "@/lib/artifact/factory/canonical";
import { MIME_DOCX } from "@/lib/artifact/factory/word";
import { MIME_XLSX } from "@/lib/artifact/adapters/xlsx/adapter";
import { MIME_PPTX } from "@/lib/artifact/adapters/pptx/adapter";
import { standardsDocumentaires } from "@/platform/in-process/teach/store";

/** Les causes d'échec que le runtime de missions sait classer (`capability-failure.ts`). */
type Echec = "NOT_FOUND" | "MISSING_PERMISSION" | "MISSING_INPUT" | "CAPABILITY_FAILURE";

export interface EchecFabrique {
  ok: false;
  echec: Echec;
  motif: string;
  bloquants?: string[];
  candidats?: { id: string; nom: string }[];
}

const echec = (e: Echec, motif: string, extra: Partial<Omit<EchecFabrique, "ok" | "echec" | "motif">> = {}): EchecFabrique => ({ ok: false, echec: e, motif, ...extra });

// ─────────────────────────── La société et son profil ───────────────────────────

export interface ReglagesDocumentaires {
  quotePrefix: string;
  orderPrefix: string;
  invoicePrefix: string;
  /** Fraction (0,19). */
  vatRate: number;
  paymentTerms: string | null;
  quoteValidityDays: number;
  footerNote: string | null;
  letterheadId: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  /**
   * LE MOTIF DU NUMÉRO, par nature — « 001/FS/26 » pour les factures, « 012/DG/2026 » pour les
   * bons de commande : ce que les pièces réelles de la société portent. Vide = le défaut
   * `{prefixe}-{aaaa}-{n:4}`. Vit dans `settings.numerotation` du profil (extensible sans migration).
   */
  numerotation: Partial<Record<TypeDocumentCommercial, string>>;
  /** Vrai si un profil a été enregistré ; faux = ce sont les défauts du code. */
  existe: boolean;
}

export interface ProfilDocumentaire {
  societe: { id: string; nom: string; couleur: string | null };
  /** L'identité légale, telle qu'elle figurera sur la pièce. */
  identite: PartieCommerciale;
  /** Les champs d'identité manquants pour une FACTURE — à renseigner dans la carte Legal. */
  identiteIncomplete: string[];
  reglages: ReglagesDocumentaires;
  papierEnTete: { id: string; nom: string } | null;
  /** Les règles Teach Adam (standards documentaires de la société) qui ont modifié les réglages, et comment. */
  reglesAppliquees: { id: string; cle: string; effet: string }[];
  /** LE REGISTRE DE MARQUE (§26) : ce que la société dit d'elle-même, et la charte effective qui en découle. */
  marque: Marque;
  charte: Charte;
  resumeMarque: string;
}

/** Ce que la fabrique pose SUR la pièce : le papier en-tête, ou à défaut la police et le logo de la marque. */
export interface Habillage {
  base: Buffer | null;
  police: string | null;
  logo: { octets: Buffer; png: boolean; largeurCm: number } | null;
}

const REGLAGES_DEFAUT: ReglagesDocumentaires = {
  quotePrefix: "DEV", orderPrefix: "BC", invoicePrefix: "FA", vatRate: 0.19, paymentTerms: null, quoteValidityDays: 30,
  footerNote: null, letterheadId: null, signatoryName: null, signatoryTitle: null, numerotation: {}, existe: false,
};

/** Les motifs de numérotation lus dans `settings.numerotation` — seuls les motifs VALIDES comptent. */
function lireNumerotation(settings: Prisma.JsonValue | null | undefined): Partial<Record<TypeDocumentCommercial, string>> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  const brut = (settings as Record<string, unknown>).numerotation;
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const out: Partial<Record<TypeDocumentCommercial, string>> = {};
  for (const type of TYPES_DOCUMENT) {
    const v = (brut as Record<string, unknown>)[type];
    if (typeof v === "string" && v.trim() && !validerMotifNumero(v)) out[type] = v.trim();
  }
  return out;
}

const plier = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * QUELLE SOCIÉTÉ ? Nommée (identifiant, raison sociale ou nom court) parmi celles de la
 * personne ; sinon celle de la personne pour l'ARGENT (`moneyEntityOf` : sa fiche, pas son
 * écran). Plusieurs correspondances = on demande, on ne choisit pas.
 */
export async function resoudreSociete(userId: string, societe?: string | null): Promise<{ ok: true; societe: CompanyLite } | EchecFabrique> {
  const miennes = await getMyCompanies(userId);
  if (miennes.length === 0) return echec("MISSING_PERMISSION", "Aucune société du groupe ne vous est ouverte : impossible d'émettre une pièce.");
  const voulu = (societe ?? "").trim();
  if (!voulu) {
    const id = await moneyEntityOf(userId);
    const s = miennes.find((c) => c.id === id) ?? (miennes.length === 1 ? miennes[0] : null);
    if (!s) return echec("MISSING_INPUT", `Dites au nom de quelle société émettre la pièce : ${miennes.map((c) => c.name).join(", ")}.`, { candidats: miennes.map((c) => ({ id: c.id, nom: c.name })) });
    return { ok: true, societe: s };
  }
  const p = plier(voulu);
  const exacts = miennes.filter((c) => c.id === voulu || plier(c.name) === p || (c.shortName && plier(c.shortName) === p));
  const partiels = exacts.length ? exacts : miennes.filter((c) => plier(c.name).includes(p) || (c.shortName && plier(c.shortName).includes(p)));
  if (partiels.length === 1) return { ok: true, societe: partiels[0] };
  if (partiels.length > 1) return echec("MISSING_INPUT", `${partiels.length} sociétés correspondent à « ${voulu} » : laquelle ?`, { candidats: partiels.map((c) => ({ id: c.id, nom: c.name })) });
  return echec("NOT_FOUND", `Aucune société « ${voulu} » parmi celles que vous pouvez engager (${miennes.map((c) => c.name).join(", ")}).`);
}

const MENTIONS_FACTURE: { cle: keyof PartieCommerciale; libelle: string }[] = [
  { cle: "adresse", libelle: "siège social" }, { cle: "rc", libelle: "RC" }, { cle: "nif", libelle: "NIF" }, { cle: "ai", libelle: "article d'imposition" }, { cle: "nis", libelle: "NIS" },
];

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE PIÈCE QUI NE RESSEMBLE PAS À LA SOCIÉTÉ LE DIT — sinon elle passe pour la sienne.
 *
 * ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * « Fais-moi un BC Adventum. » Le .docx sort valide : les totaux sont justes, la TVA est bonne,
 * le fichier s'ouvre. Et il est GÉNÉRIQUE — pas de logo, pas de papier en-tête, pas de RC ni de
 * NIF, une mise en page neutre. Rien dans la réponse ne le disait. C'est un faux succès de la
 * pire espèce : le livrable existe, il est techniquement correct, et il ne va pas à la banque.
 *
 * ── POURQUOI LE CODE LE SAVAIT DÉJÀ, ET SE TAISAIT ──────────────────────────────────────
 *
 * `profilDocumentaire` calcule `identiteIncomplete`, connaît `papierEnTete`, connaît la marque.
 * Ces trois faits étaient rendus dans le profil… et jamais recopiés dans `avertissements`. Seule
 * la FACTURE bloquait sur les mentions manquantes ; un devis et un bon de commande sortaient en
 * silence. Le contrôle existait, il ne parlait pas.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────
 *
 * Toute pièce émise sans les marques d'identité de la société porte un avertissement qui NOMME
 * ce qui manque ET où le renseigner. Ce n'est pas un refus : la pièce reste utile, et le PDG
 * décide. Mais il décide en le sachant.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function manquesDIdentite(profil: ProfilDocumentaire): string[] {
  const out: string[] = [];
  if (profil.identiteIncomplete.length > 0) {
    out.push(
      `Cette pièce sort SANS ${profil.identiteIncomplete.join(", ")} de ${profil.societe.nom} : `
      + `renseignez la carte d'identité de la société (Legal → Sociétés) et les pièces suivantes les porteront.`,
    );
  }
  if (!profil.papierEnTete && !profil.marque.logo) {
    out.push(
      `Aucun papier en-tête ni logo n'est enregistré pour ${profil.societe.nom} : la mise en page est NEUTRE, `
      + `elle ne porte pas la charte de la société. Téléversez l'en-tête (Bureautique → Papiers en-tête) ou le logo `
      + `(profil documentaire) pour que la pièce ressemble vraiment à ${profil.societe.nom}.`,
    );
  }
  if (!profil.reglages.existe) {
    out.push(
      `Aucun profil documentaire n'est défini pour ${profil.societe.nom} : préfixe de numérotation, TVA, conditions `
      + `de paiement et validité viennent des valeurs par défaut, pas de vos usages.`,
    );
  }
  return out;
}

/**
 * LE PROFIL DOCUMENTAIRE d'une société : identité légale, réglages, papier en-tête.
 *
 * `opts.papierEnTeteId` : un papier CHOISI pour cette pièce (le bouton des Finances propose la
 * bibliothèque de la société) à la place de celui que le profil désigne — jamais le papier d'une
 * autre société : écrire sur son en-tête, c'est l'engager.
 */
export async function profilDocumentaire(user: CurrentUser, societe?: string | null, opts: { papierEnTeteId?: string | null } = {}): Promise<{ ok: true; profil: ProfilDocumentaire; papierOctets: Buffer | null; logo: Habillage["logo"]; habillage: Habillage } | EchecFabrique> {
  const r = await resoudreSociete(user.id, societe);
  if (!r.ok) return r;
  const s = r.societe;
  const [identite, profil, entetes] = await Promise.all([
    prisma.companyLegalIdentity.findUnique({ where: { companyId: s.id } }),
    prisma.companyDocumentProfile.findUnique({ where: { companyId: s.id } }),
    prisma.officeLetterhead.findMany({
      where: { kind: "word", isActive: true, OR: [{ companyId: s.id }, { companyId: null }] },
      select: { id: true, name: true, kind: true, companyId: true, isActive: true, blobId: true },
    }),
  ]);
  const reglages: ReglagesDocumentaires = profil
    ? {
      quotePrefix: profil.quotePrefix, orderPrefix: profil.orderPrefix, invoicePrefix: profil.invoicePrefix, vatRate: Number(profil.vatRate),
      paymentTerms: profil.paymentTerms, quoteValidityDays: profil.quoteValidityDays, footerNote: profil.footerNote, letterheadId: profil.letterheadId,
      signatoryName: profil.signatoryName, signatoryTitle: profil.signatoryTitle, numerotation: lireNumerotation(profil.settings), existe: true,
    }
    // UNE COPIE, jamais la constante : les standards enseignés ci-dessous ÉCRIVENT dans `reglages`.
    // Sans copie, la première société qui appliquait « 60 jours » le laissait dans les défauts du
    // processus — et toute société sans profil héritait de 60 jours, règle supprimée ou non.
    // Trouvé par le banc des défis : « la fabrique applique encore 60 jours » sans aucune règle.
    : { ...REGLAGES_DEFAUT };
  // ── LES STANDARDS ENSEIGNÉS (Teach Adam, §119) ─────────────────────────────────────────
  //
  // « Nos factures commencent par FAC », « les devis sont valables 45 jours » : une règle de
  // périmètre SOCIÉTÉ, posée par la Direction, s'applique par-dessus le profil — c'est la plus
  // récente des deux volontés, et elle porte le nom de qui l'a dite. Chaque application est
  // rendue (`reglesAppliquees`) : la pièce dit d'où viennent ses réglages.
  const reglesAppliquees: ProfilDocumentaire["reglesAppliquees"] = [];
  const standards = await standardsDocumentaires(user.id, s.id).catch(() => new Map<string, { valeur: unknown; regle: { id: string } }>());
  const appliquer = (cle: string, f: (v: unknown) => string | null) => {
    const st = standards.get(cle);
    if (!st) return;
    const effet = f(st.valeur);
    if (effet) reglesAppliquees.push({ id: st.regle.id, cle, effet });
  };
  appliquer("validiteDevis", (v) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 365 ? ((reglages.quoteValidityDays = v), `validité des devis : ${v} jours`) : null));
  appliquer("prefixeFacture", (v) => (typeof v === "string" && /^[A-Za-z0-9]{1,8}$/.test(v) ? ((reglages.invoicePrefix = v.toUpperCase()), `préfixe des factures : ${v.toUpperCase()}`) : null));
  appliquer("prefixeDevis", (v) => (typeof v === "string" && /^[A-Za-z0-9]{1,8}$/.test(v) ? ((reglages.quotePrefix = v.toUpperCase()), `préfixe des devis : ${v.toUpperCase()}`) : null));
  appliquer("prefixeBonDeCommande", (v) => (typeof v === "string" && /^[A-Za-z0-9]{1,8}$/.test(v) ? ((reglages.orderPrefix = v.toUpperCase()), `préfixe des bons de commande : ${v.toUpperCase()}`) : null));
  appliquer("tvaDefaut", (v) => (typeof v === "number" && TAUX_TVA_ADMIS.some((t) => Math.abs(t - v) < 1e-9) ? ((reglages.vatRate = v), `TVA par défaut : ${Math.round(v * 100)} %`) : null));
  appliquer("conditionsPaiement", (v) => (typeof v === "string" && v.trim() ? ((reglages.paymentTerms = v.trim()), `conditions de paiement : ${v.trim()}`) : null));
  appliquer("mentionPied", (v) => (typeof v === "string" && v.trim() ? ((reglages.footerNote = v.trim()), "mention de pied de page") : null));
  // Le papier : celui que le profil désigne s'il est toujours actif, sinon le premier de la
  // société, sinon un papier commun au groupe — jamais celui d'une autre société.
  const voulu = (opts.papierEnTeteId ?? "").trim();
  if (voulu && !entetes.some((l) => l.id === voulu)) {
    // `entetes` ne contient que les en-têtes Word ACTIFS de cette société ou communs au groupe :
    // « introuvable » couvre donc aussi « appartient à une autre société », sans le révéler.
    return echec("NOT_FOUND", "Ce papier en-tête n'existe pas, n'est plus actif, ou n'est pas un modèle Word de cette société.");
  }
  const choisi = voulu ? entetes.find((l) => l.id === voulu) ?? null : null;
  const designe = reglages.letterheadId ? entetes.find((l) => l.id === reglages.letterheadId) ?? null : null;
  const papier = choisi ?? designe ?? letterheadsFor(entetes, "word", s.id).find((l) => l.companyId === s.id || l.companyId === null) ?? null;
  const papierOctets = papier ? await getBlob(papier.blobId) : null;
  // LA MARQUE (§26) : lue dans `settings.marque` du profil ; la charte effective tranche marque >
  // pastille de la société > défauts. Le logo n'est chargé que s'il servira : sans papier en-tête.
  const marque = lireMarque(profil?.settings);
  const charte = charteDe(marque, s.color);
  let logo: Habillage["logo"] = null;
  if (marque.logo && !(papierOctets && papierOctets.length > 0)) {
    const octets = await getBlob(marque.logo.blobId).catch(() => null);
    if (octets && octets.length > 0) logo = { octets: Buffer.from(octets), png: marque.logo.mime === "image/png", largeurCm: marque.logo.largeurCm };
  }
  const partie: PartieCommerciale = {
    nom: identite?.legalName?.trim() || s.name,
    formeJuridique: identite?.legalForm ?? null,
    capital: identite?.shareCapital ?? null,
    adresse: identite?.headOffice ?? null,
    rc: identite?.rcNumber ?? null,
    nif: identite?.nif ?? null,
    ai: identite?.taxArticle ?? null,
    nis: identite?.nis ?? null,
    telephone: identite?.phone ?? null,
    email: identite?.email ?? null,
    banque: [identite?.bankName, identite?.bankAgency].filter(Boolean).join(" — ") || null,
    rib: identite?.rib ?? null,
  };
  const papierEffectif = papierOctets && papierOctets.length > 0 ? papierOctets : null;
  return {
    ok: true,
    papierOctets: papierEffectif,
    logo,
    habillage: { base: papierEffectif, police: charte.policeTexte, logo },
    profil: {
      // La couleur de la société telle que la fabrique l'applique EST l'accent de la charte.
      societe: { id: s.id, nom: s.name, couleur: charte.accent },
      identite: partie,
      identiteIncomplete: MENTIONS_FACTURE.filter((m) => !(partie[m.cle] as string | null)?.trim()).map((m) => m.libelle),
      reglages,
      papierEnTete: papier && papierOctets ? { id: papier.id, nom: papier.name } : null,
      reglesAppliquees,
      marque, charte, resumeMarque: resumerMarque(marque, charte),
    },
  };
}

export interface ModificationsProfil {
  quotePrefix?: string | null;
  orderPrefix?: string | null;
  invoicePrefix?: string | null;
  vatRate?: number | null;
  paymentTerms?: string | null;
  quoteValidityDays?: number | null;
  footerNote?: string | null;
  letterheadId?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  /** Le motif du numéro par nature ; `null` efface (retour au défaut). Voir `MOTIF_NUMERO_DEFAUT`. */
  numerotation?: Partial<Record<TypeDocumentCommercial, string | null>>;
}

/** DÉFINIT (ou corrige) le profil documentaire d'une société — les tenants de la papeterie seulement. */
export async function definirProfilDocumentaire(
  user: CurrentUser, opts: { societe?: string | null } & ModificationsProfil,
): Promise<{ ok: true; profil: ProfilDocumentaire } | EchecFabrique> {
  if (!canManageLetterheads(user)) return echec("MISSING_PERMISSION", "Le profil documentaire d'une société se règle par ceux qui tiennent sa papeterie (assistante de direction, Super Admin).");
  const r = await resoudreSociete(user.id, opts.societe);
  if (!r.ok) return r;
  const s = r.societe;
  const data: Prisma.CompanyDocumentProfileUncheckedUpdateInput = { updatedById: user.id };
  for (const cle of ["quotePrefix", "orderPrefix", "invoicePrefix"] as const) {
    const v = opts[cle];
    if (v === undefined) continue;
    if (v === null || !/^[A-Za-z0-9]{1,8}$/.test(v)) return echec("MISSING_INPUT", `Préfixe « ${String(v)} » invalide : 1 à 8 lettres ou chiffres.`);
    data[cle] = v.toUpperCase();
  }
  if (opts.vatRate !== undefined && opts.vatRate !== null) {
    if (!TAUX_TVA_ADMIS.some((t) => Math.abs(t - opts.vatRate!) < 1e-9)) return echec("MISSING_INPUT", `Taux de TVA ${opts.vatRate} inconnu en Algérie (0, 0,09, 0,19).`);
    data.vatRate = new Prisma.Decimal(opts.vatRate);
  }
  if (opts.quoteValidityDays !== undefined && opts.quoteValidityDays !== null) {
    if (!Number.isInteger(opts.quoteValidityDays) || opts.quoteValidityDays < 1 || opts.quoteValidityDays > 365) return echec("MISSING_INPUT", "La validité d'un devis va de 1 à 365 jours.");
    data.quoteValidityDays = opts.quoteValidityDays;
  }
  for (const cle of ["paymentTerms", "footerNote", "signatoryName", "signatoryTitle"] as const) {
    if (opts[cle] !== undefined) data[cle] = opts[cle]?.trim() || null;
  }
  if (opts.letterheadId !== undefined) {
    if (opts.letterheadId) {
      const lh = await prisma.officeLetterhead.findUnique({ where: { id: opts.letterheadId }, select: { kind: true, isActive: true, companyId: true } });
      if (!lh || !lh.isActive) return echec("NOT_FOUND", "Ce papier en-tête n'existe plus.");
      if (lh.kind !== "word") return echec("MISSING_INPUT", "Le papier en-tête d'une pièce commerciale est un modèle Word.");
      if (lh.companyId && lh.companyId !== s.id) return echec("MISSING_PERMISSION", "Ce papier en-tête appartient à une autre société.");
    }
    data.letterheadId = opts.letterheadId || null;
  }
  if (opts.numerotation !== undefined && opts.numerotation !== null) {
    // Le motif se vérifie AVANT d'écrire : un motif sans séquence numéroterait toutes les pièces
    // pareil, et le refus nomme le jeton fautif plutôt que de laisser un « 001/FS/26 » bancal.
    for (const type of TYPES_DOCUMENT) {
      const v = opts.numerotation[type];
      if (v === undefined || v === null || v.trim() === "") continue;
      const refus = validerMotifNumero(v);
      if (refus) return echec("MISSING_INPUT", `Motif de numérotation des ${LIBELLE_TYPE[type].toLowerCase()}s refusé : ${refus}`);
    }
    const actuel = await prisma.companyDocumentProfile.findUnique({ where: { companyId: s.id }, select: { settings: true } });
    const settings = actuel?.settings && typeof actuel.settings === "object" && !Array.isArray(actuel.settings) ? { ...(actuel.settings as Record<string, unknown>) } : {};
    const numerotation: Record<string, string> = { ...lireNumerotation(actuel?.settings) };
    for (const type of TYPES_DOCUMENT) {
      const v = opts.numerotation[type];
      if (v === undefined) continue;
      if (v === null || v.trim() === "") delete numerotation[type]; else numerotation[type] = v.trim();
    }
    settings.numerotation = numerotation;
    data.settings = settings as Prisma.InputJsonValue;
  }
  await prisma.companyDocumentProfile.upsert({
    where: { companyId: s.id },
    create: { ...(data as Omit<Prisma.CompanyDocumentProfileUncheckedCreateInput, "companyId">), companyId: s.id },
    update: data,
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Legal", entityType: "COMPANY", entityId: s.id, summary: `Profil documentaire de ${s.name} réglé : ${Object.keys(data).filter((k) => k !== "updatedById").map((k) => (k === "settings" ? "numerotation" : k)).join(", ") || "aucun changement"}` });
  const relu = await profilDocumentaire(user, s.id);
  return relu.ok ? { ok: true, profil: relu.profil } : relu;
}

// ─────────────────────────── L'émission ───────────────────────────

export interface DemandeDocument {
  type: TypeDocumentCommercial;
  /** Identifiant, raison sociale ou nom court. Vide = la société de la personne. */
  societe?: string | null;
  tiers: PartieCommerciale;
  lignes: LigneCommerciale[];
  /** ISO `AAAA-MM-JJ`. Vide = aujourd'hui. */
  date?: string | null;
  echeance?: string | null;
  validiteJours?: number | null;
  tvaDefaut?: number | null;
  remiseGlobale?: number | null;
  modePaiement?: ModePaiement | null;
  conditionsPaiement?: string | null;
  objet?: string | null;
  /** La pièce amont, en clair : « 26/0576 » sous « Devis N° » d'un bon de commande. */
  referenceAmont?: string | null;
  /** La date de la pièce amont (« Du 20/07/2026 »), ISO. */
  referenceAmontDate?: string | null;
  /** Facture : le numéro de client de la société (« 00003 »). */
  numeroClient?: string | null;
  /** Bon de commande / devis : l'interlocuteur nommé sur la pièce. */
  contact?: { nom?: string | null; telephone?: string | null } | null;
  /** Taxes additionnelles sur le HT, hors base de TVA (« Taxe Pub » 2 %). */
  taxes?: TaxeAdditionnelle[] | null;
  livraison?: { adresse?: string | null; delai?: string | null } | null;
  notes?: string | null;
  /** Un papier en-tête Word précis de la société, à la place de celui du profil. */
  letterheadId?: string | null;
  /** La pièce Legal dont celle-ci découle (le devis d'un BC, le BC d'une facture). */
  chainFromId?: string | null;
  /** Le dossier du Drive personnel. Vide = « Documents Adam ». */
  dossier?: string | null;
  /** Émettre même si une pièce au contenu identique existe déjà. */
  forcerDoublon?: boolean;
  sansPdf?: boolean;
}

/** Ce que le registre garde de la pièce, sous `LegalDocument.custom.fabrique`. */
interface Fabrique {
  version: number;
  etat: "EN_COURS" | "EMIS";
  type: TypeDocumentCommercial;
  empreinte: string;
  societeId: string;
  numero: string;
  spec: SpecDocumentCommercial;
  totaux: ResumeTotaux;
  docx: { nodeId: string; version: number } | null;
  /** `methode` : « editeur » = imprimé par l'éditeur Office du serveur ; « rendu » = redessiné ici (repli). */
  pdf: { nodeId: string; version: number; pages: number; methode?: MethodePdf } | null;
  surPapierEnTete: boolean;
  papierEnTeteId: string | null;
  emisPar: string;
  emisLe: string;
  historique: { version: number; le: string; par: string; resume: string }[];
}

interface ResumeTotaux { totalHt: number; totalTva: number; totalTaxes?: number; timbre: number; totalTtc: number; enLettres: string }
const resumeTotaux = (t: TotauxCommerciaux): ResumeTotaux => ({ totalHt: t.totalHt, totalTva: t.totalTva, totalTaxes: t.totalTaxes, timbre: t.timbre, totalTtc: t.totalTtc, enLettres: t.enLettres });

export type MethodePdf = "editeur" | "rendu";

/** Le nombre de pages d'un PDF, lu dans ses objets — suffisant pour le dire, sans ouvrir un moteur. */
const compterPagesPdf = (pdf: Buffer): number => {
  const m = pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g);
  return Math.max(1, m ? m.length : 1);
};

/**
 * LE PDF DE LA PIÈCE — par l'ÉDITEUR OFFICE du serveur quand il est configuré (l'impression
 * fidèle du .docx, papier en-tête compris), sinon par le RENDU de ce dépôt (`docxToPdf`), qui
 * redessine texte, tableaux, en-tête et pied. La méthode VOYAGE avec le fichier : « le PDF
 * existe » ne dit pas la même chose selon qui l'a imprimé (§118.121), et c'est à l'écran de le
 * dire. Un échec de l'éditeur retombe sur le rendu : ajouter un chemin ne doit pas retirer celui
 * qui marchait.
 */
async function pdfDeLaPiece(user: CurrentUser, docx: { nodeId: string; version: number }, octets: Buffer): Promise<{ ok: true; pdf: Buffer; pages: number; methode: MethodePdf } | { ok: false; error: string }> {
  if (convertConfigured()) {
    try {
      const token = makeEditToken(docx.nodeId, user.id, 300);
      const pdf = await convertDocument({ srcUrl: `${appBaseUrl()}/api/onlyoffice/file?token=${token}`, fromExt: "docx", outputType: "pdf", key: `fabrique_${docx.nodeId}_${docx.version}` });
      if (pdf.length > 0) return { ok: true, pdf, pages: compterPagesPdf(pdf), methode: "editeur" };
    } catch (e) {
      console.error("[fabrique] impression PDF par l'éditeur Office échouée — repli sur le rendu du serveur", e);
    }
  }
  const r = await docxToPdf(octets);
  return r.ok ? { ok: true, pdf: r.pdf, pages: r.pages, methode: "rendu" } : r;
}

/** La réserve à dire quand le PDF est un rendu du serveur — et rien quand l'éditeur l'a imprimé. */
const reservePdf = (methode: MethodePdf, surPapierEnTete: boolean): string | null =>
  methode === "editeur"
    ? null
    : surPapierEnTete
      ? "Le PDF est un rendu du serveur : l'en-tête et le pied du papier y sont redessinés (logo, textes, couleurs), pas imprimés par un traitement de texte — le .docx fait foi pour l'impression officielle."
      : "Le PDF est un rendu du serveur du .docx ; le .docx fait foi pour l'impression.";

export interface DocumentEmis {
  ok: true;
  /** Vrai quand une pièce au contenu identique existait déjà : elle est rendue, rien n'est émis. */
  dejaEmis: boolean;
  /** Vrai quand une émission interrompue (numérotée, sans fichier) a été terminée. */
  repris: boolean;
  legalDocumentId: string;
  reference: string;
  type: TypeDocumentCommercial;
  version: number;
  societe: { id: string; nom: string };
  tiers: string;
  docx: { nodeId: string; nom: string; version: number };
  pdf: { nodeId: string; nom: string; pages: number; methode: MethodePdf } | null;
  totaux: ResumeTotaux;
  surPapierEnTete: boolean;
  avertissements: string[];
  /** Les règles Teach Adam qui ont réglé la pièce (préfixe, validité, TVA…), pour le dire. */
  reglesAppliquees: { id: string; cle: string; effet: string }[];
  ms: number;
}

function fabriqueDe(custom: Prisma.JsonValue | null): Fabrique | null {
  if (!custom || typeof custom !== "object" || Array.isArray(custom)) return null;
  const f = (custom as Record<string, unknown>).fabrique;
  return f && typeof f === "object" && !Array.isArray(f) && typeof (f as Fabrique).numero === "string" ? (f as unknown as Fabrique) : null;
}

const aujourdhui = (): string => new Date().toISOString().slice(0, 10);
const present = (v: string | null | undefined): v is string => !!v && v.trim() !== "";
const nomFichier = (numero: string, tiers: string, ext: string): string => `${numero} — ${tiers.trim().replace(/[\\/:*?"<>|]+/g, " ").slice(0, 60)}.${ext}`;

/** La spécification (sans numéro) telle que la fabrique la compose depuis la demande et le profil. */
function specDepuisDemande(d: DemandeDocument, p: ProfilDocumentaire): Omit<SpecDocumentCommercial, "numero"> {
  const date = (d.date ?? "").trim() || aujourdhui();
  const validite = d.validiteJours ?? p.reglages.quoteValidityDays;
  return {
    type: d.type,
    date,
    emetteur: p.identite,
    tiers: { ...d.tiers, nom: (d.tiers?.nom ?? "").trim() },
    lignes: (d.lignes ?? []).map((l) => ({
      ...l, designation: String(l.designation ?? "").trim(),
      // Une SECTION n'a ni quantité ni prix : on n'en invente pas, on les met à zéro et le calcul les ignore.
      ...(l.section ? { section: true, quantite: 0, prixUnitaire: 0 } : {}),
      details: Array.isArray(l.details) ? l.details.map((x) => String(x ?? "").trim()).filter(Boolean) : null,
    })),
    tvaDefaut: d.tvaDefaut ?? p.reglages.vatRate,
    remiseGlobale: d.remiseGlobale ?? null,
    modePaiement: d.modePaiement ?? (d.type === "FACTURE" ? "VIREMENT" : null),
    conditionsPaiement: d.conditionsPaiement ?? p.reglages.paymentTerms,
    echeance: d.type === "FACTURE" ? (d.echeance ?? null) : null,
    validiteJours: d.type === "DEVIS" ? validite : null,
    objet: d.objet ?? null,
    referenceAmont: d.referenceAmont ?? null,
    referenceAmontDate: (d.referenceAmontDate ?? "").trim() || null,
    numeroClient: (d.numeroClient ?? "").trim() || null,
    contact: d.contact && (present(d.contact.nom) || present(d.contact.telephone)) ? { nom: d.contact.nom?.trim() || null, telephone: d.contact.telephone?.trim() || null } : null,
    taxes: Array.isArray(d.taxes) && d.taxes.length ? d.taxes.map((x) => ({ libelle: String(x.libelle ?? "").trim(), taux: Number(x.taux) })) : null,
    livraison: d.livraison ?? null,
    notes: d.notes ?? null,
    // LA MARQUE tranche : le signataire du type de pièce, sinon celui par défaut, sinon celui du
    // profil ; les mentions choisies par la société s'ajoutent à la note de pied ; l'accent est
    // celui de la charte (marque > pastille > défaut).
    signataire: signatairePour(p.marque, d.type, p.reglages.signatoryName ? { nom: p.reglages.signatoryName, qualite: p.reglages.signatoryTitle } : null),
    piedDePage: [...(p.reglages.footerNote ? [p.reglages.footerNote] : []), ...mentionsDe(p.marque, p.identite)].filter(Boolean).length
      ? [...(p.reglages.footerNote ? [p.reglages.footerNote] : []), ...mentionsDe(p.marque, p.identite)]
      : null,
    couleur: p.charte.accent,
  };
}

/** La même composition, offerte aux TESTS : rejouer la spec d'une demande sans numéroter ni écrire au registre. */
export const specDepuisDemandePourTest = (d: Partial<DemandeDocument> & { type: TypeDocumentCommercial }, p: ProfilDocumentaire): Omit<SpecDocumentCommercial, "numero"> =>
  specDepuisDemande(d as DemandeDocument, p);

function echeanceLegale(spec: Omit<SpecDocumentCommercial, "numero">): Date | null {
  if (spec.type === "FACTURE" && spec.echeance) return new Date(`${spec.echeance}T00:00:00Z`);
  if (spec.type === "DEVIS") return new Date(`${ajouterJours(spec.date, spec.validiteJours ?? 30)}T00:00:00Z`);
  return null;
}

/** Le compteur avance ATOMIQUEMENT : deux émissions parallèles ne peuvent pas lire le même `last`. */
async function attribuerNumero(tx: Prisma.TransactionClient, companyId: string, kind: string, year: number): Promise<number> {
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "DocumentSequence" ("id", "companyId", "kind", "year", "last", "updatedAt")
    VALUES (${randomUUID()}, ${companyId}, ${kind}, ${year}, 1, now())
    ON CONFLICT ("companyId", "kind", "year")
    DO UPDATE SET "last" = "DocumentSequence"."last" + 1, "updatedAt" = now()
    RETURNING "last"`;
  return Number(rows[0].last);
}

function peutEcrire(user: CurrentUser, verbe: "CREATE" | "UPDATE", type: TypeDocumentCommercial): boolean {
  return legalWriteAllowed({ onLegal: userCan(user, "LEGAL", verbe), onFinances: userCan(user, "FINANCES", verbe), kind: NATURE_LEGALE[type] });
}

/**
 * ÉMET une pièce : vérifie, compose à blanc, reconnaît un doublon, numérote avec la pièce au
 * registre, écrit le fichier (et son PDF), termine la pièce.
 */
export async function emettreDocumentDrive(user: CurrentUser, demande: DemandeDocument): Promise<DocumentEmis | EchecFabrique> {
  const debut = Date.now();
  const type = demande.type;
  if (!TYPES_DOCUMENT.includes(type)) return echec("MISSING_INPUT", `Type de document inconnu : « ${String(type)} » (DEVIS, BON_DE_COMMANDE, FACTURE).`);
  if (!peutEcrire(user, "CREATE", type)) {
    return echec("MISSING_PERMISSION", `Émettre un${type === "FACTURE" ? "e facture" : type === "DEVIS" ? " devis" : " bon de commande"} exige le droit de créer dans Legal${type === "FACTURE" ? " ou dans Finances" : ""}.`);
  }
  const p = await profilDocumentaire(user, demande.societe, { papierEnTeteId: demande.letterheadId ?? null });
  if (!p.ok) return p;
  const { profil, papierOctets, habillage } = p;
  if (!(await canEditCompanyId(user.id, profil.societe.id))) return echec("MISSING_PERMISSION", `Vous voyez ${profil.societe.nom} sans pouvoir l'engager : la pièce ne peut pas être émise en son nom.`);

  const base = specDepuisDemande(demande, profil);
  const provisoire: SpecDocumentCommercial = { ...base, numero: "PROVISOIRE" };
  const regles = verifierSpecCommerciale(provisoire);
  if (regles.bloquants.length > 0) {
    return echec("MISSING_INPUT", `${LIBELLE_TYPE[type]} non émis${type === "FACTURE" ? "e" : ""} : ${regles.bloquants.slice(0, 4).join(" ; ")}`, { bloquants: regles.bloquants });
  }
  // Un `chainFromId` VIDE n'est pas un chaînage : le modèle envoie volontiers "" pour « aucune
  // pièce amont », et une chaîne vide passait le test de présence puis violait la clé étrangère
  // au moment d'écrire — mesuré au banc des défis : « erreur technique », aucun devis émis.
  const chainFromId = (demande.chainFromId ?? "").trim() || null;
  demande = { ...demande, chainFromId };
  if (chainFromId) {
    const amont = await prisma.legalDocument.findUnique({ where: { id: chainFromId }, select: { id: true, companyId: true } });
    if (!amont) return echec("NOT_FOUND", "La pièce amont (devis / bon de commande) n'existe plus.");
    if (amont.companyId && amont.companyId !== profil.societe.id) return echec("MISSING_INPUT", "La pièce amont appartient à une autre société.");
  }
  // LA RÉPÉTITION À BLANC : tout ce qui peut bloquer bloque ICI, avant qu'un numéro existe.
  const essai = await construireDocumentCommercial(provisoire, habillage);
  if (!essai.verification.ok || !essai.totaux) {
    return echec("CAPABILITY_FAILURE", `${LIBELLE_TYPE[type]} non émis${type === "FACTURE" ? "e" : ""} : ${essai.verification.bloquants.slice(0, 4).join(" ; ")}`, { bloquants: essai.verification.bloquants });
  }

  // ── LE DOUBLON, ET L'ÉMISSION INTERROMPUE ────────────────────────────────────────────
  const empreinte = empreinteDocument(base, profil.societe.id);
  const kind = NATURE_LEGALE[type];
  if (!demande.forcerDoublon) {
    const existant = await prisma.legalDocument.findFirst({
      where: { companyId: profil.societe.id, kind, status: { not: "CANCELLED" }, custom: { path: ["fabrique", "empreinte"], equals: empreinte } },
      select: { id: true, reference: true, custom: true, driveNodeId: true },
      orderBy: { createdAt: "asc" },
    });
    const f = existant ? fabriqueDe(existant.custom) : null;
    if (existant && f) {
      if (f.etat === "EMIS" && f.docx && existant.driveNodeId) {
        return {
          ok: true, dejaEmis: true, repris: false, legalDocumentId: existant.id, reference: f.numero, type, version: f.version,
          societe: { id: profil.societe.id, nom: profil.societe.nom }, tiers: base.tiers.nom,
          docx: { nodeId: f.docx.nodeId, nom: nomFichier(f.numero, base.tiers.nom, "docx"), version: f.docx.version },
          pdf: f.pdf ? { nodeId: f.pdf.nodeId, nom: nomFichier(f.numero, base.tiers.nom, "pdf"), pages: f.pdf.pages, methode: f.pdf.methode ?? "rendu" } : null,
          totaux: f.totaux, surPapierEnTete: f.surPapierEnTete, avertissements: [`Une pièce identique existait déjà (${f.numero}) : elle est rendue, aucune nouvelle pièce n'a été émise.`], reglesAppliquees: profil.reglesAppliquees, ms: Date.now() - debut,
        };
      }
      return terminerEmission(user, existant.id, { ...f, spec: { ...base, numero: f.numero } }, habillage, demande, profil, { repris: true, debut, avertissements: essai.verification.avertissements });
    }
  }

  // ── LE NUMÉRO ET LA PIÈCE, ENSEMBLE ──────────────────────────────────────────────────
  const annee = Number(base.date.slice(0, 4));
  const prefixe = type === "DEVIS" ? profil.reglages.quotePrefix : type === "BON_DE_COMMANDE" ? profil.reglages.orderPrefix : profil.reglages.invoicePrefix;
  const totaux = essai.totaux;
  const cree = await prisma.$transaction(async (tx) => {
    const seq = await attribuerNumero(tx, profil.societe.id, kind, annee);
    const numero = formaterNumero(prefixe, annee, seq, profil.reglages.numerotation[type] ?? null);
    const fabrique: Fabrique = {
      version: 1, etat: "EN_COURS", type, empreinte, societeId: profil.societe.id, numero,
      spec: { ...base, numero }, totaux: resumeTotaux(totaux), docx: null, pdf: null,
      surPapierEnTete: essai.surPapierEnTete, papierEnTeteId: profil.papierEnTete?.id ?? null,
      emisPar: user.id, emisLe: new Date().toISOString(), historique: [],
    };
    const doc = await tx.legalDocument.create({
      data: {
        companyId: profil.societe.id, kind, reference: numero,
        title: titreDocument({ type, numero, tiers: base.tiers }),
        counterparty: base.tiers.nom,
        startDate: new Date(`${base.date}T00:00:00Z`),
        endDate: echeanceLegale(base),
        amount: new Prisma.Decimal(totaux.totalTtc),
        direction: type === "FACTURE" ? "IN" : null,
        chainFromId: demande.chainFromId ?? null,
        notes: `${LIBELLE_TYPE[type]} émis${type === "FACTURE" ? "e" : ""} par Adam — TTC ${formaterDzd(totaux.totalTtc)}.`,
        createdById: user.id, updatedById: user.id,
        custom: { fabrique } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { id: doc.id, fabrique };
  });
  return terminerEmission(user, cree.id, cree.fabrique, habillage, demande, profil, { repris: false, debut, avertissements: essai.verification.avertissements });
}

/** Compose la pièce numérotée, l'écrit dans le Drive (+ PDF), et clôt l'émission au registre. */
async function terminerEmission(
  user: CurrentUser, legalDocumentId: string, fabrique: Fabrique, habillage: Habillage, demande: DemandeDocument, profil: ProfilDocumentaire,
  ctx: { repris: boolean; debut: number; avertissements: string[] },
): Promise<DocumentEmis | EchecFabrique> {
  const spec = fabrique.spec;
  const construit = await construireDocumentCommercial(spec, habillage);
  if (!construit.verification.ok || !construit.totaux) {
    return echec("CAPABILITY_FAILURE", `La pièce ${fabrique.numero} est numérotée au registre mais son fichier n'a pas pu être composé : ${construit.verification.bloquants.slice(0, 3).join(" ; ")}`, { bloquants: construit.verification.bloquants });
  }
  const dossier = demande.dossier?.trim() || undefined;
  const nomDocx = nomFichier(fabrique.numero, spec.tiers.nom, "docx");
  const docx = await portsArtefact.documents.creerFichier(user.id, { nom: nomDocx, octets: construit.octets, mime: MIME_DOCX, dossier });
  let pdf: Fabrique["pdf"] = null;
  const avertissements = [...ctx.avertissements, ...manquesDIdentite(profil)];
  if (!demande.sansPdf) {
    const conv = await pdfDeLaPiece(user, { nodeId: docx.nodeId, version: docx.version }, construit.octets);
    if (conv.ok) {
      const noeud = await portsArtefact.documents.creerFichier(user.id, { nom: nomFichier(fabrique.numero, spec.tiers.nom, "pdf"), octets: conv.pdf, mime: "application/pdf", dossier });
      pdf = { nodeId: noeud.nodeId, version: noeud.version, pages: conv.pages, methode: conv.methode };
      const reserve = reservePdf(conv.methode, construit.surPapierEnTete);
      if (reserve) avertissements.push(reserve);
    } else avertissements.push(`PDF non produit : ${conv.error}`);
  }
  const finale: Fabrique = { ...fabrique, etat: "EMIS", docx: { nodeId: docx.nodeId, version: docx.version }, pdf, totaux: resumeTotaux(construit.totaux), surPapierEnTete: construit.surPapierEnTete };
  await prisma.legalDocument.update({
    where: { id: legalDocumentId },
    data: { driveNodeId: docx.nodeId, amount: new Prisma.Decimal(construit.totaux.totalTtc), updatedById: user.id, custom: { fabrique: finale } as unknown as Prisma.InputJsonValue },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: legalDocumentId,
    summary: `${LIBELLE_TYPE[spec.type]} ${fabrique.numero} émis${spec.type === "FACTURE" ? "e" : ""} par Adam pour ${spec.tiers.nom} — ${formaterDzd(construit.totaux.totalTtc)}${ctx.repris ? " (émission interrompue terminée)" : ""}`,
  });
  return {
    ok: true, dejaEmis: false, repris: ctx.repris, legalDocumentId, reference: fabrique.numero, type: spec.type, version: finale.version,
    societe: { id: profil.societe.id, nom: profil.societe.nom }, tiers: spec.tiers.nom,
    docx: { nodeId: docx.nodeId, nom: nomDocx, version: docx.version },
    pdf: pdf ? { nodeId: pdf.nodeId, nom: nomFichier(fabrique.numero, spec.tiers.nom, "pdf"), pages: pdf.pages, methode: pdf.methode ?? "rendu" } : null,
    totaux: finale.totaux, surPapierEnTete: construit.surPapierEnTete, avertissements, reglesAppliquees: profil.reglesAppliquees, ms: Date.now() - ctx.debut,
  };
}

// ─────────────────────────── L'aperçu ───────────────────────────

export interface ApercuDocument {
  ok: true;
  societe: { id: string; nom: string };
  /** Le numéro que la PROCHAINE émission recevra si personne n'émet entre-temps — prévu, pas réservé. */
  numeroProchain: string;
  motif: string | null;
  papierEnTete: { id: string; nom: string } | null;
  identiteIncomplete: string[];
  /** La spécification telle qu'elle sera composée, numéro prévu compris. */
  spec: SpecDocumentCommercial;
  totaux: TotauxCommerciaux | null;
  bloquants: string[];
  avertissements: string[];
  peutEmettre: boolean;
  /** Vrai quand le PDF sera imprimé par l'éditeur Office ; faux = rendu du serveur. */
  pdfParEditeur: boolean;
}

/**
 * L'APERÇU d'une pièce : la MÊME composition que l'émission — vérification, calcul, mise en page,
 * relecture — jouée à blanc, sans consommer de numéro ni écrire une ligne. C'est ce que l'écran
 * des Finances montre pendant la saisie : totaux, somme en lettres, numéro prévu, papier, et ce
 * qui bloquerait. Deux compositions (une pour l'aperçu, une pour l'émission) finiraient par
 * diverger sur un arrondi (§118.5) ; il n'y en a qu'une.
 */
export async function previsualiserDocument(user: CurrentUser, demande: DemandeDocument): Promise<ApercuDocument | EchecFabrique> {
  const type = demande.type;
  if (!TYPES_DOCUMENT.includes(type)) return echec("MISSING_INPUT", `Type de document inconnu : « ${String(type)} » (DEVIS, BON_DE_COMMANDE, FACTURE).`);
  if (!peutEcrire(user, "CREATE", type)) {
    return echec("MISSING_PERMISSION", `Émettre un${type === "FACTURE" ? "e facture" : type === "DEVIS" ? " devis" : " bon de commande"} exige le droit de créer dans Legal${type !== "DEVIS" ? " ou dans Finances" : ""}.`);
  }
  const p = await profilDocumentaire(user, demande.societe, { papierEnTeteId: demande.letterheadId ?? null });
  if (!p.ok) return p;
  const { profil, habillage } = p;
  if (!(await canEditCompanyId(user.id, profil.societe.id))) return echec("MISSING_PERMISSION", `Vous voyez ${profil.societe.nom} sans pouvoir l'engager : la pièce ne peut pas être émise en son nom.`);
  const base = specDepuisDemande(demande, profil);
  const annee = Number(base.date.slice(0, 4));
  const kind = NATURE_LEGALE[type];
  const prefixe = type === "DEVIS" ? profil.reglages.quotePrefix : type === "BON_DE_COMMANDE" ? profil.reglages.orderPrefix : profil.reglages.invoicePrefix;
  const motif = profil.reglages.numerotation[type] ?? null;
  const anneeSure = Number.isFinite(annee) ? annee : new Date().getUTCFullYear();
  const seq = await prisma.documentSequence.findUnique({ where: { companyId_kind_year: { companyId: profil.societe.id, kind, year: anneeSure } }, select: { last: true } });
  const numeroProchain = formaterNumero(prefixe, anneeSure, (seq?.last ?? 0) + 1, motif);
  const spec: SpecDocumentCommercial = { ...base, numero: numeroProchain };
  const commun = { ok: true as const, societe: { id: profil.societe.id, nom: profil.societe.nom }, numeroProchain, motif, papierEnTete: profil.papierEnTete, identiteIncomplete: profil.identiteIncomplete, spec, pdfParEditeur: convertConfigured() };
  const regles = verifierSpecCommerciale(spec);
  if (regles.bloquants.length > 0) return { ...commun, totaux: null, bloquants: regles.bloquants, avertissements: [...regles.avertissements, ...manquesDIdentite(profil)], peutEmettre: false };
  const essai = await construireDocumentCommercial(spec, habillage);
  return { ...commun, totaux: essai.totaux, bloquants: essai.verification.bloquants, avertissements: [...essai.verification.avertissements, ...manquesDIdentite(profil)], peutEmettre: essai.verification.ok };
}

// ─────────────────────────── La révision ───────────────────────────

export type ModificationsDocument = Partial<Pick<DemandeDocument, "tiers" | "lignes" | "echeance" | "validiteJours" | "tvaDefaut" | "remiseGlobale" | "modePaiement" | "conditionsPaiement" | "objet" | "referenceAmont" | "referenceAmontDate" | "numeroClient" | "contact" | "taxes" | "livraison" | "notes">>;

/**
 * RÉVISE un devis ou un bon de commande émis : même numéro, nouvelle version du même fichier,
 * historique au registre. Une FACTURE émise ne se réécrit pas — on émet un avoir ou une nouvelle
 * facture, et la règle est dite.
 */
export async function reviserDocumentDrive(
  user: CurrentUser, opts: { legalDocumentId: string; modifications: ModificationsDocument; motif?: string | null },
): Promise<DocumentEmis | EchecFabrique> {
  const debut = Date.now();
  const doc = await prisma.legalDocument.findUnique({ where: { id: opts.legalDocumentId }, select: { id: true, companyId: true, kind: true, status: true, custom: true, driveNodeId: true } });
  const f = doc ? fabriqueDe(doc.custom) : null;
  if (!doc || !f) return echec("NOT_FOUND", "Cette pièce n'existe pas, ou n'a pas été émise par la fabrique (seules celles-ci se révisent).");
  if (f.type === "FACTURE") return echec("CAPABILITY_FAILURE", `La facture ${f.numero} est émise : une facture ne se réécrit pas. Émettre un avoir ou une nouvelle facture.`);
  if (doc.status !== "ACTIVE") return echec("CAPABILITY_FAILURE", `La pièce ${f.numero} est ${doc.status === "CANCELLED" ? "annulée" : "close"} : elle ne se révise plus.`);
  if (!peutEcrire(user, "UPDATE", f.type)) return echec("MISSING_PERMISSION", "Réviser cette pièce exige le droit de modifier dans Legal.");
  if (!(await canEditCompanyId(user.id, doc.companyId))) return echec("MISSING_PERMISSION", "Cette pièce appartient à une société que vous ne pouvez pas engager.");
  if (!doc.driveNodeId || !f.docx) return echec("CAPABILITY_FAILURE", `La pièce ${f.numero} n'a pas de fichier : relancer son émission avant de la réviser.`);
  const p = await profilDocumentaire(user, doc.companyId);
  if (!p.ok) return p;
  const m = opts.modifications ?? {};
  const spec: SpecDocumentCommercial = {
    ...f.spec,
    emetteur: p.profil.identite,
    tiers: m.tiers ? { ...f.spec.tiers, ...m.tiers, nom: (m.tiers.nom ?? f.spec.tiers.nom).trim() } : f.spec.tiers,
    lignes: m.lignes ? m.lignes.map((l) => ({ ...l, designation: String(l.designation ?? "").trim(), ...(l.section ? { section: true, quantite: 0, prixUnitaire: 0 } : {}) })) : f.spec.lignes,
    echeance: m.echeance !== undefined ? m.echeance : f.spec.echeance,
    validiteJours: m.validiteJours !== undefined ? m.validiteJours : f.spec.validiteJours,
    tvaDefaut: m.tvaDefaut !== undefined ? m.tvaDefaut : f.spec.tvaDefaut,
    remiseGlobale: m.remiseGlobale !== undefined ? m.remiseGlobale : f.spec.remiseGlobale,
    modePaiement: m.modePaiement !== undefined ? m.modePaiement : f.spec.modePaiement,
    conditionsPaiement: m.conditionsPaiement !== undefined ? m.conditionsPaiement : f.spec.conditionsPaiement,
    objet: m.objet !== undefined ? m.objet : f.spec.objet,
    referenceAmont: m.referenceAmont !== undefined ? m.referenceAmont : f.spec.referenceAmont,
    referenceAmontDate: m.referenceAmontDate !== undefined ? m.referenceAmontDate : f.spec.referenceAmontDate,
    numeroClient: m.numeroClient !== undefined ? m.numeroClient : f.spec.numeroClient,
    contact: m.contact !== undefined ? m.contact : f.spec.contact,
    taxes: m.taxes !== undefined ? m.taxes : f.spec.taxes,
    livraison: m.livraison !== undefined ? m.livraison : f.spec.livraison,
    notes: m.notes !== undefined ? m.notes : f.spec.notes,
  };
  const regles = verifierSpecCommerciale(spec);
  if (regles.bloquants.length > 0) return echec("MISSING_INPUT", `Révision refusée : ${regles.bloquants.slice(0, 4).join(" ; ")}`, { bloquants: regles.bloquants });
  const construit = await construireDocumentCommercial(spec, p.habillage);
  if (!construit.verification.ok || !construit.totaux) return echec("CAPABILITY_FAILURE", `Révision refusée : ${construit.verification.bloquants.slice(0, 4).join(" ; ")}`, { bloquants: construit.verification.bloquants });

  const version = f.version + 1;
  const resume = `v${version}${opts.motif?.trim() ? ` — ${opts.motif.trim()}` : ""}`;
  const ecrit = await portsArtefact.documents.ecrireVersion(user.id, doc.driveNodeId, construit.octets, { mime: MIME_DOCX, resume });
  let pdf = f.pdf;
  const avertissements = [...regles.avertissements, ...construit.verification.avertissements, ...manquesDIdentite(p.profil)];
  const conv = await pdfDeLaPiece(user, { nodeId: doc.driveNodeId, version: ecrit.version }, construit.octets);
  if (conv.ok) {
    if (pdf) {
      const v = await portsArtefact.documents.ecrireVersion(user.id, pdf.nodeId, conv.pdf, { mime: "application/pdf", resume });
      pdf = { ...pdf, version: v.version, pages: conv.pages, methode: conv.methode };
    } else {
      const n = await portsArtefact.documents.creerFichier(user.id, { nom: nomFichier(f.numero, spec.tiers.nom, "pdf"), octets: conv.pdf, mime: "application/pdf" });
      pdf = { nodeId: n.nodeId, version: n.version, pages: conv.pages, methode: conv.methode };
    }
    const reserve = reservePdf(conv.methode, construit.surPapierEnTete);
    if (reserve) avertissements.push(reserve);
  } else avertissements.push(`PDF non produit : ${conv.error}`);
  const finale: Fabrique = {
    ...f, version, spec, totaux: resumeTotaux(construit.totaux), docx: { nodeId: doc.driveNodeId, version: ecrit.version }, pdf, surPapierEnTete: construit.surPapierEnTete,
    historique: [...(f.historique ?? []), { version, le: new Date().toISOString(), par: user.id, resume }],
  };
  await prisma.legalDocument.update({
    where: { id: doc.id },
    data: {
      title: titreDocument({ type: f.type, numero: f.numero, tiers: spec.tiers }), counterparty: spec.tiers.nom,
      amount: new Prisma.Decimal(construit.totaux.totalTtc), endDate: echeanceLegale(spec), updatedById: user.id,
      custom: { fabrique: finale } as unknown as Prisma.InputJsonValue,
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Legal", entityType: "LEGAL_DOCUMENT", entityId: doc.id, summary: `${LIBELLE_TYPE[f.type]} ${f.numero} révisé par Adam (${resume}) — ${formaterDzd(construit.totaux.totalTtc)}` });
  return {
    ok: true, dejaEmis: false, repris: false, legalDocumentId: doc.id, reference: f.numero, type: f.type, version,
    societe: { id: p.profil.societe.id, nom: p.profil.societe.nom }, tiers: spec.tiers.nom,
    docx: { nodeId: doc.driveNodeId, nom: nomFichier(f.numero, spec.tiers.nom, "docx"), version: ecrit.version },
    pdf: pdf ? { nodeId: pdf.nodeId, nom: nomFichier(f.numero, spec.tiers.nom, "pdf"), pages: pdf.pages, methode: pdf.methode ?? "rendu" } : null,
    totaux: finale.totaux, surPapierEnTete: construit.surPapierEnTete, avertissements, reglesAppliquees: p.profil.reglesAppliquees, ms: Date.now() - debut,
  };
}

// ─────────────────────────── Le dossier à trois formats ───────────────────────────

export interface DossierEmis {
  ok: true;
  classeur: { nodeId: string; nom: string; formules: number };
  deck: { nodeId: string; nom: string; diapos: number };
  note: { nodeId: string; nom: string; pages: number };
  coherence: { totauxCompares: number };
  avertissements: string[];
  ms: number;
}

/**
 * CONSTRUIT le dossier (classeur + deck + note) depuis les données canoniques et l'écrit dans le
 * Drive — les trois fichiers, ou aucun. La société nommée fournit sa couleur et son papier.
 */
export async function construireDossierDrive(
  user: CurrentUser, opts: { nom: string; canon: DonneesCanoniques; societe?: string | null; dossier?: string | null },
): Promise<DossierEmis | EchecFabrique> {
  const debut = Date.now();
  let canon = opts.canon;
  let papier: Buffer | null = null;
  let habillage: Habillage | null = null;
  // Un dossier exécutif porte la charte de la société ou dit qu'il ne la porte pas — même règle
  // que les pièces commerciales : un livrable neutre présenté comme « le vôtre » est un faux succès.
  const manques: string[] = [];
  if (opts.societe) {
    const p = await profilDocumentaire(user, opts.societe);
    if (!p.ok) return p;
    papier = p.papierOctets;
    habillage = p.habillage;
    manques.push(...manquesDIdentite(p.profil));
    // La charte de la société (marque > pastille) colore le dossier ; une couleur demandée
    // explicitement dans les données canoniques garde la main.
    canon = { ...canon, societe: { nom: p.profil.identite.nom, couleur: canon.societe?.couleur ?? p.profil.societe.couleur } };
  }
  if (!canon.societe?.nom) canon = { ...canon, societe: { nom: user.name ?? "Adam", couleur: null } };
  const d = await construireDossier(canon, { base: papier, police: habillage?.police ?? null, logo: habillage?.logo ?? null });
  if (!d.ok) return echec("CAPABILITY_FAILURE", `Le dossier n'a pas été écrit : ${d.bloquants.slice(0, 5).join(" ; ")}`, { bloquants: d.bloquants });
  const nom = opts.nom.trim().replace(/\.(xlsx|pptx|docx)$/i, "") || canon.titre.trim() || "Dossier Adam";
  const dossier = opts.dossier?.trim() || undefined;
  const [classeur, deck, note] = await Promise.all([
    portsArtefact.documents.creerFichier(user.id, { nom: `${nom}.xlsx`, octets: d.classeur.octets, mime: MIME_XLSX, dossier }),
    portsArtefact.documents.creerFichier(user.id, { nom: `${nom}.pptx`, octets: d.deck.octets, mime: MIME_PPTX, dossier }),
    portsArtefact.documents.creerFichier(user.id, { nom: `${nom}.docx`, octets: d.note.octets, mime: MIME_DOCX, dossier }),
  ]);
  await portsArtefact.audit.tracer({
    userId: user.id, action: "dossier_build", cible: note.nodeId,
    detail: `dossier « ${nom} » construit en trois formats, cohérence vérifiée sur ${d.coherence?.totauxCompares ?? 0} total(aux)`,
  });
  return {
    ok: true,
    classeur: { nodeId: classeur.nodeId, nom: `${nom}.xlsx`, formules: d.classeur.verification?.formules ?? 0 },
    deck: { nodeId: deck.nodeId, nom: `${nom}.pptx`, diapos: d.deck.verification?.diapos ?? 0 },
    note: { nodeId: note.nodeId, nom: `${nom}.docx`, pages: d.note.verification?.pages ?? 0 },
    coherence: { totauxCompares: d.coherence?.totauxCompares ?? 0 },
    avertissements: [...d.avertissements, ...manques], ms: Date.now() - debut,
  };
}
