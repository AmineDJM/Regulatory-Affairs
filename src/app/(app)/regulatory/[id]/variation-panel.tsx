"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Plus, Loader2, Check, X, Trash2 } from "lucide-react";
import { createVariation, setVariationStatus, deleteVariation } from "@/lib/actions/regulatory-actions";
import { MANUFACTURING_STATUS, VARIATION_STATUS, VARIATION_TARGETS } from "@/lib/labels";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";

interface VariationDTO {
  id: string;
  toStatus: string;
  status: string;
  depotDate: Date | string | null;
  decisionDate: Date | string | null;
  manufacturer: string | null;
  note: string | null;
}

/**
 * Cycle de vie des variations de fabrication d'un dossier : après la DE (Importation), on peut
 * déposer une variation vers un packaging local (secondaire / primaire / full process). À
 * l'obtention, le statut de fabrication du produit est promu à la cible.
 */
export function VariationPanel({
  productId, currentStatus, variations, canEdit,
}: {
  productId: string;
  currentStatus: string;
  variations: VariationDTO[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { window.alert(r.error ?? "Action impossible."); return; }
    after?.(); router.refresh();
  }

  async function submitNew(fd: FormData) {
    fd.set("productId", productId);
    await run(() => createVariation(fd), () => setAdding(false));
  }

  const d = (v: Date | string | null) => (v ? formatDate(typeof v === "string" ? v : v.toISOString()) : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Statut de fabrication actuel : </span>
          <span className="font-semibold">{MANUFACTURING_STATUS[currentStatus] ?? currentStatus}</span>
        </div>
        {canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-secondary">
            <Plus className="h-4 w-4" /> Variation
          </button>
        )}
      </div>

      {adding && (
        <form action={submitNew} className="space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Statut de fabrication visé</span>
              <select name="toStatus" required className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
                <option value="">— Choisir —</option>
                {VARIATION_TARGETS.map((v) => <option key={v} value={v}>{MANUFACTURING_STATUS[v]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Date de dépôt</span>
              <input type="date" name="depotDate" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">Fabricant (optionnel)</span>
              <input type="text" name="manufacturer" placeholder="Site de fabrication local" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">Note (optionnel)</span>
              <input type="text" name="note" placeholder="Référence de dépôt, précision…" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-secondary">Annuler</button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Déposer la variation
            </button>
          </div>
        </form>
      )}

      {variations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune variation. Une variation permet de passer d&apos;Importation à un packaging local (secondaire, primaire, full process).</p>
      ) : (
        <ul className="space-y-2">
          {variations.map((v) => (
            <li key={v.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-4 w-4 text-primary" />
                  → {MANUFACTURING_STATUS[v.toStatus] ?? v.toStatus}
                </div>
                <StatusBadge map={VARIATION_STATUS} value={v.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {d(v.depotDate) && <span>Dépôt : {d(v.depotDate)}</span>}
                {d(v.decisionDate) && <span>Décision : {d(v.decisionDate)}</span>}
                {v.manufacturer && <span>Fabricant : {v.manufacturer}</span>}
                {v.note && <span>{v.note}</span>}
              </div>
              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.status === "EN_ATTENTE" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => run(() => { const fd = new FormData(); fd.set("id", v.id); fd.set("status", "OBTENUE"); return setVariationStatus(fd); })}
                        className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-success hover:bg-success/25">
                        <Check className="h-3.5 w-3.5" /> DE obtenue
                      </button>
                      <button type="button" disabled={busy} onClick={() => run(() => { const fd = new FormData(); fd.set("id", v.id); fd.set("status", "ANNULE"); return setVariationStatus(fd); })}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-medium hover:bg-secondary">
                        <X className="h-3.5 w-3.5" /> Annuler
                      </button>
                    </>
                  )}
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm("Supprimer cette variation ?")) run(() => { const fd = new FormData(); fd.set("id", v.id); return deleteVariation(fd); }); }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
