import type { LigneCommerciale, ModePaiement, PartieCommerciale } from "@/lib/artifact/factory/commercial";
import { MODES_PAIEMENT } from "@/lib/artifact/factory/commercial";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BROUILLON D'UN BON DE COMMANDE — « à vérifier par le demandeur » (Direction, 10/2026).
 *
 * « Ne pas générer et envoyer le BC direct aux Finances : il faut d'abord pré-valider le preview du BC par le
 * demandeur, avec modification possible. » Générer ne fait donc PLUS de BC : cela dépose un BROUILLON sur le devis
 * (`AdProDevis.bcBrouillon`) — ce que le demandeur relit, corrige, et ne valide qu'ensuite. Tant que le brouillon
 * existe : AUCUN numéro n'est attribué (la série NNN/DG/AAAA reste continue, sans trou), aucune pièce n'est écrite au
 * registre, rien ne part aux Finances ni au centre de validation. « Valider et envoyer aux Finances » attribue le
 * numéro, produit le Word et le PDF définitifs et lance la marche existante (visa du centre, signature).
 *
 * Module PUR (aucun import lourd) : lu par l'écran (composant client) comme par les actions serveur.
 * Une valeur `null` d'un champ dit « telle que le devis la donne » ; une valeur écrite remplace.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const ETIQUETTE_BROUILLON = "Brouillon — à vérifier par le demandeur";

export interface BrouillonBc {
  /** Le poste pour lequel le brouillon a été préparé. */
  itemId: string;
  /** Qui l'a préparé, et quand (ISO). */
  par: string;
  parNom: string | null;
  le: string;
  /** Dernière modification (ISO) et par qui. */
  modifieLe: string | null;
  modifiePar: string | null;
  /** Les lignes corrigées par le demandeur ; `null` = celles que les lignes validées du devis donnent. */
  lignes: LigneCommerciale[] | null;
  /** L'empreinte des lignes du devis AU MOMENT où `lignes` a été écrit : si les lignes validées bougent ensuite, le brouillon est périmé. */
  signature: string | null;
  /** « Référence » de la bande (objet du BC). */
  objet: string | null;
  notes: string | null;
  /** « Contact » de la bande. */
  contact: { nom: string | null; telephone: string | null } | null;
  /** « Modalités de paiement » de la bande : le mode, puis le texte libre. */
  modePaiement: ModePaiement | null;
  conditionsPaiement: string | null;
  /** Lieu (« Adresse de livraison »), date (ISO, mention) et délai de livraison. */
  livraison: { adresse: string | null; date: string | null; delai: string | null } | null;
  /** Le bloc « A : » du fournisseur : seuls les champs écrits remplacent ceux du devis. */
  tiers: Partial<Pick<PartieCommerciale, "nom" | "adresse" | "telephone" | "email" | "rc" | "nif">> | null;
}

const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function ligneLue(v: unknown): LigneCommerciale | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const designation = texte(o.designation);
  if (!designation) return null;
  const section = o.section === true;
  return {
    designation,
    section,
    unite: texte(o.unite),
    details: Array.isArray(o.details) ? o.details.map(texte).filter((x): x is string => x !== null) : [],
    quantite: section ? 0 : (nombre(o.quantite) ?? Number.NaN),
    prixUnitaire: section ? 0 : (nombre(o.prixUnitaire) ?? Number.NaN),
    remise: nombre(o.remise),
    tva: nombre(o.tva),
    reference: texte(o.reference),
  };
}

/** Le JSON gardé en base → le brouillon typé, ou `null` s'il n'y en a pas (ou s'il est illisible : on n'invente rien). */
export function lireBrouillon(brut: unknown): BrouillonBc | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  const itemId = texte(o.itemId);
  const par = texte(o.par);
  const le = texte(o.le);
  if (!itemId || !par || !le) return null;
  const c = o.contact && typeof o.contact === "object" ? (o.contact as Record<string, unknown>) : null;
  const l = o.livraison && typeof o.livraison === "object" ? (o.livraison as Record<string, unknown>) : null;
  const t = o.tiers && typeof o.tiers === "object" ? (o.tiers as Record<string, unknown>) : null;
  const mode = typeof o.modePaiement === "string" && (MODES_PAIEMENT as readonly string[]).includes(o.modePaiement) ? (o.modePaiement as ModePaiement) : null;
  return {
    itemId, par, parNom: texte(o.parNom), le, modifieLe: texte(o.modifieLe), modifiePar: texte(o.modifiePar),
    lignes: Array.isArray(o.lignes) ? o.lignes.map(ligneLue).filter((x): x is LigneCommerciale => x !== null) : null,
    signature: texte(o.signature),
    objet: texte(o.objet), notes: texte(o.notes),
    contact: c ? { nom: texte(c.nom), telephone: texte(c.telephone) } : null,
    modePaiement: mode, conditionsPaiement: texte(o.conditionsPaiement),
    livraison: l ? { adresse: texte(l.adresse), date: texte(l.date), delai: texte(l.delai) } : null,
    tiers: t ? { nom: texte(t.nom) ?? undefined, adresse: texte(t.adresse), telephone: texte(t.telephone), email: texte(t.email), rc: texte(t.rc), nif: texte(t.nif) } : null,
  };
}

/** Un brouillon neuf : rien n'est corrigé, tout vient du devis. */
export function brouillonNeuf(p: { itemId: string; par: string; parNom: string | null; maintenant?: Date }): BrouillonBc {
  return {
    itemId: p.itemId, par: p.par, parNom: p.parNom, le: (p.maintenant ?? new Date()).toISOString(), modifieLe: null, modifiePar: null,
    lignes: null, signature: null, objet: null, notes: null, contact: null, modePaiement: null, conditionsPaiement: null, livraison: null, tiers: null,
  };
}

/** L'empreinte des lignes du devis (désignation, unité, quantité, prix) : ce que le brouillon corrigé a pris pour base. */
export function signatureDesLignes(lignes: readonly LigneCommerciale[]): string {
  return lignes.map((l) => [l.designation, l.unite ?? "", l.quantite, l.prixUnitaire, l.section ? "S" : ""].join("¦")).join("§");
}

/** Le brouillon est PÉRIMÉ quand ses lignes corrigées reposent sur d'autres lignes validées que celles d'aujourd'hui. */
export function brouillonPerime(b: BrouillonBc, lignesDuDevis: readonly LigneCommerciale[]): boolean {
  return b.lignes !== null && b.signature !== signatureDesLignes(lignesDuDevis);
}

/** QUI VALIDE : le demandeur de la demande, ou le Super Admin — pas l'assistante qui a préparé, pas un autre rôle. */
export function peutValiderLeBrouillon(p: { userId: string; role: string; demandeurId: string | null | undefined }): boolean {
  return p.role === "SUPER_ADMIN" || (p.demandeurId != null && p.demandeurId === p.userId);
}

export const REFUS_VALIDATION_BROUILLON =
  "Seul le demandeur de la demande (ou le Super Admin) valide l'aperçu du bon de commande et l'envoie aux Finances.";

/** Le hors-taxe des lignes chiffrées (net de remise), en DZD — pour le plafond de l'accordé avant d'émettre. */
export function totalHtDesLignes(lignes: readonly LigneCommerciale[]): number {
  return lignes.filter((l) => !l.section).reduce((s, l) => s + l.quantite * l.prixUnitaire * (1 - (l.remise ?? 0)), 0);
}

/** Les lignes que le brouillon porte ou, à défaut, celles du devis. */
export const lignesEffectives = (b: BrouillonBc | null, duDevis: readonly LigneCommerciale[]): LigneCommerciale[] =>
  b?.lignes && b.lignes.length > 0 ? b.lignes : [...duDevis];
