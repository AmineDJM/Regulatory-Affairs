import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Clock } from "lucide-react";
import { requireModule } from "@/lib/session";
import { getDriverMissions } from "@/lib/queries/admin-requests";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DRIVER_MISSION_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { MissionActions } from "./mission-actions";

export default async function DriverPage() {
  const user = await requireModule("ADMIN_REQUESTS");
  const missions = await getDriverMissions(user);
  const active = missions.filter((m) => m.status !== "DONE" && m.status !== "CANCELLED");
  const done = missions.filter((m) => m.status === "DONE" || m.status === "CANCELLED");

  return (
    <div className="space-y-5">
      <Link href="/demandes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Demandes
      </Link>
      <PageHeader title="Mes missions" description="Vos courses du jour : dépôts, récupérations, aéroport…" />

      {active.length === 0 ? (
        <EmptyState icon="Car" title="Aucune mission en cours" description="Vos missions assignées apparaîtront ici." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((m) => (
            <div key={m.id} className="surface space-y-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{m.title}</p>
                <StatusBadge map={DRIVER_MISSION_STATUS} value={m.status} dot={false} />
              </div>
              {(m.destination || m.address) && (
                <p className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {[m.destination, m.address].filter(Boolean).join(" · ")}</p>
              )}
              {m.contactPhone && (
                <p className="flex items-center gap-1.5 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> <a href={`tel:${m.contactPhone}`} className="text-primary hover:underline">{m.contactName ? `${m.contactName} — ` : ""}{m.contactPhone}</a></p>
              )}
              {m.deadline && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {formatDate(m.deadline)}</p>}
              {m.instructions && <p className="rounded-md bg-muted/40 p-2 text-sm">{m.instructions}</p>}
              {m.request && <Link href={`/demandes/${m.request.id}`} className="text-xs text-primary hover:underline">Demande {m.request.reference}</Link>}
              <div className="pt-1"><MissionActions id={m.id} status={m.status} /></div>
            </div>
          ))}
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
