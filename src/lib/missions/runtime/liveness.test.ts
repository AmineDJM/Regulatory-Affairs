import { describe, expect, it } from "vitest";
import { ECHELLE, ERROR_KINDS } from "@/lib/missions/recovery/strategy";
import { HISTORIQUE_VIDE, deciderRecours, peutConclureEtape } from "@/lib/missions/recovery/coordinator";

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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN BARREAU QUI NE PEUT RIEN CHANGER N'EST PAS UN BARREAU.
 *
 * ── LA SUITE DE LA MÊME HISTOIRE ─────────────────────────────────────────────────────────
 *
 * Le lot précédent a fait parler le recours : `STEP_RECOVERY` est passé de 0 à 24 sur un run
 * réel. Le run suivant a montré ce que valaient ces vingt-quatre lignes. Elles portaient toutes
 * `AUTRE_SOURCE`, sur des étapes d'ÉVENTAIL — et un éventail se déploie avant tout appel de
 * capacité, sans jamais relire son entrée. Or `AUTRE_SOURCE` n'agit QUE par l'entrée.
 *
 * Vingt-quatre recours, six greniers par étape, deux cents millisecondes, zéro effet. Pire :
 * l'échelle s'épuisait sur une cause qu'elle n'attaquait pas, rendant `REPLANIFIER` — le seul
 * barreau qui aurait servi — inatteignable.
 *
 * ── POURQUOI L'APPELANT LES DÉCLARE, ET NON LE COORDINATEUR ──────────────────────────────
 *
 * Le coordinateur ne connaît pas les types de nœuds, et il n'a pas à les connaître. Le moteur,
 * lui, sait exactement ce qu'un éventail fait de son entrée. Chacun garde son savoir ; ce
 * fichier vérifie le contrat entre les deux.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("les barreaux inapplicables", () => {
  const base = { kind: "INCOMPATIBLE_RESULT" as const, historique: HISTORIQUE_VIDE, cible: "DOCUMENT" };

  it("SANS déclaration, l'échelle propose AUTRE_SOURCE — c'est l'état d'avant", () => {
    // Le contre-exemple d'abord : sans lui, le test suivant passerait même si l'option était
    // ignorée, et l'on croirait tenir une garantie qu'on n'a pas.
    const r = deciderRecours({ ...base, rejouable: false });
    expect(r.geste).toBe("REESSAYER");
    if (r.geste === "REESSAYER") expect(r.strategie).toBe("AUTRE_SOURCE");
  });

  it("déclarés inapplicables, ils sont SAUTÉS — et l'échelle atteint le barreau qui agit", () => {
    const r = deciderRecours({ ...base, rejouable: false, inapplicables: ["AUTRE_SOURCE", "ELARGIR"] });
    // REPLANIFIER est le troisième barreau d'INCOMPATIBLE_RESULT. C'est lui qui corrige un
    // chemin d'éventail faux : seul un nouveau plan peut le récrire.
    expect(r.geste).toBe("REPLANIFIER");
  });

  it("un barreau sauté n'est pas COMPTÉ comme tenté — l'étape ne meurt pas plus vite", () => {
    // La nuance qui compte : retirer des barreaux inertes ne doit pas rapprocher l'étape de sa
    // mort. Tant qu'un barreau RÉEL reste, §76 interdit toujours de conclure.
    expect(peutConclureEtape({
      ...base, rejouable: false, inapplicables: ["AUTRE_SOURCE", "ELARGIR"],
    })).toBe(false);
  });

  it("quand il ne reste QUE des barreaux inapplicables, l'étape a le droit de s'arrêter", () => {
    // NOT_FOUND n'a pas de REPLANIFIER : ses barreaux utiles sont AUTRE_SOURCE, ELARGIR,
    // DEMANDER_HUMAIN et DECLARER_INCONNU. Tout retirer ne laisse rien à tenter, et prétendre
    // le contraire ferait tourner le moteur sur une étape qu'il ne sait plus faire avancer.
    expect(peutConclureEtape({
      kind: "NOT_FOUND", historique: HISTORIQUE_VIDE, cible: "DOCUMENT", rejouable: false,
      inapplicables: ["AUTRE_SOURCE", "ELARGIR", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
    })).toBe(true);
  });

  it("la déclaration ne touche PAS les autres étapes — la liste vide ne change rien", () => {
    const avec = deciderRecours({ ...base, rejouable: false, inapplicables: [] });
    const sans = deciderRecours({ ...base, rejouable: false });
    expect(avec).toEqual(sans);
  });
});
