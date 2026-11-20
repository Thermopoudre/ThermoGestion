-- =================================================================================================
-- 76b — Correction de trg_figer_cgv() (migration 76) : PostgreSQL NE GARANTIT PAS l'ordre
-- d'évaluation gauche-à-droite des opérandes d'un AND/OR (voir la documentation officielle :
-- « the parts of an implicit AND clause are not necessarily evaluated left-to-right »).
--
-- La version d'origine écrivait tout dans une seule expression :
--   tg_table_name = 'factures' and new.cgv_texte is null and ... and coalesce(new.origine, ...) = ...
-- `new.origine` n'existe pas sur `devis` : le planificateur pouvait évaluer ce fragment AVANT
-- `tg_table_name = 'factures'`, et une simple insertion dans `devis` levait alors
-- `record "new" has no field "origine"` — vu dès le premier test écrit pour cette migration
-- (tests/cgv.test.ts), avant toute mise en service.
--
-- Le correctif isole la référence à `origine` dans un bloc `IF` imbriqué, atteint seulement une
-- fois qu'on est SÉQUENTIELLEMENT entré dans la branche `factures` : l'exécution d'instructions
-- PL/pgSQL, contrairement à l'évaluation d'une expression composée, est bien déterministe.
-- =================================================================================================
create or replace function public.trg_figer_cgv()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_cgv_client text;
  v_cgv_atelier text;
  v_calculer boolean := false;
begin
  if tg_table_name = 'devis' then
    v_calculer := new.cgv_texte is null and new.status in ('envoye', 'signe');
  elsif tg_table_name = 'factures' then
    if new.cgv_texte is null and new.status in ('emise', 'payee', 'annulee') then
      -- `origine` n'existe que sur `factures` : cette référence ne doit jamais se trouver dans la
      -- même expression qu'un test sur `devis` (voir l'en-tête de fichier).
      v_calculer := coalesce(new.origine, 'application') = 'application';
    end if;
  end if;

  if v_calculer then
    select c.cgv, a.cgv into v_cgv_client, v_cgv_atelier
      from public.ateliers a
      left join public.clients c on c.id = new.client_id
     where a.id = new.atelier_id;
    new.cgv_texte := nullif(trim(coalesce(v_cgv_client, v_cgv_atelier, '')), '');
  end if;

  return new;
end $function$;

comment on function public.trg_figer_cgv() is
  'Recopie sur le document (devis.cgv_texte / factures.cgv_texte) les conditions générales en '
  'vigueur (surcharge du client, sinon défaut de l''atelier) au premier passage en "envoyé"/"signé" '
  '(devis) ou "émise"/"payée"/"annulée" (facture). N''écrase jamais un cgv_texte déjà posé. '
  'Corrigée en migration 76b : la référence à `origine` (propre à `factures`) est isolée dans un '
  'IF imbriqué pour ne jamais partager une expression booléenne avec un test sur `devis`.';

revoke all on function public.trg_figer_cgv() from public, anon, authenticated;
