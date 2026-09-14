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
