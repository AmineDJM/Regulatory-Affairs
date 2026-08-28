import { lire } from "@/lib/missions/runtime/interpolate";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE L'ÉVENTAIL A TROUVÉ À LA PLACE DE SA LISTE — et pourquoi la question mérite un module.
 *
 * ── LA PANNE, TRACÉE DE BOUT EN BOUT SUR UN RUN RÉEL ─────────────────────────────────────
 *
 * Un scénario de recours a brûlé quatre planifications et 191 secondes de modèle sans jamais
 * atteindre un jugement. La chaîne complète tient en sept maillons, et chacun était correct
 * pris isolément :
 *
 *   1. `search_drive` ne trouve rien et le dit — en français : « Aucun fichier ni dossier ne
 *      contient « contrat » dans le Drive visible. » C'est le bon comportement en conversation.
 *   2. l'exécutant enveloppe cette phrase : `{ texte: "Aucun fichier…" }`. Il ne peut rien faire
 *      d'autre : ce n'est pas du JSON.
 *   3. l'étape est DONE, et elle le mérite : la recherche a tourné, elle a répondu.
 *   4. l'éventail demande `rechercher-contrats.resultats` — le chemin EXACT que la capacité
 *      documente. Il obtient `undefined`.
 *   5. le moteur écrit « il a trouvé undefined ».
 *   6. l'échelle de recours essaie six greniers, sur une étape qui ne lit pas son entrée.
 *   7. la replanification reçoit « il a trouvé undefined », n'en tire rien, et récrit une
 *      recherche. Deux fois.
 *
 * Le PLAN ÉTAIT JUSTE. Le chemin était juste. Ce qui manquait, c'est que personne ne savait dire
 * la différence entre « ton chemin est faux » et « il n'y avait rien à trouver, et la capacité
 * te l'a dit en toutes lettres ».
 *
 * ── CE QUE CE MODULE FAIT, ET CE QU'IL S'INTERDIT ────────────────────────────────────────
 *
 * Il REGARDE un résultat amont et NOMME ce qu'il y voit. Il ne cherche rien, n'appelle aucun
 * modèle, ne touche pas la base : c'est une fonction pure, donc testable seule et intégralement.
 *
 * Il s'autorise UNE réparation, et une seule : quand le chemin demandé est absent mais qu'il
 * existe dans le résultat EXACTEMENT UNE liste, c'est elle. Un candidat unique est une certitude ;
 * quatre candidats sont une ambiguïté, et une ambiguïté ne se tranche pas au premier venu. C'est
 * la même règle que partout ailleurs dans ce dépôt — et le test de contre-exemple la tient.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Jusqu'où l'on descend pour trouver une liste. `{ data: { rows: [] } }` est courant ; au-delà
 *  on entrerait dans les entrailles d'un résultat plutôt que dans sa forme. */
const PROFONDEUR = 2;

export type Collection =
  /** Le chemin demandé nomme bien une liste. Le cas normal. */
  | { kind: "LISTE"; valeur: unknown[] }
  /** Le chemin est absent, mais une SEULE liste existe : c'est elle, et on le dira. */
  | { kind: "CORRIGEE"; valeur: unknown[]; chemin: string }
  /** Le chemin existe et ne contient pas une liste. */
  | { kind: "MAUVAIS_TYPE"; type: string }
  /** L'amont a répondu en PROSE : il n'y a aucune structure à parcourir. */
  | { kind: "TEXTE"; extrait: string }
  /** Plusieurs listes candidates. On ne tranche pas. */
  | { kind: "AMBIGU"; chemins: string[] }
  /** Une structure, mais aucune liste nulle part. */
  | { kind: "ABSENTE"; cles: string[] }
  /** L'amont n'a rien produit du tout. */
  | { kind: "VIDE" };

/** Tous les chemins qui mènent à une liste, jusqu'à `PROFONDEUR`. Ordre stable. */
export function cheminsDeListes(v: unknown, prefixe = "", reste = PROFONDEUR): string[] {
  if (reste <= 0 || !v || typeof v !== "object" || Array.isArray(v)) return [];
  const out: string[] = [];
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const chemin = prefixe ? `${prefixe}.${k}` : k;
    if (Array.isArray(x)) out.push(chemin);
    else out.push(...cheminsDeListes(x, chemin, reste - 1));
  }
  return out;
}

/** Le nom du type, tel qu'on l'écrira à un humain — « une liste », « un nombre », « rien ». */
function typeLisible(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "une liste";
  switch (typeof v) {
    case "string": return "du texte";
    case "number": return "un nombre";
    case "boolean": return "un booléen";
    case "object": return "un objet";
    default: return "rien";
  }
}

/**
 * DIAGNOSTIQUE la collection d'un éventail.
 *
 * `amont` est le résultat brut de l'étape source, tel qu'il a été persisté.
 */
export function resoudreCollection(amont: unknown, chemin: string): Collection {
  if (amont === null || amont === undefined) return { kind: "VIDE" };

  const direct = lire(amont, chemin);
  if (Array.isArray(direct)) return { kind: "LISTE", valeur: direct };
  if (direct !== undefined) return { kind: "MAUVAIS_TYPE", type: typeLisible(direct) };

  // ── LE CHEMIN EST ABSENT. QU'Y A-T-IL À LA PLACE ? ─────────────────────────────────
  const listes = cheminsDeListes(amont);

  if (listes.length === 1) {
    const valeur = lire(amont, listes[0]);
    // La garde est redondante avec `cheminsDeListes` ; elle est là parce qu'un jour quelqu'un
    // changera l'une des deux fonctions et que le compilateur ne le verra pas.
    if (Array.isArray(valeur)) return { kind: "CORRIGEE", valeur, chemin: listes[0] };
  }
  if (listes.length > 1) return { kind: "AMBIGU", chemins: listes };

  /**
   * AUCUNE LISTE. DEUX CAS, ET LES CONFONDRE COÛTE CHER.
   *
   * `{ texte: "…" }` est ce que l'exécutant produit quand une capacité a répondu en prose — le
   * cas de très loin le plus fréquent, parce que c'est ainsi qu'une recherche dit « je n'ai rien
   * trouvé ». Le dire évite au plan suivant de refaire la même recherche.
   *
   * On ne conclut PAS pour autant « il n'y a rien » : la phrase est rendue telle quelle, et
   * c'est le planificateur ou l'humain qui la lit. Transformer un texte en liste vide
   * affirmerait une absence qu'on n'a pas vérifiée — la confusion exacte entre INCONNU et ZÉRO
   * que la doctrine interdit.
   */
  const cles = amont && typeof amont === "object" && !Array.isArray(amont)
    ? Object.keys(amont as Record<string, unknown>)
    : [];
  const texte = lire(amont, "texte");
  if (typeof texte === "string" && texte.trim() !== "") {
    return { kind: "TEXTE", extrait: texte.trim().slice(0, 300) };
  }
  return { kind: "ABSENTE", cles };
}

/**
 * LA PHRASE QUI PART DANS LE JOURNAL ET DANS LA REPLANIFICATION.
 *
 * Elle est rédigée pour un LECTEUR QUI DOIT DÉCIDER — un humain devant le fil, ou le
 * planificateur qui reçoit `refusPrecedent`. « il a trouvé undefined » ne fait décider personne :
 * c'est ce qui a conduit un run réel à replanifier deux fois la même recherche infructueuse.
 */
export function expliquer(c: Collection, from: string, chemin: string): string {
  switch (c.kind) {
    case "LISTE":
      return `« ${from}.${chemin} » contient ${c.valeur.length} élément(s).`;
    case "CORRIGEE":
      return `« ${from} » ne porte pas « ${chemin} », mais une seule liste : « ${c.chemin} » `
        + `(${c.valeur.length} élément(s)). C'est elle qui a été déployée.`;
    case "MAUVAIS_TYPE":
      return `« ${from}.${chemin} » existe mais contient ${c.type}, pas une liste.`;
    case "TEXTE":
      return `« ${from} » a répondu en texte, sans structure : « ${c.extrait} ». `
        + `Il n'y a donc aucune liste à déployer — inutile de refaire la même recherche.`;
    case "AMBIGU":
      return `« ${from} » ne porte pas « ${chemin} » et contient ${c.chemins.length} listes `
        + `(${c.chemins.join(", ")}). Laquelle déployer ne se devine pas : nomme-la.`;
    case "ABSENTE":
      return `« ${from} » ne contient aucune liste. Ses champs sont : `
        + `${c.cles.length > 0 ? c.cles.join(", ") : "aucun"}.`;
    case "VIDE":
      return `« ${from} » n'a produit aucun résultat.`;
  }
}
