import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getAccess } from "./rbac";

// Sonde DB ; suite sautée proprement sans base (CI sans Postgres).
let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

const TAG = "__accesstest__";

suite("getAccess — le rôle secondaire cumule ses capacités (même par-dessus un override)", () => {
  let plainId = "", overriddenId = "", primaryOnlyId = "";

  beforeAll(async () => {
    const mk = (s: string, data: Record<string, unknown>) =>
      prisma.user.create({ data: { name: `${TAG}${s}`, email: `${TAG}${s}@t.dz`, passwordHash: "x", ...data } as never });
    const [a, b, c] = await Promise.all([
      // Le cas rapporté : délégué avec « autre rôle » National Sales, sans override.
      mk("plain", { role: "MEDICAL_DELEGATE", secondaryRole: "NATIONAL_SALES" }),
      // Pire cas : même profil MAIS un ancien « accès personnalisé » ASSIGNED posé
      // du temps où le compte était simple délégué.
      mk("overr", { role: "MEDICAL_DELEGATE", secondaryRole: "NATIONAL_SALES" }),
      // Témoin : délégué SANS rôle secondaire + override — le contrat « l'override
      // prime sur le rôle principal » doit rester intact.
      mk("primonly", { role: "MEDICAL_DELEGATE" }),
    ]);
    plainId = a.id; overriddenId = b.id; primaryOnlyId = c.id;

    await prisma.userAccess.createMany({
      data: [
        { userId: overriddenId, module: "CONGRESS_INTERNATIONAL", canView: true, canCreate: true, scope: "ASSIGNED" },
        { userId: primaryOnlyId, module: "CONGRESS_INTERNATIONAL", canView: true, canCreate: true, scope: "ASSIGNED" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.userAccess.deleteMany({ where: { user: { email: { startsWith: TAG } } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
  });

  it("sans override : portée ALL sur les congrès + accès Sponsoring hérités du rôle secondaire", async () => {
    const a = await getAccess(plainId, "MEDICAL_DELEGATE");
    expect(a.secondaryRole).toBe("NATIONAL_SALES");
    expect(a.modules.get("CONGRESS_INTERNATIONAL")?.scope).toBe("ALL"); // il voit TOUTES les demandes à pré-valider
    expect(a.modules.get("CONGRESS_NATIONAL")?.scope).toBe("ALL");
    // Le délégué seul n'a pas SPONSORING ; le National Sales secondaire l'ouvre.
    expect(a.modules.get("SPONSORING")?.actions.has("CREATE")).toBe(true);
    expect(a.modules.get("SPONSORING")?.scope).toBe("ALL");
  });

  it("un ancien override ASSIGNED ne neutralise PAS le rôle secondaire (portée élargie à ALL)", async () => {
    const a = await getAccess(overriddenId, "MEDICAL_DELEGATE");
    const m = a.modules.get("CONGRESS_INTERNATIONAL");
    expect(m?.scope).toBe("ALL"); // ← le bug corrigé : l'override clampait à ASSIGNED
    expect(m?.actions.has("VIEW")).toBe(true);
    expect(m?.actions.has("CREATE")).toBe(true); // conservé de l'override
  });

  it("témoin : sans rôle secondaire, l'override garde la main sur le rôle principal (ASSIGNED)", async () => {
    const a = await getAccess(primaryOnlyId, "MEDICAL_DELEGATE");
    expect(a.modules.get("CONGRESS_INTERNATIONAL")?.scope).toBe("ASSIGNED");
  });
});
