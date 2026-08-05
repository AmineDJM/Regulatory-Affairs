import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getDepartmentTree, flattenTree, getDepartmentSubtreeIds, getDepartmentMembers,
  getManagerOf, getManagementChain, getDepartmentPath,
} from "./departments";

/**
 * Départements & hiérarchie réelle (N+1). On construit une structure sur 3 NIVEAUX :
 *
 *   Direction générale        (resp. DG)
 *     └─ Commercial           (resp. Chef commercial, adjoint Adjoint commercial)
 *          └─ Ventes Nord     (pas de responsable → on remonte)
 *
 * et on vérifie la cascade de résolution du N+1 :
 *   manager explicite → responsable du département → adjoint → responsable du parent.
 */

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = `__dept__${Date.now()}`;
let dgId = "", comId = "", nordId = "";
let empDg = "", empChef = "", empAdjoint = "", empVendeur = "", empAutonome = "";

const mkEmp = async (name: string, departmentId?: string, managerId?: string) =>
  (await prisma.employee.create({ data: { fullName: `${TAG} ${name}`, departmentId: departmentId ?? null, managerId: managerId ?? null } })).id;

suite("Départements — arbre N niveaux et résolution du N+1", () => {
  beforeAll(async () => {
    const dg = await prisma.department.create({ data: { name: `${TAG} Direction`, code: `${TAG}_DIR` } });
    const com = await prisma.department.create({ data: { name: `${TAG} Commercial`, code: `${TAG}_COM`, parentId: dg.id } });
    const nord = await prisma.department.create({ data: { name: `${TAG} Ventes Nord`, code: `${TAG}_NORD`, parentId: com.id } });
    dgId = dg.id; comId = com.id; nordId = nord.id;

    empDg = await mkEmp("DG", dgId);
    empChef = await mkEmp("Chef commercial", comId);
    empAdjoint = await mkEmp("Adjoint commercial", comId);
    empVendeur = await mkEmp("Vendeur Nord", nordId);
    empAutonome = await mkEmp("Vendeur avec manager", nordId, empChef); // manager EXPLICITE

    await prisma.department.update({ where: { id: dgId }, data: { headId: empDg } });
    await prisma.department.update({ where: { id: comId }, data: { headId: empChef, deputyId: empAdjoint } });
    // « Ventes Nord » n'a volontairement PAS de responsable → la résolution doit remonter.
  });

  afterAll(async () => {
    await prisma.department.updateMany({ where: { code: { startsWith: TAG } }, data: { headId: null, deputyId: null } }).catch(() => {});
    await prisma.employee.deleteMany({ where: { fullName: { startsWith: TAG } } }).catch(() => {});
    await prisma.department.deleteMany({ where: { code: { startsWith: TAG } } }).catch(() => {});
  });

  it("construit l'arbre sur 3 niveaux avec effectifs cumulés", async () => {
    const tree = await getDepartmentTree();
    const dir = tree.find((d) => d.id === dgId)!;
    expect(dir.depth).toBe(0);
    expect(dir.headName).toContain("DG");

    const com = dir.children.find((c) => c.id === comId)!;
    expect(com.depth).toBe(1);
    const nord = com.children.find((c) => c.id === nordId)!;
    expect(nord.depth).toBe(2); // 3ᵉ niveau : la hiérarchie n'est pas limitée à 2

    // Effectif direct vs cumulé (Direction : 1 direct + 2 commercial + 2 nord = 5).
    expect(dir.members).toBe(1);
    expect(dir.totalMembers).toBe(5);
    expect(com.totalMembers).toBe(4);
  });

  it("aplatit l'arbre en options indentées", async () => {
    const flat = flattenTree(await getDepartmentTree());
    const nord = flat.find((o) => o.id === nordId)!;
    expect(nord.depth).toBe(2);
    expect(nord.label.startsWith("— — ")).toBe(true);
  });

  it("liste la descendance et les membres (avec ou sans sous-départements)", async () => {
    const ids = await getDepartmentSubtreeIds(comId);
    expect(ids).toContain(comId);
    expect(ids).toContain(nordId);
    expect(ids).not.toContain(dgId);

    const direct = await getDepartmentMembers(comId);
    expect(direct).toHaveLength(2);
    const withSubs = await getDepartmentMembers(comId, { includeSubDepartments: true });
    expect(withSubs).toHaveLength(4);
  });

  it("N+1 : le manager EXPLICITE prime sur le département", async () => {
    const mgr = await getManagerOf(empAutonome);
    expect(mgr?.employeeId).toBe(empChef);
    expect(mgr?.source).toBe("MANAGER");
  });

  it("N+1 : sans manager ni responsable local, on REMONTE au département parent", async () => {
    // « Ventes Nord » n'a pas de responsable → responsable du département parent (Commercial).
    const mgr = await getManagerOf(empVendeur);
    expect(mgr?.employeeId).toBe(empChef);
    expect(mgr?.source).toBe("PARENT_DEPARTMENT_HEAD");
  });

  it("N+1 : le responsable d'un département est validé PAR LE DESSUS, pas par son adjoint", async () => {
    // Le chef commercial est responsable de SON département : son N+1 n'est ni lui-même,
    // ni son adjoint (un subordonné) — c'est le responsable du département parent.
    const mgr = await getManagerOf(empChef);
    expect(mgr?.employeeId).not.toBe(empChef);
    expect(mgr?.employeeId).not.toBe(empAdjoint);
    expect(mgr?.employeeId).toBe(empDg);
  });

  it("N+1 : le sommet de la hiérarchie n'a pas de responsable", async () => {
    expect(await getManagerOf(empDg)).toBeNull();
  });

  it("N+1 : l'adjoint supplée quand le responsable n'est pas renseigné", async () => {
    // On retire temporairement le responsable de « Commercial » : ses membres tombent sur l'adjoint.
    await prisma.department.update({ where: { id: comId }, data: { headId: null } });
    const mgr = await getManagerOf(empVendeur);
    expect(mgr?.employeeId).toBe(empAdjoint);
    await prisma.department.update({ where: { id: comId }, data: { headId: empChef } });
  });

  it("remonte la chaîne hiérarchique complète sans boucler", async () => {
    const chain = await getManagementChain(empVendeur);
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(chain[0].employeeId).toBe(empChef);
    // Le sommet de la chaîne est le DG.
    expect(chain.map((c) => c.employeeId)).toContain(empDg);
    // Aucun doublon (protection anti-boucle).
    expect(new Set(chain.map((c) => c.employeeId)).size).toBe(chain.length);
  });

  it("donne le fil d'Ariane du département", async () => {
    const path = await getDepartmentPath(nordId);
    expect(path.map((p) => p.id)).toEqual([dgId, comId, nordId]);
  });
});
