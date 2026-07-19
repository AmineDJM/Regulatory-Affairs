"use client";

import { FileText } from "lucide-react";
import { DocumentPreview } from "@/components/documents/document-preview";
import type { DocItem } from "@/components/documents/document-list";
import { ItemReview } from "./validation-item-review";

/**
 * Pièces d'une demande de validation AVEC verdict par pièce : chaque document est
 * prévisualisable sur place (nom cliquable) ET porte son propre panneau
 * Approuver / Réviser / Refuser + commentaire optionnel. Composant client : la page
 * (serveur) lui passe seulement des données sérialisables.
 */
export function ValidationAttachments({
  stepId, documents, decisions,
}: {
  stepId: string;
  documents: DocItem[];
  decisions: { itemKey: string; decision: string; comment: string }[];
}) {
  return (
    <ul className="divide-y divide-border">
      {documents.map((doc) => {
        const dec = decisions.find((d) => d.itemKey === doc.id);
        return (
          <li key={doc.id} className="space-y-1 py-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <DocumentPreview id={doc.id} name={doc.name} hasFile={doc.hasFile} />
              </div>
            </div>
            <ItemReview stepId={stepId} itemKey={doc.id} current={dec?.decision} currentComment={dec?.comment} />
          </li>
        );
      })}
    </ul>
  );
}
