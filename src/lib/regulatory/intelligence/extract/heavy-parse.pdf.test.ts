import { describe, it, expect } from "vitest";
import { heavyText } from "./heavy-parse";
import { makeTextPdf } from "../../../../../scripts/bench/corpus-lib";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UN VRAI PDF — le test qui manquait, et le défaut qu'il a laissé passer.
 *
 * Le chemin EN LIGNE importait l'index de `pdf-parse`, dont le harnais de démonstration tente
 * d'ouvrir `./test/data/05-versions-space.pdf`. Le worker évitait déjà le piège par un import
 * profond — mais il ne sert qu'au-delà de 100 Mo, donc TOUT PDF ordinaire passait par le chemin
 * piégé. Invisible dans le serveur Next.js, fatal dans un script ou une tâche de fond, c'est-à-
 * dire là où les documents arrivent.
 *
 * Aucun test ne l'attrapait parce qu'aucun ne donnait un PDF à lire. Celui-ci en fabrique un et
 * vérifie que le texte ressort — c'est la seule forme de preuve qui vaille ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("extraction PDF — sur un vrai fichier, pas sur une intention", () => {
  it("rend le texte d'un PDF à couche texte", async () => {
    const pdf = makeTextPdf([
      ["ADVENTUM PHARMA - ESSAI", "Dossier ESS-2026-001", "Autorite : ANPP"],
      ["Page 2 - complement de stabilite"],
    ]);
    const texte = await heavyText("pdf", pdf);
    expect(texte).toContain("ESS-2026-001");
    expect(texte).toContain("ANPP");
    // La seconde page compte autant que la première : un extracteur qui s'arrête à la page 1
    // rend un document « lu » dont les trois quarts manquent.
    expect(texte).toContain("complement de stabilite");
  }, 30_000);

  it("un PDF sans couche texte ne rend RIEN — et c'est ce qui déclenche la vision", async () => {
    // Un PDF valide dont la page est vide : le parseur ne doit pas inventer, il doit rendre vide.
    // C'est ce vide qui fait monter le document d'un barreau, et c'est donc un comportement à
    // protéger autant qu'une extraction réussie.
    const vide = makeTextPdf([[]]);
    const texte = await heavyText("pdf", vide);
    expect(texte.trim()).toBe("");
  }, 30_000);
});
