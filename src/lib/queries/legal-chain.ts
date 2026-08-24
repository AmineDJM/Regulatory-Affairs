import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { chainOf, type ChainDoc } from "@/lib/legal/chain";

/**
 * CHARGER LA CHAÎNE D'ACHAT d'un document — les maillons, leurs validateurs, le règlement.
 *
 * Le fil est court (devis → BC → facture, rarement plus de cinq pièces) : on le remonte par
 * requêtes successives plutôt qu'en SQL récursif — dix allers-retours au pire, bornés, lisibles.
 * L'ordre final vient du module pur `chainOf`, le même que testent les tests.
 */

export interface ChainValidator {
  name: string;
  state: string; // PENDING | APPROVED | REJECTED…
  decidedAt: string | null;
}

export interface ChainLink {
  id: string;
  kind: string;
  title: string;
  reference: string | null;
  amount: number | null;
  date: string | null; // startDate, à défaut createdAt — la date qui fait foi pour les délais
  isCurrent: boolean;
  validators: ChainValidator[];
}

export interface ChainSettlement {
  id: string;
  status: string; // PENDING | PAID…
  centralStatus: string; // NOT_REQUIRED | AWAITING | APPROVED…
  paidAt: string | null;
  amount: number;
}

const MAX_HOPS = 10;

export async function loadLegalChain(docId: string): Promise<{ links: ChainLink[]; settlement: ChainSettlement | null }> {
  type Row = {
    id: string; kind: string; title: string; reference: string | null;
    amount: unknown; startDate: Date | null; createdAt: Date; chainFromId: string | null; expenseOrderId: string | null;
  };
  const select = {
    id: true, kind: true, title: true, reference: true, amount: true,
    startDate: true, createdAt: true, chainFromId: true, expenseOrderId: true,
  } as const;

  const byId = new Map<string, Row>();
  const load = async (ids: string[]) => {
    const missing = ids.filter((i) => !byId.has(i));
    if (missing.length === 0) return;
    const rows = await prisma.legalDocument.findMany({ where: { id: { in: missing } }, select });
    for (const r of rows) byId.set(r.id, r);
  };

  await load([docId]);
  if (!byId.has(docId)) return { links: [], settlement: null };

  // Remonter les amonts, borné — un fil d'achat ne fait jamais dix maillons, une boucle si.
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const wanted = [...byId.values()].map((r) => r.chainFromId).filter((x): x is string => Boolean(x) && !byId.has(x!));
    if (wanted.length === 0) break;
    await load(wanted);
  }
  // Descendre : les pièces qui pointent vers ce qu'on connaît déjà.
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const children = await prisma.legalDocument.findMany({
      where: { chainFromId: { in: [...byId.keys()] }, id: { notIn: [...byId.keys()] } },
      select,
    });
    if (children.length === 0) break;
    for (const c of children) byId.set(c.id, c);
  }

  const docs: ChainDoc[] = [...byId.values()].map((r) => ({ id: r.id, kind: r.kind, chainFromId: r.chainFromId }));
  const ordered = chainOf(docs, docId);
  if (ordered.length === 0) return { links: [], settlement: null };

  // LES VALIDATEURS de chaque maillon : les étapes des demandes de validation qui le visent.
  const ids = ordered.map((d) => d.id);
  const validations = await prisma.validationRequest.findMany({
    where: { entityType: "LEGAL_DOCUMENT", entityId: { in: ids } },
    select: {
      entityId: true,
      steps: {
        select: { status: true, decidedAt: true, validator: { select: { name: true } } },
        orderBy: { order: "asc" },
      },
    },
  });
  const validatorsOf = new Map<string, ChainValidator[]>();
  for (const v of validations) {
    if (!v.entityId) continue;
    const list = validatorsOf.get(v.entityId) ?? [];
    for (const s of v.steps) {
      list.push({ name: s.validator.name, state: s.status, decidedAt: s.decidedAt?.toISOString() ?? null });
    }
    validatorsOf.set(v.entityId, list);
  }

  const links: ChainLink[] = ordered.map((d) => {
    const row = byId.get(d.id)!;
    return {
      id: row.id, kind: row.kind, title: row.title, reference: row.reference,
      amount: row.amount != null ? toNumber(row.amount as never) : null,
      date: (row.startDate ?? row.createdAt).toISOString(),
      isCurrent: row.id === docId,
      validators: validatorsOf.get(row.id) ?? [],
    };
  });

  // LE RÈGLEMENT — l'ordre de dépense de la facture du fil (le dernier maillon qui en a un).
  const invoice = [...ordered].reverse().map((d) => byId.get(d.id)!).find((r) => r.expenseOrderId);
  let settlement: ChainSettlement | null = null;
  if (invoice?.expenseOrderId) {
    const order = await prisma.expenseOrder.findUnique({
      where: { id: invoice.expenseOrderId },
      select: { id: true, status: true, centralStatus: true, paidDate: true, amount: true },
    });
    if (order) {
      settlement = {
        id: order.id, status: order.status, centralStatus: order.centralStatus,
        paidAt: order.paidDate?.toISOString() ?? null, amount: toNumber(order.amount),
      };
    }
  }

  return { links, settlement };
}
