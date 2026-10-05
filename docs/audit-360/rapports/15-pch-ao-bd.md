# Audit 15 — PCH (AO, lots, chiffrage, marchés) et Business Development — version condensée

Lecture seule, chaque constat est prouvé par un `chemin:ligne`. **3 BLOQUANT · 16 MAJEUR · 17 MINEUR · 5 SUGGESTION (41 constats).**
Réponses aux questions de la mission :
- **Suivi d'un AO :** de bout en bout sur le papier, mais la chaîne casse (PCH-01, 05, 06, 07, 11).
- **Chiffrage :** assisté en partie seulement (PCH-17).
- **Révision :** possible par une nouvelle version, mais les lots ne sont pas figés (PCH-09).
- **Cardinalités :** illisibles (PCH-01).
- **Remontée vers la Direction :** faible (PCH-13, PCH-19).

| ID | Sév. | Constat (preuve) | Recommandation |
|---|---|---|---|
| PCH-01 | BLOQUANT | Le produit canonique d'un lot (`PchTenderLine.productId`) n'est jamais renseigné, ni par l'écran ni par l'IA (`pch-tender-line-actions.ts:34,47-80,243,403-424`). Seul un test l'injecte (`pch-market-chain.test.ts:77`). Conséquences : la réserve « un produit, un AO » ne s'affiche jamais (`pch/[id]/page.tsx:65-67`) ; le contrat naît sans produit (`pch-market-actions.ts:335`) ; aucun mouvement de stock n'est créé (`:705-708`) ; la carte « Marchés » du produit reste vide ; un produit affecté à une BU ne peut pas être déclaré en visite par un KAM (`sfe/produits-bu.ts:56-58`). | Sélecteur « produit canonique » par lot, proposé par la clé d'identité et confirmé ; rattrapage de l'existant. |
| PCH-02 | BLOQUANT | La fiche, l'export et les pièces d'un marché ne vérifient pas l'entité (`pch/[id]/page.tsx:43-45`, `queries/pch.ts:198-207`, `api/pch/export/route.ts:24`, `entity-access.ts:682-684`). Le rappel de dépôt envoie le titre et le lien de l'AO à tous les rôles PCH de toutes les sociétés (`pch/deadline-sweep.ts:63-66,83-92`). | Appliquer `clauseMarchesPchVisibles` à la fiche, à la lecture 360 et à l'export, avec `notFound()`. Ajouter un cas PCH dans `canAccessEntity`. Filtrer les destinataires par entité. |
| PCH-03 | BLOQUANT | Supprimer un AO est définitif, en cascade (lots, photos de dépôt, soumissions, BC, livraisons), sans corbeille (`pch-actions.ts:160-169`, absent de `admin-delete-registry.ts`). Ouvert à tout MANAGE PCH (`rbac.ts:265,269`). Confirmation incomplète (`pch-detail-client.tsx:91`), audit sans référence (`pch-actions.ts:166`). | Passer par `supprimerReversible` avec aperçu. Refuser s'il existe un contrat, un BC livré ou une facture. Audit nominatif. |
| PCH-04 | MAJEUR | L'écran pose le résultat d'un lot via `updateTenderLine` (`tender-lines.tsx:224,250` → `pch-tender-line-actions.ts:73-76`) : aucun refus si attribué > soumis, aucun audit. La porte gardée `setLineResult` (`pch-market-actions.ts:234-279`) n'a aucun appelant d'écran. | Brancher la grille sur `setLineResult`. |
| PCH-05 | MAJEUR | « Créer le contrat depuis l'attribution » est proposé et accepté même quand un contrat existe (`contract-panel.tsx:67`, `pch-market-actions.ts:287-299`). Les quantités contractuelles s'additionnent (`market-360.ts:295-305`), ce qui neutralise le contrôle de dépassement. | Refuser s'il existe un contrat non annulé, et proposer un avenant. |
| PCH-06 | MAJEUR | Livraisons : pas de champ péremption (`order-execution.tsx:296-301` alors que l'action le lit, `pch-market-actions.ts:697`). Une livraison planifiée ne peut jamais passer « livrée » (pas de modification). Les messages du serveur sont jetés (`order-execution.tsx:43-51`, `pch-market-actions.ts:727-731`). La sortie de stock est écrite dans une table legacy. | Péremption par ligne, bouton « Marquer livrée », affichage de `r.message`. |
| PCH-07 | MAJEUR | Deux modèles de BC coexistent. « Enregistrer la vente » crée un BC legacy sans ligne ni contrôle contractuel (`tender-lines.tsx:338` → `pch-tender-line-actions.ts:304-326`, `schema.prisma:6175`), que la fiche signale ensuite comme manque (`market-360.ts:414-415`). Un BC ne peut plus recevoir son contrat après création (`pch-detail-client.tsx:190`, `pch-actions.ts:221-233`). Trois endroits disent « livré ». | Un seul modèle de BC (lignes reliées au contrat), contrat rattachable après coup, une seule saisie de l'arrivée. |
| PCH-08 | MAJEUR | Le taux de réalisation est divisé par la quantité DEMANDÉE (`queries/pch.ts:119`, `tender-lines.tsx:206,346`), alors que l'écran (`:359`) et le README (l.1010) disent « attribuée ». | Utiliser `unitesAttribuees()`. |
| PCH-09 | MAJEUR | Après dépôt, les lots restent modifiables et supprimables sans audit (`pch-tender-line-actions.ts:39-87,184-192`). « Soumis » est calculé sur les prix vivants (`market-360.ts:385-389`). La photo de dépôt n'est jamais affichée (`:356`) et la V2 l'écrase (`pch-market-actions.ts:190-210`). | Figer les lots déposés ; garder et afficher une photo par version. |
| PCH-10 | MAJEUR | Grille de chiffrage : 16 champs sans libellé visible (`tender-lines.tsx:222-251`). Une sauvegarde au blur est abandonnée si une autre est en cours (`:52-57`). L'état local périmé écrase l'enrichissement (`:148-162,182-193`, `types.ts:10-14`). | Libellés visibles, file de sauvegarde avec indicateur, resynchronisation de l'état. |
| PCH-11 | MAJEUR | L'équipe PCH (Responsable logistique, Responsable ventes, Commercial) n'a ni Legal, ni Finances, ni Courriers (`rbac.ts:265,267,269`). Contrat, facture et relance lui sont impossibles (`pch/[id]/page.tsx:76,92,94`), sans remède nommé. « Rattacher un contrat » demande de coller un identifiant technique (`contract-panel.tsx:236-238`). | Dire qui peut le faire et offrir un bouton « Demander » ; recherche de contrat au lieu d'un identifiant ; décision de droits. |
| PCH-12 | MAJEUR | La facture d'un BC PCH propose par défaut « Reçue — nous payons » (`attach-to-source.tsx:190-196`). L'encaissement s'écrit alors comme une sortie (`finance/settle-invoice.ts:83-90`, `finance/a-imputer.ts:51`). | Forcer le sens « Émise » pour `PCH_ORDER`. |
| PCH-13 | MAJEUR | Liste `/pch` : colonnes héritées vides (Fournisseur, Qté, Valeur, `pch/page.tsx:128-130`). Le KPI « Valeur totale » porte sur un champ retiré de la création (`:100`, `queries/pch.ts:215`). Ni date limite, ni responsable, ni recherche. | Colonnes Date limite, Responsable, Soumis, Attribué ; filtres et recherche. |
| PCH-14 | MAJEUR | L'analyse IA coupe sans le dire : 24 000 caractères, 40 pages, 3 500 jetons (`pch-tender-line-actions.ts:220-221,293`). Une relance crée des doublons (`:243`). Le fichier analysé n'est pas conservé. | Découper le document, annoncer « N lots extraits, pages non lues », dédoublonner. |
| PCH-15 | MAJEUR | « Notre produit · enregistré » s'affiche pour tout dossier non verrouillé rapproché sur les mots DCI et dosage, sans tenir compte de la forme ni du statut (`pch-tender-line-actions.ts:415,474-484`). L'export le reprend. | « Enregistré » seulement si une décision est obtenue ; comparer la forme. |
| PCH-16 | MAJEUR | Porte Legal contradictoire : la réserve exige Legal (`pch-engagements.ts:70-99,146`), mais contrats et factures s'affichent sans ce contrôle (`market-360.ts:129-147,183-190`). `linkContractToTender` rattache n'importe quel document Legal sans droit Legal (`pch-market-actions.ts:355-372`). | Trancher la règle ; exiger la lecture Legal et la nature « contrat » pour rattacher. |
| PCH-17 | MAJEUR | Chiffrage peu assisté : prix de référence figé (réceptions PCH 2025, `market/pch-lookup.ts:1-8`, `src/data/market/meta.json`), aucun historique de nos propres prix, et les rôles PCH n'ont pas l'Explorateur (`rbac.ts:265-269`). | Historique « nos derniers prix », import des référentiels, Explorateur en lecture pour PCH. |
| PCH-19 | MAJEUR | Rien ne remonte vers les managers ni la Direction : aucune entrée PCH dans Mon espace ou Aujourd'hui, aucune notification de résultat, d'affectation ou de caution (cautions visibles seulement dans Brain, `adventum/risks.ts:62-90`). Le rappel de dépôt part à tout le monde (`deadline-sweep.ts:63-66`). | Vue par responsable ; alertes ciblées (caution à J-30, résultat attendu). |
| BD-01 | MAJEUR (décision) | Le rôle Manager BD n'a plus que l'Explorateur. Market Intelligence et les Études sont retirés (`modules-retired.ts:45`, `etudes/page.tsx:18`), et Projets ne lui est pas accordé faute de Regulatory (`rbac.ts:342-344,400-403`). | Ouvrir `BD_PROJECTS` au Manager BD ; statuer sur les Études. |
| PCH-18 | MINEUR | Export : « Remise des offres » reçoit la date d'attribution (`api/pch/export/route.ts:38`), rien n'est à la boîte, le statut sort brut. | Passer la date limite ; ajouter les colonnes à la boîte. |
| PCH-20 | MINEUR | Le jour même du dépôt, l'AO est affiché et notifié « dépassé » (date stockée à minuit UTC, `types.ts:23-28`, `pch/page.tsx:136-162`). | Heure limite, ou comparaison en fin de journée à Alger. |
| PCH-21 | MINEUR | Libellés bruts : niveau de la carte produit (`product-markets.tsx:48` + `market-360.ts:522`), « RENEWED » (`contract-panel.tsx:89`). | Traduire ; utiliser `deriverNiveau`. |
| PCH-22 | MINEUR | « Modifier l'AO » : statut sans effet, BU en double, champs hérités, entité ni affichée ni modifiable (`pch-detail-client.tsx:67-79`, `pch-actions.ts:111-138`). | Nettoyer le formulaire et rendre l'entité modifiable. |
| PCH-23 | MINEUR | Au téléphone : tableaux sans version cartes (`pch-detail-client.tsx:136`, `tender-logistics.tsx:31`, `projets/page.tsx:189`) ; infobulles `title` illisibles au toucher (`tender-lines.tsx:271,317`). | `mobileCards` ; afficher le détail au toucher. |
| PCH-24 | MINEUR | « Responsable » propose tous les comptes actifs, sans vérifier le droit PCH (`pch/page.tsx:33`). | Filtrer sur le droit PCH. |
| PCH-25 | MINEUR | Message codé en dur « ajoutez la clé ANTHROPIC_API_KEY » (`pch-tender-line-actions.ts:270,282`). | Utiliser `cleModeleRequise()`. |
| PCH-26 | MINEUR | Une exigence de checklist ne se retire pas (`pch-market-actions.ts:130-148`) ; bannière « lignes sans dépôt » permanente pendant la préparation (`market-360.ts:411-413`). | Permettre le retrait ; n'afficher la bannière qu'après la date limite. |
| PCH-27 | MINEUR | « Rendre effectif » pose la date du jour, sans choix (`pch-market-actions.ts:422`) ; lignes de contrat non modifiables ; rattachement de contrat non annulable. | Sélecteur de date, édition des lignes, « Détacher ». |
| PCH-28 | MINEUR | Lot infructueux : aucun moyen de relancer ou dupliquer l'AO (rien dans `pch-actions.ts`). | « Relancer » : nouvel AO pré-rempli et lié à l'original. |
| PCH-29 | MINEUR | Affecter un lot à une BU ne prévient personne (`pch-tender-line-actions.ts:114-182`). | Notifier le superviseur de la BU. |
| PCH-30 | MINEUR | Catégories de pièces génériques ; la catégorie « Facture » crée un fichier hors du registre des factures (`pch/[id]/page.tsx:208`). | Catégories propres aux AO. |
| PCH-31 | MINEUR | Écritures non auditées : BC, lignes de BC, lots, checklist (`pch-actions.ts:212-247`, `pch-market-actions.ts:620-633`). Le README annonce « auditées » (l.990). | Ajouter `recordAudit`. |
| PCH-32 | MINEUR | Liens « Ouvrir dans Legal » proposés à des rôles sans Legal (`contract-panel.tsx:91`, `order-execution.tsx:176`). | Masquer, ou proposer un aperçu. |
| BD-02 | MINEUR | BD › Projets : en-têtes « Statut » et « Niveau de process » inversés (`projets/page.tsx:195-196` contre `:215-218`) ; niveau lu sans la variation obtenue, contrairement à Regulatory (`regulatory/[id]/page.tsx:85`). | Corriger les en-têtes ; utiliser `effectiveStage`. |
| BD-03 | MINEUR | Seul le Super Admin crée un projet par défaut (`rbac.ts:400-403`) ; « Porté par » n'est pas modifiable (`bd-project-actions.ts:84-93`). | Accorder la création à la Direction et au Manager BD ; rendre le porteur modifiable. |
| EXP-01 | MINEUR | L'Explorateur n'indique pas le millésime de ses données (`src/data/market/meta.json`) et n'exporte pas la sélection. | Bandeau « Données : … » et export de la sélection. |

**Suggestions :**
- SUG-01 : tableau de bord Marchés pour la Direction (taux de succès, attribué et encaissé, cautions).
- SUG-02 : comparatif de versions V1 / V2.
- SUG-03 : bouton « Partager » sur la fiche marché.
- SUG-04 : écart entre notre prix et la référence, et marge de l'offre entière.
- SUG-05 : import des référentiels marché depuis un écran.

**Ce qui marche bien :**
- cycle de vie dérivé des faits et testé (`pch/market-math.ts:236-262`) ;
- création d'AO réduite à 9 champs, référence corrigeable ;
- soumission verrouillée côté serveur ;
- économie à la boîte ;
- dépassement contractuel chiffré et tracé, avenants en deltas ;
- analyse IA et enrichissement automatique ;
- affectation d'un lot à plusieurs BU ;
- BD › Projets (entité, corbeille, porte Regulatory).

**Lentilles :**
- **A. Tests :**
  - Couvert : règles pures (`market-math`, `box-economics`, `rattachement-produit`, export), intégration (`pch-market-chain`, 9 cas).
  - Limites : ces 9 cas injectent `productId` (l.77) ; `setLineResult` est testé alors que l'écran ne l'appelle pas.
  - Aucun test : grille, suppression d'AO, double contrat, livraison réelle, rappel de dépôt, extraction IA.
  - Navigateur : seulement la liste `/pch` (`e2e/ui-audit.spec.ts:34`).
- **B. Révision :**
  - Gel légitime : la version déposée.
  - Gels par oubli : livraison, contrat d'un BC, entité de l'AO, exigence de checklist.
  - Pas assez figé : les lots déposés.
- **C. Extraction :** seul le cahier des charges est lu, avec des coupes ; contrat, BC PCH, bon de livraison et factures sont ressaisis.
- **D. Managers :** ni vue par responsable, ni retards, ni performance, ni réassignation en masse.
- **E. README :** écarts aux lignes 957, 959, 968, 975, 990, 1006, 1010, 4658, 213-214, 362 et 366 (voir les constats).

## Scénarios navigateur

**1. Cloisonnement entre entités (PCH-02)**
- Gestes : le Super Admin crée un AO dans l'entité B. Un `LOGISTICS_MANAGER` de l'entité A ouvre `/pch/<idB>` et `/api/pch/export?id=<idB>`.
- Attendu : 404 ou refus.
- Constat confirmé si la fiche s'affiche ou si l'Excel se télécharge.

**2. Grille de chiffrage (PCH-04, PCH-10)**
- Départ : un `SALES_USER` sur `/pch/<id>`, lot « Soumissionné » de 1 000.
- Gestes : passer le statut à « Gagné », saisir 5000 dans « Qté attribuée », Tab, recharger. Puis saisir prix et coût à la boîte en moins d'une seconde, Tab, recharger.
- Attendu : 5000 refusé, les deux prix conservés.
- Constat confirmé sinon.

**3. Livraison, contrat, facture (PCH-06, PCH-05, PCH-12)**
- Gestes en `DIRECTION` : chercher la péremption dans une livraison ; créer une livraison planifiée et tenter de la passer livrée ; cliquer deux fois « Créer le contrat ».
- Geste en `FINANCE_BUDGET_MANAGER` : lire le « Sens » par défaut de la facture du BC.
- Attendu : péremption présente, « Marquer livrée » disponible, second contrat refusé, sens « Émise ».
