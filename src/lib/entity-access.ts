import type { EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { legalKindVisible, legalReaderWhere, legalViewScope, legalWriteAllowed } from "@/lib/lecteurs/legal";
import { canSee as canSeeTask, canAttach as canAttachTask } from "@/lib/tasks/request-flow";
import { recruitmentViewer } from "@/lib/recruitment/access";
import { isOwnBusiness } from "@/lib/ad-pro/attachments";
import { parentDuPoste, PARENT_ENTITE } from "@/lib/ad-pro-items";
import { MODULE_DU_POLE, poleDe } from "@/lib/lecteurs/consulting";
import { annuaireDuPraticien } from "@/lib/annuaires/acces";
import { getMyCompanies } from "@/lib/company";
import { peutOuvrirLeDossierPromo } from "@/lib/queries/promo-circuit";
import { projetsBdVisibles } from "@/lib/queries/bd";
import {
  userCan, hasGlobalView, scopeRegulatory, scopeMedicalDoctors, scopeMedicalVisits, scopeSales, scopeBusinessDevelopment, scopeSupport, scopeDossiers, type Action, type Module, type SessionUser,
  annuaireOuvertParConsole, scopeCongressIntl, scopeCongressNational, scopePromoMaterial,
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
  BD_PROJECT: "BD_PROJECTS",
  FINANCE_TRANSACTION: "FINANCES",
  EMPLOYEE: "RH",
  COMPANY: "LEGAL",
  PAYROLL: "FINANCES",
  LEAVE_REQUEST: "RH",
  TASK: "WORKSPACE",
  SALARY_ADVANCE: "RH",
  EXPENSE_ORDER: "FINANCES",
  INVOICE: "FINANCES",
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
  PCH_ORDER: "PCH",
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

/** Les cinq natures de dossier du module Ad&Pro. */
const AD_PRO_TYPES: EntityType[] = [
  "SPONSORING", "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "EVENT", "PROMO_MATERIAL",
];

/**
 * LE MODULE QUI GARDE UN ENREGISTREMENT — celui de `ENTITY_MODULE`, sauf quand il dépend de la LIGNE.
 *
 * Un CONTRAT DE CONSULTING n'a pas de module fixe : son PÔLE dit lequel le garde (§118.150).
 * Lire `CONSULTING` en dur laisserait la promotion ouvrir le contrat d'un consultant passé aux
 * RH — sa rémunération comprise — et fermerait ce même contrat aux RH qui le suivent : la porte
 * ouverte à côté de la porte fermée (§118.71). L'imputation budgétaire automatique d'un paiement
 * lit la même réponse : un consultant RH se paie sur une enveloppe RH, pas sur celle d'Ad & Pro.
 */
export async function moduleDeLEntite(entityType: EntityType, entityId: string): Promise<Module> {
  return (await modulesDesEntites([{ entityType, entityId }])).get(`${entityType}:${entityId}`) ?? ENTITY_MODULE[entityType];
}

/**
 * LA MÊME RÉPONSE, EN LOT — clé `TYPE:id`. Un écran de cent paiements fait UNE lecture des pôles,
 * jamais cent (§118.102b) ; et c'est la même fonction que l'action serveur, sans quoi l'écran
 * proposerait un classement que le serveur ne ferait pas.
 */
export async function modulesDesEntites(
  entites: readonly { entityType: EntityType; entityId: string }[],
): Promise<Map<string, Module>> {
  const res = new Map<string, Module>();
  const contrats = entites.filter((e) => e.entityType === "CONSULTING_CONTRACT").map((e) => e.entityId);
  // L'échec de cette lecture n'est PAS avalé : retomber sur le défaut du schéma (Ad & Pro) ouvrirait
  // à la promotion, sur une simple panne de lecture, le contrat qu'on vient de confier aux RH. Une
  // garde ne se trompe que dans le sens qui ferme — l'erreur remonte, et l'appelant refuse (§118.150).
  const poles = contrats.length
    ? await prisma.consultingContract
        .findMany({ where: { id: { in: [...new Set(contrats)] } }, select: { id: true, pole: true } })
    : [];
  const poleDuContrat = new Map(poles.map((c) => [c.id, poleDe(c.pole)]));
  for (const e of entites) {
    res.set(
      `${e.entityType}:${e.entityId}`,
      e.entityType === "CONSULTING_CONTRACT" ? MODULE_DU_POLE[poleDuContrat.get(e.entityId) ?? "AD_PRO"] : ENTITY_MODULE[e.entityType],
    );
  }
  return res;
}

/**
 * LES PARTIES PRENANTES NOMMÉES d'un dossier Ad&Pro — demandeur, Direction Marketing, assistante.
 *
 * Elles instruisent ce dossier-là. Leur refuser d'y joindre la facture ne protège rien : cela
 * sort la pièce de l'ERP, et six semaines plus tard personne ne sait plus à quel événement elle
 * correspondait.
 */
async function adProStakeholders(
  entityType: EntityType, entityId: string,
): Promise<{ requesterId?: string | null; productManagerId?: string | null; assistantId?: string | null } | null> {
  const sel = { select: { requesterId: true, productManagerId: true } } as const;
  switch (entityType) {
    case "SPONSORING": return prisma.sponsoringRequest.findUnique({ where: { id: entityId }, ...sel });
    case "CONGRESS_INTERNATIONAL": return prisma.congressInternational.findUnique({ where: { id: entityId }, ...sel });
    case "CONGRESS_NATIONAL": return prisma.congressNational.findUnique({ where: { id: entityId }, ...sel });
    case "EVENT": return prisma.event.findUnique({ where: { id: entityId }, ...sel });
    case "PROMO_MATERIAL":
      return prisma.promoMaterial.findUnique({ where: { id: entityId }, select: { requesterId: true, assistantId: true } });
    default: return null;
  }
}

/**
 * LA PORTÉE DE LIGNE d'un objet Ad & Pro — la MÊME que sa fiche et que ses listes (§118.153).
 *
 * Trois modules Ad & Pro ont une portée « ses lignes » : congrès international, congrès national
 * et matériel promotionnel (le délégué, et depuis §118.153 le National Sales, n'y voient que LEURS
 * dossiers). La fiche l'appliquait, les listes aussi ; cette porte-ci — celle des pièces, des
 * commentaires et du fil — ne l'appliquait pas : le raccourci « UPDATE sur le module » et le
 * `default` du dernier aiguillage ouvraient n'importe quel dossier à qui avait le module, sur son
 * seul identifiant. Mesuré par le banc du circuit 2 : ouvrir le matériel promotionnel au National
 * Sales lui faisait lire le dossier d'un KAM dont il n'est pas le N+1. Sponsoring et événements
 * n'ont pas de portée de ligne : qui a le module les voit tous, comme dans leur liste.
 *
 * Les clauses se COMPOSENT en `AND`, jamais par étalement (§118.133) : `{ id: "__none__" }` et
 * `{ OR: … }` ne doivent jamais pouvoir écraser l'identifiant visé.
 */
async function dansLaPorteeAdPro(user: SessionUser, entityType: EntityType, entityId: string): Promise<boolean> {
  switch (entityType) {
    case "CONGRESS_INTERNATIONAL":
      return (await prisma.congressInternational.count({ where: { AND: [{ id: entityId }, scopeCongressIntl(user)] } })) > 0;
    case "CONGRESS_NATIONAL":
      return (await prisma.congressNational.count({ where: { AND: [{ id: entityId }, scopeCongressNational(user)] } })) > 0;
    case "PROMO_MATERIAL":
      return (await prisma.promoMaterial.count({ where: { AND: [{ id: entityId }, scopePromoMaterial(user)] } })) > 0;
    default:
      return true;
  }
}

/**
 * LES PIÈCES LEGAL qu'une personne peut ouvrir, alimenter ou gérer — EN LOT, par LA règle de la
 * porte unitaire (`canAccessEntity` n'en est que l'appel sur un seul identifiant).
 *
 * ── POURQUOI UNE LECTURE EN LOT ─────────────────────────────────────────────────────────────
 *
 * Les pièces liées d'une fiche Ad & Pro (§118.161) proposent, ligne par ligne, d'ouvrir les PDF
 * d'un devis, d'y en joindre un, de le renommer. Chaque bouton doit correspondre EXACTEMENT à ce
 * que le serveur acceptera — un bouton visible qui refuse ensuite fait chercher la panne au lieu
 * de faire demander le droit. Trente appels unitaires par ouverture de fiche feraient soixante
 * allers-retours (§118.102b) ; une seconde écriture de la règle à côté de la porte finirait par
 * diverger d'elle (§118.5). Il n'y en a donc qu'une, et la porte unitaire la lit.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────────────────────
 *
 *  • La PORTE DE LA FICHE, par nature de pièce, PUIS la portée de la LIGNE : l'entité (les
 *    engagements d'une société ne se lisent pas depuis une autre) ET les lecteurs désignés —
 *    sans ces derniers, un document restreint resterait fermé à l'écran mais ses pièces se
 *    téléchargeraient encore par leur identifiant. Même porte que la liste Legal : un engagement
 *    sans entité y figure, ses pièces s'ouvrent donc aussi.
 *  • La porte de la fiche a TROIS entrées (`legalViewScope`) : Legal ouvre tout le registre, les
 *    Finances la chaîne d'achat (factures et bons de commande), le module « Bons de commande » les
 *    seuls bons de commande (§118.176). Cette fonction ne lisait que la première : la fiche d'une
 *    facture s'ouvrait aux Finances, lui proposait « Joindre » et listait ses fichiers — et le
 *    serveur refusait l'envoi comme le téléchargement. Un bouton offert puis refusé fait chercher
 *    une panne qui n'existe pas (§118.83). L'ÉCRITURE suit la même règle que la fiche
 *    (`legalWriteAllowed`) : Legal partout, les Finances sur la chaîne d'achat ; le module « Bons de
 *    commande » n'écrit rien — signer n'est pas modifier la pièce.
 *  • En LECTURE seulement, pour qui n'a PAS le module : les pièces nées d'un matériel
 *    promotionnel (`sourceType` PROMO_MATERIAL) s'ouvrent à qui ouvre le dossier (§118.152) — le
 *    demandeur qui a déposé la facture, l'assistante qui suit le dossier, le pharmacien qui
 *    instruit la demande de visa. Ce n'est pas une porte vers les contrats : seules les pièces
 *    nées de CE dossier passent, et les droits d'écriture restent ceux de Legal.
 */
export async function accesAuxPiecesLegal(
  user: SessionUser,
  ids: readonly string[],
  actions: readonly Action[],
): Promise<Map<Action, Set<string>>> {
  const res = new Map<Action, Set<string>>(actions.map((a) => [a, new Set<string>()]));
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0 || actions.length === 0) return res;

  if (actions.includes("VIEW") && !userCan(user, "LEGAL", "VIEW")) {
    const pieces = await prisma.legalDocument.findMany({
      where: { id: { in: uniques }, sourceType: "PROMO_MATERIAL", sourceId: { not: null } },
      select: { id: true, sourceId: true },
    });
    if (pieces.length > 0) {
      const dossiers = await prisma.promoMaterial.findMany({
        where: { id: { in: [...new Set(pieces.map((p) => p.sourceId as string))] } },
        select: { id: true, requesterId: true, assistantId: true, requestValidatorId: true, marketingValidatorId: true },
      });
      const ouverts = new Set<string>();
      for (const pm of dossiers) if (await peutOuvrirLeDossierPromo(user, pm)) ouverts.add(pm.id);
      for (const p of pieces) if (p.sourceId && ouverts.has(p.sourceId)) res.get("VIEW")!.add(p.id);
    }
  }

  // LA PORTE DE LA FICHE, par nature : les mêmes trois entrées que `/legal/[id]`.
  const portee = legalViewScope({
    onLegal: userCan(user, "LEGAL", "VIEW"),
    onFinances: userCan(user, "FINANCES", "VIEW"),
    onBonsDeCommande: userCan(user, "PURCHASE_ORDERS", "VIEW"),
  });
  const financesEcrivent = userCan(user, "FINANCES", "UPDATE");
  const permis = (a: Action, kind: string): boolean => {
    if (userCan(user, "LEGAL", a)) return true;
    if (a === "VIEW") return legalKindVisible(portee, kind);
    // Les gestes que la fiche offre à qui peut ÉCRIRE la pièce — joindre, renommer, retirer.
    if (GESTES_D_ECRITURE_DE_PIECE.includes(a)) return legalWriteAllowed({ onLegal: false, onFinances: financesEcrivent, kind });
    return false;
  };
  const candidates = actions.filter((a) =>
    userCan(user, "LEGAL", a)
    || (a === "VIEW" && portee !== "NONE")
    || (GESTES_D_ECRITURE_DE_PIECE.includes(a) && financesEcrivent));
  if (candidates.length === 0) return res;
  const readerScope = legalReaderWhere({ viewerId: user.id, isSuperAdmin: user.role === "SUPER_ADMIN" });
  const dansLaPortee = await prisma.legalDocument.findMany({
    where: await companyScopedWhere(user.id, {
      AND: [{ id: { in: uniques } }, ...(readerScope ? [readerScope] : [])],
    }),
    select: { id: true, kind: true },
  });
  for (const d of dansLaPortee) for (const a of candidates) if (permis(a, String(d.kind))) res.get(a)!.add(d.id);
  return res;
}

/** Les gestes sur les fichiers d'une pièce que la fiche offre à qui peut l'écrire. */
const GESTES_D_ECRITURE_DE_PIECE: readonly Action[] = ["UPLOAD", "UPDATE", "DELETE"];

export async function canAccessEntity(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
  action: Action = "VIEW",
): Promise<boolean> {
  const module = await moduleDeLEntite(entityType, entityId);

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

  // POSTE DE DÉPENSE : l'accès ne vient PAS d'un module, il vient de SON OPÉRATION.
  //
  // Un poste n'existe pas tout seul — il est le stand d'un congrès, le traiteur d'un événement,
  // l'hôtellerie d'un sponsoring. Le rattacher à un module écrit à la main était une devinette,
  // et elle était FAUSSE : `ENTITY_MODULE` annonce `SPONSORING` pour tous les postes, or le
  // délégué médical et le manager promotion médicale — mesuré, les deux seuls rôles qui portent
  // `EVENTS` et `CONGRESS_NATIONAL` sans `SPONSORING` — sont précisément les auteurs typiques
  // d'un événement ou d'un congrès national. Le demandeur ne pouvait donc rien joindre ni
  // commenter sur le poste de SA propre demande, alors que l'opération, elle, lui est ouverte :
  // une porte fermée juste à côté d'une porte ouverte, sur la même chose (§118.71).
  //
  // On DÉLÈGUE, on ne recopie pas : la règle d'une opération Ad & Pro est déjà écrite plus bas
  // (parties prenantes, demandeur, droits de module) et la redire ici en ferait une seconde
  // vérité qui prendrait du retard au premier ajustement (§118.5).
  if (entityType === "AD_PRO_ITEM") {
    const poste = await prisma.adProItem.findUnique({
      where: { id: entityId },
      select: { sponsoringId: true, congressNationalId: true, congressInternationalId: true, eventId: true, trainingId: true },
    });
    if (!poste) return false;
    const parent = parentDuPoste(poste);
    if (!parent) return false;
    return canAccessEntity(user, PARENT_ENTITE[parent.parent], parent.id, action);
  }

  // PROJET BD : son propre module, `BD_PROJECTS` (§118.163) — celui que le Super Admin règle dans
  // Administration › Accès. Market Intelligence, dont il vient, reste retiré. La ligne se lit dans
  // la MÊME clause que la liste (`projetsBdVisibles` : portée du module ∧ entité), sans quoi une
  // fiche s'ouvrirait sur un projet que la liste cache — ou l'inverse.
  if (entityType === "BD_PROJECT") {
    if (!userCan(user, "BD_PROJECTS", action)) return false;
    const found = await prisma.bdProject.findFirst({
      where: { AND: [{ id: entityId }, await projetsBdVisibles(user)] }, select: { id: true },
    });
    return Boolean(found);
  }

  // DEMANDE DE PAIEMENT : l'accès ne vient PAS d'un module, mais du CERCLE du dossier.
  //
  // N'importe qui peut avoir à faire payer une facture — la Direction Marketing, une assistante, un
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

  // JOINDRE UNE PIÈCE À UN DOSSIER Ad&Pro : QUI PEUT DÉCIDER DU DOSSIER PEUT Y JOINDRE SA FACTURE.
  //
  // « On veut associer une facture à l'événement, mais je n'arrive pas à joindre de PJ. » Le droit
  // `UPLOAD` du module était exigé, et lui seul : la Direction qui valide le dossier, le chef de
  // produit qui l'a analysé, l'assistante qui le suit ne pouvaient rien déposer dès que cette case
  // ne leur avait pas été cochée. Ils envoyaient donc la facture par mail, et le dossier restait
  // vide — c'est-à-dire exactement ce que l'ERP existe pour éviter.
  //
  // Joindre une pièce n'est pas un pouvoir : c'est le geste qui rend le dossier lisible. La règle
  // est la MÊME que celle des écrans (`ad-pro/attachments.ts`, pure et testée) : un bouton visible
  // qui refuse ensuite fait chercher la panne au lieu de faire demander le droit.
  if ((action === "UPLOAD" || action === "VIEW") && AD_PRO_TYPES.includes(entityType)) {
    // Le droit d'ÉCRIRE dans le module ouvre le dossier — DANS SA PORTÉE DE LIGNE (§118.153).
    if ((userCan(user, module, "UPDATE") || userCan(user, module, "VALIDATE")) && (await dansLaPorteeAdPro(user, entityType, entityId))) return true;
    const parties = await adProStakeholders(entityType, entityId);
    if (parties && isOwnBusiness(user.id, parties)) return true;
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

  // ── L'ANNUAIRE OUVERT PAR LA CONSOLE (§118.147) ─────────────────────────────────────────
  //
  // Un praticien appartient à l'annuaire des médecins ou des pharmaciens, selon son GRADE. Quand
  // la console a ouvert cet annuaire à la personne, il lui est ouvert EN ENTIER, avec les gestes
  // cochés — sans le module de la Promotion médicale, dont la portée par délégué ne s'applique
  // donc pas ici. On ne lit la fiche que si une section est ouverte : pour tous les autres, ce
  // passage ne coûte rien.
  if (entityType === "DOCTOR" && (user.access.modules.get("DIRECTORIES")?.sections?.size ?? 0) > 0
    && (action === "VIEW" || action === "CREATE" || action === "UPDATE" || action === "DELETE")) {
    const fiche = await prisma.medicalDoctor.findUnique({ where: { id: entityId }, select: { title: true } });
    if (fiche && annuaireOuvertParConsole(user, annuaireDuPraticien(fiche.title), action)) return true;
  }

  // ── LES PIÈCES D'UN MATÉRIEL PROMOTIONNEL (§118.152) ─────────────────────────────────────
  //
  // Le bon de commande qu'un dossier du nouveau circuit a fait GÉNÉRER, et la facture qui en
  // découle, sont des pièces Legal rattachées au dossier (`sourceType` PROMO_MATERIAL). Leur
  // demandeur n'a pas le module Legal — c'est pourtant lui qui a déposé la facture et qui doit
  // pouvoir la rouvrir, comme l'assistante qui suit le dossier et le pharmacien qui instruit sa
  // demande de visa. On les ouvre en LECTURE à qui ouvre le dossier (la MÊME règle que la fiche),
  // et à rien de plus : ce n'est pas une porte vers les contrats — seules les pièces nées de CE
  // dossier passent ici, les droits d'écriture de Legal restent ceux de Legal.
  // LE DOSSIER LUI-MÊME, en LECTURE, pour les mêmes personnes que la fiche (§118.152) : le N+1 qui
  // valide la demande, la directrice marketing qui valide le devis, le pharmacien qui instruit le
  // visa n'ont pas forcément le module. La fiche leur est ouverte ; sans cette porte, ses pièces
  // (scans des devis, maquettes) et son fil de discussion leur répondaient « accès refusé » sur
  // l'écran même où on leur demande de décider.
  // Et pour qui A le module en « ses lignes » aussi (§118.153) : le National Sales demande pour
  // lui-même ET valide la demande de son KAM — le dossier du KAM n'est pas dans sa portée, et c'est
  // pourtant la fiche où on lui demande de trancher.
  if (entityType === "PROMO_MATERIAL" && action === "VIEW") {
    const pm = await prisma.promoMaterial.findUnique({
      where: { id: entityId },
      select: { id: true, requesterId: true, assistantId: true, requestValidatorId: true, marketingValidatorId: true },
    });
    if (pm && (await peutOuvrirLeDossierPromo(user, pm))) return true;
  }

  // UNE PIÈCE LEGAL — la règle vit dans `accesAuxPiecesLegal`, qui la sert aussi EN LOT : l'écran
  // qui liste les pièces liées d'une fiche (§118.161) doit montrer exactement ce que cette porte
  // laissera ouvrir, et deux écritures de la même règle finiraient par diverger (§118.5).
  if (entityType === "LEGAL_DOCUMENT") {
    return (await accesAuxPiecesLegal(user, [entityId], [action])).get(action)?.has(entityId) ?? false;
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
      //
      // LA MÊME PORTE QUE L'ÉCRAN (`companyScopedWhere`), et c'est ce qui manquait : le filtre
      // STRICT refusait les plis SANS entité, si bien que le scan qu'on venait de joindre à son
      // propre courrier n'était plus téléchargeable par personne — « pièce jointe introuvable ».
      const found = await prisma.mailEntry.findFirst({
        where: await companyScopedWhere(user.id, { id: entityId }),
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
    // LEGAL_DOCUMENT n'arrive jamais ici : il est rendu plus haut par `accesAuxPiecesLegal`.
    case "RECRUITMENT_REQUEST": {
      // Un CV et une fourchette de rémunération sont des données PERSONNELLES : avoir le module
      // ne suffit pas. Il faut être partie à la demande — l'avoir écrite, devoir la valider, ou
      // tenir les RH. Sans cette porte, la fiche de poste et les CV se téléchargeraient en
      // devinant un identifiant.
      return Boolean(await recruitmentViewer(user, entityId));
    }
    case "CONGRESS_INTERNATIONAL":
    case "CONGRESS_NATIONAL":
    case "PROMO_MATERIAL":
      // Sans ces trois cas, le `default` ci-dessous ouvrait tout dossier à qui avait le module.
      return dansLaPorteeAdPro(user, entityType, entityId);
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
