-- =============================================================================================
-- 54 — Correctif B4 : chiffres_du_mois(), le reste dû comptait faux dès qu'une facture avait
-- plusieurs paiements.
--
-- CE QUI CLOCHAIT. La première version soustrayait un sous-total de paiements calculé hors
-- agrégation (`sum(f.total_ttc) - (select sum(p.montant) from paiements where facture_id = f.id)`,
-- sans corréler la sous-requête à chaque ligne de `f` dans le bon ordre d'évaluation) : dès qu'un
-- atelier avait plus d'une facture émise, le résultat se réduisait au reste dû d'une seule facture
-- au lieu de la somme sur toutes. `left join lateral` corrèle explicitement chaque facture à son
-- propre total réglé avant l'agrégation — c'est la correction apportée ici, rien d'autre ne change
-- dans la fonction (mêmes filtres, même périmètre bureau via acces_commercial()).
--
-- Cette migration a été appliquée directement en base le 03/09 (apply_migration) ; ce fichier
-- rejoue le même texte pour que le dépôt reste la source de vérité des migrations.
-- =============================================================================================

create or replace function public.chiffres_du_mois()
returns table(
  facture_ht numeric,
  facture_ht_mois_precedent numeric,
  encaisse numeric,
  encaisse_mois_precedent numeric,
  reste_du numeric,
  m2_produits numeric,
  m2_produits_mois_precedent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_atelier uuid := public.current_atelier_id();
  v_debut date := date_trunc('month', now())::date;
  v_fin date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_debut_prec date := (date_trunc('month', now()) - interval '1 month')::date;
  v_fin_prec date := (v_debut - interval '1 day')::date;
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;
  -- Réservée au bureau : « facturé » et « encaissé » sont un chiffre d'affaires, et
  -- src/lib/roles.ts range ça du côté « argent », jamais donné à un compte d'atelier. `projets`
  -- (m² produits) n'a, lui, aucune RLS par rôle (tenant_all) : SECURITY INVOKER seul laisserait un
  -- opérateur lire ce chiffre en appelant la RPC directement, d'où la vérification explicite ici
  -- plutôt qu'une délégation totale à la RLS des tables sous-jacentes.
  if not coalesce(public.acces_commercial(), false) then
    raise exception 'ACCES_COMMERCIAL_REQUIS' using hint = 'Le chiffre du mois appartient au bureau.';
  end if;

  return query
  select
    -- Facturé du mois : HT, émises ou payées, avoirs déduits, et seulement ce qui est parti de
    -- l'application (`origine = 'application'`) — même filtre que journal_ventes() : une facture
    -- de reprise n'est pas un résultat du mois, c'est de l'encours importé (lot A).
    (select coalesce(sum(case when f.type = 'avoir' then -f.total_ht else f.total_ht end), 0)
       from public.factures f
      where f.atelier_id = v_atelier and f.deleted_at is null and f.origine = 'application'
        and f.status in ('emise', 'payee')
        and f.emise_at >= v_debut::timestamptz and f.emise_at < (v_fin + 1)::timestamptz),
    (select coalesce(sum(case when f.type = 'avoir' then -f.total_ht else f.total_ht end), 0)
       from public.factures f
      where f.atelier_id = v_atelier and f.deleted_at is null and f.origine = 'application'
        and f.status in ('emise', 'payee')
        and f.emise_at >= v_debut_prec::timestamptz and f.emise_at < (v_fin_prec + 1)::timestamptz),
    -- Encaissé du mois : toutes origines — un virement reçu ce mois-ci sur une facture reprise de
    -- l'ancien logiciel est de l'argent réel encaissé ce mois-ci, il compte au même titre.
    (select coalesce(sum(p.montant), 0)
       from public.paiements p join public.factures f on f.id = p.facture_id
      where f.atelier_id = v_atelier
        and p.paye_at >= v_debut::timestamptz and p.paye_at < (v_fin + 1)::timestamptz),
    (select coalesce(sum(p.montant), 0)
       from public.paiements p join public.factures f on f.id = p.facture_id
      where f.atelier_id = v_atelier
        and p.paye_at >= v_debut_prec::timestamptz and p.paye_at < (v_fin_prec + 1)::timestamptz),
    -- Reste dû : un instantané à aujourd'hui, reprises comprises. `left join lateral` résout le
    -- réglé de CHAQUE facture avant l'agrégation — c'est ce qui manquait ci-dessus et qui réduisait
    -- le total à une seule facture dès qu'il y en avait plusieurs.
    (select coalesce(sum(f.total_ttc - coalesce(pay.total, 0)), 0)
       from public.factures f
       left join lateral (
         select sum(p.montant) as total from public.paiements p where p.facture_id = f.id
       ) pay on true
      where f.atelier_id = v_atelier and f.deleted_at is null and f.status = 'emise'),
    -- m² produits du mois : projets réellement sortis de l'atelier (statut « livré ») sur la
    -- période, à leur date de livraison. Une pièce « prête » mais non enlevée n'est pas produite
    -- pour le client, elle est produite pour l'entrepôt.
    (select coalesce(sum(p.surface_m2), 0)
       from public.projets p
      where p.atelier_id = v_atelier and p.deleted_at is null and p.status = 'livre'
        and p.date_livraison >= v_debut and p.date_livraison <= v_fin),
    (select coalesce(sum(p.surface_m2), 0)
       from public.projets p
      where p.atelier_id = v_atelier and p.deleted_at is null and p.status = 'livre'
        and p.date_livraison >= v_debut_prec and p.date_livraison <= v_fin_prec);
end
$$;

comment on function public.chiffres_du_mois() is
  'B4 — la bande de quatre chiffres du tableau de bord. Réservée au bureau (acces_commercial()) : '
  'facturé et encaissé sont un chiffre d''affaires, src/lib/roles.ts le range du côté « argent ». '
  'Reste dû corrigé le 03/09 (left join lateral) : sinon le total se réduisait à une seule facture '
  'dès qu''un atelier en avait plusieurs émises.';

revoke all on function public.chiffres_du_mois() from public, anon;
grant execute on function public.chiffres_du_mois() to authenticated;
