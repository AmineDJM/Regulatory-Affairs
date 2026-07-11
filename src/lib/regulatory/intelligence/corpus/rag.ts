import { prisma } from "@/lib/prisma";

/**
 * RAG RÉGLEMENTAIRE (G4) — recherche dans le corpus **actif** via Postgres FTS `french`
 * (+ repli trigram `pg_trgm` si aucun résultat lexical). Retourne des **citations exactes**
 * (source, version, article/section, extrait). pgvector indisponible ici → pas d'embeddings ;
 * ce socle reste prêt pour un provider d'embeddings ultérieur.
 *
 * Règle : si aucune source active ne justifie une conclusion → l'appelant affiche
 * « EXIGENCE NON CONFIRMÉE — REVUE HUMAINE REQUISE » (jamais d'invention).
 */

export interface Citation {
  sectionId: string;
  sourceId: string;
  sourceVersionId: string;
  authority: string;
  jurisdiction: string;
  code: string;
  title: string;
  version: string;
  path: string;
  heading: string | null;
  snippet: string;
  rank: number;
}

interface Row {
  sectionId: string; sourceId: string; sourceVersionId: string; authority: string; jurisdiction: string;
  code: string; title: string; version: string; path: string; heading: string | null; snippet: string; rank: number;
}

export interface CorpusFilters {
  jurisdiction?: string;
  authority?: string;
  limit?: number;
}

export async function searchCorpus(query: string, filters: CorpusFilters = {}): Promise<Citation[]> {
  const q = (query ?? "").trim();
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(filters.limit ?? 8, 1), 30);

  const conds: string[] = [`sv."status" = 'ACTIVE'`];
  const params: unknown[] = [q];
  let p = 2;
  if (filters.jurisdiction) { conds.push(`src."jurisdiction" = $${p++}`); params.push(filters.jurisdiction); }
  if (filters.authority) { conds.push(`src."authority" = $${p++}`); params.push(filters.authority); }
  const limIdx = p;
  params.push(limit);

  const base = `
    FROM "RegulatorySourceSection" sec
    JOIN "RegulatorySourceVersion" sv ON sv."id" = sec."sourceVersionId"
    JOIN "RegulatorySource" src ON src."id" = sv."sourceId"
    WHERE ${conds.join(" AND ")}`;

  // 1) Recherche lexicale FTS (français).
  const ftsSql = `
    SELECT sec."id" AS "sectionId", src."id" AS "sourceId", sv."id" AS "sourceVersionId",
      src."authority", src."jurisdiction", src."code", src."title", sv."version",
      sec."path", sec."heading",
      ts_headline('french', sec."text", plainto_tsquery('french', $1), 'MaxWords=42, MinWords=16, ShortWord=2') AS snippet,
      ts_rank(sec."search_vector", plainto_tsquery('french', $1)) AS rank
    ${base} AND sec."search_vector" @@ plainto_tsquery('french', $1)
    ORDER BY rank DESC LIMIT $${limIdx}`;

  let rows: Row[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<Row[]>(ftsSql, ...params);
  } catch {
    rows = [];
  }

  // 2) Repli trigram si le lexical ne rend rien (fautes / variantes).
  if (rows.length === 0) {
    const trgmSql = `
      SELECT sec."id" AS "sectionId", src."id" AS "sourceId", sv."id" AS "sourceVersionId",
        src."authority", src."jurisdiction", src."code", src."title", sv."version",
        sec."path", sec."heading",
        left(sec."text", 240) AS snippet,
        similarity(sec."text", $1) AS rank
      ${base} AND sec."text" % $1
      ORDER BY rank DESC LIMIT $${limIdx}`;
    try {
      rows = await prisma.$queryRawUnsafe<Row[]>(trgmSql, ...params);
    } catch {
      rows = [];
    }
  }

  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

/** Nombre de sections indexées dans le corpus ACTIF (diagnostic UI). */
export async function activeCorpusSize(): Promise<number> {
  try {
    return await prisma.regulatorySourceSection.count({ where: { sourceVersion: { status: "ACTIVE" } } });
  } catch {
    return 0;
  }
}
