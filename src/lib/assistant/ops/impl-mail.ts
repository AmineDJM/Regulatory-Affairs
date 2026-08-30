import { prisma } from "@/lib/prisma";
import { resolveDriveAccess } from "@/lib/drive";
import { createMailEntry, editMailEntry, attachDriveNodeToMail, addMailLink, removeMailLink } from "@/lib/actions/mail-register-actions";
import { moveMailEntries } from "@/lib/actions/mail-folder-actions";
import type { OpImpl, OpProposalDraft } from "./types";
import { opStr } from "./types";
import { runFd } from "./helpers";

/**
 * OPS COURRIERS — le registre des plis (créer, corriger, classer, déclarer un fichier Drive
 * en courrier), par les ACTIONS CANONIQUES de `mail-register-actions` / `mail-folder-actions`
 * (cloisonnement par entité et anti-doublon Drive inclus). La correction FUSIONNE : les
 * champs non cités sont relus et rejoués — corriger un titre ne coûte jamais un expéditeur.
 */

interface EntryHit { id: string; title: string; reference: string | null; direction: string }

const dirLabel = (d: string): string => (d === "INCOMING" ? "Entrant" : "Sortant");

async function resolveMailEntry(raw: string): Promise<EntryHit | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez le n° de chrono ou le titre du courrier (champ « reference »)." };
  const rows = await prisma.mailEntry.findMany({
    where: { OR: [{ reference: { equals: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
    select: { id: true, title: true, reference: true, direction: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (rows.length === 0) return { error: `Aucun courrier « ${q} » au registre.` };
  const exact = rows.filter((r) => (r.reference ?? "").toLowerCase() === q.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  return { error: `Plusieurs courriers correspondent à « ${q} » : ${rows.map((r) => `${r.reference ? `${r.reference} — ` : ""}${r.title} (${dirLabel(r.direction)})`).join(" ; ")} — préciser.` };
}

const directionOf = (raw: string): "INCOMING" | "OUTGOING" | null => {
  const k = raw.toLowerCase();
  if (/entrant|arriv|re[çc]u|incoming/.test(k)) return "INCOMING";
  if (/sortant|d[ée]part|envoy|outgoing/.test(k)) return "OUTGOING";
  return null;
};

const MAIL_REVALIDATE = ["/courriers"];

/**
 * LES CIBLES DU « RELIER À… » (§25) — mêmes familles que l'écran. La résolution suit
 * l'invariant des ops : exact → unique → ambiguïté LISTÉE, jamais de choix silencieux.
 */
const LINK_KINDS: [string, string][] = [
  ["PCH_TENDER", "Marché PCH"], ["PCH_ORDER", "Bon de commande PCH"],
  ["LEGAL_DOCUMENT", "Document légal"], ["REGULATORY_PRODUCT", "Dossier Regulatory"],
];

async function resolveLinkTarget(kindRaw: string, raw: string): Promise<{ entityType: string; entityId: string; label: string } | { error: string }> {
  const q = raw.trim();
  if (!q) return { error: "Précisez la cible (champ « target » — référence ou titre)." };
  const k = kindRaw.trim().toLowerCase();
  const kind = /march|tender|\bao\b|appel/.test(k) ? "PCH_TENDER"
    : /\bbc\b|bon de commande|commande/.test(k) ? "PCH_ORDER"
      : /contrat|l[ée]gal|convention|avenant/.test(k) ? "LEGAL_DOCUMENT"
        : /regulatory|dossier|produit/.test(k) ? "REGULATORY_PRODUCT"
          : null;
  if (!kind) return { error: "Précisez le type de cible (champ « kind ») : marché PCH, bon de commande, document légal, ou dossier Regulatory." };

  if (kind === "PCH_TENDER") {
    const rows = await prisma.pchTender.findMany({
      where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
      select: { id: true, reference: true, title: true }, orderBy: { createdAt: "desc" }, take: 6,
    });
    if (rows.length === 1) return { entityType: kind, entityId: rows[0].id, label: `${rows[0].reference}${rows[0].title ? ` — ${rows[0].title}` : ""}` };
    if (rows.length === 0) return { error: `Aucun marché « ${q} ».` };
    return { error: `Plusieurs marchés correspondent : ${rows.map((r) => r.reference).join(" ; ")} — préciser.` };
  }
  if (kind === "PCH_ORDER") {
    const rows = await prisma.pchOrder.findMany({
      where: { OR: [{ reference: { contains: q, mode: "insensitive" } }, { tender: { reference: { contains: q, mode: "insensitive" } } }] },
      select: { id: true, reference: true, tender: { select: { reference: true } } }, orderBy: { createdAt: "desc" }, take: 6,
    });
    if (rows.length === 1) return { entityType: kind, entityId: rows[0].id, label: `BC ${rows[0].reference ?? "s/n"} — ${rows[0].tender.reference}` };
    if (rows.length === 0) return { error: `Aucun bon de commande « ${q} ».` };
    return { error: `Plusieurs bons de commande correspondent : ${rows.map((r) => `BC ${r.reference ?? "s/n"} (${r.tender.reference})`).join(" ; ")} — préciser.` };
  }
  if (kind === "LEGAL_DOCUMENT") {
    const rows = await prisma.legalDocument.findMany({
      where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] },
      select: { id: true, title: true, reference: true }, orderBy: { createdAt: "desc" }, take: 6,
    });
    if (rows.length === 1) return { entityType: kind, entityId: rows[0].id, label: `${rows[0].reference ? `${rows[0].reference} — ` : ""}${rows[0].title}` };
    if (rows.length === 0) return { error: `Aucun document légal « ${q} ».` };
    return { error: `Plusieurs documents correspondent : ${rows.map((r) => r.title).join(" ; ")} — préciser.` };
  }
  const rows = await prisma.regulatoryProduct.findMany({
    where: { isLocked: false, OR: [{ reference: { contains: q, mode: "insensitive" } }, { dci: { contains: q, mode: "insensitive" } }, { brandName: { contains: q, mode: "insensitive" } }] },
    select: { id: true, reference: true, dci: true }, orderBy: { updatedAt: "desc" }, take: 6,
  });
  if (rows.length === 1) return { entityType: kind, entityId: rows[0].id, label: `${rows[0].reference} — ${rows[0].dci}` };
  if (rows.length === 0) return { error: `Aucun dossier Regulatory « ${q} ».` };
  return { error: `Plusieurs dossiers correspondent : ${rows.map((r) => `${r.reference} (${r.dci})`).join(" ; ")} — préciser.` };
}

export const MAIL_OPS_IMPL: Record<string, OpImpl> = {
  link_record: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const entry = await resolveMailEntry(opStr(input, "reference"));
      if ("error" in entry) return entry;
      const cible = await resolveLinkTarget(opStr(input, "kind"), opStr(input, "target"));
      if ("error" in cible) return cible;
      const typeLabel = LINK_KINDS.find(([c]) => c === cible.entityType)?.[1] ?? cible.entityType;
      return {
        title: `Relier le courrier à ${typeLabel.toLowerCase()}`,
        fields: [
          { label: "Courrier", value: `${entry.reference ? `${entry.reference} — ` : ""}${entry.title}` },
          { label: typeLabel, value: cible.label },
        ],
        args: { entryId: entry.id, entityType: cible.entityType, entityId: cible.entityId },
        successMessage: `Courrier « ${entry.title} » relié à « ${cible.label} » — visible des deux côtés.`,
        link: `/courriers/${entry.id}`, revalidate: MAIL_REVALIDATE,
      };
    },
    execute: (args) => runFd(addMailLink, args, "Le lien a été refusé."),
  },

  unlink_record: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const entry = await resolveMailEntry(opStr(input, "reference"));
      if ("error" in entry) return entry;
      const links = await prisma.mailEntryLink.findMany({
        where: { entryId: entry.id }, select: { id: true, label: true, entityId: true }, orderBy: { createdAt: "asc" },
      });
      if (links.length === 0) return { error: `Le courrier « ${entry.title} » n'a aucun lien à retirer.` };
      const q = opStr(input, "target").trim().toLowerCase();
      const hits = q ? links.filter((l) => (l.label ?? "").toLowerCase().includes(q)) : links;
      if (hits.length === 0) return { error: `Aucun lien « ${opStr(input, "target")} » — présents : ${links.map((l) => l.label ?? l.entityId).join(" ; ")}.` };
      if (hits.length > 1) return { error: `Précisez le lien à retirer (champ « target ») parmi : ${hits.map((l) => l.label ?? l.entityId).join(" ; ")}.` };
      return {
        title: `Retirer le lien « ${hits[0].label ?? hits[0].entityId} »`,
        fields: [
          { label: "Courrier", value: `${entry.reference ? `${entry.reference} — ` : ""}${entry.title}` },
          { label: "Lien retiré", value: hits[0].label ?? hits[0].entityId },
        ],
        args: { id: hits[0].id },
        successMessage: `Lien « ${hits[0].label ?? hits[0].entityId} » retiré du courrier.`,
        link: `/courriers/${entry.id}`, revalidate: MAIL_REVALIDATE,
      };
    },
    execute: (args) => runFd(removeMailLink, args, "Le retrait du lien a été refusé."),
  },

  create_entry: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const title = opStr(input, "label");
      if (!title) return { error: "Donnez l'objet du courrier (champ « label »)." };
      const direction = directionOf(opStr(input, "direction")) ?? "INCOMING";
      const sender = opStr(input, "sender");
      const recipient = opStr(input, "recipient");
      const reference = opStr(input, "reference");
      return {
        title: `Enregistrer le courrier ${direction === "INCOMING" ? "entrant" : "sortant"} — ${title}`,
        fields: [
          { label: "Objet", value: title },
          { label: "Sens", value: dirLabel(direction) },
          ...(sender ? [{ label: "Expéditeur", value: sender }] : []),
          ...(recipient ? [{ label: "Destinataire", value: recipient }] : []),
          ...(reference ? [{ label: "N° de chrono", value: reference }] : []),
        ],
        args: { title, direction, sender, recipient, reference, notes: opStr(input, "notes") },
        successMessage: `Courrier « ${title} » enregistré au registre.`,
        link: "/courriers",
        revalidate: MAIL_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("title", args.title ?? "");
      fd.set("direction", args.direction ?? "INCOMING");
      if (args.sender) fd.set("sender", args.sender);
      if (args.recipient) fd.set("recipient", args.recipient);
      if (args.reference) fd.set("reference", args.reference);
      if (args.notes) fd.set("notes", args.notes);
      const r = await createMailEntry(undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "L'enregistrement du courrier a été refusé." };
      return { ok: true, createdId: r.id, link: r.id ? `/courriers/${r.id}` : "/courriers", revalidate: MAIL_REVALIDATE };
    },
  },

  edit_entry: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const entry = await resolveMailEntry(opStr(input, "reference") || opStr(input, "label"));
      if ("error" in entry) return entry;
      const current = await prisma.mailEntry.findUnique({
        where: { id: entry.id },
        select: { title: true, reference: true, direction: true, sender: true, recipient: true, carrier: true, notes: true },
      });
      if (!current) return { error: "Courrier introuvable." };
      // FUSION : l'action remplace ce qu'elle reçoit — on rejoue l'existant partout ailleurs.
      const title = opStr(input, "newLabel") || current.title;
      const direction = directionOf(opStr(input, "direction")) ?? current.direction;
      const sender = opStr(input, "sender") || current.sender || "";
      const recipient = opStr(input, "recipient") || current.recipient || "";
      const reference = opStr(input, "newReference") || current.reference || "";
      const notes = opStr(input, "notes") || current.notes || "";
      const changes: string[] = [];
      if (title !== current.title) changes.push(`objet → ${title}`);
      if (direction !== current.direction) changes.push(`sens → ${dirLabel(direction)}`);
      if (opStr(input, "sender")) changes.push(`expéditeur → ${sender}`);
      if (opStr(input, "recipient")) changes.push(`destinataire → ${recipient}`);
      if (opStr(input, "newReference")) changes.push(`chrono → ${reference}`);
      if (opStr(input, "notes")) changes.push("notes");
      if (changes.length === 0) return { error: "Rien à corriger : donnez newLabel, direction, sender, recipient, newReference ou notes." };
      return {
        title: `Corriger le courrier « ${current.title} »`,
        fields: [
          { label: "Courrier", value: `${current.reference ? `${current.reference} — ` : ""}${current.title}` },
          { label: "Corrections", value: changes.join(" · ") },
        ],
        args: { id: entry.id, title, direction, sender, recipient, reference, notes },
        successMessage: `Courrier « ${title} » corrigé (${changes.join(", ")}).`,
        link: `/courriers/${entry.id}`,
        revalidate: MAIL_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      fd.set("title", args.title ?? "");
      fd.set("direction", args.direction ?? "INCOMING");
      if (args.sender) fd.set("sender", args.sender);
      if (args.recipient) fd.set("recipient", args.recipient);
      if (args.reference) fd.set("reference", args.reference);
      if (args.notes) fd.set("notes", args.notes);
      const r = await editMailEntry(args.id ?? "", undefined, fd);
      if (!r.ok) return { ok: false, error: r.error ?? "La correction du courrier a été refusée." };
      return { ok: true, revalidate: MAIL_REVALIDATE };
    },
  },

  move_entries: {
    async propose(input): Promise<OpProposalDraft | { error: string }> {
      const raw = opStr(input, "reference") || opStr(input, "label");
      const targets = raw.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      if (targets.length === 0) return { error: "Donnez le ou les courriers à classer (champ « reference », séparés par des virgules)." };
      const entries: EntryHit[] = [];
      for (const t of targets) {
        const e = await resolveMailEntry(t);
        if ("error" in e) return e;
        entries.push(e);
      }
      const folderName = opStr(input, "folder");
      let folderId = "";
      let folderLabel = "Non classés";
      if (folderName && !/^non class/i.test(folderName)) {
        const folders = await prisma.mailEntryFolder.findMany({
          where: { name: { contains: folderName, mode: "insensitive" } },
          select: { id: true, name: true },
          take: 4,
        });
        if (folders.length === 0) return { error: `Aucun dossier de courriers « ${folderName} ».` };
        if (folders.length > 1) return { error: `Plusieurs dossiers correspondent à « ${folderName} » : ${folders.map((f) => f.name).join(", ")} — préciser.` };
        folderId = folders[0].id;
        folderLabel = folders[0].name;
      }
      return {
        title: `Classer ${entries.length} courrier(s) dans « ${folderLabel} »`,
        fields: [
          { label: "Courriers", value: entries.map((e) => e.reference || e.title).join(", ") },
          { label: "Dossier", value: folderLabel },
        ],
        args: { entryIds: entries.map((e) => e.id).join(","), folderId, folderLabel },
        successMessage: `${entries.length} courrier(s) classé(s) dans « ${folderLabel} ».`,
        link: "/courriers",
        revalidate: MAIL_REVALIDATE,
      };
    },
    async execute(args) {
      const fd = new FormData();
      for (const id of (args.entryIds ?? "").split(",").filter(Boolean)) fd.append("entryId", id);
      if (args.folderId) fd.set("folderId", args.folderId);
      const r = await moveMailEntries(fd);
      if (!r.ok) return { ok: false, error: r.error ?? "Le classement a été refusé." };
      return { ok: true, revalidate: MAIL_REVALIDATE };
    },
  },

  attach_drive: {
    async propose(input, user): Promise<OpProposalDraft | { error: string }> {
      const q = opStr(input, "name");
      if (!q) return { error: "Précisez le nom du fichier Drive à déclarer (champ « name »)." };
      // Résolution locale : fichier NON à la corbeille, accessible en lecture (l'action revérifie).
      const rows = await prisma.driveNode.findMany({
        where: { name: { contains: q, mode: "insensitive" }, type: "FILE", isTrashed: false },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      });
      const visible: { id: string; name: string }[] = [];
      for (const r of rows) {
        if ((await resolveDriveAccess(user, r.id)) !== "NONE") visible.push(r);
      }
      if (visible.length === 0) return { error: `Aucun fichier Drive « ${q} » accessible.` };
      if (visible.length > 1 && !visible.some((v) => v.name.toLowerCase() === q.toLowerCase())) {
        return { error: `Plusieurs fichiers correspondent à « ${q} » : ${visible.map((v) => v.name).join(" ; ")} — préciser le nom exact.` };
      }
      const node = visible.find((v) => v.name.toLowerCase() === q.toLowerCase()) ?? visible[0];
      const direction = directionOf(opStr(input, "direction")) ?? "INCOMING";
      return {
        title: `Déclarer « ${node.name} » en courrier ${direction === "INCOMING" ? "entrant" : "sortant"}`,
        fields: [
          { label: "Fichier Drive", value: node.name },
          { label: "Sens", value: dirLabel(direction) },
          ...(opStr(input, "sender") ? [{ label: "Expéditeur", value: opStr(input, "sender") }] : []),
        ],
        warnings: ["Le fichier est RÉFÉRENCÉ, jamais copié — un fichier déjà déclaré n'est pas doublonné."],
        args: {
          driveNodeId: node.id, name: node.name, direction,
          sender: opStr(input, "sender"), recipient: opStr(input, "recipient"), reference: opStr(input, "reference"),
        },
        successMessage: `« ${node.name} » déclaré au registre des courriers.`,
        link: "/courriers",
        revalidate: MAIL_REVALIDATE,
      };
    },
    async execute(args) {
      const r = await attachDriveNodeToMail({
        driveNodeId: args.driveNodeId ?? "",
        direction: args.direction ?? undefined,
        sender: args.sender ?? undefined,
        recipient: args.recipient ?? undefined,
        reference: args.reference ?? undefined,
      });
      if (!r.ok) return { ok: false, error: r.error ?? "La déclaration en courrier a été refusée." };
      return { ok: true, createdId: r.id, link: r.id ? `/courriers/${r.id}` : "/courriers", revalidate: MAIL_REVALIDATE };
    },
  },
};
