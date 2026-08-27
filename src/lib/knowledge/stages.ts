import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyDocument, DOC_KIND_LABEL } from "@/platform/doc-kind";
import { lunaEmbed, callLuna, lunaConfigured, EMBED_DIMS } from "@/lib/openai-luna";
import { type KnowledgeMeta } from "./contract";
import { setStage } from "./ingest";
import { documentDateOf, detectLanguage, extractDates, extractAmounts } from "./facts";
import { linkEntitiesForItem } from "./entities/link";

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
 * ── CE QUI N'EST PAS ENCORE BRANCHÉ, ET POURQUOI C'EST ÉCRIT ─────────────────────────────
 *
 * La RASTÉRISATION (transformer la page N d'un PDF en image) n'existe pas dans cette couche. Le
 * pipeline CTD la possède, mais elle y est liée à son propre découpage en lots. La brancher
 * proprement est un lot à part entière ; l'appeler à moitié ici produirait des pages muettes que
 * l'on croirait lues. L'étage rend donc `false` — « rien à faire » — plutôt que d'échouer en
 * boucle et de remplir la boîte morte d'un problème qui n'en est pas un.
 */
export async function stageVision(itemId: string): Promise<boolean> {
  void itemId;
  return false;
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
