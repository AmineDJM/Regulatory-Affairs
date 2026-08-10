"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";

// Trois périmètres : la PCH (centrale), les HÔPITAUX et les ANNEXES PCH (sites de stockage
// secondaires). Hôpitaux et annexes sont des lieux nommés (StockAnnex, distingués par `kind`),
// créés uniquement par le Super Admin. Les autres ne font qu'enregistrer des états de stock.
const SCOPES = ["PCH", "HOSPITAL", "ANNEX"] as const;
const PATH = "/stocks";

/** Libellés d'un lieu nommé selon son type (pour messages/audit). */
const LOC = { HOSPITAL: { un: "un hôpital", ce: "Cet hôpital", le: "Hôpital" }, ANNEX: { un: "une annexe PCH", ce: "Cette annexe PCH", le: "Annexe PCH" } } as const;

/** Crée un lieu nommé (hôpital ou annexe PCH), réservé au Super Admin. */
async function createStockLocation(formData: FormData, kind: "HOSPITAL" | "ANNEX"): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: `Seul le Super Admin peut créer ${LOC[kind].un}.` };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Indiquez le nom." };
  const existing = await prisma.stockAnnex.findUnique({ where: { name } });
  if (existing) return { ok: false, error: `${LOC[kind].ce} existe déjà.` };
  const loc = await prisma.stockAnnex.create({ data: { name, kind } });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Stocks", summary: `${LOC[kind].le} créé — ${name}` });
  revalidatePath(PATH);
  return { ok: true, id: loc.id };
}

/** Supprime un lieu nommé et ses états de stock (Super Admin). */
async function deleteStockLocation(formData: FormData, kind: "HOSPITAL" | "ANNEX"): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: `Seul le Super Admin peut supprimer ${LOC[kind].un}.` };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const loc = await prisma.stockAnnex.findUnique({ where: { id }, select: { name: true } });
  if (!loc) return { ok: false, error: "Lieu introuvable." };
  await prisma.stockAnnex.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Stocks", summary: `${LOC[kind].le} supprimé — ${loc.name}` });
  revalidatePath(PATH);
  return { ok: true };
}

/** Crée un HÔPITAL (réservé au Super Admin). */
export async function createStockHospital(formData: FormData): Promise<ActionResult> {
  return createStockLocation(formData, "HOSPITAL");
}

/** Supprime un hôpital et ses états de stock (Super Admin). */
export async function deleteStockHospital(formData: FormData): Promise<ActionResult> {
  return deleteStockLocation(formData, "HOSPITAL");
}

/** Crée une ANNEXE PCH (réservé au Super Admin, comme les hôpitaux). */
export async function createStockAnnex(formData: FormData): Promise<ActionResult> {
  return createStockLocation(formData, "ANNEX");
}

/** Supprime une annexe PCH et ses états de stock (Super Admin). */
export async function deleteStockAnnex(formData: FormData): Promise<ActionResult> {
  return deleteStockLocation(formData, "ANNEX");
}

/**
 * Demande d'ÉTAT DE STOCK à un instant T (Direction / Super Admin) : on charge une personne
 * (délégué ou autre) d'aller relever et RENSEIGNER l'état actuel — pour UN OU PLUSIEURS
 * HÔPITAUX précis (ou en général si aucun n'est ciblé). Créé comme une tâche assignée
 * (visible dans « Mon espace ») + notification nominative ; la personne enregistre ensuite
 * l'état de chaque hôpital dans l'onglet « Stock hôpitaux » (réponse native du module).
 */
export async function requestStockState(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !userCan(user, "STOCKS", "DELETE")) {
    return { ok: false, error: "Réservé à la Direction / au Super Admin." };
  }
  const assigneeId = fdStr(formData, "assigneeId");
  const note = fdStr(formData, "note");
  const hospitalIds = formData.getAll("hospitalIds").map((v) => String(v).trim()).filter(Boolean);
  if (!assigneeId) return { ok: false, error: "Choisissez la personne à qui demander l'état de stock." };
  const assignee = await prisma.user.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } });
  if (!assignee) return { ok: false, error: "Destinataire invalide." };

  // Hôpitaux ciblés : validés en base (jamais un libellé libre) — la demande cite leurs NOMS.
  let hospitals: { id: string; name: string }[] = [];
  if (hospitalIds.length > 0) {
    hospitals = await prisma.stockAnnex.findMany({
      where: { id: { in: hospitalIds }, kind: { not: "ANNEX" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    if (hospitals.length !== hospitalIds.length) return { ok: false, error: "Hôpital inconnu dans la sélection." };
  }
  const hospitalNames = hospitals.map((h) => h.name).join(", ");

  const title = hospitals.length > 0
    ? `État de stock demandé — ${hospitalNames}`.slice(0, 180)
    : "État de stock demandé" + (note ? ` — ${note.slice(0, 120)}` : "");
  const task = await prisma.task.create({
    data: {
      title,
      description: [
        note ? note + "\n" : "",
        hospitals.length > 0
          ? `Hôpitaux concernés : ${hospitalNames}.\nMerci de relever l'état de stock de chacun et de le renseigner dans le module Stocks (onglet « Stock hôpitaux »).`
          : "Merci de relever l'état de stock actuel et de le renseigner dans le module Stocks.",
      ].join("\n"),
      assignedToId: assignee.id, createdById: user.id, priority: "HIGH", module: "STOCKS",
    },
    select: { id: true },
  });
  await notifyUser({
    userId: assignee.id, type: "ASSIGNMENT", title: "État de stock demandé",
    body: hospitals.length > 0 ? `Hôpitaux : ${hospitalNames}${note ? ` — ${note}` : ""}`.slice(0, 240) : note || "Relevez et renseignez l'état de stock actuel.",
    link: "/stocks",
  }).catch(() => undefined);
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Stocks", entityType: "TASK", entityId: task.id,
    summary: `Demande d'état de stock${hospitals.length > 0 ? ` (${hospitals.length} hôpital·aux : ${hospitalNames.slice(0, 120)})` : ""}${note ? " — " + note.slice(0, 80) : ""}`,
  });
  revalidatePath(PATH);
  return { ok: true, id: task.id };
}

/**
 * Enregistre un ÉTAT de stock daté : « à cette date, il reste X unités » pour un
 * produit et un lieu (PCH / hôpital / annexe). S'il existe déjà un état pour le même
 * jour, il est remplacé (correction simple).
 */
export async function recordStockSnapshot(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "STOCKS", "CREATE") && !userCan(user, "STOCKS", "UPDATE")) return { ok: false, error: "Non autorisé." };
  const scope = fdStr(formData, "scope");
  const productId = fdStr(formData, "productId");
  const date = fdDate(formData, "date");
  const quantity = fdNum(formData, "quantity");
  const annexId = fdStr(formData, "annexId");
  const isLocationScope = scope === "HOSPITAL" || scope === "ANNEX";
  if (!scope || !(SCOPES as readonly string[]).includes(scope)) return { ok: false, error: "Lieu de stock invalide." };
  if (isLocationScope && !annexId) return { ok: false, error: scope === "HOSPITAL" ? "Choisissez l'hôpital concerné." : "Choisissez l'annexe PCH concernée." };
  if (!productId) return { ok: false, error: "Choisissez le produit." };
  if (!date) return { ok: false, error: "Indiquez la date de l'état de stock." };
  if (quantity === null || quantity < 0) return { ok: false, error: "Indiquez la quantité restante (≥ 0)." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { dci: true, brandName: true, companyId: true } });
  if (!product) return { ok: false, error: "Produit introuvable." };

  // Un seul état par jour et par (produit, lieu) : on remplace s'il existe.
  // L'entité de l'état de stock suit celle du produit (référentiel Regulatory).
  const dayStart = new Date(date); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const existing = await prisma.stockSnapshot.findFirst({
    where: { scope, annexId: isLocationScope ? annexId : null, productId, date: { gte: dayStart, lt: dayEnd } },
  });
  if (existing) {
    await prisma.stockSnapshot.update({ where: { id: existing.id }, data: { quantity: Math.round(quantity), date, companyId: product.companyId } });
  } else {
    await prisma.stockSnapshot.create({
      data: { scope, annexId: isLocationScope ? annexId : null, productId, date, quantity: Math.round(quantity), companyId: product.companyId, createdById: user.id },
    });
  }
  await recordAudit({ actorId: user.id, action: existing ? "UPDATE" : "CREATE", module: "Stocks", summary: `État de stock ${scope} — ${product.brandName ?? product.dci} : ${Math.round(quantity)} u.` });
  revalidatePath(PATH);
  return { ok: true };
}

/** Supprime un état de stock (correction). */
export async function deleteStockSnapshot(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const snap = await prisma.stockSnapshot.findUnique({ where: { id }, select: { createdById: true } });
  if (!snap) return { ok: false, error: "État introuvable." };
  if (!userCan(user, "STOCKS", "DELETE") && snap.createdById !== user.id) return { ok: false, error: "Non autorisé." };
  await prisma.stockSnapshot.delete({ where: { id } });
  revalidatePath(PATH);
  return { ok: true };
}
