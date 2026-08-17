"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, House, FolderInput, GripVertical, ChevronUp, ChevronDown, Trash2, Share2, FolderOpen, Check, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileGlyph } from "@/components/drive/file-glyph";
import { moveNode, trashNodes, shareNodesWithMany } from "@/lib/actions/drive-actions";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  clickSelect, selectAll, pruneSelection, allSelected, EMPTY_SELECTION, type SelectionState,
} from "@/lib/drive/selection";
import { sortRows, type SortKey, type SortDir } from "@/lib/drive/explorer";
import { NodeActions } from "./node-actions";

export interface DriveRow {
  id: string;
  name: string;
  isFile: boolean;
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

  // SÉLECTION À LA WINDOWS : clic, Ctrl+clic, Maj+clic. Le modèle est pur et testé — c'est là
  // que vivent les règles subtiles (l'ancre d'une plage ne bouge pas).
  const [sel, setSel] = React.useState<SelectionState>(EMPTY_SELECTION);
  const [zipping, setZipping] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null); // cible survolée (dossier id, ou "cat:<id>", ou "root")
  const [moveMsg, setMoveMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const order = React.useMemo(() => sorted.map((r) => r.id), [sorted]);
  // La liste change (navigation, suppression, tri) → on oublie ce qui n'existe plus, sinon la
  // barre annoncerait « 3 éléments » et l'action suivante porterait sur des identifiants disparus.
  React.useEffect(() => { setSel((s) => pruneSelection(s, order)); }, [order]);
  const allChecked = allSelected(sel, order);
  const selectedRows = sorted.filter((r) => sel.ids.includes(r.id));
  const selectedFiles = selectedRows.filter((r) => r.isFile);
  const canActOnAll = selectedRows.length > 0 && selectedRows.every((r) => r.canEdit);
  const dndEnabled = !trash;

  const toggle = (id: string, mods: { toggle?: boolean; range?: boolean } = {}) =>
    setSel((s) => clickSelect(s, id, order, mods));
  const toggleAll = () => setSel((s) => selectAll(order, !allSelected(s, order)));
  const clear = () => setSel(EMPTY_SELECTION);

  const downloadZip = () => {
    if (sel.ids.length === 0) return;
    setZipping(true);
    window.location.href = `/api/drive/zip?ids=${sel.ids.join(",")}`;
    window.setTimeout(() => setZipping(false), 4000);
  };

  /** Corbeille sur toute la sélection — un refus ponctuel n'annule pas le reste. */
  const bulkTrash = async () => {
    const n = sel.ids.length;
    if (n === 0 || busy) return;
    if (!window.confirm(n === 1 ? "Mettre cet élément à la corbeille ?" : `Mettre ces ${n} éléments à la corbeille ?`)) return;
    setBusy(true);
    const fd = new FormData();
    for (const id of sel.ids) fd.append("id", id);
    const r = await trashNodes(fd);
    setBusy(false);
    setMoveMsg(r.ok
      ? { ok: true, text: `${r.done} élément·s mis à la corbeille${r.denied ? `, ${r.denied} refusé·s` : ""}.` }
      : { ok: false, text: r.error ?? "Suppression impossible." });
    if (r.ok) { clear(); router.refresh(); }
    window.setTimeout(() => setMoveMsg(null), 4000);
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
      {sel.ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{sel.ids.length} sélectionné·s</span>

          {selectedFiles.length > 0 && (
            <Link
              href={`/drive/vue?ids=${selectedFiles.map((r) => r.id).join(",")}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <FolderOpen className="h-4 w-4" /> Ouvrir{selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ""}
            </Link>
          )}

          <button type="button" onClick={downloadZip} disabled={zipping}
            className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger
          </button>

          {!trash && users && users.length > 0 && canActOnAll && (
            <button type="button" onClick={() => setShareOpen(true)} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60">
              <Share2 className="h-4 w-4" /> Partager
            </button>
          )}

          {!trash && canActOnAll && (
            <button type="button" onClick={() => void bulkTrash()} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer
            </button>
          )}

          {!trash && !canActOnAll && (
            // On ne cache pas les boutons en silence : sans un mot, on croit à une panne.
            <span className="text-xs text-muted-foreground">
              Certains éléments ne vous appartiennent pas — partage et suppression indisponibles.
            </span>
          )}

          <button type="button" onClick={clear} className="ml-auto text-muted-foreground hover:text-foreground">Désélectionner</button>
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

      {shareOpen && users && (
        <BulkShareSheet
          nodes={selectedRows.map((r) => ({ id: r.id, name: r.name }))}
          users={users}
          onClose={() => setShareOpen(false)}
          onDone={(msg) => { setShareOpen(false); setMoveMsg({ ok: true, text: msg }); clear(); router.refresh(); window.setTimeout(() => setMoveMsg(null), 4000); }}
        />
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
                  onDragStart={(e) => {
                    // Glisser une ligne hors sélection la sélectionne d'abord — sinon on
                    // déplacerait autre chose que ce qu'on a attrapé.
                    if (!sel.ids.includes(n.id)) setSel(clickSelect(sel, n.id, order));
                    e.dataTransfer.setData("text/drive-node", n.id);
                    e.dataTransfer.setData("text/plain", n.name);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(n.id);
                  }}
                  onDragEnd={() => { setDragId(null); setOverId(null); }}
                  onDragEnter={isFolderTarget ? (e) => { e.preventDefault(); setOverId(n.id); } : undefined}
                  onDragOver={isFolderTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverId(n.id); } : undefined}
                  onDragLeave={isFolderTarget ? () => setOverId((o) => (o === n.id ? null : o)) : undefined}
                  onDrop={isFolderTarget ? onDropFolder(n.id) : undefined}
                  // Clic sur la LIGNE = sélection, comme dans un explorateur : Ctrl (ou ⌘) ajoute,
                  // Maj étend depuis l'ancre. Le nom reste un lien : on ouvre en cliquant dessus,
                  // pas en cliquant à côté.
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button,input")) return;
                    toggle(n.id, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
                  }}
                  className={`cursor-default select-none ${sel.ids.includes(n.id) ? "bg-accent/40" : ""} ${isOver && isFolderTarget ? "ring-2 ring-inset ring-primary bg-primary/5" : ""} ${dragId === n.id ? "opacity-50" : ""}`}
                >
                  <TableCell>
                    <input
                      type="checkbox" checked={sel.ids.includes(n.id)}
                      onChange={(e) => toggle(n.id, { toggle: true, range: (e.nativeEvent as MouseEvent).shiftKey })}
                      aria-label={`Sélectionner ${n.name}`} className="h-4 w-4 rounded border-input"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {dndEnabled && n.canEdit && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/50" aria-hidden />}
                      <Link href={n.href} draggable={false} className="inline-flex items-center gap-2 font-medium hover:underline">
                        <FileGlyph name={n.name} isFile={n.isFile} />
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

/**
 * PARTAGER TOUTE UNE SÉLECTION, en une fois.
 *
 * Une notification par personne pour TOUT le lot, pas une par fichier : partager douze documents
 * ne doit pas remplir douze fois la boîte de chacun — c'est le meilleur moyen de faire ignorer
 * les notifications suivantes.
 */
function BulkShareSheet({
  nodes, users, onClose, onDone,
}: {
  nodes: { id: string; name: string }[];
  users: UserLite[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [access, setAccess] = React.useState<"VIEW" | "EDIT">("VIEW");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = needle ? users.filter((u) => u.name.toLowerCase().includes(needle)) : users;

  const submit = async () => {
    if (picked.size === 0) { setErr("Choisissez au moins une personne."); return; }
    setBusy(true); setErr(null);
    const fd = new FormData();
    for (const n of nodes) fd.append("nodeId", n.id);
    for (const id of picked) fd.append("userId", id);
    fd.set("access", access);
    const r = await shareNodesWithMany(fd);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Partage impossible."); return; }
    onDone(`${r.done} élément·s partagé·s avec ${picked.size} personne·s${r.denied ? ` (${r.denied} refusé·s)` : ""}.`);
  };

  return (
    <Sheet
      open onClose={() => !busy && onClose()}
      title={nodes.length === 1 ? `Partager « ${nodes[0].name} »` : `Partager ${nodes.length} éléments`}
      description="Sur un dossier, l'accès descend sur tout son contenu."
      width="md"
    >
      <div className="space-y-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {(["VIEW", "EDIT"] as const).map((a) => (
            <button
              key={a} type="button" onClick={() => setAccess(a)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${access === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {a === "VIEW" ? "Lecture" : "Modification"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne…" className="pl-8" />
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {shown.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Aucune personne.</p>
          ) : shown.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60">
              <input
                type="checkbox" className="h-4 w-4 rounded border-input" checked={picked.has(u.id)}
                onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })}
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
