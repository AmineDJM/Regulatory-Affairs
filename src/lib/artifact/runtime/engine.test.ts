/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DIALOGUE DE RÉFÉRENCE, DE BOUT EN BOUT (§99-102).
 *
 * Ce fichier rejoue MOT POUR MOT la conversation du cahier des charges :
 *
 *   « Affiche-moi le Word Contrat Consulting Mouffok. »   → le document s'ouvre
 *   « Centre le titre, réduis-le à 16, mets-le en Aptos. » → trois modifications visibles
 *   « Le titre un peu plus à gauche. »                     → une quatrième, relative
 *   « Supprime le troisième paragraphe. »                  → supprimé
 *   « Finalement annule la dernière modification. »        → vraiment annulé
 *   « C'est bon. Sauvegarde. »                             → nouvelle version dans le Drive
 *
 * ── CE QUI EST FAUX ICI, ET CE QUI NE L'EST PAS ────────────────────────────────────────
 *
 * Les PORTS sont faux : ils lisent un Buffer en mémoire au lieu d'un blob chiffré. Tout le
 * reste est le code de production — le moteur, les adaptateurs, le compilateur, le décodeur, le
 * journal, le rejeu. Le test part du VRAI point d'entrée (« la phrase que la personne tape »),
 * pas d'un état injecté à la main : c'est la condition posée par la clarification du cahier des
 * charges, et c'est ce qui fait la différence entre « le code est écrit » et « ça marche ».
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeEach } from "vitest";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { adaptateurPdf } from "@/lib/artifact/adapters/pdf/adapter";
import { docxDeParagraphes, pdfNumerote } from "@/lib/artifact/adapters/fixtures";
import type { DocxModel, PdfModel } from "@/lib/artifact/object-model/model";
import { commande, cibleIndex, cibleRole } from "@/lib/artifact/commands/ir";
import { decoder, estAccord } from "@/lib/artifact/commands/nl";
import type { VueDocx, VuePdf } from "@/lib/artifact/render/view";
import {
  annuler, editer, fermer, oublierSession, ouvrir, retablir, sauvegarder, viser, vueDeSession,
  type ContexteMoteur,
} from "@/lib/artifact/runtime/engine";
import { magasinMemoire, portsMemoire, type DriveFaux } from "@/lib/artifact/runtime/fakes";

let drive: DriveFaux;
let ctx: ContexteMoteur;

/** Le décodeur rend une union ; ces tests attendent des commandes et échouent sinon. */
function commandesDe(i: ReturnType<typeof decoder>) {
  if (!i || i.genre !== "commandes") throw new Error(`intention inattendue : ${i?.genre ?? "aucune"}`);
  return i.commandes;
}

async function contexteAvec(fichiers: { nodeId: string; nom: string; octets: Buffer }[], droitEcriture = true) {
  drive = { fichiers: new Map(), audit: [], droitEcriture };
  for (const f of fichiers) {
    drive.fichiers.set(f.nodeId, { nom: f.nom, versions: [{ version: 1, octets: f.octets, note: "" }] });
  }
  ctx = {
    ports: portsMemoire(drive),
    magasin: magasinMemoire(),
    acteur: { id: "u-pdg", libelle: "Amine" },
  };
}

beforeEach(() => {
  // Le cache d'états ouverts est un singleton de processus : sans purge, un test verrait le
  // document d'un autre. Le vider est exactement ce que fait la fermeture d'une session.
  for (const id of ["s1", "s2", "s3", "s4", "s5"]) oublierSession(id);
});

describe("§99 — le dialogue Word de référence, du premier mot au dernier", () => {
  it("ouvre, modifie, annule, sauvegarde — et le Drive porte la version 2", async () => {
    await contexteAvec([{
      nodeId: "n1",
      nom: "Contrat Consulting Mouffok.docx",
      octets: await docxDeParagraphes(
        ["Contrat Consulting Mouffok", "Article 1 — Objet", "Article 2 — Durée", "Article 3 — Rémunération"],
        { premierEstTitre: true },
      ),
    }]);

    // ── « Affiche-moi le Word Contrat Consulting Mouffok. » ────────────────────────────
    const ouverture = await ouvrir(ctx, { nom: "Contrat Consulting Mouffok" });
    expect(ouverture.ok).toBe(true);
    const vue0 = ouverture.vue!;
    expect(vue0.nom).toBe("Contrat Consulting Mouffok.docx");
    expect(vue0.format).toBe("DOCX");
    expect(vue0.etat).toBe("OPEN");
    expect(vue0.revision).toBe(0);
    expect(vue0.dirty).toBe(false);
    const contenu0 = vue0.contenu as VueDocx;
    expect(contenu0.blocs.filter((b) => b.type === "paragraphe").map((b) => b.texte)).toEqual([
      "Contrat Consulting Mouffok", "Article 1 — Objet", "Article 2 — Durée", "Article 3 — Rémunération",
    ]);
    const sid = vue0.sessionId;

    // ── « Centre le titre, réduis-le à 16, mets-le en Aptos. » ─────────────────────────
    const edition = await editer(ctx, sid, [
      commande("docx.align", { cible: cibleRole("titre"), alignement: "center" }),
      commande("docx.format_texte", { cible: cibleIndex(1), taillePt: 16 }),
      commande("docx.format_texte", { cible: cibleIndex(1), police: "Aptos" }),
    ]);
    expect(edition.ok).toBe(true);
    expect(edition.effets.every((e) => e.ok)).toBe(true);
    const titre = (v: typeof edition.vue) => (v!.contenu as VueDocx).blocs[0];
    expect(titre(edition.vue).alignement).toBe("center");
    expect(titre(edition.vue).style.sizePt).toBe(16);
    expect(titre(edition.vue).style.font).toBe("Aptos");
    // §64 — MÊME bloc de conversation, MÊME session, version incrémentée. Pas trois cartes.
    expect(edition.vue!.blockId).toBe(vue0.blockId);
    expect(edition.vue!.sessionId).toBe(sid);
    expect(edition.vue!.revision).toBe(3);
    expect(edition.vue!.dirty).toBe(true);

    // ── « Le titre un peu plus à gauche. » (relatif, décodé sans modèle) ───────────────
    const intention = decoder("Le titre un peu plus à gauche.", {
      format: "DOCX", derniereCible: [], activePage: null, activeSlide: null, activeSheet: null,
    });
    expect(intention).toEqual({ genre: "commandes", commandes: [expect.objectContaining({ op: "docx.retrait" })] });
    const gauche = await editer(ctx, sid, commandesDe(intention));
    expect(gauche.ok).toBe(true);
    expect(gauche.vue!.revision).toBe(4);

    // ── « Supprime le troisième paragraphe. » ──────────────────────────────────────────
    const suppression = await editer(ctx, sid, [commande("docx.supprimer_paragraphe", { cible: cibleIndex(3) })]);
    expect(suppression.ok).toBe(true);
    expect((suppression.vue!.contenu as VueDocx).blocs.filter((b) => b.type === "paragraphe").map((b) => b.texte))
      .toEqual(["Contrat Consulting Mouffok", "Article 1 — Objet", "Article 3 — Rémunération"]);

    // ── « Finalement annule la dernière modification. » ────────────────────────────────
    expect(decoder("Finalement annule la dernière modification.", {
      format: "DOCX", derniereCible: [], activePage: null, activeSlide: null, activeSheet: null,
    })).toEqual({ genre: "annuler" });
    const undo = await annuler(ctx, sid);
    expect(undo.ok).toBe(true);
    const apresUndo = (undo.vue!.contenu as VueDocx).blocs.filter((b) => b.type === "paragraphe").map((b) => b.texte);
    // Le paragraphe est REVENU, et les quatre modifications précédentes sont toujours là.
    expect(apresUndo).toEqual([
      "Contrat Consulting Mouffok", "Article 1 — Objet", "Article 2 — Durée", "Article 3 — Rémunération",
    ]);
    expect((undo.vue!.contenu as VueDocx).blocs[0].alignement).toBe("center");
    expect((undo.vue!.contenu as VueDocx).blocs[0].style.sizePt).toBe(16);
    expect(undo.vue!.peutRetablir).toBe(true);

    // ── « C'est bon. Sauvegarde. » ─────────────────────────────────────────────────────
    expect(estAccord("C'est bon")).toBe(true);
    const save = await sauvegarder(ctx, sid);
    expect(save.ok).toBe(true);
    expect(save.version).toBe(2);
    expect(save.vue!.dirty).toBe(false);
    expect(save.vue!.savedVersion).toBe(2);

    // Le Drive porte bien DEUX versions, et la seconde s'ouvre vraiment.
    const fichier = drive.fichiers.get("n1")!;
    expect(fichier.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(fichier.versions[1].note).toContain("centré");
    const relu = await adaptateurDocx.ouvrir(fichier.versions[1].octets);
    const m = relu.modele() as DocxModel;
    expect(m.paragraphs).toHaveLength(4);
    expect(m.paragraphs[0].alignment).toBe("center");
    expect(m.paragraphs[0].style.sizePt).toBe(16);
    expect(m.paragraphs[0].style.font).toBe("Aptos");
    // La VERSION 1 reste ouvrable et inchangée (§21).
    const v1 = await adaptateurDocx.ouvrir(fichier.versions[0].octets);
    expect((v1.modele() as DocxModel).paragraphs[0].alignment).toBeNull();
  });

  it("l'historique raconte ce qui s'est passé, annulations comprises", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["Titre", "Corps"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })]);
    await editer(ctx, sid, [commande("docx.format_texte", { cible: cibleIndex(1), gras: true })]);
    await annuler(ctx, sid);
    const vue = (await vueDeSession(ctx, sid))!;
    expect(vue.historique).toHaveLength(2);
    expect(vue.historique[0].annulee).toBe(false);
    expect(vue.historique[1].annulee).toBe(true);
    expect(vue.historique[0].resume).toContain("centré");
    expect(vue.peutAnnuler).toBe(true);
    expect(vue.peutRetablir).toBe(true);
  });
});

describe("§100 — le dialogue PDF", () => {
  it("« supprime les pages 12, 14 et 18 » puis « annule » revient à 20 pages", async () => {
    await contexteAvec([{ nodeId: "p1", nom: "Dossier ANPP.pdf", octets: await pdfNumerote(20) }]);
    const ouverture = await ouvrir(ctx, { nodeId: "p1" });
    expect(ouverture.ok).toBe(true);
    const sid = ouverture.vue!.sessionId;
    expect((ouverture.vue!.contenu as VuePdf).pages).toHaveLength(20);
    expect(ouverture.vue!.activePage).toBe(1);

    // La phrase est décodée sans aucun appel de modèle (§30).
    const intention = decoder("Supprime les pages 12, 14 et 18.", {
      format: "PDF", derniereCible: [], activePage: 1, activeSlide: null, activeSheet: null,
    });
    expect(intention).toEqual({ genre: "commandes", commandes: [expect.objectContaining({ op: "pdf.supprimer_pages", pages: [12, 14, 18] })] });

    const r = await editer(ctx, sid, commandesDe(intention));
    expect(r.ok).toBe(true);
    expect(r.effets[0].resume).toContain("17 pages");
    const pages = (r.vue!.contenu as VuePdf).pages;
    expect(pages).toHaveLength(17);
    expect(pages.map((p) => p.index)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(pages.map((p) => p.apercu)).not.toContain("Page 12");

    const undo = await annuler(ctx, sid);
    expect((undo.vue!.contenu as VuePdf).pages).toHaveLength(20);

    const save = await sauvegarder(ctx, sid);
    // Après annulation, le document est redevenu identique à l'original — mais il reste « sale »
    // et la sauvegarde est acceptée : c'est à la personne de décider, pas au code de deviner.
    expect(save.ok).toBe(true);
    const relu = await adaptateurPdf.ouvrir(drive.fichiers.get("p1")!.versions[1].octets);
    expect((relu.modele() as PdfModel).pages).toHaveLength(20);
  });
});

describe("continuité, idempotence et reprise", () => {
  it("ré-ouvrir le même document REPREND la session, sans perdre les modifications (§36)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["Titre", "Corps"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })]);
    const seconde = await ouvrir(ctx, { nodeId: "n1" });
    expect(seconde.vue!.sessionId).toBe(sid);
    expect(seconde.vue!.revision).toBe(1);
    expect((seconde.vue!.contenu as VueDocx).blocs[0].alignement).toBe("center");
  });

  it("la MÊME clé d'opération n'applique la commande qu'une fois (§18)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A", "B", "C"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    const cmd = [commande("docx.supprimer_paragraphe", { cible: cibleIndex(2) })];
    const un = await editer(ctx, sid, cmd, { operationId: "op-42" });
    expect(un.ok).toBe(true);
    expect((un.vue!.contenu as VueDocx).blocs.map((b) => b.texte)).toEqual(["A", "C"]);
    // Le double clic. Sans idempotence, il supprimerait « C ».
    const deux = await editer(ctx, sid, cmd, { operationId: "op-42" });
    expect(deux.ok).toBe(false);
    // LA VUE RENVOYÉE IMMÉDIATEMENT compte autant que l'état relu ensuite : c'est elle qui
    // s'affiche. Un moteur qui applique puis rejette laisserait « A » seul à l'écran tout en
    // répondant « déjà fait », et la relecture d'après le corrigerait sans que personne ne voie
    // rien — jusqu'à la sauvegarde. Cette assertion manquait ; un sabotage l'a montré.
    expect((deux.vue!.contenu as VueDocx).blocs.map((b) => b.texte)).toEqual(["A", "C"]);
    expect(deux.vue!.revision).toBe(1);
    expect((await vueDeSession(ctx, sid))!.historique).toHaveLength(1);
    expect(((await vueDeSession(ctx, sid))!.contenu as VueDocx).blocs.map((b) => b.texte)).toEqual(["A", "C"]);
  });

  it("après un redémarrage (cache vidé), l'état se REJOUE depuis le journal (§80)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["Titre", "Alpha", "Bravo"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })]);
    await editer(ctx, sid, [commande("docx.supprimer_paragraphe", { cible: cibleIndex(2) })]);

    // Le processus redémarre : plus rien en mémoire. La base, elle, a tout.
    oublierSession(sid);
    const vue = (await vueDeSession(ctx, sid))!;
    expect((vue.contenu as VueDocx).blocs.map((b) => b.texte)).toEqual(["Titre", "Bravo"]);
    expect((vue.contenu as VueDocx).blocs[0].alignement).toBe("center");
    expect(vue.revision).toBe(2);
  });

  it("annuler puis rétablir revient exactement à l'état d'avant", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A", "B", "C"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.supprimer_paragraphe", { cible: cibleIndex(2) })]);
    await annuler(ctx, sid);
    expect(((await vueDeSession(ctx, sid))!.contenu as VueDocx).blocs.map((b) => b.texte)).toEqual(["A", "B", "C"]);
    const redo = await retablir(ctx, sid);
    expect(redo.ok).toBe(true);
    expect((redo.vue!.contenu as VueDocx).blocs.map((b) => b.texte)).toEqual(["A", "C"]);
  });

  it("« annule » sans rien à annuler le dit, au lieu de faire semblant", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    const r = await annuler(ctx, sid);
    expect(r.ok).toBe(false);
    expect(r.motif).toContain("rien à annuler");
  });
});

describe("ce que le moteur REFUSE", () => {
  it("plusieurs documents portent le nom demandé : il rend les candidats, il ne choisit pas", async () => {
    await contexteAvec([
      { nodeId: "a", nom: "Contrat Consulting 2025.docx", octets: await docxDeParagraphes(["A"]) },
      { nodeId: "b", nom: "Contrat Consulting 2026.docx", octets: await docxDeParagraphes(["B"]) },
    ]);
    const r = await ouvrir(ctx, { nom: "Contrat Consulting" });
    expect(r.ok).toBe(false);
    expect(r.vue).toBeNull();
    expect(r.candidats.map((c) => c.nodeId).sort()).toEqual(["a", "b"]);
    expect(r.motif).toContain("Lequel");
  });

  it("un format non bureautique est refusé clairement", async () => {
    await contexteAvec([{ nodeId: "z", nom: "photo.jpg", octets: Buffer.from("pas un document") }]);
    const r = await ouvrir(ctx, { nodeId: "z" });
    expect(r.ok).toBe(false);
    expect(r.motif).toContain("Word, Excel, PowerPoint ou PDF");
  });

  it("sans droit d'ÉCRITURE, on peut lire et éditer en session, mais pas enregistrer (§74)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A", "B"]) }], false);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    expect((await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })])).ok).toBe(true);
    const save = await sauvegarder(ctx, sid);
    expect(save.ok).toBe(false);
    expect(save.motif).toContain("droit");
    // Le Drive n'a PAS reçu de seconde version.
    expect(drive.fichiers.get("n1")!.versions).toHaveLength(1);
  });

  it("une commande d'un AUTRE format est refusée par le compilateur", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    const r = await editer(ctx, sid, [commande("pdf.supprimer_pages", { pages: [1] })]);
    expect(r.ok).toBe(false);
    expect(r.motif).toContain("ne s'applique pas à un document DOCX");
  });

  it("une cible ambiguë rend les CANDIDATS, elle ne modifie rien au hasard (§32)", async () => {
    await contexteAvec([{
      nodeId: "n1", nom: "Note.docx",
      octets: await docxDeParagraphes(["Article 1 — Objet", "Article 2 — Objet du contrat", "Fin"]),
    }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    const r = await editer(ctx, sid, [commande("docx.align", { cible: { id: null, index: null, contient: "Objet", role: null }, alignement: "center" })]);
    expect(r.ok).toBe(false);
    expect(r.effets[0].candidats).toHaveLength(2);
    expect(r.effets[0].motif).toContain("lequel");
    // Aucun des deux n'a bougé.
    expect(((await vueDeSession(ctx, sid))!.contenu as VueDocx).blocs.every((b) => b.alignement === null)).toBe(true);
  });

  it("un lot partiellement valide applique ce qu'il peut et dit le reste (§8)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["Titre", "Corps"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    const r = await editer(ctx, sid, [
      commande("docx.align", { cible: cibleIndex(1), alignement: "center" }),
      commande("docx.supprimer_paragraphe", { cible: cibleIndex(9) }),
    ]);
    expect(r.ok).toBe(true);
    expect(r.effets.filter((e) => e.ok)).toHaveLength(1);
    expect(r.effets.filter((e) => !e.ok)[0].motif).toContain("9");
    expect((r.vue!.contenu as VueDocx).blocs[0].alignement).toBe("center");
  });

  it("le verrou optimiste refuse d'écraser la version de quelqu'un d'autre (§50)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A", "B"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })]);
    // Pendant ce temps, quelqu'un d'autre enregistre.
    drive.fichiers.get("n1")!.versions.push({ version: 2, octets: await docxDeParagraphes(["X"]), note: "collègue" });

    const save = await sauvegarder(ctx, sid);
    expect(save.ok).toBe(false);
    expect(save.motif).toContain("version 2");
    expect(drive.fichiers.get("n1")!.versions).toHaveLength(2);
    // La personne tranche : on force, et sa version part en 3 — sans détruire la 2.
    const force = await sauvegarder(ctx, sid, { forcer: true });
    expect(force.ok).toBe(true);
    expect(force.version).toBe(3);
    expect(drive.fichiers.get("n1")!.versions.map((v) => v.version)).toEqual([1, 2, 3]);
  });
});

describe("working set, enregistrer sous, fermeture", () => {
  it("viser une page met à jour le working set (§4)", async () => {
    await contexteAvec([{ nodeId: "p1", nom: "Dossier.pdf", octets: await pdfNumerote(6) }]);
    const sid = (await ouvrir(ctx, { nodeId: "p1" })).vue!.sessionId;
    const r = await viser(ctx, sid, { page: 4, selection: ["page4"] });
    expect(r.vue!.activePage).toBe(4);
    expect(r.vue!.surbrillance).toEqual(["page4"]);
  });

  it("« enregistrer sous » crée un NOUVEAU fichier et laisse l'original intact (§23)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Modèle.docx", octets: await docxDeParagraphes(["Titre", "Corps"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.texte", { cible: cibleIndex(1), texte: "Contrat Mouffok" })]);
    const save = await sauvegarder(ctx, sid, { sousLeNom: "Contrat Mouffok.docx" });
    expect(save.ok).toBe(true);
    expect(save.nodeId).not.toBe("n1");
    expect(drive.fichiers.get("n1")!.versions).toHaveLength(1);
    const nouveau = drive.fichiers.get(save.nodeId!)!;
    expect(nouveau.nom).toBe("Contrat Mouffok.docx");
    const m = (await adaptateurDocx.ouvrir(nouveau.versions[0].octets)).modele() as DocxModel;
    expect(m.paragraphs[0].text).toBe("Contrat Mouffok");
  });

  it("fermer un document sale le SIGNALE au lieu de perdre le travail en silence", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A", "B"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })]);
    const r = await fermer(ctx, sid);
    expect(r.ok).toBe(true);
    expect(r.perdues).toBe(true);
  });

  it("chaque geste laisse une trace d'audit (§76)", async () => {
    await contexteAvec([{ nodeId: "n1", nom: "Note.docx", octets: await docxDeParagraphes(["A", "B"]) }]);
    const sid = (await ouvrir(ctx, { nodeId: "n1" })).vue!.sessionId;
    await editer(ctx, sid, [commande("docx.align", { cible: cibleIndex(1), alignement: "center" })]);
    await annuler(ctx, sid);
    await sauvegarder(ctx, sid);
    expect(drive.audit.map((a) => a.action)).toEqual([
      "ARTIFACT_OPEN", "ARTIFACT_EDIT", "ARTIFACT_UNDO", "ARTIFACT_SAVE",
    ]);
    // §77 — le journal porte le RÉSUMÉ, jamais le contenu du document.
    expect(drive.audit.every((a) => !a.detail.includes("Article"))).toBe(true);
  });
});
