import { describe, expect, it } from "vitest";
import { rendreEntrees, repartir, BUDGET_BLOC } from "@/lib/missions/runtime/entrees";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CAS EXACT QUI A COÛTÉ TROIS RUNS (§89) — et il tient en une ligne.
 *
 * Deux dossiers ERP de neuf mille caractères, deux réponses humaines de cent. `slice(0, 6000)`
 * gardait les dossiers et jetait les réponses. Le modèle écrivait « non fourni » sur ce que
 * quatre personnes venaient de donner, et deux livrables étaient bâtis là-dessus.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("les entrées d'un worker : aucune perdue, les coupes dites", () => {
  const dossier = (n: string) => `${n} ${"x".repeat(9000)}`;
  const entrees = {
    nivolex: dossier("NIVOLEX"),
    trastuzex: dossier("TRASTUZEX"),
    reponseKhaled: { contenu: "Prix de cession Nivolex 84 500 DZD, Trastuzex 61 200 DZD." },
    reponseSofiane: { contenu: "AO-2026-114 (Nivolex) et AO-2026-131 (Trastuzex)." },
  };

  it("une réponse humaine de trois lignes SURVIT à deux dossiers de neuf mille caractères", () => {
    const rendu = rendreEntrees(entrees);
    expect(rendu).toContain("84 500");
    expect(rendu).toContain("AO-2026-114");
    // Et le défaut d'origine, nommé : la coupe brute les perdait toutes les deux.
    const brut = JSON.stringify(entrees, null, 2).slice(0, BUDGET_BLOC);
    expect(brut).not.toContain("84 500");
  });

  it("toutes les clés sont présentes, même quand tout déborde", () => {
    for (const cle of Object.keys(entrees)) expect(rendreEntrees(entrees)).toContain(`${cle} :`);
  });

  it("une coupe DIT qu'elle a lieu, et que l'absence ne prouve rien", () => {
    const rendu = rendreEntrees(entrees);
    expect(rendu).toContain("COUPÉ ICI");
    expect(rendu).toContain("ne conclus pas qu'il n'existe pas");
  });

  it("rien n'est coupé quand tout tient", () => {
    const petit = { a: "un", b: "deux" };
    expect(rendreEntrees(petit)).not.toContain("COUPÉ ICI");
    expect(repartir([{ cle: "a", texte: "un" }]).every((p) => !p.coupe)).toBe(true);
  });

  it("l'ordre des clés est celui de l'appelant, pas celui du service", () => {
    const rendu = rendreEntrees(entrees);
    const positions = Object.keys(entrees).map((c) => rendu.indexOf(`${c} :`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
