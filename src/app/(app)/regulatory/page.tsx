import { requireModule } from "@/lib/session";
import { userCan, scopeRegulatory } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { regProgress, type RegWorkflowState } from "@/lib/regulatory-workflow";
import { PageHeader } from "@/components/shared/page-header";
import { PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import { RegulatoryTable, type RegulatoryRow } from "./regulatory-table";
import { NewProductButton } from "./new-product";
import { SuppliersManager } from "./suppliers-manager";

export default async function RegulatoryPage() {
  const user = await requireModule("REGULATORY");
  const canCreate = userCan(user, "REGULATORY", "CREATE");

  const [products, suppliers] = await Promise.all([
    prisma.regulatoryProduct.findMany({
      where: scopeRegulatory(user),
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        responsible: { select: { name: true } },
        assistant: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: RegulatoryRow[] = products.map((p) => {
    const prog = regProgress(p.workflow as RegWorkflowState | null);
    const done = prog.done;
    const total = prog.total;
    const dosage = [p.dosage, p.dosageUnit ? DOSAGE_UNIT[p.dosageUnit] ?? p.dosageUnit : null]
      .filter(Boolean)
      .join(" ");
    return {
      id: p.id,
      reference: p.reference,
      dci: p.dci,
      brandName: p.brandName ?? "",
      dosage,
      form: p.pharmaceuticalForm ? PHARMA_FORM[p.pharmaceuticalForm] ?? p.pharmaceuticalForm : "",
      therapeuticClass: p.therapeuticClass ?? "",
      supplier: p.supplier?.name ?? "",
      category: p.category,
      productType: p.productType,
      status: p.status,
      priority: p.priority,
      responsible: p.responsible?.name ?? "",
      assistant: p.assistant?.name ?? "",
      targetDate: p.targetDate?.toISOString() ?? null,
      progress: Math.round((done / total) * 100),
      stepsDone: done,
      stepsTotal: total,
    };
  });

  // Assignable users for the create form (regulatory team + leadership).
  const assignableUsers = canCreate
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ["HEAD_OF_REGULATORY", "REGULATORY_ASSISTANT", "DIRECTION"] },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Liste détaillée des fournisseurs pour le gestionnaire (création / activation).
  const supplierList = canCreate
    ? await prisma.supplier.findMany({
        select: { id: true, name: true, country: true, contactEmail: true, active: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regulatory"
        description="Suivi des molécules/DCI et de leur avancement réglementaire jusqu'à l'enregistrement."
      >
        {canCreate && (
          <div className="flex items-center gap-2">
            <SuppliersManager suppliers={supplierList} />
            <NewProductButton users={assignableUsers} suppliers={suppliers} />
          </div>
        )}
      </PageHeader>

      <RegulatoryTable rows={rows} />
    </div>
  );
}
