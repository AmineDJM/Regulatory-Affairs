/**
 * LA CARTE D'IDENTITÉ LÉGALE ET FISCALE D'UNE ENTITÉ — quels champs, dans quel ordre, et lesquels
 * se copient.
 *
 * RC, NIF, NIS, article d'imposition, RIB : on les redemande dix fois par mois, sur un appel
 * d'offres, une facture, un contrat, un dossier bancaire. Recopiés de mémoire d'un vieux
 * document Word, ils arrivent avec une faute de frappe une fois sur cinq — sur un numéro à
 * quinze chiffres, personne ne la voit avant le rejet du dossier.
 *
 * Ce module décrit la carte : un ordre de lecture stable (identité → fiscalité → coordonnées →
 * banque → représentant), et pour chaque champ ce qu'on en fait. Il ne connaît ni la base ni
 * l'écran — l'ordre des champs d'un document officiel n'est pas une affaire de composant.
 *
 * Module PUR — testé.
 */

export interface IdentityField {
  key: string;
  label: string;
  /** Aide de saisie — la forme attendue, quand elle n'est pas évidente. */
  hint?: string;
  /**
   * Champ à COPIER d'un clic. Vrai pour les identifiants qu'on recolle ailleurs (numéros,
   * RIB, dénomination exacte) ; faux pour les notes, qu'on ne recolle jamais telles quelles.
   */
  copyable: boolean;
}

export interface IdentitySection {
  key: string;
  title: string;
  fields: IdentityField[];
}

export const IDENTITY_SECTIONS: IdentitySection[] = [
  {
    key: "identity", title: "Identité",
    fields: [
      { key: "legalName", label: "Dénomination exacte", hint: "Telle qu'elle figure au registre — souvent différente du nom d'usage.", copyable: true },
      { key: "legalForm", label: "Forme juridique", hint: "SARL, SPA, EURL…", copyable: true },
      { key: "shareCapital", label: "Capital social", hint: "Tel qu'aux statuts.", copyable: true },
    ],
  },
  {
    key: "tax", title: "Registre & fiscalité",
    fields: [
      { key: "rcNumber", label: "Registre de commerce (RC)", copyable: true },
      { key: "nif", label: "NIF", hint: "Numéro d'identification fiscale.", copyable: true },
      { key: "nis", label: "NIS", hint: "Numéro d'identification statistique.", copyable: true },
      { key: "taxArticle", label: "Article d'imposition", copyable: true },
    ],
  },
  {
    key: "contact", title: "Coordonnées",
    fields: [
      { key: "headOffice", label: "Siège social", copyable: true },
      { key: "phone", label: "Téléphone", copyable: true },
      { key: "email", label: "E-mail", copyable: true },
      { key: "website", label: "Site web", copyable: true },
    ],
  },
  {
    key: "bank", title: "Banque",
    fields: [
      { key: "bankName", label: "Banque", copyable: true },
      { key: "bankAgency", label: "Agence", copyable: true },
      { key: "rib", label: "RIB", hint: "20 chiffres.", copyable: true },
      { key: "iban", label: "IBAN", copyable: true },
      { key: "swift", label: "SWIFT / BIC", copyable: true },
    ],
  },
  {
    key: "manager", title: "Représentant légal",
    fields: [
      { key: "managerName", label: "Nom", copyable: true },
      { key: "managerTitle", label: "Qualité", hint: "Gérant, Président, Directeur Général…", copyable: true },
      { key: "notes", label: "Notes", copyable: false },
    ],
  },
];

/** Tous les champs de la carte, à plat — pour lire un formulaire sans oublier une section. */
export function identityFieldKeys(): string[] {
  return IDENTITY_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
}

/**
 * Le BLOC COPIABLE d'un coup — ce qu'on colle dans un appel d'offres.
 *
 * Seuls les champs RENSEIGNÉS y figurent : une ligne « NIS : — » collée dans un dossier
 * officiel est pire qu'une ligne absente, elle donne l'air d'avoir répondu.
 */
export function identityBlock(values: Record<string, string | null | undefined>): string {
  const lines: string[] = [];
  for (const section of IDENTITY_SECTIONS) {
    for (const f of section.fields) {
      if (!f.copyable) continue;
      const v = values[f.key];
      if (v && v.trim()) lines.push(`${f.label} : ${v.trim()}`);
    }
  }
  return lines.join("\n");
}

/** Combien de champs sont renseignés — pour dire « carte incomplète » sans faire compter. */
export function filledCount(values: Record<string, string | null | undefined>): { filled: number; total: number } {
  const keys = identityFieldKeys();
  const filled = keys.filter((k) => (values[k] ?? "").toString().trim().length > 0).length;
  return { filled, total: keys.length };
}
