import { prisma } from "@/lib/prisma";
import type { Action, SessionUser } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PORTE DE TOUT GESTE SUR UN MARCHÉ PCH (§118.184 — audit 360°, S11).
 *
 * Mesuré par l'audit : la fiche d'un marché, son export et ses TRENTE gestes (lignes, soumission,
 * résultats, contrat, bons de commande, livraisons) ne lisaient que le droit de MODULE. Un
 * gestionnaire PCH d'Adventum ouvrait, exportait, modifiait et supprimait le marché de Pharmagène
 * par son identifiant — la liste, elle, le cachait.
 *
 * Deux règles, et la seconde est celle qu'on oublie :
 *
 *   1. UNE porte, celle de la fiche (`canAccessEntity` → `PCH_TENDER`) : les gestes ne recopient pas
 *      la règle d'entité, sinon un geste prendrait du retard le jour où la fiche se resserre (§118.5).
 *   2. LE MARCHÉ SE LIT EN BASE, jamais dans le formulaire. Plusieurs gestes portent `tenderId` ET
 *      l'identifiant d'une ligne, d'un bon ou d'une soumission : juger le marché du FORMULAIRE
 *      laisserait toucher la ligne d'un autre marché en envoyant l'identifiant d'un marché permis
 *      (§118.71). On remonte donc de l'objet touché à SON marché, et c'est celui-là qu'on juge.
 *
 * Hors de portée, la même phrase que l'absence : un refus qui dirait « pas le vôtre » confirmerait
 * qu'un marché existe sous cet identifiant.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export async function peutAgirSurLeMarche(
  user: SessionUser,
  tenderId: string | null | undefined,
  action: Action,
): Promise<boolean> {
  if (!tenderId) return false;
  return canAccessEntity(user, "PCH_TENDER", tenderId, action);
}

/** Le marché d'une LIGNE d'appel d'offres. */
export async function marcheDeLaLigne(lineId: string): Promise<string | null> {
  return (await prisma.pchTenderLine.findUnique({ where: { id: lineId }, select: { tenderId: true } }))?.tenderId ?? null;
}

/** Le marché d'un BON DE COMMANDE. */
export async function marcheDuBon(orderId: string): Promise<string | null> {
  return (await prisma.pchOrder.findUnique({ where: { id: orderId }, select: { tenderId: true } }))?.tenderId ?? null;
}
