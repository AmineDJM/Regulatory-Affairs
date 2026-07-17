import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session";
import { canSeeRegRequests, canAnswerRegRequests } from "@/lib/rbac";
import { getRegRequest } from "@/lib/queries/regulatory-requests";
import { REG_REQUEST_STATUS, REG_REQUEST_CATEGORY, PRIORITY } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { RequestThread } from "../request-thread";

export const dynamic = "force-dynamic";

export default async function RegulatoryRequestDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canSeeRegRequests(user)) notFound();
  const request = await getRegRequest(user, params.id);
  if (!request) notFound();

  const canAnswer = canAnswerRegRequests(user);
  const canDelete = canAnswer || (request.requesterId === user.id && request.status === "OPEN");

  return (
    <div className="space-y-5">
      <PageHeader title={request.subject} description={`${request.reference} · ${REG_REQUEST_CATEGORY[request.category] ?? request.category}`}>
        <Link href="/regulatory/requests"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Demandes</Button></Link>
      </PageHeader>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge map={REG_REQUEST_STATUS} value={request.status} />
            <StatusBadge map={PRIORITY} value={request.priority} />
            {request.productName && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">Dossier : {request.productName}</span>}
            {request.requesterName && <span className="text-xs text-muted-foreground">Demandeur : {request.requesterName}</span>}
            {request.assigneeName && <span className="text-xs text-muted-foreground">· Pris en charge : {request.assigneeName}</span>}
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p className="whitespace-pre-wrap text-sm">{request.body}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <RequestThread request={request} canAnswer={canAnswer} canDelete={canDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
