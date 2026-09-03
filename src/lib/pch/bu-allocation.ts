/**
 * DU LOT D'APPEL D'OFFRES AU PORTEFEUILLE D'UNE BUSINESS UNIT — et de là au KAM.
 *
 * ── LA CHAÎNE, ET POURQUOI ELLE S'ARRÊTAIT AU MILIEU ────────────────────────────────────────
 *
 * On gagne un lot PCH ; quelqu'un doit le vendre. La force de vente sait déjà attribuer un
 * produit à un délégué — elle a son écran, ses cycles, ses droits (`PromotionAssignment`). Ce qui
 * manquait était le MAILLON D'AVANT : rien ne disait quelle gamme portait quel lot, et les
 * produits gagnés en appel d'offres n'apparaissaient nulle part dans le portefeuille des BU. On
 * les répartissait de vive voix, et trois mois plus tard personne ne savait qui suivait quoi.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 * Affecter une Business Unit à un lot INSCRIT ce produit au portefeuille de cette BU. À partir de
 * là, c'est le circuit existant qui prend la main : la force de vente attribue le produit à ses
 * KAM, cycle par cycle, depuis son propre écran.
 *
 * On ne construit PAS un second mécanisme d'attribution. Celui de la force de vente marche ; il
 * lui manquait seulement de savoir que ces produits existent. Un second circuit aurait produit
 * deux vérités sur « qui porte ce produit », et l'écran qui les affiche aurait dû choisir.
 *
 * ── CE QU'ON N'INVENTE PAS ──────────────────────────────────────────────────────────────────
 *
 * Ni le canal (ville / hôpital), ni le chef de produit, ni les prévisions. Le produit entre au
 * portefeuille avec son NOM et son rattachement, et rien d'autre : ce sont des décisions
 * commerciales qui appartiennent à la BU, pas des valeurs qu'un rattachement peut deviner.
 *
 * Module PUR : ni base, ni session. Testé.
 */

export interface TenderLineIdentity {
  designation: string;
  dci?: string | null;
  dosage?: string | null;
  form?: string | null;
  /** Le produit canonique, quand le lot en désigne un chez nous. */
  productId?: string | null;
}

/**
 * LE NOM DU PRODUIT DANS LE PORTEFEUILLE.
 *
 * La désignation du marché d'abord — c'est elle qui fait foi juridiquement et c'est sous ce nom
 * que l'équipe reconnaîtra le lot. Le dosage et la forme la suivent quand ils la distinguent
 * d'une autre ligne du même bordereau : un portefeuille où « Amoxicilline » apparaît trois fois
 * sans qu'on puisse les différencier n'aide personne.
 */
export function portfolioName(line: TenderLineIdentity): string {
  const base = line.designation.trim() || (line.dci ?? "").trim() || "Produit du marché";
  const precisions = [line.dosage, line.form].map((v) => (v ?? "").trim()).filter(Boolean);
  if (precisions.length === 0) return base;
  // Si la désignation porte DÉJÀ le dosage, on ne le répète pas : « Amoxicilline 500 mg 500 mg ».
  const dejaDit = precisions.every((p) => base.toLowerCase().includes(p.toLowerCase()));
  return dejaDit ? base : `${base} — ${precisions.join(" ")}`;
}

export interface AllocationChange {
  /** Les BU à AJOUTER au lot. */
  toAdd: string[];
  /** Les BU à RETIRER. */
  toRemove: string[];
  /** Rien ne change : inutile d'écrire, inutile de journaliser. */
  unchanged: boolean;
}

/**
 * CE QU'IL FAUT ÉCRIRE POUR PASSER DE L'ÉTAT ACTUEL À L'ÉTAT VOULU — et rien de plus.
 *
 * Effacer puis tout réécrire aurait été plus court à coder et aurait perdu la DATE de chaque
 * affectation : « depuis quand cette BU porte-t-elle ce produit ? » n'aurait plus eu de réponse,
 * et le journal d'audit aurait montré vingt retraits suivis de vingt ajouts à chaque
 * enregistrement — illisible, et faux.
 */
export function allocationChange(current: readonly string[], wanted: readonly string[]): AllocationChange {
  const actuel = new Set(current);
  const voulu = new Set(wanted.filter((v) => v.trim().length > 0));
  const toAdd = [...voulu].filter((id) => !actuel.has(id));
  const toRemove = [...actuel].filter((id) => !voulu.has(id));
  return { toAdd, toRemove, unchanged: toAdd.length === 0 && toRemove.length === 0 };
}

/** Ce que le journal retient d'une affectation — les noms, pas les identifiants. */
export function allocationSummary(
  productName: string,
  added: readonly string[],
  removed: readonly string[],
): string {
  const morceaux: string[] = [];
  if (added.length > 0) morceaux.push(`confié à ${added.join(", ")}`);
  if (removed.length > 0) morceaux.push(`retiré à ${removed.join(", ")}`);
  return morceaux.length > 0
    ? `« ${productName} » ${morceaux.join(" · ")}`
    : `« ${productName} » — affectation inchangée`;
}

/**
 * UN LOT SANS AFFECTATION EST-IL UN PROBLÈME ?
 *
 * Seulement s'il est GAGNÉ. Un lot perdu, annulé ou encore à l'étude n'a personne à qui être
 * confié — signaler son absence d'affectation ferait crier l'écran sur dix-neuf lignes qui vont
 * très bien, et l'on cesserait de lire l'alerte le jour où elle compte.
 */
export function needsAllocation(status: string, businessUnitCount: number): boolean {
  return status === "WON" && businessUnitCount === 0;
}

/** Ce qu'on écrit en tête du bloc d'affectations. */
export function allocationNotice(wonLines: number, unallocated: number): string | null {
  if (wonLines === 0) return null;
  if (unallocated === 0) return `Les ${wonLines} lot(s) gagné(s) sont confiés à une Business Unit.`;
  return `${unallocated} lot(s) gagné(s) sur ${wonLines} n'ont pas encore de Business Unit — ils n'apparaîtront dans aucun portefeuille tant que personne ne les porte.`;
}
