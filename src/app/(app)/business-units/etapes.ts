/**
 * LES QUATRE ÉTAPES DU MONTAGE D'UNE BU — dans un module NEUTRE (ni client, ni serveur) : la page serveur les lit pour
 * valider `?etape=`, le composant client pour dessiner ses onglets. Exportées depuis `bu-manager.tsx` ("use client"),
 * elles n'arrivaient au serveur que comme RÉFÉRENCE client — `ETAPES.includes` y plantait et « ⋯ › Business units »
 * comme « ⋯ › Secteurs » affichaient « Cette page n'a pas pu s'afficher » (Direction, 08/10).
 */
export const ETAPES = ["identite", "produits", "kams", "secteurs"] as const;
export type Etape = (typeof ETAPES)[number];
