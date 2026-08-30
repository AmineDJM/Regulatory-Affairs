import { prisma } from "@/lib/prisma";
import {
  createSubmission, submitSubmission, setLineResult, createContractFromAward, linkContractToTender,
  createAmendment, setAmendmentEffective, addContractLine, deleteContractLine,
  addOrderLine, deleteOrderLine, createDelivery, deleteDelivery,
} from "@/lib/actions/pch-market-actions";
import { toNumber } from "@/lib/utils";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, fieldsOf, isoDate, dzd } from "./helpers";
import { matchLabel, fold } from "./impl-regulatory";
import { resolveTender, resolvePchOrder, tenderLabel } from "./impl-wave4";

/**
 * OPS MARKET 360° — la CHAÎNE du marché public dans la conversation : soumission versionnée
 * (créer, DÉPOSER-verrouiller), résultat par LOT (gagné / perdu / infructueux / annulé),
 * contrat né de l'attribution (pièce Legal partagée), avenants à delta (le montant initial ne
 * bouge jamais), lignes contractuelles, lignes de bon de commande CONTRÔLÉES contre le restant
 * contractuel (passage en force explicite et tracé), livraisons (BL, lot, péremption, stock
 * optionnel). Toujours par les ACTIONS CANONIQUES de l'écran — mêmes portes, même audit.
 *
 * Restent à l'ÉCRAN (exclusions motivées au registre) : cocher une pièce de la checklist de
 * dépôt — une ATTESTATION signée du nom de la personne — et la mécanique de la carte de
 * préparation (libellé, état Brouillon/Relecture, exigence ajoutée).
 */

const oui = (raw: string): boolean => /^(oui|yes|true|1|on)$/i.test(raw.trim());

/** Résultats d'un lot — les cinq états §14, plus les retours en arrière possibles. */
const RESULT_STATUS_FR: [string, string][] = [
  ["WON", "Gagné"], ["LOST", "Perdu"], ["UNSUCCESSFUL", "Infructueux"], ["CANCELLED", "Annulé"],
  ["SUBMITTED", "Soumis"], ["QUOTED", "Chiffré"], ["PENDING", "En attente"],
];

interface DocHit { id: string; title: string; reference: string | null; kind: string; tenderId: string | null }

/** Contrat / convention / avenant par titre ou référence — exact → unique → ambiguïté listée. */
async function resolveLegalDoc(kinds: string[], raw: string, quoi: string, tenderId?: string): Promise<DocHit | { error: string }> {
  const q = raw.trim();
  const where = { kind: { in: kinds as never[] }, ...(tenderId ? { tenderId } : {}) };
  const select = { id: true, title: true, reference: true, kind: true, tenderId: true };
  if (!q) {
    // Sans libellé : un candidat unique dans le périmètre passe, sinon on liste.
    const rows = await prisma.legalDocument.findMany({ where, select, orderBy: { createdAt: "desc" }, take: 6 });
    if (rows.length === 1) return rows[0];
    if (rows.length === 0) return { error: `Aucun ${quoi}${tenderId ? " sur ce marché" : ""}.` };
    return { error: `Précisez ${quoi} (champ « contract ») parmi : ${rows.map((d) => d.title).join(" ; ")}.` };
  }
  const rows = await prisma.legalDocument.findMany({
    where: { ...where, OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] },
    select, orderBy: { createdAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun ${quoi} « ${q} »${tenderId ? " sur ce marché" : ""}.` };
  const exact = rows.filter((d) => fold(d.title) === fold(q) || (d.reference && fold(d.reference) === fold(q)));
  if (exact.length === 1) return exact[0];
  return { error: `Plusieurs correspondances pour « ${q} » : ${rows.map((d) => d.title).join(" ; ")} — préciser.` };
}

/** Ligne contractuelle d'une pièce (contrat ou avenant), par désignation. */
async function resolveContractLine(documentId: string, raw: string) {
  const rows = await prisma.pchContractLine.findMany({
    where: { documentId }, select: { id: true, designation: true, quantityUnits: true },
    orderBy: { createdAt: "asc" }, take: 40,
  });
  if (rows.length === 0) return { error: "Cette pièce n'a aucune ligne contractuelle." } as const;
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez la ligne (champ « line ») parmi : ${rows.map((l) => l.designation).join(" ; ")}.` } as const;
  }
  const hits = rows.filter((l) => fold(l.designation).includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucune ligne « ${raw} » — présentes : ${rows.map((l) => l.designation).join(" ; ")}.` } as const;
  return { error: `Plusieurs lignes correspondent : ${hits.map((l) => l.designation).join(" ; ")} — préciser.` } as const;
}

/** Ligne d'un bon de commande, par désignation. */
async function resolveOrderLine(orderId: string, raw: string) {
  const rows = await prisma.pchOrderLine.findMany({
    where: { orderId }, select: { id: true, designation: true, quantityUnits: true },
    orderBy: { createdAt: "asc" }, take: 40,
  });
  if (rows.length === 0) return { error: "Ce bon de commande n'a aucune ligne." } as const;
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez la ligne (champ « line ») parmi : ${rows.map((l) => l.designation).join(" ; ")}.` } as const;
  }
  const hits = rows.filter((l) => fold(l.designation).includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucune ligne « ${raw} » — présentes : ${rows.map((l) => l.designation).join(" ; ")}.` } as const;
  return { error: `Plusieurs lignes correspondent : ${hits.map((l) => l.designation).join(" ; ")} — préciser.` } as const;
}

export const MARKET360_OPS_IMPL: Record<string, OpImpl> = {
  // ─────────────────────────── Soumission versionnée ───────────────────────────
  create_submission: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const last = await prisma.pchSubmission.findFirst({ where: { tenderId: tender.id }, orderBy: { version: "desc" }, select: { version: true } });
      const version = (last?.version ?? 0) + 1;
      const label = opStr(input, "name");
      return {
        title: `Soumission V${version} — ${tender.reference}`,
        fields: fieldsOf([["Marché", tenderLabel(tender)], ["Version", `V${version}`], ["Libellé", label || null]]),
        warnings: version > 1 ? ["La nouvelle version REPART de la checklist de la précédente (les pièces déjà réunies restent cochées)."] : [],
        args: { tenderId: tender.id, label: label || null },
        successMessage: `Soumission V${version} créée sur ${tender.reference} — la checklist se coche depuis la fiche du marché.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(createSubmission, args, "La création de la version de soumission a été refusée."),
  },

  submit_submission: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const s = await prisma.pchSubmission.findFirst({
        where: { tenderId: tender.id, lockedAt: null },
        orderBy: { version: "desc" },
        select: { id: true, version: true, checklist: true },
      });
      if (!s) return { error: `Aucune version de soumission modifiable sur ${tender.reference} — créer d'abord une version (create_submission).` };
      const items = Array.isArray(s.checklist) ? (s.checklist as Array<{ done?: boolean }>) : [];
      const faits = items.filter((i) => i.done).length;
      const manquantes = items.length - faits;
      return {
        title: `DÉPOSER la soumission V${s.version} — ${tender.reference}`,
        fields: [
          { label: "Marché", value: tenderLabel(tender) },
          { label: "Version", value: `V${s.version}` },
          { label: "Checklist", value: `${faits}/${items.length} pièces cochées` },
        ],
        warnings: [
          "Le dépôt VERROUILLE la version (plus aucune modification), pose la date de soumission du marché et FIGE la photo des lignes-produits.",
          ...(manquantes > 0 ? [`${manquantes} pièce(s) de la checklist ne sont PAS cochées — le dépôt reste possible, mais l'écart restera visible.`] : []),
        ],
        args: { id: s.id },
        successMessage: `V${s.version} déposée et verrouillée — date de soumission posée sur ${tender.reference}.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`, "/pch"],
      };
    },
    execute: (args) => runFd(submitSubmission, args, "Le dépôt de la soumission a été refusé."),
  },

  // ─────────────────────────── Résultat par lot ───────────────────────────
  set_line_result: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const rows = await prisma.pchTenderLine.findMany({
        where: { tenderId: tender.id }, select: { id: true, designation: true, dci: true, status: true, quantityUnits: true, submittedQuantityUnits: true },
        orderBy: { sortOrder: "asc" }, take: 40,
      });
      if (rows.length === 0) return { error: `${tender.reference} n'a aucune ligne-produit.` };
      const q = fold(opStr(input, "line"));
      const hits = q ? rows.filter((l) => fold(l.designation).includes(q) || (l.dci && fold(l.dci).includes(q))) : rows;
      if (hits.length === 0) return { error: `Aucune ligne « ${opStr(input, "line")} » sur ${tender.reference} — lignes : ${rows.slice(0, 10).map((l) => l.designation).join(" ; ")}.` };
      if (hits.length > 1) return { error: `Précisez la ligne (champ « line ») parmi : ${hits.slice(0, 10).map((l) => l.designation).join(" ; ")}.` };
      const line = hits[0];
      const statusRaw = opStr(input, "status");
      if (!statusRaw) return { error: "Précisez le résultat (champ « status ») : gagné, perdu, infructueux, annulé…" };
      const status = matchLabel(statusRaw, RESULT_STATUS_FR);
      if (typeof status === "object") return status;
      const qty = opStr(input, "quantity");
      const price = opStr(input, "awardedPrice");
      const soumis = line.submittedQuantityUnits ?? line.quantityUnits;
      return {
        title: `Résultat du lot « ${line.designation} » — ${tender.reference}`,
        fields: fieldsOf([
          ["Marché", tenderLabel(tender)],
          ["Lot", line.designation],
          ["Résultat", RESULT_STATUS_FR.find(([c]) => c === status)?.[1] ?? status],
          ["Quantité attribuée", status === "WON" ? (qty ? `${qty} u. (soumis : ${soumis})` : `${soumis} u. (toute la quantité soumise)`) : null],
          ["Prix attribué", status === "WON" && price ? dzd(Number(price)) : null],
        ]),
        args: { lineId: line.id, status, awardedQuantityUnits: qty || null, awardedUnitPriceDzd: price || null },
        successMessage: `Résultat consigné : « ${line.designation} » → ${RESULT_STATUS_FR.find(([c]) => c === status)?.[1] ?? status}.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(setLineResult, args, "Le résultat du lot a été refusé."),
  },

  // ─────────────────────────── Contrat & avenants ───────────────────────────
  create_contract_from_award: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const gagnees = await prisma.pchTenderLine.findMany({
        where: { tenderId: tender.id, status: "WON" },
        select: { quantityUnits: true, submittedQuantityUnits: true, awardedQuantityUnits: true, unitPriceDzd: true, awardedUnitPriceDzd: true },
      });
      if (gagnees.length === 0) return { error: `Aucun lot GAGNÉ sur ${tender.reference} : rien à contractualiser — consigner d'abord les résultats (set_line_result).` };
      const calcule = gagnees.reduce((total, l) => {
        const qte = l.awardedQuantityUnits ?? l.submittedQuantityUnits ?? l.quantityUnits;
        const prix = l.awardedUnitPriceDzd ?? l.unitPriceDzd;
        return total + (prix === null ? 0 : qte * toNumber(prix));
      }, 0);
      const montant = opStr(input, "amount");
      return {
        title: `Contrat depuis l'attribution — ${tender.reference}`,
        fields: fieldsOf([
          ["Marché", tenderLabel(tender)],
          ["Lots gagnés", `${gagnees.length} → autant de lignes contractuelles`],
          ["Montant", montant ? dzd(Number(montant)) : calcule > 0 ? `${dzd(calcule)} (calculé des lots — le contrat signé fait foi)` : null],
          ["Titre", opStr(input, "name") || null],
          ["Signé le", isoDate(opStr(input, "date"))],
        ]),
        warnings: ["Crée une pièce LEGAL (contrat) partagée : Legal la retrouve avec sa revue et ses échéances, PCH la voit dans le marché."],
        args: {
          tenderId: tender.id, title: opStr(input, "name") || null, amount: montant || null,
          signedAt: isoDate(opStr(input, "date")), notes: opStr(input, "notes") || null,
        },
        successMessage: `Contrat créé depuis l'attribution de ${tender.reference} (${gagnees.length} ligne·s contractuelle·s).`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`, "/legal"],
      };
    },
    execute: (args) => runFd(createContractFromAward, args, "La création du contrat a été refusée."),
  },

  link_contract: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const doc = await resolveLegalDoc(["CONTRACT", "AGREEMENT"], opStr(input, "contract"), "contrat");
      if ("error" in doc) return doc;
      if (doc.tenderId === tender.id) return { error: `« ${doc.title} » est déjà rattaché à ${tender.reference}.` };
      if (doc.tenderId) return { error: `« ${doc.title} » est déjà rattaché à un AUTRE marché — le détacher d'abord depuis Legal.` };
      return {
        title: `Rattacher « ${doc.title} » à ${tender.reference}`,
        fields: [{ label: "Marché", value: tenderLabel(tender) }, { label: "Contrat", value: doc.title }],
        args: { tenderId: tender.id, contractId: doc.id },
        successMessage: `Contrat « ${doc.title} » rattaché à ${tender.reference}.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(linkContractToTender, args, "Le rattachement du contrat a été refusé."),
  },

  create_amendment: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(["CONTRACT", "AGREEMENT"], opStr(input, "contract"), "contrat");
      if ("error" in doc) return doc;
      const existants = await prisma.legalDocument.count({ where: { amendsId: doc.id } });
      const delta = opStr(input, "delta") || opStr(input, "amount");
      const effectiveAt = isoDate(opStr(input, "date"));
      return {
        title: `Avenant n° ${existants + 1} — ${doc.title}`,
        fields: fieldsOf([
          ["Contrat", doc.title],
          ["Impact sur la valeur", delta ? `${Number(delta) >= 0 ? "+" : ""}${dzd(Number(delta))}` : "aucun (avenant sans delta financier)"],
          ["Prise d'effet", effectiveAt ?? "à poser plus tard (set_amendment_effective)"],
          ["Titre", opStr(input, "name") || null],
        ]),
        warnings: ["Le montant INITIAL du contrat n'est jamais modifié : la valeur courante se CALCULE (initial + deltas des avenants effectifs)."],
        args: {
          contractId: doc.id, title: opStr(input, "name") || null, amountDelta: delta || null,
          effectiveAt, notes: opStr(input, "notes") || null,
        },
        successMessage: `Avenant n° ${existants + 1} créé sur « ${doc.title} »${delta ? ` (impact ${dzd(Number(delta))})` : ""}.`,
        revalidate: ["/legal"],
      };
    },
    execute: (args) => runFd(createAmendment, args, "La création de l'avenant a été refusée."),
  },

  set_amendment_effective: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(["AMENDMENT"], opStr(input, "contract"), "avenant");
      if ("error" in doc) return doc;
      const effectiveAt = isoDate(opStr(input, "date")) ?? new Date().toISOString().slice(0, 10);
      return {
        title: `Prise d'effet — ${doc.title}`,
        fields: [{ label: "Avenant", value: doc.title }, { label: "Effectif au", value: effectiveAt }],
        warnings: ["À cette date, les deltas de l'avenant ENTRENT dans la valeur courante et les quantités contractuelles."],
        args: { id: doc.id, effectiveAt },
        successMessage: `« ${doc.title} » effectif au ${effectiveAt}.`,
        revalidate: ["/legal"],
      };
    },
    execute: (args) => runFd(setAmendmentEffective, args, "La prise d'effet a été refusée."),
  },

  add_contract_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(["CONTRACT", "AGREEMENT", "AMENDMENT"], opStr(input, "contract"), "contrat ou avenant");
      if ("error" in doc) return doc;
      const designation = opStr(input, "line") || opStr(input, "name");
      const qty = opStr(input, "quantity");
      if (!designation) return { error: "Précisez la désignation de la ligne (champ « line »)." };
      if (!qty || !Number.isFinite(Number(qty))) return { error: "Précisez la quantité en unités (champ « quantity » — négatif permis sur un avenant de réduction)." };
      if (Number(qty) < 0 && doc.kind !== "AMENDMENT") return { error: "Une quantité négative ne se pose que sur un AVENANT de réduction." };
      const price = opStr(input, "amount");
      return {
        title: `Ligne contractuelle sur « ${doc.title} »`,
        fields: fieldsOf([
          ["Pièce", `${doc.title}${doc.kind === "AMENDMENT" ? " (avenant — la ligne est un DELTA)" : ""}`],
          ["Désignation", designation],
          ["Quantité", `${Number(qty) >= 0 ? "+" : ""}${qty} u.`],
          ["Prix unitaire", price ? dzd(Number(price)) : null],
        ]),
        args: { documentId: doc.id, designation, quantityUnits: qty, unitPriceDzd: price || null },
        successMessage: `Ligne « ${designation} » (${qty} u.) posée sur « ${doc.title} ».`,
        revalidate: ["/legal"],
      };
    },
    execute: (args) => runFd(addContractLine, args, "L'ajout de la ligne contractuelle a été refusé."),
  },

  delete_contract_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(["CONTRACT", "AGREEMENT", "AMENDMENT"], opStr(input, "contract"), "contrat ou avenant");
      if ("error" in doc) return doc;
      const line = await resolveContractLine(doc.id, opStr(input, "line"));
      if ("error" in line) return line;
      return {
        title: `Retirer la ligne « ${line.designation} » de « ${doc.title} »`,
        fields: [{ label: "Pièce", value: doc.title }, { label: "Ligne", value: `${line.designation} (${line.quantityUnits} u.)` }],
        warnings: ["Le retrait change la quantité contractuelle du produit — les contrôles de dépassement des bons de commande s'en ressentent."],
        args: { id: line.id },
        successMessage: `Ligne « ${line.designation} » retirée de « ${doc.title} ».`,
        revalidate: ["/legal"],
      };
    },
    execute: (args) => runFd(deleteContractLine, args, "Le retrait de la ligne a été refusé."),
  },

  // ─────────────────────────── Lignes de BC & livraisons ───────────────────────────
  add_order_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const order = await prisma.pchOrder.findUnique({ where: { id: hit.id }, select: { id: true, reference: true, contractId: true } });
      if (!order) return { error: "Bon de commande introuvable." };
      const raw = opStr(input, "line");
      const qty = opStr(input, "quantity");
      if (!qty || !(Number(qty) > 0)) return { error: "Précisez la quantité en unités (champ « quantity », > 0)." };
      const force = oui(opStr(input, "force"));

      // Sur un BC contractualisé, la ligne se raccroche à sa ligne CONTRACTUELLE quand elle se
      // reconnaît — c'est elle qui porte le contrôle du restant.
      let contractLineId: string | null = null;
      let designation = raw;
      let horsContrat = false;
      if (order.contractId) {
        const cls = await prisma.pchContractLine.findMany({
          where: { contractId: order.contractId }, select: { id: true, designation: true }, take: 40,
        });
        const q = fold(raw);
        const hits = q ? cls.filter((l) => fold(l.designation).includes(q)) : cls;
        if (hits.length === 1) {
          contractLineId = hits[0].id;
          designation = hits[0].designation;
        } else if (hits.length > 1) {
          return { error: `Plusieurs lignes contractuelles correspondent : ${hits.map((l) => l.designation).join(" ; ")} — préciser.` };
        } else {
          horsContrat = true;
        }
      }
      if (!designation) return { error: "Précisez la ligne (champ « line » — désignation du produit)." };
      const price = opStr(input, "amount");
      return {
        title: `Ligne de BC ${order.reference ?? ""} — ${tender.reference}`,
        fields: fieldsOf([
          ["Marché", tenderLabel(tender)],
          ["Bon de commande", order.reference ?? "s/n"],
          ["Désignation", designation],
          ["Quantité", `${qty} u.`],
          ["Prix unitaire", price ? dzd(Number(price)) : null],
          ["Contrôle contractuel", contractLineId ? "appliqué à l'exécution — un dépassement est refusé avec le chiffre exact" : null],
        ]),
        warnings: [
          ...(horsContrat ? ["Aucune ligne contractuelle ne correspond : la ligne sera HORS CONTRAT (pas de contrôle du restant)."] : []),
          ...(force ? ["PASSAGE EN FORCE demandé : un dépassement contractuel sera accepté ET TRACÉ dans l'audit avec son excès."] : []),
        ],
        args: { orderId: order.id, contractLineId, designation, quantityUnits: qty, unitPriceDzd: price || null, force: force ? "1" : null },
        successMessage: `Ligne « ${designation} » (${qty} u.) ajoutée au BC ${order.reference ?? ""}.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(addOrderLine, args, "L'ajout de la ligne au bon de commande a été refusé."),
  },

  delete_order_line: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const line = await resolveOrderLine(hit.id, opStr(input, "line"));
      if ("error" in line) return line;
      return {
        title: `Retirer la ligne « ${line.designation} » du BC ${hit.reference ?? ""}`,
        fields: [
          { label: "Marché", value: tenderLabel(tender) },
          { label: "Ligne", value: `${line.designation} (${line.quantityUnits} u.)` },
        ],
        args: { id: line.id },
        successMessage: `Ligne « ${line.designation} » retirée du BC ${hit.reference ?? ""}.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(deleteOrderLine, args, "Le retrait de la ligne a été refusé."),
  },

  create_delivery: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const line = await resolveOrderLine(hit.id, opStr(input, "line"));
      if ("error" in line) return line;
      const qty = opStr(input, "quantity");
      if (!qty || !(Number(qty) > 0)) return { error: "Précisez la quantité livrée en unités (champ « quantity », > 0)." };
      const versStock = oui(opStr(input, "stock"));
      // Un mouvement de stock suppose une livraison EFFECTIVE : sans date donnée, aujourd'hui.
      const deliveredAt = isoDate(opStr(input, "date")) ?? (versStock ? new Date().toISOString().slice(0, 10) : null);
      const bl = opStr(input, "bl");
      const batch = opStr(input, "batch");
      const expiry = isoDate(opStr(input, "expiry"));
      return {
        title: `Livraison sur le BC ${hit.reference ?? ""} — ${tender.reference}`,
        fields: fieldsOf([
          ["Marché", tenderLabel(tender)],
          ["Bon de commande", hit.reference ?? "s/n"],
          ["Ligne livrée", `${line.designation} — ${qty} u.`],
          ["BL", bl || null],
          ["Livré le", deliveredAt],
          ["Lot", batch || null],
          ["Péremption", expiry],
          ["Stock", versStock ? "mouvement de SORTIE créé si le produit se résout sans ambiguïté" : "aucun mouvement (enregistrement documentaire)"],
        ]),
        warnings: versStock
          ? ["Le mouvement de stock n'est écrit QUE pour un produit résolu SANS ambiguïté vers un produit Regulatory — sinon la ligne est enregistrée sans mouvement, et le reçu le dit."]
          : [],
        args: {
          orderId: hit.id, reference: bl || null, deliveredAt,
          [`qty_${line.id}`]: qty, [`batch_${line.id}`]: batch || null, [`expiry_${line.id}`]: expiry,
          createStockMovements: versStock ? "1" : null,
        },
        successMessage: `Livraison enregistrée${bl ? ` (BL ${bl})` : ""} — ${qty} u. « ${line.designation} ». L'écran permet le multi-lignes.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(createDelivery, args, "L'enregistrement de la livraison a été refusé."),
  },

  delete_delivery: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const tender = await resolveTender(opStr(input, "reference"));
      if ("error" in tender) return tender;
      const hit = await resolvePchOrder(tender.id, tender.reference, opStr(input, "order"));
      if ("error" in hit) return hit;
      const rows = await prisma.pchDelivery.findMany({
        where: { orderId: hit.id },
        select: { id: true, reference: true, deliveredAt: true, stockMovements: { select: { id: true } } },
        orderBy: { createdAt: "desc" }, take: 20,
      });
      if (rows.length === 0) return { error: `Aucune livraison sur le BC ${hit.reference ?? ""}.` };
      const q = fold(opStr(input, "bl"));
      const hits = q ? rows.filter((d) => fold(d.reference ?? "").includes(q)) : rows;
      if (hits.length === 0) return { error: `Aucune livraison « ${opStr(input, "bl")} » — présentes : ${rows.map((d) => d.reference ?? "s/n").join(" ; ")}.` };
      if (hits.length > 1) return { error: `Précisez la livraison (champ « bl ») parmi : ${hits.map((d) => d.reference ?? "s/n").join(" ; ")}.` };
      const d = hits[0];
      return {
        title: `Supprimer la livraison${d.reference ? ` BL ${d.reference}` : ""} (BC ${hit.reference ?? "s/n"})`,
        fields: [{ label: "Marché", value: tenderLabel(tender) }, { label: "Livraison", value: d.reference ?? "sans BL" }],
        warnings: d.stockMovements.length > 0
          ? [`${d.stockMovements.length} mouvement·s de stock lié·s SURVIVENT à la suppression (l'histoire du stock ne se réécrit pas d'ici) — à corriger dans Stocks si besoin.`]
          : [],
        args: { id: d.id },
        successMessage: `Livraison${d.reference ? ` BL ${d.reference}` : ""} supprimée.`,
        link: `/pch/${tender.id}`, revalidate: [`/pch/${tender.id}`],
      };
    },
    execute: (args) => runFd(deleteDelivery, args, "La suppression de la livraison a été refusée."),
  },
};
