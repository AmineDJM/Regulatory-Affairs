## Scripts Graphify
- `npm run graphify:refresh` — auto-installe le CLI si absent (conteneur éphémère), ré-extrait `src/` (AST, sans LLM, ~1 min), replace les sorties dans `graphify-out/`. Après une grosse suppression de code : `GRAPHIFY_FORCE=1 npm run graphify:refresh`.
- `npm run graphify:report` — affiche le rapport.
- `npm run graphify:query -- …` — interroge le graphe versionné sans le régénérer.

