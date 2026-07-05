"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2, Flame, Paperclip } from "lucide-react";
import { restoreDeletedRecord, destroyDeletedRecord } from "@/lib/actions/admin-delete-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export interface TrashItem {
  id: string;
  kind: string;
  label: string;
  name: string;
  deletedAt: string;
  deletedBy: string | null;
  restoredAt: string | null;
  documents: number;
}

export function TrashList({ items }: { items: TrashItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function run(item: TrashItem, action: "restore" | "destroy") {
    const confirmMsg = action === "restore"
      ? `Restaurer ${item.label} « ${item.name} » ?`
      : `Détruire DÉFINITIVEMENT ${item.label} « ${item.name} » ? Les fichiers seront effacés — irréversible.`;
    if (!window.confirm(confirmMsg)) return;
    setBusyId(item.id); setErr(null);
    const fd = new FormData(); fd.set("id", item.id);
    const r = action === "restore" ? await restoreDeletedRecord(fd) : await destroyDeletedRecord(fd);
    setBusyId(null);
    if (!r.ok) setErr(r.error ?? "Échec."); else router.refresh();
  }

  return (
    <div className="space-y-2">
      {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
      <div className="surface divide-y divide-border">
        {items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {it.name}
                {it.documents > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3.5 w-3.5" /> {it.documents}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {it.label} · supprimé le {formatDateTime(it.deletedAt)}{it.deletedBy ? ` par ${it.deletedBy}` : ""}
              </p>
            </div>
            {it.restoredAt ? (
              <Badge tone="success" dot={false}>Restauré le {formatDateTime(it.restoredAt)}</Badge>
            ) : (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => run(it, "restore")}>
                  {busyId === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Restaurer
                </Button>
                <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => run(it, "destroy")} className="text-destructive hover:bg-destructive/10">
                  <Flame className="h-4 w-4" /> Détruire
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
