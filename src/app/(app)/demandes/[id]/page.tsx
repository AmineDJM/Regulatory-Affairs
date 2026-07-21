import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, scopeAdminRequests } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { fieldLabels, REQUEST_TYPE_FIELDS } from "@/lib/admin-requests";
import { addRequestComment } from "@/lib/actions/admin-request-actions";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CommentThread, type CommentItem } from "@/components/shared/comment-thread";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { ADMIN_REQUEST_TYPE, ADMIN_REQUEST_STATUS, ADMIN_APPROVAL_STATUS, DRIVER_MISSION_STATUS, PRIORITY, AUDIT_ACTION, PROMO_MATERIAL_STATUS, VALIDATION_STATUS } from "@/lib/labels";
import { formatDate, formatDateTime, formatCurrency, toNumber, cn } from "@/lib/utils";
import { RequestActions } from "./request-actions";
import { RequesterWindow } from "./requester-window";
import { ApprovalButtons } from "../approval-buttons";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { ReminderButton } from "@/components/reminders/reminder-button";
import { PromoActionPanel } from "../../promo-material/[id]/promo-panels";

const REQ_DOC_CATEGORIES = ["QUOTE", "INVOICE", "REQUEST_LETTER", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"];
const PROMO_DOC_CATEGORIES = ["QUOTE", "PURCHASE_ORDER", "PAYMENT_SLIP", "PAYMENT_RECEIPT", "PROMO_MATERIAL_FILE", "AD_VISA", "INVOICE", "DELIVERY_NOTE", "SUPPORTING_DOC", "OTHER"];

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("ADMIN_REQUESTS");
  const req = await prisma.administrativeRequest.findFirst({
    where: { id: params.id, ...scopeAdminRequests(user) },
    include: {
      requester: { select: { name: true } },
      concerned: { select: { name: true } },
      assignedTo: { select: { name: true } },
      validator: { select: { name: true } },
      department: { select: { name: true } },
      approvals: { include: { validator: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      missions: { include: { assignedTo: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!req) notFound();

  // L'Assistante de Direction tient le bureau du secrétariat : elle gère et modère toute demande.
  const isSecretary = user.role === "DIRECTION_ASSISTANT";
  const canManage = hasGlobalView(user.role) || userCan(user, "ADMIN_REQUESTS", "UPDATE") || req.assignedToId === user.id || isSecretary;
  const canValidate = userCan(user, "ADMIN_REQUESTS", "VALIDATE") || hasGlobalView(user.role);
  const canUpload = userCan(user, "ADMIN_REQUESTS", "UPLOAD") || isSecretary;

  const [documents, comments, history, users, financeUsers, linkedValidations, siblings] = await Promise.all([
    prisma.document.findMany({ where: { entityType: "ADMIN_REQUEST", entityId: req.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.comment.findMany({ where: { entityType: "ADMIN_REQUEST", entityId: req.id }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ where: { entityType: "ADMIN_REQUEST", entityId: req.id }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }),
    canManage ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([] as { id: string; name: string }[]),
    canManage ? prisma.user.findMany({ where: { isActive: true, role: "FINANCE_BUDGET_MANAGER" }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([] as { id: string; name: string }[]),
    prisma.validationRequest.findMany({ where: { entityType: "ADMIN_REQUEST", entityId: req.id }, include: { steps: { include: { validator: { select: { name: true } } }, orderBy: { order: "asc" } } }, orderBy: { createdAt: "desc" } }),
    req.batchId ? prisma.administrativeRequest.findMany({ where: { batchId: req.batchId, deletedAt: null }, select: { id: true, reference: true, title: true, status: true, type: true }, orderBy: { createdAt: "asc" } }) : Promise.resolve([] as { id: string; reference: string; title: string; status: string; type: string }[]),
  ]);

  // Dossier Matériel promotionnel lié : l'assistante le pilote ici (sans accès au module).
  const promo = await prisma.promoMaterial.findFirst({ where: { adminRequestId: req.id } });
  const isPromoAssistant = hasGlobalView(user.role) || user.role === "DIRECTION_ASSISTANT";
  const promoDocs = promo
    ? await prisma.document.findMany({ where: { entityType: "PROMO_MATERIAL", entityId: promo.id }, include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } })
    : [];
  const promoDocItems: DocItem[] = promoDocs.map((d) => ({ id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes, confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null, createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey) }));
  const promoAmount = promo ? (promo.chosenAmount != null ? toNumber(promo.chosenAmount) : promo.amount != null ? toNumber(promo.amount) : null) : null;

  const labels = fieldLabels(req.type);
  const fields = (req.fields as Record<string, unknown> | null) ?? {};
  const fieldEntries = Object.entries(labels).filter(([k]) => fields[k] !== undefined && fields[k] !== "");
  const docItems: DocItem[] = documents.map((d) => ({ id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes, confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null, createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey) }));
  const commentItems: CommentItem[] = comments.map((c) => ({ id: c.id, author: c.author?.name ?? "Utilisateur", authorId: c.authorId, body: c.body, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null }));

  return (
    <div className="space-y-5">
      <Link href="/demandes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux demandes
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{req.reference}</span>
            <StatusBadge map={PRIORITY} value={req.priority} dot={false} />
            <Badge tone="neutral" dot={false}>{ADMIN_REQUEST_TYPE[req.type] ?? req.type}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{req.title}</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge map={ADMIN_REQUEST_STATUS} value={req.status} />
          <div className="flex items-center gap-2">
            <ReminderButton defaultTitle={`Demande ${req.reference} — ${req.title}`} link={`/demandes/${req.id}`} entityType="ADMIN_REQUEST" entityId={req.id} />
            <SuperAdminDeleteButton kind="ADMIN_REQUEST" id={req.id} name={`${req.reference} — ${req.title}`} enabled={user.role === "SUPER_ADMIN"} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Info label="Demandeur" value={req.requester?.name} />
              <Info label="Responsable" value={req.assignedTo?.name} />
              <Info label="Validateur" value={req.validator?.name} />
              <Info label="Personne concernée" value={req.concerned?.name} />
              <Info label="Département" value={req.department?.name} />
              <Info label="Échéance" value={req.deadline ? formatDate(req.deadline) : null} />
              {req.description && <div className="col-span-full"><p className="text-xs text-muted-foreground">Description</p><p className="font-medium">{req.description}</p></div>}
              {req.blockedReason && <div className="col-span-full"><p className="text-xs text-muted-foreground">Motif de blocage</p><p className="font-medium text-destructive">{req.blockedReason}</p></div>}
              {fieldEntries.length > 0 && (
                <div className="col-span-full grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-3">
                  {fieldEntries.map(([k, label]) => <Info key={k} label={label} value={String(fields[k])} />)}
                </div>
              )}
            </CardContent>
          </Card>

          {user.id === req.requesterId && req.status === "NEW" && !req.processingStartedAt && (
            <RequesterWindow
              requestId={req.id}
              createdAt={req.createdAt.toISOString()}
              values={{
                title: req.title,
                description: req.description,
                priority: req.priority,
                deadline: req.deadline ? req.deadline.toISOString().slice(0, 10) : null,
                fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v == null ? "" : String(v)])),
              }}
              typeFields={(REQUEST_TYPE_FIELDS[req.type] ?? []).map((f) => ({ type: f.type, name: f.name, label: f.label, full: f.full, options: "options" in f ? f.options : undefined }))}
            />
          )}

          {siblings.length > 1 && (
            <Card>
              <CardHeader><CardTitle>Demande groupée ({siblings.length} cellules)</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {siblings.map((s) => (
                  <Link key={s.id} href={`/demandes/${s.id}`} className={cn("flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-secondary", s.id === req.id && "bg-secondary font-medium")}>
                    <span className="min-w-0 truncate"><span className="font-mono text-xs text-muted-foreground">{s.reference}</span> — {s.title}</span>
                    <StatusBadge map={ADMIN_REQUEST_STATUS} value={s.status} dot={false} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {canManage && (
            <Card>
              <CardHeader><CardTitle>Traitement</CardTitle></CardHeader>
              <CardContent><RequestActions requestId={req.id} status={req.status} type={req.type} users={users} financeUsers={financeUsers} canManage={canManage} /></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle>Documents</CardTitle><Badge tone="neutral">{docItems.length}</Badge></CardHeader>
            <CardContent className="space-y-4">
              {canUpload && <DocumentUpload entityType="ADMIN_REQUEST" entityId={req.id} categories={REQ_DOC_CATEGORIES} />}
              <DocumentList documents={docItems} canDelete={canManage} canEdit={onlyofficeConfigured() && canUpload} path={`/demandes/${req.id}`} />
            </CardContent>
          </Card>

          {promo && (
            <Card className="border-primary/40">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Matériel promotionnel</CardTitle>
                <StatusBadge map={PROMO_MATERIAL_STATUS} value={promo.status} dot={false} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <Info label="Agence retenue" value={promo.chosenAgency} />
                  <Info label="Montant" value={promoAmount != null ? formatCurrency(promoAmount) : null} />
                  <Info label="N° bon de commande" value={promo.bcReference} />
                </div>
                {isPromoAssistant && (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Pièces du dossier (devis, bon de commande, facture…)</p>
                      <DocumentUpload entityType="PROMO_MATERIAL" entityId={promo.id} categories={PROMO_DOC_CATEGORIES} />
                      <DocumentList documents={promoDocItems} canDelete canEdit={onlyofficeConfigured()} path={`/demandes/${req.id}`} />
                    </div>
                    <PromoActionPanel
                      id={promo.id}
                      status={promo.status}
                      flags={{ isMarketing: false, isAssistant: true, isFinance: false, isMedicalInfo: false, isDirection: hasGlobalView(user.role) }}
                      chosenAgency={promo.chosenAgency}
                      bcReference={promo.bcReference}
                      visaReference={promo.visaReference}
                      authorityRef={promo.authorityRef}
                      amount={promoAmount}
                      reminderCount={promo.financeReminderCount}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Commentaires</CardTitle></CardHeader>
            <CardContent><CommentThread comments={commentItems} action={addRequestComment} hiddenFields={{ requestId: req.id }} currentUserId={user.id} canModerate={canManage} updateAction={updateComment} deleteAction={deleteComment} path={`/demandes/${req.id}`} /></CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Validations</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {req.approvals.length === 0 ? (
                <p className="text-muted-foreground">Aucune validation demandée.</p>
              ) : req.approvals.map((a) => (
                <div key={a.id} className="space-y-1 border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <StatusBadge map={ADMIN_APPROVAL_STATUS} value={a.status} dot={false} />
                    {a.amount && <span className="font-medium">{formatCurrency(toNumber(a.amount))}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Validateur : {a.validator?.name ?? "—"}</p>
                  {a.comment && <p className="text-xs">{a.comment}</p>}
                  {a.status === "PENDING" && (canValidate || a.validatorId === user.id) && <ApprovalButtons approvalId={a.id} />}
                </div>
              ))}
            </CardContent>
          </Card>

          {linkedValidations.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Validations (bureau central)</CardTitle>
                <Badge tone="neutral">{linkedValidations.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {linkedValidations.map((v) => (
                  <div key={v.id} className="space-y-1 border-b border-border pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{v.reference}</span>
                      <StatusBadge map={VALIDATION_STATUS} value={v.status} dot={false} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {v.module} · {v.steps.map((s) => s.validator?.name ?? "—").join(", ")}
                    </p>
                    {v.steps.some((s) => s.reason) && (
                      <p className="text-xs">{v.steps.filter((s) => s.reason).map((s) => s.reason).join(" — ")}</p>
                    )}
                  </div>
                ))}
                <Link href="/validations" className="text-xs text-primary hover:underline">Ouvrir le bureau des validations →</Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Missions chauffeur</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {req.missions.length === 0 ? (
                <p className="text-muted-foreground">Aucune mission.</p>
              ) : req.missions.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="min-w-0"><span className="block truncate font-medium">{m.title}</span><span className="text-xs text-muted-foreground">{m.assignedTo?.name ?? "Non assignée"}</span></span>
                  <StatusBadge map={DRIVER_MISSION_STATUS} value={m.status} dot={false} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Historique</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {history.length === 0 ? <p className="text-muted-foreground">—</p> : history.map((h) => (
                <div key={h.id} className="flex items-start justify-between gap-2">
                  <span><StatusBadge map={AUDIT_ACTION} value={h.action} dot={false} /> <span className="text-muted-foreground">{h.summary ?? h.field ?? ""}</span></span>
                  <span className="shrink-0 text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
