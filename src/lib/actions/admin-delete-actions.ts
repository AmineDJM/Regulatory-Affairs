"use server";

import { revalidatePath } from "next/cache";
import type { EntityType, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { deleteFileByKey } from "@/lib/storage";
import { releaseBlob } from "@/lib/drive-storage";

export interface DeleteResult {
  ok: boolean;
  error?: string;
  redirect?: string;
}

/**
 * Types d'enregistrements que le Super Admin peut supprimer définitivement.
 * Chaque entrée sait : se décrire, où rediriger ensuite, et comment se supprimer
 * (les enfants en cascade sont gérés par le schéma ; les Documents/Commentaires
 * polymorphes sont nettoyés ici à la main car non rattachés par clé étrangère).
 */
type DeletableKind =
  | "REGULATORY_PRODUCT"
  | "SPONSORING"
  | "EVENT"
  | "EMPLOYEE"
  | "HR_REQUEST"
  | "DOSSIER"
  | "ADMIN_REQUEST"
  | "MEETING"
  | "FIELD_REPORT"
  | "SALE"
  | "DOCTOR"
  | "BD_OPPORTUNITY"
  | "BD_PROJECT"
  | "DIRECTIVE"
  | "SUPPORT_REQUEST"
  | "FINANCE_TRANSACTION"
  | "EXPENSE_ORDER"
  | "SUPPLIER"
  | "MEDICAL_INFO_DECLARATION"
  | "PROMO_MATERIAL"
  | "CONGRESS_INTERNATIONAL"
  | "CONGRESS_NATIONAL"
  | "VALIDATION_REQUEST";

interface KindSpec {
  label: string; // libellé du type (« dossier réglementaire »)
  module: string; // module pour le journal d'audit
  redirect: string; // liste où l'élément disparaît après suppression
  entityType?: EntityType; // pour nettoyer Documents + Commentaires polymorphes
  /** Nom du délégué Prisma (snapshot avant suppression + restauration générique). */
  model: string;
  describe: (id: string) => Promise<string | null>; // nom lisible, ou null si introuvable
  remove: (id: string) => Promise<void>; // suppression de la ligne principale
}

const REGISTRY: Record<DeletableKind, KindSpec> = {
  REGULATORY_PRODUCT: {
    label: "dossier réglementaire",
    module: "Regulatory",
    redirect: "/regulatory",
    model: "regulatoryProduct",
    entityType: "REGULATORY_PRODUCT",
    async describe(id) {
      const r = await prisma.regulatoryProduct.findUnique({ where: { id }, select: { reference: true, dci: true } });
      return r ? `${r.reference} — ${r.dci}` : null;
    },
    async remove(id) {
      await prisma.regulatoryProduct.delete({ where: { id } });
    },
  },
  SPONSORING: {
    label: "demande de congrès / sponsoring",
    module: "Sponsoring",
    redirect: "/sponsoring",
    model: "sponsoringRequest",
    entityType: "SPONSORING",
    async describe(id) {
      const r = await prisma.sponsoringRequest.findUnique({ where: { id }, select: { reference: true, institution: true } });
      return r ? `${r.reference} — ${r.institution}` : null;
    },
    async remove(id) {
      await prisma.sponsoringRequest.delete({ where: { id } });
    },
  },
  EVENT: {
    label: "événement",
    module: "Événements",
    redirect: "/events",
    model: "event",
    async describe(id) {
      const r = await prisma.event.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.event.delete({ where: { id } });
    },
  },
  EMPLOYEE: {
    label: "employé",
    module: "RH",
    redirect: "/rh",
    model: "employee",
    entityType: "EMPLOYEE",
    async describe(id) {
      const r = await prisma.employee.findUnique({ where: { id }, select: { fullName: true } });
      return r ? r.fullName : null;
    },
    async remove(id) {
      await prisma.employee.delete({ where: { id } });
    },
  },
  // Une SEULE demande RH (attestation, note de frais, entrevue…) — jamais l'employé.
  HR_REQUEST: {
    label: "demande RH",
    module: "RH",
    redirect: "/rh",
    model: "hrDocumentRequest",
    entityType: "HR_REQUEST",
    async describe(id) {
      const r = await prisma.hrDocumentRequest.findUnique({
        where: { id },
        select: { type: true, employee: { select: { fullName: true } } },
      });
      return r ? `Demande ${r.type} — ${r.employee.fullName}` : null;
    },
    async remove(id) {
      await prisma.hrDocumentRequest.delete({ where: { id } });
    },
  },
  DOSSIER: {
    label: "projet",
    module: "Projets",
    redirect: "/dossiers",
    model: "dossier",
    entityType: "DOSSIER",
    async describe(id) {
      const r = await prisma.dossier.findUnique({ where: { id }, select: { title: true } });
      return r ? r.title : null;
    },
    async remove(id) {
      await prisma.dossier.delete({ where: { id } });
    },
  },
  ADMIN_REQUEST: {
    label: "demande administrative",
    module: "Demandes",
    redirect: "/demandes",
    model: "administrativeRequest",
    entityType: "ADMIN_REQUEST",
    async describe(id) {
      const r = await prisma.administrativeRequest.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? `${r.reference} — ${r.title}` : null;
    },
    async remove(id) {
      await prisma.administrativeRequest.delete({ where: { id } });
    },
  },
  MEETING: {
    label: "réunion",
    module: "Réunions",
    redirect: "/meetings",
    model: "meeting",
    async describe(id) {
      const r = await prisma.meeting.findUnique({ where: { id }, select: { title: true } });
      return r ? r.title : null;
    },
    async remove(id) {
      await prisma.meeting.delete({ where: { id } });
    },
  },
  FIELD_REPORT: {
    label: "rapport terrain",
    module: "Promotion médicale",
    redirect: "/field-reports",
    model: "fieldReport",
    async describe(id) {
      const r = await prisma.fieldReport.findUnique({ where: { id }, select: { doctorName: true, institution: true, visitDate: true } });
      return r ? `${r.doctorName || r.institution || "Rapport"} — ${r.visitDate.toLocaleDateString("fr-FR")}` : null;
    },
    async remove(id) {
      // L'audio (blob chiffré) est conservé pour la restauration ; il n'est
      // libéré qu'à la destruction réelle depuis la corbeille.
      await prisma.fieldReport.delete({ where: { id } });
    },
  },
  SALE: {
    label: "vente",
    module: "Ventes",
    redirect: "/sales",
    model: "sale",
    entityType: "SALE",
    async describe(id) {
      const r = await prisma.sale.findUnique({ where: { id }, select: { product: true, client: true } });
      return r ? `${r.product} — ${r.client}` : null;
    },
    async remove(id) {
      await prisma.sale.delete({ where: { id } });
    },
  },
  DOCTOR: {
    label: "médecin",
    module: "Médical",
    redirect: "/medical",
    model: "medicalDoctor",
    entityType: "DOCTOR",
    async describe(id) {
      const r = await prisma.medicalDoctor.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.medicalDoctor.delete({ where: { id } });
    },
  },
  BD_OPPORTUNITY: {
    label: "opportunité (Business Development)",
    module: "Business Development",
    redirect: "/business-development",
    model: "businessDevelopmentOpportunity",
    entityType: "BD_OPPORTUNITY",
    async describe(id) {
      const r = await prisma.businessDevelopmentOpportunity.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.businessDevelopmentOpportunity.delete({ where: { id } });
    },
  },
  BD_PROJECT: {
    label: "projet (Business Development)",
    module: "Business Development",
    redirect: "/business-development",
    model: "bdProject",
    entityType: "BD_PROJECT",
    async describe(id) {
      const r = await prisma.bdProject.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.bdProject.delete({ where: { id } });
    },
  },
  DIRECTIVE: {
    label: "directive",
    module: "Directives",
    redirect: "/directives",
    model: "directive",
    entityType: "DIRECTIVE",
    async describe(id) {
      const r = await prisma.directive.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? `${r.reference} — ${r.title}` : null;
    },
    async remove(id) {
      await prisma.directive.delete({ where: { id } });
    },
  },
  SUPPORT_REQUEST: {
    label: "demande de support",
    module: "Support",
    redirect: "/support",
    model: "supportRequest",
    entityType: "SUPPORT_REQUEST",
    async describe(id) {
      const r = await prisma.supportRequest.findUnique({ where: { id }, select: { reference: true, subject: true } });
      return r ? `${r.reference} — ${r.subject}` : null;
    },
    async remove(id) {
      await prisma.supportRequest.delete({ where: { id } });
    },
  },
  FINANCE_TRANSACTION: {
    label: "écriture comptable",
    module: "Finances",
    redirect: "/finances",
    model: "financeTransaction",
    entityType: "FINANCE_TRANSACTION",
    async describe(id) {
      const r = await prisma.financeTransaction.findUnique({ where: { id }, select: { reference: true, label: true } });
      return r ? `${r.reference} — ${r.label}` : null;
    },
    async remove(id) {
      await prisma.financeTransaction.delete({ where: { id } });
    },
  },
  EXPENSE_ORDER: {
    label: "ordre de dépense",
    module: "Finances",
    redirect: "/finances/ordres-de-depense",
    model: "expenseOrder",
    entityType: "EXPENSE_ORDER",
    async describe(id) {
      const r = await prisma.expenseOrder.findUnique({ where: { id }, select: { reference: true, label: true } });
      return r ? `${r.reference} — ${r.label}` : null;
    },
    async remove(id) {
      await prisma.expenseOrder.delete({ where: { id } });
    },
  },
  SUPPLIER: {
    label: "fournisseur",
    module: "Administration",
    redirect: "/admin/suppliers",
    model: "supplier",
    entityType: "SUPPLIER",
    async describe(id) {
      const r = await prisma.supplier.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.supplier.delete({ where: { id } });
    },
  },
  MEDICAL_INFO_DECLARATION: {
    label: "déclaration d'information médicale",
    module: "Information médicale",
    redirect: "/information-medicale",
    model: "medicalInfoDeclaration",
    entityType: "MEDICAL_INFO_DECLARATION",
    async describe(id) {
      const r = await prisma.medicalInfoDeclaration.findUnique({ where: { id }, select: { reference: true, label: true } });
      return r ? `${r.reference} — ${r.label}` : null;
    },
    async remove(id) {
      await prisma.medicalInfoDeclaration.delete({ where: { id } });
    },
  },
  PROMO_MATERIAL: {
    label: "dossier de matériel promotionnel",
    module: "Matériel promotionnel",
    redirect: "/promo-material",
    model: "promoMaterial",
    entityType: "PROMO_MATERIAL",
    async describe(id) {
      const r = await prisma.promoMaterial.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? `${r.reference} — ${r.title}` : null;
    },
    async remove(id) {
      await prisma.promoMaterial.delete({ where: { id } });
    },
  },
  CONGRESS_INTERNATIONAL: {
    label: "demande de congrès international",
    module: "Prises en charge Internationales",
    redirect: "/congress-international",
    model: "congressInternational",
    entityType: "CONGRESS_INTERNATIONAL",
    async describe(id) {
      const r = await prisma.congressInternational.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.congressInternational.delete({ where: { id } });
    },
  },
  CONGRESS_NATIONAL: {
    label: "demande d'événement national",
    module: "Prises en charge Nationales",
    redirect: "/congress-national",
    model: "congressNational",
    entityType: "CONGRESS_NATIONAL",
    async describe(id) {
      const r = await prisma.congressNational.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.congressNational.delete({ where: { id } });
    },
  },
  VALIDATION_REQUEST: {
    label: "demande de validation",
    module: "Validations",
    redirect: "/validations",
    model: "validationRequest",
    entityType: "VALIDATION_REQUEST",
    async describe(id) {
      const r = await prisma.validationRequest.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? `${r.reference} — ${r.title}` : null;
    },
    async remove(id) {
      await prisma.validationRequest.delete({ where: { id } });
    },
  },
};

function isKind(v: string): v is DeletableKind {
  return Object.prototype.hasOwnProperty.call(REGISTRY, v);
}

/** Délégué Prisma générique (snapshot / restauration) pour un kind du registre. */
function delegateOf(spec: KindSpec) {
  return (prisma as unknown as Record<string, { findUnique: (a: { where: { id: string } }) => Promise<Record<string, unknown> | null>; create: (a: { data: Record<string, unknown> }) => Promise<unknown> }>)[spec.model];
}

/**
 * Suppression « définitive » d'un enregistrement par le Super Admin (et lui seul).
 * RÉVERSIBLE : un instantané complet (ligne principale + pièces jointes + commentaires)
 * est déposé dans la corbeille du Super Admin (Administration → Corbeille), d'où il peut
 * être restauré — ou détruit pour de bon (là seulement, les fichiers sont effacés).
 * Les enfants supprimés en cascade par le schéma ne sont pas restaurables.
 */
export async function superAdminDelete(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") {
    return { ok: false, error: "Réservé au Super Admin." };
  }

  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id || !isKind(kind)) return { ok: false, error: "Élément invalide." };

  const spec = REGISTRY[kind];
  const name = await spec.describe(id);
  if (name === null) return { ok: false, error: "Élément introuvable (déjà supprimé ?)." };

  // 0) Instantané de la ligne principale (tous les champs scalaires/Json).
  const payload = await delegateOf(spec).findUnique({ where: { id } });
  if (!payload) return { ok: false, error: "Élément introuvable (déjà supprimé ?)." };

  // 1) Instantané puis retrait des Documents/Commentaires polymorphes. Les FICHIERS
  //    restent dans le stockage : ils ne sont effacés qu'à la destruction réelle.
  let docsSnapshot: Record<string, unknown>[] = [];
  let commentsSnapshot: Record<string, unknown>[] = [];
  if (spec.entityType) {
    docsSnapshot = (await prisma.document.findMany({ where: { entityType: spec.entityType, entityId: id } })) as unknown as Record<string, unknown>[];
    commentsSnapshot = (await prisma.comment.findMany({ where: { entityType: spec.entityType, entityId: id } })) as unknown as Record<string, unknown>[];
    await prisma.document.deleteMany({ where: { entityType: spec.entityType, entityId: id } });
    await prisma.comment.deleteMany({ where: { entityType: spec.entityType, entityId: id } });
  }

  // 2) Suppression de la ligne principale (les enfants en cascade suivent).
  try {
    await spec.remove(id);
  } catch (err) {
    console.error("[superAdminDelete] échec suppression", kind, id, err);
    // Remet les documents/commentaires retirés à l'étape 1 (la ligne principale existe encore).
    if (spec.entityType) {
      if (docsSnapshot.length) await prisma.document.createMany({ data: docsSnapshot as never[] }).catch(() => {});
      if (commentsSnapshot.length) await prisma.comment.createMany({ data: commentsSnapshot as never[] }).catch(() => {});
    }
    return { ok: false, error: "Suppression impossible (des éléments liés bloquent). Détachez-les puis réessayez." };
  }

  // 3) Dépôt dans la corbeille du Super Admin (restaurable).
  await prisma.deletedRecord.create({
    data: {
      kind, label: spec.label, name, sourceId: id,
      payload: payload as Prisma.InputJsonValue,
      documents: docsSnapshot.length ? (docsSnapshot as Prisma.InputJsonValue) : undefined,
      comments: commentsSnapshot.length ? (commentsSnapshot as Prisma.InputJsonValue) : undefined,
      deletedById: user.id,
    },
  });

  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    module: spec.module,
    entityType: spec.entityType,
    entityId: id,
    summary: `Suppression définitive (Super Admin) — ${spec.label} « ${name} » (restaurable depuis la corbeille)`,
  });

  revalidatePath(spec.redirect);
  return { ok: true, redirect: spec.redirect };
}

/**
 * Restaure un élément de la corbeille des suppressions définitives : la ligne
 * principale est recréée à l'identique (mêmes id/référence), ainsi que ses pièces
 * jointes et commentaires. Les enfants perdus en cascade ne reviennent pas.
 */
export async function restoreDeletedRecord(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const recId = String(formData.get("id") ?? "");
  const rec = await prisma.deletedRecord.findUnique({ where: { id: recId } });
  if (!rec || rec.restoredAt || rec.purgedAt) return { ok: false, error: "Entrée introuvable ou déjà traitée." };
  if (!isKind(rec.kind)) return { ok: false, error: "Type inconnu." };
  const spec = REGISTRY[rec.kind];

  const exists = await delegateOf(spec).findUnique({ where: { id: rec.sourceId } });
  if (exists) return { ok: false, error: "Un enregistrement avec cet identifiant existe déjà (déjà restauré ?)." };

  try {
    await delegateOf(spec).create({ data: rec.payload as Record<string, unknown> });
    const docs = (rec.documents as Record<string, unknown>[] | null) ?? [];
    if (docs.length) await prisma.document.createMany({ data: docs as never[], skipDuplicates: true });
    const comments = (rec.comments as Record<string, unknown>[] | null) ?? [];
    if (comments.length) await prisma.comment.createMany({ data: comments as never[], skipDuplicates: true });
  } catch (err) {
    console.error("[restoreDeletedRecord] échec restauration", rec.kind, rec.sourceId, err);
    return { ok: false, error: "Restauration impossible (élément lié manquant, ex. employé ou dossier parent supprimé)." };
  }

  await prisma.deletedRecord.update({ where: { id: recId }, data: { restoredAt: new Date() } });
  await recordAudit({
    actorId: user.id, action: "UPDATE", module: spec.module, entityType: spec.entityType, entityId: rec.sourceId,
    summary: `Restauration depuis la corbeille — ${spec.label} « ${rec.name} »`,
  });
  revalidatePath("/admin/corbeille");
  revalidatePath(spec.redirect);
  return { ok: true, redirect: spec.redirect };
}

/** Destruction RÉELLE d'une entrée de la corbeille : efface aussi les fichiers stockés. */
export async function destroyDeletedRecord(formData: FormData): Promise<DeleteResult> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") return { ok: false, error: "Réservé au Super Admin." };
  const recId = String(formData.get("id") ?? "");
  const rec = await prisma.deletedRecord.findUnique({ where: { id: recId } });
  if (!rec || rec.purgedAt) return { ok: false, error: "Entrée introuvable ou déjà détruite." };

  // Fichiers des pièces jointes snapshotées (s'il n'a pas été restauré).
  if (!rec.restoredAt) {
    const docs = (rec.documents as { fileKey?: string | null }[] | null) ?? [];
    for (const d of docs) {
      if (d.fileKey) await deleteFileByKey(d.fileKey).catch(() => {});
    }
    // Cas particulier : audio d'un rapport terrain (blob chiffré du Drive).
    const audioBlobId = (rec.payload as { audioBlobId?: string | null } | null)?.audioBlobId;
    if (rec.kind === "FIELD_REPORT" && audioBlobId) await releaseBlob(audioBlobId).catch(() => {});
  }

  await prisma.deletedRecord.update({ where: { id: recId }, data: { purgedAt: new Date() } });
  await recordAudit({
    actorId: user.id, action: "DELETE", module: "Administration",
    summary: `Corbeille — destruction définitive : ${rec.label} « ${rec.name} »`,
  });
  revalidatePath("/admin/corbeille");
  return { ok: true };
}
