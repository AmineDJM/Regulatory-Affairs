/**
 * Normalisation de texte pharma — fonctions PURES, sans aucune dépendance.
 *
 * ⚠️ Ce fichier ne doit JAMAIS importer `./data` (ni rien qui le fasse) : il est chargé par des
 * composants CLIENT (l'explorateur de produits). `data.ts` lit des fichiers avec `fs`/`zlib` ;
 * le moindre chemin d'import vers lui fait échouer la compilation navigateur avec
 * « Module not found: Can't resolve 'fs' ». C'est exactement ce qui est arrivé une fois.
 *
 * `engine.ts` réexporte ces primitives : les modules serveur historiques continuent de les
 * importer depuis là, sans rien changer.
 */

/** Normalisation pharma-safe (sans accents, MAJUSCULES, séparateurs → espaces). */
export function normText(s: string | null | undefined): string {
  if (s == null) return "";
  let t = String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase();
  t = t.replace(/µ/g, "U").replace(/μ/g, "U");
  t = t.replace(/[/\\|,;:+()[\]{}]/g, " ");
  t = t.replace(/[^A-Z0-9.%\s-]/g, " ");
  return t.replace(/\s+/g, " ").trim();
}

/** Mots-vides pharma : présents dans presque tous les libellés, ils ne discriminent rien. */
export const STOPWORDS = new Set(
  ("ACIDE ACID BASE BASIQUE SODIUM POTASSIUM CALCIUM MAGNESIUM HYDROCHLORIDE CHLORHYDRATE DICHLORHYDRATE " +
    "MONOHYDRATE DIHYDRATE TRIHYDRATE ANHYDRE MALEATE MESILATE PHOSPHATE SULFATE SULPHATE NITRATE LA LE LES DE DU DES ET OU AVEC SANS " +
    "COMPRIME COMP GELULE GLES SIROP SOLUTION INJECTABLE INJ SOL SUSPENSION BUVABLE FLACON AMP AMPOULE BTE BOITE B").split(/\s+/),
);

/** Jetons signifiants (hors mots-vides). */
export function tokens(s: string | null | undefined): string[] {
  return normText(s).split(" ").filter((t) => t && !STOPWORDS.has(t));
}

export const queryTokens = (key: string): string[] => tokens(key).filter((t) => t.length >= 3);
