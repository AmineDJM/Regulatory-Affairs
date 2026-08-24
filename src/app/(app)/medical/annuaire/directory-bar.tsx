"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookUser, Plus, Pencil, Trash2, Loader2, Lock, Users } from "lucide-react";
import {
  createMedicalDirectory, updateMedicalDirectory, deleteMedicalDirectory, setDirectoryAccess,
} from "@/lib/actions/medical-directory-crud-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DirectoryRow {
  id: string;
  name: string;
  companyId: string | null;
  companyLabel: string | null;
  doctorCount: number;
  /** Les personnes nommées sur cet annuaire. Vide = ouvert à tout le module. */
  accessUserIds: string[];
}

/**
 * LES ANNUAIRES — plusieurs listes nommées, pas une seule.
 *
 * « Cardiologues Centre », « Prescripteurs Oncologie », « Congrès 2026 » : une entreprise en tient
 * plusieurs, et les fondre en un seul annuaire les rend tous inutilisables. On importe trois cents
 * noms pour une campagne, et la liste de tout le monde est polluée pour six mois.
 *
 * Le compte de praticiens s'affiche sur chaque annuaire : sans lui, on les ouvre un par un pour
 * trouver celui qui n'est pas vide.
 *
 * ⚠️ Un annuaire RANGE, il n'AUTORISE pas : le cloisonnement par entité et la portée du délégué
 * restent les seules règles d'accès.
 */
export function DirectoryBar({
  directories, current, companies, generalCount, canManage, people = [],
}: {
  directories: DirectoryRow[];
  /** Annuaire ouvert : `null` = tous, `"general"` = ceux qui ne sont dans aucun annuaire. */
  current: string | null;
  companies: { id: string; label: string }[];
  generalCount: number;
  canManage: boolean;
  /** Personnes désignables pour l'accès. Vide → le réglage d'accès n'apparaît pas. */
  people?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<DirectoryRow | null>(null);
  const [accessFor, setAccessFor] = React.useState<DirectoryRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const href = (id: string | null) => (id ? `/medical/annuaire?annuaire=${id}` : "/medical/annuaire");

  const remove = async (d: DirectoryRow) => {
    if (!window.confirm(
      `Supprimer l'annuaire « ${d.name} » ?\n\n${d.doctorCount} praticien(s) repasseront dans l'annuaire général — aucun n'est supprimé.`,
    )) return;
    setBusy(true);
    const fd = new FormData(); fd.set("id", d.id);
    const r = await deleteMedicalDirectory(fd);
    setBusy(false);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    else { if (current === d.id) router.push("/medical/annuaire"); else router.refresh(); }
  };

  return (
    <section className="surface space-y-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookUser className="h-4 w-4 text-primary" /> Annuaires
        </h2>
        {canManage && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setErr(null); setAdding(true); }}>
            <Plus className="h-4 w-4" /> Nouvel annuaire
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/medical/annuaire"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
            !current ? "border-primary bg-primary/5 font-medium text-primary" : "border-border hover:bg-secondary",
          )}
        >
          Tous les praticiens
        </Link>

        {directories.map((d) => (
          <span
            key={d.id}
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
              d.id === current ? "border-primary bg-primary/5" : "border-border hover:bg-secondary",
            )}
          >
            <Link href={href(d.id)} className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate">{d.name}</span>
              <span className="text-xs text-muted-foreground">({d.doctorCount})</span>
              {d.companyLabel && <span className="text-[0.6875rem] text-muted-foreground">· {d.companyLabel}</span>}
              {/* Le cadenas dit qu'un accès est réglé — sans lui, un collègue qui ne voit pas
                  l'annuaire croirait à un bug et demanderait pourquoi. */}
              {d.accessUserIds.length > 0 && <Lock className="h-3 w-3 shrink-0 text-warning" aria-label="Accès restreint" />}
            </Link>
            {canManage && (
              <span className="hidden items-center gap-0.5 group-hover:inline-flex">
                <button type="button" title="Renommer" onClick={() => { setErr(null); setEditing(d); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {people.length > 0 && (
                  <button type="button" title="Gérer l'accès" onClick={() => { setErr(null); setAccessFor(d); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <Users className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" title="Supprimer" disabled={busy} onClick={() => void remove(d)} className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </span>
            )}
          </span>
        ))}

        {/* L'ANNUAIRE GÉNÉRAL a sa porte : sans elle, un praticien saisi vite et jamais rangé
            devient invisible dès qu'on prend l'habitude d'ouvrir un annuaire nommé. */}
        <Link
          href="/medical/annuaire?annuaire=general"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-sm transition-colors",
            current === "general" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          Annuaire général <span className="text-xs">({generalCount})</span>
        </Link>
      </div>

      {directories.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {canManage
            ? "Un seul annuaire pour l'instant. Créez « Cardiologues Centre », « Prescripteurs Oncologie », « Congrès 2026 »… — un import destiné à une campagne n'a pas à polluer la liste de tout le monde."
            : "Aucun annuaire nommé n'a encore été créé."}
        </p>
      )}

      {adding && (
        <DirectorySheet
          title="Nouvel annuaire" companies={companies} defaults={{}} busy={busy} err={err}
          onClose={() => setAdding(false)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            const r = await createMedicalDirectory(undefined, fd);
            setBusy(false);
            if (r.ok) { setAdding(false); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}

      {editing && (
        <DirectorySheet
          title={`Annuaire — ${editing.name}`} companies={companies}
          defaults={{ name: editing.name, companyId: editing.companyId ?? "" }}
          busy={busy} err={err}
          onClose={() => setEditing(null)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            fd.set("id", editing.id);
            const r = await updateMedicalDirectory(fd);
            setBusy(false);
            if (r.ok) { setEditing(null); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}

      {accessFor && (
        <AccessSheet
          directory={accessFor} people={people} busy={busy} err={err}
          onClose={() => setAccessFor(null)}
          onSubmit={async (fd) => {
            setBusy(true); setErr(null);
            fd.set("id", accessFor.id);
            const r = await setDirectoryAccess(fd);
            setBusy(false);
            if (r.ok) { setAccessFor(null); router.refresh(); } else setErr(r.error ?? "Échec.");
          }}
        />
      )}
    </section>
  );
}

/**
 * QUI PEUT OUVRIR CET ANNUAIRE — des cases à cocher, pas un jargon de rôles.
 *
 * Aucune case cochée = ouvert à tout le module, le cas normal. Cocher des noms FERME l'annuaire
 * à tous les autres (hors vue globale) : celui qui règle l'accès reste dedans d'office — le
 * serveur l'y garde même s'il oublie sa propre case.
 */
function AccessSheet({
  directory, people, busy, err, onClose, onSubmit,
}: {
  directory: DirectoryRow;
  people: { id: string; name: string }[];
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const initial = new Set(directory.accessUserIds);
  return (
    <Sheet
      open onClose={() => !busy && onClose()} width="md" title={`Accès — ${directory.name}`}
      description="Aucun nom coché : annuaire ouvert à tout le module. Des noms cochés : personne d'autre ne le voit — ni ses praticiens dans la vue « Tous »."
    >
      <form action={onSubmit} className="space-y-4">
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {people.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary">
              <input type="checkbox" name="userId" value={p.id} defaultChecked={initial.has(p.id)} className="h-4 w-4 accent-primary" />
              {p.name}
            </label>
          ))}
        </div>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer l&apos;accès</Button>
        </div>
      </form>
    </Sheet>
  );
}

function DirectorySheet({
  title, companies, defaults, busy, err, onClose, onSubmit,
}: {
  title: string;
  companies: { id: string; label: string }[];
  defaults: { name?: string; companyId?: string };
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  return (
    <Sheet
      open onClose={() => !busy && onClose()} width="md" title={title}
      description="Un annuaire range, il n'autorise pas : la portée du délégué et le cloisonnement par entité ne changent pas."
    >
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="md-name">Nom de l&apos;annuaire</Label>
          <Input id="md-name" name="name" required defaultValue={defaults.name} placeholder="Cardiologues Centre, Congrès 2026…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="md-company">Entité</Label>
          <Select id="md-company" name="companyId" defaultValue={defaults.companyId ?? ""}>
            <option value="">Commun au groupe</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="md-desc">Description (facultative)</Label>
          <Textarea id="md-desc" name="description" rows={2} />
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
