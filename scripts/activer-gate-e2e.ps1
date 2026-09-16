# Active la gate de recette exigée par le système (`.github/workflows/deploy.yml`).
#
# À lancer par le broker de secrets, jamais autrement : les valeurs partent du
# coffre DPAPI vers les secrets de dépôt GitHub sans passer par le transcript.
#
#   & 'C:\Users\amans\.claude\scripts\invoke-secret.ps1' `
#     -Keys TARJIH_E2E_PW_CONTRIB,TARJIH_E2E_PW_DAF,TARJIH_E2E_PW_DG,TARJIH_E2E_PW_INTRUS,TARJIH_COOLIFY_DEPLOY_TOKEN,COOLIFY_URL `
#     -Command '& "C:\projets\Budget & CFO\scripts\activer-gate-e2e.ps1"'
#
# Le jeton Coolify est celui à portée read+deploy seulement (`tarjih-ci-deploy-2026-09-16`,
# id 19), jamais le jeton root du coffre. Désactivation : `gh variable set TARJIH_GATE_E2E
# --body false` suffit, les secrets peuvent rester ou être supprimés (`gh secret delete`).
$ErrorActionPreference = 'Stop'
$repo = 'Afristrat/tarjih-os'

foreach ($nom in 'TARJIH_E2E_PW_CONTRIB', 'TARJIH_E2E_PW_DAF', 'TARJIH_E2E_PW_DG', 'TARJIH_E2E_PW_INTRUS') {
    $valeur = (Get-Item -Path "env:$nom").Value
    if ([string]::IsNullOrWhiteSpace($valeur)) { throw "Clé $nom absente de l'environnement du broker." }
    $valeur | gh secret set $nom --repo $repo
    Write-Output ("secret {0} déposé (longueur {1})" -f $nom, $valeur.Length)
}

$jeton = $env:TARJIH_COOLIFY_DEPLOY_TOKEN
if ([string]::IsNullOrWhiteSpace($jeton)) { throw 'Clé TARJIH_COOLIFY_DEPLOY_TOKEN absente.' }
$jeton | gh secret set COOLIFY_API_TOKEN --repo $repo
Write-Output ("secret COOLIFY_API_TOKEN déposé (longueur {0}, portée read+deploy)" -f $jeton.Length)

gh variable set COOLIFY_URL --repo $repo --body $env:COOLIFY_URL
gh variable set TARJIH_GATE_E2E --repo $repo --body 'true'
Write-Output 'variables COOLIFY_URL et TARJIH_GATE_E2E=true posées'

gh secret list --repo $repo
gh variable list --repo $repo
