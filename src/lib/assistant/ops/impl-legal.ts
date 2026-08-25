import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/utils";
import {
  renewLegalDocument, cancelLegalDocument, setLegalReaders, sendLegalInvoiceToSettlement,
} from "@/lib/actions/legal-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { resolvePeopleList } from "./impl-drive";

/**
 * OPS LEGAL — renouveler (chaîne de documents), annuler, régler les LECTEURS (le déposant
 * choisit, nul autre ne voit), envoyer une facture au règlement — par les ACTIONS CANONIQUES
 * de `legal-actions.ts` (droits du déposant et cloisonnement re-vérifiés à l'exécution).
 */

interface LegalHit { id: string; title: string; reference: string | null; kind: string; status: string; amount: number | null; endDate: Date | null }

const dzd = (n: number): string => `${n.toLocaleString("fr-FR")} DZD`;
const day = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : "sans échéance");

async function resolveLegalDoc(raw: string, extra?: { kind?: string }): Promise<LegalHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le titre ou la référence du document légal (champ « reference »)." };
  const rows = await prisma.legalDocument.findMany({
    where: {
      ...(extra?.kind ? { kind: extra.kind as never } : {}),
      OR: [{ reference: { equals: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }],
    },
    select: { id: true, title: true, reference: true, kind: true, status: true, amount: true, endDate: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  const hits: LegalHit[] = rows.map((r) => ({ ...r, amount: r.amount === null ? null : toNumber(r.amount) }));
  if (hits.length === 0) return { error: `Aucun document légal « ${q} »${extra?.kind === "INVOICE" ? " (facture)" : ""}.` };
  const exact = hits.filter((h) => (h.reference ?? "").toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (hits.length === 1) return hits[0];
  return { error: `Plusieurs documents correspondent à « ${q} » : ${hits.map((h) => `${h.reference ? `${h.reference} — ` : ""}${h.title}`).join(" ; ")} — préciser.` };
}

const iso = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const LEGAL_REVALIDATE = ["/legal"];

export const LEGAL_OPS_IMPL: Record<string, OpImpl> = {
  renew: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in doc) return doc;
      const startDate = iso(opStr(input, "startDate"));
      const endDate = iso(opStr(input, "endDate"));
      return {
        title: `Renouveler « ${doc.title} »`,
        fields: [
          { label: "Document", value: `${doc.reference ? `${doc.reference} — ` : ""}${doc.title}` },
          { label: "Échéance actuelle", value: day(doc.endDate) },
          { label: "Nouvelle période", value: `${startDate ?? "reprend la précédente"} → ${endDate ?? "reprend la précédente"}` },
        ],
        warnings: ["Un document SUIVANT est créé dans la chaîne — l'ancien est marqué renouvelé, l'historique reste lisible."],
        args: { id: doc.id, startDate, endDate, notes: opStr(input, "notes"), label: doc.title },
        successMessage: `« ${doc.title} » renouvelé — le document suivant de la chaîne est créé.`,
        link: "/legal",
        revalidate: LEGAL_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      if (args.startDate) fd.set("startDate", args.startDate);
      if (args.endDate) fd.set("endDate", args.endDate);
      if (args.notes) fd.set("notes", args.notes);
      const r = await renewLegalDocument(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le renouvellement a été refusé." };
      return { ok: true, createdId: r.id, link: "/legal", revalidate: LEGAL_REVALIDATE };
    },
  },

  cancel: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in doc) return doc;
      const reason = opStr(input, "note");
      return {
        title: `Annuler le document légal « ${doc.title} »`,
        fields: [
          { label: "Document", value: `${doc.reference ? `${doc.reference} — ` : ""}${doc.title}` },
          { label: "Motif", value: reason || "(aucun)" },
        ],
        warnings: ["Le document sort des rappels d'échéance — rien n'est effacé, le motif est conservé."],
        args: { id: doc.id, reason, label: doc.title },
        successMessage: `Document « ${doc.title} » annulé.`,
        link: "/legal",
        revalidate: LEGAL_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      if (args.reason) fd.set("reason", args.reason);
      const r = await cancelLegalDocument(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'annulation a été refusée." };
      return { ok: true, revalidate: LEGAL_REVALIDATE };
    },
  },

  set_readers: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in doc) return doc;
      const rawPeople = opStr(input, "people");
      if (!rawPeople) return { error: "Donnez les lecteurs (champ « people », noms séparés par des virgules) — liste vide impossible par ici." };
      const { people, problems } = await resolvePeopleList(rawPeople, "");
      if (people.length === 0) return { error: `Aucune personne résolue : ${problems.join(" ; ")}.` };
      return {
        title: `Lecteurs de « ${doc.title} » : ${people.map((p) => p.name).join(", ")}`,
        fields: [
          { label: "Document", value: `${doc.reference ? `${doc.reference} — ` : ""}${doc.title}` },
          { label: "Lecteurs", value: people.map((p) => p.name).join(", ") },
        ],
        warnings: [
          "La liste des lecteurs est REMPLACÉE par celle-ci — le déposant garde toujours l'accès, nul autre ne voit.",
          ...problems.map((p) => `Ignoré : ${p}.`),
        ],
        args: { id: doc.id, userIds: people.map((p) => p.id).join(","), label: doc.title },
        successMessage: `Lecteurs de « ${doc.title} » mis à jour (${people.length} personne(s)).`,
        link: "/legal",
        revalidate: LEGAL_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      for (const id of (args.userIds ?? "").split(",").filter(Boolean)) fd.append("readerId", id);
      const r = await setLegalReaders(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La mise à jour des lecteurs a été refusée." };
      return { ok: true, revalidate: LEGAL_REVALIDATE };
    },
  },

  send_invoice_settlement: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const doc = await resolveLegalDoc(opStr(input, "reference") || opStr(input, "label"), { kind: "INVOICE" });
      if ("error" in doc) return doc;
      if (doc.amount === null || doc.amount <= 0) {
        return { error: `La facture « ${doc.title} » n'a pas de montant renseigné — le renseigner sur la fiche avant l'envoi au règlement.` };
      }
      return {
        title: `Envoyer la facture « ${doc.title} » au règlement (${dzd(doc.amount)})`,
        fields: [
          { label: "Facture", value: `${doc.reference ? `${doc.reference} — ` : ""}${doc.title}` },
          { label: "Montant", value: dzd(doc.amount) },
        ],
        warnings: ["Un ORDRE DE DÉPENSE est créé dans le circuit Finances / Centre de paiement — rien n'est décaissé ici. Une facture déjà partie au règlement est refusée."],
        args: { id: doc.id, label: doc.title },
        successMessage: `Facture « ${doc.title} » envoyée au règlement — ordre de dépense créé.`,
        link: "/legal",
        revalidate: [...LEGAL_REVALIDATE, "/finances"],
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("id", args.id ?? "");
      const r = await sendLegalInvoiceToSettlement(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'envoi au règlement a été refusé." };
      return { ok: true, revalidate: [...LEGAL_REVALIDATE, "/finances"] };
    },
  },
};
