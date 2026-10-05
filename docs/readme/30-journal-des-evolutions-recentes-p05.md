### LE PLANIFICATEUR ET LE REPLANIFICATEUR — huit défauts, tous mesurés sur des missions réelles (2026-09)

**Le symptôme, en trois phrases.** Le dirigeant demande un registre : il ne reçoit **rien**, et
rien ne le lui dit. Une mission de dix-sept étapes meurt sur un nom de destinataire sans qu'aucun
replan ne se déclenche. Une autre brûle neuf versions de plan et 1,10 $ à tourner entre deux murs.
Aucun de ces trois runs n'a une seule étape en échec qui explique la fin.

**1. Le livrable CONDITIONNEL** (mission `cmttakgtd…`, 9 versions). Les DEUX étapes `ARTIFACT`
sont `SKIPPED` sur « `normaliser:retour-initial.donneesCompletes` : false ≠ true ». Une personne
n'a pas tout donné, donc zéro fichier — et zéro étape en échec, mission non bloquée, journal muet.
Le compilateur comptait un nœud `ARTIFACT` comme couvrant `DOCUMENT` **sans regarder sa
condition**. `src/lib/missions/compiler/garanties.ts` (pur) ne pose plus qu'une question — *au
moins une de ces étapes partira-t-elle, quoi qu'il arrive ?* — et n'admet que trois paires de
conditions qui s'excluent **exactement** : `EVENT`/`TIMEOUT` sur une attente d'événement,
`eq`/`ne`, `exists`/`empty`. Pas `gt`/`lte` : sur une valeur non numérique, `comparerValeurs`
rend faux **des deux côtés**. C'est cette précision qui laisse passer la forme que la règle 18 du
planificateur IMPOSE pour une relance — refuser à tort coûte plus cher que le défaut corrigé.

**2. `SKIPPED` n'est pas un acquis.** `materialiser` le gelait avec l'argument de `DONE` (« pas de
second envoi »), qui est faux : le moteur écarte **avant** d'exécuter. Un plan v10 qui reprenait le
livrable le retrouvait terminal — mort pour toujours.

**3. Un replan ne pouvait pas RETIRER.** `?? undefined` sur une colonne JSON signifie, pour Prisma,
« ne touche pas à ce champ ». L'étape réarmée reprenait le `when` du plan v1 et se faisait ignorer
une seconde fois, sur une condition qu'aucun plan ne portait plus. `Prisma.DbNull` dit VIDE.
Trouvé par le test du point 2 — pas par relecture.

**4. Une étape derrière un mur n'est pas du travail à venir** (mission `cmtta95k1…`). Deux envois
en échec définitif et **onze étapes `PENDING` qui en descendaient**. La mission le voyait
(`BLOCKED`) ; le jalon comptait ces onze étapes comme du travail en cours, restait `ACTIVE` pour
toujours, et la reprise de jalon (§118.47) — écrite, testée — n'a **jamais** pu se déclencher.
`src/lib/missions/runtime/impasse.ts` (pur) remonte le graphe depuis les échecs définitifs, et ne
contamine jamais `WAITING` (un événement peut encore la réveiller) ni `SKIPPED` (ses descendantes
partent, §37).

**5. Une oscillation n'est pas un progrès.** « Le refus a changé (`INVALID_SHAPE` →
`OBJECTIF_NON_CONSTATE`) » a été écrit **deux fois** pour le même jalon : ne comparer qu'au dernier
refus ne retient qu'un pas d'histoire. `MissionMilestone.refusVus` porte toute l'histoire ; une
modification d'objectif la remet à zéro.

**6. Un refus nomme le remède de celui qui le LIT.** `recipientName: "Équipe Regulatory"` →
`send_message` refuse, à juste titre, et dit « précisez le bon collègue ». C'est une phrase écrite
pour une personne devant un écran ; dans une mission, c'est le **planificateur** qui lit, et il l'a
suivie — le sous-plan suivant posait la question **au dirigeant**, alors que l'annuaire connaît ces
personnes. `personnes/designation.ts` reconnaît un nom de groupe à un fait du texte (vocabulaire
fermé, mot collectif en tête, suivi de quelque chose : « Direction Benali » est un patronyme) et le
refus donne les **deux** gestes : lister, PUIS déployer en éventail.

**7. Une fille d'éventail appartient au jalon de sa mère.** Jalon « les pièces sont officiellement
SOLLICITÉES » : les deux filles partent, aboutissent, leur résultat dit « Message envoyé à Amel
Haddad ». Le juge du jalon ne charge que les étapes portant son `milestoneId` — la mère, jamais les
filles — et `attestationEffets` a conclu, honnêtement, « AUCUNE écriture et AUCUN envoi ». Refusé
**deux fois pour avoir réussi**. Tout le travail réel d'une mission massive vit dans les filles.
Corollaire (§118.61) : leur donner un `milestoneId` les fait entrer dans le périmètre de
`materialiser`, or un plan ne LISTE jamais une fille — sans garde, chaque replan l'aurait marquée
contournée et l'éventail recompterait « 0/2 » sur deux envois partis.

**8. Solliciter sans attendre n'est pas un jalon, c'est une moitié de jalon.** Le juge relit le
résultat dès que plus aucune étape ne peut avancer : un sous-plan qui envoie ses demandes et
s'arrête se fait juger une seconde après, sur un résultat que personne n'a eu le temps de produire.
La consigne du jalon le dit maintenant, avec le geste qui retient le juge.

**9. Un planificateur qui ne rend rien était un non-événement.** « Le planificateur n'a rien
rendu » écrit **trois fois** pour le même jalon : il restait `PENDING`/`planVersion: 0`, la
frontière le reprenait, l'échec se répétait — et rien ne comptait, parce que le budget local ne
s'incrémente que lorsque le **compilateur** refuse. Un appel de planification par tour,
indéfiniment, pendant que le battement annonçait « rien de neuf : la mission attend ». Un plan vide
porte désormais sa signature (`PLAN_VIDE`), entre dans l'histoire du jalon, et sa répétition le
bloque en le disant.

**Mesuré, même banc, même demande, avant → après :** 0 personne sollicitée → **4** ; 0,45 $ →
**0,15 $** ; question au dirigeant → aucune. Fichiers : `compiler/garanties.ts`,
`runtime/impasse.ts`, `personnes/designation.ts`, `horizon/budget.ts`, `runtime/store.ts`,
`runtime/engine.ts`, `platform/…/horizon.ts`, `planner/plan.ts` (règles 23 et 24). Migration
`20261103090000_milestone_refus_vus`. Doctrine §118.67 à §118.69.

### LE PLAN MORT-NÉ — une replanification qui ne pouvait pas démarrer, et le destinataire illisible (2026-09)

**Le symptôme.** Chaîne humaine « regulatory », mission `cmtsdqc17…` : `5/12`, statut BLOCKED,
plan v2, **41 étapes dont 12 seulement sorties de PENDING, 0 réveil, 0 attente levée, aucun
`.xlsx`, aucun `.pptx`**. Pire que les runs précédents (9/12, 11/12, 10/12), et sans un seul
signal disant pourquoi.

**La première cause, dans le journal.** `STEP_FAILED — Destinataire «  » introuvable ou ambigu.`
Le destinataire n'était pas introuvable : c'était l'objet rendu par `resolve_person`,
`{ nom: "Amel Haddad", adresse: "amel.haddad@…", source, detail }`, déployé tel quel par
l'éventail sur l'entrée `recipientName`. Le lecteur attendait une CHAÎNE, `asStr` a rendu `""`,
et le refus a annoncé introuvable quelqu'un dont il tenait le nom ET l'adresse. Deux collègues
n'ont jamais reçu leur demande.

**La seconde cause, qui rendait la première fatale.** Les deux envois ayant épuisé leurs
tentatives, la mission a replanifié — correctement. Le plan v2 REPREND les deux envois et
accroche ses six attentes dessus. Mais `materialiser` faisait `upsert … update: {}` : « une étape
déjà terminée n'est pas réécrite ». Juste pour un ACQUIS — un envoi parti ne repart pas —
**mortel pour un ÉCHEC**. Les deux lignes sont restées FAILED ; une étape FAILED ne se termine
jamais ; ses dépendantes ne deviennent jamais READY. Vérifié arête par arête en base : les
**dix-huit étapes** du plan v2, profondeur 12, descendaient TOUTES de ces deux lignes. **Pas une
racine exécutable.** Le moteur a repris la main, n'a rien trouvé à faire, et `deduireEtat` a
rendu BLOCKED — honnêtement, sur un plan mort-né.

**Les trois corrections.**

1. **`src/lib/personnes/designation.ts`** — module PUR au socle (zéro import), aux côtés de
   `mutations/empreinte.ts` et pour la même raison : la conversation (L1) et le moteur de
   missions (L2) en ont besoin tous les deux et n'ont pas le droit de se parler. Il TRADUIT une
   désignation (`« Nom <adresse> »`, un objet candidat, un nom, une adresse) au lieu de la
   refuser, rend `null` sur ce qu'il ne lit pas à coup sûr, et ne devine JAMAIS : une liste d'UN
   candidat désigne cette personne, une liste de PLUSIEURS n'en désigne aucune. Le refus montre
   désormais ce qu'il a REÇU, au lieu d'un `«  »` trompeur.
2. **`resolve_person` porte `retenu`** — la personne sur qui AGIR : un élément quand la
   résolution est certaine, liste VIDE sinon (le moteur ignore une étape dont la liste amont est
   vide). Un plan qui déployait son envoi sur `candidats` écrivait à la bonne personne tant qu'il
   n'y en avait qu'une, et aurait écrit à TROIS homonymes le jour où il y en a trois.
3. **`materialiser` RÉARME** ce que le nouveau plan reprend : statut, tentatives et motif
   d'échec à zéro pour les seules étapes FAILED — DONE et SKIPPED restent acquis, RUNNING
   appartient à l'exécutant en cours, CANCELLED est une décision humaine. La clé d'idempotence
   est CONSERVÉE : une étape peut échouer après avoir produit son effet, et c'est le reçu qui
   empêche le doublon, pas le statut. Un `BLOCKED` déduit dit maintenant ce qu'il a lu — combien
   d'étapes en échec définitif barrent la route à combien d'étapes en attente.

**Et le banc a été rendu honnête.** Il ne donnait son accord qu'UNE fois, au lancement. Le plan
v2 a rouvert deux étapes à l'approbation (`APPROVAL_REOPENED`, `NOTIFIED ARBITRAGE`) — ce que la
porte DOIT faire — et personne n'a répondu. Un banc qui ne répond jamais à une question légitime
ne mesure pas l'autonomie, il mesure sa propre absence. Il répond désormais à chaque tour.

**Mesure après correction, même scénario, même jeu d'essai.** `5/12` → **`11/12`**. Les quatre
personnes sollicitées, **4/4 attentes levées**, 4/4 contenus distincts donnés, le `.xlsx` ET le
`.pptx` produits, ouverts, et portant **6/6** des chiffres du jeu d'essai chacun (le `.pptx` était
à 5/6 au meilleur run précédent). Zéro sortie réelle, 10 tentatives interceptées.

**Ce que ce run a révélé de plus, et qui est corrigé.** Le seul contrôle encore rouge est le
statut final : BLOCKED. Deux causes, toutes deux des FAUX NÉGATIFS — l'inverse du faux succès,
moins dangereux mais il empêche une mission juste de conclure.

1. **Le plan a cherché dans le Drive une pièce qu'il venait de produire**, sous un titre qu'il
   avait inventé (« Consolidation Nivolex–Trastuzex — 08-09-2026 » ; le fichier s'appelle
   `Consolidation_Nivolex_Trastuzex.xlsx`). Zéro résultat, lu comme une absence, et le juge a
   conclu « contradiction relevée ». Trois replanifications pour ne pas retrouver ses propres
   fichiers. L'étape ARTIFACT rend pourtant `driveNodeId`, `fileName`, `artifactId` : la règle 22
   du planificateur dit désormais de RÉFÉRER `{{produire:excel.driveNodeId}}`, jamais de chercher.
2. **Le contrôle ARTEFACTS ne pouvait plus passer après un replan qui renomme.**
   `identiteDuLivrable` (#88) garde exprès la clé d'origine — c'est ce qui évite un second
   fichier ; `artefactsAttendus` réclamait la clé du dernier plan. Deux mécanismes du même dépôt
   en désaccord sur l'identité d'une pièce. Le raccord est CAUSAL (`MissionArtifact.stepId`), pas
   nominal : une pièce périmée pointe vers l'ancienne étape et ne satisfait rien.

**Deux défauts de plus, trouvés par les runs de vérification eux-mêmes.** Le plan de la chaîne
budget écrivait DEUX étapes ARTIFACT au même format — un dossier Word avant les réponses, un
second après, le second descendant du premier. En base : 1 519 et 2 735 octets, le premier vide
de tout ce qui avait été collecté. Le compilateur refuse désormais deux pièces du même format
dont l'une descend de l'autre (§88) — le critère est la DESCENDANCE, pas le format : deux
contrats indépendants restent légitimes. Et le banc comptait comme un échec deux conduites
correctes : attendre le FICHIER promis (`waitFor.attachment`, que son script n'envoie jamais) et
différer une relance au 15 septembre. Il les nomme et les écarte ; toute autre attente ouverte
reste un échec.

**Mesure finale, code gelé, deux chaînes sans domaine, format ni personne en commun.**

| | avant | après |
|---|---|---|
| chaîne A (Regulatory, 4 personnes, XLSX + PPTX) | 5/12 | **12/12** |
| chiffres collectés dans le `.xlsx` / le `.pptx` | 0/6 · 0/6 | **6/6 · 6/6** |
| coût du run qui conclut | 0,4459 $ · 20 appels | **0,2164 $ · 13 appels** |
| chaîne B (Finance + RH + Supply, DOCX) | 8/10, `.docx` 0/4 | **9/10, `.docx` 4/4, UN seul fichier** |

Gardes tenues sur tous les runs : 0 sortie réelle (22 tentatives interceptées), 0 violation de
droit, 0 faux succès.

**Fichiers.** `src/lib/personnes/designation.ts` (+ test), `src/lib/assistant.ts`
(`resolve` lit une désignation, `gmail_prepare_mail` la sépare), `src/lib/assistant/adam-tools.ts`
(`retenu`), `src/lib/missions/runtime/store.ts` (réarmement), `src/lib/missions/runtime/engine.ts`
(`raisonDeLEtat` + réarmement des filles d'éventail), `src/lib/missions/planner/plan.ts`
(règle 22), `src/lib/missions/goal/qa.ts` (raccord causal des livrables),
`src/platform/boundary-scan.ts` + `domains.ts` (le socle),
`scripts/bench/chaine-humaine.ts` (accords rouverts).

### MISSION RUNTIME — exécuter une mission gigantesque devient une propriété codée (2026-09)

**Le problème.** Adam savait mener une conversation, appeler cent soixante-cinq outils et
proposer une action. Il ne savait pas EXÉCUTER : « souhaite la bonne année à tout le monde, puis
range les courriers non classés, puis récupère le contrat de Redouane » demandait trente-trois
envois individuels, une attente de cinq jours et une reprise après redémarrage — et rien dans
l'architecture ne portait cela. Une mission de cette taille n'échouait pas : elle n'existait pas.

**Ce qui n'a PAS été fait.** Aucun prompt système allongé, aucune liste de recettes, aucun agent
spécial pour quelques cas, aucune fonctionnalité « missions longues ». Aucun fichier
`newYearMission.ts` : une mission spécialisée aurait été l'échec du chantier, pas sa réussite.

**Ce qui a été construit.** Une couche transverse, `src/lib/missions/`, déclarée **façade (L2)** :

| Brique | Fichier | Ce qu'elle garantit |
|---|---|---|
| Machine à états | `runtime/state.ts` | 13 × 13 transitions testées. `COMPLETED`/`CANCELLED` sans sortie ; une étape `DONE` ne repart jamais ; §37 — une branche en attente ne gèle pas une branche exécutable |
| Contrat de plan | `planner/contract.ts` | Deux axes **indépendants** : raisonnement A/B/C, échelle S→MASSIVE. Le nombre d'étapes ne route jamais seul vers le raisonnement le plus cher |
| Registre de capacités | `registry/capability-meta.ts` | Effet, idempotence, groupabilité, latence, confirmation. Défaut **prudent** : une capacité non qualifiée est traitée comme une écriture externe |
| Compilateur | `compiler/` | Refuse une capacité inventée, une capacité interdite, un cycle, une forme incohérente — et §26 : 33 destinataires dans une étape |
| Moteur DAG | `runtime/engine.ts` | Réservation conditionnée en base, reprise des étapes orphelines, parallélisme borné, éventail déployé à l'exécution |
| Persistance | `runtime/store.ts` | Une étape terminée avec son reçu EST le point de reprise. Pas de table de checkpoints |
| Réveil par événement | `events/` | Une mission dort cinq jours sans consommer de modèle, puis repart quand le fait arrive — via `BusinessEvent`, sans second registre |
| Politique & approbation | `policy/`, `approval/` | Auto-escalade **structurellement** impossible ; un accord couvre tout un périmètre, et une empreinte immuable rouvre la partie modifiée |
| Récupération | `recovery/` | Douze causes, une échelle par cause, et l'interdiction de conclure tant qu'un recours reste |
| Objectif & qualité | `goal/evaluate.ts` | 31 envois sur 33 se comptent 31/33 ; sans juge, la mission ne conclut pas |
| Engagements & modèles | `commitments/`, `templates/` | Une promesse se ferme toute seule quand le fait arrive ; ce qu'Adam a observé n'est jamais ce qu'un humain a approuvé |
| Mémoire | `memory/` | Le contexte se compose sous budget ; une compression qui perd un identifiant est REFUSÉE |
| Écran | `view/workspace.ts` | « Où tu en es ? » sans un seul appel de modèle, et la carte se met à jour sur place |

**Réutilisé plutôt que recréé** — `MissionEvent` (journal), `BusinessEvent` (registre canonique),
`AssistantActionIntent` (idempotence + reçu), `src/lib/push.ts` (VAPID), `Reminder` et le
`scheduler` existants, `ExecutiveCommitment`, `AssistantArtifact`, `notifyUser`. Aucun second
registre d'événements, aucun second système de notifications, aucun ordonnanceur parallèle.

**Ce que le chantier a coûté en gardes.** Trois tests d'architecture ont refusé une première
écriture et ont été **suivis, pas contournés** : `boundary.test.ts` a refusé le 425ᵉ
franchissement Adam → ERP (remède : `mission.status` entre au contrat de plateforme),
`executive-security.test.ts` a refusé un `allowed: () => true` non déclaré, et la machine à
états elle-même a refusé une mission qui ne sortait jamais de `PLANNING`.

**Mesuré** (`src/lib/missions/evals/bench.test.ts`, 17 scénarios) : `prematureStopRate` 0 %,
`knownMismatchStopRate` 0 %, étapes rejouées après reprise 0, `recoverySuccessRate` 100 %,
compression à 52 % du volume d'origine. **Non mesuré et dit comme tel** : tout ce qui exige une
clé de fournisseur (utilité des questions, rappel mémoire sur questions réelles, latence
de bout en bout, coût réel en jetons).


### LE MISSION RUNTIME DEVIENT ATTEIGNABLE — le planificateur, la mémoire, l'accord (2026-08)

**Le problème, énoncé comme il l'a été.** « Toute capacité annoncée doit être réellement
utilisable par Adam depuis une vraie demande utilisateur, jusqu'au résultat final. » Le critère
est plus dur qu'il n'en a l'air. Un recensement de tous les symboles exportés du runtime — 152 —
l'a montré : **quatre n'avaient aucun appelant nulle part**, et vingt-quatre n'étaient appelés
que par leurs propres tests. Le compacteur de mémoire, la porte d'approbation côté humain,
l'attente d'un élément fourni par une personne : tout cela existait, était correct, était testé,
et **aucun chemin d'utilisateur ne l'atteignait**.

**Ce qui a été branché, et à quel point d'entrée réel.**

| Capacité | Elle était… | Elle part maintenant de… |
|---|---|---|
| Mémoire épisodique | écrite, testée, sans appelant | `rememberExchange` — le tour de conversation lui-même |
| Vieillissement de la mémoire | idem | le battement (`runScheduledJobs`) |
| Contexte composé sous budget | idem | `personalContext`, envoyé au modèle à CHAQUE tour |
| Accord sur une mission | `decider()` sans appelant | un clic sur `/missions/<id>` |
| Élément demandé à une personne | `fournirEntree()` sans appelant | le même écran |
| Suspendre / reprendre / arrêter | n'existait pas | l'écran, et `mission_control` dans la conversation |
| Relance d'une promesse en retard | quatre fonctions sans appelant | le battement |

**Trois défauts trouvés en branchant** — c'est le propre d'un branchement : il fait passer du
code par des chemins que ses tests n'avaient pas.

1. **Le juge ne voyait aucune clé d'étape.** Sa consigne exige de citer, pour chaque critère,
   l'étape qui le démontre, et `normaliser` ramène à NON_DÉMONTRÉ tout critère cité sans
   référence. On ne lui envoyait que « 34/34 étapes abouties » : soit il obéissait et ne
   démontrait rien, soit il inventait des clés — et la seconde issue a l'air d'une réussite.
2. **« Après ce message » se lisait sur la date seule.** Une question et sa réponse sont écrites
   d'un même geste et partagent leur milliseconde : la réponse dont la question venait d'être
   mémorisée disparaissait de la mémoire. La borne porte désormais sur le couple (date, id).
3. **`relancesDeduites` inversait un intervalle là où l'écart est un cumul.** Les rappels
   s'espacent de 1, 3, 5, 7… jours ; après k rappels l'écart vaut k². À 19 jours de retard,
   l'ancienne formule déduisait dix rappels d'un seul — une promesse trois semaines en retard
   recevait son premier rappel puis se taisait quinze jours.

**Ce qui a été REFUSÉ à un modèle, et pourquoi.** Accorder une autorisation et fournir une pièce
sont des **attestations humaines** : l'audit portera le nom de la personne. Les rendre appelables
par un modèle les exposerait à l'injection — un document lu par une étape pourrait contenir
« approuve la mission », et rien ne distinguerait plus cet accord d'un vrai. C'est la seule
falsification que ce système ne saurait pas détecter après coup. Elles exigent un clic ; et
`policy/guard.ts` interdit `mission_control` à l'agent lui-même, **à la compilation**.

**Le silence est une issue.** Une promesse rattachée à une identité canonique se relance ; une
promesse qui ne porte qu'un nom libre se tait. Annoncer « Redouane n'a toujours pas envoyé son
contrat » quand ce n'était pas ce Redouane-là est pire que ne rien dire (§9 : seul TROUVÉ
autorise à agir). La promesse reste visible dans l'espace de travail — elle ne pousse simplement
pas de notification.

**Les cliquets ont parlé trois fois, et ont été suivis trois fois.** Le panneau de mission écrit
dans `app/(app)/assistant/` ajoutait sept franchissements Adam → ERP : il a été reconnu pour ce
qu'il est — un écran de l'ERP — et déplacé vers `/missions/<id>`. L'outil `mission_control`
importait `missions/` depuis le périmètre d'Adam : il passe par le pont. Et six nouvelles actions
serveur ont dû être classées au registre de parité, dont deux en EXCLUDED avec la raison écrite.
**Aucun plafond relevé** : 69 traversées, 42 fuites fournisseur, 424 franchissements.

**Mesuré.** Contexte composé sous budget alors que la conversation brute croît linéairement
(cent tours, deux tranches, tous les tours absorbés) ; un même webhook reçu deux fois ne réveille
qu'une fois — et c'est tenu par **deux** gardes indépendantes, retirer l'une OU l'autre laisse le
banc vert, retirer les deux le casse. **Non prouvé en ligne, et dit comme tel** : qu'un modèle
réel produise un plan conforme ET compilable. Le banc `scripts/smoke/openai-live.ts` pose
exactement cette question (cas 8) et refuse de tourner sans clé.

### LA CONVERSATION DEVIENT L'INTERFACE — story, vues 360, gestes sans modèle (2026-08)

**Le problème.** Adam savait afficher un tableau, une fiche, un dossier. Il ne savait pas
RACONTER. « Retrace-moi l'AONIO 2023 » n'avait qu'une réponse possible : de la prose, écrite par
le modèle à partir de faits qu'il devait aller chercher un par un. Une chronologie inventée est
indétectable — elle a l'air d'une chronologie.

Et chaque bouton de l'espace de travail écrivait une PHRASE, qui repartait au modèle, qui devait
comprendre l'intention et retrouver l'outil que le serveur connaissait déjà quand il a dessiné
le bouton. Un aller-retour complet pour retrouver ce qu'on savait au départ.

**Ce qui a été fait.**

| Lot | Contenu |
| --- | --- |
| 1 | Protocole v2 : `entityRef`, `state`, `certitude` sur tout bloc ; cinq blocs — `story`, `entity360`, `comparison`, `mission`, `alerte` |
| 1 | `src/lib/queries/story.ts` — la frise reconstituée depuis la base, jamais par le modèle |
| 1 | Capacité `business_story` via le contrat (`business.story`) ; relecteurs dans `compose-godmode.ts` |
| 2 | §23 — un bouton porte son `intent` : registre FERMÉ, LECTURES seules, zéro appel au modèle |
| 2 | Vues 360 produit / marché composées côté ERP, là où les types existent (`e360-blocks.ts`) |
| 3 | §22 — `elaguerFil` : une identité, une seule carte. Le brouillon devient l'envoi, il ne s'empile pas |
| 3 | Mesures au banc d'architecture : jetons de schéma évités, charge d'affichage retirée |
| 4 | Audit hostile : porte des capacités transverses corrigée, retrait de jetons rendu opt-in |

**Les chiffres mesurés** (déterministes, sans clé — `architecture-evals.test.ts`) :

| Mesure | Valeur |
| --- | --- |
| Registre complet | 165 outils · 56 732 jetons de schéma |
| Tour évité par geste direct | 3 163 à 9 440 jetons selon la capacité |
| Séquence de zoom complète | 33 429 jetons + 5 appels modèle évités |
| Charge d'affichage — story 40 jalons | 4 972 → 52 jetons (− 99 %) |
| Charge d'affichage — vue produit | 1 349 → 420 jetons (− 69 %) |

**Les quatre règles qui restent.**

1. **La frise vient de la base.** Ce qui est DÉDUIT le dit (`certitude`), ce qui MANQUE s'affiche
   comme un trou — c'est précisément ce qu'on cherche en retraçant une affaire.
2. **Un bouton ne mute jamais sans confirmation.** Le registre des gestes directs ne contient que
   des lectures ; les mutations gardent la phrase, donc la proposition, la carte et l'audit.
3. **On n'échange pas des jetons contre des faits.** Le retrait de la charge d'affichage est
   OPT-IN : sans `_blocsDecoratifs`, rien n'est retiré.
4. **Une capacité qui traverse les modules s'ouvre à la vue globale**, pas au module dont elle
   porte le nom — sinon on condense les portes en même temps que la séquence.

**Ce que les captures ont trouvé et qu'aucun test vert n'aurait montré** : la story cachait ses
jalons manquants derrière un pli ; des valeurs d'énumération anglaises (`PAID`, `WON`) arrivaient
à l'écran ; la provenance (`PchTenderLine`) était permanente sur téléphone faute de survol ; une
erreur de mission disait quoi faire sans permettre de le faire.

### LE PRODUIT DEVIENT UNE ENTITÉ — clé étrangère au lieu de ressemblance de libellé (2026-08)

**Le problème.** Un même produit s'écrivait différemment dans six modules — dossier
réglementaire, profil promotion, étude BD, ligne de marché PCH, vente, dépense Ad&Pro — et rien
ne les reliait. « Combien rapporte le produit X ? » demandait donc à Adam d'appeler cinq outils
puis de rapprocher les libellés AU JUGÉ. Un rapprochement au jugé finit toujours par confondre
un 40 mg et un 100 mg, et le chiffre d'affaires se présente en réunion sous le mauvais nom.

**Ce qui a été posé, en neuf lots.**

| Lot | Ce qu'il apporte | Fichiers |
|---|---|---|
| 1 · Entité canonique | `Product` + `ProductAlias`, clé d'identité unique portée par la BASE. Un produit peut exister AVANT son dossier réglementaire. Les trois modèles existants deviennent des PROFILS (`productId` nullable) — rien n'est supprimé. | `src/lib/products/identity.ts`, `resolve.ts` |
| 1b · Traversées | `ProductAssignment` (qui porte quoi, depuis quand, pour quelle quotité), `MedicalVisitProduct`, `AdProProductAllocation`, `PchTenderLine.productId`, `Sale.productId` / `tenderLineId`. | `prisma/schema.prisma` |
| 2 · Lectures 360 | `produit360` et `pch360` — une lecture au lieu de six allers-retours. | `src/lib/queries/product-360.ts`, `pch-360.ts` |
| 3 · Registre d'événements | L'audit ALIMENTE le registre : un point d'émission au lieu de cinq cents. Liste blanche stricte — tout n'est pas un fait. | `src/lib/events/from-audit.ts` |
| 4 · Couche sémantique | 13 métriques nommées, chacune avec sa DÉFINITION écrite, qui voyage avec la valeur. | `src/lib/metrics/catalog.ts`, `src/lib/queries/metrics.ts` |
| 5 · Capacités métier | `product_economics`, `pch_market_status` — entrées par le CONTRAT de plateforme. | `src/lib/assistant/business-capabilities.ts` |
| 6 · Surfaces | Les capacités atteignables à la VOIX comme au texte. | `capability-surface.ts` |
| 7 · Graphe d'entreprise | Traverser des arêtes DÉCLARÉES, pas chercher du texte. Pas de Neo4j : le graphe, c'est le schéma. | `src/lib/queries/graph.ts` |
| 8 · Migration Adam | La doctrine dit de PRÉFÉRER la capacité — sinon elle n'économise rien. | `executive-tools.ts` |
| 9 · Banc de mesure | Les chiffres ci-dessous, et ce qui NE se mesure pas ici. | `architecture-evals.test.ts` |

**Les chiffres, mesurés et non estimés.**

| Mesure | Avant | Après |
|---|---|---|
| Outils envoyés au modèle par mission | 164 (registre complet) | **15** |
| Jetons de schéma par tour | 56 459 | **~3 000** (−94 %) |
| Coût de la capacité vs la séquence remplacée | 2 369 jetons (5 outils) | **262 jetons** (−89 %) |
| Appels d'outil, 3 missions réelles | 11 | **3** |
| Rapprochement produit | ressemblance de libellé | **clé étrangère** |

**Les quatre règles qui tiennent l'ensemble.**

1. **Un mot, un calcul.** « Chiffre d'affaires » désigne cinq montants (attribué, commandé,
   livré, facturé, encaissé). Chacun porte son nom et sa définition ; aucun n'est additionné à
   un autre. Le double compte bon de commande / vente est fermé et testé.
2. **Zéro n'est pas « on ne sait pas ».** Une donnée manquante rend `null` AVEC sa raison.
   Jamais zéro, jamais une estimation, jamais un prorata inventé.
3. **On ne traverse que des arêtes déclarées.** Une relation que personne n'a posée n'apparaît
   nulle part — c'est ce qui sépare une traversée (vraie) d'une recherche (probable).
4. **L'ambiguïté se pose à l'humain.** Deux dosages d'une molécule sont deux produits : la
   lecture rend la QUESTION, elle ne tranche pas.

**Ce qui ne se mesure qu'en production** (clé OpenAI requise) : appels modèle réellement émis,
jetons de raisonnement, latence, tours utilisateur. Les bornes existent dans le code ; les
nombres doivent venir des journaux.

### L'ARCHITECTURE DEVIENT MESURABLE — quatre couches, zéro cycle, et des chiffres qui ne mentent pas (2026-08)

Le code était un monolithe, mais pas un monolithe MODULAIRE. Ce lot le rend
vérifiable plutôt que déclaré.

**Les deux cycles entre domaines sont supprimés.** `drive ↔ regulatory` : `mime.ts` et
`object-storage.ts` sont de l'infrastructure de stockage (détection de type, présignature S3)
rangée sous `regulatory/intelligence/` — le Drive devait donc fouiller dans le Regulatory pour
lire un fichier. Les deux modules rejoignent `src/lib/storage/`. `google ↔ mail` : `comms/`
détient la politique d'envoi, `google/` est l'adaptateur qui l'applique ; le sens correct est
adaptateur → domaine, et neuf arêtes sur dix l'étaient déjà. La dixième —
`comms/approve-execute.ts` qui allait chercher `gmailTransport` — est inversée : le transport
devient un PARAMÈTRE. Choix délibéré face à un registre, parce que le typage rend alors l'oubli
impossible, là où un registre mal initialisé aurait laissé un envoi échouer en production.

**La carte des couches** (`src/platform/domains.ts`) : L0 socle → L1 les quinze domaines →
L2 façades transverses (`queries/`, `api/`, `links/`) → L3 Adam. Une couche ne parle qu'à
celles du dessous. `domains.test.ts` tient trois invariants à ZÉRO (cycles, propreté du socle,
inversions de couche) et deux cliquets qui ne doivent jamais monter : **76 traversées
inter-domaines, 42 fuites vers un fournisseur**.

Le test du socle est celui qui rend les autres honnêtes : sans lui, il suffirait de déplacer un
fichier gênant dans `utils/` pour voir le compteur baisser sans avoir rien assaini. Deux autres
tricheries sont fermées de la même façon — passer par une façade, ou casser un chemin de la carte
pour qu'un domaine disparaisse du compte. **Chaque garde a été vérifiée sur une arborescence
témoin où la violation est plantée exprès** : un test qu'on n'a jamais vu échouer ne prouve rien.

**L'audit de capacités (§12) est mesuré, plus déclaré** (`assistant/capability-audit.test.ts`).
La classification NATIVE/COVERED/GAP/EXCLUDED est déclarative — une op dit ce qu'elle couvre —
donc rien n'empêchait a priori une op de promettre dans le vide. Quatre contrôles ferment les
quatre façons d'annoncer une capacité absente, dont un qui manquait : **une op absente de
l'énumération de son outil existe dans le code et reste innommable par le modèle**. Mesure du
jour : 644 server actions — **534 NATIVE, 34 COVERED, 0 GAP, 76 EXCLUDED motivées** ; 30 outils
de domaine, 493 ops exécutables.

**Le routage par rôle (§5–§8) est prouvé** (`models/routing.test.ts`). `models.test.ts`
vérifiait la TABLE des rôles, jamais l'USAGE : rien n'empêchait qu'un chemin textuel demande le
rôle `realtime`, ni qu'un ouvrier reçoive des outils — deux régressions qui ne cassent rien,
coûtent cher et changent le comportement. Six invariants, dont les deux qui comptent vérifiés en
plantant la violation. Mesuré : `routeKnowledge` = **0,0051 ms/appel** après chauffe — le routage
de connaissance ne consulte aucun modèle.

Fichiers : `src/platform/domains.ts` + `.test.ts`, `src/lib/storage/{mime,object-storage}.ts`,
`src/lib/comms/approve-execute.ts`, `src/lib/general-means/budget-targets.ts`,
`src/lib/assistant/capability-audit.test.ts`, `src/lib/models/routing.test.ts`.
Vérifié : tsc, 4124 tests, lint, build propre, 25/25 E2E.

### LE CERVEAU D'ADAM CHANGE DE MAISON — passerelle par rôles, triage A/B/C, lot d'exécution (2026-08)

Refonte du MOTEUR (l'UI est traitée à part). Trois choses qui n'existaient pas.

**1. Une passerelle modèle par RÔLE** (`src/lib/models/`). `src/lib/ai.ts` n'était pas une
abstraction : c'était l'API Anthropic, dont les noms (`ClaudeToolDef`, `tool_use`, `input_schema`)
avaient fui dans 23 fichiers — donc changer de modèle voulait dire réécrire 23 fichiers, donc ne
jamais en changer. La forme est désormais NEUTRE, et le code appelant demande un rôle :

| rôle | modèle | ce qu'il fait |
| --- | --- | --- |
| `realtime` | `gpt-realtime-2.1` | écoute, comprend, converse, **décide** |
| `orchestrator` | `gpt-5.6-terra` *medium* | investigue, planifie, synthétise |
| `worker` | `gpt-5.6-terra` *none* | une sous-tâche qui demande de comprendre |
| `bulk` | `gpt-5.6-luna` *none* | extraire, classer, normaliser, en volume |

Chaque rôle se rebranche par variable d'environnement ; `ADAM_MODEL_PROVIDER=anthropic` rebascule
les rôles textuels sur l'ancien cerveau (une migration sans marche arrière est un pari, pas une
migration). **Le texte part directement sur l'orchestrateur** — il ne passe plus par le temps réel.
`assistant.ts` a changé d'UN import : le pont `models/compat.ts` garde les signatures que la boucle
manipule, et sa disparition sera un jour la preuve que la migration est finie.

**2. Le triage A/B/C.** La délégation vocale existait, mais son critère était « mes outils rapides
couvrent-ils ça ? ». Il devient **« est-ce que je sais déjà QUOI faire ? »** : A = une opération
connue, B = plusieurs opérations connues (exécutées **sans** déléguer), C = le plan est à découvrir.
Le nombre d'actions ne fait pas la complexité — trois gestes connus restent un B, et déléguer là
c'est payer un modèle de raisonnement pour exécuter une liste qu'on avait déjà. L'outil de
délégation demande désormais **ce qu'il faut découvrir** ; un motif creux est consigné, jamais
bloqué.

**3. Une mission = une confirmation.** « Tout confirmer » bouclait **dans le navigateur** : un
aller-retour par action. Un onglet fermé au milieu laissait la moitié du lot partie sans qu'on
sache laquelle. L'enchaînement est passé côté serveur (`assistant/execution/bundle.ts` +
`executeAssistantBundle`), sans aucune sémantique d'exécution nouvelle : chaque étape repasse par
`executeIntentGuarded` puis `performAction`. Une action CRITIQUE ne s'enchaîne jamais et son refus
se **dit** ; un échec n'entraîne pas ce qui est indépendant mais **entraîne ce qui en dépend**
(convention `$prev` déjà en place) ; **aucun réessai automatique** — une action manquée est un
désagrément, une action faite deux fois ne se reprend pas.

**La mesure** (§12) : chaque tour est nommé (texte / vocal direct / vocal délégué / worker / fond)
et compte ses appels **par rôle**, ses outils, le temps jusqu'au premier signe de vie puis jusqu'au
résultat. Un tour ne s'imbrique pas : quand la voix délègue, le tour texte **rejoint** le tour vocal
— l'inverse cacherait la preuve qu'un C fait bien travailler l'orchestrateur.

**Le coût ne ment pas.** Luna est tarifé et vérifié ; Terra ne l'est pas dans ce dépôt, donc son
coût vaut `null` — jamais zéro, jamais une estimation plausible. Un seul tarif manquant rend le
total du tour inconnu. Ils se renseignent sans redéploiement (`ADAM_PRICE_*`).

**Deux gardes tenues plutôt que contournées** : la passerelle entre dans le périmètre d'Adam (c'est
son cerveau, il l'emporte) et ne dépend de RIEN du métier — un test le gèle ; la dette de frontière
**descend de 425 à 424**. Et la règle de triage dépassait le plafond de caractères des instructions
vocales (un garde-fou de latence) : elle a été resserrée et la place reprise sur des consignes
qu'elle rendait redondantes — le plafond n'a pas bougé.

**Pas encore fait** : les workers parallèles pilotés par l'orchestrateur, et le scheduler persistant.

### LE FIL DEVIENT LE CANVAS — Adam parle peu, montre beaucoup, on agit sur place (2026-08)

Suite directe du lot précédent, sur une direction visuelle validée : **un espace de conversation
riche**, pas un tableau de bord et pas un chatbot mieux habillé. Les objets métier arrivent dans le
fil, à leur taille, avec leurs gestes dessous.

**Ce qui n'a PAS été réécrit, et pourquoi.** `AssistantChat` porte la mémoire, les cartes d'action,
l'approbation d'envoi, la dictée, l'appel vocal, les pièces jointes et les sources. Le refaire à
neuf pour changer une apparence, c'était risquer la seule chose qui marche — l'exécution — au
bénéfice de la seule qui se corrige facilement : le style. Il reçoit **une** prop, `canvas`, par
défaut **fausse** : `/assistant` (la page de l'ERP) est intacte.

**Le tour, en mode canvas.** La bulle grise d'Adam disparaît : avatar, nom, heure, texte, puis les
blocs — la réponse EST la page. La question de l'utilisateur reste une pastille claire alignée à
droite : il faut pouvoir retrouver ce qu'on a demandé sans relire toute la réponse.

**Quatre objets de plus** dans `workspace/protocol.ts`, rendus par le registre exhaustif :
`dossier` (faits à gauche, circuit + pièces à droite ; **une** étape courante ; le blocage est la
seule surface colorée de la carte), `email` (le message tel qu'il partira — « Envoyer » écrit la
phrase d'approbation, la politique d'envoi est atteinte par le chemin normal, jamais contournée),
`progress` et `document`. Tableaux et fiches de personne portent des **gestes par ligne**.

**La planche de rendu** (`components/chief/workspace/preview-planche.tsx`) : les blocs n'existent
qu'au bout d'un vrai tour de conversation — donc d'un appel IA que l'E2E s'interdit. Elle est
branchée **dans** le bureau d'Adam (`/chief-of-staff?apercu=blocs`, derrière `ADAM_BLOCK_PREVIEW`),
pas sur une route à elle : une page séparée aurait dû refaire son propre contrôle de droits, donc
franchir la frontière une fois de plus. Adossée au bureau, elle hérite de ses gardes.
`personRegulatoryLoad` descend pour la même raison dans `regulatory-read.ts`. **425 imports,
inchangé — aucun plafond relevé.**

**Ce que la revue des captures a trouvé et que les tests laissaient passer** : la carte de dossier
laissait la moitié droite de 1 440 px vide ; un nom de fichier se cassait au milieu d'un mot ; deux
validations distinctes se lisaient comme une seule ; un « 2 » nu ne répétait que ce qu'on voyait ;
« Envoyer » était indiscernable de « Modifier » ; la frise coupait « Enregistrement » à
« Enregistr » sur 390 px **sans indice qu'il restait quelque chose** (elle bascule à la verticale
sur mobile) ; une adresse e-mail se brisait en « …@exemple. / test » — et une adresse rompue est
une adresse qu'on recopie faux.

### L'ESPACE D'ADAM MONTRE — tableaux, jauges, documents, et on tranche sur place (2026-08)

Six défauts relevés dans un transcript de production, tous du même genre : **Adam savait, mais ne
montrait pas** — ou pire, se déclarait incapable de ce qu'il savait faire.

| Ce qui se passait | La cause EXACTE | Ce qui se passe maintenant |
| --- | --- | --- |
| « tu peux envoyé un mail à Khaled ? » → « Je n'ai pas son adresse » | Le PDG a écrit le PARTICIPE. Normalisé, `envoyé` donne `envoye`, absent des deux listes d'impératifs (`ACTION` du routeur, `ACTION_VERB` du raccourci vocal) — parce qu'`envoyer` est le seul verbe de la famille dont le radical d'impératif (`envoi-`) diffère de celui d'infinitif (`envoy-`). La phrase a filé jusqu'au raccourci « état de la boîte », qui n'envoie **aucun** schéma d'outil : Adam ne pouvait rien faire d'autre que lire des messages reçus. | Le critère change : verbe d'envoi + nom de courrier + **destinataire** = une écriture, quelle que soit la graphie (`isOutboundMail`). Route `ACTION`. Et `directory_lookup` rejoint le domaine `MAIL` — on n'écrit à personne sans son adresse. |
| « combien de salariés Adventum ? » → « 18 », puis « oui, bonne pioche » | `read_hr_overview` n'avait **aucun** paramètre (`properties: {}`) et lisait tout le groupe. Le chiffre était juste ; son périmètre était tu. | L'outil accepte `entite`, mais surtout : il rend **toujours** `perimetre` + `parEntite`. Un agrégat ne peut plus sortir sans sa portée. Une entité inconnue rend le groupe entier **en le disant** — jamais un chiffre attribué à tort. |
| « Dans un tableau » → « je ne peux pas afficher de tableaux Markdown » ; « Montre le moi ici » (Excel) → « je ne peux pas afficher un fichier Excel » | La règle de style interdit — à raison — d'**écrire** du Markdown, mais ne disait pas que l'écran, lui, sait dessiner. Le modèle en a déduit une impossibilité là où il n'y avait qu'un partage des rôles. | La règle le dit, et le chemin existe : lectures tabulaires composables ; **`show_document`** (PDF et contrats en visionneuse, images, classeurs Excel/CSV lus en tableau) ; **`show_table`** (colonnes et tri à la demande). |
| « je les valide depuis ici » — demandé **trois fois** | `list_pending_decisions` ne rendait que des liens : « ouvre Validations et débrouille-toi ». | Chaque ligne décidable porte ses boutons. Le clic **n'exécute rien** : il écrit dans la conversation la phrase du serveur (avec la référence exacte), donc la mutation repasse par la proposition, la carte de confirmation, l'action canonique, le RBAC et l'audit. Une étape séquentielle dont ce n'est pas le tour n'a **pas** de bouton — un bouton qui refuse est pire que pas de bouton. |
| Ventilation complète du budget quand seul le restant était demandé | Rien ne bornait la réponse. | « Réponds à la question posée, et rien de plus » + des **jauges** : « il reste combien ? » se répond par une longueur, et la phrase peut alors tenir en un montant. |
| « T'es sûr ? » → répétition décorée d'assurance | Rien ne distinguait contestation et demande de répétition. | Une contestation fait **relire** la source au bon périmètre. Si le chiffre ne bouge pas, on dit ce qu'il **couvre** — c'est presque toujours là qu'est le malentendu. |

**Trois blocs d'affichage nouveaux** (`workspace/protocol.ts`) : `progress` (jauges, seuils 85 % /
100 %), `document` (PDF en cadre replié, image bornée, feuille rendue en tableau), et des **gestes**
sur les lignes de la file. Le registre de rendus reste **exhaustif par construction** : TypeScript
refuse de compiler si un type de bloc n'a pas son composant.

**Une porte d'extension, `_blocs`** — une lecture canonique peut déclarer ce qu'elle montre, parce
que l'inférence de forme ne marche pas pour « montre-moi ce contrat ». Elle est **revalidée champ
par champ** : type inconnu écarté, listes bornées, `href` restreint aux routes internes de l'ERP
(une URL absolue dans un cadre sous la réponse du PDG n'est jamais acceptée).

**La frontière n'a pas bougé.** `show_document` aurait franchi la frontière Adam ↔ ERP **sept
fois** (Prisma, stockage, droits Drive, droits d'entité…) et le cliquet l'a signalé. Plutôt que de
relever le plafond, la lecture est passée par le **contrat** (`document.show`) — première lecture
non-personne à l'emprunter, et la preuve que l'architecture tient. **425 imports, inchangé.**

### LA FRONTIÈRE ADAM ↔ ERP — séparer le code sans séparer le déploiement (2026-08)

Adam devient un produit qui **communique par contrats** avec l'ERP, tout en restant dans le même
processus. Ce choix vient d'une consigne explicite (« il reste toujours là, partie intégrante »)
et il est ce qui permet de tenir l'indépendance **sans payer la latence des microservices**.

**Mesuré d'abord.** 123 fichiers Adam, **425 imports** vers **172 modules ERP**. Par nature :
136 actions serveur, 84 sécurité/identité, 60 accès Prisma directs — et **9 seulement** côté UI,
déjà quasi découplée. C'est ce classement qui a dicté l'architecture, pas une intuition.

**`src/platform/` — la frontière, qui n'appartient à aucun des deux.** Quatre verbes :
`query` · `command` · `authorize` · `subscribe`. `contract.ts` **n'importe rien** (vérifié par
test) : le jour où Adam devient un service, ce fichier part avec lui sans modification. Un
`Principal` (capacités résolues par la plateforme) remplace `CurrentUser` — Adam lit ses droits,
il ne les calcule jamais.

**Un seul pont.** `in-process/adapter.ts` est le seul fichier autorisé à connaître l'ERP. Il
traduit, il ne décide de rien : `performAction` conserve l'arrêt d'urgence, les portes RBAC,
l'audit et l'idempotence. L'identité est **relue à la source**, jamais reconstruite depuis le
`Principal`.

**Le bus d'événements** (qui n'existait pas). L'ERP annonce des FAITS au passé —
`hr.employee-added`, `regulatory.owner-changed`, `mail.sent` — en une ligne. Règle absolue :
**publier ne peut rien casser** (abonnés isolés, `emit` ne lève jamais), et la charge utile est
minimale — un événement qui transporterait l'entité deviendrait la « seconde base ERP
concurrente » à proscrire.

**Ce qu'on n'a PAS construit, et pourquoi.** Les lectures canoniques coûtent **1,8 à 6,6 ms**
quand un tour d'Adam coûte de l'ordre de la seconde : un cache de l'annuaire ferait gagner moins
d'un demi pour cent, contre un risque de péremption sur des adresses et des salaires. La seule
projection retenue est celle que la mesure justifie — **« quoi de neuf »**, sans équivalent
rapide —, branchée sur l'outil `what_changed` existant plutôt que sur un 78ᵉ outil.

**Le cliquet.** `boundary.test.ts` fige la dette à 425 : elle ne peut que baisser, `src/platform/`
reste à zéro, et le plafond doit rester serré. C'est ce qui transforme « on devrait découpler
Adam » en un travail qui finira. `npm run adam:boundary` affiche l'état et par quoi commencer.

Détail, chiffres et dette restante : `docs/ADAM_PLATFORM_BOUNDARY.md`.

### ADAM — le routeur ACTIF (borné), et l'espace de travail génératif (2026-08)

Deux changements, et une frontière entre eux qui est le sujet principal.

**1. Le routeur passe en production, mais seulement où c'était autorisé.** Jusqu'ici il tournait
en mode ombre : il notait ce qu'il *aurait* fait sans jamais l'appliquer. Trois chemins désormais,
décidés dans `lib/assistant/context/rollout.ts` :

- `FAST_READ` — annuaire, Gmail, agenda, fiche canonique, file de décisions. **Le code choisit
  l'outil, l'exécute, et le modèle ne sert plus qu'à formuler** : un seul appel au lieu de deux,
  et ZÉRO schéma d'outil envoyé.
- `SHORTLIST` — le reste des lectures, en **canary 20 %** : liste d'outils réduite au domaine,
  avec seau déterministe (FNV-1a) pour que tout incident se rejoue à l'identique.
- `LEGACY` — **TOUTES les mutations** et le trafic hors canary. Chemin actuel, inchangé, avec
  RBAC, approbation, audit et idempotence.

Le doute ne va jamais vers un raccourci : confiance faible, domaine flou, outil hors liste blanche
ou garde déclenchée → repli sur le généraliste. Le cas qui résume la règle : **« Envoie-le »** est
classé rapide par le routeur mais EXPÉDIE UN MAIL — il est nommément renvoyé sur le chemin prouvé.

Une **garde automatique** (mauvais outil > 1 % ou outil manquant > 1 %, sur 50 tours minimum)
ramène tout sur l'ancien chemin sans intervention. Sa limite est écrite dans le fichier : la
fenêtre est en mémoire du processus, elle devra devenir partagée avant d'autoriser une mutation.

`list_more_tools` était **déclaré sans code derrière** — la liste courte aurait donc été une
amputation. `context/discovery.ts` l'exécute enfin : il rouvre un domaine en cours de boucle,
n'accorde aucun droit (chaque outil revérifie), ne révèle jamais un outil fermé, et compte chaque
appel comme « outil manquant ». L'échappatoire répare le tour, le compteur répare le routeur.

**Correction d'une mesure fausse** : le rapport publiait « 23 316 tokens de schémas, 60 % du
contexte fixe ». Ce chiffre ne pesait que les 77 outils de POUVOIR ; la boucle en envoie **159**.
La vraie mesure est **93 025 tokens, soit 85,7 %** du contexte fixe.

**2. L'espace de travail génératif.** La conversation ne rend plus la donnée en texte seul : le
serveur traduit la sortie d'une source canonique en **blocs typés** (`lib/assistant/workspace/`),
et le client (`components/chief/workspace/`) ne sait rendre que ces blocs-là — fiche de contact,
annuaire, messages, agenda, file de décisions, fiche, tableau, chronologie.

**Le modèle n'écrit aucun balisage.** C'est la réponse directe à l'incident où « Bonsoir, ça va ? »
avait produit vingt-sept résultats bruts à l'écran, dont six lignes de salaire : une forme non
reconnue **ne compose rien**, et la réponse reste du texte. Sur téléphone, l'annuaire n'est pas un
tableau rétréci mais une liste de fiches — un tableau à trois colonnes sur 390 px écrivait
l'adresse une lettre par ligne.

Jeu réservé **inchangé** : 85,0 % de route, 95,0 % de domaine, 0 confusion lire/agir, les six
mêmes échecs. Détail complet et chiffres : `docs/ADAM_VOICE_CONTEXT_REPORT.md` (addendum).

### ADAM — les canaux Google du Chief of Staff, et la frontière d'envoi (2026-08)

Le Chief of Staff gagne des **sens** : Gmail, Agenda, Drive, Docs/Sheets/Slides et Contacts,
branchés sur le MÊME cerveau — pas de second assistant, pas de conversation parallèle.

Ce qui change pour le PDG : Adam relève la boîte tout seul (veille Gmail + Pub/Sub, avec
réconciliation périodique en filet), comprend les fils et les pièces jointes, relie ce qu'il lit
à l'ERP, tient des **missions** qui survivent à la conversation (qui a répondu, qui manque, ce
qu'on attend), et prépare les réponses. Il **n'envoie rien** sans accord : `REQUIRE_APPROVAL`
par défaut, réglable en langage naturel ou depuis `/chief-of-staff/reglages`.

Un défaut trouvé et corrigé au passage : une intention préparée pendant une période d'**envoi
autonome** était marquée « approuvée » par la politique elle-même, sans personne derrière. Après
retour à l'approbation obligatoire, elle serait **partie quand même** — le PDG aurait vu
s'envoyer des messages qu'il n'a jamais lus, exactement ce que la bascule devait empêcher. On
exige désormais aussi une approbation HUMAINE (`approvedById`). Le test correspondant échoue si
l'on retire la condition : la garantie est vérifiée, pas seulement écrite.

13 tests d'intégration tiennent la frontière, avec un transport-espion qui compte les envois
RÉELS — préparer n'envoie rien, une modification invalide l'accord, deux approbations et deux
envois concurrents ne produisent qu'un message, une mission de fond reste bloquée, le
coupe-circuit prime sur l'envoi autonome.

Parité ERP après le lot : **natives=534, couvertes=34, trous=0, exclues=70 — 100 %** sur 638
actions classées.

### Compréhension du français par Adam — 77 % → 100 % de rappel, zéro faux positif destructeur (2026-08)

La résolution « phrase du PDG → bouton de l'ERP » plafonnait à 81 %, avec des erreurs de
destination et un corpus adverse trop maigre pour être une preuve. La reprise est ARCHITECTURALE,
pas une liste de cas : deux modules purs, `src/lib/assistant/nl/lexicon.ts` (le français) et
`src/lib/assistant/nl/resolver.ts` (le score), que le registre des 529 actions se contente
d'alimenter.

**Ce que le français dit lui-même, et qu'on n'écoutait pas.** Quatre règles, générales, ont
rapporté l'essentiel du rappel :

- un mot précédé d'un **déterminant** est un nom — « assigne cette **demande** » n'est pas un
  ordre de demander ; sauf infinitif (« de **relancer** »), qui reste un verbe ;
- un radical verbal suivi d'une **terminaison non verbale** est un nom — « établi**ssement** »,
  « class**ement** », « géné**ral** », « vidé**o** » ne sont pas des gestes. Sans cette règle,
  « ajoute un établissement de santé » ne contenait **aucun objet** ;
- le **premier** verbe porte l'ordre, les suivants qualifient — « restaure ce fichier
  **supprimé** » ne commande aucune suppression ;
- un ordre commence par son **verbe** ; un constat commence par son **sujet** — « la facture de
  Kwality est arrivée ce matin » n'est pas une demande de créer une facture.

**Ce que le score comptait mal.** Le cosinus a remplacé la couverture (il ne punit plus l'alias
verbeux face à la phrase laconique) ; les synonymes comptent pour **un concept** et non pour
autant de mots (« fichier » ouvre « document » sans diluer « corbeille ») ; le pluriel ne change
plus le radical (« gamme**s** » était raboté en « gamm », « gamme » restait « gamme » — les deux
côtés de la même comparaison s'écrivaient différemment) ; une **quantité** ne désigne rien
(« deux » n'apparaît qu'une fois dans tout le registre : sa rareté étouffait
« définitivement » et faisait échouer la suppression demandée).

**Ce qui garde la sûreté, et qui prime sur le rappel.** Un geste irréversible n'est proposé que
si le PDG a **dit le verbe, en tête de phrase** ; il n'est jamais proposé en second derrière une
lecture non destructrice ; un **mot interrogatif** ferme la porte quel que soit le verbe
(« qui a supprimé ce fichier ? » ne fait plus remonter deux boutons de suppression) ; et le repli
approché, qui rattrape les fautes de frappe, **s'interdit tout geste destructeur** — deviner et
détruire ne vont pas ensemble.

**Mesuré** (`src/lib/assistant/adam-golden-benchmark.test.ts`, 110 formulations réelles du PDG,
44 phrases adverses, 26 pièges destructeurs) :

| | avant | après |
|---|---|---|
| rappel sur les 110 formulations réelles | 77 % | **100 %** |
| bonne destination (95 phrases dont le bouton existe) | — | **100 %** |
| faux positifs sur 44 phrases sans demande | 12 | **0** |
| faux positifs DESTRUCTEURS sur 26 pièges | 8 | **0** |
| latence p50 / p95 | — | **0,34 ms / 0,52 ms** |
| chemin déterministe | — | **180/180** (repli approché : 0) |

Les **15 formulations restantes** ne sont pas cachées : elles sont dans le corpus, marquées
`attendu: null`, avec la raison — l'ERP n'a pas de bouton « export Excel du tableau Regulatory »,
et « ajoute une ligne de paie » est réellement ambigu (six objets s'appellent « ligne »). Aucune
phrase n'a été retirée du banc pour améliorer le score.

### Mémoire du build — le pic ne dépend plus de la machine de build (2026-08)

Render tuait le build (« Ran out of memory, used over 8GB ») alors que la machine de
développement ne dépassait jamais 4,6 Go. Mesure avant de toucher au code (RSS de tout l'arbre
node, build propre) : compilation webpack 4612 Mo, typecheck 2692 Mo, génération statique
3924 Mo. Le commit **pré-ADAM** mesurait déjà 4219 Mo : ADAM n'a pas créé l'explosion, le build
vivait au bord du plafond.

Deux causes réelles. **Le parallélisme se dimensionnait sur le matériel** : Next taille ses
workers sur le nombre de cœurs du builder, donc un builder plus gros que la machine de dev
faisait exploser le total — d'où un incident irreproductible en local. Borné par
`experimental.cpus`. **La minification des bundles serveur** coûtait ~1 Go de pic pour un gain
nul côté navigateur (ces bundles ne sont jamais téléchargés) : coupée par
`experimental.serverMinification`, la minification CLIENT restant intacte.

Résultat : **4612 → 3514 Mo**, et surtout un pic désormais INDÉPENDANT du builder.
`npm run build:measure` garde la porte.

### Mémoire du build, second round — le plafond de tas était posé PAR PROCESSUS (2026-08)

L'OOM Render est revenu (« used over 8GB »). Ce qui a été mesuré, dans l'ordre, avant de
toucher à quoi que ce soit :

| Commit | Phase du pic | Pic (arbre node) |
| --- | --- | --- |
| `ef09bdc` (avant le lot du jour) | compilation | **6269 Mo** |
| `591a0e8` (HEAD) | compilation | **5272 Mo** — dont **un seul worker à 5114** |

**Le lot du jour n'y était pour rien** — il fait même baisser le chiffre, ayant supprimé trois
écrans. La référence de 3514 Mo était simplement PÉRIMÉE : le graphe a grossi lot après lot, et
personne ne l'a vu parce que **la garde ne mesurait pas la configuration qui part en
production**. `build:measure` lançait un `next build` nu ; Render lance `build:render`, avec un
plafond de tas explicite. Deux configurations, deux chiffres — et une garde qui annonçait
« sous le plafond » pendant que le déploiement mourait.

La cause : `--max-old-space-size` est un plafond **par processus**, et il y en a plusieurs.
Posé à 4096 « pour le build », il autorisait en réalité le worker de compilation à monter seul
à 5,1 Go — V8 ne ramasse sérieusement qu'en approchant sa limite. Un seul chiffre changé, tout
le reste identique :

| Tas par processus | Pic | Issue |
| --- | --- | --- |
| 4096 Mo | 5272 Mo | build OK, mais Render tombe |
| **3072 Mo** | **3743 Mo** | **build OK** ← retenu |
| 2048 Mo | — | le worker de compilation MEURT (SIGABRT, heap out of memory) |

**−1529 Mo, sans rien désactiver** : ni lint, ni typecheck, ni minification client, ni aucune
fonctionnalité. Le pic passe de la compilation à la génération statique, où la décomposition
montre que `experimental.cpus: 2` tient bien : parent 1734 Mo + 2 workers à ~940 Mo.

Trois choses ont changé, et la troisième compte autant que la première :
- `build:render` plafonne le tas à **3072 Mo** (`package.json`) ;
- `scripts/build-memory.sh` **exporte le même plafond** — la garde mesure désormais ce que
  Render exécute, sinon elle mesure autre chose et ne garde rien ;
- le plafond de la garde descend de 5000 à **4200 Mo**, redevenant un cliquet serré au lieu
  d'un chiffre que plus personne n'atteignait.

Le 2048 qui casse n'est pas un détail : il dit que la compilation a réellement besoin de plus
de 2 Go, donc que le prochain gros lot fera ÉCHOUER le build au lieu de le laisser dériver.
C'est le comportement voulu — un échec bruyant en local vaut mieux qu'un OOM silencieux chez
l'hébergeur ; le message d'erreur du script dit quoi remonter, et où.

**Piste racine repérée, non traitée ici** : `src/components/ui/icon.tsx` importe l'objet
`icons` de `lucide-react`, qui référence toute la bibliothèque — `lucide-react/dist/esm/icons/`
compte 3464 fichiers, et cet import-là ne peut être ni élagué ni traité par
`experimental.optimizePackageImports` (qui optimise les imports NOMMÉS). Ils entrent donc tous
dans le graphe, côté client ET serveur. Le remède demande une table explicite plus un test qui
empêche la dérive — une icône absente de la table disparaît EN SILENCE (`Icon` rend `null`) —
et 19 fichiers appellent ce composant, dont certains avec un nom calculé à l'exécution.

### Parité quasi totale UI ↔ Chief — 485 ops de domaine sur 30 outils, 98,6 % (2026-08)

Huit vagues industrielles (5a → 7d) ferment la quasi-totalité de l'inventaire des server actions :
le Chief of Staff propose désormais **le même geste que l'écran** sur pratiquement tout l'ERP.

- **485 ops de domaine sur 30 outils** (`src/lib/assistant/ops/`) — les plus fournis : Finances (55),
  RH (39), Administration/`org_operation` (38), Ad&Pro (36), BD (28), Annuaire/promo (25), Médical (22),
  Drive (21), Espace de travail (19), Demandes (18), **Messagerie (18, nouvel outil `messaging_operation`)**,
  Regulatory (16), Planning SFE (16), Réunions (16), Courriers (16), PCH (14), Care (12), Legal (11)…
  Toujours le même contrat : catalogue pur (alias FR, risque, porte RBAC, `covers`) + implémentation
  (résolution nom→id, ambiguïtés LISTÉES, rejeu de l'ACTION CANONIQUE — FormData au champ près).
- **Vagues 5a→6c** : care/congrès nationaux (12), matériel promo (25), BD complet (create/update/delete
  projets CRITIQUES en cascade comptée, gammes, produits FUSION 19 champs, `set_bd_cell` sur liste blanche),
  projets/dossiers (statut, assignation, messages avec mentions, liaison courrier), directives, support,
  rappels d'écran, règles & demandes de VALIDATION (résolution du validateur dont c'est le tour),
  rapports terrain, uniformisation du catalogue d'articles (préversion PURE inlinée dans la proposition),
  planning SFE intégral (cycles « 2033-09 » lus sur le brut, upserts en FUSION, retrait de visites
  sans note signalé).
- **Vague 7/7b/7c** : demandes administratives (édition/retrait/restauration/suppression avec motif
  obligatoire, validation finances/interne, imputation moyens généraux, achats « article xN »),
  missions chauffeur, réunions avancées (FUSION avec horaire d'Alger rejoué UTC+1, appels sur
  conversation résolue par nom, propositions de tâches du compte rendu tranchées par intitulé),
  invitations d'agenda, commentaires transverses par extrait, **messagerie complète** (groupes,
  canaux, édition de SES messages par extrait, modération, réactions, épingles, signets, sourdine,
  niveaux de notification, fiche en FUSION, membres et rôles OWNER-only, archivage, statut de
  présence façon Teams) + relance Regulatory (porte Super Admin / DG).
- **Vague 7d — l'administration profonde** : entités (fiche FUSION + portée du sélecteur), annuaire
  d'entreprise, départements (FUSION anti-cycle, suppression au remontage), organigramme (N+1),
  accès aux entités (auto-modification interdite), comptes portail fournisseur, feedback (dépôt +
  traitement), rattachement des orphelins, **accès pipeline et lignes accordées en FUSION de listes**,
  Centre de contrôle IA (couper l'interrupteur général prévient qu'il éteint AUSSI l'assistant),
  nouveautés TEST→PROD, seuils du Risk Radar bornés, **purge de stockage et suppressions DÉFINITIVES
  Drive/document (CRITIQUES, ressaisie du nom)**, carte d'identité légale par libellé, champs
  personnalisés par libellé (FILE renvoyé à l'écran), suppression de SON courrier/document légal.
- **EXCLUDED motivés, jamais silencieux** : lectures/analyses IA du cockpit (le Chief EST cette
  capacité), géométrie de la carte d'organigramme, `createSupplierUser` (un mot de passe ne transite
  JAMAIS par une conversation — même règle que les comptes internes à invitation), sélecteurs de
  formulaires, plomberie d'écrans.
- **Sémantique FUSION généralisée** : toute action d'écran qui REMPLACE une fiche est rejouée champ
  par champ depuis l'existant — renommer un groupe ne perd pas son sujet, changer un seuil du Risk
  Radar réécrit la grille entière à l'identique, retirer une ligne accordée rejoue les autres.
- **Goldens par vague** (`ops-goldens-wave*.test.ts`) : chaque vague est verrouillée par des tests
  d'or sur ses mécanismes délicats (FUSION, portes, ambiguïtés, bornes, confirmations CRITIQUES).

Parité UI↔Chief : **22,8 % → 98,6 %** (natives 525, couvertes 33, **trous 8** — tous des gestes à
FICHIER (upload/import) qui attendent la phase « fichiers first-class » —, exclues 66 sur 632
classées) — cliquet CI abaissé à chaque vague (`action-parity.test.ts` : trous ≤ 8,
natif+couvert ≥ 558). Suite : **3 004 tests verts**.

