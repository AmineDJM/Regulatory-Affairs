/**
 * CLASSIFICATION DOCUMENTAIRE DÉTERMINISTE — le Drive « sale » se comprend par le CONTENU.
 *
 * ── POURQUOI CE FICHIER VIT DANS `platform/` ─────────────────────────────────────────────
 *
 * « De quelle nature est ce document ? » est une question que l'ERP et Adam se posent tous les
 * deux, et à laquelle ils doivent répondre PAREIL — un écran Drive qui affiche « Facture » et un
 * assistant qui dit « Devis » du même fichier est une incohérence que l'utilisateur constate
 * avant nous. C'est donc un VOCABULAIRE PARTAGÉ, exactement ce que `platform/` héberge.
 *
 * Il était rangé dans `assistant/`, où seule Adam pouvait s'en servir ; la couche de connaissance
 * de l'ERP en a désormais besoin. Le déplacer ici plutôt que de le dupliquer garde UNE seule
 * table de signaux à corriger le jour où un format change. Le fichier n'importe RIEN, ce qui
 * satisfait la règle de `platform/` : la frontière ne dépend de personne.
 *
 * Règle : LE NOM EST UN INDICE, LE CONTENU EST LA PREUVE — un indice de nom vaut 1 point, une
 * preuve de contenu en vaut 3. Classifieur PUR (aucun appel réseau, aucun modèle) : il tourne
 * à chaque indexation (lecture ou ingestion planifiée) sans coût, et ses verdicts sont
 * reproductibles et testables. « unknown » est un verdict honnête, pas un échec.
 */

export type DocKind =
  | "employment_contract" | "amendment" | "job_description"
  | "invoice" | "quote" | "purchase_order" | "contract"
  | "identity_document" | "regulatory_document" | "correspondence"
  | "corporate_document" | "unknown";

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  employment_contract: "Contrat de travail",
  amendment: "Avenant",
  job_description: "Fiche de poste",
  invoice: "Facture",
  quote: "Devis",
  purchase_order: "Bon de commande",
  contract: "Contrat (commercial)",
  identity_document: "Pièce d'identité",
  regulatory_document: "Document réglementaire",
  correspondence: "Correspondance",
  corporate_document: "Document d'entreprise",
  unknown: "Non classé",
};

/** Minuscules sans accents — le même repli que la recherche. Les séparateurs de noms de
 *  fichiers (« facture_scan.pdf », « bon-de-commande.pdf ») deviennent des espaces : sans
 *  cela, `\b` ne voit pas la fin de « facture » devant un underscore. */
const fold = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-./]+/g, " ");

/** Indices par nature : chaque motif trouvé dans le NOM vaut 1, dans le CONTENU vaut 3. */
const SIGNALS: [DocKind, RegExp[]][] = [
  ["employment_contract", [/contrat de travail/, /\bcdi\b/, /\bcdd\b/, /periode d'essai/, /engage en qualite de/, /\bsalarie\b/, /le present contrat de travail/]],
  ["amendment", [/\bavenant\b/, /modifie le contrat/, /les autres clauses demeurent/]],
  ["job_description", [/fiche de poste/, /missions principales/, /rattachement hierarchique/, /profil recherche/, /description de poste/]],
  ["invoice", [/\bfacture\b/, /\binvoice\b/, /montant ttc/, /total ttc/, /net a payer/, /\btva\b.{0,40}\bmontant\b/]],
  ["quote", [/\bdevis\b/, /\bproforma\b/, /offre de prix/, /validite de l'offre/, /\bquotation\b/]],
  ["purchase_order", [/bon de commande/, /\bbc n/, /purchase order/, /\bp\.?o\.? n/, /nous vous passons commande/]],
  ["contract", [/\bcontrat\b/, /\bconvention\b/, /entre les soussignes/, /\bagreement\b/, /d'une part.{0,120}d'autre part/, /les parties conviennent/]],
  ["identity_document", [/carte nationale d'identite/, /\bpasseport\b/, /\bpassport\b/, /permis de conduire/]],
  ["regulatory_document", [/\banpp\b/, /decision d'enregistrement/, /\bamm\b/, /autorisation de mise sur le marche/, /\bctd\b/, /dossier pharmaceutique/, /certificat de conformite/]],
  ["correspondence", [/\bcourrier\b/, /objet\s*:/, /veuillez agreer/, /madame, monsieur/, /accusons reception/]],
  ["corporate_document", [/registre de commerce/, /statuts de la societe/, /proces[- ]verbal/, /assemblee generale/, /\bnif\b/, /identifiant fiscal/]],
];

/** Un CONTRAT DE TRAVAIL est aussi un contrat : la nature la plus SPÉCIFIQUE gagne à score égal. */
const SPECIFICITY: DocKind[] = [
  "employment_contract", "amendment", "job_description", "invoice", "quote",
  "purchase_order", "identity_document", "regulatory_document", "corporate_document",
  "correspondence", "contract", "unknown",
];

/**
 * Classifie un document depuis son nom et son contenu extrait (borné par l'appelant).
 * Score minimal 2 : un indice de nom SEUL (1 pt) ne suffit pas — sauf s'il n'y a aucun
 * contenu lisible, où le nom reste le seul témoignage disponible (score ≥ 1).
 */
export function classifyDocument(name: string, text: string | null | undefined): DocKind {
  const foldedName = fold(name ?? "");
  const foldedText = fold((text ?? "").slice(0, 12_000));
  let best: DocKind = "unknown";
  let bestScore = 0;
  for (const [kind, patterns] of SIGNALS) {
    let score = 0;
    for (const re of patterns) {
      if (re.test(foldedName)) score += 1;
      if (foldedText && re.test(foldedText)) score += 3;
    }
    const better = score > bestScore
      || (score === bestScore && score > 0 && SPECIFICITY.indexOf(kind) < SPECIFICITY.indexOf(best));
    if (better) { best = kind; bestScore = score; }
  }
  const minimum = foldedText ? 2 : 1;
  return bestScore >= minimum ? best : "unknown";
}
