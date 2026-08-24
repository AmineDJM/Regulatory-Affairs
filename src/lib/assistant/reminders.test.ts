import { describe, it, expect } from "vitest";
import { nextOccurrence, algiersToUtc, formatAlgiersDue } from "./reminders";

describe("La prochaine échéance d'une récurrence", () => {
  const due = new Date("2026-08-23T09:00:00.000Z"); // un dimanche 10 h, heure d'Alger

  it("un rappel simple ne revient pas", () => {
    expect(nextOccurrence(due, "NONE", new Date("2026-08-23T09:05:00Z"))).toBeNull();
  });

  it("l'hebdomadaire retombe le MÊME jour à la MÊME heure — même tiré en retard", () => {
    // Le serveur a tiré avec vingt minutes de retard : le prochain dimanche reste dimanche 10 h.
    const next = nextOccurrence(due, "WEEKLY", new Date("2026-08-23T09:20:00Z"));
    expect(next?.toISOString()).toBe("2026-08-30T09:00:00.000Z");
  });

  it("rattrape un serveur resté éteint plusieurs périodes", () => {
    // Trois semaines d'arrêt : on ne notifie pas trois fois, on saute à la prochaine à venir.
    const next = nextOccurrence(due, "WEEKLY", new Date("2026-09-14T12:00:00Z"));
    expect(next?.toISOString()).toBe("2026-09-20T09:00:00.000Z");
  });

  it("le quotidien et le mensuel avancent d'un jour / d'un mois", () => {
    expect(nextOccurrence(due, "DAILY", new Date("2026-08-23T09:05:00Z"))?.toISOString()).toBe("2026-08-24T09:00:00.000Z");
    expect(nextOccurrence(due, "MONTHLY", new Date("2026-08-23T09:05:00Z"))?.toISOString()).toBe("2026-09-23T09:00:00.000Z");
  });

  it("une récurrence inconnue ne gèle pas le balayage", () => {
    expect(nextOccurrence(due, "FORTNIGHTLY", new Date())).toBeNull();
  });
});

describe("« Chaque premier lundi du mois » — le Nième jour de semaine, pas le quantième", () => {
  // Lundi 7 septembre 2026 = PREMIER lundi du mois, 9 h heure d'Alger (8 h UTC).
  const firstMonday = new Date("2026-09-07T08:00:00.000Z");

  it("retombe le premier lundi du mois SUIVANT, à la même heure", () => {
    const next = nextOccurrence(firstMonday, "MONTHLY_WEEKDAY", new Date("2026-09-07T08:05:00Z"));
    // Premier lundi d'octobre 2026 : le 5.
    expect(next?.toISOString()).toBe("2026-10-05T08:00:00.000Z");
  });

  it("un 2e mardi reste un 2e mardi", () => {
    // Mardi 8 septembre 2026 = 2e mardi. Deuxième mardi d'octobre : le 13.
    const secondTuesday = new Date("2026-09-08T08:00:00.000Z");
    const next = nextOccurrence(secondTuesday, "MONTHLY_WEEKDAY", new Date("2026-09-08T09:00:00Z"));
    expect(next?.toISOString()).toBe("2026-10-13T08:00:00.000Z");
  });

  it("un mois sans 5e occurrence retombe sur la DERNIÈRE — jamais d'annulation silencieuse", () => {
    // Jeudi 29 octobre 2026 = 5e jeudi. Novembre 2026 n'a que 4 jeudis → le 26.
    const fifthThursday = new Date("2026-10-29T08:00:00.000Z");
    const next = nextOccurrence(fifthThursday, "MONTHLY_WEEKDAY", new Date("2026-10-29T09:00:00Z"));
    expect(next?.toISOString()).toBe("2026-11-26T08:00:00.000Z");
  });

  it("rattrape un serveur éteint plusieurs mois sans notifier N fois", () => {
    const next = nextOccurrence(firstMonday, "MONTHLY_WEEKDAY", new Date("2026-12-15T00:00:00Z"));
    // Premier lundi de janvier 2027 : le 4.
    expect(next?.toISOString()).toBe("2027-01-04T08:00:00.000Z");
  });
});

describe("L'heure d'Alger (UTC+1, sans changement d'heure)", () => {
  it("« mardi 10 h » devient 9 h UTC", () => {
    expect(algiersToUtc("2026-08-25", "10:00")?.toISOString()).toBe("2026-08-25T09:00:00.000Z");
  });

  it("l'heure vide retombe sur 9 h du matin — un rappel sans heure est un rappel du matin", () => {
    expect(algiersToUtc("2026-08-25", "")?.toISOString()).toBe("2026-08-25T08:00:00.000Z");
  });

  it("refuse une date illisible plutôt que de deviner", () => {
    expect(algiersToUtc("mardi prochain", "10:00")).toBeNull();
    expect(algiersToUtc("2026-08-25", "dix heures")).toBeNull();
  });

  it("réaffiche l'échéance en heure locale", () => {
    const d = algiersToUtc("2026-08-25", "10:00")!;
    expect(formatAlgiersDue(d)).toBe("25/08/2026 à 10h00");
  });
});
