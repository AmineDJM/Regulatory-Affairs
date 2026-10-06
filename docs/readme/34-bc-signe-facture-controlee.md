## Ad & Pro — BC modifiable, BC signé sur papier, facture contrôlée par Luna (Direction, 06/10)

### Le circuit, de bout en bout

1. **Génération** : le BC naît des lignes validées du devis (`genererBonDeCommandePoste`). Au-dessus du seuil, il passe automatiquement au centre de validation, qui peut le refuser (`aiguillerBC`).
2. **Modification native, sans limite** tant qu'il n'est pas signé : « Modifier le BC » sur la case du poste (`modifierBcDuPoste`). Chaque modification crée une nouvelle **version** sous le même numéro, régénère le Word et le PDF, et réaiguille le BC (un montant relevé le renvoie au centre). Le demandeur n'a pas besoin du droit Legal : la délégation du poste est nommée au journal. Un HT déjà au-delà de l'accordé est refusé.
3. **Signature = copie signée obligatoire** : dans le module « Bons de commande » (ou sur la fiche Legal), les Finances téléversent le **BC signé** (PDF ou photo) et nomment le **signataire** (`signerBonDeCommande`). Luna regarde le bas de la ou des dernières pages (`signature-luna.ts`) :
   - aucune signature manuscrite repérée : refus (un cachet seul ne suffit pas) ;
   - numéro d'un autre BC lu sur la copie : refus ;
   - Luna indisponible : la signature est enregistrée avec la mention « non vérifiée ».
   La copie est un `Document` d'étape `BC_SIGNE`. `LegalDocument.signedByName` porte le signataire et `signatureCheck` le constat. Une révision ultérieure efface la signature, la copie et le constat.
4. **Le BC signé remplace le non signé** sur la case du poste (lien « BC signé », signataire, constat de Luna), et la **case Facture se débloque**, BC par BC.
5. **Facture** : `deposerFacturePoste`. Luna lit la facture (`facture-poste-lecture.ts`) et la compare au(x) BC qu'elle couvre (`controlerFacture`) sur quatre points :
   - le montant total, à 1 DZD près ;
   - la concordance entre le montant lu et le montant saisi ;
   - les numéros de BC cités sur la facture ;
   - le fournisseur.
   Le contrôle est gardé sur la facture (`custom.facturePoste.controle`).
6. **Demande de paiement** : la case se déclenche quand chaque BC signé a sa facture. Si tout est cohérent, la demande part directement. Sinon, elle exige une **argumentation** et la case « Oui, je souhaite quand même faire la demande de paiement » (`refusDemandePaiementBC`). L'écart et l'argument sont écrits dans l'ordre de dépense. Le montant ne dépasse jamais l'accordé.

### Plusieurs BC

Un poste porte un BC par devis. Une facture couvre un ou plusieurs BC : on coche ceux qu'elle couvre. Le paiement attend que **tous** les BC soient signés et facturés, puis porte sur la somme des factures.

### Fichiers clés

- `src/lib/bons-de-commande/copie-signee.ts` : les règles pures, testées dans `copie-signee.test.ts`.
- `src/lib/bons-de-commande/signature-luna.ts`, `src/lib/ad-pro/facture-poste-lecture.ts`.
- `src/lib/actions/bc-signature-actions.ts`, `src/lib/actions/ad-pro-item-actions.ts` : `modifierBcDuPoste`, `deposerFacturePoste`, `payerLesFacturesDuPoste`.
- `src/components/ad-pro/devis-bc-poste.tsx` (`PieceDuBC`) et `src/components/ad-pro/facture-paiement-bc.tsx`.
- `src/components/legal/reviser-piece.tsx` : l'éditeur commun à Legal et Ad&Pro.
- Migration : `prisma/migrations/20270114150000_bc_signe_par_copie`.
