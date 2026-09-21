import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import { ROLE_LABELS } from "./labels";

/**
 * LES LIBELLÉS DE RÔLE — DISTINCTS DEUX À DEUX, ET AUCUN RÔLE SANS LIBELLÉ.
 *
 * Ce cliquet est né d'un libellé qu'on avait ROGNÉ par prudence. « Direction des opérations »
 * était devenu « Direction » tout court, avec une raison défendable écrite à côté : le Directeur
 * des Opérations est un rôle à part, et deux entrées portant le même nom dans un menu déroulant
 * de rôles sont la garantie d'attribuer le mauvais. La crainte était juste ; le remède était un
 * MOT amputé, c'est-à-dire une garde qu'aucun code ne tenait et qui mentait sur ce que le métier
 * appelle ce service. La Direction a rétabli le libellé (09/2026).
 *
 * Ce qui protège désormais, c'est un FAIT vérifié à chaque `npm test` — et il tient dans les deux
 * sens. Une garde qui n'exige que l'unicité laisserait un rôle SANS libellé s'afficher sous son
 * nom d'énumération (« MEDICAL_INFO_PHARMACIST ») dans un écran d'administration ; une garde qui
 * n'exige que l'exhaustivité laisserait revenir le doublon. Deux questions, deux assertions.
 *
 * LA NORMALISATION EST LA MOITIÉ DE LA RÈGLE. « Direction » et « direction », « Opérations » et
 * « Operations », « Direction  Marketing » et « Direction Marketing » ne sont pas des libellés
 * différents pour l'œil d'une personne devant une liste : ils le sont seulement pour `===`. On
 * compare donc en minuscules, accents pliés et espaces réduits — sinon le cliquet serait désarmé
 * en ayant l'air armé (§118.88), et c'est exactement la confusion qu'il existe pour empêcher.
 *
 * MESURÉ AVANT D'ÊTRE ÉCRIT : 19 rôles `UserRole`, 19 libellés, 0 doublon — marge ZÉRO, donc
 * pleinement armé. Ce qui le ferait tomber, nommément : rendre à `DIRECTION` le libellé
 * « Directeur des Opérations » (ou l'inverse) ; ajouter un rôle à `UserRole` sans son libellé ;
 * retirer la normalisation et laisser passer « DIRECTION MARKETING » à côté de
 * « Direction Marketing ».
 */

/** Ce qu'une personne LIT, pas ce que `===` compare : casse, accents et espaces neutralisés. */
function normaliser(libelle: string): string {
  return libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

describe("libellés de rôle", () => {
  it("chaque rôle de l'énumération porte un libellé", () => {
    const sans = (Object.keys(UserRole) as UserRole[]).filter((r) => !ROLE_LABELS[r]?.trim());
    expect(
      sans,
      `ces rôles n'ont pas de libellé dans ROLE_LABELS : ${sans.join(", ")} — ils s'afficheraient sous leur nom d'énumération.`,
    ).toEqual([]);
  });

  it("aucun libellé orphelin (un rôle retiré de l'énumération doit perdre son libellé)", () => {
    const roles = new Set(Object.keys(UserRole));
    const orphelins = Object.keys(ROLE_LABELS).filter((k) => !roles.has(k));
    expect(orphelins, `libellés sans rôle correspondant : ${orphelins.join(", ")}`).toEqual([]);
  });

  it("les libellés sont distincts deux à deux, pour l'œil comme pour le code", () => {
    const par = new Map<string, string[]>();
    for (const [role, libelle] of Object.entries(ROLE_LABELS)) {
      const clef = normaliser(libelle);
      par.set(clef, [...(par.get(clef) ?? []), role]);
    }
    const doublons = [...par.entries()].filter(([, roles]) => roles.length > 1);
    expect(
      doublons.map(([clef, roles]) => `« ${clef} » porté par ${roles.join(" + ")}`),
      "deux rôles portant le même libellé dans un menu déroulant, c'est la garantie d'attribuer le mauvais.",
    ).toEqual([]);
  });

  it("la normalisation attrape les collisions que `===` laisserait passer", () => {
    // MESURÉ : sur les 19 libellés d'aujourd'hui, 19 sont distincts SANS normalisation et 19
    // AVEC — donc aucune paire réelle ne collisionne seulement après normalisation, et retirer la
    // normalisation du cliquet ci-dessus ne le ferait PAS tomber. Ce cas-ci existe pour cela : il
    // exerce la propriété sur des paires CONSTRUITES, plutôt que de la déclarer sans l'éprouver
    // (§118.82). Sans lui, la moitié de la règle serait une affirmation, pas une assertion.
    expect(normaliser("Direction Marketing")).toBe(normaliser("DIRECTION MARKETING"));
    expect(normaliser("Direction des opérations")).toBe(normaliser("Direction des operations"));
    expect(normaliser("Direction  Marketing")).toBe(normaliser("Direction Marketing"));
    expect(normaliser(" Direction ")).toBe(normaliser("Direction"));
    // Et elle ne plie pas ce qui DOIT rester distinct : sinon elle refuserait des libellés justes.
    expect(normaliser("Direction des opérations")).not.toBe(normaliser("Directeur des Opérations"));
    expect(normaliser("National Sales")).not.toBe(normaliser("Direction Marketing"));
  });

  it("le service qui tranche Ad&Pro s'appelle « Direction des opérations » (décision de la Direction, 09/2026)", () => {
    // La DÉCISION, rendue durable. « Direction des opérations » nomme un SERVICE, « Directeur des
    // Opérations » nomme une PERSONNE (§118.112a) : deux vocabulaires, jamais confondus, et c'est
    // le service qui valide les demandes Ad&Pro avant la Direction Marketing.
    expect(ROLE_LABELS.DIRECTION).toBe("Direction des opérations");
    expect(ROLE_LABELS.OPERATIONS_DIRECTOR).toBe("Directeur des Opérations");
    expect(normaliser(ROLE_LABELS.DIRECTION)).not.toBe(normaliser(ROLE_LABELS.OPERATIONS_DIRECTOR));
  });
});
