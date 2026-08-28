/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UN RECOURS EST UNE ACTION CONCRÈTE, OU IL N'EST PAS.
 *
 * ── LA PANNE QUE CE FICHIER FERME ────────────────────────────────────────────────────────
 *
 * Le coordinateur rendait une INTENTION : « essaie la source LEGAL », « élargis ». Le moteur la
 * traduisait en écrivant `source: "LEGAL"` et `elargir: true` dans l'entrée de l'étape, et
 * rejouait. Une recherche à travers tout le dépôt a montré que ces deux champs ne sont lus par
 * AUCUNE capacité : le moteur les écrit, personne ne les relit. La capacité repartait donc avec
 * une entrée fonctionnellement identique et rendait le même résultat.
 *
 * Autrement dit, les deux premiers barreaux de six échelles sur neuf étaient des rejeux à
 * l'identique portant un nom de stratégie. Le journal affirmait une persévérance qui n'avait
 * pas lieu — exactement ce que le commentaire de `DECOUPER`, dans ce même module, interdit.
 *
 * ── LA RÈGLE QUI REMPLACE ────────────────────────────────────────────────────────────────
 *
 * Une décision de recours se termine par l'une de trois choses, et rien d'autre :
 *
 *   EXECUTABLE   une action dont on peut DIRE ce qu'elle change : une autre capacité, une
 *                requête transformée, un vrai rejeu technique ;
 *   NON_SUPPORTE le barreau ne peut rien changer ICI — il est sauté, sans consommer de
 *                tentative et sans écrire au journal ;
 *   BLOQUE       plus rien d'exécutable, et on dit ce qui a été tenté.
 *
 * ── CE FICHIER EST PUR ───────────────────────────────────────────────────────────────────
 *
 * Il ne connaît ni catalogue, ni base, ni droits. Les capacités de remplacement lui arrivent
 * par une fonction que l'appelant fournit ; l'élargissement, lui, est une transformation
 * déterministe d'une entrée, donc calculable ici et testable seule.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Entree = Record<string, unknown>;

/**
 * CE QUE LE MOTEUR VA RÉELLEMENT FAIRE. Chaque variante dit ce qu'elle CHANGE.
 */
export type ActionRecours =
  /** Un vrai rejeu technique : rien ne change, et c'est le propos (panne transitoire). */
  | { type: "REJEU"; ceQuiChange: "rien — incident technique, le même appel peut réussir" }
  /** Une AUTRE capacité, qui interroge un autre grenier. L'entrée est adaptée à son schéma. */
  | { type: "AUTRE_CAPACITE"; capability: string; input: Entree; ceQuiChange: string }
  /** La même capacité, avec une requête ou un périmètre objectivement plus larges. */
  | { type: "REQUETE_ELARGIE"; input: Entree; ceQuiChange: string };

/** Les champs qui portent une requête textuelle, tels que les schémas d'outils les nomment. */
export const CHAMPS_REQUETE = [
  "query", "q", "question", "requete", "recherche", "terme", "search", "name", "reference",
] as const;

/** Les champs qui bornent un nombre de résultats. */
const CHAMPS_LIMITE = ["limit", "limite", "max", "maxResults", "top"] as const;

/** Les champs qui bornent une fenêtre temporelle, en JOURS. */
const CHAMPS_FENETRE = ["sinceDays", "depuisJours", "days", "jours", "windowDays"] as const;

const texteDe = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/** Le champ de requête présent dans cette entrée, s'il y en a un. Ordre de préférence stable. */
export function champRequete(input: Entree): string | null {
  for (const c of CHAMPS_REQUETE) if (texteDe(input[c]) !== null) return c;
  return null;
}

/**
 * ÉLARGIR — une transformation DÉTERMINISTE, ou rien.
 *
 * ── LES TROIS ÉLARGISSEMENTS RÉELS, DANS CET ORDRE ───────────────────────────────────────
 *
 *   1. la REQUÊTE : « contrat cadre Pharmagene 2024 » devient « Pharmagene ». Retirer les mots
 *      qui restreignent est la façon dont un humain élargit une recherche, et c'est vérifiable :
 *      la chaîne envoyée n'est plus la même.
 *   2. la FENÊTRE : sept jours deviennent quatre-vingt-dix. Un document qu'on ne trouve pas
 *      cette semaine a souvent été déposé le mois dernier.
 *   3. la BORNE de résultats : vingt-cinq deviennent cent. La chose cherchée était peut-être
 *      la vingt-sixième.
 *
 * ── ET SI RIEN N'EST APPLICABLE, ON REND `null` ──────────────────────────────────────────
 *
 * C'est le cœur du fichier. Une entrée sans requête, sans fenêtre et sans borne ne PEUT pas
 * être élargie ; prétendre le contraire produirait le rejeu déguisé qu'on vient de supprimer.
 * `null` signifie « ce barreau ne s'applique pas ici », et l'échelle passe au suivant.
 */
export function elargirEntree(input: Entree): { input: Entree; ceQuiChange: string } | null {
  const sortie: Entree = { ...input };
  const changements: string[] = [];

  // 1. LA REQUÊTE — on garde le mot le plus distinctif, on retire les qualificatifs.
  const champ = champRequete(input);
  if (champ) {
    const brut = String(input[champ]).trim();
    const mots = brut.split(/\s+/).filter((m) => m.length > 0);
    if (mots.length > 1) {
      // Le mot le plus long est le plus discriminant dans la très grande majorité des cas —
      // « Pharmagene » plutôt que « contrat », « Zorbamyxine » plutôt que « molécule ». À
      // longueur égale on garde le premier, pour que la transformation soit reproductible.
      const garde = mots.reduce((a, b) => (b.length > a.length ? b : a), mots[0]);
      sortie[champ] = garde;
      changements.push(`requête « ${brut} » réduite à « ${garde} »`);
    }
  }

  // 2. LA FENÊTRE TEMPORELLE.
  for (const c of CHAMPS_FENETRE) {
    const v = input[c];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 365) {
      const large = Math.min(365, Math.max(90, v * 6));
      if (large !== v) {
        sortie[c] = large;
        changements.push(`fenêtre ${c} portée de ${v} à ${large} jours`);
      }
    }
  }

  // 3. LA BORNE DE RÉSULTATS.
  for (const c of CHAMPS_LIMITE) {
    const v = input[c];
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 500) {
      const large = Math.min(500, v * 4);
      if (large !== v) {
        sortie[c] = large;
        changements.push(`borne ${c} portée de ${v} à ${large}`);
      }
    }
  }

  if (changements.length === 0) return null;
  return { input: sortie, ceQuiChange: changements.join(" ; ") };
}

/**
 * DEUX ENTRÉES SONT-ELLES FONCTIONNELLEMENT IDENTIQUES ?
 *
 * L'invariant du lot : aucun `STEP_RECOVERY` ne peut être journalisé si l'appel suivant est le
 * même que le précédent. C'est la ceinture derrière les bretelles — même si un résolveur se
 * trompait et rendait une action sans effet, cette comparaison l'arrêterait avant l'écriture.
 *
 * La comparaison est faite sur du JSON à clés TRIÉES : `{a:1,b:2}` et `{b:2,a:1}` décrivent le
 * même appel, et les distinguer ferait passer un rejeu pour un changement.
 */
export function memeAppel(a: Entree, b: Entree): boolean {
  return stable(a) === stable(b);
}

function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Entree;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
}
