/**
 * Processus officiel d'enregistrement d'un médicament auprès de l'ANPP (Direction
 * Technique). Décrit en CODE (et non en base) pour rester simple à maintenir : pour
 * faire évoluer le processus, on édite ces listes. Le suivi par produit est stocké dans
 * deux champs JSON de `RegulatoryProduct` (workflow + checklist).
 *
 * Source : « Workflow du processus d'enregistrement des médicaments auprès de l'ANPP »
 * + « Checklist – Presubmission phase ». Pur (importable serveur et client).
 */

export type RegStepState = "TODO" | "DOING" | "DONE" | "BLOCKED";

export const REG_STEP_STATE: Record<RegStepState, { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  TODO: { label: "À faire", tone: "neutral" },
  DOING: { label: "En cours", tone: "info" },
  DONE: { label: "Fait", tone: "success" },
  BLOCKED: { label: "Bloqué", tone: "danger" },
};
export const REG_STEP_STATE_ORDER: RegStepState[] = ["TODO", "DOING", "DONE", "BLOCKED"];

export interface RegPhase { key: string; label: string }
export interface RegStep { key: string; phase: string; n: number; label: string; responsible: string; expected: string }

/** Les 5 grandes phases du processus. */
export const REG_PHASES: RegPhase[] = [
  { key: "PREP", label: "Préparation du dossier" },
  { key: "ADMIN", label: "Constitution administrative" },
  { key: "DEPOT", label: "Dépôt ANPP" },
  { key: "EVAL", label: "Évaluation ANPP" },
  { key: "FINAL", label: "Finalisation" },
];

/** Les 22 étapes officielles (numéro, libellé, responsable, résultat attendu). */
export const REG_STEPS: RegStep[] = [
  { key: "ctd", phase: "PREP", n: 1, label: "Réception du CTD complet", responsible: "Fournisseur / RA", expected: "Dossier complet" },
  { key: "sample", phase: "PREP", n: 2, label: "Réception de l'échantillon", responsible: "Fournisseur", expected: "Échantillon conforme (avant le démarrage de la procédure)" },
  { key: "bv25_req", phase: "PREP", n: 3, label: "Demande du BV 25 %", responsible: "RA", expected: "BV avec toutes les informations correctes du produit" },
  { key: "bv25_pay", phase: "PREP", n: 4, label: "Paiement du BV 25 %", responsible: "Finance", expected: "Paiement effectué" },
  { key: "presub_req", phase: "PREP", n: 5, label: "Demande de présoumission", responsible: "RA", expected: "Demande avec toutes les informations correctes" },
  { key: "presub_ans", phase: "PREP", n: 6, label: "Réponse de la présoumission", responsible: "ANPP", expected: "Favorable → continuer · Défavorable → corriger puis redemander" },
  { key: "bv75_req", phase: "ADMIN", n: 7, label: "Demande du BV 75 %", responsible: "RA", expected: "BV avec toutes les informations correctes" },
  { key: "module1", phase: "ADMIN", n: 8, label: "Collecte des documents du Module 1 (électroniques + légalisés)", responsible: "RA / Fournisseur", expected: "Documents valides et conformes (sans attendre obligatoirement la présoumission)" },
  { key: "docs_check", phase: "ADMIN", n: 9, label: "Vérification des documents", responsible: "RA", expected: "Contrôle des dates d'expiration et de la conformité" },
  { key: "bv75_pay", phase: "ADMIN", n: 10, label: "Paiement du BV 75 %", responsible: "Finance", expected: "Après constitution du dossier" },
  { key: "rdv", phase: "DEPOT", n: 11, label: "Prise de rendez-vous ANPP", responsible: "RA", expected: "Chaque mercredi à 10 h selon le calendrier ANPP (production / importation en alternance)" },
  { key: "depot", phase: "DEPOT", n: 12, label: "Dépôt du dossier", responsible: "RA", expected: "Dépôt officiel (physique) auprès de l'ANPP" },
  { key: "recevabilite", phase: "DEPOT", n: 13, label: "Notification de recevabilité", responsible: "ANPP", expected: "Recevable · Différé avec réserves (Module 1) · Irrecevable" },
  { key: "evaluation", phase: "EVAL", n: 14, label: "Évaluation ANPP", responsible: "ANPP", expected: "Technico-réglementaire, prix, évaluation scientifique" },
  { key: "reserves_recv", phase: "EVAL", n: 15, label: "Réception des réserves", responsible: "ANPP", expected: "Réserves de chaque sous-direction reçues séparément" },
  { key: "reserves_analyse", phase: "EVAL", n: 16, label: "Analyse et traduction des réserves", responsible: "RA", expected: "Analyse interne puis traduction" },
  { key: "reserves_transmit", phase: "EVAL", n: 17, label: "Transmission au laboratoire", responsible: "RA", expected: "Communication officielle des réserves" },
  { key: "reponses_recv", phase: "EVAL", n: 18, label: "Réception des réponses du laboratoire", responsible: "Fournisseur", expected: "Délai variable selon les réserves" },
  { key: "reponses_check", phase: "EVAL", n: 19, label: "Vérification des réponses", responsible: "RA", expected: "Toutes les réserves doivent être couvertes" },
  { key: "reponses_depot", phase: "EVAL", n: 20, label: "Dépôt des réponses auprès de l'ANPP", responsible: "RA", expected: "Transmission à l'ANPP" },
  { key: "commission", phase: "FINAL", n: 21, label: "Passage en commission", responsible: "ANPP", expected: "Après validation des réponses" },
  { key: "decision", phase: "FINAL", n: 22, label: "Décision d'enregistrement + attestation de prix", responsible: "ANPP", expected: "Clôture du processus" },
];

export interface RegChecklistItem { key: string; label: string; hint?: string }
export interface RegChecklistGroup { key: string; label: string; items: RegChecklistItem[] }

/** Checklist des documents de présoumission (constitution du Module 1 algérien). */
export const REG_CHECKLIST: RegChecklistGroup[] = [
  {
    key: "LEGALIZED", label: "Documents légalisés",
    items: [
      { key: "gmp_fp", label: "Certificat GMP valide du fabricant du produit fini (PF)" },
      { key: "ml_fp", label: "Licence de fabrication valide du fabricant du PF" },
      { key: "gmp_api", label: "Certificat GMP valide du fabricant de la substance active (API)" },
      { key: "ml_api", label: "Licence de fabrication valide du fabricant de l'API" },
      { key: "cpp", label: "Certificat de produit pharmaceutique (CPP) — destiné à l'Algérie (ou l'incluant)" },
      { key: "sample", label: "Échantillon du produit (identique au produit commercialisé au pays d'origine)" },
      { key: "ma", label: "Autorisation de mise sur le marché (AMM) du produit" },
      { key: "fob", label: "Certificat de prix FOB attesté par la chambre de commerce", hint: "Document électronique fourni par Pharmagene" },
    ],
  },
  {
    key: "ELECTRONIC", label: "Documents électroniques",
    items: [
      { key: "batch_corr", label: "Certificat de corrélation de lot (lot de l'échantillon)" },
      { key: "batch_release", label: "Certificat de libération de lot (libération au pays d'origine)" },
      { key: "coa_api", label: "CoA de l'API (fabricant et recontrôle)" },
      { key: "coa_fp", label: "CoA du produit fini" },
      { key: "coa_exc", label: "CoA des excipients (fabricant et recontrôle)" },
      { key: "smpc", label: "SmPC approuvé" },
      { key: "leaflet", label: "Notice (leaflet)" },
      { key: "artworks", label: "Artworks (versions PDF et AI)" },
      { key: "decl_same", label: "Déclaration : produit identique à celui commercialisé au pays d'origine" },
      { key: "dmf_cep", label: "Lettre d'accès au DMF de l'API / Certificat de conformité (CEP) à la Pharmacopée européenne" },
      { key: "module2", label: "Module 2" },
      { key: "module3", label: "Module 3" },
      { key: "module4", label: "Module 4" },
      { key: "module5", label: "Module 5" },
      { key: "stability", label: "Lettre d'engagement à poursuivre les études de stabilité (si en cours)" },
      { key: "bioeq", label: "Justification d'exemption des études de bioéquivalence (si applicable)" },
    ],
  },
  {
    key: "PRESUBMISSION", label: "Documents de présoumission",
    items: [
      { key: "presub_module2", label: "Module 2" },
      { key: "form_te", label: "Formulaire thérapeutique et économique signé par le titulaire de l'AMM", hint: "Canevas fourni par Pharmagene — requis seulement si la molécule n'a jamais été enregistrée en Algérie" },
    ],
  },
];

// ───────────────────────── État stocké (JSON par produit) ─────────────────────────

export interface RegStepEntry { status?: RegStepState; date?: string; note?: string }
export type RegWorkflowState = Record<string, RegStepEntry>;
export interface RegChecklistEntry { checked?: boolean; note?: string }
export type RegChecklistState = Record<string, RegChecklistEntry>;

const VALID_STEP_KEYS = new Set(REG_STEPS.map((s) => s.key));
const VALID_ITEM_KEYS = new Set(REG_CHECKLIST.flatMap((g) => g.items.map((i) => i.key)));

export function isRegStepKey(k: string): boolean { return VALID_STEP_KEYS.has(k); }
export function isRegChecklistKey(k: string): boolean { return VALID_ITEM_KEYS.has(k); }
export function isRegStepState(s: string): s is RegStepState { return s === "TODO" || s === "DOING" || s === "DONE" || s === "BLOCKED"; }

export function regStepStatus(state: RegWorkflowState | null | undefined, key: string): RegStepState {
  return state?.[key]?.status ?? "TODO";
}

export interface RegProgress { done: number; total: number; pct: number; current: RegStep | null }

/** Avancement global + étape « courante » (1re étape non terminée dans l'ordre officiel). */
export function regProgress(state: RegWorkflowState | null | undefined): RegProgress {
  const total = REG_STEPS.length;
  let done = 0;
  let current: RegStep | null = null;
  for (const step of REG_STEPS) {
    const st = regStepStatus(state, step.key);
    if (st === "DONE") done += 1;
    else if (!current) current = step;
  }
  return { done, total, pct: Math.round((done / total) * 100), current };
}

/** Avancement de la checklist (cochés / total). */
export function regChecklistProgress(state: RegChecklistState | null | undefined): { checked: number; total: number; pct: number } {
  const total = VALID_ITEM_KEYS.size;
  let checked = 0;
  for (const k of VALID_ITEM_KEYS) if (state?.[k]?.checked) checked += 1;
  return { checked, total, pct: total ? Math.round((checked / total) * 100) : 0 };
}

export function phaseLabel(key: string): string {
  return REG_PHASES.find((p) => p.key === key)?.label ?? key;
}
