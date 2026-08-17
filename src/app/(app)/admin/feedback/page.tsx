import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { FeedbackStatusSelect } from "./feedback-status";
import { BackLink } from "@/components/shared/back-link";

export default async function AdminFeedbackPage() {
  const user = await requireModule("ADMIN");
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard?denied=ADMIN");

  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true, avatarColor: true } } },
    take: 300,
  });

  const stats = {
    toHandle: feedbacks.filter((f) => f.status === "NEW").length,
    inProgress: feedbacks.filter((f) => f.status === "IN_PROGRESS" || f.status === "SEEN").length,
    done: feedbacks.filter((f) => f.status === "DONE").length,
  };

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader title="Feedbacks" description="Les retours envoyés par les utilisateurs depuis leur compte." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="À traiter" value={stats.toHandle} icon="Inbox" tone={stats.toHandle > 0 ? "warning" : "default"} />
        <KpiCard label="En cours" value={stats.inProgress} icon="Loader" tone="info" />
        <KpiCard label="Traités" value={stats.done} icon="CheckCheck" tone="success" />
      </div>

      {feedbacks.length === 0 ? (
        <EmptyState icon="MessageSquare" title="Aucun feedback reçu" description="Les retours des utilisateurs apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {feedbacks.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <Avatar name={f.user?.name ?? "?"} color={f.user?.avatarColor} size="sm" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{f.user?.name ?? "Utilisateur"}</span>
                      <span className="text-xs text-muted-foreground">{f.user?.email}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{f.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.module ? `${f.module} · ` : ""}{formatDateTime(f.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <FeedbackStatusSelect id={f.id} status={f.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
