"use client";

import * as React from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { upsertCustomFieldDef, deleteCustomFieldDef } from "@/lib/actions/custom-field-actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";

export interface FieldDefDTO {
  id: string;
  entityType: string;
  key: string;
  label: string;
  type: string;
  options: string | null;
  order: number;
  required: boolean;
}

const TYPES = [
  { value: "TEXT", label: "Texte" },
  { value: "NUMBER", label: "Nombre" },
  { value: "DATE", label: "Date" },
  { value: "BOOLEAN", label: "Oui / Non" },
  { value: "SELECT", label: "Liste de choix" },
];

export function FieldsManager({
  entityTypes,
  defs,
}: {
  entityTypes: { value: string; label: string }[];
  defs: FieldDefDTO[];
}) {
  const [entityType, setEntityType] = React.useState(entityTypes[0]?.value ?? "");
  const [saving, setSaving] = React.useState(false);
  const fieldsForType = defs.filter((d) => d.entityType === entityType);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="et" className="shrink-0">Module</Label>
        <Select id="et" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-72">
          {entityTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </div>

      <div className="surface overflow-hidden">
        {fieldsForType.length === 0 ? (
          <div className="p-4"><EmptyState icon="Columns3" title="Aucun champ personnalisé" description="Ajoutez une colonne ci-dessous." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Clé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Choix</TableHead>
                <TableHead>Obligatoire</TableHead>
                <TableHead>Ordre</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldsForType.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.label}</TableCell>
                  <TableCell><code className="text-xs">{d.key}</code></TableCell>
                  <TableCell><Badge tone="neutral" dot={false}>{TYPES.find((t) => t.value === d.type)?.label ?? d.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.options || "—"}</TableCell>
                  <TableCell>{d.required ? <Badge tone="warning" dot={false}>Obligatoire</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{d.order}</TableCell>
                  <TableCell className="text-right">
                    <form action={async (fd) => { await deleteCustomFieldDef(fd); }} className="inline">
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <form
        action={async (fd) => { setSaving(true); await upsertCustomFieldDef(fd); setSaving(false); (document.getElementById("cf-add") as HTMLFormElement)?.reset(); }}
        id="cf-add"
        className="surface grid grid-cols-2 gap-3 p-4 md:grid-cols-5"
      >
        <input type="hidden" name="entityType" value={entityType} />
        <div className="space-y-1 md:col-span-2"><Label htmlFor="label">Nouveau champ</Label><Input id="label" name="label" placeholder="Ex. Numéro de lot" required /></div>
        <div className="space-y-1"><Label htmlFor="type">Type</Label>
          <Select id="type" name="type">{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
        </div>
        <div className="space-y-1"><Label htmlFor="options">Choix (si liste)</Label><Input id="options" name="options" placeholder="A, B, C" /></div>
        <div className="space-y-1"><Label htmlFor="order">Ordre</Label><Input id="order" name="order" type="number" defaultValue={fieldsForType.length} /></div>
        <label className="col-span-2 flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="required" className="h-4 w-4 rounded border-input" />
          Champ obligatoire (à remplir avant d&apos;enregistrer la fiche)
        </label>
        <div className="col-span-2 flex items-end md:col-span-3 md:justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ajouter la colonne
          </Button>
        </div>
      </form>
    </div>
  );
}
