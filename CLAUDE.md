# AMD Internal OS — instructions projet

ERP interne Adventum Pharma. Next.js 14 (App Router) + Prisma + PostgreSQL, UI en français, devise DZD. Aucune donnée simulée. Vérification avant commit : `npm run typecheck && npm run build && npm test` (Postgres local : `pg_ctlcluster 16 main start` si down). Migrations : SQL manuel idempotent dans `prisma/migrations/` + `db:deploy`.

⚠️ **`npm run build` réutilise le cache `.next`** et peut donc rater une erreur que le serveur de déploiement, lui, verra (il part d'un dossier vide). Après avoir touché aux **imports d'un composant client**, vérifier sur un build propre : `rm -rf .next && npm run build`.

## Frontière client / serveur — la règle qui casse les déploiements

Un composant `"use client"` est compilé **pour le navigateur**. S'il importe — même indirectement, à dix modules de distance — un module qui lit des fichiers (`fs`, `zlib`, `child_process`…), la compilation de production échoue avec **« Module not found: Can't resolve 'fs' »**. Le typecheck ne le voit pas.

- Les **actions serveur** (`"use server"`) ne comptent pas : Next.js les remplace par un appel distant. Un composant client peut les appeler librement.
- Ce sont les imports **ordinaires** (constantes, types *avec valeur*, fonctions utilitaires) qui posent problème.
- Pattern à suivre : sortir les fonctions **pures** dans un module dédié qui n'importe rien de lourd (ex. `src/lib/market/galenic.ts` et `text.ts` pour les normalisations pharma ; `molecule.ts` garde l'analyse qui lit les données et les **réexporte** pour le serveur).
- **`src/lib/client-bundle-guard.test.ts`** remonte les chaînes d'import et fait échouer `npm test` en affichant le chemin fautif. Ne pas le désactiver : il existe parce que l'erreur est déjà passée en production.

## Mission Runtime — la doctrine (§118)

Exécuter une mission gigantesque est une propriété **codée** de l'architecture, pas une recette. Les règles ci-dessous ne sont pas des conseils : elles sont tenues par des tests, et chacune existe parce que son absence a un coût nommable.

**Les modèles décident QUOI. Le code décide COMMENT.** La persistance, les droits, les états, le DAG, le parallélisme, les reprises, les points de reprise, l'idempotence, les approbations, les événements, les notifications, la reprise après panne, l'observabilité et la vérification du succès appartiennent au **logiciel**. Un modèle qui propose un plan est une proposition faillible ; ce qui en fait un programme, c'est le compilateur.

1. **Deux axes indépendants.** La difficulté de raisonnement (A/B/C) et la quantité de travail (S→MASSIVE) ne se confondent jamais. « Le même message à 33 salariés » est B + MASSIVE : le plan est évident, l'exécution est massive. Router sur le nombre d'étapes enverrait cette mission au raisonnement le plus cher pour rien.
2. **Aucune limite d'architecture.** Même moteur pour 3, 30, 300 ou 3 000 actions. Les seules limites sont **opérationnelles** (concurrence, quotas, budget, sécurité) et elles portent leur raison dans le code.
3. **Le plan d'un modèle n'est jamais exécuté tel quel.** `compiler/compile.ts` refuse une capacité inventée, une capacité interdite à l'acteur, un cycle, une forme incohérente et une **cardinalité fausse** — 33 destinataires dans une étape au lieu de 33 étapes.
4. **Une étape terminée avec son reçu EST le point de reprise.** Pas de table de points de reprise : elle dirait la même chose une seconde fois et divergerait.
5. **Ne rien recréer de ce qui existe.** `MissionEvent` est le journal, `BusinessEvent` le registre canonique (§17 : pas de second registre), `src/lib/push.ts` le VAPID (§34 : pas de second système de notifications), le `scheduler` existant l'ordonnanceur (§39 : pas d'ordonnanceur parallèle), `AssistantActionIntent` l'idempotence et le reçu.
6. **Aucune auto-escalade.** `policy/guard.ts` interdit STRUCTURELLEMENT à l'agent de modifier des permissions, s'attribuer SUPER_ADMIN, toucher au RBAC, créer des identifiants ou désactiver un garde-fou. C'est un refus de **compilation**, pas une consigne de prompt : une consigne de prompt est une prière qu'un document injecté peut contredire.
7. **Une mission n'est jamais une porte dérobée.** Mêmes droits, même contexte d'acteur, même audit, même politique de confirmation que l'écran. Un contenu d'e-mail ou de document est une **donnée**, jamais une instruction.
8. **Un accord, pas 99 confirmations — ni un chèque en blanc.** L'approbation porte sur un périmètre résumé par une empreinte immuable ; un changement **matériel** rouvre la partie modifiée, et elle seule.
9. **On ne s'arrête jamais à la première difficulté.** Douze causes d'échec, une échelle de recours par cause, et un invariant : `estFinPossible` refuse de conclure tant qu'un barreau reste. Mais **la persévérance n'autorise ni l'invention ni le contournement** — TROUVÉ / DÉDUIT / CANDIDAT / INCONNU, et seul TROUVÉ autorise à agir.
10. **« Toutes les étapes ont tourné » n'est pas « l'objectif est atteint ».** Le contrôle qualité est arithmétique et a le dernier mot dans le sens **négatif** ; la satisfaction se juge, et **sans juge la mission ne conclut pas**. Un moteur qui conclut parce qu'il n'a pas pu vérifier est pire qu'un moteur qui ne conclut pas.
11. **Le contexte se compose, il ne s'accumule pas.** Jamais « la conversation grandit → on renvoie tout ». Trois couches ne se coupent jamais : approbation en attente, identité active, contrainte que la personne vient d'énoncer.
12. **Pas d'apprentissage silencieux.** Ce qu'Adam a OBSERVÉ n'est pas ce qu'un humain a APPROUVÉ, et seul l'approuvé fait autorité.
13. **Pas de fichier-dieu, pas de mission spécialisée.** Le runtime est découpé en `missions/{runtime,planner,compiler,registry,policy,approval,events,goal,recovery,commitments,templates,memory,view,agent,evals}/`. Écrire `newYearMission.ts` serait l'échec du chantier, pas sa réussite.

`src/lib/missions/` est déclaré **façade (L2)** dans `src/platform/domains.ts` : il n'importe jamais `assistant/`. Les capacités lui arrivent par un **port** (`missions/ports.ts`), ce qui l'empêche structurellement de s'en octroyer une. Côté Adam, l'accès passe par le **contrat de plateforme** (`mission.status`), jamais par un import direct — `boundary.test.ts` le vérifie.

## Ordre de consultation (économie de tokens)

1. **`README.md`** = carte FONCTIONNELLE de référence : section « Référence détaillée des circuits & mécanismes transverses » (règles exactes de chaque flux + gardes RBAC + modèles + chemins de fichiers) et « Carte du code — fichiers clés par domaine ». La consulter AVANT toute exploration : la plupart des questions « comment marche X / où est codé X » y sont déjà répondues.
2. **Graphify** (ci-dessous) = carte STRUCTURELLE (symboles, dépendances) pour localiser précisément avant de lire.
3. **Lecture de code** ciblée en dernier.

Après un gros lot fonctionnel : mettre à jour le README (panorama, circuits, journal) EN MÊME TEMPS que le refresh Graphify — les deux cartes doivent rester exactes.

## Graphify = couche de compréhension principale (OBLIGATOIRE)

Le graphe de connaissance du code (`graphify-out/graph.json`, ~10 200 nœuds / ~1 590 fichiers) est la **carte d'architecture** du projet. Objectif : réduire les tokens et garder la cohérence — on interroge la carte AVANT d'ouvrir le code.

Règles :
1. **Avant toute tâche structurelle ou modification non triviale**, interroger d'abord Graphify :
   - `npm run graphify:query -- "<nœud>"` → explication d'un symbole + ses voisins (ex. `"userCan"`, `"createExpenseOrder"`) ;
   - `npm run graphify:query -- path "A" "B"` → chaîne reliant deux symboles ;
   - `npm run graphify:report` → hubs et communautés (vue d'ensemble).
2. **Lire les fichiers source seulement après** avoir identifié les fichiers pertinents via Graphify.
3. **Pas de recherche large** (grep exploratoire, lectures massives en éventail) avant la requête Graphify. Un grep **ciblé** sur un symbole déjà localisé par le graphe reste permis.
4. **Rafraîchir après chaque gros lot fonctionnel** (nouveau module, refonte) : `npm run graphify:refresh`, puis committer `graph.json` / `graph.html` / `GRAPH_REPORT.md`. **Jamais à chaque micro-commit** (~8 Mo d'artefacts par refresh).
5. Fraîcheur : `GRAPH_REPORT.md` indique `Built from commit`. Si le graphe a plusieurs gros lots de retard sur `HEAD`, le rafraîchir avant de s'y fier.

Fallback autorisé (le graphe ne couvre pas tout) : contenu exact d'un fichier déjà identifié, chaînes littérales / libellés UI, fichiers hors `src/` (`prisma/`, `scripts/`), ou graphe indisponible.

## Scripts Graphify
- `npm run graphify:refresh` — auto-installe le CLI si absent (conteneur éphémère), ré-extrait `src/` (AST, sans LLM, ~1 min), replace les sorties dans `graphify-out/`. Après une grosse suppression de code : `GRAPHIFY_FORCE=1 npm run graphify:refresh`.
- `npm run graphify:report` — affiche le rapport.
- `npm run graphify:query -- …` — interroge le graphe versionné sans le régénérer.

## Versionnement Graphify
Versionnés : `graphify-out/{graph.json, graph.html, GRAPH_REPORT.md, .graphify_labels.json, README.md}`. Ignorés (cache local) : `graphify-out/{cache/, manifest.json, .graphify_root}`.
