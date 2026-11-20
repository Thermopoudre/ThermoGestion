-- =================================================================================================
-- 52 — La reprise des lots de poudre est réservée au responsable (correctif de recette, vague 1)
--
-- LE DÉFAUT. `importer_lot_poudre()` (migration 50) est `security definer` et ouverte à
-- `authenticated` sans aucun contrôle de rôle, alors que ses deux sœurs de reprise —
-- `poser_numerotation()` et `importer_facture_anterieure()` — exigent `is_owner()`. Un compte
-- « bureau » ou « atelier » pouvait donc l'appeler.
--
-- POURQUOI C'EN EST UN, alors que la RLS de `poudre_lots` laisse déjà tout membre écrire un lot.
-- Ce n'est pas l'insertion du lot qui pose problème, c'est la ligne que cette fonction exécute
-- avant elle :
--
--     update public.poudres set stock_kg = (somme des restants de ses lots)
--
-- Elle réaligne d'autorité le stock déclaré sur le détail des lots, SANS écrire de mouvement
-- d'ajustement. C'est le geste juste à l'installation — il évite le lot fantôme « STOCK-INITIAL »
-- en double — et c'est un effacement silencieux d'écart d'inventaire à tout autre moment : un
-- opérateur pouvait régulariser une démarque sans laisser de trace dans `stock_mouvements`, table
-- que la RLS lui interdit précisément d'écrire en direct. Le quotidien n'est pas concerné : il
-- passe par `receptionner_lot()`, qui reste ouverte à tous les membres et qui, elle, trace son
-- mouvement.
--
-- Aucune régression fonctionnelle attendue : seul l'écran /import appelle cette fonction, et la
-- reprise de l'existant est un geste d'installation, fait par le responsable de l'atelier — c'est
-- déjà le cas pour la numérotation et pour l'encours facturé.
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
as $$
declare
  v_atelier uuid := public.current_atelier_id();
  v_restant numeric;
  v_lot uuid;
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;

  -- Voir l'en-tête : cette fonction réaligne le stock déclaré sans mouvement d'ajustement tracé.
  -- C'est un geste d'installation, au même titre que la numérotation et la reprise de l'encours.
  if not public.is_owner() then
    raise exception 'REPRISE_RESERVEE_PROPRIETAIRE'
      using hint = 'Seul le responsable de l''atelier reprend le stock existant : cet import réaligne le stock déclaré sur le détail des lots. Au quotidien, utilisez la réception de lot.';
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

  -- Voir la migration 50 : on neutralise l'écart pour que receptionner_lot() ne fabrique pas de
  -- lot « STOCK-INITIAL » en double du stock qu'on est précisément en train de détailler.
  update public.poudres p
     set stock_kg = coalesce((select sum(l.restant_kg) from public.poudre_lots l
                               where l.poudre_id = p.id), 0)
   where p.id = p_poudre_id;

  v_lot := public.receptionner_lot(p_poudre_id, p_numero, p_fournisseur, p_quantite_kg, p_prix_kg, p_dlu);

  -- receptionner_lot() pose le lot plein et daté d'aujourd'hui : la reprise repose le reste réel
  -- et la vraie date de réception, sans quoi la DLU perd son ancienneté et le FIFO consomme dans
  -- le mauvais ordre.
  update public.poudre_lots
     set restant_kg = v_restant,
         recu_le = coalesce(p_recu_le, current_date)
   where id = v_lot;

  -- Le mouvement de stock tracé par la réception portait la photo d'avant cet ajustement.
  update public.stock_mouvements
     set stock_apres_kg = (select stock_kg from public.poudres where id = p_poudre_id)
   where lot_id = v_lot;

  return v_lot;
end $$;

-- `create or replace` conserve les droits existants ; on les repose malgré tout pour que cette
-- migration soit rejouable seule sur une base neuve.
revoke all on function public.importer_lot_poudre(uuid, text, text, numeric, numeric, date, date, numeric) from public, anon;
grant execute on function public.importer_lot_poudre(uuid, text, text, numeric, numeric, date, date, numeric) to authenticated;
