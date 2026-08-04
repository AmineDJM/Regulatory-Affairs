"use client";

import * as React from "react";
import { Search, Plus, Check, X, Loader2, Scale } from "lucide-react";
import { searchMarketProducts } from "@/lib/actions/market-actions";
import type { MarketProduct } from "@/lib/market/products";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompact, formatNumber } from "@/lib/utils";

const fmtDzd = (v: number) => `${formatCompact(v)} DZD`;
const fmtUsd = (v: number) => `$${formatCompact(v)}`;
const fmtPrice = (v: number | null) => (v == null ? "—" : `${formatNumber(Math.round(v))} DZD`);
const fmtPct = (g: number | null) => (g == null ? "—" : `${g >= 0 ? "+" : ""}${(g * 100).toFixed(1)} %`);
const pctTone = (g: number | null) => (g == null ? "text-muted-foreground" : g > 0 ? "text-success" : g < 0 ? "text-destructive" : "");

/**
 * Explorateur de produits : barre de recherche + filtres (classe / laboratoire) sur les
 * produits IQVIA ; sélection d'un ou plusieurs produits (persistante entre recherches) et
 * comparaison sur volume, valeur (DZD/USD), prix moyen et croissance.
 */
export function ProductExplorer({ classes, labs, initial, initialTotal }: { classes: string[]; labs: string[]; initial: MarketProduct[]; initialTotal: number }) {
  const [q, setQ] = React.useState("");
  const [cls, setCls] = React.useState("");
  const [lab, setLab] = React.useState("");
  const [segment, setSegment] = React.useState(""); // "" = ville + hôpital
  const [results, setResults] = React.useState<MarketProduct[]>(initial);
  const [total, setTotal] = React.useState(initialTotal);
  const [selected, setSelected] = React.useState<Map<string, MarketProduct>>(new Map());
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<string | null>(null);

  // Chaque recherche porte un numéro de séquence : une réponse arrivée APRÈS une frappe plus
  // récente est ignorée (pas de résultats périmés qui « clignotent » en temps réel).
  const seq = React.useRef(0);
  const runSearch = React.useCallback((query: string, klass: string, laboratory: string, seg: string) => {
    const mySeq = ++seq.current;
    start(async () => {
      const r = await searchMarketProducts({ q: query, cls: klass, lab: laboratory, segment: seg || undefined });
      if (mySeq !== seq.current) return; // réponse périmée → ignorée
      if (!r.ok) { setErr(r.error ?? "Recherche impossible."); return; }
      setErr(null);
      setResults(r.products);
      setTotal(r.total);
    });
  }, []);

  // Recherche EN TEMPS RÉEL : à chaque frappe OU changement de filtre (anti-rebond 200 ms).
  // Le jeu initial (props) couvre déjà l'état vide → on saute le tout premier rendu.
  const didMount = React.useRef(false);
  React.useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const t = setTimeout(() => runSearch(q.trim(), cls, lab, segment), 200);
    return () => clearTimeout(t);
  }, [q, cls, lab, segment, runSearch]);

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); runSearch(q.trim(), cls, lab, segment); };
  const reset = () => { setQ(""); setCls(""); setLab(""); setSegment(""); }; // les filtres vidés relancent la recherche via l'effet

  const toggle = (p: MarketProduct) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.key)) next.delete(p.key); else next.set(p.key, p);
      return next;
    });
  };

  const selectedArr = [...selected.values()];
  const sumValue = selectedArr.reduce((s, p) => s + p.valueDzd, 0);
  const sumValueUsd = selectedArr.reduce((s, p) => s + p.valueUsd, 0);
  const sumVolume = selectedArr.reduce((s, p) => s + p.volume, 0);
  const withG = selectedArr.filter((p) => p.growth != null && p.valueDzd > 0);
  const wGrowth = withG.length ? withG.reduce((s, p) => s + p.valueDzd * (p.growth as number), 0) / withG.reduce((s, p) => s + p.valueDzd, 0) : null;

  return (
    <div className="space-y-5">
      {/* Barre de recherche + filtres */}
      <form onSubmit={onSubmit} className="surface flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label className="text-xs">Recherche (marque, molécule, laboratoire…)</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. amoxicilline, ALOCLAIR, Sinclair…" className="h-9 pl-8 pr-8" />
            {pending && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Classe (ATC4)</Label>
          <Select value={cls} onChange={(e) => setCls(e.target.value)} className="h-9 w-56">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Laboratoire</Label>
          <Select value={lab} onChange={(e) => setLab(e.target.value)} className="h-9 w-52">
            <option value="">Tous les laboratoires</option>
            {labs.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Marché</Label>
          <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="h-9 w-40">
            <option value="">Ville + hôpital</option>
            <option value="VILLE">Ville (IQVIA)</option>
            <option value="HOPITAL">Hôpital (PCH)</option>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Rechercher</Button>
        {(q || cls || lab || segment) && <Button type="button" size="sm" variant="outline" onClick={reset} disabled={pending}>Réinitialiser</Button>}
        {err && <p className="w-full text-xs text-destructive">{err}</p>}
      </form>

      {/* Comparaison de la sélection */}
      {selectedArr.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4" /> Comparaison ({selectedArr.length} produit{selectedArr.length > 1 ? "s" : ""})</CardTitle>
              <CardDescription>Volume, valeur (DZD/USD), prix unitaire moyen et croissance N-1.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Map())}>Tout désélectionner</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead><TableHead>Laboratoire</TableHead>
                  <TableHead className="text-right">Volume</TableHead><TableHead className="text-right">Valeur</TableHead>
                  <TableHead className="text-right">Valeur (USD)</TableHead><TableHead className="text-right">Prix moyen</TableHead>
                  <TableHead className="text-right">Croissance</TableHead><TableHead className="text-right">Part sél.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedArr.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-1.5">{p.brand}<SegmentBadge segment={p.segment} /></span>
                      <span className="block text-xs font-normal text-muted-foreground">{p.pres}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.lab}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.volume)}</TableCell>
                    <TableCell className="text-right">{fmtDzd(p.valueDzd)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUsd(p.valueUsd)}</TableCell>
                    <TableCell className="text-right">{fmtPrice(p.avgPriceDzd)}</TableCell>
                    <TableCell className={`text-right font-medium ${pctTone(p.growth)}`}>{fmtPct(p.growth)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{sumValue > 0 ? `${((p.valueDzd / sumValue) * 100).toFixed(1)} %` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <button title="Retirer" onClick={() => toggle(p)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
                    </TableCell>
                  </TableRow>
                ))}
                {selectedArr.length > 1 && (
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Total sélection</TableCell><TableCell />
                    <TableCell className="text-right">{formatNumber(sumVolume)}</TableCell>
                    <TableCell className="text-right">{fmtDzd(sumValue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtUsd(sumValueUsd)}</TableCell>
                    <TableCell />
                    <TableCell className={`text-right ${pctTone(wGrowth)}`}>{fmtPct(wGrowth)}</TableCell>
                    <TableCell className="text-right">100 %</TableCell><TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Résultats de recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résultats</CardTitle>
          <CardDescription>
            {formatNumber(total)} produit{total > 1 ? "s" : ""} correspondant{total > 1 ? "s" : ""}
            {total > results.length ? ` — ${results.length} plus fortes valeurs affichées (affinez la recherche)` : ""}. Cliquez « + » pour ajouter à la comparaison.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-2">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun produit ne correspond à ces critères.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Produit</TableHead><TableHead>Molécule</TableHead><TableHead>Laboratoire</TableHead>
                  <TableHead className="text-right">Volume</TableHead><TableHead className="text-right">Valeur</TableHead>
                  <TableHead className="text-right">Prix moyen</TableHead><TableHead className="text-right">Croissance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((p) => {
                  const on = selected.has(p.key);
                  return (
                    <TableRow key={p.key} className={on ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <button
                          title={on ? "Retirer de la comparaison" : "Ajouter à la comparaison"}
                          onClick={() => toggle(p)}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
                        >
                          {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="flex flex-wrap items-center gap-1.5">{p.brand}<SegmentBadge segment={p.segment} /></span>
                        <span className="block text-xs font-normal text-muted-foreground">{p.pres}{p.cls ? ` · ${p.cls}` : ""}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.mol || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.lab}</TableCell>
                      <TableCell className="text-right">{formatNumber(p.volume)}</TableCell>
                      <TableCell className="text-right">{fmtDzd(p.valueDzd)}</TableCell>
                      <TableCell className="text-right">{fmtPrice(p.avgPriceDzd)}</TableCell>
                      <TableCell className={`text-right font-medium ${pctTone(p.growth)}`}>{fmtPct(p.growth)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Marché d'origine du produit : ville (IQVIA) ou hôpital (PCH). */
function SegmentBadge({ segment }: { segment: MarketProduct["segment"] }) {
  return (
    <Badge tone={segment === "HOPITAL" ? "purple" : "info"} dot={false} className="text-[10px]">
      {segment === "HOPITAL" ? "Hôpital" : "Ville"}
    </Badge>
  );
}
