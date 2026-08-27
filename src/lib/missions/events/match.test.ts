import { describe, expect, it } from "vitest";
import { correspond, echue, lireAttente, type FaitObserve } from "./match";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CORRESPONDANCE EST LA DÉCISION LA PLUS DANGEREUSE DU ROUTEUR.
 *
 * Une mission réveillée à tort reprend son cours et peut envoyer un e-mail. Les cas NÉGATIFS
 * comptent donc davantage que les positifs : ce sont eux qui empêchent la réponse d'un
 * fournisseur de débloquer une mission qui attendait celle d'un salarié.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const fait = (f: Partial<FaitObserve> = {}): FaitObserve => ({
  type: "EMAIL_RECEIVED",
  actorId: null,
  entityType: null,
  entityId: null,
  relatedRefs: [],
  payload: {},
  missionId: null,
  ...f,
});

describe("correspondance d'un fait avec une attente", () => {
  it("le type doit correspondre", () => {
    expect(correspond({ event: "EMAIL_RECEIVED" }, fait())).toBe(true);
    expect(correspond({ event: "DOCUMENT_UPLOADED" }, fait())).toBe(false);
  });

  it("le type est comparé sans se soucier de la casse ni des espaces", () => {
    expect(correspond({ event: "  email_received " }, fait())).toBe(true);
  });

  it("UNE ATTENTE SANS TYPE N'ATTRAPE RIEN — l'inverse du « pas de filtre = tout passe »", () => {
    expect(correspond({}, fait())).toBe(false);
    expect(correspond({ from: "redouane" }, fait({ actorId: "redouane" }))).toBe(false);
  });

  it("l'émetteur est cherché dans l'acteur ET dans les champs connus de la charge utile", () => {
    const a = { event: "EMAIL_RECEIVED", from: "redouane" };
    expect(correspond(a, fait({ actorId: "redouane" }))).toBe(true);
    expect(correspond(a, fait({ payload: { fromAddress: "redouane" } }))).toBe(true);
    expect(correspond(a, fait({ payload: { senderEmail: "REDOUANE" } }))).toBe(true);
    expect(correspond(a, fait({ payload: { employeeId: "redouane" } }))).toBe(true);
  });

  it("l'inclusion marche sur une adresse complète", () => {
    expect(correspond(
      { event: "EMAIL_RECEIVED", from: "redouane" },
      fait({ payload: { from: "Redouane B. <redouane@adventum.dz>" } }),
    )).toBe(true);
  });

  it("UN NOM TROP COURT NE VAUT PAS INCLUSION : « ali » ne réveille pas « natalie@… »", () => {
    expect(correspond(
      { event: "EMAIL_RECEIVED", from: "ali" },
      fait({ payload: { from: "natalie@adventum.dz" } }),
    )).toBe(false);
    // Mais l'égalité exacte reste acceptée, quelle que soit la longueur.
    expect(correspond({ event: "EMAIL_RECEIVED", from: "ali" }, fait({ actorId: "ali" }))).toBe(true);
  });

  it("un émetteur qui ne correspond à rien ne réveille pas", () => {
    expect(correspond(
      { event: "EMAIL_RECEIVED", from: "redouane" },
      fait({ actorId: "khaled", payload: { from: "khaled@adventum.dz" } }),
    )).toBe(false);
  });

  it("l'entité est comparée à l'entité principale ET aux références liées", () => {
    const a = { event: "DOCUMENT_UPLOADED", entity: "EMPLOYEE:e-42" };
    expect(correspond(a, fait({ type: "DOCUMENT_UPLOADED", entityType: "EMPLOYEE", entityId: "e-42" }))).toBe(true);
    expect(correspond(a, fait({ type: "DOCUMENT_UPLOADED", relatedRefs: ["EMPLOYEE:e-42"] }))).toBe(true);
    expect(correspond(a, fait({ type: "DOCUMENT_UPLOADED", entityType: "EMPLOYEE", entityId: "e-43" }))).toBe(false);
  });

  it("toutes les conditions posées doivent être remplies, pas seulement l'une d'elles", () => {
    const a = { event: "DOCUMENT_UPLOADED", from: "redouane", entity: "EMPLOYEE:e-42" };
    // Le bon émetteur, la mauvaise entité.
    expect(correspond(a, fait({
      type: "DOCUMENT_UPLOADED", actorId: "redouane", entityType: "EMPLOYEE", entityId: "e-99",
    }))).toBe(false);
    // La bonne entité, le mauvais émetteur.
    expect(correspond(a, fait({
      type: "DOCUMENT_UPLOADED", actorId: "khaled", entityType: "EMPLOYEE", entityId: "e-42",
    }))).toBe(false);
    // Les deux.
    expect(correspond(a, fait({
      type: "DOCUMENT_UPLOADED", actorId: "redouane", entityType: "EMPLOYEE", entityId: "e-42",
    }))).toBe(true);
  });

  it("une charge utile qui n'est pas un objet ne fait pas planter la comparaison", () => {
    expect(correspond({ event: "EMAIL_RECEIVED", from: "x" }, fait({ payload: "du texte" }))).toBe(false);
    expect(correspond({ event: "EMAIL_RECEIVED", from: "x" }, fait({ payload: null }))).toBe(false);
    expect(correspond({ event: "EMAIL_RECEIVED" }, fait({ payload: ["a"] }))).toBe(true);
  });
});

describe("échéance d'une attente", () => {
  const t0 = new Date("2026-01-01T00:00:00Z");
  const j = (n: number) => new Date(t0.getTime() + n * 24 * 3600 * 1000);

  it("sans échéance, une attente n'expire jamais", () => {
    expect(echue({ event: "X" }, t0, j(3650))).toBe(false);
  });

  it("l'échéance ne se déclenche qu'APRÈS le délai", () => {
    expect(echue({ event: "X", withinDays: 5 }, t0, j(4))).toBe(false);
    expect(echue({ event: "X", withinDays: 5 }, t0, j(5))).toBe(false);
    expect(echue({ event: "X", withinDays: 5 }, t0, j(6))).toBe(true);
  });
});

describe("relecture d'une attente venue de la base", () => {
  it("retype ce qui est utilisable et écarte le reste", () => {
    expect(lireAttente({ event: "EMAIL_RECEIVED", from: " redouane ", withinDays: 5 }))
      .toEqual({ event: "EMAIL_RECEIVED", from: "redouane", entity: undefined, withinDays: 5 });
  });

  it("rend null sur ce qui n'est pas une attente", () => {
    expect(lireAttente(null)).toBeNull();
    expect(lireAttente("texte")).toBeNull();
    expect(lireAttente([])).toBeNull();
    expect(lireAttente({})).toBeNull();
    expect(lireAttente({ withinDays: 5 })).toBeNull();
  });

  it("écarte une échéance absurde plutôt que de la propager", () => {
    expect(lireAttente({ event: "X", withinDays: -3 })?.withinDays).toBeUndefined();
    expect(lireAttente({ event: "X", withinDays: "cinq" })?.withinDays).toBeUndefined();
  });

  it("une attente relue vide n'attrape rien : la stricte est conservée jusqu'au bout", () => {
    const a = lireAttente({ event: "", from: "  " });
    expect(a).toBeNull();
  });
});
