"use client";

import * as React from "react";
import { Loader2, Check } from "lucide-react";
import { updateRegulatoryStatus } from "@/lib/actions/regulatory-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { REGULATORY_STATUS, PRIORITY } from "@/lib/labels";

export function StatusEditor({
  id,
  status,
  priority,
}: {
  id: string;
  status: string;
  priority: string;
}) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await updateRegulatoryStatus(fd);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Niveau de process</label>
        <Select name="status" defaultValue={status} className="h-8 text-xs">
          {Object.entries(REGULATORY_STATUS).map(([v, d]) => (
            <option key={v} value={v}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Priorité</label>
        <Select name="priority" defaultValue={priority} className="h-8 text-xs">
          {Object.entries(PRIORITY).map(([v, d]) => (
            <option key={v} value={v}>
              {d.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={saving}>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : null}
        {saved ? "Enregistré" : "Mettre à jour"}
      </Button>
    </form>
  );
}
