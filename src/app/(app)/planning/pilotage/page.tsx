import { Fragment } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureCycle } from "@/lib/actions/sales-planning-actions";
import { monthLabel, resolveRepScope, TIERS, TIER_LABELS } from "@/lib/sfe";
import { loadCockpit } from "@/lib/queries/sfe-cockpit";
import { effortVsSales, effortSummary } from "@/lib/sfe-performance";
import { toNumber } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PlanningTabs } from "../tabs";

export const dynamic = "force-dynamic";

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);
const toneOf = (p: number) => (p >= 90 ? "text-success" : p >= 60 ? "text-warning" : "text-destructive");

export default async function PilotagePage({ searchParams }: { searchParams: { y?: string; m?: string } }) {
  const user = await requireModule("SALES_PLANNING");
  const scope = await resolveRepScope(user);

  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const cycle = await ensureCycle(year, month);

  // LE CALCUL VIENT DE `loadCockpit` — le MÊME que le balayage d'alertes et l'archivage
  // mensuel. Il vivait ici ; trois copies d'une même formule finissent toujours par donner
  // trois taux, et le superviseur ne sait plus lequel croire.
  const { rows } = await loadCockpit({ year, month, repIds: scope.repIds, cycleId: cycle?.id ?? null });

  // KPIs (portée).
  const tCapacity = rows.reduce((s, r) => s + r.capacity, 0);
  const tPlanned = rows.reduce((s, r) => s + r.plannedVisits, 0);
  const tReal = rows.reduce((s, r) => s + r.realVisits, 0);
  const tFte = rows.reduce((s, r) => s + r.plannedFte, 0);

  // ── EFFORT × EFFET : les visites par produit, en regard des ventes du même mois. ──────────
  const repIds = rows.map((r) => r.repId);
  const [visitLinks, sales] = repIds.length
    ? await Promise.all([
        prisma.medicalVisitProduct.findMany({
          where: { visit: { delegateId: { in: repIds }, status: "COMPLETED", date: { gte: monthStart, lt: monthEnd } } },
          select: { productId: true, product: { select: { canonicalName: true } } },
        }),
        prisma.sale.findMany({
          where: { productId: { not: null }, date: { gte: monthStart, lt: monthEnd } },
          select: { productId: true, revenue: true, canonicalProduct: { select: { canonicalName: true } } },
        }),
      ])
    : [[], []];
  const effortMap = new Map<string, { name: string; visits: number; revenue: number }>();
  for (const l of visitLinks) {
    const cur = effortMap.get(l.productId) ?? { name: l.product.canonicalName, visits: 0, revenue: 0 };
    cur.visits += 1;
    effortMap.set(l.productId, cur);
  }
  for (const v of sales) {
    if (!v.productId) continue;
    const cur = effortMap.get(v.productId) ?? { name: v.canonicalProduct?.canonicalName ?? "Produit", visits: 0, revenue: 0 };
    cur.revenue += toNumber(v.revenue);
    effortMap.set(v.productId, cur);
  }
  const effort = effortVsSales([...effortMap.entries()].map(([productId, v]) => ({ productId, ...v })));

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  // Groupement par équipe.
  const groups: { teamName: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.teamName === r.teamName) g.items.push(r);
    else groups.push({ teamName: r.teamName, items: [r] });
  }

  const scopeLabel = scope.mode === "all" ? "Toute la force de vente" : scope.mode === "team" ? "Mes équipes" : "Mon activité";
  const cell = "px-2 py-1.5 text-sm border-b border-border/60";

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description={`Pilotage — planifié vs réalisé, panel et couverture. ${scopeLabel}.`} />
      <PlanningTabs active="pilotage" canConfigure={scope.canConfigure} isSupervisor={scope.isSupervisor} />

      <div className="flex items-center gap-2">
        <Link href={`/planning/pilotage?y=${prev.y}&m=${prev.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></Link>
        <span className="min-w-40 text-center text-lg font-semibold">{monthLabel(year, month)}</span>
        <Link href={`/planning/pilotage?y=${next.y}&m=${next.m}`} className="rounded-lg border border-input p-2 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Effectif KAM" value={rows.length} icon="Users" />
        <KpiCard label="FTE affecté" value={tFte.toFixed(2)} icon="UserCheck" />
        <KpiCard label="Visites planifiées" value={tPlanned} icon="CalendarClock" />
        <KpiCard label="Réalisation" value={`${pct(tReal, tPlanned)}%`} icon="Route" tone={pct(tReal, tPlanned) >= 80 ? "success" : "warning"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="Users" title="Aucun KAM" description="Aucun KAM dans votre périmètre pour ce cycle." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-2 py-2">KAM</th>
                    <th className="px-2 py-2 w-20" title="Capacité terrain (visites/mois)">Capacité</th>
                    <th className="px-2 py-2 w-24" title="Panel (praticiens) par palier">Panel</th>
                    <th className="px-2 py-2 w-24" title="Visites cibles selon la fréquence par palier">Fréq. cible</th>
                    <th className="px-2 py-2 w-20" title="Visites planifiées (affectations)">Planifié</th>
                    <th className="px-2 py-2 w-16" title="FTE affecté">FTE</th>
                    <th className="px-2 py-2 w-20" title="Visites réalisées (mois)">Réalisé</th>
                    <th className="px-2 py-2 w-20" title="Réalisé / Planifié">Réal. %</th>
                    <th className="px-2 py-2 w-24" title="Praticiens visités / panel">Couverture</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const sCap = g.items.reduce((s, r) => s + r.capacity, 0);
                    const sPlan = g.items.reduce((s, r) => s + r.plannedVisits, 0);
                    const sReal = g.items.reduce((s, r) => s + r.realVisits, 0);
                    const sFte = g.items.reduce((s, r) => s + r.plannedFte, 0);
                    return (
                      <Fragment key={g.teamName}>
                        <tr className="bg-accent/40">
                          <td colSpan={9} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">{g.teamName}</td>
                        </tr>
                        {g.items.map((r) => {
                          const realPct = pct(r.realVisits, r.plannedVisits || r.requiredVisits);
                          const covPct = pct(r.coveredDoctors, r.panelSize);
                          return (
                            <tr key={r.repId} className="hover:bg-secondary/30">
                              <td className={`${cell} font-medium`}>{r.name}</td>
                              <td className={`${cell} tabular-nums`}>{r.capacity}</td>
                              <td className={cell}>
                                <span className="font-medium tabular-nums">{r.panelSize}</span>
                                <span className="ml-1 text-[0.625rem] text-muted-foreground">{TIERS.map((t) => r.panelByTier[t] ? `${TIER_LABELS[t][0]}${r.panelByTier[t]}` : "").filter(Boolean).join(" ")}</span>
                              </td>
                              <td className={`${cell} tabular-nums text-muted-foreground`}>{r.requiredVisits}</td>
                              <td className={`${cell} tabular-nums`}>{r.plannedVisits}</td>
                              <td className={`${cell} tabular-nums`}>{r.plannedFte.toFixed(2)}</td>
                              <td className={`${cell} tabular-nums`}>{r.realVisits}</td>
                              <td className={`${cell} tabular-nums font-medium ${toneOf(realPct)}`}>{realPct}%</td>
                              <td className={`${cell} tabular-nums ${toneOf(covPct)}`}>{covPct}% <span className="text-[0.625rem] text-muted-foreground">({r.coveredDoctors}/{r.panelSize})</span></td>
                            </tr>
                          );
                        })}
                        <tr className="bg-secondary/30 text-sm font-medium">
                          <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">Sous-total {g.teamName}</td>
                          <td className="px-2 py-1.5 tabular-nums">{sCap}</td>
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5 tabular-nums">{sPlan}</td>
                          <td className="px-2 py-1.5 tabular-nums">{sFte.toFixed(2)}</td>
                          <td className="px-2 py-1.5 tabular-nums">{sReal}</td>
                          <td className="px-2 py-1.5 tabular-nums">{pct(sReal, sPlan)}%</td>
                          <td className="px-2 py-1.5" />
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-primary/5 text-sm font-bold">
                    <td className="px-2 py-2 text-right">Total</td>
                    <td className="px-2 py-2 tabular-nums">{tCapacity}</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 tabular-nums">{tPlanned}</td>
                    <td className="px-2 py-2 tabular-nums">{tFte.toFixed(2)}</td>
                    <td className="px-2 py-2 tabular-nums">{tReal}</td>
                    <td className="px-2 py-2 tabular-nums">{pct(tReal, tPlanned)}%</td>
                    <td className="px-2 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── EFFORT × EFFET — deux mesures CÔTE À CÔTE, aucune causalité affirmée. ─────────────
          Ce tableau ne note personne : il révèle les deux anomalies qu'aucun des deux chiffres
          ne montre seul — un produit détaillé qui ne se vend nulle part, un produit qui se vend
          sans qu'on le détaille. Les deux sont des conversations à avoir, pas des verdicts. */}
      {effort.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Effort × ventes — {monthLabel(year, month)}
              </h2>
              <span className="text-xs text-muted-foreground">{effortSummary(effort)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Les visites où le produit a été <strong>présenté</strong>, en regard de son chiffre d&apos;affaires du
              <strong> même mois</strong>. Ce n&apos;est pas un rendement : une vente hospitalière tombe des mois après
              la visite qui l&apos;a préparée, et un marché public ne doit rien au détaillage. Ce qu&apos;on vient
              lire ici, ce sont les deux <em>anomalies</em> signalées.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-2 py-2">Produit</th>
                    <th className="px-2 py-2 w-24" title="Visites où il a été présenté">Visites</th>
                    <th className="px-2 py-2 w-20" title="Part de l'effort total">Effort</th>
                    <th className="px-2 py-2 w-32" title="Chiffre d'affaires du mois">CA du mois</th>
                    <th className="px-2 py-2 w-20" title="Part du chiffre d'affaires">Part CA</th>
                    <th className="px-2 py-2 w-28" title="Échelle de comparaison entre produits — jamais une note">DZD / visite</th>
                  </tr>
                </thead>
                <tbody>
                  {effort.map((e) => (
                    <tr key={e.productId} className="hover:bg-secondary/30">
                      <td className={`${cell} font-medium`}>
                        {e.name}
                        {e.note && (
                          <span className={`block text-[0.6875rem] font-normal ${e.verdict === "EFFORT_SANS_VENTE" ? "text-destructive" : "text-warning"}`}>
                            {e.note}
                          </span>
                        )}
                      </td>
                      <td className={`${cell} tabular-nums`}>{e.visits}</td>
                      <td className={`${cell} tabular-nums text-muted-foreground`}>{e.effortShare} %</td>
                      <td className={`${cell} tabular-nums`}>{new Intl.NumberFormat("fr-DZ").format(Math.round(e.revenue))}</td>
                      <td className={`${cell} tabular-nums text-muted-foreground`}>{e.revenueShare} %</td>
                      <td className={`${cell} tabular-nums`}>{e.perVisit === null ? "—" : new Intl.NumberFormat("fr-DZ").format(e.perVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
