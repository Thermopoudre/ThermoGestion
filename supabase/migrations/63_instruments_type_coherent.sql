-- Défaut n°3 de la recette navigateur (vague 2) : `/qualite/instruments` et `/qualite/controles`
-- affichaient « Elcometer 456 — epaisseur » et « Brillancemètre 60° — brillance » bruts. Le
-- dictionnaire existe déjà et fonctionne (`INSTRUMENT_TYPE_LABEL` dans `lib/qualite.ts`, utilisé
-- avec repli sur le code brut dans `qualite/instruments/page.tsx` et `ControleForm.tsx`) : le
-- défaut n'est pas dans l'écran, il est dans la donnée. Deux instruments portaient en `type` le
-- code du *contrôle* qu'ils mesurent ("epaisseur", "brillance" — des `ControleType`, voir
-- `lib/types.ts`) au lieu du code d'*instrument* attendu par ce même dictionnaire
-- ("sonde_epaisseur", "brillancemetre") : `INSTRUMENT_TYPE_LABEL[type]` ne trouvait rien et le
-- repli affichait le code brut. Le même mélange cassait aussi `INSTRUMENT_POUR_TYPE`, qui met en
-- tête de liste l'instrument attendu pour un contrôle : ces deux lignes ne remontaient jamais en
-- tête, même quand elles étaient le bon choix.
update public.instruments set type = 'sonde_epaisseur' where type = 'epaisseur';
update public.instruments set type = 'brillancemetre' where type = 'brillance';

-- Pour que la confusion ne revienne pas : `type` ne peut plus contenir que les codes du
-- dictionnaire d'instrument, jamais un code de contrôle. `null` reste permis (« Non catégorisé »
-- côté écran).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_type_check') then
    alter table public.instruments
      add constraint instruments_type_check check (
        type is null or type in ('sonde_epaisseur', 'brillancemetre', 'grille_quadrillage', 'duretometre_buchholz', 'kit_mek', 'autre')
      );
  end if;
end $$;

comment on constraint instruments_type_check on public.instruments is
  'Codes du dictionnaire INSTRUMENT_TYPE_LABEL (lib/qualite.ts) — jamais un code de ControleType (« epaisseur », « brillance »), qui a une autre nomenclature.';
