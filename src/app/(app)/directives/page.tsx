import Link from "next/link";
import { ArrowRight, Megaphone, MessageSquare, Clock } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getDirectives } from "@/lib/queries/directives";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { createDirective } from "@/lib/actions/directive-actions";
import { DIRECTIVE_STATUS, PRIORITY, ROLE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DirectivesPage() {
  const user = await requireModule("DIRECTIVES");
  const canManage = hasGlobalView(user.role) || userCan(user, "DIRECTIVES", "CREATE");

  const [directives, users] = await Promise.all([
    getDirectives(user),
    canManage ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  // Rôles utiles comme destinataires de diffusion.
  const roleOptions = [
    { value: "", label: "— (ou choisir une personne) —" },
    ...Object.entries(ROLE_LABELS).filter(([v]) => v !== "SUPER_ADMIN").map(([v, l]) => ({ value: v, label: l })),
  ];
  const userOptions = [{ value: "", label: "— (ou choisir un rôle) —" }, ...users.map((u) => ({ value: u.id, label: `${u.name} — ${ROLE_LABELS[u.role] ?? u.role}` }))];

  const active = directives.filter((d) => d.status !== "ARCHIVED" && d.status !== "DONE");

  return (
    <div className="space-y-5">
      <PageHeader title="Directives" description="Instructions priorisées de la Direction vers les équipes, avec un espace d'échange et un suivi.">
        {canManage && (
          <CreateRecordButton
            label="Nouvelle directive"
            title="Émettre une directive"
            description="Adressez-la à une personne précise OU à un rôle entier. Le destinataire est notifié et peut répondre dans le fil."
            action={createDirective}
            redirectBase="/directives"
            fields={[
              { type: "text", name: "title", label: "Objet", required: true },
              { type: "textarea", name: "body", label: "Directive (contenu)", required: true },
              { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
              { type: "date", name: "dueDate", label: "Échéance (optionnel)" },
              { type: "select", name: "targetUserId", label: "Destinataire — personne", options: userOptions },
              { type: "select", name: "targetRole", label: "Destinataire — rôle (diffusion)", options: roleOptions },
            ]}
          />
        )}
      </PageHeader>

      {directives.length === 0 ? (
        <EmptyState icon="Megaphone" title="Aucune directive" description={canManage ? "Émettez une directive pour vos équipes." : "Les directives de la Direction qui vous concernent apparaîtront ici."} />
      ) : (
        <Card>
          <div className="divide-y divide-border">
            {directives.map((d) => (
              <Link key={d.id} href={`/directives/${d.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/50">
                <Megaphone className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                    <span className="truncate font-medium">{d.title}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>→ {d.targetUser?.name ?? (d.targetRole ? (ROLE_LABELS[d.targetRole] ?? d.targetRole) : "—")}</span>
                    <span>· {formatDate(d.createdAt.toISOString())}</span>
                    {d._count.messages > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {d._count.messages}</span>}
                    {d.dueDate && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(d.dueDate.toISOString())}</span>}
                  </p>
                </div>
                <StatusBadge map={PRIORITY} value={d.priority} dot={false} />
                <StatusBadge map={DIRECTIVE_STATUS} value={d.status} />
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {canManage && active.length > 0 && (
        <p className="text-xs text-muted-foreground">{active.length} directive(s) en cours de traitement.</p>
      )}
    </div>
  );
}
