import type { AuditAction, EntityType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  module: string;
  entityType?: EntityType;
  entityId?: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  summary?: string;
  ipAddress?: string | null;
}

/**
 * Append an entry to the audit log. Best-effort: auditing must never break the
 * primary mutation, so failures are swallowed (and logged to the server).
 */
export async function recordAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        field: input.field,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        summary: input.summary,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record entry", err);
  }
}

/**
 * Diff two records and emit one UPDATE audit entry per changed field. Keeps the
 * "ancienne valeur / nouvelle valeur" history required by the spec.
 */
export async function recordFieldChanges(
  base: Omit<AuditInput, "action" | "field" | "oldValue" | "newValue">,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
) {
  const entries: Prisma.AuditLogCreateManyInput[] = [];
  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];
    if (String(oldValue ?? "") !== String(newValue ?? "")) {
      entries.push({
        actorId: base.actorId ?? null,
        action: "UPDATE",
        module: base.module,
        entityType: base.entityType,
        entityId: base.entityId,
        field,
        oldValue: oldValue == null ? null : String(oldValue),
        newValue: newValue == null ? null : String(newValue),
        summary: base.summary,
      });
    }
  }
  if (entries.length) {
    await prisma.auditLog.createMany({ data: entries }).catch((err) => {
      console.error("[audit] failed to record field changes", err);
    });
  }
}
