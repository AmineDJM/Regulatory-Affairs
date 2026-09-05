import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip, CheckCircle2, XCircle, CircleDashed, MinusCircle } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { userCan } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { formatDate, formatDateTime } from "@/lib/utils";
import { recruitmentViewer } from "@/lib/recruitment/access";
import {
  abilities, chainProgress, currentStep, CONTRACT_LABEL, CANDIDATE_LABEL, CANDIDATE_TONE,
  STAGE_LABEL, STAGE_TONE, salaryRange, needsOnboarding, candidateRank,
  type ChainStep, type RecruitmentStage, type RecruitmentContract, type CandidateStatus,
} from "@/lib/recruitment/request-flow";
import {
  ChainDecisionPanel, CancelRequestButton, HrPanel, AnswerInfoForm,
  AddCandidateButton, CandidateActions, OnboardPanel, CloseRequestButton,
} from "./panels";

export const dynamic = "force-dynamic";

/** Les natures de pièce qu'on joint à une demande de recrutement. */
const DOC_CATEGORIES = ["REQUEST_LETTER", "SUPPORTING_DOC", "OTHER"];

const APPROVAL_ICON = {
  APPROVED: <CheckCircle2 className="h-4 w-4 text-success" />,
  REJECTED: <XCircle className="h-4 w-4 text-destructive" />,
  PENDING: <CircleDashed className="h-4 w-4 text-warning" />,
  SKIPPED: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
} as const;

const APPROVAL_TEXT = {
  APPROVED: "a validé",
  REJECTED: "a refusé",
  PENDING: "n'a pas encore tranché",
  // Ne PAS écrire « a validé » : la direction a tranché par-dessus, ce maillon n'a rien vu.
  SKIPPED: "n'a pas été consulté (décision prise plus haut)",
} as const;

/**
 * LE DOSSIER D'UN RECRUTEMENT — le besoin, son parcours, et les candidats.
 *
 * Un seul écran pour tout le circuit, parce que c'est une seule affaire : le directeur y suit sa
 * demande, chaque validateur y voit ce qu'ont dit les précédents, les RH y instruisent, et les
 * candidats y avancent. Éclater cela en quatre écrans aurait obligé chacun à savoir lequel
 * ouvrir — et personne n'aurait su où en était le poste sans le demander.
 *
 * Ce qui s'AFFICHE dépend de la place de chacun : les capacités sont calculées une fois, ici,
 * par le même `abilities()` que le serveur revérifie ensuite.
 */
export default async function RecruitmentPage({ params }: { params: { id: string } }) {
  const user = await requireModule("RECRUITMENT");
  const viewer = await recruitmentViewer(user, params.id);
  if (!viewer) notFound();

  const req = await prisma.recruitmentRequest.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { name: true } },
      department: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
      approvals: {
        orderBy: { order: "asc" },
        include: { approver: { select: { name: true } } },
      },
      infoRequests: {
        orderBy: { createdAt: "asc" },
        include: { askedBy: { select: { name: true } }, answeredBy: { select: { name: true } } },
      },
      candidates: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!req) notFound();

  const stage = req.stage as RecruitmentStage;
  const contract = req.contractType as RecruitmentContract;
  const steps: ChainStep[] = req.approvals.map((a) => ({
    order: a.order, approverId: a.approverId, approverName: a.approver?.name ?? "—", status: a.status,
  }));
  const untouched = steps.every((s) => s.status === "PENDING");
  const hired = req.candidates.find((c) => c.status === "HIRED");
  const can = abilities(stage, viewer, { chainUntouched: untouched, hasHire: Boolean(hired) });
  const active = currentStep(steps);
  const progress = chainProgress(steps);
  const myTurn = stage === "CHAIN" && (active?.approverId === user.id || viewer.isTop);

  const [documents, cvs] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "RECRUITMENT_REQUEST", entityId: req.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { entityType: "RECRUITMENT_CANDIDATE", entityId: { in: req.candidates.map((c) => c.id) } },
      select: { id: true, name: true, entityId: true, fileKey: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const cvByCandidate = new Map<string, { id: string; name: string }[]>();
  for (const d of cvs) {
    cvByCandidate.set(d.entityId, [...(cvByCandidate.get(d.entityId) ?? []), { id: d.id, name: d.name }]);
  }

  const docItems: DocItem[] = documents.map((d) => ({
    id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
  }));

  const canUpload = userCan(user, "RECRUITMENT", "UPLOAD") && !["CLOSED", "REJECTED", "CANCELLED"].includes(stage);
  const salary = salaryRange(
    req.salaryMin != null ? Number(req.salaryMin) : null,
    req.salaryMax != null ? Number(req.salaryMax) : null,
  );
  // L'ordre du pipeline, pas l'ordre d'arrivée : on regarde d'abord ceux qui avancent.
  const candidates = [...req.candidates].sort(
    (a, b) => candidateRank(b.status as CandidateStatus) - candidateRank(a.status as CandidateStatus)
      || a.fullName.localeCompare(b.fullName),
  );

  return (
    <div className="space-y-5">
      <BackLink href="/recrutement">
        <ArrowLeft className="h-4 w-4" /> Retour au recrutement
      </BackLink>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STAGE_TONE[stage]} dot={false}>{STAGE_LABEL[stage]}</Badge>
            <span className="font-mono text-xs text-muted-foreground">{req.reference}</span>
            {req.company && (
              <span className="text-xs text-muted-foreground">{req.company.shortName || req.company.name}</span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{req.position}</h1>
          <p className="text-sm text-muted-foreground">
            Demandé par {req.requester?.name ?? "—"} le {formatDate(req.createdAt)}
            {req.department ? ` · ${req.department.name}` : ""}
          </p>
        </div>
        {can.cancel && <CancelRequestButton id={req.id} />}
      </div>

      {myTurn && active && (
        <ChainDecisionPanel
          id={req.id}
          stepLabel={
            active.approverId === user.id
              ? `Marche ${active.order} sur ${progress.total}.`
              : `Marche ${active.order} sur ${progress.total} — normalement ${active.approverName}. Vous pouvez trancher d'en haut ; les marches non consultées seront marquées comme telles.`
          }
        />
      )}

      {(can.askInfo || can.openSourcing || can.hrReject) && (
        <HrPanel id={req.id} canAsk={can.askInfo} canOpen={can.openSourcing} canReject={can.hrReject} />
      )}

      {can.onboard && hired && (
        <OnboardPanel id={req.id} hiredName={hired.fullName} external={!needsOnboarding(contract)} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Le besoin</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Info label="Type de contrat" value={CONTRACT_LABEL[contract] ?? req.contractType} />
              <Info label="Nombre de postes" value={String(req.headcount)} />
              <Info label="Rémunération" value={salary} />
              <Info label="Prise de poste" value={req.startDate ? formatDate(req.startDate) : null} />
              <Info label="Fin de contrat" value={req.endDate ? formatDate(req.endDate) : null} />
              <Info label="Direction" value={req.department?.name} />
              {req.missions && <Block label="Missions" value={req.missions} />}
              {req.skills && <Block label="Compétences attendues" value={req.skills} />}
              {req.justification && <Block label="Pourquoi ce recrutement" value={req.justification} />}
              {req.closingNote && <Block label="Décision" value={req.closingNote} />}
            </CardContent>
          </Card>

          {/* LES PRÉCISIONS — le va-et-vient RH ↔ demandeur, question par question. C'est le cœur
              du travail RH, pas une exception : il est donc historisé et relisible. */}
          {(req.infoRequests.length > 0 || can.answerInfo) && (
            <Card>
              <CardHeader><CardTitle>Précisions demandées par les RH</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {req.infoRequests.length === 0 && (
                  <p className="text-muted-foreground">Aucune précision demandée.</p>
                )}
                {req.infoRequests.map((q) => (
                  <div key={q.id} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {q.askedBy?.name ?? "RH"} · {formatDateTime(q.createdAt)}
                    </p>
                    <p className="mt-0.5 font-medium">{q.question}</p>
                    {q.answer ? (
                      <p className="mt-2 border-l-2 border-success/50 pl-2 text-muted-foreground">
                        <span className="text-foreground">{q.answer}</span>
                        <span className="block text-xs">
                          {q.answeredBy?.name ?? "—"} · {q.answeredAt ? formatDateTime(q.answeredAt) : ""}
                        </span>
                      </p>
                    ) : can.answerInfo ? (
                      <AnswerInfoForm id={req.id} infoId={q.id} />
                    ) : (
                      <p className="mt-1 text-xs text-warning">En attente de la réponse du demandeur.</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* LES CV REÇUS — le pipeline vit sur les PERSONNES : plusieurs candidats avancent en
              parallèle, à des vitesses différentes. */}
          {(stage === "SOURCING" || stage === "ONBOARDING" || candidates.length > 0) && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle>CV reçus <span className="text-sm font-normal text-muted-foreground">({candidates.length})</span></CardTitle>
                {can.addCandidate && <AddCandidateButton requestId={req.id} />}
              </CardHeader>
              <CardContent className="space-y-2">
                {candidates.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    Aucun CV déposé. Les RH les déposent ici ; c&apos;est ensuite le demandeur qui présélectionne.
                  </p>
                ) : candidates.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{c.fullName}</p>
                        <Badge tone={CANDIDATE_TONE[c.status as CandidateStatus]} dot={false}>
                          {CANDIDATE_LABEL[c.status as CandidateStatus]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[c.email, c.phone, c.source].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
                      {c.interviewAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Entretien le {formatDate(c.interviewAt)}{c.interviewNote ? ` — ${c.interviewNote}` : ""}
                        </p>
                      )}
                      {(cvByCandidate.get(c.id) ?? []).map((d) => (
                        <a
                          key={d.id} href={`/api/documents/${d.id}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Paperclip className="h-3 w-3" /> {d.name}
                        </a>
                      ))}
                    </div>
                    <CandidateActions
                      candidateId={c.id}
                      status={c.status}
                      can={{ shortlist: can.shortlist, select: can.select, interview: can.interview, hire: can.hire }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Fiche de poste et pièces
                <span className="text-sm font-normal text-muted-foreground">({documents.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canUpload && (
                <DocumentUpload entityType="RECRUITMENT_REQUEST" entityId={req.id} categories={DOC_CATEGORIES} />
              )}
              <DocumentList
                documents={docItems} canDelete={viewer.isHr || viewer.isTop}
                canEdit={viewer.isHr || viewer.isTop} canRename={viewer.isHr || viewer.isTop}
                path={`/recrutement/${req.id}`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>
                Validation hiérarchique{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {progress.done} / {progress.total}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {req.approvals.map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{APPROVAL_ICON[a.status]}</span>
                  <div className="min-w-0">
                    <p className="font-medium">{a.approver?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {APPROVAL_TEXT[a.status]}
                      {a.decidedAt ? ` · ${formatDate(a.decidedAt)}` : ""}
                    </p>
                    {a.reason && <p className="text-xs text-muted-foreground">« {a.reason} »</p>}
                  </div>
                </div>
              ))}
              {req.approvals.length === 0 && (
                <p className="text-muted-foreground">Aucun validateur — l&apos;organigramme est incomplet.</p>
              )}
            </CardContent>
          </Card>

          {(viewer.isHr || viewer.isTop) && (stage === "SOURCING" || stage === "ONBOARDING") && (
            <CloseRequestButton id={req.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 sm:col-span-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  );
}
