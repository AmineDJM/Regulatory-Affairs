import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Journal d'audit du Regulatory Intelligence OS (ALCOA+ : attribuable, horodaté, durable).
 * Écriture **best-effort** : ne jette jamais (une panne d'audit ne doit pas casser une
 * opération métier), mais l'échec est journalisé côté serveur.
 */
export async function regAudit(entry: {
  companyId?: string | null;
  actorId: string;
  dossierId?: string | null;
  dossierVersionId?: string | null;
  action: string;
  detail: string;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.regulatoryAuditLog.create({
      data: {
        companyId: entry.companyId ?? null,
        actorId: entry.actorId,
        dossierId: entry.dossierId ?? null,
        dossierVersionId: entry.dossierVersionId ?? null,
        action: entry.action,
        detail: entry.detail,
        meta: entry.meta ?? undefined,
      },
    });
  } catch (err) {
    console.error("[reg-audit] écriture échouée", err);
  }
}
