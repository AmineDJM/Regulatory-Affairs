import { ENTITIES, type EntityDef } from "@/lib/api/registry/entities";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * DU MODÈLE PRISMA À L'ENTITÉ DU REGISTRE — écrit UNE fois, lu par deux mécanismes.
 *
 * `relire.ts` en a besoin pour relire la ligne qu'une action vient d'écrire ;
 * `resoudre-entrees.ts` pour savoir dans quel objet chercher « Nivolex ». Deux copies de cette
 * correspondance auraient divergé au premier modèle ajouté, et la divergence serait SILENCIEUSE :
 * l'une résoudrait, l'autre pas, sur le même objet (§118.5).
 *
 * La correspondance est mécanique — `regulatoryProduct` (le délégué) ↔ `RegulatoryProduct` (le
 * modèle) — donc dérivée, jamais déclarée : une table écrite à la main serait fausse à la
 * première entité ajoutée, en silence (§118.73).
 *
 * PLUSIEURS entités sur un même modèle n'en désignent AUCUNE : la collapser choisirait la
 * portée d'une entité pour lire les lignes d'une autre (§118.34).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function entiteDuModele(modele: string): EntityDef | null {
  const cible = modele.charAt(0).toLowerCase() + modele.slice(1);
  const trouvees = ENTITIES.filter((e) => e.model.charAt(0).toLowerCase() + e.model.slice(1) === cible);
  return trouvees.length === 1 ? trouvees[0]! : null;
}
