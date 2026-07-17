"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Sparkles, Wand2, Package } from "lucide-react";
import { addTenderLine, updateTenderLine, deleteTenderLine, analyzeTenderText, enrichTenderLine } from "@/lib/actions/pch-tender-line-actions";
import type { PchTenderLineDTO } from "@/lib/queries/pch";

type Res = { ok: boolean; error?: string };
const inp = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";
const LINE_STATUS: { value: string; label: string }[] = [
  { value: "PENDING", label: "À étudier" }, { value: "QUOTED", label: "Chiffré" },
  { value: "SUBMITTED", label: "Soumissionné" }, { value: "WON", label: "Gagné" }, { value: "LOST", label: "Perdu" },
];
const fmt = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("fr-FR").format(n));

export function TenderLines({ tenderId, lines, canEdit, aiConfigured }: { tenderId: string; lines: PchTenderLineDTO[]; canEdit: boolean; aiConfigured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [showAnalyze, setShowAnalyze] = React.useState(false);

  async function run(fn: () => Promise<Res>) {
    if (busy) return; setBusy(true);
    const r = await fn(); setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    router.refresh();
  }
  async function analyze() {
    if (!text.trim()) return;
    setAnalyzing(true);
    const fd = new FormData(); fd.set("tenderId", tenderId); fd.set("text", text.trim());
    const r: Res = await analyzeTenderText(fd);
    setAnalyzing(false);
    if (!r.ok) { window.alert(r.error ?? "Analyse impossible."); return; }
    setText(""); setShowAnalyze(false); router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Package className="h-4 w-4 text-primary" /> Produits du marché ({lines.length})</h3>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowAnalyze((s) => !s)} disabled={!aiConfigured}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50" title={aiConfigured ? "Extraire les produits du document (OCR → IA)" : "IA non configurée"}>
              <Wand2 className="h-4 w-4" /> Analyser le document (IA)
            </button>
            <button type="button" disabled={busy} onClick={() => { const fd = new FormData(); fd.set("tenderId", tenderId); run(() => addTenderLine(fd)); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60"><Plus className="h-4 w-4" /> Ajouter</button>
          </div>
        )}
      </div>

      {showAnalyze && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Collez le <strong>texte du document d'appel d'offres</strong> (issu de l'OCR Mistral) — l'IA en extrait la liste des produits, dosages, formes et quantités.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Texte de l'appel d'offres…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <div className="flex gap-2">
            <button type="button" onClick={analyze} disabled={analyzing || !text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Extraire les produits
            </button>
            <button type="button" onClick={() => setShowAnalyze(false)} disabled={analyzing} className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-secondary">Annuler</button>
          </div>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Aucun produit. {canEdit && "Analysez le document ou ajoutez des lignes manuellement."}</p>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => <LineCard key={l.id} tenderId={tenderId} line={l} canEdit={canEdit} busy={busy} run={run} />)}
        </div>
      )}
    </div>
  );
}

function LineCard({ tenderId, line, canEdit, busy, run }: { tenderId: string; line: PchTenderLineDTO; canEdit: boolean; busy: boolean; run: (fn: () => Promise<Res>) => void }) {
  const [s, setS] = React.useState({
    designation: line.designation, dci: line.dci ?? "", dosage: line.dosage ?? "", form: line.form ?? "",
    quantityUnits: String(line.quantityUnits || ""), unitsPerBox: line.unitsPerBox != null ? String(line.unitsPerBox) : "",
    haveProduct: line.haveProduct, unitPriceDzd: line.unitPriceDzd != null ? String(line.unitPriceDzd) : "",
    status: line.status, awardedUnitPriceDzd: line.awardedUnitPriceDzd != null ? String(line.awardedUnitPriceDzd) : "",
    suppliersInfo: line.suppliersInfo ?? "", note: line.note ?? "",
  });
  const boxes = (() => { const q = Number(s.quantityUnits) || 0; const n = Number(s.unitsPerBox) || 0; return n > 0 ? Math.ceil(q / n) : null; })();

  function save() {
    const fd = new FormData();
    fd.set("id", line.id); fd.set("tenderId", tenderId);
    fd.set("designation", s.designation); fd.set("dci", s.dci); fd.set("dosage", s.dosage); fd.set("form", s.form);
    fd.set("quantityUnits", s.quantityUnits); fd.set("unitsPerBox", s.unitsPerBox);
    if (s.haveProduct) fd.set("haveProduct", "on");
    fd.set("unitPriceDzd", s.unitPriceDzd); fd.set("status", s.status); fd.set("awardedUnitPriceDzd", s.awardedUnitPriceDzd);
    fd.set("suppliersInfo", s.suppliersInfo); fd.set("note", s.note);
    run(() => updateTenderLine(fd));
  }

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{line.designation}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{LINE_STATUS.find((x) => x.value === line.status)?.label ?? line.status}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{[line.dci, line.dosage, line.form].filter(Boolean).join(" · ") || "—"} · {fmt(line.quantityUnits)} unités{line.boxesNeeded ? ` = ${fmt(line.boxesNeeded)} boîtes` : ""}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <input className={`${inp} sm:col-span-6`} value={s.designation} onChange={(e) => setS({ ...s, designation: e.target.value })} onBlur={save} placeholder="Désignation produit" />
        <input className={`${inp} sm:col-span-3`} value={s.dci} onChange={(e) => setS({ ...s, dci: e.target.value })} onBlur={save} placeholder="DCI" />
        <select className={`${inp} sm:col-span-3`} value={s.status} onChange={(e) => { setS({ ...s, status: e.target.value }); }} onBlur={save}>
          {LINE_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input className={`${inp} sm:col-span-3`} value={s.dosage} onChange={(e) => setS({ ...s, dosage: e.target.value })} onBlur={save} placeholder="Dosage" />
        <input className={`${inp} sm:col-span-3`} value={s.form} onChange={(e) => setS({ ...s, form: e.target.value })} onBlur={save} placeholder="Forme" />
        <input className={`${inp} sm:col-span-3`} inputMode="numeric" value={s.quantityUnits} onChange={(e) => setS({ ...s, quantityUnits: e.target.value })} onBlur={save} placeholder="Quantité (unités)" />
        <div className="flex items-center gap-1 sm:col-span-3">
          <input className={inp} inputMode="numeric" value={s.unitsPerBox} onChange={(e) => setS({ ...s, unitsPerBox: e.target.value })} onBlur={save} placeholder="Boîte de N" />
          <span className="whitespace-nowrap text-xs font-medium text-primary">{boxes != null ? `= ${fmt(boxes)} bt` : ""}</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs sm:col-span-3"><input type="checkbox" checked={s.haveProduct} onChange={(e) => { setS({ ...s, haveProduct: e.target.checked }); }} onBlur={save} className="h-4 w-4 rounded border-input" /> Nous l'avons</label>
        <input className={`${inp} sm:col-span-3`} inputMode="decimal" value={s.unitPriceDzd} onChange={(e) => setS({ ...s, unitPriceDzd: e.target.value })} onBlur={save} placeholder="Prix unité (DZD)" />
        <input className={`${inp} sm:col-span-3`} inputMode="decimal" value={s.awardedUnitPriceDzd} onChange={(e) => setS({ ...s, awardedUnitPriceDzd: e.target.value })} onBlur={save} placeholder="Prix attribué (DZD)" />
        <input className={`${inp} sm:col-span-9`} value={s.suppliersInfo} onChange={(e) => setS({ ...s, suppliersInfo: e.target.value })} onBlur={save} placeholder="Nos fournisseurs + prix / notes marché" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {line.competitorCount != null && <span className="rounded bg-secondary px-2 py-0.5">Concurrents : <strong>{line.competitorCount}</strong></span>}
        <span className={`rounded px-2 py-0.5 ${line.registeredNomenclature ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>Nomenclature : {line.registeredNomenclature ? `oui (${line.nomLines ?? 0})` : "non"}</span>
        {line.marketEstimateDzd != null && <span className="rounded bg-secondary px-2 py-0.5">Marché ≈ {fmt(line.marketEstimateDzd)} DZD</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" disabled={busy} onClick={() => { const fd = new FormData(); fd.set("id", line.id); fd.set("tenderId", tenderId); run(() => enrichTenderLine(fd)); }}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-primary hover:bg-primary/10" title="Enrichir depuis l'intelligence marché (concurrents, nomenclature, estimation)"><Sparkles className="h-3.5 w-3.5" /> Enrichir</button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Supprimer « ${line.designation} » ?`)) { const fd = new FormData(); fd.set("id", line.id); fd.set("tenderId", tenderId); run(() => deleteTenderLine(fd)); } }}
            className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
