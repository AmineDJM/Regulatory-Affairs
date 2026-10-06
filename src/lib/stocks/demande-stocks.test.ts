import { describe, it, expect } from "vitest";
import {
  couvertureDepuisAffectations, developperDemande, lireSaisie, avancementParKam, avancementGlobal, consolider, casesManquantes,
  type EntreeDeveloppement,
} from "./demande-stocks";

/**
 * DEMANDE DE STOCKS (DO → KAM, Direction 06/10) — « aucun = tous », le routage établissement →
 * KAM, la saisie en tableaux parallèles, la consolidation. Chaque cas nomme le défaut qu'il ferme.
 */

// Deux BU : ONCO (produits P1, P2) et CARDIO (P3). Karim est KAM ONCO sur H1 et H2 ; Sara est
// KAM CARDIO sur H2 ; Nadia (fiche ONCO) est affectée à un secteur CARDIO qui couvre H3 — il ne
// compte pas. H4 n'est couvert par personne.
const couverture = couvertureDepuisAffectations([
  { kamId: "karim", buDuKam: "ONCO", buDuSecteur: "ONCO", institutionIds: ["H1", "H2"] },
  { kamId: "sara", buDuKam: null, buDuSecteur: "CARDIO", institutionIds: ["H2"] },
  { kamId: "nadia", buDuKam: "ONCO", buDuSecteur: "CARDIO", institutionIds: ["H3"] },
]);
const produitsParBu = { ONCO: ["P1", "P2"], CARDIO: ["P3"] };
const base: EntreeDeveloppement = {
  hopitauxChoisis: [], candidats: ["H1", "H2", "H3", "H4"], produitsChoisis: {},
  catalogue: ["P1", "P2", "P3", "P4"], couverture, produitsParBu,
};

describe("la couverture — la règle de la portée de stock", () => {
  it("un secteur d'une autre BU que celle de la fiche ne compte pas (sinon Nadia recevrait H3)", () => {
    expect(couverture.get("H3")).toBeUndefined();
    expect(couverture.get("H2")).toEqual([{ kamId: "karim", buId: "ONCO" }, { kamId: "sara", buId: "CARDIO" }]);
  });
});

describe("développer — aucun établissement = tous, aucun produit = tous ceux que ses KAM portent", () => {
  it("aucun établissement coché : TOUS les candidats, en instantané", () => {
    const d = developperDemande(base);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.toutHopitaux).toBe(true);
    expect(d.hopitaux.map((h) => h.institutionId)).toEqual(["H1", "H2", "H3", "H4"]);
    // H1 : P1, P2 (Karim) ; H2 : P1, P2 (Karim) + P3 (Sara) ; H3, H4 : sans KAM → aucune case.
    expect(d.lignes.map((l) => `${l.institutionId}:${l.productId}:${l.kamIds.join("+")}`)).toEqual([
      "H1:P1:karim", "H1:P2:karim", "H2:P1:karim", "H2:P2:karim", "H2:P3:sara",
    ]);
    expect(d.hopitaux.filter((h) => h.sansKam).map((h) => h.institutionId)).toEqual(["H3", "H4"]);
    expect(d.destinataires).toEqual(["karim", "sara"]);
  });

  it("« tous les produits » ne prend PAS le catalogue entier — P4, que personne ne porte, ferait des cases mortes", () => {
    const d = developperDemande({ ...base, hopitauxChoisis: ["H2"] });
    expect(d.ok && d.lignes.map((l) => l.productId)).toEqual(["P1", "P2", "P3"]);
  });

  it("un produit CHOISI reste demandé même sans KAM : la case est « sans KAM », visible du DO", () => {
    const d = developperDemande({ ...base, hopitauxChoisis: ["H1"], produitsChoisis: { H1: ["P1", "P3"] } });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.hopitaux[0]!.tousProduits).toBe(false);
    expect(d.lignes).toEqual([
      { institutionId: "H1", productId: "P1", kamIds: ["karim"] },
      { institutionId: "H1", productId: "P3", kamIds: [] },
    ]);
  });

  it("le filtre commun réduit « tous » sans inventer de cases sans KAM", () => {
    const d = developperDemande({ ...base, produitsCommuns: ["P3"] });
    expect(d.ok && d.lignes).toEqual([{ institutionId: "H2", productId: "P3", kamIds: ["sara"] }]);
  });

  it("deux KAM sur la même case la partagent (une seule ligne, deux porteurs)", () => {
    const c = couvertureDepuisAffectations([
      { kamId: "a", buDuKam: "ONCO", buDuSecteur: "ONCO", institutionIds: ["H1"] },
      { kamId: "b", buDuKam: "ONCO", buDuSecteur: "ONCO", institutionIds: ["H1"] },
    ]);
    const d = developperDemande({ ...base, couverture: c, hopitauxChoisis: ["H1"], produitsChoisis: { H1: ["P1"] } });
    expect(d.ok && d.lignes).toEqual([{ institutionId: "H1", productId: "P1", kamIds: ["a", "b"] }]);
  });

  it("un identifiant inconnu fait échouer la demande ENTIÈRE (jamais une sélection amputée)", () => {
    expect(developperDemande({ ...base, hopitauxChoisis: ["H1", "ZZ"] }).ok).toBe(false);
    expect(developperDemande({ ...base, hopitauxChoisis: ["H1"], produitsChoisis: { H1: ["PX"] } }).ok).toBe(false);
    expect(developperDemande({ ...base, hopitauxChoisis: ["H1"], produitsChoisis: { H2: ["P1"] } }).ok).toBe(false);
  });

  it("une demande qui ne partirait vers personne est refusée en le DISANT", () => {
    const d = developperDemande({ ...base, hopitauxChoisis: ["H4"] });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.error).toMatch(/secteurs/);
  });
});

describe("la saisie — tableaux parallèles, relus sans complaisance", () => {
  it("lit chaque case ; vide = pas encore ; rupture = 0 quoi qu'on ait tapé", () => {
    const s = lireSaisie(["H1", "H1", "H2"], ["P1", "P2", "P1"], ["12", "", "40"], ["0", "0", "1"]);
    expect(s).toEqual({ ok: true, entrees: [
      { institutionId: "H1", productId: "P1", quantite: 12, rupture: false },
      { institutionId: "H1", productId: "P2", quantite: null, rupture: false },
      { institutionId: "H2", productId: "P1", quantite: 0, rupture: true },
    ] });
  });

  it("des colonnes de longueurs différentes sont refusées — sinon un stock s'écrirait sur le produit voisin", () => {
    expect(lireSaisie(["H1", "H1"], ["P1", "P2"], ["1"], ["0", "0"]).ok).toBe(false);
  });

  it("négatif, décimal ou texte : refusé en nommant la valeur", () => {
    for (const q of ["-1", "2.5", "abc"]) {
      const s = lireSaisie(["H1"], ["P1"], [q], ["0"]);
      expect(s.ok).toBe(false);
      if (!s.ok) expect(s.error).toContain(q);
    }
    expect(lireSaisie(["H1"], ["P1"], ["1 200"], ["0"])).toEqual({ ok: true, entrees: [{ institutionId: "H1", productId: "P1", quantite: 1200, rupture: false }] });
  });

  it("la même case deux fois est refusée", () => {
    expect(lireSaisie(["H1", "H1"], ["P1", "P1"], ["1", "2"], ["0", "0"]).ok).toBe(false);
  });
});

describe("avancement et consolidation", () => {
  const lignes = [
    { hopitalId: "h1", productId: "P1", productLabel: "Onco 1", kamIds: ["karim"], quantite: 10, rupture: false },
    { hopitalId: "h1", productId: "P2", productLabel: "Onco 2", kamIds: ["karim"], quantite: null, rupture: false },
    { hopitalId: "h2", productId: "P1", productLabel: "Onco 1", kamIds: ["karim"], quantite: null, rupture: true },
    { hopitalId: "h2", productId: "P3", productLabel: "Cardio", kamIds: ["sara"], quantite: 5, rupture: false },
    { hopitalId: "h3", productId: "P3", productLabel: "Cardio", kamIds: [], quantite: null, rupture: false },
  ];

  it("par KAM : ses cases seulement, et l'envoi", () => {
    expect(avancementParKam(lignes, [{ kamId: "karim", envoyeLe: null }, { kamId: "sara", envoyeLe: "2026-10-06" }])).toEqual([
      { kamId: "karim", total: 3, remplies: 2, envoye: false },
      { kamId: "sara", total: 1, remplies: 1, envoye: true },
    ]);
    expect(casesManquantes(lignes.filter((l) => l.kamIds.includes("karim")))).toBe(1);
  });

  it("global : les cases sans KAM ne comptent pas dans le pourcentage, elles sont comptées à part", () => {
    expect(avancementGlobal(lignes)).toEqual({ total: 4, remplies: 3, sansKam: 1, pourcentage: 75 });
  });

  it("la matrice : HORS n'est pas zéro, la rupture n'entre pas dans le total", () => {
    const m = consolider([{ id: "h1" }, { id: "h2" }, { id: "h3" }], lignes);
    expect(m.produits).toEqual([
      { id: "P1", label: "Onco 1", total: 10 },
      { id: "P2", label: "Onco 2", total: 0 },
      { id: "P3", label: "Cardio", total: 5 },
    ]);
    expect(m.lignes[0]!.cellules).toEqual([{ etat: "QUANTITE", quantite: 10 }, { etat: "A_RENSEIGNER" }, { etat: "HORS" }]);
    expect(m.lignes[1]!.cellules).toEqual([{ etat: "RUPTURE" }, { etat: "HORS" }, { etat: "QUANTITE", quantite: 5 }]);
    expect(m.lignes[2]!.cellules).toEqual([{ etat: "HORS" }, { etat: "HORS" }, { etat: "SANS_KAM" }]);
  });
});
