import crypto from "crypto";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import type { MailAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Couche e-mail — **serveur uniquement** (jamais côté client). Connexion par
 * utilisateur à sa boîte Infomaniak : IMAP (lecture) + SMTP (envoi). Le mot de
 * passe d'application est chiffré au repos (AES-256-GCM) et n'est déchiffré qu'au
 * moment d'ouvrir une connexion. Aucune fuite vers le navigateur.
 */

// ───────────────────────────── Chiffrement du secret ─────────────────────────────

function masterKey(): Buffer {
  const s = process.env.MAIL_ENCRYPTION_KEY || process.env.DRIVE_ENCRYPTION_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-mail-key-change-me";
  return crypto.createHash("sha256").update(s).digest(); // 32 octets
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, enc] = blob.split(":").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", masterKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ───────────────────────────── Types ─────────────────────────────

export interface MailEnvelope {
  uid: number;
  subject: string;
  from: string;
  fromAddr: string;
  date: string | null;
  seen: boolean;
}
export interface MailAttachmentMeta { index: number; filename: string; contentType: string; size: number }
export interface MailMessage {
  uid: number;
  subject: string;
  from: string;
  fromAddr: string;
  to: string;
  date: string | null;
  html: string | null;
  text: string | null;
  attachments: MailAttachmentMeta[];
}
export interface MailboxInfo { path: string; name: string; role: string; unseen: number; total: number }

export async function getMailAccount(userId: string): Promise<MailAccount | null> {
  return prisma.mailAccount.findUnique({ where: { userId } });
}

// ───────────────────────────── IMAP (lecture) ─────────────────────────────

function imapClient(account: { email: string; passwordEnc: string; imapHost: string; imapPort: number }): ImapFlow {
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: true,
    auth: { user: account.email, pass: decryptSecret(account.passwordEnc) },
    logger: false,
    emitLogs: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}

const addrStr = (a?: { name?: string; address?: string }[] | null): { label: string; addr: string } => {
  const first = a?.[0];
  return { label: first?.name || first?.address || "", addr: first?.address || "" };
};

/** Teste la connexion IMAP (login). Renvoie null si OK, sinon un message d'erreur. */
export async function testImap(account: { email: string; passwordEnc: string; imapHost: string; imapPort: number }): Promise<string | null> {
  const c = imapClient(account);
  try {
    await c.connect();
    await c.logout();
    return null;
  } catch (e) {
    return (e as Error)?.message ?? "Connexion IMAP impossible.";
  }
}

export async function listMailboxes(account: MailAccount): Promise<MailboxInfo[]> {
  const c = imapClient(account);
  try {
    await c.connect();
    const boxes = await c.list();
    const out: MailboxInfo[] = [];
    for (const b of boxes) {
      if (b.flags?.has("\\Noselect")) continue;
      let unseen = 0, total = 0;
      try { const st = await c.status(b.path, { unseen: true, messages: true }); unseen = st.unseen ?? 0; total = st.messages ?? 0; } catch { /* ignore */ }
      out.push({ path: b.path, name: b.name, role: b.specialUse?.replace("\\", "") ?? "", unseen, total });
    }
    return out;
  } finally { await c.logout().catch(() => {}); }
}

export async function listMessages(account: MailAccount, mailbox = "INBOX", limit = 30): Promise<MailEnvelope[]> {
  const c = imapClient(account);
  try {
    await c.connect();
    const lock = await c.getMailboxLock(mailbox);
    try {
      const status = await c.status(mailbox, { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) return [];
      const start = Math.max(1, total - limit + 1);
      const out: MailEnvelope[] = [];
      for await (const msg of c.fetch(`${start}:*`, { uid: true, envelope: true, flags: true, internalDate: true })) {
        const f = addrStr(msg.envelope?.from);
        const d = msg.internalDate ?? msg.envelope?.date;
        out.push({
          uid: msg.uid,
          subject: msg.envelope?.subject || "(sans objet)",
          from: f.label, fromAddr: f.addr,
          date: d ? new Date(d).toISOString() : null,
          seen: msg.flags?.has("\\Seen") ?? false,
        });
      }
      return out.reverse(); // plus récents d'abord
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
}

export async function getMessage(account: MailAccount, mailbox: string, uid: number): Promise<MailMessage | null> {
  const c = imapClient(account);
  try {
    await c.connect();
    const lock = await c.getMailboxLock(mailbox);
    try {
      const msg = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source as Buffer);
      const from = { label: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "", addr: parsed.from?.value?.[0]?.address || "" };
      const toList = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
      const to = toList.flatMap((t) => t.value).map((v) => v.address).filter(Boolean).join(", ");
      // Marque comme lu (best-effort).
      c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});
      return {
        uid,
        subject: parsed.subject || "(sans objet)",
        from: from.label, fromAddr: from.addr, to,
        date: parsed.date?.toISOString() ?? null,
        html: parsed.html || null,
        text: parsed.text || null,
        attachments: (parsed.attachments ?? []).map((a, i) => ({ index: i, filename: a.filename || `piece-${i + 1}`, contentType: a.contentType || "application/octet-stream", size: a.size || 0 })),
      };
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
}

export async function getAttachment(account: MailAccount, mailbox: string, uid: number, index: number): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  const c = imapClient(account);
  try {
    await c.connect();
    const lock = await c.getMailboxLock(mailbox);
    try {
      const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source as Buffer);
      const a = parsed.attachments?.[index];
      if (!a) return null;
      return { filename: a.filename || `piece-${index + 1}`, contentType: a.contentType || "application/octet-stream", content: a.content as Buffer };
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
}

// ───────────────────────────── SMTP (envoi) ─────────────────────────────

export interface SendOptions { to: string; cc?: string; subject: string; text?: string; html?: string }

export async function sendMail(account: MailAccount, opts: SendOptions): Promise<void> {
  const mail = {
    from: account.displayName ? `"${account.displayName}" <${account.email}>` : account.email,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    text: opts.text || undefined,
    html: opts.html || undefined,
  };

  // 1) Construit le MIME UNE fois — pour envoyer ET archiver la même copie.
  const builder = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "windows" });
  const built = await builder.sendMail(mail);
  const raw = built.message as Buffer;

  // 2) Envoi SMTP du message construit.
  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.email, pass: decryptSecret(account.passwordEnc) },
  });
  await transport.sendMail({ envelope: built.envelope, raw });

  // 3) Copie dans « Envoyés » (best-effort) — sans ça, le message n'apparaît pas
  //    dans le dossier Envoyés (l'envoi SMTP seul ne l'y dépose pas).
  await appendToSent(account, raw).catch((e) => console.error("[mail] append to Sent failed", e));
}

/** Dépose une copie du message envoyé dans le dossier « Envoyés » de la boîte (IMAP APPEND). */
async function appendToSent(account: MailAccount, raw: Buffer): Promise<void> {
  const c = imapClient(account);
  try {
    await c.connect();
    const boxes = await c.list();
    const sent =
      boxes.find((b) => b.specialUse === "\\Sent") ||
      boxes.find((b) => /^(sent|sent items|sent messages|envoy)/i.test(b.name)) ||
      boxes.find((b) => /sent|envoy/i.test(b.path));
    if (sent) await c.append(sent.path, raw, ["\\Seen"]);
  } finally {
    await c.logout().catch(() => {});
  }
}

/**
 * Contacts récents pour l'autocomplétion de l'adresse : expéditeurs récents (INBOX)
 * + destinataires récents (Envoyés). Dédupliqués par adresse, en minuscules.
 */
export async function listRecentContacts(account: MailAccount, limit = 80): Promise<{ name: string; address: string }[]> {
  const c = imapClient(account);
  try {
    await c.connect();
    const seen = new Map<string, { name: string; address: string }>();
    const boxes = await c.list();
    const sent = boxes.find((b) => b.specialUse === "\\Sent");
    const sources: { path: string; field: "from" | "to" }[] = [{ path: "INBOX", field: "from" }];
    if (sent) sources.push({ path: sent.path, field: "to" });
    for (const src of sources) {
      try {
        const lock = await c.getMailboxLock(src.path);
        try {
          const status = await c.status(src.path, { messages: true });
          const total = status.messages ?? 0;
          if (!total) continue;
          const start = Math.max(1, total - limit + 1);
          for await (const msg of c.fetch(`${start}:*`, { envelope: true })) {
            const addrs = src.field === "from" ? msg.envelope?.from : msg.envelope?.to;
            for (const a of addrs ?? []) {
              const address = (a.address || "").toLowerCase().trim();
              if (!address || seen.has(address)) continue;
              seen.set(address, { name: a.name || "", address });
            }
          }
        } finally { lock.release(); }
      } catch { /* on ignore une source en erreur */ }
    }
    return [...seen.values()];
  } finally {
    await c.logout().catch(() => {});
  }
}
