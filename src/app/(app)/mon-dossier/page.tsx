import { requireUser } from "@/lib/session";
import { getMyHrDossier } from "@/lib/queries/hr-documents";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { HR_DOCUMENT_CATEGORY, HR_REQUEST_TYPE, HR_REQUEST_STATUS, CONTRACT_TYPE } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { NewRequestButton, CancelRequestButton } from "./request-controls";
import { HrRequestThread } from "@/components/shared/hr-request-thread";

export const dynamic = "force-dynamic";

export default async function MonDossierPage() {
  const user = await requireUser();
  const dossier = await getMyHrDossier(user.id);

  if (!dossier) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mon dossier RH" description="Vos documents RH et vos demandes (attestations, congés, missions, frais)." />
        <EmptyState icon="FileText" title="Aucun dossier RH lié à votre compte" description="Votre compte n'est pas encore rattaché à une fiche employé. Contactez les Ressources humaines." />
      </div>
    );
  }

  const e = dossier.employee;
  return (
    <div className="space-y-5">
      <PageHeader title="Mon dossier RH" description="Retrouvez vos documents RH et suivez vos demandes (attestations, titre de congé, ordre de mission, note de frais…)." />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Mes informations</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Info label="Nom" value={e.fullName} />
            <Info label="Poste" value={e.position} />
            <Info label="Département" value={e.department} />
            <Info label="Contrat" value={e.contractType ? CONTRACT_TYPE[e.contractType] : null} />
            <Info label="Date d'embauche" value={e.hireDate ? formatDate(e.hireDate) : null} />
            <Info label="N° CNAS" value={e.cnasNumber} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Mes documents RH ({dossier.documents.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {dossier.documents.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aucun document pour l'instant. Les RH y déposeront vos contrats, bulletins et attestations.</p>
            ) : (
              <ul className="divide-y divide-border">
                {dossier.documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {HR_DOCUMENT_CATEGORY[d.category]}{d.period ? ` · ${d.period}` : ""} · {formatDate(d.createdAt)}
                      </p>
                    </div>
                    <a href={`/api/rh/document/${d.id}?dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
                      <Download className="h-4 w-4" /> Télécharger
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Mes demandes RH</CardTitle>
          <NewRequestButton />
        </CardHeader>
        <CardContent className="p-0">
          {dossier.requests.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune demande. Cliquez sur « Nouvelle demande » pour une attestation (travail, CNAS, émoluments), un titre de congé, un ordre de mission ou une note de frais.</p>
          ) : (
            <ul className="divide-y divide-border">
              {dossier.requests.map((r) => (
                <li key={r.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{HR_REQUEST_TYPE[r.type]}</span>
                        <StatusBadge map={HR_REQUEST_STATUS} value={r.status} />
                      </div>
                      {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
                      {r.hrNote && <p className="text-xs text-muted-foreground">RH : {r.hrNote}</p>}
                      <p className="text-[11px] text-muted-foreground">Demandée le {formatDateTime(r.createdAt)}</p>
                    </div>
                    {r.fulfilmentDocId && (
                      <a href={`/api/rh/document/${r.fulfilmentDocId}?dl=1`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
                        <Download className="h-4 w-4" /> Document
                      </a>
                    )}
                    {r.status === "PENDING" && <CancelRequestButton id={r.id} />}
                  </div>
                  <HrRequestThread requestId={r.id} documents={r.documents} comments={r.comments} canManage={false} currentUserId={user.id} path="/mon-dossier" />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || "—"}</p></div>;
}
