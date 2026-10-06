import { Fragment } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { ensureCycle } from "@/lib/actions/sales-planning-actions";
import { monthLabel, resolveRepScope, TIERS, TIER_LABELS } from "@/lib/sfe";
import { loadCockpit } from "@/lib/queries/sfe-cockpit";
import { effortSummary } from "@/lib/sfe-performance";
import { chargerEffortVentes } from "@/lib/queries/sfe-effort";
import { PageHeader } from "@/components/shared/page-header";
import { loadTourneeDirection } from "@/lib/queries/tour-schedule";
import { STATUT_PLAN_LABELS, type StatutPlan } from "@/lib/sfe/tournee";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  // Le chiffre d'affaires se lit à la maille d'une BU ou de la Direction, dans les sociétés qu'on voit
  // (§118.184 — S14) : la règle vit dans `chargerEffortVentes`, pas dans la page.
  const repIds = rows.map((r) => r.repId);
  const { lisible: ventesLisibles, lignes: effort } = await chargerEffortVentes(user.id, scope, repIds, monthStart, monthEnd);

  // ── LES TOURNÉES : « visitées / planifiées » ET « le nombre de visites » ─────────────────
  //
  // Le MÊME calcul que l'écran du KAM (`avancementTournee`) : deux écrans qui comptent
  // séparément divergent, toujours (§118.51), et le symptôme serait un KAM à qui l'on reproche
  // un taux que son propre écran ne montre pas.
  const tournees = await loadTourneeDirection(
    repIds,
    monthStart,
    new Date(year, month, 0, 23, 59, 59, 999),
  );

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  // Groupement par équipe.
  const groups: { buName: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const g = groups[groups.length - 1];
    if (g && g.buName === r.buName) g.items.push(r);
    else groups.push({ buName: r.buName, items: [r] });
  }

  const scopeLabel = scope.mode === "all" ? "Toute la force de vente" : scope.mode === "team" ? "Mes équipes" : "Mon activité";
  const cell = "px-2 py-1.5 text-sm border-b border-border/60";
  // Le cockpit est une matrice KAM × indicateurs : il défile dans son cadre, la colonne « KAM » reste collée.
  const sticky = "sticky left-0 z-10 bg-card";

  return (
    <div className="space-y-5">
      <PageHeader title="Prévisions & Force de vente" description={`Pilotage — planifié vs réalisé, panel et couverture. ${scopeLabel}.`} />
      <PlanningTabs active="pilotage" canConfigure={scope.canConfigure} isSupervisor={scope.isSupervisor} />

      <div className="flex items-center gap-2">
        <Link href={`/planning/pilotage?y=${prev.y}&m=${prev.m}`} aria-label="Mois précédent" className="rounded-lg border border-input p-2.5 hover:bg-secondary sm:p-2"><ChevronLeft className="h-4 w-4" /></Link>
        <span className="min-w-40 text-center text-lg font-semibold">{monthLabel(year, month)}</span>
        <Link href={`/planning/pilotage?y=${next.y}&m=${next.m}`} aria-label="Mois suivant" className="rounded-lg border border-input p-2.5 hover:bg-secondary sm:p-2"><ChevronRight className="h-4 w-4" /></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Effectif KAM" value={rows.length} icon="Users" />
        <KpiCard label="FTE affecté" value={tFte.toFixed(2)} icon="UserCheck" />
        <KpiCard label="Visites planifiées" value={tPlanned} icon="CalendarClock" />
        <KpiCard label="Réalisation" value={`${pct(tReal, tPlanned)}%`} icon="Route" tone={pct(tReal, tPlanned) >= 80 ? "success" : "warning"} />
      </div>

      {/* ── PLANS DE TOURNÉE — CE QUE LA DIRECTION DEMANDE ─────────────────────────────────
          « visitées / planifiées » et « le nombre de visites ». Le mot « planifiées » ne
          désigne PAS le même objet que le `plannedVisits` du cockpit ci-dessus : celui-là est
          une CAPACITÉ cible (jours × visites/jour × part terrain), celui-ci compte les visites
          NOMMÉES d'un plan de tournée — un praticien, un jour. Les deux sont légitimes ; les
          afficher côte à côte sans le dire ferait douter des deux. */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Plans de tournée — {monthLabel(year, month)}
          </h2>
          <p className="text-sm">
            <strong className="tabular-nums">{tournees.total.visitees}/{tournees.total.planifiees}</strong> visitées
            {" "}({tournees.total.tauxRealisation} %) ·{" "}
            <strong className="tabular-nums">{tournees.total.visitesTotales}</strong> visites au total
            {tournees.total.imprevues > 0 && <> dont {tournees.total.imprevues} imprévue(s)</>}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          « Planifiées » compte ici les visites NOMMÉES d&apos;un plan de tournée (un praticien, un jour) — ce n&apos;est
          pas le <em>Planifié</em> du cockpit ci-dessus, qui est une capacité cible. « Le nombre de visites » ajoute les
          visites imprévues et celles commandées par la Direction, qui n&apos;entrent dans aucun plan validé.
          {tournees.total.perdues > 0 && (
            <> {tournees.total.perdues} visite(s) n&apos;ont pas été rapportées dans les 48 h : elles ne sont ni à faire
            ni faites, et sortent donc du numérateur sans sortir du dénominateur.</>
          )}
        </p>
        {tournees.lignes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Aucun KAM dans votre portée sur ce mois.
          </p>
        ) : (
          // Une ligne = un KAM : au téléphone, chaque KAM devient une carte (intitulés repris de l'en-tête).
          <div className="sm:overflow-hidden sm:rounded-xl sm:border sm:border-border">
            <Table mobileCards className="sm:min-w-[620px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-2">KAM</TableHead>
                  <TableHead className="px-2">Gamme</TableHead>
                  <TableHead className="px-2">Plan</TableHead>
                  <TableHead className="px-2 text-right">Visitées / planifiées</TableHead>
                  <TableHead className="px-2 text-right">Hors délai</TableHead>
                  <TableHead className="px-2 text-right">Imprévues</TableHead>
                  <TableHead className="px-2 text-right">Nombre de visites</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournees.lignes.map((l) => (
                  <TableRow key={l.repId}>
                    <TableCell data-sans-etiquette className="!justify-start px-2 font-medium sm:py-1.5">{l.repName}</TableCell>
                    <TableCell className="px-2 text-muted-foreground sm:py-1.5">{l.buName ?? "—"}</TableCell>
                    <TableCell className="px-2 sm:py-1.5">
                      <span>
                        {/* UN KAM SANS PLAN EST NOMMÉ : sans cette ligne, il compterait 0/0 et se
                            lirait comme « rien à faire », alors qu'il n'a rien soumis. */}
                        {l.statutPlan
                          ? STATUT_PLAN_LABELS[l.statutPlan as StatutPlan]
                          : <span className="text-warning">aucun plan</span>}
                        {/* L'ÉCHÉANCE SE LIT ICI AUSSI : un plan attendu et non soumis est ce que la
                            Direction relance — sans cette ligne, l'échéance n'existait que chez le KAM. */}
                        {l.retard.enRetard && (
                          <span className="ml-1 text-xs font-medium text-destructive">en retard de {l.retard.jours} j</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 text-right tabular-nums sm:py-1.5">
                      <span>
                        {l.avancement.visitees}/{l.avancement.planifiees}
                        {l.avancement.planifiees > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({l.avancement.tauxRealisation} %)</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 text-right tabular-nums sm:py-1.5">
                      {l.avancement.perdues > 0 ? <span className="text-warning">{l.avancement.perdues}</span> : "—"}
                    </TableCell>
                    <TableCell className="px-2 text-right tabular-nums sm:py-1.5">{l.avancement.imprevues || "—"}</TableCell>
                    <TableCell className="px-2 text-right font-medium tabular-nums sm:py-1.5">{l.avancement.visitesTotales}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {tournees.sansPlan > 0 && (
          <p className="text-xs text-warning">
            {tournees.sansPlan} KAM sur {tournees.lignes.length} n&apos;ont aucun plan de tournée sur ce mois : leur
            emploi du temps est vide, et rien ne dit où ils sont.
          </p>
        )}
        {tournees.enRetard > 0 && (
          <p className="text-xs text-destructive">
            {tournees.enRetard} KAM sur {tournees.lignes.length} ont dépassé l&apos;échéance de soumission sans plan soumis
            (brouillon, plan rejeté ou aucun plan) — c&apos;est eux qu&apos;il faut relancer.
          </p>
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyState icon="Users" title="Aucun KAM" description="Aucun KAM dans votre périmètre pour ce cycle." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-muted-foreground">
                    <th className={`${sticky} px-2 py-2`}>KAM</th>
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
                      <Fragment key={g.buName}>
                        <tr className="bg-accent/40">
                          <td colSpan={9} className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide">{g.buName}</td>
                        </tr>
                        {g.items.map((r) => {
                          const realPct = pct(r.realVisits, r.plannedVisits || r.requiredVisits);
                          const covPct = pct(r.coveredDoctors, r.panelSize);
                          return (
                            <tr key={r.repId} className="hover:bg-secondary/30">
                              <td className={`${cell} ${sticky} min-w-[8rem] max-w-[12rem] font-medium [overflow-wrap:anywhere]`}>{r.name}</td>
                              <td className={`${cell} tabular-nums`}>{r.capacity}</td>
                              <td className={cell}>
                                <span className="font-medium tabular-nums">{r.panelSize}</span>
                                <span className="ml-1 text-[0.6875rem] text-muted-foreground">{TIERS.map((t) => r.panelByTier[t] ? `${TIER_LABELS[t][0]}${r.panelByTier[t]}` : "").filter(Boolean).join(" ")}</span>
                              </td>
                              <td className={`${cell} tabular-nums text-muted-foreground`}>{r.requiredVisits}</td>
                              <td className={`${cell} tabular-nums`}>{r.plannedVisits}</td>
                              <td className={`${cell} tabular-nums`}>{r.plannedFte.toFixed(2)}</td>
                              <td className={`${cell} tabular-nums`}>{r.realVisits}</td>
                              <td className={`${cell} tabular-nums font-medium ${toneOf(realPct)}`}>{realPct}%</td>
                              <td className={`${cell} tabular-nums ${toneOf(covPct)}`}>{covPct}% <span className="text-[0.6875rem] text-muted-foreground">({r.coveredDoctors}/{r.panelSize})</span></td>
                            </tr>
                          );
                        })}
                        <tr className="bg-secondary/30 text-sm font-medium">
                          <td className="sticky left-0 z-10 bg-muted px-2 py-1.5 text-right text-xs text-muted-foreground">Sous-total {g.buName}</td>
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
                    <td className={`${sticky} px-2 py-2 text-right`}>Total</td>
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
      {ventesLisibles && effort.length > 0 && (
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
            {/* Une ligne = un produit : cartes au téléphone, tableau au-delà. */}
            <Table mobileCards className="border-collapse sm:min-w-[720px]">
              <TableHeader className="bg-secondary/40">
                <TableRow>
                  <TableHead className="px-2">Produit</TableHead>
                  <TableHead className="w-24 px-2" title="Visites où il a été présenté">Visites</TableHead>
                  <TableHead className="w-20 px-2" title="Part de l'effort total">Effort</TableHead>
                  <TableHead className="w-32 px-2" title="Chiffre d'affaires du mois">CA du mois</TableHead>
                  <TableHead className="w-20 px-2" title="Part du chiffre d'affaires">Part CA</TableHead>
                  <TableHead className="w-28 px-2" title="Échelle de comparaison entre produits — jamais une note">DZD / visite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {effort.map((e) => (
                  <TableRow key={e.productId}>
                    <TableCell data-sans-etiquette className="!justify-start px-2 font-medium sm:py-1.5">
                      <span className="min-w-0">
                        {e.name}
                        {e.note && (
                          <span className={`block text-[0.6875rem] font-normal ${e.verdict === "EFFORT_SANS_VENTE" ? "text-destructive" : "text-warning"}`}>
                            {e.note}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 tabular-nums sm:py-1.5">{e.visits}</TableCell>
                    <TableCell className="px-2 tabular-nums text-muted-foreground sm:py-1.5">{e.effortShare} %</TableCell>
                    <TableCell className="px-2 tabular-nums sm:py-1.5">{new Intl.NumberFormat("fr-DZ").format(Math.round(e.revenue))}</TableCell>
                    <TableCell className="px-2 tabular-nums text-muted-foreground sm:py-1.5">{e.revenueShare} %</TableCell>
                    <TableCell className="px-2 tabular-nums sm:py-1.5">{e.perVisit === null ? "—" : new Intl.NumberFormat("fr-DZ").format(e.perVisit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
