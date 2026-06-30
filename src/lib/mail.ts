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
  cc: string;
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

/** Erreur IMAP transitoire (limite de connexions / coupure réseau) → on peut réessayer. */
function isTransientMailError(e: unknown): boolean {
  const m = String((e as Error)?.message ?? "").toLowerCase();
  return /command failed|timeout|timed out|econnreset|socket|closed|too many|connection limit|temporar|try again|unavailable|busy|throttl/.test(m);
}

/** Message d'erreur clair pour l'utilisateur (la plupart des soucis viennent du fournisseur). */
export function friendlyMailError(e: unknown): string {
  const msg = String((e as Error)?.message ?? "");
  const low = msg.toLowerCase();
  if (/too many|connection limit|maximum.*connection|throttl/.test(low))
    return "Trop de connexions simultanées vers la boîte mail (limite du fournisseur). Patientez quelques secondes puis réessayez.";
  if (/auth|login|invalid cred|password|denied/.test(low))
    return "Identifiants refusés par le serveur de messagerie. Vérifiez l'adresse et le mot de passe d'application Infomaniak.";
  if (/timeout|timed out|socket|econnreset|closed|connect/.test(low))
    return "Le serveur de messagerie n'a pas répondu à temps. Réessayez dans un instant.";
  if (/command failed/.test(low))
    return "La boîte mail a momentanément refusé la commande (souvent une limite de connexions côté fournisseur, ou l'adresse IP du serveur temporairement bloquée). Réessayez dans quelques secondes.";
  return msg || "Connexion à la boîte mail impossible.";
}

/** Catégorise une erreur IMAP en cause probable (pour le diagnostic admin). */
export type MailDiagCategory =
  | "OK" | "TOO_MANY_CONNECTIONS" | "AUTH_FAILED" | "IP_BLOCKED" | "TIMEOUT" | "COMMAND_FAILED" | "OTHER";

export interface MailDiagnostic {
  ok: boolean;
  category: MailDiagCategory;
  label: string;
  raw: string; // message d'erreur BRUT renvoyé par le serveur (Infomaniak)
  host: string;
  email: string;
}

const DIAG_LABEL: Record<MailDiagCategory, string> = {
  OK: "Connexion réussie — la boîte répond normalement.",
  TOO_MANY_CONNECTIONS: "Limite de connexions simultanées atteinte (throttling fournisseur). Se débloque seul ; réessayez dans quelques secondes.",
  AUTH_FAILED: "Identifiants refusés. Vérifiez l'adresse et le mot de passe d'application (2FA → mot de passe dédié).",
  IP_BLOCKED: "L'adresse IP du serveur semble bloquée par le fournisseur. Ouvrir un ticket Infomaniak pour la débloquer.",
  TIMEOUT: "Le serveur n'a pas répondu à temps (réseau / surcharge). Réessayez.",
  COMMAND_FAILED: "Commande refusée (« command failed ») — le plus souvent une limite de connexions, parfois une IP bloquée.",
  OTHER: "Erreur non catégorisée — voir le message brut ci-dessous.",
};

function classifyMailError(e: unknown): MailDiagCategory {
  const m = String((e as Error)?.message ?? "").toLowerCase();
  if (/too many|connection limit|maximum.*connection|throttl|rate/.test(m)) return "TOO_MANY_CONNECTIONS";
  if (/auth|login failed|invalid cred|password|denied|authenticationfailed|\[auth/.test(m)) return "AUTH_FAILED";
  if (/blocked|blacklist|spamhaus|banned|access denied|not allowed from|your ip/.test(m)) return "IP_BLOCKED";
  if (/timeout|timed out|econnreset|etimedout|socket|closed|connect|enotfound|ehostunreach/.test(m)) return "TIMEOUT";
  if (/command failed/.test(m)) return "COMMAND_FAILED";
  return "OTHER";
}

/**
 * Diagnostic : tente une connexion IMAP réelle et renvoie l'erreur BRUTE d'Infomaniak +
 * sa cause probable. N'effectue aucune action sur la boîte (juste connect + status + logout).
 */
export async function mailDiagnostic(account: { email: string; passwordEnc: string; imapHost: string; imapPort: number }): Promise<MailDiagnostic> {
  const base = { host: account.imapHost, email: account.email };
  // Sérialisé par compte (comme les autres opérations) pour ne pas créer une
  // connexion concurrente qui fausserait le diagnostic. Pas de réessai : on veut
  // l'erreur BRUTE telle quelle.
  return withAccountLock(account.email, async () => {
    const c = imapClient(account);
    try {
      await c.connect();
      await c.status("INBOX", { messages: true }).catch(() => undefined);
      await c.logout().catch(() => {});
      return { ok: true, category: "OK" as MailDiagCategory, label: DIAG_LABEL.OK, raw: "", ...base };
    } catch (e) {
      await c.logout().catch(() => {});
      const category = classifyMailError(e);
      return { ok: false, category, label: DIAG_LABEL[category], raw: String((e as Error)?.message ?? e ?? "erreur inconnue").slice(0, 600), ...base };
    }
  });
}

/**
 * Verrou **par compte** (clé = adresse e-mail) : Infomaniak limite le nombre de
 * connexions IMAP SIMULTANÉES par boîte. Comme le poller (toutes les 12 s) et les
 * actions utilisateur (lecture, envoi, pièce jointe…) peuvent viser la même boîte
 * en même temps, on sérialise : au plus UNE connexion IMAP par compte à la fois.
 * C'est la cause la plus fréquente des « command failed » / connexions refusées.
 */
const imapChains = new Map<string, Promise<unknown>>();
function withAccountLock<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const key = email.toLowerCase();
  const prev = imapChains.get(key) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  // On garde la chaîne vivante (sans propager l'erreur) pour sérialiser le suivant.
  const tail = run.catch(() => {});
  imapChains.set(key, tail);
  // Nettoyage : si personne ne s'est enchaîné derrière, on libère l'entrée.
  tail.then(() => { if (imapChains.get(key) === tail) imapChains.delete(key); });
  return run;
}

/**
 * Ouvre **une seule** connexion IMAP (sérialisée par compte), exécute `fn`, puis se
 * déconnecte — avec **réessai** en cas d'erreur transitoire (limite de connexions,
 * coupure). Toutes les opérations IMAP passent par ici pour ne jamais dépasser la
 * limite de connexions simultanées du fournisseur.
 */
function withImap<T>(
  account: { email: string; passwordEnc: string; imapHost: string; imapPort: number },
  fn: (c: ImapFlow) => Promise<T>,
  retries = 1,
): Promise<T> {
  return withAccountLock(account.email, async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const c = imapClient(account);
      try {
        await c.connect();
        return await fn(c);
      } catch (e) {
        lastErr = e;
        if (attempt < retries && isTransientMailError(e)) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw e;
      } finally {
        await c.logout().catch(() => {});
      }
    }
    throw lastErr;
  });
}

// Alias historique (mêmes garanties, désormais sérialisé par compte).
const withClient = withImap;

/** Teste la connexion IMAP (login). Renvoie null si OK, sinon un message d'erreur clair. */
export async function testImap(account: { email: string; passwordEnc: string; imapHost: string; imapPort: number }): Promise<string | null> {
  try {
    await withClient(account, async () => undefined);
    return null;
  } catch (e) {
    return friendlyMailError(e);
  }
}

async function readBoxes(c: ImapFlow): Promise<MailboxInfo[]> {
  const boxes = await c.list();
  const out: MailboxInfo[] = [];
  for (const b of boxes) {
    if (b.flags?.has("\\Noselect")) continue;
    let unseen = 0, total = 0;
    try { const st = await c.status(b.path, { unseen: true, messages: true }); unseen = st.unseen ?? 0; total = st.messages ?? 0; } catch { /* ignore */ }
    out.push({ path: b.path, name: b.name, role: b.specialUse?.replace("\\", "") ?? "", unseen, total });
  }
  return out;
}

async function readEnvelopes(c: ImapFlow, mailbox: string, limit: number, search?: string): Promise<MailEnvelope[]> {
  const lock = await c.getMailboxLock(mailbox);
  try {
    const status = await c.status(mailbox, { messages: true });
    const total = status.messages ?? 0;
    if (total === 0) return [];

    // Recherche : IMAP SEARCH sur expéditeur / destinataire / objet / corps (inclut
    // les correspondants externes). On garde les `limit` résultats les plus récents.
    let range: string;
    const q = search?.trim();
    if (q) {
      let uids: number[] = [];
      try {
        uids = (await c.search({ or: [{ from: q }, { to: q }, { cc: q }, { subject: q }, { body: q }] }, { uid: true })) || [];
      } catch { uids = []; }
      if (uids.length === 0) return [];
      const slice = uids.slice(-limit);
      range = slice.join(",");
    } else {
      range = `${Math.max(1, total - limit + 1)}:*`;
    }

    const out: MailEnvelope[] = [];
    for await (const msg of c.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: Boolean(q) })) {
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
}

export async function listMailboxes(account: MailAccount): Promise<MailboxInfo[]> {
  return withClient(account, readBoxes);
}

export async function listMessages(account: MailAccount, mailbox = "INBOX", limit = 30): Promise<MailEnvelope[]> {
  return withClient(account, (c) => readEnvelopes(c, mailbox, limit));
}

/** Charge la boîte (et éventuellement les dossiers) en **une seule** connexion IMAP. */
export async function loadInbox(
  account: MailAccount, mailbox = "INBOX", limit = 30, withFolders = false, search?: string,
): Promise<{ messages: MailEnvelope[]; mailboxes?: MailboxInfo[] }> {
  return withClient(account, async (c) => {
    const messages = await readEnvelopes(c, mailbox, limit, search);
    const mailboxes = withFolders ? await readBoxes(c) : undefined;
    return { messages, mailboxes };
  });
}

export async function getMessage(account: MailAccount, mailbox: string, uid: number): Promise<MailMessage | null> {
  return withClient(account, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const msg = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source as Buffer);
      const from = { label: parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "", addr: parsed.from?.value?.[0]?.address || "" };
      const toList = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
      const to = toList.flatMap((t) => t.value).map((v) => v.address).filter(Boolean).join(", ");
      const ccList = Array.isArray(parsed.cc) ? parsed.cc : parsed.cc ? [parsed.cc] : [];
      const cc = ccList.flatMap((t) => t.value).map((v) => v.address).filter(Boolean).join(", ");
      // Marque comme lu (best-effort).
      c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});
      return {
        uid,
        subject: parsed.subject || "(sans objet)",
        from: from.label, fromAddr: from.addr, to, cc,
        date: parsed.date?.toISOString() ?? null,
        html: parsed.html || null,
        text: parsed.text || null,
        attachments: (parsed.attachments ?? []).map((a, i) => ({ index: i, filename: a.filename || `piece-${i + 1}`, contentType: a.contentType || "application/octet-stream", size: a.size || 0 })),
      };
    } finally { lock.release(); }
  });
}

export async function getAttachment(account: MailAccount, mailbox: string, uid: number, index: number): Promise<{ filename: string; contentType: string; content: Buffer } | null> {
  return withImap(account, async (c) => {
    const lock = await c.getMailboxLock(mailbox);
    try {
      const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source as Buffer);
      const a = parsed.attachments?.[index];
      if (!a) return null;
      return { filename: a.filename || `piece-${index + 1}`, contentType: a.contentType || "application/octet-stream", content: a.content as Buffer };
    } finally { lock.release(); }
  });
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
  await withImap(account, async (c) => {
    const boxes = await c.list();
    const sent =
      boxes.find((b) => b.specialUse === "\\Sent") ||
      boxes.find((b) => /^(sent|sent items|sent messages|envoy)/i.test(b.name)) ||
      boxes.find((b) => /sent|envoy/i.test(b.path));
    if (sent) await c.append(sent.path, raw, ["\\Seen"]);
  });
}

/**
 * Contacts récents pour l'autocomplétion de l'adresse : expéditeurs récents (INBOX)
 * + destinataires récents (Envoyés). Dédupliqués par adresse, en minuscules.
 */
export async function listRecentContacts(account: MailAccount, limit = 80): Promise<{ name: string; address: string }[]> {
  return withImap(account, async (c) => {
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
  });
}
