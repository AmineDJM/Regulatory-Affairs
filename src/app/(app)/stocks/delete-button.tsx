"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteStockMovement } from "@/lib/actions/stock-actions";

export function DeleteMovementButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Supprimer ce mouvement ?")) return;
        const fd = new FormData(); fd.set("id", id);
        start(async () => { const r = await deleteStockMovement(fd); if (!r.ok) window.alert(r.error ?? "Erreur."); router.refresh(); });
      }}
      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      title="Supprimer"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
