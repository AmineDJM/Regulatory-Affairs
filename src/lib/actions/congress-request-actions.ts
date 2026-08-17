"use server";

import { revalidatePath } from "next/cache";
import type { CongressRequestStatus, EntityType, NationalEventType, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView, hasRole, anyRoleFilter, type Module } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { companyIdForNew } from "@/lib/company";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { createMedicalInfoDeclaration } from "@/lib/medical-info";
import { createExpenseOrder } from "@/lib/expense-orders";
import { involveThirdParty } from "@/lib/third-party";
import { adProInit, PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { fdStr, fdNum, fdDate, type ActionResult } from "@/lib/actions/types";
import { attachFiles } from "@/lib/attach-files";

// Le **même** circuit de prise en charge sert les prises en charge internationales/nationaux
// ET les événements (module Events) : on paramètre tout par `type`.
type CongressType = "INTL" | "NATIONAL" | "EVENT";
const EVENT_TYPES: NationalEventType[] = ["CONGRESS", "SEMINAR", "ROUND_TABLE", "WEBINAR", "WORKSHOP", "SYMPOSIUM", "STAFF", "OTHER"];

const moduleFor = (t: CongressType): Module => (t === "INTL" ? "CONGRESS_INTERNATIONAL" : t === "NATIONAL" ? "CONGRESS_NATIONAL" : "EVENTS");
const pathFor = (t: CongressType) => (t === "INTL" ? "/congress-international" : t === "NATIONAL" ? "/congress-national" : "/events");
const entityFor = (t: CongressType): EntityType => (t === "INTL" ? "CONGRESS_INTERNATIONAL" : t === "NATIONAL" ? "CONGRESS_NATIONAL" : "EVENT");
const ML = (t: CongressType) => (t === "EVENT" ? "Events" : "Congrès"); // libellé module pour l'audit
const NOUN = (t: CongressType) => (t === "EVENT" ? "Événement" : "Congrès"); // nom métier pour les notifications
const typeOf = (formData: FormData): CongressType => {
  const v = fdStr(formData, "type");
  return v === "NATIONAL" ? "NATIONAL" : v === "EVENT" ? "EVENT" : "INTL";
};
const fdList = (formData: FormData, key: string): string[] => formData.getAll(key).map((v) => String(v)).filter(Boolean);

function loadCongress(t: CongressType, id: string) {
  if (t === "INTL") return prisma.congressInternational.findUnique({ where: { id } });
  if (t === "NATIONAL") return prisma.congressNational.findUnique({ where: { id } });
  return prisma.event.findUnique({ where: { id } });
}
function updateCongress(t: CongressType, id: string, data: Record<string, unknown>) {
  if (t === "INTL") return prisma.congressInternational.update({ where: { id }, data: data as Prisma.CongressInternationalUpdateInput });
  if (t === "NATIONAL") return prisma.congressNational.update({ where: { id }, data: data as Prisma.CongressNationalUpdateInput });
  // Le modèle Event n'a pas de champ updatedById (contrairement aux congrès).
  const { updatedById: _omit, ...rest } = data;
  return prisma.event.update({ where: { id }, data: rest as Prisma.EventUpdateInput });
}

// ───────────────────────────── Création de la demande ─────────────────────────────

export async function createCongressRequest(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  if (!userCan(user, moduleFor(t), "CREATE")) return { ok: false, error: "Non autorisé." };
  const name = fdStr(formData, "name");
  if (!name) return { ok: false, error: "Le nom de l'événement est obligatoire." };

  const eventType: NationalEventType = EVENT_TYPES.includes(fdStr(formData, "eventType") as NationalEventType)
    ? (fdStr(formData, "eventType") as NationalEventType)
    : "CONGRESS";

  // Routage intelligent : on saute les étapes d'approbation au niveau/en dessous du créateur.
  const pmId = fdStr(formData, "productManagerId");
  if (pmId) {
    const okPm = await prisma.user.count({ where: { id: pmId, isActive: true, ...anyRoleFilter(PRODUCT_MANAGER_ROLES) } });
    if (!okPm) return { ok: false, error: "Le chef de produit sélectionné est introuvable." };
  }
  // La Direction peut demander l'avis d'un chef de produit avant de trancher — ou trancher tout
  // de suite. `adProInit` ignore ce drapeau pour les autres rangs.
  const init = adProInit(user, pmId, { viaProductManager: fdStr(formData, "viaProductManager") === "1" });
  const now = new Date();

  const common = {
    name,
    eventType,
    specialty: fdStr(formData, "specialty"),
    estimatedBudget: fdNum(formData, "estimatedBudget"),
    invitedDoctorIds: fdList(formData, "invitedDoctorIds"),
    participantIds: fdList(formData, "participantIds"),
    requesterId: user.id,
    requestStatus: init.status as CongressRequestStatus,
    createdById: user.id,
    // Entité : la portée en cours, à défaut la société d'appartenance du créateur.
    companyId: await companyIdForNew(user.id),
    ...(init.productManagerId ? { productManagerId: init.productManagerId } : {}),
    ...(init.preliminaryBySelf ? { preliminaryById: user.id, preliminaryAt: now } : {}),
  };

  const created =
    t === "INTL"
      ? await prisma.congressInternational.create({
          data: {
            ...common,
            country: fdStr(formData, "country"),
            city: fdStr(formData, "city"),
            startDate: fdDate(formData, "startDate"),
            endDate: fdDate(formData, "endDate"),
          },
        })
      : await prisma.congressNational.create({
          data: {
            ...common,
            // Une prise en charge « nationale » peut se tenir hors d'Algérie : le pays reste
            // demandé des deux côtés, simplement facultatif.
            country: fdStr(formData, "country"),
            city: fdStr(formData, "city"),
            hostInstitution: fdStr(formData, "hostInstitution"),
            date: fdDate(formData, "date"),
          },
        });

  // Les demandes du médecin, jointes DÈS la création — la pièce que tout le circuit va lire.
  const attached = await attachFiles({
    files: formData.getAll("files").filter((f): f is File => f instanceof File),
    entityType: entityFor(t), entityId: created.id, uploadedById: user.id, category: "REQUEST_LETTER",
  });
  if (attached.error) return { ok: false, error: attached.error };

  await recordAudit({ actorId: user.id, action: "CREATE", module: ML(t), entityType: entityFor(t), entityId: created.id, summary: `Prise en charge « ${name} »${attached.saved > 0 ? ` (${attached.saved} pièce(s) jointe(s))` : ""}` });
  // Notifie l'acteur de l'étape de DÉPART selon le routage à la création :
  //  · délégué → National Sales (approbation préliminaire + choix chef de produit) ;
  //  · National Sales ayant désigné → le chef de produit (analyse) ;
  //  · chef de produit / Direction / Super Admin → la Direction (validation définitive).
  const link = `${pathFor(t)}/${created.id}`;
  if (init.stage === "ANALYSIS" && init.productManagerId) {
    await notifyUser({ userId: init.productManagerId, type: "ASSIGNMENT", title: `${NOUN(t)} à analyser`, body: name, link });
  } else if (init.stage === "FINAL") {
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: `${NOUN(t)} — validation définitive`, body: name, link });
  } else {
    await notifyRoles(["NATIONAL_SALES", "SUPER_ADMIN"], { type: "VALIDATION_REQUIRED", title: "Demande de congrès — à attribuer (National Sales)", body: name, link });
  }
  revalidatePath(pathFor(t));
  return { ok: true, id: created.id };
}

// ─────────────────── Attribution d'un chef de produit (Direction Marketing) ───────────────────

export async function preliminaryDecision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision"); // APPROVE | REJECT
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };
  // Approbation préliminaire (approuver/refuser + désigner le chef de produit) :
  // **réservée au National Sales** (la demande émane d'un délégué). Ni la Direction
  // ni la Direction Marketing n'interviennent à cette étape.
  if (!(hasRole(user, "NATIONAL_SALES") || user.role === "SUPER_ADMIN")) return { ok: false, error: "Attribution réservée au National Sales." };

  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (c.requestStatus !== "AWAITING_PRELIMINARY") return { ok: false, error: "Cette demande n'est pas en attente de validation préliminaire." };

  if (decision === "REJECT") {
    const reason = fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Le motif de refus est obligatoire." };
    await updateCongress(t, id, { requestStatus: "REJECTED", rejectionReason: reason, preliminaryById: user.id, preliminaryAt: new Date(), updatedById: user.id });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: `${NOUN(t)} — demande refusée`, body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Refus préliminaire — ${c.name}` });
  } else {
    const productManagerId = fdStr(formData, "productManagerId");
    if (!productManagerId) return { ok: false, error: "Sélectionnez le chef de produit qui fera l'analyse." };
    await updateCongress(t, id, {
      requestStatus: "PRELIMINARY_APPROVED", productManagerId,
      preliminaryById: user.id, preliminaryAt: new Date(), preliminaryNote: fdStr(formData, "note"), updatedById: user.id,
    });
    await notifyUser({ userId: productManagerId, type: "ASSIGNMENT", title: `${NOUN(t)} à analyser`, body: c.name, link: `${pathFor(t)}/${id}` });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: "Demande validée (préliminaire)", body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "VALIDATE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Validation préliminaire — ${c.name}` });
  }
  revalidatePath(`${pathFor(t)}/${id}`);
  revalidatePath(pathFor(t));
  return { ok: true };
}

// ───────────────────────────── Analyse chef de produit ─────────────────────────────

export async function submitProductAnalysis(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (c.productManagerId !== user.id && !hasGlobalView(user)) return { ok: false, error: "Réservé au chef de produit assigné." };
  if (c.requestStatus !== "PRELIMINARY_APPROVED") return { ok: false, error: "Cette demande n'est pas en phase d'analyse." };

  // Le chef de produit peut APPROUVER (et proposer un budget, désormais facultatif)
  // ou REFUSER la demande.
  const decision = fdStr(formData, "decision") ?? "APPROVE";
  if (decision === "REJECT") {
    const reason = fdStr(formData, "productManagerNotes") || fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Indiquez le motif du refus." };
    await updateCongress(t, id, {
      requestStatus: "REJECTED", rejectionReason: reason, productManagerNotes: reason, updatedById: user.id,
    });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: `${NOUN(t)} — refusé par le chef de produit`, body: c.name, link: `${pathFor(t)}/${id}` });
    await notifyRoles(["NATIONAL_SALES", "SUPER_ADMIN"], { type: "GENERIC", title: `${NOUN(t)} refusé par le chef de produit`, body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Refus chef de produit — ${c.name}` });
    revalidatePath(`${pathFor(t)}/${id}`);
    revalidatePath(pathFor(t));
    return { ok: true };
  }

  // Approbation : le budget proposé est facultatif (la Direction tranchera).
  await updateCongress(t, id, {
    requestStatus: "AWAITING_FINAL",
    productManagerBudget: fdNum(formData, "productManagerBudget"),
    productManagerNotes: fdStr(formData, "productManagerNotes"),
    updatedById: user.id,
  });
  await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
    type: "VALIDATION_REQUIRED",
    title: `${NOUN(t)} — validation définitive`,
    body: `${c.name} — analyse chef de produit terminée`,
    link: `${pathFor(t)}/${id}`,
  });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Analyse chef de produit — ${c.name}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  return { ok: true };
}

// ───────────────────────────── Validation définitive (Direction) → ordre de dépense ─────────────────────────────

export async function finalDecision(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || !decision) return { ok: false, error: "Paramètres manquants." };
  // Validation définitive **réservée à la Direction** (et au Super Admin) — le chef
  // de produit, même s'il « gère » le module, ne doit PAS pouvoir trancher.
  if (!hasGlobalView(user)) return { ok: false, error: "Validation définitive réservée à la Direction." };

  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (c.requestStatus !== "AWAITING_FINAL") return { ok: false, error: "Cette demande n'est pas en attente de validation définitive." };

  if (decision === "REJECT") {
    const reason = fdStr(formData, "note");
    if (!reason) return { ok: false, error: "Le motif de refus est obligatoire." };
    await updateCongress(t, id, { requestStatus: "REJECTED", rejectionReason: reason, finalById: user.id, finalAt: new Date(), updatedById: user.id });
    if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: `${NOUN(t)} — refusé (définitif)`, body: c.name, link: `${pathFor(t)}/${id}` });
    await recordAudit({ actorId: user.id, action: "REFUSE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Refus définitif — ${c.name}` });
    revalidatePath(`${pathFor(t)}/${id}`);
    return { ok: true };
  }

  // Le montant accordé par la Direction est **obligatoire** à la validation définitive :
  // il fait foi pour la déclaration d'information médicale puis l'ordre de dépense.
  const amount = fdNum(formData, "finalAmount");
  if (amount === null || amount <= 0) return { ok: false, error: "Le montant accordé est obligatoire pour valider définitivement." };

  // (Sous-)catégorie budgétaire : la Direction impute explicitement la dépense à une
  // (sous-)catégorie AVANT qu'elle ne parte au comptable. Facultatif côté serveur
  // (aucune enveloppe configurée = pas de choix), mais requis dans l'UI dès qu'il
  // existe des (sous-)catégories. Vérifie qu'elle existe encore.
  const budgetCategoryId = fdStr(formData, "budgetCategoryId");
  if (budgetCategoryId) {
    const okCat = await prisma.budgetCategoryLine.count({ where: { id: budgetCategoryId } });
    if (okCat === 0) return { ok: false, error: "La (sous-)catégorie budgétaire choisie est introuvable." };
  }

  // Étape « information médicale » : intercalée UNIQUEMENT si un pharmacien responsable
  // est configuré. Sinon, on route directement l'ordre de dépense vers les Finances
  // (le responsable des finances est notifié par createExpenseOrder).
  const pharmacist = await prisma.user.findFirst({ where: { ...anyRoleFilter(["MEDICAL_INFO_PHARMACIST"]), isActive: true }, select: { id: true } });

  if (pharmacist) {
    const decl = await createMedicalInfoDeclaration({
      sourceType: entityFor(t),
      sourceId: id,
      label: `${NOUN(t)} — ${c.name}`,
      beneficiary: c.name,
      amount,
      requesterId: c.requesterId ?? user.id,
      budgetCategoryId,
    });
    await updateCongress(t, id, {
      requestStatus: "APPROVED",
      finalById: user.id, finalAt: new Date(), finalNote: fdStr(formData, "note"), finalAmount: amount,
      status: "VALIDATED",
      updatedById: user.id,
    });
    await recordAudit({ actorId: user.id, action: "VALIDATE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Validation définitive — ${c.name} (déclaration ${decl.reference})` });
    revalidatePath("/information-medicale");
  } else {
    // Pas de pharmacien PRIM : ordre de dépense émis directement → Finances.
    const order = await createExpenseOrder({
      label: `${NOUN(t)} — ${c.name}`,
      amount,
      category: "EVENEMENT",
      beneficiary: c.name,
      sourceType: entityFor(t),
      sourceId: id,
      requestedById: c.requesterId ?? user.id,
      budgetCategoryId,
    });
    await updateCongress(t, id, {
      requestStatus: "APPROVED",
      finalById: user.id, finalAt: new Date(), finalNote: fdStr(formData, "note"), finalAmount: amount,
      status: "VALIDATED", expenseOrderId: order.id,
      updatedById: user.id,
    });
    await recordAudit({ actorId: user.id, action: "VALIDATE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Validation définitive — ${c.name} (ordre ${order.reference})` });
    revalidatePath("/finances/ordres-de-depense");
    revalidatePath("/finances");
  }

  if (c.requesterId) await notifyUser({ userId: c.requesterId, type: "GENERIC", title: `${NOUN(t)} validé — pris en charge`, body: c.name, link: `${pathFor(t)}/${id}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  return { ok: true };
}

// ───────────────────────────── Modification du budget accordé (Direction) ─────────────────────────────

/**
 * La Direction peut **modifier le montant accordé** même après la validation
 * définitive. Répercuté sur la déclaration d'information médicale (si pas encore
 * validée) et sur l'ordre de dépense (s'il existe et n'est pas encore réglé).
 */
export async function updateGrantedBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  if (!hasGlobalView(user)) return { ok: false, error: "Réservé à la Direction." };
  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  if (!["APPROVED", "COMPLETED"].includes(c.requestStatus ?? "")) return { ok: false, error: "Le budget ne peut être modifié qu'après validation définitive." };
  const amount = fdNum(formData, "finalAmount");
  if (amount === null || amount <= 0) return { ok: false, error: "Montant invalide." };

  await updateCongress(t, id, { finalAmount: amount, updatedById: user.id });

  // Répercussion sur la déclaration PRIM (tant qu'elle n'est pas validée).
  const decl = await prisma.medicalInfoDeclaration.findUnique({ where: { sourceType_sourceId: { sourceType: entityFor(t), sourceId: id } }, select: { id: true, status: true, expenseOrderId: true } });
  if (decl && decl.status !== "VALIDATED") {
    await prisma.medicalInfoDeclaration.update({ where: { id: decl.id }, data: { amount } });
  }
  // Répercussion sur l'ordre de dépense (s'il existe et n'est pas réglé).
  const orderId = decl?.expenseOrderId ?? c.expenseOrderId;
  if (orderId) {
    const order = await prisma.expenseOrder.findUnique({ where: { id: orderId }, select: { status: true } });
    if (order && order.status !== "PAID") {
      await prisma.expenseOrder.update({ where: { id: orderId }, data: { amount } });
      await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], { type: "GENERIC", title: "Budget d'un événement modifié", body: `${c.name} — nouveau montant ${amount.toLocaleString("fr-FR")} DZD`, link: "/finances/ordres-de-depense" });
    }
  }
  await recordAudit({ actorId: user.id, action: "UPDATE", module: ML(t), entityType: entityFor(t), entityId: id, field: "finalAmount", newValue: String(amount), summary: `Budget accordé modifié — ${c.name}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  revalidatePath("/information-medicale");
  revalidatePath("/finances/ordres-de-depense");
  return { ok: true };
}

// ───────────────────────────── Impliquer une tierce personne ─────────────────────────────

/**
 * Implique une tierce personne (ex. assistante de direction) dans le circuit d'un
 * congrès / événement, SANS lui donner accès au module : elle reçoit une demande
 * dans son espace + un dossier de suivi indiquant l'événement (SANS budget).
 */
export async function requestThirdPartyInput(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  const personId = fdStr(formData, "personId");
  if (!id || !personId) return { ok: false, error: "Indiquez la personne à impliquer." };
  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Demande introuvable." };
  const isActor = hasGlobalView(user) || hasRole(user, "NATIONAL_SALES") || c.productManagerId === user.id || c.requesterId === user.id;
  if (!isActor) return { ok: false, error: "Non autorisé." };

  const res = await involveThirdParty({
    actorId: user.id,
    personId,
    eventLabel: `${NOUN(t)} — ${c.name}`,
    moduleLabel: t === "EVENT" ? "Événements" : "Ad & Pro",
    note: fdStr(formData, "note"),
    sourceType: entityFor(t),
    sourceId: id,
  });
  if (!res.ok) return { ok: false, error: res.error };
  await recordAudit({ actorId: user.id, action: "UPDATE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Tierce personne impliquée — ${c.name}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  return { ok: true };
}

export async function cancelCongressRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const t = typeOf(formData);
  const id = fdStr(formData, "id");
  if (!id) return { ok: false, error: "Identifiant manquant." };
  const c = await loadCongress(t, id);
  if (!c) return { ok: false, error: "Introuvable." };
  const isOwner = c.requesterId === user.id;
  if (!isOwner && !userCan(user, moduleFor(t), "VALIDATE") && !hasGlobalView(user)) return { ok: false, error: "Non autorisé." };
  if (["APPROVED", "COMPLETED"].includes(c.requestStatus ?? "")) return { ok: false, error: "Demande déjà validée." };
  await updateCongress(t, id, { requestStatus: "CANCELLED", updatedById: user.id });
  await recordAudit({ actorId: user.id, action: "UPDATE", module: ML(t), entityType: entityFor(t), entityId: id, summary: `Demande annulée — ${c.name}` });
  revalidatePath(`${pathFor(t)}/${id}`);
  revalidatePath(pathFor(t));
  return { ok: true };
}
