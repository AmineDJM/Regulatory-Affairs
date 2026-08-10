"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Filter, Columns3 } from "lucide-react";
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
  /** Niveau industriel qui FAIT FOI (variation obtenue prioritaire sur la déclaration). */
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
};

// TITRES voulus par le métier : « Statut » = importation / packaging / full process (la
// profondeur industrielle), « Niveau de process » = pré-soumission / déposé / … (l'avancement
// de la procédure). Les contenus ne bougent pas — seuls les intitulés étaient inversés.
const COLS: Col[] = [
  { key: "reference", header: "Référence", text: (r) => r.reference },
  { key: "dci", header: "DCI / Marque", text: (r) => `${r.dci} ${r.brandName}` },
  { key: "dosage", header: "Dosage / Forme", text: (r) => [r.dosage, r.form].filter(Boolean).join(" · ") },
  { key: "therapeuticClass", header: "Classe thérapeutique", text: (r) => r.therapeuticClass },
  { key: "category", header: "Catégorie", text: (r) => lbl(REGULATORY_CATEGORY as never, r.category), raw: (r) => r.category, options: CATEGORY_OPTS },
  { key: "supplier", header: "Fournisseur", text: (r) => r.supplier },
  {
    key: "manufacturingStatus", header: "Statut",
    text: (r) => MANUFACTURING_STATUS[r.manufacturingStatus] ?? r.manufacturingStatus,
    raw: (r) => r.manufacturingStatus, options: STAGE_OPTS,
  },
  { key: "priority", header: "Priorité", text: (r) => lbl(PRIORITY as never, r.priority), raw: (r) => r.priority, options: PRIORITY_OPTS },
  { key: "status", header: "Niveau de process", text: (r) => lbl(REGULATORY_STATUS as never, r.status), raw: (r) => r.status, options: STATUS_OPTS },
  { key: "responsible", header: "Responsable", text: (r) => r.responsible },
  { key: "targetSubmissionDate", header: "Date cible dépôt", text: (r) => r.targetSubmissionDate ?? "" },
  { key: "targetDate", header: "Date cible enreg.", text: (r) => r.targetDate ?? "" },
];

/** Préférence LOCALE de colonnes masquées (par navigateur) — clé de stockage. */
const HIDDEN_COLS_KEY = "amd-reg-hidden-cols";

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
  // Colonnes masquées : préférence PAR NAVIGATEUR, chargée après montage (pas de désaccord
  // d'hydratation) — tout est visible par défaut.
  const [hiddenCols, setHiddenCols] = React.useState<string[]>([]);
  const [colsOpen, setColsOpen] = React.useState(false);
  const colsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HIDDEN_COLS_KEY);
      if (!raw) return;
      const arr: unknown = JSON.parse(raw);
      if (Array.isArray(arr)) setHiddenCols(arr.filter((k): k is string => typeof k === "string" && COLS.some((c) => c.key === k)));
    } catch {
      /* préférence illisible → tout visible */
    }
  }, []);

  React.useEffect(() => {
    if (!colsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [colsOpen]);

  const toggleCol = (key: string) => {
    const hiding = !hiddenCols.includes(key);
    const next = hiding ? [...hiddenCols, key] : hiddenCols.filter((k) => k !== key);
    if (next.length >= COLS.length) return; // toujours au moins une colonne visible
    setHiddenCols(next);
    try { window.localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(next)); } catch { /* stockage local indisponible */ }
    // Masquer une colonne retire aussi son filtre : un filtre invisible qui vide la liste
    // serait incompréhensible.
    if (hiding) setFilters((f) => ({ ...f, [key]: "" }));
  };

  const visibleCols = COLS.filter((c) => !hiddenCols.includes(c.key));

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

  /** Cellule d'une ligne pour une colonne — même rendu qu'avant, mais pilotable colonne par colonne. */
  function cellFor(key: string, r: RegulatoryRow): React.ReactNode {
    switch (key) {
      case "reference":
        return <td key={key} className="px-3 py-2 font-mono text-xs font-medium">{r.reference}</td>;
      case "dci":
        return <td key={key} className="px-3 py-2"><p className="font-medium">{r.dci}</p>{r.brandName && <p className="text-xs text-muted-foreground">{r.brandName}</p>}</td>;
      case "dosage":
        return <td key={key} className="px-3 py-2 text-muted-foreground">{[r.dosage, r.form].filter(Boolean).join(" · ") || "—"}</td>;
      case "therapeuticClass":
        return <td key={key} className="px-3 py-2">{r.therapeuticClass || "—"}</td>;
      case "category":
        return <td key={key} className="px-3 py-2"><StatusBadge map={REGULATORY_CATEGORY} value={r.category} dot={false} /></td>;
      case "supplier":
        return <td key={key} className="px-3 py-2">{r.supplier || "—"}</td>;
      case "manufacturingStatus":
        return <td key={key} className="px-3 py-2"><StageCell row={r} /></td>;
      case "priority":
        return (
          <td key={key} className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
        );
      case "status":
        return <td key={key} className="px-3 py-2"><StatusBadge map={REGULATORY_STATUS} value={r.status} /></td>;
      case "responsible":
        return <td key={key} className="px-3 py-2">{r.responsible || "—"}</td>;
      case "targetSubmissionDate":
        return <td key={key} className="px-3 py-2 text-muted-foreground">{r.targetSubmissionDate ? formatDate(r.targetSubmissionDate) : "—"}</td>;
      case "targetDate": {
        const d = r.targetDate ? daysUntil(r.targetDate) : null;
        return <td key={key} className={`px-3 py-2 ${d !== null && d < 0 ? "text-destructive" : ""}`}>{r.targetDate ? formatDate(r.targetDate) : "—"}</td>;
      }
      default:
        return <td key={key} className="px-3 py-2" />;
    }
  }

  return (
    <div className="space-y-3">
      {/* Onglets des 3 étapes + réglage des colonnes */}
      <div className="flex flex-wrap items-center gap-2">
        {STAGES.map((s) => (
          <button key={s.key} type="button" onClick={() => setStage(s.key)} title={s.hint}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${stage === s.key ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-secondary"}`}>
            {s.label} <span className="ml-1 rounded-full bg-secondary px-1.5 text-xs">{counts[s.key]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {anyFilter && (
            <button type="button" onClick={() => setFilters({})} className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-2 text-xs text-muted-foreground hover:bg-secondary">
              <Filter className="h-3.5 w-3.5" /> Effacer les filtres
            </button>
          )}
          {/* Masquer / démasquer chaque colonne — préférence mémorisée par navigateur. */}
          <div ref={colsRef} className="relative">
            <button type="button" onClick={() => setColsOpen((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs transition-colors ${hiddenCols.length > 0 ? "border-primary/50 text-primary" : "border-input text-muted-foreground"} hover:bg-secondary`}>
              <Columns3 className="h-3.5 w-3.5" /> Colonnes{hiddenCols.length > 0 ? ` (${hiddenCols.length} masquée·s)` : ""}
            </button>
            {colsOpen && (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-2 shadow-md">
                <p className="px-1 pb-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Colonnes affichées</p>
                <ul className="max-h-72 space-y-0.5 overflow-y-auto">
                  {COLS.map((c) => {
                    const visible = !hiddenCols.includes(c.key);
                    const lastVisible = visible && visibleCols.length === 1;
                    return (
                      <li key={c.key}>
                        <label className={`flex items-center gap-2 rounded px-1.5 py-1 text-sm ${lastVisible ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-secondary"}`}>
                          <input type="checkbox" checked={visible} disabled={lastVisible} onChange={() => toggleCol(c.key)} className="h-3.5 w-3.5" />
                          {c.header}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {visibleCols.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">{c.header}</th>)}
            </tr>
            {/* Ligne de filtres façon Excel */}
            <tr className="border-b border-border">
              {visibleCols.map((c) => (
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
              <tr><td colSpan={visibleCols.length} className="px-3 py-8 text-center text-muted-foreground">Aucun dossier dans cette catégorie{anyFilter ? " (avec ces filtres)" : ""}.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/regulatory/${r.id}`)} className="cursor-pointer border-b border-border/60 hover:bg-secondary/40">
                {visibleCols.map((c) => cellFor(c.key, r))}
              </tr>
            ))}
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
 * « STATUT » (vocabulaire métier) = niveau industriel d'un produit. La pastille montre le niveau
 * **qui fait foi** ; le petit texte dessous dit **d'où il vient** — c'est la question qu'on se
 * pose vraiment : est-ce une simple déclaration sur la fiche, ou une variation réellement
 * OBTENUE auprès de l'ANPP ? Une variation encore en attente est signalée sans jamais être
 * comptée comme acquise.
 */
function StageCell({ row }: { row: RegulatoryRow }) {
  const label = MANUFACTURING_STATUS[row.manufacturingStatus] ?? row.manufacturingStatus;
  const fromVariation = row.manufacturingSource === "VARIATION";
  return (
    <div className="space-y-0.5">
      <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STAGE_CLASS[row.manufacturingStatus] ?? STAGE_CLASS.IMPORTATION}`}>
        {label}
      </span>
      <p className="text-[0.6875rem] text-muted-foreground">
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
