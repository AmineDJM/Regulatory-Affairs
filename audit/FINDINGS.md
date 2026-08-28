# AUDIT FRONTIER — constats, au commit 1ff570b

Instruments : `audit/reachability.ts` (par symbole), `audit/module-reach.ts` (par module).
Preuves brutes : `audit/baseline/`.

## Portée réellement exécutée

La majorité du protocole demandé est **inexécutable dans cet environnement** : aucune clé
fournisseur n'est présente (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY` absentes — vérifié sans
révéler de valeur). Tout ce qui exige un vrai appel de modèle — §3 planificateur naturel,
§4 découverte de capacité, §8-11 working set, §16-27 scénarios de mission, §36-39 mémoire à
l'échelle, §57-60 latence/jetons/outils, §77-83 scénarios Chief of Staff — reste NON PROUVÉ,
et aucun mock ne peut le remplacer.

Exécuté : §0 gel, §1-2 architecture et joignabilité, §61-63 (inspection statique des gardes),
§68 contention Postgres, §75-76 architecture et Graphify, §88 chaîne de vérification,
§89 sabotages (3), §105 fixtures de régression.

## Constat principal — trois modules du Mission Runtime ne sont pas branchés

Mesure au niveau MODULE (l'unité honnête : un symbole sans appelant direct peut être atteint
par un répartiteur exporté du même fichier — c'est le cas de `rendreDocx` via `rendre`) :

| Périmètre | modules | importés en prod | test-only | orphelins |
|---|---|---|---|---|
| `src/lib/missions` | 42 | 39 | **3** | 0 |
| `src/lib/artifact` | 21 | **21** | 0 | 0 |

Les trois test-only :

- `recovery/strategy.ts` — les douze causes d'échec, l'échelle de recours, `estFinPossible`,
  et l'échelle épistémique `TROUVÉ / DÉDUIT / CANDIDAT / INCONNU` (`utilisablePourAgir`).
- `recovery/sources.ts` — l'ordre des sources à essayer, `prochaineSource`.
- `templates/registry.ts` — les modèles opérationnels approuvés.

`nonCouvertes` (approbation) est bien branché — cette partie de la ligne de base tient.

### Preuve par sabotage (§89)

`estFinPossible` remplacé par `return true` — la violation exacte de la règle 9 de la doctrine
(« on ne conclut pas tant qu'un barreau reste ») :

```
Test Files  2 failed | 384 passed | 1 skipped (387)
Tests       3 failed | 4911 passed
  missions/evals/bench.test.ts (2)   ← bancs unitaires
  missions/goal/evaluate.test.ts (1) ← banc unitaire
```

Aucun test d'intégration, de runtime ou E2E ne bronche.

**Contrôle** — même geste sur `verifierAvantAgir`, qui EST branché (`runtime/engine.ts:400`) :

```
Tests  4 failed
  agent/principal.test.ts › UNE ÉTAPE INTERDITE INSÉRÉE EN BASE est refusée
                            à l'exécution, pas exécutée      ← passe par la base
```

La différence est nette : une garde branchée est défendue par un test qui part de l'état réel ;
un invariant non branché n'est défendu que par son propre test unitaire.

### Conséquence

`runtime/engine.ts:535` écrit bien `errorKind: "INCOMPATIBLE_RESULT"`, mais comme **littéral de
chaîne**, pour une erreur de forme d'éventail (« attendait une liste »), et `retryable: false`.
Rien ne consulte l'échelle qui associe cette cause à ses recours. La seule récupération en
production est : retenter jusqu'à `maxAttempts`, puis replanifier la mission entière, plafonné à
`PLANS_MAX = 4`.

Le scénario §11 — première source rend un document plausible mais faux, Adam le reconnaît et
continue — n'a **aucune implémentation de production**. La largeur multi-sources existe
(`assistant/investigation.ts`, `document-discovery.ts`) ; la *reconnaissance de non-conformité*
n'existe pas.

## §68 — contention PostgreSQL : NON REPRODUITE

Six tentatives au HEAD, zéro reproduction :

| Tentative | Résultat |
|---|---|
| Suite complète ×2 | 386 fichiers, 4914 tests, 0 échec |
| Suite complète sous charge E2E concurrente | 4914 passés, `list-persistence` vert en 67 ms |
| `list-persistence` + `ops-goldens` + `wave3` ×3 | 71 passés |

Hypothèses écartées par mesure : épuisement du pool (4 CPU → 36 connexions théoriques contre
100 par défaut) ; suppression large concurrente (tous les `deleteMany` legal sont bornés par TAG
ou par id) ; sonde `dbOk` (elle *saute* la suite, elle ne la fait pas échouer).

**Classement : (E) limite connue du lanceur, MAIS avec un défaut réel de conception de test (A).**
`list-persistence.test.ts` partage un état mutable de module (`cree`) entre ses deux tests : un
échec du premier vide `cree.docIds`, et le second échoue alors sur `where: { id: undefined }` —
un symptôme qui masque la cause. Ce couplage mérite d'être retiré indépendamment du déclencheur.

## Ce qui tient

- **Live Office** : 21/21 modules joignables depuis la production, 44/44 E2E contre le build de
  production (dont sous charge concurrente), 9/9 sabotages, les cinq fixtures de régression §105
  présentes (A blob orphelin, B apostrophe/trait d'union, C identité P/T/I, D undo puis compare,
  E capacité sans point d'entrée).
- **Frontière d'attestation** : `policy/guard.ts` refuse par MOTIF à la compilation, y compris
  `mission_control|approve_mission|mission_pause|mission_resume` ; `fournirEntree` n'est
  atteignable que depuis une action serveur. Le sabotage de contrôle confirme que le refus est
  appliqué au moment d'agir, pas seulement déclaré.
- **Cliquets d'architecture** : 424 / 69 / 42 inchangés, socle 0, cycles 0.
- **Migrations** : 273 appliquées, base à jour.

## Ce qui n'est pas reproductible

Le recensement annoncé (124 production / 14 test-only / 0 orphelin) **n'a aucun outil versionné**
dans le dépôt. Il ne peut donc pas être rejoué ni défendu. Les instruments écrits pour cet audit
(`audit/`) comblent ce manque et devraient être versionnés si l'on veut que le chiffre reste
vérifiable.
