/**
 * CATALOGUE DES SOURCES RÉGLEMENTAIRES — ce sur quoi l'analyseur a le droit de s'appuyer.
 *
 * Trois principes qui expliquent la forme de ce fichier :
 *
 * 1. **L'ordre compte.** Les dix premières sources (`priority: 1`) suffisent à analyser un
 *    dossier algérien. Le reste s'ajoute selon le type de produit. Ingérer tout d'un coup
 *    coûterait cher et noierait la recherche.
 *
 * 2. **Tout n'est pas ingérable.** La Pharmacopée européenne (EDQM) et l'ouvrage
 *    *International Pharmaceutical Product Registration* (CRC Press) sont **sous licence** :
 *    ils sont RÉFÉRENCÉS ici pour que l'équipe sache où chercher, mais leur contenu n'entre
 *    jamais dans le corpus. `ingestible: false` n'est pas un détail technique, c'est une
 *    limite juridique.
 *
 * 3. **Un brouillon n'est pas une règle.** ICH M4Q(R2) est un projet à l'étape 2 : marqué
 *    `binding: false`, il peut éclairer une architecture future mais ne doit JAMAIS fonder un
 *    finding bloquant.
 */

export type SourceAuthority = "ANPP" | "ICH" | "WHO" | "EMA" | "EDQM" | "OTHER";

export interface CatalogSource {
  /** Code stable, utilisé comme identifiant fonctionnel. */
  code: string;
  authority: SourceAuthority;
  jurisdiction: "DZ" | "ICH" | "INT" | "EU";
  title: string;
  url: string;
  /** 1 = à ingérer en premier ; 2 = selon le type de produit ; 3 = référence. */
  priority: 1 | 2 | 3;
  /** Faux = sous licence ou payant : on cite, on n'ingère pas. */
  ingestible: boolean;
  /** Faux = brouillon / non opposable : ne peut pas fonder un finding bloquant. */
  binding: boolean;
  /** Modules CTD principalement concernés — sert à cibler le RAG. */
  ctdModules?: string[];
  note?: string;
}

/**
 * Pages à SURVEILLER : l'ANPP publie et met à jour sans préavis. Une ligne directrice qui
 * change sans qu'on le sache, c'est une analyse qui devient fausse en silence.
 */
export const ANPP_WATCH_PAGES: { code: string; title: string; url: string }[] = [
  { code: "ANPP-GUIDELINES-INDEX", title: "ANPP — Lignes directrices (page maîtresse)", url: "https://anpp.dz/fr/guidelines/" },
  { code: "ANPP-NOTES-INDEX", title: "ANPP — Notes aux établissements pharmaceutiques", url: "https://anpp.dz/fr/notes/" },
];

export const CATALOG: CatalogSource[] = [
  // ─────────────────── A. ANPP — structure du CTD algérien (priorité absolue) ───────────────────
  {
    code: "ANPP-LD-CTD-2026", authority: "ANPP", jurisdiction: "DZ", priority: 1, ingestible: true, binding: true,
    title: "Ligne directrice — préparation et soumission des demandes d'enregistrement, de modification et de renouvellement (médecine humaine, Algérie)",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-pour-la-preparation-et-la-soumission-des-demandes-denregistrement-de-modification-et-de-renouvellement-des-produits-pharmaceutiques-a-usage-de-la-medecine-humaine-en-algerie/",
    ctdModules: ["M1", "M2", "M3", "M4", "M5"],
    note: "LE document de référence de l'analyseur. Créé le 9 février 2026, mis à jour le 5 mars 2026.",
  },
  {
    code: "ANPP-LD-RCP-NOTICE", authority: "ANPP", jurisdiction: "DZ", priority: 1, ingestible: true, binding: true,
    title: "Règles de rédaction de l'information produit — RCP, notice et conditionnement",
    url: "https://anpp.dz/fr/wpfd_file/regles-de-redaction-de-linformation-produit-rcp-notice-et-conditionnement-des-medicaments-destines-a-lusage-de-la-medecine-humaine/",
    ctdModules: ["M1"],
  },
  {
    code: "ANPP-LD-BIOEQ", authority: "ANPP", jurisdiction: "DZ", priority: 1, ingestible: true, binding: true,
    title: "Ligne directrice — exigences des études de bioéquivalence et d'équivalence thérapeutique",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-relative-aux-exigences-des-etudes-de-bioequivalence-et-dequivalence-therapeutique/",
    ctdModules: ["M5"],
  },
  {
    code: "ANPP-LD-MODIFICATIONS", authority: "ANPP", jurisdiction: "DZ", priority: 1, ingestible: true, binding: true,
    title: "Ligne directrice — modifications des décisions d'enregistrement",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-relative-a-la-modification-des-decision-denregistrement-des-produits-pharmaceutiques/",
  },
  {
    code: "ANPP-LD-RENOUVELLEMENT", authority: "ANPP", jurisdiction: "DZ", priority: 1, ingestible: true, binding: true,
    title: "Ligne directrice — prérequis du renouvellement de la décision d'enregistrement",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-relative-aux-prerequis-du-renouvellement-de-la-decision-denregistrement/",
  },
  {
    code: "ANPP-LD-ROLES", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Ligne directrice — rôles et responsabilités des entités impliquées dans la procédure d'enregistrement",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-relative-a-la-definition-des-roles-et-des-responsabilites-des-entites-impliquees-dans-la-procedure-denregistrement-des-produits-pharmaceutiques-au-sein-de-lanpp/",
  },
  {
    code: "ANPP-FORM-RENOUV", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Formulaire de demande de renouvellement — Fr-DEPP02-C V01",
    url: "https://anpp.dz/fr/wpfd_file/fr-depp02-c-v01-formulaire-de-demande-de-renouvellement/",
    ctdModules: ["M1"],
  },

  // ─────────────────── B. ANPP — reliance, reconnaissance, inspections ───────────────────
  {
    code: "ANPP-LD-RELIANCE", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Ligne directrice — confiance réglementaire et reconnaissance (enregistrement et modifications)",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-relative-a-la-confiance-reglementaire-et-a-la-reconnaissance-dans-le-cadre-de-lenregistrement-et-de-la-modification-des-decision-denregistrement/",
  },
  {
    code: "ANPP-LD-RELIANCE-LABO", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Ligne directrice — recours à la confiance réglementaire pour les tests de laboratoire",
    url: "https://anpp.dz/fr/wpfd_file/ligne-directrice-fixant-les-modalites-de-recours-a-la-confiance-reglementaire-et-a-la-reconnaissance-pour-les-tests-de-laboratoire-des-produits-pharmaceutiques-a-usage-de-la-medecine-humaine/",
    ctdModules: ["M3"],
  },
  {
    code: "ANPP-NOTE-43-BPF", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Note n° 43/2026 — confiance réglementaire et reconnaissance en inspection BPF",
    url: "https://anpp.dz/fr/wpfd_file/note-n43-2026-ligne-directrice-des-pratiques-de-la-confiance-reglementaire-reliance-et-de-reconnaisance-en-matiere-dinspection-des-bonnes-pratiques-de-fabrication/",
    ctdModules: ["M3"],
  },
  {
    code: "ANPP-LD-INSPECTIONS", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "LD-DVIV04V01 — Ligne directrice relative aux inspections réglementaires",
    url: "https://anpp.dz/fr/wpfd_file/ld-dviv04v01-ligne-directrice-inspections-reglementaires/",
  },

  // ─────────────────── C. ANPP — pharmacovigilance et distribution ───────────────────
  {
    code: "ANPP-GUIDE-PV-V2", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Guide algérien de bonnes pratiques de pharmacovigilance — version 2",
    url: "https://anpp.dz/wpfd_file/guide-algerien-de-bonnes-pratiques-de-pharmacovigilance-v2/",
    ctdModules: ["M1"],
  },
  {
    code: "ANPP-NOTE-37-PV", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Note n° 37/2026 — pratiques de confiance réglementaire en pharmacovigilance",
    url: "https://anpp.dz/fr/wpfd_file/note-n37-2026-relative-aux-pratiques-de-confiance-reglementaire-en-matiere-de-pharmacovigilance/",
  },
  {
    code: "ANPP-GUIDE-BPD", authority: "ANPP", jurisdiction: "DZ", priority: 2, ingestible: true, binding: true,
    title: "Guide des bonnes pratiques de distribution et de stockage",
    url: "https://anpp.dz/download/304/guidelines/21837/guide-des-bonnes-pratiques-de-distribution-et-de-stockage-des-produits-pharmaceutiques-et-des-dispositifs-medicaux-a-usage-humain.pdf",
    note: "PDF direct (la page officielle renvoie vers ce fichier).",
  },

  // ─────────────────── D. Architecture officielle du CTD — ICH ───────────────────
  {
    code: "ICH-M4-R4", authority: "ICH", jurisdiction: "ICH", priority: 1, ingestible: true, binding: true,
    title: "ICH M4(R4) — Organisation of the Common Technical Document",
    url: "https://database.ich.org/sites/default/files/M4_R4__Guideline.pdf",
    ctdModules: ["M1", "M2", "M3", "M4", "M5"],
  },
  {
    code: "ICH-M4Q-R1", authority: "ICH", jurisdiction: "ICH", priority: 1, ingestible: true, binding: true,
    title: "ICH M4Q(R1) — CTD Quality",
    url: "https://database.ich.org/sites/default/files/M4Q_R1_Guideline.pdf",
    ctdModules: ["M2", "M3"],
    note: "Structure qualité ACTIVE, sous réserve des exigences régionales ANPP.",
  },
  {
    code: "ICH-M4S-R2", authority: "ICH", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH M4S(R2) — Safety : Module 2 et organisation du Module 4",
    url: "https://database.ich.org/sites/default/files/M4S_R2_Guideline.pdf",
    ctdModules: ["M2", "M4"],
  },
  {
    code: "ICH-M4E-R2", authority: "ICH", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH M4E(R2) — Efficacy : Module 2 et organisation du Module 5",
    url: "https://database.ich.org/sites/default/files/M4E_R2__Guideline.pdf",
    ctdModules: ["M2", "M5"],
  },
  {
    code: "ICH-M4Q-R2-DRAFT", authority: "ICH", jurisdiction: "ICH", priority: 3, ingestible: true, binding: false,
    title: "ICH M4Q(R2) — projet, étape 2 (NON OPPOSABLE)",
    url: "https://database.ich.org/sites/default/files/ICH%20M4Q%28R2%29_Draft_Guideline_2025_0514.docx",
    ctdModules: ["M2", "M3"],
    note: "BROUILLON. Utile pour préparer l'avenir ; ne peut fonder aucun finding bloquant.",
  },
  {
    code: "ICH-M4Q-R2-MAPPING", authority: "ICH", jurisdiction: "ICH", priority: 3, ingestible: true, binding: false,
    title: "ICH — Correspondance M4Q(R1) → M4Q(R2)",
    url: "https://database.ich.org/sites/default/files/ICH_M4Q%28R2%29_MappingDocument_2026_0112.pdf",
    ctdModules: ["M3"],
  },

  // ─────────────────── E. OMS — Module 3 (générique multisource) ───────────────────
  {
    code: "WHO-TRS986-A6", authority: "WHO", jurisdiction: "INT", priority: 1, ingestible: true, binding: true,
    title: "WHO TRS 986, Annexe 6 — Documentation qualité d'un produit fini multisource (générique)",
    url: "https://www.who.int/docs/default-source/medicines/norms-and-standards/guidelines/regulatory-standards/trs986-annex6.pdf",
    ctdModules: ["M2", "M3"],
    note: "La meilleure ressource libre pour 2.3 QOS, 3.2.S, 3.2.P, spécifications, validation, lots, stabilité.",
  },

  // ─────────────────── F. ICH Quality — Module 3 ───────────────────
  {
    code: "ICH-Q2-R2", authority: "EMA", jurisdiction: "ICH", priority: 1, ingestible: true, binding: true,
    title: "ICH Q2(R2) — Validation des procédures analytiques",
    url: "https://www.ema.europa.eu/en/ich-q2r2-validation-analytical-procedures-scientific-guideline",
    ctdModules: ["M3"],
    note: "Version en vigueur depuis le 14 juin 2024.",
  },
  {
    code: "ICH-Q6A", authority: "EMA", jurisdiction: "ICH", priority: 1, ingestible: true, binding: true,
    title: "ICH Q6A — Spécifications : procédures d'essai et critères d'acceptation (substances chimiques)",
    url: "https://www.ema.europa.eu/en/ich-q6a-specifications-test-procedures-acceptance-criteria-new-drug-substances-new-drug-products-chemical-substances-scientific-guideline",
    ctdModules: ["M3"],
  },
  {
    code: "ICH-Q1A-R2", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH Q1A(R2) — Essais de stabilité",
    url: "https://www.ema.europa.eu/en/ich-q1a-r2-stability-testing-new-drug-substances-drug-products-scientific-guideline",
    ctdModules: ["M3"],
  },
  {
    code: "ICH-Q14", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH Q14 — Développement des procédures analytiques",
    url: "https://www.ema.europa.eu/en/ich-q14-analytical-procedure-development-scientific-guideline",
    ctdModules: ["M3"],
  },

  // ─────────────────── G. Modules 4 et 5 — sécurité, clinique, bioéquivalence ───────────────────
  {
    code: "ICH-E3", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH E3 — Structure et contenu des rapports d'étude clinique",
    url: "https://www.ema.europa.eu/en/ich-e3-structure-content-clinical-study-reports-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-E6-R3", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH E6(R3) — Bonnes pratiques cliniques",
    url: "https://www.ema.europa.eu/en/ich-e6-good-clinical-practice-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-E8-R1", authority: "EMA", jurisdiction: "ICH", priority: 3, ingestible: true, binding: true,
    title: "ICH E8(R1) — Considérations générales sur les études cliniques",
    url: "https://www.ema.europa.eu/en/ich-e8-general-considerations-clinical-studies-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-E9", authority: "EMA", jurisdiction: "ICH", priority: 3, ingestible: true, binding: true,
    title: "ICH E9 (+ addendum E9(R1)) — Principes statistiques des essais cliniques",
    url: "https://www.ema.europa.eu/en/ich-e9-statistical-principles-clinical-trials-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-E10", authority: "EMA", jurisdiction: "ICH", priority: 3, ingestible: true, binding: true,
    title: "ICH E10 — Choix du groupe contrôle",
    url: "https://www.ema.europa.eu/en/ich-e10-choice-control-group-clinical-trials-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-M9", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH M9 — Biowaivers fondés sur le système de classification biopharmaceutique",
    url: "https://www.ema.europa.eu/en/ich-m9-biopharmaceutics-classification-system-based-biowaivers-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-M10", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH M10 — Validation des méthodes bioanalytiques",
    url: "https://www.ema.europa.eu/en/ich-m10-bioanalytical-method-validation-scientific-guideline",
    ctdModules: ["M5"],
  },
  {
    code: "ICH-M13A", authority: "EMA", jurisdiction: "ICH", priority: 2, ingestible: true, binding: true,
    title: "ICH M13A — Bioéquivalence des formes orales solides à libération immédiate",
    url: "https://www.ema.europa.eu/en/ich-guideline-m13a-bioequivalence-immediate-release-solid-oral-dosage-forms-scientific-guideline",
    ctdModules: ["M5"],
    note: "Étape 5 en vigueur depuis le 25 janvier 2025.",
  },

  // ─────────────────── H. Index à consulter (non ingérés : ce sont des pages d'index) ───────────────────
  {
    code: "ICH-QUALITY-INDEX", authority: "ICH", jurisdiction: "ICH", priority: 3, ingestible: false, binding: true,
    title: "ICH — Index des lignes directrices Qualité (Q1 à Q14)",
    url: "https://www.ich.org/page/quality-guidelines",
    note: "Page d'index : y prendre uniquement les versions « Current Step 4 » et leurs Q&R.",
  },
  {
    code: "ICH-SAFETY-INDEX", authority: "ICH", jurisdiction: "ICH", priority: 3, ingestible: false, binding: true,
    title: "ICH — Index des lignes directrices Sécurité (série S)",
    url: "https://www.ich.org/page/safety-guidelines",
  },
  {
    code: "ICH-EFFICACY-INDEX", authority: "ICH", jurisdiction: "ICH", priority: 3, ingestible: false, binding: true,
    title: "ICH — Index des lignes directrices Efficacité (série E)",
    url: "https://www.ich.org/page/efficacy-guidelines",
  },
  {
    code: "ICH-MULTIDISC-INDEX", authority: "ICH", jurisdiction: "ICH", priority: 3, ingestible: false, binding: true,
    title: "ICH — Index des lignes directrices Multidisciplinaires (série M)",
    url: "https://www.ich.org/page/multidisciplinary-guidelines",
  },

  // ─────────────────── I. SOUS LICENCE — référencés, JAMAIS ingérés ───────────────────
  {
    code: "EDQM-PHEUR", authority: "EDQM", jurisdiction: "EU", priority: 3, ingestible: false, binding: true,
    title: "Pharmacopée européenne (EDQM)",
    url: "https://www.edqm.eu/en/web/edqm/european-pharmacopoeia",
    ctdModules: ["M3"],
    note: "SOUS LICENCE. Consultation via la plateforme EDQM. Ne jamais figer une ancienne copie dans le corpus : les textes en vigueur changent.",
  },
  {
    code: "CRC-IPPR-2E", authority: "OTHER", jurisdiction: "INT", priority: 3, ingestible: false, binding: false,
    title: "International Pharmaceutical Product Registration, 2ᵉ éd. — Cartwright & Matthews (CRC Press)",
    url: "https://www.routledge.com/International-Pharmaceutical-Product-Registration/Cartwright-Matthews/p/book/9781420081763",
    note: "OUVRAGE SOUS DROIT D'AUTEUR (ISBN 978-1-4200-8176-3). Ouvrage de référence interne — son contenu n'entre pas dans le corpus.",
  },
];

/** Les dix sources à ingérer en premier — elles suffisent à analyser un dossier algérien. */
export const FIRST_WAVE = CATALOG.filter((s) => s.priority === 1 && s.ingestible);

/** Ce qui peut réellement entrer dans le corpus (licences respectées). */
export const INGESTIBLE = CATALOG.filter((s) => s.ingestible);

/** Sources opposables uniquement — un brouillon ne fonde pas un finding bloquant. */
export const BINDING = CATALOG.filter((s) => s.binding);

/** Sources pertinentes pour un module CTD donné — sert à CIBLER le RAG. */
export function sourcesForModule(ctdModule: string): CatalogSource[] {
  return CATALOG.filter((s) => s.ingestible && (!s.ctdModules || s.ctdModules.includes(ctdModule)));
}

export function findSource(code: string): CatalogSource | undefined {
  return CATALOG.find((s) => s.code === code);
}
