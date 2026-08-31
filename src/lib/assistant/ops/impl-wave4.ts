import { prisma } from "@/lib/prisma";
import { MANUFACTURING_STATUS, VARIATION_STATUS } from "@/lib/labels";
import { REG_STEPS } from "@/lib/regulatory-workflow";
import {
  createRegulatorySupplier, unlockAllRegulatory, setRegulatoryStepNote, deleteVariation,
} from "@/lib/actions/regulatory-actions";
import { linkProductToDossier, unlinkProductFromDossier } from "@/lib/actions/product-catalog-actions";
import {
  createTender, updateTender, deleteTender, createOrder, updateOrder, deleteOrder,
} from "@/lib/actions/pch-actions";
import {
  addTenderLine, updateTenderLine, deleteTenderLine, analyzeTenderText,
  createOrderFromLine, enrichTenderLine, enrichAllTenderLines, setOrderArrival,
} from "@/lib/actions/pch-tender-line-actions";
import {
  createStockHospital, deleteStockHospital, createStockAnnex, deleteStockAnnex,
  recordStockSnapshot, deleteStockSnapshot,
} from "@/lib/actions/stock-snapshot-actions";
import { createSale, importSales } from "@/lib/actions/sales-actions";
import { createLogistics, updateLogisticsStatus } from "@/lib/actions/logistics-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, fieldsOf, resolveOne, isoDate, dzd } from "./helpers";
import { resolveRegProduct, matchLabel, fold } from "./impl-regulatory";

/**
 * OPS VAGUE 4a — REGULATORY (fournisseurs, déverrouillage global, notes d'étapes du workflow,
 * variations, rapprochement des catalogues), PCH / MARCHÉS (appels d'offres et bons de commande
 * en FUSION intégrale, lignes-produits, analyse IA d'un texte d'AO, enrichissement marché,
 * suivi d'arrivée), STOCKS (hôpitaux / annexes / états datés), VENTES (saisie + import CSV
 * collé), LOGISTIQUE (commandes d'acheminement + jalons). Toujours par les ACTIONS CANONIQUES.
 */

const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
const numStr = (v: unknown): string | null => (v == null ? null : String(Number(v)));

// ─────────────────────────── REGULATORY (reste) ───────────────────────────

/** Les étapes du WORKFLOW JSON (chronologie du dossier) — « 5 » ou un bout du libellé. */
function matchWorkflowStep(raw: string): { key: string; label: string } | { error: string } {
  const q = raw.trim();
  if (!q) return { error: `Précisez l'étape (champ « step ») : son numéro (1 à ${REG_STEPS.length}) ou son libellé.` };
  const byNumber = REG_STEPS.find((s) => String(s.n) === q.replace(/^étape\s*/i, "").trim());
  if (byNumber) return { key: byNumber.key, label: `${byNumber.n}. ${byNumber.label}` };
  const m = matchLabel(q, REG_STEPS.map((s) => [s.key, s.label] as [string, string]));
  if (typeof m === "object") return m;
  const step = REG_STEPS.find((s) => s.key === m)!;
  return { key: step.key, label: `${step.n}. ${step.label}` };
}

export const REG4_OPS_IMPL: Record<string, OpImpl> = {
  create_supplier: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name");
      if (!name) return { error: "Précisez le nom du fournisseur (champ « name »)." };
      const dup = await prisma.supplier.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
      return {
        title: `Nouveau fournisseur « ${name} »`,
        fields: fieldsOf([
          ["Fournisseur", name], ["Pays", opStr(input, "country") || null],
          ["Contact", opStr(input, "contact") || null], ["Notes", opStr(input, "notes") || null],
        ]),
        warnings: dup ? [`Un fournisseur « ${name} » existe DÉJÀ — confirmer créera un doublon.`] : [],
        args: { name, country: opStr(input, "country") || null, contactEmail: opStr(input, "contact") || null, notes: opStr(input, "notes") || null },
        successMessage: `Fournisseur « ${name} » créé.`,
        revalidate: ["/regulatory"],
      };
    },
    execute: (args) => runFd(createRegulatorySupplier, args, "La création du fournisseur a été refusée.", { revalidate: ["/regulatory"] }),
  },

  unlock_all: {
    async propose(): Promise<OpProposalDraft | { error: string }> {
      const count = await prisma.regulatoryProduct.count({ where: { isLocked: true } });
      if (count === 0) return { error: "Aucun dossier verrouillé — rien à déverrouiller." };
      return {
        title: `Déverrouiller les ${count} dossiers réglementaires d'un coup`,
        fields: [{ label: "Dossiers cadenassés", value: String(count) }],
        warnings: ["TOUS les dossiers verrouillés deviennent visibles de l'équipe (portefeuille confidentiel exposé) — geste réservé au détenteur du cadenas."],
        args: {},
        successMessage: `${count} dossier(s) déverrouillé(s) — visibles par l'équipe.`,
        revalidate: ["/regulatory"],
      };
    },
    async execute() {
      const r = await unlockAllRegulatory();
      if (!r.ok) return { ok: false, error: r.error ?? "Le déverrouillage a été refusé." };
      return { ok: true, revalidate: ["/regulatory"] };
    },
  },

  set_step_note: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const product = await resolveRegProduct(user, opStr(input, "reference"));
      if ("error" in product) return product;
      const step = matchWorkflowStep(opStr(input, "step"));
      if ("error" in step) return step;
      const note = opStr(input, "note");
      const clearing = /^(aucune?|retire|efface|vide)$/i.test(note);
      if (!note) return { error: "Donnez la note (champ « note ») — ou « aucune » pour l'effacer." };
      return {
        title: `Note d'étape — ${product.reference}`,
        fields: [
          { label: "Dossier", value: `${product.reference} — ${product.dci}` },
          { label: "Étape", value: step.label },
          { label: "Note", value: clearing ? "— (effacée)" : note },
        ],
        args: { productId: product.id, stepKey: step.key, note: clearing ? null : note, reference: product.reference },
        successMessage: `Note ${clearing ? "effacée" : "posée"} sur « ${step.label} » (${product.reference}).`,
        link: `/regulatory/${product.id}`, revalidate: ["/regulatory"],
      };
    },
    execute: (args) => runFd(setRegulatoryStepNote, args, "La note d'étape a été refusée.", { revalidate: ["/regulatory"] }),
  },

  delete_variation: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const product = await resolveRegProduct(user, opStr(input, "reference"));
      if ("error" in product) return product;
      const variations = await prisma.regulatoryVariation.findMany({
        where: { productId: product.id },
        select: { id: true, toStatus: true, status: true },
        orderBy: { createdAt: "desc" }, take: 6,
      });
      if (variations.length === 0) return { error: `Aucune variation sur ${product.reference}.` };
      const wanted = fold(opStr(input, "target"));
      const hits = wanted
        ? variations.filter((v) => fold(MANUFACTURING_STATUS[v.toStatus] ?? v.toStatus).includes(wanted))
        : variations;
      const pick = hits.length === 1 ? hits[0] : variations.length === 1 ? variations[0] : null;
      if (!pick) {
        return { error: `Plusieurs variations sur ${product.reference} : ${variations.map((v) => `${MANUFACTURING_STATUS[v.toStatus] ?? v.toStatus} (${VARIATION_STATUS[v.status]?.label ?? v.status})`).join(" ; ")} — préciser la cible (champ « target »).` };
      }
      return {
        title: `SUPPRIMER la variation ${MANUFACTURING_STATUS[pick.toStatus] ?? pick.toStatus} de ${product.reference}`,
        fields: [
          { label: "Dossier", value: `${product.reference} — ${product.dci}` },
          { label: "Variation", value: `${MANUFACTURING_STATUS[pick.toStatus] ?? pick.toStatus} (${VARIATION_STATUS[pick.status]?.label ?? pick.status})` },
        ],
        warnings: ["Suppression définitive de la variation (dates de dépôt / décision comprises) — le statut de fabrication du produit, lui, ne bouge pas."],
        confirmText: product.reference,
        args: { id: pick.id, reference: product.reference },
        successMessage: `Variation de ${product.reference} supprimée.`,
        link: `/regulatory/${product.id}`, revalidate: ["/regulatory"],
      };
    },
    execute: (args) => runFd(deleteVariation, args, "La suppression de la variation a été refusée.", { revalidate: ["/regulatory"] }),
  },

  link_catalog_product: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const raw = opStr(input, "name");
      if (!raw) return { error: "Précisez le produit du catalogue à rattacher (champ « name »)." };
      const wantPromo = /promo|promu/i.test(opStr(input, "kind"));
      const wantBd = /bd|business|d[ée]veloppement/i.test(opStr(input, "kind"));
      const [bd, promo] = await Promise.all([
        wantPromo ? [] : prisma.bdProduct.findMany({ where: { dci: { contains: raw, mode: "insensitive" } }, select: { id: true, dci: true, regulatoryProductId: true }, take: 4 }),
        wantBd ? [] : prisma.promoProduct.findMany({ where: { name: { contains: raw, mode: "insensitive" } }, select: { id: true, name: true, regulatoryProductId: true }, take: 4 }),
      ]);
      const total = bd.length + promo.length;
      if (total === 0) return { error: `Aucun produit « ${raw} » dans les catalogues BD / promotion.` };
      if (total > 1) {
        const list = [...bd.map((p) => `${p.dci} (BD)`), ...promo.map((p) => `${p.name} (promotion)`)];
        return { error: `Plusieurs produits correspondent : ${list.join(" ; ")} — préciser (champ « kind » : BD ou promotion).` };
      }
      const kind = bd.length === 1 ? "BD" as const : "PROMO" as const;
      const item = bd.length === 1 ? { id: bd[0].id, label: `${bd[0].dci} (catalogue BD)`, linked: bd[0].regulatoryProductId } : { id: promo[0].id, label: `${promo[0].name} (catalogue promotion)`, linked: promo[0].regulatoryProductId };
      const dossier = await resolveRegProduct(user, opStr(input, "reference"));
      if ("error" in dossier) return dossier;
      return {
        title: `Rattacher « ${item.label} » au dossier ${dossier.reference}`,
        fields: [
          { label: "Produit", value: item.label },
          { label: "Dossier réglementaire", value: `${dossier.reference} — ${dossier.dci}` },
        ],
        warnings: item.linked ? ["Ce produit est DÉJÀ rattaché à un dossier — le rattachement sera remplacé."] : [],
        args: { kind, id: item.id, regulatoryProductId: dossier.id },
        successMessage: `« ${item.label} » rattaché à ${dossier.reference}.`,
        revalidate: ["/regulatory/catalogue"],
      };
    },
    async execute(args) {
      const r = await linkProductToDossier({ kind: (args.kind ?? "BD") as "BD" | "PROMO", id: args.id ?? "", regulatoryProductId: args.regulatoryProductId ?? "" });
      if (!r.ok) return { ok: false, error: r.error ?? "Le rattachement a été refusé." };
      return { ok: true, revalidate: ["/regulatory/catalogue"] };
    },
  },

  unlink_catalog_product: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const raw = opStr(input, "name");
      if (!raw) return { error: "Précisez le produit du catalogue (champ « name »)." };
      const [bd, promo] = await Promise.all([
        prisma.bdProduct.findMany({ where: { dci: { contains: raw, mode: "insensitive" }, regulatoryProductId: { not: null } }, select: { id: true, dci: true }, take: 4 }),
        prisma.promoProduct.findMany({ where: { name: { contains: raw, mode: "insensitive" }, regulatoryProductId: { not: null } }, select: { id: true, name: true }, take: 4 }),
      ]);
      const total = bd.length + promo.length;
      if (total === 0) return { error: `Aucun produit RATTACHÉ « ${raw} » dans les catalogues.` };
      if (total > 1) {
        const list = [...bd.map((p) => `${p.dci} (BD)`), ...promo.map((p) => `${p.name} (promotion)`)];
        return { error: `Plusieurs produits rattachés correspondent : ${list.join(" ; ")} — préciser.` };
      }
      const kind = bd.length === 1 ? "BD" as const : "PROMO" as const;
      const label = bd.length === 1 ? `${bd[0].dci} (catalogue BD)` : `${promo[0].name} (catalogue promotion)`;
      return {
        title: `Défaire le rattachement de « ${label} »`,
        fields: [{ label: "Produit", value: label }],
        warnings: ["Le produit n'est plus rattaché à aucun dossier réglementaire (le dossier, lui, reste)."],
        args: { kind, id: bd.length === 1 ? bd[0].id : promo[0].id },
        successMessage: `Rattachement de « ${label} » défait.`,
        revalidate: ["/regulatory/catalogue"],
      };
    },
    async execute(args) {
      const r = await unlinkProductFromDossier({ kind: (args.kind ?? "BD") as "BD" | "PROMO", id: args.id ?? "" });
      if (!r.ok) return { ok: false, error: r.error ?? "Le détachement a été refusé." };
      return { ok: true, revalidate: ["/regulatory/catalogue"] };
    },
  },
};

// ─────────────────────────── PCH / MARCHÉS ───────────────────────────

export interface TenderHit { id: string; reference: string; title: string | null }

export async function resolveTender(raw: string): Promise<TenderHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez l'appel d'offres (champ « reference » — AO-AAAA-NNN, titre ou produits)." };
  const exact = await prisma.pchTender.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, title: true },
  });
  if (exact) return exact;
  const rows = await prisma.pchTender.findMany({
    where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { products: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, title: true },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun appel d'offres « ${q} ».` };
  return { error: `Plusieurs appels d'offres correspondent : ${rows.map((t) => `${t.reference}${t.title ? ` — ${t.title}` : ""}`).join(" ; ")} — donner la référence exacte.` };
}

export const tenderLabel = (t: TenderHit): string => `${t.reference}${t.title ? ` — ${t.title}` : ""}`;

async function resolveTenderLine(tenderId: string, tenderRef: string, raw: string) {
  const rows = await prisma.pchTenderLine.findMany({
    where: { tenderId }, select: { id: true, designation: true, dci: true, status: true },
    orderBy: { sortOrder: "asc" }, take: 40,
  });
  if (rows.length === 0) return { error: `L'appel d'offres ${tenderRef} n'a aucune ligne-produit.` } as const;
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez la ligne (champ « line ») parmi : ${rows.slice(0, 10).map((l) => l.designation).join(" ; ")}${rows.length > 10 ? " ; …" : ""}.` } as const;
  }
  const hits = rows.filter((l) => fold(l.designation).includes(q) || (l.dci && fold(l.dci).includes(q)));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucune ligne « ${raw} » sur ${tenderRef} — lignes : ${rows.slice(0, 10).map((l) => l.designation).join(" ; ")}.` } as const;
  return { error: `Plusieurs lignes correspondent : ${hits.map((l) => l.designation).join(" ; ")} — préciser.` } as const;
}

export async function resolvePchOrder(tenderId: string, tenderRef: string, raw: string) {
  const rows = await prisma.pchOrder.findMany({
    where: { tenderId }, select: { id: true, reference: true, products: true },
    orderBy: { createdAt: "desc" }, take: 20,
  });
  if (rows.length === 0) return { error: `Aucun bon de commande sur ${tenderRef}.` } as const;
  const q = fold(raw);
  const label = (o: { reference: string | null; products: string | null }) => o.reference ?? o.products ?? "s/n";
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez le bon de commande (champ « order ») parmi : ${rows.map(label).join(" ; ")}.` } as const;
  }
  const hits = rows.filter((o) => fold(o.reference ?? "").includes(q) || fold(o.products ?? "").includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucun bon de commande « ${raw} » sur ${tenderRef} — présents : ${rows.map(label).join(" ; ")}.` } as const;
  return { error: `Plusieurs bons de commande correspondent : ${hits.map(label).join(" ; ")} — préciser.` } as const;
}

const TENDER_STATUS_FR: [string, string][] = [
  ["NOT_STARTED", "Non commencé"], ["IN_PROGRESS", "En cours"], ["COMPLETED", "Terminé"], ["CANCELLED", "Annulé"],
];
const ORDER_STATUS_FR: [string, string][] = [
  ["PENDING", "En attente"], ["VALIDATED", "Validé"], ["DELIVERED", "Livré"], ["PAID", "Payé"], ["CANCELLED", "Annulé"],
];
const LINE_STATUS_FR: [string, string][] = [
  ["PENDING", "En attente"], ["QUOTED", "Chiffré"], ["SUBMITTED", "Soumis"], ["WON", "Gagné"], ["LOST", "Perdu"],
];

function statusIn(raw: string, entries: [string, string][]): string | null | { error: string } {
  const q = raw.trim();
  if (!q) return null;
  const m = matchLabel(q, entries);
  return typeof m === "object" ? m : m;
}

export const PCH_OPS_IMPL: Record<string, OpImpl> = {
  create_tender: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "name") || opStr(input, "label");
      const products = opStr(input, "products");
      if (!title && !products) return { error: "Précisez au moins le titre du marché (champ « name ») ou ses produits (champ « products »)." };
      const status = statusIn(opStr(input, "status"), TENDER_STATUS_FR);
      if (status && typeof status === "object") return status;
      const amount = opStr(input, "amount");
      return {
        title: `Nouvel appel d'offres PCH${title ? ` « ${title} »` : ""}`,
        fields: fieldsOf([
          ["Titre", title || null], ["Produits", products || null],
          ["Fournisseur", opStr(input, "supplier") || null], ["Pays", opStr(input, "country") || null],
          ["Quantité", opStr(input, "quantity") || null],
          ["Valeur", amount ? dzd(Number(amount)) : null],
          ["Attribution", isoDate(opStr(input, "date"))],
          ["Notes", opStr(input, "notes") || null],
        ]),
        warnings: ["La référence AO-AAAA-NNN est numérotée automatiquement."],
        args: {
          title: title || null, products: products || null,
          supplier: opStr(input, "supplier") || null, supplierCountry: opStr(input, "country") || null,
          quantity: opStr(input, "quantity") || null, value: amount || null,
          status: (status as string | null), awardDate: isoDate(opStr(input, "date")),
          notes: opStr(input, "notes") || null,
        },
        successMessage: `Appel d'offres${title ? ` « ${title} »` : ""} créé.`,
        link: "/pch", revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd2(createTender, args, "La création de l'appel d'offres a été refusée.", { revalidate: ["/pch"] }),
  },

  update_tender: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const t = await prisma.pchTender.findUnique({ where: { id: tender.id } });
      if (!t) return { error: "Appel d'offres introuvable." };
      const status = statusIn(opStr(input, "status"), TENDER_STATUS_FR);
      if (status && typeof status === "object") return status;
      // FUSION : l'action REMPLACE tous les champs (texte absent → null, quantité absente → 0,
      // caution absente → décochée) — l'existant est relu et rejoué là où rien n'est demandé.
      const changes: string[] = [];
      const pick = (key: string, current: string | null, label: string): string | null => {
        const v = opStr(input, key);
        if (v) { changes.push(label); return v; }
        return current;
      };
      const title = pick("name", t.title, "titre");
      const products = pick("products", t.products, "produits");
      const supplier = pick("supplier", t.supplier, "fournisseur");
      const country = pick("country", t.supplierCountry, "pays");
      const quantity = opStr(input, "quantity") ? (changes.push("quantité"), opStr(input, "quantity")) : String(t.quantity);
      const value = opStr(input, "amount") ? (changes.push("valeur"), opStr(input, "amount")) : numStr(t.value);
      const awardDate = isoDate(opStr(input, "date")) ? (changes.push("date d'attribution"), isoDate(opStr(input, "date"))) : day(t.awardDate);
      const notes = pick("notes", t.notes, "notes");
      if (status) changes.push(`statut → ${TENDER_STATUS_FR.find(([c]) => c === status)?.[1] ?? status}`);
      if (changes.length === 0) return { error: "Rien à changer : donnez name, products, supplier, country, quantity, amount, status, date ou notes." };
      return {
        title: `Modifier l'appel d'offres ${tender.reference}`,
        fields: [
          { label: "Marché", value: tenderLabel(tender) },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique (caution comprise)" },
        ],
        args: {
          id: tender.id, title, products, supplier, supplierCountry: country,
          quantity, value, client: t.client, status: (status as string | null),
          awardDate, notes,
          cautionAmount: numStr(t.cautionAmount), cautionDeposited: t.cautionDeposited ? "1" : null,
          cautionStart: day(t.cautionStart), cautionEnd: day(t.cautionEnd),
          reference: tender.reference,
        },
        successMessage: `Appel d'offres ${tender.reference} mis à jour (${changes.join(", ")}).`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(updateTender, args, "La modification de l'appel d'offres a été refusée.", { revalidate: ["/pch"] }),
  },

  delete_tender: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const [orders, lines] = await Promise.all([
        prisma.pchOrder.count({ where: { tenderId: tender.id } }),
        prisma.pchTenderLine.count({ where: { tenderId: tender.id } }),
      ]);
      return {
        title: `SUPPRIMER l'appel d'offres ${tender.reference}`,
        fields: [
          { label: "Marché", value: tenderLabel(tender) },
          { label: "Emporte avec lui", value: `${orders} bon(s) de commande, ${lines} ligne(s)-produit` },
        ],
        warnings: ["Suppression définitive EN CASCADE : les bons de commande et lignes-produits du marché disparaissent avec lui."],
        confirmText: tender.reference,
        args: { id: tender.id },
        successMessage: `Appel d'offres ${tender.reference} supprimé (cascade comprise).`,
        revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(deleteTender, args, "La suppression a été refusée.", { revalidate: ["/pch"] }),
  },

  create_order: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const status = statusIn(opStr(input, "status"), ORDER_STATUS_FR);
      if (status && typeof status === "object") return status;
      const amount = opStr(input, "amount");
      return {
        title: `Bon de commande sur ${tender.reference}`,
        fields: fieldsOf([
          ["Marché", tenderLabel(tender)],
          ["N° du bon", opStr(input, "order") || null],
          ["Produits", opStr(input, "products") || null],
          ["Quantité", opStr(input, "quantity") || null],
          ["Valeur", amount ? dzd(Number(amount)) : null],
          ["Reçu le", isoDate(opStr(input, "date"))],
          ["Notes", opStr(input, "notes") || null],
        ]),
        args: {
          tenderId: tender.id, reference: opStr(input, "order") || null,
          products: opStr(input, "products") || null, quantity: opStr(input, "quantity") || null,
          value: amount || null, status: (status as string | null),
          receivedDate: isoDate(opStr(input, "date")), notes: opStr(input, "notes") || null,
        },
        successMessage: `Bon de commande créé sur ${tender.reference}.`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(createOrder, args, "La création du bon de commande a été refusée.", { revalidate: ["/pch"] }),
  },

  update_order: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const o = await prisma.pchOrder.findUnique({ where: { id: hit.id } });
      if (!o) return { error: "Bon de commande introuvable." };
      const status = statusIn(opStr(input, "status"), ORDER_STATUS_FR);
      if (status && typeof status === "object") return status;
      const changes: string[] = [];
      const orderRef = opStr(input, "newName") ? (changes.push("n°"), opStr(input, "newName")) : o.reference;
      const products = opStr(input, "products") ? (changes.push("produits"), opStr(input, "products")) : o.products;
      const quantity = opStr(input, "quantity") ? (changes.push("quantité"), opStr(input, "quantity")) : String(o.quantity);
      const value = opStr(input, "amount") ? (changes.push("valeur"), opStr(input, "amount")) : numStr(o.value);
      const receivedDate = isoDate(opStr(input, "date")) ? (changes.push("reçu le"), isoDate(opStr(input, "date"))) : day(o.receivedDate);
      const paymentDate = isoDate(opStr(input, "paymentDate")) ? (changes.push("payé le"), isoDate(opStr(input, "paymentDate"))) : day(o.paymentDate);
      const notes = opStr(input, "notes") ? (changes.push("notes"), opStr(input, "notes")) : o.notes;
      if (status) changes.push(`statut → ${ORDER_STATUS_FR.find(([c]) => c === status)?.[1] ?? status}`);
      if (changes.length === 0) return { error: "Rien à changer : donnez newName, products, quantity, amount, status, date, paymentDate ou notes." };
      return {
        title: `Modifier le bon de commande ${hit.reference ?? hit.products ?? ""} (${tender.reference})`,
        fields: [
          { label: "Bon de commande", value: `${hit.reference ?? "s/n"} — ${tender.reference}` },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique" },
        ],
        args: {
          id: hit.id, reference: orderRef, products, quantity, value,
          status: (status as string | null), receivedDate, paymentDate, notes,
        },
        successMessage: `Bon de commande mis à jour (${changes.join(", ")}).`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(updateOrder, args, "La modification du bon de commande a été refusée.", { revalidate: ["/pch"] }),
  },

  delete_order: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const label = hit.reference ?? hit.products ?? "s/n";
      return {
        title: `SUPPRIMER le bon de commande ${label} (${tender.reference})`,
        fields: [{ label: "Bon de commande", value: `${label} — ${tenderLabel(tender)}` }],
        warnings: ["Suppression définitive du bon de commande — le marché, lui, reste."],
        confirmText: label,
        args: { id: hit.id },
        successMessage: `Bon de commande ${label} supprimé.`,
        revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(deleteOrder, args, "La suppression du bon de commande a été refusée.", { revalidate: ["/pch"] }),
  },

  add_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const designation = opStr(input, "line") || opStr(input, "name");
      if (!designation) return { error: "Précisez le produit demandé (champ « line »)." };
      return {
        title: `Ajouter la ligne « ${designation} » à ${tender.reference}`,
        fields: [
          { label: "Marché", value: tenderLabel(tender) },
          { label: "Produit", value: designation },
        ],
        args: { tenderId: tender.id, designation },
        successMessage: `Ligne « ${designation} » ajoutée à ${tender.reference}.`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(addTenderLine, args, "L'ajout de la ligne a été refusé.", { revalidate: ["/pch"] }),
  },

  update_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolveTenderLine(tender.id, tender.reference, opStr(input, "line"));
      if ("error" in hit) return hit;
      const l = await prisma.pchTenderLine.findUnique({ where: { id: hit.id } });
      if (!l) return { error: "Ligne introuvable." };
      const status = statusIn(opStr(input, "status"), LINE_STATUS_FR);
      if (status && typeof status === "object") return status;
      const changes: string[] = [];
      const pick = (key: string, current: string | null, label: string): string | null => {
        const v = opStr(input, key);
        if (v) { changes.push(label); return v; }
        return current;
      };
      const designation = pick("newName", l.designation, "désignation") ?? l.designation;
      const dci = pick("dci", l.dci, "DCI");
      const dosage = pick("dosage", l.dosage, "dosage");
      const form = pick("form", l.form, "forme");
      const quantityUnits = opStr(input, "quantity") ? (changes.push("quantité"), opStr(input, "quantity")) : String(l.quantityUnits);
      const unitPrice = opStr(input, "amount") ? (changes.push("notre prix"), opStr(input, "amount")) : numStr(l.unitPriceDzd);
      const awardedPrice = opStr(input, "awardedPrice") ? (changes.push("prix attribué"), opStr(input, "awardedPrice")) : numStr(l.awardedUnitPriceDzd);
      const note = pick("note", l.note, "note");
      if (status && status !== l.status) changes.push(`statut → ${LINE_STATUS_FR.find(([c]) => c === status)?.[1] ?? status}`);
      if (changes.length === 0) return { error: "Rien à changer : donnez newName, dci, dosage, form, quantity, amount, awardedPrice, status ou note." };
      return {
        title: `Modifier la ligne « ${l.designation} » (${tender.reference})`,
        fields: [
          { label: "Ligne", value: `${l.designation} — ${tender.reference}` },
          { label: "Modifications", value: changes.join(" · ") },
          { label: "Le reste", value: "rejoué à l'identique (conditionnement, enrichissement marché compris)" },
        ],
        args: {
          id: hit.id, tenderId: tender.id, designation, dci, dosage, form,
          quantityUnits, unitsPerBox: l.unitsPerBox != null ? String(l.unitsPerBox) : null,
          unitLabel: l.unitLabel, haveProduct: l.haveProduct ? "on" : null,
          unitPriceDzd: unitPrice, suppliersInfo: l.suppliersInfo,
          status: (status as string | null) ?? l.status, awardedUnitPriceDzd: awardedPrice, note,
        },
        successMessage: `Ligne « ${designation} » mise à jour (${changes.join(", ")}).`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(updateTenderLine, args, "La modification de la ligne a été refusée.", { revalidate: ["/pch"] }),
  },

  delete_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolveTenderLine(tender.id, tender.reference, opStr(input, "line"));
      if ("error" in hit) return hit;
      return {
        title: `Retirer la ligne « ${hit.designation} » de ${tender.reference}`,
        fields: [{ label: "Ligne", value: `${hit.designation} — ${tenderLabel(tender)}` }],
        warnings: ["La ligne et son enrichissement marché disparaissent — le marché et ses bons de commande restent."],
        args: { id: hit.id, tenderId: tender.id },
        successMessage: `Ligne « ${hit.designation} » retirée.`,
        revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(deleteTenderLine, args, "Le retrait de la ligne a été refusé.", { revalidate: ["/pch"] }),
  },

  analyze_tender_text: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const text = opStr(input, "text") || opStr(input, "notes");
      if (!text || text.trim().length < 10) return { error: "Collez le texte du document d'appel d'offres (champ « text »)." };
      return {
        title: `Analyser le texte de l'AO ${tender.reference} (extraction IA des produits)`,
        fields: [
          { label: "Marché", value: tenderLabel(tender) },
          { label: "Texte", value: `${text.slice(0, 160)}${text.length > 160 ? "…" : ""} (${text.length} caractères)` },
        ],
        warnings: ["L'IA extrait les produits demandés puis chaque ligne est ENRICHIE automatiquement (prix de référence PCH, nomenclature, notre catalogue, analyse de marché)."],
        args: { tenderId: tender.id, text },
        successMessage: `Produits extraits du texte et enrichis sur ${tender.reference}.`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(analyzeTenderText, args, "L'analyse du texte a été refusée.", { revalidate: ["/pch"] }),
  },

  create_order_from_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolveTenderLine(tender.id, tender.reference, opStr(input, "line"));
      if ("error" in hit) return hit;
      if (hit.status !== "WON") return { error: `La ligne « ${hit.designation} » n'est pas GAGNÉE (statut ${LINE_STATUS_FR.find(([c]) => c === hit.status)?.[1] ?? hit.status}) — marquez-la « Gagné » d'abord.` };
      const qty = opStr(input, "quantity");
      if (!qty || Number(qty) <= 0) return { error: "Indiquez la quantité vendue (champ « quantity »)." };
      return {
        title: `Bon de commande (vente réelle) — « ${hit.designation} » × ${qty}`,
        fields: fieldsOf([
          ["Marché", tenderLabel(tender)],
          ["Ligne gagnée", hit.designation],
          ["Quantité", qty],
          ["N° du bon", opStr(input, "order") || null],
        ]),
        warnings: ["La valeur est calculée au prix attribué de la ligne (ou à notre prix unitaire à défaut)."],
        args: { lineId: hit.id, tenderId: tender.id, quantity: qty, reference: opStr(input, "order") || null },
        successMessage: `Bon de commande créé — « ${hit.designation} » × ${qty}.`,
        link: `/pch/${tender.id}`, revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(createOrderFromLine, args, "La création du bon de commande a été refusée.", { revalidate: ["/pch"] }),
  },

  enrich_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolveTenderLine(tender.id, tender.reference, opStr(input, "line"));
      if ("error" in hit) return hit;
      return {
        title: `Enrichir « ${hit.designation} » par l'intelligence marché`,
        fields: [{ label: "Ligne", value: `${hit.designation} — ${tenderLabel(tender)}` }],
        warnings: ["Apports : prix de référence Réceptions PCH, nomenclature, notre produit, concurrents / parts de marché — rien n'est écrit si aucune correspondance."],
        args: { id: hit.id, tenderId: tender.id },
        successMessage: `Ligne « ${hit.designation} » enrichie.`,
        revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(enrichTenderLine, args, "L'enrichissement a été refusé.", { revalidate: ["/pch"] }),
  },

  enrich_all_lines: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const count = await prisma.pchTenderLine.count({ where: { tenderId: tender.id } });
      if (count === 0) return { error: `Aucune ligne à enrichir sur ${tender.reference}.` };
      return {
        title: `Enrichir les ${count} lignes de ${tender.reference} d'un geste`,
        fields: [{ label: "Marché", value: tenderLabel(tender) }, { label: "Lignes", value: String(count) }],
        args: { tenderId: tender.id },
        successMessage: `Enrichissement lancé sur les ${count} lignes de ${tender.reference}.`,
        revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(enrichAllTenderLines, args, "L'enrichissement a été refusé.", { revalidate: ["/pch"] }),
  },

  set_order_arrival: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const o = await prisma.pchOrder.findUnique({ where: { id: hit.id }, select: { expectedArrival: true, arrivedDate: true } });
      if (!o) return { error: "Bon de commande introuvable." };
      const expected = isoDate(opStr(input, "date")) ?? day(o.expectedArrival);
      const arrived = isoDate(opStr(input, "arrivedDate")) ?? day(o.arrivedDate);
      if (!isoDate(opStr(input, "date")) && !isoDate(opStr(input, "arrivedDate"))) {
        return { error: "Donnez la date d'arrivée prévue (champ « date ») et/ou réelle (champ « arrivedDate »), AAAA-MM-JJ." };
      }
      return {
        title: `Suivi d'arrivée — bon ${hit.reference ?? "s/n"} (${tender.reference})`,
        fields: fieldsOf([
          ["Bon de commande", `${hit.reference ?? "s/n"} — ${tender.reference}`],
          ["Arrivée prévue", expected], ["Arrivée réelle", arrived],
        ]),
        args: { id: hit.id, tenderId: tender.id, expectedArrival: expected, arrivedDate: arrived },
        successMessage: "Dates d'arrivée du bon de commande mises à jour.",
        revalidate: ["/pch"],
      };
    },
    execute: (args) => runFd(setOrderArrival, args, "Le suivi d'arrivée a été refusé.", { revalidate: ["/pch"] }),
  },
};

// ─────────────────────────── STOCKS (lieux + états) ───────────────────────────

const resolveStockLocation = (raw: string, kind: "HOSPITAL" | "ANNEX") =>
  resolveOne(raw, kind === "HOSPITAL" ? "l'hôpital (champ « location »)" : "l'annexe PCH (champ « location »)",
    (q) => prisma.stockAnnex.findMany({ where: { name: { contains: q, mode: "insensitive" }, kind }, select: { id: true, name: true }, take: 6 }),
    (l) => l.name);

const resolveStockProduct = (raw: string) =>
  resolveOne(raw, "le produit (champ « product » — DCI ou nom commercial)",
    (q) => prisma.regulatoryProduct.findMany({
      where: { OR: [{ dci: { contains: q, mode: "insensitive" } }, { brandName: { contains: q, mode: "insensitive" } }] },
      select: { id: true, dci: true, brandName: true }, orderBy: { updatedAt: "desc" }, take: 6,
    }),
    (p) => p.brandName ?? p.dci);

function stockScope(raw: string): { scope: "PCH" | "HOSPITAL" | "ANNEX"; label: string } | { error: string } {
  const q = fold(raw);
  if (!q || /^pch$|centrale/.test(q)) return { scope: "PCH", label: "PCH (centrale)" };
  if (/hopital|hospit/.test(q)) return { scope: "HOSPITAL", label: "Hôpital" };
  if (/annexe/.test(q)) return { scope: "ANNEX", label: "Annexe PCH" };
  return { error: `Lieu « ${raw} » inconnu — valeurs : PCH, hôpital, annexe (champ « kind »).` };
}

function locationOps(kind: "HOSPITAL" | "ANNEX"): Record<string, OpImpl> {
  const noun = kind === "HOSPITAL" ? "l'hôpital" : "l'annexe PCH";
  const Noun = kind === "HOSPITAL" ? "Hôpital" : "Annexe PCH";
  const create = kind === "HOSPITAL" ? createStockHospital : createStockAnnex;
  const remove = kind === "HOSPITAL" ? deleteStockHospital : deleteStockAnnex;
  return {
    [kind === "HOSPITAL" ? "create_hospital" : "create_annex"]: {
      async propose(input): Promise<OpProposalDraft | { error: string }> {
        const name = opStr(input, "location") || opStr(input, "name");
        if (!name) return { error: `Précisez le nom de ${noun} (champ « location »).` };
        return {
          title: `Créer ${noun} « ${name} »`,
          fields: [{ label: Noun, value: name }],
          warnings: ["Création réservée au Super Admin — le lieu devient disponible pour les états de stock."],
          args: { name },
          successMessage: `${Noun} « ${name} » créé.`,
          revalidate: ["/stocks"],
        };
      },
      execute: (args) => runFd(create, args, "La création du lieu a été refusée.", { revalidate: ["/stocks"] }),
    },
    [kind === "HOSPITAL" ? "delete_hospital" : "delete_annex"]: {
      async propose(input): Promise<OpProposalDraft | { error: string }> {
        const loc = await resolveStockLocation(opStr(input, "location") || opStr(input, "name"), kind);
        if ("error" in loc) return loc;
        const snaps = await prisma.stockSnapshot.count({ where: { annexId: loc.id } });
        return {
          title: `SUPPRIMER ${noun} « ${loc.name} »`,
          fields: [{ label: Noun, value: loc.name }, { label: "États de stock enregistrés", value: String(snaps) }],
          warnings: [`Suppression définitive : ${noun} ET ses ${snaps} état(s) de stock disparaissent (Super Admin).`],
          confirmText: loc.name,
          args: { id: loc.id },
          successMessage: `${Noun} « ${loc.name} » supprimé (états compris).`,
          revalidate: ["/stocks"],
        };
      },
      execute: (args) => runFd(remove, args, "La suppression du lieu a été refusée.", { revalidate: ["/stocks"] }),
    },
  };
}

export const STOCK4_OPS_IMPL: Record<string, OpImpl> = {
  ...locationOps("HOSPITAL"),
  ...locationOps("ANNEX"),

  record_snapshot: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const product = await resolveStockProduct(opStr(input, "product") || opStr(input, "name"));
      if ("error" in product) return product;
      const scope = stockScope(opStr(input, "kind"));
      if ("error" in scope) return scope;
      let annexId: string | null = null; let locationName = scope.label;
      if (scope.scope !== "PCH") {
        const loc = await resolveStockLocation(opStr(input, "location"), scope.scope);
        if ("error" in loc) return loc;
        annexId = loc.id; locationName = `${scope.label} — ${loc.name}`;
      }
      const date = isoDate(opStr(input, "date"));
      if (!date) return { error: "Indiquez la date de l'état (champ « date », AAAA-MM-JJ)." };
      const qty = opStr(input, "quantity");
      if (!qty || Number(qty) < 0 || !Number.isFinite(Number(qty))) return { error: "Indiquez la quantité restante (champ « quantity », ≥ 0)." };
      return {
        title: `État de stock — ${product.brandName ?? product.dci} : ${qty} u.`,
        fields: [
          { label: "Produit", value: product.brandName ?? product.dci },
          { label: "Lieu", value: locationName },
          { label: "Date", value: date },
          { label: "Quantité restante", value: `${qty} unité(s)` },
        ],
        warnings: ["Un état existant du MÊME JOUR (produit + lieu) est remplacé — c'est la correction normale."],
        args: { scope: scope.scope, annexId, productId: product.id, date, quantity: qty },
        successMessage: `État de stock enregistré — ${product.brandName ?? product.dci} : ${qty} u. (${locationName}).`,
        link: "/stocks", revalidate: ["/stocks"],
      };
    },
    execute: (args) => runFd(recordStockSnapshot, args, "L'état de stock a été refusé.", { revalidate: ["/stocks"] }),
  },

  delete_snapshot: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const product = await resolveStockProduct(opStr(input, "product") || opStr(input, "name"));
      if ("error" in product) return product;
      const date = isoDate(opStr(input, "date"));
      const rows = await prisma.stockSnapshot.findMany({
        where: {
          productId: product.id,
          ...(date ? { date: { gte: new Date(`${date}T00:00:00Z`), lt: new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000) } } : {}),
        },
        select: { id: true, scope: true, date: true, quantity: true, annex: { select: { name: true } } },
        orderBy: { date: "desc" }, take: 6,
      });
      const label = (s: (typeof rows)[number]) => `${day(s.date)} · ${s.annex?.name ?? s.scope} · ${s.quantity} u.`;
      if (rows.length === 0) return { error: `Aucun état de stock pour ${product.brandName ?? product.dci}${date ? ` le ${date}` : ""}.` };
      if (rows.length > 1) return { error: `Plusieurs états correspondent : ${rows.map(label).join(" ; ")} — préciser la date (champ « date »).` };
      return {
        title: `Supprimer l'état de stock du ${day(rows[0].date)} (${product.brandName ?? product.dci})`,
        fields: [{ label: "État", value: label(rows[0]) }],
        warnings: ["Suppression de la mesure datée (correction) — le produit et le lieu restent."],
        args: { id: rows[0].id },
        successMessage: "État de stock supprimé.",
        revalidate: ["/stocks"],
      };
    },
    execute: (args) => runFd(deleteStockSnapshot, args, "La suppression de l'état a été refusée.", { revalidate: ["/stocks"] }),
  },
};

// ─────────────────────────── VENTES ───────────────────────────

export const SALES_OPS_IMPL: Record<string, OpImpl> = {
  create_sale: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const product = opStr(input, "product") || opStr(input, "name");
      const client = opStr(input, "client");
      if (!product) return { error: "Précisez le produit vendu (champ « product »)." };
      if (!client) return { error: "Précisez le client (champ « client »)." };
      const qty = opStr(input, "quantity");
      const unitPrice = opStr(input, "amount");
      const isService = /service|prestation/i.test(opStr(input, "kind"));
      const isPch = /pch/i.test(opStr(input, "client")) || /oui|pch|true/i.test(opStr(input, "isPch"));
      const revenue = qty && unitPrice ? Number(qty) * Number(unitPrice) : null;
      return {
        title: `Vente — ${product} → ${client}`,
        fields: fieldsOf([
          ["Type", isService ? "Service" : "Produit"],
          ["Produit", product], ["Client", client],
          ["PCH", isPch ? "Oui" : null],
          ["Quantité", qty || null], ["Prix unitaire", unitPrice ? dzd(Number(unitPrice)) : null],
          ["Chiffre d'affaires", revenue != null ? dzd(revenue) : null],
          ["Date", isoDate(opStr(input, "date"))],
          ["DCI", opStr(input, "dci") || null],
        ]),
        args: {
          product, client, saleType: isService ? "SERVICE" : null,
          quantity: qty || null, unitPrice: unitPrice || null,
          date: isoDate(opStr(input, "date")), dci: opStr(input, "dci") || null,
          dosage: opStr(input, "dosage") || null, institution: opStr(input, "institution") || null,
          isPch: isPch ? "1" : null,
        },
        successMessage: `Vente ${product} → ${client} enregistrée.`,
        link: "/sales", revalidate: ["/sales"],
      };
    },
    execute: (args) => runFd2(createSale, args, "L'enregistrement de la vente a été refusé.", { revalidate: ["/sales"] }),
  },

  import_sales: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const csv = opStr(input, "csv") || opStr(input, "text");
      if (!csv) return { error: "Collez le CSV des ventes (champ « csv ») — en-tête : date,produit,dci,dosage,forme,client,institution,pch,quantité,prix unitaire." };
      const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return { error: "CSV vide : il faut l'en-tête PUIS au moins une ligne de données." };
      return {
        title: `Importer ${lines.length - 1} ligne(s) de ventes (CSV collé)`,
        fields: [
          { label: "Lignes de données", value: String(lines.length - 1) },
          { label: "En-tête lu", value: lines[0].slice(0, 120) },
        ],
        warnings: ["Chaque ligne devient une VENTE réelle — les lignes sans produit ou sans client sont ignorées (le résultat le dira)."],
        args: { csv },
        successMessage: `Ventes importées (${lines.length - 1} ligne(s) traitée(s)).`,
        link: "/sales", revalidate: ["/sales"],
      };
    },
    execute: (args) => runFd2(importSales, args, "L'import des ventes a été refusé.", { revalidate: ["/sales"] }),
  },
};

// ─────────────────────────── LOGISTIQUE ───────────────────────────

const LOGISTICS_STATUS_FR: [string, string][] = [
  ["ORDERED", "Commandé"], ["PRODUCTION", "En production"], ["SHIPPED", "Expédié"],
  ["ARRIVED_TERMINAL", "Arrivé au terminal (port / aéroport)"], ["CUSTOMS", "En dédouanement"],
  ["DELIVERED", "Livré"], ["BLOCKED", "Bloqué"],
];

const resolveShipment = (raw: string) =>
  resolveOne(raw, "la commande logistique (champ « reference » — CMD-AAAA-NNN ou produit)",
    (q) => prisma.logisticsOrder.findMany({
      where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { product: { contains: q, mode: "insensitive" } }] },
      select: { id: true, reference: true, product: true, status: true }, orderBy: { createdAt: "desc" }, take: 6,
    }),
    (o) => `${o.reference} — ${o.product}`);

export const LOGISTICS_OPS_IMPL: Record<string, OpImpl> = {
  create_shipment: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const product = opStr(input, "product") || opStr(input, "name");
      if (!product) return { error: "Précisez le produit commandé (champ « product »)." };
      const status = statusIn(opStr(input, "status"), LOGISTICS_STATUS_FR);
      if (status && typeof status === "object") return status;
      const amount = opStr(input, "amount");
      return {
        title: `Commande logistique — ${product}`,
        fields: fieldsOf([
          ["Produit", product], ["DCI", opStr(input, "dci") || null],
          ["Fournisseur", opStr(input, "supplier") || null], ["Pays", opStr(input, "country") || null],
          ["Quantité commandée", opStr(input, "quantity") || null],
          ["Valeur", amount ? `${Number(amount).toLocaleString("fr-FR")} ${opStr(input, "currency") || "EUR"}` : null],
          ["Commandé le", isoDate(opStr(input, "date"))],
          ["Transporteur", opStr(input, "carrier") || null], ["Incoterm", opStr(input, "incoterm") || null],
        ]),
        warnings: ["La référence CMD-AAAA-NNN est numérotée automatiquement."],
        args: {
          product, dci: opStr(input, "dci") || null, dosage: opStr(input, "dosage") || null,
          supplier: opStr(input, "supplier") || null, country: opStr(input, "country") || null,
          quantityOrdered: opStr(input, "quantity") || null, orderDate: isoDate(opStr(input, "date")),
          estimatedDeparture: isoDate(opStr(input, "departureDate")), estimatedArrival: isoDate(opStr(input, "arrivalDate")),
          status: (status as string | null), carrier: opStr(input, "carrier") || null,
          incoterm: opStr(input, "incoterm") || null, orderValue: amount || null,
          currency: opStr(input, "currency") || null,
        },
        successMessage: `Commande logistique ${product} créée.`,
        link: "/logistics", revalidate: ["/logistics"],
      };
    },
    execute: (args) => runFd2(createLogistics, args, "La création de la commande a été refusée.", { revalidate: ["/logistics"] }),
  },

  update_shipment_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const order = await resolveShipment(opStr(input, "reference") || opStr(input, "product"));
      if ("error" in order) return order;
      const status = statusIn(opStr(input, "status"), LOGISTICS_STATUS_FR);
      if (status && typeof status === "object") return status;
      const jalons = fieldsOf([
        ["Départ réel", isoDate(opStr(input, "departureDate"))],
        ["Arrivée réelle", isoDate(opStr(input, "arrivalDate"))],
        ["Dédouanement", isoDate(opStr(input, "customsDate"))],
        ["Livraison PCH", isoDate(opStr(input, "deliveryDate"))],
        ["Quantité reçue", opStr(input, "quantity") || null],
      ]);
      if (!status && jalons.length === 0) return { error: "Rien à changer : donnez status (commandé / production / expédié / arrivé au terminal / dédouanement / livré / bloqué) et/ou un jalon daté." };
      return {
        title: `Suivi — ${order.reference} (${order.product})`,
        fields: [
          { label: "Commande", value: `${order.reference} — ${order.product}` },
          ...(status ? [{ label: "Statut", value: `${LOGISTICS_STATUS_FR.find(([c]) => c === order.status)?.[1] ?? order.status} → ${LOGISTICS_STATUS_FR.find(([c]) => c === status)?.[1] ?? status}` }] : []),
          ...jalons,
        ],
        args: {
          id: order.id, status: (status as string | null),
          actualDeparture: isoDate(opStr(input, "departureDate")), actualArrival: isoDate(opStr(input, "arrivalDate")),
          customsDate: isoDate(opStr(input, "customsDate")), pchDeliveryDate: isoDate(opStr(input, "deliveryDate")),
          quantityReceived: opStr(input, "quantity") || null,
        },
        successMessage: `Commande ${order.reference} mise à jour.`,
        link: "/logistics", revalidate: ["/logistics"],
      };
    },
    execute: (args) => runFd(updateLogisticsStatus, args, "La mise à jour du suivi a été refusée.", { revalidate: ["/logistics"] }),
  },
};
