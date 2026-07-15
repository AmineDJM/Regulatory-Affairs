"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { shareNode, unshareNode } from "@/lib/actions/drive-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export interface ShareItem { userId: string; name: string; access: string }

/** Ligne d'un partage : l'accès est **modifiable** (Lecture / Éditeur / Aucun accès). */
function ShareRow({ nodeId, share, canEdit, onChanged }: { nodeId: string; share: ShareItem; canEdit: boolean; onChanged?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function change(value: string) {
    setBusy(true);
    const fd = new FormData();
    fd.set("nodeId", nodeId);
    fd.set("userId", share.userId);
    if (value === "NONE") {
      await unshareNode(fd);
    } else {
      fd.set("access", value);
      await shareNode(fd);
    }
    setBusy(false);
    onChanged?.();
    router.refresh();
  }

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 truncate">{share.name}</span>
      {canEdit ? (
        <span className="flex items-center gap-1.5">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Select
            value={share.access}
            onChange={(e) => change(e.target.value)}
            disabled={busy}
            className="h-8 w-32 text-xs"
          >
            <option value="VIEW">Lecture</option>
            <option value="EDIT">Éditeur</option>
            <option value="NONE">Aucun accès</option>
          </Select>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{share.access === "EDIT" ? "Éditeur" : "Lecture"}</span>
      )}
    </li>
  );
}

export function SharePanel({
  nodeId, users, shares, canEdit, onChanged,
}: {
  nodeId: string;
  users: { id: string; name: string }[];
  shares: ShareItem[];
  canEdit: boolean;
  /** Appelé après un ajout / changement / retrait — pour rafraîchir un panneau embarqué. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  return (
    <div className="space-y-3">
      {shares.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore partagé.</p>
      ) : (
        <ul className="space-y-1.5">
          {shares.map((s) => <ShareRow key={s.userId} nodeId={nodeId} share={s} canEdit={canEdit} onChanged={onChanged} />)}
        </ul>
      )}

      {canEdit && users.length > 0 && (
        <form
          action={async (fd) => { setSaving(true); await shareNode(fd); setSaving(false); onChanged?.(); router.refresh(); }}
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
            <option value="EDIT">Éditeur</option>
          </Select>
          <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}</Button>
        </form>
      )}
    </div>
  );
}
