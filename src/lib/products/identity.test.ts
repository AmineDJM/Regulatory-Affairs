import { describe, expect, it } from "vitest";
import {
  aliasKey, certainMatch, identityKey, normalizeDosage, normalizePackaging,
  parseMention, resolveProduct, type ProductCandidate,
} from "./identity";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ PRODUIT — ce que ces épreuves défendent.
 *
 * Deux dangers OPPOSÉS, et il faut se garder des deux :
 *
 *   • NE PAS RECONNAÎTRE ce qui est le même produit — « Nivo » et « Nivolumab » repartent en
 *     recherche, Adam raisonne pour rien, et le PDG répète son nom.
 *   • CONFONDRE ce qui ne l'est pas — un 500 mg et un 1 g, une boîte de 28 et une de 56. Là,
 *     ce n'est plus un désagrément : c'est une donnée fausse écrite dans l'ERP.
 *
 * La règle qui tranche : un rapprochement PARTIEL se propose, il ne s'applique jamais seul.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const p = (over: Partial<ProductCandidate> & { id: string; dci: string }): ProductCandidate => ({
  code: `PRD-2026-${over.id}`,
  canonicalName: over.dci,
  identityKey: identityKey(over),
  dosage: null, dosageUnit: null, form: null, packaging: null, aliases: [],
  ...over,
});

// Les noms canoniques sont DISTINCTIFS, comme le sont les vrais : deux dosages du même
// principe actif ne portent pas le même nom au catalogue.
const NIVO_100 = p({ id: "001", dci: "Nivolumab", canonicalName: "Nivolumab 100 mg", dosage: "100", dosageUnit: "mg", form: "Injectable", aliases: ["Nivo", "Opdivo"] });
const NIVO_40 = p({ id: "002", dci: "Nivolumab", canonicalName: "Nivolumab 40 mg", dosage: "40", dosageUnit: "mg", form: "Injectable" });
const PEMBRO = p({ id: "003", dci: "Pembrolizumab", canonicalName: "Pembrolizumab", dosage: "100", dosageUnit: "mg", form: "Injectable" });
const AMOX_B28 = p({ id: "004", dci: "Amoxicilline", dosage: "500", dosageUnit: "mg", form: "Comprimé", packaging: "B/28" });
const AMOX_B56 = p({ id: "005", dci: "Amoxicilline", dosage: "500", dosageUnit: "mg", form: "Comprimé", packaging: "B/56" });

const TOUS = [NIVO_100, NIVO_40, PEMBRO, AMOX_B28, AMOX_B56];

describe("la clé d'identité", () => {
  it("le CONDITIONNEMENT en fait partie — une boîte de 28 n'est pas une boîte de 56", () => {
    // Écrit noir sur blanc dans le schéma : à dosage et forme identiques, c'est le
    // conditionnement qui distingue deux ENREGISTREMENTS. Une clé qui l'omettrait les
    // fusionnerait — et écrirait une donnée fausse dans l'ERP.
    expect(AMOX_B28.identityKey).not.toBe(AMOX_B56.identityKey);
  });

  it("le dosage aussi — 500 mg et 1 g sont deux produits", () => {
    expect(NIVO_100.identityKey).not.toBe(NIVO_40.identityKey);
  });

  it("mais l'ÉCRITURE ne compte pas : « 500 » et « 500.0 » sont le même dosage", () => {
    expect(normalizeDosage("500", "mg")).toBe(normalizeDosage("500.0", "MG"));
    // La normalisation reprend la convention de `market/text.ts` : majuscules.
    expect(normalizeDosage("0,5", "g")).toBe("0.5G");
    // Aucune CONVERSION entre unités : 500 mg et 0,5 g sont deux libellés de dossier distincts.
    expect(normalizeDosage("500", "mg")).not.toBe(normalizeDosage("0.5", "g"));
    expect(normalizeDosage("500", "MG")).toBe(normalizeDosage("500", "mg"));
  });

  it("« B/30 », « BTE 30 » et « Boîte de 30 » sont le même conditionnement", () => {
    expect(normalizePackaging("B/30")).toBe("B30");
    expect(normalizePackaging("BTE 30")).toBe("B30");
    expect(normalizePackaging("Boîte de 30")).toBe("B30");
    // « Tube 30 G » n'est PAS une boîte de 30.
    expect(normalizePackaging("Tube 30 G")).not.toBe("B30");
  });

  it("une DCI vide ne produit aucune clé — on n'indexe pas le vide", () => {
    expect(identityKey({ dci: "" })).toBe("");
    expect(identityKey({ dci: "   " })).toBe("");
  });
});

describe("la résolution, par degrés — l'ordre EST la règle", () => {
  it("1. une RÉFÉRENCE explicite l'emporte, et ne tolère pas l'à-peu-près", () => {
    const m = resolveProduct("PRD-2026-001", TOUS);
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe("reference");
    expect(m[0].product.id).toBe("001");
    // Une référence qui n'existe pas est une ERREUR, jamais une invitation à chercher par
    // ressemblance : « PRD-2026-999 » ne doit surtout pas rendre « PRD-2026-99 ».
    expect(resolveProduct("PRD-2026-999", TOUS)).toHaveLength(0);
  });

  it("2. un ALIAS enregistré par un humain est certain — « Nivo » suffit", () => {
    const m = resolveProduct("Nivo", TOUS);
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe("alias");
    expect(m[0].certain).toBe(true);
    expect(m[0].product.id).toBe("001");
    expect(resolveProduct("opdivo", TOUS)[0].product.id).toBe("001"); // insensible à la casse
  });

  it("le NOM du produit vaut alias implicite — personne n'enregistre son propre nom", () => {
    const m = resolveProduct("Pembrolizumab", TOUS);
    expect(m[0].kind).toBe("alias");
    expect(m[0].product.id).toBe("003");
  });

  it("3. la CLÉ D'IDENTITÉ complète tranche sans ambiguïté", () => {
    const m = resolveProduct("Nivolumab 100 mg injectable", TOUS);
    expect(m[0].certain).toBe(true);
    expect(m[0].product.id).toBe("001");
  });

  it("4. un PARTIEL se PROPOSE — il ne s'applique jamais seul", () => {
    // « nivolumab » sans dosage : deux produits correspondent. C'est une ambiguïté RÉELLE.
    const m = resolveProduct("nivolumab", TOUS);
    expect(m.length).toBeGreaterThan(1);
    expect(m.every((x) => x.kind === "partial")).toBe(true);
    expect(m.every((x) => x.certain === false)).toBe(true);
    // Et l'appelant n'obtient RIEN de certain : il doit demander.
    expect(certainMatch(m)).toBeNull();
  });

  it("un dosage mentionné RESSERRE le partiel — « nivolumab 100 » n'est pas le 40 mg", () => {
    const m = resolveProduct("nivolumab 100", TOUS);
    expect(m.map((x) => x.product.id)).toEqual(["001"]);
  });

  it("deux produits sous le même alias = ambiguïté, PAS un choix arbitraire", () => {
    const jumeau = { ...NIVO_40, aliases: ["Nivo"] };
    const m = resolveProduct("Nivo", [NIVO_100, jumeau]);
    expect(m).toHaveLength(2);
    expect(certainMatch(m)).toBeNull(); // deux certains = on demande
  });

  it("une mention qui ne ressemble à rien ne rend rien", () => {
    expect(resolveProduct("xyzzy", TOUS)).toHaveLength(0);
    expect(resolveProduct("", TOUS)).toHaveLength(0);
    expect(resolveProduct("ab", TOUS)).toHaveLength(0); // trop court pour un radical
  });

  it("le français et l'anglais d'IQVIA se rejoignent — « Amoxicillin » trouve « Amoxicilline »", () => {
    const m = resolveProduct("Amoxicillin 500 mg", TOUS);
    expect(m.length).toBeGreaterThanOrEqual(1);
    expect(m.every((x) => x.product.dci.startsWith("Amox"))).toBe(true);
  });
});

describe("ce qu'une mention libre contient", () => {
  it("extrait le dosage quand il est là, et n'en invente pas quand il manque", () => {
    expect(parseMention("Nivolumab 100 mg")).toMatchObject({ dosage: "100", dosageUnit: "mg" });
    expect(parseMention("Nivo").dosage).toBeNull();
  });

  it("normalise un alias pour l'indexer, sans le déformer pour l'afficher", () => {
    expect(aliasKey("  NIVO  ")).toBe(aliasKey("nivo"));
    expect(aliasKey("Nivolumab   100")).toBe(aliasKey("nivolumab 100"));
  });
});
