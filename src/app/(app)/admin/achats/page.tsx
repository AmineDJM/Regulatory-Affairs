import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/kpi-card";
import { PURCHASE_JOURNAL_LABEL, type PurchaseJournalEvent } from "@/lib/general-means/purchase-journal";
import { PurchaseJournal, type JournalRow } from "./purchase-journal-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal des demandes d'achat — AMD Internal OS" };

/** On borne l'écran, pas le journal : les totaux plus haut portent sur TOUT. */
const LIMITE = 500;

/**
 * LE JOURNAL DES DEMANDES D'ACHAT AUX MOYENS GÉNÉRAUX — Super Admin uniquement.
 *
 * Chaque demande d'achat y est copiée ENTIÈREMENT, à chaque geste : dépôt, validation, refus,
 * retrait. On ajoute, on ne met jamais à jour — si bien qu'une demande retirée, ou supprimée de
 * la file, garde ici sa trace complète. C'est ce qui permet de répondre six mois plus tard à
 * « qui a demandé quoi, quand, à combien, et qui a dit oui ».
 *
 * Il est SÉPARÉ de la file des demandes : celle-ci sert à travailler, celui-ci à rendre compte.
 * Les mélanger aurait donné un écran où l'on décide et où l'on archive en même temps, et l'on
 * aurait fini par y supprimer des lignes pour « faire le ménage ».
 */
export default async function JournalAchatsPage() {
  const user = await requireModule("ADMIN");
  // Le journal nomme QUI a demandé quoi, dans toute la société : il ne s'ouvre qu'au Super Admin.
  if (user.role !== "SUPER_ADMIN") redirect("/admin");

  const [entries, total, depots] = await Promise.all([
    prisma.purchaseRequestLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: LIMITE }),
    prisma.purchaseRequestLogEntry.count(),
    prisma.purchaseRequestLogEntry.count({ where: { event: "SUBMITTED" } }),
  ]);

  const rows: JournalRow[] = entries.map((e) => ({
    id: e.id,
    requestId: e.requestId,
    reference: e.reference,
    event: e.event,
    eventLabel: PURCHASE_JOURNAL_LABEL[e.event as PurchaseJournalEvent] ?? e.event,
    title: e.title,
    requesterName: e.requesterName,
    actorName: e.actorName,
    departmentName: e.departmentName,
    estimatedTotal: e.estimatedTotal != null ? Number(e.estimatedTotal) : null,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    snapshot: e.snapshot as Record<string, unknown>,
  }));

  // Le montant demandé se compte sur les DÉPÔTS : additionner les validations et les refus
  // compterait le même achat deux fois.
  const demande = entries
    .filter((e) => e.event === "SUBMITTED" && e.estimatedTotal != null)
    .reduce((sum, e) => sum + Number(e.estimatedTotal), 0);

  return (
    <div className="space-y-5">
      <BackLink href="/admin">
        <ArrowLeft className="h-4 w-4" /> Administration
      </BackLink>
      <PageHeader
        title="Journal des demandes d'achat"
        description="Toutes les demandes faites aux moyens généraux, copiées entièrement à chaque geste — dépôt, validation, refus, retrait. On ajoute, on n'efface jamais : une demande retirée garde ici sa trace."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Gestes enregistrés" value={total} icon="ScrollText" />
        <KpiCard label="Demandes déposées" value={depots} icon="ShoppingBasket" />
        <KpiCard
          label="Estimé demandé (affiché)" value={`${demande.toLocaleString("fr-FR")} DZD`} icon="Coins"
          hint="Somme des estimations catalogue des dépôts affichés — une estimation, jamais une dépense."
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="ScrollText"
          title="Aucune demande d'achat au journal"
          description="Il se remplit tout seul, dès la première demande faite aux moyens généraux depuis « Mon espace »."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <PurchaseJournal rows={rows} tronque={total > rows.length ? total - rows.length : 0} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
