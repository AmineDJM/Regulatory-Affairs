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

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE SÉRIE, UNE CRÉATION À LA FOIS DANS CE PROCESSUS.
 *
 * `createWithRetry` est un verrou OPTIMISTE : chacun lit le maximum, écrit, et réessaie s'il a
 * perdu. Juste pour deux créations simultanées ; faux pour vingt-cinq. Tous les concurrents lisent
 * le MÊME maximum au même instant, un seul gagne chaque tour, et ils se relancent ensemble — le
 * k-ième a besoin de k essais. MESURÉ (§118.148) : dix bons de commande émis en parallèle, chacun
 * posant sa demande de validation `VAL-AAAA-NNN`, et au-delà du sixième la référence était encore
 * en collision : la demande n'était pas créée, et le BC sortait SANS PORTE, en silence.
 *
 * On ne relève pas le nombre d'essais — la file s'allongerait avec la charge, et le plafond ne
 * ferait que déplacer la mission qui échoue. On SÉRIALISE : les créations d'une même série
 * attendent leur tour ICI, avant d'ouvrir la moindre connexion (un verrou de base tiendrait une
 * connexion du pool pendant qu'il attend, et vingt-cinq attentes affameraient le reste du
 * processus). L'application tourne dans UN processus (`render.yaml`) ; entre deux processus — un
 * script lancé à côté, les workers de la suite de tests — `createWithRetry` reste le filet.
 *
 * Un échec ne bloque pas la file : le suivant passe quand le précédent a fini, bien ou mal.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
const files = new Map<string, Promise<void>>();

export async function enSerie<T>(serie: string, fn: () => Promise<T>): Promise<T> {
  const precedent = files.get(serie) ?? Promise.resolve();
  let liberer: () => void = () => undefined;
  const monTour = new Promise<void>((resolve) => { liberer = resolve; });
  const queue = precedent.then(() => monTour);
  files.set(serie, queue);
  await precedent;
  try {
    return await fn();
  } finally {
    liberer();
    // Le dernier de la file la retire : une série au repos ne garde rien en mémoire.
    if (files.get(serie) === queue) files.delete(serie);
  }
}
