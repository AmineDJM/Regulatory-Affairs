import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MAIN HUMAINE SUR UNE MISSION — depuis les VRAIES actions serveur.
 *
 * ── CE QUI TOURNE POUR DE VRAI ─────────────────────────────────────────────────────────
 *
 * `lancerMission` crée une vraie mission (résolveur, plan reconstruit, compilateur, base), et
 * ce sont ensuite les fonctions que l'écran appelle — `listerAccordsMission`,
 * `deciderAccordMission`, `fournirElementMission`, `mettreMissionEnPause`, `reprendreMission`,
 * `arreterMission` — qui la font vivre. En dessous : la porte d'approbation, le moteur,
 * l'éventail, le chemin canonique (RBAC, intent, clé d'idempotence, reçu) et la messagerie ERP.
 *
 * ── CE QUI EST SUBSTITUÉ, ET RIEN D'AUTRE ──────────────────────────────────────────────
 *
 *   la SESSION — remplacée comme partout ailleurs dans les bancs d'actions serveur ; c'est ce
 *   qui permet d'appeler `requireUser()` hors d'une requête HTTP, et le reste de l'action, y
 *   compris le contrôle de droit et le cloisonnement, tourne tel quel ;
 *
 *   le SAUT RÉSEAU vers le fournisseur de modèle, par le raisonneur scripté, qui valide chaque
 *   réponse contre le schéma réellement demandé.
 *
 * ── LA QUESTION À LAQUELLE CE FICHIER RÉPOND ───────────────────────────────────────────
 *
 * « Si quelqu'un utilise Adam normalement maintenant, peut-il vraiment autoriser, fournir,
 * suspendre, reprendre et arrêter une mission ? » Avant ce lot, la réponse était non : les
 * fonctions existaient et personne ne pouvait les atteindre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTEUR: CurrentUser;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTEUR }));

const { prisma } = await import("@/lib/prisma");
const { getAccess } = await import("@/lib/rbac");
const { lancerMission } = await import("@/platform/in-process/missions/runtime");
const { RaisonneurScripte, pour } = await import("@/platform/in-process/missions/fake-reasoner");
const { missionsAFaireAvancer } = await import("@/lib/missions/events/router");
const { vueMission } = await import("@/lib/missions/view/workspace");
const { compile } = await import("@/lib/missions/compiler/compile");
const { capabilityMeta } = await import("@/lib/missions/registry/capability-meta");
const {
  arreterMission, deciderAccordMission, fournirElementMission,
  listerAccordsMission, mettreMissionEnPause, reprendreMission,
} = await import("@/lib/actions/mission-runtime-actions");

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__mctl${Date.now()}`;
const SALARIES = ["Nadia Amrani", "Sofiane Bellil", "Lynda Cheriet"];

let pdg: CurrentUser;
let autre: CurrentUser;
let companyId = "";

/** Le plan brut, tel qu'un fournisseur en mode strict le rendrait. */
function planBrut() {
  return {
    goal: "Écrire à chaque salarié du service, puis me demander la pièce manquante.",
    reasoningComplexity: "B",
    executionScale: "S",
    acceptanceCriteria: [
      "Chaque salarié du service a reçu son message.",
      "La pièce demandée a été fournie.",
    ],
    workstreams: [],
    steps: [
      {
        key: "liste", title: "Lister le service", workstream: null,
        nodeType: "CAPABILITY", capability: "directory_list",
        inputs: [
          { key: "department", kind: "TEXT", value: TAG },
          { key: "limit", kind: "NUMBER", value: "20" },
        ],
        dependsOn: [], forEachFrom: null, forEachPath: null, forEachAs: null,
        waitEvent: null, waitFrom: null, waitEntity: null, waitAsk: null, waitWithinDays: null,
        outputFields: [],
        completionCondition: "La liste est chargée.",
        reasoningRequirement: "NONE", approvalRequirement: "NONE", maxAttempts: null,
      },
      {
        key: "accord", title: "Votre accord pour écrire à tout le service", workstream: null,
        nodeType: "APPROVAL", capability: null, inputs: [],
        dependsOn: ["liste"], forEachFrom: null, forEachPath: null, forEachAs: null,
        waitEvent: null, waitFrom: null, waitEntity: null, waitAsk: null, waitWithinDays: null,
        outputFields: [],
        completionCondition: "L'accord est donné.",
        reasoningRequirement: "NONE", approvalRequirement: "NORMAL", maxAttempts: null,
      },
      {
        key: "message", title: "Message individuel", workstream: null,
        nodeType: "CAPABILITY", capability: "send_message",
        inputs: [
          { key: "recipientName", kind: "TEXT", value: "{{p.nom}}" },
          { key: "body", kind: "TEXT", value: "Bonjour {{p.nom}}, un point rapide sur le service." },
        ],
        dependsOn: ["accord"],
        forEachFrom: "liste", forEachPath: "salaries", forEachAs: "p",
        waitEvent: null, waitFrom: null, waitEntity: null, waitAsk: null, waitWithinDays: null,
        outputFields: [],
        completionCondition: "Un message par personne.",
        reasoningRequirement: "NONE", approvalRequirement: "NORMAL", maxAttempts: null,
      },
      {
        key: "piece", title: "La référence du marché", workstream: null,
        nodeType: "WAIT_INPUT", capability: null, inputs: [],
        dependsOn: ["message"], forEachFrom: null, forEachPath: null, forEachAs: null,
        waitEvent: null, waitFrom: null, waitEntity: null,
        waitAsk: "Quelle est la référence du marché concerné ?", waitWithinDays: 5,
        outputFields: [],
        completionCondition: "La référence est fournie.",
        reasoningRequirement: "NONE", approvalRequirement: "NONE", maxAttempts: null,
      },
    ],
    expectedArtifacts: [],
    approvalStrategy: "BUNDLE",
    completionCriteria: "Un message par salarié, et la référence reçue.",
    gaps: [],
    rationale: "Lire, demander un accord, écrire, puis demander la pièce.",
  };
}

const cerveau = () => new RaisonneurScripte([pour("mission.plan", () => ({ ok: true, data: planBrut() }))]);

async function lancer(): Promise<string> {
  const r = await lancerMission(pdg, "Écris à chaque salarié du service puis demande-moi la référence.", {
    titre: `${TAG} mission`,
    reasoner: cerveau(),
  });
  if (!r.ok) throw new Error(`la mission n'a pas été lancée : ${r.error} ${JSON.stringify(r.refus ?? [])}`);
  return r.missionId!;
}

suite("LA MAIN HUMAINE SUR UNE MISSION — accord, élément, pause, reprise, arrêt", () => {
  beforeAll(async () => {
    const c = await prisma.company.create({
      data: { name: `${TAG} Pharma`, shortName: TAG.slice(0, 12) }, select: { id: true },
    });
    companyId = c.id;

    const mk = async (nom: string, email: string, role: "SUPER_ADMIN" | "SALES_USER") => {
      const u = await prisma.user.create({
        data: { name: nom, email, passwordHash: "x", role },
        select: { id: true, name: true, email: true, role: true },
      });
      return {
        id: u.id, name: u.name, email: u.email, role: u.role,
        access: await getAccess(u.id, u.role), mustChangePassword: false,
      } as CurrentUser;
    };

    pdg = await mk(`${TAG} PDG`, `${TAG}pdg@amd.dz`, "SUPER_ADMIN");
    autre = await mk(`${TAG} Autre`, `${TAG}autre@amd.dz`, "SUPER_ADMIN");
    ACTEUR = pdg;

    for (const [i, nom] of SALARIES.entries()) {
      const compte = await prisma.user.create({
        data: { name: nom, email: `${TAG}${i}@amd.dz`, passwordHash: "x", role: "SALES_USER" },
        select: { id: true },
      });
      await prisma.employee.create({
        data: {
          fullName: nom, email: `${TAG}${i}@amd.dz`, position: "Délégué",
          department: TAG, isActive: true, companyId, userId: compte.id,
        },
      });
    }
  }, 180_000);

  afterAll(async () => {
    await prisma.mission.deleteMany({ where: { owner: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    await prisma.assistantActionIntent.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
  }, 180_000);

  it("§33-38 — l'accord se DONNE depuis l'écran, et la mission repart vraiment", async () => {
    ACTEUR = pdg;
    const missionId = await lancer();

    // AVANT : la mission attend, et l'écran le dit.
    const avant = await vueMission(missionId, pdg.id);
    expect(avant!.statut).toBe("AWAITING_APPROVAL");
    expect(avant!.attente?.nodeType).toBe("APPROVAL");

    // L'ÉCRAN LISTE CE QUI ATTEND CETTE PERSONNE — le vrai appel, sans identifiant en paramètre.
    const accords = await listerAccordsMission();
    const mien = accords.find((a) => a.missionId === missionId);
    expect(mien, "l'accord demandé doit apparaître dans la liste de son propriétaire").toBeTruthy();
    expect(mien!.etapes.length).toBeGreaterThan(0);

    // LE CLIC.
    const r = await deciderAccordMission(mien!.id, "GRANTED");
    expect(r.ok, r.message).toBe(true);

    // ET L'EFFET RÉEL : trois messages, un par personne, dans la vraie messagerie.
    const messages = await prisma.message.count({
      where: { senderId: pdg.id, conversation: { members: { some: { user: { email: { startsWith: TAG } } } } } },
    });
    expect(messages, "un message par salarié du service").toBe(SALARIES.length);

    const apres = await vueMission(missionId, pdg.id);
    expect(apres!.statut, "après l'accord, la mission avance jusqu'à l'attente humaine").toBe("WAITING_INPUT");
    expect(apres!.attente?.nodeType).toBe("WAIT_INPUT");
  }, 300_000);

  it("§68 — deux clics sur le même bouton ne décident pas deux fois", async () => {
    ACTEUR = pdg;
    const missionId = await lancer();
    const mien = (await listerAccordsMission()).find((a) => a.missionId === missionId)!;

    const [a, b] = [
      await deciderAccordMission(mien.id, "GRANTED"),
      await deciderAccordMission(mien.id, "GRANTED"),
    ];
    expect(a.ok).toBe(true);
    // Le second ne trouve plus l'accord dans la liste des EN ATTENTE : c'est le comportement
    // voulu, et il est annoncé sans alarmer — la décision est bien enregistrée.
    expect(b.ok).toBe(false);
    expect(b.message).toMatch(/n'est plus en attente/);

    // ET SURTOUT : une seule décision en base, avec un seul auteur.
    const decisions = await prisma.missionApproval.findMany({
      where: { missionId }, select: { status: true, decidedById: true },
    });
    expect(decisions.filter((d) => d.status === "GRANTED").length).toBe(1);
    expect(decisions[0].decidedById).toBe(pdg.id);
  }, 300_000);

  it("LE CLOISONNEMENT — l'accord de quelqu'un d'autre est INVISIBLE, donc indécidable", async () => {
    ACTEUR = pdg;
    const missionId = await lancer();
    const mien = (await listerAccordsMission()).find((a) => a.missionId === missionId)!;

    // On change d'identité : le même identifiant d'accord, une autre personne.
    ACTEUR = autre;
    expect((await listerAccordsMission()).some((a) => a.missionId === missionId)).toBe(false);
    const vol = await deciderAccordMission(mien.id, "GRANTED");
    expect(vol.ok, "un accord d'autrui ne se donne pas").toBe(false);

    // Et rien n'a bougé : l'accord est toujours en attente.
    const etat = await prisma.missionApproval.findUnique({ where: { id: mien.id }, select: { status: true } });
    expect(etat!.status).toBe("PENDING");

    ACTEUR = pdg;
  }, 300_000);

  it("§17-19 — l'élément demandé se FOURNIT, et l'attente se referme", async () => {
    ACTEUR = pdg;
    const missionId = await lancer();
    const mien = (await listerAccordsMission()).find((a) => a.missionId === missionId)!;
    await deciderAccordMission(mien.id, "GRANTED");

    const vue = await vueMission(missionId, pdg.id);
    expect(vue!.attente?.nodeType).toBe("WAIT_INPUT");
    const stepKey = vue!.attente!.stepKey;

    // LE VIDE EST REFUSÉ : une attente réglée par rien resterait une attente non réglée.
    expect((await fournirElementMission(missionId, stepKey, "   ")).ok).toBe(false);

    const r = await fournirElementMission(missionId, stepKey, "PCH-2026-014");
    expect(r.ok, r.message).toBe(true);

    const etape = await prisma.missionStep.findFirst({
      where: { missionId, key: stepKey }, select: { status: true, result: true },
    });
    expect(etape!.status).toBe("DONE");
    // L'AUTEUR EST TRACÉ : « qui a fourni cela ? » a une réponse.
    expect(JSON.stringify(etape!.result)).toContain(pdg.id);
    expect(JSON.stringify(etape!.result)).toContain("PCH-2026-014");

    // Fournir deux fois ne rouvre rien.
    expect((await fournirElementMission(missionId, stepKey, "PCH-2026-999")).ok).toBe(false);
  }, 300_000);

  it("§39-40 — la PAUSE arrête réellement le battement, la reprise le relance", async () => {
    ACTEUR = pdg;
    const missionId = await lancer();

    const p = await mettreMissionEnPause(missionId, "je vérifie la liste avant d'envoyer");
    expect(p.ok, p.message).toBe(true);
    expect(p.statut).toBe("PAUSED");

    // LA PREUVE QUI COMPTE : l'ordonnanceur ne la propose plus. Sans cela, « en pause » ne serait
    // qu'un mot sur un écran pendant que la mission continuerait d'agir.
    expect(await missionsAFaireAvancer(200)).not.toContain(missionId);

    // Le motif est dans le journal — c'est lui qu'on relira dans trois jours.
    const journal = await prisma.missionEvent.findMany({
      where: { missionId }, select: { kind: true, summary: true },
    });
    expect(journal.some((e) => e.summary.includes("je vérifie la liste"))).toBe(true);

    // Une mission suspendue ne se remet pas en pause deux fois, et le dit sans crier.
    expect((await mettreMissionEnPause(missionId)).message).toMatch(/déjà en pause/);

    const r = await reprendreMission(missionId);
    expect(r.ok, r.message).toBe(true);
    expect(await missionsAFaireAvancer(200)).toContain(missionId);

    // ET LA REPRISE N'A RIEN LEVÉ : la mission attend toujours l'accord qu'elle attendait.
    const vue = await vueMission(missionId, pdg.id);
    expect(vue!.attente?.nodeType, "la pause ne dispense pas de l'accord").toBe("APPROVAL");
  }, 300_000);

  it("§39-40 — l'ARRÊT est définitif, et ne défait pas ce qui a été fait", async () => {
    ACTEUR = pdg;
    const missionId = await lancer();
    const mien = (await listerAccordsMission()).find((a) => a.missionId === missionId)!;
    await deciderAccordMission(mien.id, "GRANTED");

    const faitesAvant = await prisma.missionStep.count({ where: { missionId, status: "DONE" } });
    expect(faitesAvant).toBeGreaterThan(0);

    const r = await arreterMission(missionId, "le service a changé d'avis");
    expect(r.ok, r.message).toBe(true);
    expect(r.statut).toBe("CANCELLED");

    // CE QUI ÉTAIT FAIT RESTE FAIT — on n'annule pas un message parti.
    expect(await prisma.missionStep.count({ where: { missionId, status: "DONE" } })).toBe(faitesAvant);
    // Ce qui n'avait pas commencé est annulé, et l'attente humaine aussi n'avance plus.
    expect(await missionsAFaireAvancer(200)).not.toContain(missionId);
    // Une mission arrêtée ne se reprend pas.
    expect((await reprendreMission(missionId)).ok).toBe(false);
  }, 300_000);

  it("§6 — une MISSION ne peut pas s'accorder elle-même : refus de COMPILATION", () => {
    // Le plan est parfaitement bien formé. Ce n'est pas sa forme qui le fait refuser, c'est ce
    // qu'il demande : la capacité par laquelle une personne reprend la main sur une mission.
    const catalogue = {
      has: (n: string) => n === "mission_control",
      allowed: () => true,
      meta: (n: string) => capabilityMeta(n),
      brief: () => [],
    };
    const plan = {
      objective: "Se donner l'accord toute seule.",
      acceptance: ["l'accord est donné"],
      complexity: "B" as const,
      scale: "S" as const,
      steps: [{
        key: "auto", title: "S'accorder l'autorisation", nodeType: "CAPABILITY" as const,
        capability: "mission_control", input: { geste: "reprendre" }, dependsOn: [],
      }],
    };

    const agent = { userId: "u1", isAgent: true, label: "Adam" };
    const r = compile(plan, catalogue, agent);
    expect(r.ok, "un plan qui reprend la main sur une mission doit être REFUSÉ à l'agent").toBe(false);
    expect(JSON.stringify(r.ok ? [] : r.issues)).toMatch(/accord|suspend/i);

    // LA MÊME ÉTAPE, POSÉE PAR UNE PERSONNE, PASSE. L'interdit vise l'agent, pas la capacité —
    // sinon on aurait fermé à l'humain un geste qui est précisément le sien.
    const humain = { userId: "u1", isAgent: false, label: "le PDG" };
    expect(compile(plan, catalogue, humain).ok).toBe(true);
  });
});
