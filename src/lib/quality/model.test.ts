import { describe, expect, it } from "vitest";
import {
  cleProduit, clePersonne, cleSociete, emailNormalise, estAberrant, mediane, resolutionEffective, signatureDe, statistiques,
  trierConstats, verdictEmail, SEUIL_AUTO, depassementDuCumul, groupeReferenceFacture, jumellesDeReference, memeEmetteur,
  type EmetteurFacture,
} from "./model";

describe("qualité des données — le vocabulaire pur", () => {
  it("la résolution effective : AUTO exige confiance ET correction ; sans correction, c'est une décision", () => {
    const c = { entite: "Employee", entiteId: "e1", champ: "email", avant: "A@X.DZ", apres: "a@x.dz", description: "plier" };
    expect(resolutionEffective("AUTO", 1, c)).toBe("AUTO");
    expect(resolutionEffective("AUTO", SEUIL_AUTO - 0.01, c)).toBe("PROPOSE");
    expect(resolutionEffective("AUTO", 1, null)).toBe("HUMAIN");
    expect(resolutionEffective("PROPOSE", 0.5, c)).toBe("PROPOSE");
    expect(resolutionEffective("HUMAIN", 1, c)).toBe("HUMAIN");
  });

  it("les clés de rapprochement ignorent casse, accents, ordre des mots et formes juridiques", () => {
    expect(cleSociete("Hetero Labs SARL")).toBe(cleSociete("HÉTÉRO LABS"));
    expect(cleSociete("Kwality Pharma SPA")).toBe("kwality");
    expect(cleSociete("Hetero")).not.toBe(cleSociete("Hikma"));
    expect(clePersonne("Cherif Raihana")).toBe(clePersonne("Raïhana CHERIF"));
    expect(cleProduit({ dci: "Sofosbuvir + Velpatasvir", dosage: "400", dosageUnit: "mg", pharmaceuticalForm: "Comprimé", packaging: "B/28" }))
      .toBe(cleProduit({ dci: "velpatasvir + SOFOSBUVIR", dosage: "400", dosageUnit: "MG", pharmaceuticalForm: "comprimé", packaging: "b/28" }));
    expect(cleProduit({ dci: "Sofosbuvir", dosage: "400" })).not.toBe(cleProduit({ dci: "Sofosbuvir", dosage: "200" }));
  });

  it("les e-mails : OK, normalisable (casse, espaces, mailto), invalide, vide", () => {
    expect(verdictEmail("raihana@adventum.dz")).toBe("OK");
    expect(verdictEmail("  Raihana@Adventum.DZ ")).toBe("NORMALISABLE");
    expect(verdictEmail("mailto:x@y.dz")).toBe("NORMALISABLE");
    expect(emailNormalise("  Raihana@Adventum.DZ ")).toBe("raihana@adventum.dz");
    expect(verdictEmail("raihana@adventum")).toBe("INVALIDE");
    expect(verdictEmail("pas un mail")).toBe("INVALIDE");
    expect(verdictEmail("")).toBe("VIDE");
    expect(verdictEmail(null)).toBe("VIDE");
  });

  it("aberrant : au moins 8× la médiane d'un échantillon d'au moins 8 valeurs — sinon rien", () => {
    const ech = [100, 120, 90, 110, 105, 95, 130, 100];
    expect(mediane(ech)).toBe(102.5);
    expect(estAberrant(900, ech)).toBe(true);
    expect(estAberrant(700, ech)).toBe(false);
    expect(estAberrant(900, ech.slice(0, 5))).toBe(false);
    expect(mediane([])).toBeNull();
  });

  it("signature stable et bornée ; tri par criticité puis confiance ; statistiques", () => {
    expect(signatureDe("r", "Employee", "e1", null)).toBe("r|Employee|e1|");
    expect(signatureDe("r", "x".repeat(500)).length).toBe(400);
    const cs = trierConstats([
      { criticite: "NORMALE" as const, confiance: 1 }, { criticite: "CRITIQUE" as const, confiance: 0.6 }, { criticite: "CRITIQUE" as const, confiance: 0.9 },
    ]);
    expect(cs.map((c) => `${c.criticite}:${c.confiance}`)).toEqual(["CRITIQUE:0.9", "CRITIQUE:0.6", "NORMALE:1"]);
    const st = statistiques([{ famille: "DOUBLON", criticite: "HAUTE", resolution: "HUMAIN" }, { famille: "EMAIL", criticite: "BASSE", resolution: "AUTO" }]);
    expect(st.total).toBe(2);
    expect(st.parFamille.DOUBLON).toBe(1);
    expect(st.parResolution.AUTO).toBe(1);
  });
});

describe("factures — la même référence chez le même émetteur, le cumul d'une pièce amont (§118.196)", () => {
  const f = (id: string, o: Partial<EmetteurFacture> = {}): EmetteurFacture & { id: string } => ({
    id, reference: "FA-2026-001", direction: "OUT", companyId: "c1", counterpartyIds: [], counterparty: null, ...o,
  });

  it("deux fournisseurs qui numérotent pareil ne font pas un doublon ; deux sociétés du groupe non plus", () => {
    // Reçues : même groupe (la référence), émetteurs différents → aucune jumelle.
    const a = f("a", { counterpartyIds: ["p1"], counterparty: "Froid Industriel SPA" });
    const b = f("b", { counterpartyIds: ["p2"], counterparty: "Chaud SARL" });
    expect(groupeReferenceFacture(a)).toBe(groupeReferenceFacture(b));
    expect(memeEmetteur(a, b)).toBe("NON");
    expect(jumellesDeReference([a, b])).toEqual([]);
    // Émises par deux sociétés : deux séries, deux groupes — jamais comparées.
    const e1 = f("e1", { direction: "IN", companyId: "c1" });
    const e2 = f("e2", { direction: "IN", companyId: "c2" });
    expect(groupeReferenceFacture(e1)).not.toBe(groupeReferenceFacture(e2));
    // Une émise et une reçue de même numéro : deux groupes.
    expect(groupeReferenceFacture(e1)).not.toBe(groupeReferenceFacture(a));
  });

  it("le même émetteur : la partie de l'annuaire, sinon le nom plié — quasi certain", () => {
    const a = f("a", { counterpartyIds: ["p1"], counterparty: "Froid Industriel" });
    const b = f("b", { counterpartyIds: ["p1"], counterparty: "Autre libellé" });
    const c = f("c", { counterparty: "FROID INDUSTRIEL SPA" });
    expect(memeEmetteur(a, b)).toBe("OUI");
    expect(memeEmetteur(a, c)).toBe("OUI");
    expect(jumellesDeReference([a, b]).map((x) => [x.facture.id, x.certain, x.lot.length])).toEqual([["a", true, 2], ["b", true, 2]]);
    // Même série d'une même société : la même pièce enregistrée deux fois.
    const e1 = f("e1", { direction: "IN" });
    const e2 = f("e2", { direction: "IN", reference: " fa-2026-001 " });
    expect(groupeReferenceFacture(e1)).toBe(groupeReferenceFacture(e2));
    expect(jumellesDeReference([e1, e2]).every((x) => x.certain)).toBe(true);
  });

  it("rien ne dit qui a émis l'une des deux : INCONNU — « à vérifier », jamais « quasi certain »", () => {
    const a = f("a", { counterpartyIds: ["p1"], counterparty: "Froid" });
    const b = f("b");
    expect(memeEmetteur(a, b)).toBe("INCONNU");
    expect(jumellesDeReference([a, b]).map((x) => x.certain)).toEqual([false, false]);
    // Une jumelle certaine l'emporte sur une incertaine.
    const c = f("c", { counterpartyIds: ["p1"] });
    expect(jumellesDeReference([a, b, c]).find((x) => x.facture.id === "a")).toMatchObject({ certain: true, lot: [a, c] });
    // Sans référence lisible, aucun groupe.
    expect(groupeReferenceFacture(f("z", { reference: "  " }))).toBeNull();
    // Deux parties de l'annuaire, distinctes, sans nom lisible : deux émetteurs — pas un doute.
    expect(memeEmetteur(f("p", { counterpartyIds: ["p1"] }), f("q", { counterpartyIds: ["p2"] }))).toBe("NON");
  });

  it("LE CUMUL : deux factures de 50 000 sur un BC de 100 000 ne dépassent rien ; la troisième, si", () => {
    const g = (id: string, net: number, quand: number) => ({ id, net, quand });
    expect(depassementDuCumul([g("f1", 50_000, 1), g("f2", 50_000, 2)], 100_000)).toBeNull();
    expect(depassementDuCumul([g("f1", 50_000, 1), g("f2", 50_000, 2), g("f3", 10_000, 3)], 100_000))
      .toMatchObject({ facture: { id: "f3" }, rang: 2, cumul: 110_000 });
    // L'ordre est celui des DATES, pas celui de la liste reçue.
    expect(depassementDuCumul([g("f3", 10_000, 3), g("f1", 50_000, 1), g("f2", 50_000, 2)], 100_000)?.facture.id).toBe("f3");
    // Facturer moins n'est pas une contradiction ; un dépassement sous la tolérance non plus.
    expect(depassementDuCumul([g("f1", 60_000, 1)], 100_000)).toBeNull();
    expect(depassementDuCumul([g("f1", 100_500, 1)], 100_000)).toBeNull();
    expect(depassementDuCumul([g("f1", 125_000, 1)], 100_000)).toMatchObject({ rang: 0, ecartPct: 25 });
    // Une pièce amont à zéro : rien facturé, rien dépassé ; un dinar facturé, dépassé.
    expect(depassementDuCumul([g("f1", 0, 1)], 0)).toBeNull();
    expect(depassementDuCumul([g("f1", 100, 1)], 0)).toMatchObject({ rang: 0, ecartPct: 100 });
  });

  it("les deux règles LISENT ces décisions — la source le dit, pas un commentaire", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./rules.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const corps = (nom: string) => {
      const i = src.indexOf(`async ${nom}(`);
      expect(i, nom).toBeGreaterThan(0);
      return src.slice(i, src.indexOf("\n  async ", i + 10));
    };
    const doublon = corps("doublon_factures");
    expect(doublon).toMatch(/grouper\(rows, \(x\) => groupeReferenceFacture\(x\)\)/);
    expect(doublon).toMatch(/jumellesDeReference\(g\)/);
    const contradictoire = corps("montant_contradictoire");
    expect(contradictoire).toMatch(/depassementDuCumul\(/);
    expect(contradictoire).toMatch(/net: netDeLaFacture\(toNumber\(f\.amount\), \[avoirsParFacture\.get\(f\.id\) \?\? 0\]\)/);
    expect(contradictoire).toMatch(/f\.chainFrom\.amendments\.length > 0\) continue;/);
  });
});
