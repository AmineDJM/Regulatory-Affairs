/**
 * LIRE LES CONSTATS — sous les droits de la personne. Un constat porte le module qui le gouverne :
 * qui ne voit pas la paie ne voit pas un salaire aberrant, même dans un compteur.
 */

import { prisma } from "@/lib/prisma";
import { hasGlobalView, userCan, MODULES, type Module, type SessionUser } from "@/lib/rbac";
import { RANG_CRITICITE, type Criticite, type Resolution, type StatutConstat, type Correction } from "@/lib/quality/model";

export interface ConstatLu {
  id: string; regle: string; famille: string; criticite: Criticite; confiance: number; resolution: Resolution;
  entite: string; entiteId: string; module: string; titre: string; detail: string; href: string | null;
  correction: Correction | null; montant: number | null; status: StatutConstat;
  firstSeenAt: Date; lastSeenAt: Date; occurrences: number; reopenCount: number;
  resolvedAt: Date | null; resolvedBy: string | null; motif: string | null;
}

/** Les modules dont cette personne peut voir les constats. `null` = tous. */
export function modulesVisibles(user: SessionUser): string[] | null {
  if (hasGlobalView(user)) return null;
  return MODULES.filter((m) => userCan(user, m as Module, "VIEW"));
}

export async function lireConstats(
  user: SessionUser,
  opts: { statut?: StatutConstat | "TOUS"; famille?: string | null; criticite?: Criticite | null; regle?: string | null; limite?: number } = {},
): Promise<ConstatLu[]> {
  const visibles = modulesVisibles(user);
  if (visibles && visibles.length === 0) return [];
  const rows = await prisma.dataQualityFinding.findMany({
    where: {
      ...(opts.statut && opts.statut !== "TOUS" ? { status: opts.statut } : opts.statut === "TOUS" ? {} : { status: "OPEN" }),
      ...(opts.famille ? { famille: opts.famille } : {}),
      ...(opts.criticite ? { criticite: opts.criticite } : {}),
      ...(opts.regle ? { regle: opts.regle } : {}),
      ...(visibles ? { module: { in: visibles } } : {}),
    },
    orderBy: [{ lastSeenAt: "desc" }],
    take: Math.min(Math.max(opts.limite ?? 200, 1), 1000),
  });
  return rows
    .map((r) => ({
      id: r.id, regle: r.regle, famille: r.famille, criticite: r.criticite as Criticite, confiance: r.confiance, resolution: r.resolution as Resolution,
      entite: r.entite, entiteId: r.entiteId, module: r.module, titre: r.titre, detail: r.detail, href: r.href,
      correction: (r.correction as unknown as Correction | null) ?? null, montant: r.montant == null ? null : Number(r.montant), status: r.status as StatutConstat,
      firstSeenAt: r.firstSeenAt, lastSeenAt: r.lastSeenAt, occurrences: r.occurrences, reopenCount: r.reopenCount,
      resolvedAt: r.resolvedAt, resolvedBy: r.resolvedBy, motif: r.motif,
    }))
    .sort((a, b) => RANG_CRITICITE[a.criticite] - RANG_CRITICITE[b.criticite] || b.confiance - a.confiance || b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

export async function compterConstats(user: SessionUser): Promise<{ ouverts: number; parCriticite: Record<Criticite, number>; parFamille: Record<string, number>; parResolution: Record<Resolution, number> }> {
  const visibles = modulesVisibles(user);
  const out = { ouverts: 0, parCriticite: { CRITIQUE: 0, HAUTE: 0, NORMALE: 0, BASSE: 0 } as Record<Criticite, number>, parFamille: {} as Record<string, number>, parResolution: { AUTO: 0, PROPOSE: 0, HUMAIN: 0 } as Record<Resolution, number> };
  if (visibles && visibles.length === 0) return out;
  const groupes = await prisma.dataQualityFinding.groupBy({
    by: ["criticite", "famille", "resolution"],
    where: { status: "OPEN", ...(visibles ? { module: { in: visibles } } : {}) },
    _count: { _all: true },
  });
  for (const g of groupes) {
    out.ouverts += g._count._all;
    out.parCriticite[g.criticite as Criticite] = (out.parCriticite[g.criticite as Criticite] ?? 0) + g._count._all;
    out.parFamille[g.famille] = (out.parFamille[g.famille] ?? 0) + g._count._all;
    out.parResolution[g.resolution as Resolution] = (out.parResolution[g.resolution as Resolution] ?? 0) + g._count._all;
  }
  return out;
}
