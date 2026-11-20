-- =============================================================================================
-- 73b — Correctif d'un défaut introduit par la migration 73 elle-même.
--
-- Les identifiants internes des lignes semées (`...-047`, `...-049`) n'ont jamais eu vocation à
-- devenir le numéro de document visible : celui-ci vient de `_next_numero()`, qui poursuit la vraie
-- série annuelle de l'atelier (17 devis déjà émis) et a donc rendu DV-2026-0018, DV-2026-0019 et
-- DV-2026-0020 — pas les suffixes d'identifiant utilisés par erreur dans deux libellés rédigés à la
-- main :
--   - la ligne de la facture d'acompte FA-2026-0033 annonçait « Acompte 30 % sur devis DV-2026-0047 »
--     au lieu de DV-2026-0018 ;
--   - la note du jeu de jantes JJ-2026-0003 renvoyait vers « DV-2026-0049 » au lieu de DV-2026-0020.
-- Un prospect qui clique du devis vers sa facture d'acompte serait tombé sur un numéro qui n'existe
-- pas — exactement la contradiction que la mission demandait d'éviter.
--
-- POURQUOI PASSER PAR `ALTER TABLE ... DISABLE TRIGGER`, ET PAS UN SIMPLE UPDATE. La facture est déjà
-- `emise` : `trg_figer_document` gèle la colonne `items` dès que `old.status` vaut `emise` — c'est le
-- garde-fou qui empêche de réécrire une facture après coup, et il fonctionne comme prévu ici aussi.
-- On ne le contourne pas globalement (`session_replication_role`), ce qui désactiverait tous les
-- triggers de la session y compris sur d'autres tables : on désactive uniquement `figer_document` sur
-- `factures`, le temps d'une correction de texte qui ne touche ni le montant ni aucune colonne
-- comptable, puis on le réactive immédiatement dans la même transaction.
-- =============================================================================================

alter table public.factures disable trigger figer_document;

update public.factures
   set items = jsonb_set(items, '{0,libelle}', '"Acompte 30 % sur devis DV-2026-0018"')
 where id = 'd0000000-0000-4000-8000-000000000074'
   and items -> 0 ->> 'libelle' = 'Acompte 30 % sur devis DV-2026-0047';

alter table public.factures enable trigger figer_document;

update public.jeux_jantes
   set note = replace(note, 'DV-2026-0049', 'DV-2026-0020')
 where id = 'd0000000-0000-4000-8000-0000000000b3'
   and note like '%DV-2026-0049%';
