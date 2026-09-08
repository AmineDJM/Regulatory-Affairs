/**
 * LE DÉCODEUR DIRECT (§30, §57-58) — ce qu'il comprend, et surtout ce qu'il REFUSE de deviner.
 *
 * La moitié de ce fichier vérifie des `null`. Ce n'est pas du remplissage : un décodeur qui
 * attrape une phrase qu'il comprend mal est PIRE qu'un décodeur absent, parce qu'il empêche le
 * modèle — qui l'aurait bien traitée — de prendre la main. Chaque `toBeNull()` ici est une
 * phrase qu'on laisse passer au modèle exprès.
 */

import { describe, it, expect } from "vitest";
import { decoder, estAccord, pagesCitees } from "@/lib/artifact/commands/nl";
import type { ContexteDecodage } from "@/lib/artifact/commands/nl";

const ctxDocx: ContexteDecodage = { format: "DOCX", derniereCible: [], activePage: null, activeSlide: null, activeSheet: null };
const ctxPdf: ContexteDecodage = { ...ctxDocx, format: "PDF", activePage: 1 };
const ctxPptx: ContexteDecodage = { ...ctxDocx, format: "PPTX", activeSlide: 2 };
const ctxXlsx: ContexteDecodage = { ...ctxDocx, format: "XLSX", activeSheet: "Ventes" };

/** Raccourci : la première commande d'une intention, ou l'échec du test. */
function cmd(intention: ReturnType<typeof decoder>) {
  if (!intention || intention.genre !== "commandes") throw new Error(`attendu des commandes, reçu ${intention?.genre ?? "null"}`);
  return intention.commandes[0];
}

describe("les gestes de session", () => {
  it("reconnaît « annule », « finalement annule la dernière modification »", () => {
    expect(decoder("annule", ctxDocx)).toEqual({ genre: "annuler" });
    expect(decoder("Finalement annule la dernière modification.", ctxDocx)).toEqual({ genre: "annuler" });
    expect(decoder("Reviens en arrière", ctxDocx)).toEqual({ genre: "annuler" });
  });

  it("reconnaît « sauvegarde » et « enregistre sous … »", () => {
    expect(decoder("Sauvegarde.", ctxDocx)).toEqual({ genre: "sauvegarder", sousLeNom: null });
    expect(decoder("C'est bon. Sauvegarde", ctxDocx)).toEqual({ genre: "sauvegarder", sousLeNom: null });
    expect(decoder("Enregistre sous Contrat Mouffok v2.docx", ctxDocx))
      .toEqual({ genre: "sauvegarder", sousLeNom: "Contrat Mouffok v2.docx" });
  });

  it("« c'est bon » SEUL est un accord, pas une commande (§58)", () => {
    expect(estAccord("C'est bon")).toBe(true);
    expect(estAccord("Là c'est bon")).toBe(true);
    expect(estAccord("Parfait")).toBe(true);
    // « C'est bon, supprime la page 3 » n'est PAS un simple accord : il porte une instruction.
    expect(estAccord("C'est bon, supprime la page 3")).toBe(false);
  });
});

describe("Word — le dialogue de référence", () => {
  it("« Centre le titre » vise le TITRE et demande le centrage", () => {
    const c = cmd(decoder("Centre le titre", ctxDocx));
    expect(c.op).toBe("docx.align");
    expect(c.alignement).toBe("center");
    expect(c.cible?.role).toBe("titre");
  });

  it("« réduis-le à 16 » donne 16 points, pas 16 autre chose", () => {
    const c = cmd(decoder("Réduis-le à 16", ctxDocx));
    expect(c.op).toBe("docx.format_texte");
    expect(c.taillePt).toBe(16);
  });

  it("« mets-le en Aptos » demande la police, pas un alignement", () => {
    const c = cmd(decoder("Mets le titre en Aptos", ctxDocx));
    expect(c.op).toBe("docx.format_texte");
    expect(c.police).toBe("Aptos");
    expect(c.cible?.role).toBe("titre");
  });

  it("« mets-le en gras » n'est PAS lu comme la police « gras »", () => {
    const c = cmd(decoder("Mets le titre en gras", ctxDocx));
    expect(c.op).toBe("docx.format_texte");
    expect(c.gras).toBe(true);
    expect(c.police).toBeNull();
  });

  it("« un peu plus à gauche » est un RETRAIT relatif, pas un alignement", () => {
    const c = cmd(decoder("Le titre un peu plus à gauche", ctxDocx));
    expect(c.op).toBe("docx.retrait");
    // Négatif = vers la gauche. « Un peu » vaut un demi-centimètre.
    expect(c.gaucheCm).toBe(-0.5);
  });

  it("« beaucoup plus à droite » déplace plus loin que « un peu »", () => {
    expect(cmd(decoder("Beaucoup plus à droite", ctxDocx)).gaucheCm).toBe(3);
    expect(cmd(decoder("Un peu plus à droite", ctxDocx)).gaucheCm).toBe(0.5);
    expect(cmd(decoder("Plus à droite", ctxDocx)).gaucheCm).toBe(1.5);
  });

  it("« encore » réutilise la DERNIÈRE cible, via le working set", () => {
    const avecCible: ContexteDecodage = { ...ctxDocx, derniereCible: ["p1"] };
    const c = cmd(decoder("Encore un peu plus à gauche", avecCible));
    expect(c.cible?.id).toBe("p1");
  });

  it("« supprime le troisième paragraphe » vise le rang 3, à l'humaine", () => {
    const c = cmd(decoder("Supprime le troisième paragraphe", ctxDocx));
    expect(c.op).toBe("docx.supprimer_paragraphe");
    expect(c.cible?.index).toBe(3);
  });

  it("« supprime le dernier paragraphe » vise le rôle, pas un rang", () => {
    const c = cmd(decoder("Supprime le dernier paragraphe", ctxDocx));
    expect(c.cible?.role).toBe("dernier");
    expect(c.cible?.index).toBeNull();
  });

  it("« remonte un peu le tableau » DÉPLACE le tableau, il ne change pas son espacement", () => {
    const c = cmd(decoder("Remonte un peu le tableau", ctxDocx));
    expect(c.op).toBe("docx.deplacer");
    expect(c.direction).toBe("haut");
  });

  it("« supprime un paragraphe » sans dire lequel n'est PAS deviné", () => {
    expect(decoder("Supprime un paragraphe", ctxDocx)).toBeNull();
  });
});

describe("PDF — les pages", () => {
  it("« supprime les pages 12, 14 et 18 » lit les trois", () => {
    const c = cmd(decoder("Supprime les pages 12, 14 et 18", ctxPdf));
    expect(c.op).toBe("pdf.supprimer_pages");
    expect(c.pages).toEqual([12, 14, 18]);
  });

  it("« supprime les pages 3 à 7 » développe l'intervalle, bornes comprises", () => {
    expect(cmd(decoder("Supprime les pages 3 à 7", ctxPdf)).pages).toEqual([3, 4, 5, 6, 7]);
  });

  it("un intervalle ET des pages isolées se combinent", () => {
    expect(pagesCitees("pages 2 à 4, 9 et 12")).toEqual([2, 3, 4, 9, 12]);
  });

  it("« pivote la page 3 » tourne de 90° par défaut, et lit 180 quand on le dit", () => {
    expect(cmd(decoder("Pivote la page 3", ctxPdf)).degres).toBe(90);
    expect(cmd(decoder("Pivote la page 3 de 180", ctxPdf)).degres).toBe(180);
    expect(cmd(decoder("Pivote la page 3 de 180", ctxPdf)).pages).toEqual([3]);
  });

  it("« supprime des pages » sans numéro n'est PAS deviné", () => {
    expect(decoder("Supprime les pages inutiles", ctxPdf)).toBeNull();
  });
});

describe("PowerPoint et Excel", () => {
  it("« diapo 3 : supprime » cible la 3, pas la diapo active", () => {
    const c = cmd(decoder("Supprime la diapo 3", ctxPptx));
    expect(c.op).toBe("pptx.supprimer_diapo");
    expect(c.diapo).toBe(3);
  });

  it("« plus à gauche » sur PowerPoint utilise la diapo ACTIVE quand rien n'est dit", () => {
    const c = cmd(decoder("Un peu plus à gauche", ctxPptx));
    expect(c.op).toBe("pptx.deplacer");
    expect(c.diapo).toBe(2);
    expect(c.dxCm).toBe(-0.5);
  });

  it("« mets B4 à 120000 » écrit une valeur dans la feuille active", () => {
    const c = cmd(decoder("Mets B4 à 120000", ctxXlsx));
    expect(c.op).toBe("xlsx.valeur");
    expect(c.plage).toBe("B4");
    expect(c.texte).toBe("120000");
    expect(c.feuille).toBe("Ventes");
  });

  it("« mets C6 à =SOMME(C2:C5) » est reconnu comme une FORMULE", () => {
    const c = cmd(decoder("Mets C6 à =SOMME(C2:C5)", ctxXlsx));
    expect(c.op).toBe("xlsx.formule");
    expect(c.formule?.toUpperCase()).toContain("SOMME");
  });
});

describe("ce que le décodeur laisse au modèle", () => {
  it.each([
    "Refais-moi ce contrat dans un style plus formel",
    "Ajoute une clause de confidentialité après l'article 3",
    "Résume-moi ce document",
    "Remplace la photo par une vue d'Alger",
    "Harmonise la mise en page avec le modèle de la maison",
  ])("« %s » n'est pas décodé directement", (phrase) => {
    expect(decoder(phrase, ctxDocx)).toBeNull();
  });

  it("une phrase Word ne produit jamais une commande PDF", () => {
    const i = decoder("Supprime les pages 12, 14 et 18", ctxDocx);
    // Le décodeur Word ne connaît pas les pages : il rend null, et le modèle expliquera qu'un
    // `.docx` n'a pas de pages manipulables. Produire une commande PDF ici serait un défaut.
    expect(i).toBeNull();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'ÉDITION DE PRÉCISION — les phrases exactes demandées.
 *
 * Le décodeur savait décaler « un peu » (0,5 cm) ou « beaucoup » (2 cm). Il ne savait pas lire
 * « de 1,2 cm » : la phrase portait la mesure, il la remplaçait par son estimation. Et `rang()`
 * prenait le PREMIER nombre — « le paragraphe 3 de 1,2 cm » lui donnait 1, donc il déplaçait le
 * paragraphe 1 en annonçant que c'était fait (§104.7).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
describe("édition de PRÉCISION — la mesure écrite l'emporte sur l'estimation", () => {
  const ctx = ctxDocx;

  it("« décale ce titre de 1,2 cm à droite » décale de 1,2 cm, pas d'un pas standard", () => {
    const r = decoder("décale ce titre de 1,2 cm à droite", ctx);
    expect(r?.genre).toBe("commandes");
    if (r?.genre !== "commandes") return;
    expect(r.commandes[0].op).toBe("docx.retrait");
    expect(r.commandes[0].gaucheCm).toBeCloseTo(1.2, 3);
  });

  it("« décale de 4 mm à gauche » est un décalage NÉGATIF de 0,4 cm", () => {
    const r = decoder("décale le titre de 4 mm à gauche", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].gaucheCm).toBeCloseTo(-0.4, 3);
  });

  it("SANS mesure, l'estimation qualitative reste — on n'a rien cassé", () => {
    const r = decoder("décale le titre un peu à droite", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].gaucheCm).toBeGreaterThan(0);
    expect(r.commandes[0].gaucheCm).toBeLessThan(1);
  });

  it("LE DÉFAUT SILENCIEUX : « le paragraphe 3 de 1,2 cm » vise le 3, jamais le 1", () => {
    const r = decoder("décale le paragraphe 3 de 1,2 cm à droite", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].cible?.index).toBe(3);
    expect(r.commandes[0].gaucheCm).toBeCloseTo(1.2, 3);
  });

  it("« augmente l'interligne de ce paragraphe à 1,5 » règle l'air ENTRE les lignes", () => {
    const r = decoder("augmente l'interligne de ce paragraphe à 1,5", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].op).toBe("docx.interligne");
    expect(r.commandes[0].interligne).toBe(1.5);
  });

  it("« double interligne » vaut 2", () => {
    const r = decoder("mets le titre en double interligne", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].op).toBe("docx.interligne");
    expect(r.commandes[0].interligne).toBe(2);
  });

  it("« uniquement le troisième mot en Arial 10 » ne repeint PAS le paragraphe entier", () => {
    const r = decoder("uniquement le troisième mot en Arial 10", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].op).toBe("docx.format_texte");
    expect(r.commandes[0].cible?.mot).toBe(3);
    expect(r.commandes[0].police).toBe("Arial");
    expect(r.commandes[0].taillePt).toBe(10);
  });

  it("« le dernier mot en gras » vise le dernier, pas tout le paragraphe", () => {
    const r = decoder("mets le dernier mot en gras", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].cible?.mot).toBe(-1);
    expect(r.commandes[0].gras).toBe(true);
  });

  it("SANS « mot », la mise en forme porte sur toute la cible — l'ancien comportement", () => {
    const r = decoder("mets le titre en gras", ctx);
    if (r?.genre !== "commandes") throw new Error("non décodé");
    expect(r.commandes[0].cible?.mot ?? null).toBeNull();
  });
});
