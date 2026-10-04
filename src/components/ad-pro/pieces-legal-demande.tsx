import Link from "next/link";
import type { EntityType } from "@prisma/client";
import { ExternalLink, Scale } from "lucide-react";
import type { SessionUser } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentList } from "@/components/documents/document-list";
import { lienFichierEmis } from "@/lib/legal/fichiers-emis";
import { formatCurrency } from "@/lib/utils";
import { chargerPiecesLegalDeLaDemande } from "@/lib/queries/pieces-legal-demande";

/** Au-delà de ce nombre de pièces, la liste se replie : la fiche reste lisible. */
const REPLIE_AU_DELA = 4;

/**
 * « PIÈCES LEGAL DE LA DEMANDE » — les pièces du registre rattachées DIRECTEMENT à la demande
 * (conventions, contrats, devis d'avant les postes…), et qu'aucun poste ne porte. Lecture seule :
 * la gestion se fait sur la fiche Legal. Un seul composant pour toutes les natures ; la lecture et
 * ses droits vivent dans `chargerPiecesLegalDeLaDemande`. Rien à montrer ⇒ rien n'est rendu.
 */
export async function PiecesLegalDeLaDemande({ spectateur, entityType, entityId }: {
  spectateur: SessionUser;
  entityType: EntityType;
  entityId: string;
}) {
  const p = await chargerPiecesLegalDeLaDemande(spectateur, entityType, entityId);
  if (p.total === 0) return null;

  const liste = (
    <ul className="divide-y divide-border">
      {p.lignes.map((l) => (
        <li key={l.id} className="py-2">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              {l.fiche ? (
                <Link href={`/legal/${l.id}`} className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline">
                  <span className="truncate">{l.titre}</span> <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              ) : (
                <span className="block truncate font-medium">{l.titre}</span>
              )}
              <span className="block truncate text-[0.6875rem] text-muted-foreground">
                {[l.nature, l.reference, l.montant !== null ? formatCurrency(l.montant) : null].filter(Boolean).join(" · ")}
              </span>
            </span>
            {l.statut && <Badge tone={l.statut.tone} dot={false}>{l.statut.label}</Badge>}
          </div>
          {(l.plateforme.pdf || l.plateforme.docx) && (
            <p className="mt-1 flex flex-wrap items-center gap-2 pl-3 text-[0.6875rem] text-muted-foreground">
              Version plateforme :
              {l.plateforme.pdf && <a className="font-medium text-foreground hover:underline" href={lienFichierEmis(l.id, "pdf")} target="_blank" rel="noreferrer">PDF</a>}
              {l.plateforme.docx && <a className="font-medium text-foreground hover:underline" href={lienFichierEmis(l.id, "docx")} target="_blank" rel="noreferrer">Word</a>}
            </p>
          )}
          {l.documents.length > 0 && (
            <div className="mt-1.5 border-l-2 border-border pl-3">
              <DocumentList documents={l.documents} canDelete={false} canRename={false} canEdit={false} path={`/legal/${l.id}`} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          Pièces Legal de la demande
          <span className="text-sm font-normal text-muted-foreground">({p.total})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Rattachées directement à la demande, hors postes — la gestion se fait dans Legal.
        </p>
        {p.lignes.length > REPLIE_AU_DELA ? (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Afficher les {p.lignes.length} pièces
            </summary>
            {liste}
          </details>
        ) : liste}
        {/* CE QUI N'EST PAS RENDU SE COMPTE (§118.60) : une liste raccourcie qui se tait se lit complète. */}
        {p.masquees > 0 && (
          <p className="text-[0.6875rem] text-muted-foreground">
            {p.masquees === 1 ? "1 autre pièce ne vous est pas ouverte." : `${p.masquees} autres pièces ne vous sont pas ouvertes.`}
          </p>
        )}
        {p.nonLues > 0 && (
          <p className="text-[0.6875rem] text-muted-foreground">
            {p.nonLues === 1 ? "1 pièce plus ancienne" : `${p.nonLues} pièces plus anciennes`} — la liste complète est dans Legal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
