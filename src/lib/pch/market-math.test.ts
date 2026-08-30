import { describe, expect, it } from "vitest";
import {
  attributionPartielle, controlerCommande, deriverNiveau, etapeCourante, ETAPES_MARCHE,
  quantitesContractuelles, restantACommander, restantALivrer, unitesAttribuees, uniteSoumises,
  valeurAttribuee, valeurContractuelleCourante, valeurSoumise,
  type FaitsMarche, type LigneFaits, zoneDepot, doitRappelerDepot,
} from "./market-math";

/**
 * LES RÈGLES DU MARCHÉ, prouvées à sec.
 *
 * Ce module est le SEUL endroit qui calcule les montants et le niveau d'un marché ; l'écran,
 * l'export et Adam le consomment. Chaque règle ci-dessous correspond à une situation réelle
 * qui, mal calculée, met un mauvais chiffre sous les yeux de la direction — d'où des cas
 * nommés par la situation, pas par la fonction.
 */

const ligne = (partial: Partial<LigneFaits>): LigneFaits => ({
  quantityUnits: 1000,
  submittedQuantityUnits: null,
  awardedQuantityUnits: null,
  unitPriceDzd: null,
  awardedUnitPriceDzd: null,
  status: "PENDING",
  ...partial,
});

describe("soumission & attribution — les quantités et leurs replis", () => {
  it("la quantité soumise retombe sur la demandée quand rien n'est posé", () => {
    expect(uniteSoumises(ligne({}))).toBe(1000);
    expect(uniteSoumises(ligne({ submittedQuantityUnits: 600 }))).toBe(600);
  });

  it("l'attribution PARTIELLE : 8 000 soumises, 4 000 gagnées — le cas Nivolumab de la mission", () => {
    const l = ligne({ quantityUnits: 8000, status: "WON", awardedQuantityUnits: 4000, unitPriceDzd: 50 });
    expect(unitesAttribuees(l)).toBe(4000);
    expect(attributionPartielle(l)).toBe(true);
    expect(valeurSoumise(l)).toBe(400_000);
    expect(valeurAttribuee(l)).toBe(200_000);
  });

  it("un lot gagné SANS quantité saisie vaut sa quantité soumise — l'attribution totale est le cas courant", () => {
    const l = ligne({ status: "WON", submittedQuantityUnits: 900 });
    expect(unitesAttribuees(l)).toBe(900);
    expect(attributionPartielle(l)).toBe(false);
  });

  it("un lot perdu, infructueux ou annulé n'apporte RIEN, même si ses colonnes portent encore des chiffres", () => {
    for (const status of ["LOST", "UNSUCCESSFUL", "CANCELLED"]) {
      const l = ligne({ status, awardedQuantityUnits: 500, awardedUnitPriceDzd: 100 });
      expect(unitesAttribuees(l)).toBe(0);
      expect(valeurAttribuee(l)).toBe(0);
    }
  });

  it("le prix d'attribution prime, le prix soumis est le repli", () => {
    const avecPrixFinal = ligne({ status: "WON", unitPriceDzd: 100, awardedUnitPriceDzd: 90 });
    expect(valeurAttribuee(avecPrixFinal)).toBe(90_000);
    const sansPrixFinal = ligne({ status: "WON", unitPriceDzd: 100 });
    expect(valeurAttribuee(sansPrixFinal)).toBe(100_000);
  });
});

describe("contrat — l'initial ne s'écrase jamais, le courant se calcule", () => {
  const passe = new Date("2026-01-01");
  const futur = new Date("2099-01-01");

  it("500 M initial + avenant 1 (+50 M) + avenant 2 (+100 M) = 650 M — l'exemple de la mission", () => {
    const v = valeurContractuelleCourante(500, [
      { amountDelta: 50, effectiveAt: passe, status: "ACTIVE" },
      { amountDelta: 100, effectiveAt: passe, status: "ACTIVE" },
    ]);
    expect(v).toBe(650);
  });

  it("un avenant SIGNÉ mais pas encore EFFECTIF ne compte pas ; un annulé non plus", () => {
    const v = valeurContractuelleCourante(500, [
      { amountDelta: 50, effectiveAt: futur, status: "ACTIVE" }, // prise d'effet à venir
      { amountDelta: 100, effectiveAt: null, status: "ACTIVE" }, // jamais mis en vigueur
      { amountDelta: 75, effectiveAt: passe, status: "CANCELLED" },
    ]);
    expect(v).toBe(500);
  });

  it("un avenant NÉGATIF réduit la valeur — et sans montant initial, pas de valeur inventée", () => {
    expect(valeurContractuelleCourante(500, [{ amountDelta: -80, effectiveAt: passe, status: "ACTIVE" }])).toBe(420);
    expect(valeurContractuelleCourante(null, [])).toBeNull();
  });

  it("les quantités : 5 000 au contrat + 2 000 d'avenant = 7 000, et les deux écritures restent lisibles", () => {
    const q = quantitesContractuelles([
      { produitCle: "pembro", quantityUnits: 5000, unitPriceDzd: 10, effective: true },
      { produitCle: "pembro", quantityUnits: 2000, unitPriceDzd: 10, effective: true }, // avenant
      { produitCle: "nivo", quantityUnits: 4000, unitPriceDzd: 20, effective: true },
      { produitCle: "nivo", quantityUnits: 1000, unitPriceDzd: 20, effective: false }, // avenant non effectif
    ]);
    expect(q.get("pembro")).toBe(7000);
    expect(q.get("nivo")).toBe(4000);
  });

  it("une réduction qui dépasse le contrat plafonne à zéro — une erreur de saisie n'est pas une dette", () => {
    const q = quantitesContractuelles([
      { produitCle: "p", quantityUnits: 1000, unitPriceDzd: null, effective: true },
      { produitCle: "p", quantityUnits: -1500, unitPriceDzd: null, effective: true },
    ]);
    expect(q.get("p")).toBe(0);
  });
});

describe("exécution — le contrôle du dépassement avertit, il ne re-formule pas ailleurs", () => {
  it("une commande qui tient dans le restant passe sans message", () => {
    const c = controlerCommande(7000, 3500, 2000);
    expect(c).toEqual({ ok: true, excesUnites: 0, restantAvant: 3500, message: null });
  });

  it("le dépassement est chiffré et dit en français prêt à afficher", () => {
    const c = controlerCommande(7000, 6500, 1000);
    expect(c.ok).toBe(false);
    expect(c.excesUnites).toBe(500);
    expect(c.message).toContain("excès 500");
  });

  it("les restants ne deviennent jamais négatifs", () => {
    expect(restantACommander(5000, 6000)).toBe(0);
    expect(restantALivrer(1000, 1200)).toBe(0);
  });
});

describe("le niveau du marché se DÉDUIT — les états décidés gagnent toujours", () => {
  const faits = (partial: Partial<FaitsMarche>): FaitsMarche => ({
    status: "IN_PROGRESS",
    submittedAt: null,
    awardDate: null,
    lignes: [],
    aContratActif: false,
    aBonDeCommande: false,
    ...partial,
  });

  it("annulé / suspendu / perdu / terminé : la décision humaine prime sur tous les faits", () => {
    const enPleineExecution = { aContratActif: true, aBonDeCommande: true, lignes: [{ status: "WON", unitPriceDzd: 5 }] };
    expect(deriverNiveau(faits({ ...enPleineExecution, status: "CANCELLED" })).niveau).toBe("ANNULE");
    expect(deriverNiveau(faits({ ...enPleineExecution, status: "SUSPENDED" })).niveau).toBe("SUSPENDU");
    expect(deriverNiveau(faits({ ...enPleineExecution, status: "LOST" })).niveau).toBe("PERDU");
    expect(deriverNiveau(faits({ ...enPleineExecution, status: "COMPLETED" })).niveau).toBe("CLOTURE");
  });

  it("la vie nominale : brouillon → préparation → soumis → contractualisation → exécution", () => {
    expect(deriverNiveau(faits({})).niveau).toBe("BROUILLON");
    expect(deriverNiveau(faits({ lignes: [{ status: "QUOTED", unitPriceDzd: 12 }] })).niveau).toBe("PREPARATION");
    expect(deriverNiveau(faits({ submittedAt: new Date(), lignes: [{ status: "SUBMITTED", unitPriceDzd: 12 }] })).niveau).toBe("SOUMIS");
    expect(deriverNiveau(faits({ lignes: [{ status: "WON", unitPriceDzd: 12 }] })).niveau).toBe("CONTRACTUALISATION");
    expect(deriverNiveau(faits({ lignes: [{ status: "WON", unitPriceDzd: 12 }], aContratActif: true })).niveau).toBe("EXECUTION");
    expect(deriverNiveau(faits({ lignes: [{ status: "WON", unitPriceDzd: 12 }], aBonDeCommande: true })).niveau).toBe("EXECUTION");
  });

  it("tous les lots décidés sans victoire = PERDU, déduit — sans attendre qu'on coche un statut global", () => {
    const n = deriverNiveau(faits({
      submittedAt: new Date(),
      lignes: [{ status: "LOST", unitPriceDzd: 8 }, { status: "UNSUCCESSFUL", unitPriceDzd: 9 }],
    }));
    expect(n.niveau).toBe("PERDU");
    expect(n.raison).toContain("aucun gagné");
  });

  it("résultats partiels sans lot gagné : encore SOUMIS — on ne déclare pas perdu ce qui n'est pas décidé", () => {
    const n = deriverNiveau(faits({
      submittedAt: new Date(), awardDate: new Date(),
      lignes: [{ status: "LOST", unitPriceDzd: 8 }, { status: "SUBMITTED", unitPriceDzd: 9 }],
    }));
    expect(n.niveau).toBe("SOUMIS");
  });

  it("la barre de progression pointe l'étape à FAIRE, et sort du chemin pour les états décidés", () => {
    expect(ETAPES_MARCHE).toHaveLength(6);
    expect(etapeCourante("PREPARATION")).toBe(0);
    expect(etapeCourante("SOUMIS")).toBe(1);
    expect(etapeCourante("CONTRACTUALISATION")).toBe(3);
    expect(etapeCourante("EXECUTION")).toBe(4);
    expect(etapeCourante("CLOTURE")).toBe(5);
    expect(etapeCourante("ANNULE")).toBe(-1);
    expect(etapeCourante("PERDU")).toBe(-1);
  });
});

describe("échéance de dépôt — zones et rappels (§53 : prévenir à l'entrée d'une zone, jamais tous les jours)", () => {
  const j = (n: number) => new Date(Date.UTC(2026, 8, 10 + n));
  const deadline = j(0);

  it("zone : J-10 → rien, J-6 → PROCHE, J-1 → URGENTE, J+1 → DEPASSEE", () => {
    expect(zoneDepot(deadline, j(-10))).toBeNull();
    expect(zoneDepot(deadline, j(-6))).toBe("PROCHE");
    expect(zoneDepot(deadline, j(-1))).toBe("URGENTE");
    expect(zoneDepot(deadline, j(1))).toBe("DEPASSEE");
  });

  it("premier passage en zone → rappel ; repasser le lendemain dans la MÊME zone → silence", () => {
    expect(doitRappelerDepot(deadline, null, j(-6))).toBe("PROCHE");
    // Rappelé à J-6 : à J-5 la zone n'a pas changé, on se tait.
    expect(doitRappelerDepot(deadline, j(-6), j(-5))).toBeNull();
  });

  it("l'escalade rouvre la parole : PROCHE → URGENTE → DEPASSEE, trois rappels au plus", () => {
    expect(doitRappelerDepot(deadline, j(-6), j(-2))).toBe("URGENTE");
    expect(doitRappelerDepot(deadline, j(-2), j(-1))).toBeNull();
    expect(doitRappelerDepot(deadline, j(-1), j(1))).toBe("DEPASSEE");
    expect(doitRappelerDepot(deadline, j(1), j(30))).toBeNull();
  });

  it("hors zone (échéance à plus de 7 jours) → jamais de rappel, même sans rappel précédent", () => {
    expect(doitRappelerDepot(deadline, null, j(-30))).toBeNull();
  });
});
