/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARCOURS D'UNE DEMANDE Ad & Pro — module PUR (sa seule dépendance est le SOCLE).
 *
 * ── CE QUE LA DIRECTION A TRANCHÉ (22/09/2026) — ELLE REVIENT SUR LE LOT PRÉCÉDENT ────
 *
 * « Le national sales ne valide QUE si c'est un KAM qui a fait la demande ; si c'est LUI-MÊME,
 * ça passe par le Directeur des opérations ; et si c'est quelqu'un d'AUTRE, ça part DIRECT chez
 * la Direction Marketing. » Plus : « on n'a pas besoin d'un référent Direction Marketing, ça va
 * direct chez le directeur/directrice du département marketing. »
 *
 * TROIS BRANCHES, et ce qui les distingue est UN SEUL filtre avant la décision — celui qui se
 * trouve juste au-dessus du demandeur :
 *
 *     KAM              →  National Sales            →  (porte du DG)  →  DIRECTION MARKETING
 *     National Sales   →  Directeur des opérations  →  (porte du DG)  →  DIRECTION MARKETING
 *     tout autre       →                               (porte du DG)  →  DIRECTION MARKETING
 *
 * La porte du DG est ORTHOGONALE aux trois branches : elle est franchie automatiquement sous le
 * seuil réglé, et elle vaut pour tout le monde au-dessus — une rallonge d'un million ne se
 * décide pas plus bas parce qu'elle vient d'en haut.
 *
 * ── LA PROPRIÉTÉ QUI PORTAIT TOUT LE RESTE EST TOMBÉE, ET C'EST LE FAIT DU JOUR ─────────
 *
 * Le lot précédent reposait sur ceci, écrit ici en toutes lettres : « le parcours est une
 * TRONCATURE, pas un tamis : chaque chaîne est une tranche CONTIGUË de la même colonne
 * vertébrale, donc deux bornes suffisent ». La nouvelle règle la REND FAUSSE, et aucun ordre
 * d'étapes ne la sauve : un KAM traverse `preliminary` SANS `final`, un National Sales traverse
 * `final` SANS `preliminary`. Ce sont deux filtres DIFFÉRENTS à deux positions différentes ;
 * dans une colonne linéaire, leurs deux tranches ne peuvent pas être contiguës à la fois.
 *
 * On ne force donc pas la contiguïté par une réécriture de la colonne — ce serait déformer le
 * circuit pour plaire à une propriété d'implémentation. Le parcours devient ce qu'il est : un
 * TAMIS déclaré. Deux faits au lieu d'un, parce qu'ils répondent à deux questions distinctes
 * (§118.16) — `decision` dit OÙ la chaîne s'arrête, `ignorees` dit ce qu'elle NE TRAVERSE PAS.
 * Les confondre les ferait diverger : une demande s'arrêterait là où l'écran annonce qu'elle
 * continue.
 *
 * Ce que ce changement DÉPLACE (§118.61) : l'émission financière héritée. Elle ne se lisait que
 * sur la QUEUE coupée après la borne ; une étape SAUTÉE AU MILIEU portant `emitExpenseOrder`
 * aurait vu son ordre de dépense disparaître — l'argent accordé, rien d'engagé, aucune étape en
 * échec. `etapesNonAtteintes` couvre donc les deux : la queue ET le tamis.
 *
 * ── « DIRECTION DES OPÉRATIONS » EST LE RÔLE `DIRECTION` — LECTURE CONFIRMÉE DEUX FOIS ──
 *
 * Cette lecture était une déduction au premier lot ; la Direction a répondu « transforme
 * Direction en Direction des opérations », donc c'est bien ce rôle. Et elle vient de le
 * confirmer une seconde fois en l'employant pour désigner CELUI QUI VALIDE au-dessus du
 * National Sales — c'est-à-dire exactement l'étape `final`, dont le titre est « Validation
 * (Direction des opérations) ». Le rôle `OPERATIONS_DIRECTOR` n'a toujours AUCUN module
 * Ad & Pro : le choisir exigerait de lui en ouvrir, une décision de PERMISSION qui appartient à
 * la Direction (§118.86). Le geste, si elle change d'avis, reste d'ajouter `OPERATIONS_DIRECTOR`
 * aux `actorRoles` de l'étape `final` ET de lui accorder les modules du pôle.
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
   * `null` est le repli délibéré : rien à borner, donc la chaîne va jusqu'au bout.
   */
  decision: string | null;
  /**
   * LES ÉTAPES DE LA COLONNE VERTÉBRALE QUE CETTE DEMANDE NE TRAVERSE PAS.
   *
   * Le tamis, et il ne contient JAMAIS que des slugs de la colonne vertébrale connue. Une étape
   * qu'un Super Admin a ajoutée n'y figure pas, donc elle est TRAVERSÉE : sauter en silence une
   * étape que quelqu'un a délibérément posée serait défaire sa décision, et une garde qui écarte
   * ce qu'elle ne comprend pas est désactivée dans la semaine (§118.16).
   */
  ignorees: readonly string[];
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES TROIS BRANCHES — et les deux garde-fous d'auto-arbitrage qui s'y ajoutent.
 *
 * On ne fait JAMAIS arbitrer à quelqu'un sa propre demande : c'est ce qui explique les deux
 * branches qui ne sont pas dans la phrase de la Direction (rang 2 et rang ≥ 3). Sans elles, le
 * directeur du département marketing validerait son propre budget, ce qui ne mesure rien.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function parcoursAdPro(args: {
  /** Rang dans la hiérarchie d'approbation : 0 demandeur ordinaire · 1 National Sales · 2 Direction Marketing · 3 Direction. */
  rang: number;
  /** Le demandeur exerce-t-il comme KAM (délégué médical) ? */
  kam: boolean;
}): Parcours {
  // LA DIRECTION, LE DG, LE DIRECTEUR DES OPÉRATIONS, LE SUPER ADMIN — personne au-dessus d'eux.
  // Leur demande n'a ni préliminaire, ni porte du DG (le DG est à ce rang), ni validation de la
  // Direction des opérations (c'est eux) : il ne reste que la décision de Direction Marketing.
  if (args.rang >= 3) {
    return { entree: SLUG_MARKETING, decision: null, ignorees: [SLUG_PRELIMINAIRE, SLUG_DG, SLUG_DIRECTION] };
  }
  // DIRECTION MARKETING elle-même : elle ne tranche pas sa propre demande, donc la Direction des
  // opérations tranche à sa place et la chaîne s'arrête là. La porte du DG reste devant — une
  // rallonge d'un million ne se décide pas plus bas parce qu'elle vient d'en haut.
  if (args.rang === 2) {
    return { entree: SLUG_DG, decision: SLUG_DIRECTION, ignorees: [SLUG_PRELIMINAIRE] };
  }
  // LE NATIONAL SALES : « si c'est lui-même, ça passe par le directeur des opérations ». Son
  // propre préliminaire n'a pas d'objet ; le filtre au-dessus de lui est l'étape `final`.
  if (args.rang === 1) {
    return { entree: SLUG_DG, decision: null, ignorees: [SLUG_PRELIMINAIRE] };
  }
  // LE KAM : son superviseur national filtre — et LUI SEUL. La Direction des opérations n'est pas
  // sur sa route : « le national sales ne valide QUE si c'est un KAM ». C'est cette branche qui
  // rend le parcours non contigu, et donc le tamis nécessaire.
  if (args.kam) {
    return { entree: SLUG_PRELIMINAIRE, decision: null, ignorees: [SLUG_DIRECTION] };
  }
  // TOUT AUTRE DEMANDEUR : « ça part direct chez la direction marketing ». Aucun filtre
  // hiérarchique — ni superviseur national, ni Direction des opérations. Reste la porte du DG,
  // franchie automatiquement sous le seuil, donc invisible pour la grande majorité des demandes.
  return { entree: SLUG_DG, decision: null, ignorees: [SLUG_PRELIMINAIRE, SLUG_DIRECTION] };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE PARCOURS TEL QU'IL SERA GELÉ EN BASE — une seule lecture, deux faits.
 *
 * Les trois couches ont besoin des DEUX faits (où la chaîne s'arrête, ce qu'elle ne traverse
 * pas) et ils viennent de la MÊME branche : les calculer par deux appels séparés laisserait un
 * appelant lire l'un sans l'autre, et le symptôme serait une demande qui saute une étape sans
 * que la vue le dise, ou l'inverse (§118.5).
 *
 * ── UNE SEULE RÈGLE DE FILTRAGE, ET ELLE PROTÈGE DANS LE BON SENS ───────────────────────
 *
 * Le parcours ne nomme que des étapes qui EXISTAIENT à la naissance de la demande. Une étape
 * absente de la définition n'est donc ni borne ni ignorée, et si un Super Admin l'AJOUTE plus
 * tard, elle est TRAVERSÉE. C'est le sens sûr : sauter en silence une étape que quelqu'un vient
 * de poser délibérément défait sa décision sans une ligne pour le dire, alors qu'une étape de
 * validation en trop se voit, se lit et se franchit (§118.16, §118.27).
 */
export function parcoursEffectif(
  demandeur: DemandeurParcours | null | undefined,
  slugsDeLaDefinition: readonly string[],
  rang: number,
): Parcours {
  const brut = parcoursAdPro({ rang, kam: estKam(demandeur) });
  const connus = new Set(slugsDeLaDefinition);
  return {
    entree: brut.entree,
    decision: brut.decision !== null && connus.has(brut.decision) ? brut.decision : null,
    ignorees: brut.ignorees.filter((slug) => connus.has(slug)),
  };
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
 * CETTE ÉTAPE EST-ELLE HORS DU PARCOURS DE CETTE DEMANDE ? Le tamis, lu une seule fois.
 *
 * Une étape ignorée n'est pas « franchie automatiquement » : elle n'est pas SUR la route. La
 * distinction compte, parce qu'un franchissement automatique se trace (il a eu lieu, sous le
 * seuil) alors qu'une étape hors parcours n'a rien à tracer — tracer un franchissement que
 * personne n'a demandé ferait lire au demandeur qu'un validateur a laissé passer sa demande.
 */
export function estIgnoree(slugEtape: string, ignorees: readonly string[]): boolean {
  return ignorees.includes(slugEtape);
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
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES ÉTAPES QUE CETTE INSTANCE N'ATTEINDRA JAMAIS — la queue coupée ET le tamis.
 *
 * Sert à UNE chose, et elle est nécessaire : une émission financière déclarée sur une étape que
 * la demande n'atteindra pas doit être HONORÉE par l'étape qui tranche. Sans cela, une demande
 * sort APPROUVÉE, avec son budget accordé écrit en base, et Finance ne reçoit RIEN — l'argent
 * est accordé et rien n'est engagé, sans une seule étape en échec. Le faux succès parfait, sur
 * la seule chose que la dépense attend.
 *
 * ── POURQUOI CETTE FONCTION A DÛ S'ÉLARGIR, ET CE QUE COÛTAIT L'ANCIENNE ────────────────
 *
 * Elle ne lisait que la QUEUE coupée après la borne (`queueCoupee`), parce que le parcours était
 * alors une TRONCATURE. Depuis que c'est un TAMIS, une étape peut être sautée AU MILIEU : celle
 * qui porte `emitExpenseOrder` aurait vu son ordre de dépense disparaître, exactement dans le
 * silence que le paragraphe ci-dessus décrit. Le paramètre `ignorees` est donc OBLIGATOIRE et
 * sans valeur par défaut : un appelant qui l'oublierait retomberait sur le défaut d'origine, en
 * silence, et c'est le typecheck qui doit le lui dire (§118.61).
 *
 * L'ÉTAPE QUI TRANCHE N'EST JAMAIS RENDUE : elle EST atteinte, c'est elle qui hérite. Le garde
 * tient même si un appelant compose une paire incohérente (une borne qui figure aussi dans le
 * tamis) — la paire serait fautive, mais rien ne doit faire hériter une étape d'elle-même.
 *
 * On ne DÉPLACE pas les drapeaux dans la définition : le Super Admin les a posés là où il les
 * voulait, et une définition réécrite par le code serait une seconde vérité (§118.5). C'est
 * l'exécution qui hérite, et seulement de ce qui n'est réellement pas atteint.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function etapesNonAtteintes(
  slugsOrdonnes: readonly string[],
  decision: string | null,
  ignorees: readonly string[],
): string[] {
  const tamis = new Set(ignorees);
  const rangDecision = decision === null ? -1 : slugsOrdonnes.indexOf(decision);
  return slugsOrdonnes.filter((slug, i) => {
    if (i === rangDecision) return false;
    if (rangDecision >= 0 && i > rangDecision) return true;
    return tamis.has(slug);
  });
}
