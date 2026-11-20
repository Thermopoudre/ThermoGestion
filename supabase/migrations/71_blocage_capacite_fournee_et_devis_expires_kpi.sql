-- =============================================================================
-- 71 — Deux corrections de AMELIORATIONS-07-09-2026.md
-- =============================================================================
--
-- N°2 : bloquer une fournée au-delà de la capacité du four. Aujourd'hui, `/fournees/<id>`
-- affiche une barre rouge « 42,5 m² / 30,0 m² · 142 % » à côté d'un bouton « Lancer la fournée »
-- parfaitement actif : le contrôle n'existe qu'en React (confirmSurcharge dans la page), donc se
-- contourne depuis la console. C'est le seul constat du corpus qui touche à la sécurité physique
-- de l'atelier (four abîmé, pièces à refaire, journée perdue).
--
-- La capacité vient de la fiche atelier (`ateliers.four_capacite_m2`, Réglages → Atelier) : ce
-- produit ne modélise qu'un seul four par atelier, pas une fiche four séparée. Si elle n'est pas
-- renseignée, rien n'est bloqué — on ne peut pas comparer à une valeur qu'on n'a pas — mais
-- l'écran doit le dire (fait côté React dans ce même chantier).
--
-- Le blocage vit dans un TRIGGER, pas dans une RPC dédiée : la page ne passait déjà par aucune
-- RPC pour lancer une fournée (`supabase.from("fournees").update(...)` en direct), et une RPC
-- posée à côté n'aurait rien fermé — un utilisateur de la console aurait continué à appeler
-- `.update()` directement. Le trigger, lui, s'applique quel que soit le chemin d'écriture.
--
-- Dérogation explicite et tracée : une fournée peut être lancée au-delà de la capacité déclarée
-- si l'atelier coche la case (un four réel peut être plus grand que sa fiche ne le dit). La trace
-- — qui a dérogé, quand, de combien — est posée par la base elle-même (`auth.uid()`, `now()`, le
-- calcul de l'écart), jamais recopiée depuis ce que le client prétend : ailleurs qu'au moment du
-- lancement, ces colonnes ne se réécrivent pas (restaurées à leur valeur précédente). `trg_journal`
-- n'est pas branché sur `fournees` (aucune fiche « Historique » n'existe sur cet écran) : quatre
-- colonnes dédiées suffisent et restent lisibles directement sur la fournée, sans construire un
-- journal que rien n'affiche.
--
-- Une fournée déjà lancée n'est jamais bloquée a posteriori : le trigger ne regarde que la
-- transition planifiée → en_cours. F-2026-0045 (142 %, déjà en base avant ce correctif) reste
-- consultable et clôturable — la clôture et l'annulation ne repassent jamais par cette branche.
--
-- N°3 : le chiffre « devis en attente de signature » du tableau de bord (et le KPI équivalent du
-- courriel du matin, `recap_quotidien_payload`) compte un devis resté au statut « envoyé » alors
-- que sa durée de validité est dépassée — cas réel constaté en base sur DV-2026-0016 (expiré
-- depuis le 24/08, encore « envoyé » aujourd'hui) : le cron `expirer_devis` tourne une fois par
-- jour et saute silencieusement un atelier en lecture seule (cf. migration 45 §4, commentaire de
-- `expirer_devis`). Le tableau de bord ne doit pas répéter cette même approximation : la validité
-- se vérifie avec `devis_perime()` (migration 45), pas avec le seul statut. Le corps de
-- `recap_quotidien_payload` est entièrement recopié ci-dessous (CREATE OR REPLACE d'une fonction
-- existante, même signature) : seule la sous-requête `v_devis_att` gagne une condition.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Fournées : colonnes de dérogation
-- -----------------------------------------------------------------------------

alter table public.fournees
  add column if not exists derogation_capacite boolean not null default false,
  add column if not exists derogation_par uuid references public.users(id) on delete set null,
  add column if not exists derogation_le timestamptz,
  add column if not exists derogation_ecart_m2 numeric;

comment on column public.fournees.derogation_capacite is
  'Vrai si cette fournée a été lancée au-delà de la capacité déclarée du four, après dérogation explicite cochée à l''écran. Posée par trg_fournee_capacite : ne se règle jamais directement.';
comment on column public.fournees.derogation_par is
  'Qui a déclenché la dérogation — auth.uid() au moment du lancement, posé par la base, jamais recopié depuis la requête du client.';
comment on column public.fournees.derogation_le is
  'Quand la dérogation a été posée.';
comment on column public.fournees.derogation_ecart_m2 is
  'De combien la fournée dépassait la capacité déclarée au moment du lancement, en m² (surface embarquée − four_capacite_m2).';


-- -----------------------------------------------------------------------------
-- 2. Le blocage, en base, quelle que soit la façon d'écrire `fournees.statut`
-- -----------------------------------------------------------------------------

create or replace function public.trg_fournee_capacite()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_capacite numeric;
  v_surface  numeric;
  v_lance    boolean;
begin
  -- Seule la transition VERS « en_cours » est concernée : la composition, la clôture et
  -- l'annulation ne touchent jamais ce contrôle. `old` n'existe pas à l'insertion — on ne le lit
  -- donc que dans la branche UPDATE.
  if tg_op = 'INSERT' then
    v_lance := new.statut = 'en_cours';
  else
    v_lance := new.statut = 'en_cours' and old.statut is distinct from 'en_cours';
  end if;

  if not v_lance then
    -- En dehors du lancement, la dérogation ne se réécrit pas : elle est posée une seule fois,
    -- par cette fonction, au moment où le dépassement est réellement constaté. Une clôture, une
    -- annulation ou une simple note ne doivent jamais pouvoir la falsifier après coup — même
    -- principe que `trg_controle_fige` sur un registre d'audit.
    if tg_op = 'UPDATE' then
      new.derogation_capacite := old.derogation_capacite;
      new.derogation_par := old.derogation_par;
      new.derogation_le := old.derogation_le;
      new.derogation_ecart_m2 := old.derogation_ecart_m2;
    else
      new.derogation_capacite := false;
      new.derogation_par := null;
      new.derogation_le := null;
      new.derogation_ecart_m2 := null;
    end if;
    return new;
  end if;

  -- La capacité vient de la fiche atelier (Réglages → Atelier, four_capacite_m2) : ce produit ne
  -- modélise qu'un seul four par atelier, pas une fiche four séparée.
  select four_capacite_m2 into v_capacite from public.ateliers where id = new.atelier_id;

  if v_capacite is null then
    -- Rien à comparer : on ne bloque jamais un dépassement qu'on ne sait pas mesurer. C'est à
    -- l'écran de le dire (capacité non renseignée), pas à ce contrôle de l'inventer.
    new.derogation_capacite := false;
    new.derogation_par := null;
    new.derogation_le := null;
    new.derogation_ecart_m2 := null;
    return new;
  end if;

  select coalesce(sum(surface_m2), 0) into v_surface
    from public.fournee_projets where fournee_id = new.id;

  if v_surface > v_capacite then
    if not coalesce(new.derogation_capacite, false) then
      raise exception 'FOURNEE_CAPACITE_DEPASSEE'
        using detail = v_surface::text || '/' || v_capacite::text,
              hint = 'Cochez la dérogation pour lancer quand même, ou corrigez la capacité du four dans Réglages → Atelier si le dépassement est systématique.';
    end if;
    -- La dérogation est tracée par la base : qui (auth.uid(), jamais ce que le client prétend) et
    -- de combien (calculé ici, jamais recopié depuis l'écran).
    new.derogation_par := auth.uid();
    new.derogation_le := now();
    new.derogation_ecart_m2 := round(v_surface - v_capacite, 2);
  else
    -- Dans la capacité : une case restée cochée d'un essai précédent n'est pas une dérogation
    -- réelle, on ne trace rien.
    new.derogation_capacite := false;
    new.derogation_par := null;
    new.derogation_le := null;
    new.derogation_ecart_m2 := null;
  end if;
  return new;
end;
$function$;

-- Fonction de trigger : `revoke from public` ne suffit pas sur Supabase, `anon` et `authenticated`
-- reçoivent un `grant execute` implicite à la création (piège documenté migrations 26/38/65).
revoke all on function public.trg_fournee_capacite() from public, anon, authenticated;

drop trigger if exists fournee_capacite on public.fournees;
create trigger fournee_capacite
  before insert or update on public.fournees
  for each row execute function public.trg_fournee_capacite();


-- -----------------------------------------------------------------------------
-- 3. Le KPI « devis en attente », aligné sur devis_perime() (migration 45)
-- -----------------------------------------------------------------------------
-- Même signature qu'avant (p_atelier uuid, p_commercial boolean, p_inclure_pesee boolean default
-- false) : un CREATE OR REPLACE à signature différente créerait une surcharge au lieu de
-- remplacer (piège déjà rencontré sur ce projet). Le corps est recopié à l'identique, à une
-- exception près, repérable au commentaire « migration 71 » sur la ligne ajoutée.
create or replace function public.recap_quotidien_payload(p_atelier uuid, p_commercial boolean, p_inclure_pesee boolean default false)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_reg public.reglages_alertes;
  v_nom text;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_hier date := ((now() at time zone 'Europe/Paris')::date) - 1;
  v_qualite boolean;
  v_a_sortir jsonb; v_n_a_sortir int;
  v_retard jsonb;   v_n_retard int;
  v_devis_h jsonb;  v_bl_h jsonb; v_regl jsonb; v_regl_total numeric;
  v_poudres jsonb;  v_lots jsonb; v_instr jsonb; v_pesees jsonb;
  v_devis_att jsonb; v_n_devis_att int; v_tot_devis_att numeric; v_vieux_devis int;
  v_fact jsonb; v_n_fact int; v_tot_fact numeric;
  v_action jsonb;
  v_vide boolean;
  -- Nombre de lignes détaillées par rubrique. Au-delà, le courriel annonce le nombre et l'écran
  -- prend le relais : un e-mail de trois pages n'est pas lu.
  c_max constant int := 10;
  -- Amélioration n°7 (migration 68) : voir le commentaire d'en-tête de cette migration pour la
  -- justification du nombre.
  c_jours_sans_pesee constant int := 35;
begin
  v_reg := public.reglages_alertes_de(p_atelier);
  select nom into v_nom from public.ateliers where id = p_atelier;
  v_qualite := public.capacite_ouverte(p_atelier, 'qualite');

  -- 1. Ce qui doit sortir aujourd'hui, et ce qui est déjà en retard sur la date promise.
  --    Hors corbeille : relancer sur un projet jeté n'a aucun sens.
  select coalesce(jsonb_agg(x order by rn) filter (where rn <= c_max), '[]'::jsonb), count(*)
    into v_a_sortir, v_n_a_sortir
    from (
      select jsonb_build_object('id', p.id, 'numero', p.numero, 'nom', p.nom, 'statut', p.status,
                                'client', c.nom, 'etape', p.etape_courante) x,
             row_number() over (order by p.numero) rn
        from public.projets p left join public.clients c on c.id = p.client_id
       where p.atelier_id = p_atelier and p.deleted_at is null
         and p.status not in ('livre', 'annule')
         and p.date_promise = v_jour
    ) s;

  select coalesce(jsonb_agg(x order by rn) filter (where rn <= c_max), '[]'::jsonb), count(*)
    into v_retard, v_n_retard
    from (
      select jsonb_build_object('id', p.id, 'numero', p.numero, 'nom', p.nom, 'statut', p.status,
                                'client', c.nom, 'date_promise', p.date_promise,
                                'jours', v_jour - p.date_promise) x,
             row_number() over (order by p.date_promise) rn
        from public.projets p left join public.clients c on c.id = p.client_id
       where p.atelier_id = p_atelier and p.deleted_at is null
         and p.status not in ('livre', 'annule')
         and p.date_promise is not null and p.date_promise < v_jour
    ) s;

  -- 2. Hier. Le bon de livraison signé relève de la production : il reste visible par tout le
  --    monde. Le devis signé et le règlement encaissé sont de l'argent.
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'numero', b.numero, 'client', c.nom)), '[]'::jsonb)
    into v_bl_h
    from public.bons_livraison b left join public.clients c on c.id = b.client_id
   where b.atelier_id = p_atelier and b.deleted_at is null
     and b.signed_at is not null and (b.signed_at at time zone 'Europe/Paris')::date = v_hier;

  if p_commercial then
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'numero', d.numero, 'client', c.nom,
                                                 'total_ttc', d.total_ttc, 'signe_par', d.signed_by)), '[]'::jsonb)
      into v_devis_h
      from public.devis d left join public.clients c on c.id = d.client_id
     where d.atelier_id = p_atelier and d.deleted_at is null
       and d.signed_at is not null and (d.signed_at at time zone 'Europe/Paris')::date = v_hier;

    select coalesce(jsonb_agg(jsonb_build_object('facture', f.numero, 'client', c.nom,
                                                 'montant', pa.montant, 'moyen', pa.moyen)), '[]'::jsonb),
           coalesce(sum(pa.montant), 0)
      into v_regl, v_regl_total
      from public.paiements pa
      join public.factures f on f.id = pa.facture_id
      left join public.clients c on c.id = f.client_id
     where pa.atelier_id = p_atelier and f.deleted_at is null
       and (pa.paye_at at time zone 'Europe/Paris')::date = v_hier;
  else
    v_devis_h := '[]'::jsonb; v_regl := '[]'::jsonb; v_regl_total := 0;
  end if;

  -- 3. Ce qui va coincer. Le seuil de DLU vient des réglages de l'atelier : c'est ici qu'il cesse
  --    d'être une constante purement visuelle qu'il fallait aller chercher sur l'écran Stock.
  --    `nullif(trim(...))` : la colonne `ral` porte des chaînes vides, pas des `null`.
  select coalesce(jsonb_agg(jsonb_build_object(
           'libelle', trim(coalesce(p.marque, '') || ' ' || coalesce(p.reference, '')) ||
                      case when nullif(trim(coalesce(p.ral, '')), '') is not null
                           then ' (RAL ' || trim(p.ral) || ')' else '' end,
           'id', p.id, 'stock_kg', p.stock_kg, 'seuil_kg', p.seuil_alerte_kg)), '[]'::jsonb)
    into v_poudres
    from public.poudres p
   where p.atelier_id = p_atelier and coalesce(p.actif, true)
     and p.seuil_alerte_kg is not null and p.seuil_alerte_kg > 0
     and coalesce(p.stock_kg, 0) <= p.seuil_alerte_kg;

  select coalesce(jsonb_agg(x order by rn) filter (where rn <= c_max), '[]'::jsonb)
    into v_lots
    from (
      select jsonb_build_object('id', l.id, 'numero', l.numero,
                                'libelle', trim(coalesce(p.marque, '') || ' ' || coalesce(p.reference, '')),
                                'dlu', l.dlu, 'jours', l.dlu - v_jour, 'restant_kg', l.restant_kg) x,
             row_number() over (order by l.dlu) rn
        from public.poudre_lots l left join public.poudres p on p.id = l.poudre_id
       where l.atelier_id = p_atelier
         and l.dlu is not null and coalesce(l.restant_kg, 0) > 0.001
         and l.dlu <= v_jour + v_reg.seuil_dlu_jours
    ) s;

  -- L'étalonnage n'existe que pour un atelier qui a la fonction qualité : l'annoncer à un atelier
  -- qui n'y a pas droit serait lui vendre l'écran par e-mail.
  if v_qualite then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', i.id, 'nom', i.nom, 'type', i.type,
             'dernier', i.dernier_etalonnage,
             'du_le', i.dernier_etalonnage + (i.periodicite_mois || ' months')::interval,
             'jamais', i.dernier_etalonnage is null)), '[]'::jsonb)
      into v_instr
      from public.instruments i
     where i.atelier_id = p_atelier and coalesce(i.actif, true)
       and (i.dernier_etalonnage is null
            or (i.periodicite_mois is not null
                and i.dernier_etalonnage + (i.periodicite_mois || ' months')::interval < v_jour));
  else
    v_instr := '[]'::jsonb;
  end if;

  -- Amélioration n°7 (migration 68) : rappel mensuel de pesée de rendement, calculé seulement le
  -- jour où `envoyer_recap_quotidien()` décide qu'il est temps de revérifier (voir le commentaire
  -- d'en-tête de la migration). `mon_recap_quotidien()` (aperçu réglages) l'appelle toujours à
  -- vrai : l'atelier doit pouvoir voir sur son écran de réglages ce que la section afficherait,
  -- sans attendre le prochain jour de vérification.
  if p_inclure_pesee then
    v_pesees := public.poudre_pesee_a_rappeler(p_atelier, c_jours_sans_pesee);
  else
    v_pesees := '[]'::jsonb;
  end if;

  -- 4. L'argent. Réservé aux rôles qui y ont droit.
  if p_commercial then
    select coalesce(jsonb_agg(x order by rn) filter (where rn <= c_max), '[]'::jsonb),
           count(*), coalesce(sum((x->>'total_ttc')::numeric), 0), coalesce(max((x->>'jours')::int), 0)
      into v_devis_att, v_n_devis_att, v_tot_devis_att, v_vieux_devis
      from (
        select jsonb_build_object('id', d.id, 'numero', d.numero, 'client', c.nom,
                                  'total_ttc', d.total_ttc,
                                  'jours', v_jour - (d.envoye_at at time zone 'Europe/Paris')::date,
                                  'relance_count', d.relance_count,
                                  'relances_actives', d.relances_actives and coalesce(c.relances_actives, true)) x,
               row_number() over (order by d.envoye_at) rn
          from public.devis d left join public.clients c on c.id = d.client_id
         where d.atelier_id = p_atelier and d.deleted_at is null and c.deleted_at is null
           and d.status = 'envoye' and d.envoye_at is not null
           and d.envoye_at <= now() - (v_reg.devis_sans_reponse_jours || ' days')::interval
           -- Migration 71 (amélioration n°3) : un devis resté « envoyé » alors que sa validité
           -- est dépassée (cron `expirer_devis` pas encore passé, ou sauté pour un atelier en
           -- lecture seule, cf. migration 45 §4) n'est plus un devis qu'on relance par un simple
           -- e-mail — il ne peut plus être signé. Même condition que `relancer_devis_et_factures`.
           and not public.devis_perime(d.envoye_at, d.created_at, d.validite_jours)
      ) s;

    -- Le reste dû, pas le total de la facture : une facture réglée à moitié n'est pas un impayé de
    -- son montant entier, et annoncer le contraire au patron est le meilleur moyen qu'il cesse de
    -- croire le chiffre.
    select coalesce(jsonb_agg(x order by rn) filter (where rn <= c_max), '[]'::jsonb),
           count(*), coalesce(sum((x->>'reste')::numeric), 0)
      into v_fact, v_n_fact, v_tot_fact
      from (
        select jsonb_build_object('id', f.id, 'numero', f.numero, 'client', c.nom,
                                  'due_date', f.due_date, 'jours', v_jour - f.due_date,
                                  'reste', round(f.total_ttc - coalesce(pa.regle, 0), 2),
                                  'relance_count', f.relance_count,
                                  'relances_actives', f.relances_actives and coalesce(c.relances_actives, true)) x,
               row_number() over (order by f.due_date) rn
          from public.factures f
          left join public.clients c on c.id = f.client_id
          left join lateral (select sum(montant) regle from public.paiements where facture_id = f.id) pa on true
         where f.atelier_id = p_atelier and f.deleted_at is null and c.deleted_at is null
           and f.status = 'emise' and f.due_date is not null and f.due_date < v_jour
           and f.total_ttc - coalesce(pa.regle, 0) > 0.01
      ) s;
  else
    v_devis_att := '[]'::jsonb; v_n_devis_att := 0; v_tot_devis_att := 0; v_vieux_devis := 0;
    v_fact := '[]'::jsonb; v_n_fact := 0; v_tot_fact := 0;
  end if;

  -- 5. Une seule action mise en avant. L'ordre n'est pas esthétique, il est économique : une
  --    promesse tenue avant un euro encaissé, un euro encaissé avant un euro espéré, et la
  --    production avant l'intendance. Pour un rôle d'atelier, aucune branche d'argent ne s'ouvre.
  --    La pesée de rendement passe en dernier : elle ne coûte jamais une promesse ni un euro dans
  --    l'immédiat, seulement la qualité d'un chiffre pour le prochain devis.
  v_action := case
    when v_n_retard > 0 then jsonb_build_object(
      'titre', 'Prévenir ' || v_n_retard || ' client' || case when v_n_retard > 1 then 's' else '' end ||
               ' dont la date promise est passée',
      'detail', 'Un client prévenu attend. Un client non prévenu appelle.',
      'url', '/projets')
    when p_commercial and v_n_fact > 0 then jsonb_build_object(
      'titre', 'Relancer ' || v_n_fact || ' facture' || case when v_n_fact > 1 then 's' else '' end ||
               ' échue' || case when v_n_fact > 1 then 's' else '' end ||
               ' — ' || public.montant_fr(v_tot_fact) || ' €',
      'detail', 'C''est de l''argent déjà gagné qui dort.',
      'url', '/factures')
    when p_commercial and v_n_devis_att > 0 then jsonb_build_object(
      'titre', 'Relancer ' || v_n_devis_att || ' devis sans réponse — ' || public.montant_fr(v_tot_devis_att) || ' €',
      'detail', 'Le plus ancien attend depuis ' || v_vieux_devis || ' jours.',
      'url', '/devis')
    when v_n_a_sortir > 0 then jsonb_build_object(
      'titre', v_n_a_sortir || ' chantier' || case when v_n_a_sortir > 1 then 's' else '' end ||
               ' à sortir aujourd''hui',
      'detail', 'Vérifiez qu''ils sont bien en fin de parcours.',
      'url', '/projets')
    when jsonb_array_length(v_lots) > 0 then jsonb_build_object(
      'titre', 'Écouler ' || jsonb_array_length(v_lots) || ' lot' ||
               case when jsonb_array_length(v_lots) > 1 then 's' else '' end || ' de poudre avant sa DLU',
      'detail', 'Passé la date, le lot est une perte sèche.',
      'url', '/lots')
    when jsonb_array_length(v_poudres) > 0 then jsonb_build_object(
      'titre', 'Commander la poudre passée sous son seuil',
      'detail', 'Une teinte manquante arrête une chaîne entière.',
      'url', '/stock')
    when jsonb_array_length(v_instr) > 0 then jsonb_build_object(
      'titre', 'Faire étalonner ' || jsonb_array_length(v_instr) || ' instrument' ||
               case when jsonb_array_length(v_instr) > 1 then 's' else '' end,
      'detail', 'Un contrôle fait avec un instrument périmé ne prouve rien.',
      'url', '/qualite/instruments')
    when jsonb_array_length(v_pesees) > 0 then jsonb_build_object(
      'titre', 'Peser le rendement de ' || jsonb_array_length(v_pesees) || ' teinte' ||
               case when jsonb_array_length(v_pesees) > 1 then 's' else '' end,
      'detail', 'Le rendement réel par teinte est votre meilleur argument face aux catalogues de prix génériques.',
      'url', '/pilotage')
    else null end;

  -- Rien à dire : on le déclare, et l'appelant s'abstient.
  v_vide := v_n_a_sortir = 0 and v_n_retard = 0
        and jsonb_array_length(v_bl_h) = 0 and jsonb_array_length(v_devis_h) = 0
        and jsonb_array_length(v_regl) = 0
        and jsonb_array_length(v_poudres) = 0 and jsonb_array_length(v_lots) = 0
        and jsonb_array_length(v_instr) = 0 and jsonb_array_length(v_pesees) = 0
        and v_n_devis_att = 0 and v_n_fact = 0;

  return jsonb_build_object(
    'vide', v_vide,
    'commercial', p_commercial,
    'atelier_nom', v_nom,
    'jour', v_jour,
    'production', jsonb_build_object(
      'a_sortir', v_a_sortir, 'a_sortir_total', v_n_a_sortir,
      'en_retard', v_retard, 'en_retard_total', v_n_retard),
    'hier', jsonb_build_object(
      'devis_signes', v_devis_h, 'bl_signes', v_bl_h,
      'reglements', v_regl, 'reglements_total', v_regl_total),
    'risques', jsonb_build_object(
      'poudres', v_poudres, 'lots', v_lots, 'instruments', v_instr, 'pesees', v_pesees,
      'seuil_dlu_jours', v_reg.seuil_dlu_jours),
    'argent', jsonb_build_object(
      'devis', jsonb_build_object('nb', v_n_devis_att, 'total', v_tot_devis_att,
                                  'plus_ancien_jours', v_vieux_devis, 'liste', v_devis_att,
                                  'seuil_jours', v_reg.devis_sans_reponse_jours),
      'factures', jsonb_build_object('nb', v_n_fact, 'total', v_tot_fact, 'liste', v_fact)),
    'action', v_action
  );
end
$function$;

comment on function public.recap_quotidien_payload(uuid, boolean, boolean) is
  'Contenu du courriel du matin et de son aperçu réglages. Migration 71 : la rubrique "devis en attente" exclut désormais les devis périmés (devis_perime()), au même titre que relancer_devis_et_factures().';
