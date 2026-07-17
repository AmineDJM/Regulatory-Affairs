"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  addResearchRow, updateResearchRow, deleteResearchRow,
  addResearchPlayer, updateResearchPlayer, deleteResearchPlayer,
} from "@/lib/actions/market-research-actions";
import type { ResearchRowDTO } from "@/lib/queries/market-research";

const STATUS_LABEL: Record<string, string> = { IMPORT: "Importation", MANUFACTURING: "Fabrication" };
const inp = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none";
const nOrNull = (s: string) => { const t = s.trim(); if (!t) return ""; return t; };

export function ResearchTable({ researchId, rows, canEdit }: { researchId: string; rows: ResearchRowDTO[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData, refresh = true) {
    setBusy(true);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    if (refresh) router.refresh();
  }

  const th = "whitespace-nowrap px-2 py-2 text-left text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-3 p-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className={`${th} w-8`}>N</th>
              <th className={`${th} w-40`}>Classe thérapeutique</th>
              <th className={`${th} w-44`}>Produit</th>
              <th className={`${th} w-28`}>Marché (volume)</th>
              <th className={`${th} w-28`}>Marché ($)</th>
              <th className={`${th} w-24`}>Prix/boîte $</th>
              <th className={`${th} w-14`}>Acteurs</th>
              <th className={`${th} min-w-[320px]`}>Acteurs & parts de marché (Import / Fabrication)</th>
              <th className={`${th} w-40`}>Commentaires</th>
              <th className={`${th} w-8`}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-4 text-center text-muted-foreground">Aucune molécule. {canEdit && "Ajoutez une ligne ci-dessous."}</td></tr>
            )}
            {rows.map((row, i) => (
              <RowEditor key={row.id} researchId={researchId} row={row} index={i + 1} canEdit={canEdit} onStruct={() => router.refresh()} busy={busy} run={run} />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => { const fd = new FormData(); fd.set("researchId", researchId); run(addResearchRow, fd); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter une molécule
        </button>
      )}
    </div>
  );
}

function RowEditor({
  researchId, row, index, canEdit, run, busy,
}: {
  researchId: string; row: ResearchRowDTO; index: number; canEdit: boolean; onStruct: () => void; busy: boolean;
  run: (a: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData, refresh?: boolean) => void;
}) {
  const [s, setS] = React.useState({
    therapeuticClass: row.therapeuticClass ?? "",
    product: row.product,
    marketVolume: row.marketVolume != null ? String(row.marketVolume) : "",
    marketValueUsd: row.marketValueUsd != null ? String(row.marketValueUsd) : "",
    avgPricePerBoxUsd: row.avgPricePerBoxUsd != null ? String(row.avgPricePerBoxUsd) : "",
    comment: row.comment ?? "",
  });

  function saveRow() {
    const fd = new FormData();
    fd.set("id", row.id); fd.set("researchId", researchId);
    fd.set("therapeuticClass", s.therapeuticClass); fd.set("product", s.product);
    fd.set("marketVolume", nOrNull(s.marketVolume)); fd.set("marketValueUsd", nOrNull(s.marketValueUsd));
    fd.set("avgPricePerBoxUsd", nOrNull(s.avgPricePerBoxUsd)); fd.set("comment", s.comment);
    run(updateResearchRow, fd, false);
  }
  const ro = (v: string) => <span>{v || "—"}</span>;
  const cell = "border-b border-border/60 px-1.5 py-1 align-top";

  return (
    <tr className="hover:bg-secondary/20">
      <td className={`${cell} text-center text-xs text-muted-foreground`}>{index}</td>
      <td className={cell}>{canEdit ? <input className={inp} value={s.therapeuticClass} onChange={(e) => setS({ ...s, therapeuticClass: e.target.value })} onBlur={saveRow} /> : ro(s.therapeuticClass)}</td>
      <td className={cell}>{canEdit ? <input className={inp} value={s.product} onChange={(e) => setS({ ...s, product: e.target.value })} onBlur={saveRow} /> : ro(s.product)}</td>
      <td className={cell}>{canEdit ? <input inputMode="decimal" className={inp} value={s.marketVolume} onChange={(e) => setS({ ...s, marketVolume: e.target.value })} onBlur={saveRow} /> : ro(s.marketVolume)}</td>
      <td className={cell}>{canEdit ? <input inputMode="decimal" className={inp} value={s.marketValueUsd} onChange={(e) => setS({ ...s, marketValueUsd: e.target.value })} onBlur={saveRow} /> : ro(s.marketValueUsd)}</td>
      <td className={cell}>{canEdit ? <input inputMode="decimal" className={inp} value={s.avgPricePerBoxUsd} onChange={(e) => setS({ ...s, avgPricePerBoxUsd: e.target.value })} onBlur={saveRow} /> : ro(s.avgPricePerBoxUsd)}</td>
      <td className={`${cell} text-center font-medium`}>{row.players.length}</td>
      <td className={cell}>
        <div className="space-y-1">
          {row.players.map((p) => <PlayerEditor key={p.id} researchId={researchId} player={p} canEdit={canEdit} run={run} />)}
          {canEdit && (
            <button type="button" disabled={busy} onClick={() => { const fd = new FormData(); fd.set("rowId", row.id); fd.set("researchId", researchId); run(addResearchPlayer, fd); }}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"><Plus className="h-3 w-3" /> Acteur</button>
          )}
        </div>
      </td>
      <td className={cell}>{canEdit ? <input className={inp} value={s.comment} onChange={(e) => setS({ ...s, comment: e.target.value })} onBlur={saveRow} /> : ro(s.comment)}</td>
      <td className={`${cell} text-center`}>
        {canEdit && (
          <button type="button" onClick={() => { if (window.confirm(`Supprimer « ${s.product} » ?`)) { const fd = new FormData(); fd.set("id", row.id); fd.set("researchId", researchId); run(deleteResearchRow, fd); } }}
            className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </td>
    </tr>
  );
}

function PlayerEditor({
  researchId, player, canEdit, run,
}: {
  researchId: string; player: ResearchRowDTO["players"][number]; canEdit: boolean;
  run: (a: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData, refresh?: boolean) => void;
}) {
  const [p, setP] = React.useState({ name: player.name, marketShareValue: player.marketShareValue != null ? String(player.marketShareValue) : "", status: player.status ?? "" });
  function save() {
    const fd = new FormData();
    fd.set("id", player.id); fd.set("researchId", researchId);
    fd.set("name", p.name); fd.set("marketShareValue", nOrNull(p.marketShareValue)); fd.set("status", p.status);
    run(updateResearchPlayer, fd, false);
  }
  if (!canEdit) {
    return <div className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-medium">{p.name}</span>{p.marketShareValue && <span className="text-muted-foreground">· {p.marketShareValue}</span>}{p.status && <span className="rounded bg-secondary px-1 text-[10px]">{STATUS_LABEL[p.status]}</span>}</div>;
  }
  const mini = "h-7 rounded-md border border-input bg-background px-1.5 text-xs focus:border-primary focus:outline-none";
  return (
    <div className="flex items-center gap-1">
      <input className={`${mini} min-w-0 flex-1`} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} onBlur={save} placeholder="Acteur" />
      <input className={`${mini} w-20`} inputMode="decimal" value={p.marketShareValue} onChange={(e) => setP({ ...p, marketShareValue: e.target.value })} onBlur={save} placeholder="part" />
      <select className={`${mini} w-24`} value={p.status} onChange={(e) => { const status = e.target.value; setP({ ...p, status }); const fd = new FormData(); fd.set("id", player.id); fd.set("researchId", researchId); fd.set("name", p.name); fd.set("marketShareValue", nOrNull(p.marketShareValue)); fd.set("status", status); run(updateResearchPlayer, fd, false); }}>
        <option value="">— statut —</option>
        <option value="IMPORT">Importation</option>
        <option value="MANUFACTURING">Fabrication</option>
      </select>
      <button type="button" onClick={() => { const fd = new FormData(); fd.set("id", player.id); fd.set("researchId", researchId); run(deleteResearchPlayer, fd); }} className="rounded p-0.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
    </div>
  );
}
