import { describe, it, expect } from "vitest";
import {
  STRUCTURAL_FIELDS, STRUCTURAL_LABELS, canSetStructural, structuralChanges,
  structuralRefusal, structuralNotice, type StructuralValues,
} from "./structural-fields";

/** Affichage de test : on rend la valeur brute, sauf `null` qui se dit « — ». */
const show = (_f: unknown, v: string | null) => v ?? "—";

const before: StructuralValues = {
  manufacturingStatus: "IMPORTATION",
  responsibleId: "u-amine",
  companyId: "c-adventum",
};

describe("canSetStructural — le Super Admin, et personne d'autre", () => {
  it("autorise le Super Admin", () => {
    expect(canSetStructural({ role: "SUPER_ADMIN" })).toBe(true);
  });

  it("refuse la Direction, le responsable Regulatory et le porteur du dossier", () => {
    for (const role of ["DIRECTION", "GENERAL_MANAGER", "HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT"]) {
      expect(canSetStructural({ role }), role).toBe(false);
    }
  });
});

describe("les trois champs protégés", () => {
  it("sont le statut de fabrication, le chargé du dossier et l'entité", () => {
    expect([...STRUCTURAL_FIELDS]).toEqual(["manufacturingStatus", "responsibleId", "companyId"]);
  });

  it("portent un libellé lisible — c'est lui qui s'affiche dans un refus", () => {
    expect(STRUCTURAL_LABELS.manufacturingStatus).toBe("Statut de fabrication");
    expect(STRUCTURAL_LABELS.responsibleId).toBe("Chargé du dossier");
    expect(STRUCTURAL_LABELS.companyId).toBe("Entité");
  });
});

describe("structuralChanges — ce qui change réellement", () => {
  it("ne voit rien quand rien ne bouge", () => {
    expect(structuralChanges(before, { manufacturingStatus: "IMPORTATION" }, show)).toEqual([]);
  });

  it("repère un changement de statut de fabrication", () => {
    const out = structuralChanges(before, { manufacturingStatus: "FULL_PROCESS" }, show);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ field: "manufacturingStatus", from: "IMPORTATION", to: "FULL_PROCESS" });
  });

  it("un champ ABSENT n'est pas une remise à zéro — les écrans envoient des fiches partielles", () => {
    expect(structuralChanges(before, {}, show)).toEqual([]);
    expect(structuralChanges(before, { companyId: "c-adventum" }, show)).toEqual([]);
  });

  it("un champ présent à `null` EST un effacement, et il compte", () => {
    const out = structuralChanges(before, { responsibleId: null }, show);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ field: "responsibleId", from: "u-amine", to: "—" });
  });

  it("rend les trois changements dans l'ordre des champs", () => {
    const out = structuralChanges(
      before,
      { companyId: "c-pharmagene", manufacturingStatus: "PACKAGING_SECONDAIRE", responsibleId: "u-karim" },
      show,
    );
    expect(out.map((c) => c.field)).toEqual(["manufacturingStatus", "responsibleId", "companyId"]);
  });

  it("affiche des valeurs LISIBLES, pas des identifiants", () => {
    const nice = (f: string, v: string | null) => (v === "u-karim" ? "Karim B." : v ?? "—");
    const out = structuralChanges(before, { responsibleId: "u-karim" }, nice as never);
    expect(out[0].to).toBe("Karim B.");
  });
});

describe("structuralRefusal — un refus qui nomme ce qu'il refuse", () => {
  const chg = (field: string, label: string) => ({ field, label, from: "a", to: "b" }) as never;

  it("nomme un champ isolé", () => {
    const msg = structuralRefusal([chg("companyId", "Entité")]);
    expect(msg).toContain("Entité");
    expect(msg).toContain("Super Admin");
  });

  it("énumère proprement plusieurs champs", () => {
    const msg = structuralRefusal([
      chg("manufacturingStatus", "Statut de fabrication"),
      chg("responsibleId", "Chargé du dossier"),
      chg("companyId", "Entité"),
    ]);
    expect(msg).toContain("Statut de fabrication, Chargé du dossier et Entité");
  });

  it("dit que le RESTE a bien été enregistré — sinon on croit tout avoir perdu", () => {
    expect(structuralRefusal([chg("companyId", "Entité")])).toContain("laissé tel quel");
  });
});

describe("structuralNotice — ce que reçoit le chargé du dossier", () => {
  const ref = "REG-2026-014";
  const dci = "Amoxicilline";

  it("se tait quand rien n'a changé", () => {
    expect(structuralNotice(ref, dci, [])).toBeNull();
  });

  it("titre spécifique pour le seul statut de fabrication", () => {
    const n = structuralNotice(ref, dci, [
      { field: "manufacturingStatus", label: "Statut de fabrication", from: "Importation", to: "Full process" },
    ]);
    expect(n?.title).toBe("Statut de fabrication mis à jour");
  });

  it("dit l'AVANT et l'APRÈS, pas « mis à jour »", () => {
    const n = structuralNotice(ref, dci, [
      { field: "manufacturingStatus", label: "Statut de fabrication", from: "Importation", to: "Full process" },
    ]);
    expect(n?.body).toContain("Importation → Full process");
    expect(n?.body).toContain(ref);
    expect(n?.body).toContain(dci);
  });

  it("titre générique dès que plusieurs champs bougent", () => {
    const n = structuralNotice(ref, dci, [
      { field: "manufacturingStatus", label: "Statut de fabrication", from: "A", to: "B" },
      { field: "companyId", label: "Entité", from: "Adventum", to: "Pharmagène" },
    ]);
    expect(n?.title).toBe("Votre dossier a été mis à jour");
    expect(n?.body).toContain("·");
  });
});
