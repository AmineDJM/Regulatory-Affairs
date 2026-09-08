/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * OÙ JOINDRE UNE PERSONNE — module PUR, au socle, sans aucun import.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ── LE DÉFAUT, LU DANS LE CODE ────────────────────────────────────────────────────────
 *
 * La porte d'attention savait envoyer un e-mail. Elle écrivait :
 *
 *     await sendMail(compte, { to: compte.email, … })
 *
 * — c'est-à-dire à la boîte de l'ERP elle-même. Adam s'écrivait à lui-même. La personne ne
 * voyait le message que si elle ouvrait CETTE boîte-là. Pendant ce temps, la préférence de
 * canal (`canalPrefere: "email:adresse"`) portait DÉJÀ une destination, lue par `lireCanal`
 * et transmise aux connecteurs Slack / Teams / WhatsApp — et jetée sur le seul chemin
 * e-mail. Le renseignement existait ; le seul canal qui en avait besoin l'ignorait.
 *
 * ── CE QUE CE MODULE FAIT ─────────────────────────────────────────────────────────────
 *
 * Il lit une DÉCLARATION de joignabilité — « email:a@x.dz,b@y.dz », une liste, un objet —
 * et rend les adresses valides, dédoublonnées, dans l'ordre déclaré. La PREMIÈRE est
 * l'adresse principale ; les suivantes sont en copie.
 *
 * Il ne devine jamais : ce qui n'est pas une adresse est écarté sans bruit, et une
 * déclaration vide rend une liste vide — l'appelant retombe alors sur son comportement
 * d'avant. Une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la semaine
 * (§118.16) ; une lecture qui invente une adresse écrit à un inconnu, ce qui est pire.
 *
 * ── LA PROPRIÉTÉ QUI REND CE CANAL SÛR ────────────────────────────────────────────────
 *
 * Ces adresses sont celles que la PERSONNE a déclarées pour elle-même. Elles ne désignent
 * jamais un tiers. C'est ce qui permet à Adam d'écrire à son propre demandeur sans
 * approbation : aucun tiers n'est contacté, rien n'est engagé au nom de la société, et la
 * personne l'a explicitement demandé. Un document lu par une étape ne peut pas rediriger ce
 * canal — il ne prend pas de destinataire en paramètre.
 */

/** Une adresse plausible, au sens strict : un seul « @ », un point dans le domaine, aucun espace. */
export function estUneAdresse(v: unknown): v is string {
  return typeof v === "string" && /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]{2,}$/.test(v.trim());
}

const CLES = ["destinataire", "adresse", "adresses", "email", "emails", "mail", "valeur", "to"] as const;

/** Découpe une déclaration texte : « email:a@x.dz, b@y.dz » → les deux adresses. */
function depuisTexte(brut: string): string[] {
  const sansPrefixe = brut.replace(/^\s*(e-?mail|courriel|mel|mail)\s*:/i, "");
  return sansPrefixe
    .split(/[,;\s]+/)
    .map((x) => x.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(estUneAdresse);
}

/**
 * LES ADRESSES OÙ JOINDRE LA PERSONNE, dans l'ordre déclaré, sans doublon.
 *
 * Liste VIDE quand rien de sûr ne s'y lit — jamais une adresse devinée.
 */
export function lireAdressesDeContact(valeur: unknown): string[] {
  const vues = new Set<string>();
  const out: string[] = [];
  const ajouter = (a: string) => {
    const k = a.toLowerCase();
    if (!vues.has(k)) { vues.add(k); out.push(k); }
  };

  const visiter = (v: unknown, profondeur: number): void => {
    if (profondeur > 3 || v === null || v === undefined) return;
    if (typeof v === "string") { for (const a of depuisTexte(v)) ajouter(a); return; }
    if (Array.isArray(v)) { for (const x of v) visiter(x, profondeur + 1); return; }
    if (typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    for (const c of CLES) if (c in o) visiter(o[c], profondeur + 1);
  };

  visiter(valeur, 0);
  return out;
}

/** L'adresse principale et les copies — la forme qu'attend un envoi. Toujours les deux clés (§118.20). */
export interface Joignabilite {
  /** `null` quand la personne n'a déclaré aucune adresse. */
  principale: string | null;
  /** Les autres adresses déclarées, dans l'ordre. Vide si une seule, ou aucune. */
  copies: string[];
}

export function joignabiliteDe(valeur: unknown): Joignabilite {
  const toutes = lireAdressesDeContact(valeur);
  return { principale: toutes[0] ?? null, copies: toutes.slice(1) };
}
