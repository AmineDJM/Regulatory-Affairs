import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enumerer, libelleDuMode, lireCircuit, type EtapeDuCircuit } from "./lecture-circuit";
import { cheminsDeLObjetLie } from "./decision";

/** Un cliquet juge le CODE, pas la prose qui le décrit (§118.79d). */
const sans = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const le = new Date("2026-10-05T10:00:00Z");
const e = (order: number, status: string, validateur: string, motif: string | null = null): EtapeDuCircuit => ({
  order, status, validateur, motif, decideeLe: status === "PENDING" ? null : le,
});

/**
 * VAL-2026-039 (Direction, 06/10) : l'assistante demande la validation d'une demande à deux validateurs ;
 * le premier écrit « Je valide… », le circuit passe au second — et son écran ne disait que « En attente ».
 */
describe("Où en est le circuit — lu pour le demandeur", () => {
  it("le cas VAL-2026-039 : le premier a validé, le second reste — on le dit, avec l'auteur et la note", () => {
    const c = lireCircuit({
      status: "PENDING", mode: "SEQUENTIAL", currentOrder: 2,
      steps: [e(1, "APPROVED", "Amine Djouamai", "Je valide pour une nuitée."), e(2, "PENDING", "Khaled Djouamai")],
    });
    expect(c.resume).toBe("Validé par Amine Djouamai — en attente de Khaled Djouamai — l'accord de chaque validateur est requis.");
    expect(c.lignes.map((l) => [l.validateur, l.etat])).toEqual([["Amine Djouamai", "VALIDE"], ["Khaled Djouamai", "A_SON_TOUR"]]);
    expect(c.lignes[0].motif).toBe("Je valide pour une nuitée.");
    expect(c.lignes[0].decideeLe).toEqual(le);
    expect(c.lignes[1].decideeLe).toBeNull();
  });

  it("séquentiel avant toute décision : le premier est à son tour, le second attend après lui", () => {
    const c = lireCircuit({ status: "PENDING", mode: "SEQUENTIAL", currentOrder: 1, steps: [e(1, "PENDING", "A"), e(2, "PENDING", "B")] });
    expect(c.lignes.map((l) => l.etat)).toEqual(["A_SON_TOUR", "EN_FILE"]);
    expect(c.lignes[1].libelle).toBe("En attente — après A");
    expect(c.resume).toBe("En attente de A, puis de B — l'accord de chaque validateur est requis.");
  });

  it("parallèle : tous à leur tour en même temps", () => {
    const c = lireCircuit({ status: "PENDING", mode: "PARALLEL", currentOrder: 1, steps: [e(1, "APPROVED", "A"), e(1, "PENDING", "B"), e(1, "PENDING", "C")] });
    expect(c.lignes.map((l) => l.etat)).toEqual(["VALIDE", "A_SON_TOUR", "A_SON_TOUR"]);
    expect(c.resume).toBe("Validé par A — en attente de B et C — l'accord de chaque validateur est requis.");
  });

  it("validateur unique : pas de mention d'un accord de chacun", () => {
    expect(lireCircuit({ status: "PENDING", mode: "SEQUENTIAL", currentOrder: 1, steps: [e(1, "PENDING", "A")] }).resume).toBe("En attente de A.");
  });

  it("clôturée : validée par tous, refusée par qui, et les étapes jamais atteintes ne se disent pas « en attente »", () => {
    expect(lireCircuit({ status: "APPROVED", mode: "SEQUENTIAL", currentOrder: 2, steps: [e(1, "APPROVED", "A"), e(2, "APPROVED", "B")] }).resume)
      .toBe("Validé par A et B.");
    const refus = lireCircuit({ status: "REJECTED", mode: "SEQUENTIAL", currentOrder: 1, steps: [e(1, "REJECTED", "A", "Trop cher."), e(2, "PENDING", "B")] });
    expect(refus.resume).toBe("Refusé par A.");
    expect(refus.lignes.map((l) => [l.etat, l.libelle])).toEqual([["REFUSE", "Refusé"], ["SANS_OBJET", "Non sollicité"]]);
    expect(lireCircuit({ status: "CANCELLED", mode: "SEQUENTIAL", currentOrder: 1, steps: [e(1, "PENDING", "A")] }).lignes[0].etat).toBe("SANS_OBJET");
  });

  it("renvoyée pour correction : qui l'a renvoyée, et les suivants attendent la correction", () => {
    const c = lireCircuit({ status: "CHANGES_REQUESTED", mode: "SEQUENTIAL", currentOrder: 1, steps: [e(1, "CHANGES_REQUESTED", "A", "Joindre le devis."), e(2, "PENDING", "B")] });
    expect(c.resume).toMatch(/^Correction demandée par A/);
    expect(c.lignes[1]).toMatchObject({ etat: "EN_FILE", libelle: "En attente de la correction" });
  });

  it("l'ordre du circuit fait foi, pas l'ordre de lecture", () => {
    const c = lireCircuit({ status: "PENDING", mode: "SEQUENTIAL", currentOrder: 1, steps: [e(2, "PENDING", "B"), e(1, "PENDING", "A")] });
    expect(c.lignes.map((l) => l.validateur)).toEqual(["A", "B"]);
  });

  it("énumérer et dire le mode en clair", () => {
    expect(enumerer([])).toBe("");
    expect(enumerer(["A"])).toBe("A");
    expect(enumerer(["A", "B", "C"])).toBe("A, B et C");
    expect(libelleDuMode("SEQUENTIAL", 1)).toBeNull();
    expect(libelleDuMode("SEQUENTIAL", 2)).toMatch(/l'un après l'autre/);
    expect(libelleDuMode("PARALLEL", 2)).toMatch(/en même temps/);
  });
});

describe("Les écrans de l'objet d'origine se rafraîchissent à chaque décision", () => {
  it("la fiche de la demande au secrétariat et le lien interne, jamais une adresse externe", () => {
    expect(cheminsDeLObjetLie({ entityType: "ADMIN_REQUEST", entityId: "d1", link: "/demandes/d1" })).toEqual(["/demandes/d1"]);
    expect(cheminsDeLObjetLie({ entityType: null, entityId: null, link: "/courrier/c1?onglet=2#x" })).toEqual(["/courrier/c1"]);
    expect(cheminsDeLObjetLie({ entityType: null, entityId: null, link: "https://exemple.com/x" })).toEqual([]);
    expect(cheminsDeLObjetLie({ entityType: null, entityId: null, link: "//exemple.com/x" })).toEqual([]);
    expect(cheminsDeLObjetLie({ entityType: null, entityId: null, link: "/" })).toEqual([]);
    expect(cheminsDeLObjetLie({ entityType: "LEGAL_DOCUMENT", entityId: "l1", link: null })).toEqual([]);
  });

  it("decideValidation rafraîchit l'objet lié SANS condition de clôture, et prévient le demandeur d'un accord partiel", () => {
    const src = sans("src/lib/actions/validation-actions.ts");
    const corps = src.slice(src.indexOf("export async function decideValidation"), src.indexOf("function demandeSansPaiement"));
    expect(corps).toMatch(/for \(const chemin of cheminsDeLObjetLie\(req\)\) revalidatePath\(chemin\)/);
    expect(corps).not.toMatch(/if \(finalized[^)]*\)\s*\{\s*revalidatePath\(`\/demandes\/\$\{req\.entityId\}`\)/);
    expect(corps).toMatch(/else if \(!finalized && req\.requesterId !== user\.id\)/);
    expect(corps).toMatch(/lireCircuit\(/);
  });

  it("la fiche de la demande lit le circuit par validateur, pas le seul statut global", () => {
    const page = sans("src/app/(app)/demandes/[id]/page.tsx");
    expect(page).toMatch(/lireCircuit\(\{/);
    expect(page).toMatch(/circuit\.lignes\.map/);
  });
});
