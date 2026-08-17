"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { RecordForm, type FieldDef } from "@/components/shared/create-record-button";
import { editLegalDocument } from "@/lib/actions/legal-actions";

/**
 * MODIFIER UN ENGAGEMENT, depuis sa fiche.
 *
 * L'identifiant est LIÉ à l'action côté serveur, jamais posé dans un champ caché — un champ caché
 * se réécrit dans le navigateur. Corriger les dates rouvre la surveillance : le prochain balayage
 * annoncera la nouvelle échéance (c'est l'action serveur qui remet `lastRemindedAt` à zéro).
 */
export function EditLegalButton({ id, fields }: { id: string; fields: FieldDef[] }) {
  const [open, setOpen] = React.useState(false);
  const action = React.useMemo(() => editLegalDocument.bind(null, id), [id]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Modifier
      </Button>

      <Sheet
        open={open} onClose={() => setOpen(false)} width="lg"
        title="Modifier le document"
        description="Laisser la date de fin vide = document sans échéance : il ne se périmera jamais et ne déclenchera aucun rappel."
      >
        <RecordForm
          fields={fields}
          action={action}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
          submitLabel="Enregistrer les corrections"
        />
      </Sheet>
    </>
  );
}
