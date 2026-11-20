-- 77 (20/11/2026) — Émission atomique : le numéro et le changement de statut dans la même transaction.
-- Appliquée en production le 20/11/2026.
--
-- POURQUOI. Le front appelait next_numero() puis, dans un second appel HTTP, passait le document
-- en « émis ». Si le second appel échouait (réseau coupé, déclencheur qui refuse : plafond d'avoir,
-- remise bornée, abonnement fermé…), le numéro restait consommé : trou dans la série FA-/AV-,
-- ce que la numérotation continue des factures interdit. Ici, un refus annule aussi le compteur.
--
-- Fonctions neuves à côté des anciennes (aucune n'est modifiée). SECURITY INVOKER : la RLS et
-- tous les déclencheurs s'appliquent avec les droits de l'appelant, comme l'update du front.

create or replace function public.emettre_facture(p_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare v_type text; v_numero text; v_status text;
begin
  select type, numero, status into v_type, v_numero, v_status from public.factures where id = p_id for update;
  if not found then raise exception 'FACTURE_INTROUVABLE'; end if;
  if coalesce(v_status, '') <> 'brouillon' then raise exception 'FACTURE_DEJA_EMISE'; end if;
  if v_numero is null then
    v_numero := public.next_numero(case when v_type = 'avoir' then 'avoir' else 'facture' end);
  end if;
  update public.factures set status = 'emise', numero = v_numero, emise_at = now() where id = p_id;
  return v_numero;
end $$;

create or replace function public.finaliser_devis(p_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare v_numero text; v_status text;
begin
  select numero, status into v_numero, v_status from public.devis where id = p_id for update;
  if not found then raise exception 'DEVIS_INTROUVABLE'; end if;
  if coalesce(v_status, '') <> 'brouillon' then raise exception 'DEVIS_DEJA_FINALISE'; end if;
  if v_numero is null then v_numero := public.next_numero('devis'); end if;
  update public.devis set status = 'envoye', numero = v_numero, envoye_at = now() where id = p_id;
  return v_numero;
end $$;

create or replace function public.emettre_bl(p_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare v_numero text; v_status text;
begin
  select numero, status into v_numero, v_status from public.bons_livraison where id = p_id for update;
  if not found then raise exception 'BL_INTROUVABLE'; end if;
  if coalesce(v_status, '') <> 'brouillon' then raise exception 'BL_DEJA_EMIS'; end if;
  if v_numero is null then v_numero := public.next_numero('bl'); end if;
  update public.bons_livraison set status = 'emis', numero = v_numero where id = p_id;
  return v_numero;
end $$;

-- Piège n° 1 de la fiche : une fonction neuve est exécutable par PUBLIC, donc par anon.
revoke all on function public.emettre_facture(uuid) from public, anon;
revoke all on function public.finaliser_devis(uuid) from public, anon;
revoke all on function public.emettre_bl(uuid) from public, anon;
grant execute on function public.emettre_facture(uuid) to authenticated;
grant execute on function public.finaliser_devis(uuid) to authenticated;
grant execute on function public.emettre_bl(uuid) to authenticated;
