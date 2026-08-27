import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/drive-storage";
import { detectMime } from "@/lib/regulatory/intelligence/extract/mime";
import { heavyText, type HeavyKind } from "@/lib/regulatory/intelligence/extract/heavy-parse";
import { contentHash, clip, looksLikePlainText } from "../text";
import { chunkText, chunkUnits, renumber } from "../chunk";
import { decideRoute } from "../route";
import { parsePptx, pptxToText } from "../parsers/pptx";
import type { KnowledgeChunkDraft } from "../contract";
import type { IngestInput } from "../ingest";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DRIVE COMME SOURCE — l'adaptateur qui transforme un fichier en connaissance.
 *
 * ── CE QU'IL RÉUTILISE PLUTÔT QUE DE RÉÉCRIRE ────────────────────────────────────────────
 *
 * `detectMime` (détection par les OCTETS, pas par l'extension — un `.pdf` renommé ne trompe
 * personne) et `heavyText` (pdf/docx/xlsx analysés dans un PROCESSUS SÉPARÉ : un fichier
 * pathologique tue le worker, pas le serveur). Ces deux briques marchent et sont éprouvées ;
 * les refaire n'aurait ajouté qu'un second endroit où corriger le prochain bogue.
 *
 * ── CE QU'IL AJOUTE ──────────────────────────────────────────────────────────────────────
 *
 * Le PPTX, que `heavyText` ne connaît pas — et sans lequel toute présentation partait vers le
 * barreau le plus cher de l'échelle pour un texte que le code sait lire.
 *
 * ── OÙ VIT CE FICHIER, ET POURQUOI ───────────────────────────────────────────────────────
 *
 * Dans `knowledge/`, côté ERP. L'ingestion Drive vivait jusqu'ici dans `assistant/`, ce qui la
 * rendait indisponible à tout ce qui n'est pas Adam — un écran métier ne pouvait pas s'en
 * servir. La couche appartient à l'ERP ; Adam en est un consommateur parmi d'autres.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Au-delà, l'extraction planifiée ne se lance pas — même borne que la lecture à la volée. */
export const MAX_INGEST_BYTES = 8 * 1024 * 1024;

/** L'extension → la famille que `heavyText` sait traiter. */
function heavyKindOf(mime: string): HeavyKind | null {
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  return null;
}

/** Une extension seule ne prouve rien, mais elle départage les archives ZIP Office. */
function officeMimeOf(name: string): string | null {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xlsx" || ext === "xlsm") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "pptx" || ext === "pptm") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return null;
}

export interface DriveIngestDraft {
  input: IngestInput;
  /** Ce que la décision de routage a conclu — consigné pour l'observabilité (§26). */
  route: ReturnType<typeof decideRoute>;
}

/**
 * PRÉPARE L'INGESTION D'UN NŒUD DRIVE.
 *
 * Rend `null` quand il n'y a rien à faire (nœud absent, corbeille, trop gros, blob illisible) —
 * ce n'est pas une erreur, c'est une absence, et l'appelant n'a rien à corriger.
 */
export async function draftFromDriveNode(nodeId: string): Promise<DriveIngestDraft | null> {
  const node = await prisma.driveNode
    .findUnique({
      where: { id: nodeId },
      select: { id: true, name: true, type: true, isTrashed: true, size: true },
    })
    .catch(() => null);
  if (!node || node.type !== "FILE" || node.isTrashed) return null;
  if (node.size != null && node.size > MAX_INGEST_BYTES) return null;

  const version = await prisma.fileVersion
    .findFirst({ where: { nodeId }, orderBy: { version: "desc" }, select: { id: true, blobId: true } })
    .catch(() => null);
  if (!version?.blobId) return null;

  const buffer = await getBlob(version.blobId).catch(() => null);
  if (!buffer) return null;

  // La détection par les OCTETS d'abord ; l'extension ne sert qu'à départager les archives ZIP,
  // qui portent toutes la même signature (`PK..`).
  const guessed = detectMime(buffer, (node.name.split(".").pop() ?? "").toLowerCase());
  const mime = guessed.family === "zip-office" ? (officeMimeOf(node.name) ?? guessed.mime) : guessed.mime;

  let text = "";
  let chunks: KnowledgeChunkDraft[] = [];
  let parserFailed = false;
  let unreadablePages: string[] = [];

  if (mime.includes("presentationml")) {
    // LE FORMAT QUI MANQUAIT. Une diapositive est une unité de sens complète : on garde la
    // frontière que l'auteur a posée, ce qui rend « diapositive 7 » citable.
    const deck = await parsePptx(buffer);
    text = pptxToText(deck);
    chunks = chunkUnits(
      deck.slides.map((s) => ({
        label: s.title ? `Diapositive ${s.index} — ${s.title}` : `Diapositive ${s.index}`,
        locator: String(s.index),
        text: [s.text, s.notes ? `[Notes] ${s.notes}` : ""].filter(Boolean).join("\n"),
      })),
      "slide",
    );
    unreadablePages = deck.visualSlides;
    parserFailed = deck.slides.length === 0;
  } else {
    const kind = heavyKindOf(mime);
    if (kind) {
      text = await heavyText(kind, buffer).catch(() => "");
      parserFailed = !text;
    } else if (mime.startsWith("text/") || mime === "application/json") {
      text = buffer.toString("utf8");
    } else if (guessed.family === "unknown" && looksLikePlainText(buffer)) {
      // LE TEXTE BRUT N'A PAS DE SIGNATURE. Un `.txt`, un `.csv`, un `.md` ou un `.json` sort de
      // `detectMime` en `unknown`, et ne correspond à aucun `text/…`. Sans ce cas, il ne
      // produisait AUCUN texte — et le routage, voyant un document muet, l'envoyait à la vision.
      // Payer un modèle multimodal pour lire ce que `toString()` lit est exactement ce que la
      // doctrine interdit. Défaut trouvé en mesurant une ingestion réelle, pas en relisant le code.
      text = buffer.toString("utf8");
    }
    chunks = text ? chunkText(text) : [];
  }

  // LA DÉCISION DE ROUTAGE. Elle ne déclenche rien ici : elle DIT ce qu'il faudrait faire, et
  // c'est la file qui s'en charge — l'utilisateur ne doit pas attendre une vision.
  const route = decideRoute({ mime, nativeText: text, parserFailed, unreadablePages });

  return {
    route,
    input: {
      sourceType: "drive_file",
      sourceId: nodeId,
      // L'empreinte porte sur le CONTENU : renommer ou déplacer le fichier ne relance rien.
      contentHash: contentHash(buffer),
      title: node.name,
      // PAS DE `companyId` ICI, et c'est volontaire : un nœud Drive n'en porte pas. Le
      // cloisonnement d'un fichier se lit par son ESPACE et ses partages, nœud par nœud — c'est
      // la garde de lecture qui l'applique (`AccessFilter`). Recopier ici une entité devinée
      // créerait une seconde vérité d'accès, qui finirait par diverger de la vraie.
      text: text ? clip(text, 40_000) : null,
      chunks: renumber(chunks),
      extractedBy: route.use === "native" ? "native" : route.use,
      confidence: route.use === "native" ? 1 : 0.5,
      meta: { documentType: null },
      // CE QUI PART EN FOND. La vision n'est demandée que si le routage l'a JUSTIFIÉE — sinon
      // on paierait un modèle pour un texte déjà lisible.
      deepJobs: [
        "classify",
        "entities",
        ...(text ? (["embed"] as const) : []),
        ...(route.use === "luna" ? (["vision"] as const) : []),
      ],
    },
  };
}
