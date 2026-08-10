import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireModule } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getMyValidations, type PendingValidationItem } from "@/lib/queries/validations";
import { createValidationRequest } from "@/lib/actions/validation-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { NAVIGATION, PRIORITY, VALIDATION_STATUS, VALIDATION_STEP_STATE, VALIDATION_MODE } from "@/lib/labels";
import { formatCurrency, formatDate, formatDateTime, daysUntil } from "@/lib/utils";
import { ValidationDecision } from "./validation-decision";
import { ItemReview } from "./validation-item-review";
import { ValidationAttachments } from "./validation-attachments";
import { SupervisionBoard } from "./supervision-board";
import { supervisionCounters } from "@/lib/validation-supervision";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { DocumentList } from "@/components/documents/document-list";

export default async function ValidationsPage() {
  const user = await requireModule("VALIDATIONS");
  const { toValidate, myRequests, crossModule, supervised } = await getMyValidations(user);
  // À traiter maintenant (mon tour) vs assignées mais en attente du validateur précédent.
  const actionable = toValidate.filter((v) => v.actionable);
  const upcoming = toValidate.filter((v) => !v.actionable);

  const mods = accessibleModules(user);
  const seen = new Set<string>();
  const moduleOptions = NAVIGATION
    .filter((n) => mods.includes(n.module) && !seen.has(n.module) && seen.add(n.module))
    .map((n) => ({ value: n.label, label: n.label }));

  // Validateurs possibles : tous les collaborateurs actifs (le demandeur s'exclut
  // de fait, l'action ignore une étape qui le viserait lui-même).
  const people = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const peopleOptions = people.map((p) => ({ value: p.id, label: p.name }));

  const requestFields: FieldDef[] = [
    { type: "text", name: "title", label: "Objet à valider", required: true, full: true, placeholder: "Ex. Courrier à signer, paiement prestataire…" },
    { type: "select", name: "validator1Id", label: "Validateur", options: peopleOptions, placeholder: "— Choisir un validateur —" },
    { type: "select", name: "validator2Id", label: "2ᵉ validateur (optionnel)", options: peopleOptions, placeholder: "— Aucun —" },
    { type: "select", name: "priority", label: "Priorité", options: optionsFromMap(PRIORITY), defaultValue: "MEDIUM" },
    { type: "date", name: "deadline", label: "Échéance" },
    { type: "text", name: "link", label: "Lien vers l'objet (optionnel)", placeholder: "/courrier/… ou /demandes/…" },
    { type: "textarea", name: "description", label: "Détails / contexte", full: true },
    { type: "file", name: "files", label: "Pièces jointes (optionnel)", multiple: true, full: true, hint: "Documents à faire valider (PDF, images, Word…)." },
    { type: "select", name: "module", label: "Module concerné (routage auto si aucun validateur)", options: moduleOptions, placeholder: "— Routage automatique par règles —" },
  ];

  const pendingMine = myRequests.filter((r) => r.status === "PENDING").length;
  // Les compteurs de supervision sont calculés côté serveur pour l'en-tête ; le tableau les
  // recalcule pour ses filtres, à partir des MÊMES fonctions pures — les deux ne peuvent pas
  // diverger.
  const supervisionStats = supervisionCounters(supervised, new Date());

  return (
    <div className="space-y-5">
      <PageHeader
        title="Demandes de validations"
        description="Le bureau de validation : demandez une validation professionnelle à la personne de votre choix, et traitez ce qui requiert la vôtre. Le demandeur ne voit que ses propres demandes ; les validateurs voient ce qu'ils ont à valider."
      >
        <CreateRecordButton
          label="Demander une validation"
          title="Demander une validation"
          description="Choisissez le(s) validateur(s). À défaut, la demande est routée automatiquement selon les règles définies par le Super Admin."
          action={createValidationRequest}
          fields={requestFields}
        />
      </PageHeader>

      {/* Les chiffres du haut répondent à « qu'est-ce qui m'attend ? » puis, pour la Direction,
          à « qu'est-ce qui est en retard, et où ? » — pas à « combien en ai-je envoyé ». */}
      <div className={`grid grid-cols-2 gap-3 ${supervised.length > 0 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <KpiCard label="À valider par vous" value={actionable.length + crossModule.length} icon="ShieldCheck" tone={actionable.length + crossModule.length > 0 ? "warning" : "default"} />
        {supervised.length > 0 && (
          <KpiCard
            label="En retard (société)" value={supervisionStats.overdue} icon="AlarmClock"
            tone={supervisionStats.overdue > 0 ? "danger" : "default"}
            hint={supervisionStats.stalled > 0 ? `${supervisionStats.stalled} sans décision depuis 7 j` : undefined}
          />
        )}
        <KpiCard label="Mes demandes en cours" value={pendingMine} icon="Hourglass" tone="info" />
        <KpiCard label="Total de mes demandes" value={myRequests.length} icon="ListChecks" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À valider ({actionable.length})</h2>
        {actionable.length === 0 ? (
          <EmptyState icon="CheckCheck" title="Aucune validation en attente" description="Les éléments qui requièrent votre validation apparaîtront ici." />
        ) : (
          <div className="space-y-3">
            {actionable.map((v) => <PendingValidationCard key={v.stepId} v={v} actionable />)}
          </div>
        )}
      </section>

      {supervised.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Supervision — tout ce qui circule ({supervised.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Vue Direction : les demandes de validation de toute la société, <strong>la plus urgente en tête</strong>,
              avec le validateur chez qui elles attendent. Les compteurs sont des filtres ; la relance part en
              notification (et en push) à la personne dont on attend la décision.
            </p>
          </div>
          <SupervisionBoard rows={supervised} isSuperAdmin={user.role === "SUPER_ADMIN"} />
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Qui vous reviendront — en attente du validateur précédent ({upcoming.length})</h2>
          <p className="text-xs text-muted-foreground">Vous êtes validateur de ces demandes : consultez-les et leurs pièces dès maintenant ; vous pourrez décider quand ce sera votre tour.</p>
          <div className="space-y-3">
            {upcoming.map((v) => <PendingValidationCard key={v.stepId} v={v} actionable={false} />)}
          </div>
        </section>
      )}

      {crossModule.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Validations transverses — autres modules ({crossModule.length})</h2>
          <div className="space-y-2">
            {crossModule.map((v) => (
              <Card key={v.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{v.reference}</span>
                      <Badge tone="info" dot={false}>{v.module}</Badge>
                      <Badge tone="neutral" dot={false}>{v.stage}</Badge>
                      {v.amount !== null && <span className="text-sm font-semibold">{formatCurrency(v.amount)}</span>}
                    </div>
                    <p className="truncate font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">Demandé par {v.requester || "—"} · {formatDateTime(v.createdAt)}</p>
                  </div>
                  <Link href={v.link} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
                    <ExternalLink className="h-4 w-4" /> Ouvrir pour valider
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes demandes de validation ({myRequests.length})</h2>
        {myRequests.length === 0 ? (
          <EmptyState icon="Send" title="Aucune demande envoyée" description="Vos demandes de validation et leur avancement apparaîtront ici." />
        ) : (
          <div className="space-y-2">
            {myRequests.map((r) => (
              <Card key={r.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
                      <span className="font-medium">{r.title}</span>
                      <Badge tone="neutral" dot={false}>{r.module}</Badge>
                      <span className="text-xs text-muted-foreground">{VALIDATION_MODE[r.mode]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.amount !== null && <span className="text-sm font-semibold">{formatCurrency(r.amount)}</span>}
                      <StatusBadge map={VALIDATION_STATUS} value={r.status} />
                      {user.role === "SUPER_ADMIN" && (
                        <SuperAdminDeleteButton kind="VALIDATION_REQUEST" id={r.id} name={`${r.reference} — ${r.title}`} enabled />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.steps.map((s) => (
                      <span key={s.order} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs" title={s.reason || undefined}>
                        <span className="text-muted-foreground">{s.order}.</span>
                        <span>{s.validator}</span>
                        <StatusBadge map={VALIDATION_STEP_STATE} value={s.status} dot={false} />
                      </span>
                    ))}
                  </div>
                  {/* Retour DÉTAILLÉ par élément (message + pièces) : le demandeur voit exactement ce qui va / ne va pas. */}
                  {r.steps.some((s) => s.items && s.items.length > 0) && (
                    <div className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/20 p-2">
                      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Retour détaillé par élément</p>
                      {r.steps.filter((s) => s.items && s.items.length > 0).map((s) => (
                        <div key={s.order} className="space-y-0.5">
                          <p className="text-xs font-medium">{s.validator}</p>
                          <ul className="space-y-0.5 pl-3">
                            {s.items!.map((it, i) => (
                              <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground">{it.label}</span>
                                <StatusBadge map={VALIDATION_STEP_STATE} value={it.decision} dot={false} />
                                {it.comment && <span className="text-muted-foreground">— {it.comment}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Carte d'une demande qui M'EST assignée comme validateur. Le validateur y a un ACCÈS
 * COMPLET à la demande : contexte, échéance, lien vers l'objet, et surtout les PIÈCES
 * (aperçu sur place, lecture seule). Quand c'est son tour (`actionable`), le panneau de
 * décision permet de VALIDER / demander une MODIFICATION / REFUSER — avec un commentaire
 * optionnel dans les trois cas. Sinon (circuit séquentiel, pas encore son tour), il
 * consulte déjà tout mais un badge indique qu'il décidera le moment venu.
 */
function PendingValidationCard({ v, actionable }: { v: PendingValidationItem; actionable: boolean }) {
  const d = v.deadline ? daysUntil(v.deadline) : null;
  const msgDecision = v.itemDecisions.find((x) => x.itemKey === "MESSAGE");
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{v.reference}</span>
            <Badge tone="neutral" dot={false}>{v.module}</Badge>
            {v.objectType && <Badge tone="neutral" dot={false}>{v.objectType}</Badge>}
            <StatusBadge map={PRIORITY} value={v.priority} dot={false} />
            {v.amount !== null && <span className="text-sm font-semibold">{formatCurrency(v.amount)}</span>}
          </div>
          <p className="font-medium">{v.title}</p>
          {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
          {/* Verdict par ÉLÉMENT (message) : approuver / réviser / refuser + commentaire optionnel. */}
          {actionable && (
            <div className="rounded-lg border border-border/60 bg-secondary/20 p-2">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Votre avis sur le message</p>
              <ItemReview stepId={v.stepId} itemKey="MESSAGE" current={msgDecision?.decision} currentComment={msgDecision?.comment} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Demandé par {v.requester || "—"} · {formatDateTime(v.createdAt)}
            {v.deadline ? ` · échéance ${formatDate(v.deadline)}${d !== null && d < 0 ? " (en retard)" : ""}` : ""}
          </p>
          {v.link && (
            <Link href={v.link} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" /> Ouvrir l&apos;élément
            </Link>
          )}
          {v.documents.length > 0 && (
            <div className="mt-1 rounded-lg border border-border/60 bg-secondary/30 p-2">
              <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                Pièces à valider ({v.documents.length})
              </p>
              {/* Actionnable : aperçu sur place + verdict PAR pièce. Sinon : lecture seule. */}
              {actionable ? (
                <ValidationAttachments stepId={v.stepId} documents={v.documents} decisions={v.itemDecisions} />
              ) : (
                <DocumentList documents={v.documents} />
              )}
            </div>
          )}
        </div>
        <div className="shrink-0">
          {actionable ? (
            <ValidationDecision stepId={v.stepId} />
          ) : (
            <Badge tone="warning" dot={false}>En attente de votre tour</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
