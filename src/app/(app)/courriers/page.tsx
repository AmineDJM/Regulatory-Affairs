import { requireModule } from "@/lib/session";
import { userCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { currentCompanyWhereFor } from "@/lib/company";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { CreateRecordButton } from "@/components/shared/create-record-button";
import { createMailEntry } from "@/lib/actions/mail-register-actions";
import { mailFields } from "./mail-fields";
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
 *
 * Le tableau sert à RETROUVER ; c'est la fiche (`/courriers/<id>`) qui porte le travail : les
 * pièces jointes (scan du pli, accusé signé), la modification, et le journal qui garde qui a
 * corrigé quoi. Enregistrer un courrier ouvre donc directement sa fiche — on vient presque
 * toujours d'un scan à joindre.
 */
export default async function CourriersPage() {
  const user = await requireModule("MAIL_REGISTER");
  const canCreate = userCan(user, "MAIL_REGISTER", "CREATE");
  const canEdit = userCan(user, "MAIL_REGISTER", "UPDATE");

  const entries = await prisma.mailEntry.findMany({
    where: { ...await currentCompanyWhereFor(user.id) },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  // Le nombre de pièces jointes par courrier, en UNE requête : afficher « 0 » partout serait faux,
  // et interroger la table document par ligne mettrait 500 requêtes derrière un simple affichage.
  const attachments = await prisma.document.groupBy({
    by: ["entityId"],
    where: { entityType: "MAIL_ENTRY", entityId: { in: entries.map((m) => m.id) } },
    _count: { _all: true },
  });
  const attachmentCount = new Map(attachments.map((a) => [a.entityId, a._count._all]));

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
    attachments: attachmentCount.get(m.id) ?? 0,
  }));

  const incoming = rows.filter((r) => r.direction === "INCOMING").length;
  const outgoing = rows.filter((r) => r.direction === "OUTGOING").length;
  const noAck = rows.filter((r) => !r.acknowledgedAt).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Courriers"
        description="Le carnet des plis entrants et sortants : objet, parties, départ, arrivée et accusé de réception. Filtrable — on y cherche toujours une pièce précise. Chaque courrier ouvre sa fiche : pièces jointes, modification, journal."
      >
        {canCreate && (
          <CreateRecordButton
            label="Nouveau courrier" title="Enregistrer un courrier" width="lg"
            description="Seul l'objet est obligatoire : l'arrivée et l'accusé se posent plus tard, en un clic depuis le tableau."
            action={createMailEntry} fields={mailFields({}, "create")} redirectBase="/courriers"
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
