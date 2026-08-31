import { describe, it, expect } from "vitest";
import { centreCounters, centreValidatorFrom, sitsOnValidationCentre, sortForCentre, type CentreValidationLike } from "./centre";

const J = 86_400_000;
const MAINTENANT = new Date("2026-09-10T09:00:00Z");
const il_y_a = (n: number) => new Date(MAINTENANT.getTime() - n * J).toISOString();
const dans = (n: number) => new Date(MAINTENANT.getTime() + n * J).toISOString();

const ligne = (p: Partial<CentreValidationLike>): CentreValidationLike =>
  ({ actionable: true, deadline: null, createdAt: il_y_a(1), ...p });

describe("qui siège au centre de validations", () => {
  it("le Directeur Général et le Super Admin, personne d'autre", () => {
    expect(sitsOnValidationCentre({ role: "GENERAL_MANAGER" })).toBe(true);
    expect(sitsOnValidationCentre({ role: "SUPER_ADMIN" })).toBe(true);
  });

  it("PAS le PDG : le centre de PAIEMENT est le sien", () => {
    // Donner les deux à la même personne referait l'écran fourre-tout qu'on vient de découper.
    expect(sitsOnValidationCentre({ role: "DIRECTION" })).toBe(false);
    expect(sitsOnValidationCentre({ role: "OPERATIONS_DIRECTOR" })).toBe(false);
    expect(sitsOnValidationCentre({ role: "FINANCE_BUDGET_MANAGER" })).toBe(false);
    expect(sitsOnValidationCentre({ role: "VIEWER" })).toBe(false);
  });
});

describe("les compteurs du centre", () => {
  it("« en retard » ne compte QUE ce qui est décidable maintenant", () => {
    // Une demande qui attend le validateur précédent n'est pas en retard de MON fait : la
    // compter ferait porter le chapeau à celui qui n'a pas encore la main.
    const rows = [
      ligne({ actionable: true, deadline: il_y_a(3) }),
      ligne({ actionable: false, deadline: il_y_a(9) }),
    ];
    const c = centreCounters(rows, MAINTENANT);
    expect(c.aDecider).toBe(1);
    expect(c.aVenir).toBe(1);
    expect(c.enRetard).toBe(1);
  });

  it("une échéance à venir n'est pas un retard", () => {
    expect(centreCounters([ligne({ deadline: dans(2) })], MAINTENANT).enRetard).toBe(0);
  });

  it("les DORMANTES attrapent celles que rien ne signale — sans échéance", () => {
    const rows = [
      ligne({ createdAt: il_y_a(9) }),   // dort depuis 9 jours, aucune échéance
      ligne({ createdAt: il_y_a(2) }),
      ligne({ actionable: false, createdAt: il_y_a(30) }), // pas ma main : pas mon problème
    ];
    const c = centreCounters(rows, MAINTENANT);
    expect(c.dormantes).toBe(1);
  });

  it("un centre vide ne compte rien", () => {
    expect(centreCounters([], MAINTENANT)).toEqual({ aDecider: 0, aVenir: 0, enRetard: 0, dormantes: 0 });
  });
});

describe("l'ordre d'affichage", () => {
  it("ce qui BLOQUE passe avant ce qui attend quelqu'un d'autre", () => {
    const rows = [
      ligne({ actionable: false, deadline: il_y_a(10), createdAt: il_y_a(10) }),
      ligne({ actionable: true, deadline: dans(30), createdAt: il_y_a(1) }),
    ];
    expect(sortForCentre(rows)[0].actionable).toBe(true);
  });

  it("une demande SANS échéance ne passe pas devant une demande datée", () => {
    // Ne pas avoir donné de date n'est pas une urgence.
    const datee = ligne({ deadline: dans(5), createdAt: il_y_a(1) });
    const sansDate = ligne({ deadline: null, createdAt: il_y_a(20) });
    expect(sortForCentre([sansDate, datee])[0]).toBe(datee);
  });

  it("à échéance égale, la plus ANCIENNE d'abord — c'est elle qui attend le plus", () => {
    const vieille = ligne({ deadline: dans(3), createdAt: il_y_a(12) });
    const recente = ligne({ deadline: dans(3), createdAt: il_y_a(1) });
    expect(sortForCentre([recente, vieille])[0]).toBe(vieille);
  });

  it("le tri ne modifie pas le tableau d'origine", () => {
    const rows = [ligne({ actionable: false }), ligne({ actionable: true })];
    const copie = [...rows];
    sortForCentre(rows);
    expect(rows).toEqual(copie);
  });
});

describe("à qui part une validation envoyée « au centre »", () => {
  const dg = { id: "dg", role: "GENERAL_MANAGER" };
  const sa = { id: "sa", role: "SUPER_ADMIN" };
  const autre = { id: "x", role: "FINANCE_BUDGET_MANAGER" };

  it("au Directeur Général quand il y en a un — la décision lui revient", () => {
    expect(centreValidatorFrom([autre, sa, dg])).toBe("dg");
  });

  it("au Super Admin à défaut de DG actif", () => {
    expect(centreValidatorFrom([autre, sa])).toBe("sa");
  });

  it("UNE SEULE personne, jamais les deux", () => {
    // Deux validateurs = deux signatures exigées : deux personnes qui regardent le même écran
    // signeraient deux fois la même décision, et le dossier s'arrêterait dès que l'une s'absente.
    const cible = centreValidatorFrom([dg, sa]);
    expect(cible).toBe("dg");
    expect(cible).not.toBe("sa");
  });

  it("un compte DÉSACTIVÉ ne reçoit rien — la demande dormirait chez un absent", () => {
    expect(centreValidatorFrom([{ ...dg, isActive: false }, sa])).toBe("sa");
    expect(centreValidatorFrom([{ ...dg, isActive: false }, { ...sa, isActive: false }])).toBeNull();
  });

  it("personne qui siège : `null`, et l'appelant devra le dire", () => {
    expect(centreValidatorFrom([autre])).toBeNull();
    expect(centreValidatorFrom([])).toBeNull();
  });
});
