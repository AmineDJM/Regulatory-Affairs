"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { approveDocumentName } from "@/lib/regulatory/intelligence/actions";

/** Approuve le nom de fichier proposé (le renommage définitif de la copie de travail). */
export function ApproveNameButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function approve() {
    setBusy(true);
    const fd = new FormData();
    fd.set("documentId", documentId);
    const r = await approveDocumentName(fd);
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={approve}
      className="inline-flex items-center gap-1 rounded border border-success/40 px-1.5 py-0.5 text-[10px] text-success hover:bg-success/10 disabled:opacity-50"
      title="Approuver ce nom">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} approuver
    </button>
  );
}
