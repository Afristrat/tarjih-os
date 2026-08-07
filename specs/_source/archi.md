---
project_id: tarjih
project_type: web-saas
created: 2026-08-07
---

# Architecture V1 — Tarjih

## Décision structurante

Tarjih est un monolithe web Next.js adossé à Supabase pour les transactions, l’authentification et les autorisations. Le moteur Python est un service étroit sans autorité métier : il reçoit un snapshot de calcul explicitement autorisé, exécute une version de formules et retourne des résultats contrôlables. Il ne décide ni des droits, ni des approbations, ni de la publication.

## Invariants

1. Toute ligne financière appartient directement à un tenant.
2. Toute table exposée possède RLS et des politiques explicites.
3. Un utilisateur ne reçoit jamais les données d’un autre tenant ou d’une dimension non attribuée.
4. Une hypothèse `proposed` ne peut alimenter aucun calcul publié.
5. Une version publiée est immuable ; toute correction crée une version suivante.
6. Le calcul officiel est exécuté par une version identifiée du moteur Python.
7. Une publication est atomique : tous les contrôles passent ou aucun résultat n’est visible.
8. Toute mutation financière ou d’autorisation produit un événement d’audit.

## Modèle de données V1

| Table | Rôle | Champs structurants |
|---|---|---|
| `tenants` | entreprise propriétaire | `id`, `name`, `base_currency`, `created_at` |
| `tenant_memberships` | rattachement utilisateur–tenant | `tenant_id`, `user_id`, `role`, `status` |
| `dimensions` | entités, départements, projets ou produits | `id`, `tenant_id`, `kind`, `code`, `name`, `parent_id` |
| `dimension_grants` | droits fins d’un membre | `tenant_id`, `user_id`, `dimension_id`, `can_read`, `can_contribute`, `can_approve`, `can_export` |
| `financial_accounts` | référentiel de comptes de pilotage | `id`, `tenant_id`, `code`, `name`, `statement`, `normal_balance` |
| `periods` | périodes budgétaires | `id`, `tenant_id`, `starts_on`, `ends_on`, `status` |
| `budget_cycles` | exercice et workflow global | `id`, `tenant_id`, `name`, `status` |
| `budget_versions` | snapshot versionné | `id`, `tenant_id`, `cycle_id`, `version_no`, `status`, `parent_version_id`, `input_hash` |
| `hypotheses` | propositions et hypothèses approuvées | `id`, `tenant_id`, `version_id`, `dimension_id`, `parameter_key`, `value`, `unit`, `status`, `row_version` |
| `hypothesis_decisions` | décisions humaines append-only | `id`, `tenant_id`, `hypothesis_id`, `decision`, `decided_by`, `reason`, `created_at` |
| `calculation_runs` | exécutions Python | `id`, `tenant_id`, `version_id`, `engine_version`, `input_hash`, `output_hash`, `status` |
| `budget_values` | résultats publiés | `id`, `tenant_id`, `version_id`, `calculation_run_id`, `dimension_id`, `account_id`, `period_id`, `amount`, `currency` |
| `audit_events` | piste d’audit append-only | `id`, `tenant_id`, `actor_id`, `action`, `object_type`, `object_id`, `before_hash`, `after_hash`, `created_at` |
| `exports` | demandes et artefacts filtrés | `id`, `tenant_id`, `requested_by`, `version_id`, `scope_hash`, `file_hash`, `status`, `expires_at` |

Les valeurs monétaires utilisent `numeric`, jamais `float`. Les devises sont des codes ISO 4217 contrôlés. Les dates et horodatages sont stockés avec des types PostgreSQL natifs.

## Contraintes de base

- unicité des codes par tenant et type de dimension ;
- unicité de `version_no` par cycle ;
- montant non nul et devise obligatoire pour une valeur publiée ;
- états limités par `check` constraints ;
- clés étrangères incluant `tenant_id` lorsque nécessaire afin d’empêcher une relation inter-tenant ;
- `hypothesis_decisions` et `audit_events` sans politique `UPDATE` ou `DELETE` ;
- trigger de contrôle des transitions d’état ;
- contrôle optimiste par `row_version` sur les hypothèses.

## Autorisation PostgreSQL

Trois fonctions internes centralisent les prédicats sans exposer de données :

- `private.is_tenant_member(tenant_id)` ;
- `private.has_tenant_role(tenant_id, allowed_roles[])` ;
- `private.has_dimension_permission(tenant_id, dimension_id, permission)`.

Elles sont `security definer`, fixent un `search_path` sûr et utilisent `auth.uid()`. Elles ne doivent jamais accepter un `user_id` fourni par le client.

### Matrice V1

| Objet | Contributeur | DAF | DG | Administrateur tenant |
|---|---|---|---|---|
| dimensions attribuées | lecture | toutes | toutes | toutes |
| hypothèses attribuées | proposer/modifier avant décision | lire et décider | lire et arbitrer | administrer les droits |
| calculs | résultats de son périmètre | tous | tous | aucun droit financier implicite |
| consolidation | non | oui | oui | non par défaut |
| export | périmètre autorisé | complet | complet | selon attribution explicite |
| rôles et grants | non | non | non | administrer |

Le rôle ne remplace pas les grants dimensionnels. Un administrateur technique n’obtient pas automatiquement l’accès financier.

## Authentification

- Supabase Auth par e-mail et mot de passe dans la première tranche ;
- cookies SSR via `@supabase/ssr` ;
- vérification serveur avec `supabase.auth.getUser()` ;
- aucune confiance accordée aux seuls éléments de session côté client ;
- MFA exigée ultérieurement avant suppression en masse, modification des droits critiques et publication selon politique tenant.

## Cycle de calcul

```text
1. Le backend verrouille logiquement la version candidate.
2. Il sélectionne uniquement les hypothèses approuvées et autorisées.
3. Il sérialise un snapshot canonique et calcule `input_hash`.
4. Il appelle le moteur Python avec `engine_version` et un identifiant idempotent.
5. Python valide le schéma, calcule et retourne résultats + `output_hash`.
6. Le backend réconcilie les identités comptables et le périmètre.
7. Une transaction insère les valeurs, marque le run réussi et publie la version.
8. En cas d’échec, aucun `budget_value` publié n’est visible.
```

Le service Python ne reçoit aucun cookie utilisateur et ne choisit jamais le tenant. Son contrat contient seulement le snapshot déjà filtré et un contexte de service vérifié.

## Pages V1

| Route | Fonction | Rendu | Accès |
|---|---|---|---|
| `/` | présentation minimale | serveur | public |
| `/login` | connexion | serveur + formulaire client minimal | public |
| `/app` | cockpit du tenant actif | serveur | membre |
| `/app/budgets` | cycles et versions | serveur | membre selon rôle |
| `/app/budgets/[versionId]` | contributions et statut | serveur | périmètre dimensionnel |
| `/app/hypotheses/[id]` | détail, preuve et décision | serveur | périmètre dimensionnel |
| `/app/consolidation/[versionId]` | résultats consolidés | serveur | DAF ou DG |
| `/app/settings/members` | membres et rôles | serveur | administrateur tenant |
| `/app/settings/dimensions` | dimensions et grants | serveur | administrateur tenant |

Les Server Actions effectuent les mutations ordinaires. Les endpoints HTTP sont réservés au contrat du service Python, aux exports et aux futurs webhooks.

## Structure des dossiers

```text
apps/
  web/
    src/app/
    src/components/
    src/lib/auth/
    src/lib/budgets/
    src/lib/supabase/
    tests/
services/
  calculation/
    src/tarjih_calculation/
    tests/
supabase/
  migrations/
  tests/
packages/
  contracts/
docs/
prompts/
schemas/
specs/
```

Le monorepo sert uniquement à versionner ensemble les contrats et migrations. Aucun orchestrateur de monorepo n’est ajouté tant que les commandes npm et Python simples suffisent.

## Environnements

| Environnement | Cible | Données |
|---|---|---|
| local | Next.js + Supabase CLI + Python local | fictives uniquement |
| preview | Vercel + projet Supabase isolé + Railway preview | synthétiques |
| production | Vercel + Supabase + Railway | tenants réels |

## Pipeline de validation

1. formatage et lint ;
2. typecheck TypeScript et Python ;
3. tests SQL/RLS et tests unitaires du calcul ;
4. build Next.js ;
5. parcours Playwright contribution–validation–calcul–consolidation ;
6. tests négatifs inter-tenant et export RBAC ;
7. déploiement preview avant production.

## Index initiaux

- `tenant_memberships(user_id, tenant_id)` ;
- `dimension_grants(user_id, tenant_id, dimension_id)` ;
- `dimensions(tenant_id, kind, code)` ;
- `hypotheses(tenant_id, version_id, dimension_id, status)` ;
- `budget_values(tenant_id, version_id, dimension_id, period_id, account_id)` ;
- `audit_events(tenant_id, created_at desc)`.

Les index sont créés dans les migrations ordinaires. `CREATE INDEX CONCURRENTLY` est réservé aux évolutions de production hors transaction.

## Déploiement et secrets

- secrets uniquement dans les gestionnaires d’environnement des plateformes ;
- URL et clé publique Supabase accessibles au frontend ;
- clé `service_role` uniquement côté serveur, et évitée dans les chemins utilisateurs ordinaires ;
- contrat de service Python authentifié séparément ;
- aucun payload financier complet dans les logs ;
- sauvegardes et restauration testées avant ouverture à des données réelles.

## Décisions différées

- moteur de jobs et reprises longues ;
- temps réel ;
- MFA et approbations multiples configurables ;
- stockage objet des exports ;
- API publique ;
- paiements ;
- missions IA et connecteurs Saqr/Bassira.
