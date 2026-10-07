/**
 * PROCESS MINING — le temps RÉELLEMENT passé à chaque étape d'un circuit (Process Intelligence, refonte 07/10).
 *
 * L'ancienne lecture mesurait « l'âge » d'un dossier par `updatedAt` : un simple commentaire remettait le compteur
 * à zéro, et un dossier en attente depuis trois semaines paraissait neuf. Ici, l'âge se lit dans le JOURNAL du
 * circuit (événements de workflow, décisions de validation, journaux de domaine, changements de statut) :
 *
 *   • un dossier part de son ouverture (`startedAt`, ou l'événement « start ») ;
 *   • chaque événement QUI FAIT AVANCER (accord, refus, renvoi, clôture) ferme un SEGMENT : le temps écoulé depuis
 *     le mouvement précédent est attribué à l'étape de cet événement ;
 *   • un commentaire, une désignation, une relance (« other ») ne ferment rien — ils ne remettent rien à zéro ;
 *   • un renvoi ouvre l'étape « Correction (demandeur) », fermée par la resoumission ;
 *   • un dossier encore ouvert attend à son étape courante depuis le dernier mouvement.
 *
 * Module PUR : aucune base, aucune session. Les lectures vivent dans `lib/queries/process-intelligence.ts`.
 * Il est importable par un écran client (formatage des durées).
 */

export const DAY_MS = 86_400_000;

/** Ce que fait un événement au circuit. */
export type EventKind = "start" | "advance" | "return" | "resubmit" | "reject" | "end" | "other";

export interface MiningEvent {
  at: Date;
  /** Clé stable de l'étape (slug, niveau, statut quitté). */
  step: string;
  stepLabel?: string | null;
  kind: EventKind;
  actor?: string | null;
  note?: string | null;
}

export interface MiningCase {
  id: string;
  /** Clé stable du circuit (ex. `WF:SPONSORING`, `VAL:Finances`, `PAY`). */
  circuit: string;
  label: string;
  href: string | null;
  startedAt: Date;
  /** null = encore en cours. */
  endedAt: Date | null;
  /** Étape où le dossier attend (ouvert seulement). */
  currentStep?: string | null;
  currentStepLabel?: string | null;
  events: MiningEvent[];
}

export interface Segment {
  step: string;
  label: string;
  start: Date;
  end: Date;
  days: number;
  actor: string | null;
  kind: EventKind;
}

export interface Waiting {
  step: string;
  label: string;
  since: Date;
  days: number;
}

export const CORRECTION_STEP = "__correction";
export const CORRECTION_LABEL = "Correction (demandeur)";

const MOVES: ReadonlySet<EventKind> = new Set(["advance", "return", "reject", "end"]);

const days = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / DAY_MS);

/** Découpe un dossier en segments d'étape (fermés) et, s'il est ouvert, en attente courante. */
export function segmentsOf(c: MiningCase, now: Date = new Date()): { segments: Segment[]; waiting: Waiting | null; returned: boolean; returnNotes: string[] } {
  const events = [...c.events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const segments: Segment[] = [];
  const labels = new Map<string, string>();
  const seen = new Set<string>();
  let cursor = c.startedAt;
  let enCorrection = false;
  let returned = false;
  const returnNotes: string[] = [];

  for (const e of events) {
    if (e.stepLabel) labels.set(e.step, e.stepLabel);
    if (e.kind === "start") {
      if (e.at.getTime() > cursor.getTime()) cursor = e.at;
      continue;
    }
    if (e.kind === "other") continue;
    if (e.kind === "resubmit") {
      segments.push({ step: CORRECTION_STEP, label: CORRECTION_LABEL, start: cursor, end: e.at, days: days(cursor, e.at), actor: e.actor ?? null, kind: "resubmit" });
      cursor = e.at;
      enCorrection = false;
      continue;
    }
    if (!MOVES.has(e.kind)) continue;
    // Revenir à une étape déjà franchie, c'est un retour en arrière — même sans « renvoi » explicite
    // (journaux de statut : un dossier qui repasse « en attente » après « approuvé »).
    if (e.kind === "advance" && seen.has(e.step) && !enCorrection) returned = true;
    segments.push({ step: e.step, label: e.stepLabel ?? labels.get(e.step) ?? e.step, start: cursor, end: e.at, days: days(cursor, e.at), actor: e.actor ?? null, kind: e.kind });
    if (e.kind === "advance") seen.add(e.step);
    cursor = e.at;
    if (e.kind === "return") {
      returned = true;
      enCorrection = true;
      const n = (e.note ?? "").trim();
      if (n) returnNotes.push(n);
    }
  }

  let waiting: Waiting | null = null;
  if (!c.endedAt) {
    const step = enCorrection ? CORRECTION_STEP : c.currentStep ?? segments[segments.length - 1]?.step ?? "__ouverture";
    const label = enCorrection ? CORRECTION_LABEL : c.currentStepLabel ?? labels.get(step) ?? (step === "__ouverture" ? "Ouverture" : step);
    waiting = { step, label, since: cursor, days: days(cursor, now) };
  }
  return { segments, waiting, returned, returnNotes };
}

/** Percentile par interpolation linéaire (p entre 0 et 1). `null` sur une série vide. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export const median = (values: readonly number[]) => percentile(values, 0.5);

export interface StepStat {
  step: string;
  label: string;
  passages: number;
  medianDays: number;
  /** Rang d'apparition moyen dans un dossier — pour afficher les étapes dans l'ordre du circuit. */
  order: number;
  slaDays: number | null;
}

export interface StuckItem {
  id: string;
  label: string;
  href: string | null;
  step: string;
  stepLabel: string;
  days: number;
  limitDays: number;
  sla: boolean;
}

export interface Insight {
  tone: "ko" | "w" | "i";
  title: string;
  detail: string;
}

export interface CircuitStats {
  circuit: string;
  label: string;
  cases: number;
  closed: number;
  medianDays: number | null;
  p90Days: number | null;
  slowest: StepStat | null;
  returnRate: number | null;
  topReturnReason: string | null;
  steps: StepStat[];
  stuck: StuckItem[];
  insights: Insight[];
}

export interface AnalyzeOptions {
  now?: Date;
  since: Date;
  /** Délai cible par étape (jours), clé = stepKey. */
  sla?: ReadonlyMap<string, number>;
  /** Au-delà, un dossier sans délai cible est « bloqué ». */
  stuckDays?: number;
  /** En dessous, « 9 sur 10 en moins de » n'est pas affiché (trop peu de dossiers clos). */
  minClosedForP90?: number;
}

const normaliserMotif = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[.;:!]+$/, "").trim().slice(0, 90);

/** Le motif le plus fréquent (forme normalisée), avec son libellé d'origine le plus court. */
export function motifLePlusFrequent(notes: readonly string[]): string | null {
  const parCle = new Map<string, { n: number; texte: string }>();
  for (const n of notes) {
    const cle = normaliserMotif(n);
    if (!cle) continue;
    const cur = parCle.get(cle);
    if (cur) { cur.n++; if (n.length < cur.texte.length) cur.texte = n.trim(); }
    else parCle.set(cle, { n: 1, texte: n.trim() });
  }
  let best: { n: number; texte: string } | null = null;
  for (const v of parCle.values()) if (!best || v.n > best.n) best = v;
  return best ? best.texte.slice(0, 120) : null;
}

/** Les chiffres d'un circuit sur la période. Tous les dossiers passés doivent appartenir au même circuit. */
export function analyzeCircuit(circuit: string, label: string, cases: readonly MiningCase[], opts: AnalyzeOptions): CircuitStats {
  const now = opts.now ?? new Date();
  const since = opts.since;
  const stuckDays = opts.stuckDays ?? 14;
  const sla = opts.sla ?? new Map<string, number>();
  const minP90 = opts.minClosedForP90 ?? 5;

  // Un dossier compte s'il a vécu dans la période : ouvert dedans, clos dedans, ou toujours en cours.
  const actifs = cases.filter((c) => c.startedAt >= since || !c.endedAt || c.endedAt >= since);
  const durees: number[] = [];
  const parEtape = new Map<string, { label: string; d: number[]; ordres: number[] }>();
  const parActeur = new Map<string, number[]>();
  const tous: number[] = [];
  const motifs: string[] = [];
  let renvoyes = 0;
  let avecHistoire = 0;
  const stuck: StuckItem[] = [];

  for (const c of actifs) {
    const { segments, waiting, returned, returnNotes } = segmentsOf(c, now);
    if (c.endedAt && c.endedAt >= since) durees.push(days(c.startedAt, c.endedAt));
    if (segments.length > 0) {
      avecHistoire++;
      if (returned) renvoyes++;
    }
    motifs.push(...returnNotes);
    const vus = new Set<string>();
    segments.forEach((s, i) => {
      if (s.end < since) return;
      const e = parEtape.get(s.step) ?? { label: s.label, d: [], ordres: [] };
      e.label = s.label;
      e.d.push(s.days);
      if (!vus.has(s.step)) { e.ordres.push(i); vus.add(s.step); }
      parEtape.set(s.step, e);
      tous.push(s.days);
      if (s.actor && s.step !== CORRECTION_STEP) {
        const a = parActeur.get(s.actor) ?? [];
        a.push(s.days);
        parActeur.set(s.actor, a);
      }
    });
    if (waiting) {
      const cible = sla.get(waiting.step);
      const limite = cible ?? stuckDays;
      if (waiting.days > limite) {
        stuck.push({ id: c.id, label: c.label, href: c.href, step: waiting.step, stepLabel: waiting.label, days: waiting.days, limitDays: limite, sla: cible !== undefined });
      }
      // L'étape d'attente apparaît dans la liste même sans passage clos (pour qu'on puisse lui fixer un délai).
      if (!parEtape.has(waiting.step)) parEtape.set(waiting.step, { label: waiting.label, d: [], ordres: [segments.length] });
    }
  }

  const steps: StepStat[] = [...parEtape.entries()]
    .map(([step, v]) => ({
      step, label: v.label, passages: v.d.length,
      medianDays: median(v.d) ?? 0,
      order: v.ordres.length ? v.ordres.reduce((a, b) => a + b, 0) / v.ordres.length : 99,
      slaDays: sla.get(step) ?? null,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "fr"));

  const avecPassages = steps.filter((s) => s.passages > 0);
  const candidats = avecPassages.filter((s) => s.passages >= 2).length ? avecPassages.filter((s) => s.passages >= 2) : avecPassages;
  const slowest = candidats.reduce<StepStat | null>((m, s) => (!m || s.medianDays > m.medianDays ? s : m), null);

  const returnRate = avecHistoire > 0 ? renvoyes / avecHistoire : null;
  const topReturnReason = motifLePlusFrequent(motifs);

  const stats: CircuitStats = {
    circuit, label,
    cases: actifs.length,
    closed: durees.length,
    medianDays: median(durees),
    p90Days: durees.length >= minP90 ? percentile(durees, 0.9) : null,
    slowest,
    returnRate,
    topReturnReason,
    steps,
    stuck: stuck.sort((a, b) => b.days - a.days),
    insights: [],
  };
  stats.insights = insightsFor(stats, parActeur, median(tous));
  return stats;
}

/** « Ce que ça dit » — trois constats au plus, calculés, du plus grave au plus doux. */
export function insightsFor(s: CircuitStats, parActeur: ReadonlyMap<string, readonly number[]> = new Map(), medianeCircuit: number | null = null): Insight[] {
  const out: Insight[] = [];
  const total = s.steps.filter((x) => x.passages > 0).reduce((a, x) => a + x.medianDays, 0);
  if (s.slowest && total > 0 && s.steps.filter((x) => x.passages > 0).length > 1) {
    const part = s.slowest.medianDays / total;
    out.push({
      tone: part >= 0.35 ? "ko" : "w",
      title: `« ${s.slowest.label} » prend ${Math.round(part * 100)} % du temps`,
      detail: `médiane ${formatJours(s.slowest.medianDays)} sur ${s.slowest.passages} passage${s.slowest.passages > 1 ? "s" : ""}`,
    });
  }
  if (s.returnRate !== null && s.returnRate > 0) {
    out.push({
      tone: s.returnRate >= 0.15 ? "w" : "i",
      title: `${Math.round(s.returnRate * 100)} % des dossiers reviennent en arrière`,
      detail: s.topReturnReason ? `motif le plus fréquent : ${s.topReturnReason}` : "aucun motif noté",
    });
  }
  if (medianeCircuit !== null) {
    let lent: { nom: string; m: number; n: number } | null = null;
    for (const [nom, d] of parActeur) {
      if (d.length < 3) continue;
      const m = median(d) ?? 0;
      if (m < 1 || m < medianeCircuit * 1.5) continue;
      if (!lent || m > lent.m) lent = { nom, m, n: d.length };
    }
    if (lent) {
      out.push({
        tone: "i",
        title: `${lent.nom} répond en ${formatJours(lent.m)} en médiane`,
        detail: `${lent.n} décisions · médiane du circuit ${formatJours(medianeCircuit)}`,
      });
    }
  }
  if (s.stuck.length > 0 && out.length < 3) {
    const sla = s.stuck.filter((x) => x.sla).length;
    out.push({
      tone: "w",
      title: `${s.stuck.length} dossier${s.stuck.length > 1 ? "s" : ""} en cours bloqué${s.stuck.length > 1 ? "s" : ""}`,
      detail: sla ? `${sla} au-delà du délai fixé pour leur étape` : "au-delà de la limite par défaut",
    });
  }
  return out.slice(0, 3);
}

/** Temps de réponse par personne : chaque segment fermé par elle est une réponse. */
export function responseTimesByActor(cases: readonly MiningCase[], since: Date, now: Date = new Date()): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const c of cases) {
    for (const s of segmentsOf(c, now).segments) {
      if (!s.actor || s.end < since || s.step === CORRECTION_STEP) continue;
      const a = out.get(s.actor) ?? [];
      a.push(s.days);
      out.set(s.actor, a);
    }
  }
  return out;
}

/** « 4,8 j », « 11 j », « 6 h » — la durée telle qu'on la lit. */
export function formatJours(d: number | null | undefined): string {
  if (d === null || d === undefined || Number.isNaN(d)) return "—";
  if (d < 1) {
    const h = Math.round(d * 24);
    return h <= 0 ? "< 1 h" : `${h} h`;
  }
  if (d >= 10) return `${Math.round(d)} j`;
  return `${d.toFixed(1).replace(".", ",")} j`;
}

/** Une couleur par lenteur relative (barres « temps par étape »). */
export function lenteur(medianDays: number, max: number, slaDays: number | null = null): "lent" | "moyen" | "normal" {
  if (slaDays !== null && medianDays > slaDays) return "lent";
  if (max <= 0) return "normal";
  const r = medianDays / max;
  return r >= 0.85 ? "lent" : r >= 0.3 ? "moyen" : "normal";
}
