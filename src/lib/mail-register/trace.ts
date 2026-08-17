import { MAIL_DIRECTION } from "@/lib/labels";

/**
 * CE QUI A CHANGÉ SUR UN COURRIER — la matière du journal.
 *
 * Le registre des courriers est une pièce qu'on oppose : « le pli est bien parti le 12, voici
 * l'accusé ». Le jour où quelqu'un corrige une date après coup, il faut pouvoir dire QUI a changé
 * QUOI, et par quoi. Un journal qui se contente de « courrier modifié » ne répond à aucune de ces
 * questions — c'est une trace décorative.
 *
 * Ce module ne fait que COMPARER : il ne lit ni la base, ni la session. D'où les tests.
 *
 * Deux pièges qu'il ferme, et qui sont la raison d'être du passage par une valeur canonique :
 *  - une date relue de la base est un `Date`, la même date ressaisie dans un formulaire est une
 *    chaîne ISO. Comparées telles quelles, elles diffèrent TOUJOURS — et le journal se remplirait
 *    de modifications qui n'ont pas eu lieu ;
 *  - `null`, `undefined` et `""` disent tous « vide ». Effacer un champ déjà vide n'est pas une
 *    modification.
 */

/** Les champs suivis, dans l'ordre où on les lit sur la fiche. Ce qui n'est pas ici n'est pas tracé. */
export const MAIL_TRACKED_FIELDS = {
  title: "Objet",
  reference: "N° de chrono",
  direction: "Sens",
  sender: "Expéditeur",
  recipient: "Destinataire",
  sentAt: "Départ",
  receivedAt: "Arrivée",
  acknowledgedAt: "Accusé de réception",
  carrier: "Porteur",
  notes: "Notes",
} as const;

export type MailField = keyof typeof MAIL_TRACKED_FIELDS;

export type MailTraceValue = string | Date | null | undefined;
export type MailSnapshot = Partial<Record<MailField, MailTraceValue>>;

export interface MailChange {
  field: MailField;
  /** Le libellé français du champ — ce qu'on lit dans le journal. */
  label: string;
  /** Valeurs canoniques : « » pour un champ vide. */
  before: string;
  after: string;
}

/** Une valeur au format ISO d'un instant — ce que `traceValue` produit pour une date. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * La forme CANONIQUE d'une valeur : celle qui sert à comparer, et celle qu'on écrit au journal.
 *
 * Une date devient l'instant ISO, quelle que soit la manière dont elle est arrivée (objet `Date`,
 * « 2026-08-17 », « 2026-08-17T14:30 »). Une chaîne est rognée. Le vide est la chaîne vide.
 */
export function traceValue(v: MailTraceValue): string {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString();
  const s = v.trim();
  if (!s) return "";
  // Seules les chaînes qui RESSEMBLENT à une date sont converties : « 2026 » est un numéro de
  // chrono parfaitement légitime, et le transformer en 1ᵉʳ janvier serait une falsification.
  if (/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return s;
}

/**
 * Les champs qui ont VRAIMENT changé, du plus haut de la fiche au plus bas.
 *
 * Seuls les champs déclarés dans `MAIL_TRACKED_FIELDS` sont regardés : ajouter une colonne au
 * modèle ne la met pas en silence dans le journal sans qu'on lui ait donné un libellé.
 */
export function diffMailEntry(before: MailSnapshot, after: MailSnapshot): MailChange[] {
  const changes: MailChange[] = [];
  for (const [field, label] of Object.entries(MAIL_TRACKED_FIELDS) as [MailField, string][]) {
    // Un champ ABSENT de la nouvelle version n'est pas une remise à vide : c'est une mise à jour
    // partielle qui ne parle pas de lui. On ne peut pas effacer par omission.
    if (!(field in after)) continue;
    const a = traceValue(before[field]);
    const b = traceValue(after[field]);
    if (a !== b) changes.push({ field, label, before: a, after: b });
  }
  return changes;
}

/** « Courrier « Relance CNAS » — Arrivée, Accusé de réception modifiés ». */
export function describeMailChanges(title: string, changes: MailChange[]): string {
  const head = `Courrier « ${title.trim() || "sans objet"} »`;
  if (changes.length === 0) return `${head} — aucune modification`;
  return `${head} — ${changes.map((c) => c.label).join(", ")} modifié${changes.length > 1 ? "s" : ""}`;
}

/**
 * La valeur canonique rendue LISIBLE pour l'affichage du journal.
 *
 * Le journal conserve la valeur canonique (un instant ISO reste un instant ISO, sans ambiguïté de
 * fuseau) ; c'est à la lecture qu'on la met en français. Un sens de courrier retrouve son libellé :
 * personne ne doit avoir à savoir ce que « OUTGOING » veut dire pour relire une correction.
 */
export function renderTraceValue(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "(vide)";
  if (MAIL_DIRECTION[s]) return MAIL_DIRECTION[s].label;
  if (ISO_INSTANT.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      // Minuit pile = une date saisie sans heure (arrivée, accusé) : afficher « 00:00 » laisserait
      // croire à une précision qu'on n'a pas.
      const midnight = d.getHours() === 0 && d.getMinutes() === 0;
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit", month: "short", year: "numeric",
        ...(midnight ? {} : { hour: "2-digit", minute: "2-digit" }),
      }).format(d);
    }
  }
  return s;
}
