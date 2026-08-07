# Tarjih

Plateforme financière multi-tenant reliant contributions budgétaires, validation humaine, calcul Python déterministe et consolidation traçable.

## Type

Web SaaS avec service de calcul spécialisé.

## Stack

- Next.js App Router, React, TypeScript strict et Tailwind CSS
- Supabase PostgreSQL, Auth SSR et RLS
- Python typé ; FastAPI uniquement pour exposer le calcul
- Vercel + Supabase + Railway comme cibles de déploiement

## Commandes

```bash
# Renseignées après la task 01 de setup technique.
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Sources de vérité

- [Discovery](specs/_source/discovery.md)
- [PRD](specs/_source/prd.md)
- [Stack](specs/_source/stack.md)
- [Architecture](specs/_source/archi.md)

## Conventions

- TypeScript strict, aucun `any` non justifié et aucune assertion non nulle.
- RLS sur toute table exposée ; clé secrète Supabase exclusivement côté serveur.
- `supabase.auth.getUser()` pour les contrôles d’identité serveur.
- Montants en `numeric`, jamais en flottants.
- Calcul officiel uniquement dans le moteur Python versionné.
- Une hypothèse non approuvée ne produit aucune valeur publiée.
- Une version publiée est immuable.

## Validation obligatoire

Typecheck, lint, tests, build et parcours Playwright critique avant toute déclaration de complétude.

## Anti-patterns

- aucun rôle seulement dans l’interface ;
- aucune donnée inter-tenant, même dans un agrégat ou un export ;
- aucun LLM, paiement, temps réel ou moteur de jobs avant nécessité prouvée ;
- aucune correction silencieuse d’une version financière publiée.
