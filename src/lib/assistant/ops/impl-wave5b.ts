import { prisma } from "@/lib/prisma";
import {
  addCareBeneficiary, setCareOpinion, decideCareBeneficiary, removeCareBeneficiary,
  addCareCell, setCareCellStatus, removeCareCell, createCareQuote, decideCareQuote,
  requestCareQuotes, sendCareToFinance, linkCareCellPromoMaterial,
} from "@/lib/actions/care-actions";
import {
  submitQuotes, chooseAgency, submitBcForFinance, remindFinance, validateBc, confirmBcSent,
  initiatePayment, confirmPayment, submitMaterial, directionReview, confirmConformity,
  startBat, submitFinalMaterial, recordInvoice, settle, addPromoComment, cancelPromoMaterial,
} from "@/lib/actions/promo-material-actions";
import { startPromoCircuit, markQuoteReceived, completePromoTrack } from "@/lib/actions/promo-circuit-actions";
import {
  createStockItem, updateStockItem, deleteStockItem, recordStockMovement, deleteStockMovement,
} from "@/lib/actions/promo-stock-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd, runFd2, fieldsOf, resolveOne, isoDate, dzd } from "./helpers";
import { matchLabel, fold } from "./impl-regulatory";

/**
 * OPS VAGUE 5b — PRISES EN CHARGE (décision PAR PERSONNE, besoins par personne, devis qui
 * couvrent N cases avec le garde-fou anti double paiement, envoi aux Finances bloqué tant
 * qu'il manque une pièce), MATÉRIEL PROMOTIONNEL (les 15 marches du circuit long, le circuit
 * court à chantiers parallèles, le stock à mouvements — jamais un champ quantité).
 * Toujours par les ACTIONS CANONIQUES.
 */

const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);

// ─────────────────────────── PRISES EN CHARGE ───────────────────────────

interface CareRequest { scope: "NATIONAL" | "INTERNATIONAL"; requestId: string; label: string }

async function resolveCareRequest(kindRaw: string, labelRaw: string): Promise<CareRequest | { error: string }> {
  const q = labelRaw.trim();
  if (!q) return { error: "Précisez le congrès (champ « target » — son nom)." };
  const k = fold(kindRaw);
  const wantIntl = /international/.test(k);
  const wantNat = /national/.test(k) && !wantIntl;
  const hits: CareRequest[] = [];
  if (!wantIntl) {
    for (const c of await prisma.congressNational.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 4 })) {
      hits.push({ scope: "NATIONAL", requestId: c.id, label: `${c.name} (congrès national)` });
    }
  }
  if (!wantNat) {
    for (const c of await prisma.congressInternational.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 4 })) {
      hits.push({ scope: "INTERNATIONAL", requestId: c.id, label: `${c.name} (congrès international)` });
    }
  }
  if (hits.length === 0) return { error: `Aucun congrès « ${q} ».` };
  if (hits.length > 1) return { error: `Plusieurs congrès correspondent : ${hits.map((h) => h.label).join(" ; ")} — préciser (champ « kind » : congrès national | congrès international).` };
  return hits[0];
}

const benefWhere = (req: CareRequest) =>
  req.scope === "NATIONAL" ? { congressNationalId: req.requestId } : { congressInternationalId: req.requestId };

async function doctorNameMap(doctorIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = doctorIds.filter((x): x is string => Boolean(x));
  if (ids.length === 0) return new Map();
  const docs = await prisma.medicalDoctor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(docs.map((d) => [d.id, d.name]));
}

interface BeneficiaryHit { id: string; name: string }

async function resolveBeneficiary(req: CareRequest, raw: string): Promise<BeneficiaryHit | { error: string }> {
  const rows = await prisma.careBeneficiary.findMany({
    where: benefWhere(req),
    // doctorId est un scalaire SANS relation Prisma (profil libre possible) : les noms
    // des praticiens de l'annuaire se résolvent par une seconde requête.
    select: { id: true, firstName: true, lastName: true, doctorId: true },
    orderBy: { position: "asc" }, take: 40,
  });
  if (rows.length === 0) return { error: `${req.label} n'a aucune personne prise en charge.` };
  const doctorNames = await doctorNameMap(rows.map((b) => b.doctorId));
  const label = (b: (typeof rows)[number]) =>
    (b.doctorId ? doctorNames.get(b.doctorId) : null) ?? ([b.firstName, b.lastName].filter(Boolean).join(" ") || "—");
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return { id: rows[0].id, name: label(rows[0]) };
    return { error: `Précisez la personne (champ « person ») parmi : ${rows.map(label).join(", ")}.` };
  }
  const hits = rows.filter((b) => fold(label(b)).includes(q));
  if (hits.length === 1) return { id: hits[0].id, name: label(hits[0]) };
  if (hits.length === 0) return { error: `Aucune personne « ${raw} » sur ${req.label} — présentes : ${rows.map(label).join(", ")}.` };
  return { error: `Plusieurs personnes correspondent : ${hits.map(label).join(", ")} — préciser.` };
}

interface CellHit { id: string; label: string }

async function resolveCell(beneficiaryId: string, personName: string, raw: string): Promise<CellHit | { error: string }> {
  const rows = await prisma.careCell.findMany({
    where: { beneficiaryId }, select: { id: true, label: true, status: true }, orderBy: { position: "asc" }, take: 30,
  });
  if (rows.length === 0) return { error: `${personName} n'a aucun élément (pièce / prestation).` };
  const q = fold(raw);
  if (!q) {
    if (rows.length === 1) return rows[0];
    return { error: `Précisez l'élément (champ « label ») parmi : ${rows.map((c) => c.label).join(" ; ")}.` };
  }
  const hits = rows.filter((c) => fold(c.label).includes(q));
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return { error: `Aucun élément « ${raw} » chez ${personName} — éléments : ${rows.map((c) => c.label).join(" ; ")}.` };
  return { error: `Plusieurs éléments correspondent : ${hits.map((c) => c.label).join(" ; ")} — préciser.` };
}

const SERVICE_KIND_FR: [string, string][] = [
  ["HOTEL", "Hôtel"], ["TRANSPORT", "Transport"], ["TICKET", "Billet"],
  ["CATERING", "Restauration"], ["REGISTRATION", "Inscription"], ["PROMO_MATERIAL", "Matériel promotionnel"], ["OTHER", "Autre"],
];
const CELL_STATUS_FR: [string, string][] = [
  ["REQUESTED", "Demandée"], ["PROVIDED", "Reçue"], ["SETTLED", "Réglée"], ["WAIVED", "Sans objet"],
];

export const CARE_OPS_IMPL: Record<string, OpImpl> = {
  add_care_person: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const raw = opStr(input, "person");
      if (!raw) return { error: "Précisez la personne (champ « person » — praticien de l'annuaire, ou nom libre)." };
      const doctors = await prisma.medicalDoctor.findMany({
        where: { name: { contains: raw, mode: "insensitive" } }, select: { id: true, name: true }, take: 4,
      });
      if (doctors.length > 1) return { error: `Plusieurs praticiens correspondent : ${doctors.map((d) => d.name).join(", ")} — préciser (ou donner un nom libre plus complet).` };
      const doctor = doctors.length === 1 ? doctors[0] : null;
      return {
        title: `Ajouter ${doctor?.name ?? raw} à la prise en charge — ${req.label}`,
        fields: fieldsOf([
          ["Congrès", req.label],
          ["Personne", doctor ? `${doctor.name} (annuaire)` : `${raw} (profil libre)`],
          ["Fonction", opStr(input, "role") || null],
          ["Établissement", opStr(input, "institution") || null],
        ]),
        args: {
          scope: req.scope, requestId: req.requestId,
          doctorId: doctor?.id ?? null, lastName: doctor ? null : raw,
          jobTitle: opStr(input, "role") || null, institution: opStr(input, "institution") || null,
        },
        successMessage: `${doctor?.name ?? raw} ajouté·e à la prise en charge (${req.label}).`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(addCareBeneficiary, args, "L'ajout de la personne a été refusé.", { revalidate: ["/congress-national"] }),
  },

  set_care_opinion: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      const raw = fold(opStr(input, "decision") || opStr(input, "mode"));
      const opinion = /d[ée]favorable|contre/.test(raw) ? "UNFAVORABLE" : /favorable|pour/.test(raw) ? "FAVORABLE" : /sans avis|aucun|pas d avis|neutre/.test(raw) ? "NONE" : null;
      if (!opinion) return { error: "Précisez l'avis (champ « decision ») : favorable, défavorable, ou pas d'avis." };
      return {
        title: `Avis « ${opinion === "FAVORABLE" ? "Favorable" : opinion === "UNFAVORABLE" ? "Défavorable" : "Pas d'avis"} » sur ${person.name}`,
        fields: fieldsOf([
          ["Personne", `${person.name} — ${req.label}`],
          ["Avis", opinion === "FAVORABLE" ? "Favorable" : opinion === "UNFAVORABLE" ? "Défavorable" : "Pas d'avis"],
          ["Note", opStr(input, "note") || null],
        ]),
        args: { id: person.id, opinion, note: opStr(input, "note") || null },
        successMessage: `Avis porté sur ${person.name}.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(setCareOpinion, args, "L'avis a été refusé.", { revalidate: ["/congress-national"] }),
  },

  decide_care_person: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      const raw = fold(opStr(input, "decision"));
      const decision = /refus|[ée]cart|rejet/.test(raw) ? "REJECTED" : /accord|approuv|valid/.test(raw) ? "APPROVED" : null;
      if (!decision) return { error: "Précisez la décision (champ « decision ») : accorder ou écarter." };
      return {
        title: `${decision === "APPROVED" ? "ACCORDER" : "ÉCARTER"} la prise en charge de ${person.name}`,
        fields: fieldsOf([
          ["Personne", `${person.name} — ${req.label}`],
          ["Note", opStr(input, "note") || null],
        ]),
        warnings: decision === "APPROVED"
          ? ["Décision PAR PERSONNE (Direction) — l'accord crée d'office sa pièce d'identité à fournir."]
          : ["Décision par personne, tracée — les autres personnes de la demande ne bougent pas."],
        args: { id: person.id, decision, note: opStr(input, "note") || null },
        successMessage: `${person.name} : prise en charge ${decision === "APPROVED" ? "ACCORDÉE" : "écartée"}.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(decideCareBeneficiary, args, "La décision a été refusée.", { revalidate: ["/congress-national"] }),
  },

  remove_care_person: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      return {
        title: `Retirer ${person.name} de la prise en charge`,
        fields: [{ label: "Personne", value: `${person.name} — ${req.label}` }],
        warnings: ["Une personne dont une prestation est déjà ENGAGÉE ne se retire pas (l'action refuse) : on l'ÉCARTE plutôt (decide_care_person)."],
        args: { id: person.id },
        successMessage: `${person.name} retiré·e de la prise en charge.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(removeCareBeneficiary, args, "Le retrait a été refusé.", { revalidate: ["/congress-national"] }),
  },

  add_care_cell: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      const label = opStr(input, "label");
      if (!label) return { error: "Précisez l'élément (champ « label » — pièce à fournir ou prestation à acheter)." };
      const isService = /prestation|service|achat|h[oô]tel|transport|billet|restauration|inscription/i.test(opStr(input, "mode") + " " + label);
      let serviceKind: string | null = null;
      if (isService) {
        const m = matchLabel(opStr(input, "serviceKind") || label, SERVICE_KIND_FR);
        serviceKind = typeof m === "string" ? m : "OTHER";
      }
      return {
        title: `Ajouter « ${label} » chez ${person.name}`,
        fields: fieldsOf([
          ["Personne", `${person.name} — ${req.label}`],
          ["Élément", label],
          ["Nature", isService ? `Prestation (${SERVICE_KIND_FR.find(([c]) => c === serviceKind)?.[1] ?? "Autre"})` : "Pièce à fournir"],
        ]),
        args: { beneficiaryId: person.id, label, kind: isService ? "SERVICE" : "DOCUMENT", serviceKind, notes: opStr(input, "notes") || null },
        successMessage: `Élément « ${label} » ajouté chez ${person.name}.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(addCareCell, args, "L'ajout de l'élément a été refusé.", { revalidate: ["/congress-national"] }),
  },

  set_care_cell_status: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      const cell = await resolveCell(person.id, person.name, opStr(input, "label"));
      if ("error" in cell) return cell;
      const m = matchLabel(opStr(input, "status"), CELL_STATUS_FR);
      if (typeof m === "object") return m;
      return {
        title: `« ${cell.label} » de ${person.name} → ${CELL_STATUS_FR.find(([c]) => c === m)?.[1]}`,
        fields: [
          { label: "Élément", value: `${cell.label} — ${person.name}` },
          { label: "État", value: CELL_STATUS_FR.find(([c]) => c === m)?.[1] ?? m },
        ],
        warnings: m === "WAIVED" ? ["« Sans objet » n'est PAS une suppression : la trace reste — refusé si une dépense est engagée."] : [],
        args: { id: cell.id, status: m },
        successMessage: `« ${cell.label} » de ${person.name} : ${CELL_STATUS_FR.find(([c]) => c === m)?.[1]}.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(setCareCellStatus, args, "Le changement d'état a été refusé.", { revalidate: ["/congress-national"] }),
  },

  remove_care_cell: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      const cell = await resolveCell(person.id, person.name, opStr(input, "label"));
      if ("error" in cell) return cell;
      return {
        title: `Retirer « ${cell.label} » chez ${person.name}`,
        fields: [{ label: "Élément", value: `${cell.label} — ${person.name}` }],
        warnings: ["Refusé si une dépense est engagée sur cet élément — préférez « sans objet » pour garder la trace."],
        args: { id: cell.id },
        successMessage: `Élément « ${cell.label} » retiré.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(removeCareCell, args, "Le retrait a été refusé.", { revalidate: ["/congress-national"] }),
  },

  create_care_quote: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const supplier = opStr(input, "supplier");
      if (!supplier) return { error: "Précisez le fournisseur du devis (champ « supplier »)." };
      const amount = opStr(input, "amount");
      if (!amount || Number(amount) <= 0) return { error: "Précisez le montant du devis (champ « amount », DZD)." };
      const wanted = (opStr(input, "label") || opStr(input, "cells")).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      if (wanted.length === 0) return { error: "Précisez ce que le devis COUVRE (champ « label » — libellés d'éléments, virgules)." };
      const cells = await prisma.careCell.findMany({
        where: { beneficiary: benefWhere(req) },
        select: { id: true, label: true, beneficiary: { select: { firstName: true, lastName: true, doctorId: true } } },
        take: 100,
      });
      const quoteDoctors = await doctorNameMap(cells.map((c) => c.beneficiary.doctorId));
      const cellLabel = (c: (typeof cells)[number]) =>
        `${c.label} (${(c.beneficiary.doctorId ? quoteDoctors.get(c.beneficiary.doctorId) : null) ?? [c.beneficiary.firstName, c.beneficiary.lastName].filter(Boolean).join(" ")})`;
      const ids: string[] = []; const covered: string[] = [];
      for (const w of wanted) {
        const q = fold(w);
        const hits = cells.filter((c) => fold(c.label).includes(q) || fold(cellLabel(c)).includes(q));
        if (hits.length === 0) return { error: `Aucun élément « ${w} » sur ${req.label} — éléments : ${cells.slice(0, 10).map(cellLabel).join(" ; ")}.` };
        for (const h of hits) { if (!ids.includes(h.id)) { ids.push(h.id); covered.push(cellLabel(h)); } }
      }
      return {
        title: `Devis ${supplier} — ${dzd(Number(amount))} (${req.label})`,
        fields: [
          { label: "Congrès", value: req.label },
          { label: "Fournisseur", value: supplier },
          { label: "Montant", value: dzd(Number(amount)) },
          { label: "Couvre", value: covered.join(" ; ") },
        ],
        warnings: ["Un devis couvre ce qu'il couvre réellement (N cases) — les cases couvertes passent « reçues »."],
        args: { scope: req.scope, requestId: req.requestId, supplier, amountDzd: amount, cellIds: ids.join(","), reference: opStr(input, "reference") || null, note: opStr(input, "note") || null },
        successMessage: `Devis ${supplier} (${dzd(Number(amount))}) enregistré — couvre ${ids.length} élément(s).`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(args)) {
        if (v == null || k === "cellIds") continue;
        fd.set(k, v);
      }
      for (const id of (args.cellIds ?? "").split(",").filter(Boolean)) fd.append("cellIds", id);
      const r = await createCareQuote(undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'enregistrement du devis a été refusé." };
      return { ok: true, revalidate: ["/congress-national", "/congress-international"] };
    },
  },

  decide_care_quote: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const supplierRaw = fold(opStr(input, "supplier"));
      const quotes = await prisma.careQuote.findMany({
        where: benefWhere(req), select: { id: true, supplier: true, amountDzd: true, status: true },
        orderBy: { createdAt: "desc" }, take: 12,
      });
      if (quotes.length === 0) return { error: `Aucun devis sur ${req.label}.` };
      const hits = supplierRaw ? quotes.filter((q) => fold(q.supplier).includes(supplierRaw)) : quotes;
      const pick = hits.length === 1 ? hits[0] : quotes.length === 1 ? quotes[0] : null;
      if (!pick) return { error: `Plusieurs devis : ${quotes.map((q) => `${q.supplier} (${dzd(Number(q.amountDzd))})`).join(" ; ")} — préciser le fournisseur (champ « supplier »).` };
      const raw = fold(opStr(input, "decision"));
      const decision = /refus|rejet/.test(raw) ? "REJECTED" : /accept|accord|valid/.test(raw) ? "ACCEPTED" : null;
      if (!decision) return { error: "Précisez la décision (champ « decision ») : accepter ou refuser." };
      return {
        title: `${decision === "ACCEPTED" ? "ACCEPTER" : "REFUSER"} le devis ${pick.supplier} (${dzd(Number(pick.amountDzd))})`,
        fields: [
          { label: "Devis", value: `${pick.supplier} — ${dzd(Number(pick.amountDzd))} (${req.label})` },
        ],
        warnings: decision === "ACCEPTED"
          ? ["D'UN BLOC (le fournisseur a chiffré un ensemble) — crée l'ORDRE DE DÉPENSE ; une case déjà couverte par un devis accepté fait REFUSER (anti double paiement)."]
          : ["Les cases couvertes repassent « demandées » : il faut un autre devis."],
        args: { id: pick.id, decision, note: opStr(input, "note") || null },
        successMessage: `Devis ${pick.supplier} ${decision === "ACCEPTED" ? "ACCEPTÉ (ordre de dépense émis)" : "refusé"}.`,
        revalidate: ["/congress-national", "/congress-international", "/finances/ordres-de-depense"],
      };
    },
    execute: (args) => runFd2(decideCareQuote, args, "La décision sur le devis a été refusée.", { revalidate: ["/congress-national"] }),
  },

  request_care_quotes: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      return {
        title: `Solliciter le secrétariat pour les devis — ${req.label}`,
        fields: [{ label: "Congrès", value: req.label }],
        warnings: ["Le secrétariat est notifié des prestations des personnes ACCORDÉES qui attendent un devis — refuse si la Direction n'a pas validé l'événement."],
        args: { scope: req.scope, requestId: req.requestId },
        successMessage: `Secrétariat sollicité pour les devis (${req.label}).`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(requestCareQuotes, args, "La sollicitation a été refusée.", { revalidate: ["/congress-national"] }),
  },

  send_care_to_finance: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      return {
        title: `Envoyer la prise en charge aux Finances — ${req.label}`,
        fields: [{ label: "Congrès", value: req.label }],
        warnings: ["REFUSE tant que quelque chose manque, en DISANT quoi (pièce manquante d'une personne accordée, devis sans décision) — un dossier incomplet produirait un montant faux."],
        args: { scope: req.scope, requestId: req.requestId },
        successMessage: `Dossier complet transmis aux Finances (${req.label}).`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(sendCareToFinance, args, "L'envoi aux Finances a été refusé.", { revalidate: ["/congress-national"] }),
  },

  link_care_promo: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const req = await resolveCareRequest(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in req) return req;
      const person = await resolveBeneficiary(req, opStr(input, "person"));
      if ("error" in person) return person;
      const cell = await resolveCell(person.id, person.name, opStr(input, "label"));
      if ("error" in cell) return cell;
      const pmRaw = opStr(input, "material");
      const clearing = /^(aucun|retire|d[ée]tache)/i.test(pmRaw);
      let pmId: string | null = null; let pmLabel = "— (détaché)";
      if (!clearing) {
        if (!pmRaw) return { error: "Précisez le matériel promotionnel (champ « material » — MP-… ou titre ; « aucun » pour détacher)." };
        const mats = await prisma.promoMaterial.findMany({
          where: { OR: [{ reference: { contains: pmRaw, mode: "insensitive" } }, { title: { contains: pmRaw, mode: "insensitive" } }], status: { not: "CANCELLED" } },
          select: { id: true, reference: true, title: true }, take: 6,
        });
        if (mats.length === 0) return { error: `Aucun matériel promotionnel « ${pmRaw} ».` };
        if (mats.length > 1) return { error: `Plusieurs matériels correspondent : ${mats.map((m) => `${m.reference} — ${m.title}`).join(" ; ")} — préciser.` };
        pmId = mats[0].id; pmLabel = `${mats[0].reference} — ${mats[0].title}`;
      }
      return {
        title: clearing ? `Détacher « ${cell.label} » de son matériel` : `Rattacher « ${cell.label} » (${person.name}) au matériel ${pmLabel}`,
        fields: [
          { label: "Élément", value: `${cell.label} — ${person.name}` },
          { label: "Matériel", value: pmLabel },
        ],
        warnings: clearing ? [] : ["On rattache, on ne recopie pas : le matériel garde son propre circuit — la case en lit l'avancement."],
        args: { id: cell.id, promoMaterialId: pmId },
        successMessage: clearing ? `« ${cell.label} » détaché.` : `« ${cell.label} » rattaché à ${pmLabel}.`,
        revalidate: ["/congress-national", "/congress-international"],
      };
    },
    execute: (args) => runFd2(linkCareCellPromoMaterial, args, "Le rattachement a été refusé.", { revalidate: ["/congress-national"] }),
  },
};

// ─────────────────────────── MATÉRIEL PROMOTIONNEL ───────────────────────────

interface PromoHit { id: string; reference: string; title: string; status: string }

async function resolvePromo(raw: string): Promise<PromoHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le dossier de matériel promotionnel (champ « reference » — MP-AAAA-NNN ou titre)." };
  const exact = await prisma.promoMaterial.findFirst({
    where: { reference: { equals: q, mode: "insensitive" } },
    select: { id: true, reference: true, title: true, status: true },
  });
  if (exact) return exact;
  const rows = await prisma.promoMaterial.findMany({
    where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, title: true, status: true },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return rows[0];
  if (rows.length === 0) return { error: `Aucun dossier de matériel promotionnel « ${q} ».` };
  return { error: `Plusieurs dossiers correspondent : ${rows.map((p) => `${p.reference} — ${p.title}`).join(" ; ")} — donner la référence exacte.` };
}

/** Marche simple du circuit long : résolution + statut attendu annoncé, args {id} (+ extras). */
function promoStep(opts: {
  title: (pm: PromoHit) => string;
  warning?: string;
  action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  extraFields?: (input: Record<string, unknown>) => [string, string | null][];
  extraArgs?: (input: Record<string, unknown>) => Record<string, string | null>;
  success: (pm: PromoHit) => string;
}): OpImpl {
  return {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      return {
        title: opts.title(pm),
        fields: [
          { label: "Dossier", value: `${pm.reference} — ${pm.title}` },
          ...fieldsOf(opts.extraFields ? opts.extraFields(input) : []),
        ],
        warnings: opts.warning ? [opts.warning] : [],
        args: { id: pm.id, ...(opts.extraArgs ? opts.extraArgs(input) : {}) },
        successMessage: opts.success(pm),
        revalidate: ["/promo-material"],
      };
    },
    execute: (args) => runFd(opts.action, args, "L'étape a été refusée.", { revalidate: ["/promo-material"] }),
  };
}

const PROMO_TRACK_FR: [string, string][] = [
  ["PURCHASE_ORDER", "Bon de commande"], ["PAYMENT", "Demande de paiement"], ["AD_VISA", "Demande de visa publicitaire"],
];

export const PROMO_OPS_IMPL: Record<string, OpImpl> = {
  submit_promo_quotes: promoStep({
    title: (pm) => `Devis déposés (assistante) — ${pm.reference}`,
    warning: "Ferme l'étape « Prospection demandée » — le Marketing arbitre ensuite les devis.",
    action: submitQuotes,
    success: (pm) => `Devis déposés sur ${pm.reference} — au Marketing d'arbitrer.`,
  }),

  choose_promo_agency: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      const agency = opStr(input, "supplier") || opStr(input, "name");
      if (!agency) return { error: "Précisez l'agence retenue (champ « supplier »)." };
      return {
        title: `Retenir l'agence « ${agency} » — ${pm.reference}`,
        fields: fieldsOf([
          ["Dossier", `${pm.reference} — ${pm.title}`],
          ["Agence retenue", agency],
          ["Montant", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : null],
          ["Commentaire", opStr(input, "note") || null],
        ]),
        warnings: ["Geste du MARKETING (demandeur), une fois les devis déposés — la création du BC part à l'assistante."],
        args: { id: pm.id, chosenAgency: agency, chosenAmount: opStr(input, "amount") || null, comment: opStr(input, "note") || null },
        successMessage: `Agence « ${agency} » retenue sur ${pm.reference} — création du BC demandée.`,
        revalidate: ["/promo-material"],
      };
    },
    execute: (args) => runFd(chooseAgency, args, "Le choix de l'agence a été refusé.", { revalidate: ["/promo-material"] }),
  },

  submit_promo_bc: promoStep({
    title: (pm) => `Transmettre le BC aux Finances — ${pm.reference}`,
    warning: "Geste de l'ASSISTANTE, après le choix de l'agence — les Finances valident ensuite le BC.",
    action: submitBcForFinance,
    extraFields: (input) => [["N° du BC", opStr(input, "note") || null]],
    extraArgs: (input) => ({ bcReference: opStr(input, "note") || null }),
    success: (pm) => `Bon de commande de ${pm.reference} transmis aux Finances.`,
  }),

  remind_promo_finance: promoStep({
    title: (pm) => `Relancer les Finances — ${pm.reference}`,
    action: remindFinance,
    success: (pm) => `Finances relancées sur ${pm.reference}.`,
  }),

  validate_promo_bc: promoStep({
    title: (pm) => `Valider le BC (Finances) — ${pm.reference}`,
    warning: "Geste des FINANCES — le BC validé repart à l'assistante pour envoi à l'agence.",
    action: validateBc,
    success: (pm) => `Bon de commande de ${pm.reference} validé (Finances).`,
  }),

  confirm_promo_bc_sent: promoStep({
    title: (pm) => `BC envoyé à l'agence — ${pm.reference}`,
    warning: "Geste de l'ASSISTANTE — l'information médicale initie ensuite le bordereau de paiement.",
    action: confirmBcSent,
    success: (pm) => `BC de ${pm.reference} transmis à l'agence.`,
  }),

  initiate_promo_payment: promoStep({
    title: (pm) => `Initier le bordereau de paiement — ${pm.reference}`,
    warning: "Geste de l'INFORMATION MÉDICALE — crée l'ordre de dépense (montant retenu du dossier) vers les Finances.",
    action: initiatePayment,
    success: (pm) => `Bordereau de paiement initié sur ${pm.reference}.`,
  }),

  confirm_promo_payment: promoStep({
    title: (pm) => `Paiement effectué (Finances) — ${pm.reference}`,
    warning: "Geste des FINANCES — l'information médicale dépose ensuite la quittance.",
    action: confirmPayment,
    extraFields: (input) => [["Commentaire", opStr(input, "note") || null]],
    extraArgs: (input) => ({ comment: opStr(input, "note") || null }),
    success: (pm) => `Paiement de ${pm.reference} confirmé.`,
  }),

  submit_promo_material: promoStep({
    title: (pm) => `Matériel réalisé par l'agence — ${pm.reference}`,
    warning: "Geste du MARKETING, après paiement — la Direction examine ensuite.",
    action: submitMaterial,
    success: (pm) => `Matériel de ${pm.reference} déposé — à l'examen de la Direction.`,
  }),

  review_promo_direction: promoStep({
    title: (pm) => `Examen de la Direction — ${pm.reference}`,
    warning: "Geste de la DIRECTION — part ensuite en vérification de conformité (information médicale).",
    action: directionReview,
    extraFields: (input) => [["Commentaire", opStr(input, "note") || null]],
    extraArgs: (input) => ({ comment: opStr(input, "note") || null }),
    success: (pm) => `Matériel de ${pm.reference} examiné — en conformité.`,
  }),

  confirm_promo_conformity: promoStep({
    title: (pm) => `Conformité + visa publicitaire — ${pm.reference}`,
    warning: "Geste de l'INFORMATION MÉDICALE : conformité validée, références du visa consignées — le Marketing lance ensuite le BAT.",
    action: confirmConformity,
    extraFields: (input) => [["Référence du visa", opStr(input, "note") || null], ["Référence autorité", opStr(input, "message") || null]],
    extraArgs: (input) => ({ visaReference: opStr(input, "note") || null, authorityRef: opStr(input, "message") || null }),
    success: (pm) => `Visa publicitaire obtenu sur ${pm.reference}.`,
  }),

  start_promo_bat: promoStep({
    title: (pm) => `Lancer le BAT / l'impression — ${pm.reference}`,
    action: startBat,
    success: (pm) => `BAT / impression lancés sur ${pm.reference}.`,
  }),

  submit_promo_final: promoStep({
    title: (pm) => `Matériel final livré — ${pm.reference}`,
    warning: "La facture de l'agence est attendue ensuite (assistante).",
    action: submitFinalMaterial,
    success: (pm) => `Matériel final de ${pm.reference} déposé.`,
  }),

  record_promo_invoice: promoStep({
    title: (pm) => `Facture finale enregistrée — ${pm.reference}`,
    warning: "Les Finances règlent ensuite (dernière marche).",
    action: recordInvoice,
    success: (pm) => `Facture finale de ${pm.reference} enregistrée — au règlement des Finances.`,
  }),

  settle_promo: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      return {
        title: `RÉGLER et clôturer — ${pm.reference}`,
        fields: fieldsOf([
          ["Dossier", `${pm.reference} — ${pm.title}`],
          ["Montant du règlement", opStr(input, "amount") ? dzd(Number(opStr(input, "amount"))) : "montant retenu du dossier (défaut)"],
        ]),
        warnings: ["Geste des FINANCES — crée l'ordre de dépense du règlement final et CLÔT le dossier (la demande administrative liée passe « terminée »)."],
        args: { id: pm.id, amount: opStr(input, "amount") || null },
        successMessage: `Dossier ${pm.reference} réglé et clôturé.`,
        revalidate: ["/promo-material", "/finances/ordres-de-depense"],
      };
    },
    execute: (args) => runFd(settle, args, "Le règlement a été refusé.", { revalidate: ["/promo-material"] }),
  },

  comment_promo: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      const body = opStr(input, "message") || opStr(input, "note");
      if (!body) return { error: "Écrivez le commentaire (champ « message »)." };
      return {
        title: `Commenter ${pm.reference}`,
        fields: [{ label: "Dossier", value: `${pm.reference} — ${pm.title}` }, { label: "Commentaire", value: body }],
        args: { promoId: pm.id, body },
        successMessage: `Commentaire posé sur ${pm.reference}.`,
        revalidate: ["/promo-material"],
      };
    },
    execute: (args) => runFd(addPromoComment, args, "Le commentaire a été refusé.", { revalidate: ["/promo-material"] }),
  },

  cancel_promo: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      return {
        title: `ANNULER le dossier ${pm.reference}`,
        fields: [{ label: "Dossier", value: `${pm.reference} — ${pm.title}` }],
        warnings: ["Le dossier passe ANNULÉ (état terminal) — la demande administrative liée est annulée aussi ; un dossier réglé ne s'annule plus."],
        args: { id: pm.id },
        successMessage: `Dossier ${pm.reference} annulé.`,
        revalidate: ["/promo-material"],
      };
    },
    execute: (args) => runFd(cancelPromoMaterial, args, "L'annulation a été refusée.", { revalidate: ["/promo-material"] }),
  },

  start_promo_circuit: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      const hasQuote = /devis (d[ée]j[àa]|en main)|avec devis|oui/i.test(opStr(input, "mode"));
      return {
        title: `Lancer le CIRCUIT COURT — ${pm.reference}`,
        fields: [
          { label: "Dossier", value: `${pm.reference} — ${pm.title}` },
          { label: "Devis en main", value: hasQuote ? "Oui — la demande de devis est sautée" : "Non — demande de devis d'abord" },
        ],
        warnings: ["Refuse si le circuit est déjà lancé — le N+1 est figé maintenant, par l'organigramme."],
        args: { id: pm.id, hasQuote: hasQuote ? "1" : null },
        successMessage: `Circuit court lancé sur ${pm.reference}${hasQuote ? " (devis en main : étape sautée)" : ""}.`,
        revalidate: ["/promo-material"],
      };
    },
    execute: (args) => runFd(startPromoCircuit, args, "Le lancement du circuit a été refusé.", { revalidate: ["/promo-material"] }),
  },

  mark_promo_quote_received: promoStep({
    title: (pm) => `Devis reçu — ${pm.reference}`,
    warning: "Exige qu'un devis soit DÉPOSÉ dans les documents du dossier (confirmer sans pièce est refusé) — la validation du demandeur s'ouvre.",
    action: markQuoteReceived,
    success: (pm) => `Devis de ${pm.reference} enregistré — au demandeur de valider.`,
  }),

  complete_promo_track: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const pm = await resolvePromo(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in pm) return pm;
      const m = matchLabel(opStr(input, "track") || opStr(input, "label"), PROMO_TRACK_FR);
      if (typeof m === "object") return m;
      return {
        title: `Clore le chantier « ${PROMO_TRACK_FR.find(([c]) => c === m)?.[1]} » — ${pm.reference}`,
        fields: [
          { label: "Dossier", value: `${pm.reference} — ${pm.title}` },
          { label: "Chantier", value: PROMO_TRACK_FR.find(([c]) => c === m)?.[1] ?? m },
        ],
        warnings: ["Les trois chantiers avancent en parallèle — le dossier n'est TERMINÉ que lorsque le dernier est clos."],
        args: { id: pm.id, track: m },
        successMessage: `Chantier « ${PROMO_TRACK_FR.find(([c]) => c === m)?.[1]} » clos sur ${pm.reference}.`,
        revalidate: ["/promo-material"],
      };
    },
    execute: (args) => runFd(completePromoTrack, args, "La clôture du chantier a été refusée.", { revalidate: ["/promo-material"] }),
  },

  create_stock_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const name = opStr(input, "name") || opStr(input, "label");
      if (!name) return { error: "Nommez l'article de stock (champ « name »)." };
      return {
        title: `Créer l'article de stock « ${name} »`,
        fields: fieldsOf([
          ["Article", name],
          ["Stock initial", opStr(input, "quantity") || null],
          ["Seuil d'alerte", opStr(input, "threshold") || null],
          ["Unité", opStr(input, "unit") || null],
          ["Emplacement", opStr(input, "location") || null],
        ]),
        warnings: ["La quantité initiale devient une ENTRÉE (jamais un champ quantité) : dès la première ligne, le stock a une explication."],
        args: {
          name, initialQuantity: opStr(input, "quantity") || null, alertThreshold: opStr(input, "threshold") || null,
          unit: opStr(input, "unit") || null, location: opStr(input, "location") || null,
          reference: opStr(input, "note") || null, notes: opStr(input, "notes") || null,
        },
        successMessage: `Article « ${name} » créé.`,
        revalidate: ["/promo-material/stock"],
      };
    },
    execute: (args) => runFd(createStockItem, args, "La création de l'article a été refusée.", { revalidate: ["/promo-material/stock"] }),
  },

  update_stock_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const item = await resolveStockItem(opStr(input, "name") || opStr(input, "label"));
      if ("error" in item) return item;
      const current = await prisma.promoStockItem.findUnique({
        where: { id: item.id }, select: { reference: true, unit: true, location: true, alertThreshold: true, notes: true },
      });
      const newName = opStr(input, "newName") || item.name;
      // FUSION : l'action REMPLACE la fiche (référence, unité, emplacement, seuil, notes) —
      // l'existant est relu et rejoué. La QUANTITÉ, elle, ne se saisit jamais ici.
      return {
        title: `Modifier l'article « ${item.name} »`,
        fields: fieldsOf([
          ["Article", newName !== item.name ? `${item.name} → ${newName}` : item.name],
          ["Seuil d'alerte", opStr(input, "threshold") || (current?.alertThreshold != null ? String(Number(current.alertThreshold)) : null)],
          ["Le reste", "rejoué à l'identique (la quantité ne se saisit JAMAIS ici — passer par un mouvement)"],
        ]),
        args: {
          id: item.id, name: newName,
          reference: opStr(input, "note") || current?.reference || null,
          unit: opStr(input, "unit") || current?.unit || null,
          location: opStr(input, "location") || current?.location || null,
          alertThreshold: opStr(input, "threshold") || (current?.alertThreshold != null ? String(Number(current.alertThreshold)) : null),
          notes: opStr(input, "notes") || current?.notes || null,
        },
        successMessage: `Article « ${newName} » modifié.`,
        revalidate: ["/promo-material/stock"],
      };
    },
    execute: (args) => runFd(updateStockItem, args, "La modification de l'article a été refusée.", { revalidate: ["/promo-material/stock"] }),
  },

  delete_stock_item: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const item = await resolveStockItem(opStr(input, "name") || opStr(input, "label"));
      if ("error" in item) return item;
      const movements = await prisma.promoStockMovement.count({ where: { itemId: item.id } });
      return {
        title: `SUPPRIMER l'article « ${item.name} »`,
        fields: [{ label: "Article", value: item.name }, { label: "Mouvements emportés", value: String(movements) }],
        warnings: ["Suppression DÉFINITIVE de l'article ET de son historique de mouvements — pour un article réel qui ne sert plus, préférez le désactiver (update)."],
        confirmText: item.name,
        args: { id: item.id },
        successMessage: `Article « ${item.name} » supprimé (historique compris).`,
        revalidate: ["/promo-material/stock"],
      };
    },
    execute: (args) => runFd(deleteStockItem, args, "La suppression de l'article a été refusée.", { revalidate: ["/promo-material/stock"] }),
  },

  record_stock_movement: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const item = await resolveStockItem(opStr(input, "name") || opStr(input, "label"));
      if ("error" in item) return item;
      const raw = fold(opStr(input, "mode") || opStr(input, "kind"));
      const kind = /entr[ée]e|r[ée]ception|receipt/.test(raw) ? "RECEIPT"
        : /distribu|sortie|remise/.test(raw) ? "DISTRIBUTION"
        : /perte|casse|perdu/.test(raw) ? "LOSS"
        : /correction|ajust/.test(raw) ? "CORRECTION" : null;
      if (!kind) return { error: "Précisez la nature du mouvement (champ « mode ») : entrée, distribution, perte, ou correction." };
      const qty = opStr(input, "quantity");
      if (!qty) return { error: "Indiquez la quantité (champ « quantity » — positive ; seule la correction accepte un signe)." };
      const KIND_FR: Record<string, string> = { RECEIPT: "Entrée", DISTRIBUTION: "Distribution", LOSS: "Perte", CORRECTION: "Correction" };
      return {
        title: `${KIND_FR[kind]} de ${qty} — ${item.name}`,
        fields: fieldsOf([
          ["Article", item.name],
          ["Mouvement", `${KIND_FR[kind]} de ${qty}`],
          ["Destinataire", opStr(input, "person") || null],
          ["Motif", opStr(input, "note") || null],
          ["Date", isoDate(opStr(input, "date"))],
        ]),
        warnings: ["Le stock est recalculé côté serveur AVANT la garde — une sortie sur un stock insuffisant est refusée."],
        args: {
          itemId: item.id, kind, quantity: qty,
          recipient: opStr(input, "person") || null, reason: opStr(input, "note") || null,
          occurredAt: isoDate(opStr(input, "date")),
        },
        successMessage: `${KIND_FR[kind]} de ${qty} enregistrée sur « ${item.name} ».`,
        revalidate: ["/promo-material/stock"],
      };
    },
    execute: (args) => runFd(recordStockMovement, args, "Le mouvement a été refusé.", { revalidate: ["/promo-material/stock"] }),
  },

  delete_stock_movement: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const item = await resolveStockItem(opStr(input, "name") || opStr(input, "label"));
      if ("error" in item) return item;
      const date = isoDate(opStr(input, "date"));
      const rows = await prisma.promoStockMovement.findMany({
        where: {
          itemId: item.id,
          ...(date ? { occurredAt: { gte: new Date(`${date}T00:00:00Z`), lt: new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000) } } : {}),
        },
        select: { id: true, kind: true, delta: true, occurredAt: true },
        orderBy: { occurredAt: "desc" }, take: 6,
      });
      const label = (m: (typeof rows)[number]) => `${day(m.occurredAt)} · ${m.kind} ${Number(m.delta) > 0 ? "+" : ""}${Number(m.delta)}`;
      if (rows.length === 0) return { error: `Aucun mouvement sur « ${item.name} »${date ? ` le ${date}` : ""}.` };
      if (rows.length > 1) return { error: `Plusieurs mouvements : ${rows.map(label).join(" ; ")} — préciser la date (champ « date »).` };
      return {
        title: `Annuler le mouvement ${label(rows[0])} — ${item.name}`,
        fields: [{ label: "Mouvement", value: `${label(rows[0])} — ${item.name}` }],
        warnings: ["On SUPPRIME l'erreur de saisie (pas de contre-mouvement) — le journal d'audit garde la trace de l'annulation."],
        args: { id: rows[0].id },
        successMessage: `Mouvement annulé sur « ${item.name} ».`,
        revalidate: ["/promo-material/stock"],
      };
    },
    execute: (args) => runFd(deleteStockMovement, args, "L'annulation du mouvement a été refusée.", { revalidate: ["/promo-material/stock"] }),
  },
};

const resolveStockItem = (raw: string) =>
  resolveOne(raw, "l'article de stock (champ « name »)",
    (q) => prisma.promoStockItem.findMany({ where: { name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true }, take: 6 }),
    (i) => i.name);
