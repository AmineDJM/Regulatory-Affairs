import { describe, it, expect } from "vitest";
import {
  nextPaymentStatus, isWithFinance, isWithRequester, isClosed, tallyPieces, statusFromPieces,
  canApprove, canResubmit, needsReplacement, urgencyRank, deadlineLabel, isOverdue, sortByPriority,
} from "./payment-request";

const p = (status: string) => ({ status });
const URG = { URGENT: "Urgent", THIS_WEEK: "Cette semaine", THIS_MONTH: "Ce mois-ci", WHEN_POSSIBLE: "Dès que possible" };

describe("Le dossier fait des allers-retours, il ne se tranche pas une fois", () => {
  it("le chemin normal : brouillon → finances → instruction → bon à payer", () => {
    expect(nextPaymentStatus("DRAFT", "SUBMIT")).toBe("SUBMITTED");
    expect(nextPaymentStatus("SUBMITTED", "REVIEW")).toBe("UNDER_REVIEW");
    expect(nextPaymentStatus("UNDER_REVIEW", "APPROVE")).toBe("APPROVED");
  });

  it("renvoyé au demandeur, il repart sur LE MÊME dossier", () => {
    // Créer une seconde demande couperait le fil et perdrait l'historique des refus — celui
    // qu'on relit justement quand on se demande pourquoi ça a pris trois semaines.
    expect(nextPaymentStatus("UNDER_REVIEW", "REQUEST_CHANGES")).toBe("CHANGES_REQUESTED");
    expect(nextPaymentStatus("CHANGES_REQUESTED", "SUBMIT")).toBe("SUBMITTED");
  });

  it("« en attente » n'est PAS « refusée » — elle reprend", () => {
    expect(nextPaymentStatus("UNDER_REVIEW", "HOLD")).toBe("ON_HOLD");
    expect(nextPaymentStatus("ON_HOLD", "RESUME")).toBe("UNDER_REVIEW");
    expect(nextPaymentStatus("ON_HOLD", "APPROVE")).toBe("APPROVED");
  });

  it("les Finances peuvent trancher sans passer par l'instruction", () => {
    // Un dossier limpide n'a pas besoin d'un clic de cérémonie avant le bon à payer.
    expect(nextPaymentStatus("SUBMITTED", "APPROVE")).toBe("APPROVED");
    expect(nextPaymentStatus("SUBMITTED", "REJECT")).toBe("REJECTED");
  });

  it("un dossier clos ne rouvre pas", () => {
    for (const s of ["APPROVED", "REJECTED", "CANCELLED"]) {
      for (const m of ["SUBMIT", "REVIEW", "HOLD", "RESUME", "REQUEST_CHANGES", "APPROVE", "REJECT", "CANCEL"] as const) {
        expect(nextPaymentStatus(s, m), `${s}/${m}`).toBeNull();
      }
    }
  });

  it("on ne paie pas un brouillon que personne n'a reçu", () => {
    expect(nextPaymentStatus("DRAFT", "APPROVE")).toBeNull();
    expect(nextPaymentStatus("DRAFT", "REQUEST_CHANGES")).toBeNull();
  });

  it("un statut inconnu ne fabrique pas de transition", () => {
    expect(nextPaymentStatus("PEUT-ETRE", "APPROVE")).toBeNull();
  });

  it("chacun sait de quel côté est la balle", () => {
    expect(["SUBMITTED", "UNDER_REVIEW", "ON_HOLD"].every(isWithFinance)).toBe(true);
    expect(["DRAFT", "CHANGES_REQUESTED"].every(isWithRequester)).toBe(true);
    expect(isWithFinance("CHANGES_REQUESTED")).toBe(false);
    expect(isWithRequester("UNDER_REVIEW")).toBe(false);
    expect(["APPROVED", "REJECTED", "CANCELLED"].every(isClosed)).toBe(true);
  });
});

describe("Le verdict se donne pièce par pièce", () => {
  it("compte ce qui est acceptée, à revoir, refusée, en attente", () => {
    const t = tallyPieces([p("ACCEPTED"), p("ACCEPTED"), p("CHANGES_REQUESTED"), p("REJECTED"), p("PENDING")]);
    expect(t).toEqual({ total: 5, accepted: 2, toFix: 1, rejected: 1, pending: 1 });
  });

  it("un statut inconnu compte comme « en attente » plutôt que de disparaître", () => {
    expect(tallyPieces([p("BIZARRE")]).pending).toBe(1);
  });
});

describe("L'état du dossier se DÉDUIT de ses pièces", () => {
  it("une seule pièce à revoir renvoie le dossier au demandeur", () => {
    // Personne ne pense à changer le statut à la main en même temps qu'il refuse une facture.
    expect(statusFromPieces("UNDER_REVIEW", [p("ACCEPTED"), p("CHANGES_REQUESTED")])).toBe("CHANGES_REQUESTED");
    expect(statusFromPieces("UNDER_REVIEW", [p("REJECTED")])).toBe("CHANGES_REQUESTED");
  });

  it("ne répète pas un état déjà atteint", () => {
    expect(statusFromPieces("CHANGES_REQUESTED", [p("CHANGES_REQUESTED")])).toBeNull();
  });

  it("une fois tout corrigé, le dossier repart aux Finances de lui-même", () => {
    expect(statusFromPieces("CHANGES_REQUESTED", [p("ACCEPTED"), p("PENDING")])).toBe("SUBMITTED");
  });

  it("instruire pièce par pièce ne fait pas changer le dossier de camp à chaque clic", () => {
    expect(statusFromPieces("UNDER_REVIEW", [p("ACCEPTED"), p("PENDING")])).toBeNull();
  });

  it("un dossier clos n'est plus recalculé", () => {
    expect(statusFromPieces("APPROVED", [p("REJECTED")])).toBeNull();
  });
});

describe("Le bon à payer", () => {
  const req = { status: "UNDER_REVIEW", amount: 120_000 };

  it("s'autorise quand tout est en ordre", () => {
    expect(canApprove(req, [p("ACCEPTED"), p("ACCEPTED")])).toEqual({ ok: true });
  });

  it("JAMAIS sans justificatif — c'est ce que le dossier existe pour empêcher", () => {
    expect(canApprove(req, []).ok).toBe(false);
    expect(canApprove(req, []).reason).toContain("justificatif");
  });

  it("pas tant qu'une pièce est refusée ou à revoir", () => {
    expect(canApprove(req, [p("ACCEPTED"), p("REJECTED")]).ok).toBe(false);
    expect(canApprove(req, [p("ACCEPTED"), p("CHANGES_REQUESTED")]).ok).toBe(false);
  });

  it("pas tant qu'aucune pièce n'a été regardée", () => {
    expect(canApprove(req, [p("PENDING")]).ok).toBe(false);
  });

  it("pas sans montant", () => {
    expect(canApprove({ status: "UNDER_REVIEW", amount: null }, [p("ACCEPTED")]).ok).toBe(false);
    expect(canApprove({ status: "UNDER_REVIEW", amount: 0 }, [p("ACCEPTED")]).ok).toBe(false);
  });

  it("donne toujours un MOTIF lisible, jamais un bouton muet", () => {
    for (const c of [canApprove(req, []), canApprove(req, [p("REJECTED")]), canApprove({ status: "APPROVED", amount: 1 }, [p("ACCEPTED")])]) {
      expect(c.ok).toBe(false);
      expect((c.reason ?? "").length).toBeGreaterThan(10);
    }
  });
});

describe("Renvoyer le dossier corrigé", () => {
  it("possible quand tout ce qui était en cause a été repris", () => {
    expect(canResubmit({ status: "CHANGES_REQUESTED" }, [p("ACCEPTED"), p("PENDING")])).toEqual({ ok: true });
  });

  it("impossible tant qu'une pièce reste à corriger", () => {
    expect(canResubmit({ status: "CHANGES_REQUESTED" }, [p("CHANGES_REQUESTED")]).ok).toBe(false);
    expect(canResubmit({ status: "CHANGES_REQUESTED" }, [p("REJECTED")]).ok).toBe(false);
  });

  it("impossible sans aucune pièce", () => {
    expect(canResubmit({ status: "DRAFT" }, []).ok).toBe(false);
  });

  it("impossible quand le dossier est chez les Finances", () => {
    expect(canResubmit({ status: "UNDER_REVIEW" }, [p("ACCEPTED")]).ok).toBe(false);
  });

  it("seule une pièce en cause se remplace", () => {
    expect(needsReplacement("CHANGES_REQUESTED")).toBe(true);
    expect(needsReplacement("REJECTED")).toBe(true);
    expect(needsReplacement("ACCEPTED")).toBe(false);
    expect(needsReplacement("PENDING")).toBe(false);
  });
});

describe("La date, sinon l'urgence", () => {
  it("une demande sans date n'est pas une demande sans priorité", () => {
    // Sans cette phrase, la colonne reste vide et le dossier finit au bas de la pile.
    expect(deadlineLabel({ dueDate: null, urgency: "URGENT" }, URG)).toBe("Urgent");
    expect(deadlineLabel({ dueDate: null, urgency: "WHEN_POSSIBLE" }, URG)).toBe("Dès que possible");
  });

  it("la date convenue l'emporte sur l'urgence déclarée", () => {
    expect(deadlineLabel({ dueDate: "2026-09-01", urgency: "URGENT" }, URG)).toBe("01/09/2026");
  });

  it("une date illisible retombe sur l'urgence au lieu d'afficher n'importe quoi", () => {
    expect(deadlineLabel({ dueDate: "pas-une-date", urgency: "THIS_WEEK" }, URG)).toBe("Cette semaine");
  });

  it("l'urgence se classe du plus pressé au moins pressé", () => {
    expect(urgencyRank("URGENT")).toBeLessThan(urgencyRank("THIS_WEEK"));
    expect(urgencyRank("THIS_WEEK")).toBeLessThan(urgencyRank("THIS_MONTH"));
    expect(urgencyRank("THIS_MONTH")).toBeLessThan(urgencyRank("WHEN_POSSIBLE"));
    expect(urgencyRank("INCONNU")).toBe(urgencyRank("WHEN_POSSIBLE"));
  });

  it("le retard ne concerne que les dossiers encore ouverts", () => {
    const now = new Date("2026-08-17");
    expect(isOverdue({ status: "UNDER_REVIEW", dueDate: "2026-08-01" }, now)).toBe(true);
    expect(isOverdue({ status: "APPROVED", dueDate: "2026-08-01" }, now)).toBe(false);
    expect(isOverdue({ status: "UNDER_REVIEW", dueDate: null }, now)).toBe(false);
  });
});

describe("La file des Finances : ce qui presse d'abord", () => {
  const now = new Date("2026-08-17");
  const rows = [
    { id: "ancien-tranquille", status: "SUBMITTED", dueDate: null, urgency: "WHEN_POSSIBLE", createdAt: "2026-01-01" },
    { id: "urgent-sans-date", status: "SUBMITTED", dueDate: null, urgency: "URGENT", createdAt: "2026-08-16" },
    { id: "en-retard", status: "SUBMITTED", dueDate: "2026-08-01", urgency: "WHEN_POSSIBLE", createdAt: "2026-08-10" },
    { id: "echeance-proche", status: "SUBMITTED", dueDate: "2026-08-20", urgency: "WHEN_POSSIBLE", createdAt: "2026-02-01" },
  ];

  it("le retard passe devant tout", () => {
    expect(sortByPriority(rows, now)[0].id).toBe("en-retard");
  });

  it("puis les échéances convenues, puis l'urgence déclarée", () => {
    const ids = sortByPriority(rows, now).map((r) => r.id);
    expect(ids).toEqual(["en-retard", "echeance-proche", "urgent-sans-date", "ancien-tranquille"]);
  });

  it("ne modifie pas la liste reçue", () => {
    const copy = rows.map((r) => r.id);
    sortByPriority(rows, now);
    expect(rows.map((r) => r.id)).toEqual(copy);
  });
});
