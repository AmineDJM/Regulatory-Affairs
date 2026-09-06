/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA PLANCHE — afficher ce qu'on veut, comme on veut (mandat 7) — pure, sans React ni DOM.
 *
 * ── LA QUESTION QU'IL FAUT SE POSER AVANT D'ÉCRIRE UNE LIGNE ────────────────────────────
 *
 * « Adam affiche ce qu'il veut, comme il veut » a une réponse évidente et catastrophique :
 * laisser le modèle produire du HTML. Elle échoue sur trois points, et le premier suffit.
 *
 *   1. **Le contenu lu est une DONNÉE** (§104.10). Un mail, un PDF, une cellule Excel passent
 *      par le modèle avant d'atteindre l'écran. Si le modèle peut émettre du balisage, alors
 *      une phrase écrite par un tiers dans un document peut en émettre aussi — et le jour où
 *      elle le fait, plus rien ne distingue son balisage du nôtre.
 *   2. Le rendu deviendrait invérifiable : on ne teste pas « le HTML est correct », on teste
 *      « la planche contient un tableau de 34 lignes et un total de 8 200 000 ».
 *   3. Les droits vivent dans les blocs. Un bloc `record` sait quels champs il a le droit de
 *      montrer ; une balise `<div>` ne sait rien.
 *
 * ── CE QUE FAIT CE MODULE À LA PLACE ────────────────────────────────────────────────────
 *
 * Il sépare **la composition** (libre) de **le rendu** (fermé).
 *
 *   · Les FEUILLES sont les blocs qui existent déjà (§35) — `table`, `viz`, `record`,
 *     `timeline`, `progress`… Ils sont validés, permissionnés, testés, et ce module ne les
 *     réécrit pas : il les DÉSIGNE.
 *   · Les CONTENANTS sont un petit jeu fermé — colonnes, lignes, sections, onglets, pile,
 *     accent. Six formes, composables à l'infini.
 *
 * Un arbre de six formes autour de trente feuilles produit un nombre de mises en page qu'aucune
 * bibliothèque de composants n'atteindra jamais — sans qu'une seule chaîne de caractères issue
 * d'un modèle ne devienne du balisage. « Comme il veut » porte sur l'AGENCEMENT, et l'agencement
 * est exactement ce qui manquait.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les six contenants. Fermés, et c'est le point : leur nombre ne grandit pas avec les besoins. */
export const CONTENANTS = [
  /** Côte à côte. Se replie en pile sur téléphone — le code le sait, pas le modèle. */
  "COLONNES",
  /** L'un sous l'autre, dans l'ordre donné. */
  "LIGNES",
  /** Un titre, un corps, éventuellement repliable. La structure du document. */
  "SECTION",
  /** Plusieurs vues du MÊME sujet, une seule visible. C'est là que vivent les « angles ». */
  "ONGLETS",
  /** Un empilement dense, sans titres — pour une série d'indicateurs. */
  "PILE",
  /** Une seule chose, mise en avant. Le chiffre qu'on retient. */
  "ACCENT",
] as const;
export type Contenant = (typeof CONTENANTS)[number];

/** Un nœud de la planche : un contenant avec des enfants, ou une FEUILLE qui désigne un bloc. */
export type Noeud =
  | {
    forme: Contenant;
    /** Le titre du contenant. Du TEXTE, jamais du balisage — il est échappé au rendu. */
    titre?: string | null;
    /** ONGLETS : l'étiquette de chaque enfant, dans l'ordre. */
    etiquettes?: string[];
    /** COLONNES : la largeur relative de chaque enfant (1 = égales). */
    poids?: number[];
    enfants: Noeud[];
  }
  | {
    /** Une feuille : l'INDEX d'un bloc dans la liste fournie. Jamais le bloc lui-même. */
    bloc: number;
  };

/**
 * LES LIMITES, ET POURQUOI ELLES EXISTENT.
 *
 * Un modèle qui se trompe ne produit pas un peu trop : il produit beaucoup trop. Un arbre de
 * dix mille nœuds ne casse pas le rendu, il fige le navigateur — et le figeage ressemble à une
 * panne réseau, donc personne ne cherche du côté de la planche. Les bornes sont donc dures,
 * et un dépassement est REFUSÉ avec sa raison plutôt que tronqué en silence.
 */
export const PROFONDEUR_MAX = 6;
export const NOEUDS_MAX = 120;
export const ENFANTS_MAX = 24;

export const REFUS = [
  "BLOC_INCONNU",
  "PROFONDEUR",
  "TROP_DE_NOEUDS",
  "TROP_D_ENFANTS",
  "CONTENANT_VIDE",
  "FORME_INCONNUE",
  "ETIQUETTES_INCOHERENTES",
  "BLOC_ORPHELIN",
  "BALISAGE",
] as const;
export type MotifRefus = (typeof REFUS)[number];

export interface Probleme {
  motif: MotifRefus;
  /** Où, en toutes lettres : « onglets > colonnes[2] ». Un chemin, pas un index nu. */
  ou: string;
  explication: string;
}

/**
 * LE TEST DE BALISAGE.
 *
 * Il ne sert PAS à assainir — les titres sont échappés au rendu, c'est là que la sécurité se
 * joue. Il sert à DÉTECTER : un titre qui contient une balise est le signe qu'un modèle a cru
 * pouvoir écrire du HTML, ou qu'un contenu injecté a traversé. Dans les deux cas, on veut le
 * savoir plutôt que d'afficher `&lt;script&gt;` proprement et de passer à autre chose.
 */
const BALISE = /<\s*\/?\s*[a-zA-Z][^>]*>|<\s*script|javascript\s*:|on[a-z]+\s*=/i;

export interface Planche {
  racine: Noeud;
  /** Les blocs, dans l'ordre. Les feuilles y renvoient par index. */
  blocs: readonly { kind: string }[];
  /** Ce que la planche montre, en une phrase — pour la voix, le résumé, l'accessibilité. */
  intention?: string | null;
}

export interface Verdict {
  ok: boolean;
  problemes: Probleme[];
  /** Les statistiques de l'arbre — utiles au journal, et au test de non-régression. */
  noeuds: number;
  profondeur: number;
  /** Les blocs qu'AUCUNE feuille ne désigne : produits pour rien, ils encombrent le contexte. */
  blocsOrphelins: number[];
}

const estFeuille = (n: Noeud): n is { bloc: number } => "bloc" in n;

/**
 * COMPILE LA PLANCHE — le même rôle que `compiler/compile.ts` pour les missions (§118.3) :
 * un modèle propose, le code refuse ce qui n'est pas exécutable, et le refus NOMME la faute.
 */
export function compiler(p: Planche, kindsConnus: ReadonlySet<string>): Verdict {
  const problemes: Probleme[] = [];
  const vus = new Set<number>();
  let noeuds = 0;
  let profondeurMax = 0;

  const visiter = (n: Noeud, chemin: string, profondeur: number): void => {
    noeuds += 1;
    profondeurMax = Math.max(profondeurMax, profondeur);
    if (noeuds > NOEUDS_MAX) return; // on arrête de descendre, le refus est déjà posé plus bas

    if (estFeuille(n)) {
      const b = p.blocs[n.bloc];
      if (!b) {
        problemes.push({
          motif: "BLOC_INCONNU", ou: chemin,
          explication: `la feuille renvoie au bloc ${n.bloc}, mais la planche n'en porte que ${p.blocs.length}`,
        });
        return;
      }
      if (!kindsConnus.has(b.kind)) {
        problemes.push({
          motif: "BLOC_INCONNU", ou: chemin,
          explication: `« ${b.kind} » n'est pas un bloc que l'écran sait rendre — la composition est libre, le rendu ne l'est pas`,
        });
      }
      vus.add(n.bloc);
      return;
    }

    if (!(CONTENANTS as readonly string[]).includes(n.forme)) {
      problemes.push({ motif: "FORME_INCONNUE", ou: chemin, explication: `« ${n.forme} » n'est pas un contenant : il y en a six, et leur nombre ne grandit pas` });
      return;
    }
    if (typeof n.titre === "string" && BALISE.test(n.titre)) {
      problemes.push({
        motif: "BALISAGE", ou: chemin,
        explication: "un titre contient du balisage : soit un modèle a cru pouvoir écrire du HTML, soit un contenu injecté a traversé — les deux se refusent",
      });
    }
    if (profondeur >= PROFONDEUR_MAX) {
      problemes.push({ motif: "PROFONDEUR", ou: chemin, explication: `plus de ${PROFONDEUR_MAX} niveaux : au-delà, personne ne lit la structure, on la subit` });
      return;
    }
    if (n.enfants.length === 0) {
      problemes.push({ motif: "CONTENANT_VIDE", ou: chemin, explication: "un contenant sans enfant occupe de la place et ne dit rien" });
      return;
    }
    if (n.enfants.length > ENFANTS_MAX) {
      problemes.push({ motif: "TROP_D_ENFANTS", ou: chemin, explication: `${n.enfants.length} enfants pour un maximum de ${ENFANTS_MAX}` });
    }
    if (n.forme === "ONGLETS") {
      const e = n.etiquettes ?? [];
      if (e.length !== n.enfants.length) {
        problemes.push({
          motif: "ETIQUETTES_INCOHERENTES", ou: chemin,
          explication: `${e.length} étiquette(s) pour ${n.enfants.length} onglet(s) : un onglet sans nom est un onglet qu'on n'ouvre jamais`,
        });
      }
      for (const [i, x] of e.entries()) {
        if (BALISE.test(x)) problemes.push({ motif: "BALISAGE", ou: `${chemin} > étiquette[${i}]`, explication: "une étiquette d'onglet contient du balisage" });
      }
    }
    if (n.forme === "ACCENT" && n.enfants.length !== 1) {
      problemes.push({ motif: "TROP_D_ENFANTS", ou: chemin, explication: "ACCENT met UNE chose en avant : deux accents côte à côte n'accentuent plus rien" });
    }
    if (n.forme === "COLONNES" && n.poids && n.poids.length !== n.enfants.length) {
      problemes.push({ motif: "ETIQUETTES_INCOHERENTES", ou: chemin, explication: `${n.poids.length} poids pour ${n.enfants.length} colonnes` });
    }

    for (const [i, enfant] of n.enfants.entries()) {
      visiter(enfant, `${chemin} > ${n.forme.toLowerCase()}[${i}]`, profondeur + 1);
    }
  };

  visiter(p.racine, "racine", 1);

  if (noeuds > NOEUDS_MAX) {
    problemes.push({
      motif: "TROP_DE_NOEUDS", ou: "racine",
      explication: `${noeuds} nœuds pour un maximum de ${NOEUDS_MAX} : un arbre trop gros ne casse pas le rendu, il fige le navigateur — et un figeage ressemble à une panne réseau`,
    });
  }

  const orphelins = p.blocs.map((_, i) => i).filter((i) => !vus.has(i));
  for (const i of orphelins) {
    problemes.push({
      motif: "BLOC_ORPHELIN", ou: `blocs[${i}]`,
      explication: `le bloc ${i} (${p.blocs[i]!.kind}) n'est placé nulle part : il a coûté un calcul et n'affichera rien`,
    });
  }

  // UN ORPHELIN N'EMPÊCHE PAS D'AFFICHER — c'est un gaspillage, pas une faute de rendu. La
  // distinction compte : refuser la planche entière pour un bloc en trop punirait la personne
  // pour une maladresse du modèle.
  const bloquants = problemes.filter((x) => x.motif !== "BLOC_ORPHELIN");
  return { ok: bloquants.length === 0, problemes, noeuds, profondeur: profondeurMax, blocsOrphelins: orphelins };
}

/**
 * DÉCRIT LA PLANCHE EN UNE PHRASE — pour la voix, le résumé et l'accessibilité.
 *
 * Une planche qui ne sait pas se dire à voix haute n'est pas utilisable au téléphone, et Adam
 * est d'abord un assistant qu'on interroge en marchant. Le texte est CALCULÉ depuis l'arbre :
 * il ne peut donc pas décrire une planche différente de celle qui s'affiche.
 */
export function raconter(p: Planche): string {
  const parts: string[] = [];
  const visiter = (n: Noeud): void => {
    if (estFeuille(n)) { const b = p.blocs[n.bloc]; if (b) parts.push(b.kind); return; }
    if (n.titre) parts.push(`« ${n.titre} »`);
    for (const e of n.enfants) visiter(e);
  };
  visiter(p.racine);
  const compte = new Map<string, number>();
  for (const x of parts) compte.set(x, (compte.get(x) ?? 0) + 1);
  const liste = [...compte].map(([k, n]) => (n > 1 ? `${n} ${k}` : k)).join(", ");
  return `${p.intention ? `${p.intention} — ` : ""}${liste || "planche vide"}`;
}

/**
 * LA PLANCHE DE REPLI : une pile de tous les blocs, dans l'ordre.
 *
 * Elle existe parce qu'un refus de compilation ne doit JAMAIS faire perdre le travail. Les
 * blocs ont coûté des lectures et des calculs ; si l'agencement proposé est invalide, on
 * affiche quand même le contenu, à plat, et on dit que l'agencement a été refusé. Perdre la
 * mise en page est une gêne ; perdre le résultat est une panne.
 */
export function repli(blocs: readonly { kind: string }[], intention?: string | null): Planche {
  return {
    racine: { forme: "LIGNES", enfants: blocs.map((_, i) => ({ bloc: i })) },
    blocs, intention: intention ?? null,
  };
}
