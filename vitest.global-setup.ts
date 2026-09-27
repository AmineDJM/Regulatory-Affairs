/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE SIÈGE STABLE DU CENTRE DE VALIDATIONS — posé une fois par `npm test`, avant tout fichier.
 *
 * Tout bon de commande pose une demande de validation adressée au siège du centre : le PLUS
 * ANCIEN Directeur Général actif, à défaut le plus ancien Super Admin (`centreValidatorFrom`,
 * §118.148). La base de tests n'avait AUCUN Directeur Général permanent. Dès qu'un banc en créait
 * un pour ses propres besoins — douze fichiers le font —, c'était LUI que tous les autres bancs
 * désignaient comme validateur de leurs BC, le temps qu'il existe. Puis son banc voulait le
 * supprimer : la clé étrangère des étapes de validation l'en empêchait, le compte restait, et le
 * run suivant tombait sur l'unicité de son adresse. MESURÉ : `__refmkt__dg@t.dz`, 21 étapes de
 * validation posées par d'AUTRES bancs à son nom.
 *
 * Un siège créé le 1er janvier 2000 est plus ancien que tout compte qu'un banc peut créer : il
 * est TOUJOURS choisi, et plus aucun compte de banc ne l'est. Aucun mot de passe ne lui ouvre de
 * session (l'empreinte « ! » ne correspond à rien).
 *
 * Ce n'est pas une donnée de production, et rien ne peut en faire une : `prisma.ts` refuse, à son
 * import, toute base de tests qui ne soit pas LOCALE (§118.90) — ce fichier passe par lui.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export const SIEGE_DE_BANC = "siege-dg@banc-de-tests.local";

export async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const { prisma } = await import("./src/lib/prisma");
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    // Pas de base joignable : les bancs qui en ont besoin se sautent d'eux-mêmes (`describe.skip`).
    return;
  }
  const doyen = new Date("2000-01-01T00:00:00.000Z");
  await prisma.user.upsert({
    where: { email: SIEGE_DE_BANC },
    create: {
      email: SIEGE_DE_BANC, name: "Siège DG — banc de tests", passwordHash: "!",
      role: "GENERAL_MANAGER", isActive: true, createdAt: doyen,
    },
    update: { role: "GENERAL_MANAGER", isActive: true, createdAt: doyen },
  });
  await prisma.$disconnect();
}
