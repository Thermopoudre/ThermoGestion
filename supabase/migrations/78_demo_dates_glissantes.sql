-- 78 (20/11/2026) — La démonstration ne vieillit plus. Accord d'Alexis du 20/11/2026 (« Oui, chaque lundi »).
-- Appliquée en production le 20/11/2026 ; premier passage : +73 jours.
--
-- rafraichir_demo() fait glisser toutes les dates de « Atelier Démo Thermolaquage » du même nombre
-- de jours, pour que sa dernière activité tombe hier. Chaque glissement est noté dans
-- demo_decalages (retour arrière = écart opposé). Déclencheurs neutralisés le temps de l'opération
-- (session_replication_role), lignes de la démo seulement. Exclu : notifications, relances,
-- journaux inaltérables, abonnement, utilisateurs, invitations, réglages, exports comptables.
-- Cron tg-rafraichir-demo : lundi 5 h UTC.

create table if not exists public.demo_decalages (
  id bigserial primary key,
  fait_at timestamptz not null default now(),
  decalage interval not null
);
alter table public.demo_decalages enable row level security;
revoke all on table public.demo_decalages from public, anon, authenticated;

create or replace function public.rafraichir_demo()
returns interval language plpgsql security definer set search_path = public as $$
declare
  c_demo constant uuid := 'df1ee297-3232-4a81-a7d8-f7734b699f90';
  v_ancre timestamptz;
  v_ecart interval;
  v_jours int;
  r record;
begin
  select greatest(
    (select max(created_at) from devis where atelier_id = c_demo),
    (select max(created_at) from factures where atelier_id = c_demo),
    (select max(created_at) from projets where atelier_id = c_demo)
  ) into v_ancre;
  if v_ancre is null then return interval '0'; end if;
  v_jours := floor(extract(epoch from ((now() - interval '1 day') - v_ancre)) / 86400)::int;
  if v_jours < 1 then return interval '0'; end if;
  v_ecart := make_interval(days => v_jours);

  set local session_replication_role = replica;

  for r in
    select c.table_name, string_agg(format('%I = %I + %L::interval', c.column_name, c.column_name, v_ecart), ', ') as sets
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.data_type in ('timestamp with time zone', 'timestamp without time zone', 'date')
      and exists (select 1 from information_schema.columns a where a.table_schema = 'public' and a.table_name = c.table_name and a.column_name = 'atelier_id')
      and c.table_name not in ('notifications', 'relances', 'audit_logs', 'assistant_journal', 'subscriptions', 'users',
                               'invitations', 'recap_destinataires', 'reglages_alertes', 'reglages_comptable',
                               'exports_comptables', 'demo_decalages')
    group by c.table_name
  loop
    execute format('update public.%I set %s where atelier_id = %L', r.table_name, r.sets, c_demo);
  end loop;

  update public.projets p
  set etapes = (
    select coalesce(jsonb_agg(
      case when e->>'done_at' is not null
           then jsonb_set(e, '{done_at}', to_jsonb(((e->>'done_at')::timestamptz + v_ecart)))
           else e end order by o), '[]'::jsonb)
    from jsonb_array_elements(p.etapes) with ordinality as x(e, o))
  where p.atelier_id = c_demo and jsonb_typeof(p.etapes) = 'array';

  insert into public.demo_decalages(decalage) values (v_ecart);
  return v_ecart;
end $$;

revoke all on function public.rafraichir_demo() from public, anon, authenticated;

select cron.schedule('tg-rafraichir-demo', '0 5 * * 1', 'select public.rafraichir_demo()');
