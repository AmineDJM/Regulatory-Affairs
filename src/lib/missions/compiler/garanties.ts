/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QU'UN PLAN GARANTIT — par opposition à ce qu'il PROPOSE.
 *
 * ── LE DÉFAUT, MESURÉ ────────────────────────────────────────────────────────────────────
 *
 * Mission `cmttakgtd…`, neuf versions de plan, banc réel. La demande nomme un registre à
 * produire ; le plan v9 écrit DEUX étapes ARTIFACT, et les conditionne toutes les deux à la
 * complétude des données :
 *
 *   produire:registre-tracabilite-initial     SKIPPED
 *     « condition non remplie — normaliser:retour-initial.donneesCompletes : false ≠ true »
 *   produire:registre-tracabilite-correction  SKIPPED
 *     « condition non remplie — normaliser:retour-correction.donneesCompletes : false ≠ true »
 *
 * Une personne n'a pas tout donné. Aucun fichier n'a été produit. AUCUNE étape en échec,
 * mission non bloquée, journal sans un mot d'alerte : le faux succès parfait (§118.10). Le
 * compilateur, lui, avait validé la couverture — il comptait un nœud ARTIFACT comme portant la
 * primitive DOCUMENT sans jamais regarder s'il était CONDITIONNEL. Le plan promettait la pièce
 * au compilateur, puis la conditionnait à l'exécution.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────────────────
 *
 * Une exigence FERME se compte sur ce que le plan garantit. Une étape conditionnelle ne promet
 * rien à elle seule : elle propose. Deux étapes conditionnelles peuvent en revanche promettre
 * ENSEMBLE, quand leurs conditions ne peuvent pas être fausses en même temps — c'est la forme
 * que la règle 18 du planificateur IMPOSE pour une relance (« si pas de réponse vendredi,
 * relance ; si réponse, remercie »). Refuser cette forme-là serait un refus à tort, et un refus
 * à tort est pire que le défaut qu'on corrige (§118.27).
 *
 * ── POURQUOI CE MODULE EST PUR, ET POURQUOI IL VIT ICI ───────────────────────────────────
 *
 * Aucun import : la question « ces conditions s'excluent-elles ? » est une question de LOGIQUE,
 * pas d'état. Elle se teste au cas près, et c'est ce qui permet de nommer le cas exact qui
 * ferait tomber chaque paire — sans quoi ce ne serait pas une assertion (§118.17).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Une condition, telle que le plan l'écrit. Les champs absents valent « pas de test ». */
export interface ConditionLue {
  step: string;
  outcome?: string | null;
  path?: string | null;
  op?: string | null;
  value?: string | null;
}

/** Une étape, réduite à ce qui décide si elle partira. */
export interface EtapeGarantie {
  key: string;
  when?: ConditionLue | null;
}

const txt = (v: string | null | undefined): string => (typeof v === "string" ? v.trim() : "");

/** Une étape sans condition part quoi qu'il arrive en amont. */
export const estInconditionnelle = (e: EtapeGarantie): boolean => !e.when || txt(e.when.step) === "";

/**
 * DEUX CONDITIONS QUI NE PEUVENT PAS ÊTRE FAUSSES EN MÊME TEMPS.
 *
 * Trois paires, et TROIS SEULEMENT. Chacune est un complément EXACT dans `comparerValeurs` /
 * `issueDe` — pas un complément « en général » :
 *
 *   — EVENT / TIMEOUT sur une ATTENTE. `issueDe` rend TIMEOUT quand l'attente s'est réglée par
 *     le temps, EVENT quand elle s'est réglée par un fait ou par une personne. Une attente se
 *     règle toujours par l'un ou l'autre. C'est pourquoi l'amont doit être une attente : sur un
 *     WORKER qui finit DONE sans marqueur de réveil, `issueDe` rend DONE, et EVENT comme
 *     TIMEOUT seraient FAUX TOUS LES DEUX — le plan ne garantirait alors plus rien.
 *   — eq / ne sur le même champ et la même valeur. `comparerValeurs` calcule l'égalité une
 *     fois et rend `ok` ou `!ok` : le complément est exact, y compris quand la comparaison
 *     numérique échoue et retombe sur le texte.
 *   — exists / empty sur le même champ. `!estVide` et `estVide` sur la même lecture.
 *
 * CE QUI N'EN EST PAS, ET C'EST LE CŒUR DE LA RÈGLE : `gt` et `lte` sur le même champ SEMBLENT
 * complémentaires et ne le sont pas. `comparerValeurs` rend `ok: false` pour les DEUX quand
 * l'une des valeurs n'est pas un nombre (« comparaison numérique impossible ») — deux branches
 * fausses ensemble, zéro livrable. Les admettre reproduirait exactement le défaut mesuré, avec
 * une couverture apparente en plus.
 */
export function sExcluent(
  a: ConditionLue | null | undefined,
  b: ConditionLue | null | undefined,
  estUneAttente: (cleAmont: string) => boolean,
): boolean {
  if (!a || !b) return false;
  if (txt(a.step) === "" || txt(a.step) !== txt(b.step)) return false;

  const issueA = txt(a.outcome).toUpperCase();
  const issueB = txt(b.outcome).toUpperCase();
  const testA = txt(a.path);
  const testB = txt(b.path);

  // 1. Les deux ISSUES d'une attente — et rien d'autre ne doit venir s'ajouter au test.
  if (testA === "" && testB === "" && estUneAttente(txt(a.step))) {
    if ((issueA === "EVENT" && issueB === "TIMEOUT") || (issueA === "TIMEOUT" && issueB === "EVENT")) return true;
  }

  // 2. Le MÊME test, pris à l'endroit et à l'envers. La même issue doit encadrer les deux :
  //    « si DONE et X = 3 » face à « si TIMEOUT et X ≠ 3 » peut être faux des deux côtés.
  if (testA !== "" && testA === testB && issueA === issueB) {
    const opA = txt(a.op).toLowerCase();
    const opB = txt(b.op).toLowerCase();
    const memeValeur = txt(a.value) === txt(b.value);
    if (memeValeur && ((opA === "eq" && opB === "ne") || (opA === "ne" && opB === "eq"))) return true;
    if ((opA === "exists" && opB === "empty") || (opA === "empty" && opB === "exists")) return true;
  }

  return false;
}

/**
 * COMBIEN DE CES ÉTAPES PARTIRONT, AU PIRE ?
 *
 * Les inconditionnelles partent toutes. Les conditionnelles ne comptent QUE par paires qui
 * s'excluent, et une paire garantit UNE étape, jamais deux : l'une part exactement quand
 * l'autre ne part pas. C'est ce qui rend le compte utilisable pour la CARDINALITÉ — « deux
 * formats demandés » exige deux pièces garanties, pas deux étapes écrites.
 *
 * L'appariement est glouton et suit l'ordre du plan : deux appels sur le même plan rendent le
 * même nombre, donc un refus reproductible et un banc comparable d'une version à l'autre.
 */
export function nombreGaranti(
  etapes: readonly EtapeGarantie[],
  estUneAttente: (cleAmont: string) => boolean,
): number {
  let n = etapes.filter(estInconditionnelle).length;
  const conditionnelles = etapes.filter((e) => !estInconditionnelle(e));
  const appariees = new Set<number>();
  for (let i = 0; i < conditionnelles.length; i += 1) {
    if (appariees.has(i)) continue;
    for (let j = i + 1; j < conditionnelles.length; j += 1) {
      if (appariees.has(j)) continue;
      if (!sExcluent(conditionnelles[i]?.when, conditionnelles[j]?.when, estUneAttente)) continue;
      appariees.add(i); appariees.add(j); n += 1;
      break;
    }
  }
  return n;
}

/**
 * AU MOINS UNE DE CES ÉTAPES PARTIRA-T-ELLE, QUOI QU'IL ARRIVE ?
 *
 * C'est la seule question que la couverture d'une exigence ferme a le droit de poser. Une liste
 * VIDE rend `false` : rien ne part quand il n'y a rien.
 */
export const auMoinsUnePartira = (
  etapes: readonly EtapeGarantie[],
  estUneAttente: (cleAmont: string) => boolean,
): boolean => nombreGaranti(etapes, estUneAttente) >= 1;

/** La condition, dite en français — pour un refus qui montre ce qu'il a LU (§118.34). */
export function direCondition(w: ConditionLue | null | undefined): string {
  if (!w || txt(w.step) === "") return "sans condition";
  const bouts: string[] = [];
  if (txt(w.outcome) !== "") bouts.push(`issue ${txt(w.outcome).toUpperCase()}`);
  if (txt(w.path) !== "") {
    const op = txt(w.op) || "eq";
    bouts.push(txt(w.value) === "" ? `${txt(w.path)} ${op}` : `${txt(w.path)} ${op} « ${txt(w.value)} »`);
  }
  return `si « ${txt(w.step)} » ${bouts.length > 0 ? bouts.join(" et ") : "aboutit"}`;
}
