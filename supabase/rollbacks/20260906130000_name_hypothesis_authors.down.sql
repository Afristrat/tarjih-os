-- Retour arrière de 20260906130000_name_hypothesis_authors.sql.
--
-- À appliquer en une seule transaction :
--   psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>
--
-- Ne détruit aucune donnée : la fonction ne fait que lire. Après ce retour,
-- l'écran d'approbation ne peut plus nommer l'auteur d'une hypothèse et revient
-- à « par un contributeur de la dimension ». Le code applicatif qui appelle
-- cette fonction doit donc être ramené en arrière avec elle, sinon l'écran
-- d'une hypothèse échoue à la lecture.

drop function public.list_hypothesis_authors(uuid);

delete from supabase_migrations.schema_migrations where version = '20260906130000';
