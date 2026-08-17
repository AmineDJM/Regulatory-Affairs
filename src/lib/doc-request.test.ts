import { describe, it, expect } from "vitest";
import {
  nextDocRequestStatus, canSubmit, canDecide, canCancel, isOutstanding, isLate, docRequestSummary,
} from "./doc-request";

const ASKER = "u-demandeur";
const ASKED = "u-detenteur";
const req = (status: string) => ({ askedById: ASKER, askedToId: ASKED, status });

describe("Le fil d'une demande de pièce", () => {
  it("le chemin normal : demandé → déposé → reçu", () => {
    expect(nextDocRequestStatus("PENDING", "SUBMIT")).toBe("SUBMITTED");
    expect(nextDocRequestStatus("SUBMITTED", "ACCEPT")).toBe("ACCEPTED");
  });

  it("un refus RELANCE la demande au lieu de la clore", () => {
    // C'est le cas le plus fréquent — « ce n'était pas la bonne pièce ». Obliger à recréer une
    // demande couperait le fil et l'on perdrait ce qui avait déjà été déposé.
    expect(nextDocRequestStatus("SUBMITTED", "DECLINE")).toBe("DECLINED");
    expect(nextDocRequestStatus("DECLINED", "SUBMIT")).toBe("SUBMITTED");
  });

  it("on ne dépose pas sur une demande déjà satisfaite", () => {
    // Sinon on ne saurait plus laquelle des pièces a servi à la décision.
    expect(nextDocRequestStatus("ACCEPTED", "SUBMIT")).toBeNull();
    expect(nextDocRequestStatus("ACCEPTED", "DECLINE")).toBeNull();
  });

  it("une demande annulée est close pour de bon", () => {
    for (const m of ["SUBMIT", "ACCEPT", "DECLINE", "CANCEL"] as const) {
      expect(nextDocRequestStatus("CANCELLED", m), m).toBeNull();
    }
  });

  it("on n'accepte pas ce qui n'a pas été déposé", () => {
    expect(nextDocRequestStatus("PENDING", "ACCEPT")).toBeNull();
    expect(nextDocRequestStatus("DECLINED", "ACCEPT")).toBeNull();
  });

  it("un statut inconnu ne fabrique pas de transition", () => {
    expect(nextDocRequestStatus("BIZARRE", "SUBMIT")).toBeNull();
  });
});

describe("Qui a le droit de faire quoi", () => {
  it("celui à qui l'on demande DÉPOSE", () => {
    expect(canSubmit(req("PENDING"), ASKED)).toBe(true);
    expect(canSubmit(req("DECLINED"), ASKED)).toBe(true);
  });

  it("celui qui a demandé ne dépose PAS à la place de l'autre", () => {
    expect(canSubmit(req("PENDING"), ASKER)).toBe(false);
  });

  it("celui qui a demandé TRANCHE", () => {
    expect(canDecide(req("SUBMITTED"), ASKER)).toBe(true);
  });

  it("on n'accepte JAMAIS sa propre pièce", () => {
    // La demande existe précisément pour qu'un tiers confirme avoir reçu ce qu'il attendait.
    expect(canDecide(req("SUBMITTED"), ASKED)).toBe(false);
  });

  it("un tiers ne peut rien", () => {
    expect(canSubmit(req("PENDING"), "quelqu-un-d-autre")).toBe(false);
    expect(canDecide(req("SUBMITTED"), "quelqu-un-d-autre")).toBe(false);
    expect(canCancel(req("PENDING"), "quelqu-un-d-autre")).toBe(false);
  });

  it("seul celui qui a demandé annule, et seulement tant que c'est ouvert", () => {
    expect(canCancel(req("PENDING"), ASKER)).toBe(true);
    expect(canCancel(req("SUBMITTED"), ASKER)).toBe(true);
    expect(canCancel(req("ACCEPTED"), ASKER)).toBe(false);
    expect(canCancel(req("PENDING"), ASKED)).toBe(false);
  });

  it("rien n'est possible sur une demande close", () => {
    for (const s of ["ACCEPTED", "CANCELLED"]) {
      expect(canSubmit(req(s), ASKED), s).toBe(false);
      expect(canDecide(req(s), ASKER), s).toBe(false);
    }
  });
});

describe("Ce qui bloque un dossier", () => {
  it("une demande vivante se compte, une demande close non", () => {
    expect(["PENDING", "SUBMITTED", "DECLINED"].every(isOutstanding)).toBe(true);
    expect(["ACCEPTED", "CANCELLED"].some(isOutstanding)).toBe(false);
  });

  it("le retard ne concerne que ce qui est encore attendu", () => {
    const past = "2026-01-01";
    expect(isLate({ status: "PENDING", dueDate: past }, new Date("2026-08-17"))).toBe(true);
    expect(isLate({ status: "DECLINED", dueDate: past }, new Date("2026-08-17"))).toBe(true);
    // Déjà déposé : la balle n'est plus dans son camp, ce n'est pas un retard de sa part.
    expect(isLate({ status: "SUBMITTED", dueDate: past }, new Date("2026-08-17"))).toBe(false);
    expect(isLate({ status: "ACCEPTED", dueDate: past }, new Date("2026-08-17"))).toBe(false);
  });

  it("sans échéance, pas de retard", () => {
    expect(isLate({ status: "PENDING", dueDate: null }, new Date("2026-08-17"))).toBe(false);
  });

  it("une échéance illisible n'invente pas d'alerte", () => {
    expect(isLate({ status: "PENDING", dueDate: "pas-une-date" }, new Date("2026-08-17"))).toBe(false);
  });
});

describe("Ce que l'écran dit, selon qui regarde", () => {
  it("le même statut ne se raconte pas pareil des deux côtés", () => {
    // L'un appelle une action, l'autre non. Une phrase unique obligerait chacun à traduire.
    expect(docRequestSummary(req("PENDING"), ASKED)).not.toBe(docRequestSummary(req("PENDING"), ASKER));
    expect(docRequestSummary(req("DECLINED"), ASKED)).toBe("À redéposer");
  });

  it("une pièce reçue se dit pareil pour tout le monde", () => {
    expect(docRequestSummary(req("ACCEPTED"), ASKED)).toBe(docRequestSummary(req("ACCEPTED"), ASKER));
  });

  it("un statut inconnu ne casse pas l'écran", () => {
    expect(docRequestSummary(req("???"), ASKER)).toBe("État inconnu");
  });
});
