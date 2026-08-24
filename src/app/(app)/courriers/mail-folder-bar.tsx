"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderTree, FolderPlus, Folder, ChevronRight, Pencil, Trash2, Loader2, Home } from "lucide-react";
import { createMailFolder, updateMailFolder, deleteMailFolder } from "@/lib/actions/mail-folder-actions";
import { buildFolderTree, flattenFolders, folderPath, indentedLabel, deletionSummary, type FolderLite } from "@/lib/legal/folders";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MailFolderRow extends FolderLite {
  companyLabel: string | null;
  entryCount: number;
}

/**
 * L'ARMOIRE DU REGISTRE DE COURRIER — dossiers, fil d'Ariane, et le compte de plis rangés.
 *
 * Cinq cents plis dans une liste se cherchent au filtre, jamais au regard. Le nombre de courriers
 * s'affiche sur chaque dossier : sans lui, on ouvre les dossiers un par un pour trouver celui qui
 * n'est pas vide. Reprend, à l'identique, l'armoire de Legal — même problème, même solution.
 *
 * ⚠️ Un dossier ne donne AUCUN droit : le cloisonnement par entité reste la seule règle d'accès.
 */
export function MailFolderBar({
  folders, current, companies, canManage,
}: {
  folders: MailFolderRow[];
  /** Dossier ouvert, `null` = racine (tout), `"none"` = les non classés. */
  current: string | null;
  companies: { id: string; label: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<MailFolderRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const tree = React.useMemo(() => buildFolderTree(folders), [folders]);
  const flat = React.useMemo(() => flattenFolders(tree), [tree]);
  const byId = React.useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const path = React.useMemo(
    () => (current && current !== "none" ? folderPath(folders, current) : []),
    [folders, current],
  );
  const openFolder = current && current !== "none" ? byId.get(current) ?? null : null;
  const shown = folders.filter((f) => f.parentId === (openFolder?.id ?? null));

  const href = (id: string | null) => (id ? `/courriers?dossier=${id}` : "/courriers");

  const remove = async (f: MailFolderRow) => {
    const subs = folders.filter((x) => x.parentId === f.id).length;
    if (!window.confirm(`Supprimer le dossier « ${f.name} » ?\n\n${deletionSummary({ subfolders: subs, documents: f.entryCount })}`)) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", f.id);
    const r = await deleteMailFolder(fd);
    setBusy(false);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    else { if (current === f.id) router.push("/courriers"); else router.refresh(); }
  };

  return (
    <section className="surface space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FolderTree className="h-4 w-4 text-primary" /> Dossiers
        </h2>
        {canManage && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setErr(null); setAdding(true); }}>
            <FolderPlus className="h-4 w-4" /> Nouveau dossier
          </Button>
        )}
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm">
        <Link href="/courriers" className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-secondary", !current && "font-medium text-primary")}>
          <Home className="h-3.5 w-3.5" /> Tous les courriers
        </Link>
        {path.map((f) => (
          <React.Fragment key={f.id}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Link href={href(f.id)} className={cn("rounded-md px-2 py-1 hover:bg-secondary", f.id === current && "font-medium text-primary")}>
              {f.name}
            </Link>
          </React.Fragment>
        ))}
      </nav>

      <div className="flex flex-wrap gap-2">
        {shown.length === 0 && !openFolder ? (
          <p className="text-xs text-muted-foreground">
            Aucun dossier. {canManage ? "Créez « Fournisseurs », « ANPP », « Baux 2026 »… — un pli s'enregistre vite, il se range ensuite." : "Le registre n'a pas encore classé les courriers."}
          </p>
        ) : (
          shown.map((f) => (
            <span
              key={f.id}
              className={cn(
                "group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                f.id === current ? "border-primary bg-primary/5" : "border-border hover:bg-secondary",
              )}
            >
              <Link href={href(f.id)} className="inline-flex min-w-0 items-center gap-1.5">
                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">({f.entryCount})</span>
                {f.companyLabel && <span className="text-[0.6875rem] text-muted-foreground">· {f.companyLabel}</span>}
              </Link>
              {canManage && (
                <span className="hidden items-center gap-0.5 group-hover:inline-flex">
                  <button type="button" title="Renommer / déplacer" onClick={() => { setErr(null); setEditing(f); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Supprimer" disabled={busy} onClick={() => void remove(f)} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </span>
              )}
            </span>
          ))
        )}
        <Link
          href="/courriers?dossier=none"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-sm transition-colors",
            current === "none" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          Non classés
        </Link>
      </div>

      {adding && (
        <MailFolderSheet
          title="Nouveau dossier"
          companies={companies}
          folders={flat.map((n) => ({ id: n.id, label: indentedLabel(n) }))}
          defaults={{ parentId: openFolder?.id ?? "" }}
          busy={busy} err={err}
          onClose={() => setAdding(false)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            const r = await createMailFolder(undefined, fd);
            setBusy(false);
            if (r.ok) { setAdding(false); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}

      {editing && (
        <MailFolderSheet
          title={`Dossier — ${editing.name}`}
          companies={companies}
          folders={flat.filter((n) => n.id !== editing.id).map((n) => ({ id: n.id, label: indentedLabel(n) }))}
          defaults={{ name: editing.name, parentId: editing.parentId ?? "", companyId: editing.companyId ?? "" }}
          busy={busy} err={err}
          onClose={() => setEditing(null)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            fd.set("id", editing.id);
            const r = await updateMailFolder(fd);
            setBusy(false);
            if (r.ok) { setEditing(null); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}
    </section>
  );
}

function MailFolderSheet({
  title, companies, folders, defaults, busy, err, onClose, onSubmit,
}: {
  title: string;
  companies: { id: string; label: string }[];
  folders: { id: string; label: string }[];
  defaults: { name?: string; parentId?: string; companyId?: string };
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  return (
    <Sheet
      open onClose={() => !busy && onClose()} width="md" title={title}
      description="Un dossier range, il n'autorise pas : le cloisonnement par entité reste la seule règle d'accès."
    >
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="mf-name">Nom du dossier</Label>
          <Input id="mf-name" name="name" required defaultValue={defaults.name} placeholder="Fournisseurs, ANPP, Baux 2026…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mf-parent">Rangé sous</Label>
          <Select id="mf-parent" name="parentId" defaultValue={defaults.parentId ?? ""}>
            <option value="">— Racine —</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mf-company">Entité</Label>
          <Select id="mf-company" name="companyId" defaultValue={defaults.companyId ?? ""}>
            <option value="">Commun au groupe</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mf-desc">Description (facultative)</Label>
          <Textarea id="mf-desc" name="description" rows={2} />
        </div>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
        </div>
      </form>
    </Sheet>
  );
}
