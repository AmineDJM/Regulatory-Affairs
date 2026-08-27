import { describe, expect, it } from "vitest";
import {
  evidenceSentence, expectationOf, inferExpectation, matchEvent, matchEventToTask,
  type BusinessEventLike, type TaskLike,
} from "./evidence";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CAS RÉEL, GELÉ.
 *
 * Tâche : « Déposer le contrat de la nouvelle consultante médicale dans Ad&Pro > Consulting »,
 * échéance 23/08, jamais cochée. Yacine avait déposé le contrat. Adam a annoncé « en retard ».
 *
 * Ce que ces épreuves défendent : le rapprochement est un CALCUL, pas une opinion du modèle —
 * et il INSCRIT une preuve sans jamais clore une tâche sur une ressemblance de mots.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const LE_JOUR = new Date("2026-08-01T09:00:00Z");
const PLUS_TARD = new Date("2026-08-22T14:30:00Z");

const tache = (over: Partial<TaskLike> = {}): TaskLike => ({
  id: "t1",
  title: "Déposer le contrat de la nouvelle consultante médicale dans Ad&Pro > Consulting",
  description: null,
  status: "TODO",
  assignedToId: "yacine",
  createdAt: LE_JOUR,
  ...over,
});

const evenement = (over: Partial<BusinessEventLike> = {}): BusinessEventLike => ({
  type: "CONTRACT_SIGNED",
  occurredAt: PLUS_TARD,
  sourceDomain: "ADPRO_CONSULTING",
  entityType: "CONSULTING_CONTRACT",
  entityId: "c-42",
  actorId: "yacine",
  ...over,
});

describe("ce qu'une tâche en texte libre ATTEND", () => {
  it("reconnaît le geste, l'objet et la destination — le cas Yacine", () => {
    const a = inferExpectation(tache().title);
    expect(a).not.toBeNull();
    expect(a?.event).toBe("CONTRACT_SIGNED");
    expect(a?.domain).toBe("ADPRO_CONSULTING");
    expect(a?.confidence).toBe("strong");
  });

  it("reste `weak` quand la destination n'est pas nommée", () => {
    // « Dépose le contrat » sans dire où ne peut pas être rapproché sans risquer l'homonyme.
    expect(inferExpectation("Déposer le contrat")?.confidence).toBe("weak");
  });

  it("ne déduit RIEN d'une tâche sans geste observable — le comportement normal", () => {
    // La majorité des tâches sont ainsi. Leur inventer une attente produirait des
    // rapprochements faux : le défaut qu'on corrige, retourné.
    for (const t of ["Rappeler Karim", "Préparer la réunion de lundi", "Relire le budget", "Appeler l'ANPP"]) {
      expect(inferExpectation(t), t).toBeNull();
    }
  });

  it("« préparer » n'est pas « déposer » — un verbe sans événement observable ne compte pas", () => {
    expect(inferExpectation("Préparer le contrat de la consultante")).toBeNull();
  });

  it("une attente DÉCLARÉE l'emporte sur la déduction", () => {
    const a = expectationOf(tache({ expectedEvent: "DOCUMENT_UPLOADED" }));
    expect(a?.event).toBe("DOCUMENT_UPLOADED");
    expect(a?.confidence).toBe("declared");
  });

  it("un `expectedEvent` inconnu est IGNORÉ, pas cru sur parole", () => {
    const a = expectationOf(tache({ expectedEvent: "N_IMPORTE_QUOI" }));
    expect(a?.confidence).toBe("strong"); // retombe sur la déduction du texte
  });
});

describe("le rapprochement événement → tâche", () => {
  it("LE CAS RÉEL : la preuve est inscrite, la tâche n'est PAS close", () => {
    const m = matchEventToTask(evenement(), tache());
    expect(m).not.toBeNull();
    expect(m?.confidence).toBe("strong");
    // La ligne qui empêche d'effacer une vraie tâche sur une ressemblance de mots.
    expect(m?.autoComplete).toBe(false);
  });

  it("une attente DÉCLARÉE sur la BONNE entité clôt automatiquement", () => {
    const m = matchEventToTask(evenement(), tache({
      expectedEvent: "CONTRACT_SIGNED",
      relatedEntityType: "CONSULTING_CONTRACT",
      relatedEntityId: "c-42",
    }));
    expect(m?.autoComplete).toBe(true);
    expect(m?.confidence).toBe("declared");
  });

  it("une attente déclarée sur une AUTRE entité ne rapproche rien", () => {
    const m = matchEventToTask(evenement(), tache({
      expectedEvent: "CONTRACT_SIGNED",
      relatedEntityType: "CONSULTING_CONTRACT",
      relatedEntityId: "c-99",
    }));
    expect(m).toBeNull();
  });

  it("un événement ANTÉRIEUR à la tâche ne la satisfait pas", () => {
    // Le piège central : un contrat déposé la veille de la demande ne répond pas à la demande.
    // Sans cette règle, la première tâche créée serait close par n'importe quel dépôt passé.
    const m = matchEventToTask(evenement({ occurredAt: new Date("2026-07-15T10:00:00Z") }), tache());
    expect(m).toBeNull();
  });

  it("un événement d'un AUTRE domaine ne satisfait pas une attente située", () => {
    const m = matchEventToTask(evenement({ sourceDomain: "REGULATORY" }), tache());
    expect(m).toBeNull();
  });

  it("une tâche DÉJÀ close n'a plus rien à prouver", () => {
    expect(matchEventToTask(evenement(), tache({ status: "DONE" }))).toBeNull();
    expect(matchEventToTask(evenement(), tache({ status: "CANCELLED" }))).toBeNull();
  });

  it("un type d'événement différent ne rapproche rien", () => {
    expect(matchEventToTask(evenement({ type: "PAYMENT_RECEIVED" }), tache())).toBeNull();
  });

  it("sur un lot, seules les tâches concernées ressortent", () => {
    const lot = [
      tache({ id: "a" }),
      tache({ id: "b", title: "Rappeler Karim" }),
      tache({ id: "c", status: "DONE" }),
      tache({ id: "d", title: "Déposer la facture dans Finances" }),
    ];
    const trouves = matchEvent(evenement(), lot).map((m) => m.taskId);
    expect(trouves).toEqual(["a"]);
  });
});

describe("ce qu'Adam doit dire", () => {
  it("dit les DEUX vérités : le statut ET la preuve", () => {
    const p = evidenceSentence({
      title: "Déposer le contrat de la nouvelle consultante médicale dans Ad&Pro > Consulting",
      evidenceAt: PLUS_TARD,
      actorName: "Yacine Habes",
      what: "dépôt du contrat",
    });
    expect(p).toContain("toujours marquée à faire");
    expect(p).toContain("Yacine Habes");
    expect(p).toContain("22/08/2026");
    // Ce qu'elle ne doit JAMAIS dire : que la tâche est faite.
    expect(p).not.toMatch(/\bterminée\b|\bc'est fait\b/i);
  });
});
