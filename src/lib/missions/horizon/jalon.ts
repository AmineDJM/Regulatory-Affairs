/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE JALON — l'unité qui fait qu'une mission cesse d'être bornée par une fenêtre de contexte.
 *
 * ── LE DÉFAUT QU'IL CORRIGE ─────────────────────────────────────────────────────────────
 *
 * Jusqu'ici, une mission était UN plan compilé d'un coup : le modèle voyait tout l'objectif et
 * rendait toutes les étapes. Ça marche à trente étapes. À trois cents, le plan ne tient plus
 * dans la fenêtre — et bien avant ça, il devient FAUX : le planificateur écrit l'étape 200 en
 * ignorant ce que l'étape 40 aura trouvé, donc il invente ses références. Un plan monolithique
 * de mission longue est un plan qui parie sur trois semaines d'inconnu.
 *
 * Un jalon est une INTENTION : un titre, et le résultat qu'on doit pouvoir constater. Il ne
 * devient des ÉTAPES qu'au moment où sa frontière l'atteint — c'est-à-dire quand ce qui le
 * précède a réellement produit ses résultats. La compilation paresseuse n'est pas une
 * optimisation de coût : c'est ce qui rend le plan du jalon 7 informé par le jalon 6.
 *
 * ── CE QUE CE MODULE EST, ET CE QU'IL N'EST PAS ─────────────────────────────────────────
 *
 * PUR. Aucune base, aucun modèle, aucun temps qui passe. Il répond à quatre questions :
 * quels jalons peuvent partir, lequel est la frontière, où en est-on, et le découpage
 * tient-il debout. Persister, appeler un modèle et compiler appartiennent à `horizon/store.ts`
 * et au pilote — la même séparation qui permet à `compiler/` de refuser un plan sans savoir
 * ce qu'est une base de données.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les états d'un jalon. Un seul mot par situation réelle — pas de statut « en cours de X ». */
export const STATUTS_JALON = ["PENDING", "ACTIVE", "DONE", "SKIPPED", "BLOCKED", "CANCELLED"] as const;
export type StatutJalon = (typeof STATUTS_JALON)[number];

/** Les états dont on ne revient pas dans le cours normal d'une mission. */
export const JALON_TERMINAL: ReadonlySet<StatutJalon> = new Set(["DONE", "SKIPPED", "CANCELLED"]);

/**
 * UN JALON, vu par le raisonnement. Le modèle Prisma en porte davantage (dates, notes, budget) ;
 * ce qui est ici est ce dont les décisions ont besoin, et rien de plus.
 */
export interface Jalon {
  ordre: number;
  titre: string;
  /** Ce qu'on doit pouvoir CONSTATER. Jamais « les étapes ont tourné » (§118.10). */
  resultat: string;
  statut: StatutJalon;
  /** 0 = pas encore compilé en sous-plan — la marque de la compilation paresseuse. */
  planVersion: number;
  /** Les ORDRES des jalons dont celui-ci dépend. */
  dependsOn: readonly number[];
}

/**
 * LES JALONS QUI PEUVENT PARTIR — leurs dépendances sont ABOUTIES.
 *
 * `SKIPPED` libère sa descendance : un jalon écarté (« finalement pas de PowerPoint ») ne
 * retient pas en otage ce qui venait après lui. `CANCELLED` ne la libère PAS : une annulation
 * dit que la branche n'a pas eu lieu, et ce qui en dépendait n'a donc pas ses entrées.
 * Confondre les deux ferait partir un jalon sur des données qui n'existent pas.
 */
const LIBERE: ReadonlySet<StatutJalon> = new Set(["DONE", "SKIPPED"]);

export function dependancesSatisfaites(j: Jalon, tous: readonly Jalon[]): boolean {
  if (j.dependsOn.length === 0) return true;
  const par = new Map(tous.map((x) => [x.ordre, x]));
  return j.dependsOn.every((o) => {
    const amont = par.get(o);
    // UN ORDRE QUI NE DÉSIGNE RIEN NE SATISFAIT RIEN. Le silence d'une dépendance ne se lit pas
    // comme une permission de partir : c'est un découpage incohérent, et `incoherences` le dit.
    return amont ? LIBERE.has(amont.statut) : false;
  });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA FRONTIÈRE D'EXÉCUTION — ce sur quoi la mission travaille MAINTENANT.
 *
 * Ce n'est pas « le prochain jalon » : plusieurs jalons indépendants peuvent avancer ensemble,
 * et les sérialiser transformerait trois collectes parallèles en trois attentes successives.
 * C'est l'ensemble des jalons non terminés dont l'amont est abouti.
 *
 * `aCompiler` est le sous-ensemble qui n'a pas encore de sous-plan (`planVersion === 0`) : c'est
 * exactement la liste des appels de planification que le pilote doit payer, et aucune autre.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface Frontiere {
  /** Les jalons qui peuvent travailler maintenant — compilés ou non. */
  courants: Jalon[];
  /** Ceux, parmi les courants, dont le sous-plan reste à écrire. */
  aCompiler: Jalon[];
  /** Ceux qui attendent encore un amont. Utile pour DIRE pourquoi on n'avance pas. */
  enAttente: Jalon[];
  /** Il ne reste plus rien à faire : tous les jalons sont terminaux. */
  termine: boolean;
}

export function frontiere(tous: readonly Jalon[]): Frontiere {
  const vivants = tous.filter((j) => !JALON_TERMINAL.has(j.statut) && j.statut !== "BLOCKED");
  const courants = vivants.filter((j) => dependancesSatisfaites(j, tous));
  const enAttente = vivants.filter((j) => !dependancesSatisfaites(j, tous));
  return {
    courants,
    aCompiler: courants.filter((j) => j.planVersion === 0),
    enAttente,
    // BLOQUÉ N'EST PAS TERMINÉ. Un jalon bloqué garde une chance : un humain répond, une
    // source revient, un replan local le reprend. Le compter comme fini conclurait la mission
    // sur une branche qui n'a jamais produit son résultat — le faux succès de §118.10.
    termine: tous.length > 0 && tous.every((j) => JALON_TERMINAL.has(j.statut)),
  };
}

/**
 * OÙ EN EST-ON — le chiffre que l'écran montre et que le compte rendu dit.
 *
 * `bloques` est compté à part de `restants` : « 3 sur 8, 1 bloqué » et « 3 sur 8 » ne décrivent
 * pas la même mission, et l'agrégat cacherait précisément ce qu'il faut regarder.
 */
export interface Avancement {
  total: number;
  aboutis: number;
  ecartes: number;
  bloques: number;
  annules: number;
  restants: number;
  /** Entre 0 et 1, sur les jalons qui comptent (les annulés sortent du dénominateur). */
  part: number;
}

export function avancement(tous: readonly Jalon[]): Avancement {
  const compte = (s: StatutJalon) => tous.filter((j) => j.statut === s).length;
  const annules = compte("CANCELLED");
  const denominateur = Math.max(0, tous.length - annules);
  const aboutis = compte("DONE");
  const ecartes = compte("SKIPPED");
  return {
    total: tous.length,
    aboutis,
    ecartes,
    bloques: compte("BLOCKED"),
    annules,
    restants: denominateur - aboutis - ecartes,
    part: denominateur === 0 ? 0 : (aboutis + ecartes) / denominateur,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE DÉCOUPAGE TIENT-IL DEBOUT — refusé AVANT d'être persisté, comme un plan.
 *
 * Un découpage vient d'un modèle : c'est une proposition faillible (§118 : « les modèles
 * décident QUOI »). Trois fautes le rendent inexécutable, et chacune est silencieuse si on ne
 * la cherche pas :
 *
 *   • un CYCLE — le jalon 3 attend le 5 qui attend le 3. Aucun ne partira jamais, et la
 *     mission dormira sans qu'aucune étape n'ait échoué : le blocage le plus difficile à lire.
 *   • une DÉPENDANCE MORTE — « dépend du jalon 9 » quand il n'y en a que sept.
 *   • un RANG EN DOUBLE — deux jalons « 3 », donc une dépendance qui en désigne deux.
 *
 * On refuse aussi un jalon sans résultat constatable : sans lui, le contrôle de fin n'a rien à
 * comparer au réel et retombe sur « les étapes ont tourné » — exactement ce que §118.10
 * interdit. La forme du refus est celle du compilateur : on dit TOUT ce qu'on sait en une fois
 * (§118.18), jamais une objection par tour.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface IncoherenceJalon {
  code: "CYCLE" | "DEPENDANCE_MORTE" | "RANG_DOUBLE" | "RESULTAT_ABSENT" | "VIDE";
  ordre: number | null;
  message: string;
}

export function incoherences(tous: readonly Jalon[]): IncoherenceJalon[] {
  const out: IncoherenceJalon[] = [];
  if (tous.length === 0) {
    return [{ code: "VIDE", ordre: null, message: "Le découpage ne contient aucun jalon." }];
  }

  const vus = new Map<number, number>();
  for (const j of tous) vus.set(j.ordre, (vus.get(j.ordre) ?? 0) + 1);
  for (const [ordre, n] of vus) {
    if (n > 1) {
      out.push({
        code: "RANG_DOUBLE", ordre,
        message: `Le rang ${ordre} est porté par ${n} jalons : une dépendance vers ${ordre} en désignerait deux.`,
      });
    }
  }

  for (const j of tous) {
    if (!j.resultat.trim()) {
      out.push({
        code: "RESULTAT_ABSENT", ordre: j.ordre,
        message: `Le jalon ${j.ordre} (« ${j.titre} ») ne dit pas ce qu'on doit pouvoir constater quand il est atteint : `
          + `sans ce résultat, sa fin ne peut être que « les étapes ont tourné ».`,
      });
    }
    for (const d of j.dependsOn) {
      if (d === j.ordre) {
        out.push({ code: "CYCLE", ordre: j.ordre, message: `Le jalon ${j.ordre} dépend de lui-même.` });
      } else if (!vus.has(d)) {
        out.push({
          code: "DEPENDANCE_MORTE", ordre: j.ordre,
          message: `Le jalon ${j.ordre} dépend du jalon ${d}, qui n'existe pas dans ce découpage.`,
        });
      }
    }
  }

  for (const cycle of cycles(tous)) {
    out.push({
      code: "CYCLE", ordre: cycle[0] ?? null,
      message: `Cycle entre les jalons ${cycle.join(" → ")} → ${cycle[0]} : aucun ne pourra jamais partir.`,
    });
  }
  return out;
}

/** Les cycles du graphe de jalons, en profondeur — chacun rendu UNE fois, par son plus petit rang. */
function cycles(tous: readonly Jalon[]): number[][] {
  const par = new Map(tous.map((j) => [j.ordre, j]));
  const etat = new Map<number, 0 | 1 | 2>();
  const pile: number[] = [];
  const trouves: number[][] = [];
  const vus = new Set<string>();

  const visiter = (ordre: number): void => {
    const marque = etat.get(ordre) ?? 0;
    if (marque === 2) return;
    if (marque === 1) {
      const debut = pile.indexOf(ordre);
      if (debut >= 0) {
        const boucle = pile.slice(debut);
        // On NORMALISE la boucle sur son plus petit rang : le même cycle atteint par deux
        // chemins différents produirait sinon deux messages qui décrivent la même chose.
        const pivot = boucle.indexOf(Math.min(...boucle));
        const normalisee = [...boucle.slice(pivot), ...boucle.slice(0, pivot)];
        const cle = normalisee.join(">");
        if (!vus.has(cle)) { vus.add(cle); trouves.push(normalisee); }
      }
      return;
    }
    etat.set(ordre, 1);
    pile.push(ordre);
    for (const d of par.get(ordre)?.dependsOn ?? []) if (par.has(d)) visiter(d);
    pile.pop();
    etat.set(ordre, 2);
  };

  for (const j of tous) visiter(j.ordre);
  return trouves;
}
