import { Prisma } from "@prisma/client";

/**
 * QUI TIENT UN FICHIER — lu dans le SCHÉMA, jamais dans une liste écrite à la main.
 *
 * Le ramasse-miettes ne connaissait que deux tables (`FileVersion`, `StoredFile`) quand onze
 * autres désignent aussi un `FileBlob` : pièces de messagerie, documents RH, pièces Regulatory,
 * rapports terrain, papier en-tête… (audit du 04/10, constat 2). Une purge lancée ce jour-là
 * aurait détruit leurs octets — et la fiche serait restée, pointant vers un fichier disparu.
 * Une liste tenue à la main est fausse le jour où quelqu'un ajoute une colonne, EN SILENCE
 * (§118.73) : on la DÉRIVE donc du schéma.
 *
 * Deux sortes de détenteurs :
 *   • les COLONNES — tout champ texte dont le nom finit par `blobId` (`blobId`, `audioBlobId`,
 *     `originalZipBlobId`, `letterBlobId`…), sauf les tranches d'un blob (`FileBlobChunk`), qui
 *     ne le tiennent pas : elles en font partie et tombent avec lui ;
 *   • le JSON — un logo de marque garde son `blobId` dans un réglage, une ligne de la corbeille
 *     garde celui de la pièce qu'elle restaurera. Toute colonne JSON est lue, et toute clé qui
 *     finit par `blobId` y compte.
 *
 * Module serveur (il lit le DMMF de Prisma) — ni base, ni réseau : il ne fait que construire.
 */

const EXCLUS = new Set(["FileBlob", "FileBlobChunk"]);
const NOM_DE_REFERENCE = /blobid$/i;

export interface ColonneRef { table: string; colonne: string }

const MODELES = Prisma.dmmf.datamodel.models;

/** Les colonnes scalaires qui désignent un FileBlob, dérivées du schéma. */
export const COLONNES_BLOB: readonly ColonneRef[] = MODELES
  .filter((m) => !EXCLUS.has(m.name))
  .flatMap((m) => m.fields
    .filter((f) => f.kind === "scalar" && f.type === "String" && NOM_DE_REFERENCE.test(f.name))
    .map((f) => ({ table: m.dbName ?? m.name, colonne: f.dbName ?? f.name })));

/** Toutes les colonnes JSON du schéma — un `blobId` peut y vivre (marque, corbeille…). */
export const COLONNES_JSON: readonly ColonneRef[] = MODELES
  .flatMap((m) => m.fields
    .filter((f) => f.kind === "scalar" && f.type === "Json")
    .map((f) => ({ table: m.dbName ?? m.name, colonne: f.dbName ?? f.name })));

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/**
 * Fragment SQL : « aucune colonne ne désigne ce blob » (`alias` = l'alias de `FileBlob`).
 * Les identifiants viennent du schéma, jamais d'une saisie : ils sont cités, pas paramétrés.
 */
export function sqlAucuneColonneNeLeTient(alias = "b"): Prisma.Sql {
  if (COLONNES_BLOB.length === 0) return Prisma.sql`TRUE`;
  const clauses = COLONNES_BLOB.map(({ table, colonne }) =>
    `NOT EXISTS (SELECT 1 FROM ${q(table)} r WHERE r.${q(colonne)} = ${q(alias)}.id)`);
  return Prisma.raw(`(${clauses.join(" AND ")})`);
}

/**
 * Requête unique qui rend les identifiants de blob cités dans une colonne JSON. Une passe par
 * table : le texte du JSON est lu une fois, et seules les clés qui finissent par `blobId`
 * comptent — un identifiant cité ailleurs (un commentaire, un message) n'en fait pas un détenteur.
 */
export function sqlBlobsCitesEnJson(): Prisma.Sql | null {
  if (COLONNES_JSON.length === 0) return null;
  const parts = COLONNES_JSON.map(({ table, colonne }) =>
    `SELECT m[1] AS id FROM ${q(table)} t, regexp_matches(t.${q(colonne)}::text, '"[A-Za-z_]*[bB]lob[iI]d"\\s*:\\s*"([^"]+)"', 'g') m WHERE t.${q(colonne)} IS NOT NULL`);
  return Prisma.raw(`SELECT DISTINCT id FROM (${parts.join(" UNION ALL ")}) x`);
}
