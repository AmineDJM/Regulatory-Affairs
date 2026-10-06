"use client";

import * as React from "react";
import { History, Loader2, RotateCcw } from "lucide-react";
import { rollbackWorkflowDefinition } from "@/lib/actions/workflow-actions";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export interface WorkflowVersionRow {
  category: string;
  categoryLabel: string;
  version: number;
  name: string;
  stepCount: number;
  savedBy: string | null;
  savedAt: string; // déjà formatée côté serveur (fuseau stable)
}

/**
 * L'HISTORIQUE des circuits : chaque enregistrement du builder a laissé un instantané.
 * « Restaurer » rejoue l'instantané par le MÊME chemin validé que l'enregistrement normal —
 * et laisse à son tour une nouvelle version (l'historique avance, il ne se réécrit pas).
 */
export function WorkflowVersionHistory({ rows }: { rows: WorkflowVersionRow[] }) {
  const [armed, setArmed] = React.useState<string | null>(null); // `${category}:${version}` à confirmer
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune version enregistrée pour l&apos;instant — chaque enregistrement du builder en laissera une.
      </p>
    );
  }

  const restore = async (category: string, version: number) => {
    const key = `${category}:${version}`;
    if (armed !== key) {
      setArmed(key);
      setError(null);
      return;
    }
    setBusy(key);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("category", category);
      fd.set("version", String(version));
      const r = await rollbackWorkflowDefinition(fd);
      if (r.ok) {
        setDone(key);
        setTimeout(() => setDone(null), 2500);
      } else {
        setError(r.error ?? "Restauration impossible.");
      }
    } catch {
      setError("Restauration impossible.");
    } finally {
      setBusy(null);
      setArmed(null);
    }
  };

  return (
    <div className="surface space-y-3 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Historique des circuits (restaurable)</h2>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Table mobileCards>
          <TableHeader>
            <TableRow>
              <TableHead>Circuit</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Étapes</TableHead>
              <TableHead>Enregistrée</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const key = `${r.category}:${r.version}`;
              return (
                <TableRow key={key}>
                  <TableCell data-sans-etiquette className="py-1.5 font-medium max-sm:!justify-start sm:font-normal">{r.categoryLabel}</TableCell>
                  <TableCell className="py-1.5 font-medium">v{r.version}</TableCell>
                  <TableCell className="py-1.5 sm:max-w-[220px] sm:truncate">{r.name}</TableCell>
                  <TableCell className="py-1.5">{r.stepCount}</TableCell>
                  <TableCell className="py-1.5 text-muted-foreground sm:whitespace-nowrap">
                    {r.savedAt}{r.savedBy ? ` — ${r.savedBy}` : ""}
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <Button
                      size="sm"
                      variant={armed === key ? "destructive" : "outline"}
                      disabled={busy !== null}
                      onClick={() => restore(r.category, r.version)}
                      className="w-full sm:w-auto"
                    >
                      {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      {done === key ? "Restaurée" : armed === key ? "Confirmer la restauration" : "Restaurer"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        Restaurer rejoue l&apos;instantané par le même chemin validé que l&apos;enregistrement — et crée une nouvelle version (rien ne s&apos;efface).
      </p>
    </div>
  );
}
