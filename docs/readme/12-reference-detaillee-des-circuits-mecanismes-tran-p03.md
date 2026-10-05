### Versions TEST → PRODUCTION (drapeaux de nouveautés)

Toute nouveauté arrive **au stade TEST** : invisible de l'entreprise, visible du seul compte en
**mode test**. Le Super Admin la parcourt, puis la **valide en production** d'un clic — ou la
retire. Le retour arrière est immédiat.

- Catalogue : `src/lib/features.ts` — `FEATURES` déclare chaque nouveauté (`key`, `label`,
  `description`). Une clé inconnue de la base est **auto-créée au stade TEST** : rien ne peut
  être livré par accident. En cas d'indisponibilité de la base, le repli est TEST (prudent).
- Modèle : `FeatureFlag { key, stage: TEST | PROD | OFF }` + `User.testMode`.
- Portes : `featureEnabled(key, userId)` (côté serveur, mémoïsé par requête), `isTestUser(userId)`.
- Écran : `/admin/versions` (Super Admin) — trois groupes (**En test** / **En production** /
  **Désactivées**), interrupteur de mode test, bandeau permanent
  (`components/layout/test-mode-banner.tsx`) tant que le mode test est actif.
- **Navigation** : un onglet peut porter `feature` (`NavTab.feature`, `src/lib/labels.ts`) — il
  n'apparaît qu'aux comptes qui voient la nouveauté. Résolu dans `app/(app)/layout.tsx` (menu,
  palette, barre mobile) et par `visibleTabs(user, TABS)` (`src/lib/nav-tabs.ts`) dans les pages.
- Tests : `src/lib/features.test.ts` — TEST invisible du grand public, PROD visible de tous, OFF
  invisible même en mode test, retour arrière.

Nouveautés actuellement au catalogue : `assistant_memory`, `home_today`, `assistant_proactive`,
`mail_smart`.

### Assistant — mémoire personnelle, cloisonnée par construction

L'assistant se souvient de **sa** personne, et d'elle seule. Il connaît son identité, son entité,
son département (fil d'Ariane complet), son **N+1 réel** et une note de mémoire distillée de ses
échanges précédents.

**Le cloisonnement n'est pas une convention, c'est une structure** — `src/lib/assistant-memory.ts`
est la **seule porte d'entrée** vers `AssistantThread`, `AssistantMessage` et `AssistantMemory` ;
aucun autre module n'interroge ces tables :

1. toute fonction exige le `userId` du **demandeur** en premier paramètre ;
2. tout `where` porte ce `userId` — un identifiant de fil deviné ou volé ne donne rien ;
3. `AssistantMessage` porte **lui aussi** le `userId` (redondant avec son fil) : même une erreur
   de jointure ne peut pas exposer le message d'autrui ;
4. le `userId` vient **toujours** de la session serveur, jamais du client ;
5. en **« Vue exacte »** (impersonation), l'assistant est **désactivé** : la mémoire d'une personne
   ne s'ouvre à personne, pas même à un administrateur.

- Distillation : tous les ~12 messages, `maybeDistillMemory` (`lib/actions/assistant-actions.ts`)
  relit les échanges récents de la personne et réécrit sa note durable (appel économique,
  épisodique, silencieux en cas d'échec — la mémoire est un confort, jamais un point de rupture).
- Injection : `personalContext(userId)` est ajouté au prompt système par `runAssistant`
  (`opts.personalContext`), avec un rappel explicite de confidentialité.
- UI : `app/(app)/assistant/assistant-chat.tsx` — rail « Mes conversations » (ouvrir, supprimer,
  **tout effacer** = droit à l'oubli), tiroir sur mobile.
- Actions scopées : `myAssistantThreads`, `myAssistantThread`, `deleteMyAssistantThread`,
  `forgetMyAssistantMemory`, `refreshMyBrief`.
- Tests : `src/lib/assistant-memory.test.ts` — 8 tests qui **tentent explicitement la fuite**
  (lire / écrire / supprimer le fil d'un autre en connaissant son identifiant exact) et vérifient
  qu'elle échoue. Drapeau : `assistant_memory`.

### Écran « Aujourd'hui » & point du matin

**Aujourd'hui** (`/aujourdhui`, drapeau `home_today`) répond à une seule question : *que dois-je
faire maintenant ?* Aucune nouvelle source de données — on relit `getActionCenter` (déjà filtré par
les droits) et l'agenda du jour, puis on **ordonne** :

- `rankToday(items, now)` (`src/lib/queries/today.ts`, **fonction pure, testée**) — le retard passe
  devant tout et remonte avec sa durée ; à échéance égale une **validation** (qui bloque un
  collègue) passe avant une tâche personnelle ; la priorité départage le reste.
- Chaque ligne porte sa **raison** (`En retard`, `Pour aujourd'hui`, `Quelqu'un attend votre
  validation`…) : jamais un classement muet.
- L'écran montre **une** action en tête, quatre suivantes, le reste replié derrière « Tout voir ».
- La racine `/` mène à `/aujourdhui` quand la nouveauté est active, sinon `/mon-espace`.
- Tests : `src/lib/queries/today.test.ts` (7 tests sur le classement).

**Point du matin** (drapeau `assistant_proactive`) — l'assistant parle en premier : 3 à 5 phrases
sur ce qui presse et par quoi commencer, affichées en tête de `/aujourdhui` et du module Assistant.
`src/lib/daily-brief.ts` ; **un seul appel IA par personne et par jour** (cache `DailyBrief`, clé
`userId + jour d'Alger`), bouton « Actualiser » pour forcer. Journée vide → aucun appel IA (on ne
fabrique pas du bruit pour meubler).

### Courrier « smart » — envoi par API HTTPS, sans SMTP

Les ports SMTP (25/465/587) sont filtrés par la plupart des hébergeurs et des réseaux d'entreprise :
c'est la cause des blocages à répétition. L'envoi passe désormais par une **API HTTPS sur le port
443**, celui du web — s'il passe, le courrier passe.

- `src/lib/mail-smart.ts` — **agnostique du fournisseur** : Resend, Postmark et Brevo parlent tous
  HTTPS + JSON. `buildProviderCall()` (pure, testée) traduit un envoi dans le dialecte de chacun ;
  changer de fournisseur = changer deux variables, jamais une ligne de code métier.
- Journal : `OutboundEmail` — chaque tentative laisse une trace avec le **motif exact** du refus
  (c'est précisément ce qui manquait avec SMTP). `InboundEmail` pour la réception.
- Réception : `POST /api/mail/inbound` — route **publique** (le fournisseur n'a pas de session) mais
  jamais ouverte : signature **HMAC-SHA256 du corps brut** vérifiée avant toute lecture, comparaison
  en temps constant, refus total sans `MAIL_WEBHOOK_SECRET`, idempotence sur `messageId`.
- Écran : `/admin/courrier` (Super Admin) — état de la configuration, **ce qui reste à faire hors
  application**, envoi de test, journal des envois.
- Variables : `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM`, `MAIL_WEBHOOK_SECRET`.
- ⚠️ **Dépendance externe** : il faut un **compte fournisseur** et le **domaine vérifié** chez lui
  (SPF + DKIM + DMARC en DNS). Sans ces enregistrements, les messages partent mais arrivent en
  indésirables. Tant que ce n'est pas fait, `smartMailConfigured()` est faux et l'app **le dit**
  plutôt que d'échouer silencieusement.
- Tests : `src/lib/mail-smart.test.ts` (11 tests) — jamais de port SMTP, en-têtes et corps corrects
  pour les trois fournisseurs, signature juste acceptée / fausse / absente / **corps falsifié après
  signature** refusés, normalisation des trois dialectes entrants.

### Assistant — plein écran, conversations, réponse en flux

L'assistant ne renvoie plus son texte d'un bloc après un long silence : il **s'écrit**.

- **Vrai streaming** (pas un effet de machine à écrire) : `callClaudeStream` (`lib/ai.ts`)
  remonte le texte au fil de sa génération et réassemble les `tool_use` à partir des fragments
  JSON, si bien que la boucle agent n'a rien à changer. `runAssistantStream` (`lib/assistant.ts`)
  émet des événements : `trace` (« je consulte vos validations… ») dès qu'un outil s'exécute,
  puis `delta` mot à mot, puis `done` avec le résultat complet.
- **Route** : `POST /api/assistant/stream` (SSE, runtime Node). Identité issue de la **session**,
  jamais du client ; assistant **désactivé en « Vue exacte »** ; toute action d'écriture reste
  interceptée et soumise à confirmation. En-tête `X-Accel-Buffering: no` — sans elle, un proxy
  remettrait le flux en tampon et le livrerait… d'un bloc.
- **`reset`** : si un tour se révèle être un appel d'outil, le texte déjà affiché n'était qu'un
  préambule → le client l'efface avant la vraie réponse. Rare en pratique, mais l'affichage
  reste juste dans tous les cas.
- **Écran** : plein écran (pas d'en-tête de page), colonne de lecture centrée, rail des
  conversations **regroupées par ancienneté** (aujourd'hui / 7 j / 30 j / plus ancien), curseur
  d'écriture, bouton **arrêter** qui conserve le texte déjà produit.
- Les **pièces jointes** passent par l'action serveur (il faut les résoudre et les extraire
  avant l'appel au modèle) ; tout le reste passe par le flux. La persistance du fil est
  mutualisée entre les deux chemins (`rememberExchange`), pour que la règle de cloisonnement
  n'existe qu'à un seul endroit.

### Moyens généraux — corriger, supprimer, et des totaux qui disent la vérité

Une erreur de saisie se répare **là où on la voit** : chaque dépense porte un crayon et une
corbeille dans la liste. La laisser « pour la trace » ne préserve rien — elle fausse à la fois
le budget et le solde de caisse, qui se lisent tous deux sur ces mêmes lignes. C'est le
**journal d'audit** qui garde la trace, avec le montant d'avant et l'auteur de la correction.

- **Droit** (`canAmendExpense`) : les mêmes que pour créer — celui qui **tient** le budget, ou
  celui qui **achète** sur son propre département. Obliger à remonter à l'administration pour
  corriger un montant garantit surtout que personne ne corrige, et qu'on vit avec un budget faux.
  Une dépense payée sur la **caisse** ajoute une condition : c'est de l'argent physique, seule la
  personne qui le détient (ou la direction) y touche. Le bouton n'apparaît que dans ce cas
  (`canAmendCash`, calculé avec la **même** règle que le serveur).
- **Modifier rouvre le TICKET**, pas seulement le montant : une dépense sans détail est réouverte
  comme un article unique portant son libellé et sa somme — ce qu'elle est réellement.
- Sur une caisse, le nouveau montant est reconfronté au fond **en mettant de côté la dépense
  corrigée** (`pettyCashBalanceExcluding`) : sans cela, son propre montant compterait deux fois et
  une simple correction de libellé serait refusée « faute d'argent ». Testé.
- **Supprimer** emporte les lignes (cascade) **et les justificatifs** : un scan rattaché à une
  dépense qui n'existe plus n'est consultable nulle part et occupe le stockage indéfiniment. La
  confirmation dit ce qui part et l'effet sur les chiffres — « êtes-vous sûr ? » ne renseigne
  personne.

**Deux totaux étaient faux, et le sont corrigés :**

1. **Le consommé se calculait sur la LISTE AFFICHÉE**, plafonnée à 200 lignes : au 201ᵉ achat de
   l'année, le budget s'allégeait tout seul. Vérifié sur 250 dépenses — la liste tronquée
   totalisait 20 000 DZD là où la base en comptait 63 000. Les totaux viennent désormais d'un
   `groupBy` sur l'année entière ; la liste reste plafonnée (et le dit), le compte affiché est le
   compte **réel**.
2. **L'enveloppe des moyens généraux se voyait soustraire des dépenses d'une AUTRE nature**
   (budget métier, formation), alors qu'elle ne porte que `OPERATING` — ce que la page Budgets,
   elle, comptait déjà nature par nature. Les deux écrans donnaient donc des chiffres différents
   pour le même département. Le consommé est maintenant `OPERATING` seul, et ce qui relève d'une
   autre enveloppe est affiché **à part**, pour que la somme des lignes se réconcilie sans qu'on
   croie à une erreur de calcul.

**Ce qui était déjà juste** (vérifié sur données réelles) : une dépense payée sur la caisse est
bien déduite **du fond ET imputée au budget** — c'est le même enregistrement lu de deux endroits,
donc les deux ne peuvent pas diverger, et une correction comme une suppression se répercutent
d'elles-mêmes sur les deux.

### Moyens généraux — le catalogue d'articles et le ticket à plusieurs articles

On n'achète presque jamais une seule chose. Une dépense réduite à « courses — 12 400 DZD » dit ce
qui est **sorti de la caisse** et rien de ce qui a été **acheté** : ni ce qu'on consomme le plus,
ni à quel prix, ni si le total correspond au ticket qu'on vient de scanner.

- **Un seul catalogue** (`OfficeSupplyArticle`), tenu depuis les **moyens généraux** comme depuis
  le **Bureau du secrétariat** — `canManageCatalog` accepte désormais `GENERAL_MEANS.UPDATE`. En
  tenir deux aurait produit deux vocabulaires, donc des consommations incomparables.
- **Un justificatif, N articles** (`DepartmentExpenseLine`) : article du catalogue *ou* saisie
  libre pour un achat unique, quantité, montant. Le modèle porte les deux — un achat hors
  catalogue reste un achat.
- Le `label` de la ligne est **figé à l'achat** en plus du lien vers le catalogue : un article
  renommé ou désactivé plus tard ne doit pas réécrire un ticket déjà classé.
- **Le total découle des lignes** (`receiptTotal`), il ne se saisit plus à côté : deux nombres
  censés dire la même chose finissent toujours par diverger, et c'est alors le budget qui devient
  faux. Le formulaire affiche le même total que celui que le serveur recalcule — **même module**
  (`lib/general-means/receipt.ts`, pur, 20 tests).
- Choisir un article **pré-remplit** le montant au prix indicatif du catalogue, sans jamais écraser
  une saisie : c'est une aide, le ticket fait foi (l'écart est signalé sous la ligne).
- Vaut pour les **deux portes** — dépense payée sur la **caisse d'avance** et achat imputé
  **directement au budget** : c'est le même enregistrement, la règle est donc écrite une fois
  (`lib/general-means/expense-lines.ts`) et appelée des deux côtés.
- **Compatibilité** : sans lignes envoyées (ancien formulaire, appel programmatique), on retombe
  sur le couple libellé + montant — aucun circuit existant ne casse.
- La liste des dépenses affiche le **détail** sous chaque ligne : « 5× Ramette A4 (3 500 DZD) ·
  Toner (8 900 DZD) ». C'est ce qui manquait pour relire un budget six mois plus tard.

### Regulatory — le cadenas : un dossier invisible pour toute l'équipe

Charger un portefeuille dans l'outil et le publier à l'entreprise sont deux gestes différents.
Un dossier **verrouillé** (`RegulatoryProduct.isLocked`) n'existe que pour le **Super Admin** et
pour **ceux à qui il a ouvert le pipeline** : ni la Direction, ni son responsable, ni une
autorisation nominative ne l'ouvrent d'eux-mêmes.

- **Deux droits, jamais confondus** (`src/lib/regulatory/pipeline-access.ts`, module pur testé) :
  **CONSULTER** les dossiers verrouillés — une confidence, pour ceux qui *montent* le dossier
  avant l'ouverture ; et **TENIR LE CADENAS** — ouvrir un dossier, donc le publier à toute
  l'entreprise, ce qui ne se reprend pas (ce qui a été lu a été lu). Tenir le cadenas implique de
  voir ; l'inverse est faux. Le Super Admin détient toujours les deux : c'est lui qui distribue
  ces accès, et un réglage malheureux ne doit pas pouvoir l'enfermer dehors.
- **Réglé en Administration › Réglages** (`AppSetting.pipeline*Roles` / `pipeline*UserIds`, action
  `setPipelineAccess`) : rôles **et** personnes nommées, par niveau. Listes **vides par défaut** —
  sans réglage, le pipeline reste ce qu'il était : le Super Admin, et lui seul.
- **Résolu une fois par requête** dans `getAccess` (`access.pipelineView` / `pipelineManage`),
  parce que le verrou est consulté par des fonctions **synchrones** (`scopeRegulatory`,
  `regulatoryLockWhere`) qui servent partout et ne peuvent pas lire la base. Les helpers publics
  sont `seesLockedRegulatory(user)` et `holdsRegulatoryLock(user)`.
- L'**entrée de menu « Pipeline »** (garde `pipeline`) et la **page** elle-même se ferment à qui ne
  voit aucun dossier verrouillé : une entrée qui ouvre un écran vide se clique, ne se comprend pas,
  et finit en question à l'administrateur.
- **La règle vit dans la PORTÉE, pas dans l'écran** : `scopeRegulatory` (→ `lockGate`) l'applique
  avant tout le reste. Un dossier caché du tableau mais visible depuis la recherche globale,
  l'assistant IA, le sélecteur de produits des stocks ou les documents ne serait pas caché du tout.
- Les lectures qui **ne passent pas** par cette portée reçoivent le même filtre via
  `regulatoryLockWhere(user)` : sélecteur de produits des **stocks**, rapprochement
  « notre produit » d'un **appel d'offres PCH** (lu par toute l'équipe), liste des dossiers de la
  page d'**autorisations nominatives** en Administration. Le **portail fournisseur** l'exclut aussi,
  en défense en profondeur.
- **Par URL directe** : `canAccessEntity` compose `scopeRegulatory`, donc la fiche d'un dossier
  verrouillé rend un **404** — pas une page vide, pas un message qui confirmerait son existence.
- **Ouvrir le cadenas** : cliquer l'icône sur la ligne (`setRegulatoryLock`), ou **tout
  déverrouiller** d'un geste (`unlockAllRegulatory`) — un portefeuille se publie en une fois, pas
  ligne par ligne. Volontairement **à sens unique** : un « tout verrouiller » symétrique ferait
  disparaître le catalogue entier pour toute l'entreprise d'un clic. Chaque bascule est **auditée**.
- Un bandeau permanent rappelle **combien** de dossiers sont encore verrouillés — sans lui, un
  portefeuille reste fermé des mois par oubli.
- Tests : `rbac.test.ts` couvre les trois cas qui garantissent que la règle ne se contourne pas
  (portée ALL, responsable nommé, Super Admin) ; `pipeline-access.test.ts` (17 tests) couvre les
  deux niveaux d'accès, le rôle secondaire, et le fait que tenir le cadenas implique de voir.

### Regulatory — les trois champs du Super Admin

Un dossier a des dizaines de champs, et presque tous se corrigent au fil de l'eau. **Trois** font
exception, parce qu'ils ne décrivent pas le produit — ils décident de ce qu'il **engage** :

| Champ | Ce qu'il décide |
|---|---|
| **Statut de fabrication** (`manufacturingStatus`) | Importation → packaging secondaire → primaire → full process. Ce que la société s'engage à faire **industriellement** : investissements, délais, argumentaire devant l'agence. |
| **Chargé du dossier** (`responsibleId`) | Un engagement pris **au nom de quelqu'un**. |
| **Entité** (`companyId`) | **Qui a le droit de voir** le dossier. La changer, c'est le déplacer d'une société à une autre — donc le montrer à des gens et le cacher à d'autres. |

Ces trois-là appartiennent au **SUPER ADMIN**, et à personne d'autre — ni la Direction, ni le
responsable Regulatory, ni le porteur du dossier. Le reste de la fiche demeure ouvert à qui a le
droit de la modifier : on ne fige pas un dossier, on protège trois décisions. Règles :
`src/lib/regulatory/structural-fields.ts` (module pur, 17 tests).

- **Quatre portes, un seul verrou** — la fiche (`updateRegulatoryProduct`), les deux menus du
  tableau (`setRegulatoryResponsible`, `setRegulatoryClassification` pour l'entité) et la
  **promotion par variation** (`setVariationStatus` à « OBTENUE », qui fait évoluer le statut de
  fabrication). Cette dernière était la **porte dérobée** : sans garde, on changeait le statut
  réservé en déclarant une variation obtenue. Déposer une variation, la mettre en attente ou
  l'annuler restent ouverts — ce sont des faits du dossier, pas la décision industrielle.
- **Un refus n'annule pas l'enregistrement.** On compare UNIQUEMENT les champs réellement
  transmis (« non transmis » ≠ « effacé ») : quelqu'un qui corrige un dosage ne touche à rien de
  structurel et ne voit aucun refus. S'il en a tenté un, le reste de la fiche est **enregistré**
  et la réserve **nomme** les champs refusés — perdre un formulaire de trente champs parce qu'une
  liste déroulante a bougé serait une punition, pas une protection.
- **À l'écran** : les trois champs s'affichent en lecture, avec un cadenas et « Réservé au Super
  Admin ». Ils ne sont pas *cachés* (il faudrait ouvrir un autre écran pour lire la valeur) et pas
  seulement *grisés* (un champ grisé donne envie de cliquer) : on montre la valeur et on dit
  pourquoi elle ne bouge pas. Le serveur revérifie dans tous les cas.
- **LE CHARGÉ DU DOSSIER EST PRÉVENU.** C'est lui qui répondra à l'agence sur le statut de
  fabrication : l'apprendre trois semaines plus tard en rouvrant la fiche par hasard n'est pas
  acceptable. La notification dit l'**avant** et l'**après** (« Statut de fabrication :
  Importation → Full Process »), pas « mis à jour ». Elle part que le changement vienne de la
  fiche ou d'une variation obtenue — même décision, même annonce. Le journal d'audit porte le même
  détail : « modifié » ne dit pas lequel.
- **La création n'est pas visée** : choisir l'entité et le statut de départ fait partie de créer un
  dossier — l'entité est même obligatoire, sans quoi le dossier serait visible du groupe entier.
  C'est la **modification** qui est réservée.

### Regulatory — la personne chargée du dossier (menu déroulant du tableau)

Un dossier réglementaire sans porteur n'avance pas. La question « qui s'en occupe ? » se pose
**en balayant la liste**, pas une fois entré dans une fiche : la colonne **« Chargé du dossier »**
est donc un **menu déroulant modifiable sur place** (`setRegulatoryResponsible`).

- **Droit** : `canAccessEntity(user, "REGULATORY_PRODUCT", id, "UPDATE")` — confier un dossier,
  c'est le modifier. Le tableau n'affiche le menu que si `userCan(user, "REGULATORY", "UPDATE")` ;
  sinon la colonne reste un simple texte. Le serveur **revérifie** dans tous les cas.
- **Assigner donne l'accès — VRAIMENT.** Trois verrous se refermaient l'un après l'autre sur la
  personne à qui l'on confiait un dossier, et chacun suffisait à le rendre invisible :
  1. **le module.** Son rôle n'ouvrait pas Regulatory → `requireModule` la renvoyait à l'accueil et
     `scopeRegulatory` ne lui montrait aucune ligne. On lui confiait un dossier qu'elle ne pouvait
     ni voir ni ouvrir, et la notification menait à une redirection. Désormais **porter un dossier
     ouvre le module** (`getAccess` → `carrierAccess`, `lib/regulatory/assignment.ts`) : `VIEW`,
     `UPDATE`, `UPLOAD`, `EXPORT`, en portée **ASSIGNED** — c'est-à-dire SES dossiers et rien
     d'autre, puisque `scopeRegulatory` continue de décider lesquels. Ni `CREATE`, ni `DELETE`, ni
     `VALIDATE` : ce ne sont pas des gestes de porteur. Un **blocage explicite** du module par
     l'administrateur gagne toujours — un blocage qui se lèverait tout seul serait imprévisible.
  2. **la gamme.** Confier un dossier « Onco » à quelqu'un rattaché à la gamme « Cardio » le lui
     donnait sans le lui montrer. Être **nommé** sur un dossier passe désormais avant le filtre de
     gamme : la gamme dit « votre périmètre habituel », nommer quelqu'un dit « celui-ci aussi,
     délibérément ». Le cloisonnement par **entité**, lui, n'est pas touché : porter un dossier
     d'une autre société se décide en ouvrant cette société.
  3. **le cadenas.** Il ne cède pas, même devant un responsable nommé — mais on ne fait plus
     semblant : la notification dit que le dossier est **verrouillé** et n'apparaîtra qu'à
     l'ouverture du cadenas, et l'écran le dit aussi à celui qui vient de le confier
     (`assignmentNotice` / `assignmentWarning`). Une notification qui annonce un dossier
     introuvable est pire que pas de notification.
  Le nouveau responsable reste **rattaché aux participants** (`assignedUsers`). L'ancien **n'est
  pas retiré** : il a travaillé dessus, et lui couper la vue en cours de route ferait perdre
  l'historique à la seule personne qui le connaît. Le retrait se décide dans le panneau
  « Participants ».
- **Choix vide = décision** : « — Non attribué — » libère le dossier. Le filtre de la colonne
  propose la même entrée, parce que « lesquels n'ont personne ? » est la question la plus utile
  devant une liste. La cellule non attribuée est teintée en avertissement.
- La personne désignée est **notifiée** (`ASSIGNMENT`) et le changement **audité**
  (`field: responsibleId`). Un refus du serveur s'affiche : sinon le menu reviendrait
  silencieusement en arrière.

### Regulatory — import d'un portefeuille produits depuis un classeur

Le portefeuille **« Sélection PF Produits » (69 produits)** est entré dans Regulatory par une
**migration de données idempotente**, pas par une saisie manuelle ni un script à lancer à la main :
elle s'applique au déploiement comme les autres.

- **Source versionnée** : `data/selection-pf-produits.xlsx`. Le SQL est **généré** par
  `scripts/gen-selection-pf-migration.ts` à partir des règles pures de
  `lib/regulatory/sheet-import.ts` — l'import reste ainsi **vérifiable et rejouable** si la
  feuille évolue (régénérer, ne pas éditer le SQL à la main).
- **Le classeur métier n'est pas un formulaire**, et c'est tout le problème : le dosage est tantôt
  dans « Forme galénique & dosage » (« GELULE 0,5MG »), tantôt dans « Conditionnement »
  (« 5 MG/B 30 ») ; les formes sont abrégées à la main (« CPR.PELL. LP », « PDRE+SOLV ») ; une
  association s'écrit « A + B » et une **alternative** « A Ou B ». Chaque règle est explicite et
  **testée** (`sheet-import.test.ts`, 34 tests) :
  - `Spé` → classe thérapeutique · `Priorisation` 1..4 → Critique..Basse (**vide = Moyenne** : une
    case vide n'est pas une priorité basse, c'est un arbitrage qui reste à faire) ;
  - `Off`/`Hop` → canal Ville / Hôpital / les deux ; `Fabrication` → niveau **déclaré** Full
    process (le tableau affiche « déclaré » vs « variation obtenue », cf. section précédente),
    `Importation`/vide → Importation ;
  - « DCI : Marque » se sépare, « A + B » devient une **association** (`molecules`), « A Ou B »
    reste **une seule** DCI — la scinder inventerait deux dossiers là où il y en a un ;
  - les mesures du **contenant** sont écartées du dosage : « B 30 » compte des boîtes, et dans
    « 1 tube 15 G / 45 G » les grammes pèsent le tube. De même le millilitre seul : « 10MG/10ML »
    dose **10 mg**. Mieux vaut **aucun** dosage qu'un chiffre faux.
- **Rien n'est jeté** : quantités marché ville/PCH, prix FOB, taille de marché, concurrents et le
  **libellé d'origine** vont dans les commentaires du dossier — c'est l'arbitrage qui a conduit à
  retenir le produit.
- **Idempotence** : identifiants stables `regpfNNNN`, insertion `WHERE NOT EXISTS`, référence
  calculée **à la suite** de la série `REG-AAAA-NNN` existante (aucune collision). Les
  **17 étapes** de workflow sont créées comme pour tout dossier créé depuis l'application.
- **Entité** : Adventum si elle existe, sinon la première entité active. Sans aucune entité, les
  dossiers restent non rattachés et le bandeau « dossiers sans entité » du tableau le signale —
  on ne devine pas à la place d'un humain.
- Les dossiers arrivent en **Présoumission, sans responsable** : ils se confient depuis la colonne
  « Chargé du dossier » ci-dessus.

### Regulatory — niveau de process (la variation obtenue fait foi)

Colonne **Niveau de process** : Importation → Secondary Packaging → Primary Packaging →
Full Process, la trajectoire d'industrialisation locale d'un médicament importé.

**Règle** : le niveau saisi sur la fiche n'est qu'une **déclaration** ; dès qu'une variation est
**OBTENUE**, c'est SA cible qui fait foi. Le niveau est donc **calculé à la lecture**
(`lib/regulatory/manufacturing-stage.ts` → `effectiveStage`, pure et testée), et non recopié à
l'écriture : une modification ultérieure de la fiche ne peut plus le faire diverger de la
réalité réglementaire.

- La cellule affiche la **provenance** (« déclaré » / « variation obtenue ») — c'est la question
  qu'on se pose vraiment — et signale une variation **en attente** sans jamais la compter comme
  acquise. La colonne se filtre comme les autres.
- Départage : la variation la plus **récente** décide (une décision peut en corriger une autre,
  même vers un niveau moins avancé) ; à date égale, le niveau le plus avancé gagne — on ne fait
  pas reculer une industrialisation actée ; sans date de décision, on retombe sur la création.
- Tests : `manufacturing-stage.test.ts` (11 tests), dont le cas « la fiche a divergé ».

### Force de vente — gamme et produits attribués

`PromoProduct.channel` (RETAIL · HOSPITAL · BOTH) et `PromotionAssignment` (KAM × produit ×
cycle, priorité P1/P2/P3) existaient déjà. Ce lot en fait un **périmètre** au lieu d'une simple
matrice de planification.

| Règle | Où | Pourquoi |
|---|---|---|
| Le personnel prime sur l'équipe | `mergePortfolio()` (pure, testée) | Un superviseur porte quelques produits en direct tout en pilotant les autres. À priorité différente, **la meilleure gagne** — on ne rétrograde jamais un produit en fusionnant. |
| Un produit `BOTH` couvre **les deux** gammes | `portfolioGammes()` (pure, testée) | Quelqu'un qui ne porte que des produits mixtes fait bien de la ville ET de l'hôpital ; ne pas déplier reviendrait à dire qu'il ne fait ni l'un ni l'autre. |
| Report du dernier cycle saisi, **signalé** | `getMyPortfolio()` → `fromPreviousCycle` | Sans report, un délégué est à vide le 1er du mois. Sans le signaler, il croit son portefeuille reconduit alors que la Direction ne l'a pas arrêté. |
| Direction et Super Admin voient tout | `selectableProducts(userId, seesAll)` | Ils arbitrent pour l'ensemble : restreindre leur choix n'aurait aucun sens. |
| Un produit retiré du catalogue disparaît | `toProducts()` | Un produit inactif ne se promeut plus — le laisser dans un portefeuille inviterait à travailler dessus. |

**Le paramétrage reste hors Ressources humaines**, à dessein : porter tel ou tel produit relève
du business et change au fil des cycles ; ce n'est pas une donnée de contrat.

Fichiers : `lib/sales-portfolio.ts` (pur + `sales-portfolio.test.ts`, 15 tests),
`lib/queries/portfolio.ts`, `components/planning/my-portfolio-card.tsx` (serveur, dans
`/mon-espace`). Paramétrage : `/planning` → onglets **Catalogue** (gamme par produit) et
**Affectations** (matrice par cycle).

### Force de vente — les référents Direction Marketing d'une gamme

**LA DÉCISION.** « Chaque BU aura son ou ses référents de la direction marketing depuis la
configuration des BU, mais le directeur du département marketing recevra **également** l'accès et
la notif et pourra modifier, valider. » Le menu « Référent Direction Marketing (facultatif) » des
nouvelles demandes a disparu au lot précédent ; la désignation vit désormais **là où se configure
la gamme** (`/planning/business-units`, section 5), et plus dans chaque formulaire.

**CE QUE LA DÉSIGNATION FAIT — ET CE QU'ELLE NE FAIT PAS.** Elle **CIBLE** la notification : une
demande Ad & Pro de la gamme Oncologie prévient **nommément** ses référents au lieu d'arroser tout
le rôle. Elle n'**ACCORDE** rien — le pouvoir de trancher reste gouverné par le rôle de l'étape
(`WorkflowStep.actorRoles`), inchangé. Une désignation posée depuis un écran de configuration
**commerciale** qui ouvrirait un pouvoir d'**arbitrage** serait une porte de permission à côté de
la porte gardée : l'écran ne propose donc que des personnes qui **portent déjà** le rôle, et
l'action refuse les autres en nommant le remède (**Administration › Comptes**).

| Règle | Où | Pourquoi |
|---|---|---|
| Le rôle reste prévenu, les référents s'y **ajoutent** | `aPrevenirPourLaGamme()` (pure) | C'est ainsi que « le directeur du département recevra **également** » est tenu sans avoir à deviner qui est le directeur. Une gamme **sans** référent retombe exactement sur le comportement d'avant — la table se déploie vide sans priver personne. |
| Seule l'étape qui **nomme** le rôle concerne la gamme | `laGammeEstConcernee()` (pure) | Mesuré de bout en bout : la route d'un National Sales traverse la porte du DG **puis** la Direction des opérations, donc la première version dérangeait le référent **deux fois** avant l'étape qui le concerne. La règle s'arme sur le `notifyRoles` de l'étape, lu dans la définition — une étape marketing ajoutée demain prévient les référents **sans que personne y pense**. |
| **UN** référent inscrit la demande à son nom ; **PLUSIEURS** n'en inscrivent aucun | `referentUnique()` (pure) | `productManagerId` a sept lecteurs et n'avait plus **aucun** écrivain. Collapser sur le premier choisirait l'arbitre d'un budget par l'**ordre d'insertion en base**. |
| La gamme qu'on **écrit** est celle dont on prend le référent | `createSponsoring`, `createCongressRequest`, `submitEventForApproval` | Défaut mesuré : la soumission d'un événement lisait la gamme dans le **formulaire**, que son seul écran n'envoie pas — **aucun** événement ne recevait jamais son référent. Et le sponsoring écrivait la gamme **déduite** du demandeur tout en cherchant le référent sur le formulaire : l'arbitre de la gamme A sur une demande déposée sous la gamme B. |
| Le rôle est **relu** à chaque affichage | `/planning/business-units` + `referentAInscrire()` | Une désignation n'est pas une permission qui survit à son motif : muté, le référent reste **prévenu** (c'est une notification, pas un pouvoir) et cesse d'être **inscriptible**. L'écran le DIT par ligne — « ne porte plus le rôle ». |
| Le rôle qui tranche est **`PRODUCT_MANAGER` seul** | `porteLeRoleQuiTranche()` (socle) | L'étape décisive ne nomme que celui-là — mesuré dans `workflow/defaults.ts`, et un cas du banc tient cette prémisse. `MEDICAL_PROMOTION_MANAGER` configure les référents mais ne peut pas en être un : l'inscrire ferait une attente sans pouvoir. Le geste, si la Direction élargit l'étape, est d'ajouter le rôle à ses `actorRoles` **et** ici. |
| Le montage d'une BU compte **six** étapes | `sfe-setup.ts` (`REFERENTS`) | Une BU avec un référent qui **ne porte pas** le rôle ne franchit pas l'étape : elle a l'air montée, et la personne désignée est prévenue sans rien pouvoir trancher. |

**Où.** `lib/personnes/referents-gamme.ts` (**socle**, pur — quatre couches en ont besoin sans
avoir le droit de se parler : l'écran, les trois actions de création, le moteur de circuit et les
ops d'Adam ; écrit d'abord sous `lib/ad-pro/`, il y créait un **cycle** `adpro ↔ tasks`),
`lib/ad-pro/referent-de-la-gamme.ts` (la lecture en base), `workflow/engine.ts`
(`prevenirEtapeAtteinte` — **un seul** point de notification pour les trois endroits où une étape
est atteinte), `actions/sales-planning-actions.ts` (`addBuMarketingReferent` /
`removeBuMarketingReferent`, idempotentes), `planning/business-units/bu-manager.tsx` (section 5).
**En conversation** : `add_marketing_referent` / `remove_marketing_referent`, dont la carte DIT que
le geste cible la notification et n'accorde aucun droit.

### Prise en charge — personnes, besoins et devis

Les participants étaient un **tableau JSON** (`beneficiaries`) : impossible d'y porter un avis,
une décision individuelle, ou la liste de ce qu'il faut fournir et acheter pour chacun. Trois
tables les remplacent — `CareBeneficiary`, `CareCell`, `CareQuote` — pour le **national** et
l'**international**.

**Le routage que décrit le métier existait déjà** : `adProOriginRank` saute toute étape située au
niveau ou en dessous du rang du demandeur (délégué → National Sales → Direction Marketing →
Direction). Ce lot ajoute ce qui manquait vraiment : **l'examen personne par personne**.

| Règle | Où | Pourquoi |
|---|---|---|
| Identité : annuaire **ou** profil libre | `beneficiaryName()` (pure, testée) | On ne crée pas une fiche médecin permanente pour un intervenant vu une seule fois. Ne rend jamais de nom vide — une ligne sans nom serait introuvable. |
| **Décision par personne** | `decideCareBeneficiary` | « Chaque personne sera traitée différemment » : on en accorde une et on en écarte une autre sans refuser toute la demande. |
| Une **pièce d'identité créée d'office** à l'accord | `defaultCells()` | Le point de départ du dossier. Volontairement seule : pré-remplir dix cases qu'il faudra effacer coûte plus cher que d'ajouter les deux qui servent. Passeport à l'international, pièce d'identité au national — un passeport pour Alger n'a pas de sens. |
| Les besoins appartiennent à la **ligne**, pas à une colonne | `CareCell.beneficiaryId` | L'une a besoin d'un visa et pas l'autre. Le « + » ajoute un besoin **à cette personne-là**. |
| « Sans objet » ≠ suppression | `CareCellStatus.WAIVED` | Garde la trace qu'on a bien regardé le visa et qu'il n'en fallait pas. Une case supprimée laisserait croire qu'on n'y a jamais pensé. |
| Un devis couvre **ce qu'il couvre** | `CareQuoteCell` (n-n) | Une agence chiffre le groupe entier ; on ne lui demande pas de découper en dix lignes. Accepté ou refusé **d'un bloc** — accepter la moitié d'un devis n'a pas de sens commercial. |
| **Jamais deux devis sur la même case** | `quoteConflicts()` (pure, testée) | C'est le garde-fou central : payer deux fois le même hôtel ne se verrait qu'à la facture. Refuser d'abord l'autre devis. |
| Finances refusées tant qu'il manque quelque chose | `financeReadiness()` (pure, testée) | Trois blocages nommés : aucune personne accordée, un devis encore en attente, une personne accordée au dossier incomplet. Chacun dit **qui** et **quoi**. |

**Gardes en base**, parce qu'un code correct ne suffit pas : `CareBeneficiary_one_parent` et
`CareQuote_one_parent` (exactement un parent — une personne sans parent serait invisible partout
tout en existant), `CareCell_service_kind` (une case SERVICE porte une nature, une case DOCUMENT
n'en porte pas). Les quatre sont vérifiées à l'application de la migration.

Fichiers : `lib/care.ts` (`beneficiaryName`, `careProgress`, `quoteConflicts`, `financeReadiness`
+ `care.test.ts`, 24 tests), `lib/actions/care-actions.ts`, `lib/queries/care.ts`,
`components/care/care-panel.tsx`. Migration `20260806160000_care_beneficiaries` — reprend le JSON
existant en lignes **sans l'effacer** : en cas de doute sur la reprise, la source reste lisible.

### Ad & Pro — postes, validation par poste et chaîne jusqu'au paiement

`SponsoringRequest` ne portait qu'un montant (`amountRequested` → `amountProposed` →
`amountGranted`) ; `CongressNational`, un `finalAmount` et deux booléens (`hasBooth`,
`hasSymposium`) qui annonçaient un stand ou un symposium sans jamais les chiffrer. Ces opérations
couvrent pourtant plusieurs choses, payées à plusieurs personnes. `AdProItem` décrit ces
**postes** — pour les **quatre** opérations du pôle : sponsoring, prises en charge **nationales**
et **internationales**, **événements**.

**Un sponsoring NAÎT avec son poste (27/09/2026).** « Sponsoring direct (association) » ou « Sponsoring
indirect (prise en charge) » selon la nature choisie à la création, chiffré au montant suggéré par le
délégué ; la tenue pré-validée, ses postes ne sont PAS « tardifs » (les ajouter EST l'étape) ; la validation
finale exige chaque poste décidé et chaque poste accordé rangé dans un budget, puis écrit leur somme comme
montant accordé et fige les postes. Détail : [Sponsoring — la tenue d'abord](#sponsoring--la-tenue-dabord-largent-à-la-fin-27092026).

**Une table pour les quatre modules**, avec **quatre clés étrangères nullables** plutôt qu'un
couple (type, id) : une colonne polymorphe ne peut pas porter de contrainte, donc supprimer un
congrès laisserait ses postes orphelins. Ici la cascade est garantie par la base, et une
contrainte `AdProItem_one_parent` impose qu'exactement un parent soit renseigné.

**Treize natures de poste, et quatre nommées par la Direction** (`ITEM_KIND_LABELS`,
`lib/ad-pro-items.ts`) : **sponsoring association**, **prise en charge de la billetterie**,
**prise en charge de l'hôtellerie**, **prise en charge des dîners**, aux côtés du stand, du
symposium, du matériel promotionnel, de la location de salle, du traiteur, du consulting, de la
prestation, du déplacement et d'« autre ». Deux distinctions sont **portées par le code, pas par
l'usage** : `ACCOMMODATION` (l'hôtellerie) quitte `TRAVEL`, dont le libellé disait
« Déplacement / hébergement » alors que la nature ne sait pas se scinder — une prose qui promet un
partage que le code n'a pas ; et `DINNER` (les dîners d'un congrès, facturés au restaurant) n'est
pas `CATERING` (le traiteur d'un stand), parce que ce sont deux fournisseurs et donc deux bons de
commande. Une nature ajoutée entre dans l'ordre d'affichage **et** dans les valeurs d'énumération
que la fiche d'action d'Adam déclare, sans qu'on touche à rien : la dérivation les lit à la source.

**Chaque poste se valide INDÉPENDAMMENT** (doctrine révisée — auparavant un poste n'était qu'une
ventilation sans circuit propre). Consulting, traiteur, location de salle ne se décident pas
ensemble : « la Direction » au sens de l'écran — la vue globale, ou le droit « Valider » du module (par défaut la
Direction, le Directeur Général et la Direction Marketing) — **accorde**, **refuse**, ou **demande à revoir le budget** — autant de
fois qu'il le faut. Chaque tour est conservé (`AdProItemDecision`) : un poste accordé au 3ᵉ tour
garde la trace des deux refus qui l'ont précédé.

**La chaîne complète, du besoin au paiement** — c'est ce qui relie les modules entre eux :

```
Ajout du poste (nature, montant estimé, INCLUS dans le budget accordé ou RALLONGE)
   → (option) demande de DEVIS ouverte au Bureau du secrétariat (AdministrativeRequest type QUOTE)
        → les devis déposés sur la demande font partie du dossier du poste
   → SOUMISSION à « la Direction » (vue globale ou « Valider » du module)  →  accordé / refusé / budget à revoir
   → choix du BUDGET (catégorie d'enveloppe)
   → demande d'ÉMISSION DU BON DE COMMANDE  →  visa du centre Ad & Pro (au-dessus du seuil des BC ; en dessous,
     directement)  →  émission par les FINANCES
        → l'ordre de dépense naît avec sa catégorie budgétaire déjà renseignée
```

**Le poste porte ses PROPRES pièces jointes, et son accès vient de SON OPÉRATION.**
`canAccessEntity` rattachait tous les postes au module `SPONSORING`, écrit à la main — une
devinette, et elle était FAUSSE : mesuré, `MEDICAL_DELEGATE` et `MEDICAL_PROMOTION_MANAGER` sont
les **deux seuls rôles** qui portent `EVENTS` et `CONGRESS_NATIONAL` **sans** `SPONSORING`, donc
les auteurs typiques d'un événement ne pouvaient ni joindre une pièce ni commenter le poste de
LEUR propre demande. Un poste n'a pas de droits à lui : il DÉLÈGUE à son opération
(`parentDuPoste`, pur, exhaustif sur les cinq clés étrangères), et rend `null` sur tout ce qui ne
se lit pas à coup sûr — zéro parent, plusieurs parents, ou le parent **dormant** `trainingId`,
qui n'a aucun lecteur dans le dépôt.

**Devis, bon de commande et facture ne sont PAS le même geste — mesuré avant d'être codé.** Le
devis et la facture sont des pièces qu'on fait **établir** ou qu'on **réclame** : une demande au
bureau du secrétariat, avec sa référence, sa file, ses pièces jointes et son cycle — tout cela
existe déjà. Le bon de commande, lui, **engage de l'argent** : il porte le visa du centre Ad & Pro
(au-dessus du seuil des BC) puis l'émission d'un ordre de dépense par les Finances (`orderStage`), et en faire une quatrième
demande de secrétariat aurait créé une SECONDE vérité sur « le BC de ce poste » (§118.5). Un
seul écrivain pour les deux natures de secrétariat (`demanderPieceSecretariat`), l'enchaînement
dans un module pur (`lib/ad-pro/pieces-secretariat.ts`) : **le devis n'est pas un préalable**
(« on peut également demander un devis, pas que un BC » dit qu'on peut en demander un EN PLUS),
la **facture vient après le bon de commande** — la réclamer avant fabriquerait à la main
l'anomalie `facture_sans_bc` que le contrôle financier lève ailleurs —, et une demande déjà
ouverte de la MÊME nature ferme la sienne, la nature voisine restant ouverte.

**Le message du demandeur et la note de la Direction sont deux paroles.** « Quand on demande
l'émission d'un BC, on écrit un message avec les différents contenus, les références » : ce
message vivait dans `orderNote`, que le visa **écrasait** — et la colonne avait, mesuré, **trois
écrivains et aucun lecteur**, donc rien ne signalait la perte (§118.45). `orderDecisionNote`
porte désormais le visa ou le refus, et les deux sont AFFICHÉES sur la carte du poste.
**L'assistante de direction est prévenue de la demande d'émission** — c'est elle qui établit la
pièce ; elle n'était prévenue de rien. On ajoute un destinataire, on ne retire aucune garde : le
visa du centre Ad & Pro reste ce qui engage.

**Le rattachement se fait par le lien CANONIQUE** (`linkedEntityType` / `linkedEntityId`), celui
que `/demandes/[id]` lit déjà pour savoir qu'une dépense vient d'Ad & Pro et ne doit **pas** être
imputée une seconde fois au budget d'un département. Les demandes de devis de poste ne le
posaient pas — double comptage possible, sans la moindre erreur visible — et la liste de cet
écran, écrite à la main, oubliait `CONSULTING_CONTRACT`, `AD_PRO_OTHER` et `AD_PRO_ITEM` : elle
se dérive maintenant du registre canonique (§118.73). **Le même geste existe en conversation**
(`adpro_operation/request_item_quote`, les deux natures).

| Règle | Où | Pourquoi |
|---|---|---|
| Un poste **inclus** ventile l'enveloppe ; un poste **supplémentaire** est une rallonge | `breakdown()` (pure, testée) | Une rallonge assumée n'est pas un dépassement subi : les mêler ferait prendre une décision pour l'autre. La question est posée **à l'ajout**. |
| Un poste **refusé** ne pèse plus sur rien | `breakdown()` | Garder son montant ferait porter à l'opération le poids d'une dépense que la Direction a précisément écartée. |
| **Un ordre de dépense par poste** | `emitItemExpenseOrder` | Le stand se paie à l'organisateur, le matériel à l'agence : trois bénéficiaires, trois pièces. Un ordre global obligerait les Finances à répartir à la main. |
| Le BC s'émet **après** le visa du centre Ad & Pro (ou directement sous le seuil des BC) | `orderStage` + `canRequestPurchaseOrder` (pure, testée) | Deux responsabilités distinctes : le centre engage, les Finances paient. |
| Ajout après décision **autorisé et tracé** | `addedAfterDecision` | Cas réel : on découvre qu'il faut un stand. On ne bloque pas — mais l'écran affiche le dépassement. |
| Le matériel promo **n'est pas recopié** | `promoMaterialId` | Il a un circuit non négociable (visa publicitaire, conformité, agence, BAT). Le poste y renvoie. |
| Ce qui est **annoncé** doit être **chiffré** | `plannedGaps()` (pure, testée) | Un congrès déclare `hasBooth`/`hasSymposium` : l'écart se voit avant la facture. |

**Garde-fous financiers** (purs et testés) : `canSubmitItem` (on ne soumet pas un poste sans
chiffre), `canRequestPurchaseOrder` (accordé + chiffré + budget choisi, une seule fois — un refus
rouvre le droit), `canEmitOrder` (jamais un poste non accordé, jamais deux fois). Un montant déjà
couvert par un ordre ne peut plus changer, un poste payé ne peut plus être retiré.

Les différences réelles entre modules — où lit-on l'enveloppe, quel statut vaut « accordé »,
quelle permission, quel chemin revalider — sont rassemblées dans la table `PARENTS` des actions :
**un seul endroit** à compléter pour un module de plus. Le chargement des postes (libellés du
matériel, de l'ordre, du budget, de la demande de devis — résolus **en lot**) est mutualisé dans
`queries/ad-pro-items.ts` : les quatre écrans lisent la même vérité.

Fichiers : `lib/ad-pro-items.ts` (`breakdown`, `canEmitOrder`, `plannedGaps` +
`ad-pro-items.test.ts`, 19 tests), `lib/actions/ad-pro-item-actions.ts`,
`components/ad-pro/items-panel.tsx` (branché sur `/sponsoring/[id]` et, par un emplacement
optionnel de `CongressDetailView`, sur `/congress-national/[id]` — l'international ne change pas).
Migrations `20260806120000_sponsoring_items` puis `20260806140000_ad_pro_items`.

### Mobile — superposition, défilement et hauteurs

Trois défauts indépendants, un même symptôme (« les modules se superposent »).

1. **Échelle de superposition** — la barre d'onglets était à `z-60`, au-dessus des feuilles et
   tiroirs (`z-50`). L'échelle est désormais écrite dans `globals.css` : en-tête 30, barre
   d'onglets **40**, modales **50**, tiroir « Tout » 60, courrier 90, palette 100, pop-up 200.
   Toute nouvelle couche modale se place à 50 et ne descend jamais en dessous.
2. **Verrou de défilement** — `lib/use-scroll-lock.ts`. Le code figeait `document.body` ; or la
   coque est `h-screen overflow-hidden` et le conteneur défilant est le `<main>` (`id="app-scroll"`).
   Le verrou était donc **sans effet**. Il est maintenant **compté** (une feuille ouverte depuis un
   tiroir ne rend pas le défilement au tiroir en se refermant) et branché sur les six couches
   modales. Pas de `position: fixed` sur le body : cette astuce fait sauter la page en haut à la
   fermeture.
3. **Hauteurs mesurées** — `components/layout/chrome-metrics.tsx` publie `--app-chrome-top`
   (bandeaux + en-tête) et `--app-chrome-bottom` (barre d'onglets) par `ResizeObserver`. Les
   utilitaires `.app-viewport` / `.app-viewport-flush` s'en servent. Mesurées et non écrites, pour
   deux raisons qu'une constante ne couvre pas : les bandeaux **passent à la ligne** sur un écran
   étroit, et la barre d'onglets est `display: none` sur ordinateur — mesurée, elle vaut alors 0,
   sans règle média supplémentaire à maintenir. Écrans concernés : assistant, messagerie, éditeur
   Office.

### Analyseur CTD — réserves ANPP, corpus et coût

Trois manques structurels de l'analyseur : il ne se souvenait pas de ce que l'agence nous avait
déjà reproché, il ne savait pas sur quels textes il s'appuyait, et personne ne voyait ce qu'il
coûtait. Voici comment chacun est traité — et surtout **où sont les limites**.

#### 1. Bibliothèque des réserves ANPP — la mémoire du service

Écran `/regulatory/enregistrement/reserves` (permission `regulatory.reserve.manage`).

| Étape | Fichier | Règle exacte |
|---|---|---|
| Import d'une lettre | `reserves/library-ingest.ts` → `ingestReserveDocument` | Texte natif → OCR → **vision** (pages rastérisées). Dédoublonnage sur `sha256` : réimporter la même lettre ne coûte rien. |
| Extraction des points | `reserves/library-extract.ts` | Schéma JSON **strict**. Une réserve **sans verbatim est jetée** — sans la citation exacte, on ne pourrait rien opposer. En vision, la consigne dit explicitement que **l'image fait foi**, pas l'OCR. |
| Recherche de précédents | `reserves/library.ts` → `findSimilarReserves` | `GREATEST(ts_rank français, similarité trigrammes)`, seuil 0,02. Filtres DCI / fournisseur / section CTD. |
| Réponse qui a marché | `bestHistoricalResponse` | Renvoie l'acceptée **et** les réitérées : savoir ce qui a échoué vaut autant que savoir ce qui a réussi. |
| Score de risque | `reserveRisk` | Explicable : `reasons[]` dit *pourquoi*. Ce n'est **pas** une prédiction de la décision de l'ANPP, et l'écran l'écrit. |

**La frontière entre apprendre et décider.** `proposeRules` repère un reproche revenu ≥ 3 fois et
propose une règle au statut `PROPOSED`. Elle est **inerte** : seule `validateDerivedRule` (humain
autorisé, audité) la fait passer à `VALIDATED`, et `activeDerivedRules` ne renvoie que celles-là.
`ruleConfidence` **sature à 0,9** — une observation, si répétée soit-elle, ne devient jamais une
règle de droit.

#### 2. Constats défendables

Champs ajoutés à `RegulatoryFinding` : `ruleRef`, `confidence`, `page`, `excerpt`,
`conflictingValues[]`, `recommendation`, `similarReserveIds[]`, `reserveRisk`.

- `findings/enrich.ts` → `enrichVersionFindings` est appelé **après** la persistance des constats
  (jobs `RULES` et `AI_REVIEW`), **hors transaction** et sans jamais lever : un échec
  d'enrichissement laisse l'analyse complète, il ne la perd pas.
- `findingQuality` (pure, testée) note un constat sur 6 éléments et dit `defensible` uniquement si
  on peut **montrer la pièce** (règle + document + page + extrait). L'écran affiche ce qui manque :
  découvrir qu'un constat n'était pas étayé doit se faire ici, pas en séance.
- ⚠️ Un précédent ANPP est attaché **comme précédent**. Il n'aggrave jamais automatiquement la
  sévérité et ne crée aucun blocage.

#### 3. Corpus réglementaire et veille ANPP

Écran `/regulatory/enregistrement/corpus` (`regulatory.corpus.view` / `.manage`).

- `corpus/catalog.ts` — 43 sources, chacune marquée `ingestible` (faux = sous licence) et `binding`
  (faux = projet non opposable). `FIRST_WAVE` = les 10 qui suffisent à analyser un dossier algérien.
- `corpus/fetch-source.ts` — PDF direct, DOCX, ou page HTML dont on **suit le lien « Télécharger »**
  (sinon on indexerait un menu de site au lieu d'une ligne directrice). Rejette un contenu < 500
  caractères. Fonctions pures testées : `findPdfLink`, `extOf`, `htmlToText`.
- `corpus/ingest-catalog.ts` — l'**empreinte décide** : contenu identique ⇒ rien n'est créé. Sinon
  une nouvelle version **au statut `DRAFT`**, pointant vers celle qu'elle remplace. Rien ne devient
  opposable sans activation humaine.
- `corpus/watch-schedule.ts` → `runAnppWatchIfDue` — relevé **quotidien** des pages de publication
  ANPP, branché sur `runScheduledJobs`. Idempotent sans nouvelle table (le dernier passage se lit
  dans le journal d'audit `CORPUS_WATCHED`). En cas de changement, **notification** aux détenteurs
  de `regulatory.corpus.manage`. La veille **signale**, elle n'ingère rien : décider qu'un texte
  fait foi reste un acte humain. Désactivable par `REG_ANPP_WATCH=0`.
- ⚠️ **Licences** : la Ph. Eur. de l'EDQM et les ouvrages sous droits sont *référencés*, jamais
  téléchargés ni stockés. La vérification est faite **deux fois** (catalogue + ingestion) : c'est
  une limite juridique, pas une préférence.

#### 4. Coût — voir, réutiliser, plafonner

`cost/ledger.ts`, restitué dans la carte « Coût de l'analyse IA » de l'écran dossier.

1. **Voir** : chaque appel est tracé au **dossier**, à l'**étape** et au **fichier**. Un total
   global ne se corrige pas ; une étape ou un fichier, si.
2. **Ne pas repayer** : `cacheKeyOf` = SHA-256 de (étape + modèle + consigne + contenu + schéma +
   empreinte des images). Un fichier inchangé entre la V1 et la V2 d'un dossier est **relu, pas
   racheté**.
3. **S'arrêter** : `budgetState` refuse l'appel **avant** de dépenser quand le plafond du dossier
   (ou `CTD_BUDGET_USD_DEFAULT`) est atteint — et l'écran le dit, plutôt que de laisser filer la
   facture en silence.

**Analyse différée (moitié prix)** — `cost/batch-runner.ts`. Le fournisseur facture deux fois moins
cher ce qu'on accepte d'attendre (≤ 24 h). Sans intérêt pour une analyse qu'on regarde tout de
suite ; décisif pour une **réanalyse complète**. Le choix reste explicite à l'écran, avec le prix
et le délai. Trois garde-fous : le budget est vérifié **avant** dépôt (estimation, refus motivé) ;
`processedAt` garantit qu'un lot n'est traité **qu'une fois** ; les constats restent des **PROJETS**
non bloquants — différer une analyse ne lui donne pas plus d'autorité. Le prompt, la consigne et la
validation sont **les mêmes fonctions** que la voie immédiate (`buildPrompt`, `SYSTEM_PROMPT`,
`parseReviewOutput`) : sans cela, « moitié prix » finirait par vouloir dire « moins bien ».

#### 5. Couverture INTÉGRALE, documents géants, examen visuel

Quatre plafonds silencieux ont été supprimés — silencieux au sens propre : ils écartaient du
contenu **sans que rien ne distingue « analysé » de « analysé à 8 % »**. Un dossier réglementaire
à moitié lu qui a l'air complet est pire qu'un dossier non analysé : on s'y fie.

| Ancien plafond | Aujourd'hui | Ce qui le rendait nécessaire |
|---|---|---|
| `REG_AI_MAX_CHUNKS` = 120 parts (~1 200 pages) | **0 = intégral** | Rien : c'était un garde-fou de coût aveugle. Le coût est désormais tenu par le **plafond budgétaire du dossier**, qui refuse l'appel avant la dépense et le dit. |
| `REG_OCR_MAX_PAGES` = 25 pages | **0 = illimité** | La rastérisation gardait **toutes** les pages en mémoire. Elle est maintenant **en flux** (`rasterizePdfStream`) : une page vit à la fois. |
| Vision = 60 pages | **0 = tout le document** | Même cause, même correction. |
| `REG_MAX_PROCESS_MB` = 1 Go (bridé à 4) | **8 Go par défaut, réglable à 200** | Idem — ne reste que la taille du fichier lui-même, que mupdf ouvre d'un bloc. |

- **`rasterizePdfStream`** est la pièce maîtresse : chaque page est rendue, remise à l'appelant,
  puis **relâchée**. La mémoire ne dépend plus du nombre de pages mais de la plus grande d'entre
  elles. `onPage` est attendu avant de rendre la suivante — sans ce `await`, la file d'attente
  reconstituerait exactement le tas qu'on vient de supprimer.
- **Toute troncature restante se DIT** : plafond budgétaire atteint, lot refusé, page corrompue —
  chacun apparaît en clair dans le journal (« ⚠ ANALYSE INCOMPLÈTE … le reste n'a PAS été lu »).
- ⚠️ **Limite réelle restante** : un fichier UNIQUE doit tenir en mémoire pour être ouvert. Un
  *dossier* de plusieurs dizaines de Go passe sans difficulté (les fichiers sont traités un par
  un) ; un *fichier* de 10 Go dépend de la RAM de l'instance. C'est la machine qui décide, plus un
  réglage — et quand elle ne suffit pas, le message dit la taille, le seuil et quoi faire.

**Job `VISION` — ce que le texte ne dira jamais.** Le module de lecture des figures existait mais
n'était **appelé par personne** (référencé uniquement par son propre test). Il est branché, et
porte désormais **deux** questions posées à la même image dans le même appel — rastériser et
transmettre les pages est le vrai coût, y ajouter une seconde question est quasi gratuit :

1. **les figures** — courbes de stabilité, chromatogrammes, profils de dissolution, schémas de
   procédé. Les `concerns` deviennent des constats sourcés (page + valeurs lues) ;
2. **la FORME de la pièce** — `CAPTURE_ECRAN`, `PHOTO_ECRAN`, `PHOTO_DOCUMENT`, `SCAN_ILLISIBLE`,
   `PAGE_TRONQUEE`, `PAGE_DE_TRAVERS`, `FILIGRANE_BROUILLON`, `SIGNATURE_ABSENTE`, `TAMPON_ABSENT`,
   `MENTION_ILLISIBLE`. **Aucun de ces défauts n'existe dans le texte** : l'OCR d'une capture
   d'écran rend un texte parfaitement propre. Capture d'écran, photo d'écran et filigrane
   « brouillon » sont `CRITICAL` — ils ne se corrigent pas par une explication, il faut la pièce
   authentique. Un défaut **sans constat visuel est écarté** (« c'est une capture d'écran » sans
   dire à quoi on le voit ferait recaler une pièce valable sur une intuition).

#### 6. Coût réel — l'écart qui a été corrigé

⚠️ La revue de fond/forme passait par `askClaudeCheap`, qui **n'écrit rien** dans
`RegulatoryAiCall`. Deux conséquences invisibles depuis l'écran : la carte « Coût de l'analyse IA »
montrait tout **sauf** l'analyse, et le plafond par dossier — qui s'appuie sur cette même table —
**ne plafonnait rien**. On pouvait croire un budget tenu alors qu'il était dépassé d'un ordre de
grandeur.

`agents/review-ai.ts` → `lunaReviewFn` route désormais chaque part par `trackedLuna` : **cache**
(une part inchangée d'une version à l'autre est relue, pas rachetée), **plafond** (refus AVANT la
dépense, et l'analyse s'arrête au lieu de creuser un trou silencieux) et **traçabilité** au fichier
près. Repli sur Claude si la clé OpenAI manque — un filet, pas un choix de qualité.

**Analyse IMMÉDIATE par défaut.** Le différé (Batch) coûte deux fois moins cher mais fait attendre
les constats jusqu'à 24 h — et pendant ce temps l'écran montre un dossier « en revue » amputé de sa
partie la plus exigeante. Découvrir après coup qu'on a lu une analyse incomplète coûte bien plus
cher que l'écart de prix : **on paie plein tarif et on voit tout de suite**. Le différé reste
disponible **sur demande** (bouton « Réanalyser à moitié prix » de l'écran dossier) et redevient le
défaut avec `REG_AI_BATCH=1`, pour une réanalyse massive lancée le soir. Quand il est utilisé, la
voie Batch couvre la version **entière** : le fournisseur borne un lot à 400 requêtes — contrainte
de transport, pas raison de lire un dossier à moitié — on dépose donc **autant de lots que
nécessaire**, chacun suivi séparément, chacun avec **sa propre** table de correspondance (deux lots
partageant la même créeraient les constats en double).

Ordres de grandeur, part ≈ 10 pages ≈ 7 000 jetons d'entrée :

| Dossier | Parts | **Immédiat (défaut)** | Batch (sur demande) |
|---|---|---|---|
| 1 200 pages | 120 | **~0,35 $** | ~0,17 $ |
| 15 000 pages | 1 500 | **~4,30 $** | ~2,15 $ |

#### 7. Référentiels cités

La consigne d'analyse confronte le document à trois corpus, et demande de **citer** celui qui
fonde chaque constat (`ruleRef`) : **Algérie** (exigences ANPP, module 1 algérien, langue,
légalisation, CPP, GMP, notice FR/AR — **prioritaire en cas de divergence**), **ICH** (M4/M4Q/M4S/M4E,
Q1A(R2), Q2(R2), Q3A/B/C/D, Q6A, Q8/Q9/Q10, Q11, M9, E6) et **UE** (2001/83/CE annexe I, lignes
directrices EMA, Ph. Eur. — citée, jamais recopiée). La **zone climatique II** est explicitement
demandée : des données de stabilité produites en zone I ne suffisent pas à justifier la durée de
conservation revendiquée.

#### 8. Modèle et environnement

`lib/openai-luna.ts` — `gpt-5.6-luna` (multimodal texte + image, sorties JSON strictes, Batch ×0,5).
Variables : `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `CTD_MODEL_CHEAP`, `CTD_BUDGET_USD_DEFAULT`,
`REG_ANPP_WATCH`, `REG_AI_BATCH`, `REG_AI_MAX_CHUNKS`, `REG_OCR_MAX_PAGES`, `REG_MAX_PROCESS_MB`,
`REG_VISION`.

⚠️ **Le corpus réglementaire ne peut pas être téléchargé depuis un environnement de développement**
(le proxy refuse `anpp.dz`, `database.ich.org`, `who.int`, `ema.europa.eu`). L'ingestion doit être
lancée **depuis l'application déployée**, bouton « Ingérer la 1ʳᵉ vague » de
`/regulatory/enregistrement/corpus`.

#### 9. Pages exactes, escalade, sémantique, livrables (« god mode »)

**Pages exactes + clic-vers-la-preuve.** Le texte extrait n'est plus un ruban anonyme : une
**carte des pages** (`RegulatoryExtraction.pageMap` = position du début de chaque page) est
construite au moment de l'extraction (native mupdf par page **et** OCR) et jamais retaillée —
retailler décalerait toutes les positions. Chaque part d'analyse porte ses offsets réels →
intervalle de pages **exact** ; et pour chaque constat, la citation (`evidence`) est **recherchée
dans le texte** (`anchorEvidence`, insensible aux espaces/casse) : la page retrouvée **PRIME**
l'estimation du modèle, et une preuve introuvable rend `null` — jamais une page inventée. À
l'écran, la page est un **lien** qui ouvre le PDF au bon endroit (`?inline=1#page=N`). Constats
redessinés : groupés par gravité avec compteurs, liseré de couleur, badge DÉFENDABLE, citation en
exergue.

**Escalade éco → qualité** (`agents/escalate.ts`). Une section sortie en CRITIQUE du balayage
économique déclenche **automatiquement** les agents spécialistes dont le périmètre la couvre —
c'est le geste d'un vrai évaluateur : insister là où ça fait mal. Garde-fous : CRITIQUE seulement,
un agent ne repasse jamais, **4 agents max** par version (au-delà c'est une réanalyse déguisée —
décision humaine), `REG_AGENT_AUTO=0` pour couper. Ne lève jamais. Et quand une analyse différée
se termine **sans demandeur identifiable**, les rôles superviseurs (réglage
`regulatorySupervisorRoles` + SUPER_ADMIN) sont notifiés — un résultat que personne ne lit n'existe
pas. L'écran garde les deux voies explicites — « Résultats maintenant (plein tarif) » (job
`payload {mode:"immediate"}`, qui l'emporte toujours) et « Réanalyser à moitié prix (sous 24 h) » —
la voie immédiate étant désormais **celle par défaut**.

**Recherche sémantique hybride** (`corpus/semantic.ts`). Le corpus est largement en anglais, les
requêtes en français : « durée de conservation » ne matchera jamais « shelf life » en plein-texte.
Embeddings 512 dim (`lunaEmbed`, `text-embedding-3-small`) sur sections ACTIVES du corpus +
réserves ANPP, stockés en JSONB (pas de pgvector : cosinus en mémoire sur quelques milliers de
vecteurs = millisecondes), cache de processus estampillé par (nombre, dernière activation),
rattrapage borné (96/passage) par le planificateur. `searchCorpus` fusionne lexical ∪ sémantique
(`mergeHybrid` : normalisation par voie + bonus de convergence 0,15). **Jamais bloquant** : sans
clé ni vecteurs, le lexical continue seul.

**Livrables** : rapport de constats **.docx** (gravité, preuves, pages, recommandations — bouton
sur la carte Constats) et **lettre de réponse aux réserves** .docx par cycle (verbatim ANPP mot à
mot + réponse approuvée/brouillon/`[À COMPLÉTER]` — jamais d'invention), tous deux stockés
chiffrés + audités (`docgen/reports.ts`). **Verdict GO / NO-GO** en tête
de dossier : bloqueur ou critique ouvert → NO-GO ; majeur ouvert ou complétude < 100 % → GO sous
conditions ; sinon GO — avec les **réserves les plus probables** (précédents `reserveRisk` quand
ils existent, sinon la gravité, marquée `*` — jamais un pourcentage inventé présenté comme
mesuré). **Notice en arabe** (`rules/notice-arabic.ts`) : obligation algérienne (décret n° 92-286)
— un document 1.3.x (hors RCP 1.3.1) au texte natif presque sans caractères arabes → constat
MAJEUR ; l'OCR n'est **jamais** jugé (le latin massacre l'arabe, on n'accuse pas sur une lecture
ratée). **Constat → tâche** : un clic crée une tâche personnelle (« Mon espace ») portant détail,
preuve, page et lien — anti-doublon inclus.

#### 10. Entraînement de l'IA — l'école de l'analyseur (Super Admin)

Écran `/regulatory/enregistrement/entrainement`, onglet « Entraînement IA » (SUPER ADMIN
uniquement, transverse aux entités). L'analyseur apprend par **quatre canaux**, tous visibles sur
le tableau d'expertise : le **corpus** (les règles), les **réserves ANPP** historiques (les
reproches), les **règles dérivées** validées, et les **études de cas** — le canal qu'apporte ce
module : un produit PASSÉ, son dossier, son **issue réelle** (accepté / accepté avec réserves /
rejeté) et la **leçon retenue** en une phrase.

- **Déposer suffit** (mêmes gestes que le corpus) : chaque pièce est extraite, repérée par
  section CTD (déterministe, zéro coût IA), dédupliquée par empreinte **par étude de cas**.
- **Injection dans TOUTES les analyses** (immédiate ET différée) : `experienceForSection`
  sélectionne ≤ 3 précédents par section — correspondance de section d'abord, puis les issues
  **instructives** (réserves/rejet) devant, dédupliqués par empreinte — injectés dans le prompt
  comme bloc « EXPÉRIENCE INTERNE » avec l'issue et la leçon.
- ⚠️ **La frontière qui rend l'apprentissage sûr** : un précédent CALIBRE la sévérité et
  ANTICIPE les réserves probables ; il ne fonde **jamais** un `ruleRef` (consigne explicite,
  testée) — seuls les textes du corpus font règle. Pas de « fine-tuning » du modèle : la
  connaissance vit en base, citée mot à mot, retirable à tout instant — fiable et auditable.
- Vecteurs sémantiques rattrapés par le planificateur (`embedBacklog`), couverture affichée.

### RH — quatre écrans, et les questions du quotidien

Le module était **une page à sept sections** : on y trouvait tout, sauf vite. Désormais :

| Écran | Route | Ce qu'on y fait |
|---|---|---|
| **À traiter** | `/rh` | Ce qui attend une décision : demandes RH, congés, avances, contrats à échéance. |
| **Équipe** | `/rh/equipe` | L'annuaire **cherchable** + la répartition de l'effectif (camembert). |
| **Congés** | `/rh/conges` | L'état de l'équipe **maintenant** + l'historique des décisions. |
| **Départements** | `/rh/departements` | La structure (hiérarchie, responsables, rattachements). |

**Sur le fond** — `lib/queries/hr-pulse.ts` (`getHrPulse`) répond à ce que le module ignorait :

- **qui est absent aujourd'hui** (nombre sur l'effectif, motif, date de retour) — LA question
  quotidienne d'un service RH ;
- **qui part dans les 14 jours** : anticiper au lieu de constater ;
- **les échéances qu'on oublie** : fin de **période d'essai** (la renouvelée prime) et fin de
  contrat sous 60 jours, côte à côte — laisser filer une fin d'essai a des conséquences
  juridiques ;
- **les soldes de congés** les plus élevés : ce qui risque d'être reporté ou perdu ;
- **la recherche** dans l'annuaire (nom, poste, département, e-mail, téléphone — un seul champ,
  filtrage local, réponse à la frappe).

Salaire et masse salariale restent réservés aux comptes qui **valident**, comme partout ailleurs.

### Mobile — l'écran respire

Sur 375 px, chaque carte mangeait ~32 px en marges, bordures et arrondis : l'application
paraissait « boxée » au lieu de native.

- Les cartes de **premier niveau** passent **bord à bord** sur téléphone (ni bordure latérale,
  ni arrondi sur les côtés) ; les cartes **imbriquées** gardent leur cadre — c'est lui qui montre
  l'imbrication. Porté par une seule classe `page-shell` sur le conteneur de page
  (`app/(app)/layout.tsx` + `globals.css`), donc aucun composant à retoucher un par un.
- Un tableau qui déborde défile **bord à bord** ; marges de page 16 → 12 px ; ombres allégées ;
  titres compacts ; `text-size-adjust: 100%` (iOS n'agrandit plus le texte en paysage).
- **Les tiroirs deviennent des feuilles** : sur téléphone, `<Sheet>` monte du bas, arrondi en
  haut, avec une poignée, et s'arrête à 95 % de la hauteur pour qu'on voie ce qu'il y a derrière.
  Sur ordinateur, rien ne change.

### Frontière client / serveur (règle de compilation)

Un composant `"use client"` est compilé **pour le navigateur**. S'il importe — même
indirectement — un module qui lit des fichiers (`fs`, `zlib`…), la compilation de production
échoue avec **« Module not found: Can't resolve 'fs' »**. Le typecheck ne le voit pas, et un
`npm run build` local peut le rater à cause du cache `.next`.

- Les **actions serveur** (`"use server"`) ne comptent pas : Next.js les remplace par un appel
  distant. Un composant client peut les appeler librement.
- Pattern appliqué dans le code : les fonctions **pures** vivent dans un module dédié sans
  dépendance lourde — `src/lib/market/text.ts` (normalisation) et `galenic.ts` (molécule,
  dosage, forme) — tandis que `molecule.ts`, qui **lit les données**, les réexporte pour les
  modules serveur. L'explorateur de produits importe donc `galenic`, jamais `molecule`.
- **`src/lib/client-bundle-guard.test.ts`** remonte les chaînes d'import de chaque composant
  client et fait échouer `npm test` en affichant le chemin fautif, module par module.

### Graphiques — une seule palette, vérifiée

Tous les graphiques de la plateforme partagent les mêmes primitives (`src/components/charts/` :
`Donut`, `Trend`, `Bars`, `Meter`) et la **même palette catégorielle**, définie une fois dans
`palette.ts`.

- L'**ordre des teintes n'est pas décoratif** : il a été vérifié par l'outil de validation —
  écart CVD ≥ 8 sur toutes les paires voisines, écart en vision normale ≥ 15, sur le fond
  **blanc réel** de nos cartes. Ne pas réordonner.
- Trois teintes passent sous 3:1 de contraste sur blanc → règle tenue partout : **jamais la
  couleur seule**. Chaque part est reprise dans une **légende chiffrée** (qui vaut vue
  tabulaire) et décrite dans son `<title>` (info-bulle native, accessible).
- Au-delà de **6 catégories**, `foldTail` replie la queue dans « Autres » — on n'invente
  jamais une 7ᵉ teinte, indistinguable d'une existante en vision daltonienne.
- **Un seul axe** par graphique (jamais deux échelles), écart de 2 px entre tranches, marques
  fines, grille discrète. Composants **serveur** : aucun JS envoyé au navigateur.

### Intelligence marché — la maille MOLÉCULE

On cherche **par la case que l'on remplit** : **molécule**, **nom de produit**, ou
**laboratoire** (les trois se cumulent). Remplir la molécule débloque en plus l'**analyse
concurrentielle** — c'est la seule maille qui a un sens pour comparer des acteurs entre eux.

Une molécule, au sens métier, est un **triplet molécule + dosage + forme** : l'amoxicilline
500 mg gélule et l'amoxicilline 1 g injectable ne s'affrontent pas sur le même marché.

**Ce que l'analyse répond** (`src/lib/market/molecule.ts` → `analyzeMolecule`) :
- le **poids du marché** (valeur DZD/USD, volume, nombre d'acteurs) ;
- le **marché adressable** : part **ville** et part **hôpital** en %, avec les acteurs de chaque côté ;
- les **parts de marché** de chaque laboratoire, le leader, la **concentration** (HHI : > 2500 = concentré) ;
- qui est **enregistré** à la nomenclature, et surtout s'il **fabrique en Algérie ou importe** ;
- les **dosages et formes réellement présents**, pour affiner la recherche.

**Le vrai travail : réconcilier trois sources qui n'écrivent rien pareil.**

| Normalisation | Ce qu'elle résout |
|---|---|
| `moleculeStem` / `moleculeMatches` | « AMOXICILLIN » (IQVIA, anglais) ≡ « AMOXICILLINE TRIHYDRATÉE EXPRIMÉE EN AMOXICILLINE » (nomenclature). Les **sels** et l'hydratation ne font pas une molécule différente. Une association demandée exige **tous** ses composants. |
| `canonicalForm` | Décode les présentations abrégées d'IQVIA (`PD.SAC`, `P/SUS`, `FL+SOLV`, `STYL PRE REM`…). Formes non reconnues : **32,6 % → 3,8 %** de la valeur du marché. Stylos et seringues préremplies = **injectables** (c'est ainsi qu'ils s'achètent) ; bandelettes et lecteurs = **dispositifs**, pas des médicaments. L'ordre des règles est la règle métier (`GELULE` avant `GEL`, `PERFUSION` avant `INJECTABLE`). |
| `extractDosage` / `dosageMatches` | « CP.PE 875MG/ 125 MG 10 » → `875MG/125MG`. Renvoie `null` plutôt que d'inventer. |
| `labKey` | « SAIDAL » ≡ « GROUPE SAIDAL » ≡ « EPE / SPA GROUPE SAIDAL » — sans quoi le même acteur apparaissait trois fois et son origine ne se rattachait à rien. |

Saisie **assistée** (`moleculeSuggestions`, `labSuggestions`) : on ne propose que ce qui existe
réellement dans les données, les plus gros marchés d'abord. Écran : `/business-development/marche/produits`.
Tests : `src/lib/market/molecule.test.ts` (20 tests, cas tirés des données réelles).

### PCH — un appel d'offres lu par l'IA devient un tableau Excel

Téléverser le document suffit : **lecture (le texte du fichier d'abord, l'OCR seulement quand il
manque) → extraction IA des produits → enrichissement automatique de chaque ligne** par
l'intelligence marché. Avant, il fallait cliquer « Enrichir »
ligne par ligne — sur un marché de quarante produits, personne ne le faisait.

- **Nature de l'unité demandée** (`unitLabel`) : un appel d'offres ne parle pas toujours de
  comprimés — flacon, ampoule, seringue, poche, sachet. C'est ce mot qui donne son sens à la
  quantité ; sans lui on compare des flacons à des comprimés.
- **Analyse de marché par ligne** (`enrichLineById` → `analyzeMolecule`) : taille du marché,
  nombre d'acteurs, partage **ville / hôpital** en %, principaux concurrents avec leur part,
  concentration, et **production locale ou importée**. L'origine est **pondérée par le poids
  des acteurs**, pas par leur nombre : un marché à 80 % importé reste importé même s'il compte
  dix petits fabricants locaux (`dominantOrigin`).
- **Enrichir tout** (`enrichAllTenderLines`) rejoue l'analyse sur l'ensemble des lignes.
- **Export Excel** (`/api/pch/export?id=…`, `src/lib/pch-tender-export.ts`) — deux feuilles :
  - *Produits demandés* : désignation, molécule, dosage, forme, **unité demandée**, quantité,
    conditionnement, **boîtes à fournir** (arrondi au **supérieur** — on ne livre pas une
    demi-boîte), prix de référence verrouillé sur les réceptions PCH, valeur du marché à ce
    prix, et notre position ;
  - *Analyse de marché* : taille, concurrents, ville/hôpital, concentration, principaux
    acteurs, production locale ou importée.
  Les colonnes sans donnée **restent vides** : pas de demi-vérité dans le fichier qui sert à
  chiffrer une offre. Tests : `src/lib/pch-tender-export.test.ts` (11 tests).

### Pièces jointes (pattern standard)

Téléversement **en lot** (plusieurs fichiers **ou un dossier entier**, tous types sauf exécutables,
**sans limite de nombre**, **en parallèle**) : composant `components/documents/document-upload.tsx` →
route en flux `POST /api/documents/upload` → `persistUploadedDocument` (`src/lib/documents.ts`), logique
partagée avec l'action serveur historique `uploadDocument` (compat).

```ts
const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
// persistUploadedDocument(userId, { entityType, entityId, category, confidentiality, stepKey, file, maxUploadMb })
//   → validateDocumentUpload(name, size, maxMb)  (bloque seulement les exécutables ; taille réglable)
//   → clé `${ENTITY}/${id}/${randomUUID()}__${name}` ; saveFile(key, buffer) en try/catch (métadonnées quand même)
//   → prisma.document.create({ name, category, entityType, entityId, stepKey, fileKey, mimeType, sizeBytes, version, confidentiality, uploadedById })
```
Téléchargement : `/api/documents/[id]?dl=1`. Le **Drive** utilise un stockage distinct (`putBlob`/`getBlob`/`releaseBlob`
— blobs chiffrés dédupliqués + `FileVersion`). La fiche de paie utilise `EmployeeDocument` (blob Drive + `period`).

### Budgets par département — trois natures, trois responsables

Écran `/budgets/departements`. Le modèle porte **une ligne par (département, année, NATURE)** :

| Nature | Ce que ça couvre | Qui la règle |
|---|---|---|
| `OPERATING` | **Moyens généraux** — fournitures, prestations, déplacements | **Le directeur du département** (responsable ou adjoint dans l'organigramme) + l'administrateur |
| `HR` | **Masse salariale** — employés, charges, recrutement | **Les ressources humaines** (`RH:UPDATE`), exclusivement |
| `ACTIVITY` | **Budget métier** — Ad & Pro au marketing, paiement des BV au Regulatory… | **Le directeur du département** + l'administrateur (listes d'accès **séparées** de celles des moyens généraux) |
| `TRAINING` | **Budget formation** — montée en compétence de l'équipe | Les RH, doté par l'administration |

**Personne ne s'accorde son propre budget.** Une **dotation** (montant initial) ou une **rallonge**
se DEMANDE (`DepartmentBudgetRequest`) et l'administration tranche — c'est ce qui rend vérifiable
« budget fixé par les RH, validé par l'administration » au lieu d'en faire un usage. Une dotation
initiale est une rallonge partant de zéro : même geste, même circuit. Un montant accordé
**s'ajoute** au budget en cours (le remplacer effacerait silencieusement la dotation précédente).

**La consommation est réelle**, pas déduite : chaque dépense s'impute via
`DepartmentBudgetExpense`, avec sa **facture ou son bon de paiement** en pièce **obligatoire** —
sans pièce, une ligne de dépense n'est qu'une affirmation. La masse salariale fait exception : elle
se lit sur la **paie**, jamais saisie.

Le Super Admin règle les deux. **La séparation n'est pas cosmétique** : un directeur administratif n'a pas à
connaître la masse salariale pour accorder un budget de déplacement, et les RH n'ont pas à arbitrer les achats.
Comme les deux responsables **n'écrivent jamais la même ligne**, l'un ne peut pas écraser l'autre — la contrainte
`@@unique([departmentId, year, kind])` le rend structurellement impossible, avant même le contrôle applicatif, qui
vérifie le droit **par nature** (`canSetDepartmentBudget`).

- **Les deux colonnes sont CÔTE À CÔTE**, et une case non modifiable est **affichée en lecture** (cadenas) plutôt
  que masquée : c'est la seule façon de voir ce que coûte réellement un département. Ce qui est réservé, c'est
  l'écriture, pas la lecture. Qui règle quoi est **écrit à l'écran**, pas seulement appliqué en silence.
- **La masse salariale RÉELLE est calculée depuis la paie** de l'exercice (**coût employeur** de chaque ligne, repli brut + primes − retenues sur les mois d'avant ce champ — `hr/payroll-cost.ts`),
  jamais saisie — un montant ressaisi dirait ce qu'on espère, pas ce qui se passe.
- **Le fonctionnement n'a volontairement PAS de colonne de consommation** : aucune dépense n'est aujourd'hui
  imputée à un département, et un chiffre inventé ressemblerait à une mesure sans en être une. La page le dit.
- `budgetHealth` distingue **« pas de budget réglé »** (`UNSET`) de **« rien consommé »** — une absence de décision
  n'est pas une bonne nouvelle. Seuils : ≥ 80 % `AT_RISK`, ≥ 100 % `OVER_BUDGET`.
- Le tableau nomme les départements par leur **chemin complet** (« Commercial › Ville »), sans quoi deux
  sous-départements homonymes de deux pôles se confondraient. Il reste dans la **portée d'entité** en cours.
**QUI Y A ACCÈS — réglé par le Super Admin, et par lui seul.** Le socle par rôle vaut *partout* ; il manquait de
quoi dire « le responsable du Commercial règle le fonctionnement DE SON département », ni plus ni ailleurs.

- **Trois portées distinctes**, parce que ce ne sont pas les mêmes personnes : **consultation**, **édition du
  fonctionnement**, **édition des employés**. On peut consulter sans rien régler.
- **Une règle par département + une règle GÉNÉRALE** (`departmentId = null`) valable pour tous. Les deux se
  **cumulent** (union, jamais intersection : intersecter ferait d'une règle de département une *restriction* de la
  règle générale). Unicité de la règle générale garantie par un **index partiel** — en SQL deux `NULL` ne s'égalent
  pas, un `@unique` ordinaire laisserait créer dix règles générales contradictoires.
- **Les autorisations s'AJOUTENT, elles ne retranchent jamais.** Poser la première ne doit pas retirer aux RH le
  budget des employés par effet de bord, et un droit qui disparaît sans qu'on l'ait demandé se diagnostique très
  mal. Pour restreindre, c'est le **droit de module** qu'on revoit. L'écran le dit, plutôt que de le laisser
  découvrir.
- **La porte de l'écran** n'est plus `requireModule("BUDGETS")` mais « droit de module **OU** une autorisation
  quelconque » : sinon une personne autorisée sur un département mais sans le module serait refoulée à l'entrée, et
  son autorisation ne servirait à rien. Les lignes qu'on n'a pas le droit de voir sont **filtrées côté serveur** —
  le montant ne transite même pas jusqu'au navigateur.
- Le droit est **revérifié à l'écriture**, sur CE département : les règles affichées à l'ouverture ont pu changer.
- La liste des rôles proposés est **dérivée de `ROLE_LABELS`**, jamais recopiée — une liste écrite à la main finit
  par proposer un rôle qui n'existe plus, et une case cochée sur un rôle fantôme n'autorise personne sans que rien
  ne le signale.
- **Fichiers** : `src/lib/department-budget.ts` (+ `.test.ts`, 28 tests), `src/lib/queries/department-budget.ts`,
  `src/lib/actions/department-budget-actions.ts`, `src/app/(app)/budgets/departements/` (`page.tsx`,
  `department-budget-table.tsx`, `access-sheet.tsx`). Modèles `DepartmentBudget`, `DepartmentBudgetAccess`.

### Ad & Pro — corriger une demande, joindre un fichier à un avis

**Corriger une demande** (bouton « Modifier » sur les sept fiches du pôle — sponsoring, deux prises en charge,
événement, matériel promotionnel, consulting, autre demande). Deux règles portent tout le reste :

1. **Ce qui a fondé une décision ne se réécrit pas.** Une fois la demande tranchée (`isAdProDecided`), le demandeur ne modifie
   plus : réécrire « 200 000 demandés » en « 400 000 » après un accord transformerait la décision en autre chose
   que ce qui a été décidé. Seule la **vue globale** garde la main — et l'audit note explicitement
   « **APRÈS DÉCISION** ». Avant décision : le demandeur, ou le droit `UPDATE` du module.
2. **Les champs de décision ne sont jamais modifiables ici** (montant accordé, statut, Direction Marketing, avis,
   motifs) : ils appartiennent au circuit. D'où une **LISTE BLANCHE** (`EDITABLE_FIELDS`) plutôt qu'une liste
   d'interdits — elle ne se trompe pas quand un champ nouveau apparaît dans le modèle. Le `select` de la requête
   **ET** le formulaire en sont dérivés : le formulaire ne peut pas afficher un champ que le serveur refuserait.

Le point d'entrée est **unique pour les sept natures** ; ce qui varie (table, module RBAC, chemin, colonne de
statut) tient dans la table `TARGETS`. L'audit consigne **ce qui CHANGE** (avant → après), pas l'état final :
relire « ville : Alger » n'apprend rien, « ville : Oran → Alger » dit ce qui s'est passé. Les comparaisons ignorent
les espaces de bordure et l'heure d'une date, sans quoi le journal se remplirait de non-modifications.

**Pièce jointe à un avis.** La Direction Marketing, le National Sales et la Direction peuvent joindre un document à leur
décision (devis comparatif, note, courrier), **à toutes les issues** — y compris un simple commentaire. **L'ordre
des opérations porte la garantie** : les fichiers sont **contrôlés avant** que le circuit n'avance (enregistrer
l'avis puis refuser la pièce laisserait la décision prise et sa justification perdue), l'**étape courante est lue
avant** l'avancement (sinon la pièce serait rattachée à l'étape suivante, c'est-à-dire à quelqu'un d'autre), et
l'écriture n'a lieu qu'une fois le moteur ayant **autorisé** l'action. Catégorie `SUPPORTING_DOC`, `stepKey` = slug
de l'étape. Le contrôle sans écriture est extrait dans `validateAttachments` (`src/lib/attach-files.ts`).

- **Fichiers** : `src/lib/ad-pro-edit.ts` (+ `.test.ts`, 14 tests), `src/lib/queries/ad-pro-edit.ts`,
  `src/lib/actions/ad-pro-edit-actions.ts`, `src/components/ad-pro/edit-request-button.tsx` ;
  `src/lib/actions/workflow-actions.ts` (`advanceWorkflow`), `src/components/workflow/workflow-panel.tsx`.

### Assistant — recherche Regulatory complète et écriture sur les produits

- **`search_products` cherche là où les mots sont écrits** : DCI, nom commercial, référence, **classe
  thérapeutique** (« oncologie », « biosimilaire », « anticorps monoclonal »…), forme galénique, laboratoire
  partenaire, pays d'origine et entité. Sans la classe thérapeutique, ces recherches ne remontaient rien. La
  limite n'est plus figée (40 par défaut, **300** au plus) et la réponse dit le **total du portefeuille** et si
  elle est **tronquée** — omettre en silence serait pire que tronquer.
- **`set_products_company`** — seul outil d'écriture Regulatory : rattacher **un ou plusieurs** produits à une
  entité. Le lot est décrit par un **FILTRE**, jamais par une liste devinée, et ce filtre (`productBulkWhere`) est
  **partagé entre l'aperçu et l'exécution** — deux filtres écrits séparément finiraient par diverger, et on
  modifierait autre chose que ce qui a été montré. À l'exécution il est **intersecté avec les références
  affichées**, pour qu'un produit créé entre l'aperçu et le clic ne soit pas emporté. La confirmation **liste** les
  produits (25 puis « … et N autres ») plutôt qu'un compte. Droit vérifié : `REGULATORY:UPDATE` — écrire n'est pas
  lire — **revérifié à l'exécution**, jamais déduit de la proposition.
- **`MAX_TURNS = 16`** (contre 6) : lister tout le portefeuille consomme déjà plusieurs tours, et l'utilisateur
  recevait « je n'ai pas pu finaliser la demande » alors que l'assistant travaillait. Un tour ne coûte que s'il est
  utilisé — la boucle s'arrête dès que le modèle répond sans outil.

### Cloisonnement — entité, gamme, et ce que chacun voit

**Deux dimensions, pas une.** L'**entité** (société du groupe) dit *de qui* est un objet. La
**gamme** (`ProductRange`, propre à une entité) dit *de quoi* relève un produit. Elles se composent :
une gamme AFFINE l'entité, elle ne la remplace pas.

**Ce qui ouvre une entité** (`allowedCompanyIds`, pur, testé) : la société d'appartenance
(`Employee.companyId`), une autorisation nominative (`UserCompanyAccess`), **ou une gamme rattachée**
— une gamme ouvre son entité en lecture, sans quoi le rattachement n'ouvrirait rien. Le Super Admin
voit tout le groupe (`GROUP_WIDE_ROLES`) ; la Direction, non — ses accès inter-entités se saisissent.

**Ce qui restreint les produits** (`productRangeWhere`, pur, testé) : les gammes rattachées, **sauf**
celles dont l'entité est déjà ouverte en entier — on ne retire jamais un droit donné plus haut.
Composé côté serveur par `productRangeScope(userId)` dans `queries/regulatory-rows.ts` et
`queries/product-catalog.ts`.

**Le filtre d'entité des écrans** : `platformScope(userId)` — la portée du cookie **validée** contre les
droits, avec deux garde-fous (aucun filtre si le groupe n'a qu'une société ; aucun filtre pour qui ne relève
d'aucune entité, on n'aveugle personne par omission) —, composée en `AND` par `companyScopedWhere` (une LISTE,
lignes sans entité comprises) ou `ficheScopedWhere` (une FICHE ouverte par son lien : toutes les sociétés auxquelles
la personne a droit, §118.184). ⚠️ `currentCompanyWhere()` puis `currentCompanyWhereFor()` ont été **supprimés** : le
premier posait le cookie tel quel et, **sans cookie, ne filtrait rien** ; le second se laissait **étaler** dans un
`where` qui porte déjà un `OR`, et la portée métier disparaissait en silence.

**Le sélecteur** (`CompanySwitcher`) n'affiche un menu que si l'on a **plusieurs** entités ; sinon
il montre la sienne, sans choix. `setCompanyScope` **refuse** une entité hors droits et retombe sur
la portée légitime — jamais sur « toutes ».

**Écran** : `/admin/gammes` (Super Admin) — arbre entité › gammes › produits + rattachement des
personnes. Les produits sont ceux de Regulatory ; seuls ceux de l'entité de la gamme (ou sans
entité) sont éligibles. Supprimer une gamme **ne supprime aucun produit** (`SET NULL`).

---

### Accusés, verrous & confidentialité — règles éparses à ne pas casser

- Événements (`Event`) n'a **pas** de champ `updatedById` → le moteur de workflow le retire avant `update`.
- `PERMISSIONS` (rbac.ts) est exhaustif par rôle — tout nouveau rôle casse le typecheck tant qu'il n'a pas son entrée.
- Références séquentielles : `buildRef`/`createWithRetry` (`src/lib/refs.ts`) — jamais `count()+1`.
- Suppression d'une demande RH par les RH : corbeille par demande (`deleteHrRequest`) — le bouton employé de la
  fiche est réservé à la **fiche complète** et l'annonce clairement.
- La **dernière activité** admin = max(`UserSession.lastSeenAt` groupé, `User.lastSeenAt` heartbeat, `lastLoginAt`).

---

