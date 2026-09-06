import { describe, expect, it } from "vitest";
import { ecrireCsv, ecrireJsonl, lireJson, lireTableur } from "./tableur";
import { avertissementConversion, conversion, conversionsDepuis, formatDe } from "./conversion";

describe("formats — lire un tableau et dire ce qu'on a raté", () => {
  it("LE CAS RÉEL : un export Excel français (latin-1, point-virgule, 1 234,56, 31/12/2026)", () => {
    const contenu = "nom;montant;date\nDupont;1 234,56;31/12/2026\nBenali;890,10;15/03/2026\nSociété Générale;12 000,00;01/06/2026";
    const r = lireTableur(Buffer.from(contenu, "latin1"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rapport.encodage).toBe("latin-1");
    expect(r.rapport.separateur).toBe(";");
    expect(r.rapport.entete).toBe(true);
    expect(r.rapport.locale.nombres).toBe("fr");
    expect(r.rapport.locale.dates).toBe("jj/mm/aaaa");
    expect(r.lignes.length).toBe(3);
    // Les accents survivent, les montants sont des NOMBRES, les dates sont en ISO.
    expect(r.lignes[2]!.nom).toBe("Société Générale");
    expect(r.lignes[0]!.montant).toBe(1234.56);
    expect(r.lignes[2]!.montant).toBe(12000);
    expect(r.lignes[0]!.date).toBe("2026-12-31");
    expect(r.colonnes.find((c) => c.nom === "montant")!.type).toBe("nombre");
    expect(r.colonnes.find((c) => c.nom === "date")!.type).toBe("date");
    expect(r.rapport.decisions.some((d) => /latin-1/.test(d))).toBe(true);
  });

  it("une colonne de type MÊLÉ est signalée, et reste en texte", () => {
    const r = lireTableur("ref;valeur\nA1;100\nA2;non renseigné\nA3;300");
    if (!r.ok) throw new Error(r.erreur);
    const col = r.colonnes.find((c) => c.nom === "valeur")!;
    expect(col.type).toBe("mele");
    expect(col.detail).toMatch(/2 nombre\(s\), 0 date\(s\), 1 texte/);
    expect(r.rapport.avertissements.some((a) => /MÊLÉ/.test(a))).toBe(true);
    expect(r.lignes[0]!.valeur).toBe("100"); // texte, pas 100 : un calcul dessus serait faux
  });

  it("les lignes mal formées sont COMPTÉES, et une seule ligne large ne disqualifie pas les autres", () => {
    // L'en-tête déclare TROIS colonnes : c'est lui la référence, pas la ligne la plus large.
    const r = lireTableur("a;b;c\n1;2;3\n4;5\n6;7;8;9\n10;11;12");
    if (!r.ok) throw new Error(r.erreur);
    expect(r.colonnes.length).toBe(3);
    expect(r.rapport.lignesMalFormees.map((m) => m.ligne)).toEqual([3, 4]);
    expect(r.rapport.lignesMalFormees[0]).toEqual({ ligne: 3, colonnes: 2, attendu: 3 });
    expect(r.rapport.avertissements.some((x) => /mauvais nombre de colonnes/.test(x))).toBe(true);
    expect(r.rapport.avertissements.some((x) => /AU-DELÀ/.test(x))).toBe(true);
    // Sans en-tête, c'est la largeur la plus FRÉQUENTE qui fait référence.
    const sansEntete = lireTableur("1;2\n3;4\n5;6;7\n8;9");
    if (!sansEntete.ok) throw new Error(sansEntete.erreur);
    expect(sansEntete.colonnes.length).toBe(2);
    expect(sansEntete.rapport.lignesMalFormees.length).toBe(1);
  });

  it("deux colonnes du même nom sont distinguées, jamais écrasées", () => {
    const r = lireTableur("nom;nom;montant\na;b;1\nc;d;2", { entete: true });
    if (!r.ok) throw new Error(r.erreur);
    expect(r.colonnes.map((c) => c.nom)).toEqual(["nom", "nom_2", "montant"]);
    expect(r.lignes[0]!.nom).toBe("a");
    expect(r.lignes[0]!.nom_2).toBe("b");
    expect(r.rapport.avertissements.some((x) => /présente 2 fois/.test(x))).toBe(true);
    // Et sans le dire : une première ligne aux valeurs RÉPÉTÉES n'est pas prise pour un en-tête.
    const devine = lireTableur("nom;nom;montant\na;b;1\nc;d;2");
    if (!devine.ok) throw new Error(devine.erreur);
    expect(devine.rapport.entete).toBe(false);
  });

  it("sans en-tête, les colonnes sont numérotées et rien n'est perdu", () => {
    const r = lireTableur("1;100\n2;200\n3;300");
    if (!r.ok) throw new Error(r.erreur);
    expect(r.rapport.entete).toBe(false);
    expect(r.colonnes.map((c) => c.nom)).toEqual(["colonne_1", "colonne_2"]);
    expect(r.lignes.length).toBe(3);
  });

  it("ÉCRIRE : la locale française impose le point-virgule, sinon la virgule décimale casse le fichier", () => {
    const lignes = [{ produit: "Trastuzex", montant: 1234.56 }, { produit: "Zetriscan; lot 3", montant: 890 }];
    const fr = ecrireCsv(lignes, { locale: "fr", separateur: "," });
    expect(fr.separateur).toBe(";");
    expect(fr.note).toMatch(/couperait les montants/);
    expect(fr.texte).toContain("1234,56");
    expect(fr.texte).toContain('"Zetriscan; lot 3"'); // la valeur qui contient le séparateur est protégée
    expect(fr.texte.startsWith("﻿")).toBe(true);
    const en = ecrireCsv(lignes, { locale: "en", bom: false });
    expect(en.separateur).toBe(",");
    expect(en.texte).toContain("1234.56");
    expect(en.texte.startsWith("﻿")).toBe(false);
    // L'aller-retour rend les mêmes valeurs.
    const relu = lireTableur(fr.texte.replace(/^﻿/, ""));
    if (!relu.ok) throw new Error(relu.erreur);
    expect(relu.lignes[0]!.montant).toBe(1234.56);
    expect(relu.lignes[1]!.produit).toBe("Zetriscan; lot 3");
  });

  it("JSON et JSONL sont lus et distingués", () => {
    const j = lireJson('[{"a":1},{"a":2}]');
    expect(j.ok && j.forme).toBe("json");
    expect(j.ok && j.lignes.length).toBe(2);
    const jl = lireJson('{"a":1}\n{"a":2}\n{"a":3}');
    expect(jl.ok && jl.forme).toBe("jsonl");
    expect(jl.ok && jl.lignes.length).toBe(3);
    // Le tableau d'objets le plus profond est retrouvé dans une enveloppe.
    const enveloppe = lireJson('{"meta":{"n":2},"data":{"rows":[{"x":1},{"x":2}]}}');
    expect(enveloppe.ok && enveloppe.lignes.length).toBe(2);
    expect(lireJson("pas du json du tout").ok).toBe(false);
    expect(ecrireJsonl([{ a: 1 }, { a: 2 }])).toBe('{"a":1}\n{"a":2}');
  });

  it("tient l'échelle : 50 000 lignes lues en moins de trois secondes", () => {
    const lignes = ["ref;montant;date"];
    for (let i = 0; i < 50_000; i += 1) lignes.push(`REF-${i};${i},50;01/06/2026`);
    const t0 = Date.now();
    const r = lireTableur(lignes.join("\n"));
    if (!r.ok) throw new Error(r.erreur);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(r.lignes.length).toBe(50_000);
    expect(r.lignes[49_999]!.montant).toBe(49999.5);
  });
});

describe("formats — ce qu'une conversion perd, dit AVANT", () => {
  it("reconnaît les formats par l'extension", () => {
    expect(formatDe("budget 2027.XLSX")).toBe("xlsx");
    expect(formatDe("export.jsonl")).toBe("jsonl");
    expect(formatDe("notes.ndjson")).toBe("jsonl");
    expect(formatDe("page.htm")).toBe("html");
    expect(formatDe("photo.JPEG")).toBe("jpg");
    expect(formatDe("sans extension")).toBe("inconnu");
  });

  it("xlsx → csv est DESTRUCTIF, et dit exactement quoi", () => {
    const c = conversion("xlsx", "csv");
    expect(c.nature).toBe("DESTRUCTIF");
    expect(c.reversible).toBe(false);
    expect(c.perd.some((p) => /feuilles/.test(p))).toBe(true);
    expect(c.perd.some((p) => /formules/.test(p))).toBe(true);
    const phrase = avertissementConversion(c);
    expect(phrase).toMatch(/DESTRUCTIVE/);
    expect(phrase).toMatch(/original doit être GARDÉ/);
  });

  it("csv → tsv ne perd rien ; xlsm → xlsx perd les macros", () => {
    const sansPerte = conversion("csv", "tsv");
    expect(sansPerte.nature).toBe("LOSSLESS");
    expect(sansPerte.reversible).toBe(true);
    expect(avertissementConversion(sansPerte)).toMatch(/SANS PERTE/);
    const macros = conversion("xlsm", "xlsx");
    expect(macros.nature).toBe("DESTRUCTIF");
    expect(macros.perd).toContain("les macros");
  });

  it("ce que ce serveur ne sait pas faire est nommé comme une RESSOURCE, pas comme une impossibilité", () => {
    const pdfVersWord = conversion("pdf", "docx");
    expect(pdfVersWord.nature).toBe("IMPOSSIBLE");
    expect(pdfVersWord.ressourceManquante).toMatch(/mise en page/);
    const vieuxExcel = conversion("xls", "xlsx");
    expect(vieuxExcel.nature).toBe("IMPOSSIBLE");
    expect(vieuxExcel.ressourceManquante).toMatch(/\.xlsx/);
    const parquet = conversion("csv", "parquet");
    expect(parquet.nature).toBe("IMPOSSIBLE");
    expect(parquet.ressourceManquante).toMatch(/CSV ou JSONL/);
    expect(avertissementConversion(parquet)).toMatch(/indisponible sur ce serveur/);
  });

  it("les conversions possibles depuis un format sont classées, sans perte d'abord", () => {
    const depuis = conversionsDepuis("csv");
    expect(depuis.length).toBeGreaterThan(3);
    expect(depuis[0]!.nature).toBe("LOSSLESS");
    expect(depuis.every((c) => c.nature !== "IMPOSSIBLE")).toBe(true);
    const natures = depuis.map((c) => c.nature);
    expect(natures.lastIndexOf("LOSSLESS")).toBeLessThan(natures.indexOf("DESTRUCTIF") === -1 ? Infinity : natures.indexOf("DESTRUCTIF") + depuis.length);
  });
});
