import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, isRegulatorySupervisor } from "@/lib/rbac";
import { getAppSettings } from "@/lib/settings";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { addRegulatoryComment } from "@/lib/actions/regulatory-actions";
import { updateComment, deleteComment } from "@/lib/actions/comment-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { CommentThread } from "@/components/shared/comment-thread";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { RegulatoryProcess, RegulatoryChecklist } from "./anpp-process";
import { regProgress, regChecklistProgress, type RegWorkflowState, type RegChecklistState } from "@/lib/regulatory-workflow";
import { StatusEditor } from "./status-editor";
import { EditProductButton } from "../edit-product";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { BvRequests, type BvItem } from "./bv-requests";
import { toNumber } from "@/lib/utils";
import { CustomFieldsCard } from "@/components/shared/custom-fields-card";
import { getFieldDefs } from "@/lib/custom-fields";
import { suggestedExternalStatus } from "@/lib/regulatory-external";
import { PRIORITY, REGULATORY_STATUS, MANUFACTURING_STATUS, REGULATORY_CATEGORY, PRODUCT_CHANNEL, PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import { VariationPanel } from "./variation-panel";
import { ParticipantsPanel } from "./participants-panel";
import { SupervisionControls } from "./supervision-controls";
import { formatDate, formatDateTime } from "@/lib/utils";
import { SupplierViewCard } from "./supplier-view-card";

const REG_DOC_CATEGORIES = [
  "CTD_FULL", "MODULE_1", "MODULE_2", "MODULE_3", "MODULE_4", "MODULE_5",
  "GMP_CERTIFICATE", "CPP", "ORIGIN_AMM", "SUBMISSION_LETTER", "BV_RECEIPT",
  "REGISTRATION_DECISION", "OTHER",
];

// Documents liés aux réserves de l'ANPP (réserves reçues + réponses du laboratoire).
const REG_RESERVE_CATEGORIES = ["QUERY_RECEIVED", "QUERY_RESPONSE"];

export default async function RegulatoryDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("REGULATORY");
  if (!(await canAccessEntity(user, "REGULATORY_PRODUCT", params.id, "VIEW"))) {
    notFound();
  }

  const product = await prisma.regulatoryProduct.findUnique({
    where: { id: params.id },
    include: {
      responsible: { select: { name: true } },
      assistant: { select: { name: true } },
      assignedUsers: { select: { id: true, name: true } },
      supplier: { select: { name: true } },
      steps: { orderBy: { order: "asc" } },
      variations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!product) notFound();

  const canUpdate = userCan(user, "REGULATORY", "UPDATE");
  const canUpload = userCan(user, "REGULATORY", "UPLOAD");
  const canDelete = userCan(user, "REGULATORY", "DELETE");
  // Supervision (Super Admin + rôles configurés) : dates cibles + demande de MàJ de statut.
  const canSupervise = isRegulatorySupervisor(user, (await getAppSettings()).regulatorySupervisorRoles);

  const [documents, comments, fieldDefs, suppliers, bvOrders, users] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "REGULATORY_PRODUCT", entityId: product.id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comment.findMany({
      where: { entityType: "REGULATORY_PRODUCT", entityId: product.id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getFieldDefs("REGULATORY_PRODUCT"),
    prisma.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.expenseOrder.findMany({
      where: { sourceType: "REGULATORY_PRODUCT", sourceId: product.id },
      select: { id: true, reference: true, label: true, amount: true, status: true, dueDate: true, paidDate: true },
      orderBy: { createdAt: "desc" },
    }),
    canUpdate
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string; role: string }[]),
  ]);

  const supplierViewValues = {
    supplierId: product.supplierId ?? "",
    portalVisible: product.portalVisible,
    externalStatus: product.externalStatus ?? "",
    externalComment: product.externalComment ?? "",
    externalNextStep: product.externalNextStep ?? "",
    externalActionExpected: product.externalActionExpected ?? "",
    externalDeadline: product.externalDeadline ? product.externalDeadline.toISOString().slice(0, 10) : "",
    externalNotify: product.externalNotify,
  };

  const workflow = (product.workflow as RegWorkflowState | null) ?? null;
  const checklist = (product.checklist as RegChecklistState | null) ?? null;
  const wfProgress = regProgress(workflow);
  const clProgress = regChecklistProgress(checklist);

  const toDocItem = (d: (typeof documents)[number]): DocItem => ({
    id: d.id,
    name: d.name,
    category: d.category,
    version: d.version,
    sizeBytes: d.sizeBytes,
    confidentiality: d.confidentiality,
    uploadedBy: d.uploadedBy?.name ?? null,
    createdAt: d.createdAt.toISOString(),
    hasFile: Boolean(d.fileKey),
  });
  // Les pièces rattachées à une étape ANPP vivent sous leur étape (pas dans la liste générale).
  const stepDocs: Record<string, DocItem[]> = {};
  for (const d of documents) if (d.stepKey) (stepDocs[d.stepKey] ??= []).push(toDocItem(d));
  const nonStep = documents.filter((d) => !d.stepKey);
  // On sépare ensuite les pièces des réserves (section dédiée) du reste des documents.
  const reserveDocs = nonStep.filter((d) => REG_RESERVE_CATEGORIES.includes(d.category)).map(toDocItem);
  const docItems = nonStep.filter((d) => !REG_RESERVE_CATEGORIES.includes(d.category)).map(toDocItem);

  const bvItems: BvItem[] = bvOrders.map((o) => ({
    id: o.id, reference: o.reference, label: o.label, amount: toNumber(o.amount),
    status: o.status, dueDate: o.dueDate?.toISOString() ?? null, paidDate: o.paidDate?.toISOString() ?? null,
  }));

  const doneSteps = product.steps.filter((s) => s.status === "DONE").length;

  // DCI : molécule unique ou association (double/triple…).
  const molecules = Array.isArray(product.molecules)
    ? (product.molecules as unknown[]).map((m) => String(m)).filter(Boolean)
    : [];
  const associationLabel =
    molecules.length === 2 ? "Association double" : molecules.length === 3 ? "Association triple" : molecules.length > 3 ? `Association (${molecules.length} molécules)` : null;

  // Dosage = valeur + unité (mg, g, UI…) ; Forme = libellé de la forme galénique.
  const dosageLabel = [product.dosage, product.dosageUnit ? DOSAGE_UNIT[product.dosageUnit] ?? product.dosageUnit : null]
    .filter(Boolean)
    .join(" ") || null;
  const formLabel = product.pharmaceuticalForm ? PHARMA_FORM[product.pharmaceuticalForm] ?? product.pharmaceuticalForm : null;

  return (
    <div className="space-y-5">
      <Link
        href="/regulatory"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{product.reference}</span>
            <StatusBadge map={REGULATORY_CATEGORY} value={product.category} dot={false} />
            <StatusBadge map={PRODUCT_CHANNEL} value={product.channel} dot={false} />
            <StatusBadge map={PRIORITY} value={product.priority} />
            {associationLabel && <Badge tone="info" dot={false}>{associationLabel}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.dci}</h1>
          {product.brandName && <p className="text-muted-foreground">{product.brandName}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {canUpdate ? (
            <div className="flex items-center gap-2">
              <EditProductButton
                product={{
                  id: product.id,
                  molecules: molecules.length ? molecules : [product.dci],
                  brandName: product.brandName,
                  dosage: product.dosage,
                  dosageUnit: product.dosageUnit,
                  pharmaceuticalForm: product.pharmaceuticalForm,
                  therapeuticClass: product.therapeuticClass,
                  partnerLab: product.partnerLab,
                  supplierId: product.supplierId,
                  countryOfOrigin: product.countryOfOrigin,
                  category: product.category,
                  channel: product.channel,
                  manufacturingStatus: product.manufacturingStatus,
                  status: product.status,
                  priority: product.priority,
                  responsibleId: product.responsibleId,
                  assistantId: product.assistantId,
                  targetDate: product.targetDate ? product.targetDate.toISOString().slice(0, 10) : null,
                  comments: product.comments,
                  deHolder: product.deHolder,
                  manufacturingVariation: product.manufacturingVariation,
                  manufacturer: product.manufacturer,
                  variationDate: product.variationDate ? product.variationDate.toISOString().slice(0, 10) : null,
                }}
                users={users}
                suppliers={suppliers}
              />
              <StatusEditor id={product.id} status={product.status} priority={product.priority} />
            </div>
          ) : (
            <StatusBadge map={REGULATORY_STATUS} value={product.status} />
          )}
          <SuperAdminDeleteButton kind="REGULATORY_PRODUCT" id={product.id} name={`${product.reference} — ${product.dci}`} enabled={user.role === "SUPER_ADMIN"} />
        </div>
      </div>

      {canSupervise && (
        <SupervisionControls
          id={product.id}
          targetSubmissionDate={product.targetSubmissionDate ? product.targetSubmissionDate.toISOString().slice(0, 10) : null}
          targetDate={product.targetDate ? product.targetDate.toISOString().slice(0, 10) : null}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informations du dossier</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {molecules.length > 1 && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Molécules de l'association</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {molecules.map((m, i) => (
                      <span key={i} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">{m}</span>
                    ))}
                  </div>
                </div>
              )}
              <Info label="Dosage" value={dosageLabel} />
              <Info label="Forme" value={formLabel} />
              <Info label="Classe thérapeutique" value={product.therapeuticClass} />
              <Info label="Statut de fabrication" value={MANUFACTURING_STATUS[product.manufacturingStatus] ?? product.manufacturingStatus} />
              <Info label="Fournisseur" value={product.supplier?.name} />
              <Info label="Laboratoire partenaire" value={product.partnerLab} />
              <Info label="Pays d'origine" value={product.countryOfOrigin} />
              <Info label="Responsable" value={product.responsible?.name} />
              <Info label="Assistante" value={product.assistant?.name} />
              <Info label="Date cible" value={product.targetDate ? formatDate(product.targetDate) : null} />
              <Info label="Détenteur de DE" value={product.deHolder} />
              <Info label="Fabricant" value={product.manufacturer} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Participants</CardTitle></CardHeader>
            <CardContent>
              <ParticipantsPanel
                productId={product.id}
                participants={product.assignedUsers}
                allUsers={users.map((u) => ({ id: u.id, name: u.name }))}
                coreIds={[product.responsibleId, product.assistantId].filter((x): x is string => Boolean(x))}
                canEdit={canUpdate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Variations de fabrication</CardTitle></CardHeader>
            <CardContent>
              <VariationPanel
                productId={product.id}
                currentStatus={product.manufacturingStatus}
                variations={product.variations}
                canEdit={canUpdate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Champs personnalisés</CardTitle></CardHeader>
            <CardContent>
              <CustomFieldsCard
                entityType="REGULATORY_PRODUCT"
                entityId={product.id}
                defs={fieldDefs.map((d) => ({ id: d.id, key: d.key, label: d.label, type: d.type, options: d.options }))}
                values={(product.custom as Record<string, unknown>) ?? {}}
                canEdit={canUpdate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Processus d'enregistrement ANPP</CardTitle>
              <Badge tone={wfProgress.pct === 100 ? "success" : "info"} dot={false}>{wfProgress.done}/{wfProgress.total} étapes</Badge>
            </CardHeader>
            <CardContent>
              <RegulatoryProcess productId={product.id} workflow={workflow} canUpdate={canUpdate} canUpload={canUpload} canDelete={canDelete} stepDocs={stepDocs} path={`/regulatory/${product.id}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Checklist de présoumission</CardTitle>
              <Badge tone={clProgress.pct === 100 ? "success" : "neutral"} dot={false}>{clProgress.checked}/{clProgress.total} documents</Badge>
            </CardHeader>
            <CardContent>
              <RegulatoryChecklist productId={product.id} checklist={checklist} canUpdate={canUpdate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Réserves &amp; réponses (ANPP)</CardTitle>
              <Badge tone="neutral">{reserveDocs.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Déposez ici les <strong>réserves reçues de l'ANPP</strong> (PDF) et les <strong>réponses</strong> du laboratoire. Vous pouvez renommer ou supprimer une pièce en cas d'erreur.
              </p>
              {canUpload && (
                <DocumentUpload
                  entityType="REGULATORY_PRODUCT"
                  entityId={product.id}
                  categories={REG_RESERVE_CATEGORIES}
                />
              )}
              <DocumentList
                documents={reserveDocs}
                canDelete={canDelete || canUpload}
                canRename={canUpload}
                canEdit={onlyofficeConfigured() && canUpload}
                path={`/regulatory/${product.id}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commentaires</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                comments={comments.map((c) => ({
                  id: c.id,
                  author: c.author?.name ?? "Utilisateur",
                  authorId: c.authorId,
                  body: c.body,
                  createdAt: c.createdAt.toISOString(),
                  editedAt: c.editedAt?.toISOString() ?? null,
                }))}
                action={addRegulatoryComment}
                hiddenFields={{ productId: product.id }}
                currentUserId={user.id}
                canModerate={canUpdate}
                updateAction={updateComment}
                deleteAction={deleteComment}
                path={`/regulatory/${product.id}`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Documents</CardTitle>
              <Badge tone="neutral">{docItems.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {canUpload && (
                <>
                  <DocumentUpload
                    entityType="REGULATORY_PRODUCT"
                    entityId={product.id}
                    categories={REG_DOC_CATEGORIES}
                  />
                  {/* Tout document téléversé est automatiquement répliqué dans le Drive, sous le dossier du produit. */}
                  <p className="text-xs text-muted-foreground">Chaque document téléversé est automatiquement classé dans le Drive, sous le dossier du produit.</p>
                </>
              )}
              <DocumentList documents={docItems} canDelete={canDelete} canRename={canUpload} canEdit={onlyofficeConfigured() && canUpload} path={`/regulatory/${product.id}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Bons de versement (BV)</CardTitle>
              <Badge tone="neutral">{bvItems.length}</Badge>
            </CardHeader>
            <CardContent>
              <BvRequests productId={product.id} items={bvItems} canRequest={canUpdate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Vue fournisseur (portail)</CardTitle>
              {product.portalVisible && <Badge tone="success" dot={false}>Publié</Badge>}
            </CardHeader>
            <CardContent>
              <SupplierViewCard
                productId={product.id}
                suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                values={supplierViewValues}
                suggestedStatus={suggestedExternalStatus(product.status)}
                canUpdate={canUpdate}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Traçabilité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Créé le" value={formatDateTime(product.createdAt)} />
              <Info label="Modifié le" value={formatDateTime(product.updatedAt)} />
              <div>
                <p className="text-xs text-muted-foreground">Utilisateurs assignés</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {product.assignedUsers.length === 0 && <span className="text-muted-foreground">—</span>}
                  {product.assignedUsers.map((u) => (
                    <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      <Avatar name={u.name} size="sm" className="h-4 w-4 text-[8px]" />
                      {u.name}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
