/**
 * UNE DESTINATION BUDGÉTAIRE, réduite à ce qu'il faut pour choisir.
 *
 * Ce type traverse la frontière serveur / navigateur : le formulaire d'achat l'affiche, la
 * requête serveur le produit. Il vit donc dans un module PUR — le formulaire est un composant
 * client, et importer depuis lui le fichier de requêtes embarquerait Prisma dans le bundle du
 * navigateur (« Module not found: Can't resolve 'fs' » à la compilation de production).
 */
export interface BudgetTarget {
  id: string;
  /** « Enveloppe › Catégorie › Sous-catégorie » — le chemin complet, pour savoir où l'on range. */
  label: string;
  /** Sous-catégorie ? (affichée en retrait dans la liste) */
  isSub: boolean;
}
