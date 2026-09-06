-- Qui a proposé cette hypothèse ?
--
-- L'écran d'approbation affichait « par un contributeur de la dimension ».
-- L'asymétrie était réelle : `hypothesis_decisions.decided_by` identifie celui
-- qui APPROUVE, nommément et pour toujours, quand celui qui PROPOSE restait
-- anonyme. Un DAF engage sa responsabilité sur un chiffre ; savoir de qui il
-- vient fait partie de ce qu'il approuve.
--
-- Ce que cette migration n'ouvre PAS : l'annuaire du tenant.
-- `list_tenant_members` reste réservée aux administrateurs. La fonction posée
-- ici ne rend que les auteurs des hypothèses que l'appelant a DÉJÀ le droit de
-- lire — elle ne montre donc personne qu'il ne pouvait pas déjà atteindre, elle
-- lui donne un nom là où il avait un anonymat.

create or replace function public.list_hypothesis_authors(target_tenant_id uuid)
returns table (
  user_id uuid,
  email text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- `security definer` désactive la RLS de `hypotheses` : le périmètre de
  -- lecture est donc réaffirmé ici, explicitement. Sans ce prédicat, la
  -- fonction rendrait les auteurs de dimensions que l'appelant ne voit pas.
  select distinct hypothesis.proposed_by, auth_user.email::text
  from public.hypotheses hypothesis
  join auth.users auth_user on auth_user.id = hypothesis.proposed_by
  where hypothesis.tenant_id = target_tenant_id
    and (select private.is_tenant_member(target_tenant_id))
    and (
      select private.has_dimension_permission(
        target_tenant_id, hypothesis.dimension_id, 'read'
      )
    );
$$;

comment on function public.list_hypothesis_authors(uuid) is
  'Auteurs des hypothèses que l''appelant a le droit de lire, avec leur adresse.'
  ' N''expose aucun membre hors de ce périmètre : ce n''est pas un annuaire.';

revoke all on function public.list_hypothesis_authors(uuid) from public, anon;
grant execute on function public.list_hypothesis_authors(uuid) to authenticated;

-- Inscription au registre, dans la transaction de la migration elle-même.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260906130000', 'name_hypothesis_authors')
on conflict (version) do nothing;
