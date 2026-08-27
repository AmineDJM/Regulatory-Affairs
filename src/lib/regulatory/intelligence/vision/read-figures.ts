import type { LunaCallInput } from "@/lib/openai-luna";
import { trackedLuna } from "@/lib/regulatory/intelligence/cost/ledger";
import { rasterizePdfStream } from "@/lib/regulatory/intelligence/ocr/ocr-engine";

/**
 * LECTURE DES FIGURES D'UN DOCUMENT CTD — ce que l'OCR ne voit pas.
 *
 * Un dossier qualité se joue autant dans ses COURBES que dans son texte : profil de
 * dissolution, cinétique de dégradation en stabilité, chromatogrammes, schéma de procédé,
 * arbre de décision. L'OCR ramène ces pages à quelques axes et légendes ; la donnée qui compte
 * — la tendance, le point hors spécification, l'étape manquante du procédé — disparaît.
 *
 * Ici, on envoie les **pages rastérisées** au modèle multimodal et on lui demande de décrire
 * ce qu'il VOIT, en respectant deux règles :
 *   • ne rien inventer : une valeur non lisible est déclarée non lisible ;
 *   • citer la page, toujours — une observation sans page n'est pas vérifiable.
 *
 * Le résultat n'est pas un finding : c'est une **observation sourcée** que les agents de revue
 * et les règles exploitent ensuite. La frontière humaine reste inchangée.
 */

export type FigureKind =
  | "COURBE_STABILITE"
  | "PROFIL_DISSOLUTION"
  | "CHROMATOGRAMME"
  | "SCHEMA_PROCEDE"
  | "TABLEAU"
  | "SPECTRE"
  | "PHOTO_CONDITIONNEMENT"
  | "AUTRE";

export interface FigureObservation {
  page: number;
  kind: FigureKind;
  /** Titre ou légende de la figure, tels qu'écrits. */
  caption: string | null;
  /** Ce que la figure montre, en une à trois phrases factuelles. */
  description: string;
  /** Valeurs chiffrées lisibles (ex. « t=6 mois : 97,2 % »). Vide si illisible. */
  readings: string[];
  /** Ce qui mérite l'attention d'un évaluateur — sans jamais conclure à la place de l'humain. */
  concerns: string[];
  confidence: number;
}

/**
 * DÉFAUTS DE FORME — ce qu'un examinateur refuse AVANT même de lire le fond.
 *
 * Un dossier réglementaire se fait recaler pour des motifs qui n'ont rien à voir avec la science :
 * une capture d'écran collée à la place d'un certificat, une photo de papier prise au téléphone,
 * un scan de travers, un filigrane « DRAFT » resté en place, un emplacement de signature vide.
 * Aucun de ces défauts n'est détectable dans le TEXTE — l'OCR d'une capture d'écran rend un texte
 * parfaitement propre. Il faut regarder l'image.
 *
 * C'est pourquoi ce contrôle voyage dans la MÊME passe que la lecture des figures : rastériser et
 * transmettre les pages est le vrai coût ; poser une seconde question à l'image déjà envoyée est
 * quasi gratuit. Les séparer aurait doublé la facture pour rien.
 */
export type FormDefectKind =
  | "CAPTURE_ECRAN"
  | "PHOTO_ECRAN"
  | "PHOTO_DOCUMENT"
  | "SCAN_ILLISIBLE"
  | "PAGE_TRONQUEE"
  | "PAGE_DE_TRAVERS"
  | "FILIGRANE_BROUILLON"
  | "SIGNATURE_ABSENTE"
  | "TAMPON_ABSENT"
  | "MENTION_ILLISIBLE"
  | "AUTRE";

export const FORM_DEFECT_KINDS: FormDefectKind[] = [
  "CAPTURE_ECRAN", "PHOTO_ECRAN", "PHOTO_DOCUMENT", "SCAN_ILLISIBLE", "PAGE_TRONQUEE",
  "PAGE_DE_TRAVERS", "FILIGRANE_BROUILLON", "SIGNATURE_ABSENTE", "TAMPON_ABSENT",
  "MENTION_ILLISIBLE", "AUTRE",
];

/** Libellés d'écran + gravité par défaut. Une capture d'écran n'est PAS un détail de mise en page. */
export const FORM_DEFECT_LABEL: Record<FormDefectKind, string> = {
  CAPTURE_ECRAN: "Capture d'écran au lieu du document original",
  PHOTO_ECRAN: "Photographie d'un écran",
  PHOTO_DOCUMENT: "Photographie d'un papier au lieu d'un scan",
  SCAN_ILLISIBLE: "Scan illisible (flou, trop sombre, résolution insuffisante)",
  PAGE_TRONQUEE: "Page tronquée — contenu coupé au bord",
  PAGE_DE_TRAVERS: "Page numérisée de travers",
  FILIGRANE_BROUILLON: "Filigrane « brouillon / spécimen / ne pas soumettre »",
  SIGNATURE_ABSENTE: "Emplacement de signature vide",
  TAMPON_ABSENT: "Cachet ou tampon attendu absent",
  MENTION_ILLISIBLE: "Mention obligatoire illisible",
  AUTRE: "Autre défaut de forme",
};

/**
 * Gravité par défaut. `CRITICAL` est réservé à ce qui rend la pièce IRRECEVABLE en l'état : une
 * capture d'écran, une photo d'écran et un filigrane « brouillon » ne se corrigent pas par une
 * explication — il faut la pièce authentique.
 */
export const FORM_DEFECT_SEVERITY: Record<FormDefectKind, "CRITICAL" | "MAJOR" | "MINOR"> = {
  CAPTURE_ECRAN: "CRITICAL",
  PHOTO_ECRAN: "CRITICAL",
  FILIGRANE_BROUILLON: "CRITICAL",
  PHOTO_DOCUMENT: "MAJOR",
  SCAN_ILLISIBLE: "MAJOR",
  PAGE_TRONQUEE: "MAJOR",
  SIGNATURE_ABSENTE: "MAJOR",
  TAMPON_ABSENT: "MAJOR",
  MENTION_ILLISIBLE: "MAJOR",
  PAGE_DE_TRAVERS: "MINOR",
  AUTRE: "MINOR",
};

export interface FormDefect {
  page: number;
  kind: FormDefectKind;
  /** Ce qui est vu, factuellement — ce qui rend le constat opposable. */
  evidence: string;
  confidence: number;
}

export interface FigureReport {
  observations: FigureObservation[];
  defects: FormDefect[];
  pagesRead: number;
  costUsd: number;
  ok: boolean;
  error?: string;
}

const FIGURE_KINDS: FigureKind[] = [
  "COURBE_STABILITE", "PROFIL_DISSOLUTION", "CHROMATOGRAMME", "SCHEMA_PROCEDE",
  "TABLEAU", "SPECTRE", "PHOTO_CONDITIONNEMENT", "AUTRE",
];

export const FIGURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["observations", "defauts"],
  properties: {
    defauts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "type", "constat", "confiance"],
        properties: {
          page: { type: "integer" },
          type: { type: "string", enum: FORM_DEFECT_KINDS },
          constat: { type: "string" },
          confiance: { type: "number" },
        },
      },
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "kind", "caption", "description", "readings", "concerns", "confidence"],
        properties: {
          page: { type: "integer" },
          kind: { type: "string", enum: FIGURE_KINDS },
          caption: { type: ["string", "null"] },
          description: { type: "string" },
          readings: { type: "array", items: { type: "string" } },
          concerns: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;

const SYSTEM = `Tu examines les PAGES d'un dossier pharmaceutique CTD et tu décris les FIGURES qu'elles contiennent :
graphiques, courbes, chromatogrammes, schémas de procédé, tableaux de résultats, photos de conditionnement.

RÈGLES
1. Tu décris ce que tu VOIS. Tu n'inventes aucune valeur : si un chiffre n'est pas lisible, ne le donne pas.
2. "page" = le rang de l'image fournie (la première est la page 1). Une observation sans page n'est pas vérifiable.
3. "readings" = uniquement les valeurs RÉELLEMENT lisibles sur la figure (« t=6 mois : 97,2 % »).
4. "concerns" = ce qui mériterait l'attention d'un évaluateur : tendance descendante, point hors
   spécification, axe sans unité, échelle tronquée, lot manquant, étape de procédé non décrite.
   Tu SIGNALES, tu ne conclus pas : la décision appartient à l'évaluateur humain.
5. Ignore les pages de texte pur : ne renvoie une observation que s'il y a réellement une figure.
6. "confidence" entre 0 et 1 : ta certitude de lecture. Un scan flou mérite une confiance basse.

CONTRÔLE DE FORME (champ "defauts") — aussi important que le fond.
Un examinateur ANPP refuse une pièce sur sa FORME avant même d'en lire le contenu. Aucun de ces
défauts n'est visible dans le texte : l'OCR d'une capture d'écran rend un texte parfaitement
propre. Toi, tu vois l'image — c'est là ton seul avantage, utilise-le.

Signale, page par page :
- CAPTURE_ECRAN : capture d'écran d'un logiciel ou d'un site collée à la place du document
  original (barre de navigation, curseur, bordure de fenêtre, onglets, barre des tâches, ombre
  d'interface, pixellisation d'affichage). Un certificat ou un rapport doit être le document
  ÉMIS, pas une image de ce document affiché à l'écran ;
- PHOTO_ECRAN : photographie d'un écran (moiré, reflets, lignes de balayage, bords non droits) ;
- PHOTO_DOCUMENT : photographie d'une feuille de papier au lieu d'une numérisation (ombre de la
  main, perspective, fond de bureau visible, éclairage inégal) ;
- SCAN_ILLISIBLE : flou, trop sombre, trop clair, résolution manifestement insuffisante ;
- PAGE_TRONQUEE : texte ou tableau coupé au bord de la page ;
- PAGE_DE_TRAVERS : numérisation nettement inclinée ;
- FILIGRANE_BROUILLON : filigrane ou mention DRAFT, BROUILLON, SPECIMEN, SAMPLE, COPY,
  « NOT FOR SUBMISSION », « FOR INTERNAL USE » ;
- SIGNATURE_ABSENTE : emplacement de signature visiblement vide sur une pièce qui en exige une ;
- TAMPON_ABSENT : cachet/tampon attendu manifestement absent ;
- MENTION_ILLISIBLE : mention obligatoire (date, numéro de lot, référence) présente mais illisible.

"constat" décrit CE QUE TU VOIS et qui te fait conclure (« barre d'adresse de navigateur en haut
de page », « reflet et moiré caractéristiques d'une photo d'écran »). Sans cette description, le
constat n'est pas opposable — ne l'émets pas.
N'invente aucun défaut : une page propre ne produit RIEN. Mieux vaut une liste vide qu'un doute.

Réponds en français.`;

/** Construit la consigne de lecture des figures. Fonction PURE — testée sans réseau. */
export function buildFigureCall(
  images: { buffer: Buffer; mime?: string }[],
  filename: string,
  ctdSection?: string | null,
): LunaCallInput {
  return {
    system: SYSTEM,
    user:
      `Document : « ${filename} »${ctdSection ? ` (section CTD ${ctdSection})` : ""}.\n` +
      `${images.length} page(s) fournie(s) en image.\n\n` +
      `1) Décris les figures présentes ("observations"). S'il n'y en a aucune, renvoie une liste vide.\n` +
      `2) Contrôle la FORME de chaque page ("defauts") : capture d'écran, photo d'écran, photo de papier, ` +
      `scan illisible, page tronquée ou de travers, filigrane brouillon, signature/tampon absent. ` +
      `Une page propre ne produit aucun défaut.`,
    images,
    jsonSchema: { name: "ctd_figures", schema: FIGURE_SCHEMA as unknown as Record<string, unknown> },
    maxOutputTokens: 8_000,
    temperature: 0,
  };
}

const KINDS = new Set<string>(FIGURE_KINDS);

/** Assainit la réponse : une observation sans description ou sans page n'a aucune valeur. */
export function parseFigures(raw: unknown): FigureObservation[] {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.observations) ? o.observations : [];
  const out: FigureObservation[] = [];

  for (const item of list) {
    const r = (item ?? {}) as Record<string, unknown>;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    const page = Number(r.page);
    if (!description || !Number.isFinite(page) || page < 1) continue; // non vérifiable → écarté

    const conf = Number(r.confidence);
    out.push({
      page: Math.round(page),
      kind: typeof r.kind === "string" && KINDS.has(r.kind) ? (r.kind as FigureKind) : "AUTRE",
      caption: typeof r.caption === "string" && r.caption.trim() ? r.caption.trim() : null,
      description,
      readings: Array.isArray(r.readings) ? r.readings.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [],
      concerns: Array.isArray(r.concerns) ? r.concerns.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [],
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
    });
  }
  return out;
}

const DEFECT_KINDS = new Set<string>(FORM_DEFECT_KINDS);

/**
 * Assainit les défauts de forme. Un défaut SANS constat visuel est écarté : « c'est une capture
 * d'écran » sans dire à quoi on le voit ne s'oppose à personne, et ferait recaler une pièce
 * valable sur une intuition. Fonction PURE — testée.
 */
export function parseDefects(raw: unknown): FormDefect[] {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.defauts) ? o.defauts : [];
  const out: FormDefect[] = [];

  for (const item of list) {
    const r = (item ?? {}) as Record<string, unknown>;
    const evidence = typeof r.constat === "string" ? r.constat.trim() : "";
    const page = Number(r.page);
    if (!evidence || !Number.isFinite(page) || page < 1) continue; // non opposable → écarté

    const conf = Number(r.confiance);
    out.push({
      page: Math.round(page),
      kind: typeof r.type === "string" && DEFECT_KINDS.has(r.type) ? (r.type as FormDefectKind) : "AUTRE",
      evidence,
      confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.5,
    });
  }
  return out;
}

/** Pages envoyées par passe : au-delà, le coût grimpe plus vite que la valeur ajoutée. */
const PAGES_PER_PASS = 12;

export interface ReadFiguresInput {
  buffer: Buffer;
  filename: string;
  ext: string;
  ctdSection?: string | null;
  dossierId?: string | null;
  dossierVersionId?: string | null;
  documentId?: string | null;
  /** Plafond de pages examinées pour ce document. */
  maxPages?: number;
}

/**
 * Lit les figures d'un document. Ne lève jamais ; renvoie une liste vide si le document
 * n'a pas de figure ou n'a pas pu être rastérisé.
 */
export async function readFigures(input: ReadFiguresInput): Promise<FigureReport> {
  // `maxPages` n'est plus un plafond de produit : 0 (le défaut) = TOUT le document. Le plafond de
  // 60 pages avait la même origine que celui de l'OCR — la mémoire — et la même conséquence : un
  // dossier de 800 pages examiné sur ses 60 premières, sans que rien ne le dise.
  const maxPages = Math.max(input.maxPages ?? 0, 0);

  const observations: FigureObservation[] = [];
  const defects: FormDefect[] = [];
  let costUsd = 0;
  let pagesRead = 0;
  let stopped: string | null = null;

  /** Envoie une passe de pages et range les résultats. Renvoie faux s'il faut tout arrêter. */
  const flush = async (slice: { buffer: Buffer; mime?: string }[], offset: number): Promise<boolean> => {
    const res = await trackedLuna<unknown>(
      {
        dossierId: input.dossierId ?? null,
        dossierVersionId: input.dossierVersionId ?? null,
        documentId: input.documentId ?? null,
        step: "figures",
      },
      buildFigureCall(slice, input.filename, input.ctdSection),
    );
    costUsd += res.usage.costUsd;
    if (!res.ok) {
      // Budget épuisé → on s'arrête net et on rend ce qu'on a déjà, plutôt que d'insister.
      if (res.budgetExceeded) { stopped = res.error ?? "Budget IA atteint."; return false; }
      return true; // un échec de passe ne fait pas perdre les autres
    }
    let payload: unknown = res.data;
    if (payload === undefined) { try { payload = JSON.parse(res.text); } catch { payload = null; } }
    // Les pages sont numérotées DANS la passe : on les ramène à la numérotation du document.
    for (const ob of parseFigures(payload)) observations.push({ ...ob, page: ob.page + offset });
    for (const df of parseDefects(payload)) defects.push({ ...df, page: df.page + offset });
    return true;
  };

  try {
    if (input.ext === "pdf") {
      // EN FLUX : on n'accumule qu'une PASSE de pages (12), jamais le document entier — c'est ce
      // qui permet d'examiner un dossier de plusieurs milliers de pages sans exploser la mémoire.
      let pending: { buffer: Buffer; mime?: string }[] = [];
      let offset = 0;
      const { total } = await rasterizePdfStream(input.buffer, async (png) => {
        if (stopped) return;
        pending.push({ buffer: png, mime: "image/png" });
        pagesRead++;
        if (pending.length >= PAGES_PER_PASS) {
          const batch = pending;
          pending = [];
          const ok = await flush(batch, offset);
          offset += batch.length;
          if (!ok) stopped = stopped ?? "Analyse interrompue.";
        }
      }, { maxPages });
      if (!stopped && pending.length > 0) await flush(pending, offset);
      if (total === 0) return { observations, defects, pagesRead: 0, costUsd, ok: true };
    } else {
      pagesRead = 1;
      await flush([{ buffer: input.buffer, mime: `image/${input.ext === "jpg" ? "jpeg" : input.ext}` }], 0);
    }
  } catch (e) {
    console.error("[vision] rastérisation impossible", e);
    return { observations, defects, pagesRead, costUsd, ok: false, error: "Pages illisibles." };
  }

  if (stopped) return { observations, defects, pagesRead, costUsd, ok: false, error: stopped };
  return { observations, defects, pagesRead, costUsd, ok: true };
}
