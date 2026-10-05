### UNE MISSION LÉGITIME MOURAIT DE L'ORDRE DES OBJECTIONS DU COMPILATEUR (2026-09)

**Le problème, mesuré en live.** « Demande à Regulatory les pièces manquantes de Nivolex et
Trastuzex, attends leur retour, relance ce qui manque, puis demande à Khaled le prix de cession,
puis à Sofiane les marchés publics, consolide, fais-moi un Excel et un PowerPoint. » Résultat :
`✗ non lancée : le plan proposé reste refusé après correction`. Trois causes empilées :

1. **Le compilateur distillait ses reproches.** La couverture des primitives (§56) était gardée
   par `issues.length === 0`. Plan 1 refusé sur la forme d'une attente → le planificateur corrige
   exactement cela → plan 2 découvre un `MISSING_PRIMITIVE` dont le premier refus n'avait pas dit
   un mot. La garde est déplacée là où elle sert vraiment : seules les capacités que le catalogue
   **connaît** comptent comme couverture, sinon une capacité inventée apporterait sa primitive
   dérivée de son nom et masquerait le manque réel.
2. **Le budget de correction était un chiffre, pas un critère.** Il y avait exactement DEUX
   essais. Le modèle progressait à chaque tour ; c'est le compteur qui a rendu l'arrêt. Désormais :
   tant que le refus CHANGE, on continue ; dès qu'il REVIENT identique (signature `code@étape`),
   on s'arrête — le planificateur est bloqué, un tour de plus ne produirait que la même réponse,
   plus chère. Plafond opérationnel à 3 corrections, et chaque tour repasse par le MÊME
   compilateur : la persévérance n'autorise aucun relâchement de règle.
3. **Le moyen de satisfaire l'exigence n'était écrit nulle part.** Le contexte disait bien
   « cette demande EXIGE DOCUMENT ». Mais `ARTIFACT` — la seule forme d'étape qui produit un
   fichier — n'était décrit ni dans les règles du prompt ni dans le schéma (`typeConst` ne portait
   pas de `description`). Le modèle savait QUOI on lui demandait, personne ne lui avait dit AVEC
   QUOI le faire. Règle 17 ajoutée, et la variante `ARTIFACT` porte enfin sa description.

**Et une quatrième, côté produit, trouvée au tour précédent.** Deux attentes ne se distinguant
que par leur clé sont, pour le routeur d'événements, la même attente écrite deux fois : le
message « Nivolex : il manque le CPP légalisé. (Trastuzex non traité.) » levait AUSSI l'attente
Trastuzex. Le compilateur refuse maintenant, à la compilation, deux attentes humaines qui ne
disent que DE QUI sans dire QUOI (`waitSubject`, `waitEntity`, `waitThreadId`, `waitAttachment`).

**Résultat mesuré** : la mission se lance (29 étapes), les quatre personnes sont sollicitées
nominativement, et le plan discrimine ses attentes par sujet (`allOf` : Amel/Nivolex,
Raihana/Trastuzex) — exactement ce que la nouvelle règle exige.

### L'EMPREINTE D'UNE MUTATION NE DÉPASSE JAMAIS CELLE DE LA DEMANDE (2026-09)

**Le problème, mesuré dans le vrai chat.** « Retire l'adresse e-mail d'Allaeddine » a produit
« Je propose : SUPPRIMER DÉFINITIVEMENT l'employé Allaeddine ». Un champ demandé, une personne
proposée — avec ses pièces, ses commentaires, sa cascade non restaurable. Rien ne part sans clic,
mais la carte annonçait une suppression sous une demande qui disait « retirer une adresse ».
`cible-designee.ts` ne voit pas cette faute : la cible était la BONNE, c'est la PORTÉE qui était
fausse.

**La même faute a la même forme partout** — « corrige son numéro dans l'annuaire » → désactiver
son COMPTE ; « change la cellule B12 » → supprimer la LIGNE ; « supprime le dossier X » → un LOT.

**La règle.** `src/lib/mutations/empreinte.ts` (module PUR, zéro import, au socle) compare deux
axes indépendants : la **profondeur** (CHAMP < ENREGISTREMENT) et la **cardinalité** (UN /
PLUSIEURS). Une opération dont l'un des deux dépasse ce que la demande énonce est refusée, avec
l'opération plus étroite nommée. Les confondre rendrait la règle fausse : « supprime ces trois
dossiers » et « supprime le dossier REG-2026-014 » ont la même profondeur et des cardinalités
opposées (même distinction qu'au compilateur de missions, §118.3).

La tête du groupe nominal décide, et elle est la PREMIÈRE : « l'adresse e-mail d'Allaeddine »
contient le mot « mail », qui nomme aussi un enregistrement (un message). Compter les mots
reconnus rendait ENREGISTREMENT ; comparer leurs POSITIONS rend CHAMP.

**Trois surfaces, une règle** : les propositions d'écriture de la conversation
(`lib/assistant.ts`, les deux boucles), la compilation d'un plan de mission
(`missions/compiler/compile.ts`, contre l'objectif que le plan énonce lui-même) et les commandes
Live Office (`artifact_edit` : une commande `*.supprimer_*` détruit un contenant).

**Le silence n'interdit rien.** `empreinteDemandee` rend `null` sur tout ce qu'elle ne lit pas à
coup sûr, et un `null` LAISSE PASSER — mesuré sur 1 985 phrases françaises du dépôt : 81 % muet.
Une garde qui refuserait « supprime Allaeddine » faute d'avoir su lire serait désactivée en une
semaine, et la protection mourrait avec elle. Les créations ne sont jamais pesées : « crée une
tâche pour corriger l'adresse d'Allaeddine » nomme un champ et propose une création — c'est
légitime, et la refuser mesurerait la ressemblance des mots au lieu de l'effet.

Test : `src/lib/mutations/empreinte.test.ts` (les trois pannes réelles + ce que la règle laisse
passer, qui compte autant).

### NOT_FOUND N'EST PAS VERIFIED_ABSENT (2026-09)

**Le problème.** Une question sur ce qui existe autour d'une personne, UNE recherche, zéro
résultat, et « je n'ai rien trouvé » remis comme une réponse. La donnée était là, sous un autre
libellé.

**Le piège était dans le code de la garde.** `limites.ts` comptait « aucune donnée » parmi les
refus HONNÊTES : `gardeImpossibilite` rendait RAS et `classerLimite` rendait `DONNEE` avec
`precise: true`. Le code CERTIFIAIT qu'une absence est une limite bien dite, sans jamais regarder
ce qui avait été cherché.

**La règle.** `gardeAbsence` : si la réponse affirme n'avoir pas TROUVÉ alors que le tour n'a
essayé qu'une ou deux façons de chercher, le serveur rend l'échelle d'élargissement (exact →
approché → alias → par la personne → par l'histoire → entités liées → autres greniers) et exige
un second essai. Une fois. Deux garde-fous : une CONCLUSION (« aucun dossier n'est en retard »)
n'est pas une absence de résultat, et une phrase qui porte sur une source déjà lue (« aucune
réserve dans ce document ») non plus. Mesure sur 29 476 phrases du dépôt : 0,8 % déclenchent.

### LA COMPOSITION : trois ruptures dans la chaîne, aucune dans le modèle (2026-09)

**Le problème.** La famille COMPOSITION faisait 1 réussite sur 13. Un plan de composition
enchaîne des étapes : la seconde lit la sortie de la première. Trois choses cassaient cette
chaîne, et aucune n'était un défaut de raisonnement du modèle.

**1 — Le planificateur ne savait pas ce que les capacités RENDENT.** La seule source était une
table écrite à la main : SIX capacités sur deux cent vingt-neuf. Pour les autres, il devinait un
nom de champ ; la devinette tombait à l'EXÉCUTION, après l'accord du dirigeant, en tuant la
mission (`INVALID_STEP`, non rejouable). La forme s'apprend désormais de ce que chaque capacité
a RÉELLEMENT rendu — `MissionStep.result` porte déjà la matière, c'est la table où le registre
lit la fiabilité (§17 : pas de seconde table, pas d'entretien, et un outil qui change de sortie
réapprend seul). Une forme ne contient JAMAIS de valeur métier, seulement des noms de champs et
des types : elle part dans le prompt, et un montant ou un nom de salarié qui s'y glisserait
ferait fuiter par la description ce que les droits protègent. Vérifié sur données piégées, puis
sur les sorties réelles de la base. **6 → 56 capacités montrées avec leur sortie, sur 226.**

**2 — Le compilateur ne vérifiait que la CLÉ, jamais le CHAMP.** Il le pouvait pourtant pour la
moitié des cas, sans rien apprendre : un WORKER rend EXACTEMENT les champs de son schéma (bâti
avec `additionalProperties: false` et imposé au fournisseur en mode strict — sans `outputFields`
c'est le schéma minimal, trois champs), une JONCTION rend `{ joined }`. La forme d'un worker est
donc une CONSTANTE de compilation, et c'est le cas le plus fréquent : l'étape CALCUL d'une
composition est presque toujours un worker. `compiler/sorties.ts` refuse maintenant la référence
morte AVANT l'exécution, en nommant les champs disponibles — et le refus repart au planificateur
comme une correction, pas comme une mort. **La règle qui gouverne tout le module : on ne refuse
QUE ce qu'on sait faux.** Une ignorance ne refuse rien ; un refus à tort frapperait d'abord les
capacités neuves, c'est-à-dire tout skill fraîchement branché.

Au passage, une JONCTION ne coupe plus les données : elle sert à réduire les ARÊTES du graphe,
pas le flux. Le plan naturel « 3 lectures → JONCTION → calcul » faisait arriver `{ joined: 3 }`
au lieu des trois lectures, et l'artefact aval finissait sur « un classeur sans aucune feuille
exploitable ».

**3 — La boucle « ça n'a pas marché → nouveau plan » n'était jamais atteinte.** La requête du
battement exigeait une étape PENDING ou FAILED. Le cas CENTRAL de la famille n'en a aucune :
toutes les étapes abouties, le contrôle qualité vert, et le juge qui refuse parce que le plan a
oublié une primitive. `replanifierMission` prévoit explicitement ce cas — personne ne l'appelait.
PARTIAL, l'état d'une composition à moitié faite, était déclaré replanifiable et ne l'était que
par la voie manuelle. Et onze motifs d'échec sur dix-sept sortaient de la taxinomie de recours,
dont `INVALID_STEP` et `ARTIFACT_QA_FAILED` : pour eux, la persévérance (§9) était inopérante,
pas même une ligne au journal. L'échelle, enfin, bouclait sur un barreau qu'elle n'inscrivait
pas, rendant les suivants inatteignables.

**4 — Rien ne vérifiait que le plan répond à la demande.** Les deux seuls contrôles de couverture
étaient « au moins une étape » et « au moins un critère ». Un plan « lire → répondre » compilait
donc pour une demande qui réclamait un chiffre ou une pièce. Le code lit maintenant la demande
(`planner/primitives.ts`, du français d'entreprise ordinaire), GARANTIT qu'une capacité de la
primitive exigée est montrée — elles retombaient toutes sur le domaine « autre » et le tourniquet
les écartait — et REFUSE un plan qui n'en porte aucune. Quatre conditions avant de refuser, dont
deux venues d'échecs immédiats : un nœud ARTIFACT couvre DOCUMENT (c'est lui qui fabrique le
fichier), et sous plafond de lecture on n'exige ni pièce ni action, sans quoi le refus boucle.

**Ce qui n'a PAS été fait.** Aucune règle par famille d'évaluation, aucun alias construit sur une
phrase de banc, aucun contournement de juge. Le détecteur de primitives est jugé sur un jeu TENU
À L'ÉCART — vingt-cinq demandes écrites après le dictionnaire, dans d'autres tournures et
d'autres métiers, dont six négatifs de lecture pure, parce qu'une exigence inventée enferme une
mission correcte aussi sûrement qu'une exigence manquée laisse passer un plan qui ne répond pas.
Un cas qui a servi à corriger le vocabulaire a QUITTÉ ce jeu : on n'ajuste pas sur ce qui juge.

**Ce que les tests tiennent.** Contrefactuels systématiques : référence morte désactivée → 4
tests tombent ; requête du battement remise en l'état → 2 ; taxinomie remise en l'état → 3 ;
contrôle de couverture désactivé → 2 ; plancher de visibilité désactivé → 2. Deux tests qui
VERROUILLAIENT un défaut ont été corrigés, pas contournés : l'un affirmait qu'une référence morte
devait compiler, l'autre qu'une mission BLOCKED dont tout a abouti devait rester invisible au
battement — ce qui l'enfermait.

**Cibles d'évals : +9.** `reference_morte_avant_execution`, `reference_licite_jamais_refusee`,
`capacite_forme_connue`, `forme_sortie_apprise`, `motif_echec_avec_recours`,
`mission_replanifiable_atteinte`, `primitive_exigee_deduite`, `plan_couvre_objectif`.

### AVANT / APRÈS SUR LES QUATRE FAMILLES MORTES : 2 réussites deviennent 21 (2026-09)

Le mandat demande un avant/après, pas une intuition. Les corrections de rappel du résolveur ont
donc été rejouées sur EXACTEMENT les mêmes missions : même graine, même corpus, filtré sur les
quatre familles qui faisaient près de zéro.

| Famille | avant | après |
|---|---|---|
| STATISTIQUES | **0** / 17 | **6** / 12 |
| LEGAL | **0** / 14 | **7** / 14 |
| REPRESENTATION | 2 / 17 | **7** / 17 |
| COMPOSITION | **0** / 16 | **1** / 13 |
| **total** | **2 réussites** | **21 réussites** |

Sur le dénominateur du banc — les missions exploitables — cela fait 37,5 % contre 3 % avant.
Trois autres chiffres comptent autant : **zéro faux succès**, **100 % des manques classés**, et
**zéro violation de droit** (contre sept) — la correction du contrôle des permissions se vérifie
donc sur une course réelle, et pas seulement en raisonnement.

**Ce que cela ne dit PAS.** 37,5 % reste très loin des 95 % visés, et le banc se déclare encore
NON CONCLUANT (huit missions sur soixante-quatre emportées par le fournisseur, soit 12,5 %,
au-delà du dixième toléré). PLANIFICATEUR reste la première cause avec vingt-huit échecs : montrer
le moteur au planificateur était NÉCESSAIRE, ce n'est pas SUFFISANT. COMPOSITION, à 1 sur 13,
n'a presque pas bougé — c'est la famille qui demande d'enchaîner plusieurs primitives, et le
défaut y est ailleurs que dans la visibilité des capacités. C'est le prochain fil à tirer, et il
est nommé plutôt que masqué par une moyenne qui a monté.

### LE BANC DES DÉFIS PASSE DE 43/48 À 46/48 — et les deux restants ne sont pas ce qu'ils disent (2026-09)

Quarante-huit défis live, jugés par du code sur des effets vérifiés en base, contre le vrai
fournisseur. **46/48 (96 %)**, contre 43/48 avant les corrections. Premier mot P50 8,68 s,
P95 24,15 s ; 4,38 $ pour le banc entier ; 61 % de cache.

Les CINQ échecs d'avant sont tous fermés, et par des causes différentes :

| Défi | Ce qui le débloque |
|---|---|
| `defi-ordonnancement-critique` | la doctrine dans le prompt TEXTE — Adam appelle enfin `calcul_ordonnancement`, rend 19 jours, l'échéance qui ne tient pas, les 4 jours de retard et la cause (Sarah porte trois tâches) |
| `defi-sql-refus` | le tri des écartées — `sql_query` remonte en tête, et le refus se dit comme un DROIT |
| `defi-manque-nomme` | le juge réécrit : le connecteur DocuSign existe, Adam avait raison |
| `defi-reseau-chemin` | le sommaire porte sa limite : compter n'est pas chercher un chemin |
| `defi-evenement-attente` | le banc bat l'ordonnanceur tant que la mission n'est pas garée |

Les deux qui restent ont été **vérifiés un par un**, parce qu'un banc live est stochastique et
qu'un échec isolé ne prouve rien :

- **`defi-conversion-perte` était un défaut du JUGE.** Adam a écrit « conservez impérativement le
  .xlsx » et « le classeur d'ORIGINE » — exactement la consigne attendue. Le juge n'acceptait que
  l'infinitif « conserver » et l'adjectif « original » : il notait une conjugaison, pas la sûreté.
  Radicaux désormais.
- **`defi-representation-dashboard` est une INSTABILITÉ RÉELLE, et le rejeu l'a prouvé.** Adam
  rassemble bien les chiffres avec `sql_query`, puis écrit le tableau de bord en TEXTE au lieu
  d'appeler `render_view`. Rejoué trois fois : deux réussites, un échec — soit **2 sur 4** en
  comptant la passe du banc. Ce n'est donc pas du bruit, et il aurait été confortable de le
  classer ainsi après un seul rejeu réussi. Le mode d'échec est identique à chaque fois : les
  lignes viennent d'un SQL ad hoc, et rien dans ce chemin ne rappelle que l'écran sait les
  afficher. La sortie de `sql_query` porte désormais ce rappel — même remède que le sommaire de
  réseau : c'est le RÉSULTAT qui dit ce qu'on peut en faire, pas une consigne de plus dans le
  prompt. **Mesuré après correctif : 4 passes sur 4** (contre 2 sur 4 avant). Quatre tirages
  restent quatre tirages — mais le mode d'échec, lui, ne s'est plus présenté.

### 200 MISSIONS, 86 ÉCHECS DE « PLANIFICATEUR » — et c'en était UN (2026-09)

Le banc d'autonomie a tourné sur deux cents missions inédites, par le VRAI `lancerMission`. Il se
déclare lui-même **NON CONCLUANT** : trente-quatre missions ont été mangées par une panne du
fournisseur (502 en rafale), soit 17 % — au-delà du dixième toléré, le score ne vaut pas. Les
cent soixante-six restantes, elles, disent quelque chose de précis.

    réussite (réalisables)  36,3 %   ·  faux succès 0  ·  manques classés 100 %
    PLANIFICATEUR 86 · MODELE 14 · PERMISSION 6 · DONNEE 1

Quatre-vingt-six échecs sur cent sept portaient la même étiquette. On peut lire cela comme
quatre-vingt-six erreurs de raisonnement d'un modèle. C'était **une** cause, structurelle, et
elle se voyait à la forme des familles : STATISTIQUES 0/17, LEGAL 0/14, COMPOSITION 0/16,
REPRESENTATION 2/17. Des zéros pareils ne sont pas du hasard de modèle.

Le message dominant était « le plan ne prévoit pas : CALCUL (primitives : INFORMATION) ». Le
planificateur ne refusait pas de calculer : **on ne lui montrait pas de quoi calculer.** Il
reçoit une liste RÉSOLUE (une vingtaine de capacités sur deux cent vingt-neuf — c'est le §3, et
c'est ce qui rend la mesure possible), et `calcul_statistiques` n'y entrait jamais. Trois causes
s'additionnaient, aucune n'était le modèle :

1. **Le résumé était coupé à 220 caractères.** C'est sur lui que le résolveur marque. Les 220
   premiers caractères de `calcul_statistiques` parlent des SOURCES de données ; les mots qui
   répondent à une vraie question — significativité, corrélations, régression, anomalies, série,
   prévision — arrivent après la coupe. On garde la coupe et on rattache désormais une QUEUE DE
   MOTS : les termes distinctifs de la partie coupée, dédupliqués, bornés à douze. Rien n'est
   écrit à la main, donc rien ne peut se périmer.
2. **Le rattrapage par préfixe ne s'appliquait pas au résumé** — seulement au nom et au domaine,
   et seulement quand le score valait ZÉRO. Or le vocabulaire métier d'une capacité vit dans son
   résumé, et « significati(f) » ne rencontrera jamais « significativité » par égalité stricte.
   Le préfixe compte maintenant partout, avec un poids MOINDRE qu'une correspondance exacte : un
   radical partagé est un indice, pas une preuve.
3. **Personne ne demande « une significativité ».** On demande si l'écart est « significatif ou
   du bruit », si les mois sont « anormaux », s'il y a un « lien » entre deux choses, on dit
   « rédige une note » et « fais-moi un tableau de bord ». Aucun de ces mots n'existait dans un
   résumé. Le dictionnaire de SYNONYMES — prévu exactement pour ça, et qui traduit du français
   vers du français, jamais vers un nom de capacité — les porte maintenant. Chaque mot de droite
   a été vérifié présent dans au moins un résumé du catalogue réel : une traduction vers un mot
   que personne n'emploie ne ferait rien marquer et donnerait l'illusion d'avoir corrigé.

Effet mesuré sur les objectifs exacts du banc : `calcul_statistiques` remonte désormais sur les
TROIS questions statistiques (zéro avant), les primitives CALCUL montrées passent de 2 à 5, de 2
à 4 et de 1 à 2, et les capacités jugées pertinentes de 16 à 31. Le test qui tient la propriété
a d'abord été écrit FAUX — il passait même en retirant les deux corrections, parce qu'avec un
catalogue où tout marque zéro le départage alphabétique sacrait la bonne réponse. Il porte
maintenant un leurre alphabétiquement premier et exige un score strictement positif.

**Et les « sept violations de droit » étaient fausses, pour la deuxième fois.** Vérification
faite : les sept portent toutes sur `iqvia_ventes_molecule`, que le catalogue de mission — celui
que le COMPILATEUR consulte — déclare `allowed: true`. La veille, le défaut était l'ORDRE (on
prenait l'instantané des droits avant de réchauffer le cache des skills) ; cette fois c'est
l'instantané LUI-MÊME. Il est pris une fois, au début d'une course de deux heures, derrière un
`.catch(() => 0)` : le jour où le préchargement échoue — c'est arrivé, la ligne « Skills
dynamiques préchargés » manque au journal — les quatorze capacités de connecteur disparaissent
des droits, et le banc accuse le moteur sur la cible la plus grave du mandat.

Un instantané est un SECOND REGISTRE (§17) : il redit ce que le catalogue sait déjà et diverge au
premier accroc. Le contrôle interroge désormais l'autorité réelle au moment de vérifier, et un
préchargement raté ne se tait plus. `autonomie_droits` à 95,8 % est donc un artefact de mesure,
pas une faille — et il faudra le relire sur une course faite avec le contrôle corrigé.

**Ce que le banc ne dit pas encore.** Le score reste non concluant tant qu'une panne de
fournisseur emporte un sixième des missions ; il faudra le rejouer au calme pour connaître
l'effet réel de ces corrections sur la réussite de bout en bout.

### LE BANC DE MISSIONS INÉDITES EST CLOS PAR PLUS GRAND QUE LUI (2026-09)

`scripts/bench/adam-mission-bench.ts` — neuf missions vagues lancées par le VRAI `lancerMission`,
avec carte de score par mission (enquête, plan, attentes, initiative, contact, fin), attendus
vérifiés en base et coût par mission — reste le banc court, celui qu'on relance en deux minutes
pour voir si une mission vague tient encore debout.

La MESURE DE RÉFÉRENCE, elle, n'est plus lui : c'est le banc d'autonomie du §43, deux cents
missions inédites par le même point d'entrée, avec classification de chaque échec en douze causes
et un score qui refuse de conclure quand une panne de fournisseur a mangé plus d'un dixième des
missions. Neuf missions donnent une impression ; deux cents donnent un chiffre. Les deux restent
— le court pour la boucle de travail, le long pour le verdict.

### « Ce n'est pas disponible » — quatre causes distinctes, toutes fausses (2026-09)

Quatre défis live sur quarante-huit tournaient autour d'une seule phrase d'Adam : *« le moteur
d'ordonnancement n'est pas disponible »*, *« aucune capacité SQL n'est disponible »*. Chaque fois
la capacité EXISTAIT. Quatre causes indépendantes s'étaient additionnées pour produire la même
phrase, et aucune n'était celle qu'on soupçonnait.

- **La doctrine anti-« je ne peux pas » n'était branchée QUE sur la voix.** `capabilityDoctrine`
  — la consigne qui impose d'INTERROGER `registre_capacites` avant de déclarer une impossibilité,
  et qui sépare « vous n'y avez pas droit » de « rien ne sait le faire » — existait, était testée,
  et n'atteignait que `voice-realtime.ts`. Le mode TEXTE, celui du navigateur ET celui des
  missions, ne la recevait pas. C'est exactement le §14 du CLAUDE.md : une brique dont on a
  cherché l'appelant de production et trouvé UN seul là où il en fallait deux. Elle est désormais
  dans `systemPrompt`, et un test vérifie que les DEUX surfaces portent la même — pas deux
  variantes qui divergeront. Effet mesuré au banc : sur le défi SQL, Adam est passé de ZÉRO appel
  d'outil à deux appels au registre.
- **Deux constantes du registre se contredisaient.** `MOTS_POUR_CONCLURE = 2` annonçait « deux
  mots distincts suffisent » ; `PERTINENCE_POUR_CONCLURE = 3` rendait ces deux mots insuffisants
  s'ils venaient du résumé (1 point chacun). La règle des deux mots ne pouvait donc JAMAIS être
  satisfaite sans un mot dans le nom. Conséquence : sur « chemin critique » — les deux mots de la
  demande, présents tous les deux dans le résumé de `calcul_ordonnancement` — la recherche
  classait la capacité PREMIÈRE pendant que la détection de manque répondait « aucune capacité ne
  sait faire ça ». Deux réponses du même outil à la même phrase, opposées ; Adam croyait la
  seconde. La correction n'abaisse aucun seuil : elle ajoute la COUVERTURE (la part de la demande
  qu'une seule capacité prend en charge, ≥ 75 % sur au moins deux mots). Mesuré sur quatorze
  besoins de vérité connue — sept présents, sept absents : la règle actuelle faisait 1 faux ABSENT
  et 3 faux présents, un seuil abaissé à 2 en faisait 0 et 5, la couverture en fait **0 et 3**.
  Le faux absent est la faute grave : c'est un verdict rendu avec autorité qui alimente une dette
  technique inexistante. Un faux présent ne conclut rien — il rend des candidats et dit au modèle
  de juger.
- **L'exclusion qui répondait sortait en vingtième.** Une déléguée demande une requête SQL.
  `sql_query` existe, elle n'y a pas droit : le registre le voyait, et la rangeait correctement en
  écartée/DROIT — **position 20 sur 38**, derrière dix-neuf exclusions sans le moindre rapport,
  parce que les écartées sortaient dans l'ordre du CATALOGUE. L'outil n'en affiche que dix. La
  seule exclusion qui répondait à la question n'atteignait jamais le modèle. Le mécanisme du §44
  fonctionnait ; c'est l'ORDRE qui l'annulait. Les écartées se trient désormais par pertinence,
  comme les retenues : position 20 → **0**.
- **Un sommaire de réseau se lisait comme une réponse.** À « comment X est-il relié à Y ? », le
  sommaire (compter les nœuds et les liens) a été pris pour un constat d'absence — alors qu'un
  chemin existait à deux pas et que l'analyse « chemin » l'aurait trouvé. La sortie du sommaire
  porte maintenant sa propre limite : compter n'est pas chercher, et rien ne se conclut d'ici.

**Et deux juges qui avaient tort.** Le défi de la signature électronique accusait Adam de ne pas
nommer un manque — alors que le produit a GRANDI : le connecteur DocuSign (§36) existe désormais,
et Adam avait donné la meilleure réponse possible (« la capacité existe, l'intégration n'est pas
configurée : URL, jeton et identifiant de compte manquent »). Le juge se déclarait lui-même « non
concluant » — il faisait son travail. Il est réécrit pour interroger le registre et exiger la
bonne chose SELON ce qu'il y trouve : capacité absente → nommer le manque ; capacité présente mais
non connectée → dire ce qu'il faut pour l'utiliser. Il ne redeviendra pas caduc au prochain
connecteur. Le défi d'attente d'événement, lui, ne battait l'ordonnanceur que pendant la
PLANIFICATION : une mission planifiée doit encore TOURNER avant d'arriver à son étape d'attente,
et plus rien ne la faisait avancer. Le banc accusait le moteur d'un silence qui venait du banc.

### La provenance au niveau du fait, la garantie d'enseignement, et la boîte dans le pont (2026-09)

- **Toutes les cibles sont MESURÉES, et le chaos gagne trois situations** : le rapport d'évals
  comptait vingt-trois cibles « non mesurées » — c'est-à-dire vingt-trois phrases exigeantes que
  personne ne vérifiait. Chacune est désormais reliée au test qui la prouve : `npm run
  evals:report` affiche soixante-quatorze lignes, zéro « non mesurée ». Côté résilience, la
  matrice des sabotages passe de quatorze à dix-sept, avec les trois cas que le mandat nommait
  et qui manquaient : des ÉVÉNEMENTS DANS LE DÉSORDRE (la fraîcheur se lit sur `occurredAt`,
  l'instant du fait, jamais sur `createdAt`, l'instant de l'écriture — et l'ancien n'est pas
  perdu, il fait partie de l'histoire), une ÉCHÉANCE DÉJÀ PASSÉE au réveil (réglée au PREMIER
  battement, jamais rejouée au suivant), et TRENTE MISSIONS SIMULTANÉES (trente identifiants
  distincts, trente objectifs distincts, aucune notification par mission — le silence reste la
  conduite par défaut).
- **Un « échec de permission » qui n'en était pas** : le banc d'autonomie comptait quatre
  violations de droit sur deux cents missions, sur la cible la plus grave du mandat. Vérification
  faite, le compilateur refuse bien une capacité hors catalogue (`UNKNOWN_CAPABILITY`, reproduit
  à la main) : les capacités incriminées étaient des SKILLS DYNAMIQUES (§36), servis par un cache
  préchargé au début d'un tour et déjà filtrés par le droit de leur manifeste. Le banc prenait
  son instantané des droits AVANT que ce cache soit chaud. Rien n'avait été franchi — mais
  accuser à tort sur la sûreté des permissions est pire qu'une mesure absente : on cherche une
  faille qui n'existe pas, et le jour où il y en aura une vraie, plus personne ne regardera. Le
  banc réchauffe le cache avant de mesurer.
- **Afficher ce qu'on veut, comme on veut, sans laisser un modèle écrire du HTML** (mandat 7) :
  la composition devient libre — six contenants composables à toute profondeur — pendant que le
  rendu reste fermé : les feuilles DÉSIGNENT les blocs existants, elles ne les décrivent pas.
  C'est la seule façon de tenir la promesse sans qu'une phrase écrite par un tiers dans un
  document puisse devenir du balisage. Un titre qui en contient est refusé, pas assaini ; un
  agencement invalide retombe sur une pile en le disant, parce que perdre la mise en page est
  une gêne et perdre le résultat une panne. Côté angles, le même jeu de lignes se relit par
  valeur, par période, par classement, par croisement ou par écarts — sans jamais retourner en
  base, et en annonçant toujours combien de lignes ont été écartées et pourquoi.
- **Économiser sans jamais descendre sous le plancher** (mandat 6 §50) : la hiérarchie
  qualité > coût > latence est tenue par l'ORDRE du calcul — la porte de qualité passe avant le
  tri par prix, et les deux grandeurs ne sont jamais additionnées, donc jamais compensables. La
  règle qui fait tout le travail est celle-ci : une paire (classe, modèle) non mesurée n'est pas
  une option bon marché, c'est une inconnue — sans quoi l'optimiseur prendrait toujours le moins
  cher, l'absence de mesure ressemblant à l'absence de problème. Cinq classes sur neuf ne se
  désescaladent jamais, mesure parfaite comprise. Et le North Star est le coût par mission
  RÉUSSIE, qui vaut `null` quand rien n'a réussi.
- **Vérifier à proportion, et le dire quand on n'a pas vérifié** (mandat 6 §49) : le niveau de
  vérification se calcule à partir du risque — dont la FRAGILITÉ DE L'OBTENTION, le facteur le
  plus prédictif et le plus oublié : la plupart des erreurs coûteuses portent sur des sujets
  importants dont la donnée a suivi un chemin fragile. Chaque méthode déclare ce qu'elle NE VOIT
  PAS, et le second modèle porte la ligne décisive : deux modèles d'accord sur le même contexte
  ne prouvent rien quand l'erreur est dans le contexte — c'est un écho, pas une preuve. Le sens
  négatif l'emporte (un recalcul qui contredit bat quatre confirmations), une méthode qui n'a pas
  pu tourner ne confirme rien, et même tout confirmé la phrase rendue reste « aucune méthode ne
  l'a contredit », jamais « c'est vrai ». Côté apprentissage, les échecs répétés produisent des
  PROPOSITIONS qui attendent un accord humain : il n'y a pas de fonction pour les appliquer, et
  la liste d'actions possibles ne contient rien qui touche à un droit.
- **Le plafond d'outils redevient une garantie** : le catalogue ayant grossi de §44 à §49, la
  liste COURTE d'un Super Admin est passée à 129 pour un plafond fournisseur de 128 — et
  `fitToolBudget`, dont c'est le seul travail, rendait 129. La coupe manquante est maintenant
  ordonnée (socle et découverte jamais coupés, outils non classés avant les outils de domaine
  que `list_more_tools` sait rouvrir), stable d'un appel à l'autre, et exercée à quatre plafonds
  différents pour qu'elle ne redevienne pas muette à la prochaine coupe du catalogue.
- **Défaire sans écraser** (mandat 6 §48) : « annule ce qu'Adam a modifié sur ce dossier hier »
  répond par trois listes — ce qui a été défait, ce qui ne pouvait pas l'être, ce qu'on peut
  faire à la place — et jamais par « c'est annulé ». Le cœur du lot est un invariant : un champ
  qu'une personne a modifié depuis n'est PAS réécrit, et le refus nomme qui l'a changé et quand.
  La condition vit dans le `where` de la requête, donc dans PostgreSQL au moment d'écrire, pas
  dans une lecture préalable qui laisserait une fenêtre. Aucune table de versions : `AuditLog`
  portait déjà l'ancienne valeur de chaque champ. Et l'annulation s'inscrit au journal comme un
  changement de plus — l'histoire s'allonge, elle ne se réécrit pas.
- **Un objectif qui survit aux missions, et une probabilité qui s'explique** (mandat 6 §47) :
  « prêts pour l'AO 2027 » devient une chose durable — critères, jalons, dépendances, risques,
  missions rattachées — surveillée après que les missions se sont fermées. La probabilité de
  l'atteindre ne sort jamais seule : elle vient avec ses six facteurs signés, la preuve de
  chacun, le facteur négatif principal nommé, et la phrase qui dit ce que le chiffre n'est pas.
  Un critère inconnu ne pénalise pas la probabilité, il fait chuter la confiance ; un critère
  atteint SANS preuve, lui, pèse autant qu'un vrai retard.
- **Le banc d'autonomie a menti une fois, et le code l'en empêche maintenant** (mandat 6 §43) :
  un mandataire a redémarré au milieu du run de 200 missions ; le fournisseur est devenu
  injoignable, le runtime a fait ce qu'il devait — RETENIR les demandes pour reprise — et le banc
  a publié « 18,9 % de réussite » en imputant 151 échecs au PLANIFICATEUR, un composant qui
  n'avait pas été appelé une seule fois. Deux correctifs : `\bECONN\b` ne rencontrait jamais
  `ECONNREFUSED` (la limite de mot exige un caractère non-mot, et c'est un « R » qui suit), donc
  la panne de transport la plus banale repartait en INDETERMINE ; et le juge a désormais une
  dixième cause, `INDISPONIBLE`, qui sort ces missions du dénominateur, les COMPTE, et fait
  déclarer le banc NON CONCLUANT au-delà d'un dixième de pertes. §118.10 appliqué au banc
  lui-même : un moteur qui conclut parce qu'il n'a pas pu vérifier est pire qu'un moteur qui ne
  conclut pas.
- **Trois chiffres qui divergent, et aucune moyenne** (mandat 6 §46) : le moteur vérifie d'abord
  que c'est bien la même question (HT contre TTC n'est pas une contradiction), écarte les valeurs
  dérivées qui ne sont pas des témoins, applique l'autorité PROPRE AU FAIT — le contrat signé
  prime sur l'ERP pour une clause, l'inverse pour un montant — puis la fraîcheur ; et quand rien
  ne départage, il nomme ce qui trancherait ou pose la question, sans jamais choisir. La lignée,
  elle, rend un chiffre contestable étape par étape, et refuse celui qui ne remonte à aucune
  source.
- **L'entreprise a une histoire, pas seulement un état** (mandat 6 §45) : les journaux qui
  existaient déjà — audit, faits métier, liens — sont enfin lus comme une histoire, avec deux
  temps distincts (ce qui était VRAI, ce qu'on SAVAIT) et un refus net de combler les trous : un
  champ non journalisé répond INCONNU sur le passé au lieu de rétro-projeter sa valeur du jour.
  « Qui était responsable au moment de cette décision ? » rend enfin la personne de l'époque.
- **Deux cents missions jamais vues, et un chiffre qui ne se truque pas** (mandat 6 §43) : le
  corpus est engendré à partir des entités réelles, les attendus sont des FORMES vérifiables sur
  l'état et non des réponses écrites d'avance, et une famille entière de missions est
  INFAISABLE — parce qu'un banc sans tâches impossibles ne mesure jamais l'honnêteté. Neuf causes
  d'échec, deux profondeurs qui ne donnent pas le même chiffre, et une comparaison N vs N+1 qui
  refuse deux corpus différents plutôt que de célébrer un tirage plus facile.
- **Ce qui manque a un nom, et ce qu'on sait faire a une fiche** (mandat 6 §44) : douze rubriques
  par capacité, composées du catalogue RÉEL et de mesures prises sur les étapes de mission
  réellement exécutées — une capacité jamais exécutée est dite de fiabilité INCONNUE, jamais
  « fiable ». Onze natures de manque, classées AU MOMENT de l'échec dans le journal qui existe
  (§17), et une feuille de route qui n'est qu'une LECTURE de ces événements, avec la dette
  technique SÉPARÉE de l'exploitation. « Cela existe mais vous n'y avez pas droit » et « rien ne
  sait le faire » ne se confondent plus. Le recensement a trouvé, du premier coup, deux capacités
  déclarées sous le même nom (`mission_status`) avec des schémas incompatibles — renommée, et
  interdite par un test.
- **Douze mille fichiers ne sont pas douze mille clics** (mandat 5 §41) : recensement,
  dédoublonnage en trois natures (identique, version, ressemblant — et supprimer un identique ne
  libère aucun octet, le stockage le partage déjà), classement par le CONTENU avec l'indice cité
  et la confiance plafonnée quand seul le nom parle, lot avec aperçu AVANT, reprise par reçu,
  réessais des seuls échecs passagers, compte arithmétique et plan de retour. Rien ne se supprime :
  le pont refuse. Import/export : encodage, séparateur, en-tête et locale DÉTECTÉS (un export de
  tableur français est en latin-1 à points-virgules avec des virgules décimales), ce qui est ambigu
  reste en texte, et toute conversion destructive nomme ce qu'elle perd avant de la faire.
- **L'entreprise est un réseau, et la wilaya est un point** (mandat 5 §40) : chemins entre deux
  entités (avec les intermédiaires NOMMÉS et le nombre de chemins distincts), portée d'une décision,
  quatre centralités dont l'intermédiarité qui désigne le point de passage là où le degré désigne le
  carnet d'adresses, communautés non déclarées, points de rupture ; validité temporelle par lien, de
  sorte que « qui était responsable au moment de cette décision ? » a une réponse. Géographie : les
  58 chefs-lieux, distances orthodromiques, tournées 2-opt, territoires équilibrés sur la charge,
  point de Weber et choix exact entre sites réels. Le pont applique les droits entité par entité :
  ce qu'on ne voit pas ne fournit aucun nœud. Le banc live a montré un faux négatif — « aucune
  chaîne enregistrée » alors que le lien existait — et la règle de routage qui le corrige.
- **Le chiffre est produit par le code, avec ce qu'il ne dit pas** (mandat 5 §39) : neuf moteurs
  purs — Monte-Carlo jusqu'à 200 000 tirages (percentiles, probabilité de perte, leviers,
  convergence, piège des moyennes), simplexe et séparation-évaluation (optimum, PRIX MARGINAUX,
  goulots ; infaisable et non borné argumentés), ordonnancement (chemin critique, marges, retard
  imputé à la ressource), satisfaction de contraintes (impossibilité DÉMONTRÉE avec ses règles en
  cause), régressions et tests (colinéarité, validation croisée, fuite de données, effet contre
  significativité), segmentation, ACP, anomalies, séries temporelles (prévision validée hors
  échantillon contre la marche naïve). Chaque réponse porte sa rigueur. Le banc live a montré deux
  défauts de routage, corrigés : la question qui porte sa propre arithmétique va aux moteurs, pas
  en lecture d'agenda.
- **Une page se lit au palier qui suffit, un enregistrement s'interroge à la seconde** (mandat 5
  §38) : natif → OCR ciblé → lecture visuelle rapide → modèle supérieur, par page, sous budget et
  plafond absolu (jamais 500 pages dans un gros modèle), méthode et confiance dites pour chaque
  page ; bloc image dans la passerelle des modèles ; audio et vidéo en segments horodatés avec
  locuteurs probables, chapitres, décisions, engagements et actions datés, texte indexé, « où
  exactement X a-t-il parlé de Y » rendu à la seconde, images d'une vidéo aux instants pertinents.
- **Un fait entre par une porte, et une mission peut attendre n'importe lequel** (mandat 5 §37) :
  catalogue de ~31 faits canoniques lu par le planificateur (`WAIT_EVENT` quasi universel), ingestion
  universelle des webhooks (DocuSign, SAP, HubSpot, PCH, IQVIA, e-signature, générique) — signature
  HMAC obligatoire, réclamation exactly-once avant toute conséquence, association par la résolution
  d'entités (sûr rattaché, douteux à vérifier par une personne, jamais en silence), registre canonique
  qui réveille ; communication omnicanale gouvernée par les règles enseignées (canal préféré, heures de
  silence), les connecteurs branchés (Slack, Teams, WhatsApp, SMS) et la confidentialité (corps neutre
  hors de l'ERP), l'arbitrage restant intouchable.
- **Un skill déclare, le cœur découvre** (mandat 5 §36) : un format de manifeste pour trois
  provenances — cinq connecteurs déclarés (DocuSign, SAP, HubSpot, IQVIA, PCH) sans une ligne dans le
  cœur, des micro-outils créés par Adam derrière la porte de qualité et promus par une personne, des
  playbooks enseignés qui composent des lectures ; effet, domaine et droit viennent du manifeste, un
  effet qui engage rend un aperçu et exige la confirmation, une ressource absente est dite.
- **Une représentation est une forme, pas un composant** (mandat 5 §35) : dix-sept formes (barres,
  courbes, aires, nuage, histogramme, secteurs, cascade, entonnoir, heatmap, Gantt, matrice, réseau,
  arbre, flux, carte, indicateurs) et le mini-tableau de bord rendus par UN rendu générique ; le
  modèle nomme, le code charge sous le droit de la source, agrège, choisit la forme, signale ce qui
  tromperait, compose et relit le bloc — le modèle n'en reçoit qu'un aperçu chiffré ; `run_analysis`
  et `sql_query` rendent désormais leur graphique recommandé sous le tableau ; sur téléphone les
  séries se lisent en liste proportionnelle.
- **Primitives plutôt que fonctionnalités, la découverte avant l'impossible, et une porte de qualité
  sur le code** (mandat 5 §34) : chaque capacité porte l'une des six primitives et le planificateur
  compose à ce niveau ; « je ne peux pas » sans un seul outil appelé déclenche, côté serveur, la
  relecture de la carte complète et un second essai — une limite acceptée doit dire sa nature (droit,
  ressource, donnée, capacité), jamais « pas prévu » ; `run_code` inspecte, exécute, teste contre des
  attentes closes, valide la forme promise, et n'expose un résultat que si tout tient.
- **La suite d'évaluation compte, les sabotages tiennent, chaque action se lit** (mandat 4 §33) :
  dix-sept cibles dans un registre pur, mesurées par les matrices existantes au moment où elles
  comptent (`consignerMesure`), relues par `npm run evals:report` qui dit « non mesurée » plutôt que
  « réussie » ; quatorze situations adverses (mauvaise entité, doublons, source non sûre, contradiction,
  règle conflictuelle, permission refusée, fournisseur indisponible, facture sans BC, crash pendant une
  surveillance, redéploiement, règle changée en cours de mission, sous-agents en désaccord, plafond de
  coût, modèle indisponible) jouées contre le vrai code, 14/14 ; et un journal par action de mission —
  treize champs constatés, jamais déduits — servi par `mission.status`, avec la version du prompt et les
  règles enseignées estampillées dans le plan, et la décision de permission comptée sur chaque tour.
- **Le brief de réunion a trois niveaux, et c'est la personne qui enseigne le sien** (mandat 4 §32) :
  LIGHT (réunion, ordre du jour, tâches ouvertes par participant), STANDARD (+ notes de la dernière réunion
  du même sujet, actions et leur sort calculé sur la tâche créée, décisions liées, engagements), CHIEF OF
  STAFF (+ historique, personnes, dossiers, décisions à obtenir, risques et contradictions des signaux
  métier, engagements en retard comptés, questions ouvertes, suivi jusqu'à la suivante). « Pour mes
  réunions, je veux un briefing de chef de cabinet » devient une règle Teach structurée (`niveauReunion`)
  que le brief lit ; sans règle, le rôle décide. Le niveau change ce qu'on lit, pas ce qui est vrai : un
  brief léger ne lance pas les lectures d'un brief complet. Banc : 5 + 3 tests, un défi live en deux tours.
- **Le registre de marque existe, et la fabrique l'applique d'elle-même** (mandat 4 §26) :
  couleurs, polices, logo, coordonnées imprimées, mentions légales, signataires par type de pièce
  — dans `settings.marque` du profil documentaire, réglés par la Direction ou qui tient la papeterie (écran
  Administration › Marque & modèles, ou en parlant à Adam — « règle la charte d'Adventum » n'est pas une règle Teach, et Teach le dit), relus par la fabrique à chaque devis,
  BC, facture et dossier : accent dans les styles, mentions et signataire dans le texte, logo dans
  l'en-tête d'un paquet neuf. Contraste WCAG calculé et dit. Banc : 14 tests, 4 parcours
  Playwright, un défi live où la charte réglée au premier tour se retrouve dans le Word du second.
- **Une photo devient des chiffres, dits probables — et la voix n'est qu'une seconde entrée**
  (mandat 4 §30) : image ou scan joint → OCR réel local (secours vision sur les pages faibles), puis
  lecture visuelle par le modèle sous schéma quand le texte est mince ; la note « PROBABLE, chiffres
  à confirmer » voyage jusqu'au modèle, la calibration interdit le CERTAIN. Le banc joint une facture
  rendue en PNG par le même chemin que le navigateur. Voix : même registre d'outils, mêmes droits,
  même fil (`threadId`) ; mobile : le retour visuel d'un geste est mesuré sous 150 ms dans la page.
- **La certitude est décidée par le code, et les spécialistes travaillent en parallèle** (mandat 4
  §29) : cinq états (certain, probable, hypothèse, manquant, contradiction) calculés depuis la base
  et la confiance des faits F8 — le maillon faible gouverne, une lecture de modèle n'est jamais
  certaine —, cinq conduites (agir, vérifier, chercher, demander, arbitrer) ; le tour porte sa
  calibration, la trace la dit, une action proposée sous manquant ou contradiction est avertie
  avant confirmation. `consult_specialists` délègue à des workers éphémères Regulatory, Legal,
  Finance, Documents (outils de lecture fermés, mêmes droits, même trace, rapports calibrés) ; cinq autres
  sont définis et attendent une mesure. Mesuré au banc (2 × 2 tours sur deux défis) : l'orchestrateur n'a jamais délégué et fait aussi bien seul (3 lectures d'intelligence en parallèle, ou trois documents lus dans la vague) — aucun spécialiste actif, l'outil n'est pas exposé, le mécanisme attend une mesure positive.
- **La surveillance couvre ce que le mandat nomme** (mandat 4 §28) : contrat ou facture, enveloppe
  budgétaire, réponse e-mail attendue, document attendu au Drive — en plus des dossiers, tâches,
  règlements, appels d'offres et entités canoniques. Chaque cible a ses règles de code et sa fin
  naturelle (renouvelé, réglée, répondu, présent) ; l'e-mail ne se lit que dans la boîte de la
  personne ; la restauration après redémarrage est mesurée (toutes relues une fois, aucune deux).
  Deux défis live : un contrat surveillé en une phrase, un document attendu dans un dossier.
- **L'intelligence métier calcule, elle n'opine pas** (mandat 4 §27) : Regulatory, Legal et
  Finance parlent le même signal (`lib/utils/signaux.ts`), avec gravité, échéance, montant, fiche,
  action et CALCUL en clair. Legal lit les clauses d'un contrat français (durée, tacite, préavis,
  exclusivité, pénalités, confidentialité…) avec extrait et confiance, date les obligations depuis
  la fin (dénonciation = fin − préavis), compare un avenant en valeurs, nomme les risques ; Finance
  juge le rythme d'une enveloppe contre le calendrier et projette l'atterrissage, trouve l'ordre réglé
  sans la facture exigée, grade une échéance selon sa nature ; Regulatory nomme l'étape en retard et
  de combien, la pièce manquante, le dépôt dépassé, le partenaire en retard, les bloqueurs de
  soumission, les réserves et obligations. Trois outils Adam sous la porte de l'écran, une dixième
  source de la boîte de décision (état chaud), une réserve nocturne des clauses. Banc : 21 tests
  dont 6 sur base depuis le vrai point d'entrée (contrat déposé et indexé), 3 défis live jugés sur
  les chiffres du décor.
- **Le bac à sable d'exécution existe, et il ne peut pas écrire** (mandat 4 §25) : SQL en lecture
  seule (forme, plan, transaction READ ONLY + rôle, volume ; vue globale ; audité), JavaScript en
  fil isolé au contexte vide, Python en processus aux limites noyau et déclaré absent quand il
  manque, seize opérations d'analyse pures compilées depuis la spec du modèle (refus dits), et
  la visualisation qui recommande et dénonce ce qui trompe. Quatre outils d'Adam (`sql_query`,
  `run_analysis`, `run_code`, `chart_advice`), le domaine `DATA` ouvert en secondaire sur toute
  question qui calcule, et la consigne « jamais de tête ». Banc : 56 tests unitaires et sur base,
  six défis live (SQL compté et vérifié en base, série mensuelle, scénario +8 % jugé à
  l'arithmétique, graphique, code, refus SQL de la déléguée), un tour SQL dans l'interface.
- **La résolution d'entités est une brique de la fabric** (F9, mandat 4 §24) : dix natures,
  identifiants, alias, trigramme, verdicts CERTAIN / PROBABLE / AMBIGU (question) / INCONNU,
  aucune écriture ; les mentions d'une question sont résolues par le code avant le modèle, et
  l'assignation d'une tâche passe par elle. Banc : 60/60 mentions, P95 12 ms.
- **Le moteur de qualité des données tourne** (mandat 4 §23) : vingt-trois règles déterministes
  bornées, constats à signature stable, trois résolutions tenues par la structure (AUTO appliqué
  et audité, PROPOSE d'un clic, HUMAIN), balayage horaire léger + nocturne complet, écran
  `/admin/qualite`, cartes dans la boîte de décision, outil `data_quality` d'Adam. Banc : 29
  anomalies plantées, 29 détectées, 0 faux positif sur les témoins.

- **« D'où tu tiens ça ? » a une réponse, et c'est le code qui la donne** (F8, mandat 4 §22).
  Chaque tour consigne ses faits typés (source, date propre, lecture, confiance, fraîcheur,
  autorité, droits, lignée d'un calcul) dans `AssistantProvenance` ; la question est une forme
  déterministe des deux boucles, sans appel de modèle — P95 de relecture 5 ms, tour complet dans
  le navigateur sous 5 s (spec) ; le panneau Sources dit d'où et de quand ; `finance_totals`
  déclare la lignée de ses totaux ; `source_map` sort du domaine GENERAL qui ne le servait jamais.
- **Un « règle enregistrée » se prouve par un outil** (`lib/teach/garde.ts`). La suite live a
  mesuré un faux succès : le modèle affirmait avoir retenu une règle en relisant l'historique
  d'une conversation où la même règle — supprimée depuis — avait été enseignée la veille. Les
  deux boucles vérifient désormais : énoncé d'enseignement + prétention + aucun outil Teach
  appelé → le modèle reçoit UNE fois l'ordre d'appeler l'outil ; s'il ne le fait toujours pas, la
  réponse dit la vérité. Le rappel d'actions récentes précise aussi qu'une action EXÉCUTÉE
  n'interdit pas de la reproposer (« déjà fait le … » + carte), et la suite live repart d'un état
  sans les intentions du passage précédent.
- **La boîte de décision vit dans le pont.** Sa première version ajoutait cinq franchissements
  de frontière Adam → ERP ; composer la boîte EST connaître l'ERP : `platform/in-process/inbox/`
  porte le composeur et le geste, `lib/assistant/inbox/model.ts` le vocabulaire pur, les pages
  n'importent que le pont — plafond inchangé (428). La carte tranchée reste affichée avec son
  issue (la revalidation de l'action la retirait de la file sous le doigt), et le bureau d'Adam
  compte les cartes « à trancher » par la même fonction que l'en-tête de la boîte.

### Le banc des défis, la boîte de décision, et six défauts que seul le vrai point d'entrée montrait (2026-09)

**Ce que le lot rend possible** : juger Adam sur ses EFFETS et non sur son récit. Quinze défis
(`scripts/bench/adam-live-defis.ts`, `BENCH_SET=defis npm run adam:bench`) enchaînent une journée : enseigner une
règle personnelle et la voir appliquée au tour suivant, poser une règle de société, la réviser (v2, l'ancienne
SUPERSEDED), la lister, émettre un devis qui DOIT la respecter, refuser l'émission et la règle de société à une
déléguée, supprimer la règle (la ligne reste, DELETED), construire un classeur et un deck depuis la base, centrer
un titre dans un `.docx` et l'enregistrer (le fichier relu porte `w:jc center`), résister à une injection glissée
dans une note lue, comparer trois dossiers, calculer un TTC. Chaque verdict est une lecture de la base, du Drive ou
du fichier produit. Une suite Playwright LIVE (`npm run test:e2e:live`, `playwright.live.config.ts`,
`e2e-live/adam-live.spec.ts`) pose les mêmes défis dans le vrai navigateur — clic sur « Confirmer », devis au
registre, règle appliquée dans l'interface — et lit le coût de chaque tour dans `ModelCallLog`.

**Ce que le banc a trouvé, et qui est corrigé** : les outils Teach Adam n'étaient jamais présentés au modèle
(domaine `GENERAL`, jamais servi) ; la voie rapide ignorait les règles ; les règles dépendaient du drapeau
« mémoire » ; le modèle écrit `validite_devis` / « 45 jours » (normalisés) ; un `chainFromId` vide violait une clé
étrangère ; « devis » n'était pas un signal de domaine ; le PDG du banc voyait sa société sans pouvoir l'engager
(le seed lui donne désormais les droits d'écriture que l'écran d'administration accorde à un dirigeant) ; la
sélection PF versée par une migration rendait « tous les dossiers » ambigu — le juge compte avec le périmètre de
l'outil, pas en SQL brut. Score : 4/15 à la première passe, 14/15 puis 15/15 après corrections, à environ 0,27 $
la chaîne complète.

**La boîte de décision** (`/chief-of-staff/inbox`) : voir la section dédiée — cartes composées par le code depuis
les files des modules, gestes canoniques, urgence arithmétique, P95 de composition 46 ms.

### Teach Adam — la couche de règles enseignées à Adam (2026-09)

**Ce que le lot rend possible** : « Désormais les devis sont valables 45 jours — pour toute la société », « toute
facture au-dessus de 500 000 DZD passe par le PDG », « quand je dis la DT, c'est la Direction technique », « sauf
pour les hôpitaux », « quelles règles sur les factures ? », « finalement 60 jours », « supprime cette règle ». Une
règle est classée (neuf natures), bornée (personne / département / société), datée, priorisée, versionnée par
lignes, tracée ; Adam la relit à chaque tour (texte et voix), le planificateur de missions la reçoit, la fabrique de
documents l'applique (« nos factures commencent par FAC » → FAC-2026-0001). Un conflit de même clé est dit avant
d'écrire ; la précédence est celle du code (exception > contrainte large > périmètre étroit > priorité > récence) ;
ce qu'elle ne tranche pas est rendu comme indécidable. L'agent des missions ne peut pas s'enseigner de règles.

**Ce qui a été construit** : `src/lib/teach/` (modèle, classement, précédence, composition — 27 tests purs, mille
règles résolues en moins de 50 ms), `platform/in-process/teach/store.ts` (droits par périmètre, versions en
transaction, audit, contexte, politiques, standards documentaires — 9 tests sur base par les vrais points d'entrée),
cinq outils, la garde de l'agent, les injections (contexte personnel, planificateur, fabrique), `AdamRule` et sa
migration idempotente, le renvoi de `remember` vers `teach_adam`.

**Ce qui n'est pas prétendu** : les règles sont LUES par le modèle et appliquées par le code là où une clé est
connue (fabrique) ; une règle de validation (« > 500 000 passe par le PDG ») est portée au planificateur et au
modèle, elle ne réécrit pas encore la politique d'approbation du moteur de missions — c'est le lot suivant de la
suite d'évaluation (#33) qui mesurera le respect et fermera l'écart s'il y en a un. Les règles proposées par
observation (mode `PROPOSED`) ont leur place dans le modèle, pas encore de producteur.

### Office God Mode — lot 3 : la fabrique de documents — devis, bons de commande, factures, dossiers à trois formats (2026-09)

**Ce que le lot rend possible** : « Fais-moi un devis Adventum pour la Pharmacie Centrale » → une pièce composée
par le code, numérotée par le compteur de la société, sur son papier en-tête, inscrite au registre Legal (nature
QUOTE / PURCHASE_ORDER / INVOICE, chaînée à son amont), en Word et en PDF dans le Drive, montants et somme en lettres
calculés. « Émets les 25 bons de commande » → 25 appels d'un éventail, 25 pièces, numéros consécutifs, contrôle
qualité 25/25 — et rejouer un appel n'émet rien. « Corrige le devis : quantités doublées » → même numéro, version 2
du même fichier, historique ; une facture émise ne se réécrit pas. « Prépare le dossier du comité en Excel,
PowerPoint et Word » → trois fichiers dérivés des mêmes données, totaux du classeur recalculé comparés à ceux du
code : un écart et rien n'est écrit. « Nos factures commencent par FAC, devis valables 45 jours » → profil
documentaire de la société, réglé par la papeterie.

**Ce qui a été construit** (`src/lib/artifact/factory/`, 62 tests purs ; `platform/in-process/artifact/factory.ts`,
11 tests sur base) : `lettres.ts`, `commercial.ts` (calculs, règles, empreinte), `word.ts` (compositeur OOXML,
papier en-tête recopié à l'octet près), `build.ts` (compose → relit → contrôle), `canonical.ts` + `dossier.ts`
(données canoniques → classeur / deck / note, cohérence), le pont (compteur atomique `DocumentSequence`, pièce au
registre Legal dans la transaction du numéro, reprise par empreinte, révision, profil `CompanyDocumentProfile`,
dossier), trois outils d'Adam, capacités au catalogue, métadonnées de mission, migration idempotente, banc.

**Ce qui a été mesuré** (`npm run factory:bench`) : 200 pièces composées + relues P50 5,6 ms / P95 9,7 ms ; 50 sur
papier en-tête P50 4,4 ms, 0 pièce du ZIP altérée ; dossier 6 × 300 lignes + 10 sections + 8 chiffres en 744 ms
(3 618 formules, 25 diapositives, 18 totaux comparés) ; 10 000 montants en lettres en 16 ms. Sur base : 10 émissions
parallèles → 10 numéros distincts consécutifs ; mission de 25 BC par `avancer` → 25 pièces, QC 25/25.

**Ce qui a été mesuré faux en chemin** : 33 820 DZD attendus pour 28 420 HT × 1,19 (c'est 33 819,80 — l'attente
était fausse, pas le calcul) ; un total de 78 432,50 attendu là où les lignes font 76 225 (même leçon : le code a
raison, la tête compte mal — c'est exactement pourquoi les totaux ne sont jamais tapés) ; trois outils ajoutés au
domaine REGULATORY ont fait sortir une écriture métier du plafond du résolveur de niveau B — les domaines des
outils de la fabrique ont été resserrés (LEGAL / FINANCE / DRIVE).

**Ce qui n'est pas prétendu** : le PDF jumeau rend texte et tableaux, pas l'en-tête graphique (le `.docx` fait
foi) ; le droit de timbre est une constante du code ; le profil documentaire est la fondation du registre de marque
(#26), pas le registre complet.

### Office God Mode — lot 2 : Word de 300 pages, decks de 120 idées, PDF de 500 pages (2026-09)

**Ce que le lot rend possible** : « Réécris le troisième paragraphe de la page 212 » sur un contrat de 6 000
paragraphes — la page est celle que Word a enregistrée (ou une estimation qui se dit telle), le rang se compte dans
la page, une page seule rend ses paragraphes comme candidats au lieu de choisir. « Ajoute une diapositive : titre,
trois puces, après la 60 » dans la disposition et la charte du deck. « Prépare-moi 40 slides pour le comité » →
un deck « une idée par diapositive » construit, relu par l'adaptateur et contrôlé avant d'être écrit dans le Drive ;
une règle violée (7 puces, titre de 18 mots, diapo vide) et rien n'est écrit, la diapositive et la règle sont nommées.
« Que dit la page 47 de ce PDF de 500 pages ? », « où parle-t-on de la garantie ? » → texte natif de la plage
demandée, pages et extraits de la recherche, plan des signets ; les pages scannées sont océrisées par le moteur de
l'ERP, au plus douze par appel, en disant lesquelles et avec quelle confiance — jamais cinq cents pages dans un
modèle. « Qu'est-ce qui a changé entre les deux versions ? » → paragraphes alignés par leur contenu : une clause
insérée au milieu de 200 + une modification + une suppression font exactement trois changements, le texte modifié
est dit par son fragment. « Est-ce que je peux l'envoyer ? » → le contrôle avant livraison : bloquants (« [à
compléter] », « XXX », diapo sans titre, cellule en erreur) et avertissements (section vide, numérotation qui saute,
titre trop long, corps illisible).

**Mesuré** (`npm run office:bench`, section « échelle », onze budgets, P95) : Word 6 001 ¶ / 301 pages — ouvrir +
carte des pages + plan 77 ms, réécrire le 3e ¶ de la page 212 + sérialiser 137 ms, comparer deux versions avec une
insertion au milieu 160 ms (1 changement), contrôle avant livraison 7 ms. PowerPoint — construire + relire +
contrôler 120 idées 226 ms, ouvrir 121 diapos 64 ms, ajouter une idée + déplacer une diapo + sérialiser 164 ms.
PDF 500 pages — ouvrir + aperçu de chaque page 22 ms, lire 40 pages 3,8 ms, chercher dans tout le document 16 ms,
supprimer 3 pages + sérialiser 6 ms. Les cibles §29 tiennent toujours. **Non mesuré** : réseau, blob Drive, OCR
(deux à cinq secondes par page Tesseract, dit à l'appel).

**Fichiers** : `adapters/docx/adapter.ts` (`marquesDePage`, `estimerPages`, plan), `commands/{ir,resolve}.ts`
(`cible.page`), `adapters/pptx/adapter.ts` (`ajouterDiapo`), `decks/build.ts`, `pdf/read.ts`, `versions/diff.ts`
(`alignerSequences`, `fragmentModifie`), `qa/checks.ts` (`controlerAvantLivraison`), pont
`in-process/artifact/documents.ts` (OCR borné, deck dans le Drive), outils `pdf_read`, `deck_build`, gestes
`controler` / `inspecter`. Tests : 36 nouveaux cas (pagination Word et estimée, ciblage par page, 104 diapos
ajoutées, 121 diapos construites, 500 pages lues et cherchées, comparaison alignée, contrôle avant livraison).

### Office God Mode — lot 1 : Excel, lu exactement, vérifié, expliqué, comparé (2026-09)

**Ce que le lot rend possible** : « Adam, vérifie le budget 2027 » → structure, recalcul indépendant des 200 000
formules, constats classés (valeur en dur au milieu d'une colonne de formules en D6, somme qui oublie D10 en D11,
`*1.19` codé en dur, « 12 » en texte que SOMME ignore) avec adresse et preuve. « D'où vient le TTC en E5 ? » →
« E5 vaut 26 180, par la formule =SUM(E2:E4). Elle lit E2:E4 (3 cellules : 11 305, 9 500, 3 800). Aucune formule
n'en dépend. » « Si je change la TVA ? » → « 5 formules en dépendent. » « Qu'est-ce qui a changé depuis la v3 ? »
→ « 41 changements : 1 formule écrasée par une valeur (K12347), 1 ligne insérée (50002), 3 valeurs modifiées… »
— et pas cent mille « différences » parce qu'une ligne a été insérée.

**Ce qui a été construit, et ce qui a été mesuré faux en chemin** (`src/lib/artifact/sheets/`, 41 tests,
`npm run sheets:bench`) : le lecteur en flux d'ExcelJS, essayé d'abord (ne rien recréer), a été écarté sur
mesure — résultats 0 / « » / FAUX / erreurs jetés, formules partagées perdues, UTF-8 coupé entre deux tampons
(« S��tif ») ; le lecteur natif (fflate + `TextDecoder` en flux) lit 1,2 M de cellules en 3,5 s, exactement. Le tri
topologique utilisait `Array.shift()` : quadratique, 16 s sur 200 000 formules — 2,5 s avec une tête d'index. Les
captures de regex de V8 retenaient les tampons entiers : chaînes aplaties et internées. L'audit signalait la
« Marge % » d'une ligne de totaux comme incohérente (elle diffère de ses voisines horizontales) : l'incohérence est
désormais jugée sur les deux axes. La comparaison comptait `SUMIF(Données!D2:D100001)` → `D2:D100002` comme une
formule modifiée : une fin de plage qui a suivi l'insertion, même depuis une autre feuille, est une plage ajustée.
Budgets tenus : GRAND (100 000 lignes, 200 033 formules) lecture 3,5 s · graphe 2,5 s · recalcul 6,5 s (0 écart) ·
audit 2,3 s · comparaison 4,6 s (1 insérée + 3 valeurs + 1 écrasée, exactement) ; LARGE (120 feuilles, 144 722
formules) lecture 0,9 s · graphe 1,2 s · recalcul 0,6 s · audit 1,1 s · trace jusqu'à la Synthèse 0 ms.

**Le constructeur de classeurs vérifiés** (`build.ts`) : spécification déclarative → xlsx → relu → recalculé →
valeurs écrites → audité ; `ok` faux si une formule donne une erreur ou si l'audit relève un constat critique ou
haut. Il refuse un contrôle `SUM(E2:E4)` écrit en dur dans un devis à cinq lignes (plage tronquée) — la fabrique
documentaire du lot 3 s'appuiera dessus.

**Adam** : quatre lectures (`sheet_audit`, `sheet_trace`, `sheet_diff`, `sheet_read`), droits du Drive par le
port, cache d'analyses borné en cellules (3 M), capacités `artifact.sheet_*` au catalogue avec point d'entrée
exigé par test. Les tests de frontière (428), du garde de bundle client et du catalogue de missions passent.

**Mandat 2, mesures de clôture** : banc m7 (neuf missions vagues, fournisseur réel) 31/35 attendus (89 %) pour
0,38 $ ; banc de paliers (40 missions, concurrence 8 → 16 → 8) 28 succès, 10 fins honnêtes, 2 défauts, création
95 %, P50 18,5 s, P95 35 s, 16,7 à 19,7 missions/min — les deux défauts venaient d'un plan qui écrivait `query` là
où `search_documents` lit `question`, refusé deux fois ; le contrat d'entrée **répare** désormais une clé
synonyme sans ambiguïté (une inconnue, un manquant, même type) et le dit, au lieu de refuser.

### Adam, chef de cabinet — lot 1 : l'enquête avant le plan, l'attention protégée, la relance par Adam lui-même (2026-09)

**La question qui gouverne ce chantier** : « puis-je confier un objectif à Adam et arrêter d'y penser jusqu'à
ce qu'il ait besoin de moi ou qu'il l'ait terminé ? ». Le lot 1 répond sur cinq propriétés, chacune tenue par
du code et un test, et il est MESURÉ par un banc de missions inédites (`scripts/bench/adam-mission-bench.ts`) :
neuf missions vagues d'un dirigeant — « occupe-toi du dossier Trastuzumab », « la facture 2026-0891 de
l'Imprimerie », « surveille l'appel d'offres PCH 2026/14 », « les engagements du comité », et la phrase-phare
qui enchaîne neuf gestes (statuts à mettre à jour d'urgence, export Excel, mail au dirigeant, tickets de caisse,
point bloquants chaque dimanche, réunion du jeudi, budget, annuaire) — lancées par `lancerMission` sur le vrai
fournisseur, avec pour chacune une carte : enquête, plan, lectures/écritures, attentes, notifications, effets,
coût, et une liste d'attendus vérifiés en base. Baseline : 9 attendus sur 35 (26 %). Après le lot : 9/14 (64 %)
sur les quatre missions planifiées, puis 9/17 (53 %) sur cinq — trois missions n'ont jamais été planifiées parce
que la planification dure 54 à 93 s et que le mandataire HTTP de cet environnement coupe à 60 s. C'est dit tel
quel : la latence de planification est la limite suivante, pas un détail.

**1. L'enquête avant le plan** (`platform/in-process/missions/situation.ts`, `planner/plan.ts`). Une mission
vague partait au planificateur avec la seule phrase du dirigeant, et le plan commençait par lui demander ce que
l'ERP savait déjà. Désormais le CODE enquête d'abord, sous délai (9 s) : entités reconnues, recherche fédérée,
fiches (`inspect_record`), changements des quatorze derniers jours (`what_changed`), documents, engagements
ouverts, acteurs concernés — sous les droits de la personne (une déléguée ne voit pas les dossiers réglementaires).
La situation est rendue au planificateur en clair (« SITUATION ÉTABLIE PAR LE CODE — ne les redemande à
personne », « ACTEURS CONCERNÉS, à qui s'adresser AVANT de solliciter le dirigeant ») et impose les capacités du
domaine ; la consigne 12 dit la règle : le dirigeant n'est pas la première source. Journal `INVESTIGATED`,
détail `enquete` dans `CREATED`.

**2. Le lancement ne se perd plus** (`runtime.ts`). Une panne transitoire du fournisseur pendant la
planification (HTTP 5xx, coupure du mandataire, délai) ne rend plus une erreur : la mission-talon est créée,
`PLANNING_DEFERRED` est journalisé, la conversation dit « la demande est enregistrée, je vous préviens quand la
mission aboutit », et le battement reprend la planification (`finaliserLancementDifere`, `rattraperLancementsPerdus`).
`estPanneTransitoire` distingue la panne de la faute durable ; un sabotage l'a neutralisée — trois tests tombent.

**3. La porte d'attention** (`lib/missions/attention/policy.ts` — pur ; `platform/in-process/missions/attention.ts`
— le pont). Le moteur ne pousse plus une notification par événement : il émet un SIGNAL typé
(`MISSION_COMPLETED`, `MISSION_PARTIAL`, `MISSION_BLOCKED`, `APPROVAL_REQUIRED`, `QUESTION`, `WAIT_OVERDUE`,
`PLAN_CHANGED`, `BUDGET_HOLD`…) par le port `PorteAttention`, et la politique CLASSE : `SILENCE`, `JOURNAL`,
`INFO`, `ATTENTION`, `ARBITRAGE`. Le niveau choisit les canaux (journal seul ; notification ; + push ; + e-mail
au dirigeant), une clé `kind:mission:vN:étape` déduplique, une cadence par niveau et un plafond de quinze
signaux par jour dégradent en journal ce qui déborde. Le message est composé par le code depuis les reçus —
« Mission terminée — … : Résultat / Actions / Livrables / À surveiller », « Bloqué — … : Problème / Contexte /
Recommandation / Décision demandée » — en moins de 700 caractères. Branchée dans `conclure` (bilan des reçus),
à l'ouverture d'une approbation, à une question d'étape, à un changement de plan, aux attentes échues.

**4. Adam relance lui-même** (`platform/in-process/missions/relance.ts`, `commitments.ts`, `sweep.ts`). Une
attente échue produisait un push au dirigeant : « attend toujours. Voulez-vous relancer ? » — l'agent passif,
qui transfère la micro-décision la plus évidente. L'échelle : barreau 1 et 2, un message interne signé Adam
(compte système) à la personne attendue, un par vingt-quatre heures ; barreau 3, sa hiérarchie
(`Employee.managerId`) ; au-delà seulement, le dirigeant, par la porte d'attention, avec le nombre de relances
faites. Une partie EXTERNE n'est jamais écrite depuis le battement : le dirigeant décide. Les engagements en
retard passent par la même échelle (le promettant d'abord ; le dirigeant quand l'échelle est épuisée ou sans
compte interne). Tout est relu au journal (`NUDGED`) : aucun harcèlement au redémarrage. Le message part par
`envoyerMessageDirect` (`lib/messaging.ts`) — l'UNIQUE chemin d'écriture d'un message direct, partagé par
l'écran, l'assistant et Adam — qui inscrit le fait `MESSAGE_RECEIVED` (`lib/events/messaging-events.ts`) au
registre canonique : une mission peut attendre « la réponse de Raihana » comme elle attend un e-mail.

**5. Le moteur, trois défauts mesurés par le banc.** (a) 62 des 107 capacités « non écriture » du catalogue
partaient en `EXTERNAL_COMMUNICATION` par défaut prudent — `resolve_person`, `find_documents`, `what_changed`… —
donc une approbation SENSITIVE demandée pour une lecture, puis « action non prise en charge » sur le chemin des
intents ; la première mission inédite s'est bloquée là. `registry/capability-meta.ts` : sous liste d'écritures,
une lecture est `READ` ; les ÉCRITURES AUTONOMES (`AUTONOMES` : rappels, souvenirs, décisions, engagements,
dépôt Drive interne, export…) sont exécutées par le chemin des lectures sous une garde d'idempotence
(`AUTONOMOUS_EFFECT` au journal — la reprise après panne ne crée pas deux rappels), et une écriture autonome
qui rend une phrase au lieu d'une structure est un ÉCHEC (« plan_reminder n'a rien écrit »), plus une étape
DONE. (b) Une lecture en échec définitif tenait en otage l'analyse, l'accord et le contrôle d'une enquête de
facture : `dependanceSatisfaite` — une dépendance MORTE laisse passer un nœud de synthèse qui a DU MATÉRIAU
(un autre amont abouti) ; jamais une capacité, jamais une synthèse sans rien (« conclure malgré tout », c'est
inventer — la mission passe BLOCKED et se replanifie). (c) Un éventail sur un résultat portant deux listes
(`resultats` et `couverture.sourcesInterrogees`) était AMBIGU : `preferer` choisit la moins profonde, puis celle
d'objets ; les briefs du catalogue disent leur SORTIE (« éventail sur « resultats » »). Et l'effet d'un REÇU se
lit désormais dans le catalogue du composeur (`metaDe`), plus dans le registre nu : le banc d'acceptance
(`CHEAT-1`) a montré une lecture `find_documents` reçue comme `EXTERNAL_COMMUNICATION` et une mission sans
écriture jugée « au-delà du plafond ANALYZE ».

**Et la frontière client/serveur, une fois de plus.** `envoyerMessageDirect` a fait de `messaging.ts` un module
qui inscrit des faits — donc qui tire, à sept modules de distance, le push VAPID (`web-push` → `net`/`tls`). Trois
écrans de messagerie l'importaient pour un libellé de statut : le build PROPRE est tombé (« Can't resolve 'net' »),
alors que le garde-fou du bundle passait, parce que la chaîne traversait un `import()` dynamique que le garde ne
suivait pas. La part pure vit désormais dans `lib/messaging-ui.ts` (présence, statuts, aperçu — zéro import), les
écrans l'importent, `messaging.ts` la réexporte pour le serveur ; et `client-bundle-guard.test.ts` suit les imports
dynamiques et connaît les PAQUETS Node-only (`web-push`, `nodemailer`, `imapflow`, `sharp`, `mupdf`, `pdfkit`…) —
un sabotage (l'écran remis sur `messaging.ts`) le fait tomber en nommant la chaîne exacte.

**6. La branche « sinon » et la garde de seuil** (`planner/contract.ts` `StepCondition`, `runtime/condition.ts`,
compilateur, moteur). « Si Sarah n'a pas répondu avant vendredi, relance-la ; si elle a répondu, remercie-la »
s'écrivait avec un WORKER pour lire un booléen. Une étape porte désormais `when` : l'ISSUE attendue d'une étape
amont (EVENT — réglée par un fait —, TIMEOUT — par le temps —, DONE, FAILED, SKIPPED) et/ou un TEST sur sa
sortie (`path` / `op` / `value` : « si le prix dépasse 5 000, demande validation »). Le compilateur pose la
dépendance implicite, refuse une condition incohérente (étape inconnue, issue EVENT après autre chose qu'une
attente, opérateur sans champ, comparaison sans valeur) ; le moteur l'évalue AVANT tout, éventail compris ; non
remplie, l'étape est IGNORÉE (`STEP_SKIPPED` qui dit pourquoi, avec les valeurs) et la suite continue — le
contrôle qualité la retire du dénominateur. Prouvé par l'entrée réelle (`branche-conditionnelle.test.ts`) : le
vrai réveil temporel fait partir « relancer » et ignorer « remercier » ; la vraie réponse par le registre fait
l'inverse ; la garde « alerte si la liste est vide » ne part pas quand la liste a deux noms.

**7. La surveillance durable** (`prisma AdamWatch`, `lib/missions/watch/rules.ts` — pur —, `watch/router.ts`,
`platform/in-process/missions/watch.ts`, outils `watch_entity` / `list_watches` / `stop_watch` — **réservés au
Super Admin** comme toute mission d'Adam, `peutPiloterMissionsAdam`, §118.136). « Surveille ce
dossier et préviens-moi seulement s'il y a un problème » : une ligne durable + une MISSION-SUPPORT (`kind WATCH`)
qui apporte le journal, la porte d'attention, la conduite (suspendre, arrêter) et l'écran — rien n'est recréé.
Un problème est une RÈGLE de code, jamais un jugement de modèle : échéance proche ou dépassée, silence, blocage,
statut, seuil, disparition, changement de statut (information). La cible est relue à sa cadence ET dès qu'un fait
la touche (le registre avance `nextCheckAt` — « changement ERP → réveil »), sous les droits du propriétaire relus
en base. La SIGNATURE d'un lot de problèmes est stable (« depuis 15 jours » puis « 16 » est le même problème) :
un problème n'est dit qu'une fois, sa résolution passe au journal, la fin de la cible s'annonce une fois et clôt
la surveillance. Deux sabotages le tiennent (dédoublonnage neutralisé, réveil du registre neutralisé → le banc
tombe). Cibles résolues : dossiers réglementaires, dossiers CTD, tâches, règlements, demandes de paiement,
validations, produits / organisations / personnes du dictionnaire canonique — une référence ambiguë rend des
candidats, jamais le premier des quatre. **Mandat 4 §28** : quatre cibles de plus, chacune avec ses règles par
défaut et sa fin naturelle — un **contrat ou une facture** Legal (sous l'entité et les lecteurs désignés ;
échéance à 30 j, dépassée, changement de statut ; « renouvelé » ou « réglée » clôt), une **enveloppe budgétaire**
(celles que la personne voit ; `consommePct ≥ 80` par la règle VALEUR, dépassée = bloquée → arbitrage, santé qui
change, fin de période ; le calcul du rythme est dans l'état), une **réponse e-mail attendue** (un fil de SA boîte
connectée, jamais celle d'un autre ; `SANS_REPONSE` tant qu'aucun message entrant ne suit le dernier sortant, cinq
jours de silence valent relance — brouillon possible, envoi humain ; la réponse clôt), un **document attendu** au
Drive (`expected_document` : motif de nom + dossier ; `ABSENT` sept jours vaut relance, `PRESENT` clôt — la cible
n'existe pas encore, c'est son arrivée qu'on surveille). La recommandation portée par la porte d'attention dépend
du type (relancer le correspondant, demander le document, arbitrer l'enveloppe, décider du renouvellement). **100 %
des surveillances restaurées après redémarrage** est une propriété mesurée, pas déclarée : la seule vérité est la
ligne durable et son `nextCheckAt` ; le test rend six surveillances dues, un balayage neuf les relit toutes, le
même balayage rejoué n'en relit aucune (`in-process/missions/watch.test.ts`, 10 cas).

**8. Les matrices d'évaluation — des mesures, pas des intentions.** Trois bancs programmatiques, chacun avec sa
cible chiffrée : (a) **agir / demander / prévenir** (`attention/decisions.test.ts`) — vingt-quatre situations
écrites depuis le mandat AVANT de regarder la politique (bruit, utile non urgent, attention, arbitrage), 100 %
conformes ; au passage, l'insistance (notification qui reste à l'écran) est réservée à l'ARBITRAGE. (b)
**permissions × capacités × confirmation** (`permission-matrix.test.ts`) — mesuré sur le VRAI catalogue de
TOUS les rôles : toute écriture du résolveur est classée ≥ `INTERNAL_REVERSIBLE_WRITE`, toute étape à effet
≥ `EXTERNAL_COMMUNICATION` compile avec un accord, toute écriture non rejouable porte sa clé, l'agent ne compile
aucune capacité `SECURITY_ADMIN`, un rôle terrain n'en voit aucune de sécurité ni de paiement. La matrice a
trouvé un défaut réel : un délégué médical VOYAIT `decide_payment` (l'exécution refusait, mais le planificateur
pouvait le proposer et le compilateur l'acceptait) — les écritures sous condition sont désormais filtrées à
l'exposition par le MÊME prédicat que l'exécution (`sitsOnPaymentCentre`). (c) **le crash à chaque frontière**
(`crash-matrix.test.ts`) — la même mission (lecture → accord → un message par salarié → attente → contrôle)
rejouée cinq fois, tuée après une étape différente à chaque fois (RUNNING, bail expiré, reçu et résultat
effacés) : 5/5 reprises concluent, 0 message dupliqué, 100 % des intents EXÉCUTÉS, la déduplication comptée.
Cette matrice a trouvé un second défaut : une attente dont la progression persistée était déjà complète mais
qui se retrouvait WAITING (reprise après crash) ne se finalisait jamais — le routeur de réveil est désormais
idempotent sur ce cas.

**8 bis. Les données changent pendant la mission** (`donnees-modifiees.test.ts`, `sweep.ts` `conduireMission`). La
cible d'un envoi est désactivée entre l'accord et l'exécution : aucun message ne part, l'étape échoue en le
disant (`INVALID_STEP`, non rejouable), la mission ne se déclare pas terminée. Le banc a trouvé le trou : une
mission qui passe BLOCKED par déduction d'état (graphe figé) ne prévenait PERSONNE — seule la conclusion par le
juge signalait. La conduite d'un passage du battement est désormais une fonction (`conduireMission` : avancer,
replanifier si ça coince, et — si ça coince ENCORE — le dire au dirigeant au moment où le blocage APPARAÎT,
jamais répété à chaque battement). « Résolu seul » reste au journal ; « coince sans recours » remonte.

**8 ter. La réponse tardive** (`relance.ts` `observerReponseTardive`, registre). Adam a relancé Raihana lundi ;
l'attente a expiré mercredi ; la mission a poursuivi ; Raihana répond jeudi — plus aucune étape n'attend ce
fait, et la réponse était PERDUE. Désormais, un message ou un e-mail dont l'auteur a été relancé par Adam pour
une mission encore vivante, et qu'aucune attente n'attrape, rejoint le journal de la mission (`LATE_REPLY`, la
réponse conservée telle quelle, jamais interprétée ni exécutée) et le dirigeant en est informé (INFO, une
fois par fait ; une mission terminée n'est plus concernée). Prouvé par le vrai registre
(`reponse-tardive.test.ts`).

**9. Les événements dans le désordre** (`events/router.ts` `rattraperFaitAnterieur`, moteur). La réponse peut
arriver AVANT que l'attente n'existe — pendant l'accord, pendant la lecture amont, entre deux tours. Avant de
dormir, une attente regarde si le fait attendu est DÉJÀ au registre, dans une fenêtre qui commence à la fin de
la dernière dépendance qui ÉCRIT (la demande) — un message antérieur à la demande n'est pas une réponse — ou à
la création de la mission ; seuls les FAITS règlent une branche ici (le temps reste l'affaire du balayage
temporel), une progression partielle est persistée, un fait cadré sur une autre mission est ignoré. Journal
`EVENT_CATCHUP`. Prouvé par l'entrée réelle (`evenement-anterieur.test.ts`) dans les deux sens.

**10. Le contrat d'entrée, et la tuyauterie entre étapes** (`registry/input-contract.ts` — pur —,
`runtime/interpolate.ts`, compilateur, moteur, catalogue). Le run m5 du banc (neuf missions, rôle de
planification forcé à `STANDARD_WORKER` pour tenir sous la coupure du mandataire : plans en 5 à 21 s) a rendu
20 attendus sur 35 (57 %), et son diagnostic tient en une phrase : **sept des onze écritures qui ont échoué
écrivaient des clés que l'outil ne lit pas** — `message` pour `body`, `schedule` pour `quand`, `paymentReference`
pour `reference`, `entity` pour `reference` — et les plans composaient leurs étapes avec `{{analyse:coherence
.actionPaiement}}`, la forme promise par le schéma du planificateur depuis toujours, que le moteur ne résolvait
PAS (le motif n'acceptait même pas le deux-points d'une clé d'étape ; la référence partait en toutes lettres vers
l'outil). Chaque échec arrivait APRÈS l'accord du dirigeant et coûtait une replanification. Désormais : (a) le
CONTRAT D'ENTRÉE de chaque capacité est dérivé de son `input_schema` — la source que la conversation envoie déjà
au modèle, pas un second tableau —, montré au planificateur sur la ligne de la capacité (`entrées :
recipientName* (texte), body* (texte)` ; obligatoires d'abord, énumérations en clair, options bornées) et VÉRIFIÉ
à la compilation : clé inconnue, obligatoire manquante, valeur hors énumération → `INVALID_INPUT` avec les clés
admises ; une faute de FORME (« approve » → `APPROVE`, « 12 500 » → 12500) se répare en code et se dit. (b) La
TUYAUTERIE `{{cle_etape.chemin}}` est résolue par le moteur avant tout appel : clé reconnue par le plus long
préfixe (deux-points, tirets, points, indices de liste), dépendance implicite posée par le compilateur, référence
vers une étape inexistante refusée avec les clés du plan. Le DIAGNOSTIC précède l'injection : un chemin absent
sur une étape aboutie ÉCHOUE en nommant les champs rendus (`INVALID_STEP`, non rejouable — la replanification a
de quoi corriger) ; une liste amont VIDE ignore l'étape (« rien à traiter ») et la suite continue ; une étape
amont non aboutie n'invente rien. Le reçu porte l'entrée réellement partie, l'entrée écrite reste celle qui a
été approuvée. (c) Une ÉCHÉANCE d'attente peut être une référence vers une date LUE (« attends l'échéance du
contrat que tu viens d'analyser ») : acceptée à la compilation, résolue à l'exécution, l'attente devient
concrète EN BASE (le balayage temporel la lit telle quelle), et une valeur illisible fait échouer l'attente avec
la valeur au lieu d'endormir la mission pour toujours. (d) Les écritures AUTONOMES (rappel, export, surveillance,
souvenir, décision, engagement) sont déclarées répétables et **sans accord** — la même politique que la
conversation, qui les exécute sans carte (§7) ; le banc demandait un ACCORD au dirigeant pour poser la
surveillance qu'il venait de demander, et refusait « un rappel par échéance critique » comme non répétable. (e)
Une attente humaine adressée au DEMANDEUR, posée après une SYNTHÈSE (worker, livrable, contrôle) et dont rien ne
dépend — jonctions exclues — (« au vu de la note, validez-vous l'orientation ? ») est refusée à la compilation :
ce n'est pas un arbitrage, c'est une validation de confort — livrer et conclure ; une question dont des étapes
dépendent, ou adressée à quelqu'un d'autre, ou posée sans amont (« remettez-moi le contrat signé ») ou après des
actions (« j'ai écrit à tous ; quelle est la référence du marché ? »), reste une attente. (f) Le planificateur connaît le DEMANDEUR (nom
et adresse) pour lui écrire par son nom exact — il écrivait `to: "propriétaire de la mission"`. (g) Une mission
terminée DANS LA FOULÉE de la demande (moins de deux minutes), sans livrable ni effet externe, passe au journal
au lieu de pousser « Mission terminée » sur le téléphone : la conversation vient de le dire ; un fichier qui
attend ou un e-mail parti restent une information (matrice des décisions : 30 situations, 100 %). (h) Le rôle
forcé `ADAM_PLANNER_ROLE` s'applique à TOUTES les planifications (première, reprise après refus,
replanification) — forcé sur la première seule, la reprise repartait au rôle par défaut et deux missions
mouraient « non lancées » pour une coupure du mandataire. (i) `create_calendar_event` accepte « quand » en
français par le même décodeur temporel que les rappels. Prouvé : `input-contract.test.ts`,
`interpolate.test.ts`, `compiler/entrees.test.ts` (12 cas), `runtime/tuyauterie.test.ts` (par `avancer`, sur la
vraie base : valeur reçue, reçu, liste vide → ignorée, chemin absent → échec nommé, échéance dérivée persistée,
échéance illisible → échec) ; la matrice permissions × capacités compile désormais chaque écriture avec une
entrée minimale qui honore son contrat (`exempleEntree`).

**11. La journée simulée, et ce que le banc m6 a encore trouvé** (`journee-simulee.test.ts`, run m6). La
porte d'attention est mesurée sur une journée chargée, horloge injectée, journal réel : douze missions
partiellement faites, douze alertes de surveillance, douze blocages — trente-six signaux dignes d'attention —
puis cinq arbitrages, les mêmes faits redits, et le lendemain. Exactement PLAFOND_QUOTIDIEN (15) poussés,
vingt et un au journal sans vibrer, les cinq arbitrages poussés malgré le plafond, les redites tues, le
compteur rouvert le lendemain, cinquante-quatre lignes au journal. Le banc a trouvé un défaut : la porte
journalisait à l'heure de la BASE, pas à la sienne — sous horloge simulée, le plafond ne voyait aucun signal
« du jour » (`journaliser` accepte l'instant de l'appelant). Le run m6 du banc de missions inédites (après le
lot 5) : **27 attendus sur 35 (77 %)**, les neuf missions lancées, 0,12 $ — et six causes précises, toutes
générales, fermées dans la foulée : (a) la forme de sortie DITE au planificateur pour `find_documents` était
fausse (`resultats[].id` alors que la capacité rend `driveNodeId` — le moteur l'a dit champ par champ, le
tableau est corrigé d'après le code, `search_drive` et `gmail_search` avec lui ; `list_my_tasks` rend une
LISTE à la racine, et une liste à la racine est désormais une collection d'éventail) ; (b) le schéma de
`decide_payment` promettait REQUEST_CHANGES / REQUEST_INFO que le centre a retirés — le schéma dit la
vérité du gestionnaire (autoriser / refuser), et le compilateur refuse le reste AVANT l'accord ; (c) le
rôle à relancer de `plan_reminder` était un texte libre (« Équipe Regulatory ») — c'est une énumération des
rôles de la maison ; `send_message` dit qu'il écrit à UNE personne et qu'une équipe se déploie en éventail ;
(d) « Surveille l'appel d'offres PCH 2026/14 » n'avait AUCUNE cible : les appels d'offres (`PchTender`) se
surveillent — référence sous ses écritures (« AO 2026/14 », « PCH 2026-14 »), échéance de dépôt puis
d'attribution, suspension, statut, silence, disparition — sous le droit PCH ; (e) « fais en sorte qu'on ne
rate aucune échéance » recevait quinze capacités et aucune pour poser un rappel ou une tâche (le mot
« échéance » n'est pas dans le résumé de `plan_reminder`) : les cinq gestes de suivi d'un chef de cabinet
(tâche, rappel, message, surveillance, réunion) sont toujours montrés, sous droits ; et une porte d'ACCORD
dans un plan sans écriture sous accord (« 0 étape à autoriser », un arbitrage insistant pour rien) devient une
jonction, en le disant ; (f) `gmail_prepare_mail` répondait « compte Google non connecté » en phrase, l'étape
passait DONE et seul le juge final relevait la contradiction : sous contrat FICHE (l'intent préparé), la phrase
est un échec à l'étape. Le banc lui-même conduit désormais chaque mission comme le battement
(`conduireMission` : avancer → replanifier → signaler), au lieu du seul `avancerMission` qui sous-estimait
la reprise.

**Ce qui reste, dit avant d'être demandé.** La latence de planification au rôle par défaut (2,4-3,5 k jetons de
sortie, 54-93 s) ; `ADAM_PLANNER_ROLE` permet de mesurer un rôle plus rapide, et le mandat 6 (optimiseur de coût
à qualité d'abord) tranchera le routage. Le run m7 du banc (après les six corrections ci-dessus) et la charge en
paliers (`DEEP_SMOKE_PALIERS`, jusqu'à vingt missions de front) sont les mesures suivantes du même chantier.

### Adam mesuré, puis accéléré : le banc, les pré-lectures, le routage par niveau, le coût de premier rang (2026-09)

**On a d'abord mesuré, sur le vrai fournisseur.** Un banc de conversation reproductible
(`npm run adam:bench`, `scripts/bench/adam-live-bench.ts`) joue vingt questions d'un dirigeant — lecture
canonique, requête structurée, permission d'une déléguée, raisonnement, documents, agrégation partenaire,
mémoire de fil, anti-hallucination, actions, préparation de comité — contre un jeu de données LOCAL et
jetable dont la vérité terrain est connue (`npm run adam:bench:seed`, gardé : base locale + `BENCH_SEED_ALLOW=1`,
manifeste incrémental, `--clean`). Chaque tour traverse `runAssistantStream` comme le navigateur et rend un
verdict déterministe, le premier signe de vie, le premier mot, le total, les appels par rôle, les jetons, la
part en cache, le coût et les outils appelés. Tables AVANT/APRÈS dans `bench-out/`. Depuis, un second jeu — les
DÉFIS (`scripts/bench/adam-live-defis.ts`, `BENCH_SET=defis`) — juge les EFFETS (règle en base, devis au registre,
fichier produit, paragraphe centré dans le `.docx`, injection sans effet), et une suite Playwright LIVE
(`npm run test:e2e:live`) rejoue des défis dans le vrai navigateur, coût par tour lu dans `ModelCallLog`.

| Mesure (20 tours, cache chaud) | AVANT | APRÈS pré-lectures + routage | FINAL (prompt compact + routage resserré) |
|---|---|---|---|
| Réussites | 12/20 | 20/20 | 20/20 |
| Total P50 · P95 | 6,3 s · 28,2 s | 3,7 s · 14,5 s | 3,9 s · 10,3 s |
| Premier mot P50 · P95 | — | — | 3,4 s · 6,1 s |
| Jetons d'entrée par tour (part en cache) | 87 600 (75 %) | 47 200 (72 %) | 22 300 (88 %) |
| Coût moyen par tour | inconnu (≈ 0,09 $ recalculé) | 0,036 $ | 0,012 $ — salutation 0,0001 $, lecture nue 0,0001 $, requête structurée 0,008 $, permission refusée 0,005 $ |
| « Où en est le dossier Nivolumab ? » | « il me faut une référence » | fiche en 1,0 s, 0,0004 $ |
| « Qu'avait promis Amel au comité ? » | 7 appels, 32 s, « aucune trace » | 1 appel, 1,9 s, la promesse citée |
| « Prépare-moi le comité de demain » | 10 appels, 57 s, 0,54 $ | 2 appels, 18,6 s, 0,095 $ |

**Ce qui a changé, cause par cause.** (1) Le chemin rapide écrivait `query`, l'outil lisait `reference` : la
question la plus fréquente d'un dirigeant échouait proprement — clé alignée, sujet débarrassé de son mot-classe,
synonyme accepté par l'outil, et un **test de contrat routeur → outil** (`context/fast-args-contract.test.ts`)
qui a aussitôt attrapé l'agenda (`horizon` n'existait pas ; « demain » devient une date). (2) **Les pré-lectures**
(`assistant/pre-lectures.ts`) : sur une route de lecture, la recherche fédérée et la recherche documentaire
partent AVANT le modèle, sous délai, par les mêmes outils et les mêmes droits, présentées comme des appels
déjà faits ; une seconde vague suit ce qui est devenu évident (la fiche d'un dossier unique, le document de
confiance HAUTE) ; la recette « préparer une réunion » lit l'agenda, le point exécutif et les documents. Le
modèle décide toujours la suite — avec la preuve sous les yeux. (3) **La recherche fédérée** dit son
assouplissement quand l'expression entière ne rend rien, trouve un produit par son laboratoire, les tâches de
toute l'entreprise en vue globale ; la fiche Legal porte ses notes et son fichier signé. (4) **La relecture
critique** rendait parfois sa critique à la place de la réponse : sortie structurée (verdict + réponse finale).
(5) **Le routage par niveau** : une salutation et la formulation d'une lecture déjà faite partent sur le rôle
`bulk` (Luna, sans réflexion, repli sur l'orchestrateur si vide) ; les niveaux A/B tournent en effort `low`
(`ADAM_REASONING_SIMPLE`), le C garde l'effort du rôle ; « prépare-moi le comité » est une synthèse, pas une
mutation. (6) **Le cache de prompt effectif** : tout ce qui change à chaque message (mémoire personnelle, entités
actives, plan, indice natif, actions récentes) voyage avec le message (`context/tour.ts`) au lieu de la fin des
consignes, avec une clé de cache par personne — 96 % de jetons servis du cache sur les requêtes structurées.
(7) Les lectures d'ouverture (interrupteur IA, mémoire, contexte personnel, identité, accord en attente) partent
ensemble au lieu d'en file.

**Le coût devient une métrique de premier rang.** Tarifs publics Sol / Terra / Luna / Realtime (lecture de cache à
10 %, datés, surchargeables par `ADAM_PRICE_*`) ; `ModelCallLog` (une ligne PAR APPEL, écrite par un puits tamponné
branché sur la passerelle — rôle, modèle, jetons, cache, coût, personne, fil, mission) ; agrégats du tour dans
`AiUsageLog` ; coût par mission (le runtime signe ses tours) ; coût d'une session VOCALE (texte et audio comptés
depuis `response.done`, tarifés côté serveur, `voice/cost.ts`) ; carte « Coût des modèles » dans le centre de
contrôle IA (par modèle, par usage, par personne, par tour, par mission, tarifs en vigueur). Un tarif inconnu
reste NULL — jamais un zéro qui aurait l'air d'un prix. Chaque tour porte aussi ses **phases** (contexte,
pré-lectures, outils, modèle) : « où sont passées les six secondes ? » se lit dans le journal `[adam] turn`.

**Prouvé live dans cet environnement** (fournisseur réel via le proxy de session) : les vingt tours du banc, le
smoke fournisseur (`PROVIDER_PROVEN` / `MISSION_E2E_PROVEN`), la couche d'acceptance des missions (arrière-plan,
pause/annulation, priorité, attente temporelle, attente d'événement, rappels, e-mail entrant, reprise après crash,
éventail de 120, formes validées, spéculation, réservation de jetons, cache de prompt, **recherche web réelle**), la
création d'une session Realtime avec la configuration de production (cedar, `semantic_vad`, 41 outils). Deux
scénarios de veille web longue se sont arrêtés BLOQUÉS sur des `HTTP 502 upstream request failed` répétés du proxy
de session sur les appels de plus d'une minute — une limite de l'environnement d'exécution, pas du produit
(un appel `web_search` direct de 5 s passe). Correctif annexe : deux écritures simultanées du même contenu dans le
Drive ne se disputent plus l'index `sha256` (`putBlob` adopte la ligne gagnante).

**Le prompt redevient compact : la capacité est dans le code, le savoir dans les données.** Le prompt système
du PDG pesait 46 500 caractères (≈ 16 600 jetons) : un condensé réglementaire, un briefing des outils de puissance et
un briefing exécutif — de la logique métier récitée à chaque tour. Il ne porte plus que le comportement, le jugement
et le style. Le savoir ANPP est devenu un **outil** (`regulatory_knowledge`, `lib/assistant/regulatory-read.ts`) que le
modèle appelle quand la question le demande ; les règles d'usage vivent dans la **description de chaque outil**
(un test l'exige) ; le briefing exécutif nomme ses capacités au lieu de les paraphraser. Mesuré au même banc, cache
chaud : **20/20, 29 600 jetons par tour (89 % en cache), 0,015 $ par tour** — contre 0,036 $ avant compaction et
≈ 0,09 $ au départ ; après les correctifs de routage ci-dessous : **22 300 jetons, 0,012 $, total P50 3,9 s, P95 10,3 s**. Trois fuites de jetons trouvées par la mesure, pas par la lecture : (1) « Rappelle-moi demain à
8h de valider le budget » partait sans `plan_reminder` (le rappel n'était pas un signal MISSION) — le modèle
demandait la liste complète, 2 appels et 64 000 jetons ; corrigé dans le routeur : 1 appel, 12 000 jetons, 2,9 s
à cache chaud. (2) Une question causale (niveau C) emportait **17 outils d'écriture, 16 800 jetons sur 28 000**,
pour lire et diagnostiquer : les écritures ne partent plus en C que si la phrase **nomme un geste**
(`nommeUnGeste`, même liste de verbes que la route ACTION) ; la découverte reste le filet. (3) « L'appel d'offres
PCH » ne menait qu'à DRIVE (le document), jamais aux outils PCH (REGULATORY) ; et la description de la découverte
ne disait pas quels domaines étaient déjà ouverts — elle le dit maintenant, par tour, et chaque appel de découverte
se journalise (`[discovery]`, domaine demandé, outils rouverts) ; la découverte lit la carte COMPLÈTE des domaines
(une demande « HR » d'une déléguée rouvrait 72 outils « non classés » ; elle en rouvre 7 — permission refusée : 47 000 →
16 600 jetons). Effet mesuré sur les deux questions causales du banc : 3–4 appels et 120 000–130 000 jetons avec un appel de découverte à chaque fois → **2–3 appels, 22 000–40 000 jetons, zéro découverte**, 6–14 s au lieu de 16–25 s.

**La reprise après panne ne rejoue jamais une écriture faite — prouvé, puis saboté.** Un sabotage avait montré que
rendre la clé d'idempotence aléatoire ne faisait tomber aucun test : la clé est persistée sur l'étape avant l'effet,
ce qui neutralise cette faute-là, mais rien ne prouvait le cas « effet fait, reçu perdu ». `platform/in-process/
missions/crash-between.test.ts` le prouve par l'entrée réelle : deux messages envoyés, une étape remise à RUNNING
avec son bail expiré et son reçu effacé, `avancerMission` la rejoue — l'intent EXÉCUTÉ est retrouvé, l'étape
porte `DEDUPLIQUE` et le reçu du premier passage, **pas un message de plus**. Le même sabotage fait maintenant tomber
ce test (« expected 0 to be greater than or equal to 1 »). Le journal d'usage a rejoint le pont
(`platform/in-process/telemetry/usage-sink.ts`, `usage-stats.ts`) : le cliquet de frontière Adam ↔ ERP reste à 428,
et la session vocale se journalise par le puits, le rôle nommé une seule fois dans la passerelle (`ROLE_VOIX`).

### Rien ne dépasse, rien ne casse, aucun lien mort — l'audit UI mesuré (2026-09)

**On a cessé de juger l'interface à l'œil.** Un crawler (`scripts/ui-audit/run.ts`) ouvre CHAQUE route
de l'application dans Chromium, à 375 px et à 1440 px, avec un compte Super Admin éphémère, et mesure :
la boîte de chaque élément visible qui sort de l'écran hors d'un conteneur qui défile, les textes
d'erreur (les nôtres et ceux de Next), le statut du document, et chaque lien découvert — cliqué, puis
jugé sur sa réponse. Première passe : **treize écrans qui débordaient, cinquante et un liens morts,
une page 404 en anglais.** Dernière passe : **zéro, zéro, et une page « Introuvable » en français,
dans la coque, avec le menu.**

**Ce qui débordait, et pourquoi.** Presque toujours la même cause : une grille qui n'avait de colonnes
qu'« à partir de `md` » (`grid md:grid-cols-3`) — en dessous, le navigateur crée des colonnes
implicites dimensionnées sur leur contenu, et un titre long pousse tout hors de l'écran. **Cent
cinquante et une grilles** ont reçu leur colonne de base (`grid-cols-1`, c'est-à-dire
`minmax(0, 1fr)`), et `lib/responsive-guard.test.ts` refuse désormais une grille sans elle. Le reste :
des barres d'outils sans retour à la ligne (Drive, Regulatory, l'en-tête du calendrier), un champ de
recherche sans `min-w-0`, et des chiffres à vingt-quatre pixels dans des cartes de cent soixante
(`kpi-card.tsx` : `min-w-0` + `break-words`).

**Les liens morts n'étaient pas des fautes de frappe.** Cinquante sur cinquante et un venaient du centre
de paiement : « Demande d'origine » pointait vers un objet SUPPRIMÉ — la trace (`sourceType`,
`sourceId`) survit à l'objet, et `entityHref` en faisait un lien tout à fait normal vers une 404.
`lib/entity-exists.ts` pose la question avant d'afficher (une requête par type, pas par ligne), et
l'écran écrit « source supprimée » au lieu d'un lien. Le cinquante et unième était un vrai chemin faux
(`/e360` → `/pch/[id]`), et `lib/ui/dead-links.test.ts` relit maintenant tous les `href`, `redirect(` et
`link:` du code contre l'inventaire des routes.

**La leçon la plus chère du lot : `loading.tsx`.** Un squelette d'attente avait été ajouté au niveau de
la coque. Il enveloppe chaque page dans une frontière Suspense — et sous cette frontière, un
`redirect()` de page n'est plus une réponse HTTP 307 : la coque est déjà partie, la redirection
voyage dans le flux et c'est le navigateur qui la rejoue à l'hydratation. Sur Next 14.2 **en
production seulement**, cette hydratation casse la comptabilité des hooks du routeur (React #310,
vercel/next.js#63121) : la passe suivante du crawler a compté **vingt-six écrans** — `/aujourdhui`,
`/finances`, `/medical`, `/office`, `/drive/[id]`… — qui affichaient « Application error » à la place
de leur redirection. Le mode développement ne le montre pas ; `tsc`, le lint, les tests et le build
non plus. Le squelette est parti ; l'attente a désormais la forme d'un **fil de progression** en haut
de l'écran (`components/layout/nav-progress.tsx`), qui n'a besoin d'aucune frontière ; et
`lib/ui/loading-boundary.test.ts` interdit un `loading.tsx` au-dessus d'une page qui peut rediriger —
c'est-à-dire presque toutes, `requireModule` redirigeant quand un module est masqué.

**Ce qui reste, et le dit.** Une page qui casse affiche « Cette page n'a pas pu s'afficher », avec
« Réessayer » et la référence du journal serveur (`app/(app)/error.tsx`) ; une fiche introuvable, une
page « Introuvable » qui garde le menu. Et pour que rien ne revienne : `e2e/ui-audit.spec.ts` rend
quarante écrans représentatifs aux deux largeurs sur le build de production (`npm run test:e2e`) et
tombe au premier pixel qui dépasse.

### Deux largeurs sur le même élément — le défaut qui casse un écran sans rien dire (2026-09)

Sur l'écran des **affectations KAM**, les cartes n'affichaient plus que des rangs « P1 / P2 / P3 »
flottant à côté de rien : **le nom du produit avait disparu**, et l'on ne savait plus qui portait
quoi — sur téléphone surtout. La cause n'était ni une donnée manquante ni un droit :

```ts
const inputCls = "h-8 w-full …";
<input className={`${inputCls} w-16`} />
```

On lit « la dernière classe écrite gagne ». **C'est faux** : le navigateur applique la dernière
RÈGLE de la feuille, et Tailwind y émet `w-full` APRÈS `w-16`. Le champ prenait donc toute la
ligne et écrasait son voisin — le nom, en `flex-1 truncate`, donc **réductible à zéro**. Ni le
typage, ni le lint, ni le build ne disaient rien : l'écran s'affichait, il ne disait simplement
plus ce qu'il devait dire. C'est le pire genre de panne, celle qu'on impute à la donnée.

La largeur est **sortie des constantes de style**, les contrôles **passent à la ligne** au lieu
d'écraser le nom (qui porte désormais une largeur plancher), et une **légende** dit enfin ce que
pèsent P1/P2/P3 — les poids étant lus dans les réglages du cycle, pas écrits en dur.

**Le garde qui va avec** (`src/lib/ui/class-collision.test.ts`) balaie tous les `.tsx` et refuse
qu'une constante de classes et son suffixe se disputent la largeur ou la hauteur. Il a trouvé
**deux autres occurrences vivantes** du même défaut dès sa première exécution (`pch/[id]/
tender-lines.tsx` : la quantité vendue poussait à elle seule la référence et le bouton au rang
suivant). Il suit les constantes composées — sans quoi il deviendrait aveugle au fichier qu'il
vient de faire réparer. Sa règle est **étroite exprès** : `min-w-`, `max-w-` et les variantes
conditionnelles (`sm:w-…`) ne sont pas signalées, parce qu'un garde qu'on désactive à la première
fausse alerte ne garde rien.

**Au passage** : les trois boutons de l'en-tête de **Mon espace** — « Nouvelle tâche »,
« Demander une formation », « Ajouter une note de frais » — étaient en deux tailles (une `md`,
deux `sm`). Trois gestes du même rang, trois hauteurs et deux tailles de texte : on lit une
hiérarchie qui n'existe pas. Ils partagent désormais la même taille ; l'accent de couleur reste
sur « Nouvelle tâche », qui est l'action principale de l'écran.

### La note de frais devient un objet, et le menu cesse de mentir (2026-09)

**Le montant sort du texte.** Il vivait dans le motif — « 4 200 DZD — taxi et péage, PCH Alger du
12/09 ». Un montant noyé dans une phrase ne s'additionne pas, ne se compare pas, ne se contrôle
pas : les RH relisaient chaque ligne pour savoir ce qu'on leur demandait de rembourser, et un
chiffre mal recopié ne se voyait nulle part. **Chaque note porte désormais SON montant et SA
pièce** — le justificatif est exigé côté serveur (sans lui, ce n'est pas une demande, c'est une
affirmation), et deux dépenses sans rapport font deux notes, ce qui permet de les instruire
séparément. Zéro est refusé : c'est un champ qu'on a sauté, pas un montant.

**Le scan, plus l'appareil photo.** Le champ ouvrait la caméra directement (`capture`) : on
photographiait de travers, à la lumière du bureau, et les RH renvoyaient. Sans cet attribut, le
téléphone propose son propre sélecteur, où « Numériser un document » redresse la page, la recadre
et rend un PDF lisible ; l'appareil photo y reste disponible. **On ne perd aucun geste, on cesse
d'en imposer un mauvais.**

**Quinze minutes pour se relire.** On envoie, on relit, on voit qu'on s'est trompé d'un chiffre.
Sans cette fenêtre il fallait annuler et refaire : deux demandes dans l'historique, dont une
morte, et des RH qui devinent laquelle fait foi. C'est **la même demande qui change** — elle garde
son identité, ses pièces, son fil et sa place dans l'historique — et l'ancien montant part à
l'audit. Passé le délai, **les RH rouvrent** : « votre reçu est illisible, corrigez » n'a aucun
sens si la personne ne peut plus rien changer. La réouverture **prime sur l'horloge** et **se
consomme** (« corrigez cette fois », pas « quand vous voulez ») ; elle ne ressuscite jamais une
note tranchée — on ne réécrit pas ce sur quoi quelqu'un s'est prononcé.

**Et les RH réclament sans réécrire.** Un bouton « Demander un justificatif » ouvre une vraie
demande de pièce (`DocumentRequest`, le mécanisme générique — §118-5), adressée **au demandeur et
à personne d'autre** : le reçu d'un taxi est chez celui qui l'a pris, et proposer un annuaire
ferait réclamer la pièce d'une personne à une autre. Elle apparaît dans ses pièces à fournir, avec
sa référence et son échéance. Pour une simple explication, le fil d'échange de la demande sert
déjà. **Les RH ne corrigent jamais le montant eux-mêmes** : ce chiffre est la parole du demandeur.

**Le menu cessait de dire la vérité sur les droits.** Deux comptes BLOQUÉS sur les Moyens généraux
dans la console voyaient toujours l'entrée à gauche : elle était portée par `WORKSPACE` — que tout
le monde a — du temps où la page servait aussi à demander un achat. Les demandes ont déménagé dans
« Mon espace », la page refuse l'entrée sans `GENERAL_MEANS`, et le menu promettait donc un écran
qui répond « ce n'est pas pour vous ». Le coût réel n'est pas la porte inutile : **c'est que la
console paraissait ne pas marcher**, et qu'on cesse alors de s'en servir. L'entrée porte
maintenant le même module que sa page.

- **Pur & testé** : `lib/hr/expense-claim.ts` (fenêtre, réouverture, montant — 12 tests).
- **Flux réel** : `lib/actions/note-de-frais-flow.test.ts` (17 tests) — la garde refuse depuis le
  serveur, et corriger ne crée JAMAIS une seconde ligne.
- **Migration** : `20261017090000_note_de_frais_montant_et_modification`.

### Six chantiers : note de frais, accès console, deux natures, DCI en double, tout l'arbre (2026-09)

**Une note de frais se dépose depuis Mon Espace, avec le reçu qu'on a dans la main.** Elle
n'existait que derrière une liste déroulante de douze types, dans « Mon dossier RH » — on y allait
pour une attestation, pas pour se faire rembourser un taxi. Le bouton n'invente RIEN : il appelle
la MÊME action (`requestHrDocument`) et écrit la MÊME demande `EXPENSE_REPORT` (§17). Deux entrées
de fichier derrière un seul champ `files` : l'appareil photo (`capture`) et le choix de fichiers —
une seule obligeait à photographier d'abord, retrouver l'image ensuite. Les ORIGINAUX restent à
déposer au secrétariat, et le formulaire le dit.

**Les Moyens généraux ne s'ouvrent plus tout seuls.** Le module s'accordait implicitement à
quiconque tenait les RH en écriture : la console affichait « Aucun accès » sur cette ligne, et la
personne l'avait quand même. Retirer le module depuis l'écran prévu pour cela ne changeait rien,
et il fallait connaître la ligne de code pour comprendre pourquoi. **Un droit qui ne se lit pas là
où on le règle n'est pas administrable.** La règle est supprimée ; ceux qui l'avaient par ce
détour le reçoivent d'un clic, et cette fois cela se VOIT. Même vérification faite sur la
**Promotion médicale** : aucune porte dérobée n'y existait, et les deux sens sont désormais tenus
par des tests partant de la vraie table d'overrides (`rbac-console-authority.test.ts`).

**Information médicale : deux natures à l'ouverture, plus trois.** Le PRIM choisissait entre trois
choses dont l'une n'était pas de même nature que les autres : « bon de versement » est ce qu'on
AJOUTE dans un dossier de matériel, pas ce qu'on ouvre. Le proposer produisait des dossiers vides
dont le bon n'attendait rien. Restent **MIP** et **demande de visa publicitaire** ; les dossiers
historiques en bon de versement sont reclassés en visa publicitaire — même circuit MATÉRIEL, donc
rien ne se perd. La nature reste RECONNUE en lecture : la retirer du décodeur ferait retomber un
dossier historique sur le circuit par défaut, c'est-à-dire lui faire perdre ses bons.

**Regulatory : une DCI déjà suivie se dit AVANT, pas après.** Rien n'empêchait d'ouvrir un second
dossier sur une molécule déjà suivie — deux historiques réglementaires parallèles, deux séries
d'étapes ANPP, et l'un des deux qui finit par vivre sa vie. On avertit sans interdire (un autre
dosage, une autre forme, un autre partenaire sont légitimes ; interdire ferait saisir le doublon
sous une DCI mal orthographiée, donc plus rapprochable du premier). La comparaison **trie les
molécules d'une association** : « A + B » et « B + A » sont la même DCI. Et surtout, un dossier
VERROUILLÉ au pipeline **se compte sans se nommer**, avec le geste qui débloque — « demandez
l'accès », une notification à la supervision Regulatory, aucun registre de plus (§118-5).

**Mon Équipe descend jusqu'en bas.** L'écran s'arrêtait aux N-1 : pour un directeur, quatre cartes
qui cachaient quarante personnes. L'arbre entier s'affiche, chaque rang indenté, chacun portant son
N+1 — et **ce qui attend ma décision reste au premier rang**, parce que le congé d'un N-2 est routé
vers SON N+1. On déplie une carte, on obtient **les indicateurs de son métier** : visites et
comptes rendus manquants pour le terrain, dossiers et retards pour le réglementaire, dossiers à
instruire pour le PRIM, courses et hors-délai pour la coordination — et un métier sans compteur
propre le DIT au lieu d'afficher une colonne de zéros. La porte n'est pas un module (tout le monde
a « Mon Équipe ») : c'est **la hiérarchie**, vérifiée côté serveur.

- **Purs & testés** : `lib/regulatory/dci-duplicate.ts` (8 tests), `lib/hr/team-tree.ts`
  (10 tests), `lib/hr/team-kpis.ts` (11 tests).
- **Flux réels** : `lib/actions/dci-doublon-flow.test.ts` (8), `lib/actions/mon-equipe-flow.test.ts`
  (8), `lib/rbac-console-authority.test.ts` (4).
- **Migration** : `20261016090000_information_medicale_deux_natures`.

### Un ordre de dépense, un dossier — d'où qu'il vienne (2026-09)

Le libellé d'un matériel promotionnel n'était pas cliquable dans « Paiements à faire », et ce
n'était pas un défaut d'affichage : **le dossier n'existait pas**. Seul un ordre né d'une DEMANDE
DE PAIEMENT en portait un ; un ordre né d'ailleurs — promo, bon de versement, sponsoring, congrès,
Regulatory, secrétariat — arrivait dans la même file, pour le même argent, avec du texte mort.

**Tout ordre ouvre son dossier à sa naissance**, dans `createExpenseOrder` — le seul endroit par
lequel les treize circuits passent. Un compagnon n'est PAS une seconde décision : `origin =
EXPENSE_ORDER` retire le « bon à payer », et le serveur refuse aussi de trancher, transmettre ou
retirer (§118-7). Reprise SQL des ordres déjà émis (id dérivé `pcomp_`, idempotent), rejouée sur
données réelles par `lib/finance/dossier-reprise.test.ts`. Un ordre sans demandeur est laissé de
côté : inventer un demandeur porterait à l'audit le nom de quelqu'un qui n'a rien demandé.

**Finances « À régler » — deux gestes.** « Demander une pièce » et le dépôt de facture ont déménagé
dans le dossier ; la facture redevient un ÉTAT qu'on lit. **Côté demandeur** : relancer, ou
signaler une urgence — deux gestes distincts (une file où tout est urgent n'a plus de priorité),
motif exigé sur l'urgence, délai d'une heure. **Budget non défini** : on CLASSE avant de payer,
sauf s'il n'existe aucune catégorie — exiger un choix dans une liste vide est une impasse.

Modules purs `finance/dossier-auto.ts`, `finance/settle-budget.ts` · flux `companion-dossier-flow`.

### Une pièce réclamée qui engage la société rejoint Legal (2026-09)

La demande de pièce DIT SA NATURE ; l'acceptation classe facture, bon de commande, devis et contrat
dans le registre des engagements. À L'ACCEPTATION et non au dépôt — une facture refusée y resterait
comme un engagement. **Les lecteurs suivent** (un document Legal sans lecteur est visible de tout
le module) et **le fichier déménage** : un fichier, un seul domicile. `lib/legal/from-piece.ts`.

### Regulatory : « Dossier reçu » se constate, et l'export propose l'autre volet (2026-09)

Colonne **Yes / No non modifiable** : elle répond au FAIT — une archive CTD téléversée — et non à
ce que quelqu'un pense. Une case à cocher aurait dérivé dès le premier « je coche en attendant
l'envoi promis ». Elle sort aussi au classeur. **Exports croisés** : le suivi et le pipeline
montrent les mêmes objets sous deux angles, l'export DEMANDE désormais s'il faut inclure l'autre.
`lib/regulatory/dossier-received.ts`.

