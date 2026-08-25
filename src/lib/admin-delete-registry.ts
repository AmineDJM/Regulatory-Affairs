import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * LE REGISTRE des suppressions définitives — la source de vérité UNIQUE, partagée par :
 *   • les actions serveur de l'écran (`admin-delete-actions.ts` : bouton rouge des fiches,
 *     corbeille, suppression par le créateur) ;
 *   • le Chief of Staff (`assistant.ts` : outil `delete_record`), qui PROPOSE la même
 *     suppression et l'exécute via `superAdminDelete` — jamais une deuxième logique.
 *
 * Il vit hors du fichier `"use server"` parce qu'un module d'actions ne peut exporter que des
 * fonctions async — or l'assistant a besoin de la LISTE des types, de leurs libellés et de leurs
 * champs de recherche pour résoudre « supprime REG-2026-041 » sans dupliquer quoi que ce soit.
 */

/** Types d'enregistrements que le Super Admin peut supprimer définitivement. */
export type DeletableKind =
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
  | "VALIDATION_REQUEST"
  | "MAIL_ENTRY"
  | "LEGAL_DOCUMENT";

export interface KindSpec {
  label: string; // libellé du type (« dossier réglementaire »)
  module: string; // module pour le journal d'audit
  redirect: string; // liste où l'élément disparaît après suppression
  entityType?: EntityType; // pour nettoyer Documents + Commentaires polymorphes
  /** Nom du délégué Prisma (snapshot avant suppression + restauration générique). */
  model: string;
  describe: (id: string) => Promise<string | null>; // nom lisible, ou null si introuvable
  remove: (id: string) => Promise<void>; // suppression de la ligne principale
  /**
   * L'identifiant du créateur, quand ce type peut être supprimé par SON créateur (et pas
   * seulement par le Super Admin). Absent = suppression réservée au Super Admin.
   */
  creatorOf?: (id: string) => Promise<string | null>;
  /**
   * Champs TEXTE sur lesquels une RÉFÉRENCE HUMAINE se cherche (« REG-2026-041 », un nom,
   * un titre) — pour que l'assistant résolve l'élément sans demander l'id interne.
   * Absent = ce type ne se désigne que par id (ex. demande RH, composite sans référence).
   */
  searchFields?: string[];
}

export const DELETE_REGISTRY: Record<DeletableKind, KindSpec> = {
  REGULATORY_PRODUCT: {
    label: "dossier réglementaire",
    module: "Regulatory",
    redirect: "/regulatory",
    model: "regulatoryProduct",
    entityType: "REGULATORY_PRODUCT",
    searchFields: ["reference", "dci"],
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
    searchFields: ["reference", "institution"],
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
    searchFields: ["name"],
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
    searchFields: ["fullName"],
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
    searchFields: ["title"],
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
    searchFields: ["reference", "title"],
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
    searchFields: ["title"],
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
    searchFields: ["doctorName", "institution"],
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
    searchFields: ["product", "client"],
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
    redirect: "/medical/annuaire",
    model: "medicalDoctor",
    entityType: "DOCTOR",
    searchFields: ["name"],
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
    searchFields: ["name"],
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
    searchFields: ["name"],
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
    searchFields: ["reference", "title"],
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
    searchFields: ["reference", "subject"],
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
    searchFields: ["reference", "label"],
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
    searchFields: ["reference", "label"],
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
    searchFields: ["name"],
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
    searchFields: ["reference", "label"],
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
    searchFields: ["reference", "title"],
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
    searchFields: ["name"],
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
    searchFields: ["name"],
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
    searchFields: ["reference", "title"],
    async describe(id) {
      const r = await prisma.validationRequest.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? `${r.reference} — ${r.title}` : null;
    },
    async remove(id) {
      await prisma.validationRequest.delete({ where: { id } });
    },
  },
  MAIL_ENTRY: {
    label: "courrier",
    module: "Courriers",
    redirect: "/courriers",
    model: "mailEntry",
    entityType: "MAIL_ENTRY",
    searchFields: ["reference", "title"],
    async describe(id) {
      const r = await prisma.mailEntry.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? (r.reference ? `${r.reference} — ${r.title}` : r.title) : null;
    },
    async creatorOf(id) {
      const r = await prisma.mailEntry.findUnique({ where: { id }, select: { createdById: true } });
      return r?.createdById ?? null;
    },
    async remove(id) {
      await prisma.mailEntry.delete({ where: { id } });
    },
  },
  LEGAL_DOCUMENT: {
    label: "document légal",
    module: "Legal",
    redirect: "/legal",
    model: "legalDocument",
    entityType: "LEGAL_DOCUMENT",
    searchFields: ["reference", "title"],
    async describe(id) {
      const r = await prisma.legalDocument.findUnique({ where: { id }, select: { reference: true, title: true } });
      return r ? (r.reference ? `${r.reference} — ${r.title}` : r.title) : null;
    },
    async creatorOf(id) {
      const r = await prisma.legalDocument.findUnique({ where: { id }, select: { createdById: true } });
      return r?.createdById ?? null;
    },
    async remove(id) {
      await prisma.legalDocument.delete({ where: { id } });
    },
  },
};

/** Les kinds dans l'ordre du registre — pour les énumérations (schéma d'outil, messages). */
export const DELETABLE_KINDS = Object.keys(DELETE_REGISTRY) as DeletableKind[];

export function isDeletableKind(v: string): v is DeletableKind {
  return Object.prototype.hasOwnProperty.call(DELETE_REGISTRY, v);
}

/** Délégué Prisma générique (snapshot / restauration / recherche) pour un kind du registre. */
export function deleteDelegateOf(spec: KindSpec) {
  return (prisma as unknown as Record<string, {
    findUnique: (a: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
    findMany: (a: { where: Record<string, unknown>; select: { id: true }; take: number }) => Promise<{ id: string }[]>;
    create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
  }>)[spec.model];
}
