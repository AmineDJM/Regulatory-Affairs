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
  // L'ordre est celui de la STABILITÉ décroissante : un identifiant ne change jamais, une
  // adresse rarement, un nom parfois. Le nom figure quand même — il vaut infiniment mieux qu'un
  // index, qui, lui, change à chaque relecture de la liste dans un ordre différent.
  for (const champ of ["id", "employeeId", "userId", "email", "reference", "key", "nom", "name", "fullName"]) {
    const v = lire(element, champ);
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return `i${index}`;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA TUYAUTERIE ENTRE ÉTAPES — `{{cle_etape.chemin}}`, résolue par le moteur, jamais par le modèle.
 *
 * ── LE DÉFAUT MESURÉ ─────────────────────────────────────────────────────────────────────
 *
 * Le schéma du planificateur promettait depuis toujours : « Sortie d'une étape :
 * {{cle_etape.chemin}} ». Le moteur, lui, ne résolvait que les alias d'éventail
 * (`{{salarie.nom}}`). Une clé d'étape contient un deux-points (`analyse:coherence`) que le
 * motif ci-dessus n'acceptait même pas : `{{analyse:coherence.actionPaiement}}` partait donc
 * TEL QUEL vers l'outil, en toutes lettres. Sur le banc m5, quatre plans sur neuf composaient
 * leurs étapes ainsi — et tous échouaient à l'exécution, après l'accord du dirigeant.
 *
 * ── LES RÈGLES ───────────────────────────────────────────────────────────────────────────
 *
 *   • La clé d'étape est reconnue par le PLUS LONG PRÉFIXE parmi les clés de la mission : une
 *     clé peut contenir des points, et « recherche:contrat.resultats.0.id » se lit
 *     « étape recherche:contrat, chemin resultats.0.id ». Les indices numériques sont permis —
 *     un indice n'est pas une expression.
 *   • On DIAGNOSTIQUE avant d'injecter. Un chemin absent sur une étape aboutie est une faute
 *     de plan : l'étape échoue en nommant les champs disponibles, et la replanification a de
 *     quoi corriger. Une liste amont VIDE n'est pas une faute : il n'y a rien à traiter, l'étape
 *     est ignorée. Une étape amont non aboutie n'a pas de valeur : c'est dit, pas inventé.
 *   • Le résultat d'un chemin inconnu reste `undefined`, jamais la chaîne « {{…}} » : la règle
 *     du haut du fichier vaut ici aussi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const MOTIF_REF = /\{\{\s*([A-Za-z0-9_][A-Za-z0-9_:\-.]*)\s*\}\}/g;
const SEUL_REF = /^\{\{\s*([A-Za-z0-9_][A-Za-z0-9_:\-.]*)\s*\}\}$/;

/** Toutes les références `{{…}}` d'une valeur, sans doublon, dans l'ordre de rencontre. */
export function referencesDe(valeur: unknown): string[] {
  const vues = new Set<string>();
  const visiter = (v: unknown): void => {
    if (typeof v === "string") {
      for (const m of v.matchAll(MOTIF_REF)) vues.add(m[1]);
    } else if (Array.isArray(v)) {
      v.forEach(visiter);
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(visiter);
    }
  };
  visiter(valeur);
  return [...vues];
}

/**
 * QUELLE ÉTAPE UNE RÉFÉRENCE DÉSIGNE-T-ELLE ? Le plus long préfixe qui est une clé connue,
 * suivi d'un point ou de rien. `null` quand aucune clé ne correspond.
 */
export function resoudreReference(ref: string, cles: Iterable<string>): { cle: string; chemin: string } | null {
  let meilleure: string | null = null;
  for (const cle of cles) {
    if (ref === cle || ref.startsWith(`${cle}.`)) {
      if (meilleure === null || cle.length > meilleure.length) meilleure = cle;
    }
  }
  if (meilleure === null) return null;
  return { cle: meilleure, chemin: ref.length > meilleure.length ? ref.slice(meilleure.length + 1) : "" };
}

export type EtatReference = "OK" | "ETAPE_INCONNUE" | "ETAPE_NON_ABOUTIE" | "CHEMIN_ABSENT" | "COLLECTION_VIDE";

export interface DiagnosticReference {
  ref: string;
  /** La clé d'étape reconnue — ou le premier segment quand aucune ne l'est. */
  etape: string;
  chemin: string;
  etat: EtatReference;
  /** Pour CHEMIN_ABSENT : ce que l'étape rend réellement à l'endroit où le chemin se perd. */
  disponibles: string[];
  /** Le statut de l'étape amont, pour le dire. */
  statut?: string;
}

export interface SortieAmont { status: string; result: unknown }

const cheminsDisponibles = (courant: unknown): string[] => {
  if (Array.isArray(courant)) return courant.length === 0 ? [] : [`0…${courant.length - 1}`];
  if (courant && typeof courant === "object") return Object.keys(courant as Record<string, unknown>).slice(0, 12);
  return [];
};

/**
 * DIAGNOSTIQUE chaque référence d'une valeur contre les sorties de la mission. Les alias
 * (`ignorer`) sont ceux d'un éventail non encore déployé : ils ne sont pas des étapes.
 */
export function diagnostiquerReferences(
  valeur: unknown,
  sorties: ReadonlyMap<string, SortieAmont>,
  ignorer: ReadonlySet<string> = new Set(),
): DiagnosticReference[] {
  const out: DiagnosticReference[] = [];
  for (const ref of referencesDe(valeur)) {
    const premier = ref.split(".")[0];
    if (ignorer.has(premier)) continue;
    const r = resoudreReference(ref, sorties.keys());
    if (!r) {
      out.push({ ref, etape: premier, chemin: "", etat: "ETAPE_INCONNUE", disponibles: [] });
      continue;
    }
    const amont = sorties.get(r.cle)!;
    if (amont.status !== "DONE") {
      out.push({ ref, etape: r.cle, chemin: r.chemin, etat: "ETAPE_NON_ABOUTIE", disponibles: [], statut: amont.status });
      continue;
    }
    if (r.chemin === "") {
      out.push({ ref, etape: r.cle, chemin: "", etat: "OK", disponibles: [] });
      continue;
    }
    let courant: unknown = amont.result;
    let etat: EtatReference = "OK";
    let disponibles: string[] = [];
    for (const segment of r.chemin.split(".")) {
      if (Array.isArray(courant) && /^\d+$/.test(segment)) {
        const i = Number(segment);
        if (i >= courant.length) {
          etat = "COLLECTION_VIDE";
          break;
        }
        courant = courant[i];
        continue;
      }
      if (courant === null || typeof courant !== "object" || !Object.prototype.hasOwnProperty.call(courant, segment)) {
        etat = "CHEMIN_ABSENT";
        disponibles = cheminsDisponibles(courant);
        break;
      }
      courant = (courant as Record<string, unknown>)[segment];
    }
    if (etat === "OK" && courant === undefined) {
      etat = "CHEMIN_ABSENT";
    }
    out.push({ ref, etape: r.cle, chemin: r.chemin, etat, disponibles });
  }
  return out;
}

/**
 * INJECTE LES SORTIES D'ÉTAPES dans une valeur — après diagnostic, jamais à sa place.
 * Une référence seule rend la valeur telle quelle (un nombre reste un nombre, une liste une
 * liste) ; dans un texte, elle devient du texte. Une référence irrésolue devient `undefined`
 * (seule) ou une chaîne vide (dans un texte).
 */
export function injecterSorties(valeur: unknown, sorties: ReadonlyMap<string, unknown>): unknown {
  const valeurDe = (ref: string): unknown => {
    const r = resoudreReference(ref, sorties.keys());
    if (!r) return undefined;
    const base = sorties.get(r.cle);
    return r.chemin === "" ? base : lire(base, r.chemin);
  };
  if (typeof valeur === "string") {
    const seul = SEUL_REF.exec(valeur);
    if (seul) return valeurDe(seul[1]);
    return valeur.replace(MOTIF_REF, (_brut, ref: string) => {
      const v = valeurDe(ref);
      if (v === undefined || v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    });
  }
  if (Array.isArray(valeur)) return valeur.map((v) => injecterSorties(v, sorties));
  if (valeur && typeof valeur === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) out[k] = injecterSorties(v, sorties);
    return out;
  }
  return valeur;
}
