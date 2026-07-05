import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Clock, Paperclip, User } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getDriverMissions, getMissionAttachments } from "@/lib/queries/admin-requests";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DRIVER_MISSION_STATUS } from "@/lib/labels";
import { formatAlgiers } from "@/lib/calendar-tz";
import { formatBytes } from "../../messages/format";
import { MissionActions } from "./mission-actions";
import { MissionStops } from "./mission-stops";

export default async function DriverPage() {
  const user = await requireModule("ADMIN_REQUESTS");
  const missions = await getDriverMissions(user);
  const active = missions.filter((m) => m.status !== "DONE" && m.status !== "CANCELLED");
  const done = missions.filter((m) => m.status === "DONE" || m.status === "CANCELLED");
  const attachments = await getMissionAttachments(active.map((m) => m.id));
  const now = new Date();

  return (
    <div className="space-y-5">
      <Link href="/demandes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Demandes
      </Link>
      <PageHeader title="Mes courses" description="Vos courses du jour, point par point : cochez chaque point une fois fait." />

      {active.length === 0 ? (
        <EmptyState icon="Car" title="Aucune course en cours" description="Vos courses assignées apparaîtront ici." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((m) => {
            const late = m.deadline ? m.deadline < now : false;
            const docs = attachments.get(m.id) ?? [];
            return (
              <div key={m.id} className="surface space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-semibold">{m.title}</p>
                  <StatusBadge map={DRIVER_MISSION_STATUS} value={m.status} dot={false} />
                </div>

                {m.deadline && (
                  <p className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ${late ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground"}`}>
                    <Clock className="h-4 w-4 shrink-0" />
                    À faire avant le {formatAlgiers(m.deadline, { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                    {late ? " — en retard" : ""}
                  </p>
                )}

                {m.stops.length > 0 ? (
                  <MissionStops stops={m.stops.map((s) => ({ id: s.id, location: s.location, task: s.task, done: s.done }))} />
                ) : (
                  (m.destination || m.address) && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {[m.destination, m.address].filter(Boolean).join(" · ")}</p>
                  )
                )}

                {m.instructions && <p className="rounded-md bg-muted/40 p-2.5 text-sm">{m.instructions}</p>}

                {m.contactPhone && (
                  <p className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${m.contactPhone}`} className="font-medium text-primary hover:underline">{m.contactName ? `${m.contactName} — ` : ""}{m.contactPhone}</a>
                  </p>
                )}

                {docs.length > 0 && (
                  <div className="space-y-1">
                    {docs.map((d) => (
                      <a key={d.id} href={`/api/documents/${d.id}?dl=1`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 truncate">{d.name}</span>
                        {d.sizeBytes != null && <span className="shrink-0 text-xs text-muted-foreground">({formatBytes(d.sizeBytes)})</span>}
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {m.createdById && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> Demandée le {formatAlgiers(m.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                  {m.request && <Link href={`/demandes/${m.request.id}`} className="text-primary hover:underline">Demande {m.request.reference}</Link>}
                </div>

                <div className="pt-1"><MissionActions id={m.id} status={m.status} /></div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Terminées</h2>
          <div className="surface divide-y divide-border">
            {done.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">{m.title}</span>
                <StatusBadge map={DRIVER_MISSION_STATUS} value={m.status} dot={false} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
