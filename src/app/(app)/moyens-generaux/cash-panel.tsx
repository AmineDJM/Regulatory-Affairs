"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Loader2, Check, Plus, HandCoins, AlertTriangle, Lock,
  CalendarClock, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PETTY_CASH_STATUS_LABEL, periodLabel, MAX_RECHARGE_DAY } from "@/lib/petty-cash";
import { cashWarning } from "@/lib/general-means/continuous-cash";
import {
  allotPettyCash, confirmPettyCashReceipt, requestPettyCashTopUp, closePettyCash,
  decidePettyCashTopUp, setPettyCashPlan,
} from "@/lib/actions/petty-cash-actions";
import type { GeneralMeansView, GeneralMeansRemittance } from "@/lib/queries/general-means";

/**
 * LA CAISSE D'AVANCE, À L'ÉCRAN — une seule, continue.
 *
 * Une seule question guide la mise en page : **me reste-t-il de quoi payer ?** Le solde est donc
 * en haut, en gros, avant l'historique ; la rallonge se demande depuis le même endroit — c'est
 * au moment où l'on constate qu'il ne reste rien qu'on la demande.
 *
 * ── CE QUI A DISPARU D'ICI, ET POURQUOI ─────────────────────────────────────────────────────
 *
 * Un bloc « Dépenses de la caisse » listait les achats payés en liquide. Ils figuraient DÉJÀ
 * dans « Toutes les dépenses » juste en dessous, avec leur badge « caisse d'avance » : la même
 * dépense s'affichait deux fois, à deux endroits, avec deux compteurs — et l'on ne savait plus
 * laquelle lire ni laquelle corriger. Il n'y a plus qu'une liste, et elle se filtre.
 *
 * Le titre ne porte plus de mois non plus. La caisse ne se ferme pas au 1er : chaque remise
 * garde sa date, et l'historique les montre l'une après l'autre.
 */
export function CashPanel({ view, people }: { view: GeneralMeansView; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [pane, setPane] = React.useState<"none" | "topup" | "allot" | "plan">("none");
  const [grant, setGrant] = React.useState<Record<string, string>>({});

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) => {
    setBusy(key); setMsg(null);
    const r = await fn();
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? okText : (r.error ?? "Échec.") });
    if (r.ok) { setPane("none"); router.refresh(); }
  };

  const cash = view.cash;
  const fund = cash?.fund ?? null;
  const warning = cashWarning(fund, formatCurrency);
  /** La remise qui attend une confirmation de réception, quand c'est à moi de la donner. */
  const aConfirmer = view.isHolder ? cash?.remittances.filter((r) => r.status === "ALLOTTED") ?? [] : [];

  return (
    <div className="space-y-3">
      {cash && fund ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Caisse d&apos;avance</h2>
            <Badge tone={fund.received > 0 ? "success" : "warning"} dot={false}>
              {fund.received > 0 ? "Ouverte" : "En attente de réception"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {fund.remittanceCount} remise{fund.remittanceCount > 1 ? "s" : ""} en cours
              {cash.holder ? ` · détenue par ${cash.holder}` : ""}
            </span>
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
            <Figure label="Remis (non soldé)" value={formatCurrency(fund.remitted)} hint={`${fund.remittanceCount} remise${fund.remittanceCount > 1 ? "s" : ""}`} />
            <Figure
              label="Reçu (en main)" value={formatCurrency(fund.received)}
              hint={fund.awaitingReceipt ? `${formatCurrency(fund.awaitingAmount)} à confirmer` : undefined}
              tone={fund.awaitingReceipt ? "warning" : undefined}
            />
            <Figure label="Dépensé" value={formatCurrency(fund.spent)} hint={`${fund.usedPercent} %`} />
            <Figure
              label="Reste en caisse"
              value={formatCurrency(fund.remaining)}
              tone={fund.overspent ? "danger" : fund.lowOnCash ? "warning" : "success"}
            />
          </div>

          {/* CE QUE LE FOND A À DIRE — dépassement, épuisement, ou réception en attente. Un seul
              message à la fois : trois bandeaux empilés ne se lisent plus. */}
          {warning && (
            <p className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
              fund.overspent ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-warning/40 bg-warning/5 text-muted-foreground"
            }`}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </p>
          )}

          {/* CONFIRMER LA RÉCEPTION, REMISE PAR REMISE. Une somme décidée n'est pas une somme
              détenue : tant que la personne n'a pas dit l'avoir reçue, elle n'est pas dépensable. */}
          {aConfirmer.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              <span className="min-w-0 flex-1">
                <strong>{formatCurrency(r.amount)}</strong> vous ont été remis le {formatDate(r.remittedAt)} —
                cette somme n&apos;est pas dépensable tant que vous n&apos;avez pas confirmé l&apos;avoir reçue.
              </span>
              <Button size="sm" disabled={busy === `recv:${r.id}`} onClick={() => {
                const fd = new FormData(); fd.set("id", r.id);
                void run(`recv:${r.id}`, () => confirmPettyCashReceipt(fd), "Réception confirmée.");
              }}>
                {busy === `recv:${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} J&apos;ai reçu la somme
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {/* UN SEUL BOUTON DE DÉPENSE, et il est plus bas, avec la liste des dépenses. Le
                second bouton vivait ici, sur la caisse — même achat, même facture, même budget
                consommé, mais deux formulaires : on saisissait par le mauvais, et le fond se
                retrouvait faux sans qu'aucun écran ne le dise. Le moyen de paiement est devenu
                une case du formulaire unique. */}
            {view.isHolder && fund.received > 0 && (
              <Button size="sm" variant="outline" onClick={() => setPane(pane === "topup" ? "none" : "topup")}>
                <HandCoins className="h-4 w-4" /> Demander une rallonge
              </Button>
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
            {(view.isHolder || view.canAllot) && cash.currentId && (
              <Button size="sm" variant="outline" disabled={busy === "close"} onClick={() => {
                if (!window.confirm(
                  `Solder la caisse ? Les ${fund.remittanceCount} remise(s) en cours sont arrêtées d'un bloc, `
                  + `reliquat de ${formatCurrency(fund.remaining)}. Aucune dépense ne pourra plus y être imputée.`,
                )) return;
                const fd = new FormData(); fd.set("id", cash.currentId ?? "");
                void run("close", () => closePettyCash(fd), "Caisse soldée.");
              }}>
                <Lock className="h-4 w-4" /> Solder la caisse
              </Button>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon="Wallet"
          title="Aucune somme en caisse"
          description={view.canAllot
            ? "Remettez une somme à la personne qui achète au quotidien : elle confirmera l'avoir reçue, puis y imputera ses dépenses. Les remises suivantes s'ajouteront au fond — la caisse ne se ferme pas au changement de mois."
            : "L'administration n'a pas encore remis de somme pour ce département."}
        />
      )}

      {view.canAllot && (pane === "allot" || !cash) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("departmentId", view.department.id);
            void run("allot", () => allotPettyCash(fd), "Somme remise — elle s'ajoute au fond.");
          }}
          className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
        >
          <p className="text-sm font-medium">Remettre une somme en caisse</p>
          <p className="text-xs text-muted-foreground">
            Elle <strong>s&apos;ajoute</strong> au fond en cours et garde sa date : rien n&apos;est clos, rien ne
            sort de l&apos;écran.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Montant remis (DZD)
              <Input name="amount" inputMode="decimal" placeholder="0" required className="mt-1 h-9 text-right tabular-nums" />
            </label>
            <label className="text-xs">
              Remis à
              <select name="holderId" defaultValue={cash?.holderId ?? ""} className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
                <option value="">— Personne actuelle —</option>
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

      {cash && pane === "topup" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("cashId", cash.currentId ?? "");
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

      {/* RÉGLAGE MENSUEL — posé par les RH. La caisse ne se ferme plus au changement de mois,
          mais le RECHARGEMENT, lui, reste une échéance d'agenda : sans lui, la remise dépend d'un
          geste dont personne ne se souvient à date fixe, et l'on ne peut prévenir de rien. */}
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

      {/* L'HISTORIQUE DES REMISES — ce que la période servait à raconter, en mieux : chaque
          somme avec SA date, sans faire croire qu'un mois solde le précédent. */}
      {cash && cash.remittances.length > 0 && (
        <RemittanceList title={`Remises en cours (${cash.remittances.length})`} rows={cash.remittances} />
      )}
      {view.history.length > 0 && (
        <RemittanceList title="Remises soldées" rows={view.history} muted />
      )}
    </div>
  );
}

function RemittanceList({ title, rows, muted }: { title: string; rows: GeneralMeansRemittance[]; muted?: boolean }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-1.5 font-medium">Remise</th>
              <th scope="col" className="px-3 py-1.5 font-medium">Période</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Remis</th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">Dépensé</th>
              <th scope="col" className="px-3 py-1.5 font-medium">État</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-border ${muted ? "text-muted-foreground" : ""}`}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5">
                  {formatDate(r.remittedAt)}
                  {r.holder && <span className="block text-[0.6875rem] text-muted-foreground">{r.holder}</span>}
                  {r.note && <span className="block text-[0.6875rem] text-muted-foreground">{r.note}</span>}
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{periodLabel(r.period)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.spent > 0 ? formatCurrency(r.spent) : "—"}</td>
                <td className="px-3 py-1.5">
                  <Badge tone={PETTY_CASH_STATUS_LABEL[r.status].tone} dot={false}>{PETTY_CASH_STATUS_LABEL[r.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
