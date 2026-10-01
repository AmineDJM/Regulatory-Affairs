"use client";

import * as React from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/documents/document-upload";

/**
 * « JOINDRE LE PDF » — sur UNE pièce liée (un devis, un bon de commande, une facture), depuis la
 * fiche qui la porte (§118.161).
 *
 * Décision de la Direction : chaque maillon de la chaîne a sa fiche au registre ET son PDF. Le
 * PDF arrive souvent après la fiche (le devis signé, le BC tamponné, la facture originale) :
 * sans ce bouton, il fallait quitter la demande, ouvrir la pièce dans Legal, y téléverser, puis
 * revenir — en pratique, un PDF qui restait dans la boîte mail.
 *
 * Replié par défaut : dix téléverseurs ouverts sur dix lignes cachent les pièces qu'ils servent.
 * Le bouton n'est rendu que si la porte du serveur acceptera le dépôt — c'est l'appelant qui le
 * sait (`accesAuxPiecesLegal`), jamais ce composant.
 */
export function JoindrePdf({ entityId, categorie, libelle = "Joindre le PDF" }: {
  entityId: string;
  /** La catégorie du fichier déposé : celle de la nature de la pièce (devis, BC, facture…). */
  categorie: string;
  libelle?: string;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  if (!ouvert) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOuvert(true)}>
        <Paperclip className="h-3.5 w-3.5" /> {libelle}
      </Button>
    );
  }
  return (
    <div className="mt-1.5 flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <DocumentUpload compact entityType="LEGAL_DOCUMENT" entityId={entityId} categories={[categorie]} />
      </div>
      <Button type="button" size="icon" variant="ghost" onClick={() => setOuvert(false)} aria-label="Fermer le dépôt">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
