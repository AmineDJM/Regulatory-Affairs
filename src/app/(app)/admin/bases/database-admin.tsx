"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { purgeOrphanStorage, permanentlyDeleteDriveNode, permanentlyDeleteDocument } from "@/lib/actions/database-admin-actions";

const GB = 1024 ** 3;
export function fmtBytes(n: number): string {
  return n >= GB ? `${(n / GB).toFixed(2)} Go` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} Mo` : n >= 1024 ? `${(n / 1024).toFixed(0)} Ko` : `${n} o`;
}

/** Ramasse-miettes : détruit les blobs orphelins → libère l'espace disque réellement. */
export function PurgeOrphansButton({ count, bytes }: { count: number; bytes: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const run = async () => {
    if (!window.confirm(`Détruire définitivement ${count} blob·s orphelins (${fmtBytes(bytes)}) ? Cette opération libère l'espace disque et est irréversible.`)) return;
    setBusy(true); setDone(null);
    const r = await purgeOrphanStorage();
    setBusy(false);
    if (r.ok) { setDone(`${r.count ?? 0} blob·s détruits · ${fmtBytes(r.bytes ?? 0)} libérés.`); router.refresh(); }
    else window.alert(r.error ?? "Échec.");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={run} disabled={busy || count === 0}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Recycle className="h-4 w-4" />}
        Purger le stockage orphelin{count > 0 ? ` (${fmtBytes(bytes)})` : ""}
      </Button>
      {done && <span className="text-sm text-success">{done}</span>}
      {count === 0 && !done && <span className="text-sm text-muted-foreground">Aucun blob orphelin — rien à libérer.</span>}
    </div>
  );
}

/** Suppression DÉFINITIVE d'un fichier/dossier Drive ou d'un document (libère le stockage). */
export function PermanentDeleteButton({ kind, id, name }: { kind: "drive" | "document"; id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    if (!window.confirm(`Supprimer DÉFINITIVEMENT « ${name} » ?\nCette action est irréversible et libère le stockage. ${kind === "drive" ? "Un dossier emporte tout son contenu." : ""}`)) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", id);
    const r = kind === "drive" ? await permanentlyDeleteDriveNode(fd) : await permanentlyDeleteDocument(fd);
    setBusy(false);
    if (r.ok) router.refresh();
    else window.alert(r.error ?? "Échec.");
  };
  return (
    <button title="Supprimer définitivement" onClick={run} disabled={busy} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
