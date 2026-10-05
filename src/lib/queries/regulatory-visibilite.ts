import { scopeRegulatory, type SessionUser } from "@/lib/rbac";
import { companyScopedWhere, ficheScopedWhere, productRangeScope } from "@/lib/company";

/**
 * LE PÉRIMÈTRE VISIBLE D'UNE PERSONNE SUR REGULATORY — UNE règle, deux usages (§118.184).
 *
 * - `"liste"` : l'écran de suivi, le pipeline, les exports, la recherche, Adam — l'entité suit le
 *   sélecteur de l'en-tête (`companyScopedWhere`).
 * - `"fiche"` : la fiche ouverte par son lien et TOUTES les actions qui s'appuient sur `canAccessEntity`
 *   — l'entité porte sur toutes les sociétés auxquelles la personne a droit (`ficheScopedWhere`).
 *
 * L'audit a mesuré l'écart : la fiche ne composait que `scopeRegulatory`, sans entité ni gamme — un
 * responsable à portée « toutes les lignes » lisait ET modifiait le dossier d'une société à laquelle il
 * n'avait aucun droit. Les deux usages lisent maintenant la même portée métier et la même gamme ; seul le
 * périmètre d'entité diffère, et pour la raison écrite à côté de `ficheScopedWhere`.
 *
 * LA GAMME AFFINE L'ENTITÉ, elle ne la remplace pas ; ÊTRE NOMMÉ SUR UN DOSSIER PASSE AVANT LE FILTRE DE
 * GAMME (désigner quelqu'un dit « celui-ci aussi, délibérément ») ; le cloisonnement par ENTITÉ n'est jamais
 * contourné par une assignation. LES CLAUSES SE COMPOSENT EN `AND`, JAMAIS PAR ÉTALEMENT (§118.133, §118.177).
 */
export const NAMED_ON_DOSSIER = (userId: string) => ({
  OR: [
    { responsibleId: userId },
    { assistantId: userId },
    { assignedUsers: { some: { id: userId } } },
  ],
});

export async function clauseRegulatoryVisible(user: SessionUser, pour: "liste" | "fiche") {
  const rangeScope = await productRangeScope(user.id);
  const base = {
    AND: [
      scopeRegulatory(user),
      ...(rangeScope ? [{ OR: [rangeScope, NAMED_ON_DOSSIER(user.id)] }] : []),
    ],
  };
  return pour === "fiche" ? ficheScopedWhere(user.id, base) : companyScopedWhere(user.id, base);
}
