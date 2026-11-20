-- =================================================================================================
-- 53 — Lot D (cahier des charges v3, §4) : les bornes que la recette a trouvées inertes
--
-- POURQUOI (D1). Le récapitulatif d'un devis ne s'additionnait plus dès qu'une remise dépassait
-- 100 % (le complément de forfait minimum n'entrait plus dans le calcul affiché : correction côté
-- écran, voir DevisEditor) et une remise négative gonflait le total sans qu'aucune ligne ne
-- l'explique. Les bornes existaient déjà à l'écran (`min="0"`) mais un `Input type="number"` rend
-- `ChampDecimal`, un `<input type="text">` : `min`/`max` n'y ont jamais eu d'effet (voir D5). La
-- seule garantie qui tienne est en base.
--
-- POURQUOI (D5). Même défaut sur d'autres bornes : `clients.remise_pct`, `delai_paiement_jours`,
-- `receptions.nb_pieces`, le diamètre et la largeur d'un jeu de jantes, et l'encaissement d'un
-- paiement au-delà du reste dû. Chacune était posée à l'écran (`min`/`max`) sans jamais être
-- vérifiée : PostgREST acceptait tout ce qui passait la validation JSON.
--
-- Volontairement absent de cette migration : la fournée au-delà de sa capacité. Le cahier des
-- charges demande une confirmation explicite, pas un refus — ça reste un geste d'écran (voir
-- FourneeComposer), la base n'a rien à interdire.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. D1 — remise bornée sur devis, factures, bons de livraison
-- -------------------------------------------------------------------------------------------------
-- Une seule fonction, réutilisée sur les trois tables : `TG_ARGV[0]` porte le nom de la colonne de
-- lignes (`items` sur devis/factures, `lignes` sur bons_livraison), lue via `to_jsonb(new)` pour ne
-- pas dupliquer la fonction à l'identique trois fois.
create or replace function public.trg_borner_remise()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_type text;
  v_valeur numeric;
  v_lignes jsonb;
  v_sous_total numeric;
begin
  if new.remise is null or jsonb_typeof(new.remise) = 'null' then
    return new;
  end if;

  v_type := new.remise->>'type';
  v_valeur := nullif(new.remise->>'valeur', '')::numeric;

  -- Une remise sans valeur exploitable n'est pas de notre ressort : l'écran envoie `null` dans ce
  -- cas, jamais un objet à moitié rempli.
  if v_valeur is null then
    return new;
  end if;

  if v_valeur < 0 then
    raise exception 'REMISE_NEGATIVE'
      using hint = 'Une remise ne peut pas être négative : elle augmenterait le total sans aucune ligne pour l''expliquer.';
  end if;

  if v_type = 'pct' then
    if v_valeur > 100 then
      raise exception 'REMISE_SUPERIEURE_100'
        using hint = 'Une remise en pourcentage ne peut pas dépasser 100 %.';
    end if;
  elsif v_type = 'montant' then
    v_lignes := to_jsonb(new) -> TG_ARGV[0];
    select coalesce(sum((elem->>'total_ht')::numeric), 0) into v_sous_total
      from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) elem
     where coalesce((elem->'meta'->>'forfait_minimum')::boolean, false) = false
       and coalesce((elem->'meta'->>'deduction_acompte')::boolean, false) = false;
    -- Un centime de marge : la remise nominale et le sous-total viennent tous deux d'arrondis à
    -- deux décimales, une remise qui colle exactement au sous-total ne doit pas être rejetée sur
    -- un résidu de flottant.
    if v_valeur > v_sous_total + 0.01 then
      raise exception 'REMISE_SUPERIEURE_SOUS_TOTAL'
        using hint = 'Une remise en euros ne peut pas dépasser le sous-total sur lequel elle porte.';
    end if;
  end if;

  return new;
end $function$;

revoke all on function public.trg_borner_remise() from public, anon, authenticated;

drop trigger if exists borner_remise on public.devis;
create trigger borner_remise
  before insert or update on public.devis
  for each row execute function public.trg_borner_remise('items');

drop trigger if exists borner_remise on public.factures;
create trigger borner_remise
  before insert or update on public.factures
  for each row execute function public.trg_borner_remise('items');

drop trigger if exists borner_remise on public.bons_livraison;
create trigger borner_remise
  before insert or update on public.bons_livraison
  for each row execute function public.trg_borner_remise('lignes');

-- -------------------------------------------------------------------------------------------------
-- 2. D5 — quantités et surfaces de ligne jamais négatives
-- -------------------------------------------------------------------------------------------------
-- Une surface à −5 m² affichait « −0,00 € » sans qu'aucune règle ne le refuse : `qte` porte la
-- surface, le métrage ou la quantité selon le type de ligne, et n'a de sens qu'à partir de zéro.
-- Les lignes de déduction d'acompte (montant négatif, `qte` = 1) ne sont pas concernées : c'est le
-- prix qui est négatif chez elles, jamais la quantité.
create or replace function public.trg_lignes_qte_positive()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lignes jsonb;
  v_negative boolean;
begin
  v_lignes := to_jsonb(new) -> TG_ARGV[0];
  select bool_or((elem->>'qte')::numeric < 0) into v_negative
    from jsonb_array_elements(coalesce(v_lignes, '[]'::jsonb)) elem;
  if coalesce(v_negative, false) then
    raise exception 'LIGNE_QUANTITE_NEGATIVE'
      using hint = 'Une quantité ou une surface de ligne ne peut pas être négative.';
  end if;
  return new;
end $function$;

revoke all on function public.trg_lignes_qte_positive() from public, anon, authenticated;

drop trigger if exists lignes_qte_positive on public.devis;
create trigger lignes_qte_positive
  before insert or update on public.devis
  for each row execute function public.trg_lignes_qte_positive('items');

drop trigger if exists lignes_qte_positive on public.factures;
create trigger lignes_qte_positive
  before insert or update on public.factures
  for each row execute function public.trg_lignes_qte_positive('items');

drop trigger if exists lignes_qte_positive on public.bons_livraison;
create trigger lignes_qte_positive
  before insert or update on public.bons_livraison
  for each row execute function public.trg_lignes_qte_positive('lignes');

-- -------------------------------------------------------------------------------------------------
-- 3. D5 — bornes simples posées en CHECK
-- -------------------------------------------------------------------------------------------------
do $$
begin
  -- Remise contractuelle d'un client : 500 % était saisissable, la loi ne borne que le délai.
  if not exists (select 1 from pg_constraint where conname = 'clients_remise_pct_check') then
    alter table public.clients
      add constraint clients_remise_pct_check check (remise_pct >= 0 and remise_pct <= 100);
  end if;
  -- L441-10 du code de commerce : 60 jours (ou 45 jours fin de mois), jamais plus. 999 jours
  -- passait l'écran sans broncher alors que la mention légale, juste dessous, dit 60.
  if not exists (select 1 from pg_constraint where conname = 'clients_delai_paiement_check') then
    alter table public.clients
      add constraint clients_delai_paiement_check check (delai_paiement_jours >= 0 and delai_paiement_jours <= 60);
  end if;
  -- Une réception de 0 pièce n'est pas une réception.
  if not exists (select 1 from pg_constraint where conname = 'receptions_nb_pieces_check') then
    alter table public.receptions
      add constraint receptions_nb_pieces_check check (nb_pieces >= 1);
  end if;
  -- Largeur d'un jeu de jantes, en J (pouces) : aucune jante commercialisée ne descend sous 4J.
  -- Colonne nullable (l'écran laisse le champ vide tant qu'il n'est pas mesuré) : une valeur
  -- absente reste acceptée, seule une valeur saisie est bornée.
  if not exists (select 1 from pg_constraint where conname = 'jeux_jantes_largeur_pouces_check') then
    alter table public.jeux_jantes
      add constraint jeux_jantes_largeur_pouces_check check (largeur_pouces is null or largeur_pouces >= 4);
  end if;
end $$;

-- Le diamètre était déjà borné (migration d'origine, 10-26"), mais large de deux crans par
-- rapport à ce que vend réellement l'atelier pilote (12-26" — vérifié : aucune jante en base sous
-- 12" sur les deux jeux existants). Resserré à ce que la recette a testé ; à revoir si un futur
-- client prend des roues moto (10-12").
alter table public.jeux_jantes drop constraint if exists jeux_jantes_diametre_pouces_check;
alter table public.jeux_jantes
  add constraint jeux_jantes_diametre_pouces_check check (diametre_pouces >= 12 and diametre_pouces <= 26);

comment on constraint clients_remise_pct_check on public.clients is
  'Bornes déjà affichées à l''écran (min/max sur un input type=number, donc inertes côté navigateur — voir ChampDecimal) : la seule garantie qui tienne est ici.';
comment on constraint clients_delai_paiement_check on public.clients is
  'L441-10 du code de commerce : 60 jours calendaires au plus.';

-- -------------------------------------------------------------------------------------------------
-- 4. D5 — un encaissement ne peut pas dépasser le reste dû
-- -------------------------------------------------------------------------------------------------
-- Même formule que `portail_client.reste_du` (migration antérieure) : le total TTC de la facture,
-- diminué des paiements déjà enregistrés — celui qu'on modifie exclu de la somme, pour qu'une
-- correction du montant d'un paiement existant se compare au reste dû SANS lui-même.
create or replace function public.trg_borner_paiement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total_ttc numeric;
  v_deja_regle numeric;
  v_reste_du numeric;
begin
  if new.montant is null or new.montant <= 0 then
    raise exception 'PAIEMENT_MONTANT_INVALIDE'
      using hint = 'Le montant encaissé doit être strictement positif.';
  end if;

  select total_ttc into v_total_ttc from public.factures where id = new.facture_id;
  if v_total_ttc is null then
    raise exception 'PAIEMENT_FACTURE_INTROUVABLE'
      using hint = 'Cette facture n''existe pas, ou plus, dans votre atelier.';
  end if;

  select coalesce(sum(montant), 0) into v_deja_regle
    from public.paiements
   where facture_id = new.facture_id
     and id is distinct from new.id;

  v_reste_du := greatest(v_total_ttc - v_deja_regle, 0);

  -- Un centime de marge pour les arrondis de conversion Stripe (centimes ↔ euros).
  if new.montant > v_reste_du + 0.01 then
    raise exception 'PAIEMENT_SUPERIEUR_RESTE_DU'
      using hint = format('Le montant encaissé (%s €) dépasse le reste dû sur cette facture (%s €).', new.montant, v_reste_du);
  end if;

  return new;
end $function$;

revoke all on function public.trg_borner_paiement() from public, anon, authenticated;

drop trigger if exists borner_paiement on public.paiements;
create trigger borner_paiement
  before insert or update on public.paiements
  for each row execute function public.trg_borner_paiement();
