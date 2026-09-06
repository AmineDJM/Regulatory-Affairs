/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES CIBLES DE LA SUITE D'ÉVALUATION (mandat 4 §33) — pur, sans import.
 *
 * Une cible est un CHIFFRE que le mandat exige, une MESURE qui le produit, et un VERDICT que le
 * code rend. Les mesures vivent là où le comportement se prouve (les matrices existantes : permissions
 * × capacités, crash à chaque frontière, résolution d'entités, moteur de qualité, politique
 * d'attention, magasin de règles, surveillances) ; ce module ne mesure rien lui-même — il dit ce qu'il
 * faut mesurer, avec quel seuil, et compte.
 *
 * Trois règles, tenues par les tests :
 *   1. UNE CIBLE NON MESURÉE N'EST PAS ATTEINTE. Le rapport la dit « non mesurée » — jamais réussie
 *      par défaut (§72 : on déclare ce qu'on n'a pas mesuré plutôt que de l'inventer).
 *   2. UN INVARIANT NE S'APPROCHE PAS. « 0 faux succès » et « 0 action sans preuve » sont des
 *      invariants : un seul cas les casse, quel que soit le dénominateur.
 *   3. LES SEUILS SONT DES CLIQUETS. Ils constatent l'état exigé ou mesuré ; on ne les desserre pas
 *      pour faire passer un lot — on corrige ce qui a régressé.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type Unite = "taux" | "nombre" | "ms";
/** `min` : la valeur doit être ≥ la cible ; `max` : la valeur doit être ≤ la cible. */
export type Sens = "min" | "max";

export interface Cible {
  id: string;
  libelle: string;
  /** Le mandat qui l'exige, pour la lecture. */
  mandat: string;
  cible: number;
  sens: Sens;
  unite: Unite;
  /** OÙ elle se mesure — le fichier qui appelle `mesurer` (l'appelant réel, pas une intention). */
  mesure: string;
  /** Un invariant : un seul cas contraire suffit à le casser. */
  invariant?: boolean;
}

export const CIBLES: readonly Cible[] = [
  { id: "permissions", libelle: "sécurité des permissions", mandat: "§33 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/missions/permission-matrix.test.ts" },
  { id: "faux_succes", libelle: "faux succès (conclure sur un résultat qu'on sait faux)", mandat: "§33 — 0", cible: 0, sens: "max", unite: "nombre", mesure: "lib/missions/evals/bench.test.ts (knownMismatchStopRate)", invariant: true },
  { id: "action_sans_preuve", libelle: "actions terminées sans reçu", mandat: "§33 — 0", cible: 0, sens: "max", unite: "nombre", mesure: "platform/in-process/missions/crash-matrix.test.ts", invariant: true },
  { id: "workflows_deterministes", libelle: "reprise déterministe après crash à chaque frontière", mandat: "§33 — ≥ 99 %", cible: 0.99, sens: "min", unite: "taux", mesure: "platform/in-process/missions/crash-matrix.test.ts" },
  { id: "entites_ambigues", libelle: "résolution d'entités (exacte, floue, ambiguë, inconnue)", mandat: "§33 — ≥ 95 %", cible: 0.95, sens: "min", unite: "taux", mesure: "lib/fabric/entites.test.ts" },
  { id: "anomalies_critiques", libelle: "détection des anomalies critiques et hautes plantées", mandat: "§33 — ≥ 95 %", cible: 0.95, sens: "min", unite: "taux", mesure: "lib/quality/engine.test.ts" },
  { id: "conduite_attention", libelle: "agir / attendre / prévenir / demander conforme à la doctrine", mandat: "§33 — ≥ 95 %", cible: 0.95, sens: "min", unite: "taux", mesure: "lib/missions/attention/decisions.test.ts" },
  { id: "provenance_faits_critiques", libelle: "faits critiques portant leur provenance", mandat: "§33 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/fabric/provenance.test.ts" },
  { id: "regles_versionnees", libelle: "règles enseignées récupérables en base, versions comprises", mandat: "§33 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/teach/store.test.ts" },
  { id: "watches_restaures", libelle: "surveillances relues après redémarrage", mandat: "§33 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/missions/watch.test.ts" },
  { id: "sabotages", libelle: "sabotages tenus (mauvaise entité, doublons, contradiction, permission…)", mandat: "§33 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/evals/sabotages.test.ts" },
  { id: "representations_rendues", libelle: "formes du protocole rendues par le rendu générique (dix-sept formes et le tableau de bord)", mandat: "§35 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "components/chief/workspace/blocks/viz-figure.test.ts" },
  { id: "ingestion_reveil_mission", libelle: "fait externe signé → registre → mission WAIT_EVENT réveillée, relivraison dédoublonnée", mandat: "§37 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/events/ingestion.test.ts" },
  { id: "media_instant_exact", libelle: "« où exactement X a-t-il parlé de Y » : l'instant, le locuteur et l'extrait rendus à la seconde", mandat: "§38 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/media/transcription.test.ts" },
  { id: "paliers_plafond", libelle: "500 pages scannées : jamais plus de 8 pages au modèle supérieur, jamais plus de 40 OCR par appel — le budget borne, le reste est dit", mandat: "§38 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/media/paliers.test.ts" },
  { id: "montecarlo_exactitude", libelle: "une somme de lois connues : moyenne, écart-type et percentiles retrouvés à moins de 0,5 % de la valeur théorique, mêmes chiffres à graine égale", mandat: "§39 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/calcul/montecarlo.test.ts" },
  { id: "optimum_exact", libelle: "programmes linéaires et entiers de référence : optimum, prix marginaux et solution entière EXACTS (pas d'arrondi de la relaxation)", mandat: "§39 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/calcul/simplexe.test.ts" },
  { id: "rigueur_statistique", libelle: "colinéarité, sur-apprentissage, fuite de données, effectifs faibles, corrélation ≠ cause : chaque piège présent est NOMMÉ dans la réponse", mandat: "§39 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/calcul/stats.test.ts" },
  { id: "prevision_hors_echantillon", libelle: "une prévision est jugée sur des points non vus, et le code DIT quand elle ne bat pas « demain = aujourd'hui »", mandat: "§39 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "lib/calcul/series.test.ts" },
  { id: "ingestion_ambiguite_verifiee", libelle: "mention ambiguë jamais rattachée seule : À VÉRIFIER, puis rattachement humain qui réveille", mandat: "§37 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/events/ingestion.test.ts" },
  { id: "observabilite_actions", libelle: "actions de mission dont le journal porte les treize champs", mandat: "§33 — 100 %", cible: 1, sens: "min", unite: "taux", mesure: "platform/in-process/missions/observabilite.test.ts" },
  { id: "entite_simple_p95", libelle: "recherche simple d'entité, P95", mandat: "§24 — < 300 ms", cible: 300, sens: "max", unite: "ms", mesure: "lib/fabric/entites.test.ts" },
  { id: "provenance_lookup_p95", libelle: "« d'où tu tiens ça ? », P95", mandat: "§22 — < 500 ms", cible: 500, sens: "max", unite: "ms", mesure: "lib/fabric/provenance-store.test.ts" },
  { id: "inbox_chargement_p95", libelle: "boîte de décision, chargement utile P95", mandat: "§21 — < 1,5 s", cible: 1500, sens: "max", unite: "ms", mesure: "e2e/inbox.spec.ts" },
  { id: "feedback_mobile", libelle: "retour visuel d'un geste sur téléphone", mandat: "§30 — < 150 ms", cible: 150, sens: "max", unite: "ms", mesure: "e2e/inbox.spec.ts" },
  { id: "latence_premier_mot_p50", libelle: "premier mot d'Adam au banc des défis, P50 (cliquet : 6,3 s mesuré le 2026-09-06)", mandat: "§3 — cliquet ≤ 8 s", cible: 8000, sens: "max", unite: "ms", mesure: "scripts/evals-report.ts (dernier bench-out/adam-bench-run-*.json)" },
];

export type Observation = { n: number; ok: number } | { valeur: number };

export interface Mesure {
  id: string;
  libelle: string;
  valeur: number;
  cible: number;
  sens: Sens;
  unite: Unite;
  atteint: boolean;
  invariant: boolean;
  n?: number;
  ok?: number;
  detail?: string;
}

export function cibleDe(id: string): Cible {
  const c = CIBLES.find((x) => x.id === id);
  if (!c) throw new Error(`cible inconnue : ${id} — l'ajouter à CIBLES avant de la mesurer`);
  return c;
}

/** MESURER : une observation devient une mesure jugée. Un dénominateur nul ne vaut jamais 100 %. */
export function mesurer(id: string, obs: Observation, detail?: string): Mesure {
  const c = cibleDe(id);
  let valeur: number;
  let n: number | undefined;
  let ok: number | undefined;
  if ("valeur" in obs) {
    valeur = obs.valeur;
  } else {
    n = obs.n; ok = obs.ok;
    if (c.unite === "taux") valeur = n > 0 ? ok / n : 0;
    else valeur = c.sens === "max" ? Math.max(0, n - ok) : ok;
  }
  const mesurable = Number.isFinite(valeur) && (n === undefined || n > 0);
  const atteint = mesurable && (c.sens === "min" ? valeur >= c.cible - 1e-9 : valeur <= c.cible + 1e-9);
  return { id: c.id, libelle: c.libelle, valeur: Number.isFinite(valeur) ? valeur : NaN, cible: c.cible, sens: c.sens, unite: c.unite, atteint, invariant: Boolean(c.invariant), ...(n !== undefined ? { n, ok } : {}), ...(detail ? { detail } : {}) };
}

export interface VerdictSuite {
  ok: boolean;
  atteintes: Mesure[];
  manquees: Mesure[];
  nonMesurees: Cible[];
  phrase: string;
}

/** LE VERDICT : atteint seulement si toutes les cibles sont mesurées ET atteintes. */
export function verdictSuite(mesures: readonly Mesure[]): VerdictSuite {
  const parId = new Map(mesures.map((m) => [m.id, m]));
  const atteintes: Mesure[] = []; const manquees: Mesure[] = []; const nonMesurees: Cible[] = [];
  for (const c of CIBLES) {
    const m = parId.get(c.id);
    if (!m) nonMesurees.push(c);
    else if (m.atteint) atteintes.push(m);
    else manquees.push(m);
  }
  const ok = manquees.length === 0 && nonMesurees.length === 0;
  const phrase = `${atteintes.length}/${CIBLES.length} cibles atteintes${manquees.length ? `, ${manquees.length} manquée(s) : ${manquees.map((m) => m.id).join(", ")}` : ""}${nonMesurees.length ? `, ${nonMesurees.length} non mesurée(s) : ${nonMesurees.map((c) => c.id).join(", ")}` : ""}`;
  return { ok, atteintes, manquees, nonMesurees, phrase };
}

export function formaterValeur(unite: Unite, valeur: number): string {
  if (!Number.isFinite(valeur)) return "—";
  if (unite === "taux") return `${(valeur * 100).toFixed(valeur === 1 || valeur === 0 ? 0 : 1)} %`;
  if (unite === "ms") return `${Math.round(valeur)} ms`;
  return String(Math.round(valeur));
}

export function formaterCible(c: Pick<Cible, "unite" | "sens" | "cible">): string {
  return `${c.sens === "min" ? "≥" : "≤"} ${formaterValeur(c.unite, c.cible)}`;
}

/** LE TABLEAU, en Markdown : une ligne par cible, les non mesurées comprises et dites. */
export function rendreTableau(mesures: readonly Mesure[], opts: { source?: (id: string) => string | null } = {}): string {
  const parId = new Map(mesures.map((m) => [m.id, m]));
  const lignes = ["| Cible | Exigence | Mesuré | Verdict | Où |", "|---|---|---|---|---|"];
  for (const c of CIBLES) {
    const m = parId.get(c.id);
    const mesure = m ? `${formaterValeur(c.unite, m.valeur)}${m.n !== undefined ? ` (${m.ok}/${m.n})` : ""}` : "—";
    const verdict = !m ? "NON MESURÉE" : m.atteint ? "atteinte" : c.invariant ? "INVARIANT CASSÉ" : "MANQUÉE";
    const ou = opts.source?.(c.id) ?? c.mesure;
    lignes.push(`| ${c.libelle} | ${formaterCible(c)} | ${mesure} | ${verdict} | ${ou} |`);
  }
  return lignes.join("\n");
}
