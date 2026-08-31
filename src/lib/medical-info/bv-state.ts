import { prisma } from "@/lib/prisma";
import type { BvInput } from "./bv";

/**
 * OÙ EN EST LE BON DE VERSEMENT — la lecture, une fois, pour l'écran comme pour les actions.
 *
 * L'état ne vit dans aucun champ : il se compose de la demande de paiement, de son ordre de
 * dépense (au centre ? autorisé ? réglé ?) et des deux gestes posés sur la déclaration (remis /
 * sans versement). Le stocker en plus aurait créé une seconde vérité, qui se désynchronise au
 * premier refus du centre.
 *
 * `bv.ts` décide ensuite CE QUE cet état autorise — sans base, donc testable.
 */
export async function bvStateOf(decl: {
  bvRequestId: string | null;
  bvDeliveredAt: Date | null;
  bvSkippedAt: Date | null;
}): Promise<BvInput> {
  const base: BvInput = {
    requestId: decl.bvRequestId,
    centralStatus: null,
    orderStatus: null,
    deliveredAt: decl.bvDeliveredAt,
    skippedAt: decl.bvSkippedAt,
  };
  if (!decl.bvRequestId) return base;

  const req = await prisma.paymentRequest.findUnique({
    where: { id: decl.bvRequestId },
    select: { expenseOrderId: true },
  });
  if (!req?.expenseOrderId) return base;

  const order = await prisma.expenseOrder.findUnique({
    where: { id: req.expenseOrderId },
    select: { centralStatus: true, status: true },
  });
  if (!order) return base;
  return { ...base, centralStatus: String(order.centralStatus), orderStatus: String(order.status) };
}
