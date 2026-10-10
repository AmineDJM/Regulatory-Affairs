import { describe, expect, it } from "vitest";
import { SEUIL_BESOIN_JOURS, etatDuBesoin, lireDateBesoin, materielLivre } from "./date-besoin";

const auj = new Date("2026-10-10T09:00:00Z");

describe("la date de besoin d'une demande de matériel", () => {
  it("se lit depuis un champ date, vide = pas de date, passé ou illisible = refus", () => {
    expect(lireDateBesoin("", auj)).toEqual({ ok: true, date: null });
    expect(lireDateBesoin(undefined, auj)).toEqual({ ok: true, date: null });
    const ok = lireDateBesoin("2026-11-12", auj);
    expect(ok.ok && ok.date?.toISOString().slice(0, 10)).toBe("2026-11-12");
    expect(lireDateBesoin("2026-10-10", auj).ok).toBe(true); // aujourd'hui reste permis
    expect(lireDateBesoin("2026-10-09", auj)).toMatchObject({ ok: false });
    expect(lireDateBesoin("12/11/2026", auj)).toMatchObject({ ok: false });
    expect(lireDateBesoin("2026-02-31", auj)).toMatchObject({ ok: false });
    expect(lireDateBesoin("2031-01-01", auj)).toMatchObject({ ok: false });
  });

  it("passe en orange sous 15 jours tant que le matériel n'est pas livré", () => {
    expect(SEUIL_BESOIN_JOURS).toBe(15);
    expect(etatDuBesoin("2026-10-24T12:00:00Z", false, auj)).toMatchObject({ jours: 14, alerte: true, echeance: "dans 14 j" });
    expect(etatDuBesoin("2026-10-25T12:00:00Z", false, auj)).toMatchObject({ jours: 15, alerte: false });
    expect(etatDuBesoin("2026-10-11T12:00:00Z", false, auj)?.echeance).toBe("demain");
    expect(etatDuBesoin("2026-10-10T12:00:00Z", false, auj)?.echeance).toBe("aujourd'hui");
    expect(etatDuBesoin("2026-10-07T12:00:00Z", false, auj)).toMatchObject({ jours: -3, alerte: true, echeance: "dépassée de 3 j" });
  });

  it("une demande livrée n'alerte jamais ; sans date, pas d'état", () => {
    expect(etatDuBesoin("2026-10-12T12:00:00Z", true, auj)?.alerte).toBe(false);
    expect(etatDuBesoin(null, false, auj)).toBeNull();
  });

  it("livré : dossier terminé, refusé, annulé, ou toutes les lignes reçues ; l'ancien parcours par son statut", () => {
    expect(materielLivre({ circuitState: "COMPLETED", status: "PROSPECTION_REQUESTED", etatsLignes: [] })).toBe(true);
    expect(materielLivre({ circuitState: "REFUSED", status: "PROSPECTION_REQUESTED", etatsLignes: [] })).toBe(true);
    expect(materielLivre({ circuitState: "IN_EXECUTION", status: "CANCELLED", etatsLignes: [] })).toBe(true);
    expect(materielLivre({ circuitState: "IN_EXECUTION", status: "PROSPECTION_REQUESTED", etatsLignes: [] })).toBe(false);
    expect(materielLivre({ circuitState: "IN_EXECUTION", status: "PROSPECTION_REQUESTED", etatsLignes: ["RECUE", "EN_ATTENTE"] })).toBe(false);
    expect(materielLivre({ circuitState: "IN_EXECUTION", status: "PROSPECTION_REQUESTED", etatsLignes: ["RECUE", "NON_LIVREE", "RELIQUAT_RENONCE"] })).toBe(true);
    expect(materielLivre({ circuitState: null, status: "FINAL_MATERIAL", etatsLignes: [] })).toBe(true);
    expect(materielLivre({ circuitState: null, status: "QUOTES_UPLOADED", etatsLignes: [] })).toBe(false);
  });
});
