"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power } from "lucide-react";
import { toggleSupplier, toggleSupplierUser } from "@/lib/actions/supplier-actions";

export function ActiveToggle({ kind, id, active }: { kind: "supplier" | "user"; id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const fd = new FormData(); fd.set("id", id);
        const r = await (kind === "supplier" ? toggleSupplier(fd) : toggleSupplierUser(fd));
        if (!r.ok) window.alert(r.error ?? "Erreur.");
        router.refresh();
      })}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${active ? "border-success/30 bg-success/10 text-success" : "border-border bg-secondary text-muted-foreground"}`}
      title={active ? "Actif — cliquer pour désactiver" : "Désactivé — cliquer pour activer"}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
      {active ? "Actif" : "Désactivé"}
    </button>
  );
}
