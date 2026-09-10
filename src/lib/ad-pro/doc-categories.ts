/**
 * LES CATÉGORIES DE PIÈCES D'UNE PRISE EN CHARGE — écrites UNE fois.
 *
 * Elles vivaient dans `congress-detail-view.tsx`, à côté du bloc « Documents » générique. Ce
 * bloc a disparu et le téléverseur est monté par les DEUX pages (international, national) : la
 * liste doit donc être lisible d'ailleurs que de la vue. La recopier de chaque côté ferait deux
 * listes qui divergent à la première catégorie ajoutée, et le symptôme serait qu'une pièce
 * classable sur un écran ne l'est pas sur l'autre (§118.5).
 *
 * Module PUR : des données de formulaire, rien d'autre.
 */
export const CONGRESS_DOC_CATEGORIES: readonly string[] = [
  "REQUEST_LETTER", "PROGRAM", "QUOTE", "INVOICE", "CONVENTION", "SUPPORTING_DOC", "PHOTO", "OTHER",
];
