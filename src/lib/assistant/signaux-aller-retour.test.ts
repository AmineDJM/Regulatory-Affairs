import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lireSignauxDeSortie } from "./intelligence-tools";
import { gesteDuTour } from "@/lib/utils/signaux";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉCRIVAIN ET LE LECTEUR DISENT-ILS LE MÊME NOM ? — §118.127.
 *
 * LE DÉFAUT MESURÉ. La sortie d'un outil d'intelligence est écrite pour le MODÈLE, qui lit du
 * français : `Signal.action` y devient `aFaire`, `Signal.href` y devient `fiche`. Le relecteur,
 * lui, s'écrivait `objet.signaux.filter((s): s is Signal => …)` sur trois `typeof` — un prédicat
 * qui AFFIRME un type qu'il ne prouve pas. Tout signal relu portait donc `action: undefined`,
 * `gesteDuTour` les refusait TOUS, et la mesure live a rendu ZÉRO carte sur une réponse qui
 * nommait six blocages. Le mécanisme était écrit, testé, branché — et sans effet (§118.14).
 *
 * POURQUOI LES BANCS EXISTANTS NE POUVAIENT PAS LE VOIR. `geste-signal.test.ts` fabrique ses
 * entrées depuis le type `Signal` CANONIQUE : il confirmait donc la lecture amputée, exactement
 * comme `capabilite-parc.test.ts` confirmait une liste de champs amputée en la fabriquant depuis
 * le contrat (§118.87c). Un banc qui construit son entrée depuis la MÊME source que le code
 * qu'il juge ne peut pas attraper un désaccord entre deux sources.
 *
 * CE QU'IL FAUT DONC LIRE : les DEUX CÔTÉS, et aucun des deux retapé à la main. Les clés que
 * l'écrivain ÉMET et celles que le lecteur CONSOMME sont extraites de la source ; un renommage
 * d'un côté fait tomber le banc, quel que soit le côté.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const SRC = readFileSync(join(process.cwd(), "src/lib/assistant/intelligence-tools.ts"), "utf8");
// Les commentaires sont RETIRÉS : celui du lecteur ÉCRIT « `action` y devient `aFaire` » pour
// documenter ce défaut, et un cliquet qui s'accroche à la prose qui le décrit ne mesure rien
// (§118.79d, §118.88, §118.112b — trois fois ce piège s'est refermé sur son propre auteur).
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** Les clés que l'ÉCRIVAIN pose sur chaque signal de la sortie JSON. */
function clesEmises(): Set<string> {
  const debut = CODE.indexOf("signaux: retenus");
  expect(debut, "le bloc d'écriture des signaux doit être trouvable").toBeGreaterThan(0);
  const bloc = CODE.slice(debut, CODE.indexOf("parEntite: [", debut));
  const cles = new Set<string>();
  // Clés ordinaires (`gravite: s.gravite`) ET clés conditionnelles (`...(s.tache ? { tache: … })`).
  for (const m of bloc.matchAll(/(?:^|[{,\s])([a-zA-Z][a-zA-Z0-9]*)\s*:/g)) cles.add(m[1]);
  return cles;
}

/** Les clés que le LECTEUR va chercher dans la sortie. */
function clesLues(): Set<string> {
  const debut = CODE.indexOf("export function lireSignauxDeSortie");
  expect(debut, "le lecteur doit être trouvable").toBeGreaterThan(0);
  const bloc = CODE.slice(debut);
  const cles = new Set<string>();
  for (const m of bloc.slice(0, bloc.indexOf("\n}\n")).matchAll(/\bf\.([a-zA-Z][a-zA-Z0-9]*)/g)) cles.add(m[1]);
  return cles;
}

describe("l'aller-retour écrivain → lecteur des signaux", () => {
  it("chaque clé que le lecteur va chercher est une clé que l'écrivain ÉMET", () => {
    const emises = clesEmises();
    const lues = clesLues();
    expect(lues.size, "le lecteur doit lire des champs, sinon l'extraction est cassée").toBeGreaterThan(5);
    const orphelines = [...lues].filter((c) => !emises.has(c));
    // C'EST L'ASSERTION QUI MANQUAIT : `action` lu contre `aFaire` écrit tombe ici, et `fiche`
    // renommé demain tombe aussi. Le message nomme les deux listes, parce qu'un écart entre deux
    // sources ne se corrige pas sans savoir laquelle des deux a bougé (§118.30).
    expect(orphelines, `clés lues et jamais écrites : ${orphelines.join(", ")} — l'écrivain pose ${[...emises].sort().join(", ")}`).toEqual([]);
  });

  it("tout ce dont `gesteDuTour` a besoin traverse réellement la sortie", () => {
    const lues = clesLues();
    // Les quatre faits que le sélecteur EXIGE (marqueur, gravité, phrase, enregistrement). Si l'un
    // ne traverse pas, le geste est refusé pour toujours et en silence — le défaut mesuré.
    for (const besoin of ["tache", "gravite", "aFaire", "entite"]) {
      expect(lues.has(besoin), `le lecteur doit lire « ${besoin} », sinon aucun geste ne sera jamais proposé`).toBe(true);
    }
  });

  it("le lecteur TRADUIT : une sortie au format de l'écrivain rend un signal éligible", () => {
    // La sortie est reconstituée avec les noms de l'ÉCRIVAIN (`aFaire`, `fiche`) — pas avec ceux
    // du type canonique, ce qui serait re-fabriquer l'entrée depuis la mauvaise source (§118.87c).
    const sortie = JSON.stringify({
      source: "règles déterministes",
      signaux: [{
        gravite: "HAUTE", code: "etape_en_retard", titre: "Étape en retard de 40 j — submission : Bancvax",
        detail: "Pièces manquantes.", calcul: "aujourd'hui − prévue = 40 j", echeance: "2026-09-30",
        tache: true, montant: null, entite: { type: "RegulatoryProduct", id: "reg1", ref: "REG-BANC-RETARD" },
        fiche: "/regulatory/reg1", aFaire: "Obtenir les pièces manquantes, puis refixer la date.",
      }],
    });
    const relus = lireSignauxDeSortie(sortie);
    expect(relus).toHaveLength(1);
    expect(relus[0].action).toBe("Obtenir les pièces manquantes, puis refixer la date.");
    expect(relus[0].href).toBe("/regulatory/reg1");
    expect(relus[0].tache).toBe(true);
    const g = gesteDuTour(relus, "2026-09-11");
    expect(g, "un signal marqué, grave, avec sa phrase et son enregistrement DOIT rendre un geste").not.toBeNull();
    expect(g!.intitule).toBe("Obtenir les pièces manquantes, puis refixer la date.");
    expect(g!.href).toBe("/regulatory/reg1");
  });

  it("ce qui n'est pas de nous, ou illisible, rend une liste VIDE — jamais une exception", () => {
    expect(lireSignauxDeSortie("")).toEqual([]);
    expect(lireSignauxDeSortie("Aucune enveloppe budgétaire ne vous est ouverte.")).toEqual([]);
    expect(lireSignauxDeSortie('{"signaux":')).toEqual([]);
    expect(lireSignauxDeSortie('{"signaux": "pas une liste"}')).toEqual([]);
    // Les alertes exécutives portent `criticite`, pas `gravite` : elles sont écartées par la FORME,
    // sans qu'on ait à nommer l'outil dont elles viennent (§118.17).
    expect(lireSignauxDeSortie('{"signaux":[{"code":"x","criticite":"CRITICAL","titre":"t"}]}')).toEqual([]);
  });
});
