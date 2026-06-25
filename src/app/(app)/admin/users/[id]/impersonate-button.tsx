"use client";

import * as React from "react";
import { Eye, Loader2 } from "lucide-react";
import { startImpersonation } from "@/lib/actions/impersonation-actions";

export function ImpersonateButton({ userId }: { userId: string }) {
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const fd = new FormData();
          fd.set("userId", userId);
          const r = await startImpersonation(fd); // redirige en cas de succès
          if (r && !r.ok) window.alert(r.error ?? "Erreur.");
        })
      }
      className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
      title="Voir l'OS exactement comme cet utilisateur"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Voir comme cet utilisateur
    </button>
  );
}
