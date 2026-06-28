"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileDown, Loader2 } from "lucide-react";
import { convertNodeToPdf } from "@/lib/actions/drive-actions";
import { Button } from "@/components/ui/button";

/** Convertit le fichier Office courant en PDF (via OnlyOffice) puis ouvre le PDF généré. */
export function ConvertPdfButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("id", id);
    const r = await convertNodeToPdf(fd);
    setBusy(false);
    if (r.ok && r.id) router.push(`/drive/${r.id}`);
    else setErr(r.error ?? "Conversion impossible.");
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" type="button" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Convertir en PDF
      </Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  );
}
