import { entiteDuModele } from "./modele-entite";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * CE QUE LA CARTE DIT QU'ELLE VA TOUCHER — la phrase qu'une personne lit avant de confirmer.
 *
 * ── LE DÉFAUT, ET LA MESURE QUI LE DÉCIDE ────────────────────────────────────────────────
 *
 * La carte écrivait `Écrit : ` suivi des noms de modèles Prisma, tels quels. Depuis que la
 * dérivation de contrats suit les délégués IMPORTÉS, une écriture ordinaire en déclare deux ou
 * trois, et la phrase est devenue :
 *
 *     « Écrit : administrativeRequest, auditLog, notification. »
 *
 * Mesuré sur les 640 actions écrivantes du parc : **auditLog dans 67 %**, **notification dans
 * 21 %**, 2 modèles par action en médiane et jusqu'à 8. Deux conséquences, et la seconde est la
 * plus coûteuse.
 *
 * **`auditLog` est de la plomberie.** Deux cartes sur trois le nommeraient, ce qui apprend à
 * sauter la ligne — et une réserve permanente devient du bruit qu'on cesse de lire, donc elle
 * ne protège plus là où elle compte (§118.32). Pire : son ABSENCE ne prouve rien. Les 33 %
 * restants ne sont pas des écritures non auditées, ce sont des appels que la dérivation n'a pas
 * vus. Une information dont on ne peut rien conclure dans les deux sens n'est pas une
 * information.
 *
 * **`notification` en est une.** 21 %, et elle dit qu'une PERSONNE va être dérangée : c'est
 * matériel au moment de confirmer, et cela mérite sa propre phrase plutôt qu'un nom de table
 * noyé dans une énumération.
 *
 * ── POURQUOI ON NE TRADUIT PAS TOUT ──────────────────────────────────────────────────────
 *
 * Le registre porte un libellé français pour **29 modèles sur les 188** que le parc écrit. Ne
 * traduire que ceux-là ferait une phrase mi-française mi-technique où le lecteur ne peut plus
 * dire si « promoMaterial » est un détail d'implémentation ou un libellé qu'il ne connaît pas.
 * On DIT donc les deux séparément : les objets qu'on sait nommer, puis le COMPTE de tables
 * techniques touchées. Dire son ignorance plutôt qu'une liste plausible (§118.26).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES MODÈLES QU'ON NE NOMME PAS, et la raison est la même pour les deux : ce sont des faits
 * du MOTEUR, pas de la demande. La liste est FERMÉE et courte — ouverte, elle finirait par
 * cacher une écriture métier (§118.52).
 */
const PLOMBERIE = new Set(["auditLog", "businessEvent"]);

/** Le modèle qui dit qu'une PERSONNE sera prévenue — il a sa propre phrase, pas une ligne de liste. */
const MODELE_NOTIFICATION = "notification";

export interface EmpreinteEcriture {
  /** Les objets métier qu'on sait nommer en français, dédoublonnés et triés. */
  objets: string[];
  /**
   * LES TABLES qu'on ne sait pas nommer — leur nom BRUT, pas un compte.
   *
   * La première version n'en rendait que le NOMBRE, et c'était une régression mesurée : sur les
   * 640 actions écrivantes du parc, **189 seulement** portent un objet du registre, donc 451
   * cartes auraient perdu « promoMaterial » — un nom technique, mais SPÉCIFIQUE, qui dit à une
   * personne de Regulatory de quoi il s'agit — au profit de « 2 tables que je ne sais pas
   * nommer », qui ne dit rien. Réparer 189 cartes en dégradant 451 est exactement l'échange que
   * §118.27 interdit. On garde donc le nom ET l'on annonce son registre : « les tables
   * « promoMaterial » » se lit comme un nom technique assumé, pas comme un libellé français que
   * le lecteur devrait connaître.
   */
  tables: string[];
  /** Une personne sera-t-elle prévenue ? */
  previent: boolean;
}

export function empreinteEcriture(modelesEcrits: readonly string[]): EmpreinteEcriture {
  const objets = new Set<string>();
  const tables = new Set<string>();
  let previent = false;
  for (const m of new Set(modelesEcrits)) {
    if (m === MODELE_NOTIFICATION) { previent = true; continue; }
    if (PLOMBERIE.has(m)) continue;
    const def = entiteDuModele(m);
    if (def) objets.add(def.label);
    else tables.add(m);
  }
  const trier = (l: Set<string>) => [...l].sort((a, b) => a.localeCompare(b, "fr"));
  return { objets: trier(objets), tables: trier(tables), previent };
}

const citer = (noms: readonly string[]) => noms.map((n) => `« ${n} »`).join(", ");

/**
 * LA PHRASE. Jamais vide : une action déclarée écrivante dont on ne sait nommer AUCUN objet
 * doit le dire, sinon la carte laisse croire qu'elle ne touche à rien (§104.15).
 */
export function direEmpreinteEcriture(modelesEcrits: readonly string[]): string {
  const e = empreinteEcriture(modelesEcrits);
  let phrase: string;
  if (e.objets.length > 0 && e.tables.length > 0) {
    phrase = `Écrit : ${e.objets.join(", ")}, et ${e.tables.length > 1 ? "les tables" : "la table"} ${citer(e.tables)}.`;
  } else if (e.objets.length > 0) {
    phrase = `Écrit : ${e.objets.join(", ")}.`;
  } else if (e.tables.length > 0) {
    phrase = `Écrit ${e.tables.length > 1 ? "les tables" : "la table"} ${citer(e.tables)}.`;
  } else {
    phrase = "Écriture en base annoncée, sans objet métier identifiable.";
  }
  // LA NOTIFICATION EN DERNIER et en clair : c'est le seul élément qui dérange QUELQU'UN.
  return e.previent ? `${phrase} Une notification part à la personne concernée.` : phrase;
}
