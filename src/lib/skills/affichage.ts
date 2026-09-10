/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE CAPACITÉ QU'ON N'A PAS ÉCRITE PEUT S'AFFICHER — module PUR, sans un seul import.
 *
 * ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * L'espace de travail traduit une sortie d'outil en blocs typés. Sa table est FERMÉE, et elle
 * a raison de l'être : un affichage capable de tout montrer finit par tout montrer — six lignes
 * de salaire sont arrivées à l'écran en réponse à « Bonsoir, ça va ? ». Mais cette table nomme
 * des outils ÉCRITS DANS LE CŒUR (cinq entrées), et une capacité DYNAMIQUE n'y figurera jamais :
 * un connecteur déclaré par manifeste, un micro-outil qu'Adam vient de créer, un playbook
 * enseigné. Recensé : treize capacités déclarées dans `lib/skills/plugins/` — dont
 * `hubspot_search_contacts` (`cles: ["results"]`) et `pch_appels_d_offres` (`cles: ["items"]`),
 * deux LISTES — plus tout micro-outil et tout playbook, et ZÉRO chemin vers un bloc.
 * L'écran rendait donc `null`, en silence, sur exactement les capacités que §36 existe pour
 * rendre possibles. Et il n'y a AUCUN endroit où aller ajouter l'entrée manquante : c'est ce
 * qui rend un runtime de skills extensible (§118.58).
 *
 * Cas particulièrement net : un PLAYBOOK compose des lectures CANONIQUES dont chacune, appelée
 * seule, composait un tableau. Passées par le playbook, leurs compositions sont jetées et la
 * sortie du playbook n'affiche rien — enseigner un workflow à Adam lui FAISAIT PERDRE l'écran
 * que ses propres étapes avaient.
 *
 * ── CE QU'ON NE FAIT PAS ────────────────────────────────────────────────────────────────
 *
 * On n'ouvre pas l'inférence aveugle : « toute sortie contenant une liste devient un tableau »
 * est le vidage qu'on interdit. Ce qui autorise l'affichage est une DÉCLARATION, comme pour
 * `_blocs` — sauf qu'ici la déclaration existe déjà et ne coûte rien : `sorties.cles` du
 * manifeste. Le skill dit quelles clés il rend ; le code regarde si l'une d'elles porte des
 * lignes. Rien de deviné, rien d'inventé.
 *
 * ── LE PARTAGE DES RÔLES, ET POURQUOI IL EST DANS CE SENS ───────────────────────────────
 *
 * Ce module LIT (il a le manifeste et la sortie) et rend un CHEMIN. Il ne construit pas le
 * tableau : `tableFromRows` existe déjà, il choisit les colonnes que partage la majorité des
 * lignes, écarte la plomberie et garde le lien cliquable. En recopier la logique ici en ferait
 * une seconde vérité qui divergerait au premier correctif (§118.5). Chacun fait ce que lui
 * seul peut faire : le runtime des skills sait ce que la capacité a promis, l'espace de travail
 * sait dessiner.
 *
 * ── ET QUAND ON NE PEUT PAS ─────────────────────────────────────────────────────────────
 *
 * Des lignes existent, aucune clé déclarée ne les nomme : on ne devine pas la clé — mais on ne
 * se taît pas non plus. `manque` porte la phrase que le modèle lira, avec le geste EXACT qui la
 * lève (§118.19, §118.26). Sans elle, Adam répondrait « je ne peux pas afficher de tableau »,
 * c'est-à-dire l'impossibilité artificielle exacte que ce chemin existe pour fermer.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Où sont les lignes d'une capacité dynamique, et sous quel titre les montrer. */
export interface DeclarationLignes {
  /** Le titre HUMAIN du bloc — celui du manifeste, jamais l'identifiant technique de l'outil. */
  titre: string;
  /** Le chemin dans la sortie, en clés séparées par des points : « resultat », « resultat.items ». */
  chemin: string;
}

export interface Affichage {
  /** La déclaration à joindre à la sortie, ou `null` quand il n'y a rien à montrer. */
  lignes: DeclarationLignes | null;
  /**
   * La phrase à joindre quand des lignes EXISTENT et qu'aucune clé déclarée ne les nomme.
   * `null` dans tous les autres cas — une réserve permanente devient du bruit (§118.32).
   */
  manque: string | null;
}

const RIEN: Affichage = { lignes: null, manque: null };

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * DEUX LIGNES AU MINIMUM, et ce n'est pas un réglage : `tableFromRows` refuse en dessous, et
 * une capacité qui rend UN objet rend une fiche, pas un tableau. Compter ici ce qu'il compte
 * là-bas évite de déclarer un chemin que l'écran écartera ensuite en silence.
 */
const compterLignes = (v: unknown): number => (Array.isArray(v) ? v.filter(estObjet).length : 0);

/**
 * LA PREMIÈRE CLÉ, SOUS N'IMPORTE QUELLE PROFONDEUR, QUI PORTE DES LIGNES — sans les chercher.
 * On ne descend pas dans l'objet : `resultat` et `resultat.<clé déclarée>` sont les deux seuls
 * endroits regardés. Fouiller l'arbre trouverait la liste des `journal` d'un playbook ou les
 * `etapes` d'une porte de qualité — de la comptabilité de moteur présentée comme un résultat.
 */
export function lignesDeclarees(args: {
  /** Le titre du manifeste (`m.titre`) — ce que la personne lira en tête du tableau. */
  titre: string;
  /** `sorties.cles` du manifeste. Vide ou absent : la capacité n'a nommé aucune clé. */
  clesDeclarees?: readonly string[];
  /** L'objet rendu par l'exécuteur : `{ ok, resultat, … }`. */
  sortie: unknown;
}): Affichage {
  const titre = args.titre.trim();
  if (!titre) return RIEN;
  if (!estObjet(args.sortie)) return RIEN;
  // Un échec annoncé n'affiche rien : ce qu'il porte est un motif, pas un résultat — même
  // règle que le contrat de sortie, qui ne vérifie que le cas PLEIN.
  if (args.sortie.ok === false) return RIEN;

  const r = args.sortie.resultat;

  // LE RÉSULTAT EST LUI-MÊME LA LISTE. Aucune clé à nommer : il n'y a pas d'ambiguïté sur ce
  // qu'il faut montrer, et la capacité a bien déclaré rendre quelque chose (`sorties.description`
  // est obligatoire dans tout manifeste). C'est le cas d'un playbook dont la dernière étape
  // rend des lignes.
  if (compterLignes(r) >= 2) return { lignes: { titre, chemin: "resultat" }, manque: null };

  if (!estObjet(r)) return RIEN;

  const declarees = (args.clesDeclarees ?? []).map((c) => c.trim()).filter(Boolean);
  for (const cle of declarees) {
    if (compterLignes(r[cle]) >= 2) return { lignes: { titre, chemin: `resultat.${cle}` }, manque: null };
  }

  // DES LIGNES SONT LÀ, AUCUNE CLÉ DÉCLARÉE NE LES NOMME. On ne choisit pas la clé à la place
  // de l'auteur du skill — deux listes voisines afficheraient la mauvaise — mais on DIT ce qui
  // manque et le geste qui le lève. La phrase est destinée au modèle : elle lui permet de dire
  // la vérité (« je l'ai, je ne peux pas l'afficher, voici pourquoi ») au lieu de conclure à
  // une impossibilité.
  const porteuses = Object.keys(r).filter((k) => compterLignes(r[k]) >= 2);
  if (porteuses.length === 0) return RIEN;
  return {
    lignes: null,
    manque:
      `⚠️ AFFICHAGE IMPOSSIBLE pour « ${titre} » : ce résultat porte des lignes sous `
      + `${porteuses.map((k) => `« ${k} »`).join(", ")}, mais le manifeste ${declarees.length ? `déclare ${declarees.map((k) => `« ${k} »`).join(", ")}` : "ne déclare aucune clé de sortie"}. `
      + "Les données SONT là — la limite est la déclaration, pas la capacité. Pour un tableau à l'écran, "
      + `« sorties.cles » du manifeste doit nommer ${porteuses.length === 1 ? `« ${porteuses[0]} »` : "la clé qui porte les lignes"}.`,
  };
}

/**
 * LIRE LE CHEMIN qu'on vient de déclarer. Vit ICI, à côté de celui qui l'écrit : deux lectures
 * du même chemin dans deux fichiers finiraient par ne plus dire la même chose, et le symptôme
 * serait un tableau vide sans aucune cause visible.
 */
export function suivreChemin(data: unknown, chemin: string): unknown {
  let v: unknown = data;
  for (const cle of chemin.split(".")) {
    if (!estObjet(v)) return undefined;
    v = v[cle];
  }
  return v;
}
