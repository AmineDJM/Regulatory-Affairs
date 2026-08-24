/**
 * LE REJEU DE SESSION — rembobiner ce qu'une personne a fait, pour comprendre où ça a bugué.
 *
 * Le support reçoit « ça ne marche pas », sans page, sans heure, sans manipulation. On demande une
 * capture d'écran, elle arrive deux jours plus tard, floue, et le bug n'y est pas. Le rejeu répond
 * à la seule question utile : QU'EST-CE QUI S'EST PASSÉ, dans l'ordre, juste avant l'erreur.
 *
 * ⚠️ CE N'EST PAS UNE VIDÉO. Un navigateur ne peut pas filmer l'écran sans autorisation explicite
 * et sans indicateur visible — c'est une garantie du navigateur lui-même, pas un réglage. Ce qu'on
 * enregistre est la SUITE DES ACTIONS : pages ouvertes, éléments cliqués (leur libellé, pas leur
 * contenu), formulaires envoyés, erreurs rencontrées. C'est ce que font LogRocket ou FullStory, et
 * c'est amplement suffisant pour reproduire un bug.
 *
 * ⚠️ CE QUI N'EST JAMAIS CAPTURÉ — et c'est vérifié par des tests, pas par de la discipline :
 * la valeur d'un champ, un mot de passe, un montant, un numéro de compte, un contenu de message.
 * On sait QUE la personne a rempli « Montant », jamais COMBIEN elle a écrit.
 *
 * Module PUR — testé, sans navigateur ni base.
 */

/** Les natures d'événement. Volontairement peu nombreuses : un journal qu'on peut lire. */
export const EVENT_KINDS = ["PAGE", "CLICK", "INPUT", "SUBMIT", "ERROR", "NAV"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  PAGE: "Page ouverte",
  CLICK: "Clic",
  INPUT: "Saisie",
  SUBMIT: "Formulaire envoyé",
  ERROR: "Erreur",
  NAV: "Navigation",
};

export interface CapturedEvent {
  kind: EventKind;
  /** Millisecondes depuis le début de la session — un horodatage relatif se rejoue tel quel. */
  at: number;
  path: string;
  /** Le LIBELLÉ de l'élément (« Enregistrer », « Montant »), jamais sa valeur. */
  label: string | null;
  /** Détail technique : message d'erreur, code de statut. Jamais de contenu métier. */
  detail: string | null;
}

/**
 * LES CHAMPS DONT ON NE CAPTURE MÊME PAS LE LIBELLÉ D'INTERACTION.
 *
 * Savoir qu'une personne a tapé dans « mot de passe » est déjà une information de trop : la durée
 * de frappe et le nombre de corrections en disent long. Ces champs n'existent pas dans le journal.
 */
const FORBIDDEN_FIELD = /(mot\s*de\s*passe|password|passwd|secret|token|cvv|iban|rib|carte)/i;

/**
 * LES CHAMPS DONT ON GARDE LE LIBELLÉ MAIS JAMAIS LA VALEUR.
 *
 * Un montant, un salaire, un numéro : savoir que la personne a rempli « Montant » aide à
 * reproduire le bug ; savoir qu'elle a écrit 2 400 000 DZD ne sert à rien et expose une donnée
 * confidentielle à quiconque relit un journal de support.
 */
const SENSITIVE_LABEL = /(montant|salaire|prix|tarif|compte|nif|nis|num[ée]ro)/i;

/** Le type d'un champ de saisie qu'on n'enregistre jamais, quel que soit son libellé. */
const FORBIDDEN_INPUT_TYPE = new Set(["password", "hidden"]);

/**
 * Un champ peut-il apparaître, ne serait-ce que par son nom, dans le journal ?
 *
 * `false` = l'interaction est ignorée en entier. On ne journalise pas « a tapé dans mot de passe ».
 */
export function fieldIsRecordable(input: { label?: string | null; name?: string | null; type?: string | null }): boolean {
  if (input.type && FORBIDDEN_INPUT_TYPE.has(input.type.toLowerCase())) return false;
  const text = `${input.label ?? ""} ${input.name ?? ""}`;
  return !FORBIDDEN_FIELD.test(text);
}

/** Un libellé est-il « sensible » — à garder, mais dont la valeur ne doit jamais suivre ? */
export function isSensitiveLabel(label: string | null | undefined): boolean {
  return SENSITIVE_LABEL.test(label ?? "");
}

/**
 * Nettoie un libellé pour le journal : coupé court, sur une ligne, sans donnée qui traîne.
 *
 * La troncature n'est pas cosmétique : le texte d'un bouton peut contenir une référence de dossier
 * ou un nom de client, et un libellé de trois cents caractères est un contenu déguisé.
 */
export function cleanLabel(raw: string | null | undefined, max = 60): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * LE FILET DE SÉCURITÉ — retire d'un texte ce qui ressemble à une donnée sensible.
 *
 * Appliqué aux messages d'erreur, qui recopient volontiers la requête qui a échoué : une adresse
 * e-mail, un numéro long, un jeton. On ne fait pas confiance à la source, on nettoie à l'entrée.
 */
export function scrubDetail(raw: string | null | undefined, max = 200): string | null {
  let t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[adresse]");        // e-mails
  t = t.replace(/\b\d[\d\s-]{7,}\d\b/g, "[numéro]");               // numéros longs (RIB, tél, NIF)
  t = t.replace(/\b(?:eyJ|Bearer\s+)[\w.-]{10,}/gi, "[jeton]");    // JWT / en-têtes d'autorisation
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Construit un événement propre, ou `null` s'il ne doit pas être enregistré.
 *
 * C'est LA porte d'entrée : tout ce qui entre dans le journal passe par ici, et rien d'autre
 * n'écrit d'événement. Une règle de masquage ajoutée ici s'applique donc partout d'un coup.
 */
export function makeEvent(input: {
  kind: EventKind;
  at: number;
  path: string;
  label?: string | null;
  name?: string | null;
  type?: string | null;
  detail?: string | null;
}): CapturedEvent | null {
  if (!fieldIsRecordable(input)) return null;
  const path = (input.path ?? "").slice(0, 200);
  if (!path) return null;
  return {
    kind: input.kind,
    at: Math.max(0, Math.round(input.at)),
    path,
    label: cleanLabel(input.label),
    detail: scrubDetail(input.detail),
  };
}

/**
 * Les événements trop rapprochés et identiques, fondus en un seul.
 *
 * Taper vingt caractères produit vingt événements « Saisie » sur le même champ : illisible, et
 * inutile — ce qui compte est qu'elle a rempli ce champ, pas chaque touche. On garde le PREMIER
 * (l'instant où elle a commencé) et l'on jette les suivants d'un même champ dans la fenêtre.
 */
export function coalesce(events: readonly CapturedEvent[], windowMs = 2000): CapturedEvent[] {
  const out: CapturedEvent[] = [];
  for (const e of events) {
    const prev = out[out.length - 1];
    const same = prev && prev.kind === e.kind && prev.path === e.path && prev.label === e.label;
    if (same && e.at - prev.at < windowMs) continue;
    out.push(e);
  }
  return out;
}

/** La phrase qu'un technicien lit dans la chronologie. */
export function describeEvent(e: CapturedEvent): string {
  const what = EVENT_KIND_LABEL[e.kind];
  const where = e.label ? ` « ${e.label} »` : "";
  const why = e.detail ? ` — ${e.detail}` : "";
  return `${what}${where}${why}`;
}

/** L'horodatage relatif, lisible : « 1 min 12 s » plutôt que « 72000 ». */
export function stamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

/**
 * L'ERREUR LA PLUS PROCHE — ce qu'on cherche vraiment en ouvrant un rejeu.
 *
 * Rend l'index du premier événement d'erreur, pour placer le curseur dessus plutôt que de faire
 * dérouler toute la session. `-1` si la session s'est bien passée.
 */
export function firstErrorIndex(events: readonly CapturedEvent[]): number {
  return events.findIndex((e) => e.kind === "ERROR");
}
