import { describe, expect, it } from "vitest";
import { ECHELLE, ERROR_KINDS } from "@/lib/missions/recovery/strategy";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE BARREAU QUI MANQUAIT À L'ÉCHELLE.
 *
 * ── CE QU'UN RUN RÉEL A MONTRÉ ───────────────────────────────────────────────────────────
 *
 * Trois missions réelles, sur la vraie base, avec un vrai fournisseur : `STEP_RECOVERY` est
 * resté à ZÉRO sur les trois — y compris sur celle conçue exprès pour provoquer un changement
 * de source. Le recours était branché, testé, appelé depuis la production… et muet.
 *
 * La cause tient en une ligne : `tenterRecours` commence par vérifier que le motif d'échec
 * figure dans `ERROR_KINDS`, et `QA_FAILED` n'y était pas. Tout refus du contrôle qualité —
 * c'est-à-dire le motif d'échec le plus fréquent d'une mission qui a bien tourné mais manque de
 * matière — sortait du recours avant même de consulter l'échelle.
 *
 * Le défaut n'était donc pas dans l'échelle : il était dans la LISTE qui décide si l'on va la
 * consulter. C'est exactement le genre d'omission qu'aucun test unitaire de l'échelle ne peut
 * voir, puisqu'ils partent tous d'un motif déjà reconnu.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("échelle de recours — le contrôle qualité est un motif d'échec comme un autre", () => {
  it("QA_FAILED est reconnu comme motif d'échec", () => {
    expect([...ERROR_KINDS]).toContain("QA_FAILED");
  });

  it("son échelle commence par ÉLARGIR, et ne contient PAS de simple rejeu", () => {
    // Rejouer le contrôle sans avoir rien réparé redirait la même chose, en consommant une
    // tentative pour l'apprendre. Ce qui manque à une mission dont la QA refuse, c'est de la
    // MATIÈRE — d'où élargir, puis changer de source.
    const barreaux = ECHELLE.QA_FAILED;
    expect(barreaux[0]).toBe("ELARGIR");
    expect(barreaux).not.toContain("RETRY");
  });

  it("le recours LOCAL passe avant le replan global", () => {
    // Un nouveau plan coûte un appel de planificateur — mesuré entre 15 et 78 secondes sur
    // Render. L'ordre de l'échelle est donc aussi une décision de latence.
    const b = ECHELLE.QA_FAILED;
    expect(b.indexOf("AUTRE_SOURCE")).toBeLessThan(b.indexOf("REPLANIFIER"));
  });

  /**
   * LE GARDE QUI EMPÊCHE LA MÊME OMISSION DE REVENIR.
   *
   * Ajouter un motif d'échec sans lui donner d'échelle le ferait sortir du recours en silence —
   * précisément ce qui vient de coûter trois missions. Ce test parcourt la liste entière ;
   * il tombe le jour où quelqu'un ajoute un `ErrorKind` et oublie son barreau.
   */
  it("chaque motif d'échec a une échelle — aucun ne sort du recours par oubli", () => {
    for (const k of ERROR_KINDS) {
      expect(ECHELLE[k], `${k} n'a pas d'échelle`).toBeDefined();
      expect(ECHELLE[k].length, `${k} a une échelle vide`).toBeGreaterThan(0);
    }
  });
});
