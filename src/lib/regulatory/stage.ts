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
 * L'onglet qui s'ouvre par défaut sur l'écran REGULATORY : « À traiter ».
 *
 * Le pipeline a quitté cet écran (voir `visibleStages`) : il n'y a plus qu'un choix entre ce
 * qu'on traite et ce qui est terminé, et l'on commence évidemment par le premier.
 */
export function defaultStage(_canLock: boolean, _pipelineCount: number): RegStage {
  return "todo";
}

/**
 * Les onglets de l'écran REGULATORY — le pipeline n'en fait plus partie.
 *
 * Un dossier verrouillé n'est pas un dossier réglementaire en cours : c'est un produit qu'on
 * ÉTUDIE, et dont on n'a pas encore décidé qu'on le déposerait. Cette question-là appartient au
 * Business Development (l'avant-vente : ce qu'on étudie et ce qu'on vise), pas à l'équipe qui
 * instruit les dossiers ouverts. Il vit désormais sur `/business-development/pipeline`.
 *
 * `regStage` continue de le classer : c'est le rangement qui reste, seul l'écran change.
 */
export function visibleStages(_canLock: boolean): typeof REG_STAGES {
  return REG_STAGES.filter((s) => s.key !== "pipeline");
}
