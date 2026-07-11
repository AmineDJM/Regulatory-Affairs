/**
 * TEMPLATES DOCUMENTAIRES VERSIONNÉS (G10). Chaque template décrit un document réglementaire
 * (blocs + lignes) avec des ESPACES RÉSERVÉS `{FACT_KEY}` remplis EXCLUSIVEMENT à partir du
 * jumeau numérique APPROUVÉ (jamais d'extraction libre). Placeholders méta : {DATE},
 * {DOSSIER_REF}, {DOSSIER_TITLE}, {PROCEDURE}.
 */

export interface DocBlock {
  heading?: string;
  lines: string[];
}

export interface TemplateDef {
  code: string;
  name: string;
  version: string;
  category: string;
  description: string;
  title: string; // titre du document (peut contenir des placeholders)
  blocks: DocBlock[];
}

const SIGNATURE: DocBlock = { heading: "Signature", lines: ["Pharmacien directeur technique : ______________________", "Date : {DATE}"] };

export const DOC_TEMPLATES: TemplateDef[] = [
  {
    code: "PRESUBMISSION_NOTE", name: "Note de pré-soumission", version: "1.0", category: "Pré-soumission",
    description: "Note de recevabilité avant dépôt ANPP, alimentée par le jumeau numérique approuvé.",
    title: "Note de pré-soumission — {PRODUCT_NAME}",
    blocks: [
      { heading: "Identification du produit", lines: ["Nom du produit : {PRODUCT_NAME}", "DCI / substance active : {INN}", "Dosage : {STRENGTH}", "Forme pharmaceutique : {DOSAGE_FORM}", "Voie d'administration : {ROUTE}"] },
      { heading: "Titulaire & fabrication", lines: ["Demandeur : {APPLICANT}", "Détenteur de l'AMM : {MAH}", "Fabricant : {MANUFACTURER}"] },
      { heading: "Procédure", lines: ["Type de procédure : {PROCEDURE}", "Référence dossier : {DOSSIER_REF}"] },
      SIGNATURE,
    ],
  },
  {
    code: "REGISTRATION_FORM", name: "Formulaire d'enregistrement", version: "1.0", category: "Enregistrement",
    description: "Formulaire administratif d'enregistrement initial.",
    title: "Demande d'enregistrement — {PRODUCT_NAME}",
    blocks: [
      { heading: "1. Produit", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}", "Dosage : {STRENGTH}", "Forme : {DOSAGE_FORM}", "Voie : {ROUTE}", "Conditionnement : {PACKAGING}"] },
      { heading: "2. Titulaire", lines: ["Demandeur : {APPLICANT}", "Détenteur AMM : {MAH}", "Exploitant : {OPERATOR}"] },
      { heading: "3. Fabrication", lines: ["Fabricant : {MANUFACTURER}", "Taille de lot : {BATCH_SIZE}"] },
      { heading: "4. Conservation", lines: ["Conditions de conservation : {STORAGE}", "Durée de conservation : {SHELF_LIFE}"] },
      { heading: "5. Certificats", lines: ["CPP : {CPP}", "GMP : {GMP}"] },
      SIGNATURE,
    ],
  },
  {
    code: "MODIFICATION_REQUEST", name: "Demande de modification", version: "1.0", category: "Modification",
    description: "Demande de variation post-AMM.",
    title: "Demande de modification — {PRODUCT_NAME}",
    blocks: [
      { heading: "Produit concerné", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}", "Dosage : {STRENGTH}", "Référence dossier : {DOSSIER_REF}"] },
      { heading: "Objet de la modification", lines: ["Description : ______________________", "Justification : ______________________"] },
      SIGNATURE,
    ],
  },
  {
    code: "RENEWAL_REQUEST", name: "Demande de renouvellement", version: "1.0", category: "Renouvellement",
    description: "Renouvellement quinquennal de l'AMM.",
    title: "Demande de renouvellement — {PRODUCT_NAME}",
    blocks: [
      { heading: "Produit", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}", "Détenteur AMM : {MAH}", "Référence dossier : {DOSSIER_REF}"] },
      { heading: "Données de suivi", lines: ["Durée de conservation confirmée : {SHELF_LIFE}", "Conditions de conservation : {STORAGE}"] },
      SIGNATURE,
    ],
  },
  {
    code: "TRANSFER_REQUEST", name: "Demande de transfert", version: "1.0", category: "Transfert",
    description: "Transfert de titulaire / exploitant.",
    title: "Demande de transfert — {PRODUCT_NAME}",
    blocks: [
      { heading: "Produit", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}"] },
      { heading: "Transfert", lines: ["Détenteur AMM (nouveau) : {MAH}", "Exploitant (nouveau) : {OPERATOR}"] },
      SIGNATURE,
    ],
  },
  {
    code: "THERAPEUTIC_INTEREST_NOTE", name: "Note d'intérêt thérapeutique", version: "1.0", category: "Note",
    description: "Note d'intérêt thérapeutique du produit.",
    title: "Note d'intérêt thérapeutique — {PRODUCT_NAME}",
    blocks: [
      { heading: "Produit", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}", "Dosage : {STRENGTH}", "Forme : {DOSAGE_FORM}"] },
      { heading: "Intérêt thérapeutique", lines: ["Indications : {INDICATIONS}", "Produit de référence : {REFERENCE_PRODUCT}"] },
      SIGNATURE,
    ],
  },
  {
    code: "COVER_LETTER", name: "Courrier d'accompagnement", version: "1.0", category: "Courrier",
    description: "Lettre d'accompagnement du dossier.",
    title: "Objet : Dépôt du dossier {PRODUCT_NAME}",
    blocks: [
      { lines: ["Adventum Pharma — {DATE}", "", "À l'attention de l'Agence Nationale des Produits Pharmaceutiques (ANPP)."] },
      { lines: ["Madame, Monsieur,", "Nous avons l'honneur de vous soumettre le dossier de {PROCEDURE} du produit {PRODUCT_NAME} ({INN}, {STRENGTH}).", "Référence dossier : {DOSSIER_REF}.", "Nous restons à votre disposition pour tout complément.", "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées."] },
      SIGNATURE,
    ],
  },
  {
    code: "DECLARATION", name: "Déclaration de conformité", version: "1.0", category: "Déclaration",
    description: "Déclaration sur l'honneur de conformité du dossier.",
    title: "Déclaration de conformité — {PRODUCT_NAME}",
    blocks: [
      { lines: ["Je soussigné(e), pharmacien directeur technique d'Adventum Pharma, déclare que le dossier du produit {PRODUCT_NAME} ({INN}) est conforme aux données du jumeau numérique approuvé et aux exigences ANPP en vigueur.", "Détenteur AMM : {MAH}. Fabricant : {MANUFACTURER}."] },
      SIGNATURE,
    ],
  },
  {
    code: "ANNEX_INDEX", name: "Index des annexes", version: "1.0", category: "Index",
    description: "Sommaire / index des annexes du dossier.",
    title: "Index des annexes — {PRODUCT_NAME} ({DOSSIER_REF})",
    blocks: [
      { heading: "Produit", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}", "Procédure : {PROCEDURE}"] },
      { heading: "Annexes", lines: ["(La liste des documents est générée depuis le manifeste du dossier.)"] },
    ],
  },
  {
    code: "PRODUCT_REPORT", name: "Rapport produit", version: "1.0", category: "Rapport",
    description: "Rapport de synthèse du produit (jumeau numérique).",
    title: "Rapport produit — {PRODUCT_NAME}",
    blocks: [
      { heading: "Identité", lines: ["Nom : {PRODUCT_NAME}", "DCI : {INN}", "Dosage : {STRENGTH}", "Forme : {DOSAGE_FORM}", "Voie : {ROUTE}"] },
      { heading: "Titulaire & fabrication", lines: ["Demandeur : {APPLICANT}", "Détenteur AMM : {MAH}", "Fabricant : {MANUFACTURER}", "Taille de lot : {BATCH_SIZE}"] },
      { heading: "Qualité & conservation", lines: ["Conservation : {STORAGE}", "Durée de conservation : {SHELF_LIFE}", "Conditionnement : {PACKAGING}", "CPP : {CPP}", "GMP : {GMP}"] },
    ],
  },
];

const BY_CODE = new Map(DOC_TEMPLATES.map((t) => [t.code, t]));
export function templateByCode(code: string): TemplateDef | undefined {
  return BY_CODE.get(code);
}

/** Résumé des templates (code/nom/catégorie/version) — pour l'UI. */
export function templateSummaries(): { code: string; name: string; category: string; version: string }[] {
  return DOC_TEMPLATES.map((t) => ({ code: t.code, name: t.name, category: t.category, version: t.version }));
}

/** Extrait les clés de faits `{KEY}` référencées par un template (hors placeholders méta). */
const META_KEYS = new Set(["DATE", "DOSSIER_REF", "DOSSIER_TITLE", "PROCEDURE"]);
export function factKeysOf(template: TemplateDef): string[] {
  const keys = new Set<string>();
  const scan = (s: string) => { for (const m of s.matchAll(/\{([A-Z_]+)\}/g)) if (!META_KEYS.has(m[1])) keys.add(m[1]); };
  scan(template.title);
  for (const b of template.blocks) { if (b.heading) scan(b.heading); for (const l of b.lines) scan(l); }
  return [...keys];
}
