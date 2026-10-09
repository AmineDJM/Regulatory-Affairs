import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { moduleScope, userCan, type SessionUser } from "@/lib/rbac";
import { droitsCampagne, peutVoirProposition, type DroitsCampagne, type EntreeDroits } from "./regles";
import {
  construireVueDirection, construireVuePole,
  type RawCampagne, type RawProposition, type CampagneVueDirection, type PropositionVue,
} from "./vues";
import type { CampagnePourPole } from "./regles";

/**
 * LES LECTURES DE LA CAMPAGNE BUDGÉTAIRE — chaque écran reçoit SA vue : la Direction la sienne (cadrage seulement pour
 * qui le voit), un pôle la sienne (jamais de cadrage, `construireVuePole`). Les droits se lisent ici, une fois.
 */

const estRole = (u: SessionUser, r: string) => u.role === r || u.secondaryRole === r;

/** Les départements que la personne dirige (responsable ou adjoint) — les pôles qu'elle prépare. */
export async function polesTenusPar(userId: string): Promise<string[]> {
  const deps = await prisma.department.findMany({
    where: { OR: [{ head: { userId } }, { deputy: { userId } }] },
    select: { id: true },
  });
  return deps.map((d) => d.id);
}

export async function entreeDroits(user: SessionUser, validatorIds: readonly string[]): Promise<EntreeDroits> {
  return {
    userId: user.id,
    estSuperAdmin: user.role === "SUPER_ADMIN",
    estDG: estRole(user, "GENERAL_MANAGER"),
    voitTout: userCan(user, "BUDGET_CAMPAIGN", "VIEW") && moduleScope(user, "BUDGET_CAMPAIGN") === "ALL",
    peutPiloter: userCan(user, "BUDGET_CAMPAIGN", "UPDATE"),
    validatorIds,
    polesTenus: await polesTenusPar(user.id),
  };
}

const CHAMPS_CAMPAGNE = {
  id: true, year: true, companyId: true, title: true, status: true, opensAt: true, submitDeadline: true, validationDeadline: true,
  cadrageTotal: true, validatorMode: true, validatorIds: true, validatorRule: true, allowRectificatif: true, seuilJustificationPct: true,
} as const;

export function versRawCampagne(c: {
  id: string; year: number; companyId: string | null; title: string; status: string; opensAt: Date; submitDeadline: Date;
  validationDeadline: Date; cadrageTotal: unknown; validatorMode: string; validatorIds: string[]; validatorRule: string;
  allowRectificatif: boolean; seuilJustificationPct: unknown;
}): RawCampagne {
  return {
    ...c,
    cadrageTotal: c.cadrageTotal === null || c.cadrageTotal === undefined ? null : toNumber(c.cadrageTotal),
    seuilJustificationPct: toNumber(c.seuilJustificationPct),
  };
}

export async function chargerCampagne(id: string): Promise<RawCampagne | null> {
  const c = await prisma.budgetCampaign.findUnique({ where: { id }, select: CHAMPS_CAMPAGNE });
  return c ? versRawCampagne(c) : null;
}

/** Les campagnes, la plus récente d'abord. */
export async function listerCampagnes(): Promise<{ id: string; year: number; title: string; status: string }[]> {
  return prisma.budgetCampaign.findMany({ select: { id: true, year: true, title: true, status: true }, orderBy: [{ year: "desc" }, { createdAt: "desc" }] });
}

/** Les propositions d'une campagne, en lignes brutes (montants en nombres), bornées aux départements donnés si fournis. */
export async function chargerPropositions(campaignId: string, seulement?: { ids?: string[]; departmentIds?: string[] }): Promise<RawProposition[]> {
  const where = {
    campaignId,
    ...(seulement?.ids ? { id: { in: seulement.ids } } : {}),
    ...(seulement?.departmentIds ? { departmentId: { in: seulement.departmentIds } } : {}),
  };
  const rows = await prisma.budgetProposal.findMany({
    where,
    orderBy: { poleLabel: "asc" },
    select: {
      id: true, departmentId: true, poleLabel: true, domaine: true, cadrage: true, status: true, currentVersion: true,
      estRectificatif: true, revisionAutorisee: true, envelopeId: true,
      department: { select: { head: { select: { fullName: true } } } },
      lines: true,
      votes: { select: { userId: true, decision: true, version: true, createdAt: true } },
      comments: { select: { id: true, authorId: true, parLuna: true, body: true, createdAt: true, lineId: true } },
      versions: { select: { version: true, submittedAt: true, total: true, summary: true, summaryByLuna: true, rectificatif: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id, departmentId: p.departmentId, poleLabel: p.poleLabel, domaine: p.domaine,
    cadrage: p.cadrage === null ? null : toNumber(p.cadrage),
    status: p.status, currentVersion: p.currentVersion, estRectificatif: p.estRectificatif,
    revisionAutorisee: p.revisionAutorisee, envelopeId: p.envelopeId,
    responsable: p.department?.head?.fullName ?? null,
    lignes: p.lines.map((l) => ({
      id: l.id, key: l.key, label: l.label, categoryKey: l.categoryKey, source: l.source,
      realise2026: toNumber(l.realise2026), propose: toNumber(l.propose), ajuste: l.ajuste === null ? null : toNumber(l.ajuste),
      decision: l.decision, justification: l.justification, attachments: l.attachments, sortOrder: l.sortOrder,
    })),
    votes: p.votes,
    commentaires: p.comments,
    versions: p.versions.map((v) => ({ ...v, total: toNumber(v.total) })),
  }));
}

/** Les noms des comptes cités (valideurs, auteurs). */
export async function nomsDesComptes(ids: readonly string[]): Promise<Map<string, string>> {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: uniques } }, select: { id: true, name: true } });
  return new Map(rows.map((u) => [u.id, u.name]));
}

function idsCites(c: RawCampagne, ps: readonly RawProposition[]): string[] {
  return [...c.validatorIds, ...ps.flatMap((p) => [...p.votes.map((v) => v.userId), ...p.commentaires.map((m) => m.authorId ?? "")])];
}

export type VueCampagne =
  | { kind: "aucune" }
  | { kind: "interdit" }
  | { kind: "direction"; droits: DroitsCampagne; campagne: CampagneVueDirection; propositions: PropositionVue[]; mesPoles: string[] }
  | { kind: "pole"; droits: DroitsCampagne; campagne: CampagnePourPole; propositions: Omit<PropositionVue, "cadrage">[]; mesPoles: string[] };

/**
 * LA VUE QU'UNE PERSONNE REÇOIT pour une campagne : la Direction (et ses valideurs) voit tous les pôles ; un responsable
 * de département ne voit que SES pôles, construits sans cadrage. `forcerPole` : la Direction qui ouvre la préparation
 * d'un pôle la voit telle que le pôle la voit — sans cadrage, elle aussi.
 */
export async function vueCampagnePour(user: SessionUser, campaignId: string, forcerPole = false): Promise<VueCampagne> {
  const c = await chargerCampagne(campaignId);
  if (!c) return { kind: "aucune" };
  const e = await entreeDroits(user, c.validatorIds);
  const droits = droitsCampagne(e);
  if (droits.voitVueDG && !forcerPole) {
    const ps = await chargerPropositions(c.id);
    const noms = await nomsDesComptes(idsCites(c, ps));
    const v = construireVueDirection(c, ps, noms, droits.voitLeCadrage);
    return { kind: "direction", droits, ...v, mesPoles: e.polesTenus };
  }
  const visibles = droits.voitVueDG ? undefined : e.polesTenus;
  if (visibles && visibles.length === 0) return { kind: "interdit" };
  const ps = (await chargerPropositions(c.id, visibles ? { departmentIds: visibles } : undefined))
    .filter((p) => peutVoirProposition(e, p.departmentId));
  const noms = await nomsDesComptes(idsCites(c, ps));
  return { kind: "pole", droits, ...construireVuePole(c, ps, noms), mesPoles: e.polesTenus };
}
