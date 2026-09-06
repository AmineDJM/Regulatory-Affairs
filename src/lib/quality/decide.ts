/**
 * DÉCIDER SUR UN CONSTAT — corriger d'un clic (PROPOSE), écarter avec un motif, rouvrir.
 * Les droits : le module du constat en UPDATE, ou la vue globale. L'audit porte un nom.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { hasGlobalView, userCan, type Module } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { appliquerCorrection } from "@/lib/quality/fix";
import type { Correction } from "@/lib/quality/model";

export interface IssueDecision { ok: boolean; message: string }

function peutAgir(user: CurrentUser, module: string): boolean {
  return hasGlobalView(user) || userCan(user, module as Module, "UPDATE");
}

export async function corrigerConstat(user: CurrentUser, id: string): Promise<IssueDecision> {
  const c = await prisma.dataQualityFinding.findUnique({ where: { id } });
  if (!c) return { ok: false, message: "Constat introuvable." };
  if (!peutAgir(user, c.module)) return { ok: false, message: "Vous n'avez pas le droit de modifier ce module." };
  if (c.status !== "OPEN") return { ok: false, message: `Ce constat est déjà ${c.status === "FIXED" ? "corrigé" : c.status === "DISMISSED" ? "écarté" : "résolu"}.` };
  const correction = (c.correction as unknown as Correction | null) ?? null;
  if (!correction) return { ok: false, message: "Ce constat n'a pas de correction formulée : c'est une décision à prendre sur la fiche elle-même." };
  const issue = await appliquerCorrection({ regle: c.regle, module: c.module, titre: c.titre, correction }, { acteurId: user.id, acteurNom: user.name });
  await prisma.dataQualityFinding.update({
    where: { id },
    data: issue.ok
      ? { status: "FIXED", resolvedAt: new Date(), resolvedById: user.id, resolvedBy: user.name, fixLog: { at: new Date().toISOString(), avant: issue.avant ?? null, apres: issue.apres ?? null, par: user.name } as Prisma.InputJsonValue }
      : { fixLog: { at: new Date().toISOString(), echec: issue.message, par: user.name } as Prisma.InputJsonValue },
  });
  return issue;
}

export async function ignorerConstat(user: CurrentUser, id: string, motif: string): Promise<IssueDecision> {
  const texte = (motif ?? "").trim().slice(0, 500);
  if (!texte) return { ok: false, message: "Dites pourquoi ce constat n'en est pas un : le motif reste avec lui." };
  const c = await prisma.dataQualityFinding.findUnique({ where: { id }, select: { id: true, module: true, status: true, regle: true, titre: true, entiteId: true } });
  if (!c) return { ok: false, message: "Constat introuvable." };
  if (!peutAgir(user, c.module)) return { ok: false, message: "Vous n'avez pas le droit de modifier ce module." };
  if (c.status !== "OPEN") return { ok: false, message: "Ce constat n'est plus ouvert." };
  await prisma.dataQualityFinding.update({ where: { id }, data: { status: "DISMISSED", resolvedAt: new Date(), resolvedById: user.id, resolvedBy: user.name, motif: texte } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: c.module, entityId: c.entiteId, field: "qualite", oldValue: "OPEN", newValue: "DISMISSED", summary: `Qualité des données — ${c.regle} écarté : ${texte}` });
  return { ok: true, message: "Constat écarté ; il ne reviendra pas au prochain balayage." };
}

export async function rouvrirConstat(user: CurrentUser, id: string): Promise<IssueDecision> {
  const c = await prisma.dataQualityFinding.findUnique({ where: { id }, select: { id: true, module: true, status: true } });
  if (!c) return { ok: false, message: "Constat introuvable." };
  if (!peutAgir(user, c.module)) return { ok: false, message: "Vous n'avez pas le droit de modifier ce module." };
  if (c.status === "OPEN") return { ok: true, message: "Déjà ouvert." };
  await prisma.dataQualityFinding.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, resolvedBy: null, resolvedById: null, motif: null, reopenCount: { increment: 1 } } });
  return { ok: true, message: "Constat rouvert." };
}
