import { prisma } from "@/lib/prisma";
import { AVAILABLE_PRODUCT_STATUSES } from "@/lib/ad-pro/pickers";
import { platformScope, getMyCompanies, companyOptions } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { userCan, anyRoleFilter, type SessionUser } from "@/lib/rbac";
import { PRODUCT_MANAGER_ROLES } from "@/lib/workflow/origin";
import { adProState, sortAdPro, type AdProKind, type AdProRequest } from "@/lib/ad-pro/unified";
import type { AdProCreateData } from "@/lib/ad-pro/create-fields";

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

  const [sponsorings, intl, national, events, promo, consulting, other] = await Promise.all([
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
    can("CONSULTING")
      ? prisma.consultingContract.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: { id: true, reference: true, title: true, counterparty: true, status: true, createdAt: true, amount: true, requesterId: true },
        }).catch(() => [])
      : [],
    can("AD_PRO_OTHER")
      ? prisma.adProOtherRequest.findMany({
          where: scope, orderBy: { createdAt: "desc" }, take: LIMIT,
          select: { id: true, reference: true, title: true, beneficiary: true, status: true, createdAt: true, amount: true, requesterId: true },
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
    ...consulting.map((r) => r.requesterId),
    ...other.map((r) => r.requesterId),
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
    ...consulting.map((r) => ({
      id: r.id, kind: "CONSULTING" as const, reference: r.reference, title: r.title,
      // L'AUTRE PARTIE tient lieu de bénéficiaire : c'est elle qu'on cherche dans la liste
      // quand on se demande avec qui l'on a déjà contracté.
      beneficiary: r.counterparty,
      amount: r.amount === null ? null : toNumber(r.amount),
      status: r.status, state: adProState(r.status), requester: nameOf(r.requesterId),
      createdAt: r.createdAt.toISOString(), href: `/consulting/${r.id}`,
    })),
    ...other.map((r) => ({
      id: r.id, kind: "OTHER" as const, reference: r.reference, title: r.title,
      beneficiary: r.beneficiary,
      amount: r.amount === null ? null : toNumber(r.amount),
      status: r.status, state: adProState(r.status), requester: nameOf(r.requesterId),
      createdAt: r.createdAt.toISOString(), href: `/ad-pro/autres/${r.id}`,
    })),
  ];

  return sortAdPro(rows);
}

/**
 * CE QU'IL FAUT POUR CRÉER, SUR L'ÉCRAN AD & PRO LUI-MÊME.
 *
 * Le formulaire de chaque nature s'ouvre désormais dans le panneau commun. Ses listes (médecins
 * invitables, collaborateurs, chefs de produit, entités) ne peuvent donc plus venir de l'écran de
 * la nature : elles se lisent ici.
 *
 * ON NE LIT QUE CE QUI SERA UTILISÉ. Les natures créables sont connues avant l'appel : quelqu'un
 * qui ne peut créer qu'un sponsoring ne déclenche ni la liste des médecins ni celle des entités.
 * Une page qui interroge cinq tables pour un panneau que personne n'ouvrira, c'est du temps
 * d'affichage payé par tout le monde au bénéfice de personne.
 */
export async function getAdProCreateData(userId: string, kinds: readonly AdProKind[]): Promise<AdProCreateData> {
  const has = (k: AdProKind) => kinds.includes(k);
  // LE SPONSORING DÉSIGNE LUI AUSSI DES MÉDECINS. Il les tapait à la main — un praticien nommé de
  // mémoire, qui ne se rapproche d'aucune fiche de l'annuaire, si bien qu'on ne sait jamais
  // combien de fois on a pris en charge la même personne.
  const needsDoctors = has("CONGRESS_INTERNATIONAL") || has("CONGRESS_NATIONAL") || has("SPONSORING");
  const needsProductManagers = needsDoctors || has("SPONSORING");
  const needsPeople = kinds.length > 0;
  // LES PRODUITS PROMOUVABLES : ceux dont le traitement réglementaire est TERMINÉ. Proposer un
  // dossier en cours ferait préparer la promotion d'un médicament qui n'a pas encore le droit
  // d'être promu — ce n'est pas une maladresse d'écran, c'est une faute réglementaire.
  const needsProducts = has("SPONSORING");

  const [doctors, users, productManagers, companies, products, businessUnits] = await Promise.all([
    needsDoctors
      ? prisma.medicalDoctor.findMany({
          select: { id: true, name: true, specialty: true, city: true },
          orderBy: [{ specialty: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([] as { id: string; name: string; specialty: string | null; city: string | null }[]),
    needsPeople
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string; role: string }[]),
    needsProductManagers
      ? prisma.user.findMany({
          where: { isActive: true, ...anyRoleFilter(PRODUCT_MANAGER_ROLES) },
          select: { id: true, name: true }, orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    has("PROMO_MATERIAL") || has("CONSULTING") || has("OTHER")
      // Les entités PROPOSÉES sont celles de la personne : sans quoi le formulaire laisserait
      // rattacher une demande à une société qu'elle n'a pas le droit de voir.
      ? getMyCompanies(userId).then(companyOptions)
      : Promise.resolve([] as { value: string; label: string }[]),
    needsProducts
      ? prisma.regulatoryProduct.findMany({
          where: { status: { in: AVAILABLE_PRODUCT_STATUSES as never } },
          select: { id: true, brandName: true, dci: true, status: true },
          orderBy: [{ brandName: "asc" }, { dci: "asc" }],
        })
      : Promise.resolve([] as { id: string; brandName: string | null; dci: string; status: string }[]),
      // LES GAMMES ACTIVES — c'est le budget Ad&Pro de l'une d'elles que la demande engage.
    // Toujours chargées : les cinq natures de demande Ad&Pro se rattachent toutes à une gamme.
    prisma.businessUnit.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
]);

  return {
    doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty ?? "Sans spécialité", city: d.city ?? "" })),
    users: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    productManagers,
    companies,
    products: products.map((p) => ({ id: p.id, brandName: p.brandName, dci: p.dci, status: String(p.status) })),
    businessUnits,
  };
}
