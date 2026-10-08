import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  agregerMasseSalariale, estDirectionDesOperations, imputerPaie, moisDeLaPeriode, rattacherForceDeVente, CATEGORIES_OPERATIONS,
  CLE_MASSE_SALARIALE, DIRECTION_OPERATIONS, HORS_BU,
  type LignePaie,
} from "./force-de-vente";

/**
 * BUDGET OPERATIONS & SALES — la masse salariale de la force de vente : qui en fait partie, où va chaque ligne de paie,
 * et la règle qui ne laisse jamais sortir le salaire d'une personne vers qui ne voit pas les salaires.
 */

const rattachement = rattacherForceDeVente({
  employes: [
    { id: "kam1", userId: "u-kam1", departmentId: null },
    { id: "kam2", userId: "u-kam2", departmentId: "dep-fin" },
    { id: "sup", userId: "u-sup", departmentId: null },
    { id: "bu-membre", userId: null, departmentId: "dep-bu-onco-equipe" },
    { id: "dircom", userId: null, departmentId: "dep-com" },
    { id: "kam-sans-bu", userId: "u-kam3", departmentId: null },
    { id: "comptable", userId: "u-cpt", departmentId: "dep-fin" },
    { id: "ancien-kam", userId: "u-old", departmentId: null },
  ],
  profils: [
    { repId: "u-kam1", businessUnitId: "onco", isActive: true },
    { repId: "u-kam2", businessUnitId: "cardio", isActive: true },
    { repId: "u-kam3", businessUnitId: null, isActive: true },
    { repId: "u-old", businessUnitId: "onco", isActive: false },
  ],
  bus: [
    { id: "onco", supervisorId: "u-sup", departmentId: "dep-bu-onco" },
    { id: "cardio", supervisorId: null, departmentId: "dep-bu-cardio" },
  ],
  departements: [
    { id: "dep-com", parentId: null, commercial: true },
    { id: "dep-bu-onco", parentId: "dep-com", commercial: false },
    { id: "dep-bu-onco-equipe", parentId: "dep-bu-onco", commercial: false },
    { id: "dep-bu-cardio", parentId: "dep-com", commercial: false },
    { id: "dep-fin", parentId: null, commercial: false },
  ],
});

describe("qui est la force de vente", () => {
  it("profil KAM, supervision, sous-département de BU, Direction commerciale — personne d'autre", () => {
    expect(Object.fromEntries(rattachement)).toEqual({
      kam1: "onco", kam2: "cardio", sup: "onco", "bu-membre": "onco", dircom: HORS_BU, "kam-sans-bu": HORS_BU,
    });
    expect(rattachement.has("comptable")).toBe(false);
    expect(rattachement.has("ancien-kam"), "un profil inactif ne suffit pas").toBe(false);
  });

  it("une enveloppe neuve : la masse salariale d'abord, Ad & Pro jamais", () => {
    expect(CATEGORIES_OPERATIONS[0].cle).toBe(CLE_MASSE_SALARIALE);
    expect(CATEGORIES_OPERATIONS.some((c) => /ad\s*&\s*pro|sponsoring|congr/i.test(c.nom))).toBe(false);
  });
});

const L = (employeeId: string, month: number, cost: number, companyId: string | null = "adv"): LignePaie => ({ employeeId, year: 2027, month, cost, companyId });

describe("la Direction des opérations entre dans la masse salariale (10/2026)", () => {
  it("reconnaît le département sans casse ni accents, et le code", () => {
    for (const nom of ["Direction des opérations", "DIRECTION DES OPERATIONS", "Opérations", "Direction d'Opérations"]) {
      expect(estDirectionDesOperations({ name: nom, code: "X1" }), nom).toBe(true);
    }
    expect(estDirectionDesOperations({ name: "Chaîne", code: "DIR_OPS" })).toBe(true);
    expect(estDirectionDesOperations({ name: "Direction commerciale", code: "COMMERCIAL" })).toBe(false);
    expect(estDirectionDesOperations({ name: "Finances", code: "FIN" })).toBe(false);
  });

  const r = rattacherForceDeVente({
    employes: [
      { id: "ops1", userId: null, departmentId: "dep-ops" },
      { id: "ops-sous", userId: null, departmentId: "dep-ops-logistique" },
      { id: "dir-ops", userId: "u-dirops", departmentId: null, directeurOperations: true },
      { id: "kam-ops", userId: "u-kam", departmentId: "dep-ops" },
      { id: "bu-ops", userId: null, departmentId: "dep-bu" },
      { id: "cpt", userId: null, departmentId: "dep-fin" },
    ],
    profils: [{ repId: "u-kam", businessUnitId: "onco", isActive: true }],
    bus: [{ id: "onco", supervisorId: null, departmentId: "dep-bu" }],
    departements: [
      { id: "dep-ops", parentId: null, commercial: false, operations: true },
      { id: "dep-ops-logistique", parentId: "dep-ops", commercial: false },
      // Une BU rattachée sous la Direction des opérations reste dans SA BU.
      { id: "dep-bu", parentId: "dep-ops", commercial: false },
      { id: "dep-fin", parentId: null, commercial: false },
    ],
  });

  it("le département, ses sous-départements et le directeur : « Direction des opérations » ; une BU garde la sienne", () => {
    expect(Object.fromEntries(r)).toEqual({
      ops1: DIRECTION_OPERATIONS, "ops-sous": DIRECTION_OPERATIONS, "dir-ops": DIRECTION_OPERATIONS, "kam-ops": "onco", "bu-ops": "onco",
    });
  });

  it("le groupe est montré seul à partir de deux personnes, un seul détail nominatif jamais sans le droit", () => {
    const mois = moisDeLaPeriode(new Date(Date.UTC(2027, 0, 1)), new Date(Date.UTC(2027, 0, 31)));
    const lignes: LignePaie[] = ["ops1", "ops-sous", "dir-ops", "kam-ops", "bu-ops"].map((id) => ({ employeeId: id, year: 2027, month: 1, cost: 100, companyId: null }));
    const base = { lignes, rattachement: r, mois, nomsBu: new Map([["onco", "Oncologie"]]), budgetMere: 0, budgetParBu: new Map<string, number>() };
    const sans = agregerMasseSalariale({ ...base, voitLesSalaires: false });
    expect(sans.groupes.map((g) => [g.libelle, g.effectif])).toEqual([["Direction des opérations", 3], ["Oncologie", 2]]);
    expect("parPersonne" in sans).toBe(false);
    const avec = agregerMasseSalariale({ ...base, voitLesSalaires: true, nomsPersonnes: new Map([["ops1", "Karim O."]]) });
    expect(avec.groupes.map((g) => g.libelle)).toContain("Direction des opérations");
    expect(avec.total.total).toBe(500);
  });
});

describe("la paie dans les enveloppes", () => {
  const debut = new Date(Date.UTC(2027, 0, 1));
  const fin = new Date(Date.UTC(2027, 11, 31, 23, 59, 59));
  const cats = [
    { id: "mere", envelopeId: "e1", businessUnitId: null, debut, fin, companyId: "adv" },
    { id: "onco", envelopeId: "e1", businessUnitId: "onco", debut, fin, companyId: "adv" },
  ];

  it("la BU qui a sa sous-catégorie y va ; les autres dans la mère — jamais les deux", () => {
    const { parCategorie, parMois } = imputerPaie(
      [L("kam1", 1, 100), L("sup", 1, 200), L("kam2", 1, 50), L("dircom", 2, 70), L("comptable", 1, 999)],
      rattachement, cats,
    );
    expect(parCategorie.get("onco")).toBe(300);
    expect(parCategorie.get("mere")).toBe(120);
    const total = [...parCategorie.values()].reduce((a, v) => a + v, 0);
    expect(total, "le comptable n'est pas dans la masse commerciale").toBe(420);
    expect(parMois.find((r) => r.categoryId === "onco")).toMatchObject({ montant: 300, effectif: 2 });
    expect(Object.keys(parMois[0]).sort()).toEqual(["categoryId", "date", "effectif", "montant"]);
  });

  it("une enveloppe ne compte que SA période, SA société, et la période affichée", () => {
    const hors = imputerPaie([{ ...L("kam1", 1, 100), year: 2026 }, L("kam1", 2, 100, "autre-societe")], rattachement, cats);
    expect(hors.parCategorie.size).toBe(0);
    const borne = imputerPaie([L("kam1", 1, 100), L("kam1", 6, 100)], rattachement, cats, { from: new Date(Date.UTC(2027, 4, 1)) });
    expect(borne.parCategorie.get("onco")).toBe(100);
  });

  it("douze mois pour une enveloppe annuelle", () => {
    expect(moisDeLaPeriode(debut, fin).map((m) => m.cle)).toHaveLength(12);
    expect(moisDeLaPeriode(debut, fin)[0]).toMatchObject({ cle: "2027-01", libelle: "janv." });
  });
});

describe("la vue « Masse salariale » ne laisse pas sortir un salaire", () => {
  const mois = moisDeLaPeriode(new Date(Date.UTC(2027, 0, 1)), new Date(Date.UTC(2027, 11, 31)));
  const lignes = [L("kam1", 1, 150_000), L("sup", 1, 250_000), L("bu-membre", 1, 120_000), L("kam2", 1, 180_000), L("dircom", 1, 400_000), L("kam-sans-bu", 2, 90_000)];
  const base = {
    lignes, rattachement, mois,
    nomsBu: new Map([["onco", "Oncologie"], ["cardio", "Cardiologie"]]),
    budgetMere: 12_000_000,
    budgetParBu: new Map([["onco", 6_000_000], ["cardio", 2_400_000]]),
    nomsPersonnes: new Map([["kam1", "Amina K."], ["kam2", "Yacine B."], ["sup", "Samir S."], ["dircom", "Nadia D."]]),
  };

  it("sans le droit : des totaux, pas de détail, aucune ligne d'une seule personne", () => {
    const vue = agregerMasseSalariale({ ...base, voitLesSalaires: false });
    expect("parPersonne" in vue, "le détail n'est même pas sérialisé").toBe(false);
    const json = JSON.stringify(vue);
    for (const id of ["kam1", "kam2", "sup", "dircom", "Amina", "Yacine", "Samir", "Nadia"]) expect(json).not.toContain(id);
    for (const g of vue.groupes) expect(g.effectif, g.libelle).toBeGreaterThanOrEqual(2);
    // Cardiologie (1 personne) et la Direction commerciale (2 personnes, hors BU) : Cardiologie rejoint les petites
    // équipes, qui ne font elles-mêmes qu'une personne → comptée dans le total seulement.
    expect(vue.groupes.map((g) => g.libelle)).toEqual(["Oncologie", "Direction commerciale (hors BU)"]);
    expect(vue.personnesDansLeTotalSeulement).toBe(1);
    expect(vue.total.total).toBe(1_190_000);
    expect(vue.total.effectif).toBe(6);
    expect(vue.total.budget).toBe(12_000_000);
    expect(vue.budgetNonReparti).toBe(3_600_000);
  });

  it("avec le droit (qui gère les RH) : le détail par personne, et chaque BU telle quelle", () => {
    const vue = agregerMasseSalariale({ ...base, voitLesSalaires: true });
    expect(vue.parPersonne?.map((p) => p.nom)).toContain("Yacine B.");
    expect(vue.groupes.find((g) => g.libelle === "Cardiologie")).toMatchObject({ effectif: 1, total: 180_000, budget: 2_400_000 });
    expect(vue.parPersonne?.reduce((a, p) => a + p.total, 0)).toBe(vue.total.total);
  });

  it("le total est la somme des lignes visibles et de ce qui ne compte que dans le total", () => {
    const vue = agregerMasseSalariale({ ...base, voitLesSalaires: false });
    const visibles = vue.groupes.reduce((a, g) => a + g.total, 0);
    expect(vue.total.total - visibles).toBe(180_000);
  });

  it("l'écran et la requête lisent LA règle des salaires, et ne lisent les noms que pour qui les voit", () => {
    const requete = readFileSync("src/lib/queries/budget-operations.ts", "utf8");
    expect(requete).toMatch(/const voit = voitLesSalaires\(user\)/);
    expect(requete).toMatch(/const nomsPersonnes = voit\s*\n?\s*\?/);
    expect(requete).toMatch(/voitLesSalaires: voit/);
    const ecran = readFileSync("src/app/(app)/budget-operations/masse-salariale/page.tsx", "utf8");
    expect(ecran).toMatch(/donnees\.voitLesSalaires && donnees\.vue\.parPersonne/);
  });
});
