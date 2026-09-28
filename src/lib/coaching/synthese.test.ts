import { describe, expect, it } from "vitest";
import { GRILLE_PAR_DEFAUT, type GrilleCoaching, type Points } from "./grille";
import { syntheseParAxe, syntheseParCollaborateur, type FichePourSynthese } from "./synthese";

const jour = (s: string) => new Date(`${s}T00:00:00.000Z`);
const fiche = (p: Partial<FichePourSynthese> & { notes: Record<string, Points> }): FichePourSynthese => ({
  collaboratorId: "kam1", collaborateur: "Amel Haddad", visitDate: jour("2026-09-01"), status: "FINALIZED", grille: GRILLE_PAR_DEFAUT, ...p,
});
const complet = (n: Points): Record<string, Points> => ({ A: n, B: n, C: n, D: n, E: n });

describe("la synthèse par collaborateur", () => {
  it("un brouillon ne compte pas : il bougerait une moyenne que personne n'a arrêtée", () => {
    const lignes = syntheseParCollaborateur([
      fiche({ notes: complet(3) }),
      fiche({ status: "DRAFT", notes: complet(1), visitDate: jour("2026-09-20") }),
    ]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.fiches).toBe(1);
    expect(lignes[0]!.derniere.total).toBe(15);
  });

  it("la dernière tournée, la moyenne et la tendance — en part du maximum", () => {
    const [l] = syntheseParCollaborateur([
      fiche({ notes: complet(2), visitDate: jour("2026-06-01") }), // 10/20 = 50 %
      fiche({ notes: complet(3), visitDate: jour("2026-09-01") }), // 15/20 = 75 %
    ]);
    expect(l!.derniere.date.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(l!.derniere.pct).toBe(75);
    expect(l!.moyennePct).toBe(63);
    expect(l!.tendance).toBe("hausse");
  });

  it("deux grilles de tailles différentes se comparent en pourcentage, pas en points", () => {
    const six: GrilleCoaching = structuredClone(GRILLE_PAR_DEFAUT);
    six.axes.push({ ...six.axes[0]!, cle: "F", titre: "F. Suivi" });
    const [l] = syntheseParCollaborateur([
      fiche({ notes: complet(3), visitDate: jour("2026-06-01") }), // 15/20 = 75 %
      fiche({ grille: six, notes: { ...complet(3), F: 3 }, visitDate: jour("2026-09-01") }), // 18/24 = 75 %
    ]);
    expect(l!.derniere.total).toBe(18);
    expect(l!.derniere.max).toBe(24);
    expect(l!.tendance, "18/24 et 15/20 disent la même chose : 75 %").toBe("stable");
  });

  it("une baisse se voit", () => {
    const [l] = syntheseParCollaborateur([
      fiche({ notes: complet(3), visitDate: jour("2026-06-01") }),
      fiche({ notes: complet(2), visitDate: jour("2026-09-01") }),
    ]);
    expect(l!.tendance).toBe("baisse");
  });
});

describe("la synthèse par axe", () => {
  it("un axe se reconnaît à sa CLÉ d'une version à l'autre, et seuls les axes en vigueur sont montrés", () => {
    const renomme: GrilleCoaching = structuredClone(GRILLE_PAR_DEFAUT);
    renomme.axes[0]!.titre = "A. Préparation et ciblage";
    renomme.axes = renomme.axes.filter((a) => a.cle !== "E");
    const lignes = syntheseParAxe([
      fiche({ notes: { ...complet(2), A: 1 } }),
      fiche({ notes: { ...complet(4), A: 3 }, grille: renomme }),
      fiche({ notes: complet(4), status: "DRAFT" }),
    ], renomme);
    expect(lignes.map((l) => l.cle)).toEqual(["A", "B", "C", "D"]);
    expect(lignes[0]).toMatchObject({ titre: "A. Préparation et ciblage", moyenne: 2, notes: 2 });
    expect(lignes[1]).toMatchObject({ moyenne: 3, notes: 2 });
  });
});
