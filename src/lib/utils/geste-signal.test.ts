import { describe, expect, it } from "vitest";
import { gesteDuTour, type Signal } from "./signaux";

/**
 * LE GESTE DÉCLARÉ (§118.126) — au plus UN, et jamais rien de deviné.
 *
 * Chaque cas nomme ce qui le ferait tomber : sans cela, ce ne sont pas des assertions (§118.17).
 */

/** Le jour du tour, FIXE : une assertion de date qui lit l'horloge change de verdict avec le temps. */
const AUJOURDHUI = "2026-09-11";

const base = (over: Partial<Signal> = {}): Signal => ({
  code: "etape_en_retard", gravite: "HAUTE",
  titre: "Étape en retard de 40 j — submission : Bancvax",
  detail: "Pièces manquantes : CPP fabricant, certificat BPF.",
  calcul: "aujourd'hui − prévue = 40 j",
  echeance: "2026-08-01",
  entite: { type: "RegulatoryProduct", id: "reg1", ref: "REG-BANC-RETARD" },
  href: "/regulatory/reg1",
  action: "Obtenir les pièces manquantes, puis refixer la date.",
  tache: true,
  ...over,
});

describe("le geste proposé pour un tour", () => {
  it("rend la tâche du signal le plus grave, avec son constat", () => {
    const g = gesteDuTour([
      base({ code: "pieces_manquantes", gravite: "NORMALE" }),
      base({ code: "dossier_bloque", gravite: "CRITIQUE", action: "Nommer le blocage et son propriétaire.", echeance: null }),
      base(),
    ], AUJOURDHUI);
    expect(g).not.toBeNull();
    // Le tri canonique décide, PAS l'ordre des règles : le CRITIQUE passe devant le HAUTE.
    expect(g!.code).toBe("dossier_bloque");
    expect(g!.intitule).toBe("Nommer le blocage et son propriétaire.");
    // Ce qui le ferait tomber : une tâche sans son constat — « Nommer le blocage » relu dans six
    // semaines sans le dossier ni le calcul est une consigne orpheline.
    expect(g!.pourquoi).toContain("Bancvax");
    expect(g!.pourquoi).toContain("REG-BANC-RETARD");
  });

  it("n'en rend qu'UN, même sur six constats éligibles", () => {
    const g = gesteDuTour(Array.from({ length: 6 }, (_, i) => base({ code: `c${i}` })), AUJOURDHUI);
    expect(g).not.toBeNull();
    expect(typeof g!.code).toBe("string");
  });

  it("ne propose RIEN sans le marqueur — c'est l'auteur du signal qui décide, pas la prose", () => {
    // Ce qui le ferait tomber : déduire « tâche » de la phrase d'action (§118.125).
    expect(gesteDuTour([base({ tache: undefined })], AUJOURDHUI)).toBeNull();
  });

  it("ne propose RIEN sur une gravité qui ne le mérite pas", () => {
    expect(gesteDuTour([base({ gravite: "NORMALE" })], AUJOURDHUI)).toBeNull();
    expect(gesteDuTour([base({ gravite: "BASSE" })], AUJOURDHUI)).toBeNull();
  });

  it("ne propose RIEN sans phrase à inscrire ni sans enregistrement nommé", () => {
    // Une tâche sans intitulé serait une ligne vide ; sans entité, elle ne se rattache à rien et
    // la personne ne peut pas vérifier de quoi on parle (§104.7).
    expect(gesteDuTour([base({ action: null })], AUJOURDHUI)).toBeNull();
    expect(gesteDuTour([base({ action: "   " })], AUJOURDHUI)).toBeNull();
    expect(gesteDuTour([base({ entite: null })], AUJOURDHUI)).toBeNull();
  });

  it("n'invente aucune date, et n'en porte AUCUNE quand celle du signal est passée", () => {
    expect(gesteDuTour([base({ echeance: null })], AUJOURDHUI)!.echeance).toBeNull();
    // LE CAS MESURÉ EN LIVE (§118.127) : `etape_en_retard` porte la date à laquelle l'étape ÉTAIT
    // due — le 01/08, quarante jours avant le tour. La carte sortait avec `dueDate` dans le passé,
    // donc une tâche EN RETARD À SA NAISSANCE, ce qui fait mentir tout rapport de tâches en retard.
    expect(gesteDuTour([base()], AUJOURDHUI)!.echeance).toBeNull();
    // Ce qui le ferait tomber dans l'autre sens : écarter AUSSI une échéance à venir. Sur un
    // contrat qui expire dans 18 jours, cette date est exactement celle de la tâche.
    expect(gesteDuTour([base({ echeance: "2026-09-30" })], AUJOURDHUI)!.echeance).toBe("2026-09-30");
    // Le jour MÊME reste une échéance : « à faire aujourd'hui » n'est pas du retard.
    expect(gesteDuTour([base({ echeance: AUJOURDHUI })], AUJOURDHUI)!.echeance).toBe(AUJOURDHUI);
  });

  it("rend null sur une liste vide, sans jeter", () => {
    expect(gesteDuTour([], AUJOURDHUI)).toBeNull();
  });
});
