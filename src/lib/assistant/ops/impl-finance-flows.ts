import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import {
  allotPettyCash, confirmPettyCashReceipt, closePettyCash, requestPettyCashTopUp, setPettyCashPlan,
} from "@/lib/actions/petty-cash-actions";
import { requestInvoice, requestBudgetRevision, resolveBudgetRevision } from "@/lib/actions/expense-actions";
import {
  createPaymentRequest, submitPaymentRequest, decidePaymentRequest, cancelPaymentRequest,
  addPaymentComment, askPaymentValidation, commentPaymentPiece, reviewPaymentPiece,
} from "@/lib/actions/payment-request-actions";
import { updateTransaction, deleteTransaction, deleteTreasuryAccount, createPayroll, payPayroll } from "@/lib/actions/finance-actions";
import { updateInvoice, deleteInvoice } from "@/lib/actions/invoice-actions";
import { markSalaryPaid, unmarkSalaryPaid, transferPayrollToBudget } from "@/lib/actions/payroll-hr-actions";
import { createBudget } from "@/lib/actions/budget-actions";
import { respondToPaymentCentre } from "@/lib/actions/payment-centre-actions";
import type { PaymentMove } from "@/lib/finance/payment-request";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, dzd, fieldsOf, resolveOne, monthOf, isoDate } from "./helpers";
import { categoryOf, directionOf, methodOf, txStatusOf, CATEGORY_FR, TX_STATUS_FR } from "./impl-finance";

/**
 * OPS FLUX FINANCIERS — caisse d'avance, ordres de dépense (facture/révision), demandes de
 * paiement (dossier + pièces), écritures (modifier/supprimer), factures (modifier/supprimer),
 * paie (bulletins Finances + paie RH + transfert budget), centre de paiement : toujours par les
 * ACTIONS CANONIQUES des écrans. Invariants : résolution par référence/nom (ambiguïté LISTÉE),
 * FUSION pour les updates (l'action REMPLACE — on relit et rejoue les champs absents),
 * suppressions CRITIQUES à ressaisie. Les verrous métier (détentrice seule, Finances seules,
 * Centre de paiement, seuils) restent ceux des actions — jamais recodés ici.
 */

const num = (input: Record<string, unknown>, key: string): number | null => {
  const v = input[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[\s  ]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Période « AAAA-MM » depuis une saisie humaine (« août 2026 », « 2026-08 ») — défaut : mois courant. */
function periodOf(raw: string): string | { error: string } {
  const q = raw.trim();
  if (!q) return new Date().toISOString().slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(q)) return q;
  const yearMatch = q.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const m = monthOf(q.replace(/20\d{2}/, "").trim());
  if (!m) return { error: `Période « ${raw} » illisible — attendu un mois (« août 2026 », « 2026-08 »).` };
  return `${year}-${String(m).padStart(2, "0")}`;
}

const resolveDept = (raw: string) =>
  resolveOne(raw, "le département (champ « department »)",
    (q) => prisma.department.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (d) => d.name);

const resolvePerson = (raw: string) =>
  resolveOne(raw, "la personne",
    (q) => prisma.user.findMany({ where: { name: { contains: q, mode: "insensitive" }, isActive: true }, select: { id: true, name: true }, take: 6 }),
    (u) => u.name);

interface CashHit { id: string; period: string; status: string; amount: number; holderName: string | null; deptName: string }

/** La caisse d'avance d'un département (période précisée, sinon la plus récente non close en priorité). */
async function resolveCash(deptRaw: string, periodRaw: string, statuses?: string[]): Promise<CashHit | { error: string }> {
  const dept = await resolveDept(deptRaw);
  if ("error" in dept) return dept;
  const period = periodRaw ? periodOf(periodRaw) : null;
  if (period && typeof period !== "string") return period;
  const rows = await prisma.pettyCashAllotment.findMany({
    where: {
      departmentId: dept.id,
      ...(period ? { period } : {}),
      ...(statuses ? { status: { in: statuses as never } } : {}),
    },
    select: { id: true, period: true, status: true, amount: true, holder: { select: { name: true } } },
    orderBy: { period: "desc" },
    take: 4,
  });
  if (rows.length === 0) return { error: `Aucune caisse d'avance${period ? ` ${period}` : ""} pour ${dept.name}${statuses ? ` (état attendu : ${statuses.join("/")})` : ""}.` };
  if (rows.length > 1) return { error: `Plusieurs caisses pour ${dept.name} : ${rows.map((r) => `${r.period} (${r.status})`).join(", ")} — préciser la période (champ « period »).` };
  const hit = rows[0];
  return { id: hit.id, period: hit.period, status: hit.status, amount: toNumber(hit.amount), holderName: hit.holder?.name ?? null, deptName: dept.name };
}

/** Un ordre de dépense par référence OD-… ou libellé (statuts bornés si fournis). */
async function resolveOrder(raw: string, statuses?: string[]) {
  const q = raw.trim();
  if (!q) return { error: "Précisez la référence (OD-…) ou le libellé de l'ordre de dépense." } as const;
  const rows = await prisma.expenseOrder.findMany({
    where: {
      ...(statuses ? { status: { in: statuses as never } } : {}),
      OR: [
        { reference: { equals: q, mode: "insensitive" } },
        { label: { contains: q, mode: "insensitive" } },
        { beneficiary: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, reference: true, label: true, amount: true, beneficiary: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (rows.length === 0) return { error: `Aucun ordre de dépense « ${q} »${statuses ? ` à l'état ${statuses.join("/")}` : ""}.` } as const;
  const exact = rows.filter((r) => r.reference.toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  return { error: `Plusieurs ordres correspondent à « ${q} » : ${rows.map((r) => `${r.reference} — ${r.label} (${dzd(toNumber(r.amount))})`).join(" ; ")} — donner la référence exacte.` } as const;
}

/** Une demande de paiement par référence PAY-… ou titre. */
async function resolvePayment(raw: string) {
  const q = raw.trim();
  if (!q) return { error: "Précisez la référence (PAY-…) ou l'objet de la demande de paiement." } as const;
  const rows = await prisma.paymentRequest.findMany({
    where: { OR: [{ reference: { equals: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { payee: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, title: true, amount: true, payee: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (rows.length === 0) return { error: `Aucune demande de paiement « ${q} ».` } as const;
  const exact = rows.filter((r) => r.reference.toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  return { error: `Plusieurs demandes correspondent à « ${q} » : ${rows.map((r) => `${r.reference} — ${r.title} (${dzd(toNumber(r.amount))})`).join(" ; ")} — donner la référence exacte.` } as const;
}

/** Une pièce d'une demande de paiement, par le nom de son document. */
async function resolvePiece(requestId: string, reference: string, raw: string) {
  const pieces = await prisma.paymentPiece.findMany({
    where: { requestId },
    select: { id: true, status: true, documentId: true, note: true },
    orderBy: { position: "asc" },
  });
  if (pieces.length === 0) return { error: `Le dossier ${reference} n'a aucune pièce.` } as const;
  const docs = await prisma.document.findMany({
    where: { id: { in: pieces.map((p) => p.documentId) } }, select: { id: true, name: true },
  });
  const nameOf = new Map(docs.map((d) => [d.id, d.name] as const));
  const labeled = pieces.map((p) => ({ ...p, name: nameOf.get(p.documentId) ?? "(sans nom)" }));
  const q = raw.trim().toLowerCase();
  if (!q) {
    if (labeled.length === 1) return labeled[0];
    return { error: `Précisez la pièce (champ « piece ») parmi : ${labeled.map((p) => p.name).join(", ")}.` } as const;
  }
  const hits = labeled.filter((p) => p.name.toLowerCase().includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucune pièce « ${raw} » dans ${reference} — pièces : ${labeled.map((p) => p.name).join(", ")}.` } as const;
  return { error: `Plusieurs pièces correspondent à « ${raw} » : ${hits.map((p) => p.name).join(", ")} — préciser.` } as const;
}

/** Un employé (registre de paie) par nom. */
const resolveEmployee = (raw: string) =>
  resolveOne(raw, "l'employé (champ « employee »)",
    (q) => prisma.employee.findMany({ where: { fullName: { contains: q, mode: "insensitive" } }, select: { id: true, fullName: true }, take: 6 }),
    (e) => e.fullName);

interface PayrollHit { id: string; year: number; month: number; net: number; gross: number; status: string; employeeName: string }

/** Le bulletin de paie d'un employé pour un mois (états bornés). */
async function resolvePayrollEntry(input: Record<string, unknown>, statuses: string[], transferred?: false): Promise<PayrollHit | { error: string }> {
  const emp = await resolveEmployee(opStr(input, "employee"));
  if ("error" in emp) return emp;
  const year = num(input, "year") ?? new Date().getFullYear();
  const month = opStr(input, "month") ? monthOf(opStr(input, "month")) : null;
  const rows = await prisma.payrollEntry.findMany({
    where: {
      employeeId: emp.id, year,
      ...(month ? { month } : {}),
      status: { in: statuses as never },
      ...(transferred === false ? { budgetTransferredAt: null } : {}),
    },
    select: { id: true, year: true, month: true, net: true, gross: true, status: true },
    orderBy: { month: "desc" },
    take: 4,
  });
  if (rows.length === 0) return { error: `Aucun bulletin ${statuses.join("/")}${month ? ` ${month}/${year}` : ` en ${year}`} pour ${emp.fullName}${transferred === false ? " (non transféré au budget)" : ""}.` };
  if (rows.length > 1) return { error: `Plusieurs bulletins pour ${emp.fullName} : ${rows.map((r) => `${r.month}/${r.year} (${r.status})`).join(", ")} — préciser le mois (champ « month »).` };
  const hit = rows[0];
  return { id: hit.id, year: hit.year, month: hit.month, net: toNumber(hit.net), gross: toNumber(hit.gross), status: hit.status, employeeName: emp.fullName };
}

const resolveTreasuryAccount = (raw: string) =>
  resolveOne(raw, "le compte de trésorerie (champ « account »)",
    (q) => prisma.treasuryAccount.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true, openingBalance: true }, take: 6 }),
    (a) => a.name);

async function resolveTx(raw: string) {
  const q = raw.trim();
  if (!q) return { error: "Précisez la référence (FIN-…) ou le libellé de l'écriture." } as const;
  const rows = await prisma.financeTransaction.findMany({
    where: { OR: [{ reference: { equals: q, mode: "insensitive" } }, { label: { contains: q, mode: "insensitive" } }] },
    orderBy: { date: "desc" },
    take: 6,
  });
  if (rows.length === 0) return { error: `Aucune écriture « ${q} ».` } as const;
  const exact = rows.filter((r) => r.reference.toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  return { error: `Plusieurs écritures correspondent à « ${q} » : ${rows.map((r) => `${r.reference} — ${r.label} (${dzd(toNumber(r.amount))})`).join(" ; ")} — donner la référence exacte.` } as const;
}

async function resolveInvoiceFull(raw: string) {
  const q = raw.trim();
  if (!q) return { error: "Précisez le numéro ou le titre de la facture." } as const;
  const rows = await prisma.invoice.findMany({
    where: { OR: [{ number: { equals: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (rows.length === 0) return { error: `Aucune facture « ${q} ».` } as const;
  const exact = rows.filter((r) => (r.number ?? "").toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  return { error: `Plusieurs factures correspondent à « ${q} » : ${rows.map((r) => `${r.number ? `${r.number} — ` : ""}${r.title}`).join(" ; ")} — préciser.` } as const;
}

const resolveBudgetCategoryLine = (raw: string) =>
  resolveOne(raw, "la catégorie budgétaire (champ « category »)",
    (q) => prisma.budgetCategoryLine.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true, envelope: { select: { name: true } } }, take: 6 }),
    (c) => `${c.name} (${c.envelope.name})`);

// ── Normalisations FR → énumérations (liste blanche, jamais du texte libre). ──

const MOVE_STEPS: [RegExp, PaymentMove, string][] = [
  [/instrui|examen|examin|review|charge/i, "REVIEW", "Prendre en instruction"],
  [/attente|suspend|hold|gele|gèle/i, "HOLD", "Mettre en attente"],
  [/repren|resume|relanc/i, "RESUME", "Reprendre l'instruction"],
  [/renvoi|revoir|correction|change/i, "REQUEST_CHANGES", "Renvoyer pour corrections"],
  [/refus|rejet/i, "REJECT", "Refuser"],
  [/approuv|accord|bon [àa] payer|\bpayer\b|valide/i, "APPROVE", "Bon à payer"],
];

function moveOf(raw: string): { move: PaymentMove; label: string } | null {
  const up = raw.toUpperCase().trim();
  const direct = MOVE_STEPS.find(([, m]) => m === up);
  if (direct) return { move: direct[1], label: direct[2] };
  const hit = MOVE_STEPS.find(([re]) => re.test(raw));
  return hit ? { move: hit[1], label: hit[2] } : null;
}

function urgencyOf(raw: string): { code: string; label: string } {
  const k = raw.toLowerCase();
  if (/urgent/.test(k)) return { code: "URGENT", label: "Urgent" };
  if (/semaine|week/.test(k)) return { code: "THIS_WEEK", label: "Cette semaine" };
  if (/mois|month/.test(k)) return { code: "THIS_MONTH", label: "Ce mois-ci" };
  return { code: "WHEN_POSSIBLE", label: "Quand possible" };
}

const VERDICT_FR: Record<string, string> = { ACCEPTED: "Acceptée", CHANGES_REQUESTED: "À revoir", REJECTED: "Refusée", PENDING: "Remise en attente" };

function verdictOf(raw: string): string | null {
  const up = raw.toUpperCase().trim();
  if (VERDICT_FR[up]) return up;
  const k = raw.toLowerCase();
  if (/accept|valide|conforme|ok/.test(k)) return "ACCEPTED";
  if (/revoir|corrig|change|reprend/.test(k)) return "CHANGES_REQUESTED";
  if (/refus|rejet/.test(k)) return "REJECTED";
  if (/attente|pending|neutre/.test(k)) return "PENDING";
  return null;
}

const BUDGET_LINE_DEPTS: Record<string, string> = {
  REGULATORY: "Regulatory", SPONSORING: "Sponsoring", CONGRESS_INTERNATIONAL: "Congrès international",
  CONGRESS_NATIONAL: "Congrès national", MEDICAL_PROMOTION: "Promotion médicale", LOGISTICS: "Logistique",
  BUSINESS_DEVELOPMENT: "Business Development", MARKETING: "Marketing",
};

function budgetLineDeptOf(raw: string): string | null {
  const up = raw.toUpperCase().trim().replace(/\s+/g, "_");
  if (BUDGET_LINE_DEPTS[up]) return up;
  const k = raw.toLowerCase();
  if (/regulat/.test(k)) return "REGULATORY";
  if (/sponsor/.test(k)) return "SPONSORING";
  if (/congr.s.*inter/.test(k)) return "CONGRESS_INTERNATIONAL";
  if (/congr/.test(k)) return "CONGRESS_NATIONAL";
  if (/promotion|m[ée]dical/.test(k)) return "MEDICAL_PROMOTION";
  if (/logisti/.test(k)) return "LOGISTICS";
  if (/business|bd/.test(k)) return "BUSINESS_DEVELOPMENT";
  if (/marketing/.test(k)) return "MARKETING";
  return null;
}

export const FINANCE_FLOWS_OPS_IMPL: Record<string, OpImpl> = {
  // ─────────────── Caisse d'avance ───────────────

  allot_petty_cash: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const dept = await resolveDept(opStr(input, "department"));
      if ("error" in dept) return dept;
      const amount = num(input, "amount");
      if (amount === null || amount <= 0) return { error: "Précisez la somme remise (champ « amount »)." };
      const period = periodOf(opStr(input, "period"));
      if (typeof period !== "string") return period;
      const existing = await prisma.pettyCashAllotment.findFirst({
        where: { departmentId: dept.id, period }, select: { id: true, amount: true, holder: { select: { name: true } } },
      });
      let holderId: string | null = null;
      let holderName: string | null = existing?.holder?.name ?? null;
      const holderRaw = opStr(input, "holder");
      if (holderRaw) {
        const holder = await resolvePerson(holderRaw);
        if ("error" in holder) return holder;
        holderId = holder.id; holderName = holder.name;
      } else if (!existing) {
        return { error: "Précisez à qui la somme est remise (champ « holder ») — première dotation du mois." };
      }
      return {
        title: existing
          ? `Rallonger la caisse de ${dept.name} (${period}) : +${dzd(amount)}`
          : `Remettre ${dzd(amount)} à la caisse de ${dept.name} (${period})`,
        fields: fieldsOf([
          ["Département", dept.name], ["Période", period],
          [existing ? "Rallonge" : "Somme remise", dzd(amount)],
          ["Fonds actuel", existing ? dzd(toNumber(existing.amount)) : null],
          ["Détenteur·rice", holderName], ["Note", opStr(input, "note") || null],
        ]),
        warnings: ["L'argent est réputé remis : la personne détentrice devra CONFIRMER la réception avant de dépenser."],
        args: { departmentId: dept.id, holderId, period, amount: String(amount), note: opStr(input, "note") || null },
        successMessage: existing ? `Caisse de ${dept.name} rallongée de ${dzd(amount)}.` : `Caisse de ${dept.name} dotée (${dzd(amount)}).`,
        link: "/moyens-generaux", revalidate: ["/moyens-generaux"],
      };
    },
    execute: (args) => runFd(allotPettyCash, args, "La remise de caisse a été refusée.", { revalidate: ["/moyens-generaux"] }),
  },

  confirm_petty_cash_receipt: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const cash = await resolveCash(opStr(input, "department"), opStr(input, "period"), ["ALLOTTED"]);
      if ("error" in cash) return cash;
      return {
        title: `Confirmer la réception de la caisse — ${cash.deptName} (${cash.period})`,
        fields: [
          { label: "Caisse", value: `${cash.deptName} · ${cash.period}` },
          { label: "Fonds", value: dzd(cash.amount) },
          ...(cash.holderName ? [{ label: "Détenteur·rice", value: cash.holderName }] : []),
        ],
        warnings: ["Seule la personne détentrice (ou la Direction) confirme — l'action refusera sinon. Le fonds devient dépensable."],
        args: { id: cash.id },
        successMessage: `Réception confirmée — caisse ${cash.deptName} (${cash.period}) ouverte.`,
        revalidate: ["/moyens-generaux"],
      };
    },
    execute: (args) => runFd(confirmPettyCashReceipt, args, "La confirmation a été refusée.", { revalidate: ["/moyens-generaux"] }),
  },

  close_petty_cash: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const cash = await resolveCash(opStr(input, "department"), opStr(input, "period"), ["ALLOTTED", "RECEIVED"]);
      if ("error" in cash) return cash;
      return {
        title: `Solder la caisse d'avance — ${cash.deptName} (${cash.period})`,
        fields: [
          { label: "Caisse", value: `${cash.deptName} · ${cash.period}` },
          { label: "Fonds du mois", value: dzd(cash.amount) },
        ],
        warnings: ["Le reliquat n'est plus disponible : le mois est clos. Les dépenses déjà imputées restent."],
        args: { id: cash.id },
        successMessage: `Caisse ${cash.deptName} (${cash.period}) soldée.`,
        revalidate: ["/moyens-generaux"],
      };
    },
    execute: (args) => runFd(closePettyCash, args, "La clôture a été refusée.", { revalidate: ["/moyens-generaux"] }),
  },

  request_petty_cash_topup: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const cash = await resolveCash(opStr(input, "department"), opStr(input, "period"), ["RECEIVED", "ALLOTTED"]);
      if ("error" in cash) return cash;
      const amount = num(input, "amount");
      if (amount === null || amount <= 0) return { error: "Précisez le montant demandé (champ « amount »)." };
      return {
        title: `Demander une rallonge de ${dzd(amount)} — caisse ${cash.deptName} (${cash.period})`,
        fields: fieldsOf([
          ["Caisse", `${cash.deptName} · ${cash.period}`],
          ["Montant demandé", dzd(amount)],
          ["Motif", opStr(input, "reason") || null],
        ]),
        args: { cashId: cash.id, amount: String(amount), reason: opStr(input, "reason") || null },
        successMessage: `Rallonge de ${dzd(amount)} demandée pour ${cash.deptName} — à trancher par l'administration.`,
        revalidate: ["/moyens-generaux"],
      };
    },
    execute: (args) => runFd(requestPettyCashTopUp, args, "La demande de rallonge a été refusée.", { revalidate: ["/moyens-generaux"] }),
  },

  set_petty_cash_plan: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const dept = await resolveDept(opStr(input, "department"));
      if ("error" in dept) return dept;
      // FUSION avec le plan existant : l'action REMPLACE le réglage entier — un montant corrigé
      // sans redonner le jour ou la détentrice ne doit pas les effacer.
      const existing = await prisma.pettyCashPlan.findUnique({
        where: { departmentId: dept.id },
        select: { monthlyAmount: true, rechargeDay: true, holderId: true, isActive: true, holder: { select: { name: true } } },
      });
      const amount = num(input, "amount") ?? (existing ? toNumber(existing.monthlyAmount) : null);
      if (amount === null || amount < 0) return { error: "Précisez le montant mensuel (champ « amount »)." };
      const day = num(input, "day") ?? existing?.rechargeDay ?? null;
      const holderRaw = opStr(input, "holder");
      let holderId: string | null = existing?.holderId ?? null;
      let holderName: string | null = existing?.holder?.name ?? null;
      if (holderRaw) {
        const holder = await resolvePerson(holderRaw);
        if ("error" in holder) return holder;
        holderId = holder.id; holderName = holder.name;
      }
      const activeRaw = opStr(input, "active");
      const inactive = activeRaw
        ? /^(0|non|inactif|inactive|d[ée]sactiv|off|stop)/i.test(activeRaw)
        : existing ? !existing.isActive : false;
      return {
        title: `Régler la caisse mensuelle de ${dept.name} : ${dzd(amount)}${day ? ` le ${day} du mois` : ""}`,
        fields: fieldsOf([
          ["Département", dept.name], ["Montant mensuel", dzd(amount)],
          ["Jour de rechargement", day ? String(Math.min(28, Math.max(1, day))) : null],
          ["Détenteur·rice", holderName], ["État", inactive ? "Désactivée" : "Active"],
        ]),
        warnings: ["Un rappel part aux RH 48 h avant chaque rechargement tant que le réglage est actif."],
        args: { departmentId: dept.id, monthlyAmount: String(amount), rechargeDay: day ? String(day) : null, holderId, isActive: inactive ? "0" : "1" },
        successMessage: `Caisse mensuelle de ${dept.name} réglée (${dzd(amount)}).`,
        revalidate: ["/moyens-generaux"],
      };
    },
    execute: (args) => runFd(setPettyCashPlan, args, "Le réglage de la caisse mensuelle a été refusé.", { revalidate: ["/moyens-generaux"] }),
  },

  // ─────────────── Ordres de dépense — facture & révision budget ───────────────

  request_expense_invoice: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const order = await resolveOrder(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in order) return order;
      return {
        title: `Demander la facture de l'ordre ${order.reference}`,
        fields: [
          { label: "Ordre", value: `${order.reference} — ${order.label} (${dzd(toNumber(order.amount))})` },
          ...(order.beneficiary ? [{ label: "Bénéficiaire", value: order.beneficiary }] : []),
        ],
        args: { id: order.id },
        successMessage: `Facture demandée au porteur de l'ordre ${order.reference}.`,
        revalidate: ["/finances/ordres-de-depense"],
      };
    },
    execute: (args) => runFd(requestInvoice, args, "La demande de facture a été refusée.", { revalidate: ["/finances/ordres-de-depense"] }),
  },

  request_budget_revision: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const order = await resolveOrder(opStr(input, "reference") || opStr(input, "label"), ["PENDING"]);
      if ("error" in order) return order;
      const reason = opStr(input, "reason");
      if (!reason) return { error: "Précisez le motif (champ « reason » — ex. manque de budget)." };
      const proposed = num(input, "amount");
      return {
        title: `Demander une révision de budget — ordre ${order.reference}`,
        fields: fieldsOf([
          ["Ordre", `${order.reference} — ${order.label} (${dzd(toNumber(order.amount))})`],
          ["Motif", reason],
          ["Montant proposé", proposed !== null ? dzd(proposed) : null],
        ]),
        warnings: ["L'ordre passe « Révision demandée » et remonte à la Direction — il n'est plus réglable en l'état."],
        args: { id: order.id, reason, proposedAmount: proposed !== null ? String(proposed) : null },
        successMessage: `Révision de budget demandée pour ${order.reference}.`,
        revalidate: ["/finances/ordres-de-depense", "/validations"],
      };
    },
    execute: (args) => runFd(requestBudgetRevision, args, "La demande de révision a été refusée.", { revalidate: ["/finances/ordres-de-depense", "/validations"] }),
  },

  resolve_budget_revision: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const order = await resolveOrder(opStr(input, "reference") || opStr(input, "label"), ["REVISION_REQUESTED"]);
      if ("error" in order) return order;
      const raw = opStr(input, "decision");
      const adjust = /ajust|accord|nouveau|augmente|modif/i.test(raw) || raw.toUpperCase() === "ADJUST";
      const reject = /refus|rejet|maintien|maintenir/i.test(raw) || raw.toUpperCase() === "REJECT";
      if (!adjust && !reject) return { error: "Précisez la décision (champ « decision ») : ajuster le montant, ou refuser (montant maintenu)." };
      const amount = num(input, "amount");
      if (adjust && (amount === null || amount <= 0)) return { error: "Pour ajuster, précisez le nouveau montant accordé (champ « amount »)." };
      return {
        title: adjust
          ? `Ajuster l'ordre ${order.reference} : ${dzd(toNumber(order.amount))} → ${dzd(amount ?? 0)}`
          : `Refuser la révision — l'ordre ${order.reference} repart tel quel`,
        fields: fieldsOf([
          ["Ordre", `${order.reference} — ${order.label}`],
          ["Décision", adjust ? `Montant ajusté à ${dzd(amount ?? 0)}` : `Refusée — montant maintenu (${dzd(toNumber(order.amount))})`],
          ["Commentaire", opStr(input, "note") || null],
        ]),
        warnings: ["L'ordre repart « à régler » chez le comptable dès la décision."],
        args: { id: order.id, decision: adjust ? "ADJUST" : "REJECT", amount: adjust ? String(amount) : null, comment: opStr(input, "note") || null },
        successMessage: adjust ? `Ordre ${order.reference} ajusté à ${dzd(amount ?? 0)}.` : `Révision refusée — ${order.reference} maintenu.`,
        revalidate: ["/finances/ordres-de-depense", "/validations"],
      };
    },
    execute: (args) => runFd(resolveBudgetRevision, args, "La décision de révision a été refusée.", { revalidate: ["/finances/ordres-de-depense", "/validations"] }),
  },

  // ─────────────── Demandes de paiement ───────────────

  create_payment_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label") || opStr(input, "title");
      const payee = opStr(input, "payee");
      const amount = num(input, "amount");
      if (!title) return { error: "Précisez l'objet du paiement (champ « label »)." };
      if (!payee) return { error: "Précisez le bénéficiaire — à qui l'argent doit aller (champ « payee »)." };
      if (amount === null || amount <= 0) return { error: "Précisez le montant à payer (champ « amount »)." };
      let recipientId: string | null = null; let recipientName: string | null = null;
      const recipientRaw = opStr(input, "recipient");
      if (recipientRaw) {
        const recipient = await resolvePerson(recipientRaw);
        if ("error" in recipient) return recipient;
        recipientId = recipient.id; recipientName = recipient.name;
      }
      const draft = /brouillon|draft|sans (envoyer|transmettre)/i.test(opStr(input, "mode"));
      const urgency = urgencyOf(opStr(input, "urgency"));
      const dueDate = isoDate(opStr(input, "dueDate"));
      return {
        title: `Demande de paiement — ${payee} · ${dzd(amount)}${draft ? " (brouillon)" : ""}`,
        fields: fieldsOf([
          ["Objet", title], ["Bénéficiaire", payee], ["Montant", dzd(amount)],
          ["Interlocuteur Finances", recipientName], ["Échéance", dueDate],
          ["Urgence", dueDate ? null : urgency.label],
          ["Description", opStr(input, "description") || null],
          ["Envoi", draft ? "Brouillon — à transmettre ensuite" : "Transmise aux Finances immédiatement"],
        ]),
        warnings: ["Les pièces justificatives (facture, bon de commande…) se déposent depuis le dossier — le bon à payer les exigera."],
        args: {
          title, payee, amount: String(amount), description: opStr(input, "description") || null,
          recipientId, dueDate, urgency: urgency.code, submit: draft ? "0" : null,
        },
        successMessage: draft ? `Brouillon de demande de paiement créé (${payee}, ${dzd(amount)}).` : `Demande de paiement transmise aux Finances (${payee}, ${dzd(amount)}).`,
        link: "/validations/paiements", revalidate: ["/validations", "/validations/paiements"],
      };
    },
    execute: (args) => runFd2(createPaymentRequest, args, "La demande de paiement a été refusée.", { link: "/validations/paiements", revalidate: ["/validations", "/validations/paiements"] }),
  },

  submit_payment_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      return {
        title: `Transmettre ${req.reference} aux Finances`,
        fields: [
          { label: "Dossier", value: `${req.reference} — ${req.title} (${dzd(toNumber(req.amount))})` },
          { label: "Bénéficiaire", value: req.payee },
        ],
        args: { id: req.id, note: opStr(input, "note") || null },
        successMessage: `Dossier ${req.reference} transmis aux Finances.`,
        link: "/validations/paiements", revalidate: ["/validations", "/validations/paiements"],
      };
    },
    execute: (args) => runFd(submitPaymentRequest, args, "La transmission a été refusée.", { revalidate: ["/validations", "/validations/paiements"] }),
  },

  decide_payment_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const mv = moveOf(opStr(input, "decision"));
      if (!mv) return { error: "Précisez le geste (champ « decision ») : instruire | mettre en attente | reprendre | renvoyer pour corrections | bon à payer | refuser." };
      const note = opStr(input, "note");
      if (mv.move === "HOLD" && !note) return { error: "Une mise en attente se motive (champ « note ») — le demandeur doit savoir pourquoi." };
      if (mv.move === "REJECT" && !note) return { error: "Un refus se motive (champ « note ») — c'est ce que lira le demandeur." };
      return {
        title: `${mv.label} — ${req.reference} (${dzd(toNumber(req.amount))})`,
        fields: fieldsOf([
          ["Dossier", `${req.reference} — ${req.title}`],
          ["Bénéficiaire", req.payee],
          ["Geste", mv.label],
          ["Motif / note", note || null],
        ]),
        warnings: mv.move === "APPROVE"
          ? ["BON À PAYER : un ordre de règlement est ouvert et passe par le Centre de paiement (autorisation PDG dès 50 000 DZD). Toutes les pièces doivent être acceptées."]
          : mv.move === "REJECT" ? ["Le dossier est clos sur ce refus ; le demandeur est notifié."] : [],
        args: { id: req.id, move: mv.move, note: note || null },
        successMessage: `${mv.label} — ${req.reference}.`,
        link: "/validations/paiements", revalidate: ["/validations", "/validations/paiements", "/centre-paiement"],
      };
    },
    execute: (args) => runFd(decidePaymentRequest, args, "La décision a été refusée.", { revalidate: ["/validations", "/validations/paiements", "/centre-paiement"] }),
  },

  cancel_payment_request: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      return {
        title: `Retirer la demande de paiement ${req.reference}`,
        fields: [{ label: "Dossier", value: `${req.reference} — ${req.title} (${dzd(toNumber(req.amount))})` }],
        warnings: ["Le dossier est clos sans paiement ; les Finances sont prévenues s'il était chez elles."],
        args: { id: req.id, note: opStr(input, "note") || null },
        successMessage: `Demande ${req.reference} retirée.`,
        revalidate: ["/validations", "/validations/paiements"],
      };
    },
    execute: (args) => runFd(cancelPaymentRequest, args, "Le retrait a été refusé.", { revalidate: ["/validations", "/validations/paiements"] }),
  },

  add_payment_comment: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const message = opStr(input, "message") || opStr(input, "note");
      if (!message) return { error: "Écrivez le message (champ « message »)." };
      return {
        title: `Message dans le dossier ${req.reference}`,
        fields: [
          { label: "Dossier", value: `${req.reference} — ${req.title}` },
          { label: "Message", value: message },
        ],
        args: { requestId: req.id, message },
        successMessage: `Message ajouté au dossier ${req.reference}.`,
        revalidate: ["/validations/paiements"],
      };
    },
    execute: (args) => runFd(addPaymentComment, args, "Le message a été refusé.", { revalidate: ["/validations/paiements"] }),
  },

  ask_payment_validation: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const validator = await resolvePerson(opStr(input, "validator"));
      if ("error" in validator) return validator;
      let validator2Id: string | null = null; let validator2Name: string | null = null;
      const v2Raw = opStr(input, "validator2");
      if (v2Raw) {
        const v2 = await resolvePerson(v2Raw);
        if ("error" in v2) return v2;
        validator2Id = v2.id; validator2Name = v2.name;
      }
      const pieceNames: string[] = []; const pieceIds: string[] = [];
      const piecesRaw = opStr(input, "pieces");
      if (piecesRaw) {
        for (const part of piecesRaw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
          const piece = await resolvePiece(req.id, req.reference, part);
          if ("error" in piece) return piece;
          pieceIds.push(piece.id); pieceNames.push(piece.name);
        }
      }
      return {
        title: `Demander la validation du paiement ${req.reference} à ${validator.name}`,
        fields: fieldsOf([
          ["Dossier", `${req.reference} — ${req.payee} · ${dzd(toNumber(req.amount))}`],
          ["Validateur", validator.name], ["2ᵉ validateur", validator2Name],
          ["Portée", pieceNames.length > 0 ? `Pièces : ${pieceNames.join(", ")}` : "Dossier complet"],
          ["Note", opStr(input, "note") || null],
        ]),
        args: { id: req.id, validatorId: validator.id, validator2Id, note: opStr(input, "note") || null, pieceIds: pieceIds.join(",") },
        successMessage: `Validation du paiement ${req.reference} demandée à ${validator.name}${validator2Name ? ` et ${validator2Name}` : ""}.`,
        revalidate: ["/validations", "/validations/paiements"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      fd.set("validatorId", args.validatorId ?? "");
      if (args.validator2Id) fd.set("validator2Id", args.validator2Id);
      if (args.note) fd.set("note", args.note);
      for (const pid of (args.pieceIds ?? "").split(",").filter(Boolean)) fd.append("pieceId", pid);
      const r = await askPaymentValidation(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La demande de validation a été refusée." };
      return { ok: true, revalidate: ["/validations", "/validations/paiements"] };
    },
  },

  comment_payment_piece: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const piece = await resolvePiece(req.id, req.reference, opStr(input, "piece"));
      if ("error" in piece) return piece;
      const note = opStr(input, "note") || opStr(input, "message");
      if (!note) return { error: "Écrivez le commentaire de la pièce (champ « note »)." };
      return {
        title: `Commenter la pièce « ${piece.name} » (${req.reference})`,
        fields: [
          { label: "Pièce", value: piece.name },
          { label: "Commentaire", value: note },
        ],
        args: { pieceId: piece.id, note },
        successMessage: `Commentaire posé sur « ${piece.name} ».`,
        revalidate: ["/validations/paiements"],
      };
    },
    execute: (args) => runFd(commentPaymentPiece, args, "Le commentaire a été refusé.", { revalidate: ["/validations/paiements"] }),
  },

  review_payment_piece: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolvePayment(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in req) return req;
      const piece = await resolvePiece(req.id, req.reference, opStr(input, "piece"));
      if ("error" in piece) return piece;
      const verdict = verdictOf(opStr(input, "verdict") || opStr(input, "decision"));
      if (!verdict) return { error: "Précisez le verdict (champ « verdict ») : accepter | à revoir | refuser." };
      const note = opStr(input, "note");
      if ((verdict === "CHANGES_REQUESTED" || verdict === "REJECTED") && !note) {
        return { error: "Dites ce qui ne va pas (champ « note ») — sans motif, la pièce reviendra identique." };
      }
      return {
        title: `${VERDICT_FR[verdict]} — pièce « ${piece.name} » (${req.reference})`,
        fields: fieldsOf([
          ["Dossier", `${req.reference} — ${req.title}`],
          ["Pièce", piece.name],
          ["Verdict", VERDICT_FR[verdict]],
          ["Motif", note || null],
        ]),
        warnings: verdict === "CHANGES_REQUESTED" || verdict === "REJECTED"
          ? ["Le dossier repasse automatiquement chez le demandeur si une pièce est mise en cause."] : [],
        args: { pieceId: piece.id, verdict, note: note || null },
        successMessage: `Pièce « ${piece.name} » : ${VERDICT_FR[verdict].toLowerCase()}.`,
        revalidate: ["/validations/paiements"],
      };
    },
    execute: (args) => runFd(reviewPaymentPiece, args, "Le verdict a été refusé.", { revalidate: ["/validations/paiements"] }),
  },

  // ─────────────── Écritures & comptes de trésorerie ───────────────

  update_transaction: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tx = await resolveTx(opStr(input, "reference") || opStr(input, "transaction"));
      if ("error" in tx) return tx;
      // FUSION : l'action canonique REMPLACE l'écriture entière — on relit l'existant et on
      // rejoue chaque champ non modifié à l'identique.
      const label = opStr(input, "label") || tx.label;
      const amount = num(input, "amount");
      const category = opStr(input, "category") ? categoryOf(opStr(input, "category")) : tx.category;
      const direction = opStr(input, "direction") ? directionOf(opStr(input, "direction"), category) : tx.direction;
      const status = txStatusOf(opStr(input, "status")) ?? tx.status;
      const method = opStr(input, "method") ? methodOf(opStr(input, "method")) : tx.method;
      const date = isoDate(opStr(input, "date"));
      const counterparty = opStr(input, "counterparty") || tx.counterparty;
      const notes = opStr(input, "notes") || tx.notes;
      return {
        title: `Modifier l'écriture ${tx.reference}`,
        fields: fieldsOf([
          ["Écriture", tx.reference],
          ["Libellé", label !== tx.label ? `${tx.label} → ${label}` : label],
          ["Montant", amount !== null ? `${dzd(toNumber(tx.amount))} → ${dzd(amount)}` : dzd(toNumber(tx.amount))],
          ["Catégorie", CATEGORY_FR[category] ?? category],
          ["Sens", direction === "IN" ? "Encaissement" : "Décaissement"],
          ["Statut", TX_STATUS_FR[status] ?? status],
          ["Date", date],
          ["Contrepartie", counterparty],
        ]),
        args: {
          id: tx.id, label, amount: String(amount ?? toNumber(tx.amount)), category, direction, status, method,
          date, account: tx.account, counterparty, invoiceRef: opStr(input, "invoiceRef") || tx.invoiceRef, notes,
        },
        successMessage: `Écriture ${tx.reference} mise à jour.`,
        link: "/finances", revalidate: ["/finances"],
      };
    },
    execute: (args) => runFd(updateTransaction, args, "La modification de l'écriture a été refusée.", { revalidate: ["/finances"] }),
  },

  delete_transaction: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tx = await resolveTx(opStr(input, "reference") || opStr(input, "transaction"));
      if ("error" in tx) return tx;
      return {
        title: `SUPPRIMER l'écriture ${tx.reference}`,
        fields: [
          { label: "Écriture", value: `${tx.reference} — ${tx.label}` },
          { label: "Montant", value: `${tx.direction === "IN" ? "+" : "−"}${dzd(toNumber(tx.amount))}` },
        ],
        warnings: [
          "Suppression DÉFINITIVE du livre : la trésorerie est recalculée sans cette écriture.",
          "Un bulletin de paie réglé qui pointait cette écriture repasse « validé, non réglé ».",
        ],
        confirmText: tx.reference,
        args: { id: tx.id },
        successMessage: `Écriture ${tx.reference} supprimée.`,
        revalidate: ["/finances"],
      };
    },
    execute: (args) => runFd(deleteTransaction, args, "La suppression a été refusée.", { revalidate: ["/finances"] }),
  },

  delete_treasury_account: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const account = await resolveTreasuryAccount(opStr(input, "account") || opStr(input, "name"));
      if ("error" in account) return account;
      return {
        title: `SUPPRIMER le compte de trésorerie « ${account.name} »`,
        fields: [
          { label: "Compte", value: account.name },
          { label: "Solde d'ouverture", value: dzd(toNumber(account.openingBalance)) },
        ],
        warnings: ["Le point de départ des soldes de ce compte disparaît — les écritures du livre, elles, restent."],
        confirmText: account.name,
        args: { id: account.id },
        successMessage: `Compte « ${account.name} » supprimé.`,
        revalidate: ["/finances"],
      };
    },
    execute: (args) => runFd(deleteTreasuryAccount, args, "La suppression du compte a été refusée.", { revalidate: ["/finances"] }),
  },

  // ─────────────── Factures ───────────────

  update_invoice: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const inv = await resolveInvoiceFull(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in inv) return inv;
      // FUSION : updateInvoice REMPLACE la fiche — chaque champ absent est rejoué à l'identique.
      const title = opStr(input, "newLabel") || inv.title;
      const amount = num(input, "amount");
      const number = opStr(input, "number") || inv.number;
      const issueDate = isoDate(opStr(input, "date")) ?? (inv.issueDate ? inv.issueDate.toISOString().slice(0, 10) : null);
      const dueDate = isoDate(opStr(input, "dueDate")) ?? (inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null);
      const paidDate = inv.paidDate ? inv.paidDate.toISOString().slice(0, 10) : null;
      const recipient = opStr(input, "counterparty") || inv.recipient;
      return {
        title: `Modifier la facture « ${inv.title} »`,
        fields: fieldsOf([
          ["Facture", inv.number ? `${inv.number} — ${inv.title}` : inv.title],
          ["Objet", title !== inv.title ? `${inv.title} → ${title}` : title],
          ["Montant", amount !== null ? `${inv.amount !== null ? dzd(toNumber(inv.amount)) : "—"} → ${dzd(amount)}` : (inv.amount !== null ? dzd(toNumber(inv.amount)) : null)],
          ["Échéance", dueDate],
          ["Règlement", paidDate ? `payée le ${paidDate} (inchangé — passer par « facture payée » pour y toucher)` : null],
        ]),
        args: {
          id: inv.id, title, number,
          amount: amount !== null ? String(amount) : (inv.amount !== null ? String(toNumber(inv.amount)) : null),
          issueDate, dueDate, paidDate,
          // Le statut existant est REJOUÉ : sans lui, une facture annulée ou partielle
          // redeviendrait « impayée » au premier renommage (statusFor le déduirait de la date).
          status: inv.status,
          direction: inv.direction, recipient, payer: inv.payer,
          notes: opStr(input, "notes") || inv.notes,
        },
        successMessage: `Facture « ${title} » mise à jour.`,
        link: "/finances/factures", revalidate: ["/finances", "/finances/factures"],
      };
    },
    execute: (args) => runFd(updateInvoice, args, "La modification de la facture a été refusée.", { revalidate: ["/finances", "/finances/factures"] }),
  },

  delete_invoice: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const inv = await resolveInvoiceFull(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in inv) return inv;
      const key = inv.number || inv.title;
      return {
        title: `SUPPRIMER la facture « ${inv.title} »`,
        fields: [
          { label: "Facture", value: `${inv.number ? `${inv.number} — ` : ""}${inv.title}${inv.amount !== null ? ` (${dzd(toNumber(inv.amount))})` : ""}` },
        ],
        warnings: ["Suppression définitive de la fiche facture — l'écriture de règlement éventuelle reste au livre."],
        confirmText: key,
        args: { id: inv.id },
        successMessage: `Facture « ${inv.title} » supprimée.`,
        revalidate: ["/finances", "/finances/factures"],
      };
    },
    execute: (args) => runFd(deleteInvoice, args, "La suppression de la facture a été refusée.", { revalidate: ["/finances", "/finances/factures"] }),
  },

  // ─────────────── Paie (bulletins Finances) ───────────────

  create_payroll: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const emp = await resolveEmployee(opStr(input, "employee"));
      if ("error" in emp) return emp;
      const gross = num(input, "gross") ?? num(input, "amount");
      if (gross === null || gross <= 0) return { error: "Précisez le salaire brut (champ « gross »)." };
      const bonuses = num(input, "bonuses") ?? 0;
      const deductions = num(input, "deductions") ?? 0;
      const year = num(input, "year") ?? new Date().getFullYear();
      const month = (opStr(input, "month") ? monthOf(opStr(input, "month")) : null) ?? new Date().getMonth() + 1;
      const net = gross + bonuses - deductions;
      return {
        title: `Bulletin ${month}/${year} — ${emp.fullName} (net ${dzd(net)})`,
        fields: fieldsOf([
          ["Employé", emp.fullName], ["Mois", `${month}/${year}`],
          ["Brut", dzd(gross)], ["Primes", bonuses ? dzd(bonuses) : null],
          ["Retenues", deductions ? dzd(deductions) : null], ["Net", dzd(net)],
        ]),
        warnings: ["Le bulletin naît en brouillon — le règlement (écriture SALAIRE) est un geste séparé."],
        args: { employeeId: emp.id, gross: String(gross), bonuses: bonuses ? String(bonuses) : null, deductions: deductions ? String(deductions) : null, year: String(year), month: String(month) },
        successMessage: `Bulletin ${month}/${year} créé pour ${emp.fullName}.`,
        link: "/finances", revalidate: ["/finances"],
      };
    },
    execute: (args) => runFd2(createPayroll, args, "La création du bulletin a été refusée.", { revalidate: ["/finances"] }),
  },

  pay_payroll: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const entry = await resolvePayrollEntry(input, ["DRAFT", "VALIDATED"]);
      if ("error" in entry) return entry;
      return {
        title: `Régler la paie ${entry.month}/${entry.year} — ${entry.employeeName}`,
        fields: [
          { label: "Bulletin", value: `${entry.employeeName} · ${entry.month}/${entry.year}` },
          { label: "Net à verser", value: dzd(entry.net) },
        ],
        warnings: ["L'ARGENT SORT : une écriture SALAIRE (décaissement réalisé) est inscrite au livre à la confirmation."],
        args: { id: entry.id },
        successMessage: `Paie ${entry.month}/${entry.year} de ${entry.employeeName} réglée — écriture inscrite.`,
        link: "/finances", revalidate: ["/finances"],
      };
    },
    execute: (args) => runFd(payPayroll, args, "Le règlement de la paie a été refusé.", { revalidate: ["/finances"] }),
  },

  // ─────────────── Paie RH (masse salariale) ───────────────

  mark_salary_paid: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const emp = await resolveEmployee(opStr(input, "employee"));
      if ("error" in emp) return emp;
      const employerCost = num(input, "employerCost");
      const net = num(input, "net");
      if (employerCost === null || employerCost <= 0) return { error: "Précisez le coût employeur (champ « employerCost » — brut + charges patronales, c'est lui qui pèse sur le budget)." };
      if (net === null || net <= 0) return { error: "Précisez le salaire net (champ « net » — le montant affiché au salarié)." };
      if (net > employerCost) return { error: "Le net ne peut pas dépasser le coût employeur." };
      const gross = num(input, "gross");
      const year = num(input, "year") ?? new Date().getFullYear();
      const month = (opStr(input, "month") ? monthOf(opStr(input, "month")) : null) ?? new Date().getMonth() + 1;
      return {
        title: `Marquer payé ${month}/${year} — ${emp.fullName}`,
        fields: fieldsOf([
          ["Employé", emp.fullName], ["Mois", `${month}/${year}`],
          ["Coût employeur", dzd(employerCost)], ["Brut", gross !== null ? dzd(gross) : null], ["Net (salarié)", dzd(net)],
        ]),
        warnings: [
          "Le mois passe PAYÉ pour cet employé (sans fiche de paie jointe — elle peut être déposée depuis l'écran RH).",
          "L'imputation au budget se fait ensuite par le TRANSFERT du mois.",
        ],
        args: { employeeId: emp.id, year: String(year), month: String(month), employerCost: String(employerCost), net: String(net), gross: gross !== null ? String(gross) : null },
        successMessage: `Paie ${month}/${year} de ${emp.fullName} marquée payée.`,
        link: "/rh", revalidate: ["/rh"],
      };
    },
    execute: (args) => runFd(markSalaryPaid, args, "Le marquage n'a pas été accepté.", { revalidate: ["/rh"] }),
  },

  unmark_salary_paid: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const entry = await resolvePayrollEntry(input, ["PAID"], false);
      if ("error" in entry) return entry;
      return {
        title: `Annuler le « payé » ${entry.month}/${entry.year} — ${entry.employeeName}`,
        fields: [
          { label: "Ligne", value: `${entry.employeeName} · ${entry.month}/${entry.year}` },
          { label: "Net", value: dzd(entry.net) },
        ],
        warnings: ["Correction d'erreur de saisie : la ligne repasse en brouillon et la fiche de paie déposée est retirée. Impossible après transfert au budget."],
        args: { id: entry.id },
        successMessage: `Paiement ${entry.month}/${entry.year} de ${entry.employeeName} annulé (correction).`,
        revalidate: ["/rh"],
      };
    },
    execute: (args) => runFd(unmarkSalaryPaid, args, "L'annulation a été refusée.", { revalidate: ["/rh"] }),
  },

  transfer_payroll_to_budget: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const year = num(input, "year") ?? new Date().getFullYear();
      const month = (opStr(input, "month") ? monthOf(opStr(input, "month")) : null) ?? new Date().getMonth() + 1;
      const cat = await resolveBudgetCategoryLine(opStr(input, "category"));
      if ("error" in cat) return cat;
      const entries = await prisma.payrollEntry.findMany({
        where: { year, month, status: "PAID", budgetTransferredAt: null },
        select: { employerCost: true, gross: true, bonuses: true, deductions: true },
      });
      if (entries.length === 0) return { error: `Aucun salaire payé à transférer pour ${month}/${year}.` };
      const total = entries.reduce((a, e) => a + (e.employerCost !== null ? toNumber(e.employerCost) : toNumber(e.gross)), 0);
      return {
        title: `Transférer la paie ${month}/${year} au budget « ${cat.name} »`,
        fields: [
          { label: "Mois", value: `${month}/${year}` },
          { label: "Salaires à transférer", value: `${entries.length} salaire·s payés (≈ ${dzd(total)} au coût employeur)` },
          { label: "Catégorie budgétaire", value: `${cat.name} (${cat.envelope.name})` },
        ],
        warnings: ["Une écriture SALAIRE (décaissement) est inscrite PAR employé, au COÛT EMPLOYEUR (brut + charges patronales), et imputée à la catégorie — le budget est consommé d'autant."],
        args: { year: String(year), month: String(month), budgetCategoryId: cat.id },
        successMessage: `Paie ${month}/${year} transférée au budget « ${cat.name} » (${entries.length} salaire·s).`,
        link: "/budgets", revalidate: ["/rh", "/finances", "/budgets"],
      };
    },
    execute: (args) => runFd(transferPayrollToBudget, args, "Le transfert au budget a été refusé.", { revalidate: ["/rh", "/finances", "/budgets"] }),
  },

  // ─────────────── Ligne budgétaire (suivi annuel) ───────────────

  create_budget_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const label = opStr(input, "label");
      if (!label) return { error: "Précisez le libellé de la ligne budgétaire (champ « label »)." };
      const dept = budgetLineDeptOf(opStr(input, "department"));
      if (!dept) return { error: "Précisez le domaine (champ « department ») : Regulatory | Sponsoring | Congrès international | Congrès national | Promotion médicale | Logistique | Business Development | Marketing." };
      const initial = num(input, "amount") ?? num(input, "initialBudget");
      const year = num(input, "year") ?? new Date().getFullYear();
      const month = opStr(input, "month") ? monthOf(opStr(input, "month")) : null;
      return {
        title: `Ligne budgétaire « ${label} » (${BUDGET_LINE_DEPTS[dept]}, ${year})`,
        fields: fieldsOf([
          ["Ligne", label], ["Domaine", BUDGET_LINE_DEPTS[dept]],
          ["Budget initial", initial !== null ? dzd(initial) : null],
          ["Année", String(year)], ["Mois", month ? String(month) : null],
          ["Commentaires", opStr(input, "notes") || null],
        ]),
        args: { label, department: dept, initialBudget: initial !== null ? String(initial) : null, year: String(year), month: month ? String(month) : null, comments: opStr(input, "notes") || null },
        successMessage: `Ligne budgétaire « ${label} » créée (${BUDGET_LINE_DEPTS[dept]}, ${year}).`,
        link: "/budgets", revalidate: ["/budgets"],
      };
    },
    execute: (args) => runFd2(createBudget, args, "La création de la ligne budgétaire a été refusée.", { revalidate: ["/budgets"] }),
  },

  // ─────────────── Centre de paiement — réponse du demandeur ───────────────

  respond_payment_centre: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const order = await resolveOrder(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in order) return order;
      const body = opStr(input, "message") || opStr(input, "note");
      if (!body) return { error: "Écrivez la réponse (champ « message ») — c'est l'argumentaire qui retourne au centre." };
      return {
        title: `Répondre au Centre de paiement — ${order.reference}`,
        fields: [
          { label: "Ordre", value: `${order.reference} — ${order.label} (${dzd(toNumber(order.amount))})` },
          { label: "Réponse", value: body },
        ],
        warnings: ["Le dossier retourne au Centre de paiement pour reprendre l'autorisation."],
        args: { id: order.id, body },
        successMessage: `Réponse envoyée — ${order.reference} retourne au Centre de paiement.`,
        revalidate: ["/centre-paiement"],
      };
    },
    execute: (args) => runFd(respondToPaymentCentre, args, "La réponse a été refusée.", { revalidate: ["/centre-paiement"] }),
  },
};
