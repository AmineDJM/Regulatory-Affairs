#!/usr/bin/env bash
# Rafraîchit le graphe de connaissance du code (graphify-out/ à la racine).
# À lancer après chaque GROS lot fonctionnel (pas à chaque micro-commit),
# puis committer graph.json / graph.html / GRAPH_REPORT.md.
# Après une grosse suppression de code : GRAPHIFY_FORCE=1 npm run graphify:refresh
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"

# Conteneur éphémère (Claude Code web) : le CLI n'est pas persistant → auto-install.
command -v graphify >/dev/null 2>&1 || python3 -m pip install --user --quiet graphifyy

# Semer le cache incrémental versionné localement (utile intra-session).
rm -rf src/graphify-out
mkdir -p src/graphify-out graphify-out
[ -d graphify-out/cache ] && cp -r graphify-out/cache src/graphify-out/cache

graphify update src

# Replacer les sorties à la racine (le CLI écrit dans <cible>/graphify-out/).
mv -f src/graphify-out/graph.json src/graphify-out/graph.html src/graphify-out/GRAPH_REPORT.md graphify-out/
[ -f src/graphify-out/.graphify_labels.json ] && mv -f src/graphify-out/.graphify_labels.json graphify-out/
rm -rf graphify-out/cache
[ -d src/graphify-out/cache ] && mv src/graphify-out/cache graphify-out/cache
rm -rf src/graphify-out

echo "✓ Graphe rafraîchi → graphify-out/ — committez graph.json / graph.html / GRAPH_REPORT.md"
