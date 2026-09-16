#!/usr/bin/env bash
# Sauvegarde nocturne de la base Tarjih : `pg_dump -Fc` de la base `postgres` du conteneur
# Supabase, ses COMPTES écrits à côté (pour que la restauration se prouve), chiffrée pour
# la copie hors site, rotation GFS. SOP-026.
#
# Pourquoi ce script existe alors que `ops/infra/backup-pg-all.sh` sauvegarde la base chaque
# nuit : ce dernier produit un `pg_dumpall` SQL, et restauré dans un cluster NEUF de l'image
# de production il rend, pour Tarjih, ZÉRO ligne, zéro fonction, zéro déclencheur, zéro
# policy (mesuré le 2026-09-16 : 60 erreurs, les schémas `auth`/`storage` pré-initialisés
# par l'image font échouer les `COPY`, puis `psql` lit les données comme du SQL). Le même
# instant en `-Fc`, restauré `--clean --if-exists --no-owner --no-privileges`, rend la
# production à l'identique sur 22 compteurs, somme exacte des montants comprise.
#
# Source de vérité : le dépôt (`scripts/sauvegarde/`). Sur l'hôte : `$HOME/ops/tarjih/`,
# cron 03:10. Aucun secret : `pg_dump` passe par `docker exec` sur le socket local ; le
# chiffrement n'utilise que la clé PUBLIQUE (`tarjih-sauvegarde.pub`), la privée vit au
# coffre DPAPI du poste (`TARJIH_SAUVEGARDE_GPG_PRIVEE_B64`), jamais sur cet hôte.
set -uo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
CONTENEUR_ATTENDU="${TARJIH_CONTENEUR_DB:-supabase-db-f10v8td71bwii32blb9lalfk}"
IMAGE_ATTENDUE="${TARJIH_IMAGE_DB:-supabase/postgres:15.8.1.085}"
EMPREINTE_GPG="AADA6CDF2DFAD6FFA7D17ED7A27DDC08AF5861DF"   # clé primaire (tarjih-sauvegarde.pub)
SOUS_CLE_CHIFFREMENT="C4849D98AE995053"                 # sous-clé [E] : celle que le fichier doit nommer
BACKUP_DIR="/data/backups/tarjih"
GFS_QUOTIDIENS=7; GFS_HEBDOMADAIRES=8; GFS_MENSUELS=12
TAILLE_MIN=100000   # octets : la base réelle fait ~1 Mo ; un dump plus petit est un échec
TS="$(date -u +%Y%m%dT%H%M%SZ)"
FICHIER="$BACKUP_DIR/db-tarjih-$TS.dump"
STATUT="$BACKUP_DIR/last-status.json"
JOURNAL_ERR="$BACKUP_DIR/last-error.log"

# `/data/backups` appartient à root : le répertoire du projet se crée une fois (`sudo mkdir`,
# `chown serveuria`), comme ceux des autres projets ; sans lui, aucun statut ne peut être écrit.
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR" || { echo "ÉCHEC sauvegarde tarjih : $BACKUP_DIR inaccessible (le créer en root, propriétaire serveuria)" >&2; exit 1; }
: > "$JOURNAL_ERR"
DEBUT="$(date +%s)"
SHA_SCRIPT="$(sha256sum "$0" | cut -d' ' -f1)"
SHA_COMPTES="$(sha256sum "$ICI/comptes.sql" | cut -d' ' -f1)"

echouer() { # cause nommée, statut écrit DANS TOUS LES CAS, code 1
  printf '{"status":"failed","reason":"%s","timestamp":"%s","sha256_script":"%s"}\n' "$1" "$TS" "$SHA_SCRIPT" > "$STATUT"
  echo "ÉCHEC sauvegarde tarjih : $1 — voir $JOURNAL_ERR" >&2
  exit 1
}

# UN candidat exactement : deux conteneurs signalent un déploiement en cours ou un
# dédoublement, et sauvegarder « le premier » masquerait le problème (SOP-026 étape 10).
CANDIDATS="$(docker ps --filter "name=^${CONTENEUR_ATTENDU}$" --format '{{.Names}} {{.Image}}')"
[ "$(printf '%s\n' "$CANDIDATS" | grep -c .)" -eq 1 ] || echouer "conteneur_non_unique"
[ "${CANDIDATS#* }" = "$IMAGE_ATTENDUE" ] || echouer "image_inattendue_${CANDIDATS#* }"
CONTENEUR="${CANDIDATS%% *}"

COMPTES_SQL="$(cat "$ICI/comptes.sql")" || echouer "comptes_sql_absent"
# Les comptes se lisent AVANT le dump : entre les deux, une seconde. Une publication qui
# aboutirait pile à cet instant ferait diverger la preuve d'une ligne, et la vérification
# le dirait : c'est le prix d'une preuve honnête, pas un défaut à masquer.
COMPTES="$(docker exec "$CONTENEUR" psql -U supabase_admin -d postgres -At -c "$COMPTES_SQL" 2>>"$JOURNAL_ERR")" || echouer "comptes_illisibles"

docker exec "$CONTENEUR" pg_dump -U supabase_admin -Fc -d postgres > "$FICHIER.tmp" 2>>"$JOURNAL_ERR" || { rm -f "$FICHIER.tmp"; echouer "pg_dump_error"; }
TAILLE="$(stat -c%s "$FICHIER.tmp")"
[ "$TAILLE" -ge "$TAILLE_MIN" ] || { rm -f "$FICHIER.tmp"; echouer "dump_trop_petit_${TAILLE}"; }
mv "$FICHIER.tmp" "$FICHIER" && chmod 600 "$FICHIER"
printf '%s\n' "$COMPTES" > "$FICHIER.comptes" && chmod 600 "$FICHIER.comptes"
SHA_DUMP="$(sha256sum "$FICHIER" | cut -d' ' -f1)"

# Chiffré AVANT transport (SOP-026 étape 10b) : `auth.users` et les montants d'un tenant
# réel ne voyagent ni ne dorment en clair hors de cet hôte. Le clair reste ici (0600) pour
# l'exercice quotidien ; seul le `.gpg` part. L'hôte ne sait pas déchiffrer : la preuve de
# déchiffrement est l'exercice mensuel depuis la copie distante (`verif-distante.ps1`).
gpg --batch --yes --quiet --trust-model always -r "$EMPREINTE_GPG" --output "$FICHIER.gpg" --encrypt "$FICHIER" 2>>"$JOURNAL_ERR" || echouer "chiffrement_echec"
chmod 600 "$FICHIER.gpg"
# Sans clé secrète, gpg 2.4 ne rend que l'en-tête (« chiffré avec une clef rsa4096, identifiant … »),
# sur stderr, dans la langue de l'hôte et avec un code 2 (pas de clé secrète) : on lit la sortie
# dans une variable (pipefail rendrait le tube faux) et on y cherche l'identifiant, pas le texte.
ENTETE="$(gpg --batch --list-packets "$FICHIER.gpg" 2>&1 || true)"
printf '%s' "$ENTETE" | grep -q "$SOUS_CLE_CHIFFREMENT" || echouer "chiffre_pour_une_autre_cle"

# Rétention GFS (défaut de la bibliothèque SOP-026, validé pour Firasa le 2026-09-07 : 7
# quotidiens, 8 hebdomadaires, 12 mensuels) ; une version publiée est immuable et doit se
# retrouver longtemps après. La date vient du NOM du fichier, jamais du mtime (une copie ou
# un rsync réécrivent un mtime). On construit la liste de ce qu'on GARDE, puis on supprime
# le reste : l'inverse fait disparaître un fichier à la première expression fausse.
selection_gfs() {
  local fichiers format garde
  fichiers="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-tarjih-*.dump' -printf '%f\n' 2>/dev/null | sort -r)"
  [ -n "$fichiers" ] || return 0
  printf '%s\n' "$fichiers" | head -"$GFS_QUOTIDIENS"
  for format in '+%G-%V:'"$GFS_HEBDOMADAIRES" '+%Y-%m:'"$GFS_MENSUELS"; do
    garde="${format##*:}"
    printf '%s\n' "$fichiers" | while IFS= read -r f; do
      jour="${f#db-tarjih-}"; jour="${jour%%T*}"
      printf '%s %s\n' "$(date -d "$jour" "${format%%:*}" 2>/dev/null || echo invalide)" "$f"
    done | awk '$1 != "invalide" && !vu[$1]++' | head -"$garde" | cut -d' ' -f2-
  done
}
A_GARDER="$(selection_gfs | sort -u)"
if [ -n "$A_GARDER" ]; then   # sélection vide alors que des dumps existent = expression cassée, ne rien supprimer
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    printf '%s\n' "$A_GARDER" | grep -qxF "$f" || rm -f "$BACKUP_DIR/$f" "$BACKUP_DIR/$f.comptes" "$BACKUP_DIR/$f.gpg"
  done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'db-tarjih-*.dump' -printf '%f\n')
fi

DUREE=$(( $(date +%s) - DEBUT ))
printf '{"status":"ok","file":"%s","size_bytes":%s,"sha256":"%s","comptes":"%s","duration_seconds":%s,"timestamp":"%s","sha256_script":"%s","sha256_comptes_sql":"%s","hors_site":false}\n' \
  "$FICHIER" "$TAILLE" "$SHA_DUMP" "$COMPTES" "$DUREE" "$TS" "$SHA_SCRIPT" "$SHA_COMPTES" > "$STATUT"
echo "Sauvegarde OK : $FICHIER ($TAILLE octets, ${DUREE}s, comptes $COMPTES)"

# Copie HORS SITE, sur la machine qui reçoit déjà celles du parc (même clé, même racine que
# `ops/infra/backup-pg-all.sh`, `ops/firasa`, `ops/nahj`). Seuls les `.gpg`, les comptes et
# le statut partent : jamais le clair. Un échec de copie ne défait pas la sauvegarde locale,
# il se lit dans le statut (`hors_site:false`) et sous 48 h dans docker-watch.
REMOTE="$(grep -o '^REMOTE=.*' "$HOME/ops/infra/backup-pg-all.sh" | cut -d= -f2- | tr -d '"')"
CLE_SSH="$HOME/.ssh/hallab_backup"
if [ -n "$REMOTE" ] && [ -r "$CLE_SSH" ]; then
  SSH_OPTS="ssh -i $CLE_SSH -o BatchMode=yes -o ConnectTimeout=20"
  if $SSH_OPTS "$REMOTE" "mkdir -p serveuria-backups/tarjih" 2>>"$JOURNAL_ERR" \
     && rsync -a --delete-after -e "$SSH_OPTS" \
          --include='db-tarjih-*.dump.gpg' --include='db-tarjih-*.dump.comptes' --include='last-status.json' --exclude='*' \
          "$BACKUP_DIR/" "$REMOTE:serveuria-backups/tarjih/" 2>>"$JOURNAL_ERR"; then
    sed -i 's/"hors_site":false/"hors_site":true/' "$STATUT"
    echo "Copie hors site OK : $REMOTE:serveuria-backups/tarjih/"
  else
    echo "AVERTISSEMENT : copie hors site en échec — voir $JOURNAL_ERR" >&2
  fi
else
  echo "AVERTISSEMENT : pas de destination hors site configurée" >&2
fi
