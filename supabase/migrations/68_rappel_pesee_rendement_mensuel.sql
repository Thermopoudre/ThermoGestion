-- Amélioration n°7 du 07/09/2026 (AMELIORATIONS-07-09-2026.md) : rappeler la pesée mensuelle de
-- rendement poudre. `/pilotage` > Rendement teintes affiche « Pesée nécessaire → » pour une teinte
-- jamais pesée, mais rien ne relance ce geste — il repose sur la mémoire du chef d'atelier, alors
-- que le rendement réel par teinte est l'argument que Thermogestion oppose aux bibliothèques de
-- prix génériques (concurrent COOCKPIT notamment).
--
-- CHOIX STRUCTURANT : une SECTION du récapitulatif quotidien existant, pas un second courriel.
-- Alexis est explicite sur la règle « un seul mail par jour » (feedback_one_daily_mail), et
-- `envoyer_recap_quotidien()` porte déjà tout le mécanisme qu'il faut : un seul message par
-- destinataire et par jour (vérifié par une lecture dans `notifications`), rien les jours où il
-- n'y a rien à dire, un jeton de désabonnement par destinataire, une désactivation par atelier
-- dans `reglages_alertes`. Créer un second gabarit et un second cron aurait dupliqué cette
-- discipline pour un seul rappel qui, de toute façon, doit rester subordonné à la même règle du
-- jour : si demain il y a une teinte à peser ET une facture en retard, ça doit rester UN message,
-- pas deux qui se chevauchent le même matin.
--
-- CADENCE MENSUELLE SANS DÉPENDRE D'UN JOUR DU MOIS : `envoyer_recap_quotidien()` peut sauter des
-- jours entiers pour un atelier (jours ouvrés seulement, abonnement fermé, aucun destinataire
-- actif...). Un déclenchement sur « le 1er du mois » manquerait purement et simplement le rappel
-- les mois où ce jour-là ne produit aucun envoi. À la place : `reglages_alertes.rappel_pesee_dernier_envoi`
-- retient la dernière date où la section a été **effectivement montrée** (donc non vide) ; la
-- section n'est recalculée que si cette date est nulle ou vieille de 28 jours ou plus. 28 et non
-- 30/31 : c'est le plus grand nombre de jours qui garantit qu'aucun mois civil ne s'écoule sans
-- qu'au moins une occasion de vérifier se présente, même si le mois compte 31 jours et que le
-- calcul tombe un jour sans envoi. Si rien n'est à signaler le jour où le délai est écoulé, la
-- date n'avance pas : on revérifie le lendemain (requête bon marché sur des tables déjà indexées)
-- plutôt que de risquer de sauter un mois entier faute d'avoir eu quelque chose à dire pile ce
-- jour-là.
--
-- SEUIL DE 35 JOURS SANS PESÉE : la cadence de vérification est d'environ un mois (voir ci-dessus).
-- Un seuil de 30 jours pile ferait réapparaître une teinte pesée le 1er du mois dès le contrôle du
-- mois suivant, même si l'atelier a été rigoureux. 35 jours (un mois plus une semaine de marge)
-- absorbe ce décalage sans faire attendre l'atelier plus d'une semaine au-delà du mois plein.
--
-- COUPURE : un atelier coupe ce rappel via `reglages_alertes.rappel_pesee_actif`, comme il coupe
-- `recap_actif` — même écran, même mécanique. Couper le récapitulatif entier (bouton existant) ou
-- se désabonner soi-même (`recap_destinataires`, lien de désinscription du pied de message)
-- coupent aussi le rappel, puisque c'est une section du même message : rien de neuf à câbler
-- là-dessus. L'atelier de démonstration n'a jamais reçu le récapitulatif quotidien — la boucle de
-- `envoyer_recap_quotidien()` exclut déjà `not coalesce(at.demo, false)` avant tout calcul — donc
-- il ne recevra jamais non plus cette section, sans rien à faire de plus ici.

-- ── 1. Réglage : actif par défaut, et la date du dernier rappel effectivement montré ───────────
alter table public.reglages_alertes
  add column if not exists rappel_pesee_actif boolean not null default true,
  add column if not exists rappel_pesee_dernier_envoi date;

comment on column public.reglages_alertes.rappel_pesee_actif is
  'Rappel mensuel de pesée de rendement poudre (migration 68) : section du récapitulatif quotidien, coupable indépendamment de recap_actif.';
comment on column public.reglages_alertes.rappel_pesee_dernier_envoi is
  'Dernier jour (heure Europe/Paris) où le rappel de pesée a été effectivement inclus dans un récapitulatif envoyé — pas la dernière fois où on a vérifié. NULL = jamais montré.';

-- ── 2. Les teintes à rappeler : jamais pesées, ou pesée trop ancienne ──────────────────────────
--
-- `security definer` + `search_path` figé, comme `recap_quotidien_payload` et
-- `reglages_alertes_de` : elle lit `stock_mouvements` et `projets` à travers les ateliers, ce que
-- l'appelant (le cron, en `service_role`) n'a pas forcément le droit de lire ligne à ligne selon
-- son propre rôle. `revoke ... from public` nommément : sans ça, PostgreSQL l'ouvrirait par
-- défaut à PUBLIC (donc à `anon` et `authenticated`) dès sa création — c'est exactement le piège
-- que `tests/securite-privileges.test.ts` (migration 65) surveille sur tout le schéma.
create or replace function public.poudre_pesee_a_rappeler(p_atelier uuid, p_jours_sans_pesee integer default 35)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_out jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'poudre_id', po.id,
           'libelle', trim(coalesce(po.marque, '') || ' ' || coalesce(po.reference, '')) ||
                      case when nullif(trim(coalesce(po.ral, '')), '') is not null
                           then ' (RAL ' || trim(po.ral) || ')' else '' end,
           'jamais', pes.derniere is null,
           'derniere_pesee', pes.derniere,
           'jours', case when pes.derniere is null then null else v_jour - pes.derniere end
         ) order by pes.derniere nulls first), '[]'::jsonb)
    into v_out
    from public.poudres po
    left join lateral (
      select max((m.created_at at time zone 'Europe/Paris')::date) as derniere
        from public.stock_mouvements m
       where m.poudre_id = po.id and m.type = 'pesee'
    ) pes on true
   where po.atelier_id = p_atelier
     and coalesce(po.actif, true)
     -- Une teinte jamais consommée par un projet n'a pas de rendement à vérifier : la réclamer
     -- ferait relancer un geste que rien ne rend nécessaire. Même condition que la CTE `conso` de
     -- la vue `poudre_rendement`, pour ne jamais afficher deux réponses différentes à « faut-il
     -- peser cette teinte ? » entre l'écran et le courriel.
     and exists (
       select 1 from public.projets pr where pr.poudre_id = po.id and pr.poudre_conso_kg is not null
     )
     and (pes.derniere is null or pes.derniere <= v_jour - p_jours_sans_pesee);

  return v_out;
end
$function$;

revoke all on function public.poudre_pesee_a_rappeler(uuid, integer) from public;

-- ── 3. Le payload du récapitulatif porte la section, calculée seulement quand demandé ─────────
--
-- ATTENTION signature : `recap_quotidien_payload(uuid, boolean)` existait déjà. Un simple
-- `create or replace` avec un troisième paramètre en plus ne remplace RIEN en PostgreSQL — les
-- paramètres font partie de l'identité de la fonction, donc ça CRÉERAIT UNE SECONDE FONCTION
-- surchargée, laissant l'ancienne (à 2 arguments) vivante à côté, EXÉCUTABLE PAR PUBLIC PAR
-- DÉFAUT puisque toute fonction fraîchement créée l'est tant qu'on ne le révoque pas — exactement
-- le piège que `tests/securite-privileges.test.ts` (migration 65) a été écrit pour attraper. On
-- supprime donc l'ancienne signature avant de recréer, puis on referme nommément l'accès par
-- défaut sur la nouvelle : PL/pgSQL ne fige pas les appels de fonction à la création (résolution
-- par nom à l'exécution), donc les fonctions qui l'appellent plus bas dans cette même migration
-- n'ont pas besoin d'un ordre particulier pour continuer à fonctionner.
drop function if exists public.recap_quotidien_payload(uuid, boolean);

create function public.recap_quotidien_payload(p_atelier uuid, p_commercial boolean, p_inclure_pesee boolean default false)
returns jsonb
language plpgsql
stable
security definer
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

-- Nouvelle fonction (au sens du catalogue, cf. le `drop function` ci-dessus) : personne n'a de
-- droit dessus tant qu'on ne le lui donne pas. `service_role` (donc le cron) et le propriétaire
-- gardent l'accès de fait ; ni `anon` ni `authenticated` n'y figurent, exactement comme avant
-- cette migration.
revoke all on function public.recap_quotidien_payload(uuid, boolean, boolean) from public;

-- ── 4. Rendu HTML : la section prend place dans « Ce qui va coincer », avec un lien direct ────
create or replace function public.recap_quotidien_html(p jsonb, p_token text, p_base text)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_h text := '';
  v_frag text[] := '{}';
  v_sujet text;
  v_tmp text;
  v_n int;
  v_commercial boolean := coalesce((p->>'commercial')::boolean, false);
  v_prod jsonb := p->'production';
  v_hier jsonb := p->'hier';
  v_risq jsonb := p->'risques';
  v_arg  jsonb := p->'argent';
  c_h2 constant text := 'style="margin:20px 0 6px;font-size:15px;font-weight:700;color:#111827"';
  c_li constant text := 'style="margin:2px 0;font-size:14px;color:#374151"';
begin
  -- ── L'objet : lisible sur un écran verrouillé, trois informations au maximum ────────────────
  if coalesce((v_prod->>'en_retard_total')::int, 0) > 0 then
    v_n := (v_prod->>'en_retard_total')::int;
    v_frag := v_frag || (v_n || ' en retard')::text;
  end if;
  if coalesce((v_prod->>'a_sortir_total')::int, 0) > 0 then
    v_n := (v_prod->>'a_sortir_total')::int;
    v_frag := v_frag || (v_n || ' à sortir aujourd''hui')::text;
  end if;
  if v_commercial and coalesce((v_arg->'factures'->>'nb')::int, 0) > 0 then
    v_n := (v_arg->'factures'->>'nb')::int;
    v_frag := v_frag || (v_n || ' facture' || case when v_n > 1 then 's échues' else ' échue' end ||
                         ' (' || public.montant_fr((v_arg->'factures'->>'total')::numeric) || ' €)')::text;
  end if;
  if v_commercial and coalesce((v_arg->'devis'->>'nb')::int, 0) > 0 then
    v_n := (v_arg->'devis'->>'nb')::int;
    v_frag := v_frag || (v_n || ' devis sans réponse')::text;
  end if;
  if jsonb_array_length(coalesce(v_risq->'lots', '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(v_risq->'poudres', '[]'::jsonb)) > 0 then
    v_frag := v_frag || 'poudre à surveiller'::text;
  end if;
  -- Amélioration n°7 (migration 68).
  if jsonb_array_length(coalesce(v_risq->'pesees', '[]'::jsonb)) > 0 then
    v_frag := v_frag || 'pesée de rendement à faire'::text;
  end if;
  if jsonb_array_length(coalesce(v_hier->'devis_signes', '[]'::jsonb)) > 0 then
    v_n := jsonb_array_length(v_hier->'devis_signes');
    v_frag := v_frag || (v_n || ' devis signé' || case when v_n > 1 then 's' else '' end)::text;
  end if;

  v_sujet := to_char((p->>'jour')::date, 'DD/MM') || ' — ' ||
             coalesce(array_to_string((select array_agg(f) from unnest(v_frag) with ordinality t(f, i) where i <= 3), ', '),
                      'votre journée');

  -- ── L'action du jour, en tête : à 7 h, debout, on ne lit que la première ligne ──────────────
  if p->'action' is not null and p->'action' <> 'null'::jsonb then
    v_h := v_h ||
      '<div style="border-left:4px solid #147085;background:#f0f9fb;padding:12px 14px;border-radius:0 6px 6px 0;margin-bottom:4px">' ||
      '<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#147085;font-weight:700">À faire ce matin</div>' ||
      '<div style="font-size:16px;font-weight:700;color:#0f172a;margin-top:3px">' ||
      public.echapper_html(p->'action'->>'titre') || '</div>' ||
      '<div style="font-size:13px;color:#475569;margin-top:2px">' ||
      public.echapper_html(p->'action'->>'detail') || '</div>' ||
      '<div style="margin-top:8px"><a href="' || p_base || (p->'action'->>'url') ||
      '" style="color:#147085;font-weight:600;text-decoration:none">Ouvrir →</a></div></div>';
  end if;

  -- ── 1. Ce qui doit sortir, ce qui est en retard ────────────────────────────────────────────
  if coalesce((v_prod->>'en_retard_total')::int, 0) > 0 then
    select string_agg('<li ' || c_li || '><b>' || public.echapper_html(e->>'numero') || '</b> — ' ||
                      public.echapper_html(e->>'client') || ' · promis le ' ||
                      to_char((e->>'date_promise')::date, 'DD/MM') ||
                      ', soit <b style="color:#b91c1c">' || (e->>'jours') || ' jour' ||
                      case when (e->>'jours')::int > 1 then 's' else '' end || ' de retard</b>' ||
                      case when e->>'statut' = 'pret' then ' <span style="color:#166534">(prêt, à remettre)</span>' else '' end ||
                      '</li>', '')
      into v_tmp from jsonb_array_elements(v_prod->'en_retard') e;
    v_h := v_h || '<h2 ' || c_h2 || '>En retard sur la date promise</h2><ul style="margin:0;padding-left:18px">' || v_tmp || '</ul>';
  end if;

  if coalesce((v_prod->>'a_sortir_total')::int, 0) > 0 then
    select string_agg('<li ' || c_li || '><b>' || public.echapper_html(e->>'numero') || '</b> — ' ||
                      public.echapper_html(e->>'client') ||
                      case when coalesce(e->>'nom', '') <> '' then ' · ' || public.echapper_html(e->>'nom') else '' end ||
                      case when e->>'statut' = 'pret' then ' <span style="color:#166534">(prêt)</span>' else '' end ||
                      '</li>', '')
      into v_tmp from jsonb_array_elements(v_prod->'a_sortir') e;
    v_h := v_h || '<h2 ' || c_h2 || '>À sortir aujourd''hui</h2><ul style="margin:0;padding-left:18px">' || v_tmp || '</ul>';
  end if;

  -- ── 2. Ce qui est arrivé hier ──────────────────────────────────────────────────────────────
  if jsonb_array_length(v_hier->'devis_signes') > 0 or jsonb_array_length(v_hier->'bl_signes') > 0
     or jsonb_array_length(v_hier->'reglements') > 0 then
    v_h := v_h || '<h2 ' || c_h2 || '>Hier</h2><ul style="margin:0;padding-left:18px">';
    if jsonb_array_length(v_hier->'devis_signes') > 0 then
      select string_agg('<li ' || c_li || '>Devis <b>' || public.echapper_html(e->>'numero') ||
                        '</b> signé par ' || public.echapper_html(e->>'client') ||
                        ' — ' || public.montant_fr((e->>'total_ttc')::numeric) || ' € TTC</li>', '')
        into v_tmp from jsonb_array_elements(v_hier->'devis_signes') e;
      v_h := v_h || v_tmp;
    end if;
    if jsonb_array_length(v_hier->'bl_signes') > 0 then
      select string_agg('<li ' || c_li || '>Bon de livraison <b>' || public.echapper_html(e->>'numero') ||
                        '</b> signé à la remise — ' || public.echapper_html(e->>'client') || '</li>', '')
        into v_tmp from jsonb_array_elements(v_hier->'bl_signes') e;
      v_h := v_h || v_tmp;
    end if;
    if jsonb_array_length(v_hier->'reglements') > 0 then
      select string_agg('<li ' || c_li || '><b>' || public.montant_fr((e->>'montant')::numeric) ||
                        ' €</b> encaissés — ' || public.echapper_html(e->>'client') ||
                        ' (facture ' || public.echapper_html(e->>'facture') || ')</li>', '')
        into v_tmp from jsonb_array_elements(v_hier->'reglements') e;
      v_h := v_h || v_tmp;
    end if;
    v_h := v_h || '</ul>';
  end if;

  -- ── 3. Ce qui va coincer ───────────────────────────────────────────────────────────────────
  if jsonb_array_length(v_risq->'poudres') > 0 or jsonb_array_length(v_risq->'lots') > 0
     or jsonb_array_length(v_risq->'instruments') > 0 or jsonb_array_length(v_risq->'pesees') > 0 then
    v_h := v_h || '<h2 ' || c_h2 || '>Ce qui va coincer</h2><ul style="margin:0;padding-left:18px">';
    if jsonb_array_length(v_risq->'poudres') > 0 then
      select string_agg('<li ' || c_li || '>' || public.echapper_html(e->>'libelle') ||
                        ' : <b>' || public.quantite_fr((e->>'stock_kg')::numeric) || ' kg</b> en stock, seuil à ' ||
                        public.quantite_fr((e->>'seuil_kg')::numeric) || ' kg</li>', '')
        into v_tmp from jsonb_array_elements(v_risq->'poudres') e;
      v_h := v_h || v_tmp;
    end if;
    if jsonb_array_length(v_risq->'lots') > 0 then
      select string_agg('<li ' || c_li || '>Lot <b>' || public.echapper_html(e->>'numero') || '</b> — ' ||
                        public.echapper_html(e->>'libelle') || ' : ' ||
                        case when (e->>'jours')::int < 0
                             then '<b style="color:#b91c1c">périmé depuis ' || abs((e->>'jours')::int) || ' jours</b>'
                             else 'DLU dans <b>' || (e->>'jours') || ' jours</b>' end ||
                        ', ' || public.quantite_fr((e->>'restant_kg')::numeric) || ' kg restants</li>', '')
        into v_tmp from jsonb_array_elements(v_risq->'lots') e;
      v_h := v_h || v_tmp;
    end if;
    if jsonb_array_length(v_risq->'instruments') > 0 then
      select string_agg('<li ' || c_li || '>' || public.echapper_html(e->>'nom') || ' : ' ||
                        case when coalesce((e->>'jamais')::boolean, false)
                             then 'jamais étalonné'
                             else 'étalonnage dû depuis le ' || to_char((e->>'du_le')::date, 'DD/MM/YYYY') end ||
                        '</li>', '')
        into v_tmp from jsonb_array_elements(v_risq->'instruments') e;
      v_h := v_h || v_tmp;
    end if;
    -- Amélioration n°7 (migration 68) : chaque ligne pointe directement sur l'écran où faire le
    -- geste — pas seulement sur un écran général — puisque le geste se fait teinte par teinte.
    if jsonb_array_length(v_risq->'pesees') > 0 then
      select string_agg('<li ' || c_li || '><a href="' || p_base || '/stock/' || (e->>'poudre_id') ||
                        '#pesee" style="color:#147085;text-decoration:none">' ||
                        public.echapper_html(e->>'libelle') || '</a> : pesée de rendement à faire' ||
                        case when coalesce((e->>'jamais')::boolean, false)
                             then ' (jamais pesée)'
                             else ', dernière le ' || to_char((e->>'derniere_pesee')::date, 'DD/MM/YYYY') end ||
                        '</li>', '')
        into v_tmp from jsonb_array_elements(v_risq->'pesees') e;
      v_h := v_h || v_tmp;
    end if;
    v_h := v_h || '</ul>';
  end if;

  -- ── 4. L'argent — jamais calculé ni rendu pour un rôle qui n'y a pas droit ──────────────────
  if v_commercial and (coalesce((v_arg->'devis'->>'nb')::int, 0) > 0 or coalesce((v_arg->'factures'->>'nb')::int, 0) > 0) then
    v_h := v_h || '<h2 ' || c_h2 || '>L''argent</h2><ul style="margin:0;padding-left:18px">';
    if coalesce((v_arg->'factures'->>'nb')::int, 0) > 0 then
      v_n := (v_arg->'factures'->>'nb')::int;
      v_h := v_h || '<li ' || c_li || '><b>' || v_n || ' facture' || case when v_n > 1 then 's échues' else ' échue' end ||
             '</b> — ' || public.montant_fr((v_arg->'factures'->>'total')::numeric) || ' € restant dus';
      select string_agg('<li ' || c_li || '>' || public.echapper_html(e->>'numero') || ' · ' ||
                        public.echapper_html(e->>'client') || ' · ' ||
                        public.montant_fr((e->>'reste')::numeric) || ' € · ' || (e->>'jours') || ' j de retard' ||
                        case when not coalesce((e->>'relances_actives')::boolean, true)
                             then ' <span style="color:#92400e">(relances coupées)</span>'
                             when coalesce((e->>'relance_count')::int, 0) > 0
                             then ' <span style="color:#6b7280">(' || (e->>'relance_count') || ' relance' ||
                                  case when (e->>'relance_count')::int > 1 then 's' else '' end || ' déjà envoyée' ||
                                  case when (e->>'relance_count')::int > 1 then 's' else '' end || ')</span>'
                             else '' end || '</li>', '')
        into v_tmp from (select e from jsonb_array_elements(v_arg->'factures'->'liste') e limit 5) s(e);
      v_h := v_h || '<ul style="margin:2px 0;padding-left:16px">' || coalesce(v_tmp, '') || '</ul></li>';
    end if;
    if coalesce((v_arg->'devis'->>'nb')::int, 0) > 0 then
      v_n := (v_arg->'devis'->>'nb')::int;
      v_h := v_h || '<li ' || c_li || '><b>' || v_n || ' devis</b> sans réponse depuis plus de ' ||
             (v_arg->'devis'->>'seuil_jours') || ' jours — ' ||
             public.montant_fr((v_arg->'devis'->>'total')::numeric) || ' € en jeu';
      select string_agg('<li ' || c_li || '>' || public.echapper_html(e->>'numero') || ' · ' ||
                        public.echapper_html(e->>'client') || ' · ' ||
                        public.montant_fr((e->>'total_ttc')::numeric) || ' € · envoyé il y a ' ||
                        (e->>'jours') || ' j' ||
                        case when not coalesce((e->>'relances_actives')::boolean, true)
                             then ' <span style="color:#92400e">(relances coupées)</span>' else '' end || '</li>', '')
        into v_tmp from (select e from jsonb_array_elements(v_arg->'devis'->'liste') e limit 5) s(e);
      v_h := v_h || '<ul style="margin:2px 0;padding-left:16px">' || coalesce(v_tmp, '') || '</ul></li>';
    end if;
    v_h := v_h || '</ul>';
  end if;

  -- ── Pied : désabonnement en un clic, et le rappel de la règle ──────────────────────────────
  v_h := '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px">' ||
         '<p style="font-size:13px;color:#6b7280;margin:0 0 12px">Bonjour — voici votre atelier ce matin, ' ||
         to_char((p->>'jour')::date, 'DD/MM/YYYY') || '.</p>' || v_h ||
         '<p style="color:#9aa4b2;font-size:12px;border-top:1px solid #e5e7eb;padding-top:10px;margin-top:22px">' ||
         'Un seul message par jour, et rien les jours où il n''y a rien à dire. ' ||
         '<a href="' || p_base || '/api/notifications/desinscription?t=' || coalesce(p_token, '') ||
         '" style="color:#6b7280">Ne plus recevoir ce récapitulatif</a> · ' ||
         '<a href="' || p_base || '/reglages?onglet=alertes" style="color:#6b7280">Régler l''heure et le contenu</a>' ||
         '</p><p style="color:#9aa4b2;font-size:12px;margin-top:4px">Propulsé par <a href="' || p_base ||
         '" style="color:#147085">Thermogestion</a> — le logiciel des ateliers de thermolaquage.</p></div>';

  return jsonb_build_object('subject', v_sujet, 'html', v_h);
end
$function$;

-- ── 5. Le cron : calcule la section au bon rythme et retient la date quand elle a servi ────────
create or replace function public.envoyer_recap_quotidien()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
  u record;
  v_maintenant timestamptz := now();
  v_local timestamp := (now() at time zone 'Europe/Paris');
  v_jour date := v_local::date;
  v_heure int := extract(hour from v_local)::int;
  v_ouvre boolean := extract(isodow from v_local) between 1 and 5;
  v_payload jsonb;
  v_cache jsonb[] := array[null, null]::jsonb[];  -- [1] production, [2] commercial
  v_commercial boolean;
  v_token uuid;
  v_envoyes int := 0;
  -- Amélioration n°7 (migration 68) : voir le commentaire d'en-tête de la migration pour la
  -- justification de la cadence et du seuil.
  v_inclure_pesee boolean;
  i int;
begin
  for a in
    select at.id, r.recap_heure, r.recap_jours_ouvres,
           r.rappel_pesee_actif, r.rappel_pesee_dernier_envoi
      from public.ateliers at
      cross join lateral (select * from public.reglages_alertes_de(at.id)) r
     where not coalesce(at.demo, false)
       and r.recap_actif
       and r.recap_heure = v_heure
       and (not r.recap_jours_ouvres or v_ouvre)
       and public.abonnement_ouvert(at.id)
  loop
    -- Un cache par atelier : le calcul est le même pour tous les membres d'un même niveau de droit.
    v_cache := array[null, null]::jsonb[];

    -- On ne relance le calcul de la pesée que si 28 jours au moins se sont écoulés depuis la
    -- dernière fois où on avait effectivement quelque chose à montrer (ou jamais encore montré).
    v_inclure_pesee := a.rappel_pesee_actif
                    and (a.rappel_pesee_dernier_envoi is null
                         or a.rappel_pesee_dernier_envoi <= v_jour - 28);

    for u in
      select us.id, us.email, us.role
        from public.users us
       where us.atelier_id = a.id and us.actif and us.email is not null and us.email <> ''
       order by us.created_at
    loop
      -- La ligne d'abonnement est créée au premier envoi : c'est elle qui porte le jeton de
      -- désabonnement. Un atelier qui n'a jamais rien à dire le matin n'accumule pas de lignes.
      insert into public.recap_destinataires(user_id, atelier_id)
      values (u.id, a.id)
      on conflict (user_id) do nothing;

      select d.token into v_token
        from public.recap_destinataires d
       where d.user_id = u.id and d.actif;
      if v_token is null then continue; end if;   -- désabonné

      -- Un seul message par jour et par destinataire. Le cron tourne toutes les heures ; sans ce
      -- verrou, un changement d'heure de réglage en cours de journée en enverrait deux.
      if exists (
        select 1 from public.notifications n
         where n.atelier_id = a.id
           and n.template = 'recap_quotidien'
           and n.destinataire_email = u.email
           and (n.created_at at time zone 'Europe/Paris')::date = v_jour
      ) then continue; end if;

      v_commercial := coalesce(u.role, 'atelier') in ('owner', 'bureau');
      if v_cache[case when v_commercial then 2 else 1 end] is null then
        v_cache[case when v_commercial then 2 else 1 end] :=
          public.recap_quotidien_payload(a.id, v_commercial, v_inclure_pesee);
      end if;
      v_payload := v_cache[case when v_commercial then 2 else 1 end];

      -- Rien à dire : on n'écrit pas. Un courriel « rien à signaler » tous les matins est le
      -- meilleur moyen de se faire ignorer le jour où il y a quelque chose.
      if coalesce((v_payload->>'vide')::boolean, true) then continue; end if;

      insert into public.notifications(atelier_id, destinataire_email, template, payload, scheduled_at)
      values (a.id, u.email, 'recap_quotidien',
              v_payload || jsonb_build_object('desinscription_token', v_token::text),
              v_maintenant);
      v_envoyes := v_envoyes + 1;
    end loop;

    -- On ne repousse l'échéance que si la pesée a été réellement montrée dans un message parti :
    -- un mois sans rien à peser ne doit pas faire sauter le suivant (voir en-tête de migration).
    if v_inclure_pesee then
      for i in 1..2 loop
        if v_cache[i] is not null
           and jsonb_array_length(coalesce(v_cache[i]->'risques'->'pesees', '[]'::jsonb)) > 0 then
          update public.reglages_alertes set rappel_pesee_dernier_envoi = v_jour where atelier_id = a.id;
          exit;
        end if;
      end loop;
    end if;
  end loop;

  return v_envoyes;
end
$function$;

-- ── 6. L'aperçu réglages voit toujours la section si le réglage est actif ──────────────────────
-- `mon_recap_quotidien()` sert l'encart « Ce que vous recevriez ce matin » de `/reglages` :
-- l'atelier doit pouvoir vérifier tout de suite l'effet de son réglage `rappel_pesee_actif`, sans
-- attendre que les 28 jours du cron soient écoulés.
create or replace function public.mon_recap_quotidien()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.recap_quotidien_payload(
    public.current_atelier_id(),
    coalesce(public.acces_commercial(), false),
    coalesce((public.reglages_alertes_de(public.current_atelier_id())).rappel_pesee_actif, true)
  )
   where public.current_atelier_id() is not null;
$function$;
