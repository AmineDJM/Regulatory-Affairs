import Link from "next/link";
import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPromoMaterials } from "@/lib/queries/promo-material";
import { createPromoMaterial } from "@/lib/actions/promo-material-actions";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { ModuleTabs } from "@/components/shared/module-tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROMO_MATERIAL_STATUS, EVENTS_TABS } from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PromoMaterialPage() {
  const user = await requireModule("PROMO_MATERIAL");
  const canCreate = userCan(user, "PROMO_MATERIAL", "CREATE");
  const items = await getPromoMaterials(user);

  // Liste des assistantes possibles (pour assigner la demande) : réservée au créateur.
  const assistants = canCreate
    ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const createFields: FieldDef[] = [
    { type: "text", name: "title", label: "Campagne / matériel", required: true, full: true, placeholder: "Ex. Brochure Cardiomax 2026" },
    { type: "textarea", name: "description", label: "Brief / description", full: true },
    { type: "number", name: "amount", label: "Budget estimé (DZD)" },
    { type: "select", name: "assistantId", label: "Assistante de direction", options: assistants.map((a) => ({ value: a.id, label: a.name })), placeholder: "— À notifier (Direction) —" },
  ];

  const active = items.filter((i) => i.status !== "SETTLED" && i.status !== "CANCELLED").length;
  const settled = items.filter((i) => i.status === "SETTLED").length;

  return (
    <div className="space-y-5">
      <PageHeader title="Matériel promotionnel" description="Circuit complet : prospection d'agences → bon de commande → bordereau de paiement → conformité & visa publicitaire → impression → règlement.">
        {canCreate && (
          <CreateRecordButton label="Nouvelle demande" title="Demande de matériel promotionnel" description="Marketing — demande de prospection d'agences." width="md" action={createPromoMaterial} redirectBase="/promo-material" fields={createFields} />
        )}
      </PageHeader>

      <ModuleTabs tabs={EVENTS_TABS.map((t) => ({ label: t.label, href: t.href, show: userCan(user, t.module, "VIEW") }))} />

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Dossiers" value={items.length} icon="Megaphone" />
        <KpiCard label="En cours" value={active} icon="Loader" tone={active > 0 ? "info" : "default"} />
        <KpiCard label="Réglés" value={settled} icon="CheckCircle2" tone="success" />
      </div>

      {items.length === 0 ? (
        <EmptyState icon="Megaphone" title="Aucun dossier" description={canCreate ? "Créez une demande de prospection d'agences pour démarrer." : "Les dossiers de matériel promotionnel apparaîtront ici."} />
      ) : (
        <div className="surface overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead><TableHead>Campagne</TableHead><TableHead>Agence</TableHead>
                <TableHead className="text-right">Montant</TableHead><TableHead>Statut</TableHead><TableHead>Créé le</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs"><Link href={`/promo-material/${i.id}`} className="hover:underline">{i.reference}</Link></TableCell>
                  <TableCell className="font-medium"><Link href={`/promo-material/${i.id}`} className="hover:underline">{i.title}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{i.chosenAgency || "—"}</TableCell>
                  <TableCell className="text-right">{i.amount != null ? formatCurrency(i.amount) : "—"}</TableCell>
                  <TableCell><StatusBadge map={PROMO_MATERIAL_STATUS} value={i.status} dot={false} /></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
