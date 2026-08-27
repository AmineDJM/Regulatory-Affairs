import { prisma } from "@/lib/prisma";
import type { CapabilityRunner, Clock, MissionActor } from "@/lib/missions/ports";
import { systemClock } from "@/lib/missions/ports";
import {
  MissionState, STEP_TERMINAL, StepState, assertStepTransition, deduireEtat,
} from "@/lib/missions/runtime/state";
import {
  EtatEtape, EtatMission, chargerEtat, cleIdempotence, compter, journaliser, transitionner,
} from "@/lib/missions/runtime/store";
import { entreeIteration, identiteIteration, lire } from "@/lib/missions/runtime/interpolate";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE MOTEUR — l'autorité d'exécution (§13). Le modèle propose ; ce fichier décide.
 *
 * ── LE PRINCIPE, EN UNE PHRASE ───────────────────────────────────────────────────────────
 *
 * Le moteur ne garde RIEN entre deux tours : il relit l'état complet en base, décide ce qui
 * peut partir, l'exécute, écrit le résultat, et recommence. C'est ce qui rend un redémarrage
 * indiscernable d'une pause — et c'est la seule façon d'être reprenable sans y penser à chaque
 * ligne.
 *
 * ── CE QU'UN CRASH À L'ÉTAPE 73 SUR 127 DOIT DONNER ──────────────────────────────────────
 *
 * Les 72 étapes terminées portent un reçu ; elles ne sont pas relues comme du travail à faire.
 * La 73ᵉ, si elle avait commencé, porte une clé d'idempotence : la rejouer traverse le chemin
 * canonique, qui reconnaît la clé et rend le reçu existant au lieu de renvoyer l'e-mail. Les 54
 * suivantes n'ont jamais commencé. Aucun des trois cas n'exige de code particulier ici — c'est
 * le schéma qui les distingue.
 *
 * ── POURQUOI « UN TOUR » PLUTÔT QU'UNE BOUCLE INFINIE ────────────────────────────────────
 *
 * `avancer()` fait avancer la mission autant qu'elle peut avancer MAINTENANT, puis rend la
 * main. Une mission qui attend un événement de dix jours ne doit pas occuper un processus
 * pendant dix jours : elle s'arrête, et c'est l'ordonnanceur existant ou le routeur
 * d'événements qui la rappelle. Aucun ordonnanceur n'est créé ici (§39).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LA DURÉE AU-DELÀ DE LAQUELLE UNE ÉTAPE « EN COURS » EST CONSIDÉRÉE ORPHELINE.
 *
 * Un processus tué laisse ses étapes en `RUNNING` pour toujours : personne ne viendra les
 * terminer, et sans reprise la mission serait figée. On les reprend donc — ce qui n'est sûr QUE
 * parce que la clé d'idempotence protège la reprise d'un effet déjà produit.
 */
export const BAIL_MS = 10 * 60 * 1000;

export interface StepContext {
  mission: EtatMission;
  step: EtatEtape;
  actor: MissionActor;
  clock: Clock;
}

/** Ce qu'un gestionnaire de nœud rend au moteur. Rien d'autre n'est écrit en base par lui. */
export type StepOutcome =
  | { status: "DONE"; result?: unknown; receipt?: string }
  | { status: "WAITING"; raison: string }
  | { status: "SKIPPED"; raison: string }
  | { status: "FAILED"; error: string; errorKind: string; retryable: boolean };

export interface StepHandlers {
  WORKER?: (ctx: StepContext) => Promise<StepOutcome>;
  APPROVAL?: (ctx: StepContext) => Promise<StepOutcome>;
  QA?: (ctx: StepContext) => Promise<StepOutcome>;
  ARTIFACT?: (ctx: StepContext) => Promise<StepOutcome>;
  WAIT_EVENT?: (ctx: StepContext) => Promise<StepOutcome>;
  WAIT_INPUT?: (ctx: StepContext) => Promise<StepOutcome>;
}

export interface EngineDeps {
  runner: CapabilityRunner;
  handlers?: StepHandlers;
  clock?: Clock;
  /** Borne le nombre de tours d'un même appel — protège d'un graphe pathologique, pas du volume. */
  maxTours?: number;
}

export interface TickResult {
  missionId: string;
  status: MissionState;
  executees: number;
  echouees: number;
  deployees: number;
  dedupliquees: number;
  tours: number;
  /** Vrai quand plus rien ne peut avancer sans un événement extérieur. */
  enPause: boolean;
}

const estTerminal = (s: StepState): boolean => STEP_TERMINAL.has(s);

/**
 * FAIT AVANCER LA MISSION AUTANT QU'ELLE PEUT AVANCER MAINTENANT.
 *
 * Réentrant et sûr à rappeler : deux appels concurrents se disputent les étapes par une
 * réservation en base (`status = READY → RUNNING` conditionnée), et le perdant n'exécute rien.
 */
export async function avancer(
  missionId: string,
  actor: MissionActor,
  deps: EngineDeps,
): Promise<TickResult> {
  const clock = deps.clock ?? systemClock;
  const maxTours = deps.maxTours ?? 200;
  const res: TickResult = {
    missionId, status: "RUNNING", executees: 0, echouees: 0,
    deployees: 0, dedupliquees: 0, tours: 0, enPause: false,
  };

  for (let tour = 0; tour < maxTours; tour++) {
    res.tours = tour + 1;
    const etat = await chargerEtat(missionId);
    if (!etat) throw new Error(`mission introuvable : ${missionId}`);

    if (etat.status === "COMPLETED" || etat.status === "CANCELLED") {
      res.status = etat.status;
      res.enPause = true;
      return res;
    }

    await demarrer(etat);

    // LES DEUX REMISES EN FILE D'ABORD, PUIS UNE RELECTURE. L'ordre inverse ferait travailler le
    // tour sur une photo antérieure à ses propres écritures : une étape reprise resterait « en
    // cours » aux yeux du moteur, et la mission se figerait en se croyant occupée.
    await reprendreOrphelines(missionId, clock);
    const relancees = await relancerReparables(missionId);
    const frais = await chargerEtat(missionId);
    if (!frais) throw new Error(`mission introuvable : ${missionId}`);

    const pretes = etapesPretes(frais);
    if (pretes.length === 0) {
      const resolues = await resoudreEventails(frais);
      if (resolues === 0 && relancees === 0) {
        res.status = await synchroniserEtat(missionId, frais);
        res.enPause = true;
        return res;
      }
      continue;
    }

    // ── LE PARALLÉLISME RÉEL, BORNÉ PAR LA MISSION (§10) ──────────────────────────────
    const lot = pretes.slice(0, Math.max(1, frais.maxConcurrency));
    const sorties = await enParallele(lot, frais.maxConcurrency, async (step) => {
      const reserve = await reserver(step, clock);
      if (!reserve) return null;
      return executerUneEtape(frais, step, actor, deps, clock);
    });

    for (const s of sorties) {
      if (!s) continue;
      if (s.kind === "expansion") { res.deployees += s.n; continue; }
      if (s.dedupliquee) res.dedupliquees += 1;
      if (s.echouee) res.echouees += 1; else res.executees += 1;
    }

    res.status = await synchroniserEtat(missionId, await chargerEtat(missionId) ?? frais);
  }

  res.enPause = true;
  return res;
}

/**
 * AMÈNE LA MISSION À `RUNNING` AVANT DE TOUCHER À QUOI QUE CE SOIT.
 *
 * ── POURQUOI CE PASSAGE EXISTE, ET POURQUOI IL EST EXPLICITE ─────────────────────────────
 *
 * L'état déduit des étapes (`deduireEtat`) décrit une mission QUI TRAVAILLE : « il reste des
 * dépendances », « une branche attend ». Ces états ne se rejoignent pas depuis `PLANNING` — et
 * c'est voulu : une mission qui n'a jamais démarré ne peut pas être « en attente d'événement »,
 * elle est simplement en attente de départ.
 *
 * La première écriture de ce moteur l'avait oublié, et la machine à états a refusé la
 * transition plutôt que de laisser une mission dans un état qu'aucune séquence légale ne
 * produit. C'est exactement ce pour quoi elle existe.
 *
 * `PLANNING → READY` n'est pas un pas de plus pour rien : `READY` signifie « le plan est écrit
 * en base et personne ne l'a encore lancé », ce qui est l'état réel entre la compilation et le
 * premier tour, et l'état auquel une porte d'approbation de PÉRIMÈTRE viendra s'accrocher.
 */
async function demarrer(etat: EtatMission): Promise<void> {
  if (etat.status === "PLANNING") {
    await transitionner(etat.id, "READY", "plan écrit en base");
    etat.status = "READY";
  }
  if (etat.status !== "RUNNING") {
    await transitionner(etat.id, "RUNNING", "le moteur prend la main");
    etat.status = "RUNNING";
  }
}

/** Les étapes dont toutes les dépendances sont TERMINÉES. `SKIPPED` compte : voir `graph.ts`. */
function etapesPretes(etat: EtatMission): EtatEtape[] {
  const parCle = new Map(etat.steps.map((s) => [s.key, s]));
  return etat.steps.filter((s) =>
    s.status === "PENDING"
    && s.dependsOn.every((d) => {
      const dep = parCle.get(d);
      return dep ? estTerminal(dep.status) : true;
    }));
}

/**
 * RÉSERVE UNE ÉTAPE. C'est la base qui arbitre, pas la politesse des appelants.
 *
 * `updateMany` avec la condition sur l'état ancien rend zéro ligne si un autre processus est
 * passé avant. Sans cette condition, deux instances du moteur — la web et la tâche de fond —
 * exécuteraient la même étape, et l'idempotence ne rattraperait que les écritures.
 */
async function reserver(step: EtatEtape, clock: Clock): Promise<boolean> {
  const r = await prisma.missionStep.updateMany({
    where: { id: step.id, status: "PENDING" },
    data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: clock.now() },
  });
  return r.count === 1;
}

/**
 * REPREND LES ÉTAPES LAISSÉES « EN COURS » PAR UN PROCESSUS MORT.
 *
 * Sans cela, un redémarrage de Render au mauvais moment fige la mission pour toujours. Avec
 * cela — et grâce à la clé d'idempotence — la reprise est sûre : l'effet déjà produit n'est pas
 * reproduit, seul le reçu est retrouvé.
 */
async function reprendreOrphelines(missionId: string, clock: Clock): Promise<void> {
  const limite = new Date(clock.now().getTime() - BAIL_MS);
  const orphelines = await prisma.missionStep.findMany({
    where: { missionId, status: "RUNNING", startedAt: { lt: limite } },
    select: { id: true, key: true },
  });
  for (const o of orphelines) {
    await prisma.missionStep.updateMany({
      where: { id: o.id, status: "RUNNING" },
      data: { status: "PENDING", error: "reprise après interruption du processus" },
    });
    await journaliser(missionId, "STEP_RECLAIMED",
      `Étape « ${o.key} » reprise : le processus qui l'exécutait ne répond plus.`, { stepKey: o.key });
  }
}

/** Remet en file les étapes échouées à qui il reste des tentatives (§13). */
async function relancerReparables(missionId: string): Promise<number> {
  const r = await prisma.missionStep.updateMany({
    where: { missionId, status: "FAILED", attempt: { lt: prisma.missionStep.fields.maxAttempts } },
    data: { status: "PENDING" },
  });
  if (r.count > 0) {
    await journaliser(missionId, "STEP_RETRY", `${r.count} étape(s) remise(s) en file pour une nouvelle tentative.`);
  }
  return r.count;
}

type Sortie =
  | { kind: "expansion"; n: number }
  | { kind: "etape"; echouee: boolean; dedupliquee: boolean };

/**
 * EXÉCUTE UNE ÉTAPE, et écrit le résultat. C'EST le point de reprise (§14).
 *
 * L'écriture suit immédiatement l'exécution, sans regrouper : différer pour « écrire par lot »
 * ferait perdre exactement le travail qu'on cherche à ne pas refaire.
 */
async function executerUneEtape(
  etat: EtatMission,
  step: EtatEtape,
  actor: MissionActor,
  deps: EngineDeps,
  clock: Clock,
): Promise<Sortie> {
  // L'ÉVENTAIL SE DÉPLOIE AVANT TOUT AUTRE TRAITEMENT : ce n'est pas une étape à exécuter, c'est
  // une étape qui en fabrique d'autres.
  if (step.forEach) {
    const n = await deployerEventail(etat, step, step.forEach);
    return { kind: "expansion", n };
  }

  const ctx: StepContext = { mission: etat, step, actor, clock };
  let sortie: StepOutcome;
  try {
    sortie = await dispatcher(ctx, deps);
  } catch (e) {
    sortie = {
      status: "FAILED",
      error: e instanceof Error ? e.message : String(e),
      errorKind: "CAPABILITY_FAILURE",
      retryable: true,
    };
  }

  await ecrireSortie(etat, step, sortie, clock);
  return {
    kind: "etape",
    echouee: sortie.status === "FAILED",
    dedupliquee: sortie.status === "DONE" && sortie.receipt === "DEDUPLIQUE",
  };
}

/** Aiguille selon le type de nœud. Les types de CONTRÔLE ont un comportement natif. */
async function dispatcher(ctx: StepContext, deps: EngineDeps): Promise<StepOutcome> {
  const { step } = ctx;
  const h = deps.handlers ?? {};

  switch (step.nodeType) {
    case "JOIN":
      // Une jonction ne fait rien : ses dépendances étant terminées, elle l'est aussi. Son
      // existence sert à réduire le nombre d'arêtes, pas à produire quoi que ce soit.
      return { status: "DONE", result: { joined: step.dependsOn.length } };

    case "WAIT_EVENT":
      return h.WAIT_EVENT
        ? h.WAIT_EVENT(ctx)
        : { status: "WAITING", raison: `attend l'événement ${String(step.waitFor?.event ?? "?")}` };

    case "WAIT_INPUT":
      return h.WAIT_INPUT
        ? h.WAIT_INPUT(ctx)
        : { status: "WAITING", raison: String(step.waitFor?.ask ?? "attend un élément humain") };

    case "APPROVAL":
      return h.APPROVAL
        ? h.APPROVAL(ctx)
        // SANS GESTIONNAIRE D'APPROBATION, ON ATTEND — jamais on ne passe. Le défaut d'une porte
        // est d'être fermée : l'inverse ferait d'une brique manquante une autorisation tacite.
        : { status: "WAITING", raison: "attend une approbation" };

    case "WORKER":
      return h.WORKER
        ? h.WORKER(ctx)
        : { status: "FAILED", error: "aucun exécutant de worker n'est branché", errorKind: "MISSING_WORKER", retryable: false };

    case "QA":
      return h.QA ? h.QA(ctx) : { status: "SKIPPED", raison: "aucun contrôleur qualité n'est branché" };

    case "ARTIFACT":
      return h.ARTIFACT
        ? h.ARTIFACT(ctx)
        : { status: "FAILED", error: "aucune fabrique d'artefact n'est branchée", errorKind: "MISSING_ARTIFACT", retryable: false };

    case "CAPABILITY":
    default:
      return executerCapacite(ctx, deps);
  }
}

/** L'appel d'une capacité, avec sa clé d'idempotence quand l'étape en réclame une. */
async function executerCapacite(ctx: StepContext, deps: EngineDeps): Promise<StepOutcome> {
  const { step, mission, actor } = ctx;
  if (!step.capability) {
    return { status: "FAILED", error: "étape CAPABILITY sans capacité", errorKind: "INVALID_STEP", retryable: false };
  }

  const cle = step.idempotencyKey
    ?? (step.needsIdempotencyKey ? cleIdempotence(mission.id, step.key, step.capability, cibleDe(step.input)) : null);

  if (cle && cle !== step.idempotencyKey) {
    // POSER LA CLÉ AVANT D'AGIR. Si une autre exécution l'a déjà posée, l'unicité en base
    // refuse — et ce refus EST l'information : le travail a déjà été réclamé ailleurs.
    try {
      await prisma.missionStep.update({ where: { id: step.id }, data: { idempotencyKey: cle } });
    } catch {
      return { status: "DONE", receipt: "DEDUPLIQUE", result: { deduplique: true } };
    }
  }

  const out = await deps.runner.run({
    capability: step.capability,
    input: step.input,
    actor,
    missionId: mission.id,
    stepKey: step.key,
    idempotencyKey: cle,
  });

  await compter(mission.id, { toolCalls: 1 });

  if (!out.ok) {
    return {
      status: "FAILED",
      error: out.error?.message ?? "échec sans message",
      errorKind: out.error?.kind ?? "CAPABILITY_FAILURE",
      retryable: out.error?.retryable ?? true,
    };
  }
  return { status: "DONE", result: out.output, receipt: out.deduplicated ? "DEDUPLIQUE" : undefined };
}

/** La cible d'une action — ce qui rend la clé unique par PERSONNE, pas seulement par étape. */
function cibleDe(input: Record<string, unknown>): string | null {
  for (const champ of ["to", "destinataire", "employeeId", "userId", "personId", "recordId", "id"]) {
    const v = input[champ];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

/** Écrit le résultat de l'étape — et transitionne en passant par la machine à états. */
async function ecrireSortie(
  etat: EtatMission,
  step: EtatEtape,
  sortie: StepOutcome,
  clock: Clock,
): Promise<void> {
  assertStepTransition("RUNNING", sortie.status);
  const base = { status: sortie.status as string, updatedAt: clock.now() };

  if (sortie.status === "DONE") {
    await prisma.missionStep.update({
      where: { id: step.id },
      data: {
        ...base,
        result: (sortie.result ?? null) as never,
        receipt: sortie.receipt ?? null,
        error: null,
        errorKind: null,
        completedAt: clock.now(),
      },
    });
    await journaliser(etat.id, "STEP_DONE", `Étape « ${step.title} » terminée.`,
      { stepKey: step.key, receipt: sortie.receipt ?? null });
    return;
  }

  if (sortie.status === "FAILED") {
    await prisma.missionStep.update({
      where: { id: step.id },
      data: {
        ...base,
        error: sortie.error,
        errorKind: sortie.errorKind,
        // UN ÉCHEC NON REJOUABLE ÉPUISE SES TENTATIVES TOUT DE SUITE. Réessayer trois fois une
        // permission manquante ne la fait pas apparaître ; cela retarde seulement le diagnostic.
        ...(sortie.retryable ? {} : { attempt: step.maxAttempts }),
      },
    });
    await journaliser(etat.id, "STEP_FAILED", `Étape « ${step.title} » en échec : ${sortie.error}`,
      { stepKey: step.key, errorKind: sortie.errorKind, retryable: sortie.retryable });
    return;
  }

  if (sortie.status === "WAITING") {
    await prisma.missionStep.update({ where: { id: step.id }, data: base });
    await journaliser(etat.id, "STEP_WAITING", `Étape « ${step.title} » en attente : ${sortie.raison}`,
      { stepKey: step.key });
    return;
  }

  await prisma.missionStep.update({
    where: { id: step.id },
    data: { ...base, completedAt: clock.now(), error: sortie.raison },
  });
  await journaliser(etat.id, "STEP_SKIPPED", `Étape « ${step.title} » ignorée : ${sortie.raison}`,
    { stepKey: step.key });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DÉPLOIEMENT EN ÉVENTAIL (§10) — trente-trois étapes réelles, nées d'une seule.
 *
 * C'est ici que « le même code pour 3 et pour 3 000 » cesse d'être une intention. Le plan porte
 * UNE étape ; la collection n'existe qu'à l'exécution ; le graphe grandit avec les données.
 *
 * L'étape modèle ne disparaît pas : elle passe en ATTENTE de ses filles, ce qui fait que tout
 * ce qui dépendait d'elle attend naturellement les trente-trois. Aucune arête n'est réécrite —
 * et une réécriture d'arêtes en cours d'exécution serait exactement le genre d'opération qu'un
 * crash au mauvais moment laisserait à moitié faite.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
async function deployerEventail(
  etat: EtatMission,
  step: EtatEtape,
  spec: { from: string; path: string; as: string },
): Promise<number> {
  const { from, path, as } = spec;
  const source = etat.steps.find((s) => s.key === from);

  const collection = source ? lire(source.result, path) : undefined;
  if (!Array.isArray(collection)) {
    await ecrireSortie(etat, step, {
      status: "FAILED",
      error: `l'éventail attendait une liste en « ${from}.${path} » ; il a trouvé ${typeof collection}.`,
      errorKind: "INCOMPATIBLE_RESULT",
      retryable: false,
    }, systemClock);
    return 0;
  }

  if (collection.length === 0) {
    // UNE COLLECTION VIDE N'EST PAS UNE ERREUR, et ce n'est pas non plus une étape « ignorée » :
    // l'étape a bel et bien tourné, elle a lu la liste, la liste était vide. « Écris à tous les
    // salariés en congé » quand il n'y en a aucun est une mission ACCOMPLIE. Le résultat porte
    // le zéro, pour que le contrôle qualité compte zéro attendu et non zéro manquant.
    await ecrireSortie(etat, step,
      { status: "DONE", result: { expanded: 0, keys: [], source: `${from}.${path}` } }, systemClock);
    return 0;
  }

  const cles: string[] = [];
  for (const [i, element] of collection.entries()) {
    const cle = `${step.key}#${identiteIteration(element, i)}`;
    cles.push(cle);
    await prisma.missionStep.upsert({
      where: { missionId_key: { missionId: etat.id, key: cle } },
      create: {
        missionId: etat.id,
        key: cle,
        title: `${step.title} — ${identiteIteration(element, i)}`,
        workstream: step.workstream,
        nodeType: step.nodeType,
        capability: step.capability,
        input: entreeIteration(step.input, as, element) as never,
        maxAttempts: step.maxAttempts,
        // LES FILLES HÉRITENT DE L'EXIGENCE DE CLÉ. Ce sont ELLES qui envoient réellement les
        // trente-trois messages ; l'oublier ici viderait §15 de son sens exactement là où il
        // compte — la première écriture de ce fichier le faisait, et les trente-trois clés
        // arrivaient nulles.
        needsIdempotencyKey: step.needsIdempotencyKey,
        planVersion: step.planVersion,
        status: "PENDING",
      },
      // UNE ITÉRATION DÉJÀ CRÉÉE N'EST PAS RÉÉCRITE : un second déploiement (reprise après
      // panne) doit retrouver les filles, jamais les remettre à zéro.
      update: {},
    });

    // Les filles héritent des dépendances du modèle, pas du modèle lui-même : dépendre de lui
    // fermerait un cycle, puisque lui attend ses filles.
    for (const d of step.dependsOn) {
      const parent = etat.steps.find((s) => s.key === d);
      const fille = await prisma.missionStep.findUnique({
        where: { missionId_key: { missionId: etat.id, key: cle } }, select: { id: true },
      });
      if (parent && fille) {
        await prisma.missionStepDep.upsert({
          where: { stepId_dependsOnId: { stepId: fille.id, dependsOnId: parent.id } },
          create: { stepId: fille.id, dependsOnId: parent.id },
          update: {},
        });
      }
    }
  }

  await prisma.missionStep.update({
    where: { id: step.id },
    data: { status: "WAITING", result: { expanded: cles.length, keys: cles } as never },
  });
  await journaliser(etat.id, "FANOUT",
    `« ${step.title} » déployée en ${cles.length} étapes individuelles.`,
    { stepKey: step.key, count: cles.length });

  return cles.length;
}

/**
 * FERME LES ÉVENTAILS DONT TOUTES LES FILLES SONT TERMINÉES.
 *
 * Le modèle attend ; quand plus rien ne bouge, on regarde s'il peut conclure. Il conclut en
 * ÉCHEC si une fille a échoué définitivement — sinon un envoi manquant sur trente-trois
 * passerait pour un succès, ce qui est précisément ce que le §22 interdit.
 */
async function resoudreEventails(etat: EtatMission): Promise<number> {
  let resolus = 0;
  for (const step of etat.steps) {
    if (step.status !== "WAITING") continue;
    const r = step.result as { keys?: unknown } | null;
    const cles = Array.isArray(r?.keys) ? (r!.keys as unknown[]).filter((k): k is string => typeof k === "string") : [];
    if (cles.length === 0) continue;

    const filles = etat.steps.filter((s) => cles.includes(s.key));
    // « RÉGLÉE » N'EST PAS « TERMINÉE ». Une fille en échec définitif ne reviendra jamais : si on
    // exigeait qu'elle finisse bien, le modèle attendrait pour toujours et la mission se
    // figerait sur un envoi raté. On ferme donc sur l'épuisement des tentatives — et on ferme en
    // ÉCHEC, ce qui est précisément la différence entre « fini » et « réussi » (§22).
    const reglee = (f: typeof filles[number]) => STEP_TERMINAL.has(f.status)
      || (f.status === "FAILED" && f.attempt >= f.maxAttempts);
    if (filles.length === 0 || !filles.every(reglee)) continue;

    const echecs = filles.filter((f) => f.status === "FAILED");
    const faites = filles.filter((f) => f.status === "DONE").length;

    await prisma.missionStep.update({
      where: { id: step.id },
      data: {
        status: echecs.length > 0 ? "FAILED" : "DONE",
        attempt: step.maxAttempts,
        completedAt: new Date(),
        result: { expanded: cles.length, done: faites, failed: echecs.length, keys: cles } as never,
        ...(echecs.length > 0
          ? { error: `${echecs.length} itération(s) sur ${cles.length} en échec.`, errorKind: "PARTIAL_FANOUT" }
          : {}),
      },
    });
    await journaliser(etat.id, echecs.length > 0 ? "FANOUT_PARTIAL" : "FANOUT_DONE",
      `« ${step.title} » : ${faites}/${cles.length} itérations réussies.`,
      { stepKey: step.key, done: faites, failed: echecs.length });
    resolus += 1;
  }
  return resolus;
}

/** Recale l'état de la mission sur celui de ses étapes — la déduction fait foi (§37). */
async function synchroniserEtat(missionId: string, etat: EtatMission): Promise<MissionState> {
  const deduit = deduireEtat(etat.steps.map((s) => ({
    status: s.status, nodeType: s.nodeType, attempt: s.attempt, maxAttempts: s.maxAttempts,
  })));
  if (deduit !== etat.status) await transitionner(missionId, deduit);
  return deduit;
}

/**
 * UNE CARTE PARALLÈLE BORNÉE.
 *
 * `Promise.all` sur trente-trois envois saturerait le fournisseur et ferait échouer par
 * limitation de débit ce qui aurait réussi en trois vagues. La borne est OPÉRATIONNELLE : elle
 * ne dit rien de la taille des missions, seulement de la vitesse à laquelle on les mène (§4).
 */
async function enParallele<T, R>(
  items: readonly T[],
  concurrence: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let curseur = 0;
  const largeur = Math.max(1, Math.min(concurrence, items.length));
  await Promise.all(Array.from({ length: largeur }, async () => {
    for (;;) {
      const i = curseur++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}
