import { describe, it, expect } from "vitest";
import type { UserRole } from "@prisma/client";
import { regCan, regPermissions, REG_PERMISSIONS } from "./access";

const u = (role: string, secondaryRole?: string) => ({
  role: role as UserRole,
  secondaryRole: (secondaryRole ?? null) as UserRole | null,
});

describe("regCan — permissions Regulatory Intelligence (rôle principal ET secondaire)", () => {
  it("SUPER_ADMIN détient TOUTES les permissions (y compris unlock/admin)", () => {
    const admin = u("SUPER_ADMIN");
    for (const p of REG_PERMISSIONS) expect(regCan(admin, p)).toBe(true);
    expect(regCan(admin, "regulatory.module.unlock")).toBe(true);
    expect(regCan(admin, "regulatory.admin")).toBe(true);
  });

  it("HEAD_OF_REGULATORY : opérationnel + approbations, MAIS ni unlock ni admin", () => {
    const head = u("HEAD_OF_REGULATORY");
    expect(regCan(head, "regulatory.dossier.upload")).toBe(true);
    expect(regCan(head, "regulatory.dossier.analyse")).toBe(true);
    expect(regCan(head, "regulatory.finding.approve")).toBe(true);
    expect(regCan(head, "regulatory.submission.approve")).toBe(true);
    // Réservé au Super Admin :
    expect(regCan(head, "regulatory.module.unlock")).toBe(false);
    expect(regCan(head, "regulatory.admin")).toBe(false);
    expect(regCan(head, "regulatory.rules.manage")).toBe(false);
    expect(regCan(head, "regulatory.corpus.manage")).toBe(false);
  });

  it("REGULATORY_ASSISTANT : prépare mais N'APPROUVE PAS", () => {
    const asst = u("REGULATORY_ASSISTANT");
    expect(regCan(asst, "regulatory.dossier.upload")).toBe(true);
    expect(regCan(asst, "regulatory.submission.prepare")).toBe(true);
    expect(regCan(asst, "regulatory.response.generate")).toBe(true);
    // Aucune approbation :
    expect(regCan(asst, "regulatory.finding.approve")).toBe(false);
    expect(regCan(asst, "regulatory.response.approve")).toBe(false);
    expect(regCan(asst, "regulatory.submission.approve")).toBe(false);
    expect(regCan(asst, "regulatory.document.approve")).toBe(false);
  });

  it("DIRECTION : consultation + approbations de validation, pas de préparation", () => {
    const dir = u("DIRECTION");
    expect(regCan(dir, "regulatory.workspace.view")).toBe(true);
    expect(regCan(dir, "regulatory.finding.approve")).toBe(true);
    expect(regCan(dir, "regulatory.submission.approve")).toBe(true);
    // Ne prépare pas les dossiers :
    expect(regCan(dir, "regulatory.dossier.upload")).toBe(false);
    expect(regCan(dir, "regulatory.submission.prepare")).toBe(false);
  });

  it("Rôle sans lien réglementaire (DIRECTION_ASSISTANT) : aucune permission", () => {
    const other = u("DIRECTION_ASSISTANT");
    for (const p of REG_PERMISSIONS) expect(regCan(other, p)).toBe(false);
    expect(regPermissions(other)).toHaveLength(0);
  });

  // ─── Anti-régression RÔLE SECONDAIRE (bug historique de l'ERP) ───
  it("le RÔLE SECONDAIRE ouvre les permissions même si le rôle principal ne les a pas", () => {
    // Assistante de direction dont le rôle secondaire est chef réglementaire.
    const dual = u("DIRECTION_ASSISTANT", "HEAD_OF_REGULATORY");
    expect(regCan(dual, "regulatory.dossier.upload")).toBe(true);
    expect(regCan(dual, "regulatory.finding.approve")).toBe(true);

    // Pharmacien info médicale dont le rôle secondaire est assistant réglementaire.
    const pharma = u("MEDICAL_INFO_PHARMACIST", "REGULATORY_ASSISTANT");
    expect(regCan(pharma, "regulatory.dossier.upload")).toBe(true);
    expect(regCan(pharma, "regulatory.submission.prepare")).toBe(true);
    // Mais toujours pas d'approbation (le secondaire est assistant) :
    expect(regCan(pharma, "regulatory.submission.approve")).toBe(false);
  });

  it("le rôle secondaire NE RESTREINT PAS : l'union des deux rôles s'applique", () => {
    // Principal = assistant (prépare), secondaire = direction (approuve) → cumule les deux.
    const combo = u("REGULATORY_ASSISTANT", "DIRECTION");
    expect(regCan(combo, "regulatory.dossier.upload")).toBe(true); // du principal
    expect(regCan(combo, "regulatory.submission.approve")).toBe(true); // du secondaire
  });

  it("regPermissions retourne l'ensemble effectif et cohérent avec regCan", () => {
    const head = u("HEAD_OF_REGULATORY");
    const perms = regPermissions(head);
    expect(perms).toContain("regulatory.dossier.upload");
    expect(perms).not.toContain("regulatory.module.unlock");
    for (const p of perms) expect(regCan(head, p)).toBe(true);
  });
});
