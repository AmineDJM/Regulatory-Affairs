import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { legalReaderWhere } from "@/lib/legal/readers";
import { canSee as canSeeTask, canAttach as canAttachTask } from "@/lib/tasks/request-flow";
import { recruitmentViewer } from "@/lib/recruitment/access";
import { getMyCompanies } from "@/lib/company";
import {
  userCan,
  hasGlobalView,
  scopeRegulatory,
  scopeMedicalDoctors,
  scopeMedicalVisits,
  scopeSales,
  scopeBusinessDevelopment,
  scopeBdProject,
  scopeSupport,
  scopeDossiers,
  type Action,
  type Module,
  type SessionUser,
} from "@/lib/rbac";

/** Maps a polymorphic entity type to its owning module. */
export const ENTITY_MODULE: Record<EntityType, Module> = {
  REGULATORY_PRODUCT: "REGULATORY",
  REGULATORY_STEP: "REGULATORY",
  SPONSORING: "SPONSORING",
  BUDGET: "BUDGETS",
  CONGRESS_INTERNATIONAL: "CONGRESS_INTERNATIONAL",
  CONGRESS_NATIONAL: "CONGRESS_NATIONAL",
  SALE: "SALES",
  LOGISTICS: "LOGISTICS",
  DOCTOR: "MEDICAL",
  VISIT: "MEDICAL",
  DELEGATE_PLAN: "MEDICAL",
  BD_OPPORTUNITY: "BUSINESS_DEVELOPMENT",
  BD_PROJECT: "BUSINESS_DEVELOPMENT",
  FINANCE_TRANSACTION: "FINANCES",
  EMPLOYEE: "RH",
  COMPANY: "LEGAL",
  PAYROLL: "FINANCES",
  LEAVE_REQUEST: "RH",
  TASK: "WORKSPACE",
  SALARY_ADVANCE: "RH",
  EXPENSE_ORDER: "FINANCES",
  DRIVE_NODE: "DRIVE",
  ADMIN_REQUEST: "ADMIN_REQUESTS",
  DRIVER_MISSION: "ADMIN_REQUESTS",
  FEEDBACK: "WORKSPACE",
  VALIDATION_REQUEST: "VALIDATIONS",
  SUPPLIER: "REGULATORY",
  MEDICAL_INFO_DECLARATION: "MEDICAL_INFO",
  DIRECTIVE: "DIRECTIVES",
  SUPPORT_REQUEST: "SUPPORT",
  DOSSIER: "DOSSIERS",
  PROMO_MATERIAL: "PROMO_MATERIAL",
  CONSULTING_CONTRACT: "CONSULTING",
  AD_PRO_OTHER: "AD_PRO_OTHER",
  AD_PRO_ITEM: "SPONSORING",
  // Une demande de pièce n'appartient à aucun module : elle appartient à ses deux
  // interlocuteurs. Le repli sur « Mon espace » ne sert que si le contrôle nominatif
  // ci-dessous ne s'applique pas.
  DOCUMENT_REQUEST: "WORKSPACE",
  // Une demande de paiement s'instruit aux FINANCES. Le module n'est toutefois qu'un repli :
  // l'accès réel est nominatif (demandeur / destinataire / Finances), résolu plus bas — sans
  // quoi celui qui fait payer une facture aurait besoin du grand livre pour joindre sa pièce.
  PAYMENT_REQUEST: "FINANCES",
  HR_REQUEST: "RH",
  EVENT: "EVENTS",
  // Polymorphe : l'accès réel est résolu spécifiquement (assigné ou entité parente).
  MISSION_ASSIGNMENT: "WORKSPACE",
  OFFICE_SUPPLY_ARTICLE: "ADMIN_REQUESTS",
  PCH_TENDER: "PCH",
  // Justificatif d'une dépense imputée à un budget départemental.
  DEPARTMENT_EXPENSE: "BUDGETS",
  // Un courrier du registre : c'est le module Courriers qui en gouverne les pièces jointes.
  MAIL_ENTRY: "MAIL_REGISTER",
  // Un engagement de la société (contrat, bon de commande, assurance) et ses pièces.
  LEGAL_DOCUMENT: "LEGAL",
  // La demande de recrutement (fiche de poste) et les candidats (CV). Le module n'est qu'un
  // repli : l'accès réel est nominatif — demandeur, validateurs de la chaîne, RH — et résolu
  // plus bas. Un CV est une donnée personnelle : le module seul ne doit pas suffire à l'ouvrir.
  RECRUITMENT_REQUEST: "RECRUITMENT",
  RECRUITMENT_CANDIDATE: "RECRUITMENT",
};

/**
 * Authoritative server-side access check for a single entity row. Enforces both
 * module permission and row-level scope, so a user can never read/modify a row
 * outside their assignment even if they guess the id.
 */
/** Le demandeur d'une demande de sponsoring/congrès en est-il le requester ? */
async function isRequestOwner(user: SessionUser, entityType: EntityType, entityId: string): Promise<boolean> {
  if (entityType === "SPONSORING") {
    const r = await prisma.sponsoringRequest.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  if (entityType === "CONGRESS_INTERNATIONAL") {
    const r = await prisma.congressInternational.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  if (entityType === "CONGRESS_NATIONAL") {
    const r = await prisma.congressNational.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  if (entityType === "EVENT") {
    const r = await prisma.event.findUnique({ where: { id: entityId }, select: { requesterId: true } });
    return r?.requesterId === user.id;
  }
  return false;
}

export async function canAccessEntity(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
  action: Action = "VIEW",
): Promise<boolean> {
  const module = ENTITY_MODULE[entityType];

  // DEMANDE DE PIÈCE : l'accès ne vient PAS du module de l'objet visé. Celui à qui l'on réclame
  // une facture n'a pas forcément accès au poste de dépense — et il ne doit pas y avoir accès
  // pour autant. Il vient du fil : on a demandé, ou on est celui à qui l'on demande.
  if (entityType === "DOCUMENT_REQUEST") {
    if (hasGlobalView(user.role)) return true;
    const r = await prisma.documentRequest.findUnique({
      where: { id: entityId }, select: { askedById: true, askedToId: true, status: true },
    });
    if (!r) return false;
    if (r.askedById === user.id) return true;
    // Celui qui dépose ne peut plus toucher aux pièces une fois la demande close : sinon on ne
    // saurait plus laquelle a servi à la décision.
    if (r.askedToId !== user.id) return false;
    return action === "VIEW" || (r.status !== "ACCEPTED" && r.status !== "CANCELLED");
  }

  // DEMANDE DE PAIEMENT : l'accès ne vient PAS d'un module, mais du CERCLE du dossier.
  //
  // N'importe qui peut avoir à faire payer une facture — un chef de produit, une assistante, un
  // délégué — sans avoir la moindre raison de voir le grand livre ou la trésorerie. Exiger le
  // module Finances fermerait les pièces à ceux-là mêmes qui doivent les déposer ; exiger le
  // module de validation les fermerait à qui dépose sa première demande.
  //
  // La garde est donc le CERCLE du dossier — demandeur, destinataire, Finances — et elle ne
  // dépend PAS de l'écran où le dossier s'affiche. C'est ce qui lui a permis de traverser sans
  // dommage ses deux déménagements (Validations → Finances → Validations).
  if (entityType === "PAYMENT_REQUEST") {
    if (hasGlobalView(user.role)) return true;
    const r = await prisma.paymentRequest.findUnique({
      where: { id: entityId }, select: { requesterId: true, recipientId: true },
    });
    if (!r) return false;
    if (r.requesterId === user.id || r.recipientId === user.id) return true;
    return user.role === "FINANCE_BUDGET_MANAGER"
      || userCan(user, "FINANCES", "VALIDATE") || userCan(user, "FINANCES", "UPDATE");
  }

  // DIRECTIVE : la pièce jointe EST souvent la note (un PDF signé, un formulaire). Elle suit
  // donc exactement la note — même portée, même règle de publication. Le module seul ne suffit
  // pas : presque tout le monde a « Directives », et une note adressée aux salariés d'une entité
  // ne s'ouvre pas à ceux d'à côté.
  if (entityType === "DIRECTIVE") {
    if (hasGlobalView(user.role)) return true;
    const d = await prisma.directive.findUnique({
      where: { id: entityId },
      select: {
        audience: true, targetUserIds: true, targetUserId: true, targetRole: true,
        companyId: true, publication: true, fromId: true,
      },
    });
    if (!d) return false;
    if (d.fromId === user.id) return true;
    // Déposer une pièce reste l'affaire de l'émetteur et de la Direction : un destinataire
    // répond dans le fil, il n'ajoute pas de document à la note de service.
    if (action !== "VIEW") return userCan(user, "DIRECTIVES", "CREATE");
    if (d.publication !== "PUBLISHED") return userCan(user, "DIRECTIVES", "CREATE");
    const { isRecipient } = await import("@/lib/directives/audience");
    const { companyIdsOf } = await import("@/lib/directives/recipients");
    return isRecipient(
      { id: user.id, role: user.role, secondaryRole: user.secondaryRole ?? null, companyIds: await companyIdsOf(user.id) },
      {
        audience: d.audience,
        // Compat : les notes d'avant les portées multiples ne portent que `targetUserId`.
        targetUserIds: d.targetUserIds.length ? d.targetUserIds : (d.targetUserId ? [d.targetUserId] : []),
        targetRole: d.targetRole,
        companyId: d.companyId,
      },
    );
  }

  // Le DEMANDEUR d'une demande de sponsoring/congrès peut toujours consulter et
  // joindre des pièces à SA propre demande (devis, programme…), même si son rôle
  // n'a pas le droit UPLOAD du module.
  if (
    (action === "VIEW" || action === "UPLOAD") &&
    (entityType === "SPONSORING" || entityType === "CONGRESS_INTERNATIONAL" || entityType === "CONGRESS_NATIONAL" || entityType === "EVENT") &&
    (await isRequestOwner(user, entityType, entityId))
  ) {
    return true;
  }

  // L'Assistante de Direction pilote le circuit Matériel promotionnel depuis les
  // Demandes administratives, SANS accès au module dédié : elle peut consulter,
  // joindre et gérer les pièces du dossier promo lié.
  if (entityType === "PROMO_MATERIAL" && user.role === "DIRECTION_ASSISTANT") {
    return true;
  }

  // L'Assistante de Direction tient le **bureau du secrétariat** : elle modère TOUTE
  // demande administrative (éditer/supprimer les messages, supprimer / renommer /
  // re-téléverser les pièces jointes), quel que soit le demandeur ou l'assignation.
  if (entityType === "ADMIN_REQUEST" && user.role === "DIRECTION_ASSISTANT") {
    return true;
  }

  // Information médicale : le pharmacien responsable (ou un manager info médicale)
  // qui instruit une déclaration peut CONSULTER les pièces de l'événement SOURCE
  // (congrès / sponsoring), même sans accès au module concerné.
  if (
    action === "VIEW" &&
    (entityType === "SPONSORING" || entityType === "CONGRESS_INTERNATIONAL" || entityType === "CONGRESS_NATIONAL" || entityType === "EVENT")
  ) {
    const isMedManager = hasGlobalView(user.role) || user.role === "MEDICAL_INFO_PHARMACIST" || userCan(user, "MEDICAL_INFO", "VALIDATE");
    if (isMedManager) {
      const decl = await prisma.medicalInfoDeclaration.findUnique({
        where: { sourceType_sourceId: { sourceType: entityType, sourceId: entityId } },
        select: { pharmacistId: true },
      });
      if (decl && (decl.pharmacistId === user.id || hasGlobalView(user.role) || userCan(user, "MEDICAL_INFO", "VALIDATE"))) {
        return true;
      }
    }
  }

  // Demande RH : l'employé demandeur peut consulter et joindre des pièces à SA
  // demande (justificatif, arrêt maladie…), même sans droit sur le module RH.
  if (entityType === "HR_REQUEST" && (action === "VIEW" || action === "UPLOAD" || action === "UPDATE")) {
    const req = await prisma.hrDocumentRequest.findUnique({ where: { id: entityId }, select: { employee: { select: { userId: true } } } });
    if (req?.employee?.userId === user.id) return true;
  }

  // Ordre de mission (accompagnant / délégué de référence) : la personne assignée
  // accède toujours à SON assignation (voir, joindre l'ordre de mission, discuter,
  // demander). Sinon on délègue à l'accès de l'entité parente (responsables) — VIEW
  // pour consulter, UPDATE pour émettre/gérer. La suppression passe par le parent.
  if (entityType === "MISSION_ASSIGNMENT") {
    const a = await prisma.missionAssignment.findUnique({
      where: { id: entityId },
      select: { userId: true, entityType: true, entityId: true },
    });
    if (!a) return false;
    if (a.userId === user.id) return action !== "DELETE";
    return canAccessEntity(user, a.entityType, a.entityId, action === "VIEW" ? "VIEW" : "UPDATE");
  }

  if (!userCan(user, module, action)) return false;

  switch (entityType) {
    case "REGULATORY_PRODUCT": {
      const found = await prisma.regulatoryProduct.findFirst({
        where: { id: entityId, ...scopeRegulatory(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "DOCTOR": {
      const found = await prisma.medicalDoctor.findFirst({
        where: { id: entityId, ...scopeMedicalDoctors(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "VISIT": {
      const found = await prisma.medicalVisit.findFirst({
        where: { id: entityId, ...scopeMedicalVisits(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "SALE": {
      const found = await prisma.sale.findFirst({
        where: { id: entityId, ...scopeSales(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "BD_OPPORTUNITY": {
      const found = await prisma.businessDevelopmentOpportunity.findFirst({
        where: { id: entityId, ...scopeBusinessDevelopment(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "BD_PROJECT": {
      const found = await prisma.bdProject.findFirst({
        where: { id: entityId, ...scopeBdProject(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "SUPPORT_REQUEST": {
      const found = await prisma.supportRequest.findFirst({
        where: { id: entityId, ...scopeSupport(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "DOSSIER": {
      const found = await prisma.dossier.findFirst({
        where: { id: entityId, ...scopeDossiers(user) },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "MAIL_ENTRY": {
      // Le registre est CLOISONNÉ PAR ENTITÉ : avoir le module Courriers ne donne pas accès aux
      // plis d'une autre société du groupe. Sans ce contrôle, une pièce jointe se téléverserait
      // sur le courrier d'une entité voisine en devinant son identifiant.
      const found = await prisma.mailEntry.findFirst({
        where: { AND: [{ id: entityId }, await platformScope(user.id)] },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "COMPANY": {
      // Les pièces d'identité d'une société ne se lisent QUE depuis son périmètre : le module
      // Legal ne donne pas accès aux statuts et au RIB de toutes les sociétés du groupe.
      const mine = await getMyCompanies(user.id);
      return mine.some((c) => c.id === entityId);
    }
    case "TASK": {
      // Une tâche appartient à SON CERCLE — la personne chargée, le demandeur, les participants,
      // les lecteurs — et non à tous ceux qui ont « Mon espace ». Sans ce contrôle, les pièces
      // déposées en réponse à une demande (devis, contrat, bulletin) se téléchargeraient en
      // devinant un identifiant, puisque tout le monde a le module.
      const t = await prisma.task.findUnique({
        where: { id: entityId },
        select: { assignedToId: true, createdById: true, participantIds: true, readerIds: true, status: true, requestedAt: true },
      });
      if (!t) return false;
      if (hasGlobalView(user.role)) return true;
      if (!canSeeTask(t, user.id)) return false;
      // Un LECTEUR regarde : il ne dépose ni ne supprime les pièces d'un travail qui n'est pas
      // le sien. Le demandeur, lui, complète sa propre demande.
      return action === "VIEW" || canAttachTask(t, user.id);
    }
    case "LEGAL_DOCUMENT": {
      // Deux gardes : l'ENTITÉ (les engagements d'une société ne se lisent pas depuis une autre)
      // ET les LECTEURS DÉSIGNÉS. Cette porte-ci gouverne les pièces jointes, les commentaires
      // et les liaisons : sans la seconde, un document restreint resterait fermé à l'écran mais
      // ses pièces se téléchargeraient encore par leur identifiant.
      const readerScope = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
      const found = await prisma.legalDocument.findFirst({
        where: { AND: [{ id: entityId }, await platformScope(user.id), ...(readerScope ? [readerScope] : [])] },
        select: { id: true },
      });
      return Boolean(found);
    }
    case "RECRUITMENT_REQUEST": {
      // Un CV et une fourchette de rémunération sont des données PERSONNELLES : avoir le module
      // ne suffit pas. Il faut être partie à la demande — l'avoir écrite, devoir la valider, ou
      // tenir les RH. Sans cette porte, la fiche de poste et les CV se téléchargeraient en
      // devinant un identifiant.
      return Boolean(await recruitmentViewer(user, entityId));
    }
    case "RECRUITMENT_CANDIDATE": {
      // Le CV suit sa DEMANDE : les mêmes personnes, ni plus ni moins.
      const c = await prisma.recruitmentCandidate.findUnique({
        where: { id: entityId },
        select: { requestId: true },
      });
      return c ? Boolean(await recruitmentViewer(user, c.requestId)) : false;
    }
    default:
      // Modules without row-level scoping: module permission is sufficient.
      return true;
  }
}

/**
 * Peut-on **modérer** le contenu (commentaires, pièces jointes, messages) d'un objet ?
 * Règle unifiée : quiconque peut **éditer** l'objet parent — c'est-à-dire l'administrateur
 * (vue globale, périmètre ALL) ou son responsable/contributeur — peut nettoyer ce qui y a
 * été envoyé. L'auteur d'un élément garde toujours la main sur le sien (vérifié à part).
 */
export async function canModerateEntity(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
): Promise<boolean> {
  return canAccessEntity(user, entityType, entityId, "UPDATE");
}
