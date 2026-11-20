-- =============================================================================================
-- 46 — La trace des relances : rattrapée quand elle existe, expliquée quand elle n'existe pas.
--
-- CE QUI S'EST PASSÉ. La colonne `relances.notification_id` a été ajoutée le 20/08/2026. Les
-- relances posées avant cette date portent donc `notification_id = NULL`, et la vue
-- `relances_envoyees` — qui va chercher le destinataire et le sort du message dans
-- `notifications` par cette colonne — n'avait rien à joindre. Résultat à l'écran : « Trace
-- incomplète » et « destinataire inconnu » sur 100 % des lignes de l'atelier de démonstration,
-- sans un mot pour dire quoi en faire. Le cron, lui, n'a jamais eu de défaut : depuis la
-- migration qui a créé la colonne, `relancer_devis_et_factures()` insère la notification, en
-- récupère l'identifiant et le pose sur la relance dans la même transaction.
--
-- CE QUE FAIT CETTE MIGRATION, en deux temps.
--
--  1. **Elle rattrape le lien perdu.** Les notifications correspondantes n'ont jamais été
--     effacées : elles sont là, avec la bonne adresse et le bon statut. Comme relance et
--     notification étaient insérées dans la même transaction, elles portent le même
--     `transaction_timestamp()` — `relances.sent_at` et `notifications.created_at` sont égaux à
--     la microseconde près. C'est ce qui rend le rattachement déterministe, et non approximatif.
--     Trois garde-fous, parce qu'un journal qui ment est pire qu'un journal muet : même atelier,
--     même gabarit, même numéro de document dans la charge utile — et on ne rattache que
--     lorsqu'il n'existe **qu'un seul** candidat.
--
--  2. **Elle donne à l'écran de quoi expliquer ce qui reste.** Deux colonnes s'ajoutent à la vue :
--     `trace_disponible` dit franchement si le message a été retrouvé, `destinataire_client`
--     donne l'adresse actuelle du client pour que l'écran puisse afficher une adresse
--     plausible en la présentant pour ce qu'elle est. La règle tenue partout : on n'affiche
--     jamais l'adresse d'aujourd'hui comme si c'était celle de l'envoi.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Rattrapage du lien relance → notification
-- ---------------------------------------------------------------------------------------------
with candidats as (
  select r.id                      as relance_id,
         n.id                      as notification_id,
         count(*) over (partition by r.id) as nb_candidats
    from public.relances r
    join public.notifications n
      on  n.atelier_id = r.atelier_id
      and n.template   = r.template
      -- L'ancre du rattachement : les deux lignes viennent de la même transaction du cron.
      and n.created_at = r.sent_at
    left join public.devis    d on r.document_type = 'devis'   and d.id = r.document_id
    left join public.factures f on r.document_type = 'facture' and f.id = r.document_id
   where r.notification_id is null
     -- Le numéro imprimé dans le message doit être celui du document relancé. Sans cette
     -- vérification, deux relances émises à la même seconde pour le même gabarit pourraient être
     -- croisées, et l'écran attribuerait une adresse à la mauvaise facture.
     and coalesce(n.payload ->> 'devis_numero', n.payload ->> 'facture_numero')
         is not distinct from coalesce(d.numero, f.numero)
)
update public.relances r
   set notification_id = c.notification_id
  from candidats c
 where c.relance_id = r.id
   -- Une seule correspondance possible, sinon on préfère la ligne sans trace : l'écran sait
   -- désormais le dire, et une trace inventée ne se rattrape jamais.
   and c.nb_candidats = 1;

comment on column public.relances.notification_id is
  'Le message effectivement envoyé pour cette relance. NULL sur les relances antérieures au '
  '20/08/2026 (la colonne n''existait pas) et sur celles dont le message n''a pas pu être '
  'retrouvé sans ambiguïté : l''écran /relances affiche alors « Envoi non tracé » et l''explique.';

-- ---------------------------------------------------------------------------------------------
-- 2. La vue rend de quoi expliquer, au lieu de laisser l'écran deviner
-- ---------------------------------------------------------------------------------------------
create or replace view public.relances_envoyees
with (security_invoker = on) as
  select r.id,
         r.atelier_id,
         r.document_type,
         r.document_id,
         r.canal,
         r.template,
         r.sent_at,
         coalesce(d.numero, f.numero)                     as document_numero,
         coalesce(d.client_id, f.client_id)               as client_id,
         coalesce(dc.nom, fc.nom)                         as client_nom,
         n.destinataire_email                             as destinataire,
         coalesce(d.total_ttc, f.total_ttc)               as montant_ttc,
         coalesce(d.relances_actives, f.relances_actives) as document_relances_actives,
         coalesce(dc.relances_actives, fc.relances_actives) as client_relances_actives,
         coalesce(n.status, 'inconnu'::text)              as statut_envoi,
         n.error                                          as erreur_envoi,
         -- Le message a-t-il été retrouvé ? `statut_envoi = 'inconnu'` répondait déjà, mais par
         -- la bande : un statut d'envoi qui vaut « inconnu » se lit comme un envoi douteux,
         -- alors que ce qui manque est le lien, pas l'envoi. Un booléen nommé le dit sans
         -- ambiguïté et laisse l'écran choisir sa phrase.
         (n.id is not null)                               as trace_disponible,
         -- L'adresse d'aujourd'hui, pour les lignes sans trace. Ce n'est PAS l'adresse utilisée
         -- lors de l'envoi — elle a pu changer depuis — et l'écran doit le présenter ainsi.
         coalesce(dc.email, fc.email)                     as destinataire_client
    from public.relances r
    left join public.notifications n on n.id = r.notification_id
    left join public.devis    d  on r.document_type = 'devis'   and d.id = r.document_id
    left join public.clients  dc on dc.id = d.client_id
    left join public.factures f  on r.document_type = 'facture' and f.id = r.document_id
    left join public.clients  fc on fc.id = f.client_id;

comment on view public.relances_envoyees is
  'Journal des relances automatiques, joint au message envoyé. En security_invoker : la RLS de '
  '`relances` décide seule qui voit quoi, la vue n''ouvre aucune porte. `trace_disponible` à '
  'false signale une relance dont le message n''a pas pu être rattaché — la relance est bien '
  'partie (le compteur du document en fait foi), c''est le détail de l''envoi qui manque.';
