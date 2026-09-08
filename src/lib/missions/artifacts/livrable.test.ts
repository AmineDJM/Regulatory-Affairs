import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { ouvrirEtControler } from "@/lib/missions/artifacts/verify";
import { docxDeParagraphes, pdfNumerote, pptxDiapos, xlsxVentes } from "@/lib/artifact/adapters/fixtures";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE LIVRABLE D'UNE MISSION EST OUVERT — pas seulement reniflé.
 *
 * ── LES QUATRE FAUX SUCCÈS QUE CE FICHIER EXISTE POUR ATTRAPER ───────────────────────────
 *
 * Le contrôle d'un Word, d'un PowerPoint ou d'un PDF produit par une mission était : plus de
 * 200 octets, et les quatre premiers valent `PK\x03\x04` (ou `%PDF`). C'est vrai d'une archive
 * VIDE. Passaient donc en VERIFIED — le seul statut qui vaut preuve d'achèvement (§118.10) :
 *
 *   1. un document sans un seul paragraphe ;
 *   2. une présentation sans une seule diapositive ;
 *   3. un PDF sans page ;
 *   4. un contrat portant encore « [à compléter] », « XXX » ou « {{client}} ».
 *
 * Les quatre partent chez quelqu'un. Le quatrième est le pire : il s'ouvre, il s'imprime, il a
 * l'air fini, et le trou est dedans.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Une archive VALIDE et VIDE — ce que l'ancien contrôle laissait passer sans broncher. */
async function zipVide(): Promise<Buffer> {
  const z = new JSZip();
  z.file("rien.txt", "x".repeat(400));
  return Buffer.from(await z.generateAsync({ type: "nodebuffer" }));
}

describe("un livrable qui n'en est pas un est REFUSÉ", () => {
  it("une archive valide mais qui n'est pas un Word ne passe pas", async () => {
    const r = await ouvrirEtControler(await zipVide(), "DOCX");
    expect(r.ok, "une archive vide a été acceptée comme livrable Word").toBe(false);
    // La signature est bonne (c'est un zip) : c'est l'OUVERTURE qui doit refuser.
    expect(r.points.find((p) => p.nom === "signature")?.ok).toBe(true);
    expect(r.points.some((p) => !p.ok && /ouvre pas|relit/.test(p.detail))).toBe(true);
  });

  it("un Word qui porte encore « [à compléter] » est BLOQUÉ", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : s'arrêter à « le fichier s'ouvre ». Le document est
     * parfaitement valide — c'est justement pour cela qu'il part chez le client avec le trou.
     */
    const octets = await docxDeParagraphes([
      "Contrat de distribution",
      "Article 1 — Objet : fourniture de [à compléter] unités par trimestre.",
    ]);
    const r = await ouvrirEtControler(octets, "DOCX");
    expect(r.ok).toBe(false);
    const bloc = r.points.find((p) => p.nom === "livrable");
    expect(bloc?.ok).toBe(false);
    expect(bloc?.detail).toContain("à compléter");
  });

  it("un Word qui porte un gabarit non rempli ({{client}}) est BLOQUÉ", async () => {
    const r = await ouvrirEtControler(
      await docxDeParagraphes(["Lettre", "Madame, Monsieur {{client}},"]), "DOCX",
    );
    expect(r.ok).toBe(false);
    expect(r.points.find((p) => p.nom === "livrable")?.detail).toContain("{{client}}");
  });

  it("un PDF sans page est refusé", async () => {
    const r = await ouvrirEtControler(await pdfNumerote(0), "PDF");
    expect(r.ok).toBe(false);
  });
});

describe("un livrable correct passe, et le rapport DIT ce qu'il contient", () => {
  it("un Word réel : le rapport compte les paragraphes, pas les octets", async () => {
    const r = await ouvrirEtControler(
      await docxDeParagraphes(["Note de service", "Le point sur les dossiers.", "Trois dépôts sont partis."]),
      "DOCX",
    );
    expect(r.ok, r.points.filter((p) => !p.ok).map((p) => p.detail).join(" ; ")).toBe(true);
    const contenu = r.points.find((p) => p.nom === "contenu")!;
    expect(contenu.detail).toMatch(/3 paragraphe\(s\) non vides/);
  });

  it("une présentation réelle : le rapport compte les diapositives", async () => {
    const r = await ouvrirEtControler(await pptxDiapos(5), "PPTX");
    expect(r.ok, r.points.filter((p) => !p.ok).map((p) => p.detail).join(" ; ")).toBe(true);
    expect(r.points.find((p) => p.nom === "contenu")!.detail).toContain("5 diapositive(s)");
  });

  it("un PDF réel : le rapport compte les pages", async () => {
    const r = await ouvrirEtControler(await pdfNumerote(4), "PDF");
    expect(r.ok, r.points.filter((p) => !p.ok).map((p) => p.detail).join(" ; ")).toBe(true);
    expect(r.points.find((p) => p.nom === "contenu")!.detail).toContain("4 page(s)");
  });

  it("un classeur réel : le rapport compte les feuilles et les cellules remplies", async () => {
    const r = await ouvrirEtControler(await xlsxVentes(), "XLSX");
    expect(r.ok, r.points.filter((p) => !p.ok).map((p) => p.detail).join(" ; ")).toBe(true);
    expect(r.points.find((p) => p.nom === "contenu")!.detail).toMatch(/2 feuille\(s\)/);
  });
});

describe("ce que le contrôle ne prétend pas faire", () => {
  it("un format qu'on n'ouvre pas le DIT au lieu de se déclarer vérifié", async () => {
    /**
     * §34 : une limitation se nomme. « ZIP contrôlé » sur un fichier dont on n'a lu que les
     * quatre premiers octets serait une réussite inventée.
     */
    const r = await ouvrirEtControler(await zipVide(), "ZIP");
    expect(r.ok).toBe(true);
    expect(r.nonVerifie.join(" ")).toContain("n'est pas ouvert");
  });

  it("des octets qui ne sont pas le format annoncé sont refusés AVANT l'ouverture", async () => {
    const r = await ouvrirEtControler(Buffer.from("ceci n'est pas un document".repeat(20)), "DOCX");
    expect(r.ok).toBe(false);
    expect(r.points.find((p) => p.nom === "signature")?.ok).toBe(false);
  });

  it("un fichier minuscule est refusé sur sa taille, sans faire porter le refus à l'adaptateur", async () => {
    const r = await ouvrirEtControler(Buffer.from("PK\x03\x04"), "DOCX");
    expect(r.ok).toBe(false);
    expect(r.points.find((p) => p.nom === "taille")?.ok).toBe(false);
  });
});

describe("les avertissements sont DITS sans bloquer", () => {
  it("une numérotation d'articles qui saute n'empêche pas de livrer, mais se remonte", async () => {
    const r = await ouvrirEtControler(
      await docxDeParagraphes(["Contrat", "Article 1 — Objet", "Article 3 — Durée"]), "DOCX",
    );
    expect(r.ok, "un avertissement a bloqué une livraison").toBe(true);
    expect((r.avertissements ?? []).join(" ")).toMatch(/saute de 1 à 3/);
  });
});

describe("le contrôle a bien son APPELANT de production", () => {
  it("`build.ts` OUVRE le livrable — un contrôle non appelé ne protège de rien (§118.47)", () => {
    /**
     * MESURÉ AILLEURS, ET C'EST LA RAISON DE CE TEST : `daterLEntree` était écrite, commentée
     * et couverte par un test qui lisait son corps ; son appel avait été perdu dans une
     * édition, et 2 332 reçus sont partis sans date. Un test qui vérifie une fonction sans
     * vérifier qu'on l'appelle est vert sur du code mort.
     */
    const src = readFileSync("src/lib/missions/artifacts/build.ts", "utf8");
    expect(src, "la fabrique de livrables n'ouvre plus le fichier qu'elle produit")
      .toContain("ouvrirEtControler(rendu.buffer, spec.format");
    // Et l'ancien contrôle de surface ne doit pas être revenu par la porte d'à côté.
    expect(src).not.toContain("controleGenerique");
  });
});
