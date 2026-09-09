import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { setRegulatoryClassification } from "./regulatory-actions";
import { setRegulatoryHiddenColumns } from "./settings-actions";
import { getAppSettings } from "@/lib/settings";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__bdprojet__";

async function acteur(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CLASSER UN DOSSIER PAR PROJET, ET RETIRER UNE COLONNE — par les VRAIS points d'entrée.
 *
 * Un test qui écrirait `bdProjectId` en base directement prouverait que Prisma fonctionne. On
 * part donc de l'action serveur que l'écran appelle, et l'on vérifie EN BASE ce qui a changé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Projet BD sur un dossier réglementaire", () => {
  let pdgId = "", produitId = "", projetId = "", autreProjetId = "";

  beforeAll(async () => {
    const pdg = await prisma.user.create({
      data: { name: `${TAG}pdg`, email: `${TAG}pdg@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" },
    });
    pdgId = pdg.id;
    const company = await prisma.company.create({ data: { name: `${TAG}co` } });
    const [p, projet, autre] = await Promise.all([
      prisma.regulatoryProduct.create({
        data: { reference: `${TAG}REG-1`, dci: "Nivolex", companyId: company.id, createdById: pdg.id },
        select: { id: true },
      }),
      prisma.bdProject.create({ data: { name: `${TAG}Oncologie 2027`, createdById: pdg.id }, select: { id: true } }),
      prisma.bdProject.create({ data: { name: `${TAG}Cardio 2028`, createdById: pdg.id }, select: { id: true } }),
    ]);
    produitId = p.id; projetId = projet.id; autreProjetId = autre.id;
  }, 120_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.regulatoryProduct.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.bdProject.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.company.deleteMany({ where: { name: { startsWith: TAG } } }).catch(() => {});
    await prisma.appSetting.updateMany({ where: { id: "global" }, data: { regulatoryHiddenColumns: [] } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  }, 120_000);

  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  it("range un dossier dans un projet, puis l'en change", async () => {
    ACTOR = await acteur(pdgId, "SUPER_ADMIN");
    expect((await setRegulatoryClassification(fd({ id: produitId, bdProjectId: projetId }))).ok).toBe(true);
    let row = await prisma.regulatoryProduct.findUnique({ where: { id: produitId }, select: { bdProjectId: true } });
    expect(row?.bdProjectId).toBe(projetId);

    expect((await setRegulatoryClassification(fd({ id: produitId, bdProjectId: autreProjetId }))).ok).toBe(true);
    row = await prisma.regulatoryProduct.findUnique({ where: { id: produitId }, select: { bdProjectId: true } });
    expect(row?.bdProjectId).toBe(autreProjetId);
  });

  it("une valeur VIDE retire le classement — et ce n'est pas « ne pas y toucher »", async () => {
    ACTOR = await acteur(pdgId, "SUPER_ADMIN");
    await setRegulatoryClassification(fd({ id: produitId, bdProjectId: projetId }));
    expect((await setRegulatoryClassification(fd({ id: produitId, bdProjectId: "" }))).ok).toBe(true);
    const row = await prisma.regulatoryProduct.findUnique({ where: { id: produitId }, select: { bdProjectId: true } });
    expect(row?.bdProjectId).toBeNull();
  });

  /**
   * ACCEPTER UN IDENTIFIANT INCONNU rangerait le dossier dans un projet que personne ne
   * retrouverait, et l'écran afficherait une case vide sans rien dire — un faux succès.
   */
  it("REFUSE un projet inconnu, et n'écrit rien", async () => {
    ACTOR = await acteur(pdgId, "SUPER_ADMIN");
    await setRegulatoryClassification(fd({ id: produitId, bdProjectId: projetId }));
    const r = await setRegulatoryClassification(fd({ id: produitId, bdProjectId: "projet-qui-nexiste-pas" }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("inconnu");
    const row = await prisma.regulatoryProduct.findUnique({ where: { id: produitId }, select: { bdProjectId: true } });
    expect(row?.bdProjectId).toBe(projetId);
  });

  it("ne touche PAS au projet quand la clé est absente — l'empreinte ne dépasse pas la demande", async () => {
    ACTOR = await acteur(pdgId, "SUPER_ADMIN");
    await setRegulatoryClassification(fd({ id: produitId, bdProjectId: projetId }));
    // On ne change que les segments : le projet doit survivre intact (§118.16).
    expect((await setRegulatoryClassification(fd({ id: produitId, segments: "" }))).ok).toBe(true);
    const row = await prisma.regulatoryProduct.findUnique({ where: { id: produitId }, select: { bdProjectId: true } });
    expect(row?.bdProjectId).toBe(projetId);
  });
});

suite("Colonnes masquées du tableau Regulatory — le réglage de la maison", () => {
  let pdgId = "";

  beforeAll(async () => {
    const pdg = await prisma.user.create({
      data: { name: `${TAG}adm`, email: `${TAG}adm@t.dz`, role: "SUPER_ADMIN", passwordHash: "x" },
    });
    pdgId = pdg.id;
  }, 120_000);

  afterAll(async () => {
    await prisma.appSetting.updateMany({ where: { id: "global" }, data: { regulatoryHiddenColumns: [] } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  }, 120_000);

  const cols = (...keys: string[]) => {
    const f = new FormData();
    for (const k of keys) f.append("columns", k);
    return f;
  };

  it("enregistre les colonnes retirées, et `getAppSettings` les rend", async () => {
    ACTOR = await acteur(pdgId, "SUPER_ADMIN");
    expect((await setRegulatoryHiddenColumns(cols("therapeuticClass"))).ok).toBe(true);
    const row = await prisma.appSetting.findUnique({ where: { id: "global" }, select: { regulatoryHiddenColumns: true } });
    expect(row?.regulatoryHiddenColumns).toEqual(["therapeuticClass"]);
    // ET LE LECTEUR LES REND : un réglage écrit que personne ne relit est une promesse d'écran.
    expect((await getAppSettings()).regulatoryHiddenColumns).toEqual(["therapeuticClass"]);
  });

  it("REFUSE une clé inconnue et la RÉFÉRENCE — le formulaire ne fait pas foi", async () => {
    ACTOR = await acteur(pdgId, "SUPER_ADMIN");
    expect((await setRegulatoryHiddenColumns(cols("colonneInventee"))).ok).toBe(false);
    const r = await setRegulatoryHiddenColumns(cols("reference"));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("identifie la ligne");
  });
});
