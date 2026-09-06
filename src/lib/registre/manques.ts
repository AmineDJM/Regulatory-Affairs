/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI MANQUE, NOMMÉ (mandat 6 §44) — pur.
 *
 * « Ça n'a pas marché » ne répare rien. « La capacité existe, la donnée existe, mais le format
 * du fichier n'est pas lisible sur ce serveur » se répare — et se chiffre : si ce manque revient
 * douze fois par mois, il a un prix, et ce prix décide de la feuille de route.
 *
 * Neuf natures de manque, et elles ne se confondent pas : une PERMISSION refusée est une décision
 * de sécurité qui a bien fonctionné, pas un défaut à corriger ; une CAPACITÉ ABSENTE est du code
 * à écrire ; une DONNÉE manquante est une saisie à faire. Les ranger ensemble sous « erreur »,
 * c'est exactement ce qui fait qu'une feuille de route ne sort jamais des incidents.
 *
 * LE JOURNAL EST CELUI QUI EXISTE. Un manque est un événement de mission (§17 : pas de second
 * registre) ; la feuille de route est une LECTURE de ces événements, jamais une table de plus qui
 * dirait la même chose et divergerait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const NATURES_MANQUE = [
  "SOURCE_INACCESSIBLE",
  "PERMISSION",
  "CAPACITE_ABSENTE",
  "MOTEUR_DE_CALCUL",
  "FORMAT_DE_FICHIER",
  "RENDU",
  "API_EXTERNE",
  "DONNEE_MANQUANTE",
  "ENTREE_HUMAINE",
  "MODELE",
  "INDETERMINE",
] as const;
export type NatureManque = (typeof NATURES_MANQUE)[number];

/** Ce que chaque nature veut dire, et ce qu'elle appelle comme suite. */
export const SENS_MANQUE: Readonly<Record<NatureManque, { libelle: string; suite: string; defaut: boolean }>> = {
  SOURCE_INACCESSIBLE: { libelle: "une source existe mais n'a pas répondu", suite: "vérifier la connexion, le compte, l'état du service", defaut: true },
  PERMISSION: { libelle: "un droit a manqué", suite: "ce n'est PAS un défaut : la sécurité a fonctionné. À corriger seulement si le droit était légitime", defaut: false },
  CAPACITE_ABSENTE: { libelle: "aucune capacité ne sait faire ça", suite: "du code à écrire — c'est la feuille de route technique", defaut: true },
  MOTEUR_DE_CALCUL: { libelle: "un calcul dépasse ce que les moteurs savent faire", suite: "étendre un moteur, ou dire la limite", defaut: true },
  FORMAT_DE_FICHIER: { libelle: "un format n'est ni lisible ni écrivable ici", suite: "ajouter le format, ou proposer la conversion la moins destructive", defaut: true },
  RENDU: { libelle: "aucune forme ne représente ce résultat", suite: "ajouter une forme au renderer", defaut: true },
  API_EXTERNE: { libelle: "un service tiers manque ou refuse", suite: "brancher le connecteur, renouveler la clé, ou dire l'indisponibilité", defaut: true },
  DONNEE_MANQUANTE: { libelle: "la donnée n'est pas dans l'ERP", suite: "une saisie à faire — pas du code", defaut: false },
  ENTREE_HUMAINE: { libelle: "une décision ou une pièce ne peut venir que d'une personne", suite: "demander, et attendre : c'est le fonctionnement normal", defaut: false },
  MODELE: { libelle: "le modèle a mal compris, mal planifié ou mal formé son appel", suite: "un eval à écrire, une description à préciser, un routage à corriger", defaut: true },
  INDETERMINE: { libelle: "la cause n'a pas pu être établie", suite: "à regarder à la main — un manque non classé est un manque invisible", defaut: true },
};

export interface Manque {
  nature: NatureManque;
  /** Ce qui manque, en clair et en français : « le format .xls », « la clé DocuSign ». */
  quoi: string;
  /** La capacité (ou l'étape) où le manque est apparu. */
  ou: string;
  /** Le message d'échec d'origine, tel quel — la preuve. */
  preuve: string;
  confiance: number;
  /** Ce que le code recommande de faire. */
  suite: string;
  /** Ce manque est-il une DETTE (du travail à faire) ou un fonctionnement normal ? */
  dette: boolean;
}

interface Regle { nature: NatureManque; re: RegExp; quoi?: (m: RegExpExecArray) => string }

/**
 * Les signatures d'échec, dans l'ordre où elles doivent être essayées : les plus SPÉCIFIQUES
 * d'abord. Une permission refusée ressemble à une source inaccessible si on lit trop vite.
 */
/**
 * ATTENTION AU `\b` FINAL. En JavaScript, « é » n'est pas un caractère de mot : il n'y a donc
 * AUCUNE frontière entre « capacité » et l'espace qui suit, et `/aucune capacit[ée]\b/` ne
 * matchait rien. Les alternatives qui se terminent par une lettre accentuée n'en portent pas.
 */
const REGLES: Regle[] = [
  // Les CODES du compilateur sont un vocabulaire d'échec réel, pas seulement des phrases : ils
  // arrivent tels quels dans les refus de plan et dans `errorKind`. Les ignorer rangeait
  // « FORBIDDEN_CAPABILITY read_finances » en INDETERMINE, donc en DETTE — alors qu'un droit
  // refusé est exactement le contraire d'une dette.
  { nature: "PERMISSION", re: /\b(droit|permission|non autoris|pas autoris|interdit|refus[ée] par la politique|hors de votre p[ée]rim|r[ée]serv[ée]|habilit|FORBIDDEN_CAPABILITY|MISSING_PERMISSION)/i },
  { nature: "ENTREE_HUMAINE", re: /\b(confirmation|approbation|accord|attente d'une personne|clic|valider|arbitrage|d[ée]cision humaine)\b/i },
  { nature: "FORMAT_DE_FICHIER", re: /\b(format|extension|\.xls\b|\.doc\b|\.ppt\b|parquet|non pris en charge|illisible|corrompu|prot[ée]g[ée])/i, quoi: (m) => `format : ${m[0]}` },
  { nature: "MOTEUR_DE_CALCUL", re: /\b(combinaisons|trop pour une [ée]num[ée]ration|hors de port[ée]e du calcul|limite d'it[ée]rations|non born[ée]|solveur|NP-difficile)/i },
  { nature: "RENDU", re: /\b(forme inconnue|type de graphique|repr[ée]sentation|renderer|colonne\(s\) introuvable\(s\)|aucune figure)\b/i },
  { nature: "API_EXTERNE", re: /\b(cl[ée] (API|OPENAI|ANTHROPIC)|non configur|quota|facturation|HTTP [45]\d\d|connecteur|non branch|webhook|signature invalide|token)\b/i },
  // « le compte Google n'est pas connecté » est le message REÉL du pont Google, mesuré sur le banc
  // §41 : la première version n'attrapait que « compte … non connecté » et le rangeait INDETERMINE.
  //
  // ── LE `\b` APRÈS `ECONN`, ET CE QU'IL A COÛTÉ ──────────────────────────────────────
  //
  // `\bECONN\b` ne rencontre JAMAIS `ECONNREFUSED` : la limite de mot exige un caractère non-mot
  // après « ECONN », et c'est un « R » qui suit. La panne de transport la plus banale — celle qui
  // arrive quand un mandataire redémarre — repartait donc en INDETERMINE, c'est-à-dire, une fois
  // traduite en cause, en « le modèle a mal compris ». Mesuré au banc d'autonomie du 2026-09-06 :
  // 98 missions sur 200 rangées au débit du PLANIFICATEUR alors que le fournisseur ne répondait
  // plus. Un classement faux est pire qu'une absence de classement, parce qu'il oriente la
  // feuille de route vers un défaut qui n'existe pas.
  //
  // Les signatures ajoutées sont celles RÉELLEMENT observées dans les journaux, pas une liste
  // théorique : `ECONNREFUSED`, `ECONNRESET`, `502 upstream request failed`, `fetch failed`,
  // `socket hang up`, `EAI_AGAIN`, `ETIMEDOUT`, `overloaded`.
  { nature: "SOURCE_INACCESSIBLE", re: /(?:\b(?:indisponible|injoignable|d[ée]lai d[ée]pass|timeout|r[ée]seau|service|suspendu|hors ligne|socket hang up|fetch failed|overloaded|upstream)|compte[^.]{0,40}(?:non|n'est pas|pas) connect|\b(?:ECONN|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE)\w*)/i },
  // AVANT « DONNÉE MANQUANTE », et l'ordre est le correctif : « champ obligatoire manquant » est
  // un appel MAL FORMÉ, pas une donnée absente de l'ERP. Le mot « manquant » est trop général
  // pour l'emporter sur une signature précise — et confondre les deux enverrait une faute de
  // modèle dans la colonne « une saisie à faire », où personne ne la corrigerait jamais.
  { nature: "MODELE", re: /\b(capacit[ée] inconnue|entr[ée]e invalide|INVALID_INPUT|UNKNOWN_CAPABILITY|WRONG_CARDINALITY|MALFORMED|INVALID_STEP|MISSING_DEPENDENCY|champ obligatoire|cardinalit|cycle de d[ée]pendance|cycle dans le plan|gabarit|mal form[ée]|sch[ée]ma)/i },
  { nature: "DONNEE_MANQUANTE", re: /\b(introuvable|aucun r[ée]sultat|aucune ligne|n'existe pas|vide|non renseign|manquant|aucun fait|aucune trace)\b/i },
  { nature: "CAPACITE_ABSENTE", re: /\b(aucun outil|pas d'outil|aucune capacit[ée]|pas pr[ée]vu|non impl[ée]ment|je ne peux pas)/i },
];

/**
 * CLASSE UN ÉCHEC. Rend `INDETERMINE` plutôt qu'une nature inventée : un manque mal rangé
 * pollue la feuille de route plus sûrement qu'un manque non rangé, qui se voit.
 */
export function classer(echec: string, contexte: { capacite?: string | null; etape?: string | null } = {}): Manque {
  const texte = String(echec ?? "").trim();
  const ou = contexte.capacite || contexte.etape || "(inconnue)";
  if (!texte) {
    return { nature: "INDETERMINE", quoi: "échec sans message", ou, preuve: "", confiance: 0, suite: SENS_MANQUE.INDETERMINE.suite, dette: true };
  }
  for (const r of REGLES) {
    const m = r.re.exec(texte);
    if (!m) continue;
    const sens = SENS_MANQUE[r.nature];
    return {
      nature: r.nature,
      quoi: r.quoi ? r.quoi(m) : `${sens.libelle} (« ${m[0]} »)`,
      ou, preuve: texte.slice(0, 400),
      // Une seule signature reconnue : c'est probable, pas certain. Le mot exact compte.
      confiance: texte.length > 20 ? 0.8 : 0.6,
      suite: sens.suite, dette: sens.defaut,
    };
  }
  return { nature: "INDETERMINE", quoi: texte.slice(0, 80), ou, preuve: texte.slice(0, 400), confiance: 0.2, suite: SENS_MANQUE.INDETERMINE.suite, dette: true };
}

/**
 * UN MANQUE DONT LA NATURE EST DÉJÀ CONNUE — sans passer par les signatures.
 *
 * `classer` sert quand on ne dispose que d'un message d'échec. Quand l'appelant SAIT ce qui
 * manque — le banc d'autonomie sait qu'un plan sans lecture est une faute de planification — le
 * faire passer par des expressions régulières ne peut que le ranger moins bien : « le plan ne
 * prévoit pas de lecture » ne ressemble à aucune signature, et revenait INDETERMINE.
 *
 * Un seul endroit continue de FABRIQUER un manque, et c'est ici : deux constructeurs finiraient
 * par porter deux jeux de champs.
 */
export function manqueConnu(nature: NatureManque, quoi: string, contexte: { capacite?: string | null; etape?: string | null; preuve?: string } = {}): Manque {
  const sens = SENS_MANQUE[nature];
  return {
    nature, quoi,
    ou: contexte.capacite || contexte.etape || "(inconnue)",
    preuve: (contexte.preuve ?? quoi).slice(0, 400),
    // Une nature ÉTABLIE par le code, pas devinée d'un texte : la confiance est pleine.
    confiance: 1,
    suite: sens.suite, dette: sens.defaut,
  };
}

export interface LigneFeuilleDeRoute {
  nature: NatureManque;
  quoi: string;
  occurrences: number;
  capacites: string[];
  /** Le premier et le dernier moment où ce manque a été vu. */
  depuis: string | null;
  jusqua: string | null;
  exemples: string[];
  suite: string;
  dette: boolean;
  /** Le rang : la fréquence, pondérée par le fait que ce soit une dette réparable. */
  priorite: number;
}

/**
 * LA FEUILLE DE ROUTE — une LECTURE des manques observés, groupée et classée par fréquence.
 * Ce qui n'est pas une dette (permission, entrée humaine, donnée à saisir) apparaît quand même,
 * mais SÉPARÉ : ce sont des faits d'exploitation, pas du code à écrire.
 */
export function feuilleDeRoute(manques: readonly (Manque & { quand?: Date | string | null })[]): {
  dette: LigneFeuilleDeRoute[];
  exploitation: LigneFeuilleDeRoute[];
  total: number;
  nonClasses: number;
} {
  const groupes = new Map<string, LigneFeuilleDeRoute & { instants: number[] }>();
  for (const m of manques) {
    // Le groupement se fait sur la NATURE et la CAPACITÉ : « le format .xls chez pdf_read » et
    // « le format .xls chez sheet_read » sont deux corrections différentes.
    const cle = `${m.nature}|${m.ou}`;
    const t = m.quand ? new Date(m.quand).getTime() : NaN;
    const existant = groupes.get(cle);
    if (existant) {
      existant.occurrences += 1;
      if (existant.exemples.length < 3 && !existant.exemples.includes(m.preuve.slice(0, 120))) existant.exemples.push(m.preuve.slice(0, 120));
      if (Number.isFinite(t)) existant.instants.push(t);
      continue;
    }
    groupes.set(cle, {
      nature: m.nature, quoi: m.quoi, occurrences: 1, capacites: [m.ou],
      depuis: null, jusqua: null, exemples: [m.preuve.slice(0, 120)],
      suite: m.suite, dette: m.dette, priorite: 0,
      instants: Number.isFinite(t) ? [t] : [],
    });
  }
  const lignes = [...groupes.values()].map((g) => {
    const { instants, ...reste } = g;
    return {
      ...reste,
      depuis: instants.length ? new Date(Math.min(...instants)).toISOString().slice(0, 10) : null,
      jusqua: instants.length ? new Date(Math.max(...instants)).toISOString().slice(0, 10) : null,
      // La priorité : la fréquence d'abord ; une capacité ABSENTE pèse plus qu'un service qui
      // a eu une panne, parce que la première ne se répare que par du code.
      priorite: g.occurrences * (g.nature === "CAPACITE_ABSENTE" ? 3 : g.nature === "MOTEUR_DE_CALCUL" || g.nature === "FORMAT_DE_FICHIER" || g.nature === "RENDU" ? 2 : 1),
    };
  });
  lignes.sort((a, b) => b.priorite - a.priorite || b.occurrences - a.occurrences);
  return {
    dette: lignes.filter((l) => l.dette),
    exploitation: lignes.filter((l) => !l.dette),
    total: manques.length,
    nonClasses: manques.filter((m) => m.nature === "INDETERMINE").length,
  };
}
