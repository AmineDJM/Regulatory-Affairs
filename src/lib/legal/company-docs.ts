/**
 * LES PIÈCES D'UNE ENTITÉ — et pourquoi le référentiel complet n'a rien à faire ici.
 *
 * Le sélecteur de nature des documents propose, par défaut, les quarante natures de toute la
 * plateforme : « CTD complet », « Module 3 », « Certificat GMP », « Réserves reçues (ANPP) »…
 * Sur la carte d'identité d'une société, aucune n'a de sens : on y dépose des statuts, un extrait
 * du registre de commerce, une attestation fiscale, un RIB scanné. Proposer un dossier
 * réglementaire à cet endroit, c'est faire chercher la bonne ligne dans une liste dont trente-cinq
 * entrées sont hors sujet — et finir par tout classer en « Autre ».
 *
 * Ce qui compte vraiment ici, c'est le NOM du document (« Statuts 2019 — version signée »), pas sa
 * case. La nature reste, courte, pour trier ; le nom se corrige ensuite d'un clic.
 *
 * Module PUR — testé, sans base de données.
 */

/** Les natures qui existent réellement dans un dossier de société. Rien de réglementaire. */
export const COMPANY_DOC_CATEGORIES = [
  "CONVENTION",
  "SUPPORTING_DOC",
  "INVOICE",
  "ID_DOCUMENT",
  "PHOTO",
  "OTHER",
] as const;

export type CompanyDocCategory = (typeof COMPANY_DOC_CATEGORIES)[number];

/** Une nature proposée ailleurs (CTD, module 3…) est-elle acceptable sur une entité ? */
export function isCompanyDocCategory(value: string | null | undefined): value is CompanyDocCategory {
  return Boolean(value) && (COMPANY_DOC_CATEGORIES as readonly string[]).includes(value as string);
}

/**
 * Le nom proposé pour une pièce déposée sans nom explicite : celui du fichier, sans son extension.
 *
 * « statuts-2019-signes.pdf » devient « statuts-2019-signes » — lisible, et surtout modifiable.
 * Un nom vide rendrait la ligne anonyme dans la liste ; on retombe alors sur « Document ».
 */
export function suggestDocumentName(fileName: string): string {
  const base = (fileName ?? "").trim().replace(/\.[A-Za-z0-9]{1,8}$/, "").trim();
  return base || "Document";
}
