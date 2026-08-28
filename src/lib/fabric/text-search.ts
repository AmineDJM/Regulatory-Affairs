/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * INFORMATION FABRIC — LA RECHERCHE DE CONTENU, INDEXÉE ET CLASSÉE (tranche F2).
 *
 * ── CE QUE CE MODULE REMPLACE, ET CE QU'IL NE REMPLACE PAS ──────────────────────────────
 *
 * Il remplace le GOULOT : `textFold: { contains: t }` répété par chaque appelant — un LIKE
 * '%…%' sans index, donc un scan séquentiel du corpus entier, le seul endroit du système où la
 * latence croissait linéairement avec le nombre de documents.
 *
 * Il ne remplace PAS la politique des appelants : `find_documents` garde son entonnoir, ses
 * confiances, sa revérification d'ACL nœud par nœud ; le corpus garde son reclassement. Ce
 * module rend des CANDIDATS classés, vite. La décision reste chez celui qui sait la prendre.
 *
 * ── LES DEUX VOIES, ET POURQUOI LA DEUXIÈME NE DISPARAÎT PAS ────────────────────────────
 *
 *   FTS   to_tsvector('simple', …) @@ to_tsquery — par MOTS, classée (ts_rank), préfixes
 *         (`pembro:*` trouve « pembrolizumab ») ; sert l'index d'expression de la migration
 *         `20260828300000_fabric_content_indexes`.
 *   LIKE  le `contains` d'origine — par FRAGMENTS, y compris au milieu d'un mot (« 1028 »
 *         dans « PAY-1028-B »), désormais servi par l'index trigramme.
 *
 * La FTS est la voie principale ; le LIKE est le REPLI, et il est DIT (`voie` dans le
 * résultat). Un repli silencieux redeviendrait une mesure qu'on croit indexée et qui ne l'est
 * pas — la classe exacte de mensonge que ce chantier interdit (§36 : pas de faux omniscient).
 *
 * ── CE QUE LA REQUÊTE NE FAIT JAMAIS ─────────────────────────────────────────────────────
 *
 * Aucun contrôle d'accès ICI. Les identifiants rendus sont des CANDIDATS ; l'appelant
 * revérifie l'ACL exactement comme avant (nœud par nœud pour le Drive). Un index n'est jamais
 * une porte dérobée (§25) — et centraliser le droit ici dupliquerait une garde qui vit déjà
 * au bon endroit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CandidatContenu {
  /** L'identifiant de la LIGNE d'index (nodeId pour le Drive, id de chunk pour le corpus). */
  id: string;
  /** Le rang FTS (plus haut = plus pertinent). 0 en voie LIKE — un LIKE ne classe pas. */
  rang: number;
}

export interface ResultatContenu {
  candidats: CandidatContenu[];
  /** Par où la réponse est passée. Écrit, jamais deviné — le banc et le juge le lisent. */
  voie: "FTS" | "LIKE";
  /** ET de tous les termes, ou repli OU quand la conjonction ne rend rien. */
  conjonction: boolean;
}

/**
 * LES TERMES DEVIENNENT UNE tsquery PRÉFIXÉE — `pembro` → `pembro:*`.
 *
 * On n'utilise PAS `websearch_to_tsquery` : il ne sait pas produire de préfixes, or la moitié
 * des requêtes réelles sont des débuts de mots (« pembro », « zorba »). La construction est
 * manuelle et VERROUILLÉE : seuls des caractères de mot passent — tout le reste est écarté,
 * pas échappé. Un terme qui ne survit pas au filtre n'entre pas dans la requête ; il n'y a
 * donc rien à injecter.
 */
export function versTsquery(tokens: readonly string[], conjonction: boolean): string | null {
  const surs = tokens
    .map((t) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (surs.length === 0) return null;
  return surs.map((t) => `${t}:*`).join(conjonction ? " & " : " | ");
}

/** Les tables de contenu que la fabric sait servir — fermé, donc prévisible. */
const TABLES = {
  drive: { table: '"DriveTextIndex"', id: '"nodeId"', kind: '"docKind"' as string | null, recence: '"updatedAt"' },
  corpus: { table: '"KnowledgeChunk"', id: '"id"', kind: null as string | null, recence: '"createdAt"' },
} as const;
export type SourceContenu = keyof typeof TABLES;

/**
 * RECHERCHE DANS LE CONTENU INDEXÉ — FTS d'abord, LIKE en repli DIT.
 *
 * L'expression `to_tsvector('simple', left("textFold", 250000))` est répétée à L'IDENTIQUE de
 * la migration : un index d'expression ne sert que la requête qui répète son expression. La
 * modifier ici sans toucher la migration recréerait le scan séquentiel en silence — c'est le
 * sabotage que le test d'EXPLAIN existe pour attraper.
 */
export async function chercherContenu(
  source: SourceContenu,
  tokens: readonly string[],
  opts: { limit?: number; docKind?: string | null } = {},
): Promise<ResultatContenu> {
  const t = TABLES[source];
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 50);
  const filtreKind = opts.docKind && t.kind
    ? Prisma.sql`AND ${Prisma.raw(t.kind)} = ${opts.docKind}`
    : Prisma.empty;

  // ── VOIE PRINCIPALE : FTS, conjonction puis repli disjonction. ───────────────────────
  for (const conjonction of [true, false]) {
    const q = versTsquery(tokens, conjonction);
    if (!q) break;
    try {
      /**
       * ── LE CLASSEMENT EST BORNÉ, ET C'EST LE BANC QUI L'A EXIGÉ ────────────────────────
       *
       * L'index GIN sert le FILTRE (@@), jamais le RANG : `ts_rank` recalcule le tsvector de
       * chaque ligne correspondante. Sur une requête à mot fréquent (« contrat »), des
       * milliers de lignes correspondent, et la première version de cette requête payait ce
       * recalcul sur toutes — 273 ms là où le scan séquentiel d'avant en mettait 7. Un banc
       * qui n'aurait mesuré que des requêtes rares ne l'aurait jamais vu.
       *
       * La sous-requête matérialise un VIVIER borné servi par l'index — les 300 plus
       * récentes qui correspondent — et le rang ne se calcule que sur lui. La borne est un
       * choix DIT : sur un corpus où plus de 300 documents portent le mot, le classement se
       * fait parmi les 300 plus récents. La récence est le bon départage à cette échelle,
       * et c'est celui que l'entonnoir historique utilisait déjà (`orderBy updatedAt`).
       */
      const rows = await prisma.$queryRaw<{ id: string; rang: number }[]>(Prisma.sql`
        SELECT id,
               ts_rank(to_tsvector('simple', left(vivier."textFold", 250000)), to_tsquery('simple', ${q})) AS rang
        FROM (
          SELECT ${Prisma.raw(t.id)} AS id, "textFold"
          FROM ${Prisma.raw(t.table)}
          WHERE to_tsvector('simple', left("textFold", 250000)) @@ to_tsquery('simple', ${q})
            ${filtreKind}
          ORDER BY ${Prisma.raw(t.recence)} DESC
          LIMIT 300
        ) AS vivier
        ORDER BY rang DESC
        LIMIT ${limit}
      `);
      if (rows.length > 0) {
        return { candidats: rows.map((r) => ({ id: r.id, rang: Number(r.rang) })), voie: "FTS", conjonction };
      }
      // Une conjonction vide n'est pas un échec de la voie : on élargit en OU avant de
      // changer de voie — même politique que l'entonnoir historique.
    } catch {
      // L'index ou la fonction manque (base plus ancienne que la migration) : on passe au
      // LIKE. Le repli est structurel, jamais silencieux — `voie` le dira.
      break;
    }
  }

  // ── REPLI : le contains d'origine — servi par l'index trigramme quand il existe. ──────
  const nets = tokens.map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 8);
  if (nets.length === 0) return { candidats: [], voie: "LIKE", conjonction: true };

  for (const conjonction of [true, false]) {
    if (!conjonction && nets.length < 2) break;
    const motifs = nets.map((x) => `%${x}%`);
    // Les MOTIFS restent des paramètres ($1…$n) — seule la STRUCTURE (nombre de clauses,
    // liaison) est construite, à partir de rien d'autre que la longueur de la liste.
    const clauses = motifs.map((_, i) => `"textFold" LIKE $${i + 1}`).join(conjonction ? " AND " : " OR ");
    const filtre = opts.docKind && t.kind ? `AND ${t.kind} = $${motifs.length + 1} ` : "";
    try {
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT ${t.id} AS id FROM ${t.table} WHERE (${clauses}) ${filtre}`
        + `ORDER BY ${t.recence} DESC LIMIT ${limit}`,
        ...motifs,
        ...(opts.docKind && t.kind ? [opts.docKind] : []),
      );
      if (rows.length > 0) {
        return { candidats: rows.map((r) => ({ id: r.id, rang: 0 })), voie: "LIKE", conjonction };
      }
    } catch {
      break;
    }
  }
  return { candidats: [], voie: "LIKE", conjonction: false };
}
