import { describe, expect, it } from "vitest";
import { capabilityMeta, PRIMITIVES, primitiveDeduite, DECLARED } from "./capability-meta";

/**
 * LES SIX PRIMITIVES (§34) — chaque capacité en porte une, jamais « autre » ; les exemples du
 * mandat tombent où l'on s'y attend, et le brief du planificateur peut composer à ce niveau.
 */
describe("primitives > features", () => {
  it("les capacités du produit se rangent dans les six primitives, sans reste", () => {
    for (const [nom, d] of Object.entries(DECLARED)) {
      expect(PRIMITIVES, nom).toContain(primitiveDeduite(nom, d.effect));
      expect(capabilityMeta(nom).primitive).toBe(primitiveDeduite(nom, d.effect));
    }
  });
  it("les exemples : lire = information, calculer = calcul, produire une pièce = document, montrer = représentation, agir = action, confier = orchestration", () => {
    expect(primitiveDeduite("read_document", "READ")).toBe("INFORMATION");
    expect(primitiveDeduite("search_products", "READ")).toBe("INFORMATION");
    expect(primitiveDeduite("run_code", "ANALYZE")).toBe("CALCUL");
    expect(primitiveDeduite("run_analysis", "ANALYZE")).toBe("CALCUL");
    expect(primitiveDeduite("finance_intelligence", "READ")).toBe("CALCUL");
    expect(primitiveDeduite("create_report", "PREPARE")).toBe("DOCUMENT");
    expect(primitiveDeduite("chart_advice", "ANALYZE")).toBe("REPRESENTATION");
    expect(primitiveDeduite("send_message", "EXTERNAL_COMMUNICATION")).toBe("ACTION");
    expect(primitiveDeduite("create_task", "INTERNAL_REVERSIBLE_WRITE")).toBe("ACTION");
    expect(primitiveDeduite("launch_mission", "INTERNAL_REVERSIBLE_WRITE")).toBe("ORCHESTRATION");
    expect(primitiveDeduite("watch_entity", "INTERNAL_REVERSIBLE_WRITE")).toBe("ORCHESTRATION");
    // Une capacité inconnue reçoit quand même sa primitive : par l'effet.
    expect(primitiveDeduite("capacite_inconnue", "READ")).toBe("INFORMATION");
    expect(primitiveDeduite("capacite_inconnue", "DESTRUCTIVE")).toBe("ACTION");
  });
});
