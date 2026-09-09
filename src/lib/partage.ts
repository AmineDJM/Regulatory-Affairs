import type { EntityType } from "@prisma/client";

/**
 * COMMENT ON NOMME CE QU'ON PARTAGE — module PUR, sans aucun import de base ni de modèle.
 *
 * Le libellé est écrit dans le message ET affiché sur le bouton de partage, qui est un
 * composant CLIENT. Le mettre à côté de l'action serveur ferait entrer `prisma` dans le
 * navigateur — l'erreur « Module not found: Can't resolve 'fs' » que ce dépôt a déjà payée
 * deux fois. La part pure vit donc ici, et le serveur la réexporte de fait en l'important.
 *
 * La table est PARTIELLE et c'est voulu : elle nomme ce qu'on partage vraiment. Un type absent
 * retombe sur « Élément », ce qui est vrai et lisible — inventer un libellé pour chacun des
 * quarante types produirait des phrases que personne n'a relues.
 */
export const ENTITY_TYPE_LABELS: Partial<Record<EntityType, string>> = {
  REGULATORY_PRODUCT: "Dossier réglementaire",
  REGULATORY_STEP: "Étape réglementaire",
  DOSSIER: "Dossier",
  DRIVE_NODE: "Élément du Drive",
  LEGAL_DOCUMENT: "Engagement juridique",
  MAIL_ENTRY: "Courrier",
  AD_PRO_ITEM: "Demande Ad&Pro",
  AD_PRO_OTHER: "Demande Ad&Pro",
  BD_PROJECT: "Projet BD",
  BD_OPPORTUNITY: "Opportunité BD",
  SUPPLIER: "Fournisseur",
  CONSULTING_CONTRACT: "Contrat de consulting",
  EXPENSE_ORDER: "Ordre de dépense",
  ADMIN_REQUEST: "Demande administrative",
  TASK: "Tâche",
  VALIDATION_REQUEST: "Demande de validation",
  SUPPORT_REQUEST: "Demande de support",
  PCH_TENDER: "Appel d'offres PCH",
  DIRECTIVE: "Directive",
  PROMO_MATERIAL: "Matériel promotionnel",
  EVENT: "Événement",
  SPONSORING: "Sponsoring",
};

/** Ce qu'on écrit sur le bouton, et dans le message. Jamais un code brut à l'écran. */
export const libelleDuType = (t: EntityType | null | undefined): string =>
  (t && ENTITY_TYPE_LABELS[t]) || "Élément";
