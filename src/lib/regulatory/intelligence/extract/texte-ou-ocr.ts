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
 *
 * ── CE QU'IL DIT DE L'OCR (lot D2) ──────────────────────────────────────────────────────
 *
 * Il rendait le texte natif, en silence, quand le moteur OCR levait : un scan dont l'OCR était
 * tombé ressortait « lu, presque vide », indiscernable d'une page blanche — et la lecture de l'appel
 * d'offres PCH devait reconstruire, dans une fermeture à elle, ce que ce lecteur aurait dû dire
 * (OCR tenté, réussi, pages lues, pages totales). Il le dit maintenant : tenté, échoué et pourquoi,
 * pages lues sur pages totales, coupe, moteur qui a VRAIMENT lu. Et `cloud: false` demande une
 * lecture LOCALE pour cet appel : aucun octet ne part chez un service tiers.
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
  /** L'OCR a été LANCÉ (faute de texte natif suffisant), quelle qu'en soit l'issue. */
  ocrTente: boolean;
  /** Lancé, et le moteur a LEVÉ : le texte rendu est le texte natif, pas une lecture de l'image. */
  ocrEchoue: boolean;
  /**
   * Pourquoi l'OCR n'a pas lu l'image alors qu'il le fallait : l'erreur du moteur, ou une image
   * qu'aucun moteur de ce serveur ne lit. `null` quand il a lu, ou qu'il n'en était pas besoin.
   * Une absence de lecteur n'est pas une lecture vide (§104.15).
   */
  raisonOcr: string | null;
  /** Pages réellement océrisées — `null` hors OCR, ou quand le moteur ne le dit pas (on ne le devine pas). */
  pagesLues: number | null;
  /** Pages du document selon le moteur OCR — `null` hors OCR. */
  pagesTotal: number | null;
  /**
   * Le texte rendu n'est PAS tout le document : extraction native plafonnée, ou pages que l'OCR a
   * laissées (plafond, page corrompue). Une coupe silencieuse se lit comme une exhaustivité (§118.60).
   */
  tronque: boolean;
  /** Le moteur OCR qui a VRAIMENT lu (« tesseract.js/7 », « mistral/… ») — `null` pour un texte natif. */
  moteur: string | null;
}

/**
 * Le geste d'OCR, injectable : un test n'a ni réseau ni données de langue. Il reçoit les options
 * de l'appel (`cloud`, `maxPages`) et peut dire ce qu'il sait de lui-même : pages réellement lues,
 * moteur qui a lu. Ce qu'il ne dit pas reste inconnu (`null`), jamais deviné.
 */
export type MoteurOcr = (args: { ext: string; buffer: Buffer; cloud?: boolean; maxPages?: number }) => Promise<{
  text: string; meanConfidence: number; needsReview: boolean; pageCount: number;
  pagesLues?: number; moteur?: string;
}>;

/** Le moteur de production : `ocrDocument`, et ce qu'il dit de sa lecture (pages lues, moteur réel). */
export const moteurParDefaut: MoteurOcr = async ({ ext, buffer, cloud, maxPages }) => {
  const r = await ocrDocument({ ext, buffer, cloud, maxPages });
  return {
    text: r.text, meanConfidence: r.meanConfidence, needsReview: r.needsReview, pageCount: r.pageCount,
    pagesLues: Array.isArray(r.pages) ? r.pages.length : undefined,
    moteur: typeof r.engine === "string" ? r.engine : undefined,
  };
};

const SANS_OCR = { ocrTente: false, ocrEchoue: false, raisonOcr: null } as const;

const entierOuNull = (n: unknown): number | null =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;

/** L'erreur du moteur, gardée (bornée) : sans elle, « l'OCR a échoué » ne dit pas quoi réparer. */
function raisonDeLEchec(err: unknown): string {
  const brut = (err instanceof Error ? err.message : String(err ?? "")).replace(/\s+/g, " ").trim();
  if (!brut) return "Le moteur OCR a échoué sans dire pourquoi.";
  return `Le moteur OCR a échoué : ${brut.length > 240 ? `${brut.slice(0, 240)}…` : brut}`;
}

export async function lireTexteOuOcr(
  ext: string,
  buffer: Buffer,
  opts: { seuilOcr?: number; ocr?: MoteurOcr; cloud?: boolean; maxPages?: number } = {},
): Promise<LectureFichier> {
  const extrait = await extractText(ext, buffer);
  const natif = (extrait.text ?? "").trim();
  const seuil = opts.seuilOcr ?? 300;
  // Le texte natif rendu tel quel — et ce qu'on sait de l'OCR, dit à côté.
  const natifSeul = (bilan: { ocrTente: boolean; ocrEchoue: boolean; raisonOcr: string | null }): LectureFichier => ({
    texte: natif, methode: "texte", confiance: null, aRelire: false, pages: null, statutNatif: extrait.status,
    ...bilan, pagesLues: null, pagesTotal: null, tronque: extrait.truncated === true, moteur: null,
  });

  // On n'océrise PAS un document qui porte déjà son texte : ce serait plus lent, moins fidèle,
  // et l'OCR d'un PDF natif rend un texte légèrement différent — deux versions du même arrêté.
  const aBesoin = extrait.status === "OCR_REQUIRED" || natif.length < seuil;
  if (!aBesoin) return natifSeul(SANS_OCR);
  if (!canOcr(ext)) {
    // Une image sans texte qu'AUCUN moteur de ce serveur ne lit (HEIC…) : rendre un vide muet ferait
    // conclure à une image vierge, alors que rien n'a été tenté. Un texte court lisible, lui, est lu.
    const raison = extrait.status === "OCR_REQUIRED"
      ? `Image « ${ext.toLowerCase()} » sans texte : aucun moteur OCR de ce serveur ne lit ce format.`
      : null;
    return natifSeul({ ...SANS_OCR, raisonOcr: raison });
  }

  try {
    const moteur = opts.ocr ?? moteurParDefaut;
    const r = await moteur({ ext, buffer, cloud: opts.cloud !== false, maxPages: opts.maxPages });
    const texte = r.text.trim();
    // L'OCR ne gagne que s'il apporte DAVANTAGE. Sur un PDF à demi natif, garder le meilleur des
    // deux évite de remplacer un texte propre par une reconnaissance approximative.
    if (texte.length <= natif.length) {
      return natifSeul({ ocrTente: true, ocrEchoue: false, raisonOcr: null });
    }
    const pagesLues = entierOuNull(r.pagesLues);
    const pagesTotal = entierOuNull(r.pageCount);
    return {
      texte, methode: "ocr",
      confiance: Math.round(r.meanConfidence),
      aRelire: Boolean(r.needsReview),
      pages: r.pageCount,
      statutNatif: extrait.status,
      ocrTente: true, ocrEchoue: false, raisonOcr: null,
      pagesLues, pagesTotal,
      tronque: pagesLues !== null && pagesTotal !== null && pagesLues < pagesTotal,
      moteur: typeof r.moteur === "string" && r.moteur.trim() ? r.moteur.trim() : null,
    };
  } catch (err) {
    // L'OCR indisponible n'est pas une réussite : on rend ce qu'on a — et on DIT qu'il est tombé, et
    // pourquoi. Le taire ferait lire un scan illisible comme une page blanche, et fabriquerait une
    // source vide dans le corpus.
    return natifSeul({ ocrTente: true, ocrEchoue: true, raisonOcr: raisonDeLEchec(err) });
  }
}
