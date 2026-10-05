/**
 * LE TERRITOIRE D'UN KAM — ce qui se décide sans base (04/10/2026).
 *
 * Demande du dirigeant : dans une BU hospitalière, le territoire de chaque KAM se choisit SUR SA
 * LIGNE (« KAM de la BU ») — un ou plusieurs établissements de l'annuaire, et pour chacun tous ses
 * services ou certains —, et la section « Secteurs de la BU » disparaît. Dans une BU de ville, le
 * « secteur » reste un texte libre sur la ligne du KAM : il n'y a pas d'hôpital à cocher.
 *
 * Le territoire est STOCKÉ comme un `SalesSector` propre au KAM (`repId`) et porte sa ligne
 * `SalesSectorRep` : la règle du panel (`clausePanelDuKam`) et la portée des stocks le lisent sans
 * changer. Ce module est PUR (zéro import lourd) : l'écran (client) et l'action (serveur) lisent la
 * même règle — deux copies de « la BU est-elle hospitalière ? » finiraient par répondre deux choses,
 * et le symptôme serait un écran qui propose un territoire que l'action refuse (§118.5).
 */

/**
 * UNE BU EST HOSPITALIÈRE quand son terrain est l'hôpital, ou les deux — la règle vit dans
 * `sfe-setup.ts`, qui en a besoin pour l'étape de montage ; réexportée ici pour l'action et l'écran.
 */
export { estBuHospitaliere } from "@/lib/sfe-setup";

export const PREFIXE_TERRITOIRE = "Territoire — ";

/**
 * LE NOM D'UN TERRITOIRE. Le nom d'un secteur est unique dans sa BU : quand « Territoire — Amel
 * Haddad » est déjà pris (un ancien secteur, ou un homonyme), on y ajoute la fin de l'identifiant
 * du KAM. La migration `20270106093000_territoire_kam` écrit la MÊME règle en SQL
 * (`right(repId, 6)`) ; un banc compare les deux.
 */
export function nomDuTerritoire(nomKam: string | null | undefined, repId: string, dejaPris: boolean): string {
  const base = `${PREFIXE_TERRITOIRE}${(nomKam ?? "").trim() || "KAM"}`;
  return dejaPris ? `${base} · ${repId.slice(-6)}` : base;
}

/** Ce qu'un territoire couvre, compté : un territoire sans établissement donne un panel VIDE. */
export interface TerritoireResume {
  repId: string;
  etablissements: number;
}

/**
 * LES KAM ACTIFS SANS TERRITOIRE — ceux dont le territoire n'a aucun établissement (ou qui n'en ont
 * pas). Un KAM inactif ne bloque pas le montage : il ne planifie pas.
 */
export function kamsSansTerritoire(
  kams: { repId: string; name: string; isActive: boolean }[],
  territoires: TerritoireResume[],
): string[] {
  const couverts = new Set(territoires.filter((t) => t.etablissements > 0).map((t) => t.repId));
  return kams.filter((k) => k.isActive && !couverts.has(k.repId)).map((k) => k.name);
}
