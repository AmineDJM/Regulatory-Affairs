import { routeQuery, isConfident, type QueryRoute, type RouterContext } from "./router";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * QUI PREND QUEL CHEMIN — la politique d'activation, écrite en un seul endroit.
 *
 * L'AUTORISATION EST BORNÉE, et ce fichier est là pour que ses bornes soient LISIBLES plutôt
 * que dispersées dans la boucle de l'assistant :
 *
 *   « I authorize the new router/tool-shortlist to become ACTIVE now for safe READ-ONLY
 *     operations. I authorize a 20% canary for the remaining READ-ONLY traffic.
 *     I do NOT authorize migration of sensitive mutation execution to the new path yet. »
 *
 * TROIS CHEMINS, ET LA FRONTIÈRE ENTRE EUX EST LA SEULE CHOSE QUI COMPTE :
 *
 *   FAST_READ  — lecture canonique sûre. Le code choisit l'outil, l'exécute, et le modèle ne
 *                sert plus qu'à formuler. Zéro schéma d'outil envoyé.
 *   SHORTLIST  — le reste des lectures, en canary : liste d'outils réduite au domaine.
 *   LEGACY     — TOUT le reste, et notamment TOUTES les mutations. Chemin actuel, inchangé.
 *
 * ── LA RÈGLE QUI PROTÈGE LE PRODUIT ────────────────────────────────────────────────────────
 *
 * Le doute ne va JAMAIS vers un raccourci. §4 : « Un raté doit devenir GENERALIST, pas WRONG
 * TOOL. » Toute hésitation — confiance faible, domaine flou, outil inconnu, garde déclenchée —
 * retombe sur LEGACY. C'est le chemin le plus cher, et c'est exactement pour cela qu'il est le
 * repli : il fonctionne déjà.
 *
 * ── POURQUOI L'APPROBATION D'ENVOI EST TRAITÉE À PART ──────────────────────────────────────
 *
 * « Envoie-le » est classé FAST_DETERMINISTIC par le routeur — mais il EXPÉDIE UN MAIL. C'est
 * une mutation déguisée en raccourci, et le seul cas où « rapide » et « sûr » se contredisent.
 * Il est nommément renvoyé sur LEGACY, où l'approbation canonique, l'audit et l'idempotence
 * l'attendent.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export type RolloutMode = "FAST_READ" | "SHORTLIST" | "LEGACY";

/**
 * LES OUTILS DE LECTURE SÛRS — la liste EXHAUSTIVE de §1, et rien de plus.
 *
 * Un outil absent d'ici ne prend pas le chemin rapide, même si le routeur le propose. C'est une
 * liste blanche, pas une heuristique : ajouter un outil ici est une décision, pas un effet de
 * bord d'un renommage.
 */
export const SAFE_READ_TOOLS: ReadonlySet<string> = new Set([
  "gmail_search",          // « des mails ? », « Deepak a répondu ? »
  "read_calendar",         // « mon prochain rendez-vous ? »
  "inspect_record",        // « où en est Nintedanib ? » — la fiche canonique
  "directory_lookup",      // « l'email de Raihana ? »
  "directory_list",        // « les salariés et leurs mails »
  "list_pending_decisions", // « qu'est-ce qui m'attend ? »
]);

/**
 * LES FORMES RAPIDES QUI SONT DES MUTATIONS. Elles n'appellent aucun outil de lecture, mais
 * elles AGISSENT — d'où leur renvoi explicite sur le chemin prouvé.
 */
const MUTATING_FAST_KINDS: ReadonlySet<string> = new Set(["APPROVE_PENDING"]);

export interface RolloutDecision {
  mode: RolloutMode;
  route: QueryRoute;
  /** Vrai quand ce tour peut modifier quelque chose — il reste alors sur LEGACY. */
  isMutation: boolean;
  /** 0–99, déterministe : le même énoncé du même compte tombe toujours dans le même seau. */
  bucket: number;
  /** Le pourcentage de canary effectivement appliqué à ce tour. */
  canaryPercent: number;
  reason: string;
}

export interface RolloutOptions {
  userId: string;
  ctx?: RouterContext;
  /** Part du trafic de lecture restant qui passe en liste courte. Défaut : 20 % (§2). */
  canaryPercent?: number;
  /** Coupe-circuit manuel : tout repart sur l'ancien chemin, immédiatement. */
  disabled?: boolean;
}

/**
 * LE SEAU, DÉTERMINISTE.
 *
 * Un tirage aléatoire rendrait les incidents irreproductibles : « ça a marché la première fois »
 * cesserait d'être une information. Le hachage (FNV-1a, 32 bits) donne un seau STABLE pour un
 * même énoncé d'un même compte — on peut donc rejouer exactement le tour qui a échoué.
 */
export function bucketOf(userId: string, utterance: string): number {
  const key = `${userId}|${(utterance ?? "").trim().toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export const DEFAULT_CANARY_PERCENT = 20;

/** Le pourcentage effectif : réglage d'environnement, borné, avec le défaut de la mission. */
export function configuredCanaryPercent(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.CHIEF_ROUTER_CANARY);
  if (!Number.isFinite(raw)) return DEFAULT_CANARY_PERCENT;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Le coupe-circuit d'environnement — une variable, et tout repart comme avant. */
export function routerDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CHIEF_ROUTER_DISABLED === "1" || env.CHIEF_ROUTER_DISABLED === "true";
}

export function decideRollout(utterance: string, opts: RolloutOptions): RolloutDecision {
  const route = routeQuery(utterance, opts.ctx ?? {});
  const canaryPercent = opts.canaryPercent ?? configuredCanaryPercent();
  const bucket = bucketOf(opts.userId, utterance);

  const isMutation = route.route === "ACTION"
    || (route.fastKind !== null && MUTATING_FAST_KINDS.has(route.fastKind));

  const base = { route, isMutation, bucket, canaryPercent };

  // ── 0. LE COUPE-CIRCUIT ─────────────────────────────────────────────────────────────────
  if (opts.disabled ?? routerDisabled()) {
    return { ...base, mode: "LEGACY", reason: "routeur désactivé" };
  }

  // ── 1. LES MUTATIONS NE BOUGENT PAS ─────────────────────────────────────────────────────
  // Le nouveau routeur a le droit de les CLASSIFIER — c'est ce qui alimente les mesures — mais
  // pas d'en prendre la responsabilité. §3, et §26 le confirme.
  if (isMutation) {
    return { ...base, mode: "LEGACY", reason: "mutation — chemin canonique prouvé" };
  }

  // ── 2. LE DOUTE RETOMBE SUR LE GÉNÉRALISTE ──────────────────────────────────────────────
  if (!isConfident(route)) {
    return { ...base, mode: "LEGACY", reason: `confiance ${route.confidence.toFixed(2)} — repli généraliste` };
  }

  // ── 3. LA LECTURE CANONIQUE SÛRE — active dès maintenant ────────────────────────────────
  if (route.route === "FAST_DETERMINISTIC" && route.tool && SAFE_READ_TOOLS.has(route.tool)) {
    if (guardTripped()) {
      return { ...base, mode: "LEGACY", reason: `garde déclenchée : ${guardStatus().reason ?? "seuil dépassé"}` };
    }
    return { ...base, mode: "FAST_READ", reason: route.reason };
  }

  // Une forme rapide SANS outil sûr (relance de restitution, ou outil hors liste blanche) :
  // elle n'a rien de dangereux, mais elle n'a rien de canonique non plus.
  if (route.route === "FAST_DETERMINISTIC") {
    return { ...base, mode: "LEGACY", reason: "forme rapide sans outil canonique sûr" };
  }

  // ── 4. LE RESTE DES LECTURES — en canary ────────────────────────────────────────────────
  if (guardTripped()) {
    return { ...base, mode: "LEGACY", reason: `garde déclenchée : ${guardStatus().reason ?? "seuil dépassé"}` };
  }
  if (bucket < canaryPercent) {
    return { ...base, mode: "SHORTLIST", reason: `canary ${canaryPercent} % (seau ${bucket})` };
  }
  return { ...base, mode: "LEGACY", reason: `hors canary (seau ${bucket} ≥ ${canaryPercent})` };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// LA GARDE — le repli automatique de §8.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/**
 * CE QU'ELLE SURVEILLE, ET CE QU'ELLE NE PEUT PAS SURVEILLER.
 *
 * Elle tient une fenêtre glissante EN MÉMOIRE DU PROCESSUS. C'est un choix assumé et il a une
 * limite qu'il faut dire : avec plusieurs instances de serveur, chaque instance a sa propre
 * fenêtre. Elle protège donc son propre trafic, pas le trafic global.
 *
 * L'alternative — une écriture en base à chaque tour — coûterait une latence sur le chemin
 * critique pour surveiller un chemin qu'on a justement créé pour être rapide. À ce stade
 * (canary 20 %, lectures seulement), une garde par instance est le bon compromis ; elle devra
 * devenir partagée avant d'autoriser les mutations.
 *
 * LES SEUILS VIENNENT DE §8 ET NE SE NÉGOCIENT PAS À LA BAISSE pour faire passer un test :
 * mauvais outil > 1 %, outil manquant > 1 %.
 */
export interface OutcomeSample {
  /** L'outil appelé n'était pas celui qu'il fallait (mesurable seulement quand on le sait). */
  wrongTool?: boolean;
  /** Le modèle a réclamé un outil absent de la liste courte. */
  missingTool?: boolean;
  /** Le tour est retombé sur le généraliste. */
  fallback?: boolean;
}

const WINDOW = 500;
/** En dessous, aucun taux n'a de sens : trois erreurs sur cinq tours ne veulent rien dire. */
export const MIN_SAMPLES_BEFORE_TRIP = 50;
export const MAX_WRONG_TOOL_RATE = 0.01;
export const MAX_MISSING_TOOL_RATE = 0.01;

let samples: OutcomeSample[] = [];

export function recordOutcome(sample: OutcomeSample): void {
  samples.push(sample);
  if (samples.length > WINDOW) samples = samples.slice(-WINDOW);
}

/** Remet la fenêtre à zéro — réservé aux tests et à une réactivation manuelle après correctif. */
export function resetGuard(): void {
  samples = [];
}

export interface GuardStatus {
  samples: number;
  wrongToolRate: number;
  missingToolRate: number;
  fallbackRate: number;
  tripped: boolean;
  reason: string | null;
}

export function guardStatus(): GuardStatus {
  const n = samples.length;
  const rate = (pick: (s: OutcomeSample) => boolean | undefined) =>
    n === 0 ? 0 : samples.filter((s) => pick(s) === true).length / n;

  const wrongToolRate = rate((s) => s.wrongTool);
  const missingToolRate = rate((s) => s.missingTool);
  const fallbackRate = rate((s) => s.fallback);

  let reason: string | null = null;
  if (n >= MIN_SAMPLES_BEFORE_TRIP) {
    if (wrongToolRate > MAX_WRONG_TOOL_RATE) reason = `mauvais outil ${(wrongToolRate * 100).toFixed(1)} % > 1 %`;
    else if (missingToolRate > MAX_MISSING_TOOL_RATE) reason = `outil manquant ${(missingToolRate * 100).toFixed(1)} % > 1 %`;
  }
  return { samples: n, wrongToolRate, missingToolRate, fallbackRate, tripped: reason !== null, reason };
}

export const guardTripped = (): boolean => guardStatus().tripped;

/**
 * LE FEU VERT POUR L'ÉTAPE SUIVANTE (§9) — 20 % → 50 % → 100 %.
 *
 * Il exige les DEUX conditions, jamais une seule : un taux parfait sur trente tours ne prouve
 * rien, et un gros volume avec 3 % de mauvais outils ne vaut pas mieux.
 */
export function readyForNextStep(minSamples = 200): boolean {
  const s = guardStatus();
  return s.samples >= minSamples
    && s.wrongToolRate <= MAX_WRONG_TOOL_RATE
    && s.missingToolRate <= MAX_MISSING_TOOL_RATE;
}
