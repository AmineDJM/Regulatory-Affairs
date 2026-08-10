import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { getComptaData, ComptaItem, ComptaCategoryRow } from "@/lib/queries/compta";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FINANCE_CATEGORY } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

type ComptaData = Awaited<ReturnType<typeof getComptaData>>;

/**
 * Cockpit comptable du DAF, intégré à la page Finances (module unifié). Liste ce
 * qu'il faut régler / encaisser, les retards, et la synthèse du mois.
 */
export function ComptaCockpit({ d }: { d: ComptaData }) {
  return (
    <div className="space-y-6">
      {d.enRetardCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <span><strong>{d.enRetardCount}</strong> échéance·s en retard à traiter.</span>
          <Link href="/finances/ordres-de-depense" className="inline-flex items-center gap-1 font-medium hover:underline">Voir <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}

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

      {/* Dépenses prévues hors ordres — la MASSE SALARIALE est séparée : elle tombe chaque mois
          et n'a pas à noyer les décaissements qu'on peut encore arbitrer. */}
      {d.depensesAutres.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Autres dépenses prévues ({d.depensesAutres.length}) · {formatCurrency(d.depensesAutresTotal)}
          </h2>
          <ItemTable items={d.depensesAutres} thirdLabel="Fournisseur" href="/finances" />
        </section>
      )}

      {d.depensesSalaires.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Masse salariale à venir ({d.depensesSalaires.length}) · {formatCurrency(d.depensesSalairesTotal)}
          </h2>
          <p className="text-xs text-muted-foreground">Salaires et avances — récurrents, à provisionner ; ils ne se négocient pas comme une dépense fournisseur.</p>
          <ItemTable items={d.depensesSalaires} thirdLabel="Bénéficiaire" href="/finances/paie" />
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
    <div className="surface overflow-x-auto">
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
