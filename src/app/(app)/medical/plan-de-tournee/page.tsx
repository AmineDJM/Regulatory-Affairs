import Link from "next/link";
import { ArrowRight, CalendarRange } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { visibleTabs } from "@/lib/nav-tabs";
import { MEDICAL_TABS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { loadPanelPlanifiable, loadPlanTournee } from "@/lib/queries/tour-schedule";
import {
  GRANULARITE_LABELS, STATUT_PLAN_LABELS, estJourOuvrePourTournee, periodeSuivante, retardDeSoumission,
  type StatutPlan,
} from "@/lib/sfe/tournee";
import { lireReglageTournee } from "@/lib/sfe/tournee-reglage";
import { OuvrirPlan } from "./ouvrir-plan";
import { Planificateur } from "./planificateur";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan de tournée — AMD Internal OS" };

/**
 * LE PLAN DE TOURNÉE — l'écran où un KAM prépare son mois, et où son N+1 le tranche.
 *
 * ── DEUX PUBLICS, UN SEUL ÉCRAN ─────────────────────────────────────────────────────────────
 *
 * Le KAM y planifie ; le validateur y décide. Deux écrans auraient fait deux vérités sur l'état
 * d'un plan, et le validateur aurait tranché sur une liste qu'il ne peut pas déplier. Ce que
 * chacun peut FAIRE vient du module pur (`gestesPossibles`) et des droits — pas de la route.
 *
 * ── LA LISTE DES PLANS À DÉCIDER N'EST PAS UNE PROMESSE D'ÉCRAN ─────────────────────────────
 *
 * Un plan soumis qu'aucun écran ne montre reste soumis pour toujours, et le KAM attend une
 * décision que personne ne sait devoir prendre (§118.50). La liste « à décider » est donc là,
 * chargée sur `reviewerId` / `escalatedToId` — les deux colonnes que l'action écrit.
 */
export default async function PlanDeTourneePage({ searchParams }: { searchParams?: { plan?: string } }) {
  const user = await requireModule("MEDICAL");
  // LE RÉGLAGE VIENT DU LECTEUR UNIQUE — le même que l'action qui ouvre un plan et que le
  // tableau de bord de la Direction (§118.5).
  const [settings, reglage] = await Promise.all([getAppSettings(), lireReglageTournee()]);
  const granularite = reglage.granularite;
  const maintenant = new Date();
  const retardDe = (p: { status: string; submissionDueAt: Date; resubmitDueAt: Date | null }) =>
    retardDeSoumission({ statut: p.status as StatutPlan, echeance: p.submissionDueAt, resoumissionAvant: p.resubmitDueAt, maintenant });

  // ── CE QUI M'ATTEND, MOI ────────────────────────────────────────────────────────────────
  const [mesPlans, aDecider] = await Promise.all([
    prisma.tourPlan.findMany({
      where: { repId: user.id },
      orderBy: { periodStart: "desc" },
      take: 8,
      select: {
        id: true, periodStart: true, periodEnd: true, status: true, submissionDueAt: true, resubmitDueAt: true,
        _count: { select: { visits: true } },
      },
    }),
    prisma.tourPlan.findMany({
      where: {
        OR: [
          { reviewerId: user.id, status: "SUBMITTED" },
          { escalatedToId: user.id, status: "ESCALATED" },
          // UNE VUE GLOBALE VOIT TOUT CE QUI ATTEND : sans cette branche, un plan dont le
          // validateur a quitté l'entreprise n'apparaîtrait sur aucun écran et resterait soumis
          // pour toujours — le KAM attendant une décision que personne ne sait devoir prendre.
          ...(hasGlobalView(user) ? [{ status: { in: ["SUBMITTED" as const, "ESCALATED" as const] } }] : []),
        ],
      },
      orderBy: { submittedAt: "asc" },
      take: 20,
      select: {
        id: true, periodStart: true, periodEnd: true, status: true, submittedAt: true,
        rep: { select: { name: true } }, _count: { select: { visits: true } },
      },
    }),
  ]);

  const planId = searchParams?.plan ?? null;
  const plan = planId ? await loadPlanTournee(planId) : null;
  const panel = plan ? await loadPanelPlanifiable(plan.repId) : [];

  // LES JOURS OUVRÉS DE LA PÉRIODE — la semaine ouvrée algérienne (dimanche → jeudi). Proposer
  // un vendredi ferait planifier un jour où personne ne sort, et la soumission le refuserait.
  const joursOuvres: string[] = [];
  if (plan) {
    for (const d = new Date(plan.periodStart); d <= plan.periodEnd; d.setDate(d.getDate() + 1)) {
      if (estJourOuvrePourTournee(d)) {
        joursOuvres.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
    }
  }

  const suivante = periodeSuivante(granularite, new Date());
  const canPlan = userCan(user, "MEDICAL", "CREATE");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Plan de tournée"
        description={`La ville où vous serez, les médecins que vous verrez, jour par jour — puis la validation de votre N+1. Maille ${GRANULARITE_LABELS[granularite].toLowerCase()}.`}
      />
      <ModuleTabs tabs={await visibleTabs(user, MEDICAL_TABS)} />

      {plan ? (
        <>
          <Link href="/medical/plan-de-tournee" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            ← Tous les plans
          </Link>
          <Planificateur
            planId={plan.id}
            repName={plan.repName}
            status={plan.status as StatutPlan}
            periodStart={plan.periodStart.toISOString()}
            periodEnd={plan.periodEnd.toISOString()}
            joursOuvres={joursOuvres}
            submittedAt={plan.submittedAt?.toISOString() ?? null}
            retard={{ enRetard: plan.retard.enRetard, jours: plan.retard.jours, echeance: plan.retard.echeance.toISOString() }}
            reviewerName={plan.reviewerName}
            escalatedToName={plan.escalatedToName}
            rejectionComment={plan.rejectionComment}
            resubmitDueAt={plan.resubmitDueAt?.toISOString() ?? null}
            praticiens={panel}
            pairesInitiales={plan.paires}
            pairesAcquises={plan.pairesAcquises}
            jeSuisLeKam={plan.repId === user.id}
            // QUI TRANCHE : le validateur tant que le plan est chez lui, le N+2 dès qu'il est
            // escaladé. L'action le revérifie — l'écran ne fait que ne pas proposer l'impossible.
            jePeuxDecider={
              hasGlobalView(user)
              || (plan.status === "SUBMITTED" && plan.reviewerName !== null && plan.repId !== user.id)
            }
            jePeuxEscalader={plan.status === "SUBMITTED" && plan.repId !== user.id}
          />
        </>
      ) : (
        <>
          {/* ── LES PLANS QUI ATTENDENT MA DÉCISION ─────────────────────────── */}
          {aDecider.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                À décider ({aDecider.length})
              </h2>
              <ul className="divide-y divide-border rounded-xl border border-warning/40">
                {aDecider.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{p.rep.name}</span>
                    <span className="text-muted-foreground">
                      {p.periodStart.toLocaleDateString("fr-FR")} → {p.periodEnd.toLocaleDateString("fr-FR")}
                    </span>
                    <Badge tone="warning">{STATUT_PLAN_LABELS[p.status as StatutPlan]}</Badge>
                    <span className="text-xs text-muted-foreground">{p._count.visits} visite(s)</span>
                    <Link href={`/medical/plan-de-tournee?plan=${p.id}`} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                      Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── MES PLANS ───────────────────────────────────────────────────── */}
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarRange className="h-4 w-4" /> Mes plans de tournée
              </h2>
              {canPlan && (
                <OuvrirPlan
                  granularite={granularite}
                  labelPeriodeSuivante={`${suivante.debut.toLocaleDateString("fr-FR")} → ${suivante.fin.toLocaleDateString("fr-FR")}`}
                  dateSuivante={suivante.debut.toISOString().slice(0, 10)}
                />
              )}
            </div>
            {mesPlans.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Aucun plan de tournée. Préparez celui de la période à venir ({suivante.debut.toLocaleDateString("fr-FR")} →{" "}
                {suivante.fin.toLocaleDateString("fr-FR")}) : c&apos;est lui qui remplit votre emploi du temps une fois validé.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {mesPlans.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium tabular-nums">
                      {p.periodStart.toLocaleDateString("fr-FR")} → {p.periodEnd.toLocaleDateString("fr-FR")}
                    </span>
                    <Badge tone={p.status === "APPROVED" ? "success" : p.status === "REJECTED" ? "danger" : p.status === "DRAFT" ? "neutral" : "warning"}>
                      {STATUT_PLAN_LABELS[p.status as StatutPlan]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{p._count.visits} visite(s)</span>
                    {/* L'ÉCHÉANCE SE LIT — avant comme après son passage. « À soumettre avant le »
                        affiché sur un plan en retard de vingt jours est une date décorative. */}
                    {(p.status === "DRAFT" || p.status === "REJECTED") && (() => {
                      const r = retardDe(p);
                      return r.enRetard ? (
                        <span className="text-xs font-medium text-destructive">
                          en retard de {r.jours} j — échéance dépassée le {r.echeance.toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          à {p.status === "REJECTED" ? "resoumettre" : "soumettre"} avant le {r.echeance.toLocaleDateString("fr-FR")}
                        </span>
                      );
                    })()}
                    <Link href={`/medical/plan-de-tournee?plan=${p.id}`} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                      Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* CE QUE LE SUPER ADMIN A RÉGLÉ, dit à l'écran : sans cela, un KAM qui voit une
              période trimestrielle croit à un bug. */}
          <p className="text-xs text-muted-foreground">
            Maille de planification : <strong className="text-foreground">{GRANULARITE_LABELS[granularite]}</strong> —
            réglée par le Super Admin (Force de vente › Paramètres). L&apos;échéance de soumission tombe{" "}
            {reglage.joursAvant} jour(s) avant la fin du mois qui précède la période, ramenée au dernier jour ouvré.
            {settings.promoMessageAuthorRoles.length === 0 && (
              <> Aucun rôle n&apos;est encore autorisé à publier les messages de la Direction Marketing : les rapports
              terrain les exigent, et ils seront refusés tant que le référentiel est vide.</>
            )}
          </p>
        </>
      )}
    </div>
  );
}
