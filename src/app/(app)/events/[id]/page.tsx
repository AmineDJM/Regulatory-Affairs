import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Video } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getEventDetail } from "@/lib/queries/events";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EVENT_TYPE, EVENT_SCOPE, EVENT_FORMAT, EVENT_STATUS, PARTICIPANT_ROLE } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EditEventButton } from "../event-form";
import { RegistrationsManager } from "./registrations-manager";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("EVENTS");
  const e = await getEventDetail(params.id);
  if (!e) notFound();
  const canManage = userCan(user, "EVENTS", "UPDATE");
  const canDelete = userCan(user, "EVENTS", "DELETE");
  const responsibles = canManage ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];

  return (
    <div className="space-y-5">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Events</Link>
      <PageHeader title={e.name} description={`${EVENT_TYPE[e.type]} · ${EVENT_SCOPE[e.scope]} · ${EVENT_FORMAT[e.format]}`}>
        <StatusBadge map={EVENT_STATUS} value={e.status} />
        {canManage && <EditEventButton event={e} responsibles={responsibles} canDelete={canDelete} />}
        <SuperAdminDeleteButton kind="EVENT" id={e.id} name={e.name} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <Info label="Dates" value={[e.startDate && formatDate(e.startDate), e.endDate && formatDate(e.endDate)].filter(Boolean).join(" → ") || "—"} />
            <Info label="Lieu" value={[e.location, e.city, e.country].filter(Boolean).join(", ")} />
            <Info label="Spécialité" value={e.specialty} />
            <Info label="Produits" value={e.products} />
            <Info label="Capacité" value={e.capacity ? String(e.capacity) : "Illimitée"} />
            <Info label="Budget estimé" value={e.estimatedBudget !== null ? formatCurrency(e.estimatedBudget) : "—"} />
            <Info label="Responsable" value={e.responsibleName} />
            {e.meetingLink && <div className="col-span-full"><a href={e.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><Video className="h-4 w-4" /> Lien de connexion (webinar)</a></div>}
            {e.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Description</p><p className="whitespace-pre-wrap">{e.description}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Présence</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Mini label="Inscrits" value={e.stats.registered + e.stats.confirmed + e.stats.present} />
              <Mini label="Présents" value={e.stats.present} tone="success" />
              <Mini label="Taux présence" value={`${e.stats.attendanceRate}%`} tone="info" />
              <Mini label="Places restantes" value={e.stats.spotsLeft !== null ? String(e.stats.spotsLeft) : "∞"} />
            </div>
            {e.stats.byRole.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {e.stats.byRole.map((r) => <Badge key={r.role} tone="neutral" dot={false}>{PARTICIPANT_ROLE[r.role]} · {r.count}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {e.stats.bySpecialty.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Répartition par spécialité</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {e.stats.bySpecialty.map((s) => <Badge key={s.name} tone="info" dot={false}>{s.name} · {s.count}</Badge>)}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inscrits & check-in ({e.registrations.length})</h2>
        <RegistrationsManager eventId={e.id} registrations={e.registrations} canManage={canManage} />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
function Mini({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "info" }) {
  const c = tone === "success" ? "text-success" : tone === "info" ? "text-primary" : "";
  return <div className="rounded-lg border border-border p-2.5"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`text-lg font-semibold ${c}`}>{value}</p></div>;
}
