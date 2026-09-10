"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowUpRight, Check, Clock, Loader2, MapPin, Send, Users, X,
} from "lucide-react";
import {
  planifierVisites, soumettrePlanTournee, escaladerPlanTournee, deciderPlanTournee,
} from "@/lib/actions/tour-plan-actions";
import { STATUT_PLAN_LABELS, gestesPossibles, type StatutPlan } from "@/lib/sfe/tournee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface PraticienVue {
  id: string; name: string; specialty: string | null; institution: string | null;
  city: string | null; potential: string | null; secteur: string | null;
}

/**
 * LE PLANIFICATEUR DE TOURNÉE — la ville, puis les médecins, jour par jour.
 *
 * ── POURQUOI UN JOUR À LA FOIS, ET NON UNE GRILLE JOUR × MÉDECIN ────────────────────────────
 *
 * La demande le dit dans ces termes : « il sélectionne la ville dans laquelle il sera dispo la
 * semaine du 18, puis les médecins qu'il va voir — chaque jour de cette semaine ». Une grille de
 * vingt-deux colonnes × cent praticiens n'est lisible sur aucun téléphone, et c'est un téléphone
 * que le terrain a dans la main. On choisit donc un JOUR, on cadre par VILLE ou par SECTEUR, et
 * les praticiens du cadre s'offrent à cocher — le compte par jour reste visible en permanence,
 * sinon on ne sait plus où l'on en est de son mois.
 *
 * ── CE QUI EST PRÉ-SÉLECTIONNÉ ──────────────────────────────────────────────────────────────
 *
 * Rien n'est coché à sa place : ce serait décider de sa tournée. Ce qui est PRÉ-CADRÉ, c'est le
 * panel — les praticiens de ses secteurs et ceux qui lui sont rattachés, et eux seuls. Cocher un
 * praticien qui n'est pas à lui est impossible parce qu'il n'apparaît pas.
 *
 * ── LA SÉLECTION PART COMPLÈTE ──────────────────────────────────────────────────────────────
 *
 * L'enregistrement REMPLACE la sélection du plan : c'est ce qui fait que décocher retire. Les
 * visites DÉJÀ RAPPORTÉES sont montrées verrouillées — elles ont eu lieu, et les retirer
 * effacerait un fait au profit d'une intention.
 */
export function Planificateur({
  planId, repName, status, periodStart, periodEnd, joursOuvres, submissionDueAt, submittedAt,
  reviewerName, escalatedToName, rejectionComment, resubmitDueAt,
  praticiens, pairesInitiales, pairesAcquises, jeSuisLeKam, jePeuxDecider, jePeuxEscalader,
}: {
  planId: string;
  repName: string;
  status: StatutPlan;
  periodStart: string;
  periodEnd: string;
  /** Les jours OUVRÉS de la période (semaine algérienne) — les seuls où l'on peut poser une visite. */
  joursOuvres: string[];
  submissionDueAt: string;
  submittedAt: string | null;
  reviewerName: string | null;
  escalatedToName: string | null;
  rejectionComment: string | null;
  resubmitDueAt: string | null;
  praticiens: PraticienVue[];
  pairesInitiales: string[];
  pairesAcquises: string[];
  jeSuisLeKam: boolean;
  jePeuxDecider: boolean;
  jePeuxEscalader: boolean;
}) {
  const router = useRouter();
  const gestes = gestesPossibles(status);
  const acquises = React.useMemo(() => new Set(pairesAcquises), [pairesAcquises]);

  const [paires, setPaires] = React.useState<Set<string>>(() => new Set(pairesInitiales));
  const [jour, setJour] = React.useState(joursOuvres[0] ?? "");
  const [ville, setVille] = React.useState("");
  const [secteur, setSecteur] = React.useState("");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [rejet, setRejet] = React.useState(false);
  const [sale, setSale] = React.useState(false);

  const villes = React.useMemo(
    () => [...new Set(praticiens.map((p) => p.city).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "fr")),
    [praticiens],
  );
  const secteurs = React.useMemo(
    () => [...new Set(praticiens.map((p) => p.secteur).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b, "fr")),
    [praticiens],
  );

  const visibles = praticiens.filter((p) => {
    if (ville && p.city !== ville) return false;
    if (secteur && p.secteur !== secteur) return false;
    if (!q.trim()) return true;
    return `${p.name} ${p.specialty ?? ""} ${p.institution ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const cle = (j: string, id: string) => `${j}|${id}`;
  const compteDuJour = (j: string) => [...paires].filter((k) => k.startsWith(`${j}|`)).length;

  const basculer = (j: string, id: string) => {
    const k = cle(j, id);
    // UNE VISITE DÉJÀ RAPPORTÉE NE SE DÉPLANIFIE PAS : elle a eu lieu.
    if (acquises.has(k)) return;
    setPaires((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
    setSale(true);
  };

  const run = async (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) => {
    setBusy(true); setErr(null);
    const r = await action(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return false; }
    router.refresh();
    return true;
  };

  const enregistrer = async () => {
    const fd = new FormData();
    fd.set("planId", planId);
    for (const k of paires) fd.append("visite", k);
    if (await run(planifierVisites, fd)) setSale(false);
  };

  const jourLisible = (j: string) =>
    new Date(`${j}T09:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });

  const tonStatut = status === "APPROVED" ? "success" : status === "REJECTED" ? "danger"
    : status === "SUBMITTED" || status === "ESCALATED" ? "warning" : "neutral";

  return (
    <div className="space-y-4">
      {/* ── L'ÉTAT DU PLAN, ET CE QU'ON ATTEND ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
        <Badge tone={tonStatut}>{STATUT_PLAN_LABELS[status]}</Badge>
        <span className="text-muted-foreground">
          {repName} · {new Date(periodStart).toLocaleDateString("fr-FR")} → {new Date(periodEnd).toLocaleDateString("fr-FR")}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {submittedAt
            ? `Soumis le ${new Date(submittedAt).toLocaleDateString("fr-FR")}`
            : `À soumettre avant le ${new Date(submissionDueAt).toLocaleDateString("fr-FR")}`}
        </span>
        <span className="w-full text-xs text-muted-foreground">
          <strong className="text-foreground tabular-nums">{paires.size}</strong> visite(s) planifiée(s)
          {reviewerName && <> · validateur : {reviewerName}</>}
          {escalatedToName && <> · escaladé à {escalatedToName}</>}
        </span>
      </div>

      {/* LE REJET PORTE SON MOTIF ET SON DÉLAI. Un rejet sans motif ne se corrige pas, il se
          subit — et un délai qu'on ne voit pas se rate. */}
      {status === "REJECTED" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium">Plan rejeté — à corriger et resoumettre.</p>
          {rejectionComment && <p className="mt-1 whitespace-pre-wrap">{rejectionComment}</p>}
          {resubmitDueAt && (
            <p className="mt-1 text-xs">
              Vous avez jusqu&apos;au {new Date(resubmitDueAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} pour resoumettre.
            </p>
          )}
        </div>
      )}

      {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      {/* ── LA DÉCISION DU VALIDATEUR ───────────────────────────────────────── */}
      {(jePeuxDecider || jePeuxEscalader) && gestes.decidable && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="mr-auto text-sm">
            <strong>Ce plan attend votre décision.</strong> {paires.size} visite(s) sur la période.
          </p>
          {jePeuxEscalader && gestes.escaladable && (
            <Button
              variant="outline" size="sm" disabled={busy}
              onClick={() => { const fd = new FormData(); fd.set("planId", planId); void run(escaladerPlanTournee, fd); }}
            >
              <ArrowUpRight className="h-4 w-4" /> Demander à mon N+1
            </Button>
          )}
          {jePeuxDecider && (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => { setErr(null); setRejet(true); }}>
                <X className="h-4 w-4" /> Rejeter
              </Button>
              <Button
                size="sm" disabled={busy}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("planId", planId); fd.set("decision", "APPROVE");
                  void run(deciderPlanTournee, fd);
                }}
              >
                <Check className="h-4 w-4" /> Valider le plan
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── LA PLANIFICATION ────────────────────────────────────────────────── */}
      {gestes.modifiable && jeSuisLeKam ? (
        <>
          {/* LES JOURS OUVRÉS, avec leur compte. La semaine ouvrée algérienne va du dimanche au
              jeudi : proposer un vendredi ferait planifier un jour où personne ne sort. */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jour de la tournée</p>
            <div className="flex flex-wrap gap-1.5">
              {joursOuvres.map((j) => {
                const n = compteDuJour(j);
                return (
                  <button
                    key={j} type="button" onClick={() => setJour(j)}
                    aria-current={j === jour ? "true" : undefined}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs tabular-nums",
                      j === jour ? "bg-primary text-primary-foreground" : "border border-input hover:bg-secondary",
                    )}
                  >
                    {jourLisible(j)}
                    {n > 0 && <span className={cn("ml-1 rounded px-1", j === jour ? "bg-primary-foreground/20" : "bg-secondary")}>{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LE CADRE : la ville où il sera, ou son secteur. */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40">
              <Label htmlFor="plan-ville">Ville où je serai</Label>
              <Select id="plan-ville" value={ville} onChange={(e) => setVille(e.target.value)}>
                <option value="">Toutes les villes</option>
                {villes.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </div>
            {secteurs.length > 0 && (
              <div className="min-w-40">
                <Label htmlFor="plan-secteur">Secteur</Label>
                <Select id="plan-secteur" value={secteur} onChange={(e) => setSecteur(e.target.value)}>
                  <option value="">Tous mes secteurs</option>
                  {secteurs.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            )}
            <div className="min-w-48 flex-1">
              <Label htmlFor="plan-q">Chercher un praticien</Label>
              <Input id="plan-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, spécialité, établissement" />
            </div>
          </div>

          {/* LES PRATICIENS DU CADRE, à cocher pour le jour choisi. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" aria-hidden /> Praticiens à voir le {jour ? jourLisible(jour) : "—"}
              </p>
              <span className="text-xs text-muted-foreground">{visibles.length} dans ce cadre</span>
            </div>
            {praticiens.length === 0 ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <strong>Votre panel est vide.</strong> Un plan de tournée se construit sur vos secteurs (les
                établissements qu&apos;ils couvrent) et sur les praticiens qui vous sont rattachés. Demandez au
                superviseur de votre BU de vous affecter un secteur (Force de vente › Business Units).
              </p>
            ) : (
              <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {visibles.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Aucun praticien dans ce cadre — élargissez la ville ou le secteur.
                  </p>
                )}
                {visibles.map((p) => {
                  const k = cle(jour, p.id);
                  const fige = acquises.has(k);
                  return (
                    <label
                      key={p.id}
                      className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-secondary", fige && "cursor-not-allowed opacity-70")}
                    >
                      <input
                        type="checkbox" checked={paires.has(k)} disabled={fige || !jour}
                        onChange={() => basculer(jour, p.id)}
                        className="mt-0.5 h-4 w-4 rounded border-input"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[p.specialty, p.institution].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        {p.city && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" aria-hidden /> {p.city}
                          </span>
                        )}
                        {p.secteur && <Badge tone="neutral" dot={false}>{p.secteur}</Badge>}
                        {fige && <span className="text-xs text-success">déjà rapportée</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {sale && <span className="mr-auto text-xs text-warning">Modifications non enregistrées.</span>}
            <Button variant="outline" onClick={() => void enregistrer()} disabled={busy || !sale}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer le plan
            </Button>
            <Button
              disabled={busy || sale || paires.size === 0}
              onClick={() => { const fd = new FormData(); fd.set("planId", planId); void run(soumettrePlanTournee, fd); }}
            >
              <Send className="h-4 w-4" /> Soumettre à validation
            </Button>
          </div>
          {sale && (
            // ENREGISTRER AVANT DE SOUMETTRE : soumettre une sélection non enregistrée ferait
            // valider un plan que le validateur ne verrait pas — le faux succès le plus simple.
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Enregistrez d&apos;abord : votre validateur ne peut voir que ce qui est enregistré.
            </p>
          )}
        </>
      ) : (
        <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          {gestes.modifiable
            ? "Seul le KAM (ou le superviseur de sa BU) modifie ce plan."
            : `Un plan « ${STATUT_PLAN_LABELS[status]} » ne se modifie plus : les visites sont parties chez le KAM, et changer sa tournée sous ses pieds est ce qu'un plan validé doit empêcher.`}
        </p>
      )}

      {/* ── LE REJET, AVEC SES COMMENTAIRES ─────────────────────────────────── */}
      <Sheet open={rejet} onClose={() => setRejet(false)} title="Rejeter le plan" width="md"
        description="Dites ce qui doit changer : un rejet sans motif ne se corrige pas, il se subit. Le KAM aura 48 h pour resoumettre.">
        <form
          className="space-y-3"
          action={async (fd) => {
            fd.set("planId", planId); fd.set("decision", "REJECT");
            if (await run(deciderPlanTournee, fd)) setRejet(false);
          }}
        >
          <div>
            <Label htmlFor="rejet-comment">Commentaires de rectification</Label>
            <Textarea id="rejet-comment" name="comment" rows={4} required
              placeholder="Trop de libéraux la première semaine, pas assez de CHU ; revoir le mardi 20." />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRejet(false)} disabled={busy}>Annuler</Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Rejeter
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
