-- =================================================================================================
-- 61 — Lot F (cahier des charges v3, §6, F2) : le quota de l'assistant, APPLIQUÉ EN BASE.
--
-- POURQUOI une seconde migration plutôt qu'un simple bricolage côté route. La route
-- (`src/app/api/assistant/route.ts`) compte déjà les questions du jour AVANT d'appeler le modèle,
-- via `assistant_questions_du_jour()` (migration 60) — c'est ce qui évite de payer un appel au
-- modèle pour une question qu'on va refuser, et c'est ce que l'exploitant lit à l'écran. Mais un
-- plafond qui ne vit QUE côté application n'est pas « appliqué en base » : deux requêtes
-- concurrentes passent toutes les deux la même vérification avant que l'une des deux n'ait eu le
-- temps d'écrire sa ligne, ou une régression future dans la route saute la vérification sans que
-- rien ne s'y oppose. Ce trigger est le filet qui reste vrai même si la route se trompe.
--
-- Le barème (10 / 30 / 60 par jour, selon `plan_effectif()`) est le MÊME que `QUOTA_PAR_PLAN` dans
-- `src/lib/assistant/config.ts` : les deux sont un seul et même chiffre décidé au produit, recopié
-- une fois côté base pour l'exécution, une fois côté application pour l'affichage AVANT le mur. Si
-- ce barème change, les deux doivent changer ensemble — c'est noté aux deux endroits.
-- =================================================================================================

create or replace function public.trg_assistant_journal_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan   text;
  v_quota  integer;
  v_deja   integer;
  v_debut  timestamptz;
begin
  v_plan := public.plan_effectif(new.atelier_id);
  -- Même barème que `QUOTA_PAR_PLAN` (src/lib/assistant/config.ts) : 10 en Atelier, 30 en Équipe,
  -- 60 en Certifié. `atelier` (le plus bas) sert de repli pour toute valeur inattendue.
  v_quota := case v_plan
    when 'certifie' then 60
    when 'equipe' then 30
    else 10
  end;

  -- Le jour de Paris, comme `assistant_questions_du_jour()` (migration 60) et
  -- `recap_quotidien_payload` : un plafond qui glisserait sur 24 heures UTC se vivrait comme une
  -- panne aléatoire pour un atelier français.
  v_debut := ((now() at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris';

  select count(*) into v_deja
    from public.assistant_journal
   where atelier_id = new.atelier_id
     and pose_at >= v_debut;

  if v_deja >= v_quota then
    raise exception 'ASSISTANT_QUOTA_ATTEINT'
      using hint = format(
        'Le plafond de %s questions par jour (formule %s) est déjà atteint pour cet atelier.',
        v_quota, coalesce(v_plan, 'atelier'));
  end if;

  return new;
end
$function$;

comment on function public.trg_assistant_journal_quota() is
  'F2 — filet de sécurité du quota de l''assistant : la route vérifie déjà le compteur avant d''appeler le modèle, ce trigger garantit qu''aucune ligne ne peut de toute façon dépasser le plafond du jour, même en cas de course ou de régression côté application.';

-- Comme `trg_assistant_journal_inalterable` (migration 60) : une fonction de trigger n'a rien à
-- faire dans le catalogue PostgREST, qui ne l'appellerait jamais correctement de toute façon.
revoke all on function public.trg_assistant_journal_quota() from public, anon, authenticated;

create trigger assistant_journal_quota
  before insert on public.assistant_journal
  for each row execute function public.trg_assistant_journal_quota();
