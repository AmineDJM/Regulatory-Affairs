import { describe, it, expect } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import {
  advances, isRetrievable, verdictOf, backoffMs, JOB_PRIORITY,
  CONFIDENCE_ACCEPT, CONFIDENCE_VERIFY, type IngestStage,
} from "./contract";
import { fold, contentHash, recordHash, textLooksUsable, ocrLooksBroken, clip , looksLikePlainText } from "./text";
import { decideRoute, selectVisionPages, shouldEscalate, acceptsIntoStructuredField, highestUsed, MAX_VISION_PAGES } from "./route";
import { chunkText, chunkUnits, chunkTable, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS } from "./chunk";
import { parsePptx, textFromSlideXml, slideNumber, pptxToText } from "./parsers/pptx";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA COUCHE DE CONNAISSANCE — ce que ces tests protègent.
 *
 * Le cœur est PUR : aucune base, aucun réseau, aucun modèle. C'est délibéré — la politique de
 * coût (« ne jamais appeler un modèle pour ce que le code sait lire ») doit être vérifiable sans
 * dépenser un centime, sinon elle ne sera jamais vérifiée.
 *
 * Les tests portent donc en priorité sur les REFUS : ne pas monter d'un barreau, ne pas envoyer
 * 150 pages en vision pour trois pages illisibles, ne pas écrire une donnée incertaine dans un
 * champ critique, ne pas couper un tableau en deux.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────── Le contrat ───────────────────────────────

describe("les étapes ne reculent jamais", () => {
  it("un job rejoué ne fait pas redescendre l'élément", () => {
    // Sans cette garde, relancer un enrichissement sur un élément READY le remettrait en PARSED
    // et l'utilisateur verrait une donnée DISPARAÎTRE de la recherche, sans raison visible.
    expect(advances("READY", "PARSED")).toBe(false);
    expect(advances("READY", "ENRICHED")).toBe(true);
    expect(advances("RECEIVED", "INDEXED")).toBe(true);
  });

  it("un échec peut survenir depuis n'importe où, mais une seule fois", () => {
    expect(advances("INDEXED", "FAILED")).toBe(true);
    expect(advances("FAILED", "FAILED")).toBe(false);
  });

  it("« retrouvable » commence à INDEXED — c'est la promesse de l'ingestion rapide", () => {
    const yes: IngestStage[] = ["INDEXED", "READY", "ENRICHED"];
    const no: IngestStage[] = ["RECEIVED", "PARSED", "CLASSIFIED", "FAILED"];
    for (const s of yes) expect(isRetrievable(s), s).toBe(true);
    for (const s of no) expect(isRetrievable(s), s).toBe(false);
  });
});

describe("la file : priorités et attente", () => {
  it("ce qui rend RETROUVABLE passe avant ce qui rend mieux compris", () => {
    expect(JOB_PRIORITY.parse).toBeLessThan(JOB_PRIORITY.embed);
    expect(JOB_PRIORITY.classify).toBeLessThan(JOB_PRIORITY.enrich);
    expect(JOB_PRIORITY.vision).toBeLessThan(JOB_PRIORITY.enrich);
  });

  it("l'attente croît puis se stabilise — on ne martèle pas un service en panne", () => {
    expect(backoffMs(1)).toBeLessThan(backoffMs(2));
    expect(backoffMs(2)).toBeLessThan(backoffMs(3));
    expect(backoffMs(50)).toBeLessThanOrEqual(30 * 60_000); // plafonnée
  });
});

// ─────────────────────────────── Le texte ───────────────────────────────

describe("repli et empreintes", () => {
  it("« reglement » trouve « Règlement »", () => {
    expect(fold("Règlement")).toBe("reglement");
  });

  it("le repli GARDE la ponctuation — une référence est ce qu'on cherche le plus", () => {
    // Retirer les tirets ferait disparaître « REG-2026-041 », qui est le motif de recherche
    // le plus fréquent de tout l'ERP.
    expect(fold("REG-2026-041")).toBe("reg-2026-041");
  });

  it("l'empreinte porte sur le CONTENU — renommer un fichier ne déclenche rien", () => {
    const a = contentHash(Buffer.from("même contenu"));
    const b = contentHash(Buffer.from("même contenu"));
    expect(a).toBe(b);
    expect(contentHash("autre")).not.toBe(a);
  });

  it("l'empreinte d'un enregistrement est stable quel que soit l'ordre des clés", () => {
    // Sans le tri, deux sérialisations du même objet donneraient deux empreintes — et TOUT
    // serait retraité à chaque passage.
    expect(recordHash({ a: 1, b: 2 })).toBe(recordHash({ b: 2, a: 1 }));
  });
});

describe("le texte est-il exploitable ? — la question qui évite un appel de modèle", () => {
  it("un vrai paragraphe l'est", () => {
    expect(textLooksUsable("Le dossier DEMO-2026-015 concerne la molécule A. Il a été soumis le 20 juillet et attend une décision de l'autorité depuis.")).toBe(true);
  });

  it("quelques caractères de bruit ne le sont pas — le piège du PDF scanné", () => {
    // Un scan rend souvent assez de caractères pour paraître non vide, jamais assez pour dire
    // quelque chose. C'est précisément le cas où il faut REGARDER le document.
    expect(textLooksUsable("|| .. -- ,, ;; ")).toBe(false);
    expect(textLooksUsable("x".repeat(20))).toBe(false);
  });

  it("un texte fait de symboles n'est pas un texte", () => {
    expect(textLooksUsable("### ---- **** ==== ++++ //// \\\\ |||| ".repeat(6))).toBe(false);
  });
});

describe("l'OCR a-t-il rendu du charabia ?", () => {
  it("un texte propre passe", () => {
    const clean = "Le present contrat est conclu entre les parties pour une duree de trois annees renouvelable par tacite reconduction sauf denonciation. ".repeat(3);
    expect(ocrLooksBroken(clean)).toBe(false);
  });

  it("des mots d'une lettre en rafale trahissent un OCR cassé", () => {
    expect(ocrLooksBroken("a b c d e f g h i j k l m n o p q r s t u v w x y z ".repeat(6))).toBe(true);
  });

  /** L'alphabet latin massacre l'arabe : on n'accuse JAMAIS une lecture arabe sur cette base. */
  it("un texte arabe n'est jamais jugé — on n'accuse pas une lecture correcte", () => {
    const arabe = "هذا نص عربي طويل بما فيه الكفاية لتجاوز الحد الأدنى المطلوب في هذا الاختبار ".repeat(6);
    expect(ocrLooksBroken(arabe)).toBe(false);
  });

  it("un texte court n'est pas jugé — trop peu de matière pour conclure", () => {
    expect(ocrLooksBroken("a b c")).toBe(false);
  });
});

describe("la coupe ne casse pas les mots", () => {
  it("elle recule jusqu'à l'espace", () => {
    const out = clip("Pembrolizumab est une immunothérapie anticancéreuse", 20);
    expect(out.endsWith(" ")).toBe(false);
    expect(out.length).toBeLessThanOrEqual(20);
    expect(out).not.toMatch(/Pembroli$/);
  });
});

// ─────────────────────────────── L'échelle ───────────────────────────────

describe("l'échelle — chaque `return` anticipé est un appel de modèle évité", () => {
  it("un objet déjà structuré ne coûte RIEN", () => {
    const d = decideRoute({ mime: "application/json", structured: true });
    expect(d.use).toBe("metadata");
    expect(d.reasons).toEqual(["structured_only"]);
  });

  it("un PDF texte propre s'arrête au parsing natif", () => {
    const d = decideRoute({
      mime: "application/pdf",
      nativeText: "Le dossier DEMO-2026-015 concerne la molécule A et attend une décision depuis le 20 juillet 2026. ".repeat(3),
    });
    expect(d.use).toBe("native");
    expect(d.reasons).toEqual([]); // aucune raison de monter : on n'est pas monté
  });

  it("une image part DIRECTEMENT en vision — ce n'est pas une escalade, c'est le premier moyen", () => {
    const d = decideRoute({ mime: "image/jpeg" });
    expect(d.use).toBe("luna");
    expect(d.reasons).toContain("image_source");
  });

  it("un PDF sans couche texte mais bien océrisé s'arrête à l'OCR — pas de modèle", () => {
    const d = decideRoute({
      mime: "application/pdf",
      nativeText: "",
      ocrText: "Le present contrat est conclu entre les parties pour une duree de trois annees. ".repeat(4),
    });
    expect(d.use).toBe("ocr");
    expect(d.reasons).toContain("no_text_layer");
  });

  it("un OCR incohérent fait monter en vision — on regarde plutôt que de croire", () => {
    const d = decideRoute({
      mime: "application/pdf",
      nativeText: "",
      ocrText: "a b c d e f g h i j k l m n o p q r s t u v w x y z ".repeat(6),
    });
    expect(d.use).toBe("luna");
    expect(d.reasons).toContain("ocr_unreliable");
  });

  it("un parser en échec fait monter, et le DIT", () => {
    const d = decideRoute({ mime: "application/pdf", parserFailed: true });
    expect(d.use).toBe("luna");
    expect(d.reasons).toContain("parser_failed");
  });
});

describe("§8 — un PDF de 150 pages ne part JAMAIS entier en vision", () => {
  const bigText = "Le dossier concerne la molécule A et son évaluation réglementaire en cours. ".repeat(5);

  it("trois pages illisibles sur 150 : SEULES ces trois-là partent", () => {
    const d = decideRoute({
      mime: "application/pdf",
      nativeText: bigText,
      pages: 150,
      unreadablePages: ["44", "45", "46"],
    });
    expect(d.use).toBe("luna");
    expect(d.pages).toEqual(["44", "45", "46"]);
  });

  it("les pages à tableaux sont jointes aux illisibles, sans doublon", () => {
    const pages = selectVisionPages({ mime: "application/pdf", pages: 100, unreadablePages: ["7"], tablePages: ["7", "8"] });
    expect(pages).toEqual(["7", "8"]);
  });

  /** Au-delà, ce n'est plus « quelques pages difficiles » : c'est un document scanné. */
  it("un document majoritairement illisible ne part pas page par page", () => {
    const many = Array.from({ length: 90 }, (_, i) => String(i + 1));
    expect(selectVisionPages({ mime: "application/pdf", pages: 100, unreadablePages: many })).toEqual([]);
  });

  it("la sélection est bornée — jamais une facture ouverte", () => {
    const many = Array.from({ length: 40 }, (_, i) => String(i + 1));
    const pages = selectVisionPages({ mime: "application/pdf", pages: 500, unreadablePages: many });
    expect(pages.length).toBeLessThanOrEqual(MAX_VISION_PAGES);
  });

  it("aucune page signalée = aucune vision, même sur un gros document", () => {
    expect(selectVisionPages({ mime: "application/pdf", pages: 300 })).toEqual([]);
  });
});

describe("§22 — la confiance protège les données structurées", () => {
  it("les trois verdicts suivent les seuils nommés", () => {
    expect(verdictOf(CONFIDENCE_ACCEPT)).toBe("accept");
    expect(verdictOf(CONFIDENCE_VERIFY)).toBe("verify");
    expect(verdictOf(0.2)).toBe("escalate");
  });

  it("un champ CRITIQUE n'accepte qu'une extraction sûre", () => {
    expect(acceptsIntoStructuredField(0.98, true)).toBe(true);
    expect(acceptsIntoStructuredField(0.7, true)).toBe(false);   // moyen → pas dans un champ critique
    expect(acceptsIntoStructuredField(0.7, false)).toBe(true);   // …mais acceptable ailleurs
  });

  it("on n'escalade que sur une raison, jamais « au cas où »", () => {
    expect(shouldEscalate({ confidence: 0.95 })).toBe(false);
    expect(shouldEscalate({ confidence: 0.3 })).toBe(true);
    expect(shouldEscalate({ confidence: 0.9, reasons: ["ocr_unreliable", "table_heavy"] })).toBe(true);
    expect(shouldEscalate({ confidence: 0.9, reasons: ["table_heavy"] })).toBe(false);
  });

  it("le moyen le plus cher employé se retrouve — c'est la base du rapport de coût", () => {
    expect(highestUsed(["native", "ocr", "native"])).toBe("ocr");
    expect(highestUsed(["metadata"])).toBe("metadata");
    expect(highestUsed(["native", "terra", "luna"])).toBe("terra");
  });
});

// ─────────────────────────────── Le découpage ───────────────────────────────

describe("§13 — on coupe où le document se coupe", () => {
  it("les titres numérotés deviennent des sections", () => {
    const doc = [
      "1. Objet du contrat",
      "Le présent contrat définit les conditions de fourniture entre les parties signataires ci-dessous.",
      "",
      "2. Durée",
      "Le contrat est conclu pour une durée de trois années renouvelable par tacite reconduction.",
    ].join("\n");
    const chunks = chunkText(doc);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((c) => c.label)).toContain("2. Durée");
  });

  it("l'ordre est celui de la LECTURE", () => {
    const chunks = chunkUnits(
      [
        { label: "Diapositive 1", text: "Introduction au marché algérien des anticancéreux et à ses acteurs." },
        { label: "Diapositive 2", text: "Le segment oncologie représente une part croissante des dépenses hospitalières." },
      ],
      "slide",
    );
    expect(chunks.map((c) => c.ord)).toEqual([0, 1]);
  });

  it("une unité vide n'est PAS indexée — une diapositive de transition dilue la recherche", () => {
    const chunks = chunkUnits([{ label: "Vide", text: "  " }, { label: "Pleine", text: "x".repeat(200) }], "slide");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].label).toBe("Pleine");
  });

  /** LA RAISON D'ÊTRE DU MODULE : un tableau coupé en deux ne veut plus rien dire. */
  it("un tableau garde l'association en-tête ↔ valeur", () => {
    const chunks = chunkTable(
      [
        { Référence: "DEMO-2026-015", Produit: "Molécule A", Statut: "Évaluation" },
        { Référence: "DEMO-2026-008", Produit: "Molécule B", Statut: "Dossier technique" },
      ],
      { label: "Dossiers", locator: "feuille 1" },
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Référence: DEMO-2026-015");
    expect(chunks[0].text).toContain("Produit: Molécule A");
    expect(chunks[0].kind).toBe("table");
    expect(chunks[0].locator).toBe("feuille 1");
  });

  it("un tableau tronqué le DIT — sinon on croit avoir tout vu", () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ Ref: `R-${i}` }));
    const chunks = chunkTable(rows, { maxRows: 10 });
    expect(chunks.map((c) => c.text).join("")).toContain("490 lignes non indexées");
  });

  it("une section trop longue est coupée aux PHRASES, jamais au milieu d'un mot", () => {
    const long = "Cette clause détaille les obligations respectives des parties signataires. ".repeat(120);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 200);
      expect(c.text.length).toBeGreaterThanOrEqual(MIN_CHUNK_CHARS);
    }
    // Le mot n'a pas été coupé : chaque morceau finit sur une frontière propre.
    expect(chunks[0].text).not.toMatch(/\bsignatai$/);
  });

  it("un document sans titre retombe sur ses paragraphes", () => {
    const doc = ["x".repeat(120), "", "y".repeat(120)].join("\n");
    const chunks = chunkText(doc);
    expect(chunks.length).toBe(2);
  });
});

// ─────────────────────────────── PPTX ───────────────────────────────

describe("PPTX — le format qui manquait", () => {
  it("les diapositives se trient par NUMÉRO, pas par nom de fichier", () => {
    // « slide10 » avant « slide2 » rendrait la présentation dans le désordre — et toute
    // citation « diapositive N » deviendrait fausse.
    const paths = ["ppt/slides/slide10.xml", "ppt/slides/slide2.xml", "ppt/slides/slide1.xml"];
    expect(paths.sort((a, b) => slideNumber(a) - slideNumber(b))).toEqual([
      "ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide10.xml",
    ]);
  });

  /** LE PIÈGE : Office éclate un mot en plusieurs fragments dès qu'un style change. */
  it("les fragments d'un même paragraphe se recollent SANS espace", () => {
    const xml = '<a:p><a:r><a:t>Pembro</a:t></a:r><a:r><a:t>lizumab</a:t></a:r></a:p>';
    expect(textFromSlideXml(xml)).toBe("Pembrolizumab");
  });

  it("deux paragraphes restent deux lignes", () => {
    const xml = '<a:p><a:r><a:t>Titre</a:t></a:r></a:p><a:p><a:r><a:t>Corps</a:t></a:r></a:p>';
    expect(textFromSlideXml(xml)).toBe("Titre\nCorps");
  });

  it("les entités XML sont décodées, et « &amp;lt; » ne se décode pas deux fois", () => {
    const xml = '<a:p><a:r><a:t>Prix &lt; 100 &amp; TVA</a:t></a:r></a:p>';
    expect(textFromSlideXml(xml)).toBe("Prix < 100 & TVA");
    const doubled = '<a:p><a:r><a:t>&amp;lt;</a:t></a:r></a:p>';
    expect(textFromSlideXml(doubled)).toBe("&lt;");
  });

  it("une vraie présentation est lue diapositive par diapositive, notes comprises", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<a:p><a:r><a:t>Marché oncologie</a:t></a:r></a:p><a:p><a:r><a:t>Croissance de 12 % en 2026</a:t></a:r></a:p>');
    zip.file("ppt/slides/slide2.xml", '<a:p><a:r><a:t>Concurrence</a:t></a:r></a:p>');
    zip.file("ppt/notesSlides/notesSlide1.xml", '<a:p><a:r><a:t>Source : IQVIA, chiffres provisoires</a:t></a:r></a:p><a:p><a:r><a:t>1</a:t></a:r></a:p>');
    const buf = await zip.generateAsync({ type: "nodebuffer" });

    const parsed = await parsePptx(buf);
    expect(parsed.slides).toHaveLength(2);
    expect(parsed.slides[0].title).toBe("Marché oncologie");
    expect(parsed.slides[0].text).toContain("Croissance de 12 %");
    // Les notes disent souvent ce que la diapositive tait : les jeter, c'est indexer le décor.
    expect(parsed.slides[0].notes).toContain("IQVIA");
    // …mais le numéro de diapositive recopié par le gabarit n'est pas une note.
    expect(parsed.slides[0].notes).not.toMatch(/^\s*1\s*$/);
  });

  it("une diapositive quasi vide est SIGNALÉE comme visuelle — elle seule ira en vision", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<a:p><a:r><a:t>Un titre bien assez long pour être lu correctement</a:t></a:r></a:p>');
    zip.file("ppt/slides/slide2.xml", '<a:p><a:r><a:t>?</a:t></a:r></a:p>');
    const parsed = await parsePptx(await zip.generateAsync({ type: "nodebuffer" }));
    expect(parsed.visualSlides).toEqual(["2"]);
  });

  it("un fichier corrompu rend une présentation vide, il ne fait pas échouer l'ingestion", async () => {
    const parsed = await parsePptx(Buffer.from("ceci n'est pas un zip"));
    expect(parsed.slides).toEqual([]);
  });

  it("le texte assemblé permet de CITER une diapositive", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide3.xml", '<a:p><a:r><a:t>Prévisions 2027</a:t></a:r></a:p>');
    const parsed = await parsePptx(await zip.generateAsync({ type: "nodebuffer" }));
    expect(pptxToText(parsed)).toContain("Diapositive 3 : Prévisions 2027");
  });
});

// ─────────────────────────────── Portabilité ───────────────────────────────

describe("la couche appartient à l'ERP, pas à Adam", () => {
  /**
   * C'est la raison d'être du chantier. Si `knowledge/` importait `assistant/`, la couche
   * redeviendrait un morceau d'Adam — et les écrans métier n'y auraient pas droit.
   */
  it("aucun module de `knowledge/` n'importe `assistant/`", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) files.push(p);
      }
    };
    walk("src/lib/knowledge");
    expect(files.length).toBeGreaterThanOrEqual(5);

    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\s*["']([^"']+)["']/g)) {
        if (m[1].includes("@/lib/assistant")) offenders.push(`${f} → ${m[1]}`);
      }
    }
    expect(offenders, "la couche de connaissance ne doit pas dépendre d'Adam").toEqual([]);
  });

  it("le contrat n'importe rien — c'est ce qui le rend portable", () => {
    const src = fs.readFileSync("src/lib/knowledge/contract.ts", "utf8");
    expect([...src.matchAll(/(?:^|\n)\s*import\s/g)].length).toBe(0);
  });
});

// ─────────────────────────── Le texte brut, qui n'a pas de signature ───────────────────────────

describe("§2 — ne jamais payer un modèle pour ce que le code lit", () => {
  it("reconnaît du texte brut, accents français compris", () => {
    expect(looksLikePlainText(Buffer.from("Objet : demande de congés\nMerci d'avance.", "utf8"))).toBe(true);
    expect(looksLikePlainText(Buffer.from("nom;prenom;wilaya\nDupont;Amine;16", "utf8"))).toBe(true);
  });

  it("refuse un binaire — un seul octet nul suffit", () => {
    expect(looksLikePlainText(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x41, 0x42]))).toBe(false);
  });

  it("refuse un flot d'octets de contrôle, même sans octet nul", () => {
    expect(looksLikePlainText(Buffer.from(Array.from({ length: 200 }, () => 0x01)))).toBe(false);
  });

  it("refuse un tampon vide plutôt que de le déclarer lisible", () => {
    expect(looksLikePlainText(Buffer.alloc(0))).toBe(false);
  });

  it("ne se laisse pas piéger par un caractère multi-octets coupé en fin de fenêtre", () => {
    // La fenêtre d'échantillon peut trancher un « é » en deux. UNE frontière, jamais partout —
    // c'est pourquoi on tolère un résidu au lieu d'exiger zéro.
    const buf = Buffer.from("é".repeat(3000), "utf8");
    expect(looksLikePlainText(buf, 101)).toBe(true);
  });
});
