import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PORT DU PLAN DE TOURNÉE — ce par quoi Adam atteint la planification de la force de vente.
 *
 * ── POURQUOI CE FICHIER EXISTE, ET C'EST LE CLIQUET QUI L'A DIT ──────────────────────────
 *
 * La première version branchait `ops/impl-tournee.ts` directement sur `@/lib/actions/*`,
 * `@/lib/prisma` et `@/lib/sfe/tournee`. `boundary.test.ts` a compté 433 franchissements pour
 * un plafond de 428 et refusé — le MÊME refus, au MÊME chiffre, que celui qui avait déjà eu
 * raison sur le chemin générique (`in-process/capacites`) et sur le catalogue de colonnes
 * Regulatory (§118.72). Mesuré fichier par fichier : les cinq venaient d'un seul fichier, le
 * mien, et d'aucun autre — accuser autre chose aurait été le défaut de §118.114.
 *
 * Relever le plafond aurait été une ligne. Ç'aurait aussi été admettre qu'Adam connaît le
 * dossier `actions/` de l'ERP et le nom de ses tables, alors que tout le contrat de plateforme
 * existe pour l'en empêcher. Le remède est celui que le message d'échec nomme.
 *
 * ── LA LIGNE DE PARTAGE : LA TABLE ICI, LA POLITIQUE LÀ-BAS ──────────────────────────────
 *
 * Les quatre recherches ci-dessous vivaient dans les ops d'Adam. Ce qu'elles portent est du
 * savoir d'ERP — QUELLE table, QUELLES colonnes, comment on ÉTIQUETTE une ligne pour un humain
 * (« Nivolex (BU Oncologie) », parce que deux BU peuvent porter un message du même intitulé).
 * Elles descendent donc du côté ERP de la frontière.
 *
 * Ce qui RESTE chez Adam est la POLITIQUE de résolution : exact → unique → ambiguïté LISTÉE,
 * jamais « le premier des quatre » (§104.7, `resolveOne`). C'est une règle d'Adam, éprouvée par
 * ses tests, et la faire descendre ici l'aurait dupliquée — deux résolutions du même nom
 * finissent par choisir différemment (§118.5), et le symptôme serait une carte qui propose une
 * personne et une action qui en touche une autre.
 *
 * Deux questions, deux endroits. Les confondre était le franchissement.
 *
 * ── CE QUE CE PORT N'AJOUTE PAS ──────────────────────────────────────────────────────────
 *
 * Aucune vérification de droits. Y en glisser une en ferait une seconde vérité qui prendrait du
 * retard sur l'action (§118.5), et c'est la version en retard qui serait la faille. Les droits
 * vivent dans les server actions réexportées ici, qui revalident TOUT — le port rejoue le clic
 * de l'écran, il n'ouvre pas une porte à côté (§118.74).
 *
 * Et il ne réexporte PAS `prisma`. Une porte qui rend l'accès brut à la base ne serait pas un
 * port, ce serait la frontière contournée par le fichier qui a pour rôle de la tenir.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

// ── LES DÉCISIONS PURES DU PLAN DE TOURNÉE ────────────────────────────────────────────────
// Granularités, périodes, échéances, états d'une visite, avancement. Module PUR, testé à part
// (`sfe/tournee.test.ts`) : le port ne fait que le rendre atteignable sans traverser.
export {
  GRANULARITES, GRANULARITE_LABELS, JOURS_AVANT_ECHEANCE_MAX, STATUT_PLAN_LABELS, avancementTournee, estGranularite, etatVisite,
  periodeDe, periodeSuivante,
  type Granularite, type ReglageTournee, type StatutPlan,
} from "@/lib/sfe/tournee";
// LE RÉGLAGE EN VIGUEUR — le même lecteur que l'action et les écrans (§118.5) : sans lui, l'op
// « open_tour_plan » forçait MONTH quand la phrase ne nommait pas de maille, et Adam ouvrait un
// plan mensuel dans une entreprise réglée au trimestre.
export { lireReglageTournee } from "@/lib/sfe/tournee-reglage";

// ── LES ÉCRITURES ─────────────────────────────────────────────────────────────────────────
// Les server actions de l'écran, telles quelles. Les quatre qui restent réservées à un clic
// humain (décider, rapporter, visite imprévue, remplacer la grille) ne sont PAS ici — leur
// absence est la garde, et `impl-tournee.ts` dit pourquoi, une raison par action.
export { ouvrirPlanTournee, soumettrePlanTournee, escaladerPlanTournee } from "@/lib/actions/tour-plan-actions";
export { saveTourPlanningSettings } from "@/lib/actions/sales-planning-actions";
export { commanderVisite } from "@/lib/actions/tour-visit-actions";
export { createPromoMessage, updatePromoMessage, deletePromoMessage } from "@/lib/actions/promo-message-actions";

/** Une ligne candidate : son identifiant, et l'étiquette qu'un humain lit. */
export interface CandidatTournee {
  id: string;
  label: string;
}

const CANDIDATS_MAX = 6;

/** Les KAM actifs dont le nom contient la saisie. */
export async function chercherKam(q: string): Promise<CandidatTournee[]> {
  const rows = await prisma.user.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isActive: true },
    select: { id: true, name: true }, take: CANDIDATS_MAX,
  });
  return rows.map((u) => ({ id: u.id, label: u.name }));
}

/** Les praticiens dont le nom contient la saisie — la VILLE est dans l'étiquette, parce que
 *  deux médecins homonymes dans deux wilayas ne se distinguent que par elle. */
export async function chercherPraticien(q: string): Promise<CandidatTournee[]> {
  const rows = await prisma.medicalDoctor.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, city: true }, take: CANDIDATS_MAX,
  });
  return rows.map((d) => ({ id: d.id, label: d.city ? `${d.name} (${d.city})` : d.name }));
}

/** Les Business Units dont le nom contient la saisie. */
export async function chercherBusinessUnit(q: string): Promise<CandidatTournee[]> {
  const rows = await prisma.businessUnit.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true }, take: CANDIDATS_MAX,
  });
  return rows.map((b) => ({ id: b.id, label: b.name }));
}

/** Les messages pré-définis dont l'intitulé contient la saisie. DEUX BU peuvent porter le même
 *  intitulé : sans la BU dans l'étiquette, la liste d'ambiguïté afficherait deux fois le même
 *  mot et ne lèverait rien. */
export async function chercherMessagePromo(q: string): Promise<CandidatTournee[]> {
  const rows = await prisma.promoMessage.findMany({
    where: { title: { contains: q, mode: "insensitive" } },
    select: { id: true, title: true, businessUnit: { select: { name: true } } }, take: CANDIDATS_MAX,
  });
  return rows.map((m) => ({ id: m.id, label: m.businessUnit ? `${m.title} (BU ${m.businessUnit.name})` : m.title }));
}

/**
 * LE MESSAGE TEL QU'IL EST AUJOURD'HUI — tous les champs que l'action réécrit.
 *
 * L'action de mise à jour réécrit la ligne ENTIÈRE : sans relire l'existant pour le REJOUER,
 * « renomme ce message » effacerait son texte, sa gamme et son rang. C'est pourquoi ce lecteur
 * rend le tuple complet et non le seul intitulé.
 */
export async function lireMessagePromo(id: string): Promise<
  | { title: string; body: string | null; businessUnitId: string | null; productId: string | null; sortOrder: number; isActive: boolean }
  | null
> {
  return prisma.promoMessage.findUnique({
    where: { id },
    select: { title: true, body: true, businessUnitId: true, productId: true, sortOrder: true, isActive: true },
  });
}

/**
 * CE QU'UN RETRAIT EMPORTE — l'intitulé, et COMBIEN de rapports terrain le portent.
 *
 * Le compte est la CONSÉQUENCE que la carte doit montrer : supprimer un message que quarante
 * comptes rendus citent n'est pas le même geste que supprimer un brouillon (§104.7).
 */
export async function lireMessagePromoAvantRetrait(id: string): Promise<{ title: string; rapportsLies: number } | null> {
  const m = await prisma.promoMessage.findUnique({
    where: { id },
    select: { title: true, _count: { select: { visitLinks: true } } },
  });
  return m ? { title: m.title, rapportsLies: m._count.visitLinks } : null;
}

/** Un plan candidat, avec ce qu'il faut pour le NOMMER et en mesurer l'avancement. */
export interface PlanCandidat {
  id: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  submissionDueAt: Date;
  repName: string;
  visites: { status: string; date: Date; tourPlanId: string | null; report: string | null }[];
}

/**
 * LES PLANS QUI CORRESPONDENT À UNE PHRASE — un KAM, une date, ou ni l'un ni l'autre.
 *
 * On rend jusqu'à SIX lignes et jamais une seule : c'est l'appelant qui décide, et sa règle est
 * qu'une correspondance unique passe tandis que plusieurs se LISTENT (§104.7). Collapser ici
 * choisirait le plan à modifier à la place d'un humain.
 */
export async function chercherPlansTournee(
  repId: string | null,
  date: Date | null,
): Promise<PlanCandidat[]> {
  const rows = await prisma.tourPlan.findMany({
    where: {
      ...(repId ? { repId } : {}),
      ...(date ? { periodStart: { lte: date }, periodEnd: { gte: date } } : {}),
    },
    orderBy: { periodStart: "desc" },
    take: CANDIDATS_MAX,
    select: {
      id: true, status: true, periodStart: true, periodEnd: true, submissionDueAt: true,
      rep: { select: { name: true } },
      visits: { select: { status: true, date: true, tourPlanId: true, report: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id, status: String(p.status),
    periodStart: p.periodStart, periodEnd: p.periodEnd, submissionDueAt: p.submissionDueAt,
    repName: p.rep.name,
    visites: p.visits.map((v) => ({ status: String(v.status), date: v.date, tourPlanId: v.tourPlanId, report: v.report })),
  }));
}
