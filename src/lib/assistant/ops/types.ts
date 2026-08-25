import type { CurrentUser } from "@/lib/session";

/**
 * Contrat d'IMPLÉMENTATION d'une op de domaine (côté serveur — les métadonnées vivent dans
 * `catalog.ts`). `propose` résout les entrées humaines et rend la matière de la carte de
 * confirmation ; `execute` appelle l'action canonique de l'écran avec les `args` mémorisés.
 */
export interface OpProposalDraft {
  title: string;
  fields: { label: string; value: string }[];
  warnings?: string[];
  /** CRITICAL uniquement : la valeur à RESSAISIR pour armer la confirmation. */
  confirmText?: string;
  /** Arguments rejoués à l'exécution (l'action canonique revalide tout). */
  args: Record<string, string | null>;
  successMessage: string;
  link?: string;
  revalidate?: string[];
}

export interface OpExecuteResult {
  ok: boolean;
  error?: string;
  message?: string;
  link?: string;
  revalidate?: string[];
  /** Id de l'entité créée, pour le chaînage des plans d'action ($prev). */
  createdId?: string;
}

export interface OpImpl {
  propose: (input: Record<string, unknown>, user: CurrentUser) => Promise<OpProposalDraft | { error: string }>;
  execute: (args: Record<string, string | null>, user: CurrentUser) => Promise<OpExecuteResult>;
}

export const opStr = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";
