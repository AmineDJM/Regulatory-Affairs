"use client";

import * as React from "react";
import { Loader2, Check, Info } from "lucide-react";
import { updateRegulatoryStatus } from "@/lib/actions/regulatory-actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { REGULATORY_STATUS, PRIORITY } from "@/lib/labels";

/**
 * LE NIVEAU DE PROCESS NE SE CHOISIT PLUS — IL SE LIT.
 *
 * Il y avait ici un menu déroulant. Rien ne le reliait aux vingt-trois étapes du processus
 * d'enregistrement : on déposait à l'ANPP, on cochait l'étape, et le bandeau continuait
 * d'afficher « Pré-soumission » jusqu'à ce que quelqu'un pense à revenir le changer. Sur
 * soixante-neuf dossiers, ce quelqu'un n'existe pas.
 *
 * Le niveau est désormais DÉDUIT des étapes (`lib/regulatory/process-status.ts`) et affiché
 * ici, avec la phrase qui dit d'où il vient — un chiffre qu'on ne peut plus corriger doit
 * expliquer sa provenance, sinon on le croit cassé. Seule la PRIORITÉ reste un choix : elle
 * n'est pas un fait du dossier, c'est une décision sur l'ordre du travail.
 */
export function StatusEditor({
  id,
  status,
  statusHint,
  priority,
}: {
  id: string;
  status: string;
  statusHint: string;
  priority: string;
}) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <div className="flex flex-wrap items-end justify-end gap-3">
      <div className="space-y-1">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          Niveau de process
          <span title={statusHint} className="inline-flex cursor-help">
            <Info className="h-3 w-3" />
          </span>
        </span>
        <div className="flex h-8 items-center">
          <StatusBadge map={REGULATORY_STATUS} value={status} />
        </div>
      </div>

      <form
        action={async (fd) => {
          setSaving(true);
          await updateRegulatoryStatus(fd);
          setSaving(false);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
        className="flex items-end gap-2"
      >
        <input type="hidden" name="id" value={id} />
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Priorité</label>
          <Select name="priority" defaultValue={priority} className="h-8 text-xs">
            {Object.entries(PRIORITY).map(([v, d]) => (
              <option key={v} value={v}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : null}
          {saved ? "Enregistré" : "Mettre à jour"}
        </Button>
      </form>
    </div>
  );
}
