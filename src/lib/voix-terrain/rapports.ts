import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { texteDuRapport, type RapportTerrain } from "./pur";

/**
 * LES RAPPORTS DE TERRAIN D'UNE FENÊTRE — ce que « La voix du terrain » regroupe. Deux sources, sans doublon :
 *   • le compte rendu des visites TERMINÉES (`MedicalVisit.report`) ;
 *   • les rapports vocaux SANS visite rattachée (`FieldReport` : synthèse, sinon transcription) — un rapport rattaché à
 *     une visite est déjà lu par elle.
 * Périmètre : `null` = tous ; sinon les visites qui portent un produit du périmètre OU faites par un délégué du
 * périmètre (la BU), et les rapports vocaux de ces délégués.
 */
export async function chargerRapportsTerrain(input: {
  depuis: Date;
  perimetre: { productIds: readonly string[]; delegateIds: readonly string[] } | null;
  max?: number;
}): Promise<RapportTerrain[]> {
  const max = input.max ?? 250;
  const p = input.perimetre;
  if (p && p.productIds.length === 0 && p.delegateIds.length === 0) return [];
  const filtreVisite: Prisma.MedicalVisitWhereInput = p
    ? { OR: [
        ...(p.productIds.length ? [{ productLinks: { some: { productId: { in: [...p.productIds] } } } }] : []),
        ...(p.delegateIds.length ? [{ delegateId: { in: [...p.delegateIds] } }] : []),
      ] }
    : {};
  const [visites, vocaux] = await Promise.all([
    prisma.medicalVisit.findMany({
      where: { AND: [{ status: "COMPLETED", date: { gte: input.depuis }, report: { not: null } }, filtreVisite] },
      orderBy: { date: "desc" }, take: max,
      select: { id: true, report: true, delegateId: true },
    }),
    !p || p.delegateIds.length
      ? prisma.fieldReport.findMany({
          where: {
            visitDate: { gte: input.depuis }, visitId: null,
            OR: [{ summary: { not: null } }, { transcript: { not: null } }],
            ...(p ? { delegateId: { in: [...p.delegateIds] } } : {}),
          },
          orderBy: { visitDate: "desc" }, take: Math.ceil(max / 3),
          select: { id: true, summary: true, transcript: true, delegateId: true },
        })
      : Promise.resolve([]),
  ]);
  const out: RapportTerrain[] = [];
  for (const v of visites) {
    const t = texteDuRapport(v.report ?? "");
    if (t.length >= 8) out.push({ id: `v:${v.id}`, texte: t, delegateId: v.delegateId });
  }
  for (const f of vocaux) {
    const t = texteDuRapport(f.summary ?? f.transcript ?? "");
    if (t.length >= 8) out.push({ id: `r:${f.id}`, texte: t, delegateId: f.delegateId });
  }
  return out;
}
