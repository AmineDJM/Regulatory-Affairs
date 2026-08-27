import { describe, expect, it } from "vitest";
import { FAITS_CONNUS, faitDepuisAudit } from "./from-audit";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA LISTE BLANCHE — ce qu'elle laisse passer, et surtout ce qu'elle ARRÊTE.
 *
 * Un classeur trop généreux ne se voit pas : le registre se remplit, tout a l'air de marcher, et
 * on découvre six mois plus tard qu'il contient trois millions de changements de commentaire
 * dans lesquels plus personne ne cherche rien. Ce fichier fige donc autant les REFUS que les
 * acceptations.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

describe("de l'audit au fait métier", () => {
  it("un téléversement est un fait, quelle que soit l'entité visée", () => {
    const f = faitDepuisAudit({ action: "UPLOAD", module: "REGULATORY", entityType: "REGULATORY_PRODUCT", entityId: "r1" });
    expect(f?.type).toBe("DOCUMENT_UPLOADED");
    // C'est ce fait-là qui clôt « envoie-moi le contrat » : l'ACTION prime sur l'entité.
    expect(faitDepuisAudit({ action: "UPLOAD", module: "ADPRO_CONSULTING", entityType: "CONSULTING_CONTRACT" })?.type)
      .toBe("DOCUMENT_UPLOADED");
  });

  it("un statut réglementaire qui change est un fait ; le même statut reposé n'en est pas un", () => {
    const bouge = faitDepuisAudit({
      action: "UPDATE", module: "REGULATORY", entityType: "REGULATORY_PRODUCT", entityId: "r1",
      field: "status", oldValue: "SUBMITTED", newValue: "DECISION_OBTAINED",
    });
    expect(bouge?.type).toBe("REGULATORY_STATUS_CHANGED");
    expect(bouge?.payload).toMatchObject({ de: "SUBMITTED", vers: "DECISION_OBTAINED" });

    // Réécrire la MÊME valeur n'est pas un événement. Sans ce garde, un enregistrement de
    // formulaire sans modification produirait un fait à chaque clic sur « Enregistrer ».
    expect(faitDepuisAudit({
      action: "UPDATE", module: "REGULATORY", entityType: "REGULATORY_PRODUCT",
      field: "status", oldValue: "SUBMITTED", newValue: "SUBMITTED",
    })).toBeNull();
  });

  it("une vente PAYÉE est un encaissement ; une vente PARTIELLE ne l'est pas", () => {
    expect(faitDepuisAudit({
      action: "UPDATE", module: "SALES", entityType: "SALE", entityId: "s1",
      field: "paymentStatus", oldValue: "UNPAID", newValue: "PAID",
    })?.type).toBe("PAYMENT_RECEIVED");

    // PARTIAL n'est pas payé. Le compter comme tel clôturerait une tâche de relance sur une
    // facture encore due pour moitié.
    expect(faitDepuisAudit({
      action: "UPDATE", module: "SALES", entityType: "SALE",
      field: "paymentStatus", oldValue: "UNPAID", newValue: "PARTIAL",
    })).toBeNull();
  });

  it("l'argent qui SORT ne se confond pas avec l'argent qui ENTRE", () => {
    const sortie = faitDepuisAudit({
      action: "UPDATE", module: "FINANCE", entityType: "EXPENSE_ORDER",
      field: "status", oldValue: "APPROVED", newValue: "PAID",
    });
    // Deux noms différents, et c'est le point : les confondre mettrait une dépense dans un
    // chiffre d'affaires.
    expect(sortie?.type).toBe("PAYMENT_ISSUED");
    expect(sortie?.type).not.toBe("PAYMENT_RECEIVED");
  });

  it("une tâche DONE est un achèvement ; annulée ou refusée, non", () => {
    expect(faitDepuisAudit({ action: "UPDATE", module: "TASKS", entityType: "TASK", field: "status", oldValue: "TODO", newValue: "DONE" })?.type)
      .toBe("TASK_COMPLETED");
    for (const fin of ["CANCELLED", "DECLINED"]) {
      expect(faitDepuisAudit({ action: "UPDATE", module: "TASKS", entityType: "TASK", field: "status", oldValue: "TODO", newValue: fin })).toBeNull();
    }
  });

  it("LE REFUS EST LA RÈGLE — le bruit ordinaire de l'ERP ne devient pas un fait", () => {
    const bruit = [
      // Un commentaire, un ordre de tri, une couleur : des modifications réelles, sans portée.
      { action: "UPDATE", module: "REGULATORY", entityType: "REGULATORY_PRODUCT", field: "comments", oldValue: "a", newValue: "b" },
      { action: "UPDATE", module: "ADPRO", entityType: "AD_PRO_ITEM", field: "position", oldValue: "1", newValue: "2" },
      { action: "UPDATE", module: "SALES", entityType: "SALE", field: "comment", oldValue: "", newValue: "vu" },
      // Une création d'entité qui n'est pas un jalon.
      { action: "CREATE", module: "ADPRO", entityType: "AD_PRO_ITEM" },
      // Les connexions ne sont pas des faits métier — elles ont leur propre journal.
      { action: "LOGIN", module: "AUTH" },
      { action: "EXPORT", module: "REGULATORY", entityType: "REGULATORY_PRODUCT" },
      // Une entité inconnue du classeur : refusée, pas devinée.
      { action: "UPDATE", module: "X", entityType: "FEEDBACK", field: "status", oldValue: "a", newValue: "b" },
      // Une suppression : l'audit la garde, le registre des faits n'en fait pas un jalon.
      { action: "DELETE", module: "SALES", entityType: "SALE", entityId: "s9" },
    ];
    for (const b of bruit) expect(faitDepuisAudit(b), JSON.stringify(b)).toBeNull();
  });

  it("aucun fait ne porte de contenu de document ni de secret", () => {
    const f = faitDepuisAudit({
      action: "UPLOAD", module: "LEGAL", entityType: "LEGAL_DOCUMENT", entityId: "d1",
      summary: "Contrat déposé",
    });
    // Le payload ne contient QUE des métadonnées. Le registre se lit largement : ce qui y entre
    // est lisible par tous ceux qui peuvent le lire.
    expect(Object.keys(f!.payload).sort()).toEqual(["cible", "module", "resume"]);
  });

  it("les faits connus sont nommés, uniques et stables", () => {
    expect(FAITS_CONNUS).toContain("DOCUMENT_UPLOADED");
    expect(FAITS_CONNUS).toContain("PAYMENT_RECEIVED");
    expect(FAITS_CONNUS).toContain("REGULATORY_STATUS_CHANGED");
    expect(FAITS_CONNUS).toContain("DELIVERY_COMPLETED");
    expect(new Set(FAITS_CONNUS).size).toBe(FAITS_CONNUS.length);
  });
});
