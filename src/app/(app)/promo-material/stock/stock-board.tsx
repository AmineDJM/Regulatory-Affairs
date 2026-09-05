"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, ArrowDownToLine, ArrowUpFromLine, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/utils";
import { MATERIAL_TYPE, MATERIAL_TYPE_OPTIONS } from "@/lib/labels";
import { MOVEMENT_LABEL, STOCK_LEVEL_LABEL, stockLevel, type MovementKind } from "@/lib/promo/stock";
import {
  createStockItem, updateStockItem, deleteStockItem, recordStockMovement, deleteStockMovement,
} from "@/lib/actions/promo-stock-actions";

export interface StockMovementRow {
  id: string;
  kind: MovementKind;
  delta: number;
  recipient: string | null;
  reason: string | null;
  occurredAt: string;
  by: string | null;
}

export interface StockItemRow {
  id: string;
  name: string;
  materialType: string | null;
  reference: string | null;
  unit: string | null;
  location: string | null;
  alertThreshold: number | null;
  notes: string | null;
  isActive: boolean;
  /** Calculé depuis les mouvements — jamais saisi. */
  stock: number;
  movements: StockMovementRow[];
}

type Result = { ok: boolean; error?: string };

const LEVEL_TONE = { OUT: "danger", LOW: "warning", OK: "success" } as const;
const KIND_OPTIONS: MovementKind[] = ["RECEIPT", "DISTRIBUTION", "LOSS", "CORRECTION"];

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const run = async (fn: () => Promise<Result>, onOk?: () => void) => {
    setBusy(true); setError(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) { onOk?.(); router.refresh(); } else setError(r.error ?? "Échec.");
  };
  return { busy, error, setError, run };
}

/**
 * LE STOCK PROMOTIONNEL — ce qu'on a, où c'est, et ce qui en est sorti.
 *
 * Chaque ligne montre la quantité RESTANTE, calculée à partir des mouvements. On la déplie pour
 * voir le registre : qui a reçu quoi, quand, et pourquoi. C'est ce registre qui rend le chiffre
 * crédible — un stock qu'on ne peut pas expliquer n'est pas consulté deux fois.
 */
export function StockBoard({ items, canManage }: { items: StockItemRow[]; canManage: boolean }) {
  const { busy, error, setError, run } = useRun();
  const [q, setQ] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [itemSheet, setItemSheet] = React.useState<{ mode: "create" | "edit"; item?: StockItemRow } | null>(null);
  const [moveSheet, setMoveSheet] = React.useState<{ item: StockItemRow; kind: MovementKind } | null>(null);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items.filter((i) => `${i.name} ${i.reference ?? ""} ${i.location ?? ""}`.toLowerCase().includes(needle))
    : items;

  const alerts = items.filter((i) => i.isActive && stockLevel(i.stock, i.alertThreshold) !== "OK");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un article, une référence…" className="w-72 pl-8" />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} / {items.length} article(s)</span>
        {canManage && (
          <Button size="sm" className="ml-auto" onClick={() => setItemSheet({ mode: "create" })}>
            <Plus className="h-4 w-4" /> Nouvel article
          </Button>
        )}
      </div>

      {alerts.length > 0 && (
        <p className="rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
          <strong>{alerts.length}</strong> article{alerts.length > 1 ? "s" : ""} en rupture ou sous le seuil d&apos;alerte :{" "}
          {alerts.slice(0, 4).map((a) => a.name).join(", ")}{alerts.length > 4 ? "…" : ""}
        </p>
      )}

      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="surface divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "Aucun article en stock. Créez-en un : la quantité initiale sera enregistrée comme une entrée, avec sa date."
              : "Aucun article ne correspond à cette recherche."}
          </p>
        ) : (
          filtered.map((item) => {
            const level = stockLevel(item.stock, item.alertThreshold);
            const open = openId === item.id;
            return (
              <div key={item.id}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm">
                  <button
                    type="button" onClick={() => setOpenId(open ? null : item.id)}
                    className="min-w-0 flex-1 text-left"
                    title="Voir le registre des mouvements"
                  >
                    <span className="font-medium">{item.name}</span>
                    {!item.isActive && <Badge tone="neutral" dot={false} className="ml-2">inactif</Badge>}
                    <span className="block text-xs text-muted-foreground">
                      {[item.materialType ? MATERIAL_TYPE[item.materialType] ?? item.materialType : null, item.reference, item.location]
                        .filter(Boolean).join(" · ") || "—"}
                    </span>
                  </button>
                  <span className="tabular-nums text-right">
                    <span className="text-base font-semibold">{item.stock}</span>
                    {item.unit && <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>}
                  </span>
                  <Badge tone={LEVEL_TONE[level]} dot={false}>{STOCK_LEVEL_LABEL[level]}</Badge>
                  {canManage && (
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button" title="Entrée de stock" aria-label={`Entrée — ${item.name}`}
                        onClick={() => setMoveSheet({ item, kind: "RECEIPT" })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-success"
                      >
                        <ArrowDownToLine className="h-4 w-4" />
                      </button>
                      <button
                        type="button" title="Distribuer / sortir" aria-label={`Sortie — ${item.name}`}
                        onClick={() => setMoveSheet({ item, kind: "DISTRIBUTION" })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                      >
                        <ArrowUpFromLine className="h-4 w-4" />
                      </button>
                      <button
                        type="button" title="Modifier la fiche" aria-label={`Modifier ${item.name}`}
                        onClick={() => setItemSheet({ mode: "edit", item })}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button" title="Supprimer l'article" aria-label={`Supprimer ${item.name}`}
                        onClick={() => {
                          if (!window.confirm(`Supprimer « ${item.name} » et son historique de ${item.movements.length} mouvement(s) ? Pour un article réel qui ne sert plus, préférez le désactiver.`)) return;
                          const fd = new FormData(); fd.set("id", item.id);
                          void run(() => deleteStockItem(fd));
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </div>

                {open && (
                  <div className="border-t border-border/60 bg-secondary/20 px-3 py-2">
                    {item.notes && <p className="mb-2 text-xs text-muted-foreground">{item.notes}</p>}
                    {item.movements.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">Aucun mouvement enregistré.</p>
                    ) : (
                      <ul className="space-y-1">
                        {item.movements.map((m) => (
                          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <span className="w-24 shrink-0 text-muted-foreground">{formatDate(m.occurredAt)}</span>
                            <span className="w-40 shrink-0">{MOVEMENT_LABEL[m.kind]}</span>
                            <span className={`w-20 shrink-0 text-right tabular-nums font-medium ${m.delta < 0 ? "text-destructive" : "text-success"}`}>
                              {m.delta > 0 ? "+" : ""}{m.delta}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {[m.recipient, m.reason].filter(Boolean).join(" — ") || "—"}
                              {m.by ? ` · ${m.by}` : ""}
                            </span>
                            {canManage && (
                              <button
                                type="button" title="Annuler ce mouvement (erreur de saisie)"
                                onClick={() => {
                                  if (!window.confirm("Annuler ce mouvement ? Le stock sera recalculé. L'opération est tracée dans le journal.")) return;
                                  const fd = new FormData(); fd.set("id", m.id);
                                  void run(() => deleteStockMovement(fd));
                                }}
                                className="rounded p-1 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canManage && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setMoveSheet({ item, kind: "LOSS" })}>Perte / casse</Button>
                        <Button size="sm" variant="outline" onClick={() => setMoveSheet({ item, kind: "CORRECTION" })}>Corriger l&apos;inventaire</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {itemSheet && (
        <ItemSheet
          mode={itemSheet.mode}
          item={itemSheet.item}
          busy={busy}
          onClose={() => { setItemSheet(null); setError(null); }}
          onSubmit={(fd) => run(itemSheet.mode === "create" ? () => createStockItem(fd) : () => updateStockItem(fd), () => setItemSheet(null))}
        />
      )}

      {moveSheet && (
        <MovementSheet
          item={moveSheet.item}
          kind={moveSheet.kind}
          busy={busy}
          onClose={() => { setMoveSheet(null); setError(null); }}
          onSubmit={(fd) => run(() => recordStockMovement(fd), () => setMoveSheet(null))}
        />
      )}
    </div>
  );
}

function ItemSheet({
  mode, item, busy, onClose, onSubmit,
}: {
  mode: "create" | "edit";
  item?: StockItemRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <Sheet open onClose={onClose} title={mode === "create" ? "Nouvel article de stock" : "Modifier l'article"}>
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); if (item) fd.set("id", item.id); onSubmit(fd); }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="stock-name">Article</Label>
          <Input id="stock-name" name="name" defaultValue={item?.name} required placeholder="Ex. Bloc-notes Cardiomax" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-type">Type de matériel</Label>
            <Select id="stock-type" name="materialType" defaultValue={item?.materialType ?? ""}>
              <option value="">— Type —</option>
              {MATERIAL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-ref">Référence</Label>
            <Input id="stock-ref" name="reference" defaultValue={item?.reference ?? ""} placeholder="Facultatif" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-unit">Unité</Label>
            <Input id="stock-unit" name="unit" defaultValue={item?.unit ?? ""} placeholder="pièce, boîte, lot de 50…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-loc">Emplacement</Label>
            <Input id="stock-loc" name="location" defaultValue={item?.location ?? ""} placeholder="Magasin, agence…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stock-alert">Seuil d&apos;alerte</Label>
            <Input id="stock-alert" name="alertThreshold" defaultValue={item?.alertThreshold ?? ""} inputMode="decimal" placeholder="Facultatif" />
          </div>
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="stock-initial">Quantité en stock aujourd&apos;hui</Label>
              <Input id="stock-initial" name="initialQuantity" inputMode="decimal" placeholder="0" />
              <p className="text-[0.6875rem] text-muted-foreground">Enregistrée comme une entrée datée, pas comme un chiffre posé.</p>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock-notes">Notes</Label>
          <Textarea id="stock-notes" name="notes" defaultValue={item?.notes ?? ""} rows={2} />
        </div>
        {mode === "edit" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" value="true" defaultChecked={item?.isActive ?? true} className="h-4 w-4 rounded border-input" />
            Article actif
            <input type="hidden" name="isActive" value="false" />
          </label>
        )}
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </Sheet>
  );
}

function MovementSheet({
  item, kind, busy, onClose, onSubmit,
}: {
  item: StockItemRow;
  kind: MovementKind;
  busy: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [current, setCurrent] = React.useState<MovementKind>(kind);
  const isOut = current === "DISTRIBUTION" || current === "LOSS";
  return (
    <Sheet open onClose={onClose} title={`${MOVEMENT_LABEL[current]} — ${item.name}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("itemId", item.id); fd.set("kind", current); onSubmit(fd); }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          Stock actuel : <strong className="text-foreground tabular-nums">{item.stock}</strong>
          {item.unit ? ` ${item.unit}` : ""}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="mv-kind">Nature du mouvement</Label>
          <Select id="mv-kind" value={current} onChange={(e) => setCurrent(e.target.value as MovementKind)}>
            {KIND_OPTIONS.map((k) => <option key={k} value={k}>{MOVEMENT_LABEL[k]}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mv-qty">Quantité</Label>
          <Input id="mv-qty" name="quantity" required inputMode="decimal" placeholder={current === "CORRECTION" ? "+40 ou −40" : "600"} />
          <p className="text-[0.6875rem] text-muted-foreground">
            {current === "CORRECTION"
              ? "Une correction peut aller dans les deux sens : indiquez le signe."
              : "Quantité positive — c'est la nature choisie qui donne le sens."}
          </p>
        </div>
        {isOut && (
          <div className="space-y-1.5">
            <Label htmlFor="mv-recipient">Destinataire</Label>
            <Input id="mv-recipient" name="recipient" placeholder="Délégué, congrès, agence…" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mv-date">Date</Label>
            <Input id="mv-date" name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-reason">Motif</Label>
            <Input id="mv-reason" name="reason" placeholder="Facultatif" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer le mouvement</Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </Sheet>
  );
}
