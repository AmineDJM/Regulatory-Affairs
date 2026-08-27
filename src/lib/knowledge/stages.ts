import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyDocument, DOC_KIND_LABEL } from "@/platform/doc-kind";
import { lunaEmbed, callLuna, lunaConfigured, EMBED_DIMS } from "@/lib/openai-luna";
import { type KnowledgeMeta } from "./contract";
import { setStage } from "./ingest";
import { documentDateOf, detectLanguage, extractDates, extractAmounts } from "./facts";
import { fold } from "./text";
import { linkEntitiesForItem } from "./entities/link";
import { decideRoute } from "./route";
import { driveBytes } from "./sources/drive";
import { rasterizePages } from "@/lib/storage/raster";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES ÉTAGES D'ENRICHISSEMENT — ce qui se passe APRÈS que la donnée est déjà retrouvable.
 *
 * ── L'ORDRE EST L'ORDRE DU COÛT, ET IL N'EST PAS NÉGOCIABLE ──────────────────────────────
 *
 *   `classify` → du CODE. Nature du document, dates, langue, montants. Zéro appel, zéro dinar.
 *   `entities` → du CODE + un INDEX. Reconnaissance de forme puis lecture d'alias.
 *   `embed`    → Luna, mais seulement l'ENCODEUR — le barreau le moins cher qui existe.
 *   `vision`   → Luna, et UNIQUEMENT sur les pages que le parsing natif a échoué à lire.
 *   `enrich`   → Luna, et seulement quand le document est assez long pour qu'un résumé serve.
 *
 * Aucun étage ne monte d'un barreau sans qu'un FAIT l'ait justifié. C'est §2 appliqué : le code
 * d'abord, le modèle quand le code a démontré qu'il ne suffisait pas.
 *
 * ── CE QUE « ÉCHOUER » VEUT DIRE ICI ─────────────────────────────────────────────────────
 *
 * Rien de visible. Chaque étage rend `true` s'il a travaillé, `false` s'il n'y avait rien à
 * faire, et LÈVE seulement quand un réessai a du sens (service indisponible). Le document reste
 * trouvable par son texte tout du long : c'est la promesse de l'ingestion rapide, et aucun étage
 * n'a le droit de la reprendre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────── classify ───────────────────────────────────

/**
 * LA NATURE DU DOCUMENT ET SES FAITS DE SURFACE — par le code seul.
 *
 * Le classifieur vit dans `platform/`, partagé avec Adam : l'écran Drive et l'assistant doivent
 * dire la MÊME chose du même fichier, et deux implémentations divergent toujours.
 */
export async function stageClassify(itemId: string): Promise<boolean> {
  const item = await prisma.knowledgeItem.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, text: true, meta: true, documentDate: true, docType: true, language: true },
  });
  if (!item?.text) return false;

  const kind = classifyDocument(item.title ?? "", item.text);
  const dates = extractDates(item.text);
  const amounts = extractAmounts(item.text);
  const language = detectLanguage(item.text);
  const docDate = documentDateOf(item.text);

  const meta: KnowledgeMeta = {
    ...((item.meta as KnowledgeMeta | null) ?? {}),
    // On enregistre le LIBELLÉ, pas le code : c'est lui qui s'affiche, et un code orphelin dans
    // un JSON devient illisible le jour où l'énuméré change.
    documentType: kind === "unknown" ? null : DOC_KIND_LABEL[kind],
    ...(dates.length ? { dates } : {}),
  };

  await prisma.knowledgeItem.update({
    where: { id: item.id },
    data: {
      docType: kind === "unknown" ? item.docType : kind,
      // Une date déjà connue (celle d'une fiche ERP) fait autorité sur celle qu'on lit dans un
      // texte : on ne remplace que le vide.
      documentDate: item.documentDate ?? docDate,
      language: item.language ?? language,
      meta: { ...meta, ...(amounts.length ? { tags: amountTags(amounts) } : {}) } as object,
    },
  });

  await setStage(item.id, "CLASSIFIED");
  return true;
}

/** Les montants deviennent des étiquettes lisibles — un JSON de nombres ne se cherche pas. */
function amountTags(amounts: ReturnType<typeof extractAmounts>): string[] {
  return amounts.slice(0, 5).map((a) => (a.currency ? `${a.value} ${a.currency}` : String(a.value)));
}

// ─────────────────────────────────── entities ───────────────────────────────────

/**
 * LES RELATIONS. Tout le travail vit dans `entities/link.ts` ; cet étage ne fait que le déclencher
 * et faire avancer l'étape — c'est ici que l'élément devient `READY`, c'est-à-dire « recherchable
 * ET relié », la seule promesse sur laquelle un écran a le droit de compter.
 */
export async function stageEntities(itemId: string): Promise<boolean> {
  const r = await linkEntitiesForItem(itemId);
  // `READY` même sans aucun lien écrit : un document qui ne cite aucune entité connue est
  // complètement traité, pas en panne. Le retenir en `CLASSIFIED` le ferait passer pour bloqué.
  await setStage(itemId, "READY");
  if (r.written) {
    console.info("[knowledge] linked", { itemId, ...r });
  }
  return r.mentions > 0;
}

// ──────────────────────────────────── embed ────────────────────────────────────

/** Combien de morceaux on encode par passage. Un lot large coûte moins d'allers-retours. */
const EMBED_BATCH = 32;

/**
 * LES VECTEURS — le barreau le moins cher de l'échelle des modèles.
 *
 * pgvector n'existe pas sur cette infrastructure (vérifié, pas supposé) : les vecteurs vivent en
 * JSONB et le cosinus se calcule en mémoire, exactement comme le corpus CTD et l'index Drive. Le
 * jour où l'extension sera là, seule la colonne et la requête de rapprochement changeront.
 *
 * Sans clé OpenAI, cet étage rend `false` et la recherche reste lexicale : dégradée, pas cassée.
 */
export async function stageEmbed(itemId: string): Promise<boolean> {
  if (!lunaConfigured()) return false;

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { itemId, embedding: { equals: Prisma.DbNull } },
    orderBy: { ord: "asc" },
    take: EMBED_BATCH,
    select: { id: true, text: true },
  });
  if (!chunks.length) return false;

  const vectors = await lunaEmbed(chunks.map((c) => c.text), EMBED_DIMS);
  // `null` = service indisponible ou refus. On LÈVE, pour que la file réessaie avec son attente
  // croissante : c'est exactement le cas où un réessai a un sens.
  if (!vectors) throw new Error("embeddings indisponibles");

  await Promise.all(
    chunks.map((c, i) =>
      vectors[i]
        ? prisma.knowledgeChunk.update({ where: { id: c.id }, data: { embedding: vectors[i] } }).catch(() => undefined)
        : Promise.resolve(undefined),
    ),
  );

  // S'il reste des morceaux à encoder, l'étage se redemande lui-même : un document de 300 pages
  // n'immobilise pas un passage entier de la file.
  const remaining = await prisma.knowledgeChunk.count({ where: { itemId, embedding: { equals: Prisma.DbNull } } });
  if (remaining > 0) {
    const { enqueue } = await import("./queue");
    await enqueue({ kind: "embed", itemId, dedupeKey: `embed:${itemId}:${remaining}` });
  }
  return true;
}

// ──────────────────────────────────── vision ────────────────────────────────────

/**
 * LES PAGES QUE LE CODE N'A PAS SU LIRE.
 *
 * Cet étage ne s'exécute QUE si le routage l'a justifié par un fait constaté (`no_text_layer`,
 * `ocr_unreliable`, `image_source`…). Il ne relit jamais un document dont le texte est déjà bon —
 * ce serait payer un modèle pour confirmer ce que le parseur a déjà dit.
 *
 * ── CE QUI EST ENVOYÉ, ET CE QUI NE L'EST PAS ────────────────────────────────────────────
 *
 * Une IMAGE part telle quelle : il n'y a rien à découper. Un PDF ne part JAMAIS en entier — on
 * rastérise les pages que `decideRoute` a désignées, et elles seules. C'est la règle §8, et
 * c'est là que se joue le coût : un dossier de 150 pages dont 3 sont illisibles doit coûter 3
 * pages, pas 150.
 *
 * ── CE QUI SE PASSE DU TEXTE DÉJÀ LU ─────────────────────────────────────────────────────
 *
 * Le texte natif n'est jamais écrasé : la lecture visuelle s'AJOUTE, préfixée par son rang de
 * page. Un document partiellement lisible garde donc ce que le parseur avait compris — et l'on
 * peut toujours distinguer ce qui vient du fichier de ce qui vient d'un modèle, ce que
 * `extractedBy` enregistre.
 */
const VISION_SCHEMA = {
  name: "lecture_page",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["pages", "confiance"],
    properties: {
      pages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["page", "texte"],
          properties: {
            page: { type: "number", description: "Le rang de la page, tel qu'il a été fourni." },
            texte: { type: "string", description: "Le texte LU sur l'image, sans rien ajouter." },
          },
        },
      },
      confiance: {
        type: "number",
        description: "0 à 1 — à quel point la lecture est sûre. Une page floue vaut moins de 0,5.",
      },
    },
  },
} as const;

const VISION_SYSTEM =
  "Tu TRANSCRIS ce que tu vois sur des pages de documents administratifs et réglementaires. "
  + "Tu ne résumes pas, tu ne complètes pas, tu n'interprètes pas : tu rends le texte tel qu'il "
  + "est écrit, y compris les en-têtes, les références et les tableaux (en lignes lisibles). "
  + "Si une page est illisible, rends une chaîne vide pour cette page plutôt que d'inventer. "
  + "Ce qui est transcrit sera cité comme un fait de l'entreprise : une invention devient un "
  + "mensonge opposable.";

/** Au-delà, ce n'est plus un rattrapage de pages : c'est une analyse, et elle a son propre lot. */
const VISION_MAX_PAGES = 8;

export async function stageVision(itemId: string): Promise<boolean> {
  if (!lunaConfigured()) return false;

  const item = await prisma.knowledgeItem.findUnique({
    where: { id: itemId },
    select: { id: true, sourceType: true, sourceId: true, text: true, meta: true },
  });
  if (!item) return false;
  // Seul le Drive porte des octets relisibles. Un courriel ou une tâche n'a pas de page à
  // regarder — et prétendre le contraire ferait tourner cet étage pour rien à chaque passage.
  if (item.sourceType !== "drive_file" && item.sourceType !== "attachment") return false;

  const src = await driveBytes(item.sourceId);
  if (!src) return false;

  // On REDÉCIDE ici plutôt que de relire une décision prise à l'ingestion : entre les deux, le
  // texte a pu être réparé par un autre étage. Redécider rend l'étage idempotent et évite de
  // payer une lecture visuelle pour un document devenu lisible entre-temps.
  const route = decideRoute({
    mime: src.mime,
    nativeText: item.text ?? "",
    structured: false,
  });
  if (route.use !== "luna") return false;

  const isImage = src.mime.startsWith("image/");
  const images: { buffer: Buffer; mime?: string }[] = [];
  const rangs: number[] = [];

  if (isImage) {
    images.push({ buffer: src.buffer, mime: src.mime });
    rangs.push(1);
  } else {
    // `route.pages` porte des ÉTIQUETTES (« 4 », « 12 »), pas des nombres : c'est ce qui permet
    // de désigner une diapositive ou une feuille. Ici on ne sait rastériser que des rangs, donc
    // on convertit et on écarte ce qui n'en est pas un — plutôt que de rendre la page 0.
    const rangsVoulus = route.pages
      .map((p) => Number.parseInt(String(p), 10))
      .filter((n) => Number.isFinite(n) && n >= 1);
    const pages = (rangsVoulus.length ? rangsVoulus : [1]).slice(0, VISION_MAX_PAGES);
    const rendered = await rasterizePages(src.buffer, pages, { cap: VISION_MAX_PAGES });
    for (const r of rendered) { images.push({ buffer: r.png, mime: "image/png" }); rangs.push(r.page); }
  }
  // Rien à regarder — un PDF vide ou une rastérisation entièrement en échec. On ne relance pas :
  // ce n'est pas une panne, c'est un document dont on ne peut rien tirer.
  if (images.length === 0) return false;

  const reply = await callLuna<{ pages?: { page?: number; texte?: string }[]; confiance?: number }>({
    system: VISION_SYSTEM,
    user:
      `${images.length} page(s) fournie(s), dans l'ordre des rangs ${rangs.join(", ")}.\n`
      + `Document : « ${src.name} ».\n`
      + "Rends le texte de chaque page.",
    images,
    jsonSchema: VISION_SCHEMA,
    maxOutputTokens: 8000,
  });
  if (!reply.ok || !reply.data) return false;

  const lues = (reply.data.pages ?? [])
    .map((p, i) => ({ page: Number(p?.page) || rangs[i] || i + 1, texte: (p?.texte ?? "").trim() }))
    .filter((p) => p.texte.length > 0)
    .sort((a, b) => a.page - b.page);
  if (lues.length === 0) return false;

  const ajout = lues.map((p) => `[page ${p.page}]\n${p.texte}`).join("\n\n");
  const base = (item.text ?? "").trim();
  const fusion = base ? `${base}\n\n${ajout}` : ajout;

  const confiance = typeof reply.data.confiance === "number" ? reply.data.confiance : null;

  await prisma.knowledgeItem.update({
    where: { id: itemId },
    data: {
      text: fusion,
      textFold: fold(fusion),
      // `extractedBy` dit D'OÙ vient le texte. Sans lui, on ne saurait plus distinguer ce que le
      // fichier contenait de ce qu'un modèle a cru y lire — et §23 exige de pouvoir répondre
      // « d'où vient cette information ? ».
      extractedBy: base ? "hybride" : "luna_vision",
      ...(confiance !== null ? { confidence: confiance } : {}),
    },
  });
  return true;
}

// ──────────────────────────────────── enrich ────────────────────────────────────

/**
 * SOUS CETTE LONGUEUR, UN RÉSUMÉ N'APPREND RIEN. Un document de 600 caractères se lit plus vite
 * que son résumé ne se génère — l'appeler serait dépenser pour dégrader.
 */
export const SUMMARY_MIN_CHARS = 1200;

/** Ce qu'on donne à lire au modèle. Au-delà, on paie des jetons pour du remplissage. */
const SUMMARY_INPUT_CAP = 12_000;

const SUMMARY_SCHEMA = {
  name: "resume_document",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["resume", "points"],
    properties: {
      resume: { type: "string", description: "Deux phrases maximum, en français, factuelles." },
      points: {
        type: "array", maxItems: 5,
        items: { type: "string" },
        description: "Faits saillants tirés du document, sans interprétation.",
      },
    },
  },
} as const;

/**
 * LE RÉSUMÉ ET LES FAITS SAILLANTS — le seul étage qui fait vraiment PARLER un modèle.
 *
 * Luna, jamais Terra : résumer un document est du travail de sous-tâche, pas d'orchestration. La
 * consigne du modèle interdit explicitement d'ajouter ce qui n'est pas écrit — un résumé qui
 * complète est un résumé qui invente, et il finirait cité comme un fait de l'entreprise.
 */
export async function stageEnrich(itemId: string): Promise<boolean> {
  if (!lunaConfigured()) return false;

  const item = await prisma.knowledgeItem.findUnique({
    where: { id: itemId },
    select: { id: true, title: true, text: true, meta: true },
  });
  if (!item?.text || item.text.length < SUMMARY_MIN_CHARS) return false;

  const meta = (item.meta as (KnowledgeMeta & { summary?: string; highlights?: string[] }) | null) ?? {};
  if (meta.summary) return false; // déjà fait — un enrichissement ne se refait pas pour rien

  const res = await callLuna<{ resume: string; points: string[] }>({
    system:
      "Tu résumes un document d'entreprise. Tu n'écris QUE ce qui figure dans le texte fourni. " +
      "Si une information manque, tu ne la déduis pas et tu ne la mentionnes pas. Réponds en français.",
    user: `Titre : ${item.title ?? "(sans titre)"}\n\n${item.text.slice(0, SUMMARY_INPUT_CAP)}`,
    jsonSchema: SUMMARY_SCHEMA as unknown as { name: string; schema: Record<string, unknown> },
    maxOutputTokens: 600,
  });

  // Non configuré ou refus : ce n'est pas un échec à réessayer indéfiniment.
  if (!res.ok || !res.data?.resume) return false;

  await prisma.knowledgeItem.update({
    where: { id: item.id },
    data: {
      meta: {
        ...meta,
        summary: res.data.resume.slice(0, 1200),
        highlights: (res.data.points ?? []).slice(0, 5).map((p) => String(p).slice(0, 300)),
      } as object,
      model: "gpt-5.6-luna",
    },
  });
  await setStage(item.id, "ENRICHED");
  return true;
}
