import { prisma } from "@/lib/prisma";

/**
 * Digest des messages internes NON LUS de l'utilisateur — base des suggestions
 * proactives de l'assistant flottant. Lecture seule, scopée à l'utilisateur.
 * `signature` permet de n'appeler l'IA QUE lorsqu'il y a du nouveau (maîtrise du coût).
 */
export interface InboxDigest {
  signature: string;
  count: number;
  text: string;
}

export async function getUnreadDigest(userId: string): Promise<InboxDigest> {
  const members = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (members.length === 0) return { signature: "0", count: 0, text: "" };

  const ors = members.map((m) => ({
    conversationId: m.conversationId,
    ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
  }));
  const msgs = await prisma.message.findMany({
    where: { senderId: { not: userId }, kind: "TEXT", OR: ors },
    select: { id: true, body: true, sender: { select: { name: true } }, conversation: { select: { title: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  if (msgs.length === 0) return { signature: "0", count: 0, text: "" };

  const signature = `${msgs.length}:${msgs[0].id}`;
  const text = msgs
    .slice()
    .reverse()
    .map((m) => `De ${m.sender?.name ?? "?"}${m.conversation?.title ? ` (${m.conversation.title})` : ""} : ${m.body.slice(0, 400)}`)
    .join("\n");
  return { signature, count: msgs.length, text };
}
