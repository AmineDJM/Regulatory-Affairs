/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UNE PERSONNE A RÉPONDU — lisible, au premier niveau, toujours les mêmes clés.
 *
 * ── LE DÉFAUT MESURÉ (§89, chaîne humaine live) ──────────────────────────────────────────
 *
 * Une attente réglée par un message enregistrait la comptabilité du MOTEUR :
 *
 *     { reveillePar: "MESSAGE_RECEIVED", payload: { body, text, from, subject, fromEmail,
 *       attachments, hasAttachments, attachmentNames }, attenteProgres: [0] }
 *
 * `attenteProgres` ne veut rien dire pour qui lit ; `payload` est un nom d'enveloppe ; `body`
 * et `text` disent deux fois la même phrase. L'étape de consolidation a reçu cet objet — avec
 * « Prix de cession Nivolex 84 500 DZD » dedans, vérifié dans `WorkerRun.input` — et a écrit
 * « prix de cession non fournis ». Les deux livrables ont été bâtis sur ce vide.
 *
 * On ne corrige pas cela en priant le modèle de mieux lire. On lui donne la parole de la
 * personne là où une parole se lit : au premier niveau, sous un nom français, à côté de qui
 * l'a dite. L'enveloppe reste — les références existantes `{{attente:X.payload.body}}` ne
 * cassent pas, et le journal garde la trace brute.
 *
 * ── TOUJOURS LES MÊMES CLÉS (§118.20) ────────────────────────────────────────────────────
 *
 * Ces trois champs sont présents MÊME quand rien n'est lisible — `contenu: ""`, `reponseDe:
 * null`, `pieces: []`. Une sortie dont la FORME dépend de la donnée n'est pas un contrat : le
 * planificateur écrit ses références avant de savoir ce que l'attente rendra, et une clé qui
 * apparaît une fois sur deux est un pari qu'il perd une fois sur deux. C'est la VALEUR qui dit
 * l'absence, jamais l'absence de la clé.
 *
 * ── UN DÉCODEUR NE DEVINE JAMAIS (§104.5) ────────────────────────────────────────────────
 *
 * Les noms de champs lus ici sont ceux que le routeur d'événements écrit réellement. Ce qu'on
 * ne reconnaît pas à coup sûr reste vide : mieux vaut un `contenu` vide, qui se voit, qu'une
 * phrase reconstituée à partir d'un champ qu'on a cru comprendre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface ReponseLisible {
  /** Qui a répondu, quand le fait le dit. `null` sinon — jamais une adresse faute de nom. */
  reponseDe: string | null;
  /** Ce que la personne a écrit. Chaîne vide quand le fait ne porte aucun texte. */
  contenu: string;
  /** Les pièces jointes annoncées, par leur nom. */
  pieces: string[];
}

const CHAMPS_TEXTE = ["body", "text", "contenu", "message", "content"] as const;
const CHAMPS_AUTEUR = ["from", "fromName", "expediteur", "auteur", "de"] as const;
const CHAMPS_PIECES = ["attachmentNames", "attachments", "pieces"] as const;

const chaine = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** LA PAROLE D'UNE PERSONNE, extraite d'un fait. Trois clés, toujours, quoi qu'il arrive. */
export function lireReponse(payload: unknown): ReponseLisible {
  const vide: ReponseLisible = { reponseDe: null, contenu: "", pieces: [] };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return vide;
  const o = payload as Record<string, unknown>;

  let contenu = "";
  for (const c of CHAMPS_TEXTE) {
    const v = chaine(o[c]);
    if (v.length > contenu.length) contenu = v;
  }
  // Le sujet ne REMPLACE pas le corps : il le précède, parce qu'il porte souvent le seul
  // rappel de ce qui était demandé. Un corps vide avec un sujet vaut mieux que rien.
  const sujet = chaine(o.subject ?? o.objet);
  if (sujet && !contenu.includes(sujet)) contenu = contenu ? `${sujet} — ${contenu}` : sujet;

  let reponseDe: string | null = null;
  for (const c of CHAMPS_AUTEUR) {
    const v = chaine(o[c]);
    if (v) { reponseDe = v; break; }
  }

  const pieces: string[] = [];
  for (const c of CHAMPS_PIECES) {
    const v = o[c];
    if (!Array.isArray(v)) continue;
    for (const x of v) { const n = chaine(x); if (n && !pieces.includes(n)) pieces.push(n); }
  }

  return { reponseDe, contenu, pieces };
}
