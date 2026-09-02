/**
 * « DOSSIER REÇU » — une colonne qui ne se coche pas, parce qu'elle se CONSTATE.
 *
 * ── LA QUESTION QU'ELLE RÉPOND ──────────────────────────────────────────────────────────────
 *
 * Avons-nous, oui ou non, reçu le dossier CTD de ce produit ? C'est la première question qu'on
 * pose sur un dossier réglementaire, et la seule à laquelle un tableau de soixante-neuf lignes ne
 * répondait pas : il fallait ouvrir l'onglet « Enregistrement », chercher le produit, regarder si
 * une archive y était montée.
 *
 * ── POURQUOI ELLE N'EST PAS MODIFIABLE ──────────────────────────────────────────────────────
 *
 * Parce qu'une case à cocher répondrait à une AUTRE question : « quelqu'un pense-t-il que le
 * dossier est arrivé ? ». Les deux divergent le jour même où on les sépare — on coche « reçu »
 * en attendant l'envoi promis, puis on oublie de décocher, et la colonne ne veut plus rien dire.
 *
 * La réponse se lit donc sur le FAIT : une archive du dossier CTD a été téléversée dans le
 * processus d'enregistrement (`RegulatoryDossierVersion.originalZipBlobId`). Rien à saisir, rien
 * à tenir à jour, rien qui puisse mentir — et la seule façon de faire passer la colonne à « Yes »
 * est de déposer le dossier, ce qui est précisément ce qu'on veut obtenir.
 *
 * ── « Yes » / « No », ET NON « Oui » / « Non » ──────────────────────────────────────────────
 *
 * Les libellés sont ceux demandés par le métier : les classeurs partent aussi à des
 * interlocuteurs qui ne lisent pas le français. Le reste de l'écran reste en français ; ces deux
 * mots-là sont une convention de la colonne, pas un oubli de traduction.
 *
 * Module PUR : ni base, ni session. Testé.
 */

export interface DossierReceipt {
  /** Une archive originale a-t-elle été téléversée pour ce produit ? */
  hasArchive: boolean;
}

export const DOSSIER_RECEIVED_YES = "Yes";
export const DOSSIER_RECEIVED_NO = "No";

/**
 * LE DOSSIER EST-IL REÇU ?
 *
 * Un dossier d'enregistrement OUVERT ne suffit pas : on ouvre un dossier pour préparer sa
 * réception, souvent des semaines avant que le fournisseur envoie quoi que ce soit. Ce qui
 * compte est l'ARCHIVE — le fichier que l'on a réellement entre les mains.
 */
export function dossierReceived(input: DossierReceipt | null | undefined): boolean {
  return Boolean(input?.hasArchive);
}

/** « Yes » / « No » — la valeur telle qu'elle s'affiche et telle qu'elle s'exporte. */
export function dossierReceivedLabel(received: boolean): string {
  return received ? DOSSIER_RECEIVED_YES : DOSSIER_RECEIVED_NO;
}

/** Les deux valeurs du filtre déroulant — dans cet ordre : ce qu'on cherche, c'est ce qui manque. */
export function dossierReceivedOptions(): { value: string; label: string }[] {
  return [
    { value: DOSSIER_RECEIVED_NO, label: DOSSIER_RECEIVED_NO },
    { value: DOSSIER_RECEIVED_YES, label: DOSSIER_RECEIVED_YES },
  ];
}

/** Ce qu'on lit en survolant la colonne — sans quoi on cherche le bouton qui la modifie. */
export const DOSSIER_RECEIVED_HINT =
  "Constaté, non modifiable : passe à « Yes » quand le dossier CTD est téléversé dans l'onglet Enregistrement.";
