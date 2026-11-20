-- =============================================================================================
-- 53 — Lot B1/B2/B3/B4 : la porte de sortie.
--
-- CE QUI S'EST PASSÉ. Les trois boutons « Envoyer » de devis/[id], factures/[id] et bl/fiche/[id]
-- sont des `mailto:` : pas de PDF joint, pas de trace, et sur le devis le statut passait à
-- « envoyé » avant qu'aucun message ne parte. `process_notifications()` poste vers
-- `thermopoudre.fr/tg-mailer.php` sans `from` ni `replyTo` : le client d'un atelier reçoit sa
-- relance depuis Thermopoudre, pas depuis son laqueur. Et aucun écran ne dit combien on a
-- facturé ce mois.
--
-- CE QUE FAIT CETTE MIGRATION.
--
--  1. **B1 — `envoyer_document(type, id, destinataire?, message?)`.** Une RPC, trois documents.
--     Elle exige que le document soit déjà finalisé (numéro + lien public posés par le bouton
--     « Finaliser »/« Émettre » existant, qu'on ne touche pas ici) puis pose une ligne dans
--     `notifications` — c'est elle, la trace : `envois_documents` la rend lisible aux écrans.
--     Deux nouveaux modèles (`devis_envoye`, `bl_emis`), le troisième existait déjà
--     (`facture_emise`, posé par `notifier_facture_emise`).
--
--  2. **B2 — l'expéditeur.** `process_notifications()` lit désormais `nom` et `email` de
--     l'atelier et les pose dans le corps posté au relais (`sender_name`, `reply_to`). Fait une
--     fois, pour tout le courrier présent et futur — pas seulement les trois nouveaux modèles.
--
--  3. **B3 — la pièce jointe.** Colonne `notifications.attachments`, remplie par
--     `joindre_piece_jointe_notification()` (appelée par la route Next qui génère le PDF côté
--     serveur) et relayée telle quelle par `process_notifications()`. Une seule file d'envoi :
--     pas de table séparée pour le courrier avec PDF.
--
--  4. **B4 — le chiffre du mois.** `chiffres_du_mois()`, réservée au bureau, et
--     `totaux_factures()` pour le pied de `/factures`.
--
-- GARDE-FOU DE RECETTE. `process_notifications()` refuse désormais de contacter le relais réel
-- pour un atelier dont le nom commence par `TEST-AUTO-` (la convention de tous les ateliers
-- jetables de la suite) : la ligne est marquée « annulée » avec le motif, comme le fait déjà la
-- branche `avis_google` quand il n'y a rien à envoyer. Ce n'était vrai d'aucun modèle avant cette
-- migration — les sept autres (relances, récap du matin, export comptable, commande de poudre,
-- avis Google) auraient réellement posté vers `thermopoudre.fr/tg-mailer.php` si un test les avait
-- laissés vivre cinq minutes.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 0. Colonne de pièce jointe
-- ---------------------------------------------------------------------------------------------
alter table public.notifications add column if not exists attachments jsonb;

comment on column public.notifications.attachments is
  'Pièce(s) jointe(s) déjà encodée(s), posée(s) par joindre_piece_jointe_notification() (route '
  'POST /api/notifications/envoyer, B3). Forme attendue par le relais PHP : '
  '[{"filename":"Facture-FA-2026-0123.pdf","mime":"application/pdf","content_base64":"..."}]. '
  'NULL pour tout le reste du courrier (relances, récap du matin, export comptable, commande de '
  'poudre, avis Google), qui reste HTML seul.';

-- ---------------------------------------------------------------------------------------------
-- 1. RLS : les bons de livraison se voient de toute l'équipe, pas seulement du bureau
-- ---------------------------------------------------------------------------------------------
-- `commercial_select` (posée avant cette migration) réserve `notifications` au bureau : c'est
-- juste pour devis/factures, qui révèlent un montant et une marge. Un bon de livraison, lui, est
-- déjà visible de tout l'atelier sur sa propre fiche (`bons_livraison` est en `tenant_all`) — lui
-- fermer la trace de son propre envoi serait une régression, pas une protection.
create policy tenant_select_bl on public.notifications
  for select
  using (atelier_id = public.current_atelier_id() and template = 'bl_emis');

-- ---------------------------------------------------------------------------------------------
-- 2. envoyer_document — la RPC qui remplace les trois `mailto:`
-- ---------------------------------------------------------------------------------------------
-- Le document doit déjà être finalisé : le bouton « Finaliser »/« Émettre » existant reste
-- inchangé (il pose le numéro et le lien public), cette RPC ne fait qu'annoncer un document qui
-- existe déjà. Choix délibéré plutôt que de fusionner finalisation et envoi dans un même geste :
-- `devis`, `factures` et `bons_livraison` n'ont que les statuts que leurs pages publiques
-- connaissent déjà (`DevisPublicClient`, `FacturePublicClient`, `BLPublicClient` — hors périmètre
-- de ce chantier), et un statut intermédiaire de plus les aurait tous les trois concernés.
create or replace function public.envoyer_document(
  p_type text,
  p_id uuid,
  p_destinataire text default null,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atelier uuid := public.current_atelier_id();
  v_email text;
  v_template text;
  v_payload jsonb;
  v_notif_id uuid;
  v_recent record;
  v_msg text := nullif(trim(coalesce(p_message, '')), '');
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;
  if p_type not in ('devis', 'facture', 'bl') then
    raise exception 'DOCUMENT_TYPE_INCONNU' using hint = 'Type de document non reconnu.';
  end if;

  -- L'argent d'un côté, la production de l'autre (cf. src/lib/roles.ts) : devis et factures
  -- restent au bureau, un bon de livraison s'envoie par toute l'équipe au même titre qu'il se
  -- consulte.
  if p_type in ('devis', 'facture') and not coalesce(public.acces_commercial(), false) then
    raise exception 'ACCES_COMMERCIAL_REQUIS' using hint = 'Devis et factures relèvent du bureau.';
  end if;

  if p_type = 'devis' then
    declare
      d record;
    begin
      select dv.numero, dv.status, dv.total_ttc, dv.public_token, c.email as client_email
        into d
        from public.devis dv
        join public.clients c on c.id = dv.client_id
       where dv.id = p_id and dv.atelier_id = v_atelier and dv.deleted_at is null and c.deleted_at is null;
      if not found then
        raise exception 'DOCUMENT_INTROUVABLE';
      end if;
      if d.status = 'brouillon' then
        raise exception 'DOCUMENT_NON_FINALISE' using hint = 'Finalisez le devis avant de l''envoyer : il doit porter un numéro et un lien public.';
      end if;
      v_email := nullif(trim(coalesce(p_destinataire, d.client_email, '')), '');
      if v_email is null then
        raise exception 'DESTINATAIRE_MANQUANT' using hint = 'Indiquez une adresse e-mail, ou copiez le lien pour l''envoyer vous-même.';
      end if;
      v_template := 'devis_envoye';
      v_payload := jsonb_build_object(
        'devis_id', p_id, 'devis_numero', d.numero, 'total_ttc', d.total_ttc,
        'public_token', d.public_token, 'message', v_msg
      );
    end;
  elsif p_type = 'facture' then
    declare
      f record;
    begin
      select fa.numero, fa.status, fa.type, fa.total_ttc, fa.public_token, c.email as client_email
        into f
        from public.factures fa
        join public.clients c on c.id = fa.client_id
       where fa.id = p_id and fa.atelier_id = v_atelier and fa.deleted_at is null and c.deleted_at is null;
      if not found then
        raise exception 'DOCUMENT_INTROUVABLE';
      end if;
      if f.status not in ('emise', 'payee') then
        raise exception 'DOCUMENT_NON_FINALISE' using hint = 'Émettez la facture avant de l''envoyer : un brouillon n''a pas de numéro.';
      end if;
      v_email := nullif(trim(coalesce(p_destinataire, f.client_email, '')), '');
      if v_email is null then
        raise exception 'DESTINATAIRE_MANQUANT' using hint = 'Indiquez une adresse e-mail, ou copiez le lien pour l''envoyer vous-même.';
      end if;
      v_template := 'facture_emise';
      v_payload := jsonb_build_object(
        'facture_id', p_id, 'facture_numero', f.numero, 'total_ttc', f.total_ttc,
        'public_token', f.public_token, 'est_avoir', (f.type = 'avoir'), 'message', v_msg
      );
    end;
  else -- bl
    declare
      b record;
    begin
      select bl.numero, bl.status, bl.public_token, c.email as client_email
        into b
        from public.bons_livraison bl
        join public.clients c on c.id = bl.client_id
       where bl.id = p_id and bl.atelier_id = v_atelier and bl.deleted_at is null and c.deleted_at is null;
      if not found then
        raise exception 'DOCUMENT_INTROUVABLE';
      end if;
      if b.status = 'brouillon' then
        raise exception 'DOCUMENT_NON_FINALISE' using hint = 'Émettez le bon de livraison avant de l''envoyer.';
      end if;
      v_email := nullif(trim(coalesce(p_destinataire, b.client_email, '')), '');
      if v_email is null then
        raise exception 'DESTINATAIRE_MANQUANT' using hint = 'Indiquez une adresse e-mail, ou copiez le lien pour l''envoyer vous-même.';
      end if;
      v_template := 'bl_emis';
      v_payload := jsonb_build_object(
        'bl_id', p_id, 'bl_numero', b.numero, 'public_token', b.public_token, 'message', v_msg
      );
    end;
  end if;

  -- Garde-fou anti double-clic, volontairement court (dix secondes) : contrairement à
  -- `notifier_facture_emise` (une heure, appelée automatiquement à l'émission), ce bouton est un
  -- geste explicite de l'atelier qui doit pouvoir renvoyer de bonne foi — mauvaise adresse
  -- corrigée, client qui affirme n'avoir rien reçu — sans attendre.
  select id into v_recent
    from public.notifications
   where atelier_id = v_atelier and template = v_template
     and destinataire_email = v_email
     and (payload ->> (p_type || '_id')) = p_id::text
     and created_at > now() - interval '10 seconds'
   order by created_at desc
   limit 1;

  if found then
    return jsonb_build_object('notification_id', v_recent.id, 'destinataire', v_email, 'deja_envoye', true);
  end if;

  insert into public.notifications(atelier_id, destinataire_email, template, payload)
  values (v_atelier, v_email, v_template, v_payload)
  returning id into v_notif_id;

  return jsonb_build_object('notification_id', v_notif_id, 'destinataire', v_email, 'deja_envoye', false);
end
$$;

comment on function public.envoyer_document(text, uuid, text, text) is
  'Remplace les `mailto:` de devis/[id], factures/[id] et bl/fiche/[id] (B1). Pose une ligne dans '
  '`notifications` (pending) que `process_notifications()` et, pour la pièce jointe, la route '
  'POST /api/notifications/envoyer se chargent de faire partir. Le document doit déjà être '
  'finalisé (numéro + lien public) : cette RPC annonce, elle ne finalise pas.';

revoke all on function public.envoyer_document(text, uuid, text, text) from public, anon;
grant execute on function public.envoyer_document(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. joindre_piece_jointe_notification — posée par la route serveur qui génère le PDF (B3)
-- ---------------------------------------------------------------------------------------------
create or replace function public.joindre_piece_jointe_notification(
  p_notification_id uuid,
  p_filename text,
  p_mime text,
  p_base64 text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
     set attachments = jsonb_build_array(
           jsonb_build_object('filename', p_filename, 'mime', p_mime, 'content_base64', p_base64)
         )
   where id = p_notification_id
     and atelier_id = public.current_atelier_id()
     -- Une pièce jointe ne se pose que sur du courrier qui n'est pas encore parti : la joindre
     -- après coup ne rattraperait rien, `process_notifications()` a déjà tourné.
     and status = 'pending';
  return found;
end
$$;

comment on function public.joindre_piece_jointe_notification(uuid, text, text, text) is
  'Pose le PDF généré côté serveur (POST /api/notifications/envoyer) sur la notification que '
  'envoyer_document() vient de créer. Best-effort côté route : un échec ici laisse partir le '
  'courrier sans pièce jointe plutôt que de faire échouer tout l''envoi.';

revoke all on function public.joindre_piece_jointe_notification(uuid, text, text, text) from public, anon;
grant execute on function public.joindre_piece_jointe_notification(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. envois_documents — la trace, lisible par les trois fiches (cf. relances_envoyees)
-- ---------------------------------------------------------------------------------------------
create view public.envois_documents
with (security_invoker = on) as
select n.id,
       n.atelier_id,
       n.template,
       case n.template
         when 'devis_envoye'  then 'devis'
         when 'facture_emise' then 'facture'
         when 'bl_emis'       then 'bl'
       end as document_type,
       coalesce(n.payload ->> 'devis_id', n.payload ->> 'facture_id', n.payload ->> 'bl_id')::uuid as document_id,
       coalesce(n.payload ->> 'devis_numero', n.payload ->> 'facture_numero', n.payload ->> 'bl_numero') as document_numero,
       n.destinataire_email as destinataire,
       nullif(n.payload ->> 'message', '') as message,
       n.status as statut_envoi,
       n.error as erreur_envoi,
       (n.attachments is not null) as avec_piece_jointe,
       n.sent_at,
       n.created_at as envoye_at
  from public.notifications n
 where n.template in ('devis_envoye', 'facture_emise', 'bl_emis');

comment on view public.envois_documents is
  'La trace de B1 : qui a reçu quel devis/facture/BL, quand, avec quel message et quel sort réel '
  '(statut_envoi, erreur_envoi). En security_invoker : la RLS de `notifications` décide seule qui '
  'voit quoi — commercial_select pour devis/facture, tenant_select_bl (posée par cette même '
  'migration) pour les BL, ouverts à toute l''équipe au même titre que la fiche elle-même.';

-- ---------------------------------------------------------------------------------------------
-- 5. process_notifications — expéditeur (B2), pièce jointe (B3), deux modèles (B1), garde de test
-- ---------------------------------------------------------------------------------------------
create or replace function public.process_notifications()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_subject text;
  v_html text;
  v_count int := 0;
  v_suivi text;
  v_req bigint;
  v_lignes text;
  v_url text;
  v_rendu jsonb;
  v_base text := public.url_de_base();
  v_footer text;
  -- B2 : l'expéditeur réel du courrier, lu sur l'atelier plutôt que posé à chaque insertion —
  -- s'applique d'un coup à tout le courrier déjà en file et à venir, sans toucher aux dizaines de
  -- points d'insertion (notifier_facture_emise, le cron de relance, le récap du matin…).
  v_sender_name text;
  v_reply_to text;
  -- Le mot personnalisable de B1 (devis_envoye, facture_emise, bl_emis) : échappé à la main, ce
  -- champ vient d'un opérateur, pas de la base.
  v_msg text;
  v_msg_html text;
begin
  v_footer := '<p style="color:#9aa4b2;font-size:12px;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:16px">Propulsé par <a href="' || v_base || '" style="color:#147085">Thermogestion</a> — le logiciel des ateliers de thermolaquage.</p>';
  for r in
    select * from public.notifications
     where status = 'pending' and scheduled_at <= now()
     order by created_at limit 20
     for update skip locked
  loop
    select a.nom, nullif(trim(coalesce(a.email, '')), '')
      into v_sender_name, v_reply_to
      from public.ateliers a
     where a.id = r.atelier_id;

    -- Garde-fou de recette : jamais un e-mail réel pour un atelier jetable de la suite de tests.
    -- Le relais n'est tout simplement pas appelé — même traitement que la branche `avis_google`
    -- plus bas quand il n'y a rien à envoyer.
    if v_sender_name like 'TEST-AUTO-%' then
      update public.notifications
         set status = 'annulee', error = 'Notification non transmise : atelier de test (préfixe TEST-AUTO-).'
       where id = r.id;
      v_count := v_count + 1;
      continue;
    end if;

    v_msg := nullif(trim(coalesce(r.payload->>'message', '')), '');
    v_msg_html := case when v_msg is not null then
      '<p style="background:#f9fafb;padding:10px;border-radius:6px;white-space:pre-wrap">' ||
      replace(replace(replace(v_msg, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>'
      else '' end;

    if r.template = 'devis_signe' then
      v_subject := '✍️ Devis ' || coalesce(r.payload->>'devis_numero','') || ' signé par ' || coalesce(r.payload->>'signed_by','votre client');
      v_html := '<p>Bonne nouvelle !</p><p>Le devis <b>' || coalesce(r.payload->>'devis_numero','') ||
                '</b> vient d''être signé par <b>' || coalesce(r.payload->>'signed_by','') ||
                '</b> pour un montant de <b>' || coalesce(r.payload->>'total_ttc','') || ' € TTC</b>.</p>' ||
                '<p>Le projet a été créé automatiquement dans votre atelier.</p>' ||
                '<p><a href="' || v_base || '/projets">Ouvrir Thermogestion</a></p>' || v_footer;
    elsif r.template = 'bl_signe' then
      v_subject := '📦 Bon de livraison ' || coalesce(r.payload->>'bl_numero','') || ' signé par ' || coalesce(r.payload->>'signed_by','votre client');
      v_html := '<p>Le bon de livraison <b>' || coalesce(r.payload->>'bl_numero','') ||
                '</b> vient d''être signé à la remise des pièces par <b>' || coalesce(r.payload->>'signed_by','') || '</b>.</p>' ||
                '<p>Le projet correspondant est passé en « Livré ».</p>' ||
                '<p><a href="' || v_base || '/bl">Ouvrir Thermogestion</a></p>' || v_footer;
    elsif r.template = 'projet_etape' then
      v_suivi := v_base || '/s/' || coalesce(r.payload->>'public_token','');
      v_subject := '🎨 Vos pièces avancent — ' || coalesce(r.payload->>'projet_nom','votre projet');
      v_html := '<p>Bonjour,</p><p>L''étape <b>' || coalesce(r.payload->>'etape_faite','') ||
                '</b> de votre projet <b>' || coalesce(r.payload->>'projet_numero','') ||
                '</b> est terminée.</p>' ||
                '<p><a href="' || v_suivi || '">Suivre l''avancement de vos pièces</a></p>' ||
                '<p style="color:#888;font-size:12px">Email envoyé par Thermogestion pour le compte de votre atelier.</p>' || v_footer;
    elsif r.template = 'devis_relance' then
      v_suivi := v_base || '/d/' || coalesce(r.payload->>'public_token','');
      v_subject := '⏳ Votre devis ' || coalesce(r.payload->>'devis_numero','') || ' attend votre accord';
      v_html := '<p>Bonjour,</p><p>Votre devis <b>' || coalesce(r.payload->>'devis_numero','') ||
                '</b> de <b>' || coalesce(r.payload->>'total_ttc','') || ' € TTC</b> est toujours en attente de signature.</p>' ||
                '<p><a href="' || v_suivi || '">Consulter et signer le devis</a></p>' || v_footer;

    -- B1 — nouveau : l'envoi manuel d'un devis finalisé depuis la fiche.
    elsif r.template = 'devis_envoye' then
      v_suivi := v_base || '/d/' || coalesce(r.payload->>'public_token','');
      v_subject := '📄 Votre devis ' || coalesce(r.payload->>'devis_numero','') || ' est prêt';
      v_html := '<p>Bonjour,</p><p>Voici votre devis <b>' || coalesce(r.payload->>'devis_numero','') ||
                '</b> de <b>' || coalesce(r.payload->>'total_ttc','') || ' € TTC</b>, à consulter et à signer en ligne.</p>' ||
                v_msg_html ||
                '<p><a href="' || v_suivi || '">Consulter et signer le devis</a></p>' || v_footer;

    elsif r.template = 'facture_emise' then
      v_suivi := v_base || '/f/' || coalesce(r.payload->>'public_token','');
      v_subject := (case when coalesce((r.payload->>'est_avoir')::boolean, false) then '🧾 Votre avoir ' else '🧾 Votre facture ' end)
                   || coalesce(r.payload->>'facture_numero','') || ' est disponible';
      v_html := '<p>Bonjour,</p><p>Votre ' || (case when coalesce((r.payload->>'est_avoir')::boolean, false) then 'avoir' else 'facture' end) ||
                ' <b>' || coalesce(r.payload->>'facture_numero','') ||
                '</b> de <b>' || coalesce(r.payload->>'total_ttc','') || ' € TTC</b> est disponible.</p>' ||
                v_msg_html ||
                '<p><a href="' || v_suivi || '">Consulter' || (case when coalesce((r.payload->>'est_avoir')::boolean, false) then '' else ' et payer' end) || ' en ligne</a></p>' || v_footer;

    -- B1 — nouveau : l'envoi manuel d'un bon de livraison émis.
    elsif r.template = 'bl_emis' then
      v_suivi := v_base || '/bl/' || coalesce(r.payload->>'public_token','');
      v_subject := '📦 Bon de livraison ' || coalesce(r.payload->>'bl_numero','');
      v_html := '<p>Bonjour,</p><p>Voici votre bon de livraison <b>' || coalesce(r.payload->>'bl_numero','') ||
                '</b>, à vérifier et à signer à la remise des pièces.</p>' ||
                v_msg_html ||
                '<p><a href="' || v_suivi || '">Consulter le bon de livraison</a></p>' || v_footer;

    elsif r.template = 'facture_relance' then
      v_suivi := v_base || '/f/' || coalesce(r.payload->>'public_token','');
      v_subject := '⏳ Facture ' || coalesce(r.payload->>'facture_numero','') || ' — paiement en attente';
      v_html := '<p>Bonjour,</p><p>Votre facture <b>' || coalesce(r.payload->>'facture_numero','') ||
                '</b> de <b>' || coalesce(r.payload->>'total_ttc','') || ' € TTC</b> n''a pas encore été réglée.</p>' ||
                '<p><a href="' || v_suivi || '">Payer en ligne</a></p>' || v_footer;
    elsif r.template = 'facture_payee' then
      v_subject := '💶 Facture ' || coalesce(r.payload->>'facture_numero','') || ' payée';
      v_html := '<p>La facture <b>' || coalesce(r.payload->>'facture_numero','') || '</b> vient d''être réglée en ligne (' ||
                coalesce(r.payload->>'montant','') || ' €).</p>' ||
                '<p><a href="' || v_base || '/factures">Ouvrir Thermogestion</a></p>' || v_footer;

    elsif r.template = 'recap_quotidien' then
      v_rendu := public.recap_quotidien_html(r.payload, r.payload->>'desinscription_token', v_base);
      v_subject := coalesce(r.payload->>'atelier_nom', 'Votre atelier') || ' — ' || (v_rendu->>'subject');
      v_html := v_rendu->>'html';

    elsif r.template = 'export_comptable' then
      v_rendu := public.export_comptable_html(r.payload, v_base);
      v_subject := v_rendu->>'subject';
      v_html := v_rendu->>'html';

    elsif r.template = 'commande_poudre' then
      select coalesce(string_agg(
               '<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb"><b>' || coalesce(l->>'reference','') ||
               '</b><br><span style="color:#6b7280;font-size:12px">' || coalesce(l->>'designation','') ||
               '</span></td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">' ||
               public.quantite_fr((l->>'quantite_kg')::numeric) || ' kg</td></tr>', '')
             , '')
        into v_lignes
        from jsonb_array_elements(coalesce(r.payload->'lignes', '[]'::jsonb)) l;

      if coalesce((r.payload->>'copie')::boolean, false) then
        v_subject := '📄 Copie de votre commande ' || coalesce(r.payload->>'numero','');
      else
        v_subject := '🧪 Commande de poudre ' || coalesce(r.payload->>'numero','') || ' — ' || coalesce(r.payload->>'atelier_nom','');
      end if;

      v_html := '<p>Bonjour,</p><p>Commande <b>' || coalesce(r.payload->>'numero','') || '</b> de <b>' ||
                coalesce(r.payload->>'atelier_nom','') || '</b>.</p>' ||
                '<table style="border-collapse:collapse;width:100%;max-width:560px;font-size:14px">' ||
                '<tr><th style="text-align:left;padding:6px 10px;border-bottom:2px solid #374151">Référence</th>' ||
                '<th style="text-align:right;padding:6px 10px;border-bottom:2px solid #374151">Quantité</th></tr>' ||
                coalesce(v_lignes, '') || '</table>' ||
                case when coalesce(r.payload->>'note','') <> ''
                     then '<p style="background:#f9fafb;padding:10px;border-radius:4px"><b>Note :</b> ' || (r.payload->>'note') || '</p>'
                     else '' end ||
                '<p style="font-size:13px;color:#4b5563"><b>Livraison</b><br>' ||
                coalesce(r.payload->>'atelier_nom','') || '<br>' ||
                coalesce(r.payload->>'atelier_adresse','') || '<br>' ||
                coalesce(r.payload->>'atelier_telephone','') || ' · ' || coalesce(r.payload->>'atelier_email','') ||
                case when coalesce(r.payload->>'atelier_siren','') <> ''
                     then '<br>SIREN ' || (r.payload->>'atelier_siren') else '' end || '</p>' || v_footer;

    elsif r.template = 'avis_google' then
      select avis_google_url into v_url from public.ateliers where id = r.atelier_id;
      if v_url is null or trim(v_url) = '' then
        update public.notifications
           set status = 'annulee', error = 'Aucune fiche Google renseignée dans les réglages de l''atelier.'
         where id = r.id;
        continue;
      end if;
      v_subject := 'Votre avis sur ' || coalesce(r.payload->>'atelier_nom','notre atelier') || ' ?';
      v_html := '<p>Bonjour,</p><p>Vos pièces vous ont été remises il y a deux jours. Si le travail vous a plu, ' ||
                'un avis en ligne aide beaucoup un atelier comme le nôtre — cela prend une minute.</p>' ||
                '<p><a href="' || v_url || '" style="display:inline-block;background:#147085;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Laisser un avis</a></p>' ||
                '<p style="color:#6b7280;font-size:13px">Si quelque chose n''allait pas, répondez plutôt à ce message : ' ||
                'nous préférons le savoir et le corriger.</p>' ||
                '<p>' || coalesce(r.payload->>'atelier_nom','') || '</p>' ||
                '<p style="color:#888;font-size:12px">Email envoyé par Thermogestion pour le compte de votre atelier.</p>' || v_footer;

    else
      v_subject := 'Notification Thermogestion';
      v_html := '<pre>' || r.payload::text || '</pre>' || v_footer;
    end if;

    select net.http_post(
      url := 'https://thermopoudre.fr/tg-mailer.php',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'token', '7da9f0e3053c481c97f8f45da983748ab2a7cca849dc9767',
        'to', r.destinataire_email,
        'subject', v_subject,
        'html', v_html,
        -- B2 : l'atelier, jamais Thermopoudre. `sender_name`/`reply_to` peuvent être vides (atelier
        -- sans e-mail renseigné) : au relais de décider du repli, documenté au rapport de ce lot.
        'sender_name', v_sender_name,
        'reply_to', v_reply_to,
        -- B3 : vide pour tout le courrier qui n'en a pas — la clé est toujours présente, sa valeur
        -- ne l'est pas forcément.
        'attachments', coalesce(r.attachments, '[]'::jsonb)
      )
    ) into v_req;
    update public.notifications
       set status = 'sent', sent_at = now(), http_request_id = v_req, error = null
     where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $function$;

-- `create or replace` conserve les droits existants ; on les repose pour que la migration soit
-- rejouable seule sur une base neuve, et parce que c'est une fonction de cron, jamais appelée
-- depuis PostgREST.
revoke all on function public.process_notifications() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. chiffres_du_mois — B4, réservée au bureau
-- ---------------------------------------------------------------------------------------------
create or replace function public.chiffres_du_mois()
returns table(
  facture_ht numeric,
  facture_ht_mois_precedent numeric,
  encaisse numeric,
  encaisse_mois_precedent numeric,
  reste_du numeric,
  m2_produits numeric,
  m2_produits_mois_precedent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_atelier uuid := public.current_atelier_id();
  v_debut date := date_trunc('month', now())::date;
  v_fin date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  v_debut_prec date := (date_trunc('month', now()) - interval '1 month')::date;
  v_fin_prec date := (v_debut - interval '1 day')::date;
begin
  if v_atelier is null then
    raise exception 'ATELIER_INCONNU';
  end if;
  -- Réservée au bureau : « facturé » et « encaissé » sont un chiffre d'affaires, et
  -- src/lib/roles.ts range ça du côté « argent », jamais donné à un compte d'atelier.
  if not coalesce(public.acces_commercial(), false) then
    raise exception 'ACCES_COMMERCIAL_REQUIS' using hint = 'Le chiffre du mois appartient au bureau.';
  end if;

  return query
  select
    -- Facturé du mois : HT, émises ou payées, avoirs déduits, et seulement ce qui est parti de
    -- l'application (`origine = 'application'`) — même filtre que journal_ventes() : une facture
    -- de reprise n'est pas un résultat du mois, c'est de l'encours importé (lot A).
    (select coalesce(sum(case when f.type = 'avoir' then -f.total_ht else f.total_ht end), 0)
       from public.factures f
      where f.atelier_id = v_atelier and f.deleted_at is null and f.origine = 'application'
        and f.status in ('emise', 'payee')
        and f.emise_at >= v_debut::timestamptz and f.emise_at < (v_fin + 1)::timestamptz),
    (select coalesce(sum(case when f.type = 'avoir' then -f.total_ht else f.total_ht end), 0)
       from public.factures f
      where f.atelier_id = v_atelier and f.deleted_at is null and f.origine = 'application'
        and f.status in ('emise', 'payee')
        and f.emise_at >= v_debut_prec::timestamptz and f.emise_at < (v_fin_prec + 1)::timestamptz),
    -- Encaissé du mois : toutes origines — un virement reçu ce mois-ci sur une facture reprise de
    -- l'ancien logiciel est de l'argent réel encaissé ce mois-ci, il compte au même titre.
    (select coalesce(sum(p.montant), 0)
       from public.paiements p join public.factures f on f.id = p.facture_id
      where f.atelier_id = v_atelier
        and p.paye_at >= v_debut::timestamptz and p.paye_at < (v_fin + 1)::timestamptz),
    (select coalesce(sum(p.montant), 0)
       from public.paiements p join public.factures f on f.id = p.facture_id
      where f.atelier_id = v_atelier
        and p.paye_at >= v_debut_prec::timestamptz and p.paye_at < (v_fin_prec + 1)::timestamptz),
    -- Reste dû : un instantané à aujourd'hui, pas une donnée du mois — reprises comprises : c'est
    -- justement l'encours repris (lot A2) qui manquait le premier jour.
    (select coalesce(sum(f.total_ttc), 0) - coalesce((
         select sum(p.montant) from public.paiements p
          where p.facture_id = f.id
       ), 0)
       from public.factures f
      where f.atelier_id = v_atelier and f.deleted_at is null and f.status = 'emise'),
    -- m² produits du mois : projets réellement sortis de l'atelier (statut « livré ») sur la
    -- période, à leur date de livraison. Une pièce « prête » mais non enlevée n'est pas produite
    -- pour le client, elle est produite pour l'entrepôt.
    (select coalesce(sum(p.surface_m2), 0)
       from public.projets p
      where p.atelier_id = v_atelier and p.deleted_at is null and p.status = 'livre'
        and p.date_livraison >= v_debut and p.date_livraison <= v_fin),
    (select coalesce(sum(p.surface_m2), 0)
       from public.projets p
      where p.atelier_id = v_atelier and p.deleted_at is null and p.status = 'livre'
        and p.date_livraison >= v_debut_prec and p.date_livraison <= v_fin_prec);
end
$$;

comment on function public.chiffres_du_mois() is
  'B4 — la bande de quatre chiffres du tableau de bord. Réservée au bureau (acces_commercial()) : '
  'facturé et encaissé sont un chiffre d''affaires, src/lib/roles.ts le range du côté « argent ».';

revoke all on function public.chiffres_du_mois() from public, anon;
grant execute on function public.chiffres_du_mois() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. totaux_factures — B4, le pied de /factures sur le filtre courant
-- ---------------------------------------------------------------------------------------------
-- SECURITY INVOKER (pas DEFINER) : la RLS de `factures`/`paiements` (déjà commercial_all) fait le
-- travail seule, et /factures est déjà une page réservée au bureau (src/lib/roles.ts,
-- PREFIXES_COMMERCIAUX). Rien à revérifier ici, une couche de plus n'aurait rien protégé de plus.
create or replace function public.totaux_factures(p_statuts text[] default null)
returns table(facture_ht numeric, facture_ttc numeric, encaisse numeric, reste_du numeric)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(case when f.type = 'avoir' then -f.total_ht else f.total_ht end), 0),
    coalesce(sum(case when f.type = 'avoir' then -f.total_ttc else f.total_ttc end), 0),
    coalesce((
      select sum(p.montant) from public.paiements p
        join public.factures f2 on f2.id = p.facture_id
       where f2.atelier_id = public.current_atelier_id() and f2.deleted_at is null
         and (p_statuts is null or f2.status = any(p_statuts))
    ), 0),
    coalesce(sum(case when f.type = 'avoir' then -f.total_ttc else f.total_ttc end), 0) -
    coalesce((
      select sum(p.montant) from public.paiements p
        join public.factures f2 on f2.id = p.facture_id
       where f2.atelier_id = public.current_atelier_id() and f2.deleted_at is null
         and (p_statuts is null or f2.status = any(p_statuts))
    ), 0)
  from public.factures f
  where f.atelier_id = public.current_atelier_id() and f.deleted_at is null
    and (p_statuts is null or f.status = any(p_statuts));
$$;

comment on function public.totaux_factures(text[]) is
  'Le pied de /factures (B4) : facturé, encaissé, reste dû sur le filtre de statuts courant de '
  'l''écran (NULL = tous). SECURITY INVOKER — protégée par la RLS de factures/paiements.';

revoke all on function public.totaux_factures(text[]) from public, anon;
grant execute on function public.totaux_factures(text[]) to authenticated;
