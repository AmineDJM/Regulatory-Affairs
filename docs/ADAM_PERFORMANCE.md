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

## F. COMMANDES DU PROCHAIN RUN RÉEL (§38)

Dans le Shell Render, après déploiement — et après avoir réglé la facturation du stockage
objet (A1), sans quoi les lectures de contenu resteront illisibles (mais désormais en une
tentative, preuve à l'appui) :

    npm run adam:smoke:provider
    npm run adam:smoke:deep                     # comparaison directe avec la baseline
    DEEP_SMOKE_PALIERS="3,5,10" npm run adam:smoke:deep   # stress test adaptatif (§29)

PROVEN ne se marque qu'après ces runs.
