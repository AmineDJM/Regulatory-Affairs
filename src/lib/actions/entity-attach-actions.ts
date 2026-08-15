"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { ATTACHABLE_MODELS } from "@/lib/queries/unattached";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * RATTACHER EN MASSE CE QUI N'A PAS D'ENTITÉ.
 *
 * La contrepartie de la portée stricte : ce qui reste sans entité doit pouvoir être rangé, sans
 * ouvrir 400 fiches une à une. On ne touche QUE les enregistrements dont l'entité est absente —
 * jamais un rattachement existant, même « pour uniformiser » : ce serait déplacer d'un clic le
 * travail d'une société vers une autre.
 *
 * Réservé au Super Admin : décider de quelle société relève un historique n'est pas un réglage
 * d'affichage.
 */
export async function attachOrphansToCompany(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "ADMIN", "UPDATE")) return { ok: false, error: "Réservé au Super Admin." };

  const model = fdStr(formData, "model");
  const companyId = fdStr(formData, "companyId");
  if (!model || !ATTACHABLE_MODELS.includes(model)) return { ok: false, error: "Type d'objet inconnu." };
  if (!companyId) return { ok: false, error: "Choisissez l'entité de rattachement." };

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) return { ok: false, error: "Entité introuvable." };

  // `model` est validé contre une liste fermée juste au-dessus : l'accès dynamique au client
  // Prisma ne peut donc pas viser une table arbitraire.
  const delegate = (prisma as unknown as Record<string, { updateMany: (a: unknown) => Promise<{ count: number }> }>)[model];
  if (!delegate?.updateMany) return { ok: false, error: "Type d'objet non rattachable." };

  const { count } = await delegate.updateMany({ where: { companyId: null }, data: { companyId } });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Administration", entityId: companyId,
    summary: `Rattachement d'entité — ${count} enregistrement(s) « ${model} » rattaché(s) à ${company.name}`,
  });
  revalidatePath("/admin/entites");
  return { ok: true, message: `${count} enregistrement(s) rattaché(s) à ${company.name}.` };
}
