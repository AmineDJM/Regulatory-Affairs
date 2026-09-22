/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LES RÉFÉRENTS DIRECTION MARKETING D'UNE GAMME — la décision, écrite une fois.
 *
 * Décision de la Direction (22/09/2026) : « chaque BU aura son ou ses référents de la direction
 * marketing depuis la configuration des BU, mais le directeur du département marketing recevra
 * ÉGALEMENT l'accès et la notif et pourra modifier, valider ».
 *
 * ── CE QUE LA DÉSIGNATION FAIT, ET CE QU'ELLE NE FAIT PAS ───────────────────────────────
 *
 * Elle **CIBLE** la notification : une demande Ad & Pro de la gamme Oncologie prévient nommément
 * ses référents, au lieu d'arroser tout le rôle Direction Marketing. Elle n'**ACCORDE** rien : le
 * pouvoir de trancher reste gouverné par le rôle de l'étape (`WorkflowStep.actorRoles`), inchangé.
 *
 * La distinction n'est pas de la prudence, c'est la règle du dépôt : une désignation posée depuis
 * un écran de configuration COMMERCIALE qui ouvrirait un pouvoir d'ARBITRAGE serait une porte de
 * permission à côté de la porte gardée (§118.71, §118.74). L'écran ne propose donc que des
 * personnes qui portent DÉJÀ le rôle — la désignation n'a rien à ajouter, elle n'a qu'à choisir.
 *
 * ── LE DIRECTEUR GARDE TOUT, ET C'EST UNE PROPRIÉTÉ DU CODE, PAS UN VŒU ─────────────────
 *
 * La notification par RÔLE n'est pas remplacée : elle est CONSERVÉE, et les référents s'y
 * AJOUTENT. C'est ainsi que « le directeur du département marketing recevra également l'accès et
 * la notif » est tenu sans avoir à deviner qui est le directeur. L'ERP ne porte aujourd'hui qu'un
 * seul rôle pour la direction marketing (`PRODUCT_MANAGER`, libellé « Direction Marketing ») et
 * AUCUN rôle de directeur distinct — mesuré avant d'écrire.
 *
 * CE QUI RESTE UNE DÉCISION DE LA DIRECTION, et qu'on ne prend pas à sa place : resserrer la
 * notification au SEUL directeur désigné (une désignation personnelle, comme le siège du centre de
 * paiement) retirerait la notification à des personnes qui la reçoivent aujourd'hui. Tant qu'elle
 * n'est pas prise, l'ajout ne peut que RÉVEILLER quelqu'un de plus, jamais en endormir un.
 *
 * ── POURQUOI CE MODULE VIT AU SOCLE, ET PAS DANS `ad-pro/` ──────────────────────────────
 *
 * Écrit d'abord dans `lib/ad-pro/referents.ts`, il a fait tomber `domains.test.ts` sur un
 * CYCLE : `workflow/engine.ts` (domaine `tasks`) devait le lire, et `ad-pro/` importe déjà
 * `workflow/`. Le plafond ne se relève pas — et `parcours.ts` avait déjà payé exactement ce
 * refus pour `estKam` (« 70 traversées pour un plafond de 69 »), avec le même remède.
 *
 * QUATRE couches se posent la question « qui prévenir pour cette gamme ? » et aucune n'a le
 * droit d'importer les trois autres (§118.16, §118.72, §118.97) : l'écran de configuration des
 * gammes, les trois actions de création (qui inscrivent le référent sur la demande), le MOTEUR
 * de circuit (qui prévient à l'étape atteinte), et les ops d'Adam. Sa place est ici, à côté de
 * `designation.ts`, `joignabilite.ts` et `roles-vente.ts`, dont il partage le critère.
 *
 * Module PUR — sa seule dépendance est le SOCLE.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { estDirectionMarketing, ROLE_DIRECTION_MARKETING, type RolesPersonne } from "./roles-vente";

/** Une personne désignée référente d'une gamme. */
export interface ReferentMarketing {
  userId: string;
  name: string;
  /** Porte-t-elle le rôle qui donne le pouvoir de trancher ? L'écran le DIT au lieu de le taire. */
  porteLeRole: boolean;
}

/**
 * PORTE-T-ELLE LE RÔLE QUI TRANCHE ? — une seule lecture, pour les cinq qui la posent.
 *
 * Elle était recopiée cinq fois (`PRODUCT_MANAGER_ROLES.includes(role) || …secondaryRole`) dans
 * l'écran, l'action, le moteur, le chargeur et l'op d'Adam — dont deux copies qui réinventaient
 * `hasRole` à la main. Deux copies de « qui peut trancher » finissent par diverger, et le
 * symptôme serait un écran qui propose une personne que l'action refuse (§118.5).
 *
 * CE QU'ON LIT, ET POURQUOI C'EST LE RÔLE ÉTROIT. L'étape qui TRANCHE porte
 * `actorRoles: [ROLE_DIRECTION_MARKETING]` — mesuré dans `workflow/defaults.ts`, et le banc pur
 * tient cette prémisse. `PRODUCT_MANAGER_ROLES` en compte DEUX (il y ajoute
 * `MEDICAL_PROMOTION_MANAGER`, à qui l'étape décisive ne donne PAS la main) : l'employer ici
 * ferait inscrire `productManagerId` au nom de quelqu'un qui ne peut rien décider — l'attente
 * sans pouvoir que ce module existe pour nommer, plus une ouverture de la garde d'analyse
 * (`c.productManagerId !== user.id`) par-dessus.
 *
 * L'erreur va donc dans le sens SÛR : un refus honnête qui NOMME son remède, jamais une capacité
 * promise qui échoue après le clic (§118.16). Le geste, si la Direction élargit l'étape décisive,
 * est d'ajouter le rôle à ses `actorRoles` ET ici — les deux, parce que le premier seul laisserait
 * l'écran refuser une personne que le moteur accepterait.
 *
 * Le RÔLE SECONDAIRE compte, comme partout dans ce RBAC : c'est `hasRole` que le moteur emploie
 * pour décider qui peut agir sur l'étape, et s'en écarter ici ferait une exception indevinable.
 */
export function porteLeRoleQuiTranche(p: RolesPersonne | null | undefined): boolean {
  return estDirectionMarketing(p);
}

/**
 * LES RÔLES QUI TRANCHENT, en liste — pour les appelants qui filtrent EN BASE.
 *
 * Le prédicat répond sur une personne déjà lue ; l'écran et l'action, eux, doivent restreindre
 * une requête AVANT de lire. Les deux lectures viennent du même nom (`ROLE_DIRECTION_MARKETING`)
 * et un cas du banc pur exige qu'elles s'accordent : deux sources feraient un écran qui propose
 * une personne que le prédicat refuse (§118.5).
 */
export const ROLES_QUI_TRANCHENT: readonly string[] = [ROLE_DIRECTION_MARKETING];

export { ROLE_DIRECTION_MARKETING };

/**
 * CETTE ÉTAPE CONCERNE-T-ELLE LA GAMME ? — le fait est dans la DÉFINITION, pas dans une liste.
 *
 * Les référents sont l'incarnation PAR GAMME du rôle Direction Marketing : ils doivent être
 * prévenus exactement quand ce rôle l'est, et à aucun autre moment. Les prévenir à CHAQUE étape
 * atteinte a été écrit d'abord, puis MESURÉ en écrivant le cas de bout en bout : la demande d'un
 * National Sales traverse la porte du DG puis la Direction des opérations avant d'atteindre la
 * Direction Marketing, donc le référent d'une gamme recevait DEUX notifications d'étapes qui ne
 * le concernent pas — et une notification qui arrive partout cesse d'être lue (§118.32).
 *
 * Le fait sur lequel la règle s'arme est le `notifyRoles` de l'ÉTAPE, lu dans la définition : une
 * étape Direction Marketing ajoutée demain par un Super Admin prévient les référents sans que
 * personne y pense, et une étape qui ne nomme pas ce rôle ne les dérange pas (§118.17). Une liste
 * de slugs écrite à la main serait fausse au premier circuit remanié, en silence (§118.73).
 *
 * C'est aussi ce qui évite une lecture de base par étape franchie : sur une étape qui ne nomme
 * pas le rôle, il n'y a rien à aller chercher.
 */
export function laGammeEstConcernee(rolesNotifies: readonly string[]): boolean {
  return rolesNotifies.includes(ROLE_DIRECTION_MARKETING);
}

/**
 * QUI PRÉVENIR quand une demande de cette gamme atteint l'étape de la Direction Marketing.
 *
 * Les référents NOMMÉS **s'ajoutent** aux rôles de l'étape ; ils ne les remplacent pas. Une gamme
 * sans référent retombe donc EXACTEMENT sur le comportement d'avant — c'est ce qui permet de
 * déployer la table vide sans priver personne de sa notification (§118.16).
 *
 * On écarte le DEMANDEUR : personne ne se fait prévenir que sa propre demande l'attend, et la
 * notification aurait l'air d'un accusé de réception.
 */
export function aPrevenirPourLaGamme(args: {
  referents: readonly ReferentMarketing[];
  /** Le demandeur, qu'on ne prévient jamais de sa propre demande. */
  demandeurId?: string | null;
}): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const r of args.referents) {
    const id = (r.userId ?? "").trim();
    if (!id || id === args.demandeurId || vus.has(id)) continue;
    vus.add(id);
    out.push(id);
  }
  return out;
}

/**
 * LE RÉFÉRENT À INSCRIRE SUR LA DEMANDE (`productManagerId`), ou RIEN.
 *
 * Le champ a sept lecteurs (droits de la fiche, déclaration d'information médicale, garde de
 * l'analyse) et n'avait plus aucun écrivain depuis que le menu de création a été retiré
 * (§118.142). Le voici.
 *
 * UN SEUL RÉFÉRENT DÉSIGNE CETTE PERSONNE ; PLUSIEURS N'EN DÉSIGNENT AUCUNE. Collapser sur le
 * premier choisirait l'arbitre d'un budget à la place d'un humain, et le ferait par l'ordre
 * d'insertion en base — c'est §118.34 mot pour mot : « une liste d'UN candidat désigne cette
 * personne, une liste de PLUSIEURS n'en désigne aucune ».
 *
 * Et l'on n'inscrit que quelqu'un qui PORTE le rôle : `productManagerId` est lu par la garde de
 * l'analyse (`c.productManagerId !== user.id`), donc y écrire une personne sans le rôle lui
 * ouvrirait ce geste — la désignation accorderait un droit, ce que ce module refuse.
 */
export function referentUnique(referents: readonly ReferentMarketing[]): string | null {
  const eligibles = referents.filter((r) => r.porteLeRole && (r.userId ?? "").trim());
  return eligibles.length === 1 ? eligibles[0]!.userId : null;
}

/**
 * CE QUI MANQUE À UNE GAMME, DIT DANS LE CAS QU'ON A — jamais « incomplet ».
 *
 * Deux pannes distinctes et toutes deux silencieuses (§118.116) : aucun référent (la demande
 * n'atteint nommément personne, elle repart sur le rôle entier), et un référent qui ne porte PAS
 * le rôle (il est prévenu et ne peut rien trancher — une attente sans pouvoir).
 */
export function referentsWhy(referents: readonly ReferentMarketing[]): string {
  if (referents.length === 0) {
    return "Aucun référent Direction Marketing : les demandes de cette gamme ne préviennent personne "
      + "nommément — elles repartent sur le rôle entier, et chacun suppose que quelqu'un d'autre s'en occupe.";
  }
  const sansRole = referents.filter((r) => !r.porteLeRole);
  if (sansRole.length > 0) {
    const n = sansRole.length;
    return `${n} référent${n > 1 ? "s" : ""} ne porte pas le rôle Direction Marketing : ${n > 1 ? "ils seront prévenus" : "il sera prévenu"} `
      + "et ne pourra rien trancher. Une désignation CIBLE la notification, elle n'accorde aucun droit.";
  }
  if (referents.length > 1) {
    return `${referents.length} référents : tous sont prévenus, et la demande n'est inscrite au nom d'aucun `
      + "— désigner l'arbitre à leur place se ferait par l'ordre d'insertion en base.";
  }
  return "Un seul référent : les demandes de cette gamme sont prévenues à son nom et inscrites à son nom.";
}

/** L'étape est-elle franchie ? Au moins un référent, et tous portent le rôle. */
export function referentsMontes(referents: readonly ReferentMarketing[]): boolean {
  return referents.length > 0 && referents.every((r) => r.porteLeRole);
}
