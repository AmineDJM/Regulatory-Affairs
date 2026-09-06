import { describe, expect, it } from "vitest";
import { bindingFor } from "@/lib/models/registry";
import { candidates, coutDe, decider, northStar, type Mesure, type Profil } from "./index";
import { consignerMesure } from "@/lib/evals/registre";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'OPTIMISEUR SUR LES VRAIS TARIFS (mandat 6 §50).
 *
 * Rien n'est simulé côté prix : les candidates viennent de `allBindings()`, donc de la grille
 * datée du registre (Sol 4/20, Terra 2/12, Luna 0,20/1,20 au 2026-09-05), remplaçable par
 * variable d'environnement. Si la grille changeait sans que ce pont suive, ces tests le
 * diraient — ce qui est le but : un optimiseur qui raisonne sur des prix périmés optimise
 * pour un monde qui n'existe plus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const profil: Profil = { jetonsEntree: 20_000, jetonsSortie: 2_000 };

const mesure = (o: Partial<Mesure>): Mesure => ({
  classe: "RECHERCHE", modele: "x", effort: "low",
  exactitude: 0.98, erreursArithmetiques: 0, observations: 300, quand: new Date(), ...o,
});

describe("le coût vient des VRAIS tarifs, jamais d'une constante recopiée", () => {
  it("le coût d'un appel se calcule sur la grille du registre", () => {
    const c = coutDe("bulk", profil);
    expect(c).not.toBeNull();
    const b = bindingFor("bulk");
    const attendu = (profil.jetonsEntree * b.priceInPerM! + profil.jetonsSortie * b.priceOutPerM!) / 1_000_000;
    expect(c!).toBeCloseTo(attendu, 10);
  });

  it("le cache de prompt change le coût — et il est compté", () => {
    const plein = coutDe("orchestrator", profil)!;
    const cache = coutDe("orchestrator", { ...profil, partCachee: 1 })!;
    expect(cache).toBeLessThan(plein);
  });

  it("un rôle sans tarif connu ne devient PAS une candidate : une inconnue n'est pas une affaire", () => {
    const liste = candidates(profil);
    for (const c of liste) expect(c.coutUsd, c.modele).toBeGreaterThan(0);
    // Et le temps réel est hors course : il ne traite pas de texte asynchrone.
    expect(liste.some((c) => c.modele.includes("realtime"))).toBe(false);
    expect(liste.length).toBeGreaterThanOrEqual(2);
  });
});

describe("la décision — le plancher tranche avant le prix, sur des chiffres réels", () => {
  it("sans mesure, on reste sur la référence même si moins cher existe VRAIMENT", () => {
    const d = decider("RECHERCHE", "orchestrator", profil, []);
    expect("erreur" in d).toBe(false);
    const ok = d as Exclude<typeof d, { erreur: string }>;
    expect(ok.retenu.modele).toBe(bindingFor("orchestrator").model);
    expect(ok.desescalade).toBe(false);
    // Des options moins chères EXISTENT — elles ont été écartées, pas ignorées.
    expect(ok.ecartes.some((e) => e.motif === "NON_MESURE")).toBe(true);
  });

  it("avec une mesure solide, la désescalade se fait et l'économie est CHIFFRÉE sur la grille", () => {
    const bulk = bindingFor("bulk");
    const d = decider("RECHERCHE", "orchestrator", profil, [
      mesure({ classe: "RECHERCHE", modele: bulk.model, effort: bulk.reasoning as never, observations: 300 }),
    ]);
    const ok = d as Exclude<typeof d, { erreur: string }>;
    expect(ok.retenu.modele).toBe(bulk.model);
    expect(ok.desescalade).toBe(true);
    expect(ok.economieUsd).toBeGreaterThan(0);
    // L'économie est la vraie différence de tarif, pas un pourcentage inventé.
    expect(ok.economieUsd).toBeCloseTo(coutDe("orchestrator", profil)! - coutDe("bulk", profil)!, 10);
  });

  it("FINANCE ne descend pas, quelle que soit la mesure — et la décision porte son plancher", () => {
    const bulk = bindingFor("bulk");
    const d = decider("FINANCE", "orchestrator", profil, [
      mesure({ classe: "FINANCE", modele: bulk.model, effort: bulk.reasoning as never, exactitude: 1, observations: 5_000 }),
    ]);
    const ok = d as Exclude<typeof d, { erreur: string }>;
    expect(ok.retenu.modele).toBe(bindingFor("orchestrator").model);
    expect(ok.plancher.desescaladeAutorisee).toBe(false);
    expect(ok.plancher.exactitude).toBe(0.99);
    expect(ok.ecartes.some((e) => e.motif === "CLASSE_SANS_DESESCALADE")).toBe(true);
  });

  it("la décision porte le PROFIL : un coût sans son assiette de jetons ne veut rien dire", () => {
    const d = decider("TRIVIAL", "worker", profil, []) as Exclude<ReturnType<typeof decider>, { erreur: string }>;
    expect(d.profil.jetonsEntree).toBe(20_000);
    expect(d.limites.length).toBeGreaterThan(0);
  });
});

describe("le North Star sur des chiffres de banc", () => {
  it("il refuse de rendre un coût par réussite quand rien n'a réussi", () => {
    expect(northStar({ missions: 5, reussies: 0, coutTotalUsd: 0.1, coutDesEchecsUsd: 0.1 }).coutParReussiteUsd).toBeNull();
  });

  it("il dit la part du budget partie dans des missions ratées", () => {
    const n = northStar({ missions: 200, reussies: 150, coutTotalUsd: 2.5, coutDesEchecsUsd: 0.6 });
    expect(n.tauxReussite).toBeCloseTo(0.75, 5);
    expect(n.partGachee).toBeCloseTo(0.24, 5);
    expect(n.phrase).toMatch(/24 % du budget parti dans des missions ratées/);
  });
});

describe("mesures consignées — §50", () => {
  const SRC = "platform/in-process/cout/cout.test.ts";
  it("une paire non mesurée est écartée, et le North Star refuse de mentir", () => {
    const d = decider("RECHERCHE", "orchestrator", profil, []) as Exclude<ReturnType<typeof decider>, { erreur: string }>;
    consignerMesure("non_mesure_nest_pas_bon_marche", { n: 1, ok: d.ecartes.some((e) => e.motif === "NON_MESURE") && !d.desescalade ? 1 : 0 },
      SRC, `${d.ecartes.length} option(s) moins chères écartées faute de mesure`);

    const rien = northStar({ missions: 12, reussies: 0, coutTotalUsd: 0.9, coutDesEchecsUsd: 0.9 });
    consignerMesure("cout_par_reussite", { n: 1, ok: rien.coutParReussiteUsd === null && rien.limites.length >= 2 ? 1 : 0 },
      SRC, "null quand rien n'a réussi, et le ratio dit ce qu'il ne compte pas");
  });
});
