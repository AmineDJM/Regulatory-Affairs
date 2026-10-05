import { cookies } from "next/headers";
import { prisma } from "./prisma";

/** Nom du cookie de « Vue exacte » (impersonation), honoré uniquement pour un Super Admin. */
export const IMPERSONATE_COOKIE = "amd_impersonate";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * UNE DEMANDE NE SE CRÉE PAS « COMME » QUELQU'UN — la Vue exacte lit en son nom, écrit au vôtre.
 *
 * « Quand un KAM recrée une demande Ad&Pro après une suppression, la nouvelle demande s'affiche
 * « Introuvable […] ne vous est pas visible » alors qu'elle apparaît dans le tableau Ad&Pro ; après
 * actualisation avec le compte admin ça marche » (Direction, 05/10).
 *
 * MESURÉ, par les vrais points d'entrée (`ad-pro/vue-exacte-creation.test.ts`) : avec un vrai KAM, la
 * fiche de la demande recréée s'ouvre — sponsoring, congrès international et national, événement,
 * y compris après la suppression de la première par le Super Admin. Le défaut n'est pas un cache : il
 * tient à la « Vue exacte ». Le Super Admin qui visualise l'ERP « comme » un KAM LIT en son nom
 * (`session.ts` honore le cookie) et ÉCRIT au sien (§118.184 : une vue n'est pas une usurpation, une
 * requête qui écrit ignore la vue). Créer une demande dans cet état produit donc :
 *   • une demande déposée par l'ADMINISTRATEUR — sans la gamme du KAM, sans son circuit ;
 *   • un tableau Ad&Pro qui la MONTRE, parce que la réponse de l'action est rendue côté écriture
 *     (le Super Admin, qui voit tout) ;
 *   • puis une fiche « Introuvable — ou ne vous est pas visible », parce que la navigation qui suit
 *     est une LECTURE, rendue pour le KAM visualisé, qui n'est pas le demandeur ;
 *   • et tout redevient normal « avec le compte admin », la vue quittée.
 *
 * Créer une demande est un geste qui n'a de sens qu'au nom de la personne qui la dépose : on ne
 * dépose pas « comme » un KAM, on dépose en son propre nom. Le geste est donc REFUSÉ pendant une Vue
 * exacte, avec la raison et le remède (quitter la vue, ou se connecter au compte). Refuser est plus
 * juste qu'accepter puis perdre la fiche : la demande ne naît pas, aucun fantôme n'entre dans les
 * listes, et rien ne ressemble à un cache.
 *
 * Hors requête (banc, battement), `cookies()` lève : personne ne visualise rien — rendu `null`.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Le nom de la personne que ce Super Admin visualise EN CE MOMENT, ou `null`. Mêmes conditions que
 * `session.ts` pour honorer la vue : session réelle Super Admin, cookie qui désigne une AUTRE personne,
 * et cette personne existe et est active — un cookie périmé ou forgé ne bloque rien.
 */
export async function personneVisualisee(user: { id: string; role: string }): Promise<string | null> {
  if (user.role !== "SUPER_ADMIN") return null;
  let cible: string | undefined;
  try {
    cible = cookies().get(IMPERSONATE_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!cible || cible === user.id) return null;
  const t = await prisma.user.findUnique({ where: { id: cible }, select: { name: true, isActive: true } });
  return t?.isActive ? t.name : null;
}

/** La phrase du refus — elle nomme la personne visualisée ET le remède. */
export function refusCreationSousVue(nom: string): string {
  return `Vous visualisez l'ERP comme ${nom} (Vue exacte) : une demande créée d'ici serait déposée au nom de l'administrateur, pas de ${nom}, et sa fiche ne s'ouvrirait pas dans cette vue (« Introuvable »). Quittez la Vue exacte depuis le bandeau en haut de l'écran pour créer la demande en votre nom — ou connectez-vous avec le compte de ${nom} pour tester son parcours.`;
}

/**
 * LE REFUS, d'un seul appel — pour les actions de CRÉATION d'une demande : `null` quand rien ne
 * s'oppose, sinon le résultat à rendre tel quel.
 */
export async function refuseSousVueExacte(user: { id: string; role: string }): Promise<{ ok: false; error: string } | null> {
  const nom = await personneVisualisee(user);
  return nom ? { ok: false, error: refusCreationSousVue(nom) } : null;
}
