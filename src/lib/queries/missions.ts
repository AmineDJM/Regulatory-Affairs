import type { EntityType, MissionRole, MissionOrderStatus, MissionResponse, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DocItem } from "@/components/documents/document-list";
import { companyScopedWhere } from "@/lib/company";
import { familleQuantifiee, type PromoFamille } from "@/lib/promo/catalogue";
import {
  etatOrdreMission, libelleOrdreMission, etatDemandeSecretariat, etatDemandeMateriel, etatNoteFrais, SOUS_TYPE_SECRETARIAT,
  type EtatOM, type Etat, type EtapeFacultative, type HrStatut, type GateN1,
} from "@/lib/missions-equipe/etat";

export interface MissionCommentDTO {
  id: string; author: string; authorId: string | null; body: string; createdAt: string; editedAt: string | null;
}

/** Une étape facultative reliée à son circuit réel — son état relu, « chez qui ». */
export interface EtapeLieeDTO {
  id: string;
  statut: string;
  etat: Etat;
  /** Libellé court (référence, article…). */
  detail: string | null;
  href: string | null;
}

export interface MissionAssignmentDTO {
  id: string;
  entityType: EntityType;
  entityId: string;
  parentLabel: string;
  parentPath: string;
  userId: string;
  userName: string;
  role: MissionRole;
  orderStatus: MissionOrderStatus;
  requestedAt: string | null;
  issuedAt: string | null;
  issuedByName: string | null;
  note: string | null;
  documents: DocItem[];
  comments: MissionCommentDTO[];
  // ── Missions reliées au profil ──
  response: MissionResponse;
  respondedAt: string | null;
  declineReason: string | null;
  createdAt: string;
  lastNudgeAt: string | null;
  nudgeCount: number;
  archivedAt: string | null;
  organiserName: string | null;
  /** Dates et ville de la MISSION — les siennes, sinon celles de la demande. */
  dateDepart: string | null;
  dateRetour: string | null;
  ville: string | null;
  /** Les étapes facultatives ajoutées par la personne. */
  etapes: string[];
  om: { etat: EtatOM; libelle: Etat; requestId: string | null; pdfDocId: string | null; managerNote: string | null; hrNote: string | null };
  transport: EtapeLieeDTO | null;
  hebergement: EtapeLieeDTO | null;
  materiel: EtapeLieeDTO | null;
  noteFrais: EtapeLieeDTO | null;
  transportPosteId: string | null;
  hebergementPosteId: string | null;
}

function pathFor(entityType: EntityType, entityId: string): string {
  switch (entityType) {
    case "CONGRESS_INTERNATIONAL": return `/congress-international/${entityId}`;
    case "CONGRESS_NATIONAL": return `/congress-national/${entityId}`;
    case "EVENT": return `/events/${entityId}`;
    case "SPONSORING": return `/sponsoring/${entityId}`;
    default: return "/";
  }
}

const SELECT = {
  id: true, entityType: true, entityId: true, userId: true, role: true, orderStatus: true, requestedAt: true,
  issuedAt: true, issuedById: true, note: true, createdById: true, createdAt: true,
  response: true, respondedAt: true, declineReason: true, lastNudgeAt: true, nudgeCount: true, archivedAt: true,
  dateDepart: true, dateRetour: true, ville: true, etapes: true, transportPosteId: true, hebergementPosteId: true,
  user: { select: { name: true } },
} satisfies Prisma.MissionAssignmentSelect;
type Row = Prisma.MissionAssignmentGetPayload<{ select: typeof SELECT }>;

/** Ce que la demande Ad & Pro dit de la mission : libellé, ville, dates. */
export interface ParentMission { label: string; ville: string | null; debut: Date | null; fin: Date | null }

/** Résout les demandes parentes (par type), en lots. */
export async function resolveParents(rows: readonly { entityType: EntityType; entityId: string }[]): Promise<Map<string, ParentMission>> {
  const out = new Map<string, ParentMission>();
  const byType = new Map<EntityType, string[]>();
  for (const r of rows) (byType.get(r.entityType) ?? byType.set(r.entityType, []).get(r.entityType)!).push(r.entityId);

  for (const [type, idList] of byType) {
    const ids = Array.from(new Set(idList));
    if (type === "EVENT") {
      const items = await prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, city: true, startDate: true, endDate: true } });
      for (const i of items) out.set(`EVENT:${i.id}`, { label: i.name, ville: i.city, debut: i.startDate, fin: i.endDate ?? i.startDate });
    } else if (type === "SPONSORING") {
      const items = await prisma.sponsoringRequest.findMany({ where: { id: { in: ids } }, select: { id: true, reference: true, institution: true, city: true } });
      for (const i of items) out.set(`SPONSORING:${i.id}`, { label: `${i.reference} — ${i.institution}`, ville: i.city, debut: null, fin: null });
    } else if (type === "CONGRESS_INTERNATIONAL") {
      const items = await prisma.congressInternational.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, city: true, startDate: true, endDate: true } });
      for (const i of items) out.set(`CONGRESS_INTERNATIONAL:${i.id}`, { label: i.name, ville: i.city, debut: i.startDate, fin: i.endDate ?? i.startDate });
    } else if (type === "CONGRESS_NATIONAL") {
      const items = await prisma.congressNational.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, city: true, date: true, endDate: true } });
      for (const i of items) out.set(`CONGRESS_NATIONAL:${i.id}`, { label: i.name, ville: i.city, debut: i.date, fin: i.endDate ?? i.date });
    }
  }
  return out;
}

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** Enrichit des assignations brutes : pièces, fil, demande parente, circuits liés. */
async function hydrate(rows: Row[]): Promise<MissionAssignmentDTO[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [documents, comments, personnes, parents, hrRequests, adminRequests, promoRequests] = await Promise.all([
    prisma.document.findMany({
      where: { entityType: "MISSION_ASSIGNMENT", entityId: { in: ids } },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comment.findMany({
      where: { entityType: "MISSION_ASSIGNMENT", entityId: { in: ids } },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { id: { in: Array.from(new Set(rows.flatMap((r) => [r.issuedById, r.createdById]).filter(Boolean) as string[])) } },
      select: { id: true, name: true },
    }),
    resolveParents(rows),
    prisma.hrDocumentRequest.findMany({
      where: { missionAssignmentId: { in: ids } },
      select: {
        id: true, type: true, status: true, managerGate: true, managerUserId: true, managerNote: true, hrNote: true,
        missionAssignmentId: true, createdAt: true, fulfilment: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.administrativeRequest.findMany({
      where: { linkedEntityType: "MISSION_ASSIGNMENT", linkedEntityId: { in: ids }, deletedAt: null },
      select: { id: true, reference: true, status: true, subtype: true, linkedEntityId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.promoStockRequest.findMany({
      where: { missionAssignmentId: { in: ids } },
      select: { id: true, statut: true, quantite: true, missionAssignmentId: true, item: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const managerIds = Array.from(new Set(hrRequests.map((h) => h.managerUserId).filter(Boolean) as string[]));
  const managers = managerIds.length ? await prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, name: true } }) : [];
  const nom = new Map([...personnes, ...managers].map((u) => [u.id, u.name]));

  const docsByAssignment = new Map<string, DocItem[]>();
  for (const d of documents) {
    const item: DocItem = {
      id: d.id, name: d.name, category: d.category, version: d.version, sizeBytes: d.sizeBytes,
      confidentiality: d.confidentiality, uploadedBy: d.uploadedBy?.name ?? null,
      createdAt: d.createdAt.toISOString(), hasFile: Boolean(d.fileKey),
    };
    (docsByAssignment.get(d.entityId) ?? docsByAssignment.set(d.entityId, []).get(d.entityId)!).push(item);
  }
  const commentsByAssignment = new Map<string, MissionCommentDTO[]>();
  for (const c of comments) {
    const item: MissionCommentDTO = {
      id: c.id, author: c.author?.name ?? "Utilisateur", authorId: c.authorId,
      body: c.body, createdAt: c.createdAt.toISOString(), editedAt: c.editedAt?.toISOString() ?? null,
    };
    (commentsByAssignment.get(c.entityId) ?? commentsByAssignment.set(c.entityId, []).get(c.entityId)!).push(item);
  }

  // LA DERNIÈRE demande de chaque nature fait foi (triées de la plus récente à la plus ancienne).
  const premier = <T,>(liste: T[], cle: (t: T) => string | null): Map<string, T> => {
    const m = new Map<string, T>();
    for (const t of liste) { const k = cle(t); if (k && !m.has(k)) m.set(k, t); }
    return m;
  };
  const omDe = premier(hrRequests.filter((h) => h.type === "MISSION_ORDER"), (h) => h.missionAssignmentId);
  const nfDe = premier(hrRequests.filter((h) => h.type === "EXPENSE_REPORT"), (h) => h.missionAssignmentId);
  const transportDe = premier(adminRequests.filter((r) => r.subtype === SOUS_TYPE_SECRETARIAT.TRANSPORT), (r) => r.linkedEntityId);
  const hebergementDe = premier(adminRequests.filter((r) => r.subtype === SOUS_TYPE_SECRETARIAT.HEBERGEMENT), (r) => r.linkedEntityId);
  const materielDe = premier(promoRequests, (r) => r.missionAssignmentId);

  return rows.map((r) => {
    const parent = parents.get(`${r.entityType}:${r.entityId}`);
    const om = omDe.get(r.id) ?? null;
    const etatOm = etatOrdreMission(om ? { status: om.status as HrStatut, managerGate: (om.managerGate ?? null) as GateN1 | null } : null, r.orderStatus);
    const tr = transportDe.get(r.id);
    const he = hebergementDe.get(r.id);
    const ma = materielDe.get(r.id);
    const nf = nfDe.get(r.id);
    return {
      id: r.id, entityType: r.entityType, entityId: r.entityId,
      parentLabel: parent?.label ?? "Mission",
      parentPath: pathFor(r.entityType, r.entityId),
      userId: r.userId, userName: r.user.name, role: r.role, orderStatus: etatOm === "EMIS" ? "ISSUED" : r.orderStatus,
      requestedAt: iso(r.requestedAt), issuedAt: iso(r.issuedAt),
      issuedByName: r.issuedById ? nom.get(r.issuedById) ?? null : null,
      note: r.note, documents: docsByAssignment.get(r.id) ?? [], comments: commentsByAssignment.get(r.id) ?? [],
      response: r.response, respondedAt: iso(r.respondedAt), declineReason: r.declineReason,
      createdAt: r.createdAt.toISOString(), lastNudgeAt: iso(r.lastNudgeAt), nudgeCount: r.nudgeCount,
      archivedAt: iso(r.archivedAt),
      organiserName: r.createdById ? nom.get(r.createdById) ?? null : null,
      dateDepart: iso(r.dateDepart ?? parent?.debut ?? null),
      dateRetour: iso(r.dateRetour ?? parent?.fin ?? null),
      ville: r.ville ?? parent?.ville ?? null,
      etapes: r.etapes,
      om: {
        etat: etatOm,
        libelle: libelleOrdreMission(etatOm, om?.managerUserId ? nom.get(om.managerUserId) ?? null : null),
        requestId: om?.id ?? null,
        pdfDocId: om?.fulfilment?.id ?? null,
        managerNote: om?.managerNote ?? null,
        hrNote: om?.hrNote ?? null,
      },
      transport: tr ? { id: tr.id, statut: tr.status, etat: etatDemandeSecretariat(tr.status), detail: tr.reference, href: `/demandes/${tr.id}` } : null,
      hebergement: he ? { id: he.id, statut: he.status, etat: etatDemandeSecretariat(he.status), detail: he.reference, href: `/demandes/${he.id}` } : null,
      materiel: ma ? { id: ma.id, statut: ma.statut, etat: etatDemandeMateriel(ma.statut), detail: `${Number(ma.quantite)} × ${ma.item.name}`, href: "/stock-promotionnel" } : null,
      noteFrais: nf ? { id: nf.id, statut: nf.status, etat: etatNoteFrais(nf.status), detail: null, href: "/mon-dossier" } : null,
      transportPosteId: r.transportPosteId,
      hebergementPosteId: r.hebergementPosteId,
    };
  });
}

/** Assignations ACTIVES d'une entité (congrès / événement / sponsoring) — vue organisateur. */
export async function getEntityMissions(entityType: EntityType, entityId: string): Promise<MissionAssignmentDTO[]> {
  const rows = await prisma.missionAssignment.findMany({
    where: { entityType, entityId, archivedAt: null },
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
  return hydrate(rows);
}

/** Mes assignations actives (vue de la personne assignée) — toutes entités confondues. */
export async function getMyMissions(userId: string): Promise<MissionAssignmentDTO[]> {
  const rows = await prisma.missionAssignment.findMany({
    where: { userId, archivedAt: null },
    select: SELECT,
    orderBy: { createdAt: "desc" },
  });
  return hydrate(rows);
}

/**
 * UNE INVITATION À UNE MISSION, LUE LÉGÈRE — pour la ligne « À accepter » de Mon espace › Tâches. Ni pièces, ni fil,
 * ni circuits liés (`getMyMissions` les lit pour la page Mes missions) : seulement de quoi répondre en connaissance de cause.
 */
export interface InvitationMissionDTO {
  id: string;
  parentLabel: string;
  parentPath: string;
  role: MissionRole;
  dateDepart: string | null;
  dateRetour: string | null;
  ville: string | null;
  organiserName: string | null;
}

/** Mes invitations en attente de réponse, la plus ancienne en tête. */
export async function invitationsMissionAAccepter(userId: string): Promise<InvitationMissionDTO[]> {
  const rows = await prisma.missionAssignment.findMany({
    where: { userId, archivedAt: null, response: "INVITEE" },
    select: SELECT,
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (rows.length === 0) return [];
  const organisateurs = Array.from(new Set(rows.map((r) => r.createdById).filter((x): x is string => Boolean(x))));
  const [parents, personnes] = await Promise.all([
    resolveParents(rows),
    organisateurs.length ? prisma.user.findMany({ where: { id: { in: organisateurs } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const nom = new Map(personnes.map((p) => [p.id, p.name]));
  return rows.map((r) => {
    const parent = parents.get(`${r.entityType}:${r.entityId}`);
    return {
      id: r.id,
      parentLabel: parent?.label ?? "Mission",
      parentPath: pathFor(r.entityType, r.entityId),
      role: r.role,
      dateDepart: iso(r.dateDepart ?? parent?.debut ?? null),
      dateRetour: iso(r.dateRetour ?? parent?.fin ?? null),
      ville: r.ville ?? parent?.ville ?? null,
      organiserName: r.createdById ? nom.get(r.createdById) ?? null : null,
    };
  });
}

/** Les invitations qui attendent ma réponse — pour les compteurs. */
export async function compteInvitationsMission(userId: string): Promise<number> {
  return prisma.missionAssignment.count({ where: { userId, archivedAt: null, response: "INVITEE" } });
}

/** Un ordre de mission que JE dois valider comme N+1. */
export interface OrdreAValiderDTO {
  requestId: string;
  employeeName: string;
  mission: string;
  dates: { depart: string | null; retour: string | null };
  destination: string | null;
  createdAt: string;
}

/** LES ORDRES DE MISSION QUI ATTENDENT MA VALIDATION (N+1) — la marche avant les RH. */
export async function ordresMissionAValider(userId: string): Promise<OrdreAValiderDTO[]> {
  const rows = await prisma.hrDocumentRequest.findMany({
    where: { type: "MISSION_ORDER", status: "PENDING", managerGate: "PENDING", managerUserId: userId },
    select: { id: true, createdAt: true, omPrefill: true, employee: { select: { fullName: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return rows.map((r) => {
    const p = (r.omPrefill as Record<string, unknown> | null) ?? {};
    const premiers = (v: unknown) => (Array.isArray(v) && typeof v[0] === "string" ? (v[0] as string) : null);
    return {
      requestId: r.id,
      employeeName: r.employee.fullName,
      mission: typeof p.libelle === "string" ? p.libelle : "Mission",
      dates: { depart: premiers(p.datesDepart), retour: premiers(p.datesRetour) },
      destination: typeof p.destination === "string" ? p.destination : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** Une personne qu'on peut inviter — groupée par département / équipe dans le sélecteur. */
export interface PersonneInvitable { id: string; name: string; groupe: string }

/** Les salariés actifs, groupés par département (ou « Sans département »). */
export async function personnesInvitables(): Promise<PersonneInvitable[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, employee: { select: { department: true, departmentRef: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    id: u.id, name: u.name,
    groupe: u.employee?.departmentRef?.name ?? u.employee?.department ?? "Sans département",
  }));
}

/**
 * Les articles du stock promotionnel qu'une personne peut demander pour sa mission — le MÊME périmètre que
 * « Demander » du stock (`articleDansMonPerimetre`) : actifs, de sa société, non numériques.
 */
export async function articlesDemandables(userId: string): Promise<{ id: string; libelle: string }[]> {
  const items = await prisma.promoStockItem.findMany({
    where: await companyScopedWhere(userId, { isActive: true }),
    select: { id: true, name: true, catalogue: { select: { famille: true } } },
    orderBy: { name: "asc" },
    take: 300,
  });
  return items
    .filter((i) => familleQuantifiee(i.catalogue.famille as PromoFamille))
    .map((i) => ({ id: i.id, libelle: i.name }));
}

export type { EtapeFacultative };
