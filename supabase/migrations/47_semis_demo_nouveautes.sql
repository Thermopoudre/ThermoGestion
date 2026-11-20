-- =============================================================================================
-- 47 — Le jeu de démonstration montre enfin les trois nouveautés de la semaine.
--
-- CE QUI MANQUAIT. Un prospect qui entre par `/demo` ne voyait **jamais** : aucun portail client
-- ouvert (zéro ligne dans `client_portail`, sur quatre clients), un journal des modifications
-- vide sur les quatre types de fiche (zéro ligne dans `audit_logs`, tous ateliers confondus), et
-- aucun devis proche de son échéance ni expiré (les quatre devis de la démo courent jusqu'en
-- septembre). Trois fonctions livrées cette semaine, dont deux sont des arguments de vente,
-- restaient invisibles pour qui découvre le produit.
--
-- POURQUOI CE FICHIER EXISTE, ET PAS UN SCRIPT JETABLE. L'atelier `Atelier Démo Thermolaquage`
-- est un atelier **réel de production**, protégé par `trg_interdire_ecriture_demo`. Son contenu a
-- été composé ligne à ligne : c'est une vitrine commerciale, pas un bac à sable. Ce qu'on y
-- ajoute doit être relisible, rejouable, et se contredire de nulle part. D'où une migration
-- idempotente plutôt qu'une poignée d'`INSERT` tapés à la main.
--
-- COMMENT LE VERROU EST FRANCHI, et pourquoi c'est la façon la moins dangereuse.
-- `trg_interdire_ecriture_demo` lit le rôle dans `request.jwt.claims` : il laisse passer
-- `service_role`, et il laisse passer une connexion sans claims du tout (migration, maintenance).
-- Cette migration s'exécute sous `postgres`, donc **sans claim de rôle** : le verrou n'a rien à
-- refuser. On ne le désactive pas, on ne bascule pas `ateliers.demo` à false le temps d'écrire
-- (ce qui ouvrirait la démonstration en écriture à tous les visiteurs pendant la transaction) :
-- on passe par le seul chemin que le trigger prévoit déjà.
--
-- En revanche on pose `request.jwt.claims -> sub` sur le compte responsable de la démonstration.
-- POURQUOI : `trg_journal` lit `auth.uid()` pour signer chaque ligne du journal. Sans cette
-- identité, les modifications ci-dessous seraient signées « Le logiciel » — et un prospect
-- verrait un historique où aucun humain n'apparaît, c'est-à-dire l'exact contraire de ce que la
-- fonction sert à démontrer. Le claim ne porte **pas** de rôle : `auth.uid()` répond, le verrou
-- de démonstration reste dans le cas « pas de claims de rôle », et rien n'est usurpé côté RLS.
--
-- CE QUI EST SEMÉ, et rien d'autre :
--   1. deux espaces clients ouverts, avec un historique de consultation plausible ;
--   2. quatre **vraies** modifications de données, qui produisent quatre vraies lignes de
--      journal — une par type de fiche. Aucune ligne d'`audit_logs` n'est écrite à la main : la
--      table est fermée en écriture et le serait de toute façon par `journal_inalterable` ;
--   3. deux devis : un qui expire dans trois jours, un déjà expiré.
--
-- IDEMPOTENCE. Les insertions sont en `on conflict do nothing`, les mises à jour portent une
-- clause `where` sur l'ancienne valeur. Rejouer la migration ne crée ni doublon, ni seconde
-- ligne de journal.
-- =============================================================================================

do $semis$
declare
  v_atelier  constant uuid := 'df1ee297-3232-4a81-a7d8-f7734b699f90';  -- Atelier Démo Thermolaquage
  v_karim    constant uuid := 'dddddddd-0000-4000-8000-000000000001';  -- Karim B., responsable
  v_aluform  constant uuid := 'd0000000-0000-4000-8000-000000000021';  -- Menuiserie ALUFORM
  v_piston   constant uuid := 'd0000000-0000-4000-8000-000000000022';  -- Garage Piston & Fils
  v_julien   constant uuid := 'd0000000-0000-4000-8000-000000000024';  -- Julien Bernard
  v_grille   constant uuid := 'd0000000-0000-4000-8000-000000000001';  -- grille tarifaire par défaut
begin
  -- Garde-fou : si l'atelier de démonstration n'est pas celui qu'on croit, on ne touche à rien.
  -- Cette migration écrit dans un atelier de production ; se tromper de cible n'est pas une
  -- option qu'on rattrape.
  if not exists (select 1 from public.ateliers where id = v_atelier and demo) then
    raise exception 'Atelier de démonstration introuvable ou non marqué demo : rien n''a été écrit.';
  end if;

  -- L'identité qui signera le journal. `true` = portée transaction : rien ne fuit vers la
  -- session suivante du pool.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_karim)::text,
                     true);

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 1. Deux espaces clients ouverts
  --
  -- Deux sur quatre, et non quatre sur quatre : le visiteur doit voir les **deux** états de la
  -- fonction — l'espace ouvert avec son lien et son compteur de visites, et le bouton « Ouvrir
  -- l'espace client » sur les fiches où il est encore fermé. Un portail ouvert partout ne
  -- montrerait pas que la décision appartient à l'atelier, client par client.
  --
  -- Le jeton est laissé au `default` de la table (`pc_` + 32 octets aléatoires) : aucun secret
  -- n'est écrit en dur dans une migration versionnée.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  insert into public.client_portail (client_id, atelier_id, ouvert_par, ouvert_at, derniere_visite_at, visites)
  values
    -- Le donneur d'ordre le plus actif de la démonstration : espace ouvert début août, consulté
    -- régulièrement depuis. C'est le cas qui vend la fonction.
    (v_aluform, v_atelier, v_karim, '2026-08-05 10:12:00+02', '2026-08-19 08:41:00+02', 9),
    -- Le garage : ouvert plus tard, consulté trois fois. Un usage réaliste, pas un chiffre rond.
    (v_piston,  v_atelier, v_karim, '2026-08-11 17:40:00+02', '2026-08-18 12:03:00+02', 3)
  on conflict (client_id) do nothing;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 2. Deux devis : l'un expire dans trois jours, l'autre est expiré
  --
  -- POURQUOI deux et pas un. Les deux écrans ne disent pas la même chose et ne servent pas le
  -- même argument : « Signable jusqu'au 24/08/2026 — encore 3 jours » est une alerte qui laisse
  -- le temps d'agir ; « Validité dépassée depuis le 06/08/2026 », avec le chemin de rattrapage
  -- (revenir au brouillon, ou faire une nouvelle version), est la preuve que le logiciel ne
  -- laisse pas signer une offre qui n'a plus cours. C'est la seconde qui rassure un exploitant.
  --
  -- ATTENTION AU TABLEAU DE BORD. Le taux de conversion se calcule sur les devis créés dans les
  -- 30 derniers jours. Les deux devis ci-dessous sont plus anciens : ils n'entrent pas dans ce
  -- calcul et ne dégradent donc pas le chiffre affiché en vitrine. Ce n'est pas un détail
  -- cosmétique — un prospect qui découvre le produit sur un atelier à 50 % de conversion en tire
  -- une conclusion sur le produit.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════

  -- ── DV-2026-0016 — expire dans trois jours ─────────────────────────────────────────────────
  -- Un gros chantier de garde-corps, parti fin juin avec une validité de 60 jours (usage courant
  -- sur les affaires à plusieurs milliers d'euros, où le client doit consulter). Il a été relancé
  -- trois fois — le plafond de l'atelier — et la fiche affichera « Le nombre maximal de relances
  -- est atteint ». Le devis n'a donc pas été oublié : il a été suivi, et il arrive au bout. C'est
  -- exactement la situation que la fonction sert à rattraper.
  insert into public.devis (
    id, atelier_id, client_id, numero, status, items, total_ht, total_tva, total_ttc,
    notes, validite_jours, public_token, envoye_at, relance_count, derniere_relance_at,
    relances_actives, created_by, created_at, updated_at)
  values (
    'd0000000-0000-4000-8000-000000000045', v_atelier, v_aluform, 'DV-2026-0016', 'envoye',
    jsonb_build_array(
      jsonb_build_object(
        'type', 'm2', 'libelle', 'Thermolaquage garde-corps résidence', 'unite', 'm2',
        'qte', 96.4, 'pu_ht', 33.50, 'tva', 20, 'total_ht', 3229.40,
        'meta', jsonb_build_object('surface', 96.4, 'couche', '1', 'finition', 'satine',
                                   'complexite', 'moyenne', 'grille_id', v_grille)),
      jsonb_build_object(
        'type', 'prestation', 'libelle', 'Sablage / grenaillage', 'unite', 'm2',
        'qte', 96.4, 'pu_ht', 14.00, 'tva', 20, 'total_ht', 1349.60)),
    4579.00, 915.80, 5494.80,
    'Chantier résidence Les Oliviers — enlèvement sur site, 3 rotations prévues.',
    60, 'b41d90c7e5a83f26d0c1b7e492af5310',
    '2026-06-25 09:30:00+02', 3, '2026-07-04 09:00:00+02',
    true, v_karim, '2026-06-24 16:10:00+02', '2026-07-04 09:00:00+02')
  on conflict (id) do nothing;

  -- ── DV-2026-0017 — expiré depuis le 6 août ─────────────────────────────────────────────────
  -- Un particulier qui a demandé un délai de réflexion : les relances ont été coupées **sur ce
  -- document** (`relances_actives = false`), le devis a suivi son cours et le cron `expirer_devis`
  -- l'aurait basculé en « expiré ». On pose directement l'état final, parce que ce même cron
  -- écarte volontairement les ateliers de démonstration — leur décor ne doit pas vieillir tout
  -- seul sous les yeux des visiteurs.
  insert into public.devis (
    id, atelier_id, client_id, numero, status, items, total_ht, total_tva, total_ttc,
    notes, validite_jours, public_token, envoye_at, relance_count, derniere_relance_at,
    relances_actives, created_by, created_at, updated_at)
  values (
    'd0000000-0000-4000-8000-000000000046', v_atelier, v_julien, 'DV-2026-0017', 'expire',
    jsonb_build_array(
      jsonb_build_object(
        'type', 'm2', 'libelle', 'Thermolaquage volets battants (4 paires)', 'unite', 'm2',
        'qte', 7.8, 'pu_ht', 39.90, 'tva', 20, 'total_ht', 311.22,
        'meta', jsonb_build_object('surface', 7.8, 'couche', '1', 'finition', 'mat',
                                   'complexite', 'simple', 'grille_id', v_grille)),
      jsonb_build_object(
        'type', 'prestation', 'libelle', 'Décapage chimique', 'unite', 'm2',
        'qte', 7.8, 'pu_ht', 12.00, 'tva', 20, 'total_ht', 93.60)),
    404.82, 80.96, 485.78,
    'Le client souhaite réfléchir avant les vacances — relances coupées à sa demande.',
    30, '6c2fae1948d370b5e8c94a1d2f60b783',
    '2026-07-07 16:00:00+02', 0, null,
    false, v_karim, '2026-07-07 13:05:00+02', '2026-08-07 06:50:00+02')
  on conflict (id) do nothing;

  -- Le compteur suit, sinon le prochain devis créé dans la démonstration porterait DV-2026-0016
  -- et se heurterait à l'unicité du numéro. `greatest` : on n'abaisse jamais un compteur.
  update public.compteurs
     set valeur = greatest(valeur, 17)
   where atelier_id = v_atelier and doc_type = 'devis' and annee = 2026;

  -- ── Les trois relances de DV-2026-0016, avec leur message ──────────────────────────────────
  -- POURQUOI les écrire. Le devis annonce `relance_count = 3` : sans ces lignes, sa fiche dirait
  -- « 3 relances déjà envoyées » au-dessus d'une liste vide, et l'écran /relances ne les
  -- montrerait pas. Un compteur qui ne correspond à aucune trace est précisément le défaut qu'on
  -- vient de corriger ailleurs.
  --
  -- Les notifications sont posées en `status = 'sent'` avec leur `sent_at` : `process_notifications`
  -- ne ramasse que les `pending`, **aucun courriel ne partira**. Les adresses de la démonstration
  -- pointent d'ailleurs vers des domaines qui n'existent pas.
  insert into public.notifications (id, atelier_id, destinataire_email, template, payload, status, scheduled_at, sent_at, created_at)
  values
    ('d0000000-0000-4000-8000-000000000091', v_atelier, 'contact@aluform-demo.fr', 'devis_relance',
     jsonb_build_object('devis_numero', 'DV-2026-0016', 'total_ttc', 5494.80,
                        'public_token', 'b41d90c7e5a83f26d0c1b7e492af5310'),
     'sent', '2026-06-28 09:00:00+02', '2026-06-28 09:05:00+02', '2026-06-28 09:00:00+02'),
    ('d0000000-0000-4000-8000-000000000092', v_atelier, 'contact@aluform-demo.fr', 'devis_relance',
     jsonb_build_object('devis_numero', 'DV-2026-0016', 'total_ttc', 5494.80,
                        'public_token', 'b41d90c7e5a83f26d0c1b7e492af5310'),
     'sent', '2026-07-01 09:00:00+02', '2026-07-01 09:05:00+02', '2026-07-01 09:00:00+02'),
    ('d0000000-0000-4000-8000-000000000093', v_atelier, 'contact@aluform-demo.fr', 'devis_relance',
     jsonb_build_object('devis_numero', 'DV-2026-0016', 'total_ttc', 5494.80,
                        'public_token', 'b41d90c7e5a83f26d0c1b7e492af5310'),
     'sent', '2026-07-04 09:00:00+02', '2026-07-04 09:05:00+02', '2026-07-04 09:00:00+02')
  on conflict (id) do nothing;

  insert into public.relances (id, atelier_id, document_type, document_id, canal, template, sent_at, notification_id)
  values
    ('d0000000-0000-4000-8000-0000000000a1', v_atelier, 'devis', 'd0000000-0000-4000-8000-000000000045',
     'email', 'devis_relance', '2026-06-28 09:00:00+02', 'd0000000-0000-4000-8000-000000000091'),
    ('d0000000-0000-4000-8000-0000000000a2', v_atelier, 'devis', 'd0000000-0000-4000-8000-000000000045',
     'email', 'devis_relance', '2026-07-01 09:00:00+02', 'd0000000-0000-4000-8000-000000000092'),
    ('d0000000-0000-4000-8000-0000000000a3', v_atelier, 'devis', 'd0000000-0000-4000-8000-000000000045',
     'email', 'devis_relance', '2026-07-04 09:00:00+02', 'd0000000-0000-4000-8000-000000000093')
  on conflict (id) do nothing;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- 3. Quatre vraies modifications → quatre vraies lignes de journal
  --
  -- On ne fabrique aucune ligne d'`audit_logs`. On provoque les modifications, et c'est le
  -- trigger `trg_journal` qui écrit ce qu'il constate — même chemin, même format, mêmes valeurs
  -- « avant / après » que si Karim les avait saisies à l'écran. C'est la seule façon d'obtenir un
  -- historique qui tienne devant quelqu'un qui le lit vraiment.
  --
  -- Une par type de fiche, parce que le panneau « Historique » existe sur les quatre et qu'il
  -- était vide sur les quatre. Chaque `where` teste l'ancienne valeur : rejouer la migration ne
  -- produit pas de seconde ligne.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════

  -- FICHE CLIENT — l'adresse corrigée. Le cas d'école : le client déménage dans la même zone
  -- industrielle, quelqu'un s'en aperçoit sur un bon de livraison, et la fiche est reprise.
  update public.clients
     set adresse = 'ZI des Paluds, 12 avenue Ampère'
   where id = v_aluform and adresse = 'ZI des Paluds, 8 avenue Ampère';

  -- DEVIS — le total qui bouge. Julien Bernard rappelle pour ajouter le sablage du portail avant
  -- laquage : une ligne de plus, et un total qui passe de 220,25 € à 297,53 € TTC. Le devis est
  -- encore un brouillon, donc modifiable — `trg_figer_document` refuserait la même écriture sur
  -- un devis signé, et c'est très bien ainsi.
  update public.devis
     set items = items || jsonb_build_array(jsonb_build_object(
           'type', 'prestation', 'libelle', 'Sablage / grenaillage', 'unite', 'm2',
           'qte', 4.6, 'pu_ht', 14.00, 'tva', 20, 'total_ht', 64.40)),
         total_ht  = 247.94,
         total_tva = 49.59,
         total_ttc = 297.53
   where id = 'd0000000-0000-4000-8000-000000000044'
     and status = 'brouillon'
     and jsonb_array_length(items) = 1;

  -- CHANTIER — la date promise repoussée. Le chantier ALUFORM était promis pour aujourd'hui et
  -- en est encore au poudrage : le client a accepté quatre jours de plus. Cette écriture rend
  -- aussi service à la démonstration elle-même — sans elle, la vitrine afficherait dès demain un
  -- chantier en retard, ce qui n'est pas l'image qu'on veut donner d'un atelier.
  update public.projets
     set date_promise = date '2026-08-25'
   where id = 'd0000000-0000-4000-8000-000000000051'
     and date_promise = date '2026-08-21';

  -- FACTURE — les relances coupées sur un document précis. L'acompte ALUFORM est impayé et a
  -- déjà été relancé une fois ; un échange téléphonique a fixé une date de règlement, donc on
  -- arrête la machine sur cette facture-là — sans exclure le client de toutes les relances. Ce
  -- geste est exactement ce que le bouton « Ne plus relancer ce document » déclenche, et la
  -- fiche l'affichera. `relances_actives` ne fait pas partie des colonnes gelées par
  -- `trg_figer_document` sur une facture émise : le montant est verrouillé, pas le suivi.
  update public.factures
     set relances_actives = false
   where id = 'd0000000-0000-4000-8000-000000000073'
     and relances_actives;
end
$semis$;
