import { describe, it, expect } from "vitest";
import {
  isRequest, awaitingResponse, canRespond, canDoWork, canSee, canAttach,
  taskActions, requestStage, declineSummary, submitLabel, ACCEPTED_STATUS,
} from "./request-flow";

const REQ = { requestedAt: new Date("2026-08-01"), createdById: "chef", assignedToId: "amine" };

describe("isRequest — distinguer une demande d'une tâche qu'on s'est donnée", () => {
  it("une tâche portant une date de demande en est une, quel que soit son statut", () => {
    expect(isRequest({ ...REQ, status: "IN_PROGRESS" })).toBe(true);
    expect(isRequest({ ...REQ, status: "DONE" })).toBe(true);
  });

  // Les demandes créées AVANT ce champ n'ont pas de `requestedAt` : leur statut suffit à les
  // reconnaître, sinon elles retomberaient dans le parcours des tâches ordinaires.
  it("le statut REQUESTED / DECLINED suffit, pour les demandes d'avant", () => {
    expect(isRequest({ status: "REQUESTED" })).toBe(true);
    expect(isRequest({ status: "DECLINED" })).toBe(true);
  });

  it("une tâche ordinaire n'en est pas une", () => {
    expect(isRequest({ status: "TODO", assignedToId: "amine", createdById: "amine" })).toBe(false);
  });
});

describe("canRespond — seul le destinataire accepte ou refuse", () => {
  const pending = { ...REQ, status: "REQUESTED" };

  it("le destinataire répond", () => {
    expect(canRespond(pending, "amine")).toBe(true);
  });

  // Accepter à la place de quelqu'un, c'est lui attribuer un engagement qu'il n'a pas pris.
  it("ni le demandeur, ni un tiers", () => {
    expect(canRespond(pending, "chef")).toBe(false);
    expect(canRespond(pending, "autre")).toBe(false);
  });

  it("on ne répond pas deux fois", () => {
    expect(canRespond({ ...REQ, status: "IN_PROGRESS" }, "amine")).toBe(false);
    expect(canRespond({ ...REQ, status: "DECLINED" }, "amine")).toBe(false);
  });
});

describe("canDoWork — qui fait et valide le travail", () => {
  it("le responsable et les participants", () => {
    const t = { ...REQ, status: "IN_PROGRESS", participantIds: ["nadia"] };
    expect(canDoWork(t, "amine")).toBe(true);
    expect(canDoWork(t, "nadia")).toBe(true);
  });

  // Valider le travail d'autrui reviendrait à signer à sa place.
  it("ni le demandeur, ni un simple lecteur", () => {
    const t = { ...REQ, status: "IN_PROGRESS", readerIds: ["direction"] };
    expect(canDoWork(t, "chef")).toBe(false);
    expect(canDoWork(t, "direction")).toBe(false);
  });

  it("rien à faire tant que la demande n'est pas acceptée, ni après un refus", () => {
    expect(canDoWork({ ...REQ, status: "REQUESTED" }, "amine")).toBe(false);
    expect(canDoWork({ ...REQ, status: "DECLINED" }, "amine")).toBe(false);
    expect(canDoWork({ ...REQ, status: "CANCELLED" }, "amine")).toBe(false);
  });

  it("le travail reste modifiable après validation", () => {
    expect(canDoWork({ ...REQ, status: "DONE" }, "amine")).toBe(true);
  });
});

describe("canSee / canAttach — le cercle de la demande", () => {
  const t = { ...REQ, status: "IN_PROGRESS", participantIds: ["nadia"], readerIds: ["direction"] };

  it("les quatre rôles du cercle voient", () => {
    for (const id of ["amine", "chef", "nadia", "direction"]) expect(canSee(t, id), id).toBe(true);
  });

  it("personne d'autre — une demande n'est pas publique parce qu'on a le module", () => {
    expect(canSee(t, "inconnu")).toBe(false);
  });

  it("la direction générale voit tout", () => {
    expect(canSee(t, "inconnu", true)).toBe(true);
  });

  it("le demandeur peut joindre une pièce : il complète SA demande", () => {
    expect(canAttach(t, "chef")).toBe(true);
    expect(canAttach(t, "direction")).toBe(false);
  });
});

describe("taskActions — ce qui est proposé, et surtout ce qui ne l'est plus", () => {
  // LE POINT DE LA DEMANDE : une fois acceptée, on entre et on travaille. Rien d'autre.
  it("une demande acceptée ne propose JAMAIS « Démarrer » ni « Projet »", () => {
    const accepted = { ...REQ, status: ACCEPTED_STATUS };
    const actions = taskActions(accepted, "amine", { canCreateDossier: true });
    expect(actions).not.toContain("start");
    expect(actions).not.toContain("dossier");
    expect(actions).not.toContain("complete");
    expect(actions).toEqual(["open"]);
  });

  it("une demande en attente propose d'accepter / refuser, au seul destinataire", () => {
    const pending = { ...REQ, status: "REQUESTED" };
    expect(taskActions(pending, "amine")).toContain("respond");
    expect(taskActions(pending, "chef")).not.toContain("respond");
    // Le demandeur peut quand même ouvrir : c'est sa demande.
    expect(taskActions(pending, "chef")).toEqual(["open"]);
  });

  it("une demande refusée s'ouvre encore — c'est là qu'on lit le motif", () => {
    expect(taskActions({ ...REQ, status: "DECLINED" }, "chef")).toEqual(["open"]);
  });

  it("une tâche ORDINAIRE garde son parcours : démarrer, terminer, ouvrir un projet", () => {
    const todo = { status: "TODO", assignedToId: "amine", createdById: "amine" };
    expect(taskActions(todo, "amine", { canCreateDossier: true })).toEqual(["start", "complete", "dossier"]);
  });

  it("une tâche terminée ne propose plus de la terminer", () => {
    const done = { status: "DONE", assignedToId: "amine", createdById: "amine" };
    expect(taskActions(done, "amine")).toEqual([]);
  });

  it("en lecture seule, aucun bouton", () => {
    expect(taskActions({ ...REQ, status: "REQUESTED" }, "amine", { readOnly: true })).toEqual([]);
  });

  it("une tâche qui ne me concerne pas ne me propose rien", () => {
    expect(taskActions({ status: "TODO", assignedToId: "x", createdById: "y" }, "moi")).toEqual([]);
  });
});

describe("requestStage — où en est la demande, dit à l'oral", () => {
  it("couvre chaque étape", () => {
    expect(requestStage({ ...REQ, status: "REQUESTED" })).toBe("En attente de réponse");
    expect(requestStage({ ...REQ, status: "DECLINED" })).toBe("Refusée");
    expect(requestStage({ ...REQ, status: "IN_PROGRESS" })).toBe("Acceptée — en cours");
    expect(requestStage({ ...REQ, status: "DONE" })).toBe("Travail validé");
  });
});

describe("declineSummary — le motif est facultatif, et l'absence se dit", () => {
  it("reprend le motif quand il y en a un", () => {
    expect(declineSummary("Je suis en congé la semaine prochaine")).toContain("congé");
  });

  // Sans cette phrase, le demandeur voit un refus muet et rappelle pour demander pourquoi.
  it("dit explicitement qu'il n'y en a pas, plutôt que de laisser un vide", () => {
    expect(declineSummary(null)).toBe("Refusée, sans motif précisé.");
    expect(declineSummary("   ")).toBe("Refusée, sans motif précisé.");
  });
});

describe("submitLabel — on valide une fois, ensuite on met à jour", () => {
  it("change après la première validation", () => {
    expect(submitLabel({ ...REQ, status: "IN_PROGRESS" })).toBe("Valider mon travail");
    expect(submitLabel({ ...REQ, status: "DONE" })).toBe("Mettre à jour mon travail");
  });
});
