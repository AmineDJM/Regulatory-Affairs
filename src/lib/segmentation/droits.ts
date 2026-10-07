import type { Prisma } from "@prisma/client";
import { userCan, clausePanelDuKam, type SessionUser } from "@/lib/rbac";

/**
 * QUI PEUT QUOI DANS LA SEGMENTATION — une seule lecture, pour l'écran et pour les actions (Direction, 07/10).
 *
 *   • Voir (SEGMENTATION · Voir) : le panel, la synthèse, les règles ;
 *   • Saisir (SEGMENTATION · Modifier) : Q1, Q2 et le statut d'un praticien — le terrain ;
 *   • Panel (SEGMENTATION · Créer) : ajouter ou retirer un praticien du panel ;
 *   • Valider (SEGMENTATION · Valider) : règles, fréquences, publication, import, stratégie, secteur d'une fiche ;
 *   • FORCER une lettre : le droit SEGMENTATION_POTENTIEL (case « Modifier »), que SEUL le Super Admin accorde,
 *     personne par personne. Qui l'a peut TOUT ce qui précède, sur toutes les lignes.
 */
export interface DroitsSegmentation {
  voir: boolean;
  saisir: boolean;
  panel: boolean;
  valider: boolean;
  forcer: boolean;
  toutesLignes: boolean;
}

export function peutForcerPotentiel(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || userCan(user, "SEGMENTATION_POTENTIEL", "UPDATE");
}

export function droitsSegmentation(user: SessionUser): DroitsSegmentation {
  const forcer = peutForcerPotentiel(user);
  const m = user.access.modules.get("SEGMENTATION");
  return {
    voir: forcer || userCan(user, "SEGMENTATION", "VIEW"),
    saisir: forcer || userCan(user, "SEGMENTATION", "UPDATE"),
    panel: forcer || userCan(user, "SEGMENTATION", "CREATE"),
    valider: forcer || userCan(user, "SEGMENTATION", "VALIDATE"),
    forcer,
    toutesLignes: forcer || !m || m.scope === "ALL",
  };
}

/** Les praticiens qu'on voit et touche : tous, ou son panel (secteur ∪ rattachement). */
export function porteeSegmentation(user: SessionUser): Prisma.MedicalDoctorWhereInput {
  return droitsSegmentation(user).toutesLignes ? {} : clausePanelDuKam(user.id);
}
