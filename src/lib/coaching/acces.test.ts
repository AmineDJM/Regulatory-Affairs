import { describe, expect, it } from "vitest";
import {
  peutAdministrerLeCoaching, clauseFichesVisibles, peutCoacher, peutFinaliserFiche, peutLireFiche, peutModifierFiche,
  peutSupprimerFiche, ROLES_ADMINISTRATEURS, type FaitsFiche, type LecteurCoaching,
} from "./acces";

/**
 * QUI ADMINISTRE, QUI COACHE, QUI LIT (§118.157) — la règle pure, et la preuve que sa traduction
 * en filtre de liste dit EXACTEMENT la même chose.
 */

const DO: LecteurCoaching = { id: "do", administre: true, perimetre: "TOUT" };
const CONFIG: LecteurCoaching = { id: "mpm", administre: false, perimetre: "TOUT" };
const NS: LecteurCoaching = { id: "ns", administre: false, perimetre: { collaborateurs: ["ns", "kam1", "kam3"] } };
const NS2: LecteurCoaching = { id: "ns2", administre: false, perimetre: { collaborateurs: ["ns2", "kam2"] } };
const KAM1: LecteurCoaching = { id: "kam1", administre: false, perimetre: { collaborateurs: ["kam1"] } };
const KAM3: LecteurCoaching = { id: "kam3", administre: false, perimetre: { collaborateurs: ["kam3"] } };
/**
 * Un lecteur dont le périmètre NE le contient PAS. `resolveRepScope` y met aujourd'hui toujours la
 * personne elle-même, si bien que « le collaborateur lit SA fiche » était tenu DEUX fois — par la
 * branche explicite et par le périmètre — et qu'un sabotage de la branche explicite passait au vert
 * (§118.111, §118.140). Ce lecteur exerce la branche seule : la règle ne doit pas dépendre d'une
 * convention d'un autre module.
 */
const SOLO: LecteurCoaching = { id: "kam2", administre: false, perimetre: { collaborateurs: [] } };

const fiche = (p: Partial<FaitsFiche>): FaitsFiche => ({ collaboratorId: "kam1", managerId: "ns", createdById: "ns", status: "DRAFT", ...p });

describe("le directeur des opérations administre — les deux libellés du métier, plus le Super Admin", () => {
  it("rôle principal OU secondaire", () => {
    for (const r of ROLES_ADMINISTRATEURS) {
      expect(peutAdministrerLeCoaching({ role: r })).toBe(true);
      expect(peutAdministrerLeCoaching({ role: "MEDICAL_DELEGATE", secondaryRole: r })).toBe(true);
    }
    expect(ROLES_ADMINISTRATEURS).toContain("OPERATIONS_DIRECTOR");
    expect(ROLES_ADMINISTRATEURS).toContain("DIRECTION");
  });
  it("ni le National Sales, ni le Manager Promotion Médicale, ni le DG, ni un KAM n'administrent la grille", () => {
    for (const r of ["NATIONAL_SALES", "MEDICAL_PROMOTION_MANAGER", "GENERAL_MANAGER", "MEDICAL_DELEGATE", "FINANCE_BUDGET_MANAGER"]) {
      expect(peutAdministrerLeCoaching({ role: r }), r).toBe(false);
    }
  });
});

describe("coacher", () => {
  it("jamais soi-même — pas même l'administration", () => {
    expect(peutCoacher(DO, "do")).toBe(false);
    expect(peutCoacher(NS, "ns")).toBe(false);
  });
  it("l'administration et les configurateurs coachent tout le monde ; un superviseur, son équipe ; un KAM, personne", () => {
    expect(peutCoacher(DO, "kam2")).toBe(true);
    expect(peutCoacher(CONFIG, "kam2")).toBe(true);
    expect(peutCoacher(NS, "kam1")).toBe(true);
    expect(peutCoacher(NS, "kam2")).toBe(false);
    expect(peutCoacher(KAM1, "kam3")).toBe(false);
  });
});

describe("lire une fiche", () => {
  it("un BROUILLON : son auteur, son manager, l'administration — personne d'autre", () => {
    const b = fiche({ status: "DRAFT", createdById: "do", managerId: "ns" });
    expect(peutLireFiche(DO, b)).toBe(true);
    expect(peutLireFiche(NS, b)).toBe(true); // manager désigné
    expect(peutLireFiche(KAM1, b), "le collaborateur ne lit pas un brouillon").toBe(false);
    expect(peutLireFiche(CONFIG, b), "un configurateur ne lit pas le brouillon d'un autre").toBe(false);
    expect(peutLireFiche(NS2, b)).toBe(false);
  });
  it("une fiche FINALISÉE : le collaborateur, son superviseur, les configurateurs — jamais un collègue", () => {
    const f = fiche({ status: "FINALIZED" });
    expect(peutLireFiche(KAM1, f)).toBe(true);
    expect(peutLireFiche(NS, f)).toBe(true);
    expect(peutLireFiche(CONFIG, f)).toBe(true);
    expect(peutLireFiche(KAM3, f), "un pair de la même BU").toBe(false);
    expect(peutLireFiche(NS2, f), "le superviseur d'une autre BU").toBe(false);
  });
  it("le collaborateur lit SA fiche finalisée même quand son périmètre ne le contient pas — jamais son brouillon", () => {
    const sienne = fiche({ collaboratorId: "kam2", createdById: "ns2", managerId: "ns2" });
    expect(peutLireFiche(SOLO, { ...sienne, status: "FINALIZED" })).toBe(true);
    expect(peutLireFiche(SOLO, { ...sienne, status: "DRAFT" })).toBe(false);
    expect(peutLireFiche(SOLO, fiche({ status: "FINALIZED" })), "celle d'un autre").toBe(false);
  });
});

describe("modifier, finaliser, retirer", () => {
  it("l'auteur modifie son brouillon ; une fiche finalisée ne se modifie que par l'administration", () => {
    expect(peutModifierFiche(NS, fiche({ status: "DRAFT" }))).toBe(true);
    expect(peutModifierFiche(NS, fiche({ status: "FINALIZED" }))).toBe(false);
    expect(peutModifierFiche(DO, fiche({ status: "FINALIZED" }))).toBe(true);
    expect(peutModifierFiche(KAM1, fiche({ status: "DRAFT" }))).toBe(false);
    expect(peutModifierFiche(CONFIG, fiche({ status: "FINALIZED" }))).toBe(false);
  });
  it("finaliser : un brouillon, par son auteur, son manager ou l'administration", () => {
    expect(peutFinaliserFiche(NS, fiche({}))).toBe(true);
    expect(peutFinaliserFiche(DO, fiche({}))).toBe(true);
    expect(peutFinaliserFiche(DO, fiche({ status: "FINALIZED" }))).toBe(false);
    expect(peutFinaliserFiche(KAM1, fiche({}))).toBe(false);
  });
  it("retirer : l'auteur son brouillon ; une fiche finalisée, l'administration seule", () => {
    expect(peutSupprimerFiche(NS, fiche({ createdById: "ns" }))).toBe(true);
    expect(peutSupprimerFiche(NS, fiche({ createdById: "do", managerId: "ns" })), "manager désigné, pas auteur").toBe(false);
    expect(peutSupprimerFiche(NS, fiche({ status: "FINALIZED" }))).toBe(false);
    expect(peutSupprimerFiche(DO, fiche({ status: "FINALIZED" }))).toBe(true);
  });
});

/**
 * LA CLAUSE DE LISTE ≡ LA RÈGLE. Un petit évaluateur des SEULES formes que la clause emploie
 * (`{}`, `{ OR }`, égalité, `{ in }`) la rejoue sur un décor qui couvre chaque branche ; la liste
 * de chaque lecteur doit être exactement ce que `peutLireFiche` accepte. Le banc en base refait
 * la même comparaison avec la vraie requête.
 */
function correspond(clause: Record<string, unknown>, f: FaitsFiche & { id: string }): boolean {
  return Object.entries(clause).every(([cle, v]) => {
    if (cle === "OR") return (v as Record<string, unknown>[]).some((c) => correspond(c, f));
    const valeur = (f as unknown as Record<string, unknown>)[cle];
    if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(valeur);
    return valeur === v;
  });
}

describe("la clause de liste dit exactement ce que dit la règle", () => {
  const decor: (FaitsFiche & { id: string })[] = [];
  let n = 0;
  for (const status of ["DRAFT", "FINALIZED"] as const) {
    for (const collaboratorId of ["kam1", "kam2", "kam3", "ns"]) {
      for (const auteur of ["ns", "ns2", "do", "mpm"]) {
        decor.push({ id: `f${n++}`, status, collaboratorId, createdById: auteur, managerId: auteur === "do" ? "ns" : auteur });
      }
    }
  }
  for (const [nom, l] of Object.entries({ DO, CONFIG, NS, NS2, KAM1, KAM3, SOLO })) {
    it(`${nom} : liste ≡ peutLireFiche`, () => {
      const parClause = decor.filter((f) => correspond(clauseFichesVisibles(l), f)).map((f) => f.id);
      const parRegle = decor.filter((f) => peutLireFiche(l, f)).map((f) => f.id);
      expect(parClause).toEqual(parRegle);
    });
  }
  it("PRÉMISSE : le décor fait réellement diverger les lecteurs — sinon l'égalité ne prouverait rien", () => {
    const tailles = [DO, CONFIG, NS, NS2, KAM1, KAM3, SOLO].map((l) => decor.filter((f) => peutLireFiche(l, f)).length);
    expect(new Set(tailles).size).toBeGreaterThanOrEqual(4);
    expect(Math.min(...tailles)).toBeGreaterThan(0);
    expect(Math.max(...tailles)).toBe(decor.length);
  });
});
