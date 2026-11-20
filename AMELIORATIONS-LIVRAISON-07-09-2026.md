# Améliorations 1, 5, 6, 7, 9, 10 — livrées le 7 septembre 2026

Six améliorations retenues par Alexis dans `AMELIORATIONS-07-09-2026.md`, développées, testées (**1 469 tests verts**, `tsc` propre, build passant) et déployées en production. Migrations **66 à 70**.

## Ce qui est en production

### N° 1 — Réception de factures fournisseurs

Le document recommandait de ne pas coder avant le choix du partenaire, sous peine de jeter l'écran. **Décision prise et assumée : on a construit tout ce qui ne dépend pas du partenaire**, et rien d'autre.

Livré : la table `factures_recues` (RLS — le comptable lit, l'opérateur ne voit rien, un atelier ne voit pas l'autre ; bornes de taille ; verrou démo ; journal), la **lecture** d'une facture entrante (extraction du XML CII embarqué dans un PDF/A-3 Factur-X, lecture UBL, repli propre sur « PDF simple, à saisir à la main »), l'écran `/factures-recues` (dépôt par glisser-déposer et par bouton, aperçu du PDF, téléchargement du XML, statuts à traiter / traitée / refusée), et une **couche d'ingestion agnostique** — une entrée unique `ingererFactureRecue()` où le connecteur viendra se brancher.

**Ce qu'il restera exactement à écrire le jour du choix** : le connecteur propriétaire (authentification, abonnement aux notifications), la route qui reçoit son webhook et vérifie sa signature, une colonne de correspondance atelier ↔ identifiant plateforme sur `ateliers`, l'accusé de réception technique s'il en demande un. Rien de tout cela n'a été deviné.

Aucune bibliothèque ajoutée : l'extraction réutilise `pdf-lib`, déjà présent, et le style d'analyse de `src/lib/facturx/xml.ts`.

### N° 5 — Onglets des bons de livraison

Un BL passé en `facture` n'apparaissait **ni** dans « À livrer » **ni** dans « Livrés » — c'est ce qui avait fait croire à la recette du 4 septembre que la page était vide. « Livrés » couvre désormais `livre` **et** `facture`.

Un **quatrième onglet « À facturer »** a été ajouté plutôt que de se contenter d'élargir : le lien de Pilotage et la colonne « Reste à facturer » reposaient sur l'ancienne définition de « Livrés » (livré, pas encore facturé, comme le CTE de `client_rentabilite`). Sans ce second onglet, ce lien serait devenu faux. Les deux liens de Pilotage pointent maintenant vers `/bl?filtre=a_facturer`.

### N° 6 — Index sur les `atelier_id`

Douze index posés, choisis un par un après lecture des requêtes réelles : simples là où la RLS filtre seule (`fournee_projets`, `instruments`, `grille_coefs` — ce dernier lu par l'éditeur de devis, l'écran le plus fréquenté), composites là où un tri suit (`(atelier_id, surface_min)`, `(atelier_id, diametre_min)`), dédiés à la colonne de clé étrangère là où une cascade de suppression les emprunte. Les tables toujours lues par une colonne déjà indexée (`jantes`, `photos`) et les référentiels quasi statiques ont été **volontairement laissés sans index**, avec la raison écrite dans la migration.

La recette a rattrapé une erreur : `controles(atelier_id, projet_id)` ne couvre pas la cascade par `projet_id` seul — un index btree ne sert que son préfixe gauche. Corrigé par la migration 70.

### N° 7 — Rappel de la pesée de rendement

**Une section du récapitulatif quotidien existant, pas un second courriel** — la règle « un seul message par jour » l'imposait, et un nouveau gabarit aurait dupliqué toute la discipline déjà en place (jeton de désabonnement, garde anti-démonstration).

Une teinte est réclamée si elle n'a jamais été pesée ou si sa dernière pesée date de plus de **35 jours** (un mois plus une semaine de marge, pour ne pas relancer une teinte pesée le 1er dès le contrôle suivant). La section ne reparaît qu'après **28 jours** — et seulement si elle a été **effectivement montrée**, sinon la date n'avance pas. Rien à signaler, rien d'affiché : un rappel vide chaque mois est le meilleur moyen de faire ignorer tous les suivants. Coupure par une case dans Réglages → Alertes ; couper le récapitulatif entier ou se désabonner coupe aussi cette section.

### N° 9 — Fiche projet contextualisée

`projets.type_piece` n'existait pas. Plutôt que d'inventer une colonne, deux signaux déjà présents en base ont été trouvés : `meta.jante` sur une ligne de devis (que `trg_devis_signe()` calculait déjà sans jamais le conserver) et la catégorie d'une pièce du catalogue. La colonne est désormais posée à la signature et **rétro-remplie** : 1 `jante`, 6 `autre`, 7 `null`.

Un projet sans signal exploitable reste à `null` et affiche tout, comme avant — on ne devine jamais sur un nom de chantier. Le bloc « Teinte d'origine constructeur » disparaît sur un chantier de menuiserie, **mais jamais si le champ est déjà rempli** : cacher une donnée saisie serait pire que le défaut d'origine.

### N° 10 — Aiguillage réceptions / jantes

Alexis n'avait pas tranché entre fusionner et aiguiller. **Option la moins risquée retenue : l'aiguillage**, qui ne touche à aucune donnée et ne casse aucun circuit. Quatre liens croisés, liste vers liste et formulaire vers formulaire, avec le vocabulaire de l'atelier : « Ce dépôt concerne un jeu de jantes ? → ouvrir le dossier jantes », et « Un jeu de jantes a son propre dossier — roue par roue, avec bon de prise en charge ».

## Deux fausses alertes de la recette, vérifiées en base

- **`/bl` « presque vide »** : l'atelier de démonstration n'a qu'un seul bon de livraison, facturé. « À livrer 0, Livrés 1, À facturer 0, Tous 1 » est donc **exact** — et prouve que le correctif marche, ce BL n'apparaissant auparavant que dans « Tous ». Les chiffres attendus dans la consigne de recette venaient de ThermoTest, pas de la démonstration.
- **Lien Pilotage manquant** : il est masqué à juste titre, l'atelier de démonstration n'ayant aucun BL à facturer.

## Un vrai défaut trouvé et corrigé

L'écran des factures reçues affichait `DEMO_LECTURE_SEULE` — un code de déclencheur — au lieu de la phrase française que tout le reste du produit montre pour le même refus : il relayait `e.message` au lieu de passer par `errorFr`. Le même défaut a été trouvé et corrigé sur `/stock/[id]` (mouvement de stock).

## Réserves

- **La conformité n'est pas atteinte** : le produit sait désormais *recevoir et lire* une facture déposée à la main, ce qui vaut mieux que rien, mais un atelier n'est en règle que raccordé à une plateforme agréée. C'est une décision, pas du développement.
- L'écran `/factures-recues` pèse 373 kB au premier chargement (1,5 à 2,1 s mesurés) — le plus lourd du produit, à surveiller s'il grossit.
- L'extraction ne lit pas les lignes de détail ni la ventilation de TVA multi-taux : les totaux et l'en-tête suffisent pour classer une facture, pas pour la comptabiliser ligne à ligne.
- La sous-case « Me l'envoyer, à moi » ne se grise pas avec la case pesée — incohérence visuelle mineure relevée à la recette, non corrigée.
- La démonstration ne contient aucun projet de jantes issu d'un devis renseigné : le maintien du champ sur ce cas n'a pas pu être vérifié au navigateur (les tests le couvrent).
