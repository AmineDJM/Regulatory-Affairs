"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getMyCompanies, companyIdForNew } from "@/lib/company";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * L'ANNUAIRE DE L'ENTREPRISE — les contacts externes, tenus au même endroit pour tout le monde.
 *
 * Agence de voyage, livreur, imprimeur, agence marketing, hôtel, transitaire. Ces numéros vivent
 * dans les téléphones de trois personnes : le jour où celle qui connaît l'imprimeur est en congé,
 * on le cherche sur Internet.
 *
 * Le module de rattachement est `GENERAL_MEANS` (Moyens généraux) : c'est le service qui traite
 * réellement avec ces prestataires. La LECTURE est ouverte à tous ceux qui ont le module, mais
 * l'ÉCRITURE demande le droit correspondant — un annuaire que chacun corrige devient un annuaire
 * dont personne ne se sert.
 */

const PATH = "/moyens-generaux/annuaire";

/** Les champs libres d'un contact, lus une seule fois — création et modification s'accordent. */
function readContact(formData: FormData) {
  return {
    name: fdStr(formData, "name") ?? "",
    kind: fdStr(formData, "kind"),
    contactName: fdStr(formData, "contactName"),
    phone: fdStr(formData, "phone"),
    phoneAlt: fdStr(formData, "phoneAlt"),
    email: fdStr(formData, "email"),
    website: fdStr(formData, "website"),
    address: fdStr(formData, "address"),
    city: fdStr(formData, "city"),
    wilaya: fdStr(formData, "wilaya"),
    rc: fdStr(formData, "rc"),
    nif: fdStr(formData, "nif"),
    rib: fdStr(formData, "rib"),
    notes: fdStr(formData, "notes"),
  };
}

async function companyAllowed(userId: string, companyId: string | null): Promise<boolean> {
  if (!companyId) return true;
  const mine = await getMyCompanies(userId);
  return mine.some((c) => c.id === companyId);
}

export async function createCompanyContact(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "GENERAL_MEANS", "CREATE")) return { ok: false, error: "Non autorisé." };
  const data = readContact(formData);
  if (!data.name) return { ok: false, error: "Le nom du contact est obligatoire." };

  const companyRaw = formData.get("companyId");
  const companyId = companyRaw != null ? (String(companyRaw) || null) : await companyIdForNew(user.id);
  if (!(await companyAllowed(user.id, companyId))) return { ok: false, error: "Cette entité n'est pas dans votre périmètre." };

  const created = await prisma.companyContact.create({
    data: { ...data, companyId, createdById: user.id, updatedById: user.id },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Moyens généraux",
    summary: `Contact « ${data.name} »${data.kind ? ` (${data.kind})` : ""} ajouté à l'annuaire d'entreprise`,
  });
  revalidatePath(PATH);
  return { ok: true, id: created.id };
}

export async function updateCompanyContact(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "GENERAL_MEANS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Contact introuvable." };
  const existing = await prisma.companyContact.findUnique({ where: { id }, select: { name: true, companyId: true } });
  if (!existing) return { ok: false, error: "Contact introuvable." };
  // On ne corrige pas le contact d'une société qu'on ne voit pas, même en devinant l'identifiant.
  if (!(await companyAllowed(user.id, existing.companyId))) {
    return { ok: false, error: "Ce contact n'est pas dans votre périmètre." };
  }

  const data = readContact(formData);
  if (!data.name) return { ok: false, error: "Le nom du contact est obligatoire." };

  const companyRaw = formData.get("companyId");
  if (companyRaw != null && !(await companyAllowed(user.id, String(companyRaw) || null))) {
    return { ok: false, error: "Cette entité n'est pas dans votre périmètre." };
  }

  await prisma.companyContact.update({
    where: { id },
    data: {
      ...data,
      ...(companyRaw != null ? { companyId: String(companyRaw) || null } : {}),
      ...(formData.has("isActive") ? { isActive: fdStr(formData, "isActive") === "1" } : {}),
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Moyens généraux",
    summary: `Contact « ${existing.name}${data.name !== existing.name ? ` → ${data.name}` : ""} » corrigé`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * Retire un contact de l'annuaire.
 *
 * On SUPPRIME vraiment : un annuaire de contacts n'a pas d'historique à préserver — contrairement
 * à un courrier ou à un engagement, il ne prouve rien. Garder les prestataires quittés il y a
 * trois ans est précisément ce qui rend un annuaire inutilisable. Pour un fournisseur qu'on veut
 * simplement mettre de côté, `isActive` existe et se coche à la modification.
 */
export async function deleteCompanyContact(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "GENERAL_MEANS", "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Contact introuvable." };
  const existing = await prisma.companyContact.findUnique({ where: { id }, select: { name: true, companyId: true } });
  if (!existing) return { ok: false, error: "Contact introuvable." };
  if (!(await companyAllowed(user.id, existing.companyId))) {
    return { ok: false, error: "Ce contact n'est pas dans votre périmètre." };
  }

  await prisma.companyContact.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Moyens généraux",
    summary: `Contact « ${existing.name} » retiré de l'annuaire d'entreprise`,
  });
  revalidatePath(PATH);
  return { ok: true };
}
