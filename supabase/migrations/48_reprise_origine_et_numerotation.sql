-- =================================================================================================
-- 48 — La porte d'entrée (lot A du cahier des charges v3) : origine des factures et reprise de
--      la numérotation.
--
-- POURQUOI. Un atelier qui s'installe n'en est jamais à sa première facture. Celui du pilote en est
-- à FA-2026-0347. Si le logiciel repart à FA-2026-0001, l'exercice porte DEUX séries pour la même
-- année : le fichier des écritures comptables est refusé par le cabinet, et la numérotation
-- « chronologique et continue » qu'exige l'article 242 nonies A de l'annexe II au CGI n'est plus
-- tenue. Ce n'est pas un confort d'installation, c'est une condition de conformité.
--
-- LA RÈGLE, qui gouverne tout ce fichier : UNE NUMÉROTATION SE POSE AVANT LE PREMIER DOCUMENT,
-- JAMAIS AU MILIEU. Déplacer un compteur après qu'une pièce a été émise crée soit un trou dans la
-- séquence, soit un doublon — les deux sont des anomalies qu'un contrôle relève. La RPC de reprise
-- refuse donc dès qu'un document du type concerné a été produit par l'application pour l'année en
-- cours, et ce refus n'a pas de dérogation.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. `factures.origine` — distinguer ce que l'application a émis de ce qu'on a repris
-- -------------------------------------------------------------------------------------------------
-- Les factures antérieures importées (lot A2) portent un numéro et une date d'émission d'avant
-- l'installation. Sans marque, elles seraient indiscernables des factures émises ici, et trois
-- mécanismes se tromperaient : le journal des ventes les rejouerait alors que l'ancien logiciel les
-- a déjà comptabilisées, le verrou de numérotation se croirait fermé alors que rien n'a encore été
-- émis, et le verrou d'import se fermerait sur lui-même dès la première ligne reprise.
alter table public.factures
  add column if not exists origine text not null default 'application';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'factures_origine_check') then
    alter table public.factures
      add constraint factures_origine_check check (origine in ('application', 'reprise'));
  end if;
end $$;

comment on column public.factures.origine is
  'application = pièce émise par Thermogestion ; reprise = facture antérieure importée à '
  'l''installation (RPC importer_facture_anterieure). Une reprise est déjà comptabilisée par '
  'l''ancien logiciel : elle est exclue du journal des ventes, mais elle compte dans le reste dû, '
  'dans les relances et dans le récapitulatif du matin.';

-- Repérer d'un index les rares lignes reprises : c'est la question que posent le verrou d'import
-- et le journal des ventes à chaque appel.
create index if not exists factures_origine_reprise_idx
  on public.factures (atelier_id)
  where origine = 'reprise';

-- L'origine d'une pièce émise ne se réécrit pas : sans cela, un `update` suffirait à faire passer
-- une facture reprise pour une facture émise ici, et à la faire entrer deux fois en comptabilité.
create or replace function public.trg_figer_document()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_fige boolean;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_col text;
  v_verrouilles text[] := array[
    'items', 'remise', 'total_ht', 'total_tva', 'total_ttc',
    'client_id', 'numero', 'type', 'due_date', 'nature_operation',
    'projet_id', 'devis_id', 'periode_debut', 'periode_fin',
    -- Ajoutée par la migration 48 : voir le commentaire de colonne.
    'origine'
  ];
begin
  if tg_table_name = 'factures'
     and old.status = 'annulee' and new.status is distinct from 'annulee' then
    raise exception 'FACTURE_ANNULEE_DEFINITIVE'
      using hint = 'Une facture annulée le reste, et son numéro reste consommé. Créez une nouvelle facture.';
  end if;

  v_fige := case tg_table_name
              when 'devis' then old.status = 'signe'
              when 'factures' then old.status in ('emise', 'payee', 'annulee')
              else false
            end;
  if not v_fige then return new; end if;

  foreach v_col in array v_verrouilles loop
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      raise exception 'DOCUMENT_FIGE'
        using hint = case tg_table_name
                       when 'devis' then 'Ce devis est signé : il ne peut plus être modifié. Créez une nouvelle version.'
                       else 'Cette facture est émise : elle ne peut plus être modifiée. Émettez un avoir.'
                     end;
    end if;
  end loop;

  return new;
end $function$;

-- Une fonction de trigger n'a rien à faire dans le catalogue exposé par PostgREST.
revoke all on function public.trg_figer_document() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------------------
-- 2. « Ce type de document a-t-il déjà été numéroté cette année ? »
-- -------------------------------------------------------------------------------------------------
-- La question se pose sur les documents eux-mêmes et non sur la table `compteurs` : un compteur
-- avancé par un enregistrement qui a échoué ensuite ne doit pas condamner la reprise, alors qu'un
-- document réellement émis, lui, la condamne.
--
-- L'année est lue dans le numéro (`XX-2026-0001`) plutôt que dans une date : c'est le numéro qui
-- porte la série, et c'est de la série qu'on parle. Les factures reprises sont exclues — elles
-- viennent de l'ancien logiciel, elles n'appartiennent pas à la série que l'application ouvre.
create or replace function public._numerotation_emise(p_atelier uuid, p_type text, p_annee int)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_n int := 0;
  v_like text := '%-' || p_annee::text || '-%';
begin
  case p_type
    when 'devis' then
      select count(*) into v_n from public.devis
       where atelier_id = p_atelier and numero is not null and numero like v_like;
    when 'facture' then
      select count(*) into v_n from public.factures
       where atelier_id = p_atelier and numero is not null and numero like v_like
         and coalesce(type, '') <> 'avoir' and origine <> 'reprise';
    when 'avoir' then
      select count(*) into v_n from public.factures
       where atelier_id = p_atelier and numero is not null and numero like v_like
         and type = 'avoir' and origine <> 'reprise';
    when 'bl' then
      select count(*) into v_n from public.bons_livraison
       where atelier_id = p_atelier and numero is not null and numero like v_like;
    when 'projet' then
      select count(*) into v_n from public.projets
       where atelier_id = p_atelier and numero is not null and numero like v_like;
    when 'jantes' then
      select count(*) into v_n from public.jeux_jantes
       where atelier_id = p_atelier and numero is not null and numero like v_like;
    when 'fournee' then
      -- Les fournées d'avant la migration 48 portaient `F-20260903-1`, qui ne contient pas
      -- `-2026-` : le second motif les reconnaît, sinon un atelier déjà en production croirait sa
      -- numérotation de fournée encore libre.
      select count(*) into v_n from public.fournees
       where atelier_id = p_atelier and numero is not null
         and (numero like v_like or numero like 'F-' || p_annee::text || '%');
    when 'reception' then
      select count(*) into v_n from public.receptions
       where atelier_id = p_atelier and numero is not null and numero like v_like;
    when 'commande' then
      select count(*) into v_n from public.commandes_poudre
       where atelier_id = p_atelier and numero is not null and numero like v_like;
    else
      raise exception 'NUMEROTATION_TYPE_INCONNU'
        using hint = 'Ce type de document ne porte pas de numérotation configurable.';
  end case;
  return coalesce(v_n, 0) > 0;
end $function$;

comment on function public._numerotation_emise(uuid, text, int) is
  'Aide interne du verrou de reprise : vrai dès qu''un document de ce type porte un numéro de '
  'l''année demandée. Jamais exposée — elle prend un atelier en paramètre.';

revoke all on function public._numerotation_emise(uuid, text, int) from public, anon, authenticated;

-- -------------------------------------------------------------------------------------------------
-- 3. Ce que l'écran de réglages affiche
-- -------------------------------------------------------------------------------------------------
-- Les préfixes par défaut répliquent EXACTEMENT ceux de `_next_numero()` : DV, FA, AV, PR, JJ pour
-- les types nommés, `upper(left(type, 2))` pour les autres (bl → BL, fournee → FO). Un écran qui
-- afficherait un autre défaut ferait mentir l'aperçu.
create or replace function public.ma_numerotation()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_atelier uuid := public.current_atelier_id();
  v_annee int := extract(year from now())::int;
  v_settings jsonb := '{}'::jsonb;
  v_out jsonb := '[]'::jsonb;
  v_prefixe text;
  v_prochain int;
  r record;
begin
  if v_atelier is null then return '[]'::jsonb; end if;
  select coalesce(settings -> 'numerotation', '{}'::jsonb) into v_settings
    from public.ateliers where id = v_atelier;

  for r in
    select * from (values
      ('devis',    'Devis',                'DV', 1),
      ('facture',  'Factures',             'FA', 2),
      ('avoir',    'Avoirs',               'AV', 3),
      ('bl',       'Bons de livraison',    'BL', 4),
      ('projet',   'Chantiers',            'PR', 5),
      ('jantes',   'Jeux de jantes',       'JJ', 6),
      ('fournee',  'Fournées',             'FO', 7)
    ) as t(doc_type, libelle, prefixe_defaut, ordre)
    order by t.ordre
  loop
    v_prefixe := coalesce(nullif(v_settings ->> r.doc_type, ''), r.prefixe_defaut);
    select coalesce(valeur, 0) + 1 into v_prochain
      from public.compteurs
     where atelier_id = v_atelier and doc_type = r.doc_type and annee = v_annee;
    v_prochain := coalesce(v_prochain, 1);

    v_out := v_out || jsonb_build_object(
      'type', r.doc_type,
      'libelle', r.libelle,
      'prefixe', v_prefixe,
      'prefixe_defaut', r.prefixe_defaut,
      'prochain', v_prochain,
      'annee', v_annee,
      'verrouille', public._numerotation_emise(v_atelier, r.doc_type, v_annee),
      'apercu', format('%s-%s-%s', v_prefixe, v_annee, lpad(v_prochain::text, 4, '0')));
  end loop;
  return v_out;
end $function$;

comment on function public.ma_numerotation() is
  'Numérotation de l''atelier connecté, type par type : préfixe, prochain numéro, aperçu et '
  'verrou. `verrouille` à vrai signifie qu''un document de ce type est déjà parti cette année et '
  'que la série ne se déplace plus.';

revoke all on function public.ma_numerotation() from public, anon;
grant execute on function public.ma_numerotation() to authenticated;

-- -------------------------------------------------------------------------------------------------
-- 4. Poser sa numérotation
-- -------------------------------------------------------------------------------------------------
create or replace function public.poser_numerotation(p_type text, p_prefixe text, p_prochain int)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atelier uuid := public.current_atelier_id();
  v_annee int := extract(year from now())::int;
  v_prefixe text := upper(trim(coalesce(p_prefixe, '')));
  v_settings jsonb;
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;

  -- La numérotation engage la comptabilité de l'entreprise : elle appartient au responsable, pas
  -- au bureau ni à l'atelier.
  if not public.is_owner() then
    raise exception 'NUMEROTATION_RESERVEE_PROPRIETAIRE'
      using hint = 'Seul le responsable de l''atelier pose la numérotation : elle engage la comptabilité de l''entreprise.';
  end if;

  if p_type is null or p_type not in ('devis', 'facture', 'avoir', 'bl', 'projet', 'jantes', 'fournee', 'reception', 'commande') then
    raise exception 'NUMEROTATION_TYPE_INCONNU'
      using hint = 'Ce type de document ne porte pas de numérotation configurable.';
  end if;

  -- Le préfixe entre dans un numéro dont le séparateur est le tiret : y admettre un tiret, un
  -- espace ou un accent rendrait `FA-2026-0348` illisible pour qui le relit, et pour la relance
  -- qui le cite dans un courriel.
  if v_prefixe !~ '^[A-Z0-9]{1,6}$' then
    raise exception 'NUMEROTATION_PREFIXE_INVALIDE'
      using hint = 'Le préfixe fait de 1 à 6 caractères, lettres non accentuées et chiffres uniquement (FA, DV, FACT…).';
  end if;

  if p_prochain is null or p_prochain < 1 or p_prochain > 999999 then
    raise exception 'NUMEROTATION_RANG_INVALIDE'
      using hint = 'Le prochain numéro est un entier compris entre 1 et 999 999.';
  end if;

  -- Le verrou. Voir l'en-tête du fichier : une numérotation se pose AVANT le premier document.
  if public._numerotation_emise(v_atelier, p_type, v_annee) then
    raise exception 'NUMEROTATION_DEJA_UTILISEE'
      using hint = 'Un document de ce type a déjà été émis cette année : déplacer le compteur maintenant créerait un trou ou un doublon dans votre série. La numérotation se pose avant le premier document.';
  end if;

  -- Le préfixe vit dans `ateliers.settings->'numerotation'`, là où `_next_numero()` le lit déjà
  -- depuis la première migration — et où, jusqu'ici, aucun écran ne l'écrivait.
  select coalesce(settings, '{}'::jsonb) into v_settings from public.ateliers where id = v_atelier;
  update public.ateliers
     set settings = v_settings
                    || jsonb_build_object('numerotation',
                         coalesce(v_settings -> 'numerotation', '{}'::jsonb)
                         || jsonb_build_object(p_type, v_prefixe))
   where id = v_atelier;

  -- Le compteur porte le DERNIER numéro consommé : `_next_numero()` rend `valeur + 1`. Poser
  -- « prochaine facture 348 » revient donc à écrire 347.
  insert into public.compteurs(atelier_id, doc_type, annee, valeur)
  values (v_atelier, p_type, v_annee, p_prochain - 1)
  on conflict (atelier_id, doc_type, annee)
  do update set valeur = excluded.valeur;

  return format('%s-%s-%s', v_prefixe, v_annee, lpad(p_prochain::text, 4, '0'));
end $function$;

comment on function public.poser_numerotation(text, text, int) is
  'Reprise de la numérotation d''un atelier qui migre : préfixe et prochain numéro, par type et '
  'pour l''année civile en cours. Réservée au responsable, refusée dès qu''un document de ce type '
  'a été émis dans l''année — une numérotation se pose avant le premier document, jamais au milieu.';

revoke all on function public.poser_numerotation(text, text, int) from public, anon;
grant execute on function public.poser_numerotation(text, text, int) to authenticated;
