"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { companyIdForNew } from "@/lib/company";
import { getManagerOfUser } from "@/lib/departments";
import { buildRef } from "@/lib/refs";
import {
  cleanLines, estimatedTotal, summarize, purchaseStage, canWithdraw, type PurchaseLine,
} from "@/lib/general-means/purchase-request";
import { fdStr, type ActionResult } from "@/lib/actions/types";

/**
 * DEMANDER UN ACHAT — ouvert à tout le monde, adressé à son directeur.
 *
 * La demande est une DEMANDE ADMINISTRATIVE de type « achat » : le même objet que celui du
 * bureau du secrétariat, avec son circuit, son fil et son imputation budgétaire à la clôture.
 * En créer un second aurait produit deux files d'achats, deux références et deux endroits où
 * chercher une commande — pour exactement le même besoin.
 *
 * Ce qui change, c'est la PORTE : on la dépose depuis les Moyens généraux, en cochant dans le
 * catalogue, sans connaître le circuit ni passer par l'assistante. Et le validateur n'est pas
 * choisi : c'est le responsable hiérarchique du demandeur, résolu par l'organigramme.
 */

const PATH = "/moyens-generaux";

/** Lit les lignes envoyées par le formulaire (JSON), sans jamais faire confiance au client. */
function readLines(raw: FormDataEntryValue | null): PurchaseLine[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return cleanLines(
      parsed.map((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        return {
          articleId: typeof o.articleId === "string" ? o.articleId : null,
          label: typeof o.label === "string" ? o.label : "",
          quantity: Number(o.quantity ?? 1),
          unitPrice: o.unitPrice == null ? null : Number(o.unitPrice),
        };
      }),
    );
  } catch {
    return [];
  }
}

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.administrativeRequest.findMany({
    where: { reference: { startsWith: `REQ-${year}-` } },
    select: { reference: true },
  });
  return buildRef("REQ", year, refs.map((r) => r.reference));
}

export async function createPurchaseRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  // Pas de garde de module : DEMANDER un achat est un geste de tout employé. Ce qui reste
  // fermé, c'est le budget — il n'apparaît nulle part dans ce circuit.
  const user = await requireUser();

  const lines = readLines(formData.get("lines"));
  if (lines.length === 0) {
    return { ok: false, error: "Indiquez au moins un article — du catalogue, ou décrit en clair." };
  }

  // LE VALIDATEUR NE SE CHOISIT PAS : c'est le responsable du demandeur, résolu par
  // l'organigramme (manager explicite, puis responsable de département, puis au-dessus).
  // Laisser choisir reviendrait à laisser choisir qui vous dit oui.
  const manager = await getManagerOfUser(user.id);
  if (!manager?.userId) {
    return {
      ok: false,
      error: "Aucun responsable hiérarchique n'est rattaché à votre fiche : demandez aux ressources humaines de la compléter, sinon la demande n'aurait personne à qui aller.",
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { departmentId: true },
  });

  const title = fdStr(formData, "title") || summarize(lines);
  const amount = estimatedTotal(lines);
  const reference = await nextRef();

  const created = await prisma.administrativeRequest.create({
    data: {
      reference, title, type: "PURCHASE",
      status: "AWAITING_VALIDATION",
      description: fdStr(formData, "description"),
      priority: "MEDIUM",
      departmentId: employee?.departmentId ?? null,
      // Le détail voyage dans `fields` : c'est ce qui permet de relire six mois plus tard
      // CE QUI a été demandé, et pas seulement combien ça a coûté.
      fields: { purchaseLines: lines as unknown as Prisma.InputJsonValue, estimatedTotal: amount },
      requesterId: user.id,
      createdById: user.id,
      validatorId: manager.userId,
      companyId: await companyIdForNew(user.id),
    },
    select: { id: true },
  });

  await prisma.adminApproval.create({
    data: {
      requestId: created.id, requestedById: user.id, validatorId: manager.userId,
      status: "PENDING",
      // Le montant est INDICATIF (prix du catalogue). On ne le pose PAS comme montant à payer :
      // ce champ déclenche un ordre de dépense à l'approbation, et l'on ne fait pas payer un
      // prix de catalogue à la place d'une facture réelle.
      comment: amount != null ? `Estimation catalogue : ${amount.toLocaleString("fr-FR")} DZD` : null,
    },
  });

  await notifyUser({
    userId: manager.userId, type: "VALIDATION_REQUIRED",
    title: "Demande d'achat à valider",
    body: `${reference} — ${title}${amount != null ? ` (~${amount.toLocaleString("fr-FR")} DZD)` : ""}`,
    link: `/demandes/${created.id}`,
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Moyens généraux",
    entityType: "ADMIN_REQUEST", entityId: created.id,
    summary: `Demande d'achat ${reference} — ${title} · validateur ${manager.fullName}`,
  });

  revalidatePath(PATH);
  revalidatePath("/demandes");
  revalidatePath("/demandes/approvals");
  return { ok: true, id: created.id, message: `Demande envoyée à ${manager.fullName}.` };
}

/**
 * RETIRER SA DEMANDE — tant que le directeur n'a pas tranché.
 *
 * Après, elle appartient au circuit : la retirer effacerait une décision, et l'on ne saurait
 * plus pourquoi un achat a été lancé. On l'annule alors plutôt qu'on ne la supprime.
 */
export async function withdrawPurchaseRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Demande introuvable." };

  const req = await prisma.administrativeRequest.findUnique({
    where: { id },
    select: {
      id: true, reference: true, requesterId: true, status: true, validatorId: true,
      approvals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
    },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.requesterId !== user.id) return { ok: false, error: "Seul l'auteur retire sa demande." };

  const stage = purchaseStage(req.status, req.approvals[0] ?? null);
  if (!canWithdraw(stage)) {
    return { ok: false, error: "Votre directeur a déjà tranché : la demande ne peut plus être retirée." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminApproval.deleteMany({ where: { requestId: id, status: "PENDING" } });
    await tx.administrativeRequest.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  });

  if (req.validatorId) {
    await notifyUser({
      userId: req.validatorId, type: "GENERIC", title: "Demande d'achat retirée",
      body: req.reference, link: `/demandes/${id}`,
    }).catch(() => undefined);
  }
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Moyens généraux",
    entityType: "ADMIN_REQUEST", entityId: id,
    summary: `Demande d'achat ${req.reference} retirée par son auteur`,
  });
  revalidatePath(PATH);
  revalidatePath("/demandes/approvals");
  return { ok: true };
}
