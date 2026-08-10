import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";
import { canViewEnvelope, type SessionUser } from "@/lib/rbac";

/** Une enveloppe est visible d'un non-gestionnaire seulement si l'admin lui a ouvert la
 *  visualisation (rôle/personne) ou lui a délégué la gestion — sinon invisible (strict). */
function envelopeVisible(user: SessionUser, e: { accessRoles: string[]; accessUserIds?: string[]; managerRoles?: string[]; managerUserIds?: string[] }): boolean {
  return canViewEnvelope(user, e);
}

/**
 * Budget « enveloppe » : un total défini par la Direction, réparti en catégories,
 * dont la consommation est calculée à partir des dépenses réelles
 * (FinanceTransaction OUT) attribuées à chaque catégorie, sur une période choisie.
 */

export type BudgetHealth = "ON_TRACK" | "AT_RISK" | "OVER_BUDGET" | "NONE";

export interface BudgetCategoryView {
  id: string;
  name: string;
  module: string | null;
  parentId: string | null;
  color: string | null;
  notes: string | null;
  allocated: number;
  consumed: number;
  committed: number;
  remaining: number;
  pct: number;
  health: BudgetHealth;
}

export interface UnattributedTx {
  id: string;
  reference: string;
  date: string;
  label: string;
  amount: number;
  category: string;
  counterparty: string | null;
  status: string;
}

/**
 * Dépense DÉJÀ imputée à une catégorie de l'enveloppe. Deux origines :
 * - `FINANCE` : une vraie dépense de trésorerie (FinanceTransaction OUT) que la Direction a
 *   attribuée à la catégorie → RÉ-ATTRIBUABLE (elle se supprime, elle, dans les Finances) ;
 * - `BUDGET` : une ligne purement budgétaire saisie ici (BudgetExpenseLine), sans impact sur
 *   la trésorerie → SUPPRIMABLE directement depuis le module Budget.
 */
export interface AttributedTx {
  id: string;
  kind: "FINANCE" | "BUDGET";
  reference: string;
  date: string;
  label: string;
  amount: number;
  counterparty: string | null;
  status: string;
  categoryId: string;
  categoryName: string;
}

export interface BudgetEnvelopeOption {
  id: string;
  name: string;
  module: string | null;
  modules: string[];
  accessRoles: string[];
  accessUserIds: string[];
  managerRoles: string[];
  managerUserIds: string[];
  periodStart: string;
  periodEnd: string;
  total: number;
  isActive: boolean;
}

/** Ligne d'une enveloppe dans la vue consolidée (« total des enveloppes »). */
export interface EnvelopeSummaryItem {
  id: string;
  name: string;
  isActive: boolean;
  modules: string[];
  total: number;
  allocated: number;
  consumed: number;
  remaining: number;
}

export interface EnvelopesGrandTotal {
  count: number;
  total: number;
  allocated: number;
  consumed: number;
  remaining: number;
  items: EnvelopeSummaryItem[];
}

/**
 * Un mois de la période : ce qui a été consommé, le cumul depuis le début, et le **rythme
 * théorique** au même instant (budget dépensé régulièrement). Au-dessus du rythme = on
 * dépense trop vite — c'est toute la lecture de la courbe.
 */
export interface BudgetMonthPoint {
  month: string; // « 2026-03 »
  label: string; // « mars »
  consumed: number;
  cumulative: number;
  expected: number;
}

export interface BudgetOverview {
  envelope: { id: string; name: string; module: string | null; modules: string[]; accessRoles: string[]; accessUserIds: string[]; managerRoles: string[]; managerUserIds: string[]; periodStart: string; periodEnd: string; total: number; notes: string | null; isActive: boolean };
  period: { from: string; to: string };
  categories: BudgetCategoryView[];
  totals: { total: number; allocated: number; unallocated: number; consumed: number; committed: number; remaining: number; pct: number };
  /** Consommation mois par mois (courbe de la vue d'ensemble). */
  monthly: BudgetMonthPoint[];
  unattributed: { total: number; count: number; transactions: UnattributedTx[] };
  attributed: { count: number; transactions: AttributedTx[] };
}

const MONTH_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * Répartit la consommation par mois et calcule le rythme théorique.
 * Fonction PURE (les dates arrivent déjà lues) : c'est elle qui est testée, pas la requête.
 */
export function buildMonthlySeries(
  from: Date, to: Date, total: number, entries: { date: Date; amount: number }[],
): BudgetMonthPoint[] {
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const months: { month: string; label: string }[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  // Garde-fou : une période aberrante ne doit pas produire des milliers de points.
  while (cur <= end && months.length < 60) {
    months.push({ month: key(cur), label: MONTH_FR[cur.getUTCMonth()] });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  if (months.length === 0) return [];

  const byMonth = new Map<string, number>();
  for (const e of entries) byMonth.set(key(e.date), (byMonth.get(key(e.date)) ?? 0) + e.amount);

  let running = 0;
  return months.map((m, i) => {
    const consumed = byMonth.get(m.month) ?? 0;
    running += consumed;
    return {
      month: m.month,
      label: m.label,
      consumed,
      cumulative: running,
      // Rythme théorique : le budget réparti également sur les mois de la période.
      expected: Math.round((total * (i + 1)) / months.length),
    };
  });
}

function health(allocated: number, consumed: number): BudgetHealth {
  if (allocated <= 0) return "NONE";
  const pct = consumed / allocated;
  if (pct >= 1) return "OVER_BUDGET";
  if (pct >= 0.8) return "AT_RISK";
  return "ON_TRACK";
}

export async function getEnvelopes(viewer: SessionUser): Promise<BudgetEnvelopeOption[]> {
  const list = await prisma.budgetEnvelope.findMany({ where: await platformScope(viewer.id), orderBy: [{ isActive: "desc" }, { periodStart: "desc" }] });
  return list
    .filter((e) => envelopeVisible(viewer, e))
    .map((e) => ({ id: e.id, name: e.name, module: e.module, modules: e.modules, accessRoles: e.accessRoles, accessUserIds: e.accessUserIds, managerRoles: e.managerRoles, managerUserIds: e.managerUserIds, periodStart: e.periodStart.toISOString(), periodEnd: e.periodEnd.toISOString(), total: toNumber(e.totalAmount), isActive: e.isActive }));
}

/**
 * Vue consolidée « total des enveloppes » : agrège TOUTES les enveloppes que le
 * spectateur est autorisé à voir (le gestionnaire les voit toutes ; les autres ne
 * voient que celles ouvertes par le Super Admin à leur rôle ou à eux-mêmes). La
 * consommation par enveloppe est la somme des dépenses réelles (OUT réglées)
 * attribuées à ses catégories. L'alloué ne compte que les catégories de 1er niveau.
 */
export async function getEnvelopesGrandTotal(viewer: SessionUser): Promise<EnvelopesGrandTotal> {
  const envelopes = await prisma.budgetEnvelope.findMany({
    where: await platformScope(viewer.id),
    orderBy: [{ isActive: "desc" }, { periodStart: "desc" }],
    include: { categories: { select: { id: true, allocated: true, parentId: true } } },
  });
  const visible = envelopes.filter((e) => envelopeVisible(viewer, e));

  const catIds = visible.flatMap((e) => e.categories.map((c) => c.id));
  const [sums, expenseSums] = catIds.length
    ? await Promise.all([
        prisma.financeTransaction.groupBy({
          by: ["budgetCategoryId"],
          where: { direction: "OUT", status: "SETTLED", budgetCategoryId: { in: catIds } },
          _sum: { amount: true },
        }),
        prisma.budgetExpenseLine.groupBy({
          by: ["categoryId"],
          where: { categoryId: { in: catIds } },
          _sum: { amount: true },
        }),
      ])
    : [[], []];
  // Consommation = dépenses réglées attribuées + lignes purement budgétaires (découplées).
  const consumedByCat = new Map<string | null, number>(sums.map((s) => [s.budgetCategoryId, toNumber(s._sum.amount)]));
  for (const s of expenseSums) {
    consumedByCat.set(s.categoryId, (consumedByCat.get(s.categoryId) ?? 0) + toNumber(s._sum.amount));
  }

  const items: EnvelopeSummaryItem[] = visible.map((e) => {
    const total = toNumber(e.totalAmount);
    const allocated = e.categories.filter((c) => c.parentId === null).reduce((a, c) => a + toNumber(c.allocated), 0);
    const consumed = e.categories.reduce((a, c) => a + (consumedByCat.get(c.id) ?? 0), 0);
    return { id: e.id, name: e.name, isActive: e.isActive, modules: e.modules, total, allocated, consumed, remaining: total - consumed };
  });

  const total = items.reduce((a, i) => a + i.total, 0);
  const allocated = items.reduce((a, i) => a + i.allocated, 0);
  const consumed = items.reduce((a, i) => a + i.consumed, 0);
  return { count: items.length, total, allocated, consumed, remaining: total - consumed, items };
}

export interface BudgetCategoryOption { id: string; label: string; isSub: boolean }

/**
 * Options de **(sous-)catégories** budgétaires proposées à la Direction pour attribuer
 * une dépense à la validation définitive. Priorité aux enveloppes actives couvrant le
 * module ; sinon toutes les enveloppes actives. Le libellé montre le chemin complet
 * « Enveloppe › Catégorie › Sous-catégorie ».
 *
 * `viewer` (la Direction qui décide) RESTREINT aux enveloppes qui lui sont accessibles
 * — décidées par le Super Admin (rôle ou personne). Omis = toutes les enveloppes actives
 * (rétrocompatible / contexte purement serveur).
 */
export async function getBudgetCategoryOptions(module?: string | string[], viewer?: SessionUser): Promise<BudgetCategoryOption[]> {
  const envelopes = await prisma.budgetEnvelope.findMany({
    where: { isActive: true },
    include: { categories: { orderBy: { name: "asc" } } },
    orderBy: [{ periodStart: "desc" }],
  });
  // Enveloppes ACCESSIBLES au décideur (le Super Admin ouvre l'accès à la Direction).
  const accessible = viewer ? envelopes.filter((e) => envelopeVisible(viewer, e)) : envelopes;
  // Accepte un module OU une famille de modules (ex. tout Ad & Pro) : la dépense peut
  // être imputée à n'importe quelle enveloppe couvrant la famille, pas seulement le
  // module exact d'où vient la demande.
  const wanted = module ? (Array.isArray(module) ? module : [module]) : null;
  const relevant = wanted ? accessible.filter((e) => wanted.some((m) => e.modules.includes(m) || e.module === m)) : accessible;
  const list = relevant.length ? relevant : accessible;
  const out: BudgetCategoryOption[] = [];
  for (const env of list) {
    const tops = env.categories.filter((c) => c.parentId === null);
    for (const top of tops) {
      out.push({ id: top.id, label: `${env.name} › ${top.name}`, isSub: false });
      for (const sub of env.categories.filter((c) => c.parentId === top.id)) {
        out.push({ id: sub.id, label: `${env.name} › ${top.name} › ${sub.name}`, isSub: true });
      }
    }
  }
  return out;
}

/** Synthèse budgétaire d'une enveloppe sur une période (par défaut la période de l'enveloppe). */
export async function getBudgetOverview(
  viewer: SessionUser,
  envelopeId: string | null,
  fromArg?: Date | null,
  toArg?: Date | null,
): Promise<BudgetOverview | null> {
  // Sélection de l'enveloppe à afficher :
  //  • enveloppe explicitement demandée (sélecteur) → on la charge telle quelle ;
  //  • vue PAR DÉFAUT (aucun `env`) → la plus récente enveloppe VISIBLE PAR LE SPECTATEUR,
  //    et NON l'enveloppe globale la plus récente. Sinon un compte à qui l'on n'a ouvert
  //    qu'une enveloppe « secondaire » (ex. Ad & Pro) tomberait sur l'enveloppe par défaut
  //    (une autre, plus récente, qui lui est fermée) → `null` → écran « aucune enveloppe »,
  //    alors même que l'enveloppe qui lui est ouverte figure bien dans le sélecteur. On
  //    reprend l'ordre de `getEnvelopes` (actives d'abord, puis récence) pour que l'enveloppe
  //    ouverte par défaut soit exactement la 1re du sélecteur.
  let envelope;
  if (envelopeId) {
    envelope = await prisma.budgetEnvelope.findUnique({ where: { id: envelopeId }, include: { categories: { orderBy: { name: "asc" } } } });
  } else {
    const candidates = await prisma.budgetEnvelope.findMany({
      orderBy: [{ isActive: "desc" }, { periodStart: "desc" }],
      include: { categories: { orderBy: { name: "asc" } } },
    });
    envelope = candidates.find((e) => envelopeVisible(viewer, e)) ?? null;
  }
  if (!envelope) return null;
  // Accès : un non-gestionnaire ne peut ouvrir qu'une enveloppe qui lui est ouverte
  // (garde-fou pour le cas d'une enveloppe explicitement demandée via `env`).
  if (!envelopeVisible(viewer, envelope)) return null;

  const from = fromArg ?? envelope.periodStart;
  const to = toArg ?? envelope.periodEnd;

  const catIds = envelope.categories.map((c) => c.id);
  // ⚠️ FILTRE SUR LES CATÉGORIES DE **CETTE** ENVELOPPE — la faute qui gonflait le consommé.
  // Sans lui, le groupBy ramenait TOUTES les dépenses de la plateforme : celles imputées aux
  // enveloppes VOISINES et celles ENCORE NON IMPUTÉES (clé `null`). Le total (ligne « consommé »)
  // additionnant toutes les valeurs de la table, une enveloppe Ad & Pro de quelques millions
  // affichait la consommation de l'entreprise entière — d'où les « 42 millions consommés »
  // impossibles. Chaque enveloppe ne compte QUE ses propres catégories ; le non-imputé a sa
  // propre alerte (« à imputer »), il ne doit jamais peser dans une enveloppe qui ne l'a pas reçu.
  const [sums, expenseSums] = await Promise.all([
    catIds.length
      ? prisma.financeTransaction.groupBy({
          by: ["budgetCategoryId", "status"],
          where: { direction: "OUT", date: { gte: from, lte: to }, status: { in: ["SETTLED", "PENDING"] }, budgetCategoryId: { in: catIds } },
          _sum: { amount: true },
        })
      : Promise.resolve([] as { budgetCategoryId: string | null; status: string; _sum: { amount: unknown } }[]),
    // Lignes purement budgétaires (découplées des Finances) imputées aux catégories de l'enveloppe.
    catIds.length
      ? prisma.budgetExpenseLine.groupBy({
          by: ["categoryId"],
          where: { categoryId: { in: catIds }, date: { gte: from, lte: to } },
          _sum: { amount: true },
        })
      : Promise.resolve([] as { categoryId: string; _sum: { amount: unknown } }[]),
  ]);

  const consumedByCat = new Map<string | null, number>();
  const committedByCat = new Map<string | null, number>();
  for (const s of sums) {
    const amt = toNumber(s._sum.amount);
    const map = s.status === "SETTLED" ? consumedByCat : committedByCat;
    map.set(s.budgetCategoryId, (map.get(s.budgetCategoryId) ?? 0) + amt);
  }
  // Les lignes budgétaires comptent comme consommation (au même titre que les dépenses réglées).
  for (const s of expenseSums) {
    const amt = toNumber(s._sum.amount as Parameters<typeof toNumber>[0]);
    consumedByCat.set(s.categoryId, (consumedByCat.get(s.categoryId) ?? 0) + amt);
  }

  const categories: BudgetCategoryView[] = envelope.categories.map((c) => {
    const allocated = toNumber(c.allocated);
    const consumed = consumedByCat.get(c.id) ?? 0;
    const committed = committedByCat.get(c.id) ?? 0;
    return {
      id: c.id, name: c.name, module: c.module, parentId: c.parentId, color: c.color, notes: c.notes,
      allocated, consumed, committed,
      remaining: allocated - consumed,
      pct: allocated > 0 ? Math.round((consumed / allocated) * 100) : 0,
      health: health(allocated, consumed),
    };
  });

  const total = toNumber(envelope.totalAmount);
  // L'alloué de l'enveloppe ne compte que les catégories de 1er niveau (les
  // sous-catégories sont une répartition À L'INTÉRIEUR de leur catégorie parente).
  const allocated = categories.filter((c) => c.parentId === null).reduce((a, c) => a + c.allocated, 0);
  const consumedTotal = [...consumedByCat.values()].reduce((a, v) => a + v, 0);
  const committedTotal = [...committedByCat.values()].reduce((a, v) => a + v, 0);

  // NON IMPUTÉ : compté À PART, jamais dans le consommé de l'enveloppe (c'est une dépense qui
  // n'a pas encore trouvé sa catégorie — l'imputer plus tard la fera entrer dans UNE enveloppe).
  // Total et compte EXACTS via un agrégat, indépendants des 30 lignes affichées.
  const [unattributedAgg, unattributedTx] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: { direction: "OUT", budgetCategoryId: null, date: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.financeTransaction.findMany({
      where: { direction: "OUT", budgetCategoryId: null, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
      take: 30,
      select: { id: true, reference: true, date: true, label: true, amount: true, category: true, counterparty: true, status: true },
    }),
  ]);
  const unattributedTotal = toNumber(unattributedAgg._sum.amount);

  // Dépenses DÉJÀ imputées à une catégorie de CETTE enveloppe. Deux origines fusionnées :
  // les vraies dépenses de trésorerie (FinanceTransaction, ré-attribuables) et les lignes
  // purement budgétaires (BudgetExpenseLine, supprimables ici).
  const catNameById = new Map(envelope.categories.map((c) => [c.id, c.name]));
  const [financeAttr, expenseAttr] = catNameById.size
    ? await Promise.all([
        prisma.financeTransaction.findMany({
          where: { direction: "OUT", budgetCategoryId: { in: [...catNameById.keys()] }, date: { gte: from, lte: to } },
          orderBy: { date: "desc" },
          take: 60,
          select: { id: true, reference: true, date: true, label: true, amount: true, counterparty: true, status: true, budgetCategoryId: true },
        }),
        prisma.budgetExpenseLine.findMany({
          where: { categoryId: { in: [...catNameById.keys()] }, date: { gte: from, lte: to } },
          orderBy: { date: "desc" },
          take: 60,
          select: { id: true, reference: true, date: true, amount: true, categoryId: true },
        }),
      ])
    : [[], []];
  // Série mensuelle (courbe) : on relit les seules dates + montants CONSOMMÉS de l'enveloppe,
  // sans plafond de lignes — la courbe doit couvrir toute la période, pas les 60 dernières.
  const [monthlyFinance, monthlyLines] = catNameById.size
    ? await Promise.all([
        prisma.financeTransaction.findMany({
          where: { direction: "OUT", status: "SETTLED", budgetCategoryId: { in: [...catNameById.keys()] }, date: { gte: from, lte: to } },
          select: { date: true, amount: true },
        }),
        prisma.budgetExpenseLine.findMany({
          where: { categoryId: { in: [...catNameById.keys()] }, date: { gte: from, lte: to } },
          select: { date: true, amount: true },
        }),
      ])
    : [[], []];
  const monthly = buildMonthlySeries(from, to, toNumber(envelope.totalAmount), [
    ...monthlyFinance.map((t) => ({ date: t.date, amount: toNumber(t.amount) })),
    ...monthlyLines.map((l) => ({ date: l.date, amount: toNumber(l.amount) })),
  ]);

  const attributedTx: AttributedTx[] = [
    ...financeAttr.map((t) => ({
      id: t.id, kind: "FINANCE" as const, reference: t.reference, date: t.date.toISOString(), label: t.label,
      amount: toNumber(t.amount), counterparty: t.counterparty, status: t.status,
      categoryId: t.budgetCategoryId ?? "", categoryName: catNameById.get(t.budgetCategoryId ?? "") ?? "—",
    })),
    ...expenseAttr.map((l) => ({
      id: l.id, kind: "BUDGET" as const, reference: l.reference, date: l.date.toISOString(), label: l.reference,
      amount: toNumber(l.amount), counterparty: null, status: "SETTLED",
      categoryId: l.categoryId, categoryName: catNameById.get(l.categoryId) ?? "—",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    envelope: { id: envelope.id, name: envelope.name, module: envelope.module, modules: envelope.modules, accessRoles: envelope.accessRoles, accessUserIds: envelope.accessUserIds, managerRoles: envelope.managerRoles, managerUserIds: envelope.managerUserIds, periodStart: envelope.periodStart.toISOString(), periodEnd: envelope.periodEnd.toISOString(), total, notes: envelope.notes, isActive: envelope.isActive },
    period: { from: from.toISOString(), to: to.toISOString() },
    categories,
    totals: {
      total, allocated, unallocated: total - allocated,
      consumed: consumedTotal, committed: committedTotal,
      remaining: total - consumedTotal,
      pct: total > 0 ? Math.round((consumedTotal / total) * 100) : 0,
    },
    monthly,
    unattributed: {
      total: unattributedTotal,
      count: unattributedAgg._count._all,
      transactions: unattributedTx.map((t) => ({
        id: t.id, reference: t.reference, date: t.date.toISOString(), label: t.label,
        amount: toNumber(t.amount), category: t.category, counterparty: t.counterparty, status: t.status,
      })),
    },
    attributed: {
      count: attributedTx.length,
      transactions: attributedTx,
    },
  };
}
