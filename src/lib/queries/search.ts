import type { SessionUser } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import {
  userCan, scopeRegulatory, scopeSales, scopeMedicalDoctors, scopeBusinessDevelopment,
  scopeAdminRequests, scopeCongressIntl, scopeCongressNational,
} from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export interface SearchResult {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

/**
 * RECHERCHE GLOBALE multi-modules, RBAC-aware et MULTI-TERMES : ne requête que les modules que
 * l'utilisateur peut voir, applique le scope par ligne, et exige que CHAQUE mot de la requête
 * apparaisse dans au moins un champ (ET des mots, OU des champs) → « module 2 amox » retrouve un
 * dossier même si les mots sont dans des champs différents. Couvre dossiers CTD, demandes du
 * secrétariat, discussions, congrès, événements, directives, en plus des objets métier.
 * Alimente la palette ⌘K et la page /search.
 */
export async function globalSearch(user: SessionUser, q: string, perGroup = 6): Promise<SearchResult[]> {
  const raw = q.trim();
  if (raw.length < 2) return [];
  // Mots saillants (≥ 2 caractères, max 6) — la recherche exige TOUS les mots (robustesse).
  const terms = raw.split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2).slice(0, 6);
  const search = terms.length > 0 ? terms : [raw];
  const take = perGroup;

  /** ET des mots × OU des champs — renvoyé en tableau à insérer dans un `AND`. */
  const match = (fields: string[]) =>
    search.map((t) => ({ OR: fields.map((f) => ({ [f]: { contains: t, mode: "insensitive" } })) }));

  const driveAll = user.role === "SUPER_ADMIN" || user.access.modules.get("DRIVE")?.scope === "ALL";
  const canMessaging = userCan(user, "MESSAGING", "VIEW");

  const [
    regulatory, dossiers, sponsoring, finances, employees, sales, logistics, doctors, bd, drive, documents, tasks,
    adminReqs, congressIntl, congressNat, events, directives, conversations, messages,
  ] = await Promise.all([
    userCan(user, "REGULATORY", "VIEW")
      ? prisma.regulatoryProduct.findMany({ where: { AND: [scopeRegulatory(user), ...(match(["dci", "reference", "brandName"]) as Prisma.RegulatoryProductWhereInput[])] }, take, select: { id: true, dci: true, reference: true, brandName: true } })
      : [],
    userCan(user, "REGULATORY", "VIEW")
      ? prisma.regulatoryDossier.findMany({ where: { AND: match(["reference", "title"]) as Prisma.RegulatoryDossierWhereInput[] }, take, select: { id: true, reference: true, title: true } })
      : [],
    userCan(user, "SPONSORING", "VIEW")
      ? prisma.sponsoringRequest.findMany({ where: { AND: match(["institution", "reference", "doctor"]) as Prisma.SponsoringRequestWhereInput[] }, take, select: { id: true, institution: true, reference: true } })
      : [],
    userCan(user, "FINANCES", "VIEW")
      ? prisma.financeTransaction.findMany({ where: { AND: match(["label", "reference", "counterparty"]) as Prisma.FinanceTransactionWhereInput[] }, take, select: { id: true, label: true, reference: true } })
      : [],
    userCan(user, "RH", "VIEW")
      ? prisma.employee.findMany({ where: { AND: match(["fullName", "position", "department"]) as Prisma.EmployeeWhereInput[] }, take, select: { id: true, fullName: true, position: true } })
      : [],
    userCan(user, "SALES", "VIEW")
      ? prisma.sale.findMany({ where: { AND: [scopeSales(user), ...(match(["product", "client"]) as Prisma.SaleWhereInput[])] }, take, select: { id: true, product: true, client: true } })
      : [],
    userCan(user, "LOGISTICS", "VIEW")
      ? prisma.logisticsOrder.findMany({ where: { AND: match(["product", "reference", "supplier"]) as Prisma.LogisticsOrderWhereInput[] }, take, select: { id: true, product: true, reference: true } })
      : [],
    userCan(user, "MEDICAL", "VIEW")
      ? prisma.medicalDoctor.findMany({ where: { AND: [scopeMedicalDoctors(user), ...(match(["name", "institution", "city"]) as Prisma.MedicalDoctorWhereInput[])] }, take, select: { id: true, name: true, specialty: true } })
      : [],
    userCan(user, "BUSINESS_DEVELOPMENT", "VIEW")
      ? prisma.businessDevelopmentOpportunity.findMany({ where: { AND: [scopeBusinessDevelopment(user), ...(match(["name", "dci"]) as Prisma.BusinessDevelopmentOpportunityWhereInput[])] }, take, select: { id: true, name: true, dci: true } })
      : [],
    userCan(user, "DRIVE", "VIEW")
      ? prisma.driveNode.findMany({ where: { AND: [{ isTrashed: false, type: "FILE" }, driveAll ? {} : { OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] }, ...(match(["name"]) as Prisma.DriveNodeWhereInput[])] }, take, select: { id: true, name: true, mimeType: true } })
      : [],
    userCan(user, "DOCUMENTS", "VIEW")
      ? prisma.document.findMany({ where: { AND: match(["name"]) as Prisma.DocumentWhereInput[] }, take, select: { id: true, name: true, category: true } })
      : [],
    userCan(user, "WORKSPACE", "VIEW")
      ? prisma.task.findMany({ where: { AND: [{ assignedToId: user.id }, ...(match(["title", "description"]) as Prisma.TaskWhereInput[])] }, take, select: { id: true, title: true, status: true } })
      : [],
    userCan(user, "ADMIN_REQUESTS", "VIEW")
      ? prisma.administrativeRequest.findMany({ where: { AND: [scopeAdminRequests(user), { deletedAt: null }, ...(match(["reference", "title", "description"]) as Prisma.AdministrativeRequestWhereInput[])] }, take, select: { id: true, reference: true, title: true } })
      : [],
    userCan(user, "CONGRESS_INTERNATIONAL", "VIEW")
      ? prisma.congressInternational.findMany({ where: { AND: [scopeCongressIntl(user), ...(match(["name", "city", "specialty"]) as Prisma.CongressInternationalWhereInput[])] }, take, select: { id: true, name: true, city: true } })
      : [],
    userCan(user, "CONGRESS_NATIONAL", "VIEW")
      ? prisma.congressNational.findMany({ where: { AND: [scopeCongressNational(user), ...(match(["name", "city", "specialty"]) as Prisma.CongressNationalWhereInput[])] }, take, select: { id: true, name: true, city: true } })
      : [],
    userCan(user, "EVENTS", "VIEW")
      ? prisma.event.findMany({ where: { AND: match(["name", "location", "city", "specialty"]) as Prisma.EventWhereInput[] }, take, select: { id: true, name: true, city: true } })
      : [],
    userCan(user, "DIRECTIVES", "VIEW")
      ? prisma.directive.findMany({ where: { AND: [{ OR: [{ fromId: user.id }, { targetUserId: user.id }, { targetUserId: null }] }, ...(match(["reference", "title", "body"]) as Prisma.DirectiveWhereInput[])] }, take, select: { id: true, reference: true, title: true } })
      : [],
    // Discussions : canaux/groupes nommés dont l'utilisateur est membre.
    canMessaging
      ? prisma.conversation.findMany({ where: { AND: [{ members: { some: { userId: user.id } } }, ...(match(["title", "description"]) as Prisma.ConversationWhereInput[])] }, take, select: { id: true, title: true } })
      : [],
    // Discussions : messages (contenu) dans les conversations de l'utilisateur.
    canMessaging
      ? prisma.message.findMany({ where: { AND: [{ deletedAt: null }, { conversation: { members: { some: { userId: user.id } } } }, ...(match(["body"]) as Prisma.MessageWhereInput[])] }, take, orderBy: { createdAt: "desc" }, select: { id: true, body: true, conversationId: true, conversation: { select: { title: true } } } })
      : [],
  ]);

  const out: SearchResult[] = [];
  for (const r of regulatory) out.push({ id: r.id, group: "Regulatory", title: r.dci, subtitle: [r.reference, r.brandName].filter(Boolean).join(" · "), href: `/regulatory/${r.id}`, icon: "FileCheck2" });
  for (const r of dossiers) out.push({ id: r.id, group: "Dossiers CTD", title: r.title, subtitle: r.reference, href: `/regulatory/enregistrement/analyse/${r.id}`, icon: "FolderSearch" });
  for (const r of sponsoring) out.push({ id: r.id, group: "Sponsoring", title: r.institution, subtitle: r.reference, href: `/sponsoring/${r.id}`, icon: "HandCoins" });
  for (const r of finances) out.push({ id: r.id, group: "Finances", title: r.label, subtitle: r.reference, href: `/finances`, icon: "Landmark" });
  for (const r of employees) out.push({ id: r.id, group: "RH", title: r.fullName, subtitle: r.position ?? "", href: `/rh/${r.id}`, icon: "UsersRound" });
  for (const r of sales) out.push({ id: r.id, group: "Ventes", title: r.product, subtitle: r.client, href: `/sales`, icon: "TrendingUp" });
  for (const r of logistics) out.push({ id: r.id, group: "Logistique PCH", title: r.product, subtitle: r.reference, href: `/logistics/${r.id}`, icon: "Truck" });
  for (const r of doctors) out.push({ id: r.id, group: "Annuaire", title: r.name, subtitle: r.specialty ?? "", href: `/medical`, icon: "Stethoscope" });
  for (const r of bd) out.push({ id: r.id, group: "Business Development", title: r.name, subtitle: r.dci ?? "", href: `/business-development`, icon: "Lightbulb" });
  for (const r of drive) out.push({ id: r.id, group: "Drive", title: r.name, subtitle: r.mimeType ?? "", href: `/drive/${r.id}`, icon: "HardDrive" });
  for (const r of documents) out.push({ id: r.id, group: "Documents", title: r.name, subtitle: "Télécharger", href: `/api/documents/${r.id}`, icon: "FolderOpen" });
  for (const r of tasks) out.push({ id: r.id, group: "Mes tâches", title: r.title, subtitle: r.status, href: `/mon-espace`, icon: "ListTodo" });
  for (const r of adminReqs) out.push({ id: r.id, group: "Bureau du secrétariat", title: r.title, subtitle: r.reference, href: `/demandes/${r.id}`, icon: "ClipboardList" });
  for (const r of congressIntl) out.push({ id: r.id, group: "Prise en charge Internationale", title: r.name, subtitle: r.city ?? "", href: `/congress-international/${r.id}`, icon: "Globe" });
  for (const r of congressNat) out.push({ id: r.id, group: "Prise en charge Nationale", title: r.name, subtitle: r.city ?? "", href: `/congress-national/${r.id}`, icon: "MapPin" });
  for (const r of events) out.push({ id: r.id, group: "Événements", title: r.name, subtitle: r.city ?? "", href: `/events/${r.id}`, icon: "CalendarDays" });
  for (const r of directives) out.push({ id: r.id, group: "Directives", title: r.title, subtitle: r.reference, href: `/directives`, icon: "Megaphone" });
  for (const r of conversations) out.push({ id: r.id, group: "Discussions", title: r.title ?? "Conversation", subtitle: "Canal / groupe", href: `/messages?c=${r.id}`, icon: "MessagesSquare" });
  for (const r of messages) out.push({ id: r.id, group: "Discussions", title: (r.conversation?.title ?? "Message"), subtitle: r.body.slice(0, 80), href: `/messages?c=${r.conversationId}`, icon: "MessageCircle" });
  return out;
}
