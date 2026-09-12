import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/rbac";
import {
  avancementTournee, echeanceDeSoumission, etatVisite, fenetreDeVue, fenetreRapport, periodeDe,
  retardDeSoumission,
  type AvancementTournee, type EtatVisite, type RetardDeSoumission, type StatutPlan, type VueTournee,
} from "@/lib/sfe/tournee";
import { lireReglageTournee } from "@/lib/sfe/tournee-reglage";

/**
 * L'EMPLOI DU TEMPS D'UN KAM — ce que l'écran affiche, et ce que la Direction compte.
 *
 * ── UN SEUL CALCUL D'AVANCEMENT ─────────────────────────────────────────────────────────────
 *
 * `avancementTournee` (module pur) est appelée ICI, et le tableau de bord de la Direction
 * l'appelle aussi. Deux écrans qui comptent séparément divergent, toujours (§118.51) — et le
 * symptôme serait un KAM à qui l'on reproche un taux que son propre écran ne montre pas.
 *
 * ── LES VISITES SONT DES `MedicalVisit` ─────────────────────────────────────────────────────
 *
 * Planifiée, imprévue ou commandée par la Direction : une seule table, distinguée par
 * `tourPlanId` (nul = hors plan) et `origin`. Le dénominateur de « visitées / planifiées » se lit
 * donc à un seul endroit.
 */

export interface LigneEmploiDuTemps {
  id: string;
  date: Date;
  doctorId: string | null;
  doctorName: string;
  institution: string | null;
  city: string | null;
  specialty: string | null;
  etat: EtatVisite;
  /** D'où vient la visite : `PLAN`, `UNPLANNED`, `DIRECTION`. */
  origine: string;
  objectif: string | null;
  /** Le compte rendu, quand il est fait — l'écran montre qu'il existe, pas seulement une pastille. */
  rapport: string | null;
  produits: string[];
  messages: string[];
  /** Combien d'heures il reste pour rapporter. 0 = fenêtre fermée. */
  heuresRestantes: number;
  /** Un rapport VOCAL est rattaché. */
  vocal: boolean;
}

export interface ProduitDeLaGamme {
  /** L'identifiant du produit CANONIQUE — celui que `MedicalVisitProduct` lie. */
  productId: string;
  name: string;
}

export interface MessagePredefini {
  id: string;
  title: string;
  body: string | null;
  /** La gamme qui le porte, ou `null` = ouvert à toutes. */
  buName: string | null;
}

export interface EmploiDuTemps {
  vue: VueTournee;
  debut: Date;
  fin: Date;
  lignes: LigneEmploiDuTemps[];
  /** L'avancement du MOIS courant — la maille que la Direction lit, quelle que soit la vue. */
  avancementDuMois: AvancementTournee;
  /** Les produits de la BU du KAM, admis dans un rapport. */
  produits: ProduitDeLaGamme[];
  /**
   * LES PRODUITS PROMUS DE SA GAMME QUI N'ONT PAS DE PRODUIT CANONIQUE : ils ne peuvent pas
   * figurer dans un rapport. On les NOMME plutôt que de les laisser disparaître de la liste — un
   * KAM qui cherche « Nivolex » et ne le trouve pas croit à une panne (§118.71).
   */
  produitsIncomplets: string[];
  /** Les messages pré-définis qui s'appliquent à lui. */
  messages: MessagePredefini[];
  /** Le KAM a-t-il une BU ? Sans elle, aucun produit n'est admis et le rapport est impossible. */
  sansBu: boolean;
}

/** Le libellé d'un praticien, avec le repli sur son identifiant plutôt qu'un vide. */
const nomPraticien = (d: { name: string } | null): string => d?.name ?? "(praticien retiré)";

export async function loadEmploiDuTemps(
  user: SessionUser,
  vue: VueTournee,
  maintenant: Date = new Date(),
  repId: string = user.id,
): Promise<EmploiDuTemps> {
  const { debut, fin } = fenetreDeVue(vue, maintenant);
  const mois = periodeDe("MONTH", maintenant);

  const profil = await prisma.salesRepProfile.findUnique({
    where: { repId },
    select: { businessUnitId: true },
  });

  const [visites, visitesDuMois, promus, messages] = await Promise.all([
    prisma.medicalVisit.findMany({
      where: { delegateId: repId, date: { gte: debut, lte: fin } },
      orderBy: [{ date: "asc" }],
      select: {
        id: true, date: true, status: true, origin: true, objective: true, report: true, doctorId: true,
        tourPlanId: true,
        doctor: { select: { name: true, institution: true, city: true, specialty: true } },
        productLinks: { select: { product: { select: { canonicalName: true } } } },
        messageLinks: { select: { message: { select: { title: true } } } },
        fieldReports: { select: { id: true }, take: 1 },
      },
    }),
    // L'AVANCEMENT SE LIT SUR LE MOIS, quelle que soit la vue : « Aujourd'hui » ne dit rien d'un
    // objectif mensuel, et afficher le taux du jour ferait lire 0 % chaque matin.
    prisma.medicalVisit.findMany({
      where: { delegateId: repId, date: { gte: mois.debut, lte: mois.fin } },
      select: { status: true, date: true, report: true, tourPlanId: true },
    }),
    profil?.businessUnitId
      ? prisma.promoProduct.findMany({
          where: { businessUnitId: profil.businessUnitId, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { name: true, productId: true },
        })
      : Promise.resolve([] as { name: string; productId: string | null }[]),
    // LES MESSAGES QUI S'APPLIQUENT : ceux de sa gamme, plus ceux qui n'en visent aucune.
    // « Vide = ouvert à tous » est la convention du dépôt (lecteurs d'annuaire, lecteurs Legal).
    prisma.promoMessage.findMany({
      where: {
        isActive: true,
        OR: [{ businessUnitId: null }, ...(profil?.businessUnitId ? [{ businessUnitId: profil.businessUnitId }] : [])],
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, body: true, businessUnit: { select: { name: true } } },
    }),
  ]);

  const lignes: LigneEmploiDuTemps[] = visites.map((v) => {
    const f = fenetreRapport(v.date, maintenant);
    return {
      id: v.id,
      date: v.date,
      doctorId: v.doctorId,
      doctorName: nomPraticien(v.doctor),
      institution: v.doctor?.institution ?? null,
      city: v.doctor?.city ?? null,
      specialty: v.doctor?.specialty ?? null,
      etat: etatVisite({
        statut: v.status,
        date: v.date,
        rapportFait: Boolean(v.report) || v.fieldReports.length > 0,
        maintenant,
      }),
      origine: String(v.origin),
      objectif: v.objective,
      rapport: v.report,
      produits: v.productLinks.map((l) => l.product.canonicalName),
      messages: v.messageLinks.map((l) => l.message.title),
      heuresRestantes: f.heuresRestantes,
      vocal: v.fieldReports.length > 0,
    };
  });

  return {
    vue, debut, fin, lignes,
    avancementDuMois: avancementTournee(visitesDuMois.map((v) => ({
      etat: etatVisite({ statut: v.status, date: v.date, rapportFait: Boolean(v.report), maintenant }),
      imprevue: v.tourPlanId === null,
    }))),
    produits: promus
      .filter((p): p is { name: string; productId: string } => Boolean(p.productId))
      .map((p) => ({ productId: p.productId, name: p.name })),
    produitsIncomplets: promus.filter((p) => !p.productId).map((p) => p.name),
    messages: messages.map((m) => ({ id: m.id, title: m.title, body: m.body, buName: m.businessUnit?.name ?? null })),
    sansBu: !profil?.businessUnitId,
  };
}

// ─────────────────────────── L'écran de PLANIFICATION ───────────────────────────

export interface PraticienPlanifiable {
  id: string;
  name: string;
  specialty: string | null;
  institution: string | null;
  city: string | null;
  potential: string | null;
  /** Le secteur commercial qui couvre son établissement, quand il y en a un. */
  secteur: string | null;
}

export interface PlanTourneeVue {
  id: string;
  repId: string;
  repName: string;
  periodStart: Date;
  periodEnd: Date;
  granularity: string;
  status: string;
  submissionDueAt: Date;
  submittedAt: Date | null;
  reviewerName: string | null;
  escalatedToName: string | null;
  rejectionComment: string | null;
  resubmitDueAt: Date | null;
  /** Le retard de soumission, calculé UNE fois ici — l'écran l'affiche, il ne le recalcule pas. */
  retard: RetardDeSoumission;
  /** Les paires déjà planifiées, sous la forme `AAAA-MM-JJ|doctorId` que l'écran renvoie. */
  paires: string[];
  /** Les visites du plan DÉJÀ rapportées : elles ne se déplanifient pas. */
  pairesAcquises: string[];
  avancement: AvancementTournee;
}

/**
 * LE PANEL PLANIFIABLE D'UN KAM — les praticiens qu'il peut mettre dans sa tournée.
 *
 * ── D'OÙ VIENNENT LES MÉDECINS ──────────────────────────────────────────────────────────────
 *
 * De son SECTEUR d'abord : le secteur est une sélection d'établissements, et les praticiens de
 * ces établissements sont son territoire. Plus ceux qui lui sont directement rattachés
 * (`delegateId`) — un praticien libéral n'a pas d'hôpital, et l'oublier viderait le panel de
 * toute une gamme de ville.
 *
 * L'union est VOULUE : borner au seul secteur ferait disparaître les libéraux, borner au seul
 * rattachement ferait disparaître l'hôpital que la Direction vient de lui confier. Les deux
 * sources répondent à la même question, et c'est leur réunion qui est le panel.
 */
export async function loadPanelPlanifiable(repId: string): Promise<PraticienPlanifiable[]> {
  const secteurs = await prisma.salesSector.findMany({
    where: { isActive: true, reps: { some: { repId } } },
    select: { name: true, institutions: { select: { institutionId: true } } },
  });
  const institutionIds = [...new Set(secteurs.flatMap((s) => s.institutions.map((i) => i.institutionId)))];
  const secteurParEtab = new Map<string, string>();
  for (const s of secteurs) for (const i of s.institutions) secteurParEtab.set(i.institutionId, s.name);

  const praticiens = await prisma.medicalDoctor.findMany({
    where: {
      OR: [
        { delegateId: repId },
        ...(institutionIds.length > 0 ? [{ institutionId: { in: institutionIds } }] : []),
      ],
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true, name: true, specialty: true, institution: true, city: true, potential: true,
      institutionId: true,
    },
  });
  return praticiens.map((d) => ({
    id: d.id, name: d.name, specialty: d.specialty, institution: d.institution,
    city: d.city, potential: d.potential ? String(d.potential) : null,
    secteur: d.institutionId ? secteurParEtab.get(d.institutionId) ?? null : null,
  }));
}

/** La clé d'une paire jour × praticien, telle que l'écran l'envoie et que l'action la relit. */
export const clePaire = (d: Date, doctorId: string): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}|${doctorId}`;

/** Un plan, tel que l'écran de planification le rend. */
export async function loadPlanTournee(planId: string, maintenant: Date = new Date()): Promise<PlanTourneeVue | null> {
  const p = await prisma.tourPlan.findUnique({
    where: { id: planId },
    select: {
      id: true, repId: true, periodStart: true, periodEnd: true, granularity: true, status: true,
      submissionDueAt: true, submittedAt: true, rejectionComment: true, resubmitDueAt: true,
      rep: { select: { name: true } },
      reviewer: { select: { name: true } },
      escalatedTo: { select: { name: true } },
      visits: { select: { id: true, date: true, doctorId: true, status: true, report: true, tourPlanId: true } },
    },
  });
  if (!p) return null;
  const acquises = p.visits.filter((v) => v.status !== "PLANNED");
  return {
    id: p.id, repId: p.repId, repName: p.rep.name,
    periodStart: p.periodStart, periodEnd: p.periodEnd,
    granularity: String(p.granularity), status: String(p.status),
    submissionDueAt: p.submissionDueAt, submittedAt: p.submittedAt,
    reviewerName: p.reviewer?.name ?? null,
    escalatedToName: p.escalatedTo?.name ?? null,
    rejectionComment: p.rejectionComment,
    resubmitDueAt: p.resubmitDueAt,
    retard: retardDeSoumission({
      statut: String(p.status) as StatutPlan, echeance: p.submissionDueAt, resoumissionAvant: p.resubmitDueAt, maintenant,
    }),
    paires: p.visits.filter((v) => v.doctorId).map((v) => clePaire(v.date, v.doctorId!)),
    pairesAcquises: acquises.filter((v) => v.doctorId).map((v) => clePaire(v.date, v.doctorId!)),
    avancement: avancementTournee(p.visits.map((v) => ({
      etat: etatVisite({ statut: v.status, date: v.date, rapportFait: Boolean(v.report), maintenant }),
      imprevue: v.tourPlanId === null,
    }))),
  };
}

// ─────────────────────────── Le tableau de bord de la Direction ───────────────────────────

export interface LigneTourneeDirection {
  repId: string;
  repName: string;
  buName: string | null;
  /** L'état du plan de la période, ou `null` si aucun plan n'existe. */
  statutPlan: string | null;
  /**
   * LE RETARD DE SOUMISSION. Un KAM SANS plan se juge comme un brouillon jamais soumis, sur
   * l'échéance que la période AURAIT eue au réglage du jour : c'est ainsi que la Direction voit
   * qui n'a rien ouvert alors que l'échéance est passée — et non un 0/0 qui se lit « rien à
   * faire ». Un plan SOUMIS n'est jamais en retard (le temps de décision n'est pas le sien).
   */
  retard: RetardDeSoumission;
  avancement: AvancementTournee;
}

export interface TourneeDirection {
  debut: Date;
  fin: Date;
  lignes: LigneTourneeDirection[];
  /** Le total de la portée — la SOMME des lignes, jamais un second calcul. */
  total: AvancementTournee;
  /** Combien de KAM de la portée n'ont AUCUN plan sur la période. */
  sansPlan: number;
  /** Combien de KAM ont un plan ENCORE À SOUMETTRE (ou aucun plan) alors que l'échéance est passée. */
  enRetard: number;
}

/**
 * « VISITÉES / PLANIFIÉES » ET « LE NOMBRE DE VISITES » — ce que la Direction demande.
 *
 * ── LE MÊME CALCUL QUE L'ÉCRAN DU KAM ───────────────────────────────────────────────────────
 *
 * `avancementTournee` est appelée ici et dans `loadEmploiDuTemps` : c'est la même fonction sur
 * les mêmes faits. Deux écrans qui comptent séparément divergent, toujours (§118.51) — et le
 * symptôme serait un KAM à qui l'on reproche un taux que son propre écran ne montre pas. Un test
 * compare les deux.
 *
 * ── CE QUI N'EST PAS LE MÊME « PLANIFIÉ » ───────────────────────────────────────────────────
 *
 * Le cockpit SFE porte déjà un `plannedVisits` : c'est la CAPACITÉ cible d'un KAM (jours × visites
 * par jour × part terrain), une prévision de charge. Ici, « planifiées » désigne les visites
 * NOMMÉES d'un plan de tournée — un praticien, un jour. Les deux nombres sont légitimes et
 * différents ; les afficher côte à côte sans le dire ferait douter des deux, d'où la phrase que
 * l'écran porte.
 *
 * ── LE TOTAL EST LA SOMME DES LIGNES ────────────────────────────────────────────────────────
 *
 * Recalculé à part, il divergerait de ce que la Direction voit ligne par ligne — et c'est le
 * total qu'elle citerait en réunion.
 */
export async function loadTourneeDirection(
  repIds: readonly string[],
  debut: Date,
  fin: Date,
  maintenant: Date = new Date(),
): Promise<TourneeDirection> {
  if (repIds.length === 0) {
    return { debut, fin, lignes: [], total: avancementTournee([]), sansPlan: 0, enRetard: 0 };
  }
  const [visites, plans, kams, reglage] = await Promise.all([
    prisma.medicalVisit.findMany({
      where: { delegateId: { in: [...repIds] }, date: { gte: debut, lte: fin } },
      select: { delegateId: true, status: true, date: true, report: true, tourPlanId: true },
    }),
    prisma.tourPlan.findMany({
      where: { repId: { in: [...repIds] }, periodStart: { lte: fin }, periodEnd: { gte: debut } },
      select: { repId: true, status: true, periodStart: true, submissionDueAt: true, resubmitDueAt: true },
      orderBy: { periodStart: "desc" },
    }),
    prisma.user.findMany({
      where: { id: { in: [...repIds] } },
      select: { id: true, name: true },
    }),
    // LE RÉGLAGE DU JOUR ne sert qu'aux KAM SANS plan : un plan existant porte son échéance
    // figée à la création (§118.107), et c'est elle qu'on juge.
    lireReglageTournee(),
  ]);
  // LA BU DU KAM SE CHARGE À PART : `SalesRepProfile.repId` est un `String` sans relation vers
  // `User` — la convention de tout ce voisinage (`SalesRepMonthlyKpi`, `PromotionAssignment`).
  // On ne l'invente pas ici : ajouter la relation serait une migration de schéma pour une
  // jointure de confort, et l'empreinte dépasserait la demande (§118.16).
  const profils = await prisma.salesRepProfile.findMany({
    where: { repId: { in: [...repIds] } },
    select: { repId: true, businessUnit: { select: { name: true } } },
  });
  const buParRep = new Map(profils.map((p) => [p.repId, p.businessUnit?.name ?? null]));

  const parRep = new Map<string, { etat: EtatVisite; imprevue: boolean }[]>();
  for (const v of visites) {
    if (!v.delegateId) continue;
    const l = parRep.get(v.delegateId) ?? [];
    l.push({
      etat: etatVisite({ statut: v.status, date: v.date, rapportFait: Boolean(v.report), maintenant }),
      imprevue: v.tourPlanId === null,
    });
    parRep.set(v.delegateId, l);
  }
  // LE PLAN LE PLUS RÉCENT qui touche la fenêtre — un par KAM (`orderBy` décroissant, premier gardé).
  const planParRep = new Map<string, (typeof plans)[number]>();
  for (const p of plans) if (!planParRep.has(p.repId)) planParRep.set(p.repId, p);
  // L'ÉCHÉANCE QU'AURAIT EUE LE PLAN MANQUANT : celle de la période, à la maille réglée, qui
  // contient le début de la fenêtre. Sans elle, un KAM sans plan ne serait jamais « en retard »
  // — il n'aurait simplement rien, et rien ne se lit comme rien à faire.
  const echeanceSansPlan = echeanceDeSoumission(periodeDe(reglage.granularite, debut).debut, reglage.joursAvant);

  const lignes: LigneTourneeDirection[] = kams
    .map((k) => {
      const plan = planParRep.get(k.id) ?? null;
      return {
        repId: k.id,
        repName: k.name,
        buName: buParRep.get(k.id) ?? null,
        statutPlan: plan ? String(plan.status) : null,
        retard: plan
          ? retardDeSoumission({
            statut: String(plan.status) as StatutPlan, echeance: plan.submissionDueAt, resoumissionAvant: plan.resubmitDueAt, maintenant,
          })
          : retardDeSoumission({ statut: "DRAFT", echeance: echeanceSansPlan, maintenant }),
        avancement: avancementTournee(parRep.get(k.id) ?? []),
      };
    })
    .sort((a, b) => (a.buName ?? "").localeCompare(b.buName ?? "", "fr") || a.repName.localeCompare(b.repName, "fr"));

  // LE TOTAL EST LA SOMME DES LIGNES — recalculé à part, il divergerait de ce que la Direction
  // lit ligne par ligne, et c'est le total qu'elle citerait en réunion (§118.51).
  const total = lignes.reduce<AvancementTournee>((acc, l) => ({
    planifiees: acc.planifiees + l.avancement.planifiees,
    visitees: acc.visitees + l.avancement.visitees,
    perdues: acc.perdues + l.avancement.perdues,
    aFaire: acc.aFaire + l.avancement.aFaire,
    ecartees: acc.ecartees + l.avancement.ecartees,
    imprevues: acc.imprevues + l.avancement.imprevues,
    visitesTotales: acc.visitesTotales + l.avancement.visitesTotales,
    tauxRealisation: 0,
  }), avancementTournee([]));
  // LE TAUX SE RECALCULE SUR LES TOTAUX, jamais comme une moyenne des taux : la moyenne
  // donnerait le même poids à un KAM de 4 visites et à un KAM de 40.
  total.tauxRealisation = total.planifiees > 0 ? Math.round((total.visitees / total.planifiees) * 100) : 0;

  return {
    debut, fin, lignes, total,
    sansPlan: lignes.filter((l) => l.statutPlan === null).length,
    enRetard: lignes.filter((l) => l.retard.enRetard).length,
  };
}
