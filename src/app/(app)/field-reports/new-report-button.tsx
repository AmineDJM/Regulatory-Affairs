"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createFieldReport } from "@/lib/actions/field-report-actions";

export function NewReportButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      onClick={async () => {
        setBusy(true);
        const r = await createFieldReport();
        setBusy(false);
        if (r.ok && r.id) router.push(`/field-reports/${r.id}`);
      }}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Nouveau rapport (Parler)
    </Button>
  );
}
