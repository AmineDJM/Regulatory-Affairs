import { describe, it, expect } from "vitest";
import { activePeriod, carriedOverMessage, type PeriodCash } from "./active-period";

const caisse = (period: string, status = "RECEIVED"): PeriodCash => ({ period, status });

describe("quelle caisse d'avance l'écran ouvre", () => {
  it("le mois COURANT quand il a une caisse", () => {
    const a = activePeriod(null, "2026-09", [caisse("2026-08"), caisse("2026-09")]);
    expect(a).toEqual({ period: "2026-09", carriedOver: false });
  });

  it("LE 1er DU MOIS, la caisse encore ouverte du mois précédent — au lieu du vide", () => {
    // C'est le défaut rapporté : à minuit, l'écran basculait sur un mois sans caisse et tout se
    // bloquait, alors que la caisse d'août contenait encore de l'argent. Elle n'était pas soldée,
    // elle était devenue invisible.
    const a = activePeriod(null, "2026-09", [caisse("2026-08")]);
    expect(a).toEqual({ period: "2026-08", carriedOver: true });
  });

  it("la PLUS RÉCENTE des caisses ouvertes, pas la première venue", () => {
    const a = activePeriod(null, "2026-09", [caisse("2026-06"), caisse("2026-08"), caisse("2026-07")]);
    expect(a.period).toBe("2026-08");
  });

  it("une caisse SOLDÉE ne rouvre pas — elle est finie, pas cachée", () => {
    const a = activePeriod(null, "2026-09", [caisse("2026-08", "CLOSED")]);
    expect(a).toEqual({ period: "2026-09", carriedOver: false });
  });

  it("une caisse REMISE mais pas encore confirmée compte : elle existe et attend sa réception", () => {
    const a = activePeriod(null, "2026-09", [caisse("2026-08", "ALLOTTED")]);
    expect(a.period).toBe("2026-08");
  });

  it("le choix EXPLICITE de la personne l'emporte, même sur un mois vide", () => {
    // Sinon on ne pourrait jamais ouvrir une caisse pour un mois qu'on refuse d'afficher.
    const a = activePeriod("2026-09", "2026-09", [caisse("2026-08")]);
    expect(a).toEqual({ period: "2026-09", carriedOver: false });
    const b = activePeriod("2026-05", "2026-09", [caisse("2026-08")]);
    expect(b).toEqual({ period: "2026-05", carriedOver: true });
  });

  it("aucune caisse nulle part : le mois courant, qui devient l'invitation à en ouvrir une", () => {
    expect(activePeriod(null, "2026-09", [])).toEqual({ period: "2026-09", carriedOver: false });
  });

  it("une caisse FUTURE ne se substitue pas au mois courant", () => {
    // Une dotation saisie d'avance pour octobre ne doit pas détourner l'écran de septembre.
    const a = activePeriod(null, "2026-09", [caisse("2026-10")]);
    expect(a).toEqual({ period: "2026-09", carriedOver: false });
  });

  it("le passage d'année se compare correctement", () => {
    const a = activePeriod(null, "2027-01", [caisse("2026-12")]);
    expect(a.period).toBe("2026-12");
  });
});

describe("ce que l'écran dit du report", () => {
  it("il NOMME le mois imputé — sinon on croit dépenser sur le mois en cours", () => {
    const m = carriedOverMessage({ period: "2026-08", carriedOver: true }, "septembre 2026", "août 2026");
    expect(m).toContain("septembre 2026");
    expect(m).toContain("août 2026");
    expect(m).toMatch(/imputent/i);
  });

  it("rien à dire quand on est sur le mois courant", () => {
    expect(carriedOverMessage({ period: "2026-09", carriedOver: false }, "septembre 2026", "septembre 2026")).toBeNull();
  });
});
