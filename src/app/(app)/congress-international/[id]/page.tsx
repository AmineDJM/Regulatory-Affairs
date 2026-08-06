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
import { CongressDetailView } from "../congress-detail-view";
import { CarePanel } from "@/components/care/care-panel";
import { getCareDossier } from "@/lib/queries/care";
import { careDirectoryOptions, carePromoOptions } from "@/lib/actions/care-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CongressIntlDetailPage({ params }: { params: { id: string } }) {
  const user = await requireModule("CONGRESS_INTERNATIONAL");
  const detail = await getCongressDetail("INTL", user, params.id);
  if (!detail) notFound();

  // Impliquer une tierce personne : ouvert aux acteurs du circuit (National Sales,
  // chef de produit assigné, Direction) — le moteur pilote désormais la validation.
  const canInvolveThirdParty = hasGlobalView(user) || hasRole(user, "NATIONAL_SALES") || detail.productManagerId === user.id;
  // Le demandeur peut joindre des pièces à sa demande, même si son rôle n'a pas UPLOAD.
  const canUpload = userCan(user, "CONGRESS_INTERNATIONAL", "UPLOAD") || detail.requesterId === user.id;
  const canDelete = userCan(user, "CONGRESS_INTERNATIONAL", "DELETE") || hasGlobalView(user);
  const docs = await prisma.document.findMany({
    where: { entityType: "CONGRESS_INTERNATIONAL", entityId: detail.id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const docItems: DocItem[] = docs.map((dc) => ({
    id: dc.id, name: dc.name, category: dc.category, version: dc.version, sizeBytes: dc.sizeBytes,
    confidentiality: dc.confidentiality, uploadedBy: dc.uploadedBy?.name ?? null, createdAt: dc.createdAt.toISOString(), hasFile: Boolean(dc.fileKey),
  }));

  const [missions, canManageMissions, missionUsers, workflow] = await Promise.all([
    getEntityMissions("CONGRESS_INTERNATIONAL", detail.id),
    canAccessEntity(user, "CONGRESS_INTERNATIONAL", detail.id, "UPDATE"),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getWorkflowForEntity(user, "CONGRESS_INTERNATIONAL", detail.id, detail.requesterId),
  ]);

  // Le dossier de prise en charge : les personnes, ce qu'il faut pour chacune, et les devis.
  const canDecideCare = hasGlobalView(user) || userCan(user, "CONGRESS_INTERNATIONAL", "VALIDATE");
  const canEditCare = userCan(user, "CONGRESS_INTERNATIONAL", "CREATE") || userCan(user, "CONGRESS_INTERNATIONAL", "UPDATE") || canDecideCare;
  const [care, directory, carePromos, intl] = await Promise.all([
    getCareDossier("INTERNATIONAL", detail.id),
    careDirectoryOptions(),
    carePromoOptions(),
    prisma.congressInternational.findUnique({ where: { id: detail.id }, select: { requestStatus: true } }),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/congress-international" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Prises en charge Internationales
      </Link>
      <PageHeader title={detail.name} description="Demande de prise en charge — congrès international.">
        <StatusBadge map={CONGRESS_REQUEST_STATUS} value={detail.requestStatus} />
        <SuperAdminDeleteButton kind="CONGRESS_INTERNATIONAL" id={detail.id} name={detail.name} enabled={user.role === "SUPER_ADMIN"} />
      </PageHeader>
      {/* Les personnes prises en charge — le cœur de la demande. Avant le reste : c'est la
          question qu'on se pose en ouvrant l'écran. */}
      <Card>
        <CardHeader><CardTitle>Personnes prises en charge</CardTitle></CardHeader>
        <CardContent>
          <CarePanel
            scope="INTERNATIONAL"
            requestId={detail.id}
            beneficiaries={care.beneficiaries}
            quotes={care.quotes}
            directory={directory}
            eventApproved={["APPROVED", "COMPLETED"].includes(intl?.requestStatus ?? "")}
            canEdit={canEditCare}
            canDecide={canDecideCare}
            promoOptions={carePromos}
          />
        </CardContent>
      </Card>

      <CongressDetailView detail={detail} workflow={workflow} canInvolveThirdParty={canInvolveThirdParty} entityType="CONGRESS_INTERNATIONAL" entityId={detail.id} documents={docItems} canUpload={canUpload} canDelete={canDelete} path={`/congress-international/${detail.id}`} missions={missions} missionUsers={missionUsers} canManageMissions={canManageMissions} currentUserId={user.id} />
    </div>
  );
}
