import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { userCan, type SessionUser } from "@/lib/rbac";
import { adProState, sortAdPro, type AdProRequest } from "@/lib/ad-pro/unified";

/**
 * LA LISTE UNIFIÉE DES DEMANDES AD & PRO.
 *
 * Elle relit les cinq modèles et les ramène à une ligne commune. Rien n'est recopié dans une
 * table de synthèse : une copie diverge au premier changement de statut, et l'on se retrouve
 * alors avec deux vérités dont on ne sait plus laquelle croire.
 *
 * LES DROITS SONT CEUX DE CHAQUE NATURE. On n'interroge un modèle que si la personne a le module
 * correspondant — une vue « toutes les demandes » qui contournerait le RBAC serait précisément la
 * fuite que le cloisonnement cherche à empêcher. Quelqu'un qui n'a que le Sponsoring voit une
 * liste unifiée… de sponsorings, et c'est correct.
 */

const LIMIT = 200;

export async function getAdProRequests(user: SessionUser): Promise<AdProRequest[]> {
  const scope = await platformScope(user.id);
  const can = (m: Parameters<typeof userCan>[1]) => userCan(user, m, "VIEW");

  const [sponsorings, intl, national, events, promo] = await Promise.all([
    can("SPONSORING")
      ? prisma.sponsoringRequest.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: {
            id: true, reference: true, institution: true, doctor: true, type: true,
            status: true, createdAt: true, amountRequested: true, requesterId: true,
          },
        }).catch(() => [])
      : [],
    can("CONGRESS_INTERNATIONAL")
      ? prisma.congressInternational.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: { id: true, name: true, status: true, createdAt: true, estimatedBudget: true, requesterId: true },
        }).catch(() => [])
      : [],
    can("CONGRESS_NATIONAL")
      ? prisma.congressNational.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: { id: true, name: true, status: true, createdAt: true, estimatedBudget: true, requesterId: true },
        }).catch(() => [])
      : [],
    can("EVENTS")
      ? prisma.event.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: { id: true, name: true, status: true, createdAt: true, estimatedBudget: true, location: true, requesterId: true },
        }).catch(() => [])
      : [],
    can("PROMO_MATERIAL")
      ? prisma.promoMaterial.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: { id: true, reference: true, title: true, status: true, createdAt: true, chosenAmount: true, amount: true, chosenAgency: true },
        }).catch(() => [])
      : [],
  ]);

  // Les demandeurs en UN lot : cinq relations séparées feraient cinq fois le même travail, et
  // l'écran n'a besoin que d'un nom.
  const requesterIds = [...new Set([
    ...sponsorings.map((r) => r.requesterId),
    ...intl.map((r) => r.requesterId),
    ...national.map((r) => r.requesterId),
    ...events.map((r) => r.requesterId),
  ].filter((x): x is string => Boolean(x)))];
  const people = requesterIds.length
    ? await prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? null : null);

  const rows: AdProRequest[] = [
    ...sponsorings.map((r) => ({
      id: r.id, kind: "SPONSORING" as const, reference: r.reference,
      title: [r.type, r.institution].filter(Boolean).join(" — ") || "Sponsoring",
      beneficiary: r.doctor ?? r.institution,
      amount: r.amountRequested === null ? null : toNumber(r.amountRequested),
      status: r.status, state: adProState(r.status), requester: nameOf(r.requesterId),
      createdAt: r.createdAt.toISOString(), href: `/sponsoring/${r.id}`,
    })),
    ...intl.map((r) => ({
      id: r.id, kind: "CONGRESS_INTERNATIONAL" as const, reference: r.id.slice(-6).toUpperCase(), title: r.name,
      beneficiary: null, amount: r.estimatedBudget === null ? null : toNumber(r.estimatedBudget),
      status: r.status, state: adProState(r.status), requester: nameOf(r.requesterId),
      createdAt: r.createdAt.toISOString(), href: `/congress-international/${r.id}`,
    })),
    ...national.map((r) => ({
      id: r.id, kind: "CONGRESS_NATIONAL" as const, reference: r.id.slice(-6).toUpperCase(), title: r.name,
      beneficiary: null, amount: r.estimatedBudget === null ? null : toNumber(r.estimatedBudget),
      status: r.status, state: adProState(r.status), requester: nameOf(r.requesterId),
      createdAt: r.createdAt.toISOString(), href: `/congress-national/${r.id}`,
    })),
    ...events.map((r) => ({
      id: r.id, kind: "EVENT" as const, reference: r.id.slice(-6).toUpperCase(), title: r.name,
      beneficiary: r.location, amount: r.estimatedBudget === null ? null : toNumber(r.estimatedBudget),
      status: r.status, state: adProState(r.status), requester: nameOf(r.requesterId),
      createdAt: r.createdAt.toISOString(), href: `/events/${r.id}`,
    })),
    ...promo.map((r) => ({
      id: r.id, kind: "PROMO_MATERIAL" as const, reference: r.reference, title: r.title,
      beneficiary: r.chosenAgency,
      // Le montant RETENU fait foi dès qu'un devis est choisi ; sinon le budget estimé.
      amount: r.chosenAmount !== null ? toNumber(r.chosenAmount) : r.amount === null ? null : toNumber(r.amount),
      status: r.status, state: adProState(r.status), requester: null,
      createdAt: r.createdAt.toISOString(), href: `/promo-material/${r.id}`,
    })),
  ];

  return sortAdPro(rows);
}
