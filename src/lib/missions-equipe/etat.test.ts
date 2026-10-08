import { describe, expect, it } from "vitest";
import {
  refusReponse, etatReponse, peutRelancerInvitation, retraitSouple, etapesVisibles, etapesAAjouter, refusAjoutEtape,
  noteFraisOuverte, marcheInitiale, etatOrdreMission, libelleOrdreMission, peutDemanderOrdre, peutRetirerOrdre,
  refusDecisionN1, refusTraitementRh, etatDemandeSecretariat, etatDemandeMateriel, demandeRelancable, refusMontantFrais,
  objetOrdreMission,
} from "./etat";

const H = 3_600_000;
const T0 = new Date("2026-10-08T08:00:00Z");

describe("la réponse à l'invitation", () => {
  const invitee = { userId: "u1", response: "INVITEE" as const, archivedAt: null };

  it("seule la personne invitée répond ; décliner exige un motif", () => {
    expect(refusReponse(invitee, "u2", "CONFIRMER", null)).toMatch(/invitée/);
    expect(refusReponse(invitee, "u1", "CONFIRMER", null)).toBeNull();
    expect(refusReponse(invitee, "u1", "DECLINER", "  ")).toMatch(/pourquoi/i);
    expect(refusReponse(invitee, "u1", "DECLINER", "garde CHU")).toBeNull();
  });

  it("une mission retirée, confirmée ou déclinée ne se re-répond pas de la même façon", () => {
    expect(refusReponse({ ...invitee, archivedAt: T0 }, "u1", "CONFIRMER", null)).toMatch(/retirée/);
    expect(refusReponse({ ...invitee, response: "CONFIRMEE" }, "u1", "CONFIRMER", null)).toMatch(/déjà confirmé/);
    expect(refusReponse({ ...invitee, response: "CONFIRMEE" }, "u1", "DECLINER", "imprévu"), "on peut se désister d'une mission confirmée").toBeNull();
    expect(refusReponse({ ...invitee, response: "DECLINEE" }, "u1", "CONFIRMER", null)).toMatch(/réinviter/);
  });

  it("l'organisateur lit « confirmée », « en attente — n j », « déclinée — motif »", () => {
    expect(etatReponse({ response: "CONFIRMEE", createdAt: T0, declineReason: null }).texte).toBe("confirmée");
    expect(etatReponse({ response: "INVITEE", createdAt: T0, declineReason: null }, T0.getTime() + 50 * H).texte).toBe("en attente — 2 j");
    expect(etatReponse({ response: "INVITEE", createdAt: T0, declineReason: null }, T0.getTime() + H).texte).toBe("en attente");
    const d = etatReponse({ response: "DECLINEE", createdAt: T0, declineReason: "garde CHU" });
    expect(d.texte).toContain("garde CHU");
    expect(d.ton).toBe("danger");
  });

  it("relancer : quatre heures après l'invitation ou la dernière relance, et seulement sans réponse", () => {
    const a = { response: "INVITEE" as const, createdAt: T0, lastNudgeAt: null, archivedAt: null };
    const tot = peutRelancerInvitation(a, T0.getTime() + H);
    expect(tot.ok).toBe(false);
    if (!tot.ok) expect(tot.raison).toMatch(/3 h/);
    expect(peutRelancerInvitation(a, T0.getTime() + 4 * H).ok).toBe(true);
    expect(peutRelancerInvitation({ ...a, lastNudgeAt: new Date(T0.getTime() + 4 * H) }, T0.getTime() + 5 * H).ok).toBe(false);
    expect(peutRelancerInvitation({ ...a, response: "CONFIRMEE" }, T0.getTime() + 9 * H).ok).toBe(false);
  });

  it("retirer : on archive dès qu'il y a une trace, on efface sinon", () => {
    expect(retraitSouple({ documents: 0, commentaires: 0, demandes: 0 })).toBe(false);
    expect(retraitSouple({ documents: 0, commentaires: 1, demandes: 0 })).toBe(true);
    expect(retraitSouple({ documents: 0, commentaires: 0, demandes: 2 })).toBe(true);
  });
});

describe("les étapes : cachées tant qu'on ne les ajoute pas", () => {
  it("par défaut, aucune étape facultative n'est visible ; toutes sont proposées dans « ⋯ »", () => {
    expect(etapesVisibles([])).toEqual([]);
    expect(etapesAAjouter([])).toEqual(["TRANSPORT", "HEBERGEMENT", "MATERIEL", "NOTE_FRAIS"]);
  });

  it("une étape ajoutée paraît, dans l'ordre fixe, et quitte le menu", () => {
    expect(etapesVisibles(["NOTE_FRAIS", "TRANSPORT"])).toEqual(["TRANSPORT", "NOTE_FRAIS"]);
    expect(etapesAAjouter(["NOTE_FRAIS", "TRANSPORT"])).toEqual(["HEBERGEMENT", "MATERIEL"]);
  });

  it("une demande déjà liée reste visible même si l'étape n'a pas été cochée", () => {
    expect(etapesVisibles([], ["HEBERGEMENT"])).toEqual(["HEBERGEMENT"]);
    expect(etapesAAjouter([], ["HEBERGEMENT"])).not.toContain("HEBERGEMENT");
  });

  it("on n'ajoute qu'à une mission confirmée, et qu'une étape connue", () => {
    expect(refusAjoutEtape({ response: "INVITEE", archivedAt: null }, "TRANSPORT")).toMatch(/Confirmez/);
    expect(refusAjoutEtape({ response: "CONFIRMEE", archivedAt: null }, "VISA")).toMatch(/inconnue/);
    expect(refusAjoutEtape({ response: "CONFIRMEE", archivedAt: null }, "MATERIEL")).toBeNull();
  });

  it("la note de frais s'ouvre le jour du retour", () => {
    const retour = new Date("2026-11-29T00:00:00Z");
    expect(noteFraisOuverte(retour, null, new Date("2026-11-28T20:00:00Z").getTime())).toBe(false);
    expect(noteFraisOuverte(retour, null, new Date("2026-11-29T06:00:00Z").getTime())).toBe(true);
    expect(noteFraisOuverte(null, null)).toBe(true);
  });
});

describe("l'ordre de mission : N+1 puis RH", () => {
  it("la marche de départ : le N+1 s'il existe, sinon directement les RH — et on le dit", () => {
    expect(marcheInitiale("mgr", "moi").gate).toBe("PENDING");
    const sans = marcheInitiale(null, "moi");
    expect(sans.gate).toBeNull();
    expect(sans.message).toMatch(/directement aux RH/);
    expect(marcheInitiale("moi", "moi").gate, "on ne valide pas son propre ordre").toBeNull();
  });

  it("les états du circuit, lus sur la demande RH", () => {
    expect(etatOrdreMission(null, "NONE")).toBe("AUCUN");
    expect(etatOrdreMission(null, "ISSUED"), "un ordre émis à l'ancienne reste émis").toBe("EMIS");
    expect(etatOrdreMission(null, "REQUESTED"), "un ancien marqueur sans demande se redemande").toBe("AUCUN");
    expect(etatOrdreMission({ status: "PENDING", managerGate: "PENDING" }, "REQUESTED")).toBe("CHEZ_N1");
    expect(etatOrdreMission({ status: "PENDING", managerGate: "APPROVED" }, "REQUESTED")).toBe("CHEZ_RH");
    expect(etatOrdreMission({ status: "PENDING", managerGate: null }, "REQUESTED"), "sans N+1 : chez les RH").toBe("CHEZ_RH");
    expect(etatOrdreMission({ status: "IN_PROGRESS", managerGate: "APPROVED" }, "REQUESTED")).toBe("CHEZ_RH");
    expect(etatOrdreMission({ status: "READY", managerGate: "APPROVED" }, "ISSUED")).toBe("EMIS");
    expect(etatOrdreMission({ status: "REJECTED", managerGate: "REJECTED" }, "NONE")).toBe("REFUSE_N1");
    expect(etatOrdreMission({ status: "REJECTED", managerGate: "APPROVED" }, "NONE")).toBe("REFUSE_RH");
    expect(etatOrdreMission({ status: "CANCELLED", managerGate: "PENDING" }, "NONE")).toBe("AUCUN");
  });

  it("chaque état dit « état — chez qui »", () => {
    expect(libelleOrdreMission("CHEZ_N1", "Sonia Hamidi").texte).toBe("à valider — chez Sonia Hamidi (N+1)");
    expect(libelleOrdreMission("CHEZ_RH").texte).toMatch(/chez les RH/);
    expect(libelleOrdreMission("EMIS").ton).toBe("success");
  });

  it("demander / retirer selon l'état", () => {
    expect(peutDemanderOrdre("AUCUN")).toBe(true);
    expect(peutDemanderOrdre("REFUSE_N1")).toBe(true);
    expect(peutDemanderOrdre("CHEZ_N1")).toBe(false);
    expect(peutDemanderOrdre("EMIS")).toBe(false);
    expect(peutRetirerOrdre("CHEZ_N1")).toBe(true);
    expect(peutRetirerOrdre("CHEZ_RH")).toBe(true);
    expect(peutRetirerOrdre("EMIS")).toBe(false);
  });

  it("la décision du N+1 : la sienne, sur une marche ouverte, motif au refus", () => {
    const ouverte = { type: "MISSION_ORDER", status: "PENDING" as const, managerGate: "PENDING" as const };
    expect(refusDecisionN1(ouverte, false, "VALIDER", null)).toMatch(/Seul le N\+1/);
    expect(refusDecisionN1(ouverte, true, "VALIDER", null)).toBeNull();
    expect(refusDecisionN1(ouverte, true, "REFUSER", null)).toMatch(/pourquoi/);
    expect(refusDecisionN1(ouverte, true, "REFUSER", "Dates en conflit")).toBeNull();
    expect(refusDecisionN1({ ...ouverte, managerGate: "APPROVED" }, true, "VALIDER", null)).toMatch(/n'attend plus/);
    expect(refusDecisionN1({ ...ouverte, type: "EXPENSE_REPORT" }, true, "VALIDER", null)).toMatch(/pas un ordre/);
  });

  it("les RH ne produisent pas un ordre encore chez le N+1 ou refusé par lui", () => {
    expect(refusTraitementRh("PENDING")).toMatch(/N\+1/);
    expect(refusTraitementRh("REJECTED")).toMatch(/refusé/);
    expect(refusTraitementRh("APPROVED")).toBeNull();
    expect(refusTraitementRh(null)).toBeNull();
  });

  it("l'objet de l'ordre reprend la demande", () => {
    expect(objetOrdreMission("ACCOMPAGNANT", "Congrès SFLS 2026")).toContain("Congrès SFLS 2026");
    expect(objetOrdreMission("DELEGATE_REFERENCE", "Soirée VIH")).toMatch(/délégué de référence/);
  });
});

describe("les autres circuits, relus", () => {
  it("transport / hébergement au secrétariat ; matériel au magasin", () => {
    expect(etatDemandeSecretariat(null).texte).toBe("à demander");
    expect(etatDemandeSecretariat("NEW").texte).toMatch(/chez le secrétariat/);
    expect(etatDemandeSecretariat("DONE").ton).toBe("success");
    expect(etatDemandeMateriel("OUVERTE").texte).toMatch(/chez le magasin/);
    expect(etatDemandeMateriel("REFUSEE").ton).toBe("danger");
  });

  it("on ne refait une demande que si la précédente est annulée ou refusée", () => {
    expect(demandeRelancable(null)).toBe(true);
    expect(demandeRelancable("CANCELLED")).toBe(true);
    expect(demandeRelancable("REFUSEE")).toBe(true);
    expect(demandeRelancable("NEW")).toBe(false);
    expect(demandeRelancable("OUVERTE")).toBe(false);
  });

  it("frais à la clôture : un montant exact, positif, saisi à la main", () => {
    expect(refusMontantFrais(null)).toMatch(/montant/);
    expect(refusMontantFrais(0)).toMatch(/supérieur/);
    expect(refusMontantFrais(48_500)).toBeNull();
  });
});
