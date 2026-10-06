/**
 * LES PRODUITS DU MODULE « PRODUITS » — seulement ceux dont le dossier Regulatory est TERMINÉ (Direction, 06/10 : « dans le
 * module Produits, on ne devrait avoir que les produits terminés dans Regulatory »). Terminé = décision d'enregistrement
 * obtenue, ou dossier clôturé — les deux statuts que Regulatory traite déjà comme « clos » (`assistant/regulatory-read.ts`).
 * Une seule définition, lue par la liste, la recherche globale et la fiche.
 *
 * Module sans import de valeur (le type Prisma s'efface) : la liste, la recherche et la fiche s'en servent sans rien tirer.
 */
import type { RegulatoryStatus, Prisma } from "@prisma/client";

export const STATUTS_REGULATORY_TERMINES: RegulatoryStatus[] = ["DECISION_OBTAINED", "CLOSED"];

/** La clause Prisma : un produit dont au moins un dossier Regulatory est terminé. */
export const clauseProduitTermine: Prisma.ProductWhereInput = {
  regulatoryProfiles: { some: { status: { in: STATUTS_REGULATORY_TERMINES } } },
};

export const PHRASE_PRODUITS_TERMINES =
  "Seuls figurent ici les produits dont le dossier Regulatory est terminé (décision d'enregistrement obtenue ou dossier clôturé). Un produit en cours d'enregistrement se suit dans Regulatory.";
