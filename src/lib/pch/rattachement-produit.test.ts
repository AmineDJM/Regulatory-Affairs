import { describe, it, expect } from "vitest";
import {
  AO_STATUTS_CLOS, COUVERTURE_LABELS, LIGNE_STATUTS_CLOS, rattachementProduit, venteEstSousMarche,
  type LigneAoDuProduit, type LigneMarcheDuProduit, type TotalVentes,
} from "./rattachement-produit";

const ao = (o: Partial<LigneAoDuProduit> = {}): LigneAoDuProduit => ({
  ligneId: "l1", aoId: "ao1", aoReference: "AO-2026-01", aoTitre: "AO Oncologie 2026",
  aoStatut: "IN_PROGRESS", ligneStatut: "WON", designation: "Nivolumab 100 mg", ...o,
});
const marche = (o: Partial<LigneMarcheDuProduit> = {}): LigneMarcheDuProduit => ({
  ligneId: "m1", contratId: "c1", contratTitre: "Marché PCH 2026", contratReference: "PCH-2026-14",
  aoLigneId: "l1", designation: "Nivolumab 100 mg", ...o,
});
const rien: TotalVentes = { nombre: 0, quantite: 0, montantDzd: 0 };
const total = (nombre: number, quantite: number, montantDzd: number): TotalVentes => ({ nombre, quantite, montantDzd });
const AUCUNE_VENTE = { sousMarche: rien, ville: rien };

const lire = (o: Partial<Parameters<typeof rattachementProduit>[0]> = {}) =>
  rattachementProduit({ lignesAo: [], lignesMarche: [], ventes: AUCUNE_VENTE, canal: "BOTH", ...o });

describe("un produit, UN appel d'offres, donc UN marché PCH", () => {
  it("un AO vivant et un marché : les deux sont RETENUS et nommés", () => {
    const r = lire({ lignesAo: [ao()], lignesMarche: [marche()] });
    expect(r.ao?.aoReference).toBe("AO-2026-01");
    expect(r.marche?.contratReference).toBe("PCH-2026-14");
    expect(r.anomalies).toEqual([]);
    expect(r.couverture).toBe("MARCHE_SEUL");
  });

  it("DEUX AO vivants : aucun n'est retenu, et l'anomalie NOMME les deux", () => {
    // Le cas qui ferait tomber cette assertion est celui qu'on refuse d'écrire : garder le
    // premier. Ce serait choisir à la place d'un humain lequel des deux marchés compte
    // (§118.34), et l'écran afficherait un seul AO avec l'assurance qu'il n'y en a qu'un.
    const r = lire({ lignesAo: [ao(), ao({ ligneId: "l2", aoId: "ao2", aoReference: "AO-2026-09" })] });
    expect(r.ao).toBeNull();
    const a = r.anomalies.find((x) => x.genre === "PLUSIEURS_AO");
    expect(a?.message).toContain("AO-2026-01");
    expect(a?.message).toContain("AO-2026-09");
    expect(a?.cibles.sort()).toEqual(["ao1", "ao2"]);
  });

  it("DEUX LOTS du MÊME AO ne sont pas une anomalie — deux dosages, un seul marché", () => {
    // Sans ce cas, un comptage par LIGNE ferait de la situation la plus banale d'un AO (le même
    // produit en 40 mg et en 100 mg) une anomalie permanente, c'est-à-dire du bruit (§118.32).
    const r = lire({ lignesAo: [ao(), ao({ ligneId: "l2", designation: "Nivolumab 40 mg" })] });
    expect(r.anomalies.filter((x) => x.genre === "PLUSIEURS_AO")).toEqual([]);
    expect(r.ao?.aoId).toBe("ao1");
  });

  it("DEUX marchés PCH : même règle, aucun retenu, les deux nommés", () => {
    const r = lire({ lignesMarche: [marche(), marche({ ligneId: "m2", contratId: "c2", contratReference: "PCH-2025-03" })] });
    expect(r.marche).toBeNull();
    expect(r.anomalies.find((x) => x.genre === "PLUSIEURS_MARCHES")?.message).toContain("PCH-2025-03");
  });

  it("les AVENANTS du MÊME contrat sont UN marché — ils en sont des pièces", () => {
    const r = lire({ lignesMarche: [marche(), marche({ ligneId: "m2" })] });
    expect(r.anomalies.filter((x) => x.genre === "PLUSIEURS_MARCHES")).toEqual([]);
    expect(r.marche?.contratId).toBe("c1");
  });
});

describe("l'HISTOIRE n'est pas une anomalie", () => {
  it("un AO clos plus un AO vivant : un seul est vivant, et rien n'est signalé", () => {
    // C'est le cas du produit RECONDUIT — AO 2026 terminé, AO 2027 en cours. Juger sur le total
    // ferait de chaque reconduction une contradiction.
    const r = lire({
      lignesAo: [
        ao({ ligneId: "l0", aoId: "ao0", aoReference: "AO-2025-01", aoStatut: "COMPLETED" }),
        ao(),
      ],
    });
    expect(r.ao?.aoReference).toBe("AO-2026-01");
    expect(r.aoClos.map((x) => x.aoReference)).toEqual(["AO-2025-01"]);
    expect(r.anomalies).toEqual([]);
  });

  it("chaque statut TERMINAL ferme, sur les DEUX axes", () => {
    for (const s of AO_STATUTS_CLOS) {
      expect(lire({ lignesAo: [ao({ aoStatut: s })] }).ao, `AO ${s}`).toBeNull();
    }
    for (const s of LIGNE_STATUTS_CLOS) {
      expect(lire({ lignesAo: [ao({ ligneStatut: s })] }).ao, `ligne ${s}`).toBeNull();
    }
  });

  it("un AO SUSPENDU reste VIVANT — l'organisme reprendra, le produit y est engagé", () => {
    // Le cas qui ferait tomber cette assertion : ranger SUSPENDED parmi les statuts clos. Le
    // produit paraîtrait libre, et un second AO ne déclencherait plus rien.
    expect(lire({ lignesAo: [ao({ aoStatut: "SUSPENDED" })] }).ao?.aoId).toBe("ao1");
  });

  it("un lot GAGNÉ ne ferme rien — c'est celui qui engage", () => {
    expect(lire({ lignesAo: [ao({ ligneStatut: "WON" })] }).ao?.aoId).toBe("ao1");
  });
});

describe("ce qu'on ne sait pas lire, on ne le juge pas", () => {
  it("un statut hors des deux vocabulaires sort en « non lues » et ne crée AUCUNE anomalie", () => {
    // Le compter vivant fabriquerait une contradiction sur une valeur non comprise ; le compter
    // clos ferait disparaître un engagement réel. Les deux mentent (§118.26).
    const r = lire({ lignesAo: [ao(), ao({ ligneId: "l2", aoId: "ao2", aoStatut: "EN_NEGOCIATION" })] });
    expect(r.nonLues.map((x) => x.aoId)).toEqual(["ao2"]);
    expect(r.anomalies.filter((x) => x.genre === "PLUSIEURS_AO")).toEqual([]);
    expect(r.ao?.aoId).toBe("ao1");
  });

  it("un canal inconnu ne déclenche aucune anomalie de canal", () => {
    const r = lire({ canal: "AUTRE", ventes: { sousMarche: rien, ville: total(1, 10, 1000) }, lignesMarche: [marche()] });
    expect(r.anomalies.filter((x) => x.genre.endsWith("HORS_CANAL"))).toEqual([]);
  });
});

describe("marché PCH + ventes de VILLE — la seconde forme légitime", () => {
  it("LA RÈGLE DU PARTAGE est le rattachement à une ligne d'AO, jamais un libellé", () => {
    // C'est `Sale.tenderLineId`, un fait du schéma que personne ne lisait. La règle est exportée
    // et non recopiée : deux endroits qui partagent les ventes finiraient par les partager
    // autrement, et le symptôme serait deux chiffres d'affaires qui ne concordent pas (§118.5).
    expect(venteEstSousMarche("l1")).toBe(true);
    expect(venteEstSousMarche(null)).toBe(false);
    // Une chaîne VIDE n'est pas un rattachement : elle ne désigne aucune ligne.
    expect(venteEstSousMarche("")).toBe(false);
    expect(venteEstSousMarche(undefined)).toBe(false);
  });

  it("les deux totaux traversent tels quels — ce module n'additionne RIEN", () => {
    // Le cas qui ferait tomber cette assertion est celui qu'on refuse d'écrire : additionner en
    // mémoire une liste BORNÉE de ventes. Le total serait faux dès la 51ᵉ, et faux sans le dire.
    const r = lire({
      lignesMarche: [marche()],
      ventes: { sousMarche: total(2, 80, 8000), ville: total(1, 12, 1200) },
    });
    expect(r.ventesSousMarche).toEqual({ nombre: 2, quantite: 80, montantDzd: 8000 });
    expect(r.ventesDeVille).toEqual({ nombre: 1, quantite: 12, montantDzd: 1200 });
    expect(r.couverture).toBe("MARCHE_ET_VILLE");
  });

  it("les cinq couvertures se distinguent, et chacune porte un libellé", () => {
    expect(lire().couverture).toBe("AUCUNE");
    expect(lire({ lignesAo: [ao()] }).couverture).toBe("AO_EN_COURS");
    expect(lire({ lignesMarche: [marche()] }).couverture).toBe("MARCHE_SEUL");
    expect(lire({ lignesMarche: [marche()], ventes: { sousMarche: rien, ville: total(1, 10, 1000) } }).couverture).toBe("MARCHE_ET_VILLE");
    expect(lire({ ventes: { sousMarche: rien, ville: total(1, 10, 1000) } }).couverture).toBe("VILLE_SEULE");
    for (const [k, v] of Object.entries(COUVERTURE_LABELS)) expect(v.length, k).toBeGreaterThan(5);
  });

  it("un marché EN COURS l'emporte sur l'AO dans la couverture — il engage, l'AO promet", () => {
    // Sans cet ordre, un produit qui a son marché signé ET un AO de reconduction en cours
    // s'afficherait « appel d'offres en cours », comme s'il n'avait encore rien.
    expect(lire({ lignesAo: [ao()], lignesMarche: [marche()] }).couverture).toBe("MARCHE_SEUL");
  });
});

describe("le canal DÉCLARÉ confronté aux faits — on le dit, on ne le corrige pas", () => {
  it("hospitalier avec des ventes de ville : l'anomalie nomme le montant et les deux remèdes", () => {
    const r = lire({ canal: "HOSPITAL", lignesMarche: [marche()], ventes: { sousMarche: rien, ville: total(1, 9, 90_000) } });
    const a = r.anomalies.find((x) => x.genre === "VILLE_HORS_CANAL");
    // LES ESPACES DE GROUPEMENT SONT NORMALISÉES avant comparaison : `toLocaleString("fr-FR")`
    // rend une espace fine insécable (U+202F), pas l'espace du clavier. Comparer telle quelle
    // ferait échouer l'assertion sur la typographie et non sur le chiffre — et la « réparer »
    // en retirant tous les non-chiffres chercherait une aiguille dans une botte de foin
    // (§118.24). Ce qu'on vérifie est ce qu'une personne LIT.
    const lisible = (a?.message ?? "").replace(/[\u00a0\u202f\u2009]/g, " ");
    expect(lisible).toContain("90 000 DZD");
    expect(a?.message).toContain("Corrigez le canal");
    // ET LE RATTACHEMENT EST QUAND MÊME RENDU : une anomalie ne fait pas disparaître la lecture.
    expect(r.marche?.contratId).toBe("c1");
    expect(r.couverture).toBe("MARCHE_ET_VILLE");
  });

  it("gamme de ville figurant sur un marché PCH : signalé aussi", () => {
    const r = lire({ canal: "RETAIL", lignesMarche: [marche()] });
    expect(r.anomalies.find((x) => x.genre === "MARCHE_HORS_CANAL")).toBeTruthy();
  });

  it("« les deux » ne déclenche JAMAIS d'anomalie de canal — c'est la forme qui couvre tout", () => {
    const r = lire({ canal: "BOTH", lignesMarche: [marche()], ventes: { sousMarche: total(1, 10, 1000), ville: total(1, 10, 1000) } });
    expect(r.anomalies.filter((x) => x.genre.endsWith("HORS_CANAL"))).toEqual([]);
  });
});

describe("le fil AO → contrat", () => {
  it("une ligne de marché SANS ligne d'AO est signalée — on ne sait pas d'où vient le marché", () => {
    const r = lire({ lignesMarche: [marche({ aoLigneId: null })] });
    const a = r.anomalies.find((x) => x.genre === "MARCHE_SANS_AO");
    expect(a?.cibles).toEqual(["m1"]);
    expect(a?.message).toContain("de quel AO");
  });

  it("un fil intact ne dit rien — une réserve permanente cesse d'être lue", () => {
    expect(lire({ lignesMarche: [marche()] }).anomalies).toEqual([]);
  });
});

describe("un produit sans rien", () => {
  it("aucune ligne, aucune vente : pas d'anomalie, pas de division par zéro, et ça se DIT", () => {
    const r = lire();
    expect(r).toMatchObject({ ao: null, marche: null, aoClos: [], nonLues: [], anomalies: [], couverture: "AUCUNE" });
    expect(r.ventesDeVille).toEqual({ nombre: 0, quantite: 0, montantDzd: 0 });
  });
});
