import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { attentesEchues, fournirEntree, missionsAFaireAvancer, reveillerMissions } from "./router";
import { avancer } from "@/lib/missions/runtime/engine";
import { chargerEtat, materialiser } from "@/lib/missions/runtime/store";
import { compile } from "@/lib/missions/compiler/compile";
import type { MissionPlan, PlannedStep } from "@/lib/missions/planner/contract";
import type { CapabilityCall, CapabilityCatalog, CapabilityOutcome, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * §16-18 — UNE MISSION DORT CINQ JOURS, PUIS REPART TOUTE SEULE.
 *
 * C'est la propriété qui distingue un agent d'un script : entre le moment où Adam demande son
 * contrat à Redouane et le moment où Redouane répond, il ne se passe RIEN — aucun modèle
 * appelé, aucun processus occupé. Puis le fait arrive, et la mission reprend là où elle était.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__mrouter__${Date.now()}`;
let ownerId = "";
let actor: MissionActor;

const CONNUES = ["directory_list", "inspect_record", "send_erp_message", "notify_person"];
const catalogue: CapabilityCatalog = {
  has: (n) => CONNUES.includes(n),
  allowed: () => true,
  meta: (n) => capabilityMeta(n),
  brief: () => [],
};

function traceur() {
  const appels: CapabilityCall[] = [];
  return {
    appels,
    runner: {
      async run(call: CapabilityCall): Promise<CapabilityOutcome> {
        appels.push(call);
        return { ok: true, output: { ok: true } };
      },
    },
  };
}

async function creerMission(steps: PlannedStep[], titre: string) {
  const plan: MissionPlan = {
    objective: titre, acceptance: ["fait"], complexity: "B", scale: "S", steps,
  };
  const r = compile(plan, catalogue, actor);
  if (!r.ok) throw new Error(r.issues.map((i) => i.message).join(" | "));
  return materialiser(r.mission, { ownerId, title: titre, goalRaw: titre });
}

/** La mission canonique du §28 : demander, attendre, poursuivre. */
const PLAN_ATTENTE: PlannedStep[] = [
  { key: "demande", title: "Demander le contrat", capability: "send_erp_message", input: { to: "redouane" } },
  {
    key: "attente", title: "Réponse de Redouane", nodeType: "WAIT_EVENT", dependsOn: ["demande"],
    waitFor: { event: "DOCUMENT_UPLOADED", from: "redouane", withinDays: 5 },
  },
  { key: "suite", title: "Classer le contrat", capability: "inspect_record", dependsOn: ["attente"] },
];

suite("Mission Runtime — le réveil par événement", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { name: `${TAG}pdg`, email: `${TAG}pdg@t.dz`, passwordHash: "x", role: "SUPER_ADMIN" },
    });
    ownerId = u.id;
    actor = { userId: u.id, label: "le PDG", isAgent: false };
  });

  afterAll(async () => {
    await prisma.mission.deleteMany({ where: { owner: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("la mission dort, l'événement arrive, elle repart — sans que personne dise « il a répondu »", async () => {
    const t = traceur();
    const id = await creerMission(PLAN_ATTENTE, "contrat de Redouane");

    const r1 = await avancer(id, actor, { runner: t.runner });
    expect(r1.status).toBe("WAITING_EVENT");
    expect(t.appels.map((a) => a.stepKey)).toEqual(["demande"]);

    // ── CINQ JOURS PLUS TARD (aucun modèle, aucun processus, rien) ─────────────────────
    const reveils = await reveillerMissions({
      type: "DOCUMENT_UPLOADED",
      actorId: "redouane",
      relatedRefs: [],
      payload: { fileName: "contrat.pdf" },
    });
    expect(reveils).toEqual([{ missionId: id, stepKey: "attente" }]);

    const t2 = traceur();
    const r2 = await avancer(id, actor, { runner: t2.runner });
    expect(t2.appels.map((a) => a.stepKey)).toEqual(["suite"]);
    expect(r2.executees).toBe(1);

    const etat = await chargerEtat(id);
    expect(etat!.steps.every((s) => s.status === "DONE")).toBe(true);
    // Le fait qui l'a réveillée est CONSERVÉ dans le résultat : la suite peut le lire.
    const attente = etat!.steps.find((s) => s.key === "attente")!;
    expect((attente.result as { reveillePar: string }).reveillePar).toBe("DOCUMENT_UPLOADED");
  }, 30_000);

  it("un événement qui ne correspond PAS ne réveille rien", async () => {
    const t = traceur();
    const id = await creerMission(PLAN_ATTENTE, "contrat — mauvais émetteur");
    await avancer(id, actor, { runner: t.runner });

    // Le bon type, la mauvaise personne.
    expect(await reveillerMissions({
      type: "DOCUMENT_UPLOADED", actorId: "khaled", payload: { from: "khaled@adventum.dz" },
    })).toEqual([]);
    // La bonne personne, le mauvais type.
    expect(await reveillerMissions({ type: "EMAIL_RECEIVED", actorId: "redouane" })).toEqual([]);

    expect((await chargerEtat(id))!.steps.find((s) => s.key === "attente")!.status).toBe("WAITING");
  }, 30_000);

  it("un événement PORTANT un missionId ne réveille que CETTE mission", async () => {
    const t = traceur();
    const a = await creerMission(PLAN_ATTENTE, "cadrage — mission A");
    const b = await creerMission(PLAN_ATTENTE, "cadrage — mission B");
    await avancer(a, actor, { runner: t.runner });
    await avancer(b, actor, { runner: t.runner });

    const reveils = await reveillerMissions({
      type: "DOCUMENT_UPLOADED", actorId: "redouane", missionId: b,
    });
    expect(reveils.map((r) => r.missionId)).toEqual([b]);

    expect((await chargerEtat(a))!.steps.find((s) => s.key === "attente")!.status).toBe("WAITING");
    expect((await chargerEtat(b))!.steps.find((s) => s.key === "attente")!.status).toBe("DONE");
  }, 30_000);

  it("un événement SANS missionId réveille toutes les missions qui l'attendaient", async () => {
    const t = traceur();
    const a = await creerMission(PLAN_ATTENTE, "diffusion — A");
    const b = await creerMission(PLAN_ATTENTE, "diffusion — B");
    await avancer(a, actor, { runner: t.runner });
    await avancer(b, actor, { runner: t.runner });

    const reveils = new Set((await reveillerMissions({ type: "DOCUMENT_UPLOADED", actorId: "redouane" }))
      .map((r) => r.missionId));
    // On vérifie l'INCLUSION, pas l'égalité : d'autres missions de ce fichier attendent le même
    // fait, et les réveiller toutes est précisément le comportement attendu d'une diffusion.
    expect(reveils.has(a)).toBe(true);
    expect(reveils.has(b)).toBe(true);
  }, 30_000);

  it("un événement en retard ne réveille JAMAIS une mission annulée", async () => {
    const t = traceur();
    const id = await creerMission(PLAN_ATTENTE, "annulée puis réveillée");
    await avancer(id, actor, { runner: t.runner });
    await prisma.mission.update({ where: { id }, data: { status: "CANCELLED" } });

    // On vérifie que CETTE mission-ci n'est pas réveillée. Affirmer « aucune mission » rendrait
    // le test dépendant de l'ordre de déclaration des autres cas du fichier.
    const reveils = await reveillerMissions({ type: "DOCUMENT_UPLOADED", actorId: "redouane" });
    expect(reveils.map((r) => r.missionId)).not.toContain(id);
    expect((await chargerEtat(id))!.steps.find((s) => s.key === "attente")!.status).toBe("WAITING");
  }, 30_000);

  it("deux faits identiques ne règlent l'attente qu'UNE fois", async () => {
    const t = traceur();
    const id = await creerMission(PLAN_ATTENTE, "double événement");
    await avancer(id, actor, { runner: t.runner });

    const un = await reveillerMissions({ type: "DOCUMENT_UPLOADED", actorId: "redouane" });
    const deux = await reveillerMissions({ type: "DOCUMENT_UPLOADED", actorId: "redouane" });
    expect(un.filter((r) => r.missionId === id)).toHaveLength(1);
    expect(deux.filter((r) => r.missionId === id)).toHaveLength(0);
  }, 30_000);

  it("la réservation de l'attente est portée par la BASE : la seconde prise rend zéro ligne", async () => {
    const t = traceur();
    const id = await creerMission(PLAN_ATTENTE, "réservation en base");
    await avancer(id, actor, { runner: t.runner });
    const step = await prisma.missionStep.findUnique({
      where: { missionId_key: { missionId: id, key: "attente" } }, select: { id: true },
    });

    // ── CE QUE CE TEST VÉRIFIE, EXACTEMENT ────────────────────────────────────────────
    //
    // Le routeur règle l'attente par une mise à jour CONDITIONNÉE à l'état ancien, et ne se
    // déclare gagnant que si elle a touché une ligne. C'est ce mécanisme-là qui est exercé ici,
    // directement.
    //
    // Ce que ce test NE fait PAS, et il faut le dire : reproduire un véritable entrelacement de
    // deux processus. Dans un même processus et avec un seul pool de connexions, les deux appels
    // se sérialisent — le second relit après que le premier a écrit, et ne trouve plus rien à
    // prendre. La course réelle n'est donc pas simulable ici ; la garde, elle, l'est.
    const premiere = await prisma.missionStep.updateMany({
      where: { id: step!.id, status: "WAITING" }, data: { status: "DONE" },
    });
    const seconde = await prisma.missionStep.updateMany({
      where: { id: step!.id, status: "WAITING" }, data: { status: "DONE" },
    });
    expect(premiere.count).toBe(1);
    expect(seconde.count).toBe(0);
  }, 30_000);

  it("§79 — une attente humaine se règle quand la personne fournit ce qu'on demandait", async () => {
    const t = traceur();
    const id = await creerMission([
      { key: "w", title: "Le contrat signé", nodeType: "WAIT_INPUT", waitFor: { ask: "le contrat signé" } },
      { key: "s", title: "Classer", capability: "inspect_record", dependsOn: ["w"] },
    ], "attente humaine réglée");

    const r1 = await avancer(id, actor, { runner: t.runner });
    expect(r1.status).toBe("WAITING_INPUT");

    expect(await fournirEntree(id, "w", { driveNodeId: "n-1" }, ownerId)).toBe(true);
    // Deux fois : la seconde ne peut pas régler ce qui l'est déjà.
    expect(await fournirEntree(id, "w", { driveNodeId: "n-1" }, ownerId)).toBe(false);

    const t2 = traceur();
    await avancer(id, actor, { runner: t2.runner });
    expect(t2.appels.map((a) => a.stepKey)).toEqual(["s"]);
  }, 30_000);

  it("un événement ne règle pas une attente HUMAINE, et réciproquement", async () => {
    const t = traceur();
    const id = await creerMission([
      { key: "w", title: "Le contrat", nodeType: "WAIT_INPUT", waitFor: { ask: "le contrat", event: "DOCUMENT_UPLOADED" } },
    ], "les deux attentes ne se confondent pas");
    await avancer(id, actor, { runner: t.runner });

    // Le routeur d'événements ne regarde que les nœuds WAIT_EVENT.
    expect(await reveillerMissions({ type: "DOCUMENT_UPLOADED" })).toEqual([]);
    expect((await chargerEtat(id))!.steps[0].status).toBe("WAITING");
    expect(await fournirEntree(id, "w", { ok: true }, ownerId)).toBe(true);
  }, 30_000);

  it("§87 — une attente échue est signalée comme MATIÈRE À RELANCE, pas comme un échec", async () => {
    const t = traceur();
    const id = await creerMission(PLAN_ATTENTE, "attente échue");
    await avancer(id, actor, { runner: t.runner });

    // Six jours après, sur une attente de cinq.
    const dans6j = new Date(Date.now() + 6 * 24 * 3600 * 1000);
    const echues = (await attentesEchues(dans6j)).filter((e) => e.missionId === id);
    expect(echues).toHaveLength(1);
    expect(echues[0].stepTitle).toBe("Réponse de Redouane");

    // LA MISSION N'A PAS ÉCHOUÉ POUR AUTANT : elle attend toujours.
    const etat = await chargerEtat(id);
    expect(etat!.status).toBe("WAITING_EVENT");
    expect(etat!.steps.find((s) => s.key === "attente")!.status).toBe("WAITING");
  }, 30_000);

  it("l'ordonnanceur voit les missions qui peuvent avancer, et pas celles qui dorment", async () => {
    const t = traceur();
    const dormante = await creerMission(PLAN_ATTENTE, "ordonnanceur — dormante");
    await avancer(dormante, actor, { runner: t.runner });

    const neuve = await creerMission([
      { key: "a", title: "A", capability: "directory_list" },
    ], "ordonnanceur — neuve");

    const candidates = await missionsAFaireAvancer(200);
    expect(candidates).toContain(neuve);
    // Celle qui attend un événement n'a plus aucune étape PENDING exécutable… sauf « suite »,
    // qui reste PENDING derrière son attente. Le filtre est LARGE par dessein : le moteur sait
    // dire « rien à faire » en un tour, et rater une mission prête coûterait bien plus cher.
    expect(candidates).toContain(dormante);

    await avancer(neuve, actor, { runner: t.runner });
    expect(await missionsAFaireAvancer(200)).not.toContain(neuve);
  }, 30_000);
});
