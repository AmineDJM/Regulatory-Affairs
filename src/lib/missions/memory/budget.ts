/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CONTEXTE SE COMPOSE, IL NE S'ACCUMULE PAS (§90, §96-97).
 *
 * ── LE COMPORTEMENT INTERDIT, NOMMÉMENT ──────────────────────────────────────────────────
 *
 * « La conversation grandit → on envoie tout l'historique à chaque tour. » C'est simple, ça
 * marche pendant trois jours, et ensuite chaque question coûte le prix de toutes les
 * précédentes. Au bout de deux mois, une question de six mots coûte plus cher que l'analyse
 * d'un dossier entier — pour un bénéfice nul, puisque le modèle relit trois cents fois des
 * échanges dont un seul comptait.
 *
 * ── CE QUE CE FICHIER FAIT ───────────────────────────────────────────────────────────────
 *
 * Il compose un contexte SOUS BUDGET, en respectant un ordre de priorité écrit. Ce qui ne
 * rentre pas est écarté — mais jamais n'importe quoi : certaines pièces ne peuvent PAS être
 * écartées, et le budget doit plier plutôt qu'elles.
 *
 * ── LES TROIS INDISPENSABLES (§97) ───────────────────────────────────────────────────────
 *
 *   • une approbation EN ATTENTE — l'oublier ferait redemander un accord déjà donné, ou pire,
 *     agir comme s'il l'était ;
 *   • l'identité active critique — de qui, de quel dossier parle-t-on. La perdre fait répondre
 *     sur quelqu'un d'autre, ce qui est la pire erreur possible ;
 *   • la contrainte que l'utilisateur vient d'énoncer — « pas avant vendredi », « sans Khaled ».
 *     Elle date de trente secondes et prime sur trois mois de souvenirs.
 *
 * Le reste — épisodes anciens, préférences, mémoire opérationnelle — se coupe.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES COUCHES, dans l'ordre où elles sont servies.
 *
 * L'ordre n'est pas une hiérarchie d'importance abstraite : c'est l'ordre dans lequel un être
 * humain compétent répondrait. On regarde d'abord ce qui bloque (une décision en attente), puis
 * de qui l'on parle, puis ce qu'on vient de nous dire, puis ce qu'on sait de la personne, et
 * seulement ensuite ce dont on se souvient de loin.
 */
export const COUCHES = [
  "APPROBATION_EN_ATTENTE",
  "IDENTITE_ACTIVE",
  "CONTRAINTE_COURANTE",
  "TOURS_RECENTS",
  "ETAT_MISSION",
  "ENGAGEMENTS",
  "DECISIONS",
  "PREFERENCES",
  "ENTITES",
  "EPISODES",
  "OPERATIONNEL",
] as const;
export type Couche = (typeof COUCHES)[number];

/** Ce qui ne se coupe JAMAIS, quel que soit le budget. Trois entrées, et pas une de plus. */
export const INCOMPRESSIBLES: ReadonlySet<Couche> = new Set([
  "APPROBATION_EN_ATTENTE", "IDENTITE_ACTIVE", "CONTRAINTE_COURANTE",
]);

export interface Morceau {
  couche: Couche;
  texte: string;
  /** Départage deux morceaux de la même couche. Plus haut = servi d'abord. */
  poids?: number;
}

export interface Assemblage {
  morceaux: Morceau[];
  texte: string;
  /** L'instrumentation exigée par §98 — mesurée, jamais estimée à la louche. */
  metriques: {
    contextTokens: number;
    workingMemoryTokens: number;
    retrievedMemoryTokens: number;
    episodeCount: number;
    contextBuildMs: number;
    /** Vrai quand l'assemblage a été servi tel quel depuis le cache. */
    memoryCacheHit: boolean;
    /** Ce qui a été écarté faute de place — dit, jamais tu. */
    ecartes: { couche: Couche; morceaux: number; tokens: number }[];
    /** Vrai quand les incompressibles seuls dépassaient déjà le budget. */
    budgetDepasse: boolean;
  };
}

/**
 * L'ESTIMATION DU COÛT D'UN TEXTE.
 *
 * ── POURQUOI UNE ESTIMATION, ET POURQUOI C'EST ASSUMÉ ────────────────────────────────────
 *
 * Un vrai tokenizer coûte une dépendance, du temps de calcul à chaque morceau, et une
 * dépendance au FOURNISSEUR — ce que l'architecture cherche justement à éviter. Le ratio
 * ~3,6 caractères par jeton est celui du français avec accents et ponctuation ; il surestime
 * légèrement, ce qui est le bon côté pour se tromper quand on découpe sous contrainte.
 *
 * Ce chiffre est une MESURE approchée et le rapport final doit le dire ainsi : ce ne sont pas
 * des jetons comptés par un fournisseur, ce sont des jetons estimés par une règle stable.
 */
export function estimerJetons(texte: string): number {
  if (!texte) return 0;
  return Math.ceil(texte.length / 3.6);
}

/**
 * COMPOSE LE CONTEXTE SOUS BUDGET.
 *
 * ── LE POINT LE PLUS DÉLICAT : QUE FAIRE QUAND MÊME L'INDISPENSABLE NE RENTRE PAS ───────
 *
 * On le garde quand même, et on le SIGNALE (`budgetDepasse`). Couper une approbation en attente
 * pour tenir un budget, c'est choisir la mesure contre la justesse — et le symptôme, en
 * production, sera qu'Adam redemande un accord qu'on vient de lui donner. Mieux vaut dépasser
 * et le savoir.
 */
export function composer(
  morceaux: readonly Morceau[],
  budgetJetons: number,
  opts: { depuisCache?: boolean; debutMs?: number } = {},
): Assemblage {
  const t0 = opts.debutMs ?? Date.now();
  const rang = new Map<Couche, number>(COUCHES.map((c, i) => [c, i]));

  const tries = [...morceaux].sort((a, b) => {
    const ra = rang.get(a.couche) ?? 999;
    const rb = rang.get(b.couche) ?? 999;
    if (ra !== rb) return ra - rb;
    return (b.poids ?? 0) - (a.poids ?? 0);
  });

  const gardes: Morceau[] = [];
  const ecartesPar = new Map<Couche, { morceaux: number; tokens: number }>();
  let total = 0;

  for (const m of tries) {
    const cout = estimerJetons(m.texte);
    const obligatoire = INCOMPRESSIBLES.has(m.couche);
    if (obligatoire || total + cout <= budgetJetons) {
      gardes.push(m);
      total += cout;
      continue;
    }
    const e = ecartesPar.get(m.couche) ?? { morceaux: 0, tokens: 0 };
    e.morceaux += 1;
    e.tokens += cout;
    ecartesPar.set(m.couche, e);
  }

  const memeVive = new Set<Couche>([
    "APPROBATION_EN_ATTENTE", "IDENTITE_ACTIVE", "CONTRAINTE_COURANTE", "TOURS_RECENTS", "ETAT_MISSION",
  ]);
  const jetonsDe = (pred: (c: Couche) => boolean): number =>
    gardes.filter((m) => pred(m.couche)).reduce((n, m) => n + estimerJetons(m.texte), 0);

  return {
    morceaux: gardes,
    texte: gardes.map((m) => m.texte).join("\n\n"),
    metriques: {
      contextTokens: total,
      workingMemoryTokens: jetonsDe((c) => memeVive.has(c)),
      retrievedMemoryTokens: jetonsDe((c) => !memeVive.has(c)),
      episodeCount: gardes.filter((m) => m.couche === "EPISODES").length,
      contextBuildMs: Math.max(0, Date.now() - t0),
      memoryCacheHit: opts.depuisCache ?? false,
      ecartes: [...ecartesPar.entries()].map(([couche, v]) => ({ couche, ...v })),
      budgetDepasse: total > budgetJetons,
    },
  };
}

/**
 * LE BUDGET PAR DÉFAUT, et ce qu'il signifie.
 *
 * Ce n'est PAS la fenêtre du modèle : c'est ce qu'on accepte de dépenser en SOUVENIRS avant de
 * poser la question. Le reste de la fenêtre appartient à la question, aux outils et à la
 * réponse. Un budget mémoire qui mange la fenêtre force le modèle à répondre court sur un
 * contexte long — l'exact inverse de ce qu'on cherche.
 */
export const BUDGET_MEMOIRE_DEFAUT = 6000;
