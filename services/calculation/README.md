# Moteur de calcul — `tarjih_calculation`

Cœur de calcul déterministe de Tarjih. **Fonction pure, sans dépendance externe** :
aucun accès réseau, aucune horloge, aucun aléa, aucun état global. C'est ce qui
rend `output_hash` reproductible.

## Exécuter les contrôles

```bash
cd services/calculation
PYTHONPATH=src python -m unittest discover -s tests
```

Déterminisme entre processus (l'empreinte ne doit pas dépendre de la graine de
hachage de l'interpréteur) :

```bash
PYTHONHASHSEED=0 python -c "import sys; sys.path[:0]=['src','tests']; from test_engine import snapshot; from tarjih_calculation import calculate; print(calculate(snapshot()).output_hash)"
PYTHONHASHSEED=random python -c "import sys; sys.path[:0]=['src','tests']; from test_engine import snapshot; from tarjih_calculation import calculate; print(calculate(snapshot()).output_hash)"
```

## Contrat

`calculate(payload) -> CalculationResult`. Le `payload` est un snapshot déjà
filtré par les droits : le moteur ne reçoit aucun cookie, ne choisit jamais le
tenant et ne relit jamais la base (`specs/_source/archi.md:100`).

Toute anomalie lève une `SnapshotError` portant un `code` stable — le backend
marque alors le run en échec et ne publie aucune valeur.

## Modèles

Un seul pipeline, trois résolveurs. Le modèle est figé par version budgétaire :
une version publiée est immuable, son modèle de calcul aussi.

| Modèle | Forme de `hypotheses[].value` |
|---|---|
| `direct` | `{"account_code": "61", "amounts": [{"period_id": "…", "amount": "1000.50"}]}` |
| `cost_center` | identique à `direct`, restreint aux comptes de charge d'une dimension de type `department` |
| `driver` | `{"driver": "volume_price", "account_code": "70", "periods": [{"period_id": "…", "volume": "100", "unit_price": "12.5"}]}` <br> `{"driver": "percent_of", "account_code": "61", "base_account_code": "70", "rate": "0.35", "period_ids": ["…"]}` |

`percent_of` s'applique à une base résolue lors de la première passe. Un
pourcentage d'un pourcentage est refusé : il créerait un ordre de calcul
implicite, donc un résultat dépendant de l'ordre de lecture.

## Deux règles qui ne sont pas des détails

**Les nombres arrivent en chaîne, jamais en nombre JSON.** `0.1` n'a pas de
représentation binaire exacte ; un `float` est refusé à la frontière plutôt que
converti en silence.

**Un montant publiable et un inducteur ne sont pas soumis à la même contrainte.**
Un montant tient dans `numeric(24, 6)` ; un prix unitaire ou un taux horaire
porte légitimement plus de six décimales. C'est le produit final qui est arrondi,
une seule fois, à l'agrégation.

## Limite connue

Le jeu de formules métier n'est pas tranché : `specs/_source/prd.md:138` pose la
question du modèle économique pilote et elle reste ouverte. Les trois modèles
ci-dessus fournissent l'arithmétique et les garde-fous, pas une sémantique
sectorielle. La convention d'arrondi (`ROUND_HALF_UP`) est marquée dans
`engine.py` pour réexamen à ce moment-là.
