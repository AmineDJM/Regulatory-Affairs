#!/usr/bin/env bash
# Interroge le graphe de connaissance versionné (graphify-out/graph.json) SANS le régénérer.
#   npm run graphify:query -- "userCan"                          → explication d'un nœud + voisins
#   npm run graphify:query -- path "createSponsoring" "createExpenseOrder"  → plus court chemin
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"

command -v graphify >/dev/null 2>&1 || python3 -m pip install --user --quiet graphifyy

if [ $# -eq 0 ]; then
  echo "Usage :"
  echo "  npm run graphify:query -- \"<nœud>\"           # explication d'un nœud et de ses voisins"
  echo "  npm run graphify:query -- path \"A\" \"B\"      # plus court chemin entre deux symboles"
  exit 1
fi

if [ "$1" = "path" ]; then
  shift
  graphify path "$@" --graph graphify-out/graph.json
else
  graphify explain "$@" --graph graphify-out/graph.json
fi
