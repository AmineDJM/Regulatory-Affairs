/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DIAGNOSTIC FOURNISSEUR ET MISSION — deux questions, deux verdicts.
 *
 * ── CE QUE LE PREMIER RUN RÉEL A APPRIS ──────────────────────────────────────────────────
 *
 * Sur Render, la chaîne a répondu : fournisseur appelé, plan conforme, compilateur satisfait,
 * mission écrite, six étapes exécutées, contrôle qualité passé — et le juge d'objectif a REFUSÉ
 * de conclure, parce que la demande exigeait « les trois plus urgents » et que les données ne
 * permettaient pas d'en établir trois de façon probante.
 *
 * Ce refus est CORRECT. C'est §10 de la doctrine appliquée à la lettre : un moteur qui conclut
 * parce qu'il n'a pas pu vérifier est pire qu'un moteur qui ne conclut pas. On ne touche donc
 * pas au juge. Trois défauts, en revanche, appartenaient bien au diagnostic :
 *
 *   1. IL CONFONDAIT DEUX QUESTIONS. « Un vrai fournisseur est-il appelé ? » et « ce scénario
 *      métier a-t-il atteint son objectif ? » n'ont aucune raison de partager un verdict. Le
 *      premier était prouvé ; le second a été annoncé en échec, et le rapport global a viré au
 *      rouge pour une raison qui ne concernait pas le fournisseur. D'où DEUX verdicts.
 *   2. IL S'ARRÊTAIT SUR UN ÉTAT INTERMÉDIAIRE. La mission restait `RUNNING` — ce qui, dans ce
 *      runtime, signifie « plus aucune étape à faire, et l'objectif n'a pas été jugé atteint ».
 *      Ni terminal, ni jugé. Le diagnostic doit POURSUIVRE le vrai moteur jusqu'à un état
 *      réellement stable, en passant par le recours et la replanification canoniques.
 *   3. SA DEMANDE N'ÉTAIT PAS SATISFIABLE. « Les trois plus urgents » présuppose qu'il y en ait
 *      trois. Un banc dont l'énoncé exige ce que la base ne contient pas ne mesure pas le
 *      produit : il mesure son propre présupposé.
 *
 * ── LES TROIS SCÉNARIOS, ET POURQUOI CEUX-LÀ ─────────────────────────────────────────────
 *
 *   A — SATISFIABLE          la vérité terrain garantit qu'une réponse complète EXISTE.
 *   B — PREUVE D'ABSENCE     l'information n'existe pas, et le LIVRABLE est de le démontrer.
 *   C — RECOURS              une première piste insuffisante, une seconde correcte.
 *
 * B mérite un mot. Demander une chose absente et attendre un échec serait un piège ; ici le
 * critère de succès EST la démonstration d'absence. C'est la seule façon de mesurer la
 * discipline épistémique sans la punir : un Adam qui prouve qu'il n'y a rien a fait son travail.
 *
 * ── CE QUI RESTE NON FALSIFIABLE ─────────────────────────────────────────────────────────
 *
 * Aucun plan n'est injecté : le planner reçoit une demande en français, toujours. Le raisonneur
 * n'est pas remplacé — il est DÉCORÉ par `RaisonneurInstrumente`, qui délègue tout et se
 * contente de chronométrer. Et `PROVIDER_CALL` ne passe au vert que sur la FACTURE : des jetons
 * comptés et un nom de modèle rendus par l'API. Un substitut rend `null`.
 *
 * ── LA SÛRETÉ ────────────────────────────────────────────────────────────────────────────
 *
 * `lectureSeule` plafonne le catalogue à `ANALYZE` : les capacités qui écrivent, communiquent,
 * engagent ou détruisent sont ABSENTES de la liste que le compilateur consulte — pas découragées
 * par une consigne qu'un document lu en route pourrait contredire. Le plafond est re-vérifié sur
 * les étapes réellement écrites, et un dépassement ARRÊTE le diagnostic.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { EFFECT_RANK, capabilityMeta, type Effect } from "@/lib/missions/registry/capability-meta";
import { RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { acteurDe, catalogueDe } from "@/platform/in-process/missions/catalog";
import { raisonneur } from "@/platform/in-process/missions/reasoner";
import { avancerMission, lancerMission, replanifierMission } from "@/platform/in-process/missions/runtime";
import { RaisonneurInstrumente, cascade, rendreCascade, type Cascade } from "@/platform/in-process/missions/provider-waterfall";

/** Le plafond d'effet. Au-delà, la mission n'est PAS exécutée. */
export const PLAFOND: Effect = "ANALYZE";

/** Les maillons de la chaîne FOURNISSEUR — ceux qui prouvent qu'un vrai modèle a travaillé. */
export const MAILLONS_FOURNISSEUR = [
  "PROVIDER_CALL", "PLANNER_REAL_MODEL", "MISSION_PLAN_SCHEMA", "COMPILER", "MISSION_PERSISTED",
] as const;

/** Les maillons de la chaîne MISSION — ceux qui prouvent qu'elle va au bout et conclut. */
export const MAILLONS_MISSION = [
  "READ_ONLY_EXECUTION", "TERMINAL_STATE", "QA_GOAL_SATISFACTION",
] as const;

export const MAILLONS = [...MAILLONS_FOURNISSEUR, ...MAILLONS_MISSION] as const;
export type Maillon = (typeof MAILLONS)[number];
export type Etat = "PASS" | "FAIL";
export type Chaine = Record<Maillon, Etat>;

/**
 * LES ÉTATS OÙ L'ON S'ARRÊTE LÉGITIMEMENT.
 *
 * `COMPLETED` conclut. Les attentes attendent quelque chose que le diagnostic ne fournira pas —
 * un accord humain, un événement — et insister ne changerait rien. `CANCELLED` est une décision.
 * Tout le reste laisse une porte : on la pousse.
 */
const ETATS_STABLES = new Set(["COMPLETED", "CANCELLED", "AWAITING_APPROVAL", "WAITING_INPUT", "WAITING_EVENT"]);
/** Les états d'où le mécanisme canonique de replanification a un sens. */
const ETATS_REPLANIFIABLES = new Set(["FAILED", "BLOCKED", "PARTIAL"]);

export type Genre = "SATISFIABLE" | "PREUVE_ABSENCE" | "RECOURS";

export interface Scenario {
  genre: Genre;
  /** La demande, en français, telle qu'une personne l'écrirait. Jamais un plan. */
  demande: string;
  /** Ce que la base garantit AVANT d'interroger le modèle — la vérité terrain. */
  verite: string;
  titre: string;
}

export interface ResultatMission {
  genre: Genre;
  demande: string;
  verite: string;
  missionId: string | null;
  /** L'état où la mission s'est immobilisée, et POURQUOI on s'est arrêté là. */
  statutFinal: string | null;
  stable: boolean;
  motifArret: string;
  toursMoteur: number;
  replanifications: number;
  versionPlan: number | null;
  recoursObserves: number;
  etapesCompilees: number | null;
  etapesTerminees: number;
  etapesEnEchec: number;
  effetMaxObserve: Effect | null;
  capacitesHorsPlafond: string[];
  qaPassed: boolean | null;
  goalSatisfied: boolean | null;
  goalVerdict: string | null;
  cascade: Cascade | null;
}

export interface ResultatSmoke {
  horodatage: string;
  chaine: Chaine;
  /** Le fournisseur est-il réellement à l'œuvre ? Question 1, indépendante. */
  providerProven: boolean;
  /** Une mission atteint-elle un état terminal avec un jugement cohérent ? Question 2. */
  missionE2eProven: boolean;
  premierEchecFournisseur: Maillon | null;
  premierEchecMission: Maillon | null;
  raison: string | null;
  cleDisponible: boolean;
  modele: string | null;
  /**
   * LES JETONS DE TOUS LES APPELS DU DIAGNOSTIC — pas seulement ceux des trois planifications
   * initiales, comme c'était le cas jusqu'à un run qui a montré l'écart : 11 521 annoncés en
   * entrée pour 52 463 facturés.
   */
  jetonsEntree: number;
  jetonsSortie: number;
  /** `null` quand aucun appel n'a distingué la réflexion — jamais zéro, qui serait une affirmation. */
  jetonsReflexion: number | null;
  /** Combien d'appels de modèle le diagnostic entier a émis, toutes familles confondues. */
  appelsModele: number;
  capacitesOuvertes: number | null;
  scenarios: ResultatMission[];
  latenceTotaleMs: number;
}

/**
 * CONSTRUIT LES TROIS DEMANDES À PARTIR DE CE QUI EXISTE (§ « satisfiable sans mensonge »).
 *
 * Aucune n'est écrite en dur. La vérité terrain est établie D'ABORD ; l'énoncé s'y adapte. Un
 * énoncé qui exigerait trois éléments là où il n'y en a qu'un mesurerait son propre présupposé.
 */
export async function scenarios(): Promise<Scenario[]> {
  const out: Scenario[] = [];

  // ── A — SATISFIABLE ────────────────────────────────────────────────────────────────────
  //
  // On compte d'abord. La demande porte ensuite sur CE nombre : « les N dossiers en cours »
  // est vrai quel que soit N, y compris zéro — et à zéro le scénario devient B, honnêtement.
  const enCours = await prisma.regulatoryDossier.count({
    where: { status: { notIn: ["ARCHIVED", "ERROR"] } },
  }).catch(() => 0);
  const taches = await prisma.task.count({
    where: { status: { in: ["TODO", "IN_PROGRESS"] } },
  }).catch(() => 0);

  if (enCours > 0) {
    out.push({
      genre: "SATISFIABLE",
      titre: `Dossiers réglementaires en cours (${enCours} en base)`,
      verite: `RegulatoryDossier WHERE status NOT IN (ARCHIVED,CANCELLED) = ${enCours}`,
      demande:
        "Fais le point sur les dossiers réglementaires en cours : liste-les avec leur statut, "
        + "et dis-moi lequel demande le plus d'attention et pourquoi. "
        + "Si une information manque pour trancher, dis-le explicitement. "
        + "Ne contacte personne et ne modifie rien.",
    });
  } else if (taches > 0) {
    out.push({
      genre: "SATISFIABLE",
      titre: `Tâches ouvertes (${taches} en base)`,
      verite: `Task WHERE status IN (TODO,IN_PROGRESS) = ${taches}`,
      demande:
        "Fais le point sur les tâches ouvertes : liste-les avec leur échéance, et dis-moi "
        + "laquelle demande le plus d'attention et pourquoi. Ne contacte personne et ne modifie rien.",
    });
  }

  // ── B — PREUVE D'ABSENCE ───────────────────────────────────────────────────────────────
  //
  // Le LIVRABLE est la démonstration d'absence, et l'énoncé le dit. Sans cela, le juge aurait
  // raison de refuser : on lui aurait demandé de conclure sur une chose introuvable.
  out.push({
    genre: "PREUVE_ABSENCE",
    titre: "Une molécule qui n'existe pas — prouver l'absence",
    verite: "RegulatoryProduct WHERE dci ~ 'Zorbamyxine' = 0 (vérifié avant l'appel)",
    demande:
      "Vérifie si nous avons quoi que ce soit sur la molécule « Zorbamyxine-K7 » : produit, "
      + "dossier réglementaire, marché, document. L'objectif de cette mission est de TRANCHER "
      + "la question : soit tu trouves des éléments et tu les présentes, soit tu établis, "
      + "sources consultées à l'appui, qu'il n'existe rien à ce sujet — cette conclusion négative "
      + "documentée EST le résultat attendu et suffit à considérer la mission accomplie. "
      + "Ne contacte personne et ne modifie rien.",
  });

  // ── C — RECOURS ────────────────────────────────────────────────────────────────────────
  //
  // La demande vise délibérément une information dont la source la plus évidente est la moins
  // fournie. On ne SCRIPTE pas le recours — on crée les conditions et l'on regarde le journal
  // pour savoir s'il a réellement eu lieu. S'il n'a pas lieu, le rapport le dit.
  out.push({
    genre: "RECOURS",
    titre: "Une première piste insuffisante, une seconde à trouver",
    verite: "aucune vérité imposée — on observe si le moteur change de source (MissionEvent STEP_RECOVERY)",
    demande:
      "Retrouve le document contractuel le plus récent qui engage l'entreprise. Commence par le "
      + "Drive ; si tu n'y trouves pas de quoi conclure, va chercher dans les autres sources "
      + "disponibles avant de répondre. Dis-moi d'où vient l'information. "
      + "Ne contacte personne et ne modifie rien.",
  });

  return out;
}

const estEcriture = (n: string): boolean => RESOLVER_WRITE_NAMES.has(n);

/**
 * L'EFFET D'UN NŒUD SANS CAPACITÉ — la même table que le compilateur, et c'est voulu.
 *
 * Un ARTIFACT produit un fichier : c'est `PREPARE`, au-dessus du plafond de lecture. Tout le
 * reste — attente, jonction, contrôle, approbation — ne fait que constater, donc `READ`. Un
 * WORKER appelle un modèle et n'écrit rien dans l'ERP : `ANALYZE`.
 */
function effetDuNoeud(nodeType: string): Effect {
  if (nodeType === "ARTIFACT") return "PREPARE";
  if (nodeType === "WORKER") return "ANALYZE";
  return "READ";
}

/**
 * MÈNE LA MISSION À UN ÉTAT RÉELLEMENT STABLE, avec le mécanisme canonique et lui seul.
 *
 * ── CE QUE CETTE FONCTION NE FAIT PAS ────────────────────────────────────────────────────
 *
 * Elle ne réimplémente rien. Elle appelle `avancerMission` — qui est `avancer()` assemblé — et
 * `replanifierMission`, les deux points d'entrée que l'écran et l'ordonnanceur utilisent. Elle
 * n'écrit aucune étape, ne force aucun statut, ne juge aucun objectif.
 *
 * ── LE POINT FIXE, ET POURQUOI IL FALLAIT LE NOMMER ──────────────────────────────────────
 *
 * `RUNNING` avec toutes les étapes terminées est un état particulier de ce runtime : il signifie
 * « plus rien à exécuter, et l'objectif n'a pas été jugé atteint ». `avancer()` n'y changera
 * rien, et `replanifierMission` le refuse — RUNNING n'est pas dans ses états replanifiables.
 * C'est donc un POINT FIXE : ni terminal, ni réparable par les voies existantes.
 *
 * On le détecte en comparant la signature de la mission d'un tour à l'autre. Le diagnostic
 * s'arrête alors et le NOMME, au lieu de tourner en rond ou de conclure à sa place. C'est un
 * constat sur le runtime, pas une correction déguisée.
 */
async function menerAEtatStable(
  user: CurrentUser,
  missionId: string,
  instrument: RaisonneurInstrumente,
  toursMax: number,
): Promise<{ statut: string | null; stable: boolean; motif: string; tours: number; replans: number; version: number | null }> {
  let tours = 0;
  let replans = 0;
  let signaturePrecedente = "";

  for (let i = 0; i < toursMax; i++) {
    await avancerMission(user, missionId, { lectureSeule: true, reasoner: instrument, maxTours: 6 }).catch(() => null);
    tours += 1;

    const m = await prisma.mission.findUnique({
      where: { id: missionId },
      select: { status: true, planVersion: true },
    });
    if (!m) return { statut: null, stable: false, motif: "mission disparue en cours de route", tours, replans, version: null };

    const etapes = await prisma.missionStep.groupBy({
      by: ["status"], where: { missionId }, _count: { _all: true },
    }).catch(() => []);
    const signature = `${m.status}|${m.planVersion}|${etapes.map((e) => `${e.status}:${e._count._all}`).sort().join(",")}`;

    if (ETATS_STABLES.has(m.status)) {
      return { statut: m.status, stable: true, motif: `état stable atteint : ${m.status}`, tours, replans, version: m.planVersion };
    }

    if (ETATS_REPLANIFIABLES.has(m.status)) {
      // LE MÉCANISME CANONIQUE. Il porte lui-même son plafond (`PLANS_MAX`) et sa règle de
      // réouverture d'accord ; on ne le double pas.
      const r = await replanifierMission(user, missionId, { lectureSeule: true, reasoner: instrument }).catch(() => null);
      if (r?.replanifie) { replans += 1; signaturePrecedente = ""; continue; }
      return {
        statut: m.status, stable: true,
        motif: `${m.status} — replanification refusée : ${r?.raison ?? "indisponible"}`,
        tours, replans, version: m.planVersion,
      };
    }

    if (signature === signaturePrecedente) {
      return {
        statut: m.status, stable: false,
        motif: `POINT FIXE : la mission s'immobilise en ${m.status} — plus aucune étape à exécuter, `
          + `objectif non jugé atteint, et ${m.status} n'ouvre ni recours ni replanification`,
        tours, replans, version: m.planVersion,
      };
    }
    signaturePrecedente = signature;
  }

  const fin = await prisma.mission.findUnique({ where: { id: missionId }, select: { status: true, planVersion: true } });
  return {
    statut: fin?.status ?? null, stable: false,
    motif: `budget de tours épuisé (${toursMax}) sans état stable`,
    tours, replans, version: fin?.planVersion ?? null,
  };
}

/** Joue un scénario de bout en bout et rend TOUT ce qui a été mesuré. */
async function jouer(
  user: CurrentUser,
  sc: Scenario,
  instrument: RaisonneurInstrumente,
  t0: number,
): Promise<{ r: ResultatMission; chaine: Partial<Chaine>; metriques: { modele: string | null; entree: number; sortie: number; ouvertes: number | null } }> {
  const r: ResultatMission = {
    genre: sc.genre, demande: sc.demande, verite: sc.verite,
    missionId: null, statutFinal: null, stable: false, motifArret: "non lancé",
    toursMoteur: 0, replanifications: 0, versionPlan: null, recoursObserves: 0,
    etapesCompilees: null, etapesTerminees: 0, etapesEnEchec: 0,
    effetMaxObserve: null, capacitesHorsPlafond: [],
    qaPassed: null, goalSatisfied: null, goalVerdict: null, cascade: null,
  };
  const chaine: Partial<Chaine> = {};
  const metriques = { modele: null as string | null, entree: 0, sortie: 0, ouvertes: null as number | null };

  // LA TRANCHE DU SCÉNARIO. Sans elle, la cascade du premier affichait les appels des trois.
  instrument.ouvrir(sc.genre);
  const debutScenario = Date.now();

  const lancement = await lancerMission(user, sc.demande, {
    lectureSeule: true, demarrer: false, reasoner: instrument,
    titre: `Diagnostic — ${sc.titre}`,
  }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e), metriques: undefined }));

  const m = lancement.metriques;
  if (m) {
    metriques.ouvertes = m.capacitesAutorisees;
    if (m.usage) {
      metriques.modele = m.usage.model;
      metriques.entree += m.usage.inputTokens;
      metriques.sortie += m.usage.outputTokens;
      if (m.usage.inputTokens > 0 || m.usage.outputTokens > 0) chaine.PROVIDER_CALL = "PASS";
    }
  }

  if (!lancement.ok) {
    const err = lancement.error ?? "";
    if (chaine.PROVIDER_CALL === "PASS" && !/n'a rien rendu|aucun fournisseur/i.test(err)) {
      chaine.PLANNER_REAL_MODEL = "PASS";
      if (!/non conforme au schéma/i.test(err)) chaine.MISSION_PLAN_SCHEMA = "PASS";
    }
    r.motifArret = err.slice(0, 300) || "lancement refusé";
    return { r, chaine, metriques };
  }

  chaine.PLANNER_REAL_MODEL = "PASS";
  chaine.MISSION_PLAN_SCHEMA = "PASS";
  chaine.COMPILER = "PASS";
  r.missionId = lancement.missionId;
  r.etapesCompilees = lancement.etapes;

  const etapes = await prisma.missionStep.findMany({
    where: { missionId: r.missionId }, select: { capability: true, nodeType: true },
  });
  if (etapes.length > 0) chaine.MISSION_PERSISTED = "PASS";

  // ── LE PLAFOND, VÉRIFIÉ SUR CE QUI EST ÉCRIT ───────────────────────────────────────────
  const plafond = EFFECT_RANK[PLAFOND];
  let max: Effect = "READ";
  /**
   * ── LE FAUX VERT QUE CE BLOC CORRIGE ───────────────────────────────────────────────────
   *
   * `if (!e.capability) continue;` sautait TOUTES les étapes sans capacité. Or un nœud ARTIFACT
   * n'en porte pas — et il fabrique un fichier. Résultat, sur un run réel : le rapport affichait
   * `READ_ONLY_EXECUTION PASS` pendant que deux missions écrivaient de vrais XLSX dans le Drive
   * de production, retrouvés ensuite par le run SUIVANT, qui en concluait que la molécule
   * « inexistante » existait. Un banc qui ne voit pas l'effet qu'il prétend interdire ne mesure
   * pas une garantie : il en fabrique l'apparence (§78).
   *
   * L'effet est donc relevé pour CHAQUE étape, capacité ou non — un ARTIFACT vaut `PREPARE`,
   * exactement comme le compilateur le calcule.
   */
  for (const e of etapes) {
    const eff = e.capability
      ? capabilityMeta(e.capability, estEcriture).effect
      : effetDuNoeud(e.nodeType);
    if (EFFECT_RANK[eff] > EFFECT_RANK[max]) max = eff;
    if (EFFECT_RANK[eff] > plafond) {
      r.capacitesHorsPlafond.push(`${e.capability ?? e.nodeType} (${eff})`);
    }
  }
  r.effetMaxObserve = etapes.length > 0 ? max : null;
  if (r.capacitesHorsPlafond.length > 0) {
    r.motifArret = `défaut de garde : ${r.capacitesHorsPlafond.join(", ")} dépasse ${PLAFOND} — exécution refusée`;
    return { r, chaine, metriques };
  }

  // ── L'EXÉCUTION, MENÉE JUSQU'À UN ÉTAT STABLE ──────────────────────────────────────────
  const fin = await menerAEtatStable(user, r.missionId, instrument, 8);
  r.statutFinal = fin.statut;
  r.stable = fin.stable;
  r.motifArret = fin.motif;
  r.toursMoteur = fin.tours;
  r.replanifications = fin.replans;
  r.versionPlan = fin.version;

  const parStatut = await prisma.missionStep.groupBy({
    by: ["status"], where: { missionId: r.missionId }, _count: { _all: true },
  }).catch(() => []);
  const compte = (s: string) => parStatut.find((x) => x.status === s)?._count._all ?? 0;
  r.etapesTerminees = compte("DONE");
  r.etapesEnEchec = compte("FAILED");
  if (parStatut.some((x) => x.status !== "PENDING" && x.status !== "READY")) chaine.READ_ONLY_EXECUTION = "PASS";
  if (fin.stable) chaine.TERMINAL_STATE = "PASS";

  // ── LE RECOURS, LU DANS LE JOURNAL — jamais supposé ────────────────────────────────────
  r.recoursObserves = await prisma.missionEvent.count({
    where: { missionId: r.missionId, kind: "STEP_RECOVERY" },
  }).catch(() => 0);

  const etat = await prisma.mission.findUnique({
    where: { id: r.missionId },
    select: { qaPassed: true, goalSatisfied: true, goalVerdict: true },
  });
  r.qaPassed = etat?.qaPassed ?? null;
  r.goalSatisfied = etat?.goalSatisfied ?? null;
  r.goalVerdict = etat?.goalVerdict ?? null;
  if (etat?.qaPassed === true && etat?.goalSatisfied === true) chaine.QA_GOAL_SATISFACTION = "PASS";

  const catalogue = catalogueDe(user, { effetMax: PLAFOND });
  const utilisees = new Set(etapes.map((e) => e.capability).filter(Boolean) as string[]).size;
  // LA DURÉE EST CELLE DE CE SCÉNARIO, pas le temps écoulé depuis le début du diagnostic :
  // le troisième affichait 232 s alors qu'il n'en avait consommé que 35.
  r.cascade = await cascade(r.missionId, instrument, sc.genre, debutScenario, Date.now() - debutScenario, {
    ouvertes: catalogue.taille,
    montreesAuPlanner: m?.plannerCapabilitiesExposed ?? null,
    // CE QUI A ÉTÉ ENVOYÉ, pas ce qui aurait pu l'être. On mesurait ici le catalogue OUVERT :
    // 9 095 caractères affichés sur les trois scénarios, y compris celui qui n'en montrait que
    // quinze — l'instrument masquait exactement ce qu'il devait mesurer.
    resumeChars: m?.plannerCatalogueChars ?? null,
    utilisees,
    exposeesInutiles: m?.plannerCapabilitiesExposed != null ? Math.max(0, m.plannerCapabilitiesExposed - utilisees) : null,
  });

  return { r, chaine, metriques };
}

export async function smokeFournisseur(user: CurrentUser): Promise<ResultatSmoke> {
  const t0 = Date.now();
  const chaine: Chaine = {
    PROVIDER_CALL: "FAIL", PLANNER_REAL_MODEL: "FAIL", MISSION_PLAN_SCHEMA: "FAIL",
    COMPILER: "FAIL", MISSION_PERSISTED: "FAIL",
    READ_ONLY_EXECUTION: "FAIL", TERMINAL_STATE: "FAIL", QA_GOAL_SATISFACTION: "FAIL",
  };
  const out: ResultatSmoke = {
    horodatage: new Date().toISOString(), chaine,
    providerProven: false, missionE2eProven: false,
    premierEchecFournisseur: null, premierEchecMission: null, raison: null,
    cleDisponible: Boolean((process.env.OPENAI_API_KEY ?? "").trim()),
    modele: null, jetonsEntree: 0, jetonsSortie: 0, jetonsReflexion: null, appelsModele: 0,
    capacitesOuvertes: null,
    scenarios: [], latenceTotaleMs: 0,
  };

  const finir = (): ResultatSmoke => {
    out.latenceTotaleMs = Date.now() - t0;
    out.premierEchecFournisseur = MAILLONS_FOURNISSEUR.find((k) => chaine[k] !== "PASS") ?? null;
    out.premierEchecMission = MAILLONS_MISSION.find((k) => chaine[k] !== "PASS") ?? null;
    out.providerProven = out.premierEchecFournisseur === null;
    out.missionE2eProven = out.providerProven && out.premierEchecMission === null;
    return out;
  };

  if (!out.cleDisponible) {
    out.raison = "OPENAI_API_KEY absente de l'environnement de ce processus.";
    return finir();
  }

  const instrument = new RaisonneurInstrumente(raisonneur, t0);
  const liste = await scenarios();

  for (const sc of liste) {
    const { r, chaine: partiel, metriques } = await jouer(user, sc, instrument, t0);
    out.scenarios.push(r);
    // UN MAILLON VERT LE RESTE : chaque scénario est une occasion de le prouver, et un scénario
    // métier plus exigeant que les autres n'efface pas ce que les précédents ont établi.
    for (const [k, v] of Object.entries(partiel)) if (v === "PASS") chaine[k as Maillon] = "PASS";
    out.modele ??= metriques.modele;
    out.capacitesOuvertes ??= metriques.ouvertes;
  }

  // LES JETONS SE LISENT SUR L'INSTRUMENT, PAS SUR LES PLANIFICATIONS. La boucle ci-dessus
  // additionnait `metriques.entree` — c'est-à-dire l'usage rendu par `lancerMission`, donc le
  // SEUL appel de planification initiale de chaque scénario. Un run réel a chiffré l'écart :
  // 11 521 jetons d'entrée annoncés pour 52 463 réellement facturés sur vingt appels.
  const tous = instrument.jetons();
  out.jetonsEntree = tous.entree;
  out.jetonsSortie = tous.sortie;
  out.jetonsReflexion = tous.reflexion;
  out.appelsModele = instrument.appels.length;

  const r = finir();
  if (!r.missionE2eProven && r.providerProven) {
    const pire = out.scenarios.find((s) => !s.stable) ?? out.scenarios.find((s) => s.goalSatisfied === false);
    out.raison = pire?.motifArret ?? "aucun scénario n'atteint un état terminal jugé cohérent";
  }
  return r;
}

/** La sortie — deux verdicts distincts, puis la cascade qui explique le temps. */
export function rendreTexte(r: ResultatSmoke): string {
  const val = (x: number | string | boolean | null) => (x === null ? "—" : String(x));
  const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`);
  const lignes: string[] = [
    "═══════════════ SMOKE FOURNISSEUR & MISSION — ADAM ═══════════════",
    "",
    "  CHAÎNE FOURNISSEUR",
    ...MAILLONS_FOURNISSEUR.map((m) => `  ${m.padEnd(24)} ${r.chaine[m]}`),
    `  ${"PROVIDER_PROVEN".padEnd(24)} ${r.providerProven ? "YES" : "NO"}`,
    "",
    "  CHAÎNE MISSION",
    ...MAILLONS_MISSION.map((m) => `  ${m.padEnd(24)} ${r.chaine[m]}`),
    `  ${"MISSION_E2E_PROVEN".padEnd(24)} ${r.missionE2eProven ? "YES" : "NO"}`,
    "",
    ...(r.premierEchecFournisseur ? [`Premier maillon fournisseur rompu : ${r.premierEchecFournisseur}`] : []),
    ...(r.premierEchecMission ? [`Premier maillon mission rompu     : ${r.premierEchecMission}`] : []),
    ...(r.raison ? [`Raison : ${r.raison}`] : []),
    "",
    "── Mesures globales ─────────────────────────────────────",
    `  OPENAI_API_KEY présente      ${r.cleDisponible ? "oui" : "NON"}`,
    `  modèle (rendu par l'API)     ${val(r.modele)}`,
    `  appels de modèle             ${r.appelsModele}`,
    `  jetons entrée / sortie       ${r.jetonsEntree} / ${r.jetonsSortie}`
    + (r.jetonsReflexion !== null ? `  (dont ${r.jetonsReflexion} de réflexion en sortie)` : ""),
    `  capacités ouvertes (plafond) ${val(r.capacitesOuvertes)}`,
    `  latence totale               ${ms(r.latenceTotaleMs)}`,
    "",
  ];

  for (const s of r.scenarios) {
    lignes.push(
      `── SCÉNARIO ${s.genre} ────────────────────────────────`,
      `  demande        « ${s.demande.slice(0, 150)}… »`,
      `  vérité terrain ${s.verite}`,
      `  mission        ${val(s.missionId)}`,
      `  état final     ${val(s.statutFinal)} ${s.stable ? "(stable)" : "(NON STABLE)"}`,
      `  arrêt          ${s.motifArret}`,
      `  tours moteur   ${s.toursMoteur} · replanifications ${s.replanifications} · plan v${val(s.versionPlan)}`,
      `  recours        ${s.recoursObserves} événement(s) STEP_RECOVERY`,
      `  étapes         ${val(s.etapesCompilees)} compilées · ${s.etapesTerminees} terminées · ${s.etapesEnEchec} en échec`,
      `  effet max      ${val(s.effetMaxObserve)} (plafond ${PLAFOND})`,
      `  QA / objectif  ${val(s.qaPassed)} / ${val(s.goalSatisfied)}`,
      ...(s.goalVerdict ? [`  verdict juge   ${s.goalVerdict.slice(0, 200)}`] : []),
      "",
    );
    if (s.cascade) lignes.push(...rendreCascade(s.cascade).map((l) => `  ${l}`), "");
  }

  lignes.push("══════════════════════════════════════════════════════════");
  return lignes.join("\n");
}
