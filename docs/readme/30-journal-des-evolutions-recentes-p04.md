### Trois modules retirés du service, et les factures rejoignent Legal (2026-09)

**Ventes, Commandes & logistique, Market Intelligence** sont retirés — décision de produit écrite
dans le code, valable pour TOUT LE MONDE, Super Admin compris. La garde est dans `getAccess` : un
module retiré n'entre pas dans l'accès effectif, donc `userCan` répond non partout d'un coup —
écrans, actions, API et outils d'Adam. Rien n'est supprimé ; une ligne retirée de
`lib/modules-retired.ts` les rend tels qu'ils étaient. **PCH et Explorateur produits restent.**

**Les factures ne sont plus un endroit.** Un premier lot les avait déplacées sous Legal, dans un
écran à elles ; c'était encore un second registre. Elles sont désormais des **documents légaux de
nature « facture »** (`LegalDocKind.INVOICE`), dans la même liste que les devis et les bons de
commande dont elles sont le dernier maillon — voir la section suivante.

### Finances : le Dashboard disparaît, la banque rejoint les paiements (2026-09)

Le module avait trois écrans ; il en a deux. Le **Dashboard** ne portait aucun geste : on y
regardait la trésorerie, puis on allait travailler ailleurs — un écran d'escale entre le menu et le
vrai écran.

- **« Paiements à faire » devient « Banque & paiements »** et reçoit le **solde de trésorerie**, le
  détail par compte et la demande d'actualisation. C'est au moment de décider ce qu'on paie qu'on
  veut voir ce qu'il y a en banque, pas deux écrans plus tôt. Le solde vient de `getFinanceData` —
  le MÊME calcul que la comptabilité, jamais un second.
- **Le cockpit du DAF** (dépenses hors ordres, masse salariale à provisionner, résultat mensuel) a
  rejoint la **Comptabilité** : c'est du travail de comptable, et il est désormais au-dessus du
  livre qu'il conduit à corriger. Les deux courbes et les compteurs du mois n'ont pas été relogés —
  ils n'étaient l'entrée d'aucun geste.
- **Cliquer « Finances » mène à « Banque & paiements »**. `/finances` reste servi par une
  redirection (notifications parties, liens copiés, favoris) et reste dans le `match` du menu, qui
  ne doit pas se désélectionner quand on y arrive.
- **« Demander l'actualisation des soldes » est réservé au SUPER ADMIN.** Le geste sonne chez tous
  les responsables Finances : ouvert à toute la direction, il devenait une sonnerie que plus
  personne n'écoutait. La règle tient en trois endroits — le bouton, l'action serveur
  (`requestTreasuryUpdate`) et l'opération d'Adam —, et c'est l'action qui REFUSE : un bouton masqué
  n'est pas un contrôle d'accès. `lib/actions/treasury-update-porte.test.ts`.

### « J'envoie ma demande de paiement, et je ne la vois plus » (2026-09)

Panne rapportée : le demandeur perd son dossier de vue dès qu'il l'a envoyé, et ne peut plus y
joindre de pièce. **Les droits n'y étaient pour rien** — la garde du dossier laisse entrer son
demandeur, l'action accepte sa pièce tant que le dossier n'est pas clos, et le bloc « Ajouter une
pièce » s'affiche. Ce qui manquait était une **porte**.

Les demandes de paiement n'ont plus d'entrée de menu (décision de 2026-08) : on les dépose depuis
« Demandes de validations », et le formulaire conduit sur la fiche du dossier. Mais cet écran-là ne
listait **aucune** demande de paiement, et le raccourci vers l'écran dédié avait été retiré du haut
de page. Une fois la fiche quittée, plus rien n'y ramenait : ni pour suivre l'instruction, ni pour
déposer la facture que les Finances réclament. Le demandeur voyait sa demande une fois, puis jamais.

**Un écran où l'on dépose doit montrer ce qu'on y a déposé.** « Mes demandes de paiement » revient
donc sur `/validations` — en BAS, sous les demandes de validation, et non en bannière au-dessus de
ce qu'on vient y faire (c'était le défaut de l'ancien raccourci). La section ne s'affiche que si
l'on a des demandes, et « Tout voir » mène à l'écran dédié avec sa file d'instruction.

La liste elle-même est **une seule fonction** (`lib/queries/my-payment-requests.ts`), servie par les
deux écrans : deux requêtes auraient fini par diverger, et l'on serait revenu au même endroit — une
demande visible ici, absente là. Elle ne filtre ni le statut ni l'origine : un dossier transmis,
en attente ou né d'un autre circuit appartient encore à son auteur.
`lib/actions/demande-paiement-visible-flow.test.ts` part du vrai formulaire et suit les quatre
maillons — l'envoi, la liste, la fiche, la pièce.

### « J'enregistre mon courrier, et la page est introuvable » (2026-09)

Panne rapportée : une assistante enregistre un pli, la fiche répond **404**, et le scan qu'elle
venait d'y joindre est **introuvable**. Trois défauts s'enchaînaient, et le premier les déclenche
tous.

1. **Un menu laissé vide n'est pas un choix.** Le champ « Entité concernée » s'ouvrait sur un choix
   vide dès qu'il y a plusieurs sociétés. Le noyau devait retomber sur l'entité du créateur, mais
   il testait `!== undefined` : un menu vide rend `null`, pas `undefined`, et le repli était sauté.
   Le courrier naissait **sans entité**. Même trou à la modification : corriger une date effaçait
   l'entité du pli. Règle unique désormais, pure et testée — `chosenCompanyId` dans
   `lib/company-access.ts` : choix explicite > entité déjà portée > entité du créateur.
2. **La liste et la fiche ne disaient pas la même chose.** La liste passe par `companyScopedWhere`,
   qui garde volontairement les lignes sans entité (« une ligne qu'on ne voit pas est une ligne
   qu'on ne peut pas rattacher »). La fiche appliquait le filtre STRICT `platformScope`, qui les
   exclut. Un pli visible au registre répondait donc 404 à l'ouverture. Même porte des deux côtés
   maintenant — et **même correction sur la fiche Legal**, qui avait exactement la même divergence.
3. **Les pièces jointes suivaient le filtre strict.** `canAccessEntity` (MAIL_ENTRY et
   LEGAL_DOCUMENT) gouverne le téléversement ET le téléchargement : le scan d'un courrier sans
   entité n'était plus atteignable par personne. Même porte que l'écran.

Le défaut ne se voyait **que chez une employée** : un rôle qui voit tout le groupe n'a aucun filtre
d'entité, donc la fiche s'ouvrait chez celui qui testait. À la création, l'entité est désormais
**pré-choisie et visible** dans le menu plutôt que devinée en silence. Aucune reprise de données :
la correction rend les plis déjà sans entité de nouveau lisibles et rattachables, et deviner leur
société aurait été plus faux que de les laisser à corriger à la main.
`lib/mail-register/courrier-visible-mais-404.test.ts` rejoue la panne depuis le vrai formulaire.

### Une facture EST un document légal de nature « facture » (2026-09)

La table `Invoice` a disparu. Legal tenait déjà la chaîne d'achat entière — devis → bon de commande
→ FACTURE → règlement : la nature `INVOICE` existait, le chaînage (`chainFromId`) la prévoyait,
l'envoi au règlement (`expenseOrderId`) ne marchait QUE sur elle, et le circuit des pièces réclamées
y versait déjà les factures acceptées. Deux tables décrivaient le même objet (§17).

**« Les factures » est une VUE, pas un écran** : `/legal?nature=INVOICE` prérremplit le filtre de
colonne « Nature », retirable d'un clic. `/finances/factures` redirige — les liens déjà envoyés
aboutissent toujours. Aucune entrée de navigation : lui en donner une recréerait l'écran séparé.

- **Ce que la facture ajoute au document légal** : `direction` (reçue = on paie / émise = on
  encaisse), `paidDate` (le règlement), `settlementTxId` (l'écriture d'un règlement saisi
  directement). `number → reference`, `issueDate → startDate`, `dueDate → endDate` ;
  `recipient`/`payer` se réduisent à `counterparty` — l'un des deux est toujours nous.
- **L'état de règlement se DÉDUIT, en trois valeurs** (`lib/labels.ts` → `settlementState`) :
  *réglée* / *en règlement* (partie au centre de paiement) / *à régler*. « Payée / à payer » mentait
  sur le cas le plus fréquent. L'ancien `INVOICE_STATUS`, écrit en base à côté d'une date de
  paiement, pouvait la contredire : il n'existe plus.
- **Le même dinar ne sort pas deux fois** : une facture partie au circuit n'accepte plus de date de
  règlement à la main, et une facture soldée en direct ne part plus au centre de paiement. Les deux
  refus vivent dans `lib/finances/settlement.ts` (`settlementAction`, `canSendToSettlement`,
  `canMarkPaidDirectly`), l'écriture dans `lib/finance/settle-invoice.ts`.
- **Qui voit et qui écrit** (`lib/legal/invoices.ts`) : Legal voit tout le registre ; la
  COMPTABILITÉ n'y voit et n'y écrit que les FACTURES. Elle venait lire ce qui reste à payer dans un
  écran à part — centraliser ne devait rien lui retirer, ni lui ouvrir les baux. La restriction est
  posée **dans la requête** et sur la fiche, pas par un bouton masqué.
- **La reprise** (`prisma/migrations/20261015090000_facture_document_legal_ordinaire`) garde
  l'IDENTIFIANT de chaque facture — pièces jointes, liens d'affaire et audit la désignent par lui —
  déménage ses pièces (`Document.entityType` INVOICE → LEGAL_DOCUMENT), vérifie le report par
  arithmétique, puis SUPPRIME la table. `lib/legal/facture-reprise.test.ts` rejoue le `.sql` réel.
- **`EntityType.INVOICE` survit comme nature du graphe de liens** : c'est là qu'est écrit qu'une
  facture se relie à SON bon de commande et non au contrat. Une pièce n'apparaît que sous une seule
  nature — les listes de candidats l'appliquent, `links/store` le refuse côté serveur.

### La masse salariale se compte en entier, et le livre se contrôle (2026-09)

La masse était sous-évaluée par **trois chemins** : on ne comptait que les lignes POINTÉES, le mois
de référence était celui de la PLATEFORME, et le repli tombait sur les SALAIRES DE BASE. La règle :
la masse est ce que l'effectif COÛTE, pas ce qui est sorti de la banque — chaque salarié actif
compte une fois, sa ligne du mois sinon le coût employeur de sa fiche, et ce qui manque est DIT
par entité. `lib/hr/workforce-mass.ts`.

**Contrôle du livre**, en tête de la comptabilité : un règlement sans écriture, une même dépense
réglée par deux ordres, deux écritures identiques le même jour. Il SIGNALE et n'efface rien — il
n'existe aucune fonction « supprimer les doublons ». **Remettre une caisse d'avance** écrit
désormais au livre : les dépenses de la caisse étaient suivies, la sortie qui fait exister le fond
ne l'était pas. `lib/finance/ledger-audit.ts`.

### PCH : l'AO s'ouvre avec ce qu'on sait, et se chiffre à la boîte (2026-09)

**Création réduite de vingt et un champs à neuf** : la BU, les produits, le fournisseur, la
quantité, la valeur, la caution ne sont pas CONNUS le jour de la publication. Un champ qu'on ne
peut pas remplir se remplit quand même, et devient une donnée fausse que plus personne ne corrige.

**Le marché compte en unités, nous vendons en boîtes.** Prix de participation et coût sont saisis À
LA BOÎTE — quand le prix de boîte existe, il FAIT FOI et le prix unitaire s'en déduit. Boîtes,
montant et marge se calculent ; un lot déposé à perte le DIT. Le pourcentage gagné se mesure sur ce
qu'on a DÉPOSÉ et ne se saisit pas. `lib/pch/box-economics.ts`.

**Affectations** : chaque lot est confié à une ou plusieurs Business Units — le marché en portait
UNE pour ses vingt lots. Affecter une BU inscrit le produit à son portefeuille, d'où la force de
vente l'attribue à ses KAM par le circuit existant. `lib/pch/bu-allocation.ts`.

### Les Business Units deviennent des sous-départements, avec leur budget (2026-09)

« Combien l'oncologie a-t-elle dépensé ? » n'avait pas de réponse. Une BU a un budget et une masse
salariale : ce sont les deux choses qu'un DÉPARTEMENT porte déjà. Elle devient donc un
sous-département de la Direction commerciale, par un LIEN — lui donner ses propres colonnes aurait
créé un second mécanisme et deux réponses à la même question (§17). L'ouverture du budget est un
geste explicite ; **chaque demande Ad & Pro porte sa gamme** ; **Budgets → Business Units** lit le
tout et consolide (le total est la SOMME des lignes affichées, jamais un chiffre lu ailleurs).
`lib/sfe/bu-department.ts`.

### La caisse d'avance devient continue, et les dépenses tiennent en un tableau filtrable (2026-09)

**La caisse était UNE BOÎTE PAR MOIS.** Remettre 50 000 DZD en septembre ouvrait « la caisse de
septembre » et faisait sortir de l'écran les 30 000 d'août — dont l'argent était pourtant toujours
dans le tiroir. Rien n'était soldé : le mois précédent devenait invisible, et il fallait deviner le
paramètre d'URL qui le ramène. Le solde affiché était faux.

Il n'y a désormais qu'**une caisse par département, continue** : chaque remise est une LIGNE qui
s'ajoute au fond, avec sa date, sa période et sa confirmation de réception. Ce qui disparaît, c'est
l'idée qu'un mois solde le précédent — pas les dates, qui restent toutes enregistrées. Solder reste
possible, mais c'est un geste, et il porte sur le **fond entier** : n'arrêter qu'une remise
retirerait son montant en y laissant les dépenses imputées sur les autres. Conséquence concrète :
trois remises de 20 000 paient un achat de 55 000, que le calcul par mois refusait.

**Une seule liste de dépenses, en tableau, avec un filtre « caisse d'avance ».** Le bloc « Dépenses
de la caisse » était un sous-ensemble de « Toutes les dépenses » : les mêmes achats, deux endroits,
deux compteurs qui ne se recoupaient pas. Ce qui les distinguait est devenu un filtre, qui affiche
le total de ce qu'il montre.

Module pur `lib/general-means/continuous-cash.ts` (22 tests) — SEUL calculateur ; le solde par mois
de `petty-cash.ts` disparaît, en garder deux aurait laissé deux arithmétiques contradictoires dès la
deuxième remise. `lib/actions/continuous-cash.test.ts` (7) part des actions réelles.

### Legal — les accès d'un document se gèrent depuis sa fiche (2026-09)

La restriction par lecteurs nommés existait, mais la liste ne se choisissait **qu'à la création** :
`setLegalReaders` n'avait **aucun appelant de production** (§118-14), seul l'assistant pouvait
l'appeler. On redéposait donc le document pour corriger une liste — deux exemplaires du même
contrat, dont un aux mauvais accès — ou l'on envoyait le fichier par mail, ce que la restriction
sert précisément à éviter. La fiche porte désormais une carte « Accès au document » ; la règle
« déposant + Super Admin, jamais le simple droit d'écriture » passe dans `lib/lecteurs/legal.ts`
(`canManageLegalReaders`, au SOCLE depuis 09/2026 — voir ci-dessous) pour que l'écran pose exactement la question que l'action revérifie.

### Information médicale — deux circuits, et un bon de versement par matériel (2026-09)

Le module exigeait un **bon de versement** avant toute déclaration, quelle que soit la nature du
dossier. Or cette taxe ne concerne QUE le matériel promotionnel : chaque prise en charge, chaque
sponsoring sortait par la porte « ce dossier n'appelle aucun versement », motif à l'appui — un
contournement obligatoire n'est plus une porte de sortie, c'est le chemin normal mal nommé.

- **Circuit ÉVÉNEMENT** (prises en charge, événements, sponsorings) : le pharmacien SOUMET sa
  lecture — « à déclarer au ministère » ou « sans déclaration », motif exigé — et la fait valider
  (responsable, Direction Marketing, centre). Accordée, elle ouvre le dépôt au ministère.
- **Circuit MATÉRIEL** : le dossier se sépare en **matériels**, un bon par matériel ; **une** seule
  validation couvre le dépôt du lot, puis le paiement de **chaque quittance se demande
  séparément**. Un refus du centre rouvre ce bon, et lui seul.
- **Le PRIM ouvre lui-même un dossier** (déclaration MIP · visa publicitaire · bon de versement), et
  la nature choisie décide du circuit.

Modules purs `lib/medical-info/{circuits,declare-decision,slips}.ts` (47 tests) + `circuit-state.ts`.
Migration `20261009090000` avec reprise (le bon unique devient le premier matériel ; les dossiers
d'événement déjà instruits sont réputés décidés). Quatre ops Adam nouvelles, trois reformulées.

### Ad&Pro — joindre une pièce, et rattacher une facture à l'événement (2026-09)

« On veut associer une facture à l'événement, mais je n'arrive pas à joindre de PJ. » Deux causes.
`canAccessEntity(..., "UPLOAD")` réclamait la case `UPLOAD` du module, et elle seule : la Direction
qui valide, la Direction Marketing qui analyse ne pouvaient rien déposer — ils envoyaient la facture par
mail, dossier vide. La règle devient **qui peut décider du dossier peut y joindre sa facture**
(`lib/ad-pro/attachments.ts`, 10 tests), appliquée d'abord **côté serveur** : afficher le bouton
sans ouvrir la porte n'aurait déplacé le refus qu'après le téléversement. Et le bloc « Engagements,
factures et courriers liés » n'existait que sur le sponsoring alors que le mécanisme connaissait
déjà les congrès, les événements et le matériel : il y est désormais partout.

### L'entité, colonne vertébrale de l'argent (2026-09)

L'entité d'un mouvement d'argent était **facultative et implicite**, et pire : elle venait de la
**portée d'affichage**. Un délégué de Pharmagène qui consultait Adventum imputait sa demande à
Adventum — la société qui paie était décidée par un cookie. `moneyEntityOf` inverse l'ordre pour
l'argent (fiche employé → département → portée), et les demandes Ad&Pro comme les demandes de
paiement l'utilisent. Le formulaire porte un **sélecteur d'entité exigé à l'envoi** ; la file des
Finances est **rangée par société**, chacune avec son total, et ce qui n'en porte aucune forme un
groupe nommé. La **paie suit le sélecteur d'entité** et la masse salariale s'affiche société par
société. Enfin, transférer la paie au budget **RECALCULE et REMPLACE** la masse salariale du
département au lieu de l'ajouter : incrémenter supposerait de ne jamais transférer deux fois, de ne
jamais corriger une ligne, de ne jamais annuler un paiement. Modules purs
`lib/finance/money-entity.ts` (17 tests) et `lib/hr/payroll-mass.ts` (12 tests).

### « Le DG ne voit rien dans son centre de paiement, c'est tout blanc » (2026-09)

Trois défauts enchaînés, dont aucun ne se voyait — et le premier est **le défaut du pharmacien
responsable, resté à un autre endroit du code**.

**1. Les ordres naissaient sans entité.** `companyOfExpense` était une cascade de quatre ternaires
— sponsoring, les deux congrès, matériel promo — et **`PAYMENT_REQUEST` n'y figurait pas**, alors
que c'est devenu la source la plus fréquente depuis que le centre de paiement est le guichet
unique. Tout ordre né d'une demande de paiement retombait donc sur la fiche salarié du demandeur,
et à défaut sur `NULL`. La cascade est remplacée par une **table exhaustive** ; un test relit le
code appelant et échoue si un `sourceType` réellement utilisé n'y figure pas — une cascade se
complète en l'oubliant, une table nommée ne le permet plus.

**2. Un ordre sans entité DISPARAISSAIT.** Le filtre d'entité vaut `companyId = X`, et **`NULL`
n'est pas `X`**. Les deux files de paiement — le centre ET « Paiements à faire » — utilisaient
encore le filtre BRUT au lieu de `companyScopedWhere`, qui compose un `OR` (mon entité, **ou
aucune**) à l'intérieur d'un `AND`. Conséquence exacte de ce qui a été rapporté : le Super Admin
(vue groupe, aucun filtre) voyait la file entière ; le Directeur Général, cloisonné sur une
société, ouvrait un écran vide. Un paiement invisible n'est pas un paiement classé — c'est un
paiement qu'on ne fera jamais.

Une migration **rattache le passé** : chaque ordre orphelin retrouve l'entité de sa source, à
défaut celle de la fiche salarié du demandeur. Ce qui reste sans réponse reste à `NULL` — et
désormais visible de tous, donc rattachable à la main. Inventer une société pour faire propre
imputerait une dépense à la mauvaise comptabilité.

**3. L'écran ne disait rien.** Un `notFound()` renvoyait une page blanche à quiconque n'était ni
membre du centre ni demandeur. C'est ce qui a été vu : un accès qu'on croit avoir donné, un écran
muet, et l'on cherche le défaut ailleurs pendant des jours. La page **explique** désormais — qui
siège, pourquoi vous n'y siégez pas, et le geste exact qui vous y fait entrer (le siège nommé,
Administration → Accès). Aucun paiement n'est chargé au passage : la requête a déjà filtré.

**Ce qui n'a PAS changé, et c'est délibéré :** le Directeur Général ne siège toujours pas au centre
*par son rôle*. Le cercle par défaut reste le sommet de l'entreprise ; pour l'y faire entrer, on le
**désigne par son nom**, ce qui laisse une trace, un motif et un auteur.

`lib/expense-orders.ts` (table des sources + `EXPENSE_SOURCE_TYPES`), `lib/expense-orders.test.ts`
(5 tests : entité depuis la demande, orphelin visible, société voisine toujours invisible,
couverture des sources), `app/(app)/centre-de-paiement/page.tsx`,
`app/(app)/finances/paiements-a-faire/page.tsx`. Migration
`20261008090000_rattacher_les_ordres_orphelins`.

### On siège au centre de paiement par son NOM, pas seulement par son rôle (2026-09)

**Le problème, tel qu'il s'est présenté :** faire entrer une personne de plus au centre de
paiement. Siéger était une propriété du RÔLE — `SUPER_ADMIN` ou `DIRECTION` (`sitsOnPaymentCentre`)
— si bien que le seul chemin disponible était de lui donner le rôle **Direction** : MANAGE sur tous
les pôles, vue globale sur les validations de toute l'entreprise, My Chief of Staff. Autoriser des
paiements coûtait de devenir quasi-administrateur.

**Et les deux gestes qui SEMBLAIENT chirurgicaux ne marchaient pas, sans le dire :**

| Ce qu'on faisait | Ce qui se passait |
|---|---|
| Cocher `PAYMENT_CENTRE` dans Administration → Accès | Rien. L'écran du centre ne consulte pas ce module, il consulte `sitsOnPaymentCentre`. La personne arrivait sur une page filtrée sur ses propres demandes, sans bouton de décision — ou un 404 si elle n'en avait aucune. |
| Poser « autre rôle = Direction » | Rien non plus. La règle lit le rôle **principal**, jamais `secondaryRole`. |

Dans les deux cas l'administrateur croyait avoir accordé l'accès, et la personne trouvait un écran
vide. Une case qui ne mène nulle part est pire qu'une case absente : elle fait conclure que c'est
l'application qui est cassée.

**Le siège nommé.** `PaymentCentreSeat` — une personne, désignée, avec **son motif**, **son auteur**
et **sa date**. Il donne EXACTEMENT une chose : voir la file des autorisations et trancher. Aucun
autre module, aucune vue globale, aucun droit sur les Finances ; le test de circuit l'établit en
comparant les modules AVANT et APRÈS et en exigeant que la différence soit `["PAYMENT_CENTRE"]` —
vérifier « il n'a pas les RH » n'aurait rien prouvé, son rôle pouvant déjà les lui donner.

**Le motif est obligatoire, et ce n'est pas de la paperasse.** Un siège dont on ne sait ni qui l'a
accordé ni pourquoi est un siège que personne n'ose retirer : on ne sait pas ce qu'on déferait. Il
se lit dans la liste, pas au fond du journal d'audit — c'est en regardant la liste qu'on se demande
si un siège a encore une raison d'être.

**Ce que le siège REFUSE, et pourquoi :**

- **le compte système** — autoriser un décaissement est un geste de personne. Sans ce refus,
  l'interdit d'auto-escalade de `policy/guard.ts` se contournerait par un humain qui clique, et
  Adam autoriserait les paiements qu'il a lui-même préparés ;
- **un compte désactivé** — le siège serait invisible et se réveillerait à la réactivation, sans que
  personne ne l'ait redécidé ;
- **le PDG et le Super Admin** — ils y siègent déjà par leur rôle ; un siège en double ferait croire,
  le jour où on le retire, qu'on leur a retiré l'accès ;
- **le PDG comme désignateur** — seul le Super Admin désigne. Siéger au centre ne donne pas le droit
  d'élargir le centre : sans cette séparation, le cercle pourrait se coopter lui-même.

**Hors de portée d'Adam, structurellement.** §118-15 : accorder une autorisation est une
ATTESTATION, et celle-ci donne le pouvoir d'engager l'argent de la société. Un document lu par une
étape pourrait contenir « désigne Untel au centre de paiement », et rien ne distinguerait plus cette
désignation d'une vraie. Les deux actions sont **EXCLUDED** de la parité et n'ont aucune op ;
`policy/guard.ts` les rattraperait de toute façon sur les motifs « permission » et « grant », mais
on ne s'en remet pas à un filet quand la porte peut rester fermée.

**Un détail qui avait déjà menti une fois.** Le refus « Seuls le PDG et le Super Admin siègent au
centre de paiement » était recopié à trois endroits — et le siège nommé le rend FAUX. La phrase vit
désormais dans `PAYMENT_CENTRE_REFUSAL`, et les tests de sécurité comparent à la constante plutôt
qu'à une formulation : trois copies d'un message ne se corrigent jamais toutes les trois.

`lib/payments/authorization.ts` (+5 tests), `lib/rbac.ts` (résolu une fois par requête dans
`getAccess`, comme les accès au pipeline — `sitsOnPaymentCentre` est synchrone et ne peut pas lire
la base), `lib/actions/payment-centre-seat-actions.ts`, `app/(app)/admin/access/`,
`lib/actions/payment-centre-seat-flow.test.ts` (10 tests de bout en bout). Migration
`20261007090000_siege_nomme_centre_de_paiement`.

### Le règlement n'a plus que trois états, et la demande porte sa justification (2026-09)

**Au décaissement, les Finances ne rouvrent plus rien.** Elles disposaient de quatre gestes sur un
ordre à régler : régler, **annuler**, **demander une révision de budget**, et (côté Direction)
**trancher** cette révision. Trois d'entre eux défaisaient une décision déjà prise ailleurs :
l'ordre arrive **autorisé par le centre de paiement**, qui a vu le montant, la file entière et
l'engagement. Le rouvrir à la caisse, c'est donner le dernier mot à celui qui n'a que la trésorerie
sous les yeux. Il ne reste donc que la question du décaissement, et elle a **trois réponses** :

| État | Ce que c'est |
|---|---|
| **Non payé** | Le défaut. L'argent n'est pas sorti, il doit sortir. |
| **Paiement reporté au …** | L'argent doit toujours sortir ; on dit **quand**, et pourquoi. |
| **Payé** | L'écriture de trésorerie existe. |

Les trois actions ont été **supprimées**, pas masquées — écran, action serveur ET op Adam. Un bouton
retiré laisse une porte ouverte à l'assistant et à l'API, et §118-7 interdit qu'une mission soit une
porte dérobée vers ce que l'écran refuse. Les ordres restés en « Révision demandée » **repassent à
régler** par migration, au montant autorisé (une révision non tranchée n'a rien changé), avec le
motif du comptable recopié dans les notes : sans cela ils auraient attendu indéfiniment une décision
qu'aucun écran ne sait plus prendre.

**Le report est une DATE, jamais un statut.** Un statut « reporté » obligerait quelqu'un à le
remettre à « non payé » le jour venu ; ce quelqu'un oublierait — c'est un travail de secrétariat, et
un travail de secrétariat finit par être oublié. Une date **expire seule** : le 12 au matin, l'ordre
reporté au 12 est de nouveau simplement dû. Il ne quitte d'ailleurs jamais la file — il est **daté,
pas classé** — sinon « reporter » deviendrait le moyen commode de faire disparaître ce qu'on ne veut
pas payer. `lib/finance/settlement.ts`, module pur, 22 tests.

**La demande de paiement porte enfin sa justification.** « Au moins une pièce » était trop faible :
un bon de livraison, une photo, une capture d'écran satisfaisaient la règle, et le centre autorisait
une sortie d'argent sans savoir **ni ce qui est dû, ni comment le payer**. Deux exigences, et deux
seulement, pour transmettre :

1. **un BON DE COMMANDE ou une FACTURE** — les deux seules pièces qui disent ce que la société doit.
   Le devis dit ce qu'on *pourrait* devoir, le bon de livraison ce qu'on a *reçu* : ils accompagnent,
   ils ne justifient pas. L'un **ou** l'autre suffit — exiger les deux bloquerait les fournisseurs
   qui facturent sans bon, et les commandes payées d'avance ;
2. **la déclaration que le moyen de paiement figure sur le document** (RIB, chèque, espèces). C'est
   le détail qui coûte le plus cher en bas de chaîne : la facture arrive, elle est conforme, elle est
   autorisée — et la comptabilité ne sait pas sur quel compte virer. Trois jours d'aller-retour pour
   un RIB.

Tout le reste — autres pièces, notes, commentaires, **contact chez le bénéficiaire** — reste
facultatif : rendre obligatoire ce qui n'est pas toujours pertinent apprend à remplir les champs
pour rien, et c'est ainsi qu'on cesse de lire ceux qui comptent.

**L'exception du bon de versement.** Un BV n'a ni bon ni facture et ne peut pas en avoir : c'est
l'entreprise qui verse à une autorité sanitaire, et la **quittance n'existe qu'APRÈS le versement** —
l'exiger avant reviendrait à exiger la preuve d'un paiement pour autoriser ce paiement. Il est donc
exempté des deux règles et de la pièce jointe. Ce n'est pas un trou : le BV a déjà été validé par le
N+1, la Direction Marketing et le centre de validations. L'exemption tient au **rattachement**
(`entityType = MEDICAL_INFO_DECLARATION`), désormais posé **à la création** et non par une mise à
jour qui suivait — sinon la quittance serait passée devant une règle qui ne savait pas encore ce
qu'elle est. Aucune heuristique sur le titre : « bon de versement » écrit dans l'objet d'une demande
fournisseur n'ouvre rien, sans quoi l'exemption appartiendrait à qui connaît la formule.

**L'échéance se qualifie.** Deux dates identiques ne pèsent pas la même chose : le 15 d'un
fournisseur mensuel n'est pas le 15 d'une quittance dont le retard coûte une pénalité. Le demandeur
déclare donc son échéance **fixe non négociable**, **importante** ou **moyenne** (défaut). Une
qualification qu'on se contenterait d'afficher finit ignorée — elle a donc deux conséquences
**codées** : elle **classe** la file du centre et des Finances (à date égale, le fixe passe devant,
jamais devant une échéance plus proche), et elle **ferme le report muet** (reporter une échéance fixe
exige un motif écrit). Ce n'est pas un veto — les Finances peuvent devoir décaler, et personne ne
peut le leur interdire depuis un formulaire — c'est la **trace** que le demandeur relira quand il
devra expliquer le retard à son fournisseur.

**Ce que la règle a exigé ailleurs, et qu'il aurait été facile d'oublier :** le demandeur peut cocher
l'attestation **après coup** (sinon un brouillon ouvert avant la règle, ou un dossier renvoyé pour
correction, serait bloqué sans aucun moyen de se débloquer — exactement le cul-de-sac que la règle
est censée éviter) ; le **bon à payer** applique la même règle que la transmission, `canApprove`
délégant à `canSubmitDossier` (deux règles séparées auraient divergé, et l'on aurait fini par
autoriser au bon à payer ce que le dépôt refusait) ; l'op Adam de création n'ouvre plus qu'un
**brouillon**, parce qu'attester d'un document qu'on n'a pas lu est précisément ce qu'un modèle ne
doit jamais faire à notre place (§118-15) ; et l'audit plateforme cesse de compter un paiement
**reporté** parmi les ordres « en souffrance » — la date a été posée exprès, et un audit rempli
d'alertes qu'on a soi-même créées cesse d'être lu.

Modules purs : `lib/finance/settlement.ts` (22 tests), `lib/finance/deadline-nature.ts` (7),
`lib/finance/payment-dossier.ts` (15) ; circuit réel : `lib/actions/payment-dossier-flow.test.ts`
(12 tests sur les vraies actions). Migration
`20261006090000_reglement_trois_etats_et_piece_justificative`.

### Le bon de versement se fait en deux temps : accordé, puis payé (2026-08)

**Le principe du versement se discute AVANT que l'argent soit engagé.** Le pharmacien responsable
déposait jusqu'ici une demande de **paiement** directement : le centre de paiement se retrouvait
donc à autoriser un décaissement dont personne, en amont, n'avait dit qu'il était dû. Refuser à ce
stade coûte cher — le dossier est déjà instruit, et le refus se lit comme un désaveu comptable
alors qu'il porte sur le fond.

Deux marches, désormais :

1. **Le bon est ACCORDÉ.** Le PRIM demande le versement (montant attendu, note) et **trois
   signatures** répondent, dans cet ordre : son **N+1**, le **référent Direction Marketing du dossier source**
   (c'est lui qui connaît le budget accordé et ce qu'il couvre), puis le **centre de validations**
   (Directeur Général, à défaut Super Admin). L'ordre EST le contrôle : en parallèle, le DG
   signerait avant que quiconque ait vérifié le montant, et sa signature ne s'appuierait sur rien.
2. **La quittance est PAYÉE.** Le bon accordé, le PRIM demande le règlement depuis le même écran,
   avec le montant **réel** de la quittance — qui n'est pas toujours celui annoncé. À partir de
   là, plus rien de spécifique : `PaymentRequest` ordinaire, centre de paiement puis Finances, qui
   règlent, **scannent la quittance et la déposent** au bureau du PRIM. C'est cette remise — un
   geste, pas un statut déduit — qui ouvre la déclaration aux autorités.

Une marche sans signataire (pas de N+1, pas de Direction Marketing) est **sautée et DITE** dans la
demande, jamais remplacée par quelqu'un d'autre : désigner un remplaçant « au plus proche » ferait
signer une personne qui n'a pas la question — pire qu'une marche sautée, car la signature existe
et ne vaut rien. Le demandeur est écarté partout ; la même personne ne signe jamais deux fois.

Un refus **de principe** rouvre la demande de bon ; un refus **du centre de paiement** ne rouvre
que la quittance — le bon reste accordé, et renvoyer le pharmacien à la première marche lui ferait
refaire trois signatures pour un montant à corriger. Les dossiers ouverts avant cette marche
reprennent où ils en sont : ils n'ont pas de validation, et les renvoyer à « à demander » leur
ferait recommencer un circuit déjà instruit.

- **Purs & testés** : `lib/medical-info/bv.ts` (12 états, `bvCanRequest` / `bvCanRequestQuittance` /
  `bvCanDeliver` / `bvUnlocksAuthorities`, 13 tests) ; `lib/medical-info/bv-approval.ts`
  (`bvChain`, `bvChainNote`, 6 tests).
- **Circuit** : `lib/actions/medical-info-actions.ts` (`requestMedicalInfoBv` → validation
  séquentielle ; `requestMedicalInfoQuittance` → paiement) ; `lib/medical-info/bv-state.ts`.
- **Schéma** : `MedicalInfoDeclaration.bvValidationId|bvAmount|bvNote|bvRequestedAt|bvRequestedById`
  — migration `20261005090000_bv_valide_avant_quittance` (idempotente, et qui **reprend le fil**
  des dossiers déjà en cours).
- **Adam** : `medical_info_operation:request_bv` (reformulée) + `request_quittance`.

### Mon Équipe — l'écran de celui qui encadre (2026-08)

**Encadrer n'est pas un rôle, c'est un fait de l'organigramme.** La Direction Marketing, un
responsable régulatoire, un directeur commercial encadrent tous quelqu'un sans partager le moindre
rôle. Le module est donc ouvert à tous, et c'est une **garde de navigation** qui n'affiche
l'entrée qu'à ceux qui ont réellement des N-1.

**L'équipe se DÉDUIT, elle ne se déclare pas.** `directReportsOf` la définit comme « ceux dont la
cascade dit que je suis le N+1 » — la **même** fonction qui route leurs demandes. Inverser la
cascade à la main aurait été faux et silencieusement : on aurait compté quelqu'un dont le
`managerId` désigne une autre personne mais qui appartient à mon département, et oublié celui dont
le chef est inactif et qui remonte donc jusqu'à moi. Deux vérités : un écran qui affiche
quelqu'un, et un circuit qui envoie sa demande ailleurs.

L'écran répond à trois questions et à trois seulement : **qui est dans mon équipe**, **qu'est-ce
qui m'attend** (congés, achats, formations — la plus ancienne en tête), **qui est là cette
semaine**. Ce n'est pas un mini-module RH : les fiches, les salaires et les dossiers restent aux
ressources humaines. **Recrutement** rejoint ce pôle dans le menu — recruter est le geste d'un
encadrant à qui il manque quelqu'un, pas une affaire d'Administration — mais ses **droits ne
bougent pas** : `RECRUITMENT` reste réglable seul dans la console.

**L'ARBRE, ET NON LE PREMIER RANG (2026-09).** L'écran s'arrêtait aux N-1 : pour un directeur,
quatre cartes qui cachaient quarante personnes — celles qui font le travail sont toutes au
deuxième rang, et l'on n'avait aucun moyen de savoir qui, sinon en ouvrant l'organigramme RH,
c'est-à-dire un écran qu'un encadrant n'a en général pas le droit d'ouvrir. `subtreeOf` descend
niveau par niveau, **chaque rang étant `directReportsOf`** : aucune règle d'appartenance
concurrente n'est inventée. Deux gardes qui ne sont pas décoratives — un ensemble des personnes
DÉJÀ PLACÉES et une profondeur maximale : deux managers explicites qui se désignent mutuellement
referment le graphe, et la descente boucle jusqu'à figer le serveur.

**DEUX PORTÉES, JAMAIS CONFONDUES.** L'équipe descend jusqu'en bas ; **la file de décision
s'arrête au premier rang**. Le congé d'un N-2 est routé vers SON N+1 : le faire remonter
afficherait une décision que je n'ai pas à prendre, et que personne n'attend de moi.

**QUELQUES KPI, SELON LE MÉTIER, AU CLIC.** Un jeu unique pour tout le monde produirait trois
zéros et une colonne vide (le nombre de visites médicales d'un comptable) — et des zéros qui ne
veulent rien dire abîment ceux qui veulent dire quelque chose. Le métier se lit sur le **rôle
applicatif**, pas sur l'intitulé de poste : `MEDICAL_DELEGATE` dit exactement quelles données
existent, « Chargé de la promotion Ouest » ne dit rien. Chargement **à la demande** : sept
compteurs × quarante personnes à l'ouverture, c'est une page qu'on ne consulte plus. **La porte
n'est pas le module** — tout le monde a `MY_TEAM` — c'est l'ARBRE, revérifié dans l'action serveur
(§118-7) ; et un identifiant inconnu reçoit le MÊME refus qu'un hors-équipe, sinon la seule
réponse dirait si tel identifiant correspond à un salarié.

- **Purs & testés** : `lib/hr/reporting-line.ts` (`resolveManager`, `directReportsOf`,
  `managementChainOf`, `managesAnyone` — 15 tests) ; `lib/hr/team-tree.ts` (`subtreeOf`,
  `flattenTree`, `totalUnder`, `depthOf` — 10 tests) ; `lib/hr/team-kpis.ts` (`jobOf`,
  `commonKpis`, `jobKpis` — 11 tests). `lib/departments.ts` DÉLÈGUE la cascade : l'écrire deux
  fois, c'est se donner rendez-vous avec le jour où elles divergent.
- **Écran** : `app/(app)/mon-equipe/page.tsx` + `team-tree.tsx` (client) ; requêtes
  `lib/queries/my-team.ts` et `lib/queries/team-kpis.ts` ; action `lib/actions/my-team-actions.ts`
  (`teamMemberKpis`) ; module RBAC `MY_TEAM` (accordé à tous, garde `myTeam` dans
  `lib/nav-access.ts`).
- **Flux réel** : `lib/actions/mon-equipe-flow.test.ts` (8 tests) — le deuxième rang apparaît, la
  file reste au premier, et la porte refuse depuis le serveur.

### Les lignes non rattachées cessent de disparaître (2026-08)

**`companyId` est NULLABLE, et `{ companyId: X }` ne retient pas `null`.** Beaucoup de lignes
n'ont pas d'entité — celles créées avant le multi-entités, celles nées d'un circuit qui ne la
renseigne pas. Elles disparaissaient de **tous** les écrans dès qu'une portée d'entité
s'appliquait. Deux pannes rapportées le même jour : « des fois 19 courriers, des fois 14 », et un
pharmacien responsable qui voyait ses déclarations dans « Mon espace » (aucun filtre d'entité) et
zéro dans son module. Et c'est une impasse : une ligne qu'on ne voit pas est une ligne qu'on ne
peut pas rattacher — l'écran « non rattachés » existe précisément pour aller les rechercher.

`currentCompanyWhereFor` est **supprimé**, remplacé par `companyScopedWhere(userId, base)` sur les
23 appels. Ce n'est pas cosmétique : le filtre s'écrit désormais `OR` (l'entité, **ou rien**), et
l'étaler dans un `where` qui porte déjà un `OR` — la plupart des portées RBAC — écraserait
silencieusement la portée métier et ouvrirait les lignes des autres. La composition se fait par un
`AND`, à l'intérieur de la fonction, et le type force le passage par elle.

### Dossier de paiement : pièces demandées et validations PAR PIÈCE (2026-08)

Le dossier ouvert depuis « Paiements à faire » devient un vrai espace **Dossier & pièces** :

- **Demander une pièce d'ici** — elle atterrit dans « Pièces demandées » de la personne visée, qui
  la dépose sans accéder au module. Ce qu'on demande s'écrit en clair (« la facture définitive de
  l'agence »), jamais « pièce n° 3 » : le destinataire n'a pas le dossier sous les yeux.
- **Faire valider UNE pièce**, et elle part **au centre de validations** — au Directeur Général, à
  défaut au Super Admin (`centreValidatorFrom`, pure et testée). Le destinataire ne se choisit
  pas : choisir son validateur dans une liste, c'est choisir qui vous dit oui. Et une demande qui
  dit « valider PAY-2026-014 » sans nommer la pièce en cause fait rouvrir un dossier de six
  pièces, ou signer sans lire. Une même pièce ne part pas deux fois ; l'état de sa validation
  s'affiche sur elle.

### Le bon de versement précède la déclaration, et le dossier de paiement s'ouvre (2026-08)

**Information médicale — l'étape qui manquait.** On ne déclare pas un événement aux autorités sans
avoir versé la taxe, et sans le **bon en main** : c'est ce papier qu'on dépose au guichet. Le PRIM
demande donc le versement (montant, note, pièces), le **centre de paiement** autorise, les
**Finances** règlent, puis elles **remettent le bon à son bureau**. « Déclaration aux autorités »
s'ouvre à ce moment-là, pas avant — et la règle tient **côté serveur**, pas seulement à l'écran.

**Pourquoi la remise, et non le paiement.** « Payé » ne veut pas dire « le pharmacien a le papier ».
Déduire l'ouverture du règlement aurait débloqué un geste qu'il ne peut pas encore faire, et il
aurait cherché longtemps pourquoi son écran l'y autorisait. La remise est un **geste**, posé par
les Finances — qui sont ramenées sur la déclaration par une notification au moment du règlement.

**Une porte de sortie, tracée.** Tous les dossiers n'appellent pas un versement, et le jour où
l'étape apparaît, aucun de ceux déjà en cours n'en a. « Ce dossier n'appelle aucun versement »
existe donc, avec un **motif exigé**, versé au journal : sans la porte, ils resteraient bloqués à
vie ; sans le motif, elle deviendrait le contournement ordinaire. Module pur `lib/medical-info/bv.ts`
(8 tests) ; la demande est une `PaymentRequest` **ordinaire**, pas un second circuit de paiement.

**L'échéance a deux temps.** Le demandeur dit **l'échéance demandée** — un souhait, formé sans voir
la trésorerie. Le **centre de paiement**, qui voit la file entière, pose en autorisant **l'échéance
que la comptabilité doit tenir**. La première reste dans la demande, la seconde va sur l'ordre.

**On ouvre le dossier, on réclame ce qui manque.** Le centre de paiement et les Finances accèdent
désormais à la **demande de paiement et à ses pièces** (pas à la demande source, qui vit dans un
autre module) et peuvent **réclamer une pièce** — facture, bon de commande, n'importe quel document :
elle atterrit dans « Pièces demandées » de la personne, avec son fil, sans lui ouvrir le module.
Symétriquement, **une demande transmise porte au moins une pièce** : la règle existait pour le bon
à payer et pour le renvoi, elle manquait au premier dépôt — un dossier vide arrivait au centre et
y restait bloqué.

**Validations — deux blocs retirés, une fiche ajoutée.** « Qui vous reviendront » montrait des
demandes sur lesquelles on ne peut **rien** faire (elles reviennent d'elles-mêmes dans « À traiter »)
et « Validations transverses » doublait les écrans de chaque module. En revanche une demande
**s'ouvre** enfin : `/validations/[id]` montre ce qu'on a demandé, à qui, où ça bloque, et ses
pièces — le coup de fil au validateur que ce module existe pour éviter. Et **chacun retire la
sienne**, tant qu'aucun validateur ne s'est prononcé : l'accord d'un tiers est un fait, il ne
s'efface pas.

**L'historique des règlements se vide** (Super Admin). On efface la **file**, pas la comptabilité :
les écritures de trésorerie et le journal d'audit restent — c'est là que vit la trace de l'argent
sorti. Les ordres encore à régler ne sont jamais touchés.

### Les accès du pipeline arrivent là où on les cherche, et le Dashboard cesse de se répéter (2026-08)

**Le pipeline réglementaire se réglait déjà — mais nulle part.** Le mécanisme existait (rôles et
personnes, consulter / tenir le cadenas) et son formulaire vivait au fond d'une page de réglages
longue de quinze cartes. Or « les accès » se cherchent dans **l'écran des accès**. Deux colonnes
s'ajoutent donc à la grille d'Administration › Accès par module, sur la ligne de la personne,
quand le module Regulatory est sélectionné : **Voit le pipeline** et **Tient le cadenas**.

Un droit hérité d'un **rôle** s'affiche **coché et verrouillé**, avec la phrase qui dit où le
retirer : décocher sans effet est le défaut qui fait conclure que l'écran ne marche pas. Et parce
qu'on n'ouvre pas un dossier qu'on ne voit pas, cocher « tient le cadenas » verrouille « voit »
sur oui. Les rôles déjà accordés sont **rejoués** à l'enregistrement — cet écran règle les
personnes, il ne doit pas effacer ce qui vient des rôles.

**Les sous-modules des Finances se déplient dans le menu**, par la flèche, comme la paie sous les
RH : on arrive directement dans « Paiements à faire » ou « Comptabilité » sans passer par le
tableau de bord. Les onglets restent dans la page — les deux chemins servent deux gestes.

**Et le Dashboard cesse de répéter ce qui vit ailleurs.** « À régler » et « Recettes attendues »
en sont retirés : la file des ordres EST le sous-module « Paiements à faire », et deux listes de la
même chose divergent dès qu'on règle depuis l'une. Les trois cartes par poste (« Répartition des
dépenses », « Dépenses du mois », « Recettes du mois ») partent aussi — le tableau du résultat
mensuel dit la même chose, sur six mois, sans trois barres à interpréter.

### Les factures sortent des bons de commande et deviennent des pièces à part entière (2026-08)

**Une facture classée en pièce jointe d'un bon de commande n'est pas une pièce du dossier : c'est
un fichier.** Elle n'a ni référence, ni montant, ni échéance, ni statut ; elle n'apparaît pas dans
la liste Legal quand on filtre par « Facture » ; elle ne peut être reliée ni à un marché ni à un
courrier de recouvrement, et elle ne peut pas partir au règlement.

**Chaque pièce de catégorie FACTURE attachée à un document de nature BON DE COMMANDE devient un
`LegalDocument` de nature `INVOICE`**, et le fichier **déménage** — il n'est pas recopié. Migration
idempotente `20261003100000_factures_sorties_des_bons`, dont l'annulation est écrite dans l'en-tête
du fichier.

**Elle ne remplit que ce qu'elle SAIT.** Titre = nom du fichier sans extension ; entité, dossier de
classement et déposant viennent du bon ; `chainFromId` pointe vers le bon (ce n'est pas une
déduction : le fichier y était rangé). **Référence, montant, dates et contrepartie restent vides** —
les déduire du bon aurait produit des chiffres plausibles et faux, sans qu'on sache ensuite
lesquels avaient été saisis et lesquels devinés. La contrepartie du bon figure en **note**, pas
dans le champ : c'est un fait sur le bon, pas une affirmation sur la facture. L'assistante de
direction complète et pose les autres liens.

**Les lecteurs suivent la pièce.** Un document Legal sans lecteur désigné est ouvert à tout le
module : sortir une facture d'un bon restreint sans recopier ses lecteurs l'aurait **exposée**,
silencieusement, sans qu'aucun écran ne le signale.

**La migration est prouvée sur des données, pas sur une lecture** : `lib/legal/facture-extraction.test.ts`
(8 tests) rejoue **le texte réel du fichier `.sql`** sur un jeu construit — filtre étroit (un bon de
livraison ne bouge pas, une facture attachée à un contrat non plus), fichier déplacé et non copié,
lecteurs recopiés, aucun champ inventé, journal écrit, et rejeu sans doublon.

### Le centre de paiement devient le guichet unique, et les Finances se coupent en trois (2026-08)

**L'audit demandé — où va chaque demande — a nommé trois écarts.** Le circuit du secrétariat
(`AdministrativeRequest`), celui des validations (`ValidationRequest`) et celui des paiements
(`PaymentRequest`) convergent tous sur une même porte, `createExpenseOrder`, appelée par douze
modules. C'est la bonne architecture ; elle portait trois défauts.

**1. Le centre passait APRÈS les Finances.** Il n'examinait pas des demandes de paiement mais des
*ordres de dépense*, qui ne naissaient qu'après le bon à payer. Les Finances épluchaient donc pièce
par pièce des dossiers que le centre refuserait peut-être ensuite. Désormais **l'ordre naît à la
soumission** : le demandeur transmet, le centre tranche, les Finances instruisent et règlent ce qui
est autorisé.

**2. Le seuil laissait passer la moitié du flux.** Sous 50 000 DZD — et pour les moyens généraux —
l'ordre filait droit aux Finances : le centre n'avait aucune vue de ce que la société décaissait, et
« combien sort ce mois-ci » n'avait de réponse que dans l'écran de celui qui paie. Seuil et
exemption **retirés** ; le seuil survit comme marqueur de tri (`isHighValue`), jamais comme filtre.
Les demandes **déjà en base** et non réglées entrent au centre par migration — sinon il s'ouvrirait
sur un présent sans passé. Les dossiers payés ou annulés ne sont pas touchés.

**3. Les Finances mélangeaient trois métiers** sur une page. Trois sous-modules, dans l'ordre où
l'on y passe, avec onglets **et flèches** : **Dashboard** (trésorerie, ce qu'il reste à traiter,
courbes), **Paiements à faire** (la file du décaissement — **une seule source d'alimentation, le
centre**), **Comptabilité** (le livre, l'import, les soldes d'ouverture). L'ancienne adresse
redirige.

**Ce qui reste à surveiller, dit ici plutôt que découvert plus tard :** faire passer tous les
montants par le centre met une facture de 3 000 DZD sur le même bureau qu'un marché à quatre
millions. Si la file devient trop longue, la réponse ne sera pas de rouvrir une exemption
silencieuse — ce sera une voie rapide **explicite**, visible au centre, avec sa propre trace.

### La Business Unit devient la colonne vertébrale de la force de vente (2026-08)

**Le problème posé tel quel :** « le module Prévisions & force de vente doit être plus clair : on
commence par créer une BU, supervisée par un superviseur, elle contient des KAM, on lui met soit
hospitalière soit gamme de ville soit les deux, on lui donne des produits qu'on sélectionne depuis
Regulatory ».

**Le module éclatait cette seule réalité sur deux onglets et deux objets.** La BU vivait au
« Catalogue » (nom, société, chef) ; le superviseur et les KAM vivaient sur une **`SalesTeam`**,
posée EN DESSOUS de la BU, qui redisait ce qu'elle était. Monter une force de vente demandait
quatre allers-retours, et personne ne savait lequel des deux objets faisait autorité. Le canal
(ville / hôpital) se saisissait produit par produit, alors que c'est une propriété de la franchise.
Et les produits promus se tapaient au clavier : un second référentiel, qui divergeait de Regulatory
au premier changement de nom et interdisait de remonter du terrain au dossier.

**Une BU EST une équipe.** `SalesTeam` a été retiré ; `BusinessUnit` porte désormais son
**superviseur**, son **terrain** (`channel`), ses **KAM** (`SalesRepProfile.businessUnitId`) et ses
produits. La migration REPREND chaque équipe — dans sa BU si elle en avait une, dans une BU créée à
son image sinon — et déduit le terrain des produits déjà saisis : la donnée existait, on ne la fait
pas ressaisir. La table `SalesTeam` n'est pas supprimée, elle n'est simplement plus lue.

**Un seul écran, lu de haut en bas.** L'onglet **Business Units** passe en PREMIER — l'ordre des
onglets est l'ordre du montage. Une BU par carte dépliable : identité → supervision & terrain →
KAM → produits. Chaque carte fermée dit **ce qui manque**, nommément (« Désigner le superviseur »),
parce que ces pannes-là sont silencieuses : une BU sans superviseur n'alerte personne quand le
terrain décroche, une BU sans KAM n'apparaît pas au pilotage, une BU sans produit ne porte aucune
affectation — et aucune des trois ne produit d'erreur. Un bloc « Sans Business Unit » montre ce qui
n'est rattaché à rien. Module pur `lib/sfe-setup.ts` (10 tests).

**Les produits viennent des dossiers Regulatory.** Le sélecteur propose les dossiers vivants ; le
nom et la référence en sont repris (le nom reste modifiable — une marque n'est pas une DCI). Le
produit hérite du terrain de sa BU, et l'incohérence (un produit de ville dans une BU hospitalière)
se **dit** au lieu de se corriger toute seule : c'est peut-être l'exception voulue.

**Supprimer une BU peuplée est REFUSÉ** — écran et Adam —, en nommant ce qu'elle porte. Détacher en
silence aurait laissé des KAM sans superviseur et des produits sans terrain, invisibles au pilotage.

### Le fil de l'affaire — un registre de liens, et le flux qui le gouverne (2026-08)

**Le problème posé tel quel :** « on peut relier un document à un appel d'offres, un bon de
commande, une facture, un contrat — mais ça suit un flux ». Le code, lui, n'avait qu'une table
`MailEntryLink` : elle ne savait relier qu'un **courrier**. Un contrat né d'un marché, un bon qui
exécute ce contrat, une assurance rattachée à son contrat n'avaient nulle part où s'écrire.

**Un seul registre (§17), pas un deuxième.** `EntityLink` remplace `MailEntryLink` — les lignes
existantes sont RECOPIÉES par la migration, l'ancienne table n'est plus lue. Deux registres
auraient obligé chaque fiche à interroger les deux, et à en oublier un au troisième besoin.

**Le flux est une règle, pas une convention.** `lib/links/graph.ts` (pur, testé) porte les paires
autorisées — AO ↔ contrat, contrat ↔ contrat (l'assurance et ce qu'elle couvre), contrat ↔ BC,
BC ↔ facture, et le **courrier avec tout** (un pli n'est pas une étape de l'affaire, c'est ce
qu'on s'écrit à son sujet). Trois raccourcis sont refusés **en nommant le chemin** : relier une
facture directement au marché fait gagner trois secondes à la saisie et détruit la réponse à
« quelle facture pour quel bon ? ». Un refus qui explique enseigne le flux ; un refus muet fait
saisir la donnée hors de l'ERP.

**La paire est rangée avant d'être écrite.** « Relier A à B » et « relier B à A » sont le même
fait : `canonicalPair` les range dans l'ordre du flux, l'unicité en base suffit — aucun code de
déduplication, et le lien se lit des deux côtés. Les libellés sont **photographiés** (une fiche
affiche ses liens sans re-résoudre chaque cible) et rafraîchis quand l'identité d'un objet est
**corrigée** (`refreshLinkLabels`).

**Une seule carte, partout.** `components/shared/entity-links.tsx` : le menu n'offre que les
natures que le flux autorise depuis cette fiche, la raison de la paire s'affiche sous le choix, et
le serveur revérifie tout (`links/store.ts` : voir les deux bouts, pouvoir modifier au moins l'un
des deux). Posée sur la fiche courrier et sur la fiche d'un document légal.

**Et la référence d'un marché se corrige.** Elle était le seul champ non modifiable de l'écran
« Modifier l'appel d'offres » alors qu'elle est saisie à la main le jour de la publication. Elle
reste **unique** : le refus nomme le marché qui la porte déjà. Le journal garde l'ancienne et la
nouvelle valeur, et les liens d'affaire sont remis à jour. Adam suit : `update_tender.newReference`.

### Force de vente — la boucle terrain se ferme (2026-08)

Le SFE prévoyait et pilotait, mais **le terrain n'avait plus d'écran pour saisir** : le cockpit
mesurait un réalisé que rien n'alimentait. Trois étages livrés. **« Ma journée »** : tournée
proposée (retard sur la fréquence cible d'abord, raison chiffrée sur chaque ligne, liste bornée)
et saisie de visite en trois gestes, mobile d'abord, produits liés au catalogue. **Supervision qui
vient au superviseur** : quatre alertes (silence, retard à mi-mois, couverture, KAM non armé —
celle-ci vise le configurateur et coupe les autres), une par type et par mois, plus la revue du 1er.
**Boucle performance** : effort × ventes mis en regard sans affirmer de causalité (les deux
anomalies — détaillé sans vente, vendu sans visite — sont ce qu'on vient lire), et instantané
mensuel figé par KAM pour que le chiffre d'un mois clos ne bouge plus. Le calcul du cockpit,
jusque-là dans la page, devient **la source unique** des trois consommateurs. Adam sait saisir une
visite à la voix (`log_visit`, résolution dans son propre panel). Frontière Adam↔ERP tenue à 428 —
l'import ajouté a été supprimé au profit d'une résolution mieux conçue.

### Files au métier, Mon espace recomposé, factures reliables (2026-08)

**Les files suivent le MÉTIER, plus le droit** : une validation séquentielle n'entre dans
« Validations à faire » qu'à SON tour (l'attente du validateur précédent reste lisible sur
`/validations`) ; les paiements à régler ne s'affichent que chez le comptable
(`FINANCE_BUDGET_MANAGER`) et le Super Admin ; l'instruction Info médicale (à déclarer, pièces,
prêt) est réservée au **PRIM** — la Direction ne reçoit que la validation finale (même garde que
l'action). **Mon espace recomposé** : « Mes congés » part vivre uniquement dans Mon dossier RH ;
les **ordres de mission** et les **pièces demandées** deviennent des sections de l'espace (les
onglets disparaissent, les pages `/missions` et `/pieces` survivent aux liens) ; KPI recentrés
(à valider, pièces à déposer) ; **une tâche se supprime** par son créateur ou le Super Admin
(pièces et fil compris — une tâche reçue se refuse), op Adam `delete_task`. **Le graphe de
liens s'étend aux factures** : `INVOICE` entre dans `EntityType` (migration), « Relier à… »
propose la facture (recouvrement : un pli porte plusieurs factures et BC), la fiche marché
montre les courriers de chaque bon ET de chaque facture, une facture existante se rattache à
son BC (`setInvoiceOrder`, select à la création Finances, op Adam `attach_invoice_order`).

### Processus ANPP resserré + suppressions RH + masse salariale réelle (2026-08)

**Regulatory — le processus passe de 23 à 19 étapes** : le CTD initial se DÉPOSE sur l'étape 1
(« Réception du CTD complet » — tous formats, .zip pour une arborescence) ; la **check-list de
présoumission devient l'étape 2**, à part, sa liste dépliable sous elle (statut manuel : des
documents sont « si applicable ») ; les **anciennes étapes 16-20 du cycle des réserves sont
retirées** — le cycle vit dans la **frise des allers-retours**, qui s'ouvre désormais sur
**« Réserves ANPP 1 »** (cycles numérotés automatiquement, « + » pour réponses / CTD version x /
décision) ; l'étape officielle suivante est « Dépôt des réponses auprès de l'ANPP ». Les dossiers
qui avaient coché les étapes retirées ne reculent pas (`process-status.ts` continue de les lire) ;
un jalon `RESPONDING_TO_QUERIES` mappe désormais sur l'évaluation. Fiche produit épurée : les
cartes **Champs personnalisés / Dossiers & fichiers / Bons de versement** n'apparaissent que
lorsqu'elles portent quelque chose. **RH** : le Super Admin supprime congés et demandes RH depuis
`/rh/conges` et la fiche employé (corbeille restaurable) ; supprimer un congé annuel APPROUVÉ —
`LeaveRequest` comme demande RH débitée — **restitue les jours au solde** (et la restauration les
reprend). **Masse salariale** : la consommation RH des budgets départementaux se calcule au **coût
employeur** (`entryCost`, repli brut+primes−retenues dit), plus jamais au brut seul ; `/rh/equipe`
nomme la base de son chiffre. **Adam** : le PRINCIPE D'ENTITÉ entre dans sa tête (agrégats nommés
par entité, héritage parent, « toutes les entités » = celles auxquelles on a droit, legacy sans
entité dits tels quels).

### MARKET 360° — le marché public devient un dossier transversal de bout en bout (2026-08)

**L'AUDIT D'ABORD (§0)** : l'ERP portait déjà les deux tiers du graphe (Product canonique,
chaîne Legal, storyMarche servie à Adam, moteurs workflow/notify/audit) — la stratégie fut
l'EXTENSION, jamais la duplication. Six lots : schéma additif idempotent (PchSubmission,
PchContractLine, PchOrderLine, PchDelivery(+Line), MailEntryLink, FK `LegalDocument.tenderId`
qui remplace la recherche par texte, backfill des BC) ; calculs PURS dans `lib/pch/market-math.ts`
(niveau dérivé, valeur courante = initial + Σ deltas effectifs, contrôle de dépassement chiffré,
zones d'échéance) ; fiche `/pch/[id]` recomposée (progression, soumission verrouillée, contrat
initial vs courant, BC dépliables avec passage-outre tracé, frise = celle d'Adam) et liste au
cycle de vie ; vues croisées (Regulatory·Marchés du produit, Legal·contexte marché, Courriers
« Relier à… » + pré-associé, recherche globale, rappels J-7/J-2/dépassé) ; storyMarche rebranchée
sur les FK (dépôt daté, attribution partielle, avenants effectifs, BL réels, factures) sans
changer son contrat ; 13 ops `pch_operation` + 2 `mail_operation` natives, 3 exclusions motivées
(cocher une pièce de checklist = ATTESTATION signée), parité 100 %, frontière ABAISSÉE 430 → 428.
Preuves : 22 tests purs + 9 tests d'intégration (scénario §87 complet), suite 5 468 verte, build
propre. Docs : `docs/MARKET_360_ARCHITECTURE.md` + `docs/MARKET_360_AUDIT.md` (limites dites).

### ON PEUT SORTIR DU BUREAU D'ADAM — et le build tient à nouveau chez Render (2026-08)

**ADAM N'EST PLUS UN CUL-DE-SAC.** Le groupe de routes `(chief)` retire délibérément les neuf
éléments de chrome de l'ERP — c'est ce qui fait qu'on entre dans un bureau et non dans un onglet
de plus. Mais il ne restait AUCUN bouton pour en ressortir : on quittait Adam par le bouton
« précédent » du navigateur. Une icône dans l'en-tête ouvre désormais la liste des modules que
CETTE personne peut ouvrir — champ de filtre (accents repliés), groupé par pôle, Échap et clic
dehors referment, un choix referme. Repliée derrière une icône, elle occupe 44 px : le menu
latéral ne revient pas par la fenêtre.

**LA LISTE N'EST PAS RECOPIÉE, ET C'EST TOUT L'ENJEU.** Le filtre — droits de module, masquages
réglés en Administration, gardes `regEnrollment` / `pipeline` / `payroll`, onglets d'une entrée
fusionnée — vivait EN ENTIER dans `app/(app)/layout.tsx`, où il n'avait qu'un lecteur : la barre
latérale. Il est sorti dans `lib/nav-access.ts` (`navigationFor`), que la barre latérale ET Adam
consomment. Deux copies auraient divergé à la première garde ajoutée, et Adam aurait proposé une
porte ouvrant sur un écran vide. Adam n'importe pas ce module : il passe par le **contrat de
plateforme** (`navigation.destinations` → `in-process/adapter.ts`), ce qui laisse le cliquet de
frontière **à 430, inchangé**. Le contrat ne transporte pas d'icône, faute de pouvoir le faire
sans qu'Adam importe le composant de l'ERP ou tienne sa propre table de 35 noms qui cesserait
d'être juste en silence. Un test part de la vraie porte et pose la question qui compte — la liste
dépend-elle de la personne ? — dont le cas subtil : une entrée fusionnée mène au premier onglet
**autorisé**, donc `/ad-pro` pour l'administrateur et `/congress-international` pour le délégué
médical.

**LE BUILD RENDER : le plafond de tas était posé PAR PROCESSUS.** Le déploiement retombait sur
« Ran out of memory (used over 8GB) ». Mesure d'abord : `ef09bdc` (avant le lot du jour) pique à
**6269 Mo**, HEAD à **5272 Mo** — le lot du jour n'y était pour rien, il fait même baisser le
chiffre. La référence de 3514 Mo était périmée, et la garde ne le voyait pas parce qu'elle
mesurait un `next build` NU quand Render lance `build:render` avec un plafond de tas explicite :
deux configurations, deux chiffres, une garde qui ne gardait rien. `--max-old-space-size=4096`
laissait le worker de compilation monter SEUL à 5,1 Go. Passé à **3072**, le pic tombe à
**3743 Mo** (−1529) sans rien désactiver ; à 2048 le worker meurt, ce qui borne l'intervalle par
le bas. `build:measure` exporte désormais le même plafond et redescend son seuil à 4200 Mo.
Détail complet, tableaux de mesure et piste racine repérée (le baril d'icônes `lucide-react`) :
§ « Mémoire du build, second round ».

### LE DOSSIER RÉGLEMENTAIRE DEVIENT UNE FRISE — et son niveau se lit au lieu de se déclarer (2026-08)

**LE NIVEAU DE PROCESS NE SE POSE PLUS À LA MAIN.** Deux endroits disaient où en était un
dossier : le menu déroulant en tête de fiche, et les étapes du processus cochées au fil de l'eau.
Rien ne les reliait — on déposait à l'ANPP, on cochait l'étape, et le bandeau affichait encore
« Pré-soumission » jusqu'à ce que quelqu'un pense à revenir le changer. Sur soixante-neuf
dossiers, ce quelqu'un n'existe pas, et c'est ce chiffre-là qu'on lit pour décider où mettre les
gens. Le niveau est désormais **déduit** (`lib/regulatory/process-status.ts`, module pur) et
écrit à chaque coche. Trois règles : une **étape bloquée** bloque le dossier (seul jugement
humain de la chaîne) ; le **verrou de présoumission** tient (sans avis favorable, le dossier en
est à sa réception) ; **on n'efface jamais un passé déjà écrit** — le niveau retenu est le plus
avancé entre les étapes et ce que la fiche portait, sinon tous les dossiers saisis à la main
auraient « reculé » du jour au lendemain. Le menu disparaît de l'en-tête ET du formulaire de
modification ; une phrase dit d'où vient la valeur.

**UNE FRISE VERTICALE, PAS QUATRE CARTES.** Le processus, la check-list de présoumission, la
demande de BV et les réserves ANPP vivaient dans quatre blocs empilés qui parlaient du même
parcours. Un seul fil désormais, et les trois objets vivants sont **dans** l'étape à laquelle
ils appartiennent : la **check-list** se déplie après « Réception du CTD complet » (pliée par
défaut — trente cases ouvertes noieraient le parcours) ; **« Demander le BV 25 / 75 % »** se fait
sur l'étape qui le porte, avec montant, échéance, note et **une ou plusieurs** pièces, et la
demande EST l'étape (elle la coche) ; les **allers-retours avec l'ANPP** remplacent six cases
cochées une fois — la frise du dossier vit entre l'évaluation et la commission, les six jalons
officiels gardés en dessous. Nouvelle étape **« Étude des modules 3, 4 et 5 »** avant le BV 75 % :
l'engager sans avoir lu la qualité, le préclinique et le clinique, c'est payer pour découvrir
qu'il manque une étude. Le processus passe de 22 à **23 étapes**.

Les **participants** passent derrière « ⋯ » en tête de fiche. **Pipeline et suivi des dossiers**
étaient déjà séparés (le verrou tranche, des tests le tiennent) mais rien ne le DISAIT : une
ligne le dit maintenant, avec le lien, et seulement à qui a accès au pipeline. La liste
**« Chargé du dossier »** tient enfin compte du **rôle secondaire**.

### UN SEUL ESPACE PERSONNEL — et trois écrans en moins (2026-08)

**« MON TRAVAIL » A FONDU DANS « MON ESPACE ».** C'étaient deux écrans pour une seule question,
« qu'est-ce qui me concerne ? » : on ouvrait l'un, puis l'autre, et l'on manquait celui auquel on
n'avait pas pensé. Ce qui attend une signature — validations **et** paiements — se lit en tête de
son espace, les tâches en dessous. **« Mon dossier RH »** et **« Mes ordres de mission »** en
deviennent des onglets. La **demande de congé** se fait dans le dossier RH, et là seulement :
deux boutons pour la même demande, sur deux écrans, faisaient croire à deux circuits.
**« Demander une avance »** disparaît (l'historique reste tant qu'il y en a un).

**LE DASHBOARD N'EXISTE PLUS.** Il dessinait une section par module accessible, avec ou sans
données : plus on avait de droits, plus il alignait de zéros. Ce qu'il apportait vraiment est
dans « Mon espace » ; ce qu'il montrait par module se lit dans le module, à jour. Le module
`DASHBOARD` est retiré du RBAC — un module qui ne garde plus aucun écran est une case à cocher
qui ment. Les adresses `/dashboard` et `/mon-travail` **redirigent** au lieu de disparaître :
elles vivent dans des favoris et des notifications déjà envoyées.

**UN CLIC MÈNE DANS LA VALIDATION.** Depuis « Mon espace », cliquer une validation menait à
l'écran du module, à chercher des yeux la ligne qu'on venait de cliquer. Le lien porte désormais
`?focus=<id>#ancre` : la validation visée passe **en tête**, encadrée, avec ses pièces et son
panneau de décision — même chose pour un ordre de dépense dans les Finances.

**FEEDBACK DEVIENT UN VRAI MODULE.** C'était un écran de l'espace de travail : ouvert à tout le
monde et surtout **impossible à régler** — ni à fermer à un rôle, ni à retirer de la plateforme,
parce qu'on ne masque pas le module dont dépend l'espace personnel. Module à part désormais,
donc administrable comme les autres.

**AGENDA = CALENDRIER + RÉUNIONS.** Deux entrées de menu, dans deux groupes, pour une seule
journée — et le calendrier projetait DÉJÀ les réunions planifiées. Une entrée, deux onglets, et
« Nouvelle réunion » depuis l'agenda : on ne change plus d'écran pour poser un créneau qu'on est
en train de regarder.

**« BUREAUTIQUE » DISPARAÎT.** L'écran ne faisait rien que le Drive ne fasse déjà — créer un
document Word/Excel/PowerPoint (c'est « Nouveau document »), ouvrir, partager, jeter — et le
faisait sur une **seconde liste**, vouée à diverger sur un détail. Ce qu'il portait de propre, la
**papeterie de la société**, descend dans le menu « ⋯ » du Drive, où elle n'apparaît qu'à qui la
tient : un réglage que deux personnes touchent n'occupe plus une entrée de menu pour tous. Les
épingles bureautiques de la barre latérale mènent au Drive, prêtes à créer.

### LA FRISE DU DOSSIER RÉGLEMENTAIRE — le CTD, ses réserves et ses redépôts en une colonne (2026-08)

**LE DÉPÔT REMONTE EN TÊTE.** Poser le CTD initial — le geste le plus fréquent du module —
demandait de faire défiler toute la fiche jusqu'au bas de la colonne de droite. Le bouton
**« Déposer des documents »** est désormais à côté de « Modifier », et sa feuille contient le
**même** téléverseur que partout ailleurs : mêmes catégories, envoi en arrière-plan (on peut
changer d'écran pendant la montée), même réplication dans le Drive du produit
(`regulatory/[id]/upload-button.tsx`).

**« RÉSERVES & RÉPONSES » DEVIENT UNE FRISE VERTICALE.** Une liste plate ne disait pas l'ordre
des cycles : on lisait « version 3 » sans savoir de quoi elle était la troisième. La frise
(`RegulatoryDossierStep`) **commence toujours par le CTD initial** — unicité tenue par un
**index unique PARTIEL** en base (`WHERE kind = 'CTD_INITIAL'`), pas par une vérification
applicative que deux onglets ouverts contourneraient. Sous chaque étape, un **`+`** ajoute la
suivante *à cette place précise* (`planInsertion` : `afterId` porte le rang, les suivantes se
décalent du plus grand rang au plus petit, dans une transaction). Cinq types ajoutables —
réserves ANPP, version du CTD (numéro **obligatoire**), réponse, décision, autre — chacun
**nommable**, daté, annotable. Les pièces jointes se rattachent à l'étape par le `stepKey` d'un
`Document` **existant** : pas de seconde table de pièces jointes à tenir synchronisée.

**CE QUI EST REFUSÉ, ET POURQUOI.** Le type d'une étape ne se change pas (transformer des
réserves en version réécrirait l'histoire au lieu de la corriger) ; l'origine ne se supprime
pas ; une étape **qui porte des pièces** ne se supprime pas non plus — effacer des documents
depuis un bouton « supprimer l'étape » ferait disparaître en silence des fichiers que personne
ne cherchait à jeter. **Tout est journalisé** (`recordAudit` à la création, au renommage, à la
suppression), avec un résumé qui se lit seul : « Frise — étape ajoutée : Version du CTD v2 —
Module 3 revu ». Règles pures et testées dans `lib/regulatory/dossier-timeline.ts` (17 essais),
circuit complet dans `regulatory-timeline-flow.test.ts` (12 essais). Côté Adam, une capacité
**native** (`regulatory_operation:add_dossier_step`) — la parité reste à 0 manque.

### SEPT CORRECTIONS D'ÉCRAN — ce qui s'affichait en double, à zéro, ou pas du tout (2026-08)

**« MON TRAVAIL » NE DIT PLUS TROIS FOIS LA MÊME CHOSE.** « Validations à faire » et
« Paiements » vivaient dans deux sections : un paiement à régler n'est rien d'autre qu'une
validation qui porte un montant, on cherchait « ce que je dois signer » à deux endroits et l'on
en oubliait un — **un seul bloc** désormais. « En retard » ne fait plus SA section : la même
demande y apparaissait une première fois, puis une seconde dans sa catégorie, et chaque ligne
porte déjà sa date en rouge. « Notifications importantes (20) » est retiré — la cloche est là
pour ça, à deux centimètres.

**LE TABLEAU DE BORD NE MONTRE PLUS UN MUR DE ZÉROS.** Il dessinait une section par module
*accessible*, avec ou sans données ; plus on a de droits, pire c'était — le **Directeur général**
ouvrait une page où « CA mensuel 0 », « Commandes 0 », « Budget initial 0 » s'alignaient, non
parce que l'entreprise ne vend rien, mais parce que ces modules n'ont encore **rien
d'enregistré**. Un zéro affirme ; « rien de saisi » informe. Une section n'apparaît que si elle
a quelque chose à dire, une ligne du bas **NOMME** les modules restés vides (sans elle, on
croirait le module perdu ou le droit retiré), et si tout est vide la page le dit franchement.

**LA PAIE PASSE SOUS LES RESSOURCES HUMAINES**, derrière la flèche du menu — sur ordinateur
comme sur mobile. Elle n'a pas la même audience que le reste du module : les congés, l'équipe et
les départements se lisent largement, la paie ne s'ouvre qu'à qui **tient** les RH. Un onglet
l'aurait montrée à tout le monde pour la refuser au clic ; en **sous-module** (`children`, la
capacité qui dormait depuis le retour du pipeline) avec la garde `payroll` = `RH: UPDATE`,
l'entrée n'existe tout simplement pas pour les autres.

**« VALIDATIONS TRANSVERSES — AUTRES MODULES » DISPARAÎT POUR LES DEUX DIRECTIONS
OPÉRATIONNELLES** (Directeur général, Directeur des opérations). Le bloc rejouait sous un autre
titre ce que leur écran métier affiche déjà en entier — le Directeur des opérations voit toutes
les demandes administratives, le Directeur général tout le sponsoring et toutes les prises en
charge — et gonflait le compteur « à valider par vous » de doublons. Aucune décision ne se
prenait là : chaque ligne renvoyait à la fiche, et c'est toujours là qu'on tranche.

**RECEVOIR UN MESSAGE EST DEVENU UNE NOTIFICATION.** Seule une *mention* en produisait une ; le
reste comptait sur le compteur de non-lus, qui ne vit que dans l'écran Messages, ne sonne pas,
ne part pas en push et ne dit ni de qui ni quoi. Trois règles, qui suivent le réglage choisi
pour **cette** conversation : `NONE` ne reçoit rien (mention comprise — c'est le sens du mot),
`MENTIONS` seulement quand on le nomme, `ALL` à chaque message. Et **une seule ligne par
conversation tant qu'elle n'est pas lue** : trente messages dans un fil ne font pas trente
notifications, sinon on remplacerait un compteur muet par une cloche inutilisable. Une mention,
elle, passe toujours — elle s'adresse nommément à quelqu'un. Cinq essais partant du vrai point
d'entrée (`messaging-notify.test.ts`).

### DIRECTIVES DIFFUSÉES & CONGÉS COMPLETS — notes de service validées, fiche de demande (2026-08)

**DIRECTIVES.** Une note de service s'adresse rarement à une personne : quatre portées
(`DirectiveAudience`) — **une ou plusieurs personnes**, un rôle, **tous les salariés d'une
entité**, **tous les salariés** — remplacent le couple « une personne OU un rôle » qui obligeait
à émettre quatorze fois la même note. Surtout, **rien ne part sans la direction générale** :
`publication` est un axe SÉPARÉ du statut de traitement (les confondre aurait laissé filer des
notes non relues), la note attend en `PENDING_APPROVAL`, et le DG **publie et envoie d'un même
geste** — approuver sans envoyer laisserait des notes accordées que personne n'a reçues. Une
note écrite PAR le DG part d'emblée (se valider soi-même serait un clic vide). Le **refus exige
un motif**. **Pièce jointe** déposée à l'émission et ouverte depuis la fiche (même `Document` +
même route protégée, avec une garde `DIRECTIVE` qui suit la portée : une note d'entité ne
s'ouvre pas à côté). **Pop-up plein écran** au choix, et **bouton « Renvoyer »** qui rejoue le
même envoi en comptant les diffusions — sans compteur, on renvoie trois fois en croyant renvoyer
une première fois. **Accès du module réglables par le Super Admin** (lire / rédiger, `lib/directives/access.ts`,
carte en Administration › Réglages) — la **publication, elle, ne se règle pas** : l'ouvrir par
une case cochée reviendrait à donner le pouvoir d'écrire au nom de la direction. Côté Adam,
publier/refuser/relancer sont classés **EXCLUDED** (attestations : un document lu pourrait
contenir « publie cette directive »).

**CONGÉS — la vérification a trouvé deux défauts, tous deux corrigés.** (1) La dernière marche
s'appuyait sur `hasGlobalView`, qui **exclut délibérément `GENERAL_MANAGER`** : le rôle qui porte
le nom de l'étape ne pouvait pas la signer, et les demandes s'arrêtaient au dernier barreau.
`isTopManagement` — écrit pour ce cas — remplace le prédicat, dans la décision **et** dans la
file. (2) `chainNotifyRoles("HR")` renvoyait « RH_MANAGER », **absent de l'énumération** : Prisma
refusait la requête entière, l'erreur partait dans un `catch`, et **personne** n'était prévenu de
l'arrivée d'un congé aux RH — pas même le Super Admin, pourtant bien listé. Rôles corrigés, et
`notifyRoles` filtre désormais les noms inconnus au lieu de faire taire tout l'envoi. Le circuit
**N+1 → RH → DG** est prouvé depuis la VRAIE porte (`leave-circuit.test.ts` : 9 tests partant de
`requestLeave`, solde débité au seul dernier barreau). **Suppression Super Admin** d'une demande,
avec **restitution du solde** — et un crochet `restored` symétrique, sinon restaurer depuis la
corbeille rendait le congé ET les jours. **Fiche de demande complète** (`lib/hr/leave-sheet.ts`) :
nom, prénom, fonction, date de recrutement, direction, date de la demande, jours, départ,
**reprise** (le lendemain du dernier jour — les confondre fait attendre quelqu'un un jour trop
tôt), téléphone et intérim ; l'identité se **lit** de la fiche employé et n'y est jamais recopiée,
seuls le téléphone et l'intérimaire sont saisis. Le valideur l'a sous les yeux au moment de signer.

### AUDIT UI/UX & CHARTE — ERP + Adam, tout compté (2026-08)

Audit complet en lecture seule → **`docs/UI_UX_AUDIT.md`**. Méthode : comptages reproductibles
sur le code + contrastes WCAG **calculés** sur les HSL exacts des deux chartes. **Ce qui tient** :
labels.ts (352 tons → 6 tons sémantiques, 248 `<Badge>`), blocks/godmode.css (329 jetons, 4 hex),
lucide seul (428 fichiers), kit partagé adopté (PageHeader 122, .surface 110, EmptyState 73),
chief/ n'importe **zéro** composant ui/, **161/161 pages gardées** (menu = droits côté serveur,
40 modules × 19 rôles). **Les écarts, en chiffres** : 124 hex + 342 palettes brutes dans 52
fichiers (4 fichiers en portent 69 ; amber ×137 là où `--warning` existe) ; contrastes AA en
échec — `warning` 2,64:1 sur badge, `success` 3,60, blanc/`primary` 4,15, trio `.ik-mail`
2,40–3,03, slate-400 en dur 2,56 ×26 ; **mode sombre fantôme** (33 classes `dark:` sans aucun
bloc `.dark`, `theme-color` sombre autour d'une app claire) ; typo hors échelle (11 px ×265
jamais tokenisé, 9 px ×13) ; `focus-visible` sur 4 fichiers, `aria-live` **0**, 595 `<button>`
bruts ; `artifact.css` à 32 hex contre 8 jetons ; utilitaires morts (`.badge-soft` 0 usage) ;
garde d'accès = discipline par page **sans test-balai**. Le rapport fixe la charte cible (8
décisions) et un plan **U1→U8** dont trois lots ≤ 10 fichiers ferment le plus grave, et U4
(palette brute) reçoit un cliquet chiffré comme la dette de frontière.

### ADAM EN CONVERSATION RÉELLE — huit défauts mesurés, fermés en natif (2026-08)

Une conversation réelle du PDG a montré huit défauts nommables ; chacun a son correctif de CODE
(la consigne seule avait déjà échoué). **(1) Liens tronqués** — « [Ouvrir](/regulatory/) » sans
l'identifiant : `link-repair.ts` collecte les liens EXACTS rendus par les outils du tour et
complète tout lien Markdown qui en est un préfixe strict avec candidat UNIQUE (ambigu = intact,
jamais le mauvais dossier) — branché sur les DEUX boucles, flux compris (`reset` + réémission,
comme la passe critique). **(2) « SPO-2026-004 n'existe pas » sur un sponsoring réel** —
`inspect_record` couvre désormais les sponsorings Ad&Pro (référence, id, institution, médecin,
circuit Direction→Direction Marketing→décision, règlement lié, lien exact). **(3) Fiche Regulatory
incohérente** (« Pré-soumission, étapes non démarrées » vs journal « Dépôt fait le 15/07 ») —
la fiche `inspect_record` lit le **circuit ANPP coché** (`RegulatoryProduct.workflow`, la même
source que l'écran) avec frise glissante autour de l'étape courante et `avancementCircuit` ;
la table `RegulatoryStep` (registre mort) n'est plus qu'un repli. **(4) Papier en-tête
inécrivable** (« aucun bloc de texte éditable ») — un corps de document VIDE est un point de
départ : `docx.inserer_paragraphe` sans cible crée le premier paragraphe (avant `w:sectPr`)
ou ajoute À LA FIN en héritant du format du dernier — testé du vrai point d'entrée (ouvrir →
écrire la lettre → sauvegarder). **(5) Export au diagnostic faux** (« échec de lecture » quand
c'est le DÉPÔT Drive qui tombait) — `exportDatasetToDrive` nomme l'étape exacte et reconnaît
le mur 402 du stockage objet. **(6) Question de clarification inutile** (« indique une
référence pour pembrolizumab » alors que la recherche DCI répond en une seconde), **(7)
contradiction entre tours** (mail à Khaled trouvé puis « aucune trace ») et **(8) liens à
recopier tels quels** — trois consignes TEXTE (`TEXT_ONLY_SEMANTICS`, hors budget voix).
Épreuves : `link-repair.test.ts` (goldens du transcript), `inspect-record.test.ts` (ASARI +
Bictegravir sur vraie base), `engine.test.ts` (la lettre du Mawlid sur papier en-tête).

### ADAM RUN 4 JOUÉ — 38/54 · 0 défaut · acceptance 20/22 live, et les correctifs post-run (2026-08)

**Le Run 4 réel** (Render, jeton MTF1QHY3Q02W) : **38/54 SUCCÈS (70,4 % vs 42,6 % au Run 3), 16
conclusions honnêtes, 0 DÉFAUT (vs 2)** ; voie MODÈLE 21/24 (87,5 %) ; acceptance **20 PASS /
2 FAIL / 1 NOT_PROVEN_LIVE** — background, temporel, événements, e-mail, rappels, crash,
massif (120 filles), formes, spéculation, anti-triche, coût, web, concurrence adaptative et
réservation de jetons **prouvés live** ; CACHE_HIT mesuré **42,5 %** (336 823 jetons). L'audit
des non-succès a produit quatre correctifs NATIFS : **(F-A)** la réconciliation des éventails —
une fille contournée par un replan n'est plus une « incohérence de comptage » éternelle
(`controlerQualite(steps, clesContournees)`, annonce d'éventail dédoublonnée et fusions dites ;
le vrai trou — clé annoncée introuvable partout — bloque toujours, sabotage au banc) ;
**(F-B)** `inspect_record` résout désormais les **identifiants internes** qu'une recherche a
rendus (`{ id: ref }` sur les 10 tables — la contradiction CIBLER→LIRE du pipeline direct est
morte, test sur vraie base) ; **(F-D)** le budget de sortie connaît la **recherche web**
(`SUPPLEMENT_RECHERCHE_WEB`, mesuré sur la coupure 3 400/1 774-reasoning du run) et le
rattrapage rejoue UNE fois toute coupure par notre plafond, **tronquée ou vide** — WEB-2/WEB-3
ne meurent plus sur une synthèse coupée ; **(F-E)** la preuve CACHE-1 lit d'abord la mesure de
PRODUCTION de la porte (42,5 % du run) et DIT l'échec de la sonde étroite. **Restent deux
actions humaines** : les tarifs `ADAM_PRICE_*` sur Render (TOTAL_COST = INCONNU, 168 appels
sans tarif) et la facturation du stockage objet (402 sur `read_document`, cause première des
honnêtes DOCUMENT_DRIVE). Détail : `docs/ADAM_PERFORMANCE.md` §K.

### ADAM RUN-4 ACCEPTANCE — chaque capacité prouvée DANS le run, verdict automatique (2026-08)

**La couche d'acceptance** (`src/platform/in-process/missions/acceptance.ts`) : après les 54
missions historiques (intactes, comparables au Run 3), `npm run adam:smoke:deep` joue
**23 scénarios** qui traversent les chemins de production — on raccourcit le temps (horloges
injectées), on simule l'extérieur à la frontière exacte (Gmail `format=full` servi par un fetch
scellé sur le seul hôte Google, raisonneur scripté vérifié contre le schéma strict), mais
**jamais le chemin** : `lancerMission`/`avancerMission`/`control.ts`, le vrai bus d'événements
(`recordEvent` → conséquences → réveil), le vrai balayage temporel, l'outil `plan_reminder`,
`ingestMessage`. Statuts sans ambiguïté : **PASS / FAIL / NOT_PROVEN_LIVE / ECARTE** — en local
(clé absente) : 17 PASS déterministes, 6 NOT_PROVEN_LIVE dits. Couvert : détachement mesuré +
interactif servi pendant le fond, pause/annulation terminale (l'événement en retard ne réveille
rien), priorité SERVIE par l'ordonnanceur, réveil temporel persisté, 4 événements presque-bons
ignorés vs le bon, composition ET à progression persistée, échelle de relances + extinction sur
pièce, pipeline e-mail frontière→document canonique→réveil→dédup, crash avec reçus intacts (zéro
rejeu), éventail 120 unités réelles + progression exacte (vue = base), formes VALIDATED qui
influencent la 4ᵉ planification (`formesProposees` au journal CREATED), spéculation
utile/abandonnée, anti-triche par paraphrase, coût exact-ou-null. **Le verdict §29** est imprimé
par le harnais : HISTORICAL, NEW AUTONOMY, statut par capacité, FALSE_SUCCESS/FALSE_BLOCK,
TOTAL_TOKENS/CACHED/WEB_SEARCH_CALLS et **TOTAL_COST exact ou INCONNU** (appels sans tarif
comptés — jamais un partiel déguisé), alimenté par la porte (`throttle.ts` : conso complète +
20 derniers en-têtes `x-ratelimit-*`) et la **facture par mission** du deep smoke. Détail :
`docs/ADAM_PERFORMANCE.md` §J.

### ADAM RUN-4 — autonomie longue durée : temporel, e-mail, arrière-plan, web, massif (2026-08)

**Le moteur temporel** (`src/lib/missions/events/temporal.ts`) : « demain à 10h », « dans 48h »,
« chaque vendredi », « le 15 septembre » deviennent des échéances persistées (jamais un
`setTimeout`) — le décodeur renonce sur le doute. Appelants réels : `plan_reminder` (champ
`quand`), `snooze_reminder`. **Attentes v2** (`events/match.ts`) : `until` (réveil temporel par
le battement), `threadId` exact, `subject`, `attachment` exigée (« une réponse sans le contrat
ne suffit pas »), compositions `anyOf`/`allOf` à progression persistée — rejeu idempotent,
hors-ordre toléré, et le planner les voit (schéma strict WAIT_EVENT v2). **E-mail entrant = fait** :
l'ingest Gmail émet `EMAIL_RECEIVED` au registre canonique ; cinquième conséquence du registre :
l'**extinction des rappels conditionnels** — échelle de relances (`escalationsH`, 6 barreaux max),
`stopOnEvent` (même grammaire que les missions), report (`snooze_reminder`). **Arrière-plan** :
`lancerEnArrierePlan` rend la main en < 100 ms (talon + finalisation différée idempotente,
échec de planification DIT, rattrapage des processus morts borné à 3), bail d'instance 90 s,
priorité ±10, plafond de modèle (BUDGET_HOLD dormant, jamais échoué). **Recherche web** (§30) :
outil natif `web_search` de Responses — recherches comptées et facturées à l'unité, citations
dédupliquées, coût jamais partiel ; outil `web_research` (provenance TOUJOURS dite : WEB
(EXTERNE) vs MODELE_SANS_RECHERCHE) déclaré capacité de mission (READ, batchable). **§60-65** :
porte de concurrence AIMD (`models/throttle.ts` — 429/Retry-After, soldes `x-ratelimit-*`,
réservation de jetons, retard de boucle), tarif du cache par env (jamais deviné), formes de
plans OBSERVED→VALIDATED (influence, pas autorité — §12), spéculation pendant l'appel planner
(course, jamais jointure). **Massif prouvé** : crash à l'étape 37/50 → reprise sans UN rejeu ;
500 unités avec crash en vague 3 → 500 effets exactement, 9,6 s, Δ tas 23 Mo. État complet et
dépendances externes : `docs/ADAM_PERFORMANCE.md` §I. Rien n'est déclaré « prouvé live » —
`OPENAI_API_KEY` absente ici ; le Run 4 se lance côté exploitation.

### ADAM CLÔTURE — les 31 non-succès du Run 3 réduits à six familles, corrigées en NATIF (2026-08)

**La vérité terrain.** Troisième Deep Live Smoke réel : 23 SUCCÈS / 29 honnêtes / 2 défauts
(baseline 20/32/2), 30/54 directes, motifs nommés. L'audit des 31 non-succès ne laisse AUCUN
mystère : six familles de logiciel, chacune avec sa cause racine, son invariant, son correctif
natif, ses tests et son sabotage (matrice complète : `docs/ADAM_PERFORMANCE.md` §H).

**Livré.** (F1) `RECHERCHES_AVEC_REQUETE` v2 : « exécuté = prévu » — la règle prouve que la
requête PRÉVUE AU PLAN est partie telle quelle (le terme cité « » n'est qu'un repli), fin des
faux refus sur comparaisons A/B et recours par synonymes ; un éventail se prouve sur ses
FILLES. (F2) `AUCUNE_ECRITURE` reconnaît les aboutissements SANS appel écrits par le moteur
(`{expanded}`, `{deduplique}`). (F3) **FICHE v2 = RECHERCHER → CIBLER → LIRE → RÉPONDRE** :
un WORKER cible (0-3 ids RECOPIÉS des résultats), un éventail `read_document`/`inspect_record`
HYDRATE, la synthèse s'appuie sur du CONTENU — et deux défauts structurels découverts au
passage sont fermés pour TOUTES les missions : le worker aval d'un éventail ne voyait pas les
résultats des filles (`hydraterEventail`), et un éventail de LECTURE partiellement échoué
CONCLUT désormais avec ses manques NOMMÉS (§28 : une absence dite est une réponse) — une
ÉCRITURE partielle, elle, échoue toujours. (F4) **La création de mission est un invariant
(100 %)** : le compilateur ASSAINIT les clés hors alphabet (« recherche:federée » ne tue plus
une mission — accents décomposés, références réécrites, collisions suffixées, DUPLICATE_KEY
reste un refus) et RÉPARE les règles citant une étape fantôme à candidat UNIQUE (doctrine
CORRIGEE), sinon les DÉCLASSE en critère sémantique — jamais un refus pour une faute de forme
d'un critère. (F6) Sous plafond de LECTURE, une étape WAIT_INPUT est convertie en synthèse
« ce qui existe / ce qui manque » : une question ne suspend pas sa réponse à son propre
demandeur. (§71) `carteDeScore` dans le Deep Smoke : E2E, création, routes, NON-TRIVIALES
(anti-triche), appels GASPILLÉS, jetons/succès — §78 partout. Annexe : `read_document` ne
passe plus pour une « lecture nue » (contrat CONTENU du registre). PROVEN au prochain run réel.

### ADAM PERFORMANCE, lot 1 — les défauts du Deep Smoke fermés, la voie directe généralisée (2026-08)

**La vérité terrain.** Le premier Deep Live Smoke réel (54 missions sur les données de
production) : 20 SUCCÈS, 32 « conclusions honnêtes », 2 DÉFAUTS, 12 directes, 220 appels,
642 s. L'audit a montré que les 32 honnêtes étaient presque toutes ÉVITABLES : ~13 causées
par un stockage objet répondant **402 (facturation/quota)** que le moteur RETENTAIT en
boucle, ~19 par des critères d'acceptation auto-rédigés improuvables (le juge refuse, le
replan rend un plan vide). Zéro cas certain de « les données n'existent pas ».

**Livré.** (1) **Classement des échecs durables de lecture** (`runner.ts`) : 402/401/403 →
`PROVIDER_FAILURE` non-retryable (l'action humaine est DITE : facturation), 404 objet →
`MISSING_DOCUMENT` ; **court-circuit** par cible (TTL 10 min) — un refus durable ne se
re-paye jamais ; sabotage inverse épinglé (un transitoire reste retryable, jamais
court-circuité). (2) **La FICHE, 3ᵉ forme du chemin direct** : « où en est la tâche
« X » ? », « fais le point sur la facture « X » » — un terme cité + 1-2 familles nommées +
lecture seule prouvée → le CODE compile N recherches parallèles + synthèse schématisée,
3 critères-règles + 1 critère SÉMANTIQUE gardé par le juge (la qualité d'abord) ; capacités
tirées du catalogue réel (une nouvelle `search_*` déclarée enrichit la forme sans toucher
au routeur) ; l'énoncé TACHES réel du run (« aucun plan exploitable ») compile désormais.
Directes attendues : 12/54 → ~30/54. (3) **Orientation des critères du planificateur** vers
la grammaire `[REGLE:…]` vérifiée sur les reçus (un critère-règle ne peut pas rester « sans
preuve » ; dégradation sûre pour les codes inconnus). (4) **Mode PALIERS du Deep Smoke**
(`DEEP_SMOKE_PALIERS="3,5,10"`) : montée en charge par mesure, arrêt automatique si les
défauts montent ou si le P95 double, « concurrence retenue » = le maximum SAIN observé.
Audit complet, classification A/B des 32 honnêtes, états GAP→TESTED du mandat §1-§40 :
`docs/ADAM_PERFORMANCE.md`.

### LATENCE COGNITIVE — le meilleur appel modèle est celui qu'on n'a pas à faire (2026-08)

**Le problème, mesuré au run réel n° 6.** Une mission « prouve l'absence de X dans quatre
sources » : 44 s dont ~99 % d'attente modèle, quatre appels EN FILE — un planificateur de
22 s pour un plan que le code aurait pu écrire, un juge de 9 s pour des critères vérifiables
sur les reçus, un replan de 8 s qui n'a RIEN rendu. Aucun chevauchement.

**Le principe (la règle ultime).** Rien n'est économisé au détriment de la qualité : chaque
appel supprimé l'est parce qu'un mécanisme PLUS STRICT le remplace, et la propriété est dans
le SOFTWARE, pas dans un prompt. Le plan direct passe par le MÊME compilateur, le même QA et
le même juge que le plan d'un modèle ; une règle se vérifie sur les REÇUS d'exécution (plus
fort qu'une prose jugée) ; un code de règle inconnu redevient un critère sémantique jugé par
le LLM ; toute porte sans signal reste OUVERTE (§78).

**Livré (L1→L5, audit AVANT modification, sabotages §22).** `planner/direct.ts` : forme
RECHERCHE multi-sources — terme cité « … » unique, familles nommées ≥2 ou balayage général,
aucun verbe d'effet → le CODE émet N recherches PARALLÈLES + jonction + conclusion
schématisée, critères `[REGLE:…]` (verrous R1–R5, renoncement au moindre doute).
`goal/rules.ts` + `goal/evaluate.ts` : juge HYBRIDE — règles déterministes vérifiées sur les
reçus d'abord (refus déterministe qui nomme sa preuve), juge LLM sur le seul reste
sémantique, tout-règles → 0 appel de juge (§14). `goal/judge.ts` → `runtime.ts` : le juge
peut dire « aucun recours » et la porte de replan saute alors l'appel (`REPLAN_SKIPPED`) —
missions normales : 0 replan (§13). Cascade instrumentée (§18) : voie du plan, appels
chevauchants, facteur de parallélisme, premier résultat utile, « bypass planificateur X/Y »
au résumé du smoke. Banc `parallel-workers.test.ts` : deux workers d'une même vague se
RECOUVRENT réellement (plafond MODELE), et la mission conclut sans que `mission.judge`
n'atteigne le raisonneur. Quatre sabotages structurels (chemin direct coupé → appels de
planificateur remontent ; plafond 1 → chevauchement disparaît ; règle retirée → juge appelé ;
recours présent → replan repart). **PROVEN sur Render (run réel 2026-08-29)** :
PREUVE_ABSENCE **87 s → 3,1 s, 9 appels → 1**, voie DIRECTE (0 appel de planificateur),
COMPLETED avec « TOUS les critères sont des règles vérifiées sur les reçus » (0 juge LLM),
premier résultat utile 128 ms, MISSION_E2E_PROVEN YES. Le run sur l'ANCIEN code avait
révélé un POINT FIXE réel (mission immobilisée en WAITING_DEPENDENCY, non stable) —
CORRIGÉ ici : une dépendance CONTOURNÉE par un replan ne retient plus sa descendante
(`engine.ts#etapesPretes`, épinglé par `bypassed-dependency.test.ts` + sabotage inversé).
Et le **Deep Live Smoke** est né : `npm run adam:smoke:deep` — 60-80 missions VARIÉES
générées depuis les DONNÉES RÉELLES de l'ERP (~19 genres, inventaire mesuré d'abord, genre
sans donnée ÉCARTÉ et dit), même harnais `jouer` que le smoke fournisseur, plafond ANALYZE,
un instrument par mission (concurrence 3), trois verdicts (SUCCÈS / CONCLUSION HONNÊTE /
DÉFAUT — seul DÉFAUT casse la sortie), nettoyage borné à ses propres missions.
Audit et rapport A–T + analyse des deux runs : `docs/COGNITIVE_LATENCY.md`.

### INFORMATION FABRIC — l'information vient à Adam, mesurée voie par voie (2026-08)

**Le problème.** Répondre à « où est X ? » se payait à CHAQUE question : la recherche de
contenu scannait le corpus entier (le seul endroit où la latence croissait linéairement),
« tout ce qui concerne le Pembrolizumab » refaisait une recherche texte qui ne trouvait
jamais les documents ne citant que « Keytruda », les signaux exécutifs refaisaient treize
requêtes par appel, et l'hydratation des candidats coûtait un aller-retour SQL par document.

**Le principe.** Le travail se paie quand l'information ENTRE, plus jamais à la question — et
chaque accélération porte sa MESURE, jamais une affirmation. Cinq briques déterministes dans
`src/lib/fabric/` (façade L2, zéro appel de modèle), branchées dans les points d'entrée
EXISTANTS : `find_documents`, `company_state`, le battement, le registre d'événements.

**Livré (F1→F7, chacune IMPLEMENT → WIRE → TEST → SABOTAGE → BENCH).** Audit réel de
l'existant (extensions Postgres MESURÉES : trgm/unaccent présentes, pgvector absente) ;
FTS+trigrammes en index d'EXPRESSION avec classement à vivier borné — le banc a d'ailleurs
attrapé un défaut de la fabric elle-même (ts_rank non borné, 273 ms) avant la production ;
registre central des sources avec fraîcheur sondée et preuve négative déclarée (outil
`source_map`) ; mentions d'entités extraites à l'ingestion → les ALIAS se franchissent, prouvé
par le vrai point d'entrée ; états chauds précalculés au battement, invalidés par
`recordEvent`, fraîcheur DITE dans chaque réponse, `subjectId` = clé de droits ; loteur de
lectures N logiques → K physiques, mesure affichée dans la couverture. Mesures locales
(20 000 documents) : terme rare 28 → 8 ms, « relié à X » 8 → 1 ms (avec alias), signaux
9 → 1 ms, hydratation de 100 candidats 81 → 2 ms. **PROVEN sur Render (run réel 2026-08-29)** :
FTS 6 ms P50 contre 64 au scan (et elle gagne PARTOUT sur l'infra réelle, conjonction
fréquente comprise), entités 1 ms alias franchis, précalculé 1 ms, lot 2 ms contre 102 à la
pièce — l'écart du loteur a GRANDI avec le réseau, comme prédit. Rapport final complet
(A–V du mandat, états honnêtes) : `docs/INFORMATION_FABRIC.md`.

### LE CENTRE DE MISSIONS — un moteur qu'on peut enfin CONDUIRE (2026-09)

> **Accès (décision de la Direction, 09/2026) : les missions d'Adam sont réservées au Super Admin.** Le Centre
> (`/centre-de-missions`), la page d'une mission (`/missions/<id>`), les quinze actions de conduite, les outils
> `run_mission` / `mission_status` / `mission_control` / `watch_entity` / `list_watches` / `stop_watch`, le
> moteur (`lancerMission`, `lancerEnArrierePlan`, `creerSurveillance`) et l'interrupteur global lisent UN
> prédicat, `peutPiloterMissionsAdam` (`lib/rbac.ts`) ; l'entrée de menu porte la garde `adamMissions`. Le
> battement et le balayage des surveillances relisent l'autorité à chaque passage : une mission dont le
> propriétaire n'est pas (ou plus) Super Admin passe en **pause** avec son motif au journal, jamais supprimée
> (`platform/in-process/missions/habilitation.ts`). Voir le journal « Les missions d'Adam, au Super Admin seul ».

**Le trou, dit sans enjoliver.** Le lot précédent a livré l'horizon : jalons, compilation
paresseuse, fraîcheur des lectures, modification chirurgicale. Tout cela était calculé, testé,
mesuré sur une mission longue réelle — et **invisible**. `VueMission.horizon` existait ; aucun
écran ne le rendait, donc la page d'une mission de sept jalons affichait « 4/5 étapes », c'est-à-dire
les étapes du sous-plan COURANT : « presque fini » sur six semaines de travail restant.
`listerAccordsMission`, écrite pour un écran, n'avait **aucun appelant de production** : un accord
ne se donnait qu'en arrivant par le lien d'une notification, une mission à la fois. Et une mission
d'exécution avait une adresse (`/missions/<id>`, où pointent toutes ses notifications) sans aucune
**liste** — le lien « Toutes les missions » menait à `/missions`, le module RH des ordres de mission,
qui ne contiendrait jamais la mission qu'on venait de quitter.

| Ce qui manquait | Ce qui existe maintenant |
| --- | --- |
| Aucune liste des missions d'exécution | `/centre-de-missions` — le parc, ce qui attend une personne EN TÊTE, puis ce qui est bloqué, puis la priorité, puis la date |
| L'accord ne se donnait qu'une mission à la fois | Les accords en attente sont **décidables depuis le centre** (`listerAccordsMission` a enfin un appelant) |
| L'horizon calculé, jamais affiché | Les jalons, leur **résultat attendu** (celui que le contrôle jugera), et « pas encore de sous-plan — ce jalon n'existe que comme intention » |
| Une seule attente montrée | **Toutes**, avec de qui, depuis quand, et combien de relances déjà parties |
| Le journal, illisible ou absent | Filtré (le bruit est nommé, un genre inconnu s'affiche), les répétitions repliées, **et ce qui a été écarté est compté** |
| La fraîcheur, en base et nulle part | « le forecast a été lu il y a 21 jours » — le faux succès qui n'a aucune signature d'échec |
| La pause, sans mémoire à l'écran | Depuis quand, pourquoi, et ce qu'elle a interrompu |
| Modifier : seulement par la conversation | Un **aperçu qui n'écrit rien** (étapes à refaire, préservées, déjà parties donc non rejouées), puis « Appliquer » |

**Les comptes, et pourquoi ils sont le vrai sujet.** Un tableau de bord ment par son
dénominateur : compter un MODÈLE d'éventail pour un donne « 2/2 » sur trente-trois envois dont
deux ont raté ; garder les étapes d'un plan PÉRIMÉ fait RECULER l'avancement à chaque
replanification ; prendre les étapes du sous-plan pour l'avancement d'une mission longue fait lire
« presque fini » ; et confondre ABOUTI avec FRANCHI affichait « 1/4 » sous une jauge à 50 %
(un jalon écarté comme sans objet est derrière nous sans avoir été accompli). Le compte du parc
se fait en **une requête SQL** qui écarte les modèles d'éventail par le préfixe de clé — sans
`LIKE`, qu'une clé contenant un joker casserait — et jamais en chargeant les étapes : une mission
MASSIVE en a trois mille, et l'écran n'en affiche qu'un ratio. Les deux vues calculent désormais
la même chose, et un test les compare (§118.51).

**Mesuré, écrans ouverts.** `e2e/mission-control.spec.ts` — Playwright contre le **build de
production**, base réelle, zéro appel de modèle, décor posé et retiré par la spec : le parc affiche
« 2/7 jalons » (jamais un ratio d'étapes), l'accord critique est décidable sur place, les sept
jalons sont rendus dont quatre qui « n'existent que comme intention », l'attente nomme Khaled et
ses deux relances, la lecture de 21 jours est signalée, l'étape contournée est dite sans compter,
le journal montre la ligne utile et déclare « 30 lignes de comptabilité du moteur écartées »,
l'aperçu de modification rend son empreinte **et la base est vérifiée inchangée après** — et rien
ne déborde à 375 px. 4/4. Suite unitaire : 42 tests de vue (dont 13 d'architecture qui cherchent
les POINTS D'APPEL, pas les corps).

### L'HORIZON — une mission cesse d'être un plan et devient un objectif découpé (2026-09)

**Le défaut, et il n'était pas de taille.** Une mission était UN plan compilé d'avance. Ça tient
à trente étapes. À trois cents, le plan ne rentre plus dans une fenêtre de modèle — et bien avant
ça, il devient FAUX : le planificateur écrit l'étape 200 sans savoir ce que l'étape 40 aura
trouvé, donc il invente ses références. Un destinataire pas encore identifié, un chiffre pas
encore reçu, un fichier qui n'existe pas. Un plan monolithique de mission longue est un plan qui
parie sur trois semaines d'inconnu.

**Ce qui remplace.** Un objectif durable est découpé en JALONS — un titre et le résultat qu'on
doit pouvoir CONSTATER — et seuls ceux que la frontière atteint sont compilés en étapes. La
compilation paresseuse ne réduit pas un coût : elle rend le plan du jalon 7 informé par le
jalon 6. Mesuré en live sur « prépare le dossier de l'appel d'offres PCH 2026/14 » : **7 jalons,
le premier avec 11 étapes, le dernier avec 0** — parce qu'il n'existe encore que comme intention.

**La fin du plafond global de replans.** `PLANS_MAX = 4` bornait la mission ENTIÈRE : sur sept
jalons, un seul qui s'y reprend à quatre fois consommait le budget des six autres. Ce qui décide
maintenant est le PROGRÈS — tant que le refus CHANGE, un tour de plus vaut son prix ; dès qu'il
revient identique, c'est fini. `Mission.replanBloque` porte ce verdict, la REQUÊTE du battement
le lit, et il se remet à faux dès qu'une information neuve arrive.

**Ce que le banc en deux processus a trouvé, et que rien d'autre n'aurait vu.**

| # | Ce qui était cassé | Ce que ça coûtait |
|---|---|---|
| 1 | La mission longue était **invisible au battement entre deux jalons** — zéro étape PENDING, statut RUNNING non replanifiable | Elle mourait à son **premier jalon** : toute la compilation paresseuse était du code sans effet |
| 2 | Un **jalon BLOQUÉ n'était jamais repris** — le moteur réessayait les étapes, personne ne réessayait le jalon | Une difficulté LOCALE tuait la mission entière |
| 3 | La **fraîcheur était du code mort**, et son test en était complice (il lisait le corps, pas l'appelant) | 53 étapes abouties, 2 332 reçus, **ZÉRO entrée datée** |

**Le troisième est le plus instructif** : `daterLEntree` était écrite, commentée, et couverte par
un test au vert. Son APPEL avait été perdu dans une édition. Le test d'architecture cherche
maintenant le point d'appel, et à l'endroit exact où il doit être.

**Ce qui a été confirmé, sur la même mission live** : pause honorée (51 → 51 étapes abouties
pendant la pause), reprise qui dit depuis combien de temps et ce qu'elle a interrompu, et
modification chirurgicale — « Nesrine à la place de Hetero » : **16 étapes sur 50 invalidées, 32
préservées, 2 jalons rouverts sur 7, 2 effets déjà partis nommés et exclus, reçus identiques
avant et après**. Zéro sortie réelle, garde armée.

`npm run bench:horizon` — `PHASE=1` puis `PHASE=2` dans un **processus neuf**. « Ça survit à un
redémarrage » ne se démontre pas dans le processus qui vient de tout écrire : il mesurerait sa
propre mémoire.

### LE CENTRE DE VALIDATION AD & PRO — deux natures sur sept n'avaient AUCUNE porte (2026-09)

**Demande de la Direction** : « un centre de validation Ad&Pro pour le PDG et super admin, on gère
depuis là-bas le seuil à partir duquel il faut une validation qui passe par ce centre ; toute
demande Ad&Pro dont le budget total est au-dessus du seuil nécessite de passer par là ».

**LA MESURE A DÉCIDÉ DU LOT, ET ELLE A TROUVÉ UN VRAI DÉFAUT.** Le pôle compte SEPT natures ; cinq
portaient déjà une porte au-dessus du seuil (l'étape `dg` des quatre circuits configurables,
`REVIEW_DG` du matériel promotionnel). **Le consulting et les « autres demandes » n'en avaient
AUCUNE** : rien, dans leurs machines à états, ne consultait `adProDgThreshold`, donc un engagement
de 5 M DZD sortait sans que personne en haut l'ait vu — une porte ouverte à côté de cinq portes
gardées (§118.71). Elles reçoivent un **VISA** (`AdProGateVisa`), et `FORME_PORTE:
Record<AdProKind, FormePorte>` fait qu'une huitième nature **ne compile pas** tant que personne
n'a dit quelle porte la garde (§118.130).

**LA FORME DU CENTRE : UNE LENTILLE, PAS UNE SECONDE AUTORISATION.** Reprendre la forme du centre
de paiement — une couche d'autorisation centrale — ferait valider le DG **deux fois** pour les cinq
natures qui portent déjà l'étape `dg`. Le centre montre donc les trois formes de porte au même
endroit et **décide** là où la porte est un visa ; pour une étape de circuit, il renvoie au
dossier, parce qu'une décision se prend devant ses pièces (§104.7). Unifier les sept sur une seule
forme a été **mesuré et refusé** : les instances vivantes posées sur `currentSlug = 'dg'`
deviendraient orphelines et l'`autoSkipMaxAmount` par circuit serait perdu — une régression
déguisée en simplification (§118.86).

**LA RÈGLE ÉTAIT ÉCRITE DEUX FOIS, ET SA PROSE LE PROMETTAIT.** `dgRequis` annonçait « lecture
unique, partagée par le circuit Ad & Pro et par le matériel promotionnel » — et son **seul
importeur du dépôt était son propre test** (§118.14, §118.49), pendant que `etapeApplicable`
recopiait la même arithmétique. La cause est structurelle : `tasks` et `adpro` sont deux domaines
qui n'ont pas le droit de se parler. La règle descend donc au **SOCLE** (`lib/seuils/ad-pro.ts`,
zéro import), `dgRequis` en devient un **réexport**, et le banc exige l'**identité de la fonction**
— une copie qui s'accorde aujourd'hui divergerait demain, et le symptôme serait un matériel
promotionnel de 1,2 M franchissant la porte qu'un sponsoring du même montant respecte (§118.5,
§118.116 : un commentaire qui affirme un partage que le code n'a pas est une dette).

**LE SEUIL SE RÈGLE DEPUIS LE CENTRE**, par la **MÊME** action que l'écran d'administration, avec
les deux écrans revalidés. Un chiffre, cinq lecteurs.

**TROIS DÉFAUTS DE MES PROPRES JUGES, ET LES TROIS ONT LA MÊME LEÇON** (§118.92). (a) Le banc du
seuil comparait « 1 200 000 » avec une espace ORDINAIRE : `toLocaleString("fr-FR")` sépare par
U+202F, et le test a échoué sur une phrase **parfaitement juste** — un juge qui redérive la forme
de ce qu'il vérifie divergera de sa source (§118.120), donc il la lit de la même source. (b) Deux
assertions écrivaient `AD_PRO_OTHER` là où la NATURE s'appelle `OTHER` (`AD_PRO_OTHER` est son
type d'ENTITÉ) — §118.107 avait déjà payé exactement ça sur EVENTS/EVENT. (c) L'assertion du seuil
FIGÉ **ne pouvait pas tomber** : le visa venait d'être posé avec le réglage en vigueur, donc le
seuil figé et le réglage du jour étaient le même nombre et toutes les façons fausses de le lire
étaient vraies — §118.117 mot pour mot, et c'est le sabotage qui l'a dit.

**QUINZE SABOTAGES.** Quatorze tombent individuellement — garde de visa retirée de chacune des deux
décisions, siège élargi à la Direction, PENDING qui laisse passer, seuil inclusif, montant inconnu
qui franchit, `sansMontant` retiré, `dgRequis` redevenu une copie, formulaire de seuil retiré du
centre, porte du réglage ouverte à tous, consulting qui reperd sa porte (le défaut d'origine),
centre non rafraîchi, op qui cesse de couvrir l'action, seuil du jour au lieu du seuil figé. Le
quinzième — l'idempotence du visa — est tenu par **deux gardes indépendantes** (le retour anticipé
et `update: {}`) : chacune retirée seule laisse l'autre debout, **retirées ensemble le banc tombe**.
Le fait est écrit à côté d'elles, parce qu'une redondance doit porter sa raison MESURÉE (§118.116).
**Et trois sabotages ont d'abord été mal faits, pas verts** : `str.replace(…, 1)` frappait l'IMPORT
au lieu de l'appel (§118.139, troisième fois de la session), une ancre était inventée, et un
sabotage ne reproduisait que la MOITIÉ du défaut (§118.134).

**CE QUI N'A PAS PU ÊTRE EXERCÉ, ET C'EST ÉCRIT À CÔTÉ** (§118.82) : aucun chemin de production ne
rappelle `poserVisaAdPro` sur une entité dont le visa est tranché — mesuré sur la machine à états,
`AWAITING_VALIDATION` n'accepte pas `SUBMIT`, et la nature « autre » pose son visa à la création.
La garde protège un appelant futur et la course entre deux soumissions ; elle est exercée sur le
module, et le banc le DIT plutôt que de laisser croire à une vérification par la porte normale.

**CE QUE LE LOT A OUVERT, ET QUELLE GARDE LE VOIT** (§118.80). Le cliquet de parité a refusé —
`gap = 0` est l'invariant — et il ne signalait pas une dette : il nommait une **capacité
manquante**. L'op `adpro_operation/decide_gate_visa` offre les deux directions, comme sa voisine
`decide_other_request`, sur trois faits **mesurés** : le registre des capacités de mission est une
liste **fermée de 62 entrées sans aucune capacité `*_operation`** (donc aucun chemin où le moteur
exécuterait ce visa sans carte), toute op de conversation passe par la **carte de confirmation**
(§118.126), et le **siège est revérifié** par l'action de l'écran (§118.74). Le chemin générique
refuse **81 actions avant comme après** — l'élargissement n'a coûté aucune capacité, et le vérifier
valait plus que le supposer (§118.27).

**TROUVÉ EN RÉGÉNÉRANT L'ARTEFACT ET EN LISANT LE DIFF** (§118.137) : la dérivation ne reconnaissait
une garde qu'aux préfixes `require…`, `can…`, `has…`, `is…`, `peut…`. Trois gardes RÉELLES du parc
sortaient donc avec `gardes: []`, c'est-à-dire l'air de n'être gardées par rien — le siège du
centre de **PAIEMENT** (`sitsOnPaymentCentre`, en production depuis toujours), le cadenas d'un
dossier confidentiel (`holdsRegulatoryLock`, **nommé par §118.80, constaté et laissé**) et le mien.
`allowed…` reste **délibérément dehors** : la même mesure a trouvé
`allowedGeneralMeansCategoryIds`, qui rend une liste d'identifiants et non un droit (§118.79a). Ce
n'est pas un fait de sécurité qui change — c'est ce que la **carte de confirmation** sait dire à une
personne avant qu'elle clique.

**Mesure** : typecheck propre, **8 761 tests verts sur 762 fichiers (0 rouge)**, build propre depuis
un dossier vide avec `/centre-ad-pro` bâtie, artefact des contrats régénéré (**747 actions, 723
appelables, 24 illisibles** — 1 ajoutée, **0 champ perdu, 0 garde perdue, 0 devenue illisible**, 7
améliorées), parité **100 % / gap 0**, frontière **428** et traversées **69** inchangées (le
prédicat de siège passe par le PONT, pas en import direct — §118.114 : le remède est plus petit que
le plafond qu'on aurait relevé), migration `20261117090000_centre_validation_ad_pro` déployée.

