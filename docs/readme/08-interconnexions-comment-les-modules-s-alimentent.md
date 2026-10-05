## 🔗 Interconnexions — comment les modules s'alimentent

Le cœur de l'OS, ce sont les **liens** entre modules. Un même fait métier traverse la plateforme sans jamais être
ressaisi :

```
QUI demande décide PAR OÙ ça passe — cinq parcours (workflow/parcours.ts), et l'étape qui TRANCHE décide :

  KAM / délégué          ─▶ National Sales ─▶ [DG] ─▶ (sponsoring : Direction des opérations) ─▶ Direction Marketing ⟵ TRANCHE
  National Sales         ─▶ [DG] ─▶ Direction des opérations ─▶ Direction Marketing ⟵ TRANCHE
  tout autre demandeur   ─▶ [DG] ─▶ Direction Marketing ⟵ TRANCHE
  Direction Marketing,   ─▶ [DG] ─▶ Direction des opérations ⟵ TRANCHE   (on n'arbitre pas sa propre demande)
  Manager Promo médicale
  Direction, DG, Directeur des Opérations, Super Admin
                         ─▶ Direction Marketing ⟵ TRANCHE   (directement : personne au-dessus d'eux, pas de porte du DG)

  [DG] = la porte du DG, franchie seule (et tracée) sous le seuil réglé. À chaque étape : approuver, refuser,
  ou RENVOYER au demandeur pour correction (motif exigé) ; resoumise, la demande revient à cette étape.

L'étape qui tranche porte le BUDGET ACCORDÉ et la SOUS-CATÉGORIE budgétaire (pour un sponsoring, elle pré-valide la
TENUE : l'argent se fixe poste par poste, puis à la clôture) — quand la route s'arrête avant Direction Marketing
(rang 2), l'étape qui conclut HÉRITE ces pouvoirs des étapes non atteintes (argentEffectif) —, puis :
   └─▶ décision définitive (budget accordé visible du demandeur)
        ├─▶ Information médicale : le PRIM déclare aux autorités (si applicable)
        │        └─▶ exige des pièces → déposées par Direction / comptable / délégué
        └─▶ ORDRE DE DÉPENSE émis — un par poste quand l'opération en porte —, EN ATTENTE du centre de paiement
             └─▶ le centre l'AUTORISE (quel que soit le montant), puis Finances : le comptable RÈGLE (facture obligatoire)
                  ├─▶ FinanceTransaction (sortie) → met à jour la TRÉSORERIE
                  └─▶ attribution AUTOMATIQUE à la CATÉGORIE budgétaire du module
                       └─▶ consommation de l'ENVELOPPE recalculée (barres de santé)
```

Autres connexions notables :

- **Regulatory → Finances** : une **Demande de BV** émet un ordre de dépense avec échéance.
- **Regulatory → Stocks** : les **états de stock** (relevés datés « à cette date, il reste X ») et les sorties de livraison PCH sont liés aux **produits Regulatory**.
- **Bureau du secrétariat → Finances** : une demande d'achat déclenche une **validation Finances** (devis → facture).
- **Tâches / Messages → Sujets** : un message peut devenir une **tâche demandée** ; une tâche peut ouvrir un sujet.
- **Tierce personne → Sujets** : impliquer quelqu'un sur un événement **crée automatiquement un sujet** (sans budget).
- **Tous les modules → Validations** : chaque circuit d'approbation remonte dans le **bureau de validation central**.
- **RH (Paie) → centre de paiement → Finances** : la paie d'un mois part **au centre de paiement**, un envoi par entité avec la **somme des salaires à virer** (déclarée, jamais pré-remplie) ; autorisée, les Finances virent — **une seule écriture SALAIRE**, de la somme déclarée (le « transfert au budget », qui écrivait une sortie par employé, n'existe plus) ; la fiche de paie part dans le **dossier RH** de l'employé ; l'employé est notifié **au plus tôt 24 h** après la saisie, et seulement une fois le **virement réglé**.
- **Notes de frais : RH ⇄ Bureau du secrétariat** : le traitement RH est **verrouillé** tant que le secrétariat n'a pas **accusé réception des originaux** (accusé tracé, visible des deux côtés, notifié).
- **Demandes traitées → Drive (« Dossier traité »)** : demandes RH, demandes administratives (Terminée) et déclarations PRIM sont **auto-archivées** (récapitulatif + copie des pièces) dans la boîte Drive du traitant, reclassable librement.
- **Réunions planifiées → Calendrier** : les réunions apparaissent dans le calendrier (heure d'Alger) avec lien « Rejoindre ».
- **Suppression définitive → Corbeille Super Admin** : instantané restaurable (ligne + pièces + commentaires) au lieu d'une destruction directe.
- **Tous les modules → Adventum Brain** : signaux faibles agrégés en **Risk Cards** et **Knowledge Graph**.

---

