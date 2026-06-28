import Link from "next/link";
import { Video, Mic, Users, ArrowRight, Radio } from "lucide-react";
import { requireModule } from "@/lib/session";
import { hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { NewMeetingButton } from "./new-meeting-button";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  LIVE: { label: "En cours", tone: "success" },
  SCHEDULED: { label: "Planifiée", tone: "warning" },
  ENDED: { label: "Terminée", tone: "neutral" },
};

export default async function MeetingsPage() {
  const user = await requireModule("MESSAGING");
  const where = hasGlobalView(user.role)
    ? {}
    : { OR: [{ organizerId: user.id }, { participants: { some: { userId: user.id } } }] };

  const meetings = await prisma.meeting.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { organizer: { select: { name: true } }, _count: { select: { participants: true } } },
  });

  // Personnes invitables (comptes actifs hors soi-même).
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: { id: true, name: true, title: true },
    orderBy: { name: "asc" },
  });

  const live = meetings.filter((m) => m.status === "LIVE");
  const upcoming = meetings.filter((m) => m.status === "SCHEDULED");
  const past = meetings.filter((m) => m.status === "ENDED");

  return (
    <div className="space-y-6">
      <PageHeader title="Réunions & appels" description="Réunions vidéo/audio (Jitsi), liens externes partageables, comptes rendus et tâches générés par l'IA.">
        <NewMeetingButton users={users} />
      </PageHeader>

      {meetings.length === 0 ? (
        <EmptyState icon="Video" title="Aucune réunion" description="Créez une réunion : un lien de salle est généré aussitôt, partageable même en externe." />
      ) : (
        <div className="space-y-6">
          <Section title="En cours" icon={<Radio className="h-4 w-4 text-success" />} items={live} empty="Aucune réunion en cours." />
          <Section title="À venir" items={upcoming} empty="Aucune réunion planifiée." />
          <Section title="Historique" items={past} empty="Aucune réunion passée." muted />
        </div>
      )}
    </div>
  );
}

type Row = {
  id: string; title: string; status: string; kind: string; withVideo: boolean;
  scheduledAt: Date | null; createdAt: Date; organizer: { name: string } | null; _count: { participants: number };
};

function Section({ title, items, empty, icon, muted }: { title: string; items: Row[]; empty: string; icon?: React.ReactNode; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m) => (
          <Link key={m.id} href={`/meetings/${m.id}`}
            className={`group surface flex flex-col gap-2 rounded-xl border border-border p-4 transition hover:border-primary/40 hover:shadow-sm ${muted ? "opacity-80" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                {m.withVideo ? <Video className="h-4 w-4 text-primary" /> : <Mic className="h-4 w-4 text-primary" />}
                <span className="truncate">{m.title}</span>
              </span>
              <Badge tone={STATUS[m.status]?.tone ?? "neutral"} dot={false}>{STATUS[m.status]?.label ?? m.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {m._count.participants + 1}</span>
              <span>{m.organizer?.name ?? "—"}</span>
              <span>{formatDateTime(m.scheduledAt ?? m.createdAt)}</span>
              {m.kind === "CALL" && <span className="rounded-full bg-secondary px-2 py-0.5">Appel</span>}
            </div>
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
              Ouvrir <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
