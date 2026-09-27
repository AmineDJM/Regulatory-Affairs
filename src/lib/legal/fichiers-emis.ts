/**
 * LES FICHIERS QU'UNE PIÈCE LEGAL A FAIT PRODUIRE PAR LA FABRIQUE — où ils sont, et l'adresse qui
 * les ouvre (§118.152).
 *
 * La fabrique (bon de commande, facture, devis) écrit le Word et le PDF d'une pièce dans le Drive
 * PERSONNEL de celui qui l'a émise : c'est là que ses droits existent, et cela évite qu'un
 * « enregistrer sous » publie dans un espace partagé. Mais la pièce, elle, appartient au REGISTRE :
 * les Finances la signent, le centre de validation la valide, le demandeur d'un matériel
 * promotionnel l'envoie à son fournisseur. Aucun d'eux n'est propriétaire du fichier — l'ouvrir
 * par le Drive leur répondait 403 : on signait une pièce qu'on ne pouvait pas lire.
 *
 * L'adresse ci-dessous sert ces fichiers-là, et eux seuls, sous la porte de la PIÈCE (qui peut la
 * lire peut lire ce que la plateforme a produit pour elle). Un fichier du Drive rattaché à la main
 * à une pièce garde la porte du Drive : quelqu'un a décidé où il vivait et qui le lisait, et la
 * pièce ne l'efface pas.
 *
 * Module PUR, zéro import : l'écran (client) compose l'adresse, le serveur lit les nœuds — la même
 * lecture des deux côtés.
 */

export type FormatFichierEmis = "pdf" | "docx";

export interface FichiersEmis {
  docx: string | null;
  pdf: string | null;
}

const idDe = (v: unknown): string | null => {
  const id = (v as { nodeId?: unknown } | null | undefined)?.nodeId;
  return typeof id === "string" && id.length > 0 ? id : null;
};

/** Les nœuds Drive que la fabrique a écrits pour cette pièce — lus dans `LegalDocument.custom`. */
export function fichiersEmis(custom: unknown): FichiersEmis {
  const fab = (custom as { fabrique?: { docx?: unknown; pdf?: unknown } } | null | undefined)?.fabrique;
  return { docx: idDe(fab?.docx), pdf: idDe(fab?.pdf) };
}

/** L'adresse qui ouvre le fichier émis d'une pièce — sous la porte de la pièce, pas du Drive. */
export function lienFichierEmis(legalDocumentId: string, format: FormatFichierEmis, telecharger = false): string {
  return `/api/legal/${encodeURIComponent(legalDocumentId)}/fichier?format=${format}${telecharger ? "&dl=1" : ""}`;
}
