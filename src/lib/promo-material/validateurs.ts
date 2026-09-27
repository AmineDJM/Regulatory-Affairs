/**
 * QUI VALIDE LA DEMANDE, ET QUI VALIDE LE DEVIS — la règle de la Direction, écrite une fois (§118.152).
 *
 * « Si le demandeur fait partie du département marketing, c'est la directrice marketing qui valide.
 * Si c'est quelqu'un hors marketing, c'est toujours son N+1 qui valide, jusqu'au maximum le
 * directeur des opérations. Si c'est le directeur des opérations lui-même qui demande, il ne faut
 * pas que le N+1 valide. » Et pour le devis : « si le demandeur est la directrice marketing, c'est
 * validé direct ; quelqu'un du département marketing, c'est la directrice marketing ; un KAM, un
 * délégué, c'est la cheffe de la Direction Marketing. »
 *
 * ── CE QUE L'ERP SAIT, ET CE QU'IL NE SAIT PAS ─────────────────────────────────────────────
 *
 * Il n'existe pas de « département marketing » marqué comme tel : `Department` n'a ni type ni
 * drapeau, et le seul fait qui dise « marketing » est le RÔLE Direction Marketing
 * (`PRODUCT_MANAGER`). Il n'existe pas non plus de rôle de « directrice » distinct : les membres
 * de la Direction Marketing et leur cheffe peuvent porter le même rôle.
 *
 * La règle se lit donc sur les DEUX faits que l'ERP porte vraiment — le rôle et la ligne
 * hiérarchique (`hr/reporting-line.ts`, la cascade canonique) :
 *   • la DIRECTRICE MARKETING d'une personne est la première porteuse du rôle AU-DESSUS d'elle
 *     dans sa chaîne, sous le plafond ;
 *   • la CHEFFE de la Direction Marketing est une porteuse du rôle qui n'en a aucune au-dessus ;
 *   • appartenir au département marketing, c'est avoir une directrice marketing au-dessus de soi.
 * Un nom de département (« Marketing ») aurait été plus court à écrire et faux au premier
 * renommage ; un rôle et une chaîne ne se renomment pas par inadvertance.
 *
 * ── LE PLAFOND ─────────────────────────────────────────────────────────────────────────────
 *
 * « Jusqu'au maximum le directeur des opérations. » La chaîne est lue du N+1 vers le haut et
 * s'arrête au premier compte au niveau du plafond — la Direction des opérations (`DIRECTION`,
 * §118.138) comme le Directeur des Opérations (`OPERATIONS_DIRECTOR`), les deux libellés que le
 * métier emploie pour la même fonction. Au-dessus (Directeur Général, Super Admin), on ne monte
 * pas : un N+1 qui s'y trouve cède la validation à la Direction des opérations. Et un demandeur
 * au plafond ou au-dessus n'a AUCUNE validation hiérarchique — il n'y a personne en dessous du
 * plafond qui puisse le juger, et au-dessus on ne monte pas.
 *
 * Module PUR — aucune base. L'appelant charge la chaîne (`getManagementChain`) et les rôles.
 */

import { ROLE_DIRECTION_MARKETING } from "@/lib/personnes/roles-vente";

export interface Personne {
  userId: string;
  role: string | null;
  secondaryRole?: string | null;
  /** Un compte inactif ne valide rien : une demande qui lui est adressée ne dort pas, elle disparaît. */
  actif: boolean;
}

/** Les deux libellés de la même fonction : la ligne hiérarchique ne monte pas au-delà. */
const AU_PLAFOND = ["DIRECTION", "OPERATIONS_DIRECTOR"] as const;
/** Ce qui est AU-DESSUS du plafond : on n'y adresse jamais une validation de demande. */
const AU_DESSUS = ["GENERAL_MANAGER", "SUPER_ADMIN"] as const;

function porte(p: { role: string | null; secondaryRole?: string | null }, role: string): boolean {
  return p.role === role || p.secondaryRole === role;
}

export function porteLaDirectionMarketing(p: { role: string | null; secondaryRole?: string | null }): boolean {
  return porte(p, ROLE_DIRECTION_MARKETING);
}

/** Au niveau du directeur des opérations, ou au-dessus. */
export function estAuPlafond(p: { role: string | null; secondaryRole?: string | null }): boolean {
  return [...AU_PLAFOND, ...AU_DESSUS].some((r) => porte(p, r));
}

/** Strictement au-dessus du plafond — le Directeur Général, le Super Admin. */
export function estAuDessusDuPlafond(p: { role: string | null; secondaryRole?: string | null }): boolean {
  return AU_DESSUS.some((r) => porte(p, r)) && !AU_PLAFOND.some((r) => porte(p, r));
}

/**
 * LA CHAÎNE UTILE : les comptes ACTIFS, du N+1 jusqu'au premier compte du plafond INCLUS.
 *
 * Au-delà du plafond, on ne lit plus : même une porteuse du rôle Direction Marketing qui s'y
 * trouverait ne serait pas « la directrice » d'un collaborateur — elle serait sa direction générale.
 */
export function chaineUtile(chaine: readonly Personne[]): Personne[] {
  const utile: Personne[] = [];
  for (const p of chaine) {
    if (!p.actif) continue;
    utile.push(p);
    if (estAuPlafond(p)) break;
  }
  return utile;
}

/** La directrice marketing de CETTE personne : la première porteuse du rôle au-dessus d'elle, sous le plafond. */
export function directriceMarketingDe(chaine: readonly Personne[]): Personne | null {
  return chaineUtile(chaine).find((p) => porteLaDirectionMarketing(p) && !estAuPlafond(p)) ?? null;
}

/**
 * CETTE PERSONNE EST-ELLE LA CHEFFE DE LA DIRECTION MARKETING ? Porteuse du rôle, et personne du
 * rôle au-dessus d'elle.
 *
 * Sans organigramme (chaîne vide), une porteuse du rôle est lue comme cheffe : c'est la conduite
 * d'avant ce lot (§118.138, « la Direction Marketing ne valide pas sa propre demande »), et la
 * règle ne peut pas distinguer ce que l'organigramme ne dit pas.
 */
export function estCheffeMarketing(personne: Personne, chaine: readonly Personne[]): boolean {
  return porteLaDirectionMarketing(personne) && directriceMarketingDe(chaine) === null;
}

export type ValidateurDemande =
  /** Aucune validation : la directrice marketing elle-même, ou un demandeur au plafond. */
  | { kind: "AUCUNE"; motif: string }
  /** Une personne NOMMÉE, figée à la création. */
  | { kind: "PERSONNE"; userId: string; qualite: "DIRECTRICE_MARKETING" | "N_PLUS_1"; motif: string }
  /** Le plafond : la Direction des opérations valide (le rôle — personne n'est nommé). */
  | { kind: "PLAFOND"; motif: string };

/** QUI VALIDE LA DEMANDE — l'étape 0 du circuit 2. */
export function validateurDeLaDemande(demandeur: Personne, chaine: readonly Personne[]): ValidateurDemande {
  if (estAuPlafond(demandeur)) {
    return { kind: "AUCUNE", motif: "Demande au niveau du directeur des opérations ou au-dessus : aucune validation hiérarchique — la chaîne ne monte pas au-delà." };
  }
  const directrice = directriceMarketingDe(chaine);
  if (directrice) {
    return { kind: "PERSONNE", userId: directrice.userId, qualite: "DIRECTRICE_MARKETING", motif: "Le demandeur appartient à la Direction Marketing : sa directrice valide la demande." };
  }
  if (porteLaDirectionMarketing(demandeur)) {
    return { kind: "AUCUNE", motif: "Demande de la directrice marketing elle-même : validée d'office." };
  }
  const n1 = chaineUtile(chaine)[0];
  if (n1 && !estAuDessusDuPlafond(n1)) {
    return { kind: "PERSONNE", userId: n1.userId, qualite: "N_PLUS_1", motif: "Le N+1 du demandeur valide la demande." };
  }
  return {
    kind: "PLAFOND",
    motif: n1
      ? "Le N+1 du demandeur est au-dessus du directeur des opérations : la Direction des opérations valide — la chaîne s'arrête au plafond."
      : "Aucun N+1 lisible dans l'organigramme : la Direction des opérations valide la demande.",
  };
}

/**
 * LES CHEFFES DE LA DIRECTION MARKETING, parmi les porteuses du rôle — celles qui valident le
 * devis d'un demandeur qui n'appartient pas au marketing (KAM, délégué…).
 *
 * Lues à l'étape, pas figées : c'est une FONCTION qu'on sollicite, pas une personne qu'on a
 * désignée — si la cheffe change, c'est la nouvelle qui tranche les devis en attente.
 *
 * Dans une hiérarchie saine il y en a toujours au moins une : la porteuse la plus haute. Une
 * hiérarchie mal saisie peut boucler (A sous B, B sous A) — `managementChainOf` s'arrête alors
 * sans sommet, et chaque porteuse en voit une autre au-dessus d'elle. Dans ce cas seulement, toutes
 * les porteuses actives valident : c'est la règle d'avant ce lot, et refuser toute validation
 * parce que l'organigramme est faux laisserait des dossiers que personne ne peut faire avancer.
 */
export function cheffesMarketing(porteuses: readonly { personne: Personne; chaine: readonly Personne[] }[]): string[] {
  const actives = porteuses.filter((p) => p.personne.actif && porteLaDirectionMarketing(p.personne));
  const cheffes = actives.filter((p) => estCheffeMarketing(p.personne, p.chaine)).map((p) => p.personne.userId);
  return cheffes.length > 0 ? cheffes : actives.map((p) => p.personne.userId);
}
