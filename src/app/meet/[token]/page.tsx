import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { roomUrl } from "@/lib/meetings";
import { PublicJoin } from "./public-join";

export const dynamic = "force-dynamic";

/**
 * Page PUBLIQUE (sans compte) d'une réunion, ouverte par un lien externe partagé.
 * Le jeton non devinable autorise l'accès à la salle Jitsi ; aucune donnée interne de
 * l'OS n'est exposée (seul le titre de la réunion est affiché).
 */
export default async function PublicMeetPage({ params }: { params: { token: string } }) {
  const meeting = await prisma.meeting.findUnique({
    where: { publicToken: params.token },
    select: { title: true, slug: true, withVideo: true, status: true },
  });
  if (!meeting) notFound();

  const url = roomUrl(meeting.slug, { video: meeting.withVideo });

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-xs text-primary-foreground">A</span>
          Adventum Pharma
        </div>
        {meeting.status === "ENDED" ? (
          <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
            <h1 className="text-lg font-semibold">{meeting.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Cette réunion est terminée.</p>
          </div>
        ) : (
          <PublicJoin baseUrl={url} title={meeting.title} />
        )}
        <p className="text-center text-xs text-muted-foreground">Réunion sécurisée — propulsée par Jitsi Meet.</p>
      </div>
    </main>
  );
}
