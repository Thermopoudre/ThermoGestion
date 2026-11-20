-- =============================================================================================
-- 73 — Amélioration n°4 (07/09) : la démo ne prouvait pas ses deux fonctions vedettes de la v3.
--
-- CONSTATS, prouvés en base avant cette migration (repris tels quels dans AMELIORATIONS-07-09-2026.md) :
--   1. `select count(*) filter (where acompte_pct > 0) from devis` → 0 sur 14. Aucun devis signé
--      avec acompte, donc aucune facture d'acompte visible « en marche ».
--   2. `select count(*) from users_couts` → 0 ligne. Le taux horaire par personne (C2) n'alimentait
--      ni `projet_temps_cout` ni `projet_revient` : `temps_etapes.user_id` est NULL sur les QUATRE
--      lignes de temps de cet atelier, donc même en posant un taux, rien ne le consommerait — ce que
--      la mission demandait explicitement de vérifier plutôt que supposer.
--   3. Les 7 devis signés de la démo sont tous `pro`. Les mentions médiateur/rétractation (C6)
--      n'apparaissent jamais « en marche » sur un devis réellement signé par un particulier — et
--      `ateliers.mediateur_nom` était NULL, donc même un devis particulier signé n'aurait affiché que
--      l'avertissement « non renseigné », pas la mention elle-même.
--   4. `bons_livraison` : une seule ligne, statut `facture`. Les onglets « À livrer » et « À facturer »
--      de `/bl` n'avaient rien à montrer (l'onglet « Livrés » a été corrigé par ailleurs, n°5).
--   5. (à l'appréciation, cf. l'amélioration) : aucun `jeux_jantes` de la démo ne porte `devis_id` ni
--      `projet_id` — le parcours « devis avec ligne Jeu de jantes → projet jantes » n'est jamais
--      démontré de bout en bout, alors que `trg_devis_signe()` sait déjà le faire.
--
-- CE QUI EST SEMÉ, et rien d'autre :
--   A. Un taux horaire pour Karim B. (le seul compte réel de cet atelier — voir note plus bas) et le
--      raccrochement de `temps_etapes.user_id` aux quatre lignes de temps existantes, pour que le
--      taux personnel remonte réellement dans `projet_temps_cout` puis `projet_revient`.
--   B. Un médiateur de la consommation posé sur l'atelier, pour que la mention B2C affiche une vraie
--      valeur et non l'avertissement « non renseigné ».
--   C. DV-2026-0047 (Menuiserie ALUFORM, pro) : signé, acompte 30 %, avec sa facture d'acompte émise
--      — le mécanisme complet, y compris la déduction attendue sur la facture de solde.
--   D. DV-2026-0048 (Julien Bernard, particulier) : signé hors établissement — la mention de
--      rétractation ferme (14 jours) s'affiche, pas la formulation au conditionnel.
--   E. Un troisième jeu de jantes (JJ, BMW de Garage Piston & Fils déjà connue) rattaché à
--      DV-2026-0049 dès sa création, puis signé : `trg_devis_signe()` ouvre le projet, le classe
--      `type_piece = 'jante'` et relie le jeu au projet — le parcours entier, sans rien construire à
--      la main que le trigger sait déjà faire.
--   F. Deux bons de livraison aux statuts manquants : un `emis` (À livrer) et un `livre` non facturé
--      (À facturer). Non rattachés à un projet existant — voir la note en tête de la section F.
--
-- MÉCANIQUE DU VERROU DE DÉMO, COMME EN MIGRATION 47. `trg_interdire_ecriture_demo` lit le rôle dans
-- `request.jwt.claims` et laisse passer une connexion sans aucun claim de rôle — le cas de cette
-- migration, exécutée sous `postgres`. On ne désactive rien : le verrou n'a simplement rien à
-- refuser. Seul `request.jwt.claims->>'sub'` est posé (portée transaction, `set_config(..., true)`),
-- pour que `auth.uid()` réponde et que `trg_journal` signe les écritures au nom de Karim et non « Le
-- logiciel » — exactement pour la même raison qu'en migration 47.
--
-- LA SIGNATURE PASSE PAR UN VRAI `UPDATE`, PAS PAR UN `INSERT` DIRECT EN `signe`. Vérifié en base :
-- `trg_devis_signe` n'est posé qu'en `AFTER UPDATE` sur `devis` (jamais en `AFTER INSERT`) — c'est
-- d'ailleurs pour ça que les devis 41/42, insérés directement en `signe` par le seed d'origine,
-- n'ont jamais généré de notification `devis_signe` alors que la fonction existe. Pour que le
-- projet, le classement `type_piece` et le raccrochage du jeu de jantes se fassent par le même code
-- que la vraie signature (et non une resaisie manuelle qui pourrait diverger), chaque devis de cette
-- migration est d'abord inséré `envoye`, puis basculé `signe` par un `UPDATE` — ce qui déclenche
-- `trg_devis_signe` pour de vrai. La notification `devis_signe` que le trigger pose alors (statut
-- `pending`, vers `contact@atelier-demo.fr`, un domaine qui n'existe pas) est ensuite neutralisée en
-- `sent` avec une date passée, exactement comme les relances de la migration 47 : aucun courriel ne
-- part, et rejouer la migration ne la double pas puisque le bloc qui la crée est gardé par
-- `if not exists`.
--
-- UN SEUL COMPTE RÉEL DANS CET ATELIER. `select * from users where atelier_id = <démo>` ne rend
-- qu'une ligne (Karim B., owner) — `users.id` référence `auth.users(id)`, fabriquer un second
-- « membre » supposerait un second compte applicatif, hors du périmètre « travail de données » de
-- cette migration. Le taux horaire posé ci-dessous est donc celui du seul compte existant ; la
-- preuve demandée (le taux personnel prime sur le taux d'atelier dans le calcul) tient très bien
-- avec une seule personne, du moment que `temps_etapes.user_id` la désigne réellement — ce qui est
-- précisément ce que corrige la section A, puisqu'aucune ligne de temps ne portait de `user_id`.
--
-- SECTION F — POURQUOI LES DEUX NOUVEAUX BL NE PORTENT PAS DE `projet_id`. Les projets déjà en
-- cours de cet atelier ont un statut qui contredirait le statut du BL à ajouter (le seul projet
-- « prêt » a déjà une facture, le seul projet « en_cours » n'est pas encore livrable) : y accrocher
-- un BL `livre` ou `emis` aurait fabriqué une contradiction visible sur la fiche projet, exactement
-- ce que la mission demande d'éviter. `bons_livraison.projet_id` est nullable pour cette raison
-- précise (petites pièces livrées sans dossier de production dédié) : les deux BL ci-dessous
-- représentent ce cas, réaliste pour un atelier qui fait aussi de la pièce au coup par coup.
--
-- IDEMPOTENCE. Chaque bloc est gardé par `if not exists (select 1 from ... where id = ...)` sur son
-- identifiant fixe (`d0000000-0000-4000-8000-0000000000xx`), comme la convention déjà en place.
-- Rejouer la migration ne crée aucun doublon, n'appelle pas deux fois `_next_numero()` et ne pousse
-- pas deux fois `temps_etapes.user_id` (la condition `user_id is null` ne retrouve plus rien après
-- le premier passage).
-- =============================================================================================

do $semis$
declare
  v_atelier        constant uuid := 'df1ee297-3232-4a81-a7d8-f7734b699f90';  -- Atelier Démo Thermolaquage
  v_karim          constant uuid := 'dddddddd-0000-4000-8000-000000000001';  -- Karim B., seul compte réel
  v_aluform        constant uuid := 'd0000000-0000-4000-8000-000000000021';  -- Menuiserie ALUFORM
  v_piston         constant uuid := 'd0000000-0000-4000-8000-000000000022';  -- Garage Piston & Fils
  v_julien         constant uuid := 'd0000000-0000-4000-8000-000000000024';  -- Julien Bernard (particulier)
  v_grille         constant uuid := 'd0000000-0000-4000-8000-000000000001';  -- grille tarifaire par défaut
  v_vehicule_bmw   constant uuid := 'd0000000-0000-4000-8000-0000000000a1';  -- BMW Série 3 M Sport, déjà liée à JJ-2026-0001

  v_devis_aluform  constant uuid := 'd0000000-0000-4000-8000-000000000047';
  v_devis_julien   constant uuid := 'd0000000-0000-4000-8000-000000000048';
  v_devis_piston   constant uuid := 'd0000000-0000-4000-8000-000000000049';
  v_facture_acompte constant uuid := 'd0000000-0000-4000-8000-000000000074';
  v_jeu_piston2    constant uuid := 'd0000000-0000-4000-8000-0000000000b3';
  v_bl_emis        constant uuid := 'd0000000-0000-4000-8000-000000000062';
  v_bl_livre       constant uuid := 'd0000000-0000-4000-8000-000000000063';

  v_numero text;
begin
  -- Garde-fou identique à la migration 47 : on écrit dans un atelier de production, se tromper de
  -- cible n'est pas une option qu'on rattrape.
  if not exists (select 1 from public.ateliers where id = v_atelier and demo) then
    raise exception 'Atelier de démonstration introuvable ou non marqué demo : rien n''a été écrit.';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_karim)::text, true);

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- A. Taux horaire personnel (C2) — ET son raccordement réel à projet_temps_cout
  -- ═══════════════════════════════════════════════════════════════════════════════════════════

  insert into public.users_couts (user_id, atelier_id, taux_horaire)
  values (v_karim, v_atelier, 42.00)
  on conflict (user_id) do nothing;

  -- Sans ceci, `projet_temps_cout` ne consulte JAMAIS `users_couts` : les quatre lignes de temps de
  -- cet atelier ont `user_id is null`, donc `left join users_couts uc on uc.user_id = t.user_id` ne
  -- matche rien et le calcul retombe silencieusement sur `ateliers_couts.taux_horaire` (48 €/h) —
  -- poser un taux personnel sans corriger ceci aurait laissé la preuve invisible, ce que la mission
  -- demandait explicitement de vérifier.
  update public.temps_etapes
     set user_id = v_karim
   where atelier_id = v_atelier and user_id is null;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- B. Médiateur de la consommation (C6) — pour que la mention B2C affiche une vraie valeur
  -- ═══════════════════════════════════════════════════════════════════════════════════════════

  update public.ateliers
     set mediateur_nom = 'Médiateur de la consommation FFB',
         mediateur_adresse = '33 avenue Kléber, 75784 Paris Cedex 16'
   where id = v_atelier and mediateur_nom is null;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- C. DV-2026-0047 — Menuiserie ALUFORM (pro), acompte 30 % à la commande + facture d'acompte
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.devis where id = v_devis_aluform) then
    select public._next_numero(v_atelier, 'devis') into v_numero;

    insert into public.devis (
      id, atelier_id, client_id, numero, status, items, total_ht, total_tva, total_ttc,
      notes, validite_jours, acompte_pct, envoye_at, created_by, created_at, updated_at)
    values (
      v_devis_aluform, v_atelier, v_aluform, v_numero, 'envoye',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'm2', 'libelle', 'Thermolaquage portail coulissant + rambarde', 'unite', 'm2',
          'qte', 54, 'pu_ht', 33.50, 'tva', 20, 'total_ht', 1809.00,
          'meta', jsonb_build_object('surface', 54, 'couche', '1', 'finition', 'satine',
                                     'complexite', 'moyenne', 'grille_id', v_grille)),
        jsonb_build_object(
          'type', 'prestation', 'libelle', 'Sablage / grenaillage', 'unite', 'm2',
          'qte', 54, 'pu_ht', 14.00, 'tva', 20, 'total_ht', 756.00)),
      2565.00, 513.00, 3078.00,
      'Portail coulissant 5 m + rambarde neuve — 2 rotations prévues à l''enlèvement.',
      30, 30, '2026-08-24 09:05:00+02', v_karim, '2026-08-24 09:00:00+02', '2026-08-24 09:05:00+02')
    on conflict (id) do nothing;

    update public.devis
       set status = 'signe', signed_at = '2026-08-26 11:30:00+02', signed_by = 'Sophie Vidal',
           signature_hors_etablissement = false
     where id = v_devis_aluform and status = 'envoye';

    -- Neutralise la notification que `trg_devis_signe` vient de poser (voir en-tête de fichier) :
    -- aucun courriel ne doit partir vers un domaine de démonstration qui n'existe pas.
    update public.notifications
       set status = 'sent', sent_at = '2026-08-26 11:35:00+02'
     where atelier_id = v_atelier and template = 'devis_signe' and status = 'pending'
       and payload ->> 'devis_numero' = v_numero;

    -- Facture d'acompte, même style d'écriture que FA-2026-0030 (migration d'origine) : une seule
    -- ligne `libre` au forfait, jamais de type `acompte` sur l'item lui-même.
    select public._next_numero(v_atelier, 'facture') into v_numero;
    insert into public.factures (
      id, atelier_id, client_id, devis_id, numero, type, status, items,
      total_ht, total_tva, total_ttc, due_date, emise_at, created_by, created_at, updated_at)
    values (
      v_facture_acompte, v_atelier, v_aluform, v_devis_aluform, v_numero, 'acompte', 'emise',
      jsonb_build_array(jsonb_build_object(
        'type', 'libre', 'libelle', 'Acompte 30 % sur devis DV-2026-0047', 'unite', 'forfait',
        'qte', 1, 'pu_ht', 769.50, 'tva', 20, 'total_ht', 769.50)),
      769.50, 153.90, 923.40, '2026-09-25', '2026-08-26 14:00:00+02',
      v_karim, '2026-08-26 13:55:00+02', '2026-08-26 14:00:00+02')
    on conflict (id) do nothing;
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- D. DV-2026-0048 — Julien Bernard (particulier), signé hors établissement
  --
  -- POURQUOI hors établissement. `signature_hors_etablissement = true` est la seule condition qui
  -- fait passer la mention de rétractation de la formulation au conditionnel (« si ce devis a été
  -- signé hors établissement ») à la mention ferme des 14 jours (art. L221-18) — voir
  -- `DevisPublicClient.tsx` et `pdf/document.tsx`. Un rendez-vous à domicile pour la prise de
  -- mesure, cas courant en thermolaquage de garde-corps/portails résidentiels, justifie la case.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.devis where id = v_devis_julien) then
    select public._next_numero(v_atelier, 'devis') into v_numero;

    insert into public.devis (
      id, atelier_id, client_id, numero, status, items, total_ht, total_tva, total_ttc,
      notes, validite_jours, envoye_at, created_by, created_at, updated_at)
    values (
      v_devis_julien, v_atelier, v_julien, v_numero, 'envoye',
      jsonb_build_array(
        jsonb_build_object(
          'type', 'm2', 'libelle', 'Thermolaquage garde-corps de balcon', 'unite', 'm2',
          'qte', 6.2, 'pu_ht', 39.90, 'tva', 20, 'total_ht', 247.38,
          'meta', jsonb_build_object('surface', 6.2, 'couche', '1', 'finition', 'satine',
                                     'complexite', 'simple', 'grille_id', v_grille)),
        jsonb_build_object(
          'type', 'prestation', 'libelle', 'Décapage chimique', 'unite', 'm2',
          'qte', 6.2, 'pu_ht', 12.00, 'tva', 20, 'total_ht', 74.40)),
      321.78, 64.36, 386.14,
      'Rendez-vous à domicile pour la prise de mesure et la signature du devis.',
      30, '2026-08-29 10:05:00+02', v_karim, '2026-08-29 10:00:00+02', '2026-08-29 10:05:00+02')
    on conflict (id) do nothing;

    update public.devis
       set status = 'signe', signed_at = '2026-08-30 18:20:00+02', signed_by = 'Julien Bernard',
           signature_hors_etablissement = true
     where id = v_devis_julien and status = 'envoye';

    update public.notifications
       set status = 'sent', sent_at = '2026-08-30 18:25:00+02'
     where atelier_id = v_atelier and template = 'devis_signe' and status = 'pending'
       and payload ->> 'devis_numero' = v_numero;
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- E. Jeu de jantes → devis → signature → projet, le parcours entier
  --
  -- Le jeu est inséré AVANT la signature, avec `devis_id` déjà posé et `projet_id` encore NULL :
  -- c'est exactement la condition que `trg_devis_signe()` recherche (`update jeux_jantes set
  -- projet_id = v_projet_id where devis_id = new.id and projet_id is null`) pour le raccrocher tout
  -- seul au projet qu'il vient de créer. Même véhicule que JJ-2026-0001 (BMW Série 3 M Sport,
  -- immatriculation déjà en base) : le client change de teinte sur un second train de jantes,
  -- scénario courant (jeu été/hiver) plutôt qu'un second véhicule inventé sans raison.
  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  if not exists (select 1 from public.devis where id = v_devis_piston) then
    select public._next_numero(v_atelier, 'devis') into v_numero;

    insert into public.devis (
      id, atelier_id, client_id, numero, status, items, total_ht, total_tva, total_ttc,
      notes, validite_jours, envoye_at, created_by, created_at, updated_at)
    values (
      v_devis_piston, v_atelier, v_piston, v_numero, 'envoye',
      jsonb_build_array(jsonb_build_object(
        'type', 'libre',
        'libelle', 'Jeu de 4 jantes 19″ — BMW Série 3 M Sport (2021) — teinte Anthracite Satin — vernis de protection',
        'qte', 4, 'unite', 'jante', 'pu_ht', 151.80, 'tva', 20, 'total_ht', 607.20,
        'meta', jsonb_build_object(
          'jante', true, 'jeu_jantes_id', v_jeu_piston2, 'vehicule_id', v_vehicule_bmw,
          'diametre_pouces', 19, 'dessin', 'standard', 'finition', 'vernis',
          'teinte', 'Anthracite Satin', 'teinte_reference', null, 'surface_m2', 1.10,
          'grille_id', v_grille))),
      607.20, 121.44, 728.64,
      'Second train de jantes (jeu hiver) — le client change de teinte, ne reprend pas l''origine constructeur.',
      30, '2026-09-01 09:05:00+02', v_karim, '2026-09-01 09:00:00+02', '2026-09-01 09:05:00+02')
    on conflict (id) do nothing;

    insert into public.jeux_jantes (
      id, atelier_id, client_id, vehicule_id, devis_id, numero, nb_jantes,
      diametre_pouces, largeur_pouces, dessin, finition, teinte, pneus_montes, tpms,
      statut, date_promise, depose_par, note, created_by, created_at, updated_at)
    values (
      v_jeu_piston2, v_atelier, v_piston, v_vehicule_bmw, v_devis_piston,
      (select public._next_numero(v_atelier, 'jantes')),
      4, 19, 8.5, 'standard', 'vernis', 'Anthracite Satin', false, false,
      'recu', '2026-09-13', 'Karim Bensaïd',
      'Jeu hiver — teinte différente de l''origine (Frozen Grey) : voir DV-2026-0049.',
      v_karim, '2026-09-01 09:10:00+02', '2026-09-01 09:10:00+02')
    on conflict (id) do nothing;

    update public.devis
       set status = 'signe', signed_at = '2026-09-03 10:15:00+02', signed_by = 'Karim Bensaïd',
           signature_hors_etablissement = false
     where id = v_devis_piston and status = 'envoye';

    update public.notifications
       set status = 'sent', sent_at = '2026-09-03 10:20:00+02'
     where atelier_id = v_atelier and template = 'devis_signe' and status = 'pending'
       and payload ->> 'devis_numero' = v_numero;
  end if;

  -- ═══════════════════════════════════════════════════════════════════════════════════════════
  -- F. Deux bons de livraison aux statuts manquants — voir la note en tête de fichier
  -- ═══════════════════════════════════════════════════════════════════════════════════════════

  if not exists (select 1 from public.bons_livraison where id = v_bl_emis) then
    select public._next_numero(v_atelier, 'bl') into v_numero;
    insert into public.bons_livraison (
      id, atelier_id, client_id, numero, status, lignes, nb_colis, poids_kg, created_at)
    values (
      v_bl_emis, v_atelier, v_piston, v_numero, 'emis',
      jsonb_build_array(jsonb_build_object(
        'type', 'prestation', 'libelle', 'Thermolaquage platines supports moteur (lot de 2)',
        'unite', 'piece', 'qte', 2, 'pu_ht', 34.50, 'tva', 20, 'total_ht', 69.00)),
      1, 6.0, '2026-09-02 09:00:00+02')
    on conflict (id) do nothing;
  end if;

  if not exists (select 1 from public.bons_livraison where id = v_bl_livre) then
    select public._next_numero(v_atelier, 'bl') into v_numero;
    insert into public.bons_livraison (
      id, atelier_id, client_id, numero, status, lignes, nb_colis, poids_kg,
      livre_at, recu_par, created_at)
    values (
      v_bl_livre, v_atelier, 'd0000000-0000-4000-8000-000000000023', v_numero, 'livre',
      jsonb_build_array(jsonb_build_object(
        'type', 'm2', 'libelle', 'Thermolaquage cornières (structure escalier)', 'unite', 'm2',
        'qte', 2.6, 'pu_ht', 31.90, 'tva', 20, 'total_ht', 82.94)),
      1, 9.0, '2026-09-03 15:30:00+02', 'Amélie Roques', '2026-09-03 09:15:00+02')
    on conflict (id) do nothing;
  end if;
end
$semis$;
