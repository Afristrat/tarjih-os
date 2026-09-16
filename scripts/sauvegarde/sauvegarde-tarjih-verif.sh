#!/usr/bin/env bash
# L'exercice de restauration de Tarjih (SOP-026) : restaurer le dernier dump dans un cluster
# TÉMOIN neuf (même image que la production, sans réseau, sans port, plafonné, détruit dans
# tous les cas), puis comparer ses comptes à ceux écrits à l'instant du dump. Divergence,
# dump périmé ou témoin muet = échec, statut `failed`, code 1.
#
# Ce qu'un « fichier présent, statut ok » ne dit jamais : que le fichier se restaure, que
# les données y sont, que les fonctions, les déclencheurs et les policies RLS y sont. Le
# `pg_dumpall` nocturne du parc avait tout cela FAUX en silence pour Tarjih (2026-09-16).
#
# Source de vérité : le dépôt (`scripts/sauvegarde/`). Sur l'hôte : `$HOME/ops/tarjih/`,
# cron quotidien 04:50 (docker-watch alerte tout statut de plus de 48 h : un exercice
# hebdomadaire serait une alerte permanente ; l'exercice coûte ~10 s).
#
#   sauvegarde-tarjih-verif.sh                       # le dernier dump local
#   sauvegarde-tarjih-verif.sh <fichier.dump> [distant]   # un dump précis ; `distant` =
#        exercice mensuel depuis la copie hors site, déchiffrée sur le poste (verif-distante.ps1)
set -uo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="/data/backups/tarjih"
DRILL_DIR="/data/backups/tarjih-drill"          # son propre statut, lu par docker-watch
IMAGE="${TARJIH_IMAGE_DB:-supabase/postgres:15.8.1.085}"
TEMOIN="tarjih-verif-cluster"
AGE_MAX_H=26                                    # kpi-age-bundle-teste : un dump plus vieux est un échec en soi
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SOURCE="${2:-local}"
case "$SOURCE" in local) STATUT="$DRILL_DIR/last-status.json" ;; distant) STATUT="$DRILL_DIR/last-status-distant.json" ;; *) echo "source inconnue : $SOURCE" >&2; exit 2 ;; esac
JOURNAL="$DRILL_DIR/last-restore.log"
mkdir -p "$DRILL_DIR" && chmod 700 "$DRILL_DIR" || { echo "ÉCHEC vérification tarjih : $DRILL_DIR inaccessible (le créer en root, propriétaire serveuria)" >&2; exit 1; }
SHA_SCRIPT="$(sha256sum "$0" | cut -d' ' -f1)"

FICHIER="${1:-$(ls -1t "$BACKUP_DIR"/db-tarjih-*.dump 2>/dev/null | head -1)}"

echouer() {
  printf '{"status":"failed","reason":"%s","source":"%s","file":"%s","attendu":"%s","obtenu":"%s","age_bundle_heures":%s,"timestamp":"%s","sha256_script":"%s"}\n' \
    "$1" "$SOURCE" "${FICHIER:-}" "${ATTENDU:-}" "${2:-}" "${AGE_H:-0}" "$TS" "$SHA_SCRIPT" > "$STATUT"
  echo "ÉCHEC vérification tarjih ($SOURCE) : $1${ATTENDU:+ (attendu $ATTENDU, obtenu ${2:-rien})}" >&2
  exit 1
}

[ -n "$FICHIER" ] && [ -f "$FICHIER" ] || echouer "aucun_dump"
[ -f "$FICHIER.comptes" ] || echouer "comptes_absents"
ATTENDU="$(cat "$FICHIER.comptes")"
COMPTES_SQL="$(cat "$ICI/comptes.sql")" || echouer "comptes_sql_absent"

# L'âge se lit dans le NOM (db-tarjih-YYYYMMDDTHHMMSSZ.dump), jamais dans le mtime.
HORODATAGE="${FICHIER##*/db-tarjih-}"; HORODATAGE="${HORODATAGE%.dump}"
EPOQUE="$(date -u -d "${HORODATAGE:0:8} ${HORODATAGE:9:2}:${HORODATAGE:11:2}:${HORODATAGE:13:2}" +%s 2>/dev/null)" || echouer "nom_illisible"
AGE_H=$(( ( $(date +%s) - EPOQUE ) / 3600 ))
[ "$AGE_H" -le "$AGE_MAX_H" ] || echouer "dump_perime_${AGE_H}h"

MDP="verif-$(date +%s)-$RANDOM"
nettoyer() { docker rm -f "$TEMOIN" >/dev/null 2>&1 || true; }
trap nettoyer EXIT
nettoyer

docker run -d --name "$TEMOIN" --network none --memory 2g --memory-swap 2g --pids-limit 512 \
  --env POSTGRES_PASSWORD="$MDP" "$IMAGE" >/dev/null 2>>"$JOURNAL" || echouer "temoin_non_demarre"
# L'entrypoint de l'image démarre un serveur TEMPORAIRE pour son initialisation puis le
# redémarre : `pg_isready` répond déjà pendant le premier, et une restauration lancée à cet
# instant meurt avec lui. Trois réponses consécutives à deux secondes d'écart.
STABLE=0
for _ in $(seq 1 90); do
  if docker exec "$TEMOIN" pg_isready -U postgres -q 2>/dev/null; then STABLE=$((STABLE + 1)); else STABLE=0; fi
  [ "$STABLE" -ge 3 ] && break
  sleep 2
done
[ "$STABLE" -ge 3 ] || echouer "temoin_injoignable"

docker cp "$FICHIER" "$TEMOIN":/tmp/a-verifier.dump || echouer "copie_impossible"
# Trois erreurs attendues et ignorées par pg_restore lui-même (schéma `storage` et clé de
# `auth.users` que l'image pré-crée) ; toute autre se lit dans le journal.
docker exec --env PGPASSWORD="$MDP" "$TEMOIN" pg_restore -U supabase_admin -h localhost -d postgres \
  --clean --if-exists --no-owner --no-privileges /tmp/a-verifier.dump > "$JOURNAL" 2>&1 || true

OBTENU="$(docker exec --env PGPASSWORD="$MDP" "$TEMOIN" psql -U supabase_admin -h localhost -d postgres -At -c "$COMPTES_SQL" 2>>"$JOURNAL")" || echouer "comptes_illisibles"
[ "$OBTENU" = "$ATTENDU" ] || echouer "comptes_divergents" "$OBTENU"

printf '{"status":"ok","source":"%s","file":"%s","comptes":"%s","age_bundle_heures":%s,"timestamp":"%s","sha256_script":"%s"}\n' \
  "$SOURCE" "$FICHIER" "$OBTENU" "$AGE_H" "$TS" "$SHA_SCRIPT" > "$STATUT"
echo "Vérification OK ($SOURCE) : $FICHIER restauré dans un cluster neuf, comptes identiques ($OBTENU), dump de ${AGE_H} h"
