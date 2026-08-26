/**
 * LE MESSAGE, TEL QU'IL PART — construction RFC 5322, et lecture des en-têtes.
 *
 * Un courriel n'est pas un objet JSON : c'est un texte avec des règles précises, et deux d'entre
 * elles décident si la conversation TIENT :
 *
 *   • `In-Reply-To` et `References` — sans eux, chaque réponse ouvre une NOUVELLE conversation
 *     chez le destinataire. Trois échanges plus tard, personne ne retrouve le fil, et le
 *     destinataire a l'impression de parler à un système, pas à quelqu'un.
 *   • l'encodage des en-têtes non-ASCII — un objet contenant « à » ou « é » envoyé brut arrive
 *     illisible chez certains clients. On encode donc en `=?UTF-8?B?…?=` (RFC 2047).
 *
 * Module PUR : aucune dépendance, aucun réseau. C'est ce qui permet de vérifier au caractère près
 * ce qui sortira réellement.
 */

export interface MimeAttachment {
  filename: string;
  mimeType: string;
  /** Contenu binaire — encodé en base64 dans la partie MIME. */
  content: Buffer;
}

export interface MimeMessageInput {
  from: string;
  fromName?: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string | null;
  inReplyTo?: string | null;
  /** Chaîne `References` du message auquel on répond (on y ajoute son Message-ID). */
  references?: string | null;
  attachments?: MimeAttachment[];
}

/** Un en-tête non-ASCII s'encode (RFC 2047) ; un en-tête ASCII reste lisible tel quel. */
export function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** « Nom <adresse> » — le nom encodé si besoin, l'adresse jamais (elle est ASCII par nature). */
export function formatAddress(address: string, name?: string | null): string {
  const clean = address.trim();
  if (!name?.trim()) return clean;
  return `${encodeHeaderValue(name.trim())} <${clean}>`;
}

/**
 * Enlève ce qui n'a rien à faire dans un en-tête : retours à la ligne et retours chariot.
 *
 * Ce n'est pas de la cosmétique. Un objet contenant `\r\n` permettrait d'INJECTER des en-têtes
 * arbitraires — dont un `Bcc:` invisible vers un tiers. Le sujet d'un message peut venir d'un
 * courriel reçu (donc de l'extérieur) : on nettoie à la source.
 */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

const boundary = (tag: string): string => `----=_AMD_${tag}_${Math.random().toString(36).slice(2, 12)}`;

/** Le corps encodé en base64, découpé en lignes de 76 caractères (RFC 2045). */
function base64Lines(buf: Buffer): string {
  return (buf.toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

/**
 * Construit le message complet. La structure suit ce qu'il contient — on n'emballe pas un texte
 * simple dans trois niveaux de `multipart` « au cas où » : un message plus simple est un message
 * qui s'affiche correctement chez plus de monde.
 */
export function buildMimeMessage(input: MimeMessageInput): string {
  const lines: string[] = [];
  const push = (name: string, value: string | null | undefined) => {
    if (value) lines.push(`${name}: ${sanitizeHeader(value)}`);
  };

  push("From", formatAddress(input.from, input.fromName));
  push("To", input.to.map((a) => a.trim()).join(", "));
  if (input.cc?.length) push("Cc", input.cc.map((a) => a.trim()).join(", "));
  if (input.bcc?.length) push("Bcc", input.bcc.map((a) => a.trim()).join(", "));
  push("Subject", encodeHeaderValue(sanitizeHeader(input.subject)));
  push("In-Reply-To", input.inReplyTo);
  // `References` accumule TOUTE la chaîne : c'est elle que les clients suivent pour reconstituer
  // un fil de dix messages. On ajoute le message auquel on répond s'il n'y est pas déjà.
  if (input.references || input.inReplyTo) {
    const refs = [input.references ?? "", input.inReplyTo ?? ""]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);
    push("References", [...new Set(refs)].join(" "));
  }
  lines.push("MIME-Version: 1.0");

  const attachments = input.attachments ?? [];
  const hasHtml = Boolean(input.html?.trim());

  const bodyPart = (): string[] => {
    if (!hasHtml) {
      return [
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        base64Lines(Buffer.from(input.text, "utf8")),
      ];
    }
    const alt = boundary("ALT");
    return [
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      `--${alt}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(Buffer.from(input.text, "utf8")),
      "",
      `--${alt}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(Buffer.from(input.html ?? "", "utf8")),
      "",
      `--${alt}--`,
    ];
  };

  if (attachments.length === 0) {
    lines.push(...bodyPart());
    return lines.join("\r\n");
  }

  const mixed = boundary("MIX");
  lines.push(`Content-Type: multipart/mixed; boundary="${mixed}"`, "", `--${mixed}`);
  lines.push(...bodyPart());
  for (const a of attachments) {
    lines.push(
      "",
      `--${mixed}`,
      `Content-Type: ${sanitizeHeader(a.mimeType || "application/octet-stream")}; name="${sanitizeHeader(a.filename)}"`,
      `Content-Disposition: attachment; filename="${sanitizeHeader(a.filename)}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(a.content),
    );
  }
  lines.push("", `--${mixed}--`);
  return lines.join("\r\n");
}

/** Gmail attend le message en base64 « URL-safe », sans remplissage. */
export function toGmailRaw(mime: string): string {
  return Buffer.from(mime, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Décode une partie Gmail (base64 URL-safe) en texte. */
export function decodeGmailBody(data: string | undefined | null): string {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

/** « Nom <adresse> », « adresse » ou « <adresse> » → les deux morceaux, séparés. */
export function parseAddress(raw: string): { address: string; name: string | null } {
  const s = (raw ?? "").trim();
  const m = s.match(/^(.*?)<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].trim().replace(/^"(.*)"$/, "$1").trim();
    return { address: m[2].trim().toLowerCase(), name: name || null };
  }
  return { address: s.toLowerCase(), name: null };
}

/** Une liste d'adresses d'en-tête, séparées par des virgules (hors virgules d'un nom entre guillemets). */
export function parseAddressList(raw: string | null | undefined): { address: string; name: string | null }[] {
  if (!raw) return [];
  const out: { address: string; name: string | null }[] = [];
  let buf = "";
  let inQuotes = false;
  for (const ch of raw) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === "," && !inQuotes) {
      if (buf.trim()) out.push(parseAddress(buf));
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(parseAddress(buf));
  return out.filter((a) => a.address.includes("@"));
}
