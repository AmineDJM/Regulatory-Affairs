import type { MailAddress, MailMessage, MailDraftInput } from "./provider";
import { htmlToText } from "./sanitize";

/**
 * RÉPONDRE, RÉPONDRE À TOUS, TRANSFÉRER — les règles, pas l'écran.
 *
 * Ce sont trois gestes qu'on croit évidents jusqu'à ce qu'ils se trompent de destinataires. Deux
 * fautes classiques, et elles coûtent cher dans une entreprise :
 *   • **se ré-adresser à soi-même** en répondant à tous — on se noie dans ses propres réponses ;
 *   • **oublier le Cc** en répondant à tous — la moitié de la discussion perd le fil, et personne
 *     ne comprend pourquoi.
 *
 * Une réponse part vers `reply-to` s'il existe, sinon vers l'expéditeur : c'est l'en-tête que
 * posent les listes de diffusion et les boîtes partagées, et l'ignorer envoie la réponse à une
 * adresse qui ne lit rien.
 *
 * Module PUR — testé.
 */

const norm = (a: string) => a.trim().toLowerCase();

/** Dédoublonne en gardant le premier libellé rencontré, et retire `exclude`. */
export function dedupeAddresses(list: readonly MailAddress[], exclude: readonly string[] = []): MailAddress[] {
  const skip = new Set(exclude.map(norm));
  const seen = new Set<string>();
  const out: MailAddress[] = [];
  for (const a of list) {
    if (!a?.address) continue;
    const key = norm(a.address);
    if (!key || skip.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: a.name ?? null, address: a.address });
  }
  return out;
}

/** « Re: » / « Tr: » posés UNE fois — « Re: Re: Re: » est une signature d'outil mal fait. */
export function replySubject(subject: string): string {
  const s = (subject ?? "").trim();
  return /^(re|rép|rep)\s*:/i.test(s) ? s : `Re: ${s}`;
}
export function forwardSubject(subject: string): string {
  const s = (subject ?? "").trim();
  return /^(tr|fwd?|transf)\s*:/i.test(s) ? s : `Tr: ${s}`;
}

/** La citation du message d'origine, sous la réponse — en HTML déjà assaini en amont. */
export function quoteBlock(msg: Pick<MailMessage, "from" | "receivedAt" | "bodyHtml">): string {
  const who = msg.from ? `${msg.from.name ?? msg.from.address}` : "l'expéditeur";
  const when = msg.receivedAt ? new Date(msg.receivedAt).toLocaleString("fr-FR") : "";
  return [
    "<br><br>",
    `<p style="color:#6b7280;font-size:0.875rem">Le ${when}, ${who} a écrit :</p>`,
    '<blockquote style="margin:0 0 0 0.75rem;padding-left:0.75rem;border-left:2px solid #d1d5db">',
    msg.bodyHtml,
    "</blockquote>",
  ].join("");
}

export type ReplyMode = "reply" | "replyAll" | "forward";

/**
 * Le brouillon de départ d'une réponse ou d'un transfert.
 *
 * `me` est l'adresse de la personne : elle sert à ne jamais se remettre dans ses propres
 * destinataires. Un transfert part **sans destinataire** — c'est à l'humain de choisir, et
 * pré-remplir là serait le meilleur moyen d'envoyer un fil interne au mauvais correspondant.
 */
export function buildReplyDraft(msg: MailMessage, mode: ReplyMode, me: string, signatureHtml = ""): MailDraftInput {
  const replyTargets = msg.replyTo?.length ? msg.replyTo : (msg.from ? [msg.from] : []);

  if (mode === "forward") {
    return {
      to: [],
      subject: forwardSubject(msg.subject),
      bodyHtml: `${signatureHtml}${quoteBlock(msg)}`,
      inReplyTo: { messageId: msg.id, mode },
    };
  }

  const to = dedupeAddresses(replyTargets, [me]);
  const cc = mode === "replyAll"
    // Les destinataires du message d'origine deviennent le Cc, MOINS soi-même et moins ceux déjà
    // en « À » : figurer deux fois dans un même message est une erreur visible par tous.
    ? dedupeAddresses([...(msg.to ?? []), ...(msg.cc ?? [])], [me, ...to.map((a) => a.address)])
    : [];

  return {
    to: to.length > 0 ? to : dedupeAddresses(replyTargets), // répondre à soi-même reste possible si l'on est seul
    cc,
    subject: replySubject(msg.subject),
    bodyHtml: `${signatureHtml}${quoteBlock(msg)}`,
    inReplyTo: { messageId: msg.id, mode },
  };
}

/** Aperçu d'une ligne de liste, depuis le corps — quand le fournisseur n'en donne pas. */
export function previewOf(bodyHtml: string, max = 140): string {
  const t = htmlToText(bodyHtml).replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Une adresse écrite « Nom <adresse> », ou l'adresse seule. Pour l'affichage ET pour Graph. */
export function formatAddress(a: MailAddress): string {
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

/**
 * Lit une saisie libre de destinataires : virgules, points-virgules, retours ligne, et la forme
 * « Nom <adresse> ». Les entrées sans `@` sont écartées — mieux vaut ignorer une faute de frappe
 * que faire échouer tout l'envoi au dernier moment.
 */
export function parseAddressList(raw: string): MailAddress[] {
  const parts = (raw ?? "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const out: MailAddress[] = [];
  for (const p of parts) {
    const angled = /^(.*?)<([^>]+)>$/.exec(p);
    const address = (angled ? angled[2] : p).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) continue;
    const name = angled ? angled[1].trim().replace(/^["']|["']$/g, "") : "";
    out.push({ name: name || null, address });
  }
  return dedupeAddresses(out);
}
