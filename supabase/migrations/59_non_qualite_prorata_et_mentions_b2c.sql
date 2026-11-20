-- =============================================================================
-- 59 — Non-qualité cohérente + mentions B2C (lot C, cahier des charges v3 §3 — C7 et C6)
-- =============================================================================
--
-- C7 : `projet_revient` ignorait purement et simplement la non-qualité alors que
-- `client_rentabilite` l'ajoutait déjà — mais seulement pour les NC directement rattachées à un
-- `projet_id`. Une NC posée sur une fournée entière (`fournee_id`, `projet_id` NULL — le défaut
-- touche tout le lot sorti du four ensemble) n'apparaissait ni dans l'un ni dans l'autre : les deux
-- vues « avaient l'air correctes » et se contredisaient dès qu'un atelier utilisait ce cas, déjà
-- courant (une fournée entière mal cuite). `public.projet_non_qualite` devient la SEULE source de
-- vérité, consommée par `projet_revient` ET par `client_rentabilite` : impossible qu'elles divergent
-- à nouveau sur ce point puisqu'elles lisent la même chose.
--
-- C6 : mentions obligatoires B2C. `ateliers.mediateur_nom/mediateur_adresse` existent depuis la
-- migration 56 ; cette migration ne touche que la lecture (PDF, page publique, Réglages) — traitée
-- côté application, pas ici. Le seul ajout côté base est `client_est_particulier`, petit utilitaire
-- SQL pour que le PDF n'ait pas à redéfinir la règle « type = 'particulier' » à trois endroits.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Source unique du coût de non-qualité par projet
-- -----------------------------------------------------------------------------

-- Une NC compte pour ce qu'elle a coûté à CE projet : en entier si elle lui est rattachée
-- directement, au prorata de sa surface dans la fournée sinon (même règle de répartition que le
-- kWh d'une cuisson, `projet_revient` section énergie — un lot qui sort mal cuit pénalise chaque
-- pièce en proportion de ce qu'elle représentait dans le four, pas à parts égales si les pièces
-- ont des tailles très différentes ; à parts égales seulement si aucune surface n'est connue).
create or replace view public.projet_non_qualite
with (security_invoker = true) as
with direct as (
  select n.projet_id, n.id as nc_id, n.retouche, n.rebut, coalesce(n.cout_estime, 0) as cout_part
  from public.non_conformites n
  where n.projet_id is not null
),
fournee as (
  select
    fp.projet_id,
    n.id as nc_id,
    n.retouche,
    n.rebut,
    coalesce(n.cout_estime, 0) * case
      when tot.surface > 0 and coalesce(fp.surface_m2, 0) > 0 then fp.surface_m2 / tot.surface
      else 1.0 / nullif(tot.n, 0)
    end as cout_part
  from public.non_conformites n
  join public.fournee_projets fp on fp.fournee_id = n.fournee_id
  join lateral (
    select count(*) as n, coalesce(sum(x.surface_m2), 0) as surface
    from public.fournee_projets x where x.fournee_id = fp.fournee_id
  ) tot on true
  -- Seules les NC posées sur la fournée SEULE (pas de projet direct) sont réparties : une NC qui a
  -- déjà un projet_id est traitée par le CTE `direct` ci-dessus, jamais les deux à la fois.
  where n.projet_id is null and n.fournee_id is not null
),
tous as (
  select * from direct
  union all
  select * from fournee
)
select
  p.id as projet_id,
  p.atelier_id,
  count(*) filter (where t.retouche)::integer as retouches,
  count(*) filter (where t.rebut)::integer as rebuts,
  round(coalesce(sum(t.cout_part), 0), 2) as cout_non_qualite
from public.projets p
left join tous t on t.projet_id = p.id
group by p.id, p.atelier_id;

comment on view public.projet_non_qualite is
  'Coût de non-qualité par projet : NC directes en entier, NC de fournée seule au prorata de la '
  'surface (parts égales si aucune surface connue). Source unique pour projet_revient et '
  'client_rentabilite — migration 59.';

grant select on public.projet_non_qualite to authenticated;
revoke all on public.projet_non_qualite from anon;


-- -----------------------------------------------------------------------------
-- 2. projet_revient intègre désormais la non-qualité
-- -----------------------------------------------------------------------------

-- Ajout d'une colonne en fin de liste (`cout_non_qualite`) : `CREATE OR REPLACE VIEW` l'autorise
-- sans DROP, donc sans emporter `client_rentabilite` qui en dépend. La non-qualité s'ajoute APRÈS
-- les frais généraux, comme sur `client_rentabilite` (elle n'est pas un poste de production que les
-- frais généraux majorent, c'est un coût déjà complet en lui-même).
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
  ) + coalesce(nq.cout_non_qualite, 0) as revient_total,
  round(coalesce(nq.cout_non_qualite, 0), 2) as cout_non_qualite
from public.projets p
join public.ateliers a on a.id = p.atelier_id
left join public.ateliers_couts ac on ac.atelier_id = p.atelier_id
left join public.poudre_couts pc on pc.poudre_id = p.poudre_id
left join public.poudre_lot_couts lc on lc.lot_id = p.lot_id
left join public.projet_temps_cout t on t.projet_id = p.id
left join public.projet_non_qualite nq on nq.projet_id = p.id
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
  'chaque opérateur, quote-part d''énergie du four, frais généraux, PUIS coût de non-qualité '
  '(projet_non_qualite, migration 59). Ne comprend ni les consommables ni les achats hors poudre.';

grant select on public.projet_revient to authenticated;
revoke all on public.projet_revient from anon;


-- -----------------------------------------------------------------------------
-- 3. client_rentabilite lit la même source que projet_revient
-- -----------------------------------------------------------------------------

-- AVANT : le CTE `nc` de cette vue recalculait sa propre somme, sur les seules NC à `projet_id`
-- direct — les NC de fournée seule n'y entraient jamais. `revient_total` du client pouvait alors
-- être inférieur à la somme des `revient_total` de ses projets (qui, eux, ignoraient toute NC avant
-- cette migration) : deux défauts qui se compensaient par accident plutôt que par cohérence. Le CTE
-- lit désormais `projet_non_qualite`, la même vue que `projet_revient` : les deux s'additionnent
-- exactement pareil.
create or replace view public.client_rentabilite
with (security_invoker = true) as
with prod as (
  select
    p.client_id,
    count(*)::integer as projets,
    coalesce(sum(p.surface_m2), 0) as surface_m2,
    avg(p.surface_m2) as surface_moyenne_m2,
    avg(p.date_promise - p.date_reception) as delai_moyen_jours,
    coalesce(sum(r.cout_poudre), 0) as cout_poudre,
    coalesce(sum(r.cout_main_oeuvre), 0) as cout_main_oeuvre,
    coalesce(sum(r.cout_energie), 0) as cout_energie,
    coalesce(sum(r.revient_total), 0) as revient_projets,
    coalesce(sum(r.revient_total) filter (where not fx.facture), 0) as revient_non_facture,
    count(*) filter (where not fx.facture)::integer as projets_non_factures
  from public.projets p
  left join public.projet_revient r on r.projet_id = p.id
  cross join lateral (
    select
      exists (
        select 1 from public.factures f
         where f.status = any (array['emise','payee'])
           and f.type = any (array['solde','libre'])
           and (f.projet_id = p.id or (p.devis_id is not null and f.devis_id = p.devis_id))
      )
      or exists (
        select 1 from public.bons_livraison b
         where b.projet_id = p.id and b.facture_id is not null
      ) as facture
  ) fx
  where p.status <> 'annule' and p.client_id is not null
  group by p.client_id
),
fact as (
  select
    f.client_id,
    coalesce(sum(case when f.type = 'avoir' then -f.total_ht else f.total_ht end), 0) as facture_ht
  from public.factures f
  where f.status = any (array['emise','payee'])
  group by f.client_id
),
bl as (
  select
    b.client_id,
    count(*)::integer as bl_a_facturer,
    coalesce(sum(v.net_ht), 0) as reste_a_facturer
  from public.bons_livraison b
  cross join lateral (
    select
      coalesce((select sum((l.value->>'total_ht')::numeric) from jsonb_array_elements(coalesce(b.lignes, '[]'::jsonb)) l(value)), 0) as brut,
      coalesce((select sum((l.value->>'total_ht')::numeric) from jsonb_array_elements(coalesce(b.lignes, '[]'::jsonb)) l(value)
                 where coalesce(((l.value->'meta')->>'forfait_minimum')::boolean, false) is not true), 0) as assiette
  ) t
  cross join lateral (
    select t.brut - case
      when b.remise is null or coalesce((b.remise->>'valeur')::numeric, 0) = 0 or t.assiette <= 0 then 0
      when (b.remise->>'type') = 'pct' then t.assiette * (b.remise->>'valeur')::numeric / 100
      else least((b.remise->>'valeur')::numeric, t.assiette)
    end as net_ht
  ) v
  where b.status = 'livre' and b.facture_id is null
  group by b.client_id
),
nc as (
  select
    p.client_id,
    coalesce(sum(nq.retouches), 0)::integer as retouches,
    coalesce(sum(nq.rebuts), 0)::integer as rebuts,
    coalesce(sum(nq.cout_non_qualite), 0) as cout_non_qualite
  from public.projets p
  join public.projet_non_qualite nq on nq.projet_id = p.id
  group by p.client_id
)
select
  c.id as client_id,
  c.atelier_id,
  c.nom,
  coalesce(prod.projets, 0) as projets,
  round(coalesce(prod.surface_m2, 0), 2) as surface_m2,
  round(prod.surface_moyenne_m2, 2) as surface_moyenne_m2,
  round(prod.delai_moyen_jours, 1) as delai_moyen_jours,
  round(coalesce(prod.cout_poudre, 0), 2) as cout_poudre,
  round(coalesce(prod.cout_main_oeuvre, 0), 2) as cout_main_oeuvre,
  round(coalesce(prod.cout_energie, 0), 2) as cout_energie,
  coalesce(nc.retouches, 0) as retouches,
  coalesce(nc.rebuts, 0) as rebuts,
  round(coalesce(nc.cout_non_qualite, 0), 2) as cout_non_qualite,
  round(coalesce(prod.revient_projets, 0), 2) as revient_total,
  round(coalesce(fact.facture_ht, 0), 2) as facture_ht,
  round(coalesce(fact.facture_ht, 0) - coalesce(prod.revient_projets, 0), 2) as marge_eur,
  case when coalesce(fact.facture_ht, 0) > 0
       then round((fact.facture_ht - coalesce(prod.revient_projets, 0)) / fact.facture_ht * 100, 1)
       else null end as marge_pct,
  round(coalesce(bl.reste_a_facturer, 0), 2) as reste_a_facturer,
  coalesce(bl.bl_a_facturer, 0) as bl_a_facturer,
  coalesce(prod.projets_non_factures, 0) as projets_non_factures,
  round(coalesce(prod.revient_non_facture, 0), 2) as revient_non_facture,
  coalesce(fact.facture_ht, 0) > 0
    and (coalesce(fact.facture_ht, 0) - coalesce(prod.revient_projets, 0)) < 0
    and coalesce(bl.reste_a_facturer, 0) = 0
    and coalesce(prod.projets_non_factures, 0) = 0 as perte_reelle
from public.clients c
left join prod on prod.client_id = c.id
left join fact on fact.client_id = c.id
left join bl on bl.client_id = c.id
left join nc on nc.client_id = c.id
where public.capacite_ouverte(c.atelier_id, 'rentabilite') and public.acces_commercial();

comment on view public.client_rentabilite is
  'Rentabilité par client. revient_total et cout_non_qualite viennent désormais de la même source '
  'que projet_revient (projet_non_qualite) : la somme des projets d''un client retombe exactement '
  'sur sa ligne, NC de fournée comprises — migration 59.';

grant select on public.client_rentabilite to authenticated;
revoke all on public.client_rentabilite from anon;


-- -----------------------------------------------------------------------------
-- 4. C6 — petit utilitaire pour la mention B2C
-- -----------------------------------------------------------------------------

create or replace function public.client_est_particulier(p_type text)
returns boolean
language sql
immutable
parallel safe
set search_path to 'public'
as $function$ select coalesce(p_type, '') = 'particulier' $function$;

comment on function public.client_est_particulier(text) is
  'Vrai si le client est un particulier (B2C) — mentions médiateur/rétractation. Migration 59.';
