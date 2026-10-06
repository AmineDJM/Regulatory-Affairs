## Segmentation Studio (module `SEGMENTATION`, `/segmentation`)

La segmentation de la force de vente, native et reliée (Direction, 06/10/2026). Elle remplace le classeur « Segmentation Finale ».

### Objets (migration `20270114090000_segmentation_studio`, additive)

| Table | Rôle |
|---|---|
| `SegmentationStrategie` | Une stratégie par Business Unit (`BusinessUnit`, RESTRICT). |
| `SegmentationStrategieProduit` | Jusqu'à 3 produits **canoniques** (`Product`) classés, sur une période (`depuis`/`jusqua`). L'historique du classement est conservé. |
| `SegmentationRegle` | Les versions de règles, **immuables**. Le contenu est un JSON validé par `lireRegles`. |
| `SegmentationFiche` | La place d'un praticien de l'annuaire (`MedicalDoctor`) dans la stratégie : statut stratégique (Décideur, Influenceur, Référent, Prescripteur) et zone. |
| `HcpObservation` | Le potentiel terrain **historisé** (patients/semaine, « sur 10, sous le produit »). Chaque observation garde sa source (import/terrain/saisie), son auteur et son lot avec la ligne d'origine. |
| `SegmentationDerogation` | Une dérogation de ciblage ou de segment. Elle garde la valeur calculée au moment de la décision, la valeur posée, le motif, l'auteur, l'échéance et la date de levée. |
| `SegmentationImport` | Un classeur importé. L'empreinte sha256 est unique par stratégie, et le rapport complet est conservé. |

### Règles du moteur (`src/lib/segmentation/moteur.ts`, pur, sans IA)

- **Segment par produit**, jamais un « A » global :
  - A : haut potentiel et haute affinité ;
  - B : haut potentiel et faible affinité ;
  - C : faible potentiel et haute affinité ;
  - D : faible potentiel et faible affinité.
- **Seuils** : ils viennent de la version de règles, avec des exceptions possibles par zone. Rien n'est codé en dur.
- **Donnée manquante** : le praticien est **En attente**, jamais classé D. Un potentiel déclaré à 0 le rend non ciblé (option de la règle).
- **H** (décideur) est un statut séparé qui a sa propre fréquence de visite. Ses segments restent visibles.
- **Priorité BU** :
  - les règles explicites sont lues dans l'ordre (« au moins N en A », « exactement A+B+B », « produit #1 en … ») ;
  - un score pondéré de repli, facultatif, ne sert qu'aux combinaisons non couvertes.
- **Visites par cycle** : elles dépendent de la priorité, et un décideur H reçoit la fréquence H.
- **Pourquoi** : chaque résultat porte son explication.
- **Impact** : `impactDesRegles` montre qui change, et de quoi à quoi, avant toute publication.

### Import d'un classeur (`lecture-classeur.ts`, `rapprochement.ts`, `service.ts`)

- **Colonnes reconnues** :
  - par synonymes (Région/Zone, CDR/Établissement/Hôpital…) ;
  - la colonne du classement est reconnue par ses valeurs ;
  - le produit est lu dans la question.
- **Règles proposées en v1, à relire avant publication** :
  - seuils lus dans le texte de la feuille ;
  - méthode d'affinité **déduite** des pourcentages du fichier ;
  - fréquences lues dans la feuille des KAM ;
  - exception de zone **déduite** des classements quand le texte l'annonce sans chiffre.
- **Rapprochement avec l'annuaire**, sans jamais créer de doublon :
  - une fiche existante n'est que **complétée** sur ses champs vides, jamais écrasée ;
  - les homonymes sont départagés par l'établissement, sinon la ligne est laissée « à trancher » ;
  - un doublon interne au fichier est signalé et n'est jamais additionné.
- **« NA » du fichier** : il devient une dérogation de ciblage « non ciblé », tracée et levable.

### Droits (défauts, réglables dans Administration › Accès)

| Rôle | Gestes |
|---|---|
| Direction, DG, directeur des opérations | Tout, dont la publication des règles et l'import. |
| Direction de la promotion | Lecture, renseignement du terrain, dérogations motivées. |
| Head of Sales, chef de produit | Lecture. |
| KAM (`MEDICAL_DELEGATE`) | Lecture et mise à jour du potentiel et du statut, **sur son seul panel** (`clausePanelDuKam`). |

### Pas encore fait (phases suivantes du cahier des charges)

- Cycles avec instantané figé.
- Consumption Intelligence et affinité calculée sur la consommation hospitalière.
- Capacité KAM.
- Liens finance, AO et réglementaire.
- Vues 360°.
