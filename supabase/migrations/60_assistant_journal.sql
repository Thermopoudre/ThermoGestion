-- =================================================================================================
-- 60 — Lot F (cahier des charges v3, §6) : le journal de l'assistant, et son quota
--
-- POURQUOI. Sans cette table, le plafond de questions par jour (F2) n'existe pas : la route sait
-- compter, mais elle n'a rien à compter. La DDL était déjà écrite en commentaire dans
-- `src/lib/assistant/journal.ts` ; cette migration l'applique telle quelle, plus une fonction de
-- comptage utilisable par TOUS les rôles (voir plus bas).
--
-- Trois garanties, non négociables :
--   1. `atelier_id` a un DEFAULT (`current_atelier_id()`), jamais un paramètre : c'est la base qui
--      décide de quel atelier relève la ligne, un appel forgé ne peut pas écrire ailleurs ;
--   2. lecture réservée au rôle commercial (bureau, responsable) — l'opérateur n'a rien à voir dans
--      un historique de questions qui peut porter sur des devis et des factures ;
--   3. écriture seule : aucune policy d'UPDATE ni de DELETE, et un trigger qui lève une exception
--      dans les deux cas, pour ne pas dépendre uniquement de l'absence de policy. Un journal qu'on
--      peut corriger ne prouve rien.
-- =================================================================================================

create table public.assistant_journal (
  id           uuid primary key default gen_random_uuid(),
  atelier_id   uuid not null default public.current_atelier_id() references public.ateliers(id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.users(id),
  pose_at      timestamptz not null default now(),
  question     text not null,
  -- Les outils appelés et leurs paramètres : c'est CE QUI EST SORTI DE LA BASE, et donc ce que
  -- l'atelier doit pouvoir relire. La réponse rédigée par le modèle n'est PAS conservée : elle se
  -- redéduit des mêmes outils, et la garder ferait du journal un second entrepôt de données
  -- commerciales à protéger pour rien.
  outils       jsonb not null default '[]'::jsonb,
  modele       text,
  cout_eur     numeric(10,5) not null default 0,
  jetons_in    int not null default 0,
  jetons_out   int not null default 0,
  erreur       text
);

comment on table public.assistant_journal is
  'Une ligne par question posée à l''assistant IA : la question, les outils appelés (donc les données lues), le coût. Jamais la réponse rédigée. Écriture seule, lecture réservée au rôle commercial.';

create index idx_assistant_journal_atelier_jour on public.assistant_journal (atelier_id, pose_at desc);

alter table public.assistant_journal enable row level security;

-- Lecture : le bureau et le responsable, comme pour /relances. L'opérateur n'a rien à y voir —
-- c'est la même frontière que sur `devis`/`factures` (policy `commercial_all`).
create policy lecture on public.assistant_journal for select
  using (atelier_id = public.current_atelier_id() and public.acces_commercial());

-- Écriture : n'importe quel membre de l'atelier, pour lui-même. Ni update, ni delete : ces deux
-- commandes n'ont simplement pas de policy, donc RLS les refuse par défaut — le trigger ci-dessous
-- est la seconde barrière, pour ne pas dépendre d'un oubli de policy plus tard.
create policy ecriture on public.assistant_journal for insert
  with check (atelier_id = public.current_atelier_id() and user_id = auth.uid());

-- -------------------------------------------------------------------------------------------------
-- Le journal ne se corrige ni ne se supprime (même principe que `trg_journal_inalterable`).
-- -------------------------------------------------------------------------------------------------
create or replace function public.trg_assistant_journal_inalterable()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  raise exception 'ASSISTANT_JOURNAL_INALTERABLE'
    using hint = 'Le journal de l''assistant constate une question posée : il ne se corrige ni ne se supprime.';
end
$function$;

revoke all on function public.trg_assistant_journal_inalterable() from public, anon, authenticated;

create trigger assistant_journal_inalterable
  before update or delete on public.assistant_journal
  for each row execute function public.trg_assistant_journal_inalterable();

-- -------------------------------------------------------------------------------------------------
-- Le compteur du quota, ouvert à TOUS les rôles — pas seulement à ceux qui lisent le journal.
-- -------------------------------------------------------------------------------------------------
-- POURQUOI une fonction `security definer` et pas un simple `select … count` côté application : la
-- policy de lecture ci-dessus est réservée au rôle commercial. F1 ouvre pourtant des outils de
-- PRODUCTION (`journee_du_matin`, `pieces_pretes_non_livrees`, `agenda_dates_promises`,
-- `stock_sous_seuil`) au rôle atelier — sans cette fonction, un opérateur qui les utilise ne
-- rencontrerait jamais le plafond, ce qui n'est pas un plafond, c'est un trou.
--
-- Elle ne rend qu'un entier : jamais le texte d'une question, jamais un `outils` d'un autre membre.
-- C'est exactement le compromis annoncé dans le commentaire de `journal.ts` avant cette migration.
create or replace function public.assistant_questions_du_jour()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int
    from public.assistant_journal
   where atelier_id = public.current_atelier_id()
     -- Le jour de Paris, pas les 24 dernières heures : le plafond doit se comprendre
     -- (« dix par jour »), et un plafond glissant se vit comme une panne aléatoire. Même bascule
     -- que `recap_quotidien_payload` : minuit à Paris, converti en instant UTC comparable à
     -- `pose_at`.
     and pose_at >= (((now() at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris');
$function$;

revoke all on function public.assistant_questions_du_jour() from public, anon;
grant execute on function public.assistant_questions_du_jour() to authenticated;
