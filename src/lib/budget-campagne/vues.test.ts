import { describe, it, expect } from "vitest";
import { construireVuePole, construireVueDirection, type RawCampagne, type RawProposition } from "./vues";

/**
 * LE CADRAGE NE FUIT JAMAIS VERS UN PÔLE (Direction, 10/2026 : « l'enveloppe du DG reste privée ; les départements ne
 * la voient jamais »). On vérifie le JSON SÉRIALISÉ — ce qui part réellement au navigateur — et pas seulement les types.
 */

const CADRAGE_GLOBAL = 520_000_123;
const CADRAGE_POLE = 180_000_777;

const campagne: RawCampagne = {
  id: "c1", year: 2027, companyId: null, title: "Campagne budgétaire 2027", status: "REVIEW",
  opensAt: new Date("2026-10-15"), submitDeadline: new Date("2026-11-15"), validationDeadline: new Date("2026-12-15"),
  cadrageTotal: CADRAGE_GLOBAL, validatorMode: "COMITE", validatorIds: ["dg", "sa"], validatorRule: "ALL",
  allowRectificatif: false, seuilJustificationPct: 5,
};

const proposition: RawProposition = {
  id: "p1", departmentId: "dep-ops", poleLabel: "Operations & Sales", domaine: "OPERATIONS", cadrage: CADRAGE_POLE,
  status: "SOUMIS", currentVersion: 1, estRectificatif: false, revisionAutorisee: false, envelopeId: null, responsable: "Brahim R.",
  lignes: [{ id: "l1", key: "VEH", label: "Véhicules", categoryKey: null, source: "REALISE_2026", realise2026: 24_000_000, propose: 26_000_000, ajuste: null, decision: null, justification: "2 véhicules", attachments: [], sortOrder: 1 }],
  votes: [{ userId: "dg", decision: "ACCEPTE", version: 1, createdAt: new Date("2026-11-20") }],
  commentaires: [], versions: [{ version: 1, submittedAt: new Date("2026-11-16"), total: 26_000_000, summary: null, summaryByLuna: false, rectificatif: false }],
};

const noms = new Map([["dg", "DG"], ["sa", "Super Admin"]]);
const fuit = (o: unknown) => {
  const s = JSON.stringify(o);
  return s.includes(String(CADRAGE_GLOBAL)) || s.includes(String(CADRAGE_POLE)) || /cadrage/i.test(s);
};

describe("la vue d'un pôle ne porte AUCUN cadrage", () => {
  it("ni le cadrage global, ni celui du pôle, ni même la clé", () => {
    const vue = construireVuePole(campagne, [proposition], noms);
    expect(fuit(vue)).toBe(false);
    expect(vue.propositions[0].demande).toBe(26_000_000);
    expect(vue.propositions[0].ouChezQui).toContain("Super Admin");
  });

  it("la vue de la Direction ne le porte que pour qui le voit", () => {
    const sans = construireVueDirection(campagne, [proposition], noms, false);
    expect(fuit(sans)).toBe(false);
    const avec = construireVueDirection(campagne, [proposition], noms, true);
    expect(avec.campagne.cadrageTotal).toBe(CADRAGE_GLOBAL);
    expect(avec.propositions[0].cadrage).toBe(CADRAGE_POLE);
  });

  it("la lecture serveur d'un pôle passe par `construireVuePole` (seule porte)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(`${process.cwd()}/src/lib/budget-campagne/requetes.ts`, "utf8");
    const branchePole = src.slice(src.indexOf("const visibles"));
    expect(branchePole).toContain("construireVuePole(");
    expect(branchePole).not.toContain("construireVueDirection(");
  });
});
