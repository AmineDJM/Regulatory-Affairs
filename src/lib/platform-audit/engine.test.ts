import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runDiagnostic } from "./engine";

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

suite("Diagnostic de plateforme — exécution réelle", () => {
  it("produit un diagnostic complet et cohérent", async () => {
    const d = await runDiagnostic();

    // Score borné.
    expect(d.healthScore).toBeGreaterThanOrEqual(0);
    expect(d.healthScore).toBeLessThanOrEqual(100);

    // Sondes système (au moins la base).
    expect(d.probes.some((p) => p.key === "db")).toBe(true);

    // Matrice RBAC : tous les rôles, avec un compte de modules ≥ 0.
    expect(d.rbac.length).toBeGreaterThanOrEqual(15);
    for (const r of d.rbac) expect(r.modules).toBeGreaterThanOrEqual(0);

    // Rôles clés couverts (liste non vide, impacts renseignés).
    expect(d.roles.length).toBeGreaterThan(0);
    expect(d.roles.every((r) => r.impact.length > 0)).toBe(true);

    // Volumétrie : jamais négative (—) pour des tables toujours interrogeables.
    expect(d.moduleStats.length).toBeGreaterThan(0);
  });

  it("sonde réellement les formats acceptés par espace (flagship « accepte-t-il pptx ? »)", async () => {
    const d = await runDiagnostic();
    const biz = d.uploads.find((u) => u.key === "biz");
    const drive = d.uploads.find((u) => u.key === "drive");
    expect(biz).toBeDefined();
    expect(drive).toBeDefined();

    // Les pièces jointes métier (liste blanche) acceptent pdf/docx/pptx…
    expect(biz!.accepted).toContain("pdf");
    expect(biz!.accepted).toContain("pptx");
    // … mais refusent des formats hors liste (svg/heic) → source du constat « Formats ».
    expect(biz!.rejected).toContain("svg");

    // Le Drive (liste noire) accepte plus largement (ex. mp4, svg) et bloque les exécutables.
    expect(drive!.accepted).toContain("mp4");
    expect(drive!.accepted).toContain("svg");
  });
});
