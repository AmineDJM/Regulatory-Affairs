import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { adaptateurPptx } from "@/lib/artifact/adapters/pptx/adapter";
import { construireDossier } from "@/lib/artifact/factory/dossier";
import { lireClasseur } from "@/lib/artifact/sheets/reader";
import { feuilleParNom, lireCellule } from "@/lib/artifact/sheets/model";
import type { DonneesCanoniques } from "@/lib/artifact/factory/canonical";
import type { DocxModel, PptxModel } from "@/lib/artifact/object-model/model";

const canon = (): DonneesCanoniques => ({
  titre: "Revue commerciale T3 2026",
  sousTitre: "Comité de direction",
  societe: { nom: "Adventum Pharma", couleur: "0B2545" },
  date: "2026-09-05",
  sections: [
    { titre: "Faits marquants", puces: ["Croissance de 12 % sur la gamme cardio", "Deux ruptures évitées grâce au stock de sécurité"] },
    { titre: "Points d'attention", texte: "Le délai moyen de règlement des grossistes est passé de 45 à 61 jours sur le trimestre.\n\nLa trésorerie reste au-dessus du seuil d'alerte." },
  ],
  chiffres: [{ cle: "ca", libelle: "Chiffre d'affaires T3", valeur: 41_300_000, format: "montant" }, { cle: "marge", libelle: "Marge brute", valeur: 0.312, format: "pourcentage" }],
  parametres: [{ nom: "TVA", valeur: 0.19, libelle: "Taux de TVA", format: "0%" }],
  tableaux: [{
    cle: "ventes", titre: "Ventes par région",
    colonnes: [
      { cle: "region", titre: "Région", type: "texte" },
      { cle: "qte", titre: "Quantité", type: "entier" },
      { cle: "pu", titre: "P.U.", type: "montant" },
      { cle: "ht", titre: "HT", type: "montant", formule: "[qte]*[pu]" },
      { cle: "ttc", titre: "TTC", type: "montant", formule: "[ht]*(1+{TVA})" },
    ],
    lignes: [
      { region: "Alger", qte: 120, pu: 250 }, { region: "Oran", qte: 80, pu: 250 }, { region: "Constantine", qte: 50, pu: 240.5 },
      { region: "Sétif", qte: 35, pu: 260 }, { region: "Annaba", qte: 20, pu: 255 },
    ],
    totaux: ["qte", "ht", "ttc"],
  }],
});

describe("le dossier à trois formats", () => {
  it("construit classeur, deck et note depuis les mêmes données, et prouve leur cohérence", async () => {
    const d = await construireDossier(canon());
    expect(d.bloquants).toEqual([]);
    expect(d.ok).toBe(true);
    expect(d.coherence).toEqual({ ok: true, totauxCompares: 3, ecarts: [] });
    expect(d.classeur.verification?.ok).toBe(true);
    expect(d.classeur.verification?.formules).toBe(13); // 5 lignes × 2 colonnes + 3 totaux
    expect(d.deck.verification?.diapos).toBe(6); // couverture + 2 sections + 2 chiffres + 1 tableau
    expect(d.note.verification?.ok).toBe(true);

    // Le classeur porte les formules ET leurs valeurs recalculées.
    const c = await lireClasseur(d.classeur.octets);
    const ventes = feuilleParNom(c, "Ventes par région")!;
    expect(lireCellule(ventes, 7, 4)).toMatchObject({ f: "SUM(D2:D6)", v: 76_225 }); // 30 000 + 20 000 + 12 025 + 9 100 + 5 100
    expect(lireCellule(ventes, 2, 5)?.v).toBe(35_700);
    expect(feuilleParNom(c, "Paramètres")).toBeTruthy();

    // Le deck montre le même total, formaté : le chiffre clé dans une forme de texte, le total du
    // tableau dans la grille (`a:tbl`) de la diapositive — lue dans le fichier, pas dans l'intention.
    const deck = (await adaptateurPptx.ouvrir(d.deck.octets)).modele() as PptxModel;
    const textes = deck.slides.flatMap((s) => s.shapes.map((f) => f.text));
    expect(textes.some((t) => t.includes("41\u00a0300\u00a0000,00\u00a0DZD"))).toBe(true);
    const zip = new PizZip(d.deck.octets);
    const diapos = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).map((n) => zip.file(n)!.asText()).join("\n");
    expect(diapos).toContain("76\u00a0225,00\u00a0DZD");
    expect(deck.slides.filter((s) => s.shapes.some((f) => f.role === "table"))).toHaveLength(1);

    // La note aussi.
    const note = (await adaptateurDocx.ouvrir(d.note.octets)).modele() as DocxModel;
    expect(note.paragraphs[0].text).toBe("Revue commerciale T3 2026");
    // Le plan compte le titre du document (style Title) puis les titres de section, dans l'ordre.
    expect(note.plan.map((p) => p.texte)).toEqual(["Revue commerciale T3 2026", "Faits marquants", "Points d'attention", "Chiffres clés", "Ventes par région"]);
    expect(note.tables.flatMap((t) => t.cells.map((x) => x.text))).toContain("76\u00a0225,00\u00a0DZD");
  });

  it("ne livre rien si un seul format viole une règle : un titre de section trop long bloque le deck, donc le dossier", async () => {
    const c = canon();
    c.sections[0].titre = "Une section dont le titre déborde largement de ce qu'une diapositive peut porter en une seule ligne lisible";
    const d = await construireDossier(c);
    expect(d.ok).toBe(false);
    expect(d.bloquants.some((b) => /^PowerPoint : Diapo 1/.test(b))).toBe(true);
    // Les autres formats ont été construits et vérifiés — l'appelant n'en écrira aucun.
    expect(d.classeur.verification?.ok).toBe(true);
    expect(d.coherence?.ok).toBe(true);
  });

  it("refuse avant tout calcul une spécification invalide", async () => {
    const c = canon();
    c.tableaux[0].colonnes[3].formule = "ARRONDI([qte]*[pu];2)";
    const d = await construireDossier(c);
    expect(d.ok).toBe(false);
    expect(d.classeur.octets.length).toBe(0);
    expect(d.bloquants[0]).toMatch(/grammaire vérifiable/);
  });
});
