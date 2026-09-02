import type { EntityType, FinanceCategory } from "@prisma/client";
import { buildRef } from "@/lib/refs";
import { ENTITY_MODULE } from "@/lib/entity-access";
import { initialCentralStatus, isHighValue, CENTRAL_AUTH_THRESHOLD_DZD } from "@/lib/payments/authorization";
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
  /**
   * CE QUE L'ÉCHÉANCE PÈSE, déclaré par le demandeur — `FIXED`, `IMPORTANT`, `MODERATE`.
   * Elle voyage avec l'ordre : le centre arbitre et les Finances classent leur file dessus, et
   * aucun des deux n'a à rouvrir la demande d'origine pour l'apprendre.
   */
  deadlineNature?: string | null;
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
 * OÙ L'ENTITÉ D'UN ORDRE SE LIT — une source, une lecture, et la liste est EXHAUSTIVE.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Cette table était une cascade de quatre ternaires : SPONSORING, les deux congrès, le matériel
 * promo. Tout le reste tombait dans le `null` final — **y compris `PAYMENT_REQUEST`**, devenu
 * depuis la source la plus fréquente puisque le centre de paiement est le guichet unique. Les
 * ordres nés d'une demande de paiement naissaient donc SANS entité dès que le demandeur n'avait
 * pas de fiche salarié rattachée.
 *
 * Un ordre sans entité n'est pas seulement mal classé : il devient **invisible** à quiconque est
 * cloisonné sur une société — le filtre d'entité vaut `companyId = X`, et `NULL` n'est pas `X`.
 * Le Super Admin (vue groupe, aucun filtre) voyait la file entière ; le Directeur Général, lui,
 * ouvrait un centre de paiement vide. Exactement le défaut du pharmacien responsable, à un autre
 * endroit du code.
 *
 * ── POURQUOI UNE TABLE ET NON UNE CASCADE ───────────────────────────────────────────────────
 *
 * Parce qu'une cascade se complète en l'oubliant. Toutes les sources d'un ordre de dépense
 * portent un `companyId` : la table les nomme TOUTES, et `expense-orders.test.ts` échoue si un
 * `sourceType` réellement utilisé par le code n'y figure pas. Ajouter un circuit sans ajouter sa
 * ligne ne compilera pas en silence — il tombera au test.
 */
const COMPANY_OF_SOURCE: Partial<Record<EntityType, (id: string) => Promise<{ companyId: string | null } | null>>> = {
  PAYMENT_REQUEST: (id) => prisma.paymentRequest.findUnique({ where: { id }, select: { companyId: true } }),
  ADMIN_REQUEST: (id) => prisma.administrativeRequest.findUnique({ where: { id }, select: { companyId: true } }),
  MEDICAL_INFO_DECLARATION: (id) => prisma.medicalInfoDeclaration.findUnique({ where: { id }, select: { companyId: true } }),
  LEGAL_DOCUMENT: (id) => prisma.legalDocument.findUnique({ where: { id }, select: { companyId: true } }),
  SPONSORING: (id) => prisma.sponsoringRequest.findUnique({ where: { id }, select: { companyId: true } }),
  CONGRESS_NATIONAL: (id) => prisma.congressNational.findUnique({ where: { id }, select: { companyId: true } }),
  CONGRESS_INTERNATIONAL: (id) => prisma.congressInternational.findUnique({ where: { id }, select: { companyId: true } }),
  PROMO_MATERIAL: (id) => prisma.promoMaterial.findUnique({ where: { id }, select: { companyId: true } }),
  CONSULTING_CONTRACT: (id) => prisma.consultingContract.findUnique({ where: { id }, select: { companyId: true } }),
  EVENT: (id) => prisma.event.findUnique({ where: { id }, select: { companyId: true } }),
  REGULATORY_PRODUCT: (id) => prisma.regulatoryProduct.findUnique({ where: { id }, select: { companyId: true } }),
};

/**
 * `SALARY_ADVANCE` n'y figure pas, et c'est CORRECT : une avance sur salaire ne porte pas
 * d'entité — elle appartient à un salarié, et le repli sur la société de sa fiche donne la bonne
 * réponse. L'absence est donc une décision, pas un oubli ; le test la nomme explicitement.
 */

/** Les sources couvertes — lues par le test qui vérifie qu'aucun circuit n'a été oublié. */
export const EXPENSE_SOURCE_TYPES = Object.keys(COMPANY_OF_SOURCE) as EntityType[];

/**
 * L'entité d'un ordre de dépense se déduit de sa SOURCE — la demande qui l'a fait naître —
 * et non de la portée du navigateur : c'est la demande qui engage une société, pas l'écran
 * depuis lequel on valide. À défaut de source exploitable, on retombe sur la société
 * d'appartenance du demandeur ; à défaut encore, sur rien (l'ordre restera à rattacher).
 */
async function companyOfExpense(input: CreateExpenseOrderInput): Promise<string | null> {
  try {
    if (input.sourceId && input.sourceType) {
      const lire = COMPANY_OF_SOURCE[input.sourceType];
      const src = lire ? await lire(input.sourceId) : null;
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
  // TOUT décaissement passe. Tout ordre part « en attente » et n'arrive pas aux Finances tant que
  // le PDG ou le Super Admin ne l'a pas autorisé : plus de seuil, plus d'exemption de module. Le
  // seuil survit comme MARQUEUR (`isHighValue`) pour trier la file du centre, jamais comme filtre.
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
      deadlineNature: input.deadlineNature ?? null,
      budgetCategoryId: input.budgetCategoryId ?? null,
      requiresInvoice,
      centralStatus,
    },
  });

  const money = `${input.amount.toLocaleString("fr-FR")} DZD`;
  if (centralStatus === "AWAITING") {
    // On alerte LE CENTRE, pas les Finances : elles ne doivent rien voir tant que l'autorisation
    // n'est pas donnée. Les prévenir maintenant les ferait relancer un dossier qu'elles ne
    // peuvent pas traiter. Les montants importants le DISENT dans le corps du message : la file
    // du centre en compte désormais beaucoup, et tous ne se valent pas.
    await notifyRoles(["DIRECTION", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Autorisation de paiement demandée",
      body: `${order.reference} — ${input.label} (${money}${isHighValue(input.amount) ? `, au-dessus de ${CENTRAL_AUTH_THRESHOLD_DZD.toLocaleString("fr-FR")} DZD` : ""})`,
      link: "/centre-de-paiement",
    });
  } else {
    // Chemin HISTORIQUE : plus aucun ordre ne naît hors du centre. Il reste pour que la fonction
    // ne dépende pas d'une invariante qu'un futur changement de règle pourrait rompre en silence.
    await notifyRoles(["FINANCE_BUDGET_MANAGER", "SUPER_ADMIN"], {
      type: "VALIDATION_REQUIRED",
      title: "Nouvel ordre de dépense",
      body: `${order.reference} — ${input.label} (${money})`,
      link: "/finances/paiements-a-faire",
    });
  }
  return order;
}
