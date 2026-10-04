"use client";

import * as React from "react";
import {
  AlertTriangle, ArrowUpRight, Check, Clock, Loader2, MapPin, RotateCcw, Send, Users, X,
} from "lucide-react";
import {
  planifierVisites, soumettrePlanTournee, escaladerPlanTournee, deciderPlanTournee, demanderRevisionPlanTournee,
} from "@/lib/actions/tour-plan-actions";
import { useRafraichir } from "@/components/shared/use-rafraichir";
import { STATUT_PLAN_LABELS, aResoumettre, gestesPossibles, type StatutPlan } from "@/lib/sfe/tournee";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface PraticienVue {
  id: string; name: string; specialty: string | null; institution: string | null;
  wilaya: string | null; potential: string | null; secteur: string | null;
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
  planId, repName, status, periodStart, periodEnd, joursOuvres, submittedAt, retard,
  reviewerName, escalatedToName, rejectionComment, resubmitDueAt,
  praticiens, panelVide, pairesInitiales, pairesAcquises, pairesNonTenues, pairesPassees, jeSuisLeKam, jePeuxDecider, jePeuxEscalader,
  revisionNote, revisionPar, revisionLe, jePeuxDemanderRevision,
}: {
  planId: string;
  repName: string;
  status: StatutPlan;
  periodStart: string;
  periodEnd: string;
  /** Les jours OUVRÉS de la période (semaine algérienne) — les seuls où l'on peut poser une visite. */
  joursOuvres: string[];
  submittedAt: string | null;
  /** Le retard de soumission, CALCULÉ par le chargeur — l'écran l'affiche, il ne le recalcule pas
   *  (un `new Date()` au rendu diverge entre serveur et navigateur). `echeance` est celle qui
   *  compte : la resoumission sur un plan rejeté, la soumission sinon. */
  retard: { enRetard: boolean; jours: number; echeance: string };
  reviewerName: string | null;
  escalatedToName: string | null;
  rejectionComment: string | null;
  resubmitDueAt: string | null;
  praticiens: PraticienVue[];
  /** La VRAIE cause d'un panel vide (`diagnosticPanelVide`), ou null quand le panel ne l'est pas. */
  panelVide?: string | null;
  pairesInitiales: string[];
  pairesAcquises: string[];
  /** Parmi les acquises, celles DITES non tenues (reportées, annulées) — le reste est rapporté. */
  pairesNonTenues: string[];
  /** Les visites passées d'un plan déjà validé : une révision ne les retire pas (§118.193). */
  pairesPassees: string[];
  jeSuisLeKam: boolean;
  jePeuxDecider: boolean;
  jePeuxEscalader: boolean;
  /** La révision en cours d'un plan validé — son motif, qui, quand. */
  revisionNote: string | null;
  revisionPar: string | null;
  revisionLe: string | null;
  /** Peut-il ÉCRIRE ce plan (le KAM, le superviseur de sa BU, la Direction) ? La même règle que l'action. */
  jePeuxDemanderRevision: boolean;
}) {
  // LE RAFRAÎCHISSEMENT SUIVI (§118.172) : les gestes restent fermés tant que l'écran montre l'état d'avant.
  const { enCours, rafraichir } = useRafraichir();
  const gestes = gestesPossibles(status);
  const acquises = React.useMemo(() => new Set(pairesAcquises), [pairesAcquises]);
  const nonTenues = React.useMemo(() => new Set(pairesNonTenues), [pairesNonTenues]);
  const passees = React.useMemo(() => new Set(pairesPassees), [pairesPassees]);

  const [paires, setPaires] = React.useState<Set<string>>(() => new Set(pairesInitiales));
  const [jour, setJour] = React.useState(joursOuvres[0] ?? "");
  const [wilaya, setWilaya] = React.useState("");
  const [secteur, setSecteur] = React.useState("");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [rejet, setRejet] = React.useState(false);
  const [sale, setSale] = React.useState(false);
  const [revision, setRevision] = React.useState(false);
  const [motifRevision, setMotifRevision] = React.useState("");
  const occupe = busy || enCours;

  // LA WILAYA, pas la ville : la ville a quitté les annuaires (texte libre tapé de trois façons
  // pour le même endroit) ; la wilaya est une liste fermée, donc un filtre qui ne ment pas.
  const wilayas = React.useMemo(
    () => [...new Set(praticiens.map((p) => p.wilaya).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "fr")),
    [praticiens],
  );
  const secteurs = React.useMemo(
    () => [...new Set(praticiens.map((p) => p.secteur).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b, "fr")),
    [praticiens],
  );

  const visibles = praticiens.filter((p) => {
    if (wilaya && p.wilaya !== wilaya) return false;
    if (secteur && p.secteur !== secteur) return false;
    if (!q.trim()) return true;
    return `${p.name} ${p.specialty ?? ""} ${p.institution ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  });

  const cle = (j: string, id: string) => `${j}|${id}`;
  const compteDuJour = (j: string) => [...paires].filter((k) => k.startsWith(`${j}|`)).length;

  const basculer = (j: string, id: string) => {
    const k = cle(j, id);
    // UNE VISITE DÉJÀ RAPPORTÉE NE SE DÉPLANIFIE PAS : elle a eu lieu. Celle d'un plan déjà validé dont l'heure
    // est passée non plus : la révision ne change que l'avenir (§118.193).
    if (acquises.has(k) || passees.has(k)) return;
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
    rafraichir();
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
    : status === "SUBMITTED" || status === "ESCALATED" || status === "REVISION" ? "warning" : "neutral";


  // Les visites du plan, groupées par jour, pour la lecture du validateur — les noms viennent du panel
  // que la page a déjà chargé ; un praticien sorti du panel depuis reste nommé « praticien hors panel ».
  const nomDe = React.useMemo(() => new Map(praticiens.map((p) => [p.id, p.name])), [praticiens]);
  const visitesParJour = React.useMemo(() => {
    const parJour = new Map<string, string[]>();
    for (const k of paires) {
      const [j, id] = k.split("|");
      parJour.set(j, [...(parJour.get(j) ?? []), nomDe.get(id) ?? "praticien hors panel"]);
    }
    return [...parJour.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [paires, nomDe]);

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
          {/* UN PLAN OUVERT (brouillon, rejeté) montre son échéance — ou son RETARD. Un plan rejeté
              porte encore la date de sa première soumission : la montrer ici dirait « soumis »
              d'un plan qu'il faut resoumettre. */}
          {!gestes.soumettable
            ? (submittedAt ? `Soumis le ${new Date(submittedAt).toLocaleDateString("fr-FR")}` : STATUT_PLAN_LABELS[status])
            : retard.enRetard
              ? (
                <span className="font-medium text-destructive">
                  En retard de {retard.jours} j — échéance dépassée le {new Date(retard.echeance).toLocaleDateString("fr-FR")}
                </span>
              )
              : `À ${aResoumettre(status) ? "resoumettre" : "soumettre"} avant le ${new Date(retard.echeance).toLocaleDateString("fr-FR")}`}
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

      {/* LA RÉVISION D'UN PLAN VALIDÉ PORTE SON MOTIF, QUI, QUAND, ET SON DÉLAI (§118.193). Le validateur la lit
          aussi une fois le plan resoumis : c'est ce qu'il doit juger. */}
      {revisionNote && (status === "REVISION" || status === "SUBMITTED" || status === "ESCALATED") && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">
            {status === "REVISION" ? "Plan validé, rouvert pour révision — à modifier puis resoumettre." : "Plan validé puis révisé — voici pourquoi."}
          </p>
          <p className="mt-1 whitespace-pre-wrap">« {revisionNote} »</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {revisionPar ? `Demandée par ${revisionPar}` : "Demandée"}
            {revisionLe ? ` le ${new Date(revisionLe).toLocaleDateString("fr-FR")}` : ""}
            {status === "REVISION" && resubmitDueAt
              ? ` · à resoumettre avant le ${new Date(resubmitDueAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} — les visites déjà passées restent au plan.`
              : "."}
          </p>
        </div>
      )}

      {err && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

      {/* ── DEMANDER UNE RÉVISION (§118.193) — un plan validé ne se réécrit pas sous les pieds du KAM : il se
          rouvre, motif à l'appui, et repasse en validation. ─────────────────────────────────────── */}
      {gestes.revisable && jePeuxDemanderRevision && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          {!revision ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-muted-foreground">La tournée a changé sur le terrain ? Le plan se révise, et repasse en validation.</p>
              <Button variant="outline" size="sm" disabled={occupe} onClick={() => { setErr(null); setRevision(true); }}>
                <RotateCcw className="h-4 w-4" /> Demander une révision
              </Button>
            </div>
          ) : (
            <form
              className="space-y-2"
              action={async (fd) => {
                fd.set("planId", planId);
                if (await run(demanderRevisionPlanTournee, fd)) { setRevision(false); setMotifRevision(""); }
              }}
            >
              <Label htmlFor="revision-note">Ce qui change dans la tournée</Label>
              <Textarea id="revision-note" name="note" rows={3} value={motifRevision} onChange={(e) => setMotifRevision(e.target.value)}
                placeholder="Le Dr Amrani est en congé la semaine du 18 ; je reporte ses visites et ajoute le CHU de Blida." />
              <p className="text-xs text-muted-foreground">
                Le plan repassera « En révision » : vous le modifiez, puis vous le resoumettez (48 h). Les visites déjà passées restent au plan.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={occupe} onClick={() => { setRevision(false); setMotifRevision(""); }}>Annuler</Button>
                <Button type="submit" size="sm" disabled={occupe || motifRevision.trim().length === 0}>
                  {occupe && <Loader2 className="h-4 w-4 animate-spin" />} Rouvrir pour révision
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── LA DÉCISION DU VALIDATEUR ───────────────────────────────────────── */}
      {(jePeuxDecider || jePeuxEscalader) && gestes.decidable && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="mr-auto text-sm">
            <strong>Ce plan attend votre décision.</strong> {paires.size} visite(s) sur la période.
          </p>
          {jePeuxEscalader && gestes.escaladable && (
            <Button
              variant="outline" size="sm" disabled={occupe}
              onClick={() => { const fd = new FormData(); fd.set("planId", planId); void run(escaladerPlanTournee, fd); }}
            >
              <ArrowUpRight className="h-4 w-4" /> Demander à mon N+1
            </Button>
          )}
          {jePeuxDecider && (
            <>
              <Button variant="outline" size="sm" disabled={occupe} onClick={() => { setErr(null); setRejet(true); }}>
                <X className="h-4 w-4" /> Rejeter
              </Button>
              <Button
                size="sm" disabled={occupe}
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

          {/* LE CADRE : la wilaya où il sera, ou son secteur. */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40">
              <Label htmlFor="plan-wilaya">Wilaya où je serai</Label>
              {/* Le menu se nourrit du panel : vide, il le DIT au lieu d'un « Toutes les wilayas » sans rien. */}
              <Select id="plan-wilaya" value={wilaya} onChange={(e) => setWilaya(e.target.value)} disabled={praticiens.length === 0}>
                <option value="">{praticiens.length === 0 ? "Aucune wilaya — panel vide" : "Toutes les wilayas"}</option>
                {wilayas.map((v) => <option key={v} value={v}>{v}</option>)}
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
                <strong>Votre panel est vide.</strong>{" "}
                {panelVide ?? "Un plan de tournée se construit sur votre territoire (les établissements qu'il couvre) et sur les praticiens qui vous sont rattachés."}
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
                  const rapportee = acquises.has(k);
                  const passee = !rapportee && passees.has(k);
                  const fige = rapportee || passee;
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
                        {p.wilaya && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" aria-hidden /> {p.wilaya}
                          </span>
                        )}
                        {p.secteur && <Badge tone="neutral" dot={false}>{p.secteur}</Badge>}
                        {rapportee && (nonTenues.has(k)
                          ? <span className="text-xs text-muted-foreground">dite non tenue</span>
                          : <span className="text-xs text-success">déjà rapportée</span>)}
                        {passee && <span className="text-xs text-muted-foreground">passée — reste au plan</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {sale && <span className="mr-auto text-xs text-warning">Modifications non enregistrées.</span>}
            <Button variant="outline" onClick={() => void enregistrer()} disabled={occupe || !sale}>
              {occupe && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer le plan
            </Button>
            <Button
              disabled={occupe || sale || paires.size === 0}
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
        <>
          {/* LE DÉTAIL, EN LECTURE (§118.184). Le validateur tranchait sur un nombre (« N visite(s) ») sans
              voir lesquelles : jour par jour, qui le KAM va voir — c'est exactement ce qu'il valide. */}
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" aria-hidden /> Visites prévues
            </p>
            {visitesParJour.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune visite planifiée.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {visitesParJour.map(([j, noms]) => (
                  <li key={j} className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:gap-3">
                    <span className="w-40 shrink-0 font-medium tabular-nums">{jourLisible(j)}</span>
                    <span className="min-w-0 flex-1 text-muted-foreground">{noms.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            {gestes.modifiable
              ? "Seul le KAM (ou le superviseur de sa BU) modifie ce plan."
              : gestes.revisable
                ? "Un plan validé ne se modifie pas en direct : sa tournée a commencé. « Demander une révision » le rouvre, motif à l'appui — il repasse en validation, et ce qui a déjà eu lieu reste."
                : `Un plan « ${STATUT_PLAN_LABELS[status]} » attend la décision de son validateur : il ne se modifie qu'une fois rejeté, ou validé puis rouvert en révision.`}
          </p>
        </>
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
            <Button type="button" variant="ghost" onClick={() => setRejet(false)} disabled={occupe}>Annuler</Button>
            <Button type="submit" variant="destructive" disabled={occupe}>
              {occupe && <Loader2 className="h-4 w-4 animate-spin" />} Rejeter
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
