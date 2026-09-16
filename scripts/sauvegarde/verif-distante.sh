#!/usr/bin/env bash
# Exercice MENSUEL depuis la copie DISTANTE (SOP-026 étape 13b) : l'exercice quotidien prouve
# le dump local en clair ; sans celui-ci, la copie hors site est exactement ce que la SOP
# dénonce, un fichier daté que personne n'a jamais restauré, et le chiffrement n'a jamais
# été prouvé réversible.
#
# Tourne sur le POSTE (Git Bash), lancé par `verif-distante.ps1` à travers le broker de
# secrets : la clé privée gpg (`TARJIH_SAUVEGARDE_GPG_PRIVEE_B64`) n'existe qu'ici, en
# mémoire, dans un trousseau temporaire détruit à la sortie. L'hôte ne la voit jamais.
#
#   1. par l'hôte (qui seul porte la clé vers la machine hors site), lire le dernier
#      `db-tarjih-*.dump.gpg` distant et ses comptes ;
#   2. déchiffrer sur le poste ;
#   3. renvoyer le clair sur l'hôte (0600, /tmp), y jouer `sauvegarde-tarjih-verif.sh … distant`
#      (témoin neuf, comptes comparés), puis effacer le clair.
#
# Variables : TARJIH_SAUVEGARDE_GPG_PRIVEE_B64 (coffre) ; SERVER_HOST (coffre, SOP-008) ou
# TARJIH_SSH (commande ssh complète vers l'hôte, prioritaire).
set -euo pipefail
: "${TARJIH_SAUVEGARDE_GPG_PRIVEE_B64:?clé privée absente — lancer par le broker}"
if [ -z "${TARJIH_SSH:-}" ]; then
  : "${SERVER_HOST:?SERVER_HOST absent du coffre et TARJIH_SSH non fourni}"
  TARJIH_SSH="ssh -i $HOME/.ssh/serveurai_mnemo -o BatchMode=yes -o ConnectTimeout=20 serveuria@$SERVER_HOST"
fi

T="$(mktemp -d)"
export GNUPGHOME="$T/gnupg"
mkdir -p "$GNUPGHOME" && chmod 700 "$GNUPGHOME"
nettoyer() { gpgconf --kill gpg-agent >/dev/null 2>&1 || true; rm -rf "$T"; }
trap nettoyer EXIT

# 1. Dernier fichier distant, lu À TRAVERS l'hôte (la clé `hallab_backup` ne quitte pas l'hôte).
HOTE_DISTANT='R="$(grep -o "^REMOTE=.*" "$HOME/ops/infra/backup-pg-all.sh" | cut -d= -f2- | tr -d "\"")"; ssh -i "$HOME/.ssh/hallab_backup" -o BatchMode=yes -o ConnectTimeout=20 "$R"'
DISTANT="$($TARJIH_SSH "$HOTE_DISTANT 'ls -1t serveuria-backups/tarjih/db-tarjih-*.dump.gpg 2>/dev/null | head -1'")"
[ -n "$DISTANT" ] || { echo "ÉCHEC exercice distant : aucun db-tarjih-*.dump.gpg hors site" >&2; exit 1; }
NOM="$(basename "$DISTANT" .gpg)"                       # db-tarjih-<horodatage>.dump
$TARJIH_SSH "$HOTE_DISTANT 'cat $DISTANT'" > "$T/$NOM.gpg"
$TARJIH_SSH "$HOTE_DISTANT 'cat ${DISTANT%.gpg}.comptes'" > "$T/$NOM.comptes"
echo "distant : $DISTANT ($(stat -c%s "$T/$NOM.gpg") octets chiffrés, comptes $(cat "$T/$NOM.comptes"))"

# 2. Déchiffrement sur le poste, clé importée depuis le coffre, jamais écrite ailleurs.
printf '%s' "$TARJIH_SAUVEGARDE_GPG_PRIVEE_B64" | base64 -d | gpg --batch --quiet --import 2>/dev/null
gpg --batch --quiet --pinentry-mode loopback --passphrase '' --output "$T/$NOM" --decrypt "$T/$NOM.gpg" 2>/dev/null \
  || { echo "ÉCHEC exercice distant : déchiffrement impossible avec la clé du coffre" >&2; exit 1; }
echo "déchiffré : $(stat -c%s "$T/$NOM") octets"

# 3. Restauration dans un témoin neuf SUR L'HÔTE (jamais de Postgres sur le poste), clair effacé quoi qu'il arrive.
$TARJIH_SSH "umask 077 && cat > /tmp/$NOM" < "$T/$NOM"
$TARJIH_SSH "umask 077 && cat > /tmp/$NOM.comptes" < "$T/$NOM.comptes"
$TARJIH_SSH "\$HOME/ops/tarjih/sauvegarde-tarjih-verif.sh /tmp/$NOM distant; rc=\$?; rm -f /tmp/$NOM /tmp/$NOM.comptes; exit \$rc"
