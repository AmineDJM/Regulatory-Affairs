import { describe, it, expect } from "vitest";
import {
  PROMO_STEPS, PROMO_TRACKS, initialStep, nextStep, canValidate, seesFullCircuit,
  visibleSteps, tracksOpen, allTracksDone, pendingTracks, progress, waitingOn, etapeApplicable,
  type PromoState, type ContexteCircuit,
} from "./circuit";

const ctx = { requesterId: "u-req", managerId: "u-mgr" };
/**
 * LE CONTEXTE ORDINAIRE : un demandeur qui n'est PAS la Direction Marketing, une dépense sous le
 * seuil. Les deux étapes conditionnelles se comportent alors comme avant le lot §118.138 — et
 * c'est ce qui permet de garder les cas historiques tels quels.
 */
const CTX: ContexteCircuit = { demandeurEstDirectionMarketing: false, montant: 120_000, seuilDg: 1_000_000 };
const requester = { id: "u-req", role: "HEAD_OF_SALES" };
const marketing = { id: "u-mkt", role: "PRODUCT_MANAGER" };
const dg = { id: "u-dg", role: "GENERAL_MANAGER" };
const manager = { id: "u-mgr", role: "HEAD_OF_SALES" };
const pdg = { id: "u-pdg", role: "DIRECTION" };
const admin = { id: "u-adm", role: "SUPER_ADMIN" };
const pharmacist = { id: "u-mi", role: "MEDICAL_INFO_PHARMACIST" };
const stranger = { id: "u-x", role: "MEDICAL_DELEGATE" };

describe("Le circuit court — cinq étapes au lieu de seize", () => {
  it("enchaîne les validations dans l'ordre, puis ouvre l'exécution", () => {
    expect(nextStep("QUOTE_REQUESTED", CTX)).toBe("REVIEW_REQUESTER");
    expect(nextStep("REVIEW_REQUESTER", CTX)).toBe("REVIEW_MANAGER");
    // Sous le seuil, la porte du DG est franchie d'affilée : on arrive à l'étape SUIVANTE.
    expect(nextStep("REVIEW_MANAGER", CTX)).toBe("REVIEW_EXECUTIVE");
    expect(nextStep("REVIEW_EXECUTIVE", CTX)).toBe("REVIEW_MEDICAL_INFO");
    expect(nextStep("REVIEW_MEDICAL_INFO", CTX)).toBe("IN_EXECUTION");
    expect(nextStep("COMPLETED", CTX)).toBeNull();
  });

  it("reste court — c'était tout le problème de l'ancien", () => {
    expect(PROMO_STEPS.length).toBeLessThanOrEqual(8);
  });
});

/**
 * LES DEUX ÉTAPES CONDITIONNELLES — §118.138.
 *
 * Chaque cas nomme ce qui le ferait tomber : une assertion dont on ne sait pas nommer ce cas
 * n'est pas une assertion (§118.17).
 */
describe("Direction Marketing ne valide pas sa propre demande, et le DG ne s'ouvre qu'au-dessus du seuil", () => {
  it("l'étape de Direction Marketing SAUTE quand c'est elle qui demande", () => {
    // Ce qui le ferait tomber : la garder. Le dossier attendrait la validation de la personne
    // qui l'a déposé — une étape que personne d'autre ne peut franchir, donc un dossier mort.
    const sien: ContexteCircuit = { ...CTX, demandeurEstDirectionMarketing: true };
    expect(etapeApplicable("REVIEW_MANAGER", sien)).toBe(false);
    expect(nextStep("REVIEW_REQUESTER", sien)).toBe("REVIEW_EXECUTIVE");
  });

  it("la porte du DG s'ouvre AU-DESSUS du seuil, et pas en dessous", () => {
    expect(etapeApplicable("REVIEW_DG", { ...CTX, montant: 999_999 })).toBe(false);
    expect(etapeApplicable("REVIEW_DG", { ...CTX, montant: 1_000_001 })).toBe(true);
    expect(nextStep("REVIEW_MANAGER", { ...CTX, montant: 1_500_000 })).toBe("REVIEW_DG");
  });

  it("un montant INCONNU fait passer par le DG — jamais l'inverse", () => {
    // L'erreur coûte une validation de trop ; l'erreur inverse laisse sortir une grosse dépense
    // sans contrôle, et personne ne s'en apercevrait.
    expect(etapeApplicable("REVIEW_DG", { ...CTX, montant: null })).toBe(true);
    expect(etapeApplicable("REVIEW_DG", { ...CTX, montant: 0 })).toBe(true);
  });

  it("aucun seuil réglé ⇒ aucune porte du DG", () => {
    expect(etapeApplicable("REVIEW_DG", { ...CTX, montant: null, seuilDg: 0 })).toBe(false);
    expect(etapeApplicable("REVIEW_DG", { ...CTX, montant: null, seuilDg: null })).toBe(false);
  });

  it("DEUX étapes sautées D'AFFILÉE — le cas qui a dicté la boucle", () => {
    // S'arrêter sur la première laisserait le dossier posé sur une étape que personne ne peut
    // valider : mort, et sans une seule ligne d'échec.
    const sienEtPetit: ContexteCircuit = { demandeurEstDirectionMarketing: true, montant: 10_000, seuilDg: 1_000_000 };
    expect(nextStep("REVIEW_REQUESTER", sienEtPetit)).toBe("REVIEW_EXECUTIVE");
  });

  it("toute AUTRE étape reste applicable — le défaut est OUI", () => {
    for (const s of ["QUOTE_REQUESTED", "REVIEW_REQUESTER", "REVIEW_EXECUTIVE", "REVIEW_MEDICAL_INFO"] as const) {
      expect(etapeApplicable(s, { demandeurEstDirectionMarketing: true, montant: null, seuilDg: null }), s).toBe(true);
    }
  });
});

describe("Le devis déjà en main", () => {
  it("saute la demande de devis — le cas le plus fréquent", () => {
    // On a appelé l'imprimeur avant d'ouvrir l'ERP : une prospection fictive ne trompait personne.
    expect(initialStep({ hasQuote: true })).toBe("REVIEW_REQUESTER");
  });

  it("sans devis, on commence par le demander", () => {
    expect(initialStep({ hasQuote: false })).toBe("QUOTE_REQUESTED");
  });

  it("on ne valide rien tant qu'aucun devis n'est déposé", () => {
    expect(canValidate(requester, "QUOTE_REQUESTED", ctx)).toBe(false);
  });
});

describe("Qui valide quoi", () => {
  it("le demandeur valide la première, et lui seul", () => {
    expect(canValidate(requester, "REVIEW_REQUESTER", ctx)).toBe(true);
    expect(canValidate(manager, "REVIEW_REQUESTER", ctx)).toBe(false);
    expect(canValidate(stranger, "REVIEW_REQUESTER", ctx)).toBe(false);
  });

  it("LA DIRECTION MARKETING valide la deuxième — plus le N+1 (§118.138)", () => {
    // Ce qui le ferait tomber : revenir au `managerId`. C'est une décision de la Direction, et
    // le slug `REVIEW_MANAGER` ne change pas de nom pour ne pas migrer l'état des dossiers en
    // cours — ce qui change est QUI valide, pas comment l'étape s'appelle en base.
    expect(canValidate(marketing, "REVIEW_MANAGER", ctx)).toBe(true);
    expect(canValidate(manager, "REVIEW_MANAGER", ctx), "le N+1 n'est plus le validateur").toBe(false);
    expect(canValidate(requester, "REVIEW_MANAGER", ctx)).toBe(false);
  });

  it("le rôle SECONDAIRE Direction Marketing suffit", () => {
    // Refuser une casquette secondaire bloquerait un circuit sur une convention d'attribution.
    expect(canValidate({ id: "u-z", role: "HEAD_OF_SALES" }, "REVIEW_MANAGER", { ...ctx, secondaryRole: "PRODUCT_MANAGER" })).toBe(true);
  });

  it("la porte du DG n'est ouverte QU'AU Directeur Général", () => {
    expect(canValidate(dg, "REVIEW_DG", ctx)).toBe(true);
    expect(canValidate(marketing, "REVIEW_DG", ctx)).toBe(false);
    expect(canValidate(pdg, "REVIEW_DG", ctx), "le PDG valide l'étape exécutive, pas celle du DG").toBe(false);
  });

  it("la troisième est satisfaite par le PDG OU le Super Admin — un seul suffit", () => {
    // Exiger les deux, c'est bloquer le dossier sur un congé.
    expect(canValidate(pdg, "REVIEW_EXECUTIVE", ctx)).toBe(true);
    expect(canValidate(admin, "REVIEW_EXECUTIVE", ctx)).toBe(true);
    expect(canValidate(manager, "REVIEW_EXECUTIVE", ctx)).toBe(false);
  });

  it("l'information médicale valide la dernière", () => {
    expect(canValidate(pharmacist, "REVIEW_MEDICAL_INFO", ctx)).toBe(true);
    expect(canValidate(pdg, "REVIEW_MEDICAL_INFO", ctx)).toBe(false);
  });

  it("le Super Admin peut débloquer n'importe quelle étape", () => {
    for (const s of ["REVIEW_REQUESTER", "REVIEW_MANAGER", "REVIEW_MEDICAL_INFO"] as PromoState[]) {
      expect(canValidate(admin, s, ctx), s).toBe(true);
    }
  });

  it("rien ne se valide sur un dossier clos, refusé ou déjà en exécution", () => {
    for (const s of ["COMPLETED", "REFUSED", "IN_EXECUTION"] as PromoState[]) {
      expect(canValidate(admin, s, ctx), s).toBe(false);
    }
  });
});

describe("Qui voit le circuit complet", () => {
  it("l'administrateur et le PDG, eux seuls", () => {
    expect(seesFullCircuit(admin)).toBe(true);
    expect(seesFullCircuit(pdg)).toBe(true);
  });

  it("personne d'autre — un outil de travail n'est pas un tableau de surveillance mutuelle", () => {
    for (const u of [requester, manager, pharmacist, stranger]) {
      expect(seesFullCircuit(u), u.role).toBe(false);
    }
  });

  it("les autres ne lisent que l'étape en cours", () => {
    expect(visibleSteps(requester, "REVIEW_MANAGER")).toEqual(["REVIEW_MANAGER"]);
    expect(visibleSteps(admin, "REVIEW_MANAGER")).toHaveLength(PROMO_STEPS.length);
  });
});

describe("Les trois chemins parallèles", () => {
  it("ne s'ouvrent qu'une fois TOUTES les validations obtenues", () => {
    expect(tracksOpen("REVIEW_MEDICAL_INFO")).toBe(false);
    expect(tracksOpen("IN_EXECUTION")).toBe(true);
  });

  it("avancent indépendamment — c'est tout l'intérêt", () => {
    expect(pendingTracks(["PAYMENT"])).toEqual(["PURCHASE_ORDER", "AD_VISA"]);
    expect(allTracksDone(["PAYMENT"])).toBe(false);
  });

  it("le dossier n'est fini que lorsque le dernier l'est", () => {
    // Sinon on classerait une commande dont le visa n'est jamais arrivé.
    expect(allTracksDone([...PROMO_TRACKS])).toBe(true);
    expect(allTracksDone(["PURCHASE_ORDER", "PAYMENT"])).toBe(false);
  });
});

describe("Ce que la barre d'avancement raconte", () => {
  it("avance à chaque validation", () => {
    expect(progress("QUOTE_REQUESTED", []).step).toBe(1);
    // L'index suit la POSITION dans la chaîne : la porte du DG s'est insérée avant elle.
    expect(progress("REVIEW_MEDICAL_INFO", []).step).toBe(PROMO_STEPS.indexOf("REVIEW_MEDICAL_INFO") + 1);
    expect(progress("COMPLETED", []).step).toBe(PROMO_STEPS.length);
  });

  it("en exécution, elle suit les chantiers clos — pas un palier figé", () => {
    const none = progress("IN_EXECUTION", []).step;
    const two = progress("IN_EXECUTION", ["PAYMENT", "AD_VISA"]).step;
    expect(two).toBeGreaterThan(none);
  });

  it("un refus ne montre aucun avancement", () => {
    expect(progress("REFUSED", []).step).toBe(0);
  });
});

describe("« On attend qui ? » — la seule question qu'on pose à un circuit", () => {
  it("nomme l'étape en cours", () => {
    expect(waitingOn("REVIEW_MANAGER", [])).toContain("Direction Marketing");
    expect(waitingOn("QUOTE_REQUESTED", [])).toContain("devis");
  });

  it("en exécution, nomme les chantiers QUI RESTENT", () => {
    const w = waitingOn("IN_EXECUTION", ["PAYMENT"]);
    expect(w).toContain("Bon de commande");
    expect(w).toContain("visa");
    expect(w).not.toContain("Demande de paiement");
  });

  it("dit clairement quand il n'y a plus rien à attendre", () => {
    expect(waitingOn("COMPLETED", [])).toContain("terminé");
    expect(waitingOn("REFUSED", [])).toContain("refusé");
  });
});
