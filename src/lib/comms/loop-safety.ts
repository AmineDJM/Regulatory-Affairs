/**
 * LA SÛRETÉ DES BOUCLES — ce qui empêche un assistant d'écrire à l'infini.
 *
 * Aujourd'hui l'approbation du PDG borne naturellement le débit. Demain, en `AUTO_SEND`, plus
 * personne ne regarde chaque message : c'est là qu'une réponse automatique (« je suis en congé »)
 * peut relancer Adam, qui répond, qui relance l'auto-répondeur… Deux machines s'écrivent pendant
 * la nuit et l'entreprise le découvre dans les plaintes.
 *
 * Ces règles sont écrites MAINTENANT, pendant qu'elles sont faciles à raisonner, et elles
 * s'appliquent dès aujourd'hui : même sous approbation, un double envoi accidentel doit être
 * impossible.
 *
 * Module PUR — aucune base, aucun réseau : la logique se teste au cas près.
 */

/** En-têtes et motifs qui désignent une machine, pas une personne. */
export interface InboundHeaders {
  from?: string | null;
  subject?: string | null;
  /** En-têtes bruts utiles (minuscules) : `auto-submitted`, `precedence`, `list-id`… */
  headers?: Record<string, string | undefined>;
}

/**
 * Ce message vient-il d'une MACHINE ? (auto-répondeur, liste de diffusion, notification)
 *
 * On ne répond jamais à une machine : au mieux c'est inutile, au pire c'est une boucle. Les
 * signaux sont normalisés (RFC 3834 `Auto-Submitted`, `Precedence: bulk`, `List-Id`), plus les
 * formulations d'objet que les auto-répondeurs utilisent réellement en français et en anglais.
 */
export function isAutomatedSender(input: InboundHeaders): boolean {
  const h = input.headers ?? {};
  const auto = (h["auto-submitted"] ?? "").toLowerCase();
  if (auto && auto !== "no") return true;
  const precedence = (h["precedence"] ?? "").toLowerCase();
  if (["bulk", "list", "junk", "auto_reply"].includes(precedence)) return true;
  if (h["list-id"] || h["list-unsubscribe"] || h["x-autoreply"] || h["x-autorespond"]) return true;

  const from = (input.from ?? "").toLowerCase();
  if (/^(no[-_.]?reply|donotreply|ne[-_.]?pas[-_.]?repondre|mailer-daemon|postmaster|bounce)/.test(from.split("@")[0] ?? "")) {
    return true;
  }
  const subject = (input.subject ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/^(automatic reply|out of office|absence du bureau|reponse automatique|absent du bureau)/.test(subject)) return true;
  return false;
}

/** Un rejet de remise (NDR) — l'adresse n'existe pas, la boîte est pleine. */
export function isBounce(input: InboundHeaders): boolean {
  const from = (input.from ?? "").toLowerCase();
  if (from.startsWith("mailer-daemon@") || from.startsWith("postmaster@")) return true;
  const subject = (input.subject ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return /(undelivered mail|delivery status notification|mail delivery failed|echec de remise|message non remis)/.test(subject);
}

export interface RateWindowEntry {
  recipient: string;
  threadId: string | null;
  at: number;
}

export interface RateVerdict {
  allowed: boolean;
  /** Le motif du refus, formulé pour être MONTRÉ — jamais un code muet. */
  reason?: string;
}

export interface RateLimits {
  /** Messages au même destinataire par fenêtre. */
  perRecipient: number;
  /** Messages dans le même fil par fenêtre — une conversation qui s'emballe se voit ici. */
  perThread: number;
  /** Total tous destinataires confondus — le frein d'urgence. */
  global: number;
  windowMs: number;
}

/** Des bornes délibérément BASSES : Adam est un chef de cabinet, pas une plateforme d'emailing. */
export const DEFAULT_LIMITS: RateLimits = {
  perRecipient: 5,
  perThread: 3,
  global: 40,
  windowMs: 60 * 60_000,
};

/**
 * Peut-on envoyer CE message maintenant, au vu des envois RÉCENTS ?
 *
 * `recent` porte les envois déjà partis dans la fenêtre. La fonction ne connaît ni la base ni
 * l'horloge du serveur (`now` est injecté) : elle se teste en une ligne, et la même règle vaut
 * pour le chat, les missions et les tâches de fond.
 */
export function checkRateLimits(
  next: { recipients: string[]; threadId: string | null },
  recent: RateWindowEntry[],
  now: number,
  limits: RateLimits = DEFAULT_LIMITS,
): RateVerdict {
  const since = now - limits.windowMs;
  const inWindow = recent.filter((e) => e.at >= since);

  if (inWindow.length >= limits.global) {
    return { allowed: false, reason: `Frein d'urgence : ${inWindow.length} messages déjà envoyés dans l'heure. Envoi suspendu.` };
  }
  if (next.threadId) {
    const sameThread = inWindow.filter((e) => e.threadId === next.threadId).length;
    if (sameThread >= limits.perThread) {
      return { allowed: false, reason: `Cette conversation a déjà reçu ${sameThread} messages dans l'heure : une relance de plus ressemblerait à une boucle.` };
    }
  }
  for (const r of next.recipients.map((a) => a.trim().toLowerCase())) {
    const count = inWindow.filter((e) => e.recipient === r).length;
    if (count >= limits.perRecipient) {
      return { allowed: false, reason: `${r} a déjà reçu ${count} messages dans l'heure : envoi retenu.` };
    }
  }
  return { allowed: true };
}

/**
 * Faut-il RÉPONDRE à ce message entrant ?
 *
 * Séparé du débit à dessein : ici on parle de PERTINENCE (est-ce un interlocuteur humain ?),
 * là de VOLUME. Les deux doivent tomber juste pour qu'un message parte.
 */
export function shouldReplyTo(input: InboundHeaders): { reply: boolean; reason?: string } {
  if (isBounce(input)) return { reply: false, reason: "rejet de remise (NDR) — on ne répond pas à un serveur" };
  if (isAutomatedSender(input)) return { reply: false, reason: "expéditeur automatique (auto-répondeur, liste, notification)" };
  return { reply: true };
}
