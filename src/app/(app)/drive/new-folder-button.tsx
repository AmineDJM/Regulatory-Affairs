"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Check } from "lucide-react";
import { createFolder } from "@/lib/actions/drive-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function NewFolderButton({ parentId, spaceId }: { parentId: string | null; spaceId?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <>
      <Button variant="outline" type="button" onClick={() => setOpen(true)}><FolderPlus className="h-4 w-4" /> Nouveau dossier</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Nouveau dossier" width="md">
        <form
          action={async (fd) => {
            setSaving(true); setErr(null);
            const r = await createFolder(undefined, fd);
            setSaving(false);
            if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Erreur.");
          }}
          className="space-y-3"
        >
          {parentId && <input type="hidden" name="parentId" value={parentId} />}
          {spaceId && <input type="hidden" name="spaceId" value={spaceId} />}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom du dossier</Label>
            <Input id="name" name="name" required />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Créer</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
