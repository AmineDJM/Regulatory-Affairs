import { describe, expect, it } from "vitest";
import {
  etapeCycle, stockActuel, moisDeCouverture, ecoulementMensuel, serieMensuelle, moisGlissants, variationPct,
  echeanceDecision, signalPrincipal, resoudrePrix, lireMontant, montantCourt, SEUIL_STOCK_BAS_MOIS,
} from "./fiche-360";

describe("Produits 360 — cycle de vie", () => {
  it("un dossier terminé fait un produit commercialisé ; un dossier en cours, un produit en enregistrement", () => {
    expect(etapeCycle({ lifecycle: "REGISTERED", isActive: true, statutsDossiers: ["DECISION_OBTAINED"] })).toBe("COMMERCIALISE");
    expect(etapeCycle({ lifecycle: "STUDY", isActive: true, statutsDossiers: ["SUBMITTED", "CLOSED"] })).toBe("COMMERCIALISE");
    expect(etapeCycle({ lifecycle: "STUDY", isActive: true, statutsDossiers: ["AWAITING_ANPP"] })).toBe("ENREGISTREMENT");
    expect(etapeCycle({ lifecycle: "STUDY", isActive: true, statutsDossiers: [] })).toBe("ETUDE");
  });
  it("arrêté ou inactif → fin de vie, quel que soit le dossier", () => {
    expect(etapeCycle({ lifecycle: "DISCONTINUED", isActive: true, statutsDossiers: ["DECISION_OBTAINED"] })).toBe("FIN_DE_VIE");
    expect(etapeCycle({ lifecycle: "MARKETED", isActive: false, statutsDossiers: ["DECISION_OBTAINED"] })).toBe("FIN_DE_VIE");
  });
});

describe("Produits 360 — stock et couverture", () => {
  it("le stock est la somme des DERNIERS relevés de chaque lieu", () => {
    const s = stockActuel([
      { productId: "d1", scope: "PCH", annexId: null, date: "2026-01-01", quantity: 900 },
      { productId: "d1", scope: "PCH", annexId: null, date: "2026-03-01", quantity: 600 },
      { productId: "d1", scope: "HOSPITAL", annexId: "h1", date: "2026-02-01", quantity: 100 },
      { productId: "d2", scope: "PCH", annexId: null, date: "2026-02-15", quantity: 50 },
    ]);
    expect(s.unites).toBe(750);
    expect(s.lieux).toBe(3);
    expect(s.date?.toISOString().slice(0, 10)).toBe("2026-03-01");
  });
  it("mois de couverture = stock ÷ écoulement mensuel ; rien à diviser → null", () => {
    expect(moisDeCouverture(1200, 300)).toBe(4);
    expect(moisDeCouverture(100, 0)).toBeNull();
    expect(moisDeCouverture(null, 10)).toBeNull();
    expect(moisDeCouverture(10, null)).toBeNull();
  });
  it("l'écoulement se divise par les mois réellement couverts", () => {
    expect(ecoulementMensuel([{ quantite: 300, mois: "2026-01" }, { quantite: 300, mois: "2026-02" }, { quantite: 300, mois: "2026-03" }])).toBe(300);
    expect(ecoulementMensuel([])).toBeNull();
  });
  it(`stock bas sous ${SEUIL_STOCK_BAS_MOIS} mois`, () => {
    expect(signalPrincipal({ couvertureMois: 1.2 })?.code).toBe("STOCK_BAS");
    expect(signalPrincipal({ couvertureMois: 4.1 })).toBeNull();
    expect(signalPrincipal({ couvertureMois: null })).toBeNull();
  });
});

describe("Produits 360 — ventes mensuelles", () => {
  it("12 mois glissants, hôpital et officine séparés, hors fenêtre ignoré", () => {
    const fin = new Date("2026-10-07T00:00:00Z");
    expect(moisGlissants(fin, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    const s = serieMensuelle([
      { date: "2026-10-02", montant: 100, hopital: true },
      { date: "2026-10-03", montant: 50, hopital: false },
      { date: "2025-10-31", montant: 999, hopital: false },
    ], fin);
    expect(s).toHaveLength(12);
    expect(s[11]).toEqual({ mois: "2026-10", hopital: 100, officine: 50 });
    expect(s.reduce((t, m) => t + m.officine, 0)).toBe(50);
  });
  it("montant court", () => {
    expect(montantCourt(48_200_000).replace(/\s/g, " ")).toBe("48,2 M");
    expect(montantCourt(1_500_000_000).replace(/\s/g, " ")).toBe("1,5 Md");
    expect(montantCourt(950)).toBe("950");
  });
  it("variation : null sans base", () => {
    expect(variationPct(114, 100)).toBe(14);
    expect(variationPct(10, 0)).toBeNull();
  });
});

describe("Produits 360 — signal et échéance de la DE", () => {
  const maintenant = new Date("2026-10-07T00:00:00Z");
  it("DE valable 5 ans, renouvellement déposé 180 jours avant", () => {
    const e = echeanceDecision("2022-03-15", maintenant)!;
    expect(e.expiration.toISOString().slice(0, 10)).toBe("2027-03-15");
    expect(e.depotAvant.toISOString().slice(0, 10)).toBe("2026-09-16");
    expect(e.joursAvantDepot).toBeLessThan(0);
    expect(echeanceDecision(null, maintenant)).toBeNull();
  });
  it("un seul signal, le plus grave d'abord", () => {
    expect(signalPrincipal({ pvOuverts: 1, couvertureMois: 0.5, generiquesRecents: 2, joursAvantDepotDe: 10 })?.code).toBe("PV_OUVERT");
    expect(signalPrincipal({ couvertureMois: 0.5, generiquesRecents: 2 })?.code).toBe("STOCK_BAS");
    expect(signalPrincipal({ generiquesRecents: 2, joursAvantDepotDe: 10 })?.code).toBe("GENERIQUE");
    expect(signalPrincipal({ joursAvantDepotDe: 90 })?.code).toBe("ECHEANCE_DE");
    expect(signalPrincipal({ joursAvantDepotDe: 400 })).toBeNull();
    expect(signalPrincipal({})).toBeNull();
  });
  it("la demande non servie à la PCH passe après le stock bas, avant le générique", () => {
    expect(signalPrincipal({ couvertureMois: 0.5, nonServiSignificatif: true })?.code).toBe("STOCK_BAS");
    expect(signalPrincipal({ nonServiSignificatif: true, generiquesRecents: 1 })).toMatchObject({ code: "NON_SERVI", label: "demande non servie", ton: "warning" });
    expect(signalPrincipal({ nonServiSignificatif: false, generiquesRecents: 1 })?.code).toBe("GENERIQUE");
  });
});

describe("Produits 360 — prix : la saisie manuelle l'emporte sur l'explorateur", () => {
  const maintenant = new Date("2026-10-07T00:00:00Z");
  const explo = { montant: 1250, source: "IQVIA ville", date: null };
  it("sans saisie, la valeur de l'explorateur", () => {
    const p = resoudrePrix("PPA", [], explo, maintenant);
    expect(p).toMatchObject({ montant: 1250, source: "EXPLORATEUR", explorateur: 1250 });
  });
  it("la dernière saisie en vigueur gagne et garde la valeur de l'explorateur à côté", () => {
    const p = resoudrePrix("PPA", [
      { montant: 1300, depuis: "2026-01-01", creeLe: "2026-01-01", auteur: "A", note: null },
      { montant: 1400, depuis: "2026-06-01", creeLe: "2026-06-01", auteur: "B", note: "attestation" },
      { montant: 9999, depuis: "2027-01-01", creeLe: "2026-09-01", auteur: "C", note: null },
    ], explo, maintenant);
    expect(p).toMatchObject({ montant: 1400, source: "MANUEL", auteur: "B", explorateur: 1250 });
  });
  it("une saisie sans montant rend la main à l'explorateur", () => {
    const p = resoudrePrix("PPA", [
      { montant: 1400, depuis: "2026-06-01", creeLe: "2026-06-01", auteur: "B", note: null },
      { montant: null, depuis: "2026-07-01", creeLe: "2026-07-01", auteur: "B", note: null },
    ], explo, maintenant);
    expect(p.source).toBe("EXPLORATEUR");
  });
  it("ni saisie ni explorateur → rien d'inventé", () => {
    expect(resoudrePrix("SHP", [], { montant: null, source: null, date: null }, maintenant)).toMatchObject({ montant: null, source: null });
  });
  it("lecture d'un montant saisi", () => {
    expect(lireMontant("1 234,5")).toBe(1234.5);
    expect(lireMontant("")).toBeNull();
    expect(lireMontant("-3")).toBeNaN();
    expect(lireMontant("abc")).toBeNaN();
  });
});
