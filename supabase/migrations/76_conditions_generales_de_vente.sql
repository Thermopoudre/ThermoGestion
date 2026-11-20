-- =================================================================================================
-- 76 — Chaque atelier peut poser ses propres conditions générales de vente sur ses devis et ses
--      factures, avec une surcharge facultative par client.
--
-- LE SCHÉMA. Deux niveaux :
--   - `ateliers.cgv`  : les conditions par défaut de l'atelier, valables pour tous ses documents.
--   - `clients.cgv`   : une surcharge facultative pour un client avec qui l'atelier a négocié des
--                       conditions particulières. Quand elle existe, elle REMPLACE entièrement
--                       celle de l'atelier — on ne concatène jamais deux textes juridiques bout à
--                       bout, ils finiraient par se contredire.
--
-- LE FIGEAGE. Au moment où un devis est envoyé (passage à `envoye`) et où une facture est émise
-- (passage à `emise`), le texte des conditions EN VIGUEUR à cet instant est recopié sur le document
-- (`devis.cgv_texte`, `factures.cgv_texte`). Un client signe un devis en acceptant des conditions
-- précises ; si l'atelier modifie les siennes six mois plus tard, le document déjà signé ne doit
-- pas changer rétroactivement — ce serait réécrire ce que le client a accepté. Un brouillon, lui,
-- n'a pas encore de texte figé : l'écran et le PDF y affichent les conditions en vigueur au moment
-- de la consultation.
--
-- Le figeage se fait en base, dans un trigger (`trg_figer_cgv`), pas côté React : un garde-fou qui
-- n'existe que dans le navigateur se contourne depuis sa console. Une fois posé, `cgv_texte` est
-- protégé au même titre que les autres colonnes verrouillées par `trg_figer_document` (migration
-- 48) : ajouté à `v_verrouilles`, il ne peut plus être modifié une fois le devis signé ou la
-- facture émise/payée/annulée.
--
-- LA BORNE. `char_length(...) <= 20000` (~20 000 caractères, de l'ordre de 3 000 à 4 000 mots) :
-- assez pour de vraies conditions générales complètes (garantie, responsabilité, rétractation,
-- juridiction, propriété industrielle...), largement au-dessus des CGV réelles d'une PME
-- artisanale qui tiennent le plus souvent en 1 500 à 4 000 mots, mais assez bas pour qu'un texte
-- ne fasse jamais exploser la pagination du PDF (une poignée de pages en annexe, jamais des
-- dizaines).
--
-- LE CONTENU. Le champ est VIDE PAR DÉFAUT. Aucun modèle de conditions n'est fourni ici : un texte
-- pré-rempli serait un conseil juridique donné à des ateliers qui l'appliqueraient sans le lire.
-- =================================================================================================

-- -------------------------------------------------------------------------------------------------
-- 1. Colonnes
-- -------------------------------------------------------------------------------------------------
alter table public.ateliers add column if not exists cgv text;
alter table public.clients  add column if not exists cgv text;
alter table public.devis    add column if not exists cgv_texte text;
alter table public.factures add column if not exists cgv_texte text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ateliers_cgv_longueur_check') then
    alter table public.ateliers
      add constraint ateliers_cgv_longueur_check check (cgv is null or char_length(cgv) <= 20000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_cgv_longueur_check') then
    alter table public.clients
      add constraint clients_cgv_longueur_check check (cgv is null or char_length(cgv) <= 20000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'devis_cgv_texte_longueur_check') then
    alter table public.devis
      add constraint devis_cgv_texte_longueur_check check (cgv_texte is null or char_length(cgv_texte) <= 20000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'factures_cgv_texte_longueur_check') then
    alter table public.factures
      add constraint factures_cgv_texte_longueur_check check (cgv_texte is null or char_length(cgv_texte) <= 20000);
  end if;
end $$;

comment on column public.ateliers.cgv is
  'Conditions générales de vente par défaut de l''atelier, valables pour tous ses devis et '
  'factures. Vide par défaut — aucun modèle n''est fourni, ce serait donner un conseil juridique. '
  'Le texte en vigueur au moment de l''envoi/émission d''un document est recopié dans '
  'devis.cgv_texte / factures.cgv_texte par trg_figer_cgv() : modifier ce champ n''affecte jamais '
  'un document déjà parti.';

comment on column public.clients.cgv is
  'Surcharge facultative des conditions générales de vente de l''atelier pour ce client précis '
  '(conditions négociées). Quand elle est renseignée, elle REMPLACE entièrement celle de l''atelier '
  '— les deux textes ne se concatènent jamais.';

comment on column public.devis.cgv_texte is
  'Texte des conditions générales de vente figé au premier passage en "envoyé" (posé par '
  'trg_figer_cgv). NULL tant que le devis est un brouillon : l''écran et le PDF affichent alors les '
  'conditions en vigueur (client.cgv ?? atelier.cgv), calculées à la volée. Verrouillé par '
  'trg_figer_document une fois le devis signé.';

comment on column public.factures.cgv_texte is
  'Texte des conditions générales de vente figé au premier passage en "émise" (posé par '
  'trg_figer_cgv). NULL tant que la facture est un brouillon. Verrouillé par trg_figer_document une '
  'fois la facture émise/payée/annulée.';

-- -------------------------------------------------------------------------------------------------
-- 2. Le figeage — recopie le texte en vigueur au moment où le document part
-- -------------------------------------------------------------------------------------------------
-- Ne recalcule JAMAIS un `cgv_texte` déjà posé (`new.cgv_texte is null`) : une fois figé, il ne
-- bouge plus tant que ce trigger est seul en jeu — et une fois le document réellement verrouillé
-- (devis signé, facture émise/payée/annulée), `trg_figer_document` (ci-dessous) empêche même une
-- écriture directe de le changer.
--
-- Les factures reprises (`origine = 'reprise'`, migration 48) sont exclues : ce sont des pièces
-- émises par l'ancien logiciel de l'atelier avant l'installation de Thermogestion — leur donner les
-- conditions générales d'aujourd'hui inventerait une mention qui n'a jamais existé sur ces
-- documents.
create or replace function public.trg_figer_cgv()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_cgv_client text;
  v_cgv_atelier text;
begin
  if tg_table_name = 'devis' and new.cgv_texte is null and new.status in ('envoye', 'signe') then
    select c.cgv, a.cgv into v_cgv_client, v_cgv_atelier
      from public.ateliers a
      left join public.clients c on c.id = new.client_id
     where a.id = new.atelier_id;
    new.cgv_texte := nullif(trim(coalesce(v_cgv_client, v_cgv_atelier, '')), '');
  elsif tg_table_name = 'factures' and new.cgv_texte is null and new.status in ('emise', 'payee', 'annulee')
        and coalesce(new.origine, 'application') = 'application' then
    select c.cgv, a.cgv into v_cgv_client, v_cgv_atelier
      from public.ateliers a
      left join public.clients c on c.id = new.client_id
     where a.id = new.atelier_id;
    new.cgv_texte := nullif(trim(coalesce(v_cgv_client, v_cgv_atelier, '')), '');
  end if;
  return new;
end $function$;

comment on function public.trg_figer_cgv() is
  'Recopie sur le document (devis.cgv_texte / factures.cgv_texte) les conditions générales en '
  'vigueur (surcharge du client, sinon défaut de l''atelier) au premier passage en "envoyé"/"signé" '
  '(devis) ou "émise"/"payée"/"annulée" (facture). N''écrase jamais un cgv_texte déjà posé.';

-- Une fonction de trigger n'a rien à faire dans le catalogue exposé par PostgREST.
revoke all on function public.trg_figer_cgv() from public, anon, authenticated;

drop trigger if exists figer_cgv on public.devis;
create trigger figer_cgv
before insert or update on public.devis
for each row execute function public.trg_figer_cgv();

drop trigger if exists figer_cgv on public.factures;
create trigger figer_cgv
before insert or update on public.factures
for each row execute function public.trg_figer_cgv();

-- -------------------------------------------------------------------------------------------------
-- 3. Verrouillage — `cgv_texte` rejoint les colonnes que `trg_figer_document` protège
-- -------------------------------------------------------------------------------------------------
-- Même signature que la définition de la migration 48 (`trg_figer_document()`, sans paramètre) :
-- `create or replace` la remplace donc proprement, sans créer de surcharge. Elle a déjà son
-- `search_path` posé, et les grants existants (aucun — cf. `revoke` ci-dessous, réaffirmé par
-- prudence) ne sont pas touchés par un simple `create or replace`.
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
    'origine',
    -- Ajoutée par la migration 76 : les conditions générales figées à l'envoi/l'émission ne se
    -- réécrivent pas davantage que le reste du document une fois celui-ci verrouillé.
    'cgv_texte'
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

revoke all on function public.trg_figer_document() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------------------
-- 4. Pages publiques — `devis_public()` et `facture_public()` rendent le texte figé
-- -------------------------------------------------------------------------------------------------
-- Ces deux fonctions sont `SECURITY DEFINER`, exposées à `anon` (liste blanche du filet de
-- sécurité, tests/securite-privileges.test.ts) : on ajoute UNIQUEMENT le champ `cgv`, rien d'autre
-- au passage. Ni l'une ni l'autre ne sert de brouillon (`status <> 'brouillon'` dans le `where`),
-- donc `cgv_texte` y est déjà figé dans tous les cas où ces fonctions répondent — pas besoin d'y
-- recalculer un texte "en vigueur".
--
-- Même signature que l'existant (`p_token text`), donc un `create or replace` propre : pas de
-- surcharge créée, et les grants déjà posés (anon + authenticated) ne bougent pas.
create or replace function public.devis_public(p_token text)
returns jsonb
language sql
stable security definer
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
    'cgv', d.cgv_texte,
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

revoke all on function public.devis_public(text) from public;
grant execute on function public.devis_public(text) to anon, authenticated;

create or replace function public.facture_public(p_token text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'numero', f.numero, 'type', f.type, 'status', f.status, 'items', f.items,
    'remise', f.remise,
    'total_ht', f.total_ht, 'total_tva', f.total_tva, 'total_ttc', f.total_ttc,
    'due_date', f.due_date, 'emise_at', f.emise_at, 'pdf_url', f.pdf_url,
    'nature_operation', f.nature_operation,
    'stripe_payment_link', f.stripe_payment_link,
    'cgv', f.cgv_texte,
    'client', jsonb_build_object(
      'nom', c.nom, 'siren', c.siren,
      'adresse', c.adresse, 'code_postal', c.code_postal, 'ville', c.ville,
      'delai_paiement_jours', c.delai_paiement_jours,
      'adresse_livraison', case
        when c.adresse_livraison is not null and c.adresse_livraison is distinct from c.adresse
        then trim(concat_ws(' ', c.adresse_livraison, c.code_postal_livraison, c.ville_livraison))
        else null end
    ),
    'atelier', jsonb_build_object(
      'nom', a.nom, 'logo_url', a.logo_url, 'couleur', a.couleur,
      'telephone', a.telephone, 'email', a.email,
      'iban', b.iban, 'bic', b.bic, 'stripe_ready', (a.stripe_account_id is not null),
      'adresse', trim(concat_ws(' ', a.adresse, a.adresse_complement)),
      'code_postal', a.code_postal, 'ville', a.ville,
      'siren', a.siren, 'siret', a.siret, 'tva_intra', a.tva_intra,
      'forme_juridique', a.forme_juridique, 'capital_social', a.capital_social,
      'rcs_ville', a.rcs_ville, 'rm_numero', a.rm_numero,
      'assujetti_tva', a.assujetti_tva, 'tva_sur_debits', a.tva_sur_debits,
      'delai_paiement_jours', a.delai_paiement_jours, 'penalites_taux', a.penalites_taux,
      'escompte_texte', a.escompte_texte,
      'assurance_nom', a.assurance_nom, 'assurance_contrat', a.assurance_contrat, 'assurance_zone', a.assurance_zone
    )
  )
  from public.factures f
  join public.clients c on c.id = f.client_id
  join public.ateliers a on a.id = f.atelier_id
  left join public.ateliers_bancaire b on b.atelier_id = a.id
  where f.public_token = p_token and f.deleted_at is null
    -- Une facture en brouillon n'a pas de numéro, pas de date d'émission, et ses montants bougent
    -- encore. La servir, c'est laisser un client payer un document qui n'existe pas comptablement.
    and f.status <> 'brouillon'
$function$;

revoke all on function public.facture_public(text) from public;
grant execute on function public.facture_public(text) to anon, authenticated;
