import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { getCompanies, companyLabel } from "@/lib/company";
import { buildRangeTree, type RangeNode } from "@/lib/org/product-ranges";
import { RangesManager, type ProductOption, type PersonRow } from "./ranges-manager";

export const dynamic = "force-dynamic";

/**
 * ENTITÉS › GAMMES › PRODUITS — l'arbre dont découle ce que chacun voit.
 *
 * Trois colonnes et une seule idée : l'entité dit DE QUI est un produit, la gamme dit DE QUOI
 * il relève, et le rattachement d'une personne à l'un ou à l'autre décide de ce qu'elle ouvre.
 * Rattachée à une entité, elle voit toute la société ; rattachée à des gammes, elle ne voit que
 * leurs produits — de la même société ou de plusieurs.
 *
 * Écran d'ADMINISTRATION : ce n'est pas un réglage d'affichage, c'est une clé de lecture de la
 * plateforme. Les produits sont ceux de Regulatory — on ne recrée pas un catalogue à côté.
 */
export default async function GammesPage() {
  const admin = await requireModule("ADMIN");
  if (!userCan(admin, "ADMIN", "CREATE")) redirect("/admin");

  const [companies, ranges, products, people] = await Promise.all([
    getCompanies(),
    prisma.productRange.findMany({
      select: {
        id: true, name: true, companyId: true, color: true, isActive: true, description: true,
        _count: { select: { products: true, userAccess: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    // TOUS les dossiers réglementaires : c'est l'écran qui décide qui les verra, il ne peut
    // donc pas être filtré par ce que l'administrateur voit déjà.
    prisma.regulatoryProduct.findMany({
      select: { id: true, reference: true, dci: true, brandName: true, dosage: true, companyId: true, rangeId: true },
      orderBy: [{ dci: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, role: true,
        employee: { select: { companyId: true } },
        companyAccess: { select: { companyId: true } },
        rangeAccess: { select: { rangeId: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const nodes: RangeNode[] = ranges.map((r) => ({
    id: r.id, name: r.name, companyId: r.companyId, color: r.color, isActive: r.isActive,
    productCount: r._count.products, memberCount: r._count.userAccess,
  }));

  // Produits d'une entité qui ne relèvent d'AUCUNE gamme : ce sont eux qu'on vient ranger.
  const unranged: Record<string, number> = {};
  for (const p of products) {
    if (p.rangeId || !p.companyId) continue;
    unranged[p.companyId] = (unranged[p.companyId] ?? 0) + 1;
  }

  const tree = buildRangeTree(
    companies.map((c) => ({ id: c.id, label: companyLabel(c), color: c.color })),
    nodes,
    unranged,
  );

  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.id,
    label: [p.reference, p.dci, p.brandName, p.dosage].filter(Boolean).join(" · "),
    companyId: p.companyId,
    rangeId: p.rangeId,
  }));

  const personRows: PersonRow[] = people.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    // Sociétés ouvertes EN ENTIER : appartenance + autorisation nominative d'entité.
    companyIds: [...new Set([
      ...(u.employee?.companyId ? [u.employee.companyId] : []),
      ...u.companyAccess.map((a) => a.companyId),
    ])],
    rangeIds: u.rangeAccess.map((a) => a.rangeId),
  }));

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader
        title="Entités, gammes & produits"
        description="L'entité dit de QUI est un produit, la gamme dit de QUOI il relève. Rattachez ensuite chaque personne à une entité (elle voit toute la société) ou à une ou plusieurs gammes, de la même entité ou de plusieurs — c'est de ce rattachement que découle ce qu'elle voit de la plateforme. Les produits sont ceux de Regulatory : rien n'est recréé ici."
      />
      <RangesManager tree={tree} products={productOptions} people={personRows} />
    </div>
  );
}
