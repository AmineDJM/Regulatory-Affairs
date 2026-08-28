import { STEP_TERMINAL, StepState } from "@/lib/missions/runtime/state";
import {
  attestationEffets, preuveNegative, type ExecutionReceipt,
} from "@/lib/missions/runtime/receipt";
import { EFFECT_RANK, type Effect } from "@/lib/missions/registry/capability-meta";

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
  /**
   * LE REÇU STRUCTURÉ — la seule chose de ce dossier que le juge n'a pas à croire sur parole.
   *
   * Il porte l'effet réellement déclaré par le registre, la source interrogée, la requête
   * partie, l'horodatage et le nombre de résultats. C'est lui qui rend démontrables les deux
   * énoncés qu'un run Render a vu refuser faute de preuve : « cette recherche a rendu zéro
   * résultat » et « aucune écriture n'a eu lieu ».
   */
  recu?: ExecutionReceipt | null;
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
 * LE COMPTE RENDU LU PAR LE JUGE — des faits nommés, pas une phrase de synthèse.
 *
 * ── LE DÉFAUT QUE CETTE FONCTION FERME ───────────────────────────────────────────────────
 *
 * Le juge a pour consigne de CITER, pour chaque critère, les clés d'étapes qui le démontrent,
 * et `normaliser` ramène à NON_DÉMONTRÉ tout critère cité sans référence. Tant qu'on ne lui
 * envoyait que `qa.resume` — « 34/34 étapes effectives abouties » — aucune clé n'existait dans
 * ce qu'il lisait : soit il obéissait et ne démontrait rien, soit il inventait des clés. Les
 * deux issues sont mauvaises, et la seconde est la pire, parce qu'elle a l'air d'une réussite.
 *
 * On lui donne donc la matière : la clé, le titre, le reçu du chemin canonique et un extrait du
 * résultat de CHAQUE étape aboutie — puis, séparément, celles qui ne le sont pas.
 *
 * ── POURQUOI UNE BORNE À 120 LIGNES ──────────────────────────────────────────────────────
 *
 * Une mission de trois mille envois produirait un prompt que personne ne peut payer. Au-delà de
 * la borne, on le DIT et l'on renvoie au contrôle arithmétique, qui, lui, les a toutes comptées
 * et a déjà eu le dernier mot dans le sens négatif. Tronquer en silence laisserait croire au
 * juge qu'il a tout vu.
 */
export function compteRendu(
  steps: readonly EtapeObservee[],
  qa: RapportQA,
  limite = 120,
  /**
   * LE PLAFOND D'EFFET DE LA MISSION — une donnée du LANCEMENT, pas une déduction.
   *
   * Il vaut `ANALYZE` sous lecture seule. Le juge en a besoin pour distinguer « rien n'a été
   * écrit parce que rien n'était permis » de « rien n'a été écrit alors que tout l'était » :
   * les deux se ressemblent dans les faits et ne se valent pas dans un verdict.
   */
  plafond: Effect = "SECURITY_ADMIN",
): string {
  const abouties = steps.filter((e) => e.status === "DONE");
  const lignes = abouties.slice(0, limite).map((e) => {
    const preuve = e.receipt ? ` [reçu ${e.receipt.slice(0, 24)}]` : "";
    /**
     * LA REQUÊTE FIGURE SUR LA LIGNE, VERBATIM. Un critère du type « les recherches ont été
     * exécutées avec la chaîne exacte X » ne peut se vérifier qu'en LISANT ce qui est parti —
     * et un run réel a montré le juge refuser deux critères parce que cette information,
     * détenue par les reçus, ne lui parvenait pas pour les étapes abouties non vides.
     */
    const requete = e.recu?.query ? ` [requête « ${e.recu.query.slice(0, 120)} »]` : "";
    const extrait = e.result ? ` → ${JSON.stringify(e.result).slice(0, 180)}` : "";
    return `- ${e.key} : ${e.title}${preuve}${requete}${extrait}`;
  });

  const echecs = steps.filter((e) => e.status !== "DONE" && e.status !== "SKIPPED");

  /**
   * ── LES DEUX SECTIONS QU'UN RUN RÉEL A EXIGÉES ────────────────────────────────────────
   *
   * Render, trois scénarios, trois refus du juge — et deux d'entre eux portaient sur des
   * énoncés qu'AUCUNE prose ne peut démontrer :
   *
   *   « Aucun message n'est envoyé et aucune donnée n'est modifiée. »  → sans preuve
   *   « 0 résultat sur Zorbamyxine-K7 »                                → incitable
   *
   * Le runtime détenait les deux faits. Il ne les transmettait pas. Le juge ne pouvait donc que
   * CROIRE une phrase écrite par un modèle — et croire une phrase n'est pas juger. Les deux
   * sections ci-dessous sont produites par du code à partir des reçus, et le juge les lit comme
   * des constats.
   */
  const recus = steps.map((e) => e.recu).filter((r): r is ExecutionReceipt => !!r);
  const negatives = steps
    .map((e) => (e.recu ? preuveNegative(e.key, e.recu) : null))
    .filter((l): l is string => !!l);
  const indetermines = steps.filter((e) => e.recu?.issue === "INDETERMINE").length;

  return [
    `CONTRÔLE ARITHMÉTIQUE : ${qa.resume}`,
    `\nÉTAPES ABOUTIES (clé : titre → résultat) :\n${lignes.join("\n") || "aucune"}`,
    echecs.length > 0
      ? `\nÉTAPES NON ABOUTIES :\n${echecs.slice(0, 30).map((e) => `- ${e.key} (${e.status})`).join("\n")}`
      : "",
    negatives.length > 0
      ? `\nPREUVES NÉGATIVES — recherches RÉELLEMENT exécutées qui n'ont rien rendu.\n`
        + `Ces lignes sont des CONSTATS du code, horodatés, avec la requête effective. Un critère\n`
        + `d'absence est DÉMONTRÉ par elles ; il n'a pas à être réécrit en prose par une étape.\n`
        + `${negatives.slice(0, 40).join("\n")}`
      : "",
    // L'AVEU EST DIT, jamais tu. Une lecture dont on n'a pas su compter le résultat ne prouve
    // aucune absence — et le juge doit le savoir pour ne pas conclure à tort dans un sens
    // comme dans l'autre.
    indetermines > 0
      ? `\n(${indetermines} appel(s) ont abouti sans que le nombre de résultats soit mesurable : `
        + `ils ne démontrent NI présence NI absence.)`
      : "",
    `\n${attestationEffets(recus, (e) => EFFECT_RANK[e], plafond)}`,
    abouties.length > limite
      ? `\n(${abouties.length - limite} étape(s) abouties supplémentaires non détaillées ici ; `
        + `le contrôle arithmétique ci-dessus les a toutes comptées.)`
      : "",
  ].filter(Boolean).join("\n");
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'EMPREINTE DE CE QUE LE JUGE LIT — pour ne jamais rejuger deux fois la même chose.
 *
 * ── LE GASPILLAGE QU'ELLE FERME ──────────────────────────────────────────────────────────
 *
 * `conclure()` s'exécute chaque fois que le moteur n'a plus rien à faire. Or le moteur passe
 * par là plusieurs fois pour une seule mission : un humain relance depuis l'écran, une
 * replanification n'ajoute finalement rien, le battement repasse. À chaque passage, le juge
 * relisait un compte rendu RIGOUREUSEMENT IDENTIQUE et rendait le même verdict — pour dix à
 * soixante-dix secondes de modèle, mesurées, et un jeu de jetons payé une seconde fois.
 *
 * ── POURQUOI UNE EMPREINTE PLUTÔT QU'UN DRAPEAU « DÉJÀ JUGÉ » ────────────────────────────
 *
 * Un drapeau dirait « on a jugé cette mission », ce qui est faux dès qu'une étape bouge : le
 * verdict d'hier ne vaut plus pour l'exécution d'aujourd'hui, et le réutiliser ferait conclure
 * sur des faits périmés. L'empreinte porte EXACTEMENT les trois entrées que le juge lit —
 * l'objectif, les critères, le compte rendu — donc elle change dès que l'un des trois change,
 * et elle ne change jamais quand aucun n'a changé. C'est la seule forme sous laquelle réutiliser
 * un verdict n'est pas un raccourci mais une identité.
 *
 * ── POURQUOI UN HACHAGE ÉCRIT ICI PLUTÔT QUE `crypto` ────────────────────────────────────
 *
 * `src/lib/missions/` est une façade que des composants clients atteignent par leurs imports ;
 * `client-bundle-guard.test.ts` fait tomber la suite dès qu'un module de ce côté-là tire un
 * module de plateforme. FNV-1a tient en six lignes, n'importe rien, et l'usage n'est pas
 * cryptographique : on compare deux exécutions du même moteur, pas des signatures.
 */
export function empreinteExecution(
  objectif: string,
  criteres: readonly string[],
  resumeExecution: string,
): string {
  const source = `${objectif} ${criteres.join(" ")} ${resumeExecution}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Une seconde passe sur la longueur : deux comptes rendus de tailles différentes qui
  // entreraient en collision sur 32 bits se sépareraient ici.
  return `${h.toString(16).padStart(8, "0")}-${source.length.toString(16)}`;
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
  /**
   * L'empreinte de ce qui a été jugé. `null` quand on n'est pas allé jusqu'à juger — la mission
   * travaille encore, le contrôle arithmétique a refusé, ou il n'y a pas de critères.
   */
  empreinte?: string | null;
  /** Vrai quand le verdict vient d'un jugement ANTÉRIEUR identique : aucun modèle n'a été appelé. */
  reutilise?: boolean;
}

/** Un verdict déjà rendu, relu du journal canonique par l'appelant. */
export interface JugementAnterieur {
  empreinte: string;
  satisfait: boolean;
  raison: string;
  sansPreuve?: readonly string[];
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
 *   4. A-t-on DÉJÀ jugé exactement ce compte rendu ? Alors le verdict est connu, et le
 *      redemander coûterait un appel de modèle pour réapprendre ce qui est écrit au journal.
 *   5. Alors seulement, on demande un avis. Et en son absence, la réponse est NON.
 *
 * Le point 5 est celui qui coûte le plus cher à rater : un juge indisponible (pas de clé, panne
 * du fournisseur) ne doit JAMAIS produire un « oui » par défaut. Un moteur qui conclut parce
 * qu'il n'a pas pu vérifier est pire qu'un moteur qui ne conclut pas.
 *
 * Le point 4 ne relâche rien : l'empreinte couvre les trois entrées du juge et RIEN d'autre, si
 * bien qu'une seule étape qui bouge la fait changer. Réutiliser n'est donc pas « faire
 * confiance à hier », c'est constater qu'on reposerait mot pour mot la même question.
 */
export async function evaluerObjectif(opts: {
  objectif: string;
  criteres: readonly string[];
  steps: readonly EtapeObservee[];
  juge?: JugeObjectif;
  /** Le dernier verdict rendu sur cette mission, relu du journal. */
  anterieur?: JugementAnterieur | null;
  /**
   * LE PLAFOND D'EFFET SOUS LEQUEL LA MISSION A TOURNÉ.
   *
   * Facultatif, et son absence a une conséquence dite : sans lui, l'attestation d'effets ne
   * peut pas distinguer « rien n'a été écrit parce que rien n'était permis » de « rien n'a été
   * écrit alors que tout l'était ». On prend alors le plafond le plus large, ce qui rend
   * l'attestation plus FAIBLE — jamais plus forte qu'elle ne devrait l'être.
   */
  plafondEffet?: Effect;
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

  // LE COMPTE RENDU COMPLET, avec les CLÉS D'ÉTAPES — sans elles, le juge n'a rien à citer et
  // `normaliser` ramène chaque critère à NON_DÉMONTRÉ. Voir l'en-tête de `compteRendu`.
  const resumeExecution = compteRendu(opts.steps, qa, 120, opts.plafondEffet);
  const empreinte = empreinteExecution(opts.objectif, opts.criteres, resumeExecution);

  if (!opts.juge) {
    return {
      satisfait: false, avisModele: null, sansPreuve: [...opts.criteres], empreinte,
      raison: `Toutes les étapes ont abouti (${qa.resume}), mais aucun juge n'a vérifié les `
        + `critères d'acceptation. La mission n'est pas déclarée atteinte pour autant.`,
    };
  }

  // ── ON A DÉJÀ JUGÉ EXACTEMENT CELA ────────────────────────────────────────────────────
  //
  // Même objectif, mêmes critères, même compte rendu, au caractère près. Rappeler le juge
  // reviendrait à lui reposer la question mot pour mot pour obtenir la même réponse.
  if (opts.anterieur && opts.anterieur.empreinte === empreinte) {
    return {
      satisfait: opts.anterieur.satisfait,
      // `avisModele` reste le jugement d'un modèle : c'en est un, rendu plus tôt. Le dire `null`
      // ferait croire que personne n'a jugé, ce qui est précisément la confusion que §10 refuse.
      avisModele: opts.anterieur.satisfait,
      raison: opts.anterieur.raison,
      sansPreuve: [...(opts.anterieur.sansPreuve ?? [])],
      empreinte,
      reutilise: true,
    };
  }

  try {
    const avis = await opts.juge.juger({
      objectif: opts.objectif,
      criteres: opts.criteres,
      resumeExecution,
    });
    return {
      satisfait: avis.satisfait,
      avisModele: avis.satisfait,
      raison: avis.raison,
      sansPreuve: avis.sansPreuve ?? [],
      empreinte,
    };
  } catch (e) {
    // UN JUGE QUI TOMBE NE VAUT PAS UN OUI. C'est la ligne qui empêche une panne de fournisseur
    // de se transformer en mission déclarée réussie. On ne rend PAS d'empreinte : rien n'a été
    // jugé, et en enregistrer une ferait sauter le vrai jugement au passage suivant.
    return {
      satisfait: false, avisModele: null, sansPreuve: [...opts.criteres], empreinte: null,
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
