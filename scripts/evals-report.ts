/**
 * LE RAPPORT DE LA SUITE D'ÉVALUATION (mandat 4 §33).
 *
 *   npm run evals:report
 *
 * Relit les mesures écrites par les matrices (`bench-out/evals/<cible>.json`, produites par
 * `npm test` et `npm run test:e2e`), ajoute la latence du dernier banc live
 * (`bench-out/adam-bench-run-*.json`), et imprime le tableau des cibles : exigence, mesuré,
 * verdict, où c'est mesuré. Une cible sans mesure est dite NON MESURÉE — jamais réussie par
 * défaut. Code de sortie 1 si une cible mesurée est manquée ou si une cible n'est pas mesurée
 * (utilisable en CI) ; `--souple` ne fait échouer que les cibles manquées.
 *
 * Le rapport est aussi écrit dans `bench-out/evals/RAPPORT.md`.
 */
import fs from "node:fs";
import path from "node:path";
import { mesurer, rendreTableau, verdictSuite, type Mesure } from "../src/lib/evals/cibles";
import { DOSSIER_MESURES, lireMesures } from "../src/lib/evals/registre";

const souple = process.argv.includes("--souple");

function latenceDuDernierBanc(): { mesure: Mesure; fichier: string } | null {
  const dossier = path.join(process.cwd(), "bench-out");
  if (!fs.existsSync(dossier)) return null;
  const fichiers = fs.readdirSync(dossier).filter((f) => /^adam-bench-run-.*\.json$/.test(f)).sort();
  const dernier = fichiers[fichiers.length - 1];
  if (!dernier) return null;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dossier, dernier), "utf8")) as { mesures?: { premierMotMs?: number; appels?: number }[] };
    // Seuls les tours qui ont fait travailler un modèle comptent : un refus local en 31 ms n'est pas une latence de modèle.
    const valeurs = (d.mesures ?? []).filter((m) => (m.appels ?? 0) > 0 && typeof m.premierMotMs === "number").map((m) => m.premierMotMs as number).sort((a, b) => a - b);
    if (valeurs.length === 0) return null;
    const p50 = valeurs[Math.floor(valeurs.length / 2)];
    return { mesure: mesurer("latence_premier_mot_p50", { valeur: p50 }, `${valeurs.length} tours avec modèle`), fichier: dernier };
  } catch {
    return null;
  }
}

const enregistrees = lireMesures();
const sources = new Map<string, string>();
for (const m of enregistrees) sources.set(m.id, `${m.source ?? "?"} · ${m.mesureeLe.slice(0, 16).replace("T", " ")}${m.detail ? ` · ${m.detail}` : ""}`);
const mesures: Mesure[] = [...enregistrees];
const banc = latenceDuDernierBanc();
if (banc) { mesures.push(banc.mesure); sources.set(banc.mesure.id, `bench-out/${banc.fichier}`); }

const verdict = verdictSuite(mesures);
const tableau = rendreTableau(mesures, { source: (id) => sources.get(id) ?? null });
const entete = `# Suite d'évaluation — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\n\n${verdict.phrase}.\n\n`;
console.log(entete + tableau);
try {
  fs.mkdirSync(DOSSIER_MESURES, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER_MESURES, "RAPPORT.md"), `${entete}${tableau}\n`);
} catch { /* le rapport imprimé suffit */ }
if (verdict.manquees.length > 0) {
  console.error(`\nCIBLES MANQUÉES : ${verdict.manquees.map((m) => `${m.id} (${m.valeur} vs ${m.sens === "min" ? "≥" : "≤"} ${m.cible})`).join(", ")}`);
  process.exit(1);
}
if (verdict.nonMesurees.length > 0 && !souple) {
  console.error(`\nCIBLES NON MESURÉES : ${verdict.nonMesurees.map((c) => c.id).join(", ")} — lancer npm test (et test:e2e, adam:bench:defis) avant le rapport, ou --souple.`);
  process.exit(1);
}
