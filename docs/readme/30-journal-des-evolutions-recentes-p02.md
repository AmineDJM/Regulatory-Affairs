### DANS LA PEAU DE CHAQUE EMPLOYÉ — CE QUE LES PARCOURS PAR RÔLE ONT TROUVÉ, ET ADAM RÉSERVÉ AU SUPER ADMIN (2026-09)

Le dirigeant a demandé de tester la plateforme « comme un vrai user », rôle par rôle. Les parcours ont été joués dans
le navigateur contre le build de production, avec des comptes aux vrais rôles et aux vraies portées — et ils ont
trouvé des défauts qu'aucun test ne voyait, parce que tous les tests de navigation éprouvaient le Super Admin.

**CE QUI EST CORRIGÉ.** (1) **Le centre d'actions** (accueil, « Validations à faire ») lisait le statut figé des
dossiers de matériel promotionnel : le Directeur Général voyait « à valider » un dossier déjà validé, et le N+1 comme
l'assistante de direction ne voyaient pas celui qui les attendait. Chacun voit désormais SON tour, avec le vrai nom de
l'étape — et le Super Admin, qui peut tout débloquer, n'est plus inondé des tours des autres. Le même statut exact
s'affiche dans la liste Ad & Pro, sur la fiche d'une demande au secrétariat, sur les postes et les prises en charge.
(2) **Le KAM et le National Sales peuvent demander du matériel promotionnel** sans accès posé à la main (leurs propres
dossiers), et un dossier créé sans entité prend la société qui engage au lieu de naître invisible. (3) **La liste
unifiée Ad & Pro** ne montre plus à un délégué les dossiers promotionnels et les congrès des autres. (4) **Le menu**
n'affiche plus « Projets » (BD) à qui ne peut pas l'ouvrir, ni un sous-menu « Mon Équipe » d'un seul lien. (5) **L'écran
des accès** d'un compte affiche le refus au lieu de « Enregistré » quand l'enregistrement échoue. (6) La fiche d'un
dossier dit **« Montant estimé (demande) »** tant qu'aucun montant n'est retenu. (7) Un document émis depuis le bouton
des Finances n'est plus **attribué « par Adam »** dans les notes et l'audit : c'est le nom de la personne.

**ADAM N'EST PLUS VISIBLE QUE DU SUPER ADMIN** (décision de la Direction ; Adam est en pause de développement).
Menu, pages de l'assistant et du Chief of Staff (sous-pages comprises), routes de conversation et de dictée, voix,
brief du matin de « Aujourd'hui », boutons « Demander au Chief » des fiches Legal et Paiements, onglet « Assistant » de
la barre mobile, palette de commandes, et les actions serveur de la conversation, des réglages d'Adam et de sa boîte
de décision. Les décisions qu'on prenait depuis la boîte d'Adam restent ouvertes à chacun depuis l'écran de leur
module. Rien n'est supprimé : conversations, mémoire et missions restent en base. En chemin, une porte a été fermée :
l'écriture d'un échange dans la mémoire d'Adam était une action serveur publique qui recevait l'identité de la personne
en argument — elle ne l'est plus.

**UNE FUITE DE PORTÉE FERMÉE.** Les pièces jointes, les commentaires et le fil d'un congrès (international ou
national) ou d'un dossier de matériel promotionnel s'ouvraient à quiconque avait le module, sur le seul identifiant du
dossier : un délégué pouvait lire, alimenter et modifier le dossier d'un collègue, alors que la fiche et la liste le lui
cachaient. Ils suivent désormais la même portée que la fiche — l'auteur, et pour le matériel promotionnel le N+1 nommé,
la directrice qui valide, l'assistante et le pharmacien qui instruit ; les rôles qui voient tout le module gardent tout.

**Mesure** : 9 254 tests verts sur 802 fichiers, typecheck et build propres, 45 sabotages joués sur le code final et tous détectés, frontière Adam ↔ ERP à 427 (inchangée). Détail au §118.153 de `CLAUDE.md`.

### MATÉRIEL PROMOTIONNEL — DEVIS RETRANSCRITS, LIGNES RETENUES, BC GÉNÉRÉS PAR LA PLATEFORME (2026-09)

La Direction : le demandeur fait sa demande, **demande les devis** (ils partent à l'assistante de direction), elle les
**retranscrit dans un tableau interne** (référence, unité, prix unitaire, prix total, par fournisseur), le demandeur
**valide un devis entier ou des lignes de plusieurs devis**, la **Direction Marketing** valide (sauf si c'est elle qui
demande), le **DG au-delà du seuil Ad & Pro** ; puis le demandeur **génère ses bons de commande automatiquement** — un
par fournisseur retenu, produits par la plateforme —, peut les modifier, les supprimer, les envoyer, **doit déposer la
ou les factures** (chacune rattachée à son BC) pour demander le paiement ; et à chaque paiement part chez
l'information médicale la **demande de visa publicitaire ou la déclaration au ministère**. La demande elle-même est
validée par la directrice marketing pour un membre du marketing, sinon par le **N+1, jamais au-delà du directeur des
opérations** — et par personne quand c'est lui qui demande.

**CE QUE LA PERSONNE VOIT.** Une demande neuve naît sur ce circuit (« Suivi du circuit » sur la fiche). L'assistante a
sa carte « Devis » : fournisseur de l'annuaire, n°, TVA, taxe additionnelle hors base de TVA, scan obligatoire, et les
lignes ; « Retranscription terminée » refuse tant qu'un devis ne retombe pas sur son total imprimé. Le demandeur coche
des lignes de plusieurs devis et voit le TTC qu'il fixera. Après les validations, la carte « Exécution » : « Générer
les bons de commande », puis, par BC, modifier (ce qui est laissé vide garde sa valeur), annuler, marquer envoyé,
déposer une facture, demander le paiement, adresser la demande de visa. Tout, sauf la retranscription, se fait aussi
en conversation (« retiens tout le devis Atlas et la ligne Kakémono de Stands Sahel, valide »), par une carte à
confirmer. Les dossiers d'avant gardent leur chaîne et peuvent être basculés (« Basculer sur le nouveau circuit »).

**CE QUI A ÉTÉ TROUVÉ EN CHEMIN, et que la relecture n'aurait pas dit.** (1) **Personne ne pouvait générer le BC** :
la fabrique exigeait le droit nominatif d'engager la société, que seul le Super Admin a sur tout le groupe — sous
délégation, la société est désormais NOMMÉE par le dossier (celle du dossier, sinon celle où travaille le demandeur,
jamais celle de qui clique) et doit être lisible par l'émetteur. (2) **Modifier le délai d'un BC effaçait son
adresse** : ce qui n'est pas nommé garde maintenant sa valeur, `null` efface. (3) **La révision par l'assistante
d'un BC émis par le demandeur était refusée** (le fichier vit dans le Drive de l'émetteur) : l'écriture est permise
sur le fichier de CETTE pièce, et d'elle seule. (4) **Deux anciens résolveurs d'Adam listaient en candidats des
dossiers qu'on n'a pas le droit d'ouvrir** : ils passent par la même porte que la fiche. (5) La carte « démarrer le
circuit » promettait encore « devis en main : demande sautée » — réécrite. (6) Le dossier se désigne par
`promoMaterialId` et non `id` : les actions écrivant des tables filles, `id` y aurait désigné la mauvaise table pour
le chemin générique — vu en lisant le diff de l'artefact des contrats. (7) **Le menu « Assistante de direction »
proposait tous les comptes actifs** : le demandeur pouvait nommer un collègue pour recopier les prix qu'il retiendrait
ensuite ; le menu ne liste plus que les assistantes, et l'action refuse tout autre choix, soi-même compris. (8) **Adam
annonçait « prospection d'agences lancée »** à la création : faux sur le circuit 2 — la phrase dit maintenant que la
demande attend sa validation, puis que les devis se demandent depuis la fiche.

**CE QUI NE CHANGE PAS.** Les dossiers ouverts avant restent sur le circuit d'avant (le banc de l'ancien circuit le
garde) ; la retranscription d'un devis reste un geste d'écran — les prix recopiés deviennent le BC puis le paiement,
et un document lu par Adam est une donnée, jamais la main qui écrit ce qui sera payé.

**Mesure** : bancs de 29 (règles pures), 20 (de bout en bout par les vrais points d'entrée, opérations d'Adam
comprises) et 10 (désignation) cas ; **24 sabotages, 24 tombent**, restauration vérifiée octet pour octet ; suite
complète 9 202 tests sur 795 fichiers, 0 rouge. Artefact des
contrats 766 actions / 742 appelables / 24 illisibles ; parité 100 %, écart 0 ; frontière Adam ↔ ERP **428 → 427**,
traversées **69 → 68** (le même déplacement : l'op d'Adam lit les étapes par le pont), fournisseurs 42, cycles 0 —
mesurés au chiffre près. Détail au §118.152 de `CLAUDE.md`.

### SPONSORING — LA TENUE D'ABORD, LES POSTES ENSUITE, L'ARGENT À LA CLÔTURE (2026-09)

La Direction : un sponsoring se demande par ce que **le médecin demande** et ce que **le délégué suggère** ; il naît
dans un **poste** (direct à l'association, ou indirect — prise en charge) ; la Direction Marketing **pré-valide la
tenue** ; on prépare les postes (devis, BC, factures) ; puis elle **valide tout, range chaque poste dans un budget et
clôture**.

**CE QUE LA PERSONNE VOIT.** À la création, deux montants aux libellés de la Direction et un choix « direct /
indirect » ; la demande naît avec son poste, que la fiche montre sous « Postes de la demande ». La dernière étape du
circuit s'appelle désormais « Pré-validation de la tenue (Direction Marketing) » et ne demande plus de montant. Une
fois pré-validée, un bloc **« Validation finale et clôture »** dit ce qui manque encore — nommément, en une fois —,
affiche le total qui sera accordé, et porte le bouton « Valider et clôturer » ; clôturée, il montre qui, quand,
combien, et le geste **« Rouvrir la demande »** (motif obligatoire). Adam le fait aussi, par une carte à confirmer
(« clôture le sponsoring SPO-2026-014 »).

**CE QUI A ÉTÉ PROTÉGÉ, parce que chaque changement déplaçait une vérité ailleurs.** (1) Aucun ordre GLOBAL n'est émis
sur une tenue pré-validée — ni par le circuit, ni par la validation de la déclaration d'information médicale — : les
postes portent la dépense, et un ordre de plus la paierait deux fois. (2) Régler l'ordre d'un POSTE passait la
demande entière à « payée » : une demande clôturée serait repassée à « payée », une pré-validée aurait sauté sa
clôture. Seul un accord global de l'ancien circuit se solde désormais par son règlement. (3) La déclaration PRIM part
à la pré-validation — l'événement se déclare AVANT d'avoir lieu — avec l'estimation de ses postes (accordé s'il est
fixé, estimé sinon, refusés exclus), puisqu'aucun montant n'est encore accordé. (4) Deux clics simultanés ne
clôturent qu'une fois. (5) Une tenue pré-validée ou des postes déjà engagés ferment le transfert vers un autre module.
(6) Le panneau du circuit dit l'étape suivante réelle (« les postes se préparent », puis « validée et clôturée ») au
lieu de « en cours de traitement (information médicale / Finances) », et la carte de risque d'un sponsoring bloqué
relance la personne qu'on attend VRAIMENT — lue sur l'étape courante du circuit, plus sur un statut qui couvre deux
étapes (elle relançait « la Direction » pour une pré-validation de la Direction Marketing).

**CE QUI NE CHANGE PAS.** Congrès et événements gardent la décision à montant. Un circuit remodelé par un Super Admin
qui fixe encore un montant accorde comme avant ; la migration ne touche que l'étape de la Direction Marketing du
sponsoring encore à sa graine. Les trois anciennes décisions de sponsoring d'Adam (préliminaire, analyse, définitive),
qui n'avaient plus de porte depuis le circuit dynamique, sont retirées ; la clôture et la réouverture les remplacent.

**Mesure** : banc de flux de 17 cas par les vrais points d'entrée (création, circuit, pré-validation, postes,
clôture refusée puis réussie, gel, exécution après clôture, déclaration, réouverture, clics simultanés, demande de
la Direction Marketing elle-même, transfert, ancien circuit) ; cliquet de 18 points d'appel ; 22 sabotages joués,
**22 tombent**, restauration vérifiée octet pour octet. Artefact des contrats 753 actions / 729 appelables / 24
illisibles ; parité 100 % ; frontière 428, traversées 69, fournisseurs 42, cycles 0 — mesurés au chiffre près.
Détail au §118.151 de `CLAUDE.md`.

### CONSULTING — UN CONTRAT PASSE D'AD & PRO AUX RH, PAR UN GESTE ET SANS RIEN PERDRE (2026-09)

La Direction : « Transfère le consulting actuel de Consultant médical — Atakor Minds, qui est dans Consulting d'Ad&Pro,
à un consulting en RH. »

**MESURÉ D'ABORD : CÔTÉ RH, IL N'Y AVAIT NULLE PART OÙ LE METTRE.** Un consultant n'y existait que comme demande de
recrutement « Consulting », close « consultant externe », sans fiche ni contrat à suivre. Recopier le contrat aurait
fait deux références, deux historiques et deux montants pour un seul engagement. Le contrat porte donc un **pôle**
(Ad & Pro par défaut, ou Ressources humaines) et **RH › Consultants** liste ceux du pôle RH avec la même table que
Ad & Pro › Consulting ; la fiche est commune.

**UN GESTE, PAS UNE MIGRATION.** Le déploiement ne change le pôle d'AUCUN contrat : décider qu'un contrat relève des RH
revient à une personne. Sur la fiche, **« Transférer vers Ressources humaines »** (et le geste inverse), réservé à qui
peut modifier les deux modules — par défaut Super Admin, Direction, Directeur Général ; Adam le propose aussi
(« transfère le contrat de consulting Atakor Minds aux RH »), par une carte à confirmer. Rien n'est perdu : référence,
tâches, pièces, validation et historique suivent, et la gamme, les praticiens et les produits restent sur la ligne.

**DOUZE ENDROITS CROYAIENT QU'UN CONTRAT DE CONSULTING EST UNE DÉPENSE DE PROMOTION.** La liste d'Ad & Pro ›
Consulting, la fiche (gardée par « Consulting » en dur), les actions, la garde par enregistrement, le registre de l'API et d'Adam, la liste d'Ad & Pro,
le centre de validation Ad & Pro, l'aiguillage des bons de commande, l'imputation d'un paiement, la désignation d'un
contrat par Adam… Tous lisent maintenant le module du pôle **sur la ligne** : la promotion ne voit plus un contrat
passé aux RH (rémunération comprise), les RH le voient et le gèrent, ses bons de commande en attente passent au centre
de validations, et un paiement se classe sur une enveloppe RH. Ce que le transfert **déplace** est dit dans sa phrase :
une validation en attente au centre Ad & Pro est retirée (une décision déjà prise reste), un validateur désigné sans
droit de valider côté RH perd sa désignation (la Direction est prévenue), et le porteur du contrat est averti.

**DEUX DÉFAUTS TROUVÉS EN CHEMIN.** (1) Adam cherchait un contrat directement dans la table, sans regarder qui
demandait : une désignation ambiguë listait l'intitulé et le consultant de contrats que la personne n'a pas le droit
de lire. Elle passe désormais par le résolveur unique, sous la même portée que l'écran. (2) Au bureau du secrétariat,
l'action qui termine une demande tenait sa propre liste des natures Ad & Pro — cinq — quand la page en lisait huit :
sur un achat lié à un poste, la page masquait l'imputation que l'action exigeait, et la demande ne pouvait plus être
terminée. Une seule fonction pour les deux.

**Mesure** : 26 sabotages joués, tous tombent, restauration vérifiée octet pour octet ; banc de flux de 16 cas par les
vrais points d'entrée avec des acteurs sans vue globale ; 5 cas dans le NAVIGATEUR contre le build de production (le
bouton, les deux listes, la Direction Marketing qui ne voit plus le contrat, le geste inverse) ; un cliquet exige que
toute liste de contrats nomme le pôle. Suite complète : 788 fichiers, 9 077 tests, 0 rouge. Détail au §118.150 de
`CLAUDE.md`. **Le contrat d'Atakor Minds lui-même n'a pas été touché** : après déploiement, une personne habilitée ouvre
sa fiche et clique « Transférer vers Ressources humaines ».

### BONS DE COMMANDE — UN SEUIL RÉGLÉ AU CENTRE, PUIS LA SIGNATURE DES FINANCES ; ET LE BOUTON « BC » DANS LEGAL (2026-09)

Trois phrases de la Direction : « Le bouton pour les BC, c'est dans Legal. » — « Tout BC supérieur à un montant
configuré dans les centres de validations Ad&Pro devra passer par la validation d'un des centres de validation. » —
« Un sous-module spécial sous Finances : Bons de commande — les bons de commande à signer de leur part. Si un BC se
retrouve là-bas, c'est qu'il doit être signé. »

**LE SEUIL.** Un réglage à part, réglé depuis le centre de validation Ad & Pro par ses sièges (et par Adam, par
l'action de l'écran). Strictement au-dessus : un centre, comme avant ; en deçà : directement à la signature des
Finances ; montant inconnu : un centre. Il part à **0 — tout BC passe par un centre** : la Direction choisit le
montant, le code n'en invente pas un. Le changer RÉAIGUILLE les BC en vol qui changent de côté (et le dit) ; une
validation donnée ou une signature ne se retirent pas.

**LA SIGNATURE.** Finances › Bons de commande ne montre que ce qui est à signer — validé par son centre ou sous le
seuil — avec la raison, la pièce et le bouton. Signer est une attestation : un clic humain, jamais Adam. Le verrou
porte sur la dernière écriture de la pièce, deux clics simultanés n'en font qu'un, et un BC modifié après signature
(montant, fournisseur, révision) la perd. Les BC d'avant le circuit n'apparaissent pas dans la file : fixer un seuil
ne fait pas tomber l'historique chez les Finances.

**CE QUE LA MESURE A TROUVÉ EN CHEMIN.** (1) `LegalDocument.signedAt` existait déjà — c'est la date de signature
PAPIER des contrats du PCH ; re-qualifier un contrat signé en BC l'aurait fait passer pour signé par les Finances. Une
date sans signataire ne vaut plus signature, et la date retirée est consignée au journal. (2) Le seuil du DG était
déclaré « couvert » pour Adam par `update_platform_setting`, qui ne le connaissait pas : les deux seuils ont
maintenant leur op, qui appelle l'action de l'écran. (3) La re-lecture des BC après un changement de seuil lisait
d'abord les N premiers BC de la base puis triait : sur une base chargée, ceux qui changent de côté pouvaient tomber
après la borne ; la bande de montants est calculée AVANT de lire. (4) `FileSignature` n'est plus dans la table de noms
de lucide : l'icône aurait disparu sans erreur. Mesuré sur tout le dépôt, SEPT noms passés en chaîne (`AlertTriangle`,
`CheckCircle2`, `XCircle`…) ne dessinaient déjà rien sur une douzaine d'écrans. Le résolveur unique (`components/ui/icon.tsx`)
accepte les anciens noms que lucide exporte encore, et `icon-names.test.ts` exige que les 145 noms de la source résolvent
— par le COMPOSANT, pas seulement par sa fonction.

**Mesure** : 28 sabotages joués, tous tombent, restauration vérifiée octet pour octet ; artefact des contrats
753 actions / 729 appelables / 24 illisibles ; parité, frontière (428), domaines et bundle client inchangés.
Détail au §118.149 de `CLAUDE.md`.

### « TOUS LES PAIEMENTS PAR LE CENTRE, TOUS LES BC PAR UN CENTRE DE VALIDATION » — et les portes qui passaient à côté (2026-09)

Deux règles de la Direction, énoncées en deux lignes : « Concernant les paiements, c'est clair, tous passent par le
centre de paiements. Concernant les BC, ils doivent tous passer soit par le centre de validation Ad&Pro si la demande
est depuis Ad&Pro, soit par le centre de validation normal, si elle provient de quelque part d'autre. » La première
était déjà écrite dans le code ; la mesure a montré par où elle fuyait. La seconde n'existait nulle part.

**LES PAIEMENTS : LA RÈGLE ÉTAIT JUSTE, SIX PORTES PASSAIENT À CÔTÉ.** Un dossier compagnon se tranchait dans le
dossier (la garde existait, sans appelant) ; relever un budget accordé de congrès laissait l'ordre autorisé pour
l'ancien montant ; « annule ce qu'Adam a modifié » pouvait remettre « Autorisé » sur un ordre que le centre venait de
rouvrir ; `updateInvoice` posait une date de règlement sur une facture partie au centre ; le matériel promotionnel
déclarait son paiement fait sans ordre payé, par trois gestes différents ; la rallonge de caisse sortait de la banque
sans écriture. Toutes sont fermées par leur vrai point d'entrée, et **un cliquet** tient le reste : un seul écrivain
d'ordre de dépense, qui fait naître l'ordre au centre — parce que le défaut du schéma (`NOT_REQUIRED`) est l'état que
le verrou laisse payer, et qu'un second écrivain ajouté demain l'hériterait en silence. **Ce qui n'y passe pas est
NOMMÉ** : paie, remise de caisse et rallonge sont trois exceptions écrites au registre, chacune avec la décision
qu'elle attend de la Direction.

**LES BC : DEUX CENTRES, CHOISIS PAR L'ORIGINE.** Un BC né d'une demande Ad & Pro — même au bout d'un chemin qui
passe par le secrétariat ou un dossier de paiement — va au centre de validation Ad & Pro (un visa sans seuil) ; tout
autre BC au centre de validations. Une seule porte par BC (celui d'un poste Ad & Pro a déjà la sienne), et des
transitions écrites une fois : transférée si on le rattache après coup, rouverte s'il est relevé après validation,
jamais déplacée ni contournée après un refus. La facture qui en découle ne part pas au paiement tant que le BC n'est
pas validé, et toute phrase qui annonce un BC dit qu'il attend son centre — sinon il part chez le fournisseur parce
qu'il en a l'air.

**DEUX DÉFAUTS TROUVÉS EN BRANCHANT.** Le formulaire « Pièces liées » refusait toute création de document Legal (il
envoyait la partie en texte, Legal exige l'annuaire) — c'est pourtant le geste que le refus du chantier BC nomme. Et
Adam écrivait la partie en texte libre : sa création échouait après le clic. Les deux passent maintenant par
l'annuaire.

**VINGT-CINQ BC D'UN COUP, ET LES DERNIERS SORTAIENT SANS PORTE.** La suite complète était verte ; ses journaux ne
l'étaient pas. Dix BC émis en parallèle posent dix demandes de validation dont la référence `VAL-AAAA-NNN` se dérive du
maximum : au-delà de six essais, la demande n'était pas créée et le BC sortait hors de tout centre, avec une phrase
muette. Les créations d'une même série de références passent désormais une par une (`enSerie`), un aiguillage qui
échoue le DIT (« il n'est PAS validé », avec « Adresser au centre »), et réémettre un BC identique — la reprise d'une
mission — lui pose la porte qui lui manquait. Côté bancs, un siège de centre stable (`vitest.global-setup.ts`) remplace
le Directeur Général qu'un banc venait de créer et que tous les autres désignaient.

**Mesure** : 29 + 9 sabotages joués, tous tombent, chacun vérifié sur son témoin — dont un qui a montré qu'une assertion
existante (`/centre de paiement/`) passait AVANT que la garde qu'elle prétendait tenir ait un appelant : un autre refus
disait les mêmes mots. **Suite complète : 783 fichiers, 9 007 tests, 0 rouge.** Détail au §118.148 de `CLAUDE.md`.
**Précisé depuis par la Direction** : seuls les BC au-dessus d'un montant réglé depuis le centre Ad & Pro passent par un
centre, puis les Finances les signent — c'est le lot suivant.

### MESSAGERIE & NOTIFICATIONS — LE SUPER ADMIN PEUT ENFIN RETIRER CE QUI N'A PAS À RESTER (2026-09)

Demande du dirigeant en deux temps : « permets au super admin de supprimer des messages et des groupes », puis
« également la possibilité de supprimer des notifications reçues par des users et donc ils les verront plus ».
**La mesure a décidé de la forme du lot**, et elle a donné trois réponses différentes pour trois demandes qui se
ressemblaient.

**LE MESSAGE : LA PERMISSION EXISTAIT, L'ÉCRAN NE LA LISAIT PAS.** `deleteMessage` accepte depuis toujours trois
faits — un rôle à **vue globale**, l'**auteur**, ou quelqu'un qui **gère** la conversation. L'écran, lui, calculait
`canModerate = myRole === "OWNER" || myRole === "ADMIN"` et **ignorait la vue globale** : un Super Admin qui n'était
ni auteur ni propriétaire du groupe ne voyait jamais le bouton que l'action aurait accepté. Une capacité écrite,
gardée, testée — et inatteignable depuis l'écran. Les trois faits sont désormais NOMMÉS une seule fois, au socle
(`lib/messaging-ui.ts`, le module que le navigateur **et** le serveur ont le droit d'importer), et un cliquet
cherche le **point d'appel** des deux côtés : vérifier le corps de la règle ne prouverait rien, puisque le défaut
n'était pas une règle fausse mais une règle que l'écran ne lisait pas. La lecture reste **exactement** celle de
l'action (`hasGlobalView(user.role)`, la chaîne, donc sans casquette secondaire) : l'élargir serait une décision de
permission, pas une ligne de code. Le corps d'un message supprimé n'était déjà plus servi (`mapMessage` le masque),
donc le geste n'avait pas besoin d'une seconde suppression : il avait besoin d'un bouton.

**LE GROUPE : IL N'EXISTAIT AUCUNE SUPPRESSION, ET AUCUN ENDROIT POUR L'ATTEINDRE.** La messagerie ne savait
qu'**archiver** — ce qui laisse la conversation vivante pour ses membres — et sa LECTURE est cloisonnée par
appartenance : un groupe qu'on n'a pas rejoint n'apparaît nulle part. Le geste passe donc par le patron canonique
(`DELETE_REGISTRY` → `superAdminDelete` → instantané → corbeille → audit, outil `delete_record` d'Adam compris) :
**deux entrées de registre**, pas une seconde logique de suppression. Et un écran d'administration
(`/admin/messagerie`) qui montre des **métadonnées seulement** — type, nom, membres, messages, dernière activité,
auteur. Jamais un corps de message : ouvrir le contenu des conversations privées depuis l'administration serait une
décision de permission qui appartient à la Direction, et un écran d'administration qui donne accidentellement la
lecture est une porte dérobée.

**CE QU'UN REFUS DOIT POUVOIR DIRE.** Un **tête-à-tête** ne se supprime pas : c'est l'échange privé de deux
personnes. Sans crochet dédié, ce refus légitime n'avait que deux sorties, toutes deux fausses — `describe` rendant
`null` dit « introuvable » d'un objet parfaitement présent, et une exception dans `remove` est avalée par « des
éléments liés bloquent, détachez-les puis réessayez », un diagnostic inventé sur un geste qu'aucun détachement ne
débloquera. `KindSpec.refuse?` vit donc dans le cœur partagé, **avant tout instantané**, donc il vaut pour l'écran
comme pour Adam — dont la carte de confirmation le lit AVANT d'être construite, parce qu'une garde se place avant,
jamais après le clic.

**LA RÉSERVE ENTRE DANS LA PHRASE.** Supprimer un groupe emporte ses membres et ses messages en cascade, et
l'instantané ne garde que la ligne principale : **une restauration rend un groupe VIDE**. La réserve générique
(« les lignes liées en cascade ne sont pas restaurables ») est vraie et illisible ; ici la cascade EST le contenu.
`KindSpec.reserve?` porte donc la phrase, lue par l'écran ET par la carte d'Adam — deux rédactions de la même
réserve finiraient par dire deux choses différentes. Le banc l'ÉPROUVE : il supprime un groupe de 2 membres et
1 message, restaure, et exige **0 membre / 0 message**. Si ce cas passait avec 2 membres, la phrase serait un
mensonge.

**ET DEUX VÉRITÉS SE CONTREDISAIENT DANS LE MÊME DIALOGUE — c'est mon propre avertissement qui l'a révélé.** La
confirmation annonçait « **cette action ne peut pas être annulée** » alors que `snapshotAndSoftDelete` dépose
l'instantané dans la corbeille depuis toujours. Celle que la personne LIT était la fausse : elle décourageait un
rangement parfaitement défaisable, ou faisait croire un élément perdu. Corrigée pour les **28 types**, avec un
cliquet qui vérifie d'abord la **prémisse** (l'écriture de `DeletedRecord`) — sans quoi l'assertion n'aurait aucune
raison d'être.

**DEUX SABOTAGES SONT PASSÉS AU VERT, ET LES DEUX FOIS C'ÉTAIT MON BANC.** (1) Débornier la LISTE de l'écran en
laissant le COMPTE intact : mon cliquet cherchait la clause n'importe où dans le fichier, donc le littéral restait
présent. Il juge maintenant **requête par requête**, et un troisième accès ajouté demain devra déclarer sa portée.
(2) Retirer la porte d'appartenance de `deleteMessage` : aucun cas n'exerçait la seule situation où elle compte —
quelqu'un qui a **quitté** la conversation et veut retirer son propre ancien message. Mon commentaire l'affirmait ;
rien ne l'éprouvait. Le cas existe désormais, dans les deux sens (parti → refusé, revenu → accepté).

**Le renommage a fait perdre leur garde déclarée à quatre actions**, et c'est l'artefact régénéré qui l'a dit :
`canManage` était reconnu comme garde par son préfixe `can…`, `gereLaConversation` ne l'était pas. Ajouter `gere…`
à la liste des préfixes aurait été pire (`gerer…` — un impératif, donc une action — commence par les mêmes
lettres) : le prédicat est renommé `peutGererLaConversation`, un nom de prédicat que la dérivation reconnaît déjà.
Diff final de l'artefact : un renommage, **0 garde perdue**, et `deleteMessage` en **gagne** une.

**Mesure** : typecheck propre, **8 785 tests verts sur 765 fichiers**, build propre depuis un dossier vide,
artefact des contrats **747 actions / 723 appelables / 24 illisibles** (inchangé), parité **100 % / gap 0**,
frontière **428** et traversées **69** inchangées, **20 sabotages joués / 20 propriétés tenues** (dont 2 après
réparation du banc), restauration comparée fichier par fichier après chaque tour.

### Ad & PRO — LE SERVICE REPREND SON NOM, ET LE PÔLE ENTIER PASSE À LA DIRECTION MARKETING (2026-09)

**Trois corrections de la Direction** sur le lot précédent : « transforme Direction en **Direction des
opérations** » ; « **Direction Marketing reçoit la gestion de Ad&Pro**, pas que sponsoring et matériel
promotionnel » ; « je vois toujours établissements dans promotion médicale ».

**LE LIBELLÉ ROGNÉ ÉTAIT UNE GARDE QUE PERSONNE NE TENAIT.** `DIRECTION` s'affichait « Direction » tout court : le
libellé avait été raccourci par crainte d'une confusion avec `OPERATIONS_DIRECTOR` (« Directeur des Opérations »),
devenu un rôle à part. La crainte était fondée — deux entrées de même nom dans un menu déroulant de rôles sont la
garantie d'attribuer le mauvais — et le remède était un **mot amputé**, c'est-à-dire rien du tout : aucun code ne
vérifiait l'unicité, et le mot ne disait plus ce que le métier appelle ce service. Le libellé est rétabli, et ce qui
protège désormais est un FAIT vérifié à chaque `npm test` (`src/lib/role-labels.test.ts`) : les **19 libellés** sont
distincts deux à deux après normalisation (casse, accents, espaces), et **chacun des 19 rôles** de l'énumération en
porte un — deux questions, deux assertions, parce qu'une garde qui n'exige que l'unicité laisserait un rôle
s'afficher sous son nom d'énumération. « Direction des opérations » nomme un **service**, « Directeur des
Opérations » nomme une **personne** : deux vocabulaires, jamais confondus.

Vérifié avant de renommer plutôt que supposé : `resolveByLabel` normalise le **code** autant que le libellé, donc
« Direction » — le mot que le dirigeant emploie à l'oral — continue de résoudre vers `DIRECTION` dans la
conversation. Rallonger un libellé n'a fermé aucune façon de nommer ce service.

**LA MOITIÉ DU PÔLE MANQUAIT À CELLE QUI LE TRANCHE.** Le pôle Ad & Pro compte **sept** natures ; la Direction
Marketing n'en avait que cinq (`SPONSORING`, `CONGRESS_INTERNATIONAL`, `CONGRESS_NATIONAL`, `EVENTS`,
`PROMO_MATERIAL`). `CONSULTING` et `AD_PRO_OTHER` lui étaient fermés — elle décidait donc de demandes qu'elle ne
pouvait pas ouvrir, et le ciblage des notifications (`rolesWithModule`) ne la trouvait pas dessus. Les sept modules
sont désormais à elle en **MANAGE**.

Réparer deux modules à la main ne protège pas le huitième. Le cliquet s'arme donc sur le **registre canonique** des
natures (`AD_PRO_KINDS` de `src/lib/ad-pro/unified.ts`), l'endroit où toutes les instances passent :
`src/lib/ad-pro/pole.test.ts` exige que chaque module nommé par ce registre soit ouvert à la Direction Marketing en
VIEW / CREATE / UPDATE / VALIDATE, **et nomme le module fautif**. La permission reste **écrite** dans `rbac.ts`
comme pour tous les autres rôles — la dériver accorderait MANAGE sur une huitième nature dont personne n'aurait
décidé, et le socle n'a de toute façon pas le droit de lire `lib/ad-pro/`. Au passage, `KindSpec.module` est typé
`Module` au lieu de `string` : un nom de module mal orthographié dans le registre ne compile plus.

**« JE VOIS TOUJOURS ÉTABLISSEMENTS » — MESURÉ, ET CE N'EST PAS UN SECOND ONGLET.** `MEDICAL_TABS` est la **seule**
source de cet onglet (trois pages la lisent, `/medical` n'est qu'une redirection), et l'onglet en est retiré depuis
le lot précédent. L'onglet visible est celui de la version **déployée** : la branche de déploiement portait encore
le commit d'avant. Le référentiel des hôpitaux ne vit qu'à un endroit — Administration › Annuaires ›
Établissements — et `/medical/etablissements` redirige, pour que les liens déjà envoyés restent valides.

**Vérification** : typecheck propre · `npm test` vert · build propre depuis un dossier vide · artefact des contrats
d'action régénéré et **identique** (746 actions, 722 appelables, 24 illisibles) · **13 sabotages, 13 chutes**,
chacune sur son témoin nommé.

Deux enseignements de méthode, tous deux payés dans ce lot. **Un sabotage se vérifie comme une réparation** : deux
de mes sabotages sont passés au vert et la cause n'était pas le code — `str.replace(motif, …, 1)` frappait la
**première** occurrence du fichier, c'est-à-dire la ligne d'un AUTRE rôle, et `PRODUCT_MANAGER` n'était jamais
touché. Ancrés dans le bon bloc, les deux tombent. **Et une normalisation qu'on ne peut pas exercer n'est pas une
assertion** : mesuré, les 19 libellés d'aujourd'hui sont distincts avec comme sans normalisation, donc la retirer du
cliquet ne l'aurait pas fait tomber. Elle est désormais exercée sur des paires construites, et le dire valait mieux
que de laisser croire à une vérification qui n'avait pas eu lieu.


### Ad & PRO — L'ORDRE S'INVERSE, DIRECTION MARKETING TRANCHE, ET LE DG GARDE LES GROSSES DÉPENSES (2026-09)

**Ce que la Direction a tranché**, en cinq phrases : « la section événement doit être comme sponsoring en terme de
circuit de validation » ; « toutes les Ad&Pro, hors matériel promotionnel, devront passer par **Direction des
opérations PUIS Direction Marketing** à la fin, et pas l'inverse comme c'est le cas maintenant — c'est d'ailleurs le
mot de la Direction Marketing qui est **définitif**, et elle choisit le budget dans lequel l'accorder » ; « pour
toutes les demandes Ad&Pro, matériel promotionnel compris, **la validation du DG à partir de 1 000 000 DZD**, mais ce
seuil doit pouvoir être configuré par le super admin » ; « dans le matériel promotionnel, c'est devis demandés puis
validation du demandeur puis validation du N+1 — **ce n'est plus le N+1 le validateur, c'est la Direction
Marketing**, et cette étape n'est pas nécessaire si c'est elle qui demande » ; « **des fois un événement n'est pas
encore validé et pourtant son état est validé, répare ça !** »

**LA COLONNE VERTÉBRALE, DANS SON NOUVEL ORDRE** (`src/lib/workflow/defaults.ts`, quatre étapes pour les quatre
catégories) :

> Approbation préliminaire (National Sales) → **porte du Directeur Général** (franchie automatiquement et tracée sous
> le seuil) → Validation (Direction des opérations) → **Décision et budget (Direction Marketing)**, qui TRANCHE,
> fixe le montant accordé, choisit la sous-catégorie budgétaire et déclenche l'information médicale puis l'ordre de
> dépense.

Chaque parcours reste une **tranche contiguë** de cette chaîne (`workflow/parcours.ts`, module pur) : un KAM la
parcourt entière, un demandeur ordinaire ou le National Sales entre par la porte du DG, Direction Marketing y entre
aussi mais sa chaîne s'arrête chez la Direction — on ne fait pas trancher à quelqu'un sa propre demande —, et la
Direction, le DG et le Super Admin vont directement à la décision. Deux bornes suffisent, et c'est ce qui fait tenir
la terminalité, la projection de l'accord, l'héritage des émissions et la levée du caviardage dans un seul endroit.

**POURQUOI « DIRECTION DES OPÉRATIONS » EST LE RÔLE `DIRECTION`.** La demande dit « pas l'inverse comme c'est le cas
now » : elle décrit un ÉCHANGE entre les deux étapes existantes, pas l'insertion d'un acteur nouveau. Et le libellé du
rôle `DIRECTION` était littéralement « Direction des opérations » jusqu'à ce que le Directeur des Opérations devienne
un rôle à part. L'autre lecture exigerait d'OUVRIR les modules Ad & Pro à `OPERATIONS_DIRECTOR`, qui n'en a aucun :
une décision de permission, qui appartient à la Direction. Si c'est bien elle qui était voulue, il suffit d'ajouter
`OPERATIONS_DIRECTOR` aux rôles de l'étape `final` — un réglage, pas une réécriture.

**LE SEUIL DU DG EST UN RÉGLAGE, ET UN SEUL** (`AppSetting.adProDgThreshold`, défaut 1 000 000 DZD, Administration ›
Réglages). Le même chiffre gouverne les quatre circuits configurables ET le matériel promotionnel, qui n'a pas
d'étapes en base : cinq copies auraient divergé au premier ajustement. Un « Seuil DZD » écrit à la main sur une étape
l'emporte pour ce circuit — une décision explicite ne se fait pas écraser en silence. Un montant INCONNU fait passer
par le DG : on ne franchit pas une porte de contrôle sur une absence de donnée.

**TROIS GESTES D'AVANCE, ET IL FALLAIT LES TROIS.** Les franchissements automatiques ne se réglaient qu'après une
APPROBATION. Ils se règlent maintenant aussi **à la naissance de l'instance** (un demandeur non-KAM ENTRE sur la
porte du DG : sans cela sa demande y restait pour toujours, à attendre quelqu'un qui n'a rien à valider) et **après un
avis défavorable** (même situation, par la troisième porte). Une porte gardée à côté d'une porte ouverte, et c'est la
même chose qui passe.

**MATÉRIEL PROMOTIONNEL** (`src/lib/promo-material/circuit.ts`) : devis demandé → validation du demandeur →
**validation de la Direction Marketing** (sautée quand c'est elle qui demande) → **Directeur Général au-delà du
seuil** → PDG ou Super Admin → information médicale → les trois chantiers parallèles. Le slug `REVIEW_MANAGER` ne
change pas de nom : il est écrit en base sur tous les dossiers en cours, et le renommer obligerait à migrer leur état
ET leur historique pour un gain nul. Ce qui change est QUI valide.

**« L'ÉTAT EST VALIDÉ ALORS QUE RIEN NE L'A VALIDÉ »** — mesuré : un événement portait **deux vérités** sur la même
question. `Event.status` se saisissait à la main dans le formulaire « Modifier », et un bloc « Suivi de validation »
invitait même à le faire (« Faites avancer la validation via Modifier ») ; `Event.requestStatus` portait la décision
du circuit. La plus flatteuse gagnait, en silence. `src/lib/events/statut.ts` (module pur) ferme les deux moitiés : le
formulaire ne peut plus écrire « Validé » ni « En attente de validation » — le refus nomme le circuit à emprunter —
et le circuit, lui, les ÉCRIT. Le bloc manuel a disparu de la fiche ; la seule frise est celle du circuit. Un
financement refusé ne rend pas l'événement « Annulé » (on n'a refusé que la prise en charge) mais ne le laisse pas
« En attente » non plus : `DRAFT`, le seul état neutre.

**UN POSTE ACCORDÉ MET À JOUR LE MONTANT DE LA DEMANDE** (`src/lib/ad-pro/montant-demande.ts`, module pur). Seule une
**rallonge** (`budgetKind: ADDITIONAL`) s'ajoute : un poste inclus est déjà dans l'enveloppe, et l'additionner
compterait la dépense deux fois. Le total se **recalcule** depuis la base accordée par le circuit
(`WorkflowInstance.amount`) — jamais depuis le champ affiché, qui est ce qu'on écrit — ce qui le rend idempotent : un
poste se décide plusieurs fois, et une addition au fil de l'eau doublerait la rallonge. Branché aux **trois** portes
qui changent une rallonge : décider, corriger, retirer.

**DEUX ÉCRANS ALLÉGÉS.** L'onglet « Établissements » quitte Promotion médicale — le référentiel ne vit plus qu'à un
endroit, Administration › Annuaires › Établissements — et l'ancienne adresse **redirige** (les liens déjà envoyés
restent valides ; mesuré avant de le faire : le module `DIRECTORIES` est accordé à tout le monde et l'onglet du
concentrateur est gardé par la même porte `MEDICAL:VIEW`, donc personne ne perd rien). Et « Demande RH » quitte le
Bureau du secrétariat : la carte de création disparaît, l'action serveur et les deux outils d'Adam refusent le type —
mais le LIBELLÉ survit, parce que les demandes déjà posées le portent.

**CE QUE CE LOT DÉCIDE ET QUI REVIENT À LA DIRECTION** : `PRODUCT_MANAGER` (Direction Marketing) reçoit
`SPONSORING: MANAGE` et `PROMO_MATERIAL: MANAGE`. Sans eux elle ne peut pas même OUVRIR la demande qu'on lui demande
de décider, et le circuit s'arrêterait sur une étape que son unique titulaire ne voit pas. C'est une décision de
permission, nommée ici pour être relue.

**Migration** `20261116090000_adpro_ordre_marketing_final` : elle réordonne les définitions **déjà en base** (changer
la graine seule aurait laissé la production sur l'ancien circuit, en silence), insère la porte du DG, déplace les
émissions financières de la Direction vers l'étape qui fixe le montant, et **épargne les circuits qu'un Super Admin a
remodelés** — renuméroter leurs positions déplacerait SON étape derrière l'étape décisive, donc la rendrait
inatteignable. Sa première version a échoué sur la contrainte d'unicité `(definitionId, position)`, mesurée en tentant
le déploiement et non devinée : les rangs se libèrent maintenant avant l'insertion.


### LES MISSIONS D'ADAM, AU SUPER ADMIN SEUL — un prédicat, onze portes, et l'autorité relue par le battement (2026-09)

**La demande** : « Missions d'Adam etc. doit être dispo que pour le super admin ». **Ce qui était vrai la veille** :
le Centre de missions et la page d'une mission s'ouvraient à quiconque avait le module WORKSPACE (tout le monde),
les quinze actions de conduite aussi, `run_mission` / `mission_status` / `mission_control` étaient « ouverts par
conception » (cloisonnés par propriétaire), les surveillances étaient au PDG + Super Admin, et le battement
relisait les DROITS de module d'un propriétaire, jamais son droit aux missions.

**Livré** :
- **Un prédicat, et un seul** — `peutPiloterMissionsAdam(u)` (`lib/rbac.ts`) : le rôle **principal** SUPER_ADMIN,
  et lui seul (une casquette secondaire ne l'ouvre pas : le Super Admin est un COMPTE, pas une fonction prêtée) ;
  le refus `REFUS_MISSIONS_ADAM` écrit une fois.
- **Onze portes qui le lisent** : l'entrée de menu (`gate: "adamMissions"`, résolue dans `nav-access.ts`), les deux
  pages (`notFound()` avant tout chargement — même page qu'une mission inexistante), les quinze actions de
  `mission-runtime-actions.ts` (plus aucune ne s'ouvre sur `userCan(WORKSPACE)`), les six outils de conversation
  (`allowed` + un `refus` qui NOMME la règle et le geste qui reste — rappel, tâche, engagement), le moteur
  (`lancerMission` avant toute télémétrie, `lancerEnArrierePlan` avant le talon, `creerSurveillance` avant la
  résolution de cible), l'interrupteur global (poser depuis la conversation, poser et lever depuis l'écran) et
  le bloc « Missions d'Adam » des Réglages, qui n'est plus présenté à qui ne peut pas en avoir.
- **L'autorité relue à chaque passage** (`platform/in-process/missions/habilitation.ts`) : le battement, le balayage
  des surveillances et le filet des lancements perdus rebâtissent le propriétaire, puis passent par
  `proprietaireHabilite` ; une mission ou une surveillance dont le propriétaire n'a pas — ou plus — le droit passe
  en **PAUSE** (`pausedReason`, journal `PAUSED` avec `horsDroit`, actorId nul : c'est le moteur qui suspend au nom
  d'une règle), jamais supprimée ni close ; le bilan du battement compte `suspenduesHorsDroit`.
- **Le prompt dit la règle** à qui n'a pas les outils, pour qu'il ne les cherche pas (§118.122), et le complément
  « rien n'a été programmé pour ce suivi » ne propose plus une surveillance à qui n'y a pas droit.
- **Preuves** : `rbac.test.ts` (le prédicat dans les deux sens, la vue globale ne suffit pas),
  `executive-security.test.ts` (Direction : aucun des six outils ; Super Admin : les six ; refus à l'exécution qui
  nomme la règle), `platform/in-process/missions/acces-super-admin.test.ts` (les trois lanceurs refusent la
  Direction AVANT toute écriture ; un compte rétrogradé voit sa mission mise en pause par le VRAI battement et sa
  surveillance suspendue par le VRAI balayage ; les points d'appel lus à leur place exacte, §118.49),
  `mission-runtime-actions.test.ts` (la Direction refusée par chaque action, par le vrai `requireUser`). Le banc
  navigateur (`e2e/mission-control.spec.ts`) joue désormais un compte Super Admin du seed.
- **Au passage** : la dérivation des contrats d'action (`lib/actions/contrat.ts`) reconnaît désormais les prédicats de
  droit écrits en français (`peut…`) comme des gardes — les seize actions du lot nomment `peutPiloterMissionsAdam`, et
  dix-huit autres du parc nomment enfin `peutEcrire`, `peutReclamer` ou `peutInterrogerLeMarche`.

### UNE DIFFUSION NE SE PERD PLUS POUR UN DESTINATAIRE DISPARU (2026-09)

**Le défaut** : `notifyRoles`, `broadcastNotification`, les tâches, leur cœur de création et les
directives LISAIENT leurs destinataires puis écrivaient les lignes en UN seul `createMany`. Un
compte supprimé entre la lecture et l'écriture fait échouer la clé étrangère, donc la requête
ENTIÈRE, donc **personne** n'était prévenu — l'erreur partant dans un `catch`. Mesuré en suite
complète : la supervision Regulatory n'a pas reçu une demande d'accès, sans une étape en échec.

**Le remède existait**, dans `directives/recipients.ts` et pour lui seul. Le REJEU descend au socle
(`src/lib/notifications/ecrire.ts`, zéro import hors base) : le lot reste le chemin rapide, un lot
refusé se rejoue **ligne à ligne**, et ce qui est perdu est compté et nommé. Le nombre rendu est
celui des lignes RÉELLEMENT écrites — `broadcastNotification` et la diffusion des directives
annonçaient les destinataires espérés. L'ÉCRITURE, elle, reste dans le corps de chaque écrivain :
sortie de là, elle disparaît de ce que `actions/contrat.ts` sait dire d'une action (mesuré : 24
actions perdaient `notification`, une déclarait n'écrire rien). Un cliquet exige que chaque
`notification.createMany` de production soit suivi du `catch` qui rejoue. Détail, mesures et
sabotages : CLAUDE.md §118.137.

Sélection des lots livrés récemment (chaque lot est vérifié `tsc` + `build` + `tests` avant push) :

### Finances — « Composer une pièce » : factures et bons de commande au format de la maison, en Word et en PDF, sur le papier en-tête (2026-09)

**La demande** : « Permets aux Finances, à travers un bouton, de créer des factures ou des bons de commande en docx ou PDF selon ce format exact ; le papier en-tête, tu l'as déjà selon Pharmagène ou Adventum » — avec deux pièces réelles jointes : la facture 001/FS/26 (Pharmagène → Sarl BIOGALENIC, 3 × 2 500 000 = 7 500 000 HT, TVA 1 425 000, TTC 8 925 000) et le bon de commande 012/DG/2026 (Adventum → INSIGNE CONSEIL, 794 500 HT, Taxe Pub 2 % = 15 890 HORS base TVA, TVA 150 955, TTC 961 345).

**Livré** :
- **Pas de second générateur** : le bouton TRADUIT un formulaire en demande de fabrique et passe par la porte d'Adam (`emettreDocumentDrive`) — numéro atomique, papier en-tête, montants calculés par le code, pièce au registre Legal, Word + PDF dans le Drive. L'aperçu est la même composition jouée à blanc (`previsualiserDocument`) : **rien n'est écrit, aucun numéro consommé**, mesuré sur les compteurs.
- **Les deux formats de la maison** dans `build.ts` (facture : modèle Pharmagène ; BC et devis : modèle Adventum — voir la référence), avec ce que les pièces réelles exigeaient et que la fabrique n'avait pas : lignes de SECTION, DÉTAILS sous la désignation, taxes additionnelles hors base TVA, numéro de client, contact, date de la pièce amont, montants suivis de DZD, filet unique sous les totaux (`bordures: { bas: true }`), motif de numérotation par nature (`{n:3}/FS/{aa}` → `001/FS/26`).
- **Le PDF jumeau redessine désormais le papier en-tête** : bandes d'en-tête et de pied (textes, images PNG/JPEG en ligne ou ancrées) sur chaque page, grille de colonnes, trames et filets lus dans le Word ; l'éditeur Office reste préféré quand il est configuré, et la MÉTHODE voyage avec la pièce (`editeur` | `rendu`) jusqu'à la phrase du composeur.
- **Décision de permission, à la Direction de la confirmer ou de la défaire** : les Finances écrivent désormais les BONS DE COMMANDE en plus des factures (`legalWriteAllowed`) et voient ces deux natures dans Legal (`legalViewScope` → `PURCHASE_CHAIN`) — parce que ce sont elles qui émettent le BC de la chaîne d'achat. Contrats, baux et courriers leur restent fermés (fiche → `notFound`).

**Ce que le lot a trouvé en chemin, hors de son périmètre** :
- La dérivation des contrats d'action prenait l'accolade d'un type de retour OBJET NU pour celle du corps (`): { ok: true } | { ok: false } {`) : 5 fonctions du parc étaient découpées ainsi, et `messaging-actions:sendMessage` déclarait une liste de champs amputée de ses trois champs de référence depuis toujours. Réparé dans le lecteur : **0 champ retiré, 79 ajoutés**, 24 illisibles (plafond tenu).
- La dérivation ne suivait que les délégués de `@/lib/…` : une action qui émet par le pont de plateforme sortait `ecrit: false` — 4 actions (dont `brand-actions`) déclaraient n'écrire rien en écrivant le profil documentaire ou le registre Legal. Le pont est du code du dépôt : suivi.
- Le lecteur du jumeau PDF lisait les bandes à la RACINE XML au lieu de `w:hdr` / `w:ftr` : bande vide, `null`, PDF sans papier en-tête — en silence. Et deux défauts que seul l'ŒIL a vus sur le rendu : les retours à la ligne perdus dans les cellules, et une ligne centrée à plusieurs fragments imprimée par-dessus elle-même (pdfkit centre chaque fragment séparément).

**Mesuré** : `fabrique-actions.test.ts` 7/7 par la server action (refus d'un commercial qui peut engager la société ; motif réglé par la papeterie et refusé aux Finances ; aperçu sans écriture ; facture `001/FS/26` à 8 925 000 TTC relue dans le Word ; rejeu sans seconde pièce ; BC à 961 345 TTC ; devis refusé aux Finances) ; `to-pdf.test.ts` 15/15 relus par MuPDF (position des bandes, logo embarqué, pied en page 2, retour à la ligne, ligne centrée) ; `build`, `word`, `commercial`, `factory`, `invoices`, `contrat`, `action-parity`, `client-bundle-guard`, `boundary`, `domains`, `use-server-exports` verts ; 9 sabotages rejoués (taxes oubliées du TTC, motif ignoré, Finances sans BC, jumeau sans en-tête, bande lue à la racine, sauts de ligne confiés à pdfkit, type de retour pris pour le corps, délégués du pont ignorés, aperçu qui émet), chacun fait tomber au moins un test, restauration vérifiée par comparaison de fichiers. Suite complète : 8 650 verts, 3 rouges — le garde-fou responsive sur quatre grilles du composeur (corrigé : `grid-cols-1`), et deux cas du moteur de missions au-delà des 20 s sous charge (70 ms et 190 ms seuls ; plafond local mesuré, §118.124b) ; les trois fichiers repassent verts.

### « LES STOCKS D'UN KAM SONT CEUX DE SON SECTEUR » — les hôpitaux de stock deviennent des établissements de l'annuaire, et la portée suit la BU (2026-09)

**La demande** : « Les hôpitaux et produits dans le module Stocks visibles par chaque KAM / National Sales sont ceux configurés dans l'annuaire des hôpitaux et qui sont dans le secteur du KAM en question dans sa BU ; le National Sales a accès à tous les stocks de sa BU. »

**Livré** :
- **Un hôpital de stock EST un établissement de l'annuaire** : `StockAnnex.institutionId` (migration idempotente, `SetNull`). Le premier relevé d'un hôpital de son secteur crée le lieu rattaché (`assurerLieuDeStock`) ; le Super Admin ajoute un établissement depuis l'annuaire (menu déroulant des établissements sans lieu) ou **rattache** un lieu hérité (créé à la main avant ce lien) — **jamais un rattachement automatique sur un nom**, même identique : le premier relevé sur un homonyme hérité REFUSE et nomme le geste. Le nom du lieu suit l'annuaire (au rattachement, et quand l'établissement est renommé).
- **La portée** (`lib/stocks/portee.ts`, PUR ; `queries/stock-portee.ts`) : GLOBALE pour la chaîne d'approvisionnement, la vue globale et le Super Admin ; **BU** pour qui supervise une BU (tous ses secteurs, tous ses produits) ; **SECTEUR** pour un KAM (les établissements de ses secteurs dans la BU de sa fiche, les produits de sa BU). Un KAM sans secteur voit zéro hôpital et l'écran dit pourquoi ; un secteur d'une autre BU ne compte pas.
- **Appliquée partout où ça compte** : l'écran (`/stocks` ne charge que les relevés de la portée, liste les établissements du secteur avec ou sans lieu, dit le périmètre), les écritures (`recordStockSnapshot` refuse un hôpital hors secteur, un produit hors BU, un lieu hérité ; `deleteStockSnapshot` idem), et Adam (`read_stock` lit la même clause et dit sa portée ; `record_snapshot` résout l'hôpital dans l'annuaire, DANS la portée ; `create_hospital` désigne un établissement de l'annuaire ou refuse en nommant le remède).
- **Deux défauts préexistants fermés en chemin** : `read_stock` n'appliquait AUCUNE portée (un KAM y lisait la centrale d'achat et tous les hôpitaux, alors que l'écran les lui cachait) ; et `num()` des outils de lecture exécutive lisait une clé ABSENTE comme zéro — `read_stock` sans seuil répondait « rien de critique » sur des stocks bien réels, `limit` omis rendait un résultat au lieu de huit.
- **Bancs** : `stocks/portee.test.ts` (15, pur), `queries/stock-portee.test.ts` (13, en base, acteurs sans vue globale : KAM, National Sales, KAM sans secteur, chaîne, `read_stock`, écritures, effacement, rattachement, homonyme), `actions/stock-scope-guard.test.ts` (réécrit : le KAM relève son secteur, pas l'autre, pas l'autre gamme, pas la PCH), goldens `ops-goldens-wave4` adaptés. Neuf sabotages rejoués, neuf chutes — dont le neuvième (`num()` : le vide relu comme zéro) a d'abord PASSÉ : le sabotage retirait la garde mais gardait `String(v)`, donc une clé absente rendait encore `null` — il ne réintroduisait pas le défaut d'ORIGINE (`String(v ?? "")`). Rejoué fidèlement (le `num()` de HEAD), il tombe ; et la moitié que le premier sabotage exerçait vraiment — `low_threshold: ""` — a reçu son témoin, qui la fait tomber aussi.
- **Et la suite complète a rendu UN rouge hors du lot** : le banc de résolution d'entités (`fabric/entites.test.ts`) exige qu'aucun produit étranger ne porte ses molécules, et le décor du banc Data Quality (`quality/engine.test.ts`) semait « Sofosbuvir + Velpatasvir » — la même molécule — dans la même base, en parallèle. Le décor Data Quality porte désormais deux molécules synthétiques (un doublon se juge sur la DCI triée : n'importe quels deux noms font l'affaire) ; aucune ligne de produit n'a bougé.

### « WILAYA SEULE, FEUILLE TABLEUR, ET UN MODULE ANNUAIRES » — les annuaires deviennent des feuilles, et se centralisent dans le pôle Administration (2026-09)

**La demande** : dans Établissements, garder la wilaya seule — en menu déroulant depuis la liste canonique — et supprimer « Ville » ; supprimer « Ville » dans les annuaires ; rendre les annuaires plus souples (sélection de cellules, couleurs) ; et créer dans Administration un module « Annuaires » qui centralise tous les annuaires (partenaires, médecins, pharmaciens, établissements, et autres).

**Livré** :
- **La wilaya est le SEUL découpage géographique** : `canonicalWilaya` (`lib/medical/wilaya.ts`) recolle la casse et les alias, `parseWilaya` (`lib/actions/medical-actions.ts`) refuse une valeur hors liste en nommant le remède (« choisissez-la dans la liste des 58 wilayas »), le formulaire des établissements porte un menu déroulant des 58 wilayas (une valeur héritée hors liste est affichée comme telle, jamais écrasée). « Ville » quitte la feuille des praticiens (**11 colonnes**), l'export, le formulaire des établissements, et ses lecteurs (plan de tournée, Ma journée, emploi du temps, bénéficiaires de congrès, `search_hospitals` et les outils d'hôpital d'Adam). Les colonnes `city` restent en base : rien n'est détruit, l'import « Ville » sert encore à déduire la wilaya.
- **La feuille se manipule comme un tableur** : modèle PUR `lib/grille/selection.ts` (clic / Maj / Ctrl / glisser / flèches / Tab / Ctrl+A / Ctrl+C en TSV), palette FERMÉE `lib/grille/couleurs.ts` (huit teintes), `components/grille/{use-selection,barre-selection,palette}`. Les couleurs sont **persistées par cellule** (`DirectoryCellStyle`, migration `20261114090000_directory_cell_style`, deux clés étrangères exclusives en CASCADE) et écrites par `colorerCellulesAnnuaire` (`lib/actions/annuaire-couleurs-actions.ts`) **sous le même droit que la cellule** — `MEDICAL UPDATE`, puis `canAccessEntity(DOCTOR, UPDATE)` ligne par ligne, colonne connue de la feuille, clé de palette ; ce qui est hors portée est ignoré ET compté. Les **colonnes sur mesure** — qui existaient en base et en actions sans aucun écran (§118.14) — sont rendues et modifiables (`saveDirectoryCustomCell`, valeur typée, dans le seul annuaire qui porte la colonne). Établissements : même sélection, mêmes couleurs (`lib/medical/etablissements-grid.ts`).
- **Module « Annuaires »** (`DIRECTORIES`, pôle Administration, `/annuaires`) : Médecins / Pharmaciens (grade `PHARMACIEN` de la même feuille) / Établissements / Partenaires / Personnes / Autres annuaires. Porte accordée à tous (`grantImplicit`, `lib/rbac.ts`), **chaque onglet gardé par le module de son référentiel** (`ANNUAIRES_TABS`), pages sous `app/(app)/annuaires/`. Les écrans d'origine restent en place et lisent les **mêmes chargeurs** (`lib/queries/annuaires.ts`, types PURS `lib/annuaires/types.ts`). Adam : `SERVICE_DU_MODULE.DIRECTORIES`, op `color_directory_cells`, `set_doctor_cell` étendu aux colonnes sur mesure — la parité d'actions exigeait que les deux nouvelles server actions soient couvertes.
- **Une fuite de portée préexistante, fermée** : la page de l'annuaire composait `{ ...scope, ...directoryWhere, ...hiddenWhere }` — pour un délégué `scope` est un `OR`, et dès qu'un annuaire FERMÉ existait `hiddenWhere` portait le sien : l'étalement écrasait le premier par le second, et la vue « Tous » montrait au délégué les praticiens des autres délégués. Trouvée par le banc du chargeur joué avec un DÉLÉGUÉ (§118.104) ; composée en `AND: [scope, directoryWhere, hiddenWhere, gradeWhere]`, dans la liste comme dans les comptes.
- **Les cliquets ont décidé de la forme** (§118.133) : contrat des actions (`cellules: string[]` en `<id>:<champ>` au lieu d'une liste d'objets, illisible), parité (`gap = 0` → l'op `color_directory_cells`), frontière et domaines (`lib/grille/` NEUTRE + socle, `lib/annuaires/` socle, réexports par le pont `platform/in-process/capacites` — aucun plafond relevé), le `content` de Tailwind (les classes de la palette vivent sous `components/`), et le build de production — un `export function` synchrone dans le fichier `"use server"` de l'action passait le typecheck et 8 601 tests, et faisait tomber `next build` : la fonction rejoint le socle, et `lib/actions/use-server-exports.test.ts` lit désormais les 144 fichiers `"use server"` du dépôt pour refuser tout export qui n'est pas une fonction asynchrone ou un type.
- **Bancs** : `lib/grille/{selection,couleurs}.test.ts`, `lib/medical/etablissements-grid.test.ts`, `lib/actions/annuaire-feuille.test.ts` (en base : portée par ligne, palette, colonne, cascade, colonne sur mesure typée, wilaya canonique et refus), `lib/queries/annuaires.test.ts` (grade, annuaire fermé, compte par établissement dans la portée), `lib/annuaires/module.test.ts` (module, onglets, point d'appel des chargeurs, VIEWER vs délégué). **Huit sabotages, huit chutes**, restauration vérifiée par comparaison de fichiers.

### « BLOQUER TOUTES LES MISSIONS D'ADAM » — l'interrupteur global, et la boucle juge → replan → notification coupée à sa source (2026-09)

**Le symptôme** : « Bloqué — Diagnostic — Une molécule qui n'existe pas … » reçu sans arrêt. **La cause, mesurée** : des missions du smoke fournisseur (conçu pour le Shell Render, donc la production) laissées vivantes ; toutes les étapes abouties, le juge refuse, BLOCKED, notification ; le battement replanifie — chaque refus de juge passait pour un « motif neuf » (`refus: null`) — le plan v2 est refusé, nouvelle notification (la clé de dédoublonnage porte la version du plan), et ainsi jusqu'au plafond de **douze** plans, sans que `replanBloque` ne soit jamais écrit. Et **aucun interrupteur du moteur** n'existait : `PAUSED` se pose mission par mission, `MISSIONS_SWEEP=off` est une variable d'environnement.

**Livré** :
- **L'interrupteur global** `AppSetting.missionsPaused` (+ `missionsPausedAt`, `missionsPausedById` ; migration `20261110090000_missions_paused`) et son module `lib/interrupteurs/missions.ts` (`lireInterrupteurMissions`, `suspendreMissions`, `leverSuspensionMissions`, `phraseSuspension`). Honoré par **quatre lecteurs** : le moteur (`runtime/engine.ts:avancer`, à chaque tour, AVANT `conclure` — sous suspension rien n'est jugé, donc rien ne passe BLOCKED, donc rien ne notifie), le battement (`sweep.ts:balayerMissions`, rend `suspendu: true` sans rien charger), le pilote d'horizon (`horizon.ts`, avant toute compilation) et le lancement (`lancerMission` refuse avant tout appel de modèle, en nommant l'écran qui lève). Rien n'est touché : chaque mission repart où elle en était à la levée.
- **Les portes** : bouton « Suspendre toutes les missions / Reprendre les missions » sur **Réglages d'Adam** (`setAdamMissionsPaused`, **Super Admin seul depuis §118.136** — le PDG garde l'écran, pas ce bloc ; audité ; l'état est servi par `adamHealth().missions.suspension`, côté ERP) ; bandeau sur le **Centre de missions** ; geste `suspendre_tout` de `mission_control` dans la conversation — **sens réducteur seul** : Adam peut poser l'interrupteur, jamais le lever (§118.15).
- **La boucle coupée à sa racine** : `runtime/replan.ts` porte `REFUS_JUGE` (`OBJECTIF_NON_CONSTATE`), la signature d'un refus de juge ; un plan qui passe garde sa cause dans `replanRefus` ; le second refus de juge est une **RÉPÉTITION** ; RÉPÉTITION, PLAFOND et « aucun recours » **écrivent** `replanBloque`, donc sortent la mission de la sélection du battement. Mesuré par `conduireMission` avec un juge qui refuse toujours : un plan de correction et un seul, **deux notifications au plus**, puis plus rien.
- **Gestes de masse** sur le Centre de missions : « Suspendre les N missions en cours » et « Arrêter les N missions bloquées ou en échec » (`suspendreToutesMesMissions`, `arreterMesMissionsBloquees` ; prédicats uniques `ouSuspendable` / `ouBloquee` dans `runtime/control.ts` — le nombre affiché est le nombre touché ; FAILED inclus, parce que le battement le replanifie encore).
- **Les bancs s'arrêtent avec la mesure** : le smoke fournisseur arrête ses missions après le verdict (`arreterMissionsDeDiagnostic`, ligne « missions de banc arrêtées » dans le rapport) ; le deep smoke en mode « garder » les garde arrêtées.

**Banc** : `interrupteur.test.ts` (écrivains éprouvés dans une transaction rejetée — l'interrupteur est global et la suite tourne en parallèle), `suspension.test.ts` (les quatre lecteurs par leurs vrais points d'entrée avec un lecteur injecté, la même mission qui avance une fois l'interrupteur levé, et le test de point d'appel qui interdit toute injection en production), `replan-juge.test.ts` (le cas de production par le battement, le plafond, « aucun recours »), `control-masse.test.ts`, `smoke-arret.test.ts`, `replan.test.ts` (+4). Neuf sabotages, neuf chutes. Frontière Adam ↔ ERP à 428 (refusée à 430 puis ramenée par la santé d'Adam). Doctrine : §118.132.

### PLAN DE TOURNÉE — le réglage de maille que rien n'écrivait, l'échéance que rien ne lisait (2026-09)

**Relecture du cahier des charges contre les vrais points d'entrée (§118.14), pas contre la liste de tâches.** Le panneau des récurrences de stock est monté sur `/stocks` et gardé par la règle du geste (`canRequestStockState`) ; les quatre vues de l'emploi du temps, le verrou de 48 h, l'escalade au N+2, le rejet motivé, l'imprévue, la visite commandée et le dénominateur de la Direction ont chacun leur appelant. **Deux n'en avaient pas.** (a) La **maille de planification** (hebdo / mensuelle / trimestrielle / semestrielle) et le délai de soumission étaient lus par l'action qui ouvre un plan et par la page du KAM — qui renvoyait vers « Administration › Réglages » — et **écrits nulle part** : `saveSfeSettings` ne touche pas `tourPlanning`, aucun formulaire ne le portait. (b) **`enRetardDeSoumission` n'avait aucun appelant** : l'échéance s'affichait « à soumettre avant le … » avant comme après son passage, et personne — ni le KAM, ni le N+1, ni la Direction — ne voyait un retard. Un troisième défaut s'est montré en branchant : l'op Adam `open_tour_plan` forçait `MONTH` au lieu du réglage.

**Livré** : un lecteur unique du réglage (`lib/sfe/tournee-reglage.ts`, lecture pure `reglageDepuisJson` avec défaut par champ et borne à 90 jours) ; l'action **`saveTourPlanningSettings`** (Super Admin seul — la Direction règle les paramètres SFE, pas la maille — refus qui nomme la borne au lieu de tronquer) et son formulaire dans **Force de vente › Paramètres** ; le **retard de soumission** calculé une fois (`retardDeSoumission` : jamais sur un plan soumis, échéance de resoumission sur un plan rejeté, un KAM sans plan jugé comme un brouillon jamais soumis) et affiché chez le KAM (statut du plan, liste de ses plans), et sur le tableau de bord de la Direction (colonne « Plan » + compte des KAM à relancer) ; l'op **`set_tour_planning`** et `open_tour_plan` sur le réglage en vigueur. **Bancs** : 6 cas purs, 2 cas d'intégration par les vraies actions et les vrais chargeurs (le réglage écrit par l'admin et LU par `ouvrirPlanTournee` ; sans plan / brouillon / soumis / rejeté vus par la Direction, et la vue du KAM égale à la ligne de la Direction). **Six sabotages, six chutes distinctes.** Reste nommé : un délégué (`MEDICAL: CONTRIBUTE`) crée et modifie les praticiens de son périmètre, là où la demande dit « configurée par la direction » — décision de permission à trancher.

### « IL A PAS ACCÈS À TOUT L'ERP » — 29 modules sur 43 invisibles au routage (2026-09)

**Mesuré en formant la question depuis le libellé canonique de chaque module.** L'ERP déclare **43 modules**,
Adam porte **227 outils** en 15 domaines — et **29 modules ne faisaient reconnaître AUCUN domaine**. Le
résolveur ouvre alors « tous les domaines » et laisse le plafond du niveau borner, mais le rang se calcule sur
la POSITION du domaine dans une liste figée dont le premier est `MAIL` : « ouvrir tout » valait donc « ouvrir les
neuf premiers d'une liste figée ». « Combien de visites terrain ce mois-ci ? » et « quel est l'état des stocks à
l'hôpital Mustapha ? » recevaient `gmail_search`, avec **213 outils sur 227 écartés**.

**Le manque était de ROUTAGE, pas de capacité** : `field_report_operation`, `stock_operation`, `read_stock`,
`sales_operation`, `logistics_operation`, `care_operation`, `bd_operation` existaient tous.

**Ce qui est dérivé, ce qui est décidé.** Le libellé du module entre automatiquement dans le vocabulaire (un
renommage suit sans que personne y pense) ; le domaine qui le sert est une décision déclarée **exhaustivement**
— un module ajouté demain ne compile pas tant que personne n'a dit qui le lit — et les mots supplémentaires
vivent à côté du module, pas dispersés dans quinze regex où un trou est invisible. La couche ne parle **que si**
le vocabulaire existant n'a rien reconnu, et **seulement pour ouvrir des outils** : une première version
élargissait aussi l'étiquette de route et le banc de routage l'a refusée (précision de domaine 0,9367 pour un
plancher de 0,95, sur huit énoncés) — l'étiquette gouverne le budget de contexte et les pré-lectures, réglés sur
ce corpus, et c'est l'ouverture des outils qui était cassée.

**Ouvrir le bon domaine ne suffisait pas** : REGULATORY porte 46 outils pour 15 places, et `read_stock` tombait
au profit d'outils plus tôt dans le registre. Le module déclare donc aussi ses outils, qui passent devant les
autres de leur domaine, sous un cliquet d'existence — et le filtre des écritures continue de s'appliquer.

**`GENERAL` portait deux sens** : « rien reconnu » pour une question, « utile partout » pour un outil. Le
résolveur lisait le premier, donc 31 outils déclarés transverses — dont tout le corpus de connaissance et
`my_overview` — ne pouvaient **jamais** être servis au premier tour. 17 hors des listes inconditionnelles, 12
après ce lot, sous plancher.

**Fichiers** : `src/lib/assistant/context/modules-domaines.ts` (nouveau), `context/router.ts`,
`context/tool-resolver.ts`, banc `context/modules-erp.test.ts` (8 cas, 8 sabotages). Mesure : 29 modules sans
domaine → 0 ; « visites terrain » → `field_report_operation` ; « état des stocks » → `read_stock` +
`search_hospitals` ; corpus de connaissance servi pour la première fois.

### « DÈS QUE JE DIS ANNUAIRE IL ME SORT L'ANNUAIRE » — un raccourci armé sur un MOT (2026-09)

**Mesuré avant d'être supposé.** Sur dix phrases ordinaires qui contiennent le mot « annuaire », **sept**
partaient en route rapide et rendaient le registre des salariés : « C'est quoi l'annuaire ? », « l'annuaire est
pas à jour, qui s'en occupe ? », « est-ce qu'il est relié aux fiches RH ? », « je trouve pas Amel dans
l'annuaire, vérifie son email ». Les mêmes intentions dites SANS le mot partaient au modèle : le mot était le
déclencheur.

**Ce que le raccourci retire.** `FAST_READ` appelle la source canonique puis envoie au modèle **zéro schéma
d'outil** et une seule consigne — reformule ce résultat. Se tromper de porte ne donne pas une lecture inutile de
plus : cela ôte au modèle tout moyen de faire autrement, en silence.

**Deux défauts, deux natures.** (1) « annuaire » vivait parmi les mots de COORDONNÉES (`adresse`, `numéro`,
`téléphone`) et dans les mots de DEMANDE : or une coordonnée est une donnée qu'on réclame, tandis qu'« annuaire »
est le nom du registre, donc le sujet possible de n'importe quelle phrase. Il a son propre marqueur, et la porte
exige qu'on le DEMANDE — un mot de demande, ou une phrase qui ne dit rien d'autre (« annuaire » seul reste la
forme la plus courante à l'oral). (2) La garde « un objet nommé rend la main » existait déjà dans le même fichier
et ne couvrait que la boîte mail et la file de décisions : « peux-tu joindre le PDF au courrier ? » interrogeait
l'annuaire sur une personne nommée « pdf courrier », « le numéro du dossier ANPP » sur « dossier anpp ».
Le vocabulaire est désormais **une seule liste** lue de deux façons — avec les personnes pour la boîte, sans elles
pour l'annuaire, dont elles sont le sujet.

**Rendre la main n'est pas refuser, et c'est mesuré** : sur les dix phrases, **9/10** exposent encore
`directory_list` ET `directory_lookup`. Le domaine OUVRE des schémas, le raccourci FERME les options : une erreur
du premier coûte quelques jetons, une erreur du second coûte la réponse.

**Fichiers** : `src/lib/assistant/voice/fast-path.ts`, banc `src/lib/assistant/voice/annuaire-porte.test.ts`
(29 cas, 8 sabotages). Mesure : 7 phrases mal routées → 0 ; 11 formes légitimes → 11 encore rapides ; 8 faux
positifs d'objet nommé → 0 ; 519 tests des corpus de routage existants au vert.

### ADAM APPELLE N'IMPORTE QUELLE ACTION DE L'ERP — 550 sur 715, sans une fiche écrite à la main (2026-09)

**Le problème n'était pas la couverture, c'était son PRIX.** 520 déclarations d'op, 503 propose/execute, 117
résolveurs : environ 1 140 objets écrits à la main pour qu'Adam sache appeler les gestes de l'ERP. Chaque nouvelle
action demandait sa fiche, et une fiche devient fausse en silence dès qu'on ajoute un champ.

**Une action se DÉCRIT depuis sa source.** `src/lib/actions/contrat.ts` (pur) dérive le contrat de chaque action
en lisant son code : ses champs, leur type, ceux que le code REFUSE d'omettre, les valeurs admises quand elles se
lisent, les modèles qu'elle écrit. Mesuré sur le parc : **715 actions, 691 descriptibles (97 %)**, artefact en
`contrat.genere.json` (une ligne par action, pour qu'un diff nomme celle qui a bougé), redérivé et comparé à chaque
test. Le cliquet est INVERSÉ — il compte les actions **non** descriptibles vers le bas (117 → 46 → **24**), au lieu
de récompenser l'écriture de fiches.

**Quatre façons d'énoncer une entrée, et aucune action n'a été réécrite.** Le lecteur a appris à lire ce que la
source disait déjà : un paramètre OBJET LITTÉRAL (`input: { id: string; paidDate: string | null }`, 13 actions),
un LECTEUR LOCAL (`const parseDate = (k: string) => fdStr(formData, k)`, 4), une DÉLÉGATION à une fonction du même
fichier qui reçoit le formulaire (5), une valeur par défaut LITTÉRALE (`= null`, qui n'est pas un calcul). La
délégation a trouvé plus que des illisibles : **16 actions déjà « lisibles » portaient une liste AMPUTÉE** —
`updateLegalDocument` déclarait `id` et rien d'autre, ses douze autres champs vivant chez `readFields` ; décrites
et INAPPELABLES, puisque la validation refuse tout champ hors contrat.

**« Nivolex » là où l'action attend un `cuid`.** `ChampAction.modele` vient de la relation Prisma, dérivée du DMMF
(512 champs portent le modèle qu'ils désignent, sous un PLANCHER). Le chemin générique résout alors la désignation
par `cibles/resoudre.ts` — dans la portée RÉELLE de la personne (`porteeEntite`) —, montre sur la carte la LIGNE
retenue et non l'identifiant, refuse une désignation ambiguë avec ses candidats, et laisse passer en le DISANT ce
qu'il ne sait pas désigner. Une PERSONNE se cherche dans l'ANNUAIRE (`directory/resolve.ts`), pas dans la liste
d'administration des comptes.

**550 actions ouvertes, 48 refusées PAR CONCEPTION.** En comparant la dérivation aux ops déclarées, 118 actions sont
apparues atteignables seulement par le chemin générique — en tête : `updateUserRole`, `setRowGrants`,
`superAdminDelete`. Le « gain » était l'auto-escalade. `generique.ts` s'arme sur le **modèle Prisma écrit**, pas sur
le nom (les motifs de `policy/guard.ts`, écrits pour des identifiants en serpent, laissent passer `updateUserRole`),
et sa liste est exhaustive au regard du schéma : un modèle de droits ajouté demain fait échouer un test au lieu
d'ouvrir une porte. Le refus nomme le remède — ces gestes se font depuis l'écran d'administration.

**Ce n'est pas une porte dérobée.** `executer.ts` appelle la server action de l'écran, celle du bouton, avec ses
propres `requireUser` / `userCan` / `canAccessEntity`. Une action qui déclare son échec (`{ok:false}`) remonte en
échec (§118.25), et seulement quand elle ÉCRIT. Adam y accède par le contrat de plateforme
(`platform/in-process/capacites`), jamais par un import direct : le cliquet de frontière a refusé la première
version, et il avait raison.

**Un seul outil, et son refus fait la découverte.** `capability_operation.run` accepte l'identifiant d'une action OU
une intention en français ; quand elle ne désigne pas une action unique, le refus liste les candidates avec leurs
champs exacts. Proposer n'est pas faire : la carte montre l'action, ses valeurs et ce qui sera écrit, et rien n'est
en base avant confirmation.

**Trouvé en chemin, et corrigé :** « BD › Projets » vivait dans un module retiré du service — écran, actions et
menu inatteignables pour tout le monde. Le sous-module a été rouvert **seul**, Market Intelligence restant fermé.

### PARTAGER PAR LA MESSAGERIE, ET LE PROJET BD QUI CLASSE LES DOSSIERS (2026-09)

**Un seul geste, cinq écrans.** « Envoie-moi ce dossier » se faisait hors de l'ERP : on téléchargeait la pièce, on
ouvrait sa messagerie personnelle, et six semaines plus tard personne ne savait plus de quel dossier venait la
facture. Un bouton **Partager** entre donc dans Legal, Courriers, Ad&Pro, Regulatory (Suivi de dossiers **et**
Pipeline) et le Drive — et il entre **une** fois. `partagerParMessagerie` n'écrit pas le message : elle prépare la
conversation d'arrivée puis appelle `sendMessage`, l'écrivain unique, qui valide les pièces contre les droits Drive
de l'expéditeur, accorde la lecture aux destinataires, notifie et émet le fait qui réveille une mission en attente.

Ce qu'elle **ajoute** : `sendMessage` valide la FORME d'une référence, il ne vérifie pas que l'expéditeur **voit**
l'enregistrement — dans la messagerie, la référence est du contenu de son propre message. Ici le partage part d'un
écran métier et devient un geste de diffusion, alors `canAccessEntity` répond par **enregistrement**, pas par module.
Et le Drive se contrôle **par nœud**, ce que `canAccessEntity` ne fait pas (`DRIVE_NODE` retombe sur le droit de
module) : `resolveDriveAccess` — la même porte que celle des pièces jointes. Sans cet appel, le partage d'une PIÈCE
serait gardé et celui de sa RÉFÉRENCE ne le serait pas.

**Le projet BD classe le dossier.** Chaque dossier réglementaire peut appartenir à un **projet** nommé par la
direction dans Business Development. On réutilise `BdProject` plutôt que d'ouvrir un second registre : deux listes de
projets divergent au premier renommage. Le classement se **pose** dans Regulatory (colonne « Projet », des deux
sous-modules) et se **lit** dans le nouveau sous-module **Business Development › Projets** — un tableau par projet,
une ligne par dossier. Deux portes qui ne se remplacent pas : `scopeBdProject` décide des projets qu'on voit,
`regulatoryVisibleWhere` des dossiers qu'on voit dedans (verrou du pipeline et périmètre société compris).

**Et les colonnes du tableau Regulatory deviennent un réglage de la maison.** « Dans Regulatory, supprime la colonne
classe thérapeutique, garde le segment » : `regulatoryHiddenColumns` retire la colonne sur les **deux** sous-modules,
pour tout le monde, et survit au vidage du cache — à distinguer du bouton « Colonnes » du tableau, qui reste et qui
dit « pas sur MON écran ». Le geste se fait en Administration **ou** en le disant à Adam : même réglage, même
catalogue. Ce catalogue (`lib/vues/colonnes-regulatory.ts`) est **pur et au socle**, parce que trois couches en ont
besoin sans avoir le droit de s'importer — la conversation valide, l'écran rend, la console propose. La référence ne
s'y masque jamais : elle identifie la ligne, et sans elle on ne peut plus revenir en arrière depuis le tableau.

### LE CLASSEUR DISAIT 100, LE DECK DISAIT 999 — et les deux étaient VERIFIED (2026-09)

`identiteDuLivrable` réglait le cas du **replan** : un livrable actualisé est une nouvelle version du même fichier.
Restait l'autre moitié, jamais regardée — les livrables **frères** d'un même plan. Le classeur et le deck descendent
des mêmes étapes amont, et chacun appelait le modèle de son côté : deux appels, deux specs. Rien ne les comparait,
puisque chaque livrable est contrôlé **seul**. Mesuré avec un raisonneur qui change de chiffre au second appel :
**100 dans l'un, 999 dans l'autre**, tous deux ouverts, contrôlés, VERIFIED. C'est « quatre fichiers qui divergent »
à l'intérieur d'une seule mission — et c'est pire qu'entre deux missions, parce qu'ils portent la même date et le
même titre.

La spec est déjà **indépendante du format** (`summary`, `sheets`, `charts`, `sources`) : le classeur, le Word, le PDF
et le deck sont quatre **rendus** d'un même contenu. Le second livrable re-rend donc le premier au lieu de le refaire.

**Et la première version ne convergeait pas.** Une simple vérification « un frère a-t-il déjà composé ? » suppose une
séquence : les deux étapes deviennent prêtes au même battement, aucune ne voit la ligne de l'autre, et le test passait
une fois sur deux. On **réserve** donc avant de composer (une ligne PENDING, sans fichier, portant l'empreinte des
données amont), puis on **désigne** l'auteur de la base : la plus ancienne, à égalité la clé la plus petite. Comme
chacun réserve avant de lire, tous voient le même premier — sans verrou. L'attente est bornée et n'échoue jamais :
bloquer une mission pour une cohérence coûterait plus cher que le défaut.

### « OCÉRISEZ-LE D'ABORD » — la capacité était dans le répertoire d'à côté (2026-09)

L'ingestion du **corpus** réglementaire refusait tout scan : *« Document image (scanné) : le corpus attend un texte
sélectionnable. Océrisez-le d'abord. »* Le moteur OCR vit dans `intelligence/ocr/` — deux moteurs, aucune clé
nécessaire pour le repli — et il tourne **en production** sur les documents de dossier. Mieux : `training/ingest-case.ts`,
le fichier voisin, l'autre porte d'entrée de la connaissance, l'appelait déjà, avec la bonne raison en commentaire
(« un courrier ANPP est presque toujours un scan »).

Deux ingestions, une capacité branchée d'un seul côté : on renvoyait une personne faire à la main ce que le logiciel
savait faire, à un mètre de là. La réponse n'est pas de recopier les dix lignes — elles auraient divergé comme le
reste — mais de n'avoir **qu'un lecteur** (`extract/texte-ou-ocr.ts`) que les deux appellent. Les **images** entrent
aussi : refuser un arrêté photographié à son extension revenait à décider qu'une connaissance existe selon le format
dans lequel quelqu'un l'a reçue.

Un texte océrisé n'est pas pour autant une lecture de la loi : la **méthode** et la **confiance** sont persistées
(`RegulatorySourceVersion.extractionMethod` / `extractionConfidence`) et affichées sur les deux écrans — sans quoi une
source lue à 63 % est indiscernable d'un arrêté copié du Journal officiel. Le motif de refus, enfin, se construit
depuis la liste des formats : écrit à la main, il **mentait déjà** (« PDF, DOCX, TXT, MD, HTML, XLSX » alors que CSV
et XLS passaient).

**Et six octets arrêtaient le serveur.** `BM????` dans une archive : sharp refuse l'en-tête, le code disait
« best-effort : on OCR l'image brute si sharp échoue », et donnait ces octets à Tesseract — dont le worker Node
**émet** un `error`, c'est-à-dire une exception non rattrapée, c'est-à-dire l'arrêt du processus. Le test passait :
ses assertions étaient vraies, le crash arrivait après. *Sharp qui renonce à optimiser* n'est pas *sharp qui ne sait
pas lire* : dans le second cas, ces octets ne sont pas une image et on ne les présente pas au moteur.

### UN TOTAL ÉCRIT COMME UNE DONNÉE — un chiffre faux, VERIFIED, dans un fichier qui n'est pas un tableur (2026-09)

Le contrat dit au modèle : « tu n'écris jamais de formule Excel, déclare `totals` et le code écrira la bonne ».
Il ne disait rien de ce qu'il fait **quand il ne suit pas** — et ce qu'il fait, mesuré sur un run, est d'écrire
le total comme une **troisième ligne de données** : `["TOTAL", "170000"]`, `totals: []`.

Le classeur produit portait alors **zéro formule**, aucune cellule en erreur, aucun reste de brouillon, et le
contrôle rendait `ok: true` → **VERIFIED**, le seul statut qui vaut preuve d'achèvement. Deux choses étaient
fausses dans ce fichier, et la seconde est la pire :

- il n'est **pas fonctionnel** — on change une hypothèse, le total ne bouge pas : c'est la *photographie* d'un
  tableur ;
- le total est **faux**. 84 500 + 91 000 = **175 500**, pas 170 000. Personne ne l'a vu, parce qu'aucun code
  n'avait comparé le chiffre annoncé à ses propres lignes.

**Ce qui a changé.** `src/lib/missions/artifacts/totaux.ts` — module pur — **traduit** au lieu de refuser : la
ligne sort de `rows`, entre dans `totals`, et le code écrit `SUM(D2:D3)` avec le bon D et le bon 3. Le
vocabulaire est **fermé** (« Total », « Total général », « Moyenne ») ; « Total 2026 » et « Sous-total » ne sont
**pas** traduits — promouvoir un sous-total ferait une plage débordant sur le groupe suivant, c'est-à-dire un
chiffre faux **muni d'une formule**. Ce qu'on reconnaît sans savoir le traduire est **dit**, jamais deviné. Et
l'écart devient un point de contrôle **en échec** : la formule répare l'affichage, elle ne dit pas si le modèle a
mal compté ou perdu une ligne.

**Deux contrôles voisins étaient complices.** La « réconciliation » s'écrivait `point("reconciliation:…", true, …)`
— vraie garde armée ou non, vraie sur un fichier faux. Et la ligne qui l'excusait déclarait « les formules ne sont
pas ÉVALUÉES (aucun moteur de calcul Excel dans le dépôt) » : **c'était faux**. `src/lib/artifact/sheets/` porte
un lexeur, un parseur, un graphe de dépendances et `recalculer()`, éprouvés sur 50 000 formules. Le contrôle qui
décide de VERIFIED déclarait une impossibilité que le dossier d'à côté démentait — un « je ne peux pas »
**artificiel écrit dans le code**. Le classeur produit est désormais **rouvert par notre propre lecteur**, ses
formules **recalculées**, et la valeur obtenue comparée à la somme refaite depuis la spec : deux chemins
indépendants, un seul nombre. Un **sabotage** (une cellule de données falsifiée dans le fichier, plage intacte)
le fait tomber — sans lui, on ne saurait pas nommer le cas qui ferait échouer l'assertion.

### DEUX TROUS TROUVÉS EN RELISANT LE CORRECTIF LUI-MÊME (2026-09)

**Une réparation déplace une donnée ; il faut la retrouver chez tous ceux qui la lisaient.** La promotion du total
(ci-dessus) le sort de `rows` pour en faire une opération — juste pour le classeur, qui écrit une formule. Mais le
Word, le PDF, le CSV et le deck ne rendent que `rows` et n'avaient **jamais** lu `totals` : la promotion, seule,
faisait disparaître le total de **quatre livrables sur cinq**. Aucun contrôle de structure ne l'aurait vu — le fichier
s'ouvre, il est simplement amputé. Les quatre formats sans moteur de formules reçoivent donc la ligne **calculée**,
et le libellé (« TOTAL », « MOYENNE ») est commun aux cinq.

**Et le contrôle avant livraison ne voyait pas dans les tableaux d'une diapositive.** Une forme PowerPoint ordinaire
porte un `p:txBody` ; un tableau (`p:graphicFrame` → `a:tbl`) porte un `a:txBody` **par cellule**, et l'adaptateur ne
lisait que le premier — donc `text: ""` pour tout tableau de diapositive. Le Word inspecte ses cellules depuis
toujours. Un « [à compléter] » posé dans un tableau franchissait la porte et partait **en comité**, dans le seul
format qu'on projette devant une assemblée. La lecture couvre maintenant les deux corps de texte, et le contrôle a été
scindé : le reste de brouillon se cherche **partout**, les règles éditoriales (six puces, vingt-cinq mots) ne
s'appliquent qu'au **texte** — douze lignes de tableau ne sont pas douze puces.

### LE DECK ÉTAIT LE PARENT PAUVRE DES QUATRE RENDUS — et c'est celui qu'on projette (2026-09)

Le schéma **exige** des sources du modèle (« au moins une entrée dès qu'il y a des chiffres »). Le classeur leur
donne une feuille, le Word une section, le PDF un bloc — **le PowerPoint les jetait** : `spec.sources`
n'apparaissait pas une seule fois dans `rendrePptx`. Un deck dont on ne peut pas dire d'où vient le chiffre ne se
défend pas en séance : c'est la première question posée.

Il coupait aussi **deux fois en silence** — dix lignes sur quarante, quatre feuilles sur douze — là où le Word
**dit** ce qu'il laisse (« 30 lignes supplémentaires — voir le classeur »). Une coupe silencieuse se lit comme une
exhaustivité : le lecteur croit voir le tableau, il en voit le quart.

La cause n'est pas trois oublis indépendants : ce rendu-là a été écrit comme un **aperçu**, et c'est lui qui passe
en comité. Corriger `rendrePptx` répare le cas ; `render-complet.test.ts` répare la **classe** — il boucle sur les
**quatre** formats, donne à chacun une spec plus grosse que toutes ses limites, **rouvre** le fichier avec
l'adaptateur de production et exige d'y lire la source déclarée et le compte de ce qui n'a pas tenu. Le prochain
format ajouté ne pourra pas recommencer.

**Et la cause était plus profonde : il y avait deux constructeurs de decks.** `src/lib/artifact/decks/build.ts` tient
les règles éditoriales comme des **bloquants**, relit le fichier produit avec l'adaptateur de production et le soumet
au contrôle de livraison — il sert la capacité `artifact.deck_build` d'Adam et la fabrique de dossiers de comité.
`rendrePptx` dessinait à la main, et c'est **lui** qui produit le deck qu'une mission envoie. Les deux avaient divergé
exactement là où on l'attend : **sept puces d'un côté, six de l'autre**, pour la même règle.

Le rendu des missions ne dessine plus rien : il **traduit** (`artifacts/deck.ts`) vers le constructeur unique, et la
traduction ne jette jamais — treize puces deviennent trois diapositives, un paragraphe de 300 mots devient des corps
successifs, un tableau de 40 lignes montre ses douze premières **en le disant dans son titre** (les notes sont pour le
présentateur ; l'assemblée voit la diapositive). Un test pousse chaque borne et exige zéro bloquant. Gagné au passage,
sans une ligne de plus : notes du présentateur, chiffre clé, thème — et un compte de diapositives **mesuré**, là où
`detail.diapositives` valait `1 + summary.length`, faux dès qu'une section débordait.

### UNE DONNÉE A UN ÂGE — ET RIEN, NULLE PART, NE S'EN SOUVENAIT (2026-09)

`FaitCalibrable` portait `fraicheur` et `horodatage` **depuis le premier jour** : déclarés sur
l'interface, lus par personne. Conséquence mesurable : un fait extrait d'une **copie indexée il y
a six mois** avait `base: "metadata"` et une confiance de 0,95, donc il sortait `CERTAIN` →
`AGIR`, annoncé **« FAIT VÉRIFIÉ »**. Adam proposait de résilier sur une clause que le Drive avait
pu réviser entre-temps, et la carte d'action ne disait rien. C'est le faux succès de la mission de
trois semaines qui conclut sur un forecast périmé, **un cran plus haut** : une seule phrase de
conversation, sans aucune étape en échec pour le signaler.

**PÉRIMÉ est un état, pas un degré de confiance.** L'âge et la provenance sont deux axes : les
confondre perdrait l'un des deux, et la conduite n'est pas la même — sur une provenance faible on
**cherche ailleurs**, sur une donnée vieille on **relit la même source**. D'où un sixième état
(`PERIME`) et une sixième conduite (`RELIRE`), rangés entre « probable » et « hypothèse » : une
copie datée reste la lecture d'une vraie source, là où une hypothèse est la mémoire d'un modèle.

**La moitié de la règle est dans ce qui NE périme pas.** Trois conditions, toutes nécessaires :
il faut une **copie** (une lecture en temps réel ne périme pas de la date de sa donnée — une
facture de 2024 EST de 2024, la table était vivante au moment de la lecture) ; une date qui **se
lit** (sans elle on ne déclare rien, et une date future est une saisie fautive, pas une
péremption) ; et un dépassement du seuil de sa **nature** — un chiffre financier tient 24 h, un
statut réglementaire 72, une parole humaine une semaine, une fiche ERP deux, un document trente.
Un seuil unique serait faux dans les deux sens : il ferait relire ce qui est stable et laisserait
passer ce qui bouge.

Les durées vivent au **socle** (`src/lib/fraicheur/ages.ts`, zéro import) parce que la
conversation et le moteur de missions en ont besoin **sans avoir le droit de se parler** : deux
tables auraient divergé, et le jour où l'une dit 24 h et l'autre 72, personne ne saurait laquelle
fait foi.

**Trois corollaires, trouvés en branchant.** (1) Un **calcul** héritait déjà de la pire confiance
de ses entrées et de leur date la plus ancienne — pas de leur fraîcheur : un total bâti sur une
copie de mars se déclarait « temps réel ». Les trois propriétés vont ensemble. (2) Ce même calcul
se juge sur le budget le **plus large**, parce que `faitCalcule` ne garde pas la nature de l'entrée
qui gouverne : annoncer périmé un total de deux jours ferait une réserve permanente, et une
réserve permanente cesse d'être lue. (3) L'avertissement atteint la **carte d'action**, pas
seulement la trace — la trace se déplie, la carte est ce que la personne confirme.

**ET UNE ESTIMATION PORTAIT LA MÊME ÉTIQUETTE QU'UNE LECTURE DE L'ERP.** `faitCalcule` donne à
un total la pire confiance de ses ENTRÉES ; les entrées d'une simulation sont des **lois**, pas
des faits — donc `Math.min()` d'une liste vide, donc **1**. Un P90 de Monte-Carlo et une prévision
de série sortaient à 100 % de confiance, `CERTAIN` → `AGIR`, annoncés « FAIT VÉRIFIÉ ». Le moteur
le savait pourtant : il écrit ses hypothèses, ses limites et ses avertissements à côté du chiffre,
et l'en-tête de `calcul-tools.ts` dit qu'« un P90 sans le nombre de tirages est un chiffre qui a
l'air sûr ». C'est la calibration qui le contredisait, avec le seul mot que la personne lit.

La ligne de partage n'est ni le moteur ni le déterminisme — une simulation à graine fixe se rejoue
à l'identique : **un calcul dit ce que les données CONTIENNENT, une estimation ce qu'elles
SUGGÈRENT** sous des hypothèses déclarées. Une somme d'écritures réglées, une régression sur des
points observés, un chemin critique décrivent ce qui EST ; un tirage et une prévision décrivent ce
qui n'a pas encore eu lieu. Le drapeau est posé par l'APPELANT, jamais deviné : le moteur ne voit
qu'un nombre.

**Mesuré** : 16 tests sur la calibration (dont la date illisible, la date future, le seuil par
nature, l'ordre des états, le budget d'un calcul, un P90 qui ne peut plus sortir certain, et la
symétrie — une somme déterministe reste certaine), 3 sur le point d'entrée réel `calibrerTour` — un test qui n'appellerait
que `calibrer` dirait que le calcul est juste sans dire qu'il arrive quelque part — et 2 sur la
propagation de fraîcheur dans un fait calculé, dont la symétrie (un calcul sur des lectures
vivantes ne devient pas une copie). **Au passage** : la liste des modules déclarés « neutres » à la
frontière Adam ↔ ERP se défendait par la phrase « sans état, sans base, sans règle métier » que
rien ne vérifiait — ajouter `import { prisma }` dans l'un d'eux aurait fait traverser la frontière
à tout ce qui l'importe sans qu'aucun compteur bouge. Un test le tient désormais.

### UN LIVRABLE DE MISSION EST MAINTENANT OUVERT, PAS SEULEMENT RENIFLÉ (2026-09)

Le contrôle d'un Word, d'un PowerPoint ou d'un PDF produit par une mission était : **plus de
200 octets, et les quatre premiers valent `PK\x03\x04`** (ou `%PDF`). C'est vrai d'une archive
vide. Passaient donc en `VERIFIED` — le seul statut qui vaut preuve d'achèvement — un document
sans un seul paragraphe, une présentation sans diapositive, un PDF sans page, et surtout **un
contrat portant encore « [à compléter] », « XXX » ou « {{client}} »**. Les quatre partent chez
quelqu'un ; le dernier est le pire, parce qu'il s'ouvre, s'imprime, a l'air fini, et le trou est
dedans.

Le livrable est désormais **ouvert par l'adaptateur de production**, modélisé, et soumis à
`controlerAvantLivraison` — le MÊME contrôle qui répond « est-ce que je peux l'envoyer ? » quand
une personne édite un document dans le Live Office. En écrire un second aurait donné deux
exigences de qualité selon l'origine du fichier, et celle des missions aurait pris du retard.
Pour un classeur, les deux contrôles coexistent sans se recouvrir : `controlerClasseur` confronte
le fichier à la SPEC (feuilles annoncées, nombre de lignes, totaux recalculés), l'ouverture pose
la question du destinataire (s'ouvre-t-il, reste-t-il un `#REF!`).

Ce que le rapport dit n'est plus une taille : **« 3 paragraphes non vides », « 5 diapositives »,
« 2 feuilles, 41 cellules remplies »**. Les avertissements (une numérotation d'articles qui saute,
une diapo à douze puces) sont remontés sans bloquer. Un format qu'on n'ouvre pas — ZIP, CSV — le
DIT au lieu de se déclarer vérifié.

**Et le rapport ATTEINT l'écran.** Il était écrit à la fabrication, rangé dans `qaReport`, et lu
par personne : la page d'une mission affichait « vérifié », un mot que rien ne distingue d'un
fichier qui s'ouvre et ne contient rien. Elle montre maintenant ce que le contrôle a VU, et les
avertissements qui ne bloquent pas. **Le lien, lui, OUVRE le document** (`/office/live/<node>`)
au lieu de mener à sa fiche au Drive : un livrable qu'on ne peut que télécharger n'est pas
inspecté, on le range dans un coin et on le croit. Les formats que le Live Office ne dessine pas
(ZIP, CSV) restent au Drive, qui est ce qu'on sait faire pour eux.

**Mesuré** : 13 tests sur le contrôle, dont un qui vérifie que la fabrique APPELLE bien le
contrôle (§118.49 : un test qui lit le corps d'une fonction sans chercher son appelant est vert
sur du code mort) ; 2 tests sur le rapport qui atteint la vue (dont un rapport illisible, qui doit
rendre moins sans casser l'écran) ; une spec Playwright qui lit les lignes à l'écran et l'adresse
du lien. Deux sabotages joués — « le contrôle avant livraison ne bloque plus rien » fait tomber
3 tests, « on ne rouvre plus le fichier » en fait tomber 9.

### LES IMAGES DANS UN DOCUMENT — LES POSER, ET LIRE CE QU'ELLES MONTRENT (2026-09)

**Poser.** « Mets le logo Adventum en haut du contrat », « remplace celui de la diapo 3 », « le
tampon en B2 de la feuille Synthèse » : Word, PowerPoint et Excel, insertion, remplacement,
suppression. La commande porte le **nom** du fichier source, jamais ses octets — le moteur le résout
par le port, sous les droits de la personne, et un nom qui désigne deux fichiers rend les
**candidats** au lieu de coller le logo de 2019 dans un contrat de 2027.

**Excel demandait six endroits, pas quatre**, et trois de ses pièges ne font aucun bruit : le schéma
d'une feuille est une SÉQUENCE, si bien qu'un `<drawing>` ajouté « à la fin » d'une feuille portant
un tableau structuré produit un classeur qu'Excel *répare* en perdant le tableau ; une feuille ne
renvoie qu'à UNE partie dessin, si bien qu'en créer une seconde fait disparaître l'image d'hier sans
erreur ni trace ; et la relation vers les octets appartient au dessin — écrite dans la feuille, elle
donne un cadre vide. Sans taille demandée, on borne à la **zone d'impression que le classeur
déclare** (`pageSetup` + `pageMargins`) : une feuille n'a pas de bord à l'écran, mais elle s'imprime.

**Lire.** Un contrat scanné, un tampon d'homologation, un graphique collé, une photo d'étiquette : le
texte du fichier n'en dit rien, et c'est souvent là qu'est la réponse. `extraireImage` sort les
octets par le **même ciblage** que les commandes (« la 2ᵉ image » désigne le même objet qu'on lise ou
qu'on remplace) ; un **port de vision** les lit, rempli par le repli à quatre paliers déjà en place
(§38) plutôt que par un second chemin qui prendrait du retard. Un PDF se lit page par page — un scan
n'a pas d'image incorporée, la page ENTIÈRE en est une. Le texte ressort emballé comme une donnée non
fiable, la **note de méthode** voyage avec lui, et une installation sans port de vision le DIT au
lieu de répondre « lu, rien dedans » — qui ferait conclure que le tampon est vierge alors que rien
n'a été tenté.

**Un défaut trouvé par un test, et il était en production** : « ce document ne contient aucun
image ». Le refus était juste ; il était écrit dans une langue que personne ne parle, et c'est la
phrase qu'une personne lit et qu'un modèle reprend. Les accords vivent maintenant dans
`commands/resolve.ts`, la liste des libellés est explicite, et un test d'architecture refuse tout
libellé passé à `resoudre` sans genre déclaré.

**Mesuré** : 19 tests Excel, 11 de lecture d'image par le vrai point d'entrée, 5 d'accord de langue,
4 de bout en bout sur classeur (source cherchée par son nom, journal sans octets, rejeu, annulation) ;
fidélité vérifiée pièce par pièce ; banc de sabotage **16/16** attrapés (7 nouveaux).

### LE PROMPT DU WORKER COUPAIT SES ENTRÉES EN PLEIN MILIEU (2026-09)

**Le faux succès parfait, mesuré sur la chaîne humaine.** Khaled Mansouri répond « prix de cession
Nivolex 84 500 DZD, Trastuzex 61 200 DZD ; forecast 2027 : 1 240 et 890 unités ». Sofiane Kaci
répond « AO-2026-114 … AO-2026-131 ». Les attentes se règlent. L'étape de consolidation rend
pourtant « prix de cession : NON FOURNIS », et les deux livrables sont bâtis là-dessus : **0 chiffre
du jeu d'essai sur 6** dans le classeur, 0 sur 6 dans le deck. Toutes les étapes vertes, les fichiers
s'ouvrent, la QA passe. Quatre personnes dérangées pour un document qui déclare n'avoir rien reçu.

**La cause, et ce n'était pas le modèle.** `composerPromptWorker` écrivait
`JSON.stringify(input, null, 2).slice(0, 6000)` — une coupe brute, au milieu du JSON, sans un mot.
Deux dossiers ERP de ~8 800 caractères mangeaient le budget ; les deux réponses humaines, trois
lignes chacune, n'atteignaient jamais le modèle. `MissionWorkerRun.input` gardait l'entrée COMPLÈTE :
c'est ce qui a fait accuser le modèle trois runs de suite.

**Ce qui remplace la coupe** (`lib/missions/runtime/entrees.ts`, module pur) : le budget se répartit
ENTRE les clés au sens max-min (les petites d'abord, leur surplus aux grandes) — aucune clé ne
disparaît ; une coupe se DIT à l'endroit exact (« son absence ici ne prouve rien, ne conclus pas
qu'il n'existe pas ») ; rien n'est coupé tant qu'il reste de la place.

**Mesuré, deux chaînes qui ne partagent ni domaine, ni format, ni personne** : A (Regulatory →
Finance → Marchés, xlsx + pptx) 9/12 → **11/12**, `.xlsx` 0/6 → **6/6**, `.pptx` 0/6 → 5/6 ;
B (RH + Finance + Supply Chain, docx) **9/10**, `.docx` **4/4**. Le banc lui-même s'arrêtait à « le
fichier s'ouvre » : il ouvre désormais la pièce et y cherche les chiffres que les gens ont donnés,
en comparant des NOMBRES à des NOMBRES (une aiguille cherchée dans une soupe de chiffres se trouve
toujours — §118.24).

**Trois autres étages, pris au même endroit.** Le contrôle `RETOURS_PERDUS` (`goal/qa.ts`) refuse un
retour humain dont aucun chiffre n'apparaît dans une seule SORTIE de la mission — jamais dans les
entrées, que le moteur vient de remplir. La parole d'une personne se lit au premier niveau
(`runtime/reponse.ts` : `{ reponseDe, contenu, pieces }`, toujours les trois) au lieu de
`payload.body` sous `attenteProgres`. Et la règle 21 du planificateur : ce qu'on fait dire à
quelqu'un, on le lit — pas de recherche dans la messagerie pour retrouver une réponse déjà en main.

### UN « JE NE PEUX PAS » ARTIFICIEL, ET DEUX REFUS MUETS (2026-09)

**Banc d'autonomie, 80 missions, même graine : réussite des réalisables 77,0 % → 81,1 %**
(score 89,8 → 90,3 ; COMPOSITION 3/5 → 5/5, FINANCE 4/5 → 5/5 ; 0 faux succès, 0 violation de droit,
0 fait sans provenance).

- **Une exigence déduite d'un mot tuait la mission.** « Sors-moi … la date d'échéance … UN TABLEAU »
  exige DOCUMENT ; le planificateur comprend un tableau à l'écran, planifie `show_table`, et la
  mission meurt sans rien livrer. On distingue désormais la NATURE du reproche : une faute de plan
  reste mortelle, une exigence de couverture laisse partir la mission avec la lacune DÉCLARÉE.
- **`outcome: EVENT` derrière un WAIT_INPUT** : le refus disait la faute, pas le remède. Il donne
  maintenant l'issue à écrire selon le type réel du nœud amont.
- **`watch_entity` recevant un critère** (« les dossiers dont l'échéance tombe dans 60 jours ») :
  une surveillance porte sur UNE cible ; un ensemble se surveille en listant d'abord, puis une par
  fiche — un éventail. Dit dans le refus ET dans la fiche de l'outil, avant l'essai.
- **Une capacité qui déclare son échec a échoué** (`{ ok: false }`), mais seulement quand elle
  ÉCRIT : sur une lecture, `ok: false` peut être une réponse (« non conforme »).
- **Le banc notait en échec la conduite exigée** : une écriture PLANIFIÉE mais arrêtée sur une porte
  d'approbation n'est pas une écriture, et une limite nommée à l'EXÉCUTION (« connecteur iqvia non
  configuré : IQVIA_BASE_URL, IQVIA_API_KEY ») vaut un manque annoncé — une ressource absente ne se
  voit pas depuis un catalogue.

### UNE PIÈCE QUI N'A PAS L'AIR OFFICIELLE LE DIT (2026-09)

Un BC Adventum émis par le chemin de production : structure juste (titre, blocs émetteur /
fournisseur, tableau de lignes, HT / TVA / TTC, somme en lettres, mentions de rappel, signatures),
mais **aucun papier en-tête déposé, bloc émetteur réduit au seul nom, aucun signataire**. Le code le
savait — `surPapierEnTete: false`, « Identité de l'émetteur incomplète : l'adresse du siège, le RC,
le NIF, l'article d'imposition, le NIS » — et le disait dans un champ JSON pendant que la phrase
annonçait « pièce inscrite au registre Legal ». C'est la phrase qu'un modèle reprend. La réserve
entre désormais dans la phrase, avec le geste exact qui la lève, et se tait quand tout est en règle.

### UN DÉMENTI DISPARAISSAIT EN SILENCE (2026-09)

**Le cas adverse, joué en live sur les deux chaînes** (`ADVERSAIRE=contradiction`) : Khaled répond
« prix de cession Nivolex : 84 500 DZD », l'attente se règle, la mission avance. Puis Khaled se
reprend : « Correction : c'est 91 000, pas 84 500. »

**Le second message n'a rien produit.** `reveillerMissions` ne regarde que les étapes `WAITING` :
plus aucune attente ne l'attendait, la fonction a rendu `[]`. Vérifié en base après deux runs :
ni `91 000` ni `19 800 000` (le démenti de la chaîne budgétaire) n'apparaissent nulle part — ni
étape, ni journal, ni notification. La mission aurait conclu sur un chiffre que son auteur avait
démenti, sans qu'aucune étape échoue. C'est le faux succès parfait : rien à voir, rien à corriger.

**Le routeur consigne désormais** : quand un fait NOMME une mission (`fait.missionId`) et qu'aucune
attente ne l'a consommé, il écrit un `MissionEvent` `EVENT_ORPHELIN` avec l'expéditeur et un aperçu
borné — « à relire avant de conclure ». Pas de seconde table (§118.5), pas de rejeu, aucune décision
prise à la place d'un humain sur la foi d'un message : le fait devient VISIBLE, ce qu'il n'était pas.
Le filet ne peut pas devenir du bruit — un événement ERP quelconque, qui traverse toutes les missions
ouvertes, n'écrit rien : il n'est adressé à aucune.

**Et le verdict qui devait le voir était lui-même un faux succès.** Première version : « le nouveau
chiffre est repris OU un mot de divergence apparaît ». Vert sur les deux chaînes — en accrochant
« contradiction relevée » (le juge parlant d'AUTRE chose) et « écart » (un écart facture/BC des
données ERP). Un mot-clé cherché dans tout le corpus mesure le vocabulaire ambiant, pas le fait.
Le verdict exige maintenant une trace de CE message : son chiffre corrigé, ou son entrée au journal.
Troisième tautologie retirée de ce banc.

**Mesure après correction** : chaîne A 10/11, chaîne B 8/10, le démenti consigné dans les deux cas.

### DEUX CHAÎNES HUMAINES, ET LA SECONDE A TROUVÉ CINQ DÉFAUTS (2026-09)

**Pourquoi une seconde chaîne.** La chaîne Regulatory → Finance → Marchés → Excel + PowerPoint
passait 10/10, deux fois de suite. Cela ne dit rien de l'architecture : « si seul un scénario
marche, c'est un échec architectural ». Le banc joue donc deux chaînes (`CHAINE=budget`), et la
seconde ne partage rien avec la première — RH + Finance + Supply Chain, TROIS sources
indépendantes au lieu de deux dossiers d'un même service, un **document Word** au lieu d'un
classeur et d'un deck, et le manquant chez la TROISIÈME personne au lieu de la première.

**Elle est passée sans une ligne de code de plus** : trois attentes ouvertes en parallèle,
chacune nommant sa personne et son sujet, les trois réponses consommées, la relance ciblée sur le
coût logistique manquant, le `.docx` produit et rouvert (`word/document.xml` présent), le
dirigeant informé. C'est le moteur, pas la mémoire du banc.

**Et elle a trouvé ce qu'un seul scénario ne pouvait pas révéler :**

1. **Le banc avait mémorisé la chaîne A.** Il lisait le manquant dans `SCENARIO[0]` — vrai pour
   A, faux pour B où il est chez la troisième personne. Verdict rendu : « la relance vise le
   MANQUANT (—) » : il ne cherchait rien.
2. **Le contrôle ARTEFACTS n'était pas dans la portée.** La complétude l'était depuis la chaîne
   A ; les artefacts non, parce que ce contrôle-là ne lit pas les étapes mais `planMeta`. Un QA au
   milieu du graphe réclamait le Word que produit une étape située APRÈS lui.
3. **`« Nom <adresse> »` n'était pas lu.** « Destinataire « Yacine Benali <yacine.benali@…> »
   introuvable ou ambigu » — pour le PDG, qui EST en base, avec son adresse dans la chaîne même.
   C'est la forme que tout client de courrier emploie ; le refus était artificiel.
4. **Le plan écrivait au DEMANDEUR.** Une fois l'adresse lue, l'étape a échoué sur « on ne s'écrit
   pas à soi-même » : « reviens vers moi » n'appelle aucune étape, le moteur notifie le demandeur
   de lui-même. Règle 16 complétée.
5. **L'e-mail choisi pour trois collègues internes, sans boîte connectée.** Trois étapes mortes,
   trois replanifications sur le même mur, zéro attente ouverte — et un refus qui ne proposait
   qu'un geste du PDG dans un écran de réglages. Un garde-fou qui bloque doit dire par où passer :
   il nomme désormais la messagerie interne, toujours disponible, et la règle 19 le dit au plan.

**Mesure, sans cueillir la bonne graine.** Chaîne A : 10/10, 10/10, 9/10, 9/10, 9/10. Chaîne B :
7/9, 5/9, puis 8/9 après ces corrections. La variance vient du plan — le planificateur produit
25 à 58 étapes pour la même demande — et elle est réelle : elle est notée, pas lissée.

### UNE SORTIE QUI CHANGE DE FORME SELON SON RÉSULTAT N'EST PAS UN CONTRAT (2026-09)

**Le problème, mesuré deux fois dans la même mission live.** Deux étapes sont mortes sur une
référence :

```
« {{annuaire:amel.resultat}} »        — champs disponibles : certain, candidats.
« {{annuaire:yacine.candidats.0.nom}} » — champs disponibles : resultat, precision.
```

Le planificateur n'avait pas tort : la question n'avait pas de bonne réponse. `resolve_person`
rendait `{certain, candidats}` quand il trouvait quelqu'un et `{resultat, precision}` sinon —
deux formes incompatibles, choisies par la DONNÉE. Or une mission écrit ses références au moment
de PLANIFIER, avant de savoir ce que la recherche rendra. Chaque pari perdu a coûté une étape
morte ET une replanification entière : plan v4, 46 étapes, 0,33 $ pour une mission qui en vaut
0,20 $.

**Le mécanisme des formes apprises n'était pas en faute — il disait vrai.** Interrogé sur les
40 dernières exécutions, il rendait exactement :

```
rend { candidats?, certain?, precision?, resultat? } — éventail sur « candidats » (vu sur 40 exécutions)
```

Quatre champs occasionnels, pas un seul sûr. Le « ? » portait l'information, mais noyé dans une
énumération il se lit comme un catalogue d'options plutôt que comme un avertissement. `direForme`
le dit désormais en toutes lettres quand AUCUN champ n'est garanti, et nomme la sortie sûre :
l'éventail, dont les éléments ont, eux, des champs constants.

**La correction du contrat.** `resolve_person` rend toujours les mêmes clés ; c'est la VALEUR qui
dit l'absence — une liste vide, que le moteur sait déjà traiter (règle 15 du planificateur : « si
la liste amont est vide, l'étape est simplement ignorée »), au lieu d'échouer sur un champ absent.

**Le recensement, parce qu'un défaut nommé une fois se répare.** Sur les 65 capacités réellement
observées en base (avec le filtre de production : l'étape parente d'un éventail rend l'enveloppe
du moteur, pas la sortie de l'outil), **11 n'ont aucun champ garanti** — `create_report`,
`inspect_record`, `list_commitments`, `person_report`, `product_360`, `recall_conversation`,
`regulatory_workload`, `search_documents`, `search_products`, `what_changed`, plus
`resolve_person` désormais réparée. Toutes ont la même forme de défaut : une réponse « trouvé »
et une réponse « rien trouvé » qui ne partagent aucune clé.

### LA GARDE DE SORTIE ÉTAIT DÉSARMÉE DANS TOUS LES BANCS (2026-09)

**Le problème, trouvé en réparant un verdict.** Le banc de la chaîne humaine rendait
« ✓ ZÉRO sortie réelle ». L'assertion s'écrivait `sorties.every(() => true)` : une tautologie —
vraie garde armée, vraie garde désarmée, vraie sur une liste vide. En la remplaçant par la
question qui compte (`sortiesInterdites()`), le banc a répondu **GARDE DÉSARMÉE**.

`sortiesInterdites()` reconnaissait `NODE_ENV=test`, `VITEST`, `PLAYWRIGHT` et un levier
explicite. Aucun de ces signaux n'existe sous `npx tsx scripts/bench/…` — c'est-à-dire dans les
bancs qui lancent de VRAIES missions, sur de VRAIES lignes de personnes, avec de VRAIES adresses.
Ce qui protégeait ces bancs-là n'était pas la garde : c'était l'espoir que chaque script soit
inoffensif. Une convention, exactement ce que `lib/sortie/garde.ts` dit refuser.

**La correction n'ajoute pas une variable à poser.** Un banc écrit demain l'oublierait, et
l'oubli est précisément le risque. `estUnBancDeMesure()` lit un FAIT du lancement — le script
d'entrée vit-il sous `scripts/bench/` (`argv[1]` ou `npm_lifecycle_script`) — et arme la garde
sans que personne ait à s'en souvenir. `garde.test.ts` pin les deux moitiés : un banc arme, le
serveur de production **n'arme pas** (une garde qui s'arme partout serait retirée dans la
semaine), et un chemin qui contient le mot « bench » sans être un banc ne compte pas.

**Ce que ça change dans la doctrine.** Une assertion dont on ne sait pas nommer le cas qui la
ferait tomber n'est pas une assertion (CLAUDE.md §118.17).

### LE QUATRIÈME ÉMETTEUR N'AVAIT AUCUNE GARDE (2026-09)

**Trouvé en posant la question de §118.80** — *qu'est-ce qui devient atteignable ?* — après avoir
ouvert 22 actions au chemin générique. Trois surfaces méritaient un regard ; deux étaient gardées
(`runTestCenter` par son rôle et ses phases, Microsoft Graph par la garde de sortie). La
troisième, `mail-smart.ts` — **l'e-mail par API HTTPS**, écrit justement parce que les ports SMTP
sont filtrés — n'appelait rien. Sous `ADAM_SORTIE_INTERDITE`, un banc déclenchant
`smart-mail-actions:sendMail` aurait envoyé un vrai courriel à une vraie personne.

**Pourquoi les deux règles d'architecture ne le voyaient pas.** La première s'arme sur un IMPORT
de transport (`nodemailer`, `web-push`), la seconde sur un APPEL reconnu. Ce module n'a ni paquet
ni interface : il fait un `fetch`. Une garde qui ne s'arme pas sur la forme qu'on lui donne est
désarmée en ayant l'air armée. La **troisième règle** juge un fait qui ne dépend d'aucune
bibliothèque : le module appelle le RÉSEAU et exporte une fonction d'ENVOI. Mesuré : 2 modules
répondent à ce fait, et il en manquait un.

**Et la règle s'est attrapée elle-même.** En documentant la troisième, la deuxième s'est mise à
« couvrir » `mail-smart.ts` sur un COMMENTAIRE qui citait ses motifs. Les trois règles jugent
désormais le code, commentaires retirés. Deux sabotages, deux endroits : supprimer l'appel fait
tomber la règle d'architecture ; le neutraliser (`if (false && …)`) ne la fait pas tomber — c'est
le banc de transport, qui appelle `sendSmartEmail` et exige le refus, qui l'attrape.

