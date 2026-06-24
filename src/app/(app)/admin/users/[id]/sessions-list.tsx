"use client";

import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { revokeSession } from "@/lib/actions/access-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";

export interface SessionItem {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

function deviceIcon(device: string) {
  if (device === "mobile") return <Smartphone className="h-4 w-4" />;
  if (device === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export function SessionsList({ userId, sessions }: { userId: string; sessions: SessionItem[] }) {
  if (sessions.length === 0) {
    return <EmptyState icon="MonitorOff" title="Aucune session active" />;
  }
  return (
    <ul className="divide-y divide-border">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            {deviceIcon(s.device)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {s.browser} · {s.os}
              {s.current && <Badge tone="success" dot={false} className="ml-2">Session actuelle</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.location || "Localisation inconnue"} · {s.ip || "IP inconnue"} · vue {formatDateTime(s.lastSeenAt)}
            </p>
          </div>
          <form action={async (fd) => { await revokeSession(fd); }}>
            <input type="hidden" name="sessionId" value={s.id} />
            <input type="hidden" name="userId" value={userId} />
            <button type="submit" className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Révoquer">
              <X className="h-4 w-4" />
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
