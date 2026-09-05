import type * as React from "react";
import type { EntityType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList, type DocItem } from "@/components/documents/document-list";
import { onlyofficeConfigured } from "@/lib/onlyoffice";
import { NATIONAL_EVENT_TYPE } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CongressDetail } from "@/lib/queries/congress";
import { WorkflowPanel } from "@/components/workflow/workflow-panel";
import type { WorkflowView } from "@/lib/queries/workflow";
import { BeneficiariesCard } from "./beneficiaries-card";
import { ThirdPartyInvolveButton } from "@/components/shared/third-party-involve";
import { InvolvementConversations } from "@/components/ad-pro/involvement-conversations";
import type { InvolvementThread } from "@/lib/queries/involvement";
import { MissionAssignmentsCard } from "@/components/missions/mission-assignments-card";
import type { MissionAssignmentDTO } from "@/lib/queries/missions";

const CONGRESS_DOC_CATEGORIES = ["REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER"];

export function CongressDetailView({
  detail, workflow, canInvolveThirdParty, entityType, entityId, documents, canUpload, canDelete, path,
  missions, missionUsers, canManageMissions, currentUserId, itemsPanel, involvementThreads = [], canModerate = false,
}: {
  detail: CongressDetail;
  workflow: WorkflowView | null;
  canInvolveThirdParty: boolean;
  entityType: EntityType;
  entityId: string;
  documents: DocItem[];
  canUpload: boolean;
  canDelete: boolean;
  path: string;
  missions: MissionAssignmentDTO[];
  missionUsers: { id: string; name: string }[];
  canManageMissions: boolean;
  currentUserId: string;
  /** Ventilation de l'enveloppe en postes — fournie par les écrans qui la portent (national).
      Un emplacement plutôt qu'un branchement en dur : la vue n'a pas à connaître les postes,
      et l'international ne change pas d'un pixel. */
  itemsPanel?: React.ReactNode;
  /** Conversations avec les tierces personnes impliquées — remontées SOUS la demande. */
  involvementThreads?: InvolvementThread[];
  canModerate?: boolean;
}) {
  const d = detail;

  return (
    <div className="space-y-5">
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {d.eventType && <Info label="Type" value={NATIONAL_EVENT_TYPE[d.eventType] ?? d.eventType} />}
            <Info label="Spécialité / thème" value={d.specialty} />
            <Info label="Lieu" value={d.location} />
            <Info label="Date" value={d.date ? formatDate(d.date) : null} />
            {d.endDate && <Info label="Date fin" value={formatDate(d.endDate)} />}
            <Info label="Demandeur" value={d.requester} />
          </CardContent>
        </Card>

        {/* Budgets */}
        <Card>
          <CardHeader><CardTitle>Budgets</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Budget label="Estimé par le demandeur" value={d.estimatedBudget} />
            <Budget label="Proposé par le chef de produit" value={d.productManagerBudget} tone="primary" />
          </CardContent>
        </Card>

        {itemsPanel && (
          <Card>
            <CardHeader><CardTitle>Ce que couvre cet événement</CardTitle></CardHeader>
            <CardContent>{itemsPanel}</CardContent>
          </Card>
        )}

        {/* Workflow configurable (piloté par le moteur — éditable dans Administration) */}
        <Card>
          <CardHeader><CardTitle>Circuit de validation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {workflow ? (
              <WorkflowPanel entityType={entityType} entityId={entityId} view={workflow} />
            ) : (
              <p className="text-sm text-muted-foreground">Circuit indisponible.</p>
            )}
            {canInvolveThirdParty && (
              <div className="border-t border-border pt-3">
                <ThirdPartyInvolveButton type={d.type} id={d.id} people={missionUsers} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents + personnes prises en charge + médecins + participants */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Documents</CardTitle><Badge tone="neutral" dot={false}>{documents.length}</Badge></CardHeader>
          <CardContent className="space-y-4">
            {canUpload && <DocumentUpload entityType={entityType} entityId={entityId} categories={CONGRESS_DOC_CATEGORIES} />}
            <DocumentList documents={documents} canDelete={canDelete} canRename={canUpload} canEdit={onlyofficeConfigured() && canUpload} path={path} />
          </CardContent>
        </Card>

        <BeneficiariesCard
          entityType={entityType}
          entityId={entityId}
          beneficiaries={d.beneficiaries}
          idDocCount={documents.filter((doc) => doc.category === "ID_DOCUMENT").length}
          canManage={canUpload}
        />
        <MissionAssignmentsCard
          entityType={entityType}
          entityId={entityId}
          assignments={missions}
          users={missionUsers}
          canManage={canManageMissions}
          currentUserId={currentUserId}
          path={path}
        />
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Médecins invités</CardTitle><Badge tone="neutral" dot={false}>{d.doctors.length}</Badge></CardHeader>
          <CardContent>
            {d.doctors.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> : (
              <ul className="space-y-2">
                {d.doctors.map((doc) => (
                  <li key={doc.id} className="text-sm">
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{[doc.specialty, doc.institution].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Participants Adventum</CardTitle><Badge tone="neutral" dot={false}>{d.participants.length}</Badge></CardHeader>
          <CardContent>
            {d.participants.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> : (
              <ul className="space-y-2">
                {d.participants.map((p) => (
                  <li key={p.id} className="text-sm"><span className="font-medium">{p.name}</span>{p.title && <span className="text-xs text-muted-foreground"> · {p.title}</span>}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    <InvolvementConversations threads={involvementThreads} currentUserId={currentUserId} canManage={canModerate} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}

function Budget({ label, value, tone }: { label: string; value: number | null; tone?: "primary" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "primary" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value !== null ? formatCurrency(value) : "—"}</p>
    </div>
  );
}

