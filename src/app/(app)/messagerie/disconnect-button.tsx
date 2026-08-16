"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { disconnectMicrosoftMail } from "@/lib/actions/microsoft-mail-actions";

/**
 * SE DÉCONNECTER DOIT VRAIMENT DÉCONNECTER : les jetons sont EFFACÉS, pas désactivés. On confirme,
 * parce qu'un clic malheureux obligerait à repasser par Microsoft.
 */
export function DisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const go = async () => {
    if (!window.confirm("Déconnecter votre boîte Microsoft ? Vos e-mails restent chez Microsoft ; seule la liaison est coupée.")) return;
    setBusy(true);
    await disconnectMicrosoftMail();
    setBusy(false);
    router.refresh();
  };

  return (
    <button
      type="button" onClick={() => void go()} disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Déconnecter
    </button>
  );
}
