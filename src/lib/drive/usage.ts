import { prisma } from "@/lib/prisma";
import { makeTtlCache } from "./quota";

/**
 * L'OCTET TOTAL DU STOCKAGE PHYSIQUE — la mesure qui coûtait cher à chaque téléversement.
 *
 * `SUM(size)` sur toute la table des blobs n'a aucun filtre : Postgres la parcourt entièrement.
 * C'était fait **par fichier envoyé**, donc six fois en parallèle sur un lot — avant le premier
 * octet écrit. Pour un garde-fou qui se compte en téra-octets, une relecture toutes les
 * 30 secondes suffit, et on ajoute au vol ce qu'on vient d'écrire pour rester juste en rafale.
 */
const CAPACITY_TTL_MS = 30_000;

const physicalCache = makeTtlCache(async () => {
  const agg = await prisma.fileBlob.aggregate({ _sum: { size: true } });
  return agg._sum.size ?? 0;
}, CAPACITY_TTL_MS);

/** Octets physiques occupés (contenu chiffré dédupliqué), à 30 secondes près. */
export function physicalUsageBytes(): Promise<number> {
  return physicalCache.get();
}

/**
 * Comptabilise des octets fraîchement écrits sans relire la table.
 *
 * À n'appeler que quand un blob NEUF a été créé : un contenu dédupliqué n'occupe pas de place
 * supplémentaire, et le compter gonflerait artificiellement l'occupation jusqu'à refuser des
 * envois qui tiennent parfaitement.
 */
export function addPhysicalUsage(bytes: number): void {
  physicalCache.patch((v) => v + bytes);
}

/** Oublie la mesure (après une purge de blobs orphelins, par exemple). */
export function forgetPhysicalUsage(): void {
  physicalCache.invalidate();
}

/**
 * Octets détenus par une personne — NON mis en cache, volontairement : c'est le plafond qui
 * refuse un envoi, et refuser à tort sur une valeur périmée serait incompréhensible. Il porte un
 * index sur `ownerId` : il est bon marché.
 */
export async function userUsageBytes(userId: string): Promise<number> {
  const agg = await prisma.driveNode.aggregate({
    where: { ownerId: userId, type: "FILE", isTrashed: false },
    _sum: { size: true },
  });
  return agg._sum.size ?? 0;
}
