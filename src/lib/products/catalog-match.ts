import { moleculeStem, canonicalForm, extractDosage } from "@/lib/market/galenic";

/**
 * RAPPROCHER LES CATALOGUES PRODUITS — sans jamais décider à la place de quelqu'un.
 *
 * Trois modules tiennent leur propre liste de produits : le RÉGLEMENTAIRE (les dossiers, la
 * référence), le BUSINESS DEVELOPMENT (les produits à l'étude) et le PLANNING PROMOTIONNEL (les
 * produits que les délégués promeuvent). Les trois écrivent la même molécule à leur façon —
 * « AMOXICILLINE 500 mg cp », « Amoxicilline 500MG comprimé », « AMOXICILLIN 500 » — et rien ne
 * dit qu'il s'agit du même produit. Résultat : on ne peut ni remonter du plan de visite au
 * dossier d'enregistrement, ni savoir si un produit à l'étude est déjà enregistré.
 *
 * Ce module PROPOSE des rapprochements. Il ne les applique pas, et c'est délibéré :
 *
 *   **UN DOSAGE DIFFÉRENT EST UN PRODUIT DIFFÉRENT.** 500 mg et 1 g partagent la molécule, la
 *   forme et souvent le nom commercial ; ce sont deux dossiers, deux AMM, deux prix. Une fusion
 *   automatique sur ressemblance en confondrait un jour deux — et l'erreur ne se verrait qu'au
 *   moment où elle coûte cher. La machine classe, un humain confirme.
 *
 * Module PUR : il ne lit ni la base ni la session, et réutilise les normalisations pharma déjà
 * éprouvées (`moleculeStem`, `canonicalForm`, `extractDosage`).
 *
 * Limite connue et assumée : `canonicalForm` comprend les formes galéniques ÉCRITES EN FRANÇAIS.
 * Un libellé anglais (« tablet ») retombe sur « AUTRE » et fait simplement baisser le score, sans
 * jamais produire de faux rapprochement. Les trois catalogues visés ici sont saisis en français ;
 * élargir ce vocabulaire toucherait l'intelligence marché, qui a ses propres règles.
 */

export interface ProductIdentity {
  /** La molécule / DCI, telle qu'elle est écrite dans le module d'origine. */
  dci: string | null | undefined;
  dosage?: string | null;
  /** Forme galénique, écrite librement (« cp », « comprimé pelliculé », « gélule »…). */
  form?: string | null;
  /** Nom commercial, quand le module en tient un. */
  brandName?: string | null;
}

/** Une correspondance proposée, avec ce qui la justifie. */
export interface MatchProposal<T> {
  candidate: T;
  /** 0 → 100. Au-delà de `STRONG_MATCH`, la proposition se présente en tête. */
  score: number;
  /** Ce qui a permis (ou empêché) le rapprochement, en français, pour la personne qui tranche. */
  reason: string;
}

/** À partir de ce score, la proposition est assez sûre pour être présentée d'emblée. */
export const STRONG_MATCH = 70;

/**
 * La CLÉ d'un produit : molécule + dosage + forme, normalisés.
 *
 * Deux produits de clé identique sont le même produit — c'est la seule affirmation que ce module
 * fasse sans réserve. Le nom commercial n'y entre PAS : le même dossier se vend sous des marques
 * différentes selon le pays, et deux marques différentes ne sont pas deux produits.
 */
export function productKey(p: ProductIdentity): string {
  const molecule = moleculeStem(p.dci);
  // Le dosage peut être écrit à part (colonne dédiée) ou noyé dans le libellé : on cherche dans
  // les deux, sans quoi « AMOXICILLINE 500 MG » sans colonne dosage n'aurait pas de dosage.
  const dose = extractDosage(p.dosage) ?? extractDosage(p.dci) ?? "";
  const form = canonicalForm(p.form ?? p.dci);
  return [molecule, dose, form].join("|");
}

/**
 * À quel point ces deux produits se ressemblent-ils, de 0 à 100 ?
 *
 * La molécule est éliminatoire : sans elle, rien à dire. Le dosage et la forme font le reste — et
 * un dosage QUI DIFFÈRE fait chuter le score au lieu de le laisser haut, parce que c'est
 * précisément le cas où l'on risque de confondre deux produits proches.
 */
export function matchScore(a: ProductIdentity, b: ProductIdentity): { score: number; reason: string } {
  const ma = moleculeStem(a.dci);
  const mb = moleculeStem(b.dci);
  if (!ma || !mb) return { score: 0, reason: "molécule absente d'un côté" };
  const sameMolecule = ma === mb || ma.split(" ").every((w) => mb.split(" ").some((x) => x.startsWith(w) || w.startsWith(x)));
  if (!sameMolecule) return { score: 0, reason: "molécules différentes" };

  const da = extractDosage(a.dosage) ?? extractDosage(a.dci);
  const db = extractDosage(b.dosage) ?? extractDosage(b.dci);
  const fa = canonicalForm(a.form ?? a.dci);
  const fb = canonicalForm(b.form ?? b.dci);

  let score = 50; // même molécule : le socle
  const notes: string[] = ["même molécule"];

  if (da && db) {
    if (da === db) { score += 35; notes.push(`même dosage (${da})`); }
    // DOSAGE DIFFÉRENT = produit différent. On ne rend pas 0 (l'un des deux peut être mal saisi),
    // mais on descend sous le seuil de confiance pour que la proposition ne s'impose jamais seule.
    else { score -= 25; notes.push(`DOSAGES DIFFÉRENTS (${da} ≠ ${db})`); }
  } else {
    notes.push("dosage inconnu d'un côté");
  }

  if (fa !== "AUTRE" && fb !== "AUTRE") {
    if (fa === fb) { score += 15; notes.push("même forme"); }
    else { score -= 20; notes.push(`formes différentes (${fa} ≠ ${fb})`); }
  }

  return { score: Math.max(0, Math.min(100, score)), reason: notes.join(" · ") };
}

/**
 * Les meilleures correspondances d'un produit dans un catalogue, les plus sûres d'abord.
 *
 * Les scores nuls sont écartés : proposer « aucun rapport » allongerait la liste sans aider. À
 * égalité de score, l'ordre du catalogue est conservé — un tri instable ferait danser les
 * propositions d'un affichage à l'autre, et l'on ne saurait plus laquelle on avait regardée.
 */
export function bestMatches<T extends ProductIdentity>(
  target: ProductIdentity,
  catalog: readonly T[],
  limit = 5,
): MatchProposal<T>[] {
  return catalog
    .map((candidate, index) => ({ candidate, index, ...matchScore(target, candidate) }))
    .filter((m) => m.score > 0)
    .sort((x, y) => (y.score - x.score) || (x.index - y.index))
    .slice(0, limit)
    .map(({ candidate, score, reason }) => ({ candidate, score, reason }));
}

/** La correspondance est-elle assez sûre pour être proposée d'emblée (et non cherchée à la main) ? */
export function isConfident(score: number): boolean {
  return score >= STRONG_MATCH;
}
