/**
 * REGISTRE DES AGENTS SPÉCIALISÉS (G6) — 14 agents réglementaires, chacun avec un prompt
 * VERSIONNÉ, un périmètre CTD limité, des sources autorisées (filtre RAG), un seuil
 * d'abstention et des tests golden. Tous partagent le même noyau d'exécution encadré
 * (anti-injection, Zod, citations, jamais bloquant, jamais autonome — voir agent-core.ts).
 *
 * Règle d'or : si aucune source active ne justifie une conclusion, l'agent s'abstient et
 * renvoie « EXIGENCE NON CONFIRMÉE — REVUE HUMAINE REQUISE » (jamais d'invention).
 */

export interface AgentSpec {
  key: string;
  name: string;
  promptVersion: string; // versionné : toute évolution du prompt incrémente cette valeur
  role: string; // rôle (system prompt)
  focus: string[]; // axes d'analyse (guident le prompt ET la requête RAG)
  ctdScope: string[]; // préfixes CTD que l'agent examine ; [] = transverse (tous documents)
  authorities: string[]; // autorités de corpus autorisées (filtre RAG) ; [] = toutes
  jurisdiction?: string; // filtre juridiction RAG (optionnel)
  requiresSource: boolean; // true → sans citation de corpus actif, l'agent s'abstient
  maxDocs: number; // plafond de documents analysés (coût/latence bornés)
}

export const ABSTENTION_MESSAGE = "EXIGENCE NON CONFIRMÉE — REVUE HUMAINE REQUISE";

export const AGENTS: AgentSpec[] = [
  {
    key: "ALGERIA_M1", name: "Agent Module 1 (Algérie / ANPP)", promptVersion: "1.0",
    role: "expert du module 1 administratif algérien (ANPP) pour l'enregistrement des médicaments",
    focus: ["complétude administrative M1", "formulaire de demande", "certificat de libre vente / statut", "attestation GMP", "libellés RCP/notice/étiquetage", "droits d'enregistrement"],
    ctdScope: ["1"], authorities: ["ANPP"], jurisdiction: "DZ", requiresSource: true, maxDocs: 6,
  },
  {
    key: "CMC_SUBSTANCE", name: "Agent CMC — Substance active (3.2.S)", promptVersion: "1.0",
    role: "expert qualité (CMC) de la substance active, format CTD 3.2.S (ICH)",
    focus: ["caractérisation de la substance", "fabricant(s) et sites", "procédé de fabrication", "contrôle de la substance", "spécifications et méthodes", "impuretés", "stabilité de la substance"],
    ctdScope: ["3.2.S"], authorities: ["ANPP", "ICH"], requiresSource: true, maxDocs: 6,
  },
  {
    key: "CMC_PRODUCT", name: "Agent CMC — Produit fini (3.2.P)", promptVersion: "1.0",
    role: "expert qualité (CMC) du produit fini, format CTD 3.2.P (ICH)",
    focus: ["composition", "développement pharmaceutique", "procédé de fabrication et validation", "contrôle des excipients", "spécifications produit fini", "méthodes analytiques", "conditionnement"],
    ctdScope: ["3.2.P"], authorities: ["ANPP", "ICH"], requiresSource: true, maxDocs: 6,
  },
  {
    key: "ANALYTICAL", name: "Agent Analytique (méthodes & validation)", promptVersion: "1.0",
    role: "expert des méthodes analytiques et de leur validation (ICH Q2)",
    focus: ["description des méthodes", "validation analytique (spécificité, linéarité, exactitude, précision)", "cohérence méthodes/spécifications", "méthodes de dosage et impuretés"],
    ctdScope: ["3.2.S.4", "3.2.P.5"], authorities: ["ICH"], requiresSource: true, maxDocs: 5,
  },
  {
    key: "STABILITY", name: "Agent Stabilité (ICH Q1)", promptVersion: "1.0",
    role: "expert des études de stabilité (ICH Q1, zone climatique IVb pour l'Algérie)",
    focus: ["plan d'études de stabilité", "conditions (zone IVb 30°C/75%HR)", "durée de conservation revendiquée", "conditions de conservation", "tendances et spécifications de péremption"],
    ctdScope: ["3.2.S.7", "3.2.P.8"], authorities: ["ICH", "ANPP"], requiresSource: true, maxDocs: 5,
  },
  {
    key: "NONCLINICAL", name: "Agent Non clinique (Module 4)", promptVersion: "1.0",
    role: "expert de la documentation non clinique (pharmacologie, pharmacocinétique, toxicologie)",
    focus: ["pharmacologie", "pharmacocinétique non clinique", "toxicologie", "pertinence des études pour l'indication", "aperçu non clinique 2.4"],
    ctdScope: ["4"], authorities: ["ICH"], requiresSource: true, maxDocs: 5,
  },
  {
    key: "CLINICAL", name: "Agent Clinique (Module 5)", promptVersion: "1.0",
    role: "expert de la documentation clinique (efficacité, sécurité)",
    focus: ["études cliniques d'efficacité", "sécurité clinique", "cohérence avec l'indication revendiquée", "résumé clinique 2.5/2.7"],
    ctdScope: ["5"], authorities: ["ICH"], requiresSource: true, maxDocs: 5,
  },
  {
    key: "BIOEQUIVALENCE", name: "Agent Bioéquivalence (génériques)", promptVersion: "1.0",
    role: "expert de la bioéquivalence pour les médicaments génériques",
    focus: ["produit de référence", "design de l'étude de bioéquivalence", "critères IC 90% (80-125%)", "produit test = produit à enregistrer", "conditions d'exemption (biowaiver)"],
    ctdScope: ["5.3"], authorities: ["ANPP", "ICH"], requiresSource: true, maxDocs: 4,
  },
  {
    key: "PRODUCT_INFO", name: "Agent Information produit (RCP/notice/étiquetage)", promptVersion: "1.0",
    role: "expert de l'information produit (RCP, notice, étiquetage) conforme ANPP",
    focus: ["cohérence RCP / notice / étiquetage", "indications, posologie, contre-indications", "mentions obligatoires ANPP", "langue et lisibilité", "cohérence avec le dossier"],
    ctdScope: ["1.3"], authorities: ["ANPP"], jurisdiction: "DZ", requiresSource: true, maxDocs: 4,
  },
  {
    key: "CONSISTENCY_AUDITOR", name: "Agent Auditeur de cohérence (transverse)", promptVersion: "1.0",
    role: "auditeur de cohérence transversale du dossier (recoupement inter-documents)",
    focus: ["cohérence des données clés entre documents (DCI, dosage, forme, fabricant, durée de conservation)", "contradictions entre modules", "concordance nom/composition/étiquetage"],
    ctdScope: [], authorities: [], requiresSource: false, maxDocs: 8, // raisonne sur le dossier, pas sur le corpus
  },
  {
    key: "RECEIVABILITY", name: "Agent Recevabilité (pré-dépôt)", promptVersion: "1.0",
    role: "agent de recevabilité administrative (contrôle avant dépôt ANPP)",
    focus: ["pièces minimales de recevabilité", "présence du formulaire et des droits", "signatures et légalisations", "blocage éventuel à la recevabilité"],
    ctdScope: ["1"], authorities: ["ANPP"], jurisdiction: "DZ", requiresSource: true, maxDocs: 5,
  },
  {
    key: "RESERVE_RESPONSE", name: "Agent Réponse aux réserves", promptVersion: "1.0",
    role: "assistant de préparation des réponses aux réserves de l'ANPP",
    focus: ["compréhension de chaque réserve", "éléments de réponse fondés sur le dossier", "pièces justificatives à joindre", "points nécessitant un complément fournisseur"],
    ctdScope: [], authorities: ["ANPP"], requiresSource: false, maxDocs: 6,
  },
  {
    key: "SUPPLIER_COMM", name: "Agent Communication fournisseur", promptVersion: "1.0",
    role: "assistant de rédaction de demandes de compléments au fournisseur (brouillon uniquement)",
    focus: ["éléments manquants ou peu clairs à demander au fournisseur", "formulation factuelle et précise", "regroupement des questions par thème"],
    ctdScope: [], authorities: [], requiresSource: false, maxDocs: 8,
  },
  {
    key: "CHALLENGER", name: "Agent Challenger réglementaire", promptVersion: "1.0",
    role: "évaluateur critique interne qui challenge le dossier comme le ferait un examinateur",
    focus: ["faiblesses susceptibles de générer des réserves", "points d'attention prioritaires", "risques de non-recevabilité", "questions probables de l'examinateur"],
    ctdScope: [], authorities: ["ANPP", "ICH"], requiresSource: false, maxDocs: 8,
  },
];

const BY_KEY = new Map(AGENTS.map((a) => [a.key, a]));

export function agentByKey(key: string): AgentSpec | undefined {
  return BY_KEY.get(key);
}

/** Agents dont le périmètre CTD intersecte les sections présentes dans le dossier. */
export function agentsForSections(sections: string[]): AgentSpec[] {
  const present = sections.filter(Boolean);
  return AGENTS.filter(
    (a) => a.ctdScope.length === 0 || a.ctdScope.some((prefix) => present.some((s) => s === prefix || s.startsWith(`${prefix}.`) || prefix.startsWith(`${s}.`))),
  );
}
