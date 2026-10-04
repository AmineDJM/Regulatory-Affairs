# Chantier en cours — point de reprise (04/10/2026)

Ce fichier existe pour qu'une session suivante reprenne sans rien perdre. **Le commit qui le porte est un
POINT DE SAUVEGARDE non vérifié** (typecheck/build/suite pas encore rejoués sur l'ensemble). Le supprimer
quand le lot est vérifié et documenté (README + CLAUDE.md §118.204+).

## Fait (dans l'arbre)
- Postes Ad & Pro (§118.204) : validation en 2 temps (Direction des opérations → Direction Marketing + budget,
  `lib/ad-pro/validation-poste.ts`) ; BC demandé à l'assistante via demande de pièce et rattaché au poste
  (`AdProItemPiece`, `lib/ad-pro/pieces-poste.ts`, `classerDansLegal`) ; devis/pro forma partagé entre postes
  (`ajouterDevisPoste`) ; facture obligatoire → paiement (`demanderPaiementPoste`, `emitItemExpenseOrder` supprimée) ;
  carte de poste épurée (`items-panel.tsx`) ; « Pièces liées » retiré des pages Ad & Pro (`pieces-jointes-demande.tsx`,
  `espace-discussion.tsx`) ; exception de lecture des pièces de poste (`entity-access.ts`) ; Mon espace par temps.
  Migration `20270106090000_postes_chaine_pieces`. 9 défauts trouvés par le banc corrigés.
- Territoire des KAM (BU hospitalière) + diagnostic du panel vide — migration `20270106093000_territoire_kam`.
- Luna conseil de placement des pièces (`lib/conseil-pieces-ia.ts`, `ad-pro-conseil-actions.ts`, `conseil-luna.tsx`) —
  migration `20270106100000_conseil_pieces`.
- Rapport terrain : matériel remis — migration `20270106110000_remises_rapport_terrain`.
- Moyens généraux : seulement le catalogue (la caisse n'a plus d'écran — à arbitrer).
- Paie : masse mensuelle/annuelle par entité + rattachement des sans-entité ; Comptabilité : paie au mois de paie + période.

## En cours au moment du commit (agents)
- Annuler sa demande tant qu'elle n'est pas exécutée (12 natures).
- Voyageurs : passeport, aller simple/aller-retour, mode de transport, devis par voyageur → BC → facture.
- Prises en charge nationales/internationales : professionnels proposés, formulaire simplifié, suivi pièces/visa.
- Matériel promotionnel : devis rangés auto avec agence, BC par agence, produits/« Société en général »/« Gamme »/« Autre »,
  aperçu avant demande de devis (agent en worktree — patch à intégrer).

## Reste à faire
1. Intégrer ce qui manque, puis : `npx tsc --noEmit`, `rm -rf .next && npm run build`, `npm test` (seul), `npx next lint`,
   `npm run actions:contrat` (lire le diff), cliquets (frontière 425, traversées 68…), sabotages.
2. README + entrée CLAUDE.md §118.204 et suivantes ; `npm run graphify:refresh`.
3. Livrer l'AUDIT (longue liste) : audit stockage (4 chemins de perte : faux « téléversé » `documents.ts:52`,
   purge des orphelins qui ignore 11 tables `drive-storage.ts:297`, copie Drive sans refCount `drive-actions.ts:624`,
   `releaseBlob` non atomique) + défauts d'interface/doubles boutons/portes inutiles relevés par les agents.
