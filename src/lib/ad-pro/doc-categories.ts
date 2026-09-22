import { AD_PRO_ENTITY_TYPE, type AdProKind } from "./unified";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CATÉGORIES DE PIÈCES D'UNE DEMANDE Ad & Pro — écrites UNE fois, pour TOUT le pôle.
 *
 * ── LE DÉFAUT MESURÉ, ET IL ÉTAIT À L'ÉCRAN ─────────────────────────────────────────────
 *
 * Sur la fiche d'un ÉVÉNEMENT, le menu de classement d'une pièce jointe proposait « CTD
 * complet », « Module 1 », « Certificat GMP », « CPP », « AMM pays d'origine »… — la
 * nomenclature d'un dossier d'enregistrement de médicament, sur l'écran où l'on dépose une
 * facture de traiteur. Cause : le téléverseur n'y recevait AUCUNE liste, et son repli est la
 * table `DOCUMENT_CATEGORY` entière, dont la première entrée est `CTD_FULL`.
 *
 * Recensé avant de corriger : SIX fiches Ad & Pro, et **trois ne passaient rien** (événement,
 * consulting, « autre demande »). Les deux congrès lisaient bien ce module ; le sponsoring en
 * portait une copie LOCALE, mot pour mot identique. C'est §118.71 à trois contre trois — des
 * portes gardées à côté de portes ouvertes — plus une seconde vérité qui n'attendait qu'une
 * catégorie ajoutée d'un seul côté pour diverger (§118.5).
 *
 * ── DEUX LISTES, ET ELLES NE SE CONFONDENT PAS ──────────────────────────────────────────
 *
 * Le pôle Ad & Pro dépose des pièces COMMERCIALES : la demande, la convention, le programme, le
 * devis, le bon de commande, la facture, le justificatif, les photos. Le MATÉRIEL PROMOTIONNEL
 * en dépose d'autres — un visa publicitaire, le fichier du matériel, un bordereau de paiement,
 * un bon de livraison — parce que c'est une chaîne d'ACHAT et non une prise en charge. Les
 * fondre en une seule liste ferait proposer un « visa publicitaire » sur un congrès et une
 * « convention » sur une brochure : un menu qui propose tout n'aide plus à classer.
 *
 * « BON DE COMMANDE » est NOMMÉ par la Direction (22/09/2026 : « c'est pas un CTD complet etc.
 * qui doit s'afficher, c'est facture, bon de commande, demandes, convention etc. ») et il
 * manquait des deux côtés de la prise en charge — il n'existait que sur le matériel
 * promotionnel. C'est aussi la pièce que la chaîne devis → BC → facture va produire.
 *
 * Module PUR : des données de formulaire et une lecture du registre canonique, rien d'autre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const AD_PRO_DOC_CATEGORIES: readonly string[] = [
  "REQUEST_LETTER", "CONVENTION", "PROGRAM", "QUOTE", "PURCHASE_ORDER", "INVOICE",
  "SUPPORTING_DOC", "PHOTO", "PRESENTATION", "POST_EVENT_REPORT", "OTHER",
];

/**
 * LE MATÉRIEL PROMOTIONNEL — une chaîne d'ACHAT, donc d'autres pièces.
 *
 * Elle vivait en DOUBLE, recopiée à l'identique dans `promo-material/[id]` et dans
 * `demandes/[id]` (le secrétariat voit les demandes de matériel depuis son écran). Deux copies
 * d'une liste finissent par diverger, et le symptôme serait une pièce classable depuis un écran
 * et pas depuis l'autre — sur le même enregistrement.
 */
export const PROMO_MATERIAL_DOC_CATEGORIES: readonly string[] = [
  "QUOTE", "PURCHASE_ORDER", "PAYMENT_SLIP", "PAYMENT_RECEIPT", "PROMO_MATERIAL_FILE",
  "AD_VISA", "INVOICE", "DELIVERY_NOTE", "SUPPORTING_DOC", "OTHER",
];

/**
 * LA LISTE D'UNE NATURE — dérivée du registre canonique, jamais d'un `if` par écran.
 *
 * Le type d'entité est la clé : c'est lui que le téléverseur reçoit déjà, et une huitième nature
 * ajoutée à `AD_PRO_KINDS` obtient sa liste sans que personne y pense. Une table écrite à la
 * main serait fausse ce jour-là, en silence (§118.73).
 */
export function categoriesDePieces(kind: AdProKind): readonly string[] {
  return kind === "PROMO_MATERIAL" ? PROMO_MATERIAL_DOC_CATEGORIES : AD_PRO_DOC_CATEGORIES;
}

/** Les types d'entité du pôle — ce sur quoi le cliquet d'écran s'arme (§118.17). */
export const AD_PRO_ENTITY_TYPES: readonly string[] = Object.values(AD_PRO_ENTITY_TYPE);
