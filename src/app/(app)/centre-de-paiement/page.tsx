import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { companyScopedWhere } from "@/lib/company";
import { toNumber, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  sitsOnPaymentCentre, awaitsCentre, CENTRAL_AUTH_THRESHOLD_DZD, PAYMENT_CENTRE_REFUSAL,
  type CentralStatus,
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
 *
 * Le CENTRE, ce sont les deux rôles du sommet **et les personnes nommément désignées** (siège
 * nommé, `PaymentCentreSeat`). Qui n'y siège pas ne reçoit plus une page blanche : il lit ce qui
 * lui manque et par quel geste on l'y fait entrer.
 */
export default async function CentreDePaiementPage() {
  const user = await requireUser();
  const canDecide = sitsOnPaymentCentre(user);

  // Les paiements que CETTE personne a le droit de voir ici : tout, si elle siège au centre ;
  // seulement les siens, si elle est demandeuse.
  // `companyScopedWhere` ET NON LE FILTRE D'ENTITÉ BRUT — c'est toute la différence.
  //
  // Le filtre brut vaut `companyId = X`, et **`NULL` n'est pas `X`** : un ordre qui n'a pas pu
  // être rattaché disparaissait de cet écran pour quiconque est cloisonné sur une société. Le
  // Super Admin (vue groupe, aucun filtre) voyait la file entière ; le Directeur Général ouvrait
  // un centre de paiement VIDE, et rien ne le lui disait. `companyScopedWhere` compose un `OR`
  // (mon entité, OU aucune) à l'intérieur d'un `AND` : les ordres à rattacher restent visibles,
  // sans jamais ouvrir ceux d'une autre société.
  const orders = await prisma.expenseOrder.findMany({
    where: await companyScopedWhere(user.id, {
      AND: [
        { centralStatus: { not: "NOT_REQUIRED" } },
        ...(canDecide ? [] : [{ requestedById: user.id }]),
      ],
    }),
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    include: {
      requestedBy: { select: { name: true } },
      company: { select: { name: true, shortName: true } },
      centralMessages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  // ── ON NE REND PLUS UN ÉCRAN MUET ────────────────────────────────────────────────────────
  //
  // Ici vivait un `notFound()` : quiconque n'était ni membre du centre ni demandeur tombait sur
  // une page blanche. C'est ce qu'on a vu — un Directeur Général à qui l'on croyait avoir donné
  // l'accès (module coché, « autre rôle » posé) et qui trouvait le vide, sans une ligne pour lui
  // dire ce qui manquait. Une page qui ne s'explique pas se lit comme une panne, et l'on cherche
  // le défaut ailleurs pendant des jours.
  //
  // On DIT donc la règle : qui siège, pourquoi vous n'y siégez pas, et le geste exact qui vous y
  // fait entrer. Rien n'est divulgué au passage — aucun paiement n'est chargé pour qui n'a pas le
  // droit de les voir, la requête ci-dessus s'en est chargée.
  if (!canDecide && orders.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Centre de paiement"
          description="L'écran où les paiements de la société sont autorisés, avant d'atteindre les Finances."
        />
        <EmptyState
          icon="ShieldAlert"
          title="Vous ne siégez pas au centre de paiement"
          description={PAYMENT_CENTRE_REFUSAL}
        />
        <p className="text-center text-xs text-muted-foreground">
          Cocher le module « Centre de paiement » dans la grille des accès ne suffit pas, et poser un « autre rôle »
          non plus : le siège se donne <strong>par votre nom</strong>, depuis Administration → Accès → « Qui siège au
          centre de paiement ».
        </p>
      </div>
    );
  }

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
    deadlineNature: o.deadlineNature,
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
