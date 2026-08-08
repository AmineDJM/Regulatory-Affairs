import { PrismaClient } from "@prisma/client";

/**
 * POOL DE CONNEXIONS — **12 par défaut**, sans rien à configurer côté hébergeur.
 *
 * Prisma dimensionne le pool à `CPUs × 2 + 1`, soit **3 connexions sur 1 vCPU**. C'est le vrai
 * goulot d'étranglement de cette application : dès qu'une analyse CTD tourne (le passage de jobs
 * prend plusieurs dossiers de front) ou qu'un gros dossier monte (chaque partie = une écriture),
 * les 3 connexions sont prises et **toute autre requête attend** — y compris l'ouverture d'une
 * session de téléversement, qui rendait alors « serveur injoignable ou trop lent (30 s) ».
 * Élargir le pool ne coûte rien : Postgres accepte par défaut une centaine de connexions, et
 * l'instance n'en tenait que 3.
 *
 * Le défaut ne s'applique qu'EN PRODUCTION, où l'application tourne dans un seul processus. Un
 * pool se compte par processus : en test, les fichiers s'exécutent dans une dizaine de workers
 * parallèles, et douze connexions chacun dépasseraient le `max_connections` de Postgres.
 *
 * `DB_CONNECTION_LIMIT` reste prioritaire et s'applique partout (à relever seulement en connaissant
 * le `max_connections` de la base, et en tenant compte du NOMBRE D'INSTANCES : chacune ouvre son
 * propre pool). `DB_POOL_TIMEOUT` (s) : délai d'attente d'une connexion libre avant erreur.
 * Une URL qui porte déjà `connection_limit` n'est jamais modifiée.
 */
const DEFAULT_CONNECTION_LIMIT = "12";

function pooledDatasourceUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  const limit = process.env.DB_CONNECTION_LIMIT || (process.env.NODE_ENV === "production" ? DEFAULT_CONNECTION_LIMIT : "");
  if (!limit) return undefined;
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
