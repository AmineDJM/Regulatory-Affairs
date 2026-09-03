/**
 * UNE BUSINESS UNIT EST UN SOUS-DÉPARTEMENT DE LA DIRECTION COMMERCIALE.
 *
 * ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
 *
 * Une BU a un budget Ad&Pro et une masse salariale. Elle n'avait ni l'un ni l'autre : les prises
 * en charge, congrès et matériels promotionnels d'une gamme tombaient dans un total commercial
 * indistinct, et « combien l'oncologie a-t-elle dépensé cette année ? » n'avait pas de réponse.
 * On la reconstituait à la main, dans un tableur, en filtrant sur des noms de produits.
 *
 * ── POURQUOI UN DÉPARTEMENT, ET NON DES COLONNES DE BUDGET SUR LA BU ────────────────────────
 *
 * Parce qu'un DÉPARTEMENT porte déjà exactement ces deux choses, et tout ce qui va avec : ses
 * enveloppes, ses dépenses, ses demandes de budget, sa caisse d'avance, ses salariés, ses droits
 * d'accès, son arbre et ses écrans. Donner à la BU ses propres colonnes aurait créé un second
 * mécanisme à côté de celui qui marche — et deux réponses à la même question, dont personne
 * n'aurait su laquelle croire (§17 : pas de second registre).
 *
 * Le rattachement se fait donc par un LIEN, pas par une copie : la BU pointe son département, et
 * tout ce que le module Budgets sait faire d'un département vaut aussitôt pour elle.
 *
 * ── CE QU'ON N'AUTOMATISE PAS ───────────────────────────────────────────────────────────────
 *
 * Le rattachement des BU existantes, et celui des demandes Ad&Pro déjà déposées. On ne devine pas
 * quelle gamme portait une prise en charge de l'an dernier : un rattachement faux est PIRE qu'un
 * rattachement absent, parce qu'il se compte dans un budget et que plus personne ne le rouvre.
 *
 * Module PUR : ni base, ni session. Testé.
 */

/**
 * LE NOM DU DÉPARTEMENT D'UNE BU.
 *
 * Préfixé, parce qu'il vivra dans la même liste que « Finances », « Regulatory » et « Ressources
 * humaines » : sans préfixe, « Oncologie » se lit comme un département de plein exercice, et l'on
 * s'étonne de ne pas y trouver de responsable RH.
 */
export function buDepartmentName(businessUnitName: string): string {
  const nom = businessUnitName.trim() || "Business Unit";
  return nom.toLowerCase().startsWith("bu ") ? nom : `BU ${nom}`;
}

/**
 * LE CODE DU DÉPARTEMENT — unique dans toute la plateforme (`Department.code` l'exige).
 *
 * Dérivé du code de la BU quand elle en a un, sinon de son nom réduit à des lettres. Le suffixe
 * garantit l'unicité sans dépendre d'un compteur : un identifiant de BU ne se réutilise pas, et
 * le code reste lisible dans un export (« BU-ONCO-K3F9 »).
 */
export function buDepartmentCode(businessUnit: { id: string; code?: string | null; name: string }): string {
  const base = (businessUnit.code ?? businessUnit.name)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 12) || "BU";
  const suffixe = businessUnit.id.slice(-4).toUpperCase();
  return `BU-${base}-${suffixe}`;
}

export interface BuDepartmentCheck {
  ok: boolean;
  reason?: string;
}

/**
 * PEUT-ON RATTACHER CETTE BU À UN DÉPARTEMENT ?
 *
 * Le parent doit exister : c'est sous la Direction commerciale que les gammes se rangent, et
 * créer un département orphelin le ferait apparaître au même niveau que les Finances — l'inverse
 * de ce qu'on cherche.
 *
 * Le refus NOMME ce qui manque et le geste qui l'obtient. « Impossible » seul fait ouvrir un
 * ticket ; « créez d'abord le département Direction commerciale » fait agir.
 */
export function canAttachBuDepartment(input: {
  businessUnitName: string;
  parentDepartmentId: string | null | undefined;
  alreadyAttached: boolean;
}): BuDepartmentCheck {
  if (input.alreadyAttached) {
    return { ok: false, reason: "Cette Business Unit a déjà son sous-département — son budget et sa masse salariale s'y lisent." };
  }
  if (!input.businessUnitName.trim()) {
    return { ok: false, reason: "Nommez la Business Unit avant de lui ouvrir un budget." };
  }
  if (!input.parentDepartmentId) {
    return {
      ok: false,
      reason: "Aucun département « Direction commerciale » : créez-le d'abord dans Administration → Départements. Une gamme se range SOUS lui, pas à côté des Finances.",
    };
  }
  return { ok: true };
}

// ───────────────────────── Le budget, consolidé et par gamme ─────────────────────────

export interface BuBudgetLine {
  businessUnitId: string;
  label: string;
  /** Enveloppe allouée à sa gamme pour l'exercice. */
  allocated: number;
  /** Ce qui a déjà été engagé — demandes Ad&Pro et dépenses du département. */
  spent: number;
  /** La BU n'a pas de sous-département : elle ne porte aucun budget. */
  attached: boolean;
}

export interface BuBudgetView {
  lines: BuBudgetLine[];
  totalAllocated: number;
  totalSpent: number;
  /** Combien de gammes n'ont pas encore de budget — elles ne comptent nulle part. */
  unattached: number;
}

/**
 * LE BUDGET PAR GAMME, ET SON CONSOLIDÉ — le même calcul pour les deux.
 *
 * Le consolidé est la SOMME des gammes, jamais un chiffre lu ailleurs. Deux sources pour un total
 * et son détail divergent au premier écart d'arrondi ou de périmètre, et l'on passe une matinée à
 * chercher lequel a raison.
 *
 * Une BU sans sous-département apparaît quand même, à zéro et SIGNALÉE : la masquer ferait croire
 * que toutes les gammes sont budgétées, et c'est justement celle-là qu'il faut rattacher.
 */
export function buBudgetView(lines: readonly BuBudgetLine[]): BuBudgetView {
  const totalAllocated = lines.reduce((a, l) => a + (l.attached ? l.allocated : 0), 0);
  const totalSpent = lines.reduce((a, l) => a + (l.attached ? l.spent : 0), 0);
  return {
    lines: [...lines].sort((a, b) => b.allocated - a.allocated || a.label.localeCompare(b.label, "fr")),
    totalAllocated,
    totalSpent,
    unattached: lines.filter((l) => !l.attached).length,
  };
}

/** Le taux de consommation d'une gamme, en %. `null` sans enveloppe : diviser par zéro ne dit rien. */
export function consumptionPct(line: BuBudgetLine): number | null {
  if (!line.attached || line.allocated <= 0) return null;
  return Math.round((line.spent / line.allocated) * 1000) / 10;
}

/** Ce qu'on écrit en tête du budget par gamme. */
export function buBudgetNotice(view: BuBudgetView): string | null {
  if (view.lines.length === 0) return null;
  if (view.unattached === 0) return null;
  return `${view.unattached} gamme(s) sans sous-département : leur budget et leur masse salariale ne sont comptés nulle part tant qu'elles ne sont pas rattachées.`;
}
