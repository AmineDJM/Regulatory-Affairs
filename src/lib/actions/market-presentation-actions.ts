"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import { getMarketResearch } from "@/lib/queries/market-research";
import { analyzeMarketResearch } from "@/lib/market-presentation";

const MODULE = "BUSINESS_DEVELOPMENT" as const;
const BASE = "/business-development/etudes";

/**
 * Génère une NOUVELLE présentation (première version) : analyse IA ancrée sur toute l'étude,
 * stockée comme source de vérité. Le .pptx est ensuite (re)construit à la demande au téléchargement.
 */
export async function generatePresentation(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const researchId = fdStr(formData, "researchId");
  if (!researchId) return { ok: false, error: "Étude introuvable." };
  const research = await getMarketResearch(researchId);
  if (!research) return { ok: false, error: "Étude introuvable." };

  const instruction = fdStr(formData, "instruction") ?? undefined;
  const result = await analyzeMarketResearch(research, instruction);
  if (!result.ok || !result.data) {
    return { ok: false, error: result.configured ? result.error ?? "Analyse IA impossible." : "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render)." };
  }

  const title = fdStr(formData, "title") || `${research.title} — Présentation`;
  const presentation = await prisma.marketResearchPresentation.create({
    data: {
      researchId,
      title,
      createdById: user.id,
      versions: {
        create: { version: 1, instruction: instruction ?? null, analysis: result.data as unknown as Prisma.InputJsonValue, model: result.model ?? null, createdById: user.id },
      },
    },
    include: { versions: true },
  });

  await recordAudit({ actorId: user.id, action: "CREATE", module: "Business Development", summary: `Présentation IA générée — « ${title} »` });
  revalidatePath(`${BASE}/${researchId}`);
  return { ok: true, id: presentation.versions[0]?.id };
}

/**
 * Relance l'analyse d'une présentation existante en AJOUTANT des commentaires : crée une
 * nouvelle version historisée (autant de fois que nécessaire). Réoriente sans inventer de données.
 */
export async function regeneratePresentation(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const presentationId = fdStr(formData, "presentationId");
  if (!presentationId) return { ok: false, error: "Présentation introuvable." };
  const presentation = await prisma.marketResearchPresentation.findUnique({ where: { id: presentationId } });
  if (!presentation) return { ok: false, error: "Présentation introuvable." };

  const research = await getMarketResearch(presentation.researchId);
  if (!research) return { ok: false, error: "Étude introuvable." };

  const instruction = fdStr(formData, "instruction") ?? undefined;
  const result = await analyzeMarketResearch(research, instruction);
  if (!result.ok || !result.data) {
    return { ok: false, error: result.configured ? result.error ?? "Analyse IA impossible." : "IA non configurée : ajoutez la clé ANTHROPIC_API_KEY (Render)." };
  }

  const last = await prisma.marketResearchPresentationVersion.aggregate({ where: { presentationId }, _max: { version: true } });
  const nextVersion = (last._max.version ?? 0) + 1;
  const created = await prisma.marketResearchPresentationVersion.create({
    data: { presentationId, version: nextVersion, instruction: instruction ?? null, analysis: result.data as unknown as Prisma.InputJsonValue, model: result.model ?? null, createdById: user.id },
  });
  await prisma.marketResearchPresentation.update({ where: { id: presentationId }, data: { updatedAt: new Date() } });

  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Business Development", summary: `Présentation IA relancée (v${nextVersion}) — « ${presentation.title} »` });
  revalidatePath(`${BASE}/${presentation.researchId}`);
  return { ok: true, id: created.id };
}

export async function renamePresentation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  const title = fdStr(formData, "title");
  if (!id || !title) return { ok: false, error: "Titre requis." };
  const p = await prisma.marketResearchPresentation.update({ where: { id }, data: { title } });
  revalidatePath(`${BASE}/${p.researchId}`);
  return { ok: true };
}

export async function deletePresentation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Présentation introuvable." };
  const p = await prisma.marketResearchPresentation.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Business Development", summary: `Présentation supprimée — « ${p.title} »` });
  revalidatePath(`${BASE}/${p.researchId}`);
  return { ok: true };
}
