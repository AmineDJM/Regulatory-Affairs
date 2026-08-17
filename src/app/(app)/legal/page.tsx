import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { optionsFromMap } from "@/components/shared/form-fields";
import { LEGAL_DOC_KIND } from "@/lib/labels";
import { toNumber } from "@/lib/utils";
import { createLegalDocument } from "@/lib/actions/legal-actions";
import { effectiveStatus, expiryLevel, daysLeft } from "@/lib/legal/lifecycle";
import { LegalTable, type LegalRow } from "./legal-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Legal — AMD Internal OS" };

/**
 * LEGAL — LES ENGAGEMENTS DE LA SOCIÉTÉ.
 *
 * Contrats, bons de commande, conventions, assurances, baux : tout ce qui engage l'entreprise et
 * qu'il faut pouvoir ressortir. Le FICHIER, lui, reste dans le Drive — Legal le référence et
 * ajoute ce que le Drive ne sait pas dire : le titre exact, les dates, l'échéance, la partie en
 * face, et ce qu'il est devenu (renouvelé, annulé).
 *
 * Un document peut n'avoir AUCUNE date : c'est un cas normal (statuts, tacite reconduction), pas
 * un oubli. Il ne se périme jamais et ne déclenche donc aucun rappel — la règle vit dans le
 * module pur `legal/lifecycle`, testé, partagé par l'écran et par le balayage des échéances.
 */
export default async function LegalPage() {
  const user = await requireModule("LEGAL");
  const canCreate = userCan(user, "LEGAL", "CREATE");
  const canEdit = userCan(user, "LEGAL", "UPDATE");

  const docs = await prisma.legalDocument.findMany({
    where: { ...currentCompanyWhere() },
    orderBy: [{ endDate: "asc" }, { createdAt: "desc" }],
    include: {
      driveNode: { select: { id: true, name: true } },
      renewedFrom: { select: { title: true } },
    },
  });

  const today = new Date();
  const rows: LegalRow[] = docs.map((d) => ({
    id: d.id,
    reference: d.reference,
    title: d.title,
    kind: d.kind,
    counterparty: d.counterparty,
    startDate: d.startDate?.toISOString() ?? null,
    endDate: d.endDate?.toISOString() ?? null,
    // Le statut AFFICHÉ tient compte du calendrier : un terme passé se voit sans qu'on ait
    // rouvert la fiche. On ne le réécrit pas en base à la lecture — ce serait une écriture furtive.
    status: effectiveStatus(d, today),
    expiry: expiryLevel(d, today),
    daysLeft: daysLeft(d, today),
    amount: d.amount !== null ? toNumber(d.amount) : null,
    driveNodeId: d.driveNode?.id ?? null,
    driveName: d.driveNode?.name ?? null,
    renewedFromTitle: d.renewedFrom?.title ?? null,
  }));

  const watch = rows.filter((r) => r.expiry === "SOON" || r.expiry === "IMMINENT").length;
  const overdue = rows.filter((r) => r.expiry === "OVERDUE").length;
  const purchaseOrders = rows.filter((r) => r.kind === "PURCHASE_ORDER").length;

  const fields: FieldDef[] = [
    { type: "text", name: "title", label: "Titre exact du document", required: true, full: true },
    { type: "text", name: "reference", label: "Référence / n°" },
    { type: "select", name: "kind", label: "Nature", options: optionsFromMap(LEGAL_DOC_KIND), defaultValue: "CONTRACT" },
    { type: "text", name: "counterparty", label: "Partie (fournisseur, client, prestataire)", full: true },
    { type: "date", name: "startDate", label: "Date de début (facultative)" },
    { type: "date", name: "endDate", label: "Date de fin — vide = sans échéance" },
    { type: "number", name: "amount", label: "Montant (DZD)" },
    { type: "textarea", name: "notes", label: "Notes", full: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Legal"
        description="Les engagements de la société : contrats, bons de commande, conventions, assurances, baux. Le fichier reste dans le Drive — Legal porte les dates, l'échéance et ce qu'il advient du document."
      >
        {canCreate && (
          <CreateRecordButton
            label="Nouveau document" title="Déclarer un document légal" width="lg"
            description="Un document peut n'avoir aucune date : laissez les dates vides, il ne se périmera jamais et ne déclenchera aucun rappel."
            action={createLegalDocument} fields={fields} redirectBase="/legal"
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Documents" value={rows.length} icon="Scale" />
        <KpiCard label="Échéance < 3 mois" value={watch} icon="AlarmClock" tone={watch > 0 ? "warning" : "default"} />
        <KpiCard label="Échéances dépassées" value={overdue} icon="AlertTriangle" tone={overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Bons de commande" value={purchaseOrders} icon="ClipboardList" tone="info" />
      </div>

      <LegalTable rows={rows} canEdit={canEdit} />
    </div>
  );
}
