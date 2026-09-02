import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/session";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

let ACTOR: CurrentUser | null = null;
vi.mock("@/lib/session", () => ({ requireUser: async () => ACTOR }));

import { prisma } from "@/lib/prisma";
import { getAccess, type SessionUser } from "@/lib/rbac";
import { recordStockSnapshot, requestStockState } from "./stock-snapshot-actions";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__stockguard__";

async function actorFor(id: string, role: SessionUser["role"]): Promise<CurrentUser> {
  const access = await getAccess(id, role);
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { id, name: u.name, email: u.email, role, access, mustChangePassword: false };
}

const form = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PÉRIMÈTRE DE STOCK TIENT DANS L'ACTION, pas dans l'onglet.
 *
 * Un délégué médical relève les stocks des hôpitaux qu'il VISITE. La centrale d'achat (PCH) et
 * ses annexes relèvent de la chaîne d'approvisionnement — ce n'est pas son métier, et il y avait
 * accès. Masquer les onglets n'aurait rien fermé : la portée voyage dans un champ de formulaire,
 * et une requête forgée écrit aussi bien qu'un clic.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
suite("Périmètre des stocks", () => {
  let kamId = "", opsId = "", productId = "";

  beforeAll(async () => {
    const [kam, ops] = await Promise.all([
      prisma.user.create({ data: { name: `${TAG}kam`, email: `${TAG}kam@t.dz`, role: "MEDICAL_DELEGATE", passwordHash: "x" } }),
      prisma.user.create({ data: { name: `${TAG}ops`, email: `${TAG}ops@t.dz`, role: "OPERATIONS_DIRECTOR", passwordHash: "x" } }),
    ]);
    kamId = kam.id; opsId = ops.id;
    // Le KAM reçoit le module STOCKS en écriture : c'est bien son métier de relever le terrain.
    await prisma.userAccess.create({
      data: { userId: kamId, module: "STOCKS", canView: true, canCreate: true, canUpdate: true, scope: "ALL" },
    });
    const produit = await prisma.regulatoryProduct.create({
      data: { reference: `${TAG}-PRD`, dci: `${TAG} Amlodipine`, brandName: `${TAG} Cardiomax` },
    });
    productId = produit.id;
  });

  afterAll(async () => {
    await prisma.stockSnapshot.deleteMany({ where: { productId } }).catch(() => {});
    await prisma.regulatoryProduct.deleteMany({ where: { reference: { startsWith: TAG } } }).catch(() => {});
    await prisma.userAccess.deleteMany({ where: { userId: { in: [kamId, opsId] } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("LE KAM RELÈVE LES HÔPITAUX — c'est son métier, rien ne change", async () => {
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const hopital = await prisma.stockAnnex.create({ data: { name: `${TAG} CHU`, kind: "HOSPITAL" } });
    const r = await recordStockSnapshot(form({
      scope: "HOSPITAL", annexId: hopital.id, productId, date: "2031-05-04", quantity: "42",
    }));
    expect(r.ok, r.error).toBe(true);
    await prisma.stockAnnex.delete({ where: { id: hopital.id } }).catch(() => {});
  });

  it("mais il ne PEUT PAS écrire dans le stock PCH, même en forgeant la requête", async () => {
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const r = await recordStockSnapshot(form({ scope: "PCH", productId, date: "2031-05-04", quantity: "9999" }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/périmètre/i);
    expect(await prisma.stockSnapshot.count({ where: { productId, scope: "PCH" } })).toBe(0);
  });

  it("ni dans une ANNEXE PCH", async () => {
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const annexe = await prisma.stockAnnex.create({ data: { name: `${TAG} Annexe`, kind: "ANNEX" } });
    const r = await recordStockSnapshot(form({
      scope: "ANNEX", annexId: annexe.id, productId, date: "2031-05-04", quantity: "500",
    }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/périmètre/i);
    await prisma.stockAnnex.delete({ where: { id: annexe.id } }).catch(() => {});
  });

  it("ni DEMANDER un état de stock — c'est une réquisition adressée à quelqu'un", async () => {
    ACTOR = await actorFor(kamId, "MEDICAL_DELEGATE");
    const r = await requestStockState(form({ targetUserId: opsId, dueDate: "2031-06-01" }));
    expect(r.ok).toBe(false);
  });

  it("LA CHAÎNE D'APPROVISIONNEMENT, elle, écrit dans le stock PCH", async () => {
    // La règle ne vise pas une personne : elle lit l'accès au module PCH. Le directeur des
    // opérations l'a, donc il passe — sans qu'aucun rôle soit nommé dans le code.
    ACTOR = await actorFor(opsId, "OPERATIONS_DIRECTOR");
    const r = await recordStockSnapshot(form({ scope: "PCH", productId, date: "2031-05-05", quantity: "1200" }));
    expect(r.ok, r.error).toBe(true);
  });
});
