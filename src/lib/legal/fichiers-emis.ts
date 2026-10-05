/**
 * LES FICHIERS QU'UNE PIÈCE LEGAL A FAIT PRODUIRE PAR LA FABRIQUE — ce module est la porte HISTORIQUE ; le code vit au
 * SOCLE (`lib/lecteurs/fichiers-emis.ts`, zéro import).
 *
 * Il en a descendu parce que DEUX domaines le lisent sans avoir le droit de se parler : Legal (la fiche, la route du
 * fichier) et Ad & Pro (la case « Bon de commande » d'un poste liste le Word et le PDF de chaque BC qu'il a généré,
 * §118.206). L'importer depuis `legal/` aurait ajouté une traversée de plus — et le plafond ne se lève pas (§118.72).
 */
export * from "@/lib/lecteurs/fichiers-emis";
