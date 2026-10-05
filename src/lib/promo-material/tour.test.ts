import { describe, it, expect } from "vitest";
import { tourDe, canValidate, libelleEtape } from "./circuit";
import { statutDuDossier, etatAdProDuDossier } from "./statut";
import { PROMO_MATERIAL_STATUS } from "@/lib/labels";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « À QUI LE TOUR ? » ET « OÙ EN EST-IL ? » — deux règles pures, lues par tous (§118.153).
 *
 * Mesuré en parcours réel : le centre d'actions lisait le `status` HÉRITÉ, figé à « Prospection
 * demandée » pour tout dossier du circuit — le DG voyait « à valider » un dossier qu'il venait de
 * valider, le N+1 ne voyait pas celui qui l'attendait, l'assistante ne voyait pas les devis à
 * retranscrire. `tourDe` dit à qui revient la suite ; `statutDuDossier` dit où en est le dossier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const A = (id: string, role: string, secondaryRole: string | null = null) =>
  ({ id, role, secondaryRole, vueGlobale: role === "SUPER_ADMIN" || role === "DIRECTION" });
const PM = { requesterId: "kam", assistantId: null as string | null, returnedAt: null as Date | null };
const CTX = { requesterId: "kam", requestValidatorId: "ns", validateursMarketing: ["assia"] };

describe("tourDe — le tour d'une personne, pas son pouvoir", () => {
  it("la validation de la demande revient au N+1 NOMMÉ, jamais au demandeur", () => {
    expect(tourDe(A("ns", "NATIONAL_SALES"), "REVIEW_REQUEST", PM, CTX, 2)).toBe("VALIDATION");
    expect(tourDe(A("kam", "MEDICAL_DELEGATE"), "REVIEW_REQUEST", PM, CTX, 2)).toBeNull();
    expect(tourDe(A("ns2", "NATIONAL_SALES"), "REVIEW_REQUEST", PM, CTX, 2), "un autre superviseur n'est pas le N+1").toBeNull();
  });

  it("demander les devis est le GESTE du demandeur", () => {
    expect(tourDe(A("kam", "MEDICAL_DELEGATE"), "QUOTE_TO_REQUEST", PM, CTX, 2)).toBe("GESTE");
    expect(tourDe(A("ns", "NATIONAL_SALES"), "QUOTE_TO_REQUEST", PM, CTX, 2)).toBeNull();
  });

  it("retranscrire (circuit 2) : l'assistante désignée, sinon toute assistante — jamais le demandeur", () => {
    expect(tourDe(A("a1", "DIRECTION_ASSISTANT"), "QUOTE_REQUESTED", PM, CTX, 2)).toBe("GESTE");
    expect(tourDe(A("kam", "MEDICAL_DELEGATE"), "QUOTE_REQUESTED", PM, CTX, 2)).toBeNull();
    const designee = { ...PM, assistantId: "a1" };
    expect(tourDe(A("a1", "DIRECTION_ASSISTANT"), "QUOTE_REQUESTED", designee, CTX, 2)).toBe("GESTE");
    expect(tourDe(A("a2", "DIRECTION_ASSISTANT"), "QUOTE_REQUESTED", designee, CTX, 2), "une autre assistante n'est pas désignée").toBeNull();
  });

  it("la Direction Marketing : la liste NOMMÉE quand elle a été lue", () => {
    expect(tourDe(A("assia", "PRODUCT_MANAGER"), "REVIEW_MANAGER", PM, CTX, 2)).toBe("VALIDATION");
    expect(tourDe(A("autre", "PRODUCT_MANAGER"), "REVIEW_MANAGER", PM, CTX, 2)).toBeNull();
  });

  it("le DG voit l'étape qui le nomme, et plus rien une fois le dossier passé à l'exécution", () => {
    expect(tourDe(A("dg", "GENERAL_MANAGER"), "REVIEW_DG", PM, CTX, 2)).toBe("VALIDATION");
    expect(tourDe(A("dg", "GENERAL_MANAGER"), "IN_EXECUTION", PM, CTX, 2)).toBeNull();
    expect(tourDe(A("dg", "GENERAL_MANAGER"), "COMPLETED", PM, CTX, 2)).toBeNull();
  });

  it("LE SUPER ADMIN PEUT débloquer toute étape — ce n'est pas pour autant SON tour", () => {
    // Sans cette distinction, chaque dossier du groupe s'afficherait « à valider » chez lui : un
    // pouvoir de déblocage n'est pas une file d'attente.
    const sa = A("sa", "SUPER_ADMIN");
    expect(canValidate(sa, "REVIEW_DG", CTX)).toBe(true);
    expect(tourDe(sa, "REVIEW_DG", PM, CTX, 2)).toBeNull();
    expect(tourDe(sa, "REVIEW_REQUEST", PM, CTX, 2)).toBeNull();
    expect(tourDe(sa, "QUOTE_REQUESTED", PM, CTX, 2)).toBeNull();
  });
});

describe("statutDuDossier — l'étape du circuit, jamais le statut figé", () => {
  it("un dossier du circuit affiche SON étape, pas « Prospection demandée »", () => {
    const s = statutDuDossier({ status: "PROSPECTION_REQUESTED", circuitState: "REVIEW_DG", circuitVersion: 2, returnedAt: null });
    expect(s.libelle).toBe(libelleEtape("REVIEW_DG", 2));
    expect(s.libelle).not.toBe(PROMO_MATERIAL_STATUS.PROSPECTION_REQUESTED.label);
    expect(s.ton).toBe("warning");
  });

  it("terminé, en exécution, refusé : trois tons, trois états unifiés", () => {
    const fin = { status: "PROSPECTION_REQUESTED", circuitVersion: 2, returnedAt: null };
    expect(statutDuDossier({ ...fin, circuitState: "COMPLETED" }).ton).toBe("success");
    expect(etatAdProDuDossier({ ...fin, circuitState: "COMPLETED" })).toBe("DONE");
    expect(statutDuDossier({ ...fin, circuitState: "IN_EXECUTION" }).ton).toBe("info");
    expect(etatAdProDuDossier({ ...fin, circuitState: "IN_EXECUTION" })).toBe("APPROVED");
    expect(statutDuDossier({ ...fin, circuitState: "REFUSED" }).ton).toBe("danger");
    expect(etatAdProDuDossier({ ...fin, circuitState: "REFUSED" })).toBe("REFUSED");
    expect(etatAdProDuDossier({ ...fin, circuitState: "REVIEW_MANAGER" })).toBe("AWAITING");
  });

  it("l'ancien circuit garde son statut ; un état illisible retombe sur lui au lieu d'inventer", () => {
    const ancien = { status: "PROSPECTION_REQUESTED", circuitState: null, circuitVersion: null, returnedAt: null };
    expect(statutDuDossier(ancien).libelle).toBe(PROMO_MATERIAL_STATUS.PROSPECTION_REQUESTED.label);
    expect(statutDuDossier({ ...ancien, circuitState: "ETAT_INCONNU" }).libelle).toBe(PROMO_MATERIAL_STATUS.PROSPECTION_REQUESTED.label);
  });
});

describe("RENVOYÉ POUR CORRECTION — chez son demandeur, ni en validation ni refusé (§118.190)", () => {
  const quand = new Date("2026-10-03T09:00:00Z");
  it("à la validation de la demande, la marque fait passer le tour du validateur au DEMANDEUR", () => {
    const pm = { ...PM, returnedAt: quand };
    expect(tourDe(A("kam", "MEDICAL_DELEGATE"), "REVIEW_REQUEST", pm, CTX, 2)).toBe("GESTE");
    expect(tourDe(A("ns", "NATIONAL_SALES"), "REVIEW_REQUEST", pm, CTX, 2), "le validateur n'a rien à trancher").toBeNull();
    // Le TÉMOIN : sans la marque, la même étape revient au validateur — sinon une règle qui
    // donnerait toujours la main au demandeur passerait.
    expect(tourDe(A("ns", "NATIONAL_SALES"), "REVIEW_REQUEST", PM, CTX, 2)).toBe("VALIDATION");
    expect(tourDe(A("kam", "MEDICAL_DELEGATE"), "REVIEW_REQUEST", PM, CTX, 2)).toBeNull();
  });
  it("« À corriger » partout où le dossier se lit, et l'état unifié RETURNED — jamais pour un dossier annulé", () => {
    const base = { status: "PROSPECTION_REQUESTED", circuitVersion: 2, returnedAt: quand };
    for (const circuitState of ["REVIEW_REQUEST", "REVIEW_REQUESTER"]) {
      expect(statutDuDossier({ ...base, circuitState }).libelle, circuitState).toBe("À corriger");
      expect(etatAdProDuDossier({ ...base, circuitState }), circuitState).toBe("RETURNED");
    }
    // Une marque restée posée pendant que l'assistante retranscrit : l'étape fait foi.
    expect(statutDuDossier({ ...base, circuitState: "QUOTE_REQUESTED" }).libelle).toBe(libelleEtape("QUOTE_REQUESTED", 2));
    expect(statutDuDossier({ ...base, status: "CANCELLED", circuitState: "REFUSED" }).libelle).toBe("Annulé");
    expect(etatAdProDuDossier({ ...base, status: "CANCELLED", circuitState: "REVIEW_REQUEST" })).not.toBe("RETURNED");
  });
});
