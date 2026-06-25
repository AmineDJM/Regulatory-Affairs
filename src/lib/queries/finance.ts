import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export interface LedgerRow {
  id: string;
  reference: string;
  date: string;
  direction: string;
  category: string;
  label: string;
  amount: number;
  signedAmount: number;
  method: string;
  account: string;
  counterparty: string;
  status: string;
}

export async function getFinanceData() {
  const txs = await prisma.financeTransaction.findMany({ orderBy: { date: "desc" } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalBalance = 0;
  let encMonth = 0;
  let decMonth = 0;
  let pendingIn = 0;
  let pendingOut = 0;
  const balanceByAccount = new Map<string, number>();
  const byCategoryOut = new Map<string, number>();
  const monthlyIn = new Array(12).fill(0);
  const monthlyOut = new Array(12).fill(0);

  for (const t of txs) {
    const amt = toNumber(t.amount);
    const signed = t.direction === "IN" ? amt : -amt;
    if (t.status === "SETTLED") {
      totalBalance += signed;
      balanceByAccount.set(t.account, (balanceByAccount.get(t.account) ?? 0) + signed);
      if (t.date.getFullYear() === now.getFullYear()) {
        if (t.direction === "IN") monthlyIn[t.date.getMonth()] += amt;
        else monthlyOut[t.date.getMonth()] += amt;
      }
      if (t.date >= monthStart) {
        if (t.direction === "IN") encMonth += amt;
        else decMonth += amt;
      }
      if (t.direction === "OUT") byCategoryOut.set(t.category, (byCategoryOut.get(t.category) ?? 0) + amt);
    } else if (t.status === "PENDING") {
      if (t.direction === "IN") pendingIn += amt;
      else pendingOut += amt;
    }
  }

  // Last 6 months: recettes vs dépenses + cumulative treasury.
  const cm = now.getMonth();
  const recVsDep: { label: string; recettes: number; depenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (cm - i + 12) % 12;
    recVsDep.push({ label: MONTHS_FR[idx], recettes: Math.round(monthlyIn[idx]), depenses: Math.round(monthlyOut[idx]) });
  }
  // Cumulative balance trend over the last 6 months (approx from yearly settled flow).
  let running = totalBalance - recVsDep.reduce((a, m) => a + m.recettes - m.depenses, 0);
  const trend = recVsDep.map((m) => {
    running += m.recettes - m.depenses;
    return { label: m.label, value: Math.round(running) };
  });

  const rows: LedgerRow[] = txs.map((t) => {
    const amt = toNumber(t.amount);
    return {
      id: t.id, reference: t.reference, date: t.date.toISOString(), direction: t.direction,
      category: t.category, label: t.label, amount: amt,
      signedAmount: t.direction === "IN" ? amt : -amt, method: t.method, account: t.account,
      counterparty: t.counterparty ?? "", status: t.status,
    };
  });

  return {
    totalBalance,
    encMonth,
    decMonth,
    pendingIn,
    pendingOut,
    count: txs.length,
    accounts: [...balanceByAccount.entries()].map(([account, balance]) => ({ account, balance })),
    byCategoryOut: [...byCategoryOut.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount })),
    recVsDep,
    trend,
    rows,
  };
}
