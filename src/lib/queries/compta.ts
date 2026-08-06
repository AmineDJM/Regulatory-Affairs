import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { toNumber } from "@/lib/utils";

/**
 * Espace comptable — vue de synthèse légère pour la comptabilité.
 *
 * Ne crée AUCUNE donnée ni table : c'est une lecture agrégée de l'existant
 * (FinanceTransaction + ExpenseOrder). Pas de plan comptable, pas d'écritures
 * en partie double, pas de bilan — juste l'opérationnel du comptable :
 *   • ce qu'il faut régler (ordres de dépense validés par la Direction),
 *   • ce qu'il faut encaisser (recettes prévues / en retard),
 *   • la synthèse recettes / dépenses / résultat du mois,
 *   • un petit historique mensuel.
 */

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export interface ComptaItem {
  id: string;
  reference: string;
  label: string;
  category: string;
  amount: number;
  date: string | null; // échéance (ordre) ou date prévue (transaction)
  counterparty: string;
  overdue: boolean;
  kind: "order" | "transaction";
}

export interface ComptaMonthRow {
  label: string;
  recettes: number;
  depenses: number;
  resultat: number;
}

export interface ComptaCategoryRow {
  category: string;
  amount: number;
}

export async function getComptaData(userId: string) {
  // Cloisonnement par entité — cf. platformScope.
  const scope = await platformScope(userId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [txs, orders] = await Promise.all([
    prisma.financeTransaction.findMany({ where: scope, orderBy: { date: "desc" }, take: 2000 }),
    prisma.expenseOrder.findMany({
      where: { AND: [{ status: "PENDING" }, scope] },
      include: { requestedBy: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  let recettesMois = 0;
  let depensesMois = 0;
  let aEncaisser = 0; // total recettes prévues (PENDING IN)
  const depByCat = new Map<string, number>();
  const recByCat = new Map<string, number>();
  const monthlyIn = new Array(12).fill(0);
  const monthlyOut = new Array(12).fill(0);
  const recettesAttendues: ComptaItem[] = [];
  const depensesPrevues: ComptaItem[] = [];

  for (const t of txs) {
    const amt = toNumber(t.amount);
    if (t.status === "SETTLED") {
      if (t.date.getFullYear() === now.getFullYear()) {
        if (t.direction === "IN") monthlyIn[t.date.getMonth()] += amt;
        else monthlyOut[t.date.getMonth()] += amt;
      }
      if (t.date >= monthStart) {
        if (t.direction === "IN") {
          recettesMois += amt;
          recByCat.set(t.category, (recByCat.get(t.category) ?? 0) + amt);
        } else {
          depensesMois += amt;
          depByCat.set(t.category, (depByCat.get(t.category) ?? 0) + amt);
        }
      }
    } else if (t.status === "PENDING") {
      const overdue = t.date < now;
      const item: ComptaItem = {
        id: t.id,
        reference: t.reference,
        label: t.label,
        category: t.category,
        amount: amt,
        date: t.date.toISOString(),
        counterparty: t.counterparty ?? "",
        overdue,
        kind: "transaction",
      };
      if (t.direction === "IN") {
        aEncaisser += amt;
        recettesAttendues.push(item);
      } else {
        depensesPrevues.push(item);
      }
    }
  }

  // Worklist du comptable : ordres de dépense validés mais pas encore réglés.
  const ordersPending: ComptaItem[] = orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    label: o.label,
    category: o.category,
    amount: toNumber(o.amount),
    date: o.dueDate ? o.dueDate.toISOString() : null,
    counterparty: o.beneficiary ?? o.requestedBy?.name ?? "",
    overdue: o.dueDate ? o.dueDate < now : false,
    kind: "order",
  }));
  const aReglerOrders = ordersPending.reduce((a, o) => a + o.amount, 0);

  // Recettes attendues : en retard d'abord, puis par date d'échéance.
  recettesAttendues.sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || (a.date ?? "").localeCompare(b.date ?? ""),
  );
  depensesPrevues.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const enRetardCount =
    recettesAttendues.filter((r) => r.overdue).length + ordersPending.filter((o) => o.overdue).length;
  const enRetardMontant =
    recettesAttendues.filter((r) => r.overdue).reduce((a, r) => a + r.amount, 0) +
    ordersPending.filter((o) => o.overdue).reduce((a, o) => a + o.amount, 0);

  // Résultat mensuel sur les 6 derniers mois (flux réalisés de l'année en cours).
  const cm = now.getMonth();
  const months: ComptaMonthRow[] = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (cm - i + 12) % 12;
    const recettes = Math.round(monthlyIn[idx]);
    const depenses = Math.round(monthlyOut[idx]);
    months.push({ label: MONTHS_FR[idx], recettes, depenses, resultat: recettes - depenses });
  }

  const sortCat = (m: Map<string, number>): ComptaCategoryRow[] =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));

  return {
    recettesMois,
    depensesMois,
    resultatMois: recettesMois - depensesMois,
    aEncaisser,
    aReglerOrders,
    aReglerCount: ordersPending.length,
    enRetardCount,
    enRetardMontant,
    depByCat: sortCat(depByCat),
    recByCat: sortCat(recByCat),
    ordersPending,
    recettesAttendues,
    depensesPrevues,
    months,
  };
}
