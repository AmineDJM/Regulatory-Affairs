"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Clock, X, Loader2, ExternalLink } from "lucide-react";
import { completeReminder, snoozeReminder, cancelReminder } from "@/lib/actions/reminder-actions";

interface ReminderRow {
  id: string;
  title: string;
  note: string | null;
  link: string | null;
  remindAt: string; // ISO
  status: string;
  sentAt: string | null;
}

/** « Mes rappels » — liste des rappels actifs (échus en tête), avec terminer / reporter / annuler. */
export function MyReminders({ reminders }: { reminders: ReminderRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function act(fn: (fd: FormData) => Promise<{ ok: boolean }>, id: string, extra?: Record<string, string>) {
    setBusyId(id);
    const fd = new FormData();
    fd.set("id", id);
    for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
    await fn(fd);
    setBusyId(null);
    router.refresh();
  }

  if (reminders.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun rappel actif. Utilisez « Me rappeler » sur un dossier, une demande ou un sujet.</p>;
  }

  const now = Date.now();
  return (
    <ul className="space-y-1.5">
      {reminders.map((r) => {
        const at = new Date(r.remindAt);
        const due = r.status === "SENT" || at.getTime() <= now;
        const busy = busyId === r.id;
        return (
          <li key={r.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${due ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
            <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${due ? "text-amber-600" : "text-muted-foreground"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                <Clock className="mr-1 inline h-3 w-3" />
                {at.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                {due && <span className="ml-1 font-medium text-amber-600">— échu</span>}
              </p>
              {r.note && <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>}
              {r.link && (
                <Link href={r.link} className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> Ouvrir
                </Link>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <button type="button" title="Terminé" disabled={busy} onClick={() => act(completeReminder, r.id)} className="rounded border border-success/40 p-1 text-success hover:bg-success/10"><Check className="h-3.5 w-3.5" /></button>
              <button type="button" title="Reporter à demain" disabled={busy} onClick={() => act(snoozeReminder, r.id, { remindAt: new Date(Date.now() + 24 * 3600_000).toISOString() })} className="rounded border border-border p-1 hover:bg-accent"><Clock className="h-3.5 w-3.5" /></button>
              <button type="button" title="Annuler" disabled={busy} onClick={() => act(cancelReminder, r.id)} className="rounded border border-border p-1 text-muted-foreground hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
