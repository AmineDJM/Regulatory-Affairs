import { Inbox, Reply } from "lucide-react";
import { requireModule } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { submitFeedback } from "@/lib/actions/feedback-actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { NAVIGATION, FEEDBACK_STATUS } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { FeedbackAttachments } from "./attachment-list";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS, MAX_ATTACHMENTS_PER_FEEDBACK, MAX_ATTACHMENT_BYTES } from "@/lib/files/attachment-policy";

export default async function FeedbackPage() {
  const user = await requireModule("WORKSPACE");

  const mods = accessibleModules(user);
  const seen = new Set<string>();
  const moduleOptions = NAVIGATION
    .filter((n) => mods.includes(n.module) && !seen.has(n.module) && seen.add(n.module))
    .map((n) => ({ value: n.label, label: n.label }));

  // Les pièces jointes sont LUES AVEC le retour, dans la même requête : une seconde requête
  // cliente pourrait revenir après coup et remplacer un objet complet par un objet partiel —
  // exactement le mécanisme qui faisait « disparaître » des documents ailleurs dans l'ERP.
  const myFeedbacks = await prisma.feedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      attachments: {
        select: { id: true, name: true, mime: true, size: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  // Boîte de réception : les feedbacks auxquels l'administration a répondu.
  const replies = myFeedbacks.filter((f) => f.adminNote && f.adminNote.trim());

  const fields: FieldDef[] = [
    { type: "select", name: "module", label: "Module concerné (optionnel)", options: moduleOptions, placeholder: "—", full: true },
    { type: "textarea", name: "message", label: "Votre message", required: true, full: true, placeholder: "Un problème, une idée, une difficulté, une amélioration souhaitée…" },
    {
      type: "file", name: "files", label: "Pièces jointes (optionnel)", multiple: true, full: true,
      accept: ACCEPT_ATTRIBUTE,
      hint: `Une capture vaut dix explications. ${MAX_ATTACHMENTS_PER_FEEDBACK} fichiers au plus, ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} Mo chacun — ${ALLOWED_EXTENSIONS.join(", ")}.`,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Feedback"
        description="Un problème, une idée, une amélioration ? Envoyez-moi un retour directement depuis votre compte."
      >
        <CreateRecordButton
          label="Envoyer un feedback"
          title="Envoyer un feedback"
          description="Message libre. Indiquez le module concerné si pertinent."
          width="md"
          action={submitFeedback}
          fields={fields}
        />
      </PageHeader>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Inbox className="h-4 w-4" /> Boîte de réception
          {replies.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground">{replies.length}</span>}
        </h2>
        {replies.length === 0 ? (
          <EmptyState icon="Inbox" title="Aucune réponse pour le moment" description="Les réponses de l'administration à vos retours s'afficheront ici." />
        ) : (
          <div className="space-y-2">
            {replies.map((f) => (
              <Card key={f.id} className="border-primary/30">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{f.module ? `${f.module} · ` : ""}{formatDateTime(f.updatedAt)}</p>
                    <StatusBadge map={FEEDBACK_STATUS} value={f.status} />
                  </div>
                  <p className="whitespace-pre-wrap rounded-lg bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">Vous : {f.message}</p>
                  <FeedbackAttachments items={f.attachments.map((a) => ({ ...a, canRemove: true }))} />
                  <div className="flex items-start gap-2">
                    <Reply className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="whitespace-pre-wrap text-sm font-medium">{f.adminNote}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes feedbacks envoyés</h2>
        {myFeedbacks.length === 0 ? (
          <EmptyState icon="MessageSquarePlus" title="Aucun feedback pour le moment" description="Vos retours apparaîtront ici, avec leur statut de traitement." />
        ) : (
          <div className="space-y-2">
            {myFeedbacks.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.module ? `${f.module} · ` : ""}{formatDateTime(f.createdAt)}
                    </p>
                    {/* C'EST SON retour : il peut retirer ses propres pièces. */}
                    <FeedbackAttachments items={f.attachments.map((a) => ({ ...a, canRemove: true }))} />
                  </div>
                  <StatusBadge map={FEEDBACK_STATUS} value={f.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
