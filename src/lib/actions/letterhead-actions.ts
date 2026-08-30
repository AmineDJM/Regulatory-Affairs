"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { putBlob, releaseBlob } from "@/lib/drive-storage";
import { validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { getMyCompanies } from "@/lib/company";
import { isOfficeKind } from "@/lib/office-templates";
import { canManageLetterheads, validateLetterheadFile, KIND_LABEL } from "@/lib/office/letterhead";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * LES PAPIERS EN-TÊTE — la papeterie de la société, tenue par l'assistante de direction.
 *
 * On téléverse un VRAI document Office déjà mis en page. Créer « avec en-tête » en recopiera
 * les octets : le résultat s'ouvre exactement comme le modèle, sans conversion. C'est la seule
 * façon de garantir des marges, un pied de page et un logo identiques — injecter une image dans
 * un document vierge produit des décalages qu'on ne découvre qu'à l'impression, chez le
 * destinataire.
 */

const PATH = "/drive"; // la papeterie vit dans le menu « ⋯ » du Drive

/** Téléverse un papier en-tête. Le fichier doit correspondre au type annoncé. */
export async function uploadLetterhead(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageLetterheads(user)) {
    return { ok: false, error: "Seule l'assistante de direction (et la direction) tient les papiers en-tête." };
  }

  const kind = fdStr(formData, "kind");
  if (!kind || !isOfficeKind(kind)) return { ok: false, error: "Type de document invalide." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez un fichier." };

  const badType = validateLetterheadFile(kind, file.name);
  if (badType) return { ok: false, error: badType };
  const badUpload = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
  if (badUpload) return { ok: false, error: badUpload };

  // L'entité, si elle est précisée, doit être dans le périmètre : on ne dépose pas le papier
  // à en-tête d'une société qu'on ne voit pas.
  const companyId = fdStr(formData, "companyId");
  if (companyId) {
    const mine = await getMyCompanies(user.id);
    if (!mine.some((c) => c.id === companyId)) return { ok: false, error: "Cette entité n'est pas dans votre périmètre." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { blobId, size } = await putBlob(buf);
  const name = fdStr(formData, "name") || file.name;

  const created = await prisma.officeLetterhead.create({
    data: {
      name, kind, companyId: companyId || null,
      blobId, mime: file.type || "application/octet-stream", size,
      uploadedById: user.id,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id, action: "UPLOAD", module: "Drive",
    summary: `Papier en-tête ${KIND_LABEL[kind]} ajouté : ${name}`,
  });
  revalidatePath(PATH);
  revalidatePath("/drive");
  return { ok: true, id: created.id };
}

/** Renomme un papier en-tête, le rattache à une entité, ou le désactive. */
export async function updateLetterhead(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageLetterheads(user)) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "En-tête introuvable." };
  const existing = await prisma.officeLetterhead.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return { ok: false, error: "En-tête introuvable." };

  const activeRaw = formData.get("isActive");
  const name = fdStr(formData, "name") || existing.name;
  const companyRaw = formData.get("companyId");

  await prisma.officeLetterhead.update({
    where: { id },
    data: {
      name,
      // `companyId` absent du formulaire = on n'y touche pas ; présent et vide = commun au groupe.
      ...(companyRaw != null ? { companyId: String(companyRaw) || null } : {}),
      ...(activeRaw != null ? { isActive: activeRaw === "on" || activeRaw === "true" || activeRaw === "1" } : {}),
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Drive",
    summary: `Papier en-tête modifié : ${existing.name}${name !== existing.name ? ` → ${name}` : ""}`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Supprime un papier en-tête et libère son binaire.
 *
 * Les DOCUMENTS déjà créés dessus ne bougent pas : ils portent leur propre copie des octets
 * depuis leur création. Supprimer le modèle ne réécrit donc jamais un courrier déjà parti.
 */
export async function deleteLetterhead(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageLetterheads(user)) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "En-tête introuvable." };
  const existing = await prisma.officeLetterhead.findUnique({ where: { id }, select: { name: true, blobId: true } });
  if (!existing) return { ok: false, error: "En-tête introuvable." };

  await prisma.officeLetterhead.delete({ where: { id } });
  await releaseBlob(existing.blobId).catch(() => undefined);
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Drive",
    summary: `Papier en-tête supprimé : ${existing.name}`,
  });
  revalidatePath(PATH);
  return { ok: true };
}
