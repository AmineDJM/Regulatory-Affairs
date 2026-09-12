import { prisma } from "@/lib/prisma";
import { reglageDepuisJson, type ReglageTournee } from "@/lib/sfe/tournee";

/**
 * LE RÉGLAGE DE LA PLANIFICATION DE TOURNÉE, LU UNE FOIS.
 *
 * Trois lecteurs relisaient `SfeSettings.tourPlanning` chacun à sa façon — l'action qui ouvre un
 * plan, la page du plan, et bientôt le tableau de bord de la Direction. Trois lectures d'un même
 * JSON finissent par lire trois réglages (§118.5) : celle-ci est la seule, et la LECTURE des
 * défauts est dans le module pur (`reglageDepuisJson`), testée sans base.
 *
 * Pas de `.catch(() => null)` : une base qui ne répond pas doit se voir, pas se lire comme
 * « mensuel ». Une ligne absente, elle, ne lève pas — `findUnique` rend `null`, et le module pur
 * rend les défauts.
 */
export async function lireReglageTournee(): Promise<ReglageTournee> {
  const row = await prisma.sfeSettings.findUnique({ where: { id: "global" }, select: { tourPlanning: true } });
  return reglageDepuisJson(row?.tourPlanning ?? null);
}
