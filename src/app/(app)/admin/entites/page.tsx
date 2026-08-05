import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EntitiesManager, type EntityRow } from "./entities-manager";

export const dynamic = "force-dynamic";

/** Gestion des entités (sociétés du groupe) — réservée à l'administration. */
export default async function EntitesPage() {
  const admin = await requireModule("ADMIN");
  if (!userCan(admin, "ADMIN", "CREATE")) redirect("/admin");

  const [companies, byProduct, byEmployee, byDepartment] = await Promise.all([
    prisma.company.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.regulatoryProduct.groupBy({ by: ["companyId"], _count: true }),
    prisma.employee.groupBy({ by: ["companyId"], _count: true }),
    // Structure : nombre de départements propres à chaque entité.
    prisma.department.groupBy({ by: ["companyId"], _count: true }),
  ]);
  const prodCount = new Map(byProduct.map((r) => [r.companyId, r._count]));
  const empCount = new Map(byEmployee.map((r) => [r.companyId, r._count]));
  const deptCount = new Map(byDepartment.map((r) => [r.companyId, r._count]));

  const rows: EntityRow[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    color: c.color,
    isActive: c.isActive,
    products: prodCount.get(c.id) ?? 0,
    employees: empCount.get(c.id) ?? 0,
    departments: deptCount.get(c.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Administration
      </Link>
      <PageHeader
        title="Entités (sociétés)"
        description="Les sociétés du groupe (Adventum Pharma, Pharmagène, …). Chaque produit, appel d'offres, employé, dépense, vente… peut être rattaché à une entité, et le sélecteur de la barre supérieure filtre toutes les vues. Tout est dynamique : créez une 3ᵉ entité, renommez, changez la couleur ou désactivez sans toucher au code."
      />
      <EntitiesManager rows={rows} />
    </div>
  );
}
