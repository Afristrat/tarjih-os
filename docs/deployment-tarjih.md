# Déploiement Tarjih

État vérifié le 7 août 2026.

## Ressources publiques

- dépôt public : `https://github.com/Afristrat/tarjih-os` ;
- application : `https://tarjih-os.com` ;
- API Supabase : `https://api.tarjih-os.com` ;
- santé web : `https://tarjih-os.com/health`.

## Isolation

Tarjih ne partage aucune base Supabase avec un autre produit. La pile vit dans le projet Coolify `Tarjih` et utilise :

- projet Coolify : `n3njfl7sfu0hatepq5ihugid` ;
- application web : `l3fov9fbnjvrgt5ly75b7g5r` ;
- service Supabase : `f10v8td71bwii32blb9lalfk` ;
- volume PostgreSQL : `f10v8td71bwii32blb9lalfk_supabase-db-data` ;
- tunnel Cloudflare : `ab534be3-2f8c-4b5e-ac6a-0865a446e567`.

Le connecteur Cloudflare appartient au Compose Supabase Tarjih. Il rejoint uniquement le réseau Supabase dédié et le réseau d’ingress Coolify. Le jeton du tunnel reste dans un fichier serveur protégé en mode `0600` ; il n’est ni versionné ni exposé dans cette documentation.

## Limites de ressources

| Composant | Mémoire maximale | Réservation | CPU maximal |
|---|---:|---:|---:|
| Web Tarjih | 768 Mio | 256 Mio | 1 CPU |
| PostgreSQL | 4 Gio | 1 Gio | 2 CPU |
| Kong | 768 Mio | 192 Mio | 1 CPU |
| Analytics et MinIO | 1 Gio chacun | 256 Mio | 0,75 CPU |
| Studio | 768 Mio | 192 Mio | 0,5 CPU |
| Autres services Supabase | 512 Mio chacun | 128 Mio | 0,5 CPU |
| Tunnel Cloudflare | 256 Mio | 64 Mio | 0,25 CPU |

## Preuves de fonctionnement

- application Coolify : `running:healthy` ;
- service Supabase : `running:healthy` ;
- tunnel Cloudflare : `healthy` ;
- santé web : HTTP `200` ;
- santé GoTrue avec clé publique : HTTP `200` ;
- schéma : 4 contrôles pgTAP réussis ;
- isolation multi-tenant et RLS : 13 contrôles pgTAP réussis ;
- navigateur public : accueil et connexion accessibles, `/app` redirige un visiteur non authentifié vers la connexion, sans erreur console.

Les secrets applicatifs sont gérés dans Coolify. Aucun secret ne doit être ajouté au dépôt Git.
