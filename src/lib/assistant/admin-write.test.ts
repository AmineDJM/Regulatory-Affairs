import { describe, it, expect } from "vitest";
import {
  WRITABLE_SETTINGS, WRITABLE_REG_FIELDS, settingSpec, regFieldSpec,
  parseSettingValue, parseRegFieldValue, renderSettingValue, describeChange,
} from "./admin-write";
import { MODULES } from "@/lib/rbac";
import { RETIRED_MODULE_KEYS, isRetiredModule } from "@/lib/modules-retired";
import { ROLE_LABELS, MODULE_LABELS } from "@/lib/labels";

const ctx = { roleLabels: ROLE_LABELS, moduleLabels: MODULE_LABELS as Record<string, string> };

describe("liste blanche — ce qui n'y est pas n'est pas écrivable", () => {
  it("un réglage inconnu est refusé, et la réponse dit lesquels existent", () => {
    const r = parseSettingValue("dropDatabase", "1", ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("maxUploadMb");
  });

  it("un champ de dossier inconnu est refusé", () => {
    const r = parseRegFieldValue("reference", "REG-2026-999");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("non modifiable");
  });

  // La référence identifie le dossier et l'entité a son propre outil : les laisser ici aurait
  // ouvert deux chemins vers la même donnée, dont un sans les contrôles de l'autre.
  it("la référence et l'entité restent hors de portée", () => {
    expect(regFieldSpec("reference")).toBeNull();
    expect(regFieldSpec("companyId")).toBeNull();
  });

  it("chaque entrée du catalogue porte un libellé et un type", () => {
    for (const s of WRITABLE_SETTINGS) {
      expect(s.label, s.key).toBeTruthy();
      expect(s.hint, s.key).toBeTruthy();
      expect(settingSpec(s.key)).toEqual(s);
    }
    for (const f of WRITABLE_REG_FIELDS) {
      expect(f.label, f.field).toBeTruthy();
      expect(regFieldSpec(f.field)).toEqual(f);
    }
  });
});

describe("nombres — les bornes sont la vraie protection", () => {
  it("accepte une valeur dans les bornes", () => {
    expect(parseSettingValue("maxUploadMb", "500", ctx)).toEqual({ ok: true, value: 500 });
    expect(parseSettingValue("driveCapacityGb", "2 000", ctx)).toEqual({ ok: true, value: 2000 });
  });

  // Un modèle qui se trompe d'unité ou d'ordre de grandeur écrirait une valeur qu'aucun écran
  // n'aurait acceptée — et le prochain à s'en apercevoir serait l'utilisateur devant un Drive à 0.
  it("refuse hors bornes plutôt que d'écrire une valeur absurde", () => {
    expect(parseSettingValue("driveCapacityGb", "0", ctx).ok).toBe(false);
    expect(parseSettingValue("maxUploadMb", "999999", ctx).ok).toBe(false);
    expect(parseSettingValue("maxUploadMb", "beaucoup", ctx).ok).toBe(false);
  });
});

describe("oui / non et énumérations — écrits comme un humain les dit", () => {
  it("comprend oui, non, activé, désactivé", () => {
    expect(parseSettingValue("regEnrollmentEnabled", "oui", ctx)).toEqual({ ok: true, value: true });
    expect(parseSettingValue("regEnrollmentEnabled", "désactivé", ctx)).toEqual({ ok: true, value: false });
    expect(parseSettingValue("regEnrollmentEnabled", "peut-être", ctx).ok).toBe(false);
  });

  it("une énumération n'accepte que son domaine, et le rappelle", () => {
    expect(parseSettingValue("budgetTotalMode", "fixed", ctx)).toEqual({ ok: true, value: "FIXED" });
    const bad = parseSettingValue("budgetTotalMode", "AUTO", ctx);
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toContain("FLEXIBLE");
  });
});

describe("rôles et modules — résolus par leur NOM français", () => {
  it("accepte le libellé tel qu'on le dit dans la conversation", () => {
    const r = parseSettingValue("regulatorySupervisorRoles", "Direction, Responsable Réglementaire", ctx);
    expect(r).toEqual({ ok: true, value: ["DIRECTION", "HEAD_OF_REGULATORY"] });
  });

  it("accepte aussi le code brut — le modèle peut avoir repris celui de la base", () => {
    expect(parseSettingValue("regulatorySupervisorRoles", "DIRECTION", ctx)).toEqual({ ok: true, value: ["DIRECTION"] });
  });

  it("un rôle inventé est refusé, et la réponse liste les vrais", () => {
    const r = parseSettingValue("regulatorySupervisorRoles", "Chef Suprême", ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("Direction");
  });

  it("un module se désigne par son libellé", () => {
    expect(parseSettingValue("hiddenModules", "Stocks", ctx)).toEqual({ ok: true, value: ["STOCKS"] });
  });

  // Masquer la console fermerait la porte de l'intérieur : plus aucun moyen de démasquer.
  it("la console d'administration ne se masque JAMAIS, même demandée explicitement", () => {
    const r = parseSettingValue("hiddenModules", "Administration", ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("atteignable");
  });

  it("une liste vide est une valeur légitime — on retire tout le monde", () => {
    expect(parseSettingValue("regulatorySupervisorRoles", "", ctx)).toEqual({ ok: true, value: [] });
  });
});

describe("champs d'un dossier réglementaire", () => {
  it("le statut et la priorité sont bornés par leur domaine", () => {
    expect(parseRegFieldValue("status", "submitted")).toEqual({ ok: true, value: "SUBMITTED" });
    expect(parseRegFieldValue("priority", "critical")).toEqual({ ok: true, value: "CRITICAL" });
    expect(parseRegFieldValue("status", "EN COURS").ok).toBe(false);
  });

  it("une date vide EFFACE la cible ; une date illisible est refusée", () => {
    // Ne plus viser de date est un geste légitime — à ne pas confondre avec une saisie ratée.
    expect(parseRegFieldValue("targetDate", "")).toEqual({ ok: true, value: null });
    expect(parseRegFieldValue("targetDate", "2026-12-31").ok).toBe(true);
    expect(parseRegFieldValue("targetDate", "le mois prochain").ok).toBe(false);
  });

  it("les segments se donnent en liste et se dédoublonnent", () => {
    expect(parseRegFieldValue("therapeuticSegments", "Oncologie, Gynécologie, Oncologie"))
      .toEqual({ ok: true, value: ["Oncologie", "Gynécologie"] });
  });

  // Le cadenas rend un dossier invisible de TOUTE l'équipe : la conséquence doit être annoncée.
  it("le cadenas porte un avertissement explicite", () => {
    expect(regFieldSpec("isLocked")?.warning).toContain("INVISIBLE");
    expect(parseRegFieldValue("isLocked", "oui")).toEqual({ ok: true, value: true });
  });
});

describe("rendu — ce que l'on lit sur la carte de confirmation", () => {
  it("une liste vide se dit, elle ne disparaît pas", () => {
    expect(renderSettingValue([])).toBe("(aucun)");
    expect(renderSettingValue("")).toBe("(vide)");
  });

  it("les codes sont traduits quand on donne les libellés", () => {
    expect(renderSettingValue(["DIRECTION"], ROLE_LABELS)).toBe("Direction");
  });

  it("un changement se lit « avant → après »", () => {
    expect(describeChange("Priorité", "MEDIUM", "CRITICAL")).toBe("Priorité : MEDIUM → CRITICAL");
  });
});

describe("couverture — le catalogue reste cohérent avec la plateforme", () => {
  it("tout module masquable est désignable par son libellé", () => {
    for (const m of MODULES) {
      // La console ne se masque jamais ; un module RETIRÉ du service n'a plus rien à éteindre.
      if (m === "ADMIN" || isRetiredModule(m)) continue;
      const r = parseSettingValue("hiddenModules", (MODULE_LABELS as Record<string, string>)[m], ctx);
      expect(r.ok, m).toBe(true);
    }
  });

  it("UN MODULE RETIRÉ N'EST PAS DÉSIGNABLE — le proposer laisserait croire qu'on le rallume", () => {
    for (const m of RETIRED_MODULE_KEYS) {
      const r = parseSettingValue("hiddenModules", (MODULE_LABELS as Record<string, string>)[m], ctx);
      expect(r.ok, m).toBe(false);
    }
  });
});
