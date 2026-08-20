/**
 * LES PIÈCES JOINTES DE LA MESSAGERIE — deux natures, et la différence compte.
 *
 * • **Un fichier TÉLÉVERSÉ** : le contenu part dans le message. C'est une copie, figée à l'instant
 *   de l'envoi. Parfait pour un scan, une photo, une pièce qui n'existe nulle part ailleurs.
 *
 * • **Une RÉFÉRENCE au Drive** : rien n'est recopié. Le message pointe vers le nœud, et les
 *   destinataires reçoivent un accès en LECTURE. C'est la bonne façon d'envoyer un document de
 *   travail : recopier un contrat de 40 Mo à chaque conversation, c'est multiplier le stockage
 *   par le nombre d'envois, et surtout FIGER une version — six mois plus tard, cinq personnes
 *   travaillent sur cinq copies différentes et personne ne sait laquelle fait foi.
 *
 * Un DOSSIER se référence comme un fichier : une liasse (l'original, ses annexes, le ZIP du
 * fournisseur) s'envoie d'un geste, et n'accepter que des fichiers obligerait à choisir lequel
 * des cinq « fait foi ».
 *
 * Module PUR — testé, sans base de données, importable côté serveur comme côté client.
 */

/** Au-delà, ce n'est plus un message : c'est un envoi de fichiers déguisé. */
export const MAX_ATTACHMENTS = 10;

export interface DriveRefInput {
  id: string;
  name: string;
  isFolder: boolean;
}

/**
 * Ce que le destinataire lit à la place du nom brut.
 *
 * La mention « Drive » n'est pas décorative : elle dit que le fichier n'est PAS une copie reçue
 * mais le document lui-même, celui qui bougera si son auteur le corrige. Sans elle, on croit
 * avoir reçu une pièce jointe et on la re-téléverse ailleurs.
 */
export function driveRefLabel(name: string, isFolder: boolean): string {
  return isFolder ? `Dossier « ${name} » — Drive` : `${name} — Drive`;
}

/** Où mène un clic sur une référence : le fichier s'ouvre, le dossier se navigue. */
export function driveRefHref(nodeId: string, isFolder: boolean): string {
  return isFolder ? `/drive?folder=${nodeId}` : `/drive/${nodeId}`;
}

/**
 * QUI DOIT RECEVOIR UN ACCÈS quand on partage un nœud du Drive dans une conversation.
 *
 * Trois exclusions, et chacune évite une ligne inutile en base :
 *   • l'EXPÉDITEUR — il a déjà accès, c'est bien pour cela qu'il peut le partager ;
 *   • le PROPRIÉTAIRE du nœud — se partager son propre fichier n'a pas de sens ;
 *   • ceux qui ont DÉJÀ un partage — un `VIEW` posé par-dessus un `EDIT` existant serait une
 *     RÉGRESSION de droit : on ne retire jamais l'édition à quelqu'un en lui envoyant un message.
 *
 * On n'accorde jamais que la LECTURE : envoyer un document, ce n'est pas déléguer sa tenue.
 */
export function recipientsToGrant(
  memberIds: readonly string[],
  opts: { senderId: string; ownerId?: string | null; alreadyShared?: readonly string[] },
): string[] {
  const already = new Set(opts.alreadyShared ?? []);
  const out = new Set<string>();
  for (const id of memberIds) {
    if (!id) continue;
    if (id === opts.senderId) continue;
    if (opts.ownerId && id === opts.ownerId) continue;
    if (already.has(id)) continue;
    out.add(id);
  }
  return [...out];
}

/**
 * L'AVERTISSEMENT AVANT L'ENVOI — dit à l'expéditeur ce qu'il s'apprête à ouvrir.
 *
 * Partager un document du Drive DONNE UN ACCÈS, et un accès ne se reprend pas d'un clic. La
 * phrase se lit avant d'appuyer sur Envoyer, pas après : c'est là qu'on peut encore changer
 * d'avis.
 */
export function shareWarning(recipientCount: number): string {
  if (recipientCount <= 0) return "Aucun accès supplémentaire ne sera accordé.";
  if (recipientCount === 1) return "Le destinataire recevra un accès en lecture à ce contenu du Drive.";
  return `Les ${recipientCount} destinataires recevront un accès en lecture à ce contenu du Drive.`;
}

/**
 * Le nom du ZIP produit quand on envoie un DOSSIER de son ordinateur.
 *
 * Un navigateur ne sait pas envoyer un dossier : il envoie ses fichiers à plat, et le message
 * afficherait alors quarante pièces jointes sans hiérarchie. On rassemble donc en une archive —
 * qui porte le nom du dossier, sans quoi le destinataire reçoit un « archive.zip » de plus.
 */
export function folderZipName(folderName: string): string {
  const clean = folderName
    .replace(/[\\/:*?"<>|]/g, "-") // caractères refusés par les systèmes de fichiers
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.zip$/i, "");
  // Un nom qui ne contient AUCUNE lettre ni chiffre n'est pas un nom : « ---.zip » n'apprend rien
  // de plus que « Dossier.zip », et se lit moins bien.
  const usable = /[\p{L}\p{N}]/u.test(clean) ? clean : "";
  return `${usable || "Dossier"}.zip`;
}

/**
 * Le nom du dossier racine d'une sélection `webkitdirectory`.
 *
 * Le navigateur ne donne PAS le nom du dossier choisi : il donne, pour chaque fichier, un chemin
 * relatif (« Contrats/2026/bail.pdf »). Le premier segment est donc la seule trace du dossier
 * qu'on a désigné.
 */
export function rootFolderName(relativePaths: readonly string[]): string | null {
  for (const p of relativePaths) {
    const first = (p ?? "").split("/")[0];
    if (first) return first;
  }
  return null;
}
