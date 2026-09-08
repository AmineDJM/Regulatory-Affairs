import { extractText } from "@/lib/regulatory/intelligence/extract/extract-text";
import { canOcr, ocrDocument } from "@/lib/regulatory/intelligence/ocr/ocr-engine";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIRE UN FICHIER — texte natif, et OCR quand il n'y en a pas. UN SEUL endroit (§118.5).
 *
 * ── LE DÉFAUT, ET IL SE LISAIT DANS DEUX FICHIERS VOISINS ───────────────────────────────
 *
 * `training/ingest-case.ts` océrise les scans depuis toujours, avec la bonne raison écrite en
 * commentaire : « un courrier ANPP est presque toujours un scan ; le refuser reviendrait à
 * exclure la pièce la plus précieuse ». `corpus/ingest-file.ts` — l'autre porte d'entrée de la
 * connaissance réglementaire — refusait :
 *
 *     « Document image (scanné) : le corpus attend un texte sélectionnable. Océrisez-le d'abord. »
 *
 * Le moteur OCR vit dans le répertoire d'à côté (`intelligence/ocr/`), il tourne en production
 * pour les documents de dossier, et il ne demande aucune clé pour son moteur de repli. On
 * renvoyait donc une personne faire à la main ce que le logiciel savait faire — un « je ne peux
 * pas » ARTIFICIEL, de la même famille que celui découvert dans le contrôle des livrables, qui
 * déclarait « aucun moteur de calcul Excel dans le dépôt » alors que le dépôt en portait un.
 *
 * Deux ingestions, une capacité branchée d'un seul côté : la réponse n'est pas de recopier les
 * dix lignes dans le second fichier — elles auraient divergé comme le reste — mais de n'avoir
 * qu'un lecteur, que les deux appellent.
 *
 * ── CE QUE CE MODULE NE FAIT PAS ────────────────────────────────────────────────────────
 *
 * Il ne juge pas si le texte est SUFFISANT : chaque ingestion a son propre seuil (un précédent
 * d'entraînement se contente de moins qu'une source réglementaire citable) et c'est à elle de le
 * dire. Il ne masque pas non plus l'origine : un texte océrisé revient avec sa MÉTHODE et sa
 * CONFIANCE, parce que le citer comme un texte natif serait présenter une lecture de machine
 * pour une lecture de la loi (§104.15).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface LectureFichier {
  texte: string;
  /** `texte` : lu dans le fichier. `ocr` : reconnu sur une image. */
  methode: "texte" | "ocr";
  /** Confiance moyenne de l'OCR (0-100), `null` pour un texte natif. */
  confiance: number | null;
  /** Vrai quand l'OCR lui-même juge que des pages méritent une relecture humaine. */
  aRelire: boolean;
  /** Pages océrisées, `null` pour un texte natif. */
  pages: number | null;
  /** Ce que l'extraction native a répondu — utile pour dire précisément ce qui a échoué. */
  statutNatif: string;
}

/** Le geste d'OCR, injectable : un test n'a ni réseau ni données de langue. */
export type MoteurOcr = (args: { ext: string; buffer: Buffer }) => Promise<{
  text: string; meanConfidence: number; needsReview: boolean; pageCount: number;
}>;

export async function lireTexteOuOcr(
  ext: string,
  buffer: Buffer,
  opts: { seuilOcr?: number; ocr?: MoteurOcr } = {},
): Promise<LectureFichier> {
  const extrait = await extractText(ext, buffer);
  const natif = (extrait.text ?? "").trim();
  const seuil = opts.seuilOcr ?? 300;

  // On n'océrise PAS un document qui porte déjà son texte : ce serait plus lent, moins fidèle,
  // et l'OCR d'un PDF natif rend un texte légèrement différent — deux versions du même arrêté.
  const aBesoin = extrait.status === "OCR_REQUIRED" || natif.length < seuil;
  if (!aBesoin || !canOcr(ext)) {
    return { texte: natif, methode: "texte", confiance: null, aRelire: false, pages: null, statutNatif: extrait.status };
  }

  try {
    const moteur = opts.ocr ?? ocrDocument;
    const r = await moteur({ ext, buffer });
    const texte = r.text.trim();
    // L'OCR ne gagne que s'il apporte DAVANTAGE. Sur un PDF à demi natif, garder le meilleur des
    // deux évite de remplacer un texte propre par une reconnaissance approximative.
    if (texte.length <= natif.length) {
      return { texte: natif, methode: "texte", confiance: null, aRelire: false, pages: null, statutNatif: extrait.status };
    }
    return {
      texte, methode: "ocr",
      confiance: Math.round(r.meanConfidence),
      aRelire: Boolean(r.needsReview),
      pages: r.pageCount,
      statutNatif: extrait.status,
    };
  } catch {
    // L'OCR indisponible n'est pas une réussite : on rend ce qu'on a, l'appelant dira que c'est
    // trop court. Prétendre le contraire fabriquerait une source vide dans le corpus.
    return { texte: natif, methode: "texte", confiance: null, aRelire: false, pages: null, statutNatif: extrait.status };
  }
}
