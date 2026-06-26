import { requireModule } from "@/lib/session";
import { userCan, scopeRegulatory } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { RegulatoryTable, type RegulatoryRow } from "./regulatory-table";
import { NewProductButton } from "./new-product";

export default async function RegulatoryPage() {
  const user = await requireModule("REGULATORY");
  const canCreate = userCan(user, "REGULATORY", "CREATE");

  const products = await prisma.regulatoryProduct.findMany({
    where: scopeRegulatory(user),
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    include: {
      responsible: { select: { name: true } },
      assistant: { select: { name: true } },
      steps: { select: { status: true } },
    },
  });

  const rows: RegulatoryRow[] = products.map((p) => {
    const total = p.steps.length || 17;
    const done = p.steps.filter((s) => s.status === "DONE").length;
    return {
      id: p.id,
      reference: p.reference,
      dci: p.dci,
      brandName: p.brandName ?? "",
      dosage: p.dosage ?? "",
      form: p.pharmaceuticalForm ?? "",
      therapeuticClass: p.therapeuticClass ?? "",
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Regulatory"
        description="Suivi des molécules/DCI et de leur avancement réglementaire jusqu'à l'enregistrement."
      >
        {canCreate && <NewProductButton users={assignableUsers} />}
      </PageHeader>

      <RegulatoryTable rows={rows} />
    </div>
  );
}
