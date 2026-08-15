/**
 * OÙ SE RANGE UN DOSSIER RÉGLEMENTAIRE : Pipeline → À traiter → Terminé.
 *
 * Les trois colonnes ne décrivent pas une étape technique mais une DÉCISION D'ENTREPRISE :
 *
 *   • **Pipeline** — le dossier existe, mais l'équipe n'a pas à s'en occuper. C'est très
 *     exactement ce que dit le VERROU : un dossier verrouillé n'est visible que du Super Admin,
 *     pas même de l'équipe Regulatory. Le pipeline, c'est donc le stock de dossiers en attente
 *     d'être ouverts.
 *   • **À traiter** — le Super Admin l'a déverrouillé : l'équipe peut, et doit, s'en saisir.
 *     Déverrouiller EST l'acte qui met un dossier au travail ; il n'y a pas d'autre bouton, et
 *     c'est ce qui rend le tableau lisible sans réunion.
 *   • **Terminé** — la décision d'enregistrement est obtenue. Un dossier abouti reste abouti :
 *     le reverrouiller ne le renvoie pas au pipeline, il ne se « re-traite » pas.
 *
 * Module PUR — testé. C'est la seule règle de rangement ; l'écran ne fait que l'afficher.
 */

export type RegStage = "pipeline" | "todo" | "done";

export interface StageInput {
  /** Verrou Super Admin : le dossier n'est visible que de lui. */
  isLocked: boolean;
  /** Statut réglementaire du dossier. */
  status: string;
}

/** Statuts qui closent un dossier — la décision est tombée, il n'y a plus à traiter. */
const FINISHED = ["DECISION_OBTAINED", "CLOSED"];

export function regStage(input: StageInput): RegStage {
  // L'aboutissement prime sur le verrou : reverrouiller un dossier obtenu ne le remet pas
  // « à faire ». Sans cette priorité, ranger des dossiers clos ferait disparaître des décisions
  // obtenues de la colonne qui sert justement à les retrouver.
  if (FINISHED.includes(input.status)) return "done";
  return input.isLocked ? "pipeline" : "todo";
}

export const REG_STAGES: { key: RegStage; label: string; hint: string }[] = [
  { key: "pipeline", label: "Pipeline", hint: "Dossiers verrouillés — invisibles de l'équipe tant qu'ils ne sont pas ouverts" },
  { key: "todo", label: "À traiter", hint: "Déverrouillés par le Super Admin : au travail" },
  { key: "done", label: "Traitement terminé", hint: "Décision d'enregistrement (DE) obtenue" },
];

/**
 * L'onglet qui s'ouvre par défaut.
 *
 * Pour l'équipe, c'est « À traiter » : le pipeline lui est invisible, l'ouvrir sur un onglet
 * toujours vide serait absurde. Le Super Admin, lui, arrive sur le pipeline quand il en reste —
 * c'est là qu'il a une décision à prendre.
 */
export function defaultStage(canLock: boolean, pipelineCount: number): RegStage {
  return canLock && pipelineCount > 0 ? "pipeline" : "todo";
}

/** Les onglets réellement affichés : sans le verrou, le pipeline n'existe pas pour cette personne. */
export function visibleStages(canLock: boolean): typeof REG_STAGES {
  return canLock ? REG_STAGES : REG_STAGES.filter((s) => s.key !== "pipeline");
}
