import { prisma } from "@/lib/prisma";
import { currentCompanyWhere } from "@/lib/company";
import { toNumber } from "@/lib/utils";

const dec = (v: unknown): number | null => (v === null || v === undefined ? null : toNumber(v));

export interface PchOrderDTO {
  id: string;
  reference: string;
  products: string;
  quantity: number;
  value: number | null;
  status: string;
  receivedDate: string | null;
  paymentDate: string | null;
  expectedArrival: string | null;
  arrivedDate: string | null;
  notes: string;
}

export interface PchTenderLineDTO {
  id: string;
  designation: string;
  dci: string | null;
  dosage: string | null;
  form: string | null;
  quantityUnits: number;
  unitsPerBox: number | null;
  boxesNeeded: number | null; // calculé : ceil(unités / unitsPerBox)
  haveProduct: boolean;
  ourProduct: string | null;
  unitPriceDzd: number | null;
  suppliersInfo: string | null;
  competitorCount: number | null;
  registeredNomenclature: boolean;
  nomLines: number | null;
  marketEstimateDzd: number | null;
  status: string;
  awardedUnitPriceDzd: number | null;
  note: string | null;
}

export interface PchTenderDTO {
  id: string;
  reference: string;
  title: string;
  products: string;
  supplier: string;
  supplierCountry: string;
  quantity: number;
  value: number | null;
  client: string;
  status: string;
  awardDate: string | null;
  cautionAmount: number | null;
  cautionDeposited: boolean;
  cautionStart: string | null;
  cautionEnd: string | null;
  notes: string;
  orderCount: number;
  orderedValue: number;
  orders: PchOrderDTO[];
  lines: PchTenderLineDTO[];
}

function toOrderDTO(o: { id: string; reference: string | null; products: string | null; quantity: number; value: unknown; status: string; receivedDate: Date | null; paymentDate: Date | null; expectedArrival: Date | null; arrivedDate: Date | null; notes: string | null }): PchOrderDTO {
  return {
    id: o.id, reference: o.reference ?? "", products: o.products ?? "", quantity: o.quantity,
    value: dec(o.value), status: o.status,
    receivedDate: o.receivedDate?.toISOString() ?? null, paymentDate: o.paymentDate?.toISOString() ?? null,
    expectedArrival: o.expectedArrival?.toISOString() ?? null, arrivedDate: o.arrivedDate?.toISOString() ?? null,
    notes: o.notes ?? "",
  };
}

type LineRow = { id: string; designation: string; dci: string | null; dosage: string | null; form: string | null; quantityUnits: number; unitsPerBox: number | null; haveProduct: boolean; ourProduct: string | null; unitPriceDzd: unknown; suppliersInfo: string | null; competitorCount: number | null; registeredNomenclature: boolean; nomLines: number | null; marketEstimateDzd: unknown; status: string; awardedUnitPriceDzd: unknown; note: string | null };
function toLineDTO(l: LineRow): PchTenderLineDTO {
  const boxesNeeded = l.unitsPerBox && l.unitsPerBox > 0 ? Math.ceil(l.quantityUnits / l.unitsPerBox) : null;
  return {
    id: l.id, designation: l.designation, dci: l.dci, dosage: l.dosage, form: l.form,
    quantityUnits: l.quantityUnits, unitsPerBox: l.unitsPerBox, boxesNeeded,
    haveProduct: l.haveProduct, ourProduct: l.ourProduct, unitPriceDzd: dec(l.unitPriceDzd),
    suppliersInfo: l.suppliersInfo, competitorCount: l.competitorCount,
    registeredNomenclature: l.registeredNomenclature, nomLines: l.nomLines, marketEstimateDzd: dec(l.marketEstimateDzd),
    status: l.status, awardedUnitPriceDzd: dec(l.awardedUnitPriceDzd), note: l.note,
  };
}

function toTenderDTO(t: Awaited<ReturnType<typeof fetchTenders>>[number], lines: LineRow[] = []): PchTenderDTO {
  const orders = t.orders.map(toOrderDTO);
  return {
    id: t.id, reference: t.reference, title: t.title ?? "", products: t.products ?? "",
    supplier: t.supplier ?? "", supplierCountry: t.supplierCountry ?? "", quantity: t.quantity,
    value: dec(t.value), client: t.client, status: t.status, awardDate: t.awardDate?.toISOString() ?? null,
    cautionAmount: dec(t.cautionAmount), cautionDeposited: t.cautionDeposited,
    cautionStart: t.cautionStart?.toISOString() ?? null, cautionEnd: t.cautionEnd?.toISOString() ?? null,
    notes: t.notes ?? "",
    orderCount: orders.length,
    orderedValue: orders.reduce((a, o) => a + (o.value ?? 0), 0),
    orders,
    lines: lines.map(toLineDTO),
  };
}

function fetchTenders() {
  return prisma.pchTender.findMany({
    where: { ...currentCompanyWhere() },
    include: { orders: { orderBy: { createdAt: "desc" } } },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getPchTenders(): Promise<PchTenderDTO[]> {
  return (await fetchTenders()).map((t) => toTenderDTO(t));
}

export async function getPchTenderDetail(id: string): Promise<PchTenderDTO | null> {
  const t = await prisma.pchTender.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" } }, lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
  return t ? toTenderDTO(t, t.lines) : null;
}

export function pchSummary(tenders: PchTenderDTO[]) {
  const now = new Date();
  return {
    count: tenders.length,
    inProgress: tenders.filter((t) => t.status === "IN_PROGRESS").length,
    totalValue: tenders.reduce((a, t) => a + (t.value ?? 0), 0),
    cautionsToDeposit: tenders.filter((t) => (t.cautionAmount ?? 0) > 0 && !t.cautionDeposited).length,
    cautionsExpiringSoon: tenders.filter((t) => t.cautionDeposited && t.cautionEnd && new Date(t.cautionEnd) > now && (new Date(t.cautionEnd).getTime() - now.getTime()) < 30 * 864e5).length,
  };
}
