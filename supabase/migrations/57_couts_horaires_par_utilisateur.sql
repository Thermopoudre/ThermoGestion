-- =============================================================================
-- 57 — Un taux horaire par personne (lot C, cahier des charges v3 §3 — C2)
-- =============================================================================
--
-- POURQUOI. `ateliers_couts.taux_horaire` est un taux unique appliqué à toutes les minutes
-- pointées, quel que soit l'opérateur. Un apprenti et un chef d'équipe ne coûtent pourtant pas
-- la même chose : `projet_temps_cout` (et donc `projet_revient`, `client_rentabilite`) sous-estime
-- le prix de revient réel dès qu'un atelier a plus d'un niveau de qualification.
--
-- `users_couts` est cloisonnée exactement comme `ateliers_couts` en LECTURE (responsable et
-- bureau, `acces_commercial()`), mais **pas** en écriture : un membre ne doit pas pouvoir se fixer
-- son propre taux horaire, ni relever celui d'un collègue. Seul `is_owner()` écrit.
--
-- `projet_temps_cout` est reposée avec `WITH (security_invoker = true)` (jamais de
-- `CREATE OR REPLACE VIEW` nu) et ses GRANT sont reposés après coup — un `CREATE OR REPLACE VIEW`
-- réinitialise les privilèges par défaut hérités du schéma, ce n'est pas garanti de survivre.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Table satellite, cloisonnée comme ateliers_couts
-- -----------------------------------------------------------------------------

create table if not exists public.users_couts (
  user_id     uuid primary key references public.users(id) on delete cascade,
  atelier_id  uuid not null references public.ateliers(id) on delete cascade,
  taux_horaire numeric,
  updated_at  timestamptz not null default now()
);

comment on table public.users_couts is
  'Taux horaire propre à chaque membre de l''équipe. Cloisonnée comme ateliers_couts : lecture '
  'responsable/bureau, écriture responsable seul (migration 57).';
comment on column public.users_couts.taux_horaire is
  'NULL = pas de taux propre à cette personne : projet_temps_cout retombe sur ateliers_couts.taux_horaire.';

alter table public.users_couts enable row level security;

-- Lecture : responsable et bureau, comme ateliers_couts (`acces_commercial()`).
drop policy if exists users_couts_select on public.users_couts;
create policy users_couts_select on public.users_couts
  for select to authenticated
  using (atelier_id = public.current_atelier_id() and public.acces_commercial());

-- Écriture : responsable seul. C'est la différence voulue avec ateliers_couts (qui s'ouvre aussi
-- au bureau en écriture) — un taux horaire individuel est une donnée RH, pas un réglage d'atelier.
drop policy if exists users_couts_write on public.users_couts;
create policy users_couts_write on public.users_couts
  for all to authenticated
  using (atelier_id = public.current_atelier_id() and public.is_owner())
  with check (atelier_id = public.current_atelier_id() and public.is_owner()
              and exists (select 1 from public.users u where u.id = user_id and u.atelier_id = atelier_id));

revoke all on public.users_couts from anon;


-- -----------------------------------------------------------------------------
-- 2. projet_temps_cout : le taux de la personne qui a pointé, à défaut celui de l'atelier
-- -----------------------------------------------------------------------------

-- `CREATE OR REPLACE VIEW` plutôt qu'un DROP : `client_rentabilite` dépend de `projet_revient`,
-- qui dépend de `projet_temps_cout` — un DROP en cascade emporterait les deux et devrait tout
-- reposer dans l'ordre. Les colonnes rendues sont identiques (même nom, même ordre) : le remplacement
-- en place est compatible, jamais « nu » puisque `security_invoker = true` est explicite ci-dessous.
create or replace view public.projet_temps_cout
with (security_invoker = true) as
select
  t.projet_id,
  t.atelier_id,
  sum(coalesce(t.minutes, greatest(0, round(extract(epoch from now() - t.debut) / 60)::integer))) as minutes_totales,
  -- Chaque ligne de temps est valorisée à SON propre taux (celui de qui a pointé, sinon celui de
  -- l'atelier) avant d'être sommée : deux opérateurs sur le même chantier ne se moyennent pas,
  -- ils s'additionnent chacun à leur coût réel. `NULL` seulement si aucune ligne du projet n'a de
  -- taux exploitable nulle part (ni personnel ni atelier) — comme avant cette migration.
  case
    when bool_and(coalesce(uc.taux_horaire, ac.taux_horaire) is null) then null::numeric
    else round(
      sum(
        coalesce(t.minutes, greatest(0, round(extract(epoch from now() - t.debut) / 60)::integer))::numeric
        / 60.0 * coalesce(uc.taux_horaire, ac.taux_horaire, 0)
      ),
      2
    )
  end as cout_main_oeuvre
from public.temps_etapes t
left join public.ateliers_couts ac on ac.atelier_id = t.atelier_id
left join public.users_couts uc on uc.user_id = t.user_id
group by t.projet_id, t.atelier_id;

comment on view public.projet_temps_cout is
  'Minutes et coût de main d''œuvre par projet. Chaque ligne de temps est valorisée au taux '
  'personnel de l''opérateur (users_couts), à défaut au taux de l''atelier (ateliers_couts) — '
  'migration 57.';

-- Les GRANT par défaut sur une vue reposée ne sont pas garantis d'avoir survécu au DROP :
-- `authenticated` doit pouvoir la lire (RLS des tables sources fait le tri), `anon` jamais.
grant select on public.projet_temps_cout to authenticated;
revoke all on public.projet_temps_cout from anon;


-- -----------------------------------------------------------------------------
-- 3. projet_revient : consomme le coût déjà calculé par projet_temps_cout, ne le refait pas
-- -----------------------------------------------------------------------------

-- AVANT cette migration, `projet_revient` ignorait `projet_temps_cout.cout_main_oeuvre` et
-- recalculait lui-même `minutes_totales / 60 * ateliers_couts.taux_horaire` — un second calcul,
-- au taux unique de l'atelier, qui aurait rendu le taux personnel posé ci-dessus invisible du
-- prix de revient réel. Il consomme désormais le coût déjà valorisé personne par personne.
create or replace view public.projet_revient
with (security_invoker = true) as
select
  p.id as projet_id,
  p.atelier_id,
  round(coalesce(p.poudre_conso_kg, 0) * coalesce(lc.prix_kg, pc.prix_kg, 0), 2) as cout_poudre,
  round(coalesce(t.cout_main_oeuvre, 0), 2) as cout_main_oeuvre,
  round(coalesce(e.part_kwh, 0) * coalesce(a.prix_kwh, 0), 2) as cout_energie,
  round(
    (
      coalesce(p.poudre_conso_kg, 0) * coalesce(lc.prix_kg, pc.prix_kg, 0)
      + coalesce(t.cout_main_oeuvre, 0)
      + coalesce(e.part_kwh, 0) * coalesce(a.prix_kwh, 0)
    ) * (1 + coalesce(ac.frais_generaux_pct, 0) / 100.0),
    2
  ) as revient_total
from public.projets p
join public.ateliers a on a.id = p.atelier_id
left join public.ateliers_couts ac on ac.atelier_id = p.atelier_id
left join public.poudre_couts pc on pc.poudre_id = p.poudre_id
left join public.poudre_lot_couts lc on lc.lot_id = p.lot_id
left join public.projet_temps_cout t on t.projet_id = p.id
left join lateral (
  select sum(
    coalesce(f.conso_kwh, a.four_conso_kwh, 0) *
    case
      when tot.surface > 0 and coalesce(fp.surface_m2, 0) > 0 then fp.surface_m2 / tot.surface
      else 1.0 / nullif(tot.n, 0)
    end
  ) as part_kwh
  from public.fournee_projets fp
  join public.fournees f on f.id = fp.fournee_id
  join lateral (
    select count(*) as n, coalesce(sum(x.surface_m2), 0) as surface
    from public.fournee_projets x where x.fournee_id = f.id
  ) tot on true
  where fp.projet_id = p.id
) e on true
where public.capacite_ouverte(p.atelier_id, 'rentabilite') and public.acces_commercial();

comment on view public.projet_revient is
  'Prix de revient réel par projet : poudre au prix du lot, main d''œuvre au taux personnel de '
  'chaque opérateur (via projet_temps_cout), quote-part d''énergie du four, frais généraux. '
  'La non-qualité (NC directes + fournée au prorata de surface) est ajoutée en migration 59.';

grant select on public.projet_revient to authenticated;
revoke all on public.projet_revient from anon;
