import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { getCongressDetail, getCongressFormData } from "@/lib/queries/congress";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONGRESS_REQUEST_STATUS } from "@/lib/labels";
import { CongressDetailView } from "../congress-detail-view";

export default async function CongressIntlDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONGRESS_INTERNATIONAL");
  const detail = await getCongressDetail("INTL", user, params.id);
  if (!detail) notFound();
  const form = await getCongressFormData();

  const canValidate = userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE") || hasGlobalView(user.role);
  const canAnalyze = detail.productManagerId === user.id || hasGlobalView(user.role);

  return (
    <div className="space-y-5">
      <Link href="/congress-international" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Congrès internationaux
      </Link>
      <PageHeader title={detail.name} description="Demande de prise en charge — congrès international.">
        <StatusBadge map={CONGRESS_REQUEST_STATUS} value={detail.requestStatus} />
      </PageHeader>
      <CongressDetailView detail={detail} canValidate={canValidate} canAnalyze={canAnalyze} productManagers={form.productManagers} />
    </div>
  );
}
