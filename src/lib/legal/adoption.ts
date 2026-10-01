import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { canAccessEntity } from "@/lib/entity-access";
import type { SessionUser } from "@/lib/rbac";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * « CRÉER SA FICHE » — ranger un fichier déjà déposé sur une demande dans la pièce Legal qu'on
 * crée pour lui (§118.161).
 *
 * Avant que devis, bons de commande et factures aient leur place sur une fiche Ad & Pro, on les
 * déposait comme de simples fichiers sur la demande (« Devis matériel promotionnel INSIGNE.pdf »,
 * catégorie Devis). La Direction a retiré ce dépôt au profit de la chaîne Devis → Bon de commande
 * → Facture, où chaque pièce a sa fiche au registre ET son PDF. Les fichiers déjà déposés ne
 * disparaissent pas : ils sont montrés dans la section de leur nature, et ce geste leur crée leur
 * fiche en y RANGEANT le fichier — sans le téléverser une seconde fois, ce qui aurait laissé deux
 * copies dont une sans fiche, c'est-à-dire exactement ce qu'on corrige.
 *
 * ── LA GARDE, ET LE CAS QUI LA JUSTIFIE ─────────────────────────────────────────────────
 *
 * L'identifiant du fichier arrive d'un champ de formulaire : il ne se croit pas sur parole. Sans
 * contrôle, n'importe qui pouvant créer une pièce Legal aurait « rangé » dans SA fiche le contrat
 * d'un autre dossier — le fichier aurait quitté sa fiche d'origine, et ceux qui la suivent ne
 * l'auraient plus vu. Trois conditions, toutes nécessaires :
 *   • le fichier est déposé sur LA fiche d'où l'on crée la pièce (celle que `sourceType` /
 *     `sourceId` désignent) — pas sur une autre ;
 *   • la personne peut GÉRER ce fichier là où il est : la règle même du renommage et de la
 *     suppression d'un document (l'avoir déposé, ou modifier / supprimer sa fiche) ;
 *   • il y est ENCORE au moment de le ranger : le déplacement ne vise que la ligne restée sur la
 *     fiche d'origine — deux clics simultanés ne rangent pas deux fois le même fichier.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface SourceDeLaPiece {
  type: EntityType | null;
  id: string | null;
}

/**
 * Le fichier peut-il être rangé ? `null` = rien à ranger (aucun identifiant). Appelé AVANT de
 * créer la pièce : refuser après aurait laissé une fiche sans son fichier, et la personne, en
 * recommençant, en aurait créé une seconde.
 */
export async function refusPieceARanger(
  user: SessionUser,
  pieceId: string | null,
  source: SourceDeLaPiece,
): Promise<string | null> {
  if (!pieceId) return null;
  const doc = await prisma.document.findUnique({
    where: { id: pieceId },
    select: { id: true, entityType: true, entityId: true, uploadedById: true },
  });
  if (!doc) return "Le fichier à ranger n'existe plus : il a été supprimé entre-temps.";
  if (!source.type || !source.id || doc.entityType !== source.type || doc.entityId !== source.id) {
    return "Ce fichier n'est pas déposé sur cette fiche : il ne peut pas y être rangé.";
  }
  const permis =
    doc.uploadedById === user.id ||
    (await canAccessEntity(user, doc.entityType, doc.entityId, "UPDATE")) ||
    (await canAccessEntity(user, doc.entityType, doc.entityId, "DELETE"));
  if (!permis) return "Vous ne pouvez pas déplacer ce fichier : seul qui peut le gérer sur la fiche peut le ranger.";
  return null;
}

/**
 * RANGE le fichier dans la pièce créée — seulement s'il est ENCORE sur sa fiche d'origine.
 * Rend le nom du fichier rangé, ou `null` s'il ne l'était plus (déplacé ou supprimé entre-temps).
 */
export async function rangerPiece(
  user: SessionUser,
  pieceId: string,
  source: SourceDeLaPiece,
  legalDocumentId: string,
): Promise<string | null> {
  if (!source.type || !source.id) return null;
  const doc = await prisma.document.findUnique({ where: { id: pieceId }, select: { name: true } });
  const r = await prisma.document.updateMany({
    where: { id: pieceId, entityType: source.type, entityId: source.id },
    data: { entityType: "LEGAL_DOCUMENT", entityId: legalDocumentId },
  });
  if (r.count === 0 || !doc) return null;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Legal",
    entityType: "LEGAL_DOCUMENT", entityId: legalDocumentId,
    summary: `Fichier « ${doc.name} » rangé dans la fiche, depuis la fiche d'origine (${source.type}) où il avait été déposé`,
  });
  return doc.name;
}
