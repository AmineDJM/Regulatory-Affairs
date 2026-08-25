import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { EffectiveAccess, Module, Action } from "@/lib/rbac";
import { POWER_TOOLS } from "./power-tools";
import { dossierStageLabel } from "./regulatory-read";
import { completeStepsThrough } from "@/lib/regulatory-workflow";

/**
 * GOLDEN RÉGRESSION — les pannes Regulatory réelles :
 *
 *   B. « Combien de dossiers Amel gère ? » → « 141 » (les produits ACCESSIBLES).
 *      → `regulatory_workload` compte les dossiers dont elle est RESPONSABLE DÉSIGNÉE,
 *        et présente l'accès À PART, avec l'interdiction de le compter comme géré.
 *
 *   C. « Les produits Kwality et leurs statuts » puis « et SD ? »
 *      → `regulatory_portfolio` résout les graphies/acronymes contre les partenaires RÉELS.
 *
 *   F. 22/22 étapes faites → l'étape logique est « TERMINÉ », jamais un retour à l'étape 1.
 */

function userWith(perms: Partial<Record<Module, Action[]>>, role: CurrentUser["role"], id: string): CurrentUser {
  const modules = new Map(
    Object.entries(perms).map(([m, actions]) => [
      m as Module,
      { module: m as Module, actions: new Set(actions as Action[]), scope: "ALL" as const },
    ]),
  );
  return {
    id, name: "PDG", email: `${id}@t.dz`, role,
    access: { modules, rowGrants: new Map() } as unknown as EffectiveAccess,
    mustChangePassword: false,
  };
}

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__rr__${Date.now()}`;
let amelId = "";
let ceoId = "";

const workload = POWER_TOOLS.find((t) => t.def.name === "regulatory_workload")!;
const portfolio = POWER_TOOLS.find((t) => t.def.name === "regulatory_portfolio")!;

suite("regulatory_workload / regulatory_portfolio — gérer ≠ accéder, partenaires résolus", () => {
  beforeAll(async () => {
    const [amel, ceo] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG} Amel Benali`, email: `${TAG}a@t.dz`, passwordHash: "x", role: "REGULATORY_ASSISTANT" } }),
      prisma.user.create({ data: { name: `${TAG} PDG`, email: `${TAG}c@t.dz`, passwordHash: "x", role: "DIRECTION" } }),
    ]);
    amelId = amel.id;
    ceoId = ceo.id;
    // 3 dossiers dont Amel est RESPONSABLE (elle les gère), partenaires variés.
    await prisma.regulatoryProduct.createMany({
      data: [
        { reference: `${TAG}-001`, dci: `${TAG} Nintedanib`, status: "SUBMITTED", responsibleId: amelId, partnerLab: "Kwality Pharma" },
        { reference: `${TAG}-002`, dci: `${TAG} Pembrolizumab`, status: "PRE_SUBMISSION", responsibleId: amelId, partnerLab: "S.D. Pharmaceuticals" },
        { reference: `${TAG}-003`, dci: `${TAG} Nivolumab`, status: "DECISION_OBTAINED", responsibleId: amelId, partnerLab: "Kwality Pharma" },
      ],
    });
    // 2 dossiers où elle a seulement ACCÈS (assignedUsers) — le piège des « 141 dossiers ».
    const p4 = await prisma.regulatoryProduct.create({
      data: { reference: `${TAG}-004`, dci: `${TAG} Molecule4`, status: "SUBMITTED", partnerLab: "SD Pharma", assignedUsers: { connect: { id: amelId } } },
    });
    await prisma.regulatoryProduct.create({
      data: { reference: `${TAG}-005`, dci: `${TAG} Molecule5`, status: "PRE_SUBMISSION", partnerLab: "Hetero Labs", assignedUsers: { connect: { id: amelId } } },
    });
    void p4;
  });

  afterAll(async () => {
    await prisma.regulatoryProduct.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("GOLDEN B — « combien de dossiers Amel gère ? » : les 3 DIRECTS, jamais les 5 accessibles", async () => {
    const exec = userWith({ REGULATORY: ["VIEW"], CHIEF_OF_STAFF: ["VIEW"] }, "DIRECTION", ceoId);
    expect(workload.allowed(exec)).toBe(true);
    const out = JSON.parse(await workload.run({ person: `${TAG} Amel` }, exec));
    expect(out.dossiersGeresDirectement.total).toBe(3);
    expect(out.dossiersGeresDirectement.definition).toMatch(/RESPONSABLE DÉSIGNÉE/);
    expect(out.accesSansResponsabilite.total).toBe(2);
    expect(out.accesSansResponsabilite.regle).toMatch(/ACCÈS ≠ GESTION/);
    expect(out.dossiersGeresDirectement.parStatut["Déposé"]).toBe(1);
    expect(out.dossiersGeresDirectement.parStatut["Décision obtenue"]).toBe(1);
    expect(out.fraicheur.source).toMatch(/périmètre de votre écran/);
  });

  it("vue d'ÉQUIPE sans personne : répartition par responsable + non assignés", async () => {
    const exec = userWith({ REGULATORY: ["VIEW"] }, "DIRECTION", ceoId);
    const out = JSON.parse(await workload.run({}, exec));
    const amelRow = (out.repartition as { personne: string; dossiersGeres: number }[]).find((r) => r.personne.includes("Amel"));
    expect(amelRow?.dossiersGeres).toBe(3);
    expect(out.definition).toMatch(/jamais le simple accès/);
  });

  it("GOLDEN C (moitié serveur) — « et SD ? » : l'acronyme retrouve S.D. Pharmaceuticals + SD Pharma (même société)", async () => {
    const exec = userWith({ REGULATORY: ["VIEW"] }, "DIRECTION", ceoId);
    const out = JSON.parse(await portfolio.run({ partner: "SD" }, exec));
    expect(out.partenaire.resolu).toMatch(/S\.?D\.?/);
    // Les DEUX graphies de la même société sont incluses (test seedé : S.D. Pharmaceuticals + SD Pharma).
    expect((out.partenaire.graphiesIncluses as string[]).sort()).toEqual(["S.D. Pharmaceuticals", "SD Pharma"]);
    expect(out.total).toBe(2);
    const refs = (out.dossiers as { reference: string }[]).map((d) => d.reference).sort();
    expect(refs).toEqual([`${TAG}-002`, `${TAG}-004`]);
  });

  it("« Kwality » : le portefeuille avec statuts, étapes et responsable — la matière de la question réelle", async () => {
    const exec = userWith({ REGULATORY: ["VIEW"] }, "DIRECTION", ceoId);
    const out = JSON.parse(await portfolio.run({ partner: "Kwality" }, exec));
    expect(out.total).toBe(2);
    expect(out.parStatut["Déposé"]).toBe(1);
    expect(out.parStatut["Décision obtenue"]).toBe(1);
    const d = (out.dossiers as { responsable: string }[])[0];
    expect(d.responsable).toContain("Amel");
  });

  it("partenaire INCONNU → réponse honnête + partenaires existants, PAS « aucune trace » sec", async () => {
    const exec = userWith({ REGULATORY: ["VIEW"] }, "DIRECTION", ceoId);
    const out = JSON.parse(await portfolio.run({ partner: "Zeppelin Quantique" }, exec));
    expect(out.reponse).toMatch(/Aucun partenaire ne correspond/);
    expect(out.partenairesExistants.length).toBeGreaterThan(0);
    expect(out.consigne).toMatch(/ne pas conclure « aucune trace »/);
  });

  it("sans le module REGULATORY, l'outil est fermé — le même droit que l'écran", async () => {
    const bare = userWith({}, "DIRECTION", ceoId);
    expect(workload.allowed(bare)).toBe(false);
    expect(portfolio.allowed(bare)).toBe(false);
  });

  it("GOLDEN F — un workflow 22/22 (via jalon Décision obtenue) affiche « TERMINÉ », jamais l'étape 1", () => {
    const { state } = completeStepsThrough(null, "decision");
    const stage = dossierStageLabel(state);
    expect(stage.avancement).toBe("22/22");
    expect(stage.etape).toMatch(/TERMINÉ/);
    expect(stage.etape).not.toMatch(/Réception du CTD/);
  });
});
