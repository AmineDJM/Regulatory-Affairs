/**
 * Moteur d'invariants métier (§28) — **indépendant de l'interface**. Chaque invariant porte son
 * identité, sa criticité, les modules/modèles concernés, la preuve attendue, la stratégie de
 * vérification et le comportement en cas d'échec. Un invariant critique en échec **bloque la
 * certification**.
 *
 * Les invariants « ligne à ligne » exposent un `predicate` PUR (sur un enregistrement en mémoire) :
 * c'est la source de vérité unique, réutilisée à la fois par la vérification base réelle et par le
 * **mutation testing** (§27), qui fabrique des mondes synthétiques violant l'invariant pour prouver
 * que le moteur les détecte.
 */

export type Criticality = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface InvariantResult {
  id: string;
  ok: boolean;
  checked: number;
  violations: number;
  sample: unknown[];
  note?: string;
  skipped?: boolean;
}

export interface RowPredicate {
  model: string; // modèle Prisma concerné (pour le mutation testing)
  /** Vrai si l'enregistrement en mémoire respecte l'invariant. Pur, sans I/O. */
  holds: (row: Record<string, unknown>) => boolean;
}

export interface BusinessInvariant {
  id: string; // "INV-WFI-001"
  description: string;
  criticality: Criticality;
  modules: string[];
  models: string[];
  expectation: string; // preuve attendue
  strategy: string; // stratégie de vérification
  onFailure: string; // comportement en cas d'échec
  blocksCertification: boolean;
  /** Vérification sur base réelle (lecture seule). */
  check: () => Promise<Omit<InvariantResult, "id">>;
  /** Prédicat pur optionnel (invariants ligne à ligne) — réutilisé par le mutation testing. */
  predicate?: RowPredicate;
}

export const CRITICALITY_TO_SEVERITY: Record<Criticality, "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"> = {
  CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW",
};
