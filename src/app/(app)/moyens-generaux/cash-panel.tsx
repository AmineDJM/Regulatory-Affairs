"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Loader2, Check, Plus, Receipt, HandCoins, AlertTriangle, Lock, FileText, Download,
  CalendarClock, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PETTY_CASH_STATUS_LABEL, periodLabel, MAX_RECHARGE_DAY } from "@/lib/petty-cash";
import { ReceiptLines, type CatalogArticle } from "./receipt-lines";
import { BudgetTargetField } from "./budget-target-field";
import type { BudgetTarget } from "@/lib/budget/target";
import {
  allotPettyCash, confirmPettyCashReceipt, spendFromPettyCash, requestPettyCashTopUp, closePettyCash,
  decidePettyCashTopUp, setPettyCashPlan,
} from "@/lib/actions/petty-cash-actions";
import type { GeneralMeansView } from "@/lib/queries/general-means";

/**
 * LA CAISSE D'AVANCE, À L'ÉCRAN.
 *
 * Une seule question guide la mise en page : **me reste-t-il de quoi payer ?** Le solde est
 * donc en haut, en gros, avant l'historique ; la dépense s'y ajoute juste en dessous, avec son
 * justificatif obligatoire ; la rallonge se demande depuis le même endroit, sans changer
 * d'écran — c'est au moment où l'on constate qu'il ne reste rien qu'on la demande.
 */
export function CashPanel({ view, people, articles, budgetTargets = [] }: { view: GeneralMeansView; people: { id: string; name: string }[]; articles: CatalogArticle[]; budgetTargets?: BudgetTarget[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pane, setPane] = React.useState<"none" | "spend" | "topup" | "allot" | "plan">("none");
  const [grant, setGrant] = React.useState<Record<string, string>>({});

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setBusy(key); setMsg(null);
    const r = await fn();
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? okText : (r.error ?? "Échec.") });
    if (r.ok) { setPane("none"); router.refresh(); }
  };

  const cash = view.cash;
  const b = cash?.balance;

  return (
    <div className="space-y-3">
      {cash ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Caisse d&apos;avance — {periodLabel(cash.period)}</h2>
            <Badge tone={PETTY_CASH_STATUS_LABEL[cash.status].tone} dot={false}>
              {PETTY_CASH_STATUS_LABEL[cash.status].label}
            </Badge>
            {cash.holder && <span className="text-xs text-muted-foreground">détenue par {cash.holder}</span>}
          </div>

          {view.plan?.isActive && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Rechargement mensuel réglé par les RH : <strong className="text-foreground">{formatCurrency(view.plan.monthlyAmount)}</strong>
              le {view.plan.rechargeDay} de chaque mois
              {view.plan.nextRechargeAt && <> — prochain le <strong className="text-foreground">{formatDate(view.plan.nextRechargeAt)}</strong></>}.
              Les ressources humaines en sont prévenues <strong>48 h avant</strong>.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="Remis" value={formatCurrency(cash.amount)} />
            <Figure label="Reçu" value={b!.received > 0 ? formatCurrency(b!.received) : "—"} hint={cash.receivedAt ? formatDate(cash.receivedAt) : "à confirmer"} />
            <Figure label="Dépensé" value={formatCurrency(b!.spent)} hint={`${b!.usedPercent} %`} />
            <Figure
              label="Reste en caisse"
              value={formatCurrency(b!.remaining)}
              tone={b!.overspent ? "danger" : b!.lowOnCash ? "warning" : "success"}
            />
          </div>

          {cash.status === "ALLOTTED" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                La somme est <strong>décidée mais pas encore confirmée</strong> : rien n&apos;est disponible tant que
                la réception n&apos;est pas marquée.
              </span>
              {view.isHolder && (
                <Button size="sm" disabled={busy === "recv"} onClick={() => {
                  const fd = new FormData(); fd.set("id", cash.id);
                  void run("recv", () => confirmPettyCashReceipt(fd), "Réception confirmée.");
                }}>
                  {busy === "recv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} J&apos;ai reçu la somme
                </Button>
              )}
            </div>
          )}

          {b!.lowOnCash && cash.status === "RECEIVED" && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>Le fond s&apos;épuise — demandez une rallonge <strong>avant</strong> d&apos;être à sec.</span>
            </p>
          )}
          {b!.overspent && (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Les dépenses dépassent la somme reçue de {formatCurrency(-b!.remaining)}. À régulariser.</span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {view.isHolder && cash.status === "RECEIVED" && (
              <>
                <Button size="sm" onClick={() => setPane(pane === "spend" ? "none" : "spend")}>
                  <Receipt className="h-4 w-4" /> Enregistrer une dépense
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPane(pane === "topup" ? "none" : "topup")}>
                  <HandCoins className="h-4 w-4" /> Demander une rallonge
                </Button>
              </>
            )}
            {view.canAllot && (
              <>
                <Button size="sm" variant="outline" onClick={() => setPane(pane === "allot" ? "none" : "allot")}>
                  <Plus className="h-4 w-4" /> Remettre une somme
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPane(pane === "plan" ? "none" : "plan")}>
                  <CalendarClock className="h-4 w-4" /> Réglage mensuel
                </Button>
              </>
            )}
            {(view.isHolder || view.canAllot) && cash.status !== "CLOSED" && (
              <Button size="sm" variant="outline" disabled={busy === "close"} onClick={() => {
                if (!window.confirm("Solder cette caisse ? Aucune dépense ne pourra plus y être imputée.")) return;
                const fd = new FormData(); fd.set("id", cash.id);
                void run("close", () => closePettyCash(fd), "Caisse soldée.");
              }}>
                <Lock className="h-4 w-4" /> Solder
              </Button>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon="Wallet"
          title="Aucune caisse d'avance ce mois-ci"
          description={view.canAllot
            ? "Remettez une somme à la personne qui achète au quotidien : elle confirmera l'avoir reçue, puis y imputera ses dépenses."
            : "L'administration n'a pas encore remis de somme pour ce mois."}
        />
      )}

      {view.canAllot && (pane === "allot" || !cash) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("departmentId", view.department.id);
            void run("allot", () => allotPettyCash(fd), cash ? "Rallonge remise." : "Caisse ouverte.");
          }}
          className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
        >
          <p className="text-sm font-medium">{cash ? "Rallonge — la somme s'ajoute au fond du mois" : "Remettre la caisse du mois"}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Montant remis (DZD)
              <Input name="amount" inputMode="decimal" placeholder="0" required className="mt-1 h-9 text-right tabular-nums" />
            </label>
            <label className="text-xs">
              Remis à
              <select name="holderId" defaultValue={cash?.holderId ?? ""} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                <option value="">— Choisir la personne —</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-xs">
              Précision
              <Input name="note" placeholder="Facultatif" className="mt-1 h-9" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy === "allot"}>
              {busy === "allot" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Remettre
            </Button>
            {cash && <Button size="sm" type="button" variant="outline" onClick={() => setPane("none")}>Annuler</Button>}
          </div>
        </form>
      )}

      {cash && pane === "spend" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("cashId", cash.id);
            fd.set("year", String(view.year));
            void run("spend", () => spendFromPettyCash(fd), "Dépense enregistrée et déduite de la caisse.");
          }}
          className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3"
        >
          <p className="text-sm font-medium">Ticket de caisse</p>
          <label className="block text-xs">
            Objet
            <Input name="label" placeholder="Facultatif — résumé depuis les articles si vide" className="mt-1 h-9" />
          </label>

          {/* UN TICKET, PLUSIEURS ARTICLES. Le montant de la dépense est la somme des lignes :
              c'est ce qui permet de savoir ce qu'on achète, et pas seulement ce qu'on paie. */}
          <div className="rounded-lg border border-border bg-background p-2">
            <p className="mb-1.5 text-xs font-medium">
              Articles du ticket <span className="text-destructive">*</span>
              <span className="ml-1 font-normal text-muted-foreground">— le montant en découle</span>
            </p>
            <ReceiptLines articles={articles} budgetTargets={budgetTargets} />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <BudgetTargetField targets={budgetTargets} />
          </div>

          <label className="block text-xs">
            Précisions
            <Input name="notes" placeholder="Facultatif" className="mt-1 h-9" />
          </label>
          <label className="block text-xs">
            Ticket de caisse / facture scanné <span className="text-destructive">*</span>
            <input type="file" name="files" multiple required className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium" />
          </label>
          <p className="text-[0.6875rem] text-muted-foreground">
            La dépense est déduite de la caisse <strong>et</strong> imputée au budget des moyens généraux :
            c&apos;est le même argent, vu de deux endroits.
          </p>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy === "spend"}>
              {busy === "spend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Enregistrer
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setPane("none")}>Annuler</Button>
          </div>
        </form>
      )}

      {cash && pane === "topup" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("cashId", cash.id);
            void run("topup", () => requestPettyCashTopUp(fd), "Rallonge demandée — l'administration est prévenue.");
          }}
          className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3"
        >
          <p className="text-sm font-medium">Demander une rallonge</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Montant demandé (DZD)
              <Input name="amount" inputMode="decimal" required placeholder="0" className="mt-1 h-9 text-right tabular-nums" />
            </label>
            <label className="text-xs sm:col-span-2">
              Motif
              <Input name="reason" placeholder="Ex. achats de fin de mois, fournitures épuisées…" className="mt-1 h-9" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy === "topup"}>
              {busy === "topup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />} Envoyer la demande
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setPane("none")}>Annuler</Button>
          </div>
        </form>
      )}

      {/* RÉGLAGE MENSUEL — posé par les RH. Sans lui, la caisse dépend d'un geste dont personne
          ne se souvient à date fixe, et l'on ne peut prévenir de rien. */}
      {view.canAllot && pane === "plan" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("departmentId", view.department.id);
            void run("plan", () => setPettyCashPlan(fd), "Réglage mensuel enregistré.");
          }}
          className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3"
        >
          <p className="text-sm font-medium">Réglage mensuel de la caisse</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Somme remise chaque mois (DZD)
              <Input name="monthlyAmount" inputMode="decimal" required defaultValue={view.plan?.monthlyAmount || ""} className="mt-1 h-9 text-right tabular-nums" />
            </label>
            <label className="text-xs">
              Jour du rechargement
              <Input name="rechargeDay" type="number" min={1} max={MAX_RECHARGE_DAY} defaultValue={view.plan?.rechargeDay ?? 1} className="mt-1 h-9 text-right tabular-nums" />
              <span className="text-[0.6875rem] text-muted-foreground">1 à {MAX_RECHARGE_DAY} — le 31 n&apos;existe pas tous les mois.</span>
            </label>
            <label className="text-xs">
              Remis à
              <select name="holderId" defaultValue={view.plan?.holderId ?? cash?.holderId ?? ""} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                <option value="">— Choisir la personne —</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="isActive" value="1" defaultChecked={view.plan?.isActive ?? true} className="h-4 w-4 rounded border-input" />
            Rechargement actif (les RH sont prévenues 48 h avant chaque échéance)
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={busy === "plan"}>
              {busy === "plan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Enregistrer
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setPane("none")}>Annuler</Button>
          </div>
        </form>
      )}

      {/* LES RALLONGES — accordées AU MONTANT QUE LES RH ÉCRIVENT, refusées, ou en attente. */}
      {view.topUps.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rallonges demandées ({view.topUps.filter((t) => t.status === "PENDING").length} en attente)
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {view.topUps.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">+{formatCurrency(t.amountRequested)} demandés</span>
                  {t.reason && <span className="block text-xs text-muted-foreground">{t.reason}</span>}
                  <span className="block text-[0.6875rem] text-muted-foreground">
                    {t.requester || "—"} · {formatDate(t.createdAt)}
                    {t.decisionNote ? ` · ${t.decisionNote}` : ""}
                  </span>
                </span>
                {t.status === "PENDING" ? (
                  view.canAllot ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Input
                        value={grant[t.id] ?? String(t.amountRequested)}
                        onChange={(e) => setGrant((p) => ({ ...p, [t.id]: e.target.value }))}
                        inputMode="decimal" aria-label="Montant accordé"
                        className="h-8 w-28 text-right tabular-nums"
                      />
                      <button type="button" disabled={busy === `top:${t.id}`} onClick={() => {
                        const fd = new FormData();
                        fd.set("id", t.id); fd.set("decision", "APPROVED");
                        fd.set("amountGranted", grant[t.id] ?? String(t.amountRequested));
                        void run(`top:${t.id}`, () => decidePettyCashTopUp(fd), "Rallonge accordée.");
                      }} className="inline-flex items-center gap-1 rounded-md border border-success/30 px-2 py-1 text-xs font-medium text-success hover:bg-success/10 disabled:opacity-50">
                        {busy === `top:${t.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />} Accorder
                      </button>
                      <button type="button" disabled={busy === `top:${t.id}`} onClick={() => {
                        const fd = new FormData();
                        fd.set("id", t.id); fd.set("decision", "REJECTED");
                        void run(`top:${t.id}`, () => decidePettyCashTopUp(fd), "Rallonge refusée.");
                      }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                        <ThumbsDown className="h-3.5 w-3.5" /> Refuser
                      </button>
                    </span>
                  ) : <Badge tone="warning" dot={false}>En attente des RH</Badge>
                ) : (
                  <Badge tone={t.status === "APPROVED" ? "success" : "danger"} dot={false}>
                    {t.status === "APPROVED" ? `Accordée — ${formatCurrency(t.amountGranted ?? 0)}` : "Refusée"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {msg && (
        <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.text}
        </p>
      )}

      {cash && cash.lines.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dépenses de la caisse ({cash.lines.length})
          </h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {cash.lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{l.label}</span>
                  {l.notes && <span className="block text-xs text-muted-foreground">{l.notes}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(l.date)}</span>
                <span className="tabular-nums font-semibold">− {formatCurrency(l.amount)}</span>
                <span className="flex items-center gap-1">
                  {l.documents.length === 0 ? (
                    <Badge tone="danger" dot={false}>sans pièce</Badge>
                  ) : l.documents.map((d) => (
                    <a
                      key={d.id}
                      href={`/api/documents/${d.id}?dl=1`}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.6875rem] hover:bg-secondary"
                      title={d.name}
                    >
                      <FileText className="h-3 w-3" /> <Download className="h-3 w-3" />
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.history.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mois précédents</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {view.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 font-medium">{periodLabel(h.period)}</span>
                <span className="text-xs text-muted-foreground">remis {formatCurrency(h.amount)}</span>
                <span className="text-xs text-muted-foreground">dépensé {formatCurrency(h.spent)}</span>
                <span className="tabular-nums">{formatCurrency(h.amount - h.spent)}</span>
                <Badge tone={PETTY_CASH_STATUS_LABEL[h.status].tone} dot={false}>{PETTY_CASH_STATUS_LABEL[h.status].label}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "warning" | "success" }) {
  const cls = tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "";
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}
