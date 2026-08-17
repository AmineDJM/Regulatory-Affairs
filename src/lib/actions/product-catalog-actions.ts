"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan, scopeRegulatory } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/types";

/**
 * RATTACHER UN PRODUIT À SON DOSSIER RÉGLEMENTAIRE — ou défaire le rattachement.
 *
 * C'est la seule écriture de la fusion des catalogues, et elle est toujours le fait d'une
 * PERSONNE. Le rapprochement automatique propose, il ne tranche pas : un 500 mg et un 1 g
 * partagent molécule, forme et nom commercial, et les confondre coûterait une erreur qu'on ne
 * découvrirait qu'au moment où elle est chère.
 *
 * Chaque décision part au journal. Un rattachement qui se révèle faux doit pouvoir se retrouver :
 * savoir QUI a dit que ces deux produits n'en font qu'un vaut, plus tard, tous les commentaires.
 */

export type CatalogKind = "BD" | "PROMO";

async function guard(kind: CatalogKind) {
  const user = await requireUser();
  // Rattacher, c'est déclarer une équivalence de produits : cela relève du réglementaire, qui
  // tient le catalogue de référence — pas du module d'où vient le produit.
  if (!userCan(user, "REGULATORY", "UPDATE")) {
    return { user: null, error: "Seul le réglementaire rattache un produit à son dossier." };
  }
  if (kind !== "BD" && kind !== "PROMO") return { user: null, error: "Catalogue inconnu." };
  return { user, error: null as string | null };
}

export async function linkProductToDossier(input: {
  kind: CatalogKind; id: string; regulatoryProductId: string;
}): Promise<ActionResult> {
  const { user, error } = await guard(input.kind);
  if (!user) return { ok: false, error: error ?? "Non autorisé." };
  if (!input.id || !input.regulatoryProductId) return { ok: false, error: "Produit ou dossier manquant." };

  // Le dossier doit être DANS SA PORTÉE : sans ce contrôle, on rattacherait à un dossier
  // verrouillé ou hors périmètre en devinant son identifiant.
  const dossier = await prisma.regulatoryProduct.findFirst({
    where: { id: input.regulatoryProductId, ...scopeRegulatory(user) },
    select: { id: true, dci: true, dosage: true, reference: true },
  });
  if (!dossier) return { ok: false, error: "Dossier réglementaire introuvable dans votre périmètre." };

  const dossierName = [dossier.dci, dossier.dosage, dossier.reference && `(${dossier.reference})`].filter(Boolean).join(" ");

  if (input.kind === "BD") {
    const p = await prisma.bdProduct.findUnique({ where: { id: input.id }, select: { dci: true } });
    if (!p) return { ok: false, error: "Produit introuvable." };
    await prisma.bdProduct.update({ where: { id: input.id }, data: { regulatoryProductId: dossier.id } });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Regulatory",
      entityType: "REGULATORY_PRODUCT", entityId: dossier.id,
      summary: `Catalogues rapprochés — le produit BD « ${p.dci} » est rattaché à ${dossierName}`,
    });
  } else {
    const p = await prisma.promoProduct.findUnique({ where: { id: input.id }, select: { name: true } });
    if (!p) return { ok: false, error: "Produit introuvable." };
    await prisma.promoProduct.update({ where: { id: input.id }, data: { regulatoryProductId: dossier.id } });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Regulatory",
      entityType: "REGULATORY_PRODUCT", entityId: dossier.id,
      summary: `Catalogues rapprochés — le produit promu « ${p.name} » est rattaché à ${dossierName}`,
    });
  }

  revalidatePath("/regulatory/catalogue");
  return { ok: true, message: `Rattaché à ${dossierName}.` };
}

/** Défaire un rattachement — un rapprochement faux doit se corriger aussi vite qu'il s'est fait. */
export async function unlinkProductFromDossier(input: { kind: CatalogKind; id: string }): Promise<ActionResult> {
  const { user, error } = await guard(input.kind);
  if (!user) return { ok: false, error: error ?? "Non autorisé." };
  if (!input.id) return { ok: false, error: "Produit manquant." };

  if (input.kind === "BD") {
    const p = await prisma.bdProduct.findUnique({ where: { id: input.id }, select: { dci: true, regulatoryProductId: true } });
    if (!p) return { ok: false, error: "Produit introuvable." };
    await prisma.bdProduct.update({ where: { id: input.id }, data: { regulatoryProductId: null } });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Regulatory",
      entityType: "REGULATORY_PRODUCT", entityId: p.regulatoryProductId ?? undefined,
      summary: `Rapprochement défait — le produit BD « ${p.dci} » n'est plus rattaché`,
    });
  } else {
    const p = await prisma.promoProduct.findUnique({ where: { id: input.id }, select: { name: true, regulatoryProductId: true } });
    if (!p) return { ok: false, error: "Produit introuvable." };
    await prisma.promoProduct.update({ where: { id: input.id }, data: { regulatoryProductId: null } });
    await recordAudit({
      actorId: user.id, action: "UPDATE", module: "Regulatory",
      entityType: "REGULATORY_PRODUCT", entityId: p.regulatoryProductId ?? undefined,
      summary: `Rapprochement défait — le produit promu « ${p.name} » n'est plus rattaché`,
    });
  }

  revalidatePath("/regulatory/catalogue");
  return { ok: true };
}
