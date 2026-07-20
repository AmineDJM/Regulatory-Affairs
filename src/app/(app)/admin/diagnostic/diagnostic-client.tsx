"use client";

import * as React from "react";
import { Sparkles, Loader2, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generatePlatformIdeas } from "@/lib/actions/platform-audit-actions";

/**
 * Bloc « idées IA » : bouton qui déclenche l'analyse Claude du diagnostic (recalculé
 * côté serveur) et rend le résultat. Volontairement séparé de la partie déterministe
 * (rendue par la page) pour ne conscommer un appel IA que sur demande.
 */
export function PlatformIdeas({ hasFindings }: { hasFindings: boolean }) {
  const [pending, start] = React.useTransition();
  const [text, setText] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const run = () =>
    start(async () => {
      setErr(null);
      const r = await generatePlatformIdeas();
      if (!r.ok) { setErr(r.error ?? "Analyse indisponible."); return; }
      setText(r.text ?? "");
    });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-primary" /> Idées & propositions (IA)</CardTitle>
        <CardDescription>
          Claude analyse le diagnostic ci-dessous et propose des corrections prioritaires, des simplifications, des
          améliorations et des réglages rapides — spécifiques à vos données{hasFindings ? "" : " (aucun problème détecté : plutôt des pistes d'optimisation)"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={run} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {text ? "Régénérer les idées" : "Générer des idées"}
        </Button>
        {err && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</div>}
        {text && <RichText text={text} />}
      </CardContent>
    </Card>
  );
}

/** Rendu léger d'un Markdown simple (titres ##, listes -, gras **, tableaux |…|) — sans dépendance. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let table: string[] = [];
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="ml-4 list-disc space-y-1 text-sm text-foreground/90">
          {list.map((li, i) => <li key={i}>{inline(li)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  const flushTable = () => {
    if (table.length >= 2) blocks.push(<MdTable key={`t-${blocks.length}`} rows={table} />);
    else table.forEach((r, i) => blocks.push(<p key={`tp-${blocks.length}-${i}`} className="text-sm text-foreground/90">{inline(r)}</p>));
    table = [];
  };
  const flush = () => { flushList(); flushTable(); };

  for (const raw of lines) {
    const l = raw.trimEnd();
    const isTableRow = /^\s*\|.*\|\s*$/.test(l);
    if (isTableRow) { flushList(); table.push(l); continue; }
    if (table.length) flushTable();
    if (/^#{1,6}\s/.test(l)) {
      flushList();
      blocks.push(<h4 key={`h-${blocks.length}`} className="mt-3 text-sm font-semibold text-foreground first:mt-0">{l.replace(/^#{1,6}\s/, "")}</h4>);
    } else if (/^\s*[-*]\s+/.test(l)) {
      list.push(l.replace(/^\s*[-*]\s+/, ""));
    } else if (l.trim() === "") {
      flushList();
    } else {
      flushList();
      blocks.push(<p key={`p-${blocks.length}`} className="text-sm text-foreground/90">{inline(l)}</p>);
    }
  }
  flush();
  return <div className="space-y-1.5 rounded-lg border border-border bg-background p-3">{blocks}</div>;
}

/** Tableau Markdown `|…|…|` (la ligne de séparation `|---|` est ignorée). Défilement horizontal sur mobile. */
function MdTable({ rows }: { rows: string[] }) {
  const cells = (r: string) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = cells(rows[0]);
  const body = rows.slice(1).filter((r) => !/^\s*\|?[\s:-]+\|?\s*$/.test(r)).map(cells);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>{header.map((h, i) => <th key={i} className="border-b border-border px-2 py-1.5 text-left font-semibold">{inline(h)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50">
              {row.map((c, ci) => <td key={ci} className="px-2 py-1.5 align-top text-foreground/90">{inline(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Gras Markdown (**…**) → <strong>. */
function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>,
  );
}
