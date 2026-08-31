"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { monthLabel, canEditRep } from "@/lib/sfe";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const MODULE = "SALES_PLANNING" as const;
const PATH = "/planning";
/** L'écran où se monte une force de vente : une BU, son superviseur, ses KAM, ses produits. */
const BU_PATH = "/planning/business-units";

function num(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Canal produit (Ville / Hôpital / les deux) — défaut BOTH si non renseigné. */
function parseChannel(v: string | null): "RETAIL" | "HOSPITAL" | "BOTH" {
  return v === "RETAIL" || v === "HOSPITAL" || v === "BOTH" ? v : "BOTH";
}

/** Récupère (ou crée) le cycle mensuel donné. */
export async function ensureCycle(year: number, month: number): Promise<{ id: string } | null> {
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  const existing = await prisma.promoCycle.findUnique({ where: { year_month: { year, month } }, select: { id: true } });
  if (existing) return existing;
  return prisma.promoCycle.create({ data: { year, month, label: monthLabel(year, month) }, select: { id: true } });
}

// ─────────────────────────── Business Units (franchises) ───────────────────────────
export async function createBusinessUnit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de la BU est obligatoire." };
  const created = await prisma.businessUnit.create({
    data: {
      name,
      code: fdStr(formData, "code") ?? undefined,
      color: fdStr(formData, "color") ?? undefined,
      companyId: fdStr(formData, "companyId") || null,
      headId: fdStr(formData, "headId") || null,
      // LES DEUX RÉPONSES QU'ON DONNE EN CRÉANT UNE BU : qui la supervise, et sur quel terrain
      // elle opère. Les demander plus tard, c'est les laisser vides.
      supervisorId: fdStr(formData, "supervisorId") || null,
      channel: parseChannel(fdStr(formData, "channel")),
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Force de vente", summary: `BU « ${name} »` });
  revalidatePath(BU_PATH);
  return { ok: true, id: created.id };
}

export async function updateBusinessUnit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "BU introuvable." };
  await prisma.businessUnit.update({
    where: { id },
    data: {
      name: fdStr(formData, "name") ?? undefined,
      code: fdStr(formData, "code"),
      color: fdStr(formData, "color"),
      companyId: fdStr(formData, "companyId") || null,
      headId: fdStr(formData, "headId") || null,
      supervisorId: fdStr(formData, "supervisorId") || null,
      ...(formData.has("channel") ? { channel: parseChannel(fdStr(formData, "channel")) } : {}),
      isActive: formData.get("isActive") === null ? undefined : formData.get("isActive") === "on",
    },
  });
  revalidatePath(BU_PATH);
  return { ok: true };
}

export async function deleteBusinessUnit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "BU introuvable." };
  const bu = await prisma.businessUnit.findUnique({
    where: { id },
    select: { name: true, _count: { select: { products: true, reps: true } } },
  });
  if (!bu) return { ok: false, error: "BU introuvable." };
  // ON REFUSE PLUTÔT QUE DE DÉTACHER EN SILENCE. Supprimer une BU qui porte encore des KAM et
  // des produits les laisserait orphelins — sans superviseur, sans canal, invisibles au cockpit,
  // et sans que personne ait vu passer la perte.
  if (bu._count.reps > 0 || bu._count.products > 0) {
    const quoi = [
      bu._count.reps > 0 ? `${bu._count.reps} KAM` : null,
      bu._count.products > 0 ? `${bu._count.products} produit(s)` : null,
    ].filter(Boolean).join(" et ");
    return { ok: false, error: `La BU « ${bu.name} » porte encore ${quoi}. Déplacez-les d'abord, ou désactivez la BU.` };
  }
  await prisma.businessUnit.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Force de vente", summary: `BU « ${bu.name} » supprimée` });
  revalidatePath(BU_PATH);
  return { ok: true };
}

// ─────────────────────────── Produits promus ───────────────────────────
export async function createPromoProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "CREATE")) return { ok: false, error: "Non autorisé." };
  const businessUnitId = fdStr(formData, "businessUnitId") || null;

  // LE PRODUIT PROMU VIENT DU DOSSIER RÉGLEMENTAIRE. Le saisir au clavier créait un second
  // référentiel de produits, qui divergeait du premier au premier changement de nom — et rendait
  // impossible de remonter du terrain au dossier. On reprend donc le nom et la référence du
  // dossier ; le nom reste modifiable ensuite (une marque commerciale n'est pas une DCI).
  const regulatoryProductId = fdStr(formData, "regulatoryProductId");
  let name = fdStr(formData, "name");
  let code = fdStr(formData, "code");
  if (regulatoryProductId) {
    const dossier = await prisma.regulatoryProduct.findUnique({
      where: { id: regulatoryProductId },
      select: { reference: true, dci: true, brandName: true },
    });
    if (!dossier) return { ok: false, error: "Ce dossier Regulatory n'existe pas." };
    name = name || dossier.brandName || dossier.dci;
    code = code || dossier.reference;
  }
  if (!name) return { ok: false, error: "Choisissez un dossier Regulatory, ou donnez un nom de produit." };

  // LE CANAL SUIT LA BU quand le formulaire ne le dit pas : c'est la franchise qui décide du
  // terrain, et redemander la même réponse à chaque produit est le genre de saisie qu'on ne fait
  // qu'une fois — mal.
  let channel = parseChannel(fdStr(formData, "channel"));
  if (!formData.has("channel") && businessUnitId) {
    const bu = await prisma.businessUnit.findUnique({ where: { id: businessUnitId }, select: { channel: true } });
    if (bu) channel = bu.channel;
  }

  await prisma.promoProduct.create({
    data: {
      name, code: code ?? undefined, channel, businessUnitId,
      managerId: fdStr(formData, "managerId") || null,
      regulatoryProductId: regulatoryProductId || null,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Force de vente", summary: `Produit « ${name} »${regulatoryProductId ? " (depuis son dossier Regulatory)" : ""}` });
  revalidatePath(BU_PATH);
  return { ok: true };
}

export async function updatePromoProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Produit introuvable." };
  await prisma.promoProduct.update({
    where: { id },
    data: {
      name: fdStr(formData, "name") ?? undefined,
      code: fdStr(formData, "code"),
      channel: parseChannel(fdStr(formData, "channel")),
      businessUnitId: fdStr(formData, "businessUnitId") || null,
      managerId: fdStr(formData, "managerId") || null,
      isActive: formData.get("isActive") === null ? undefined : formData.get("isActive") === "on",
    },
  });
  revalidatePath(BU_PATH);
  return { ok: true };
}

export async function deletePromoProduct(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "DELETE")) return { ok: false, error: "Non autorisé." };
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Produit introuvable." };
  await prisma.promoProduct.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Force de vente", summary: "Produit supprimé" });
  revalidatePath(BU_PATH);
  return { ok: true };
}

// ─────────────────────────── Prévision par produit ───────────────────────────
export async function saveForecast(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const cycleId = fdStr(formData, "cycleId");
  const productId = fdStr(formData, "productId");
  if (!cycleId || !productId) return { ok: false, error: "Paramètres manquants." };
  const data = {
    targetFte: num(formData, "targetFte") ?? 0,
    coverageTargetPct: num(formData, "coverageTargetPct"),
    plannedVisits: num(formData, "plannedVisits"),
    budget: num(formData, "budget"),
    note: fdStr(formData, "note"),
    updatedById: user.id,
  };
  await prisma.productForecast.upsert({
    where: { cycleId_productId: { cycleId, productId } },
    create: { cycleId, productId, ...data },
    update: data,
  });
  revalidatePath(PATH);
  return { ok: true };
}

// ─────────────────────────── Paramètres SFE (100% configurables) ───────────────────────────
export async function saveSfeSettings(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const positionWeights: Record<string, number> = {
    "1": num(formData, "p1") ?? 1, "2": num(formData, "p2") ?? 0.5, "3": num(formData, "p3") ?? 0.25,
  };
  const capacity = {
    daysPerMonth: num(formData, "daysPerMonth") ?? 20,
    visitsPerDay: num(formData, "visitsPerDay") ?? 7,
    fieldPct: num(formData, "fieldPct") ?? 80,
  };
  const frequencyByTier: Record<string, number> = {
    VERY_HIGH: num(formData, "freq_VERY_HIGH") ?? 3,
    HIGH: num(formData, "freq_HIGH") ?? 2,
    MEDIUM: num(formData, "freq_MEDIUM") ?? 1,
    LOW: num(formData, "freq_LOW") ?? 1,
    VERY_LOW: num(formData, "freq_VERY_LOW") ?? 0,
  };
  await prisma.sfeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", positionWeights, capacity, frequencyByTier, updatedById: user.id },
    update: { positionWeights, capacity, frequencyByTier, updatedById: user.id },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Force de vente", summary: "Paramètres SFE mis à jour" });
  revalidatePath(`${PATH}/parametres`);
  return { ok: true };
}

// ─────────────────────────── Profil KAM (configuration individuelle) ───────────────────────────
export async function saveRepProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const repId = fdStr(formData, "repId");
  if (!repId) return { ok: false, error: "KAM introuvable." };
  const data = {
    businessUnitId: fdStr(formData, "businessUnitId") || null,
    region: fdStr(formData, "region"),
    capDaysPerMonth: num(formData, "capDaysPerMonth") != null ? Math.round(num(formData, "capDaysPerMonth")!) : null,
    capVisitsPerDay: num(formData, "capVisitsPerDay") != null ? Math.round(num(formData, "capVisitsPerDay")!) : null,
    capFieldPct: num(formData, "capFieldPct") != null ? Math.round(num(formData, "capFieldPct")!) : null,
    fteBudget: num(formData, "fteBudget") ?? 1,
    seniority: fdStr(formData, "seniority"),
    isActive: formData.get("isActive") !== "off",
    note: fdStr(formData, "note"),
  };
  await prisma.salesRepProfile.upsert({
    where: { repId },
    create: { repId, ...data },
    update: data,
  });
  revalidatePath(BU_PATH);
  return { ok: true };
}

export async function deleteRepProfile(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const repId = fdStr(formData, "repId");
  if (!repId) return { ok: false, error: "KAM introuvable." };
  await prisma.salesRepProfile.deleteMany({ where: { repId } });
  revalidatePath(BU_PATH);
  return { ok: true };
}

// ─────────────────────────── Affectations (matrice KAM × produit) ───────────────────────────
export async function saveAssignment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const cycleId = fdStr(formData, "cycleId");
  const repId = fdStr(formData, "repId");
  const productId = fdStr(formData, "productId");
  if (!cycleId || !repId || !productId) return { ok: false, error: "Paramètres manquants." };
  if (!(await canEditRep(user, repId))) return { ok: false, error: "Non autorisé sur ce KAM." };
  const position = Math.min(3, Math.max(1, Math.round(num(formData, "position") ?? 1)));
  const plannedVisits = Math.max(0, Math.round(num(formData, "plannedVisits") ?? 0));
  const note = fdStr(formData, "note");
  // Une affectation à 0 visite sans note est retirée (nettoyage de la matrice).
  if (plannedVisits === 0 && !note) {
    await prisma.promotionAssignment.deleteMany({ where: { cycleId, repId, productId } });
    revalidatePath(`${PATH}/affectations`);
    return { ok: true };
  }
  const data = { position, plannedVisits, note, updatedById: user.id };
  await prisma.promotionAssignment.upsert({
    where: { cycleId_repId_productId: { cycleId, repId, productId } },
    create: { cycleId, repId, productId, ...data },
    update: data,
  });
  revalidatePath(`${PATH}/affectations`);
  return { ok: true };
}

export async function deleteAssignment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const repId = fdStr(formData, "repId");
  const cycleId = fdStr(formData, "cycleId");
  const productId = fdStr(formData, "productId");
  if (!cycleId || !repId || !productId) return { ok: false, error: "Paramètres manquants." };
  if (!(await canEditRep(user, repId))) return { ok: false, error: "Non autorisé sur ce KAM." };
  await prisma.promotionAssignment.deleteMany({ where: { cycleId, repId, productId } });
  revalidatePath(`${PATH}/affectations`);
  return { ok: true };
}

/** Duplique les affectations d'un cycle précédent vers le cycle courant (KAM sous ma portée). */
export async function carryForwardAssignments(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, MODULE, "UPDATE")) return { ok: false, error: "Non autorisé." };
  const toCycleId = fdStr(formData, "toCycleId");
  const fromYear = num(formData, "fromYear");
  const fromMonth = num(formData, "fromMonth");
  if (!toCycleId || fromYear == null || fromMonth == null) return { ok: false, error: "Paramètres manquants." };
  const from = await prisma.promoCycle.findUnique({ where: { year_month: { year: Math.round(fromYear), month: Math.round(fromMonth) } }, select: { id: true } });
  if (!from) return { ok: false, error: "Aucun cycle source trouvé." };
  const src = await prisma.promotionAssignment.findMany({ where: { cycleId: from.id } });
  let copied = 0;
  for (const a of src) {
    await prisma.promotionAssignment.upsert({
      where: { cycleId_repId_productId: { cycleId: toCycleId, repId: a.repId, productId: a.productId } },
      create: { cycleId: toCycleId, repId: a.repId, productId: a.productId, position: a.position, plannedVisits: a.plannedVisits, note: a.note, updatedById: user.id },
      update: {},
    });
    copied++;
  }
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Force de vente", summary: `Report de ${copied} affectation(s)` });
  revalidatePath(`${PATH}/affectations`);
  return { ok: true };
}
