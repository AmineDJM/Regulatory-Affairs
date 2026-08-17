#!/usr/bin/env bash
# ============================================================================
# AUDIT DISQUE — LECTURE SEULE. Ne supprime rien, ne modifie rien, ne migre rien.
#
# À lancer dans le Render Shell du service web :
#     bash scripts/audit-disk.sh
#
# Il répond à une seule question : QU'EST-CE QUI OCCUPE LES 10 Go ? Il n'écrit
# nulle part et n'appelle aucune commande destructrice — pas de rm, pas de
# truncate, pas de VACUUM. Le seul effet de bord possible est l'affichage.
# ============================================================================
set -uo pipefail

line() { printf '\n\033[1m── %s\033[0m\n' "$1"; }

printf '\033[1mAUDIT DISQUE — AMD Internal OS (lecture seule)\033[0m\n'
printf 'Date : %s\nHôte : %s\n' "$(date -u '+%Y-%m-%d %H:%M UTC')" "$(hostname 2>/dev/null || echo '?')"

line "1. SYSTÈMES DE FICHIERS MONTÉS (quel volume le graphique Render mesure-t-il ?)"
# Le graphique « Disk Usage » de Render suit le PERSISTENT DISK s'il existe, sinon
# le système de fichiers de l'instance. Repérer le mount path est la première chose à faire.
df -h 2>/dev/null | grep -vE '^(tmpfs|devtmpfs|shm|overlay .*/docker)' || df -h

line "2. DISQUE PERSISTANT ? (un mount hors / et /tmp trahit un disque Render)"
mount 2>/dev/null | grep -vE 'proc|sysfs|devpts|cgroup|tmpfs|mqueue|devtmpfs' | head -20

line "3. RÉPERTOIRE DE L'APPLICATION — top 25 des plus gros dossiers"
APP_DIR="${RENDER_PROJECT_ROOT:-$(pwd)}"
echo "Racine analysée : $APP_DIR"
du -xh -d 3 "$APP_DIR" 2>/dev/null | sort -rh | head -25

line "4. LES SUSPECTS HABITUELS (taille de chacun, s'il existe)"
for d in \
  "$APP_DIR/node_modules" "$APP_DIR/.next" "$APP_DIR/.next/cache" \
  "$APP_DIR/public" "$APP_DIR/prisma" "$APP_DIR/.git" \
  "$HOME/.npm" "$HOME/.cache" "$HOME/.cache/ms-playwright" \
  /opt/pw-browsers /tmp /var/tmp /var/log
do
  [ -e "$d" ] && printf '%10s  %s\n' "$(du -xsh "$d" 2>/dev/null | cut -f1)" "$d"
done

line "5. /tmp EN DÉTAIL — c'est là que vivent les fuites de fichiers temporaires"
# Les préfixes que le code crée : reg-ctd-* (assemblage d'archive CTD),
# reg-archive-* (conservation de l'archive originale), amd-ocr-langs (données Tesseract).
echo "Total /tmp : $(du -xsh /tmp 2>/dev/null | cut -f1)"
echo
echo "→ Répertoires temporaires du logiciel :"
for pat in 'reg-ctd-*' 'reg-archive-*' 'amd-ocr-langs*'; do
  found=$(find /tmp -maxdepth 1 -name "$pat" 2>/dev/null)
  if [ -n "$found" ]; then
    echo "  $pat :"
    echo "$found" | while read -r p; do printf '    %10s  %s  (modifié %s)\n' \
      "$(du -xsh "$p" 2>/dev/null | cut -f1)" "$p" "$(date -r "$p" '+%Y-%m-%d %H:%M' 2>/dev/null || echo '?')"; done
  else
    echo "  $pat : aucun (bon signe)"
  fi
done
echo
echo "→ Les 15 plus gros éléments de /tmp, tous confondus :"
du -xh -d 2 /tmp 2>/dev/null | sort -rh | head -15

line "6. FICHIERS DE PLUS DE 50 Mo, où qu'ils soient (hors /proc et /sys)"
find / -xdev -type f -size +50M 2>/dev/null \
  -not -path '/proc/*' -not -path '/sys/*' \
  -printf '%10s  %TY-%Tm-%Td  %p\n' 2>/dev/null \
  | sort -rn | head -25 \
  | awk '{ printf "%8.1f Mo  %s  %s\n", $1/1048576, $2, $3 }'

line "7. FICHIERS DE LOG ÉCRITS SUR DISQUE (il ne devrait y en avoir aucun)"
find / -xdev \( -name '*.log' -o -name '*.log.*' -o -name 'core.*' \) -type f -size +1M 2>/dev/null \
  -not -path '/proc/*' -not -path '/sys/*' | head -20 || true
echo "(vide = les logs partent sur stdout, capté par Render : c'est le comportement attendu)"

line "8. TAILLE DE LA BASE POSTGRESQL (comptée à part — ce n'est PAS le disque Render)"
# Le contenu des documents vit en BASE (FileBlob.data / FileBlobChunk.data), pas sur ce disque.
# Confondre les deux fait chercher des Go là où il n'y en a pas.
if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -At -c "SELECT 'Base totale : ' || pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null
  echo
  echo "→ Les 15 plus grosses tables (données + index) :"
  psql "$DATABASE_URL" -c "
    SELECT relname AS table,
           pg_size_pretty(pg_total_relation_size(C.oid)) AS total,
           pg_size_pretty(pg_relation_size(C.oid))       AS donnees,
           pg_size_pretty(pg_total_relation_size(C.oid) - pg_relation_size(C.oid)) AS index_toast
    FROM pg_class C
    LEFT JOIN pg_namespace N ON N.oid = C.relnamespace
    WHERE nspname = 'public' AND C.relkind = 'r'
    ORDER BY pg_total_relation_size(C.oid) DESC
    LIMIT 15;" 2>/dev/null
  echo
  echo "→ Octets stockés EN BASE vs déportés en objet (S3/Supabase) :"
  psql "$DATABASE_URL" -c "
    SELECT
      count(*)                                        AS blobs,
      count(*) FILTER (WHERE \"storageKey\" IS NOT NULL) AS en_objet,
      count(*) FILTER (WHERE \"storageKey\" IS NULL)     AS en_base,
      pg_size_pretty(COALESCE(sum(size), 0))          AS taille_clair_totale,
      pg_size_pretty(COALESCE(sum(size) FILTER (WHERE \"storageKey\" IS NULL), 0)) AS dont_en_base
    FROM \"FileBlob\";" 2>/dev/null
  echo
  echo "→ Parties d'upload NON NETTOYÉES (sessions abandonnées : elles occupent la base) :"
  psql "$DATABASE_URL" -c "
    SELECT s.status,
           count(DISTINCT s.id) AS sessions,
           count(p.id)          AS parties,
           pg_size_pretty(COALESCE(sum(p.size), 0)) AS octets
    FROM \"RegulatoryUploadSession\" s
    LEFT JOIN \"RegulatoryUploadPart\" p ON p.\"sessionId\" = s.id
    GROUP BY s.status ORDER BY 4 DESC;" 2>/dev/null
  echo
  echo "→ Blobs ORPHELINS (refCount = 0, plus référencés par aucune version) :"
  psql "$DATABASE_URL" -c "
    SELECT count(*) AS blobs_orphelins,
           pg_size_pretty(COALESCE(sum(size), 0)) AS taille
    FROM \"FileBlob\" WHERE \"refCount\" <= 0;" 2>/dev/null
else
  echo "psql indisponible ou DATABASE_URL absent → étape ignorée."
  echo "Depuis un poste avec psql : psql \"\$DATABASE_URL\" -c \"SELECT pg_size_pretty(pg_database_size(current_database()));\""
fi

line "9. INODES (un disque « plein » sans gros fichier = trop de petits fichiers)"
df -ih 2>/dev/null | head -5

line "RAPPEL"
echo "Cet audit n'a RIEN supprimé, RIEN modifié, RIEN migré. Aucune commande destructrice"
echo "n'y figure. Reportez les chiffres dans docs/DISK_STORAGE_AUDIT.md avant toute décision."
