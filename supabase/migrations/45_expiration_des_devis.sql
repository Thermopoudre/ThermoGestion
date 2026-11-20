-- =============================================================================
-- 45 — L'expiration des devis, appliquée en base
-- =============================================================================
--
-- APPLIQUÉE LE 21/08/2026, en trois morceaux pour tenir dans les appels de migration :
--   45a_expiration_des_devis_echeance_et_validite  (sections 1 et 2)
--   45b_expiration_des_devis_signature_et_cron     (sections 3 et 4)
--   45c_expiration_des_devis_relance_public_portail (sections 5, 6 et 7)
-- L'ordre est celui du fichier : 45b appelle `devis_perime` posée par 45a, 45c appelle
-- `devis_echeance` posée par 45a. Le contenu est identique à ce fichier, découpe mise à part.
--
-- POURQUOI CETTE MIGRATION
--
-- `devis.status = 'expire'` était autorisé par la contrainte, **lu** partout (le filtre
-- « Refusés / expirés » de la liste, `peutRouvrir` sur la fiche, le type TypeScript) et
-- **écrit nulle part** : aucune fonction, aucun trigger, aucun cron ne le posait.
--
-- Conséquence : les douze devis en base portent `validite_jours = 30`, ce chiffre est imprimé
-- sur le PDF et sur la page publique — « Devis valable 30 jours » — et rien ne faisait jamais
-- expirer quoi que ce soit. `signer_devis` ne contrôlait aucune date : un devis de l'an dernier
-- se signait encore aujourd'hui, au prix de l'an dernier, et `trg_devis_signe` créait le projet
-- derrière. C'est le jumeau exact du défaut corrigé la veille sur le statut `annulee`.
--
-- Cette migration pose quatre choses :
--   1. une définition unique de l'échéance (`devis_echeance`) et de la péremption
--      (`devis_perime`), pour que la base, le PDF, la page publique et le portail cessent de
--      la recalculer chacun à sa façon ;
--   2. le refus de signature d'un devis périmé, **dans `signer_devis`**, avec un message qui
--      dit quoi faire ensuite ;
--   3. le passage automatique en `expire`, par un cron quotidien qui tourne AVANT les relances ;
--   4. une durée de validité paramétrable par atelier, parce qu'aujourd'hui les 30 jours ne
--      viennent de nulle part d'autre que du `default` de la colonne, et ne sont saisissables
--      sur aucun écran.
--
-- Ce qui n'est PAS touché, volontairement : un devis signé, facturé, remplacé ou à la corbeille
-- ne se périme jamais. Un devis périmé se rouvre — `rouvrir_devis` l'accepte déjà — et la
-- refinalisation repart d'un `envoye_at` neuf, donc d'une validité neuve.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. L'échéance : une seule définition
-- -----------------------------------------------------------------------------

-- POURQUOI `coalesce(envoye_at, created_at)` et pas `created_at` seul.
--
-- `created_at` est la date de saisie du brouillon ; `envoye_at` est la date à laquelle le devis
-- est parti chez le client, et c'est elle qui fait courir la validité. La différence est
-- invisible sur un devis rédigé et envoyé le même jour — elle devient décisive dès qu'un devis
-- est rouvert puis refinalisé : `rouvrir_devis` remet `envoye_at` à NULL, la refinalisation en
-- pose un nouveau, et la validité repart. Calculée sur `created_at`, elle resterait périmée à
-- vie. Le repli sur `created_at` couvre le devis d'avant cette migration dont `envoye_at`
-- serait resté vide.
--
-- POURQUOI Europe/Paris. Le serveur est en UTC ; un devis finalisé à 00 h 30 à Bandol est
-- enregistré la veille en UTC, et perdrait une journée de validité. Les ateliers sont français,
-- l'échéance se compte en jours calendaires français.
create or replace function public.devis_echeance(
  p_envoye_at      timestamptz,
  p_created_at     timestamptz,
  p_validite_jours integer
) returns date
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select (timezone('Europe/Paris', coalesce(p_envoye_at, p_created_at)))::date
         + coalesce(p_validite_jours, 30)
$$;

comment on function public.devis_echeance(timestamptz, timestamptz, integer) is
  'Dernier jour où un devis peut être signé. Miroir de echeanceDevis() dans src/lib/devis.ts.';

-- Le jour de l'échéance, le devis est **encore** signable : la comparaison est stricte.
-- Un client qui ouvre son devis le trentième jour au matin ne doit pas trouver porte close.
create or replace function public.devis_perime(
  p_envoye_at      timestamptz,
  p_created_at     timestamptz,
  p_validite_jours integer
) returns boolean
language sql
stable
parallel safe
set search_path to 'public'
as $$
  select public.devis_echeance(p_envoye_at, p_created_at, p_validite_jours)
       < (timezone('Europe/Paris', now()))::date
$$;

comment on function public.devis_perime(timestamptz, timestamptz, integer) is
  'Vrai si la durée de validité du devis est dépassée. Le jour de l''échéance reste signable.';


-- -----------------------------------------------------------------------------
-- 2. La durée de validité, paramétrable par atelier
-- -----------------------------------------------------------------------------

-- D'OÙ VENAIENT LES 30 JOURS : du `default` de la colonne `devis.validite_jours`, et de nulle
-- part ailleurs. Aucun écran ne la saisissait — ni l'éditeur de devis, ni les réglages. Un
-- atelier qui travaille sur des cotations à sept jours (poudre au cours du marché) n'avait
-- aucun moyen de le dire, et imprimait « valable 30 jours » sur chacun de ses devis.
--
-- La colonne reste **nullable** et sans valeur pour les ateliers existants : NULL veut dire
-- « le défaut du produit », soit 30 jours. Aucune ligne des deux ateliers réels n'est réécrite.
alter table public.ateliers
  add column if not exists devis_validite_jours integer;

comment on column public.ateliers.devis_validite_jours is
  'Durée de validité appliquée aux nouveaux devis de cet atelier. NULL = 30 jours, le défaut du produit.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ateliers_devis_validite_jours_check') then
    alter table public.ateliers
      add constraint ateliers_devis_validite_jours_check
      check (devis_validite_jours is null or devis_validite_jours between 1 and 365);
  end if;
end $$;

-- Le `default` de la colonne du devis s'efface au profit d'un trigger : un `default` ne peut pas
-- lire une autre colonne de la ligne (`atelier_id`), donc il ne pourra jamais aller chercher le
-- réglage de l'atelier. La contrainte NOT NULL est évaluée APRÈS les triggers BEFORE : une
-- insertion qui omet `validite_jours` passe donc par le trigger, et ressort remplie.
alter table public.devis alter column validite_jours drop default;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'devis_validite_jours_check') then
    alter table public.devis
      add constraint devis_validite_jours_check
      check (validite_jours between 1 and 365);
  end if;
end $$;

create or replace function public.trg_devis_validite_defaut()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Valeur explicite (duplication, nouvelle version, saisie) : on ne la touche pas.
  if new.validite_jours is not null then
    return new;
  end if;
  select coalesce(a.devis_validite_jours, 30)
    into new.validite_jours
    from public.ateliers a
   where a.id = new.atelier_id;
  -- Atelier introuvable : la clé étrangère rejettera la ligne juste après. On pose quand même
  -- une valeur pour que le refus soit celui de la clé étrangère, lisible, et pas un NOT NULL.
  new.validite_jours := coalesce(new.validite_jours, 30);
  return new;
end $$;

-- SECURITY DEFINER parce que la fonction lit `ateliers` : elle doit répondre la même chose quel
-- que soit le rôle qui insère le devis. Elle est révoquée de PostgREST comme toutes les
-- fonctions de trigger du projet (migrations 26 et 38) — `revoke from public` ne suffit pas sur
-- Supabase, `anon` et `authenticated` portent leurs propres droits.
revoke all on function public.trg_devis_validite_defaut() from public, anon, authenticated;

drop trigger if exists devis_validite_defaut on public.devis;
create trigger devis_validite_defaut
  before insert on public.devis
  for each row execute function public.trg_devis_validite_defaut();


-- -----------------------------------------------------------------------------
-- 3. La signature d'un devis périmé est refusée en base
-- -----------------------------------------------------------------------------

-- C'est le cœur du correctif. Le refus doit vivre ici et pas dans React : la page publique est
-- servie à un client anonyme qui appelle la RPC directement, et un contrôle de date fait dans
-- le navigateur est un contrôle qu'on peut sauter.
--
-- Le message dit quoi faire — « demandez-en un nouveau » — parce qu'un refus qui n'indique pas
-- la sortie est un refus qu'on appelle au téléphone.
create or replace function public.signer_devis(p_token text, p_nom text, p_signature jsonb, p_ip text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_d public.devis;
begin
  select * into v_d from public.devis
   where public_token = p_token
     and status = 'envoye'
     -- La condition qui manquait : un devis à la corbeille est introuvable en lecture, il doit
     -- l'être en signature. Sans elle, `trg_devis_signe` créait un projet vivant rattaché à un
     -- devis que plus personne ne voit.
     and deleted_at is null
   for update;
  if not found then return false; end if;

  -- Le devis n'est pas encore passé en `expire` — le cron ne tourne qu'une fois par jour — mais
  -- sa durée de validité est dépassée : on refuse tout de suite. Sans ce contrôle, un devis d'il
  -- y a un an se signait au prix d'il y a un an, et le projet se créait derrière.
  if public.devis_perime(v_d.envoye_at, v_d.created_at, v_d.validite_jours) then
    raise exception 'DEVIS_EXPIRE'
      using hint = 'Ce devis a dépassé sa durée de validité. Demandez-en un nouveau à l''atelier : les prix ont pu changer.';
  end if;

  update public.devis
     set status = 'signe', signed_at = now(), signed_by = p_nom,
         signature_data = p_signature, signature_ip = p_ip
   where id = v_d.id;
  return true;
end $function$;

-- `signer_devis` reste appelable par un client anonyme : c'est tout son objet.
grant execute on function public.signer_devis(text, text, jsonb, text) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. Le passage en `expire`, tout seul
-- -----------------------------------------------------------------------------

-- Surcharge sans paramètre d'une version antérieure, s'il en traîne une.
drop function if exists public.expirer_devis();

-- POURQUOI le paramètre `p_atelier`, alors que le cron ne s'en sert pas : sans lui, la seule
-- façon d'éprouver cette fonction serait de la lancer sur la base entière — donc de faire
-- vieillir les devis des ateliers réels pour vérifier un correctif. Le test la borne à
-- l'atelier jetable ; le cron l'appelle sans argument et balaie tout.
create or replace function public.expirer_devis(p_atelier uuid default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_total integer := 0;
begin
  for r in
    select d.id
      from public.devis d
      join public.ateliers a on a.id = d.atelier_id
     -- Bornage optionnel : NULL = tous les ateliers, c'est le cas du cron.
     where (p_atelier is null or d.atelier_id = p_atelier)
     -- `status = 'envoye'` exclut déjà, par construction, le brouillon (jamais parti), le signé
     -- (il engage les deux parties), le refusé et le remplacé (une version plus récente fait foi).
       and d.status = 'envoye'
       -- Une pièce à la corbeille ne change plus d'état : elle attend sa purge ou sa restauration.
       and d.deleted_at is null
       -- L'atelier vitrine est un décor figé : ses devis ne doivent pas vieillir sous les yeux
       -- des visiteurs. `trg_interdire_ecriture_demo` refuserait de toute façon l'écriture — on
       -- l'écarte ici pour que ce soit une décision lisible et pas une exception rattrapée.
       and not coalesce(a.demo, false)
       -- Ceinture et bretelles : un devis déjà facturé n'a plus à expirer, même si son statut
       -- avait été laissé à « envoyé » par une manipulation ancienne.
       and not exists (
         select 1 from public.factures f
          where f.devis_id = d.id and f.deleted_at is null and f.status <> 'brouillon')
       and public.devis_perime(d.envoye_at, d.created_at, d.validite_jours)
  loop
    begin
      update public.devis set status = 'expire' where id = r.id;
      v_total := v_total + 1;
    exception when others then
      -- Un atelier en lecture seule (essai terminé) voit ses écritures refusées par
      -- `trg_exiger_abonnement`, qui ne reconnaît pas pg_cron comme une tâche planifiée. On ne
      -- fait pas tomber la tournée entière pour lui : son devis expirera le jour où il
      -- reprendra un abonnement. Voir la réserve consignée dans le rapport de ce chantier.
      --
      -- Mais on ne l'avale pas en silence : un `when others then null` transforme n'importe quel
      -- défaut futur (contrainte, trigger, bug) en cron qui ne fait plus rien sans que personne
      -- ne s'en aperçoive. Le WARNING part dans les journaux Postgres, sans interrompre la
      -- tournée, et donne le devis fautif et la raison exacte.
      raise warning 'expirer_devis : devis % non expiré (%) : %', r.id, sqlstate, sqlerrm;
    end;
  end loop;
  return v_total;
end $function$;

comment on function public.expirer_devis(uuid) is
  'Cron quotidien : passe en « expiré » les devis envoyés dont la validité est dépassée. p_atelier borne le balayage (tests).';

-- Personne ne l'appelle depuis l'application : c'est une tâche planifiée, pas une action
-- d'exploitant. Un exploitant qui veut clore un devis a le bouton « Refusé ».
revoke all on function public.expirer_devis(uuid) from public, anon, authenticated;

-- 6 h 50, soit dix minutes AVANT `relancer-devis-factures` (7 h 00) : sans cet ordre, un devis
-- périmé dans la nuit partirait en relance le matin même avant d'être expiré.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'expirer-devis') then
    perform cron.unschedule('expirer-devis');
  end if;
  perform cron.schedule('expirer-devis', '50 6 * * *', 'select public.expirer_devis()');
end $$;


-- -----------------------------------------------------------------------------
-- 5. La relance ne relance plus un devis périmé
-- -----------------------------------------------------------------------------

-- Le cron d'expiration passe dix minutes plus tôt, donc en marche normale le statut a déjà
-- basculé et la relance ne voit plus le devis. Cette condition est la garantie du jour où le
-- cron n'a pas tourné : relancer un client sur une offre qu'il ne peut plus signer, c'est
-- l'inviter à cliquer sur un refus.
create or replace function public.relancer_devis_et_factures()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_notif uuid;
  v_count int := 0;
begin
  for r in
    select d.*, c.email as client_email, reg.relance_devis_jours, reg.relance_max
      from public.devis d
      join public.clients c on c.id = d.client_id
      join public.ateliers at on at.id = d.atelier_id
      cross join lateral (select * from public.reglages_alertes_de(d.atelier_id)) reg
     where d.status = 'envoye'
       and d.relances_actives and coalesce(c.relances_actives, true)
       and d.relance_count < reg.relance_max
       and not coalesce(at.demo, false)
       and d.deleted_at is null and c.deleted_at is null
       and c.email is not null and c.email <> ''
       and d.envoye_at <= now() - (reg.relance_devis_jours || ' days')::interval
       and (d.derniere_relance_at is null
            or d.derniere_relance_at <= now() - (reg.relance_devis_jours || ' days')::interval)
       -- Ajouté par la migration 45 : on ne relance pas une offre périmée.
       and not public.devis_perime(d.envoye_at, d.created_at, d.validite_jours)
       and public.capacite_ouverte(d.atelier_id, 'relances_auto')
  loop
    insert into public.notifications(atelier_id, destinataire_email, template, payload)
    values (r.atelier_id, r.client_email, 'devis_relance',
            jsonb_build_object('devis_numero', r.numero, 'total_ttc', r.total_ttc, 'public_token', r.public_token))
    returning id into v_notif;
    insert into public.relances(atelier_id, document_type, document_id, canal, template, notification_id)
    values (r.atelier_id, 'devis', r.id, 'email', 'devis_relance', v_notif);
    update public.devis set relance_count = relance_count + 1, derniere_relance_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  for r in
    select f.*, c.email as client_email, reg.relance_facture_jours, reg.relance_max
      from public.factures f
      join public.clients c on c.id = f.client_id
      join public.ateliers at on at.id = f.atelier_id
      cross join lateral (select * from public.reglages_alertes_de(f.atelier_id)) reg
      left join lateral (select coalesce(sum(montant), 0) regle
                           from public.paiements where facture_id = f.id) pa on true
     where f.status = 'emise'
       and f.relances_actives and coalesce(c.relances_actives, true)
       and f.relance_count < reg.relance_max
       and not coalesce(at.demo, false)
       and f.deleted_at is null and c.deleted_at is null
       and f.annulee_at is null and coalesce(f.type, '') <> 'avoir'
       and c.email is not null and c.email <> ''
       and f.due_date is not null and f.due_date < current_date
       and f.total_ttc - pa.regle > 0.01
       and (f.derniere_relance_at is null
            or f.derniere_relance_at <= now() - (reg.relance_facture_jours || ' days')::interval)
       and public.capacite_ouverte(f.atelier_id, 'relances_auto')
  loop
    insert into public.notifications(atelier_id, destinataire_email, template, payload)
    values (r.atelier_id, r.client_email, 'facture_relance',
            jsonb_build_object('facture_numero', r.numero, 'total_ttc', r.total_ttc, 'public_token', r.public_token))
    returning id into v_notif;
    insert into public.relances(atelier_id, document_type, document_id, canal, template, notification_id)
    values (r.atelier_id, 'facture', r.id, 'email', 'facture_relance', v_notif);
    update public.factures set relance_count = relance_count + 1, derniere_relance_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end
$function$;

revoke all on function public.relancer_devis_et_factures() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. La page publique du devis annonce sa date d'échéance
-- -----------------------------------------------------------------------------

-- « Valable jusqu'au 20 septembre » se décide plus vite que « valable 30 jours » : le client n'a
-- pas à compter. `envoye_at` est ajouté pour que la page puisse afficher la vraie date d'émission
-- — jusqu'ici elle affichait `created_at`, c'est-à-dire la date de saisie du brouillon.
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
    'client', jsonb_build_object('nom', c.nom),
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
      'assurance_nom', a.assurance_nom, 'assurance_contrat', a.assurance_contrat, 'assurance_zone', a.assurance_zone
    )
  )
  from public.devis d
  join public.clients c on c.id = d.client_id
  join public.ateliers a on a.id = d.atelier_id
  where d.public_token = p_token and d.deleted_at is null
    -- Un devis en préparation n'a pas été envoyé : il n'a rien à faire sur une page publique.
    and d.status <> 'brouillon'
$function$;

grant execute on function public.devis_public(text) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 7. Le portail client calcule l'échéance comme tout le monde
-- -----------------------------------------------------------------------------

-- `portail_liste` annonçait déjà « valable jusqu'au … », mais calculé sur `created_at` : un
-- devis rouvert puis refinalisé y apparaissait périmé alors qu'il ne l'était pas. On remplace
-- la seule expression concernée, sans recopier les cent quatre-vingts lignes de la fonction —
-- une recopie manuelle est exactement le genre de geste qui introduit une divergence de plus.
-- Si l'expression n'est plus là, la migration s'arrête au lieu de faire semblant.
do $$
declare
  v_def text;
  v_ancien constant text := '(d.created_at + make_interval(days => d.validite_jours))::date';
  v_neuf   constant text := 'public.devis_echeance(d.envoye_at, d.created_at, d.validite_jours)';
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'portail_liste';

  if v_def is null then
    raise exception 'portail_liste introuvable : migration 45 à revoir.';
  end if;
  if position(v_ancien in v_def) = 0 then
    raise exception 'portail_liste : expression d''échéance introuvable, migration 45 à revoir.';
  end if;

  execute replace(v_def, v_ancien, v_neuf);
end $$;

revoke all on function public.portail_liste(text, text, integer, integer) from public;
grant execute on function public.portail_liste(text, text, integer, integer) to anon, authenticated;
