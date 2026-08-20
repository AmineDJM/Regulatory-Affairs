import { describe, it, expect } from "vitest";
import {
  REMINDER_STALE_DAYS, REMINDER_COOLDOWN_DAYS,
  canSendUpdateReminder, daysSince, isStaleDossier, remindedRecently,
  reminderTargets, reminderBody, reminderAuditSummary, reminderResultMessage,
  type ReminderDossier,
} from "./update-reminder";

const NOW = new Date("2026-08-20T10:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("canSendUpdateReminder — la relance vient d'en haut, ou elle ne vaut rien", () => {
  it("le Super Admin et le Directeur Général relancent", () => {
    expect(canSendUpdateReminder({ role: "SUPER_ADMIN" })).toBe(true);
    expect(canSendUpdateReminder({ role: "GENERAL_MANAGER" })).toBe(true);
  });

  // Entre les mains d'un pair, « la direction vous attend » devient un moyen de pression latéral.
  it("personne d'autre — pas même le responsable réglementaire ni la Direction", () => {
    expect(canSendUpdateReminder({ role: "HEAD_OF_REGULATORY" })).toBe(false);
    expect(canSendUpdateReminder({ role: "DIRECTION" })).toBe(false);
    expect(canSendUpdateReminder({ role: "REGULATORY_ASSISTANT" })).toBe(false);
    expect(canSendUpdateReminder({})).toBe(false);
  });

  // Un directeur général dont le compte principal porte un autre rôle reste directeur général.
  it("le rôle SECONDAIRE compte autant que le principal", () => {
    expect(canSendUpdateReminder({ role: "HEAD_OF_SALES", secondaryRole: "GENERAL_MANAGER" })).toBe(true);
  });
});

describe("daysSince / isStaleDossier — ce qui dort depuis trop longtemps", () => {
  it("compte les jours pleins", () => {
    expect(daysSince(daysAgo(0), NOW)).toBe(0);
    expect(daysSince(daysAgo(31), NOW)).toBe(31);
    expect(daysSince("2026-08-10T10:00:00.000Z", NOW)).toBe(10);
  });

  it("une date absente ou illisible ne rend pas un chiffre inventé", () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince("pas une date", NOW)).toBeNull();
  });

  it("le seuil est atteint AU jour dit, pas le lendemain", () => {
    expect(isStaleDossier(daysAgo(REMINDER_STALE_DAYS - 1), NOW)).toBe(false);
    expect(isStaleDossier(daysAgo(REMINDER_STALE_DAYS), NOW)).toBe(true);
  });

  it("sans date connue, un dossier n'est pas déclaré en sommeil", () => {
    // Mieux vaut ne rien reprocher que reprocher à tort : la personne relancée irait chercher
    // un dossier immobile qui ne l'est pas.
    expect(isStaleDossier(null, NOW)).toBe(false);
  });
});

describe("remindedRecently — signalé, jamais bloquant", () => {
  it("vrai dans la fenêtre, faux au-delà", () => {
    expect(remindedRecently(daysAgo(1), NOW)).toBe(true);
    expect(remindedRecently(daysAgo(REMINDER_COOLDOWN_DAYS), NOW)).toBe(false);
  });

  it("jamais relancé = rien à signaler", () => {
    expect(remindedRecently(null, NOW)).toBe(false);
  });
});

describe("reminderTargets — qui porte quoi, et qui ne porte rien", () => {
  const d = (over: Partial<ReminderDossier>): ReminderDossier => ({
    responsibleId: "u1", responsibleName: "Amina Berkane",
    isLocked: false, status: "IN_PREPARATION", updatedAt: daysAgo(2), ...over,
  });

  it("regroupe par personne et compte les dossiers en sommeil", () => {
    const board = reminderTargets(
      [
        d({}), d({ updatedAt: daysAgo(40) }), d({ updatedAt: daysAgo(90) }),
        d({ responsibleId: "u2", responsibleName: "Karim Saïdi" }),
      ],
      { now: NOW },
    );
    expect(board.targets).toEqual([
      { userId: "u1", name: "Amina Berkane", total: 3, stale: 2, lastRemindedAt: null },
      { userId: "u2", name: "Karim Saïdi", total: 1, stale: 0, lastRemindedAt: null },
    ]);
  });

  // Un dossier verrouillé est invisible de son propre responsable : le relancer dessus, c'est lui
  // demander l'impossible ET lui révéler qu'il existe.
  it("écarte les dossiers VERROUILLÉS", () => {
    const board = reminderTargets([d({ isLocked: true }), d({})], { now: NOW });
    expect(board.targets[0].total).toBe(1);
  });

  it("écarte les dossiers ABOUTIS — il n'y a plus rien à mettre à jour", () => {
    const board = reminderTargets(
      [d({ status: "DECISION_OBTAINED" }), d({ status: "CLOSED" }), d({})],
      { now: NOW },
    );
    expect(board.targets[0].total).toBe(1);
  });

  it("compte à part les dossiers que PERSONNE ne porte", () => {
    // Les taire donnerait une somme fausse : on croirait avoir couvert tout le tableau.
    const board = reminderTargets([d({ responsibleId: null }), d({ responsibleId: null }), d({})], { now: NOW });
    expect(board.unassigned).toBe(2);
    expect(board.targets).toHaveLength(1);
  });

  it("classe par urgence : le plus en sommeil d'abord, puis le plus gros portefeuille", () => {
    const board = reminderTargets(
      [
        d({ responsibleId: "a", responsibleName: "A" }),
        d({ responsibleId: "a", responsibleName: "A" }),
        d({ responsibleId: "b", responsibleName: "B", updatedAt: daysAgo(60) }),
        d({ responsibleId: "c", responsibleName: "C" }),
      ],
      { now: NOW },
    );
    expect(board.targets.map((t) => t.userId)).toEqual(["b", "a", "c"]);
  });

  it("rapporte la dernière relance de chacun", () => {
    const last = new Map([["u1", daysAgo(3)]]);
    const board = reminderTargets([d({})], { now: NOW, lastRemindedAt: last });
    expect(board.targets[0].lastRemindedAt).toEqual(daysAgo(3));
  });

  it("un tableau sans aucun dossier ne rend personne, pas une ligne vide", () => {
    expect(reminderTargets([], { now: NOW })).toEqual({ targets: [], unassigned: 0 });
  });
});

describe("messages — une relance qui dit quoi faire", () => {
  it("le corps est CHIFFRÉ : la personne sait par où commencer", () => {
    const body = reminderBody({ total: 12, stale: 5 });
    expect(body).toContain("12 dossiers à traiter");
    expect(body).toContain("5 sans mouvement");
  });

  it("sans dossier en sommeil, on ne reproche rien", () => {
    expect(reminderBody({ total: 1, stale: 0 })).toBe("1 dossier à traiter.");
  });

  it("la note de celui qui relance est reprise telle quelle", () => {
    expect(reminderBody({ total: 2, stale: 0 }, "  Avant le comité de vendredi.  "))
      .toBe("2 dossiers à traiter. Avant le comité de vendredi.");
  });

  it("le journal nomme les destinataires, et abrège au-delà de trois", () => {
    expect(reminderAuditSummary(["A", "B"])).toContain("A, B");
    expect(reminderAuditSummary(["A", "B", "C", "D", "E"])).toContain("et 2 autres");
    expect(reminderAuditSummary([])).toContain("aucun destinataire");
  });

  it("le retour d'écran dit la vérité quand il n'y avait personne à relancer", () => {
    expect(reminderResultMessage(0)).toContain("aucun dossier");
    expect(reminderResultMessage(1)).toBe("Relance envoyée à 1 personne.");
    expect(reminderResultMessage(4)).toBe("Relance envoyée à 4 personnes.");
  });
});
