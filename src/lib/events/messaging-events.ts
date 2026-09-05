import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/events/ledger";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN MESSAGE INTERNE EST UN FAIT — `MESSAGE_RECEIVED`, dans le registre canonique.
 *
 * Avant ce fichier, la messagerie interne n'émettait rien : une mission qui avait écrit à
 * Raihana et attendait sa réponse (`WAIT_EVENT MESSAGE_RECEIVED de Raihana`) ne pouvait JAMAIS
 * être réveillée — le planificateur nommait un fait que rien n'inscrivait. Le banc de missions
 * l'a écrit noir sur blanc dans un plan par ailleurs juste.
 *
 * Le fait porte l'émetteur (identifiant, nom, adresse) et les destinataires (les autres
 * membres de la conversation, en références `USER:id`) : la grammaire d'attente (`from`,
 * `entity`) le reconnaît sans rien deviner. Le corps n'y figure que tronqué — un fait n'est pas
 * une copie du message. Émettre ne fait jamais échouer l'envoi : `recordEvent` ne lève pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export async function emettreMessageRecu(input: {
  conversationId: string;
  messageId?: string | null;
  senderId: string;
  senderName?: string | null;
  senderEmail?: string | null;
  body: string;
  /** Les destinataires connus ; s'ils manquent, les membres actifs de la conversation sont relus. */
  recipientIds?: readonly string[];
  hasAttachments?: boolean;
  missionId?: string | null;
}): Promise<void> {
  try {
    let destinataires = [...(input.recipientIds ?? [])].filter((id) => id !== input.senderId);
    if (destinataires.length === 0) {
      const membres = await prisma.conversationMember.findMany({
        where: { conversationId: input.conversationId, leftAt: null, NOT: { userId: input.senderId } },
        select: { userId: true },
      });
      destinataires = membres.map((m) => m.userId);
    }
    await recordEvent({
      type: "MESSAGE_RECEIVED",
      sourceDomain: "messaging",
      actorId: input.senderId,
      relatedRefs: [...destinataires.map((id) => `USER:${id}`), `CONVERSATION:${input.conversationId}`],
      missionId: input.missionId ?? null,
      payload: {
        from: input.senderName ?? "",
        senderEmail: input.senderEmail ?? "",
        fromUserId: input.senderId,
        to: destinataires,
        conversationId: input.conversationId,
        messageId: input.messageId ?? "",
        text: input.body.replace(/\s+/g, " ").trim().slice(0, 160),
        hasAttachments: input.hasAttachments === true,
      },
    });
  } catch (e) {
    console.error("[messaging] fait MESSAGE_RECEIVED non émis", e);
  }
}
