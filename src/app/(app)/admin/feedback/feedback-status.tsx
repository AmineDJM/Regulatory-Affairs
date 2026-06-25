"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateFeedbackStatus } from "@/lib/actions/feedback-actions";
import { FEEDBACK_STATUS } from "@/lib/labels";

export function FeedbackStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <span className="inline-flex items-center gap-1.5">
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <select
        value={status}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("id", id);
          fd.set("status", e.target.value);
          start(async () => {
            const r = await updateFeedbackStatus(fd);
            if (!r.ok) window.alert(r.error ?? "Erreur.");
            router.refresh();
          });
        }}
        className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {Object.entries(FEEDBACK_STATUS).map(([v, d]) => (
          <option key={v} value={v}>{d.label}</option>
        ))}
      </select>
    </span>
  );
}
