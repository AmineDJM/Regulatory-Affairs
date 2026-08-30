"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { DocumentUpload } from "@/components/documents/document-upload";

/**
 * DÉPOSER LE CTD — depuis la TÊTE du dossier.
 *
 * Le dépôt n'existait qu'au fond de la colonne de droite, sous quatre cartes : le geste le plus
 * fréquent du module — poser le CTD initial, puis les pièces qui suivent — demandait de faire
 * défiler toute la fiche pour le trouver. Il est désormais là où l'œil va en premier, à côté de
 * « Modifier » et du statut.
 *
 * Le contenu de la feuille est le MÊME téléverseur que partout ailleurs : mêmes catégories,
 * même envoi en arrière-plan (on peut changer d'écran pendant que les fichiers montent), même
 * réplication dans le Drive du produit. Un second téléverseur pour l'occasion aurait fini par
 * diverger de celui-ci.
 */
export function DossierUploadButton({
  productId, categories,
}: {
  productId: string;
  categories: string[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UploadCloud className="h-4 w-4" /> Déposer des documents
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Déposer des documents"
        description="CTD initial, modules, certificats, lettre de soumission… Choisissez la catégorie, puis déposez un ou plusieurs fichiers (ou un .zip pour un dossier entier)."
        width="md"
      >
        <div className="space-y-3">
          <DocumentUpload
            entityType="REGULATORY_PRODUCT"
            entityId={productId}
            categories={categories}
          />
          <p className="text-xs text-muted-foreground">
            L&apos;envoi continue en arrière-plan : vous pouvez fermer cette fenêtre et poursuivre
            votre travail. Chaque document est aussi classé dans le <strong>Drive</strong>, sous le
            dossier du produit.
          </p>
          <p className="text-xs text-muted-foreground">
            Pour rattacher une pièce à un <strong>moment précis du dossier</strong> (réserves,
            version redéposée), déposez-la plutôt depuis la <strong>frise</strong> plus bas :
            elle y restera liée à son étape.
          </p>
        </div>
      </Sheet>
    </>
  );
}
