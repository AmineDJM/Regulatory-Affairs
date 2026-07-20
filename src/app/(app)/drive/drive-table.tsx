"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NodeActions } from "./node-actions";

export interface DriveRow {
  id: string;
  name: string;
  isFile: boolean;
  icon: string;
  category: string | null;
  owner: string;
  sizeLabel: string;
  updatedLabel: string;
  canEdit: boolean;
  href: string;
}
interface MoveTarget { id: string; name: string }
interface UserLite { id: string; name: string }

/**
 * Liste du Drive avec **sélection multiple** : cocher plusieurs fichiers/dossiers puis
 * « Télécharger (ZIP) » → une seule archive (route `/api/drive/zip`). Chaque ligne garde
 * ses actions (télécharger seul, renommer, déplacer, gérer l'accès, corbeille).
 */
export function DriveTable({ rows, moveTargets, trash, users, spaceId }: { rows: DriveRow[]; moveTargets: MoveTarget[]; trash: boolean; users?: UserLite[]; spaceId?: string | null }) {
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [zipping, setZipping] = React.useState(false);
  const allChecked = rows.length > 0 && sel.size === rows.length;

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const downloadZip = () => {
    if (sel.size === 0) return;
    setZipping(true);
    // Téléchargement direct : le navigateur récupère l'archive .zip.
    window.location.href = `/api/drive/zip?ids=${[...sel].join(",")}`;
    window.setTimeout(() => setZipping(false), 4000);
  };

  return (
    <div className="space-y-2">
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{sel.size} élément·s sélectionné·s</span>
          <button
            type="button"
            onClick={downloadZip}
            disabled={zipping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Télécharger (ZIP)
          </button>
          <button type="button" onClick={() => setSel(new Set())} className="text-muted-foreground hover:text-foreground">Désélectionner</button>
        </div>
      )}
      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Tout sélectionner" className="h-4 w-4 rounded border-input" />
              </TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead className="text-right">Taille</TableHead>
              <TableHead>Modifié</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((n) => (
              <TableRow key={n.id} className={sel.has(n.id) ? "bg-accent/40" : undefined}>
                <TableCell>
                  <input type="checkbox" checked={sel.has(n.id)} onChange={() => toggle(n.id)} aria-label={`Sélectionner ${n.name}`} className="h-4 w-4 rounded border-input" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={n.href} className="inline-flex items-center gap-2 font-medium hover:underline">
                      <Icon name={n.icon} className={`h-4 w-4 ${n.isFile ? "text-muted-foreground" : "text-primary"}`} />
                      <span className="truncate">{n.name}</span>
                    </Link>
                    {n.isFile && n.category && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{n.category}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{n.owner}</TableCell>
                <TableCell className="text-right text-muted-foreground">{n.isFile ? n.sizeLabel : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{n.updatedLabel}</TableCell>
                <TableCell className="text-right">
                  <NodeActions id={n.id} name={n.name} isFile={n.isFile} canEdit={n.canEdit} trash={trash} moveTargets={n.canEdit && !trash ? moveTargets : undefined} users={n.canEdit && !trash ? users : undefined} spaceId={spaceId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
