import type { Prisma } from "@prisma/client";

/**
 * LA DEMANDE AU SECRÉTARIAT D'UN DOSSIER — la rouvrir quand le dossier revient à l'assistante, la fermer
 * quand la retranscription est terminée (audit 360°, lot C4b, R06–R07 ; lot D1b).
 *
 * Une demande close ne figure plus dans « à traiter » : quand le demandeur demande une correction de la
 * retranscription, ou ajoute un article à faire chiffrer, l'assistante était prévenue et ne voyait rien à
 * faire dans son bureau. Les deux écritures sont CONDITIONNELLES : rouvrir ne touche qu'une demande TERMINÉE
 * (deux gestes simultanés ne la rouvrent qu'une fois, une demande annulée entre-temps ne ressuscite pas),
 * fermer ne touche qu'une demande qui se TRAITE encore (une demande annulée ne repasse pas « terminée »).
 * Sans demande liée (dossier d'avant), rien à rouvrir ni à fermer : la notification de l'appelant suffit.
 *
 * DANS LA TRANSACTION DE L'APPELANT — d'où `tx` OBLIGATOIRE (lot D1b) : l'étape du dossier et l'état de sa
 * demande changent ENSEMBLE, sous le verrou du dossier que l'appelant tient. Écrites après coup, elles
 * laissaient une fenêtre où une fin de retranscription et une correction se croisaient — la demande refermée
 * sous les yeux de l'assistante qu'on venait de prévenir, ou rouverte sur un dossier qui ne l'attendait plus.
 * Le fil de la demande s'écrit par le même `tx` : une transaction annulée ne laisse pas « Demande rouverte »
 * sur une demande restée close.
 *
 * Hors d'un fichier « use server » : une fonction qui reçoit l'auteur en argument, exportée d'un tel
 * fichier, serait un point d'entrée public où n'importe qui écrirait au nom de n'importe qui (§118.153).
 */
export async function rouvrirDemandeAuSecretariat(
  tx: Prisma.TransactionClient, auteurId: string, promoMaterialId: string, raison: string,
): Promise<{ rouverte: boolean }> {
  const lien = await tx.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { adminRequestId: true } });
  if (!lien?.adminRequestId) return { rouverte: false };
  // La date de fin part avec la fin : une demande close depuis le bureau du secrétariat la porte, et
  // « en cours » avec une date de fin se lirait terminée dans tout ce qui la regarde.
  const r = await tx.administrativeRequest.updateMany({ where: { id: lien.adminRequestId, status: "DONE" }, data: { status: "IN_PROGRESS", completedAt: null } });
  await tx.comment.create({
    data: {
      entityType: "ADMIN_REQUEST", entityId: lien.adminRequestId, authorId: auteurId,
      body: r.count > 0 ? `Demande rouverte — ${raison}` : raison,
    },
  });
  return { rouverte: r.count > 0 };
}

/**
 * FERMER LA DEMANDE AU SECRÉTARIAT D'UN DOSSIER — la retranscription est terminée : c'est ce que
 * l'assistante devait faire. Seulement une demande qui se TRAITE encore — la condition `OUVERTE` du bureau
 * du secrétariat (`admin-request-actions.ts`) ; une constante d'un fichier « use server » ne s'importe pas,
 * d'où cette copie, qu'un banc compare à l'original (`promo-devis-course-flow.test.ts`). La date de fin
 * part avec la fin.
 */
export async function fermerDemandeAuSecretariat(tx: Prisma.TransactionClient, promoMaterialId: string): Promise<{ fermee: boolean }> {
  const lien = await tx.promoMaterial.findUnique({ where: { id: promoMaterialId }, select: { adminRequestId: true } });
  if (!lien?.adminRequestId) return { fermee: false };
  const r = await tx.administrativeRequest.updateMany({
    where: { id: lien.adminRequestId, deletedAt: null, status: { notIn: ["DONE", "CANCELLED"] } },
    data: { status: "DONE", completedAt: new Date() },
  });
  return { fermee: r.count > 0 };
}
