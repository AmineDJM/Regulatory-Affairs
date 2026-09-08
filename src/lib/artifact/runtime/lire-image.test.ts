/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « QUE DIT LE TAMPON SUR LA PAGE 4 ? » — LIRE une image que le document PORTE.
 *
 * Ce que ce fichier prouve, et qu'aucun test d'adaptateur ne peut prouver :
 *
 *   • les octets qui arrivent au lecteur sont bien CEUX de l'image désignée — pas ceux d'une
 *     autre image du même document, ce qu'un test par nom de fichier laisserait passer ;
 *   • les quatre formats répondent par le MÊME chemin (Word, PowerPoint, Excel, PDF) ;
 *   • une désignation ambiguë rend les CANDIDATS et ne lit rien ;
 *   • une forme qui n'est pas une image nomme ce qu'elle est, au lieu de rendre « rien lu » ;
 *   • une installation sans vision le DIT — elle ne fait pas semblant d'avoir lu ;
 *   • le texte lu est emballé comme une donnée non fiable, la note de méthode ne l'est pas.
 *
 * Les ports sont faux ; tout le reste est le code de production.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  docxDeParagraphes, pdfNumerote, pngUni, pptxDiapos, xlsxVentes,
} from "@/lib/artifact/adapters/fixtures";
import { cibleIndex, cibleTexte, commande } from "@/lib/artifact/commands/ir";
import {
  editer, lireImageDuDocument, oublierSession, ouvrir, type ContexteMoteur,
} from "@/lib/artifact/runtime/engine";
import { magasinMemoire, portsMemoire, type DriveFaux } from "@/lib/artifact/runtime/fakes";

/** Deux images DIFFÉRENTES par la taille — c'est la taille qui identifie ce que la vision reçoit. */
const TAMPON = pngUni(300, 300, [200, 30, 30]);
const LOGO = pngUni(600, 200, [11, 87, 208]);

let drive: DriveFaux;
let ctx: ContexteMoteur;
let sessionId = "";

async function contexte(doc: { nom: string; octets: Buffer }) {
  drive = {
    fichiers: new Map(),
    audit: [],
    droitEcriture: true,
    vision: new Map([
      [TAMPON.length, { texte: "ANPP — VISA N° 2027/114 — APPROUVÉ", note: "OCR local, confiance 0,82 — PROBABLE" }],
      [LOGO.length, { texte: "ADVENTUM PHARMA", note: "OCR local, confiance 0,91 — PROBABLE" }],
    ]),
    lectures: [],
  };
  drive.fichiers.set("doc", { nom: doc.nom, versions: [{ version: 1, octets: doc.octets, note: "" }] });
  drive.fichiers.set("tampon", { nom: "tampon ANPP.png", versions: [{ version: 1, octets: TAMPON, note: "" }] });
  drive.fichiers.set("logo", { nom: "logo Adventum.png", versions: [{ version: 1, octets: LOGO, note: "" }] });
  ctx = { ports: portsMemoire(drive), magasin: magasinMemoire(), acteur: { id: "u-pdg", libelle: "Amine" } };
  const r = await ouvrir(ctx, { nodeId: "doc" });
  if (!r.ok || !r.vue) throw new Error(r.motif ?? "ouverture impossible");
  sessionId = r.vue.sessionId;
}

beforeEach(() => { if (sessionId) oublierSession(sessionId); });

describe("lire une image d'un document Word", () => {
  it("les octets lus sont ceux de l'image DÉSIGNÉE, pas d'une autre du même document", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : rendre `word/media/image1.png` en se fiant au rang de
     * l'image. Les deux images s'appellent `image1` et `image2` dans le zip, mais rien ne
     * garantit que l'ordre des PARTIES suive l'ordre d'APPARITION — et après un remplacement,
     * il ne le suit plus. On lirait le logo en annonçant le tampon.
     */
    await contexte({ nom: "Dossier ANPP.docx", octets: await docxDeParagraphes(["Dossier", "Article 1"]) });
    await editer(ctx, sessionId, [
      commande("docx.inserer_image", { imageSource: "logo Adventum", largeurCm: 4, imageAlt: "logo de la société" }),
      commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3, imageAlt: "tampon de visa" }),
    ]);

    const r = await lireImageDuDocument(ctx, sessionId, { cible: cibleIndex(2) });
    expect(r.ok, r.motif ?? "").toBe(true);
    expect(r.texte).toContain("VISA N° 2027/114");
    expect(r.note).toContain("PROBABLE");
    expect(r.description).toBe("tampon de visa");
    expect(drive.lectures).toHaveLength(1);
    expect(drive.lectures?.[0].taille, "ce ne sont pas les octets du tampon").toBe(TAMPON.length);

    // Et la PREMIÈRE image rend l'autre lecture — la désignation change vraiment de cible.
    const r1 = await lireImageDuDocument(ctx, sessionId, { cible: cibleIndex(1) });
    expect(r1.texte).toContain("ADVENTUM PHARMA");
  });

  it("« l'image du tampon » se désigne aussi par son texte alternatif", async () => {
    await contexte({ nom: "Dossier.docx", octets: await docxDeParagraphes(["Dossier"]) });
    await editer(ctx, sessionId, [
      commande("docx.inserer_image", { imageSource: "logo Adventum", largeurCm: 4, imageAlt: "logo de la société" }),
      commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3, imageAlt: "tampon de visa ANPP" }),
    ]);
    const r = await lireImageDuDocument(ctx, sessionId, { cible: cibleTexte("tampon") });
    expect(r.ok, r.motif ?? "").toBe(true);
    expect(r.texte).toContain("VISA");
  });

  it("une désignation qui vise DEUX images rend les candidats et ne lit RIEN", async () => {
    await contexte({ nom: "Dossier.docx", octets: await docxDeParagraphes(["Dossier"]) });
    await editer(ctx, sessionId, [
      commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3, imageAlt: "tampon page 1" }),
      commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3, imageAlt: "tampon page 2" }),
    ]);
    const r = await lireImageDuDocument(ctx, sessionId, { cible: cibleTexte("tampon") });
    expect(r.ok).toBe(false);
    expect(r.candidats).toHaveLength(2);
    expect(drive.lectures, "on a appelé le lecteur alors qu'on ne savait pas quelle image").toHaveLength(0);
  });

  it("un document SANS image le dit — jamais une lecture vide qu'on prendrait pour un constat", async () => {
    await contexte({ nom: "Note.docx", octets: await docxDeParagraphes(["Note", "Rien à signaler"]) });
    const r = await lireImageDuDocument(ctx, sessionId, { cible: cibleIndex(1) });
    expect(r.ok).toBe(false);
    expect(r.motif).toMatch(/aucune image/i);
    expect(r.texte).toBe("");
  });
});

describe("les autres formats, par le même chemin", () => {
  it("PowerPoint : l'image de LA diapositive visée", async () => {
    await contexte({ nom: "Deck.pptx", octets: await pptxDiapos(3) });
    await editer(ctx, sessionId, [
      commande("pptx.inserer_image", { diapo: 1, imageSource: "logo Adventum", largeurCm: 4 }),
      commande("pptx.inserer_image", { diapo: 3, imageSource: "tampon ANPP", largeurCm: 4 }),
    ]);
    const r = await lireImageDuDocument(ctx, sessionId, { diapo: 3, cible: cibleTexte("tampon") });
    expect(r.ok, r.motif ?? "").toBe(true);
    expect(r.texte).toContain("VISA");
    expect(r.ou).toContain("diapositive 3");
  });

  it("PowerPoint : une forme qui n'est PAS une image nomme ce qu'elle est", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : rendre « rien lu » sur une zone de texte. On enverrait
     * chercher un défaut d'OCR là où il n'y a simplement aucun pixel à regarder.
     */
    await contexte({ nom: "Deck.pptx", octets: await pptxDiapos(2) });
    const r = await lireImageDuDocument(ctx, sessionId, { diapo: 1, cible: cibleIndex(1) });
    expect(r.ok).toBe(false);
    expect(r.motif).toMatch(/zone de texte/);
    expect(drive.lectures).toHaveLength(0);
  });

  it("Excel : l'image accrochée à une cellule, et la cellule est dite", async () => {
    await contexte({ nom: "Ventes.xlsx", octets: await xlsxVentes() });
    await editer(ctx, sessionId, [
      commande("xlsx.inserer_image", { feuille: "Ventes", plage: "E2", imageSource: "tampon ANPP", largeurCm: 3 }),
    ]);
    const r = await lireImageDuDocument(ctx, sessionId, { feuille: "Ventes", cible: cibleIndex(1) });
    expect(r.ok, r.motif ?? "").toBe(true);
    expect(r.texte).toContain("VISA");
    expect(r.ou).toContain("E2");
  });

  it("PDF : la PAGE demandée devient l'image, et une page absente est refusée", async () => {
    /**
     * Un scan n'a pas d'image « incorporée » : la page ENTIÈRE en est une. La lecture rend donc
     * la page rastérisée — c'est exactement ce que « lis le tampon page 3 » demande.
     */
    await contexte({ nom: "Dossier.pdf", octets: await pdfNumerote(4) });
    const r = await lireImageDuDocument(ctx, sessionId, { page: 3 });
    expect(r.ok, r.motif ?? "").toBe(true);
    expect(r.ou).toBe("page 3");
    expect(drive.lectures?.[0].nom).toBe("page-3.png");
    // Le PNG rendu ne fait partie d'aucun jeu de vision : la lecture est vide, et le DIT.
    expect(r.note).toContain("aucun texte lisible");

    const absente = await lireImageDuDocument(ctx, sessionId, { page: 9 });
    expect(absente.ok).toBe(false);
    expect(absente.motif).toContain("4");
  });
});

describe("ce que la lecture ne fait jamais", () => {
  it("sans vision branchée, elle le DIT — elle ne fait pas semblant d'avoir lu", async () => {
    /**
     * CE QUI FERAIT TOMBER CE TEST : rendre `{ ok: true, texte: "" }` quand le port manque.
     * Le modèle lirait « image lue, rien dedans » et conclurait que le tampon est vierge —
     * un faux succès parfait, alors que RIEN n'a été tenté (§34).
     */
    await contexte({ nom: "Dossier.docx", octets: await docxDeParagraphes(["Dossier"]) });
    await editer(ctx, sessionId, [commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3 })]);
    const sansVision: ContexteMoteur = { ...ctx, ports: { ...ctx.ports, vision: undefined } };
    const r = await lireImageDuDocument(sansVision, sessionId, { cible: cibleIndex(1) });
    expect(r.ok).toBe(false);
    expect(r.motif).toMatch(/n'est pas branchée/);
  });

  it("une lecture est TRACÉE à l'audit — lire le contenu d'un document est un accès", async () => {
    await contexte({ nom: "Dossier.docx", octets: await docxDeParagraphes(["Dossier"]) });
    await editer(ctx, sessionId, [commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3 })]);
    drive.audit.length = 0;
    await lireImageDuDocument(ctx, sessionId, { cible: cibleIndex(1) });
    const trace = drive.audit.find((a) => a.action === "artifact.image.lire");
    expect(trace, "aucune trace d'audit pour une lecture d'image").toBeTruthy();
    expect(trace?.cible).toBe("doc");
  });

  it("une session qui n'est pas à cette personne ne rend aucune image", async () => {
    await contexte({ nom: "Dossier.docx", octets: await docxDeParagraphes(["Dossier"]) });
    await editer(ctx, sessionId, [commande("docx.inserer_image", { imageSource: "tampon ANPP", largeurCm: 3 })]);
    const autre: ContexteMoteur = { ...ctx, acteur: { id: "u-stagiaire", libelle: "Quelqu'un d'autre" } };
    const r = await lireImageDuDocument(autre, sessionId, { cible: cibleIndex(1) });
    expect(r.ok).toBe(false);
    expect(drive.lectures).toHaveLength(0);
  });
});
