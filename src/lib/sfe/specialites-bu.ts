import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES SPÉCIALITÉS D'UNE BUSINESS UNIT (§118.183) — les lire, les écrire, les raconter.
 *
 * « BU ≠ spécialité » : une BU vise une ou plusieurs spécialités du référentiel, dont une PRINCIPALE
 * facultative (elle sert l'affichage, elle ne restreint rien). L'écran envoie l'ensemble COMPLET :
 * décocher une spécialité la RETIRE — fusionner ferait une BU qui ne peut que grandir.
 *
 * POURQUOI UN MODULE ET NON DES AIDES DU FICHIER D'ACTIONS : la dérivation des contrats ne suit une
 * aide LOCALE que lorsqu'elle reçoit le formulaire. Restée dans `sales-planning-actions.ts`,
 * l'écriture de la table de liaison était INVISIBLE à la fiche des deux actions qui l'appellent — la
 * création d'une BU et l'enregistrement de ses spécialités déclaraient « écrit : journal » sur un
 * geste qui change ce que la BU vise. C'est le précédent de `ad-pro/repartition-ecriture.ts`
 * (§118.146) : l'écrivain vit dans un module que la dérivation LIT.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Ce que le formulaire demande, LU et VÉRIFIÉ avant toute écriture — ou la phrase du refus. */
export async function specialitesDemandees(
  ids: string[], principaleId: string | null,
): Promise<{ ok: true; ids: string[]; principaleId: string | null } | { ok: false; error: string }> {
  const uniques = [...new Set(ids.map((i) => i.trim()).filter(Boolean))];
  if (principaleId && !uniques.includes(principaleId)) {
    return { ok: false, error: "La spécialité principale doit faire partie des spécialités cochées." };
  }
  if (uniques.length === 0) return { ok: true, ids: [], principaleId: null };
  // UN IDENTIFIANT VÉRIFIÉ EN BASE : une spécialité fusionnée ou retirée entre l'ouverture de l'écran et
  // l'enregistrement partirait en violation de clé étrangère — une erreur technique là où la vérité est
  // « cette spécialité n'existe plus ».
  const connues = await prisma.medicalSpecialty.count({ where: { id: { in: uniques } } });
  if (connues !== uniques.length) {
    return { ok: false, error: `${uniques.length - connues} spécialité(s) cochée(s) n'existent plus dans le référentiel — rechargez l'écran.` };
  }
  return { ok: true, ids: uniques, principaleId };
}

/**
 * LE CORPS COMMUN de la création et de l'enregistrement — dans la transaction de l'appelant.
 *
 * L'ordre compte : la principale est retirée AVANT d'être reposée, sinon l'index partiel (« au plus une
 * principale par BU ») refuserait le passage de A à B dans la même transaction.
 */
export async function ecrireSpecialitesBu(
  tx: Prisma.TransactionClient, actorId: string, businessUnitId: string,
  ids: string[], principaleId: string | null,
): Promise<{ ajoutees: string[]; retirees: string[]; principaleAvant: string | null }> {
  const avant = await tx.businessUnitSpecialty.findMany({ where: { businessUnitId }, select: { specialtyId: true, principale: true } });
  const avantIds = avant.map((a) => a.specialtyId);
  await tx.businessUnitSpecialty.deleteMany({ where: { businessUnitId, specialtyId: { notIn: ids } } });
  await tx.businessUnitSpecialty.updateMany({ where: { businessUnitId, principale: true }, data: { principale: false } });
  if (ids.length) {
    await tx.businessUnitSpecialty.createMany({
      data: ids.map((specialtyId) => ({ businessUnitId, specialtyId, createdById: actorId })),
      skipDuplicates: true,
    });
  }
  if (principaleId) {
    await tx.businessUnitSpecialty.updateMany({ where: { businessUnitId, specialtyId: principaleId }, data: { principale: true } });
  }
  return {
    ajoutees: ids.filter((i) => !avantIds.includes(i)),
    retirees: avantIds.filter((i) => !ids.includes(i)),
    principaleAvant: avant.find((a) => a.principale)?.specialtyId ?? null,
  };
}

/**
 * LA PHRASE DE L'HISTORIQUE — ce qui entre, ce qui sort, et la principale quand elle change. `null` quand
 * rien n'a bougé : un enregistrement à l'identique n'a rien à raconter.
 */
export async function resumeSpecialitesBu(
  ecrit: { ajoutees: string[]; retirees: string[]; principaleAvant: string | null }, principaleId: string | null,
): Promise<string | null> {
  const principaleChange = ecrit.principaleAvant !== principaleId;
  if (!ecrit.ajoutees.length && !ecrit.retirees.length && !principaleChange) return null;
  const ids = [...new Set([...ecrit.ajoutees, ...ecrit.retirees, ...(principaleId ? [principaleId] : [])])];
  const noms = new Map((await prisma.medicalSpecialty.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const nom = (id: string) => noms.get(id) ?? "spécialité retirée";
  const parties: string[] = [];
  if (ecrit.ajoutees.length) parties.push(`+ ${ecrit.ajoutees.map(nom).join(", ")}`);
  if (ecrit.retirees.length) parties.push(`\u2212 ${ecrit.retirees.map(nom).join(", ")}`);
  if (principaleChange) parties.push(principaleId ? `principale : ${nom(principaleId)}` : "plus de principale");
  return parties.join(" ; ");
}
