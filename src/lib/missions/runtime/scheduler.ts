import type { LatencyClass } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ORDONNANCEUR — ce qui fait que 2 000 opérations indépendantes ne coûtent pas 2 000 × une.
 *
 * ── CE QU'IL Y AVAIT AVANT, ET POURQUOI CE N'ÉTAIT PAS UN ORDONNANCEUR ───────────────────
 *
 *     const lot = pretes.slice(0, Math.max(1, frais.maxConcurrency));
 *
 * Une seule ligne, et trois défauts qu'elle contient tous :
 *
 *   1. `slice` prend LES PREMIÈRES DANS L'ORDRE DE LA BASE. Une étape qui débloque quarante
 *      descendants passe après une étape qui n'en débloque aucun, parce qu'elle a été créée
 *      après. Le chemin critique s'allonge d'un tour à chaque fois ;
 *   2. UN SEUL NOMBRE pour toute la mission — 2, 4, 6 ou 8 selon l'échelle. Or les contraintes
 *      réelles ne sont pas de même nature : le fournisseur de modèle, la réserve de connexions
 *      de la base et les quotas d'une API tierce se saturent séparément. Un plafond unique
 *      bride les lectures locales pour protéger le fournisseur, et inversement ;
 *   3. UN NŒUD DE CONTRÔLE CONSOMME UNE PLACE. Une jonction ne fait rien — elle constate que
 *      ses dépendances sont finies. Lui donner une des huit places, c'est retirer une place à
 *      un travail réel pour exécuter une comparaison en mémoire.
 *
 * ── CE QUE CE FICHIER DÉCIDE, ET CE QU'IL NE DÉCIDE PAS ─────────────────────────────────
 *
 * Il décide QUI PART MAINTENANT, dans quel ordre, et combien à la fois. Il ne décide pas ce
 * qu'une étape fait, ni si elle a le droit de le faire : les droits sont au catalogue et à la
 * politique, l'exécution est au moteur. Une erreur d'ordonnancement coûte du TEMPS, jamais une
 * action non autorisée — et c'est cette séparation qui permet de l'optimiser agressivement.
 *
 * ── LA CLASSE DE RESSOURCE DONNE ENFIN UN CONSOMMATEUR À `LatencyClass` ─────────────────
 *
 * `capability-meta.ts` déclare une classe de latence sur une quarantaine de capacités depuis
 * des mois, avec le commentaire « sert au pool ». Une recherche exhaustive du dépôt montre
 * qu'AUCUN code ne la lisait : il n'y avait pas de pool. C'était une donnée juste, maintenue à
 * la main, et morte — exactement ce que la doctrine §14 interdit. Elle sert ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES CLASSES DE RESSOURCE — ce qui sature, et qui ne sature pas en même temps.
 *
 * Ce ne sont pas des catégories descriptives : ce sont les FILES D'ATTENTE réelles du système.
 * Deux étapes de classes différentes ne se gênent pas ; deux étapes de même classe si.
 */
export const CLASSES_RESSOURCE = ["MODELE", "BASE", "EXTERNE", "LIBRE"] as const;
export type ClasseRessource = (typeof CLASSES_RESSOURCE)[number];

/**
 * LES DOMAINES QUI SORTENT DE LA MAISON.
 *
 * Écrit à la main parce que la frontière est irréductible : ni l'effet, ni la latence, ni le
 * nom ne disent qu'une capacité traverse le réseau vers un tiers. `mail` interroge Google,
 * `drive` peut aller chercher un fichier distant. Ce sont leurs quotas qui nous limitent, pas
 * les nôtres — et un quota tiers dépassé coûte une pénalité, pas seulement une attente.
 */
const DOMAINES_EXTERNES = new Set(["mail", "calendar", "drive"]);

export interface EtapeOrdonnancable {
  key: string;
  nodeType: string;
  capability: string | null;
  /** Les clés dont CETTE étape dépend. Le graphe inverse s'en déduit. */
  dependsOn: readonly string[];
}

/** Ce que l'ordonnanceur sait d'une capacité. Volontairement minuscule : il n'a pas à en savoir plus. */
export interface ProfilCapacite {
  domain: string;
  latency: LatencyClass;
}

/**
 * À QUELLE FILE UNE ÉTAPE APPARTIENT.
 *
 * L'ordre des tests EST la règle, et il se lit de haut en bas. Un `WORKER` reste `MODELE` même
 * si son domaine est externe : ce qui le borne, c'est le fournisseur de modèle.
 */
export function classeDe(
  step: EtapeOrdonnancable,
  profil: (id: string) => ProfilCapacite,
): ClasseRessource {
  // LES NŒUDS DE CONTRÔLE NE CONSOMMENT RIEN. Une jonction constate, une attente attend, une
  // porte d'approbation regarde une décision déjà prise. Leur donner une place la retire à un
  // travail réel — c'est le troisième défaut de l'ancienne ligne, et le plus silencieux.
  if (step.nodeType === "JOIN" || step.nodeType === "QA"
    || step.nodeType === "WAIT_EVENT" || step.nodeType === "WAIT_INPUT"
    || step.nodeType === "APPROVAL") return "LIBRE";

  // Un WORKER et un ARTIFACT appellent le fournisseur de modèle. C'est lui la contrainte.
  if (step.nodeType === "WORKER" || step.nodeType === "ARTIFACT") return "MODELE";

  if (!step.capability) return "BASE";
  const p = profil(step.capability);
  if (DOMAINES_EXTERNES.has(p.domain)) return "EXTERNE";
  return "BASE";
}

/**
 * LES PLAFONDS, ET LA RAISON DE CHACUN (§2 de la doctrine : les limites portent leur raison).
 *
 * Aucun de ces nombres n'est une limite d'ARCHITECTURE. Ce sont des limites OPÉRATIONNELLES, et
 * elles se règlent : `limitesDe` les compose à partir du plafond de la mission.
 */
export interface Limites {
  /**
   * LE FILET, PAS LA RÈGLE.
   *
   * ── UN TEST A CORRIGÉ CE CHAMP, ET LA CORRECTION EST INSTRUCTIVE ────────────────────
   *
   * La première écriture gardait ici le plafond de mission — 2, 4, 6 ou 8 selon l'échelle — et
   * l'appliquait EN PLUS des plafonds par classe. Le banc des 2 000 lectures a rendu 250 vagues
   * au lieu de 125 : le global mordait toujours le premier, et les plafonds par classe
   * n'étaient jamais atteints. Autrement dit, on venait d'écrire quatre nombres soigneusement
   * motivés dont aucun n'avait d'effet — la définition exacte d'une primitive décorative.
   *
   * Le nombre de la mission désigne donc maintenant la ressource RARE, celle du fournisseur de
   * modèle ; les autres files en dérivent. `global` reste la SOMME des files bornées : il ne
   * mord jamais avant elles, et il est là pour qu'un défaut de comptage plafonne quelque part
   * au lieu d'ouvrir mille exécutions d'un coup.
   */
  global: number;
  parClasse: Record<ClasseRessource, number>;
}

/**
 * COMPOSE LES PLAFONDS À PARTIR DE CELUI DE LA MISSION.
 *
 * `modeles` est le plafond que l'échelle a décidé, et il garde son sens d'origine : combien
 * d'appels de modèle une mission ose mener de front. Les deux autres files en dérivent, chacune
 * pour une raison qui lui est propre — et c'est ce qui les rend indépendantes.
 */
export function limitesDe(modeles: number): Limites {
  const m = Math.max(1, modeles);
  // LA BASE tient plus de requêtes que le fournisseur ne tient d'appels : une lecture locale
  // coûte des millisecondes contre des secondes. Le plafond sert à ne pas vider la réserve de
  // connexions, pas à ménager un tiers — d'où un facteur au-dessus.
  const base = Math.max(2, m * 2);
  // LES TIERS ont leurs propres quotas, et les dépasser coûte une pénalité, pas une attente.
  // On reste délibérément en dessous du plafond de modèle.
  const externe = Math.max(1, Math.ceil(m / 2));
  return {
    global: m + base + externe,
    parClasse: {
      MODELE: m,
      BASE: base,
      EXTERNE: externe,
      // Un nœud de contrôle ne consomme aucune ressource : le borner n'aurait aucun sens.
      LIBRE: Number.MAX_SAFE_INTEGER,
    },
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE POUVOIR DE DÉBLOCAGE — pourquoi l'ordre change la durée totale.
 *
 * Prenons trente étapes prêtes, dont une seule débloque les quatre cents suivantes. Si le
 * hasard de l'ordre en base la place trentième, elle part au dernier tour : les quatre cents
 * descendants attendent un tour complet pour rien. Le travail total est le même ; le CHEMIN
 * CRITIQUE, lui, a gagné un tour.
 *
 * On compte donc les descendants TRANSITIFS de chaque étape prête, et l'on sert d'abord celles
 * qui en ont le plus. C'est du §28 rendu calculable : « les petites tâches qui débloquent
 * beaucoup de downstream » ne sont pas une intention, c'est un tri.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function pouvoirsDeblocage(toutes: readonly EtapeOrdonnancable[]): Map<string, number> {
  // Le graphe DIRECT, construit depuis les arêtes inverses que porte chaque étape.
  const enfants = new Map<string, string[]>();
  for (const s of toutes) {
    for (const d of s.dependsOn) enfants.set(d, [...(enfants.get(d) ?? []), s.key]);
  }

  const memo = new Map<string, number>();
  const compter = (key: string, vus: Set<string>): number => {
    const dejaVu = memo.get(key);
    if (dejaVu !== undefined) return dejaVu;
    // LA GARDE ANTI-CYCLE. Le compilateur refuse les cycles, donc il ne devrait pas y en avoir —
    // et c'est précisément pourquoi on la met : le jour où l'un passe, l'ordonnanceur doit
    // ralentir une mission, pas boucler à l'infini dans un tri.
    if (vus.has(key)) return 0;
    vus.add(key);
    let n = 0;
    for (const e of enfants.get(key) ?? []) n += 1 + compter(e, vus);
    vus.delete(key);
    memo.set(key, n);
    return n;
  };

  const out = new Map<string, number>();
  for (const s of toutes) out.set(s.key, compter(s.key, new Set()));
  return out;
}

/** Ce qu'un tour d'ordonnancement décide, et ce qu'il en dit. */
export interface Ordonnancement<T> {
  /** Ce qui part maintenant, dans l'ordre. */
  lot: T[];
  /** Ce qui était prêt et n'a pas de place — la file d'attente réelle, mesurée. */
  differees: T[];
  /** Combien de places restaient par classe une fois le lot constitué. Sert à l'observabilité. */
  restantes: Record<ClasseRessource, number>;
  /**
   * LA CONCURRENCE VOULUE contre la CONCURRENCE OBTENUE (§4).
   *
   * `desiree` = ce que le graphe permettrait si rien ne bornait ; `effective` = ce qui part.
   * L'écart entre les deux EST la contre-pression, et le mesurer est la seule façon de savoir
   * si l'on est limité par le graphe (rien à faire) ou par les quotas (il y a à gagner).
   */
  desiree: number;
  effective: number;
}

/**
 * ORDONNANCE UN TOUR.
 *
 * PURE : ni base, ni réseau, ni horloge. C'est ce qui permet d'éprouver mille étapes en une
 * milliseconde, et c'est ce qui garantit que deux tours identiques décident identiquement.
 */
export function ordonnancer<T extends EtapeOrdonnancable>(
  pretes: readonly T[],
  toutes: readonly EtapeOrdonnancable[],
  limites: Limites,
  profil: (id: string) => ProfilCapacite,
): Ordonnancement<T> {
  const pouvoirs = pouvoirsDeblocage(toutes);
  const rang = (c: ClasseRessource): number => (c === "LIBRE" ? 0 : 1);

  const classees = pretes.map((s) => ({ s, classe: classeDe(s, profil) }));

  /**
   * L'ORDRE, EN TROIS CLÉS ET DANS CET ORDRE :
   *
   *   1. les nœuds LIBRES d'abord. Ils ne coûtent rien et débloquent souvent : les faire passer
   *      en premier fait avancer le graphe sans consommer une seule place ;
   *   2. le pouvoir de déblocage, décroissant — le cœur du §28 ;
   *   3. la clé, croissante. Un ordre TOTAL, sans quoi deux tours identiques pourraient décider
   *      différemment et un banc deviendrait instable un jour sur deux.
   */
  const ordonnees = [...classees].sort((a, b) =>
    rang(a.classe) - rang(b.classe)
    || (pouvoirs.get(b.s.key) ?? 0) - (pouvoirs.get(a.s.key) ?? 0)
    || a.s.key.localeCompare(b.s.key));

  const restantes: Record<ClasseRessource, number> = { ...limites.parClasse };
  let placesGlobales = limites.global;
  const lot: T[] = [];
  const differees: T[] = [];

  for (const { s, classe } of ordonnees) {
    // Un nœud libre ne consomme NI sa classe NI le global. C'est la traduction littérale de
    // « il ne consomme aucune ressource » — le borner reviendrait à inventer une contrainte.
    if (classe === "LIBRE") { lot.push(s); continue; }
    if (placesGlobales <= 0 || restantes[classe] <= 0) { differees.push(s); continue; }
    lot.push(s);
    restantes[classe] -= 1;
    placesGlobales -= 1;
  }

  return {
    lot,
    differees,
    restantes,
    desiree: pretes.length,
    effective: lot.length,
  };
}
