-- =============================================================================================
-- 65 — Corrections de l'audit de sécurité du 07/09/2026 (AUDIT-SECURITE-07-09-2026.md).
-- =============================================================================================
--
-- Cinq constats fermés ici (le sixième, la confirmation d'e-mail à l'inscription, reste une
-- décision d'Alexis et n'est pas touché). Aucune écriture de données, aucun atelier réel modifié :
-- uniquement des GRANT/REVOKE, une fonction réécrite avec des bornes, et une fonction d'audit
-- nouvelle.
--
-- 1. MÉTADONNÉES D'ATELIER LISIBLES EN ANONYME (moyen). Cinq fonctions `security definer` qui
--    prennent un `atelier uuid` en paramètre étaient exécutables par `anon` : `plan_effectif`,
--    `sieges_occupes`, `sieges_autorises`, `capacite_ouverte`, `acces_comptables_occupes`. La cause
--    exacte, relue en base : leur garde interne `acces_compteur_atelier(p_atelier)` autorise l'accès
--    quand `p_atelier = atelier_du_membre()` **OU** `not appelant_est_un_utilisateur()` — cette
--    seconde branche existe pour les crons et le webhook Stripe (`service_role`, qui n'est membre
--    d'aucun atelier), mais `anon` n'est pas davantage « un utilisateur » et tombe dans la même
--    branche : n'importe qui obtient le plan payé, les sièges et les capacités de n'importe quel
--    atelier dont il connaît l'UUID. Recherché dans `src/` avant de couper : aucun appelant public
--    (la page d'invitation `/signup` appelle `invitation_publique`, jamais ces cinq-là ; le seul
--    appel réel, `sieges_occupes` depuis `/api/billing/*`, passe par une route qui exige déjà la
--    session et le rôle `owner`, via `service_role` qui n'est pas concerné par ce `revoke`).
--
--    Trouvé EN PLUS pendant cette vérification, et fermé pour la même raison : `limite_utilisateurs
--    (p_atelier uuid)` n'est pas `security definer` mais est un simple alias SQL de
--    `sieges_autorises(p_atelier)`, exécuté avec les droits de l'appelant — donc avec ceux d'`anon`
--    s'il est appelé en anonyme. Sans ce sixième `revoke`, fermer `sieges_autorises` à `anon`
--    n'aurait fait que déplacer la fuite d'un nom de fonction à l'autre.
--
--    `revoke ... from anon` NE SUFFIT PAS sur Supabase : `revoke ... from public` non plus à lui
--    seul (le rôle `anon` a reçu un `grant` explicite à la création de ces fonctions, qui survit à
--    un `revoke from public`). Les deux révocations sont donc nommées séparément ci-dessous.
--    `authenticated` garde l'accès : un atelier connecté doit continuer à lire ses propres chiffres.

revoke execute on function public.plan_effectif(uuid) from anon;
revoke execute on function public.plan_effectif(uuid) from public;

revoke execute on function public.sieges_occupes(uuid) from anon;
revoke execute on function public.sieges_occupes(uuid) from public;

revoke execute on function public.sieges_autorises(uuid) from anon;
revoke execute on function public.sieges_autorises(uuid) from public;

revoke execute on function public.capacite_ouverte(uuid, text) from anon;
revoke execute on function public.capacite_ouverte(uuid, text) from public;

revoke execute on function public.acces_comptables_occupes(uuid) from anon;
revoke execute on function public.acces_comptables_occupes(uuid) from public;

revoke execute on function public.limite_utilisateurs(uuid) from anon;
revoke execute on function public.limite_utilisateurs(uuid) from public;

comment on function public.plan_effectif(uuid) is
  'Plan payé d''un atelier. Réservée à authenticated depuis le 07/09/2026 (audit sécurité, '
  'constat 1) : ouverte à anon, elle rendait le plan de n''importe quel atelier à qui devinait son '
  'UUID — acces_compteur_atelier() laisse passer quiconque n''est membre d''aucun atelier, anon y '
  'compris. mon_plan()/ma_capacite() restent accessibles : elles passent par current_atelier_id(), '
  'qui rend null pour anon et ne fuite donc rien.';
comment on function public.sieges_occupes(uuid) is
  'Réservée à authenticated depuis le 07/09/2026 (audit sécurité, constat 1) — même raison que '
  'plan_effectif(uuid) ci-dessus. Seul appelant applicatif : /api/billing/*, qui exige déjà la '
  'session et le rôle owner avant d''appeler via service_role.';
comment on function public.sieges_autorises(uuid) is
  'Réservée à authenticated depuis le 07/09/2026 (audit sécurité, constat 1) — même raison. '
  'limite_utilisateurs(uuid), qui l''appelle sans être elle-même security definer, est fermée à '
  'anon pour la même raison juste en dessous.';
comment on function public.acces_comptables_occupes(uuid) is
  'Réservée à authenticated depuis le 07/09/2026 (audit sécurité, constat 1) — même raison que '
  'plan_effectif(uuid) ci-dessus.';
comment on function public.limite_utilisateurs(uuid) is
  'Alias de sieges_autorises(p_atelier), PAS security definer : exécuté avec les droits de '
  'l''appelant. Fermée à anon le 07/09/2026 en même temps que sieges_autorises, sans quoi elle en '
  'aurait été la porte de derrière — trouvé pendant l''audit du 07/09/2026, absent de sa liste '
  'initiale de cinq fonctions.';


-- -----------------------------------------------------------------------------------------------
-- 2. PIÈCE JOINTE SANS BORNE DE TAILLE (moyen). `joindre_piece_jointe_notification` ne mesurait
--    rien : un compte connecté pouvait attacher un base64 arbitrairement gros, avec trois
--    conséquences — une ligne énorme dans `notifications`, `pg_net` qui pousse tout vers le relais
--    PHP, et un risque d'indisponibilité de l'envoi pour tout l'atelier.
--
--    Mesure choisie : `octet_length(decode(p_base64, 'base64'))`, PAS la longueur de la chaîne
--    base64. Le base64 gonfle la taille réelle d'environ 33 % (4 caractères pour 3 octets) : c'est
--    le poids réel du fichier qui compte pour la boîte du destinataire et pour le relais, pas la
--    taille de son encodage de transport. `decode()` valide au passage que la chaîne est un base64
--    bien formé — une pièce corrompue est rejetée ici plutôt que de partir muette vers
--    tg-mailer.php. Le coût CPU du décodage d'un objet de quelques Mo est négligeable devant un
--    appel réseau vers le relais.
--
--    Bornes : ~10 Mo par pièce, ~20 Mo cumulés par notification. La fonction passe de « remplace »
--    à « ajoute » (`v_existantes || jsonb_build_array(...)` plutôt qu'un `jsonb_build_array` qui
--    écrasait tout) : sans ça, la borne cumulée n'aurait jamais pu être atteinte (chaque appel
--    repartait de zéro), et la fonction s'appelle bien « joindre », pas « remplacer ». Aucun
--    appelant existant n'est affecté : `POST /api/notifications/envoyer` (src/app/api/notifications/
--    envoyer/route.ts) ne l'appelle qu'une fois par notification fraîchement créée, où `attachments`
--    est encore `null` — le résultat pour cet appel unique est rigoureusement identique à avant
--    (un tableau à un élément), ce que `tests/envoi-documents-et-chiffre-du-mois.test.ts` (B3)
--    vérifie déjà et continue de vérifier sans modification.
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
declare
  v_taille_piece bigint;
  v_existantes jsonb;
  v_taille_existantes bigint;
begin
  v_taille_piece := octet_length(decode(p_base64, 'base64'));
  if v_taille_piece > 10 * 1024 * 1024 then
    raise exception 'PIECE_JOINTE_TROP_LOURDE' using detail = v_taille_piece::text;
  end if;

  select coalesce(attachments, '[]'::jsonb) into v_existantes
    from public.notifications
   where id = p_notification_id
     and atelier_id = public.current_atelier_id()
     and status = 'pending';

  if v_existantes is null then
    -- Notification introuvable, hors de l'atelier courant, ou déjà partie : `found` sera faux
    -- après l'update ci-dessous, exactement comme avant ce correctif. Pas d'exception ici, elle
    -- viendrait avant que le bon message (« pas trouvée ») ait sa chance.
    return false;
  end if;

  select coalesce(sum(octet_length(decode(elem ->> 'content_base64', 'base64'))), 0)
    into v_taille_existantes
    from jsonb_array_elements(v_existantes) elem;

  if v_taille_existantes + v_taille_piece > 20 * 1024 * 1024 then
    raise exception 'NOTIFICATION_PIECES_TROP_LOURDES' using detail = (v_taille_existantes + v_taille_piece)::text;
  end if;

  update public.notifications
     set attachments = v_existantes || jsonb_build_array(
           jsonb_build_object('filename', p_filename, 'mime', p_mime, 'content_base64', p_base64)
         )
   where id = p_notification_id
     and atelier_id = public.current_atelier_id()
     and status = 'pending';
  return found;
end
$$;

comment on function public.joindre_piece_jointe_notification(uuid, text, text, text) is
  'Pose le PDF généré côté serveur (POST /api/notifications/envoyer) sur la notification que '
  'envoyer_document() vient de créer. Depuis le 07/09/2026 (audit sécurité, constat 2) : borne à '
  '10 Mo par pièce et 20 Mo cumulés par notification (octet_length du base64 décodé — mesure réelle, '
  'pas la taille de l''encodage), et AJOUTE au tableau existant au lieu de l''écraser. Best-effort '
  'côté route : un échec ici laisse partir le courrier sans pièce jointe plutôt que de faire échouer '
  'tout l''envoi.';

-- Grants inchangés (déjà nominatifs depuis la migration 53) : authenticated uniquement.
revoke all on function public.joindre_piece_jointe_notification(uuid, text, text, text) from public, anon;
grant execute on function public.joindre_piece_jointe_notification(uuid, text, text, text) to authenticated;


-- -----------------------------------------------------------------------------------------------
-- 4. GRANT TROP LARGES SUR `notifications` (faible). `authenticated` détenait INSERT, UPDATE,
--    DELETE, TRUNCATE, REFERENCES, TRIGGER — sans effet aujourd'hui (`notifications` n'a que des
--    policies SELECT, vérifié : `commercial_select` et `tenant_select_bl`), mais un relais qui
--    n'a besoin d'aucun de ces six droits ne doit pas les détenir : le jour où une policy INSERT
--    permissive serait ajoutée par erreur, le relais s'ouvrirait d'un coup sans qu'un GRANT n'ait
--    besoin d'être posé en plus. SELECT reste : c'est le seul droit dont l'atelier se sert (lire
--    son propre historique d'envois).
revoke insert, update, delete, truncate, references, trigger on public.notifications from authenticated;


-- -----------------------------------------------------------------------------------------------
-- 5. FONCTIONS EXÉCUTABLES PAR PUBLIC (faible). Trace du piège déjà rencontré sur `signer_devis`
--    (migration 64) : un `drop function` + `create` sans `revoke ... from public` explicite rend
--    l'exécution à PUBLIC par défaut. L'audit en a nommé six ; `capacite_ouverte` est traitée au
--    point 1 ci-dessus (elle perd aussi anon). Les cinq autres, resignées ici avec leur signature
--    exacte relue en base (`pg_get_function_identity_arguments`) :
revoke all on function public.jeu_jantes_public(text) from public;
revoke all on function public.portail_client(text) from public;
revoke all on function public.portail_vu(text) from public;
revoke all on function public.signer_bl(text, text, jsonb, text) from public;
revoke all on function public.signer_jeu_jantes(text, text, jsonb, text) from public;

-- `revoke all ... from public` ne retire QUE le pseudo-rôle PUBLIC : les `grant` explicites à
-- `anon`/`authenticated` déjà posés sur ces cinq fonctions ne sont pas touchés, donc pas reposés
-- ici. Les pages publiques à jeton (portail client, signature de BL, signature de jeu de jantes)
-- continuent de fonctionner sans compte, exactement comme avant.

-- En vérifiant, la même dérive existait sur VINGT ET UNE autres fonctions de `public`, pas
-- seulement les six nommées par l'audit — même cause (drop + create sans revoke), même absence de
-- conséquence pratique aujourd'hui (PostgREST ne route que par anon et authenticated, jamais par
-- PUBLIC), mais laisser vingt et une exceptions aurait rendu le filet de test du point ci-dessous
-- (« aucune fonction exécutable par PUBLIC ») inutilisable — il aurait fallu vingt et une lignes
-- d'exception dès le premier lancement. Fermées ici pour que le filet parte propre :
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and has_function_privilege('public', p.oid, 'execute')
       -- Les six déjà traitées explicitement plus haut (lisibilité du diff) ne sont pas reprises ici.
       and p.proname not in (
         'capacite_ouverte', 'jeu_jantes_public', 'portail_client', 'portail_vu',
         'signer_bl', 'signer_jeu_jantes'
       )
  loop
    execute format('revoke all on function %s from public', r.sig);
  end loop;
end $$;

-- Vérification faite APRÈS le sweep, avant d'écrire la suite : dix-neuf de ces vingt et une
-- fonctions n'avaient JAMAIS reçu de `grant` explicite à `anon` ni à `authenticated` — leur seul
-- accès venait du PUBLIC qu'on vient de couper. `has_function_privilege('authenticated', …)`
-- confirme qu'elles sont retombées à zéro accès pour tout le monde sauf `postgres`/`service_role`.
-- Toutes les vingt et une sont `security definer = false` (vérifié via `pg_proc.prosecdef`) : ce
-- sont de simples fonctions SQL/plpgsql exécutées avec les droits de l'appelant.
--
-- Sur ces dix-neuf-là (`limite_utilisateurs` est déjà traité au point 1, à part), une seule a un
-- appelant qui aurait cassé en production : `trg_nature_operation`, le trigger (lui-même NON
-- security definer) posé sur `factures`/`devis` qui déduit la nature comptable de l'opération —
-- il appelle `nature_operation_deduite(p_atelier, p_items)` en SQL ordinaire, donc AVEC les droits
-- du rôle qui écrit la ligne. Sans le grant explicite ci-dessous, la prochaine facture créée par un
-- atelier connecté aurait échoué sur « permission denied for function nature_operation_deduite » —
-- une régression bien réelle, découverte en relisant `has_function_privilege('authenticated', …)`
-- juste après le sweep, PAS en le devinant. Les dix-huit autres ne sont appelées que par du code
-- lui-même `security definer` (qui s'exécute avec les droits du propriétaire, peu importe qui a
-- appelé la fonction de départ) ou pas appelées du tout côté application — mais pour ne dépendre
-- d'aucune supposition, `anon`/`authenticated` sont reposés nommément sur les dix-neuf, à
-- l'identique de ce qu'ils avaient AVANT ce fichier (seul PUBLIC change, comme voulu par le
-- constat 5) :
grant execute on function public._controle_num(jsonb, text) to anon, authenticated;
grant execute on function public.blob_recherche(text[]) to anon, authenticated;
grant execute on function public.capacite_du_plan(text, text) to anon, authenticated;
grant execute on function public.client_est_particulier(text) to anon, authenticated;
grant execute on function public.devis_echeance(timestamptz, timestamptz, integer) to anon, authenticated;
grant execute on function public.devis_perime(timestamptz, timestamptz, integer) to anon, authenticated;
grant execute on function public.echappe_like(text) to anon, authenticated;
grant execute on function public.jours_corbeille() to anon, authenticated;
grant execute on function public.ma_capacite(text) to anon, authenticated;
grant execute on function public.mon_plan() to anon, authenticated;
grant execute on function public.montant_fr(numeric) to anon, authenticated;
grant execute on function public.nature_operation_deduite(uuid, jsonb) to anon, authenticated;
grant execute on function public.niveau_plan(text) to anon, authenticated;
grant execute on function public.recherche_globale(text, integer) to anon, authenticated;
grant execute on function public.score_recherche(text, text[]) to anon, authenticated;
grant execute on function public.totaux_devis_items(jsonb, jsonb) to anon, authenticated;
grant execute on function public.txt_normalise(text) to anon, authenticated;
grant execute on function public.verdict_controle(text, jsonb, jsonb) to anon, authenticated;

-- `ma_limite_utilisateurs()` (mon propre atelier, via current_atelier_id()) est le pendant sûr de
-- `limite_utilisateurs(uuid)` (n'importe quel atelier) fermé au point 1 : comme `mon_plan()` et
-- `ma_capacite()`, elle ne fuite rien à anon (`current_atelier_id()` y rend null). Reposée elle
-- aussi à l'identique de son état avant ce fichier.
grant execute on function public.ma_limite_utilisateurs() to anon, authenticated;

-- `limite_utilisateurs(uuid)` en revanche reste fermée à anon (fermeture volontaire du point 1),
-- mais retrouve authenticated : c'est un simple alias de sieges_autorises(p_atelier), qui elle
-- l'a toujours eu explicitement. La priver d'authenticated l'aurait rendue plus fermée que la
-- fonction dont elle n'est qu'un alias, sans aucune raison de sécurité.
grant execute on function public.limite_utilisateurs(uuid) to authenticated;


-- -----------------------------------------------------------------------------------------------
-- FILET — fonction d'audit pour tests/securite-privileges.test.ts.
--
-- Instantané des droits PostgreSQL du schéma public (grants de fonctions, RLS des tables,
-- security_invoker des vues), pour que la suite de tests puisse vérifier la discipline SANS accès
-- direct à pg_catalog depuis PostgREST (qui ne l'expose pas). Elle ne rend que de la métadonnée de
-- structure — aucune ligne, aucun montant, aucun nom de client — mais n'a aucune raison d'être
-- appelable depuis le front : réservée à service_role, comme les fonctions d'administration des
-- tests existantes (`supprimer_atelier_test`, etc.).
create or replace function public.audit_privileges_securite()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'fonctions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'nom', p.proname,
               'args', pg_get_function_identity_arguments(p.oid),
               'security_definer', p.prosecdef,
               'search_path_pose', exists (
                 select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
                  where c like 'search_path=%'
               ),
               'anon', has_function_privilege('anon', p.oid, 'execute'),
               'authenticated', has_function_privilege('authenticated', p.oid, 'execute'),
               'public', has_function_privilege('public', p.oid, 'execute')
             ) order by p.proname), '[]'::jsonb)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
    ),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'nom', c.relname,
               'rls_active', c.relrowsecurity
             ) order by c.relname), '[]'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
    ),
    'vues', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'nom', c.relname,
               'security_invoker', exists (
                 select 1 from unnest(coalesce(c.reloptions, '{}'::text[])) o
                  where o ~* '^security_invoker=(true|on|yes|1)$'
               )
             ) order by c.relname), '[]'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'v'
    )
  );
$$;

revoke all on function public.audit_privileges_securite() from public, anon, authenticated;
grant execute on function public.audit_privileges_securite() to service_role;

comment on function public.audit_privileges_securite() is
  'Filet de tests/securite-privileges.test.ts (audit sécurité du 07/09/2026) : instantané des '
  'grants de fonctions, de la RLS des tables et du security_invoker des vues de public. Réservée à '
  'service_role — ne sert qu''à la suite de tests, jamais au produit.';
