import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Target, Radar, Swords, Tag } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getMarketOverview } from "@/lib/market/overview";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompact, formatNumber } from "@/lib/utils";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

const fmtDzd = (v: number) => `${formatCompact(v)} DZD`;
const fmtUsd = (v: number) => `$${formatCompact(v)}`;
const fmtPct = (g: number | null) => (g == null ? "—" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)} %`);
const pctTone = (g: number | null) => (g == null ? "text-muted-foreground" : g > 0 ? "text-success" : g < 0 ? "text-destructive" : "");

export default async function MarketOverviewPage() {
  await requireModule("BUSINESS_DEVELOPMENT");
  const o = getMarketOverview();

  return (
    <div className="space-y-5">
      <BackLink href="/business-development">
        <ArrowLeft className="h-4 w-4" /> Business Development
      </BackLink>
      <PageHeader
        title="Intelligence marché — Vue d'ensemble"
        description={`Marché pharmaceutique algérien (IQVIA ville). Source : ${o.meta.iqviaFile} · période ${o.meta.period} · ${formatNumber(o.meta.nProducts)} produits. Données officielles réconciliées.`}
      >
        <Link href="/business-development/marche/opportunites">
          <Button variant="outline"><Target className="h-4 w-4" /> Opportunités stratégiques</Button>
        </Link>
        <Link href="/business-development/marche/concurrence">
          <Button variant="outline"><Swords className="h-4 w-4" /> Produit & concurrence</Button>
        </Link>
        <Link href="/business-development/marche/pricing">
          <Button variant="outline"><Tag className="h-4 w-4" /> Intelligence prix</Button>
        </Link>
        <Link href="/business-development/marche/radar">
          <Button variant="outline"><Radar className="h-4 w-4" /> Radar</Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Valeur marché" value={fmtDzd(o.kpis.valueDzd)} icon="Landmark" tone="info" />
        <KpiCard label="En USD" value={fmtUsd(o.kpis.valueUsd)} icon="DollarSign" />
        <KpiCard label="Croissance N-1" value={fmtPct(o.kpis.growthPy)} icon={o.kpis.growthPy != null && o.kpis.growthPy < 0 ? "TrendingDown" : "TrendingUp"} tone={o.kpis.growthPy != null && o.kpis.growthPy >= 0 ? "success" : "danger"} />
        <KpiCard label="Volume (unités)" value={formatCompact(o.kpis.volume)} icon="Package" />
        <KpiCard label="Laboratoires" value={formatNumber(o.kpis.nLabs)} icon="Building2" />
        <KpiCard label={`Concentration (HHI)`} value={o.kpis.hhi != null ? Math.round(o.kpis.hhi).toString() : "—"} icon="PieChart" tone={o.kpis.hhi != null && o.kpis.hhi >= 2500 ? "warning" : "default"} />
      </div>
      <p className="text-xs text-muted-foreground">Concentration du marché : <strong>{o.kpis.hhiLabel}</strong> (indice Herfindahl-Hirschman sur les parts des laboratoires).</p>

      {/* Momentum */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-success"><TrendingUp className="h-4 w-4" /> Classes en croissance</CardTitle><CardDescription>Top dynamiques (part ≥ 0,3 %)</CardDescription></CardHeader>
          <CardContent className="space-y-1.5">
            {o.growers.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : o.growers.map((c) => (
              <div key={c.cls} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.cls}</span>
                <span className="shrink-0 font-semibold text-success">{fmtPct(c.growth)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><TrendingDown className="h-4 w-4" /> Classes en déclin</CardTitle><CardDescription>Sous pression (part ≥ 0,3 %)</CardDescription></CardHeader>
          <CardContent className="space-y-1.5">
            {o.decliners.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : o.decliners.map((c) => (
              <div key={c.cls} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.cls}</span>
                <span className="shrink-0 font-semibold text-destructive">{fmtPct(c.growth)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Classes thérapeutiques */}
      <Card>
        <CardHeader><CardTitle>Classes thérapeutiques porteuses</CardTitle><CardDescription>Top 40 par valeur de marché (MAT, ville)</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classe (ATC4)</TableHead><TableHead className="text-right">Valeur</TableHead>
                <TableHead className="text-right">Part</TableHead><TableHead className="text-right">Croissance</TableHead>
                <TableHead className="text-right">Acteurs</TableHead><TableHead className="text-right">Produits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.classes.map((c) => (
                <TableRow key={c.cls}>
                  <TableCell className="font-medium">{c.cls}</TableCell>
                  <TableCell className="text-right">{fmtDzd(c.valueDzd)}</TableCell>
                  <TableCell className="text-right">{(c.share * 100).toFixed(1)} %</TableCell>
                  <TableCell className={`text-right font-medium ${pctTone(c.growth)}`}>{fmtPct(c.growth)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.players}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.products}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Laboratoires leaders */}
      <Card>
        <CardHeader><CardTitle>Laboratoires leaders</CardTitle><CardDescription>Top 40 par valeur (ville)</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">#</TableHead><TableHead>Laboratoire</TableHead>
                <TableHead className="text-right">Valeur</TableHead><TableHead className="text-right">Part</TableHead>
                <TableHead className="text-right">Croissance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.labs.map((l) => (
                <TableRow key={`${l.rank}-${l.lab}`}>
                  <TableCell className="text-right text-muted-foreground">{l.rank}</TableCell>
                  <TableCell className="font-medium">{l.lab}{l.rank <= 3 && <Badge tone="info" dot={false} className="ml-2">Top {l.rank}</Badge>}</TableCell>
                  <TableCell className="text-right">{fmtDzd(l.valueDzd)}</TableCell>
                  <TableCell className="text-right">{(l.share * 100).toFixed(2)} %</TableCell>
                  <TableCell className={`text-right font-medium ${pctTone(l.growth)}`}>{fmtPct(l.growth)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
