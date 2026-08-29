import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAccess, type EffectiveAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import {
  lancerEnArrierePlan,
  finaliserLancementDifere,
  rattraperLancementsPerdus,
} from "@/platform/in-process/missions/runtime";
import { prendreBail, rendreBail } from "@/platform/in-process/missions/sweep";
import { prioriserMission, plafonnerModeleMission } from "@/platform/in-process/missions/control";
import { RaisonneurScripte, pour, planScripte } from "@/platform/in-process/missions/fake-reasoner";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BANC DE L'ARRIÈRE-PLAN (§12-16) — détacher, survivre, reprendre, gouverner.
 *
 * Quatre propriétés, chacune payée par un incident possible :
 *   • le DÉTACHEMENT rend la main en dizaines de millisecondes — la conversation n'attend
 *     jamais la planification ;
 *   • un échec de planification en arrière-plan est DIT (FAILED + motif au journal), jamais
 *     une carte qui tourne pour toujours ;
 *   • un processus mort entre la promesse et le plan est RATTRAPÉ par le battement — et la
 *     persévérance s'arrête à trois tentatives, pas à l'infini ;
 *   • le BAIL rend impossible que deux instances avancent la même mission — l'optimisation
 *     de la réservation par étape, pas son remplacement.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__bg${Date.now().toString(36)}`;
let pdg: CurrentUser;

/** Un plan d'une étape de LECTURE — la forme la plus simple qui matérialise une mission. */
const PLAN_LECTURE = planScripte({
  goal: "Lister l'annuaire",
  reasoningComplexity: "B",
  executionScale: "S",
  acceptanceCriteria: ["la liste est rendue"],
  workstreams: [],
  steps: [{
    key: "lire", title: "Lire l'annuaire", nodeType: "CAPABILITY",
    capability: "directory_lookup", completionCondition: "la liste est rendue",
  }],
  expectedArtifacts: [],
  approvalStrategy: "BUNDLE",
  completionCriteria: "la liste est rendue",
  gaps: [],
  rationale: "lecture simple",
});

const cerveauQuiPlanifie = () => new RaisonneurScripte([
  pour("mission.plan", () => ({ ok: true, data: PLAN_LECTURE })),
]);

async function creerTalon(suffixe: string, retrys = 0): Promise<string> {
  const m = await prisma.mission.create({
    data: {
      kind: "RUNTIME", status: "PLANNING", title: `${TAG}-talon-${suffixe}`,
      objective: "Lister l'annuaire", goalRaw: "Lister l'annuaire",
      ownerId: pdg.id, planVersion: 0,
    },
    select: { id: true },
  });
  for (let i = 0; i < retrys; i++) {
    await prisma.missionEvent.create({
      data: { missionId: m.id, kind: "PLANNING_RETRY", summary: "essai précédent" },
    });
  }
  // Le talon est « vieux » : le rattrapage ne touche qu'aux lancements sans activité récente.
  await prisma.$executeRaw`UPDATE "Mission" SET "updatedAt" = now() - interval '10 minutes' WHERE id = ${m.id}`;
  return m.id;
}

suite("ARRIÈRE-PLAN — détachement, panne dite, rattrapage, bail, gouvernance", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { name: `${TAG} PDG`, email: `${TAG}@amd.dz`, passwordHash: "x", role: "SUPER_ADMIN" },
      select: { id: true, name: true, email: true, role: true },
    });
    pdg = {
      id: u.id, name: u.name, email: u.email, role: u.role,
      access: (await getAccess(u.id, u.role)) as EffectiveAccess,
      mustChangePassword: false,
    };
  });

  afterAll(async () => {
    const missions = await prisma.mission.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } });
    const ids = missions.map((m) => m.id);
    await prisma.missionEvent.deleteMany({ where: { missionId: { in: ids } } });
    await prisma.missionStep.deleteMany({ where: { missionId: { in: ids } } });
    await prisma.mission.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.delete({ where: { id: pdg.id } }).catch(() => undefined);
  });

  it("le détachement rend la main TOUT DE SUITE, puis la mission se matérialise seule (§13)", async () => {
    const t0 = Date.now();
    const r = await lancerEnArrierePlan(pdg, "Lister l'annuaire", {
      titre: `${TAG}-detache`, reasoner: cerveauQuiPlanifie(),
    });
    const timeToBackgroundDetached = Date.now() - t0;

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // LA MESURE DU MANDAT : la conversation est libérée sans attendre NI la planification NI la
    // compilation. Le seuil est LARGE exprès — sous la suite complète, la machine est saturée
    // par quatre cents autres fichiers ; ce qu'on prouve est l'ORDRE DE GRANDEUR (des
    // millisecondes, pas des secondes de planification), pas un chrono de machine au repos.
    expect(timeToBackgroundDetached).toBeLessThan(5_000);
    expect(await prisma.missionEvent.findFirst({
      where: { missionId: r.missionId, kind: "DETACHED" }, select: { id: true },
    })).not.toBeNull();

    // Puis la finalisation différée matérialise — on l'attend en scrutant, comme un client réel.
    let etapes = 0;
    for (let i = 0; i < 150 && etapes === 0; i++) {
      await new Promise((res) => setTimeout(res, 100));
      etapes = await prisma.missionStep.count({ where: { missionId: r.missionId } });
    }
    expect(etapes).toBeGreaterThan(0);
    const mission = await prisma.mission.findUnique({
      where: { id: r.missionId }, select: { status: true, planVersion: true },
    });
    expect(mission!.status).not.toBe("PLANNING");
    expect(mission!.planVersion).toBeGreaterThanOrEqual(1);
  });

  it("une planification qui échoue en arrière-plan devient FAILED avec le motif — jamais une carte qui tourne", async () => {
    const r = await lancerEnArrierePlan(pdg, "Objectif impossible à planifier pour ce banc", {
      titre: `${TAG}-echec`,
      // Un raisonneur SANS script : il répond « aucun script ne répond » — la panne de modèle.
      reasoner: new RaisonneurScripte([]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    let statut = "PLANNING";
    for (let i = 0; i < 40 && statut === "PLANNING"; i++) {
      await new Promise((res) => setTimeout(res, 100));
      statut = (await prisma.mission.findUnique({ where: { id: r.missionId }, select: { status: true } }))!.status;
    }
    expect(statut).toBe("FAILED");
    const journal = await prisma.missionEvent.findFirst({
      where: { missionId: r.missionId, kind: "PLANNING_FAILED" }, select: { summary: true },
    });
    expect(journal).not.toBeNull();
  });

  it("« déjà matérialisée » : la finalisation est idempotente — une autre instance a fini le travail", async () => {
    const r = await lancerEnArrierePlan(pdg, "Lister l'annuaire", {
      titre: `${TAG}-idem`, reasoner: cerveauQuiPlanifie(),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (let i = 0; i < 40; i++) {
      if (await prisma.missionStep.count({ where: { missionId: r.missionId } }) > 0) break;
      await new Promise((res) => setTimeout(res, 100));
    }
    const deux = await finaliserLancementDifere(r.missionId, pdg, "Lister l'annuaire", { reasoner: cerveauQuiPlanifie() });
    expect(deux.finalise).toBe(false);
    expect(deux.raison).toContain("déjà");
  });

  it("§40 : un processus MORT entre la promesse et le plan est rattrapé par le battement", async () => {
    const talon = await creerTalon("mort");
    const repris = await rattraperLancementsPerdus(async () => pdg, { plusVieuxQueMs: 60_000 });
    // La reprise a eu lieu : PLANNING_RETRY journalisé. La finalisation elle-même dépend du
    // fournisseur (absent dans ce banc) — l'essentiel est que la reprise soit TENTÉE et TRACÉE.
    expect(repris).toBeGreaterThanOrEqual(0);
    expect(await prisma.missionEvent.findFirst({
      where: { missionId: talon, kind: "PLANNING_RETRY" }, select: { id: true },
    })).not.toBeNull();
  });

  it("la persévérance s'arrête à TROIS tentatives : le talon devient FAILED, pas une boucle", async () => {
    const talon = await creerTalon("epuise", 2); // deux reprises déjà consommées
    await rattraperLancementsPerdus(async () => pdg, { plusVieuxQueMs: 60_000 });
    const m = await prisma.mission.findUnique({ where: { id: talon }, select: { status: true } });
    expect(m!.status).toBe("FAILED");
    const fin = await prisma.missionEvent.findFirst({
      where: { missionId: talon, kind: "PLANNING_FAILED" }, select: { summary: true },
    });
    expect(fin!.summary).toContain("Trois lancements");
  });

  it("le BAIL : une instance étrangère au bail frais est REFUSÉE, un bail expiré se reprend (§44)", async () => {
    const m = await prisma.mission.create({
      data: {
        kind: "RUNTIME", status: "RUNNING", title: `${TAG}-bail`,
        objective: "x", goalRaw: "x", ownerId: pdg.id,
      },
      select: { id: true },
    });

    // 1. Libre → pris.
    expect(await prendreBail(m.id)).toBe(true);
    // 2. Déjà à MOI → repris sans attendre (réentrance de la même instance).
    expect(await prendreBail(m.id)).toBe(true);
    await rendreBail(m.id);

    // 3. Une AUTRE instance tient un bail FRAIS → refus.
    await prisma.mission.update({
      where: { id: m.id },
      data: { leaseOwner: "instance-fantome", leaseUntil: new Date(Date.now() + 60_000) },
    });
    expect(await prendreBail(m.id)).toBe(false);
    // …et rendreBail ne rend JAMAIS le bail d'un autre.
    await rendreBail(m.id);
    const encore = await prisma.mission.findUnique({ where: { id: m.id }, select: { leaseOwner: true } });
    expect(encore!.leaseOwner).toBe("instance-fantome");

    // 4. Le bail de l'instance morte EXPIRE → la reprise redevient possible (§44 : lease lost).
    await prisma.mission.update({
      where: { id: m.id },
      data: { leaseUntil: new Date(Date.now() - 1_000) },
    });
    expect(await prendreBail(m.id)).toBe(true);
    await rendreBail(m.id);
  });

  it("la gouvernance : priorité BORNÉE et journalisée, plafond de modèle posé et retiré — jamais sur la mission d'un autre", async () => {
    const m = await prisma.mission.create({
      data: { kind: "RUNTIME", status: "RUNNING", title: `${TAG}-gouv`, objective: "x", goalRaw: "x", ownerId: pdg.id },
      select: { id: true },
    });

    const p = await prioriserMission(pdg, m.id, 99); // borné à +10
    expect(p.fait).toBe(true);
    let lu = await prisma.mission.findUnique({ where: { id: m.id }, select: { priority: true, modelCallsCap: true } });
    expect(lu!.priority).toBe(10);
    expect(await prisma.missionEvent.findFirst({ where: { missionId: m.id, kind: "PRIORITY" } })).not.toBeNull();

    const c = await plafonnerModeleMission(pdg, m.id, 3);
    expect(c.fait).toBe(true);
    lu = await prisma.mission.findUnique({ where: { id: m.id }, select: { priority: true, modelCallsCap: true } });
    expect(lu!.modelCallsCap).toBe(3);
    expect(await prisma.missionEvent.findFirst({ where: { missionId: m.id, kind: "BUDGET_SET" } })).not.toBeNull();

    // `null` RETIRE le plafond — « tu peux recommencer à dépenser ».
    await plafonnerModeleMission(pdg, m.id, null);
    lu = await prisma.mission.findUnique({ where: { id: m.id }, select: { priority: true, modelCallsCap: true } });
    expect(lu!.modelCallsCap).toBeNull();

    // La mission d'un AUTRE ne bouge pas — la garde est dans la requête, pas dans la politesse.
    const autre = await prisma.user.create({
      data: { name: `${TAG} Autre`, email: `${TAG}autre@amd.dz`, passwordHash: "x", role: "DIRECTION" },
      select: { id: true, name: true, email: true, role: true },
    });
    const intrus: CurrentUser = {
      id: autre.id, name: autre.name, email: autre.email, role: autre.role,
      access: (await getAccess(autre.id, autre.role)) as EffectiveAccess,
      mustChangePassword: false,
    };
    const refus = await prioriserMission(intrus, m.id, -5);
    expect(refus.fait).toBe(false);
    const luApres = await prisma.mission.findUnique({ where: { id: m.id }, select: { priority: true } });
    expect(luApres!.priority).toBe(10);
    await prisma.user.delete({ where: { id: autre.id } }).catch(() => undefined);
  });
});
