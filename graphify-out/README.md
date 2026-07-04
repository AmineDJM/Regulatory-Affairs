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

## Rafraîchir après des changements de code

```bash
pip install --user graphifyy         # une fois (le paquet PyPI s'appelle « graphifyy »)
graphify update src                  # ré-extrait le code, met à jour graph.* (sans LLM)
#   ou, depuis la racine, pour tout le dépôt : graphify update .
```

Les sorties atterrissent dans `<cible>/graphify-out/` (ex. `src/graphify-out/`) ;
déplacez‑les dans `graphify-out/` à la racine si besoin. Le rapport
indique le commit de génération (`Built from commit`) : comparez‑le à
`git rev-parse HEAD` pour savoir si le graphe est périmé.

## Requêtes utiles (CLI)

```bash
graphify explain "userCan"           # explication en langage clair d'un nœud
graphify path "createSponsoring" "createExpenseOrder"   # plus court chemin
```
