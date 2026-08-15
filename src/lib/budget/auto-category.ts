/**
 * DANS QUELLE CATÉGORIE TOMBE UNE DÉPENSE RÉGLÉE PAR LES FINANCES.
 *
 * Quand le comptable règle un ordre de dépense, la somme doit se retrouver dans un budget. Si
 * elle n'y tombe pas, elle atterrit dans « à imputer » — une liste que quelqu'un devra reprendre
 * à la main, et que personne ne reprend jamais.
 *
 * Trois chances, dans cet ordre :
 *
 *   1. la catégorie **explicitement choisie** à la validation (elle prime toujours) ;
 *   2. une catégorie déclarée POUR CE MODULE (« Regulatory », « Sponsoring »…) ;
 *   3. à défaut, la première catégorie d'une **enveloppe qui couvre ce module**.
 *
 * La troisième chance est celle qui manquait, et elle change tout à l'usage : créer une
 * enveloppe « Regulatory » et cocher le module suffit pour que les bordereaux de versement
 * payés s'y imputent — sans avoir à rouvrir chaque catégorie pour y répéter le module. C'est ce
 * qu'attend quelqu'un qui vient de créer une enveloppe et se demande pourquoi elle reste vide.
 *
 * Module PUR — testé. Les lignes candidates arrivent déjà lues.
 */

export interface EnvelopeCandidate {
  id: string;
  isActive: boolean;
  /** Modules couverts par l'enveloppe. */
  modules: string[];
  /** Module principal (déprécié, conservé pour les enveloppes anciennes). */
  module?: string | null;
  /** Ancienneté : à égalité, l'enveloppe la plus récemment ouverte gagne. */
  periodStart?: Date | string | null;
}

export interface CategoryCandidate {
  id: string;
  envelopeId: string;
  /** Module déclaré sur la catégorie elle-même — le rattachement le plus précis. */
  module?: string | null;
  parentId: string | null;
  /** Pour choisir la première catégorie d'une enveloppe de façon stable. */
  createdAt?: Date | string | null;
}

const time = (v: Date | string | null | undefined): number => {
  if (!v) return 0;
  const d = v instanceof Date ? v : new Date(v);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
};

/** L'enveloppe couvre-t-elle ce module ? (liste des modules, ou champ historique) */
export function envelopeCovers(envelope: EnvelopeCandidate, module: string): boolean {
  return envelope.modules.includes(module) || envelope.module === module;
}

/**
 * La catégorie d'atterrissage, ou `null` s'il n'y en a aucune — auquel cas la dépense reste
 * « à imputer », ce qui est dit à l'écran plutôt que rangé en silence dans une enveloppe
 * voisine.
 *
 * On ne vise que les catégories de 1er niveau : une sous-catégorie est un choix humain (« quel
 * type de bordereau ? »), pas une décision qu'un automatisme peut prendre à la place de la
 * Direction.
 */
export function pickAutoCategory(
  module: string | null | undefined,
  envelopes: readonly EnvelopeCandidate[],
  categories: readonly CategoryCandidate[],
): string | null {
  if (!module) return null;
  const active = envelopes.filter((e) => e.isActive);
  const activeIds = new Set(active.map((e) => e.id));
  const tops = categories.filter((c) => c.parentId === null && activeIds.has(c.envelopeId));

  // 1) Rattachement explicite sur la catégorie — le plus précis gagne.
  const declared = tops
    .filter((c) => c.module === module)
    .sort((a, b) => time(a.createdAt) - time(b.createdAt));
  if (declared.length > 0) return declared[0].id;

  // 2) Sinon, une enveloppe qui couvre le module : la plus récemment ouverte, car c'est
  //    l'exercice en cours qu'on alimente, pas celui d'il y a deux ans.
  const covering = active
    .filter((e) => envelopeCovers(e, module))
    .sort((a, b) => time(b.periodStart) - time(a.periodStart));
  for (const env of covering) {
    const first = tops
      .filter((c) => c.envelopeId === env.id)
      .sort((a, b) => time(a.createdAt) - time(b.createdAt))[0];
    if (first) return first.id;
  }
  return null;
}
