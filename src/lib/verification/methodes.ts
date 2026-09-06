/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES MÉTHODES DE VÉRIFICATION, ET CE QUE CHACUNE NE VOIT PAS (mandat 6 §49) — pur.
 *
 * ── LA PROPRIÉTÉ QUI REND CE FICHIER UTILE ──────────────────────────────────────────────
 *
 * Chaque méthode déclare **ce qu'elle ne peut PAS attraper**. C'est plus important que ce
 * qu'elle attrape, pour une raison précise : la faute la plus coûteuse d'un système de
 * vérification n'est pas de rater une erreur, c'est de faire croire qu'il l'aurait vue.
 *
 * Exemple concret et non hypothétique : le SECOND MODÈLE. Deux modèles interrogés sur le même
 * contexte et d'accord entre eux ne prouvent rien quand l'erreur est DANS le contexte — ils
 * partagent la source, donc la faute. Un système qui compterait cet accord comme une preuve
 * transformerait une erreur d'entrée en certitude, ce qui est strictement pire que de n'avoir
 * rien vérifié.
 *
 * ── LE COÛT EST UN CRITÈRE DE SÉLECTION, PAS UNE EXCUSE ─────────────────────────────────
 *
 * §50 fixe la hiérarchie : qualité > coût > latence. Le coût sert donc à choisir ENTRE deux
 * méthodes de pouvoir comparable, jamais à descendre sous le niveau que le risque exige.
 * `selectionner` ordonne par « pouvoir par unité de coût » et s'arrête quand le niveau est
 * couvert — mais ne descend jamais en dessous.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import type { Affirmation, Niveau, Obtention } from "@/lib/verification/risque";

export const METHODES = [
  /** Refaire le calcul avec du code, sans modèle. La seule méthode qui PROUVE, quand elle s'applique. */
  "RECALCUL",
  /** La forme est-elle celle attendue ? Champs, types, bornes, énumérations. */
  "SCHEMA",
  /** Le total recoupe-t-il la somme des parties ? Le rapprochement classique. */
  "RECONCILIATION",
  /** Aller rechercher le fait dans une AUTRE source que celle utilisée. */
  "SOURCE_ALTERNATIVE",
  /** Reposer la question autrement, au même modèle : attrape une mécompréhension de consigne. */
  "AUTRE_FORMULATION",
  /** Un second modèle, sur le même contexte : attrape une erreur de raisonnement, pas d'entrée. */
  "SECOND_MODELE",
  /** Un vérificateur à qui on demande de FAIRE ÉCHOUER l'affirmation. */
  "ADVERSARIAL",
] as const;
export type Methode = (typeof METHODES)[number];

export interface FicheMethode {
  methode: Methode;
  /** Ce qu'elle attrape réellement. */
  attrape: string[];
  /** CE QU'ELLE NE VOIT PAS — la partie qui empêche de se raconter des histoires. */
  aveugleA: string[];
  /** Coût relatif, 0 (gratuit, déterministe) à 5 (un appel de modèle long). */
  cout: number;
  /** Pouvoir : à quel point un passage réussi est informatif, 1 à 5. */
  pouvoir: number;
  /** Vrai quand un ÉCHEC de cette méthode est une preuve d'erreur, pas un indice. */
  concluantEnEchec: boolean;
}

export const FICHES: Readonly<Record<Methode, FicheMethode>> = {
  RECALCUL: {
    methode: "RECALCUL",
    attrape: ["une addition fausse", "un taux mal appliqué", "une conversion d'unité", "un arrondi qui dérive"],
    aveugleA: ["une donnée d'entrée fausse — recalculer une erreur la reproduit exactement", "un périmètre mal choisi"],
    cout: 0, pouvoir: 5, concluantEnEchec: true,
  },
  SCHEMA: {
    methode: "SCHEMA",
    attrape: ["un champ manquant", "un type faux", "une valeur hors bornes", "une énumération inventée"],
    aveugleA: ["une valeur parfaitement bien formée et fausse — c'est le cas le plus fréquent"],
    cout: 0, pouvoir: 2, concluantEnEchec: true,
  },
  RECONCILIATION: {
    methode: "RECONCILIATION",
    attrape: ["une ligne oubliée", "un doublon compté deux fois", "un écart entre le total et le détail"],
    aveugleA: ["deux erreurs qui se compensent", "une ligne fausse des DEUX côtés du rapprochement"],
    cout: 1, pouvoir: 4, concluantEnEchec: true,
  },
  SOURCE_ALTERNATIVE: {
    methode: "SOURCE_ALTERNATIVE",
    attrape: ["une source périmée", "une lecture au mauvais endroit", "une entité confondue avec une autre"],
    aveugleA: ["une erreur présente identiquement dans les deux sources (une saisie initiale fausse)"],
    cout: 2, pouvoir: 4, concluantEnEchec: false,
  },
  AUTRE_FORMULATION: {
    methode: "AUTRE_FORMULATION",
    attrape: ["une consigne mal comprise", "une question à laquelle le modèle a répondu à côté"],
    aveugleA: ["un biais du modèle qui survit à la reformulation", "une erreur dans le contexte fourni"],
    cout: 3, pouvoir: 2, concluantEnEchec: false,
  },
  SECOND_MODELE: {
    methode: "SECOND_MODELE",
    attrape: ["une erreur de raisonnement propre au premier modèle", "une hallucination isolée"],
    // LA LIGNE LA PLUS IMPORTANTE DU FICHIER.
    aveugleA: [
      "TOUTE erreur présente dans le contexte : les deux modèles la partagent, et leur accord n'est alors pas une preuve mais un écho",
      "une convention fausse que les deux modèles tiennent de leur entraînement",
    ],
    cout: 4, pouvoir: 3, concluantEnEchec: false,
  },
  ADVERSARIAL: {
    methode: "ADVERSARIAL",
    attrape: ["une hypothèse implicite jamais énoncée", "un cas limite ignoré", "une affirmation sans preuve dans la chaîne"],
    aveugleA: ["ce qu'aucune des deux parties ne sait — un vérificateur adversarial ne crée pas d'information"],
    cout: 5, pouvoir: 4, concluantEnEchec: false,
  },
};

/** Le nombre de méthodes qu'un niveau exige. Zéro pour AUCUN : ne rien faire est une décision. */
const EXIGE: Readonly<Record<Niveau, number>> = { AUCUN: 0, LEGER: 1, APPUYE: 2, ADVERSARIAL: 4 };

/**
 * QUELLES MÉTHODES S'APPLIQUENT À CETTE AFFIRMATION.
 *
 * On ne propose pas un RECALCUL sur une phrase, ni une RECONCILIATION sur un fait unitaire.
 * Une méthode inapplicable proposée puis « passée » compterait comme une vérification faite :
 * c'est ainsi qu'un tableau de bord finit par afficher 100 % de couverture sans rien couvrir.
 */
export function applicables(a: Affirmation): Methode[] {
  const out: Methode[] = [];
  const chiffre = typeof a.montantDzd === "number" || (a.cardinalite ?? 0) > 0;
  const calcule = a.obtention === "CALCUL_DETERMINISTE" || a.obtention === "AGREGATION";

  if (calcule) out.push("RECALCUL");
  out.push("SCHEMA");
  if (chiffre && (a.obtention === "AGREGATION" || (a.cardinalite ?? 0) > 1)) out.push("RECONCILIATION");
  if (a.obtention !== "ASSERTION_MODELE") out.push("SOURCE_ALTERNATIVE");
  if (a.obtention === "LECTURE_PAR_MODELE" || a.obtention === "ASSERTION_MODELE") {
    out.push("AUTRE_FORMULATION", "SECOND_MODELE");
  }
  out.push("ADVERSARIAL");
  return out;
}

export interface Programme {
  niveau: Niveau;
  methodes: Methode[];
  /** Les angles morts CUMULÉS du programme retenu — ce que la vérification ne prouvera pas. */
  anglesMorts: string[];
  /** Pourquoi ce programme, en une phrase. */
  justification: string;
  coutTotal: number;
}

/**
 * COMPOSE LE PROGRAMME. Ordonné par pouvoir par unité de coût, tronqué à ce que le niveau exige.
 *
 * `RECALCUL` d'abord quand il s'applique : il est gratuit et c'est la seule méthode qui PROUVE.
 * Un système qui appellerait un second modèle avant d'avoir refait l'addition dépenserait
 * quatre points de coût pour une réponse moins fiable.
 */
export function selectionner(a: Affirmation, niveau: Niveau, indisponibles: readonly Methode[] = []): Programme {
  const exclues = new Set(indisponibles);
  const dispo = applicables(a).filter((m) => !exclues.has(m));
  const combien = EXIGE[niveau];

  const ordre = [...dispo].sort((x, y) => {
    const fx = FICHES[x]; const fy = FICHES[y];
    // Le rapport pouvoir / coût, coût zéro traité comme 0,5 pour ne pas diviser par zéro.
    return (fy.pouvoir / (fy.cout || 0.5)) - (fx.pouvoir / (fx.cout || 0.5));
  });
  const methodes = ordre.slice(0, combien);

  const anglesMorts = [...new Set(methodes.flatMap((m) => FICHES[m].aveugleA))];
  // ET LES ANGLES MORTS DES MÉTHODES QU'ON N'A PAS PRISES comptent aussi : ne pas avoir
  // cherché de source alternative laisse ouvert tout ce qu'elle aurait attrapé.
  const nonRetenues = dispo.filter((m) => !methodes.includes(m));
  for (const m of nonRetenues) anglesMorts.push(`non appliqué — ${m} : ${FICHES[m].attrape[0]} n'a pas été cherché`);

  return {
    niveau, methodes, anglesMorts: [...new Set(anglesMorts)],
    justification: combien === 0
      ? "aucune vérification : le risque calculé ne la justifie pas, et vérifier ce qui n'en a pas besoin dévalue les vérifications qui comptent"
      : `${combien} méthode(s) pour un niveau ${niveau} — ${methodes.map((m) => m.toLowerCase()).join(", ")}`,
    coutTotal: methodes.reduce((s, m) => s + FICHES[m].cout, 0),
  };
}

/** Ce qu'une méthode a donné. `null` = elle n'a pas pu s'exécuter, ce qui n'est PAS un succès. */
export interface Resultat {
  methode: Methode;
  accord: boolean | null;
  /** Ce qui a été constaté, en français. */
  constat: string;
  /** La valeur trouvée par le vérificateur, quand il en produit une. */
  trouve?: string | null;
}

export const ISSUES = ["CONFIRME", "CONTREDIT", "DOUTE", "NON_VERIFIE"] as const;
export type Issue = (typeof ISSUES)[number];

export interface Verdict {
  issue: Issue;
  /** Ce qu'on a le droit de dire à la personne. Calculé, jamais rédigé par un modèle. */
  phrase: string;
  resultats: Resultat[];
  anglesMorts: string[];
  /** Les désaccords, chacun nommé — jamais moyennés (§46). */
  desaccords: string[];
}

/**
 * CONCLUT — et le sens négatif l'emporte TOUJOURS.
 *
 * §118.10 : « le contrôle qualité a le dernier mot dans le sens négatif ». Une méthode
 * concluante qui contredit suffit à contredire, même si quatre autres confirment : un recalcul
 * qui donne un autre chiffre n'est pas une voix parmi cinq, c'est une preuve.
 */
export function conclure(p: Programme, resultats: readonly Resultat[]): Verdict {
  const desaccords = resultats
    .filter((r) => r.accord === false)
    .map((r) => `${r.methode} : ${r.constat}${r.trouve ? ` (trouvé : ${r.trouve})` : ""}`);

  const contradictionProuvee = resultats.some((r) => r.accord === false && FICHES[r.methode].concluantEnEchec);
  const contradictionIndicee = resultats.some((r) => r.accord === false);
  const executees = resultats.filter((r) => r.accord !== null);
  const attendues = p.methodes.length;

  let issue: Issue;
  let phrase: string;
  if (contradictionProuvee) {
    issue = "CONTREDIT";
    phrase = `CONTREDIT — ${desaccords[0]}. Ce n'est pas un avis : la méthode qui l'établit est déterministe.`;
  } else if (contradictionIndicee) {
    issue = "DOUTE";
    phrase = `DOUTEUX — ${desaccords[0]}. Aucune méthode déterministe ne tranche : il faut regarder, pas arbitrer.`;
  } else if (attendues === 0) {
    issue = "NON_VERIFIE";
    phrase = "non vérifié — le risque calculé ne le justifiait pas.";
  } else if (executees.length < attendues) {
    // UNE MÉTHODE QUI N'A PAS PU TOURNER N'EST PAS UNE MÉTHODE QUI A CONFIRMÉ.
    issue = "NON_VERIFIE";
    phrase = `vérification INCOMPLÈTE : ${executees.length} méthode(s) sur ${attendues} ont pu s'exécuter. Ce qui n'a pas tourné ne confirme rien.`;
  } else {
    issue = "CONFIRME";
    phrase = `confirmé par ${executees.length} méthode(s) (${p.methodes.map((m) => m.toLowerCase()).join(", ")}) — ce qui veut dire qu'aucune ne l'a contredit, pas que c'est vrai.`;
  }

  return { issue, phrase, resultats: [...resultats], anglesMorts: p.anglesMorts, desaccords };
}

/** Le sous-ensemble d'un lot à vérifier quand tout vérifier n'a pas de sens. Déterministe. */
export function echantillon(n: number, obtention: Obtention): number[] {
  if (n <= 0) return [];
  if (n <= 5) return Array.from({ length: n }, (_, i) => i);
  // Plus l'obtention est fragile, plus on regarde. Bornes, milieu, et un pas régulier :
  // un tirage « aléatoire » rendrait deux runs incomparables, ce qui interdirait de mesurer.
  const part = POIDS_ECHANTILLON[obtention];
  const combien = Math.max(3, Math.min(n, Math.ceil(n * part)));
  const pas = Math.max(1, Math.floor(n / combien));
  const idx = new Set<number>([0, n - 1]);
  for (let i = 0; i < n && idx.size < combien; i += pas) idx.add(i);
  return [...idx].sort((a, b) => a - b);
}

const POIDS_ECHANTILLON: Readonly<Record<Obtention, number>> = {
  LECTURE_DIRECTE: 0.02,
  CALCUL_DETERMINISTE: 0.05,
  EXTRACTION_STRUCTUREE: 0.1,
  AGREGATION: 0.15,
  LECTURE_PAR_MODELE: 0.25,
  ASSERTION_MODELE: 0.5,
};
