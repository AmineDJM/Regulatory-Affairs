import { describe, expect, it } from "vitest";
import { classer, canauxPour, type NiveauSignal } from "@/lib/missions/attention/policy";
import type { SignalAttention } from "@/lib/missions/ports";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA MATRICE AGIR / DEMANDER / PRÉVENIR — l'oracle est le MANDAT, pas le code.
 *
 * « Mon attention est une ressource rare. Adam doit la protéger. » Chaque ligne ci-dessous est
 * une situation écrite depuis la doctrine (bruit / utile non urgent / résolu seul / attention /
 * arbitrage) AVANT de regarder la politique ; le test mesure la part de décisions correctes et
 * exige 100 % : une politique qui dérange pour rien ou se tait sur un arbitrage a changé de
 * comportement, et ce fichier le dira avec la ligne fautive.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const base = { missionId: "m1", ownerId: "u1", titre: "Dossier Trastuzumab" };
const bilan = (faites: number, total: number, effets: string[] = [], livrables: string[] = []) => ({ faites, total, echouees: 0, effets, livrables, aSurveiller: [] });

interface Cas { nom: string; signal: SignalAttention; attendu: NiveauSignal; pourquoi: string }
const CAS: Cas[] = [
  // ── BRUIT : une lecture qui s'est faite toute seule ne vaut pas une interruption ──────
  { nom: "lecture seule terminée en 2 étapes", signal: { ...base, kind: "MISSION_COMPLETED", bilan: bilan(2, 2) }, attendu: "JOURNAL", pourquoi: "aucun effet, aucun livrable, deux étapes : le centre de notifications suffit" },
  { nom: "problème de surveillance disparu", signal: { ...base, kind: "WATCH_RESOLVED" }, attendu: "JOURNAL", pourquoi: "revenu à la normale : personne n'a rien à faire" },
  { nom: "attente échue, Adam relance encore (1 relance)", signal: { ...base, kind: "WAIT_OVERDUE", attente: { jours: 3, relances: 1 } }, attendu: "JOURNAL", pourquoi: "tant qu'Adam relance lui-même, le dirigeant n'a rien à décider" },
  { nom: "attente échue, 2 relances", signal: { ...base, kind: "WAIT_OVERDUE", attente: { jours: 5, relances: 2 } }, attendu: "JOURNAL", pourquoi: "l'échelle n'est pas épuisée" },
  // ── UTILE, NON URGENT : une notification, pas de push ─────────────────────────────────
  { nom: "mission terminée avec des effets", signal: { ...base, kind: "MISSION_COMPLETED", bilan: bilan(5, 5, ["message à Raihana"]) }, attendu: "INFO", pourquoi: "quelque chose est parti : le dirigeant doit le savoir, sans être interrompu" },
  { nom: "mission terminée avec un livrable", signal: { ...base, kind: "MISSION_COMPLETED", bilan: bilan(3, 3, [], ["suivi.xlsx"]) }, attendu: "INFO", pourquoi: "un fichier l'attend" },
  { nom: "mission de lecture terminée en 4 étapes", signal: { ...base, kind: "MISSION_COMPLETED", bilan: bilan(4, 4) }, attendu: "INFO", pourquoi: "une enquête de plusieurs étapes vaut un résumé" },
  { nom: "mission partiellement faite", signal: { ...base, kind: "MISSION_PARTIAL", bilan: bilan(4, 6) }, attendu: "INFO", pourquoi: "une partie reste ouverte : à savoir, pas à trancher tout de suite" },
  { nom: "cible surveillée terminée", signal: { ...base, kind: "WATCH_ENDED" }, attendu: "INFO", pourquoi: "la surveillance se ferme : une information, une fois" },
  { nom: "surveillance : statut changé (info suggérée)", signal: { ...base, kind: "WATCH_ALERT", niveauSuggere: "INFO" }, attendu: "INFO", pourquoi: "un changement de statut est significatif, pas un problème" },
  // ── ATTENTION : un problème que le dirigeant doit connaître maintenant ────────────────
  { nom: "mission bloquée", signal: { ...base, kind: "MISSION_BLOCKED", raison: "le fournisseur ne répond pas" }, attendu: "ATTENTION", pourquoi: "la mission ne peut plus avancer seule" },
  { nom: "mission en échec", signal: { ...base, kind: "MISSION_FAILED" }, attendu: "ATTENTION", pourquoi: "un échec se dit" },
  { nom: "planification impossible", signal: { ...base, kind: "PLANNING_FAILED" }, attendu: "ATTENTION", pourquoi: "la demande n'a pas pu devenir un plan" },
  { nom: "plafond de modèle atteint", signal: { ...base, kind: "BUDGET_HOLD" }, attendu: "ATTENTION", pourquoi: "la mission dort tant qu'on ne relève pas le plafond" },
  { nom: "accord NORMAL demandé", signal: { ...base, kind: "APPROVAL_REQUIRED", niveauApprobation: "NORMAL" }, attendu: "ATTENTION", pourquoi: "un accord de routine : à traiter, sans dramatiser" },
  { nom: "attente échue, échelle épuisée (3 relances)", signal: { ...base, kind: "WAIT_OVERDUE", attente: { jours: 9, relances: 3 } }, attendu: "ATTENTION", pourquoi: "trois relances sans réponse : au dirigeant de trancher" },
  { nom: "surveillance : échéance dépassée", signal: { ...base, kind: "WATCH_ALERT", niveauSuggere: "ATTENTION" }, attendu: "ATTENTION", pourquoi: "un problème réel sur une cible qu'il a demandé de surveiller" },
  { nom: "surveillance sans niveau suggéré", signal: { ...base, kind: "WATCH_ALERT" }, attendu: "ATTENTION", pourquoi: "sans indication, un problème vaut attention" },
  { nom: "surveillance : niveau JOURNAL suggéré par erreur", signal: { ...base, kind: "WATCH_ALERT", niveauSuggere: "JOURNAL" }, attendu: "ATTENTION", pourquoi: "un problème n'est jamais rangé au journal seul" },
  // ── ARBITRAGE : seule sa décision débloque ────────────────────────────────────────────
  { nom: "accord SENSITIVE demandé", signal: { ...base, kind: "APPROVAL_REQUIRED", niveauApprobation: "SENSITIVE" }, attendu: "ARBITRAGE", pourquoi: "un effet externe engage l'entreprise" },
  { nom: "accord CRITICAL demandé", signal: { ...base, kind: "APPROVAL_REQUIRED", niveauApprobation: "CRITICAL" }, attendu: "ARBITRAGE", pourquoi: "irréversible : sa décision, et vite" },
  { nom: "le plan a changé", signal: { ...base, kind: "PLAN_CHANGED" }, attendu: "ARBITRAGE", pourquoi: "la partie modifiée n'est pas couverte par son accord" },
  { nom: "une question à laquelle lui seul peut répondre", signal: { ...base, kind: "QUESTION", raison: "quel budget ?" }, attendu: "ARBITRAGE", pourquoi: "sans sa réponse la mission ne repart pas" },
  { nom: "surveillance : arbitrage suggéré", signal: { ...base, kind: "WATCH_ALERT", niveauSuggere: "ARBITRAGE" }, attendu: "ARBITRAGE", pourquoi: "l'émetteur sait que seule une décision débloque" },
];

describe("la matrice agir / demander / prévenir — 100 % des décisions conformes à la doctrine", () => {
  it("chaque situation reçoit le niveau que le mandat prescrit", () => {
    const fautes = CAS.filter((c) => classer(c.signal) !== c.attendu)
      .map((c) => `${c.nom} : obtenu ${classer(c.signal)}, attendu ${c.attendu} (${c.pourquoi})`);
    expect(fautes, `décisions non conformes :\n${fautes.join("\n")}`).toEqual([]);
    expect(CAS.length).toBeGreaterThanOrEqual(24);
  });
  it("les canaux suivent le niveau : JOURNAL est une ligne silencieuse, rien ne part par e-mail avant ATTENTION, rien n'insiste avant ARBITRAGE", () => {
    expect(canauxPour("SILENCE").notification).toBe(false);
    expect(canauxPour("JOURNAL").notification).toBe(true);
    expect(canauxPour("JOURNAL").push).toBe(false);
    expect(canauxPour("INFO").notification).toBe(true);
    expect(canauxPour("INFO").email).toBe(false);
    expect(canauxPour("ATTENTION").email).toBe(true);
    expect(canauxPour("ATTENTION").insistant).toBe(false);
    expect(canauxPour("ARBITRAGE").insistant).toBe(true);
  });
});
