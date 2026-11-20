-- =============================================================================================
-- 64 — Correctifs remontés par l'agent de test back (vague 3) : verrou démo, signer_devis ouvert
-- à PUBLIC, policy users_couts_write superposée, RLS non optimisées, index manquants.
-- =============================================================================================
--
-- QUATRE DÉFAUTS INDÉPENDANTS, UNE SEULE MIGRATION parce que tous relèvent du même chantier de
-- vérification et touchent un petit nombre de tables déjà en jeu.
--
-- 1. VERROU DÉMO MANQUANT sur `users_couts` (migration 57) et `assistant_journal` (migration 60).
--    `verrous_demo_manquants()` (migration 45c) les signale : ce sont deux tables « de données
--    d'atelier » (elles portent `atelier_id`) posées APRÈS que le verrou soit devenu la règle, sans
--    que personne ne pense à le poser — exactement le défaut que cette fonction d'inventaire existe
--    pour attraper. Un compte de démonstration pourrait aujourd'hui se fixer un taux horaire, ou
--    faire grossir le journal de l'assistant d'un atelier vitrine qui ne doit jamais changer.
--
--    Pour `assistant_journal`, l'ordre compte : `trg_assistant_journal_quota` (migration 61) est
--    déjà posé `BEFORE INSERT`, et Postgres exécute les triggers `BEFORE` du même événement dans
--    l'ordre ALPHABÉTIQUE de leur nom, pas dans l'ordre de création. Un verrou démo nommé après
--    `assistant_journal_quota` s'exécuterait donc APRÈS le calcul du quota — inutilement coûteux
--    (compter les questions du jour d'un atelier qu'on va refuser de toute façon) mais surtout
--    trompeur si un jour le message d'erreur du quota devait primer sur celui de la démo. Le nom
--    choisi, `assistant_interdire_ecriture_demo`, trie avant `assistant_journal_quota` (« i » < « j »
--    juste après le préfixe commun « assistant_ ») ET avant `assistant_journal_inalterable` — ce
--    dernier n'a pas besoin de cet ordre pour bloquer (il refuse tout UPDATE/DELETE sans condition),
--    mais autant que le verrou démo, plus général, soit systématiquement le premier mot dit.
--
-- 2. `signer_devis` EXÉCUTABLE PAR PUBLIC. La migration 56 a fait `drop function` + `create` +
--    `grant ... to anon, authenticated` SANS le `revoke all ... from public` que porte pourtant la
--    version d'origine (migration 45). Sur Postgres, un `grant` à un rôle ne retire jamais les
--    droits déjà accordés au pseudo-rôle PUBLIC : `signer_devis` s'est donc retrouvée exécutable par
--    tout rôle de la base, existant ou futur — un simple oubli de régression, pas une décision. Le
--    correctif est un `revoke ... from public` isolé : `anon` et `authenticated` gardent leurs
--    `grant` explicites (la page publique `/d/<jeton>` signe en anonyme, ça ne change pas).
--
-- 3. `users_couts_write` EN `FOR ALL` SE SUPERPOSE À `users_couts_select`. Les deux policies sont
--    permissives sur la même table : PostgREST doit évaluer les DEUX pour un simple SELECT (l'advisor
--    Supabase le signale — « Multiple Permissive Policies »), et `for all` mélange dans une seule
--    définition des sémantiques d'INSERT (qui n'a pas de ligne existante à lire, donc pas de `using`
--    pertinent), d'UPDATE et de DELETE. On la scinde en trois policies dédiées, avec la même règle
--    métier qu'avant (responsable seul, et seulement sur un membre de SON atelier) — au passage, la
--    clause `exists` de la migration 57 est requalifiée : `u.atelier_id = atelier_id` s'y résolvait à
--    `u.atelier_id = u.atelier_id` (l'unique table dans la portée du sous-select), une tautologie qui
--    ne vérifiait donc PAS que la personne visée appartient à l'atelier du responsable qui écrit. Elle
--    devient `u.atelier_id = users_couts.atelier_id`, sans ambiguïté.
--
-- 4. RLS ET INDEX SIGNALÉS PAR L'ADVISOR PERFORMANCE. La policy `ecriture` d'`assistant_journal`
--    réévalue `auth.uid()` et `current_atelier_id()` à chaque ligne (« Auth RLS Initialization
--    Plan ») : `(select …)` fige la valeur une fois pour la requête. Et deux clés étrangères posées
--    sans index couvrant (`assistant_journal.user_id`, `users_couts.atelier_id`) forcent un scan
--    complet à chaque vérification de contrainte ou filtre RLS sur ces colonnes.
-- =============================================================================================


-- -----------------------------------------------------------------------------------------------
-- 1. Le verrou démo, sur les deux tables qui l'avaient manqué
-- -----------------------------------------------------------------------------------------------

drop trigger if exists interdire_ecriture_demo on public.users_couts;
create trigger interdire_ecriture_demo
  before insert or update or delete on public.users_couts
  for each row execute function public.trg_interdire_ecriture_demo();

-- Nom choisi pour trier AVANT `assistant_journal_quota` (migration 61) dans l'ordre alphabétique
-- des triggers BEFORE — voir l'explication en tête de fichier. `assistant_journal_inalterable`
-- (migration 60) bloque de toute façon tout UPDATE/DELETE sans condition ; le tri le fait passer
-- après celui-ci, ce qui est sans effet mais garde le verrou démo premier partout où c'est possible.
drop trigger if exists assistant_interdire_ecriture_demo on public.assistant_journal;
create trigger assistant_interdire_ecriture_demo
  before insert or update or delete on public.assistant_journal
  for each row execute function public.trg_interdire_ecriture_demo();


-- -----------------------------------------------------------------------------------------------
-- 2. signer_devis : le `revoke from public` qui manquait depuis la migration 56
-- -----------------------------------------------------------------------------------------------

-- Signature relue en base (`pg_get_function_identity_arguments`) plutôt que recopiée de mémoire :
-- la fonction a gagné deux paramètres depuis la version d'origine (migration 45), et se tromper de
-- signature ici reviendrait à revoker une fonction homonyme qui n'existe pas, en silence.
revoke all on function public.signer_devis(
  p_token text, p_nom text, p_signature jsonb, p_ip text,
  p_options_acceptees jsonb, p_hors_etablissement boolean
) from public;

-- Inchangé : la page publique du devis signe en anonyme, c'est tout son objet.
grant execute on function public.signer_devis(
  p_token text, p_nom text, p_signature jsonb, p_ip text,
  p_options_acceptees jsonb, p_hors_etablissement boolean
) to anon, authenticated;


-- -----------------------------------------------------------------------------------------------
-- 3. users_couts_write scindée en trois policies dédiées (INSERT / UPDATE / DELETE)
-- -----------------------------------------------------------------------------------------------

drop policy if exists users_couts_write on public.users_couts;

create policy users_couts_insert on public.users_couts
  for insert to authenticated
  with check (
    atelier_id = public.current_atelier_id() and public.is_owner()
    and exists (
      select 1 from public.users u
       where u.id = user_id and u.atelier_id = users_couts.atelier_id
    )
  );

create policy users_couts_update on public.users_couts
  for update to authenticated
  using (atelier_id = public.current_atelier_id() and public.is_owner())
  with check (
    atelier_id = public.current_atelier_id() and public.is_owner()
    and exists (
      select 1 from public.users u
       where u.id = user_id and u.atelier_id = users_couts.atelier_id
    )
  );

create policy users_couts_delete on public.users_couts
  for delete to authenticated
  using (atelier_id = public.current_atelier_id() and public.is_owner());


-- -----------------------------------------------------------------------------------------------
-- 4. Advisors performance : RLS `(select …)` et index de couverture
-- -----------------------------------------------------------------------------------------------

drop policy if exists ecriture on public.assistant_journal;
create policy ecriture on public.assistant_journal for insert
  with check (
    atelier_id = (select public.current_atelier_id())
    and user_id = (select auth.uid())
  );

create index if not exists idx_assistant_journal_user_id on public.assistant_journal (user_id);
create index if not exists idx_users_couts_atelier_id on public.users_couts (atelier_id);
