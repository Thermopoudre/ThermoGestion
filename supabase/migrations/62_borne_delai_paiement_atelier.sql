-- Défaut n°1 de la recette navigateur (vague 2) : `/reglages` (onglet Atelier) laissait saisir
-- un délai de paiement par défaut de 999 jours sans le moindre refus, alors que la même règle
-- (L441-10 du code de commerce, 60 jours calendaires au plus) est déjà posée sur `clients` depuis
-- la migration 53 (`clients_delai_paiement_check`) — avec le même avertissement dans `ChampDecimal`
-- : `min`/`max` sur un `<input type=number>` n'ont jamais eu d'effet, seule la contrainte SQL tient.
--
-- `ateliers.delai_paiement_jours` porte le délai par défaut de l'atelier (repris sur un client qui
-- n'a rien négocié de particulier) : c'est la même donnée, avec la même borne légale, mais sur une
-- table différente — la contrainte de la migration 53 ne portait que sur `clients`.
--
-- Aucune ligne existante ne viole la borne (vérifié avant migration) : la contrainte est ajoutée
-- directement `validate`, pas en deux temps.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ateliers_delai_paiement_check') then
    alter table public.ateliers
      add constraint ateliers_delai_paiement_check check (delai_paiement_jours >= 0 and delai_paiement_jours <= 60);
  end if;
end $$;

comment on constraint ateliers_delai_paiement_check on public.ateliers is
  'L441-10 du code de commerce : 60 jours calendaires au plus. Même borne que clients_delai_paiement_check (migration 53).';
