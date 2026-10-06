import { canonicalWilaya } from "@/lib/medical/wilaya";
import { cleDeSpecialite } from "@/lib/annuaires/specialites";

/**
 * L'ÉTABLISSEMENT D'UN PRATICIEN, DÉDUIT DE SA WILAYA ET DE SA SPÉCIALITÉ (Direction, 06/10).
 *
 * « Lorsque la wilaya a un seul établissement hospitalier dans l'annuaire des établissements, le rattacher
 * automatiquement ; s'il y en a plusieurs, demander à trancher. Si la spécialité n'est un service disponible que
 * dans un seul établissement hospitalier de la wilaya, mettre automatiquement cet établissement. Service =
 * spécialité. »
 *
 * LA RÈGLE, dans l'ordre :
 *   1. Le SERVICE d'abord : parmi les hôpitaux ACTIFS de la wilaya, ceux qui ont un service portant le nom de la
 *      spécialité du praticien. UN SEUL → c'est lui, avec ce service. PLUSIEURS → à trancher entre eux.
 *   2. Sinon la WILAYA : UN SEUL hôpital actif dans la wilaya → c'est lui (et son service de la spécialité s'il en
 *      a un). PLUSIEURS → à trancher entre eux. AUCUN → rien.
 * Un « établissement hospitalier » est un CHU, un EPH ou un EHS de l'annuaire des établissements. Les cliniques,
 * cabinets et officines n'entrent pas dans la règle : un médecin hospitalier n'y est pas rattaché par déduction.
 *
 * SERVICE = SPÉCIALITÉ : le service d'un praticien est, dans son établissement, celui qui porte le nom de sa
 * spécialité (casse et accents mis à part) — jamais un autre, jamais deviné par ressemblance.
 *
 * Module PUR — testé sans base ; la feuille, l'ajout, l'import, la cellule et le rattachement en lot lisent la
 * MÊME règle.
 */

export const TYPES_HOSPITALIERS = ["CHU", "EPH", "EHS"] as const;

export interface EtablissementPourDeduction {
  id: string;
  name: string;
  wilaya: string | null;
  type: string;
  isActive: boolean;
  services: { id: string; name: string }[];
}

export type Deduction =
  | { statut: "unique"; institutionId: string; serviceId: string | null; raison: string }
  | { statut: "a_trancher"; candidats: string[]; raison: string }
  | { statut: "aucun"; raison: string };

/** Le service d'un établissement qui porte le nom de la spécialité — `null` s'il n'y en a pas (ou plusieurs). */
export function serviceDeLaSpecialite(etab: Pick<EtablissementPourDeduction, "services">, specialite: string | null | undefined): string | null {
  const cle = cleDeSpecialite(specialite ?? "");
  if (!cle) return null;
  const memes = etab.services.filter((s) => cleDeSpecialite(s.name) === cle);
  return memes.length === 1 ? memes[0].id : null;
}

/** Les hôpitaux ACTIFS d'une wilaya (wilaya ramenée à son nom officiel des deux côtés). */
export function hopitauxDeLaWilaya(etabs: readonly EtablissementPourDeduction[], wilaya: string | null | undefined): EtablissementPourDeduction[] {
  const w = canonicalWilaya(wilaya);
  if (!w) return [];
  return etabs.filter((e) => e.isActive && (TYPES_HOSPITALIERS as readonly string[]).includes(e.type) && canonicalWilaya(e.wilaya) === w);
}

export function deduireEtablissement(p: { wilaya: string | null; specialite: string | null }, etabs: readonly EtablissementPourDeduction[]): Deduction {
  const w = canonicalWilaya(p.wilaya);
  if (!w) return { statut: "aucun", raison: "Wilaya non renseignée." };
  const hopitaux = hopitauxDeLaWilaya(etabs, w);
  if (hopitaux.length === 0) return { statut: "aucun", raison: `Aucun établissement hospitalier (CHU, EPH, EHS) de la wilaya ${w} dans l'annuaire des établissements.` };
  if (p.specialite) {
    const avecService = hopitaux.filter((e) => serviceDeLaSpecialite(e, p.specialite) !== null);
    if (avecService.length === 1) {
      const e = avecService[0];
      return { statut: "unique", institutionId: e.id, serviceId: serviceDeLaSpecialite(e, p.specialite), raison: `Seul établissement hospitalier de ${w} avec un service ${p.specialite}.` };
    }
    if (avecService.length > 1) {
      return { statut: "a_trancher", candidats: avecService.map((e) => e.id), raison: `${avecService.length} établissements de ${w} ont un service ${p.specialite}.` };
    }
  }
  if (hopitaux.length === 1) {
    const e = hopitaux[0];
    return { statut: "unique", institutionId: e.id, serviceId: serviceDeLaSpecialite(e, p.specialite), raison: `Seul établissement hospitalier de la wilaya ${w}.` };
  }
  return { statut: "a_trancher", candidats: hopitaux.map((e) => e.id), raison: `${hopitaux.length} établissements hospitaliers dans la wilaya ${w}.` };
}

/**
 * CE QU'IL FAUT ÉCRIRE pour une fiche : l'établissement déduit quand elle n'en a pas, et le service de sa spécialité
 * quand elle a un établissement sans service. `null` = rien à écrire (déjà complet, ou à trancher, ou rien de sûr).
 */
export function complementDeFiche(
  f: { institutionId: string | null; serviceId: string | null; wilaya: string | null; specialite: string | null; institutionTexte?: string | null },
  etabs: readonly EtablissementPourDeduction[],
): { institutionId: string; institutionNom: string; serviceId: string | null; raison: string } | null {
  if (!f.institutionId) {
    // UN ÉTABLISSEMENT DÉJÀ ÉCRIT (sans lien) n'est pas remplacé par une déduction : il se rattache par son NOM
    // (`rattachement.ts`) — l'hôpital de la wilaya contredirait peut-être ce que la fiche dit.
    if (f.institutionTexte?.trim()) return null;
    const d = deduireEtablissement({ wilaya: f.wilaya, specialite: f.specialite }, etabs);
    if (d.statut !== "unique") return null;
    const e = etabs.find((x) => x.id === d.institutionId)!;
    return { institutionId: e.id, institutionNom: e.name, serviceId: d.serviceId, raison: d.raison };
  }
  if (f.serviceId) return null;
  const e = etabs.find((x) => x.id === f.institutionId);
  const s = e ? serviceDeLaSpecialite(e, f.specialite) : null;
  return e && s ? { institutionId: e.id, institutionNom: e.name, serviceId: s, raison: `Service = spécialité (${f.specialite}).` } : null;
}
