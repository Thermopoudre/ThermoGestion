-- Correctif immédiat à la migration 68 : `revoke ... from public` ne suffit pas sur Supabase.
-- `anon` (et ici `authenticated`) reçoivent un `grant execute` explicite à la création de toute
-- nouvelle fonction dans `public`, qui survit à un simple `revoke ... from public` — piège déjà
-- documenté et corrigé pour six fonctions par la migration 65 (`reference_securite_thermogestion_20260907`).
-- Vérifié après la migration 68 : `poudre_pesee_a_rappeler` et la nouvelle signature à 3 arguments
-- de `recap_quotidien_payload` étaient exécutables par `anon` ET `authenticated` malgré leur
-- `revoke ... from public`, exactement comme le décrit ce piège. Ni l'une ni l'autre ne doivent
-- être appelables autrement que par `service_role` (le cron) : `recap_quotidien_payload` lit les
-- devis, factures et impayés de n'importe quel atelier passé en paramètre ; `poudre_pesee_a_rappeler`
-- lit le stock et les mouvements de n'importe quel atelier de la même façon.
--
-- Vérifié après coup avec `audit_privileges_securite()` (migration 65) : 0 fonction sans
-- search_path, 0 fonction exécutable par PUBLIC, 0 table sans RLS, 0 vue sans security_invoker,
-- et ni `poudre_pesee_a_rappeler` ni `recap_quotidien_payload` ne figurent plus dans les fonctions
-- exécutables par `anon` — `tests/securite-privileges.test.ts` reste vert sans modification.
revoke execute on function public.poudre_pesee_a_rappeler(uuid, integer) from anon;
revoke execute on function public.poudre_pesee_a_rappeler(uuid, integer) from authenticated;
revoke execute on function public.poudre_pesee_a_rappeler(uuid, integer) from public;

revoke execute on function public.recap_quotidien_payload(uuid, boolean, boolean) from anon;
revoke execute on function public.recap_quotidien_payload(uuid, boolean, boolean) from authenticated;
revoke execute on function public.recap_quotidien_payload(uuid, boolean, boolean) from public;
