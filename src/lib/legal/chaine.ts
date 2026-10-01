import { prisma } from "@/lib/prisma";

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
  return prev ? null : "La pièce amont (devis / bon de commande) n'existe plus.";
}
