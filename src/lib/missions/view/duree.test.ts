import { describe, expect, it } from "vitest";
import { ageHeures, depuis } from "@/lib/missions/view/duree";

/**
 * « Maintenant » est un ARGUMENT, jamais une lecture d'horloge cachée : un test qui devrait
 * dormir pour vérifier une durée ne vérifie rien qu'on puisse relire.
 */
const T0 = new Date("2026-09-08T12:00:00.000Z");
const avant = (ms: number) => new Date(T0.getTime() - ms);

describe("depuis", () => {
  it("dit « à l'instant » sous la minute — pas « il y a 0 min »", () => {
    expect(depuis(avant(30_000), T0)).toBe("à l'instant");
  });

  it("compte en minutes, puis en heures, puis en jours, puis en mois", () => {
    expect(depuis(avant(12 * 60_000), T0)).toBe("il y a 12 min");
    expect(depuis(avant(3 * 3_600_000), T0)).toBe("il y a 3 h");
    expect(depuis(avant(5 * 86_400_000), T0)).toBe("il y a 5 j");
    expect(depuis(avant(70 * 86_400_000), T0)).toBe("il y a 2 mois");
  });

  it("CESSE de compter les heures au-delà du jour", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : un format qui rendrait « il y a 74 h ». Exact, et
     * inutilisable : il faut diviser de tête pour comprendre « avant-hier ». Une précision
     * qu'on ne peut pas lire n'est pas de la précision.
     */
    expect(depuis(avant(74 * 3_600_000), T0)).toBe("il y a 3 j");
  });

  it("une date FUTURE n'est pas « il y a » — une échéance se dit « dans »", () => {
    const futur = new Date(T0.getTime() + 4 * 3_600_000);
    expect(depuis(futur, T0)).toBe("dans 4 h");
  });

  it("rend « — » sur une date illisible, sans jeter", () => {
    expect(depuis("pas une date", T0)).toBe("—");
  });
});

describe("ageHeures", () => {
  it("rend un NOMBRE, pas une phrase — c'est lui qui décide", () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : une garde qui relirait « il y a 3 j » pour décider. Une
     * décision qui dépend de l'orthographe d'un libellé casse au premier changement de
     * formulation, en silence.
     */
    expect(ageHeures(avant(90 * 60_000), T0)).toBeCloseTo(1.5, 5);
    expect(ageHeures(new Date(T0.getTime() + 3_600_000), T0)).toBe(0);
    expect(ageHeures("nawak", T0)).toBeNull();
  });
});
