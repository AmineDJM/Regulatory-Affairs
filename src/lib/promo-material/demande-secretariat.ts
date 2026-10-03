import { prisma } from "@/lib/prisma";
import { ecrireAuFil } from "@/lib/ad-pro/fil";

/**
 * ROUVRIR LA DEMANDE AU SECRÉTARIAT D'UN DOSSIER (audit 360°, lot C4b, R06–R07) — celle que la fin de
 * la retranscription a close.
 *
 * Une demande close ne figure plus dans « à traiter » : quand le demandeur demande une correction de
 * la retranscription, ou ajoute un article à faire chiffrer, l'assistante était prévenue et ne voyait
 * rien à faire dans son bureau. La réouverture est CONDITIONNELLE (« encore terminée ») : deux gestes
 * simultanés ne la rouvrent qu'une fois, et une demande annulée entre-temps n'est pas ressuscitée. La
 * raison va sur la demande elle-même, là où l'assistante la lit. Sans demande liée (dossier d'avant),
 * il n'y a rien à rouvrir : la notification de l'appelant suffit.
 *
 * Hors d'un fichier « use server » : une fonction qui reçoit l'auteur en argument, exportée d'un tel
 * fichier, serait un point d'entrée public où n'importe qui écrirait au nom de n'importe qui (§118.153).
 */
export async function rouvrirDemandeAuSecretariat(auteurId: string, promoMaterialId: string, raison: string): Promise<{ rouverte: boolean }> {
  const lien = await prisma.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { adminRequestId: true } });
  if (!lien?.adminRequestId) return { rouverte: false };
  // La date de fin part avec la fin : une demande close depuis le bureau du secrétariat la porte, et
  // « en cours » avec une date de fin se lirait terminée dans tout ce qui la regarde.
  const r = await prisma.administrativeRequest.updateMany({ where: { id: lien.adminRequestId, status: "DONE" }, data: { status: "IN_PROGRESS", completedAt: null } });
  await ecrireAuFil({
    entityType: "ADMIN_REQUEST", entityId: lien.adminRequestId, authorId: auteurId,
    body: r.count > 0 ? `Demande rouverte — ${raison}` : raison,
  });
  return { rouverte: r.count > 0 };
}
