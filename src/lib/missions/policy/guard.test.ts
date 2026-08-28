import { describe, expect, it } from "vitest";
import { LIBELLE_NIVEAU, messageRefus, niveauPour, refusPourActeur } from "./guard";
import { EFFECTS } from "@/lib/missions/registry/capability-meta";
import { compile } from "@/lib/missions/compiler/compile";
import type { CapabilityCatalog, MissionActor } from "@/lib/missions/ports";
import { capabilityMeta } from "@/lib/missions/registry/capability-meta";
import type { MissionPlan } from "@/lib/missions/planner/contract";

const adam: MissionActor = { userId: "adam", label: "Adam", isAgent: true };
const pdg: MissionActor = { userId: "u1", label: "le PDG", isAgent: false };

describe("§29 — l'auto-escalade est structurellement impossible", () => {
  const tentatives = [
    "grant_permission", "update_role", "make_super_admin", "edit_rbac",
    "create_credential", "read_api_key", "rotate_secret", "reset_password",
    "disable_guard", "kill_switch", "bypass_policy", "create_user", "delete_user",
  ];

  it("refuse chacune des tentatives connues, à l'agent", () => {
    for (const c of tentatives) {
      const r = refusPourActeur(c, "INTERNAL_REVERSIBLE_WRITE", adam);
      expect(r, `« ${c} » devrait être refusée à l'agent`).not.toBeNull();
    }
  });

  it("refuse TOUT effet SECURITY_ADMIN à l'agent, même sur un nom anodin", () => {
    expect(refusPourActeur("faire_le_cafe", "SECURITY_ADMIN", adam)).not.toBeNull();
  });

  it("un droit trop large ne lève PAS l'interdit — c'est tout l'intérêt", () => {
    // Le catalogue dit oui à tout ; le compilateur refuse quand même.
    const cat: CapabilityCatalog = {
      has: () => true,
      allowed: () => true,
      meta: () => ({ ...capabilityMeta("grant_permission"), effect: "SECURITY_ADMIN" }),
      brief: () => [],
    };
    const plan: MissionPlan = {
      objective: "s'ouvrir des droits", acceptance: ["fait"], complexity: "A", scale: "S",
      steps: [{ key: "x", title: "X", capability: "grant_permission" }],
    };
    const r = compile(plan, cat, adam);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].code).toBe("FORBIDDEN_CAPABILITY");
    expect(r.issues[0].message).toMatch(/structurellement interdite/);
  });

  it("LE PDG, LUI, PEUT administrer les droits : c'est son métier", () => {
    for (const c of tentatives) {
      expect(refusPourActeur(c, "SECURITY_ADMIN", pdg), `« ${c} » refusée au PDG`).toBeNull();
    }
  });

  it("l'agent garde toutes ses capacités métier", () => {
    const metier = ["send_email", "employee_360", "directory_list", "create_task", "gmail_prepare_mail"];
    for (const c of metier) {
      expect(refusPourActeur(c, "EXTERNAL_COMMUNICATION", adam), `« ${c} » refusée à tort`).toBeNull();
    }
  });

  it("le refus PORTE SA RAISON, en français, exploitable par l'humain", () => {
    const r = refusPourActeur("grant_permission", "INTERNAL_REVERSIBLE_WRITE", adam)!;
    expect(r.raison).toBe("modifier des permissions");
    expect(messageRefus(r)).toMatch(/Adam ne peut pas modifier des permissions/);
    expect(messageRefus(r)).toMatch(/une personne autorisée/);
  });
});

describe("§32 — le niveau d'approbation découle de l'effet", () => {
  it("lire, analyser et préparer n'exigent rien", () => {
    expect(niveauPour("READ")).toBe("NONE");
    expect(niveauPour("ANALYZE")).toBe("NONE");
    expect(niveauPour("PREPARE")).toBe("NONE");
  });

  it("écrire dans l'ERP exige un accord ordinaire", () => {
    expect(niveauPour("INTERNAL_REVERSIBLE_WRITE")).toBe("NORMAL");
  });

  it("sortir de l'entreprise, engager de l'argent ou toucher au personnel est SENSIBLE", () => {
    expect(niveauPour("EXTERNAL_COMMUNICATION")).toBe("SENSITIVE");
    expect(niveauPour("FINANCIAL_COMMITMENT")).toBe("SENSITIVE");
    expect(niveauPour("HR_SENSITIVE")).toBe("SENSITIVE");
  });

  it("détruire et administrer la sécurité sont CRITIQUES", () => {
    expect(niveauPour("DESTRUCTIVE")).toBe("CRITICAL");
    expect(niveauPour("SECURITY_ADMIN")).toBe("CRITICAL");
  });

  it("chaque effet a un niveau, et chaque niveau un libellé français", () => {
    for (const e of EFFECTS) {
      const n = niveauPour(e);
      expect(LIBELLE_NIVEAU[n], `${e} sans libellé`).toBeTruthy();
    }
  });

  it("le niveau est MONOTONE : un effet plus grave n'exige jamais moins", () => {
    const rangs = { NONE: 0, NORMAL: 1, SENSITIVE: 2, CRITICAL: 3 };
    let precedent = -1;
    for (const e of EFFECTS) {
      const r = rangs[niveauPour(e)];
      expect(r, `${e} redescend en dessous du précédent`).toBeGreaterThanOrEqual(precedent);
      precedent = r;
    }
  });
});
