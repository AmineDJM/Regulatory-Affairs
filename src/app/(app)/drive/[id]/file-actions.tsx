"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2, Check } from "lucide-react";
import { renameNode, trashNode } from "@/lib/actions/drive-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** Renommer / mettre à la corbeille le document courant — réservé aux éditeurs. */
export function FileActions({ id, name, parentHref }: { id: string; name: string; parentHref: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setRenaming(true)}><Pencil className="h-4 w-4" /> Renommer</Button>
      <form
        action={async (fd) => { setSaving(true); await trashNode(fd); setSaving(false); router.push(parentHref); router.refresh(); }}
        className="inline"
      >
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" disabled={saving} className="text-destructive hover:text-destructive">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Corbeille
        </Button>
      </form>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Renommer" width="md">
        <form action={async (fd) => { setSaving(true); await renameNode(fd); setSaving(false); setRenaming(false); router.refresh(); }} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div className="space-y-1.5">
            <Label htmlFor="rename">Nouveau nom</Label>
            <Input id="rename" name="name" defaultValue={name} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenaming(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Renommer</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
