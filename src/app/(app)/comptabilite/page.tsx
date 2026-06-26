import Link from "next/link";
import { ReceiptText, Landmark, ArrowRight } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { getComptaData, type ComptaItem, type ComptaCategoryRow } from "@/lib/queries/compta";
import { PageHeader } from "@/components/shared/page-header";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FINANCE_CATEGORY, FINANCES_TABS } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ComptabilitePage() {
  const user = await requireModule("FINANCES");
  const d = await getComptaData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace comptable"
        description="Vue de synthèse pour la comptabilité : ce qu'il faut régler, encaisser et suivre ce mois-ci. Les règlements et écritures restent dans Finances."
      >
        <Link href="/finances/ordres-de-depense">
          <Button variant="outline">
            <ReceiptText className="h-4 w-4" /> Ordres de dépense
            {d.aReglerCount > 0 && (
              <span className="ml-1 rounded-full bg-warning/20 px-1.5 text-xs font-semibold text-warning">{d.aReglerCount}</span>
            )}
          </Button>
        </Link>
        <Link href="/finances"><Button variant="outline"><Landmark className="h-4 w-4" /> Livre comptable</Button></Link>
      </PageHeader>

      <ModuleTabs tabs={FINANCES_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      {/* Synthèse du mois + worklist */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Recettes (mois)" value={formatCurrency(d.recettesMois)} icon="TrendingUp" tone="success" />
        <KpiCard label="Dépenses (mois)" value={formatCurrency(d.depensesMois)} icon="TrendingDown" tone="danger" />
        <KpiCard label="Résultat net (mois)" value={formatCurrency(d.resultatMois)} icon="Scale" tone={d.resultatMois >= 0 ? "success" : "danger"} />
        <KpiCard label="À régler" value={formatCurrency(d.aReglerOrders)} icon="ReceiptText" tone={d.aReglerOrders > 0 ? "warning" : "default"} />
        <KpiCard label="À encaisser (prévu)" value={formatCurrency(d.aEncaisser)} icon="Hourglass" tone="info" />
        <KpiCard label="En retard" value={d.enRetardCount} icon="AlarmClock" tone={d.enRetardCount > 0 ? "danger" : "default"} />
      </div>

      {/* À régler — ordres de dépense validés par la Direction */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            À régler ({d.aReglerCount}) · {formatCurrency(d.aReglerOrders)}
          </h2>
          {d.aReglerCount > 0 && (
            <Link href="/finances/ordres-de-depense" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Régler les ordres <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {d.ordersPending.length === 0 ? (
          <EmptyState icon="CheckCheck" title="Rien à régler" description="Les ordres de dépense validés par la Direction apparaîtront ici." />
        ) : (
          <ItemTable items={d.ordersPending} thirdLabel="Bénéficiaire" href="/finances/ordres-de-depense" />
        )}
      </section>

      {/* Recettes attendues */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recettes attendues ({d.recettesAttendues.length}) · {formatCurrency(d.aEncaisser)}
        </h2>
        {d.recettesAttendues.length === 0 ? (
          <EmptyState icon="Inbox" title="Aucune recette prévue" description="Les encaissements prévus (statut « Prévu ») apparaîtront ici." />
        ) : (
          <ItemTable items={d.recettesAttendues} thirdLabel="Client" href="/finances" />
        )}
      </section>

      {/* Dépenses prévues hors ordres (transactions au statut Prévu) */}
      {d.depensesPrevues.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Autres dépenses prévues ({d.depensesPrevues.length})</h2>
          <ItemTable items={d.depensesPrevues} thirdLabel="Fournisseur" href="/finances" />
        </section>
      )}

      {/* Synthèse du mois par poste */}
      <div className="grid gap-3 lg:grid-cols-2">
        <CategoryCard title="Dépenses du mois par poste" rows={d.depByCat} total={d.depensesMois} tone="danger" />
        <CategoryCard title="Recettes du mois par poste" rows={d.recByCat} total={d.recettesMois} tone="success" />
      </div>

      {/* Résultat mensuel */}
      <Card>
        <CardHeader>
          <CardTitle>Résultat mensuel</CardTitle>
          <CardDescription>Recettes, dépenses et résultat réalisés sur les 6 derniers mois.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Recettes</TableHead>
                <TableHead className="text-right">Dépenses</TableHead>
                <TableHead className="text-right">Résultat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.months.map((m) => (
                <TableRow key={m.label}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right text-success">{formatCurrency(m.recettes)}</TableCell>
                  <TableCell className="text-right text-destructive">{formatCurrency(m.depenses)}</TableCell>
                  <TableCell className={`text-right font-semibold ${m.resultat >= 0 ? "text-foreground" : "text-destructive"}`}>
                    {formatCurrency(m.resultat)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ItemTable({ items, thirdLabel, href }: { items: ComptaItem[]; thirdLabel: string; href: string }) {
  return (
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>{thirdLabel}</TableHead>
            <TableHead>Poste</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow key={`${it.kind}-${it.id}`}>
              <TableCell className="font-mono text-xs">
                <Link href={href} className="hover:underline">{it.reference}</Link>
              </TableCell>
              <TableCell className="font-medium">{it.label}</TableCell>
              <TableCell className="text-muted-foreground">{it.counterparty || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{FINANCE_CATEGORY[it.category] ?? it.category}</TableCell>
              <TableCell>
                {it.date ? (
                  it.overdue ? (
                    <Badge tone="danger" dot={false}>{formatDate(it.date)} · en retard</Badge>
                  ) : (
                    <span className="text-muted-foreground">{formatDate(it.date)}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(it.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CategoryCard({ title, rows, total, tone }: { title: string; rows: ComptaCategoryRow[]; total: number; tone: "danger" | "success" }) {
  const barColor = tone === "danger" ? "bg-destructive" : "bg-success";
  const max = rows.reduce((m, r) => Math.max(m, r.amount), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{formatCurrency(total)} ce mois-ci</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun mouvement ce mois-ci.</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{FINANCE_CATEGORY[r.category] ?? r.category}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(r.amount)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${max ? Math.round((r.amount / max) * 100) : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
