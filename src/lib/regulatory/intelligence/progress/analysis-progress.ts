/**
 * PROGRESSION VIVANTE DE L'ANALYSE CTD — du dépôt au verdict, sous les yeux du pharmacien.
 *
 * « Analyse en cours » était une boîte noire : rien ne disait où en était la machine ni combien
 * de temps il restait, sur un dossier de 262 fichiers qui prend de longues minutes. Cette fonction
 * transforme l'état RÉEL du pipeline (documents extraits, jobs terminés) en une progression
 * lisible : une étape courante, un pourcentage honnête, un temps restant estimé.
 *
 * Module PUR : aucun accès base, aucune horloge implicite (`now` est passé) — donc entièrement
 * testable. La requête serveur (query.ts) assemble l'entrée ; ici, uniquement du calcul.
 *
 * Les phases suivent la chaîne réelle du runner :
 *   réception → lecture des fichiers (+ OCR des scans) → extraction des données →
 *   contrôles de conformité → revue de fond par l'IA.
 * Chaque phase porte un POIDS : la lecture des fichiers domine (c'est elle qui prend le temps sur
 * un gros dossier), les contrôles déterministes sont rapides. Le pourcentage global est la somme
 * des poids des phases terminées + la fraction de la phase en cours.
 */

export type PhaseKey = "RECEPTION" | "EXTRACTION" | "OCR" | "DATA" | "RULES" | "AI_REVIEW";
export type PhaseState = "done" | "active" | "pending" | "skipped";

export interface PhaseView {
  key: PhaseKey;
  label: string;
  /** Détail contextuel (« 180 / 262 fichiers lus ») — vide si sans objet. */
  detail: string;
  state: PhaseState;
  /** Avancement 0..1 DANS cette phase (utile surtout pour la phase active). */
  fraction: number;
}

export interface AnalysisProgressInput {
  /** Statut du dossier (RegDossierStatus en chaîne). */
  dossierStatus: string;
  docsTotal: number;
  /** Documents ayant atteint un état d'extraction TERMINAL (texte, OCR requis résolu, ou écarté). */
  docsResolved: number;
  /** Documents encore en attente d'extraction (PENDING). */
  docsPending: number;
  /** Documents scannés à océriser (total identifié) et déjà océrisés. */
  ocrTotal: number;
  ocrDone: number;
  /** Jobs déterministes terminés. */
  factsDone: boolean;
  rulesDone: boolean;
  /** L'IA fait-elle partie du pipeline (clé configurée) ? Sinon la revue IA est « sautée ». */
  aiInPipeline: boolean;
  aiReviewDone: boolean;
  /**
   * Un lot différé (Batch, moitié prix) est réellement en vol → résultats sous 24 h.
   * ⚠️ Faux dès qu'une revue IMMÉDIATE tourne : c'est elle le travail courant, et afficher
   * « différé » pendant qu'une analyse immédiate travaille est un mensonge qui fige la barre.
   */
  aiBatchPending: boolean;
  /** Une revue de fond est en file ou en cours (voie immédiate). */
  aiJobActive: boolean;
  /** Fichiers déjà relus en profondeur par la revue en cours, et total à relire. */
  aiDocsReviewed: number;
  aiDocsTotal: number;
  /** Départ de la revue de fond en cours (ms) — donne l'ETA de cette phase. */
  aiStartedAtMs: number | null;
  /** Horodatage de départ de l'analyse (ms) — le plus ancien job de la version. */
  startedAtMs: number | null;
  nowMs: number;
}

export interface AnalysisProgress {
  /** Vrai quand il n'y a plus rien à attendre côté machine. */
  complete: boolean;
  /** L'analyse déterministe est finie mais la revue IA différée est encore attendue. */
  awaitingDeferred: boolean;
  /** 0..100, jamais régressif à l'intérieur d'une exécution donnée. */
  percent: number;
  phaseKey: PhaseKey | "DONE";
  phaseLabel: string;
  phases: PhaseView[];
  /** Secondes restantes estimées (null = non estimable / terminé / différé). */
  etaSeconds: number | null;
  /** Vrai si l'avancement semble à l'arrêt (aucun fichier lu depuis longtemps). */
  stalled: boolean;
}

const PHASE_LABELS: Record<PhaseKey, string> = {
  RECEPTION: "Réception & décompression",
  EXTRACTION: "Lecture des fichiers",
  OCR: "Reconnaissance de texte (scans)",
  DATA: "Extraction des données",
  RULES: "Contrôles de conformité",
  AI_REVIEW: "Revue de fond par l'IA",
};

/** Poids relatifs des phases (somme = 100). La lecture domine : c'est elle qu'on attend. */
const WEIGHTS: Record<PhaseKey, number> = {
  RECEPTION: 5,
  EXTRACTION: 45,
  OCR: 15,
  DATA: 10,
  RULES: 10,
  AI_REVIEW: 15,
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const pctFrac = (done: number, total: number) => (total <= 0 ? 1 : clamp01(done / total));

/** Au-delà de ce délai sans qu'un fichier n'avance, on considère l'analyse « en pause ». */
const STALL_MS = 3 * 60_000;

/**
 * Calcule la progression complète. PUR — testé.
 *
 * Principe du pourcentage : chaque phase « pèse » WEIGHTS[phase]. On additionne le poids PLEIN de
 * chaque phase achevée, plus la fraction courante de la phase active. Une phase sans objet (pas
 * de scan → OCR ; IA non configurée → revue IA) ne compte pas et son poids est reversé au tout,
 * de sorte que 100 % reste 100 % « utile ».
 */
export function computeAnalysisProgress(input: AnalysisProgressInput): AnalysisProgress {
  const hasOcr = input.ocrTotal > 0;
  const hasAi = input.aiInPipeline;

  // Phases RÉELLEMENT présentes → renormalisation des poids sur celles-ci.
  const active: PhaseKey[] = ["RECEPTION", "EXTRACTION"];
  if (hasOcr) active.push("OCR");
  active.push("DATA", "RULES");
  if (hasAi) active.push("AI_REVIEW");
  const totalWeight = active.reduce((s, k) => s + WEIGHTS[k], 0);

  // Fraction d'avancement de chaque phase présente (0..1).
  const extractionFrac = input.docsTotal > 0 ? pctFrac(input.docsResolved, input.docsTotal) : (input.dossierStatus === "INGESTING" ? 0 : 1);
  const receptionDone = input.docsTotal > 0 || input.dossierStatus === "INGESTED" || input.dossierStatus === "ANALYSING" || input.dossierStatus === "IN_REVIEW";
  const rulesDone = input.rulesDone || input.dossierStatus === "IN_REVIEW";
  const factsDone = input.factsDone || rulesDone;
  const extractionDone = input.docsPending === 0 && input.docsTotal > 0 && (factsDone || input.dossierStatus === "ANALYSING" || rulesDone);
  const ocrDone = !hasOcr || input.ocrDone >= input.ocrTotal;
  const aiDone = !hasAi || input.aiReviewDone;

  const fractions: Record<PhaseKey, number> = {
    RECEPTION: receptionDone ? 1 : clamp01(extractionFrac > 0 ? 1 : 0.4),
    EXTRACTION: extractionDone ? 1 : extractionFrac,
    OCR: hasOcr ? (ocrDone ? 1 : pctFrac(input.ocrDone, input.ocrTotal)) : 1,
    DATA: factsDone ? 1 : 0,
    RULES: rulesDone ? 1 : 0,
    // La revue de fond avance FICHIER PAR FICHIER quand elle tourne en immédiat : on montre cette
    // progression réelle plutôt qu'un forfait figé (c'est ce qui bloquait la barre à 87 %).
    AI_REVIEW: !hasAi ? 1
      : aiDone ? 1
      : input.aiBatchPending ? 0.15
      : input.aiJobActive && input.aiDocsTotal > 0 ? clamp01(input.aiDocsReviewed / input.aiDocsTotal)
      : input.aiJobActive ? 0.05
      : 0,
  };

  // Pourcentage global renormalisé.
  const earned = active.reduce((s, k) => s + WEIGHTS[k] * fractions[k], 0);
  let percent = Math.round((earned / totalWeight) * 100);

  // Détermination de la phase COURANTE : la première non terminée dans l'ordre.
  const order: PhaseKey[] = active;
  const doneMap: Record<PhaseKey, boolean> = {
    RECEPTION: receptionDone,
    EXTRACTION: extractionDone,
    OCR: ocrDone,
    DATA: factsDone,
    RULES: rulesDone,
    AI_REVIEW: aiDone,
  };
  let current: PhaseKey | "DONE" = "DONE";
  for (const k of order) {
    if (!doneMap[k]) { current = k; break; }
  }

  const awaitingDeferred = current === "AI_REVIEW" && input.aiBatchPending;
  const complete = current === "DONE" || (rulesDone && aiDone);
  if (complete) percent = 100;
  // Tant que ce n'est pas fini, on ne montre jamais 100 % (ni un 0 % décourageant en pleine lecture).
  else percent = Math.max(1, Math.min(99, percent));

  const phases: PhaseView[] = order.map((k) => ({
    key: k,
    label: PHASE_LABELS[k],
    detail: phaseDetail(k, input, fractions[k]),
    state: doneMap[k] ? "done" : k === current ? "active" : "pending",
    fraction: fractions[k],
  }));

  // ── ETA : projeté depuis le DÉBIT réel de lecture (la phase longue). Ailleurs, hint par phase.
  const elapsed = input.startedAtMs != null ? Math.max(0, input.nowMs - input.startedAtMs) : 0;
  let etaSeconds: number | null = null;
  let stalled = false;

  if (complete || awaitingDeferred) {
    etaSeconds = null;
  } else if ((current === "EXTRACTION" || current === "OCR" || current === "RECEPTION") && input.docsResolved > 0 && elapsed > 4000) {
    const perDocMs = elapsed / input.docsResolved;
    const remainingDocs = Math.max(input.docsPending, 0) + (hasOcr ? Math.max(input.ocrTotal - input.ocrDone, 0) : 0);
    // + un forfait pour les phases déterministes restantes (données + conformité) : ~une passe.
    const tailMs = 45_000;
    etaSeconds = Math.round((perDocMs * remainingDocs + tailMs) / 1000);
    // À l'arrêt ? Beaucoup restant mais le débit implique un temps déjà « anormalement » écoulé.
    stalled = remainingDocs > 0 && input.docsPending === input.docsTotal - input.docsResolved && elapsed > STALL_MS && perDocMs * remainingDocs > 6 * 3600_000;
  } else if (current === "DATA" || current === "RULES") {
    etaSeconds = 60; // déterministe et rapide — de l'ordre de la minute
  } else if (current === "AI_REVIEW" && input.aiStartedAtMs != null && input.aiDocsReviewed > 0 && input.aiDocsTotal > 0) {
    // Revue immédiate : le débit de relecture donne un temps restant HONNÊTE (elle est longue
    // sur un gros dossier — c'est justement là que le pharmacien a besoin de savoir).
    const perDocMs = Math.max(1, input.nowMs - input.aiStartedAtMs) / input.aiDocsReviewed;
    etaSeconds = Math.round((perDocMs * Math.max(0, input.aiDocsTotal - input.aiDocsReviewed)) / 1000);
  }

  return {
    complete,
    awaitingDeferred,
    percent,
    phaseKey: current,
    phaseLabel: current === "DONE" ? "Analyse terminée" : PHASE_LABELS[current],
    phases,
    etaSeconds,
    stalled,
  };
}

function phaseDetail(k: PhaseKey, input: AnalysisProgressInput, frac: number): string {
  switch (k) {
    case "RECEPTION":
      return input.docsTotal > 0 ? `${input.docsTotal} fichier(s) reçu(s)` : "Décompression de l'archive";
    case "EXTRACTION":
      return input.docsTotal > 0 ? `${Math.min(input.docsResolved, input.docsTotal)} / ${input.docsTotal} fichiers lus` : "";
    case "OCR":
      return input.ocrTotal > 0 ? `${Math.min(input.ocrDone, input.ocrTotal)} / ${input.ocrTotal} scans reconnus` : "";
    case "DATA":
      return frac >= 1 ? "Données extraites" : "Extraction des faits (DCI, dosage, conservation…)";
    case "RULES":
      return frac >= 1 ? "Conformité évaluée" : "Complétude, bloqueurs, cohérence";
    case "AI_REVIEW":
      if (input.aiBatchPending) return "Revue différée (moitié prix) — résultats sous 24 h";
      if (frac >= 1) return "Constats de fond produits";
      if (input.aiJobActive && input.aiDocsTotal > 0) return `${Math.min(input.aiDocsReviewed, input.aiDocsTotal)} / ${input.aiDocsTotal} fichiers relus en profondeur`;
      return "Lecture de fond, section par section";
  }
}

/** « 2 min 30 », « ~1 h 10 », « quelques secondes » — un temps qu'un humain lit sans convertir. */
export function formatEta(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 20) return "quelques secondes";
  if (seconds < 90) return `~${Math.round(seconds / 10) * 10} s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `~${h} h` : `~${h} h ${m} min`;
}
