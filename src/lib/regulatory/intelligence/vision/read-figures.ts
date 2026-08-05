import type { LunaCallInput } from "@/lib/openai-luna";
import { trackedLuna } from "@/lib/regulatory/intelligence/cost/ledger";
import { rasterizePdf } from "@/lib/regulatory/intelligence/ocr/ocr-engine";

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

export interface FigureReport {
  observations: FigureObservation[];
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
  required: ["observations"],
  properties: {
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
      `Décris les figures présentes. S'il n'y en a aucune, renvoie une liste vide.`,
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
  const maxPages = Math.min(Math.max(input.maxPages ?? 24, 1), 60);
  let images: { buffer: Buffer; mime: string }[] = [];

  try {
    if (input.ext === "pdf") {
      const raster = await rasterizePdf(input.buffer, maxPages);
      images = raster.pages.map((p) => ({ buffer: p, mime: "image/png" }));
    } else {
      images = [{ buffer: input.buffer, mime: `image/${input.ext === "jpg" ? "jpeg" : input.ext}` }];
    }
  } catch (e) {
    console.error("[vision] rastérisation impossible", e);
    return { observations: [], pagesRead: 0, costUsd: 0, ok: false, error: "Pages illisibles." };
  }
  if (images.length === 0) return { observations: [], pagesRead: 0, costUsd: 0, ok: true };

  const observations: FigureObservation[] = [];
  let costUsd = 0;

  // Par passes : un document de 200 pages ne part pas en un seul appel.
  for (let start = 0; start < images.length; start += PAGES_PER_PASS) {
    const slice = images.slice(start, start + PAGES_PER_PASS);
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
      if (res.budgetExceeded) return { observations, pagesRead: start, costUsd, ok: false, error: res.error };
      continue; // un échec de passe ne fait pas perdre les autres
    }
    let parsed: FigureObservation[] = [];
    try { parsed = parseFigures(res.data ?? JSON.parse(res.text)); } catch { parsed = []; }
    // Les pages sont numérotées dans la passe : on les ramène à la numérotation du document.
    for (const ob of parsed) observations.push({ ...ob, page: ob.page + start });
  }

  return { observations, pagesRead: images.length, costUsd, ok: true };
}
