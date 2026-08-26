#!/usr/bin/env bash
#
# MESURE DU PIC MÉMOIRE DU BUILD — la garde contre le retour de l'OOM Render.
#
# Render tue le build à 8 Go. La machine de développement, elle, a 16 Go et ne dit rien :
# une régression mémoire y passe inaperçue jusqu'au déploiement. Ce script rend le pic
# VISIBLE et le compare à un plafond.
#
# Il échantillonne le RSS de TOUT l'arbre de processus node (le parent ET ses workers) —
# c'est bien la somme qui compte, puisque c'est ce que le conteneur de build additionne.
#
#   npm run build:measure              # plafond par défaut : 5000 Mo
#   BUILD_MEM_LIMIT_MB=4200 npm run build:measure
#
# Sortie non nulle si le pic dépasse le plafond, pour qu'une CI puisse s'en servir.
set -u

LIMIT_MB="${BUILD_MEM_LIMIT_MB:-5000}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

# Un build PROPRE : le cache .next masquerait le vrai coût, et Render part d'un dossier vide.
rm -rf .next

echo "Build propre en cours (plafond : ${LIMIT_MB} Mo)..."
LOG="$(mktemp)"
npx next build > "$LOG" 2>&1 &
BUILD_PID=$!

PEAK=0
PEAK_PROCS=0
while kill -0 "$BUILD_PID" 2>/dev/null; do
  READING=$(ps -eo rss,comm --no-headers 2>/dev/null \
    | awk '$2 ~ /^(node|next)/ { s += $1; n += 1 } END { printf "%d %d", int(s/1024), n }')
  TOTAL=${READING% *}
  PROCS=${READING#* }
  [ "${TOTAL:-0}" -gt "$PEAK" ] && PEAK=$TOTAL
  [ "${PROCS:-0}" -gt "$PEAK_PROCS" ] && PEAK_PROCS=$PROCS
  sleep 0.5
done

wait "$BUILD_PID"; CODE=$?
tail -5 "$LOG"; rm -f "$LOG"

echo
echo "─────────────────────────────────────────────"
echo "PIC MÉMOIRE (arbre node) : ${PEAK} Mo"
echo "PROCESSUS NODE MAX       : ${PEAK_PROCS}"
echo "PLAFOND                  : ${LIMIT_MB} Mo"
echo "BUILD                    : code de sortie ${CODE}"
echo "─────────────────────────────────────────────"

if [ "$CODE" -ne 0 ]; then
  echo "ECHEC : le build lui-meme a echoue."
  exit "$CODE"
fi

if [ "$PEAK" -gt "$LIMIT_MB" ]; then
  echo "ECHEC : pic ${PEAK} Mo > plafond ${LIMIT_MB} Mo."
  echo "Pistes verifiees par le passe : parallelisme (experimental.cpus), minification"
  echo "serveur (experimental.serverMinification), taille des gros modules de src/lib."
  exit 1
fi

echo "OK : pic sous le plafond."
