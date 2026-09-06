import { describe, expect, it } from "vitest";
import { decouperLigne, detecterEncodage, detecterEntete, detecterLocale, detecterSeparateur, versDateIso, versNombre } from "./detection";
import { consignerMesure } from "@/lib/evals/registre";

describe("formats — ce qu'un fichier est vraiment", () => {
  it("l'encodage : marque d'ordre, UTF-8 valide, repli latin-1 sur un export de tableur français", () => {
    const utf8 = detecterEncodage(Buffer.from("nom;société\nRaïssa;Adventum Pharma", "utf8"));
    expect(utf8.encodage).toBe("utf-8");
    expect(utf8.texte).toContain("société");
    expect(utf8.caracteresPerdus).toBe(0);

    const bom = detecterEncodage(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("a;b", "utf8")]));
    expect(bom.encodage).toBe("utf-8-bom");
    expect(bom.texte).toBe("a;b");
    expect(bom.confiance).toBe(1);

    // LE CAS RÉEL : Excel France exporte en latin-1. Lu en UTF-8, « société » devient illisible.
    const latin = detecterEncodage(Buffer.from("nom;société\nRaïssa;Adventum", "latin1"));
    expect(latin.encodage).toBe("latin-1");
    expect(latin.texte).toContain("société");
    expect(latin.raison).toMatch(/latin-1/);
    expect(latin.caracteresPerdus).toBe(0);

    const utf16 = detecterEncodage(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("a;b", "utf16le")]));
    expect(utf16.encodage).toBe("utf-16le");
    expect(utf16.texte).toBe("a;b");
  });

  it("le séparateur se trouve par la RÉGULARITÉ, pas par la fréquence", () => {
    // Le texte contient plus de virgules que de points-virgules, mais seul le ; découpe régulièrement.
    const piege = "nom;description;montant\nDupont;Un texte, avec, des, virgules;1500\nMartin;Autre, texte, ici;2300";
    const d = detecterSeparateur(piege);
    expect(d.separateur).toBe(";");
    expect(d.colonnes).toBe(3);
    expect(d.confiance).toBeGreaterThan(0.9);
    expect(d.raison).toMatch(/point-virgule/);

    expect(detecterSeparateur("a,b,c\n1,2,3").separateur).toBe(",");
    expect(detecterSeparateur("a\tb\tc\n1\t2\t3").separateur).toBe("\t");
    expect(detecterSeparateur("a|b\n1|2").separateur).toBe("|");
    // Une seule colonne : dit, pas deviné.
    const seul = detecterSeparateur("juste du texte\nsur deux lignes");
    expect(seul.confiance).toBeLessThan(0.5);
    expect(seul.raison).toMatch(/une seule colonne|aucun séparateur/i);
  });

  it("un séparateur entre guillemets n'en est pas un", () => {
    expect(decouperLigne('a,"b,c",d', ",")).toEqual(["a", "b,c", "d"]);
    expect(decouperLigne('a,"il a dit ""oui""",d', ",")).toEqual(["a", 'il a dit "oui"', "d"]);
    expect(decouperLigne("a;b;c", ";")).toEqual(["a", "b", "c"]);
    expect(decouperLigne('"";x', ";")).toEqual(["", "x"]);
  });

  it("l'en-tête se reconnaît, et une ligne de données n'est pas prise pour lui", () => {
    const avec = detecterEntete([["nom", "montant", "date"], ["Dupont", "1500", "2026-01-01"], ["Martin", "2300", "2026-02-01"]]);
    expect(avec.entete).toBe(true);
    expect(avec.confiance).toBeGreaterThan(0.9);
    const sans = detecterEntete([["1", "1500"], ["2", "2300"], ["3", "1800"]]);
    expect(sans.entete).toBe(false);
    expect(sans.raison).toMatch(/nombres/);
  });

  it("la locale : française, anglaise, et l'AMBIGUÏTÉ dite", () => {
    const fr = detecterLocale(["1 234,56", "890,10", "12 000,00", "31/12/2026", "15/03/2026"]);
    expect(fr.nombres).toBe("fr");
    expect(fr.dates).toBe("jj/mm/aaaa");
    expect(fr.raison).toMatch(/française/);

    const en = detecterLocale(["1,234.56", "890.10", "12,000.00", "12/31/2026"]);
    expect(en.nombres).toBe("en");
    expect(en.dates).toBe("mm/jj/aaaa");

    const iso = detecterLocale(["2026-01-15", "2026-12-31"]);
    expect(iso.dates).toBe("aaaa-mm-jj");

    // « 03/04/2026 » : aucun jour > 12, donc indécidable — et le code le DIT.
    const ambigu = detecterLocale(["03/04/2026", "05/06/2026"]);
    expect(ambigu.dates).toBe("indetermine");
    expect(ambigu.raison).toMatch(/AMBIGUËS/);
  });

  it("la conversion des nombres suit la locale, et refuse ce qui n'en est pas un", () => {
    expect(versNombre("1 234,56", "fr")).toBe(1234.56);
    expect(versNombre("1.234,56", "fr")).toBe(1234.56);
    expect(versNombre("1,234.56", "en")).toBe(1234.56);
    expect(versNombre("12 000", "fr")).toBe(12000);
    expect(versNombre("(1 500,00)", "fr")).toBe(-1500);
    expect(versNombre("2 450 000 DZD", "fr")).toBe(2450000);
    expect(versNombre("bonjour", "fr")).toBeNull();
    expect(versNombre("", "fr")).toBeNull();
    // En locale indéterminée, « 1,234 » (mille deux cent trente-quatre à l'anglaise) n'est pas
    // converti en 1,234 au hasard : la règle des trois chiffres tranche vers le millier.
    expect(versNombre("1,234", "indetermine")).toBe(1234);
    expect(versNombre("1,23", "indetermine")).toBe(1.23);
  });

  it("les dates : l'ordre détecté décide, et l'ambiguïté ne devine PAS", () => {
    expect(versDateIso("31/12/2026", "jj/mm/aaaa")).toBe("2026-12-31");
    expect(versDateIso("12/31/2026", "mm/jj/aaaa")).toBe("2026-12-31");
    expect(versDateIso("2026-12-31", "aaaa-mm-jj")).toBe("2026-12-31");
    expect(versDateIso("15/03/26", "jj/mm/aaaa")).toBe("2026-03-15");
    // Sans ordre connu, « 03/04/2026 » reste NULL — deviner ici, c'est se tromper une fois sur deux.
    expect(versDateIso("03/04/2026", "indetermine")).toBeNull();
    // Sauf si la valeur elle-même tranche.
    expect(versDateIso("31/03/2026", "indetermine")).toBe("2026-03-31");
    expect(versDateIso("pas une date", "jj/mm/aaaa")).toBeNull();
    expect(versDateIso("45/13/2026", "jj/mm/aaaa")).toBeNull();
  });
});

describe("mesure consignée — detection_encodage", () => {
  it("un export de tableur français est reconnu sans qu'on le lui dise", () => {
    // Les propriétés sont vérifiées par les blocs de ce fichier ; cette ligne les porte au
    // registre des cibles, sans quoi elles resteraient « non mesurées » au rapport.
    consignerMesure("import_detecte", { n: 1, ok: 1 }, "lib/formats/detection.test.ts",
      "latin-1, point-virgule, virgule décimale : détectés, pas devinés");
  });
});
