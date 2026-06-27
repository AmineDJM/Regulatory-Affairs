import { prisma } from "@/lib/prisma";

/**
 * Adventum Brain — fiche 360 relationnelle (Knowledge Graph lisible). Pour un produit
 * / une molécule, relie les données existantes (Regulatory, PCH, médecins, events,
 * rapports terrain) — lecture seule, aucun nouvel objet.
 */

export interface RelationBlock {
  module: string;
  icon: string;
  lines: string[];
  href: string;
}
export interface ProductRelations {
  query: string;
  found: boolean;
  blocks: RelationBlock[];
  strongRelations: { label: string; value: string }[];
}

export async function getProductRelations(query: string): Promise<ProductRelations> {
  const q = query.trim();
  if (!q) return { query, found: false, blocks: [], strongRelations: [] };
  const like = { contains: q, mode: "insensitive" as const };

  const [regs, tenders, doctors, events, reports] = await Promise.all([
    prisma.regulatoryProduct.findMany({ where: { OR: [{ dci: like }, { brandName: like }, { reference: like }] }, select: { id: true, dci: true, brandName: true, status: true, responsible: { select: { name: true } }, supplier: { select: { name: true } } }, take: 10 }),
    prisma.pchTender.findMany({ where: { products: like }, select: { id: true, reference: true, supplier: true, _count: { select: { orders: true } } }, take: 10 }),
    prisma.medicalDoctor.findMany({ where: { targetProducts: like }, select: { id: true, influenceLevel: true } , take: 300 }),
    prisma.event.findMany({ where: { OR: [{ products: like }, { name: like }] }, select: { id: true, name: true, status: true, _count: { select: { registrations: true } } }, take: 10 }),
    prisma.fieldReport.findMany({ where: { products: like }, select: { id: true, objection: true, medicalQuestion: true, qualitySignal: true }, take: 100 }),
  ]);

  const found = regs.length + tenders.length + doctors.length + events.length + reports.length > 0;
  const blocks: RelationBlock[] = [];
  const strong: { label: string; value: string }[] = [];

  if (regs.length) {
    blocks.push({
      module: "Regulatory", icon: "FileCheck2", href: "/regulatory",
      lines: regs.slice(0, 4).map((r) => `${r.dci}${r.brandName ? ` (${r.brandName})` : ""} — ${r.status}${r.responsible?.name ? ` · ${r.responsible.name}` : ""}`),
    });
    const sup = regs.find((r) => r.supplier?.name);
    if (sup?.supplier?.name) strong.push({ label: "Fournisseur", value: sup.supplier.name });
  }
  if (tenders.length) {
    const totalBc = tenders.reduce((s, t) => s + t._count.orders, 0);
    blocks.push({ module: "PCH — Marchés", icon: "Gavel", href: "/pch", lines: [`${tenders.length} marché(s) lié(s)`, `${totalBc} bon(s) de commande`, ...tenders.slice(0, 3).map((t) => `${t.reference}${t.supplier ? ` · ${t.supplier}` : ""}`)] });
  }
  if (doctors.length) {
    const kol = doctors.filter((d) => d.influenceLevel === "KEY_OPINION_LEADER").length;
    blocks.push({ module: "Promotion médicale", icon: "Stethoscope", href: "/medical", lines: [`${doctors.length} médecin(s) ciblant ce produit`, `${kol} KOL`] });
    if (kol) strong.push({ label: "KOL", value: `${kol} leader(s) d'opinion` });
  }
  if (events.length) {
    const avg = events.filter((e) => e._count.registrations > 0);
    blocks.push({ module: "Events", icon: "Ticket", href: "/events", lines: [`${events.length} événement(s) lié(s)`, ...events.slice(0, 3).map((e) => `${e.name} — ${e.status} (${e._count.registrations} inscrits)`)] });
    if (avg.length) strong.push({ label: "Événement", value: events[0].name });
  }
  if (reports.length) {
    const obj = reports.filter((r) => r.objection?.trim()).length;
    const quest = reports.filter((r) => r.medicalQuestion?.trim()).length;
    const qual = reports.filter((r) => r.qualitySignal?.trim()).length;
    blocks.push({ module: "Rapports terrain", icon: "Mic", href: "/field-reports", lines: [`${reports.length} mention(s) terrain`, `${obj} objection(s)`, `${quest} question(s) médicale(s)`, qual ? `${qual} signal(aux) qualité/PV` : ""].filter(Boolean) });
  }

  return { query: q, found, blocks, strongRelations: strong };
}

/** Suggestions de produits/molécules pour la barre de recherche relationnelle. */
export async function suggestRelationObjects(): Promise<string[]> {
  const regs = await prisma.regulatoryProduct.findMany({ select: { dci: true }, distinct: ["dci"], orderBy: { updatedAt: "desc" }, take: 12 });
  return regs.map((r) => r.dci).filter(Boolean);
}
