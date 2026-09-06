/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE RENDENT LES NŒUDS QUE LE CODE FABRIQUE LUI-MÊME.
 *
 * Un WORKER et une JONCTION ne rendent pas ce qu'un outil décide : ils rendent ce que CE code
 * écrit. Leur forme de sortie est donc une CONSTANTE de compilation, pas une devinette — et
 * c'est exactement ce qui manquait au compilateur pour refuser une référence morte avant
 * l'exécution plutôt qu'après l'accord du dirigeant.
 *
 * Ce module est PUR (aucun import) pour que le compilateur puisse le lire sans tirer le moteur,
 * Prisma et le fournisseur de modèles derrière lui. Le moteur et le worker l'importent en
 * retour : il n'existe qu'UNE définition de ces formes, et les deux côtés la partagent (§17).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LE SCHÉMA MINIMAL D'UN WORKER, quand le plan n'en fournit pas.
 *
 * `incertitudes` n'est pas décoratif : c'est le champ qui permet à la discipline épistémique
 * (§63 — TROUVÉ / DÉDUIT / CANDIDAT / INCONNU) de survivre à un worker. Sans lui, tout ce qu'un
 * modèle rend a l'air également sûr.
 *
 * `additionalProperties: false` n'est pas une précaution de style : le fournisseur applique le
 * schéma en mode strict, donc un worker sans schéma déclaré rend EXACTEMENT ces trois champs.
 * Une référence `{{ce_worker.total}}` est morte, démontrablement, à la compilation.
 */
export const SCHEMA_WORKER_MINIMAL: Record<string, unknown> = {
  type: "object",
  properties: {
    resultat: { type: "string", description: "Le résultat demandé, en français." },
    faits: {
      type: "array",
      items: { type: "string" },
      description: "Les faits sur lesquels tu t'appuies, tirés des entrées. Aucun fait inventé.",
    },
    incertitudes: {
      type: "array",
      items: { type: "string" },
      description: "Ce dont tu n'es pas sûr, ou ce qui manquait. Vide si tout était fourni.",
    },
  },
  required: ["resultat", "faits", "incertitudes"],
  additionalProperties: false,
};

/**
 * CE QUE REND UNE JONCTION — un compteur, et rien d'autre.
 *
 * Une jonction existe pour réduire le nombre d'arêtes du graphe, pas pour porter des données.
 * Le planificateur l'ignore et écrit régulièrement « 3 lectures → JONCTION → calcul », en
 * croyant que le calcul recevra les lectures. Deux corrections répondent à cela, et il en faut
 * deux : ici la forme est NOMMÉE pour que `{{jonction.lignes}}` soit refusé à la compilation ;
 * côté moteur, l'amont d'un worker TRAVERSE les jonctions pour que les données passent.
 */
export const CHAMPS_JONCTION = ["joined"] as const;

/** Le résultat d'une jonction. Une seule écriture, partagée par le moteur et le compilateur. */
export function resultatJonction(dependances: number): { joined: number } {
  return { joined: dependances };
}
