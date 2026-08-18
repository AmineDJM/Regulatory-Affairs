/**
 * LES GAMMES — ce que quelqu'un voit quand on ne lui donne pas une société entière.
 *
 * L'entité répond à « de qui est ce produit » ; la gamme répond à « de quoi relève-t-il ».
 * Rattacher quelqu'un à une ENTITÉ lui ouvre toute la société. Le rattacher à une ou plusieurs
 * GAMMES lui ouvre ces gammes-là, et rien d'autre — c'est ce qui permet à un chef de produit de
 * suivre sa gamme sans voir le portefeuille entier, et à quelqu'un de travailler sur deux gammes
 * de deux sociétés différentes.
 *
 * TROIS RÈGLES, ET ELLES TIENNENT ENSEMBLE :
 *
 *  1. Une gamme rattachée DONNE ACCÈS à son entité — en lecture. Sans cela, rattacher quelqu'un
 *     à la gamme « Cardiologie » de Pharmagène sans lui donner Pharmagène ne lui ouvrirait rien :
 *     un droit qui n'ouvre rien est un bug qu'on met des semaines à comprendre.
 *  2. Un rattachement par gamme RESTREINT les produits, jamais l'inverse. Quelqu'un rattaché à
 *     l'entité ENTIÈRE (autorisation d'entité ou société d'appartenance) n'est pas restreint par
 *     ses gammes : on ne retire pas un droit qu'on a donné plus haut.
 *  3. Le Super Admin ne se restreint jamais — il arbitre, il doit tout voir.
 *
 * Module PUR — testé, sans base de données.
 */

export interface RangeGrant {
  rangeId: string;
  companyId: string;
}

export interface RangeBearer {
  /** Vue groupe (Super Admin) : jamais restreint. */
  wholeGroup: boolean;
  /** Sociétés ouvertes ENTIÈREMENT (autorisation d'entité + société d'appartenance). */
  fullCompanyIds: string[];
  /** Gammes rattachées nominativement. */
  rangeGrants: RangeGrant[];
}

/**
 * Les entités qu'un rattachement par gamme rend accessibles — règle 1.
 *
 * On ne renvoie que des identifiants d'entité : c'est `allowedCompanyIds` qui décide ensuite,
 * en les additionnant à l'appartenance et aux autorisations d'entité.
 */
export function companyIdsFromRanges(grants: RangeGrant[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of grants) {
    if (!g.companyId || seen.has(g.companyId)) continue;
    seen.add(g.companyId);
    out.push(g.companyId);
  }
  return out;
}

/**
 * LES GAMMES QUI RESTREIGNENT VRAIMENT — règle 2.
 *
 * Une gamme dont l'entité est déjà ouverte en entier ne restreint rien : la personne voit cette
 * société de toute façon. Ne restent que les gammes qui sont son SEUL titre d'accès à leur
 * société. Sans ce tri, donner « Pharmagène » puis rattacher la gamme « Cardio » d'Adventum
 * aurait silencieusement réduit Pharmagène à une gamme qui n'en fait même pas partie.
 */
export function restrictingRangeIds(bearer: RangeBearer): string[] {
  if (bearer.wholeGroup) return [];
  const full = new Set(bearer.fullCompanyIds);
  return bearer.rangeGrants.filter((g) => !full.has(g.companyId)).map((g) => g.rangeId);
}

/**
 * LE FILTRE PRISMA DES PRODUITS — `null` quand il n'y a rien à restreindre.
 *
 * Deux cas donnent `null`, et ils sont différents :
 *   • aucun rattachement par gamme → la personne relève de ses entités, point ;
 *   • toutes ses gammes sont dans des sociétés qu'elle voit déjà en entier (règle 2).
 *
 * Sinon, la personne ne voit que les produits DE SES GAMMES, dans les sociétés où la gamme est
 * son seul titre — plus les produits des sociétés qu'elle a en entier, qui restent visibles.
 */
export function productRangeWhere(
  bearer: RangeBearer,
): { OR: ({ rangeId: { in: string[] } } | { companyId: { in: string[] } })[] } | null {
  const rangeIds = restrictingRangeIds(bearer);
  if (rangeIds.length === 0) return null;

  const clauses: ({ rangeId: { in: string[] } } | { companyId: { in: string[] } })[] = [
    { rangeId: { in: rangeIds } },
  ];
  // Les sociétés ouvertes en entier ne passent pas par la gamme : elles restent entières.
  if (bearer.fullCompanyIds.length > 0) clauses.push({ companyId: { in: bearer.fullCompanyIds } });
  return { OR: clauses };
}

/** Le produit `p` est-il visible de ce porteur ? Même règle que le filtre, côté mémoire. */
export function canSeeProduct(
  bearer: RangeBearer,
  p: { companyId?: string | null; rangeId?: string | null },
): boolean {
  if (bearer.wholeGroup) return true;
  const rangeIds = new Set(restrictingRangeIds(bearer));
  if (rangeIds.size === 0) return true; // pas de restriction par gamme : l'entité décide seule
  if (p.rangeId && rangeIds.has(p.rangeId)) return true;
  return !!p.companyId && bearer.fullCompanyIds.includes(p.companyId);
}

/** Une gamme telle qu'on l'affiche dans l'arbre Entité → Gammes → Produits. */
export interface RangeNode {
  id: string;
  name: string;
  companyId: string;
  color: string | null;
  isActive: boolean;
  productCount: number;
  memberCount: number;
}

/** Une entité et ses gammes — l'ordre d'affichage vient des entités, puis du nom de la gamme. */
export interface CompanyRangeTree {
  companyId: string;
  companyLabel: string;
  color: string | null;
  ranges: RangeNode[];
  /** Produits de l'entité qui ne relèvent d'AUCUNE gamme — à classer, donc à montrer. */
  unranged: number;
}

/**
 * Range les gammes sous leur entité, dans l'ordre des entités.
 *
 * Une entité SANS gamme reste dans l'arbre : c'est là qu'on vient lui en créer une, et la faire
 * disparaître laisserait croire qu'elle n'existe pas.
 *
 * Fonction PURE — testée.
 */
export function buildRangeTree(
  companies: { id: string; label: string; color: string | null }[],
  ranges: RangeNode[],
  unrangedByCompany: Record<string, number>,
): CompanyRangeTree[] {
  return companies.map((c) => ({
    companyId: c.id,
    companyLabel: c.label,
    color: c.color,
    ranges: ranges
      .filter((r) => r.companyId === c.id)
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    unranged: unrangedByCompany[c.id] ?? 0,
  }));
}

/**
 * Le libellé d'un rattachement, tel qu'on l'écrit sur la fiche de quelqu'un.
 *
 * On nomme l'ENTITÉ quand elle est ouverte en entier, et « Entité › Gamme » sinon : dire
 * seulement « Cardiologie » laisserait ignorer de quelle société il s'agit, alors que deux
 * sociétés peuvent avoir une gamme du même nom.
 */
export function describeAttachment(companyLabel: string, rangeName?: string | null): string {
  return rangeName ? `${companyLabel} › ${rangeName}` : companyLabel;
}
