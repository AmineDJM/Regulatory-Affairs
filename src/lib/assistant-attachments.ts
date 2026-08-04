/**
 * Types PARTAGÉS des pièces jointes de l'assistant (aucune dépendance serveur : importable
 * par le client). L'extraction de texte, elle, vit côté serveur (`assistant-files.ts`).
 */

/** Source d'une pièce jointe envoyée à l'assistant : fichier téléversé (base64) OU
 *  référence à un fichier DÉJÀ présent dans le Drive (aucun re-téléversement). */
export type AssistantAttachment =
  | { kind: "upload"; name: string; dataB64: string }
  | { kind: "drive"; nodeId: string; name: string };

/** Fichier du Drive proposé au « glisser » dans l'assistant (sélecteur). */
export interface AssistantFileOption {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
}
