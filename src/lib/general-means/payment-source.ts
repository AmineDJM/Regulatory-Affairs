/**
 * COMMENT L'ACHAT A-T-IL ÉTÉ PAYÉ ? — la seule question qui séparait deux boutons.
 *
 * Il y avait « Ajouter une dépense » (sur le budget) et « Enregistrer une dépense » (sur la
 * caisse du mois). Deux boutons, deux formulaires, deux endroits — pour la MÊME dépense : le
 * même achat, la même facture, le même budget consommé. Seul le moyen de paiement changeait.
 *
 * Le coût de cette séparation n'était pas théorique : on saisissait par le mauvais bouton, et
 * la caisse du mois se retrouvait fausse d'un côté, gonflée de l'autre — sans qu'aucun des deux
 * écrans ne le dise. Un seul bouton, une case à cocher, et la dépense se corrige après coup.
 *
 * Module PUR — testé, sans base de données.
 */

export type PaymentSource = "CASH" | "OFF_CASH";

export const SOURCE_LABEL: Record<PaymentSource, string> = {
  CASH: "Caisse du mois",
  OFF_CASH: "Hors caisse",
};

export const SOURCE_HINT: Record<PaymentSource, string> = {
  CASH: "Payé en liquide sur le fond détenu ce mois-ci — le montant en est déduit.",
  OFF_CASH: "Virement, carte, facture réglée par les Finances — déduit de la caisse de l'exercice.",
};

/** D'où sort une dépense déjà enregistrée : de la caisse, ou d'ailleurs. */
export function sourceOf(expense: { pettyCashId?: string | null }): PaymentSource {
  return expense.pettyCashId ? "CASH" : "OFF_CASH";
}

/**
 * La caisse est-elle utilisable comme moyen de paiement ?
 *
 * Trois conditions, et les trois comptent : il faut une caisse ouverte ce mois-ci, elle doit
 * avoir été RECUE (une somme décidée mais pas encaissée n'existe pas encore), et c'est la
 * personne qui la détient qui en sort l'argent. Proposer l'option en dehors de ces cas, c'est
 * offrir un choix qui sera refusé après la saisie — donc après la perte du formulaire.
 */
export function cashAvailable(
  cash: { status: string } | null | undefined,
  opts: { isHolder: boolean; globalView?: boolean },
): boolean {
  if (!cash || cash.status !== "RECEIVED") return false;
  return opts.isHolder || Boolean(opts.globalView);
}

export interface SourceResolution {
  source: PaymentSource;
  /** L'identifiant de caisse à inscrire sur la dépense — `null` hors caisse. */
  pettyCashId: string | null;
  error?: string;
}

/**
 * Ce que le formulaire demande, confronté à ce qui est possible.
 *
 * On ne retombe JAMAIS silencieusement sur « hors caisse » quand la caisse est demandée mais
 * indisponible : la dépense serait enregistrée, le budget consommé, et le fond du mois
 * resterait faux — une erreur qu'on ne découvre qu'au moment de solder la caisse.
 */
export function resolveSource(
  requested: string | null | undefined,
  cash: { id: string; status: string } | null | undefined,
  opts: { isHolder: boolean; globalView?: boolean },
): SourceResolution {
  if (requested !== "CASH") return { source: "OFF_CASH", pettyCashId: null };
  if (!cash) {
    return { source: "OFF_CASH", pettyCashId: null, error: "Aucune caisse ouverte ce mois-ci : cette dépense ne peut pas en sortir." };
  }
  if (!cashAvailable(cash, opts)) {
    return {
      source: "OFF_CASH", pettyCashId: null,
      error: cash.status !== "RECEIVED"
        ? "La caisse du mois n'a pas encore été confirmée reçue : rien ne peut en sortir."
        : "Seule la personne qui détient la caisse y impute des dépenses.",
    };
  }
  return { source: "CASH", pettyCashId: cash.id };
}

/**
 * Le changement de moyen de paiement d'une dépense déjà enregistrée, dit en clair.
 *
 * `null` quand rien ne change — l'appelant n'a alors ni journal à écrire ni solde à revérifier.
 */
export function sourceChange(before: PaymentSource, after: PaymentSource): string | null {
  if (before === after) return null;
  return after === "CASH"
    ? `Dépense rattachée à la caisse du mois (elle en est désormais déduite)`
    : `Dépense sortie de la caisse du mois (payée hors caisse)`;
}

/** Le choix par défaut à l'ouverture du formulaire : la caisse quand elle est utilisable. */
export function defaultSource(
  cash: { status: string } | null | undefined,
  opts: { isHolder: boolean; globalView?: boolean },
): PaymentSource {
  return cashAvailable(cash, opts) ? "CASH" : "OFF_CASH";
}
