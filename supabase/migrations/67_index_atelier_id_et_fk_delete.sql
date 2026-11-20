-- Amélioration n°6 du 07/09/2026 (AMELIORATIONS-07-09-2026.md) : indexer les FK sans index
-- couvrant listées par `get_advisors` (performance), en priorité les `atelier_id` — la colonne
-- que TOUTE policy RLS de cette base multi-atelier filtre en premier. Sans index, un scan qui
-- coûte 14 lignes aujourd'hui (2 ateliers de démo) en coûtera des dizaines de milliers le jour où
-- plusieurs vrais ateliers cohabiteront dans les mêmes tables.
--
-- Méthode : liste reprise de `get_advisors('performance')` relancé le 07/09/2026 (pas du document,
-- qui datait de la même journée mais pouvait déjà être légèrement en retard sur la base), puis
-- confrontée aux requêtes réelles de `src/` pour choisir entre un index simple sur `atelier_id`
-- et un index composite couvrant aussi le filtre/tri effectivement utilisé par l'écran. Aucun
-- index n'est posé « parce que l'advisor le dit » sans avoir vérifié qu'il sert une requête réelle
-- ou un `DELETE` de la table parente qui a effectivement lieu (voir détail par index ci-dessous).
--
-- `create index concurrently` est impossible ici : `apply_migration` exécute cette migration dans
-- une transaction, et `CONCURRENTLY` ne peut pas s'exécuter à l'intérieur d'une transaction. Les
-- tables visées sont minuscules aujourd'hui (0 à 40 lignes selon `pg_stat_user_tables`), donc le
-- verrou `ACCESS EXCLUSIVE` bref d'un `CREATE INDEX` ordinaire est sans risque maintenant. Le jour
-- où la volumétrie sera réelle, un nouvel index sur une table déjà grosse devra être posé avec
-- `CREATE INDEX CONCURRENTLY` en dehors d'une transaction (script à part, pas `apply_migration`).

-- ── 1. Colonnes `atelier_id` sans index couvrant (RLS) ─────────────────────────────────────────

-- `fournee_projets` : `src/app/(app)/fournees/Contenu.tsx` et `fournees/[id]/page.tsx` chargent
-- `select("projet_id, fournees(statut)")` SANS aucun `.eq()` — la portée à l'atelier ne vient que
-- de la RLS. Sans index sur `atelier_id`, cette lecture (faite à chaque ouverture de l'écran
-- Fournées) est un scan complet de la table pour ne garder que les lignes de l'atelier courant.
create index if not exists fournee_projets_atelier_idx on public.fournee_projets(atelier_id);

-- `instruments` : même défaut, plusieurs écrans (`ControleForm.tsx`, `qualite/Contenu.tsx`,
-- `qualite/instruments/Contenu.tsx`, `CertificatProjet.tsx`, `api/pdf/certificat`) font
-- `select("*")` sans autre filtre que la RLS.
create index if not exists instruments_atelier_idx on public.instruments(atelier_id);

-- `commande_poudre_lignes` : `src/app/(app)/commandes/page.tsx` fait
-- `select("*").order("reference")` sans autre filtre — composite pour couvrir le tri en plus du
-- filtre RLS, plutôt qu'un index simple qui laisserait le tri à la charge d'un `Sort` séparé.
create index if not exists commande_poudre_lignes_atelier_ref_idx
  on public.commande_poudre_lignes(atelier_id, reference);

-- `grille_coefs` : `DevisEditor.tsx` (ouvert à chaque devis créé ou modifié — écran à très forte
-- fréquence d'usage) charge `select("*")` sans filtre `grille_id`, pour construire le barème
-- complet de l'atelier côté client. C'est exactement le cas visé par l'advisor : sans cet index,
-- chaque ouverture de l'éditeur de devis scanne toute la table.
create index if not exists grille_coefs_atelier_idx on public.grille_coefs(atelier_id);

-- `grille_paliers` : même écran, même défaut, avec en plus un tri `.order("surface_min")` --
-- composite pour couvrir les deux d'un coup.
create index if not exists grille_paliers_atelier_surface_idx
  on public.grille_paliers(atelier_id, surface_min);

-- `jante_paliers` : même défaut dans `DevisEditor.tsx`, `jantes/new/page.tsx` et
-- `jantes/[id]/page.tsx`, avec un tri `.order("diametre_min")`.
create index if not exists jante_paliers_atelier_diametre_idx
  on public.jante_paliers(atelier_id, diametre_min);

-- Volontairement PAS indexées malgré l'alerte de l'advisor :
--   - `jantes.atelier_id` : `grep` ne montre aucune lecture directe de `jantes` par atelier — la
--     table n'est jamais lue autrement qu'imbriquée sous `jeux_jantes` (`select("*, jantes(*)")`),
--     via `jeu_id`, déjà couvert par `jantes_jeu_idx`. L'atelier est déjà borné par la RLS de
--     `jeux_jantes` en amont ; ajouter l'index n'accélérerait aucune requête existante.
--   - `photos.atelier_id` : toutes les lectures passent par `projet_id`, `jante_id`,
--     `jeu_jantes_id` ou `reception_id`, chacun déjà indexé individuellement
--     (`photos_projet_idx`, `photos_jante_idx`, `photos_jeu_idx`, `photos_reception_idx`). Aucune
--     requête « toutes les photos de l'atelier » n'existe dans `src/`.

-- ── 2. FK non-`atelier_id` : un `DELETE` de la table parente sans index sur l'enfant coûte cher ─

-- `controles.projet_id` (FK `ON DELETE CASCADE` depuis `projets`) : `CertificatProjet.tsx` et
-- `api/pdf/certificat/[id]/route.ts` font `select("*").eq("projet_id", ...)` — une lecture directe
-- sans index aujourd'hui. En plus, `purger_corbeille()` supprime réellement les projets hors délai
-- de corbeille : chaque suppression déclenche la cascade sur `controles`, qui scannerait toute la
-- table sans cet index. Composite avec `atelier_id` en tête : sert à la fois le filtre RLS et le
-- filtre `projet_id` explicite de l'écran.
create index if not exists controles_atelier_projet_idx on public.controles(atelier_id, projet_id);

-- `jeux_jantes.devis_id` (FK `ON DELETE SET NULL` depuis `devis`) : `devis` est purgé par
-- `purger_corbeille()` comme les projets. Aucun index n'existe aujourd'hui sur cette colonne.
create index if not exists jeux_jantes_devis_idx on public.jeux_jantes(devis_id);

-- `jeux_jantes.client_id` (FK `ON DELETE RESTRICT` depuis `clients`, aussi purgés) : l'index
-- composite `jeux_jantes_client_idx` existe déjà sur `(atelier_id, client_id)`, mais un `DELETE`
-- sur `clients` ne connaît que `client_id` — un index dont `atelier_id` est la colonne de tête ne
-- sert pas cette recherche (règle du préfixe gauche d'un btree). D'où un second index, dédié à la
-- FK, avec `client_id` seul en tête.
create index if not exists jeux_jantes_client_id_seul_idx on public.jeux_jantes(client_id);

-- `vehicules.client_id` (FK `ON DELETE SET NULL` depuis `clients`) : même raisonnement que
-- ci-dessus — `vehicules_client_idx` existant est `(atelier_id, client_id)`, pas exploitable pour
-- une recherche par `client_id` seul lors de la purge d'un client.
create index if not exists vehicules_client_id_seul_idx on public.vehicules(client_id);

-- `stock_mouvements.projet_id` (FK `ON DELETE SET NULL` depuis `projets`) : `stock_mouvements` n'a
-- aucune purge et grossit indéfiniment (un mouvement par réception, conso, pesée...). Les projets,
-- eux, sont purgés chaque nuit hors délai de corbeille : sans index, chaque suppression de projet
-- scanne l'intégralité de cette table, qui grossit pendant que les projets tournent.
create index if not exists stock_mouvements_projet_idx on public.stock_mouvements(projet_id);

-- `temps_etapes.user_id` (FK `ON DELETE SET NULL` depuis `users`) : le pointage s'accumule sans
-- purge (un pointage par étape et par opérateur, indéfiniment), alors que la suppression d'un
-- compte utilisateur (départ d'un salarié) est une opération réelle et prévue (cf. la convention
-- `created_by_on_delete_set_null` déjà posée ailleurs sur le schéma).
create index if not exists temps_etapes_user_idx on public.temps_etapes(user_id);

-- Volontairement PAS indexées, malgré l'alerte de l'advisor (à réévaluer si l'usage change) :
--   - `client_portail_meme_atelier`, `client_portail_ouvert_par_fkey` : `client_portail` reste par
--     nature aussi petite que la table `clients` (une ligne par client ayant ouvert son portail) ;
--     une purge en cascade y reste triviale même sans index.
--   - `client_tarifs_prestation_id_fkey`, `clients_grille_id_fkey` : `prestations` et les grilles
--     tarifaires sont des référentiels quasi statiques, jamais supprimés en pratique.
--   - `controles_fournee_id_fkey`, `controles_instrument_id_fkey`, `controles_operateur_id_fkey`,
--     `controles_referentiel_id_fkey`, `controles_bains_operateur_id_fkey`,
--     `non_conformites_fournee_id_fkey` : ni `fournees`, ni `instruments`, ni les référentiels ne
--     sont purgés, et aucune lecture directe par ces colonnes n'apparaît dans `src/` (toujours via
--     `projet_id`, déjà traité ci-dessus).
--   - `dechets_created_by_fkey`, `exports_comptables_remis_par_fkey`,
--     `pieces_jointes_created_by_fkey` : tables à très faible volumétrie (`pieces_jointes` est
--     vide), pas de preuve d'un `DELETE` d'utilisateur fréquent qui les toucherait à un coût
--     mesurable.
--   - `jeux_jantes_poudre_id_fkey`, `stock_mouvements_lot_id_fkey`, `commande_poudre_lignes_poudre_id_fkey`,
--     `fournees_poudre_id_fkey`, `vehicules_poudre_id_fkey` : les poudres ne sont pas supprimées en
--     pratique (elles sont désactivées via `actif = false`), donc pas de `DELETE` parent à
--     accélérer.
--   - `relances_notification_id_fkey` : aucune lecture par `notification_id` dans `src/`, et
--     `notifications` n'est purgée par aucun cron actuel (constat hors périmètre de cette
--     migration : la table grossit indéfiniment, à signaler séparément).
--   - `projets_lot_id_fkey` : `poudre_lots` n'est purgée par aucun cron ; à réévaluer si un jour
--     les lots eux-mêmes sont supprimés plutôt que simplement épuisés (`restant_kg` à 0).
