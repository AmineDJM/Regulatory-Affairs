"use client";

import * as React from "react";
import { Download, Trash2, RotateCcw, Pencil, Loader2, Check } from "lucide-react";
import { renameNode, trashNode, restoreNode, deleteNode } from "@/lib/actions/drive-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

interface Props {
  id: string;
  name: string;
  isFile: boolean;
  canEdit: boolean;
  trash?: boolean;
}

function IconForm({ action, id, title, children }: { action: (fd: FormData) => Promise<unknown>; id: string; title: string; children: React.ReactNode }) {
  const [saving, setSaving] = React.useState(false);
  return (
    <form action={async (fd) => { setSaving(true); await action(fd); setSaving(false); }} className="inline">
      <input type="hidden" name="id" value={id} />
      <button type="submit" title={title} disabled={saving}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      </button>
    </form>
  );
}

export function NodeActions({ id, name, isFile, canEdit, trash }: Props) {
  const [renaming, setRenaming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  return (
    <div className="flex items-center justify-end gap-0.5">
      {isFile && (
        <a href={`/api/drive/${id}/raw?dl=1`} title="Télécharger"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
      {canEdit && !trash && (
        <>
          <button type="button" title="Renommer" onClick={() => setRenaming(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <IconForm action={trashNode} id={id} title="Corbeille"><Trash2 className="h-3.5 w-3.5" /></IconForm>
        </>
      )}
      {canEdit && trash && (
        <>
          <IconForm action={restoreNode} id={id} title="Restaurer"><RotateCcw className="h-3.5 w-3.5" /></IconForm>
          <IconForm action={deleteNode} id={id} title="Supprimer définitivement"><Trash2 className="h-3.5 w-3.5 text-destructive" /></IconForm>
        </>
      )}

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Renommer" width="md">
        <form action={async (fd) => { setSaving(true); await renameNode(fd); setSaving(false); setRenaming(false); }} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div className="space-y-1.5">
            <Label htmlFor="name">Nouveau nom</Label>
            <Input id="name" name="name" defaultValue={name} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenaming(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Renommer</Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
