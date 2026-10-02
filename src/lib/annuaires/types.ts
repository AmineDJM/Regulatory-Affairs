/**
 * LES LIGNES DES ANNUAIRES — les types que l'ÉCRAN rend et que le CHARGEUR produit.
 *
 * Module PUR (zéro import), au socle : les composants client (`contacts-board`,
 * `people-directory`, `etablissements-table`, `directory-bar`) et le chargeur serveur
 * (`lib/queries/annuaires.ts`) en ont tous besoin, et aucun n'a le droit d'importer l'autre —
 * un composant client qui importerait le chargeur tirerait Prisma dans le navigateur, un
 * chargeur qui importerait un écran remonterait vers l'application. Les composants
 * RÉEXPORTENT ces types sous leur nom historique.
 */

/** Un établissement tel que la feuille le rend (`etablissements-table.tsx`). */
export interface EtablissementRow {
  id: string;
  name: string;
  type: string;
  sector: string;
  /** La wilaya, ramenée au nom officiel quand la valeur héritée le permet ; sinon telle quelle. */
  wilaya: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  /** Combien de praticiens de l'annuaire y sont rattachés — dans la PORTÉE de la personne. */
  doctorCount: number;
  /** Dans combien de SECTEURS commerciaux il entre. Supprimer un établissement les ampute. */
  sectorCount: number;
  /** SES SERVICES (§118.172), par ordre alphabétique — avec ce que chacun porte. */
  services: ServiceEtablissementRow[];
}

/**
 * UN ÉTABLISSEMENT TEL QUE LA FEUILLE DES PRATICIENS LE PROPOSE (§118.172) — avec ses services,
 * pour que la colonne « Service » d'une ligne ne propose QUE ceux de son établissement. Ici, et
 * non dans le chargeur : la grille est un composant client, et ce type est tout ce qu'elle en lit.
 */
export interface EtablissementOption {
  id: string;
  name: string;
  wilaya: string | null;
  isActive: boolean;
  services: { id: string; name: string }[];
}

/** Un service d'un établissement, tel que l'écran le liste et que la suppression le compte. */
export interface ServiceEtablissementRow {
  id: string;
  name: string;
  /** Les praticiens qui y sont rattachés — dans la portée de la personne, comme `doctorCount`. */
  doctorCount: number;
  /** Les secteurs qui le choisissent NOMMÉMENT (un secteur « tous les services » ne compte pas). */
  sectorCount: number;
}

/** Un annuaire NOMMÉ de praticiens (`directory-bar.tsx`). */
export interface DirectoryRow {
  id: string;
  name: string;
  companyId: string | null;
  companyLabel: string | null;
  doctorCount: number;
  /** Les personnes nommées sur cet annuaire. Vide = ouvert à tout le module. */
  accessUserIds: string[];
}

/** Un contact EXTERNE de la société — agence, livreur, transitaire (`contacts-board.tsx`). */
export interface ContactRow {
  id: string;
  name: string;
  kind: string | null;
  contactName: string | null;
  phone: string | null;
  phoneAlt: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  wilaya: string | null;
  rc: string | null;
  nif: string | null;
  rib: string | null;
  notes: string | null;
  isActive: boolean;
  companyId: string | null;
  companyLabel: string | null;
}

/** Une personne de l'entreprise et ses moyens de contact (`people-directory.tsx`). */
export interface DirectoryPerson {
  key: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  company: string | null;
  userId: string | null;
  employeeId: string | null;
  entryId: string | null;
  aliases: string[];
  endpoints: {
    id: string;
    channel: "EMAIL" | "PHONE" | "WHATSAPP";
    value: string;
    label: string | null;
    confidence: string;
    isPrimary: boolean;
  }[];
  /** Les adresses connues des fiches ERP, hors annuaire — affichées, jamais dupliquées. */
  erpEmails: string[];
}

/** Une spécialité du référentiel, telle que l'écran Annuaires › Spécialités la rend (§118.180). */
export interface SpecialiteRow {
  id: string;
  name: string;
  color: string | null;
  notes: string | null;
  /** Praticiens RATTACHÉS, dans la portée de la personne. */
  praticiens: number;
}

/**
 * UN LIBELLÉ HÉRITÉ — une spécialité écrite en TEXTE sur des fiches, sans lien vers le
 * référentiel, regroupée par son écriture (casse, accents, espaces mis à part).
 */
export interface LibelleHerite {
  /** L'écriture la plus fréquente, telle qu'on la lit sur les fiches. */
  libelle: string;
  /** Les autres écritures du même libellé (« cardiologie », « Cardiologie  »). */
  variantes: string[];
  praticiens: number;
  /** La spécialité du référentiel qu'il désigne déjà à coup sûr — nulle sinon. */
  designe: { id: string; name: string } | null;
}
