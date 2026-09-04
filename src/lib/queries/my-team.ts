import { prisma } from "@/lib/prisma";
import { loadReportingLine } from "@/lib/departments";
import { subtreeOf, flattenTree, type TeamTreeNode } from "@/lib/hr/team-tree";
import { toNumber } from "@/lib/utils";
import type { SessionUser } from "@/lib/rbac";

/**
 * MON ÉQUIPE — ce qu'un encadrant a réellement besoin de voir sur ses N-1.
 *
 * ── CE QUE CET ÉCRAN N'EST PAS ──────────────────────────────────────────────────────────────
 *
 * Ce n'est pas un mini-module RH. Un encadrant n'administre pas les fiches, ne fixe pas les
 * salaires et n'ouvre pas les dossiers médicaux : cela reste aux ressources humaines, et le
 * copier ici en ferait une seconde porte sur des données qu'on a cloisonnées exprès.
 *
 * C'est l'écran de trois questions, et de trois seulement :
 *
 *   1. **QUI est dans mon équipe** — la liste, telle que la hiérarchie la définit vraiment ;
 *   2. **QU'EST-CE QUI M'ATTEND** — congés, achats, formations : ce qui dort chez moi et bloque
 *      quelqu'un. C'était éparpillé dans autant d'écrans qu'il y a de circuits, et l'on
 *      découvrait une demande de congé vieille de six jours en cherchant autre chose ;
 *   3. **QUI EST LÀ CETTE SEMAINE** — les absences en cours et à venir, parce que c'est la seule
 *      donnée qui change un planning.
 *
 * ── L'ÉQUIPE SE DÉDUIT, ELLE NE SE DÉCLARE PAS ──────────────────────────────────────────────
 *
 * `directReportsOf` définit mon équipe comme « ceux dont la cascade dit que je suis le N+1 » —
 * la MÊME fonction qui route les demandes. Les deux ne peuvent donc pas diverger : personne
 * n'apparaît dans mon équipe sans que ses demandes m'arrivent, et réciproquement.
 *
 * ── L'ÉQUIPE DESCEND JUSQU'EN BAS, LA FILE S'ARRÊTE AU PREMIER RANG ─────────────────────────
 *
 * Deux portées, et les confondre serait une faute dans les deux sens :
 *
 *   • **QUI EST SOUS MOI** — tout l'arbre (`subtreeOf`), N-1, N-2, jusqu'en bas. Pour un
 *     directeur, s'arrêter au premier rang, c'était quatre cartes qui cachaient quarante
 *     personnes : celles qui font le travail sont toutes au deuxième rang.
 *   • **CE QUI ATTEND MA DÉCISION** — les DIRECTS, et eux seuls. Le congé d'un N-2 est routé
 *     vers SON N+1 ; le faire apparaître dans ma file me ferait attendre une décision que je
 *     n'ai pas à prendre, et qui n'attend pas après moi. `TeamMember.pending` suit la même
 *     règle : il vaut 0 plus bas parce que je ne décide rien là.
 */

export interface TeamMember {
  employeeId: string;
  userId: string | null;
  fullName: string;
  /** 1 = N-1, 2 = N-2, … — le rang tel qu'un humain le compte. */
  depth: number;
  /** Son N+1 DANS MON ARBRE (null au premier rang : c'est moi). */
  managerEmployeeId: string | null;
  /** Le rôle applicatif — c'est lui qui décide QUELS indicateurs existent pour cette personne. */
  role: string | null;
  position: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  hiredAt: string | null;
  /** Fin de contrat proche — l'échéance qu'un encadrant doit anticiper, pas la RH seule. */
  contractEnd: string | null;
  /** Absent AUJOURD'HUI (congé approuvé en cours) : ce qui change la journée. */
  absentToday: boolean;
  /** Prochaine absence approuvée à venir. */
  nextLeave: { start: string; end: string; type: string } | null;
  /** Ce que J'ai à décider le concernant, tous circuits confondus. */
  pending: number;
}

export interface TeamPending {
  id: string;
  kind: "LEAVE" | "PURCHASE" | "TRAINING";
  who: string;
  title: string;
  detail: string | null;
  amount: number | null;
  createdAt: string;
  /** Échéance quand le circuit en porte une (dates de congé, date de formation). */
  deadline: string | null;
  href: string;
}

export interface MyTeam {
  /** La fiche employé de l'encadrant — absente, il n'a pas d'équipe à montrer. */
  selfEmployeeId: string | null;
  /** TOUT le monde sous moi, à plat mais DANS L'ORDRE DE L'ARBRE (un chef, puis ses gens). */
  members: TeamMember[];
  /** Le nombre de N-1 directs — le premier rang, celui dont les demandes m'arrivent. */
  directCount: number;
  /** Jusqu'où descend la chaîne : 1 = personne n'encadre personne sous moi. */
  depth: number;
  pending: TeamPending[];
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

/**
 * L'ÉQUIPE ET SA FILE, en une passe.
 *
 * Tout est borné aux N-1 : un encadrant ne voit ni les congés des autres services, ni les
 * demandes qu'il n'a pas à trancher. Le cloisonnement ne vient pas d'un droit de module — il
 * vient de la hiérarchie elle-même, et c'est ce qui le rend juste sans réglage.
 */
export async function getMyTeam(user: SessionUser): Promise<MyTeam> {
  const me = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!me) return { selfEmployeeId: null, members: [], directCount: 0, depth: 0, pending: [] };

  const { employees, departments } = await loadReportingLine();
  const arbre = subtreeOf(me.id, employees, departments);
  const tous = flattenTree(arbre);
  if (tous.length === 0) return { selfEmployeeId: me.id, members: [], directCount: 0, depth: 0, pending: [] };

  // L'ARBRE POUR MONTRER, LE PREMIER RANG POUR DÉCIDER — deux portées, jamais confondues.
  const directs = arbre.map((n) => n.employeeId);
  const directSet = new Set(directs);

  const employeeIds = tous.map((n) => n.employeeId);
  // Les demandes ne se lisent QUE pour mes directs : elles ne sont routées vers moi que là.
  const userIds = arbre.map((n) => n.userId).filter((v): v is string => Boolean(v));
  const now = new Date();

  const [fiches, conges, achats, formations] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true, fullName: true, userId: true, position: true, email: true, phone: true,
        hireDate: true, contractEnd: true, department: true,
        // Le RÔLE APPLICATIF, pas l'intitulé de poste : c'est lui qui dit quels indicateurs
        // existent pour cette personne (`jobOf`). Un intitulé libre obligerait à deviner.
        user: { select: { role: true } },
      },
      orderBy: { fullName: "asc" },
    }),
    // Les congés APPROUVÉS de TOUT L'ARBRE (pour savoir qui est là) ET ceux qui attendent MA
    // décision — ces derniers filtrés plus bas sur mes seuls directs.
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        OR: [
          { status: "APPROVED", endDate: { gte: now } },
          { status: "PENDING", stage: "MANAGER", employeeId: { in: directs } },
        ],
      },
      select: {
        id: true, employeeId: true, type: true, startDate: true, endDate: true, days: true,
        reason: true, status: true, stage: true, createdAt: true,
      },
      orderBy: { startDate: "asc" },
    }),
    // Les demandes d'achat de mon équipe qui attendent MA validation.
    prisma.administrativeRequest.findMany({
      where: {
        type: "PURCHASE", deletedAt: null, requesterId: { in: userIds },
        approvals: { some: { status: "PENDING" } },
      },
      select: {
        id: true, reference: true, title: true, requesterId: true, createdAt: true, fields: true,
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    // Les demandes de formation arrêtées à la marche du responsable.
    prisma.training.findMany({
      where: { requesterId: { in: userIds }, status: "PENDING", stage: "MANAGER" },
      select: { id: true, reference: true, title: true, requesterId: true, amount: true, startDate: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);

  const nomParEmploye = new Map(fiches.map((f) => [f.id, f.fullName]));
  const nomParUser = new Map(fiches.filter((f) => f.userId).map((f) => [f.userId as string, f.fullName]));

  const pending: TeamPending[] = [
    ...conges.filter((c) => c.status === "PENDING").map((c) => ({
      id: `leave-${c.id}`,
      kind: "LEAVE" as const,
      who: nomParEmploye.get(c.employeeId) ?? "—",
      title: `Congé — ${toNumber(c.days)} jour(s)`,
      detail: c.reason,
      amount: null,
      createdAt: c.createdAt.toISOString(),
      deadline: c.startDate.toISOString(),
      href: `/rh/conges`,
    })),
    ...achats.map((a) => {
      const champs = (a.fields as Record<string, unknown> | null) ?? {};
      return {
        id: `purchase-${a.id}`,
        kind: "PURCHASE" as const,
        who: nomParUser.get(a.requesterId ?? "") ?? "—",
        title: a.title,
        detail: a.reference,
        amount: typeof champs.estimatedTotal === "number" ? champs.estimatedTotal : null,
        createdAt: a.createdAt.toISOString(),
        deadline: null,
        href: `/demandes/${a.id}`,
      };
    }),
    ...formations.map((f) => ({
      id: `training-${f.id}`,
      kind: "TRAINING" as const,
      who: nomParUser.get(f.requesterId ?? "") ?? "—",
      title: f.title,
      detail: f.reference,
      amount: toNumber(f.amount) || null,
      createdAt: f.createdAt.toISOString(),
      deadline: iso(f.startDate),
      href: `/formations`,
    })),
  // La plus ANCIENNE en tête : c'est elle qui fait attendre quelqu'un depuis le plus longtemps.
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const enAttenteParEmploye = new Map<string, number>();
  for (const c of conges) {
    if (c.status !== "PENDING") continue;
    enAttenteParEmploye.set(c.employeeId, (enAttenteParEmploye.get(c.employeeId) ?? 0) + 1);
  }
  const employeParUser = new Map(fiches.filter((f) => f.userId).map((f) => [f.userId as string, f.id]));
  for (const src of [achats, formations]) {
    for (const r of src) {
      const empId = employeParUser.get(r.requesterId ?? "");
      if (empId) enAttenteParEmploye.set(empId, (enAttenteParEmploye.get(empId) ?? 0) + 1);
    }
  }

  const approuves = conges.filter((c) => c.status === "APPROVED");
  const parEmploye = new Map(fiches.map((f) => [f.id, f]));

  // L'ORDRE EST CELUI DE L'ARBRE, pas l'ordre alphabétique : un chef, puis ses gens, puis le
  // chef suivant. C'est ce qui permet à la page de dessiner la hiérarchie avec une simple
  // indentation, sans refaire la descente — et c'est le seul ordre qui répond à la question
  // que l'écran sert : « par qui passe-t-on pour lui parler ? »
  const members: TeamMember[] = tous.flatMap((n: TeamTreeNode) => {
    const f = parEmploye.get(n.employeeId);
    // Une fiche désactivée entre deux lectures : on la saute plutôt que d'inventer une ligne.
    if (!f) return [];
    const siens = approuves.filter((c) => c.employeeId === f.id);
    const enCours = siens.find((c) => c.startDate <= now && c.endDate >= now);
    const aVenir = siens.find((c) => c.startDate > now);
    return [{
      employeeId: f.id,
      userId: f.userId,
      fullName: f.fullName,
      depth: n.depth,
      managerEmployeeId: n.managerEmployeeId,
      role: f.user?.role ?? null,
      position: f.position,
      department: f.department,
      email: f.email,
      phone: f.phone,
      hiredAt: iso(f.hireDate),
      contractEnd: iso(f.contractEnd),
      absentToday: Boolean(enCours),
      nextLeave: aVenir
        ? { start: aVenir.startDate.toISOString(), end: aVenir.endDate.toISOString(), type: aVenir.type }
        : null,
      // ZÉRO PLUS BAS QUE LE PREMIER RANG, et ce n'est pas un manque : la demande d'un N-2 est
      // routée vers SON N+1. Afficher « 1 à décider » ici ferait chercher un bouton qui
      // n'existe pas, sur une décision que quelqu'un d'autre a déjà.
      pending: directSet.has(f.id) ? (enAttenteParEmploye.get(f.id) ?? 0) : 0,
    }];
  });

  const depth = members.reduce((max, m) => Math.max(max, m.depth), 0);
  return { selfEmployeeId: me.id, members, directCount: arbre.length, depth, pending };
}
