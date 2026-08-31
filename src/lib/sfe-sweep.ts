import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { loadCockpit } from "@/lib/queries/sfe-cockpit";
import { fieldAlerts, monthlyReviewLine, type FieldAlert, type RepSnapshot } from "@/lib/sfe-alerts";

/**
 * LE BALAYAGE DE LA FORCE DE VENTE — la supervision vient au superviseur, et le mois se fige.
 *
 * ── TROIS GESTES, TROIS RAISONS ─────────────────────────────────────────────────────────────
 *
 *  1. **LES ALERTES** — silence, retard à mi-mois, couverture, KAM non armé. Les règles sont
 *     PURES (`lib/sfe-alerts.ts`, testées) ; ici on les pose sur la base et l'on prévient.
 *     Anti-spam : une alerte par TYPE et par MOIS (`lastAlertKey`), jamais une par nuit — une
 *     notification quotidienne se fait couper, et c'est la vraie qu'on rate ensuite.
 *  2. **L'INSTANTANÉ MENSUEL** — le mois en cours se réécrit à chaque passage (idempotent), et
 *     le mois écoulé se CLÔT une fois pour toutes. Sans cela, un panel modifié en juin
 *     réécrirait la couverture de mars, et le chiffre relu en entretien annuel serait faux.
 *  3. **LA REVUE** — au passage du mois, une phrase par superviseur : ce que son périmètre a
 *     fait. Une revue qui demande d'ouvrir un tableau n'est pas lue ; le chiffre doit tenir
 *     dans la notification.
 *
 * Le chiffre vient d'`loadCockpit` — LE MÊME que l'écran de pilotage. Deux formules pour un
 * même taux finiraient par en donner deux, et le superviseur ne saurait plus lequel croire.
 *
 * Ne lève jamais : le planificateur ne doit pas mourir d'une alerte.
 */

export interface SfeSweepResult {
  alerted: number;
  snapshots: number;
  closed: number;
  reviews: number;
}

/** Le mois précédent celui de la date donnée. */
function previousMonth(now: Date): { year: number; month: number } {
  const m = now.getMonth(); // 0..11
  return m === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: m };
}

/**
 * Écrit (ou réécrit) l'instantané d'un mois pour un périmètre. Un mois DÉJÀ CLOS n'est jamais
 * retouché : c'est ce qui rend le chiffre relisible un an plus tard.
 */
async function snapshotMonth(year: number, month: number, close: boolean): Promise<{ written: number; closed: number }> {
  const { rows } = await loadCockpit({ year, month, repIds: null });
  let written = 0;
  let closed = 0;
  for (const r of rows) {
    const existing = await prisma.salesRepMonthlyKpi.findUnique({
      where: { repId_year_month: { repId: r.repId, year, month } },
      select: { id: true, closedAt: true },
    });
    if (existing?.closedAt) continue; // clos : on n'y touche plus, jamais
    const cible = r.plannedVisits || r.requiredVisits;
    const data = {
      teamId: r.teamId,
      panelSize: r.panelSize,
      capacity: r.capacity,
      plannedVisits: r.plannedVisits,
      requiredVisits: r.requiredVisits,
      realVisits: r.realVisits,
      coveredDoctors: r.coveredDoctors,
      realizationPct: cible > 0 ? Math.round((r.realVisits / cible) * 100) : 0,
      coveragePct: r.panelSize > 0 ? Math.round((r.coveredDoctors / r.panelSize) * 100) : 0,
      computedAt: new Date(),
      ...(close ? { closedAt: new Date() } : {}),
    };
    await prisma.salesRepMonthlyKpi.upsert({
      where: { repId_year_month: { repId: r.repId, year, month } },
      create: { repId: r.repId, year, month, ...data },
      update: data,
    });
    written += 1;
    if (close) closed += 1;
  }
  return { written, closed };
}

/** Les destinataires d'une alerte : le superviseur du KAM, ou ceux qui configurent. */
async function audienceFor(alert: FieldAlert, configurators: string[]): Promise<string[]> {
  if (alert.audience === "configurator") return configurators;
  const prof = await prisma.salesRepProfile.findUnique({
    where: { repId: alert.repId },
    select: { team: { select: { supervisorId: true } } },
  });
  const sup = prof?.team?.supervisorId;
  // Sans superviseur désigné, l'alerte remonte à ceux qui configurent : la taire reviendrait à
  // ne prévenir personne, ce qui est exactement le défaut qu'on corrige.
  return sup ? [sup] : configurators;
}

export async function runSfeFieldSweep(now: Date = new Date()): Promise<SfeSweepResult> {
  const out: SfeSweepResult = { alerted: 0, snapshots: 0, closed: 0, reviews: 0 };
  try {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // ── 1. Les alertes du mois en cours ────────────────────────────────────────────────────
    const { rows } = await loadCockpit({ year, month, repIds: null });
    if (rows.length === 0) return out;

    const snapshots: RepSnapshot[] = rows.map((r) => ({
      repId: r.repId, repName: r.name, panelSize: r.panelSize,
      plannedVisits: r.plannedVisits, requiredVisits: r.requiredVisits,
      realVisits: r.realVisits, coveredDoctors: r.coveredDoctors,
      lastVisitLoggedAt: r.lastVisitLoggedAt,
    }));
    const alerts = fieldAlerts(snapshots, now);

    // Ceux qui configurent la force de vente — le repli d'audience et la cible des alertes
    // de configuration. Le Super Admin en fait toujours partie.
    const configurators = (await prisma.user.findMany({
      where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { role: "DIRECTION" }, { role: "MEDICAL_PROMOTION_MANAGER" }] },
      select: { id: true },
    })).map((u) => u.id);

    for (const a of alerts) {
      // Anti-spam : la même alerte ne repart pas dans le même cycle.
      const profile = await prisma.salesRepProfile.findUnique({
        where: { repId: a.repId }, select: { id: true, lastAlertKey: true },
      });
      if (profile?.lastAlertKey === a.key) continue;

      const cibles = await audienceFor(a, configurators);
      for (const userId of cibles) {
        await notifyUser({
          userId, type: "MEDICAL_TOUR", title: a.title, body: a.body,
          link: "/planning/pilotage",
        }).catch(() => undefined);
      }
      // Le verrou se pose sur le PROFIL du KAM : sans profil (KAM non configuré), l'alerte
      // repartira — c'est voulu, elle signale justement qu'il faut le configurer.
      if (profile) {
        await prisma.salesRepProfile.update({
          where: { id: profile.id }, data: { lastAlertKey: a.key, lastAlertAt: now },
        }).catch(() => undefined);
      }
      out.alerted += 1;
    }

    // ── 2. L'instantané du mois EN COURS (réécrit à chaque passage) ────────────────────────
    const vivant = await snapshotMonth(year, month, false);
    out.snapshots += vivant.written;

    // ── 3. Au passage du mois : on CLÔT le mois écoulé, puis on envoie la revue ────────────
    //     Le 1er au matin, le mois précédent ne bougera plus : c'est le moment de le figer.
    if (now.getDate() === 1) {
      const prev = previousMonth(now);
      const clos = await snapshotMonth(prev.year, prev.month, true);
      out.snapshots += clos.written;
      out.closed += clos.closed;

      // La revue part aux superviseurs, avec LEUR périmètre — pas le total de la société.
      const teams = await prisma.salesTeam.findMany({
        where: { supervisorId: { not: null }, isActive: true },
        select: { supervisorId: true, name: true, members: { select: { repId: true } } },
      });
      const parSuperviseur = new Map<string, { equipes: string[]; repIds: Set<string> }>();
      for (const t of teams) {
        if (!t.supervisorId) continue;
        const cur = parSuperviseur.get(t.supervisorId) ?? { equipes: [], repIds: new Set<string>() };
        cur.equipes.push(t.name);
        for (const m of t.members) cur.repIds.add(m.repId);
        parSuperviseur.set(t.supervisorId, cur);
      }
      const moisPrec = await loadCockpit({ year: prev.year, month: prev.month, repIds: null });
      for (const [supervisorId, info] of parSuperviseur) {
        const siens = moisPrec.rows
          .filter((r) => info.repIds.has(r.repId))
          .map((r) => ({
            repId: r.repId, repName: r.name, panelSize: r.panelSize,
            plannedVisits: r.plannedVisits, requiredVisits: r.requiredVisits,
            realVisits: r.realVisits, coveredDoctors: r.coveredDoctors,
            lastVisitLoggedAt: r.lastVisitLoggedAt,
          }));
        if (siens.length === 0) continue;
        await notifyUser({
          userId: supervisorId, type: "GENERIC",
          title: `Revue ${String(prev.month).padStart(2, "0")}/${prev.year} — ${info.equipes.join(", ")}`,
          body: monthlyReviewLine(siens),
          link: `/planning/pilotage?y=${prev.year}&m=${prev.month}`,
        }).catch(() => undefined);
        out.reviews += 1;
      }
    }
  } catch (e) {
    console.error("[sfe-sweep] balayage force de vente échoué", e);
  }
  return out;
}
