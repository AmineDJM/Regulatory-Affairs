"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * AFFECTER EN UN CLIC (Direction, 07/10) — depuis Force de vente › Territoires, une cible H ou A HORS PANEL (classée dans
 * un secteur, mais qu'aucun panel de KAM ne contient) se rattache au délégué du secteur : son `delegateId`, la branche
 * « rattachement » de la règle du panel (`clausePanelDuKam`). Elle entre ainsi dans son panel, son plan de tournée et
 * Ma journée.
 *
 * Qui : qui configure la force de vente, ou le superviseur de la BU du délégué. Ce que le geste NE fait PAS : changer le
 * délégué d'un praticien déjà rattaché à quelqu'un (une réaffectation se décide sur la fiche, pas d'un clic de liste).
 */
export async function affecterAuDelegue(formData: FormData): Promise<ActionResult & { affectes?: number }> {
  const user = await requireUser();
  const repId = fdStr(formData, "repId");
  const doctorIds = [...new Set(formData.getAll("doctorId").map((v) => String(v).trim()).filter(Boolean))];
  if (!repId || doctorIds.length === 0) return { ok: false, error: "Délégué ou praticien manquant." };
  if (doctorIds.length > 500) return { ok: false, error: "Trop de praticiens d'un coup (500 au plus)." };

  const profil = await prisma.salesRepProfile.findUnique({ where: { repId }, select: { businessUnitId: true, businessUnit: { select: { supervisorId: true } } } });
  const rep = await prisma.user.findFirst({ where: { id: repId, isActive: true }, select: { name: true } });
  if (!rep || !profil?.businessUnitId) return { ok: false, error: "Ce délégué n'est rattaché à aucune BU active." };
  const configure = userCan(user, "SALES_PLANNING", "UPDATE") || hasGlobalView(user);
  const superviseur = profil.businessUnit?.supervisorId === user.id;
  if (!configure && !superviseur) return { ok: false, error: "Seuls la Direction de la force de vente et le superviseur de la BU affectent un praticien." };

  const r = await prisma.medicalDoctor.updateMany({
    where: { id: { in: doctorIds }, archivedAt: null, delegateId: null },
    data: { delegateId: repId, updatedById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Force de vente",
    summary: `${r.count} praticien(s) hors panel rattaché(s) à ${rep.name}`,
  });
  revalidatePath("/planning");
  revalidatePath("/planning/territoires");
  const ignores = doctorIds.length - r.count;
  return {
    ok: true, affectes: r.count,
    message: ignores ? `${r.count} affecté(s) ; ${ignores} déjà rattaché(s) à un délégué ou archivé(s), laissé(s) tel(s) quel(s).` : `${r.count} affecté(s) à ${rep.name}.`,
  };
}
