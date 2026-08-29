# ADAM PERFORMANCE — le chantier « vitesse comme propriété du software »

Document vivant. États : GAP / IMPLEMENTED / WIRED / TESTED / PROVEN — PROVEN seulement
après un run réel sur Render avec le vrai fournisseur. Baseline : le Deep Live Smoke du
2026-08-29 (54 missions réelles, jeton MTEAQWBD0QSS) — 20 SUCCÈS, 32 CONCLUSIONS HONNÊTES,
2 DÉFAUTS, 12 DIRECTES, 34 replans, 220 appels modèle, 642 s à concurrence 3.

## A. LES DÉFAUTS DU RUN, CAUSE RACINE UN PAR UN (§0)

### A1. Storage HTTP 402 — le défaut n° 1, et il contamine le reste

**Constat.** Des dizaines de `read_document failed … Lecture de l'objet échouée (402)`,
les MÊMES blobs relus en boucle. 402 = *Payment Required* : le fournisseur de stockage
objet refuse de servir — **quota/facturation épuisés côté fournisseur**. Ce n'est ni un
bug de code ni une panne transitoire.

**Cause racine dans NOTRE code.** `runner.ts#lire` classait toute exception en
`CAPABILITY_FAILURE, retryable: true` : le moteur retentait 3× chaque lecture, l'échelle
de recours retentait encore, et chaque replan relisait le même blob. Le raisonnement
« réparait » une panne de FACTURATION — l'anti-motif exact de §28.

**Corrigé (TESTED).** `classerEchecLecture` (runner.ts) : 402/vocabulaire de facturation
et 401/403 → `PROVIDER_FAILURE` **non-retryable**, 404 objet → `MISSING_DOCUMENT`
non-retryable — classement VOLONTAIREMENT étroit (le message exact du stockage ; dans le
doute, on retente). Plus un **court-circuit** par cible (TTL 10 min, borné à 300 entrées) :
un refus durable constaté ne se re-paye jamais en HTTP, et le reçu DIT « COURT-CIRCUIT —
échec durable déjà constaté ». Sabotage inverse épinglé : un échec transitoire (réseau)
reste retryable et n'est JAMAIS court-circuité (`runner-failure.test.ts`, 8 tests).

**Action humaine requise (le code ne peut pas payer une facture).** Vérifier la
facturation/le quota du stockage objet (bucket S3 du service) — tant qu'il répond 402,
tout contenu de document est illisible pour TOUT le monde, pas seulement pour Adam ; les
missions le diront désormais en une tentative, preuve à l'appui.

### A2. RECOURS_SOURCES — « budget de tours épuisé (8) sans état stable »

Ce n'est PAS le point fixe du run précédent (corrigé, `bypassed-dependency.test.ts`) : la
mission changeait d'état à chaque tour sans converger. Le moteur de la boucle : les
lectures 402 « retryables » relançaient tentatives, recours et replans. Avec A1, chaque
branche 402 meurt en UNE tentative avec une preuve claire → convergence vers BLOCKED
stable ou conclusion. À re-mesurer au prochain run (attendu corrigé par A1).

### A3. TACHES — « Le plan rendu ne contient aucune étape exploitable »

Le planificateur n'a RIEN rendu pour « Où en est la tâche « printing doc ready kwality et
prep dossi » ? » — un titre réel, bruité, dont le modèle n'a pas su faire un plan. Corrigé
STRUCTURELLEMENT : ce n'est plus le modèle qui planifie cette forme (voir C1 — la FICHE).
Le cas exact du run est épinglé en test : il compile désormais sans appel de planificateur.

## B. LES 32 « CONCLUSIONS HONNÊTES » — MÉTIER RÉEL OU DÉFAUT TECHNIQUE ? (§0)

Classification mission par mission (JSON du run) :

| Groupe | n | Classe | Cause racine |
|---|---|---|---|
| WAITING_INPUT (5× DOCUMENT_DRIVE, 1× LEGAL, 1× FINANCES) | 7 | **B — TECHNIQUE** | Le contenu était illisible (402) ; l'échelle de recours a fini par DEMANDER_HUMAIN. La question était répondable, le stockage a refusé. |
| BLOCKED sur DOCUMENT_DRIVE / LEGAL (lectures de contenu) | 6 | **B — TECHNIQUE** | Même cause : critères « sans preuve » parce que la preuve était un blob en 402. |
| BLOCKED « N critère(s) sans preuve » puis replan VIDE (SYNTHESE, POINT_DOSSIER, HISTORIQUE ×2, POINT_EMPLOYE ×4, RH ×2, TACHES ×2, DEPARTEMENTS, CATCH_UP, AGREGATION, COMPARAISON, COURRIERS, FINANCES ×2) | 19 | **B — CONTRAT PLANNER↔JUGE** | Le modèle rédige des critères d'EXHAUSTIVITÉ improuvables (« tous les X identifiables sont listés ») que ses propres étapes ne peuvent pas démontrer ; le juge refuse (correctement, §10), le replan ne trouve rien à ajouter, la mission conclut BLOCKED alors que le travail est fait. |
| A — HONNÊTE MÉTIER (les données n'existent réellement pas) | 0 | **A** | Aucun cas certain dans ce run — le constat honnête est que ces 32 arrêts étaient presque tous ÉVITABLES. |

**Traitement.** Le groupe 1-2 est traité par A1. Le groupe 3 est attaqué par DEUX voies :
(i) la FICHE (C1) retire ces genres au planificateur quand la forme est connue ;
(ii) l'orientation des critères (C2) : le schéma du planificateur documente désormais la
grammaire `[REGLE:…]` vérifiée sur les reçus — un critère-règle ne peut pas rester « sans
preuve », et un critère libre ne doit JAMAIS exiger ce que les étapes ne prouvent pas.

## C. CE QUE CE LOT LIVRE

### C1. La FICHE — 3ᵉ forme du chemin direct (OBJECTIF 1, §1) — TESTED

Généralisation NATIVE, pas 80 workflows à la main : la forme se déclenche sur la STRUCTURE
de la demande (un terme cité « … », une intention de consultation, 1-2 familles nommées,
lecture seule prouvée, pas de demande de profondeur) et ses capacités viennent du CATALOGUE
réel (les recherches fédérées + celles dont la fiche catalogue croise la famille nommée —
une nouvelle capacité `search_*` correctement déclarée enrichit la forme sans toucher au
routeur). Plan compilé : N recherches PARALLÈLES (`query` = terme verbatim) + jonction +
synthèse schématisée. Critères : 3 RÈGLES sur les reçus + **1 critère SÉMANTIQUE gardé
par le juge** — c'est le prix de la qualité sur une question ouverte (la règle ultime), et
il reste ~5× moins cher que le chemin planifié qu'il remplace (~8-15 s et 2 appels, contre
20-104 s et 4-12 appels mesurés au Deep Smoke). Verrous F1-F6, le doute renonce toujours ;
7 tests dont les énoncés RÉELS du run (TACHES, COURRIER) et 2 sabotages (multi-sources sans
couverture ne retombe pas en fiche ; famille sans capacité renonce).

**Portée attendue sur les 54 missions du run** (comptée sur les énoncés réels) : TACHES ×3,
COURRIERS ×5, LEGAL ×4, FINANCES ×5, DOCUMENT_DRIVE ×5 passent en voie directe → DIRECTE
attendue ~30/54 (56 %) contre 12/54, chaque bascule économisant 2 à 12 appels de modèle.
POINT_DOSSIER (« quelles étapes restent ») et HISTORIQUE renoncent VOLONTAIREMENT (F5) :
leur qualité exige des lectures profondes — répondre plus vite mais moins bien est interdit.

### C2. Orientation des critères du planificateur vers `[REGLE:…]` (§14) — WIRED

Le schéma `acceptanceCriteria` documente la grammaire des règles (RECHERCHES_AVEC_REQUETE,
AUCUNE_ECRITURE, SORTIE_STRUCTUREE) et interdit d'exiger ce que les étapes ne prouvent pas.
La contrainte est tenue par le LOGICIEL en aval : un code de règle connu se vérifie sur les
reçus (il ne peut pas rester « sans preuve »), un code inconnu redevient un critère
sémantique jugé (`rules.ts`, dégradation sûre), et un refus déterministe laisse la porte de
replan OUVERTE (clé absente ≠ null, §78). Effet mesurable au prochain run : replans ↓,
appels de juge ↓ sur les plans de modèle. État WIRED — l'effet se mesure, il ne s'affirme pas.

### C3. Le mode PALIERS du Deep Smoke (§29-30) — TESTED

`DEEP_SMOKE_PALIERS="3,5,10"` joue les missions par lots à concurrence croissante. Chaque
palier MESURE (succès/honnêtes/défauts, P50/P95, missions/min) ; l'escalade s'arrête
d'elle-même si les défauts montent ou si le P95 fait plus que doubler, et le reste se joue
à la dernière concurrence SAINE — jamais 40 requêtes aveugles (§35). Le rapport imprime la
« concurrence retenue » : le maximum SOUTENABLE observé, pas un chiffre supposé. Règle
d'escalade pure, 4 tests (dont : un P95 non mesuré n'est pas un signal, §78).

### C4. Rappels du lot précédent, déjà en place et concernés par ce run

Point fixe des dépendances contournées : CORRIGÉ (`engine.ts#etapesPretes` +
`bypassed-dependency.test.ts`). Cascade §18 (voie du plan, premier résultat utile, facteur
de parallélisme) : en production. Porte de replan « aucun recours » : en production.

## D. LE RESTE DU MANDAT — ÉTAT HONNÊTE PAR CHANTIER

| § | Chantier | État | Note |
|---|---|---|---|
| §2 | Validated Plan Patterns (réutiliser les plans validés) | **GAP** | Le prochain gros levier après la FICHE : empreinte {intention, types d'entités, familles de sources, plafond d'effet, version du catalogue} → squelette recompilé (jamais rejoué aveuglément). `OperationalTemplate` (OBSERVED→CANDIDATE→APPROVED) est la fondation naturelle. |
| §4 | Attribution fine de la latence planner (TTFT, files, retries) | **GAP** | La cascade attribue déjà par appel (durée, jetons, réflexion, schéma 11 993 c) ; TTFT et files fournisseur exigent d'instrumenter la passerelle. |
| §5 | Le planner hors du chemin critique (retrieval spéculatif) | **GAP** | La fabric sert en ms — lancer résolution d'entités + recherches sûres PENDANT la planification est le 2ᵉ gros levier. Sans effet, réversible, borné par le scope. |
| §6-7 | Plan IR compact + schéma planner réduit | **GAP** | Mesuré : 11 993 c de schéma et ~5 400 c de résumés par appel, ~2 000-5 000 jetons de sortie. Réduction à MESURER sans perdre l'expressivité. |
| §8-9 | Prompt caching explicite (prefix stable, cached_tokens mesurés) | **GAP** | Exige la passerelle : ordonner prefix stable → contenu dynamique, capter `cached_tokens`. Ne se déclare pas : se mesure. |
| §10-13 | Fast planner + escalade (Luna d'abord, Terra sur échec) | **GAP** | La cascade fournit déjà la mesure de qualité comparative (rôles par appel). À bencher, jamais en baisse silencieuse (§35). |
| §15-16 | Topologie MERGE vs PARALLEL vs SEQUENTIAL par famille | **PARTIEL** | Le parallélisme intra-vague existe (prouvé, plafond MODELE) ; le choix de topologie par famille reste à mesurer. |
| §18-27 | Adaptive Concurrency Controller natif (ressources, priorités, fairness) | **GAP** | Le mode PALIERS (C3) fournit la MESURE qui doit précéder le contrôleur : on ne règle pas un AIMD sans connaître les plafonds réels (429, pool DB, event loop). |
| §19-20 | Capture native des en-têtes rate-limit OpenAI + réservation de jetons | **GAP** | Exige la passerelle fournisseur ; à faire AVANT le contrôleur §21. |
| §23-24 | Budgets DB/CPU/RAM/event-loop mesurés | **GAP** | max_connections et pool Prisma à mesurer sur Render ; PgBouncer à auditer (LISTEN/NOTIFY, prepared statements) avant activation. |
| §31 | Critical path par mission (dbWait, storageWait, queueWait) | **PARTIEL** | totalMs / attente modèle / hors-modèle / premier résultat utile : en production. La décomposition fine reste à instrumenter. |
| §33 | Missions très complexes (100 branches, gros fanout) | **GAP** | Le moteur les porte (éventail, idempotence) ; le banc dédié reste à écrire. |

## E. CIBLES (§32) — BASELINE MESURÉE ET ATTENDU

| Mesure | Baseline (run réel) | Attendu après ce lot | Cible §32 |
|---|---|---|---|
| DÉFAUTS | 2 | 0 (A1+A3 corrigés, A2 dérivé de A1) | 0 |
| Voie DIRECTE | 12/54 (22 %) | ~30/54 (56 %) | >70-80 % |
| Replans | 34 | forte baisse (C1+C2 : les genres à replans passent en direct ou en critères-règles) | <5 |
| Appels modèle | 220 | ~120-140 attendus (chaque fiche : 12→2, 4→2…) | <80 puis <60 |
| P50 DIRECTE | 3,1 s | 3-4 s (fiches : 8-15 s avec juge) | 2-4 s |
| Deep Smoke 54 missions | 642 s à conc. 3 | à mesurer en mode paliers | <90 s puis <60 s |

Aucun de ces « attendus » n'est un résultat : ils se PROUVENT au prochain run (§38).

## G. LE DEUXIÈME RUN RÉEL (2026-08-29, jeton MTEFGJJBPEJR) — le lot 1 MESURÉ

| Mesure | Baseline | Run 2 (lot 1 déployé) | Verdict |
|---|---|---|---|
| DÉFAUTS | 2 | **0** | ✔ cible atteinte |
| Voie DIRECTE | 12/54 (22 %) | **30/54 (56 %)** | ✔ la prédiction exacte de C1 |
| Appels modèle | 220 | **186** | ↓ 15 % |
| Durée totale | 642 s | **477 s** | ↓ 26 % |
| Replanifications | 34 | **20** | ↓ 41 % |
| SUCCÈS | 20 | **15** | ✘ RÉGRESSION — voir D4/D5 |
| RECOURS_SOURCES | non stable | BLOCKED **stable**, 16 STEP_RECOVERY réels | ✔ A1/A2 corrigés |

Le smoke fournisseur du même déploiement : MISSION_E2E_PROVEN YES, PREUVE_ABSENCE 2,8 s —
et il a MONTRÉ que l'orientation des critères (C2) marche : le planificateur émet désormais
des `[REGLE:…]`. C'est précisément ce qui a révélé D4.

### D4. Collision grammaire ↔ clés d'étapes à deux-points — CORRIGÉ (lot 2)

SATISFIABLE : « Refus DÉTERMINISTE — [SORTIE_STRUCTUREE] étape « analyse » absente » alors
que l'étape s'appelle `analyse:priorisation` — l'argument `cle:champs` se découpait au
PREMIER deux-points, et les clés des plans de modèle en contiennent. Un FAUX refus
déterministe sur une mission dont le travail était fait. Deux correctifs :
`argsSortieStructuree` découpe au DERNIER deux-points (les champs n'en portent jamais), et
`validerReglesDacceptation` refuse À LA COMPILATION une règle citant une étape absente du
plan (clés disponibles nommées dans le refus — la retouche du planificateur existe déjà).
Épinglé par 5 tests, dont le cas exact du run et le refus du compilateur.

### D5. Les fiches directes jugées insuffisantes → BLOCKED honnête (SUCCÈS 20→15)

Les fiches (LEGAL, COURRIERS, FINANCES, DOCUMENT_DRIVE) passent en DIRECTE (~13-18 s,
3 appels) mais le juge REFUSE la synthèse et le replan rend un plan vide. Le garde-fou
qualité fait exactement son travail (la règle ultime) : une synthèse fondée sur des REÇUS DE
RECHERCHE ne peut pas répondre à « parties, dates, échéance » — il manque une LECTURE de
l'enregistrement trouvé. Hypothèse à CONFIRMER par la mesure : le rapport du Deep Smoke
affiche désormais les MOTIFS des conclusions honnêtes groupés + le verdict du juge par
mission (`verdictJuge` au JSON) — le prochain run nomme chaque cause. Le correctif de fond
(lot 3) : un étage de LECTURE dans la forme FICHE (lire l'enregistrement que les recherches
ont trouvé, par le mécanisme de collection existant), jamais un affaiblissement du juge.

## F. COMMANDES DU PROCHAIN RUN RÉEL (§38)

Dans le Shell Render, après déploiement — et après avoir réglé la facturation du stockage
objet (A1), sans quoi les lectures de contenu resteront illisibles (mais désormais en une
tentative, preuve à l'appui) :

    npm run adam:smoke:provider
    npm run adam:smoke:deep                     # comparaison directe avec la baseline
    DEEP_SMOKE_PALIERS="3,5,10" npm run adam:smoke:deep   # stress test adaptatif (§29)

PROVEN ne se marque qu'après ces runs.

## H. LE TROISIÈME RUN RÉEL (2026-08-29, jeton MTEL7Y9V0TX2) — ET LE CHANTIER DE CLÔTURE

Mesuré sur Render : **23 SUCCÈS / 29 honnêtes / 2 défauts** (baseline 20/32/2, run 2 15/39/0).
30/54 par la voie DIRECTE, 187 appels, 541 s, 16 replanifications, motifs désormais NOMMÉS.
Lu en taux : E2E 42,6 %, route MODÈLE 7/24 = 29,2 %, non-trivial 12/43 = 27,9 %, ~70 % des
appels de modèle payés sur des missions non réussies. C'est mieux, et ce n'est pas fini —
le mandat de clôture exige que CHAQUE non-succès ait une cause nommée et un correctif NATIF.

### H.1 L'audit des 31 non-succès — six familles de logiciel, pas 31 mystères

| # | Famille (missions touchées) | Symptôme au run | Cause racine | Correctif NATIF (fichier) | Tests + sabotage |
|---|---|---|---|---|---|
| F1 | Règle de requête LITTÉRALE (~8 : COMPARAISON branche B, RECOURS synonymes, HISTORIQUE produit du dossier, CATCH_UP, POINT_DOSSIER, LEGAL échéances) | « le reçu ne porte pas « X » » alors que la stratégie du plan était juste | La règle comparait chaque reçu au terme CITÉ dans le critère, pas à la requête PRÉVUE au plan pour CETTE étape | RECHERCHES_AVEC_REQUETE v2 : « exécuté = prévu » — la référence est `input.query` du plan, le terme « » n'est qu'un repli (`goal/rules.ts` ; `EtapeObservee.input` câblé dans `evaluate.ts`/`engine.ts`) | `rules.test.ts` : branche B PASS ; SABOTAGE : reçu ≠ requête prévue → FAIL même si le terme cité y est |
| F2 | Reçus des éventails/dédupliqués (~2) | « capacité aboutie SANS reçu — effet invérifiable » sur un parent déployé ou une étape DEDUPLIQUE | Deux aboutissements SANS appel écrits par le MOTEUR étaient comptés comme des appels sans preuve | AUCUNE_ECRITURE reconnaît `{expanded}` et `{deduplique:true}` ; RECHERCHES se prouve sur les FILLES d'un éventail (`goal/rules.ts`) | `rules.test.ts` : parent+dédupliqué PASS ; vraie capacité sans reçu → toujours FAIL (§78) |
| F3 | FICHE sans étage de lecture (~10 : POINT_EMPLOYE 0/6, DOCUMENT_DRIVE 1/6, LEGAL 1/5, COURRIERS, TACHES, FINANCES) | juge : « honnête mais insuffisant » — synthèses bâties sur des TITRES | DOUBLE : (a) pas de lecture des cibles ; (b) découvert au passage : le worker aval d'un éventail ou d'une jonction ne VOYAIT PAS les résultats (amont = dépendances directes ; parent d'éventail = `{expanded}` seul) | FICHE v2 : RECHERCHER → CIBLER (WORKER à schéma, ids RECOPIÉS) → LIRE (éventail `read_document`/`inspect_record`, repli recherche-seule si lecteur absent/interdit) → RÉPONDRE branché sur les lectures (`planner/direct.ts`) ; hydratation générique des éventails pour TOUT worker aval (`runtime/worker.ts` `hydraterEventail`) ; éventail de LECTURE partiellement échoué CONCLUT avec ses manques NOMMÉS (`engine.ts` `resoudreEventails`, §28) — une ÉCRITURE partielle échoue toujours | `direct.test.ts` (FICHE v2 ×5 dont compile réel), `worker.test.ts` (×4), `engine.test.ts` (lecture partielle DONE + écriture partielle FAILED) |
| F4 | Clés/références fragiles écrites par le modèle (2 échecs de LANCEMENT : « recherche:federée », « synthese » ; +3 « reste refusé ») | mission morte AVANT DE NAÎTRE, la retouche du planificateur REPRODUISAIT la faute | Une clé est un identifiant MACHINE ; refuser une faute de forme renvoyait la faute à son auteur | `assainirPlan` (NFD, alphabet, suffixes de collision, réécriture de dependsOn/forEach/règles) + `reparerReglesDacceptation` (réparer à candidat UNIQUE — doctrine CORRIGEE — sinon DÉCLASSER en sémantique, jamais refuser) (`compiler/compile.ts`, `goal/rules.ts`) ; **MISSION_CREATION = invariant 100 %** | `rules.test.ts` (réparation ×7), `compile.test.ts` ; SABOTAGE : deux clés IDENTIQUES restent DUPLICATE_KEY — l'assainissement ne blanchit pas une vraie faute |
| F5 | Replans vides (14×) | « le replan a rendu un plan vide », plafond atteint | En AVAL de F1-F4 : les faux refus déterministes déclenchaient des replans sans matière ; le refus « plan sans étape productive » et le plafond PLANS_MAX existaient déjà | Corrigée par les familles amont — aucune pièce nouvelle : en supprimer la cause vaut mieux qu'en traiter le symptôme | Le prochain run mesure `replans` à la carte §71 |
| F6 | Missions analytiques en WAITING_INPUT (3×) | la mission suspendait sa réponse… à CELUI qui posait la question | Le planificateur écrivait une étape WAIT_INPUT quand la donnée manquait — sous plafond de LECTURE, l'attente humaine est la mauvaise réponse (§28 : une absence DITE est une réponse) | Sous `effetMax ≤ ANALYZE`, le compilateur CONVERTIT l'attente humaine en synthèse « ce qui existe / ce qui manque », conversion dite en warning ; une mission qui ÉCRIT garde ses attentes (`compiler/compile.ts`) | `compile.test.ts` : conversion + contre-exemple (sans plafond, l'attente reste) |

Défaut ANNEXE découvert par les nouveaux bancs (aucun run ne l'avait encore payé) :
`read_document` passait le verrou « lecture nue » par son préfixe `read_` alors qu'il EXIGE un
nœud Drive — un plan à appel sans entrée pouvait naître. Fermé par le registre : un contrat
`CONTENU` n'est jamais nu (`planner/direct.ts` `estLectureNue`).

### H.2 La carte de score §71 — dans le banc lui-même

`carteDeScore` (deep-smoke.ts, pur, testé) : E2E, MISSION_CREATION (invariant 100 %),
COMPLETED, succès par VOIE (DIRECTE/MODÈLE, P50/P95 chacune), NON-TRIVIALES (hors
PREUVE_ABSENCE et RECHERCHE_PRODUIT — l'anti-triche : réussir surtout les questions faciles
ne gonfle plus le chiffre), replans (total/missions/max), **taux d'appels modèle GASPILLÉS**
(payés sur des missions non réussies), jetons par succès, latences, succès/minute. §78
partout : dénominateur nul → `null`, jamais 0 %. Rendue dans le rapport texte ET dans le JSON
machine (`carte`).

### H.3 États honnêtes (§69)

- **IMPLEMENTED + TESTED** (ce chantier, suite complète verte) : F1, F2, F3, F4, F6, carte
  §71, lecture-nue/CONTENU. PROVEN LIVE : **au prochain run réel uniquement.**
- **PROVEN par les runs précédents, intouchés** : court-circuit 402/403, formes DIRECTE /
  RECHERCHE, dépendances contournées, motifs d'honnêteté.
- **GAPs assumés, nommés, NON commencés** (§40-53 du mandat performance) : contrôleur de
  concurrence adaptative sur en-têtes fournisseur (`x-ratelimit-*`, `Retry-After`), réservation
  de jetons, registre de coûts par mission, prompt caching MESURÉ (`cached_tokens`), plans
  par gabarits validés, retrieval spéculatif, fine-tuning. Le mode PALIERS est l'instrument de
  mesure prêt pour le premier de ces chantiers ; la télémétrie fournisseur n'est pas accessible
  depuis cet environnement de dev — elle se lit sur Render.

### H.4 Ce qu'un humain doit encore faire

La FACTURATION DU STOCKAGE OBJET (402) reste une action humaine : tant qu'elle n'est pas
réglée, les lectures de CONTENU Drive échoueront — désormais en UNE tentative, court-circuit,
cause dite, et l'éventail de lecture CONCLUT en nommant ce manque au lieu de spiraler.
