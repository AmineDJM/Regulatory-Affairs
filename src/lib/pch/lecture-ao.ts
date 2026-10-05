import { prisma } from "@/lib/prisma";
import { askClaude } from "@/lib/ai";
import { lireTexteOuOcr } from "@/lib/regulatory/intelligence/extract/texte-ou-ocr";
import { ocrDocument } from "@/lib/regulatory/intelligence/ocr/ocr-engine";
import {
  decouperPourLecture, empreinteLigneExtraite, lireLignesExtraites, planDeRemplacement, retirerDejaPresentes,
  phraseAucunProduit, REPONSE_INEXPLOITABLE, LECTURE_NON_ECRITE,
  type BilanLecture, type DecoupeLecture, type LigneExtraite, type LignesLues,
} from "@/lib/pch/extraction";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE LE DOCUMENT D'UN APPEL D'OFFRES, ET ÉCRIRE CE QU'ON Y A LU (audit 360°, lot D1c — F2).
 *
 * Module serveur ORDINAIRE — pas « use server » : `ecrireLectureAo` reçoit l'auteur, et une fonction qui
 * reçoit une identité dans un fichier « use server » serait un point d'entrée public (§118.153). Les
 * actions (`pch-tender-line-actions.ts`) lisent le formulaire, vérifient les portes, gardent le fichier,
 * enrichissent et DISENT ce qui a été fait ; ce module lit, demande au modèle, et écrit.
 *
 * Les règles (la coupe, la lecture de la réponse, « une ligne que personne n'a touchée », les phrases)
 * vivent dans `extraction.ts`, PUR : l'écrivain, le chargeur de l'écran et les bancs lisent les mêmes.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Pages océrisées au plus par le moteur LOCAL (Tesseract) — une limite opérationnelle, DITE dans la phrase
 * quand elle coupe. Mistral, lui, lit un PDF en entier et le facture en entier : c'est une décision de coût
 * de la Direction, nommée, pas tranchée ici.
 */
export const PAGES_OCR_MAX = 40;

/** Ce que la lecture du fichier a rendu — le texte, et COMMENT il a été obtenu. */
export interface LectureAo {
  texte: string;
  methode: "texte" | "ocr";
  /** L'OCR a été lancé (forcé, ou faute de texte natif). */
  ocrTente: boolean;
  /** Lancé, et il n'a rien rendu (moteur indisponible). */
  ocrEchoue: boolean;
  confiance: number | null;
  aRelire: boolean;
  /** Pages réellement océrisées, et pages du document — `null` pour un texte natif. */
  pagesLues: number | null;
  pagesTotal: number | null;
}

/** Un texte COLLÉ : ni fichier, ni OCR. */
export const LECTURE_TEXTE_COLLE: Omit<LectureAo, "texte"> = {
  methode: "texte", ocrTente: false, ocrEchoue: false, confiance: null, aRelire: false, pagesLues: null, pagesTotal: null,
};

/**
 * LE TEXTE DU FICHIER D'ABORD, L'OCR SEULEMENT QUAND IL MANQUE — par le lecteur canonique
 * (`lireTexteOuOcr`, §118.5) : la lecture d'avant océrisait tout PDF, même natif, et Mistral facture un
 * PDF page par page, quel que soit le plafond demandé (§118.63). « Océriser » coché lève le seuil : un PDF
 * à moitié scanné porte un texte natif ET ses tableaux en images — et l'OCR ne gagne que s'il rend plus.
 */
export async function lireDocumentAo(ext: string, buffer: Buffer, opts: { forcerOcr: boolean }): Promise<LectureAo> {
  const suivi = { tente: false, reussi: false, lues: null as number | null, total: null as number | null };
  const lu = await lireTexteOuOcr(ext, buffer, {
    seuilOcr: opts.forcerOcr ? Number.POSITIVE_INFINITY : undefined,
    ocr: async (a) => {
      suivi.tente = true;
      const r = await ocrDocument({ ext: a.ext, buffer: a.buffer, langs: ["fra", "eng"], maxPages: PAGES_OCR_MAX });
      suivi.reussi = true;
      suivi.lues = r.pages.length;
      suivi.total = r.pageCount;
      return { text: r.pages.map((p) => p.text).join("\n"), meanConfidence: r.meanConfidence, needsReview: r.needsReview, pageCount: r.pageCount };
    },
  });
  const ocr = lu.methode === "ocr";
  return {
    texte: lu.texte,
    methode: lu.methode,
    ocrTente: suivi.tente,
    ocrEchoue: suivi.tente && !suivi.reussi,
    confiance: lu.confiance,
    aRelire: lu.aRelire,
    pagesLues: ocr ? suivi.lues : null,
    pagesTotal: ocr ? suivi.total : null,
  };
}

const ANALYZE_SYSTEM = `Tu extrais les PRODUITS demandés dans un APPEL D'OFFRES pharmaceutique de la PCH
(Pharmacie Centrale des Hôpitaux, Algérie), à partir du texte du document (lu dans le fichier, ou
reconnu par OCR sur un scan).

Tu renvoies UNIQUEMENT un objet JSON valide (aucun texte autour) : { "lines": [ ... ] }.
Chaque élément de "lines" = un produit demandé, avec ces clés :
- "designation" : libellé du produit tel qu'écrit dans le document (obligatoire).
- "dci" : dénomination commune (molécule) si identifiable, sinon "".
- "dosage" : dosage (ex. "500 mg", "1 g"), sinon "".
- "form" : forme galénique (comprimé, injectable, sirop…), sinon "".
- "quantityUnits" : quantité demandée en UNITÉS (nombre entier). Si le document donne un nombre de
  boîtes et le conditionnement, convertis en unités si évident ; sinon mets la quantité telle quelle.
- "unitsPerBox" : nombre d'unités par boîte (« boîte de N ») si mentionné, sinon 0.
- "unitLabel" : NATURE de l'unité demandée, au singulier et en minuscules — « comprimé », « gélule »,
  « flacon », « ampoule », « seringue », « sachet », « suppositoire », « poche », « tube », « unité ».
  Un appel d'offres ne parle pas toujours de comprimés : c'est ce mot qui donne son sens à la quantité.
  Si le document ne le dit pas, déduis-le de la forme galénique ; en dernier recours mets "unité".

RÈGLES : n'invente aucun produit absent du document. N'invente pas de dosage ni de quantité. Si une
information manque, mets "" (texte) ou 0 (nombre). Extrais TOUS les produits listés.
Quand le texte annoncé est un EXTRAIT, n'invente aucun produit au-delà de ce qui est écrit.`;

export type DemandeLignes = ({ ok: true; coupe: DecoupeLecture } & LignesLues) | { ok: false; error: string };

/**
 * DEMANDER LES LIGNES AU MODÈLE — sur le texte COUPÉ s'il dépasse le budget, et en le DISANT au modèle :
 * sans cela, il prendrait l'extrait pour le document entier. La réponse est LUE (`lireLignesExtraites`) :
 * une réponse qui n'est pas une liste n'écrit rien, et le dit.
 */
export async function demanderLignesAo(texte: string): Promise<DemandeLignes> {
  const coupe = decouperPourLecture(texte);
  const entete = coupe.coupe
    ? `EXTRAIT du document d'appel d'offres — les ${coupe.lu.length} premiers caractères sur ${coupe.total} ; la suite n'est pas transmise :`
    : "Texte du document d'appel d'offres :";
  const r = await askClaude(`${entete}\n\n"""${coupe.lu}"""\n\nRenvoie le JSON { "lines": [...] }.`, {
    system: ANALYZE_SYSTEM, maxTokens: 3500, temperature: 0.1,
  });
  if (!r.ok || !r.text) return { ok: false, error: r.error ?? "Analyse impossible : rien n'a été écrit au tableau du marché." };
  const debut = r.text.indexOf("{");
  const fin = r.text.lastIndexOf("}");
  if (debut === -1 || fin <= debut) return { ok: false, error: REPONSE_INEXPLOITABLE };
  let brut: unknown;
  try { brut = JSON.parse(r.text.slice(debut, fin + 1)); } catch { return { ok: false, error: REPONSE_INEXPLOITABLE }; }
  const lu = lireLignesExtraites(brut);
  if (!lu) return { ok: false, error: REPONSE_INEXPLOITABLE };
  if (lu.lignes.length === 0) return { ok: false, error: phraseAucunProduit(lu.ecartees, coupe) };
  return { ok: true, coupe, ...lu };
}

class LectureRefusee extends Error {}

export type EcritureLecture =
  | { ok: true; extractionId: string; creees: string[]; bilan: Omit<BilanLecture, "fichier" | "enrichies"> }
  | { ok: false; error: string };

/**
 * ÉCRIRE UNE LECTURE — tout ou rien, UNE À LA FOIS PAR MARCHÉ.
 *
 *  • le VERROU du marché (`FOR UPDATE` sur sa ligne) : deux lectures croisées liraient les mêmes lignes,
 *    supprimeraient chacune les mêmes, et écriraient chacune leur série — le tableau doublé ;
 *  • la suppression EXIGE L'ÉTAT LU (`updatedAt`) : une ligne touchée entre la lecture et ici (corrigée,
 *    affectée à une BU, chiffrée) RESTE — et son produit n'est pas recréé à côté d'elle ;
 *  • les lignes neuves portent leur lecture et leur empreinte d'ORIGINE : c'est elle, et non la ligne
 *    corrigée depuis, qui reconnaît le même produit à la lecture suivante.
 */
export async function ecrireLectureAo(args: {
  tenderId: string;
  auteurId: string;
  source: "document" | "texte";
  nomFichier: string | null;
  complementaire: boolean;
  lecture: Omit<LectureAo, "texte">;
  demande: { lignes: LigneExtraite[]; ecartees: number; sansQuantite: number; coupe: DecoupeLecture };
}): Promise<EcritureLecture> {
  try {
    return await prisma.$transaction(async (tx) => {
      const verrou = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PchTender" WHERE id = ${args.tenderId} FOR UPDATE`;
      if (verrou.length === 0) throw new LectureRefusee("Appel d'offres introuvable.");

      const lues = await tx.pchTenderLine.findMany({
        where: { tenderId: args.tenderId },
        select: {
          id: true, updatedAt: true, sortOrder: true, extractionId: true, empreinteExtraction: true,
          designation: true, dosage: true, form: true, quantityUnits: true, modifieeLe: true,
          submissionSnapshot: true, status: true, note: true, unitPriceDzd: true, boxPriceDzd: true,
          boxCostDzd: true, awardedUnitPriceDzd: true, submittedQuantityUnits: true, awardedQuantityUnits: true,
          _count: { select: { businessUnits: true, contractLines: true, orderLines: true, sales: true, adProAllocations: true } },
        },
      });
      // Un bon d'avant les lignes de bon désigne sa ligne par `lineId` (héritage) : il compte comme un lien.
      const herites = new Set(
        (await tx.pchOrder.findMany({ where: { tenderId: args.tenderId, lineId: { not: null } }, select: { lineId: true } }))
          .map((b) => b.lineId),
      );
      const existantes = lues.map((l) => ({
        ...l,
        status: String(l.status),
        liens: l._count.businessUnits + l._count.contractLines + l._count.orderLines + l._count.sales
          + l._count.adProAllocations + (herites.has(l.id) ? 1 : 0),
      }));
      const plan = planDeRemplacement(existantes, args.demande.lignes, { complementaire: args.complementaire });

      const remplacees = plan.aSupprimer.length === 0 ? 0 : (await tx.pchTenderLine.deleteMany({
        where: { AND: [{ tenderId: args.tenderId }, { OR: plan.aSupprimer.map(({ id, updatedAt }) => ({ id, updatedAt })) }] },
      })).count;

      let aCreer = plan.aCreer;
      let dejaPresentes = plan.dejaPresentes;
      let restees = 0;
      if (remplacees < plan.aSupprimer.length) {
        // Des lignes prévues au remplacement ont été TOUCHÉES pendant la lecture : elles restent, et leur
        // produit n'est pas recréé à côté d'elles.
        const encore = await tx.pchTenderLine.findMany({
          where: { id: { in: plan.aSupprimer.map((x) => x.id) } },
          select: { empreinteExtraction: true, designation: true, dosage: true, form: true, quantityUnits: true },
        });
        restees = encore.length;
        const r = retirerDejaPresentes(aCreer, encore.map((e) => e.empreinteExtraction ?? empreinteLigneExtraite(e)));
        aCreer = r.aCreer;
        dejaPresentes += r.dejaPresentes;
      }

      const extraction = await tx.pchTenderExtraction.create({
        data: {
          tenderId: args.tenderId, source: args.source, nomFichier: args.nomFichier,
          methode: args.lecture.methode, confiance: args.lecture.confiance, aRelire: args.lecture.aRelire,
          pagesLues: args.lecture.pagesLues, pagesTotal: args.lecture.pagesTotal,
          caracteres: args.demande.coupe.total, caracteresLus: args.demande.coupe.lu.length,
          produits: args.demande.lignes.length, complementaire: args.complementaire, createdById: args.auteurId,
        },
        select: { id: true },
      });
      const base = lues.reduce((m, l) => Math.max(m, l.sortOrder + 1), 0);
      if (aCreer.length > 0) {
        await tx.pchTenderLine.createMany({
          data: aCreer.map((l, i) => ({
            ...l, tenderId: args.tenderId, sortOrder: base + i,
            extractionId: extraction.id, empreinteExtraction: empreinteLigneExtraite(l),
          })),
        });
      }
      const creees = (await tx.pchTenderLine.findMany({
        where: { extractionId: extraction.id }, select: { id: true }, orderBy: { sortOrder: "asc" },
      })).map((c) => c.id);

      return {
        ok: true as const,
        extractionId: extraction.id,
        creees,
        bilan: {
          source: args.source, nomFichier: args.nomFichier, methode: args.lecture.methode,
          ocrTente: args.lecture.ocrTente, ocrEchoue: args.lecture.ocrEchoue,
          confiance: args.lecture.confiance, aRelire: args.lecture.aRelire,
          pagesLues: args.lecture.pagesLues, pagesTotal: args.lecture.pagesTotal,
          caracteres: args.demande.coupe.total, caracteresLus: args.demande.coupe.lu.length,
          produitsLus: args.demande.lignes.length, ecartees: args.demande.ecartees, sansQuantite: args.demande.sansQuantite,
          complementaire: args.complementaire, creees: aCreer.length, dejaPresentes, remplacees,
          gardees: plan.gardees, restees, horsExtraction: plan.horsExtraction,
        },
      };
    }, { timeout: 30_000 });
  } catch (e) {
    if (e instanceof LectureRefusee) return { ok: false, error: e.message };
    console.error("[pch] lecture non écrite", e);
    return { ok: false, error: LECTURE_NON_ECRITE };
  }
}
