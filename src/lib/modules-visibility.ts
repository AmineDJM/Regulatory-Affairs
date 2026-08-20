import { MODULES, type Module } from "@/lib/rbac";

/**
 * MASQUER UN MODULE — le retirer de la plateforme sans toucher aux droits ni aux données.
 *
 * Ce n'est PAS une permission, et la distinction compte. Une permission dit « cette personne
 * n'y a pas droit » ; masquer dit « ce module n'est pas en service ici, pour personne ». Les
 * deux se règlent à des endroits différents et pour des raisons différentes : un module se
 * masque parce qu'il n'est pas encore déployé, parce qu'il est en refonte, ou parce que
 * l'entreprise ne s'en sert pas — pas parce qu'un salarié n'y aurait pas droit.
 *
 * Rien n'est supprimé : les données restent, les actions serveur restent, et démasquer rend le
 * module tel qu'il était. C'est ce qui rend le geste réversible sans crainte.
 *
 * ⚠️ DEUX GARDE-FOUS, et le premier n'est pas négociable :
 *
 *   • La CONSOLE D'ADMINISTRATION ne se masque jamais. C'est par elle qu'on démasque : la
 *     cacher fermerait la porte de l'intérieur, sans aucun moyen de revenir en arrière autrement
 *     qu'en écrivant en base.
 *   • Le SUPER ADMIN continue de voir les modules masqués, signalés comme tels. Il doit pouvoir
 *     vérifier ce qu'il vient de couper — et le rallumer — sans se déconnecter.
 *
 * Module PUR — testé, sans base de données.
 */

/** Les modules qu'on n'a pas le droit de masquer, quoi qu'il arrive. */
export const NEVER_HIDDEN: readonly Module[] = ["ADMIN"];

/** Peut-on masquer ce module ? */
export function isHideable(module: string): module is Module {
  return (MODULES as readonly string[]).includes(module) && !(NEVER_HIDDEN as readonly string[]).includes(module);
}

/**
 * Nettoie une liste de modules masqués venue d'un formulaire ou de la base.
 *
 * On écarte l'inconnu (un module renommé depuis) et l'interdit (la console) plutôt que de les
 * refuser en bloc : un réglage partiellement obsolète doit continuer de fonctionner pour ce
 * qu'il a de valide, sinon une simple évolution de code rendrait tout l'écran inutilisable.
 */
export function normalizeHidden(raw: readonly unknown[]): Module[] {
  return [...new Set(raw.map((v) => String(v ?? "").trim()).filter(isHideable))] as Module[];
}

/** Ce module est-il masqué ? */
export function isModuleHidden(hidden: readonly string[], module: string): boolean {
  return hidden.includes(module);
}

/**
 * Les modules qu'une personne voit réellement, réglage de masquage appliqué.
 *
 * Le Super Admin garde tout : il est le seul à pouvoir rallumer, et un écran d'administration
 * qui cacherait ce qu'il vient d'éteindre serait un piège.
 */
export function visibleModules(
  accessible: readonly Module[],
  hidden: readonly string[],
  opts: { isSuperAdmin: boolean },
): Module[] {
  if (opts.isSuperAdmin) return [...accessible];
  return accessible.filter((m) => !isModuleHidden(hidden, m));
}

/**
 * Cette personne peut-elle OUVRIR ce module ?
 *
 * La garde de navigation ne suffit pas : un module masqué doit aussi être injoignable par son
 * adresse. Sans cela, « masqué » ne voudrait dire que « absent du menu » — et un lien envoyé
 * par courriel il y a un mois rouvrirait l'écran qu'on croyait retiré.
 */
export function canOpenModule(
  module: string,
  hidden: readonly string[],
  opts: { isSuperAdmin: boolean },
): boolean {
  return opts.isSuperAdmin || !isModuleHidden(hidden, module);
}

/** Ce qu'on affiche au Super Admin en haut d'un module qu'il a lui-même masqué. */
export function hiddenNotice(moduleLabel: string): string {
  return `« ${moduleLabel} » est masqué : vous seul le voyez. Les autres comptes ne le trouvent ni dans le menu, ni par son adresse.`;
}

/** Le décompte à afficher sur l'écran de réglage. */
export function hiddenSummary(hidden: readonly string[]): string {
  const n = normalizeHidden(hidden).length;
  if (n === 0) return "Tous les modules sont en service.";
  return `${n} module${n > 1 ? "s" : ""} masqué${n > 1 ? "s" : ""} — invisible${n > 1 ? "s" : ""} de tous, sauf de vous.`;
}
