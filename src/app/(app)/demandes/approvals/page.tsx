import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getApprovals } from "@/lib/queries/admin-requests";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { ADMIN_REQUEST_TYPE } from "@/lib/labels";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils";
import { ApprovalButtons } from "../approval-buttons";

export default async function ApprovalsPage() {
  const user = await requireModule("ADMIN_REQUESTS");
  const approvals = await getApprovals(user);

  return (
    <div className="space-y-5">
      <Link href="/demandes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Demandes
      </Link>
      <PageHeader title="Validations en attente" description="Demandes du bureau du secrétariat à valider, refuser ou renvoyer pour modification." />

      {approvals.length === 0 ? (
        <EmptyState icon="ClipboardCheck" title="Aucune validation en attente" description="Les demandes à valider apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <div key={a.id} className="surface flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{a.request.reference}</span>
                  <Badge tone="neutral" dot={false}>{ADMIN_REQUEST_TYPE[a.request.type] ?? a.request.type}</Badge>
                  {a.amount && <span className="text-sm font-semibold">{formatCurrency(toNumber(a.amount))}</span>}
                </div>
                <Link href={`/demandes/${a.request.id}`} className="block font-medium hover:underline">{a.request.title}</Link>
                {a.comment && <p className="text-sm text-muted-foreground">{a.comment}</p>}
                <p className="text-xs text-muted-foreground">Demandé le {formatDate(a.createdAt)}</p>
              </div>
              <ApprovalButtons approvalId={a.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
