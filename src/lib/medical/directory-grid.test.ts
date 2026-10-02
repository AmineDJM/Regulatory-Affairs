import { describe, it, expect } from "vitest";
import {
  ANNUAIRE_COLUMNS, annuaireHeaderRow, isAnnuaireField, validateAnnuaireValue,
  annuaireCell, composeDoctorName, ligneAnnuaire, estARattacher, type AnnuaireRow,
} from "./directory-grid";

describe("Les colonnes exactes de l'annuaire", () => {
  it("porte les en-têtes demandés, dans l'ordre", () => {
    expect(annuaireHeaderRow()).toEqual([
      "Nom", "Prénom", "Adresse", "Wilaya", "Potentiel", "Code postal",
      "Numéro de téléphone", "Spécialité 1", "Établissement", "Service", "Grade", "Mail", "Privé/Public",
    ]);
  });

  it("l'établissement et le service sont des LIENS vers l'annuaire des établissements (§118.172)", () => {
    // « Les annuaires des médecins et des pharmaciens doivent tous posséder un lien avec cet
    // annuaire pour la colonne établissement et la colonne service » — un texte libre ne lie rien.
    const etab = ANNUAIRE_COLUMNS.find((c) => c.field === "institution")!;
    const service = ANNUAIRE_COLUMNS.find((c) => c.field === "service")!;
    expect(etab.editor).toBe("reference");
    expect(etab.reference).toBe("etablissement");
    expect(service.editor).toBe("reference");
    expect(service.reference).toBe("service");
    // Leurs options ne sont PAS figées dans le module : elles dépendent de la ligne.
    expect(etab.options).toBeUndefined();
    expect(service.options).toBeUndefined();
    expect(isAnnuaireField("institution")).toBe(true);
    expect(isAnnuaireField("service")).toBe(true);
  });

  it("la « Ville » n'est plus une colonne de la feuille : la wilaya est le seul découpage", () => {
    // Décision de la Direction (09/2026) : un texte libre à côté d'une liste fermée de 58 noms
    // se tapait de trois façons pour le même endroit et ne servait ni au comptage ni au secteur.
    expect(annuaireHeaderRow()).not.toContain("Ville");
    expect(isAnnuaireField("city")).toBe(false);
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
  });

  it("un lien est un identifiant : vide le RETIRE, l'existence se vérifie en base", () => {
    expect(validateAnnuaireValue("institution", " ckx123 ")).toEqual({ ok: true, value: "ckx123" });
    expect(validateAnnuaireValue("institution", "")).toEqual({ ok: true, value: null });
    expect(validateAnnuaireValue("service", "")).toEqual({ ok: true, value: null });
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
    id: "d1", lastName: "MOUFFOK", firstName: "Amina", address: "12 rue X",
    wilaya: "Alger", potential: "VERY_HIGH", postalCode: "16000", phone: "0550112233",
    specialtyId: "sp1", specialty: "Cardiologie", title: "PROFESSEUR", email: "a@chu.dz", sector: "HOSPITAL",
    institutionId: "e1", institution: "CHU Mustapha", serviceId: "s1", service: "Cardiologie A",
  };

  it("un lien s'affiche et s'exporte par son NOM, jamais par son identifiant", () => {
    expect(annuaireCell(row, "institution")).toBe("CHU Mustapha");
    expect(annuaireCell(row, "service")).toBe("Cardiologie A");
    expect(annuaireCell({ ...row, institution: null, institutionId: null }, "institution")).toBe("");
  });

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

describe("La ligne d'un praticien — UNE traduction, pour la feuille et pour l'export (§118.172)", () => {
  const base = {
    id: "d1", lastName: "B", firstName: "K", address: null, wilaya: null, potential: "MEDIUM",
    postalCode: null, phone: null, specialty: null, specialtyRef: null, title: "AUTRE", email: null,
    sector: "HOSPITAL", custom: null,
  };

  it("le nom de l'établissement RATTACHÉ fait foi, pas le texte d'avant", () => {
    const r = ligneAnnuaire({
      ...base, institution: "chu mustapha (ancien texte)", institutionId: "e1", institutionRef: { name: "CHU Mustapha" },
      serviceId: "s1", serviceRef: { name: "Cardiologie" },
    });
    expect(r.institution).toBe("CHU Mustapha");
    expect(r.institutionId).toBe("e1");
    expect(r.service).toBe("Cardiologie");
    expect(r.serviceId).toBe("s1");
    expect(estARattacher(r)).toBe(false);
  });

  it("une fiche d'avant le lien garde son texte, et se dit « à rattacher »", () => {
    const r = ligneAnnuaire({ ...base, institution: "EPH Rouiba", institutionId: null, institutionRef: null, serviceId: null, serviceRef: null });
    expect(r.institution).toBe("EPH Rouiba");
    expect(r.institutionId).toBeNull();
    expect(estARattacher(r)).toBe(true);
  });

  it("sans établissement rattaché, aucun service ne s'affiche — un service n'existe que dans le sien", () => {
    const r = ligneAnnuaire({ ...base, institution: "EPH Rouiba", institutionId: null, institutionRef: null, serviceId: "s9", serviceRef: { name: "Orphelin" } });
    expect(r.service).toBeNull();
    expect(r.serviceId).toBeNull();
  });

  it("une fiche sans aucun établissement n'est pas « à rattacher »", () => {
    const r = ligneAnnuaire({ ...base, institution: null, institutionId: null, institutionRef: null, serviceId: null, serviceRef: null });
    expect(estARattacher(r)).toBe(false);
    expect(estARattacher({ institutionId: null, institution: "   " })).toBe(false);
  });

  it("la saisie libre de la spécialité l'emporte sur le référentiel, et les colonnes sur mesure voyagent", () => {
    const r = ligneAnnuaire({
      ...base, specialty: "Cardio interventionnelle", specialtyRef: { name: "Cardiologie" },
      institution: null, institutionId: null, serviceId: null, custom: { c_x: 3 },
    });
    expect(r.specialty).toBe("Cardio interventionnelle");
    expect(r.custom).toEqual({ c_x: 3 });
    expect(ligneAnnuaire({ ...base, specialtyRef: { name: "Cardiologie" }, institution: null, institutionId: null, serviceId: null }).specialty).toBe("Cardiologie");
  });
});
