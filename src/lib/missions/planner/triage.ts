import { jetons } from "@/lib/missions/registry/resolve";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE TRIAGE — lire la demande AVANT de payer un modèle pour la lire.
 *
 * ── LA MESURE QUI A PRODUIT CE FICHIER ───────────────────────────────────────────────────
 *
 * Sur un run réel, la planification pesait 79 % du temps total d'une mission. Ce n'est pas une
 * anomalie à corriger par un réglage : c'est la conséquence d'une architecture qui envoie TOUTE
 * demande au même endroit, avec le même catalogue, le même schéma et le même budget — que la
 * demande soit « fais le point sur les tâches ouvertes » ou « prépare le dossier ANPP du
 * trimestre ». La première n'a pas besoin d'un plan ; elle a besoin d'une lecture.
 *
 * ── CE QUE CE FICHIER DÉCIDE, ET CE QU'IL NE DÉCIDE PAS ──────────────────────────────────
 *
 * Il rend un PROFIL et les signaux qui l'ont produit. Il ne choisit pas de modèle, il ne baisse
 * aucun effort de réflexion, il ne raccourcit aucun raisonnement : ce serait gagner du temps en
 * dégradant, et c'est exactement ce qu'on refuse. Ce qu'il règle, ce sont les BUDGETS — combien
 * de capacités on montre, sur combien de domaines, et quelle borne haute de réponse.
 *
 * ── LA RÈGLE QUI GOUVERNE TOUT LE FICHIER ────────────────────────────────────────────────
 *
 * En cas de doute, `MOYEN` — c'est-à-dire le comportement actuel, inchangé. Un triage qui se
 * trompe vers le haut ne coûte que ce qu'on payait déjà. Un triage qui se trompe vers le bas
 * cache une capacité au planificateur, et produit un plan qui ne peut pas aboutir. Les deux
 * erreurs ne se valent pas, donc les seuils ne sont pas symétriques.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const PROFILS = ["DIRECT", "SIMPLE", "MOYEN", "COMPLEXE"] as const;
export type Profil = (typeof PROFILS)[number];

/**
 * LES VERBES QUI TOUCHENT LE MONDE.
 *
 * Volontairement LARGE, et volontairement au-delà du strict nécessaire : « écris » figure ici
 * alors que « écris-moi un résumé » ne touche rien. Le faux positif coûte une planification
 * normale — celle qu'on faisait de toute façon. Le faux négatif enverrait un envoi d'e-mail sur
 * un chemin qui ne demande aucun accord. L'asymétrie décide.
 */
const VERBES_ECRITURE = [
  "envoie", "envoyer", "envoi", "ecris", "ecrire", "ecrivez", "redige", "rediger",
  "cree", "creer", "ajoute", "ajouter", "supprime", "supprimer", "efface", "effacer",
  "modifie", "modifier", "change", "changer", "corrige", "corriger", "mets", "mettre",
  "valide", "valider", "approuve", "approuver", "refuse", "refuser", "rejette",
  "assigne", "assigner", "affecte", "affecter", "attribue", "attribuer",
  "planifie", "planifier", "programme", "programmer", "relance", "relancer",
  "notifie", "notifier", "previens", "prevenir", "publie", "publier", "partage", "partager",
  "paie", "payer", "regle", "regler", "commande", "commander", "archive", "archiver",
  "importe", "importer", "exporte", "exporter", "genere", "generer", "prepare", "preparer",
  "contacte", "contacter", "demande", "demander", "transmets", "transmettre",
];

/** « à chacun », « tous les » : la marque d'une exécution qui se répète. */
const MARQUEURS_EVENTAIL = [
  "chaque", "chacun", "chacune", "tous les", "toutes les", "l ensemble des", "un par",
  "pour tous", "pour toutes", "chacun des", "chacune des",
];

/** Les marques d'un ARBITRAGE : la réponse ne se lit pas, elle se juge. */
const MARQUEURS_ARBITRAGE = [
  "lequel", "laquelle", "lesquels", "lesquelles", "pourquoi", "compare", "comparer",
  "comparaison", "arbitre", "arbitrer", "priorise", "prioriser", "recommande", "recommander",
  "conseille", "faut il", "dois je", "devrais je", "le mieux", "le meilleur", "la meilleure",
  "le plus urgent", "plus d attention", "risque", "impact", "consequence", "opportunite",
  "evalue", "evaluer", "analyse", "analyser", "explique", "expliquer", "tranche", "trancher",
];

/** Les marques d'un ENCHAÎNEMENT : plusieurs gestes, dans un ordre. */
const MARQUEURS_ENCHAINEMENT = [
  "puis", "ensuite", "apres quoi", "apres avoir", "une fois que", "une fois cela",
  "dans un second temps", "avant de", "avant d", "et enfin", "enfin", "d abord",
];

/** Les marques d'une recherche MULTI-SOURCES explicitement demandée. */
const MARQUEURS_MULTISOURCE = [
  "autres sources", "autre source", "si tu n y trouves", "si tu ne trouves",
  "commence par", "d ou vient", "sources consultees", "ailleurs",
];

/** Le texte réduit à ce qui se compare : sans accents, sans ponctuation, en minuscules. */
export function aplati(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * LA RECHERCHE SE FAIT SUR DES MOTS ENTIERS, ET C'EST UN CORRECTIF, PAS UN DÉTAIL.
 *
 * La première écriture cherchait le marqueur comme SOUS-CHAÎNE. « règle » — un verbe d'écriture,
 * au sens de payer — se trouvait alors dans « réglementaires », et « fais le point sur les
 * dossiers réglementaires » était classée comme une ÉCRITURE. Le profil restait sûr (MOYEN est
 * le repli), mais la RAISON affichée était fausse, et le chemin direct se fermait sur un motif
 * inventé. Un test l'a attrapé ; il est resté pour ça.
 *
 * `aplati` réduit déjà tout à des mots séparés par une espace unique, et l'appelant borde le
 * texte d'espaces : encadrer le marqueur suffit donc à exiger un mot entier — y compris pour les
 * marqueurs de plusieurs mots (« tous les »), qui sont des suites de mots entiers.
 */
const contient = (plat: string, marqueurs: readonly string[]): string[] =>
  marqueurs.filter((m) => plat.includes(` ${m} `));

export interface Triage {
  profil: Profil;
  /** Les signaux qui ont produit le profil — nommés, pour que la décision soit relisible. */
  raisons: string[];
  /** Un verbe qui touche le monde est présent. Interdit le chemin direct, à lui seul. */
  ecriture: boolean;
  /** « à chacun des salariés » : l'exécution se répétera. */
  eventail: boolean;
  /** La réponse demande un jugement, pas une lecture. */
  arbitrage: boolean;
  /** Plusieurs gestes, dans un ordre imposé. */
  enchainement: boolean;
  /** La demande impose elle-même d'explorer plusieurs greniers. */
  multisource: boolean;
  /** Le nombre de propositions — une virgule et un « et » séparent des demandes. */
  clauses: number;
  /** Les mots signifiants, après retrait des mots vides. Sert de mesure de longueur honnête. */
  motsUtiles: number;
}

/**
 * TRIE UNE DEMANDE — sans modèle, sans base, sans réseau.
 *
 * La fonction est PURE et le reste : c'est ce qui permet de la tester sur cent formulations en
 * une seconde, et c'est ce qui empêche qu'un jour elle « aille voir » quelque chose pour affiner
 * son verdict — auquel cas elle coûterait ce qu'elle est censée économiser.
 */
export function trier(demande: string): Triage {
  const plat = ` ${aplati(demande)} `;
  const motsUtiles = jetons(demande).length;

  const ecrits = contient(plat, VERBES_ECRITURE);
  const eventails = contient(plat, MARQUEURS_EVENTAIL);
  const arbitrages = contient(plat, MARQUEURS_ARBITRAGE);
  const enchainements = contient(plat, MARQUEURS_ENCHAINEMENT);
  const multisources = contient(plat, MARQUEURS_MULTISOURCE);

  // Les propositions : ce que séparent un point, un point-virgule, un deux-points ou une virgule
  // suivie d'un verbe. On compte GROSSIÈREMENT, à dessein — un compte fin de propositions
  // françaises serait un analyseur syntaxique, et il se tromperait avec assurance.
  const clauses = demande.split(/[.;:]|,\s*(?:et\s+)?(?=[a-zà-ÿ]+[e|s|z]\s)/u).filter((c) => c.trim().length > 3).length;

  const raisons: string[] = [];
  if (ecrits.length > 0) raisons.push(`écriture : « ${ecrits.slice(0, 3).join(" », « ")} »`);
  if (eventails.length > 0) raisons.push(`éventail : « ${eventails[0]} »`);
  if (arbitrages.length > 0) raisons.push(`arbitrage : « ${arbitrages.slice(0, 3).join(" », « ")} »`);
  if (enchainements.length > 0) raisons.push(`enchaînement : « ${enchainements[0]} »`);
  if (multisources.length > 0) raisons.push(`multi-sources : « ${multisources[0]} »`);

  const t = {
    ecriture: ecrits.length > 0,
    eventail: eventails.length > 0,
    arbitrage: arbitrages.length > 0,
    enchainement: enchainements.length > 0,
    multisource: multisources.length > 0,
    clauses,
    motsUtiles,
    raisons,
  };

  /**
   * ── LE CLASSEMENT, DU PLUS EXIGEANT AU MOINS ────────────────────────────────────────
   *
   * L'ordre des tests EST la règle métier, et il se lit de haut en bas : ce qui est complexe le
   * reste quoi qu'il arrive ensuite. Écrire ces conditions dans l'autre sens ferait qu'une
   * demande d'arbitrage courte passerait par « c'est court, donc c'est simple ».
   */
  if (t.multisource || (t.arbitrage && t.enchainement) || (t.ecriture && t.eventail) || clauses >= 4) {
    return { ...t, profil: "COMPLEXE", raisons: [...raisons, "profil COMPLEXE"] };
  }
  if (t.ecriture || t.eventail || t.enchainement || clauses >= 3) {
    return { ...t, profil: "MOYEN", raisons: [...raisons, "profil MOYEN"] };
  }
  if (t.arbitrage || clauses >= 2 || motsUtiles > 14) {
    return { ...t, profil: "SIMPLE", raisons: [...raisons, "profil SIMPLE"] };
  }
  return {
    ...t,
    profil: "DIRECT",
    raisons: [...raisons, "aucun signal d'écriture, d'éventail, d'enchaînement ni d'arbitrage"],
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES BUDGETS — ce qu'on règle, et ce qu'on ne règle SURTOUT pas.
 *
 * ── CE QU'ON NE RÈGLE PAS ────────────────────────────────────────────────────────────────
 *
 * Le rôle de modèle. Il reste celui que `rolePourPlanification` décide, sur la seule complexité,
 * et le triage ne l'effleure pas. Gagner du temps en envoyant une demande sur un cerveau moins
 * cher, c'est acheter de la latence avec de la qualité — un échange que ce lot refuse
 * explicitement.
 *
 * ── CE QU'ON RÈGLE, ET POURQUOI C'EST RÉEL ───────────────────────────────────────────────
 *
 * Le nombre de capacités montrées. Un run réel l'a chiffré : 28 capacités envoyées, 3 à 5
 * retenues dans le plan compilé. Les vingt-trois autres ne coûtent pas que des jetons d'entrée —
 * ce sont vingt-trois pistes qu'un modèle examine avant de les écarter, et cet examen est du
 * temps de réflexion sur le maillon le plus lent de la chaîne.
 *
 * `MOYEN` et `COMPLEXE` gardent EXACTEMENT les valeurs d'avant ce lot. Ce n'est pas de la
 * prudence : c'est ce qui rend la mesure avant/après lisible. Si l'on resserrait tout en même
 * temps, on ne saurait pas ce qui a produit l'écart.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface Budgets {
  /** Combien de capacités le planificateur voit. */
  limite: number;
  /** Sur combien de domaines le tourniquet tourne. */
  maxDomaines: number;
  /** Le plancher par domaine retenu — jamais réduit : c'est lui qui garde `directory_list`. */
  parDomaine: number;
  /** La borne haute de la réponse. Une SÉCURITÉ, pas un accélérateur : elle ne mord jamais. */
  maxOutputTokens: number;
}

export const BUDGETS: Record<Profil, Budgets> = {
  // Le profil DIRECT ne planifie pas. Ces valeurs servent au repli quand le chemin direct
  // renonce — et il renonce souvent, c'est sa fonction.
  DIRECT: { limite: 14, maxDomaines: 2, parDomaine: 3, maxOutputTokens: 4000 },
  SIMPLE: { limite: 14, maxDomaines: 2, parDomaine: 3, maxOutputTokens: 4000 },
  MOYEN: { limite: 28, maxDomaines: 5, parDomaine: 3, maxOutputTokens: 8000 },
  COMPLEXE: { limite: 28, maxDomaines: 5, parDomaine: 3, maxOutputTokens: 12_000 },
};

export const budgetsDe = (profil: Profil): Budgets => BUDGETS[profil];
