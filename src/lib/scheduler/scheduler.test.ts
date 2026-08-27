import { describe, expect, it, beforeEach } from "vitest";
import {
  nextRunAt, describeSchedule, ALGIERS_OFFSET_HOURS, RECURRENCES,
  STALE_CLAIM_MS, RUN_HISTORY_KEEP,
} from "./contract";
import {
  registerWorkflow, workflowHandler, availableWorkflows,
  isKnownWorkflow, resetWorkflowRegistry,
} from "./registry";
import { registerBuiltinWorkflows, resetBuiltinRegistration } from "./handlers";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PLANIFICATEUR PERSISTANT — le calcul des échéances et la garde qui le rend sûr.
 *
 * Deux familles de vérités ici. Les ÉCHÉANCES, où une erreur d'une heure ou d'un jour fait
 * arriver un rapport au mauvais moment sans que rien ne semble cassé. Et la GARDE, qui dit
 * qu'une planification ne peut pas devenir un contournement d'approbation — la propriété la plus
 * importante de tout ce module.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un instant, écrit en heure d'ALGER, rendu en UTC — pour que les tests se lisent. */
const algiers = (iso: string): Date => new Date(new Date(`${iso}Z`).getTime() - ALGIERS_OFFSET_HOURS * 3_600_000);

/** Ce qu'un instant UTC donne à Alger — pour vérifier l'heure que l'utilisateur verra. */
function localOf(d: Date): { day: number; hour: number; date: number; month: number } {
  const l = new Date(d.getTime() + ALGIERS_OFFSET_HOURS * 3_600_000);
  return { day: l.getUTCDay(), hour: l.getUTCHours(), date: l.getUTCDate(), month: l.getUTCMonth() };
}

describe("échéances quotidiennes", () => {
  it("tombe à l'heure locale demandée, pas à l'heure UTC", () => {
    // Le piège central : « 7 h » veut dire 7 h à Alger. Stocker 7 h UTC ferait arriver le
    // rapport à 8 h locales, tous les jours, sans que personne ne comprenne pourquoi.
    const next = nextRunAt({ recurrence: "DAILY", hourLocal: 7 }, algiers("2026-08-27T05:00:00"));
    expect(localOf(next).hour).toBe(7);
    expect(localOf(next).date).toBe(27); // même jour : 7 h n'est pas encore passée
  });

  it("passe au lendemain quand l'heure est déjà passée", () => {
    const next = nextRunAt({ recurrence: "DAILY", hourLocal: 7 }, algiers("2026-08-27T09:00:00"));
    expect(localOf(next).date).toBe(28);
    expect(localOf(next).hour).toBe(7);
  });

  it("ne rend JAMAIS l'instant courant — sinon la planification boucle", () => {
    // Une échéance égale à maintenant serait immédiatement due, tournerait, recalculerait la
    // même échéance, et tournerait encore. C'est la panne classique d'un planificateur maison.
    const now = algiers("2026-08-27T07:00:00");
    expect(nextRunAt({ recurrence: "DAILY", hourLocal: 7 }, now).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("échéances hebdomadaires", () => {
  it("vise le bon jour de la semaine", () => {
    // 27 août 2026 est un jeudi ; on demande le dimanche (0).
    const next = nextRunAt({ recurrence: "WEEKLY", hourLocal: 7, dayOfWeek: 0 }, algiers("2026-08-27T09:00:00"));
    expect(localOf(next).day).toBe(0);
    expect(localOf(next).hour).toBe(7);
  });

  it("le bon jour mais l'heure passée renvoie à la semaine SUIVANTE", () => {
    // Dimanche 30 août 2026, 9 h : le rendez-vous de 7 h est passé. Ce n'est pas « dans une
    // minute », c'est dans sept jours.
    const from = algiers("2026-08-30T09:00:00");
    const next = nextRunAt({ recurrence: "WEEKLY", hourLocal: 7, dayOfWeek: 0 }, from);
    expect(localOf(next).day).toBe(0);
    expect(next.getTime() - from.getTime()).toBeGreaterThan(6 * 24 * 3_600_000);
  });
});

describe("échéances mensuelles", () => {
  it("vise le jour du mois demandé", () => {
    const next = nextRunAt({ recurrence: "MONTHLY", hourLocal: 8, dayOfMonth: 15 }, algiers("2026-08-27T09:00:00"));
    expect(localOf(next).date).toBe(15);
    expect(localOf(next).month).toBe(8); // septembre
  });

  it("le 31 en février tombe le DERNIER jour, jamais en mars", () => {
    // `setDate(31)` en février déborderait sur le 3 mars : le « rapport du 31 » arriverait le 3.
    const next = nextRunAt({ recurrence: "MONTHLY", hourLocal: 7, dayOfMonth: 31 }, algiers("2026-02-01T09:00:00"));
    expect(localOf(next).month).toBe(1); // toujours février
    expect(localOf(next).date).toBe(28);
  });
});

describe("échéance horaire", () => {
  it("vise l'heure pleine suivante", () => {
    const next = nextRunAt({ recurrence: "HOURLY", hourLocal: 7 }, new Date("2026-08-27T09:37:00Z"));
    expect(next.toISOString()).toBe("2026-08-27T10:00:00.000Z");
  });
});

describe("ce que l'utilisateur lit", () => {
  it("décrit la cadence en français vérifiable", () => {
    expect(describeSchedule({ recurrence: "WEEKLY", hourLocal: 7, dayOfWeek: 0 })).toBe("Tous les dimanches à 07 h");
    expect(describeSchedule({ recurrence: "MONTHLY", hourLocal: 8, dayOfMonth: 1 })).toBe("Le 1er de chaque mois à 08 h");
    expect(describeSchedule({ recurrence: "DAILY", hourLocal: 18 })).toBe("Tous les jours à 18 h");
    expect(describeSchedule({ recurrence: "HOURLY", hourLocal: 0 })).toBe("Toutes les heures");
  });

  it("la grammaire reste FERMÉE — quatre récurrences, pas une expression cron", () => {
    expect([...RECURRENCES]).toEqual(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]);
  });
});

describe("le registre, et la garde qu'il porte", () => {
  beforeEach(() => {
    resetWorkflowRegistry();
    resetBuiltinRegistration();
  });

  it("une clé absente du registre n'est PAS exécutable", () => {
    // C'est ce qui rend inoffensive une clé écrite à la main dans la base : le planificateur ne
    // la trouve pas et refuse, sans avoir eu besoin de comprendre ce qu'elle demandait.
    expect(isKnownWorkflow("supprime-tout")).toBe(false);
    expect(workflowHandler("supprime-tout")).toBeNull();
  });

  it("AUCUN traitement livré ne mute l'ERP — la propriété est gelée ici", () => {
    // La règle centrale de §9 : une planification est un DÉCLENCHEUR, jamais une dérogation à une
    // approbation. Ajouter un traitement qui écrit ou qui envoie fait échouer ce test.
    registerBuiltinWorkflows();
    const kinds = availableWorkflows().map((w) => w.kind);
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) {
      expect(workflowHandler(kind)!.mutates).toBe(false);
    }
  });

  it("le catalogue est trié et lisible", () => {
    registerBuiltinWorkflows();
    const labels = availableWorkflows().map((w) => w.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "fr")));
    for (const w of availableWorkflows()) expect(w.description.length).toBeGreaterThan(20);
  });

  it("réenregistrer une clé remplace au lieu de lever", () => {
    const make = (label: string) => ({
      kind: "essai", label, description: "x", mutates: false as const,
      run: async () => ({ didWork: true, summary: label }),
    });
    registerWorkflow(make("premier"));
    registerWorkflow(make("second"));
    expect(workflowHandler("essai")!.label).toBe("second");
  });

  it("l'enregistrement des traitements livrés est idempotent", () => {
    registerBuiltinWorkflows();
    const n = availableWorkflows().length;
    registerBuiltinWorkflows();
    expect(availableWorkflows().length).toBe(n);
  });
});

describe("les bornes d'exploitation", () => {
  it("un verrou abandonné finit par se libérer", () => {
    // Sans ce délai, un processus tué en plein traitement laisserait la planification « en
    // cours » pour toujours : elle ne tournerait plus jamais, sans erreur visible nulle part.
    expect(STALE_CLAIM_MS).toBeGreaterThan(5 * 60_000);
    expect(STALE_CLAIM_MS).toBeLessThanOrEqual(60 * 60_000);
  });

  it("l'historique est borné mais assez long pour voir une panne intermittente", () => {
    expect(RUN_HISTORY_KEEP).toBeGreaterThanOrEqual(20);
  });
});
