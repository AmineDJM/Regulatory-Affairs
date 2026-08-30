import Link from "next/link";
import { Gavel } from "lucide-react";
import type { ProductMarketRow } from "@/lib/queries/market-360";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PCH_LINE_STATUS, PCH_MARKET_NIVEAU } from "@/lib/labels";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * LES MARCHÉS DU PRODUIT (§30) — la vue INVERSE de la fiche marché : depuis le dossier
 * Regulatory, tout l'historique d'appels d'offres du produit canonique, AO par AO, avec les
 * quantités soumises / attribuées / contractuelles / commandées et le restant. Les chiffres
 * viennent de la MÊME requête que la fiche marché (`loadProductMarkets`) — pas d'un second
 * calcul qui finirait par diverger.
 */
export function ProductMarkets({ rows }: { rows: ProductMarketRow[] }) {
  const totalAttribue = rows.reduce((s, r) => s + r.valeurAttribuee, 0);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Gavel className="h-4 w-4" aria-hidden /> Marchés PCH du produit</CardTitle>
        <div className="flex items-center gap-2">
          {totalAttribue > 0 && <Badge tone="success" dot={false}>{formatCurrency(totalAttribue)} attribués</Badge>}
          <Badge tone="neutral">{rows.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 sm:p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marché</TableHead><TableHead>Niveau</TableHead><TableHead>Lot</TableHead>
              <TableHead className="text-right">Soumis</TableHead>
              <TableHead className="text-right">Attribué</TableHead>
              <TableHead className="text-right">Contractuel</TableHead>
              <TableHead className="text-right">Commandé</TableHead>
              <TableHead className="text-right">Restant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.tenderId}-${i}`}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/pch/${r.tenderId}`} className="hover:underline">{r.reference}</Link>
                  {r.annee && <span className="ml-1 text-muted-foreground">({r.annee})</span>}
                </TableCell>
                <TableCell><StatusBadge map={PCH_MARKET_NIVEAU} value={r.niveauMarche} /></TableCell>
                <TableCell><StatusBadge map={PCH_LINE_STATUS} value={r.statutLigne} dot={false} /></TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.quantiteSoumise)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.statutLigne === "WON" ? formatNumber(r.quantiteAttribuee) : "—"}
                  {r.statutLigne === "WON" && r.prixAttribue != null && (
                    <span className="ml-1 text-xs text-muted-foreground">à {formatNumber(r.prixAttribue)} DZD</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.quantiteContractuelle > 0 ? formatNumber(r.quantiteContractuelle) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.quantiteCommandee > 0 ? formatNumber(r.quantiteCommandee) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.quantiteContractuelle > 0
                    ? <span className={r.restantACommander > 0 ? "font-medium" : "text-muted-foreground"}>{formatNumber(r.restantACommander)}</span>
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
