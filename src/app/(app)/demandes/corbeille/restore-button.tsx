"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { restoreRequest } from "@/lib/actions/admin-request-actions";
import { Button } from "@/components/ui/button";

export function RestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      action={async (fd) => {
        setBusy(true);
        await restoreRequest(fd);
        setBusy(false);
        router.refresh();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" size="sm" disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restaurer
      </Button>
    </form>
  );
}
