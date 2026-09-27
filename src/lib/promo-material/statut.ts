/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE STATUT D'UN DOSSIER DE MATÉRIEL PROMOTIONNEL — une seule lecture, quelle que soit sa version.
 *
 * Trois générations de dossiers vivent dans la même table :
 *   • l'ANCIEN circuit (seize statuts en file indienne) — `circuitState` NUL, le `status` fait foi ;
 *   • le CIRCUIT 1 (le circuit court) et le CIRCUIT 2 (§118.152) — `circuitState` fait foi, et le
 *     `status` hérité reste FIGÉ à sa valeur de création (« Prospection demandée ») pour toujours.
 *
 * ── LE DÉFAUT QUE CE MODULE FERME (§118.153) ─────────────────────────────────────────────
 *
 * Mesuré en parcours réel, écran par écran : la fiche et la liste du module lisaient bien
 * `circuitState`, mais CINQ autres lecteurs lisaient le `status` figé — le centre d'actions
 * (accueil « Validations à faire », boîte de décisions, et donc Adam), la liste unifiée Ad & Pro
 * (qui comptait « en attente de décision » un dossier terminé), la page du secrétariat, et les
 * deux panneaux qui montrent un dossier lié (postes Ad & Pro, prises en charge). Le Directeur
 * Général voyait « Prospection demandée — à valider » sur un dossier qu'il venait de valider, et
 * Adam le lui répétait. C'est §118.61 mot pour mot : la réparation avait DÉPLACÉ une donnée, et
 * personne n'était allé voir qui lisait l'ancienne.
 *
 * Une fonction, lue par tous : deux lectures du statut du même dossier finissent par afficher
 * deux états différents à deux personnes qui en parlent entre elles (§118.5).
 *
 * Module PUR — aucune base, importable par un composant client.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { PROMO_MATERIAL_STATUS, type BadgeTone } from "@/lib/labels";
import { libelleEtape, PROMO_STEPS, type PromoState } from "@/lib/promo-material/circuit";
import { adProState, type AdProState } from "@/lib/ad-pro/unified";

export interface DossierPromoStatut {
  status: string;
  circuitState: string | null;
  circuitVersion: number | null;
}

export interface StatutPromo {
  libelle: string;
  ton: BadgeTone;
}

/** L'état du circuit, s'il est lisible — `null` pour un dossier de l'ancien circuit (ou un état inconnu). */
function etatDuCircuit(pm: DossierPromoStatut): PromoState | null {
  const s = pm.circuitState;
  if (!s) return null;
  if (s === "REFUSED" || (PROMO_STEPS as readonly string[]).includes(s)) return s as PromoState;
  return null;
}

/** Le statut AFFICHÉ — l'étape du circuit quand il y en a un, sinon l'ancien statut. */
export function statutDuDossier(pm: DossierPromoStatut): StatutPromo {
  const etat = etatDuCircuit(pm);
  if (etat) {
    const libelle = libelleEtape(etat, pm.circuitVersion === 2 ? 2 : 1);
    const ton: BadgeTone = etat === "REFUSED" ? "danger" : etat === "COMPLETED" ? "success" : etat === "IN_EXECUTION" ? "info" : "warning";
    return { libelle, ton };
  }
  const connu = PROMO_MATERIAL_STATUS[pm.status as keyof typeof PROMO_MATERIAL_STATUS];
  return { libelle: connu?.label ?? pm.status, ton: connu?.tone ?? "neutral" };
}

/**
 * L'état UNIFIÉ Ad & Pro (en attente / validée / terminée / refusée) — la liste « Toutes les
 * demandes » compte ses cartes dessus. Un dossier à circuit : refusé, terminé, en exécution
 * (toutes ses validations obtenues : « validée »), sinon en attente d'une décision.
 */
export function etatAdProDuDossier(pm: DossierPromoStatut): AdProState {
  const etat = etatDuCircuit(pm);
  if (!etat) return adProState(pm.status);
  if (etat === "REFUSED") return "REFUSED";
  if (etat === "COMPLETED") return "DONE";
  if (etat === "IN_EXECUTION") return "APPROVED";
  return "AWAITING";
}
