import { prisma } from "@/lib/prisma";
import type { KnowledgeMeta, KnowledgeSourceType, RelationPredicate } from "./contract";
import { fold } from "./text";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE RETRIEVAL — la seule porte, et elle est gardée.
 *
 * ── CE QUE CETTE COUCHE PROMET À SES APPELANTS ───────────────────────────────────────────
 *
 * Ni Adam, ni un écran métier n'ont à connaître le hachage, les versions, les morceaux, les
 * vecteurs ou la file. Ils posent une question ; ils reçoivent des extraits CITABLES, avec leur
 * provenance. Toute la complexité reste de ce côté-ci.
 *
 * ── LA GARDE, ET POURQUOI ELLE EST À LA LECTURE ──────────────────────────────────────────
 *
 * L'ingestion stocke SANS lire les droits ; c'est la RECHERCHE qui les revérifie. Ce n'est pas
 * un raccourci, c'est le même choix que l'index Drive existant, et il est plus sûr : les droits
 * changent (une personne quitte un service, un document devient confidentiel) alors qu'un index
 * figé au moment du dépôt garderait éternellement la permission d'hier.
 *
 * La conséquence est une règle stricte : **aucune fonction de ce fichier ne rend un extrait sans
 * avoir passé le filtre**. Le filtre est INJECTÉ (`canSee`) parce que les règles d'accès
 * appartiennent à chaque domaine — le Drive sait qui voit un nœud, Regulatory sait qui voit un
 * dossier. Les recopier ici en ferait une seconde vérité, qui divergerait.
 *
 * ── CE QUE CETTE COUCHE NE FAIT PAS ENCORE ───────────────────────────────────────────────
 *
 * pgvector n'est pas disponible sur cette infrastructure (vérifié, pas supposé) : la recherche
 * par le SENS reste celle du produit — vecteurs en JSONB, cosinus en mémoire — et n'est pas
 * rebranchée ici. La recherche hybride ci-dessous combine donc l'EXACT, le LEXICAL et les
 * MÉTADONNÉES ; l'étage sémantique a sa place réservée et son point d'entrée, rien de plus.
 * Prétendre le contraire donnerait un rappel supérieur sur le papier et identique en vrai.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** La question posée. Tout est optionnel sauf le texte — le reste RESSERRE. */
export interface SearchQuery {
  text?: string;
  sourceTypes?: KnowledgeSourceType[];
  docType?: string;
  companyId?: string | null;
  /** Situer dans le temps (§16). Absent = la situation ACTUELLE. */
  asOf?: Date;
  /** Les versions closes sont exclues par défaut : on cherche ce qui vaut aujourd'hui. */
  includeSuperseded?: boolean;
  limit?: number;
}

export interface SearchHit {
  itemId: string;
  sourceType: KnowledgeSourceType;
  sourceId: string;
  title: string | null;
  docType: string | null;
  /** L'extrait le plus pertinent, avec de quoi le CITER. */
  snippet: string;
  locator: string | null;
  label: string | null;
  documentDate: Date | null;
  version: number;
  /** Ce qui a fait remonter ce résultat — l'utilisateur a le droit de le savoir. */
  matchedBy: "exact" | "lexical" | "metadata";
  score: number;
}

/**
 * LE FILTRE D'ACCÈS. Injecté par l'appelant, qui connaît SES règles.
 *
 * Rend la liste des identifiants d'éléments que ce compte peut voir. Un filtre absent est traité
 * comme « personne ne voit rien » — refuser par défaut est la seule position tenable quand la
 * question est « a-t-il le droit ? ».
 */
export type AccessFilter = (items: { itemId: string; sourceType: string; sourceId: string }[]) => Promise<Set<string>>;

const DEFAULT_LIMIT = 20;
/** On récupère large avant de filtrer : sinon un compte peu autorisé rendrait une page vide. */
const OVERFETCH = 4;

/**
 * RECHERCHE HYBRIDE — exact, puis lexical, puis métadonnées.
 *
 * L'ordre EST le classement. Une référence exacte (« REG-2026-041 ») bat toujours une
 * correspondance lexicale : quand quelqu'un tape une référence, il ne cherche pas « des
 * documents qui en parlent », il cherche CELUI-LÀ.
 */
export async function search(q: SearchQuery, canSee: AccessFilter): Promise<SearchHit[]> {
  const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIMIT, 1), 100);
  const needle = (q.text ?? "").trim();

  const where = {
    ...(q.sourceTypes?.length ? { sourceType: { in: q.sourceTypes } } : {}),
    ...(q.docType ? { docType: q.docType } : {}),
    ...(q.companyId !== undefined ? { companyId: q.companyId } : {}),
    ...temporalWhere(q),
  };

  // ── EXACT. La référence telle qu'elle est écrite dans le document.
  const exact = needle
    ? await prisma.knowledgeItem.findMany({
        where: { ...where, OR: [{ title: { contains: needle, mode: "insensitive" as const } }, { sourceId: needle }] },
        take: limit * OVERFETCH,
        orderBy: { documentDate: "desc" },
        select: SELECT_ITEM,
      })
    : [];

  // ── LEXICAL. Sur la colonne REPLIÉE, servie par l'index trigramme.
  const folded = fold(needle);
  const lexical = needle
    ? await prisma.knowledgeChunk.findMany({
        where: { textFold: { contains: folded }, item: where },
        take: limit * OVERFETCH,
        orderBy: { item: { documentDate: "desc" } },
        select: { ord: true, label: true, locator: true, text: true, item: { select: SELECT_ITEM } },
      })
    : [];

  // ── MÉTADONNÉES SEULES. Sans texte, la question porte sur un TYPE ou une période.
  const byMeta = !needle
    ? await prisma.knowledgeItem.findMany({ where, take: limit * OVERFETCH, orderBy: { documentDate: "desc" }, select: SELECT_ITEM })
    : [];

  const hits = new Map<string, SearchHit>();
  const add = (h: SearchHit) => {
    const prev = hits.get(h.itemId);
    // Un même document trouvé deux fois garde sa MEILLEURE justification, pas la dernière.
    if (!prev || h.score > prev.score) hits.set(h.itemId, h);
  };

  for (const it of exact) add(hitOf(it, { matchedBy: "exact", score: 1, snippet: it.text?.slice(0, 300) ?? "" }));
  for (const c of lexical) {
    add(hitOf(c.item, {
      matchedBy: "lexical",
      score: 0.6,
      snippet: excerpt(c.text, folded),
      locator: c.locator,
      label: c.label,
    }));
  }
  for (const it of byMeta) add(hitOf(it, { matchedBy: "metadata", score: 0.3, snippet: it.text?.slice(0, 300) ?? "" }));

  const all = [...hits.values()].sort((a, b) => b.score - a.score || (b.documentDate?.getTime() ?? 0) - (a.documentDate?.getTime() ?? 0));

  // ── LA GARDE. Rien ne sort d'ici sans être passé par elle.
  const allowed = await canSee(all.map((h) => ({ itemId: h.itemId, sourceType: h.sourceType, sourceId: h.sourceId })));
  return all.filter((h) => allowed.has(h.itemId)).slice(0, limit);
}

const SELECT_ITEM = {
  id: true, sourceType: true, sourceId: true, title: true, docType: true,
  text: true, documentDate: true, version: true,
} as const;

type ItemRow = { id: string; sourceType: string; sourceId: string; title: string | null; docType: string | null; text: string | null; documentDate: Date | null; version: number };

function hitOf(it: ItemRow, over: Partial<SearchHit> & Pick<SearchHit, "matchedBy" | "score" | "snippet">): SearchHit {
  return {
    itemId: it.id,
    sourceType: it.sourceType as KnowledgeSourceType,
    sourceId: it.sourceId,
    title: it.title,
    docType: it.docType,
    documentDate: it.documentDate,
    version: it.version,
    locator: null,
    label: null,
    ...over,
  };
}

/**
 * LA FENÊTRE TEMPORELLE. Sans `asOf`, on ne rend que ce qui vaut AUJOURD'HUI : une réponse qui
 * mélangerait la V1 et la V3 d'un contrat serait pire qu'une absence de réponse.
 */
function temporalWhere(q: SearchQuery): Record<string, unknown> {
  if (q.asOf) {
    return { validFrom: { lte: q.asOf }, OR: [{ validTo: null }, { validTo: { gt: q.asOf } }] };
  }
  return q.includeSuperseded ? {} : { isCurrent: true };
}

/**
 * L'EXTRAIT AUTOUR DU TERME TROUVÉ. Rendre les 300 premiers caractères d'un document de 40 000
 * quand le terme est page 12 donne un extrait qui ne contient pas ce qu'on cherchait — et laisse
 * croire que le résultat est mauvais alors que c'est l'affichage qui l'est.
 */
export function excerpt(text: string, foldedNeedle: string, radius = 140): string {
  if (!foldedNeedle) return text.slice(0, radius * 2);
  const at = fold(text).indexOf(foldedNeedle);
  if (at < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + foldedNeedle.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** UN DOCUMENT, entier — après la garde, toujours. */
export async function getDocument(itemId: string, canSee: AccessFilter) {
  const item = await prisma.knowledgeItem.findUnique({
    where: { id: itemId },
    select: { ...SELECT_ITEM, meta: true, language: true, confidence: true, extractedBy: true, model: true, stage: true, validFrom: true, validTo: true, isCurrent: true },
  });
  if (!item) return null;
  const allowed = await canSee([{ itemId: item.id, sourceType: item.sourceType, sourceId: item.sourceId }]);
  if (!allowed.has(item.id)) return null;

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { itemId },
    orderBy: { ord: "asc" },
    select: { kind: true, ord: true, label: true, locator: true, text: true },
  });
  return { ...item, meta: (item.meta ?? null) as KnowledgeMeta | null, chunks };
}

/**
 * CE QUI EST RELIÉ — la question inverse du graphe : « qu'est-ce qui parle de CE produit ? ».
 *
 * C'est l'arête qui porte la réponse, donc la garde s'applique aux ÉLÉMENTS trouvés, pas à
 * l'entité de départ : savoir qu'un produit existe n'autorise pas à lire les contrats qui le
 * citent.
 */
export async function getRelated(
  target: { toType: string; toId: string },
  canSee: AccessFilter,
  opts: { predicates?: RelationPredicate[]; limit?: number } = {},
) {
  const links = await prisma.knowledgeLink.findMany({
    where: {
      toType: target.toType,
      toId: target.toId,
      ...(opts.predicates?.length ? { predicate: { in: opts.predicates } } : {}),
      item: { isCurrent: true },
    },
    take: Math.min(opts.limit ?? 40, 200),
    orderBy: { confidence: "desc" },
    select: { predicate: true, confidence: true, mention: true, item: { select: SELECT_ITEM } },
  });

  const allowed = await canSee(links.map((l) => ({ itemId: l.item.id, sourceType: l.item.sourceType, sourceId: l.item.sourceId })));
  return links
    .filter((l) => allowed.has(l.item.id))
    .map((l) => ({
      predicate: l.predicate as RelationPredicate,
      confidence: l.confidence,
      mention: l.mention,
      itemId: l.item.id,
      sourceType: l.item.sourceType as KnowledgeSourceType,
      sourceId: l.item.sourceId,
      title: l.item.title,
    }));
}

/**
 * L'HISTOIRE D'UNE SOURCE — V1 → V2 → V3 (§16).
 *
 * C'est ce qui distingue « quelle est la situation ? » de « quelle était-elle en mars ? ».
 * Les versions closes portent leur fenêtre de validité : on peut donc dater une affirmation
 * au lieu de la présenter comme intemporelle.
 */
export async function getHistory(sourceType: KnowledgeSourceType, sourceId: string, canSee: AccessFilter) {
  const rows = await prisma.knowledgeItem.findMany({
    // Une version close est archivée sous `sourceId#vN` — le préfixe les rassemble toutes.
    where: { sourceType, OR: [{ sourceId }, { sourceId: { startsWith: `${sourceId}#v` } }] },
    orderBy: { version: "asc" },
    select: { ...SELECT_ITEM, validFrom: true, validTo: true, isCurrent: true, contentHash: true },
  });
  if (!rows.length) return [];
  const allowed = await canSee(rows.map((r) => ({ itemId: r.id, sourceType: r.sourceType, sourceId: r.sourceId })));
  return rows.filter((r) => allowed.has(r.id));
}

/** L'ÉTAT ACTUEL d'une source — le raccourci de `getHistory` quand seule la V courante compte. */
export async function getCurrentState(sourceType: KnowledgeSourceType, sourceId: string, canSee: AccessFilter) {
  const item = await prisma.knowledgeItem.findUnique({
    where: { sourceType_sourceId: { sourceType, sourceId } },
    select: { id: true },
  });
  return item ? getDocument(item.id, canSee) : null;
}
