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

# ── LA TABLE D'AIGUILLAGE EST ÉCARTÉE DU SCAN, ET C'EST MESURÉ ─────────────────────────────
#
# `src/lib/actions/aiguillage.genere.ts` porte 119 `import()` à spécificateur littéral — un par
# fichier d'actions. L'extracteur suit chaque import dynamique ; sur ce fichier-là il ne termine
# JAMAIS (bloqué à 200 s comme à 3 600 s). Isolé par élimination : sans lui, l'extraction rend
# 18 103 nœuds en moins de 300 s ; avec lui seul en plus, elle bloque. Le gros fichier de données
# voisin (`contrat.genere.json`, 390 ko) n'y est pour RIEN — c'était mon hypothèse de départ, et
# la mesure l'a démentie.
#
# On n'a PAS déformé le code de production pour plaire à l'outil : les 119 spécificateurs
# littéraux existent pour que l'empaqueteur voie chaque chemin sans tirer tout le parc (voir
# `scripts/actions-contrat.ts`). C'est la CARTE qui a une limite, et une table d'aiguillage
# générée ne lui apprend rien sur l'architecture — elle la répète.
AIGUILLAGE="src/lib/actions/aiguillage.genere.ts"
ECART="$(mktemp -d)"
restaurer() { [ -f "$ECART/aiguillage.genere.ts" ] && mv "$ECART/aiguillage.genere.ts" "$AIGUILLAGE"; rm -rf "$ECART"; }
trap restaurer EXIT
[ -f "$AIGUILLAGE" ] && mv "$AIGUILLAGE" "$ECART/"

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
