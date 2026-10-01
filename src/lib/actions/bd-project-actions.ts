"use server";

import { revalidatePath } from "next/cache";
import type { BdProjectStatus, BdSourcing, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { companyIdForNew, getMyCompanies } from "@/lib/company";
import { supprimerReversible } from "@/lib/suppression/coeur";
import { fdStr, fdNum, type ActionResult } from "@/lib/actions/types";

const MODULE = "BUSINESS_DEVELOPMENT" as const;
const AUDIT_MODULE = "Business Development";
const BD_PATH = "/business-development";
const PROJETS_PATH = "/business-development/projets";

const PROJECT_STATUSES: BdProjectStatus[] = [
  "IDEA", "TO_ANALYZE", "IN_PROGRESS", "AWAITING_SUPPLIER", "AWAITING_INTERNAL",
  "RECOMMENDATION_READY", "VALIDATED", "ABANDONED", "CLOSED",
];
const SOURCINGS: BdSourcing[] = ["MANUFACTURED", "IMPORTED", "TO_STUDY"];

// Champs éditables en ligne (allowlist stricte, côté serveur).
const PRODUCT_TEXT = new Set([
  "dci", "brandName", "dosage", "form", "competitors", "competitorShares",
  "competitorVolume", "competitorPrice", "comment",
]);
const PRODUCT_DECIMAL = new Set([
  "marketSizeDzd", "marketSizeUsd", "unitPrice", "totalMarketVolume",
  "investmentY1", "investmentY2", "investmentY3", "revenueY1", "revenueY2", "revenueY3",
]);
const PROJECT_TEXT = new Set(["name", "description", "comment"]);

// ───────────────────────────── Projet ─────────────────────────────

/**
 * LE REGISTRE DE PROJETS EST SON PROPRE MODULE, `BD_PROJECTS` (§118.163) : il survit au retrait de
 * Market Intelligence (`BUSINESS_DEVELOPMENT`, que `userCan` refuse à tout le monde) et se règle,
 * personne par personne, dans Administration › Accès. Le refus le DIT, parce qu'un « non autorisé »
 * sans remède fait chercher un bug là où il y a une case à cocher (§118.30).
 */
const REFUS_MODULE = (geste: string) =>
  `Vous n'avez pas le droit de ${geste} un projet — le Super Admin l'accorde dans Administration › Accès (module « Projets »).`;

/**
 * L'ENTITÉ D'UN PROJET — celle qu'on a CHOISIE, sinon celle sur laquelle on travaille, et
 * toujours une entité que la personne VOIT (§118.163).
 *
 * « Voir » et non « engager » : classer des dossiers sous un projet n'émet rien au nom de la
 * société — c'est `canEditCompanyId` qui garde l'émission d'une pièce, pas le rangement. Exiger le
 * droit d'engager refuserait à un responsable Regulatory un projet de sa propre société.
 */
async function entiteDuProjet(userId: string, choisie: string | null): Promise<{ ok: true; companyId: string } | { ok: false; error: string }> {
  const companyId = choisie ?? (await companyIdForNew(userId));
  if (companyId === null) {
    return { ok: false, error: "Choisissez l'entité (société) du projet : un projet appartient à une société du groupe, et c'est elle qui décide qui le voit." };
  }
  const miennes = await getMyCompanies(userId);
  if (!miennes.some((c) => c.id === companyId)) {
    return { ok: false, error: "Cette entité ne vous est pas ouverte : choisissez l'une de celles que vous voyez (sélecteur d'entité, en haut de l'écran)." };
  }
  return { ok: true, companyId };
}

export async function createBdProject(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "BD_PROJECTS", "CREATE")) return { ok: false, error: REFUS_MODULE("créer") };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom du projet est obligatoire." };
  const statusRaw = fdStr(formData, "status");
  const status = (statusRaw && PROJECT_STATUSES.includes(statusRaw as BdProjectStatus) ? statusRaw : "IDEA") as BdProjectStatus;
  const entite = await entiteDuProjet(user.id, fdStr(formData, "companyId"));
  if (!entite.ok) return entite;

  const created = await prisma.bdProject.create({
    data: {
      name,
      status,
      description: fdStr(formData, "description"),
      comment: fdStr(formData, "comment"),
      companyId: entite.companyId,
      ownerId: user.id,
      createdById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: AUDIT_MODULE,
    entityType: "BD_PROJECT", entityId: created.id, summary: `Projet « ${name} »`,
  });
  revalidatePath(BD_PATH);
  revalidatePath(PROJETS_PATH);
  return { ok: true, id: created.id };
}

export async function updateBdProject(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!(await canAccessEntity(user, "BD_PROJECT", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom du projet est obligatoire." };
  const statusRaw = fdStr(formData, "status");
  const status = (statusRaw && PROJECT_STATUSES.includes(statusRaw as BdProjectStatus) ? statusRaw : undefined) as BdProjectStatus | undefined;
  const avant = await prisma.bdProject.findUnique({ where: { id }, select: { companyId: true } });
  if (!avant) return { ok: false, error: "Projet introuvable." };
  // L'ENTITÉ : un choix EXPLICITE gagne ; sinon le projet GARDE la sienne — corriger un nom ne
  // détache pas un projet de sa société. On ne détache jamais : « chaque projet associé à une
  // société » (§118.163). Un projet d'avant, sans entité, en reçoit une au premier enregistrement.
  const choisie = fdStr(formData, "companyId");
  let companyId = avant.companyId;
  if (choisie !== null && choisie !== avant.companyId) {
    const entite = await entiteDuProjet(user.id, choisie);
    if (!entite.ok) return entite;
    companyId = entite.companyId;
  }

  await prisma.bdProject.update({
    where: { id },
    data: {
      name,
      status,
      description: fdStr(formData, "description"),
      comment: fdStr(formData, "comment"),
      companyId,
      updatedById: user.id,
    },
  });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: AUDIT_MODULE,
    entityType: "BD_PROJECT", entityId: id, summary: `Projet « ${name} » mis à jour`,
  });
  revalidatePath(BD_PATH);
  revalidatePath(PROJETS_PATH);
  revalidatePath(`${BD_PATH}/${id}`);
  return { ok: true, id };
}

/**
 * SUPPRIMER UN PROJET — par la corbeille, avec ce qui en dépend (§118.162, §118.163).
 *
 * C'était un `delete` sec : gammes et produits partaient en cascade, et chaque dossier réglementaire
 * classé perdait son projet — sans instantané, sans retour possible, sans que personne ne le
 * voie avant le clic. La suppression passe désormais par le cœur réversible : le projet, ses gammes
 * et ses produits partent en UN lot, le classement des dossiers est noté, et tout revient ensemble
 * si le Super Admin le restaure. Même chemin que le bouton du Super Admin : deux suppressions du
 * même objet qui ne rendent pas la même chose seraient deux vérités (§118.5).
 */
export async function deleteBdProject(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!userCan(user, "BD_PROJECTS", "DELETE")) return { ok: false, error: REFUS_MODULE("supprimer") };
  if (!(await canAccessEntity(user, "BD_PROJECT", id, "DELETE"))) return { ok: false, error: "Non autorisé." };
  const nom = (await prisma.bdProject.findUnique({ where: { id }, select: { name: true } }))?.name ?? id;
  const r = await supprimerReversible("BD_PROJECT", id, user.id, `Suppression d'un projet — « ${nom} » (restaurable depuis la corbeille)`);
  if (!r.ok) return { ok: false, error: r.error ?? "Suppression impossible." };
  revalidatePath(BD_PATH);
  revalidatePath(PROJETS_PATH);
  revalidatePath("/regulatory");
  return { ok: true, message: "Projet supprimé — restaurable depuis la corbeille, avec ses gammes, ses produits et le classement de ses dossiers." };
}

// ───────────────────────────── Gamme ─────────────────────────────

export async function createBdRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const projectId = fdStr(formData, "projectId");
  const name = fdStr(formData, "name");
  if (!projectId || !name) return { ok: false, error: "Projet et nom de gamme requis." };
  if (!(await canAccessEntity(user, "BD_PROJECT", projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const created = await prisma.bdRange.create({
    data: { projectId, name, comment: fdStr(formData, "comment") },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: AUDIT_MODULE,
    entityType: "BD_PROJECT", entityId: projectId, summary: `Gamme « ${name} » ajoutée`,
  });
  revalidatePath(BD_PATH);
  revalidatePath(`${BD_PATH}/${projectId}`);
  return { ok: true, id: created.id };
}

export async function updateBdRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const name = fdStr(formData, "name");
  if (!id || !name) return { ok: false, error: "Identifiant et nom requis." };
  const range = await prisma.bdRange.findUnique({ where: { id }, select: { projectId: true } });
  if (!range) return { ok: false, error: "Gamme introuvable." };
  if (!(await canAccessEntity(user, "BD_PROJECT", range.projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  await prisma.bdRange.update({ where: { id }, data: { name, comment: fdStr(formData, "comment") } });
  revalidatePath(BD_PATH);
  revalidatePath(`${BD_PATH}/${range.projectId}`);
  return { ok: true };
}

export async function deleteBdRange(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const range = await prisma.bdRange.findUnique({ where: { id }, select: { projectId: true, name: true } });
  if (!range) return { ok: false, error: "Gamme introuvable." };
  if (!(await canAccessEntity(user, "BD_PROJECT", range.projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  await prisma.bdRange.delete({ where: { id } }); // cascade → produits
  await recordAudit({
    actorId: user.id, action: "DELETE", module: AUDIT_MODULE,
    entityType: "BD_PROJECT", entityId: range.projectId, summary: `Gamme « ${range.name} » supprimée`,
  });
  revalidatePath(BD_PATH);
  revalidatePath(`${BD_PATH}/${range.projectId}`);
  return { ok: true };
}

// ───────────────────────────── Produit ─────────────────────────────

function readProductData(formData: FormData): Prisma.BdProductUpdateInput {
  const sourcingRaw = fdStr(formData, "sourcing");
  const sourcing = (sourcingRaw && SOURCINGS.includes(sourcingRaw as BdSourcing) ? sourcingRaw : undefined) as BdSourcing | undefined;
  return {
    brandName: fdStr(formData, "brandName"),
    dosage: fdStr(formData, "dosage"),
    form: fdStr(formData, "form"),
    sourcing,
    marketSizeDzd: fdNum(formData, "marketSizeDzd"),
    marketSizeUsd: fdNum(formData, "marketSizeUsd"),
    unitPrice: fdNum(formData, "unitPrice"),
    totalMarketVolume: fdNum(formData, "totalMarketVolume"),
    competitors: fdStr(formData, "competitors"),
    competitorShares: fdStr(formData, "competitorShares"),
    competitorVolume: fdStr(formData, "competitorVolume"),
    competitorPrice: fdStr(formData, "competitorPrice"),
    investmentY1: fdNum(formData, "investmentY1"),
    investmentY2: fdNum(formData, "investmentY2"),
    investmentY3: fdNum(formData, "investmentY3"),
    revenueY1: fdNum(formData, "revenueY1"),
    revenueY2: fdNum(formData, "revenueY2"),
    revenueY3: fdNum(formData, "revenueY3"),
    comment: fdStr(formData, "comment"),
  };
}

export async function createBdProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const rangeId = fdStr(formData, "rangeId");
  const dci = fdStr(formData, "dci");
  if (!rangeId || !dci) return { ok: false, error: "Gamme et DCI/produit requis." };
  const range = await prisma.bdRange.findUnique({ where: { id: rangeId }, select: { projectId: true } });
  if (!range) return { ok: false, error: "Gamme introuvable." };
  if (!(await canAccessEntity(user, "BD_PROJECT", range.projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const created = await prisma.bdProduct.create({
    data: { ...(readProductData(formData) as Prisma.BdProductCreateInput), dci, range: { connect: { id: rangeId } }, createdById: user.id },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: AUDIT_MODULE,
    entityType: "BD_PROJECT", entityId: range.projectId, summary: `Produit « ${dci} » ajouté`,
  });
  revalidatePath(BD_PATH);
  revalidatePath(`${BD_PATH}/${range.projectId}`);
  return { ok: true, id: created.id };
}

export async function updateBdProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  const dci = fdStr(formData, "dci");
  if (!id || !dci) return { ok: false, error: "Identifiant et DCI requis." };
  const product = await prisma.bdProduct.findUnique({ where: { id }, select: { range: { select: { projectId: true } } } });
  if (!product) return { ok: false, error: "Produit introuvable." };
  if (!(await canAccessEntity(user, "BD_PROJECT", product.range.projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  await prisma.bdProduct.update({ where: { id }, data: { ...readProductData(formData), dci, updatedById: user.id } });
  revalidatePath(BD_PATH);
  revalidatePath(`${BD_PATH}/${product.range.projectId}`);
  return { ok: true };
}

export async function deleteBdProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const product = await prisma.bdProduct.findUnique({ where: { id }, select: { dci: true, range: { select: { projectId: true } } } });
  if (!product) return { ok: false, error: "Produit introuvable." };
  if (!(await canAccessEntity(user, "BD_PROJECT", product.range.projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  await prisma.bdProduct.delete({ where: { id } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: AUDIT_MODULE,
    entityType: "BD_PROJECT", entityId: product.range.projectId, summary: `Produit « ${product.dci} » supprimé`,
  });
  revalidatePath(BD_PATH);
  revalidatePath(`${BD_PATH}/${product.range.projectId}`);
  return { ok: true };
}

/**
 * Édition d'une cellule en place depuis le grand tableau stratégique.
 * `kind` = "project" | "product" ; `field` validé contre une allowlist ; la
 * valeur est typée (texte / décimal / enum) avant écriture. L'accès est vérifié
 * côté serveur via le projet parent — impossible d'éditer un projet hors scope.
 */
export async function updateBdCell(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const kind = fdStr(formData, "kind");
  const id = fdStr(formData, "id");
  const field = fdStr(formData, "field");
  const raw = formData.get("value");
  const value = raw === null ? "" : String(raw).trim();
  if (!id || !field) return { ok: false, error: "Paramètres manquants." };

  if (kind === "project") {
    if (!(await canAccessEntity(user, "BD_PROJECT", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
    if (field === "status") {
      if (!PROJECT_STATUSES.includes(value as BdProjectStatus)) return { ok: false, error: "Statut invalide." };
      const before = await prisma.bdProject.findUnique({ where: { id }, select: { status: true, name: true } });
      await prisma.bdProject.update({ where: { id }, data: { status: value as BdProjectStatus, updatedById: user.id } });
      await recordAudit({
        actorId: user.id, action: "UPDATE", module: AUDIT_MODULE, entityType: "BD_PROJECT", entityId: id,
        field: "status", oldValue: before?.status, newValue: value, summary: `Statut projet : ${before?.name ?? id}`,
      });
    } else if (PROJECT_TEXT.has(field)) {
      if (field === "name" && !value) return { ok: false, error: "Le nom est obligatoire." };
      await prisma.bdProject.update({ where: { id }, data: { [field]: value || null, updatedById: user.id } });
    } else {
      return { ok: false, error: "Champ non éditable." };
    }
    revalidatePath(BD_PATH);
    revalidatePath(`${BD_PATH}/${id}`);
    return { ok: true };
  }

  if (kind === "product") {
    const product = await prisma.bdProduct.findUnique({ where: { id }, select: { range: { select: { projectId: true } } } });
    if (!product) return { ok: false, error: "Produit introuvable." };
    if (!(await canAccessEntity(user, "BD_PROJECT", product.range.projectId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

    let data: Prisma.BdProductUpdateInput;
    if (field === "sourcing") {
      if (!SOURCINGS.includes(value as BdSourcing)) return { ok: false, error: "Valeur invalide." };
      data = { sourcing: value as BdSourcing };
    } else if (PRODUCT_DECIMAL.has(field)) {
      const n = value === "" ? null : Number(value.replace(/\s/g, "").replace(",", "."));
      if (n !== null && Number.isNaN(n)) return { ok: false, error: "Nombre invalide." };
      data = { [field]: n };
    } else if (PRODUCT_TEXT.has(field)) {
      if (field === "dci" && !value) return { ok: false, error: "Le DCI est obligatoire." };
      data = { [field]: value || null };
    } else {
      return { ok: false, error: "Champ non éditable." };
    }
    await prisma.bdProduct.update({ where: { id }, data: { ...data, updatedById: user.id } });
    revalidatePath(BD_PATH);
    revalidatePath(`${BD_PATH}/${product.range.projectId}`);
    return { ok: true };
  }

  return { ok: false, error: "Type d'entité inconnu." };
}

export async function addBdProjectComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const projectId = fdStr(formData, "projectId");
  const body = fdStr(formData, "body");
  if (!projectId || !body) return { ok: false, error: "Commentaire vide." };
  if (!(await canAccessEntity(user, "BD_PROJECT", projectId, "VIEW"))) return { ok: false, error: "Non autorisé." };
  await prisma.comment.create({ data: { entityType: "BD_PROJECT", entityId: projectId, body, authorId: user.id } });
  revalidatePath(`${BD_PATH}/${projectId}`);
  return { ok: true };
}
