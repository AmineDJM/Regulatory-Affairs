import { routeQuery, type RouteClass, type Domain } from "./router";
import { GOLDEN_CORPUS, CORPUS_PROVENANCE, type GoldenCase } from "./golden-corpus";

/**
 * LE BANC — il rend un CHIFFRE, pas une impression.
 *
 * Ce que la mission demande de mesurer (§29, §31) : la bonne route, le bon domaine, et la
 * distribution réelle des chemins empruntés (§28). Ce banc les rend tous les trois, séparément
 * pour les énoncés VRAIMENT dits par le PDG et pour les cas construits — parce qu'une justesse
 * de 95 % obtenue sur des phrases qu'on a écrites soi-même ne prouve rien.
 *
 * LA MATRICE DE CONFUSION EST LA PARTIE UTILE. Un score global dit « ça va » ou « ça ne va pas ».
 * La matrice dit CE QU'IL FAUT RÉPARER : si toutes les erreurs sont des ACTION classées en
 * HYBRID_RETRIEVAL, on sait où travailler. §31 demande d'ailleurs « near-zero wrong-domain
 * routing », ce qui ne se vérifie que par paire attendu→obtenu.
 *
 * LES ERREURS N'ONT PAS LE MÊME PRIX, et le banc le dit :
 *   • Router une lecture vers un chemin cher coûte des tokens et une seconde. Ennuyeux.
 *   • Router une ACTION vers une lecture, ou l'inverse, change ce que fait le produit. Grave.
 * `dangerousMisroutes` isole cette seconde famille.
 */

export interface CaseResult {
  id: string;
  utterance: string;
  source: GoldenCase["source"];
  expectedRoute: RouteClass;
  actualRoute: RouteClass;
  expectedDomain: Domain;
  actualDomain: Domain;
  routeOk: boolean;
  domainOk: boolean;
  /** Une confusion entre lire et agir — la seule qui change le comportement du produit. */
  dangerous: boolean;
  confidence: number;
  reason: string;
}

export interface BenchReport {
  cases: number;
  routeAccuracy: number;
  domainAccuracy: number;
  /** La justesse sur les seuls énoncés RÉELLEMENT dits par le PDG. */
  transcriptRouteAccuracy: number;
  composedRouteAccuracy: number;
  /** La distribution effective — §28 demande de la mesurer, pas de la forcer. */
  distribution: Record<RouteClass, number>;
  distributionShare: Record<RouteClass, number>;
  /** attendu → obtenu → nombre. */
  confusion: Record<string, number>;
  failures: CaseResult[];
  dangerousMisroutes: CaseResult[];
  provenance: typeof CORPUS_PROVENANCE;
}

const ROUTES: RouteClass[] = ["FAST_DETERMINISTIC", "STRUCTURED_QUERY", "HYBRID_RETRIEVAL", "DEEP_REASONING", "ACTION"];

/** Lire ou agir : la frontière dont la confusion change le produit, pas seulement sa facture. */
const isWrite = (r: RouteClass): boolean => r === "ACTION";

export function runCase(c: GoldenCase): CaseResult {
  const r = routeQuery(c.utterance, c.ctx ?? {});
  const routeOk = r.route === c.expectedRoute;
  return {
    id: c.id, utterance: c.utterance, source: c.source,
    expectedRoute: c.expectedRoute, actualRoute: r.route,
    expectedDomain: c.expectedDomain, actualDomain: r.domain,
    routeOk, domainOk: r.domain === c.expectedDomain,
    dangerous: !routeOk && isWrite(c.expectedRoute) !== isWrite(r.route),
    confidence: r.confidence, reason: r.reason,
  };
}

export function runRouterBench(corpus: GoldenCase[] = GOLDEN_CORPUS): BenchReport {
  const results = corpus.map(runCase);

  const distribution = Object.fromEntries(ROUTES.map((r) => [r, 0])) as Record<RouteClass, number>;
  const confusion: Record<string, number> = {};
  for (const r of results) {
    distribution[r.actualRoute] += 1;
    if (!r.routeOk) {
      const key = `${r.expectedRoute} → ${r.actualRoute}`;
      confusion[key] = (confusion[key] ?? 0) + 1;
    }
  }

  const share = (n: number, of: number) => (of === 0 ? 0 : n / of);
  const acc = (list: CaseResult[]) => share(list.filter((r) => r.routeOk).length, list.length);

  return {
    cases: results.length,
    routeAccuracy: acc(results),
    domainAccuracy: share(results.filter((r) => r.domainOk).length, results.length),
    transcriptRouteAccuracy: acc(results.filter((r) => r.source === "transcript")),
    composedRouteAccuracy: acc(results.filter((r) => r.source === "composed")),
    distribution,
    distributionShare: Object.fromEntries(
      ROUTES.map((r) => [r, share(distribution[r], results.length)]),
    ) as Record<RouteClass, number>,
    confusion,
    failures: results.filter((r) => !r.routeOk),
    dangerousMisroutes: results.filter((r) => r.dangerous),
    provenance: CORPUS_PROVENANCE,
  };
}

/** Le rapport, tel qu'on le lit dans un terminal ou qu'on le colle dans un compte rendu. */
export function formatBench(report: BenchReport): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)} %`;
  const lines: string[] = [
    `BANC DE ROUTAGE — ${report.cases} demandes`,
    `  dont ${report.provenance.transcript} verbatim du PDG, ${report.provenance.composed} construites`,
    "",
    `Justesse de route     : ${pct(report.routeAccuracy)}`,
    `  · sur le verbatim   : ${pct(report.transcriptRouteAccuracy)}`,
    `  · sur le construit  : ${pct(report.composedRouteAccuracy)}`,
    `Justesse de domaine   : ${pct(report.domainAccuracy)}`,
    `Confusions lire/agir  : ${report.dangerousMisroutes.length}`,
    "",
    "DISTRIBUTION EFFECTIVE (§28 — mesurée, pas forcée) :",
    ...ROUTES.map((r) => `  ${r.padEnd(19)} ${String(report.distribution[r]).padStart(3)}  ${pct(report.distributionShare[r])}`),
  ];

  if (Object.keys(report.confusion).length > 0) {
    lines.push("", "CONFUSIONS (attendu → obtenu) :");
    for (const [k, v] of Object.entries(report.confusion).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${k} : ${v}`);
    }
  }
  if (report.failures.length > 0) {
    lines.push("", "ÉCHECS :");
    for (const f of report.failures) {
      lines.push(`  [${f.id}] « ${f.utterance} »`);
      lines.push(`      attendu ${f.expectedRoute}, obtenu ${f.actualRoute} — ${f.reason}`);
    }
  }
  return lines.join("\n");
}
