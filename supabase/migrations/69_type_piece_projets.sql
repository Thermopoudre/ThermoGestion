-- =============================================================================================
-- 69 — Amélioration n°9 (07/09/2026) : fiche projet contextualisée par type de pièce.
-- =============================================================================================
--
-- Constat, PR-2026-0021 (chantier de menuiserie, profilés fenêtre) : la fiche affiche quand même
-- le bloc « Teinte d'origine constructeur (rénovation de jantes) », placeholder « ex : Gris Nardo
-- BMW ». Vérifié en base AVANT d'écrire une ligne de code, comme demandé :
--   - `projets.type_piece` n'existe pas (`information_schema.columns` sur `projets`, 28 colonnes).
--   - `jeux_jantes.projet_id` existe (sens inverse d'un hypothétique `projets.jeu_jantes_id`), mais
--     n'est renseigné sur AUCUNE ligne de la démo (`select projet_id from jeux_jantes` → deux NULL).
--     Le circuit /jantes et le circuit /projets sont aujourd'hui deux mondes disjoints (voir
--     amélioration n°10) : ce n'est donc pas une colonne exploitable pour détecter le type de pièce
--     d'un projet existant.
--   - En revanche `trg_devis_signe()` (déclencheur qui crée le projet à la signature du devis)
--     calcule déjà, pour choisir le workflow de production, un booléen `v_jantes` : vrai si au
--     moins une ligne du devis porte `meta.jante = true` (le générateur de ligne dédié « Jeu de
--     jantes » de `DevisEditor`). C'est la seule source déjà en production, déjà fiable, jamais
--     persistée sur le projet lui-même.
--   - Second signal, trouvé en base et jusqu'ici inexploité : une ligne posée depuis la
--     bibliothèque de pièces (`meta.piece_type_id`) peut référencer une fiche `pieces_types` de
--     `categorie = 'jante'` (ex. DV-2026-0006 → PR-2026-0008, catégorie confirmée en base) sans
--     jamais passer par le générateur dédié, donc sans `meta.jante`. Les deux signaux sont
--     combinés pour `type_piece`, mais SEUL le premier (`v_jantes`) continue à choisir le workflow
--     de production plus bas : élargir ce second choix changerait le comportement de projets
--     existants pour une raison hors du périmètre de cette amélioration (l'affichage d'un champ),
--     et n'est pas fait ici.
--
-- Colonne nullable, sans valeur par défaut. NULL veut dire « on ne sait pas » et se comporte
-- EXACTEMENT comme aujourd'hui : tout s'affiche. On ne bascule un projet sur 'jante'/'autre' que
-- lorsque la règle ci-dessus tranche avec certitude — jamais par supposition sur le nom du
-- chantier ou celui du client (repéré en base : PR-2026-0022 « Jantes BMW 19 pouces » a une ligne
-- de devis en texte libre, sans `meta.jante` ni `piece_type_id` — elle bascule donc en 'autre' au
-- même titre que le reste, cohérent avec le fait que ce projet a DÉJÀ le workflow de production
-- par défaut, pas le workflow jantes ; un chiffrage jantes qui ne passe pas par les générateurs
-- dédiés du devis n'est pas détecté nulle part ailleurs dans l'application non plus).

alter table public.projets
  add column type_piece text;

alter table public.projets
  add constraint projets_type_piece_check check (type_piece is null or type_piece in ('jante', 'autre'));

comment on column public.projets.type_piece is
  '''jante'' | ''autre'' | NULL (inconnu → la fiche affiche tout, comportement historique). Posée '
  'par trg_devis_signe() à la création du projet ; backfillée une fois pour les projets existants '
  'à partir des lignes du devis d''origine (meta.jante ou pieces_types.categorie = ''jante''). '
  'Jamais déduite après coup sur un projet sans devis exploitable : on laisse NULL plutôt que '
  'deviner sur un atelier réel — migration 69.';

-- -----------------------------------------------------------------------------------------------
-- 1. trg_devis_signe() : pose `type_piece` dès la création du projet.
--    Corps inchangé par ailleurs (comparé en base avant modification) — seuls les blocs marqués
--    « N°9 » ci-dessous sont neufs.
-- -----------------------------------------------------------------------------------------------
create or replace function public.trg_devis_signe()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_projet_id uuid;
  v_atelier_email text;
  v_surface numeric;
  v_jantes boolean;
  v_type_piece text;
  v_workflow jsonb;
begin
  if new.status = 'signe' and old.status is distinct from 'signe' then
    if not exists (select 1 from public.projets where devis_id = new.id) then
      -- Surface à laquer reprise des lignes : m² direct, équivalent développé des mètres
      -- linéaires, et surface unitaire des pièces types multipliée par la quantité.
      -- Une ligne de jeu de jantes porte `meta.surface_m2` = surface d'UNE jante et `qte` = le
      -- nombre de jantes : elle entre donc dans ce calcul sans traitement particulier.
      select coalesce(sum(
               case
                 when (it->'meta'->>'surface_equivalente_m2') is not null then (it->'meta'->>'surface_equivalente_m2')::numeric
                 when (it->>'type') = 'm2' then coalesce((it->'meta'->>'surface')::numeric, (it->>'qte')::numeric, 0)
                 when (it->'meta'->>'surface_m2') is not null then (it->'meta'->>'surface_m2')::numeric * coalesce((it->>'qte')::numeric, 1)
                 else 0
               end), 0)
        into v_surface
        from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) it;

      -- Une seule ligne de jantes suffit à basculer le dossier sur le parcours jantes : c'est
      -- le sur-ensemble d'étapes, un portail chiffré sur le même devis n'y perd rien (ses
      -- étapes pneu restent simplement non pointées).
      select exists (
        select 1 from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) it
         where (it->'meta'->>'jante') = 'true'
      ) into v_jantes;
      v_workflow := case when v_jantes then public._workflow_jantes(new.atelier_id)
                         else public._workflow_defaut(new.atelier_id) end;

      -- N°9 — `type_piece`, pour l'affichage de la fiche uniquement. Signal élargi par rapport à
      -- `v_jantes` ci-dessus (qui, lui, continue à ne piloter QUE le choix du workflow, inchangé) :
      -- une ligne posée depuis la bibliothèque avec une fiche `categorie = 'jante'` compte aussi,
      -- même sans être passée par le générateur dédié « Jeu de jantes ».
      select case
               when v_jantes or exists (
                 select 1 from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) it
                 join public.pieces_types pt on pt.id = nullif(it->'meta'->>'piece_type_id', '')::uuid
                 where pt.categorie = 'jante'
               ) then 'jante'
               when jsonb_array_length(coalesce(new.items, '[]'::jsonb)) > 0 then 'autre'
               else null
             end into v_type_piece;

      insert into public.projets(atelier_id, client_id, devis_id, numero, nom, status, etapes, etape_courante, surface_m2, type_piece, created_by)
      values (
        new.atelier_id, new.client_id, new.id,
        public._next_numero(new.atelier_id, 'projet'),
        coalesce('Devis ' || new.numero, 'Projet'),
        'en_attente',
        v_workflow,
        (v_workflow->0->>'code'),
        nullif(round(v_surface, 2), 0),
        v_type_piece,
        new.created_by
      ) returning id into v_projet_id;

      -- Le dossier jantes préexiste au devis : sans ce raccrochage, l'atelier aurait un dossier
      -- métier d'un côté et un projet de production de l'autre, sans lien entre les deux.
      update public.jeux_jantes set projet_id = v_projet_id
       where devis_id = new.id and projet_id is null;
    end if;
    select email into v_atelier_email from public.ateliers where id = new.atelier_id;
    if v_atelier_email is not null then
      insert into public.notifications(atelier_id, destinataire_email, template, payload)
      values (new.atelier_id, v_atelier_email, 'devis_signe',
              jsonb_build_object('devis_numero', new.numero, 'signed_by', new.signed_by, 'total_ttc', new.total_ttc));
    end if;
  end if;
  return new;
end
$function$;

-- Défensif, comme sur toute fonction de ce schéma depuis l'audit du 07/09 (migration 65) : un
-- `create or replace` sur la même signature conserve normalement l'ACL existante (déjà fermée à
-- PUBLIC), mais on ne laisse pas ce point à l'implicite.
revoke all on function public.trg_devis_signe() from public;

-- -----------------------------------------------------------------------------------------------
-- 2. Backfill des projets existants — même règle EXACTE que ci-dessus, appliquée une seule fois.
--    Seuls les projets qui portent un devis exploitable (au moins une ligne) sont tranchés ; les
--    autres (devis absent, ou lignes vides — DV en brouillon jamais chiffré) restent à NULL.
-- -----------------------------------------------------------------------------------------------
update public.projets p
   set type_piece = case
     when exists (
       select 1
         from public.devis d
         join lateral jsonb_array_elements(coalesce(d.items, '[]'::jsonb)) it on true
         left join public.pieces_types pt on pt.id = nullif(it->'meta'->>'piece_type_id', '')::uuid
        where d.id = p.devis_id
          and ((it->'meta'->>'jante') = 'true' or pt.categorie = 'jante')
     ) then 'jante'
     when exists (
       select 1 from public.devis d where d.id = p.devis_id and jsonb_array_length(coalesce(d.items, '[]'::jsonb)) > 0
     ) then 'autre'
     else null
   end
 where p.devis_id is not null
   and p.type_piece is null;
