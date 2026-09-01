import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  sitsOnPaymentCentre, awaitsCentre, CENTRAL_AUTH_THRESHOLD_DZD, type CentralStatus,
} from "@/lib/payments/authorization";
import { entityHref } from "@/lib/entity-href";
import { ENTITY_TYPE_LABELS } from "@/lib/labels";
import { CentreBoard, type CentreOrder } from "./centre-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Centre de paiement — AMD Internal OS" };

/**
 * LE CENTRE DE PAIEMENT — le PDG et le Super Admin autorisent, la comptabilité exécute.
 *
 * Aucun décaissement à partir de 50 000 DZD ne quitte les Finances sans passer par ici. Les
 * moyens généraux sont exemptés (la petite caisse a son circuit), la paie n'entre pas dans ce
 * dispositif. Au-dessous du seuil, un paiement validé par le circuit habituel file directement
 * aux Finances — faire viser une facture de 3 000 DZD par le PDG, c'est garantir qu'il ne visera
 * plus rien au bout de trois semaines.
 *
 * L'écran est ouvert au CENTRE (qui décide) et au DEMANDEUR (qui répond quand on lui rend la
 * main) : les Finances, elles, n'ont rien à faire ici — un paiement leur arrive une fois autorisé.
 */
export default async function CentreDePaiementPage() {
  const user = await requireUser();
  const canDecide = sitsOnPaymentCentre(user);

  // Les paiements que CETTE personne a le droit de voir ici : tout, si elle siège au centre ;
  // seulement les siens, si elle est demandeuse. Quelqu'un qui n'est ni l'un ni l'autre n'a rien
  // à faire sur cet écran — et un 404 en dit moins qu'une page vide.
  const scope = await platformScope(user.id);
  const orders = await prisma.expenseOrder.findMany({
    where: {
      AND: [
        scope,
        { centralStatus: { not: "NOT_REQUIRED" } },
        ...(canDecide ? [] : [{ requestedById: user.id }]),
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: {
      requestedBy: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
      centralMessages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!canDecide && orders.length === 0) notFound();

  const decidedByIds = [...new Set(orders.map((o) => o.centralDecidedById).filter((v): v is string => Boolean(v)))];
  const deciders = decidedByIds.length
    ? await prisma.user.findMany({ where: { id: { in: decidedByIds } }, select: { id: true, name: true } })
    : [];
  const deciderName = new Map(deciders.map((d) => [d.id, d.name]));

  const rows: CentreOrder[] = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    label: o.label,
    beneficiary: o.beneficiary,
    amount: toNumber(o.amount),
    proposedAmount: o.centralProposedAmount ? toNumber(o.centralProposedAmount) : null,
    centralStatus: o.centralStatus as CentralStatus,
    requestedBy: o.requestedBy?.name ?? null,
    companyLabel: o.company ? o.company.shortName ?? o.company.name : null,
    createdAt: o.createdAt.toISOString(),
    decidedBy: o.centralDecidedById ? deciderName.get(o.centralDecidedById) ?? null : null,
    decidedAt: o.centralDecidedAt?.toISOString() ?? null,
    dueDate: o.dueDate?.toISOString() ?? null,
    // CHAQUE ORIGINE S'OUVRE, PAS SEULEMENT LA DEMANDE DE PAIEMENT.
    //
    // Tant que le centre ne voyait que des demandes de paiement, ne relier que celles-là se
    // défendait. Depuis qu'il est le GUICHET UNIQUE — avance sur salaire, demande
    // administrative, matériel promotionnel, dossier réglementaire, information médicale… —
    // la même règle rendait la plupart des lignes impossibles à ouvrir : on autorisait des
    // sorties d'argent sans pouvoir lire ce qui les justifie. `entityHref` porte la table des
    // routes, et ce qu'elle ne sait pas ouvrir est DIT (voir `sourceLabel`).
    dossierHref: entityHref(o.sourceType, o.sourceId),
    sourceLabel: o.sourceType ? ENTITY_TYPE_LABELS[o.sourceType] ?? o.sourceType : null,
    isMine: o.requestedById === user.id,
    messages: o.centralMessages.map((m) => ({
      id: m.id, decision: m.decision, body: m.body,
      author: m.author?.name ?? null, createdAt: m.createdAt.toISOString(),
    })),
  }));

  const waiting = rows.filter((r) => awaitsCentre(r.centralStatus));
  const waitingTotal = waiting.reduce((a, r) => a + r.amount, 0);
  const approved = rows.filter((r) => r.centralStatus === "APPROVED").length;
  const refused = rows.filter((r) => r.centralStatus === "REFUSED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Centre de paiement"
        description={`Tout paiement à partir de ${CENTRAL_AUTH_THRESHOLD_DZD.toLocaleString("fr-FR")} DZD est autorisé ici avant d'atteindre les Finances — les moyens généraux exceptés. Le centre autorise, la comptabilité exécute : c'est la séparation des deux gestes qui rend le contrôle réel. Une décision n'est pas forcément « oui » ou « non » : on peut demander une révision du montant ou une argumentation, et le demandeur répond dans le même fil.`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="En attente" value={waiting.length} icon="Hourglass" tone={waiting.length > 0 ? "warning" : "default"} />
        <KpiCard label="Montant en attente" value={formatCurrency(waitingTotal)} icon="Coins" tone={waiting.length > 0 ? "warning" : "default"} />
        <KpiCard label="Autorisés" value={approved} icon="ShieldCheck" tone="success" />
        <KpiCard label="Refusés" value={refused} icon="ShieldX" tone={refused > 0 ? "danger" : "default"} />
      </div>

      <CentreBoard orders={rows} canDecide={canDecide} />
    </div>
  );
}
