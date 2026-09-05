import { describe, it, expect } from "vitest";
import { routeQuery } from "./router";
import { GOLDEN_CORPUS } from "./golden-corpus";
import { HOLDOUT_CORPUS } from "./holdout-corpus";
import { POWER_TOOLS } from "@/lib/assistant/power-tools";

/**
 * LE CONTRAT ENTRE LE CHEMIN RAPIDE ET L'OUTIL QU'IL APPELLE.
 *
 * Le routeur choisit un outil ET fabrique ses arguments sans modèle. Si la clé qu'il écrit n'est
 * pas celle que l'outil lit, personne ne le voit : l'outil répond « il me faut une référence »,
 * le modèle répète cette phrase, et la question la plus fréquente du PDG (« où en est X ? »)
 * échoue proprement — mesuré au banc, sur `inspect_record` servi avec `query` au lieu de
 * `reference`. Les tests du routeur vérifiaient les arguments ; ceux de l'outil vérifiaient la
 * lecture ; aucun ne vérifiait qu'ils parlent de la même chose. Celui-ci le fait, sur les deux
 * corpus, pour chaque route déterministe.
 */
describe("chemin rapide → outil : chaque argument écrit est un argument lu", () => {
  const schemas = new Map(POWER_TOOLS.map((t) => [t.def.name, t.def.input_schema as { properties?: Record<string, unknown>; required?: string[] }]));

  it("les clés d'arguments des routes FAST_DETERMINISTIC existent dans le schéma de l'outil, et ses champs obligatoires sont servis", () => {
    const fautes: string[] = [];
    for (const c of [...GOLDEN_CORPUS, ...HOLDOUT_CORPUS]) {
      const r = routeQuery(c.utterance, c.ctx ?? {});
      if (r.route !== "FAST_DETERMINISTIC" || !r.tool) continue;
      const schema = schemas.get(r.tool);
      if (!schema) { fautes.push(`${c.id} : outil « ${r.tool} » inconnu du registre`); continue; }
      const props = new Set(Object.keys(schema.properties ?? {}));
      for (const k of Object.keys(r.args)) {
        if (!props.has(k)) fautes.push(`${c.id} « ${c.utterance} » : ${r.tool} ne lit pas « ${k} » (lit : ${[...props].join(", ")})`);
      }
      for (const k of schema.required ?? []) {
        if (!(k in r.args)) fautes.push(`${c.id} « ${c.utterance} » : ${r.tool} exige « ${k} », le routeur ne l'a pas fourni`);
      }
    }
    expect(fautes).toEqual([]);
  });
});
