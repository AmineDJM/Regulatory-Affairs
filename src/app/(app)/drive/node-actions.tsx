"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, RotateCcw, Pencil, Loader2, Check, FolderInput, UserPlus } from "lucide-react";
import { renameNode, trashNode, restoreNode, deleteNode, moveNode, getDriveNodeShares } from "@/lib/actions/drive-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SharePanel, type ShareItem } from "./[id]/share-panel";

interface MoveTarget { id: string; name: string }
interface UserLite { id: string; name: string }

interface Props {
  id: string;
  name: string;
  isFile: boolean;
  canEdit: boolean;
  trash?: boolean;
  /** Dossiers de destination pour « Déplacer » (présent = action disponible). */
  moveTargets?: MoveTarget[];
  /** Personnes avec qui partager (présent = action « Gérer l'accès » disponible). */
  users?: UserLite[];
  /** Catégorie courante (racine) : transmise au déplacement pour préserver l'espace de destination. */
  spaceId?: string | null;
}

/** Panneau « Gérer l'accès » d'un nœud (dossier ou fichier) — comme Google Drive, à tout moment. */
function AccessSheet({ nodeId, name, users, open, onClose }: { nodeId: string; name: string; users: UserLite[]; open: boolean; onClose: () => void }) {
  const [loading, setLoading] = React.useState(true);
  const [shares, setShares] = React.useState<ShareItem[]>([]);
  const [canEdit, setCanEdit] = React.useState(false);

  const load = React.useCallback(() => {
    getDriveNodeShares(nodeId).then((r) => {
      if (r.ok) { setShares(r.shares ?? []); setCanEdit(r.canEdit ?? false); }
      setLoading(false);
    });
  }, [nodeId]);

  React.useEffect(() => { if (open) { setLoading(true); load(); } }, [open, load]);

  return (
    <Sheet open={open} onClose={onClose} title={`Accès — « ${name} »`} description="Qui peut voir ou modifier. Les sous-dossiers et fichiers héritent de cet accès." width="md">
      {loading
        ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : <SharePanel nodeId={nodeId} users={users} shares={shares} canEdit={canEdit} onChanged={load} />}
    </Sheet>
  );
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

export function NodeActions({ id, name, isFile, canEdit, trash, moveTargets, users, spaceId }: Props) {
  const router = useRouter();
  const [renaming, setRenaming] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [moveErr, setMoveErr] = React.useState<string | null>(null);
  // On ne peut pas déplacer un dossier dans lui-même.
  const targets = (moveTargets ?? []).filter((t) => t.id !== id);

  return (
    <div className="flex items-center justify-end gap-0.5">
      <a href={`/api/drive/${id}/raw?dl=1`} title={isFile ? "Télécharger" : "Télécharger le dossier (ZIP)"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
        <Download className="h-3.5 w-3.5" />
      </a>
      {canEdit && !trash && (
        <>
          <button type="button" title="Renommer" onClick={() => setRenaming(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {moveTargets && targets.length > 0 && (
            <button type="button" title="Déplacer" onClick={() => { setMoveErr(null); setMoving(true); }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
              <FolderInput className="h-3.5 w-3.5" />
            </button>
          )}
          {users && (
            <button type="button" title={isFile ? "Gérer l'accès" : "Gérer l'accès (dossier + contenu)"} onClick={() => setSharing(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          )}
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

      <Sheet open={moving} onClose={() => !saving && setMoving(false)} title={`Déplacer « ${name} »`} width="md">
        <form
          action={async (fd) => {
            setSaving(true); setMoveErr(null);
            const r = await moveNode(fd);
            setSaving(false);
            if (r.ok) { setMoving(false); router.refresh(); }
            else setMoveErr(r.error ?? "Déplacement impossible.");
          }}
          className="space-y-3"
        >
          <input type="hidden" name="id" value={id} />
          {spaceId && <input type="hidden" name="spaceId" value={spaceId} />}
          <div className="space-y-1.5">
            <Label htmlFor={`target-${id}`}>Dossier de destination</Label>
            <Select id={`target-${id}`} name="targetId" defaultValue="">
              {targets.map((t) => <option key={t.id || "root"} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          {moveErr && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{moveErr}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMoving(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />} Déplacer</Button>
          </div>
        </form>
      </Sheet>

      {users && <AccessSheet nodeId={id} name={name} users={users} open={sharing} onClose={() => setSharing(false)} />}
    </div>
  );
}
