import Link from "next/link";
import { ExternalLink, Paperclip, Banknote } from "lucide-react";
import { requireModule } from "@/lib/session";
import { accessibleModules } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getMyValidations, type PendingValidationItem, type MyValidationItem } from "@/lib/queries/validations";
import { groupValidations, type ValidationGroup } from "@/lib/validations/grouping";
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
import { financeRecipients } from "@/lib/queries/finance-people";
import { NewPaymentButton } from "./paiements/new-payment-button";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { DocumentList } from "@/components/documents/document-list";

export default async function ValidationsPage({ searchParams }: { searchParams: { focus?: string } }) {
  /**
   * `?focus=<stepId>` — ON ARRIVE **DANS** LA VALIDATION.
   *
   * Depuis « Mon espace », cliquer une validation menait à cet écran et pas plus loin : on
   * cherchait des yeux, dans une liste, la ligne qu'on venait de cliquer. La validation visée
   * passe désormais EN TÊTE, encadrée, avec ses pièces et son panneau de décision ouverts —
   * on agit sans un clic de plus.
   */
  const focusStep = searchParams.focus ?? null;
  const user = await requireModule("VALIDATIONS");
  const [{ toValidate, myRequests, crossModule, supervised }, financePeople] = await Promise.all([
    getMyValidations(user),
    // Les destinataires possibles d'une demande de paiement : les personnes du module Finances.
    financeRecipients(),
  ]);
  // À traiter maintenant (mon tour) vs assignées mais en attente du validateur précédent.
  const focusFirst = <T extends { stepId: string }>(list: T[]): T[] =>
    focusStep ? [...list].sort((a, b) => Number(b.stepId === focusStep) - Number(a.stepId === focusStep)) : list;
  const actionable = focusFirst(toValidate.filter((v) => v.actionable));
  const upcoming = focusFirst(toValidate.filter((v) => !v.actionable));

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

  // UNE DEMANDE = UNE DEMANDE. Les validations de pièces se regroupent sous la demande dont
  // elles proviennent : sans cela, quatre pièces soumises séparément s'affichaient comme quatre
  // demandes, et l'acceptation de l'une se lisait comme celle du tout.
  const myGroups = groupValidations(myRequests);
  const pendingMine = myGroups.filter((g) => g.status === "PENDING").length;
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
        {/* LA DEMANDE DE PAIEMENT SE FAIT D'ICI — c'est sa seule porte d'entrée, le module à
            part a disparu. Une fois le bon à payer donné, le dossier passe OBLIGATOIREMENT par
            le centre de paiement (dès 50 000 DZD), puis atterrit dans les Règlements à effectuer. */}
        <NewPaymentButton people={financePeople} />
      </PageHeader>

      {/* Le suivi des demandes de paiement (les miennes, et la file à instruire pour les
          Finances) vit sur son écran dédié — accessible d'ici, plus par le menu. */}
      <Link
        href="/validations/paiements"
        className="surface flex flex-wrap items-center justify-between gap-3 p-3 text-sm transition-colors hover:bg-secondary/40"
      >
        <span className="flex items-center gap-2 font-medium">
          <Banknote className="h-4 w-4 text-primary" /> Suivi des demandes de paiement
        </span>
        <span className="text-xs text-muted-foreground">
          Vos dossiers de paiement, et la file à instruire pour les Finances. Autorisation au centre de paiement dès 50 000 DZD, puis Règlements.
        </span>
      </Link>

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
        <KpiCard label="Total de mes demandes" value={myGroups.length} icon="ListChecks" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">À valider ({actionable.length})</h2>
        {actionable.length === 0 ? (
          <EmptyState icon="CheckCheck" title="Aucune validation en attente" description="Les éléments qui requièrent votre validation apparaîtront ici." />
        ) : (
          <div className="space-y-3">
            {actionable.map((v) => <PendingValidationCard key={v.stepId} v={v} actionable focused={v.stepId === focusStep} />)}
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
            {upcoming.map((v) => <PendingValidationCard key={v.stepId} v={v} actionable={false} focused={v.stepId === focusStep} />)}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes demandes de validation ({myGroups.length})</h2>
        {myGroups.length === 0 ? (
          <EmptyState icon="Send" title="Aucune demande envoyée" description="Vos demandes de validation et leur avancement apparaîtront ici." />
        ) : (
          <div className="space-y-2">
            {myGroups.map((g) => <MyRequestCard key={g.key} g={g} isSuperAdmin={user.role === "SUPER_ADMIN"} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * UNE DEMANDE, UNE CARTE — même quand ses pièces ont été soumises séparément.
 *
 * Le statut affiché est celui du TOUT : une facture acceptée pendant que le bon de commande
 * attend ne fait pas une demande acceptée. Le détail par pièce est là, juste en dessous, avec
 * son propre verdict — c'est là, et seulement là, qu'« accepté » veut dire « cette pièce ».
 */
function MyRequestCard({ g, isSuperAdmin }: { g: ValidationGroup<MyValidationItem>; isSuperAdmin: boolean }) {
  const head = g.main ?? g.pieces[0];
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{head.reference}</span>
            <span className="font-medium">{g.title}</span>
            <Badge tone="neutral" dot={false}>{head.module}</Badge>
            {g.main && <span className="text-xs text-muted-foreground">{VALIDATION_MODE[g.main.mode]}</span>}
          </div>
          <div className="flex items-center gap-2">
            {head.amount !== null && <span className="text-sm font-semibold">{formatCurrency(head.amount)}</span>}
            <StatusBadge map={VALIDATION_STATUS} value={g.status} />
            {isSuperAdmin && g.main && (
              <SuperAdminDeleteButton kind="VALIDATION_REQUEST" id={g.main.id} name={`${g.main.reference} — ${g.main.title}`} enabled />
            )}
          </div>
        </div>

        {/* La phrase qui lève l'ambiguïté, avant tout le reste. */}
        {g.summary && <p className="text-xs text-muted-foreground">{g.summary}</p>}

        {g.main && <StepChips steps={g.main.steps} />}

        {/* PIÈCE PAR PIÈCE — chaque validation garde SON verdict, clairement nommée. */}
        {g.pieces.length > 0 && (
          <ul className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/20 p-2">
            {g.pieces.map((p) => (
              <li key={p.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{p.documentName ?? p.title}</span>
                  <span className="font-mono text-muted-foreground">{p.reference}</span>
                  <StatusBadge map={VALIDATION_STATUS} value={p.status} dot={false} />
                </div>
                <div className="pl-5"><StepChips steps={p.steps} /></div>
              </li>
            ))}
          </ul>
        )}

        {/* Retour DÉTAILLÉ par élément (message + pièces) : le demandeur voit exactement ce qui va / ne va pas. */}
        {[g.main, ...g.pieces].filter((r): r is MyValidationItem => Boolean(r)).flatMap((r) => r.steps).some((s) => s.items && s.items.length > 0) && (
          <div className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/20 p-2">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">Retour détaillé par élément</p>
            {[g.main, ...g.pieces].filter((r): r is MyValidationItem => Boolean(r)).map((r) =>
              r.steps.filter((s) => s.items && s.items.length > 0).map((s) => (
                <div key={`${r.id}-${s.order}`} className="space-y-0.5">
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
              )),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Les validateurs d'un circuit et leur verdict, en pastilles. */
function StepChips({ steps }: { steps: MyValidationItem["steps"] }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s) => (
        <span key={s.order} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs" title={s.reason || undefined}>
          <span className="text-muted-foreground">{s.order}.</span>
          <span>{s.validator}</span>
          <StatusBadge map={VALIDATION_STEP_STATE} value={s.status} dot={false} />
        </span>
      ))}
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
function PendingValidationCard({ v, actionable, focused = false }: { v: PendingValidationItem; actionable: boolean; focused?: boolean }) {
  const d = v.deadline ? daysUntil(v.deadline) : null;
  const msgDecision = v.itemDecisions.find((x) => x.itemKey === "MESSAGE");
  return (
    <Card id={`val-${v.stepId}`} className={focused ? "scroll-mt-24 ring-2 ring-primary/50" : "scroll-mt-24"}>
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
