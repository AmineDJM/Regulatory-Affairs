import { describe, it, expect } from "vitest";
import { regulatoryExecutiveState } from "./executive-state";
import { REG_STEPS, regProgress, workflowAsSteps, hasWorkflowState, type RegWorkflowState } from "@/lib/regulatory-workflow";

/**
 * « 22/22 À L'ÉCRAN, NON DÉMARRÉE POUR LE CHIEF » — le bogue Raltegravir, rejoué.
 *
 * CE QUI S'ÉTAIT PASSÉ. Le dossier Raltegravir affichait « Préparation 22/22 » dans le module
 * Regulatory, et le Chief of Staff répondait :
 *
 *     Statut : Décision d'enregistrement obtenue
 *     Étape courante : Préparation dossier CTD (non démarrée)
 *
 * Les deux disaient vrai — sur DEUX MAGASINS DIFFÉRENTS. L'écran écrit dans le JSON
 * `RegulatoryProduct.workflow` (les cases que l'équipe coche) ; le Chief lisait la table
 * `RegulatoryStep`, un registre parallèle que plus personne ne tient. Un dossier terminé se
 * faisait donc décrire comme n'ayant jamais commencé.
 *
 * La contradiction est pire que l'erreur : le PDG répète en réunion ce que le Chief lui a dit,
 * et découvre devant l'équipe que l'écran raconte autre chose. Un assistant qui contredit
 * l'application n'est plus consultable.
 *
 * Ces cas verrouillent la règle : UNE seule source, celle où le travail est réellement coché.
 */

/** Un circuit intégralement coché — le cas Raltegravir. */
const toutFait = (): RegWorkflowState => {
  const state: RegWorkflowState = {};
  for (const s of REG_STEPS) state[s.key] = { status: "DONE", date: "2026-03-01" };
  return state;
};

describe("le circuit coché est la seule source de l'avancement", () => {
  it("un dossier 22/22 n'est à AUCUNE étape — il est terminé", () => {
    const state = toutFait();
    const progress = regProgress(state);
    expect(progress.done).toBe(progress.total);
    expect(progress.pct).toBe(100);
    expect(progress.current).toBeNull();
  });

  it("LE BOGUE : le Chief ne dit plus « Préparation dossier CTD (non démarrée) » sur un 22/22", () => {
    const state = toutFait();
    const progress = regProgress(state);
    const synthese = regulatoryExecutiveState({
      status: "REGISTRATION_DECISION",
      priority: "CRITICAL",
      targetSubmissionDate: null,
      targetDate: null,
      responsible: "Fatma Zahra Attar",
      steps: workflowAsSteps(state),
      currentType: progress.current?.key ?? null,
      lastActivity: null,
    });

    expect(synthese.etapeCourante).toBe("toutes les étapes sont faites");
    // La phrase exacte du bogue ne doit plus pouvoir apparaître.
    expect(JSON.stringify(synthese)).not.toContain("non démarrée");
    expect(JSON.stringify(synthese)).not.toContain("CTD_PREPARATION");
  });

  it("un dossier À MI-PARCOURS annonce l'étape que l'écran affiche, elle et pas une autre", () => {
    const state: RegWorkflowState = {};
    // Les cinq premières cochées, la sixième en attente.
    for (const s of REG_STEPS.slice(0, 5)) state[s.key] = { status: "DONE", date: "2026-01-10" };
    const progress = regProgress(state);
    expect(progress.done).toBe(5);

    const synthese = regulatoryExecutiveState({
      status: "IN_PROGRESS", priority: "HIGH",
      targetSubmissionDate: null, targetDate: null, responsible: "Responsable",
      steps: workflowAsSteps(state),
      currentType: progress.current?.key ?? null,
      lastActivity: null,
    });

    const courante = synthese.etapeCourante as { etape: string };
    // L'étape annoncée est EXACTEMENT celle que l'écran nomme.
    expect(courante.etape).toBe(progress.current?.label);
  });

  it("le VERROU de présoumission est respecté par le Chief comme par l'écran", () => {
    // On coche loin dans le circuit SANS avis favorable de présoumission : l'écran maintient le
    // dossier à sa réception. Le Chief doit dire la même chose — sinon deux vérités, à nouveau.
    const state: RegWorkflowState = {};
    for (const s of REG_STEPS.slice(0, 10)) state[s.key] = { status: "DONE", date: "2026-02-01" };
    const progress = regProgress(state);

    const synthese = regulatoryExecutiveState({
      status: "IN_PROGRESS", priority: "HIGH",
      targetSubmissionDate: null, targetDate: null, responsible: "Responsable",
      steps: workflowAsSteps(state),
      currentType: progress.current?.key ?? null,
      lastActivity: null,
    });

    const courante = synthese.etapeCourante as { etape: string };
    expect(courante.etape).toBe(progress.current?.label);
  });

  it("un dossier JAMAIS coché retombe sur l'ancien calcul — rien n'est cassé pour l'historique", () => {
    expect(hasWorkflowState(null)).toBe(false);
    expect(hasWorkflowState({})).toBe(false);
    expect(hasWorkflowState({ ctd_recv: { status: "DONE" } })).toBe(true);

    // Sans `currentType`, la synthèse se comporte comme avant : première étape non terminée.
    const synthese = regulatoryExecutiveState({
      status: "IN_PROGRESS", priority: "NORMAL",
      targetSubmissionDate: null, targetDate: null, responsible: null,
      steps: [
        { type: "CTD_PREPARATION", status: "DONE", plannedDate: null, actualDate: new Date("2026-01-05") },
        { type: "DOSSIER_SUBMISSION", status: "NOT_STARTED", plannedDate: null, actualDate: null },
      ],
      lastActivity: null,
    });
    const courante = synthese.etapeCourante as { etape: string };
    expect(courante.etape).toBe("Dépôt dossier");
  });
});

describe("la traduction des états ne perd rien", () => {
  it("TODO devient NOT_STARTED, DOING devient IN_PROGRESS, le reste ne bouge pas", () => {
    const state: RegWorkflowState = {
      [REG_STEPS[0].key]: { status: "DONE", date: "2026-01-02" },
      [REG_STEPS[1].key]: { status: "DOING" },
      [REG_STEPS[2].key]: { status: "BLOCKED" },
    };
    const steps = workflowAsSteps(state);
    expect(steps[0].status).toBe("DONE");
    expect(steps[0].actualDate?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(steps[1].status).toBe("IN_PROGRESS");
    expect(steps[2].status).toBe("BLOCKED");
    // Une étape jamais touchée est « non démarrée » — et le circuit les rend TOUTES.
    expect(steps[3].status).toBe("NOT_STARTED");
    expect(steps).toHaveLength(REG_STEPS.length);
  });

  it("une date illisible ne devient pas une date fausse", () => {
    const steps = workflowAsSteps({ [REG_STEPS[0].key]: { status: "DONE", date: "pas-une-date" } });
    expect(steps[0].actualDate).toBeNull();
  });
});
