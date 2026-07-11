import { PrismaClient } from "@prisma/client";

/**
 * URL de datasource avec POOL DE CONNEXIONS réglable. Par défaut, Prisma dimensionne le pool à
 * `CPUs × 2 + 1` (souvent 3 sur 1 vCPU) — ce qui étrangle les charges concurrentes (téléversement
 * d'un gros dossier découpé en parties : chaque partie = une écriture DB). Poser `DB_CONNECTION_LIMIT`
 * (selon la capacité `max_connections` de Postgres, ex. 10) élargit le pool SANS toucher au schéma
 * ni au reste de l'app. `DB_POOL_TIMEOUT` (s) optionnel. Absents → comportement Prisma inchangé.
 */
function pooledDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  const limit = process.env.DB_CONNECTION_LIMIT;
  if (!base || !limit) return undefined;
  try {
    const u = new URL(base);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", limit);
    const poolTimeout = process.env.DB_POOL_TIMEOUT;
    if (poolTimeout && !u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", poolTimeout);
    return u.toString();
  } catch {
    return undefined; // URL non standard → on laisse Prisma gérer l'original
  }
}

// Reuse a single PrismaClient across hot reloads in development to avoid
// exhausting database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = pooledDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
