#!/usr/bin/env bash
# Joue `scripts/db-gates.sh` dans une base JETABLE du cluster PostgreSQL réel,
# à travers SSH : même image, même version, même socle que la production, sans
# Docker sur le poste. La base est créée vide et supprimée quoi qu'il arrive.
#
#   TARJIH_SSH  : commande ssh vers l'hôte (ex. `ssh -i ~/.ssh/cle -o BatchMode=yes user@hote`)
#   TARJIH_DB   : conteneur PostgreSQL de la stack Supabase de Tarjih
#                 (défaut : celui de `docs/deployment-tarjih.md`)
set -euo pipefail

: "${TARJIH_SSH:?TARJIH_SSH manquant — commande ssh vers le serveur du cluster}"
conteneur="${TARJIH_DB:-supabase-db-f10v8td71bwii32blb9lalfk}"
base="tarjih_gate_$(date +%Y%m%d%H%M%S)_$$"

admin() { $TARJIH_SSH "docker exec $conteneur psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -c \"$1\""; }
trap 'admin "drop database if exists $base" && echo "base jetable $base : supprimee"' EXIT

admin "create database $base"
echo "base jetable $base créée dans $conteneur"

PSQL="$TARJIH_SSH 'docker exec -i $conteneur psql -U postgres -d $base -v ON_ERROR_STOP=1 -q'" \
PGDUMP="$TARJIH_SSH 'docker exec $conteneur pg_dump -U postgres --schema-only $base'" \
  bash "$(dirname "$0")/db-gates.sh"
