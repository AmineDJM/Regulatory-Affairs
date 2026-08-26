import { describe, it, expect } from "vitest";
import { shadowPlan, judgeShadow, summarizeShadow, readyToCutOver, shadowLogLine, CUTOVER_COVERAGE } from "./shadow";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";

const FULL = POWER_TOOLS.length;

/**
 * LE BANC DU MODE OMBRE.
 *
 * Il ne mesure pas la qualité du routage — c'est le rôle du banc de routage. Il vérifie que le
 * DISPOSITIF DE COMPARAISON est correct, parce que c'est lui qui autorisera un jour à basculer.
 * Un comparateur trop indulgent donnerait le feu vert à une amputation ; c'est le seul défaut de
 * ce fichier qui coûterait vraiment cher.
 */

describe("le plan d'ombre", () => {
  it("propose une liste courte et un budget pour chaque tour", () => {
    const plan = shadowPlan("Des mails aujourd'hui ?", {}, FULL);
    expect(plan.route.route).toBe("FAST_DETERMINISTIC");
    expect(plan.budgetMax).toBe(2_000);
    expect(plan.fullToolCount).toBe(FULL);
  });

  it("une question de domaine expose beaucoup moins que le catalogue", () => {
    const plan = shadowPlan("Quel est le salaire de Raihana ?", {}, FULL);
    expect(plan.shortlisted.length).toBeLessThan(FULL / 2);
  });
});

describe("le verdict — la question qui décide de la bascule", () => {
  it("couvert quand la liste courte contenait l'outil réellement appelé", () => {
    const plan = shadowPlan("Quel est le salaire de Raihana ?", {}, FULL);
    const v = judgeShadow(plan, ["read_payroll"]);
    expect(v.covered).toBe(true);
    expect(v.missing).toEqual([]);
  });

  it("découvert — et il NOMME l'outil manquant, pas juste « ça n'a pas marché »", () => {
    const plan = shadowPlan("Quel est le salaire de Raihana ?", {}, FULL);
    const v = judgeShadow(plan, ["read_payroll", "gmail_search"]);
    expect(v.covered).toBe(false);
    expect(v.missing).toEqual(["gmail_search"]);
  });

  it("un tour jugé déterministe qui appelle quand même un outil est signalé, pas absous", () => {
    // C'est l'information la plus importante du mode ombre : elle dit que le raccourci se serait
    // trompé. L'absoudre au motif que « la route ne prévoyait pas d'outils » masquerait
    // exactement les erreurs qu'on cherche.
    const plan = shadowPlan("Des mails aujourd'hui ?", {}, FULL);
    expect(plan.shortlisted).toEqual([]);
    const v = judgeShadow(plan, ["read_budget"]);
    expect(v.covered).toBe(false);
    expect(v.missing).toEqual(["read_budget"]);
  });

  it("un tour sans aucun outil appelé est couvert par définition", () => {
    expect(judgeShadow(shadowPlan("Merci.", {}, FULL), []).covered).toBe(true);
  });

  it("l'économie d'outils se compte", () => {
    const v = judgeShadow(shadowPlan("Quel est le solde de trésorerie ?", {}, FULL), ["read_finances"]);
    expect(v.toolsSaved).toBeGreaterThan(50);
  });
});

describe("le résumé et le seuil de bascule", () => {
  const plan = (u: string) => shadowPlan(u, {}, FULL);

  it("agrège la couverture et nomme la file de travail", () => {
    const s = summarizeShadow([
      judgeShadow(plan("Quel est le salaire de Raihana ?"), ["read_payroll"]),
      judgeShadow(plan("Quel est le salaire de Khaled ?"), ["read_payroll", "gmail_search"]),
      judgeShadow(plan("Quel est le solde ?"), ["read_finances"]),
    ]);
    expect(s.turns).toBe(3);
    expect(s.coverage).toBeCloseTo(2 / 3, 5);
    expect(s.missingByTool[0]).toEqual(["gmail_search", 1]);
  });

  it("ne bascule PAS sur un échantillon trop petit, même parfait", () => {
    // Cent pour cent sur dix tours ne prouve rien. Le seuil porte sur les deux : la couverture
    // ET le volume.
    const parfait = Array.from({ length: 10 }, () => judgeShadow(plan("Le solde ?"), ["read_finances"]));
    const s = summarizeShadow(parfait);
    expect(s.coverage).toBe(1);
    expect(readyToCutOver(s)).toBe(false);
  });

  it("bascule quand le volume ET la couverture y sont", () => {
    const beaucoup = Array.from({ length: 250 }, () => judgeShadow(plan("Le solde ?"), ["read_finances"]));
    expect(readyToCutOver(summarizeShadow(beaucoup))).toBe(true);
  });

  it("ne bascule pas sous le seuil de couverture", () => {
    const melange = [
      ...Array.from({ length: 240 }, () => judgeShadow(plan("Le solde ?"), ["read_finances"])),
      ...Array.from({ length: 10 }, () => judgeShadow(plan("Le solde ?"), ["gmail_search"])),
    ];
    const s = summarizeShadow(melange);
    expect(s.coverage).toBeLessThan(CUTOVER_COVERAGE);
    expect(readyToCutOver(s)).toBe(false);
  });

  it("un résumé vide ne prétend rien", () => {
    const s = summarizeShadow([]);
    expect(s.turns).toBe(0);
    expect(s.coverage).toBe(0);
    expect(readyToCutOver(s)).toBe(false);
  });
});

describe("le journal ne relit pas les conversations du PDG", () => {
  it("il porte la route et les compteurs, jamais le texte de l'énoncé", () => {
    const v = judgeShadow(shadowPlan("Le salaire de Raihana est de combien ?", {}, FULL), ["read_payroll"]);
    const ligne = shadowLogLine(v, 38);
    const serialise = JSON.stringify(ligne);
    expect(serialise).not.toContain("Raihana");
    expect(serialise).not.toContain("salaire");
    expect(ligne.utteranceLength).toBe(38);
    expect(ligne.route).toBeDefined();
    expect(ligne.covered).toBe(true);
  });
});
