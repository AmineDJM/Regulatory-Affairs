"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, House, FolderInput, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moveNode } from "@/lib/actions/drive-actions";
import { sortRows, type SortKey, type SortDir } from "@/lib/drive/explorer";
import { NodeActions } from "./node-actions";

export interface DriveRow {
  id: string;
  name: string;
  isFile: boolean;
  icon: string;
  category: string | null;
  owner: string;
  /** Taille brute, pour trier ; `sizeLabel` est ce qu'on affiche. */
  size: number;
  sizeLabel: string;
  /** Type lisible (« Document PDF », « Dossier compressé ») — pas un type MIME. */
  typeLabel: string;
  /** Date ISO, pour trier ; `updatedLabel` est ce qu'on affiche. */
  updatedAt: string;
  updatedLabel: string;
  canEdit: boolean;
  href: string;
}
interface MoveTarget { id: string; name: string }
interface UserLite { id: string; name: string }
interface DropCategory { id: string; name: string }

/**
 * Liste du Drive — un vrai drive : **glisser-déposer à la souris**. On attrape un fichier/dossier
 * et on le lâche sur un AUTRE dossier (pour l'y ranger) ou sur une pastille de **catégorie** (pour
 * l'y déplacer). Sélection multiple conservée (cocher → « Télécharger (ZIP) »). Chaque ligne garde
 * ses actions (télécharger, renommer, déplacer par menu, gérer l'accès, corbeille).
 */
export function DriveTable({ rows, moveTargets, trash, users, spaceId, categories }: { rows: DriveRow[]; moveTargets: MoveTarget[]; trash: boolean; users?: UserLite[]; spaceId?: string | null; categories?: DropCategory[] }) {
  const router = useRouter();
  // TRI PAR EN-TÊTE, comme dans un explorateur : on clique sur « Taille » pour trouver le gros
  // fichier, sur « Modifié le » pour retrouver celui d'hier. Les dossiers restent en tête dans les
  // deux sens (règle du module `explorer`, testée) — sinon l'arborescence se dissout dans la liste.
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const sorted = React.useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const clickSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const SortHead = ({ k, label, align }: { k: SortKey; label: string; align?: "right" }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button" onClick={() => clickSort(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${sortKey === k ? "text-foreground" : ""}`}
        aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {sortKey === k && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [zipping, setZipping] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null); // cible survolée (dossier id, ou "cat:<id>", ou "root")
  const [moveMsg, setMoveMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const allChecked = rows.length > 0 && sel.size === rows.length;
  const dndEnabled = !trash;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const downloadZip = () => {
    if (sel.size === 0) return;
    setZipping(true);
    window.location.href = `/api/drive/zip?ids=${[...sel].join(",")}`;
    window.setTimeout(() => setZipping(false), 4000);
  };

  const rowById = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  /** Déplace un nœud vers un dossier (targetId) ou vers la racine d'une catégorie (destSpaceId). */
  const doMove = React.useCallback(async (id: string, opts: { targetId?: string; destSpaceId?: string | null; label: string }) => {
    const dragged = rowById.get(id);
    setOverId(null); setDragId(null);
    setMoveMsg({ ok: true, text: `Déplacement de « ${dragged?.name ?? "l'élément"} »…` });
    const fd = new FormData();
    fd.set("id", id);
    fd.set("targetId", opts.targetId ?? "");
    fd.set("spaceId", opts.destSpaceId ?? ""); // catégorie de destination (racine) ; vide = Drive perso
    const r = await moveNode(fd);
    if (r.ok) {
      setMoveMsg({ ok: true, text: `« ${dragged?.name ?? "Élément"} » déplacé vers ${opts.label}.` });
      router.refresh();
    } else {
      setMoveMsg({ ok: false, text: r.error ?? "Déplacement impossible." });
    }
    window.setTimeout(() => setMoveMsg(null), 3500);
  }, [rowById, router]);

  const onDropFolder = (folderId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/drive-node") || dragId;
    setOverId(null);
    if (!id || id === folderId) return;
    const target = rowById.get(folderId);
    void doMove(id, { targetId: folderId, label: `« ${target?.name ?? "dossier"} »` });
  };
  const onDropCategory = (cat: DropCategory | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/drive-node") || dragId;
    setOverId(null);
    if (!id) return;
    void doMove(id, { destSpaceId: cat ? cat.id : "", label: cat ? `catégorie « ${cat.name} »` : "Mon Drive" });
  };

  // Pastilles de destination (catégories + retour au Drive personnel) TOUJOURS visibles quand il y a des
  // cibles : affichage stable (pas de saut de mise en page en plein glisser, cause de « ça marche mal »).
  const showDropBar = dndEnabled && ((categories?.length ?? 0) > 0 || spaceId != null);

  return (
    <div className="space-y-2">
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{sel.size} élément·s sélectionné·s</span>
          <button type="button" onClick={downloadZip} disabled={zipping} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger (ZIP)
          </button>
          <button type="button" onClick={() => setSel(new Set())} className="text-muted-foreground hover:text-foreground">Désélectionner</button>
        </div>
      )}

      {dndEnabled && (categories?.length || spaceId != null) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderInput className="h-3.5 w-3.5" /> Astuce : <strong className="font-medium text-foreground">glissez</strong> un fichier ou un dossier sur un autre dossier ou sur une catégorie pour le ranger.
        </p>
      )}

      {/* Barre de dépôt (apparaît pendant le glisser) : catégories + retour au Drive personnel */}
      {showDropBar && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2">
          <span className="text-xs font-medium text-muted-foreground">Déposer dans :</span>
          {spaceId != null && (
            <button type="button"
              onDragEnter={(e) => { e.preventDefault(); setOverId("root"); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverId("root"); }}
              onDragLeave={() => setOverId((o) => (o === "root" ? null : o))}
              onDrop={onDropCategory(null)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${overId === "root" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
              <House className="h-3.5 w-3.5" /> Mon Drive
            </button>
          )}
          {categories?.map((c) => (
            <button key={c.id} type="button"
              onDragEnter={(e) => { e.preventDefault(); setOverId(`cat:${c.id}`); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverId(`cat:${c.id}`); }}
              onDragLeave={() => setOverId((o) => (o === `cat:${c.id}` ? null : o))}
              onDrop={onDropCategory(c)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${overId === `cat:${c.id}` ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
              <FolderInput className="h-3.5 w-3.5" /> {c.name}
            </button>
          ))}
        </div>
      )}

      {moveMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${moveMsg.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{moveMsg.text}</p>
      )}

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Tout sélectionner" className="h-4 w-4 rounded border-input" />
              </TableHead>
              <SortHead k="name" label="Nom" />
              {/* « Type » vient d'un explorateur, et il y sert : à dosage égal de noms qui se
                  ressemblent, c'est lui qui distingue le PDF de l'archive. */}
              <SortHead k="type" label="Type" />
              <TableHead>Propriétaire</TableHead>
              <SortHead k="size" label="Taille" align="right" />
              <SortHead k="updatedAt" label="Modifié le" />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((n) => {
              const isFolderTarget = dndEnabled && !n.isFile && dragId !== null && dragId !== n.id;
              const isOver = overId === n.id;
              return (
                <TableRow
                  key={n.id}
                  draggable={dndEnabled && n.canEdit}
                  onDragStart={(e) => { e.dataTransfer.setData("text/drive-node", n.id); e.dataTransfer.setData("text/plain", n.name); e.dataTransfer.effectAllowed = "move"; setDragId(n.id); }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onDragEnter={isFolderTarget ? (e) => { e.preventDefault(); setOverId(n.id); } : undefined}
                  onDragOver={isFolderTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverId(n.id); } : undefined}
                  onDragLeave={isFolderTarget ? () => setOverId((o) => (o === n.id ? null : o)) : undefined}
                  onDrop={isFolderTarget ? onDropFolder(n.id) : undefined}
                  className={`${sel.has(n.id) ? "bg-accent/40" : ""} ${isOver && isFolderTarget ? "ring-2 ring-inset ring-primary bg-primary/5" : ""} ${dragId === n.id ? "opacity-50" : ""}`}
                >
                  <TableCell>
                    <input type="checkbox" checked={sel.has(n.id)} onChange={() => toggle(n.id)} aria-label={`Sélectionner ${n.name}`} className="h-4 w-4 rounded border-input" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {dndEnabled && n.canEdit && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50" aria-hidden />}
                      <Link href={n.href} draggable={false} className="inline-flex items-center gap-2 font-medium hover:underline">
                        <Icon name={n.icon} className={`h-4 w-4 ${n.isFile ? "text-muted-foreground" : "text-primary"}`} />
                        <span className="truncate">{n.name}</span>
                      </Link>
                      {n.isFile && n.category && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">{n.category}</span>
                      )}
                      {!n.isFile && isFolderTarget && <span className="shrink-0 text-[0.625rem] font-medium text-primary">déposer ici</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{n.typeLabel}</TableCell>
                  <TableCell className="text-muted-foreground">{n.owner}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{n.sizeLabel || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{n.updatedLabel}</TableCell>
                  <TableCell className="text-right">
                    <NodeActions id={n.id} name={n.name} isFile={n.isFile} canEdit={n.canEdit} trash={trash} moveTargets={n.canEdit && !trash ? moveTargets : undefined} users={n.canEdit && !trash ? users : undefined} spaceId={spaceId} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
