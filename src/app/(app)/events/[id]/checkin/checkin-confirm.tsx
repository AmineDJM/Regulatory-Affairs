"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { checkInByToken } from "@/lib/actions/event-actions";

/** Marque automatiquement le participant « présent » au scan du QR. */
export function CheckinConfirm({ token, name, eventId }: { token: string; name: string; eventId: string }) {
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  React.useEffect(() => {
    const fd = new FormData(); fd.set("token", token);
    checkInByToken(fd).then((r) => setState(r.ok ? "ok" : "error"));
  }, [token]);

  return (
    <div className="surface flex flex-col items-center gap-3 p-8 text-center">
      {state === "loading" && <><Loader2 className="h-12 w-12 animate-spin text-muted-foreground" /><p>Enregistrement de la présence…</p></>}
      {state === "ok" && (
        <>
          <CheckCircle2 className="h-14 w-14 text-success" />
          <p className="text-xl font-bold">{name}</p>
          <p className="text-success">Présence enregistrée ✓</p>
        </>
      )}
      {state === "error" && (<><XCircle className="h-14 w-14 text-destructive" /><p>Impossible d'enregistrer la présence.</p></>)}
      <Link href={`/events/${eventId}`} className="mt-2 text-sm text-primary hover:underline">Retour à l'événement</Link>
    </div>
  );
}
