import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoutonDecisif } from "./bouton-decisif";
import { annonceArme, DELAI_CONFIRMATION_MS, gesteDuClic, libelleConfirmation, texteDesEnfants } from "./bouton-decisif-regle";

/**
 * LE BOUTON DÉCISIF — une double confirmation, une seule mécanique.
 *
 * Le dépôt n'a ni jsdom ni happy-dom : on ne peut pas cliquer ici. La mécanique est donc une règle PURE
 * (`gesteDuClic`), éprouvée cas par cas, et le composant une couche mince dont on vérifie (1) le rendu
 * au repos par le vrai rendu React, (2) les POINTS D'APPEL de la règle dans la source — vérifier la
 * règle sans son appelant ne prouverait rien (§118.49).
 */

describe("la règle du second clic", () => {
  it("premier clic : on ARME, rien ne part", () => {
    expect(gesteDuClic({ arme: false, desactive: false, formulaireInvalide: false })).toBe("armer");
  });
  it("second clic : on EXÉCUTE", () => {
    expect(gesteDuClic({ arme: true, desactive: false, formulaireInvalide: false })).toBe("executer");
  });
  it("désactivé : rien, armé ou non", () => {
    expect(gesteDuClic({ arme: false, desactive: true, formulaireInvalide: false })).toBe("rien");
    expect(gesteDuClic({ arme: true, desactive: true, formulaireInvalide: false })).toBe("rien");
  });
  it("un formulaire invalide (motif `required` vide) se SIGNALE avant d'armer, et avant d'exécuter", () => {
    expect(gesteDuClic({ arme: false, desactive: false, formulaireInvalide: true })).toBe("signalerFormulaire");
    expect(gesteDuClic({ arme: true, desactive: false, formulaireInvalide: true })).toBe("signalerFormulaire");
  });
  it("le délai est de 5 secondes", () => {
    expect(DELAI_CONFIRMATION_MS).toBe(5_000);
  });
});

describe("ce que dit le bouton armé", () => {
  it("nomme l'action d'après le texte du bouton, icônes et ponctuation retirées", () => {
    const enfants = [React.createElement("svg", { key: "i" }), " ", "Refuser"];
    expect(libelleConfirmation(undefined, enfants)).toBe("Confirmer : Refuser ?");
    expect(libelleConfirmation(undefined, "Annuler ce dossier…")).toBe("Confirmer : Annuler ce dossier ?");
    expect(texteDesEnfants(React.createElement("span", null, "Valider ", React.createElement("b", null, "le BC")))).toBe("Valider le BC");
  });
  it("l'appelant peut nommer l'action ; sans rien à lire, « cette action » (jamais une phrase vide)", () => {
    expect(libelleConfirmation("détruire DÉFINITIVEMENT « X »", "Détruire")).toBe("Confirmer : détruire DÉFINITIVEMENT « X » ?");
    expect(libelleConfirmation(undefined, React.createElement("svg"))).toBe("Confirmer : cette action ?");
  });
  it("la zone vivante dit le délai et la touche Échap", () => {
    expect(annonceArme("Confirmer : Refuser ?")).toBe(
      "Confirmer : Refuser ? Cliquez de nouveau dans les 5 secondes pour confirmer, ou appuyez sur Échap pour annuler.",
    );
  });
});

describe("le bouton au repos (vrai rendu React)", () => {
  it("rend le libellé d'origine, sans « Confirmer » ni « Annuler », et une zone vivante vide", () => {
    const html = renderToStaticMarkup(React.createElement(BoutonDecisif, { name: "decision", value: "REJECTED" }, "Refuser"));
    expect(html).toContain(">Refuser</button>");
    expect(html).toContain('data-decisif="repos"');
    expect(html).toContain('name="decision"');
    expect(html).toContain('value="REJECTED"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("Confirmer");
    expect(html).not.toContain(">Annuler<");
    // Une zone vivante SANS rôle « status » : l'écran qui l'héberge garde son propre statut, seul.
    expect(html).toContain('<span class="sr-only" aria-live="polite" aria-atomic="true"></span>');
    expect(html).not.toContain('role="status"');
  });
  it("respecte `disabled` et le `type` de l'appelant", () => {
    const html = renderToStaticMarkup(React.createElement(BoutonDecisif, { disabled: true, type: "button" }, "Approuver"));
    expect(html).toContain('type="button"');
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
  it("`brut` rend un <button> nu, avec les seules classes de l'appelant", () => {
    const brut = renderToStaticMarkup(React.createElement(BoutonDecisif, { brut: true, className: "maison" }, "Payé"));
    expect(brut).toMatch(/<button[^>]*class="maison"/);
    const style = renderToStaticMarkup(React.createElement(BoutonDecisif, { className: "maison" }, "Payé"));
    expect(style).toMatch(/<button[^>]*class="[^"]*inline-flex[^"]*maison/);
  });
});

describe("POINTS D'APPEL — le composant lit la règle, et rien d'autre", () => {
  const src = readFileSync("src/components/ui/bouton-decisif.tsx", "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

  it("le clic passe par `gesteDuClic`, l'`onClick` d'origine n'est appelé QUE sur « executer »", () => {
    expect(src).toContain("const geste = gesteDuClic({ arme, desactive: !!disabled, formulaireInvalide });");
    expect(src).toMatch(/if \(geste === "executer"\) \{\s*setArme\(false\);\s*onClick\?\.\(e\);\s*return;/);
    expect(src.match(/onClick\?\.\(/g)?.length).toBe(1);
  });
  it("hors exécution, la soumission est EMPÊCHÉE (le premier clic ne soumet pas le formulaire)", () => {
    const apres = src.slice(src.indexOf('if (geste === "executer")'));
    expect(apres).toMatch(/return;[^]*?\}\s*e\.preventDefault\(\);/);
  });
  it("la validation HTML du formulaire est lue, et signalée par le navigateur", () => {
    expect(src).toContain("!formulaire.checkValidity()");
    expect(src).toContain("formulaire?.reportValidity();");
  });
  it("Échap désarme, le délai désarme, un bouton désactivé se désarme", () => {
    expect(src).toMatch(/arme && e\.key === "Escape"/);
    expect(src).toContain("window.setTimeout(() => setArme(false), delaiMs)");
    expect(src).toContain("if (disabled && arme) setArme(false);");
  });
  it("aucune fenêtre du navigateur", () => {
    expect(src).not.toMatch(/window\.(confirm|alert|prompt)\(/);
  });
});
