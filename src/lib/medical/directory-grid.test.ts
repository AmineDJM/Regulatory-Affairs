import { describe, it, expect } from "vitest";
import {
  ANNUAIRE_COLUMNS, annuaireHeaderRow, isAnnuaireField, validateAnnuaireValue,
  annuaireCell, composeDoctorName, type AnnuaireRow,
} from "./directory-grid";

describe("Les colonnes exactes de l'annuaire", () => {
  it("porte les en-têtes demandés, dans l'ordre", () => {
    expect(annuaireHeaderRow()).toEqual([
      "Nom", "Prénom", "Adresse", "Ville", "Wilaya", "Potentiel", "Code postal",
      "Numéro de téléphone", "Spécialité 1", "Grade", "Mail", "Privé/Public",
    ]);
  });

  it("les menus déroulants portent leurs options, le texte n'en a pas", () => {
    const wilaya = ANNUAIRE_COLUMNS.find((c) => c.field === "wilaya")!;
    expect(wilaya.editor).toBe("select");
    expect(wilaya.options).toHaveLength(58); // les 58 wilayas
    const nom = ANNUAIRE_COLUMNS.find((c) => c.field === "lastName")!;
    expect(nom.editor).toBe("text");
    expect(nom.options).toBeUndefined();
  });
});

describe("Reconnaître un champ éditable — garde de l'action serveur", () => {
  it("accepte les vrais champs, refuse le reste", () => {
    expect(isAnnuaireField("wilaya")).toBe(true);
    expect(isAnnuaireField("email")).toBe(true);
    expect(isAnnuaireField("id")).toBe(false);
    expect(isAnnuaireField("companyId")).toBe(false);
    expect(isAnnuaireField(null)).toBe(false);
  });
});

describe("Valider une valeur avant de l'écrire", () => {
  it("une wilaya doit appartenir à la liste fermée", () => {
    expect(validateAnnuaireValue("wilaya", "Alger")).toEqual({ ok: true, value: "Alger" });
    expect(validateAnnuaireValue("wilaya", "  Oran ")).toEqual({ ok: true, value: "Oran" });
    expect(validateAnnuaireValue("wilaya", "")).toEqual({ ok: true, value: null }); // effacée
    expect(validateAnnuaireValue("wilaya", "Algr").ok).toBe(false); // faute → refusée
  });

  it("les enum n'acceptent que leurs codes", () => {
    expect(validateAnnuaireValue("potential", "VERY_HIGH")).toEqual({ ok: true, value: "VERY_HIGH" });
    expect(validateAnnuaireValue("title", "PROFESSEUR")).toEqual({ ok: true, value: "PROFESSEUR" });
    expect(validateAnnuaireValue("sector", "HOSPITAL")).toEqual({ ok: true, value: "HOSPITAL" });
    expect(validateAnnuaireValue("sector", "Public").ok).toBe(false); // libellé ≠ code
    expect(validateAnnuaireValue("potential", "").ok).toBe(false); // un niveau ne se vide pas
  });

  it("le texte est mis au propre ; vide devient absence", () => {
    expect(validateAnnuaireValue("email", "  a.b@chu.dz ")).toEqual({ ok: true, value: "a.b@chu.dz" });
    expect(validateAnnuaireValue("address", "  ")).toEqual({ ok: true, value: null });
    expect(validateAnnuaireValue("phone", "0550  11  22")).toEqual({ ok: true, value: "0550 11 22" });
  });
});

describe("Afficher une cellule — écran et export disent la même chose", () => {
  const row: AnnuaireRow = {
    id: "d1", lastName: "MOUFFOK", firstName: "Amina", address: "12 rue X", city: "Alger",
    wilaya: "Alger", potential: "VERY_HIGH", postalCode: "16000", phone: "0550112233",
    specialty: "Cardiologie", title: "PROFESSEUR", email: "a@chu.dz", sector: "HOSPITAL",
  };

  it("traduit les menus déroulants, rend le texte tel quel", () => {
    expect(annuaireCell(row, "potential")).toBe("Très haut");
    expect(annuaireCell(row, "title")).toBe("Professeur");
    expect(annuaireCell(row, "sector")).toBe("Hôpital / Public");
    expect(annuaireCell(row, "wilaya")).toBe("Alger");
    expect(annuaireCell(row, "lastName")).toBe("MOUFFOK");
    expect(annuaireCell(row, "specialty")).toBe("Cardiologie");
  });

  it("une cellule vide rend une chaîne vide, pas « null »", () => {
    expect(annuaireCell({ ...row, email: null }, "email")).toBe("");
    expect(annuaireCell({ ...row, wilaya: null }, "wilaya")).toBe("");
  });
});

describe("Recomposer le nom d'affichage", () => {
  it("assemble prénom et nom, tolère les manquants", () => {
    expect(composeDoctorName("Amina", "MOUFFOK")).toBe("Amina MOUFFOK");
    expect(composeDoctorName(null, "MOUFFOK")).toBe("MOUFFOK");
    expect(composeDoctorName("Amina", null)).toBe("Amina");
    expect(composeDoctorName("  ", "  ")).toBe("");
  });
});
