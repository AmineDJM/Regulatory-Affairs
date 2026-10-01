"use server";

import { revalidatePath } from "next/cache";
import { MaterialType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { createWithRetry, enSerie } from "@/lib/refs";
import { fdStr, fdBool, type ActionResult } from "@/lib/actions/types";
import { prochaineReference, validerArticle, FAMILLE_LABEL } from "@/lib/promo/catalogue";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CATALOGUE DU MATÉRIEL PROMOTIONNEL — créer, corriger, archiver (§118.164).
 *
 * Le droit est celui du module `PROMO_CATALOG` : au Super Admin par défaut, ouvert par lui
 * personne par personne dans Administration › Accès (« en édition ou en lecture, à qui il veut »).
 * SUPPRIMER un article passe par la corbeille canonique (`admin-delete-registry.ts`, Super Admin) ;
 * un article qui a servi ne se supprime pas — il s'ARCHIVE, et reste lisible là où il a servi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const PATH = "/promo-material/catalogue";
const REFUS = "Le catalogue promotionnel ne vous est pas ouvert en écriture — un Super Admin l'ouvre dans Administration › Accès (module « Catalogue promotionnel »).";
const TYPES = new Set<string>(Object.values(MaterialType));

/** CRÉER UN ARTICLE — la référence CAT-NNNN est attribuée ici, une fois pour toutes. */
export async function creerArticleCatalogue(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !userCan(user, "PROMO_CATALOG", "CREATE")) return { ok: false, error: REFUS };
  const v = validerArticle({
    nom: fdStr(formData, "nom"),
    famille: fdStr(formData, "famille"),
    materialType: fdStr(formData, "materialType"),
    unite: fdStr(formData, "unite"),
    description: fdStr(formData, "description"),
    exigeProduit: fdBool(formData, "exigeProduit"),
  }, TYPES);
  if (!v.ok) return { ok: false, error: v.error };
  const a = v.article;

  // Une série, une création à la fois (§118.148) ; l'unicité de la référence reste tenue par la base.
  const cree = await enSerie("catalogue-promo", () => createWithRetry(async () => {
    const refs = await prisma.promoCatalogueArticle.findMany({ select: { reference: true } });
    return prisma.promoCatalogueArticle.create({
      data: {
        reference: prochaineReference(refs.map((r) => r.reference)),
        nom: a.nom, famille: a.famille, materialType: (a.materialType as MaterialType | null) ?? null,
        unite: a.unite, description: a.description, exigeProduit: a.exigeProduit,
        createdById: user.id, updatedById: user.id,
      },
      select: { id: true, reference: true },
    });
  }));
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Catalogue promotionnel", entityId: cree.id,
    summary: `Article ${cree.reference} ajouté au catalogue — ${a.nom} (${FAMILLE_LABEL[a.famille]})`,
  });
  revalidatePath(PATH);
  return { ok: true, id: cree.id, message: `${cree.reference} — ${a.nom} ajouté au catalogue.` };
}

/**
 * CORRIGER UN ARTICLE — tout sauf la référence. La FAMILLE ne change pas sous un stock qui la
 * contredirait : un article dont des unités ont été comptées ne devient pas « numérique » (il n'a
 * pas de quantité), et un support numérique en service ne devient pas une chose qu'on compte.
 */
export async function modifierArticleCatalogue(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !userCan(user, "PROMO_CATALOG", "UPDATE")) return { ok: false, error: REFUS };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Article introuvable." };
  const avant = await prisma.promoCatalogueArticle.findUnique({ where: { id }, select: { reference: true, nom: true, famille: true } });
  if (!avant) return { ok: false, error: "Article introuvable." };
  const v = validerArticle({
    nom: fdStr(formData, "nom"),
    famille: fdStr(formData, "famille"),
    materialType: fdStr(formData, "materialType"),
    unite: fdStr(formData, "unite"),
    description: fdStr(formData, "description"),
    exigeProduit: fdBool(formData, "exigeProduit"),
  }, TYPES);
  if (!v.ok) return { ok: false, error: v.error };
  const a = v.article;

  if (a.famille !== avant.famille) {
    if (a.famille === "NUMERIQUE" || avant.famille === "NUMERIQUE") {
      const enService = await prisma.promoStockItem.count({ where: { catalogueId: id } });
      if (enService > 0) {
        return {
          ok: false,
          error: avant.famille === "NUMERIQUE"
            ? `${avant.reference} a déjà des supports numériques en service : il ne devient pas un article qu'on compte. Créez un article distinct.`
            : `${avant.reference} a déjà du stock compté : il ne devient pas numérique (un support numérique n'a pas de quantité). Créez un article distinct.`,
        };
      }
    }
  }

  await prisma.promoCatalogueArticle.update({
    where: { id },
    data: {
      nom: a.nom, famille: a.famille, materialType: (a.materialType as MaterialType | null) ?? null,
      unite: a.unite, description: a.description, exigeProduit: a.exigeProduit, updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Catalogue promotionnel", entityId: id,
    summary: `Article ${avant.reference} modifié${avant.nom !== a.nom ? ` — ${avant.nom} → ${a.nom}` : ""}`,
  });
  revalidatePath(PATH);
  revalidatePath("/promo-material/stock");
  return { ok: true, id };
}

/** ARCHIVER (ou réactiver) — l'article ne se propose plus, et reste lisible partout où il a servi. */
export async function archiverArticleCatalogue(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN" && !userCan(user, "PROMO_CATALOG", "UPDATE")) return { ok: false, error: REFUS };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Article introuvable." };
  const actif = fdStr(formData, "actif") === "true";
  const art = await prisma.promoCatalogueArticle.findUnique({ where: { id }, select: { reference: true, nom: true } });
  if (!art) return { ok: false, error: "Article introuvable." };
  await prisma.promoCatalogueArticle.update({ where: { id }, data: { actif, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Catalogue promotionnel", entityId: id,
    summary: `Article ${art.reference} ${actif ? "réactivé" : "archivé"} — ${art.nom}`,
  });
  revalidatePath(PATH);
  return { ok: true, id };
}
