import { describe, it, expect } from "vitest";
import { sponsoringCreateFields, promoMaterialCreateFields, toPeople } from "./create-fields";

const PM = [{ id: "pm-1", name: "Sofia" }, { id: "pm-2", name: "Karim" }];
const names = (fields: { name: string }[]) => fields.map((f) => f.name);
const find = (fields: { name: string }[], name: string) => fields.find((f) => f.name === name);

describe("Le formulaire de sponsoring", () => {
  it("demande toujours l'institution et accepte plusieurs pièces", () => {
    const f = sponsoringCreateFields({ productManagers: [], canDesignatePM: false, canChooseAnalysis: false });
    expect(find(f, "institution")).toMatchObject({ required: true });
    // La demande du médecin est LA pièce que tout le circuit va lire : elle se joint dès l'origine.
    expect(find(f, "files")).toMatchObject({ type: "file", multiple: true });
  });

  it("ne montre AUCUN champ de circuit à qui ne désigne pas", () => {
    // Un délégué qui verrait « chef de produit » croirait pouvoir court-circuiter son propre
    // responsable — le champ n'existe pas pour lui.
    const f = sponsoringCreateFields({ productManagers: PM, canDesignatePM: false, canChooseAnalysis: false });
    expect(names(f)).not.toContain("productManagerId");
    expect(names(f)).not.toContain("viaProductManager");
  });

  it("n'offre pas de désigner quand il n'y a personne à désigner", () => {
    const f = sponsoringCreateFields({ productManagers: [], canDesignatePM: true, canChooseAnalysis: true });
    expect(names(f)).not.toContain("productManagerId");
  });

  it("le National Sales DOIT désigner — c'est l'étape qu'il remplace", () => {
    const f = sponsoringCreateFields({ productManagers: PM, canDesignatePM: true, canChooseAnalysis: false });
    expect(find(f, "productManagerId")).toMatchObject({ required: true });
    expect(names(f)).not.toContain("viaProductManager");
  });

  it("la Direction CHOISIT son circuit, et n'est donc pas tenue de désigner", () => {
    const f = sponsoringCreateFields({ productManagers: PM, canDesignatePM: true, canChooseAnalysis: true });
    expect(find(f, "viaProductManager")).toMatchObject({ defaultValue: "0" });
    expect(find(f, "productManagerId")).toMatchObject({ required: false });
  });

  it("le circuit passe AVANT le reste — on décide du chemin avant de décrire la demande", () => {
    const f = sponsoringCreateFields({ productManagers: PM, canDesignatePM: true, canChooseAnalysis: true });
    expect(names(f).slice(0, 2)).toEqual(["viaProductManager", "productManagerId"]);
  });
});

describe("Le formulaire de matériel promotionnel", () => {
  it("porte l'entité et l'assistante à notifier", () => {
    const f = promoMaterialCreateFields({
      companies: [{ value: "c1", label: "Adventum" }],
      assistants: [{ id: "u1", name: "Nadia" }],
    });
    expect(find(f, "companyId")).toMatchObject({ options: [{ value: "c1", label: "Adventum" }] });
    expect(find(f, "assistantId")).toMatchObject({ options: [{ value: "u1", label: "Nadia" }] });
    expect(find(f, "title")).toMatchObject({ required: true });
  });

  it("reste utilisable sans entité ni assistante connues", () => {
    const f = promoMaterialCreateFields({ companies: [], assistants: [] });
    expect(find(f, "title")).toMatchObject({ required: true });
  });
});

describe("Les listes de personnes", () => {
  it("se réduisent au strict nécessaire — le rôle ne descend pas jusqu'au navigateur pour rien", () => {
    expect(toPeople([{ id: "u1", name: "Nadia", role: "DIRECTION_ASSISTANT" }])).toEqual([{ id: "u1", name: "Nadia" }]);
  });
});
