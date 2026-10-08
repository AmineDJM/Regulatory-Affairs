import { describe, expect, it } from "vitest";
import { BRIQUES, BRIQUE_IDS, BRIQUE_PAR_ID } from "./briques";
import { lignesApplicables, lireLignesDeRevue, phraseCalcul, validerDefinition, type LigneDeRevue } from "./definition";
import {
  afficherValeur, cibleSurFenetre, clePeriode, couleur, fenetre, fenetresPrecedentes, normaliser, proposerCible, scoreGlobal, seuilsEffectifs,
} from "./score";
import {
  ciblesAFrequence, ciblesVuesN, contacts, delaisDeReponse, mediane, noteCoaching, plansATemps, rapportsDansDelai, tachesATemps,
} from "./mesures";
import {
  lireReponseDefinitions, lireReponseEvaluation, messagePropositionKpi, propositionsDeSecours, resumeProposition, MODULE_FEEDBACK_KPI,
} from "./luna-pur";
import { peutCreerPourEquipe, peutDeclarer, peutGererPersonne, peutModifierDefinition, peutVoirBilan, type FaitsKpi } from "./droits";

const H = 3_600_000;

describe("briques — le catalogue", () => {
  it("chaque brique est unique, définie, et sa source est dite", () => {
    expect(new Set(BRIQUES.map((b) => b.id)).size).toBe(BRIQUES.length);
    expect(BRIQUES.map((b) => b.id).sort()).toEqual([...BRIQUE_IDS].sort());
    for (const b of BRIQUES) {
      expect(b.definition.length, b.id).toBeGreaterThan(30);
      expect(b.source.length, b.id).toBeGreaterThan(5);
      expect(b.dimensions).toContain("personne");
      expect(b.dimensions).toContain("periode");
    }
  });
  it("un délai est en heures, une note en pourcentage, le reste en nombre", () => {
    expect(BRIQUE_PAR_ID.DELAI_VALIDATIONS.unite).toBe("HEURES");
    expect(BRIQUE_PAR_ID.NOTE_COACHING.unite).toBe("POURCENT");
    expect(BRIQUE_PAR_ID.VISITES_REALISEES.unite).toBe("NOMBRE");
  });
});

describe("normalisation — une note sur 100, plafonnée à 120", () => {
  it("plus haut = mieux : % de la cible, plafonné à 120", () => {
    expect(normaliser({ valeur: 60, cible: 80, sens: "PLUS_HAUT", nature: "RATIO" })).toBe(75);
    expect(normaliser({ valeur: 200, cible: 80, sens: "PLUS_HAUT", nature: "RATIO" })).toBe(120);
    expect(normaliser({ valeur: 0, cible: 80, sens: "PLUS_HAUT", nature: "RATIO" })).toBe(0);
  });
  it("plus bas = mieux : l'inverse (un délai deux fois trop long → 50)", () => {
    expect(normaliser({ valeur: 48, cible: 24, sens: "PLUS_BAS", nature: "CALCULE" })).toBe(50);
    expect(normaliser({ valeur: 12, cible: 24, sens: "PLUS_BAS", nature: "CALCULE" })).toBe(120);
    expect(normaliser({ valeur: 0, cible: 24, sens: "PLUS_BAS", nature: "CALCULE" })).toBe(120);
  });
  it("évalué : niveau ÷ niveau maximal", () => {
    expect(normaliser({ valeur: 3, cible: 3, sens: "PLUS_HAUT", nature: "EVALUE", niveauMax: 4 })).toBe(75);
  });
  it("sans valeur ou sans cible : pas de note (jamais un zéro)", () => {
    expect(normaliser({ valeur: null, cible: 80, sens: "PLUS_HAUT", nature: "RATIO" })).toBeNull();
    expect(normaliser({ valeur: 50, cible: null, sens: "PLUS_HAUT", nature: "RATIO" })).toBeNull();
  });
});

describe("score global pondéré — les données manquantes sortent du calcul", () => {
  it("renormalise les poids sur les KPI qui ont une note", () => {
    const s = scoreGlobal([{ note: 100, poids: 30 }, { note: 50, poids: 10 }, { note: null, poids: 60 }]);
    expect(s.score).toBe(88); // (100×30 + 50×10) / 40 = 87,5
    expect(s.sansDonnee).toBe(1);
    expect(s.poidsRetenu).toBe(40);
    expect(s.poidsTotal).toBe(100);
  });
  it("aucune note : pas de score", () => {
    expect(scoreGlobal([{ note: null, poids: 10 }]).score).toBeNull();
    expect(scoreGlobal([]).score).toBeNull();
  });
  it("un poids nul ne pèse pas", () => {
    expect(scoreGlobal([{ note: 40, poids: 0 }, { note: 90, poids: 5 }]).score).toBe(90);
  });
});

describe("seuils et couleurs", () => {
  it("sans seuils : vert à la cible, orange à 80 % (plus haut) ou 125 % (plus bas)", () => {
    expect(seuilsEffectifs({ cible: 80, seuilVert: null, seuilOrange: null, sens: "PLUS_HAUT", nature: "RATIO" })).toEqual({ vert: 80, orange: 64 });
    expect(seuilsEffectifs({ cible: 24, seuilVert: null, seuilOrange: null, sens: "PLUS_BAS", nature: "CALCULE" })).toEqual({ vert: 24, orange: 30 });
    expect(seuilsEffectifs({ cible: null, seuilVert: null, seuilOrange: null, sens: "PLUS_HAUT", nature: "RATIO" })).toBeNull();
  });
  it("la couleur suit le sens", () => {
    const s = { vert: 80, orange: 60 };
    expect(couleur(85, s, "PLUS_HAUT")).toBe("ok");
    expect(couleur(70, s, "PLUS_HAUT")).toBe("w");
    expect(couleur(30, s, "PLUS_HAUT")).toBe("ko");
    expect(couleur(null, s, "PLUS_HAUT")).toBe("m");
    expect(couleur(20, { vert: 24, orange: 30 }, "PLUS_BAS")).toBe("ok");
    expect(couleur(40, { vert: 24, orange: 30 }, "PLUS_BAS")).toBe("ko");
  });
  it("l'affichage dit l'unité", () => {
    expect(afficherValeur(58.4, "POURCENT")).toBe("58 %");
    expect(afficherValeur(3, "NIVEAU", 4)).toBe("3/4");
    expect(afficherValeur(null, "NOMBRE")).toBe("—");
  });
});

describe("périodes et cible sur la fenêtre", () => {
  it("les clés se lisent et se suivent", () => {
    expect(clePeriode("MENSUELLE", 2026, 10)).toBe("2026-10");
    expect(clePeriode("TRIMESTRIELLE", 2026, 10)).toBe("2026-T4");
    expect(clePeriode("SEMESTRIELLE", 2026, 3)).toBe("2026-S1");
    expect(fenetre("2026-T4")!.mois).toBe(3);
    expect(fenetre("2026-13")).toBeNull();
    expect(fenetresPrecedentes("2026-02", 3).map((f) => f.cle)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(fenetresPrecedentes("2026-T1", 2).map((f) => f.cle)).toEqual(["2025-T4", "2026-T1"]);
  });
  it("une cible additive se multiplie avec la fenêtre ; un taux ne bouge pas", () => {
    expect(cibleSurFenetre(20, { unite: "NOMBRE", additive: true, periode: "MOIS" }, 3)).toBe(60);
    expect(cibleSurFenetre(1, { unite: "NOMBRE", additive: true, periode: "TRIMESTRE" }, 1)).toBeCloseTo(0.33, 2);
    expect(cibleSurFenetre(80, { unite: "POURCENT", additive: false, periode: "MOIS" }, 3)).toBe(80);
  });
  it("la cible proposée se place entre la moyenne et le meilleur", () => {
    expect(proposerCible([60, 70, 86], "PLUS_HAUT", "POURCENT")).toEqual({ cible: 80, moyenne: 72, meilleur: 86 });
    expect(proposerCible([null, null], "PLUS_HAUT", "POURCENT")).toBeNull();
    expect(proposerCible([30, 10], "PLUS_BAS", "HEURES")!.cible).toBe(15);
  });
});

describe("définition — la seule porte d'entrée", () => {
  it("refuse une brique inconnue", () => {
    const r = validerDefinition({ nom: "Chiffre inventé", nature: "CALCULE", numerateur: { brique: "CA_PAR_SQL" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/n'existe pas/);
  });
  it("un ratio prend deux briques et devient un pourcentage ; les réglages inconnus de la brique tombent", () => {
    const r = validerDefinition({
      nom: "Décideurs 2×", nature: "RATIO",
      numerateur: { brique: "CIBLES_VUES_N", lettres: ["H", "Z"], seuilN: 2, heures: 48 },
      denominateur: { brique: "CIBLES_PANEL", lettres: ["H"] },
      cible: 80,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.def.unite).toBe("POURCENT");
      expect(r.def.numerateur).toEqual({ brique: "CIBLES_VUES_N", lettres: ["H"], seuilN: 2 });
      expect(phraseCalcul(r.def)).toContain("÷");
    }
  });
  it("un délai se lit « plus bas = mieux » par défaut", () => {
    const r = validerDefinition({ nom: "Délai validations", nature: "CALCULE", numerateur: { brique: "DELAI_VALIDATIONS" } });
    expect(r.ok && r.def.sens).toBe("PLUS_BAS");
  });
  it("un KPI évalué exige une grille complète et une cible dans la grille", () => {
    expect(validerDefinition({ nom: "Qualité", nature: "EVALUE", grille: [{ libelle: "A", critere: "" }, { libelle: "B", critere: "x" }] }).ok).toBe(false);
    expect(validerDefinition({ nom: "Qualité", nature: "EVALUE", cible: 9, grille: [{ libelle: "A", critere: "a" }, { libelle: "B", critere: "b" }] }).ok).toBe(false);
    expect(validerDefinition({ nom: "Qualité", nature: "EVALUE", cible: 2, grille: [{ libelle: "A", critere: "a" }, { libelle: "B", critere: "b" }] }).ok).toBe(true);
  });
  it("un KPI déclaré ne se calcule pas depuis une brique", () => {
    expect(validerDefinition({ nom: "Formations", nature: "DECLARE", numerateur: { brique: "VISITES_REALISEES" } }).ok).toBe(false);
  });
});

describe("versionnement — une revue signée garde sa version", () => {
  const figee: LigneDeRevue = { famille: "f1", definitionId: "v1", version: 1, nom: "Rapports 48 h", nature: "RATIO", unite: "POURCENT", poids: 15, valeur: 95, score: 100, affichage: "95 %", raison: null };
  const actives = [{ famille: "f1", id: "v2", version: 2 }];
  it("signée : les lignes figées (version 1), même si la version 2 est active", () => {
    const r = lignesApplicables({ statut: "SIGNEE", lignes: [figee] }, actives);
    expect(r.figee).toBe(true);
    if (r.figee) expect(r.lignes[0]!.definitionId).toBe("v1");
  });
  it("brouillon ou absente : les versions actives", () => {
    const r = lignesApplicables({ statut: "BROUILLON", lignes: [figee] }, actives);
    expect(r.figee).toBe(false);
    if (!r.figee) expect(r.definitions[0]!.id).toBe("v2");
    expect(lignesApplicables(null, actives).figee).toBe(false);
  });
  it("le détail JSON se relit ; une ligne illisible est écartée", () => {
    expect(lireLignesDeRevue([figee, { nom: 3 }])).toEqual([figee]);
  });
});

describe("mesures — la part pure des briques", () => {
  const panel = [
    { doctorId: "h1", lettre: "H" as const, requis: 2, faites: 2 },
    { doctorId: "h2", lettre: "H" as const, requis: 2, faites: 1 },
    { doctorId: "a1", lettre: "A" as const, requis: 1, faites: 3 },
    { doctorId: "c1", lettre: "C" as const, requis: 0.5, faites: 0 },
    { doctorId: "x", lettre: null, requis: 1, faites: 1 },
  ];
  it("cibles à fréquence (H·A·B par défaut) et contacts plafonnés", () => {
    expect(ciblesAFrequence(panel, 1)).toEqual({ cibles: 3, vues: 2 });
    expect(ciblesAFrequence(panel, 2)).toEqual({ cibles: 3, vues: 1 }); // requis × 2 mois
    expect(contacts(panel, 1, ["H"])).toEqual({ requis: 4, realise: 3 });
  });
  it("décideurs vus au moins N fois par mois", () => {
    expect(ciblesVuesN(panel, 1, 2)).toEqual({ cibles: 2, vues: 1 });
    expect(ciblesVuesN(panel, 1, 1, ["H", "A"])).toEqual({ cibles: 3, vues: 3 });
  });
  it("rapports dans le délai : un rapport encore possible n'est pas un manquement", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const d = (h: number) => new Date(now.getTime() - h * H);
    const r = rapportsDansDelai([
      { date: d(100), statut: "COMPLETED", rapportLe: d(90) },     // 10 h après : dans le délai
      { date: d(100), statut: "COMPLETED", rapportLe: d(40) },     // 60 h après : hors délai
      { date: d(100), statut: "PLANNED", rapportLe: null },        // délai écoulé sans rapport
      { date: d(10), statut: "PLANNED", rapportLe: null },         // encore ouvert : pas compté
      { date: d(100), statut: "CANCELLED", rapportLe: null },      // annulée : pas comptée
    ], 48, now);
    expect(r).toEqual({ aRapporter: 3, dansDelai: 1 });
  });
  it("plans validés à temps, tâches à temps, note de coaching, médiane", () => {
    const due = new Date("2026-10-05T00:00:00Z");
    expect(plansATemps([
      { statut: "APPROVED", submittedAt: new Date("2026-10-04"), submissionDueAt: due },
      { statut: "APPROVED", submittedAt: new Date("2026-10-07"), submissionDueAt: due },
      { statut: "SUBMITTED", submittedAt: new Date("2026-10-01"), submissionDueAt: due },
    ])).toEqual({ plans: 3, aTemps: 1 });
    const now = new Date(2026, 9, 20);
    expect(tachesATemps([
      { dueDate: new Date(2026, 9, 5), completedAt: new Date(2026, 9, 5, 18), statut: "DONE" },
      { dueDate: new Date(2026, 9, 5), completedAt: new Date(2026, 9, 7), statut: "DONE" },
      { dueDate: new Date(2026, 9, 6), completedAt: null, statut: "TODO" },
      { dueDate: new Date(2026, 9, 6), completedAt: null, statut: "CANCELLED" },
      { dueDate: new Date(2026, 9, 25), completedAt: null, statut: "TODO" },
    ], now)).toEqual({ echues: 3, aTemps: 1 });
    expect(noteCoaching([{ total: 15, max: 20 }, { total: 18, max: 20 }])).toBe(82.5);
    expect(noteCoaching([])).toBeNull();
    expect(mediane([5, 1, 3])).toBe(3);
    expect(mediane([])).toBeNull();
    expect(delaisDeReponse([
      { creeLe: new Date(0), decideLe: new Date(2 * H), arriveeConnue: true },
      { creeLe: new Date(0), decideLe: new Date(9 * H), arriveeConnue: false },
    ])).toEqual([2]);
  });
});

describe("Luna — relecture stricte de ce qu'elle rend", () => {
  it("rejette une proposition qui invente une brique, garde les autres", () => {
    const r = lireReponseDefinitions({
      message: "Deux KPI.",
      propositions: [
        { nom: "Rapports 48 h", nature: "RATIO", numerateur: { brique: "RAPPORTS_DANS_DELAI", heures: 48 }, denominateur: { brique: "VISITES_A_RAPPORTER", heures: 48 }, sens: "PLUS_HAUT", cible: 95, periode: "MOIS", grille: null, explication: "x" },
        { nom: "Part de marché", nature: "CALCULE", numerateur: { brique: "PART_DE_MARCHE" }, denominateur: null, sens: "PLUS_HAUT", cible: null, periode: "MOIS", grille: null, explication: "y" },
      ],
      horsBriques: null,
    });
    expect(r!.propositions.map((p) => p.def.nom)).toEqual(["Rapports 48 h"]);
    expect(r!.rejets[0]).toMatch(/Part de marché/);
  });
  it("une réponse illisible n'est pas une réponse", () => {
    expect(lireReponseDefinitions(null)).toBeNull();
    expect(lireReponseDefinitions({ message: "x" })).toBeNull();
  });
  it("le repli sans IA reconnaît les demandes courantes, et renvoie le reste au Super Admin", () => {
    const r = propositionsDeSecours("Je veux que mes KAM voient leurs décideurs au moins 2 fois par mois et rendent leur rapport en 48 h");
    expect(r.propositions.map((p) => p.def.nom)).toEqual(["Décideurs vus 2 fois / mois", "Rapports rendus en 48 h"]);
    const autre = propositionsDeSecours("le nombre de cafés bus avec les pharmaciens");
    expect(autre.propositions).toHaveLength(0);
    expect(autre.horsBriques).not.toBeNull();
  });
  it("un niveau évalué n'est retenu qu'avec une citation ancrée mot pour mot", () => {
    const sources = [{ id: "C1", type: "COACHING" as const, date: "2026-10-12", texte: "Points forts : bonne gestion de l'objection tolérance." }];
    const bon = lireReponseEvaluation({ niveau: 3, justification: "ok", citations: [{ source: "C1", extrait: "bonne gestion de l'objection tolérance" }] }, sources, 4);
    expect(bon?.niveau).toBe(3);
    expect(bon?.preuves[0]!.source).toBe("Fiche de coaching");
    expect(lireReponseEvaluation({ niveau: 3, justification: "ok", citations: [{ source: "C1", extrait: "excellent en tout point" }] }, sources, 4)).toBeNull();
    expect(lireReponseEvaluation({ niveau: 7, justification: "ok", citations: [{ source: "C1", extrait: "bonne gestion de l'objection" }] }, sources, 4)).toBeNull();
  });
});

describe("« Proposer un KPI » → un retour au Super Admin", () => {
  it("le message est structuré et se résume par son intention", () => {
    const m = messagePropositionKpi({ phrase: "mesurer les cafés", intention: "Suivre les rencontres informelles", donnees: "un journal des rencontres", frequence: "mensuelle", exemple: "" });
    expect(m).toMatch(/^\[Proposition de KPI\]/);
    expect(m).toContain("Intention : Suivre les rencontres informelles");
    expect(m).not.toContain("Exemple");
    expect(resumeProposition(m)).toBe("Suivre les rencontres informelles");
    expect(MODULE_FEEDBACK_KPI).toBe("KPI");
  });
});

describe("droits — l'arbre, pas le rôle", () => {
  const manager: FaitsKpi = { superAdmin: false, moi: "m", equipe: new Set(["k1", "k2"]), gestes: { voir: true, creer: true, valider: true } };
  const kam: FaitsKpi = { superAdmin: false, moi: "k1", equipe: new Set(), gestes: { voir: true, creer: true, valider: true } };
  const sa: FaitsKpi = { superAdmin: true, moi: "sa", equipe: new Set(), gestes: { voir: true, creer: true, valider: true } };
  it("une personne voit son bilan, pas celui d'un collègue", () => {
    expect(peutVoirBilan(kam, "k1")).toBe(true);
    expect(peutVoirBilan(kam, "k2")).toBe(false);
    expect(peutVoirBilan(manager, "k2")).toBe(true);
    expect(peutVoirBilan(sa, "k2")).toBe(true);
  });
  it("le manager gère son équipe, jamais lui-même ; le KAM ne crée rien pour une équipe qu'il n'a pas", () => {
    expect(peutGererPersonne(manager, "k1")).toBe(true);
    expect(peutGererPersonne(manager, "m")).toBe(false);
    expect(peutGererPersonne(manager, "autre")).toBe(false);
    expect(peutCreerPourEquipe(kam)).toBe(false);
    expect(peutCreerPourEquipe(manager)).toBe(true);
    expect(peutGererPersonne({ ...manager, gestes: { ...manager.gestes, valider: false } }, "k1")).toBe(false);
  });
  it("on ne déclare que pour soi ; on ne modifie que ses KPI d'équipe", () => {
    expect(peutDeclarer(kam, "k1")).toBe(true);
    expect(peutDeclarer(manager, "k1")).toBe(false);
    expect(peutModifierDefinition(manager, { portee: "EQUIPE", createdById: "m" })).toBe(true);
    expect(peutModifierDefinition(manager, { portee: "CATALOGUE", createdById: "m" })).toBe(false);
    expect(peutModifierDefinition(sa, { portee: "CATALOGUE", createdById: null })).toBe(true);
  });
});
