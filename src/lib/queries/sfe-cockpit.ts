import { prisma } from "@/lib/prisma";
import { anyRoleFilter } from "@/lib/rbac";
import {
  getSfeConfig, repCapacity, assignmentEffort, fteFromEffort, panelRequiredVisits,
  type SfeConfig,
} from "@/lib/sfe";

/**
 * LE COCKPIT DE LA FORCE DE VENTE — planifié, réalisé, panel, couverture. UNE SEULE FOIS.
 *
 * ── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────────────────────
 *
 * Ce calcul vivait DANS la page `/planning/pilotage`. Tant qu'un seul écran le lisait, cela
 * tenait. Trois consommateurs le veulent désormais — l'écran, le balayage d'alertes, et
 * l'archivage mensuel — et trois copies d'une même formule finissent toujours par diverger sur
 * un détail : celle du mail dirait 78 %, celle de l'écran 81 %, et plus personne ne saurait
 * laquelle croire. Le chiffre du superviseur et celui du tableau doivent venir du MÊME endroit,
 * sinon l'outil perd le seul crédit qui compte.
 *
 * Les règles PURES (capacité, effort, FTE, fréquence cible) restent dans `lib/sfe.ts` et
 * `lib/sfe-alerts.ts` : ici on ne fait que LIRE la base et les appliquer.
 */

export interface CockpitRow {
  repId: string;
  name: string;
  buId: string | null;
  buName: string;
  buSort: number;
  /** Capacité terrain nette (visites/mois), surcharge individuelle comprise. */
  capacity: number;
  /** Effectif du panel par palier de potentiel. */
  panelByTier: Record<string, number>;
  panelSize: number;
  /** Visites planifiées par les affectations du cycle. */
  plannedVisits: number;
  plannedFte: number;
  /** Visites cibles du panel selon la fréquence par palier. */
  requiredVisits: number;
  /** Visites RÉELLEMENT réalisées sur le mois (statut terminé). */
  realVisits: number;
  realFte: number;
  /** Praticiens distincts visités sur le mois. */
  coveredDoctors: number;
  /**
   * Dernière visite SAISIE par ce KAM, toutes périodes confondues — la trace d'activité que
   * l'alerte de silence interroge. Distincte de la date de visite : c'est le fait qu'on a des
   * nouvelles, pas la date à laquelle il est passé.
   */
  lastVisitLoggedAt: Date | null;
}

export interface Cockpit {
  rows: CockpitRow[];
  config: SfeConfig;
  cycleId: string | null;
  year: number;
  month: number;
}

/**
 * Le cockpit d'un mois, pour un périmètre de KAM.
 *
 * `repIds = null` signifie « tous les KAM » (portée configurateur) — jamais « aucun » : c'est
 * la convention de `resolveRepScope`, et l'inverser rendrait le tableau vide au lieu de complet.
 */
export async function loadCockpit(input: {
  year: number;
  month: number;
  repIds: string[] | null;
  /** Cycle déjà résolu par l'appelant (évite de le recréer) ; sinon on le cherche. */
  cycleId?: string | null;
}): Promise<Cockpit> {
  const { year, month } = input;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [config, cycle] = await Promise.all([
    getSfeConfig(),
    input.cycleId !== undefined
      ? Promise.resolve(input.cycleId ? { id: input.cycleId } : null)
      : prisma.promoCycle.findUnique({ where: { year_month: { year, month } }, select: { id: true } }),
  ]);

  const kamUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      ...anyRoleFilter(["MEDICAL_DELEGATE", "NATIONAL_SALES"]),
      ...(input.repIds ? { id: { in: input.repIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const repIds = kamUsers.map((u) => u.id);
  if (repIds.length === 0) return { rows: [], config, cycleId: cycle?.id ?? null, year, month };

  const [profiles, bus, assignments, panel, visits, lastLogged] = await Promise.all([
    prisma.salesRepProfile.findMany({ where: { repId: { in: repIds } } }),
    prisma.businessUnit.findMany({ select: { id: true, name: true, sortOrder: true } }),
    cycle
      ? prisma.promotionAssignment.findMany({ where: { cycleId: cycle.id, repId: { in: repIds } } })
      : Promise.resolve([]),
    prisma.medicalDoctor.findMany({ where: { delegateId: { in: repIds } }, select: { delegateId: true, potential: true } }),
    prisma.medicalVisit.findMany({
      where: { delegateId: { in: repIds }, status: "COMPLETED", date: { gte: monthStart, lt: monthEnd } },
      select: { delegateId: true, doctorId: true },
    }),
    // La trace d'activité : la visite la plus récemment ENREGISTRÉE, toutes périodes. Elle
    // répond à « a-t-on des nouvelles de lui ? », pas à « quand est-il passé ? ».
    prisma.medicalVisit.groupBy({
      by: ["delegateId"],
      where: { delegateId: { in: repIds }, status: "COMPLETED" },
      _max: { createdAt: true },
    }),
  ]);

  const profileByRep = new Map(profiles.map((p) => [p.repId, p]));
  const buById = new Map(bus.map((b) => [b.id, b]));
  const loggedByRep = new Map(lastLogged.map((g) => [g.delegateId ?? "", g._max.createdAt ?? null]));

  const panelByRep = new Map<string, Record<string, number>>();
  for (const d of panel) {
    if (!d.delegateId) continue;
    const rec = panelByRep.get(d.delegateId) ?? {};
    rec[d.potential] = (rec[d.potential] ?? 0) + 1;
    panelByRep.set(d.delegateId, rec);
  }

  const realByRep = new Map<string, number>();
  const coveredByRep = new Map<string, Set<string>>();
  for (const v of visits) {
    if (!v.delegateId) continue;
    realByRep.set(v.delegateId, (realByRep.get(v.delegateId) ?? 0) + 1);
    if (v.doctorId) {
      const set = coveredByRep.get(v.delegateId) ?? new Set<string>();
      set.add(v.doctorId);
      coveredByRep.set(v.delegateId, set);
    }
  }

  const plannedByRep = new Map<string, { visits: number; fte: number }>();
  for (const a of assignments) {
    const cap = repCapacity(profileByRep.get(a.repId), config);
    const fte = fteFromEffort(assignmentEffort(a.plannedVisits, a.position, config.positionWeights), cap);
    const cur = plannedByRep.get(a.repId) ?? { visits: 0, fte: 0 };
    cur.visits += a.plannedVisits;
    cur.fte += fte;
    plannedByRep.set(a.repId, cur);
  }

  const rows: CockpitRow[] = kamUsers
    .map((u) => {
      const p = profileByRep.get(u.id);
      const bu = p?.businessUnitId ? buById.get(p.businessUnitId) : null;
      const capacity = repCapacity(p, config);
      const panelRec = panelByRep.get(u.id) ?? {};
      const planned = plannedByRep.get(u.id) ?? { visits: 0, fte: 0 };
      const real = realByRep.get(u.id) ?? 0;
      return {
        repId: u.id,
        name: u.name,
        buId: p?.businessUnitId ?? null,
        buName: bu?.name ?? "Sans BU",
        buSort: bu?.sortOrder ?? 9999,
        capacity,
        panelByTier: panelRec,
        panelSize: Object.values(panelRec).reduce((s, n) => s + n, 0),
        plannedVisits: planned.visits,
        plannedFte: planned.fte,
        requiredVisits: panelRequiredVisits(panelRec, config.frequencyByTier),
        realVisits: real,
        realFte: fteFromEffort(real, capacity),
        coveredDoctors: coveredByRep.get(u.id)?.size ?? 0,
        lastVisitLoggedAt: loggedByRep.get(u.id) ?? null,
      };
    })
    .sort((a, b) => a.buSort - b.buSort || a.buName.localeCompare(b.buName, "fr") || a.name.localeCompare(b.name, "fr"));

  return { rows, config, cycleId: cycle?.id ?? null, year, month };
}
