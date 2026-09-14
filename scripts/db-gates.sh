#!/usr/bin/env bash
# Gate de base de données : rejoue toute la chaîne du schéma sur une base VIDE.
#
#   1. socle minimal (`supabase/testing/minimal_supabase_auth.sql`) ;
#   2. migrations dans l'ordre, chacune dans SA transaction, registre compris ;
#   3. le registre recense exactement les fichiers de `supabase/migrations/` ;
#   4. les contrôles pgTAP, chacun jusqu'à son plan, sans un seul `not ok` ;
#   5. le jeu de recette s'applique (mots de passe factices) ;
#   6. les retours arrière dans l'ordre inverse, puis preuve que le schéma est
#      revenu à l'octet près à l'état d'après la première migration (la seule
#      sans retour arrière), registre compris.
#
# La base cible est fournie par deux commandes, ce qui rend le script identique
# en CI (service `supabase/postgres`) et contre une base jetable d'un cluster
# réel (à travers `ssh`) :
#   PSQL   : lit le SQL sur son entrée standard, s'arrête à la première erreur
#            (ex. `docker exec -i <ctr> psql -U postgres -d <base> -v ON_ERROR_STOP=1 -q`)
#   PGDUMP : écrit le schéma seul sur sa sortie standard
#            (ex. `docker exec <ctr> pg_dump -U postgres --schema-only <base>`)
#   PSQL_ADMIN (optionnel) : même chose que PSQL pour le socle seul, quand
#            `postgres` n'est pas superutilisateur de la base (image de la
#            plateforme : `-U supabase_admin`). Défaut : PSQL.
set -euo pipefail

: "${PSQL:?PSQL manquant — commande psql lisant le SQL sur stdin}"
: "${PGDUMP:?PGDUMP manquant — commande pg_dump --schema-only}"
PSQL_ADMIN="${PSQL_ADMIN:-$PSQL}"

cd "$(dirname "$0")/.."
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

sql() { eval "$PSQL"; }
# Une migration ou un retour arrière s'applique en UNE transaction : à mi-course,
# une politique supprimée sans être recréée laisserait une table sans lecture.
sql_tx() { { echo 'begin;'; cat "$1"; echo 'commit;'; } | sql > /dev/null; }
# Sortie brute (sans en-têtes ni alignement) : un scalaire, ou le TAP d'un test.
brut() { { printf '\pset tuples_only on\n\pset format unaligned\n'; cat; } | sql; }
scalar() { echo "$1" | brut | tr -d '[:space:]'; }
dump() { eval "$PGDUMP" | grep -v '^-- Dumped' > "$1"; }

echo "== 1. socle minimal"
eval "$PSQL_ADMIN" < supabase/testing/minimal_supabase_auth.sql > /dev/null

echo "== 2. migrations"
mapfile -t migrations < <(ls supabase/migrations/*.sql | sort)
# Les deux premières migrations ne s'inscrivent pas elles-mêmes au registre : le
# bootstrap les rattrape. Il est posé ici juste après la première — la seule sans
# retour arrière — pour que l'état de référence du point 6 contienne le registre.
# Historiquement il a été posé après la deuxième ; le schéma résultant est le même.
for f in "${migrations[@]}"; do
  echo "   + $(basename "$f")"
  sql_tx "$f"
  if [[ "$f" == "${migrations[0]}" ]]; then
    echo "   + bootstrap/migration_registry.sql"
    sql_tx supabase/bootstrap/migration_registry.sql
    dump "$work/schema-avant.sql"
  fi
done

echo "== 3. registre"
inscrites="$(scalar 'select count(*) from supabase_migrations.schema_migrations;')"
[[ "$inscrites" == "${#migrations[@]}" ]] \
  || { echo "ÉCHEC : $inscrites migrations inscrites pour ${#migrations[@]} fichiers" >&2; exit 1; }
for f in "${migrations[@]}"; do
  version="$(basename "$f" | cut -d_ -f1)"
  [[ "$(scalar "select count(*) from supabase_migrations.schema_migrations where version = '$version';")" == 1 ]] \
    || { echo "ÉCHEC : $version absente du registre" >&2; exit 1; }
done
echo "   $inscrites migrations inscrites, toutes présentes"

echo "== 4. pgTAP"
total=0
for f in supabase/tests/*.test.sql; do
  out="$work/$(basename "$f").out"
  brut < "$f" > "$out"
  planifies="$(grep -oE '^1\.\.[0-9]+' "$out" | cut -d. -f3 || true)"
  joues="$(grep -cE '^ok [0-9]+' "$out" || true)"
  echecs="$(grep -cE '^not ok' "$out" || true)"
  if [[ -z "$planifies" || "$joues" != "$planifies" || "$echecs" != 0 ]] || grep -q 'Looks like' "$out"; then
    echo "ÉCHEC : $(basename "$f") — plan $planifies, joués $joues, not ok $echecs" >&2
    grep -E '^not ok|^#' "$out" >&2 || true
    exit 1
  fi
  echo "   $(basename "$f") : $joues/$planifies"
  total=$((total + joues))
done
echo "   $total contrôles verts"

echo "== 5. jeu de recette (mots de passe factices)"
sed -e 's/__PW_[A-Z]*__/gate-factice/g' supabase/seed/e2e-recette.sql | sql > /dev/null

echo "== 6. retours arrière"
# Chaque migration après la première a son retour arrière, et inversement.
for f in "${migrations[@]:1}"; do
  [[ -f "supabase/rollbacks/$(basename "$f" .sql).down.sql" ]]     || { echo "ÉCHEC : pas de retour arrière pour $(basename "$f")" >&2; exit 1; }
done
mapfile -t rollbacks < <(ls supabase/rollbacks/*.down.sql | sort -r)
[[ "${#rollbacks[@]}" == $(( ${#migrations[@]} - 1 )) ]]   || { echo "ÉCHEC : ${#rollbacks[@]} retours arrière pour ${#migrations[@]} migrations" >&2; exit 1; }
for f in "${rollbacks[@]}"; do
  echo "   - $(basename "$f")"
  sql_tx "$f"
done
dump "$work/schema-apres.sql"
if ! diff -q "$work/schema-avant.sql" "$work/schema-apres.sql" > /dev/null; then
  echo "ÉCHEC : le schéma après retours arrière diffère de celui d'avant les migrations" >&2
  diff "$work/schema-avant.sql" "$work/schema-apres.sql" | head -60 >&2
  exit 1
fi
# Chaque retour arrière désinscrit sa migration : ne reste au registre que la
# migration sans retour arrière, rattrapée par le bootstrap. Une ligne de trop
# trahit un retour arrière qui oublie de se désinscrire.
restantes="$(scalar 'select count(*) from supabase_migrations.schema_migrations;')"
attendues=$(( ${#migrations[@]} - ${#rollbacks[@]} ))
[[ "$restantes" == "$attendues" ]] \
  || { echo "ÉCHEC : $restantes migrations encore inscrites, $attendues attendues" >&2; exit 1; }
echo "   schéma identique à l'octet près ($(wc -c < "$work/schema-avant.sql") octets), registre à $restantes"

echo "OK — chaîne du schéma rejouée de bout en bout : ${#migrations[@]} migrations, $total contrôles, ${#rollbacks[@]} retours arrière"
