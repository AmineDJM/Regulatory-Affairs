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
  bvValidationId: string | null;
  bvRequestId: string | null;
  bvDeliveredAt: Date | null;
  bvSkippedAt: Date | null;
}): Promise<BvInput> {
  const base: BvInput = {
    validationId: decl.bvValidationId,
    validationStatus: null,
    requestId: decl.bvRequestId,
    centralStatus: null,
    orderStatus: null,
    deliveredAt: decl.bvDeliveredAt,
    skippedAt: decl.bvSkippedAt,
  };

  // Les deux lectures partent ENSEMBLE : elles ne dépendent pas l'une de l'autre, et l'écran du
  // pharmacien attendrait deux allers-retours au lieu d'un.
  const [validation, req] = await Promise.all([
    decl.bvValidationId
      ? prisma.validationRequest.findUnique({ where: { id: decl.bvValidationId }, select: { status: true } })
      : Promise.resolve(null),
    decl.bvRequestId
      ? prisma.paymentRequest.findUnique({ where: { id: decl.bvRequestId }, select: { expenseOrderId: true } })
      : Promise.resolve(null),
  ]);
  const avecValidation: BvInput = { ...base, validationStatus: validation ? String(validation.status) : null };

  if (!req?.expenseOrderId) return avecValidation;
  const order = await prisma.expenseOrder.findUnique({
    where: { id: req.expenseOrderId },
    select: { centralStatus: true, status: true },
  });
  if (!order) return avecValidation;
  return { ...avecValidation, centralStatus: String(order.centralStatus), orderStatus: String(order.status) };
}
