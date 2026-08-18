"use server";

import { randomUUID } from "crypto";
import { effectiveTherapeuticSegments } from "@/lib/labels";
import { revalidatePath } from "next/cache";
import type { Priority, ProductChannel, ProductType, RegulatoryCategory, RegulatoryStatus, StepStatus, ManufacturingStatus, VariationStatus, UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, isRegulatorySupervisor } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { buildRef } from "@/lib/refs";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createExpenseOrder } from "@/lib/expense-orders";
import { saveFile, validateUpload } from "@/lib/storage";
import { getAppSettings } from "@/lib/settings";
import { REGULATORY_STEP_ORDER, LOCAL_MANUFACTURING_VARIATIONS, VARIATION_TARGETS } from "@/lib/labels";
import {
  isRegStepKey, isRegStepState, isRegChecklistKey, isRegPresubOutcome,
  REG_STEPS, REG_CHECKLIST, REG_PRESUB_OUTCOME, PRESUB_ANSWER_STEP,
  REG_STATUS_MILESTONE, completeStepsThrough,
  type RegWorkflowState, type RegChecklistState,
} from "@/lib/regulatory-workflow";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return v ? String(v) : null;
}

/** Canal produit (Ville / Hôpital / les deux). undefined si absent → laisse la valeur en place. */
function parseProductChannel(v: string | null): ProductChannel | undefined {
  return v === "RETAIL" || v === "HOSPITAL" || v === "BOTH" ? v : undefined;
}

/** Uniformise la casse des DCI : MAJUSCULES, espaces normalisés autour des « + ». */
function normalizeDci(value: string): string {
  return value.trim().toUpperCase().replace(/\s*\+\s*/g, " + ").replace(/\s+/g, " ");
}
const upperMolecules = (list: string[]): string[] => list.map((m) => m.trim().toUpperCase()).filter(Boolean);

/** Rôles superviseurs Regulatory = Super Admin (toujours) + rôles configurés en Administration. */
async function regSupervisorRoles(): Promise<UserRole[]> {
  const settings = await getAppSettings();
  return Array.from(new Set(["SUPER_ADMIN", ...settings.regulatorySupervisorRoles])) as UserRole[];
}

/** L'utilisateur courant est-il superviseur Regulatory (fixe priorité/dates, demande des MàJ) ? */
async function ensureRegSupervisor(user: Awaited<ReturnType<typeof requireUser>>): Promise<boolean> {
  const settings = await getAppSettings();
  return isRegulatorySupervisor(user, settings.regulatorySupervisorRoles);
}

/**
 * Création d'un fournisseur depuis le module Regulatory (par les Responsables
 * réglementaires). Le fournisseur alimente le menu déroulant des dossiers. Aucun
 * compte de portail n'est créé ici — l'accès externe reste piloté à part.
 */
export async function createRegulatorySupplier(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "CREATE")) return { ok: false, error: "Création non autorisée." };
  const name = str(formData, "name");
  if (!name) return { ok: false, error: "Le nom du fournisseur est obligatoire." };
  const created = await prisma.supplier.create({
    data: {
      name,
      country: str(formData, "country"),
      contactEmail: str(formData, "contactEmail"),
      notes: str(formData, "notes"),
      createdById: user.id,
    },
    select: { id: true },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Regulatory", entityType: "SUPPLIER", entityId: created.id, summary: `Fournisseur « ${name} »` });
  revalidatePath("/regulatory");
  return { ok: true, id: created.id };
}

export async function createRegulatoryProduct(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!userCan(user, "REGULATORY", "CREATE")) {
    return { ok: false, error: "Création non autorisée." };
  }

  // DCI : molécule unique OU association (double/triple…). Le formulaire envoie une
  // ou plusieurs entrées « molecule » ; la DCI canonique est leur concaténation.
  // Casse uniformisée en MAJUSCULES pour tout le référentiel.
  const molecules = upperMolecules(formData.getAll("molecule").map((m) => String(m)));
  const rawDci = molecules.length ? molecules.join(" + ") : str(formData, "dci");
  if (!rawDci) return { ok: false, error: "La DCI est obligatoire." };
  const dci = normalizeDci(rawDci);

  // L'ENTITÉ est obligatoire : c'est elle qui détermine qui a le droit de voir ce dossier. Un
  // produit sans entité apparaît dans la vue « toutes les entités » de TOUT LE MONDE — la
  // laisser facultative revenait à publier le dossier au groupe entier par défaut.
  const companyId = str(formData, "companyId");
  if (!companyId) return { ok: false, error: "L'entité est obligatoire : elle détermine qui verra ce dossier." };
  const okCompany = await prisma.company.count({ where: { id: companyId, isActive: true } });
  if (!okCompany) return { ok: false, error: "Entité inconnue ou désactivée." };

  const year = new Date().getFullYear();
  const refs = await prisma.regulatoryProduct.findMany({
    where: { reference: { startsWith: `REG-${year}-` } },
    select: { reference: true },
  });
  const reference = buildRef("REG", year, refs.map((r) => r.reference));

  const responsibleId = str(formData, "responsibleId");
  const assistantId = str(formData, "assistantId");
  const targetDateRaw = str(formData, "targetDate");
  const targetSubmissionDateRaw = str(formData, "targetSubmissionDate");

  // Variation d'enregistrement : une fabrication locale exige le fabricant.
  const manufacturingVariation = str(formData, "manufacturingVariation");
  const manufacturer = str(formData, "manufacturer");
  if (manufacturingVariation && LOCAL_MANUFACTURING_VARIATIONS.includes(manufacturingVariation) && !manufacturer) {
    return { ok: false, error: "Le Fabricant est obligatoire pour une fabrication locale (packaging secondaire, primaire ou full process)." };
  }
  const variationDateRaw = str(formData, "variationDate");

  // Connect responsible + assistant as assigned users so row-level scope works.
  const assignIds = Array.from(new Set([responsibleId, assistantId].filter(Boolean))) as string[];

  // CRÉÉ DIRECTEMENT DANS LE PIPELINE. Le formulaire du pipeline envoie `lock=1` : le dossier
  // naît verrouillé, donc à l'étude, invisible de l'équipe tant que le cadenas n'est pas ouvert.
  // Le droit reste celui du cadenas — le Super Admin, et lui seul : sans cette garde, n'importe
  // qui pourrait créer un dossier que personne d'autre ne verrait.
  const lockOnCreate = str(formData, "lock") === "1" && user.role === "SUPER_ADMIN";

  const product = await prisma.regulatoryProduct.create({
    data: {
      reference,
      dci,
      molecules: molecules.length > 1 ? (molecules as unknown as Prisma.InputJsonValue) : undefined,
      brandName: str(formData, "brandName"),
      dosage: str(formData, "dosage"),
      dosageUnit: str(formData, "dosageUnit"),
      pharmaceuticalForm: str(formData, "pharmaceuticalForm"),
      packaging: str(formData, "packaging"),
      therapeuticClass: str(formData, "therapeuticClass"),
      partnerLab: str(formData, "partnerLab"),
      supplierId: str(formData, "supplierId"),
      countryOfOrigin: str(formData, "countryOfOrigin"),
      category: (str(formData, "category") as RegulatoryCategory) ?? "MEDICINE",
      channel: parseProductChannel(str(formData, "channel")) ?? "BOTH",
      productType: (str(formData, "productType") as ProductType) ?? "IMPORTED",
      manufacturingStatus: (str(formData, "manufacturingStatus") as ManufacturingStatus) ?? "IMPORTATION",
      status: (str(formData, "status") as RegulatoryStatus) ?? "PRE_SUBMISSION",
      priority: (str(formData, "priority") as Priority) ?? "MEDIUM",
      companyId,
      isLocked: lockOnCreate,
      targetSubmissionDate: targetSubmissionDateRaw ? new Date(targetSubmissionDateRaw) : null,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      comments: str(formData, "comments"),
      deHolder: str(formData, "deHolder"),
      manufacturingVariation: manufacturingVariation === "NONE" ? null : manufacturingVariation,
      manufacturer,
      variationDate: variationDateRaw ? new Date(variationDateRaw) : null,
      responsibleId,
      assistantId,
      createdById: user.id,
      updatedById: user.id,
      assignedUsers: assignIds.length ? { connect: assignIds.map((id) => ({ id })) } : undefined,
      // Seed the configurable 17-step regulatory workflow.
      steps: {
        create: REGULATORY_STEP_ORDER.map((type, idx) => ({
          type: type as never,
          order: idx + 1,
          status: "NOT_STARTED" as StepStatus,
        })),
      },
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "CREATE",
    module: "Regulatory",
    entityType: "REGULATORY_PRODUCT",
    entityId: product.id,
    summary: `Nouveau dossier ${reference} — ${dci}${lockOnCreate ? " (créé verrouillé, dans le pipeline)" : ""}`,
  });

  // UN DOSSIER VERROUILLÉ NE PRÉVIENT PERSONNE. Il n'existe que pour le Super Admin
  // (`lockGate`) : annoncer sa création à l'équipe reviendrait à lui envoyer un lien qui
  // s'ouvre sur un 404, tout en révélant qu'un dossier confidentiel vient d'entrer. Les
  // notifications reprennent à l'ouverture du cadenas, quand le dossier devient un travail.
  if (!lockOnCreate) {
    if (assistantId && assistantId !== user.id) {
      await notifyUser({
        userId: assistantId,
        type: "ASSIGNMENT",
        title: "Nouveau dossier assigné",
        body: `${reference} — ${dci}`,
        link: `/regulatory/${product.id}`,
      });
    }

    // Supervision : prévenir les superviseurs Regulatory (Super Admin + rôles configurés)
    // qu'un nouveau dossier attend une priorité et une date cible de dépôt.
    await notifyRoles(await regSupervisorRoles(), {
      type: "GENERIC",
      title: "Nouveau dossier Regulatory à prioriser",
      body: `${reference} — ${dci} · définir la priorité et la date cible de dépôt.`,
      link: `/regulatory/${product.id}`,
    });
  }

  revalidatePath("/regulatory");
  // Le pipeline est l'écran des dossiers verrouillés : un dossier qui y naît doit s'y voir
  // tout de suite, sans attendre l'expiration du cache de navigation.
  revalidatePath("/regulatory/pipeline");
  return { ok: true, id: product.id };
}

/**
 * Modifie les informations descriptives d'un dossier réglementaire (DCI, marque,
 * dosage, classe, laboratoire, pays, type, responsables…). La casse des DCI est
 * uniformisée en MAJUSCULES. Le statut/priorité ont leur propre action dédiée mais
 * sont aussi acceptés ici pour une édition complète depuis la fiche.
 */
export async function updateRegulatoryProduct(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }
  const before = await prisma.regulatoryProduct.findUnique({ where: { id }, include: { assignedUsers: { select: { id: true } } } });
  if (!before) return { ok: false, error: "Dossier introuvable." };

  // DCI : recompose depuis les molécules saisies, sinon depuis le champ libre.
  const molecules = upperMolecules(formData.getAll("molecule").map((m) => String(m)));
  const rawDci = molecules.length ? molecules.join(" + ") : str(formData, "dci");
  if (!rawDci) return { ok: false, error: "La DCI est obligatoire." };
  const dci = normalizeDci(rawDci);

  const responsibleId = str(formData, "responsibleId");
  const assistantId = str(formData, "assistantId");
  const targetDateRaw = str(formData, "targetDate");
  const targetSubmissionDateRaw = str(formData, "targetSubmissionDate");
  // Préserve les participants déjà rattachés (collaboration) + garantit l'accès du
  // responsable et de l'assistant. La modification d'un dossier ne doit JAMAIS retirer
  // les collaborateurs ajoutés via le panneau « Participants ».
  const assignIds = Array.from(new Set([...before.assignedUsers.map((u) => u.id), responsibleId, assistantId].filter(Boolean))) as string[];

  // Fabricant courant (les variations de fabrication ont leur propre cycle de vie).
  const manufacturer = str(formData, "manufacturer");

  // L'ENTITÉ est obligatoire : c'est elle qui détermine qui a le droit de voir ce dossier.
  // Un produit sans entité apparaît dans la vue « toutes les entités » de TOUT LE MONDE — la
  // rendre facultative revenait à publier le dossier au groupe entier par défaut.
  // On tolère un dossier ancien qui n'en a pas encore, tant qu'on ne cherche pas à la retirer.
  const rawCompanyId = str(formData, "companyId");
  if (formData.has("companyId") && !rawCompanyId && before.companyId) {
    return { ok: false, error: "L'entité est obligatoire : un dossier ne peut pas être détaché de son entité." };
  }
  const updatedCompanyId = rawCompanyId || before.companyId;
  if (rawCompanyId) {
    const okCompany = await prisma.company.count({ where: { id: rawCompanyId, isActive: true } });
    if (!okCompany) return { ok: false, error: "Entité inconnue ou désactivée." };
  }

  await prisma.regulatoryProduct.update({
    where: { id },
    data: {
      dci,
      molecules: molecules.length > 1 ? (molecules as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      brandName: str(formData, "brandName"),
      dosage: str(formData, "dosage"),
      dosageUnit: str(formData, "dosageUnit"),
      pharmaceuticalForm: str(formData, "pharmaceuticalForm"),
      packaging: str(formData, "packaging"),
      therapeuticClass: str(formData, "therapeuticClass"),
      partnerLab: str(formData, "partnerLab"),
      supplierId: str(formData, "supplierId"),
      countryOfOrigin: str(formData, "countryOfOrigin"),
      companyId: updatedCompanyId,
      category: (str(formData, "category") as RegulatoryCategory) ?? before.category,
      channel: parseProductChannel(str(formData, "channel")) ?? before.channel,
      productType: (str(formData, "productType") as ProductType) ?? before.productType,
      manufacturingStatus: (str(formData, "manufacturingStatus") as ManufacturingStatus) ?? before.manufacturingStatus,
      status: (str(formData, "status") as RegulatoryStatus) ?? before.status,
      priority: (str(formData, "priority") as Priority) ?? before.priority,
      targetSubmissionDate: targetSubmissionDateRaw ? new Date(targetSubmissionDateRaw) : null,
      targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
      comments: str(formData, "comments"),
      deHolder: str(formData, "deHolder"),
      manufacturer,
      responsibleId,
      assistantId,
      updatedById: user.id,
      assignedUsers: assignIds.length ? { set: assignIds.map((aid) => ({ id: aid })) } : { set: [] },
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Regulatory",
    entityType: "REGULATORY_PRODUCT",
    entityId: id,
    summary: `Dossier ${before.reference} modifié — ${dci}`,
  });

  if (assistantId && assistantId !== user.id && assistantId !== before.assistantId) {
    await notifyUser({
      userId: assistantId,
      type: "ASSIGNMENT",
      title: "Dossier réglementaire assigné",
      body: `${before.reference} — ${dci}`,
      link: `/regulatory/${id}`,
    });
  }

  revalidatePath(`/regulatory/${id}`);
  revalidatePath("/regulatory");
  return { ok: true, id };
}

/**
 * Participants du dossier : collaborateurs qui peuvent VOIR et travailler le dossier
 * (accès ligne via `assignedUsers`, cf. scopeRegulatory). Le responsable et l'assistant
 * y sont toujours inclus. Ouvre la collaboration à plusieurs, dossiers actuels ET nouveaux.
 */
export async function setRegulatoryParticipants(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  const product = await prisma.regulatoryProduct.findUnique({ where: { id }, select: { responsibleId: true, assistantId: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };
  const participantIds = formData.getAll("participantIds").map(String).filter(Boolean);
  const ids = Array.from(new Set([product.responsibleId, product.assistantId, ...participantIds].filter(Boolean))) as string[];
  await prisma.regulatoryProduct.update({ where: { id }, data: { assignedUsers: { set: ids.map((uid) => ({ id: uid })) } } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, summary: `Participants du dossier — ${ids.length} collaborateur(s)` });
  revalidatePath(`/regulatory/${id}`);
  return { ok: true };
}

/** Modifier la priorité d'un dossier (Direction / équipe Regulatory) depuis le tableau. */
/** La priorité est fixée par la SUPERVISION (Super Admin + rôles configurés en Administration). */
export async function setRegulatoryPriority(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  const priority = str(formData, "priority");
  if (!id || !priority) return { ok: false, error: "Paramètres manquants." };
  if (!(await ensureRegSupervisor(user))) return { ok: false, error: "Réservé à la supervision Regulatory." };
  await prisma.regulatoryProduct.update({ where: { id }, data: { priority: priority as Priority } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, field: "priority", newValue: priority, summary: "Priorité du dossier modifiée" });
  revalidatePath("/regulatory");
  revalidatePath(`/regulatory/${id}`);
  return { ok: true };
}

/**
 * VERROUILLER / DÉVERROUILLER un dossier — le cadenas, réservé au SUPER ADMIN.
 *
 * Un dossier verrouillé n'existe pour personne d'autre : ni la Direction, ni son responsable,
 * ni une autorisation nominative ne l'ouvrent (`scopeRegulatory` → `lockGate`). C'est ce qui
 * permet de charger un portefeuille encore confidentiel dans l'outil sans le publier à l'équipe.
 *
 * Le droit se vérifie sur le RÔLE et non sur le module : « qui peut modifier un dossier » est
 * une question plus large que « qui décide de ce qui est confidentiel ».
 */
export async function setRegulatoryLock(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul le Super Admin ouvre ou ferme le cadenas." };
  }
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  const locked = str(formData, "locked") === "1";
  const before = await prisma.regulatoryProduct.findUnique({ where: { id }, select: { reference: true, dci: true, isLocked: true } });
  if (!before) return { ok: false, error: "Dossier introuvable." };
  if (before.isLocked === locked) return { ok: true, id };

  await prisma.regulatoryProduct.update({ where: { id }, data: { isLocked: locked, updatedById: user.id } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT",
    entityId: id, field: "isLocked", newValue: locked ? "true" : "false",
    summary: `${before.reference} — dossier ${locked ? "verrouillé (invisible pour l'équipe)" : "déverrouillé (visible par l'équipe)"}`,
  });
  revalidatePath("/regulatory");
  revalidatePath(`/regulatory/${id}`);
  // LE PIPELINE AUSSI — c'est l'écran d'où l'on déverrouille, et le seul dont le contenu CHANGE
  // du fait de ce geste. Sans cette ligne, le dossier ouvert restait affiché parmi les verrouillés
  // jusqu'à expiration du cache de navigation : on croyait que le déverrouillage n'avait rien fait.
  revalidatePath("/regulatory/pipeline");
  return { ok: true, id };
}

/**
 * OUVRIR LE CADENAS SUR TOUT ce qui est verrouillé — un portefeuille se publie d'un geste, pas
 * ligne par ligne sur 69 dossiers. Réservé au Super Admin, audité avec le nombre réel de
 * dossiers ouverts : rendre visible un portefeuille entier est une décision.
 *
 * Volontairement à SENS UNIQUE. Un « tout verrouiller » symétrique ferait disparaître le
 * catalogue Regulatory entier pour toute l'entreprise d'un seul clic — le verrouillage se
 * décide donc dossier par dossier, où l'on voit ce que l'on ferme.
 */
export async function unlockAllRegulatory(): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Seul le Super Admin ouvre ou ferme le cadenas." };
  }
  const res = await prisma.regulatoryProduct.updateMany({
    where: { isLocked: true },
    data: { isLocked: false, updatedById: user.id },
  });
  if (res.count === 0) return { ok: true };
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT",
    entityId: "*", field: "isLocked", newValue: "false",
    summary: `${res.count} dossier(s) déverrouillés en une fois — désormais visibles par l'équipe`,
  });
  revalidatePath("/regulatory");
  // Le pipeline se vide d'un coup : c'est précisément ce qu'on doit voir après ce bouton.
  revalidatePath("/regulatory/pipeline");
  return { ok: true };
}

/**
 * LA PERSONNE CHARGÉE DU DOSSIER, choisie directement dans le tableau Regulatory.
 *
 * Assigner, c'est aussi DONNER L'ACCÈS : `scopeRegulatory` filtre les dossiers sur les
 * participants, donc le nouveau responsable est rattaché aux participants — sans quoi il
 * porterait un dossier qu'il ne verrait pas. L'ancien responsable, lui, n'est pas retiré :
 * il a travaillé dessus, et lui couper la vue en cours de route ferait perdre l'historique
 * à la seule personne qui le connaît. Le panneau « Participants » reste le lieu du retrait.
 *
 * Un choix vide libère le dossier — c'est une décision valable (personne n'est encore désigné).
 */
export async function setRegulatoryResponsible(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }
  const before = await prisma.regulatoryProduct.findUnique({
    where: { id },
    select: { reference: true, dci: true, responsibleId: true },
  });
  if (!before) return { ok: false, error: "Dossier introuvable." };

  const responsibleId = str(formData, "responsibleId");
  if (responsibleId) {
    const ok = await prisma.user.count({ where: { id: responsibleId, isActive: true } });
    if (!ok) return { ok: false, error: "Personne inconnue ou compte désactivé." };
  }
  if (responsibleId === before.responsibleId) return { ok: true, id };

  await prisma.regulatoryProduct.update({
    where: { id },
    data: {
      responsibleId,
      updatedById: user.id,
      ...(responsibleId ? { assignedUsers: { connect: { id: responsibleId } } } : {}),
    },
  });

  const named = responsibleId
    ? (await prisma.user.findUnique({ where: { id: responsibleId }, select: { name: true } }))?.name ?? "—"
    : null;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT",
    entityId: id, field: "responsibleId", newValue: responsibleId ?? "",
    summary: named ? `Dossier confié à ${named}` : "Dossier sans personne chargée",
  });

  if (responsibleId && responsibleId !== user.id) {
    await notifyUser({
      userId: responsibleId,
      type: "ASSIGNMENT",
      title: "Vous êtes chargé(e) de ce dossier",
      body: `${before.reference} — ${before.dci}`,
      link: `/regulatory/${id}`,
    });
  }

  revalidatePath("/regulatory");
  revalidatePath(`/regulatory/${id}`);
  return { ok: true, id };
}

/** Dates cibles (dépôt + enregistrement) — fixées par la supervision Regulatory. */
export async function setRegulatoryTargetDates(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await ensureRegSupervisor(user))) return { ok: false, error: "Réservé à la supervision Regulatory." };
  const subRaw = str(formData, "targetSubmissionDate");
  const regRaw = str(formData, "targetDate");
  await prisma.regulatoryProduct.update({
    where: { id },
    data: {
      targetSubmissionDate: subRaw ? new Date(subRaw) : null,
      targetDate: regRaw ? new Date(regRaw) : null,
    },
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, summary: "Dates cibles (dépôt / enregistrement) mises à jour" });
  revalidatePath("/regulatory");
  revalidatePath(`/regulatory/${id}`);
  return { ok: true };
}

/**
 * La supervision (Super Admin / rôle configuré) DEMANDE une mise à jour de statut sur
 * l'enregistrement d'un produit : notifie le responsable, l'assistant et les participants
 * du dossier. N'écrit pas le statut — c'est une relance traçable.
 */
export async function requestRegulatoryStatusUpdate(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await ensureRegSupervisor(user))) return { ok: false, error: "Réservé à la supervision Regulatory." };
  const product = await prisma.regulatoryProduct.findUnique({
    where: { id },
    select: { reference: true, dci: true, responsibleId: true, assistantId: true, assignedUsers: { select: { id: true } } },
  });
  if (!product) return { ok: false, error: "Dossier introuvable." };
  const note = str(formData, "note");
  const targets = Array.from(new Set([
    product.responsibleId, product.assistantId, ...product.assignedUsers.map((u) => u.id),
  ].filter((x): x is string => Boolean(x) && x !== user.id)));
  await Promise.all(targets.map((userId) => notifyUser({
    userId,
    type: "GENERIC",
    title: "Mise à jour de statut demandée",
    body: `${product.reference} — ${product.dci}${note ? ` · ${note}` : ""}`,
    link: `/regulatory/${id}`,
  })));
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: id, summary: `Demande de mise à jour de statut (${targets.length} destinataire(s))` });
  return { ok: true };
}

export async function updateRegulatoryStep(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const stepId = str(formData, "stepId");
  if (!stepId) return { ok: false, error: "Étape introuvable." };

  const step = await prisma.regulatoryStep.findUnique({
    where: { id: stepId },
    include: { product: { select: { id: true, reference: true } } },
  });
  if (!step) return { ok: false, error: "Étape introuvable." };

  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", step.productId, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }

  const status = (str(formData, "status") as StepStatus) ?? step.status;
  const plannedDate = str(formData, "plannedDate");
  const actualDate = str(formData, "actualDate");
  const comment = str(formData, "comment");
  const missingDocs = str(formData, "missingDocs");

  await prisma.regulatoryStep.update({
    where: { id: stepId },
    data: {
      status,
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      actualDate: actualDate ? new Date(actualDate) : null,
      comment,
      missingDocs,
      responsible: str(formData, "responsible"),
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Regulatory",
    entityType: "REGULATORY_STEP",
    entityId: stepId,
    field: "status",
    oldValue: step.status,
    newValue: status,
    summary: `Étape mise à jour sur ${step.product.reference}`,
  });

  revalidatePath(`/regulatory/${step.productId}`);
  return { ok: true };
}

export async function updateRegulatoryStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }
  const before = await prisma.regulatoryProduct.findUnique({ where: { id } });
  if (!before) return { ok: false, error: "Dossier introuvable." };

  const status = (str(formData, "status") as RegulatoryStatus) ?? before.status;
  const priority = (str(formData, "priority") as Priority) ?? before.priority;

  // NIVEAU DE PROCESS posé = ÉTAPES COMPTÉES : « Déposé » implique que tout ce qui précède le
  // dépôt (étapes 1 à 12) est fait — on le marque automatiquement, sans jamais toucher aux
  // étapes d'APRÈS le jalon ni dé-cocher quoi que ce soit. Fini l'avancement à 0/22 sur un
  // dossier pourtant déposé.
  let workflowUpdate: Prisma.InputJsonValue | undefined;
  let autoSteps = 0;
  const milestone = status !== before.status ? REG_STATUS_MILESTONE[status] : undefined;
  if (milestone) {
    const sync = completeStepsThrough(before.workflow as RegWorkflowState | null, milestone);
    if (sync.changed > 0) {
      workflowUpdate = sync.state as unknown as Prisma.InputJsonValue;
      autoSteps = sync.changed;
    }
  }

  await prisma.regulatoryProduct.update({
    where: { id },
    data: { status, priority, updatedById: user.id, ...(workflowUpdate !== undefined ? { workflow: workflowUpdate } : {}) },
  });

  await recordAudit({
    actorId: user.id,
    action: "UPDATE",
    module: "Regulatory",
    entityType: "REGULATORY_PRODUCT",
    entityId: id,
    field: "status",
    oldValue: before.status,
    newValue: status,
    summary: `Niveau de process du dossier ${before.reference} → ${status}${autoSteps > 0 ? ` (${autoSteps} étape·s ANPP comptée·s automatiquement)` : ""}`,
  });

  // Dépôt effectué : prévenir la supervision de fixer la date cible d'enregistrement.
  if (status === "SUBMITTED" && before.status !== "SUBMITTED") {
    await notifyRoles(await regSupervisorRoles(), {
      type: "GENERIC",
      title: "Dossier déposé — fixer la date cible d'enregistrement",
      body: `${before.reference} — ${before.dci} vient d'être déposé à l'ANPP.`,
      link: `/regulatory/${id}`,
    });
  }

  revalidatePath(`/regulatory/${id}`);
  revalidatePath("/regulatory");
  return { ok: true };
}

export async function addRegulatoryComment(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const body = str(formData, "body");
  if (!productId || !body) return { ok: false, error: "Commentaire vide." };

  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "VIEW"))) {
    return { ok: false, error: "Action non autorisée." };
  }

  await prisma.comment.create({
    data: { entityType: "REGULATORY_PRODUCT", entityId: productId, body, authorId: user.id },
  });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

// ───────────────────────── Processus officiel ANPP (workflow + checklist) ─────────────────────────

/** Met à jour l'état d'une étape du processus ANPP (statut + date + note) sur un produit. */
export async function setRegulatoryStepState(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const stepKey = str(formData, "stepKey");
  const status = str(formData, "status");
  if (!productId || !stepKey || !status) return { ok: false, error: "Paramètres manquants." };
  if (!isRegStepKey(stepKey) || !isRegStepState(status)) return { ok: false, error: "Étape ou statut invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { workflow: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const wf = { ...((product.workflow as RegWorkflowState | null) ?? {}) };
  const date = str(formData, "date");
  const note = str(formData, "note");
  wf[stepKey] = {
    status,
    date: date && date.trim() ? date.trim() : (status === "DONE" ? new Date().toISOString().slice(0, 10) : wf[stepKey]?.date),
    note: note !== null ? (note.trim() || undefined) : wf[stepKey]?.note,
  };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { workflow: wf as unknown as Prisma.InputJsonValue } });
  const stepLabel = REG_STEPS.find((s) => s.key === stepKey)?.label ?? stepKey;
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, field: "workflow", newValue: status, summary: `Étape ANPP « ${stepLabel} » → ${status}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/**
 * AVIS de la réponse de présoumission (étape « presub_ans ») : Favorable → le processus
 * CONTINUE (étape « Fait ») ; Défavorable → étape « Bloqué » (à corriger et redemander) ;
 * En attente → étape « En cours ». Le statut d'étape est dérivé de l'avis (source unique).
 */
export async function setRegulatoryPresubOutcome(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const outcome = str(formData, "outcome");
  if (!productId || !outcome) return { ok: false, error: "Paramètres manquants." };
  if (!isRegPresubOutcome(outcome)) return { ok: false, error: "Avis invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { workflow: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const wf = { ...((product.workflow as RegWorkflowState | null) ?? {}) };
  const mapped = REG_PRESUB_OUTCOME[outcome];
  const note = str(formData, "note");
  wf[PRESUB_ANSWER_STEP] = {
    status: mapped.status,
    outcome,
    date: mapped.status === "DONE" ? new Date().toISOString().slice(0, 10) : wf[PRESUB_ANSWER_STEP]?.date,
    note: note !== null ? (note.trim() || undefined) : wf[PRESUB_ANSWER_STEP]?.note,
  };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { workflow: wf as unknown as Prisma.InputJsonValue } });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, field: "workflow", newValue: outcome, summary: `Présoumission → ${mapped.label}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/** Enregistre uniquement le commentaire d'une étape ANPP (sans changer son statut). */
export async function setRegulatoryStepNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const stepKey = str(formData, "stepKey");
  if (!productId || !stepKey) return { ok: false, error: "Paramètres manquants." };
  if (!isRegStepKey(stepKey)) return { ok: false, error: "Étape invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { workflow: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const note = str(formData, "note");
  const wf = { ...((product.workflow as RegWorkflowState | null) ?? {}) };
  wf[stepKey] = { ...(wf[stepKey] ?? {}), status: wf[stepKey]?.status ?? "TODO", note: note && note.trim() ? note.trim() : undefined };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { workflow: wf as unknown as Prisma.InputJsonValue } });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/**
 * « Demande de BV » : émet un ordre de dépense (envoyé à l'espace comptable) avec
 * montant + échéance, et joint éventuellement un justificatif (proforma BV). Le
 * comptable le voit dans les ordres de dépense / Finances.
 */
export async function requestBV(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  if (!productId) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { reference: true, dci: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const bvType = str(formData, "bvType") || "BV";
  const amount = Number(str(formData, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };
  const dueRaw = str(formData, "dueDate");
  const note = str(formData, "note");

  const order = await createExpenseOrder({
    label: `${bvType} — ${product.reference} ${product.dci}`,
    amount,
    category: "IMPOT",
    beneficiary: "ANPP",
    sourceType: "REGULATORY_PRODUCT",
    sourceId: productId,
    requestedById: user.id,
    notes: note,
    dueDate: dueRaw ? new Date(dueRaw) : null,
  });

  // Justificatif facultatif : rattaché à l'ordre de dépense (visible côté comptable).
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const err = validateUpload(file.name, file.size, (await getAppSettings()).maxUploadMb);
    if (err) return { ok: false, error: err };
    const key = `EXPENSE_ORDER/${order.id}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (e) {
      console.error("[requestBV] storage write failed", e);
    }
    await prisma.document.create({
      data: {
        name: file.name, category: "PROFORMA", entityType: "EXPENSE_ORDER", entityId: order.id,
        fileKey: key, mimeType: file.type || null, sizeBytes: file.size, confidentiality: "INTERNAL", uploadedById: user.id,
      },
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId,
    summary: `Demande de ${bvType} (${amount.toLocaleString("fr-FR")} DZD) → ordre ${order.reference}`,
  });
  revalidatePath(`/regulatory/${productId}`);
  revalidatePath("/finances");
  return { ok: true };
}

/** Coche / décoche un document de la checklist de présoumission (avec note facultative). */
export async function setRegulatoryChecklistItem(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  const itemKey = str(formData, "itemKey");
  if (!productId || !itemKey) return { ok: false, error: "Paramètres manquants." };
  if (!isRegChecklistKey(itemKey)) return { ok: false, error: "Document invalide." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const product = await prisma.regulatoryProduct.findUnique({ where: { id: productId }, select: { checklist: true } });
  if (!product) return { ok: false, error: "Dossier introuvable." };

  const checked = str(formData, "checked") === "true";
  const note = str(formData, "note");
  const cl = { ...((product.checklist as RegChecklistState | null) ?? {}) };
  cl[itemKey] = { checked, note: note !== null ? (note.trim() || undefined) : cl[itemKey]?.note };

  await prisma.regulatoryProduct.update({ where: { id: productId }, data: { checklist: cl as unknown as Prisma.InputJsonValue } });
  const itemLabel = REG_CHECKLIST.flatMap((g) => g.items).find((i) => i.key === itemKey)?.label ?? itemKey;
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, field: "checklist", newValue: checked ? "coché" : "décoché", summary: `Document présoumission « ${itemLabel} » ${checked ? "fourni" : "retiré"}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

// ─────────────────────────── Variations de fabrication ───────────────────────────
// Après la DE d'un produit, on peut demander une variation vers un packaging local
// (secondaire / primaire / full process). Chaîne possible dans le temps ; à l'obtention,
// le statut de fabrication du produit est mis à jour.

/** Ouvre une variation (dépôt) vers un statut de fabrication supérieur. */
export async function createVariation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const productId = str(formData, "productId");
  if (!productId) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const toStatus = str(formData, "toStatus");
  if (!toStatus || !VARIATION_TARGETS.includes(toStatus)) {
    return { ok: false, error: "Statut de fabrication de variation invalide." };
  }
  const depotRaw = str(formData, "depotDate");
  await prisma.regulatoryVariation.create({
    data: {
      productId,
      toStatus: toStatus as ManufacturingStatus,
      status: "EN_ATTENTE",
      depotDate: depotRaw ? new Date(depotRaw) : null,
      manufacturer: str(formData, "manufacturer"),
      note: str(formData, "note"),
      createdById: user.id,
    },
  });
  await recordAudit({ actorId: user.id, action: "CREATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: productId, summary: `Variation déposée → ${toStatus}` });
  revalidatePath(`/regulatory/${productId}`);
  return { ok: true };
}

/** Met à jour le statut d'une variation ; si « DE obtenue », promeut le statut de fabrication du produit. */
export async function setVariationStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status || !["EN_ATTENTE", "OBTENUE", "ANNULE"].includes(status)) {
    return { ok: false, error: "Paramètres invalides." };
  }
  const variation = await prisma.regulatoryVariation.findUnique({ where: { id }, select: { id: true, productId: true, toStatus: true, manufacturer: true } });
  if (!variation) return { ok: false, error: "Variation introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", variation.productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };

  const decisionRaw = str(formData, "decisionDate");
  const decisionDate = decisionRaw ? new Date(decisionRaw) : status === "OBTENUE" ? new Date() : null;
  await prisma.regulatoryVariation.update({
    where: { id },
    data: { status: status as VariationStatus, decisionDate },
  });

  // À l'obtention, le statut de fabrication du produit devient la cible de la variation.
  if (status === "OBTENUE") {
    await prisma.regulatoryProduct.update({
      where: { id: variation.productId },
      data: {
        manufacturingStatus: variation.toStatus,
        ...(variation.manufacturer ? { manufacturer: variation.manufacturer } : {}),
        variationDate: decisionDate,
        updatedById: user.id,
      },
    });
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: variation.productId, summary: `Variation → ${variation.toStatus} : ${status}` });
  revalidatePath(`/regulatory/${variation.productId}`);
  return { ok: true };
}

/** Supprime une variation (responsable / privilégié). */
export async function deleteVariation(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Variation introuvable." };
  const variation = await prisma.regulatoryVariation.findUnique({ where: { id }, select: { productId: true } });
  if (!variation) return { ok: false, error: "Variation introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", variation.productId, "UPDATE"))) return { ok: false, error: "Non autorisé." };
  await prisma.regulatoryVariation.delete({ where: { id } });
  await recordAudit({ actorId: user.id, action: "DELETE", module: "Regulatory", entityType: "REGULATORY_PRODUCT", entityId: variation.productId, summary: "Variation supprimée" });
  revalidatePath(`/regulatory/${variation.productId}`);
  return { ok: true };
}

/**
 * L'ENTITÉ et les SEGMENTS THÉRAPEUTIQUES, changés depuis le tableau.
 *
 * Les deux se corrigent à la volée parce qu'on s'en aperçoit EN LISANT la liste — « celui-là
 * n'est pas chez Pharmagène », « celui-là sert aussi la gynéco ». Ouvrir la fiche, corriger,
 * revenir, retrouver sa ligne : c'est ce parcours-là qui fait qu'on ne corrige pas.
 *
 * L'entité gouverne QUI VOIT le dossier : la changer est un acte de cloisonnement, pas un
 * détail de saisie — d'où le même droit que la modification de la fiche, et l'audit.
 */
export async function setRegulatoryClassification(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = str(formData, "id");
  if (!id) return { ok: false, error: "Dossier introuvable." };
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE"))) {
    return { ok: false, error: "Modification non autorisée." };
  }
  const before = await prisma.regulatoryProduct.findUnique({
    where: { id }, select: { reference: true, companyId: true, therapeuticSegments: true },
  });
  if (!before) return { ok: false, error: "Dossier introuvable." };

  const data: { companyId?: string | null; therapeuticSegments?: string[]; updatedById: string } = { updatedById: user.id };

  if (formData.has("companyId")) {
    const companyId = str(formData, "companyId");
    if (companyId) {
      const known = await prisma.company.count({ where: { id: companyId } });
      if (!known) return { ok: false, error: "Entité inconnue." };
    }
    data.companyId = companyId || null;
  }

  if (formData.has("segments")) {
    // Liste blanche : un segment inventé ne se compte avec rien, et c'est le comptage qu'on
    // vient chercher. La liste effective est celle réglée par l'administrateur (sinon la liste
    // par défaut) ; un segment DÉJÀ posé sur la fiche reste accepté même s'il a depuis quitté le
    // référentiel — sinon on ne pourrait plus le retirer.
    const settings = await getAppSettings();
    const allowed = new Set([
      ...effectiveTherapeuticSegments(settings.regulatoryTherapeuticSegments),
      ...(before.therapeuticSegments ?? []),
    ]);
    const picked = formData.getAll("segments").map(String).filter((v) => allowed.has(v));
    data.therapeuticSegments = [...new Set(picked)];
  }

  await prisma.regulatoryProduct.update({ where: { id }, data });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Regulatory",
    entityType: "REGULATORY_PRODUCT", entityId: id,
    summary: `Classement mis à jour — ${before.reference}`,
  });
  revalidatePath("/regulatory");
  revalidatePath("/regulatory/pipeline");
  return { ok: true, id };
}
