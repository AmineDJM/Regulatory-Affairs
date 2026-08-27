/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * L'INJECTION D'UN ÉLÉMENT DANS UNE ENTRÉE D'ÉTAPE — délibérément pauvre.
 *
 * ── CE QUE ÇA FAIT ───────────────────────────────────────────────────────────────────────
 *
 * Le planner écrit UNE étape « envoie à {{employe.email}} », et déclare qu'elle se déploie sur
 * une collection. Le moteur la démultiplie et remplace, dans chaque copie, `{{employe.email}}`
 * par la valeur du salarié courant.
 *
 * ── POURQUOI PAS UN MOTEUR DE GABARIT ────────────────────────────────────────────────────
 *
 * Parce qu'un vrai moteur de gabarit sait faire des conditions, des boucles et parfois appeler
 * du code — et que ces entrées viennent en partie d'un modèle. Ce qui est accepté ici tient en
 * une ligne : un nom, des points, des lettres. Pas d'appel, pas d'index, pas d'expression.
 *
 * Le résultat d'un chemin inconnu est `undefined`, JAMAIS la chaîne « {{employe.email}} » :
 * envoyer un e-mail à une adresse littérale « {{employe.email}} » serait pire qu'échouer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MOTIF = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

/** Le mot exact `{{x.y}}` et rien d'autre — le cas où l'on remplace la VALEUR, pas le texte. */
const SEUL = /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}$/;

/**
 * LIT UN CHEMIN dans un objet — sans jamais traverser le prototype.
 *
 * `hasOwnProperty` n'est pas une précaution théorique : sans lui, `{{employe.constructor}}`
 * remonterait à des objets du langage, et un chemin fabriqué depuis une donnée non fiable
 * (§49 : un e-mail, un document) deviendrait un moyen d'exploration.
 */
export function lire(source: unknown, chemin: string): unknown {
  let courant: unknown = source;
  for (const segment of chemin.split(".")) {
    if (courant === null || typeof courant !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(courant, segment)) return undefined;
    courant = (courant as Record<string, unknown>)[segment];
  }
  return courant;
}

/**
 * REMPLACE LES RÉFÉRENCES DANS UNE VALEUR, quelle que soit sa profondeur.
 *
 * Le contexte est nommé (`{ employe: {...} }`) plutôt que plat : sans le préfixe, deux
 * expansions imbriquées écraseraient leurs champs de même nom, et l'on enverrait le message du
 * salarié au fournisseur sans que rien ne le signale.
 */
export function injecter(valeur: unknown, contexte: Record<string, unknown>): unknown {
  if (typeof valeur === "string") {
    const seul = SEUL.exec(valeur);
    // UN CHEMIN SEUL REND LA VALEUR TELLE QUELLE : un identifiant numérique reste un nombre,
    // une liste reste une liste. Les convertir en texte casserait les schémas d'entrée.
    if (seul) return lire(contexte, seul[1]);
    return valeur.replace(MOTIF, (brut, chemin: string) => {
      const v = lire(contexte, chemin);
      if (v === undefined || v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(valeur)) return valeur.map((v) => injecter(v, contexte));
  if (valeur && typeof valeur === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) out[k] = injecter(v, contexte);
    return out;
  }
  return valeur;
}

/** L'entrée d'une itération d'éventail. */
export function entreeIteration(
  modele: Record<string, unknown>,
  nom: string,
  element: unknown,
): Record<string, unknown> {
  return injecter(modele, { [nom]: element }) as Record<string, unknown>;
}

/**
 * L'IDENTITÉ STABLE D'UNE ITÉRATION — ce qui va après le `#` dans la clé de l'étape fille.
 *
 * ── POURQUOI PAS SIMPLEMENT L'INDICE ─────────────────────────────────────────────────────
 *
 * Parce qu'une liste de trente-trois salariés relue trois jours plus tard peut ne pas revenir
 * dans le même ordre. Avec un indice, l'étape « voeux#7 », déjà envoyée à Alla, désignerait
 * soudain Redouane — et le moteur, voyant l'étape terminée, croirait Redouane servi.
 *
 * On prend donc une identité PORTÉE PAR LA DONNÉE, et l'indice seulement en dernier recours.
 */
export function identiteIteration(element: unknown, index: number): string {
  if (element === null || typeof element !== "object") return String(element ?? index);
  for (const champ of ["id", "employeeId", "userId", "email", "reference", "key"]) {
    const v = lire(element, champ);
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return `i${index}`;
}
