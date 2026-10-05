import { prisma } from "@/lib/prisma";
import { PIECE_AMONT_INTROUVABLE } from "@/lib/legal/piece-emise";

/**
 * LE MAILLON AMONT D'UNE PIÈCE — le bon de commande vers son devis, la facture vers son bon de
 * commande (`chainFromId`).
 *
 * Il vivait dans les actions de Legal seulement ; la facture créée depuis une fiche Ad & Pro
 * (§118.161) dit désormais aussi de quel BC elle découle — c'est ce lien qui fait attendre la
 * validation du BC avant de payer sa facture (§118.148). Une seule vérification pour les deux
 * écrivains : l'identifiant vient d'un champ de formulaire, il ne se croit pas sur parole.
 */
export async function refusMaillonAmont(chainFromId: string | null, selfId?: string): Promise<string | null> {
  if (!chainFromId) return null;
  if (selfId && chainFromId === selfId) return "Une pièce ne peut pas se suivre elle-même.";
  const prev = await prisma.legalDocument.findUnique({ where: { id: chainFromId }, select: { id: true } });
  // La même phrase que la fabrique (`piece-emise.ts`) : deux rédactions du même refus finiraient par diverger (§118.5).
  return prev ? null : PIECE_AMONT_INTROUVABLE;
}

/**
 * Le refus d'un changement de chaîne sur une facture saisie ligne à ligne sur un dossier de
 * matériel promotionnel (§118.168) : il nomme le geste qui corrige (§118.30). Une seule rédaction,
 * lue par l'action ET par son banc — un `"use server"` n'exporte que des fonctions asynchrones.
 */
export const REFUS_CHAINE_FACTURE_PROMO =
  "Cette facture a été saisie ligne à ligne sur un dossier de matériel promotionnel : elle reste chaînée à SON bon de commande. Pour la rattacher à un autre, annulez-la depuis le dossier (Ad & Pro › Matériel promotionnel), puis redéposez-la sur le bon.";
