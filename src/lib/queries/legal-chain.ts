import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import { companyScopedWhere } from "@/lib/company";
import { natureLegale } from "@/lib/labels";
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

/** Les pièces amont proposées au menu : les plus récentes — un menu de trois mille pièces ne se lit pas. */
export const AMONT_PROPOSEES = 100;

export interface OptionAmont { value: string; label: string }

/** Le libellé d'une pièce amont qu'on ne peut pas lire : garder le lien n'en révèle pas le titre. */
export const AMONT_HORS_PERIMETRE = "Pièce amont actuelle (hors de votre périmètre)";

/**
 * LES PIÈCES AMONT PROPOSÉES au menu « Fait suite à » — et, à la modification, la pièce ACTUELLE
 * toujours, en tête (§118.168).
 *
 * Le menu ne montre que les cent devis et bons de commande les plus récents. Une facture chaînée à
 * un BC plus ancien n'y retrouvait donc pas son BC : le navigateur affichait « — Pièce isolée — »,
 * et un simple « Enregistrer » (pour corriger une date) la DÉTACHAIT de son bon de commande, sans un
 * mot. Détachée, elle sortait de tout ce qui lit la chaîne : le cumul des factures d'un BC (on ne
 * paie pas plus que la commande), la règle « la facture d'un BC non validé ne part pas », l'écran
 * d'exécution d'un dossier. Un formulaire qui efface ce qu'on ne touche pas (§118.152c).
 *
 * La pièce actuelle hors du périmètre de la personne (une autre société, un document restreint)
 * reste proposée sous un libellé NEUTRE : garder un lien n'accorde rien, l'effacer parce qu'on ne
 * voit pas sa cible serait la perte silencieuse, et nommer son titre le révélerait.
 */
export async function piecesAmontProposees(opts: {
  userId: string;
  readerScope: Prisma.LegalDocumentWhereInput | null;
  /** La pièce qu'on modifie — jamais candidate à se suivre elle-même. */
  docId?: string;
  /** Sa pièce amont ACTUELLE, à la modification. */
  actuelId?: string | null;
}): Promise<OptionAmont[]> {
  // Même porte que la liste : le cloisonnement par entité ET les lecteurs désignés tiennent sur ce
  // que le menu propose — on ne chaîne pas une facture au bon de commande d'une autre société.
  const portee = (extra: Prisma.LegalDocumentWhereInput) =>
    companyScopedWhere<Prisma.LegalDocumentWhereInput>(opts.userId, {
      AND: [...(opts.readerScope ? [opts.readerScope] : []), extra],
    });
  const select = { id: true, kind: true, reference: true, title: true } as const;
  const [recentes, actuelle] = await Promise.all([
    prisma.legalDocument.findMany({
      where: await portee({ kind: { in: ["QUOTE", "PURCHASE_ORDER"] }, ...(opts.docId ? { id: { not: opts.docId } } : {}) }),
      select, orderBy: { createdAt: "desc" }, take: AMONT_PROPOSEES,
    }),
    opts.actuelId
      ? prisma.legalDocument.findFirst({ where: await portee({ id: opts.actuelId }), select })
      : Promise.resolve(null),
  ]);
  const libelle = (r: { kind: string; reference: string | null; title: string }) =>
    `${natureLegale(r.kind)} — ${r.reference ? `${r.reference} · ` : ""}${r.title}`;
  const options = recentes.map((r) => ({ value: r.id, label: libelle(r) }));
  if (!opts.actuelId || options.some((o) => o.value === opts.actuelId)) return options;
  return [{ value: opts.actuelId, label: actuelle ? libelle(actuelle) : AMONT_HORS_PERIMETRE }, ...options];
}
