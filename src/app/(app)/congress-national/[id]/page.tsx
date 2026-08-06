import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView, hasRole } from "@/lib/rbac";
import { canAccessEntity } from "@/lib/entity-access";
import { prisma } from "@/lib/prisma";
import { getCongressDetail } from "@/lib/queries/congress";
import { getEntityMissions } from "@/lib/queries/missions";
import { getWorkflowForEntity } from "@/lib/queries/workflow";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SuperAdminDeleteButton } from "@/components/shared/super-admin-delete";
import { type DocItem } from "@/components/documents/document-list";
import { CONGRESS_REQUEST_STATUS } from "@/lib/labels";
import { CongressDetailView } from "../../congress-international/congress-detail-view";
import { toNumber } from "@/lib/utils";
import { promoMaterialOptions } from "@/lib/actions/ad-pro-item-actions";
import { AdProItemsPanel, type ItemRow } from "@/components/ad-pro/items-panel";

export default async function CongressNatDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONGRESS_NATIONAL");
  const detail = await getCongressDetail("NATIONAL", user, params.id);
  if (!detail) notFound();

  // Impliquer une tierce personne : ouvert aux acteurs du circuit (le moteur pilote la validation).
  const canInvolveThirdParty = hasGlobalView(user) || hasRole(user, "NATIONAL_SALES") || detail.productManagerId === user.id;
  const canUpload = userCan(user, "CONGRESS_NATIONAL", "UPLOAD") || detail.requesterId === user.id;
  const canDelete = userCan(user, "CONGRESS_NATIONAL", "DELETE") || hasGlobalView(user);
  const docs = await prisma.document.findMany({
    where: { entityType: "CONGRESS_NATIONAL", entityId: detail.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = docs.map((dc) => ({
    id: dc.id, name: dc.name, category: dc.category, version: dc.version, sizeBytes: dc.sizeBytes,
    confidentiality: dc.confidentiality, uploadedBy: dc.uploadedBy?.name ?? null, createdAt: dc.createdAt.toISOString(), hasFile: Boolean(dc.fileKey),
  }));

  const [missions, canManageMissions, missionUsers, workflow] = await Promise.all([
    getEntityMissions("CONGRESS_NATIONAL", detail.id),
    canAccessEntity(user, "CONGRESS_NATIONAL", detail.id, "UPDATE"),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getWorkflowForEntity(user, "CONGRESS_NATIONAL", detail.id, detail.requesterId),
  ]);

  // Postes de l'événement : de quoi est fait le montant, et à qui va l'argent. Le stand et le
  // symposium n'étaient jusqu'ici que des drapeaux — annoncés, jamais chiffrés.
  const congress = await prisma.congressNational.findUnique({
    where: { id: detail.id },
    select: { finalAmount: true, requestStatus: true, hasBooth: true, hasSymposium: true },
  });
  const rawItems = await prisma.adProItem.findMany({
    where: { congressNationalId: detail.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  // `promoMaterialId` et `expenseOrderId` sont des scalaires (pas de relation Prisma) : on
  // résout les libellés en une requête chacun plutôt qu'une par poste.
  const [promoRows, orderRows, promoOptions] = await Promise.all([
    rawItems.some((i) => i.promoMaterialId)
      ? prisma.promoMaterial.findMany({
          where: { id: { in: rawItems.map((i) => i.promoMaterialId).filter((x): x is string => Boolean(x)) } },
          select: { id: true, reference: true, title: true, status: true },
        })
      : Promise.resolve([]),
    rawItems.some((i) => i.expenseOrderId)
      ? prisma.expenseOrder.findMany({
          where: { id: { in: rawItems.map((i) => i.expenseOrderId).filter((x): x is string => Boolean(x)) } },
          select: { id: true, reference: true, status: true },
        })
      : Promise.resolve([]),
    promoMaterialOptions(),
  ]);
  const promoById = new Map(promoRows.map((p) => [p.id, { reference: p.reference, title: p.title, status: String(p.status) }]));
  const orderById = new Map(orderRows.map((o) => [o.id, { reference: o.reference, status: String(o.status) }]));
  const items: ItemRow[] = rawItems.map((i) => ({
    id: i.id, kind: i.kind, label: i.label, notes: i.notes, supplier: i.supplier,
    amountEstimated: i.amountEstimated != null ? toNumber(i.amountEstimated) : null,
    amountGranted: i.amountGranted != null ? toNumber(i.amountGranted) : null,
    addedAfterDecision: i.addedAfterDecision,
    promoMaterialId: i.promoMaterialId,
    promoMaterial: i.promoMaterialId ? promoById.get(i.promoMaterialId) ?? null : null,
    expenseOrderId: i.expenseOrderId,
    expenseOrder: i.expenseOrderId ? orderById.get(i.expenseOrderId) ?? null : null,
  }));
  // L'enveloppe d'un congrès, c'est le montant accordé par la Direction à la décision définitive.
  const canAllocate = hasGlobalView(user) || userCan(user, "CONGRESS_NATIONAL", "VALIDATE");

  return (
    <div className="space-y-5">
      <Link href="/congress-national" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Événements nationaux
      </Link>
      <PageHeader title={detail.name} description="Demande de prise en charge — événement national.">
        <StatusBadge map={CONGRESS_REQUEST_STATUS} value={detail.requestStatus} />
        <SuperAdminDeleteButton kind="CONGRESS_NATIONAL" id={detail.id} name={detail.name} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>
      <CongressDetailView
        detail={detail} workflow={workflow} canInvolveThirdParty={canInvolveThirdParty}
        entityType="CONGRESS_NATIONAL" entityId={detail.id} documents={docItems}
        canUpload={canUpload} canDelete={canDelete} path={`/congress-national/${detail.id}`}
        missions={missions} missionUsers={missionUsers} canManageMissions={canManageMissions}
        currentUserId={user.id}
        itemsPanel={
          <AdProItemsPanel
            parent="CONGRESS_NATIONAL"
            parentId={detail.id}
            items={items}
            amountGranted={congress?.finalAmount != null ? toNumber(congress.finalAmount) : null}
            decided={["APPROVED", "COMPLETED"].includes(congress?.requestStatus ?? "")}
            canEdit={userCan(user, "CONGRESS_NATIONAL", "CREATE") || userCan(user, "CONGRESS_NATIONAL", "UPDATE") || canAllocate}
            canAllocate={canAllocate}
            promoOptions={promoOptions}
            plan={{ hasBooth: congress?.hasBooth, hasSymposium: congress?.hasSymposium }}
          />
        }
      />
    </div>
  );
}
