import { describe, it, expect } from "vitest";
import {
  daysBetween, expiryLevel, daysLeft, effectiveStatus, shouldRemind,
  canRenew, canCancel, proposeRenewalDates, validateDates,
  REMIND_SOON_DAYS, REMIND_IMMINENT_DAYS,
} from "./lifecycle";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);
const TODAY = D("2026-06-01");
const active = (endDate: Date | null) => ({ status: "ACTIVE" as const, endDate });

describe("Compter les jours", () => {
  it("compte des jours entiers, dans les deux sens", () => {
    expect(daysBetween(D("2026-06-01"), D("2026-06-30"))).toBe(29);
    expect(daysBetween(D("2026-06-01"), D("2026-06-01"))).toBe(0);
    expect(daysBetween(D("2026-06-01"), D("2026-05-31"))).toBe(-1);
  });
});

describe("Un document SANS date de fin ne se périme jamais", () => {
  it("ne produit ni niveau d'échéance ni rappel", () => {
    const doc = { ...active(null), lastRemindedAt: null };
    expect(expiryLevel(doc, TODAY)).toBe("NONE");
    expect(daysLeft(doc, TODAY)).toBeNull();
    expect(shouldRemind(doc, TODAY)).toBe(false);
    expect(effectiveStatus(doc, TODAY)).toBe("ACTIVE");
  });
});

describe("L'urgence est GRADUÉE — un seuil unique ne sait dire que « bientôt »", () => {
  it("classe l'échéance selon ce qui reste", () => {
    expect(expiryLevel(active(D("2027-01-01")), TODAY)).toBe("SCHEDULED");
    expect(expiryLevel(active(D("2026-08-15")), TODAY)).toBe("SOON");      // ~75 j
    expect(expiryLevel(active(D("2026-06-20")), TODAY)).toBe("IMMINENT");  // 19 j
    expect(expiryLevel(active(D("2026-06-01")), TODAY)).toBe("IMMINENT");  // aujourd'hui
    expect(expiryLevel(active(D("2026-05-31")), TODAY)).toBe("OVERDUE");
  });

  it("les bornes exactes tombent du bon côté", () => {
    const soon = new Date(TODAY.getTime() + REMIND_SOON_DAYS * 86_400_000);
    const imminent = new Date(TODAY.getTime() + REMIND_IMMINENT_DAYS * 86_400_000);
    expect(expiryLevel(active(soon), TODAY)).toBe("SOON");
    expect(expiryLevel(active(imminent), TODAY)).toBe("IMMINENT");
  });
});

describe("Un document sorti du jeu ne rappelle plus", () => {
  it("annulé ou renouvelé : silence, même avec une échéance dépassée", () => {
    const past = D("2026-01-01");
    expect(expiryLevel({ status: "CANCELLED", endDate: past }, TODAY)).toBe("NONE");
    expect(expiryLevel({ status: "RENEWED", endDate: past }, TODAY)).toBe("NONE");
    expect(shouldRemind({ status: "CANCELLED", endDate: past, lastRemindedAt: null }, TODAY)).toBe(false);
  });

  it("garde son statut : la suite vit ailleurs, on ne la réécrit pas en « expiré »", () => {
    expect(effectiveStatus({ status: "RENEWED", endDate: D("2026-01-01") }, TODAY)).toBe("RENEWED");
    expect(effectiveStatus({ status: "CANCELLED", endDate: D("2026-01-01") }, TODAY)).toBe("CANCELLED");
  });
});

describe("Le statut effectif tient compte du calendrier", () => {
  it("un terme passé rend le document expiré, sans qu'on ait rouvert la fiche", () => {
    expect(effectiveStatus(active(D("2026-05-31")), TODAY)).toBe("EXPIRED");
    expect(effectiveStatus(active(D("2026-06-30")), TODAY)).toBe("ACTIVE");
  });
});

describe("On rappelle au CHANGEMENT de niveau, pas tous les jours", () => {
  it("premier rappel dès l'entrée en zone", () => {
    expect(shouldRemind({ ...active(D("2026-06-20")), lastRemindedAt: null }, TODAY)).toBe(true);
  });

  it("ne redit rien tant qu'on est au même niveau", () => {
    // Rappelé il y a 5 jours, déjà en IMMINENT → on se tait.
    expect(shouldRemind({ ...active(D("2026-06-20")), lastRemindedAt: D("2026-05-27") }, TODAY)).toBe(false);
  });

  it("reparle quand on passe de « soon » à « imminent »", () => {
    // Le 2026-04-01 il restait 80 j (SOON) ; aujourd'hui 19 j (IMMINENT) → on reparle.
    expect(shouldRemind({ ...active(D("2026-06-20")), lastRemindedAt: D("2026-04-01") }, TODAY)).toBe(true);
  });

  it("une échéance lointaine ne réveille personne", () => {
    expect(shouldRemind({ ...active(D("2027-06-01")), lastRemindedAt: null }, TODAY)).toBe(false);
  });
});

describe("Renouveler et annuler", () => {
  it("ne s'appliquent qu'à ce qui est encore en jeu", () => {
    expect(canRenew("ACTIVE")).toBe(true);
    expect(canRenew("EXPIRED")).toBe(true);   // renouveler en retard reste le geste normal
    expect(canRenew("RENEWED")).toBe(false);  // la suite existe déjà
    expect(canCancel("CANCELLED")).toBe(false);
  });

  it("propose la reconduction : lendemain du terme, même durée", () => {
    const r = proposeRenewalDates({ startDate: D("2025-01-01"), endDate: D("2025-12-31") });
    expect(r.startDate?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.endDate?.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("sans terme précédent, ne devine aucune date", () => {
    expect(proposeRenewalDates({ startDate: D("2025-01-01"), endDate: null }))
      .toEqual({ startDate: null, endDate: null });
  });

  it("sans date de début, propose le départ mais pas la fin", () => {
    const r = proposeRenewalDates({ startDate: null, endDate: D("2025-12-31") });
    expect(r.startDate?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(r.endDate).toBeNull();
  });
});

describe("Contrôle des dates", () => {
  it("refuse un terme antérieur au début", () => {
    expect(validateDates(D("2026-06-01"), D("2026-01-01")).ok).toBe(false);
  });
  it("accepte l'absence de date — c'est un cas normal, pas un oubli", () => {
    expect(validateDates(null, null)).toEqual({ ok: true });
    expect(validateDates(D("2026-01-01"), null)).toEqual({ ok: true });
    expect(validateDates(null, D("2026-01-01"))).toEqual({ ok: true });
  });
});
