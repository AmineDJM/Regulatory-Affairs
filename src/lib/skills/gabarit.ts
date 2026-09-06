/**
 * LES GABARITS (§36) — `{{entree.x}}`, `{{config.CLE}}`, `{{etapes.alias.champ}}` — pur.
 *
 * Un manifeste HTTP ou un playbook ne concatène jamais de chaînes : il déclare une forme avec des
 * trous, et ce module la remplit depuis un CONTEXTE. Un trou qui vaut exactement une valeur garde
 * son type (un nombre reste un nombre, un objet un objet) ; un trou au milieu d'un texte est
 * interpolé ; un trou sans valeur est COMPTÉ (`manquants`) — l'appelant décide s'il refuse.
 */

const TROU_RE = /\{\{\s*([a-zA-Z0-9_.\-[\]]+)\s*\}\}/g;
const TROU_SEUL_RE = /^\{\{\s*([a-zA-Z0-9_.\-[\]]+)\s*\}\}$/;

export interface Remplissage { valeur: unknown; manquants: string[] }

/** Lit `a.b[0].c` dans un contexte. `undefined` si le chemin ne mène nulle part. */
export function lireChemin(ctx: unknown, chemin: string): unknown {
  if (!chemin) return ctx;
  let cur: unknown = ctx;
  for (const part of chemin.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean)) {
    if (cur === null || cur === undefined) return undefined;
    if (Array.isArray(cur)) { const i = Number(part); cur = Number.isInteger(i) ? cur[i] : undefined; continue; }
    if (typeof cur === "object") { cur = (cur as Record<string, unknown>)[part]; continue; }
    return undefined;
  }
  return cur;
}

const texteDe = (v: unknown): string => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** REMPLIT un gabarit (chaîne, objet, tableau) depuis le contexte. */
export function remplir(gabarit: unknown, ctx: Record<string, unknown>): Remplissage {
  const manquants: string[] = [];
  const visiter = (g: unknown): unknown => {
    if (typeof g === "string") {
      const seul = TROU_SEUL_RE.exec(g);
      if (seul) {
        const v = lireChemin(ctx, seul[1] ?? "");
        if (v === undefined) manquants.push(seul[1] ?? "");
        return v;
      }
      return g.replace(TROU_RE, (_, chemin: string) => {
        const v = lireChemin(ctx, chemin);
        if (v === undefined) manquants.push(chemin);
        return texteDe(v);
      });
    }
    if (Array.isArray(g)) return g.map(visiter);
    if (g && typeof g === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(g as Record<string, unknown>)) out[k] = visiter(v);
      return out;
    }
    return g;
  };
  return { valeur: visiter(gabarit), manquants: [...new Set(manquants)] };
}

/** Les trous d'un gabarit, sans le remplir — pour dire au modèle ce qu'un skill attend. */
export function trous(gabarit: unknown): string[] {
  const out = new Set<string>();
  const visiter = (g: unknown) => {
    if (typeof g === "string") { for (const m of g.matchAll(TROU_RE)) out.add(m[1] ?? ""); return; }
    if (Array.isArray(g)) { g.forEach(visiter); return; }
    if (g && typeof g === "object") Object.values(g as Record<string, unknown>).forEach(visiter);
  };
  visiter(gabarit);
  return [...out];
}
