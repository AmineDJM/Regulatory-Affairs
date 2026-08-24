import { describe, expect, it } from "vitest";
import { daysSince, regulatoryExecutiveState, paymentExecutiveState } from "./executive-state";

/**
 * ÉTAT EXÉCUTIF PRÉCALCULÉ — les invariants :
 *   • le BLOQUEUR est DÉRIVÉ des données tracées (étape bloquée / pièces manquantes / retard /
 *     validateur en attente), jamais inventé — et son absence se dit ;
 *   • les délais (jours dans l'étape, attente chez un validateur) sortent de la chronologie ;
 *   • les SIGNAUX ne s'allument que sur une règle vérifiable — un dossier sain n'en a aucun.
 */

const d = (s: string) => new Date(`${s}T10:00:00Z`);
const NOW = d("2026-08-24");

describe("executive-state — dossier Regulatory", () => {
  const baseSteps = [
    { type: "PRE_SUBMISSION", status: "DONE", plannedDate: d("2026-05-01"), actualDate: d("2026-05-03"), missingDocs: null, responsible: "Khaled" },
    { type: "CTD_PREPARATION", status: "DONE", plannedDate: d("2026-06-01"), actualDate: d("2026-06-10"), missingDocs: null, responsible: "Khaled" },
    { type: "DOSSIER_SUBMISSION", status: "IN_PROGRESS", plannedDate: d("2026-07-15"), actualDate: null, missingDocs: "CPP légalisé", responsible: "Nesrine" },
    { type: "COMMISSION_REVIEW", status: "NOT_STARTED", plannedDate: d("2026-10-01"), actualDate: null, missingDocs: null, responsible: null },
  ];

  it("« où en est le produit ? » : étape courante, bloqueur (pièces manquantes), jours dans l'étape, prochaine étape", () => {
    const s = regulatoryExecutiveState({
      status: "IN_PREPARATION", priority: "HIGH",
      targetSubmissionDate: null, targetDate: null, responsible: "Khaled",
      steps: baseSteps,
      lastActivity: { at: d("2026-08-10"), summary: "Commentaire ajouté" },
    }, NOW);
    expect(s.etapeCourante).toMatchObject({ etape: expect.stringContaining("Dépôt"), responsable: "Nesrine" });
    expect(String(s.bloqueur)).toContain("CPP légalisé");
    // Dans l'étape depuis la fin de la dernière étape faite (10/06 → 24/08 = 75 j).
    expect(s.joursDansEtapeCourante).toBe(75);
    expect(s.prochaineEcheance).toBe("2026-07-15");
    expect(String(s.prochaineEtapeAttendue)).toContain("commission");
    // Signaux : l'étape est en retard (15/07 dépassé) ET priorité HIGH qui n'avance pas.
    expect((s.signaux as string[]).join(" | ")).toMatch(/en retard/);
    expect((s.signaux as string[]).join(" | ")).toMatch(/HIGH/);
  });

  it("un dossier SAIN n'a ni bloqueur ni signal — et l'absence se dit, elle n'est pas inventée", () => {
    const s = regulatoryExecutiveState({
      status: "SUBMITTED", priority: "MEDIUM",
      targetSubmissionDate: null, targetDate: null, responsible: "Khaled",
      steps: [
        { type: "PRE_SUBMISSION", status: "DONE", plannedDate: null, actualDate: d("2026-08-20"), missingDocs: null, responsible: null },
        { type: "CTD_PREPARATION", status: "IN_PROGRESS", plannedDate: d("2026-09-15"), actualDate: null, missingDocs: null, responsible: null },
      ],
      lastActivity: { at: d("2026-08-22"), summary: "Étape faite" },
    }, NOW);
    expect(String(s.bloqueur)).toContain("aucun bloqueur tracé");
    expect(s.signaux).toEqual([]);
    expect(s.joursDansEtapeCourante).toBe(4);
  });

  it("silence prolongé + cible de dépôt dépassée → signaux dérivés, chacun vérifiable", () => {
    const s = regulatoryExecutiveState({
      status: "IN_PREPARATION", priority: "MEDIUM",
      targetSubmissionDate: d("2026-07-01"), targetDate: null, responsible: null,
      steps: baseSteps,
      lastActivity: { at: d("2026-07-01"), summary: "Dernier mouvement" },
    }, NOW);
    const joined = (s.signaux as string[]).join(" | ");
    expect(joined).toMatch(/aucun mouvement tracé depuis 54 j/);
    expect(joined).toMatch(/cible de dépôt dépassée/);
  });

  it("toutes les étapes faites → pas d'étape courante, pas de faux bloqueur", () => {
    const s = regulatoryExecutiveState({
      status: "DECISION_OBTAINED", priority: "MEDIUM",
      targetSubmissionDate: null, targetDate: d("2026-06-01"), responsible: null,
      steps: [{ type: "PRE_SUBMISSION", status: "DONE", plannedDate: null, actualDate: d("2026-05-01"), missingDocs: null, responsible: null }],
      lastActivity: null,
    }, NOW);
    expect(s.etapeCourante).toBe("toutes les étapes sont faites");
    expect(s.bloqueur).toBeNull();
    // DECISION_OBTAINED = dossier abouti : la cible dépassée n'est PAS un signal.
    expect(s.signaux).toEqual([]);
  });
});

describe("executive-state — demande de paiement", () => {
  it("« où est le paiement ? » : QUI bloque, depuis combien de jours, la prochaine étape", () => {
    const s = paymentExecutiveState({
      status: "SUBMITTED", dueDate: d("2026-08-20"), createdAt: d("2026-08-01"),
      validations: [{
        createdAt: d("2026-08-02"),
        steps: [
          { status: "APPROVED", decidedAt: d("2026-08-05"), validatorName: "Directeur Finances", order: 1 },
          { status: "PENDING", decidedAt: null, validatorName: "Nadia", order: 2 },
        ],
      }],
      order: null,
    }, NOW);
    expect(String(s.bloqueur)).toContain("Nadia");
    expect(String(s.bloqueur)).toContain("19 j"); // depuis la décision précédente (05/08)
    expect(s.prochaineEtape).toBe("validation de Nadia");
    const joined = (s.signaux as string[]).join(" | ");
    expect(joined).toMatch(/échéance convenue dépassée de 4 j/);
    expect(joined).toMatch(/attend depuis 19 j/);
  });

  it("au centre de paiement : le bloqueur est le bon à payer, pas un validateur", () => {
    const s = paymentExecutiveState({
      status: "APPROVED", dueDate: null, createdAt: d("2026-08-01"),
      validations: [],
      order: { status: "PENDING", centralStatus: "AWAITING", paidDate: null, createdAt: d("2026-08-14") },
    }, NOW);
    expect(String(s.bloqueur)).toContain("centre de paiement depuis 10 j");
    expect(s.prochaineEtape).toBe("bon à payer du centre de paiement");
  });

  it("payé → plus rien à faire, aucun bloqueur, aucun signal", () => {
    const s = paymentExecutiveState({
      status: "APPROVED", dueDate: d("2026-07-01"), createdAt: d("2026-06-01"),
      validations: [],
      order: { status: "PAID", centralStatus: "APPROVED", paidDate: d("2026-07-02"), createdAt: d("2026-06-20") },
    }, NOW);
    expect(s.bloqueur).toBeNull();
    expect(s.prochaineEtape).toContain("payé");
    expect(s.signaux).toEqual([]);
  });

  it("daysSince : aujourd'hui = 0, date manquante = null", () => {
    expect(daysSince(NOW, NOW)).toBe(0);
    expect(daysSince(null)).toBeNull();
    expect(daysSince(d("2026-08-20"), NOW)).toBe(4);
  });
});
