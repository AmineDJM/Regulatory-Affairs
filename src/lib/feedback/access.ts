/**
 * QUI a le droit de voir — et de retirer — la pièce jointe d'un retour.
 *
 * Deux cercles, et deux seulement : la personne qui a déposé le retour, et le Super Admin qui
 * le traite. Un retour peut contenir la capture d'un écran de paie ou d'un contrat — il n'a
 * aucune raison d'être lisible par le reste de l'entreprise.
 *
 * Ces prédicats vivent dans un module PUR, hors de `"use server"`, pour deux raisons : un
 * module d'actions serveur ne peut exporter que des fonctions asynchrones, et surtout la règle
 * doit être appelable par la route de téléchargement comme par l'action de suppression. Une
 * règle d'accès réécrite à deux endroits est une règle qui diverge.
 */

export interface FeedbackViewer {
  id: string;
  role: string;
}

export function canReadFeedback(viewer: FeedbackViewer, feedback: { userId: string }): boolean {
  return viewer.role === "SUPER_ADMIN" || feedback.userId === viewer.id;
}

/** Retirer une pièce demande le même droit que la lire : c'est son retour, ou on l'administre. */
export function canRemoveFeedbackAttachment(viewer: FeedbackViewer, feedback: { userId: string }): boolean {
  return canReadFeedback(viewer, feedback);
}
