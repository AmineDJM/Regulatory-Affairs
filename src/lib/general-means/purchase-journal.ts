import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * LE JOURNAL DES DEMANDES D'ACHAT AUX MOYENS GÉNÉRAUX — pour le Super Admin, et lui seul.
 *
 * ── POURQUOI IL EXISTE, ALORS QUE LA DEMANDE EXISTE DÉJÀ ─────────────────────────────────────
 *
 * La demande (`AdministrativeRequest`) est un objet VIVANT : elle change de statut, se retire,
 * et parfois SE SUPPRIME (`deletedAt`). Un journal qui la lirait en direct disparaîtrait donc
 * avec elle — et un journal qui s'efface n'est pas un journal. Ici, chaque geste écrit UNE LIGNE
 * DE PLUS, avec la copie complète de ce que la demande disait à cet instant : intitulé, lignes,
 * quantités, prix estimés, département imputé, validateur, mot de la décision.
 *
 * On AJOUTE, on ne met jamais à jour et on n'efface jamais. C'est ce qui permet de répondre, six
 * mois plus tard, à « qui a demandé quoi, quand, à combien, et qui a dit oui » — même si la
 * demande a été retirée entre-temps.
 *
 * ── CE QUE CE N'EST PAS ──────────────────────────────────────────────────────────────────────
 *
 * Un second registre des demandes. Personne ne travaille depuis ce journal : il ne pilote rien,
 * ne notifie personne, n'ouvre aucun circuit. C'est la trace, et c'est tout.
 *
 * ── POURQUOI IL N'INTERROMPT JAMAIS ──────────────────────────────────────────────────────────
 *
 * Écrire au journal ne doit pas pouvoir faire échouer une demande d'achat : perdre la demande
 * pour sauver sa trace serait exactement l'inverse du but. Chaque écriture est donc protégée,
 * et un échec se voit dans les logs sans rien casser en amont.
 */

/** Ce qui vient d'arriver à la demande. On n'invente pas d'état : chacun est un GESTE réel. */
export type PurchaseJournalEvent = "SUBMITTED" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "WITHDRAWN";

export const PURCHASE_JOURNAL_LABEL: Record<PurchaseJournalEvent, string> = {
  SUBMITTED: "Déposée",
  APPROVED: "Validée",
  REJECTED: "Refusée",
  CHANGES_REQUESTED: "Modification demandée",
  WITHDRAWN: "Retirée par l'auteur",
};

/**
 * Inscrire un geste au journal. `actorId` est celui qui POSE le geste — pas toujours le
 * demandeur : c'est le directeur qui valide, et c'est lui que l'audit doit nommer.
 */
export async function journaliserDemandeAchat(input: {
  requestId: string;
  event: PurchaseJournalEvent;
  actorId: string;
  note?: string | null;
}): Promise<void> {
  try {
    const req = await prisma.administrativeRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true, reference: true, title: true, type: true, status: true, description: true,
        fields: true, createdAt: true, deadline: true, priority: true,
        requesterId: true,
        requester: { select: { name: true, email: true } },
        validator: { select: { name: true } },
        department: { select: { id: true, name: true } },
        company: { select: { name: true, shortName: true } },
        approvals: {
          orderBy: { createdAt: "desc" }, take: 1,
          select: { status: true, comment: true, decidedAt: true, amount: true },
        },
      },
    });
    // Le journal ne porte QUE les achats : y verser les congés et les attestations le rendrait
    // illisible pour la seule question qu'on lui pose.
    if (!req || req.type !== "PURCHASE") return;

    const acteur = await prisma.user.findUnique({ where: { id: input.actorId }, select: { name: true } });
    const fields = (req.fields as Record<string, unknown> | null) ?? {};
    const estime = typeof fields.estimatedTotal === "number" ? fields.estimatedTotal : null;
    const decision = req.approvals[0] ?? null;

    await prisma.purchaseRequestLogEntry.create({
      data: {
        requestId: req.id,
        reference: req.reference,
        event: input.event,
        title: req.title,
        requesterId: req.requesterId,
        // Les NOMS sont figés : un compte désactivé ou renommé ne doit pas rendre la ligne
        // illisible six mois plus tard.
        requesterName: req.requester?.name ?? "—",
        actorId: input.actorId,
        actorName: acteur?.name ?? "—",
        departmentId: req.department?.id ?? null,
        departmentName: req.department?.name ?? null,
        estimatedTotal: estime,
        note: input.note ?? decision?.comment ?? null,
        // LA COPIE COMPLÈTE — tout ce que la demande portait à cet instant.
        snapshot: {
          reference: req.reference,
          title: req.title,
          status: req.status,
          priority: req.priority,
          description: req.description,
          createdAt: req.createdAt.toISOString(),
          deadline: req.deadline ? req.deadline.toISOString() : null,
          requester: req.requester?.name ?? null,
          requesterEmail: req.requester?.email ?? null,
          validator: req.validator?.name ?? null,
          department: req.department?.name ?? null,
          company: req.company?.shortName ?? req.company?.name ?? null,
          estimatedTotal: estime,
          lines: (fields.purchaseLines as unknown) ?? [],
          decision: decision
            ? {
                status: decision.status,
                comment: decision.comment,
                decidedAt: decision.decidedAt ? decision.decidedAt.toISOString() : null,
                amount: decision.amount != null ? Number(decision.amount) : null,
              }
            : null,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Perdre la demande pour sauver sa trace serait l'inverse du but.
    console.error("[moyens-generaux] journal des demandes d'achat — écriture refusée", err);
  }
}
