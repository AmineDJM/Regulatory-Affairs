import { describe, expect, it, vi } from "vitest";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN LIVRABLE ACTUALISÉ EST UNE NOUVELLE VERSION, PAS UN SECOND FICHIER (#88).
 *
 * LU DANS LE PLAN D'UN RUN RÉEL. La chaîne humaine produit `artifact:excel-consolidation`
 * (plan v1) ; une réponse arrive après coup, la mission replanifie, et le plan v2 écrit
 * `artifact:excel-consolidation-maj`. Deux clés, deux titres, deux noms de fichier : DEUX
 * classeurs sur le même sujet, avec des chiffres différents. La personne qui ouvre le mauvais
 * lit des chiffres périmés sans le savoir — « quatre fichiers qui divergent », mot pour mot.
 *
 * LE SENS DE LA PRUDENCE. Ne pas fusionner coûte un fichier en trop ; fusionner à tort ÉCRASE
 * un livrable que personne ne réclamait. Les deux garde-fous ci-dessous sont donc pris dans ce
 * sens-là, et chacun a son test.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const etapes = new Map<string, number>();
let artefacts: { key: string; fileName: string | null; step: { planVersion: number } | null }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    missionStep: { findUnique: async ({ where }: { where: { id: string } }) =>
      etapes.has(where.id) ? { planVersion: etapes.get(where.id) } : null },
    missionArtifact: { findMany: async ({ where }: { where: { key: { not: string } } }) =>
      artefacts.filter((a) => a.key !== where.key.not) },
  },
}));

const mission = (attendus: { key: string; format: string; fromStep: string }[]) => ({
  id: "m1", planMeta: { expectedArtifacts: attendus },
});

describe("l'identité d'un livrable : un par format et par mission, versionné", () => {
  it("un plan PLUS RÉCENT reprend la clé ET le nom de fichier du livrable existant", async () => {
    const { identiteDuLivrable } = await import("@/lib/missions/artifacts/build");
    etapes.set("s2", 2);
    artefacts = [{ key: "excel-consolidation", fileName: "Consolidation.xlsx", step: { planVersion: 1 } }];
    const r = await identiteDuLivrable(
      mission([{ key: "excel-maj", format: "XLSX", fromStep: "artifact:excel-maj" }]),
      { id: "s2", key: "artifact:excel-maj" }, "XLSX",
    );
    expect(r.key).toBe("excel-consolidation");
    expect(r.fileName).toBe("Consolidation.xlsx");
  });

  it("MÊME plan : deux classeurs voulus ensemble gardent leurs deux clés", async () => {
    const { identiteDuLivrable } = await import("@/lib/missions/artifacts/build");
    etapes.set("s1", 1);
    artefacts = [{ key: "excel-nivolex", fileName: "Nivolex.xlsx", step: { planVersion: 1 } }];
    const r = await identiteDuLivrable(
      mission([{ key: "excel-trastuzex", format: "XLSX", fromStep: "artifact:excel-trastuzex" }]),
      { id: "s1", key: "artifact:excel-trastuzex" }, "XLSX",
    );
    expect(r.key).toBe("excel-trastuzex");
    expect(r.fileName).toBeUndefined();
  });

  it("si le plan COURANT annonce deux livrables de ce format, on ne fusionne rien", async () => {
    const { identiteDuLivrable } = await import("@/lib/missions/artifacts/build");
    etapes.set("s2", 2);
    artefacts = [{ key: "excel-v1", fileName: "V1.xlsx", step: { planVersion: 1 } }];
    const r = await identiteDuLivrable(
      mission([
        { key: "excel-a", format: "XLSX", fromStep: "artifact:a" },
        { key: "excel-b", format: "XLSX", fromStep: "artifact:b" },
      ]),
      { id: "s2", key: "artifact:a" }, "XLSX",
    );
    expect(r.key).toBe("excel-a");
  });

  it("aucun livrable antérieur : la clé du plan, comme avant", async () => {
    const { identiteDuLivrable } = await import("@/lib/missions/artifacts/build");
    etapes.set("s1", 1);
    artefacts = [];
    const r = await identiteDuLivrable(
      mission([{ key: "excel-seul", format: "XLSX", fromStep: "artifact:seul" }]),
      { id: "s1", key: "artifact:seul" }, "XLSX",
    );
    expect(r.key).toBe("excel-seul");
  });
});
