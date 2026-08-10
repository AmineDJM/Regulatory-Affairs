"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle, Receipt, Link2, AlertTriangle, ExternalLink, Send, FileText, Wallet, ThumbsUp, ThumbsDown, RotateCcw, History, Pencil, X } from "lucide-react";
import type { AdProItemKind, AdProItemStatus, AdProItemBudgetKind, AdProItemOrderStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  breakdown, canEmitOrder, canSubmitItem, canRequestPurchaseOrder, canRemoveItem, budgetKindLocked, plannedGaps,
  ITEM_KINDS, ITEM_KIND_LABELS, ITEM_STATUS_LABELS, ITEM_BUDGET_KIND_LABELS, ITEM_ORDER_STAGE_LABELS,
  type AdProParent,
} from "@/lib/ad-pro-items";
import {
  addAdProItem, updateAdProItem, deleteAdProItem,
  emitItemExpenseOrder, linkPromoMaterial,
  submitAdProItem, decideAdProItem, setAdProItemBudget,
  requestAdProItemQuote, requestAdProItemOrder, approveAdProItemOrder,
} from "@/lib/actions/ad-pro-item-actions";

export interface ItemRow {
  id: string;
  kind: AdProItemKind;
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
  /** Cycle de validation propre au poste. */
  status: AdProItemStatus;
  budgetKind: AdProItemBudgetKind;
  decisionNote: string | null;
  decidedAt: string | null;
  /** Budget (catégorie d'enveloppe) qui portera la dépense, choisi après accord. */
  budgetCategoryId: string | null;
  budgetCategoryLabel: string | null;
  /** Demande administrative ouverte pour obtenir le devis. */
  adminRequestId: string | null;
  adminRequestRef: string | null;
  /** Émission du bon de commande : demande → visa Direction → Finances. */
  orderStage: AdProItemOrderStage;
  /** Historique des allers-retours avec la Direction (le plus récent en tête). */
  decisions: { decision: AdProItemStatus; note: string | null; amount: number | null; at: string; by: string | null }[];
}

interface Props {
  parent: AdProParent;
  parentId: string;
  items: ItemRow[];
  /** Enveloppe accordée par la Direction (DZD), ou null si elle n'a pas encore tranché. */
  amountGranted: number | null;
  decided: boolean;
  canEdit: boolean;
  /** Affecter les montants et engager la dépense : Direction uniquement. */
  canAllocate: boolean;
  promoOptions: { id: string; reference: string; title: string; status: string }[];
  /** Congrès : ce qui est ANNONCÉ (stand, symposium) et qu'il faudrait chiffrer. */
  plan?: { hasBooth?: boolean | null; hasSymposium?: boolean | null };
  /** (Sous-)catégories budgétaires proposées pour imputer un poste accordé. */
  budgetOptions?: { id: string; label: string }[];
  /** Les Finances émettent le bon de commande visé par la Direction. */
  canIssueOrder?: boolean;
}

/**
 * DE QUOI EST FAIT LE MONTANT — les postes d'une opération Ad & Pro.
 *
 * Sert le **sponsoring** et les **prises en charge nationales** : la question est la même dans les deux
 * cas. Un sponsoring est rarement un simple chèque, un congrès rarement une simple inscription —
 * il y a le stand, le symposium, les brochures produites pour l'occasion, une prestation. Les
 * modules ne portaient qu'un montant global : on ne savait ni de quoi il était fait, ni à qui
 * allait l'argent.
 *
 * Sert les QUATRE opérations du pôle (sponsoring, prises en charge nationales et
 * internationales, événements).
 *
 * Quatre principes tenus à l'écran :
 *   1. **Chaque poste se valide À PART.** Consulting, traiteur, salle ne se décident pas
 *      ensemble : la Direction accorde l'un, refuse l'autre, demande à revoir le troisième —
 *      autant de fois qu'il le faut, chaque tour restant visible dans l'historique.
 *   2. **Le dépassement se voit.** Un poste peut être ajouté après la décision — c'est autorisé.
 *      La ventilation dépasse alors l'enveloppe : on l'affiche en clair plutôt que de le
 *      découvrir à la facture.
 *   3. **Le matériel promotionnel n'est pas recopié ici.** Il a son circuit (visa publicitaire,
 *      conformité, agence, BAT) ; le poste y renvoie et en montre l'avancement en lecture.
 *   4. **Ce qui est annoncé doit être chiffré.** Un congrès qui déclare un stand ou un symposium
 *      sans poste correspondant a un budget incomplet — on le dit, sans bloquer : un stand peut
 *      être offert par l'organisateur.
 */
export function AdProItemsPanel({
  parent, parentId, items, amountGranted, decided, canEdit, canAllocate, promoOptions, plan,
  budgetOptions = [], canIssueOrder = false,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const lock = React.useRef(false);

  const b = breakdown(items, amountGranted);
  const gaps = plannedGaps(items, plan ?? {});

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
        <Figure
          label="Affecté aux postes"
          value={formatCurrency(b.allocatedDzd)}
          hint={b.additionalDzd > 0 ? `+ ${formatCurrency(b.additionalDzd)} en budget supplémentaire` : undefined}
        />
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

      {/* Une RALLONGE assumée n'est pas un dépassement subi : deux lignes distinctes, deux décisions. */}
      {(b.additionalDzd > 0 || b.pendingDzd > 0) && (
        <p className="rounded-xl border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
          {b.additionalDzd > 0 && (
            <>Postes demandés <strong className="text-foreground">en plus</strong> de l&apos;enveloppe : <strong className="tabular-nums text-foreground">{formatCurrency(b.additionalDzd)}</strong>. </>
          )}
          {b.pendingDzd > 0 && (
            <>En attente de décision de la Direction : <strong className="tabular-nums text-foreground">{formatCurrency(b.pendingDzd)}</strong>.</>
          )}
        </p>
      )}

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

      {/* Annoncé mais pas chiffré : le budget est incomplet, et personne ne le voyait. */}
      {gaps.any && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {gaps.boothUnbudgeted && <>Un <strong>stand</strong> est annoncé sur cet événement mais aucun poste ne le chiffre. </>}
            {gaps.symposiumUnbudgeted && <>Un <strong>symposium</strong> est annoncé mais aucun poste ne le chiffre. </>}
            S&apos;il est offert par l&apos;organisateur, ignorez ce rappel — sinon le budget est incomplet.
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
            const removable = canRemoveItem(
              { expenseOrderId: it.expenseOrderId, expenseOrderStatus: it.expenseOrder?.status ?? null },
              { canAllocate },
            );
            const editing = editingId === it.id;
            return (
              <li key={it.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-start gap-2">
                  <Badge tone={it.kind === "PROMO_MATERIAL" ? "purple" : "neutral"} dot={false}>{ITEM_KIND_LABELS[it.kind]}</Badge>
                  <span className="min-w-0 flex-1 font-medium">{it.label}</span>
                  <Badge tone={ITEM_STATUS_LABELS[it.status].tone} dot={false}>{ITEM_STATUS_LABELS[it.status].label}</Badge>
                  {it.budgetKind === "ADDITIONAL" && <Badge tone="warning" dot={false}>budget supplémentaire</Badge>}
                  {it.addedAfterDecision && (
                    <Badge tone="warning" dot={false}>ajouté après décision</Badge>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => setEditingId(editing ? null : it.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
                    >
                      {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editing ? "Fermer" : "Modifier"}
                    </button>
                  )}
                </div>

                {/* ÉDITION DU POSTE — libellé, fournisseur, note, estimation, nature de budget.
                    Ces champs DÉCRIVENT la dépense, ils ne l'engagent pas : les corriger après
                    l'émission d'un bon de commande est légitime (« Lotus Media » mal orthographié
                    doit pouvoir se réparer). Seul le montant AFFECTÉ se verrouille avec l'ordre
                    de dépense, parce que lui seul a été transmis aux Finances. */}
                {editing && (
                  <EditItemForm
                    item={it}
                    busy={busy === `edit:${it.id}`}
                    onCancel={() => setEditingId(null)}
                    onSave={(fd) => {
                      fd.set("id", it.id);
                      void run(`edit:${it.id}`, () => updateAdProItem(undefined, fd), "Poste modifié.").then(() => setEditingId(null));
                    }}
                  />
                )}

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
                      void run(`alloc:${it.id}`, () => updateAdProItem(undefined, fd), "Montant affecté.");
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
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                      Le matériel suit <strong>son propre circuit</strong> (visa publicitaire, conformité, agence, BAT).
                      Ce sponsoring en montre l&apos;avancement, il ne le pilote pas.
                    </p>
                  </div>
                )}

                {/* ── Le cycle du poste : devis → validation → budget → bon de commande ── */}
                <ItemLifecycle
                  item={it}
                  canEdit={canEdit}
                  canAllocate={canAllocate}
                  canIssueOrder={canIssueOrder}
                  budgetOptions={budgetOptions}
                  busy={busy}
                  run={run}
                />

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
                    <span className="text-[0.6875rem] text-muted-foreground">{emit.reason}</span>
                  )}
                  {/* RETIRER — libre tant qu'aucun ordre n'est parti aux Finances ; réservé à la
                      Direction ensuite, avec annulation de l'ordre (et jamais si déjà réglé). */}
                  {canEdit && removable.ok && (
                    <button
                      onClick={() => {
                        if (it.expenseOrderId && !window.confirm(
                          `Retirer ce poste annulera l'ordre de dépense ${it.expenseOrder?.reference ?? ""} transmis aux Finances. Continuer ?`,
                        )) return;
                        const fd = new FormData();
                        fd.set("id", it.id);
                        void run(`del:${it.id}`, () => deleteAdProItem(undefined, fd), "Poste retiré.");
                      }}
                      disabled={busy === `del:${it.id}`}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={it.expenseOrderId ? "L'ordre de dépense sera annulé" : undefined}
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
            parent={parent}
            parentId={parentId}
            decided={decided}
            busy={busy === "add"}
            onCancel={() => setAdding(false)}
            onSubmit={(fd) => void run("add", async () => {
              const r = await addAdProItem(undefined, fd);
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

function AddItemForm({ parent, parentId, decided, busy, onCancel, onSubmit }: {
  parent: AdProParent; parentId: string; decided: boolean; busy: boolean; onCancel: () => void; onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-2 rounded-xl border border-border p-3"
    >
      <input type="hidden" name="parent" value={parent} />
      <input type="hidden" name="parentId" value={parentId} />
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

      {/* LA question à poser au moment de l'ajout : cet argent est-il déjà accordé, ou en plus ? */}
      <fieldset className="rounded-lg border border-border p-2.5">
        <legend className="px-1 text-xs text-muted-foreground">Ce poste est-il déjà couvert par le budget accordé ?</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="budgetKind" value="INCLUDED" defaultChecked /> Inclus dans le budget accordé
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="budgetKind" value="ADDITIONAL" /> Budget supplémentaire (rallonge)
          </label>
        </div>
      </fieldset>
      <label className="block text-xs">
        Précisions
        <input name="notes" placeholder="Facultatif" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
      </label>

      {decided && (
        <p className="flex items-start gap-1.5 text-[0.6875rem] text-warning">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          L&apos;opération est déjà tranchée : ce poste sera marqué « ajouté après décision ». S&apos;il
          est <strong>inclus</strong> dans le budget accordé, il fera apparaître un dépassement tant
          qu&apos;il n&apos;est pas compensé ; s&apos;il s&apos;agit d&apos;une <strong>rallonge</strong>, il sera compté à part.
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

/**
 * MODIFIER UN POSTE — ce qui le DÉCRIT, pas ce qui l'engage.
 *
 * Le panneau ne savait rien corriger : une fois le poste créé, un fournisseur mal orthographié,
 * une estimation dépassée ou un libellé approximatif restaient là pour toujours. C'était
 * d'autant plus gênant que ces champs ne portent aucun engagement financier — seul le montant
 * AFFECTÉ a été transmis aux Finances, et lui seul se verrouille avec l'ordre de dépense.
 *
 * La nature de budget (inclus / rallonge) reste modifiable tant que la Direction n'a pas
 * tranché : après, c'est sur quoi elle s'est prononcée.
 */
function EditItemForm({ item, busy, onCancel, onSave }: {
  item: ItemRow; busy: boolean; onCancel: () => void; onSave: (fd: FormData) => void;
}) {
  const budgetLocked = budgetKindLocked(item);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)); }}
      className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          Nature
          <select name="kind" defaultValue={item.kind} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60">
            {ITEM_KINDS.map((k) => <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="text-xs">
          Libellé
          <input name="label" required defaultValue={item.label} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
        </label>
        <label className="text-xs">
          Payé à
          <input name="supplier" defaultValue={item.supplier ?? ""} placeholder="Organisateur, agence, association…" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
        </label>
        <label className="text-xs">
          Montant estimé (DZD)
          <input name="amountEstimated" type="number" min="0" step="1000" defaultValue={item.amountEstimated ?? ""} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm tabular-nums outline-none focus:border-primary/60" />
        </label>
      </div>
      <label className="block text-xs">
        Précisions
        <input name="notes" defaultValue={item.notes ?? ""} placeholder="Facultatif" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
      </label>

      {budgetLocked ? (
        <p className="text-[0.6875rem] text-muted-foreground">
          La Direction a tranché : la nature du budget ({ITEM_BUDGET_KIND_LABELS[item.budgetKind]}) ne change plus —
          c&apos;est sur elle qu&apos;elle s&apos;est prononcée.
        </p>
      ) : (
        <fieldset className="rounded-lg border border-border p-2.5">
          <legend className="px-1 text-xs text-muted-foreground">Ce poste est-il couvert par le budget accordé ?</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="budgetKind" value="INCLUDED" defaultChecked={item.budgetKind === "INCLUDED"} /> Inclus dans le budget accordé
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="budgetKind" value="ADDITIONAL" defaultChecked={item.budgetKind === "ADDITIONAL"} /> Budget supplémentaire (rallonge)
            </label>
          </div>
        </fieldset>
      )}

      {item.expenseOrderId && (
        <p className="flex items-start gap-1.5 text-[0.6875rem] text-muted-foreground">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" />
          Un ordre de dépense a été émis : le <strong>montant affecté</strong> ne change plus. Le reste
          se corrige librement.
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer
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
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * LE CYCLE D'UN POSTE, sur une seule ligne de vie : devis → validation par la Direction →
 * choix du budget → bon de commande (demande, visa, émission).
 *
 * Chaque étape n'apparaît QUE lorsqu'elle a un sens : on ne propose pas de choisir un budget
 * avant l'accord, ni de demander un bon de commande sans budget. Un écran qui affiche des
 * boutons inertes fait perdre plus de temps qu'il n'en fait gagner.
 */
function ItemLifecycle({ item, canEdit, canAllocate, canIssueOrder, budgetOptions, busy, run }: {
  item: ItemRow;
  canEdit: boolean;
  canAllocate: boolean;
  canIssueOrder: boolean;
  budgetOptions: { id: string; label: string }[];
  busy: string | null;
  run: (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [showHistory, setShowHistory] = React.useState(false);
  const [deciding, setDeciding] = React.useState(false);

  const submit = canSubmitItem({ status: item.status, amountEstimated: item.amountEstimated, amountGranted: item.amountGranted });
  const order = canRequestPurchaseOrder({
    status: item.status, amountGranted: item.amountGranted,
    budgetCategoryId: item.budgetCategoryId, orderStage: item.orderStage,
  });
  const fdOf = (extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("id", item.id);
    for (const [k, v] of Object.entries(extra)) if (v) fd.set(k, v);
    return fd;
  };

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-secondary/20 p-2.5">
      {/* ── Devis : ouvrir une demande administrative, puis y joindre les devis ── */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        {item.adminRequestId ? (
          <>
            <span className="text-muted-foreground">Devis demandé au secrétariat :</span>
            <Link href={`/demandes/${item.adminRequestId}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {item.adminRequestRef ?? "voir la demande"} <ExternalLink className="h-3 w-3" />
            </Link>
            <span className="text-muted-foreground">— joignez-y les devis reçus, ils font partie du dossier du poste.</span>
          </>
        ) : canEdit && item.status !== "APPROVED" ? (
          <button
            type="button"
            disabled={busy === `quote:${item.id}`}
            onClick={() => void run(`quote:${item.id}`, () => requestAdProItemQuote(undefined, fdOf()), "Demande de devis ouverte au secrétariat.")}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 font-medium hover:bg-secondary"
          >
            {busy === `quote:${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Demander un devis (secrétariat)
          </button>
        ) : (
          <span className="text-muted-foreground">Aucune demande de devis.</span>
        )}
      </div>

      {/* ── Validation du poste ── */}
      {item.decisionNote && (item.status === "REVISION" || item.status === "REJECTED") && (
        <p className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
          <strong>Direction :</strong> {item.decisionNote}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (item.status === "DRAFT" || item.status === "REVISION" || item.status === "REJECTED") && (
          <Button
            size="sm" variant="outline" disabled={!submit.ok || busy === `submit:${item.id}`} title={submit.reason}
            onClick={() => void run(`submit:${item.id}`, () => submitAdProItem(undefined, fdOf()), "Poste soumis à la Direction.")}
          >
            {busy === `submit:${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {item.status === "DRAFT" ? "Soumettre à la Direction" : "Resoumettre"}
          </Button>
        )}
        {canEdit && !submit.ok && item.status !== "PENDING" && item.status !== "APPROVED" && (
          <span className="text-[0.6875rem] text-muted-foreground">{submit.reason}</span>
        )}

        {/* La Direction tranche : accorder / revoir / refuser — autant de fois qu'il le faut. */}
        {canAllocate && item.status === "PENDING" && (
          deciding ? (
            <div className="w-full space-y-2 rounded-lg border border-border bg-background p-2.5">
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Motif / consigne (obligatoire pour un refus ou une révision)"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/60"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm" disabled={busy === `dec:${item.id}`}
                  onClick={() => void run(`dec:${item.id}`, () => decideAdProItem(undefined, fdOf({ decision: "APPROVED", note })), "Poste accordé.")}
                >
                  <ThumbsUp className="h-4 w-4" /> Accorder
                </Button>
                <Button
                  size="sm" variant="outline" disabled={busy === `dec:${item.id}` || !note.trim()}
                  title={!note.trim() ? "Indiquez ce qu'il faut revoir" : undefined}
                  onClick={() => void run(`dec:${item.id}`, () => decideAdProItem(undefined, fdOf({ decision: "REVISION", note })), "Budget à revoir — le demandeur est prévenu.")}
                >
                  <RotateCcw className="h-4 w-4" /> Revoir le budget
                </Button>
                <Button
                  size="sm" variant="outline" className="text-destructive" disabled={busy === `dec:${item.id}` || !note.trim()}
                  title={!note.trim() ? "Indiquez le motif du refus" : undefined}
                  onClick={() => void run(`dec:${item.id}`, () => decideAdProItem(undefined, fdOf({ decision: "REJECTED", note })), "Poste refusé.")}
                >
                  <ThumbsDown className="h-4 w-4" /> Refuser
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeciding(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => setDeciding(true)}>
              <ThumbsUp className="h-4 w-4" /> Décider de ce poste
            </Button>
          )
        )}

        {item.decisions.length > 0 && (
          <button
            type="button" onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground hover:text-foreground"
          >
            <History className="h-3 w-3" /> {showHistory ? "Masquer" : `Historique (${item.decisions.length})`}
          </button>
        )}
      </div>

      {showHistory && item.decisions.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-background p-2 text-[0.6875rem]">
          {item.decisions.map((d, i) => (
            <li key={i} className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="font-medium text-foreground">{ITEM_STATUS_LABELS[d.decision].label}</span>
              {d.amount != null && <span className="tabular-nums">{formatCurrency(d.amount)}</span>}
              <span>{formatDate(d.at)}</span>
              {d.by && <span>· {d.by}</span>}
              {d.note && <span className="w-full italic">« {d.note} »</span>}
            </li>
          ))}
        </ul>
      )}

      {/* ── Budget : « comme d'habitude », une fois le poste accordé ── */}
      {item.status === "APPROVED" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          {canAllocate && item.orderStage !== "ISSUED" ? (
            <select
              value={item.budgetCategoryId ?? ""}
              onChange={(e) => void run(`budget:${item.id}`, () => setAdProItemBudget(undefined, fdOf({ budgetCategoryId: e.target.value })), "Budget choisi.")}
              aria-label="Budget imputé à ce poste"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
            >
              <option value="">Choisir le budget (enveloppe › catégorie)…</option>
              {budgetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          ) : (
            <span className="text-muted-foreground">
              Budget : <strong className="text-foreground">{item.budgetCategoryLabel ?? "non choisi"}</strong>
            </span>
          )}
          {busy === `budget:${item.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      )}

      {/* ── Bon de commande : demande → visa Direction → émission par les Finances ── */}
      {item.status === "APPROVED" && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ITEM_ORDER_STAGE_LABELS[item.orderStage].tone} dot={false}>
            {ITEM_ORDER_STAGE_LABELS[item.orderStage].label}
          </Badge>

          {canEdit && (item.orderStage === "NONE" || item.orderStage === "REFUSED") && (
            <Button
              size="sm" variant="outline" disabled={!order.ok || busy === `po:${item.id}`} title={order.reason}
              onClick={() => void run(`po:${item.id}`, () => requestAdProItemOrder(undefined, fdOf()), "Émission du bon de commande demandée.")}
            >
              {busy === `po:${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Demander l&apos;émission du BC
            </Button>
          )}
          {canEdit && !order.ok && item.orderStage === "NONE" && (
            <span className="text-[0.6875rem] text-muted-foreground">{order.reason}</span>
          )}

          {canAllocate && item.orderStage === "REQUESTED" && (
            <>
              <Button
                size="sm" disabled={busy === `poa:${item.id}`}
                onClick={() => void run(`poa:${item.id}`, () => approveAdProItemOrder(undefined, fdOf({ decision: "APPROVE" })), "Bon de commande visé — transmis aux Finances.")}
              >
                <ThumbsUp className="h-4 w-4" /> Viser le BC
              </Button>
              <Button
                size="sm" variant="outline" className="text-destructive" disabled={busy === `poa:${item.id}`}
                onClick={() => void run(`poa:${item.id}`, () => approveAdProItemOrder(undefined, fdOf({ decision: "REFUSE" })), "Émission refusée.")}
              >
                <ThumbsDown className="h-4 w-4" /> Refuser
              </Button>
            </>
          )}

          {canIssueOrder && item.orderStage === "DIRECTION_OK" && !item.expenseOrderId && (
            <Button
              size="sm" disabled={busy === `emit:${item.id}`}
              onClick={() => void run(`emit:${item.id}`, () => emitItemExpenseOrder(undefined, fdOf()), "Bon de commande émis (ordre de dépense créé).")}
            >
              {busy === `emit:${item.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Émettre (Finances)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
