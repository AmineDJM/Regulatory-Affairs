"use server";

import type { AdProOtherStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, type SessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { buildRef, createWithRetry } from "@/lib/refs";
import { companyIdForNew } from "@/lib/company";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const PATH = "/ad-pro/autres";

/**
 * LA DEMANDE QUI N'ENTRE DANS AUCUNE CASE.
 *
 * Sans elle, une dépense de promotion inhabituelle se déclare « en sponsoring » faute de mieux —
 * et l'on perd deux choses à la fois : la lisibilité du sponsoring, qui se remplit d'objets qui
 * n'en sont pas, et la trace de la dépense, rangée sous une étiquette fausse.
 *
 * Le circuit est volontairement COURT. Une nature dont on ne connaît pas le contenu ne peut pas
 * avoir de parcours de validation prédéfini : elle a un demandeur, une décision, et un motif.
 * Lui inventer six étapes reviendrait à obliger tout le monde à les traverser pour rien.
 */

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.adProOtherRequest.findMany({
    where: { reference: { startsWith: `AUT-${year}-` } }, select: { reference: true },
  });
  return buildRef("AUT", year, refs.map((r) => r.reference));
}

function revalidate(id?: string) {
  revalidatePath(PATH);
  revalidatePath("/ad-pro");
  if (id) revalidatePath(`${PATH}/${id}`);
}

async function audit(user: SessionUser, id: string, action: "CREATE" | "UPDATE" | "VALIDATE", summary: string) {
  await recordAudit({ actorId: user.id, action, module: "Ad & Pro — autres demandes", entityType: "AD_PRO_OTHER", entityId: id, summary });
}

export async function createAdProOtherRequest(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!userCan(user, "AD_PRO_OTHER", "CREATE")) return { ok: false, error: "Création réservée aux personnes habilitées." };

    const title = fdStr(formData, "title");
    if (!title) return { ok: false, error: "L'objet de la demande est obligatoire." };
    // Une demande « autre » sans explication est une case vide : c'est justement la description
    // qui permettra de trancher, puisqu'aucun formulaire ne la décrit pour nous.
    const description = fdStr(formData, "description");
    if (!description) return { ok: false, error: "Décrivez la demande — c'est sur cette description que la décision se prendra." };

    const companyId = fdStr(formData, "companyId") || (await companyIdForNew(user.id));

    const req = await createWithRetry(async () =>
      prisma.adProOtherRequest.create({
        data: {
          reference: await nextRef(),
          title,
          description,
          beneficiary: fdStr(formData, "beneficiary"),
          amount: fdNum(formData, "amount") ?? null,
          companyId: companyId || null,
          status: "AWAITING_DECISION",
          requesterId: user.id,
          createdById: user.id,
          updatedById: user.id,
        },
      }),
    );

    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED", title: "Demande Ad & Pro — autre",
      body: `${req.reference} — ${title}`, link: `${PATH}/${req.id}`,
    });
    await audit(user, req.id, "CREATE", `Demande « autre » créée — ${req.reference}`);
    revalidate(req.id);
    return { ok: true, id: req.id };
  } catch (err) {
    console.error("[ad-pro-other] createAdProOtherRequest failed", err);
    return { ok: false, error: "La demande n'a pas pu être créée. Réessayez dans un instant." };
  }
}

/** Trancher : valider ou refuser, avec un motif. */
export async function decideAdProOtherRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const approve = fdStr(formData, "approve") === "1";
    if (!id) return { ok: false, error: "Demande introuvable." };
    if (!userCan(user, "AD_PRO_OTHER", "VALIDATE")) return { ok: false, error: "La décision revient à la Direction." };

    const req = await prisma.adProOtherRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };
    if (req.status !== "AWAITING_DECISION") return { ok: false, error: "Cette demande a déjà été tranchée." };

    await prisma.adProOtherRequest.update({
      where: { id },
      data: {
        status: (approve ? "APPROVED" : "REFUSED") as AdProOtherStatus,
        decidedById: user.id, decidedAt: new Date(),
        decisionNote: fdStr(formData, "note"), updatedById: user.id,
      },
    });

    if (req.requesterId) {
      await notifyUser({
        userId: req.requesterId, type: "GENERIC",
        title: approve ? "Demande validée" : "Demande refusée",
        body: `${req.reference} — ${req.title}`, link: `${PATH}/${id}`,
      });
    }
    await audit(user, id, "VALIDATE", `${approve ? "Demande validée" : "Demande refusée"} — ${req.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[ad-pro-other] decideAdProOtherRequest failed", err);
    return { ok: false, error: "La décision n'a pas pu être enregistrée." };
  }
}

/** Clore une demande validée, une fois qu'elle a été exécutée — ou l'annuler. */
export async function closeAdProOtherRequest(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = fdStr(formData, "id");
    const cancel = fdStr(formData, "cancel") === "1";
    if (!id) return { ok: false, error: "Demande introuvable." };
    const req = await prisma.adProOtherRequest.findUnique({ where: { id } });
    if (!req) return { ok: false, error: "Demande introuvable." };

    const mine = req.requesterId === user.id || hasGlobalView(user.role);
    if (!mine && !userCan(user, "AD_PRO_OTHER", "VALIDATE")) return { ok: false, error: "Opération non autorisée." };
    if (req.status === "DONE" || req.status === "CANCELLED") return { ok: false, error: "Cette demande est déjà close." };
    // Clore ce qui n'a jamais été validé n'aurait pas de sens : c'est une annulation.
    if (!cancel && req.status !== "APPROVED") return { ok: false, error: "Seule une demande validée peut être marquée terminée." };

    await prisma.adProOtherRequest.update({
      where: { id },
      data: { status: (cancel ? "CANCELLED" : "DONE") as AdProOtherStatus, updatedById: user.id },
    });
    await audit(user, id, "UPDATE", `${cancel ? "Demande annulée" : "Demande terminée"} — ${req.reference}`);
    revalidate(id);
    return { ok: true, id };
  } catch (err) {
    console.error("[ad-pro-other] closeAdProOtherRequest failed", err);
    return { ok: false, error: "L'opération a échoué." };
  }
}
