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

