/**
 * RETOURS & RÉCLAMATIONS — les règles PURES (Direction, 08/10). Aucun import : l'écran (client), la fiche, la porte des
 * pièces et les actions serveur lisent les mêmes fonctions — deux écritures de « qui lit cette réclamation »
 * finiraient par répondre autrement (§118.5).
 */

export const TYPES_RECLAMATION = ["RETOUR", "RECLAMATION_QUALITE", "RAPPEL_LOT"] as const;
export type TypeReclamation = (typeof TYPES_RECLAMATION)[number];

export const STATUTS_RECLAMATION = ["OUVERTE", "EN_ANALYSE", "CLOTUREE"] as const;
export type StatutReclamation = (typeof STATUTS_RECLAMATION)[number];

type Ton = "neutral" | "info" | "success" | "warning" | "danger";

export const TYPE_RECLAMATION: Record<TypeReclamation, { label: string; tone: Ton }> = {
  RETOUR: { label: "Retour", tone: "info" },
  RECLAMATION_QUALITE: { label: "Réclamation qualité", tone: "warning" },
  RAPPEL_LOT: { label: "Rappel de lot", tone: "danger" },
};

export const STATUT_RECLAMATION: Record<StatutReclamation, { label: string; tone: Ton }> = {
  OUVERTE: { label: "Ouverte", tone: "warning" },
  EN_ANALYSE: { label: "En analyse", tone: "info" },
  CLOTUREE: { label: "Clôturée", tone: "success" },
};

export const PREFIXE_REFERENCE_RECLAMATION = "REC";

export const estTypeReclamation = (v: unknown): v is TypeReclamation => typeof v === "string" && (TYPES_RECLAMATION as readonly string[]).includes(v);
export const estStatutReclamation = (v: unknown): v is StatutReclamation => typeof v === "string" && (STATUTS_RECLAMATION as readonly string[]).includes(v);

/** Ce que sait la personne qui regarde, réduit à ce qui compte ici. */
export interface LecteurReclamation {
  userId: string;
  /** Voir le module en portée TOUT (ou Super Admin). */
  voitTout: boolean;
  /** Instruit : change le statut, le responsable, la conclusion (Modifier sur le module, ou Super Admin). */
  instruit: boolean;
}

export interface ReclamationLue {
  declaredById: string;
  ownerId: string | null;
  status: string;
}

/** Lit cette réclamation : la vue de tout, sinon le déclarant ou le responsable. */
export function lecteurDeLaReclamation(l: LecteurReclamation, r: ReclamationLue): boolean {
  return l.voitTout || r.declaredById === l.userId || r.ownerId === l.userId;
}

/** Joint une pièce / écrit dans l'échange : qui la lit, tant qu'elle n'est pas clôturée (qui instruit, toujours). */
export function peutContribuer(l: LecteurReclamation, r: ReclamationLue): boolean {
  if (!lecteurDeLaReclamation(l, r)) return false;
  return l.instruit || r.status !== "CLOTUREE";
}

/** Les statuts qu'on peut atteindre depuis celui-ci (rouvrir une réclamation clôturée la remet en analyse). */
export function statutsSuivants(de: StatutReclamation): StatutReclamation[] {
  if (de === "OUVERTE") return ["EN_ANALYSE", "CLOTUREE"];
  if (de === "EN_ANALYSE") return ["CLOTUREE", "OUVERTE"];
  return ["EN_ANALYSE"];
}

/** Refus d'une transition (texte), ou null. Clôturer exige une conclusion. */
export function refusTransition(de: StatutReclamation, vers: StatutReclamation, conclusion: string | null | undefined): string | null {
  if (de === vers) return "La réclamation est déjà dans ce statut.";
  if (!statutsSuivants(de).includes(vers)) return "Ce changement de statut n'est pas possible.";
  if (vers === "CLOTUREE" && !(conclusion ?? "").trim()) return "Indiquez la conclusion pour clôturer.";
  return null;
}

/** La quantité saisie : un entier ≥ 0, sinon null (« 1 200 » et « 1200 » sont acceptés). */
export function lireQuantite(brut: string | null | undefined): number | null {
  const t = (brut ?? "").replace(/[\s  ]/g, "");
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}
