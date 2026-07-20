import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Environnements éphémères (§31) : un schéma PostgreSQL **entièrement jetable**, isolé du schéma
 * applicatif. Analogue « isolation » du manifeste : on ne détruit JAMAIS un schéma dont le nom ne
 * respecte pas le préfixe réservé `tc_eph_` — garde-fou absolu contre toute suppression du schéma
 * `public` ou d'un schéma applicatif. Après destruction, on VÉRIFIE la disparition.
 */

const SCHEMA_RE = /^tc_eph_[a-z0-9_]{4,60}$/;

/** Refuse tout nom de schéma hors de l'espace réservé (sécurité de la destruction). */
export function assertEphemeralName(schema: string): void {
  if (!SCHEMA_RE.test(schema)) throw new Error(`Schéma éphémère refusé (hors espace réservé « tc_eph_ ») : ${schema}`);
}

export function ephemeralSchemaName(runId: string): string {
  const base = runId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "run";
  return `tc_eph_${base}_${crypto.randomBytes(4).toString("hex")}`;
}

export async function createEphemeralSchema(schema: string): Promise<void> {
  assertEphemeralName(schema);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
}

export async function schemaExists(schema: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schema}) AS "present"`;
  return rows[0]?.present ?? false;
}

/** Détruit le schéma (CASCADE) puis VÉRIFIE sa disparition. Nom validé au préalable. */
export async function destroyEphemeralSchema(schema: string): Promise<{ dropped: boolean; verifiedGone: boolean }> {
  assertEphemeralName(schema);
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  const gone = !(await schemaExists(schema));
  return { dropped: true, verifiedGone: gone };
}

// —— Helpers SQL bornés au schéma éphémère (identifiants validés, jamais d'entrée externe) ——

/** Exécute une instruction DDL/DML dont NOUS construisons le SQL, dans le schéma éphémère. */
export async function execInEphemeral(schema: string, sql: string): Promise<void> {
  assertEphemeralName(schema);
  await prisma.$executeRawUnsafe(sql);
}

/** Compte les lignes d'une table du schéma éphémère (nom de table validé). */
export async function countInEphemeral(schema: string, table: string): Promise<number> {
  assertEphemeralName(schema);
  if (!/^[a-z_][a-z0-9_]{0,40}$/.test(table)) throw new Error(`Nom de table refusé : ${table}`);
  const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${schema}"."${table}"`);
  return rows[0]?.n ?? 0;
}
