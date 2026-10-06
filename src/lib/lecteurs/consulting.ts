/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PÔLE D'UN CONTRAT DE CONSULTING — Ad & Pro ou Ressources humaines (§118.150).
 *
 * « Transfère le consulting actuel de Consultant médical Atakor Minds, qui est dans Consulting
 * d'Ad&Pro, à un consulting en RH » (Direction, 09/2026). Un contrat de consulting était, par
 * construction, une dépense de PROMOTION : il vivait dans le module Consulting d'Ad & Pro, pesait
 * sur le budget Ad & Pro d'une gamme, passait par le centre de validation Ad & Pro au-dessus du
 * seuil, et ses bons de commande partaient au même centre. Or un consultant médical engagé comme
 * un membre de l'équipe relève des RH : il n'a rien à faire dans la liste des sponsorings, et ceux
 * qui suivent la promotion n'ont pas à lire sa rémunération.
 *
 * Côté RH, mesuré, il n'existait AUCUN endroit où déposer ce contrat : un consultant n'y existe
 * que comme demande de recrutement « Consulting », close « consultant externe » sans fiche ni
 * contrat à suivre. D'où un PÔLE sur le contrat plutôt qu'une copie : le même enregistrement —
 * sa référence, ses tâches, ses pièces, sa validation, son historique — change de maison sans rien
 * perdre, et un transfert se défait par le geste inverse.
 *
 * ── CE QUE LE PÔLE DÉCIDE ──────────────────────────────────────────────────────────────────
 *
 * Le MODULE qui garde le contrat : `CONSULTING` côté Ad & Pro, `RH` côté ressources humaines.
 * Tout ce qui demandait « a-t-il le droit sur ce contrat ? » lit désormais `MODULE_DU_POLE` — une
 * garde qui relirait `CONSULTING` en dur laisserait la promotion lire le contrat d'un consultant
 * RH, c'est-à-dire la porte ouverte à côté de la porte fermée (§118.71).
 *
 * ── POURQUOI AU SOCLE (`lecteurs/`) ─────────────────────────────────────────────────────────
 *
 * Module PUR (zéro import) qui répond à la question de `lecteurs/legal.ts`, pour une autre
 * pièce : « cette personne peut-elle ouvrir CE contrat ? » — par le module de son pôle. Écrit
 * d'abord sous `ad-pro/`, il a été refusé par la carte des domaines : le REGISTRE des objets
 * (`api/registry/entities`, au socle) doit borner les contrats aux pôles lisibles, et le socle ne
 * lit que le socle. Ils sont SEPT à en avoir besoin sans avoir le droit de se parler : le
 * registre, `entity-access`, l'aiguillage des bons de commande, les actions, les deux listes, la
 * fiche, et Adam par le pont. Une copie chez l'un aurait divergé au premier pôle ajouté — et la
 * version en retard serait celle qui laisse la promotion lire un contrat RH (§118.5, §118.71).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

export const POLES_CONSULTING = ["AD_PRO", "RH"] as const;
export type PoleConsulting = (typeof POLES_CONSULTING)[number];

/**
 * Le module qui garde un contrat de ce pôle — la seule traduction, écrite une fois. Les deux
 * valeurs sont des clés du RBAC (`Module`) : ce module n'importe rien, donc le typecheck des
 * appelants (`userCan(user, MODULE_DU_POLE[p], …)`) est ce qui tient cette correspondance.
 */
export const MODULE_DU_POLE = { AD_PRO: "CONSULTING", RH: "EMPLOYEES" } as const satisfies Record<PoleConsulting, string>;
export type ModulePoleConsulting = (typeof MODULE_DU_POLE)[PoleConsulting];

export const LIBELLE_POLE: Record<PoleConsulting, string> = {
  AD_PRO: "Ad & Pro",
  RH: "Ressources humaines",
};

/** Où la LISTE d'un pôle se lit — la fiche, elle, est commune (`/consulting/[id]`). */
export const CHEMIN_LISTE_POLE: Record<PoleConsulting, string> = {
  AD_PRO: "/consulting",
  RH: "/rh/consultants",
};

export function estPoleConsulting(v: unknown): v is PoleConsulting {
  return typeof v === "string" && (POLES_CONSULTING as readonly string[]).includes(v);
}

/** Le pôle d'une ligne lue en base — ce qu'on ne lit pas à coup sûr retombe sur Ad & Pro, le défaut du schéma. */
export function poleDe(v: unknown): PoleConsulting {
  return estPoleConsulting(v) ? v : "AD_PRO";
}

export function poleOppose(p: PoleConsulting): PoleConsulting {
  return p === "AD_PRO" ? "RH" : "AD_PRO";
}

/**
 * QUI PEUT TRANSFÉRER — il faut MODIFIER des deux côtés.
 *
 * Transférer, c'est retirer le contrat à ceux qui le suivaient et le confier à d'autres : le droit
 * de modifier le pôle de DÉPART seul permettrait de pousser un contrat chez les RH sans que ceux-ci
 * l'aient voulu ; celui d'ARRIVÉE seul permettrait aux RH de s'emparer d'une dépense de promotion.
 * Mesuré sur les rôles par défaut : Super Admin, Direction et Directeur Général — c'est-à-dire ceux
 * qui arbitrent déjà entre les deux.
 */
export function transfertAutorise(faits: { modifieDepart: boolean; modifieArrivee: boolean }): boolean {
  return faits.modifieDepart && faits.modifieArrivee;
}

export function refusTransfert(depart: PoleConsulting, arrivee: PoleConsulting): string {
  return `Transférer un contrat de ${LIBELLE_POLE[depart]} vers ${LIBELLE_POLE[arrivee]} demande le droit de modification `
    + `des DEUX modules (${MODULE_DU_POLE[depart]} et ${MODULE_DU_POLE[arrivee]}) — Direction, Directeur Général ou Super Admin.`;
}

/**
 * LES PÔLES QU'UNE PERSONNE PEUT LIRE — la clause du registre, donc de la résolution de cible
 * d'Adam et de l'API. Sans elle, la promotion retrouverait par une recherche le contrat qu'on
 * vient de lui retirer.
 *
 * Elle reçoit le PRÉDICAT de lecture (« voit-elle ce module ? ») et non deux booléens nommés : les
 * noms de modules vivent dans `MODULE_DU_POLE` et nulle part ailleurs. Un appelant qui écrirait
 * `lireRh: userCan(user, "RH", "VIEW")` recopierait la table, et un troisième pôle ajouté serait
 * oublié précisément là (§118.5).
 */
export function polesLisibles(peutVoir: (module: ModulePoleConsulting) => boolean): PoleConsulting[] {
  return POLES_CONSULTING.filter((p) => peutVoir(MODULE_DU_POLE[p]));
}
