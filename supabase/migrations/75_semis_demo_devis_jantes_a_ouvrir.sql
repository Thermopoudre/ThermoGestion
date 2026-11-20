-- Amélioration n° 8 : le bouton « Créer le jeu de jantes » n'apparaît que sur un devis signé dont
-- une ligne de jantes n'a pas encore de dossier physique ouvert. La démonstration ne contenait que
-- le cas inverse — DV-2026-0020, chiffré DEPUIS un dossier déjà ouvert (JJ-2026-0003), donc sa
-- ligne porte déjà `meta.jeu_jantes_id` et le bouton se masque à juste titre.
--
-- Résultat : la fonction était invisible en démonstration, et la recette au navigateur a conclu
-- qu'elle n'était pas branchée. Les deux sens du métier existent pour de vrai — les jantes qui
-- arrivent puis qu'on chiffre, et le client qui fait chiffrer au téléphone puis dépose ses jantes.
-- On ajoute ici le second, qui manquait.
insert into public.devis (
  id, atelier_id, client_id, numero, status, version,
  items, remise, total_ht, total_tva, total_ttc,
  validite_jours, created_at, envoye_at, signed_at, signed_by
)
select
  'd0000000-0000-4000-8000-00000000004a',
  'df1ee297-3232-4a81-a7d8-f7734b699f90',
  'd0000000-0000-4000-8000-000000000022',
  'DV-2026-0021', 'signe', 1,
  jsonb_build_array(jsonb_build_object(
    'qte', 4, 'tva', 20, 'type', 'libre', 'unite', 'jante',
    'pu_ht', 138.50, 'total_ht', 554.00,
    'libelle', 'Jeu de 4 jantes 18″ — Audi A4 S line (2019) — teinte Gris Daytona — finition satinée',
    'meta', jsonb_build_object(
      'jante', true, 'dessin', 'standard', 'teinte', 'Gris Daytona', 'finition', 'satine',
      'grille_id', 'd0000000-0000-4000-8000-000000000001',
      'surface_m2', 1.05, 'diametre_pouces', 18, 'teinte_reference', null
      -- Volontairement PAS de `jeu_jantes_id` : c'est tout l'intérêt de ce devis. Les jantes ont
      -- été chiffrées au téléphone, elles ne sont pas encore arrivées à l'atelier.
    )
  )),
  null, 554.00, 110.80, 664.80,
  30,
  now() - interval '6 days', now() - interval '5 days', now() - interval '2 days',
  'Sébastien Piston'
where not exists (select 1 from public.devis where id = 'd0000000-0000-4000-8000-00000000004a');

update public.compteurs set valeur = greatest(valeur, 21)
where atelier_id = 'df1ee297-3232-4a81-a7d8-f7734b699f90' and doc_type = 'devis' and annee = 2026;
