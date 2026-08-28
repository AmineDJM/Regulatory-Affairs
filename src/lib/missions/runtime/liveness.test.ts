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
  /** Un résolveur qui SAIT faire : c'est lui qui rend un barreau exécutable. */
  const capable = {
    autreSource: () => ({
      type: "AUTRE_CAPACITE" as const,
      capability: "search_courriers",
      input: { query: "contrat" },
      ceQuiChange: "search_drive → search_courriers",
    }),
  };
  // NOT_FOUND est la cause qui porte AUTRE_SOURCE en tête — c'est sur elle que la question se
  // pose. INCOMPATIBLE_RESULT, lui, ne cherche plus ailleurs du tout : ce serait chercher une
  // autre forme dans un autre grenier.
  const base = { kind: "NOT_FOUND" as const, historique: HISTORIQUE_VIDE, cible: "DOCUMENT" };

  it("SANS déclaration, l'échelle propose AUTRE_SOURCE — c'est l'état d'avant", () => {
    // Le contre-exemple d'abord : sans lui, le test suivant passerait même si l'option était
    // ignorée, et l'on croirait tenir une garantie qu'on n'a pas.
    const r = deciderRecours({ ...base, rejouable: false, resolveurs: capable });
    expect(r.geste).toBe("REESSAYER");
    if (r.geste === "REESSAYER") {
      expect(r.strategie).toBe("AUTRE_SOURCE");
      // ET L'ACTION EST CONCRÈTE : une autre capacité, pas une étiquette dans l'entrée.
      expect(r.action.type).toBe("AUTRE_CAPACITE");
    }
  });

  it("déclarés inapplicables, ils sont SAUTÉS — et l'échelle atteint le barreau qui agit", () => {
    const r = deciderRecours({
      ...base, rejouable: false, resolveurs: capable, inapplicables: ["AUTRE_SOURCE", "ELARGIR"],
    });
    // REPLAN_LOCAL est le barreau suivant de NOT_FOUND : récrire la partie du plan qui
    // cherchait au mauvais endroit, sans régénérer tout le DAG ni déranger personne.
    expect(r.geste).toBe("REPLAN_LOCAL");
    // `sautes` reste VIDE, et la nuance est réelle : un barreau DÉCLARÉ inapplicable n'entre
    // jamais dans l'échelle — il est retiré en amont, avec `DECOUPER`. `sautes` ne porte que
    // ceux qui y sont entrés et dont le résolveur n'a rien su faire (test suivant).
    expect(r.sautes).toEqual([]);
  });

  it("UN BARREAU SANS ACTION POSSIBLE EST SAUTÉ, MÊME NON DÉCLARÉ", () => {
    // La vraie généralisation : ce n'est pas l'appelant qui décide seul, c'est la capacité
    // d'agir. Un résolveur qui ne sait rien faire produit exactement le même saut.
    const r = deciderRecours({ ...base, rejouable: false, resolveurs: {} });
    expect(r.geste).toBe("REPLAN_LOCAL");
    expect(r.sautes).toContain("AUTRE_SOURCE");
    expect(r.sautes).toContain("ELARGIR");
  });

  it("un barreau sauté n'est pas COMPTÉ comme tenté — l'étape ne meurt pas plus vite", () => {
    // La nuance qui compte : retirer des barreaux inertes ne doit pas rapprocher l'étape de sa
    // mort. Tant qu'un barreau RÉEL reste, §76 interdit toujours de conclure.
    expect(peutConclureEtape({
      ...base, rejouable: false, inapplicables: ["AUTRE_SOURCE", "ELARGIR"],
    })).toBe(false);
  });

  it("quand il ne reste QUE des barreaux inapplicables, l'étape a le droit de s'arrêter", () => {
    // Tout retirer ne laisse rien à tenter, et prétendre le contraire ferait tourner le moteur
    // sur une étape qu'il ne sait plus faire avancer.
    expect(peutConclureEtape({
      ...base, rejouable: false,
      inapplicables: ["AUTRE_SOURCE", "ELARGIR", "REPLAN_LOCAL", "DEMANDER_HUMAIN", "DECLARER_INCONNU"],
    })).toBe(true);
  });

  it("la déclaration ne touche PAS les autres étapes — la liste vide ne change rien", () => {
    const avec = deciderRecours({ ...base, rejouable: false, resolveurs: capable, inapplicables: [] });
    const sans = deciderRecours({ ...base, rejouable: false, resolveurs: capable });
    expect(avec).toEqual(sans);
  });

  it("UNE MAUVAISE FORME NE CHERCHE PLUS AILLEURS — la correction qui a coûté 191 s", () => {
    // La taxonomie, tenue par un test : une erreur de forme ne doit produire ni AUTRE_SOURCE
    // ni ELARGIR, quoi que sache faire le résolveur.
    const r = deciderRecours({
      kind: "INCOMPATIBLE_RESULT", historique: HISTORIQUE_VIDE, cible: "DOCUMENT",
      rejouable: false, resolveurs: capable,
    });
    expect(["ADAPTER", "REPLAN_LOCAL"]).toContain(r.geste);
    if (r.geste !== "BLOQUER") expect(r.strategie).not.toBe("AUTRE_SOURCE");
  });
});
