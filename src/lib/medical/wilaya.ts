import { ALGERIA_WILAYAS } from "@/lib/labels";

/**
 * RETROUVER LA WILAYA — dans une adresse, une ville, un nom d'hôpital.
 *
 * Un annuaire réel ne porte presque jamais une colonne « Wilaya » propre. Il porte « Adresse :
 * 12 rue Didouche Mourad, Alger », ou « CHU Bab El Oued », ou « 16000 ». La wilaya est là,
 * écrite, mais dans une autre colonne — et sans elle, l'annuaire ne se filtre ni ne se compte
 * par territoire, ce qui est justement ce qu'on lui demande.
 *
 * CE MODULE FAIT LE TRAVAIL SANS IA, et c'est délibéré : les 58 wilayas sont une liste fermée et
 * connue. Une reconnaissance déterministe est instantanée, gratuite, testable, et rend le MÊME
 * résultat sur le même fichier — trois propriétés qu'un appel de modèle n'a pas. L'IA n'a de
 * sens que sur ce qui RESTE : une commune qui ne porte pas le nom de sa wilaya (« Rouiba » →
 * Alger), et c'est l'appelant qui décide d'y recourir.
 *
 * Trois signaux, du plus sûr au moins sûr :
 *   1. le NOM de la wilaya, écrit tel quel (accents et casse indifférents) ;
 *   2. le CODE postal — ses deux premiers chiffres SONT le numéro de wilaya (16000 → Alger) ;
 *   3. le NUMÉRO seul, quand la colonne ne contient que ça (« 16 »).
 *
 * Module PUR — testé, sans base ni réseau.
 */

/** Sans accents, minuscules, ponctuation réduite — « Béjaïa » et « BEJAIA » deviennent un seul mot. */
export function foldText(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Le nom officiel indexé par sa forme repliée, et par son numéro administratif (1 → 58). */
const BY_FOLDED = new Map<string, string>();
const BY_CODE = new Map<number, string>();
ALGERIA_WILAYAS.forEach((name, i) => {
  BY_FOLDED.set(foldText(name), name);
  BY_CODE.set(i + 1, name);
});

/**
 * Quelques écritures courantes qui ne se replient pas sur le nom officiel.
 *
 * Volontairement COURTE : chaque entrée est une variante qu'on rencontre vraiment sur des
 * fichiers algériens, pas une tentative d'épuiser la toponymie. Ce qui manque relève de l'IA,
 * pas d'une liste qu'on allongerait indéfiniment sans jamais savoir si elle est complète.
 */
const ALIASES: Record<string, string> = {
  "alger centre": "Alger",
  "algiers": "Alger",
  "el djazair": "Alger",
  "bejaia": "Béjaïa",
  "bougie": "Béjaïa",
  "setif": "Sétif",
  "constantine ville": "Constantine",
  "oran ville": "Oran",
  "tizi ouzou ville": "Tizi Ouzou",
  "bordj bou arreridj": "Bordj Bou Arréridj",
  "bba": "Bordj Bou Arréridj",
  "msila": "M'Sila",
  "m sila": "M'Sila",
  "ain defla": "Aïn Defla",
  "ain temouchent": "Aïn Témouchent",
  "ghardaia": "Ghardaïa",
  "naama": "Naâma",
  "saida": "Saïda",
  "medea": "Médéa",
  "bechar": "Béchar",
  "boumerdes": "Boumerdès",
  "khenchla": "Khenchela",
  "sidi belabbes": "Sidi Bel Abbès",
  "sba": "Sidi Bel Abbès",
};

/**
 * La wilaya d'un CODE POSTAL algérien : ses deux premiers chiffres sont le numéro de wilaya.
 *
 * On exige un code postal ENTIER (cinq chiffres), et rien d'autre dans la cellule. Recoller les
 * chiffres d'une chaîne quelconque produirait des absurdités silencieuses : « Cité 1000
 * logements » donnerait la wilaya 10, et « Lot 5, 09000 » la wilaya 50. Une wilaya fausse est
 * pire qu'une wilaya vide — elle entre dans les comptages sans que personne ne la revérifie.
 */
export function wilayaFromPostalCode(raw: unknown): string | null {
  const t = String(raw ?? "").replace(/\s+/g, "");
  if (!/^\d{5}$/.test(t)) return null;
  return BY_CODE.get(Number(t.slice(0, 2))) ?? null;
}

/**
 * Le code postal caché DANS un texte libre — « Lot 5, 09000 Blida ».
 *
 * Le groupe doit être isolé : cinq chiffres, bornés. Sans cette borne, un numéro de téléphone ou
 * un « 1000 logements » serait lu comme un code postal.
 */
export function postalCodeInText(raw: unknown): string | null {
  const m = String(raw ?? "").match(/(?<!\d)(\d{5})(?!\d)/);
  return m ? m[1] : null;
}

/** La wilaya d'un numéro administratif seul (« 16 », « 06 »). */
export function wilayaFromCode(raw: unknown): string | null {
  const t = String(raw ?? "").trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  return BY_CODE.get(Number(t)) ?? null;
}

/**
 * La wilaya nommée quelque part dans un texte libre.
 *
 * On cherche la correspondance la PLUS LONGUE d'abord : sans cela, « Bordj Bou Arréridj »
 * pourrait être happé par une wilaya au nom plus court contenue dedans, et l'on rangerait
 * systématiquement ces fiches au mauvais endroit.
 */
export function wilayaInText(raw: unknown): string | null {
  const t = foldText(raw);
  if (!t) return null;
  const padded = ` ${t} `;

  const candidates: { folded: string; name: string }[] = [
    ...[...BY_FOLDED.entries()].map(([folded, name]) => ({ folded, name })),
    ...Object.entries(ALIASES).map(([folded, name]) => ({ folded, name })),
  ].sort((a, b) => b.folded.length - a.folded.length);

  for (const c of candidates) {
    if (c.folded && padded.includes(` ${c.folded} `)) return c.name;
  }
  return null;
}

/**
 * LA WILAYA D'UNE FICHE, à partir de tout ce qu'on a sous la main.
 *
 * L'ordre n'est pas décoratif : une colonne « Wilaya » explicite prime sur une déduction, et un
 * code postal prime sur un nom de ville — parce qu'une ville peut porter le nom d'une autre
 * wilaya (une rue « Alger » à Oran), alors qu'un code postal ne ment pas.
 *
 * Rend `null` plutôt que de deviner : une wilaya fausse est pire qu'une wilaya vide, puisqu'elle
 * entre dans les comptages sans que personne ne la revérifie.
 */
export function resolveWilaya(fields: {
  wilaya?: unknown;
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
  institution?: unknown;
}): string | null {
  const explicit = String(fields.wilaya ?? "").trim();
  if (explicit) {
    const exact = BY_FOLDED.get(foldText(explicit)) ?? ALIASES[foldText(explicit)];
    if (exact) return exact;
    const code = wilayaFromCode(explicit);
    if (code) return code;
    const named = wilayaInText(explicit);
    if (named) return named;
  }
  return (
    wilayaFromPostalCode(fields.postalCode) ??
    wilayaInText(fields.city) ??
    wilayaFromPostalCode(postalCodeInText(fields.address)) ??
    wilayaInText(fields.address) ??
    wilayaInText(fields.institution) ??
    null
  );
}

/** Le texte qu'on soumettra à l'IA pour les fiches que la reconnaissance n'a pas tranchées. */
export function unresolvedHint(fields: {
  city?: unknown; address?: unknown; institution?: unknown;
}): string {
  return [fields.city, fields.address, fields.institution]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/** Une réponse d'IA n'est acceptée que si elle nomme une wilaya RÉELLE. */
export function acceptAiWilaya(raw: unknown): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return BY_FOLDED.get(foldText(t)) ?? ALIASES[foldText(t)] ?? null;
}
