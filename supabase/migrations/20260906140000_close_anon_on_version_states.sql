-- Le rôle anonyme avait sept privilèges sur `public.budget_version_states`.
--
-- Origine : Supabase pose des privilèges par défaut (`alter default privileges`)
-- qui s'appliquent à toute relation créée ensuite, vues comprises. La migration
-- initiale révoquait `anon` avec un `revoke all on all tables in schema public`,
-- qui ne porte que sur les tables existant à ce moment-là. La vue créée par
-- `20260902120000_publish_calculation` est donc née avec DELETE, INSERT,
-- REFERENCES, SELECT, TRIGGER, TRUNCATE et UPDATE pour `anon`.
--
-- Ce que cela exposait RÉELLEMENT : rien, à notre connaissance — la vue est
-- `security_invoker = true`, donc la RLS de `budget_versions` s'applique à
-- l'appelant, et un appelant anonyme n'a ni `auth.uid()` ni appartenance à un
-- tenant. Mais l'invariant du projet ne dit pas « anon ne peut rien lire », il
-- dit « anon n'a AUCUN privilège » : une protection qui ne tient que par un
-- second mécanisme n'est pas la protection annoncée.
--
-- Découvert le 2026-09-06 en rejouant `03_schema_invariants` contre la
-- production — suite qui n'avait pas été rejouée depuis le 2026-09-02. Le
-- contrôle existait et disait vrai ; personne ne l'avait interrogé.

revoke all on public.budget_version_states from anon;

-- Et pour que la prochaine relation ne renaisse pas avec les mêmes privilèges :
-- on ferme la source, pas seulement sa conséquence.
--
-- PORTÉE EXACTE, car elle est plus étroite qu'il n'y paraît : un privilège par
-- défaut appartient au rôle qui l'a posé. Cette base en porte DEUX jeux — un de
-- `postgres`, un de `supabase_admin` — et cette instruction, exécutée en
-- `postgres`, ne retire que le premier. Nos migrations sont appliquées en
-- `postgres`, donc nos futures tables sont couvertes ; une relation créée par
-- `supabase_admin` ne le serait pas.
--
-- Ce n'est donc pas une garantie, c'est une réduction de surface. La garantie
-- reste le contrôle `03_schema_invariants`, qui compte les privilèges de `anon`
-- et doit être rejoué après CHAQUE migration — c'est de ne pas l'avoir fait que
-- vient cette faille.
alter default privileges in schema public revoke all on tables from anon;

insert into supabase_migrations.schema_migrations (version, name)
values ('20260906140000', 'close_anon_on_version_states')
on conflict (version) do nothing;
