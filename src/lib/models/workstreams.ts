import { askModel, askModelJson } from "./gateway";
import type { ModelRole, ModelUsage, ReasoningEffort } from "./contract";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CHANTIERS PARALLÈLES (§3–4) — l'orchestrateur découpe, les ouvriers exécutent.
 *
 * ── L'ARCHITECTURE, EN UNE PHRASE ────────────────────────────────────────────────────────
 *
 * Terra-medium ORCHESTRE : il décide quoi faire et dans quel ordre. Terra-none et Luna-none
 * EXÉCUTENT : chacun sa sous-tâche, tous en même temps. Le code, lui, DÉTIENT LA VÉRITÉ et fait
 * les écritures. Une mission complexe cesse d'être une longue file d'attente séquentielle pour
 * devenir un front large — c'est là que se gagne la latence, priorité n°2 après la qualité.
 *
 * ── POURQUOI LES OUVRIERS NE PEUVENT PAS AGIR ────────────────────────────────────────────
 *
 * Ils n'ont AUCUN outil. Pas « on leur demande de ne pas agir » : ils n'en ont pas la
 * possibilité, parce que ce module n'expose jamais `tools` au fournisseur. C'est structurel, et
 * c'est la seule forme de garantie qui tienne — un modèle à qui l'on a donné un outil de
 * suppression et une consigne de prudence finira par supprimer quelque chose.
 *
 * « Le modèle ne doit jamais être directement responsable de la transaction métier » : ici, il ne
 * peut littéralement pas l'être. Les chantiers rendent du TEXTE ou du JSON ; c'est l'appelant qui
 * décide ce qu'il en fait, et les mutations restent sur le chemin canonique avec ses gardes.
 *
 * ── CE QUI SE PASSE QUAND UN CHANTIER ÉCHOUE ─────────────────────────────────────────────
 *
 * Les autres continuent. Un chantier qui tombe rend `ok: false` avec son motif, et l'appelant
 * reçoit un résultat PARTIEL clairement identifié comme tel. L'inverse — tout annuler parce
 * qu'un des huit a échoué — transformerait une réponse à 7/8 en absence de réponse.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Un chantier : ce qu'on demande, à quel barreau, et sous quel nom on le retrouvera. */
export interface Workstream<T = string> {
  /** Le nom du chantier — il figure dans le résultat et dans les traces. */
  id: string;
  /** L'invite. Autonome : un ouvrier ne voit pas les autres chantiers, ni la conversation. */
  prompt: string;
  /** Instructions de rôle. Optionnel — la plupart des sous-tâches n'en ont pas besoin. */
  system?: string;
  /**
   * Le barreau. `worker` (Terra-none) pour ce qui demande du raisonnement ; `bulk` (Luna-none)
   * pour le volume. Le défaut est `worker` : se tromper vers le haut coûte des centimes, se
   * tromper vers le bas coûte une réponse fausse.
   */
  role?: Extract<ModelRole, "worker" | "bulk">;
  /** Un schéma JSON quand la sortie doit être structurée — la conformité est alors garantie. */
  schema?: { name: string; schema: Record<string, unknown> };
  maxOutputTokens?: number;
  reasoning?: ReasoningEffort;
  /** Ce que l'appelant veut retrouver attaché au résultat (un identifiant de dossier…). */
  meta?: T;
}

export interface WorkstreamResult<T = string> {
  id: string;
  ok: boolean;
  text: string | null;
  data: unknown;
  error: string | null;
  role: ModelRole;
  usage: ModelUsage | null;
  ms: number;
  meta?: T;
}

export interface FanOutResult<T = string> {
  results: WorkstreamResult<T>[];
  /** Vrai seulement si TOUS ont abouti. Un appelant honnête distingue complet et partiel. */
  complete: boolean;
  succeeded: number;
  failed: number;
  /** Durée du front, pas la somme des chantiers — c'est ce que l'utilisateur ressent. */
  ms: number;
  /** `null` dès qu'un seul prix est inconnu : une somme partielle présentée comme un total est
   *  un chiffre faux avec l'air d'un chiffre juste. */
  costUsd: number | null;
}

/**
 * COMBIEN DE CHANTIERS EN VOL EN MÊME TEMPS.
 *
 * Six : assez pour que huit sous-tâches tiennent en deux vagues, assez peu pour ne pas se faire
 * limiter par le fournisseur — auquel cas la « parallélisation » ferait perdre du temps en
 * réessais. Ce n'est pas un maximum théorique, c'est un compromis mesurable.
 */
export const DEFAULT_CONCURRENCY = 6;

/** Au-delà, un chantier est considéré perdu. Les autres n'ont pas à l'attendre indéfiniment. */
export const DEFAULT_STREAM_TIMEOUT_MS = 90_000;

export interface FanOutOptions {
  concurrency?: number;
  timeoutMs?: number;
  /** Appelé dès qu'un chantier rend sa copie — pour afficher l'avancement sans attendre la fin. */
  onResult?: (r: WorkstreamResult<never>) => void;
}

/**
 * LANCE LES CHANTIERS ET RASSEMBLE.
 *
 * L'ORDRE DES RÉSULTATS SUIT L'ORDRE DES CHANTIERS, jamais l'ordre d'arrivée. Sans cela, deux
 * exécutions de la même mission rendraient deux rapports dans un ordre différent, et personne ne
 * pourrait les comparer — un non-déterminisme gratuit, payé par le lecteur.
 */
export async function fanOut<T = string>(
  streams: Workstream<T>[],
  opts: FanOutOptions = {},
): Promise<FanOutResult<T>> {
  const started = Date.now();
  if (!streams.length) {
    return { results: [], complete: false, succeeded: 0, failed: 0, ms: 0, costUsd: 0 };
  }

  const limit = Math.max(1, Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, 12));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_STREAM_TIMEOUT_MS;
  const results = new Array<WorkstreamResult<T>>(streams.length);

  // Un curseur partagé plutôt que des tranches fixes : si un chantier est long, les autres
  // ouvriers enchaînent au lieu d'attendre que sa tranche soit finie.
  let next = 0;
  const runner = async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= streams.length) return;
      const r = await runOne(streams[i], timeoutMs);
      results[i] = r;
      // La notification ne doit jamais faire tomber le front : un appelant qui lève dans son
      // affichage ne doit pas annuler les chantiers restants.
      try { opts.onResult?.(r as unknown as WorkstreamResult<never>); } catch { /* ignoré */ }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, streams.length) }, runner));

  const succeeded = results.filter((r) => r.ok).length;
  let cost: number | null = 0;
  for (const r of results) {
    if (cost === null) break;
    const c = r.usage?.costUsd;
    if (c == null) { cost = r.usage ? null : cost; continue; }
    cost += c;
  }

  return {
    results,
    complete: succeeded === streams.length,
    succeeded,
    failed: streams.length - succeeded,
    ms: Date.now() - started,
    costUsd: cost,
  };
}

/** UN chantier. Ne lève jamais — un ouvrier qui tombe ne fait pas tomber le front. */
async function runOne<T>(s: Workstream<T>, timeoutMs: number): Promise<WorkstreamResult<T>> {
  const t0 = Date.now();
  const role: ModelRole = s.role ?? "worker";
  const base = { id: s.id, role, meta: s.meta, data: null as unknown };

  try {
    const call = s.schema
      ? askModelJson<unknown>(role, s.prompt, s.schema, {
          system: s.system, maxOutputTokens: s.maxOutputTokens, reasoning: s.reasoning,
        }).then((r) => ({ text: r.data == null ? null : JSON.stringify(r.data), data: r.data, reply: r.reply }))
      : askModel(role, s.prompt, {
          system: s.system, maxOutputTokens: s.maxOutputTokens, reasoning: s.reasoning,
        }).then((r) => ({ text: r.text, data: null as unknown, reply: r.reply }));

    const out = await withTimeout(call, timeoutMs, s.id);
    const ok = out.reply.ok && (s.schema ? out.data != null : out.text != null);
    return {
      ...base,
      ok,
      text: out.text,
      data: out.data,
      // Une réponse vide n'est PAS une erreur muette : on la nomme, sinon un chantier qui ne
      // rend rien est indiscernable d'un chantier qui rend « rien à signaler ».
      error: ok ? null : (out.reply.error ?? "réponse vide ou non conforme"),
      usage: out.reply.usage ?? null,
      ms: Date.now() - t0,
    };
  } catch (err) {
    return {
      ...base, ok: false, text: null,
      error: err instanceof Error ? err.message : String(err),
      usage: null, ms: Date.now() - t0,
    };
  }
}

/**
 * LE DÉLAI MAXIMAL. Le `setTimeout` est NETTOYÉ dans tous les cas : sans le `finally`, un
 * processus Node resterait éveillé jusqu'à l'échéance de chaque chantier déjà terminé — un
 * défaut invisible en développement et coûteux en production.
 */
function withTimeout<R>(p: Promise<R>, ms: number, id: string): Promise<R> {
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`chantier « ${id} » : délai de ${Math.round(ms / 1000)} s dépassé`)), ms);
  });
  return Promise.race([p, guard]).finally(() => { if (timer) clearTimeout(timer); }) as Promise<R>;
}

/**
 * DÉCOUPE UN LOT EN CHANTIERS DE MÊME NATURE — le cas le plus fréquent.
 *
 * « Résume ces 40 dossiers » n'est pas une mission complexe : c'est la même sous-tâche répétée.
 * Elle part donc sur `bulk` (Luna-none) et par PAQUETS, parce que quarante appels d'un article
 * chacun coûtent quarante allers-retours pour un travail qu'un seul appel fait aussi bien.
 */
export function batchStreams<I>(
  items: I[],
  opts: {
    batchSize?: number;
    role?: Extract<ModelRole, "worker" | "bulk">;
    system?: string;
    /** Construit l'invite d'un PAQUET. L'appelant sait mieux que nous comment présenter ses objets. */
    prompt: (batch: I[], index: number) => string;
    schema?: { name: string; schema: Record<string, unknown> };
    idPrefix?: string;
  },
): Workstream<{ from: number; to: number }>[] {
  const size = Math.max(1, opts.batchSize ?? 10);
  const out: Workstream<{ from: number; to: number }>[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push({
      id: `${opts.idPrefix ?? "lot"}-${out.length + 1}`,
      prompt: opts.prompt(batch, out.length),
      system: opts.system,
      role: opts.role ?? "bulk",
      schema: opts.schema,
      meta: { from: i, to: i + batch.length - 1 },
    });
  }
  return out;
}

/**
 * CE QUE L'ORCHESTRATEUR DOIT LIRE APRÈS UN FRONT.
 *
 * Un résumé HONNÊTE : ce qui a abouti, ce qui a échoué et pourquoi. On ne masque jamais un
 * chantier tombé — l'orchestrateur doit pouvoir décider de le relancer, de s'en passer, ou de
 * dire à l'utilisateur qu'il manque une pièce. Lui cacher l'échec le ferait conclure sur des
 * données incomplètes en croyant les avoir toutes.
 */
export function summarizeFanOut(r: FanOutResult<unknown>): string {
  const lines: string[] = [];
  for (const s of r.results) {
    if (s.ok) lines.push(`### ${s.id}\n${s.text ?? ""}`);
    else lines.push(`### ${s.id}\n[ÉCHEC — ${s.error ?? "raison inconnue"}]`);
  }
  if (!r.complete) {
    lines.unshift(
      `⚠ Résultat PARTIEL : ${r.succeeded}/${r.results.length} chantiers ont abouti. ` +
        `Les conclusions ne portent que sur ce qui est présent ci-dessous.`,
    );
  }
  return lines.join("\n\n");
}
