import type { MailAddress, MailAttachmentMeta, MailFolder, MailMessage, MailSummary } from "../provider";
import { wellKnownFromGraph } from "../folders";
import { sanitizeMailHtml, htmlToText } from "../sanitize";

/**
 * DE MICROSOFT GRAPH VERS NOTRE VOCABULAIRE.
 *
 * C'est ici, et NULLE PART ailleurs, que les particularités de Graph s'arrêtent : `emailAddress`
 * imbriqué, `bodyPreview`, `isDraft`, `parentFolderId`… Au-delà de ce fichier, l'application ne
 * connaît que ses propres types. Sans cette frontière, la forme de Graph remonterait jusque dans
 * les composants React, et changer de fournisseur signifierait tout réécrire.
 *
 * **Le corps est assaini ICI**, à la conversion — pas à l'affichage. Un écran qui doit penser à
 * assainir finira par oublier ; un type qui arrive déjà propre ne le peut pas.
 *
 * Module PUR — testé.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export function toAddress(raw: Raw | null | undefined): MailAddress | null {
  const e = raw?.emailAddress ?? raw;
  const address = typeof e?.address === "string" ? e.address.trim() : "";
  if (!address) return null;
  const name = typeof e?.name === "string" ? e.name.trim() : "";
  return { name: name && name !== address ? name : null, address };
}

export function toAddressList(raw: unknown): MailAddress[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => toAddress(r)).filter((a): a is MailAddress => a !== null);
}

export function toFolder(raw: Raw): MailFolder {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.displayName ?? "Dossier"),
    // Graph ne rend `wellKnownName` que sur demande : on retombe sur le nom affiché, qui vaut
    // « Inbox » / « Sent Items » sur une boîte anglaise et « Boîte de réception » sur une boîte
    // française — d'où la reconnaissance par les deux.
    wellKnown: wellKnownFromGraph(raw.wellKnownName) ?? wellKnownFromGraph(raw.displayName),
    unread: Number(raw.unreadItemCount ?? 0),
    total: Number(raw.totalItemCount ?? 0),
    parentId: raw.parentFolderId ? String(raw.parentFolderId) : null,
  };
}

export function toSummary(raw: Raw): MailSummary {
  return {
    id: String(raw.id ?? ""),
    conversationId: raw.conversationId ? String(raw.conversationId) : null,
    subject: String(raw.subject ?? "").trim() || "(sans objet)",
    from: toAddress(raw.from ?? raw.sender),
    to: toAddressList(raw.toRecipients),
    preview: String(raw.bodyPreview ?? "").replace(/\s+/g, " ").trim(),
    receivedAt: String(raw.receivedDateTime ?? raw.sentDateTime ?? raw.createdDateTime ?? ""),
    isRead: Boolean(raw.isRead),
    // Une pièce jointe « inline » (image du corps) fait passer `hasAttachments` à vrai chez Graph :
    // afficher un trombone pour la signature de l'expéditeur use le signal jusqu'à l'ignorer.
    hasAttachments: Boolean(raw.hasAttachments),
    isDraft: Boolean(raw.isDraft),
    folderId: raw.parentFolderId ? String(raw.parentFolderId) : "",
  };
}

export function toAttachmentMeta(raw: Raw): MailAttachmentMeta {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "piece-jointe"),
    contentType: String(raw.contentType ?? "application/octet-stream"),
    size: Number(raw.size ?? 0),
    isInline: Boolean(raw.isInline),
  };
}

export function toMessage(raw: Raw, attachments: Raw[] = []): MailMessage {
  const isHtml = String(raw.body?.contentType ?? "").toLowerCase() === "html";
  const rawBody = String(raw.body?.content ?? "");
  const bodyHtml = isHtml
    ? sanitizeMailHtml(rawBody)
    // Un corps en texte brut n'est pas du HTML : l'injecter tel quel ferait interpréter le moindre
    // chevron. On échappe, puis on rend les retours à la ligne.
    : escapeToHtml(rawBody);

  const metas = attachments.map(toAttachmentMeta).filter((a) => !a.isInline);
  return {
    ...toSummary(raw),
    cc: toAddressList(raw.ccRecipients),
    bcc: toAddressList(raw.bccRecipients),
    replyTo: toAddressList(raw.replyTo),
    bodyHtml,
    bodyText: isHtml ? htmlToText(rawBody) : rawBody,
    attachments: metas,
    webLink: raw.webLink ? String(raw.webLink) : null,
  };
}

function escapeToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

/**
 * Le jeton de page suivante, extrait de `@odata.nextLink`.
 *
 * On ne rend PAS l'URL complète au navigateur : elle contient l'adresse de la boîte et se
 * transmettrait d'un onglet à l'autre. On garde le `$skiptoken`, qui ne désigne rien tout seul.
 */
export function skipToken(nextLink: string | null | undefined): string | null {
  if (!nextLink) return null;
  const m = /[?&]\$skiptoken=([^&]+)/i.exec(nextLink);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Le jeton de delta, extrait de `@odata.deltaLink` (même raison : on ne rend pas l'URL). */
export function deltaToken(deltaLink: string | null | undefined): string | null {
  if (!deltaLink) return null;
  const m = /[?&]\$deltatoken=([^&]+)/i.exec(deltaLink);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Une entrée de delta supprimée porte `@removed` — c'est le seul moyen de le savoir. */
export function isRemoved(raw: Raw): boolean {
  return Boolean(raw["@removed"]);
}
