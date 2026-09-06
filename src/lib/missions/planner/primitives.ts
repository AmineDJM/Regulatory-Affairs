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
export const normaliser = (t: string): string =>
  ` ${t.normalize("NFD").replace(ACCENTS, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

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
    ],
    possible: ["evolution", "tendance", "croissance", "progression", "compar", "rentabilit", "performance", "anomal", "aberrant"],
  },

  /**
   * REPRESENTATION — on demande à VOIR. Un tableau, une courbe, une carte, un tableau de bord.
   *
   * « montre-moi » seul ne suffit pas : il sert aussi bien à « montre-moi le contrat ». C'est
   * le nom de l'objet visuel qui tranche.
   */
  REPRESENTATION: {
    sure: [
      "graphique", "graphiques", "courbe", "histogramme", "camembert", "diagramme", "nuage de points",
      "tableau de bord", "dashboard", "visualis", "heatmap", "chronologie", "timeline", "gantt",
      "cartographie", "carte geographique", "matrice", "entonnoir", "waterfall",
    ],
    possible: ["tableau", "tableaux", "vue", "panorama", "apercu visuel"],
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
];
const VERBES_PRODUCTION: readonly string[] = [
  "fais", "faire", "fait moi", "prepare", "preparer", "genere", "generer", "produis", "produire",
  "etablis", "etablir", "monte", "monter", "redige", "rediger", "ecris", "ecrire", "cree", "creer",
  "sors", "sortir", "edite", "editer", "il me faut", "j ai besoin d", "je veux un", "je veux une",
  "mets moi ca dans", "mets ca dans",
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

/** Le verbe est-il DEMANDÉ (impératif, souhait) plutôt que RACONTÉ (passé composé) ? */
function verbeDemande(demandeNorm: string, verbe: string): boolean {
  const v = normaliser(verbe).trim();
  if (v === "") return false;
  let i = demandeNorm.indexOf(` ${v}`);
  while (i !== -1) {
    const avant = demandeNorm.slice(0, i).trim().split(" ");
    const precedent = avant[avant.length - 1] ?? "";
    if (!AUXILIAIRES.has(precedent)) return true;
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
  const piece = PIECES.find((r) => trouve(norm, r));
  const produit = VERBES_PRODUCTION.find((v) => verbeDemande(norm, v));
  for (const p of PRIMITIVES) {
    const m = MARQUEURS[p];
    const sur = m.sure.find((r) => trouve(norm, r));
    if (sur) { out.push({ primitive: p, certitude: "SURE", declencheur: sur }); continue; }
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
