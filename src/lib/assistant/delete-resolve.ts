import {
  DELETE_REGISTRY,
  deleteDelegateOf,
  type DeletableKind,
} from "@/lib/admin-delete-registry";

/**
 * RÉSOLUTION d'une cible de suppression pour le Chief of Staff — le pouvoir EN PLUS de l'écran.
 *
 * L'écran connaît déjà l'id (le bouton rouge vit sur la fiche) ; le Chief, lui, reçoit une
 * RÉFÉRENCE HUMAINE (« REG-2026-041 », un nom d'événement, un titre) et doit la résoudre sans
 * jamais choisir en silence :
 *   • un seul candidat → résolu ;
 *   • plusieurs candidats mais UNE correspondance exacte (le nom affiché commence par la
 *     référence donnée) → résolu ;
 *   • plusieurs candidats sans exactitude → AMBIGU, les candidats sont listés (même philosophie
 *     que `resolveOrg` : jamais de fusion muette) ;
 *   • rien → introuvable.
 *
 * La recherche s'appuie sur les `searchFields` déclarés PAR LE REGISTRE PARTAGÉ (une seule
 * source de vérité) ; un id interne copié d'un lien (/regulatory/<id>) résout toujours, ce qui
 * couvre aussi les types sans référence humaine (ex. demande RH).
 */
export type DeleteTargetResolution =
  | { status: "resolved"; id: string; name: string }
  | { status: "ambiguous"; candidates: { id: string; name: string }[] }
  | { status: "none" };

export async function resolveDeletableTarget(kind: DeletableKind, rawQuery: string): Promise<DeleteTargetResolution> {
  const spec = DELETE_REGISTRY[kind];
  const query = rawQuery.trim();
  if (!query) return { status: "none" };

  // 1) Un id interne exact (copié d'un lien) résout toujours — y compris les types sans
  //    champs de recherche. `describe` rend null si l'id n'existe pas : aucun coût d'erreur.
  const direct = await spec.describe(query).catch(() => null);
  if (direct) return { status: "resolved", id: query, name: direct };

  // 2) Référence humaine sur les champs déclarés par le registre.
  if (!spec.searchFields?.length) return { status: "none" };
  const rows = await deleteDelegateOf(spec).findMany({
    where: { OR: spec.searchFields.map((f) => ({ [f]: { contains: query, mode: "insensitive" } })) },
    select: { id: true },
    take: 8,
  });
  const candidates: { id: string; name: string }[] = [];
  for (const row of rows) {
    const name = await spec.describe(row.id);
    if (name) candidates.push({ id: row.id, name });
  }
  if (candidates.length === 0) return { status: "none" };
  if (candidates.length === 1) return { status: "resolved", ...candidates[0] };

  // Plusieurs candidats : seule une correspondance EXACTE (nom entier, ou référence en tête
  // du nom affiché « REF — libellé ») tranche — sinon on liste, on ne devine pas.
  const q = query.toLowerCase();
  const exact = candidates.filter((c) => {
    const n = c.name.toLowerCase();
    return n === q || n.startsWith(`${q} — `);
  });
  if (exact.length === 1) return { status: "resolved", ...exact[0] };
  return { status: "ambiguous", candidates };
}
