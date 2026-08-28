/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DIAGNOSTIC FOURNISSEUR — la chaîne complète, depuis une phrase, avec un VRAI modèle.
 *
 *   langage naturel → fournisseur OpenAI → planner → MissionPlan → validation de schéma →
 *   compilateur → mission persistée → exécution en lecture seule → QA + satisfaction d'objectif
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────────────────
 *
 * L'audit Frontier a buté exactement ici : sans clé dans l'environnement d'audit, la chaîne
 * « une phrase devient un programme » n'a jamais été prouvée. Elle est TESTÉE de bout en bout
 * avec un raisonneur substitué — ce qui prouve que le CODE marche, et rien de ce qu'on voulait
 * savoir : qu'un modèle réel, sur une demande réelle, produit un plan que le compilateur
 * accepte, qui s'exécute, et dont un juge dit qu'il atteint l'objectif.
 *
 * La clé vit dans l'environnement du service Render. Ce module est donc écrit pour tourner
 * LÀ-BAS, appelé par `npm run adam:smoke:provider` depuis le Shell Render.
 *
 * ── CE QUE `scripts/smoke/openai-live.ts` PROUVE DÉJÀ, ET CE QU'IL NE PROUVE PAS ─────────
 *
 * Ce script existe et appelle bien un modèle réel — mais il s'arrête au PLAN : il DÉCRIT les
 * outils au modèle sans jamais les exécuter, et n'écrit rien en base. C'est le bon niveau pour
 * éprouver la couche fournisseur (formes acceptées, budgets, modes stricts), et délibérément
 * insuffisant ici : la question porte sur la chaîne ENTIÈRE, mission persistée, étapes
 * exécutées et verdict d'objectif compris. Les deux coexistent, chacun à son étage.
 *
 * ── CE QUI REND LA PREUVE NON FALSIFIABLE ────────────────────────────────────────────────
 *
 * Trois décisions, et elles comptent plus que le reste du fichier :
 *
 *   1. AUCUN RAISONNEUR N'EST INJECTABLE. `lancerMission` accepte `opts.reasoner` ; on ne le
 *      passe pas, et la signature d'ici ne l'expose pas. Un substitut ne peut donc pas entrer
 *      par cette porte, même par erreur d'appelant.
 *   2. LA PREUVE EST LA FACTURE. `metriques.usage` porte les jetons comptés et le nom du modèle
 *      RENDU PAR LE FOURNISSEUR. Un substitut rend `null`. C'est ce champ, et non le succès de
 *      la fonction, qui fait passer PROVIDER_CALL à PASS — un plan obtenu sans facture n'est
 *      pas un plan obtenu d'un modèle.
 *   3. LE VERDICT EST CALCULÉ PAR UNE FONCTION PURE, `verdictDe`, testable sans réseau et sans
 *      base. Elle ne peut pas rendre PROVIDER_PROVEN sans l'appel réel.
 *
 * ── LA SÛRETÉ : POURQUOI RIEN NE PEUT ÊTRE ÉCRIT NI ENVOYÉ ───────────────────────────────
 *
 * `lectureSeule: true` plafonne le catalogue à `ANALYZE` (voir `OptionsCatalogue.effetMax`).
 * Les capacités qui écrivent, communiquent, engagent ou détruisent ne sont pas RETIRÉES DU
 * PROMPT — elles sont absentes de la liste que le compilateur consulte. Un modèle qui en
 * nommerait une reçoit `UNKNOWN_CAPABILITY` ; l'étape ne compile pas, donc elle n'existe pas.
 *
 * C'est structurel, et c'est le point : une consigne « ne contacte personne » écrite dans la
 * demande serait du texte, qu'un document lu en cours de route pourrait contredire (§77). Ici
 * il n'y a pas d'instruction à contredire, il y a un outil qui manque.
 *
 * Le plafond est ensuite RE-VÉRIFIÉ sur les étapes réellement écrites en base — parce qu'une
 * garantie qu'on ne mesure pas est une garantie qu'on suppose.
 *
 * ── CE QUI N'EST JAMAIS AFFICHÉ ──────────────────────────────────────────────────────────
 *
 * Aucune clé, même tronquée, même masquée. Le module ne lit `process.env.OPENAI_API_KEY` que
 * pour savoir si elle EXISTE. Le résultat ne porte que des NOMS de variables et des états —
 * c'est ce qui permet de coller la sortie dans un message sans se relire.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { EFFECT_RANK, capabilityMeta, type Effect } from "@/lib/missions/registry/capability-meta";
import { RESOLVER_WRITE_NAMES } from "@/lib/assistant";
import { avancerMission, lancerMission } from "@/platform/in-process/missions/runtime";

/**
 * LA DEMANDE DE RÉFÉRENCE — en français, ordinaire, et volontairement pas triviale.
 *
 * Elle doit obliger le planner à CHOISIR des capacités et à les ORDONNER, sinon on prouverait
 * qu'un modèle sait répondre « une étape », ce qui n'est pas la question. Elle reste néanmoins
 * intégralement satisfiable en lecture : c'est ce qui permet de l'exécuter pour de bon.
 *
 * Le « ne contacte personne » final n'est PAS ce qui protège — le catalogue s'en charge. Il est
 * là parce qu'une demande réaliste en porte une, et qu'on veut mesurer la chaîne sur une phrase
 * telle qu'elle serait vraiment écrite.
 */
export const DEMANDE_REFERENCE =
  "Fais le point sur les dossiers réglementaires en cours : identifie les trois plus urgents, "
  + "explique pour chacun ce qui bloque, et résume-moi l'ensemble. "
  + "Ne contacte personne et ne modifie rien.";

/** Le plafond d'effet du diagnostic. Au-delà, la mission n'est PAS exécutée. */
export const PLAFOND: Effect = "ANALYZE";

/** Les sept maillons, dans l'ordre de la chaîne. L'ordre est utilisé : il donne la raison. */
export const MAILLONS = [
  "PROVIDER_CALL",
  "PLANNER_REAL_MODEL",
  "MISSION_PLAN_SCHEMA",
  "COMPILER",
  "MISSION_PERSISTED",
  "READ_ONLY_EXECUTION",
  "QA_GOAL_SATISFACTION",
] as const;
export type Maillon = (typeof MAILLONS)[number];

export type Etat = "PASS" | "FAIL";
export type Chaine = Record<Maillon, Etat>;

export interface MesuresFournisseur {
  cleDisponible: boolean;
  fournisseur: "openai" | "anthropic" | null;
  modele: string | null;
  jetonsEntree: number | null;
  jetonsSortie: number | null;
  capacitesOuvertes: number | null;
  etapesCompilees: number | null;
  etapesTerminees: number | null;
  etapesEnEchec: number | null;
  effetMaxObserve: Effect | null;
  /** Les capacités hors plafond trouvées en base. Doit rester vide. */
  capacitesHorsPlafond: string[];
  statutMission: string | null;
  qaPassed: boolean | null;
  goalSatisfied: boolean | null;
  goalVerdict: string | null;
  latencePlanificationMs: number | null;
  latenceTotaleMs: number | null;
}

export interface ResultatSmoke {
  /** PROVIDER_PROVEN n'est vrai QUE si les sept maillons sont PASS. */
  prouve: boolean;
  /** Le premier maillon rompu — celui qu'il faut aller regarder. */
  premierEchec: Maillon | null;
  raison: string | null;
  horodatage: string;
  demande: string;
  chaine: Chaine;
  mesures: MesuresFournisseur;
  missionId: string | null;
  /** Les refus du compilateur, quand il refuse — ils nomment l'étape et la règle. */
  refus: string[];
}

/**
 * LE VERDICT — pur, sans réseau, sans base, donc testable et sabotable.
 *
 * PROVIDER_PROVEN exige les sept. Il n'y a pas de chemin qui contourne cette ligne : c'est elle
 * qui empêche un environnement sans clé, ou un substitut, de rendre un rapport vert (§60).
 */
export function verdictDe(chaine: Chaine): { prouve: boolean; premierEchec: Maillon | null } {
  const premierEchec = MAILLONS.find((m) => chaine[m] !== "PASS") ?? null;
  return { prouve: premierEchec === null, premierEchec };
}

const estEcriture = (n: string): boolean => RESOLVER_WRITE_NAMES.has(n);

/**
 * LE DIAGNOSTIC. Une seule signature, volontairement pauvre : une personne, et c'est tout.
 *
 * Pas de `reasoner`, pas de `catalogue`, pas de `demande` — rien qui permette à un appelant de
 * changer ce qui est mesuré. Un diagnostic paramétrable finit paramétré jusqu'à passer.
 */
export async function smokeFournisseur(user: CurrentUser): Promise<ResultatSmoke> {
  const t0 = Date.now();
  const chaine: Chaine = {
    PROVIDER_CALL: "FAIL", PLANNER_REAL_MODEL: "FAIL", MISSION_PLAN_SCHEMA: "FAIL",
    COMPILER: "FAIL", MISSION_PERSISTED: "FAIL", READ_ONLY_EXECUTION: "FAIL",
    QA_GOAL_SATISFACTION: "FAIL",
  };
  const mesures: MesuresFournisseur = {
    // ON NE LIT QUE L'EXISTENCE. La valeur n'est ni copiée, ni tronquée, ni journalisée.
    cleDisponible: Boolean((process.env.OPENAI_API_KEY ?? "").trim()),
    fournisseur: (process.env.OPENAI_API_KEY ?? "").trim() ? "openai" : null,
    modele: null, jetonsEntree: null, jetonsSortie: null,
    capacitesOuvertes: null, etapesCompilees: null, etapesTerminees: null, etapesEnEchec: null,
    effetMaxObserve: null, capacitesHorsPlafond: [],
    statutMission: null, qaPassed: null, goalSatisfied: null, goalVerdict: null,
    latencePlanificationMs: null, latenceTotaleMs: null,
  };
  let missionId: string | null = null;
  const refus: string[] = [];
  let raison: string | null = null;

  const rendre = (): ResultatSmoke => {
    mesures.latenceTotaleMs = Date.now() - t0;
    const { prouve, premierEchec } = verdictDe(chaine);
    return {
      prouve, premierEchec, raison,
      horodatage: new Date().toISOString(),
      demande: DEMANDE_REFERENCE,
      chaine, mesures, missionId, refus,
    };
  };

  if (!mesures.cleDisponible) {
    raison = "OPENAI_API_KEY absente de l'environnement de ce processus.";
    return rendre();
  }

  // ── LE LANCEMENT — le vrai point d'entrée, celui que l'outil `run_mission` appelle ──────
  //
  // `demarrer: false` sépare deux questions qui doivent le rester : « le modèle a-t-il produit
  // un programme compilable ? » et « ce programme tourne-t-il ? ». Les mélanger ferait imputer
  // à la planification l'échec d'une lecture, et inversement.
  const lancement = await lancerMission(user, DEMANDE_REFERENCE, {
    lectureSeule: true,
    demarrer: false,
    titre: "Diagnostic fournisseur (lecture seule)",
  }).catch((e: unknown) => ({
    ok: false as const,
    error: e instanceof Error ? e.message : String(e),
    metriques: undefined,
  }));

  const m = lancement.metriques;
  if (m) {
    mesures.capacitesOuvertes = m.capacitesAutorisees;
    mesures.latencePlanificationMs = m.latencyMs;
    if (m.usage) {
      // ── LA FACTURE EST LA PREUVE ────────────────────────────────────────────────────
      // Des jetons comptés et un nom de modèle ne peuvent venir que d'une réponse du
      // fournisseur. C'est ici, et nulle part ailleurs, que « l'appel a eu lieu » se décide.
      if (m.usage.outputTokens > 0 || m.usage.inputTokens > 0) chaine.PROVIDER_CALL = "PASS";
      mesures.modele = m.usage.model;
      mesures.jetonsEntree = m.usage.inputTokens;
      mesures.jetonsSortie = m.usage.outputTokens;
    }
  }

  if (!lancement.ok) {
    const err = lancement.error ?? "";
    raison = err || "lancement refusé";
    // Le message du planner distingue déjà « non conforme au schéma » du reste ; on ne
    // réinterprète pas, on classe.
    if (chaine.PROVIDER_CALL === "PASS" && !/n'a rien rendu|aucun fournisseur/i.test(err)) {
      chaine.PLANNER_REAL_MODEL = "PASS";
      if (!/non conforme au schéma/i.test(err)) chaine.MISSION_PLAN_SCHEMA = "PASS";
    }
    if ("refus" in lancement && Array.isArray(lancement.refus)) {
      for (const i of lancement.refus) refus.push(`[${i.code}] ${i.stepKey ?? "plan"} : ${i.message}`);
    }
    return rendre();
  }

  chaine.PLANNER_REAL_MODEL = "PASS";
  chaine.MISSION_PLAN_SCHEMA = "PASS";
  chaine.COMPILER = "PASS";
  missionId = lancement.missionId;
  mesures.etapesCompilees = lancement.etapes;

  // ── LA RELECTURE — ce qui est écrit, pas ce qui a été renvoyé ───────────────────────────
  //
  // `lancerMission` dit combien d'étapes il a compilées. La base dit lesquelles existent. Les
  // deux doivent concorder, et c'est la seconde qui fait foi : c'est elle que le moteur lira.
  const etapes = await prisma.missionStep.findMany({
    where: { missionId },
    select: { capability: true },
  });
  if (etapes.length > 0) chaine.MISSION_PERSISTED = "PASS";
  else raison = "la mission compilée ne se relit pas en base.";

  // ── LE PLAFOND, VÉRIFIÉ ET NON SUPPOSÉ ─────────────────────────────────────────────────
  const plafond = EFFECT_RANK[PLAFOND];
  let max: Effect = "READ";
  for (const e of etapes) {
    if (!e.capability) continue; // nœud de contrôle : il n'appelle rien.
    const eff = capabilityMeta(e.capability, estEcriture).effect;
    if (EFFECT_RANK[eff] > EFFECT_RANK[max]) max = eff;
    if (EFFECT_RANK[eff] > plafond) mesures.capacitesHorsPlafond.push(`${e.capability} (${eff})`);
  }
  mesures.effetMaxObserve = etapes.some((e) => e.capability) ? max : null;

  // UN DÉFAUT DE GARDE NE S'EXÉCUTE PAS. Si une capacité hors plafond a franchi le catalogue et
  // le compilateur, la bonne conduite est de S'ARRÊTER et de le dire — pas de faire tourner la
  // mission pour voir. C'est le seul endroit du fichier qui refuse de continuer.
  if (mesures.capacitesHorsPlafond.length > 0) {
    raison = `défaut de garde : ${mesures.capacitesHorsPlafond.join(", ")} dépasse le plafond ${PLAFOND}.`;
    return rendre();
  }
  if (chaine.MISSION_PERSISTED !== "PASS") return rendre();

  // ── L'EXÉCUTION — sur le moteur de production, plafonnée en lecture ─────────────────────
  //
  // Plusieurs tours : le moteur est ré-entrant, et la CONCLUSION (contrôle qualité + juge)
  // n'arrive qu'une fois toutes les étapes terminales. S'arrêter au premier tour mesurerait
  // « des étapes ont tourné » et laisserait le verdict d'objectif à jamais absent.
  for (let tour = 0; tour < 4; tour++) {
    await avancerMission(user, missionId, { lectureSeule: true, maxTours: 4 }).catch(() => null);
    const etat = await prisma.mission.findUnique({
      where: { id: missionId },
      select: { status: true },
    });
    if (etat && ["COMPLETED", "PARTIAL", "FAILED", "BLOCKED", "CANCELLED"].includes(etat.status)) break;
  }

  const parStatut = await prisma.missionStep.groupBy({
    by: ["status"], where: { missionId }, _count: { _all: true },
  });
  const compte = (s: string) => parStatut.find((r) => r.status === s)?._count._all ?? 0;
  mesures.etapesTerminees = compte("DONE");
  mesures.etapesEnEchec = compte("FAILED");
  if (parStatut.some((r) => r.status !== "PENDING" && r.status !== "READY")) {
    chaine.READ_ONLY_EXECUTION = "PASS";
  } else {
    raison = "aucune étape n'a tourné.";
  }

  // ── LE VERDICT D'OBJECTIF — écrit par `conclure()`, jamais recalculé ici ────────────────
  //
  // `qaPassed` et `goalSatisfied` sont posés en base par le moteur lui-même. Les recalculer
  // dans le diagnostic donnerait un second juge, qui finirait par contredire le premier — et
  // c'est celui qu'on n'aurait pas relu qui servirait de preuve (§10).
  const fin = await prisma.mission.findUnique({
    where: { id: missionId },
    select: { status: true, qaPassed: true, goalSatisfied: true, goalVerdict: true },
  });
  mesures.statutMission = fin?.status ?? null;
  mesures.qaPassed = fin?.qaPassed ?? null;
  mesures.goalSatisfied = fin?.goalSatisfied ?? null;
  mesures.goalVerdict = fin?.goalVerdict ?? null;

  // LES DEUX, JAMAIS L'UN (§10) : le contrôle arithmétique a le dernier mot dans le sens
  // négatif, et la satisfaction se JUGE. Une mission dont personne n'a jugé l'objectif ne
  // compte pas comme prouvée — un moteur qui conclut faute d'avoir pu vérifier est pire qu'un
  // moteur qui ne conclut pas.
  if (fin?.qaPassed === true && fin?.goalSatisfied === true) {
    chaine.QA_GOAL_SATISFACTION = "PASS";
  } else if (fin?.goalSatisfied === null || fin?.goalSatisfied === undefined) {
    raison = `la mission n'a pas été jugée (statut ${fin?.status ?? "inconnu"}) — ni QA ni satisfaction n'ont de verdict.`;
  } else {
    raison = fin.goalVerdict ?? `QA ${fin.qaPassed ? "passée" : "échouée"}, objectif ${fin.goalSatisfied ? "atteint" : "non atteint"}.`;
  }

  return rendre();
}

/**
 * LA SORTIE — le format exigé par l'audit, au mot près.
 *
 * Les huit lignes de tête sont stables et analysables : c'est ce qui permet de comparer deux
 * exécutions séparées de six mois, et de brancher un contrôle automatique dessus. Le détail
 * vient après, pour l'humain qui doit comprendre POURQUOI.
 */
export function rendreTexte(r: ResultatSmoke): string {
  const val = (x: number | string | boolean | null) => (x === null ? "—" : String(x));
  return [
    "═══════════════ SMOKE FOURNISSEUR — ADAM ═══════════════",
    ...MAILLONS.map((m) => `${m.padEnd(22)} ${r.chaine[m]}`),
    `${"PROVIDER_PROVEN".padEnd(22)} ${r.prouve ? "YES" : "NO"}`,
    "",
    ...(r.premierEchec ? [`Premier maillon rompu : ${r.premierEchec}`] : []),
    ...(r.raison ? [`Raison                : ${r.raison}`] : []),
    ...(r.premierEchec || r.raison ? [""] : []),
    "── Mesures ─────────────────────────────────────────────",
    `  OPENAI_API_KEY présente      ${r.mesures.cleDisponible ? "oui" : "NON"}`,
    `  fournisseur                  ${val(r.mesures.fournisseur)}`,
    `  modèle (rendu par l'API)     ${val(r.mesures.modele)}`,
    `  jetons entrée / sortie       ${val(r.mesures.jetonsEntree)} / ${val(r.mesures.jetonsSortie)}`,
    `  capacités ouvertes (plafond) ${val(r.mesures.capacitesOuvertes)}`,
    `  étapes compilées             ${val(r.mesures.etapesCompilees)}`,
    `  étapes terminées / échouées  ${val(r.mesures.etapesTerminees)} / ${val(r.mesures.etapesEnEchec)}`,
    `  effet maximal observé        ${val(r.mesures.effetMaxObserve)} (plafond ${PLAFOND})`,
    `  statut final de la mission   ${val(r.mesures.statutMission)}`,
    `  QA passée                    ${val(r.mesures.qaPassed)}`,
    `  objectif jugé atteint        ${val(r.mesures.goalSatisfied)}`,
    ...(r.mesures.goalVerdict ? [`  verdict du juge              ${r.mesures.goalVerdict}`] : []),
    `  latence planification        ${r.mesures.latencePlanificationMs !== null ? `${r.mesures.latencePlanificationMs} ms` : "—"}`,
    `  latence totale               ${r.mesures.latenceTotaleMs !== null ? `${r.mesures.latenceTotaleMs} ms` : "—"}`,
    `  mission                      ${val(r.missionId)}`,
    ...(r.refus.length ? ["", "  REFUS DU COMPILATEUR :", ...r.refus.map((x) => `    ${x}`)] : []),
    ...(r.mesures.capacitesHorsPlafond.length
      ? ["", "  HORS PLAFOND (défaut de garde) :", ...r.mesures.capacitesHorsPlafond.map((x) => `    ${x}`)]
      : []),
    "════════════════════════════════════════════════════════",
  ].join("\n");
}
