# ADAM LATENCE COGNITIVE — audit, chantier, mesures

> Objectif : très peu d'appels IA, indépendants et parallèles, un maximum de travail
> déterministe, un contexte déjà préparé — le raisonnement IA seulement là où il apporte
> quelque chose. Rien n'est économisé au détriment de la qualité : le système minimise les
> appels SOUS CONTRAINTE de qualité, de preuve et de politique.

Document vivant. États : GAP / IMPLEMENTED / WIRED / TESTED / PROVEN — PROVEN seulement
après un run réel Render.

---

## A. AUDIT (§4) — le graphe d'appels modèle RÉEL

### Le point de départ mesuré (smoke Render n° 6, 2026-08-28)

Total 174,7 s · 13 appels modèle · ~49 k jetons d'entrée · ~99 % du temps en attente
modèle · **aucun chevauchement entre appels** (mesuré par `RaisonneurInstrumente`, pas
affirmé). Le hors-modèle (base + outils + moteur) : < 1 %.

### Les CINQ sites d'appel modèle du Mission Runtime

| Site | Purpose | Quand | Dépendance réelle |
|---|---|---|---|
| `planner/plan.ts#planifier` | `mission.plan` | `lancerMission` (initial) ; reprise sur refus du compilateur ; `replanifierMission` (refus du juge / recours épuisé) | Rien (initial) ; le refus (reprise/replan) |
| `runtime/worker.ts` | `mission.worker` | Chaque étape WORKER prête | Ses `dependsOn` |
| `goal/judge.ts` | `mission.judge` | `conclure`, quand toutes les étapes sont finies | Toutes les étapes |
| `artifacts/build.ts` | `mission.artifact` | Chaque étape ARTIFACT | Ses `dependsOn` |
| `memory/compactor.ts` | compaction | Battement (HORS chemin critique) | — |

### Le graphe AVANT — scénario PREUVE_ABSENCE du run 6 (44,2 s, 4 appels)

| seq | purpose | modèle (rôle) | durée | jetons e/s | schéma | analyse |
|---|---|---|---|---|---|---|
| 3 | mission.plan | COMPLEX_PLANNER | 22,0 s | 5 547/2 183 | 13 375 c | **couldReplaceByCode : OUI** — recherche multi-sources lecture seule d'un terme cité : intent, entité, sources, plafond et sortie sont tous connus du logiciel |
| 4 | mission.worker | PRIMARY_REASONER | 4,8 s | 2 200/406 | 746 c | NÉCESSAIRE — le seul vrai raisonnement (la synthèse) |
| 5 | mission.judge | PRIMARY_REASONER | 8,9 s | 1 983/757 | 1 459 c | **couldReplaceByCode : OUI** — les critères (« recherches exécutées avec la chaîne exacte », « aucune écriture ») sont vérifiables par les REÇUS structurés |
| 6 | mission.plan (replan) | COMPLEX_PLANNER | 7,9 s | 5 718/526 | 13 375 c | **couldEliminate : OUI** — le replan n'a RIEN rendu (« aucune étape exploitable ») : 7,9 s payées pour découvrir qu'aucune action nouvelle n'existait |

Les 4 étapes de CAPACITÉ (recherches) ont coûté ~0 ms chacune (fabric) et ont tourné dans
la même vague. `couldParallelize` entre appels MODÈLE : non applicable ici (un seul worker) —
le séquentiel est STRUCTUREL entre phases (plan → étapes → juge → replan), pas intra-vague :
l'ordonnanceur a déjà une classe MODELE avec plafond par échelle (`limitesDe`), et
`enParallele` exécute une vague entière de front.

### Données répétées entre prompts

Le schéma de plan (13 375 caractères) et le catalogue résumé partent DEUX fois quand le
compilateur ou le juge refuse. Le chemin direct supprime les deux envois d'un coup pour les
formes reconnues ; pour le reste, `promptCacheKey: mission:<purpose>` amortit déjà côté
fournisseur.

### Le direct path EXISTANT (audité, §6)

`planner/direct.ts#cheminDirect` : triage DIRECT + UNE capacité dominante + lecture NUE
(`list_`/`read_`/`_overview`, zéro paramètre) + effet ≤ ANALYZE. Quatre demandes sur huit
passent sur le catalogue réel. Il EXCLUT volontairement `search_` : « fabriquer une requête à
partir d'une phrase française, c'est deviner ». **Ce qui a changé : l'Information Fabric rend
la requête NON devinée** — un terme « entre guillemets » dans la demande est la requête,
verbatim ; les sources sont déclarées au registre ; le plafond d'effet est porté par le
catalogue. Les verrous restent, le périmètre s'élargit.

### Ce que le modèle n'a plus à faire (§5)

| Décision | Avant | Après |
|---|---|---|
| Où chercher (multi-sources connue) | mission.plan (22 s) | plan direct compilé (0 appel) |
| « Les recherches ont-elles porté la chaîne exacte ? » | mission.judge | règle sur les reçus (`query`) |
| « Aucune écriture n'a eu lieu ? » | mission.judge | règle sur les reçus (`effect`) |
| « La conclusion existe-t-elle, structurée ? » | mission.judge | règle sur la sortie schématisée du worker |
| Replanifier quand rien de neuf n'est possible | mission.plan (7,9 s jetées) | porte déterministe avant le replan |

---

## B. CHANTIER — tranches et état

| Tranche | Contenu | État |
|---|---|---|
| **L1 — Chemin direct multi-sources** | `cheminDirectRecherche` (planner/direct.ts) : cinq verrous R1–R5 (terme CITÉ unique — jamais deviné ; intention explicite ; lecture seule PROUVÉE par plafond ou phrase, négations retirées avant de chercher les verbes d'effet ; ≥ 2 familles visées, aucun ordre imposé ; ≥ 2 capacités `search_*` ouvertes) → plan : N recherches PARALLÈLES `{query: terme}` + jonction + UN worker à sortie schématisée, critères `[REGLE:…]`. Compilé par le MÊME compilateur (testé). L'énoncé RÉEL de PREUVE_ABSENCE passe ; l'arbitrage sans terme et la stratégie imposée restent au planificateur (testé). | **TESTED** |
| **L2 — Juge hybride** | `goal/rules.ts` : grammaire STRICTE `[REGLE:CODE:args]` (code inconnu → sémantique, jamais deviné) ; RECHERCHES_AVEC_REQUETE / AUCUNE_ECRITURE / SORTIE_STRUCTUREE vérifiées sur les reçus. `evaluerObjectif` : un FAIL refuse SANS modèle (étape nommée) ; tout-PASS sans sémantique → conclusion SANS juge (avisModele null, preuves citées) ; mixte → le juge ne reçoit QUE le sémantique. Prouvé par ESPION (0 appel) + dans le moteur COMPLET (mission COMPLETED, `mission.judge` jamais émis). | **TESTED** |
| **L3 — Discipline de replan** | Le `suggestedRecovery` du juge VOYAGE (port → verdict → journal GOAL_UNSATISFIED). Porte dans `replanifierMission` : toutes étapes abouties ET dernier refus portant `recoursSuggere: null` (présent) → refus SANS appel, journalisé REPLAN_SKIPPED. Signal ABSENT → porte OUVERTE (§78). 3 tests DB par le vrai point d'entrée. | **TESTED** |
| **L4 — Métriques §18** | Cascade enrichie : `voiePlan` (DIRECTE = 0 planificateur), `sommeDureesAppelsMs` vs union → FACTEUR DE PARALLÉLISME, `appelsChevauchants`, `premierResultatUtileMs` (premier STEP_DONE). Résumé du smoke : `bypass planificateur X/Y scénarios planifiés par le CODE`. | **TESTED** (chiffres réels au prochain run Render) |
| **L5 — Sabotages §22** | (1) chemin direct coupé (`sansCheminDirect`) → l'espion-planificateur est payé, voie DIRECTE = 0 appel ; (2) partition débranchée → l'espion-juge se déclenche (test « tout-règles ») ; (3) plafond MODELE forcé à 1 → le chevauchement de deux workers disparaît (banc `parallel-workers`) ; (4) porte replan : signal absent → planificateur bien appelé. | **TESTED** |

## C. CIBLES (§20) — à PROUVER sur Render, jamais localement

| Mission | Appels modèle | Cible |
|---|---|---|
| PREUVE_ABSENCE-like (recherche multi-sources) | 4 → **1** (worker seul) | < 8 s |
| SATISFIABLE (point + synthèse) | 3 → 2 (plan LLM si non reconnu + worker, juge selon critères) | < 15 s |
| RECOURS (stratégie réelle) | inchangé dans sa nature (le planner y a sa place) | — |
| Smoke complet | 13 → ~5-7 | < 60 s (contre 175 s) — l'idéal § 20 (< 15 s) exige AUSSI des modèles plus rapides sur les appels restants ; dit, pas promis |

---

## D. RAPPORT FINAL (§29) — état au 2026-08-29, AVANT le run réel

**A. Graphe AVANT.** Section A : PREUVE_ABSENCE = plan (22,0 s) → worker (4,8 s) → judge
(8,9 s) → replan (7,9 s, rien rendu) — 4 appels, 43,7 s de modèle, 0 chevauchement.

**B. Graphe APRÈS (structurel, à confirmer par le run).** PREUVE_ABSENCE = plan DIRECT
(0 appel, ~ms) → 4 recherches PARALLÈLES (fabric, ~ms) → worker (le seul appel) → juge de
RÈGLES (0 appel) → 0 replan. Un appel de modèle au lieu de quatre.

**C. Nombre d'appels.** Scénario PREUVE_ABSENCE : 4 → 1 (structurel, testé sur la chaîne
complète locale). Smoke entier : 13 → attendu ~5-7 (SATISFIABLE garde son plan LLM tant que
« fais le point + arbitrage » n'est pas une forme directe — décision : l'arbitrage se
raisonne ; RECOURS garde planner + recours réels).

**D. Planner.** 2 appels → 0 sur la forme reconnue (voie DIRECTE mesurée par
`plannerBypass`). La reprise sur refus du compilateur reste (1 seule, comme avant).

**E. Workers.** Inchangés en nombre — c'est le raisonnement UTILE. Prouvé PARALLÈLES dans
une même vague (banc d'overlap), plafond par échelle respecté.

**F. Judges.** 1 → 0 quand tous les critères sont des règles ; sinon 1 appel au contexte
RÉDUIT (critères sémantiques seuls). Refus déterministe sans appel sur règle cassée.

**G. Appels parallèles.** `appelsChevauchants`/`facteur` désormais MESURÉS par cascade ;
localement : 2 workers d'une vague se recouvrent (200 ms de délai injecté, mécanisme prouvé,
latence réelle à mesurer sur Render).

**H. Tokens.** Plan direct : −11 265 jetons d'entrée et −13 375 caractères de schéma sur le
scénario mesuré (les deux appels planner disparaissent) ; juge de règles : −1 983 entrée.
Chiffres du run 6 ; l'après se lit dans la cascade du prochain run.

**I. Temps modèle.** PREUVE_ABSENCE : 43,7 s → attendu ~5 s (le seul worker). À MESURER.

**J. Wall-clock.** 44,2 s → attendu < 8 s sur ce scénario. À MESURER (§21 : rien n'est
affirmé avant le run).

**K. Critical path.** Pour une mission du runtime, le chemin critique EST l'horloge murale :
les phases sont strictement ordonnées (plan → vagues → conclusion) et la cascade impute
chaque phase. Le levier n'est pas de « paralléliser les phases » mais d'en SUPPRIMER
(plan direct, juge de règles, porte de replan) et de paralléliser DANS la vague — les deux
sont faits et mesurés par `sommeDureesAppelsMs` vs union.

**L. Planner bypass rate.** Mesuré et affiché par le smoke (« bypass planificateur X/Y »).
Local : PREUVE_ABSENCE passe en DIRECTE ; les deux autres scénarios restent au planner —
attendu 1/3 sur le smoke actuel, et c'est le BON chiffre (les deux autres ont besoin d'un
planner ou d'un arbitrage).

**M. Replans.** Le replan « rien à proposer » du run 6 est fermé par la porte (0 appel,
REPLAN_SKIPPED journalisé). Les replans UTILES (étapes épuisées, recours du juge) restent.

**N. Time-to-first-result.** `premierResultatUtileMs` (premier STEP_DONE) désormais dans
chaque cascade. Sur la forme directe, les recherches partent immédiatement : attendu < 1 s.

**O. Time-to-final-answer.** = totalMs de la cascade, inchangé dans sa définition, réduit
par la suppression des phases.

**P. Benchmarks P50/P95/P99.** Le smoke est UN run par scénario (pas de percentiles — les
percentiles sur n=1 seraient du déguisement) ; les percentiles vivent dans `fabric:bench`
pour la donnée et viendront d'une répétition du smoke pour le bout-en-bout. Dit, pas simulé.

**Q. Qualité.** RIEN n'a été affaibli : le plan direct passe le MÊME compilateur ; la
vérification est PLUS forte (reçus structurés au lieu d'une prose de juge) ; le worker garde
son rôle de raisonnement ; les critères sémantiques gardent leur juge LLM ; QA et Goal
Satisfaction intacts (le juge de règles est un juge, arithmétique, dernier mot négatif
inclus). Les 5 200+ tests passent inchangés — dont les 35 d'`evaluate` antérieurs.

**R. Sabotages.** Les quatre de §22 réalisables localement sont STRUCTURELS (voir L5) :
chacun est un test qui tombe si on débranche la propriété.

**S. Ce qui reste impossible < 10 s, et pourquoi.** (1) Toute mission dont le PLAN doit être
raisonné (RECOURS, objectifs ambigus) paie ≥ 1 appel planner ≈ 8-22 s avec le modèle
actuel — irréductible sans changer de modèle ou de rôle ; (2) les critères sémantiques
paient un juge ; (3) les écritures paient l'approbation HUMAINE (et c'est voulu). Le levier
suivant est le ROUTAGE de modèles (§11) : un planner sur un modèle plus rapide pour les
formes moyennes — non fait ici, mesure d'abord.

**T. État.** L1–L5 : TESTED. PROVEN : AUCUNE tranche — attend le run réel (§28).
