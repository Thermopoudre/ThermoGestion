-- =============================================================================
-- 56 — Acompte à la commande, devis à options, prix par palier de quantité
-- =============================================================================
--
-- POURQUOI CETTE MIGRATION (lot C, cahier des charges v3 §3 — C1 et C5)
--
-- C1 : un devis peut demander un acompte à la signature (`devis.acompte_pct`, 0-100). Le montant
-- se calcule à l'écran, sur le PDF et sur la page publique ; à la signature, l'atelier propose
-- d'un clic la facture d'acompte au bon montant. La déduction de cet acompte sur la facture de
-- solde est déjà câblée (`lignesDeductionAcomptes`, migration d'origine) — cette migration ne la
-- touche pas.
--
-- C5 : un item de devis peut être `optionnel` (« en option », non compté dans le total tant que le
-- client ne l'a pas coché) et une prestation peut avoir des `paliers_quantite` (prix dégressif).
-- Le choix d'options se fait à la signature : `signer_devis` reçoit désormais la liste des options
-- acceptées, retire du devis signé celles qui ne le sont pas, et **fige** les totaux en conséquence
-- — un devis signé ne recalcule plus jamais rien après coup.
--
-- Recalculer les totaux à la signature suppose de savoir faire la même arithmétique qu'à l'écran
-- (remise, ventilation de TVA, forfait minimum) sans la dupliquer à l'œil dans un bloc PL/pgSQL :
-- `totaux_devis_items` est un mirror SQL explicite de `ventilationParTaux`/`calcTotaux`
-- (src/lib/utils.ts), volontairement **sans** la déduction d'acompte — elle n'existe que sur une
-- facture, jamais sur un devis. Toute évolution de la remise ou du forfait minimum côté TypeScript
-- doit être répercutée ici.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Colonnes
-- -----------------------------------------------------------------------------

alter table public.devis add column if not exists acompte_pct numeric;
comment on column public.devis.acompte_pct is
  'Acompte à la commande, en % du total TTC (0-100). NULL = pas d''acompte demandé sur ce devis.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'devis_acompte_pct_check') then
    alter table public.devis
      add constraint devis_acompte_pct_check
      check (acompte_pct is null or acompte_pct between 0 and 100);
  end if;
end $$;

-- Posée ici (mécanique de signature) même si elle ne sert qu'à C6 (rétractation) : c'est
-- `signer_devis` qui la remplit, et les deux migrations doivent s'appliquer dans l'ordre.
alter table public.devis add column if not exists signature_hors_etablissement boolean not null default false;
comment on column public.devis.signature_hors_etablissement is
  'Vrai si le client a signé hors établissement (domicile, foire, salon...) — fait courir le délai '
  'de rétractation de 14 jours pour un particulier (art. L221-18 du code de la consommation).';

-- Coordonnées du médiateur de la consommation (C6, migration 59) : posées ici pour que
-- `devis_public` (section 4 ci-dessous) puisse les exposer dès cette migration. Vides par défaut
-- — aucun atelier réel n'a de médiateur désigné tant qu'il ne l'a pas saisi dans Réglages.
alter table public.ateliers add column if not exists mediateur_nom text;
alter table public.ateliers add column if not exists mediateur_adresse text;
comment on column public.ateliers.mediateur_nom is
  'Médiateur de la consommation désigné par l''atelier (mention obligatoire B2C, art. L616-1 du code de la consommation). Vide par défaut.';

-- `paliers_quantite` : [{ "a_partir_de": 10, "prix": 8.5 }, ...]. Tableau vide = pas de dégressif,
-- le prix catalogue de la prestation s'applique quelle que soit la quantité — comportement inchangé.
alter table public.prestations add column if not exists paliers_quantite jsonb not null default '[]'::jsonb;
comment on column public.prestations.paliers_quantite is
  'Paliers de prix dégressif par quantité : [{a_partir_de, prix}]. Le palier retenu est celui dont '
  '`a_partir_de` est le plus élevé sans dépasser la quantité saisie. Vide = prix catalogue fixe.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prestations_paliers_quantite_check') then
    alter table public.prestations
      add constraint prestations_paliers_quantite_check
      check (jsonb_typeof(paliers_quantite) = 'array');
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. Miroir SQL de calcTotaux / ventilationParTaux (src/lib/utils.ts), sans acompte
-- -----------------------------------------------------------------------------

-- Fonction pure (pas de lecture de table) : l'exécution reste ouverte à PUBLIC par défaut, comme
-- `devis_echeance`/`devis_perime` (migration 45) — aucune donnée sensible n'est en jeu ici.
create or replace function public.totaux_devis_items(p_items jsonb, p_remise jsonb)
returns table(total_ht numeric, total_tva numeric, total_ttc numeric)
language sql
immutable
parallel safe
set search_path to 'public'
as $function$
  with lignes as (
    select
      coalesce((it->>'total_ht')::numeric, 0) as total_ht,
      coalesce((it->>'tva')::numeric, 0) as tva,
      coalesce((it#>>'{meta,forfait_minimum}')::boolean, false) as forfait_minimum
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
  ),
  base as (
    select coalesce(sum(total_ht) filter (where not forfait_minimum), 0) as remisable
    from lignes
  ),
  remise_montant as (
    select case
      when p_remise is null or coalesce((p_remise->>'valeur')::numeric, 0) = 0 then 0::numeric
      when p_remise->>'type' = 'pct'
        then least(base.remisable * coalesce((p_remise->>'valeur')::numeric, 0) / 100.0, base.remisable)
      else least(coalesce((p_remise->>'valeur')::numeric, 0), base.remisable)
    end as montant,
    base.remisable as remisable
    from base
  ),
  par_taux as (
    select
      tva,
      sum(total_ht) as brut,
      sum(total_ht) filter (where not forfait_minimum) as remisable_taux
    from lignes
    group by tva
  ),
  ventile as (
    select
      pt.tva,
      round(
        pt.brut - rm.montant * (case when rm.remisable > 0 then coalesce(pt.remisable_taux, 0) / rm.remisable else 0 end),
        2
      ) as base_ht
    from par_taux pt cross join remise_montant rm
  )
  select
    round(coalesce(sum(v.base_ht), 0), 2) as total_ht,
    round(coalesce(sum(round(v.base_ht * v.tva / 100.0, 2)), 0), 2) as total_tva,
    round(coalesce(sum(v.base_ht), 0) + coalesce(sum(round(v.base_ht * v.tva / 100.0, 2)), 0), 2) as total_ttc
  from ventile v
$function$;

comment on function public.totaux_devis_items(jsonb, jsonb) is
  'Miroir SQL de calcTotaux/ventilationParTaux (src/lib/utils.ts) pour les items d''un DEVIS — '
  'sans déduction d''acompte, qui n''existe que sur une facture. Utilisée par signer_devis pour '
  'figer les totaux après acceptation des options (migration 56).';


-- -----------------------------------------------------------------------------
-- 3. signer_devis : options acceptées + hors établissement
-- -----------------------------------------------------------------------------

-- Nouvelle signature (deux paramètres en plus, avec défaut) : l'ancienne est retirée pour de bon,
-- sinon les deux coexisteraient et l'ancienne resterait un moyen de signer sans passer par le
-- choix d'options ni par la mention « hors établissement ».
drop function if exists public.signer_devis(text, text, jsonb, text);

create or replace function public.signer_devis(
  p_token text,
  p_nom text,
  p_signature jsonb,
  p_ip text,
  -- Identifiants (`meta.option_id`) des lignes optionnelles que le client retient. Une ligne
  -- optionnelle absente de cette liste est retirée du devis signé : elle n'a jamais été vendue.
  p_options_acceptees jsonb default '[]'::jsonb,
  p_hors_etablissement boolean default false
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_d public.devis;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_accepte boolean;
  v_totaux record;
begin
  select * into v_d from public.devis
   where public_token = p_token
     and status = 'envoye'
     and deleted_at is null
   for update;
  if not found then return false; end if;

  if public.devis_perime(v_d.envoye_at, v_d.created_at, v_d.validite_jours) then
    raise exception 'DEVIS_EXPIRE'
      using hint = 'Ce devis a dépassé sa durée de validité. Demandez-en un nouveau à l''atelier : les prix ont pu changer.';
  end if;

  -- Options : le devis signé fige le choix du client. Une option retenue reste marquée
  -- `optionnel` (traçabilité — le PDF peut encore dire « option retenue ») mais compte désormais
  -- dans le total ; une option écartée disparaît purement et simplement des lignes signées.
  for v_item in select * from jsonb_array_elements(coalesce(v_d.items, '[]'::jsonb))
  loop
    if coalesce((v_item->>'optionnel')::boolean, false) then
      v_accepte := coalesce(v_item->>'option_id', '') <> ''
        and exists (
          select 1 from jsonb_array_elements_text(coalesce(p_options_acceptees, '[]'::jsonb)) o(v)
           where o.v = v_item->>'option_id'
        );
      if v_accepte then
        v_items := v_items || jsonb_build_array(v_item || jsonb_build_object('optionnel_accepte', true));
      end if;
    else
      v_items := v_items || jsonb_build_array(v_item);
    end if;
  end loop;

  select * into v_totaux from public.totaux_devis_items(v_items, v_d.remise);

  update public.devis
     set status = 'signe', signed_at = now(), signed_by = p_nom,
         signature_data = p_signature, signature_ip = p_ip,
         signature_hors_etablissement = coalesce(p_hors_etablissement, false),
         items = v_items,
         total_ht = v_totaux.total_ht, total_tva = v_totaux.total_tva, total_ttc = v_totaux.total_ttc
   where id = v_d.id;
  return true;
end $function$;

grant execute on function public.signer_devis(text, text, jsonb, text, jsonb, boolean) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. devis_public : acompte, type de client, mention hors établissement
-- -----------------------------------------------------------------------------

-- `client.type` était absent du jsonb public : impossible d'y lire un particulier pour la mention
-- de rétractation (C6). `acompte_pct` et son montant sont ajoutés pour C1.
create or replace function public.devis_public(p_token text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'numero', d.numero, 'status', d.status, 'items', d.items, 'remise', d.remise,
    'total_ht', d.total_ht, 'total_tva', d.total_tva, 'total_ttc', d.total_ttc,
    'notes', d.notes, 'created_at', d.created_at, 'validite_jours', d.validite_jours,
    'envoye_at', d.envoye_at,
    'expire_le', public.devis_echeance(d.envoye_at, d.created_at, d.validite_jours),
    'signed_at', d.signed_at, 'pdf_url', d.pdf_url,
    'acompte_pct', d.acompte_pct,
    'montant_acompte', case when d.acompte_pct is not null and d.acompte_pct > 0
                             then round(d.total_ttc * d.acompte_pct / 100.0, 2) else null end,
    'signature_hors_etablissement', d.signature_hors_etablissement,
    'client', jsonb_build_object('nom', c.nom, 'type', c.type),
    'atelier', jsonb_build_object(
      'nom', a.nom, 'logo_url', a.logo_url, 'couleur', a.couleur,
      'telephone', a.telephone, 'email', a.email,
      'adresse', trim(concat_ws(' ', a.adresse, a.adresse_complement)),
      'code_postal', a.code_postal, 'ville', a.ville,
      'siren', a.siren, 'siret', a.siret, 'tva_intra', a.tva_intra,
      'forme_juridique', a.forme_juridique, 'capital_social', a.capital_social,
      'rcs_ville', a.rcs_ville, 'rm_numero', a.rm_numero,
      'assujetti_tva', a.assujetti_tva,
      'delai_paiement_jours', a.delai_paiement_jours, 'penalites_taux', a.penalites_taux,
      'assurance_nom', a.assurance_nom, 'assurance_contrat', a.assurance_contrat, 'assurance_zone', a.assurance_zone,
      'mediateur_nom', a.mediateur_nom, 'mediateur_adresse', a.mediateur_adresse
    )
  )
  from public.devis d
  join public.clients c on c.id = d.client_id
  join public.ateliers a on a.id = d.atelier_id
  where d.public_token = p_token and d.deleted_at is null
    and d.status <> 'brouillon'
$function$;

grant execute on function public.devis_public(text) to anon, authenticated;
