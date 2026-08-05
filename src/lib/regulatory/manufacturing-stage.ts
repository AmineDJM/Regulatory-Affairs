import type { ManufacturingStatus, VariationStatus } from "@prisma/client";

/**
 * NIVEAU DE PROCESS d'un produit : Importation → Secondary Packaging → Primary Packaging →
 * Full Process. C'est la trajectoire d'industrialisation locale d'un médicament importé.
 *
 * ⚠️ RÈGLE MÉTIER : **une variation OBTENUE fait foi.** Le niveau saisi sur la fiche produit
 * n'est qu'une déclaration ; dès qu'une variation est obtenue auprès de l'ANPP, c'est SA cible
 * qui est le niveau réel, et rien d'autre.
 *
 * Pourquoi le CALCULER plutôt que le recopier : la valeur était déjà écrite sur le produit au
 * moment où l'on marquait la variation « obtenue ». Mais une modification ultérieure de la
 * fiche (à la main, par import, par une correction) pouvait la faire diverger de la réalité
 * réglementaire — et plus personne ne savait laquelle des deux croire. En dérivant le niveau à
 * la lecture, la divergence devient impossible : la décision de l'ANPP l'emporte toujours.
 *
 * Fonctions PURES (aucune requête) : c'est ce qui les rend testables et utilisables partout —
 * tableau, fiche produit, export, assistant.
 */

/** Ordre d'industrialisation : plus l'indice est élevé, plus la fabrication est locale. */
export const STAGE_ORDER: ManufacturingStatus[] = [
  "IMPORTATION", "SECONDARY_PACKAGING", "PRIMARY_PACKAGING", "FULL_PROCESS",
];

export const stageRank = (s: ManufacturingStatus): number => Math.max(0, STAGE_ORDER.indexOf(s));

/** Variation, réduite à ce qui décide du niveau. */
export interface VariationLike {
  toStatus: ManufacturingStatus;
  status: VariationStatus;
  decisionDate: Date | string | null;
  createdAt?: Date | string | null;
}

export type StageSource = "DECLARED" | "VARIATION";

export interface EffectiveStage {
  /** Le niveau qui fait foi. */
  status: ManufacturingStatus;
  /** D'où il vient : déclaré sur la fiche, ou acté par une variation obtenue. */
  source: StageSource;
  /** Date de la décision, quand le niveau vient d'une variation. */
  decidedAt: string | null;
  /** Une variation est déposée et attend une décision. */
  pendingTo: ManufacturingStatus | null;
}

const time = (d: Date | string | null | undefined): number => {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * Le niveau de process qui fait foi pour un produit.
 *
 * Parmi les variations **obtenues**, on retient la plus récente (par date de décision ; à
 * défaut, la dernière créée). En cas d'égalité parfaite, le niveau le plus avancé l'emporte —
 * on ne fait jamais reculer une industrialisation déjà actée.
 */
export function effectiveStage(
  declared: ManufacturingStatus,
  variations: VariationLike[] = [],
): EffectiveStage {
  const obtained = variations.filter((v) => v.status === "OBTENUE");
  const pending = variations
    .filter((v) => v.status === "EN_ATTENTE")
    .sort((a, b) => stageRank(b.toStatus) - stageRank(a.toStatus))[0];

  if (obtained.length === 0) {
    return { status: declared, source: "DECLARED", decidedAt: null, pendingTo: pending?.toStatus ?? null };
  }

  const winner = obtained.reduce((best, v) => {
    const dv = time(v.decisionDate) || time(v.createdAt);
    const db = time(best.decisionDate) || time(best.createdAt);
    if (dv !== db) return dv > db ? v : best;
    return stageRank(v.toStatus) > stageRank(best.toStatus) ? v : best;
  });

  const decided = winner.decisionDate ?? winner.createdAt ?? null;
  return {
    status: winner.toStatus,
    source: "VARIATION",
    decidedAt: decided ? new Date(decided).toISOString() : null,
    pendingTo: pending?.toStatus ?? null,
  };
}
