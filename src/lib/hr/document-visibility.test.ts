import { describe, it, expect } from "vitest";
import {
  defaultVisibleToEmployee, resolveVisibility, shouldMirrorToDrive, visibilityLabel,
} from "./document-visibility";

describe("defaultVisibleToEmployee — on raisonne sur ce qu'on REMET", () => {
  it("les pièces destinées au salarié lui sont visibles", () => {
    for (const c of ["PAYSLIP", "WORK_CERTIFICATE", "CNAS_CERTIFICATE", "SALARY_STATEMENT", "DOMICILIATION"]) {
      expect(defaultVisibleToEmployee(c), c).toBe(true);
    }
  });

  it("le CONTRAT et l'AVENANT restent aux RH", () => {
    expect(defaultVisibleToEmployee("CONTRACT")).toBe(false);
    expect(defaultVisibleToEmployee("AMENDMENT")).toBe(false);
  });

  it("les pièces de gestion restent aux RH", () => {
    for (const c of ["ID_DOCUMENT", "DIPLOMA", "MEDICAL", "OTHER"]) {
      expect(defaultVisibleToEmployee(c), c).toBe(false);
    }
  });

  // La liste énumère ce qu'on REMET, pas ce qui est confidentiel : une catégorie inventée
  // demain reste donc aux RH tant que personne ne l'a explicitement destinée au salarié.
  it("une catégorie inconnue reste aux RH", () => {
    expect(defaultVisibleToEmployee("CATEGORIE_FUTURE")).toBe(false);
  });
});

describe("resolveVisibility — « rien coché » n'est pas « décoché »", () => {
  it("sans choix, le défaut de la catégorie s'applique", () => {
    expect(resolveVisibility("PAYSLIP")).toBe(true);
    expect(resolveVisibility("CONTRACT")).toBe(false);
  });

  it("un choix explicite l'emporte, dans les deux sens", () => {
    expect(resolveVisibility("CONTRACT", true)).toBe(true);
    expect(resolveVisibility("PAYSLIP", false)).toBe(false);
  });

  it("`undefined` ne bascule PAS un bulletin en RH-only", () => {
    expect(resolveVisibility("PAYSLIP", undefined)).toBe(true);
  });
});

describe("shouldMirrorToDrive — on ne recopie pas dans le Drive ce qu'on vient de réserver", () => {
  it("un contrat RH-only n'est pas répliqué", () => {
    expect(shouldMirrorToDrive("CONTRACT", false)).toBe(false);
    expect(shouldMirrorToDrive("AMENDMENT", false)).toBe(false);
  });

  it("un contrat PARTAGÉ avec le salarié l'est", () => {
    expect(shouldMirrorToDrive("CONTRACT", true)).toBe(true);
  });

  it("une pièce d'une autre nature ne l'est jamais — le miroir ne vise que les contrats", () => {
    expect(shouldMirrorToDrive("PAYSLIP", true)).toBe(false);
  });
});

describe("visibilityLabel", () => {
  it("dit l'état en clair, sans jargon", () => {
    expect(visibilityLabel(false)).toBe("RH uniquement");
    expect(visibilityLabel(true)).toBe("Partagé avec le salarié");
  });
});
