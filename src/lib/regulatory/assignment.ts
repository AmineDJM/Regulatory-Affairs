/**
 * CONFIER UN DOSSIER, C'EST DONNER L'ACCÈS — sinon on ne confie rien.
 *
 * Le tableau Regulatory permet de désigner la personne chargée d'un dossier. Elle recevait bien
 * la notification « Vous êtes chargé(e) de ce dossier »… et le lien menait à une redirection : son
 * rôle n'ouvrait pas le module Regulatory, donc `requireModule` la renvoyait à l'accueil et
 * `scopeRegulatory` ne lui montrait aucune ligne. On lui avait confié un dossier qu'elle ne
 * pouvait ni voir ni ouvrir, et personne ne s'en apercevait avant qu'elle ne le dise.
 *
 * La règle : **porter un dossier ouvre le module**, en portée ASSIGNED — c'est-à-dire SES dossiers
 * et rien d'autre. Ce n'est pas un contournement du contrôle d'accès, c'en est la conséquence : la
 * portée par ligne (`scopeRegulatory`) continue de décider quels dossiers, et elle ne retient que
 * ceux où la personne est nommée.
 *
 * Module PUR — testé, sans base de données.
 */

/**
 * Ce qu'on accorde à qui PORTE un dossier — et ce qu'on n'accorde pas.
 *
 * `VIEW` seul ne suffirait pas : porter un dossier, c'est avancer ses étapes et y déposer des
 * pièces. On s'arrête là. `CREATE` (ouvrir un nouveau dossier) et `DELETE` sont des décisions de
 * portefeuille, pas des gestes de porteur ; `VALIDATE` appartient aux superviseurs.
 */
export const CARRIER_ACTIONS = ["VIEW", "UPDATE", "UPLOAD", "EXPORT"] as const;
export type CarrierAction = (typeof CARRIER_ACTIONS)[number];

export interface CarrierAccess {
  actions: readonly CarrierAction[];
  /** Toujours ASSIGNED : porter trois dossiers n'ouvre pas le portefeuille de la société. */
  scope: "ASSIGNED";
}

/**
 * L'accès accordé du seul fait de porter un dossier — ou `null` s'il n'y a rien à accorder.
 *
 * `blocked` gagne TOUJOURS. Un administrateur qui a explicitement retiré le module Regulatory à
 * quelqu'un a pris une décision ; la lui défaire en lui assignant un dossier rendrait le blocage
 * décoratif — et le rendrait surtout imprévisible, puisqu'il se lèverait tout seul un jour où
 * personne ne regarde.
 *
 * `hasModule` : inutile d'accorder quoi que ce soit à qui a déjà le module — son rôle lui donne
 * peut-être davantage, et écraser serait un rétrécissement silencieux.
 */
export function carrierAccess(input: { carries: boolean; blocked: boolean; hasModule: boolean }): CarrierAccess | null {
  if (!input.carries || input.blocked || input.hasModule) return null;
  return { actions: CARRIER_ACTIONS, scope: "ASSIGNED" };
}

/**
 * CE QU'ON ÉCRIT À LA PERSONNE À QUI L'ON CONFIE UN DOSSIER.
 *
 * Un dossier VERROUILLÉ (au pipeline) reste invisible de qui n'a pas accès au pipeline — la règle
 * du cadenas ne cède ni devant un responsable nommé, ni devant personne. Désigner qui portera un
 * produit encore à l'étude est pourtant légitime : on prépare l'équipe avant d'ouvrir.
 *
 * Alors on le DIT. Une notification qui annonce un dossier introuvable est pire que pas de
 * notification : la personne cherche, ne trouve pas, et conclut que l'outil est cassé.
 */
export function assignmentNotice(input: {
  reference: string;
  dci: string;
  locked: boolean;
  seesLocked: boolean;
}): { title: string; body: string } {
  const subject = `${input.reference} — ${input.dci}`;
  if (input.locked && !input.seesLocked) {
    return {
      title: "Vous porterez ce dossier (encore au pipeline)",
      body: `${subject} · Il est verrouillé : il n'apparaîtra dans votre suivi qu'une fois le cadenas ouvert.`,
    };
  }
  return { title: "Vous êtes chargé(e) de ce dossier", body: subject };
}

/** Ce que l'écran répond à qui vient de confier un dossier verrouillé — même vérité, autre bouche. */
export function assignmentWarning(input: { locked: boolean; seesLocked: boolean }): string | null {
  if (!input.locked || input.seesLocked) return null;
  return "Dossier confié — mais il est VERROUILLÉ : la personne ne le verra pas tant que le cadenas n'est pas ouvert.";
}
