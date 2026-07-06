import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Users, Sparkles, ListChecks, FileText, CircleUser } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { publicMeetUrl, appBaseUrlForMeet, canViewMeeting, canManageMeeting } from "@/lib/meetings";
import { aiConfigured } from "@/lib/ai";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MeetJoin } from "./meet-join";
import { formatAlgiers, utcToAlgiersInput } from "@/lib/calendar-tz";

const formatDateTime = (d: Date) => formatAlgiers(d, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
import { MeetingRecorder } from "./meeting-recorder";
import { TranscriptPanel, ProposalActions, ShareLink, ManageBar } from "./meeting-panels";
import { EditMeetingButton } from "../edit-meeting-button";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  LIVE: { label: "En cours", tone: "success" },
  SCHEDULED: { label: "Planifiée", tone: "warning" },
  ENDED: { label: "Terminée", tone: "neutral" },
};

function externalBase(): string {
  const fromEnv = appBaseUrlForMeet();
  if (fromEnv) return fromEnv;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("MESSAGING");

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      organizer: { select: { id: true, name: true } },
      participants: { include: { user: { select: { id: true, name: true, title: true } } } },
      proposals: { include: { assignee: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!meeting) notFound();
  if (!canViewMeeting(user, meeting)) notFound();
  const canManage = canManageMeeting(user, meeting);

  const base = externalBase();
  const shareUrl = base ? publicMeetUrl(meeting.publicToken, base) : "";
  const openProposals = meeting.proposals.filter((p) => p.status === "PROPOSED");
  const acceptedCount = meeting.proposals.filter((p) => p.status === "ACCEPTED").length;

  return (
    <div className="space-y-5">
      <Link href="/meetings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Réunions
      </Link>

      <PageHeader title={meeting.title} description={meeting.description ?? undefined}>
        <Badge tone={STATUS[meeting.status]?.tone ?? "neutral"} dot={false}>{STATUS[meeting.status]?.label ?? meeting.status}</Badge>
        {canManage && meeting.status !== "ENDED" && (
          <EditMeetingButton
            id={meeting.id}
            title={meeting.title}
            description={meeting.description ?? ""}
            meetLink={meeting.meetLink ?? ""}
            scheduledAtInput={meeting.scheduledAt ? utcToAlgiersInput(meeting.scheduledAt) : ""}
            withVideo={meeting.withVideo}
          />
        )}
        {canManage && <ManageBar meetingId={meeting.id} status={meeting.status} />}
        <SuperAdminDeleteButton kind="MEETING" id={meeting.id} name={meeting.title} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <MeetJoin meetingId={meeting.id} meetLink={meeting.meetLink} canManage={canManage} />

          {/* Compte rendu IA */}
          {meeting.summary && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Compte rendu</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{meeting.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Tâches proposées */}
          {(openProposals.length > 0 || acceptedCount > 0) && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Tâches proposées</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {openProposals.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{p.title}</p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">Pour : {p.assignee?.name ?? "à assigner (organisateur)"}</p>
                    </div>
                    {canManage && <ProposalActions proposalId={p.id} />}
                  </div>
                ))}
                {acceptedCount > 0 && (
                  <p className="text-xs text-muted-foreground">{acceptedCount} tâche(s) déjà créée(s) dans « Mon espace ».</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Enregistrement + transcription (organisateur) */}
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Enregistrement & compte rendu</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <MeetingRecorder meetingId={meeting.id} />
                <TranscriptPanel meetingId={meeting.id} transcript={meeting.transcript ?? ""} canSummarize={aiConfigured()} />
                {!aiConfigured() && <p className="text-xs text-muted-foreground">Le compte rendu automatique s'activera une fois l'IA configurée (ANTHROPIC_API_KEY).</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Latéral */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Lien externe partageable</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Partagez ce lien à un invité externe (sans compte, sans limite de temps).</p>
              {shareUrl ? <ShareLink url={shareUrl} /> : <p className="text-xs text-muted-foreground">Définissez <code>APP_URL</code> pour générer un lien absolu.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Participants</CardTitle></CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <CircleUser className="h-4 w-4 text-primary" />
                <span className="font-medium">{meeting.organizer?.name ?? "—"}</span>
                <Badge tone="neutral" dot={false}>Organisateur</Badge>
              </div>
              {meeting.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-muted-foreground">
                  <CircleUser className="h-4 w-4" />
                  <span>{p.user?.name ?? "—"}</span>
                  {p.user?.title && <span className="text-xs">· {p.user.title}</span>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Type" value={meeting.withVideo ? "Vidéo" : "Audio"} />
              {meeting.scheduledAt && <Row label="Planifiée" value={formatDateTime(meeting.scheduledAt)} />}
              {meeting.startedAt && <Row label="Démarrée" value={formatDateTime(meeting.startedAt)} />}
              {meeting.endedAt && <Row label="Terminée" value={formatDateTime(meeting.endedAt)} />}
              <Row label="Créée" value={formatDateTime(meeting.createdAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
