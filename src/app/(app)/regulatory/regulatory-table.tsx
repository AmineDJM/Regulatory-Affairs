"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Filter } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { PRIORITY, REGULATORY_STATUS, REGULATORY_CATEGORY, MANUFACTURING_STATUS } from "@/lib/labels";
import { formatDate, daysUntil } from "@/lib/utils";
import { setRegulatoryPriority } from "@/lib/actions/regulatory-actions";

export type RegStage = "new" | "in_progress" | "done";

export interface RegulatoryRow {
  id: string;
  reference: string;
  dci: string;
  brandName: string;
  dosage: string;
  form: string;
  therapeuticClass: string;
  supplier: string;
  category: string;
  /** Niveau de process qui FAIT FOI (variation obtenue prioritaire sur la déclaration). */
  manufacturingStatus: string;
  /** D'où vient ce niveau : « DECLARED » (fiche) ou « VARIATION » (décision obtenue). */
  manufacturingSource: string;
  /** Variation déposée et en attente de décision, le cas échéant. */
  manufacturingPending: string | null;
  status: string;
  priority: string;
  responsible: string;
  assistant: string;
  targetSubmissionDate: string | null;
  targetDate: string | null;
  progress: number;
  stepsDone: number;
  stepsTotal: number;
  stage: RegStage;
}

const STAGES: { key: RegStage; label: string; hint: string }[] = [
  { key: "new", label: "Nouveau / Non traités", hint: "Avant la demande de BV de présoumission" },
  { key: "in_progress", label: "En cours de traitement", hint: "BV de présoumission demandée → en cours" },
  { key: "done", label: "Traitement terminé", hint: "Décision d'enregistrement (DE) obtenue" },
];

const lbl = (m: Record<string, unknown>, v: string): string => {
  const e = m[v];
  return (typeof e === "string" ? e : (e as { label?: string })?.label) ?? v;
};
const PRIORITY_OPTS = Object.keys(PRIORITY).map((v) => ({ value: v, label: lbl(PRIORITY as never, v) }));
const STATUS_OPTS = Object.keys(REGULATORY_STATUS).map((v) => ({ value: v, label: lbl(REGULATORY_STATUS as never, v) }));
const CATEGORY_OPTS = Object.keys(REGULATORY_CATEGORY).map((v) => ({ value: v, label: lbl(REGULATORY_CATEGORY as never, v) }));
const STAGE_OPTS = Object.keys(MANUFACTURING_STATUS).map((v) => ({ value: v, label: MANUFACTURING_STATUS[v] }));

type Col = {
  key: string;
  header: string;
  text: (r: RegulatoryRow) => string; // valeur texte (recherche + filtre + tri)
  raw?: (r: RegulatoryRow) => string; // valeur brute pour un filtre « select »
  options?: { value: string; label: string }[]; // filtre déroulant façon Excel
  /** Rendu enrichi ; à défaut, `text` est affiché tel quel. */
  cell?: (r: RegulatoryRow) => React.ReactNode;
};

const COLS: Col[] = [
  { key: "reference", header: "Référence", text: (r) => r.reference },
  { key: "dci", header: "DCI / Marque", text: (r) => `${r.dci} ${r.brandName}` },
  { key: "dosage", header: "Dosage / Forme", text: (r) => [r.dosage, r.form].filter(Boolean).join(" · ") },
  { key: "therapeuticClass", header: "Classe thérapeutique", text: (r) => r.therapeuticClass },
  { key: "category", header: "Catégorie", text: (r) => lbl(REGULATORY_CATEGORY as never, r.category), raw: (r) => r.category, options: CATEGORY_OPTS },
  { key: "supplier", header: "Fournisseur", text: (r) => r.supplier },
  {
    key: "manufacturingStatus", header: "Niveau de process",
    text: (r) => MANUFACTURING_STATUS[r.manufacturingStatus] ?? r.manufacturingStatus,
    raw: (r) => r.manufacturingStatus, options: STAGE_OPTS,
    cell: (r) => <StageCell row={r} />,
  },
  { key: "priority", header: "Priorité", text: (r) => lbl(PRIORITY as never, r.priority), raw: (r) => r.priority, options: PRIORITY_OPTS },
  { key: "status", header: "Statut", text: (r) => lbl(REGULATORY_STATUS as never, r.status), raw: (r) => r.status, options: STATUS_OPTS },
  { key: "responsible", header: "Responsable", text: (r) => r.responsible },
  { key: "targetSubmissionDate", header: "Date cible dépôt", text: (r) => r.targetSubmissionDate ?? "" },
  { key: "targetDate", header: "Date cible enreg.", text: (r) => r.targetDate ?? "" },
];

/** Teinte de la priorité (Critique = rouge, Haute = ambre, Moyenne = bleu, Basse = neutre). */
const PRIORITY_CLASS: Record<string, string> = {
  CRITICAL: "border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-300",
  HIGH: "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300",
  MEDIUM: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300",
  LOW: "border-input bg-background text-muted-foreground",
};

export function RegulatoryTable({ rows, canEditPriority = false }: { rows: RegulatoryRow[]; canEditPriority?: boolean }) {
  const router = useRouter();
  const [stage, setStage] = React.useState<RegStage>("new");
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const counts = React.useMemo(() => ({
    new: rows.filter((r) => r.stage === "new").length,
    in_progress: rows.filter((r) => r.stage === "in_progress").length,
    done: rows.filter((r) => r.stage === "done").length,
  }), [rows]);

  const filtered = React.useMemo(() => rows.filter((r) => {
    if (r.stage !== stage) return false;
    for (const c of COLS) {
      const f = filters[c.key]?.trim();
      if (!f) continue;
      if (c.options) { if ((c.raw?.(r) ?? "") !== f) return false; }
      else if (!c.text(r).toLowerCase().includes(f.toLowerCase())) return false;
    }
    return true;
  }), [rows, stage, filters]);

  const anyFilter = Object.values(filters).some((v) => v && v.trim());

  async function changePriority(id: string, priority: string) {
    setBusyId(id);
    const fd = new FormData(); fd.set("id", id); fd.set("priority", priority);
    await setRegulatoryPriority(fd);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Onglets des 3 étapes */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button key={s.key} type="button" onClick={() => setStage(s.key)} title={s.hint}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${stage === s.key ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-secondary"}`}>
            {s.label} <span className="ml-1 rounded-full bg-secondary px-1.5 text-xs">{counts[s.key]}</span>
          </button>
        ))}
        {anyFilter && (
          <button type="button" onClick={() => setFilters({})} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-2 text-xs text-muted-foreground hover:bg-secondary">
            <Filter className="h-3.5 w-3.5" /> Effacer les filtres
          </button>
        )}
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {COLS.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">{c.header}</th>)}
            </tr>
            {/* Ligne de filtres façon Excel */}
            <tr className="border-b border-border">
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-1.5">
                  {(c.key === "targetDate" || c.key === "targetSubmissionDate") ? null : c.options ? (
                    <select value={filters[c.key] ?? ""} onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                      className="h-7 w-full rounded border border-input bg-background px-1 text-xs font-normal normal-case">
                      <option value="">Tous</option>
                      {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={filters[c.key] ?? ""} onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))} placeholder="Filtrer…"
                      className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs font-normal normal-case" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={COLS.length} className="px-3 py-8 text-center text-muted-foreground">Aucun dossier dans cette catégorie{anyFilter ? " (avec ces filtres)" : ""}.</td></tr>
            ) : filtered.map((r) => {
              const d = r.targetDate ? daysUntil(r.targetDate) : null;
              return (
                <tr key={r.id} onClick={() => router.push(`/regulatory/${r.id}`)} className="cursor-pointer border-b border-border/60 hover:bg-secondary/40">
                  <td className="px-3 py-2 font-mono text-xs font-medium">{r.reference}</td>
                  <td className="px-3 py-2"><p className="font-medium">{r.dci}</p>{r.brandName && <p className="text-xs text-muted-foreground">{r.brandName}</p>}</td>
                  <td className="px-3 py-2 text-muted-foreground">{[r.dosage, r.form].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2">{r.therapeuticClass || "—"}</td>
                  <td className="px-3 py-2"><StatusBadge map={REGULATORY_CATEGORY} value={r.category} dot={false} /></td>
                  <td className="px-3 py-2">{r.supplier || "—"}</td>
                  <td className="px-3 py-2"><StageCell row={r} /></td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {canEditPriority ? (
                      <span className="inline-flex items-center gap-1">
                        <select value={r.priority} onChange={(e) => changePriority(r.id, e.target.value)} disabled={busyId === r.id}
                          className={`h-7 rounded border px-1 text-xs font-medium ${PRIORITY_CLASS[r.priority] ?? "border-input bg-background"}`}>
                          {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {busyId === r.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </span>
                    ) : <StatusBadge map={PRIORITY} value={r.priority} />}
                  </td>
                  <td className="px-3 py-2"><StatusBadge map={REGULATORY_STATUS} value={r.status} /></td>
                  <td className="px-3 py-2">{r.responsible || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.targetSubmissionDate ? formatDate(r.targetSubmissionDate) : "—"}</td>
                  <td className={`px-3 py-2 ${d !== null && d < 0 ? "text-destructive" : ""}`}>{r.targetDate ? formatDate(r.targetDate) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Teinte du niveau : plus la fabrication est locale, plus la pastille est « verte ». */
const STAGE_CLASS: Record<string, string> = {
  IMPORTATION: "border-input bg-background text-muted-foreground",
  SECONDARY_PACKAGING: "border-blue-300 bg-blue-50 text-blue-700",
  PRIMARY_PACKAGING: "border-teal-300 bg-teal-50 text-teal-700",
  FULL_PROCESS: "border-emerald-400 bg-emerald-50 text-emerald-700",
};

/**
 * NIVEAU DE PROCESS d'un produit. La pastille montre le niveau **qui fait foi** ; le petit
 * texte dessous dit **d'où il vient** — c'est la question qu'on se pose vraiment : est-ce une
 * simple déclaration sur la fiche, ou une variation réellement OBTENUE auprès de l'ANPP ?
 * Une variation encore en attente est signalée sans jamais être comptée comme acquise.
 */
function StageCell({ row }: { row: RegulatoryRow }) {
  const label = MANUFACTURING_STATUS[row.manufacturingStatus] ?? row.manufacturingStatus;
  const fromVariation = row.manufacturingSource === "VARIATION";
  return (
    <div className="space-y-0.5">
      <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STAGE_CLASS[row.manufacturingStatus] ?? STAGE_CLASS.IMPORTATION}`}>
        {label}
      </span>
      <p className="text-[11px] text-muted-foreground">
        {fromVariation ? "variation obtenue" : "déclaré"}
        {row.manufacturingPending && (
          <>
            {" · "}
            <span className="text-warning">
              {MANUFACTURING_STATUS[row.manufacturingPending] ?? row.manufacturingPending} en cours
            </span>
          </>
        )}
      </p>
    </div>
  );
}
