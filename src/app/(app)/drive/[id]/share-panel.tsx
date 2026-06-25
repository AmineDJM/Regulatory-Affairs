"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, X } from "lucide-react";
import { shareNode, unshareNode } from "@/lib/actions/drive-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface ShareItem { userId: string; name: string; access: string }

export function SharePanel({
  nodeId, users, shares, canEdit,
}: {
  nodeId: string;
  users: { id: string; name: string }[];
  shares: ShareItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  return (
    <div className="space-y-3">
      {shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore partagé.</p>
      ) : (
        <ul className="space-y-1.5">
          {shares.map((s) => (
            <li key={s.userId} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {s.name}
                <Badge tone={s.access === "EDIT" ? "info" : "neutral"} dot={false}>{s.access === "EDIT" ? "Édition" : "Lecture"}</Badge>
              </span>
              {canEdit && (
                <form action={async (fd) => { await unshareNode(fd); router.refresh(); }}>
                  <input type="hidden" name="nodeId" value={nodeId} />
                  <input type="hidden" name="userId" value={s.userId} />
                  <button type="submit" title="Retirer" className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && users.length > 0 && (
        <form
          action={async (fd) => { setSaving(true); await shareNode(fd); setSaving(false); router.refresh(); }}
          className="flex items-end gap-2 border-t border-border pt-3"
        >
          <input type="hidden" name="nodeId" value={nodeId} />
          <div className="flex-1">
            <Select name="userId" required defaultValue="" className="h-9 text-sm">
              <option value="" disabled>Partager avec…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <Select name="access" defaultValue="VIEW" className="h-9 w-28 text-sm">
            <option value="VIEW">Lecture</option>
            <option value="EDIT">Édition</option>
          </Select>
          <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}</Button>
        </form>
      )}
    </div>
  );
}
