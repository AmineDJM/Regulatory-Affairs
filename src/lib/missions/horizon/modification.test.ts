import { describe, expect, it } from "vitest";
import {
  empreinteDeLaModification, motsUtiles, type NoeudModifiable,
} from "@/lib/missions/horizon/modification";

/**
 * LE GRAPHE DU BANC : trois demandes en parallèle, une consolidation, DEUX livrables qui en
 * descendent, un envoi qui les porte tous les deux. C'est la forme exacte de la chaîne humaine
 * — celle où « annule uniquement le PPT » doit épargner le classeur.
 */
const n = (key: string, p: Partial<NoeudModifiable> = {}): NoeudModifiable => ({
  key, titre: key, nodeType: "CAPABILITY", status: "PENDING",
  milestoneOrdre: 1, dependsOn: [], texte: "", aEuUnEffet: false, ...p,
});

const GRAPHE: NoeudModifiable[] = [
  n("demander-deepak", { titre: "Demander le prix de cession à Deepak Sharma", texte: "recipientName Deepak Sharma", aEuUnEffet: true, status: "DONE" }),
  n("attendre-deepak", { titre: "Attendre la réponse de Deepak Sharma", nodeType: "WAIT_INPUT", dependsOn: ["demander-deepak"], status: "WAITING" }),
  n("demander-khaled", { titre: "Demander le volume à Khaled Mansouri", texte: "recipientName Khaled Mansouri", aEuUnEffet: true, status: "DONE" }),
  n("attendre-khaled", { titre: "Attendre la réponse de Khaled Mansouri", nodeType: "WAIT_INPUT", dependsOn: ["demander-khaled"], status: "DONE" }),
  n("consolider", { titre: "Consolider les réponses", milestoneOrdre: 2, dependsOn: ["attendre-deepak", "attendre-khaled"] }),
  n("excel", { titre: "Produire le classeur Excel de consolidation", nodeType: "ARTIFACT", milestoneOrdre: 3, dependsOn: ["consolider"] }),
  n("ppt", { titre: "Produire le PowerPoint de synthèse", nodeType: "ARTIFACT", milestoneOrdre: 3, dependsOn: ["consolider"] }),
  n("envoyer", { titre: "Envoyer les deux pièces au dirigeant", milestoneOrdre: 4, dependsOn: ["excel", "ppt"] }),
];

describe("les mots qui désignent", () => {
  it("écarte les mots vides — sinon « le PowerPoint » toucherait toute la mission", () => {
    expect(motsUtiles("finalement le PowerPoint")).toEqual(["powerpoint"]);
    expect(motsUtiles("uniquement la synthèse")).toEqual(["synthese"]);
  });

  it("une cible faite uniquement de mots vides ne désigne RIEN", () => {
    expect(motsUtiles("le la les")).toEqual([]);
  });
});

describe("remplacer une personne", () => {
  it("touche la demande, l'attente et tout ce qui la lit — jamais l'autre collecte", () => {
    const e = empreinteDeLaModification(
      { genre: "REMPLACER", cible: "Deepak", remplacant: "Amel Bouzid" }, GRAPHE);
    expect(e.reconnue).toBe(true);
    expect(e.visees).toEqual(["demander-deepak", "attendre-deepak"]);
    expect(e.aRecompiler).toContain("consolider");
    expect(e.aRecompiler).toContain("excel");
    expect(e.aRecompiler).not.toContain("demander-khaled");
    expect(e.aRecompiler).not.toContain("attendre-khaled");
    expect(e.preservees).toContain("demander-khaled");
  });

  it("NOMME ce qui est déjà parti — « Amel à la place de Deepak » ne dé-envoie pas le message", () => {
    const e = empreinteDeLaModification(
      { genre: "REMPLACER", cible: "Deepak", remplacant: "Amel" }, GRAPHE);
    expect(e.effetsIrreversibles).toEqual(["demander-deepak"]);
    expect(e.resume).toContain("DÉJÀ produit leur effet");
  });

  it("ne rouvre que les jalons touchés", () => {
    const e = empreinteDeLaModification({ genre: "REMPLACER", cible: "Deepak" }, GRAPHE);
    expect(e.jalonsTouches).toEqual([1, 2, 3, 4]);
    const e2 = empreinteDeLaModification({ genre: "RETIRER", cible: "PowerPoint" }, GRAPHE);
    expect(e2.jalonsTouches).toEqual([3]);
  });
});

describe("retirer un livrable", () => {
  it("« annule uniquement le PowerPoint » n'emporte PAS le classeur", () => {
    const e = empreinteDeLaModification({ genre: "RETIRER", cible: "le PowerPoint" }, GRAPHE);
    expect(e.visees).toEqual(["ppt"]);
    expect(e.aRecompiler).toEqual(["ppt"]);
    expect(e.preservees).toContain("excel");
    expect(e.preservees).toContain("consolider");
  });

  it("l'envoi survit : il a un autre parent vivant — il porte encore le classeur", () => {
    const e = empreinteDeLaModification({ genre: "RETIRER", cible: "PowerPoint" }, GRAPHE);
    expect(e.aRecompiler).not.toContain("envoyer");
  });

  it("retirer la consolidation emporte bien TOUTE sa descendance exclusive", () => {
    const e = empreinteDeLaModification({ genre: "RETIRER", cible: "Consolider les réponses" }, GRAPHE);
    expect(e.aRecompiler).toEqual(["consolider", "excel", "ppt", "envoyer"]);
    expect(e.preservees).toContain("demander-deepak");
  });
});

describe("ce qu'on refuse de deviner", () => {
  it("une cible reconnue nulle part ne touche à RIEN, et le dit", () => {
    const e = empreinteDeLaModification({ genre: "RETIRER", cible: "Yassine" }, GRAPHE);
    expect(e.reconnue).toBe(false);
    expect(e.aRecompiler).toEqual([]);
    expect(e.preservees).toHaveLength(GRAPHE.length);
    expect(e.resume).toContain("deviner");
  });

  it("une cible vide ne désigne pas toute la mission", () => {
    const e = empreinteDeLaModification({ genre: "RETIRER", cible: "la" }, GRAPHE);
    expect(e.reconnue).toBe(false);
    expect(e.aRecompiler).toEqual([]);
  });

  it("TOUS les mots utiles doivent être là — « rapport Deepak » ne prend pas toutes les demandes", () => {
    const e = empreinteDeLaModification({ genre: "RETIRER", cible: "rapport Deepak" }, GRAPHE);
    expect(e.reconnue).toBe(false);
  });

  it("un début de mot, pas une sous-chaîne : « amel » ne se reconnaît pas dans « camelia »", () => {
    const graphe = [n("x", { titre: "Écrire à Camelia Dupont" })];
    expect(empreinteDeLaModification({ genre: "REMPLACER", cible: "Amel" }, graphe).reconnue).toBe(false);
  });
});

describe("ce qui ne touche pas au graphe", () => {
  it("la priorité ne change AUCUNE étape", () => {
    const e = empreinteDeLaModification({ genre: "REPRIORISER", cible: "", priorite: 1 }, GRAPHE);
    expect(e.reconnue).toBe(true);
    expect(e.aRecompiler).toEqual([]);
    expect(e.preservees).toHaveLength(GRAPHE.length);
    expect(e.resume).toContain("priorité 1");
  });

  it("la pause ne perd rien", () => {
    const e = empreinteDeLaModification({ genre: "SUSPENDRE", cible: "", motif: "on reprend demain" }, GRAPHE);
    expect(e.aRecompiler).toEqual([]);
    expect(e.resume).toContain("Rien n'est perdu");
  });

  it("AJOUTER n'invalide rien — ajouter du travail n'est pas en remettre en cause", () => {
    const e = empreinteDeLaModification(
      { genre: "AJOUTER", cible: "", ajout: "une analyse financière" }, GRAPHE);
    expect(e.aRecompiler).toEqual([]);
    expect(e.preservees).toHaveLength(GRAPHE.length);
  });
});

describe("annuler la mission", () => {
  it("n'annule que ce qui est vivant, et garde l'acquis au dossier", () => {
    const e = empreinteDeLaModification({ genre: "ANNULER", cible: "" }, GRAPHE);
    expect(e.visees).not.toContain("demander-deepak");
    expect(e.visees).toContain("consolider");
    expect(e.preservees).toContain("demander-deepak");
    expect(e.effetsIrreversibles).toEqual(["demander-deepak", "demander-khaled"]);
  });
});
