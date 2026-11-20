-- Les deux réceptions de l'atelier de démonstration portaient `RC-2026-0018` et `RC-2026-0019`.
-- Deux anomalies dans un seul numéro :
--
--  1. Le préfixe. `_next_numero()` ne produit jamais « RC » : le type `reception` retombe sur le
--     défaut « RE », et aucun réglage de numérotation personnalisé n'existe sur cet atelier. La
--     prochaine réception serait donc sortie en `RE-…`, avec un changement de préfixe visible au
--     milieu de la série et rien pour l'expliquer.
--  2. Le rang. 0018 et 0019 ne correspondent à aucune série de réceptions — ce sont les rangs de
--     la série des devis, manifestement recopiés à la main lors d'un semis du 18 août. Cette
--     démonstration n'a jamais eu que deux réceptions.
--
-- Ces deux lignes datent du 18/08 : l'anomalie est antérieure au semis du 7 septembre, elle n'en
-- vient pas. On la corrige ici parce qu'elle se voit à l'écran d'un prospect.
--
-- Aucun déclencheur d'inaltérabilité ne porte sur `receptions` (contrairement à `devis` et
-- `factures`, qui ont `figer_document`) : la renumérotation est sûre, et rien ne référence ce
-- numéro ailleurs — le bon de prise en charge PDF le relit à chaque génération.
update public.receptions set numero = 'RE-2026-0001'
where id = '6f05f889-e71f-4872-94a9-9e1e2d1078ae' and numero = 'RC-2026-0018';

update public.receptions set numero = 'RE-2026-0002'
where id = '6d69743b-897e-4f67-ad42-242cca775603' and numero = 'RC-2026-0019';

-- Le compteur `reception` n'existait pas pour cet atelier. `_next_numero()` sait s'amorcer seul sur
-- `_valeur_max_numero()`, donc il n'y avait pas de risque de collision — mais le poser explicitement
-- rend la série lisible et évite de dépendre de cet amorçage.
insert into public.compteurs (atelier_id, doc_type, annee, valeur)
values ('df1ee297-3232-4a81-a7d8-f7734b699f90', 'reception', 2026, 2)
on conflict (atelier_id, doc_type, annee) do update set valeur = greatest(compteurs.valeur, excluded.valeur);
