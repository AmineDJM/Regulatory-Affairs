import { describe, expect, it } from "vitest";
import { lienStockPromo } from "@/lib/chemins/stock-promo";
import {
  alertesDuStock, cleDansLePerimetre, comptageEnRetard, comptagesSeRecouvrent, echeanceDuComptage, estDormant,
  lireDelaiJours, lireSaisieComptage, messageDAlertes, occurrenceComptage, partitionComptage, peutAnnulerComptage,
  peutDeciderRefonte, peutDemanderAEquipe, peutDemanderComptage, peutDemanderDesComptages, peutGererRecurrence,
  peutProposerRefonte, peutSaisirComptage, peutVoirComptage, peutVoirTableauDeBord, prochaineEcheanceComptage,
  resumeEcarts, valeurDuStock, POUR_LE_MAGASIN, type EntreeAlertes,
} from "./comptages";
import type { FaitsStock } from "./stock-acces";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMPTAGES, ALERTES, TABLEAU DE BORD, REFONTES — la règle pure (§118.168).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const faits = (p: Partial<FaitsStock> = {}): FaitsStock => ({
  userId: "moi",
  superAdmin: false,
  module: { voir: true, creer: true, modifier: true },
  vueGlobale: false,
  gereLeMagasin: false,
  directeurDesOperations: false,
  equipe: new Set<string>(),
  ...p,
});

const ops = faits({ directeurDesOperations: true, vueGlobale: true, equipe: new Set(["k1", "k2"]) });

describe("qui demande un comptage", () => {
  it("le directeur des opérations : les personnes de SES équipes, et le magasin s'il a la vue globale", () => {
    expect(peutDemanderComptage(ops, "k1")).toBe(true);
    expect(peutDemanderComptage(ops, "k9"), "hors de son équipe").toBe(false);
    expect(peutDemanderComptage(ops, null)).toBe(true);
    expect(peutDemanderComptage({ ...ops, vueGlobale: false }, null), "sans vue globale, il ne voit pas le magasin").toBe(false);
  });

  it("un superviseur VOIT le stock de ses KAM, il ne le fait pas compter ; ni sans le droit d'écrire", () => {
    const sup = faits({ equipe: new Set(["k1"]) });
    expect(peutDemanderComptage(sup, "k1")).toBe(false);
    expect(peutDemanderComptage({ ...ops, module: { voir: true, creer: true, modifier: false } }, "k1")).toBe(false);
  });

  it("le Super Admin : tout le monde", () => {
    const sa = faits({ superAdmin: true });
    expect(peutDemanderComptage(sa, "n'importe qui")).toBe(true);
    expect(peutDemanderComptage(sa, null)).toBe(true);
    expect(peutDemanderDesComptages(sa)).toBe(true);
  });

  it("« toute mon équipe » exige d'en avoir une", () => {
    expect(peutDemanderAEquipe(ops)).toBe(true);
    expect(peutDemanderAEquipe({ ...ops, equipe: new Set() })).toBe(false);
    expect(peutDemanderDesComptages({ ...ops, equipe: new Set(), vueGlobale: false }), "personne à qui demander").toBe(false);
  });
});

describe("qui saisit un comptage — c'est une attestation", () => {
  it("celui qui détient le matériel, et lui seul — pas même le Super Admin, pas le demandeur", () => {
    expect(peutSaisirComptage(faits({ userId: "k1" }), "k1")).toBe(true);
    expect(peutSaisirComptage(faits({ userId: "k2" }), "k1")).toBe(false);
    expect(peutSaisirComptage(faits({ superAdmin: true }), "k1")).toBe(false);
    expect(peutSaisirComptage({ ...ops, userId: "ops" }, "k1")).toBe(false);
  });

  it("le magasin : qui le tient (sa gestionnaire avec l'écriture, ou le Super Admin)", () => {
    expect(peutSaisirComptage(faits({ gereLeMagasin: true }), null)).toBe(true);
    expect(peutSaisirComptage(faits({ gereLeMagasin: true, module: { voir: true, creer: false, modifier: false } }), null)).toBe(false);
    expect(peutSaisirComptage(faits({ superAdmin: true }), null)).toBe(true);
    expect(peutSaisirComptage(faits({ userId: "k1" }), null)).toBe(false);
  });
});

describe("annuler, gérer une récurrence, voir", () => {
  it("annuler : le demandeur ou le Super Admin", () => {
    expect(peutAnnulerComptage(faits({ userId: "ops" }), "ops")).toBe(true);
    expect(peutAnnulerComptage(faits({ userId: "k1" }), "ops")).toBe(false);
    expect(peutAnnulerComptage(faits({ superAdmin: true }), "ops")).toBe(true);
  });

  it("une récurrence : son auteur (avec l'écriture) ou le Super Admin ; sans auteur, le Super Admin seul", () => {
    expect(peutGererRecurrence(faits({ userId: "ops" }), "ops")).toBe(true);
    expect(peutGererRecurrence(faits({ userId: "ops", module: { voir: true, creer: true, modifier: false } }), "ops")).toBe(false);
    expect(peutGererRecurrence(faits({ userId: "k1" }), "ops")).toBe(false);
    expect(peutGererRecurrence(faits({ userId: "ops" }), null)).toBe(false);
    expect(peutGererRecurrence(faits({ superAdmin: true }), null)).toBe(true);
  });

  it("voir un comptage : la même règle que voir le stock de son détenteur, ou l'avoir demandé", () => {
    const k1 = faits({ userId: "k1" });
    expect(peutVoirComptage(k1, { holderId: "k1", demandeurId: "ops" })).toBe(true);
    expect(peutVoirComptage(k1, { holderId: "k2", demandeurId: "ops" }), "le stock d'un collègue").toBe(false);
    expect(peutVoirComptage(faits({ userId: "ops" }), { holderId: "k9", demandeurId: "ops" }), "il l'a demandé").toBe(true);
  });

  it("le tableau de bord : Super Admin, vue globale, gestionnaire du magasin — pas un délégué", () => {
    expect(peutVoirTableauDeBord(faits({ superAdmin: true }))).toBe(true);
    expect(peutVoirTableauDeBord(faits({ vueGlobale: true }))).toBe(true);
    expect(peutVoirTableauDeBord(faits({ gereLeMagasin: true }))).toBe(true);
    expect(peutVoirTableauDeBord(faits())).toBe(false);
  });

  it("une refonte se propose sur un DURABLE, et se décide par le magasin", () => {
    expect(peutProposerRefonte(faits(), "DURABLE")).toBe(true);
    expect(peutProposerRefonte(faits(), "CONSOMMABLE")).toBe(false);
    expect(peutProposerRefonte(faits({ module: { voir: false, creer: false, modifier: false } }), "DURABLE")).toBe(false);
    expect(peutDeciderRefonte(faits({ gereLeMagasin: true }))).toBe(true);
    expect(peutDeciderRefonte(faits({ gereLeMagasin: true, module: { voir: true, creer: false, modifier: false } }))).toBe(false);
    expect(peutDeciderRefonte(faits({ userId: "k1" }))).toBe(false);
  });
});

describe("les échéances — depuis l'ancre, sans dérive, sans rattrapage", () => {
  const ancre = new Date("2027-01-31T07:00:00.000Z");

  it("un mensuel du 31 janvier : 28 février, puis 31 mars — jamais le 28 pour toujours", () => {
    expect(occurrenceComptage(ancre, "MENSUEL", 1).toISOString()).toBe("2027-02-28T07:00:00.000Z");
    expect(occurrenceComptage(ancre, "MENSUEL", 2).toISOString()).toBe("2027-03-31T07:00:00.000Z");
    expect(occurrenceComptage(new Date("2028-01-31T07:00:00.000Z"), "MENSUEL", 1).toISOString(), "année bissextile").toBe("2028-02-29T07:00:00.000Z");
  });

  it("trimestriel, semestriel, hebdomadaire", () => {
    expect(occurrenceComptage(ancre, "TRIMESTRIEL", 1).toISOString()).toBe("2027-04-30T07:00:00.000Z");
    expect(occurrenceComptage(ancre, "SEMESTRIEL", 2).toISOString()).toBe("2028-01-31T07:00:00.000Z");
    expect(occurrenceComptage(ancre, "HEBDOMADAIRE", 2).toISOString()).toBe("2027-02-14T07:00:00.000Z");
  });

  it("STRICTEMENT après : à l'instant même d'une occurrence, c'est la suivante", () => {
    expect(prochaineEcheanceComptage(ancre, "MENSUEL", ancre).toISOString()).toBe("2027-02-28T07:00:00.000Z");
    expect(prochaineEcheanceComptage(ancre, "HEBDOMADAIRE", new Date("2027-02-07T07:00:00.000Z")).toISOString()).toBe("2027-02-14T07:00:00.000Z");
  });

  it("l'ancre à venir est la prochaine échéance", () => {
    expect(prochaineEcheanceComptage(ancre, "MENSUEL", new Date("2027-01-01T00:00:00Z")).getTime()).toBe(ancre.getTime());
  });

  it("PAS DE RATTRAPAGE : après huit mois d'arrêt, la prochaine date À VENIR — pas huit comptages", () => {
    const r = prochaineEcheanceComptage(ancre, "MENSUEL", new Date("2027-10-02T12:00:00Z"));
    expect(r.toISOString()).toBe("2027-10-31T07:00:00.000Z");
    for (const f of ["HEBDOMADAIRE", "MENSUEL", "TRIMESTRIEL", "SEMESTRIEL"] as const) {
      const apres = new Date("2031-06-15T10:00:00Z");
      const p = prochaineEcheanceComptage(ancre, f, apres);
      expect(p.getTime(), f).toBeGreaterThan(apres.getTime());
      // C'est bien la PREMIÈRE après : l'occurrence d'avant ne l'est pas.
      const k = Array.from({ length: 2000 }, (_, i) => i).find((i) => occurrenceComptage(ancre, f, i).getTime() === p.getTime())!;
      expect(occurrenceComptage(ancre, f, k - 1).getTime(), f).toBeLessThanOrEqual(apres.getTime());
    }
  });

  it("l'échéance d'un comptage : minuit UTC, le jour inclus ; le délai est borné", () => {
    expect(echeanceDuComptage(new Date("2027-03-10T07:00:00Z"), 7).toISOString()).toBe("2027-03-17T00:00:00.000Z");
    expect(echeanceDuComptage(new Date("2027-03-10T07:00:00Z"), 0).toISOString(), "au moins un jour").toBe("2027-03-11T00:00:00.000Z");
    const e = new Date("2027-03-17T00:00:00Z");
    expect(comptageEnRetard(e, new Date("2027-03-17T23:59:00Z")), "le jour même n'est pas un retard").toBe(false);
    expect(comptageEnRetard(e, new Date("2027-03-18T00:00:00Z"))).toBe(true);
  });

  it("le délai saisi : 1 à 60 jours entiers", () => {
    expect(lireDelaiJours("7")).toBe(7);
    expect(lireDelaiJours("0")).toBeNull();
    expect(lireDelaiJours("61")).toBeNull();
    expect(lireDelaiJours("2,5")).toBeNull();
    expect(lireDelaiJours("abc")).toBeNull();
  });
});

describe("ce qui doit être compté — une règle pour le formulaire ET l'action", () => {
  const articles = [
    { itemId: "fiche", famille: "CONSOMMABLE", actif: true, solde: 90 },
    { itemId: "archive", famille: "CONSOMMABLE", actif: false, solde: 4 },
    { itemId: "negatif", famille: "CONSOMMABLE", actif: true, solde: -2 },
    { itemId: "bloc", famille: "CONSOMMABLE", actif: true, solde: 0 },
    { itemId: "vieux", famille: "CONSOMMABLE", actif: false, solde: 0 },
    { itemId: "kakemono", famille: "DURABLE", actif: true, solde: 1 },
    { itemId: "eflyer", famille: "NUMERIQUE", actif: true, solde: 0 },
  ];

  it("attendus : tout solde NON NUL — archivé et négatif compris ; ajoutables : actifs à zéro", () => {
    expect(partitionComptage(articles, "CONSOMMABLE")).toEqual({ attendus: ["fiche", "archive", "negatif"], ajoutables: ["bloc"] });
  });

  it("sans famille : consommables et durables, jamais un support numérique", () => {
    const p = partitionComptage(articles, null);
    expect(p.attendus).toEqual(["fiche", "archive", "negatif", "kakemono"]);
    expect(p.ajoutables).toEqual(["bloc"]);
  });

  it("deux comptages ouverts se recouvrent : même détenteur, et une famille qui couvre l'autre", () => {
    expect(comptagesSeRecouvrent({ holderId: "k1", famille: null }, { holderId: "k1", famille: "DURABLE" })).toBe(true);
    expect(comptagesSeRecouvrent({ holderId: "k1", famille: "CONSOMMABLE" }, { holderId: "k1", famille: "CONSOMMABLE" })).toBe(true);
    expect(comptagesSeRecouvrent({ holderId: "k1", famille: "CONSOMMABLE" }, { holderId: "k1", famille: "DURABLE" })).toBe(false);
    expect(comptagesSeRecouvrent({ holderId: "k1", famille: null }, { holderId: "k2", famille: null })).toBe(false);
    expect(comptagesSeRecouvrent({ holderId: null, famille: null }, { holderId: null, famille: "DURABLE" }), "le magasin aussi").toBe(true);
  });
});

describe("lire une saisie de comptage — tout ce qui manque, en une fois", () => {
  const attendus = new Set(["fiche", "stylo"]);
  const connus = new Set(["bloc"]);
  const nom = (id: string) => ({ fiche: "Fiche", stylo: "Stylo", bloc: "Bloc-notes" } as Record<string, string>)[id] ?? id;

  it("« 0 » est une réponse ; un article trouvé à zéro n'apporte rien et s'ignore", () => {
    const r = lireSaisieComptage([{ itemId: "fiche", compte: "85" }, { itemId: "stylo", compte: "0" }, { itemId: "bloc", compte: "0" }], attendus, connus, nom);
    expect(r).toEqual({ ok: true, lignes: [{ itemId: "fiche", compte: 85 }, { itemId: "stylo", compte: 0 }] });
  });

  it("un article du stock sans ligne est refusé EN LE NOMMANT — il garderait son solde en silence", () => {
    const r = lireSaisieComptage([{ itemId: "fiche", compte: "85" }], attendus, connus, nom);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.faute).toMatch(/« Stylo »/);
    expect(r.ok ? "" : r.faute).toMatch(/rechargez la page/);
  });

  it("RIEN n'est pas une réponse pour un article du stock", () => {
    const r = lireSaisieComptage([{ itemId: "fiche", compte: "" }, { itemId: "stylo", compte: "1" }], attendus, connus, nom);
    expect(r.ok ? "" : r.faute).toMatch(/« Fiche » : dites combien/);
  });

  it("négatif, illisible, en double, inconnu : refusés — et tous dits ensemble", () => {
    const r = lireSaisieComptage([
      { itemId: "fiche", compte: "-3" }, { itemId: "stylo", compte: "abc" }, { itemId: "stylo", compte: "2" }, { itemId: "intrus", compte: "1" },
    ], attendus, connus, nom);
    const faute = r.ok ? "" : r.faute;
    expect(faute).toMatch(/« Fiche » : quantité illisible/);
    expect(faute).toMatch(/« Stylo » : quantité illisible/);
    expect(faute).toMatch(/apparaît deux fois/);
    expect(faute).toMatch(/« intrus » n'est pas un article qu'on peut compter ici/);
  });

  it("les quantités françaises se lisent (« 1 200,5 »)", () => {
    const r = lireSaisieComptage([{ itemId: "fiche", compte: "1 200,5" }, { itemId: "stylo", compte: "3" }], attendus, connus, nom);
    expect(r.ok && r.lignes[0]!.compte).toBe(1200.5);
  });

  it("le résumé dit les écarts, et se tait poliment quand il n'y en a pas", () => {
    expect(resumeEcarts([{ libelle: "Fiche", ecart: 0 }])).toMatch(/aucun écart/);
    expect(resumeEcarts([{ libelle: "Fiche", ecart: -5 }, { libelle: "Bloc", ecart: 3 }])).toMatch(/2 écart\(s\).*« Fiche » −5, « Bloc » \+3/);
  });
});

describe("les alertes — une seule règle pour le battement et le tableau de bord", () => {
  const maintenant = new Date("2027-03-01T10:00:00Z");
  const base = (p: Partial<EntreeAlertes> = {}): EntreeAlertes => ({
    articles: [], lotsDates: [], supports: [], transferts: [], comptages: [],
    nomDe: (id) => (id === null ? "le magasin" : id === "k1" ? "Karim" : id), ...p,
  });

  it("RUPTURE (seuil ou non) et SEUIL (seulement s'il y en a un) ; un article archivé se tait", () => {
    const a = alertesDuStock(base({
      articles: [
        { itemId: "a", libelle: "Stylo", seuil: 50, auMagasin: 40, actif: true },
        { itemId: "b", libelle: "Bloc", seuil: null, auMagasin: 0, actif: true },
        { itemId: "c", libelle: "Fiche", seuil: null, auMagasin: 3, actif: true },
        { itemId: "d", libelle: "Vieux", seuil: 10, auMagasin: 0, actif: false },
        { itemId: "e", libelle: "Plein", seuil: 50, auMagasin: 51, actif: true },
      ],
    }), maintenant);
    expect(a.map((x) => x.cle).sort()).toEqual(["rupture:b", "seuil:a"]);
    expect(a.find((x) => x.cle === "seuil:a")!.pour).toEqual([POUR_LE_MAGASIN]);
  });

  it("PÉREMPTION : à 30 jours oui, à 31 non ; PÉRIMÉ encore en main ; chez une personne, c'est elle qui est prévenue", () => {
    const lot = (lotId: string, fin: string, holderId: string | null) =>
      ({ itemId: "f", lotId, numero: 1, libelle: "Fiche", holderId, quantite: 20, valableJusquau: new Date(fin) });
    const a = alertesDuStock(base({
      lotsDates: [lot("l30", "2027-03-30T00:00:00Z", null), lot("l31", "2027-03-31T00:00:00Z", null), lot("lp", "2027-02-27T00:00:00Z", "k1")],
    }), maintenant);
    expect(a.map((x) => x.cle).sort()).toEqual(["peremption:f:l30:magasin", "perime:f:lp:k1"]);
    const perime = a.find((x) => x.genre === "PERIME")!;
    expect(perime.pour).toEqual(["k1"]);
    expect(perime.texte).toMatch(/chez Karim/);
    expect(perime.texte).toMatch(/déclarez-les détruits/);
  });

  it("un lot vide n'alerte jamais", () => {
    expect(alertesDuStock(base({
      lotsDates: [{ itemId: "f", lotId: "l", numero: 1, libelle: "Fiche", holderId: null, quantite: 0, valableJusquau: new Date("2027-03-05T00:00:00Z") }],
    }), maintenant)).toEqual([]);
  });

  it("EN ROUTE : à partir du septième jour ; vers ou depuis le magasin, le magasin est prévenu aussi", () => {
    const t = (id: string, jours: number, deId: string | null, versId: string | null) =>
      ({ id, itemId: "f", libelle: "Fiche", deId, versId, initiateurId: "dm", quantite: 10, createdAt: new Date(maintenant.getTime() - jours * 86_400_000) });
    const a = alertesDuStock(base({ transferts: [t("t6", 6, null, "k1"), t("t7", 7, null, "k1"), t("tp", 9, "k1", "k2")] }), maintenant);
    expect(a.map((x) => x.cle).sort()).toEqual(["enroute:f:t7", "enroute:f:tp"]);
    expect(a.find((x) => x.cle === "enroute:f:t7")!.pour.sort()).toEqual(["dm", POUR_LE_MAGASIN].sort());
    expect(a.find((x) => x.cle === "enroute:f:tp")!.pour).toEqual(["dm"]);
  });

  it("COMPTAGE en retard : le détenteur ET le demandeur ; le magasin se dit « au magasin »", () => {
    const c = (id: string, holderId: string | null, echeance: string) =>
      ({ id, holderId, demandeurId: "ops", famille: null, echeance: new Date(echeance), createdAt: new Date("2027-02-20T08:00:00Z") });
    const a = alertesDuStock(base({ comptages: [c("c1", "k1", "2027-02-28T00:00:00Z"), c("c2", null, "2027-02-27T00:00:00Z"), c("c3", "k1", "2027-03-01T00:00:00Z")] }), maintenant);
    expect(a.map((x) => x.cle).sort()).toEqual(["comptage:c1", "comptage:c2"]);
    expect(a.find((x) => x.cle === "comptage:c1")!.pour.sort()).toEqual(["k1", "ops"]);
    expect(a.find((x) => x.cle === "comptage:c2")!.texte).toMatch(/demandé au magasin/);
  });

  it("SUPPORT numérique : bientôt, ou expiré et toujours actif", () => {
    const a = alertesDuStock(base({
      supports: [
        { itemId: "s1", libelle: "E-flyer", valableJusquau: new Date("2027-03-10T00:00:00Z"), actif: true },
        { itemId: "s2", libelle: "Vidéo", valableJusquau: new Date("2027-01-10T00:00:00Z"), actif: true },
        { itemId: "s3", libelle: "Archivé", valableJusquau: new Date("2027-01-10T00:00:00Z"), actif: false },
        { itemId: "s4", libelle: "Sans date", valableJusquau: null, actif: true },
      ],
    }), maintenant);
    expect(a.map((x) => x.cle).sort()).toEqual(["support:s1:BIENTOT", "support:s2:PERIME"]);
  });

  it("une clé porte son article (ou son comptage) en second — c'est ce qui borne une passe", () => {
    const p = { itemIds: new Set(["f"]), comptageIds: new Set(["c1"]) };
    expect(cleDansLePerimetre("seuil:f", p)).toBe(true);
    expect(cleDansLePerimetre("peremption:f:l:magasin", p)).toBe(true);
    expect(cleDansLePerimetre("seuil:autre", p)).toBe(false);
    expect(cleDansLePerimetre("comptage:c1", p)).toBe(true);
    expect(cleDansLePerimetre("comptage:f", p), "un comptage ne s'identifie pas par un article").toBe(false);
    expect(cleDansLePerimetre("__passage__", p)).toBe(false);
  });

  it("UNE notification par personne : une alerte garde son texte ; plusieurs font un résumé qui compte le reste", () => {
    const al = (i: number, lien = "/l") => ({ cle: `k${i}`, genre: "SEUIL" as const, texte: `t${i}`, lien, pour: ["x"], detenteur: null });
    expect(messageDAlertes([])).toBeNull();
    expect(messageDAlertes([al(1)])).toEqual({ titre: "Stock promotionnel — Sous le seuil", corps: "t1", lien: "/l" });
    const m = messageDAlertes([1, 2, 3, 4, 5, 6, 7].map((i) => al(i)))!;
    expect(m.titre).toBe("Stock promotionnel — 7 alertes");
    expect(m.corps).toMatch(/t5/);
    expect(m.corps).not.toMatch(/t6/);
    expect(m.corps).toMatch(/et 2 autre\(s\)/);
    expect(m.lien).toBe("/l");
    expect(messageDAlertes([al(1, "/a"), al(2, "/b")])!.lien, "des liens différents : le tableau de bord").toBe(lienStockPromo("tableau"));
  });
});

describe("le tableau de bord — valeur et dormants", () => {
  it("la valeur ne compte pas les unités sans coût à zéro : elle les compte À PART", () => {
    expect(valeurDuStock([
      { quantite: 10, coutUnitaire: 150 }, { quantite: 5, coutUnitaire: null }, { quantite: -3, coutUnitaire: 150 }, { quantite: 2, coutUnitaire: 0 },
    ])).toEqual({ valeur: 1500, unitesValorisees: 12, unitesSansCout: 5 });
  });

  it("dormant : du stock, une entrée ancienne, aucune sortie sur 90 jours — un arrivage neuf ne l'est jamais", () => {
    const maintenant = new Date("2027-06-01T00:00:00Z");
    const il = (j: number) => new Date(maintenant.getTime() - j * 86_400_000);
    expect(estDormant({ quantite: 10, premiereEntree: il(200), derniereSortie: null }, maintenant)).toBe(true);
    expect(estDormant({ quantite: 10, premiereEntree: il(200), derniereSortie: il(91) }, maintenant)).toBe(true);
    expect(estDormant({ quantite: 10, premiereEntree: il(200), derniereSortie: il(30) }, maintenant)).toBe(false);
    expect(estDormant({ quantite: 10, premiereEntree: il(10), derniereSortie: null }, maintenant), "arrivage récent").toBe(false);
    expect(estDormant({ quantite: 0, premiereEntree: il(200), derniereSortie: null }, maintenant), "rien en main").toBe(false);
  });
});
