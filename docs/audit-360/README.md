# Audit 360° de la plateforme — 2 octobre 2026

Audit demandé par le dirigeant : se mettre à la place de **chaque** utilisateur (assistante de direction,
affaires réglementaires, marketing, KAM, managers, finances, RH, juridique, Super Admin…), vérifier les
**possibilités de révision** (« ne pas être figé »), l'**extraction** des devis / BC / factures, ce que
les **managers** savent de leurs équipes, et la cohérence du **README**. Adam (en pause) est hors périmètre.

## Méthode — et ce qu'elle a coûté

1. **20 auditeurs** ont lu le code en parallèle, un par métier ou par thème (rapports bruts : `rapports/`).
   Mesuré par le système : **≈ 650 000 à 780 000 jetons par auditeur** (120 à 180 lectures de fichiers
   chacun), soit **≈ 14 millions de jetons**. Sur alerte du dirigeant, ils ont reçu l'ordre d'écrire leur
   rapport immédiatement : les rapports sont donc **abrégés**. Les 24 auditeurs prévus ensuite ont été
   **annulés**.
2. Remplacés par deux outils **déterministes** (zéro modèle dans la boucle) :
   - `scan-code.md` — un scanner du code (routes d'API, fiches de détail, listes sans borne, erreurs
     avalées, messages de refus, chemins et routes du README, menu) ;
   - un **robot navigateur** qui parcourt chaque page du menu de chaque compte (20 métiers), au bureau et
     au téléphone, sur une base de test séparée, et relève erreurs, débordements, codes bruts affichés,
     champs sans libellé, lenteurs (résultats : section 9).
3. Les constats **bloquants les plus graves** ont été **revérifiés à la main** dans le code
   (✔ ci-dessous). Les autres (○) sont prouvés par l'auditeur (chemin:ligne) mais pas encore revérifiés.

Volume brut : **≈ 51 bloquants et ≈ 350 majeurs** déclarés — avec beaucoup de doublons d'un rapport à
l'autre (le plan de tournée revient dans cinq rapports).

## 1. Sécurité et confidentialité — à corriger en premier

**État au 3 octobre** : S1 à S15 corrigés et testés (lot A, `CLAUDE.md` §118.184 — 95 sabotages, 95 chutes) ;
S16 trié : les routes signalées sont gardées par une enveloppe (`handle(`) ou après le chargement — le
scanner doit apprendre à les reconnaître. Reste ouvert : la fiche d'un sponsoring et celles des deux prises
en charge se chargent par leur identifiant seul (relevé de la phase 0).

| # | Constat | Qui est touché | |
|---|---|---|---|
| S1 | Le **plan de tournée d'un collègue** s'ouvre par son lien (`?plan=<id>`), avec son motif de rejet et **tout son panel** (potentiels compris) — aucune garde par ligne (`medical/plan-de-tournee/page.tsx:81-82`, `tour-schedule.ts:288`) | tout porteur de la Promotion médicale | corrigé (lot A) |
| S2 | La **fiche d'un dossier réglementaire** ouverte par son lien ne vérifie ni la **société** ni la **gamme** (`entity-access.ts:556-560` ne compose que `scopeRegulatory`) — un responsable lit **et modifie** un dossier d'une autre société | Regulatory | corrigé (lot A) |
| S3 | **Tout délégué modifie l'événement d'un collègue** (budget, médecins, produits), même d'une autre société et après décision (`queries/events.ts:140`, `event-actions.ts:177-179`) | Événements | corrigé (lot A) |
| S4 | **Toutes les demandes de formation** de la société (montants, pièces) visibles de tout salarié (`formations/page.tsx:26-43`) | RH | corrigé (lot A) |
| S5 | **Salaires, nets, NIN** visibles des rôles RH en simple **lecture** (Directeur des Opérations, Finances) ; documents RH téléchargeables avec la seule lecture (`rh/page.tsx:115-157`, `api/rh/document/[id]/route.ts:24`) | RH | corrigé (lot A) |
| S6 | Les **listes RH ignorent la société** (demandes, congés — maladie comprise —, avances, intérims) ; la fiche salarié se lit sans portée (`queries/hr.ts:115-130`) | RH | corrigé (lot A) |
| S7 | **Renouveler un contrat restreint** crée une suite **visible de tout le module** (lecteurs désignés non recopiés, `legal-actions.ts:490-507`) ; les **rappels d'échéance** envoient titre et référence de pièces restreintes ou d'autres sociétés à tous les rôles Legal (`expiry-sweep.ts:45-63`) | Juridique | corrigé (lot A) |
| S8 | **« Vue exacte »** : le bandeau promet « vos actions seront enregistrées à votre nom », mais le Super Admin agit **au nom de la personne visualisée** et le journal d'audit la désigne comme auteur (`session.ts:53-75`, `impersonation-banner.tsx:9`) | Super Admin | corrigé (lot A) |
| S9 | Un compte à qui l'on **délègue l'Administration peut nommer n'importe qui Super Admin**, lui compris (`access-actions.ts:246`) | Administration | corrigé (lot A) |
| S10 | Une **demande Ad & Pro d'un autre** se modifie par son identifiant, sans portée (`ad-pro-edit-actions.ts:35-77`) | Ad & Pro | corrigé (lot A) |
| S11 | Fiche **marché PCH**, export et pièces sans contrôle d'**entité** ; le rappel de dépôt part aux rôles PCH de toutes les sociétés (`pch/[id]/page.tsx:43-45`, `api/pch/export/route.ts:24`) | PCH | corrigé (lot A) |
| S12 | **Commentaires** d'une demande au secrétariat possibles par tout compte qui a l'identifiant (`admin-request-actions.ts:390-404`) ; **pièces d'une déclaration d'information médicale** téléchargeables par tout porteur du module (`entity-access.ts:553,682`) | Secrétariat, Info médicale | corrigé (lot A) |
| S13 | **Désactiver un salarié ne coupe pas son compte** (`hr-actions.ts:265-286`) | RH | corrigé (lot A) |
| S14 | Le **pilotage** montre le **chiffre d'affaires de toute la société** à des rôles sans le module Ventes (`planning/pilotage/page.tsx:55-58`) | KAM, NS, managers | corrigé (lot A) |
| S15 | Retirer ou déplacer un KAM **ne le sort pas de ses secteurs** : il garde l'accès aux médecins de son ancien territoire (`sales-planning-actions.ts:452-483`, `rbac.ts:1364-1372`) | Force de vente | corrigé (lot A) |
| S16 | Le scanner trouve **17 routes d'API** qui lisent un identifiant sans garde par enregistrement visible et **19 sans authentification visible** (dont l'API v1 et des webhooks, à revoir une par une — `scan-code.md`) | — | trié : faux positifs du scanner |

## 2. Impasses : un geste attendu que personne ne peut faire

**État au 3 octobre** : I1 à I3 corrigés avec le lot A ; I4 à I18 corrigés et testés (lot B, `CLAUDE.md` §118.185). Reste ouvert : la file des approbations du secrétariat n'est pas cloisonnée par société pour qui valide le module ; l'écran Validations ne liste pas encore les arbitrages Ad & Pro (Mon espace oui) ; les notifications de l'étape Direction Marketing partent à tout le rôle, sans filtre de gamme ; la file des congés à signer lit les 200 congés en attente de toute la base avant de filtrer ; les étapes adressées à un rôle ne se délèguent pas par l'intérim (décision).

| # | Constat | |
|---|---|---|
| I1 | **Plan de tournée escaladé** : le N+2 le voit « à décider » mais **n'a aucun bouton** s'il n'a pas la vue globale (`plan-de-tournee/page.tsx:130-134`) — le plan reste bloqué | corrigé (lot A, avec S1) |
| I2 | Le **circuit du plan de tournée n'envoie AUCUNE notification** (soumission, escalade, validation, **rejet** dont les 48 h courent) (`tour-plan-actions.ts` : 0 notification) | corrigé (lot A, avec S1) |
| I3 | Le **réviseur valide un plan sans voir les visites** (la grille jour × médecin n'est rendue qu'au KAM) (`planificateur.tsx:191-225`) | corrigé (lot A, avec S1) |
| I4 | Le **KAM ne peut pas créer de sponsoring** (le rôle n'a pas le module), alors que la décision du 28/09 fait passer « le sponsoring d'un KAM » par le National Sales (`rbac.ts:284`) | corrigé (lot B) |
| I5 | **KAM et National Sales n'ont pas le module Stocks**, alors que l'écran des stocks hospitaliers est conçu pour eux (`rbac.ts:284,305`) | corrigé (lot B) |
| I6 | **« Facture obligatoire »** ne voit que les fichiers joints à l'ordre ou à la fiche source — pas les **factures rangées dans Legal** ni sur les postes : les ordres des postes / congrès / sponsorings peuvent devenir **impayables** (`expense-actions.ts:72-84`) | corrigé (lot B) |
| I7 | **Ordre fantôme** : retirer ou refuser une demande de paiement, ou annuler une facture Legal, laisse l'ordre de dépense **ouvert et payable** au centre de paiement (`payment-request-actions.ts:270-282, 735-760`) | corrigé (lot B) |
| I8 | **Facture refusée au centre** : bloquée pour toujours (« déjà partie au règlement ») (`settlement.ts:236`, `authorization.ts:182`) | corrigé (lot B) |
| I9 | **Information médicale** : un dossier sur lequel un validateur clique « Modification » ne peut plus jamais être resoumis ; les **Finances** notifiées « quittance à remettre » tombent sur une **page introuvable** (`declare-decision.ts:87-90`, `queries/medical-info.ts:52-58`) | corrigé (lot B) |
| I10 | **Assistante de direction** : la notification « Bon de commande à établir » mène à une page qu'elle ne peut pas ouvrir ; le **passeport** annoncé dans le sujet de réservation lui est **refusé** ; son bureau ne charge que **200 demandes** ; les nouvelles demandes sans responsable **ne lui sont pas signalées** | corrigé (lot B) |
| I11 | **Direction Marketing** : ne peut pas ouvrir les **messages pré-définis** qu'elle doit écrire ; ses **arbitrages** (événements, consulting, autres, matériel) n'apparaissent ni dans Mon espace ni dans les validations ; ne peut ouvrir ni devis, ni BC, ni factures des demandes qu'elle arbitre | corrigé (lot B) |
| I12 | **Formations** : le N+1 « responsable de département » n'a jamais le bouton de décision ; l'étape « DG » est fermée au DG lui-même | corrigé (lot B) |
| I13 | **Mon Équipe** : « Traiter » un congé mène à une page RH refusée ; « Traiter » un achat déjà passé aux Finances donne une 404 | corrigé (lot B) |
| I14 | **Demande d'achat** : ses **lignes n'apparaissent nulle part** (ni pour le N+1 qui valide, ni pour l'assistante qui achète) (`demandes/[id]/page.tsx:105-107`) | corrigé (lot B) |
| I15 | **Regulatory** : chaque modification de la fiche **efface la « Date cible de dépôt »** (le formulaire n'a pas le champ, l'action écrit `null`) (`regulatory-actions.ts:513`, `edit-product.tsx:157`) | corrigé (lot B) |
| I16 | **Revue mensuelle SFE** renvoyée **chaque minute** toute la journée du 1er (`sfe-sweep.ts:148,178`) | corrigé (lot B) |
| I17 | **PCH** : le produit canonique d'un lot n'est jamais renseigné → la réserve « un produit, un AO » ne s'affiche jamais ; **supprimer un AO** efface en cascade lots, BC, livraisons, **sans corbeille** | corrigé (lot B) |
| I18 | **Délégation (intérim)** : le panneau promet de « trancher les validations qui vous sont adressées », mais l'intérimaire n'est reconnu que sur les validations génériques — congés, formations, achats, plans de tournée restent bloqués | corrigé (lot B) |

## 3. Révisions — « ne pas être figé »

**État au 3 octobre** : dans le moteur des circuits Ad & Pro (sponsoring, congrès, événements), le renvoi pour
correction, la resoumission, le motif lisible du demandeur, l'appel à l'étape qui a tranché, l'événement refusé
qui repart, la modification après avis et le retrait d'une demande sont livrés et testés (lot C1, `CLAUDE.md`
§118.186) — avec, trouvé en chemin, « un geste à la fois » : deux accords simultanés n'émettent plus deux ordres
de dépense. **Les postes et leurs BC, et les demandes au secrétariat, sont livrés et testés (lot C2, §118.187)** :
le visa d'un BC rouvert quand le montant monte ou que le prestataire change, la demande de BC modifiable et
retirable, un ordre émis annulé puis réémis, une décision revue, un poste retiré qui revient avec tout ce qui en
dépendait, une demande au secrétariat qu'on corrige ou qu'on annule au-delà de trente minutes. Restent : les
centres Ad & Pro, de paiement et de validations (C3), et les autres circuits — matériel promotionnel, consulting,
autre demande, demande de paiement, recrutement, plan de tournée validé, pièce Legal révisée (C4).

Constat d'ensemble (rapports 17, 18, 01, 03, 14) : **la plateforme sait refuser, rarement faire corriger.**

- **Aucun « renvoyer pour correction »** au niveau d'une demande Ad & Pro : le refus final est définitif, le
  circuit clos refuse toute action (`engine.ts:494, 581-588`) ; des tests figent ce comportement.
- Un **événement refusé ou annulé ne peut jamais être resoumis** (`event-actions.ts:263`).
- Le **demandeur ne voit pas le motif** du refus (historique réservé aux profils privilégiés, notification
  sans motif).
- **Matériel promotionnel** : tout refus est terminal ; on ne demande les devis **qu'une seule fois** ; les
  articles sont figés ensuite.
- **BC d'un poste** : la demande de BC ne se modifie ni ne se retire ; le **visa du centre reste valable**
  après révision du montant ou du fournisseur ; pas de réémission.
- **Centre Ad & Pro** et **centre de paiement** : seulement « valider » ou « refuser définitivement » —
  l'écran du centre de paiement promet une « révision » que l'action refuse.
- **Centre de validations** : « Modification demandée » **clôt** la demande sans resoumission possible.
- **Demande au secrétariat** (devis, facture) figée passé 30 minutes ; **consulting** et **autre demande**
  jamais modifiables.
- **Pièce uploadée par erreur** : pas de remplacement versionné sur la plupart des fiches.

**Règle proposée, commune à tous les circuits** : à chaque étape, trois issues — *valider*, *renvoyer pour
correction* (avec motif, visible du demandeur, qui corrige et **resoumet** autant de fois que nécessaire —
le circuit reprend à l'étape qui a renvoyé), *refuser* (définitif, avec motif). Une pièce (devis, BC,
facture) se **remplace** en gardant l'ancienne version ; un devis ou un BC se **redemande** ; un changement
de montant ou de fournisseur **rouvre** les validations qui portaient sur l'ancien.

## 4. Extraction des devis, BC et factures (rapport 19)

- **Aucun des 12 points d'upload n'extrait les données** : le fichier est stocké, les montants sont
  **retapés** (l'assistante recopie les devis du matériel promotionnel à la main ; une facture classée
  depuis /pieces entre dans Legal **sans montant**).
- Les briques existent : lecture texte → OCR avec confiance (`extract/texte-ou-ocr.ts`), appel de modèle à
  **schéma JSON imposé** (`gateway.ts`), format de pièce commerciale avec calcul des totaux
  (`commercial.ts`), contrôle à 1 DZD et rapprochement facture ↔ BC ligne à ligne (matériel promotionnel).
- **Architecture retenue** : une « pièce extraite » au format de la plateforme (fournisseur, références,
  lignes : désignation, quantité, unité, prix unitaire, taxe, total ; totaux imprimés) ; extraction à
  l'upload, en tâche de fond (texte natif → OCR → structuration) ; **le code recalcule les totaux** et les
  compare aux totaux imprimés (à 1 DZD) ; fournisseur retrouvé par NIF/RC ; **une personne valide** avant
  tout usage (le contenu d'un document est une donnée, jamais une instruction) ; ensuite **BC pré-rempli
  depuis le devis retenu** et **rapprochement facture ↔ BC**.
- À corriger avant : la règle de doublon des factures compare le seul numéro, sans le fournisseur ; le
  contrôle à 1 DZD saute si le total imprimé n'est pas saisi ; plafond « factures ≤ BC » absent hors
  matériel promotionnel.

## 5. Managers (rapport 16, et 04, 06, 07, 08)

- 12 rôles sur 19 n'ont **aucun indicateur métier** ; les chiffres affichés ne mènent nulle part.
- Un manager **ne voit ni ne réassigne** une tâche d'un membre de son équipe.
- Pas d'endroit unique pour décider : formations, plans de tournée, recrutement absents de Mon espace ;
  le DG voit dans Mon espace ce qui n'est pas à lui et rate ses propres étapes.
- Cockpit SFE : « Réalisation » calculée avec un autre dénominateur que les lignes (peut dépasser 100 %),
  couverture qui compte des praticiens hors panel, mois passés recalculés avec le panel du jour.
- Le Directeur des Opérations ne voit que son propre périmètre au cockpit et ne reçoit aucune alerte SFE.

## 6. README (rapport 20 + scanner)

13 écarts majeurs : modules retirés présentés comme actifs (Ventes, Logistique, Business Development) ;
pages supprimées encore décrites (Courrier, Dashboard) ; décideur Ad & Pro (la Direction Marketing, pas
la Direction) ; paie (le « transfert au budget » n'existe plus) ; centre de paiement ; **8 entrées de menu
absentes** dont le Centre de validations ; `/admin/departments` (404 — le vrai écran est
`/rh/departements`) ; l'onboarding montre Adam et la boîte Infomaniak. Le scanner ajoute 4 chemins de
fichiers et 4 routes cités qui n'existent pas.

## 7. Autres constats transverses du scanner (`scan-code.md`)

- **441 listes sans borne** (`findMany` sans `take`) dans 152 fichiers — et plusieurs listes **bornées sans
  le dire** (bureau du secrétariat à 200, centre de paiement à 300 tous statuts confondus, stocks à 5 000
  triés du plus ancien) : les éléments les plus récents ou les plus anciens disparaissent sans signal.
- **93 erreurs avalées** dans les actions serveur (certaines légitimes, à trier).
- **96 messages de refus** courts ou génériques (« Introuvable. ») ; 113 endroits qui affichent peut-être
  un **code brut** (`{x.status}`) au lieu d'un libellé.
- **66 sections** sans écran d'erreur ni de chargement propres.

## 8. Ce qui marche bien (cité par plusieurs auditeurs)

Les circuits sont décrits avec précision et leurs règles tiennent dans le code ; les gardes d'écriture
critiques (centre de paiement, signatures, portes de ligne des postes) sont testées et sabotées ; les
refus nomment souvent le remède ; les écrans récents (postes Ad & Pro, stock promotionnel, finances)
suivent un design cohérent ; le menu n'a **aucune entrée cassée** (87 adresses, 0 sans page).

## 9. Robot navigateur

Premier passage terminé le 2 octobre (avant le lot A) : 20 comptes, 365 pages au bureau et 160 au
téléphone. Ses résultats sont relus au ré-audit qui suit les corrections, sur le code corrigé.

## 10. Plan de correction proposé

1. **Lot A — sécurité** (S1 à S16) : gardes par ligne, entité, confidentialité. Petits correctifs, testés.
2. **Lot B — impasses** (I1 à I18) : boutons manquants, notifications, droits manquants, liens morts.
3. **Lot C — révisions** : la règle « valider / renvoyer pour correction / refuser » dans le moteur de
   circuits, resoumission, motif visible, remplacement de pièces, redemande de devis et de BC.
4. **Lot D — extraction des pièces** : pièce extraite, contrôle arithmétique, validation humaine, BC
   pré-rempli, rapprochement facture ↔ BC.
5. **Lot E — managers** : un endroit pour décider, vue d'équipe actionnable, délégation réelle.
6. **Lot F — README** remis d'aplomb.
