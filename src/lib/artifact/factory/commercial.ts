/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES DOCUMENTS COMMERCIAUX — devis, bon de commande, facture : ce qu'ils portent, ce qu'ils
 * calculent, ce qui les rend valides.
 *
 * ── LES CHIFFRES SONT CALCULÉS PAR LE CODE, JAMAIS RECOPIÉS D'UN MODÈLE ─────────────────
 *
 * Un modèle de langage propose des lignes (désignation, quantité, prix). Le montant HT de la
 * ligne, la remise, la TVA par taux, le timbre, le TTC et le montant en lettres sont dérivés
 * ICI, avec des arrondis au centime définis une fois. Un total « tapé » par le modèle n'existe
 * pas dans la spécification : il n'y a pas de champ pour l'écrire.
 *
 * ── LES MENTIONS OBLIGATOIRES SONT VÉRIFIÉES, PAS ESPÉRÉES ──────────────────────────────
 *
 * Une facture algérienne sans NIF, sans RC ou sans article d'imposition de l'émetteur est une
 * facture qu'un comptable rejette. `verifierSpecCommerciale` refuse d'en produire une : le
 * bloquant nomme le champ manquant, et la personne le renseigne dans la carte d'identité de la
 * société (Legal) — une fois, pour toutes les factures suivantes. Un devis ou un bon de commande
 * sans ces mentions se produit, avec un avertissement.
 *
 * Module PUR : ni base, ni fichier, ni session.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { createHash } from "node:crypto";
import { montantEnLettres } from "@/lib/artifact/factory/lettres";

export const TYPES_DOCUMENT = ["DEVIS", "BON_DE_COMMANDE", "FACTURE"] as const;
export type TypeDocumentCommercial = (typeof TYPES_DOCUMENT)[number];

export const LIBELLE_TYPE: Record<TypeDocumentCommercial, string> = {
  DEVIS: "Devis",
  BON_DE_COMMANDE: "Bon de commande",
  FACTURE: "Facture",
};

/** Le préfixe de numérotation par défaut — le profil documentaire d'une société peut le changer. */
export const PREFIXE_DEFAUT: Record<TypeDocumentCommercial, string> = { DEVIS: "DEV", BON_DE_COMMANDE: "BC", FACTURE: "FA" };

/** La nature Legal correspondante : un document émis EST une pièce du registre (§17). */
export const NATURE_LEGALE: Record<TypeDocumentCommercial, "QUOTE" | "PURCHASE_ORDER" | "INVOICE"> = {
  DEVIS: "QUOTE",
  BON_DE_COMMANDE: "PURCHASE_ORDER",
  FACTURE: "INVOICE",
};

/** Les taux de TVA en vigueur en Algérie : exonéré, réduit, normal. Tout autre taux est refusé. */
export const TAUX_TVA_ADMIS = [0, 0.09, 0.19] as const;
export const TVA_NORMALE = 0.19;

/**
 * LE DROIT DE TIMBRE sur un règlement en espèces : 1 % du TTC, plancher 5 DZD, plafond 2 500 DZD
 * (code du timbre, art. 100). Appliqué seulement quand le mode de paiement est ESPECES ; un
 * virement ou un chèque n'en porte pas.
 */
export const TIMBRE_FISCAL = { taux: 0.01, min: 5, max: 2_500 } as const;

export const MODES_PAIEMENT = ["VIREMENT", "CHEQUE", "ESPECES", "AUTRE"] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];
export const LIBELLE_MODE: Record<ModePaiement, string> = { VIREMENT: "Virement bancaire", CHEQUE: "Chèque", ESPECES: "Espèces", AUTRE: "À convenir" };

/** L'émetteur ou le tiers — ce qui figure sur la pièce. */
export interface PartieCommerciale {
  nom: string;
  formeJuridique?: string | null;
  capital?: string | null;
  adresse?: string | null;
  rc?: string | null;
  nif?: string | null;
  /** Article d'imposition. */
  ai?: string | null;
  nis?: string | null;
  telephone?: string | null;
  email?: string | null;
  banque?: string | null;
  rib?: string | null;
}

export interface LigneCommerciale {
  designation: string;
  quantite: number;
  unite?: string | null;
  /** Prix unitaire HORS TAXES. */
  prixUnitaire: number;
  /** Remise de ligne, en fraction (0,1 = 10 %). */
  remise?: number | null;
  /** Taux de TVA de la ligne, en fraction. Absent = le taux par défaut du document. */
  tva?: number | null;
  reference?: string | null;
}

export interface SpecDocumentCommercial {
  type: TypeDocumentCommercial;
  /** Le numéro attribué par le registre : « FA-2026-0007 ». */
  numero: string;
  /** Date d'émission, ISO `AAAA-MM-JJ`. */
  date: string;
  emetteur: PartieCommerciale;
  tiers: PartieCommerciale;
  lignes: LigneCommerciale[];
  /** Le taux de TVA appliqué aux lignes qui n'en déclarent pas. Défaut : 19 %. */
  tvaDefaut?: number | null;
  /** Remise globale sur le total HT, en fraction. */
  remiseGlobale?: number | null;
  modePaiement?: ModePaiement | null;
  conditionsPaiement?: string | null;
  /** Échéance de règlement (facture), ISO. */
  echeance?: string | null;
  /** Durée de validité d'un devis, en jours. */
  validiteJours?: number | null;
  objet?: string | null;
  /** « Suivant devis n° DEV-2026-0012 » — la pièce amont, en clair. */
  referenceAmont?: string | null;
  livraison?: { adresse?: string | null; delai?: string | null } | null;
  notes?: string | null;
  signataire?: { nom: string; qualite?: string | null } | null;
  /** Mentions de pied de page (identité légale, banque) — composées par l'appelant. */
  piedDePage?: string[] | null;
  /** Couleur d'accent (hexadécimale, avec ou sans dièse). */
  couleur?: string | null;
  /** Vrai quand le document sera posé sur un papier en-tête : l'identité de l'émetteur y est déjà. */
  surPapierEnTete?: boolean;
}

export interface LigneCalculee extends LigneCommerciale {
  n: number;
  taux: number;
  /** Quantité × prix unitaire, avant remise. */
  brut: number;
  remiseMontant: number;
  /** Le montant HT net de la ligne. */
  ht: number;
}

export interface TotauxCommerciaux {
  lignes: LigneCalculee[];
  totalHtBrut: number;
  /** Remises de ligne cumulées. */
  remisesLignes: number;
  /** Remise globale, en montant. */
  remiseGlobale: number;
  /** Le total HT après toutes les remises — la base de la TVA. */
  totalHt: number;
  tva: { taux: number; base: number; montant: number }[];
  totalTva: number;
  timbre: number;
  totalTtc: number;
  enLettres: string;
}

// ─────────────────────────── L'arithmétique ───────────────────────────

/** Arrondi au centime, demi-centime vers le haut, stable aux flottants (2,675 → 2,68). */
export function arrondirCentimes(x: number): number {
  const signe = x < 0 ? -1 : 1;
  const c = Math.round(Number((Math.abs(x) * 100).toFixed(6)));
  return (signe * c) / 100;
}

const fraction = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function calculerTotaux(spec: SpecDocumentCommercial): TotauxCommerciaux {
  const tauxDefaut = spec.tvaDefaut === null || spec.tvaDefaut === undefined ? TVA_NORMALE : spec.tvaDefaut;
  const lignes: LigneCalculee[] = spec.lignes.map((l, i) => {
    const brut = arrondirCentimes(l.quantite * l.prixUnitaire);
    const remiseMontant = arrondirCentimes(brut * fraction(l.remise));
    const ht = arrondirCentimes(brut - remiseMontant);
    const taux = l.tva === null || l.tva === undefined ? tauxDefaut : l.tva;
    return { ...l, n: i + 1, taux, brut, remiseMontant, ht };
  });
  const totalHtBrut = arrondirCentimes(lignes.reduce((s, l) => s + l.brut, 0));
  const remisesLignes = arrondirCentimes(lignes.reduce((s, l) => s + l.remiseMontant, 0));
  const htApresLignes = arrondirCentimes(totalHtBrut - remisesLignes);
  const tauxGlobal = fraction(spec.remiseGlobale);
  const remiseGlobale = arrondirCentimes(htApresLignes * tauxGlobal);
  const totalHt = arrondirCentimes(htApresLignes - remiseGlobale);

  // LA TVA PAR TAUX : la base de chaque taux est la somme des lignes de ce taux, la remise
  // globale répartie au prorata — c'est ainsi qu'un vérificateur la recalcule.
  const bases = new Map<number, number>();
  for (const l of lignes) bases.set(l.taux, arrondirCentimes((bases.get(l.taux) ?? 0) + l.ht));
  const tva = [...bases.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, baseBrute]) => {
      const base = arrondirCentimes(baseBrute * (1 - tauxGlobal));
      return { taux, base, montant: arrondirCentimes(base * taux) };
    });
  const totalTva = arrondirCentimes(tva.reduce((s, t) => s + t.montant, 0));
  const ttcAvantTimbre = arrondirCentimes(totalHt + totalTva);
  const timbre = spec.modePaiement === "ESPECES" && ttcAvantTimbre > 0
    ? Math.min(TIMBRE_FISCAL.max, Math.max(TIMBRE_FISCAL.min, arrondirCentimes(ttcAvantTimbre * TIMBRE_FISCAL.taux)))
    : 0;
  const totalTtc = arrondirCentimes(ttcAvantTimbre + timbre);
  return { lignes, totalHtBrut, remisesLignes, remiseGlobale, totalHt, tva, totalTva, timbre, totalTtc, enLettres: montantEnLettres(totalTtc) };
}

// ─────────────────────────── Les formats ───────────────────────────

/** Espace insécable ordinaire (U+00A0) : présente dans toutes les polices, y compris celles des PDF. */
const NBSP = "\u00a0";

/** « 41 300,50 » — séparateur de milliers insécable, virgule décimale, toujours deux décimales. */
export function formaterMontant(n: number, decimales = 2): string {
  const v = arrondirCentimes(n);
  const [entier, dec = ""] = Math.abs(v).toFixed(decimales).split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${v < 0 ? "-" : ""}${groupes}${decimales > 0 ? `,${dec}` : ""}`;
}

export const formaterDzd = (n: number): string => `${formaterMontant(n)}${NBSP}DZD`;

/** « 2,5 » pour une quantité fractionnaire, « 12 » pour une quantité entière. */
export function formaterQuantite(q: number): string {
  if (Number.isInteger(q)) return formaterMontant(q, 0);
  return formaterMontant(q, 3).replace(/0+$/, "").replace(/,$/, "");
}

export function formaterTaux(t: number): string {
  const p = t * 100;
  return `${Number.isInteger(p) ? p : p.toFixed(1).replace(".", ",")}${NBSP}%`;
}

/** « 05/09/2026 » depuis une date ISO ; une date illisible est rendue telle quelle. */
export function formaterDateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function ajouterJours(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** « FA-2026-0007 » : préfixe, année, séquence sur quatre chiffres (davantage si elle déborde). */
export function formaterNumero(prefixe: string, annee: number, sequence: number): string {
  return `${prefixe.trim().toUpperCase()}-${annee}-${String(sequence).padStart(4, "0")}`;
}

// ─────────────────────────── La validité ───────────────────────────

export interface VerificationSpec { bloquants: string[]; avertissements: string[] }

/** Les mentions d'identité que porte l'émetteur d'une FACTURE, et le nom humain de chacune. */
const MENTIONS_EMETTEUR: { cle: keyof PartieCommerciale; libelle: string }[] = [
  { cle: "adresse", libelle: "l'adresse du siège" },
  { cle: "rc", libelle: "le numéro de registre de commerce (RC)" },
  { cle: "nif", libelle: "le NIF" },
  { cle: "ai", libelle: "l'article d'imposition" },
  { cle: "nis", libelle: "le NIS" },
];

const vide = (v: string | null | undefined): boolean => !v || v.trim() === "";
const dateIso = (v: string | null | undefined): boolean => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

/**
 * CE QUI EMPÊCHE DE PRODUIRE LA PIÈCE, et ce qui mérite seulement d'être dit.
 *
 * Bloquant : pas de ligne, une quantité nulle ou négative, un prix négatif, un taux de TVA
 * inconnu en Algérie, un tiers sans nom, une date illisible — et, pour une FACTURE, une mention
 * d'identité manquante chez l'émetteur ou le NIF du client absent.
 */
export function verifierSpecCommerciale(spec: SpecDocumentCommercial): VerificationSpec {
  const bloquants: string[] = [];
  const avertissements: string[] = [];
  const quoi = LIBELLE_TYPE[spec.type] ?? "Document";
  if (!TYPES_DOCUMENT.includes(spec.type)) bloquants.push(`Type de document inconnu : « ${String(spec.type)} » (attendu : ${TYPES_DOCUMENT.join(", ")}).`);
  if (vide(spec.numero)) bloquants.push("Le document n'a pas de numéro.");
  if (!dateIso(spec.date)) bloquants.push(`La date d'émission « ${spec.date ?? ""} » n'est pas une date AAAA-MM-JJ.`);
  if (spec.echeance && !dateIso(spec.echeance)) bloquants.push(`L'échéance « ${spec.echeance} » n'est pas une date AAAA-MM-JJ.`);
  if (spec.echeance && dateIso(spec.echeance) && dateIso(spec.date) && spec.echeance < spec.date) bloquants.push("L'échéance précède la date d'émission.");
  if (vide(spec.emetteur?.nom)) bloquants.push("L'émetteur n'a pas de dénomination.");
  if (vide(spec.tiers?.nom)) bloquants.push(`${quoi} sans destinataire : le nom du ${spec.type === "BON_DE_COMMANDE" ? "fournisseur" : "client"} manque.`);

  if (!Array.isArray(spec.lignes) || spec.lignes.length === 0) bloquants.push(`${quoi} sans aucune ligne.`);
  else {
    if (spec.lignes.length > 400) bloquants.push(`${spec.lignes.length} lignes : au-delà de 400, ce n'est plus une pièce commerciale mais une annexe — la joindre en Excel.`);
    spec.lignes.forEach((l, i) => {
      const n = i + 1;
      if (vide(l.designation)) bloquants.push(`Ligne ${n} : désignation vide.`);
      if (typeof l.quantite !== "number" || !Number.isFinite(l.quantite) || l.quantite <= 0) bloquants.push(`Ligne ${n} : quantité invalide (${String(l.quantite)}).`);
      if (typeof l.prixUnitaire !== "number" || !Number.isFinite(l.prixUnitaire) || l.prixUnitaire < 0) bloquants.push(`Ligne ${n} : prix unitaire invalide (${String(l.prixUnitaire)}).`);
      if (l.remise !== null && l.remise !== undefined && (l.remise < 0 || l.remise >= 1)) bloquants.push(`Ligne ${n} : remise ${l.remise} hors de [0 ; 1[ — une remise s'écrit en fraction (0,1 = 10 %).`);
      const taux = l.tva === null || l.tva === undefined ? (spec.tvaDefaut ?? TVA_NORMALE) : l.tva;
      if (!TAUX_TVA_ADMIS.some((t) => Math.abs(t - taux) < 1e-9)) bloquants.push(`Ligne ${n} : taux de TVA ${taux} inconnu en Algérie (admis : 0, 0,09, 0,19).`);
      if (l.prixUnitaire === 0) avertissements.push(`Ligne ${n} « ${l.designation} » : prix unitaire à zéro — offert ?`);
    });
  }
  if (spec.remiseGlobale !== null && spec.remiseGlobale !== undefined && (spec.remiseGlobale < 0 || spec.remiseGlobale >= 1)) bloquants.push(`Remise globale ${spec.remiseGlobale} hors de [0 ; 1[.`);
  if (spec.tvaDefaut !== null && spec.tvaDefaut !== undefined && !TAUX_TVA_ADMIS.some((t) => Math.abs(t - spec.tvaDefaut!) < 1e-9)) bloquants.push(`Taux de TVA par défaut ${spec.tvaDefaut} inconnu en Algérie.`);
  if (spec.modePaiement && !MODES_PAIEMENT.includes(spec.modePaiement)) bloquants.push(`Mode de paiement « ${spec.modePaiement} » inconnu (${MODES_PAIEMENT.join(", ")}).`);

  // Les mentions d'identité : exigées sur une facture, souhaitées ailleurs.
  const manquantes = MENTIONS_EMETTEUR.filter((m) => vide(spec.emetteur?.[m.cle] as string | null | undefined)).map((m) => m.libelle);
  if (manquantes.length > 0) {
    const phrase = `Identité de l'émetteur incomplète : ${manquantes.join(", ")} — à renseigner dans la carte d'identité légale de la société.`;
    if (spec.type === "FACTURE") bloquants.push(phrase);
    else avertissements.push(phrase);
  }
  if (spec.type === "FACTURE" && vide(spec.tiers?.nif) && vide(spec.tiers?.rc)) {
    avertissements.push("Le client n'a ni NIF ni RC sur la facture : une facture entre professionnels les porte.");
  }
  if (spec.type === "DEVIS" && (spec.validiteJours === null || spec.validiteJours === undefined)) avertissements.push("Devis sans durée de validité : 30 jours seront indiqués.");
  if (spec.type === "FACTURE" && vide(spec.modePaiement)) avertissements.push("Facture sans mode de paiement.");
  return { bloquants, avertissements };
}

// ─────────────────────────── L'empreinte ───────────────────────────

const normaliser = (s: string | null | undefined): string => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * L'EMPREINTE D'UN CONTENU — ce qui permet de reconnaître « le même bon de commande » émis
 * deux fois par une reprise après panne : même type, même émetteur, même tiers, mêmes lignes,
 * même date. Le numéro n'en fait pas partie, précisément parce qu'il n'est attribué qu'après.
 */
export function empreinteDocument(spec: Omit<SpecDocumentCommercial, "numero">, societeId: string): string {
  const corps = {
    societeId, type: spec.type, date: spec.date, tiers: normaliser(spec.tiers?.nom),
    lignes: (spec.lignes ?? []).map((l) => [normaliser(l.designation), l.quantite, l.prixUnitaire, l.remise ?? 0, l.tva ?? null]),
    remiseGlobale: spec.remiseGlobale ?? 0, tvaDefaut: spec.tvaDefaut ?? null, modePaiement: spec.modePaiement ?? null,
    referenceAmont: normaliser(spec.referenceAmont), objet: normaliser(spec.objet),
  };
  return createHash("sha256").update(JSON.stringify(corps)).digest("hex").slice(0, 32);
}

/** Le titre de la pièce au registre Legal : « Facture n° FA-2026-0007 — Pharmacie Centrale ». */
export function titreDocument(spec: Pick<SpecDocumentCommercial, "type" | "numero" | "tiers">): string {
  return `${LIBELLE_TYPE[spec.type]} n° ${spec.numero} — ${spec.tiers.nom.trim()}`;
}
