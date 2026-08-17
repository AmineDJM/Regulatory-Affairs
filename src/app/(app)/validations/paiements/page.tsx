import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireModule } from "@/lib/session";
import { userCan, hasGlobalView } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_REQUEST_STATUS, PAYMENT_URGENCY } from "@/lib/labels";
import { sortByPriority, isOverdue, deadlineLabel, isWithFinance } from "@/lib/finance/payment-request";

export const dynamic = "force-dynamic";

/**
 * LA FILE DES DEMANDES DE PAIEMENT.
 *
 * Deux listes : ce que j'ai demandé, et — pour les Finances — ce qui attend leur instruction.
 * L'ordre n'est PAS chronologique : un tri par date de création enterre l'urgence de ce matin
 * sous les dossiers du mois dernier. On classe par échéance réelle (`sortByPriority`).
 */
export default async function PaymentRequestsPage() {
  const user = await requireModule("VALIDATIONS");
  const finance = userCan(user, "FINANCES", "VALIDATE") || userCan(user, "FINANCES", "UPDATE")
    || user.role === "FINANCE_BUDGET_MANAGER" || hasGlobalView(user.role);

  const [mine, queue] = await Promise.all([
    prisma.paymentRequest.findMany({ where: { requesterId: user.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    finance
      ? prisma.paymentRequest.findMany({
          where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "ON_HOLD"] } },
          orderBy: { createdAt: "desc" }, take: 200,
        })
      : Promise.resolve([] as never[]),
  ]);

  const names = new Map(
    (await prisma.user.findMany({
      where: { id: { in: [...new Set(queue.map((q) => q.requesterId))] } },
      select: { id: true, name: true },
    })).map((u) => [u.id, u.name]),
  );

  const Rows = ({ rows, who }: { rows: typeof mine; who?: (id: string) => string }) => (
    <div className="surface overflow-x-auto p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Objet</TableHead>
            <TableHead>Bénéficiaire</TableHead>
            {who && <TableHead>Demandeur</TableHead>}
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>État</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortByPriority(rows).map((r) => (
            <TableRow key={r.id} className="cursor-pointer">
              <TableCell className="font-mono text-xs">
                <Link href={`/validations/paiements/${r.id}`} className="hover:underline">{r.reference}</Link>
              </TableCell>
              <TableCell className="font-medium">
                <Link href={`/validations/paiements/${r.id}`} className="hover:underline">{r.title}</Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{r.payee}</TableCell>
              {who && <TableCell className="text-muted-foreground">{who(r.requesterId)}</TableCell>}
              <TableCell className="text-right tabular-nums">{formatCurrency(toNumber(r.amount))}</TableCell>
              <TableCell className="text-muted-foreground">
                {deadlineLabel(r, PAYMENT_URGENCY)}
                {isOverdue(r) && <Badge tone="danger" dot={false} className="ml-1.5">en retard</Badge>}
              </TableCell>
              <TableCell><StatusBadge map={PAYMENT_REQUEST_STATUS} value={r.status} dot={false} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const waiting = queue.filter((q) => isWithFinance(q.status));
  const total = waiting.reduce((a, q) => a + toNumber(q.amount), 0);

  return (
    <div className="space-y-5">
      <BackLink href="/validations"><ArrowLeft className="h-4 w-4" /> Demandes de validations</BackLink>
      <PageHeader
        title="Demandes de paiement"
        description="Le dossier qui part aux Finances : montant, bénéficiaire, échéance, et les pièces qui le justifient. La discussion se tient pièce par pièce."
      />

      {finance && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="À instruire" value={waiting.length} icon="Banknote" tone={waiting.length > 0 ? "warning" : "default"} />
          <KpiCard label="En attente" value={queue.filter((q) => q.status === "ON_HOLD").length} icon="PauseCircle" />
          <KpiCard label="Montant en jeu" value={formatCurrency(total)} icon="Wallet" tone="info" />
        </div>
      )}

      {finance && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">À instruire (Finances)</h2>
          {queue.length === 0
            ? <EmptyState icon="Banknote" title="Rien à instruire" description="Aucune demande de paiement en attente." />
            : <Rows rows={queue} who={(id) => names.get(id) ?? "—"} />}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Mes demandes</h2>
        {mine.length === 0
          ? <EmptyState icon="Banknote" title="Aucune demande" description="Depuis « Demandes de validations », utilisez « Demander un paiement »." />
          : <Rows rows={mine} />}
      </section>
    </div>
  );
}
