"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Download, Trash2, RotateCcw, Pencil, Loader2, Check, FolderInput, UserPlus, MoreVertical, User,
} from "lucide-react";
import { renameNode, trashNode, restoreNode, deleteNode, moveNode, getDriveNodeShares } from "@/lib/actions/drive-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { SharePanel, type ShareItem } from "./[id]/share-panel";
import { SendToLegalItem } from "./send-to-legal";

interface MoveTarget { id: string; name: string }
interface UserLite { id: string; name: string }

interface Props {
  id: string;
  name: string;
  isFile: boolean;
  canEdit: boolean;
  /** Le propriétaire — affiché EN TÊTE du menu, puisqu'il n'a plus de colonne à lui. */
  owner?: string;
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

/** Une entrée du menu — même hauteur, même gabarit d'icône, quel que soit ce qu'elle déclenche. */
export function MenuItem({
  icon, label, onClick, href, download, danger, disabled,
}: {
  icon: React.ReactNode; label: string;
  onClick?: () => void; href?: string; download?: boolean;
  danger?: boolean; disabled?: boolean;
}) {
  const cls = [
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
    danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-secondary",
    disabled ? "pointer-events-none opacity-50" : "",
  ].join(" ");
  const body = <><span className="shrink-0 text-muted-foreground">{icon}</span><span className="truncate">{label}</span></>;
  if (href) {
    return <a href={href} className={cls} {...(download ? { download: "" } : {})}>{body}</a>;
  }
  return <button type="button" onClick={onClick} className={cls} disabled={disabled}>{body}</button>;
}

/**
 * LE MENU ⋮ — flottant, jamais coupé.
 *
 * Le tableau vit dans un conteneur qui masque son débordement (c'est ce qui l'empêche de pousser
 * la page de travers). Un menu posé en `absolute` dedans serait donc TRONQUÉ dès la dernière
 * ligne. Il est rendu en PORTAIL, positionné en coordonnées d'écran depuis le bouton, et remis à
 * gauche quand il déborderait à droite.
 */
function Kebab({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const close = React.useCallback(() => setOpen(false), []);

  const place = React.useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 224; // largeur du menu (w-56)
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8));
    // Sous le bouton, sauf s'il n'y a plus la place en dessous — auquel cas au-dessus.
    const below = window.innerHeight - r.bottom;
    const top = below > 260 ? r.bottom + 4 : Math.max(8, r.top - 4 - 260);
    setPos({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest("[data-kebab-menu]")) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    // Un défilement décroche le menu de sa ligne : on le referme plutôt que de le laisser flotter
    // à côté d'une autre ligne, ce qui ferait agir sur le mauvais fichier.
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, place, close]);

  return (
    <>
      <button
        ref={btnRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${open ? "bg-secondary text-foreground" : ""}`}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          data-kebab-menu
          role="menu"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-56 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {children(close)}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * LES ACTIONS D'UNE LIGNE — une seule cible, un menu.
 *
 * Six icônes alignées dans une colonne « Actions » mangeaient un quart de la largeur, se
 * chevauchaient avec la date dès que le nom était long, et n'étaient de toute façon pas
 * reconnaissables sans les survoler une à une. Un seul point d'entrée libère la place pour ce
 * qu'on vient vraiment lire — le nom — et donne aux actions ce qu'aucune icône n'avait : un mot.
 *
 * Le PROPRIÉTAIRE ouvre le menu, en information, puisque sa colonne a disparu : c'est un
 * renseignement qu'on consulte de temps en temps, pas une donnée qu'on parcourt.
 */
export function NodeActions({ id, name, isFile, canEdit, owner, trash, moveTargets, users, spaceId }: Props) {
  const router = useRouter();
  const [renaming, setRenaming] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [moveErr, setMoveErr] = React.useState<string | null>(null);
  // On ne peut pas déplacer un dossier dans lui-même.
  const targets = (moveTargets ?? []).filter((t) => t.id !== id);

  /** Une action serveur simple (corbeille, restauration, suppression) lancée depuis le menu. */
  const run = async (action: (fd: FormData) => Promise<unknown>, close: () => void) => {
    close();
    setPending(true);
    const fd = new FormData();
    fd.set("id", id);
    await action(fd);
    setPending(false);
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
      {pending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}

      <Kebab label={`Actions — ${name}`}>
        {(close) => (
          <>
            {owner && (
              <div className="flex items-center gap-2.5 border-b border-border px-2.5 pb-2 pt-1.5 text-[0.75rem] text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" title={owner}>{owner}</span>
              </div>
            )}
            <div className="pt-1">
              <MenuItem
                icon={<Download className="h-3.5 w-3.5" />}
                label={isFile ? "Télécharger" : "Télécharger (ZIP)"}
                href={`/api/drive/${id}/raw?dl=1`}
              />
              {canEdit && !trash && (
                <>
                  <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} label="Renommer" onClick={() => { close(); setRenaming(true); }} />
                  {moveTargets && targets.length > 0 && (
                    <MenuItem icon={<FolderInput className="h-3.5 w-3.5" />} label="Déplacer" onClick={() => { close(); setMoveErr(null); setMoving(true); }} />
                  )}
                  {users && (
                    <MenuItem
                      icon={<UserPlus className="h-3.5 w-3.5" />}
                      label={isFile ? "Gérer l'accès" : "Gérer l'accès (dossier + contenu)"}
                      onClick={() => { close(); setSharing(true); }}
                    />
                  )}
                  {/* VERS LEGAL — déclarer ce fichier comme engagement de la société. Il RESTE
                      ici : Legal pointe dessus, il n'en est jamais fait de copie. */}
                  {isFile && <SendToLegalItem nodeId={id} name={name} onOpened={close} />}
                  <div className="my-1 border-t border-border" />
                  <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Mettre à la corbeille" danger onClick={() => void run(trashNode, close)} />
                </>
              )}
              {canEdit && trash && (
                <>
                  <MenuItem icon={<RotateCcw className="h-3.5 w-3.5" />} label="Restaurer" onClick={() => void run(restoreNode, close)} />
                  <div className="my-1 border-t border-border" />
                  <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Supprimer définitivement" danger onClick={() => void run(deleteNode, close)} />
                </>
              )}
            </div>
          </>
        )}
      </Kebab>

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
