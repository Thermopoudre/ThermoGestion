-- =================================================================================================
-- 49 — Lot A2 : reprendre l'encours client
--
-- POURQUOI. L'atelier pilote arrive avec 23 factures impayées. Aujourd'hui elles ne se reprennent
-- pas : le tableau de bord affiche 0 € de reste dû le premier jour, le moteur de relance est muet,
-- et le patron rouvre son tableur — après quoi le tableur redevient la source de vérité et le
-- logiciel n'est plus qu'un carnet de devis.
--
-- CE QUI REND L'IMPORT DÉLICAT. Une facture émise est figée (`trg_figer_document`) et son
-- `emise_at` est posé par `trg_facture_emise` au passage en « émise ». Passer par le chemin normal
-- — créer un brouillon puis l'émettre — écraserait la date d'origine par `now()` et interdirait
-- ensuite de reposer le vrai numéro. L'import naît donc DIRECTEMENT en `emise`, en une seule
-- insertion : le gel ne joue qu'en `update`, et rien n'est jamais modifié après coup.
--
-- LE VERROU. Même logique qu'en A1 : on reprend AVANT, pas au milieu. Dès qu'une facture a été
-- émise par l'application elle-même, l'import se ferme — sinon une facture antérieure viendrait
-- s'intercaler dans une série déjà ouverte.
-- =================================================================================================

create or replace function public.importer_facture_anterieure(
  p_client_id uuid,
  p_numero text,
  p_emise_le date,
  p_total_ht numeric,
  p_total_tva numeric,
  p_total_ttc numeric,
  p_due_date date default null,
  p_regle numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_atelier uuid := public.current_atelier_id();
  v_numero text := trim(coalesce(p_numero, ''));
  v_ht numeric := round(coalesce(p_total_ht, 0), 2);
  v_tva numeric := round(coalesce(p_total_tva, 0), 2);
  v_ttc numeric := round(coalesce(p_total_ttc, 0), 2);
  v_regle numeric := round(coalesce(p_regle, 0), 2);
  v_echeance date;
  v_delai int;
  v_taux numeric;
  v_items jsonb;
  v_statut text;
  v_id uuid;
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;

  -- Reprendre l'encours, c'est écrire des pièces comptables antérieures à l'installation : cela
  -- relève du responsable, comme la numérotation.
  if not public.is_owner() then
    raise exception 'REPRISE_RESERVEE_PROPRIETAIRE'
      using hint = 'Seul le responsable de l''atelier reprend l''encours : ces lignes entrent directement en factures émises.';
  end if;

  if exists (
    select 1 from public.factures
     where atelier_id = v_atelier
       and origine = 'application'
       and numero is not null
       and status in ('emise', 'payee', 'annulee')
  ) then
    raise exception 'REPRISE_ENCOURS_FERMEE'
      using hint = 'Une facture a déjà été émise depuis Thermogestion : la reprise de l''encours est close. Une facture antérieure ne s''intercale pas dans une série déjà ouverte — saisissez-la comme une facture normale, ou passez par un avoir.';
  end if;

  if v_numero = '' or length(v_numero) > 40 then
    raise exception 'REPRISE_NUMERO_INVALIDE'
      using hint = 'Reportez le numéro exact figurant sur la facture d''origine (40 caractères au plus).';
  end if;

  if not exists (select 1 from public.clients
                  where id = p_client_id and atelier_id = v_atelier and deleted_at is null) then
    raise exception 'REPRISE_CLIENT_INCONNU'
      using hint = 'Ce client n''existe pas dans votre atelier. Importez vos clients avant votre encours.';
  end if;

  if exists (select 1 from public.factures where atelier_id = v_atelier and numero = v_numero) then
    raise exception 'REPRISE_NUMERO_EXISTANT'
      using hint = 'Une facture porte déjà ce numéro dans votre atelier.';
  end if;

  if p_emise_le is null or p_emise_le > current_date then
    raise exception 'REPRISE_DATE_INVALIDE'
      using hint = 'La date d''émission est obligatoire et ne peut pas être dans le futur.';
  end if;

  if v_ht < 0 or v_tva < 0 or v_ttc <= 0 then
    raise exception 'REPRISE_MONTANTS_INVALIDES'
      using hint = 'Les montants HT et TVA sont positifs, et le TTC est strictement supérieur à zéro.';
  end if;

  -- Deux centimes de tolérance : l'ancien logiciel a pu arrondir ligne à ligne là où celui-ci
  -- arrondit au total. Au-delà, ce n'est plus un arrondi, c'est une colonne mal rapprochée — et
  -- une facture dont HT + TVA ≠ TTC est un rejet comptable garanti.
  if abs(v_ht + v_tva - v_ttc) > 0.02 then
    raise exception 'REPRISE_TOTAUX_INCOHERENTS'
      using hint = 'HT + TVA doit égaler le TTC. Vérifiez la correspondance des colonnes de votre fichier.';
  end if;

  if v_regle < 0 or v_regle > v_ttc + 0.005 then
    raise exception 'REPRISE_REGLEMENT_INVALIDE'
      using hint = 'Le montant déjà réglé est compris entre zéro et le total TTC de la facture.';
  end if;

  select coalesce(c.delai_paiement_jours, a.delai_paiement_jours, 30) into v_delai
    from public.clients c
    join public.ateliers a on a.id = c.atelier_id
   where c.id = p_client_id;
  v_echeance := coalesce(p_due_date, p_emise_le + v_delai);
  if v_echeance < p_emise_le then
    raise exception 'REPRISE_ECHEANCE_ANTERIEURE'
      using hint = 'L''échéance ne peut pas précéder la date d''émission.';
  end if;

  -- Une ligne de synthèse, et une seule. On ne connaît pas le détail des prestations de l'ancien
  -- logiciel, et l'inventer serait pire que de ne rien dire : cette ligne porte le taux de TVA
  -- effectif pour que la ventilation par taux de l'export comptable retombe juste, et elle se
  -- nomme pour ce qu'elle est.
  v_taux := case when v_ht > 0 then round(v_tva / v_ht * 100, 2) else 0 end;
  v_items := jsonb_build_array(jsonb_build_object(
    'type', 'libre',
    'libelle', 'Facture ' || v_numero || ' — reprise de votre ancien logiciel',
    'qte', 1,
    'unite', 'forfait',
    'pu_ht', v_ht,
    'tva', v_taux,
    'total_ht', v_ht,
    'meta', jsonb_build_object('reprise', true)));

  v_statut := case when v_regle >= v_ttc - 0.005 then 'payee' else 'emise' end;

  insert into public.factures(
    atelier_id, client_id, numero, type, status, items,
    total_ht, total_tva, total_ttc, due_date, emise_at, origine, created_by)
  values (
    v_atelier, p_client_id, v_numero, 'libre', v_statut, v_items,
    v_ht, v_tva, v_ttc, v_echeance, p_emise_le::timestamptz, 'reprise', auth.uid())
  returning id into v_id;

  -- Le règlement partiel déjà encaissé. La date exacte est inconnue — l'ancien logiciel ne la
  -- donne pas dans un export de balance — on la pose à la date de la facture et la note le dit,
  -- plutôt que d'inventer une date d'encaissement qui fausserait le « encaissé du mois ».
  if v_regle > 0 then
    insert into public.paiements(atelier_id, facture_id, montant, moyen, paye_at, note)
    values (v_atelier, v_id, v_regle, 'virement', p_emise_le::timestamptz,
            'Acompte repris de votre ancien logiciel — date d''encaissement inconnue.');
  end if;

  return v_id;
end $function$;

comment on function public.importer_facture_anterieure(uuid, text, date, numeric, numeric, numeric, date, numeric) is
  'Reprise d''une facture antérieure à l''installation : elle naît directement émise, avec son '
  'numéro et sa date d''origine, marquée origine = reprise. Réservée au responsable et fermée dès '
  'qu''une facture a été émise depuis l''application.';

revoke all on function public.importer_facture_anterieure(uuid, text, date, numeric, numeric, numeric, date, numeric) from public, anon;
grant execute on function public.importer_facture_anterieure(uuid, text, date, numeric, numeric, numeric, date, numeric) to authenticated;

-- -------------------------------------------------------------------------------------------------
-- Le journal des ventes ignore les reprises
-- -------------------------------------------------------------------------------------------------
-- POURQUOI. Une facture reprise a DÉJÀ été comptabilisée par l'ancien logiciel : son chiffre
-- d'affaires est déclaré, sa TVA est collectée, elle figure dans le FEC de l'exercice produit par
-- l'outil précédent. La rejouer ici doublerait le produit au crédit du 706 et la TVA au 445710 —
-- exactement l'anomalie que la reprise est censée éviter. Elle entre en comptabilité comme un
-- à-nouveau de balance client, pas comme une vente de la période.
--
-- Elle reste en revanche pleinement visible partout ailleurs : reste dû, relances, récapitulatif
-- du matin, fiche client. C'est de l'argent qu'on nous doit ; ce n'est pas une vente d'aujourd'hui.
create or replace function public.journal_ventes(p_debut date, p_fin date)
returns table(id uuid, numero text, type text, status text, emise_at timestamp with time zone,
              due_date date, total_ht numeric, total_tva numeric, total_ttc numeric,
              nature_operation text, items jsonb, client jsonb, paiements jsonb, regle_ttc numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select f.id, f.numero, f.type, f.status,
         f.emise_at, f.due_date,
         f.total_ht, f.total_tva, f.total_ttc,
         f.nature_operation, coalesce(f.items, '[]'::jsonb),
         jsonb_build_object(
           'id', c.id, 'nom', c.nom, 'siren', c.siren, 'siret', c.siret,
           'tva_intra', c.tva_intra, 'adresse', c.adresse,
           'code_postal', c.code_postal, 'ville', c.ville, 'pays', c.pays,
           'email', c.email),
         coalesce((select jsonb_agg(jsonb_build_object(
                            'montant', p.montant, 'moyen', p.moyen, 'paye_at', p.paye_at)
                          order by p.paye_at)
                     from public.paiements p where p.facture_id = f.id), '[]'::jsonb),
         coalesce((select sum(p.montant) from public.paiements p where p.facture_id = f.id), 0)
    from public.factures f
    left join public.clients c on c.id = f.client_id
   where f.atelier_id = public.atelier_du_membre()
     and (public.acces_commercial() or public.est_comptable())
     -- La période porte sur la date d'émission : c'est la date à laquelle la pièce entre en
     -- comptabilité. Le brouillon n'existe pas comptablement et fausserait la TVA du mois.
     and f.deleted_at is null
     and f.status in ('emise', 'payee')
     -- Migration 49 : les factures reprises de l'ancien logiciel sont déjà comptabilisées.
     and f.origine <> 'reprise'
     and f.emise_at >= p_debut::timestamptz
     and f.emise_at < ((p_fin + 1)::date)::timestamptz
   order by f.emise_at, f.numero;
$function$;

comment on function public.journal_ventes(date, date) is
  'Écritures de vente de la période, pour l''export comptable et l''espace du cabinet. Exclut les '
  'brouillons, la corbeille et les factures reprises (origine = reprise), déjà comptabilisées par '
  'l''outil précédent de l''atelier.';

revoke all on function public.journal_ventes(date, date) from public, anon;
grant execute on function public.journal_ventes(date, date) to authenticated;
