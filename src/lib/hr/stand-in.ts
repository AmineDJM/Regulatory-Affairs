import { PERMISSIONS, MODULES, type Action, type Module } from "@/lib/rbac";

/**
 * L'INTÉRIMAIRE D'UN CONGÉ — quelqu'un tient la place, le temps de l'absence.
 *
 * Une personne part trois semaines. Ses validations s'empilent, ses dossiers dorment, et l'on
 * découvre au retour qu'une demande attendait depuis quinze jours. La parade habituelle — donner
 * le mot de passe à un collègue, ou demander au Super Admin d'ouvrir un accès « pour cette fois »
 * — est exactement ce qu'on veut éviter : elle ne laisse aucune trace, elle ne s'arrête jamais,
 * et personne ne sait qui a signé quoi.
 *
 * D'où une délégation EXPLICITE, portée par la demande de congé elle-même :
 *
 *   ①  L'ABSENT DÉSIGNE son intérimaire — il est le seul à savoir qui peut réellement le
 *      remplacer sur son métier.
 *   ②  Les RH VALIDENT ce choix. Sans cette marche, chacun pourrait se choisir un remplaçant
 *      complaisant, et la délégation deviendrait un moyen de contourner un circuit.
 *   ③  La délégation NE VIT QUE PENDANT LE CONGÉ. Elle s'ouvre à la date de début, se ferme à la
 *      date de fin, et personne n'a rien à révoquer : c'est le calendrier qui la termine, pas la
 *      mémoire de quelqu'un.
 *
 * Deux bornes qui font toute la différence entre une intérim et un compte partagé :
 *
 *   • l'intérimaire ne reçoit QUE les modules choisis, jamais tout le compte. Un directeur qui
 *     part en congé délègue ses validations, pas la lecture de ses courriels ;
 *   • il ne reçoit jamais PLUS que ce que l'absent avait lui-même. Une délégation qui ajouterait
 *     des droits serait une promotion déguisée, et le retour du titulaire ne la retirerait pas.
 *
 * Module PUR — testé, sans base de données.
 */

export type StandInStatus = "PENDING" | "APPROVED" | "REJECTED";

export const STAND_IN_LABEL: Record<StandInStatus, string> = {
  PENDING: "Intérimaire proposé — en attente des RH",
  APPROVED: "Intérimaire validé",
  REJECTED: "Intérimaire refusé",
};

/**
 * Les modules qu'on peut déléguer.
 *
 * On exclut ce qui n'a AUCUN sens à déléguer, et le dire vaut mieux que de laisser quelqu'un
 * cocher une case qui ne produira rien :
 *   • `ADMIN` — la souveraineté du Super Admin ne se prête pas ;
 *   • `DRIVE`, `MESSAGING`, `WORKSPACE` — ce sont les espaces PERSONNELS de l'absent. Remplacer
 *     quelqu'un, ce n'est pas lire son Drive privé ni sa messagerie.
 */
const NEVER_DELEGATED: readonly Module[] = ["ADMIN", "DRIVE", "MESSAGING", "WORKSPACE", "NOTIFICATIONS"];

export function isDelegatable(module: string): module is Module {
  return (MODULES as readonly string[]).includes(module)
    && !(NEVER_DELEGATED as readonly string[]).includes(module);
}

/** Nettoie une liste de modules venue d'un formulaire : on garde ce qui est délégable. */
export function normalizeDelegated(raw: readonly unknown[]): Module[] {
  return [...new Set(raw.map((v) => String(v ?? "").trim()).filter(isDelegatable))] as Module[];
}

export interface StandInLeave {
  /** Le congé lui-même doit être ACCORDÉ : on ne remplace pas quelqu'un qui est là. */
  leaveApproved: boolean;
  standInId: string | null;
  standInStatus: StandInStatus | null;
  standInModules: readonly string[];
  startDate: Date | string;
  endDate: Date | string;
}

function day(v: Date | string): number {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? NaN : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * La délégation est-elle ACTIVE aujourd'hui ?
 *
 * Quatre conditions, et aucune n'est superflue : le congé accordé, un intérimaire désigné, les RH
 * d'accord, et la date dans la fenêtre. On compare des JOURS, pas des instants : un congé du 3 au
 * 10 couvre le 10 tout entier — s'arrêter à minuit laisserait le dernier jour sans personne.
 */
export function isDelegationActive(leave: StandInLeave, now: Date = new Date()): boolean {
  if (!leave.leaveApproved) return false;
  if (!leave.standInId || leave.standInStatus !== "APPROVED") return false;
  const from = day(leave.startDate);
  const to = day(leave.endDate);
  const today = day(now);
  if (Number.isNaN(from) || Number.isNaN(to) || Number.isNaN(today)) return false;
  return today >= from && today <= to;
}

/** Pourquoi la délégation ne joue pas — dit en clair, plutôt qu'un refus muet. */
export function inactiveReason(leave: StandInLeave, now: Date = new Date()): string | null {
  if (isDelegationActive(leave, now)) return null;
  if (!leave.standInId) return "Aucun intérimaire n'est désigné.";
  if (leave.standInStatus === "REJECTED") return "Les RH ont refusé cet intérimaire.";
  if (leave.standInStatus !== "APPROVED") return "Les RH n'ont pas encore validé cet intérimaire.";
  if (!leave.leaveApproved) return "Le congé n'est pas encore accordé.";
  const today = day(now);
  if (today < day(leave.startDate)) return "L'intérim commencera au premier jour du congé.";
  return "L'intérim a pris fin avec le congé.";
}

/**
 * Les droits que l'intérimaire reçoit sur un module — bornés par ceux de l'ABSENT.
 *
 * On part de la matrice du rôle de l'absent et on n'en garde que ce qui sert à TENIR LA PLACE :
 * lire, valider, et faire avancer ce qui attend. La SUPPRESSION est écartée — un remplaçant ne
 * détruit pas ; c'est le genre de geste qui se découvre au retour et qui ne se répare pas.
 *
 * `null` quand l'absent n'avait lui-même rien sur ce module : une délégation ne crée pas un
 * droit, elle en prête un.
 */
export function delegatedActions(absenteeRole: string, module: Module): Action[] | null {
  const matrix = PERMISSIONS[absenteeRole as keyof typeof PERMISSIONS];
  const owned = matrix?.[module];
  if (!owned || !owned.includes("VIEW")) return null;
  const kept = owned.filter((a) => a !== "DELETE");
  return kept.length > 0 ? kept : null;
}

export interface Delegation {
  module: Module;
  actions: Action[];
}

/** Ce que l'intérimaire obtient réellement, module par module. */
export function delegationsFor(absenteeRole: string, modules: readonly string[]): Delegation[] {
  const out: Delegation[] = [];
  for (const m of normalizeDelegated(modules)) {
    const actions = delegatedActions(absenteeRole, m);
    if (actions) out.push({ module: m, actions });
  }
  return out;
}

/**
 * Cette personne remplace-t-elle CET absent en ce moment ?
 *
 * Sert aux gardes d'action : décider une validation adressée à l'absent, ouvrir un dossier qui
 * lui était confié. On ne se remplace pas soi-même — le cas paraît absurde, mais il naît tout
 * seul le jour où quelqu'un se désigne par erreur, et il ferait passer une auto-validation pour
 * une intérim.
 */
export function actsFor(
  leave: StandInLeave & { absenteeUserId: string },
  viewerId: string,
  now: Date = new Date(),
): boolean {
  if (viewerId === leave.absenteeUserId) return false;
  return leave.standInId === viewerId && isDelegationActive(leave, now);
}

/** « Vous remplacez Karim Saïdi jusqu'au 12 septembre. » */
export function delegationNotice(absenteeName: string, endDate: Date | string): string {
  const d = endDate instanceof Date ? endDate : new Date(endDate);
  const when = Number.isNaN(d.getTime())
    ? "pendant son congé"
    : `jusqu'au ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(d)}`;
  return `Vous remplacez ${absenteeName} ${when} : ses validations en attente vous sont ouvertes.`;
}
