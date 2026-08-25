"use server";

import { revalidatePath } from "next/cache";
import type { CustomFieldType, EntityType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { readCustomValues, writeCustomValues, getFieldDefs, missingRequiredValues } from "@/lib/custom-fields";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "champ";
}

/** Admin: create or update a custom field definition for a module. */
export async function upsertCustomFieldDef(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (!userCan(admin, "ADMIN", "UPDATE")) return { ok: false, error: "Réservé au Super Admin." };

  const id = fdStr(formData, "id");
  const entityType = fdStr(formData, "entityType") as EntityType | null;
  const label = fdStr(formData, "label");
  if (!entityType || !label) return { ok: false, error: "Module et libellé requis." };

  const type = (fdStr(formData, "type") as CustomFieldType) ?? "TEXT";
  const options = fdStr(formData, "options");
  const order = fdNum(formData, "order") ?? 0;
  // « Obligatoire » : décidé par l'administrateur, appliqué par le serveur à la saisie.
  const requiredRaw = formData.get("required");
  const required = requiredRaw === "on" || requiredRaw === "true";

  if (id) {
    await prisma.customFieldDef.update({ where: { id }, data: { label, type, options, order, required } });
  } else {
    const key = slug(label);
    const exists = await prisma.customFieldDef.findUnique({ where: { entityType_key: { entityType, key } } });
    await prisma.customFieldDef.create({
      data: { entityType, key: exists ? `${key}_${Date.now().toString(36)}` : key, label, type, options, order, required },
    });
  }
  await recordAudit({
    actorId: admin.id, action: id ? "UPDATE" : "CREATE", module: "Administration",
    entityType, summary: `Champ personnalisé « ${label} »`,
  });
  revalidatePath("/admin/fields");
  return { ok: true };
}

export async function deleteCustomFieldDef(formData: FormData): Promise<ActionResult> {
  const admin = await requireUser();
  if (!userCan(admin, "ADMIN", "UPDATE")) return { ok: false, error: "Réservé au Super Admin." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Champ introuvable." };
  await prisma.customFieldDef.delete({ where: { id } });
  revalidatePath("/admin/fields");
  return { ok: true };
}

/** Save custom field values on a record (merged into its `custom` JSON). */
export async function saveCustomValues(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entityType = fdStr(formData, "entityType") as EntityType | null;
  const entityId = fdStr(formData, "entityId");
  const path = fdStr(formData, "path");
  if (!entityType || !entityId) return { ok: false, error: "Entité manquante." };
  if (!(await canAccessEntity(user, entityType, entityId, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }

  const defs = await getFieldDefs(entityType);
  const current = await readCustomValues(entityType, entityId);
  const next = { ...current };
  for (const def of defs) {
    const raw = formData.get(`cf_${def.key}`);
    if (def.type === "BOOLEAN") {
      next[def.key] = raw === "on";
    } else if (def.type === "NUMBER") {
      const n = raw ? Number(String(raw)) : null;
      next[def.key] = n === null || Number.isNaN(n) ? null : n;
    } else {
      next[def.key] = raw ? String(raw) : null;
    }
  }
  // Les champs marqués OBLIGATOIRES par l'administrateur doivent être remplis — le serveur
  // fait foi (l'attribut `required` du navigateur n'est qu'un confort).
  const missing = missingRequiredValues(defs, next);
  if (missing.length > 0) {
    return { ok: false, error: `Champ(s) obligatoire(s) à remplir : ${missing.join(", ")}.` };
  }
  await writeCustomValues(entityType, entityId, next);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Champs personnalisés",
    entityType, entityId, summary: "Mise à jour des champs personnalisés",
  });
  if (path) revalidatePath(path);
  return { ok: true };
}
