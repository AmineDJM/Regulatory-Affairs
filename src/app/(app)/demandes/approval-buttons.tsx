"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, Pencil } from "lucide-react";
import { decideApproval } from "@/lib/actions/admin-request-actions";
import { cn } from "@/lib/utils";

export function ApprovalButtons({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  function Btn({ decision, label, icon, cls }: { decision: string; label: string; icon: React.ReactNode; cls: string }) {
    return (
      <form action={async (fd) => { setBusy(true); await decideApproval(fd); setBusy(false); router.refresh(); }} className="inline">
        <input type="hidden" name="approvalId" value={approvalId} />
        <input type="hidden" name="decision" value={decision} />
        <button type="submit" disabled={busy} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50", cls)}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon} {label}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Btn decision="APPROVED" label="Valider" icon={<Check className="h-3.5 w-3.5" />} cls="border-success/30 text-success hover:bg-success/10" />
      <Btn decision="CHANGES_REQUESTED" label="Modif." icon={<Pencil className="h-3.5 w-3.5" />} cls="border-border text-muted-foreground hover:bg-secondary" />
      <Btn decision="REJECTED" label="Refuser" icon={<X className="h-3.5 w-3.5" />} cls="border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive" />
    </div>
  );
}
