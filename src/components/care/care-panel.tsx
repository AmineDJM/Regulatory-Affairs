"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, CheckCircle2, XCircle, UserPlus, Receipt, AlertTriangle,
  ThumbsUp, ThumbsDown, Minus, Send, FileText,
} from "lucide-react";
import type { CareBeneficiaryStatus, CareCellKind, CareCellStatus, CareOpinion, CareQuoteStatus, CareServiceKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  careProgress, financeReadiness, quoteSummary,
  BENEFICIARY_STATUS_LABELS, CELL_STATUS_LABELS, OPINION_LABELS,
  QUOTE_STATUS_LABELS, SERVICE_KINDS, SERVICE_KIND_LABELS,
} from "@/lib/care";
import {
  addCareBeneficiary, setCareOpinion, decideCareBeneficiary, removeCareBeneficiary,
  addCareCell, setCareCellStatus, removeCareCell,
  createCareQuote, decideCareQuote, requestCareQuotes, sendCareToFinance,
  linkCareCellPromoMaterial,
} from "@/lib/actions/care-actions";

export interface CellRow {
  id: string;
  kind: CareCellKind;
  serviceKind: CareServiceKind | null;
  label: string;
  notes: string | null;
  status: CareCellStatus;
  amountDzd: number | null;
  expenseOrderId: string | null;
  promoMaterialId: string | null;
  /** Résolu côté serveur — le matériel garde son circuit, on n'en montre que l'avancement. */
  promoMaterial: { reference: string; title: string; status: string } | null;
}

export interface BeneficiaryRow {
  id: string;
  name: string;
  subtitle: string;
  fromDirectory: boolean;
  requesterOpinion: CareOpinion;
  requesterNote: string | null;
  status: CareBeneficiaryStatus;
  decisionNote: string | null;
  cells: CellRow[];
}

export interface QuoteRow {
  id: string;
  supplier: string;
  reference: string | null;
  amountDzd: number;
  status: CareQuoteStatus;
  note: string | null;
  cellIds: string[];
  cellLabels: string[];
}

interface Props {
  scope: "NATIONAL" | "INTERNATIONAL";
  requestId: string;
  beneficiaries: BeneficiaryRow[];
  quotes: QuoteRow[];
  directory: { id: string; name: string; specialty: string | null; institution: string | null }[];
  /** La Direction a-t-elle validé l'événement ? Conditionne la demande de devis. */
  eventApproved: boolean;
  canEdit: boolean;
  /** Trancher : accorder une personne, accepter un devis, envoyer aux Finances. */
  canDecide: boolean;
  /** Matériels promotionnels rattachables à une case — ils gardent leur propre circuit. */
  promoOptions: { id: string; reference: string; title: string }[];
}

/**
 * PRISE EN CHARGE — une ligne par personne.
 *
 * Le module ne traite pas d'un congrès : il traite de **personnes** qu'on emmène quelque part.
 * Chacune est examinée séparément — on peut en accorder une et en écarter une autre — et
 * chacune a ses propres besoins : l'une a besoin d'un visa et pas l'autre, l'une loge à l'hôtel
 * et l'autre chez elle.
 *
 * D'où ce tableau, et non un formulaire commun : les cases appartiennent à la LIGNE, pas à une
 * colonne partagée. Le « + » ajoute un besoin **à cette personne-là**.
 *
 * Deux natures de cases, qui ne se traitent pas pareil :
 *   • une **pièce à fournir** — on la collecte ;
 *   • un **élément à acheter** — on demande un devis, il est accepté ou refusé d'un bloc, puis
 *     il devient une dépense.
 */
export function CarePanel({
  scope, requestId, beneficiaries, quotes, directory, eventApproved, canEdit, canDecide, promoOptions,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [quoting, setQuoting] = React.useState(false);
  const lock = React.useRef(false);

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, okText?: string) => {
    if (lock.current) return { ok: false };
    lock.current = true;
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? okText ?? "Terminé.") : (r.error ?? "Échec.") });
      if (r.ok) router.refresh();
      return r;
    } finally {
      setBusy(null);
      lock.current = false;
    }
  };

  const rows = beneficiaries.map((b) => ({ b, progress: careProgress(b.cells) }));
  const approved = rows.filter((r) => r.b.status === "APPROVED");
  const qs = quoteSummary(quotes.map((q) => ({ id: q.id, status: q.status, amountDzd: q.amountDzd, cellIds: q.cellIds })));
  const readiness = financeReadiness(
    rows.map((r) => ({ status: r.b.status, name: r.b.name, progress: r.progress })),
    quotes.map((q) => ({ id: q.id, status: q.status, amountDzd: q.amountDzd, cellIds: q.cellIds })),
  );
  // Les éléments à acheter encore sans devis — c'est eux qu'on envoie chiffrer.
  const toQuote = approved.flatMap((r) =>
    r.b.cells.filter((c) => c.kind === "SERVICE" && c.status === "REQUESTED").map((c) => ({ ...c, who: r.b.name })),
  );

  return (
    <div className="space-y-5">
      {/* ── Vue d'ensemble ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure label="Personnes proposées" value={String(beneficiaries.length)} />
        <Figure label="Accordées" value={String(approved.length)} tone={approved.length > 0 ? "success" : undefined} />
        <Figure label="Devis acceptés" value={formatCurrency(qs.acceptedDzd)} hint={`${qs.accepted} devis`} />
        <Figure
          label="Devis en attente"
          value={qs.pending > 0 ? formatCurrency(qs.pendingDzd) : "—"}
          hint={qs.pending > 0 ? `${qs.pending} à trancher` : undefined}
          tone={qs.pending > 0 ? "warning" : undefined}
        />
      </div>

      {msg && (
        <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {msg.text}
        </p>
      )}

      {/* ── Les personnes ── */}
      {beneficiaries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucune personne. Ajoutez qui vous souhaitez prendre en charge — depuis l&apos;annuaire, ou
          en saisissant son profil si elle n&apos;y figure pas encore.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ b, progress }) => (
            <li key={b.id} className="surface space-y-3 p-3">
              {/* Identité + avis + décision */}
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.name}</p>
                  {b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}
                  {!b.fromDirectory && <p className="text-[11px] text-muted-foreground/80">Profil saisi — pas à l&apos;annuaire</p>}
                </div>
                <StatusChip status={b.status} />
              </div>

              {/* L'avis du demandeur — « pas d'avis » est une réponse valable. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Avis du demandeur :</span>
                {canEdit && b.status === "PROPOSED" ? (
                  (["FAVORABLE", "UNFAVORABLE", "NONE"] as CareOpinion[]).map((o) => (
                    <button
                      key={o}
                      disabled={busy === `op:${b.id}`}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", b.id);
                        fd.set("opinion", o);
                        void run(`op:${b.id}`, () => setCareOpinion(undefined, fd), "Avis enregistré.");
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
                        b.requesterOpinion === o ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {o === "FAVORABLE" ? <ThumbsUp className="h-3 w-3" /> : o === "UNFAVORABLE" ? <ThumbsDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {OPINION_LABELS[o]}
                    </button>
                  ))
                ) : (
                  <Badge tone={b.requesterOpinion === "FAVORABLE" ? "success" : b.requesterOpinion === "UNFAVORABLE" ? "danger" : "neutral"} dot={false}>
                    {OPINION_LABELS[b.requesterOpinion]}
                  </Badge>
                )}
              </div>
              {b.requesterNote && <p className="text-xs italic text-muted-foreground">« {b.requesterNote} »</p>}
              {b.decisionNote && <p className="text-xs text-muted-foreground">Décision : {b.decisionNote}</p>}

              {/* La décision de la Direction, personne par personne. */}
              {canDecide && b.status === "PROPOSED" && (
                <div className="flex flex-wrap gap-2">
                  {(["APPROVED", "REJECTED"] as const).map((d) => (
                    <Button
                      key={d} size="sm" variant={d === "APPROVED" ? "primary" : "outline"}
                      disabled={busy === `dec:${b.id}`}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", b.id);
                        fd.set("decision", d);
                        void run(`dec:${b.id}`, () => decideCareBeneficiary(undefined, fd), d === "APPROVED" ? "Prise en charge accordée." : "Personne écartée.");
                      }}
                    >
                      {busy === `dec:${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : d === "APPROVED" ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                      {d === "APPROVED" ? "Accorder" : "Écarter"}
                    </Button>
                  ))}
                </div>
              )}

              {/* Les cases de CETTE personne. */}
              {b.status === "APPROVED" && (
                <div className="rounded-xl border border-border p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium">Ce qu&apos;il faut pour {b.name.split(" ")[0]}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {progress.settled}/{progress.total} réglé{progress.total > 1 ? "s" : ""}
                      {progress.costDzd > 0 ? ` · ${formatCurrency(progress.costDzd)}` : ""}
                    </span>
                    {progress.complete && <Badge tone="success" dot={false}>complet</Badge>}
                  </div>

                  {b.cells.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Rien de demandé pour l&apos;instant.</p>
                  ) : (
                    <ul className="mt-1.5 divide-y divide-border">
                      {b.cells.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                          <Badge tone={c.kind === "DOCUMENT" ? "info" : "purple"} dot={false}>
                            {c.kind === "DOCUMENT" ? "Pièce" : SERVICE_KIND_LABELS[c.serviceKind ?? "OTHER"]}
                          </Badge>
                          <span className="min-w-0 flex-1">{c.label}</span>
                          {c.amountDzd != null && <span className="tabular-nums text-xs">{formatCurrency(c.amountDzd)}</span>}
                          <Badge tone={c.status === "SETTLED" ? "success" : c.status === "WAIVED" ? "neutral" : c.status === "PROVIDED" ? "info" : "warning"} dot={false}>
                            {CELL_STATUS_LABELS[c.status]}
                          </Badge>
                          {c.serviceKind === "PROMO_MATERIAL" && (
                            c.promoMaterial ? (
                              <a href={`/promo-material/${c.promoMaterialId}`} className="text-xs font-medium text-primary hover:underline">
                                {c.promoMaterial.reference} · {c.promoMaterial.status}
                              </a>
                            ) : canEdit ? (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const fd = new FormData();
                                  fd.set("id", c.id);
                                  fd.set("promoMaterialId", e.target.value);
                                  void run(`pm:${c.id}`, () => linkCareCellPromoMaterial(undefined, fd), "Matériel rattaché.");
                                }}
                                aria-label={`Rattacher un matériel à « ${c.label} »`}
                                className="rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary/60"
                              >
                                <option value="">Rattacher un matériel…</option>
                                {promoOptions.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.title}</option>)}
                              </select>
                            ) : null
                          )}
                          {canEdit && !c.expenseOrderId && (
                            <>
                              <select
                                value={c.status}
                                onChange={(e) => {
                                  const fd = new FormData();
                                  fd.set("id", c.id);
                                  fd.set("status", e.target.value);
                                  void run(`cs:${c.id}`, () => setCareCellStatus(undefined, fd), "État mis à jour.");
                                }}
                                aria-label={`État de « ${c.label} »`}
                                className="rounded-lg border border-border bg-background px-1.5 py-1 text-[11px] outline-none focus:border-primary/60"
                              >
                                {(["REQUESTED", "PROVIDED", "SETTLED", "WAIVED"] as CareCellStatus[]).map((s) => (
                                  <option key={s} value={s}>{CELL_STATUS_LABELS[s]}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  const fd = new FormData();
                                  fd.set("id", c.id);
                                  void run(`cd:${c.id}`, () => removeCareCell(undefined, fd), "Élément retiré.");
                                }}
                                aria-label={`Retirer « ${c.label} »`}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canEdit && <AddCellForm beneficiaryId={b.id} busy={busy === `cell:${b.id}`} onSubmit={(fd) => void run(`cell:${b.id}`, () => addCareCell(undefined, fd), "Élément ajouté.")} />}
                </div>
              )}

              {canEdit && b.status !== "APPROVED" && (
                <button
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", b.id);
                    void run(`bd:${b.id}`, () => removeCareBeneficiary(undefined, fd), "Personne retirée.");
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        adding ? (
          <AddBeneficiaryForm
            scope={scope} requestId={requestId} directory={directory} busy={busy === "add"}
            onCancel={() => setAdding(false)}
            onSubmit={(fd) => void run("add", async () => {
              const r = await addCareBeneficiary(undefined, fd);
              if (r.ok) setAdding(false);
              return r;
            }, "Personne ajoutée.")}
          />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Ajouter une personne
          </Button>
        )
      )}

      {/* ── Devis ── */}
      {(quotes.length > 0 || toQuote.length > 0) && (
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Devis</h3>
            {toQuote.length > 0 && <Badge tone="warning" dot={false}>{toQuote.length} élément(s) à chiffrer</Badge>}
          </div>

          {canEdit && toQuote.length > 0 && (
            <Button
              size="sm" variant="outline" disabled={busy === "rq" || !eventApproved}
              title={eventApproved ? undefined : "La Direction n'a pas encore validé l'événement."}
              onClick={() => {
                const fd = new FormData();
                fd.set("scope", scope);
                fd.set("requestId", requestId);
                void run("rq", () => requestCareQuotes(undefined, fd));
              }}
            >
              {busy === "rq" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Demander les devis au secrétariat
            </Button>
          )}

          {quotes.length > 0 && (
            <ul className="divide-y divide-border">
              {quotes.map((q) => (
                <li key={q.id} className="space-y-1 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{q.supplier}</span>
                    {q.reference && <span className="font-mono text-[11px] text-muted-foreground">{q.reference}</span>}
                    <span className="tabular-nums">{formatCurrency(q.amountDzd)}</span>
                    <Badge tone={q.status === "ACCEPTED" ? "success" : q.status === "REJECTED" ? "danger" : "warning"} dot={false}>
                      {QUOTE_STATUS_LABELS[q.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Couvre : {q.cellLabels.join(" · ") || "—"}</p>
                  {q.note && <p className="text-xs italic text-muted-foreground">{q.note}</p>}
                  {canDecide && q.status === "PENDING" && (
                    <div className="flex gap-2 pt-0.5">
                      {(["ACCEPTED", "REJECTED"] as const).map((d) => (
                        <Button
                          key={d} size="sm" variant={d === "ACCEPTED" ? "primary" : "outline"} disabled={busy === `q:${q.id}`}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("id", q.id);
                            fd.set("decision", d);
                            void run(`q:${q.id}`, () => decideCareQuote(undefined, fd), d === "ACCEPTED" ? "Devis accepté — ordre de dépense émis." : "Devis refusé.");
                          }}
                        >
                          {busy === `q:${q.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {d === "ACCEPTED" ? "Accepter" : "Refuser"}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            quoting ? (
              <QuoteForm
                scope={scope} requestId={requestId} cells={toQuote} busy={busy === "nq"}
                onCancel={() => setQuoting(false)}
                onSubmit={(fd) => void run("nq", async () => {
                  const r = await createCareQuote(undefined, fd);
                  if (r.ok) setQuoting(false);
                  return r;
                }, "Devis enregistré.")}
              />
            ) : toQuote.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => setQuoting(true)}>
                <Plus className="h-4 w-4" /> Enregistrer un devis reçu
              </Button>
            ) : null
          )}
        </section>
      )}

      {/* ── Finances ── */}
      {canDecide && beneficiaries.length > 0 && (
        <section className="space-y-2 border-t border-border pt-4">
          {!readiness.ready && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" /> Le dossier n&apos;est pas complet
              </p>
              <ul className="mt-1 space-y-0.5">
                {readiness.blockers.map((b, i) => <li key={i} className="text-xs text-muted-foreground">• {b}</li>)}
              </ul>
            </div>
          )}
          <Button
            size="sm" disabled={!readiness.ready || busy === "fin"}
            onClick={() => {
              const fd = new FormData();
              fd.set("scope", scope);
              fd.set("requestId", requestId);
              void run("fin", () => sendCareToFinance(undefined, fd));
            }}
          >
            {busy === "fin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Transmettre aux Finances
          </Button>
        </section>
      )}
    </div>
  );
}

/** Ajouter une personne : depuis l'annuaire, ou en saisissant son profil. */
function AddBeneficiaryForm({ scope, requestId, directory, busy, onCancel, onSubmit }: {
  scope: string; requestId: string; directory: Props["directory"]; busy: boolean;
  onCancel: () => void; onSubmit: (fd: FormData) => void;
}) {
  const [mode, setMode] = React.useState<"directory" | "free">("directory");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex gap-2">
        {(["directory", "free"] as const).map((m) => (
          <button
            key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${mode === m ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            {m === "directory" ? "Depuis l'annuaire" : "Nouveau profil"}
          </button>
        ))}
      </div>

      {mode === "directory" ? (
        <label className="block text-xs">
          Personne
          <select name="doctorId" required className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60">
            <option value="">Choisir…</option>
            {directory.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ""}{d.institution ? ` (${d.institution})` : ""}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs">Prénom<input name="firstName" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>
          <label className="text-xs">Nom<input name="lastName" required className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>
          <label className="text-xs">Poste<input name="jobTitle" placeholder="Chef de service…" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>
          <label className="text-xs">Établissement<input name="institution" placeholder="CHU Mustapha…" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Ajouter
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

/** Ajouter un besoin à CETTE personne : une pièce à fournir ou un élément à acheter. */
function AddCellForm({ beneficiaryId, busy, onSubmit }: { beneficiaryId: string; busy: boolean; onSubmit: (fd: FormData) => void }) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<CareCellKind>("DOCUMENT");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
        <Plus className="h-3.5 w-3.5" /> Ajouter un élément
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); setOpen(false); }}
      className="mt-2 space-y-2 rounded-lg border border-border p-2"
    >
      <input type="hidden" name="beneficiaryId" value={beneficiaryId} />
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Nature
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as CareCellKind)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60">
            <option value="DOCUMENT">Pièce à fournir</option>
            <option value="SERVICE">Élément à acheter</option>
          </select>
        </label>
        {kind === "SERVICE" && (
          <label className="text-xs">
            Type
            <select name="serviceKind" className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60">
              {SERVICE_KINDS.map((s) => <option key={s} value={s}>{SERVICE_KIND_LABELS[s]}</option>)}
            </select>
          </label>
        )}
        <label className={`text-xs ${kind === "SERVICE" ? "" : "sm:col-span-2"}`}>
          Libellé
          <input name="label" required placeholder={kind === "DOCUMENT" ? "Copie du visa" : "Hôtel 3 nuits"} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60" />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</Button>
        <Button size="sm" type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </form>
  );
}

/** Un devis couvre CE QU'IL COUVRE : on coche les éléments concernés, éventuellement de plusieurs personnes. */
function QuoteForm({ scope, requestId, cells, busy, onCancel, onSubmit }: {
  scope: string; requestId: string; cells: { id: string; label: string; who: string }[];
  busy: boolean; onCancel: () => void; onSubmit: (fd: FormData) => void;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }} className="space-y-2 rounded-xl border border-border p-3">
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">Fournisseur<input name="supplier" required placeholder="Agence de voyage…" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>
        <label className="text-xs">Référence<input name="reference" placeholder="Facultatif" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>
        <label className="text-xs">Montant (DZD)<input name="amountDzd" type="number" min="0" step="1000" required className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm tabular-nums outline-none focus:border-primary/60" /></label>
      </div>

      <fieldset className="rounded-lg border border-border p-2">
        <legend className="px-1 text-xs font-medium">Ce que ce devis couvre</legend>
        <p className="mb-1 text-[11px] text-muted-foreground">
          Une agence chiffre souvent le groupe entier : cochez tout ce que ce devis inclut, même pour plusieurs personnes.
        </p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {cells.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="cellIds" value={c.id} className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{c.label} <span className="text-xs text-muted-foreground">— {c.who}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-xs">Note<input name="note" placeholder="Facultatif" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary/60" /></label>

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Enregistrer le devis</Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

function StatusChip({ status }: { status: CareBeneficiaryStatus }) {
  const tone = status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : status === "WITHDRAWN" ? "neutral" : "warning";
  return <Badge tone={tone} dot={false}>{BENEFICIARY_STATUS_LABELS[status]}</Badge>;
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
