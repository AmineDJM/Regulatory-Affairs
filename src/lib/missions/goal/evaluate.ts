import { STEP_TERMINAL, StepState } from "@/lib/missions/runtime/state";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §20-22 — « TOUTES LES ÉTAPES ONT TOURNÉ » N'EST PAS « L'OBJECTIF EST ATTEINT ».
 *
 * ── LA CONFUSION QU'ON REFUSE ────────────────────────────────────────────────────────────
 *
 * Un moteur naïf conclut quand il n'a plus rien à faire. C'est une propriété du MOTEUR, pas de
 * la mission : « écris à tous les salariés » dont trente-et-un envois ont réussi et deux ont
 * échoué n'a plus rien à faire, et n'est pas accomplie pour autant. Deux personnes n'ont pas eu
 * leur message, et c'est exactement ce qu'on voulait éviter.
 *
 * ── DEUX CONTRÔLES, ET ILS SONT DIFFÉRENTS ───────────────────────────────────────────────
 *
 *   Le CONTRÔLE QUALITÉ (§22) compte : combien d'envois attendus, combien de reçus. C'est
 *   arithmétique, déterministe, et ça ne se discute pas. Un manque déclenche une réparation.
 *
 *   La SATISFACTION DE L'OBJECTIF (§20) juge : ce qui a été fait répond-il à ce qui était
 *   demandé ? C'est plus riche, et c'est là qu'un modèle peut aider — mais jamais seul, et
 *   jamais pour dire oui contre l'arithmétique.
 *
 * ── LA RÈGLE DE PRÉSÉANCE, ÉCRITE UNE FOIS ───────────────────────────────────────────────
 *
 * L'arithmétique a le dernier mot dans le sens NÉGATIF, jamais dans le sens positif. Si le
 * contrôle qualité trouve un manque, aucun avis de modèle ne peut conclure. Si le contrôle est
 * satisfait, il ne conclut pas pour autant : reste à vérifier que l'objectif est atteint.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface EtapeObservee {
  key: string;
  title: string;
  status: StepState;
  nodeType: string;
  /** Le reçu du chemin canonique. Sa présence est ce qui PROUVE l'effet, pas le statut. */
  receipt: string | null;
  attempt: number;
  maxAttempts: number;
  /** Pour un éventail : { expanded, done, failed } quand il a été résolu. */
  result: unknown;
}

export interface RapportQA {
  ok: boolean;
  attendus: number;
  faits: number;
  manquants: { key: string; title: string; pourquoi: string }[];
  /** Ce qu'on n'a pas pu vérifier — dit, jamais compté comme réussi. */
  nonVerifiables: string[];
  resume: string;
}

const nombre = (v: unknown, champ: string): number | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const x = (v as Record<string, unknown>)[champ];
  return typeof x === "number" ? x : null;
};

/**
 * LE CONTRÔLE QUALITÉ — de l'arithmétique, pas un avis.
 *
 * ── CE QU'ON COMPTE, ET POURQUOI CE CHOIX ────────────────────────────────────────────────
 *
 * On compte les ÉTAPES EFFECTIVES : celles qui produisent un effet dans le monde. Les nœuds de
 * contrôle — jonctions, portes, attentes — ne comptent pas : leur réussite ne prouve rien sur
 * l'objectif, et les inclure gonflerait le score sans rien garantir.
 *
 * Un éventail compte pour ses ITÉRATIONS, pas pour un. C'est le point : trente-trois envois
 * dont deux échouent doivent donner 31/33, jamais 0/1 ni 1/1.
 */
export function controlerQualite(steps: readonly EtapeObservee[]): RapportQA {
  const CONTROLE = new Set(["JOIN", "APPROVAL", "QA", "WAIT_EVENT", "WAIT_INPUT"]);
  const effectives = steps.filter((s) => !CONTROLE.has(s.nodeType));

  // Les filles d'un éventail sont déjà dans la liste ; leur MODÈLE ne doit donc pas être compté
  // une seconde fois, sans quoi une mission de 33 envois en compterait 34.
  const clesFilles = new Set(effectives.filter((s) => s.key.includes("#")).map((s) => s.key));
  const modeles = new Set(
    [...clesFilles].map((k) => k.slice(0, k.indexOf("#"))),
  );

  let attendus = 0;
  let faits = 0;
  const manquants: RapportQA["manquants"] = [];
  const nonVerifiables: string[] = [];

  for (const s of effectives) {
    if (modeles.has(s.key)) {
      // Le modèle d'un éventail DÉJÀ déployé : ses filles portent le compte. On vérifie
      // seulement qu'il n'a pas menti sur le nombre.
      const annonces = nombre(s.result, "expanded");
      const reelles = effectives.filter((f) => f.key.startsWith(`${s.key}#`)).length;
      if (annonces !== null && annonces !== reelles) {
        nonVerifiables.push(
          `« ${s.title} » annonce ${annonces} itérations mais ${reelles} existent en base.`);
      }
      continue;
    }

    attendus += 1;
    if (s.status === "DONE") {
      faits += 1;
      continue;
    }
    if (s.status === "SKIPPED") {
      // Une étape sautée n'est ni un succès ni un manque : elle est retirée du dénominateur.
      // La compter en manque punirait une décision légitime ; en succès, elle mentirait.
      attendus -= 1;
      continue;
    }
    manquants.push({
      key: s.key,
      title: s.title,
      pourquoi: s.status === "FAILED"
        ? (s.attempt >= s.maxAttempts ? "en échec, toutes les tentatives épuisées" : "en échec, réparable")
        : `pas terminée (${s.status})`,
    });
  }

  const ok = manquants.length === 0 && nonVerifiables.length === 0 && attendus > 0;
  return {
    ok,
    attendus,
    faits,
    manquants,
    nonVerifiables,
    resume: attendus === 0
      ? "Aucune étape effective : il n'y a rien à contrôler."
      : `${faits}/${attendus} étapes effectives abouties.`
        + (manquants.length > 0 ? ` ${manquants.length} manquante(s).` : "")
        + (nonVerifiables.length > 0 ? ` ${nonVerifiables.length} incohérence(s) de comptage.` : ""),
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA SATISFACTION DE L'OBJECTIF.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface VerdictObjectif {
  satisfait: boolean;
  /** `null` quand personne n'a encore jugé — ce qui n'est PAS « non ». */
  avisModele: boolean | null;
  raison: string;
  /** Les critères d'acceptation qui n'ont pas de preuve. */
  sansPreuve: string[];
}

/**
 * L'AVIS D'UN JUGE — un port, pour que le code décide QUAND on l'appelle, et pas lui.
 *
 * Le juge reçoit l'objectif, les critères et ce qui a été fait. Il rend un verdict et une
 * phrase. Il ne rend PAS d'action : juger et agir sont deux choses, et les mélanger donnerait à
 * un modèle le pouvoir de se déclarer satisfait puis de conclure.
 */
export interface JugeObjectif {
  juger(input: {
    objectif: string;
    criteres: readonly string[];
    resumeExecution: string;
  }): Promise<{ satisfait: boolean; raison: string; sansPreuve?: string[] }>;
}

/**
 * L'OBJECTIF EST-IL ATTEINT ?
 *
 * ── L'ORDRE DES CONTRÔLES EST LA GARANTIE ────────────────────────────────────────────────
 *
 *   1. Tout est-il terminé ? Sinon, la question ne se pose pas encore.
 *   2. Le contrôle qualité passe-t-il ? Sinon, c'est NON — et aucun avis ne le renverse.
 *   3. Y a-t-il des critères d'acceptation ? Sans critères, on ne peut PAS conclure « oui » :
 *      on rendrait un satisfecit sans avoir rien vérifié.
 *   4. Alors seulement, on demande un avis. Et en son absence, la réponse est NON.
 *
 * Le point 4 est celui qui coûte le plus cher à rater : un juge indisponible (pas de clé, panne
 * du fournisseur) ne doit JAMAIS produire un « oui » par défaut. Un moteur qui conclut parce
 * qu'il n'a pas pu vérifier est pire qu'un moteur qui ne conclut pas.
 */
export async function evaluerObjectif(opts: {
  objectif: string;
  criteres: readonly string[];
  steps: readonly EtapeObservee[];
  juge?: JugeObjectif;
}): Promise<VerdictObjectif> {
  const tousFinis = opts.steps.length > 0
    && opts.steps.every((s) => STEP_TERMINAL.has(s.status)
      || (s.status === "FAILED" && s.attempt >= s.maxAttempts));
  if (!tousFinis) {
    return {
      satisfait: false, avisModele: null, sansPreuve: [...opts.criteres],
      raison: "La mission n'a pas fini de travailler : la question de l'objectif ne se pose pas encore.",
    };
  }

  const qa = controlerQualite(opts.steps);
  if (!qa.ok) {
    return {
      satisfait: false, avisModele: null, sansPreuve: [...opts.criteres],
      raison: `Le contrôle ne passe pas : ${qa.resume}`,
    };
  }

  if (opts.criteres.length === 0) {
    return {
      satisfait: false, avisModele: null, sansPreuve: [],
      raison: "Aucun critère d'acceptation : rien ne permet d'affirmer que l'objectif est atteint.",
    };
  }

  if (!opts.juge) {
    return {
      satisfait: false, avisModele: null, sansPreuve: [...opts.criteres],
      raison: `Toutes les étapes ont abouti (${qa.resume}), mais aucun juge n'a vérifié les `
        + `critères d'acceptation. La mission n'est pas déclarée atteinte pour autant.`,
    };
  }

  try {
    const avis = await opts.juge.juger({
      objectif: opts.objectif,
      criteres: opts.criteres,
      resumeExecution: qa.resume,
    });
    return {
      satisfait: avis.satisfait,
      avisModele: avis.satisfait,
      raison: avis.raison,
      sansPreuve: avis.sansPreuve ?? [],
    };
  } catch (e) {
    // UN JUGE QUI TOMBE NE VAUT PAS UN OUI. C'est la ligne qui empêche une panne de fournisseur
    // de se transformer en mission déclarée réussie.
    return {
      satisfait: false, avisModele: null, sansPreuve: [...opts.criteres],
      raison: `L'évaluation de l'objectif n'a pas pu être faite (${e instanceof Error ? e.message : "erreur"}). `
        + `Le travail est terminé, mais rien ne confirme qu'il répond à la demande.`,
    };
  }
}

/**
 * LES ÉTAPES À RÉPARER (§22).
 *
 * On ne replanifie pas la mission entière quand deux envois sur trente-trois ont échoué : on
 * rejoue les deux. Rejouer tout renverrait trente-et-un messages déjà partis — ce que
 * l'idempotence rattraperait, certes, mais au prix d'un travail inutile et d'un journal
 * illisible.
 */
export function aReparer(qa: RapportQA): string[] {
  return qa.manquants.map((m) => m.key);
}
