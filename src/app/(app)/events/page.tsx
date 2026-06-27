import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getEvents } from "@/lib/queries/events";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Badge } from "@/components/ui/badge";
import { EVENT_TYPE, EVENT_FORMAT, EVENT_STATUS, EVENTS_TABS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { CreateEventButton } from "./event-form";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requireModule("EVENTS");
  const canCreate = userCan(user, "EVENTS", "CREATE");
  const [events, responsibles] = await Promise.all([
    getEvents(),
    canCreate ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const upcoming = events.filter((e) => e.startDate && new Date(e.startDate) >= new Date() && e.status !== "CANCELLED").length;
  const open = events.filter((e) => e.status === "REGISTRATION_OPEN").length;
  const totalReg = events.reduce((a, e) => a + e.registrations, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Events" description="Congrès, séminaires, staffs, webinars — billetterie, QR codes, check-in et présence.">
        {canCreate && <CreateEventButton responsibles={responsibles} />}
      </PageHeader>
      <ModuleTabs tabs={EVENTS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Événements" value={events.length} icon="CalendarDays" />
        <KpiCard label="À venir" value={upcoming} icon="CalendarClock" tone="info" />
        <KpiCard label="Inscriptions ouvertes" value={open} icon="DoorOpen" tone="success" />
        <KpiCard label="Inscrits (total)" value={totalReg} icon="Users" />
      </div>

      {events.length === 0 ? (
        <EmptyState icon="Ticket" title="Aucun événement" description={canCreate ? "Créez votre premier événement pour gérer inscriptions, QR codes et check-in." : "Les événements apparaîtront ici."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="surface flex flex-col gap-2 p-4 transition-colors hover:bg-secondary/40">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{e.name}</h3>
                <StatusBadge map={EVENT_STATUS} value={e.status} />
              </div>
              <p className="text-xs text-muted-foreground">{EVENT_TYPE[e.type]} · {EVENT_FORMAT[e.format]}{e.city ? ` · ${e.city}` : ""}</p>
              <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                <span>{e.startDate ? formatDate(e.startDate) : "Date à définir"}</span>
                <div className="flex items-center gap-1.5">
                  <Badge tone="info" dot={false}>{e.registrations} inscrit{e.registrations > 1 ? "s" : ""}{e.capacity ? `/${e.capacity}` : ""}</Badge>
                  {e.present > 0 && <Badge tone="success" dot={false}>{e.present} présent{e.present > 1 ? "s" : ""}</Badge>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
