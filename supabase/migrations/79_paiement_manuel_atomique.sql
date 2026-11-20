-- 79 · Paiement manuel atomique (audit du 20/11/2026)
--
-- L'écran facture enregistrait un règlement en deux appels : insert dans `paiements`, puis update
-- de la facture en « payée » si le cumul atteignait le total. Un réseau coupé entre les deux
-- laissait une facture réglée au statut « émise » : elle repartait en relance chez un client qui
-- avait payé. Ici, les deux écritures vivent dans la même transaction, la facture est verrouillée
-- (deux encaissements simultanés ne peuvent pas dépasser le total) et le calcul du solde se fait
-- en base, pas sur la copie de l'écran.
--
-- Fonction NEUVE : rien d'existant n'est remplacé. Retour arrière = ne plus l'appeler.
-- `security invoker` : la RLS de `factures` et `paiements` s'applique, un autre atelier ne voit
-- pas la facture → FACTURE_INTROUVABLE. Le plafond « pas plus que le reste dû » reste tenu par
-- le trigger `borner_paiement`.
create or replace function public.enregistrer_paiement_manuel(p_facture uuid, p_montant numeric, p_moyen text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_f record;
  v_encaisse numeric;
  v_soldee boolean;
begin
  select id, atelier_id, type, status, total_ttc into v_f
    from public.factures where id = p_facture for update;
  if not found then raise exception 'FACTURE_INTROUVABLE'; end if;
  if coalesce(v_f.type, '') = 'avoir' then raise exception 'PAIEMENT_SUR_AVOIR'; end if;
  if coalesce(v_f.status, '') <> 'emise' then raise exception 'FACTURE_NON_ENCAISSABLE'; end if;
  if coalesce(trim(p_moyen), '') = '' then raise exception 'PAIEMENT_MOYEN_MANQUANT'; end if;

  insert into public.paiements (atelier_id, facture_id, montant, moyen)
  values (v_f.atelier_id, p_facture, p_montant, p_moyen);

  select coalesce(sum(montant), 0) into v_encaisse from public.paiements where facture_id = p_facture;
  v_soldee := round(v_encaisse, 2) >= round(v_f.total_ttc, 2);
  if v_soldee then
    update public.factures set status = 'payee' where id = p_facture;
  end if;

  return jsonb_build_object(
    'encaisse', round(v_encaisse, 2),
    'reste_du', greatest(round(v_f.total_ttc - v_encaisse, 2), 0),
    'soldee', v_soldee
  );
end $$;

revoke all on function public.enregistrer_paiement_manuel(uuid, numeric, text) from public, anon;
grant execute on function public.enregistrer_paiement_manuel(uuid, numeric, text) to authenticated;
