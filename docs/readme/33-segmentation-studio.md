## Segmentation Studio (module `SEGMENTATION`, `/segmentation`)

La segmentation de la force de vente, native et reliée (Direction, 06/10/2026). Elle remplace le classeur « Segmentation Finale ».

### Refonte du 07/10 — la segmentation par BU, par secteur, et la lettre partout

- **Écran** (`src/app/(app)/segmentation/page.tsx`, une BU choisie, filtre par spécialité ; `?vue=`) : **Synthèse**
  (`synthese-vue.tsx`, calculs purs `lib/segmentation/charge.ts`) — par **secteur de la BU** : matrice **H · A · B · C · D ·
  NA × In / Out** (inconnu compté Out, NC exclu), contacts nécessaires par cycle (nombre × fréquence), **charge face à la
  capacité** des KAM du secteur (contacts/jour × jours du cycle × nombre de KAM) ; **Praticiens** (`praticiens-table.tsx`)
  — les colonnes du fichier de la Direction, **Q1 (potentiel) / Q2 (affinité) / statut saisis en ligne**, lettre
  provisoire recalculée à l'écran le temps que le serveur rende la sienne ; **Règles** (`regles-vue.tsx`) — versionnées
  et publiées. Vues secondaires : cycles, import, avancé, historique. Export : `/api/segmentation/export`.
- **La lettre** (`lib/segmentation/regles.ts`) : **H** (décideur), **A–D**, **NA** (une réponse manque — jamais D,
  même un « 0 patient » sans la seconde réponse), **NC** (non ciblé). Valeurs proposées tant qu'une BU n'a rien publié
  (`PROPOSITION`, `charge.ts`) : seuil de potentiel **22 patients/semaine**, affinité **> 10 %** (repère « moyenne
  nationale 2026 : 7,21 % », qui ne classe personne), grille H 2/2, A & B 2/2, C & D 1/1 (In/Out), capacité 7 contacts/jour
  × 20 jours — elles ne s'appliquent qu'une fois **publiées** par une personne.
- **Grille de fréquences par lettre** (`grille`, `cleFrequence`) : **H réglable à part**, A & B, C & D × In/Out ; NA et NC
  : aucune visite requise. **Exceptions par secteur** (seuils et fréquences, `secteurId` ; les règles d'avant gardent
  leur zone libre comparée au nom).
- **Secteur d'un praticien** (`lib/segmentation/secteurs.ts`, pur) : l'établissement entier ou le service choisi d'un
  secteur actif de la BU, à défaut le secteur de son KAM de rattachement ; jamais deviné. Il peut être **posé à la
  main** : `SegmentationFiche.secteurId` (FK `SalesSector`, `ON DELETE SET NULL`, migration
  `20270115120000_segmentation_secteurs`) — action `changerSecteur`.
- **Forcer une lettre** (`forcerLettre`, motif obligatoire ; `rendreLettreCalculee` pour revenir au calcul) : réservé au
  droit **`SEGMENTATION_POTENTIEL`** (module `rbac.ts`, libellé « Segmentation — potentiel forcé à la main »), qu'**aucun
  rôle n'a par défaut** : le Super Admin l'accorde personne par personne (case « Modifier ») ; qui l'a peut **tout** dans
  la segmentation, sur toutes les lignes (`lib/segmentation/droits.ts`, `peutForcerPotentiel`).
- **La lettre partout** (`lib/segmentation/lettre-requise.ts`, pur ; côté base `lettres-service.ts`) : pour chaque
  praticien, sa lettre et ses visites requises, stratégie de la BU qui regarde d'abord. C'est le **SEUL « requis »** :
  Force de vente (pilotage, territoires), Marketing cockpit, Ma journée, plan de tournée et son PDF le lisent ici. Repli :
  un praticien rangé dans aucune stratégie publiée garde l'ancien palier de potentiel (`MedicalDoctor.potential` ×
  `SfeSettings.frequencyByTier`), et l'écran dit d'où vient le chiffre.

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

Gestes (07/10, `lib/segmentation/droits.ts`, une lecture pour l'écran et les actions) : **Voir** = panel, synthèse,
règles ; **Modifier** = Q1, Q2, statut (le terrain) ; **Créer** = ajouter / retirer un praticien du panel ; **Valider** =
règles, fréquences, publication, import, stratégie, secteur d'une fiche ; **forcer une lettre** = `SEGMENTATION_POTENTIEL`
(Super Admin, personne par personne).

| Rôle | Gestes |
|---|---|
| Direction, DG, directeur des opérations | Tout, dont la publication des règles et l'import. |
| Direction de la promotion | Lecture, renseignement du terrain, panel (les lettres forcées exigent `SEGMENTATION_POTENTIEL`). |
| Head of Sales, chef de produit | Lecture. |
| KAM (`MEDICAL_DELEGATE`) | Lecture et mise à jour du potentiel et du statut, **sur son seul panel** (`clausePanelDuKam`). |

### Ciblage par spécialité (migration `20270114100000_produit_specialites_cibles`)

- `PromoProductSpecialite` porte, sur le `PromoProduct` (le produit × BU qui existait déjà), les spécialités que le produit vise. Ce sont toujours des spécialités de sa BU ; vide = toutes.
- Le moteur classe « non ciblé » un praticien d'une spécialité non visée, et le pourquoi le dit. Une spécialité inconnue donne « en attente ».
- Une BU mono-spécialité n'a rien à régler.
- Retirer une spécialité d'une BU la retire de ses produits. Une fusion de spécialités fait suivre les produits.
- Le Studio et le cockpit BU se filtrent par spécialité.

### Cycles (migration `20270114120000_segmentation_cycles`, `cycle.ts`, `cycle-service.ts`)

- **Durée réglable** : mois, 4 ou 6 semaines, trimestre ou personnalisée.
- **Ouverture** : elle fige la version des règles, les produits classés, le contexte (spécialités, affinités), le résultat de chaque praticien et le KAM qui le couvre. `SegmentationCycle` ne réutilise pas `PromoCycle`, qui est un mois calendaire unique pour toute la force de vente ; il pointe vers lui quand il existe.
- **Visites réalisées** : ce sont les visites terminées de la Promotion médicale dans la fenêtre du cycle, jamais ressaisies. La clôture les fige.
- **Capacité KAM** :
  - jours ouvrés (vendredi et samedi chômés) × part terrain × visites par jour ;
  - la surcharge du KAM l'emporte, sinon le réglage SFE s'applique ;
  - les congés approuvés (RH) sont déduits, et le calcul est expliqué.
- **In / Out** : « In » = le praticien est dans la wilaya pivot d'un KAM qui le couvre (la ville pivot de son territoire propre), « Out » = dans une autre wilaya. Les fréquences particulières par zone et In/Out (exceptionsFrequence) sont lues dans la feuille des KAM à l'import (ex. Ouest In → 3 visites pour P1 et H) et se règlent dans l'onglet Règles.
- **Avancement par KAM** : requis, réalisé, restant, capacité, utilisation, H sous-visités, P1. Le KAM ne voit que son panel.

### Consumption Intelligence (module `CONSUMPTION`, `/consommation`, migration `20270114110000_consumption_intelligence`)

- **Lecture (`consommation/lecture.ts`, pur)** :
  - l'en-tête est trouvé même s'il n'est pas sur la première ligne ;
  - les colonnes sont reconnues avec une confiance et une origine (synonyme, ressemblance, mémoire) ;
  - le format large (une colonne par mois) est déplié ;
  - les périodes sont lues dans une colonne, le titre ou le nom de la feuille ;
  - les unités sont normalisées : une boîte devient des unités seulement si la présentation dit combien ;
  - les lignes de total sont écartées.
- **Résolution (`resolution.ts`, pur)** :
  - un établissement ou un produit n'est retenu que s'il est sûr : mémoire, nom exact, alias ou identité ;
  - un rapprochement partiel est proposé, jamais appliqué ;
  - un produit inconnu passe « à revoir » ;
  - une molécule concurrente hors référentiel compte pour le marché.
- **Doublons** : fichier déjà importé (empreinte), ligne identique déjà comptée, période qui en chevauche une autre. Rien n'est jamais additionné en silence.
- **Revue** : une décision par valeur brute, appliquée à toutes ses lignes et mémorisée (`ConsommationMemoire`). Seules les lignes OK d'un import **validé** comptent. Le fichier original est gardé (`fichier`).
- **Affinité (`affinite.ts`)** :
  - consommation du produit ÷ consommation d'un panier explicite (produits et molécules), sur une fenêtre configurée (`AffiniteConfig`), calée sur la dernière donnée ;
  - seules les quantités de même unité sont comparées.
- **Affinité d'hôpital et médecin** : c'est une affinité d'hôpital. La passer au médecin est une option **explicite** de la règle de segmentation (`sourceAffinite` : déclarée, proxy établissement, ou déclarée sinon proxy), et le pourquoi la nomme.
- **Impact avant validation** : la revue d'un import montre son impact sur la segmentation avant qu'il soit validé.

### Coûts par produit (migration `20270114130000_cout_repartition_bu`, `finance/attribution-produit.ts`)

- **Direct** : un poste Ad&Pro accordé imputé à ce seul produit.
- **Alloué** : la part d'un poste partagé, ou d'un coût de BU imputé à aucun produit, selon la règle de l'année (`CoutRepartitionBu`, somme ≤ 100 %).
- **Non alloué (BU)** : le reste, affiché à part.
- La répartition est un geste des Finances (`FINANCES` « Valider »).

### Vues 360° et cockpit

- **Produits 360** (`/produits`, `/produits/[id]`) : depuis le 07/10, LE catalogue unique (`queries/produits-360.ts`, calculs purs `products/fiche-360.ts`) — la segmentation y vit dans l'onglet « Terrain & marketing ».
- **BU** (`/business-units/[id]`) : cockpit filtrable par spécialité.
- **Praticien** (`/praticiens/[id]`) : la carte simple du KAM (priorité, segments, visites requises et faites, objectif principal), le pourquoi, le potentiel historisé et les visites ; depuis le 07/10, le bloc **Force de vente** (lettre et statut par stratégie, délégué, dernière visite, messages reçus, Ad & Pro 12 mois — `chargerFdvDuPraticien`, `queries/force-de-vente.ts`). Chaque ligne de l'annuaire médical (`/medical/annuaire`, `annuaire-grid.tsx`) y mène.
- **Droits** : chaque section n'apparaît qu'à qui voit son module (`vues-360-acces.ts`).

### Saisie terrain et recherche

- **Rapport de visite** (« Ma journée ») : quand le praticien est dans le panel d'une stratégie de la BU du KAM, le rapport propose le potentiel en option, avec la dernière valeur et sa date. La valeur saisie s'historise (HcpObservation, source TERRAIN). Rien de ce que la visite connaît n'est redemandé : ni le praticien, ni l'établissement, ni la BU, ni le territoire.
- **Recherche globale** (palette ⌘K, /search) : elle retrouve aussi les produits canoniques (vers leur vue 360°), les BU (vers leur cockpit) et les stratégies de segmentation. Un praticien ouvre sa vue 360°.

### Pas encore fait

- Questions en langage naturel sur ces données : Adam est en pause de développement.
