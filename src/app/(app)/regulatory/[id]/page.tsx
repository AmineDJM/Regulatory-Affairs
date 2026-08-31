import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, isRegulatorySupervisor } from "@/lib/rbac";
import { effectiveStage } from "@/lib/regulatory/manufacturing-stage";
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
import { ProductDriveExplorer } from "@/components/documents/product-drive-explorer";
import { REG_DRIVE_ROOT } from "@/lib/regulatory-drive-mirror";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { RegulatoryProcess } from "./anpp-process";
import { regProgress, regChecklistProgress, type RegWorkflowState, type RegChecklistState } from "@/lib/regulatory-workflow";
import { StatusEditor } from "./status-editor";
import { DossierMenu } from "./dossier-menu";
import { deriveStatus, explainStatus } from "@/lib/regulatory/process-status";
import { EditProductButton } from "../edit-product";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { BvRequests, type BvItem } from "./bv-requests";
import { toNumber } from "@/lib/utils";
import { CustomFieldsCard } from "@/components/shared/custom-fields-card";
import { getFieldDefs } from "@/lib/custom-fields";
import { suggestedExternalStatus } from "@/lib/regulatory-external";
import { PRIORITY, REGULATORY_STATUS, MANUFACTURING_STATUS, REGULATORY_CATEGORY, PRODUCT_CHANNEL, PHARMA_FORM, DOSAGE_UNIT } from "@/lib/labels";
import { canSetStructural } from "@/lib/regulatory/structural-fields";
import { VariationPanel } from "./variation-panel";
import { SupervisionControls } from "./supervision-controls";
import { formatDate, formatDateTime } from "@/lib/utils";
import { SupplierViewCard } from "./supplier-view-card";
import { DossierUploadButton } from "./upload-button";
import { type TimelineStepView } from "./dossier-timeline";
import { orderSteps, type DossierStepKind } from "@/lib/regulatory/dossier-timeline";
import { getMyCompanies } from "@/lib/company";
import { loadProductMarkets } from "@/lib/queries/market-360";
import { ProductMarkets } from "./product-markets";

const REG_DOC_CATEGORIES = [
  "CTD_FULL", "MODULE_1", "MODULE_2", "MODULE_3", "MODULE_4", "MODULE_5",
  "GMP_CERTIFICATE", "CPP", "ORIGIN_AMM", "SUBMISSION_LETTER", "BV_RECEIPT",
  "REGISTRATION_DECISION", "OTHER",
];

// Documents liés aux réserves de l'ANPP (réserves reçues + réponses du laboratoire).
const REG_RESERVE_CATEGORIES = ["QUERY_RECEIVED", "QUERY_RESPONSE"];

export default async function RegulatoryDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { dossier?: string } }) {
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
      // LA FRISE du dossier : CTD initial → réserves → réponses → versions → décision.
      dossierSteps: { orderBy: { order: "asc" }, include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!product) notFound();

  // Niveau de process QUI FAIT FOI : une variation obtenue prime toujours sur le niveau
  // déclaré sur la fiche (voir `lib/regulatory/manufacturing-stage.ts`).
  const stage = effectiveStage(product.manufacturingStatus, product.variations);

  const canUpdate = userCan(user, "REGULATORY", "UPDATE");
  const canUpload = userCan(user, "REGULATORY", "UPLOAD");
  const canDelete = userCan(user, "REGULATORY", "DELETE");
  // Supervision (Super Admin + rôles configurés) : dates cibles + demande de MàJ de statut.
  const canSupervise = isRegulatorySupervisor(user, (await getAppSettings()).regulatorySupervisorRoles);

  const [documents, comments, fieldDefs, suppliers, bvOrders, users, companies] = await Promise.all([
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
    // L'entité du dossier est modifiable : elle détermine qui le voit.
    getMyCompanies(user.id),
  ]);

  // LES MARCHÉS DU PRODUIT (§30) : la vue inverse de la fiche marché, servie par la MÊME
  // requête que /pch/[id]. Rien à montrer tant que le produit canonique n'a croisé aucun AO.
  const marches = product.productId ? await loadProductMarkets(product.productId) : [];

  // La carte « Dossiers & fichiers » n'apparaît que si le dossier Drive du produit EXISTE —
  // même résolution que l'explorateur (il naît au premier dépôt).
  const productDriveRoot = await prisma.driveNode.findFirst({
    where: { type: "FOLDER", name: `${product.reference} — ${product.dci}`.trim(), isTrashed: false, parent: { name: REG_DRIVE_ROOT } },
    select: { id: true },
  });

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
  // LE NIVEAU DE PROCESS SE LIT dans les étapes — il ne se choisit plus (voir
  // `lib/regulatory/process-status.ts`). Ce que la fiche PORTE peut encore être en retard
  // d'un instant sur ce que le processus dit : on affiche la valeur déduite, qui fait foi.
  const derived = deriveStatus(workflow, product.status);

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
  // Les pièces rattachées à une étape (ANPP ou frise du dossier) vivent SOUS leur étape, pas
  // dans la liste générale : c'est tout l'intérêt de les y avoir rattachées.
  const stepDocs: Record<string, DocItem[]> = {};
  for (const d of documents) if (d.stepKey) (stepDocs[d.stepKey] ??= []).push(toDocItem(d));
  const nonStep = documents.filter((d) => !d.stepKey);
  // On sépare ensuite les pièces des réserves (section dédiée) du reste des documents.
  const reserveDocs = nonStep.filter((d) => REG_RESERVE_CATEGORIES.includes(d.category)).map(toDocItem);
  const docItems = nonStep.filter((d) => !REG_RESERVE_CATEGORIES.includes(d.category)).map(toDocItem);

  // La frise, dans son ORDRE — et chaque étape avec les pièces qui lui sont rattachées.
  const timeline: TimelineStepView[] = orderSteps(product.dossierSteps).map((s) => ({
    id: s.id,
    kind: s.kind as DossierStepKind,
    label: s.label,
    version: s.version,
    order: s.order,
    occurredAt: s.occurredAt?.toISOString() ?? null,
    note: s.note,
    author: s.createdBy?.name ?? null,
    createdAt: s.createdAt.toISOString(),
    docs: stepDocs[s.id] ?? [],
  }));

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
                canSetStructural={canSetStructural(user)}
                companies={companies}
                product={{
                  id: product.id,
                  companyId: product.companyId,
                  molecules: molecules.length ? molecules : [product.dci],
                  brandName: product.brandName,
                  dosage: product.dosage,
                  dosageUnit: product.dosageUnit,
                  pharmaceuticalForm: product.pharmaceuticalForm,
                  packaging: product.packaging,
                  therapeuticClass: product.therapeuticClass,
                  partnerLab: product.partnerLab,
                  supplierId: product.supplierId,
                  countryOfOrigin: product.countryOfOrigin,
                  category: product.category,
                  channel: product.channel,
                  manufacturingStatus: stage.status,
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
              <StatusEditor id={product.id} status={derived.status} statusHint={explainStatus(derived)} priority={product.priority} />
            </div>
          ) : (
            <StatusBadge map={REGULATORY_STATUS} value={derived.status} />
          )}
          {/* LE DÉPÔT EST EN TÊTE : poser le CTD initial est le geste le plus fréquent du
              module, il ne doit pas se chercher au fond de la colonne de droite. */}
          <div className="flex items-center gap-2">
            {canUpload && <DossierUploadButton productId={product.id} categories={REG_DOC_CATEGORIES} />}
            {/* LES RÉGLAGES DU DOSSIER derrière « ⋯ » : les participants ne méritaient pas une
                carte entière dans la colonne qu'on lit tous les jours. */}
            <DossierMenu
              productId={product.id}
              participants={product.assignedUsers}
              allUsers={users.map((u) => ({ id: u.id, name: u.name }))}
              coreIds={[product.responsibleId, product.assistantId].filter((x): x is string => Boolean(x))}
              canEdit={canUpdate}
            />
          </div>
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
              <Info label="Conditionnement" value={product.packaging} />
              <Info label="Classe thérapeutique" value={product.therapeuticClass} />
              {/* « Statut » (vocabulaire métier) = niveau industriel QUI FAIT FOI : une variation
                  obtenue prime sur la déclaration de la fiche. On dit d'où vient la valeur. */}
              <Info
                label="Statut"
                value={`${MANUFACTURING_STATUS[stage.status] ?? stage.status}${stage.source === "VARIATION" ? " — acté par variation obtenue" : " — déclaré"}${stage.pendingTo ? ` · ${MANUFACTURING_STATUS[stage.pendingTo] ?? stage.pendingTo} en cours` : ""}`}
              />
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
            <CardHeader><CardTitle>Variations de fabrication</CardTitle></CardHeader>
            <CardContent>
              <VariationPanel
                productId={product.id}
                currentStatus={stage.status}
                variations={product.variations}
                canEdit={canUpdate}
              />
            </CardContent>
          </Card>

          {/* La carte n'existe que s'il y a des champs DÉFINIS : un état vide permanent
              (« un administrateur peut en ajouter… ») n'apprend rien à celui qui lit la fiche. */}
          {fieldDefs.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Champs personnalisés</CardTitle></CardHeader>
              <CardContent>
                <CustomFieldsCard
                  entityType="REGULATORY_PRODUCT"
                  entityId={product.id}
                  defs={fieldDefs.map((d) => ({ id: d.id, key: d.key, label: d.label, type: d.type, options: d.options, required: d.required }))}
                  values={(product.custom as Record<string, unknown>) ?? {}}
                  canEdit={canUpdate}
                />
              </CardContent>
            </Card>
          )}

          {/* LE DOSSIER EST UNE FRISE VERTICALE — une seule, celle du processus réel.
              La check-list de présoumission, la demande de BV et les allers-retours avec
              l'ANPP y sont DANS l'étape à laquelle ils appartiennent : on ne quitte plus le
              parcours pour faire ce que le parcours demande. */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Processus d'enregistrement ANPP</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone={clProgress.pct === 100 ? "success" : "neutral"} dot={false}>{clProgress.checked}/{clProgress.total} documents</Badge>
                <Badge tone={wfProgress.pct === 100 ? "success" : "info"} dot={false}>{wfProgress.done}/{wfProgress.total} étapes</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <RegulatoryProcess
                productId={product.id}
                reference={product.reference}
                workflow={workflow}
                checklist={checklist}
                canUpdate={canUpdate}
                canUpload={canUpload}
                canDelete={canDelete}
                stepDocs={stepDocs}
                dossierSteps={timeline}
                path={`/regulatory/${product.id}`}
              />

              {/* LES PIÈCES D'AVANT LA FRISE. Les réserves déposées quand la section était une
                  simple pile existent toujours : les masquer les ferait « disparaître » pour
                  ceux qui les ont déposées. Elles se rattachent à une étape en les redéposant
                  au bon endroit. */}
              {reserveDocs.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs font-medium">
                    Pièces de réserves déposées avant la frise ({reserveDocs.length})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Elles ne sont rattachées à aucune étape. Redéposez-les depuis l&apos;étape
                    concernée pour qu&apos;elles rejoignent l&apos;histoire du dossier.
                  </p>
                  <DocumentList
                    documents={reserveDocs}
                    canDelete={canDelete || canUpload}
                    canRename={canUpload}
                    canEdit={onlyofficeConfigured() && canUpload}
                    path={`/regulatory/${product.id}`}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {marches.length > 0 && <ProductMarkets rows={marches} />}

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

          {/* LES DOSSIERS DU PRODUIT, sur place. Un ZIP décompressé ou une arborescence déposée
              vivaient dans le Drive et n'étaient plus atteignables depuis ici : il fallait quitter
              Regulatory pour les retrouver. C'est le MÊME explorateur que le Drive — pas une
              seconde liste qui finirait par diverger. La carte n'apparaît qu'une fois le dossier
              Drive né (premier dépôt) : vide, elle n'était qu'un encombrement. */}
          {productDriveRoot && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Dossiers &amp; fichiers</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductDriveExplorer
                  user={user}
                  productName={`${product.reference} — ${product.dci}`.trim()}
                  folderId={searchParams.dossier ?? null}
                  basePath={`/regulatory/${product.id}`}
                  canEdit={canUpload}
                />
              </CardContent>
            </Card>
          )}

          {/* Les BV existants, s'il y en a — la DEMANDE, elle, se fait depuis l'étape
              « Demande du BV » du processus, pas depuis cette carte. */}
          {bvItems.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Bons de versement (BV)</CardTitle>
                <Badge tone="neutral">{bvItems.length}</Badge>
              </CardHeader>
              <CardContent>
                <BvRequests items={bvItems} />
              </CardContent>
            </Card>
          )}

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
                      <Avatar name={u.name} size="sm" className="h-4 w-4 text-[0.5rem]" />
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
