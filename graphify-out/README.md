# Graphify — graphe de connaissance du code

Graphe de connaissance du code d'AMD Internal OS, généré par
[graphify](https://pypi.org/project/graphifyy/) (analyse AST via tree‑sitter,
**sans** appel LLM ni coût de tokens). C'est un **outil de développement** : il
n'est **pas** embarqué dans l'application déployée (Node/Render), il sert à
explorer et documenter l'architecture.

## Contenu

| Fichier | Description |
| --- | --- |
| `graph.html` | Visualisation interactive (ouvrir dans un navigateur). |
| `GRAPH_REPORT.md` | Rapport : nœuds centraux, hubs de communautés, surprises, questions suggérées. |
| `graph.json` | Graphe persistant et interrogeable (nœuds + arêtes). |
| `cache/` | Cache incrémental (ignoré par git). |

Dernière génération : `src/` — **2628 nœuds · 11625 arêtes · 95 communautés**
(457 fichiers). Les hubs détectés confirment le cœur applicatif :
`userCan`, `rbac.ts`, `hasGlobalView`, `requireModule`, `congress-request-actions.ts`,
`medical-info-actions.ts`, `workflow/engine.ts`…

## Rôle dans le projet

Le graphe est la **couche de compréhension principale** du code (cf. `CLAUDE.md` à la
racine) : on interroge la carte AVANT d'ouvrir les fichiers source. Rafraîchir après
chaque gros lot fonctionnel (pas à chaque micro-commit), puis committer `graph.*`.

## Scripts npm (recommandé)

```bash
npm run graphify:refresh                                    # ré-extrait src/ et met à jour graph.* (auto-installe le CLI)
npm run graphify:report                                     # affiche GRAPH_REPORT.md
npm run graphify:query -- "userCan"                         # explication d'un nœud + voisins
npm run graphify:query -- path "createSponsoring" "createExpenseOrder"   # plus court chemin
```

Après une grosse suppression de code : `GRAPHIFY_FORCE=1 npm run graphify:refresh`.
Le rapport indique le commit de génération (`Built from commit`) : comparez-le à
`git rev-parse HEAD` pour savoir si le graphe est périmé.
