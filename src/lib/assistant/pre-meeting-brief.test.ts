import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess } from "@/lib/rbac";
import { EXECUTIVE_BRIEF_TOOLS } from "./executive-brief-tools";

/**
 * PRE-MEETING BRIEF — arriver préparé : la réunion + les points OUVERTS avec chaque participant
 * (tâches entre nous, engagements suivis). Goldens : contenu réel, cloisonnement (jamais la
 * réunion d'un autre), honnêteté quand il n'y a rien.
 */

const userWith = (id: string, name: string): CurrentUser => ({
  id, name, email: `${id}@t.dz`, role: "DIRECTION",
  access: { modules: new Map(), rowGrants: new Map() } as unknown as EffectiveAccess,
  mustChangePassword: false,
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__pmb__${Date.now()}`;
let pdgId = "";
let dafId = "";
let tiersId = "";

const tool = EXECUTIVE_BRIEF_TOOLS.find((t) => t.def.name === "pre_meeting_brief")!;

suite("pre_meeting_brief — le brief avant réunion (points ouverts par participant)", () => {
  beforeAll(async () => {
    const [pdg, daf, tiers] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG} Karim PDG`, email: `${TAG}p@t.dz`, passwordHash: "x", role: "DIRECTION" } }),
      prisma.user.create({ data: { name: `${TAG} Lina DAF`, email: `${TAG}d@t.dz`, passwordHash: "x", role: "DIRECTION" } }),
      prisma.user.create({ data: { name: `${TAG} Walid`, email: `${TAG}t@t.dz`, passwordHash: "x", role: "DIRECTION" } }),
    ]);
    pdgId = pdg.id; dafId = daf.id; tiersId = tiers.id;

    await prisma.meeting.create({
      data: {
        title: `${TAG} Point budget T3`,
        description: "Arbitrer l'enveloppe congrès et la caisse d'avance.",
        slug: `${TAG}-slug`, publicToken: `${TAG}-tok`,
        status: "SCHEDULED", scheduledAt: new Date(Date.now() + 86_400_000),
        organizerId: pdg.id,
        participants: { create: [{ userId: daf.id, response: "ACCEPTED" }] },
      },
    });
    await prisma.task.create({
      data: { title: `${TAG} Préparer l'état de la caisse`, status: "IN_PROGRESS", createdById: pdg.id, assignedToId: daf.id },
    });
    await prisma.executiveCommitment.create({
      data: { ownerId: pdg.id, who: `${TAG} Lina DAF`, what: "Envoyer le tableau des enveloppes avant jeudi", status: "OPEN" },
    });
  });
  afterAll(async () => {
    await prisma.task.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.executiveCommitment.deleteMany({ where: { who: { startsWith: TAG } } }).catch(() => {});
    await prisma.meeting.deleteMany({ where: { title: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("le brief porte la réunion, l'ordre du jour, et les points OUVERTS avec chaque participant", async () => {
    const out = JSON.parse(await tool.run({ title: `${TAG} Point budget` }, userWith(pdgId, `${TAG} Karim PDG`)) as string);
    expect(out.reunion.titre).toBe(`${TAG} Point budget T3`);
    expect(out.reunion.ordreDuJour).toContain("enveloppe congrès");
    const lina = out.participants.find((p: { nom: string }) => p.nom.includes("Lina"));
    expect(lina).toBeDefined();
    expect(lina.reponse).toBe("ACCEPTED");
    expect(JSON.stringify(lina.tachesEntreNous)).toContain("Préparer l'état de la caisse");
    expect(out.rappel).toMatch(/rien n'est inventé/);
  });

  it("l'INVITÉ a le même brief (sa réunion aussi) ; un TIERS ne la voit jamais", async () => {
    const asDaf = JSON.parse(await tool.run({ title: `${TAG} Point budget` }, userWith(dafId, `${TAG} Lina DAF`)) as string);
    expect(asDaf.reunion.titre).toBe(`${TAG} Point budget T3`);
    const asTiers = await tool.run({ title: `${TAG} Point budget` }, userWith(tiersId, `${TAG} Walid`));
    expect(String(asTiers)).toMatch(/Aucune réunion/);
  });

  it("sans réunion à venir : réponse honnête, jamais une réunion inventée", async () => {
    const out = await tool.run({ title: `${TAG} inexistante-xyz` }, userWith(pdgId, `${TAG} Karim PDG`));
    expect(String(out)).toMatch(/Aucune réunion/);
  });
});
