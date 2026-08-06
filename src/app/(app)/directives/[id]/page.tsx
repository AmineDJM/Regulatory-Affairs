import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, Clock, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { getDirective, canViewDirective } from "@/lib/queries/directives";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { DIRECTIVE_STATUS, PRIORITY, ROLE_LABELS } from "@/lib/labels";
import { StatusActions, MessageForm } from "./panel";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

export default async function DirectiveDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const d = await getDirective(params.id);
  if (!d) notFound();
  if (!canViewDirective(user, d)) notFound();

  const canManage = hasGlobalView(user.role) || userCan(user, "DIRECTIVES", "CREATE");
  const target = d.targetUser?.name ?? (d.targetRole ? (ROLE_LABELS[d.targetRole] ?? d.targetRole) : "—");

  return (
    <div className="space-y-5">
      <BackLink href="/directives">
        <ArrowLeft className="h-4 w-4" /> Retour aux directives
      </BackLink>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">{d.title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{d.reference}</span> · de {d.from?.name ?? "Direction"} → {target}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge map={PRIORITY} value={d.priority} dot={false} />
            <StatusBadge map={DIRECTIVE_STATUS} value={d.status} />
          </div>
          <SuperAdminDeleteButton kind="DIRECTIVE" id={d.id} name={`${d.reference} — ${d.title}`} enabled={user.role === "SUPER_ADMIN"} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Directive</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm">{d.body}</p>
              <div className="flex flex-wrap gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                <span>Émise le {formatDate(d.createdAt.toISOString())}</span>
                {d.dueDate && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Échéance {formatDate(d.dueDate.toISOString())}</span>}
                {d.acknowledgedAt && <span>Pris en compte le {formatDate(d.acknowledgedAt.toISOString())}</span>}
              </div>
            </CardContent>
          </Card>

          {/* Espace d'échange */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Échanges</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {d.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun échange pour l'instant.</p>
              ) : (
                <ul className="space-y-3">
                  {d.messages.map((m) => {
                    const mine = m.authorId === user.id;
                    return (
                      <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[11px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {m.author?.name ?? "—"} · {formatDateTime(m.createdAt.toISOString())}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {d.status !== "ARCHIVED" && <MessageForm id={d.id} />}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Suivi</CardTitle></CardHeader>
            <CardContent>
              <StatusActions id={d.id} status={d.status} canManage={canManage} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
