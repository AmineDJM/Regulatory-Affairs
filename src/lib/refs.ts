import { Prisma } from "@prisma/client";

/**
 * Génération de références séquentielles **robuste aux trous**. Les anciennes
 * références basées sur `count()+1` entraient en collision dès qu'un enregistrement
 * était supprimé (le compteur retombait sur une référence existante → violation de
 * contrainte d'unicité → exception non gérée « Application error »). On dérive
 * désormais le prochain numéro du **maximum** réellement présent, et on réessaie en
 * cas de collision concurrente.
 */

/** Prochain numéro à partir d'une liste de références « PREFIX-AAAA-NNN ». */
export function nextRefNumber(refs: string[]): number {
  let max = 0;
  for (const r of refs) {
    const m = /(\d+)\s*$/.exec(r);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/** Référence « PREFIX-AAAA-NNN » à partir des références existantes. */
export function buildRef(prefix: string, year: number, existing: string[]): string {
  return `${prefix}-${year}-${String(nextRefNumber(existing)).padStart(3, "0")}`;
}

/**
 * Exécute une création en réessayant si une contrainte d'unicité (P2002) saute —
 * typiquement une collision de référence sous concurrence. `fn` doit recalculer la
 * référence à chaque tentative.
 */
export async function createWithRetry<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { lastErr = e; continue; }
      throw e;
    }
  }
  throw lastErr;
}
