-- Suite de la 75. Le devis y a été inséré directement au statut « signé », mais `trg_devis_signe`
-- ne réagit qu'à une MISE À JOUR du statut, pas à une insertion : aucun projet n'a été créé.
--
-- Un devis signé sans projet n'est atteignable par aucun parcours réel du produit — c'est
-- exactement le genre d'incohérence qu'un prospect finit par trouver. On rejoue donc la signature
-- comme le ferait le produit : retour à « envoyé », puis passage à « signé », ce qui laisse le
-- déclencheur créer le projet, en déduire `type_piece = 'jante'` et poser le reste.
--
-- Vérifié en transaction annulée avant application : crée bien un projet « en attente » de type
-- jante, et laisse `meta.jeu_jantes_id` à null — la ligne reste donc ouvrable, ce qui est tout
-- l'objet de ce jeu de données.
update public.devis set status = 'envoye', signed_at = null, signed_by = null
where id = 'd0000000-0000-4000-8000-00000000004a' and status = 'signe'
  and not exists (select 1 from public.projets where devis_id = 'd0000000-0000-4000-8000-00000000004a');

update public.devis
set status = 'signe', signed_at = now() - interval '2 days', signed_by = 'Sébastien Piston'
where id = 'd0000000-0000-4000-8000-00000000004a' and status = 'envoye';
