import type { OpExecuteResult } from "./types";

/**
 * HELPERS D'ÉCHELLE des ops de domaine — la mécanique répétitive (FormData, appel de l'action
 * canonique, reçu) factorisée pour que chaque op ne porte QUE sa résolution et sa carte.
 * Rien ici ne contourne quoi que ce soit : l'action canonique revalide toujours tout.
 */

type ActionResultLike = { ok: boolean; error?: string; id?: string };
type Fd1 = (fd: FormData) => Promise<ActionResultLike>;
type Fd2 = (prev: ActionResultLike | undefined, fd: FormData) => Promise<ActionResultLike>;

/** FormData depuis les args mémorisés — null/vide = champ absent (l'action applique ses défauts). */
export function toFd(args: Record<string, string | null>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(args)) {
    if (v !== null && v !== "") fd.set(k, v);
  }
  return fd;
}

interface RunOpts {
  link?: string;
  revalidate?: string[];
  message?: string;
}

/** Exécute une action canonique `(formData)` avec les args mémorisés — reçu OpExecuteResult. */
export async function runFd(action: Fd1, args: Record<string, string | null>, refusal: string, opts: RunOpts = {}): Promise<OpExecuteResult> {
  const r = await action(toFd(args));
  if (!r.ok) return { ok: false, error: r.error ?? refusal };
  return { ok: true, ...(r.id ? { createdId: r.id } : {}), ...(opts.message ? { message: opts.message } : {}), ...(opts.link ? { link: opts.link } : {}), ...(opts.revalidate ? { revalidate: opts.revalidate } : {}) };
}

/** Idem pour une action `(prev, formData)` (useFormState). */
export async function runFd2(action: Fd2, args: Record<string, string | null>, refusal: string, opts: RunOpts = {}): Promise<OpExecuteResult> {
  const r = await action(undefined, toFd(args));
  if (!r.ok) return { ok: false, error: r.error ?? refusal };
  return { ok: true, ...(r.id ? { createdId: r.id } : {}), ...(opts.message ? { message: opts.message } : {}), ...(opts.link ? { link: opts.link } : {}), ...(opts.revalidate ? { revalidate: opts.revalidate } : {}) };
}

/** Montant DZD affichable (« 1 500 000 DZD »). */
export const dzd = (n: number): string => `${Math.round(n).toLocaleString("fr-FR")} DZD`;

/** Champs de carte compacts : les paires vides sont omises. */
export function fieldsOf(pairs: [string, string | null | undefined][]): { label: string; value: string }[] {
  return pairs.filter((p): p is [string, string] => Boolean(p[1])).map(([label, value]) => ({ label, value }));
}

/**
 * Résolution GÉNÉRIQUE exact → unique → ambiguïté LISTÉE (l'invariant des ops) : `search`
 * renvoie les candidats (bornés) pour un libellé ; le match exact (plié) gagne, un candidat
 * unique passe, plusieurs se LISTENT — jamais de choix silencieux.
 */
export async function resolveOne<T>(
  raw: string,
  what: string,
  search: (q: string) => Promise<T[]>,
  labelOf: (t: T) => string,
): Promise<T | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: `Précisez ${what}.` };
  const rows = await search(q);
  if (rows.length === 0) return { error: `Aucun résultat pour ${what} « ${q} ».` };
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exact = rows.filter((r) => fold(labelOf(r)) === fold(q));
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  return { error: `Plusieurs résultats pour ${what} « ${q} » : ${rows.slice(0, 6).map(labelOf).join(", ")} — préciser.` };
}

/** Date ISO (AAAA-MM-JJ) depuis une saisie humaine — null si illisible. */
export const isoDate = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Numéro de mois FR ↔ 1..12 (« janvier », « 01 », « 1 »). */
export function monthOf(raw: string): number | null {
  const q = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!q) return null;
  const names = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const byName = names.findIndex((n) => n.startsWith(q.slice(0, 4)) && q.length >= 3);
  if (byName >= 0) return byName + 1;
  const n = Number(q);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}
