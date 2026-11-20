-- =============================================================================
-- 58 — Balance âgée + pointage hors ligne (lot C, cahier des charges v3 §3 — C3 et C4)
-- =============================================================================
--
-- C3 : `balance_agee()` rend, par client, le reste dû réparti en quatre tranches de retard
-- (0-30 / 31-60 / 61-90 / 90+ jours). Elle n'est PAS `SECURITY DEFINER` : `factures` porte déjà la
-- policy `commercial_all` (owner/bureau, `acces_commercial()`) et `paiements`/`clients` la même
-- restriction par atelier — un simple `LANGUAGE sql` exécuté avec les droits de l'appelant suffit,
-- et c'est strictement moins de surface qu'un définisseur. `revoke ... from anon` seul ne suffit
-- PAS : `CREATE FUNCTION` accorde `EXECUTE` à `PUBLIC` par défaut, et `anon` en hérite comme tout
-- rôle — la revoke doit donc viser `public` ET `anon` nommément (piège déjà consigné le 03/09 :
-- « revoke from public ne retire pas anon », et la réciproque est vraie aussi).
--
-- C4 : `demarrer_etape`/`avancer_etape` reçoivent un paramètre optionnel `p_survenu_a`. Un
-- pointage saisi hors ligne (`/scan`) porte l'heure réelle du geste, pas celle — potentiellement
-- bien plus tardive — où le réseau revient et où la file rejoue l'appel. Seuls les horodatages du
-- CHRONOMÉTRAGE lui-même (ouverture/fermeture de `temps_etapes`, `done_at` de l'étape) suivent
-- `p_survenu_a` ; les effets de bord secondaires (décompte du stock à la cuisson, notification
-- client) continuent de dater de `now()` — ce n'est pas le geste pointé, et les dater dans le passé
-- déclencherait des notifications antidatées sans bénéfice.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. balance_agee()
-- -----------------------------------------------------------------------------

create or replace function public.balance_agee()
returns table(
  client_id uuid,
  nom text,
  tranche_0_30 numeric,
  tranche_31_60 numeric,
  tranche_61_90 numeric,
  tranche_plus_90 numeric,
  total_du numeric
)
language sql
stable
set search_path to 'public'
as $function$
  with soldes as (
    select
      f.id,
      f.client_id,
      f.due_date,
      f.total_ttc - coalesce((select sum(p.montant) from public.paiements p where p.facture_id = f.id), 0) as reste_du
    from public.factures f
    where f.status = 'emise'
      and f.deleted_at is null
      and f.annulee_at is null
      and coalesce(f.type, '') <> 'avoir'
      and f.due_date is not null
  ),
  agees as (
    select client_id, (current_date - due_date) as retard_jours, reste_du
    from soldes
    -- La balance âgée ne montre que le retard réel : une facture pas encore échue n'y figure pas.
    where reste_du > 0.01 and due_date < current_date
  )
  select
    c.id as client_id,
    c.nom,
    round(coalesce(sum(a.reste_du) filter (where a.retard_jours between 0 and 30), 0), 2) as tranche_0_30,
    round(coalesce(sum(a.reste_du) filter (where a.retard_jours between 31 and 60), 0), 2) as tranche_31_60,
    round(coalesce(sum(a.reste_du) filter (where a.retard_jours between 61 and 90), 0), 2) as tranche_61_90,
    round(coalesce(sum(a.reste_du) filter (where a.retard_jours > 90), 0), 2) as tranche_plus_90,
    round(coalesce(sum(a.reste_du), 0), 2) as total_du
  from public.clients c
  join agees a on a.client_id = c.id
  where c.atelier_id = public.current_atelier_id()
  group by c.id, c.nom
  order by total_du desc
$function$;

comment on function public.balance_agee() is
  'Reste dû par client, réparti par tranche de retard (0-30/31-60/61-90/90+ jours). Non-définisseur '
  '— s''appuie sur la RLS de factures/paiements/clients (rôle commercial). Migration 58.';

revoke all on function public.balance_agee() from public, anon;
grant execute on function public.balance_agee() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Pointage hors ligne : l'heure réelle du geste
-- -----------------------------------------------------------------------------

-- L'ancienne signature à deux paramètres doit disparaître : sinon PostgREST verrait deux fonctions
-- `demarrer_etape` compatibles avec un appel à deux arguments (le troisième par défaut) et
-- refuserait l'appel pour ambiguïté (« function is not unique »).
drop function if exists public.demarrer_etape(uuid, text);

create or replace function public.demarrer_etape(p_projet uuid, p_etape text default null, p_survenu_a timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atelier uuid := public.current_atelier_id();
  v_projet record;
  v_code text;
  -- Un geste hors ligne rejoué plus tard doit porter l'heure à laquelle l'opérateur a réellement
  -- démarré son chrono, pas celle du rejeu. `p_survenu_a` ne peut jamais être dans le futur (une
  -- horloge de tablette mal réglée ne doit pas fausser un temps de production).
  v_t timestamptz := least(coalesce(p_survenu_a, now()), now());
begin
  if v_atelier is null then raise exception 'no atelier for current user'; end if;
  select * into v_projet from public.projets
   where id = p_projet and atelier_id = v_atelier for update;
  if not found then raise exception 'projet not found'; end if;
  if v_projet.status in ('livre', 'annule') then
    return jsonb_build_object('ok', false, 'motif', 'projet_clos');
  end if;

  v_code := coalesce(p_etape, (
    select e->>'code' from jsonb_array_elements(v_projet.etapes) e
     where e->>'done_at' is null limit 1
  ), v_projet.etape_courante);
  if v_code is null then return jsonb_build_object('ok', false, 'motif', 'aucune_etape'); end if;

  if exists (select 1 from public.temps_etapes
              where projet_id = p_projet and fin is null and etape_code = v_code) then
    return jsonb_build_object('ok', true, 'deja_ouvert', true, 'etape', v_code);
  end if;

  -- Un chrono ouvert sur une autre étape est clos : un opérateur ne travaille pas deux postes.
  update public.temps_etapes
     set fin = now(), minutes = greatest(0, round(extract(epoch from (now() - debut)) / 60)::int)
   where projet_id = p_projet and fin is null;

  insert into public.temps_etapes (atelier_id, projet_id, etape_code, user_id, debut)
  values (v_atelier, p_projet, v_code, auth.uid(), v_t);

  if v_projet.status = 'en_attente' then
    update public.projets set status = 'en_cours' where id = p_projet;
  end if;

  return jsonb_build_object('ok', true, 'deja_ouvert', false, 'etape', v_code);
end $function$;

comment on function public.demarrer_etape(uuid, text, timestamptz) is
  'Démarre le chronométrage d''une étape. p_survenu_a (migration 58) porte l''heure réelle du '
  'geste pour un pointage rejoué depuis la file hors ligne de /scan.';

revoke all on function public.demarrer_etape(uuid, text, timestamptz) from public, anon;
grant execute on function public.demarrer_etape(uuid, text, timestamptz) to authenticated;


drop function if exists public.avancer_etape(uuid);

create or replace function public.avancer_etape(p_projet_id uuid, p_survenu_a timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atelier uuid := public.current_atelier_id();
  v_projet record;
  v_etapes jsonb;
  v_idx int := null;
  v_code text;
  v_next_code text := null;
  v_conso numeric;
  v_client_email text;
  v_res jsonb;
  v_lot uuid;
  v_reste numeric;
  i int;
  v_t timestamptz := least(coalesce(p_survenu_a, now()), now());
begin
  if v_atelier is null then raise exception 'no atelier for current user'; end if;
  select * into v_projet from public.projets
   where id = p_projet_id and atelier_id = v_atelier for update;
  if not found then raise exception 'projet not found'; end if;
  if v_projet.status in ('livre','annule') then
    return jsonb_build_object('done', true, 'etape', v_projet.etape_courante);
  end if;

  v_etapes := v_projet.etapes;
  for i in 0 .. jsonb_array_length(v_etapes) - 1 loop
    if (v_etapes->i->>'done_at') is null then v_idx := i; exit; end if;
  end loop;
  if v_idx is null then
    return jsonb_build_object('done', true, 'etape', v_projet.etape_courante);
  end if;

  v_code := v_etapes->v_idx->>'code';
  v_etapes := jsonb_set(v_etapes, array[v_idx::text],
    (v_etapes->v_idx) || jsonb_build_object('done_at', v_t, 'user_id', auth.uid()));
  if v_idx + 1 < jsonb_array_length(v_etapes) then
    v_next_code := v_etapes->(v_idx+1)->>'code';
  end if;

  if v_code = 'cuisson' and v_projet.poudre_id is not null and v_projet.stock_decremente_at is null then
    select coalesce(v_projet.poudre_conso_kg,
                    round(coalesce(v_projet.surface_m2,0) * v_projet.couches
                          / nullif((select rendement_m2_kg from public.poudres where id = v_projet.poudre_id), 0), 3))
      into v_conso;
    if v_conso is not null and v_conso > 0 then
      v_res := public.consommer_lots(v_projet.poudre_id, v_conso, v_projet.lot_id);
      v_lot := nullif(v_res->'lot'->>'id', '')::uuid;
      v_reste := coalesce((v_res->>'reste')::numeric, 0);
      if v_reste > 0 then
        update public.poudres set stock_kg = greatest(stock_kg - v_reste, 0) where id = v_projet.poudre_id;
      end if;
      insert into public.stock_mouvements(atelier_id, poudre_id, type, delta_kg, stock_apres_kg, projet_id, note,
                                          created_by, lot_id, lot_numero, lot_fournisseur, dlu)
      select v_atelier, v_projet.poudre_id, 'conso_auto', -v_conso, p.stock_kg, p_projet_id,
             'Cuisson ' || coalesce(v_projet.numero,''), auth.uid(),
             v_lot, v_res->'lot'->>'numero', v_res->'lot'->>'fournisseur', nullif(v_res->'lot'->>'dlu','')::date
        from public.poudres p where p.id = v_projet.poudre_id;
      update public.projets
         set poudre_conso_kg = v_conso, stock_decremente_at = now(), lot_id = coalesce(lot_id, v_lot)
       where id = p_projet_id;
    end if;
  end if;

  update public.projets
     set etapes = v_etapes,
         etape_courante = coalesce(v_next_code, v_code),
         status = case when v_code = 'livre' or v_next_code is null then 'livre'
                       when v_code = 'controle' or v_next_code = 'pret' then 'pret'
                       else 'en_cours' end,
         date_livraison = case when v_next_code is null then current_date else date_livraison end
   where id = p_projet_id;

  -- Chronométrage : on clôt ce qui tournait à l'heure réelle du geste, et on n'ouvre la suite
  -- (à la même heure) que si le dossier continue.
  update public.temps_etapes
     set fin = v_t, minutes = greatest(0, round(extract(epoch from (v_t - debut)) / 60)::int)
   where projet_id = p_projet_id and fin is null;
  if v_next_code is not null then
    insert into public.temps_etapes (atelier_id, projet_id, etape_code, user_id, debut)
    values (v_atelier, p_projet_id, v_next_code, auth.uid(), v_t);
  end if;

  if v_code in ('cuisson','controle','pret','livre') or v_next_code in ('pret') then
    select email into v_client_email from public.clients where id = v_projet.client_id;
    if v_client_email is not null then
      insert into public.notifications(atelier_id, destinataire_email, template, payload)
      values (v_atelier, v_client_email, 'projet_etape',
              jsonb_build_object('projet_numero', v_projet.numero, 'projet_nom', v_projet.nom,
                                 'etape_faite', v_code, 'etape_suivante', v_next_code,
                                 'public_token', v_projet.public_token));
    end if;
  end if;

  return jsonb_build_object('done', v_next_code is null, 'etape_faite', v_code, 'etape', coalesce(v_next_code, v_code));
end $function$;

comment on function public.avancer_etape(uuid, timestamptz) is
  'Valide l''étape en cours. p_survenu_a (migration 58) porte l''heure réelle du geste pour un '
  'pointage rejoué depuis la file hors ligne de /scan ; les effets de bord (stock, notification) '
  'restent datés de now().';

revoke all on function public.avancer_etape(uuid, timestamptz) from public, anon;
grant execute on function public.avancer_etape(uuid, timestamptz) to authenticated;
