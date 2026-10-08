/** RETOURS & RÉCLAMATIONS — les adresses. Module PUR (aucun import). */
export const CHEMIN_RECLAMATIONS = "/retours-reclamations";

/** La fiche d'une réclamation : le panneau latéral de la liste. */
export const lienReclamation = (id: string): string => `${CHEMIN_RECLAMATIONS}?id=${encodeURIComponent(id)}`;

/** Le formulaire « Nouvelle réclamation » ouvert d'emblée (depuis la journée du KAM). */
export const lienNouvelleReclamation = (): string => `${CHEMIN_RECLAMATIONS}?nouvelle=1`;
