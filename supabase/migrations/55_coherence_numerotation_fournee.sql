-- =================================================================================================
-- 55 — Cohérence de la numérotation des fournées (recette navigateur, vague 1, défaut n°1).
--
-- POURQUOI. `/reglages` annonçait « Le prochain sera FO-2026-0001 » pour un atelier qui a déjà
-- F-2026-0044 et F-2026-0045 en base. Deux causes distinctes, constatées par lecture directe :
--
-- (a) Le préfixe par défaut de `fournee` divergeait entre les deux fonctions qui le décident.
--     `_next_numero()` (posée avant la migration 45, absente du dépôt local) tombe dans son `else
--     upper(left(p_type,2))` faute de `when 'fournee'` explicite, et rend `FO`. `ma_numerotation()`
--     (migration 48) recopiait — à raison — ce même défaut dans sa liste de VALUES : `('fournee',
--     'Fournées', 'FO', 7)`. Les deux fonctions étaient D'ACCORD sur `FO`, mais aucune des deux
--     n'accordait avec l'historique réel de l'atelier, qui numérote ses fournées `F-AAAA-NNNN`
--     depuis toujours (`Atelier Démo Thermolaquage` : F-2026-0044, F-2026-0045).
--
-- (b) `compteurs` ne portait AUCUNE ligne `doc_type = 'fournee'` pour cet atelier (vérifié :
--     `select * from compteurs where doc_type = 'fournee'` ne rend rien, pour aucun atelier). Le
--     compteur n'a jamais été amorcé — les fournées de cet atelier ont dû être numérotées par une
--     séquence antérieure à `_next_numero()/compteurs`, ou par un import direct. Résultat :
--     `ma_numerotation()` lisait `coalesce(valeur, 0) + 1` sur une ligne absente et répondait 1,
--     et le premier appel réel à `_next_numero('fournee')` aurait inséré `compteurs.valeur = 1` et
--     rendu `FO-2026-0001` (ou, après (a), `F-2026-0001`) — un doublon avec aucune fournée existante
--     dans l'immédiat, mais une collision certaine dès que l'atelier recroise une numérotation faite
--     ailleurs, et dans tous les cas une régression de série (0044 → 0001 est un bond en arrière que
--     personne ne lit comme une continuité).
--
-- LA RÈGLE AJOUTÉE : quand `compteurs` n'a pas encore de ligne pour (atelier, type, année), on
-- n'amorce plus à 1 mais au maximum déjà présent dans la série annuelle `PREFIXE-ANNEE-NNNN` de
-- l'atelier, lu directement sur les documents. Un compteur qui n'a jamais existé n'est pas une
-- preuve que la série est vide — seulement que `compteurs` n'a pas suivi.
--
-- Cette migration NE TOUCHE AUCUN NUMÉRO EXISTANT : ni `fournees.numero`, ni aucune autre table de
-- documents. Elle change uniquement comment `_next_numero()` et `ma_numerotation()` calculent le
-- PROCHAIN numéro à distribuer.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. `_valeur_max_numero()` — le plus grand rang déjà porté par la série annuelle de l'atelier.
-- -------------------------------------------------------------------------------------------------
-- Même structure de `case` que `_numerotation_emise()` (migration 48) : une branche par table, pour
-- la même raison — chaque type de document vit dans une table différente, avec ses propres filtres
-- (un avoir n'est pas une facture, une reprise n'appartient pas à la série émise ici).
--
-- Seule la forme annuelle `PREFIXE-ANNEE-NNNN` compte : elle seule porte un rang qui prolonge un
-- compteur. Pour les fournées, l'ancien format `F-AAAAMMJJ-N` (jour + rang du jour) que
-- `_numerotation_emise()` sait reconnaître pour le VERROU n'a pas de rang annuel à prolonger — le
-- confondre avec la forme annuelle ferait démarrer un compteur sur un nombre sans rapport (un « 1 »
-- ou un « 2 » de fin de journée, pas un rang de l'année).
create or replace function public._valeur_max_numero(p_atelier uuid, p_type text, p_annee int)
returns int
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_max int := 0;
  -- Le rang est le dernier groupe de chiffres, juste après `-ANNEE-` : c'est la forme que
  -- `format('%s-%s-%s', prefixe, annee, lpad(valeur,4,'0'))` construit, et la seule qu'on prolonge.
  v_regex text := '-' || p_annee::text || '-([0-9]+)$';
begin
  case p_type
    when 'devis' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.devis
       where atelier_id = p_atelier and numero ~ v_regex;
    when 'facture' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.factures
       where atelier_id = p_atelier and numero ~ v_regex
         and coalesce(type, '') <> 'avoir' and origine <> 'reprise';
    when 'avoir' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.factures
       where atelier_id = p_atelier and numero ~ v_regex
         and type = 'avoir' and origine <> 'reprise';
    when 'bl' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.bons_livraison
       where atelier_id = p_atelier and numero ~ v_regex;
    when 'projet' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.projets
       where atelier_id = p_atelier and numero ~ v_regex;
    when 'jantes' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.jeux_jantes
       where atelier_id = p_atelier and numero ~ v_regex;
    when 'fournee' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.fournees
       where atelier_id = p_atelier and numero ~ v_regex;
    when 'reception' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.receptions
       where atelier_id = p_atelier and numero ~ v_regex;
    when 'commande' then
      select coalesce(max((regexp_match(numero, v_regex))[1]::int), 0) into v_max
        from public.commandes_poudre
       where atelier_id = p_atelier and numero ~ v_regex;
    else
      v_max := 0;
  end case;
  return coalesce(v_max, 0);
end $function$;

comment on function public._valeur_max_numero(uuid, text, int) is
  'Aide interne : plus grand rang déjà porté par la série annuelle PREFIXE-ANNEE-NNNN de l''atelier '
  'pour ce type de document. Sert à amorcer un compteur qui n''a jamais existé sans reculer une '
  'série déjà en cours. Jamais exposée — elle prend un atelier en paramètre.';

revoke all on function public._valeur_max_numero(uuid, text, int) from public, anon, authenticated;

-- -------------------------------------------------------------------------------------------------
-- 2. `_next_numero()` — amorcer au maximum existant, pas à 1 ; et un préfixe par défaut `F` pour
--    les fournées, cohérent avec l'historique.
-- -------------------------------------------------------------------------------------------------
create or replace function public._next_numero(p_atelier uuid, p_type text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_annee int := extract(year from now())::int;
  v_val int;
  v_prefix text;
  v_depart int;
begin
  -- Amorçage : si aucun compteur n'existe encore pour ce type et cette année, on ne part pas de 1
  -- mais du rang maximum déjà émis dans la série annuelle de l'atelier. Un atelier qui a déjà des
  -- fournées F-2026-0044/0045 ne doit jamais revoir 0001 — ce serait soit un doublon si le format
  -- se recroise, soit au minimum une série qui recule sans raison aux yeux de l'atelier.
  -- Si un compteur existe déjà, cette valeur est ignorée par `on conflict do update` ci-dessous :
  -- le calcul n'a de conséquence que sur la toute première ligne insérée pour (atelier, type, annee).
  v_depart := public._valeur_max_numero(p_atelier, p_type, v_annee);

  insert into public.compteurs(atelier_id, doc_type, annee, valeur)
  values (p_atelier, p_type, v_annee, v_depart + 1)
  on conflict (atelier_id, doc_type, annee)
  do update set valeur = public.compteurs.valeur + 1
  returning valeur into v_val;
  v_prefix := coalesce(
    (select settings->'numerotation'->>p_type from public.ateliers where id = p_atelier),
    case p_type when 'devis' then 'DV' when 'facture' then 'FA'
                when 'avoir' then 'AV' when 'projet' then 'PR'
                when 'commande' then 'BC' when 'jantes' then 'JJ'
                -- Le format historique des fournées est F-AAAA-NNNN (voir migration 48,
                -- `_numerotation_emise`) : « FO » ne correspond à aucune fournée jamais émise.
                when 'fournee' then 'F'
                else upper(left(p_type,2)) end
  );
  return format('%s-%s-%s', v_prefix, v_annee, lpad(v_val::text, 4, '0'));
end $function$;

-- -------------------------------------------------------------------------------------------------
-- 3. `ma_numerotation()` — l'écran de réglages doit annoncer exactement ce que `_next_numero()`
--    produira : même préfixe par défaut, même amorçage sur le maximum existant.
-- -------------------------------------------------------------------------------------------------
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
      -- « F », pas « FO » : c'est le préfixe que les fournées portent depuis toujours
      -- (F-2026-0044…), et celui que `_next_numero()` rend désormais par défaut (voir ci-dessus).
      ('fournee',  'Fournées',             'F', 7)
    ) as t(doc_type, libelle, prefixe_defaut, ordre)
    order by t.ordre
  loop
    v_prefixe := coalesce(nullif(v_settings ->> r.doc_type, ''), r.prefixe_defaut);
    select valeur + 1 into v_prochain
      from public.compteurs
     where atelier_id = v_atelier and doc_type = r.doc_type and annee = v_annee;
    -- Même règle d'amorçage que `_next_numero()` : pas de compteur pour ce type/année ne veut pas
    -- dire série vide, seulement que `compteurs` n'a pas encore suivi ce que l'atelier a émis.
    if v_prochain is null then
      v_prochain := public._valeur_max_numero(v_atelier, r.doc_type, v_annee) + 1;
    end if;

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
  'que la série ne se déplace plus. `prochain` repart du maximum déjà émis quand `compteurs` n''a '
  'pas encore de ligne pour ce type et cette année (migration 55) — jamais de 1 sur un atelier qui '
  'a déjà des documents numérotés.';

revoke all on function public.ma_numerotation() from public, anon;
grant execute on function public.ma_numerotation() to authenticated;
