"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle, Receipt, Link2, AlertTriangle, ExternalLink } from "lucide-react";
import type { SponsoringItemKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { breakdown, canEmitOrder, ITEM_KINDS, ITEM_KIND_LABELS } from "@/lib/sponsoring-items";
import {
  addSponsoringItem, updateSponsoringItem, deleteSponsoringItem,
  emitItemExpenseOrder, linkPromoMaterial,
} from "@/lib/actions/sponsoring-item-actions";

export interface ItemRow {
  id: string;
  kind: SponsoringItemKind;
  label: string;
  notes: string | null;
  supplier: string | null;
  amountEstimated: number | null;
  amountGranted: number | null;
  addedAfterDecision: boolean;
  promoMaterialId: string | null;
  promoMaterial: { reference: string; title: string; status: string } | null;
  expenseOrderId: string | null;
  expenseOrder: { reference: string; status: string } | null;
}

interface Props {
  sponsoringId: string;
  items: ItemRow[];
  /** Enveloppe accordée par la Direction (DZD), ou null si elle n'a pas encore tranché. */
  amountGranted: number | null;
  decided: boolean;
  canEdit: boolean;
  /** Affecter les montants et engager la dépense : Direction uniquement. */
  canAllocate: boolean;
  promoOptions: { id: string; reference: string; title: string; status: string }[];
}

/**
 * DE QUOI EST FAIT LE MONTANT — les postes d'un sponsoring.
 *
 * Un sponsoring est rarement un simple chèque : il y a l'appui à l'association, mais souvent
 * aussi un stand, des brochures produites pour l'occasion, une prestation. Le module ne portait
 * qu'un montant global — on ne savait ni de quoi il était fait, ni à qui allait l'argent.
 *
 * Trois principes tenus à l'écran :
 *   1. **Un poste n'est pas une demande** : aucun circuit de validation supplémentaire. Le
 *      sponsoring garde le sien, les postes en sont la ventilation.
 *   2. **Le dépassement se voit.** Un poste peut être ajouté après la décision — c'est autorisé.
 *      La ventilation dépasse alors l'enveloppe : on l'affiche en clair plutôt que de le
 *      découvrir à la facture.
 *   3. **Le matériel promotionnel n'est pas recopié ici.** Il a son circuit (visa publicitaire,
 *      conformité, agence, BAT) ; le poste y renvoie et en montre l'avancement en lecture.
 */
export function SponsoringItemsPanel({
  sponsoringId, items, amountGranted, decided, canEdit, canAllocate, promoOptions,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const lock = React.useRef(false);

  const b = breakdown(items, amountGranted);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? okText : (r.error ?? "Échec.") });
      if (r.ok) router.refresh();
    } finally {
      setBusy(null);
      lock.current = false;
    }
  };

  return (
    <div className="space-y-4">
      {/* ── La ventilation, avant la liste : c'est la question qu'on se pose en arrivant. ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Enveloppe accordée" value={b.envelopeDzd != null ? formatCurrency(b.envelopeDzd) : "—"} hint={b.envelopeDzd == null ? "Direction non tranchée" : undefined} />
        <Figure label="Estimé par le demandeur" value={formatCurrency(b.estimatedDzd)} hint={`${b.itemCount} poste(s)`} />
        <Figure label="Affecté aux postes" value={formatCurrency(b.allocatedDzd)} />
        {b.overrunDzd > 0 ? (
          <Figure label="Dépassement" value={formatCurrency(b.overrunDzd)} tone="danger" hint="au-delà de l'enveloppe" />
        ) : (
          <Figure
            label="Reste à affecter"
            value={b.envelopeDzd != null ? formatCurrency(b.unallocatedDzd) : "—"}
            tone={b.balanced ? "success" : undefined}
            hint={b.balanced ? "ventilation complète" : undefined}
          />
        )}
      </div>

      {b.overrunDzd > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            La ventilation dépasse l&apos;enveloppe accordée de <strong>{formatCurrency(b.overrunDzd)}</strong>.
            {b.hasLateAdditions
              ? " Des postes ont été ajoutés après la décision — c'est autorisé, mais la Direction doit le savoir avant le règlement."
              : " Réduisez un poste ou faites relever l'enveloppe."}
          </span>
        </p>
      )}

      {/* ── Les postes ── */}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucun poste. Détaillez ce que couvre ce sponsoring — appui, stand, matériel promotionnel,
          prestation — pour savoir de quoi est fait le montant et à qui va l&apos;argent.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const emit = canEmitOrder(it, decided);
            return (
              <li key={it.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <Badge tone={it.kind === "PROMO_MATERIAL" ? "purple" : "neutral"} dot={false}>{ITEM_KIND_LABELS[it.kind]}</Badge>
                  <span className="min-w-0 flex-1 font-medium">{it.label}</span>
                  {it.addedAfterDecision && (
                    <Badge tone="warning" dot={false}>ajouté après décision</Badge>
                  )}
                </div>

                {(it.notes || it.supplier) && (
                  <p className="text-xs text-muted-foreground">
                    {it.supplier && <>Payé à <strong className="text-foreground">{it.supplier}</strong>{it.notes ? " · " : ""}</>}
                    {it.notes}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Estimé : <span className="tabular-nums text-foreground">{it.amountEstimated != null ? formatCurrency(it.amountEstimated) : "—"}</span>
                  </span>
                  {canAllocate && !it.expenseOrderId ? (
                    <AllocateField itemId={it.id} current={it.amountGranted} busy={busy === `alloc:${it.id}`} onSave={(v) => {
                      const fd = new FormData();
                      fd.set("id", it.id);
                      fd.set("amountGranted", v);
                      void run(`alloc:${it.id}`, () => updateSponsoringItem(undefined, fd), "Montant affecté.");
                    }} />
                  ) : (
                    <span className="text-muted-foreground">
                      Affecté : <span className="tabular-nums font-medium text-foreground">{it.amountGranted != null ? formatCurrency(it.amountGranted) : "—"}</span>
                    </span>
                  )}
                </div>

                {/* Le matériel promotionnel : on RENVOIE vers son circuit, on ne le recopie pas. */}
                {it.kind === "PROMO_MATERIAL" && (
                  <div className="rounded-lg border border-border px-2.5 py-2 text-xs">
                    {it.promoMaterial ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/promo-material/${it.promoMaterialId}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                          {it.promoMaterial.reference} <ExternalLink className="h-3 w-3" />
                        </Link>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.promoMaterial.title}</span>
                        <Badge tone="info" dot={false}>{it.promoMaterial.status}</Badge>
                      </div>
                    ) : canEdit ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const fd = new FormData();
                            fd.set("id", it.id);
                            fd.set("promoMaterialId", e.target.value);
                            void run(`link:${it.id}`, () => linkPromoMaterial(undefined, fd), "Matériel rattaché.");
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
                        >
                          <option value="">Rattacher un matériel promotionnel existant…</option>
                          {promoOptions.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.title}</option>)}
                        </select>
                        <Link href="/promo-material" className="whitespace-nowrap text-primary hover:underline">ou en créer un</Link>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Aucun matériel rattaché.</span>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Le matériel suit <strong>son propre circuit</strong> (visa publicitaire, conformité, agence, BAT).
                      Ce sponsoring en montre l&apos;avancement, il ne le pilote pas.
                    </p>
                  </div>
                )}

                {/* Paiement du poste. */}
                <div className="flex flex-wrap items-center gap-2">
                  {it.expenseOrder ? (
                    <Badge tone="success" dot={false}>
                      <Receipt className="mr-1 h-3 w-3" /> {it.expenseOrder.reference} · {it.expenseOrder.status}
                    </Badge>
                  ) : canAllocate ? (
                    <Button
                      size="sm" variant="outline" disabled={!emit.ok || busy === `emit:${it.id}`}
                      title={emit.reason}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", it.id);
                        void run(`emit:${it.id}`, () => emitItemExpenseOrder(undefined, fd), "Ordre de dépense émis.");
                      }}
                    >
                      {busy === `emit:${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                      Émettre l&apos;ordre de dépense
                    </Button>
                  ) : null}
                  {!it.expenseOrder && canAllocate && !emit.ok && (
                    <span className="text-[11px] text-muted-foreground">{emit.reason}</span>
                  )}
                  {canEdit && !it.expenseOrderId && (
                    <button
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", it.id);
                        void run(`del:${it.id}`, () => deleteSponsoringItem(undefined, fd), "Poste retiré.");
                      }}
                      disabled={busy === `del:${it.id}`}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Retirer
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {msg && (
        <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {msg.text}
        </p>
      )}

      {/* ── Ajouter ── */}
      {canEdit && (
        adding ? (
          <AddItemForm
            sponsoringId={sponsoringId}
            decided={decided}
            busy={busy === "add"}
            onCancel={() => setAdding(false)}
            onSubmit={(fd) => void run("add", async () => {
              const r = await addSponsoringItem(undefined, fd);
              if (r.ok) setAdding(false);
              return r;
            }, "Poste ajouté.")}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Ajouter un poste
          </Button>
        )
      )}
    </div>
  );
}

/** Saisie du montant affecté, validée à la sortie du champ — pas de bouton par ligne. */
function AllocateField({ itemId, current, busy, onSave }: { itemId: string; current: number | null; busy: boolean; onSave: (v: string) => void }) {
  const [value, setValue] = React.useState(current != null ? String(current) : "");
  React.useEffect(() => { setValue(current != null ? String(current) : ""); }, [current]);

  return (
    <label className="flex items-center gap-1.5 text-muted-foreground">
      Affecté :
      <input
        type="number" min="0" step="1000" value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value !== (current != null ? String(current) : "")) onSave(value); }}
        aria-label={`Montant affecté au poste ${itemId}`}
        className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-primary/60"
      />
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      <span className="text-xs">DZD</span>
    </label>
  );
}

function AddItemForm({ sponsoringId, decided, busy, onCancel, onSubmit }: {
  sponsoringId: string; decided: boolean; busy: boolean; onCancel: () => void; onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-2 rounded-xl border border-border p-3"
    >
      <input type="hidden" name="sponsoringId" value={sponsoringId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Nature
          <select name="kind" defaultValue="STAND" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60">
            {ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="text-xs">
          Libellé
          <input name="label" required placeholder="Stand 12 m² — hall B" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
        </label>
        <label className="text-xs">
          Payé à
          <input name="supplier" placeholder="Organisateur, agence, association…" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
        </label>
        <label className="text-xs">
          Montant estimé (DZD)
          <input name="amountEstimated" type="number" min="0" step="1000" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm tabular-nums outline-none focus:border-primary/60" />
        </label>
      </div>
      <label className="block text-xs">
        Précisions
        <input name="notes" placeholder="Facultatif" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
      </label>

      {decided && (
        <p className="flex items-start gap-1.5 text-[11px] text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          Le sponsoring est déjà tranché : ce poste sera marqué « ajouté après décision » et fera
          apparaître un dépassement d&apos;enveloppe s&apos;il n&apos;est pas compensé.
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
