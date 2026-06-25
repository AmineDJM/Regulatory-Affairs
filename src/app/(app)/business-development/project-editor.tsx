"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, AlertCircle } from "lucide-react";
import { updateBdProject } from "@/lib/actions/bd-project-actions";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BD_PROJECT_STATUS } from "@/lib/labels";

export function ProjectEditor({
  id, name, status, description, comment,
}: {
  id: string;
  name: string;
  status: string;
  description: string;
  comment: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setErr(null); setOpen(true); }}>
        <Pencil className="h-4 w-4" /> Modifier
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Modifier le projet" width="lg">
        <form
          action={async (fd) => {
            setSaving(true); setErr(null);
            fd.set("id", id);
            const r = await updateBdProject(fd);
            setSaving(false);
            if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Erreur.");
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom du projet<span className="ml-0.5 text-destructive">*</span></Label>
            <Input id="name" name="name" required defaultValue={name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Statut</Label>
            <Select id="status" name="status" defaultValue={status}>
              {Object.entries(BD_PROJECT_STATUS).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description / objectif</Label>
            <Textarea id="description" name="description" defaultValue={description} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comment">Commentaire</Label>
            <Textarea id="comment" name="comment" defaultValue={comment} />
          </div>
          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer</Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const d = BD_PROJECT_STATUS[status];
  return <Badge tone={d?.tone ?? "neutral"} dot={false}>{d?.label ?? status}</Badge>;
}
