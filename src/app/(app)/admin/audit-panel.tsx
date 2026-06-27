"use client";

import * as React from "react";
import { Loader2, ScrollText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuditTable, type AuditRow } from "./audit-table";

/**
 * Journal d'audit chargé **à la demande** (et paginé) : tant qu'on ne le demande
 * pas, rien n'est chargé — la page d'administration reste légère. « Charger plus »
 * récupère la page suivante via curseur.
 */
export function AuditPanel({ count }: { count: number }) {
  const [rows, setRows] = React.useState<AuditRow[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function load(next?: string | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit${next ? `?cursor=${encodeURIComponent(next)}` : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { rows: AuditRow[]; nextCursor: string | null };
      setRows((prev) => (prev && next ? [...prev, ...data.rows] : data.rows));
      setCursor(data.nextCursor);
    } catch {
      /* on laisse l'utilisateur réessayer */
    } finally {
      setLoading(false);
    }
  }

  if (rows === null) {
    return (
      <div className="surface flex flex-col items-center gap-3 px-4 py-10 text-center">
        <ScrollText className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{count} entrée·s d'audit en base. Chargé uniquement à la demande pour garder l'interface rapide.</p>
        <Button onClick={() => load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
          Afficher le journal d'audit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AuditTable rows={rows} />
      {cursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => load(cursor)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
}
