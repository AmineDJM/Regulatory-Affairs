"use server";

import { revalidatePath } from "next/cache";
import type { EntityType } from "@prisma/client";
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
  | "CONGRESS_NATIONAL";

interface KindSpec {
  label: string; // libellé du type (« dossier réglementaire »)
  module: string; // module pour le journal d'audit
  redirect: string; // liste où l'élément disparaît après suppression
  entityType?: EntityType; // pour nettoyer Documents + Commentaires polymorphes
  describe: (id: string) => Promise<string | null>; // nom lisible, ou null si introuvable
  remove: (id: string) => Promise<void>; // suppression de la ligne principale
}

const REGISTRY: Record<DeletableKind, KindSpec> = {
  REGULATORY_PRODUCT: {
    label: "dossier réglementaire",
    module: "Regulatory",
    redirect: "/regulatory",
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
    entityType: "EMPLOYEE",
    async describe(id) {
      const r = await prisma.employee.findUnique({ where: { id }, select: { fullName: true } });
      return r ? r.fullName : null;
    },
    async remove(id) {
      await prisma.employee.delete({ where: { id } });
    },
  },
  DOSSIER: {
    label: "dossier de suivi",
    module: "Dossiers",
    redirect: "/dossiers",
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
    async describe(id) {
      const r = await prisma.fieldReport.findUnique({ where: { id }, select: { doctorName: true, institution: true, visitDate: true } });
      return r ? `${r.doctorName || r.institution || "Rapport"} — ${r.visitDate.toLocaleDateString("fr-FR")}` : null;
    },
    async remove(id) {
      const r = await prisma.fieldReport.findUnique({ where: { id }, select: { audioBlobId: true } });
      await prisma.fieldReport.delete({ where: { id } });
      if (r?.audioBlobId) await releaseBlob(r.audioBlobId).catch(() => {});
    },
  },
  SALE: {
    label: "vente",
    module: "Ventes",
    redirect: "/sales",
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
    module: "Congrès internationaux",
    redirect: "/congress-international",
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
    module: "Événements nationaux",
    redirect: "/congress-national",
    entityType: "CONGRESS_NATIONAL",
    async describe(id) {
      const r = await prisma.congressNational.findUnique({ where: { id }, select: { name: true } });
      return r ? r.name : null;
    },
    async remove(id) {
      await prisma.congressNational.delete({ where: { id } });
    },
  },
};

function isKind(v: string): v is DeletableKind {
  return Object.prototype.hasOwnProperty.call(REGISTRY, v);
}

/**
 * Suppression DÉFINITIVE d'un enregistrement par le Super Admin (et lui seul).
 * Réservée au nettoyage des demandes de test : irréversible. Les pièces jointes
 * et commentaires liés sont eux aussi supprimés (et leurs fichiers chiffrés).
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

  // 1) Nettoyage des Documents polymorphes (+ libération des fichiers chiffrés).
  if (spec.entityType) {
    const docs = await prisma.document.findMany({
      where: { entityType: spec.entityType, entityId: id },
      select: { id: true, fileKey: true },
    });
    for (const d of docs) {
      if (d.fileKey) await deleteFileByKey(d.fileKey).catch(() => {});
    }
    await prisma.document.deleteMany({ where: { entityType: spec.entityType, entityId: id } });
    await prisma.comment.deleteMany({ where: { entityType: spec.entityType, entityId: id } });
  }

  // 2) Suppression de la ligne principale (les enfants en cascade suivent).
  try {
    await spec.remove(id);
  } catch (err) {
    console.error("[superAdminDelete] échec suppression", kind, id, err);
    return { ok: false, error: "Suppression impossible (des éléments liés bloquent). Détachez-les puis réessayez." };
  }

  await recordAudit({
    actorId: user.id,
    action: "DELETE",
    module: spec.module,
    entityType: spec.entityType,
    entityId: id,
    summary: `Suppression définitive (Super Admin) — ${spec.label} « ${name} »`,
  });

  revalidatePath(spec.redirect);
  return { ok: true, redirect: spec.redirect };
}
