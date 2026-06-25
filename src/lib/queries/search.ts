import type { SessionUser } from "@/lib/rbac";
import { userCan, scopeRegulatory, scopeSales, scopeMedicalDoctors, scopeBusinessDevelopment } from "@/lib/rbac";
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
 * Cross-module global search, RBAC-aware: only queries modules the user can view,
 * and applies row-level scope where the module has it. Powers the ⌘K palette and
 * the /search page.
 */
export async function globalSearch(user: SessionUser, q: string, perGroup = 6): Promise<SearchResult[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const c = { contains: term, mode: "insensitive" as const };
  const take = perGroup;

  const driveAll = user.role === "SUPER_ADMIN" || user.access.modules.get("DRIVE")?.scope === "ALL";

  const [regulatory, sponsoring, finances, employees, sales, logistics, doctors, bd, drive, documents, tasks] = await Promise.all([
    userCan(user, "REGULATORY", "VIEW")
      ? prisma.regulatoryProduct.findMany({ where: { AND: [scopeRegulatory(user), { OR: [{ dci: c }, { reference: c }, { brandName: c }] }] }, take, select: { id: true, dci: true, reference: true, brandName: true } })
      : [],
    userCan(user, "SPONSORING", "VIEW")
      ? prisma.sponsoringRequest.findMany({ where: { OR: [{ institution: c }, { reference: c }, { doctor: c }] }, take, select: { id: true, institution: true, reference: true } })
      : [],
    userCan(user, "FINANCES", "VIEW")
      ? prisma.financeTransaction.findMany({ where: { OR: [{ label: c }, { reference: c }, { counterparty: c }] }, take, select: { id: true, label: true, reference: true } })
      : [],
    userCan(user, "RH", "VIEW")
      ? prisma.employee.findMany({ where: { OR: [{ fullName: c }, { position: c }, { department: c }] }, take, select: { id: true, fullName: true, position: true } })
      : [],
    userCan(user, "SALES", "VIEW")
      ? prisma.sale.findMany({ where: { AND: [scopeSales(user), { OR: [{ product: c }, { client: c }] }] }, take, select: { id: true, product: true, client: true } })
      : [],
    userCan(user, "LOGISTICS", "VIEW")
      ? prisma.logisticsOrder.findMany({ where: { OR: [{ product: c }, { reference: c }, { supplier: c }] }, take, select: { id: true, product: true, reference: true } })
      : [],
    userCan(user, "MEDICAL", "VIEW")
      ? prisma.medicalDoctor.findMany({ where: { AND: [scopeMedicalDoctors(user), { OR: [{ name: c }, { institution: c }, { city: c }] }] }, take, select: { id: true, name: true, specialty: true } })
      : [],
    userCan(user, "BUSINESS_DEVELOPMENT", "VIEW")
      ? prisma.businessDevelopmentOpportunity.findMany({ where: { AND: [scopeBusinessDevelopment(user), { OR: [{ name: c }, { dci: c }] }] }, take, select: { id: true, name: true, dci: true } })
      : [],
    userCan(user, "DRIVE", "VIEW")
      ? prisma.driveNode.findMany({ where: { AND: [{ name: c, isTrashed: false, type: "FILE" }, driveAll ? {} : { OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] }] }, take, select: { id: true, name: true, mimeType: true } })
      : [],
    userCan(user, "DOCUMENTS", "VIEW")
      ? prisma.document.findMany({ where: { name: c }, take, select: { id: true, name: true, category: true } })
      : [],
    userCan(user, "WORKSPACE", "VIEW")
      ? prisma.task.findMany({ where: { AND: [{ assignedToId: user.id }, { title: c }] }, take, select: { id: true, title: true, status: true } })
      : [],
  ]);

  const out: SearchResult[] = [];
  for (const r of regulatory) out.push({ id: r.id, group: "Regulatory", title: r.dci, subtitle: [r.reference, r.brandName].filter(Boolean).join(" · "), href: `/regulatory/${r.id}`, icon: "FileCheck2" });
  for (const r of sponsoring) out.push({ id: r.id, group: "Sponsoring", title: r.institution, subtitle: r.reference, href: `/sponsoring/${r.id}`, icon: "HandCoins" });
  for (const r of finances) out.push({ id: r.id, group: "Finances", title: r.label, subtitle: r.reference, href: `/finances`, icon: "Landmark" });
  for (const r of employees) out.push({ id: r.id, group: "RH", title: r.fullName, subtitle: r.position ?? "", href: `/rh/${r.id}`, icon: "UsersRound" });
  for (const r of sales) out.push({ id: r.id, group: "Ventes", title: r.product, subtitle: r.client, href: `/sales`, icon: "TrendingUp" });
  for (const r of logistics) out.push({ id: r.id, group: "Logistique PCH", title: r.product, subtitle: r.reference, href: `/logistics/${r.id}`, icon: "Truck" });
  for (const r of doctors) out.push({ id: r.id, group: "Promotion médicale", title: r.name, subtitle: r.specialty ?? "", href: `/medical`, icon: "Stethoscope" });
  for (const r of bd) out.push({ id: r.id, group: "Business Development", title: r.name, subtitle: r.dci ?? "", href: `/business-development`, icon: "Lightbulb" });
  for (const r of drive) out.push({ id: r.id, group: "Drive", title: r.name, subtitle: r.mimeType ?? "", href: `/drive/${r.id}`, icon: "HardDrive" });
  for (const r of documents) out.push({ id: r.id, group: "Documents", title: r.name, subtitle: "Télécharger", href: `/api/documents/${r.id}`, icon: "FolderOpen" });
  for (const r of tasks) out.push({ id: r.id, group: "Mes tâches", title: r.title, subtitle: r.status, href: `/mon-espace`, icon: "ListTodo" });
  return out;
}
