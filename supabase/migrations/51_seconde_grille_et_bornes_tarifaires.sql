-- =================================================================================================
-- 51 — Lots A4 et A5 : une seconde grille tarifaire, et les bornes des tarifs importés
--
-- POURQUOI (A5). La coquille C-4 est ouverte depuis le lot 5 : `createGrille()` force
-- `is_default: true` et l'écran de réglages ne charge que la grille par défaut. Résultat, la
-- grille dédiée d'un client — que la fiche client propose, que l'éditeur de devis applique et que
-- le bandeau « Grille dédiée appliquée » annonce — ne peut jamais exister. Trois écrans parlent
-- d'une chose que rien ne permet de créer.
--
-- POURQUOI (A4). Les paliers et les tarifs négociés vont désormais entrer par un import de
-- tableur, c'est-à-dire par des colonnes qu'un humain a remplies à la main. Un palier dont la
-- borne haute est sous la borne basse chiffre à zéro sans rien dire ; un prix négatif fait un
-- devis négatif. Ces bornes doivent tenir en base, pas seulement à l'écran.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Une seule grille par défaut, et pas zéro
-- -------------------------------------------------------------------------------------------------
-- La grille par défaut est celle qu'applique tout client qui n'en a pas de dédiée : deux grilles
-- par défaut, et le prix d'un devis dépendrait de l'ordre de lecture de PostgREST.
create or replace function public.trg_une_grille_par_defaut()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(new.is_default, false) then
    update public.grilles_tarifaires
       set is_default = false
     where atelier_id = new.atelier_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end $function$;

revoke all on function public.trg_une_grille_par_defaut() from public, anon, authenticated;

drop trigger if exists une_grille_par_defaut on public.grilles_tarifaires;
create trigger une_grille_par_defaut
  before insert or update of is_default on public.grilles_tarifaires
  for each row execute function public.trg_une_grille_par_defaut();

-- Le filet sous le trigger : si un jour une écriture contourne le trigger, l'index refuse.
create unique index if not exists grilles_une_seule_par_defaut
  on public.grilles_tarifaires (atelier_id)
  where is_default;

-- -------------------------------------------------------------------------------------------------
-- 2. La grille dédiée d'un client appartient à son atelier
-- -------------------------------------------------------------------------------------------------
-- La clé étrangère seule ne le garantit pas : elle vérifie que la grille existe, pas qu'elle est
-- la nôtre. Une écriture bien formée pourrait rattacher un client à la grille d'un autre atelier
-- et lui appliquer ses prix.
create or replace function public.trg_grille_du_meme_atelier()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.grille_id is not null and not exists (
       select 1 from public.grilles_tarifaires g
        where g.id = new.grille_id and g.atelier_id = new.atelier_id) then
    raise exception 'GRILLE_AUTRE_ATELIER'
      using hint = 'Cette grille tarifaire n''appartient pas à votre atelier.';
  end if;
  return new;
end $function$;

revoke all on function public.trg_grille_du_meme_atelier() from public, anon, authenticated;

drop trigger if exists grille_du_meme_atelier on public.clients;
create trigger grille_du_meme_atelier
  before insert or update of grille_id on public.clients
  for each row execute function public.trg_grille_du_meme_atelier();

-- -------------------------------------------------------------------------------------------------
-- 3. Bornes des barèmes (A4)
-- -------------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grille_paliers_bornes_check') then
    alter table public.grille_paliers
      add constraint grille_paliers_bornes_check
      check (surface_min >= 0 and (surface_max is null or surface_max > surface_min));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'grille_paliers_prix_check') then
    alter table public.grille_paliers
      add constraint grille_paliers_prix_check check (prix_m2 >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'client_tarifs_prix_check') then
    alter table public.client_tarifs
      add constraint client_tarifs_prix_check check (prix_ht >= 0);
  end if;
end $$;

comment on constraint grille_paliers_bornes_check on public.grille_paliers is
  'Un palier dont la borne haute passe sous la borne basse n''attrape aucune surface : le devis '
  'se chiffre alors à zéro sans qu''aucun écran ne l''explique.';
