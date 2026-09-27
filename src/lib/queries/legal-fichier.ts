import { prisma } from "@/lib/prisma";
import { userCan, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere } from "@/lib/company";
import { legalReaderWhere } from "@/lib/lecteurs/legal";
import { legalViewScope, legalKindVisible } from "@/lib/legal/invoices";
import { canAccessEntity } from "@/lib/entity-access";
import { fichiersEmis, type FormatFichierEmis } from "@/lib/legal/fichiers-emis";

/**
 * QUI PEUT LIRE CETTE PIÈCE LEGAL ? — la porte de la FICHE, rejouée pour son fichier (§118.152).
 *
 * Deux portes, et ce sont celles qui existent déjà :
 *   • celle de l'écran Legal : la portée (`legalViewScope` — le registre entier pour Legal, les
 *     seules factures et bons de commande pour les Finances), la société, les lecteurs désignés ;
 *   • celle de l'ENREGISTREMENT (`canAccessEntity`), qui ouvre en lecture les pièces nées d'un
 *     dossier de matériel promotionnel à ceux qui ouvrent le dossier.
 * Aucune troisième règle : le fichier suit la pièce, et une pièce que la fiche refuse, son fichier
 * le refuse aussi.
 */
export async function peutLireLaPieceLegale(user: SessionUser, doc: { id: string; kind: string }): Promise<boolean> {
  const portee = legalViewScope({ onLegal: userCan(user, "LEGAL", "VIEW"), onFinances: userCan(user, "FINANCES", "VIEW") });
  if (portee !== "NONE" && legalKindVisible(portee, doc.kind)) {
    const readerScope = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
    const trouve = await prisma.legalDocument.findFirst({
      where: await companyScopedWhere(user.id, { AND: [{ id: doc.id }, ...(readerScope ? [readerScope] : [])] }),
      select: { id: true },
    });
    if (trouve) return true;
  }
  return canAccessEntity(user, "LEGAL_DOCUMENT", doc.id, "VIEW");
}

/**
 * LE FICHIER ÉMIS D'UNE PIÈCE, pour qui peut lire la pièce — `null` sinon, ou s'il n'existe pas.
 *
 * Seuls les fichiers que la FABRIQUE a produits passent ici (`fichiersEmis`) : un fichier du Drive
 * rattaché à la main garde la porte du Drive. Un refus et une absence rendent la même chose —
 * dire qu'une pièce existe, c'est déjà en dire trop.
 */
export async function fichierEmisDeLaPiece(user: SessionUser, legalDocumentId: string, format: FormatFichierEmis): Promise<{ nodeId: string } | null> {
  const doc = await prisma.legalDocument.findUnique({ where: { id: legalDocumentId }, select: { id: true, kind: true, custom: true } });
  if (!doc) return null;
  const nodeId = fichiersEmis(doc.custom)[format];
  if (!nodeId) return null;
  if (!(await peutLireLaPieceLegale(user, doc))) return null;
  return { nodeId };
}
