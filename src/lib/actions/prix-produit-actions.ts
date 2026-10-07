"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { regulatoryLockWhere } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { fdStr, fdDate, type ActionResult } from "@/lib/actions/types";
import { peutModifierLesPrix } from "@/lib/vues-360-acces";
import { estTypePrix, lireMontant, LIBELLE_PRIX } from "@/lib/products/fiche-360";

/**
 * LES PRIX D'UN PRODUIT, À LA MAIN (Direction, 07/10 : « les prix existent dans l'Explorateur de produits, mais en plus
 * ils doivent être modifiables manuellement quand on veut »). Chaque geste AJOUTE une ligne — l'historique ne se
 * réécrit pas — et la saisie l'emporte sur l'Explorateur à partir de sa date d'effet (`products/fiche-360.ts`).
 * Garde : `peutModifierLesPrix` (Produits 360 « Modifier », ou Regulatory « Modifier »).
 */

const REFUS = "Corriger un prix demande « Modifier » sur Produits 360 ou sur Regulatory (Administration › Accès).";

/** Le produit, s'il existe ET qu'il est au catalogue de la personne (un dossier non verrouillé). */
async function produitDuCatalogue(user: Awaited<ReturnType<typeof requireUser>>, id: string) {
  return prisma.product.findFirst({
    where: { AND: [{ id }, user.role === "SUPER_ADMIN" ? {} : { regulatoryProfiles: { some: regulatoryLockWhere(user) } }] },
    select: { id: true, code: true },
  });
}

export async function enregistrerPrixProduit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutModifierLesPrix(user)) return { ok: false, error: REFUS };
  const productId = fdStr(formData, "productId");
  const kind = fdStr(formData, "kind");
  const montant = lireMontant(fdStr(formData, "amountDzd"));
  const validFrom = fdDate(formData, "validFrom") ?? new Date();
  const note = fdStr(formData, "note");
  if (!productId) return { ok: false, error: "Produit introuvable." };
  if (!estTypePrix(kind)) return { ok: false, error: "Type de prix inconnu." };
  if (montant === null) return { ok: false, error: "Indiquez un montant en DZD." };
  if (Number.isNaN(montant)) return { ok: false, error: "Montant illisible : un nombre positif, en DZD." };
  if (note && note.length > 300) return { ok: false, error: "Note trop longue (300 caractères au plus)." };
  const p = await produitDuCatalogue(user, productId);
  if (!p) return { ok: false, error: "Produit introuvable." };

  const ligne = await prisma.productPrice.create({ data: { productId: p.id, kind, amountDzd: montant, validFrom, note, setById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Produits", entityType: "PRODUCT", entityId: p.id,
    field: `prix:${kind}`, newValue: String(montant),
    summary: `${LIBELLE_PRIX[kind]} du produit ${p.code} saisi à ${montant.toLocaleString("fr-FR")} DZD à compter du ${validFrom.toISOString().slice(0, 10)}`,
  });
  revalidatePath(`/produits/${p.id}`);
  return { ok: true, id: ligne.id };
}

/** Rend la main à l'Explorateur : une ligne SANS montant, datée d'aujourd'hui. Les saisies d'avant restent à l'historique. */
export async function revenirAuPrixExplorateur(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!peutModifierLesPrix(user)) return { ok: false, error: REFUS };
  const productId = fdStr(formData, "productId");
  const kind = fdStr(formData, "kind");
  if (!productId) return { ok: false, error: "Produit introuvable." };
  if (!estTypePrix(kind)) return { ok: false, error: "Type de prix inconnu." };
  const p = await produitDuCatalogue(user, productId);
  if (!p) return { ok: false, error: "Produit introuvable." };

  await prisma.productPrice.create({ data: { productId: p.id, kind, amountDzd: null, validFrom: new Date(), setById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Produits", entityType: "PRODUCT", entityId: p.id,
    field: `prix:${kind}`, newValue: null,
    summary: `${LIBELLE_PRIX[kind]} du produit ${p.code} : retour à la valeur de l'Explorateur produits`,
  });
  revalidatePath(`/produits/${p.id}`);
  return { ok: true };
}
