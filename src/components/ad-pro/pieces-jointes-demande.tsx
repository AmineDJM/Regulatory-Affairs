"use client";

import * as React from "react";
import { Plus, X, Paperclip } from "lucide-react";
import type { EntityType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { ConseilLuna } from "./conseil-luna";
import { NATURES_DEMANDE_CONSEIL, type NatureDemandeConseil } from "@/lib/ad-pro/conseil-pieces";

/**
 * LES PIÈCES JOINTES GÉNÉRALES D'UNE DEMANDE AD & PRO — lettre de demande du médecin, programme,
 * convention, engagement, courrier… (Direction, 04/10).
 *
 * Le bloc « Pièces liées » (rattacher un document Legal, sections Devis → BC → Facture, engagements,
 * courriers) a quitté la fiche : la chaîne d'achat vit désormais SUR CHAQUE POSTE, en trois cases.
 * Ce qui reste à la demande, ce sont ses pièces générales : un petit « + Pièce jointe » discret, en
 * haut à droite de la carte des détails, et leur liste compacte sous les détails. Les fichiers déjà
 * déposés restent tous visibles ici — y compris un devis ou une facture posés jadis sur la demande.
 */
export interface PiecesJointesDeLaDemande {
  entityType: EntityType;
  entityId: string;
  documents: DocItem[];
  /** Peut déposer (la règle commune `canAttachToAdPro`, calculée au serveur). */
  peutDeposer: boolean;
  /** Pourquoi on ne peut pas déposer — dit plutôt que de cacher le bouton sans un mot. */
  motif?: string | null;
  /** Les catégories du dépôt de la demande (`categoriesDuDepotDeLaDemande`). */
  categories: string[];
  canDelete: boolean;
  canRename: boolean;
  canEdit: boolean;
  path: string;
}

export function CarteDetailsDemande({ titre, pieces, children, contentClassName }: {
  titre: string;
  pieces: PiecesJointesDeLaDemande;
  /** Les détails de la demande (rendus au serveur) ; absent, la carte ne porte que les pièces jointes. */
  children?: React.ReactNode;
  contentClassName?: string;
}) {
  const [ouvert, setOuvert] = React.useState(false);
  // LES PIÈCES DÉPOSÉES DANS CETTE SESSION par « + Pièce jointe » : Luna lit chacune et dit si elle
  // est au bon endroit (les détails de la demande, ou la bonne case d'un poste) — il CONSEILLE, il ne
  // déplace rien. Un état local, jamais au rechargement : chaque montage de <ConseilLuna> appelle un
  // modèle payant. L'interrupteur général de l'IA et la bascule du conseil sont relus au serveur, et
  // la ligne dit pourquoi Luna se tait quand l'un ou l'autre est coupé.
  const [deposes, setDeposes] = React.useState<string[]>([]);
  const nature = (NATURES_DEMANDE_CONSEIL as readonly string[]).includes(pieces.entityType)
    ? (pieces.entityType as NatureDemandeConseil)
    : null;
  const surDepot = React.useCallback((ids: string[]) => {
    setDeposes((cur) => [...cur, ...ids.filter((id) => !cur.includes(id))]);
  }, []);
  const n = pieces.documents.length;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <CardTitle>{titre}</CardTitle>
        {pieces.peutDeposer && (
          <button
            type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {ouvert ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {ouvert ? "Fermer" : "Pièce jointe"}
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {children && <div className={contentClassName}>{children}</div>}
        {ouvert && pieces.peutDeposer && (
          <DocumentUpload
            entityType={pieces.entityType} entityId={pieces.entityId} categories={pieces.categories}
            onUploaded={nature ? surDepot : undefined}
          />
        )}
        {nature && deposes.length > 0 && (
          <ul className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2" aria-label="Conseil de Luna sur les pièces déposées">
            {deposes.map((id) => {
              const doc = pieces.documents.find((d) => d.id === id);
              return (
                <li key={id} className="space-y-0.5">
                  <p className="truncate text-xs font-medium">{doc?.name ?? "Pièce déposée"}</p>
                  <ConseilLuna entityType={nature} entityId={pieces.entityId} fichierId={id} emplacement={{ type: "DETAILS" }} />
                </li>
              );
            })}
          </ul>
        )}
        <div className={children ? "border-t border-border/70 pt-3" : undefined}>
          <p className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Pièces jointes de la demande{n > 0 ? ` (${n})` : ""}
          </p>
          {n > 0 ? (
            <DocumentList
              documents={pieces.documents} canDelete={pieces.canDelete} canRename={pieces.canRename}
              canEdit={pieces.canEdit} path={pieces.path}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Aucune pièce jointe.</p>
          )}
          {!pieces.peutDeposer && pieces.motif && <p className="mt-1 text-xs text-muted-foreground">{pieces.motif}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
