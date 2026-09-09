/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUI NE PEUT PLUS AVANCER — l'impasse, nommée par le graphe et non par le temps.
 *
 * ── LE DÉFAUT, MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * Mission `cmtta95k1…`, banc réel, mission à jalons. Le planificateur écrit
 * `recipientName: "Équipe Regulatory"` — une ÉQUIPE, pas une personne. `send_message` refuse,
 * à juste titre (§118.34 : une liste de plusieurs ne désigne personne). Deux étapes en échec
 * DÉFINITIF, onze étapes derrière elles qui n'ont plus aucun chemin vers l'exécution.
 *
 * La mission, elle, l'a bien vu : `deduireEtat` a rendu BLOCKED et l'a DIT. Mais le jalon,
 * lui, ne se ferme que si aucune de ses étapes n'est « encore en cours » — et onze étapes
 * PENDING derrière un mur comptaient comme du travail à venir. Le jalon est resté ACTIVE pour
 * toujours, `reprendreJalonsBloques` ne l'a jamais vu, et la reprise de jalon (§118.47) —
 * écrite, testée — n'a jamais pu se déclencher. Cinq passages du battement, zéro replan, zéro
 * explication : dix-sept étapes mortes sur un nom de destinataire.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────
 *
 * Une étape est en IMPASSE quand plus aucune exécution ne peut la faire aboutir. Deux sources,
 * et une seule se propage :
 *
 *   — la SOURCE : un échec définitif (toutes les tentatives épuisées) ou une annulation ;
 *   — la CONTAGION : une étape dont une dépendance est en impasse est en impasse.
 *
 * Ce n'est PAS une histoire de temps qui passe. Une étape WAITING n'est jamais en impasse par
 * elle-même — un événement peut encore la réveiller, et la déclarer morte fermerait une mission
 * que sa réponse attendue allait débloquer. Une étape SKIPPED n'est pas non plus une impasse :
 * elle est terminée, et ses descendantes partent (§37). Confondre « ignorée » et « morte » ferait
 * mourir toute la suite d'une branche que le plan a délibérément écartée.
 *
 * ── POURQUOI PUR, ET POURQUOI SÉPARÉ DE `deduireEtat` ────────────────────────────────────
 *
 * `deduireEtat` répond « dans quel état est la MISSION ? » sur un simple comptage — il n'a
 * jamais eu besoin du graphe. La question d'ici est locale : « CETTE étape a-t-elle encore un
 * chemin ? », et elle a besoin des arêtes. Deux questions, deux fonctions ; les fondre ferait
 * payer le chargement du graphe à chaque déduction d'état, et il y en a une par tour de moteur.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export interface EtapeGraphe {
  key: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  dependsOn?: readonly string[];
}

/** Un échec dont il ne reste aucune tentative, ou une annulation : rien ne le rejouera. */
export const estMorteParElleMeme = (e: EtapeGraphe): boolean =>
  (e.status === "FAILED" && e.attempt >= e.maxAttempts) || e.status === "CANCELLED";

/**
 * LES ÉTAPES QUI N'ONT PLUS AUCUN CHEMIN VERS L'EXÉCUTION.
 *
 * Point fixe : on part des morts par eux-mêmes, et on contamine tant que la liste grandit. Les
 * cycles ne posent pas de problème — le compilateur les refuse, et si l'un passait, il ne serait
 * simplement jamais contaminé.
 *
 * Seules les étapes PENDING sont contaminées : une étape DONE reste un acquis quoi qu'il arrive
 * en amont, une WAITING peut encore être réveillée, et une RUNNING appartient à son exécutant.
 */
export function etapesEnImpasse(etapes: readonly EtapeGraphe[]): Set<string> {
  const mortes = new Set<string>();
  for (const e of etapes) if (estMorteParElleMeme(e)) mortes.add(e.key);
  if (mortes.size === 0) return mortes;

  const candidates = etapes.filter((e) => e.status === "PENDING");
  let bouge = true;
  while (bouge) {
    bouge = false;
    for (const e of candidates) {
      if (mortes.has(e.key)) continue;
      if (!(e.dependsOn ?? []).some((d) => mortes.has(d))) continue;
      mortes.add(e.key);
      bouge = true;
    }
  }
  return mortes;
}

/**
 * CE LOT D'ÉTAPES PEUT-IL ENCORE PRODUIRE QUELQUE CHOSE ?
 *
 * Vrai dès qu'une seule étape n'est ni terminée ni en impasse. C'est la question que se pose
 * un jalon avant de se juger : tant qu'un barreau reste, on ne conclut pas (§118.9) ; dès
 * qu'il n'en reste aucun, refuser de conclure fige la mission pour toujours.
 *
 * `toutes` porte la mission ENTIÈRE et `lot` le sous-ensemble jugé : une étape du jalon peut
 * dépendre d'un acquis — ou d'un mort — d'un autre jalon, et ne regarder que le lot ferait
 * manquer la contagion qui vient d'à côté.
 */
export function peutEncoreAvancer(
  lot: readonly EtapeGraphe[],
  toutes: readonly EtapeGraphe[] = lot,
): boolean {
  const TERMINEES = new Set(["DONE", "SKIPPED", "CANCELLED"]);
  const mortes = etapesEnImpasse(toutes);
  return lot.some((e) => !TERMINEES.has(e.status) && !mortes.has(e.key));
}
