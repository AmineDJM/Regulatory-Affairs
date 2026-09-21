import { describe, it, expect } from "vitest";
import { porteDgRequise, motifPorteDg } from "./ad-pro";
import { dgRequis } from "@/lib/workflow/parcours";

/**
 * LA RÈGLE DU SEUIL — et les DEUX lecteurs qui ne peuvent pas se parler.
 *
 * Ce banc existe parce que la règle était écrite DEUX FOIS (§118.138) : `dgRequis` dans le
 * domaine `tasks`, la même arithmétique recopiée dans `etapeApplicable` du domaine `adpro`.
 * Vérifier le corps de la fonction ne prouverait donc rien — c'est le PARTAGE qu'il faut
 * exercer (§118.49), et la seule façon honnête est de faire passer les mêmes cas par les deux
 * portes réelles.
 */
describe("le seuil Ad & Pro — une seule règle, trois lecteurs", () => {
  it("« à partir de X » se lit STRICTEMENT au-dessus de X", () => {
    expect(porteDgRequise(1_000_000, 1_000_000)).toBe(false);
    expect(porteDgRequise(1_000_001, 1_000_000)).toBe(true);
    expect(porteDgRequise(999_999, 1_000_000)).toBe(false);
  });

  it("aucun seuil réglé DÉSARME la porte — un seuil à 0 dit « plus de validation DG »", () => {
    for (const seuil of [null, undefined, 0, -1]) {
      expect(porteDgRequise(5_000_000, seuil)).toBe(false);
    }
  });

  it("un montant INCONNU ouvre la porte — on ne franchit pas un contrôle sur une absence", () => {
    for (const montant of [null, undefined, 0, -1]) {
      expect(porteDgRequise(montant, 1_000_000)).toBe(true);
    }
  });

  /**
   * LE CAS QUI FERAIT TOMBER CETTE ASSERTION (§118.17) : quelqu'un réécrit l'arithmétique dans
   * `parcours.ts` au lieu de réexporter la règle du socle. Les deux lectures divergeraient, et
   * le symptôme serait un matériel promotionnel de 1,2 M franchissant la porte qu'un sponsoring
   * du même montant respecte.
   */
  it("`dgRequis` du domaine `tasks` EST la règle du socle, pas une copie qui s'accorde", () => {
    const cas: [number | null, number | null][] = [
      [1_000_000, 1_000_000], [1_000_001, 1_000_000], [0, 1_000_000],
      [null, 1_000_000], [5_000_000, null], [5_000_000, 0], [1, 1],
    ];
    for (const [montant, seuil] of cas) {
      expect(dgRequis(montant, seuil), `montant=${montant} seuil=${seuil}`)
        .toBe(porteDgRequise(montant, seuil));
    }
    // Et la MÊME référence de fonction : une copie qui s'accorde aujourd'hui passerait la
    // boucle ci-dessus et divergerait demain. C'est l'identité qu'on exige.
    expect(dgRequis).toBe(porteDgRequise);
  });

  it("la phrase se TAIT quand la porte ne s'applique pas — une réserve permanente devient du bruit", () => {
    expect(motifPorteDg(999_999, 1_000_000)).toBeNull();
    expect(motifPorteDg(5_000_000, null)).toBeNull();
  });

  it("un montant INCONNU a sa PROPRE phrase — « au-dessus de 1 000 000 » y serait faux", () => {
    const sans = motifPorteDg(null, 1_000_000);
    expect(sans).toContain("Montant non renseigné");
    expect(sans).not.toMatch(/au-dessus du seuil/);

    const avec = motifPorteDg(1_200_000, 1_000_000);
    expect(avec).toContain("au-dessus du seuil");
    // Les nombres sont comparés avec la MÊME mise en forme que celle du module, jamais avec un
    // séparateur écrit à la main : `toLocaleString("fr-FR")` sépare les milliers par U+202F
    // (espace insécable étroite) et non par une espace ordinaire. Un juge qui redérive la forme
    // de ce qu'il vérifie divergera de sa source (§118.120) — mesuré : ce test a d'abord échoué
    // sur une phrase PARFAITEMENT juste.
    expect(avec).toContain((1_200_000).toLocaleString("fr-FR"));
    expect(avec).toContain((1_000_000).toLocaleString("fr-FR"));
  });
});
