/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA RÉPARATION DES LIENS INTERNES — le correctif d'un défaut vu en conversation réelle.
 *
 * ── LE DÉFAUT, MOT POUR MOT ──────────────────────────────────────────────────────────────
 *
 * Les outils rendent des liens EXACTS (`"lien": "/regulatory/cmw4…"`), et la réponse affichée
 * portait « [Ouvrir le dossier](/regulatory/) » — le modèle recopie le début du chemin et LÂCHE
 * l'identifiant. Le clic mène alors au tableau générique au lieu du dossier dont on vient de
 * parler. Mesuré sur trois modules dans une seule conversation (regulatory, sponsoring, drive).
 *
 * ── POURQUOI DU CODE ET PAS UNE CONSIGNE ─────────────────────────────────────────────────
 *
 * La consigne existe déjà (« liens cliquables ») et le défaut a eu lieu quand même : un modèle
 * qui paraphrase abrège. La réparation est donc DÉTERMINISTE : on collecte les liens internes
 * que les outils du tour ont réellement rendus, et un lien du texte qui est un PRÉFIXE STRICT
 * d'exactement UN lien collecté est complété. Jamais de devinette :
 *
 *   • `/regulatory/` quand le tour a lu `/regulatory/cmw4…`  → complété (un seul candidat) ;
 *   • `/courriers` quand l'outil rend `/courriers`           → égalité, laissé tel quel ;
 *   • deux dossiers lus dans le même tour                    → ambigu, laissé tel quel —
 *     compléter au hasard enverrait vers le MAUVAIS dossier, le défaut le plus coûteux.
 *
 * Pur : aucune base, aucun réseau — vérifiable ligne à ligne.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Les clés sous lesquelles les outils déclarent leurs liens internes. */
const CLES_LIENS = new Set(["lien", "liens", "href", "url", "link"]);

const estLienInterne = (v: string): boolean =>
  v.startsWith("/") && !v.startsWith("//") && v.length <= 200 && !/\s/.test(v);

function collecterDans(valeur: unknown, cle: string | null, sortie: Set<string>, profondeur: number): void {
  if (profondeur > 8 || valeur == null) return;
  if (typeof valeur === "string") {
    if (cle && CLES_LIENS.has(cle) && estLienInterne(valeur)) sortie.add(valeur);
    return;
  }
  if (Array.isArray(valeur)) {
    for (const v of valeur.slice(0, 200)) collecterDans(v, cle, sortie, profondeur + 1);
    return;
  }
  if (typeof valeur === "object") {
    for (const [k, v] of Object.entries(valeur as Record<string, unknown>)) {
      collecterDans(v, k, sortie, profondeur + 1);
    }
  }
}

/** Les liens internes que les sorties d'outils du tour ont rendus — champs `lien`/`href`/`url`. */
export function collecterLiensInternes(sortiesOutils: readonly string[]): string[] {
  const liens = new Set<string>();
  for (const brut of sortiesOutils) {
    if (typeof brut !== "string" || (!brut.startsWith("{") && !brut.startsWith("["))) continue;
    try {
      collecterDans(JSON.parse(brut), null, liens, 0);
    } catch {
      // Une sortie texte n'a pas de liens déclarés — rien à collecter, rien à inventer.
    }
  }
  return [...liens];
}

/**
 * COMPLÈTE les liens Markdown tronqués du texte à partir des liens réellement rendus.
 * Ne touche à RIEN d'autre : un lien complet, externe, ou ambigu reste tel quel.
 */
export function reparerLiensInternes(
  texte: string,
  liens: readonly string[],
): { texte: string; repares: number } {
  if (!texte.includes("](/") || liens.length === 0) return { texte, repares: 0 };
  let repares = 0;
  const texteRepare = texte.replace(/\]\((\/[^)\s]*)\)/g, (tout, href: string) => {
    // Un candidat = un lien collecté STRICTEMENT plus profond dont `href` est le préfixe exact
    // (au séparateur près : « /regulatory » et « /regulatory/ » désignent la même racine).
    // Un lien déjà PROFOND n'est jamais réécrit : « /regulatory/cmAncien » ne peut être préfixe
    // d'un lien collecté différent, donc `candidats` reste vide et le lien est laissé tel quel.
    const base = href.endsWith("/") ? href : `${href}/`;
    const candidats = [...new Set(liens.filter((l) => l !== href && l.startsWith(base) && l.length > base.length))];
    if (candidats.length !== 1) return tout;
    repares += 1;
    return `](${candidats[0]})`;
  });
  return { texte: texteRepare, repares };
}
