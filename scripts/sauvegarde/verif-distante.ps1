# Exercice mensuel de restauration depuis la copie hors site de Tarjih (SOP-026 étape 13b).
# Lance `verif-distante.sh` (Git Bash) à travers le broker de secrets, qui expose la clé
# privée gpg et l'adresse de l'hôte au seul processus enfant, puis les efface.
#
# Planifié sur le poste par la tâche « Tarjih - exercice de restauration distante »
# (schtasks, le 2 de chaque mois) ; se lance aussi à la main :
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\sauvegarde\verif-distante.ps1
# Journal : %LOCALAPPDATA%\tarjih\verif-distante.log (une ligne d'horodatage + la sortie).
$ErrorActionPreference = 'Stop'
$bash = 'C:\Program Files\Git\bin\bash.exe'
$script = Join-Path $PSScriptRoot 'verif-distante.sh'
$journalDir = Join-Path $env:LOCALAPPDATA 'tarjih'
New-Item -ItemType Directory -Force -Path $journalDir | Out-Null
$journal = Join-Path $journalDir 'verif-distante.log'

$commande = "& '$bash' '$script'"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($commande))
$horodatage = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
# Le broker écrit par [Console]::Out, invisible d'une capture `& script` : on le lance comme
# un processus natif (powershell.exe -File), dont la sortie, elle, se capture.
$sortie = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\amans\.claude\scripts\invoke-secret.ps1' `
  -Keys TARJIH_SAUVEGARDE_GPG_PRIVEE_B64,SERVER_HOST -CommandB64 $b64 2>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
Add-Content -Path $journal -Encoding utf8 -Value ("== $horodatage (code $code) ==")
Add-Content -Path $journal -Encoding utf8 -Value ($sortie -join "`n")
$sortie
exit $code
