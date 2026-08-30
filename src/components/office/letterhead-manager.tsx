"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileStack, Plus, Pencil, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { uploadLetterhead, updateLetterhead, deleteLetterhead } from "@/lib/actions/letterhead-actions";
import { KIND_EXTENSION, KIND_LABEL } from "@/lib/office/letterhead";
import type { OfficeKind } from "@/lib/office-templates";
import type { LetterheadOption } from "@/lib/queries/letterheads";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { explorerSize } from "@/lib/drive/explorer";
import { cn } from "@/lib/utils";

const KINDS: OfficeKind[] = ["word", "cell", "slide"];

/**
 * LA PAPETERIE DE LA SOCIÉTÉ — tenue par l'assistante de direction.
 *
 * On téléverse un VRAI document déjà mis en page (le `.docx` d'en-tête tel qu'il est imprimé),
 * pas une image de logo : c'est ce document que « Créer avec en-tête » recopie octet pour octet.
 *
 * Un en-tête retiré se DÉSACTIVE plutôt que de disparaître : il cesse d'être proposé, mais reste
 * visible ici. Sinon, un modèle mis de côté devient introuvable et se re-téléverse en double,
 * l'ancienne version repartant en circulation quelques semaines plus tard.
 */
export function LetterheadManager({
  letterheads, companies, embedded = false,
}: {
  letterheads: LetterheadOption[];
  companies: { id: string; label: string }[];
  /** Rendu DANS une feuille (menu « ⋯ » du Drive) : le titre et le cadre sont déjà posés. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<LetterheadOption | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    const r = await fn();
    setBusyId(null);
    if (!r.ok) window.alert(r.error ?? "Échec.");
    else router.refresh();
  };

  return (
    <section className={embedded ? "space-y-3" : "surface space-y-3 p-3 sm:p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        {!embedded && (
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileStack className="h-4 w-4 text-primary" /> Papiers en-tête
          </h2>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Téléverser
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Le document d&apos;en-tête tel qu&apos;il s&apos;imprime — marges, logo, pied de page, mentions
        légales. Créer « avec en-tête » en fait une copie exacte : les documents déjà créés ne
        changent jamais quand vous modifiez ou retirez un modèle ici.
      </p>

      {letterheads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aucun papier en-tête. Téléversez le <code>.docx</code> d&apos;en-tête de l&apos;entité :
          il sera proposé à chaque création de document Word.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {letterheads.map((l) => (
            <li key={l.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !l.isActive && "opacity-60")}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{l.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {l.companyLabel ?? "Commun au groupe"} · {explorerSize(l.size, true)}
                  {l.uploadedBy ? ` · déposé par ${l.uploadedBy}` : ""}
                </span>
              </span>
              <Badge tone="info">{KIND_LABEL[l.kind as OfficeKind] ?? l.kind}</Badge>
              {!l.isActive && <Badge tone="warning">Retiré</Badge>}
              <span className="flex items-center gap-1">
                <IconAction
                  title={l.isActive ? "Retirer de la liste proposée" : "Reproposer à la création"}
                  busy={busyId === l.id}
                  onClick={() => act(l.id, () => {
                    const fd = new FormData();
                    fd.set("id", l.id);
                    fd.set("isActive", l.isActive ? "0" : "1");
                    return updateLetterhead(fd);
                  })}
                >
                  {l.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </IconAction>
                <IconAction title="Renommer / changer d'entité" busy={false} onClick={() => setEditing(l)}>
                  <Pencil className="h-4 w-4" />
                </IconAction>
                <IconAction
                  title="Supprimer définitivement" danger busy={busyId === l.id}
                  onClick={() => {
                    if (!window.confirm(`Supprimer le papier en-tête « ${l.name} » ? Les documents déjà créés dessus ne changent pas.`)) return;
                    const fd = new FormData();
                    fd.set("id", l.id);
                    void act(l.id, () => deleteLetterhead(fd));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconAction>
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && <UploadSheet companies={companies} onClose={() => setAdding(false)} />}
      {editing && <EditSheet letterhead={editing} companies={companies} onClose={() => setEditing(null)} />}
    </section>
  );
}

function IconAction({
  title, onClick, busy, danger, children,
}: {
  title: string;
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button" title={title} aria-label={title} onClick={onClick} disabled={busy}
      className={cn(
        "rounded-lg p-1.5 transition-colors hover:bg-secondary",
        danger ? "text-destructive" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function UploadSheet({ companies, onClose }: { companies: { id: string; label: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<OfficeKind>("word");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <Sheet
      open onClose={() => !busy && onClose()} width="md"
      title="Nouveau papier en-tête"
      description="Le document tel qu'il s'imprime. C'est ce fichier qui sera recopié à l'identique."
    >
      <form
        action={async (fd) => {
          setBusy(true); setErr(null);
          const r = await uploadLetterhead(undefined, fd);
          setBusy(false);
          if (r.ok) { onClose(); router.refresh(); } else setErr(r.error ?? "Échec du téléversement.");
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="lh-kind">Type de document</Label>
          <Select id="lh-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as OfficeKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]} (.{KIND_EXTENSION[k]})</option>)}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lh-file">Fichier .{KIND_EXTENSION[kind]}</Label>
          <Input id="lh-file" name="file" type="file" accept={`.${KIND_EXTENSION[kind]}`} required />
          <p className="text-xs text-muted-foreground">
            Un fichier d&apos;un autre type est refusé : il ne s&apos;ouvrirait pas, et l&apos;erreur
            n&apos;apparaîtrait qu&apos;au moment de rédiger.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lh-name">Nom affiché</Label>
          <Input id="lh-name" name="name" placeholder="En-tête Adventum Pharma" />
          <p className="text-xs text-muted-foreground">Vide : le nom du fichier est repris.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lh-company">Entité</Label>
          <Select id="lh-company" name="companyId" defaultValue="">
            <option value="">Commun au groupe</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>

        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Téléverser
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function EditSheet({
  letterhead, companies, onClose,
}: {
  letterhead: LetterheadOption;
  companies: { id: string; label: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <Sheet open onClose={() => !busy && onClose()} width="md" title={`Modifier — ${letterhead.name}`}>
      <form
        action={async (fd) => {
          setBusy(true); setErr(null);
          fd.set("id", letterhead.id);
          const r = await updateLetterhead(fd);
          setBusy(false);
          if (r.ok) { onClose(); router.refresh(); } else setErr(r.error ?? "Échec.");
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label htmlFor="lhe-name">Nom affiché</Label>
          <Input id="lhe-name" name="name" defaultValue={letterhead.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lhe-company">Entité</Label>
          <Select id="lhe-company" name="companyId" defaultValue={letterhead.companyId ?? ""}>
            <option value="">Commun au groupe</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          Pour changer le document lui-même, téléversez un nouvel en-tête et retirez celui-ci : on
          ne remplace pas des octets sous un nom déjà utilisé dans des courriers partis.
        </p>
        {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
