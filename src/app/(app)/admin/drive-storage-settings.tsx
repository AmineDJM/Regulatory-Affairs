"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveDriveStorageSettings } from "@/lib/actions/settings-actions";

/** Réglage (Super Admin) de la capacité globale du Drive et du quota par utilisateur. */
export function DriveStorageSettings({ capacityGb, userQuotaGb }: { capacityGb: number; userQuotaGb: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setBusy(true); setErr(null);
        const r = await saveDriveStorageSettings(fd);
        setBusy(false);
        if (!r.ok) setErr(r.error ?? "Échec."); else router.refresh();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="space-y-1">
        <Label htmlFor="driveCapacityGb">Capacité globale (Go)</Label>
        <Input id="driveCapacityGb" name="driveCapacityGb" type="number" min="1" defaultValue={capacityGb} className="w-32" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="driveUserQuotaGb">Quota par utilisateur (Go)</Label>
        <Input id="driveUserQuotaGb" name="driveUserQuotaGb" type="number" min="1" defaultValue={userQuotaGb} className="w-32" />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
      </Button>
      {err && <p className="basis-full text-xs text-destructive">{err}</p>}
    </form>
  );
}
