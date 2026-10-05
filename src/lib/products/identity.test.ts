import { describe, expect, it } from "vitest";
import {
  aliasKey, certainMatch, cleDci, identiteComplete, identityKey, manquesIdentite, nomCanonique,
  normalizeDosage, normalizeForme, normalizePackaging, parseMention, phraseManques, resolveProduct,
  type ProductCandidate,
} from "./identity";
import { normText } from "@/lib/market/text";

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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA CLÉ QUI FUSIONNAIT (§118.178) — chaque cas ci-dessous a été MESURÉ sur la première version.
 *
 * Une clé commune FUSIONNE deux produits : c'est le sens dangereux. Les cas qui suivent sont
 * ceux où l'ancienne clé rendait la même chaîne pour deux enregistrements distincts — le premier
 * sur le portefeuille réel de l'entreprise.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les dossiers du portefeuille réel (référence, DCI, dosage, unité, forme, conditionnement). */
const PORTEFEUILLE: [string, string, string, string, string, string][] = [
  ["REG-2026-001", "FINGOLIMOD", "0.5", "MG", "GELULE", "B/28"],
  ["REG-2026-002", "DIMETHYL FUMARATE", "120", "MG", "GELULE", "B/14"],
  ["REG-2026-003", "DIMETHYL FUMARATE", "240", "MG", "GELULE", "B/56"],
  ["REG-2026-004", "CLADRIBINE", "10", "MG", "COMPRIME", "B/01"],
  ["REG-2026-005", "CLADRIBINE", "10", "MG", "COMPRIME", "B/04"],
  ["REG-2026-006", "CLADRIBINE", "10", "MG", "COMPRIME", "B/08"],
  ["REG-2026-007", "VALPROIC ACID", "200", "MG", "COMPRIME", "B/40"],
  ["REG-2026-008", "VALPROIC ACID", "500", "MG", "COMPRIME_PELLICULE", "B/30"],
  ["REG-2026-009", "VALPROIC ACID", "20", "PERCENT", "SOLUTION_BUVABLE", "B/1 40 ML"],
  ["REG-2026-010", "LEVETIRACETAM", "250", "MG", "COMPRIME_PELLICULE", "B/60"],
  ["REG-2026-011", "LEVETIRACETAM", "250", "MG", "COMPRIME_PELLICULE", "B/30"],
  ["REG-2026-012", "LEVETIRACETAM", "500", "MG", "COMPRIME_PELLICULE", "B/60"],
  ["REG-2026-013", "LEVETIRACETAM", "500", "MG", "COMPRIME_PELLICULE", "B/30"],
  ["REG-2026-014", "LEVETIRACETAM", "750", "MG", "COMPRIME_PELLICULE", "B/60"],
  ["REG-2026-015", "LEVETIRACETAM", "750", "MG", "COMPRIME_PELLICULE", "B/30"],
  ["REG-2026-016", "LEVETIRACETAM", "1000", "MG", "COMPRIME_PELLICULE", "B/60"],
  ["REG-2026-017", "LEVETIRACETAM", "100", "MG_ML", "SOLUTION_BUVABLE", "B/1 120 ML"],
  ["REG-2026-018", "LEVETIRACETAM", "100", "MG_ML", "SOLUTION_BUVABLE", "B/1 300 ML"],
  ["REG-2026-019", "MIRTAZAPINE", "15", "MG", "COMPRIME_PELLICULE", "B /30"],
  ["REG-2026-020", "MIRTAZAPINE", "30", "MG", "COMPRIME_PELLICULE", "B /30"],
  ["REG-2026-021", "ALTEPLASE", "10", "MG", "POUDRE_INJECTABLE", "B/1"],
  ["REG-2026-022", "ALTEPLASE 3M", "20", "MG", "SOLUTION_INJECTABLE", "B/1"],
  ["REG-2026-023", "ALTEPLASE 3M", "50", "MG", "SOLUTION_INJECTABLE", "B/1"],
  ["REG-2026-024", "LAMOTRIGINE", "5", "MG", "COMPRIME", "B /30"],
  ["REG-2026-025", "LAMOTRIGINE", "25", "MG", "COMPRIME", "B /30"],
  ["REG-2026-026", "LAMOTRIGINE", "50", "MG", "COMPRIME", "B /30"],
  ["REG-2026-027", "LAMOTRIGINE", "100", "MG", "COMPRIME", "B /30"],
  ["REG-2026-028", "ROPINIROLE", "1", "MG", "COMPRIME_PELLICULE", "B/20"],
  ["REG-2026-029", "ROPINIROLE", "2", "MG", "COMPRIME_PELLICULE", "B/30"],
];
const tuple = (r: (typeof PORTEFEUILLE)[number]) => ({ dci: r[1], dosage: r[2], dosageUnit: r[3], form: r[4], packaging: r[5] });

describe("la clé sur le portefeuille réel", () => {
  it("vingt-neuf dossiers distincts → vingt-neuf clés distinctes (aucune fusion)", () => {
    const cles = PORTEFEUILLE.map((r) => identityKey(tuple(r)));
    const doublons = cles.filter((c, i) => cles.indexOf(c) !== i);
    expect(doublons, `clés fusionnées : ${doublons.join(" ; ")}`).toEqual([]);
  });

  it("le cas qui l'a révélé : un flacon de 120 ml n'est pas un flacon de 300 ml", () => {
    const a = PORTEFEUILLE.find((r) => r[0] === "REG-2026-017")!;
    const b = PORTEFEUILLE.find((r) => r[0] === "REG-2026-018")!;
    // Prémisse : tout est égal sauf le volume du flacon.
    expect([a[1], a[2], a[3], a[4]]).toEqual([b[1], b[2], b[3], b[4]]);
    expect(identityKey(tuple(a))).not.toBe(identityKey(tuple(b)));
  });

  it("chacun porte une identité COMPLÈTE — c'est ce qui permet de le rattacher seul", () => {
    for (const r of PORTEFEUILLE) expect(manquesIdentite(tuple(r)), r[0]).toEqual([]);
  });
});

describe("la DCI : l'ordre d'une association ne compte pas, son contenu si", () => {
  it("« A + B », « B + A », « B/A » et « A et B » sont la même association", () => {
    const k = cleDci("Lamivudine + Zidovudine");
    expect(cleDci("Zidovudine + Lamivudine")).toBe(k);
    expect(cleDci("ZIDOVUDINE/LAMIVUDINE")).toBe(k);
    expect(cleDci("lamivudine et zidovudine")).toBe(k);
  });
  it("une association n'est pas l'une de ses molécules", () => {
    expect(cleDci("Lamivudine + Zidovudine")).not.toBe(cleDci("Lamivudine"));
  });
  it("le sel ne distingue pas, le second principe actif si", () => {
    expect(cleDci("Raltégravir potassique")).toBe(cleDci("Raltegravir"));
    expect(cleDci("Ténofovir disoproxil")).not.toBe(cleDci("Ténofovir alafénamide"));
  });
});

describe("le dosage : toutes les doses, l'unité ramenée à une écriture", () => {
  it("deux associations de dosages différents ne fusionnent plus", () => {
    expect(normalizeDosage("200/50", "mg")).toBe("200MG/50MG");
    expect(normalizeDosage("200/50", "mg")).not.toBe(normalizeDosage("200/25", "mg"));
    // L'unité écrite une fois ou deux fois : la même association.
    expect(normalizeDosage("200 mg/50 mg", null)).toBe(normalizeDosage("200/50", "mg"));
  });
  it("deux concentrations de la même dose ne fusionnent plus", () => {
    expect(normalizeDosage("20 mg/0,5 ml", null)).not.toBe(normalizeDosage("20 mg/1 ml", null));
  });
  it("la clé du menu et l'écriture libre se rejoignent (mg/ml, %, µg)", () => {
    expect(normalizeDosage("100", "MG_ML")).toBe(normalizeDosage("100 mg/ml", null));
    expect(normalizeDosage("20", "PERCENT")).toBe(normalizeDosage("20 %", null));
    expect(normalizeDosage("4", "MCG")).toBe(normalizeDosage("4 µg", null));
  });
  it("4 µg n'est pas 4 g — le signe micro ne disparaît plus", () => {
    expect(normalizeDosage("4 µg", null)).not.toBe(normalizeDosage("4", "G"));
    // À la source : `normText` remplaçait µ APRÈS la mise en majuscules, quand il était déjà « Μ ».
    expect(normText("4 µg")).toBe("4 UG");
  });
  it("l'espace des milliers ne coupe pas la dose : 5 000 UI = 5000 UI", () => {
    expect(normalizeDosage("5 000", "UI")).toBe(normalizeDosage("5000", "UI"));
    expect(normalizeDosage("5 000", "UI")).toBe("5000UI");
  });
});

describe("la forme : le vocabulaire des dossiers, pas les familles du marché", () => {
  it("la clé du menu et son libellé sont la même forme", () => {
    expect(normalizeForme("COMPRIME_PELLICULE")).toBe(normalizeForme("Comprimé pelliculé"));
    expect(normalizeForme("comprimés pelliculés")).toBe("COMPRIME_PELLICULE");
  });
  it("solution et poudre injectables, crème, gel et pommade restent distinctes", () => {
    expect(normalizeForme("SOLUTION_INJECTABLE")).not.toBe(normalizeForme("POUDRE_INJECTABLE"));
    const topiques = new Set(["CREME", "GEL", "POMMADE"].map(normalizeForme));
    expect(topiques.size).toBe(3);
    expect(normalizeForme("COMPRIME")).not.toBe(normalizeForme("COMPRIME_PELLICULE"));
  });
  it("une écriture inconnue n'est PAS devinée : elle reste distincte", () => {
    expect(normalizeForme("cp pell")).not.toBe(normalizeForme("COMPRIME_PELLICULE"));
  });
});

describe("le conditionnement : l'écriture se normalise, le contenu se garde", () => {
  it("la boîte : « B/30 », « B /30 », « Boîte de 30 », « B/01 » = « B/1 »", () => {
    expect(normalizePackaging("B /30")).toBe(normalizePackaging("B/30"));
    expect(normalizePackaging("B/01")).toBe(normalizePackaging("B/1"));
  });
  it("le volume du flacon fait partie du conditionnement", () => {
    expect(normalizePackaging("B/1 120 ML")).not.toBe(normalizePackaging("B/1 300 ML"));
    expect(normalizePackaging("B/1 flacon de 20 ml")).toBe(normalizePackaging("B/1 flacon 20 ml"));
    // « B/1 FLACON » reste une boîte de un flacon — le nombre ne se recolle qu'à une UNITÉ.
    expect(normalizePackaging("B/1 flacon 20 ml")).toBe("B1-FLACON20ML");
  });
});

describe("l'identité complète — on ne rattache rien sans elle", () => {
  it("dit chaque trait qui manque, dans l'ordre où on les demande", () => {
    expect(manquesIdentite({ dci: "LEVETIRACETAM", dosage: "500", form: "AUTRE" }))
      .toEqual(["UNITE", "FORME", "CONDITIONNEMENT"]);
    expect(phraseManques(["UNITE", "FORME", "CONDITIONNEMENT"]))
      .toBe("l'unité du dosage, la forme et le conditionnement");
  });
  it("« Autre » ne désigne aucune forme ; « 500 » sans unité ne se compare pas à « 500 mg »", () => {
    const amox = { dci: "AMOXICILLINE", dosage: "500", dosageUnit: "MG", form: "COMPRIME", packaging: "B/30" };
    expect(identiteComplete({ ...amox, form: "AUTRE" })).toBe(false);
    expect(identiteComplete({ ...amox, dosageUnit: null })).toBe(false);
    // Le témoin : les mêmes traits, complets — sans lui, une règle qui refuse tout passerait.
    expect(identiteComplete(amox)).toBe(true);
  });
  it("le nom de départ porte ce qui DISTINGUE — neuf « LEVETIRACETAM » ne se choisissent pas", () => {
    expect(nomCanonique({ dci: "LEVETIRACETAM", dosage: "100", dosageUnit: "MG_ML", form: "SOLUTION_BUVABLE", packaging: "B/1 120 ML" }))
      .toBe("LEVETIRACETAM 100 mg/ml · Solution buvable · B/1 120 ML");
    const noms = PORTEFEUILLE.map((r) => nomCanonique(tuple(r)));
    expect(new Set(noms).size).toBe(noms.length);
  });
});

describe("une mention nomme sa forme, pas toute sa phrase", () => {
  it("« comprimé pelliculé » est la forme, et ne pollue plus la DCI", () => {
    const m = parseMention("levetiracetam 500 mg comprimé pelliculé");
    expect(m.form).toBe("COMPRIME_PELLICULE");
    expect(m.dci).toBe("levetiracetam");
  });
});
