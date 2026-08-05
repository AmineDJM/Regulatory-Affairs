# AMD Internal OS — instructions projet

ERP interne Adventum Pharma. Next.js 14 (App Router) + Prisma + PostgreSQL, UI en français, devise DZD. Aucune donnée simulée. Vérification avant commit : `npm run typecheck && npm run build && npm test` (Postgres local : `pg_ctlcluster 16 main start` si down). Migrations : SQL manuel idempotent dans `prisma/migrations/` + `db:deploy`.

⚠️ **`npm run build` réutilise le cache `.next`** et peut donc rater une erreur que le serveur de déploiement, lui, verra (il part d'un dossier vide). Après avoir touché aux **imports d'un composant client**, vérifier sur un build propre : `rm -rf .next && npm run build`.

## Frontière client / serveur — la règle qui casse les déploiements

Un composant `"use client"` est compilé **pour le navigateur**. S'il importe — même indirectement, à dix modules de distance — un module qui lit des fichiers (`fs`, `zlib`, `child_process`…), la compilation de production échoue avec **« Module not found: Can't resolve 'fs' »**. Le typecheck ne le voit pas.

- Les **actions serveur** (`"use server"`) ne comptent pas : Next.js les remplace par un appel distant. Un composant client peut les appeler librement.
- Ce sont les imports **ordinaires** (constantes, types *avec valeur*, fonctions utilitaires) qui posent problème.
- Pattern à suivre : sortir les fonctions **pures** dans un module dédié qui n'importe rien de lourd (ex. `src/lib/market/galenic.ts` et `text.ts` pour les normalisations pharma ; `molecule.ts` garde l'analyse qui lit les données et les **réexporte** pour le serveur).
- **`src/lib/client-bundle-guard.test.ts`** remonte les chaînes d'import et fait échouer `npm test` en affichant le chemin fautif. Ne pas le désactiver : il existe parce que l'erreur est déjà passée en production.

## Ordre de consultation (économie de tokens)

1. **`README.md`** = carte FONCTIONNELLE de référence : section « Référence détaillée des circuits & mécanismes transverses » (règles exactes de chaque flux + gardes RBAC + modèles + chemins de fichiers) et « Carte du code — fichiers clés par domaine ». La consulter AVANT toute exploration : la plupart des questions « comment marche X / où est codé X » y sont déjà répondues.
2. **Graphify** (ci-dessous) = carte STRUCTURELLE (symboles, dépendances) pour localiser précisément avant de lire.
3. **Lecture de code** ciblée en dernier.

Après un gros lot fonctionnel : mettre à jour le README (panorama, circuits, journal) EN MÊME TEMPS que le refresh Graphify — les deux cartes doivent rester exactes.

## Graphify = couche de compréhension principale (OBLIGATOIRE)

Le graphe de connaissance du code (`graphify-out/graph.json`, ~2 700 nœuds / 466 fichiers) est la **carte d'architecture** du projet. Objectif : réduire les tokens et garder la cohérence — on interroge la carte AVANT d'ouvrir le code.

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
