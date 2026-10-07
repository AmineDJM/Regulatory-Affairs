import { describe, it, expect } from "vitest";
import {
  rangerTache, compterVues, compteOnglet, trierParEcheance, echeanceLisible, etatDemande, etatChezQui,
  nomCourt, deQui, lireVue, A_VERIFIER_JOURS, REFUS_VISIBLE_JOURS,
} from "./onglet-taches";
import { refusReattribution } from "./request-flow";

const NOW = new Date("2026-10-07T10:00:00Z");
const J = 86_400_000;
const ilYa = (j: number) => new Date(NOW.getTime() - j * J);
const dans = (j: number) => new Date(NOW.getTime() + j * J);

describe("rangerTache — une tâche, une seule place", () => {
  it("une demande qu'on ME fait attend ma réponse, en haut", () => {
    expect(rangerTache({ status: "REQUESTED", assignedToId: "moi", createdById: "chef", requestedAt: ilYa(1) }, "moi", NOW.getTime())).toBe("a-accepter");
  });

  it("À FAIRE : acceptée, ma to-do, ou créée par la plateforme (sans auteur)", () => {
    expect(rangerTache({ status: "IN_PROGRESS", assignedToId: "moi", createdById: "chef", requestedAt: ilYa(2) }, "moi")).toBe("a-faire");
    expect(rangerTache({ status: "TODO", assignedToId: "moi", createdById: "moi" }, "moi")).toBe("a-faire");
    expect(rangerTache({ status: "TODO", assignedToId: "moi", createdById: null }, "moi")).toBe("a-faire");
  });

  it("une tâche close chez moi n'est plus « à faire »", () => {
    expect(rangerTache({ status: "DONE", assignedToId: "moi", createdById: "moi" }, "moi")).toBeNull();
    expect(rangerTache({ status: "DECLINED", assignedToId: "moi", createdById: "chef" }, "moi")).toBeNull();
  });

  it("DEMANDÉES : ce que j'attends des autres — en attente, en cours, refusée récente, rendue récente", () => {
    const base = { createdById: "moi", assignedToId: "karim", requestedAt: ilYa(3) };
    expect(rangerTache({ ...base, status: "REQUESTED" }, "moi", NOW.getTime())).toBe("demandees");
    expect(rangerTache({ ...base, status: "IN_PROGRESS" }, "moi", NOW.getTime())).toBe("demandees");
    expect(rangerTache({ ...base, status: "DECLINED", respondedAt: ilYa(2) }, "moi", NOW.getTime())).toBe("demandees");
    expect(rangerTache({ ...base, status: "DECLINED", respondedAt: ilYa(REFUS_VISIBLE_JOURS + 1) }, "moi", NOW.getTime())).toBeNull();
    expect(rangerTache({ ...base, status: "DONE", completedAt: ilYa(1) }, "moi", NOW.getTime())).toBe("demandees");
    expect(rangerTache({ ...base, status: "DONE", completedAt: ilYa(A_VERIFIER_JOURS + 1) }, "moi", NOW.getTime())).toBeNull();
    expect(rangerTache({ ...base, status: "CANCELLED" }, "moi", NOW.getTime())).toBeNull();
  });

  it("PARTAGÉES : je participe ou je lis, sans en être le responsable ni l'auteur", () => {
    expect(rangerTache({ status: "TODO", assignedToId: "karim", createdById: "chef", participantIds: ["moi"] }, "moi")).toBe("partagees");
    expect(rangerTache({ status: "REQUESTED", assignedToId: "karim", createdById: "chef", readerIds: ["moi"] }, "moi")).toBe("partagees");
    expect(rangerTache({ status: "DONE", assignedToId: "karim", createdById: "chef", readerIds: ["moi"] }, "moi")).toBeNull();
  });

  it("le compteur de l'onglet = à accepter + à faire, pas ce que j'attends des autres", () => {
    const c = compterVues([
      { status: "REQUESTED", assignedToId: "moi", createdById: "chef" },
      { status: "TODO", assignedToId: "moi", createdById: "moi" },
      { status: "REQUESTED", assignedToId: "karim", createdById: "moi", requestedAt: ilYa(1) },
      { status: "TODO", assignedToId: "karim", createdById: "chef", participantIds: ["moi"] },
    ], "moi", NOW.getTime());
    expect(c).toEqual({ aAccepter: 1, aFaire: 1, demandees: 1, partagees: 1 });
    expect(compteOnglet(c)).toBe(2);
  });
});

describe("tri et échéance", () => {
  it("la plus proche d'abord, les tâches sans échéance à la fin, puis la priorité", () => {
    const l = trierParEcheance([
      { id: "sans", dueDate: null, priority: "HIGH" },
      { id: "loin", dueDate: dans(10), priority: "LOW" },
      { id: "proche-basse", dueDate: dans(1), priority: "LOW" },
      { id: "proche-haute", dueDate: dans(1), priority: "CRITICAL" },
    ]);
    expect(l.map((x) => x.id)).toEqual(["proche-haute", "proche-basse", "loin", "sans"]);
  });

  it("en retard → rouge, aujourd'hui → orange ; close, plus de couleur", () => {
    expect(echeanceLisible(ilYa(1), NOW)).toEqual({ texte: "hier", ton: "retard" });
    expect(echeanceLisible(NOW, NOW)).toEqual({ texte: "aujourd'hui", ton: "aujourdhui" });
    expect(echeanceLisible(dans(1), NOW)).toEqual({ texte: "demain", ton: null });
    expect(echeanceLisible(ilYa(1), NOW, true).ton).toBeNull();
    expect(echeanceLisible(null, NOW)).toEqual({ texte: "—", ton: null });
    expect(echeanceLisible(dans(30), NOW).texte).toMatch(/nov/);
  });
});

describe("etatDemande — où en est ce que j'ai demandé, et le seul geste utile", () => {
  const base = { createdById: "moi", assignedToId: "karim", requestedAt: ilYa(2) };
  it("pas encore acceptée → Relancer, avec l'ancienneté", () => {
    expect(etatDemande({ ...base, status: "REQUESTED" }, NOW)).toEqual({ libelle: "pas encore acceptée — 2 j", ton: "warning", geste: "relancer" });
  });
  it("en cours → rien, sauf en retard", () => {
    expect(etatDemande({ ...base, status: "IN_PROGRESS", dueDate: dans(3) }, NOW).geste).toBeNull();
    expect(etatDemande({ ...base, status: "IN_PROGRESS", dueDate: ilYa(1) }, NOW).geste).toBe("relancer");
  });
  it("rendue → Vérifier ; refusée → Réattribuer, avec le motif", () => {
    expect(etatDemande({ ...base, status: "DONE", completedAt: ilYa(1) }, NOW)).toEqual({ libelle: "à vérifier — rendu hier", ton: "success", geste: "verifier" });
    expect(etatDemande({ ...base, status: "DECLINED", declineReason: "pas mon secteur" }, NOW)).toEqual({ libelle: "refusée — « pas mon secteur »", ton: "danger", geste: "reattribuer" });
  });
});

describe("état — chez qui, et les noms", () => {
  it("la balle est chez le destinataire, puis revient au demandeur", () => {
    const t = { createdById: "moi", assignedToId: "k", requestedAt: ilYa(1) };
    expect(etatChezQui({ ...t, status: "REQUESTED" }, "moi", { assigne: "Karim Benali" })).toBe("à accepter — chez Karim B.");
    expect(etatChezQui({ ...t, status: "DONE" }, "moi", { createur: "Moi Même" })).toBe("rendue — chez moi");
    expect(etatChezQui({ ...t, status: "DECLINED" }, "k", { createur: "Sonia Hamidi" })).toBe("refusée — chez Sonia H.");
    expect(etatChezQui({ ...t, status: "CANCELLED" }, "moi", {})).toBe("annulée");
  });
  it("« De » : Automatique, moi, ou le nom court", () => {
    expect(deQui({ createdById: null }, "moi", null)).toBe("Automatique");
    expect(deQui({ createdById: "moi" }, "moi", "X")).toBe("moi");
    expect(deQui({ createdById: "b" }, "moi", "Brahim Rahmoune")).toBe("Brahim R.");
    expect(nomCourt("Leila")).toBe("Leila");
  });
  it("une vue inconnue retombe sur « À faire »", () => {
    expect(lireVue("demandees")).toBe("demandees");
    expect(lireVue("n'importe")).toBe("a-faire");
    expect(lireVue(undefined)).toBe("a-faire");
  });
});

describe("refusReattribution — seul le demandeur, une demande refusée ou sans réponse", () => {
  const t = { createdById: "moi", assignedToId: "karim", requestedAt: ilYa(1) };
  it("autorise le demandeur sur une demande refusée ou en attente", () => {
    expect(refusReattribution({ ...t, status: "DECLINED" }, "moi", "amel")).toBeNull();
    expect(refusReattribution({ ...t, status: "REQUESTED" }, "moi", "amel")).toBeNull();
  });
  it("refuse les autres cas, en le disant", () => {
    expect(refusReattribution({ ...t, status: "DECLINED" }, "karim", "amel")).toMatch(/Seule la personne/);
    expect(refusReattribution({ ...t, status: "IN_PROGRESS" }, "moi", "amel")).toMatch(/refusée/);
    expect(refusReattribution({ ...t, status: "DECLINED" }, "moi", "moi")).toMatch(/vous-même/);
    expect(refusReattribution({ ...t, status: "REQUESTED" }, "moi", "karim")).toMatch(/déjà/);
    expect(refusReattribution({ ...t, status: "DECLINED" }, "moi", null)).toMatch(/Choisissez/);
  });
});
