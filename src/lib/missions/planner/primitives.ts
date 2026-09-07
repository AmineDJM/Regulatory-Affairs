import { PRIMITIVES, type Primitive } from "@/lib/missions/registry/capability-meta";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA DEMANDE EXIGE — déduit du français, pas de la bonne volonté du modèle.
 *
 * ── LE DÉFAUT MESURÉ, ET IL TUAIT TROIS FAMILLES ────────────────────────────────────────
 *
 * Rien dans le runtime ne lisait la demande pour en déduire les primitives requises. La seule
 * trace de la notion était UNE phrase de consigne (« compose au niveau des primitives ») —
 * c'est-à-dire, selon la doctrine du projet elle-même, une prière et non un compilateur. Après
 * l'appel, les deux seuls contrôles étaient « au moins une étape » et « au moins un critère ».
 *
 * Conséquence : un plan « lire → répondre » qui ne contient aucune étape CALCUL ni aucun
 * livrable était accepté, compilé et exécuté pour une demande qui réclamait un chiffre ou une
 * pièce. La mission concluait sur de la prose non chiffrée. Au banc : STATISTIQUES 0/17,
 * REPRESENTATION 2/17, et « le plan ne prévoit pas CALCUL » en tête des causes.
 *
 * ── POURQUOI DU VOCABULAIRE, ET POURQUOI CE N'EST PAS DE LA TRICHE ──────────────────────
 *
 * On pourrait demander au modèle de déclarer lui-même les primitives dont il a besoin. C'est
 * précisément ce qu'un plan incomplet omet de faire : la déclaration serait faite par la partie
 * qu'elle doit contraindre. Le code doit donc savoir lire la demande, seul.
 *
 * Les marqueurs ci-dessous sont du FRANÇAIS D'ENTREPRISE ORDINAIRE — « combien », « total »,
 * « graphique », « rédige une note ». Ils ne viennent d'aucun énoncé de banc, ne nomment
 * aucune capacité, ne mentionnent aucune famille d'évaluation, et un test à jeu tenu à l'écart
 * vérifie qu'ils généralisent à des tournures qu'ils n'ont pas servi à écrire. Un dictionnaire
 * bâti sur les phrases du banc serait de la triche ; un dictionnaire de la langue du métier est
 * la seule façon de lire une demande sans payer un modèle pour cela.
 *
 * ── LA DISCIPLINE : DEUX NIVEAUX, ET SEUL LE PREMIER CONTRAINT ──────────────────────────
 *
 * `SURE` = le mot ne laisse aucun doute (« calcule », « graphique », « rédige un rapport »).
 * `POSSIBLE` = il oriente sans trancher (« analyse », « compare »). Seules les primitives SÛRES
 * peuvent faire refuser un plan : un refus à tort coûte une planification entière et enferme la
 * mission. Les POSSIBLES sont DITES au planificateur — l'informer est gratuit, le contraindre
 * ne l'est pas.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Certitude = "SURE" | "POSSIBLE";

export interface Exigence {
  primitive: Primitive;
  certitude: Certitude;
  /** Le mot de la demande qui l'a déclenchée — pour que la déduction soit vérifiable. */
  declencheur: string;
}

const ACCENTS = /[̀-ͯ]/g;

/**
 * LES IDIOMES QUI PORTENT UN MOT-MARQUEUR SANS EN PORTER LE SENS.
 *
 * « par rapport à » est une comparaison, pas un rapport. Mesuré sur le corpus du banc : « mets
 * Annaba en évidence PAR RAPPORT aux autres » se lisait comme une demande de document. Ici la
 * conséquence était bénigne (le mot ne comptait qu'en POSSIBLE), mais la même phrase avec un
 * verbe de production aurait exigé un DOCUMENT et fait refuser un plan correct.
 *
 * On neutralise donc l'idiome AVANT toute recherche, plutôt que d'écarter le mot partout : « fais
 * un rapport » doit continuer de compter.
 */
const IDIOMES_SANS_SENS: readonly RegExp[] = [
  / par rapport (a|au|aux) /g,   // comparaison — ce n'est pas une pièce à produire
  / rapport de force /g,
  / compte tenu /g,
  / se rendre compte /g,
];

export const normaliser = (t: string): string => {
  // « œ » et « æ » ne se décomposent pas en NFD : sans cette ligne, « coup d'œil » devient
  // « coup d il » et aucun marqueur ne peut l'atteindre.
  const lettres = t.normalize("NFD").replace(ACCENTS, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
  let n = ` ${lettres.replace(/[^a-z0-9]+/g, " ").trim()} `;
  for (const i of IDIOMES_SANS_SENS) n = n.replace(i, " ");
  return n;
};

/**
 * LES MARQUEURS. Chaque entrée est un RADICAL cherché comme début de mot : « calcul » attrape
 * calcule, calculer, calculs. Le radical évite d'énumérer les conjugaisons, et les énumérer
 * serait la porte ouverte à un dictionnaire qui suit les phrases plutôt que la langue.
 */
const MARQUEURS: Record<Primitive, { sure: readonly string[]; possible: readonly string[] }> = {
  /**
   * CALCUL — on demande un NOMBRE, ou une propriété d'un ensemble de nombres.
   *
   * « combien » et « total » sont les deux plus fréquents et les moins ambigus. Les termes
   * statistiques (écart, médiane, corrélation, significatif) sont sûrs aussi : personne ne les
   * emploie par figure de style dans une demande professionnelle.
   */
  CALCUL: {
    sure: [
      "combien", "calcul", "total", "somme", "moyenne", "mediane", "pourcentage", "taux",
      "ratio", "marge", "ecart type", "ecarts types", "variance", "correlation", "significatif",
      "significative", "statistique", "previsionnel", "prevision", "projection", "extrapol",
      "montant total", "cumul", "repartition", "classement", "chiffrer", "chiffre",
      // COMPTER. Le radical « compte » seul est écarté À DESSEIN : il vit aussi dans « compte
      // rendu » et « compte tenu », qui ne demandent aucun chiffre — l'attraper ferait exiger un
      // CALCUL de toute demande de procès-verbal, et un plan correct serait refusé. On retient
      // donc les formes qui ne portent QUE le dénombrement, impératif compris.
      "compter", "comptez", "compte les", "compte le nombre", "compte moi", "comptabilis",
      "denombr", "nombre de", "nombre d",

      // ═══════════════════════════════════════════════════════════════════════════════════
      // HUIT CLASSES DE QUESTION QU'AUCUNE LECTURE NE PEUT RÉSOUDRE
      //
      // Le dictionnaire ci-dessus ne connaissait que les demandes qui NOMMENT l'opération
      // (« calcule », « total », « moyenne »). Un dirigeant ne parle pas comme ça : il pose une
      // QUESTION, et c'est la question qui impose le chiffre. Mesuré sur le banc d'autonomie :
      // 46 missions sur 200 exigeaient un CALCUL sans porter un seul de ces mots — le
      // compilateur n'avait donc rien à refuser, et le plan « une lecture, puis on répond »
      // passait. Les familles STATISTIQUES et COMPOSITION en mouraient.
      //
      // Ce qui suit n'est pas une liste de phrases : ce sont HUIT CLASSES nommées, chacune
      // définie par ce qui rend la réponse impossible sans calculer. Chaque classe s'énonce
      // dans n'importe quel métier — c'est le test à retenir avant d'en ajouter une neuvième.
      // ═══════════════════════════════════════════════════════════════════════════════════

      // 1. RELATION ENTRE DEUX GRANDEURS. « Y a-t-il un lien entre le prix et le volume ? »,
      //    « l'ancienneté explique-t-elle les retards ? ». Répondre suppose de mettre deux
      //    séries en regard : aucune lecture ne le fait, et l'œil se trompe systématiquement.
      "lien entre", "rapport entre", "relation entre", "correl", "influence sur", "influe sur",
      "explique quelque chose", "est ce que ca explique", "explique t il", "explique t elle",
      "croise les", "croiser les", "en fonction de la", "en fonction du",

      // 2. COMPARAISON DE MAGNITUDES. « Coûte plus cher qu'il ne rapporte », « lequel coûte le
      //    moins cher », « est-ce qu'on dépasse ». Deux quantités qu'il faut chiffrer AVANT de
      //    pouvoir les ranger. Le superlatif seul ne suffit pas — c'est la GRANDEUR qui tranche
      //    (voir `COMPARAISON_CHIFFREE` plus bas, qui exige les deux).
      "coute plus", "coute moins", "coute le plus", "coute le moins", "rapporte plus",
      "rapporte moins", "depasse le budget", "depassement",

      // 3. PART D'UN TOUT. « Quelle proportion de notre activité dépend d'une seule personne ? »,
      //    « quelle part du chiffre vient de trois clients ? ». Un rapport de deux comptages.
      "proportion", "quelle part", "la part de", "la part du", "part des", "fraction de",
      "poids de", "concentration",

      // 4. CE QUI SORT DE L'ORDINAIRE. « Repère les mois anormaux », « quels dossiers sont
      //    atypiques ». « Anormal » n'a de sens que par rapport à une norme — donc à une moyenne
      //    et à une dispersion qu'il faut établir. Sans calcul, c'est une impression.
      "anormal", "anormaux", "anormale", "atypique", "inhabituel", "hors norme", "hors normes",
      "sortent de l ordinaire", "sort de l ordinaire", "valeurs extremes", "outlier",

      // 5. ÉCHANTILLON ET SIGNIFICATION. « L'écart tient-il à la taille de l'échantillon ? ».
      //    C'est LA question qui distingue un vrai écart d'un artefact : elle exige un test.
      "echantillon", "marge d erreur", "intervalle de confiance", "statistiquement",
      "se comportent differemment", "difference reelle",

      // 6. PROBABILITÉ ET INCERTITUDE. « Quelle est la probabilité qu'on termine sous le
      //    budget ? », « quel risque de dépasser le délai ? ». Une probabilité s'ESTIME, sur des
      //    hypothèses explicites ; l'annoncer sans la calculer serait une invention chiffrée.
      "probabilite", "quelles chances", "quelle chance", "risque de depasser", "esperance de",
      "en tenant compte de l incertitude", "scenario", "scenarios",

      // 7. OPTIMISATION SOUS CONTRAINTE. « Où poser un dépôt pour minimiser les trajets ? »,
      //    « comment répartir les visites pour couvrir le plus de médecins ? ». « Minimiser » et
      //    « maximiser » sont des mots d'optimisation : ils désignent un problème, pas un avis.
      "minimiser", "maximiser", "optimiser", "optimal", "optimale", "meilleur compromis",
      "repartir au mieux", "affecter au mieux",

      // 8. PROJECTION ET ATTERRISSAGE. « Où en est-on du budget à fin mars, et qu'est-ce qui va
      //    déraper ? ». Dire où l'on ATTERRIT suppose d'extrapoler la consommation : « où en
      //    est-on » seul est une lecture, « ce qui va déraper » ne l'est pas.
      "va deraper", "vont deraper", "atterrissage", "a ce rythme", "si rien ne change",
      "tenir le budget", "reste a consommer", "consomme a ce jour",
    ],
    possible: ["evolution", "tendance", "croissance", "progression", "compar", "rentabilit", "performance", "anomal", "aberrant"],
  },

  /**
   * REPRESENTATION — on demande à VOIR. Un tableau, une courbe, une carte, un tableau de bord.
   *
   * « montre-moi » seul ne suffit pas : il sert aussi bien à « montre-moi le contrat ». C'est
   * le nom de l'objet visuel qui tranche.
   */
  /**
   * REPRESENTATION — on demande à VOIR, et on ne nomme pas toujours la forme.
   *
   * « montre-moi » seul ne suffit pas : il sert aussi bien à « montre-moi le contrat ». C'est le
   * nom de l'objet visuel qui tranche — OU une tournure qui ne peut vouloir dire que « rends-moi
   * cela visible ».
   *
   * Ces tournures-là ont été trouvées en confrontant le détecteur à des demandes réelles, et
   * elles manquaient : « sur une carte », « en un coup d'œil », « sous la forme la plus lisible »,
   * « dessine-moi ». Ce sont des idiomes du français courant, pas des phrases recopiées : chacun
   * exprime la MISE EN FORME et rien d'autre, et les négatifs du jeu de test (« montre-moi le
   * contrat », « fais-moi voir la facture ») vérifient qu'ils n'attrapent pas une simple lecture.
   */
  REPRESENTATION: {
    sure: [
      "graphique", "graphiques", "courbe", "histogramme", "camembert", "diagramme", "nuage de points",
      "tableau de bord", "dashboard", "visualis", "heatmap", "chronologie", "timeline", "gantt",
      "cartographie", "carte geographique", "matrice", "entonnoir", "waterfall",
      // Les idiomes du VOIR — aucun ne peut désigner une lecture de document.
      "sur une carte", "sur la carte", "en un coup d oeil", "d un coup d oeil",
      "sous la forme", "sous quelle forme", "sous forme de", "choisis la forme",
      "dessine", "trace moi", "trace la", "visuellement", "graphiquement",
    ],
    // (voir `MONTRER_LE_RESULTAT` : « montre-le » sur un PRONOM est aussi une exigence sûre —
    //  c'est le résultat qu'on demande à voir, pas un objet qu'on demande à ouvrir.)
    possible: ["tableau", "tableaux", "vue", "panorama", "apercu visuel", "fais moi voir", "montre moi"],
  },

  /**
   * ═════════════════════════════════════════════════════════════════════════════════════
   * DOCUMENT — on demande une PIÈCE, et il faut distinguer LA RECEVOIR de LA PRODUIRE.
   *
   * ── LE FAUX POSITIF QUI A COÛTÉ LE PLUS CHER ──────────────────────────────────────
   *
   * La première écriture rangeait « devis », « facture », « rapport » parmi les marqueurs
   * SÛRS. « Attends le contrat et le devis du fournisseur avant de conclure » exigeait donc
   * un DOCUMENT — et le compilateur refusait un plan d'ATTENTE parfaitement correct, en
   * boucle, jusqu'à l'abandon. Un scénario du banc l'a dit à la première exécution.
   *
   * Un nom de pièce ne dit pas qui la produit. Ces noms ne comptent donc que si la demande
   * porte AUSSI un verbe de production. « Fais-moi un devis » produit ; « attends le devis »
   * reçoit ; « où est le devis » cherche. Seule la première appelle la primitive DOCUMENT.
   *
   * Les VERBES, eux, se suffisent : « rédige », « exporte », « génère » ne s'emploient pas
   * pour recevoir quelque chose.
   * ═════════════════════════════════════════════════════════════════════════════════════
   */
  DOCUMENT: {
    sure: ["redige", "rediger", "redaction", "exporte", "exporter"],
    possible: ["synthese", "note", "livrable", "piece", "dossier a produire"],
  },

  /**
   * ACTION — un effet dans le monde. Le triage détecte déjà l'écriture pour d'autres raisons ;
   * on le reprend ici pour que la carte des exigences soit complète, sans en faire un verrou :
   * décider d'agir est une question de DROITS et d'accord, pas de couverture de plan.
   */
  ACTION: {
    sure: [],
    possible: ["envoie", "envoyer", "assigne", "affecte", "cree", "creer", "planifie", "approuve", "commande", "reserve"],
  },

  ORCHESTRATION: {
    sure: [],
    possible: ["surveille", "surveiller", "relance", "chaque semaine", "chaque mois", "des que", "jusqu a ce que"],
  },

  /** Toute demande veut de l'information. En faire une exigence n'apprendrait rien à personne. */
  INFORMATION: { sure: [], possible: [] },
};

/**
 * LES NOMS DE PIÈCE — ils n'exigent DOCUMENT qu'accompagnés d'un verbe de production.
 *
 * La liste des verbes est courte et volontairement stricte : « envoie » n'y est pas (on envoie
 * une pièce qui existe déjà), « ouvre » et « trouve » non plus. Ce sont les verbes par lesquels
 * une pièce vient à l'existence.
 */
const PIECES: readonly string[] = [
  "rapport", "note de synthese", "compte rendu", "presentation", "slide", "diapositive",
  "excel", "xlsx", "classeur", "word", "docx", "powerpoint", "pptx", "pdf", "fichier",
  "devis", "facture", "bon de commande", "courrier", "lettre", "memo", "export",
  /**
   * LE TABLEAU EST UNE PIÈCE — quand un verbe le fait naître.
   *
   * « Rends-moi un seul tableau qui dit ce qu'il y a dedans », « sors-moi un tableau des
   * échéances » : ce qu'on attend est un livrable, pas une vue à l'écran. Le mot restait
   * pourtant classé REPRESENTATION-possible seulement, et aucune exigence n'en sortait —
   * mesuré sur le banc, où les familles TRANSFORMATION et EXTRACTION concluaient en prose.
   *
   * Il ne compte, comme toute pièce, qu'accompagné d'un verbe de production : « regarde le
   * tableau de Yacine » ne demande à personne d'en fabriquer un. Et « tableau de bord » reste
   * une REPRÉSENTATION SÛRE, plus haut : c'est un écran, pas un fichier.
   */
  "tableau", "tableaux", "feuille de calcul", "csv", "recapitulatif",
  /**
   * LES PIÈCES QU'ON NOMME SANS LES NOMMER PRÉCISÉMENT.
   *
   * « Prépare une NOTE pour Mehdi », « mets ça dans un DOCUMENT que je puisse faire circuler »,
   * « je veux la LISTE des montants supérieurs à un million ». Trois mots génériques qui
   * désignent bel et bien un livrable — et qui manquaient, si bien qu'un verbe de production
   * suivi de l'un d'eux n'exigeait rien.
   *
   * Le garde-fou reste le même et il suffit : une pièce ne compte QU'accompagnée d'un verbe qui
   * la fait naître. « Prends note », « lis le document », « donne-moi la liste » ne déclenchent
   * donc rien — aucun de ces verbes ne produit.
   */
  "note", "document", "liste",
];
const VERBES_PRODUCTION: readonly string[] = [
  "fais", "faire", "fait moi", "prepare", "preparer", "genere", "generer", "produis", "produire",
  "etablis", "etablir", "monte", "monter", "redige", "rediger", "ecris", "ecrire", "cree", "creer",
  "sors", "sortir", "edite", "editer", "il me faut", "j ai besoin d", "je veux un", "je veux une",
  "mets moi ca dans", "mets ca dans",
  /**
   * LES VERBES QUI RASSEMBLENT — ils produisent une pièce, ils ne la reçoivent pas.
   *
   * « Rassemble tout ce qui concerne juin dans un seul classeur », « regroupe-les et rends-moi
   * un tableau », « consolide les trois sources ». Ces verbes disent qu'une pièce N'EXISTE PAS
   * encore et qu'on la fabrique à partir de plusieurs autres — c'est exactement la production.
   * Ils manquaient, et une demande de consolidation ne portait donc aucune exigence.
   */
  "rassemble", "rassembler", "regroupe", "regrouper", "consolide", "consolider",
  "compile", "compiler", "rends moi", "restitue", "restituer", "dresse", "dresser",
];

/**
 * UN AUXILIAIRE DEVANT LE VERBE RACONTE, IL NE DEMANDE PAS.
 *
 * « Envoie-moi le rapport que Yassine A PRÉPARÉ » nomme une pièce et un verbe de production —
 * mais la pièce existe déjà, et la demande est de l'envoyer. Le passé composé est le signal, et
 * il se lit sur le mot d'avant. Sans cette règle, une simple transmission ferait exiger la
 * fabrication d'un document, et le compilateur refuserait un plan correct.
 */
const AUXILIAIRES = new Set(["a", "as", "ai", "ont", "avez", "avons", "avait", "avaient", "aura", "auront", "est", "sont", "etait"]);

/**
 * « FAIS-MOI VOIR » MONTRE, IL NE PRODUIT PAS.
 *
 * Le verbe « faire » suivi de « voir » est une demande de MONTRER, pas de fabriquer : « fais-moi
 * voir la facture de mars » ne demande à personne d'émettre une facture. Sans cette exception, un
 * verbe de production et un nom de pièce se rencontraient dans une phrase de simple consultation.
 */
const SUIVIS_QUI_MONTRENT = /^\s*(moi\s+)?voir\b/;

/**
 * « MONTRE-LE » — l'impératif qui porte sur un RÉSULTAT, pas sur un objet.
 *
 * « Croise les ventes avec la distance et dis-moi si l'éloignement explique quelque chose.
 * MONTRE-LE. » Le pronom ne désigne aucune pièce à ouvrir : il désigne ce qu'on vient de
 * demander de calculer, et « montre » veut alors dire « rends-le visible ». C'est une
 * REPRÉSENTATION, et la seule tournure par laquelle on la demande sans nommer de forme.
 *
 * La distinction tient au PRONOM. « Montre-moi le contrat » nomme un objet et reste une
 * lecture — c'est pourquoi « montre moi » est resté POSSIBLE. Un pronom seul ne peut désigner
 * qu'un résultat.
 */
const MONTRER_LE_RESULTAT = / montre (le|la|les|ca|cela|moi ca|moi cela)( |$)/;

/**
 * LE MOT DE PIÈCE QUI VIT DANS UNE EXPRESSION D'ÉCRAN — et le test qui l'a attrapé.
 *
 * Ajouter « tableau » aux pièces a immédiatement cassé « Fais-moi un TABLEAU DE BORD des
 * paiements » : le jeu tenu à l'écart l'a dit à la première exécution, et il avait raison. Un
 * tableau de bord n'est pas un fichier qu'on fait circuler, c'est un écran — il est d'ailleurs
 * déjà une REPRÉSENTATION SÛRE quelques lignes plus haut.
 *
 * On neutralise donc l'expression AVANT de chercher une pièce, plutôt que de retirer le mot
 * partout : « rends-moi un tableau des échéances » doit continuer de compter. Même discipline
 * que `IDIOMES_SANS_SENS`, appliquée à la seule recherche de pièce.
 */
const PIECES_FAUX_AMIS: readonly RegExp[] = [
  / tableaux? de bord/g,   // un écran, pas un livrable — et déjà une REPRÉSENTATION sûre
  / note de service/g,     // elle se PUBLIE par les directives, elle ne se fabrique pas ici
];

/** La demande, vue par la recherche de PIÈCE : les faux amis y sont effacés. */
const sansFauxAmis = (norm: string): string => {
  let n = norm;
  for (const r of PIECES_FAUX_AMIS) n = n.replace(r, " ");
  return n;
};

/** Le verbe est-il DEMANDÉ (impératif, souhait) plutôt que RACONTÉ (passé composé) ou MONTRÉ ? */
function verbeDemande(demandeNorm: string, verbe: string): boolean {
  const v = normaliser(verbe).trim();
  if (v === "") return false;
  let i = demandeNorm.indexOf(` ${v}`);
  while (i !== -1) {
    const avant = demandeNorm.slice(0, i).trim().split(" ");
    const precedent = avant[avant.length - 1] ?? "";
    const apres = demandeNorm.slice(i + 1 + v.length);
    if (!AUXILIAIRES.has(precedent) && !SUIVIS_QUI_MONTRENT.test(apres)) return true;
    i = demandeNorm.indexOf(` ${v}`, i + 1);
  }
  return false;
}

/** Un radical présent en DÉBUT DE MOT dans la demande normalisée. */
function trouve(demandeNorm: string, radical: string): boolean {
  const r = normaliser(radical).trim();
  if (r === "") return false;
  return r.includes(" ") ? demandeNorm.includes(` ${r} `) || demandeNorm.includes(` ${r}`) : demandeNorm.includes(` ${r}`);
}

/**
 * LES PRIMITIVES QUE CETTE DEMANDE EXIGE.
 *
 * Rend au plus une exigence par primitive, la plus forte l'emportant. L'ordre est celui de
 * `PRIMITIVES`, donc stable : deux appels sur la même phrase rendent la même liste, ce qui rend
 * un refus de compilation reproductible et un banc comparable d'une version à l'autre.
 */
export function exigencesDe(demande: string): Exigence[] {
  const norm = normaliser(demande);
  const out: Exigence[] = [];
  const pourPieces = sansFauxAmis(norm);
  const piece = PIECES.find((r) => trouve(pourPieces, r));
  const produit = VERBES_PRODUCTION.find((v) => verbeDemande(norm, v));
  for (const p of PRIMITIVES) {
    const m = MARQUEURS[p];
    const sur = m.sure.find((r) => trouve(norm, r));
    if (sur) { out.push({ primitive: p, certitude: "SURE", declencheur: sur }); continue; }
    // « Montre-le » : le pronom dit que c'est le RÉSULTAT qu'on veut voir, pas une pièce.
    if (p === "REPRESENTATION" && MONTRER_LE_RESULTAT.test(norm)) {
      out.push({ primitive: p, certitude: "SURE", declencheur: "montre-le" });
      continue;
    }
    // Une pièce NOMMÉE et un verbe qui la fait naître : ensemble seulement, jamais l'un sans
    // l'autre. « Attends le devis » ne demande à personne de fabriquer un devis.
    if (p === "DOCUMENT" && piece && produit) {
      out.push({ primitive: p, certitude: "SURE", declencheur: `${produit} … ${piece}` });
      continue;
    }
    if (p === "DOCUMENT" && piece) {
      out.push({ primitive: p, certitude: "POSSIBLE", declencheur: piece });
      continue;
    }
    const pos = m.possible.find((r) => trouve(norm, r));
    if (pos) out.push({ primitive: p, certitude: "POSSIBLE", declencheur: pos });
  }
  return out;
}

/** Les seules qui peuvent faire REFUSER un plan. Une hésitation n'enferme jamais une mission. */
export const exigencesFermes = (demande: string): Primitive[] =>
  exigencesDe(demande).filter((e) => e.certitude === "SURE").map((e) => e.primitive);

/** La phrase dite au planificateur. `null` quand la demande n'exige rien de particulier. */
export function direExigences(ex: readonly Exigence[]): string | null {
  if (ex.length === 0) return null;
  const sures = ex.filter((e) => e.certitude === "SURE");
  const poss = ex.filter((e) => e.certitude === "POSSIBLE");
  const bouts: string[] = [];
  if (sures.length > 0) {
    bouts.push(`Cette demande EXIGE ${sures.map((e) => `${e.primitive} (« ${e.declencheur} »)`).join(", ")} : `
      + `ton plan doit contenir au moins une étape qui porte chacune de ces primitives, `
      + `ou déclarer dans « gaps » qu'aucune capacité disponible ne sait le faire.`);
  }
  if (poss.length > 0) {
    bouts.push(`Elle appelle probablement ${poss.map((e) => e.primitive).join(", ")} — à toi de juger.`);
  }
  return bouts.join(" ");
}
