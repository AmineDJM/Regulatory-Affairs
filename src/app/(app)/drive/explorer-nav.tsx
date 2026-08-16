"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Share2, FolderOpen, Loader2, Check, Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { QUICK_ACCESS, TRASH_ENTRY } from "@/lib/drive/explorer";
import { buildNavTree, type FlatFolder, type TreeFolder } from "@/lib/drive/nav-tree";
import { moveNode, shareNodeWithMany } from "@/lib/actions/drive-actions";

interface SpaceLite { id: string; name: string; icon: string | null; canManage: boolean }
interface UserLite { id: string; name: string }

/**
 * LE VOLET DE NAVIGATION — la colonne de gauche d'un explorateur, avec ce qu'elle doit faire.
 *
 * Trois choses la rendent reconnaissable, et les trois manquaient :
 *   • **l'arborescence**, pas seulement les emplacements. On déplie une catégorie et on voit ses
 *     dossiers, comme dans n'importe quel explorateur ;
 *   • **le dépôt**. On attrape un fichier dans la liste et on le lâche sur une catégorie ou un
 *     dossier de la colonne — un seul geste. Sans cela, ranger obligeait à naviguer d'abord
 *     jusqu'à la destination, soit exactement ce que le glisser-déposer devait éviter ;
 *   • **le partage sur place** (clic droit), parce que c'est là qu'on pense à une catégorie ou à
 *     un dossier — pas une fois qu'on est entré dedans.
 *
 * L'autorisation n'est JAMAIS décidée ici : `moveNode` et `shareNodeWithMany` tranchent côté
 * serveur. Une entrée de trop dans l'arbre ne donne aucun droit — elle donnerait un refus.
 */
export function ExplorerNav({
  active, spaces, folders = [], users = [],
}: {
  /** Clé de l'entrée courante : `recent`, `root`, `trash`, un id de catégorie ou de dossier. */
  active: string;
  spaces: SpaceLite[];
  folders?: FlatFolder[];
  /** Personnes avec qui partager (hors soi-même) — vide = pas de partage depuis le volet. */
  users?: UserLite[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const [over, setOver] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [menu, setMenu] = React.useState<{ x: number; y: number; id: string; name: string; kind: "space" | "folder" } | null>(null);
  const [share, setShare] = React.useState<{ id: string; name: string } | null>(null);

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", close); };
  }, [menu]);

  /** Dépose le nœud glissé dans un dossier (`targetId`) ou à la racine d'un emplacement. */
  const drop = React.useCallback(async (e: React.DragEvent, opts: { targetId?: string; spaceId?: string | null; label: string }) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const id = e.dataTransfer.getData("text/drive-node");
    if (!id || id === opts.targetId) return;
    setMsg({ ok: true, text: `Déplacement vers ${opts.label}…` });
    const fd = new FormData();
    fd.set("id", id);
    fd.set("targetId", opts.targetId ?? "");
    fd.set("spaceId", opts.spaceId ?? "");
    const r = await moveNode(fd);
    setMsg(r.ok ? { ok: true, text: `Déplacé vers ${opts.label}.` } : { ok: false, text: r.error ?? "Déplacement impossible." });
    if (r.ok) router.refresh();
    window.setTimeout(() => setMsg(null), 3000);
  }, [router]);

  const dropProps = (key: string, opts: { targetId?: string; spaceId?: string | null; label: string }) => ({
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setOver(key); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(key); },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => { void drop(e, opts); },
  });

  const rowClass = (key: string, isActive: boolean) =>
    `group flex items-center gap-1.5 rounded-lg py-1.5 pr-2 text-sm transition-colors ${
      over === key ? "bg-primary/15 ring-1 ring-inset ring-primary"
        : isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-secondary"
    }`;

  const ctxProps = (id: string, name: string, kind: "space" | "folder") => ({
    onContextMenu: (e: React.MouseEvent) => {
      if (users.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 120), id, name, kind });
    },
  });

  /** Un dossier de l'arbre, et ses enfants. */
  const Folder = ({ node, spaceId }: { node: TreeFolder; spaceId: string | null }) => {
    const href = spaceId ? `/drive/espace/${spaceId}?folder=${node.id}` : `/drive?folder=${node.id}`;
    const hasChildren = node.children.length > 0;
    const opened = open.has(node.id);
    return (
      <li>
        <div
          className={rowClass(node.id, active === node.id)}
          style={{ paddingLeft: `${0.5 + node.depth * 0.75}rem` }}
          {...dropProps(node.id, { targetId: node.id, label: `« ${node.name} »` })}
          {...ctxProps(node.id, node.name, "folder")}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className={`shrink-0 rounded p-0.5 ${hasChildren ? "hover:bg-secondary" : "invisible"}`}
            aria-label={opened ? "Replier" : "Déplier"}
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${opened ? "rotate-90" : ""}`} />
          </button>
          <Link href={href} className="flex min-w-0 flex-1 items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{node.name}</span>
          </Link>
        </div>
        {opened && hasChildren && (
          <ul>{node.children.map((c) => <Folder key={c.id} node={c} spaceId={spaceId} />)}</ul>
        )}
      </li>
    );
  };

  const personalTree = buildNavTree(folders, null);

  return (
    <nav className="surface w-full shrink-0 p-2 lg:w-64" aria-label="Emplacements du Drive">
      <p className="px-2 pb-1 pt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Accès rapide</p>
      <ul className="space-y-0.5">
        {QUICK_ACCESS.map((e) => {
          // « Téléchargements » est l'espace personnel : on y dépose comme dans un vrai dossier.
          const isRoot = e.key === "root";
          return (
            <li key={e.key}>
              <div
                className={rowClass(e.key, active === e.key)}
                style={{ paddingLeft: "0.5rem" }}
                {...(isRoot ? dropProps(e.key, { spaceId: "", label: "Téléchargements" }) : {})}
              >
                <span className="w-4 shrink-0" />
                <Link href={e.href} className="flex min-w-0 flex-1 items-center gap-1.5">
                  <Icon name={e.icon} className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="truncate">{e.label}</span>
                </Link>
              </div>
              {isRoot && personalTree.length > 0 && (
                <ul>{personalTree.map((n) => <Folder key={n.id} node={n} spaceId={null} />)}</ul>
              )}
            </li>
          );
        })}
      </ul>

      {spaces.length > 0 && (
        <>
          <p className="px-2 pb-1 pt-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Catégories</p>
          <ul className="space-y-0.5">
            {spaces.map((s) => {
              const tree = buildNavTree(folders, s.id);
              const opened = open.has(s.id);
              return (
                <li key={s.id}>
                  <div
                    className={rowClass(s.id, active === s.id)}
                    style={{ paddingLeft: "0.5rem" }}
                    {...dropProps(s.id, { spaceId: s.id, label: `catégorie « ${s.name} »` })}
                    {...ctxProps(s.id, s.name, "space")}
                  >
                    <button
                      type="button"
                      onClick={() => tree.length > 0 && toggle(s.id)}
                      className={`shrink-0 rounded p-0.5 ${tree.length > 0 ? "hover:bg-secondary" : "invisible"}`}
                      aria-label={opened ? "Replier" : "Déplier"}
                    >
                      <ChevronRight className={`h-3 w-3 transition-transform ${opened ? "rotate-90" : ""}`} />
                    </button>
                    <Link href={`/drive/espace/${s.id}`} className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Icon name={s.icon || "FolderOpen"} className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="truncate">{s.name}</span>
                    </Link>
                  </div>
                  {opened && <ul>{tree.map((n) => <Folder key={n.id} node={n} spaceId={s.id} />)}</ul>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-2 border-t border-border pt-2">
        <Link
          href={TRASH_ENTRY.href}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${active === "trash" ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-secondary"}`}
        >
          <span className="w-4 shrink-0" />
          <Icon name={TRASH_ENTRY.icon} className="h-4 w-4 shrink-0 opacity-80" />
          {TRASH_ENTRY.label}
        </Link>
      </div>

      {msg && (
        <p className={`mt-2 rounded-lg px-2 py-1.5 text-xs ${msg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>
      )}

      {menu && (
        <div
          role="menu"
          style={{ top: menu.y, left: menu.x }}
          className="fixed z-50 w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {menu.kind === "folder" ? (
            <button
              type="button" role="menuitem"
              onClick={() => { setShare({ id: menu.id, name: menu.name }); setMenu(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" /> Partager…
            </button>
          ) : (
            // Une CATÉGORIE ne se partage pas nœud par nœud : ses accès (rôles + personnes)
            // se règlent au même endroit que le reste de ses réglages.
            <Link
              href={`/drive/espace/${menu.id}`} role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-secondary"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" /> Accès de la catégorie…
            </Link>
          )}
        </div>
      )}

      {share && <ShareFolderSheet node={share} users={users} onClose={() => setShare(null)} />}
    </nav>
  );
}

/** Partage d'un dossier depuis le volet : plusieurs personnes d'un coup, l'accès descend l'arbre. */
function ShareFolderSheet({ node, users, onClose }: { node: { id: string; name: string }; users: UserLite[]; onClose: () => void }) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = needle ? users.filter((u) => u.name.toLowerCase().includes(needle)) : users;

  const submit = async () => {
    if (picked.size === 0) { setErr("Choisissez au moins une personne."); return; }
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("nodeId", node.id);
    for (const id of picked) fd.append("userId", id);
    const r = await shareNodeWithMany(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Partage impossible."); return; }
    onClose();
    router.refresh();
  };

  return (
    <Sheet open onClose={() => !busy && onClose()} title={`Partager « ${node.name} »`} description="L'accès descend sur tout le contenu du dossier." width="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne…" className="pl-8" />
        </div>
        <div className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {shown.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Aucune personne.</p>
          ) : shown.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60">
              <input
                type="checkbox" className="h-4 w-4 rounded border-input"
                checked={picked.has(u.id)}
                onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })}
              />
              <span className="truncate">{u.name}</span>
            </label>
          ))}
        </div>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{picked.size} personne·s</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-input px-3 py-1.5 text-sm">Annuler</button>
            <button
              type="button" onClick={() => void submit()} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Partager
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
