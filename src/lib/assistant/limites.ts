/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES LIMITES DITES JUSTE (mandat 5 §34) — pur, sans import.
 *
 * Deux règles que le code tient à la place du prompt :
 *
 *   1. LA DÉCOUVERTE AVANT L'IMPOSSIBLE. Quand le modèle conclut « je ne peux pas / je n'ai pas
 *      d'outil » sans avoir appelé UN SEUL outil, le serveur ne prend pas sa parole : il lui remet la
 *      carte complète des capacités ouvertes (`list_more_tools`, exécutée côté serveur) et exige un
 *      second essai. Une fois. Si le refus tient encore, il est accepté — mais il doit alors dire sa
 *      LIMITE (règle 2), jamais « ce n'est pas codé ».
 *
 *   2. UNE LIMITE A UNE NATURE. Permission (un droit qui manque), ressource (python3 absent, clé de
 *      fournisseur non configurée, pièce sans texte), donnée (rien dans la base pour répondre), ou
 *      capacité (aucune brique ne fait cela). « Pas prévu », « pas codé », « pas dans mes fonctions »
 *      ne sont pas des natures : ce sont des aveux paresseux qui cachent l'une des quatre. Le
 *      classement sert la réponse (dire la bonne chose), le journal (compter les vraies lacunes de
 *      capacité — §44) et le banc.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type NatureLimite = "PERMISSION" | "RESSOURCE" | "DONNEE" | "CAPACITE";
export type VerdictImpossibilite = "RAS" | "REDECOUVRIR" | "ACCEPTER";

const plier = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Le modèle DIT qu'il ne peut pas — sans nuance de droit ou de donnée. */
const REFUS_CAPACITE = [
  /\bje ne (?:peux|suis) pas (?:en mesure de |capable de )?(?:faire|executer|lancer|calculer|generer|produire|creer|modifier|ouvrir|lire|acceder|consulter|envoyer|programmer|surveiller)/,
  /\bje n'ai pas (?:d'|de |l')?(?:outil|fonction|capacite|acces|moyen|possibilite)/,
  /\bpas (?:d'|de )?(?:outil|fonction|fonctionnalite|capacite) (?:pour|permettant|qui)/,
  /\b(?:ce n'est pas|cela n'est pas|c'est) (?:possible|prevu|pris en charge|dans mes (?:fonctions|capacites|attributions|competences))/,
  /\bhors de (?:mes|mon) (?:capacites|competences|perimetre|champ)/,
  /\bje ne (?:dispose|sais) pas (?:de |d')?(?:outil|comment|faire)/,
  /\bimpossible (?:pour moi|de (?:faire|calculer|generer|lancer|executer))/,
  /\bn'est pas (?:code|implemente|programme|disponible dans (?:l'erp|adam|le systeme))/,
];

/** Une limite déjà DITE avec sa nature : le refus est honnête, on ne le rejoue pas. */
const LIMITE_NOMMEE = [
  /\b(?:droit|permission|habilitation|autorisation|module)\b[^.]{0,60}\b(?:manque|manquant|requis|necessaire|ne vous est pas ouvert|refuse)/,
  /\bne vous est pas ouvert/,
  /\bpython3? (?:est |n'est pas |)(?:indisponible|absent)/,
  /\b(?:cle|clef|fournisseur|service|connexion)\b[^.]{0,40}\b(?:non configure|indisponible|absent|manquant)/,
  /\baucun(?:e)? (?:donnee|enregistrement|ligne|resultat|trace|fiche|document)\b/,
  /\brien (?:dans la base|d'enregistre|n'est enregistre)/,
];

export interface EntreeGarde {
  question: string;
  reponse: string;
  outilsUtilises: readonly string[];
  /** Les outils ouverts à la personne — la carte complète, droits déjà appliqués. */
  outilsDisponibles: readonly string[];
  dejaRedecouvert: boolean;
}

/** Le refus PARAÎT-IL une impossibilité de capacité (et non une limite nommée) ? */
export function paraitImpossibilite(reponse: string): boolean {
  const t = plier(reponse);
  if (!REFUS_CAPACITE.some((r) => r.test(t))) return false;
  return !LIMITE_NOMMEE.some((r) => r.test(t));
}

/**
 * LA GARDE : « impossible » sans avoir rien essayé → redécouvrir une fois ; après redécouverte, le
 * refus est accepté (le modèle a vu la carte). Un refus qui nomme déjà sa limite n'est pas rejoué.
 */
export function gardeImpossibilite(e: EntreeGarde): VerdictImpossibilite {
  if (e.outilsUtilises.length > 0) return "RAS";
  if (e.outilsDisponibles.length === 0) return "RAS";
  if (!paraitImpossibilite(e.reponse)) return "RAS";
  if (e.dejaRedecouvert) return "ACCEPTER";
  return "REDECOUVRIR";
}

/** Le rappel injecté au modèle — un tour de plus, avec la carte complète, pas une prière de prompt. */
export const RAPPEL_DECOUVERTE =
  "CONTRÔLE DU SERVEUR : tu viens de répondre « impossible » sans avoir appelé un seul outil. La liste courte que tu "
  + "avais reçue n'est PAS l'étendue de tes capacités : voici la carte complète de ce qui est ouvert à cette personne "
  + "(ci-dessous). Réessaie MAINTENANT avec l'outil qui convient — un calcul se fait avec `run_analysis` ou `run_code`, "
  + "une lecture avec l'outil canonique du domaine, une action avec l'outil d'écriture, une tâche longue avec `launch_mission`. "
  + "Si, la carte lue, rien ne répond vraiment, dis alors la NATURE de la limite — un droit qui manque, une ressource absente, "
  + "une donnée qui n'existe pas, ou une capacité qui n'existe pas — jamais « ce n'est pas prévu ».";

export interface Limite { nature: NatureLimite; precise: boolean; motif: string }

/** CLASSER une phrase de limite : sa nature, et si elle est dite avec précision. */
export function classerLimite(reponse: string): Limite | null {
  const t = plier(reponse);
  if (/\b(?:droit|permission|habilitation|autorisation)\b|ne vous est pas ouvert|reserve (?:a|aux) |hors de votre perimetre/.test(t)) {
    return { nature: "PERMISSION", precise: /\b(?:module|droit|permission)\b[^.]{0,40}\b[A-Z_]{3,}|(?:finances?|rh|budgets?|drive|regulatory|legal|paie|salaires?)\b/.test(t) || /ne vous est pas ouvert/.test(t), motif: "un droit manque" };
  }
  if (/\bpython3?\b[^.]{0,30}\b(?:indisponible|absent)|\b(?:cle|clef|fournisseur|service|connexion|serveur)\b[^.]{0,40}\b(?:non configure|indisponible|absent|manquant|injoignable)|\bsans texte\b|\billisible\b/.test(t)) {
    return { nature: "RESSOURCE", precise: /\bpython|\bcle\b|\bfournisseur\b|\bconnexion\b|\bsans texte\b|\billisible\b/.test(t), motif: "une ressource manque sur ce serveur ou cette pièce" };
  }
  // Une capacité NOMMÉE comme absente (« aucun outil ne permet… ») se lit avant la donnée absente :
  // « une capacité qui n'existe pas dans l'ERP » parle de la brique, pas d'un enregistrement.
  if (/\baucun(?:e)? (?:outil|brique|capacite|fonction(?:nalite)?)\b[^.]{0,80}\b(?:pour|permet|permettant|qui|ne)\b/.test(t)) {
    return { nature: "CAPACITE", precise: true, motif: "aucune capacité ne fait cela" };
  }
  if (/\baucun(?:e)? (?:donnee|enregistrement|ligne|resultat|trace|fiche|document|reunion|tache|paiement)\b|\brien (?:dans la base|d'enregistre|n'est enregistre)|\b(?:donnee|enregistrement|fiche|dossier|ligne|reference)\b[^.]{0,40}\bn'existe pas/.test(t)) {
    return { nature: "DONNEE", precise: true, motif: "la donnée n'existe pas" };
  }
  if (REFUS_CAPACITE.some((r) => r.test(t))) {
    const paresseux = /\b(?:pas (?:prevu|code|implemente|programme)|dans mes (?:fonctions|capacites|attributions|competences))\b/.test(t);
    return { nature: "CAPACITE", precise: !paresseux && /\baucun(?:e)? (?:outil|brique|capacite)\b[^.]{0,80}\b(?:pour|permettant|qui)\b/.test(t), motif: paresseux ? "« pas prévu » cache la vraie nature de la limite" : "aucune capacité ne fait cela" };
  }
  return null;
}

/** La phrase que le serveur ajoute quand un refus accepté reste imprécis — dire la nature plutôt que le rien. */
export function complementDeLimite(reponse: string, outilsDisponibles: number): string | null {
  const l = classerLimite(reponse);
  if (!l || l.precise) return null;
  if (l.nature === "CAPACITE") {
    return `Précision du serveur : la carte complète (${outilsDisponibles} capacités ouvertes) a été relue avant cette réponse ; si une capacité manque réellement, elle est notée comme lacune à combler, pas comme un « non prévu ».`;
  }
  return null;
}
