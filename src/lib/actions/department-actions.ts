"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/** Code technique dérivé d'un nom (MAJUSCULES, sans accents, séparateurs → « _ »). */
function codeFromName(s: string): string {
  const base = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return base || "DEPT";
}

/** Rend un code unique en suffixant _2, _3… si nécessaire (hors l'id éventuellement édité). */
async function uniqueCode(base: string, exceptId?: string): Promise<string> {
  let code = base;
  for (let n = 2; n < 100; n++) {
    const clash = await prisma.department.findFirst({ where: { code, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (!clash) return code;
    code = `${base}_${n}`;
  }
  return `${base}_${Date.now()}`;
}

/**
 * Crée un département ou un SOUS-DÉPARTEMENT (si `parentId`). Hiérarchie à 2 niveaux : un
 * sous-département ne peut pas lui-même contenir de sous-département. Réservé au Super Admin.
 */
export async function createDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom du département est obligatoire." };
  if (await prisma.department.findUnique({ where: { name }, select: { id: true } })) return { ok: false, error: "Un département porte déjà ce nom." };

  const parentId = fdStr(formData, "parentId") || null;
  if (parentId) {
    const parent = await prisma.department.findUnique({ where: { id: parentId }, select: { id: true, parentId: true } });
    if (!parent) return { ok: false, error: "Département parent introuvable." };
    if (parent.parentId) return { ok: false, error: "Un sous-département ne peut pas contenir de sous-département (2 niveaux)." };
  }

  const code = await uniqueCode(fdStr(formData, "code") ? codeFromName(fdStr(formData, "code")!) : codeFromName(name));
  const created = await prisma.department.create({ data: { name, code, parentId }, select: { id: true } });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Administration", summary: `${parentId ? "Sous-département" : "Département"} « ${name} » créé` });
  revalidatePath("/admin/departments");
  return { ok: true, id: created.id };
}

/** Renomme / recode / re-rattache un (sous-)département. Réservé au Super Admin. */
export async function updateDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Paramètres manquants." };
  const dept = await prisma.department.findUnique({ where: { id }, select: { id: true, children: { select: { id: true } } } });
  if (!dept) return { ok: false, error: "Département introuvable." };
  const nameClash = await prisma.department.findFirst({ where: { name, NOT: { id } }, select: { id: true } });
  if (nameClash) return { ok: false, error: "Un autre département porte déjà ce nom." };

  // Re-rattachement éventuel : cible valide (pas soi-même, pas un de ses propres enfants, cible de tête).
  const parentId = fdStr(formData, "parentId") || null;
  if (parentId) {
    if (parentId === id) return { ok: false, error: "Un département ne peut pas être son propre parent." };
    if (dept.children.length > 0) return { ok: false, error: "Ce département a des sous-départements : il ne peut pas devenir lui-même un sous-département." };
    const parent = await prisma.department.findUnique({ where: { id: parentId }, select: { parentId: true } });
    if (!parent) return { ok: false, error: "Département parent introuvable." };
    if (parent.parentId) return { ok: false, error: "La cible est déjà un sous-département (2 niveaux max)." };
  }

  const code = fdStr(formData, "code") ? await uniqueCode(codeFromName(fdStr(formData, "code")!), id) : undefined;
  await prisma.department.update({ where: { id }, data: { name, parentId, ...(code ? { code } : {}) } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Administration", summary: `Département « ${name} » modifié` });
  revalidatePath("/admin/departments");
  return { ok: true };
}

/**
 * Supprime un (sous-)département. Ses sous-départements sont détachés (deviennent des têtes) et
 * les employés qui y étaient rattachés repassent « non affectés » (departmentId → null).
 */
export async function deleteDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const dept = await prisma.department.findUnique({ where: { id }, select: { name: true } });
  if (!dept) return { ok: false, error: "Département introuvable." };

  await prisma.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
  await prisma.department.updateMany({ where: { parentId: id }, data: { parentId: null } });
  await prisma.department.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Administration", summary: `Département « ${dept.name} » supprimé` });
  revalidatePath("/admin/departments");
  return { ok: true };
}
