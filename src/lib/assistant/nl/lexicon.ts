/**
 * LE LEXIQUE — comment une phrase de PDG devient des jetons comparables.
 *
 * Tout ce fichier est PUR : aucune base, aucun réseau, aucun modèle. C'est ce qui permet de le
 * mesurer sur un corpus fixe et d'obtenir le même résultat à chaque exécution.
 *
 * Quatre idées, et elles se répondent :
 *
 *   1. On ne compare pas des MOTS, on compare des RADICAUX et des INTENTIONS. « assigner »,
 *      « assigne », « assignez » sont le même geste ; « dossier » et « dossiers » la même chose.
 *
 *   2. Le VERBE et l'OBJET ne jouent pas le même rôle. Le verbe dit ce qu'on fait, l'objet dit
 *      SUR QUOI. « crée » traverse tout l'ERP et n'identifie rien ; « enveloppe » désigne un
 *      seul bouton. C'est pourquoi ils sont extraits séparément.
 *
 *   3. Le français dit lui-même où est le verbe et où est le nom — encore faut-il l'écouter.
 *      Deux règles suffisent, et elles sont GÉNÉRALES, pas une liste de cas :
 *        · un mot précédé d'un DÉTERMINANT est un nom (« assigne cette **demande** ») ;
 *        · un radical verbal suivi d'une terminaison NON verbale est un nom
 *          (« établi » + « ssement » → « établissement », un lieu, pas un geste).
 *      Sans elles, « ajoute un établissement de santé » ne contenait aucun objet du tout.
 *
 *   4. La NÉGATION, la forme interrogative et la POSITION du verbe comptent autant que le reste.
 *      « restaure ce fichier supprimé » contient le mot « supprimé » sans rien demander de tel :
 *      le geste est porté par le PREMIER verbe, les suivants ne sont que des qualificatifs.
 */

// ───────────────────────────── Normalisation de surface ─────────────────────────────

/**
 * EXPRESSIONS SOUDÉES — appliquées sur le texte aplati, avant tout découpage.
 *
 * « rendez-vous » se découpe en « rendez » + « vous » : le premier ressemble au verbe « rendre »,
 * le second est un mot-outil. La phrase « annule ce rendez-vous » se retrouvait donc SANS objet,
 * et ne pouvait plus désigner aucun bouton. Une expression figée doit rester un seul jeton.
 */
const COMPOUNDS: [RegExp, string][] = [
  [/\brendez vous\b/g, "rendezvous"],
  [/\bmise a jour\b/g, "maj"],
  [/\bmises a jour\b/g, "maj"],
  [/\ben tete\b/g, "entete"],
  [/\ben tetes\b/g, "entete"],
  [/\bad pro\b/g, "adpro"],
  [/\bchiffre d affaires?\b/g, "ca"],
  [/\bappel d offres?\b/g, "ao"],
  [/\bappels d offres?\b/g, "ao"],
  [/\bbon de commande\b/g, "bc"],
  [/\bbons de commande\b/g, "bc"],
  [/\bmoyens generaux\b/g, "mg"],
  [/\bmoyen general\b/g, "mg"],
  [/\bressources humaines\b/g, "rh"],
  [/\bcaisse d avance\b/g, "caisse"],
  [/\bnote de frais\b/g, "notefrais"],
  [/\bnotes de frais\b/g, "notefrais"],
  [/\bcompte rendu\b/g, "compterendu"],
  [/\bfeuille de route\b/g, "feuilleroute"],
];

/** Accents, apostrophes (toutes leurs variantes typographiques), ponctuation, casse. */
export function flatten(text: string): string {
  let out = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'‘`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const [re, to] of COMPOUNDS) out = out.replace(re, to);
  return out;
}

/**
 * Les DÉTERMINANTS — la moitié de la désambiguïsation verbe/nom tient dans cette liste.
 *
 * En français, ce qui suit un déterminant est un nom. « la demande » est une chose ;
 * « demande à Amel » est un ordre. Le même mot, deux rôles, et un seul indice pour trancher —
 * mais il est fiable et il est syntaxique, pas lexical : il vaut pour les mots qu'on n'a pas
 * prévus autant que pour ceux qu'on a listés.
 */
const DETERMINERS = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux",
  "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes",
  "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur", "leurs",
  "quel", "quelle", "quels", "quelles", "chaque", "plusieurs", "certains",
  "tout", "tous", "toute", "toutes", "autre", "autres", "meme", "nouveau", "nouvelle", "nouvel",
]);

/**
 * Les mots-outils : articles, pronoms, auxiliaires, démonstratifs.
 *
 * Leur absence coûte cher. Mesuré : sans « cet », la phrase « modifie le département de CET
 * employé » partageait deux jetons avec l'alias « supprime CET employé » — assez pour proposer
 * une suppression définitive à qui demandait une modification.
 */
export const STOPWORDS = new Set([
  // articles & déterminants
  "de", "du", "des", "le", "la", "les", "un", "une", "au", "aux", "l", "d",
  "ce", "cet", "cette", "ces", "celui", "celle", "ceux", "celles",
  "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses", "notre", "nos", "votre", "vos",
  "leur", "leurs", "quel", "quelle", "quels", "quelles", "chaque",
  // pronoms
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "me", "te", "se", "moi", "toi", "lui", "eux", "y", "en", "qu", "ca", "cela", "ceci",
  // auxiliaires & liaisons
  "et", "ou", "ni", "mais", "donc", "or", "car", "que", "qui", "quoi", "dont",
  "est", "sont", "etre", "ete", "suis", "es", "sommes", "etes", "soit",
  "ai", "as", "avons", "avez", "ont", "avoir", "eu",
  "a", "pour", "par", "sur", "sous", "dans", "avec", "sans", "vers", "chez",
  "entre", "apres", "avant", "depuis", "pendant", "jusqu", "jusque",
  "plus", "moins", "tres", "trop", "bien", "aussi", "encore", "deja", "alors",
  "comme", "quand", "si", "tout", "tous", "toute", "toutes", "meme", "memes",
  "faut", "peut", "peux", "pouvez", "dois", "doit", "veux", "veut", "voudrais", "aimerais",
  "s", "t", "n", "c", "j", "m",
  // politesse & bruit conversationnel
  "oui", "non", "merci", "bonjour", "salut", "stp", "svp", "please",
  "adam", "assistant", "chief", "vite", "maintenant",
  // Le TEMPS est un argument, jamais un bouton. « Reporte le rappel à demain » et « prépare-moi
  // avant la réunion de demain » partagent le mot « demain » et rien d'autre : sans cette
  // classe fermée, le second allait chercher le premier.
  "aujourd", "hui", "demain", "hier", "veille", "lendemain", "matin", "soir", "midi", "nuit",
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
  "janvier", "fevrier", "mars", "avril", "juin", "juillet",
  "aout", "septembre", "octobre", "novembre", "decembre",
  "prochain", "prochaine", "dernier", "derniere", "suivant", "suivante",
  // Une QUANTITÉ n'est pas un sélecteur. Mesuré : « deux » n'apparaît que dans un alias de tout
  // le registre — sa rareté en faisait le mot le plus « informatif » de « supprime définitivement
  // ces DEUX dossiers », au point d'étouffer « définitivement » et de faire échouer la
  // suppression demandée. Les nombres comptent les objets ; ils ne les nomment pas.
  "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "quinze", "vingt", "trente", "cent", "mille", "demi",
  "premier", "premiere", "second", "seconde", "troisieme",
]);

/** Un nombre écrit en chiffres : une quantité ou une référence, jamais un bouton. */
const NUMERIC = /^\d+$/;

/**
 * VOCABULAIRE MÉTIER — les abréviations et équivalences que le PDG emploie sans y penser.
 *
 * « le BC de Kwality » ne contient pas le mot « commande ». Sans cette table, la demande ne
 * rejoint jamais le bouton « Nouveau bon de commande ». C'est du vocabulaire d'entreprise, pas
 * de la linguistique : il s'enrichit avec l'usage.
 *
 * L'expansion est ADDITIVE : le mot d'origine est conservé. Un synonyme ouvre une porte de
 * plus, il n'en ferme aucune — et il joue des DEUX côtés de la comparaison, sur la phrase du
 * PDG comme sur l'alias du registre, ce qui garantit qu'ils se rejoignent au même endroit.
 */
export const BUSINESS_SYNONYMS: Record<string, string[]> = {
  bc: ["bon", "commande"],
  ao: ["appel", "offre"],
  pj: ["piece", "jointe"],
  rh: ["ressource", "humaine", "employe"],
  mg: ["moyen", "general"],
  dg: ["direction"],
  pdg: ["direction"],
  ca: ["chiffre", "affaire"],
  tva: ["taxe"],
  reg: ["regulatory"],
  dci: ["molecule"],
  amm: ["autorisation", "marche"],
  ctd: ["dossier", "regulatory"],
  // « PCH » n'ouvre PAS « marché » : le mot est déjà dit quand il compte (« marché PCH »),
  // et l'ajouter attirait les « études de marché » du Business Development.
  pch: ["public"],
  im: ["information", "medicale"],
  dm: ["delegue", "medical"],
  adpro: ["adpro", "demande"],
  cds: ["chief"],
  // « mets à jour » est un VERBE, pas les deux mots « mise » et « jour » — qui, laissés comme
  // objets, rapprochaient « mets à jour le prix du produit » de « Modifier la fiche employé ».
  maj: ["actualise"],
  // Un rendez-vous vit dans l'AGENDA ; une réunion est un objet à part, avec son compte rendu
  // et ses participants. Les confondre faisait proposer « Supprimer la réunion » à qui disait
  // « annule ce rendez-vous » — un geste destructeur pour une simple annulation d'agenda.
  rdv: ["rendezvous", "agenda"],
  rendezvous: ["agenda"],
  entete: ["entete", "papier"],
  notefrais: ["note", "frais"],
  compterendu: ["compte", "rendu"],
  // Courrier électronique — quatre orthographes pour une seule chose.
  mail: ["courriel", "message"],
  mails: ["courriel", "message"],
  email: ["courriel", "message"],
  emails: ["courriel", "message"],
  courriel: ["mail", "message"],
  doc: ["document"],
  docs: ["document"],
  // Dans cet ERP, un « enregistrement » est la fiche générique d'un module — celle que la
  // corbeille restaure ou détruit.
  enregistrement: ["element", "fiche", "dossier"],
  enregistrements: ["element", "fiche", "dossier"],
  fichier: ["document"],
  fichiers: ["document"],
  // Personnes : dans cet ERP, un délégué / collaborateur / salarié EST une personne du fichier.
  delegue: ["personne", "employe"],
  delegues: ["personne", "employe"],
  collaborateur: ["personne", "employe"],
  salarie: ["personne", "employe"],
  employe: ["personne"],
  agent: ["personne", "employe"],
  manager: ["responsable", "hierarchique", "n1"],
  interimaire: ["remplacant"],
  medecin: ["docteur", "praticien"],
  praticien: ["medecin", "docteur"],
  hopital: ["etablissement", "sante"],
  clinique: ["etablissement", "sante"],
  sante: ["etablissement"],
  // Argent
  facture: ["facture"],
  // « bulletin » est un OBJET distinct de la paie (le document remis à l'employé) : le
  // confondre envoyait « ajoute une ligne de paie » vers le bulletin plutôt que vers la ligne.
  paie: ["salaire"],
  salaire: ["paie"],
  tresorerie: ["solde"],
  recharge: ["rallonge", "remise"],
  recharger: ["rallonge", "remise"],
  encaissement: ["recette"],
  decaissement: ["depense"],
  // Formes anglaises courantes dans la bouche d'un dirigeant algérien.
  meeting: ["reunion"],
  deadline: ["echeance"],
  report: ["rapport"],
  team: ["equipe"],
  update: ["actualise"],
  upload: ["televerse", "depose"],
  share: ["partage"],
  excel: ["tableur", "feuille", "xlsx"],
  word: ["document", "docx"],
  todo: ["tache"],
  task: ["tache"],
};

/**
 * RADICALISATION DES OBJETS — pluriels, féminins, dérivations courantes.
 *
 * On garde au moins quatre lettres : en dessous, on rabote des mots courts et on fabrique des
 * collisions (« date » et « data »). La justesse linguistique importe peu ; ce qui compte est que
 * « dossier » et « dossiers », « facture » et « factures » tombent sur le MÊME radical, des deux
 * côtés de la comparaison.
 */
const NOUN_SUFFIXES = ["ation", "atrice", "ateur", "euse", "eur", "ance", "ence"];

/**
 * Le PLURIEL se retire AVANT tout le reste, et il ne retire qu'une lettre.
 *
 * C'est une correction, pas un réglage. La liste des suffixes rabotait « gamme**s** » en
 * « gamm » — alors que « gamme » au singulier restait « gamme ». Les deux côtés de la même
 * comparaison s'écrivaient différemment, et « attribue une gamme à ce délégué » n'atteignait
 * jamais « Rattacher une personne à des gammes ». Un radical qui dépend du nombre n'est pas
 * un radical.
 */
export function stemNoun(word: string): string {
  if (word.length <= 4) return word;
  let w = word;
  // « généraux » → « général », « journaux » → « journal ».
  if (w.length >= 6 && w.endsWith("aux")) w = `${w.slice(0, -3)}al`;
  else if ((w.endsWith("s") || w.endsWith("x")) && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length <= 4) return w;
  for (const suf of NOUN_SUFFIXES) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) {
      return w.slice(0, w.length - suf.length);
    }
  }
  return w;
}

// ───────────────────────────── Intentions ─────────────────────────────

/**
 * CE QUE LE PDG VEUT FAIRE, indépendamment de ses mots.
 *
 * Le découpage n'est pas décoratif : c'est lui qui empêche « modifie » d'atteindre un bouton
 * « Supprimer », et « montre-moi » d'atteindre quoi que ce soit qui écrit.
 */
export type Intent =
  | "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE" | "RESTORE"
  | "ASSIGN" | "UNASSIGN" | "APPROVE" | "REJECT" | "SEND"
  | "MOVE" | "COPY" | "SHARE" | "UNSHARE" | "EXPORT" | "IMPORT"
  | "CANCEL" | "CONFIGURE" | "REQUEST" | "REMIND" | "READ";

/** Les intentions IRRÉVERSIBLES ou à effet lourd : elles ne s'approchent jamais par ressemblance. */
export const DESTRUCTIVE_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  "DELETE", "CANCEL", "UNASSIGN", "UNSHARE", "REJECT",
]);

/**
 * Les TERMINAISONS VERBALES du français.
 *
 * C'est la seconde règle de désambiguïsation, et la plus rentable. Un radical verbal suivi
 * d'autre chose qu'une terminaison verbale n'est pas un verbe : « établi**ssement** »,
 * « class**ement** », « modifi**cation** », « géné**ral** », « vidé**o** » sont des noms, même si
 * « établir », « classer », « modifier », « générer », « vider » sont des verbes.
 *
 * Sans cette règle, « ajoute un établissement de santé » ne contenait AUCUN objet : les deux
 * côtés de la comparaison avaient avalé le mot comme un verbe.
 */
const VERB_TAILS = new Set([
  "", "e", "es", "ent", "er", "ez", "ons", "ais", "ait", "aient", "iez", "ions",
  "a", "as", "ai", "at", "ames", "erent", "era", "eras", "erai", "erez", "eront", "erons",
  "erait", "eraient", "i", "is", "it", "ie", "ies", "ir", "issez", "issons", "issent", "issait",
  "ra", "rai", "ras", "rez", "ront", "rons", "re", "res", "r", "rs", "tre",
  "u", "us", "ue", "ues", "ant", "ants", "ee", "ees", "s", "t", "te", "tes", "le", "les", "d", "ds",
]);

/**
 * Les verbes, par RACINE. On compare par préfixe : « modifi » couvre modifie, modifier,
 * modifiez, modifié, modifiant — sans table d'inflexions à maintenir.
 *
 * Un verbe peut porter PLUSIEURS intentions : « retire » supprime une ligne ou dé-assigne une
 * personne. On garde l'ambiguïté ici et on la tranche au score, avec le contexte.
 */
const VERB_ROOTS: [string, Intent[]][] = [
  // Création
  ["cre", ["CREATE"]], ["nouveau", ["CREATE"]], ["nouvel", ["CREATE"]],
  ["ajout", ["CREATE"]], ["enregistr", ["CREATE"]], ["depos", ["CREATE"]],
  ["saisi", ["CREATE"]], ["etabli", ["CREATE"]], ["gener", ["CREATE"]],
  ["emett", ["CREATE"]], ["initi", ["CREATE"]], ["inscri", ["CREATE"]],
  ["redig", ["CREATE"]], ["prepar", ["CREATE"]], ["monte", ["CREATE"]],
  ["planifi", ["CREATE"]], ["organis", ["CREATE"]], ["programm", ["CREATE"]],
  ["cale", ["CREATE"]], ["ouvre", ["CREATE"]], ["ouvr", ["CREATE"]],
  ["televers", ["CREATE", "IMPORT"]], ["upload", ["CREATE", "IMPORT"]],
  // Modification
  ["modifi", ["UPDATE"]], ["chang", ["UPDATE"]], ["corrig", ["UPDATE"]],
  ["edit", ["UPDATE"]], ["ajust", ["UPDATE"]], ["complet", ["UPDATE"]],
  ["actualis", ["UPDATE"]], ["rafraichi", ["UPDATE"]], ["revis", ["UPDATE"]], ["renomm", ["UPDATE"]],
  ["rectifi", ["UPDATE"]], ["remplac", ["UPDATE"]], ["rends", ["UPDATE"]],
  ["rend", ["UPDATE"]], ["mets", ["UPDATE"]], ["met", ["UPDATE"]],
  ["passe", ["UPDATE"]], ["avanc", ["UPDATE"]], ["fait", ["UPDATE"]], ["fais", ["UPDATE"]],
  ["marqu", ["UPDATE"]], ["fixe", ["UPDATE"]], ["impute", ["UPDATE"]],
  ["imput", ["UPDATE"]], ["decal", ["UPDATE", "MOVE"]], ["saute", ["UPDATE"]],
  ["saut", ["UPDATE"]], ["recharg", ["UPDATE"]], ["rallong", ["UPDATE"]],
  // Suppression & réversibilité
  ["supprim", ["DELETE"]], ["efface", ["DELETE"]], ["detrui", ["DELETE"]],
  ["purg", ["DELETE"]], ["elimin", ["DELETE"]], ["vide", ["DELETE"]],
  ["archiv", ["ARCHIVE"]], ["class", ["ARCHIVE"]], ["corbeille", ["ARCHIVE"]],
  ["restaur", ["RESTORE"]], ["retabli", ["RESTORE"]], ["recuper", ["RESTORE"]],
  ["sors", ["RESTORE", "MOVE"]],
  // Attribution
  ["assign", ["ASSIGN"]], ["attribu", ["ASSIGN"]], ["confi", ["ASSIGN"]],
  ["affect", ["ASSIGN"]], ["rattach", ["ASSIGN"]], ["design", ["ASSIGN"]],
  ["nomm", ["ASSIGN"]], ["reassign", ["ASSIGN"]], ["invit", ["ASSIGN", "SEND"]],
  ["retir", ["UNASSIGN", "DELETE"]], ["enlev", ["UNASSIGN", "DELETE"]],
  ["detach", ["UNASSIGN"]], ["desassign", ["UNASSIGN"]],
  // Décision
  ["valid", ["APPROVE"]], ["approuv", ["APPROVE"]], ["accept", ["APPROVE"]],
  ["autoris", ["APPROVE"]], ["confirm", ["APPROVE"]], ["accord", ["APPROVE"]],
  ["tranch", ["APPROVE", "REJECT"]], ["decid", ["APPROVE", "REJECT"]],
  ["refus", ["REJECT"]], ["rejet", ["REJECT"]], ["declin", ["REJECT"]],
  // Communication
  ["envoi", ["SEND"]], ["envoy", ["SEND"]], ["transmet", ["SEND"]],
  ["expedi", ["SEND"]], ["adress", ["SEND"]], ["communiqu", ["SEND"]],
  ["relanc", ["SEND", "REQUEST"]], ["repond", ["SEND"]], ["ecris", ["SEND", "CREATE"]],
  // Fichiers
  ["deplac", ["MOVE"]], ["boug", ["MOVE"]], ["range", ["MOVE"]],
  ["copi", ["COPY"]], ["dupliqu", ["COPY"]],
  ["partag", ["SHARE"]], ["departag", ["UNSHARE"]],
  ["export", ["EXPORT"]], ["import", ["IMPORT"]],
  // Cycle de vie & réglage
  ["annul", ["CANCEL"]], ["resili", ["CANCEL"]], ["interromp", ["CANCEL"]],
  ["abandonn", ["CANCEL"]],
  ["configur", ["CONFIGURE"]], ["parametr", ["CONFIGURE"]], ["regl", ["CONFIGURE"]],
  ["activ", ["CONFIGURE"]], ["desactiv", ["CONFIGURE"]], ["suspend", ["CONFIGURE"]],
  ["demand", ["REQUEST"]], ["sollicit", ["REQUEST"]], ["reclam", ["REQUEST"]],
  ["rappel", ["REMIND"]],
  // Lecture — jamais une écriture
  ["voir", ["READ"]], ["montre", ["READ"]], ["affich", ["READ"]],
  ["consult", ["READ"]], ["list", ["READ"]], ["cherch", ["READ"]],
  ["trouv", ["READ"]], ["retrouv", ["READ"]], ["resum", ["READ"]],
  ["expliqu", ["READ"]], ["compte", ["READ"]], ["dis", ["READ"]],
  ["donne", ["READ"]], ["sais", ["READ"]], ["rate", ["READ"]],
];

/** Les mots qui font d'une phrase une QUESTION — donc une lecture, jamais un geste. */
const QUESTION_MARKERS = new Set([
  "combien", "pourquoi", "comment", "ou", "quand", "quoi", "lequel", "laquelle",
  "qu", "quel", "quelle", "quels", "quelles",
]);

/**
 * « qui » n'est interrogatif qu'en TÊTE de phrase.
 *
 * Ailleurs il est relatif — « le dossier QUI bloque » n'interroge rien. Mais « QUI a supprimé ce
 * fichier » est une question, et une question ne doit jamais faire remonter un bouton qui
 * supprime, quel que soit le verbe qu'elle contient.
 */
const INITIAL_QUESTION_MARKERS = new Set(["qui"]);

/** Les pronoms réfléchis : ils adressent le verbe à Adam, pas à l'ERP. */
const REFLEXIVE_CLITICS = new Set(["toi", "te", "vous"]);

/** Les marques de négation — « ne … pas », « surtout pas », « sans ». */
const NEGATIONS = new Set(["ne", "n", "pas", "jamais", "aucun", "aucune", "rien", "surtout"]);

/**
 * Les prépositions qui introduisent une CIRCONSTANCE, pas un objet.
 *
 * « Prépare-moi **avant la réunion** » ne demande pas de créer une réunion : elle en fixe le
 * moment. Le premier résolveur y voyait « préparer » + « réunion » et proposait « Planifier une
 * réunion » — un faux positif sur une simple demande de briefing. Ce qui suit l'une de ces
 * prépositions reste dans les jetons, mais ne peut plus DÉSIGNER un bouton.
 */
const CIRCUMSTANTIALS = new Set(["avant", "apres", "pendant", "durant", "depuis", "jusqu", "jusque"]);

/**
 * Les prépositions qui introduisent un ACCOMPAGNEMENT, pas la cible.
 *
 * « Crée une réunion **avec l'équipe** » crée une réunion. Le premier résolveur pesait les deux
 * noms à égalité et, « équipe » étant le mot le plus rare de la phrase, proposait « Créer une
 * équipe de vente ». Ce qui suit l'une de ces prépositions compte encore — mais moins.
 *
 * « de / du / des » n'en font PAS partie : ils SPÉCIFIENT le nom de tête (« demande d'achat »,
 * « poste de dépense ») au lieu de l'accompagner, et sont souvent le mot le plus informatif.
 */
const COMPLEMENT_PREPOSITIONS = new Set([
  "avec", "pour", "chez", "par", "aupres", "envers", "sans",
]);
// « dans » et « sur » en sont ABSENTS à dessein : dans un ERP, le lieu EST le module.
// « crée un événement dans l'agenda », « téléverse ce fichier dans le drive » — le complément
// de lieu est le mot qui départage, pas celui qu'on peut négliger.

/** De combien pèse moins un objet d'accompagnement, comparé à la cible du verbe. */
export const COMPLEMENT_WEIGHT = 0.45;

export interface ParsedPhrase {
  /** Les intentions retenues (une phrase peut en porter plusieurs : « ne supprime pas, modifie »). */
  intents: Set<Intent>;
  /**
   * Les intentions du PREMIER verbe — le geste réellement commandé.
   *
   * « restaure ce fichier supprimé » porte RESTORE **et** DELETE ; seul RESTORE est commandé.
   * C'est cette distinction qui permet d'exiger, pour un geste irréversible, que le PDG l'ait
   * DIT — et pas seulement prononcé le mot quelque part dans sa phrase.
   */
  headIntents: Set<Intent>;
  /** Les intentions explicitement NIÉES — elles ne peuvent plus être proposées. */
  negatedIntents: Set<Intent>;
  /** Les jetons d'OBJET, radicalisés : ce qui identifie le bouton. */
  objects: string[];
  /**
   * Les objets regroupés par CONCEPT — un groupe par mot réellement prononcé.
   *
   * « fichier » ouvre aussi « document » : ce sont deux écritures d'UNE idée, pas deux idées.
   * Comptés séparément, ils gonflaient la longueur de la phrase et diluaient le mot qui compte
   * — « mets ce fichier à la corbeille » perdait « corbeille » au profit de « Renommer ».
   */
  objectGroups: string[][];
  /**
   * Ceux des objets qui ACCOMPAGNENT au lieu de désigner (« … avec l'équipe », « … pour Sofiane »).
   * Ils comptent, mais moins : voir `COMPLEMENT_WEIGHT`.
   */
  complements: Set<string>;
  /**
   * Les radicaux des VERBES rencontrés.
   *
   * Ils ne servent pas à l'identification ordinaire — « crée » ne désigne aucun bouton. Mais
   * certaines actions n'ont QUE cela pour nom : « rappelle-moi » est un rappel, « invite
   * quelqu'un » est une invitation. Quand une phrase (ou un alias) ne contient aucun objet, le
   * verbe redevient l'identifiant, faute de mieux.
   */
  verbs: string[];
  /**
   * Le radical du PREMIER verbe seulement — celui qui porte l'ordre.
   *
   * « Rappelle-moi mardi de relancer Deepak » contient deux verbes ; un seul est commandé. Sans
   * cette distinction, la phrase allait chercher « Répondre / relancer » au lieu du rappel.
   */
  headVerbs: string[];
  /** Tous les jetons utiles, radicalisés (objets + reste). */
  tokens: Set<string>;
  /** Vraie si la phrase interroge — « combien », « qui », « quel »… */
  isQuestion: boolean;
  /**
   * Vraie si un MOT interrogatif est présent (et pas seulement un point d'interrogation).
   *
   * La différence porte une règle de sûreté : « pourquoi cette demande a-t-elle été refusée ? »
   * contient le verbe « refuser » et ne demande rien — tandis que « peux-tu créer une facture ? »
   * demande bien quelque chose. Le point d'interrogation ne suffit donc pas à trancher ; le mot
   * interrogatif, si.
   */
  hasQuestionWord: boolean;
  /**
   * Vraie si la phrase ÉNONCE au lieu de commander.
   *
   * Deux marques, et elles sont syntaxiques : un ordre français commence par son verbe
   * (« crée une facture »), un constat commence par son sujet (« la facture est arrivée »). Et
   * une phrase sans aucun verbe d'action ne commande rien du tout.
   */
  isStatement: boolean;
  /**
   * « Demande à X DE FAIRE Y » — le PDG délègue.
   *
   * La construction a UNE destination canonique dans l'ERP : la demande de tâche. C'est une
   * règle métier arrêtée, pas une préférence de score : sans elle, la phrase repartait vers le
   * module cité dans le contenu de la tâche (« les dossiers Nintedanib » → Regulatory) ou vers
   * la demande administrative générique.
   */
  isDelegation: boolean;
}

/**
 * Le mot est-il une FORME VERBALE de l'un des radicaux connus ?
 *
 * Deux conditions, et la seconde est celle qui compte : il faut que ce qui RESTE après le
 * radical soit une terminaison verbale du français. C'est ce qui sépare « classe » de
 * « classement », « génère » de « général », « vide » de « vidéo ».
 *
 * On rend le RADICAL avec l'intention : c'est lui, et non le mot rencontré, qui sert de jeton.
 * Sans cela « rappelle » (raboté en « rapp » par les suffixes nominaux) et « rappel » ne se
 * rejoignaient pas — les deux côtés de la même comparaison, écrits différemment.
 */
function verbOf(token: string): { root: string; intents: Intent[] } | null {
  for (const [root, intents] of VERB_ROOTS) {
    if (!token.startsWith(root)) continue;
    if (!VERB_TAILS.has(token.slice(root.length))) continue;
    return { root, intents };
  }
  return null;
}

/**
 * Un INFINITIF derrière une préposition reste un verbe.
 *
 * « demande à Amel **de relancer** Deepak » : le « de » n'est pas un article, c'est la marque
 * de l'infinitif. Sans cette exception, la règle du déterminant transformait « relancer » en
 * objet et la phrase allait chercher le bouton « Répondre / relancer » du support.
 */
function looksInfinitive(word: string): boolean {
  return word.length >= 5 && /(?:er|ir|re)$/.test(word);
}

/**
 * DÉCOMPOSE une phrase : intention(s), objets, négations, forme interrogative.
 *
 * L'analyse de la négation est locale et volontairement prudente : une marque de négation
 * contamine le verbe le plus proche, dans une fenêtre de trois mots. « Ne supprime pas ce
 * dossier, modifie-le » perd DELETE et garde UPDATE — ce qui est exactement le sens.
 */
export function parsePhrase(text: string): ParsedPhrase {
  const rawTokens = flatten(text).split(" ").filter(Boolean);

  const intents = new Set<Intent>();
  const headIntents = new Set<Intent>();
  const negatedIntents = new Set<Intent>();
  const objects: string[] = [];
  const objectGroups: string[][] = [];
  const complements = new Set<string>();
  const verbs: string[] = [];
  const headVerbs: string[] = [];
  const tokens = new Set<string>();
  let isQuestion = /\?/.test(text);
  let hasQuestionWord = false;
  // Un déterminant AVANT le premier verbe : la phrase a un sujet, donc elle énonce.
  let determinerBeforeVerb = false;
  let reflexive = false;
  let headTaken = false;
  // Un complément circonstanciel court jusqu'au verbe suivant : « avant la réunion **de
  // demain** » situe encore, « … et archive le dossier » a repris le fil.
  let inCircumstance = false;
  let inComplement = false;

  // Les négations repérées AVANT expansion : leur position compte.
  const negPositions: number[] = [];
  rawTokens.forEach((t, i) => { if (NEGATIONS.has(t)) negPositions.push(i); });
  // Deux mots, pas trois : « ne supprime pas ce dossier, MODIFIE-le » gardait la modification
  // dans la contamination de la négation, et la phrase ne demandait plus rien.
  const nearNegation = (i: number) => negPositions.some((p) => Math.abs(p - i) <= 2);

  rawTokens.forEach((raw, i) => {
    if (QUESTION_MARKERS.has(raw) || (i === 0 && INITIAL_QUESTION_MARKERS.has(raw))) {
      isQuestion = true;
      hasQuestionWord = true;
    }
    if (i === 0 && DETERMINERS.has(raw)) determinerBeforeVerb = true;

    // Ce qui suit un déterminant est un NOM, quoi qu'en dise la table des verbes — sauf un
    // infinitif (« de relancer »), et sauf un déterminant lui-même (« une **nouvelle** demande »,
    // où « nouvelle » dit bien qu'on crée).
    const forcedNoun =
      i > 0 && DETERMINERS.has(rawTokens[i - 1]) && !DETERMINERS.has(raw) && !looksInfinitive(raw);
    // Ce qui suit « avant / après / pendant » situe l'action, il ne la désigne pas.
    if (CIRCUMSTANTIALS.has(raw)) inCircumstance = true;
    if (COMPLEMENT_PREPOSITIONS.has(raw)) inComplement = true;
    const circumstantial = inCircumstance;
    const isComplement = inComplement;

    // Le vocabulaire métier s'ouvre AVANT tout le reste, et s'AJOUTE au mot d'origine — mais
    // un MOT-OUTIL ne s'ouvre pas : « ça » est un pronom, pas le sigle du chiffre d'affaires.
    const syn = STOPWORDS.has(raw) ? undefined : BUSINESS_SYNONYMS[raw];
    const expanded = syn ? [raw, ...syn] : [raw];

    let verbHere = false;
    // Un mot prononcé = un CONCEPT, même s'il ouvre plusieurs écritures.
    const group: string[] = [];
    for (const word of expanded) {
      if (word.length < 2 || STOPWORDS.has(word) || NUMERIC.test(word)) continue;

      const verb = forcedNoun ? null : verbOf(word);
      if (verb) {
        verbHere = true;
        for (const it of verb.intents) {
          if (nearNegation(i)) negatedIntents.add(it);
          else {
            intents.add(it);
            if (!headTaken) headIntents.add(it);
          }
        }
        // Un verbe n'est pas un objet : il ne doit pas peser dans l'identification du bouton.
        tokens.add(verb.root);
        verbs.push(verb.root);
        if (!headTaken && !nearNegation(i)) {
          headVerbs.push(verb.root);
          // « rappelle-TOI » n'est pas « rappelle-MOI » : le premier s'adresse à Adam, le second
          // pose un rappel dans l'ERP. Le clitique fait toute la différence.
          if (i + 1 < rawTokens.length && REFLEXIVE_CLITICS.has(rawTokens[i + 1])) reflexive = true;
        }
        continue;
      }

      const stem = stemNoun(word);
      tokens.add(stem);
      if (!circumstantial) {
        objects.push(stem);
        group.push(stem);
        if (isComplement) complements.add(stem);
      }
    }
    if (group.length > 0) objectGroups.push([...new Set(group)]);
    // Un verbe reprend le fil de la phrase : ce qui suit redevient un objet possible.
    if (verbHere) {
      inCircumstance = false;
      inComplement = false;
      if (!nearNegation(i)) headTaken = true;
    }
  });

  for (const neg of negatedIntents) {
    intents.delete(neg);
    headIntents.delete(neg);
  }

  /**
   * « DEMANDE À quelqu'un DE FAIRE quelque chose » = une TÂCHE.
   *
   * Ce n'est pas une phrase apprise par cœur, c'est une construction : un verbe de demande en
   * tête, puis un second verbe à l'infinitif — ce que le PDG délègue. Sans elle, « demande à
   * Amel de préparer le dossier » n'avait pour objet que « dossier » et allait chercher un
   * bouton du module Regulatory au lieu de créer la demande de tâche.
   *
   * La condition est stricte : sans second verbe, « demande la facture de l'ordre » reste ce
   * qu'elle est — une demande de facture, pas une tâche.
   */
  // « de » + infinitif : la marque de la délégation, quel que soit le verbe délégué — même
  // inconnu de la table (« de VÉRIFIER les dossiers »). C'est la grammaire qui la porte.
  const infinitifDelegue = rawTokens.some(
    (t, i) => i > 0 && (rawTokens[i - 1] === "de" || rawTokens[i - 1] === "d") && looksInfinitive(t),
  );
  const isDelegation = headIntents.has("REQUEST") && (verbs.length > 1 || infinitifDelegue);
  if (isDelegation) {
    // Ce qui suit décrit le CONTENU de la tâche (« préparer le dossier regulatory »), pas la
    // cible du geste. Le geste, c'est la tâche — le reste l'accompagne.
    for (const o of objects) complements.add(o);
    objects.unshift("tache");
    objectGroups.unshift(["tache"]);
  }

  return {
    intents,
    headIntents,
    negatedIntents,
    objects: [...new Set(objects)],
    objectGroups,
    complements,
    verbs: [...new Set(verbs)],
    headVerbs: [...new Set(headVerbs)],
    tokens,
    isQuestion,
    hasQuestionWord,
    isDelegation,
    // Un constat : soit aucun verbe d'action, soit un sujet placé avant le verbe. S'y ajoute la
    // tournure réfléchie sans objet — « rappelle-toi de ça », qui parle à Adam et non à l'ERP.
    isStatement:
      intents.size === 0 ||
      (determinerBeforeVerb && verbs.length > 0) ||
      (reflexive && objects.length === 0),
  };
}

// ───────────────────────────── Parenté des intentions ─────────────────────────────

/**
 * COMBIEN DEUX INTENTIONS S'ACCORDENT.
 *
 * Le premier résolveur traitait toute différence comme un désaccord rédhibitoire. Mesuré :
 * « change le manager de cette personne » (UPDATE) n'atteignait pas « Désigner le N+1 »
 * (ASSIGN) — alors que dans un ERP, désigner un nouveau N+1 EST le changement demandé. Onze
 * formulations réelles se perdaient ainsi sur une différence de vocabulaire, pas de sens.
 *
 * Mais l'inverse reste vrai et vital : UPDATE et DELETE ne sont pas voisins, ils sont OPPOSÉS,
 * et aucune ressemblance d'objets ne doit les rapprocher.
 */
export type IntentRelation = "MATCH" | "RELATED" | "DIVERGENT" | "OPPOSED" | "NEUTRAL";

/**
 * Voisinages admis : deux façons de nommer le MÊME geste dans un ERP.
 *
 * La liste est courte, et elle l'est devenue à la mesure. Une version plus généreuse — où
 * CRÉER voisinait MODIFIER et ASSIGNER — coûtait onze erreurs de destination : « crée une
 * demande de sponsoring » atteignait « Approuver la demande de sponsoring », « ajoute une pièce
 * au courrier » atteignait « Modifier la pièce ». Créer n'est pas modifier. Un voisinage ne se
 * justifie que si les deux verbes désignent réellement le même bouton.
 */
const RELATED_PAIRS: [Intent, Intent][] = [
  // Changer le responsable, c'est bien modifier la fiche : c'est le seul voisinage de UPDATE
  // qui tienne, et il rattrape « change le manager » → « Désigner le N+1 ».
  ["UPDATE", "ASSIGN"], ["UPDATE", "CONFIGURE"],
  ["CREATE", "IMPORT"], ["CREATE", "COPY"], ["CREATE", "REQUEST"],
  ["CREATE", "SEND"], ["CREATE", "REMIND"],
  ["SEND", "REQUEST"], ["SEND", "REMIND"], ["SEND", "SHARE"],
  ["REQUEST", "REMIND"],
  ["ASSIGN", "CONFIGURE"],
  ["MOVE", "COPY"], ["MOVE", "ARCHIVE"],
  ["EXPORT", "COPY"], ["EXPORT", "SEND"],
  // Aucun voisinage ENTRE gestes destructeurs : « annule » ne doit pas ouvrir « supprime », ni
  // « archive » ouvrir « détruire ». Chacun d'eux exige son propre verbe, prononcé.
];

/** Oppositions franches : elles priment sur tout voisinage. */
const OPPOSED_PAIRS: [Intent, Intent][] = [
  ["CREATE", "DELETE"], ["CREATE", "CANCEL"], ["CREATE", "ARCHIVE"], ["CREATE", "UNASSIGN"],
  ["CREATE", "REJECT"], ["CREATE", "UNSHARE"],
  ["UPDATE", "DELETE"], ["UPDATE", "CANCEL"], ["UPDATE", "UNASSIGN"], ["UPDATE", "UNSHARE"],
  ["UPDATE", "REJECT"],
  ["RESTORE", "DELETE"], ["RESTORE", "ARCHIVE"], ["RESTORE", "CANCEL"],
  ["ARCHIVE", "RESTORE"],
  ["ASSIGN", "UNASSIGN"], ["ASSIGN", "DELETE"], ["ASSIGN", "CANCEL"], ["ASSIGN", "REJECT"],
  ["SHARE", "UNSHARE"], ["SHARE", "DELETE"],
  ["APPROVE", "REJECT"], ["APPROVE", "DELETE"], ["APPROVE", "CANCEL"],
  ["IMPORT", "EXPORT"], ["IMPORT", "DELETE"], ["EXPORT", "DELETE"],
  ["SEND", "DELETE"], ["SEND", "CANCEL"], ["COPY", "DELETE"], ["MOVE", "DELETE"],
  ["CONFIGURE", "DELETE"], ["REQUEST", "DELETE"], ["REMIND", "DELETE"],
];

function pairKey(a: Intent, b: Intent): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
const RELATED = new Set(RELATED_PAIRS.map(([a, b]) => pairKey(a, b)));
const OPPOSED = new Set(OPPOSED_PAIRS.map(([a, b]) => pairKey(a, b)));

/**
 * Confronte les intentions d'une demande à celles d'un alias.
 *
 * L'ORDRE des verdicts est une règle de sûreté, pas une commodité :
 *   · une identité l'emporte sur tout — le PDG a dit le mot exact ;
 *   · sinon une OPPOSITION l'emporte sur un simple voisinage.
 *
 * Mesuré, dans l'autre sens : « archive ce dossier » face à l'alias « restaure le dossier
 * supprimé » trouvait ARCHIVE≈DELETE avant de voir ARCHIVE⊥RESTORE, et proposait de restaurer.
 * Un voisinage ne doit jamais couvrir une contradiction.
 */
export function relateIntents(query: Set<Intent>, alias: Set<Intent>): IntentRelation {
  if (query.size === 0 || alias.size === 0) return "NEUTRAL";
  let sawRelated = false;
  let sawOpposed = false;
  for (const q of query) {
    for (const a of alias) {
      if (q === a) return "MATCH";
      const k = pairKey(q, a);
      if (RELATED.has(k)) sawRelated = true;
      else if (OPPOSED.has(k)) sawOpposed = true;
    }
  }
  if (sawOpposed) return "OPPOSED";
  return sawRelated ? "RELATED" : "DIVERGENT";
}
