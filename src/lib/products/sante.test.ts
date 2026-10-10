import { describe, it, expect } from "vitest";
import {
  noteStock, noteTerrain, notePrescripteurs, noteReglementaire, noteQualite, noteSante, penaliteEcheanceDe, tonSante,
  fenetreCycle, lettreDuProduit, estCibleHab, mouvementLettres, alertePrincipale, POIDS_SANTE,
} from "./sante";
import { lireReponseEssentiel, essentielDeterministe, nombresDe, empreinteFaits, type Fait360 } from "./essentiel-360";

describe("santé d'un produit — les composantes", () => {
  it("stock : ≥ 3 mois = 100, linéaire jusqu'à 0, −10 par lot sous 6 mois (au plus −30), n/d sans couverture", () => {
    expect(noteStock({ couvertureMois: 7.3, lotsExpirant: 0 })).toBe(100);
    expect(noteStock({ couvertureMois: 1.5, lotsExpirant: 0 })).toBe(50);
    expect(noteStock({ couvertureMois: 0, lotsExpirant: 0 })).toBe(0);
    expect(noteStock({ couvertureMois: 4, lotsExpirant: 1 })).toBe(90);
    expect(noteStock({ couvertureMois: 4, lotsExpirant: 9 })).toBe(70);
    expect(noteStock({ couvertureMois: null, lotsExpirant: 2 })).toBeNull();
  });

  it("couverture terrain : part des cibles H·A·B vues à fréquence ; aucune cible = n/d", () => {
    expect(noteTerrain({ cibles: 50, vuesAFrequence: 32 })).toBe(64);
    expect(noteTerrain({ cibles: 0, vuesAFrequence: 0 })).toBeNull();
    expect(noteTerrain({ cibles: 4, vuesAFrequence: 9 })).toBe(100);
  });

  it("prescripteurs : 25 % de A = 80 points, ±5 par A net, 10 neutres sans cycle", () => {
    expect(notePrescripteurs({ a: 25, segmentes: 100, mouvementNet: null })).toBe(90);
    expect(notePrescripteurs({ a: 25, segmentes: 100, mouvementNet: 2 })).toBe(100);
    expect(notePrescripteurs({ a: 0, segmentes: 100, mouvementNet: -3 })).toBe(0);
    expect(notePrescripteurs({ a: 10, segmentes: 100, mouvementNet: 0 })).toBe(42);
    expect(notePrescripteurs({ a: 0, segmentes: 0, mouvementNet: 1 })).toBeNull();
  });

  it("réglementaire : échéance de dépôt DE et variations en attente ; sans dossier = n/d", () => {
    expect(penaliteEcheanceDe(null)).toBe(0);
    expect(penaliteEcheanceDe(-1)).toBe(60);
    expect(penaliteEcheanceDe(60)).toBe(45);
    expect(penaliteEcheanceDe(150)).toBe(25);
    expect(penaliteEcheanceDe(400)).toBe(0);
    expect(noteReglementaire({ dossiers: 1, joursAvantDepot: 150, variationsEnAttente: 1 })).toBe(60);
    expect(noteReglementaire({ dossiers: 1, joursAvantDepot: null, variationsEnAttente: 5 })).toBe(70);
    expect(noteReglementaire({ dossiers: 0, joursAvantDepot: null, variationsEnAttente: 0 })).toBeNull();
  });

  it("qualité : cas PV ouverts pondérés par la gravité ; aucun cas = 100 ; module non vu = n/d", () => {
    expect(noteQualite({ gravitesOuvertes: [] })).toBe(100);
    expect(noteQualite({ gravitesOuvertes: ["NON_GRAVE"] })).toBe(85);
    expect(noteQualite({ gravitesOuvertes: ["GRAVE", null] })).toBe(35);
    expect(noteQualite({ gravitesOuvertes: ["DECES", "GRAVE"] })).toBe(0);
    expect(noteQualite(null)).toBeNull();
  });
});

describe("santé d'un produit — la note globale", () => {
  it("les poids de la Direction : 25 / 25 / 20 / 15 / 15", () => {
    expect(POIDS_SANTE).toEqual({ stock: 25, terrain: 25, prescripteurs: 20, reglementaire: 15, qualite: 15 });
  });

  it("moyenne pondérée quand tout est connu", () => {
    const n = noteSante({ stock: 100, terrain: 64, prescripteurs: 90, reglementaire: 75, qualite: 85 });
    expect(n.score).toBe(Math.round((25 * 100 + 25 * 64 + 20 * 90 + 15 * 75 + 15 * 85) / 100));
    expect(n.composantes.every((c) => c.poidsEffectif === c.poids)).toBe(true);
  });

  it("une composante sans donnée est exclue et les poids renormalisés — jamais un zéro", () => {
    const n = noteSante({ stock: 80, terrain: null, prescripteurs: undefined, reglementaire: 100, qualite: null }, { stock: "4 mois" });
    expect(n.score).toBe(Math.round((25 * 80 + 15 * 100) / 40));
    const terrain = n.composantes.find((c) => c.cle === "terrain")!;
    expect(terrain.note).toBeNull();
    expect(terrain.poidsEffectif).toBeNull();
    expect(n.composantes.find((c) => c.cle === "stock")!.poidsEffectif).toBe(63);
    expect(n.composantes.find((c) => c.cle === "stock")!.fait).toBe("4 mois");
  });

  it("aucune composante : note n/d, ton neutre", () => {
    expect(noteSante({}).score).toBeNull();
    expect(tonSante(null)).toBe("neutral");
    expect(tonSante(72)).toBe("success");
    expect(tonSante(58)).toBe("warning");
    expect(tonSante(41)).toBe("danger");
  });
});

describe("le cycle, les lettres, le mouvement", () => {
  it("sans cycle de segmentation ouvert : le mois civil, comparé à la même durée du mois précédent", () => {
    const f = fenetreCycle(new Date("2026-10-09T12:00:00Z"));
    expect(f.source).toBe("MOIS");
    expect(f.debut.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(f.precedent.debut.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(f.precedent.finExclue.toISOString()).toBe("2026-09-09T12:00:00.000Z");
  });

  it("un cycle de segmentation ouvert fixe la fenêtre ; le précédent a la même durée écoulée", () => {
    const f = fenetreCycle(new Date("2026-10-15T00:00:00Z"), { debut: new Date("2026-10-01T00:00:00Z"), fin: new Date("2026-10-28T00:00:00Z") });
    expect(f.source).toBe("SEGMENTATION");
    expect(f.precedent.debut.toISOString()).toBe("2026-09-03T00:00:00.000Z");
    expect(f.precedent.finExclue.toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });

  it("la lettre du produit : H d'abord, puis le segment, NA, NC", () => {
    expect(lettreDuProduit({ cible: true, h: true, etat: "C" })).toBe("H");
    expect(lettreDuProduit({ cible: true, h: false, etat: "A" })).toBe("A");
    expect(lettreDuProduit({ cible: true, h: false, etat: "EN_ATTENTE" })).toBe("NA");
    expect(lettreDuProduit({ cible: false, h: false, etat: "A" })).toBe("NC");
    expect(estCibleHab({ cible: true, h: false, segment: "B", requis: 2 })).toBe(true);
    expect(estCibleHab({ cible: true, h: false, segment: "C", requis: 2 })).toBe(false);
    expect(estCibleHab({ cible: true, h: true, segment: "D", requis: 0 })).toBe(false);
  });

  it("le mouvement : B → A, A perdus, solde net sur les praticiens présents des deux côtés", () => {
    const avant = new Map([["1", "B"], ["2", "B"], ["3", "A"], ["4", "C"]]);
    const apres = new Map([["1", "A"], ["2", "B"], ["3", "B"], ["4", "A"], ["5", "A"]]);
    expect(mouvementLettres(avant, apres)).toEqual({ bVersA: 1, aPerdus: 1, net: 1 });
  });

  it("l'alerte principale : la plus grave d'abord, rien pour un module non vu", () => {
    expect(alertePrincipale({ pvOuverts: 1, couvertureMois: 1 })?.code).toBe("PV_OUVERT");
    expect(alertePrincipale({ hopitauxEnRupture: 2, couvertureMois: 5 })?.label).toBe("rupture · 2 hôpitaux");
    expect(alertePrincipale({ premierLotPerime: "2027-02-10", hNonVus: 3 })?.label).toBe("lot périme en févr. 2027");
    expect(alertePrincipale({ hNonVus: 4, joursAvantDepotDe: 100 })?.code).toBe("H_NON_VUS");
    expect(alertePrincipale({})).toBeNull();
  });
});

describe("Luna — l'essentiel : relecture stricte et repli", () => {
  const faits: Fait360[] = [
    { id: "F1", texte: "CHU Sétif : 0 boîte au relevé du 06/10, alors que la PCH centrale en a 2 100.", source: "Stocks", priorite: 0 },
    { id: "F2", texte: "4 décideur(s) H non vu(s) ce cycle.", source: "Terrain", priorite: 2 },
    { id: "F3", texte: "Couverture du stock (PCH + hôpitaux) : 7,3 mois.", source: "Stocks", priorite: 6 },
    { id: "F4", texte: "1 cas de pharmacovigilance ouvert(s) : PV-2026-004.", source: "Pharmacovigilance", priorite: 1 },
  ];

  it("garde les points qui citent des faits connus et n'écrivent que leurs nombres", () => {
    const lu = lireReponseEssentiel({ points: [
      { texte: "CHU Sétif est en rupture alors que la PCH a 2100 boîtes : réapprovisionner.", faits: ["F1"] },
      { texte: "12 décideurs non vus.", faits: ["F2"] },
      { texte: "Point sans source.", faits: ["F9"] },
      { texte: "4 décideurs H restent à voir ce cycle.", faits: ["F2"] },
    ] }, faits);
    expect(lu).toEqual([
      { texte: "CHU Sétif est en rupture alors que la PCH a 2100 boîtes : réapprovisionner.", sources: ["Stocks"] },
      { texte: "4 décideurs H restent à voir ce cycle.", sources: ["Terrain"] },
    ]);
  });

  it("une réponse hors forme ou sans point valable → null", () => {
    expect(lireReponseEssentiel(null, faits)).toBeNull();
    expect(lireReponseEssentiel({ points: "x" }, faits)).toBeNull();
    expect(lireReponseEssentiel({ points: [{ texte: "99 % de couverture", faits: ["F3"] }] }, faits)).toBeNull();
  });

  it("au plus trois points", () => {
    const pts = Array.from({ length: 5 }, () => ({ texte: "Voir les stocks.", faits: ["F3"] }));
    expect(lireReponseEssentiel({ points: pts }, faits)).toHaveLength(3);
  });

  it("le repli : les trois faits les plus urgents, tels quels", () => {
    expect(essentielDeterministe(faits).map((p) => p.texte)).toEqual([faits[0].texte, faits[3].texte, faits[1].texte]);
  });

  it("les nombres normalisés et l'empreinte stable", () => {
    expect(nombresDe("2 100 boîtes, 7,3 mois")).toEqual(["2100", "7.3"]);
    expect(empreinteFaits(faits)).toBe(empreinteFaits([...faits]));
    expect(empreinteFaits(faits)).not.toBe(empreinteFaits(faits.slice(1)));
  });
});
