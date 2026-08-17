import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton, type FieldDef } from "@/components/shared/create-record-button";
import { createMailEntry } from "@/lib/actions/mail-register-actions";
import { MailTable, type MailRow } from "./mail-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Courriers — AMD Internal OS" };

/**
 * COURRIERS — le carnet des plis entrants et sortants.
 *
 * C'est le registre de l'assistante de direction : ce qui est parti, quand, par qui, et ce qui
 * est revenu signé. Le Super Admin en ouvre l'accès à qui il veut (module `MAIL_REGISTER`) —
 * beaucoup d'organisations veulent que la Direction le lise sans pouvoir l'écrire.
 *
 * Les quatre dates ne se remplissent pas au même moment : on POSTE (avec l'heure), le pli
 * ARRIVE, puis l'ACCUSÉ revient. Aucune n'est obligatoire — exiger une date qu'on n'a pas encore
 * ferait inventer une information.
 */
export default async function CourriersPage() {
  const user = await requireModule("MAIL_REGISTER");
  const canCreate = userCan(user, "MAIL_REGISTER", "CREATE");
  const canEdit = userCan(user, "MAIL_REGISTER", "UPDATE");

  const entries = await prisma.mailEntry.findMany({
    where: { ...currentCompanyWhere() },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const rows: MailRow[] = entries.map((m) => ({
    id: m.id,
    reference: m.reference,
    title: m.title,
    direction: m.direction,
    sender: m.sender,
    recipient: m.recipient,
    sentAt: m.sentAt?.toISOString() ?? null,
    receivedAt: m.receivedAt?.toISOString() ?? null,
    acknowledgedAt: m.acknowledgedAt?.toISOString() ?? null,
    carrier: m.carrier,
  }));

  const incoming = rows.filter((r) => r.direction === "INCOMING").length;
  const outgoing = rows.filter((r) => r.direction === "OUTGOING").length;
  const noAck = rows.filter((r) => !r.acknowledgedAt).length;

  const fields: FieldDef[] = [
    { type: "text", name: "title", label: "Objet du courrier", required: true, full: true },
    { type: "select", name: "direction", label: "Sens", options: [
      { value: "OUTGOING", label: "Sortant" }, { value: "INCOMING", label: "Entrant" },
    ], defaultValue: "OUTGOING" },
    { type: "text", name: "reference", label: "N° de chrono" },
    { type: "text", name: "sender", label: "Expéditeur" },
    { type: "text", name: "recipient", label: "Destinataire" },
    // Le départ porte l'HEURE : c'est ce qui départage deux plis du même jour.
    { type: "text", name: "sentAt", label: "Départ (date et heure)", placeholder: "2026-08-17T14:30" },
    { type: "date", name: "receivedAt", label: "Arrivée" },
    { type: "date", name: "acknowledgedAt", label: "Accusé de réception" },
    { type: "text", name: "carrier", label: "Porteur (poste, coursier, e-mail…)" },
    { type: "textarea", name: "notes", label: "Notes", full: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Courriers"
        description="Le carnet des plis entrants et sortants : objet, parties, départ, arrivée et accusé de réception. Filtrable — on y cherche toujours une pièce précise."
      >
        {canCreate && (
          <CreateRecordButton
            label="Nouveau courrier" title="Enregistrer un courrier" width="lg"
            description="Seul l'objet est obligatoire : l'arrivée et l'accusé se posent plus tard, en un clic depuis le tableau."
            action={createMailEntry} fields={fields}
          />
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Courriers" value={rows.length} icon="Mails" />
        <KpiCard label="Entrants" value={incoming} icon="Inbox" tone="info" />
        <KpiCard label="Sortants" value={outgoing} icon="Send" tone="info" />
        <KpiCard label="Sans accusé" value={noAck} icon="Hourglass" tone={noAck > 0 ? "warning" : "default"} />
      </div>

      <MailTable rows={rows} canEdit={canEdit} />
    </div>
  );
}
