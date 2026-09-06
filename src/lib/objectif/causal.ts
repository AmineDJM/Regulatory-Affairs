/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES DÉPENDANCES CAUSALES (mandat 6 §47) — pures, et honnêtes sur ce qu'elles ne prouvent pas.
 *
 * ── « RETARD REGULATORY → PACKAGING → LANCEMENT → AO → CA » ─────────────────────────────
 *
 * Cette chaîne est utile et elle n'est pas démontrée. Chaque flèche est une HYPOTHÈSE que
 * quelqu'un a posée, avec plus ou moins de raisons de la croire. Un moteur qui traiterait ces
 * flèches comme des lois physiques produirait des impacts chiffrés au dinar près à partir de
 * suppositions — la façon la plus efficace de rendre une intuition incontestable.
 *
 * D'où : chaque lien porte sa CONFIANCE, son HYPOTHÈSE en toutes lettres, et ses PREUVES. Et la
 * propagation MULTIPLIE les confiances : un impact à trois flèches de distance, chacune crue à
 * 0,7, arrive avec une confiance de 0,34 — et c'est cette valeur-là qu'il faut regarder avant
 * l'ampleur de l'effet.
 *
 * ── CORRÉLATION N'EST PAS CAUSE, ET LE CODE LE TIENT ────────────────────────────────────
 *
 * Un lien sans aucune preuve reste utilisable — on ne va pas effacer ce qu'une personne sait —
 * mais il est marqué `SUPPOSE`, sa confiance est plafonnée, et la propagation le signale. Un
 * chemin qui traverse une seule supposition ne peut pas être présenté comme établi.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const DIRECTIONS = ["RENFORCE", "FREINE"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const FONDEMENTS = ["OBSERVE", "DEDUIT", "SUPPOSE"] as const;
export type Fondement = (typeof FONDEMENTS)[number];

export interface Lien {
  de: string;
  vers: string;
  direction: Direction;
  /**
   * L'INTENSITÉ : de combien `vers` bouge quand `de` bouge d'une unité. Entre 0 et 1.
   * Ce n'est pas un coefficient estimé : c'est une appréciation, et elle est traitée comme telle.
   */
  intensite: number;
  /** 0 à 1 — à quel point on croit ce lien. */
  confiance: number;
  /** L'hypothèse, en toutes lettres : « si le dossier glisse, le packaging ne peut pas démarrer ». */
  hypothese: string;
  preuves: string[];
}

/** Un lien sans preuve est SUPPOSÉ, et sa confiance est plafonnée — le code ne l'oublie pas. */
export const PLAFOND_SUPPOSE = 0.5;

export function fondement(l: Lien): Fondement {
  if (l.preuves.length >= 2) return "OBSERVE";
  if (l.preuves.length === 1) return "DEDUIT";
  return "SUPPOSE";
}

export function confianceEffective(l: Lien): number {
  const f = fondement(l);
  return f === "SUPPOSE" ? Math.min(l.confiance, PLAFOND_SUPPOSE) : l.confiance;
}

export interface Impact {
  noeud: string;
  /** L'effet, signé. Négatif = dégradé. C'est un ORDRE DE GRANDEUR, pas une prévision. */
  effet: number;
  /** Le produit des confiances le long du chemin — à regarder AVANT l'effet. */
  confiance: number;
  /** Le chemin parcouru, pour qu'on puisse contester une flèche et pas la conclusion. */
  chemin: string[];
  /** Vrai si le chemin traverse au moins une flèche SUPPOSÉE. */
  traverseUneSupposition: boolean;
}

/**
 * PROPAGE UN CHOC dans le graphe causal — la base de « que se passe-t-il si X change ? ».
 *
 * On propage en largeur, en multipliant l'effet par l'intensité et la confiance par la confiance
 * effective. Deux garde-fous : la profondeur est bornée (au-delà, l'enchaînement d'hypothèses ne
 * dit plus rien), et un nœud déjà atteint par un chemin PLUS SÛR n'est pas réécrit par un chemin
 * plus long — sinon la dernière branche explorée gagnerait, ce qui n'a aucun sens.
 */
export function propager(
  liens: readonly Lien[],
  choc: { noeud: string; ampleur: number },
  options: { profondeurMax?: number; confianceMin?: number } = {},
): Impact[] {
  const profondeurMax = options.profondeurMax ?? 5;
  const confianceMin = options.confianceMin ?? 0.05;
  const sortants = new Map<string, Lien[]>();
  for (const l of liens) sortants.set(l.de, [...(sortants.get(l.de) ?? []), l]);

  const atteints = new Map<string, Impact>();
  let front: Impact[] = [{ noeud: choc.noeud, effet: choc.ampleur, confiance: 1, chemin: [choc.noeud], traverseUneSupposition: false }];

  for (let d = 0; d < profondeurMax && front.length; d += 1) {
    const suivant: Impact[] = [];
    for (const courant of front) {
      for (const l of sortants.get(courant.noeud) ?? []) {
        // UN CYCLE NE SE PROPAGE PAS À L'INFINI : un nœud déjà sur le chemin est ignoré.
        if (courant.chemin.includes(l.vers)) continue;
        const ce = confianceEffective(l);
        const confiance = courant.confiance * ce;
        if (confiance < confianceMin) continue;
        const effet = courant.effet * l.intensite * (l.direction === "FREINE" ? -1 : 1);
        const impact: Impact = {
          noeud: l.vers, effet, confiance,
          chemin: [...courant.chemin, l.vers],
          traverseUneSupposition: courant.traverseUneSupposition || fondement(l) === "SUPPOSE",
        };
        const deja = atteints.get(l.vers);
        // LE CHEMIN LE PLUS SÛR GAGNE, pas le dernier exploré.
        if (!deja || impact.confiance > deja.confiance) atteints.set(l.vers, impact);
        suivant.push(impact);
      }
    }
    front = suivant;
  }

  return [...atteints.values()].sort((a, b) => Math.abs(b.effet) - Math.abs(a.effet));
}

/** Tous les chemins causaux entre deux nœuds — pour contester UNE flèche, pas la conclusion. */
export function chemins(liens: readonly Lien[], de: string, vers: string, profondeurMax = 6): { chemin: string[]; confiance: number; liens: Lien[] }[] {
  const sortants = new Map<string, Lien[]>();
  for (const l of liens) sortants.set(l.de, [...(sortants.get(l.de) ?? []), l]);
  const out: { chemin: string[]; confiance: number; liens: Lien[] }[] = [];

  const marcher = (noeud: string, chemin: string[], parcourus: Lien[], confiance: number) => {
    if (chemin.length > profondeurMax) return;
    if (noeud === vers && chemin.length > 1) { out.push({ chemin: [...chemin], confiance, liens: [...parcourus] }); return; }
    for (const l of sortants.get(noeud) ?? []) {
      if (chemin.includes(l.vers)) continue;
      marcher(l.vers, [...chemin, l.vers], [...parcourus, l], confiance * confianceEffective(l));
    }
  };
  marcher(de, [de], [], 1);
  return out.sort((a, b) => b.confiance - a.confiance);
}

/**
 * LES DÉFAUTS DU MODÈLE CAUSAL — parce qu'un graphe d'hypothèses se dégrade en silence.
 *
 * Un cycle causal n'est pas forcément une faute (une boucle de rétroaction existe), mais il doit
 * être VU : propagé naïvement, il produirait un effet infini. Une flèche sans hypothèse écrite
 * est, elle, une faute franche : personne ne pourra jamais la contester.
 */
export function auditer(liens: readonly Lien[]): { cycles: string[][]; sansHypothese: Lien[]; suppositions: Lien[]; noeuds: string[] } {
  const noeuds = [...new Set(liens.flatMap((l) => [l.de, l.vers]))].sort();
  const sortants = new Map<string, Lien[]>();
  for (const l of liens) sortants.set(l.de, [...(sortants.get(l.de) ?? []), l]);

  const cycles: string[][] = [];
  const etat = new Map<string, 0 | 1 | 2>();
  const pile: string[] = [];
  const visiter = (n: string) => {
    if (etat.get(n) === 2) return;
    if (etat.get(n) === 1) { cycles.push([...pile.slice(pile.indexOf(n)), n]); return; }
    etat.set(n, 1); pile.push(n);
    for (const l of sortants.get(n) ?? []) visiter(l.vers);
    pile.pop(); etat.set(n, 2);
  };
  for (const n of noeuds) visiter(n);

  return {
    cycles,
    sansHypothese: liens.filter((l) => !l.hypothese.trim()),
    suppositions: liens.filter((l) => fondement(l) === "SUPPOSE"),
    noeuds,
  };
}

/** La chaîne racontée : « retard Regulatory → freine packaging → freine lancement (confiance 0,34) ». */
export function raconterChemin(c: { chemin: string[]; confiance: number; liens: Lien[] }): string {
  const morceaux = c.liens.map((l, i) => `${i === 0 ? l.de : ""} ${l.direction === "FREINE" ? "freine" : "renforce"} ${l.vers}`.trim());
  const suppose = c.liens.some((l) => fondement(l) === "SUPPOSE");
  return `${morceaux.join(" → ")} (confiance ${c.confiance.toFixed(2)}${suppose ? ", passe par une hypothèse NON étayée" : ""})`;
}
