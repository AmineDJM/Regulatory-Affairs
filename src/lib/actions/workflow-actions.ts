"use server";

import { revalidatePath } from "next/cache";
import type { EntityType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/labels";
import { advanceWorkflowInstance } from "@/lib/workflow/engine";
import {
  ACTOR_SCOPES, WORKFLOW_POWERS, WORKFLOW_CATEGORIES, CATEGORY_PATH,
  isWorkflowCategory, type ActorScope, type StepInput, type WorkflowPower,
} from "@/lib/workflow/types";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const WORKFLOW_ENTITIES: EntityType[] = ["SPONSORING", "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENT"];

// ───────────────────────────── Progression (runtime) ─────────────────────────────

/** Action générique : fait avancer une demande dans son circuit. Le moteur gère le gating. */
export async function advanceWorkflow(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const entityType = fdStr(formData, "entityType") as EntityType | null;
  const entityId = fdStr(formData, "entityId");
  const action = fdStr(formData, "action"); // APPROVE | REJECT | COMMENT | SKIP
  if (!entityType || !WORKFLOW_ENTITIES.includes(entityType) || !entityId) return { ok: false, error: "Paramètres manquants." };
  if (action !== "APPROVE" && action !== "REJECT" && action !== "COMMENT" && action !== "SKIP") return { ok: false, error: "Action invalide." };

  const res = await advanceWorkflowInstance({
    viewer: { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null, name: user.name },
    entityType,
    entityId,
    action,
    note: fdStr(formData, "note"),
    amount: fdNum(formData, "amount"),
    budgetCategoryId: fdStr(formData, "budgetCategoryId"),
    assigneeId: fdStr(formData, "assigneeId"),
  });
  if (!res.ok) return { ok: false, error: res.error };

  const base =
    entityType === "SPONSORING" ? "/sponsoring"
      : entityType === "CONGRESS_INTERNATIONAL" ? "/congress-international"
        : entityType === "CONGRESS_NATIONAL" ? "/congress-national"
          : "/events";
  revalidatePath(`${base}/${entityId}`);
  revalidatePath(base);
  revalidatePath("/information-medicale");
  revalidatePath("/finances/ordres-de-depense");
  revalidatePath("/finances");
  revalidatePath("/mon-espace");
  return { ok: true };
}

// ───────────────────────────── Builder no-code (Super Admin) ─────────────────────────────

interface DefinitionPayload {
  category: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  steps: unknown[];
}

const ROLE_KEYS = new Set(Object.keys(ROLE_LABELS));

function sanitizeStep(raw: unknown, index: number, usedSlugs: Set<string>): StepInput | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: `Étape ${index + 1} invalide.` };
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return { error: `Le titre de l'étape ${index + 1} est obligatoire.` };

  let slug = typeof r.slug === "string" && r.slug.trim() ? r.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") : "";
  if (!slug || usedSlugs.has(slug)) slug = `custom-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
  usedSlugs.add(slug);

  const actorScope = (typeof r.actorScope === "string" && (ACTOR_SCOPES as readonly string[]).includes(r.actorScope) ? r.actorScope : "ROLE") as ActorScope;
  const actorRoles = Array.isArray(r.actorRoles) ? (r.actorRoles as unknown[]).filter((x): x is string => typeof x === "string" && ROLE_KEYS.has(x)) : [];
  const powers = Array.isArray(r.powers) ? (r.powers as unknown[]).filter((x): x is WorkflowPower => typeof x === "string" && (WORKFLOW_POWERS as readonly string[]).includes(x)) : [];
  const assignRole = typeof r.assignRole === "string" && ROLE_KEYS.has(r.assignRole) ? r.assignRole : null;
  const notifyRoles = Array.isArray(r.notifyRoles) ? (r.notifyRoles as unknown[]).filter((x): x is string => typeof x === "string" && ROLE_KEYS.has(x)) : [];

  if (actorScope === "ROLE" && actorRoles.length === 0) return { error: `L'étape « ${title} » (portée « Rôles listés ») doit lister au moins un rôle.` };
  if (powers.length === 0) return { error: `L'étape « ${title} » doit accorder au moins un pouvoir.` };

  return {
    slug, title,
    description: typeof r.description === "string" ? r.description.trim() || null : null,
    actorRoles, actorScope, powers, assignRole, notifyRoles,
    requireAmount: r.requireAmount === true,
    requireCategory: r.requireCategory === true,
    requireNote: r.requireNote === true,
    emitDeclaration: r.emitDeclaration === true,
    emitExpenseOrder: r.emitExpenseOrder === true,
    optional: r.optional === true,
    confidential: r.confidential === true,
    legacyStatus: typeof r.legacyStatus === "string" && r.legacyStatus.trim() ? r.legacyStatus.trim() : null,
  };
}

/**
 * Enregistre (remplace) la définition d'une catégorie. Réservé au **Super Admin** :
 * reconfigure le circuit de validation Ad & Pro « à la no-code ». Remplace intégralement
 * les étapes ; les instances en cours conservent leur `currentSlug` (les étapes portant
 * les mêmes slugs restent valides).
 */
export async function saveWorkflowDefinition(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };

  const rawPayload = fdStr(formData, "payload");
  if (!rawPayload) return { ok: false, error: "Données manquantes." };
  let payload: DefinitionPayload;
  try {
    payload = JSON.parse(rawPayload) as DefinitionPayload;
  } catch {
    return { ok: false, error: "Format de données invalide." };
  }

  if (!isWorkflowCategory(payload.category)) return { ok: false, error: "Catégorie inconnue." };
  const name = (payload.name ?? "").trim();
  if (!name) return { ok: false, error: "Le nom du circuit est obligatoire." };
  if (!Array.isArray(payload.steps) || payload.steps.length === 0) return { ok: false, error: "Le circuit doit comporter au moins une étape." };

  const used = new Set<string>();
  const steps: StepInput[] = [];
  for (let i = 0; i < payload.steps.length; i++) {
    const s = sanitizeStep(payload.steps[i], i, used);
    if ("error" in s) return { ok: false, error: s.error };
    steps.push(s);
  }
  if (!steps.some((s) => s.powers.includes("APPROVE"))) return { ok: false, error: "Au moins une étape doit permettre d'approuver (sinon le circuit ne peut jamais aboutir)." };

  const def = await prisma.workflowDefinition.upsert({
    where: { category: payload.category },
    update: { name, description: payload.description?.trim() || null, isActive: payload.isActive !== false, updatedById: user.id },
    create: { category: payload.category, name, description: payload.description?.trim() || null, isActive: payload.isActive !== false, updatedById: user.id },
  });

  // Remplacement intégral des étapes.
  await prisma.$transaction([
    prisma.workflowStep.deleteMany({ where: { definitionId: def.id } }),
    prisma.workflowStep.createMany({
      data: steps.map((s, i) => ({
        definitionId: def.id, position: i, slug: s.slug, title: s.title, description: s.description ?? null,
        actorRoles: s.actorRoles, actorScope: s.actorScope, powers: s.powers, assignRole: s.assignRole ?? null,
        requireAmount: s.requireAmount ?? false, requireCategory: s.requireCategory ?? false, requireNote: s.requireNote ?? false,
        emitDeclaration: s.emitDeclaration ?? false, emitExpenseOrder: s.emitExpenseOrder ?? false,
        notifyRoles: s.notifyRoles ?? [], optional: s.optional ?? false, confidential: s.confidential ?? false, legacyStatus: s.legacyStatus ?? null,
      })),
    }),
  ]);

  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Administration", entityType: "BUDGET", entityId: def.id, summary: `Circuit workflow « ${name} » (${payload.category}) reconfiguré — ${steps.length} étape·s` });
  for (const c of WORKFLOW_CATEGORIES) revalidatePath(CATEGORY_PATH[c]);
  revalidatePath("/admin/workflows");
  return { ok: true };
}

/** Réinitialise une catégorie au circuit par défaut (supprime la définition → re-seed lazy). */
export async function resetWorkflowDefinition(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const category = fdStr(formData, "category");
  if (!category || !isWorkflowCategory(category)) return { ok: false, error: "Catégorie inconnue." };
  const def = await prisma.workflowDefinition.findUnique({ where: { category }, select: { id: true, _count: { select: { instances: true } } } });
  if (def && def._count.instances > 0) {
    // Des demandes sont en cours : on ne supprime pas (FK), on réécrit les étapes par défaut.
    return { ok: false, error: "Des demandes utilisent ce circuit — modifiez les étapes plutôt que de réinitialiser." };
  }
  if (def) await prisma.workflowDefinition.delete({ where: { id: def.id } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Administration", entityType: "BUDGET", entityId: category, summary: `Circuit workflow ${category} réinitialisé (défaut)` });
  revalidatePath("/admin/workflows");
  return { ok: true };
}
