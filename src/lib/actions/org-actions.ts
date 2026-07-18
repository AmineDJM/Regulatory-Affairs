"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * Organigramme (Administration) : réarranger la hiérarchie RH — on fixe le N+1 (managerId)
 * d'un employé et, au passage, son poste. **Super Admin uniquement.** L'organigramme se lit
 * et s'édite directement sur les employés de Ressources humaines (aucune donnée dupliquée).
 */
export async function saveOrgNode(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Employé introuvable." };
  const managerRaw = fdStr(formData, "managerId");
  const managerId = managerRaw && managerRaw !== id ? managerRaw : null;

  // Garde anti-boucle : le nouveau N+1 ne peut pas être un subordonné (direct/indirect) de l'employé.
  if (managerId) {
    const all = await prisma.employee.findMany({ select: { id: true, managerId: true } });
    const childrenOf = new Map<string, string[]>();
    for (const e of all) {
      if (e.managerId) {
        const arr = childrenOf.get(e.managerId) ?? [];
        arr.push(e.id);
        childrenOf.set(e.managerId, arr);
      }
    }
    const descendants = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childrenOf.get(cur) ?? []) {
        if (!descendants.has(c)) { descendants.add(c); stack.push(c); }
      }
    }
    if (descendants.has(managerId)) {
      return { ok: false, error: "Rattachement impossible : cela créerait une boucle (le N+1 est un subordonné)." };
    }
  }

  const position = fdStr(formData, "position");
  await prisma.employee.update({ where: { id }, data: { managerId, position: position ?? undefined } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Administration", entityId: id, summary: "Organigramme — rattachement / poste mis à jour" });
  revalidatePath("/admin/organigramme");
  return { ok: true };
}

/**
 * Mémorise la position d'un nœud sur la CARTE de l'organigramme (glisser-déposer).
 * Écrit uniquement au relâchement (pas pendant le drag). **Super Admin uniquement.**
 */
export async function saveOrgPosition(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Employé introuvable." };
  const x = Number(fdStr(formData, "x"));
  const y = Number(fdStr(formData, "y"));
  await prisma.employee.update({
    where: { id },
    data: { orgX: Number.isFinite(x) ? x : null, orgY: Number.isFinite(y) ? y : null },
  });
  revalidatePath("/admin/organigramme");
  return { ok: true };
}
