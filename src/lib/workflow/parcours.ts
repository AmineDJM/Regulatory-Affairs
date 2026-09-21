/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARCOURS D'UNE DEMANDE Ad & Pro — module PUR (sa seule dépendance est le SOCLE).
 *
 * ── CE QUE LA DIRECTION A TRANCHÉ (09/2026) ─────────────────────────────────────────────
 *
 * « Toutes les Ad&Pro, hors matériel promotionnel, devront passer par Direction des opérations
 * PUIS Direction Marketing à la fin, et pas l'inverse comme c'est le cas maintenant. C'est
 * d'ailleurs le mot de la Direction Marketing qui est définitif, et elle choisit le budget dans
 * lequel l'accorder. » Et, orthogonalement : « à partir de 1 000 000 DZD, la validation du DG. »
 *
 * L'ORDRE S'INVERSE donc, et la DÉCISION change de main :
 *
 *     préliminaire (National Sales)  →  DG (au-delà du seuil)  →  Direction  →  DIRECTION
 *     MARKETING, qui TRANCHE, fixe le montant accordé et choisit la sous-catégorie budgétaire.
 *
 * ── « DIRECTION DES OPÉRATIONS » EST LE RÔLE `DIRECTION` — LECTURE CONFIRMÉE ────────────
 *
 * Cette lecture était une DÉDUCTION lors du premier lot, et elle a été soumise à la Direction en
 * nommant le réglage d'une ligne qui la retournerait. La Direction a répondu « transforme
 * Direction en Direction des opérations » : c'est le rôle `DIRECTION` qu'elle désigne, et son
 * libellé a été rétabli en conséquence (`labels.ts`, `role-labels.test.ts`). La déduction
 * d'origine tenait sur deux faits — « pas l'inverse comme c'est le cas now » décrit un ÉCHANGE
 * entre les deux étapes existantes et non l'insertion d'un acteur, et le libellé de ce rôle était
 * littéralement « Direction des opérations » avant d'être raccourci.
 *
 * Ce que l'autre lecture aurait coûté reste écrit, parce qu'il faudra le savoir si la Direction
 * change d'avis : le rôle `OPERATIONS_DIRECTOR` n'a AUCUN module Ad & Pro, donc le choisir
 * exigerait de lui en ouvrir — une décision de PERMISSION, qui appartient à la Direction et pas à
 * un lot de code (§118.86). Le geste serait alors d'ajouter `OPERATIONS_DIRECTOR` aux
 * `actorRoles` de l'étape `final` ET de lui accorder les modules du pôle : un réglage et une
 * décision, pas une réécriture.
 *
 * ── POURQUOI CE MODULE EXISTE, ET POURQUOI IL EST PUR ───────────────────────────────────
 *
 * Trois couches se posent la même question et aucune n'a le droit d'importer les deux autres
 * (§118.16, §118.72, §118.97) : `origin.ts` la pose à la CRÉATION (par où l'on entre),
 * `engine.ts` à chaque AVANCE (y a-t-il une étape après celle-ci ?), et la vue caviardée à
 * l'AFFICHAGE (cet avis est-il encore confidentiel ?). Trois réponses écrites séparément
 * auraient divergé, et le symptôme aurait été le pire de tous : une demande qui s'arrête là où
 * l'écran annonce qu'elle continue.
 *
 * ── LA PROPRIÉTÉ QUI PORTE TOUT LE RESTE ────────────────────────────────────────────────
 *
 * Le parcours est une TRONCATURE, pas un tamis : chaque chaîne est une tranche CONTIGUË de la
 * même colonne vertébrale. On n'a donc besoin que de deux bornes — l'entrée (portée par le
 * statut de départ) et la SORTIE. C'est ce qui permet de tout faire tenir dans `nextStepAfter` :
 * dès que « l'étape suivante » connaît la borne, la terminalité, la projection de l'accord
 * définitif, le refus de franchir automatiquement la décision finale et la levée du caviardage
 * suivent SANS être écrits une seconde fois. Un tamis à trous aurait demandé de reprendre chacun
 * de ces quatre endroits.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * LES RÔLES viennent du SOCLE (`personnes/roles-vente.ts`) et sont RÉEXPORTÉS ici.
 *
 * « Est-ce un KAM ? » est une lecture de ce qu'une personne EST : la déduction de la Business
 * Unit en a besoin autant que ce circuit, et `ad-pro/` n'a pas le droit d'importer `workflow/`
 * — `domains.test.ts` l'a compté et refusé (70 traversées pour un plafond de 69). La lecture est
 * donc au socle, à côté de `designation.ts` et `joignabilite.ts`, et ce module la réexporte pour
 * que ses appelants n'aient pas à savoir d'où elle vient.
 */
import { estKam, ROLE_DIRECTION_MARKETING, ROLE_KAM, type RolesPersonne } from "@/lib/personnes/roles-vente";

export { ROLE_KAM, ROLE_DIRECTION_MARKETING, estKam };
export type DemandeurParcours = RolesPersonne;

/** Les slugs de la colonne vertébrale Ad & Pro, DANS L'ORDRE où on les traverse. */
export const SLUG_PRELIMINAIRE = "preliminary" as const;
/** La porte du Directeur Général — franchie automatiquement sous le seuil (§118.138). */
export const SLUG_DG = "dg" as const;
export const SLUG_DIRECTION = "final" as const;
export const SLUG_MARKETING = "marketing" as const;


/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARCOURS, EN UNE SEULE TABLE — entrée ET sortie décidées au même endroit.
 *
 * Écrire l'entrée dans `origin.ts` et la sortie ici aurait suffi à produire le défaut suivant,
 * qui a été trouvé en raisonnant sur un cas réel avant de l'écrire : un délégué médical qui
 * porte AUSSI la casquette Direction Marketing (rôle secondaire) est un KAM au sens du texte,
 * mais sa demande ne peut pas être arbitrée par lui-même. Une sortie décidée sur le seul fait
 * « c'est un KAM » l'aurait bornée à une étape SITUÉE AVANT celle où la demande se trouve : la
 * vue aurait masqué l'étape courante et l'écran n'aurait plus montré aucune action à prendre.
 * Le rang et le métier ne se confondent pas ; ils sont lus ensemble, ici.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface Parcours {
  /** Le slug de l'étape d'ENTRÉE — celle où la demande se pose en naissant. */
  entree: string;
  /**
   * Le slug de l'étape qui TRANCHE, ou `null` quand c'est la dernière de la définition.
   * `null` est le repli délibéré : rien à borner, donc la chaîne complète.
   */
  sortie: string | null;
}

export function parcoursAdPro(args: {
  /** Rang dans la hiérarchie d'approbation : 0 demandeur ordinaire · 1 National Sales · 2 Direction Marketing · 3 Direction. */
  rang: number;
  /** Le demandeur exerce-t-il comme KAM (délégué médical) ? */
  kam: boolean;
}): Parcours {
  // LA DIRECTION, LE DG, LE DIRECTEUR DES OPÉRATIONS, LE SUPER ADMIN — personne au-dessus d'eux.
  // Leur demande n'a ni préliminaire, ni porte du DG (le DG est à ce rang), ni validation de la
  // Direction (c'est eux) : il ne reste que la décision de Direction Marketing, qui TRANCHE et
  // choisit le budget. Faire valider leur propre étape par eux-mêmes n'aurait rien mesuré.
  if (args.rang >= 3) return { entree: SLUG_MARKETING, sortie: null };
  // DIRECTION MARKETING elle-même : on ne fait pas arbitrer à quelqu'un sa propre demande. Sa
  // chaîne s'arrête donc UNE étape plus tôt — la Direction tranche à sa place. La porte du DG
  // reste devant : une rallonge d'un million ne se décide pas plus bas parce qu'elle vient d'en
  // haut.
  if (args.rang === 2) return { entree: SLUG_DG, sortie: SLUG_DIRECTION };
  // LE NATIONAL SALES : son propre préliminaire n'a pas d'objet, le reste de la chaîne est entier.
  if (args.rang === 1) return { entree: SLUG_DG, sortie: null };
  // LE KAM : son superviseur national filtre d'abord, puis la chaîne complète.
  if (args.kam) return { entree: SLUG_PRELIMINAIRE, sortie: null };
  // TOUT AUTRE DEMANDEUR : aucun superviseur national au-dessus de lui, donc pas de préliminaire.
  return { entree: SLUG_DG, sortie: null };
}

/**
 * LA BORNE DE SORTIE, telle que le MOTEUR et la VUE la lisent — depuis le seul demandeur.
 *
 * On n'exige pas que l'étape existe dans la définition : on la nomme si elle est là, et on se
 * tait sinon. Un circuit remodelé par le Super Admin qui n'a plus d'étape « final » retombe donc
 * sur la chaîne entière — une garde qui refuse ce qu'elle ne comprend pas est désactivée dans la
 * semaine (§118.16).
 */
export function slugDecisionnaire(
  demandeur: DemandeurParcours | null | undefined,
  slugsDeLaDefinition: readonly string[],
  rang: number,
): string | null {
  const { sortie } = parcoursAdPro({ rang, kam: estKam(demandeur) });
  if (sortie === null) return null;
  return slugsDeLaDefinition.includes(sortie) ? sortie : null;
}

/**
 * CETTE ÉTAPE EST-ELLE CELLE QUI TRANCHE ? Une seule lecture de la borne, pour les quatre
 * questions qui en dépendent — y a-t-il une suite, faut-il projeter l'accord définitif, faut-il
 * émettre, et l'avis est-il encore confidentiel.
 */
export function estDecisionnaire(slugEtape: string, borne: string | null): boolean {
  return borne !== null && slugEtape === borne;
}

/**
 * LE SEUIL EFFECTIF d'une étape — ce en dessous de quoi elle est franchie automatiquement.
 *
 * Deux sources, et l'ORDRE entre elles est la moitié de la règle :
 *   • un seuil posé À LA MAIN sur l'étape (champ « Seuil DZD » du constructeur de circuits)
 *     l'emporte TOUJOURS. Le Super Admin qui l'a écrit a pris une décision pour CE circuit ; la
 *     valeur globale ne doit pas l'écraser en silence ;
 *   • à défaut, et pour la seule porte du DG, le seuil GLOBAL des réglages. C'est lui que la
 *     demande vise — « ce seuil doit pouvoir être configuré par le super admin », au singulier —
 *     et c'est lui que lit aussi le matériel promotionnel, qui n'a pas d'étapes en base.
 *
 * Toute autre étape sans seuil écrit n'en a pas : rendre ici une valeur par défaut ferait
 * franchir automatiquement des étapes que personne n'a demandé de franchir.
 */
export function seuilFranchissement(
  slug: string,
  seuilDeLEtape: number | null | undefined,
  seuilDgGlobal: number | null | undefined,
): number | null {
  if (seuilDeLEtape != null && seuilDeLEtape > 0) return seuilDeLEtape;
  if (slug !== SLUG_DG) return null;
  return seuilDgGlobal != null && seuilDgGlobal > 0 ? seuilDgGlobal : null;
}

/**
 * LE DIRECTEUR GÉNÉRAL DOIT-IL VALIDER ce montant ? RÉEXPORTÉ DU SOCLE.
 *
 * Cette fonction PROMETTAIT ici une « lecture unique, partagée par le circuit Ad & Pro et par le
 * matériel promotionnel », et c'était faux deux fois : son seul importeur du dépôt était son
 * propre test (§118.14, §118.49), et `promo-material/circuit.ts` recopiait la même arithmétique
 * dans `etapeApplicable` parce que le domaine `adpro` n'a pas le droit d'importer le domaine
 * `tasks` (`platform/domains.ts`). Deux copies qui s'accordaient par chance, et un commentaire
 * qui affirmait un partage que le code n'avait pas (§118.116).
 *
 * La règle vit désormais au SOCLE (`lib/seuils/ad-pro.ts`, zéro import), lue par les trois
 * couches qui en ont besoin sans avoir le droit de se parler : ce circuit, le matériel
 * promotionnel, et le CENTRE DE VALIDATION Ad & Pro. Le nom est conservé ici parce qu'il est
 * celui que ce circuit emploie ; il ne désigne plus qu'une seule implémentation.
 */
export { porteDgRequise as dgRequis } from "@/lib/seuils/ad-pro";

/**
 * LES ÉTAPES QUE CETTE INSTANCE N'ATTEINDRA JAMAIS — la queue coupée par la borne.
 *
 * Sert à UNE chose, et elle est nécessaire : une émission financière déclarée sur une étape de
 * la queue doit être HONORÉE par l'étape qui tranche. Sans cela, une demande sort APPROUVÉE,
 * avec son budget accordé écrit en base, et Finance ne reçoit RIEN — l'argent est accordé et
 * rien n'est engagé, sans une seule étape en échec. Le faux succès parfait, sur la seule chose
 * que la dépense attend.
 *
 * On ne DÉPLACE pas les drapeaux dans la définition : le Super Admin les a posés là où il les
 * voulait, et une définition réécrite par le code serait une seconde vérité (§118.5). C'est
 * l'exécution qui hérite, et seulement quand la queue est réellement coupée.
 */
export function queueCoupee(
  slugsOrdonnes: readonly string[],
  borne: string | null,
): string[] {
  if (borne === null) return [];
  const i = slugsOrdonnes.indexOf(borne);
  if (i < 0) return [];
  return slugsOrdonnes.slice(i + 1);
}
