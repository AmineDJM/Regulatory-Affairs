"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2, Check } from "lucide-react";
import { MenuItem } from "./node-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { LEGAL_DOC_KIND } from "@/lib/labels";
import { attachDriveNodeToLegal } from "@/lib/actions/legal-actions";

/**
 * ENVOYER UN FICHIER DU DRIVE VERS LEGAL — SANS EN FAIRE DE COPIE.
 *
 * Le geste réel : le contrat est déjà dans le Drive, on veut le déclarer comme engagement et lui
 * donner ce que le Drive ne sait pas porter — le titre exact, la partie en face, les dates.
 *
 * Le fichier NE BOUGE PAS et n'est pas dupliqué : Legal garde une référence vers ce nœud. Il
 * continue donc de se versionner, de se renommer et de se partager dans le Drive, et Legal en
 * montre toujours la version courante. Deux copies auraient divergé dès la première correction,
 * et plus personne n'aurait su laquelle fait foi.
 */
export function SendToLegalItem({ nodeId, name, onOpened }: { nodeId: string; name: string; onOpened?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true); setErr(null);
    const r = await attachDriveNodeToLegal({
      driveNodeId: nodeId,
      title: String(fd.get("title") ?? ""),
      kind: String(fd.get("kind") ?? "CONTRACT"),
      counterparty: String(fd.get("counterparty") ?? ""),
      reference: String(fd.get("reference") ?? ""),
      startDate: String(fd.get("startDate") ?? ""),
      endDate: String(fd.get("endDate") ?? ""),
    });
    setSaving(false);
    if (r.ok) {
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); router.refresh(); }, 900);
    } else {
      setErr(r.error ?? "Échec.");
    }
  };

  return (
    <>
      {/* Entrée de menu : le libellé dit ce que l'icône seule ne disait pas — et surtout que le
          fichier RESTE dans le Drive, ce qui est la question qu'on se pose avant de cliquer. */}
      <MenuItem
        icon={<Scale className="h-3.5 w-3.5" />}
        label="Déclarer dans Legal"
        onClick={() => { setErr(null); setOpen(true); onOpened?.(); }}
      />

      <Sheet open={open} onClose={() => setOpen(false)} title="Déclarer dans Legal" width="md">
        <form onSubmit={submit} className="space-y-3">
          <p className="rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-muted-foreground">
            <strong>{name}</strong> reste dans le Drive : Legal ne fait pas de copie, il pointe vers ce
            fichier. Il continuera de s&apos;y versionner et de s&apos;y renommer, et Legal en montrera
            toujours la version courante.
          </p>

          <div>
            <Label htmlFor="legal-title">Titre exact du document</Label>
            <Input id="legal-title" name="title" defaultValue={name} className="mt-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="legal-kind">Nature</Label>
              <Select id="legal-kind" name="kind" defaultValue="CONTRACT" className="mt-1">
                {Object.entries(LEGAL_DOC_KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="legal-ref">Référence / n°</Label>
              <Input id="legal-ref" name="reference" className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="legal-party">Partie (fournisseur, client, prestataire)</Label>
            <Input id="legal-party" name="counterparty" className="mt-1" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="legal-start">Date de début</Label>
              <Input id="legal-start" name="startDate" type="date" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="legal-end">Date de fin</Label>
              <Input id="legal-end" name="endDate" type="date" className="mt-1" />
              {/* Sans échéance est un cas NORMAL, pas un oubli : on le dit, sinon on invente une date. */}
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                Laissez vide si le document n&apos;a pas d&apos;échéance — il ne se périmera jamais et
                ne déclenchera aucun rappel.
              </p>
            </div>
          </div>

          {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving || done}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
              {done ? "Déclaré" : "Déclarer dans Legal"}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
