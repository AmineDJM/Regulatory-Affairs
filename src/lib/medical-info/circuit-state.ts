import { prisma } from "@/lib/prisma";
import { circuitOfDeclaration, type MedicalCircuit } from "./circuits";
import { canFileWithAuthorities, type DeclareInput } from "./declare-decision";
import { slipsLotStage, slipsSummary, type SlipLike, type SlipsLotStage, type SlipsSummary } from "./slips";

/**
 * OÙ EN EST UN DOSSIER D'INFORMATION MÉDICALE — la lecture, une fois, pour l'écran comme pour
 * les actions.
 *
 * L'état ne vit dans aucun champ : il se compose du circuit (déduit de la nature du dossier), de
 * la décision de déclarer, de la validation du dépôt des bons, et de la route de CHAQUE bon —
 * demande de paiement, passage au centre, règlement, remise. Le stocker en plus aurait créé une
 * seconde vérité, qui se désynchronise au premier refus du centre.
 *
 * `circuits.ts`, `declare-decision.ts` et `slips.ts` décident ensuite CE QUE cet état autorise —
 * sans base, donc testables.
 */

export interface DeclarationLike {
  id: string;
  sourceType: string;
  declarationKind: string | null;
  declareValidationId: string | null;
  declareIntent: string | null;
  declareGrantedAt: Date | null;
  authorityRef: string | null;
  bvValidationId: string | null;
  bvSkippedAt: Date | null;
}

/** Un bon de versement tel qu'il se lit à l'écran : sa route, plus ce qui le nomme. */
export interface SlipRow extends SlipLike {
  note: string | null;
  position: number;
  deliveredById: string | null;
  deliveryNote: string | null;
}

export interface MedicalCircuitState {
  circuit: MedicalCircuit;
  /** Circuit ÉVÉNEMENT : la décision « faut-il déclarer ? ». */
  declare: DeclareInput;
  /** Circuit MATÉRIEL : la validation du dépôt du lot de bons. */
  lot: SlipsLotStage;
  slips: SlipRow[];
  summary: SlipsSummary;
  /** Le dossier a-t-il été déclaré sans versement ? (porte de sortie du circuit matériel) */
  skipped: boolean;
}

export async function circuitStateOf(decl: DeclarationLike): Promise<MedicalCircuitState> {
  const circuit = circuitOfDeclaration(decl);

  // LES LECTURES PARTENT ENSEMBLE : elles ne dépendent pas les unes des autres, et l'écran du
  // pharmacien attendrait trois allers-retours au lieu d'un.
  const [declareValidation, lotValidation, slipRows] = await Promise.all([
    decl.declareValidationId
      ? prisma.validationRequest.findUnique({ where: { id: decl.declareValidationId }, select: { status: true } })
      : Promise.resolve(null),
    decl.bvValidationId
      ? prisma.validationRequest.findUnique({ where: { id: decl.bvValidationId }, select: { status: true } })
      : Promise.resolve(null),
    prisma.medicalInfoSlip.findMany({
      where: { declarationId: decl.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // La route de chaque bon se lit sur son ordre de dépense. Un seul aller-retour pour tous : un
  // par bon multiplierait les requêtes par le nombre de matériels.
  const requestIds = slipRows.map((s) => s.requestId).filter((x): x is string => Boolean(x));
  const requests = requestIds.length
    ? await prisma.paymentRequest.findMany({
        where: { id: { in: requestIds } },
        select: { id: true, amount: true, expenseOrderId: true },
      })
    : [];
  const orderIds = requests.map((r) => r.expenseOrderId).filter((x): x is string => Boolean(x));
  const orders = orderIds.length
    ? await prisma.expenseOrder.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, centralStatus: true, status: true },
      })
    : [];
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const reqById = new Map(requests.map((r) => [r.id, r]));

  const slips: SlipRow[] = slipRows.map((s) => {
    const req = s.requestId ? reqById.get(s.requestId) : null;
    const order = req?.expenseOrderId ? orderById.get(req.expenseOrderId) : null;
    return {
      id: s.id,
      label: s.label,
      // LE MONTANT AFFICHÉ EST CELUI DE LA DEMANDE quand elle existe : la quittance réelle n'est
      // pas toujours celle annoncée, et montrer l'annonce après le règlement ferait douter du
      // chiffre payé.
      amount: req ? Number(req.amount) : (s.amount === null ? null : Number(s.amount)),
      note: s.note,
      position: s.position,
      requestId: s.requestId,
      centralStatus: order ? String(order.centralStatus) : null,
      orderStatus: order ? String(order.status) : null,
      deliveredAt: s.deliveredAt,
      deliveredById: s.deliveredById,
      deliveryNote: s.deliveryNote,
    };
  });

  return {
    circuit,
    declare: {
      validationId: decl.declareValidationId,
      validationStatus: declareValidation ? String(declareValidation.status) : null,
      intent: decl.declareIntent,
      grantedAt: decl.declareGrantedAt,
    },
    lot: slipsLotStage({
      validationId: decl.bvValidationId,
      validationStatus: lotValidation ? String(lotValidation.status) : null,
    }),
    slips,
    summary: slipsSummary(slips),
    skipped: Boolean(decl.bvSkippedAt),
  };
}

/**
 * LE DÉPÔT AUX AUTORITÉS EST-IL OUVERT ? — la règle des DEUX circuits, en un seul endroit.
 *
 * Circuit ÉVÉNEMENT : quand la lecture « à déclarer » a été accordée. Circuit MATÉRIEL : quand
 * toutes les quittances sont revenues au bureau du pharmacien — ou que le dossier a été déclaré
 * sans versement. Poser cette règle à deux endroits, c'est garantir qu'un jour ils divergeront.
 */
export function authoritiesOpen(state: MedicalCircuitState): boolean {
  if (state.circuit === "EVENT") return canFileWithAuthorities(state.declare);
  return state.summary.allDelivered || state.skipped;
}
