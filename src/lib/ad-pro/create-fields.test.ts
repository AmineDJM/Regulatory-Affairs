import { describe, it, expect } from "vitest";
import { sponsoringCreateFields, promoMaterialCreateFields, toPeople } from "./create-fields";

const names = (fields: { name: string }[]) => fields.map((f) => f.name);
const find = (fields: { name: string }[], name: string) => fields.find((f) => f.name === name);

describe("Le formulaire de sponsoring", () => {
  it("demande toujours l'institution et accepte plusieurs pièces", () => {
    const f = sponsoringCreateFields({});
    expect(find(f, "institution")).toMatchObject({ required: true });
    // La demande du médecin est LA pièce que tout le circuit va lire : elle se joint dès l'origine.
    expect(find(f, "files")).toMatchObject({ type: "file", multiple: true });
  });

  it("AUCUNE nouvelle demande ne propose de nommer un référent Direction Marketing", () => {
    // Décision de la Direction (22/09/2026) : « on n'a pas besoin d'un référent Direction
    // Marketing, ça va DIRECT chez le directeur/directrice du département marketing. »
    //
    // Les deux réglages de circuit ont disparu ensemble et pour la même raison : ils ne
    // changeaient plus rien. L'arbitrage est porté par le RÔLE Direction Marketing tout entier —
    // l'étape le dit dans sa portée — et Direction Marketing tranche TOUTE demande Ad & Pro
    // depuis l'inversion (§118.138). Ce qui le ferait tomber : réintroduire l'un des deux menus
    // sans lui rendre un effet, c'est-à-dire un mensonge fait à qui le règle (§118.14).
    for (const f of [
      sponsoringCreateFields({}),
      promoMaterialCreateFields({ companies: [], assistants: [] }),
    ]) {
      expect(names(f)).not.toContain("productManagerId");
      expect(names(f)).not.toContain("viaProductManager");
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────────────────
  // LES CHAMPS QUE LA DIRECTION A RENDUS OBLIGATOIRES (09/2026)
  // ─────────────────────────────────────────────────────────────────────────────────────────

  it("la demande du médecin est OBLIGATOIRE, en scan PDF ou Word, et porte la mention du secrétariat", () => {
    // Ce qui le ferait tomber : rendre la pièce facultative. C'est le document que tout le
    // circuit lit — le National Sales pour juger l'opportunité, Direction Marketing pour
    // arbitrer le budget — et sans lui chaque demande repartait par la messagerie.
    const f = sponsoringCreateFields({});
    const piece = find(f, "files");
    expect(piece).toMatchObject({ type: "file", required: true, multiple: true, accept: ".pdf,.doc,.docx" });
    expect((piece as unknown as { hint?: string }).hint).toContain("bureau du secrétariat");
  });

  it("médecins, produits et wilaya sont OBLIGATOIRES — dans le référentiel comme en saisie libre", () => {
    const avec = sponsoringCreateFields({
      doctors: [{ id: "d1", name: "Dr Benali", specialty: "Cardiologie", city: "Alger" }],
      products: [{ id: "p1", brandName: "Nivolex", dci: "nivolumab", status: "DECISION_OBTAINED" }],
    });
    expect(find(avec, "doctorIds")).toMatchObject({ type: "multiselect", required: true });
    expect(find(avec, "productIds")).toMatchObject({ type: "multiselect", required: true });
    expect(find(avec, "city")).toMatchObject({ type: "select", required: true });
    // LE REPLI EN SAISIE LIBRE RESTE OBLIGATOIRE, LUI AUSSI : un référentiel vide ne dispense
    // pas de nommer le médecin — il change seulement la façon de le nommer.
    const sans = sponsoringCreateFields({});
    expect(find(sans, "doctor")).toMatchObject({ type: "text", required: true });
    expect(find(sans, "product")).toMatchObject({ type: "text", required: true });
  });

  it("la spécialité est un MENU DÉROULANT nourri par le référentiel ET les fiches héritées", () => {
    const f = sponsoringCreateFields({
      specialties: [{ name: "Cardiologie" }], specialtiesHeritees: ["Infectiologie", "cardiologie"],
    });
    const spec = find(f, "specialty") as unknown as { type: string; required: boolean; options: { value: string }[] };
    expect(spec.type).toBe("select");
    expect(spec.required).toBe(true);
    // Le référentiel fait autorité sur la casse ; une spécialité portée par les seules fiches
    // reste choisissable — sinon une demande légitime est refusée pour une ligne de table
    // manquante, et c'est le référentiel qui décide qui peut demander quoi.
    expect(spec.options.map((o) => o.value)).toEqual(["Cardiologie", "Infectiologie"]);
  });

  it("référentiel de spécialités VIDE : la saisie redevient libre, mais reste obligatoire", () => {
    // Un menu sans option est un cul-de-sac : ce qui le ferait tomber est un `select` vide, qui
    // rendrait toute demande impossible à envoyer.
    const f = sponsoringCreateFields({});
    expect(find(f, "specialty")).toMatchObject({ type: "text", required: true });
  });

  it("type, budgets et importance sont OBLIGATOIRES — et n'ont plus de valeur pré-remplie", () => {
    // LE DÉFAUT MESURÉ : « Type » valait « Congrès » et « Importance stratégique » valait
    // « Moyenne » par défaut. Une demande envoyée sans y toucher sortait donc avec une nature et
    // une priorité que personne n'avait décidées — et c'est sur elles que l'arbitrage se fait.
    const f = sponsoringCreateFields({});
    for (const nom of ["type", "strategicImportance"]) {
      const champ = find(f, nom) as unknown as { required?: boolean; defaultValue?: string; placeholder?: string };
      expect(champ.required, nom).toBe(true);
      expect(champ.defaultValue, `${nom} : une valeur pré-remplie EST une décision prise à la place du demandeur`).toBeUndefined();
      expect(champ.placeholder, nom).toContain("Choisir");
    }
    expect(find(f, "amountRequested")).toMatchObject({ required: true });
    expect(find(f, "amountProposed")).toMatchObject({ required: true });
  });

  it("la Business Unit DÉDUITE ne propose que celle-là, et DIT pourquoi", () => {
    // Ce qui le ferait tomber : garder la liste entière. Le champ resterait un menu libre, et
    // un KAM pourrait faire peser sa dépense sur le budget Ad&Pro d'une autre gamme — le
    // serveur l'impose de son côté, mais l'écran ne doit pas proposer ce qu'il refusera.
    const f = sponsoringCreateFields({
      businessUnits: [{ id: "bu1", name: "Oncologie" }, { id: "bu2", name: "Cardiologie" }],
      businessUnitDeduite: { id: "bu1", name: "Oncologie", raison: "Votre gamme — rattachement de votre fiche force de vente." },
    });
    const bu = find(f, "businessUnitId") as unknown as { options: { value: string }[]; defaultValue: string; hint: string };
    expect(bu.options.map((o) => o.value)).toEqual(["bu1"]);
    expect(bu.defaultValue).toBe("bu1");
    expect(bu.hint).toContain("force de vente");
  });

  it("Business Unit NON déduite : le choix reste manuel sur la liste entière", () => {
    const f = sponsoringCreateFields({
      businessUnits: [{ id: "bu1", name: "Oncologie" }, { id: "bu2", name: "Cardiologie" }],
      businessUnitDeduite: null,
    });
    const bu = find(f, "businessUnitId") as unknown as { options: { value: string }[]; placeholder?: string };
    expect(bu.options.map((o) => o.value)).toEqual(["bu1", "bu2"]);
    expect(bu.placeholder).toContain("Choisir la gamme");
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
