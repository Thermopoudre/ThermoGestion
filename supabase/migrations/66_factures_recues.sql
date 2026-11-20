-- =============================================================================================
-- 66 — Réception de factures fournisseurs (amélioration n°1 de AMELIORATIONS-07-09-2026.md).
-- =============================================================================================
--
-- CADRAGE, à ne pas perdre de vue en relisant ce fichier : l'obligation de RÉCEPTION de factures
-- électroniques est effective depuis le 01/09/2026 pour toute entreprise assujettie à la TVA. Le
-- CANAL réglementaire (une Plateforme Agréée) n'est pas encore choisi par Alexis — c'est une
-- décision de 4 à 8 semaines, hors code. Ce fichier ne code donc QUE ce qui ne sera pas jeté le
-- jour du choix : le magasin des factures reçues, sa sécurité, et une place pour la donnée
-- extraite. Le connecteur propriétaire de la plateforme retenue n'existe pas ici et ne doit pas
-- y être deviné — voir `src/lib/reception/index.ts` pour l'endroit exact où il se branchera.
--
-- Cette table est nouvelle : aucune ligne existante à migrer, aucun écran existant à toucher en
-- base. Elle suit les conventions déjà posées pour les documents commerciaux de l'atelier
-- (`factures`, `pieces_jointes`) et pour l'accès du cabinet comptable (`reglages_comptable`,
-- `exports_comptables`), relues en base avant d'écrire ce fichier plutôt que supposées.

create table public.factures_recues (
  id uuid primary key default gen_random_uuid(),
  atelier_id uuid not null default public.current_atelier_id() references public.ateliers(id) on delete cascade,

  -- Provenance du document : le dépôt manuel est la seule voie codée aujourd'hui. `plateforme_agreee`
  -- existe déjà dans le barème pour que la colonne n'ait pas à changer le jour du branchement — voir
  -- `src/lib/reception/index.ts`, qui est le seul endroit qui saura, un jour, écrire cette valeur.
  provenance text not null default 'depot_manuel'
    check (provenance in ('depot_manuel', 'plateforme_agreee')),

  -- Ce que le document EST, pas ce qu'on voudrait qu'il soit : un Factur-X (PDF/A-3 + XML CII
  -- embarqué), un XML CII ou UBL déposé seul, ou un PDF sans aucune structure lisible par machine
  -- (« pdf_simple » — le cas le plus fréquent tant que les fournisseurs de l'atelier n'émettent pas
  -- encore de facture électronique, ce qui reste la norme au 07/09/2026 malgré l'obligation).
  format_source text not null
    check (format_source in ('factur-x', 'ubl', 'cii', 'pdf_simple')),

  -- Le cycle de vie voulu par le cahier des charges : à traiter (par défaut, dès le dépôt),
  -- traitée (rapprochée d'un achat, comptabilisée ailleurs — Thermogestion ne fait pas la
  -- comptabilité fournisseur), refusée (mauvais document, doublon, facture qui ne concerne pas
  -- l'atelier). Pas de suppression dans ce workflow : « refusée » est la sortie propre, cf.
  -- `reference_ecritures_silencieuses_crm` — même principe que sur ThermoCRM, une pièce reçue ne
  -- disparaît pas, elle est qualifiée.
  statut text not null default 'a_traiter'
    check (statut in ('a_traiter', 'traitee', 'refusee')),
  motif_refus text,

  -- Fournisseur : lu depuis le XML quand il y en a un, saisi à la main sinon. Jamais de référence
  -- vers une table `fournisseurs` — elle n'existe pas dans ce produit (cf. périmètre écarté du CDC
  -- v3 : achats et fournisseurs hors réception de facture).
  fournisseur_nom text,
  fournisseur_siren text,
  fournisseur_tva text,

  numero text,
  date_emission date,
  date_echeance date,

  total_ht numeric check (total_ht is null or total_ht >= 0),
  total_tva numeric check (total_tva is null or total_tva >= 0),
  total_ttc numeric check (total_ttc is null or total_ttc >= 0),
  devise text not null default 'EUR',

  -- Le XML CII/UBL brut, tel que lu (extrait du PDF, ou déposé seul) : c'est la source de vérité
  -- de l'extraction, et c'est ce que l'écran donne à télécharger. Pas de borne de taille dédiée :
  -- `taille_octets` ci-dessous borne le DOCUMENT déposé, dont le XML n'est qu'une lecture.
  xml_brut text,

  -- Le PDF déposé (ou celui qui accompagnait le XML) vit dans le bucket `documents`, famille
  -- `comptable` — ouverte au 07/09/2026 (migration 65 / audit sécurité) mais encore inutilisée :
  -- lecture owner/bureau/comptable, écriture owner/bureau seuls (`stockage_acces`, inchangée par
  -- ce fichier). Aucun XML n'y est déposé séparément : `xml_brut` ci-dessus suffit, un
  -- téléchargement se fabriquant côté écran depuis ce texte sans repasser par le bucket.
  storage_path_pdf text,
  nom_fichier_origine text,
  -- Bornes de taille : même plafond que `pieces_jointes_taille_check` (10 Mo) et que le bucket
  -- `documents` (`file_size_limit`) — un fournisseur qui envoie un PDF de 40 Mo ne doit pas passer
  -- ici non plus que sur une pièce jointe ordinaire.
  taille_octets bigint check (taille_octets is null or (taille_octets > 0 and taille_octets <= 10485760)),

  created_by uuid default auth.uid() references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Corbeille : posée pour la cohérence avec `factures`/`devis`/`clients`/`projets`/`bons_livraison`
  -- (`trg_corbeille`, rejoué ci-dessous), mais délibérément PAS raccordée à `purger_corbeille()`, à
  -- `restaurer_de_la_corbeille()` ni à l'écran `/corbeille` partagés : ce sont des points d'entrée
  -- communs à plusieurs chantiers en cours en parallèle, et rien dans le cahier des charges de
  -- cette amélioration ne demande un bouton Supprimer sur cet écran — la sortie normale d'une
  -- facture reçue est « refusée », pas la corbeille. La colonne reste une soupape manuelle
  -- (`update ... set deleted_at = now()`, déjà couverte par la policy d'écriture ci-dessous) pour
  -- corriger un dépôt erroné, sans figurer dans la liste par défaut ni dans le décompte du module
  -- de corbeille commun. À raccorder plus tard si Alexis veut l'unifier.
  deleted_at timestamptz
);

comment on table public.factures_recues is
  'Magasin des factures fournisseurs REÇUES (amélioration n°1, 07/09/2026). Dépôt manuel '
  'aujourd''hui ; `provenance = ''plateforme_agreee''` et le connecteur qui l''alimentera viendront '
  'quand Alexis aura choisi son partenaire — voir src/lib/reception/index.ts.';

create index factures_recues_atelier_id_idx on public.factures_recues (atelier_id);
create index factures_recues_atelier_statut_idx on public.factures_recues (atelier_id, statut) where deleted_at is null;

alter table public.factures_recues enable row level security;

-- Lecture : le bureau (owner/bureau) ET le cabinet comptable — c'est le cadrage explicite de cette
-- amélioration (« un comptable doit voir les factures reçues »), et c'est exactement le motif déjà
-- ouvert pour `reglages_comptable`/`exports_comptables` : `atelier_du_membre()` (qui, contrairement
-- à `current_atelier_id()`, rend l'atelier d'un comptable) combiné à `acces_commercial() OR
-- est_comptable()`. Un opérateur (`role = 'atelier'`) n'a ni l'un ni l'autre : il ne voit rien ici,
-- comme sur `factures`.
create policy factures_recues_select on public.factures_recues
  for select to authenticated
  using (
    atelier_id = public.atelier_du_membre()
    and deleted_at is null
    and (public.acces_commercial() or public.est_comptable())
  );

-- Écriture : owner/bureau seuls, comme sur `reglages_comptable`. Le comptable ne dépose rien et ne
-- change aucun statut — il est en lecture seule, comme partout ailleurs dans le produit
-- (`atelier_du_membre()` rend son atelier en lecture, mais `current_atelier_id()` — utilisée ici —
-- lui rend NULL, donc `atelier_id = current_atelier_id()` échoue systématiquement pour lui).
create policy factures_recues_insert on public.factures_recues
  for insert to authenticated
  with check (atelier_id = public.current_atelier_id() and public.acces_commercial());

create policy factures_recues_update on public.factures_recues
  for update to authenticated
  using (atelier_id = public.current_atelier_id() and public.acces_commercial())
  with check (atelier_id = public.current_atelier_id() and public.acces_commercial());

-- Pas de policy DELETE : comme `reglages_comptable`, la suppression physique n'est ouverte à
-- personne côté PostgREST. `deleted_at` (soupape ci-dessus) passe par UPDATE, pas par DELETE.

-- Trois triggers génériques, réutilisés SANS modification — ils existent déjà et se comportent
-- correctement pour une table qu'ils ne connaissent pas nommément (repli neutre) :
--  - `trg_interdire_ecriture_demo` : aucune écriture sur l'atelier de démonstration.
--  - `trg_journal` : une ligne dans `audit_logs` par création/modification/suppression ; `xml_brut`
--    au-delà de 4 000 caractères est déjà tronqué par `journal_valeur()`, sans réglage à ajouter.
--  - `trg_corbeille` : cf. commentaire de la colonne `deleted_at` ci-dessus — cascade propre à la
--    fermeture d'un atelier, sans règle métier propre à cette table (branche `else`, no-op).
create trigger interdire_ecriture_demo
  before insert or delete or update on public.factures_recues
  for each row execute function public.trg_interdire_ecriture_demo();

create trigger journal
  after insert or delete or update on public.factures_recues
  for each row execute function public.trg_journal('id');

create trigger corbeille
  before update of deleted_at on public.factures_recues
  for each row execute function public.trg_corbeille();

create trigger zz_suppression_definitive
  before delete on public.factures_recues
  for each row execute function public.trg_corbeille();

create trigger trg_factures_recues_updated
  before update on public.factures_recues
  for each row execute function public.set_updated_at();

-- Aucune fonction nouvelle dans ce fichier : aucun `grant`/`revoke` à poser, donc rien qui puisse
-- faire régresser `tests/securite-privileges.test.ts` (RLS active : oui, ci-dessus ; fonction
-- PUBLIC ou anon nouvelle : aucune).
