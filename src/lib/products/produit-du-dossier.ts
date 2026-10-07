import { identityKey, manquesIdentite, nomCanonique, type ProductIdentity, type TraitIdentite } from "./identity";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN DOSSIER = UN PRODUIT (Direction, 08/10 : « on a dit : un seul catalogue de produits ! »).
 *
 * La DÉCISION, pure et sans base — la lecture et l'écriture vivent dans `canonique.ts`
 * (`ensureProduitDuDossier`). Séparées pour que la règle se vérifie au cas près (§118.178).
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────
 *
 * Chaque dossier réglementaire EST un produit, qu'on connaisse ou non toute son identité. Le
 * `Product` reste l'ancre technique (ventes, visites, segmentation, AO, consommation, coûts le
 * référencent par `productId`), mais il naît du dossier, un pour un :
 *   - un dossier sans produit en reçoit UN, à lui — jamais celui d'un autre dossier, même de
 *     même identité : le catalogue ne fusionne plus des dossiers ;
 *   - une identité incomplète n'est plus un blocage, c'est une INDICATION sur la fiche
 *     (« Conditionnement à compléter ») ;
 *   - une identité qui se complète ou se corrige met à jour LE MÊME produit ; un champ vidé ne
 *     le vide pas (une donnée manquante ne désigne rien) ;
 *   - un produit déjà partagé par plusieurs dossiers (héritage de l'ancien catalogue) n'est pas
 *     scindé d'office : seul le dossier dont l'identité S'EN ÉCARTE reçoit son propre produit.
 *
 * ── LA CLÉ ───────────────────────────────────────────────────────────────────────────────
 *
 * `Product.identityKey` est unique en base. Un produit à l'identité complète porte la clé
 * d'identité quand elle est libre ; sinon (un autre dossier de même identité l'a déjà) elle est
 * suffixée de l'identifiant du dossier. Un produit à l'identité incomplète porte une clé dérivée
 * du SEUL dossier : deux dossiers incomplets ne se confondent jamais.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const PREFIXE_CLE_DOSSIER = "dossier:";

/** Le tuple d'identité tel que `Product` le stocke. */
export interface IdentiteProduit {
  dci: string;
  dosage: string | null;
  dosageUnit: string | null;
  form: string | null;
  packaging: string | null;
}

/** Le produit actuel du dossier, tel que la décision a besoin de le connaître. */
export interface ProduitActuel extends IdentiteProduit {
  id: string;
  canonicalName: string;
  identityKey: string;
  /** Les AUTRES dossiers qui pointent sur ce produit (0 = il est à ce dossier seul). */
  autresDossiers: number;
}

const vide = (v: string | null | undefined) => !String(v ?? "").trim();

/**
 * L'IDENTITÉ RETENUE : ce que le dossier dit, et — là où il se tait — ce que le produit savait.
 * Un champ effacé par erreur sur le dossier ne détruit pas l'identité connue.
 */
export function identiteFusionnee(dossier: ProductIdentity, produit: IdentiteProduit | null): IdentiteProduit {
  const pris = (a: string | null | undefined, b: string | null | undefined) => (vide(a) ? (vide(b) ? null : String(b).trim()) : String(a).trim());
  return {
    dci: pris(dossier.dci, produit?.dci) ?? "",
    dosage: pris(dossier.dosage, produit?.dosage),
    dosageUnit: pris(dossier.dosageUnit, produit?.dosageUnit),
    form: pris(dossier.form, produit?.form),
    packaging: pris(dossier.packaging, produit?.packaging),
  };
}

/**
 * LA CLÉ DU PRODUIT D'UN DOSSIER.
 * @param porteurDeLaCle le produit qui porte DÉJÀ la clé d'identité complète (null si personne).
 * @param produitId le produit du dossier, s'il en a un — il peut garder la clé qu'il porte.
 */
export function cleProduitDuDossier(dossierId: string, t: ProductIdentity, porteurDeLaCle: string | null, produitId: string | null = null): string {
  const cle = identityKey(t);
  if (!cle || manquesIdentite(t).length > 0) return `${PREFIXE_CLE_DOSSIER}${dossierId}`;
  if (porteurDeLaCle === null || porteurDeLaCle === produitId) return cle;
  return `${cle}#${dossierId}`;
}

/** Les noms qu'un produit portait sans qu'une personne les ait choisis — ceux qu'on peut refaire. */
export function nomAutomatique(nom: string, t: ProductIdentity, reference?: string | null): boolean {
  const ancienDefaut = [t.dci, t.dosage, t.dosageUnit].filter(Boolean).join(" ").trim();
  return nom === nomCanonique(t) || nom === ancienDefaut || nom === t.dci || (!!reference && nom === reference);
}

/** Le nom d'un produit né d'un dossier — ses traits connus, sinon la référence du dossier. */
export function nomDuProduit(t: ProductIdentity, reference: string): string {
  return nomCanonique(t) || reference;
}

export type PlanProduit =
  /** Le dossier n'a pas de produit : on lui en crée un, à lui. */
  | { action: "CREER"; identite: IdentiteProduit; cle: string; nom: string }
  /** Le produit est à ce dossier seul : il suit son identité (même produit). */
  | { action: "METTRE_A_JOUR"; produitId: string; changements: Partial<IdentiteProduit & { identityKey: string; canonicalName: string }> }
  | { action: "DEJA"; produitId: string }
  /** Produit partagé (ancien catalogue), identité commune : on ne scinde rien d'office. */
  | { action: "PARTAGE"; produitId: string; autresDossiers: number }
  /** Produit partagé, mais CE dossier s'en écarte : il reçoit son propre produit. */
  | { action: "SEPARER"; ancienProduitId: string; identite: IdentiteProduit; cle: string; nom: string };

/**
 * QUE FAIRE DU PRODUIT DE CE DOSSIER — la décision entière, sans base.
 * @param porteurDeLaCle le produit qui porte déjà la clé d'identité COMPLÈTE de l'identité retenue.
 */
export function planProduitDuDossier(input: {
  dossier: { id: string; reference: string; identite: ProductIdentity };
  produit: ProduitActuel | null;
  porteurDeLaCle: string | null;
}): PlanProduit {
  const { dossier, produit, porteurDeLaCle } = input;

  if (!produit) {
    const identite = identiteFusionnee(dossier.identite, null);
    return {
      action: "CREER", identite,
      cle: cleProduitDuDossier(dossier.id, identite, porteurDeLaCle),
      nom: nomDuProduit(identite, dossier.reference),
    };
  }

  const identite = identiteFusionnee(dossier.identite, produit);
  const ecart = identityKey(identite) !== identityKey(produit);

  if (produit.autresDossiers > 0) {
    if (!ecart) return { action: "PARTAGE", produitId: produit.id, autresDossiers: produit.autresDossiers };
    // L'ancien produit reste celui des autres dossiers : la clé qu'il porte n'est pas à nous.
    return {
      action: "SEPARER", ancienProduitId: produit.id, identite,
      cle: cleProduitDuDossier(dossier.id, identite, porteurDeLaCle),
      nom: nomDuProduit(identite, dossier.reference),
    };
  }

  const changements: Partial<IdentiteProduit & { identityKey: string; canonicalName: string }> = {};
  for (const k of ["dci", "dosage", "dosageUnit", "form", "packaging"] as const) {
    if ((identite[k] ?? null) !== (produit[k] ?? null)) (changements as Record<string, string | null>)[k] = identite[k];
  }
  // La clé suit l'identité (complétée, corrigée, ou écrite par une version précédente de la fonction).
  const cleVoulue = cleProduitDuDossier(dossier.id, identite, porteurDeLaCle, produit.id);
  if (produit.identityKey !== cleVoulue) changements.identityKey = cleVoulue;
  if (ecart || "dci" in changements) {
    const nom = nomDuProduit(identite, dossier.reference);
    // Un nom choisi par une personne reste ; un nom automatique suit l'identité.
    if (nom !== produit.canonicalName && nomAutomatique(produit.canonicalName, produit, dossier.reference)) changements.canonicalName = nom;
  }
  if (Object.keys(changements).length === 0) return { action: "DEJA", produitId: produit.id };
  return { action: "METTRE_A_JOUR", produitId: produit.id, changements };
}

// ─────────────────────────── L'indication sur la fiche ───────────────────────────

const NOM_TRAIT: Record<TraitIdentite, string> = {
  DCI: "DCI",
  DOSAGE: "dosage",
  UNITE: "unité du dosage",
  FORME: "forme",
  CONDITIONNEMENT: "conditionnement",
};

/**
 * LA PHRASE QU'UN ENREGISTREMENT DE DOSSIER AJOUTE — vide quand il n'y a rien à dire (le produit
 * existait et suit en silence). Une identité incomplète se dit, sans rien bloquer.
 */
export function phraseProduitDuDossier(r: { etat: string; code?: string; manques?: readonly TraitIdentite[] }): string | null {
  if (r.etat !== "CREE" && r.etat !== "SEPARE") return null;
  const titre = titreACompleter(r.manques ?? []);
  return `Produit ${r.code} créé.${titre ? ` ${titre} sur le dossier.` : ""}`;
}

/** « Conditionnement à compléter », « Dosage et forme à compléter » — `null` quand rien ne manque. */
export function titreACompleter(manques: readonly TraitIdentite[]): string | null {
  if (!manques.length) return null;
  const mots = manques.map((m) => NOM_TRAIT[m]);
  const liste = mots.length === 1 ? mots[0] : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;
  return `${liste.charAt(0).toUpperCase()}${liste.slice(1)} à compléter`;
}
