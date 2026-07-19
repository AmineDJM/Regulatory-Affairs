import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/session";
import { canSeeRegRequests, canCreateRegRequest, canAnswerRegRequests } from "@/lib/rbac";
import { listRegRequests, regRequestProductOptions } from "@/lib/queries/regulatory-requests";
import { createRegRequest } from "@/lib/actions/regulatory-request-actions";
import { getAppSettings } from "@/lib/settings";
import { REG_REQUEST_STATUS, REG_REQUEST_CATEGORY, PRIORITY } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";

export const dynamic = "force-dynamic";

export default async function RegulatoryRequestsPage() {
  const user = await requireUser();
  const { regRequestCreatorRoles } = await getAppSettings();
  if (!canSeeRegRequests(user, regRequestCreatorRoles)) notFound();
  const [items, products] = await Promise.all([listRegRequests(user), regRequestProductOptions()]);
  const canCreate = canCreateRegRequest(user, regRequestCreatorRoles);
  const isAnswerer = canAnswerRegRequests(user);

  const fields: FieldDef[] = [
    { type: "text", name: "subject", label: "Objet", required: true, full: true, placeholder: "Ex. Statut d'enregistrement Adventor 20mg" },
    { type: "select", name: "category", label: "Type", options: Object.entries(REG_REQUEST_CATEGORY).map(([value, label]) => ({ value, label })), defaultValue: "QUESTION" },
    { type: "select", name: "priority", label: "Priorité", options: Object.entries(PRIORITY).map(([value, v]) => ({ value, label: v.label })), defaultValue: "MEDIUM" },
    { type: "select", name: "productId", label: "Dossier produit (optionnel)", options: products.map((p) => ({ value: p.id, label: p.label })), placeholder: "— Aucun —", full: true },
    { type: "textarea", name: "body", label: "Votre demande", required: true, full: true, placeholder: "Décrivez précisément votre demande à l'équipe Regulatory…" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Demandes à Regulatory" description={isAnswerer ? "Demandes de l'information médicale (PRIM) adressées à l'équipe Regulatory." : "Adressez vos questions réglementaires à l'équipe Regulatory et suivez leurs réponses."}>
        {canCreate && (
          <CreateRecordButton label="Nouvelle demande" title="Nouvelle demande à Regulatory" description="Question réglementaire, document, statut d'enregistrement, variation…" fields={fields} action={createRegRequest} redirectBase="/regulatory/requests" />
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune demande pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Référence</th>
                    <th className="px-3 py-2 text-left font-medium">Objet</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Dossier</th>
                    {isAnswerer && <th className="px-3 py-2 text-left font-medium">Demandeur</th>}
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 text-center font-medium"><MessageSquare className="mx-auto h-3.5 w-3.5" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/20">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                        <Link href={`/regulatory/requests/${r.id}`} className="text-primary hover:underline">{r.reference}</Link>
                      </td>
                      <td className="px-3 py-2"><Link href={`/regulatory/requests/${r.id}`} className="hover:underline">{r.subject}</Link></td>
                      <td className="px-3 py-2 text-muted-foreground">{REG_REQUEST_CATEGORY[r.category] ?? r.category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.productName ?? "—"}</td>
                      {isAnswerer && <td className="px-3 py-2 text-muted-foreground">{r.requesterName ?? "—"}</td>}
                      <td className="px-3 py-2"><StatusBadge map={REG_REQUEST_STATUS} value={r.status} /></td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{r.messageCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
