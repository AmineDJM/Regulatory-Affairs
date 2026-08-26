/**
 * CE QUI NE DOIT JAMAIS ARRIVER SOUS LES YEUX DU PDG.
 *
 * DEUX FUITES OBSERVÉES EN PRODUCTION, dans la même conversation.
 *
 * ── FUITE 1 : LES MARQUEURS INTERNES ────────────────────────────────────────────────────────
 *
 *   « (analyse terminée après l'appel) »
 *   « (restitution d'une analyse terminée) »
 *   « (intervention vocale) »
 *
 * Ces textes ne sont PAS des messages. Ce sont des bouche-trous : quand un tour vocal n'a pas de
 * moitié « utilisateur » — parce qu'Adam restitue spontanément un résultat, ou parce qu'un bruit
 * a déclenché un tour — la couche de PERSISTANCE doit tout de même écrire quelque chose dans la
 * colonne prévue. Le défaut n'est pas de les écrire : c'est que la couche d'AFFICHAGE les rend
 * tels quels, et que le PDG lit les notes de service de son assistant au milieu de la
 * conversation.
 *
 * ── FUITE 2 : LA SORTIE BRUTE D'UN OUTIL ────────────────────────────────────────────────────
 *
 * Le PDG a écrit « Bonsoir, ça va ? Tu vas bien ? ». Il a reçu vingt-sept résultats de recherche
 * en JSON — dont six lignes de SALAIRES nominatifs. Personne n'avait demandé à voir ça.
 *
 * Ce n'est pas seulement laid : c'est un problème de divulgation. Une sortie d'outil est une
 * matière de travail destinée au modèle, pas un contenu destiné à l'écran. Elle contient des
 * identifiants, des chemins, et parfois des données que l'utilisateur a le droit de consulter
 * mais qu'il n'a pas demandé à voir maintenant, dans cette conversation, en réponse à « bonsoir ».
 *
 * ── LE PRINCIPE ─────────────────────────────────────────────────────────────────────────────
 *
 * Ce module est une PASSOIRE D'AFFICHAGE, et il est délibérément placé à la toute fin de la
 * chaîne — juste avant le rendu. On ne corrige pas la persistance (les tours déjà écrits en base
 * contiennent ces chaînes ; les réécrire serait toucher à des données) ; on refuse de les
 * MONTRER. Filtrer à l'affichage protège aussi de la prochaine fuite du même genre, écrite par
 * quelqu'un d'autre, plus tard.
 *
 * Pur : ni base, ni réseau, ni React. Il tourne partout et se teste sans décor.
 */

/**
 * Les bouche-trous connus, mot pour mot. Ils sont listés EXPLICITEMENT plutôt que devinés par
 * une expression générique sur les parenthèses : une phrase du PDG peut légitimement commencer
 * par une parenthèse, et masquer un vrai message serait pire que d'en montrer un faux.
 */
export const INTERNAL_PLACEHOLDERS: readonly string[] = [
  "(analyse terminée après l'appel)",
  "(restitution d'une analyse terminée)",
  "(intervention vocale)",
  "(analyse terminée)",
  "(reprise après coupure)",
];

const normalize = (s: string): string =>
  (s ?? "").trim().replace(/\s+/g, " ").replace(/['’]/g, "'").toLowerCase();

const PLACEHOLDER_SET = new Set(INTERNAL_PLACEHOLDERS.map(normalize));

/** Ce texte est-il un bouche-trou de persistance plutôt qu'un message ? */
export function isInternalPlaceholder(text: string | null | undefined): boolean {
  const t = normalize(text ?? "");
  return t.length > 0 && PLACEHOLDER_SET.has(t);
}

/**
 * CETTE CHAÎNE EST-ELLE UNE SORTIE D'OUTIL ?
 *
 * On cherche la FORME, pas le contenu : un objet ou un tableau JSON qui se referme. C'est
 * volontairement strict — un message légitime peut citer un extrait de JSON dans une phrase, et
 * l'escamoter serait une régression. On ne masque que ce qui est ENTIÈREMENT une charge utile.
 */
export function looksLikeToolPayload(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (t.length < 2) return false;
  // C'est l'OUVERTURE qui décide qu'on regarde une charge utile, pas la fermeture. Un tour
  // interrompu en plein flux ne se referme jamais — et c'est précisément celui-là qui atterrit
  // à l'écran. Exiger la fermeture laissait passer le seul cas qui compte vraiment.
  if (!t.startsWith("{") && !t.startsWith("[")) return false;

  const closed = (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
  if (closed) {
    try {
      const parsed: unknown = JSON.parse(t);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      // Ouvert et fermé mais illisible : forme de charge utile quand même.
    }
  }
  // Tronqué : la présence d'au moins une clé JSON en tête suffit à trancher.
  return /"[a-zA-Z_][a-zA-Z0-9_]*"\s*:/.test(t.slice(0, 400));
}

/** Les noms d'outils et identifiants techniques qu'une phrase ne devrait jamais porter. */
const TOOL_MENTION = /\b(search_everything|inspect_record|gmail_[a-z_]+|gdrive_[a-z_]+|directory_[a-z_]+|read_[a-z_]+|list_[a-z_]+|executePowerTool|tool_use|tool_result)\b/g;
/** Les identifiants internes : cuid/uuid nus au milieu d'une phrase. */
const RAW_ID = /\b(c[a-z0-9]{24,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g;

export interface DisplayDecision {
  /** Faut-il afficher ce tour ? `false` = il disparaît entièrement de la conversation. */
  show: boolean;
  /** Le texte à afficher, une fois nettoyé. */
  text: string;
  /** Pourquoi il a été écarté ou nettoyé — pour le journal de débogage, jamais pour l'écran. */
  reason?: "placeholder" | "tool-payload" | "scrubbed";
}

/**
 * LA DÉCISION D'AFFICHAGE.
 *
 * Trois issues, dans cet ordre :
 *   1. bouche-trou   → on n'affiche RIEN. Le tour existe en base, il ne s'affiche pas.
 *   2. charge utile  → on n'affiche RIEN. Le modèle l'a lue ; le PDG n'a pas à la lire.
 *   3. sinon         → on affiche, débarrassé des noms d'outils et des identifiants nus.
 *
 * Le nettoyage du cas 3 est CONSERVATEUR : il retire des mentions techniques, il ne réécrit pas
 * la phrase. Un assistant dont on réécrit les mots finit par dire autre chose que ce qu'il a fait.
 */
export function decideDisplay(text: string | null | undefined): DisplayDecision {
  const raw = (text ?? "").trim();
  if (!raw) return { show: false, text: "", reason: "placeholder" };
  if (isInternalPlaceholder(raw)) return { show: false, text: "", reason: "placeholder" };
  if (looksLikeToolPayload(raw)) return { show: false, text: "", reason: "tool-payload" };

  const scrubbed = raw.replace(TOOL_MENTION, "").replace(RAW_ID, "").replace(/\s{2,}/g, " ").trim();
  if (scrubbed !== raw) return { show: scrubbed.length > 0, text: scrubbed, reason: "scrubbed" };
  return { show: true, text: raw };
}

/**
 * DEUX MESSAGES QUI SE CONTREDISENT, C'EST PIRE QU'UN SEUL QUI SE TAIT.
 *
 * Observé, à la suite, dans la même conversation :
 *
 *   « Aucun fichier ni dossier ne contient "Regulatory export" dans le Drive visible. »
 *   « La recherche du fichier Drive est toujours en cours. »
 *
 * Le second est un tour PÉRIMÉ, restitué après le premier — l'ordre d'arrivée l'emporte sur
 * l'ordre logique. Aucun humain ne dit « je n'ai rien trouvé » puis « je cherche encore » : le
 * PDG en conclut, à raison, qu'Adam ne sait pas où il en est.
 *
 * On ne peut pas réordonner ce qui est déjà dit ; on peut refuser de dire le périmé. Un tour
 * « je cherche encore » qui arrive APRÈS un tour conclusif sur le même sujet est supprimé.
 */
const STILL_WORKING = /\b(toujours en cours|encore en cours|je n'?ai pas encore le r[ée]sultat|recherche en cours|je cherche encore|d[èe]s que [çc]a revient)\b/i;
const CONCLUDED = /\b(aucun|aucune|rien|je n'?ai (rien|pas) trouv|voici|trouv[ée]|c'?est pr[êe]t|termin[ée])\b/i;

export function isStaleProgressUpdate(candidate: string, alreadySaid: string[]): boolean {
  if (!STILL_WORKING.test(candidate ?? "")) return false;
  // Une conclusion a-t-elle DÉJÀ été rendue ? On ne regarde que les tours récents : une
  // conclusion d'il y a dix minutes ne rend pas périmée une recherche relancée depuis.
  return alreadySaid.slice(-3).some((prev) => CONCLUDED.test(prev ?? ""));
}
