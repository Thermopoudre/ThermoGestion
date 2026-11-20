-- =================================================================================================
-- 50 — Lot A3 : reprendre les lots de poudre déjà en stock
--
-- POURQUOI. Le modèle d'import « Poudres » pose un `stock_kg` et rien d'autre : pas de numéro de
-- lot, pas de DLU, pas de fournisseur. L'atelier pilote arrive avec 380 kg répartis en 9 lots
-- datés. Sans eux, la traçabilité démarre vide (aucun certificat ne peut citer le lot employé),
-- l'alerte DLU ne se déclenche jamais, et le FIFO consomme un lot fantôme.
--
-- LE PIÈGE, et la raison d'être de cette fonction. `receptionner_lot()` compense l'écart entre
-- `poudres.stock_kg` et la somme des lots par un lot fantôme « STOCK-INITIAL » : c'est le bon
-- geste au quotidien (un atelier qui commence à tracer ses lots ne perd pas le stock qu'il avait
-- déjà), mais c'est exactement le mauvais geste à la reprise. L'atelier importe d'abord ses
-- poudres avec leur stock, puis ses lots : le premier lot reçu créerait un STOCK-INITIAL de
-- 380 kg en face des 380 kg réels, et l'atelier démarrerait avec le double de son stock.
-- On remet donc `stock_kg` sur la somme des lots existants AVANT d'appeler la réception.
-- =================================================================================================

create or replace function public.importer_lot_poudre(
  p_poudre_id uuid,
  p_numero text,
  p_fournisseur text default null,
  p_quantite_kg numeric default null,
  p_restant_kg numeric default null,
  p_dlu date default null,
  p_recu_le date default null,
  p_prix_kg numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atelier uuid := public.current_atelier_id();
  v_restant numeric;
  v_lot uuid;
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;

  if not exists (select 1 from public.poudres where id = p_poudre_id and atelier_id = v_atelier) then
    raise exception 'LOT_POUDRE_INCONNUE'
      using hint = 'Cette référence de poudre n''existe pas dans votre atelier. Importez vos poudres avant vos lots.';
  end if;

  if p_quantite_kg is null or p_quantite_kg <= 0 then
    raise exception 'LOT_QUANTITE_INVALIDE'
      using hint = 'La quantité reçue est un nombre de kilos strictement positif.';
  end if;

  -- Le reste à ce jour, et non la quantité reçue : un lot ouvert il y a six mois n'est plus plein,
  -- et c'est le reste qui fait le stock, la valorisation et le FIFO.
  v_restant := coalesce(p_restant_kg, p_quantite_kg);
  if v_restant < 0 or v_restant > p_quantite_kg + 0.0005 then
    raise exception 'LOT_RESTANT_INVALIDE'
      using hint = 'Le reste en stock est compris entre zéro et la quantité reçue.';
  end if;

  if p_recu_le is not null and p_recu_le > current_date then
    raise exception 'LOT_RECEPTION_FUTURE'
      using hint = 'La date de réception ne peut pas être dans le futur.';
  end if;

  -- Voir l'en-tête : on neutralise l'écart pour que `receptionner_lot()` ne fabrique pas de lot
  -- « STOCK-INITIAL » en double du stock qu'on est précisément en train de détailler.
  update public.poudres p
     set stock_kg = coalesce((select sum(l.restant_kg) from public.poudre_lots l
                               where l.poudre_id = p.id), 0)
   where p.id = p_poudre_id;

  v_lot := public.receptionner_lot(p_poudre_id, p_numero, p_fournisseur, p_quantite_kg, p_prix_kg, p_dlu);

  -- `receptionner_lot()` pose le lot plein et daté d'aujourd'hui : la reprise doit reposer le
  -- reste réel et la vraie date de réception, sans quoi la DLU perd son ancienneté et le FIFO
  -- consomme dans le mauvais ordre.
  update public.poudre_lots
     set restant_kg = v_restant,
         recu_le = coalesce(p_recu_le, current_date)
   where id = v_lot;

  -- Le mouvement de stock tracé par la réception portait la photo d'avant cet ajustement.
  update public.stock_mouvements
     set stock_apres_kg = (select stock_kg from public.poudres where id = p_poudre_id)
   where lot_id = v_lot;

  return v_lot;
end $function$;

comment on function public.importer_lot_poudre(uuid, text, text, numeric, numeric, date, date, numeric) is
  'Reprise d''un lot de poudre déjà en stock : quantité reçue, reste à ce jour, DLU et date de '
  'réception d''origine. S''appuie sur receptionner_lot() après avoir neutralisé l''écart de stock, '
  'pour ne pas fabriquer un lot STOCK-INITIAL en double du stock qu''on détaille.';

revoke all on function public.importer_lot_poudre(uuid, text, text, numeric, numeric, date, date, numeric) from public, anon;
grant execute on function public.importer_lot_poudre(uuid, text, text, numeric, numeric, date, date, numeric) to authenticated;
