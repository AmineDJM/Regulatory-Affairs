import { prisma } from "@/lib/prisma";
import { platformScope } from "@/lib/company";
import { LINK_TYPE_LABELS, targetsFor, type LinkType } from "@/lib/links/graph";

/**
 * CE À QUOI ON PEUT RELIER, DEPUIS ICI — les listes du menu « Relier à… ».
 *
 * Le flux (`targetsFor`) décide des NATURES proposées : depuis une facture on ne voit que les bons
 * de commande et les courriers, jamais le marché — l'écran n'offre donc même pas le raccourci que
 * le serveur refuserait. Les listes sont cloisonnées par entité là où le module l'est et bornées :
 * ce sont des commodités de saisie, l'accès est REVÉRIFIÉ à l'écriture (`links/store.ts`).
 */

export interface LinkCandidateGroup {
  type: string;
  typeLabel: string;
  options: { value: string; label: string }[];
}

const TAKE = 200;

export async function linkCandidates(
  userId: string,
  self: { type: LinkType; id: string },
): Promise<LinkCandidateGroup[]> {
  const types = targetsFor(self.type);
  if (types.length === 0) return [];
  const scope = await platformScope(userId);
  const groups: LinkCandidateGroup[] = [];

  for (const t of types) {
    const base = { type: t as string, typeLabel: LINK_TYPE_LABELS[t] };
    if (t === "PCH_TENDER") {
      const rows = await prisma.pchTender.findMany({
        where: scope, select: { id: true, reference: true, title: true }, orderBy: { createdAt: "desc" }, take: TAKE,
      });
      groups.push({ ...base, options: rows.map((r) => ({ value: r.id, label: `${r.reference}${r.title ? ` — ${r.title}` : ""}` })) });
    } else if (t === "PCH_ORDER") {
      const rows = await prisma.pchOrder.findMany({
        select: { id: true, reference: true, tender: { select: { reference: true } } }, orderBy: { createdAt: "desc" }, take: TAKE,
      });
      groups.push({ ...base, options: rows.map((r) => ({ value: r.id, label: `BC ${r.reference ?? "s/n"} — ${r.tender.reference}` })) });
    } else if (t === "INVOICE") {
      // Une facture est un document légal de nature « facture » — elle n'apparaît donc QUE dans
      // ce groupe, jamais aussi dans « Documents légaux » : la proposer deux fois laisserait
      // relier la même pièce sous deux natures, et le même couple s'enregistrerait deux fois.
      const rows = await prisma.legalDocument.findMany({
        where: { AND: [scope, { kind: "INVOICE" }, ...(self.type === "INVOICE" ? [{ id: { not: self.id } }] : [])] },
        select: { id: true, reference: true, title: true }, orderBy: { createdAt: "desc" }, take: TAKE,
      });
      groups.push({ ...base, options: rows.map((r) => ({ value: r.id, label: `Facture ${r.reference ? `${r.reference} — ` : ""}${r.title}` })) });
    } else if (t === "LEGAL_DOCUMENT") {
      const rows = await prisma.legalDocument.findMany({
        // Un document ne se relie pas à LUI-MÊME : l'écarter de la liste vaut mieux que de le
        // proposer pour refuser ensuite.
        where: { AND: [scope, { kind: { not: "INVOICE" } }, ...(self.type === "LEGAL_DOCUMENT" ? [{ id: { not: self.id } }] : [])] },
        select: { id: true, title: true, reference: true }, orderBy: { createdAt: "desc" }, take: TAKE,
      });
      groups.push({ ...base, options: rows.map((r) => ({ value: r.id, label: `${r.reference ? `${r.reference} — ` : ""}${r.title}` })) });
    } else if (t === "REGULATORY_PRODUCT") {
      const rows = await prisma.regulatoryProduct.findMany({
        where: { isLocked: false }, select: { id: true, reference: true, dci: true }, orderBy: { updatedAt: "desc" }, take: TAKE,
      });
      groups.push({ ...base, options: rows.map((r) => ({ value: r.id, label: `${r.reference} — ${r.dci}` })) });
    } else {
      const rows = await prisma.mailEntry.findMany({
        where: scope, select: { id: true, reference: true, title: true }, orderBy: { createdAt: "desc" }, take: TAKE,
      });
      groups.push({ ...base, options: rows.map((r) => ({ value: r.id, label: `${r.reference ? `${r.reference} — ` : ""}${r.title}` })) });
    }
  }
  return groups;
}
