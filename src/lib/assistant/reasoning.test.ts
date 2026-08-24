import { describe, expect, it } from "vitest";
import { conversationWorkingSet, isHighStakesQuestion } from "./reasoning";

/**
 * PROFONDEUR ADAPTATIVE & CONTINUITÉ — les deux détecteurs purs :
 *   • le fort enjeu se détecte sur la NATURE de la question (décision, recommandation,
 *     réorganisation, gros montant), jamais sur sa longueur ;
 *   • le working set extrait les entités RÉCENTES (références ERP + termes cités), les plus
 *     récentes d'abord, borné — et rend null quand il n'y a rien (pas de bloc fantôme).
 */

describe("isHighStakesQuestion — la profondeur suit l'enjeu, pas la longueur", () => {
  it("cinq mots peuvent mériter une seconde passe critique", () => {
    expect(isHighStakesQuestion("Est-ce qu'on doit lancer Pembro ?")).toBe(true);
    expect(isHighStakesQuestion("Dois-je recruter un chargé Regulatory ?")).toBe(true);
    expect(isHighStakesQuestion("Faut-il abandonner le dossier REG-2026-003 ?")).toBe(true);
    expect(isHighStakesQuestion("Comment réorganiserais-tu cette équipe ?")).toBe(true);
    expect(isHighStakesQuestion("Ta recommandation sur le contrat Hikma ?")).toBe(true);
    expect(isHighStakesQuestion("Analyse-moi Regulatory et dis-moi si je dois recruter.")).toBe(true);
    expect(isHighStakesQuestion("On parle d'un avenant de 14 millions de dinars, ton avis sur le risque ?")).toBe(true);
  });

  it("une question factuelle ordinaire garde exactement le même moteur qu'avant", () => {
    expect(isHighStakesQuestion("Quel âge a Khaled ?")).toBe(false);
    expect(isHighStakesQuestion("Où en est Pembro ?")).toBe(false);
    expect(isHighStakesQuestion("Montre-moi le paiement PAY-2026-014.")).toBe(false);
    expect(isHighStakesQuestion("C'est quoi la masse salariale ?")).toBe(false);
    expect(isHighStakesQuestion("ok")).toBe(false);
    expect(isHighStakesQuestion("")).toBe(false);
  });
});

describe("conversationWorkingSet — les entités actives, les plus récentes d'abord", () => {
  it("références ERP + termes cités, dédupliqués, ordre de récence", () => {
    const ws = conversationWorkingSet([
      { role: "user", content: "Parle-moi de « Pembro » et du dossier REG-2026-003." },
      { role: "assistant", content: "Le dossier REG-2026-003 est en préparation…" },
      { role: "user", content: "Et le paiement PAY-2026-014 ?" },
      { role: "assistant", content: "PAY-2026-014 attend Nadia." },
    ]);
    expect(ws).toBeTruthy();
    expect(ws).toContain("ENTITÉS ACTIVES");
    // La plus récente d'abord : PAY avant REG, REG avant « Pembro ».
    const idxPay = ws!.indexOf("PAY-2026-014");
    const idxReg = ws!.indexOf("REG-2026-003");
    const idxPembro = ws!.indexOf("« Pembro »");
    expect(idxPay).toBeGreaterThan(-1);
    expect(idxReg).toBeGreaterThan(idxPay);
    expect(idxPembro).toBeGreaterThan(idxReg);
    // Dédupliqué : une seule occurrence de chaque.
    expect(ws!.match(/PAY-2026-014/g)!.length).toBe(1);
  });

  it("borné à 8 entités, insensible à la casse pour la déduplication des références", () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ role: "user", content: `Regarde REQ-2026-${100 + i}` }));
    turns.push({ role: "user", content: "et req-2026-111 encore une fois" });
    const ws = conversationWorkingSet(turns)!;
    expect(ws.match(/REQ-2026-\d+/g)!.length).toBe(8);
    expect(ws.match(/REQ-2026-111/g)!.length).toBe(1); // re-mention ≠ doublon
  });

  it("rien à extraire → null, jamais un bloc vide dans le prompt", () => {
    expect(conversationWorkingSet([{ role: "user", content: "Bonjour, comment ça marche ?" }])).toBeNull();
    expect(conversationWorkingSet([])).toBeNull();
  });

  it("un faux préfixe (BONJOUR-2026-1) n'est pas une référence", () => {
    const ws = conversationWorkingSet([{ role: "user", content: "BONJOUR-2026-1 n'existe pas mais DOS-2026-007 oui" }]);
    expect(ws).toContain("DOS-2026-007");
    expect(ws).not.toContain("BONJOUR");
  });
});
