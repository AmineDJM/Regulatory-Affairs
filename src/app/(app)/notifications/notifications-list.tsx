"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCheck } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notification-actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { NOTIFICATION_TYPE } from "@/lib/labels";
import { formatDateTime, cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsList({ items }: { items: NotificationItem[] }) {
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <form action={markAllNotificationsRead}>
          <Button type="submit" variant="outline" size="sm" disabled={!hasUnread}>
            <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
          </Button>
        </form>
      </div>

      {items.length === 0 ? (
        <EmptyState icon="BellOff" title="Aucune notification" description="Vous êtes à jour." />
      ) : (
        <ul className="surface divide-y divide-border overflow-hidden">
          {items.map((n) => {
            const content = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge map={NOTIFICATION_TYPE} value={n.type} dot={false} />
                    <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                  </div>
                  <p className={cn("mt-0.5 text-sm", n.isRead ? "font-normal" : "font-medium")}>{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                </div>
                {!n.isRead && (
                  <form action={markNotificationRead.bind(null, n.id)}>
                    <button type="submit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title="Marquer comme lu">
                      <Check className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>
            );
            return (
              <li key={n.id} className={cn(!n.isRead && "bg-accent/30")}>
                {n.link ? <Link href={n.link}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
