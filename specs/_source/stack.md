---
project_id: tarjih
project_type: web-saas
created: 2026-08-07
---

# Stack — Tarjih

## Type de projet

**Web SaaS multi-tenant avec service de calcul spécialisé.** L’application combine authentification, données financières sensibles, collaboration gouvernée et traitements Python déterministes.

## Stack principale

### Application web

- Next.js App Router, installé dans sa version stable courante ;
- React et TypeScript en mode strict ;
- Server Components et Server Actions par défaut ;
- Tailwind CSS pour l’interface ;
- composants HTML accessibles avant toute bibliothèque de grille ou de formulaire.

### Autorité de données et d’accès

- Supabase PostgreSQL ;
- Supabase Auth avec `@supabase/ssr` ;
- Row Level Security sur toutes les tables exposées ;
- migrations SQL versionnées ;
- contraintes PostgreSQL pour les invariants financiers et les transitions critiques.

### Calcul financier

- Python avec typage strict ;
- FastAPI et Pydantic uniquement lorsque le service HTTP devient nécessaire ;
- fonctions de calcul pures, testables indépendamment du transport ;
- déploiement prévu sur Railway, séparé de l’application web.

### Déploiement cible

- Vercel pour Next.js ;
- Supabase managé pour PostgreSQL et Auth ;
- Railway pour le calcul Python.

## Justification

Next.js fournit le produit web transactionnel et le rendu serveur. PostgreSQL avec RLS place l’isolation tenant au niveau de l’autorité de données, ce qui est indispensable pour des budgets financiers. Python reste limité à son avantage réel : calculs, réconciliations, simulations et génération d’artefacts.

La documentation officielle Next.js recommande l’App Router et son initialiseur courant avec TypeScript, ESLint et Tailwind. La documentation Supabase exige l’activation de RLS sur les tables des schémas exposés et documente son intégration avec Auth. Ces choix devront être revalidés au moment de chaque mise à niveau.

## Alternatives évaluées

| Alternative | Choisie | Motif |
|---|---:|---|
| Next.js + Convex | Non | les règles d’accès financières et les contraintes relationnelles sont mieux portées par PostgreSQL/RLS |
| TanStack Start + FastAPI généraliste | Non | ajoute un backend applicatif complet avant qu’il soit nécessaire |
| application Python monolithique | Non | moins adaptée au produit web collaboratif et au typage partagé de l’interface |
| moteur financier TypeScript | Non | contredit la décision validée d’utiliser Python pour les calculs déterministes |

## Extensions retenues maintenant

| Besoin | Choix | Motif |
|---|---|---|
| Authentification | Supabase Auth SSR | intégration directe avec RLS |
| Validation de données | contraintes PostgreSQL + types TypeScript/Pydantic aux frontières | la base reste l’autorité |
| Audit | tables append-only et triggers ciblés | traçabilité indépendante de l’interface |
| Import/export | Python, ajouté dans la tranche concernée | cohérence avec le moteur financier et le traitement Excel |

## Extensions différées

- Stripe : aucune facturation dans la première tranche ;
- Supabase Realtime : ajout uniquement si la concurrence d’édition l’exige réellement ;
- file de jobs : ajout lorsque la durée des calculs dépasse la fenêtre HTTP ;
- shadcn/ui et bibliothèque de grille : ajout uniquement après preuve qu’HTML et Tailwind ne suffisent plus ;
- pgvector, SDK LLM et moteur d’évaluation : aucun besoin dans le noyau budgétaire initial.

## Anti-patterns interdits

- aucune table exposée sans RLS ;
- aucun rôle codé uniquement dans le frontend ou dans un JWT librement paramétrable ;
- aucune clé `service_role` dans le navigateur ;
- aucun total consolidé matérialisé avant d’avoir défini sa provenance et sa version ;
- aucun calcul financier officiel dans React, SQL ad hoc ou LLM ;
- aucun accès direct du service Python à une plage de données plus large que le snapshot de calcul signé ;
- aucun GraphQL, Kubernetes, Redis ou bus d’événements sans problème mesuré qui les exige.

## Environnement local prévu

- application web : `http://localhost:3000` ;
- Supabase local : ports attribués par la CLI Supabase ;
- service de calcul : `http://localhost:8000` lorsqu’il sera introduit.

## Sources techniques vérifiées

- Next.js App Router : https://nextjs.org/docs/app
- installation Next.js : https://nextjs.org/docs/app/getting-started/installation
- Supabase Row Level Security : https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth : https://supabase.com/docs/guides/auth
- déploiement FastAPI : https://fastapi.tiangolo.com/deployment/
