"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCompanyScope } from "@/lib/company";
import { regCan, resolveRegCompanyId } from "../access";
import { regAudit } from "../audit";
import { ingestReserveDocument } from "./library-ingest";
import { findSimilarReserves, bestHistoricalResponse, reserveRisk, reserveStats, proposeRules, ruleConfidence } from "./library";
import type { AnppReserveStatus } from "@prisma/client";

/**
 * BIBLIOTHÈQUE DES RÉSERVES ANPP — actions serveur.
 *
 * Toutes gardées par `regulatory.reserve.manage` et bornées à l'organisation. Toutes tracées
 * dans le journal d'audit du module : une réserve est une pièce réglementaire, on doit pouvoir
 * dire qui l'a importée, qui l'a corrigée et quand.
 *
 * ⚠️ La règle qui structure ce fichier : **aucune règle dérivée ne devient opposable sans
 * validation humaine explicite.** `validateDerivedRule` est le seul chemin qui fait passer une
 * proposition à l'état VALIDATED, et il exige un humain autorisé.
 */

interface Result { ok: boolean; error?: string; message?: string }

const MAX_UPLOAD_BYTES = 40 * 1024 * 1024; // 40 Mo : une lettre scannée reste raisonnable

async function guard(): Promise<{ ok: true; userId: string; companyId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!regCan(user, "regulatory.reserve.manage") && user.role !== "SUPER_ADMIN") return { ok: false, error: "Non autorisé." };
  const companyId = await resolveRegCompanyId(getCompanyScope());
  if (!companyId) return { ok: false, error: "Module non activé pour cette entité." };
  return { ok: true, userId: user.id, companyId };
}

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  const s = v ? String(v).trim() : "";
  return s.length > 0 ? s : null;
};

// ───────────────────────────── Import ─────────────────────────────

export interface ImportResult extends Result {
  batchId?: string;
  reserveCount?: number;
  duplicate?: boolean;
  costUsd?: number;
  method?: string;
}

/**
 * Importe une lettre de réserves (PDF, scan, Word, Excel, courriel exporté, texte).
 * Le fichier d'origine est conservé chiffré : la preuve doit rester vérifiable.
 */
export async function importReserveLetter(formData: FormData): Promise<ImportResult> {
  try {
    const g = await guard();
    if (!g.ok) return g;

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez le fichier de la lettre de réserves." };
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Fichier trop volumineux (40 Mo maximum)." };

    const res = await ingestReserveDocument({
      filename: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
      createdById: g.userId,
      companyId: g.companyId,
      dossierId: str(formData, "dossierId"),
      sourceCycleId: str(formData, "cycleId"),
    });
    if (!res.ok) return { ok: false, error: res.error };

    await regAudit({
      companyId: g.companyId, actorId: g.userId, dossierId: str(formData, "dossierId"),
      action: "RESERVE_LIBRARY_IMPORT",
      detail: res.duplicate
        ? `Lettre « ${file.name} » déjà importée — aucun nouveau traitement.`
        : `Lettre « ${file.name} » importée (${res.reserveCount} réserve(s), lecture ${res.method}, ${(res.costUsd ?? 0).toFixed(4)} $).`,
    });

    revalidatePath("/regulatory/reserves");
    return {
      ok: true, batchId: res.batchId, reserveCount: res.reserveCount,
      duplicate: res.duplicate, costUsd: res.costUsd, method: res.method,
      message: res.duplicate
        ? "Cette lettre avait déjà été importée : rien n'a été recalculé."
        : `${res.reserveCount} réserve(s) extraite(s).`,
    };
  } catch (err) {
    console.error("[reserves] import impossible", err);
    return { ok: false, error: "Import impossible." };
  }
}

/**
 * Colle le texte d'une réserve reçue par courriel. Même chemin d'extraction, sans fichier —
 * parce qu'en pratique beaucoup de réserves arrivent dans le corps d'un message.
 */
export async function importReserveText(formData: FormData): Promise<ImportResult> {
  try {
    const g = await guard();
    if (!g.ok) return g;
    const text = str(formData, "text");
    if (!text || text.length < 40) return { ok: false, error: "Collez le texte de la lettre (40 caractères minimum)." };
    const label = str(formData, "label") ?? "Réserves (texte collé)";

    const res = await ingestReserveDocument({
      filename: `${label}.txt`,
      buffer: Buffer.from(text, "utf8"),
      createdById: g.userId,
      companyId: g.companyId,
      dossierId: str(formData, "dossierId"),
    });
    if (!res.ok) return { ok: false, error: res.error };

    await regAudit({
      companyId: g.companyId, actorId: g.userId,
      action: "RESERVE_LIBRARY_IMPORT",
      detail: `Texte de réserves importé (${res.reserveCount} réserve(s)).`,
    });
    revalidatePath("/regulatory/reserves");
    return { ok: true, batchId: res.batchId, reserveCount: res.reserveCount, duplicate: res.duplicate, costUsd: res.costUsd };
  } catch (err) {
    console.error("[reserves] import texte impossible", err);
    return { ok: false, error: "Import impossible." };
  }
}

// ───────────────────────────── Correction & suivi ─────────────────────────────

const STATUSES = new Set(["OPEN", "ANSWERED", "ACCEPTED", "REITERATED", "CLOSED"]);

/**
 * Corrige une réserve et suit son issue.
 *
 * Le passage en ACCEPTED ou REITERATED est le moment le plus important de tout ce module :
 * c'est LUI qui transforme un historique en apprentissage. Une réponse acceptée devient un
 * exemple à réutiliser ; une réponse réitérée devient un contre-exemple.
 */
export async function updateReserve(formData: FormData): Promise<Result> {
  try {
    const g = await guard();
    if (!g.ok) return g;
    const id = str(formData, "id");
    if (!id) return { ok: false, error: "Réserve introuvable." };

    const existing = await prisma.anppReserve.findFirst({
      where: { id, batch: { companyId: g.companyId } },
      select: { id: true, status: true },
    });
    if (!existing) return { ok: false, error: "Réserve introuvable." };

    const statusRaw = str(formData, "status");
    const status = statusRaw && STATUSES.has(statusRaw) ? (statusRaw as AnppReserveStatus) : undefined;
    const response = str(formData, "response");

    await prisma.anppReserve.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(response !== null ? { response, responseAt: new Date() } : {}),
        productName: str(formData, "productName") ?? undefined,
        dci: str(formData, "dci") ?? undefined,
        supplier: str(formData, "supplier") ?? undefined,
        ctdModule: str(formData, "ctdModule") ?? undefined,
        ctdSection: str(formData, "ctdSection") ?? undefined,
        outcomeNote: str(formData, "outcomeNote") ?? undefined,
        ...(status === "CLOSED" || status === "ACCEPTED" ? { closedAt: new Date() } : {}),
        // Une correction humaine vaut vérification : la fiche cesse d'être une simple extraction.
        verifiedById: g.userId,
        verifiedAt: new Date(),
      },
    });

    await regAudit({
      companyId: g.companyId, actorId: g.userId,
      action: "RESERVE_LIBRARY_UPDATE",
      detail: `Réserve mise à jour${status ? ` → ${status}` : ""}.`,
    });
    revalidatePath("/regulatory/reserves");
    return { ok: true };
  } catch (err) {
    console.error("[reserves] mise à jour impossible", err);
    return { ok: false, error: "Mise à jour impossible." };
  }
}

// ───────────────────────────── Consultation ─────────────────────────────

/** Réserves similaires à un texte — les précédents, avec leur preuve. */
export async function similarReserves(text: string, filters?: { ctdModule?: string; ctdSection?: string; dci?: string; supplier?: string }) {
  const g = await guard();
  if (!g.ok) return [];
  return findSimilarReserves(text, filters ?? {});
}

/** Meilleure réponse historique (acceptée) et contre-exemple (réitérée). */
export async function historicalResponse(text: string, filters?: { dci?: string; supplier?: string }) {
  const g = await guard();
  if (!g.ok) return { accepted: null, rejected: null };
  return bestHistoricalResponse(text, filters ?? {});
}

/** Probabilité qu'une réserve de ce type revienne — une INDICATION, jamais une prédiction. */
export async function riskOfReserve(text: string, filters?: { ctdModule?: string; dci?: string; supplier?: string }) {
  const g = await guard();
  if (!g.ok) return null;
  return reserveRisk(text, filters ?? {});
}

/** Tableau de bord : récurrences, statistiques par fournisseur / produit / module / catégorie. */
export async function libraryStats() {
  const g = await guard();
  if (!g.ok) return null;
  return reserveStats();
}

// ───────────────────────────── Règles dérivées ─────────────────────────────

/**
 * Propose des règles à partir des réserves récurrentes — et les enregistre au statut PROPOSED,
 * c'est-à-dire **sans aucun effet**. Rien n'est opposable tant qu'un humain n'a pas validé.
 */
export async function refreshDerivedRules(): Promise<Result & { proposed?: number }> {
  try {
    const g = await guard();
    if (!g.ok) return g;

    const proposals = await proposeRules();
    let created = 0;
    for (const p of proposals) {
      // On ne repropose pas une règle déjà tranchée (validée ou rejetée) : le travail humain
      // ne doit pas être noyé sous des propositions répétées.
      const existing = await prisma.anppDerivedRule.findFirst({
        where: { category: p.category, ctdModule: p.ctdModule, ctdSection: p.ctdSection },
        select: { id: true, status: true },
      });
      if (existing) {
        if (existing.status === "PROPOSED") {
          await prisma.anppDerivedRule.update({
            where: { id: existing.id },
            data: { occurrences: p.occurrences, confidence: p.confidence, evidenceReserveIds: p.evidenceReserveIds, statement: p.statement },
          });
        }
        continue;
      }
      await prisma.anppDerivedRule.create({
        data: {
          title: p.title, statement: p.statement, ctdModule: p.ctdModule, ctdSection: p.ctdSection,
          category: p.category, severity: p.severity, evidenceReserveIds: p.evidenceReserveIds,
          occurrences: p.occurrences, confidence: p.confidence, status: "PROPOSED",
        },
      });
      created++;
    }

    await regAudit({
      companyId: g.companyId, actorId: g.userId,
      action: "RESERVE_RULES_PROPOSED",
      detail: `${created} nouvelle(s) règle(s) proposée(s) — aucune n'est active tant qu'elle n'est pas validée.`,
    });
    revalidatePath("/regulatory/reserves");
    return { ok: true, proposed: created, message: `${created} règle(s) proposée(s), en attente de votre validation.` };
  } catch (err) {
    console.error("[reserves] proposition de règles impossible", err);
    return { ok: false, error: "Proposition de règles impossible." };
  }
}

/**
 * LA frontière : c'est ici — et nulle part ailleurs — qu'une règle dérivée devient opposable.
 * Exige un humain autorisé, trace qui a décidé, et conserve les règles rejetées pour ne pas
 * les reproposer sans fin.
 */
export async function validateDerivedRule(formData: FormData): Promise<Result> {
  try {
    const g = await guard();
    if (!g.ok) return g;
    const id = str(formData, "id");
    const decision = str(formData, "decision"); // VALIDATED | REJECTED
    if (!id || (decision !== "VALIDATED" && decision !== "REJECTED")) return { ok: false, error: "Décision invalide." };

    const rule = await prisma.anppDerivedRule.findUnique({ where: { id }, select: { title: true } });
    if (!rule) return { ok: false, error: "Règle introuvable." };

    await prisma.anppDerivedRule.update({
      where: { id },
      data: {
        status: decision,
        reviewNote: str(formData, "note"),
        reviewedById: g.userId,
        reviewedAt: new Date(),
      },
    });

    await regAudit({
      companyId: g.companyId, actorId: g.userId,
      action: decision === "VALIDATED" ? "RESERVE_RULE_VALIDATED" : "RESERVE_RULE_REJECTED",
      detail: `Règle dérivée « ${rule.title} » ${decision === "VALIDATED" ? "VALIDÉE — elle devient opposable" : "rejetée"}.`,
    });
    revalidatePath("/regulatory/reserves");
    return { ok: true, message: decision === "VALIDATED" ? "Règle validée : elle s'applique désormais aux analyses." : "Règle écartée." };
  } catch (err) {
    console.error("[reserves] validation de règle impossible", err);
    return { ok: false, error: "Validation impossible." };
  }
}

/** Recalcule la confiance d'une règle (fonction pure exposée pour l'écran d'administration). */
export async function derivedRuleConfidence(occurrences: number, reiterated: number, products: number): Promise<number> {
  return ruleConfidence(occurrences, reiterated, products);
}
