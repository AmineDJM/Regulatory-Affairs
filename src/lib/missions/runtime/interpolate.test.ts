import { describe, expect, it } from "vitest";
import { diagnostiquerReferences, injecterSorties, referencesDe, resoudreReference } from "./interpolate";

const sorties = new Map([
  ["recherche:contrat", { status: "DONE", result: { resultats: [{ id: "n1", titre: "Contrat" }], couverture: 3 } }],
  ["recherche:vide", { status: "DONE", result: { resultats: [], couverture: 0 } }],
  ["analyse.coherence", { status: "DONE", result: { actionPaiement: "APPROVE", justification: null } }],
  ["analyse", { status: "DONE", result: { coherence: { actionPaiement: "AUTRE" } } }],
  ["lecture:contrat", { status: "SKIPPED", result: null }],
]);

describe("la tuyauterie entre étapes — {{cle_etape.chemin}}", () => {
  it("reconnaît les références avec deux-points, tirets, points et indices ; dédoublonne", () => {
    expect(referencesDe({ a: "Bonjour {{contact:raihana.nom}}, {{recherche:contrat.resultats.0.id}} et {{contact:raihana.nom}}", b: ["{{x-y.z}}"] }))
      .toEqual(["contact:raihana.nom", "recherche:contrat.resultats.0.id", "x-y.z"]);
  });

  it("résout la clé d'étape par le plus long préfixe, même quand une clé contient un point", () => {
    expect(resoudreReference("analyse.coherence.actionPaiement", sorties.keys())).toEqual({ cle: "analyse.coherence", chemin: "actionPaiement" });
    expect(resoudreReference("analyse.autre", sorties.keys())).toEqual({ cle: "analyse", chemin: "autre" });
    expect(resoudreReference("recherche:contrat", sorties.keys())).toEqual({ cle: "recherche:contrat", chemin: "" });
    expect(resoudreReference("inconnue.x", sorties.keys())).toBeNull();
  });

  it("diagnostique : OK, étape inconnue, étape non aboutie, chemin absent (avec les champs disponibles), liste vide", () => {
    const d = diagnostiquerReferences({
      a: "{{recherche:contrat.resultats.0.id}}",
      b: "{{inconnue.x}}",
      c: "{{lecture:contrat.texte}}",
      d: "{{recherche:contrat.documents.0.id}}",
      e: "{{recherche:vide.resultats.0.id}}",
      f: "{{analyse.coherence.justification}}",
      g: "{{salarie.nom}}",
    }, sorties, new Set(["salarie"]));
    const par = Object.fromEntries(d.map((x) => [x.ref, x]));
    expect(par["recherche:contrat.resultats.0.id"].etat).toBe("OK");
    expect(par["inconnue.x"]).toMatchObject({ etat: "ETAPE_INCONNUE", etape: "inconnue" });
    expect(par["lecture:contrat.texte"]).toMatchObject({ etat: "ETAPE_NON_ABOUTIE", statut: "SKIPPED" });
    expect(par["recherche:contrat.documents.0.id"]).toMatchObject({ etat: "CHEMIN_ABSENT", disponibles: ["resultats", "couverture"] });
    expect(par["recherche:vide.resultats.0.id"].etat).toBe("COLLECTION_VIDE");
    // Un champ présent mais null est une valeur déclarée absente par l'amont : ce n'est pas une faute de chemin.
    expect(par["analyse.coherence.justification"].etat).toBe("OK");
    expect(par["salarie.nom"]).toBeUndefined();
  });

  it("injecte : une référence seule garde son type, dans un texte elle devient du texte, l'irrésolu ne laisse jamais « {{ » ", () => {
    const valeurs = new Map([...sorties].map(([k, v]) => [k, v.result] as const));
    expect(injecterSorties("{{recherche:contrat.resultats.0}}", valeurs)).toEqual({ id: "n1", titre: "Contrat" });
    expect(injecterSorties("{{recherche:contrat.couverture}}", valeurs)).toBe(3);
    expect(injecterSorties("Dossier {{recherche:contrat.resultats.0.titre}} — {{analyse.coherence.actionPaiement}}", valeurs))
      .toBe("Dossier Contrat — APPROVE");
    expect(injecterSorties({ x: "{{inconnue.y}}", y: "a {{inconnue.y}} b" }, valeurs)).toEqual({ x: undefined, y: "a  b" });
  });
});
