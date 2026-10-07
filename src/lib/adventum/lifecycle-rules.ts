/**
 * LA VIE D'UN RISQUE — les règles, pures (Adventum Brain, refonte 07/10).
 *
 * Avant, les mêmes risques revenaient chaque heure, sans mémoire : rien ne disait qu'on s'en occupait déjà, ni
 * qu'un risque avait disparu. Désormais, chaque risque a une CLÉ stable (détecteur + objet) et un état :
 *
 *   NOUVEAU ──prendre en charge──▶ PRIS_EN_CHARGE ──┐
 *      │                                            ├──le détecteur ne le voit plus──▶ RESOLU (automatique)
 *      ├──ignorer jusqu'au…──▶ IGNORE ──────────────┘
 *      └──marquer résolu──▶ RESOLU (par une personne)
 *
 *   • un risque IGNORÉ dont la date est passée et que le détecteur voit toujours redevient NOUVEAU ;
 *   • un risque RÉSOLU qui réapparaît redevient NOUVEAU — tout de suite s'il avait été résolu automatiquement,
 *     après un délai de grâce s'il a été marqué résolu par une personne (le temps que la donnée suive le geste) ;
 *   • un risque NOUVEAU, PRIS EN CHARGE ou IGNORÉ que le détecteur ne voit plus est résolu automatiquement.
 */

export type BrainStatus = "NOUVEAU" | "PRIS_EN_CHARGE" | "RESOLU" | "IGNORE";

export const BRAIN_STATUS_LABEL: Record<BrainStatus, string> = {
  NOUVEAU: "nouveau",
  PRIS_EN_CHARGE: "pris en charge",
  RESOLU: "résolu",
  IGNORE: "ignoré",
};

export type HistoryKind = "apparu" | "pris_en_charge" | "relance" | "ignore" | "resolu" | "resolu_auto" | "reapparu" | "reveil";

export interface HistoryEntry {
  at: string;
  kind: HistoryKind;
  by?: string | null;
  note?: string | null;
}

export const HISTORY_LABEL: Record<HistoryKind, string> = {
  apparu: "Détecté",
  pris_en_charge: "Pris en charge",
  relance: "Relancé",
  ignore: "Ignoré",
  resolu: "Marqué résolu",
  resolu_auto: "Résolu (le détecteur ne le voit plus)",
  reapparu: "Réapparu",
  reveil: "Fin de la période ignorée",
};

export interface ExistingRisk {
  key: string;
  status: BrainStatus;
  snoozedUntil: Date | null;
  resolvedAt: Date | null;
  resolvedAuto: boolean;
}

export type ReconcileOp =
  | { op: "create"; key: string; history: HistoryEntry }
  | { op: "refresh"; key: string; status: BrainStatus; history?: HistoryEntry; reopen?: boolean; clearSnooze?: boolean }
  | { op: "resolve"; key: string; history: HistoryEntry };

/** Délai de grâce avant de rouvrir un risque marqué résolu par une personne et toujours vu par le détecteur. */
export const DUREE_GRACE_RESOLUTION_MS = 24 * 3_600_000;

export function reconcile(existing: readonly ExistingRisk[], detectedKeys: readonly string[], now: Date, opts: { graceMs?: number } = {}): ReconcileOp[] {
  const grace = opts.graceMs ?? DUREE_GRACE_RESOLUTION_MS;
  const at = now.toISOString();
  const detectes = new Set(detectedKeys);
  const parCle = new Map(existing.map((e) => [e.key, e]));
  const ops: ReconcileOp[] = [];

  for (const key of detectes) {
    const e = parCle.get(key);
    if (!e) { ops.push({ op: "create", key, history: { at, kind: "apparu" } }); continue; }
    switch (e.status) {
      case "NOUVEAU":
      case "PRIS_EN_CHARGE":
        ops.push({ op: "refresh", key, status: e.status });
        break;
      case "IGNORE":
        if (e.snoozedUntil && e.snoozedUntil.getTime() > now.getTime()) ops.push({ op: "refresh", key, status: "IGNORE" });
        else ops.push({ op: "refresh", key, status: "NOUVEAU", clearSnooze: true, history: { at, kind: "reveil" } });
        break;
      case "RESOLU": {
        const attendre = !e.resolvedAuto && e.resolvedAt && now.getTime() - e.resolvedAt.getTime() < grace;
        if (attendre) ops.push({ op: "refresh", key, status: "RESOLU" });
        else ops.push({ op: "refresh", key, status: "NOUVEAU", reopen: true, history: { at, kind: "reapparu" } });
        break;
      }
    }
  }
  for (const e of existing) {
    if (detectes.has(e.key) || e.status === "RESOLU") continue;
    ops.push({ op: "resolve", key: e.key, history: { at, kind: "resolu_auto" } });
  }
  return ops;
}

/** L'état tel qu'on l'affiche dans la colonne « État ». */
export function libelleEtat(r: { status: BrainStatus; snoozedUntil: Date | string | null; taskId?: string | null }): string {
  if (r.status === "IGNORE" && r.snoozedUntil) {
    const d = new Date(r.snoozedUntil);
    return `ignoré jusqu'au ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Algiers" })}`;
  }
  if (r.status === "PRIS_EN_CHARGE") return r.taskId ? "pris en charge — tâche créée" : "pris en charge";
  return BRAIN_STATUS_LABEL[r.status];
}
