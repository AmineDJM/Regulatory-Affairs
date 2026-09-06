import { describe, expect, it } from "vitest";
import { compterParGenre, delaiHumain, estGesteValide, ordonner, recommanderAccord, recommanderEngagement, urgenceDe, type CarteInbox } from "@/lib/assistant/inbox/model";

const NOW = new Date("2026-09-05T10:00:00Z");
const iso = (jours: number) => new Date(NOW.getTime() + jours * 86_400_000).toISOString();

function carte(p: Partial<CarteInbox> & { id: string }): CarteInbox {
  return {
    genre: "REVIEW", sujet: p.id, contexte: "", raison: "", echeance: null, urgence: "BASSE", impact: null, recommandation: null,
    options: [], source: { module: "x", libelle: "x", href: "/x" }, depuis: iso(-1), ...p,
  };
}

describe("l'urgence — calculée par des règles écrites", () => {
  it("une échéance dépassée est CRITIQUE, à moins d'un jour HAUTE, à trois jours NORMALE", () => {
    expect(urgenceDe({ genre: "APPROVE", echeance: iso(-0.5) }, NOW)).toBe("CRITIQUE");
    expect(urgenceDe({ genre: "APPROVE", echeance: iso(0.5) }, NOW)).toBe("HAUTE");
    expect(urgenceDe({ genre: "REVIEW", echeance: iso(2) }, NOW)).toBe("NORMALE");
    expect(urgenceDe({ genre: "REVIEW", echeance: iso(10) }, NOW)).toBe("BASSE");
  });
  it("le niveau d'une mission et le montant relèvent l'urgence, sans jamais l'abaisser", () => {
    expect(urgenceDe({ genre: "APPROVE", niveau: "CRITICAL" }, NOW)).toBe("CRITIQUE");
    expect(urgenceDe({ genre: "APPROVE", niveau: "SENSITIVE" }, NOW)).toBe("HAUTE");
    expect(urgenceDe({ genre: "APPROVE", montant: 12_000_000 }, NOW)).toBe("HAUTE");
    expect(urgenceDe({ genre: "APPROVE", montant: 2_000_000 }, NOW)).toBe("NORMALE");
    // Un montant modeste n'abaisse pas une échéance dépassée.
    expect(urgenceDe({ genre: "APPROVE", montant: 1_000, echeance: iso(-2) }, NOW)).toBe("CRITIQUE");
  });
  it("une information sans échéance reste BASSE ; une validation qui bloque quelqu'un est au moins NORMALE", () => {
    expect(urgenceDe({ genre: "FYI" }, NOW)).toBe("BASSE");
    expect(urgenceDe({ genre: "REVIEW", bloqueQuelquun: true }, NOW)).toBe("NORMALE");
  });
  it("le délai se lit en français", () => {
    expect(delaiHumain(iso(-3.2), NOW)).toBe("en retard de 3 j");
    expect(delaiHumain(iso(0.4), NOW)).toBe("aujourd'hui");
    expect(delaiHumain(iso(1.5), NOW)).toBe("demain");
    expect(delaiHumain(iso(4.9), NOW)).toBe("dans 4 j");
    expect(delaiHumain(null, NOW)).toBeNull();
  });
});

describe("l'ordre — l'urgence d'abord, ce qui bloque ensuite, puis le retard et l'ancienneté", () => {
  it("une validation critique passe devant un engagement critique, qui passe devant une information", () => {
    const cartes = [
      carte({ id: "fyi", genre: "FYI", urgence: "BASSE" }),
      carte({ id: "engagement", genre: "REVIEW", urgence: "CRITIQUE", echeance: iso(-3) }),
      carte({ id: "validation", genre: "APPROVE", urgence: "CRITIQUE", echeance: iso(-1) }),
      carte({ id: "mission", genre: "CHOOSE", urgence: "HAUTE" }),
    ];
    expect(ordonner(cartes, NOW).map((c) => c.id)).toEqual(["validation", "engagement", "mission", "fyi"]);
  });
  it("à égalité, la plus ancienne remonte, et l'ordre est stable", () => {
    const a = carte({ id: "a", genre: "APPROVE", urgence: "NORMALE", depuis: iso(-2) });
    const b = carte({ id: "b", genre: "APPROVE", urgence: "NORMALE", depuis: iso(-0.1) });
    expect(ordonner([b, a], NOW).map((c) => c.id)).toEqual(["a", "b"]);
    expect(ordonner([a, b], NOW).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("compte par genre", () => {
    expect(compterParGenre([carte({ id: "1", genre: "APPROVE" }), carte({ id: "2", genre: "APPROVE" }), carte({ id: "3", genre: "FYI" })])).toEqual({ APPROVE: 2, REJECT: 0, CHOOSE: 0, REVIEW: 0, FYI: 1 });
  });
});

describe("la recommandation — seulement quand une règle la justifie, et elle dit laquelle", () => {
  it("un accord de mission de niveau NORMAL est recommandé ; SENSITIVE et CRITICAL ne le sont pas", () => {
    expect(recommanderAccord("NORMAL", 3)?.optionId).toBe("accorder");
    expect(recommanderAccord("NORMAL", 3)?.pourquoi).toMatch(/3 étape/);
    expect(recommanderAccord("SENSITIVE", 3)).toBeNull();
    expect(recommanderAccord("CRITICAL", 1)).toBeNull();
  });
  it("un engagement en retard recommande la relance, un engagement à l'heure rien", () => {
    expect(recommanderEngagement(4)?.optionId).toBe("relancer");
    expect(recommanderEngagement(0)).toBeNull();
  });
});

describe("le geste reçu du navigateur est vérifié avant d'être dispatché", () => {
  it("accepte les formes connues et refuse le reste", () => {
    expect(estGesteValide({ kind: "validation.decide", stepId: "s1", decision: "APPROVED" })).toBe(true);
    expect(estGesteValide({ kind: "validation.decide", stepId: "s1", decision: "YES" })).toBe(false);
    expect(estGesteValide({ kind: "mission.accord", approvalId: "a", decision: "GRANTED" })).toBe(true);
    expect(estGesteValide({ kind: "ouvrir", href: "https://ailleurs.example" })).toBe(false);
    expect(estGesteValide({ kind: "ouvrir", href: "/validations" })).toBe(true);
    expect(estGesteValide({ kind: "supprimer_tout" })).toBe(false);
    expect(estGesteValide(null)).toBe(false);
  });
});
