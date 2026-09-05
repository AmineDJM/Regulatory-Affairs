import { prisma } from "@/lib/prisma";

/**
 * LE RÉVEIL D'UNE SURVEILLANCE PAR UN FAIT — « changement ERP → réveil », sans second registre.
 *
 * Le battement contrôle une surveillance à sa cadence (24 h par défaut). Mais un fait qui touche
 * la cible — un statut réglementaire qui change, une tâche terminée, un paiement reçu — ne doit
 * pas attendre demain matin : le registre d'événements (`recordEvent`) appelle cette fonction,
 * qui avance `nextCheckAt` à maintenant. Le prochain battement (≤ 60 s) relit la cible et
 * décide. Rien n'est évalué ICI : l'évaluation lit l'ERP, et cette façade n'y a pas accès.
 *
 * Idempotent, borné à une écriture, jamais bloquant pour l'émetteur.
 */
export async function reveillerSurveillances(fait: {
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  relatedRefs?: readonly string[];
}, maintenant = new Date()): Promise<number> {
  const cibles: { targetType: string; targetId: string }[] = [];
  if (fait.entityType && fait.entityId) cibles.push({ targetType: fait.entityType, targetId: fait.entityId });
  for (const ref of fait.relatedRefs ?? []) {
    const i = ref.indexOf(":");
    if (i > 0 && i < ref.length - 1) cibles.push({ targetType: ref.slice(0, i), targetId: ref.slice(i + 1) });
  }
  // Une personne surveillée (PERSONNE) se réveille sur ce qu'elle FAIT — son identifiant d'acteur.
  if (fait.actorId) cibles.push({ targetType: "PERSONNE", targetId: fait.actorId });
  if (cibles.length === 0) return 0;
  try {
    const r = await prisma.adamWatch.updateMany({
      where: { status: "ACTIVE", OR: cibles, nextCheckAt: { gt: maintenant } },
      data: { nextCheckAt: maintenant },
    });
    return r.count;
  } catch (e) {
    console.error("[surveillances] réveil impossible", fait.type, e);
    return 0;
  }
}
