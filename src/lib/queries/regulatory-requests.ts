import { prisma } from "@/lib/prisma";
import { canAnswerRegRequests, type SessionUser } from "@/lib/rbac";

export interface RegRequestListItem {
  id: string;
  reference: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  productName: string | null;
  requesterName: string | null;
  assigneeName: string | null;
  messageCount: number;
  updatedAt: string;
}

export interface RegRequestMessageDTO {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface RegRequestDetail extends RegRequestListItem {
  body: string;
  requesterId: string | null;
  assigneeId: string | null;
  productId: string | null;
  messages: RegRequestMessageDTO[];
}

/** Le PRIM ne voit que SES demandes ; l'équipe Regulatory (répondant) les voit toutes. */
export async function listRegRequests(user: SessionUser): Promise<RegRequestListItem[]> {
  const where = canAnswerRegRequests(user) ? {} : { requesterId: user.id };
  const list = await prisma.regulatoryRequest.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: {
      product: { select: { brandName: true, dci: true, reference: true } },
      requester: { select: { name: true } },
      assignedTo: { select: { name: true } },
      _count: { select: { messages: true } },
    },
  });
  return list.map((r) => ({
    id: r.id, reference: r.reference, subject: r.subject, category: r.category, priority: r.priority, status: r.status,
    productName: r.product ? r.product.brandName || r.product.dci || r.product.reference : null,
    requesterName: r.requester?.name ?? null,
    assigneeName: r.assignedTo?.name ?? null,
    messageCount: r._count.messages,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getRegRequest(user: SessionUser, id: string): Promise<RegRequestDetail | null> {
  const r = await prisma.regulatoryRequest.findUnique({
    where: { id },
    include: {
      product: { select: { brandName: true, dci: true, reference: true } },
      requester: { select: { name: true } },
      assignedTo: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!r) return null;
  // Accès : demandeur OU répondant Regulatory.
  if (!canAnswerRegRequests(user) && r.requesterId !== user.id) return null;
  return {
    id: r.id, reference: r.reference, subject: r.subject, category: r.category, priority: r.priority, status: r.status,
    body: r.body,
    productName: r.product ? r.product.brandName || r.product.dci || r.product.reference : null,
    productId: r.productId,
    requesterId: r.requesterId,
    requesterName: r.requester?.name ?? null,
    assigneeId: r.assignedToId,
    assigneeName: r.assignedTo?.name ?? null,
    messageCount: r.messages.length,
    updatedAt: r.updatedAt.toISOString(),
    messages: r.messages.map((m) => ({ id: m.id, body: m.body, authorId: m.authorId, authorName: m.author?.name ?? null, createdAt: m.createdAt.toISOString() })),
  };
}

/** Options de dossiers produit pour rattacher une demande (facultatif). */
export async function regRequestProductOptions(): Promise<{ id: string; label: string }[]> {
  const products = await prisma.regulatoryProduct.findMany({
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
    select: { id: true, reference: true, dci: true, brandName: true },
  });
  return products.map((p) => ({ id: p.id, label: `${p.brandName || p.dci} · ${p.reference}` }));
}
