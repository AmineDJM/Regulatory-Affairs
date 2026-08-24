import type { EntityType, FinanceCategory } from "@prisma/client";
import { buildRef } from "@/lib/refs";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { initialCentralStatus, CENTRAL_AUTH_THRESHOLD_DZD } from "@/lib/payments/authorization";
import { prisma } from "./prisma";
import { notifyRoles } from "./notify";

export async function nextExpenseRef(): Promise<string> {
  const year = new Date().getFullYear();
  const refs = await prisma.expenseOrder.findMany({ where: { reference: { startsWith: `OD-${year}-` } }, select: { reference: true } });
  return buildRef("OD", year, refs.map((r) => r.reference));
}

interface CreateExpenseOrderInput {
  label: string;
  amount: number;
  category: FinanceCategory;
  beneficiary?: string | null;
  sourceType?: EntityType;
  sourceId?: string;
  requestedById?: string | null;
  notes?: string | null;
  dueDate?: Date | null;
  /** (Sous-)catégorie budgétaire choisie par la Direction — attribution au règlement. */
  budgetCategoryId?: string | null;
}

// Dépenses « événementielles » : une facture est obligatoire avant le règlement.
const INVOICE_REQUIRED_SOURCES: EntityType[] = ["SPONSORING", "CONGRESS_INTERNATIONAL", "CONGRESS_NATIONAL", "PROMO_MATERIAL"];

/**
 * Emit an "ordre de dépense" for the accountant when the Direction (or RH) validates
 * a spend. Best-effort notification to the comptable role. Returns the created order.
 * Les dépenses événementielles (sponsoring, congrès, matériel promo) exigent une
 * facture jointe avant règlement.
 */
/**
 * L'entité d'un ordre de dépense se déduit de sa SOURCE — la demande qui l'a fait naître —
 * et non de la portée du navigateur : c'est la demande qui engage une société, pas l'écran
 * depuis lequel on valide. À défaut de source exploitable, on retombe sur la société
 * d'appartenance du demandeur ; à défaut encore, sur rien (l'ordre restera à rattacher).
 */
async function companyOfExpense(input: CreateExpenseOrderInput): Promise<string | null> {
  try {
    if (input.sourceId) {
      const sel = { select: { companyId: true } } as const;
      const src =
        input.sourceType === "SPONSORING" ? await prisma.sponsoringRequest.findUnique({ where: { id: input.sourceId }, ...sel })
          : input.sourceType === "CONGRESS_NATIONAL" ? await prisma.congressNational.findUnique({ where: { id: input.sourceId }, ...sel })
            : input.sourceType === "CONGRESS_INTERNATIONAL" ? await prisma.congressInternational.findUnique({ where: { id: input.sourceId }, ...sel })
              : input.sourceType === "PROMO_MATERIAL" ? await prisma.promoMaterial.findUnique({ where: { id: input.sourceId }, ...sel })
                : null;
      if (src?.companyId) return src.companyId;
    }
    if (input.requestedById) {
      const emp = await prisma.employee.findFirst({ where: { userId: input.requestedById }, select: { companyId: true } });
      if (emp?.companyId) return emp.companyId;
    }
  } catch (e) {
    // Le rattachement ne doit jamais empêcher l'émission de l'ordre : l'argent prime.
    console.error("[expense-orders] entité indéterminable", e);
  }
  return null;
}

export async function createExpenseOrder(input: CreateExpenseOrderInput) {
  const requiresInvoice = (input.sourceType ? INVOICE_REQUIRED_SOURCES.includes(input.sourceType) : false) || input.category === "EVENEMENT";

  // LE CENTRE DE PAIEMENT SE DÉCIDE ICI, à la naissance de l'ordre — le seul endroit par lequel
  // TOUT décaissement passe. Un ordre au-dessus du seuil part « en attente » et n'arrive pas aux
  // Finances tant que le PDG ou le Super Admin ne l'a pas autorisé ; au-dessous, il file
  // directement, comme avant. Les moyens généraux sont exemptés par leur module d'origine.
  const sourceModule = input.sourceType ? ENTITY_MODULE[input.sourceType] : null;
  const centralStatus = initialCentralStatus({ amount: input.amount, module: sourceModule });

  const order = await prisma.expenseOrder.create({
    data: {
      reference: await nextExpenseRef(),
      companyId: await companyOfExpense(input),
      label: input.label,
      amount: input.amount,
      category: input.category,
      beneficiary: input.beneficiary ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      requestedById: input.requestedById ?? null,
      notes: input.notes ?? null,
      dueDate: input.dueDate ?? null,
      budgetCategoryId: input.budgetCategoryId ?? null,
      requiresInvoice,
      centralStatus,
    },
  });

  const money = `${input.amount.toLocaleString("fr-FR")} DZD`;
  if (centralStatus === "AWAITING") {
    // On alerte LE CENTRE, pas les Finances : elles ne doivent rien voir tant que l'autorisation
    // n'est pas donnée. Les prévenir maintenant les ferait relancer un dossier qu'elles ne
    // peuvent pas traiter.
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Autorisation de paiement demandée",
      body: `${order.reference} — ${input.label} (${money}, au-dessus de ${CENTRAL_AUTH_THRESHOLD_DZD.toLocaleString("fr-FR")} DZD)`,
      link: "/finances/centre-de-paiement",
    });
  } else {
    await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Nouvel ordre de dépense",
      body: `${order.reference} — ${input.label} (${money})`,
      link: "/finances/ordres-de-depense",
    });
  }
  return order;
}
