import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { getComptaData, ComptaItem } from "@/lib/queries/compta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FINANCE_CATEGORY } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

type ComptaData = Awaited<ReturnType<typeof getComptaData>>;

/**
 * CE QUE LE DAF DOIT ENCORE ARBITRER — et rien qui vive déjà ailleurs.
 *
 * Ce bloc listait aussi les ordres « à régler » et les recettes attendues. Depuis que les
 * Finances ont trois sous-modules, la file des ordres EST « Paiements à faire » : la répéter ici
 * donnait deux listes de la même chose, qui divergeaient dès qu'on réglait depuis l'une. Restent
 * les dépenses qu'aucun autre écran ne porte — celles hors ordres, la masse salariale à
 * provisionner — et le résultat mensuel.
 */
export function ComptaCockpit({ d }: { d: ComptaData }) {
  return (
    <div className="space-y-6">
      {d.enRetardCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <span><strong>{d.enRetardCount}</strong> échéance·s en retard à traiter.</span>
          <Link href="/finances/paiements-a-faire" className="inline-flex items-center gap-1 font-medium hover:underline">Voir <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}

      {/* « À RÉGLER » ET « RECETTES ATTENDUES » ONT ÉTÉ RETIRÉS D'ICI (2026-08).
          La file des ordres à régler EST le sous-module « Paiements à faire » : la répéter sur le
          tableau de bord donnait deux listes de la même chose, qui se désynchronisaient dès qu'on
          réglait depuis l'une. Le bandeau des retards ci-dessus suffit à ramener l'œil. */}

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
          <ItemTable items={d.depensesSalaires} thirdLabel="Bénéficiaire" href="/rh/paie" />
        </section>
      )}

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
