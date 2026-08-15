"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { fdStr, type ActionResult } from "@/lib/actions/types";
import {
  parseQuantity, deltaFor, validateMovement, stockOf, MOVEMENT_LABEL, type MovementKind,
} from "@/lib/promo/stock";

const PATH = "/promo-material/stock";
const KINDS: MovementKind[] = ["RECEIPT", "DISTRIBUTION", "LOSS", "CORRECTION"];

/**
 * STOCK DU MATÉRIEL PROMOTIONNEL — la direction marketing tient ce registre.
 *
 * Le droit est celui du module `PROMO_MATERIAL` : c'est le marketing qui commande le matériel,
 * c'est lui qui sait ce qu'il en reste. Y ajouter une autorisation séparée aurait produit le
 * cas classique — quelqu'un voit le stock, ne peut pas le corriger, et cesse de le regarder.
 */
async function requireStockKeeper(action: "CREATE" | "UPDATE" | "DELETE") {
  const user = await requireUser();
  if (!userCan(user, "PROMO_MATERIAL", action) && !hasGlobalView(user)) return null;
  return user;
}

/** Le stock actuel d'un article, relu depuis ses mouvements — jamais depuis un champ. */
async function currentStock(itemId: string): Promise<number> {
  const rows = await prisma.promoStockMovement.findMany({ where: { itemId }, select: { kind: true, delta: true } });
  return stockOf(rows.map((m) => ({ kind: m.kind as MovementKind, delta: toNumber(m.delta) })));
}

/**
 * CRÉER UN ARTICLE. La quantité initiale, si elle est donnée, devient une ENTRÉE — pas un champ
 * « quantité » : dès la première ligne, le stock a une explication.
 */
export async function createStockItem(formData: FormData): Promise<ActionResult> {
  const user = await requireStockKeeper("CREATE");
  if (!user) return { ok: false, error: "Réservé à la direction marketing." };

  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Nommez l'article." };
  const threshold = parseQuantity(fdStr(formData, "alertThreshold"));
  const initial = parseQuantity(fdStr(formData, "initialQuantity"));

  const item = await prisma.promoStockItem.create({
    data: {
      name,
      companyId: await companyIdForNew(user.id),
      materialType: (fdStr(formData, "materialType") as never) ?? null,
      reference: fdStr(formData, "reference"),
      unit: fdStr(formData, "unit"),
      location: fdStr(formData, "location"),
      alertThreshold: threshold != null && threshold > 0 ? threshold : null,
      notes: fdStr(formData, "notes"),
      promoMaterialId: fdStr(formData, "promoMaterialId"),
      createdById: user.id,
      updatedById: user.id,
    },
    select: { id: true },
  });

  if (initial != null && initial > 0) {
    await prisma.promoStockMovement.create({
      data: {
        itemId: item.id, kind: "RECEIPT", delta: initial,
        reason: "Stock initial", createdById: user.id,
      },
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Matériel promotionnel",
    entityId: item.id, summary: `Article de stock créé — ${name}${initial ? ` (${initial} en stock)` : ""}`,
  });
  revalidatePath(PATH);
  return { ok: true, id: item.id };
}

/** MODIFIER LA FICHE d'un article — son identité, pas sa quantité (qui ne se saisit jamais). */
export async function updateStockItem(formData: FormData): Promise<ActionResult> {
  const user = await requireStockKeeper("UPDATE");
  if (!user) return { ok: false, error: "Réservé à la direction marketing." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Article introuvable." };
  const before = await prisma.promoStockItem.findUnique({ where: { id }, select: { name: true } });
  if (!before) return { ok: false, error: "Article introuvable." };

  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Nommez l'article." };
  const threshold = parseQuantity(fdStr(formData, "alertThreshold"));

  await prisma.promoStockItem.update({
    where: { id },
    data: {
      name,
      materialType: (fdStr(formData, "materialType") as never) ?? null,
      reference: fdStr(formData, "reference"),
      unit: fdStr(formData, "unit"),
      location: fdStr(formData, "location"),
      alertThreshold: threshold != null && threshold > 0 ? threshold : null,
      notes: fdStr(formData, "notes"),
      isActive: formData.get("isActive") !== "false",
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel",
    entityId: id, summary: `Article de stock modifié — ${before.name}${before.name !== name ? ` → ${name}` : ""}`,
  });
  revalidatePath(PATH);
  return { ok: true, id };
}

/**
 * SUPPRIMER UN ARTICLE, avec son historique de mouvements.
 *
 * On supprime ce qui n'aurait pas dû exister (doublon, erreur de saisie). Pour un article réel
 * qui n'est plus utilisé, on le DÉSACTIVE : son historique explique encore les distributions
 * passées. Le journal d'audit garde la trace de la suppression et du stock au moment où elle a
 * eu lieu — c'est ce chiffre-là qu'on cherchera si la question revient.
 */
export async function deleteStockItem(formData: FormData): Promise<ActionResult> {
  const user = await requireStockKeeper("DELETE");
  if (!user) return { ok: false, error: "Réservé à la direction marketing." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Article introuvable." };
  const item = await prisma.promoStockItem.findUnique({
    where: { id }, select: { name: true, _count: { select: { movements: true } } },
  });
  if (!item) return { ok: false, error: "Article introuvable." };

  const stock = await currentStock(id);
  await prisma.promoStockItem.delete({ where: { id } }); // les mouvements suivent (cascade)
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Matériel promotionnel", entityId: id,
    summary: `Article de stock supprimé — ${item.name} (${stock} en stock, ${item._count.movements} mouvement·s)`,
  });
  revalidatePath(PATH);
  return { ok: true, id };
}

/**
 * ENREGISTRER UN MOUVEMENT — entrée, distribution, perte, correction.
 *
 * La quantité se saisit POSITIVE : c'est la nature choisie qui donne le sens (seule la
 * correction accepte un signe). Le stock est recalculé côté serveur avant la garde : un écran
 * ouvert depuis dix minutes n'autorise pas une sortie sur un stock qui a changé entre-temps.
 */
export async function recordStockMovement(formData: FormData): Promise<ActionResult> {
  const user = await requireStockKeeper("UPDATE");
  if (!user) return { ok: false, error: "Réservé à la direction marketing." };

  const itemId = fdStr(formData, "itemId");
  const rawKind = fdStr(formData, "kind");
  if (!itemId || !rawKind || !KINDS.includes(rawKind as MovementKind)) return { ok: false, error: "Mouvement invalide." };
  const kind = rawKind as MovementKind;

  const item = await prisma.promoStockItem.findUnique({ where: { id: itemId }, select: { name: true, unit: true } });
  if (!item) return { ok: false, error: "Article introuvable." };

  const quantity = parseQuantity(fdStr(formData, "quantity"));
  if (quantity == null) return { ok: false, error: "Indiquez une quantité." };

  const current = await currentStock(itemId);
  const gate = validateMovement(kind, current, quantity);
  if (!gate.ok) return { ok: false, error: gate.reason ?? "Mouvement impossible." };

  const delta = deltaFor(kind, quantity);
  const occurredRaw = fdStr(formData, "occurredAt");
  await prisma.promoStockMovement.create({
    data: {
      itemId, kind, delta,
      recipient: fdStr(formData, "recipient"),
      reason: fdStr(formData, "reason"),
      occurredAt: occurredRaw ? new Date(occurredRaw) : new Date(),
      createdById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Matériel promotionnel", entityId: itemId,
    summary: `${MOVEMENT_LABEL[kind]} — ${item.name} : ${delta > 0 ? "+" : ""}${delta}${item.unit ? ` ${item.unit}` : ""} (stock ${current} → ${current + delta})`,
  });
  revalidatePath(PATH);
  return { ok: true, id: itemId };
}

/**
 * ANNULER UN MOUVEMENT saisi par erreur.
 *
 * On le supprime plutôt que de créer un contre-mouvement : une erreur de saisie n'est pas un
 * fait de gestion, et deux lignes qui s'annulent dans le registre rendent illisible ce qui s'est
 * réellement passé. Le journal d'audit, lui, garde la trace de l'annulation.
 */
export async function deleteStockMovement(formData: FormData): Promise<ActionResult> {
  const user = await requireStockKeeper("UPDATE");
  if (!user) return { ok: false, error: "Réservé à la direction marketing." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Mouvement introuvable." };
  const mv = await prisma.promoStockMovement.findUnique({
    where: { id }, include: { item: { select: { id: true, name: true } } },
  });
  if (!mv) return { ok: false, error: "Mouvement introuvable." };

  await prisma.promoStockMovement.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Matériel promotionnel", entityId: mv.item.id,
    summary: `Mouvement annulé — ${mv.item.name} : ${MOVEMENT_LABEL[mv.kind as MovementKind]} de ${toNumber(mv.delta)}`,
  });
  revalidatePath(PATH);
  return { ok: true, id: mv.item.id };
}
