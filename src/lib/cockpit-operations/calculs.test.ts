import { describe, it, expect } from "vitest";
import {
  aTraiterAvenants, aTraiterBcEnRetard, aTraiterBrain, aTraiterFichiersPch, aTraiterHopitauxEnRupture, aTraiterLogistique,
  aTraiterRuptures, aTraiterStockPch, bcEnRetard, couvertureLaPlusCourte, cumulLivre, cumulNonServi, evolutionLivre,
  executionDesMarches, ligneCouverture, marcheEnCours, rupturesA60Jours, selectionnerATraiter,
  type ATraiter, type BcSuivi, type ChaineMarche, type LigneCouverture,
} from "./calculs";
import { consommationDepuis, consommationMoyenne, couvertureEnMois, niveauCouverture, stockDeLaChaine } from "@/lib/stocks/pch-central";
import { MODULES, PERMISSIONS } from "@/lib/rbac";
import { MODULE_LABELS, NAVIGATION } from "@/lib/labels";

const BU_A = { id: "a", nom: "Infectiologie" }, BU_B = { id: "b", nom: "Oncologie" };

describe("la consommation mensuelle et la couverture de la chaîne", () => {
  it("moyenne des 3 derniers mois COMPLETS ayant une donnée — le mois en cours et les mois sans fichier ne comptent pas", () => {
    const lignes = [
      { mois: "2026-05", livre: 900 }, { mois: "2026-06", livre: 1000 }, { mois: "2026-07", livre: 600 }, { mois: "2026-07", livre: 400 },
      { mois: "2026-09", livre: 1300 }, { mois: "2026-10", livre: 5000 },
    ];
    // Août manque (pas de fichier) : juin, juillet, septembre — pas un zéro pour août, et octobre est en cours.
    expect(consommationMoyenne(lignes, "2026-10")).toBe(Math.round((1000 + 1000 + 1300) / 3));
    expect(consommationMoyenne([], "2026-10")).toBeNull();
    expect(consommationMoyenne([{ mois: "2026-10", livre: 50 }], "2026-10")).toBeNull();
    expect(consommationMoyenne([{ mois: "2026-09", livre: 800 }], "2026-10")).toBe(800);
  });

  it("le crochet lit la table, et une valeur absente reste nulle", () => {
    const c = consommationDepuis(new Map([["p1", 1080], ["p2", null]]));
    expect(c("p1")).toBe(1080);
    expect(c("p2")).toBeNull();
    expect(c("inconnu")).toBeNull();
  });

  it("stock de la chaîne = somme des maillons connus ; couverture et niveaux rouge < 2, orange < 3", () => {
    expect(stockDeLaChaine([1540, 300, 900])).toBe(2740);
    expect(stockDeLaChaine([null, 300, undefined])).toBe(300);
    expect(stockDeLaChaine([null, undefined])).toBeNull();
    expect(couvertureEnMois(2740, 1080)).toBe(2.5);
    expect(niveauCouverture(1.9)).toBe("rupture");
    expect(niveauCouverture(2)).toBe("vigilance");
    expect(niveauCouverture(2.9)).toBe("vigilance");
    expect(niveauCouverture(3)).toBe("ok");
    expect(niveauCouverture(null)).toBeNull();
  });
});

describe("les tuiles", () => {
  it("livré à la PCH : un produit sans fournisseur « à nous » ne compte pas ; rien de lisible ≠ zéro", () => {
    const lignes = [
      { recuNous: 1000, recuValeur: 50_000_000, sansFournisseur: false, bus: [BU_A] },
      { recuNous: 400, recuValeur: null, sansFournisseur: false, bus: [BU_B] },
      { recuNous: 9999, recuValeur: 1, sansFournisseur: true, bus: [BU_A] },
    ];
    expect(cumulLivre(lignes, null)).toEqual({ lisible: true, boites: 1400, valeur: 50_000_000, valorise: true });
    expect(cumulLivre(lignes, "b")).toEqual({ lisible: true, boites: 400, valeur: 0, valorise: false });
    expect(cumulLivre([lignes[2]], null).lisible).toBe(false);
  });

  it("évolution en valeur quand les deux périodes sont valorisées, sinon en boîtes ; sans N-1 : nulle", () => {
    const cur = { lisible: true, boites: 110, valeur: 1_120_000, valorise: true };
    expect(evolutionLivre(cur, { lisible: true, boites: 100, valeur: 1_000_000, valorise: true })).toBe(12);
    expect(evolutionLivre(cur, { lisible: true, boites: 100, valeur: 0, valorise: false })).toBe(10);
    expect(evolutionLivre(cur, null)).toBeNull();
    expect(evolutionLivre(cur, { lisible: true, boites: 0, valeur: 0, valorise: false })).toBeNull();
  });

  it("marchés de l'année : période qui croise l'année ; annulé, échu sans fin, futur ou vieil AO exclus", () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    expect(marcheEnCours({ statut: "ACTIVE", debut: d("2026-01-01"), fin: d("2026-12-31"), attribution: null }, 2026)).toBe(true);
    expect(marcheEnCours({ statut: "EXPIRED", debut: d("2025-03-01"), fin: d("2026-02-28"), attribution: null }, 2026)).toBe(true);
    expect(marcheEnCours({ statut: "ACTIVE", debut: d("2024-01-01"), fin: d("2025-12-31"), attribution: null }, 2026)).toBe(false);
    expect(marcheEnCours({ statut: "CANCELLED", debut: d("2026-01-01"), fin: null, attribution: null }, 2026)).toBe(false);
    expect(marcheEnCours({ statut: "EXPIRED", debut: d("2025-01-01"), fin: null, attribution: null }, 2026)).toBe(false);
    expect(marcheEnCours({ statut: "ACTIVE", debut: d("2027-01-01"), fin: null, attribution: null }, 2026)).toBe(false);
    expect(marcheEnCours({ statut: null, debut: null, fin: null, attribution: d("2025-06-01") }, 2026)).toBe(true);
    expect(marcheEnCours({ statut: null, debut: null, fin: null, attribution: d("2023-06-01") }, 2026)).toBe(false);
    expect(marcheEnCours({ statut: null, debut: null, fin: null, attribution: null }, 2026)).toBe(true);
  });

  it("exécution = livré ÷ attribué des marchés en cours de la BU ; rien d'attribué → null (jamais 0 %)", () => {
    const chaines: ChaineMarche[] = [
      { nom: "Raltégravir", reference: "AO-1", bus: [BU_A], attribue: 40_000, commande: 34_000, livre: 31_200, bcAvenants: 0, enCours: true },
      { nom: "Darunavir", reference: "AO-2", bus: [BU_A], attribue: 22_000, commande: 14_000, livre: 12_900, bcAvenants: 0, enCours: true },
      { nom: "Ancien", reference: "AO-0", bus: [BU_A], attribue: 99_000, commande: 0, livre: 0, bcAvenants: 0, enCours: false },
    ];
    expect(executionDesMarches(chaines, null)).toEqual({ attribue: 62_000, livre: 44_100, marches: 2, pct: 71 });
    expect(executionDesMarches(chaines, "b")).toEqual({ attribue: 0, livre: 0, marches: 0, pct: null });
  });

  it("non servi : borné aux produits de la BU", () => {
    const l = [{ productId: "p1", quantite: 300 }, { productId: "p2", quantite: 50 }];
    expect(cumulNonServi(l, null)).toBe(350);
    expect(cumulNonServi(l, new Set(["p2"]))).toBe(50);
  });

  it("ruptures à 60 jours : couverture < 2 mois, un produit à deux BU compté une fois, non mesurable écarté", () => {
    const base = { adventum: null, hopitaux: null, buNom: "" };
    const lignes: LigneCouverture[] = [
      ligneCouverture({ ...base, productId: "d", label: "Darunavir", buId: "a", pch: 1500, conso: 1000 }),
      ligneCouverture({ ...base, productId: "d", label: "Darunavir", buId: "b", pch: 1500, conso: 1000 }),
      ligneCouverture({ ...base, productId: "r", label: "Raltégravir", buId: "a", pch: 7300, conso: 1000 }),
      ligneCouverture({ ...base, productId: "x", label: "Sans conso", buId: "a", pch: 10, conso: null }),
      ligneCouverture({ ...base, productId: "y", label: "Très court", buId: "a", pch: 500, conso: 1000 }),
    ];
    const r = rupturesA60Jours(lignes, null);
    expect(r.mesurables).toBe(3);
    expect(r.produits).toBe(4);
    expect(r.enRupture.map((l) => l.productId)).toEqual(["y", "d"]);
    expect(rupturesA60Jours(lignes, "b").enRupture.map((l) => l.productId)).toEqual(["d"]);
    expect(couvertureLaPlusCourte(lignes, "a")?.productId).toBe("y");
    expect(couvertureLaPlusCourte(lignes, "zzz")).toBeNull();
  });
});

describe("à traiter", () => {
  const maintenant = new Date("2026-10-08T10:00:00Z");

  it("sélection : rouge, puis orange, puis information ; à ton égal le plus lourd ; 7 au plus ; une clé une fois", () => {
    const el = (cle: string, ton: ATraiter["ton"], poids: number): ATraiter => ({ cle, ton, poids, titre: cle, detail: "", href: "/x", action: "Voir" });
    const items = [el("i1", "i", 99), el("w1", "w", 1), el("ko1", "ko", 1), el("ko2", "ko", 5), el("w2", "w", 3), el("ko2", "ko", 5),
      el("i2", "i", 1), el("w3", "w", 2), el("i3", "i", 0)];
    expect(selectionnerATraiter(items).map((x) => x.cle)).toEqual(["ko2", "ko1", "w2", "w3", "w1", "i1", "i2"]);
    expect(selectionnerATraiter(items, 3)).toHaveLength(3);
  });

  it("rupture de la chaîne : le détail du stock et un lien vers la chaîne", () => {
    const l = ligneCouverture({ productId: "d", label: "Darunavir", buId: "a", buNom: "", adventum: 1540, pch: 300, hopitaux: 900, conso: 1500 });
    const [x] = aTraiterRuptures([l], () => "/stocks/chaine?bu=a");
    expect(x.ton).toBe("ko");
    expect(x.titre).toMatch(/^Darunavir : 1,8 mois de couverture$/);
    expect(x.detail).toMatch(/Adventum 1.540 · PCH 300 · hôpitaux 900 · conso 1.500\/mois/);
    expect(x.href).toBe("/stocks/chaine?bu=a");
  });

  it("BC en retard : ouvert, date prévue (BC ou livraison) dépassée et non arrivé ; le plus ancien d'abord", () => {
    const bc = (o: Partial<BcSuivi>): BcSuivi => ({ id: "1", reference: "2026-118", tenderId: "t1", statut: "VALIDATED", attendu: null, arrive: null, livraisons: [], ...o });
    const r = bcEnRetard([
      bc({ id: "1", attendu: new Date("2026-10-01T00:00:00Z") }),
      bc({ id: "2", reference: "2026-121", livraisons: [{ attendu: new Date("2026-09-28T00:00:00Z"), livre: null }] }),
      bc({ id: "3", attendu: new Date("2026-10-01T00:00:00Z"), arrive: new Date("2026-10-02T00:00:00Z") }),
      bc({ id: "4", attendu: new Date("2026-10-01T00:00:00Z"), statut: "DELIVERED" }),
      bc({ id: "5", attendu: new Date("2026-10-08T00:00:00Z") }),
      bc({ id: "6", livraisons: [{ attendu: new Date("2026-09-01T00:00:00Z"), livre: new Date("2026-09-02T00:00:00Z") }] }),
    ], maintenant);
    expect(r.map((b) => [b.id, b.jours])).toEqual([["2", 10], ["1", 7]]);
    const [x] = aTraiterBcEnRetard(r);
    expect(x.titre).toBe("2 BC PCH en retard de livraison");
    expect(x.detail).toContain("BC 2026-121, BC 2026-118");
    expect(x.href).toBe("/pch");
    expect(aTraiterBcEnRetard([r[0]])[0].href).toBe("/pch/t1");
    expect(aTraiterBcEnRetard([])).toEqual([]);
  });

  it("hôpitaux non servis alors que la PCH centrale a du stock — pas sans stock, pas sans demande", () => {
    const ns = [
      { productId: "r", nom: "Raltégravir", quantite: 120, etablissements: 2, drs: ["DRE"] },
      { productId: "d", nom: "Darunavir", quantite: 80, etablissements: 1, drs: ["DRO"] },
      { productId: "z", nom: "Zéro", quantite: 0, etablissements: 0, drs: [] },
    ];
    const stock = new Map<string, number | null>([["r", 2100], ["d", 0], ["z", 50]]);
    const r = aTraiterHopitauxEnRupture(ns, stock, "/sales/non-servi");
    expect(r).toHaveLength(1);
    expect(r[0].titre).toBe("Raltégravir : 2 établissements non servis");
    expect(r[0].ton).toBe("w");
  });

  it("avenant à prévoir : BC cumulés ≥ attribué, marché en cours, aucun BC d'avenant encore", () => {
    const c = (o: Partial<ChaineMarche>): ChaineMarche => ({ nom: "P", reference: "AO-1", bus: [], attribue: 100, commande: 100, livre: 0, bcAvenants: 0, enCours: true, ...o });
    expect(aTraiterAvenants([c({})], "/sales/contrats")).toHaveLength(1);
    expect(aTraiterAvenants([c({ commande: 99 })], "/sales/contrats")).toHaveLength(0);
    expect(aTraiterAvenants([c({ bcAvenants: 1, commande: 120 })], "/sales/contrats")).toHaveLength(0);
    expect(aTraiterAvenants([c({ enCours: false })], "/sales/contrats")).toHaveLength(0);
    expect(aTraiterAvenants([c({ attribue: 0, commande: 10 })], "/sales/contrats")).toHaveLength(0);
  });

  it("fraîcheur : un mois DR manquant ou une source en retard ; le stock PCH central de plus de 30 jours ou jamais saisi", () => {
    const sources = [
      { source: "DRO", libelle: "Oran", dernier: "2026-09", manquants: ["2026-08"] },
      { source: "DRC", libelle: "Constantine", dernier: "2026-08", manquants: [] },
      { source: "DRE", libelle: "Est", dernier: "2026-09", manquants: [] },
    ];
    const [x] = aTraiterFichiersPch(sources, "2026-09", "/sales/importer");
    expect(x.titre).toBe("Fichiers PCH incomplets (2 sources)");
    expect(x.detail).toContain("DRO : août 2026");
    expect(x.detail).toContain("DRC : depuis août 2026");
    expect(aTraiterFichiersPch([sources[2]], "2026-09", "/sales/importer")).toEqual([]);
    expect(aTraiterStockPch(34, 3, "/stocks/pch-central")[0].titre).toBe("Stock PCH central : dernier relevé il y a 34 j");
    expect(aTraiterStockPch(10, 3, "/stocks/pch-central")).toEqual([]);
    expect(aTraiterStockPch(null, 3, "/stocks/pch-central")[0].titre).toBe("Stock PCH central jamais saisi");
    expect(aTraiterStockPch(null, 0, "/stocks/pch-central")).toEqual([]);
  });

  it("Brain : les 3 plus graves, le ton suit le niveau, un lien externe retombe sur l'écran Brain", () => {
    const r = (id: string, level: string, href: string | null = null) => ({ id, level, title: id, object: "o", href });
    const out = aTraiterBrain([r("m", "medium"), r("c", "critical", "/pch/1"), r("h", "high", "https://x"), r("l", "low")], "/adventum-brain");
    expect(out.map((x) => [x.cle, x.ton, x.href])).toEqual([["brain:c", "ko", "/pch/1"], ["brain:h", "w", "/adventum-brain"], ["brain:m", "i", "/adventum-brain"]]);
  });

  it("logistique : bloquée, ou en douane depuis plus de 7 jours", () => {
    const r = aTraiterLogistique([
      { id: "1", reference: "MSC-4471", produit: "Dolutégravir", statut: "CUSTOMS", depuis: new Date("2026-09-29T10:00:00Z") },
      { id: "2", reference: "MSC-1", produit: "X", statut: "CUSTOMS", depuis: new Date("2026-10-05T10:00:00Z") },
      { id: "3", reference: "MSC-2", produit: "Y", statut: "BLOCKED", depuis: null },
    ], maintenant);
    expect(r.map((x) => x.cle)).toEqual(["logistique:1", "logistique:3"]);
    expect(r[0].titre).toBe("Commande MSC-4471 en douane depuis 9 j");
  });
});

describe("le module Cockpit Opérations", () => {
  it("est un module réglable, nommé, ouvert par défaut au DO, à la Direction, au DG et au Super Admin seulement", () => {
    expect(MODULES).toContain("COCKPIT_OPERATIONS");
    expect(MODULE_LABELS.COCKPIT_OPERATIONS).toBe("Cockpit Opérations");
    for (const r of ["OPERATIONS_DIRECTOR", "DIRECTION", "GENERAL_MANAGER", "SUPER_ADMIN"] as const) expect(PERMISSIONS[r].COCKPIT_OPERATIONS, r).toContain("VIEW");
    for (const r of ["HEAD_OF_SALES", "MEDICAL_DELEGATE", "PRODUCT_MANAGER", "FINANCE_BUDGET_MANAGER", "NATIONAL_SALES"] as const) expect(PERMISSIONS[r].COCKPIT_OPERATIONS, r).toBeUndefined();
  });

  it("est la PREMIÈRE entrée du pôle Operations & Sales, sur /operations", () => {
    const ops = NAVIGATION.filter((n) => n.pole === "OPERATIONS_SALES");
    expect(ops[0]).toMatchObject({ module: "COCKPIT_OPERATIONS", label: "Cockpit Opérations", href: "/operations" });
  });
});
