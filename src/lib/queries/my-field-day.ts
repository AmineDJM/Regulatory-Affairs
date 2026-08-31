import { prisma } from "@/lib/prisma";
import { getSfeConfig, panelRequiredVisits } from "@/lib/sfe";
import {
  buildTournee, carriedProducts, monthProgress,
  type CarriedProduct, type MonthProgress, type PanelDoctor, type TourneeItem,
} from "@/lib/sfe-day";

/**
 * « MA JOURNÉE » — tout ce que l'écran du KAM affiche, en une requête.
 *
 * L'écran ne calcule RIEN : il rend ce que ce module lui donne. Les règles (qui voir, dans quel
 * ordre, quels produits pré-cocher) vivent dans `lib/sfe-day.ts`, pur et testé — ici on ne fait
 * que lire la base et les appliquer. C'est ce qui permet à Adam de proposer exactement la même
 * tournée que l'écran, sans en réécrire la logique une seconde fois.
 */

export interface MyFieldDay {
  /** La tournée proposée du jour — les praticiens en retard de fréquence, les plus utiles d'abord. */
  tournee: TourneeItem[];
  /** Le panel COMPLET, pour saisir une visite hors tournée (le terrain improvise, et c'est normal). */
  panel: { id: string; name: string; specialty: string | null; institution: string | null; city: string | null }[];
  /** Les produits que CE KAM porte CE mois-ci, dans l'ordre de la mallette. */
  produits: CarriedProduct[];
  /** Sa ligne de chiffres du mois. */
  progress: MonthProgress;
  /** Ses dernières visites saisies — la preuve que sa saisie est arrivée quelque part. */
  recentes: { id: string; date: Date; doctorName: string; produits: string[] }[];
  /** Le panel est-il vide ? (l'écran le DIT au lieu d'afficher une page blanche) */
  panelVide: boolean;
  /** Aucune affectation de produit ce cycle ? (même raison) */
  sansAffectation: boolean;
}

export async function loadMyFieldDay(userId: string, today = new Date()): Promise<MyFieldDay> {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [config, cycle, doctors, visitsThisMonth, recentes] = await Promise.all([
    getSfeConfig(),
    prisma.promoCycle.findUnique({ where: { year_month: { year, month } }, select: { id: true } }),
    prisma.medicalDoctor.findMany({
      where: { delegateId: userId },
      select: {
        id: true, name: true, potential: true, specialty: true, institution: true, city: true,
        lastVisit: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.medicalVisit.findMany({
      where: { delegateId: userId, status: "COMPLETED", date: { gte: monthStart, lt: monthEnd } },
      select: { doctorId: true },
    }),
    prisma.medicalVisit.findMany({
      where: { delegateId: userId, status: "COMPLETED" },
      select: {
        id: true, date: true,
        doctor: { select: { name: true } },
        productLinks: { select: { product: { select: { canonicalName: true } } } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  // Les affectations du cycle : ce que ce KAM porte, avec sa position de détail.
  const assignments = cycle
    ? await prisma.promotionAssignment.findMany({
        where: { cycleId: cycle.id, repId: userId },
        select: { position: true, product: { select: { name: true, productId: true } } },
      })
    : [];

  const visitsByDoctor = new Map<string, number>();
  for (const v of visitsThisMonth) {
    if (!v.doctorId) continue;
    visitsByDoctor.set(v.doctorId, (visitsByDoctor.get(v.doctorId) ?? 0) + 1);
  }

  const panelDoctors: PanelDoctor[] = doctors.map((d) => ({
    id: d.id, name: d.name, potential: String(d.potential),
    specialty: d.specialty, institution: d.institution, city: d.city,
    lastVisitAt: d.lastVisit,
    visitsThisMonth: visitsByDoctor.get(d.id) ?? 0,
  }));

  const panelByTier: Record<string, number> = {};
  for (const d of panelDoctors) panelByTier[d.potential] = (panelByTier[d.potential] ?? 0) + 1;

  // LA CIBLE DU MOIS : ce que les affectations demandent, à défaut ce que le panel exige. Les
  // affectations priment — c'est le plan que la Direction a posé pour CE cycle ; la fréquence
  // du panel n'est que le repli quand personne n'a encore rien affecté.
  const planned = cycle
    ? await prisma.promotionAssignment.aggregate({
        where: { cycleId: cycle.id, repId: userId }, _sum: { plannedVisits: true },
      })
    : null;
  const target = planned?._sum.plannedVisits ?? 0;

  // Le produit CANONIQUE est la cible du lien de visite : un produit promu sans produit
  // canonique ne peut pas être coché (on ne saurait pas quoi relier) — on l'écarte plutôt que
  // d'offrir une case qui échouerait à l'enregistrement.
  const produits = carriedProducts(
    assignments
      .filter((a) => a.product.productId)
      .map((a) => ({ productId: a.product.productId!, name: a.product.name, position: a.position })),
    config,
  );

  return {
    tournee: buildTournee(panelDoctors, config, today),
    panel: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty, institution: d.institution, city: d.city })),
    produits,
    progress: monthProgress({
      done: visitsThisMonth.length,
      target: target || panelRequiredVisits(panelByTier, config.frequencyByTier),
      panelSize: doctors.length,
      covered: new Set(visitsThisMonth.map((v) => v.doctorId).filter(Boolean)).size,
      today,
    }),
    recentes: recentes.map((v) => ({
      id: v.id, date: v.date,
      doctorName: v.doctor?.name ?? "Praticien",
      produits: v.productLinks.map((l) => l.product.canonicalName),
    })),
    panelVide: doctors.length === 0,
    sansAffectation: assignments.length === 0,
  };
}
