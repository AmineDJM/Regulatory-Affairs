"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUser, notifyRoles } from "@/lib/notify";
import { getAppSettings } from "@/lib/settings";
import { saveFile, validateUpload } from "@/lib/storage";
import {
  canSetDepartmentBudget, canEditDepartmentBudget, canManageDepartmentBudgetAccess,
  canRequestDepartmentBudget, canDecideDepartmentBudgetRequest, canViewDepartmentBudget,
  mergeGrants, normalizeAmount, normalizeYear, DEPT_BUDGET_LABEL, DEPT_BUDGET_KINDS, EMPTY_GRANT,
  type DeptBudgetKind, type BudgetSetter, type DeptBudgetGrant, type GrantSubject,
} from "@/lib/department-budget";
import { fdStr, type ActionResult } from "@/lib/actions/types";

const PATH = "/budgets/departements";

/** Le porteur de droits, tel que le module pur l'attend. */
function setterOf(user: { role: string; secondaryRole?: string | null; id: string }, headOfDepartmentIds: string[] = []): BudgetSetter {
  const u = user as Parameters<typeof userCan>[0];
  return {
    role: user.role,
    secondaryRole: user.secondaryRole ?? null,
    canManageBudgets: userCan(u, "BUDGETS", "UPDATE") || userCan(u, "BUDGETS", "VALIDATE"),
    canManageHr: userCan(u, "RH", "UPDATE"),
    headOfDepartmentIds,
  };
}

function subjectOf(user: { id: string; role: string; secondaryRole?: string | null }): GrantSubject {
  return { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null };
}

/** Autorisations applicables à un département : la règle générale PLUS la sienne. */
async function grantFor(departmentId: string): Promise<DeptBudgetGrant> {
  const rows = await prisma.departmentBudgetAccess.findMany({
    where: { OR: [{ departmentId }, { departmentId: null }] },
  });
  const pick = (r: (typeof rows)[number] | undefined): DeptBudgetGrant | null =>
    r ? {
      accessRoles: r.accessRoles, accessUserIds: r.accessUserIds,
      operatingRoles: r.operatingRoles, operatingUserIds: r.operatingUserIds,
      hrRoles: r.hrRoles, hrUserIds: r.hrUserIds,
      activityRoles: r.activityRoles, activityUserIds: r.activityUserIds,
    } : null;
  return mergeGrants(pick(rows.find((r) => r.departmentId === null)), pick(rows.find((r) => r.departmentId === departmentId)));
}

/** Cases cochées d'un formulaire, dédoublonnées et débarrassées des valeurs vides. */
function list(formData: FormData, name: string): string[] {
  return Array.from(new Set(formData.getAll(name).filter((v): v is string => typeof v === "string" && v.trim().length > 0)));
}

/**
 * AUTORISATIONS — qui voit, qui édite quoi, sur quel département.
 *
 * Réservé au **Super Admin** : régler les deux budgets ne donne pas le droit de régler QUI y a
 * accès. `departmentId` vide = la règle GÉNÉRALE, valable pour tous les départements.
 *
 * Les listes remplacent celles de la règle concernée — c'est un formulaire de cases à cocher,
 * décocher doit retirer. Mais une règle n'en écrase jamais une autre : la générale et celle du
 * département restent deux lignes distinctes, cumulées à la lecture.
 */
export async function setDepartmentBudgetAccess(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canManageDepartmentBudgetAccess(setterOf(user))) {
    return { ok: false, error: "Régler les accès aux budgets départementaux est réservé au Super Admin." };
  }

  const raw = fdStr(formData, "departmentId");
  const departmentId = raw && raw !== "__GENERAL__" ? raw : null;

  let label = "tous les départements";
  if (departmentId) {
    const d = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
    if (!d) return { ok: false, error: "Département introuvable." };
    label = d.name;
  }

  const data = {
    accessRoles: list(formData, "accessRoles"),
    accessUserIds: list(formData, "accessUserIds"),
    operatingRoles: list(formData, "operatingRoles"),
    operatingUserIds: list(formData, "operatingUserIds"),
    hrRoles: list(formData, "hrRoles"),
    hrUserIds: list(formData, "hrUserIds"),
    activityRoles: list(formData, "activityRoles"),
    activityUserIds: list(formData, "activityUserIds"),
  };

  // `upsert` sur `departmentId` ne marche pas pour la règle générale : `null` n'est pas une
  // clé unique exploitable côté Prisma (deux NULL ne s'égalent pas en SQL). L'unicité est bien
  // garantie en base par un index partiel — ici on cherche puis on écrit.
  if (departmentId) {
    await prisma.departmentBudgetAccess.upsert({
      where: { departmentId },
      create: { departmentId, ...data, setById: user.id },
      update: { ...data, setById: user.id },
    });
  } else {
    const existing = await prisma.departmentBudgetAccess.findFirst({ where: { departmentId: null }, select: { id: true } });
    if (existing) await prisma.departmentBudgetAccess.update({ where: { id: existing.id }, data: { ...data, setById: user.id } });
    else await prisma.departmentBudgetAccess.create({ data: { departmentId: null, ...data, setById: user.id } });
  }

  const count = Object.values(data).reduce((n, l) => n + l.length, 0);
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET",
    entityId: departmentId ?? "general",
    summary: `Accès au budget — ${label} : ${count === 0 ? "toutes les autorisations retirées" : `${count} autorisation(s)`}`,
  });

  revalidatePath(PATH);
  return { ok: true, id: departmentId ?? "general" };
}

/**
 * Règle le budget d'un département pour une année et une nature.
 *
 * Le droit est vérifié PAR NATURE : c'est tout l'objet du dispositif. L'administrateur qui
 * tenterait de fixer la masse salariale se voit refuser, et réciproquement — même si les deux
 * cases sont dans le même tableau.
 */
export async function setDepartmentBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const departmentId = fdStr(formData, "departmentId");
  const rawKind = fdStr(formData, "kind");
  if (!departmentId || !(DEPT_BUDGET_KINDS as readonly string[]).includes(rawKind ?? "")) {
    return { ok: false, error: "Paramètres manquants." };
  }
  const kind = rawKind as DeptBudgetKind;

  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  // Le droit se vérifie SUR CE DÉPARTEMENT : le socle par rôle, plus l'autorisation que le
  // Super Admin a éventuellement posée ici ou en règle générale. On relit les règles au moment
  // d'écrire — celles affichées à l'ouverture de l'écran ont pu changer depuis.
  const grant = await grantFor(departmentId);
  const setter = setterOf(user, await headedDepartmentIds(user.id));
  if (!canEditDepartmentBudget(subjectOf(user), setter, kind, grant, departmentId)) {
    return {
      ok: false,
      error: kind === "HR"
        ? "La masse salariale est réglée par les ressources humaines, ou par les personnes que le Super Admin a autorisées."
        : "Ce budget est réglé par l'administration ou par le directeur du département — ou par les personnes que le Super Admin a autorisées.",
    };
  }

  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  const year = normalizeYear(fdStr(formData, "year"));
  const notes = fdStr(formData, "notes");

  const before = await prisma.departmentBudget.findUnique({
    where: { departmentId_year_kind: { departmentId, year, kind } },
    select: { amount: true },
  });

  await prisma.departmentBudget.upsert({
    where: { departmentId_year_kind: { departmentId, year, kind } },
    create: { departmentId, year, kind, amount, notes, setById: user.id },
    update: { amount, notes, setById: user.id },
  });

  const previous = before ? Number(before.amount) : null;
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: "Budgets", entityType: "BUDGET", entityId: departmentId,
    summary: `Budget ${DEPT_BUDGET_LABEL[kind]} ${year} — ${department.name} : ${previous ?? "—"} → ${amount} DZD`,
  });

  revalidatePath(PATH);
  revalidatePath("/budgets");
  return { ok: true, id: departmentId };
}

/** Les départements que cette personne DIRIGE (responsable ou adjoint), via sa fiche employé. */
async function headedDepartmentIds(userId: string): Promise<string[]> {
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { id: true } });
  if (!emp) return [];
  const depts = await prisma.department.findMany({
    where: { OR: [{ headId: emp.id }, { deputyId: emp.id }] },
    select: { id: true },
  });
  return depts.map((d) => d.id);
}

/**
 * DEMANDER UNE DOTATION OU UNE RALLONGE.
 *
 * Personne ne s'accorde son propre budget : celui qui le gère le DEMANDE, l'administration
 * tranche. C'est ce qui rend vérifiable « budget fixé par les RH, validé par l'administration »
 * au lieu d'en faire un usage. Une dotation initiale est une rallonge partant de zéro — même
 * geste, même circuit, une seule trace à relire.
 */
export async function requestDepartmentBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const departmentId = fdStr(formData, "departmentId");
  const rawKind = fdStr(formData, "kind");
  if (!departmentId || !(DEPT_BUDGET_KINDS as readonly string[]).includes(rawKind ?? "")) {
    return { ok: false, error: "Paramètres manquants." };
  }
  const kind = rawKind as DeptBudgetKind;
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
  if (!department) return { ok: false, error: "Département introuvable." };

  const grant = await grantFor(departmentId);
  const setter = setterOf(user, await headedDepartmentIds(user.id));
  const canViewModule = userCan(user as Parameters<typeof userCan>[0], "BUDGETS", "VIEW");
  if (!canRequestDepartmentBudget(subjectOf(user), setter, grant, canViewModule, departmentId)) {
    return { ok: false, error: "Ce budget ne vous est pas ouvert." };
  }

  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  if (amount <= 0) return { ok: false, error: "Indiquez le montant demandé." };
  const year = normalizeYear(fdStr(formData, "year"));
  const reason = fdStr(formData, "reason");

  const created = await prisma.departmentBudgetRequest.create({
    data: { departmentId, year, kind, amount, reason, requestedById: user.id },
    select: { id: true },
  });
  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets", entityType: "BUDGET", entityId: departmentId,
    summary: `Demande de ${DEPT_BUDGET_LABEL[kind]} ${year} — ${department.name} : +${amount} DZD`,
  });
  await notifyRoles(["SUPER_ADMIN", "DIRECTION"], {
    type: "VALIDATION_REQUIRED",
    title: "Budget départemental — dotation à valider",
    body: `${department.name} · ${DEPT_BUDGET_LABEL[kind]} ${year} : +${amount} DZD${reason ? ` — ${reason}` : ""}`,
    link: PATH,
  });
  revalidatePath(PATH);
  return { ok: true, id: created.id };
}

/**
 * ACCORDER OU REFUSER une dotation / rallonge — l'administration, et elle seule.
 *
 * Accorder AJOUTE au budget courant plutôt que de le remplacer : une rallonge s'ajoute par
 * définition, et remplacer effacerait silencieusement la dotation précédente.
 */
export async function decideDepartmentBudgetRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!canDecideDepartmentBudgetRequest(setterOf(user))) {
    return { ok: false, error: "Accorder un budget est réservé à l'administration." };
  }
  const id = fdStr(formData, "id");
  const decision = fdStr(formData, "decision");
  if (!id || (decision !== "APPROVED" && decision !== "REJECTED")) return { ok: false, error: "Décision invalide." };

  const req = await prisma.departmentBudgetRequest.findUnique({
    where: { id },
    include: { department: { select: { name: true } } },
  });
  if (!req) return { ok: false, error: "Demande introuvable." };
  if (req.status !== "PENDING") return { ok: false, error: "Cette demande a déjà été tranchée." };

  const note = fdStr(formData, "note");
  await prisma.departmentBudgetRequest.update({
    where: { id },
    data: { status: decision, decidedById: user.id, decidedAt: new Date(), decisionNote: note },
  });

  const amount = Number(req.amount);
  if (decision === "APPROVED") {
    await prisma.departmentBudget.upsert({
      where: { departmentId_year_kind: { departmentId: req.departmentId, year: req.year, kind: req.kind } },
      create: { departmentId: req.departmentId, year: req.year, kind: req.kind, amount, setById: user.id },
      update: { amount: { increment: amount }, setById: user.id },
    });
  }

  if (req.requestedById) {
    await notifyUser({
      userId: req.requestedById, type: "GENERIC",
      title: decision === "APPROVED" ? "Dotation accordée" : "Dotation refusée",
      body: `${req.department.name} · ${DEPT_BUDGET_LABEL[req.kind as DeptBudgetKind]} ${req.year} : ${amount} DZD${note ? ` — ${note}` : ""}`,
      link: PATH,
    });
  }
  await recordAudit({
    actorId: user.id, action: decision === "APPROVED" ? "VALIDATE" : "REFUSE", module: "Budgets",
    entityType: "BUDGET", entityId: req.departmentId,
    summary: `Dotation ${decision === "APPROVED" ? "accordée" : "refusée"} — ${req.department.name} · ${DEPT_BUDGET_LABEL[req.kind as DeptBudgetKind]} ${req.year} : ${amount} DZD`,
  });
  revalidatePath(PATH);
  return { ok: true };
}

/**
 * IMPUTER UNE DÉPENSE à un budget départemental — **avec sa pièce**.
 *
 * Les moyens généraux affichaient un montant alloué et aucune consommation : un budget qu'on
 * ne peut pas confronter à ses dépenses n'est pas un budget, c'est un vœu. Chaque dépense
 * porte donc son justificatif (facture, bon de paiement) : sans pièce, une ligne de dépense
 * n'est qu'une affirmation.
 */
export async function addDepartmentExpense(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const departmentId = fdStr(formData, "departmentId");
  const rawKind = fdStr(formData, "kind");
  if (!departmentId || !(DEPT_BUDGET_KINDS as readonly string[]).includes(rawKind ?? "")) {
    return { ok: false, error: "Paramètres manquants." };
  }
  const kind = rawKind as DeptBudgetKind;
  if (kind === "HR") {
    return { ok: false, error: "La masse salariale se lit sur la paie : elle ne se saisit pas à la main." };
  }

  const grant = await grantFor(departmentId);
  const setter = setterOf(user, await headedDepartmentIds(user.id));
  if (!canEditDepartmentBudget(subjectOf(user), setter, kind, grant, departmentId)) {
    return { ok: false, error: "Vous ne tenez pas ce budget." };
  }

  const label = fdStr(formData, "label");
  if (!label) return { ok: false, error: "Indiquez ce qui a été acheté." };
  const amount = normalizeAmount(fdStr(formData, "amount"));
  if (typeof amount !== "number") return { ok: false, error: amount.error };
  if (amount <= 0) return { ok: false, error: "Indiquez le montant de la dépense." };
  const year = normalizeYear(fdStr(formData, "year"));

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { ok: false, error: "Joignez la facture ou le bon de paiement : une dépense sans pièce n'est qu'une affirmation." };
  }

  const created = await prisma.departmentBudgetExpense.create({
    data: {
      departmentId, year, kind, label, amount,
      notes: fdStr(formData, "notes"),
      adminRequestId: fdStr(formData, "adminRequestId"),
      createdById: user.id,
    },
    select: { id: true },
  });

  const maxMb = (await getAppSettings()).maxUploadMb;
  for (const file of files) {
    const invalid = validateUpload(file.name, file.size, maxMb);
    if (invalid) return { ok: false, error: invalid };
    const key = `DEPARTMENT_EXPENSE/${created.id}/${randomUUID()}__${file.name}`;
    try {
      await saveFile(key, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      console.error("[dept-expense] storage write failed, recording metadata only", err);
    }
    await prisma.document.create({
      data: {
        name: file.name, category: "INVOICE", entityType: "DEPARTMENT_EXPENSE", entityId: created.id,
        fileKey: key, mimeType: file.type || null, sizeBytes: file.size,
        confidentiality: "INTERNAL", uploadedById: user.id,
      },
    });
  }

  await recordAudit({
    actorId: user.id, action: "CREATE", module: "Budgets", entityType: "BUDGET", entityId: departmentId,
    summary: `Dépense imputée — ${DEPT_BUDGET_LABEL[kind]} ${year} : ${label} (${amount} DZD)`,
  });
  revalidatePath(PATH);
  revalidatePath("/moyens-generaux");
  return { ok: true, id: created.id };
}
