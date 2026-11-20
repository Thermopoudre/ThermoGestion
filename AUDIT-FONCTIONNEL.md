# Thermogestion — Audit de vérité, fonction par fonction

*19 août 2026, mis à jour le 20 au soir, **contre-audité le 21 au matin**. Audit contradictoire de
l'inventaire du `CAHIER-DES-CHARGES-MASTER.md` — 61 lignes au départ, **83 aujourd'hui** : 65 avec
les sous-lignes, + 6 de la section C10, + les **12 du module jantes** que ce document ignorait
jusqu'au 21/08 (section C0).
Méthode : lecture du code et de la base (colonnes, contraintes, RPC, RLS, triggers, vues), remontée
de chaque champ modifiable jusqu'à l'endroit où sa valeur est réellement lue, vérification des
chaînes complètes plutôt que des écrans isolés, et interrogation des données réelles des deux
ateliers en production.*

**Les statuts du cahier des charges n'étaient pas fiables.** Ils mentaient dans les deux sens :
trois fonctions déclarées « à faire » (#14, #15, #16) sont livrées et utilisées, une déclarée
« faite » (#13) n'a pas de document à imprimer, et une déclarée 🔶 (#60) n'existe pas du tout.

> **Mise à jour du 20 août 2026 au soir.** Les sept chantiers de `AUDIT-LOGICIEL-20-08-2026.md` §5
> sont livrés et déployés — détail, preuves et défauts trouvés en chemin dans
> [`RECETTE-CHANTIERS-20-08-2026.md`](RECETTE-CHANTIERS-20-08-2026.md). Les lignes marquées
> *« 20/08 »* ci-dessous ont été **revérifiées en base ce soir**, pas recopiées d'un compte rendu :
> présence de la fonction, de la table, de la policy, du trigger ou du fichier. Trois lignes
> passent à Opérationnel (#19, #21, #26), quatre changent de contenu sans changer de verdict (#18,
> #30, #38, #41), **une régresse** (#57), et six lignes nouvelles ouvrent la section C10.
>
> **Aucune de ces lignes n'a été vue à l'écran** au moment de la mise à jour : ce qui est écrit ici
> est prouvé par la suite de tests et par SQL, jamais par un clic.

> **Contre-audit du 21 août 2026 au matin.** Les lignes ci-dessus ont été reprises une par une et
> confrontées à la base et au code. **Le document se trompait sur neuf points**, dans les deux sens
> comme d'habitude : #57 était déjà réparé douze minutes après avoir été déclaré en régression,
> #30 a tenu sa promesse pendant la nuit, #37 accusait deux causes qui n'existaient plus, #22 se
> contredisait avec #28 dans la même page, #54 et #58 réclamaient une entrée d'import qui existe
> depuis le 19/08, et trois compteurs (38 tables de démo, 32 tables d'abonnement, 923 tests)
> étaient faux. Deux défauts neufs ont été trouvés : **C-13** (`devis.status='expire'`, jumeau
> exact de C-11) et **R13** (un document à la corbeille reste signable de l'extérieur).
> **Et surtout** : le mot « jante » n'apparaissait pas une seule fois dans ce document, alors que
> le `CAHIER-DES-CHARGES-MASTER.md` consacre douze lignes au module et que la page tarifs en fait
> son premier argument. La section **C0** ci-dessous répare cet angle mort.

---

## Barème

| Statut | Signification |
|---|---|
| **Opérationnel** | Un atelier peut s'en servir aujourd'hui, de bout en bout. Vérifié. |
| **Partiel** | Ça existe, un maillon nommé manque. |
| **Coquille** | L'écran ou le réglage existe et n'a aucun effet réel. |
| **Absent** | Rien. |

---

## C0 — Rénovation de jantes *(ajouté le 21/08 — l'angle mort de cet audit)*

*Le `CAHIER-DES-CHARGES-MASTER.md` §C0 porte douze lignes J1 à J12 et coche neuf ✅. **Aucune
n'avait été confrontée ici** : le mot « jante » n'apparaissait pas une fois dans les 603 lignes de
ce document, alors que quatre tables, quatre écrans, une page publique, une route PDF et 68 tests
existent, et que la page tarifs vend le module comme premier argument de la formule d'entrée.*

**Le constat qui domine toute la section.** Compté en base le 21/08 :
`jeux_jantes` 2, `jantes` 8, `vehicules` 2, `jante_paliers` 4, `grille_coefs` catégorie `jante_%` 7
— **et 100 % de ces lignes appartiennent à l'atelier `demo`**. ThermoTest, le seul atelier réel,
n'a **aucun** jeu, **aucun** véhicule, **aucun** palier au pouce et **aucun** coefficient de jante.
Or `trg_interdire_ecriture_demo` couvre les quatre tables : sur l'atelier de démonstration, toute
écriture est refusée. **Le module jantes est donc dans l'état exact où cet audit avait classé #39
(avis Google) en « coquille de fait »** : entièrement câblé, prouvé par test, jamais exercé une
seule fois par un atelier qui travaille — et structurellement inexerçable là où sont ses données.

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| J1 | Dossier jeu de jantes (client + véhicule + jante unitaire) | ✅ | **Opérationnel en code, jamais exercé en vrai** | Tables `jeux_jantes` (29 col.), `jantes` (11 col.), `vehicules` (16 col.) ; écrans `/jantes`, `/jantes/new`, `/jantes/[id]` ; entrée en `Sidebar.tsx:34` **et** `BottomNav.tsx:25` — l'écran a bien une porte sur les deux tailles d'écran. JJ-2026-0001 et JJ-2026-0002, 4 jantes chacun, statuts déduits. | Les deux dossiers sont en démo. Zéro dossier réel. |
| J2 | Chiffrage au jeu : palier au pouce × dessin × finition | ✅ | **Opérationnel en code, jamais exercé** | `lib/jantes.ts` (`palierJante:135`, `prixJante:153`, `ligneJeuJantes:250`), barème `jante_paliers` adossé à `grille_id`, onglet Réglages > Jantes (`reglages:922`), 37 épreuves dans `jantes-chiffrage.test.ts`. | **4 paliers en base, tous en démo.** Un atelier réel qui ouvre l'onglet trouve un barème vide : rien ne le pré-remplit, contrairement à la grille au m². |
| J3 | Teinte d'origine constructeur par véhicule | ✅ | **Partiel** | `vehicules.teinte_origine` / `.teinte_reference` / `.tp_product_id`, `TeinteOrigineSelecteur.tsx`, route `api/catalogue/poudres`. Deux véhicules réels portent la teinte et sa référence (Frozen Grey C3Z, Gris Argent LY7W). | Même dépendance que #35 : sans `TP_WS_KEY`, la recherche catalogue retombe en saisie manuelle. Et `vehicules.tp_product_id` n'est renseigné sur aucun des deux véhicules — l'import 1 clic n'a jamais servi ici. |
| J4 | Reprise du dernier jeu en choisissant le véhicule | ✅ | **Non vérifiable sur pièce** | Le code existe (`/jantes/new`). | **Aucun véhicule n'a deux jeux** en base : la reprise n'a jamais pu s'exécuter. À recetter à l'écran. |
| J5 | Parcours de production dédié aux jantes | ✅ | **Opérationnel** | `_workflow_jantes()` en base (fonction distincte de `_workflow_defaut()`), miroir côté écran `reglages:53-60`, sous-onglet Workflow > Jantes. | Le choix du workflow se fait au devis ; **aucun des deux jeux n'a de `devis_id` ni de `projet_id`** — la bascule n'a jamais eu lieu en vrai. |
| J6 | Suivi jante par jante | ✅ | **Opérationnel** | `trg_jeu_statut_depuis_jantes` sur `jantes` (relu en base), contrainte `jantes_statut_check` à 5 valeurs, `statutJeuDepuisJantes` (`lib/jantes.ts:362`), `JanteCarte.tsx`. | RAS côté règle. |
| J7 | Bon de prise en charge public signable + photos par jante + PDF | ✅ | **Coquille de fait** | Page `/jt/[token]`, RPC `jeu_jantes_public` et `signer_jeu_jantes` (toutes deux ouvertes à `anon`, mécanisme S6), route `api/pdf/jantes/[id]`, `photos.jante_id` / `.jeu_jantes_id` écrits par `JanteCarte.tsx:70`. | **0 photo et 0 signature sur les deux jeux** (`signed_at` nul, `photos` = 0). Le document existe, il n'a jamais été produit. |
| J8 | Opérations mécaniques quantifiées | ✅ | **Opérationnel en code** | `jantes_operations_check` à 8 valeurs, `OPERATIONS_JANTE` et `lignesOperationsJantes` (`lib/jantes.ts:38, 313`), codes de prestation dédiés. | Aucune opération saisie en dehors de la démo. |
| J9 | Documents qui parlent jantes, du devis à la facture | ✅ | **Non vérifiable sur pièce** | `libelleJeu` (`lib/jantes.ts:184`), `estLigneJante:341`, reprise dans `DevisEditor:241`, couture figée par `jantes-dossier.test.ts`. | **Aucun devis, aucun BL, aucune facture de jantes n'existe en base.** La chaîne est prouvée par test et par rien d'autre. |
| J10 | Étiquette / fiche suiveuse par jante | ⬜ | **Absent** | Même manque que #13 : pas de route `api/pdf/etiquette`. | Tout. |
| J11 | Contrôle qualité rattaché à une jante | ⬜ | **Absent** | `controles` n'a ni `jante_id` ni `jeu_jantes_id` (colonnes relues). | Tout. |
| J12 | Alerte sur un jeu promis non prêt | ⬜ | **Partiel — le ⬜ était faux** | Le tableau de bord compte et **relie** : `dashboard/page.tsx:112-113`, « X jeux de jantes en retard sur la date promise » et « promis aujourd'hui », lien vers `/jantes`. | L'alerte est **tirée**, pas **poussée** : `recap_quotidien_payload` ne contient rien sur les jantes (fonction relue), donc le courriel du matin ne parle jamais d'un jeu promis à 48 h. C'est exactement le manque nommé J-5 de `MODULE-JANTES.md`. |

**Trois trous que l'inventaire des 71 lignes ne pouvait pas voir, parce que le module n'y était pas :**

1. **Le module jantes est hors corbeille.** `deleted_at` existe sur **6** entités (`clients`, `devis`, `projets`, `factures`, `bons_livraison`, `receptions`) — **aucune du module**. Un jeu de jantes créé par erreur ne se jette pas : il n'y a pas de bouton, et pas de colonne. Cf. #65.
2. **Le module jantes est hors journal.** `trg_journal` est posé sur **15** tables ; ni `jeux_jantes`, ni `jantes`, ni `vehicules` n'en font partie. Modifier le diamètre ou la teinte d'un jeu ne laisse aucune trace. Cf. #66.
3. **`jeu_jantes_public` et `signer_jeu_jantes` ne filtrent aucun `deleted_at`** — sans objet aujourd'hui puisque la colonne n'existe pas, mais c'est la même faille que R13 le jour où la corbeille couvrira le module.

---

## C1 — Qualité & certification

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 1 | Cahier de contrôles journalier | ✅ | **Opérationnel** | 6 types (`lib/qualite.ts:92`), saisie `ControleForm.tsx`, registre PDF `api/pdf/registre-controles`. Données réelles : 8 contrôles, tous avec `seuils` et `referentiel_nom` figés. | Sélecteur de période sur l'export (la route accepte `from`/`to`, aucune UI ne les propose — `qualite/page.tsx:169` force le mois courant). Le PDF n'imprime ni l'instrument ni le commentaire. |
| 1b | Seuils paramétrables par référentiel | ✅ | **Opérationnel (corrigé — lot 6)** | Trigger `controle_seuils_appliques` pose le barème **et rend le verdict** (`verdict_controle` en plpgsql) ; `figer_controle` refuse tout `UPDATE` ; plus aucune policy `DELETE`. Rejoué depuis un client PostgREST authentifié **et** anonyme (`tests/verdict-qualite-serveur.test.ts`). | ✅ **R1 et R2 fermés.** Reste : aucun mode « annulation » d'un contrôle (la correction passe par une nouvelle mesure, qui prime). |
| 1c | Contrôles activables par atelier | — | **Opérationnel (nouveau — lot 6)** | `referentiels_qualite.types_controle`, coché dans Qualité > Référentiels. Un type désactivé disparaît de la saisie, du sous-titre du registre PDF et des blocages du certificat, et la base le refuse (`TYPE_CONTROLE_DESACTIVE`). Avertissement si un label Qualicoat/Qualisteelcoat/Qualimarine/Qualidéco est revendiqué sans contrôle d'épaisseur. | Un type désactivé ne masque pas les contrôles passés du registre (volontaire, mais non expliqué à l'écran). |
| 2 | Registre des bains | ✅ | **Partiel** | `BainForm.tsx`, `qualite/bains`, section PDF `registre-controles:131`. 5 relevés réels. | **Aucune alerte de renouvellement** : `renouvele` est un booléen d'horodatage, sans périodicité ni seuil. L'écran ne dit que « X/Y bains contrôlés aujourd'hui ». |
| 3 | Certificat de conformité PDF | ✅ | **Opérationnel** | Les blocages sont rejoués **côté serveur** (`lib/certificat.ts`, HTTP 409 dans `api/pdf/certificat/[id]`). Vérifié sur données réelles : PR-2026-0001 émettable, PR-2026-0002 bloqué (adhérence classe 4). | ✅ **Lot 6 — le document n'affirme plus que ce qu'il a mesuré** : l'épaisseur n'est exigée que si l'atelier la pratique, un dossier sans aucun contrôle est refusé (`aucun_controle`), la plage d'épaisseur de la poudre n'est plus imprimée sans mesure d'épaisseur, et les contrôles non réalisés sont **nommés** sur le PDF. |
| 4 | Non-conformités & Pareto | ✅ | **Opérationnel** | Pareto fréquence + cumul (`qualite/non-conformites:15`), typologie figée. Chaîne rentabilité vérifiée en base : `client_rentabilite.cout_non_qualite = sum(cout_estime)`. | Une NC rattachée à une fournée seule (`projet_id` nul) n'entre dans aucune rentabilité. `projet_revient` ignore la non-qualité alors que `client_rentabilite` l'intègre : deux marges différentes pour le même projet selon l'écran. |
| 5 | Suivi des certifications, alerte J-90 | ✅ | **Opérationnel** | `PREAVIS_CERTIFICATION_JOURS = 90`. Non-impression d'une certification expirée vérifiée sur les **deux** chemins PDF (`certificat.ts:196` puis `labelOpposable`). Testé. | RAS. |
| 6 | Étalonnage des instruments | ✅ | **Partiel** | `etalonnageInfo`, préavis 30 j, remonté au tableau de bord et à la saisie. 4 instruments réels. | Aucun **historique** : « Étalonné aujourd'hui » écrase la date précédente. Aucun moyen d'attacher le certificat d'étalonnage — précisément la pièce que réclame l'auditeur. |

---

## C2 — Production & planification

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 7 | Planification des fournées | ✅ | **Opérationnel** | Groupement par teinte, blocage dur cycle incompatible (`fournees.ts:138` → `disabled` `FourneeComposer:84`), avertissement doux teinte, jauge, suggestion de remplissage. 6 fournées / 9 rattachements réels. | ✅ **Corrigé ce jour** : deux projets de la **même** poudre sans cycle renseigné se déclaraient mutuellement incompatibles. Même poudre = même cycle, testé en premier désormais. ✅ Index unique posé sur `(atelier_id, numero)` — deux fournées portaient déjà `F-20260817-1`. |
| 8 | Capacité, charge, date réaliste | ✅ | **Opérationnel (corrigé)** | `capacite.ts`, écran `/pilotage`, `DateRealiste.tsx` sur la fiche projet. | ✅ **Corrigé ce jour** : `estEnCharge` comptait dans la file d'attente les projets **déjà cuits** (statut `pret`, étape `controle`). Sur les données réelles, 25,58 m² de projets post-four gonflaient la charge et repoussaient toutes les dates promises. |
| 9 | Fiche de cuisson tracée | ✅ | **Opérationnel (corrigé)** | Consigne / relevé / écart / opérateur / conso / lot poudre / cases de visa (`lib/pdf/qualite.tsx:268`). 3 fournées terminées réelles avec relevé. | ✅ **Corrigé ce jour** : `/fournees` ne listait que `planifiee` et `en_cours`, aucun écran ne pointait vers `/fournees/[id]`. **Le document de traçabilité devenait injoignable dès la fournée clôturée.** Historique des 50 dernières ajouté. Reste : l'opérateur n'est enregistré qu'au lancement, le PDF attribue la cuisson à celui qui a appuyé sur « Lancer ». |
| 10 | Racks et chevalets consignés | ⬜ | **Absent** | 0 occurrence de « rack », « chevalet », « consigné » dans `src/`. Aucune table. | Tout. |
| 11 | Temps par étape, pointage QR | 🔶 | **Opérationnel (corrigé — lot 6)** | Chaîne réelle : `/scan/[qr]` ou fiche projet → `avancer_etape` (qui chronomètre elle-même) → `temps_etapes` → `projet_temps_cout` → `projet_revient`. Vérifié à l'écran sur PR-2026-0021 : « Temps passé 3 h 10 » et « Coût main d'œuvre 152,00 € — 3 h 10 pointées » concordent. | ✅ **R8 fermé** : bouton « ▶ Démarrer » (RPC `demarrer_etape`) pour ouvrir la première étape, `signer_bl` referme le chrono du projet livré, la vue de coût compte le chrono en cours. Reste : aucune correction manuelle d'un pointage clos, et aucun garde-fou sur un chrono oublié ouvert. |
| 11b | Temps partagé entre plusieurs pièces | — | **Opérationnel (nouveau — lot 6)** | Écran `/pointage`, RPC `demarrer_pointage_lot` / `arreter_pointage_lot`. Un temps global relevé pour le lot, réparti au prorata de `surface_m2` (qui porte l'équivalent développé des ml) ; parts égales si une surface manque ; minutes entières dont la somme est exactement le temps relevé. Le temps réparti alimente `projet_revient`. | Pas de reprise d'un lot laissé ouvert ; correction du temps possible avant l'arrêt seulement. |
| 12 | Écran atelier (TV) | ⬜ | **Absent** | Aucune route. | Tout. |
| 13 | Étiquettes / fiche suiveuse A5-A6 | 🔶 | **Coquille** | `QrCode.tsx` fonctionne, `qr_token` renseigné sur 10/10 projets, `/scan/[qr]` marche. Mais le QR n'existe qu'à l'écran et la légende `projets/[id]:204` dit « **Imprimez ce QR sur la fiche suiveuse** » alors qu'aucune fiche suiveuse n'existe : pas de route `/api/pdf/etiquette`, pas de `fiche-suiveuse`. | Le PDF A5/A6. Le QR, lui, est prêt. |

---

## C3 — Commercial & devis

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 14 | Tarification au mètre linéaire | ⬜ | **Opérationnel — le ⬜ était faux** | Onglet dédié `reglages:389-435` (CRUD famille / prix / périmètre + seed 4 familles). Bouton `+ ml` `DevisEditor:425`, branche d'édition dédiée, surface développée recalculée. 6 tarifs actifs, 6/6 avec périmètre. | `tarifs_ml.description` est saisi et jamais réaffiché. |
| 15 | Tarifs négociés par client | ⬜ | **Partiel — le ⬜ était faux** | `client_tarifs` : CRUD `ClientForm:71`, lu `DevisEditor:68`, appliqué `calculs.ts:33`. `remise_pct` : opérationnel. | `clients.grille_id` est une **coquille fonctionnelle** : aucun écran ne crée une seconde grille (`reglages:51` ne charge que `is_default`, `createGrille` force `is_default`), donc `grilleDediee = … && !grille?.is_default` est **toujours faux** et le bandeau « Grille dédiée appliquée » est du code mort. |
| 16 | Bibliothèque de pièces types | ⬜ | **Partiel — le ⬜ était faux** | Onglet `reglages:438`, boutons `DevisEditor:433`, `coef_complexite` appliqué dans les deux branches (`prixPieceType` `calculs.ts:95`). 7 pièces, 7/7 avec coefficient. | `longueur_ml` et `perimetre_mm` sont des **coquilles** — voir C-1 et C-2. |
| 17 | Calculateur de surface | ⬜ | **Partiel, et mal câblé** | Un assistant existe : périmètre × longueur × nb (`DevisEditor:369`). | Il est dans la branche `else` : **une ligne créée par le bouton `+ ml` ne le voit jamais**. Il n'est atteignable que par une prestation déclarée `unite='ml'` — 1 sur 10 en base. Ni tôle, ni portail à barreaux. |
| 18 | Relances automatiques de devis | ✅ | **Opérationnel (repris — 20/08)** | Cron `relancer-devis-factures` `0 7 * * *`. La fonction relue en base ce soir regarde désormais : `at.demo = false` (cf. S8), `devis.relances_actives` **et** `clients.relances_actives`, `deleted_at`, la cadence et le plafond **de l'atelier** (`reglages_alertes_de`), et le **reste dû** `total_ttc − Σ paiements > 0,01`. Écran `/relances` (198 l.) : la coquille C-10 est fermée. | Cadence par défaut toujours J+3/3 j/max 3, mais **réglable par atelier** (`reglages_alertes`). Reste : la relance déduit les paiements, **pas les avoirs** — une facture intégralement avoirée mais non payée reste relançable. |
| 19 | Versions & duplication de devis | ⬜ | **Opérationnel (nouveau — 20/08)** | RPC vérifiées en base : `dupliquer_devis`, `dupliquer_facture`, `dupliquer_projet`, `nouvelle_version_devis`, `rouvrir_devis`. `parent_id` et `version` sont lus **et affichés** (`devis/[id]/page.tsx:52-185`) : le chaînage se lit en une phrase. Une seule version par devis, un brouillon ne se versionne pas, un devis facturé non plus. La copie repart en brouillon, sans numéro, sans signature, **sans le jeton public du client**. 33 épreuves dans `duplication-corrections.test.ts`, dont le refus vérifié **sur l'état après coup** pour un opérateur d'atelier et pour un anonyme. | Aucune duplication en lot. Pas de duplication de bon de livraison ni de réception. |
| 20 | Devis multilingue FR/IT/EN | ⬜ | **Partiel** | `i18n.ts:14` : `LANGUES = ["fr","it"]`. | EN manquant ; et les PDF sont 100 % français quelle que soit la langue choisie. |

---

## C4 — Facturation & encaissement

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 21 | Module facture | ✅ | **Opérationnel (corrigé)** | 4 types, `next_numero` atomique (`ON CONFLICT … RETURNING`), index unique `(atelier_id, numero)`, mentions L441-9 / L441-10 / R.123-237 / 293 B. | ✅ **Corrigé le 19/08** : un **avoir recevait un numéro `FA-`** alors que `_next_numero` sait produire `AV-` — deux documents de sens comptable opposé dans la même série, rejet garanti à l'export FEC. ✅ **20/08 — la coquille C-11 est fermée** : `annuler_facture(id, motif)` pose enfin le statut `annulee`, **avec son motif et sans libérer le numéro**. Refus vérifiés sur l'état : motif vide, facture payée, facture partiellement encaissée, brouillon, seconde annulation. Une facture annulée ne se modifie plus et **ne redevient jamais émise**. Et `avoir_depuis_facture(id, lignes[])` fait l'avoir total ou partiel, **avec plafond de cumul en trigger** — la base refuse un cumul d'avoirs supérieur à la facture d'origine. |
| 21b | Identité légale + 4 mentions e-facture | ✅ | **Opérationnel (corrigé)** | SIREN client, adresse de livraison (exposée seulement si différente), nature d'opération, TVA sur les débits : tous saisis et relus jusqu'au PDF et au XML. | ✅ **Corrigé ce jour** : `ateliers.assujetti_tva` était **lu 6 fois et saisissable nulle part** — un atelier en franchise en base ne pouvait pas faire apparaître l'article 293 B. Case ajoutée dans Réglages > Identité légale. |
| 22 | Factur-X PDF/A-3 + XML | ✅ | **Opérationnel** | Profil MINIMUM, séquence CII, codes 380/381/386, `AFRelationship`, XMP `pdfaid:part 3/B`, OutputIntent ICC sRGB, polices incorporées. ⚠️ **Corrigé le 21/08 — la phrase précédente était fausse et contredisait #28 dans la même page.** `DuePayableAmount` **n'est pas** `total_ttc` en dur : `src/lib/facturx/xml.ts:352` calcule `dejaRegle` à partir des lignes de déduction d'acompte, émet `TotalPrepaidAmount` (BT-113) quand il y en a, et pose `resteAPayer = totalTtc − dejaRegle` (BT-115, ligne 362). Le commentaire de la fonction explique même pourquoi BT-113 est ancré sur le reste dû plutôt que recalculé — pour ne pas décaler d'un centime le PDF et le XML. | Ce qui reste vrai : les **encaissements** déjà reçus (`paiements`) ne sont pas déduits. Une facture émise après un versement partiel annonce donc un BT-115 supérieur au dû réel. |
| 23 | Facture mensuelle récapitulative | ⬜ | **Opérationnel (corrigé) — le ⬜ était faux** | UI complète `factures/page.tsx` (compte des BL éligibles, priorisation des clients `facturation_mensuelle`), RPC `facture_recapitulative`. Une récap réelle existe en base. | ✅ **R3 corrigé** (4ᵉ disparition de remise). ✅ **Lot 6 : R4 fermé** — la RPC verrouille (`FOR UPDATE`) les bons qu'elle reprend, et une facture de chantier les consomme désormais avant elle. `factures.recapitulatif` (doublon mort) supprimée. |
| 24 | BL + signature + photos de remise | ⬜ | **Partiel — le ⬜ était faux** | BL complet : `/bl`, `/bl/new`, `/bl/fiche/[id]`, PDF, page publique `/bl/[token]` → `signer_bl` (refus de double signature, IP, projet passé en `livre`, **chrono refermé**). BL-2026-0003 signé le 18/08. | **Photos de remise absentes** : `photos` n'a pas de `bl_id`, aucun upload sur la page publique. ✅ **R5 corrigé** (remise perdue). ✅ **Lot 6 : un bon ne se facture qu'une fois** — `trg_bl_facture_unique` + rattachement automatique, données régularisées. ✅ Index unique posé sur `(atelier_id, numero)`. |
| 25 | Paiement en ligne (Stripe Connect) | ✅ | **Opérationnel en code, mort en prod** | OAuth, lien de paiement sur compte connecté, webhook idempotent. | `STRIPE_SECRET_KEY` **absente en production** : `POST /api/stripe/webhook` répond `{"error":"Stripe non configuré."}`. Le lien de paiement est créé au `total_ttc` sans déduire les acomptes. |
| 26 | Relances impayés, balance âgée | 🔶 | **Partiel (repris — 20/08) : moteur oui, écran oui, balance âgée non** | Cron actif, `relances` alimentée. ✅ Écran `/relances` : chaque document en file, avec **la date que le cron appliquera réellement** (égalité figée par `alertes-dlu-relances.test.ts`), et un interrupteur **par client et par document** — celui du client prime. Chaque refus a son motif nommé : client coupé, document coupé, plafond, non éligible, formule fermée. Plafond à 0 = interrupteur général. Le reste dû déduit les paiements. | **Balance âgée toujours absente** : pas de tranches 0-30/30-60/60-90/90+. Et la relance ne déduit pas les **avoirs** (cf. #18). |
| 27 | Export comptable CSV/FEC + connecteurs | 🔶 | **Partiel** | CSV et FEC opérationnels : 18 colonnes dans l'ordre, tab + CRLF, nom `<SIREN>FEC<AAAAMMJJ>.txt`, avoir en sens inverse, ventilation TVA au prorata avec absorption d'arrondi. 17 tests. | **Pennylane / Axonaut : 0 occurrence dans tout le dépôt.** Aucun connecteur. |
| 28 | Acomptes & situations | 🔶 | **Opérationnel (corrigé — lot 6)** | Circuit acompte → solde complet : le devis reste facturable après un acompte, le solde reprend le chantier et déduit les versements en **ligne explicite par acompte et par taux de TVA** (`lignesDeductionAcomptes`), `facture_liee_id` est écrite, le PDF porte la mention et le total devient « TTC restant dû ». Index unique `factures_un_solde_par_devis` en base. | ✅ **R6 fermé.** Effet de bord : `DuePayableAmount` du Factur-X tombe juste sur un solde. Reste : aucune facture de situation (avancement en %). |
| 28b | PDF généré côté serveur | ✅ | **Opérationnel** | 8 routes `api/pdf/*`, `runtime="nodejs"`, auth + RLS, polices incorporées. | RAS. |

---

## C5 — Stock, poudres & achats

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 29 | Traçabilité lot poudre → projet | 🔶 | **Opérationnel — le 🔶 était pessimiste** | 12/12 projets ont un `lot_id`. Décompte FIFO dans `avancer_etape` → `consommer_lots`. Le lot est repris sur le certificat. | Supprimer `projets.lot_poudre` (texte, 0 ligne, 0 lecture). |
| 30 | DLU / péremption, alerte J-60 | ⬜ | **Partiel (repris — 20/08)** | Le seuil n'est plus une constante recopiée dans cinq écrans : il vit dans `reglages_alertes.seuil_dlu_jours` **par atelier** (60 j sur les deux ateliers, relu ce soir) et dans un seul fichier de code, `src/lib/alertes.ts`. `consommer_lots` sert les périmés en dernier puis FIFO par DLU. La DLU en approche entre dans le **courriel du matin** (`recap_quotidien_payload`). | ✅ **La promesse a été tenue pendant la nuit.** Le premier courriel du matin **est parti** : `notifications` porte une ligne `recap_quotidien`, créée le **21/08 à 05 h 05 UTC** (07 h 05 Europe/Paris, l'heure annoncée), `status = 'sent'`, `sent_at` 05 h 10, destinataire `contact@thermopoudre.fr`, atelier ThermoTest (`demo = false`). `recap_destinataires` est passée de 0 à **1 ligne**, créée par le cron lui-même à la même seconde. **Reste à faire** : le récapitulatif ne parle ni du bain à renouveler, ni de l'étalonnage en retard, ni de la balance âgée, ni d'un **jeu de jantes promis non prêt** (`recap_quotidien_payload` relue : aucune mention de jantes) — et il ne s'adresse qu'au responsable, aucun opérateur n'y est abonné. |
| 31 | Poudre recyclée, taux de réemploi | ⬜ | **Absent** | 0 occurrence de « recycl ». | Tout. |
| 32 | Rendement réel vs théorique | ✅ | **Partiel** | Vue `poudre_rendement` lue par `/pilotage`. | **Par opérateur : rien** (aucune dimension utilisateur dans la vue). Et **sans pesée, la vue est vide** : 4 poudres sur 10 ont un taux, il n'y a que 4 mouvements de type `pesee` en base. Ce n'est pas une fonctionnalité automatique, c'est le sous-produit d'une discipline de pesée qui n'existe pas encore. |
| 33 | Consommables | ⬜ | **Absent** | Aucune table. « Masquage » n'existe que comme ligne facturable. | Tout. Conséquence : le prix de revient (#43) est structurellement incomplet. |
| 34 | Commande Thermopoudre intégrée | 🔶 | **Opérationnel en code, jamais exercé** | Chaîne transactionnelle complète : panier → `envoyer_commande_poudre` (numérote + 2 notifications) → `receptionner_commande_poudre` → lot tracé → trigger de recalage du stock. 16 tests. | **Jamais exécutée en vrai** : 1 commande en base, statut `panier`, 0 notification `commande_poudre` émise. À recetter de bout en bout une fois. |
| 35 | Catalogue teintes + import 1 clic | ✅ | **Opérationnel** | Route serveur avec clé privée et mode dégradé explicite ; parsing RAL / OEM / cycle / rendement / prix au kg. **2 poudres portent un `tp_product_id`** : l'import a réellement tourné en prod. | `TP_WS_KEY` absente de `.env.local` (dev) ; vérifier la variable sur Vercel. Toujours pas de clé PrestaShop en lecture seule. |
| 36 | Nuancier client par lien | ⬜ | **Absent** | Aucune route publique. `RalStrip.tsx` est une bande décorative de 9 pastilles en dur sur la vitrine. | Tout. |

---

## C6 — Client & relation

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 37 | Réception avec photos horodatées | ⬜ | **Partiel — le socle est bon, il n'a jamais servi** | Écrans réels (`/receptions`, public `/rc/[token]`). **Le Storage est correctement configuré** : bucket `photos` privé, policies sur `foldername(name)[1] = current_atelier_id()`, chemin d'upload conforme, URLs signées côté serveur. | ⚠️ **Corrigé le 21/08 — les deux causes accusées ici n'existaient déjà plus.** (1) `reception_public` joint sur `p.reception_id = r.id` — source de la fonction relue en base ce matin, il n'y a aucun `projet_id` dedans, et la RPC filtre `deleted_at`. (2) `receptions/[id]/page.tsx:88-95` passe l'`insert` dans `photos` par `ecrire()` **et retire le fichier du bucket** si la trace échoue (`supabase.storage.from("photos").remove([path])`), et `reload()` ligne 44-48 lit **la table**, plus le Storage : une photo sans ligne ne s'affiche nulle part. Ce qui reste vrai, et c'est tout : **0 photo en base pour 5 réceptions**, et **aucun dépôt de photo depuis la page publique `/rc/[token]`** — le client qui dépose ses pièces ne peut rien photographier lui-même. **Défaut neuf trouvé au passage** : le bucket `photos` n'a **ni `file_size_limit` ni `allowed_mime_types`** (relu dans `storage.buckets`), là où le bucket `documents` de #64 est plafonné à 10 Mo avec liste blanche. Le garde-fou ne couvre pas le bucket le plus utilisé. |
| 38 | Portail client pro **avec compte** | ⬜ | **Partiel (nouveau — 20/08) — lire la nuance** | Table `client_portail` (`jeton`, `ouvert_at`, `ouvert_par`, `derniere_visite_at`, `visites`), écran `/portail/<jeton>`, réglage sur la fiche client. **Un espace par client, désactivé par défaut, révocable, renouvelable** — renouveler tue immédiatement l'ancien lien, mettre le client à la corbeille ferme son portail. `portail_ouvrir` / `portail_regenerer` / `portail_revoquer` sont **fermées à `anon`** ; la table n'accorde que `SELECT` à `authenticated` et rien à `anon` : l'atelier ne peut pas se forger un jeton en écrivant dedans. 26 épreuves (`portail-client.test.ts`), dont le cloisonnement A/B dans les deux sens, et une par une : ni brouillon, ni note interne, ni remise négociée, ni prix de revient, ni marge, ni surface. Le **reste dû déduit les règlements et les avoirs**. | **Ce n'est pas « avec compte »** : c'est un lien à jeton, sans mot de passe et sans identifiant — d'où *Partiel* et non *Opérationnel*. Pas de dépôt de document par le client, pas de validation de devis depuis l'espace. Et **aucun portail n'a jamais été ouvert** : `client_portail` compte 0 ligne. |
| 39 | Avis Google automatisé J+2 | ✅ | **Coquille de fait** | Trigger + garde-fou 90 j + template + cron toutes les 5 min : tout est câblé. | **0 notification `avis_google` n'a jamais existé.** Le seul atelier avec `avis_google_url` renseignée est la **démo**, où le trigger de lecture seule bloque tout `UPDATE` sur `bons_livraison` : le déclencheur ne peut structurellement jamais s'y produire. ThermoTest a l'URL à `NULL`. La fonction n'a donc jamais été exercée une seule fois. |
| 40 | Galerie avant/après, réseaux | 🔶 | **Absent** | 0 occurrence de « galerie », « avant_apres », « instagram ». | Tout. La matière première (photos par étape) existe. |
| 41 | Historique & clients dormants | ⬜ | **Absent — la fiche s'est étoffée, pas sur ce sujet** | `clients/[id]/page.tsx` est passée de **51 à 121 lignes** le 20/08 : réglage du portail, pièces jointes, **panneau Historique** (journal des modifications), désarchivage — qui manquait purement et simplement, `archive = true` étant jusque-là irréversible depuis l'interface. | **Le besoin métier de cette ligne reste entier** : aucun CA, aucune dernière commande, aucun dernier devis, aucune détection de client dormant. Le journal dit *qui a modifié la fiche*, pas *ce que ce client a acheté*. Ce sont deux historiques différents, et c'est le second qu'un patron ouvre quand le téléphone sonne. |
| 42 | SMS / WhatsApp « pièces prêtes » | ⬜ | **Absent** | Canal unique : e-mail. | Décision fournisseur à prendre avant de coder. |

---

## C7 — Pilotage & rentabilité

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 43 | Prix de revient réel | ✅ | **Partiel** | Vue `projet_revient` : poudre au prix du lot, main d'œuvre depuis les pointages, énergie au prorata de surface, frais généraux en %. | **Consommables absents** de la vue (cf. #33) — et ils sont cités dans la définition de la fonction. La marge affichée sur la fiche projet ignore la non-qualité, contrairement à celle du pilotage. |
| 44 | Tableau de bord de gestion | 🔶 | **Partiel** | 3 onglets : charge du four, rentabilité client, rendement teintes. | **Pas de série temporelle de CA**, **pas de top teintes** (l'onglet trie par taux de perte, pas par volume ni par CA), m² présents seulement en file d'attente, jamais en m² produits par mois. |
| 45 | Coût énergétique par fournée | ✅ | **Fait le 20/08** | `conso_kwh × prix_kwh` sur la fournée terminée et sur la fiche de cuisson PDF, **ramené au m² embarqué** ; alerte chiffrée sous 50 % de remplissage. `src/lib/energie.ts`. | Aucun euro n'est affiché sans `prix_kwh` : l'écran dit quoi renseigner et où. Cf. `RECETTE-LOT2.md` §7.1. |
| 46 | Rentabilité par client | ✅ | **Opérationnel** | Vue `client_rentabilite` : projets, m² moyen, délai, non-qualité, facturé, revient, marge € et %. Tri par marge croissante, bandeau des clients en perte. | ✅ **Corrigé ce jour** : l'écran était **injoignable sur mobile** (absent de `BottomNav`) — sur le poste de travail réel de l'atelier. |

---

## C8 — Réglementaire & sécurité

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 47 | Registre déchets / Trackdéchets | ✅ | **Partiel** | Registre R.541-43 avec nomenclature pré-chargée, alerte « dangereux sans bordereau », PDF paysage, 11 tests. | **Aucune intégration Trackdéchets** (le n° de bordereau est un champ texte). Et **1 seule ligne en base sur les deux ateliers** : jamais utilisé en vrai. |
| 48 | Classeur FDS mobile | ✅ | **Partiel** | Recherche sans accents, alerte > 3 ans, boutons 44 px. | **1 fiche en base.** La fiche n'est qu'un **lien externe** : hors ligne ou lien mort = pas de FDS. `fds.document_url`, prévue pour l'héberger, n'est ni écrite ni lue. Aucun raccourci « voir la FDS » depuis la fiche poudre, le projet ou la fournée — c'est-à-dire depuis l'endroit où on en a besoin. |
| 49 | Vérifications périodiques (ATEX…) | ⬜ | **Absent** | Aucune table, aucun écran, 1 seul hit en commentaire. | Tout. |
| 50 | Maintenance des équipements | ⬜ | **Absent** | Aucune table. | Tout. |

---

## C9 — Plateforme & technique

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 51 | Notifications push PWA | ⬜ | **Absent** | 0 occurrence de `PushManager`, `vapid`, `showNotification`. | Tout. |
| 52 | Mode hors-ligne réel | ⬜ | **Coquille** | `public/sw.js` existe (26 lignes) et est servi en prod. Mais l'`install` **ne précache rien** (première visite hors-ligne = page blanche), seules 5 routes sont couvertes — ni `/fournees`, ni `/qualite`, **ni `/scan/[qr]`, l'écran le plus utilisé sans réseau** — et **aucune file d'écriture** : tout pointage échoue sans reprise. C'est « la dernière page vue », pas un mode hors-ligne. | Précache réel, file IndexedDB ou Background Sync. |
| 53 | i18n FR/IT | 🔶 | **Partiel — conforme à l'annonce** | ~110 clés typées × 2 langues, consommées par exactement 5 composants publics. Persistance `localStorage` + `?lang=` + `navigator.language`. | Écrans atelier, **PDF serveur** et mails restent en français. |
| 54 | Import CSV/XLSX | ✅ | **Opérationnel** | 3 modèles, parseur CSV + lecteur XLSX maison (aucune dépendance `xlsx`), aperçu avant écriture, dédoublonnage, insertion par paquets. 24 tests. Lien depuis `reglages:636`. | ⚠️ **Corrigé le 21/08 — la phrase précédente était fausse.** La checklist de démarrage **y renvoie** : `ChecklistDemarrage.tsx:33-39`, étape 2 « Amenez vos clients », `href: "/import"`, bouton « Importer depuis un tableur », avec un texte qui dit exactement pourquoi. Le fichier est daté du **19/08 à 16 h 28** : c'était déjà vrai quand l'audit l'a écrit. Reste vrai : l'entrée manuelle est dans le 8ᵉ onglet des Réglages (`reglages:1499`). |
| 55 | Multi-sites | ⬜ | **Absent** | Aucune colonne `site_id`. | Tout. |
| 56 | API publique + webhooks | ⬜ | **Absent** | Aucune table de clés, aucun webhook sortant. Le seul webhook est entrant et Stripe-only. | Tout. |
| 57 | Sauvegarde / export total | ✅ | **Opérationnel — la régression annoncée le 20/08 était déjà réparée** | ⚠️ **Reclassé le 21/08.** L'audit a été enregistré à **18 h 53** et `src/lib/export/donnees.ts` à **19 h 05** : la ligne décrivait un état vieux de douze minutes. État réel relu ce matin : `TABLES_EXPORT` liste **52 tables**, `TABLES_HORS_EXPORT` en écarte **4** avec un motif écrit (`compteurs`, `reglages_app`, `leads`, `analytics_events`) — **52 + 4 = 56**, exactement le nombre de tables de la base. Comparaison SQL de la liste du fichier à `pg_class` : **zéro écart dans les deux sens**. Les dix tables nommées comme manquantes y sont toutes, y compris `ateliers_bancaire` (IBAN), `ateliers_couts` (taux horaire, frais généraux), `poudre_couts` et `poudre_lot_couts` (prix d'achat au kilo). Le mécanisme est inchangé : archive ZIP écrite à la main, un CSV par table + un JSON, pagination 1 000, RLS appliquée et attaquée depuis un client anonyme. | **Le défaut de méthode est fermé lui aussi** : `export-donnees.test.ts` ne se compare plus à lui-même, il lit l'inventaire réel par la RPC `tables_du_schema_public()` (présente en base, `SECURITY INVOKER`, réservée à `authenticated`) et **refuse de s'exécuter si le référentiel rend moins de 40 tables**. Toute table nouvelle doit être dans l'une des deux listes ou la suite tombe. Rappel inchangé : les fichiers binaires ne sont pas dans l'archive, seuls leurs chemins. |
| 58 | Onboarding guidé | ✅ | **Opérationnel** | Création d'atelier par SIREN avec auto-remplissage, géocodage BAN, garde `if (!membre) redirect("/onboarding")`. Checklist cochée sur **la donnée réelle**, pas sur « j'ai vu l'écran ». | ⚠️ **Corrigé le 21/08 — cette étape existe déjà.** `ChecklistDemarrage.tsx:33-39` : étape 2 « Amenez vos clients », vers `/import`, texte « Vous les avez déjà quelque part : un tableur, un logiciel de facturation, un export ». Reste à faire, réel cette fois : la checklist ne compte que 4 étapes et **ne propose ni le barème au pouce ni le premier jeu de jantes** à un atelier qui a déclaré ce métier à l'inscription — cf. C0/J2. |
| 59 | Compte de démonstration | ✅ | **Opérationnel** | `/demo` répond 307 → `/dashboard` **en production**. Verrou en base et non en UI : trigger `trg_interdire_ecriture_demo` sur **53 tables** *(recompté le 21/08 — la ligne annonçait 38)*, écriture testée et refusée (`DEMO_LECTURE_SEULE`) y compris sur les tables récentes. `verrous_demo_manquants()` rend **0 ligne**. | ✅ Trigger ajouté sur `audit_logs`. Les **3** tables non couvertes sur 56 sont `analytics_events`, `leads` et `reglages_app` : aucune ne porte de donnée d'atelier. Le vrai sujet sur `analytics_events` est l'écriture anonyme (voir S2). **Effet de bord à connaître** : parce que la démo est verrouillée en écriture et qu'elle détient **100 % des données jantes**, le module C0 ne peut structurellement pas être exercé là où il a ses données. |
| 60 | Domaine propre thermogestion.fr | 🔶 | **Absent (pas 🔶)** | `grep "thermogestion\.fr" src/` → **0 résultat**. `SITE_URL` retombe sur `thermogestion-v2.vercel.app`, qui alimente `metadataBase`, les URLs Stripe et les mails. | Acheter le domaine et poser `NEXT_PUBLIC_SITE_URL`. Le code est effectivement prêt : une seule variable. |
| 61 | Abonnement Stripe | 🔶 | **Codé, mort en prod, et à échéance** | `POST /api/stripe/webhook` → `{"error":"Stripe non configuré."}` : `STRIPE_SECRET_KEY` absente. Manquent aussi `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID` et les 4 prix par `lookup_key`. | **Voir R7 : le blocage, lui, n'est pas désactivé.** Décision à prendre avant le 12/09/2026. |

---

## C10 — Ce que les sept chantiers ont ouvert *(20/08/2026)*

*Six lignes qui n'existaient pas dans l'inventaire des 61. Chacune est vérifiée en base ; aucune
n'a été vue à l'écran.*

| # | Fonction | CDC | **Réel** | Preuve | Reste à faire |
|---|---|---|---|---|---|
| 62 | **Recherche globale + pagination serveur** | — | **Opérationnel (nouveau)** | Colonne générée `recherche` sur **10 tables** (`is_generated = ALWAYS`, relu ce soir), `pg_trgm` + `btree_gin` installées, 10 index `gin (atelier_id, recherche gin_trgm_ops)`. RPC `recherche_globale(q, limite)` en **`SECURITY INVOKER`** : elle subit la RLS de l'appelant, d'où zéro ligne pour un anonyme — testé. Plancher à 2 caractères. Les documents sont retrouvés **par le nom de leur client**, résolu d'abord puis tiré par clé étrangère. Hook `useListePaginee` sur **10 listes** *(recompté le 21/08 : `bl`, `clients`, `corbeille`, `devis`, `factures`, `jantes`, `lots`, `projets/histo`, `receptions`, `stock`)* ; filtre, tri et plage partis en base. | **Elle ne filtre pas `deleted_at`** — confirmé le 21/08 en relisant la source complète de la fonction : aucune des dix requêtes ne mentionne `deleted_at`, seule celle des clients écarte `archive`. Un devis, une facture, un projet, un BL ou une réception à la corbeille remonte dans la palette de recherche, avec son numéro et son montant. Et **les index trigrammes sont inertes sous RLS** — `textlike` n'étant pas *leakproof*, PostgreSQL ne les emploie jamais sous une clause de sécurité : ce qui rend la recherche rapide est la colonne stockée, pas l'index. |
| 63 | **Trois rôles appliqués en RLS** | — | **Opérationnel (nouveau)** | `users.role` contraint à `owner` / `bureau` / `atelier` / `comptable`. Compté ce soir : **90 politiques**, dont **49** nomment un rôle (41 `acces_commercial()`, 8 `is_owner()`, 2 `est_comptable()`) — il y en avait **0**. Quatre tables satellites isolent le sensible (`ateliers_bancaire` → `iban`/`bic`, `ateliers_couts` → `taux_horaire`/`frais_generaux_pct`, `poudre_couts` et `poudre_lot_couts` → `prix_kg`), parce qu'un privilège de colonne s'accorde à un rôle **Postgres** et que les trois rôles applicatifs partagent `authenticated`. Aucune des quatre n'accorde quoi que ce soit à `anon`. `roles-rls.test.ts` : trois sessions réelles, 29 épreuves, refus vérifiés **sur l'état après coup**. | Conséquence non traitée : le déplacement des colonnes a fait décrocher l'export CGU (#57). Et `ateliers_couts` / `ateliers_bancaire` appellent `acces_commercial()` sans `(select …)` — sans effet (une ligne par atelier), mais hétérogène. |
| 64 | **Pièces jointes** | — | **Opérationnel (nouveau)** | Table `pieces_jointes` (rattachement polymorphe `entite`/`entite_id`), bucket **`documents` privé, plafonné à 10 Mo** (relu dans `storage.buckets`). Le chemin commence par l'identifiant de l'atelier — ce que la policy Storage regarde — et le nom du fichier ne peut pas fabriquer de sous-dossier. 18 épreuves, dont le dépôt direct dans le bucket d'un format hors liste et hors dossier : **la borne est côté service, pas côté écran**. | **Aucune pièce jointe n'a jamais été déposée** (0 ligne). Absente de l'export CGU (#57). |
| 65 | **Corbeille + doublons** | — | **Opérationnel (nouveau)** | `deleted_at` sur **6 entités**, écran `/corbeille`, purge à **30 jours** (`jours_corbeille()`), cron `purger-corbeille` 03 h 30 — **non exposé à l'API**, testé. On ne jette pas ce qui soutient un document comptable émis (facture émise, devis porté, projet facturé, BL consommé, client porteur de pièces : tous refusés avec un message qui dit quoi faire). Jeter un brouillon de facture **libère les bons qu'il portait**. Un client sans pièce revient **archivé, pas actif**. Un document jeté cesse d'exister pour le monde extérieur (lien public vide). Doublons : **4 index uniques** (nom client, SIRET, marque+référence poudre, code prestation) et **une seule** normalisation partagée code/base, comparée caractère par caractère. | Rien de bloquant identifié. |
| 66 | **Journal des modifications** | — | **Opérationnel en code, jamais exercé** | `trg_journal` sur **15 tables** (compté ce soir). Seuls les champs réellement modifiés sont enregistrés ; réécrire la même valeur n'écrit rien ; la colonne générée `recherche` est exclue. **Table inaltérable** : une seule policy sur `audit_logs`, `owner_select` — **aucune** policy `INSERT`/`UPDATE`/`DELETE`, y compris pour le responsable, vérifié en relisant la ligne après la tentative. Rétention **730 jours** (`jours_journal()`), cron `purger-journal` 03 h 45. Panneau Historique en français sur **4 fiches** (client, devis, facture, projet). | **`audit_logs` compte 0 ligne** sur les deux ateliers de production : le journal n'a jamais enregistré une modification réelle. Même motif de « coquille de fait » que #39 et #34 — la première modification à l'écran lèvera le doute. |
| 67 | **Accès expert-comptable** | — | **Opérationnel en code, jamais exercé** | Rôle `comptable`, **gratuit et plafonné à 2** (`plafond_comptables()` = 2), **hors siège facturé** : `sieges_occupes()` exclut `role <> 'comptable'` sur les membres **et** les invitations. Espace `/comptable` séparé, `journal_ventes(début, fin)`, export FEC de la période, trace de remise (`exports_comptables`), cadence réglable (`reglages_comptable`), cron `tg-export-comptable` 06 h 20. `comptable-lecture-seule.test.ts` (29,5 Ko, le plus gros fichier de la suite) : **30 tables rendent zéro ligne**, 13 `INSERT`, 5 `UPDATE`, 3 `DELETE` et 4 RPC refusés, **tous vérifiés sur l'état avec le compte du responsable**. | **0 utilisateur au rôle `comptable`, 0 export remis.** Aucun cabinet réel n'a jamais ouvert cet espace. Les deux tables sont absentes de l'export CGU (#57). |

---

# Les coquilles

Cinq réglages fantômes avaient déjà été fermés sur ce projet (forfait minimum, coefficient de
couches, `coef_complexite`, label qualité, seuils codés en dur). En voici **treize de plus** —
onze trouvées le 19/08, une le 20/08 (C-12) et une le 21/08 (C-13) — dont **neuf** sont
aujourd'hui fermées : six le 19/08, trois de plus le 20/08 (C-10, C-11, C-12).

| # | Coquille | Preuve | Traitement |
|---|---|---|---|
| C-1 | **`pieces_types.perimetre_mm`** | Éditable `reglages:462`, le texte d'aide promet qu'il « convertit la longueur ml en surface équivalente ». `ajouterPieceType` ne le lit **jamais**. Renseigné sur **0 pièce sur 7** — personne n'a jamais réussi à s'en servir. | Ouvert (≈ 2 h) |
| C-2 | **`pieces_types.longueur_ml`** | Éditable et seedé à 3 et 1. Aucune lecture. Une pièce type « Portail 3 m » ne produira jamais une ligne au ml. | Ouvert |
| C-3 | **`pieces_types.temps_minutes`** | Recopié dans `meta`, jamais relu. `reglages:477` promet « il vous sert à mesurer votre rentabilité » : faux, la main d'œuvre vient des pointages réels. Aucun écart estimé/réel n'est exposé. | Ouvert |
| C-4 | **`clients.grille_id`** | Lecture correcte, sélecteur présent, mais **aucun écran ne crée de seconde grille**. Le bandeau « Grille dédiée appliquée » est inatteignable par construction. | Ouvert |
| C-5 | **`prestations.tva_rate`** | Lu partout (devis, BL, facture, Factur-X), saisissable nulle part hors import CSV. **Les 10 prestations sont bloquées à 20 %.** | ✅ **Corrigé** — sélecteur ajouté dans Réglages > Prestations |
| C-6 | **`ateliers.assujetti_tva`** | Lu 6 fois, **écrit nulle part**. Un atelier en franchise en base ne pouvait pas faire apparaître l'article 293 B. | ✅ **Corrigé** — case dans Réglages > Identité légale |
| C-7 | **`factures.recapitulatif`** | Doublon mort de `recapitulative`. 0 occurrence dans `src/`, 0 dans les fonctions SQL. Deux colonnes quasi homonymes dans la même table : la mauvaise finit par être testée. | ✅ **Colonne supprimée** |
| C-8 | **`ateliers.four_longueur_m`** | Écrit et saisi dans Réglages, **lu nulle part**. | Ouvert (retirer ou câbler) |
| C-9 | ~~**`factures.facture_liee_id`**~~ · ~~**`devis.parent_id`**~~ · ~~**`devis.version`**~~ · **`projets.pieces`** · **`projets.lot_poudre`** · **`poudres.numero_lot` / `.date_peremption` / `.fiche_technique_url` / `.fds_url`** · **`receptions.date_reception`** · **`certifications.document_url`** · **`fds.document_url`** | 0 occurrence dans tout `src/` (vérifié par grep exhaustif). Douze colonnes mortes. | Ouvert (migration de nettoyage) — ✅ `facture_liee_id` **câblée par le lot 6** ; ✅ `parent_id` et `version` **câblées le 20/08** (`nouvelle_version_devis` + chaînage affiché sur la fiche) : **neuf restantes** |
| C-10 | **`factures.relances_actives` / `relance_count`** · **`devis.relances_actives`** | Écrits par le cron, **jamais affichés ni pilotables**. L'atelier ne peut ni voir ni couper une relance envoyée en son nom. | ✅ **Fermée le 20/08** — écran `/relances`, interrupteur par client **et** par document, date annoncée = date que le cron appliquera (égalité figée par test) |
| C-11 | **`factures.status='annulee'`** | Géré partout en lecture (badge, PDF « ANNULÉE », exclusion FEC et CSV, page publique), **aucun bouton ne peut le poser**. | ✅ **Fermée le 20/08** — RPC `annuler_facture(id, motif)`, motif obligatoire, numéro non libéré, refus sur facture payée ou encaissée |
| C-12 | **`clients.archive` sans retour** | `archive = true` était le seul retrait possible et **aucun écran ne permettait de revenir en arrière** : archiver par erreur était irréversible depuis l'interface, il fallait passer par la base. | ✅ **Fermée le 20/08** — bouton « Désarchiver » sur la fiche client |
| **C-13** | **`devis.status = 'expire'` · `devis.validite_jours`** *(21/08)* | **Jumeau exact de C-11, et personne ne l'avait vu.** `expire` est une valeur autorisée par `devis_status_check`, elle est **lue** — filtre « Refusés / expirés » (`devis/page.tsx:25`), `peutRouvrir` (`devis/[id]:136`), type TS (`types.ts:140`) — et elle n'est **écrite nulle part** : zéro occurrence en écriture dans `src/`, et aucune fonction du schéma ne la pose (recherche sur `prosrc` des 131 fonctions), aucun cron non plus. Conséquence en cascade : `devis.validite_jours` (30 sur les 12 devis en base) est imprimé sur le PDF — « valable 30 jours » (`lib/pdf/document.tsx:488` et `:527`) — et sur la page publique (`DevisPublicClient.tsx:112` et `:156`), et **rien ne fait jamais expirer le devis**. `signer_devis` (source relue) ne contrôle aucune date : un devis de l'an dernier se signe encore aujourd'hui, au prix de l'an dernier, et `trg_devis_signe` crée le projet derrière. Le cron de relance, lui, continue de relancer un devis périmé jusqu'au plafond. | **Ouvert.** Deux sorties : soit un travail de fond passe les devis en `expire` au-delà de `validite_jours` et `signer_devis` refuse, soit on retire la mention de validité des documents. Ce qu'on ne peut pas garder, c'est l'écart entre les deux. |

**Coquilles de fait** (le code est juste, la fonction n'a jamais pu s'exécuter) : #39 avis Google
(l'URL n'est renseignée que sur l'atelier démo, où l'écriture est refusée), #34 commande poudre
(jamais envoyée), #13 étiquettes (QR sans document à imprimer), #37 photos de réception (0 photo).

**Une coquille de fait fermée le 20/08, et cinq ouvertes le même jour.** Fermée : le bouton
« **Prévenir le client** » d'une facture. Il insérait directement dans `notifications`, table qui
n'a **aucune policy `INSERT`** — PostgREST refusait, silencieusement du point de vue de
l'exploitant. Preuve : sur les **16** notifications existantes, **zéro `facture_emise`**, alors
qu'on compte 4 `devis_signe`, 8 `projet_etape`, 2 `devis_relance`, 1 `facture_relance` et
1 `bl_signe`. Le bouton existait, il ne faisait rien depuis le premier jour.

Ouvertes le 20/08, toutes du même motif — **le code est là, la fonction n'a jamais tourné en
vrai** : le **courriel du matin** (0 destinataire, 0 envoi), le **journal** (0 ligne), le
**portail client** (0 espace ouvert), l'**accès comptable** (0 utilisateur, 0 export remis), les
**pièces jointes** (0 fichier). Cinq fonctions livrées et prouvées par test, zéro usage réel. C'est
exactement l'état dans lequel #34 et #39 étaient au moment où l'audit les a classées coquilles.

> **Recompté le 21/08.** Une des cinq est sortie de la liste : le **courriel du matin est parti**
> (1 `recap_quotidien` `sent` le 21/08 à 05 h 05 UTC, 1 destinataire). Les quatre autres n'ont
> toujours pas bougé : `audit_logs` **0 ligne**, `client_portail` **0 ligne**, `pieces_jointes`
> **0 ligne**, **0 utilisateur `comptable`** et `exports_comptables` **0 ligne**. La table
> `notifications` est passée de 16 à **18** lignes, et il n'y a **toujours aucun `facture_emise`** :
> la RPC `notifier_facture_emise` est bien en place (`SECURITY DEFINER`, `EXECUTE` révoqué à `anon`,
> vérifié), mais personne n'a encore cliqué. La correction est prouvée par le code, pas par un envoi.
> **À ces quatre s'ajoute tout le module jantes** (section C0) : 0 dossier, 0 photo, 0 signature,
> 0 devis chez le seul atelier réel. C'est la sixième.

**Coquilles secondaires** : `controles_bains.operateur_id` (saisi, absent du registre PDF présenté
à l'auditeur), `non_conformites.surface_m2` et `.fournee_id` (saisis, 0 lecture),
`temps_etapes.user_id` (renseigné sur 24/28 lignes — **32 aujourd'hui** —, jamais affiché),
`bons_livraison.signature_ip` et `receptions.signature_ip` (preuve stockée, inexploitable en
litige), `fds.poudre_id`, `dechets.created_by`, `tarifs_ml.description` (saisie et **relue** dans
Réglages, `reglages:894`, mais jamais réaffichée sur un devis ni un document).

**Ajoutées le 21/08, du côté jantes** : `vehicules.tp_product_id` (prévu pour rattacher la teinte
d'origine au catalogue Thermopoudre, **nul sur les deux véhicules en base** — l'import 1 clic n'a
jamais servi ici) ; et une perte de couture — les réserves **par jante** (`jantes.reserves`) sont
bien imprimées sur le bon et sur la page publique (`lib/pdf/jantes.tsx:155`,
`JeuJantesPublicClient.tsx:177`), mais quand le dossier devient un projet, seules les réserves **du
jeu** sont recopiées dans les notes (`jantes/[id]:156`) : la roue avant droite fissurée disparaît
du dossier de production.

---

# Les ruptures de chaîne

## R1 — Le verdict qualité n'était jamais recalculé côté serveur ✅ *(corrigé — lot 6)*

C'était le point qui faisait tomber la promesse du produit.

`conforme` est calculé dans le navigateur (`ControleForm.tsx:104`) et envoyé tel quel. Le trigger
`controle_seuils_appliques` fige bien une copie du barème, et `figer_controle` refuse bien toute
modification ultérieure — mais **rien ne vérifie que le verdict correspond aux valeurs**.

Vérifié en base, transaction annulée : `INSERT` d'un contrôle d'épaisseur `mini = 10 µm` avec
`conforme = true` est **accepté**, et se retrouve figé avec un snapshot annonçant un seuil de
60 µm. Le certificat et le registre impriment ensuite « Conforme » sous un barème à 60 µm.

Le cahier des charges affirme que le verdict est « immuable en base » et « prouvé par test depuis
un client externe ». C'est vrai de la *modification*, pas de la *création*. Un contrôle faux à la
naissance est figé faux pour toujours.

**Corrigé** : `public.verdict_controle(type, valeurs, seuils)` en plpgsql, réplique exacte de
`calculerConformite` (`lib/qualite.ts:170`), appelée par `trg_controle_seuils_appliques` **après**
le figeage du barème. `new.conforme` est écrasé quelle que soit la valeur envoyée. Le helper
`_controle_num` encaisse les `"62"`, `""` et valeurs incastables du navigateur sans jamais lever.
21 tests dans `tests/verdict-qualite-serveur.test.ts`, attaque PostgREST authentifiée **et** anonyme,
dans les deux sens du mensonge (un relevé conforme ne se déclare pas non conforme non plus).

## R2 — L'immutabilité ne couvrait pas la suppression ✅ *(corrigé — lot 6)*

Politique RLS `tenant_all` `FOR ALL` sur `controles` : le `DELETE` était **accepté**. Un contrôle
non conforme gênant s'effaçait en un appel PostgREST, et le certificat redevenait émettable.
« Le verdict est immuable » n'était vrai qu'au sens `UPDATE`.

**Corrigé par la policy, pas par un trigger** : `tenant_all` est remplacée par trois policies
`SELECT` / `INSERT` / `UPDATE`, et **aucune policy `DELETE` n'existe**. Le choix est délibéré — la
première version de `figer_controle` avait déjà bloqué le `ON DELETE SET NULL` d'une clé étrangère
et fait échouer *silencieusement* la suppression d'un référentiel, et un `BEFORE DELETE` naïf
casserait la cascade de `supprimer_atelier_test`, dont dépend le nettoyage de la suite de tests. Une
policy ne gêne ni l'une ni l'autre : les 27 tests de `seuils-qualite` sont restés verts sans retouche.

La correction d'une erreur de saisie passe par une nouvelle mesure, qui prime. **Reste ouvert** : le
mode « annulation » (un contrôle annulé qui resterait au registre, barré) n'a pas été implémenté.

## R3 — La remise disparaissait de la facture récapitulative ✅ *(corrigé)*

**Quatrième occurrence de la même famille de bug.** `facture_recapitulative` aplatissait les lignes
des bons de livraison sans jamais ouvrir `bons_livraison.remise` : un client contractualisé à −12 %
dont on regroupait les livraisons du mois était **facturé plein tarif**, et le Factur-X derrière
portait le total plein.

La remise est désormais reportée **par bon et par taux de TVA**, sous forme d'une ligne négative
explicite `BL-2026-00xx — Remise 12 %`. Pas d'application silencieuse sur les prix unitaires : sur
une récapitulative, le client doit pouvoir rapprocher chaque montant du bon d'origine. Les lignes de
forfait minimum restent hors assiette, et leur `meta` est recopié pour que la règle survive.

Le nouveau fichier `tests/facture-recapitulative.test.ts` fige ce contrat en 4 tests.

## R4 — Un bon de livraison pouvait être facturé deux fois ✅ *(corrigé — lot 6)*

`bons_livraison.facture_id` et `status='facture'` n'étaient posés **que** par la RPC récapitulative.
Aucune écriture côté application : `FactureEditor` ne rattachait jamais le BL qu'il facturait.

Preuve en base : **BL-2026-0011, 420,30 € HT, livré le 28/07, `status='livre'`, `facture_id` nul**
— alors que **FA-2026-0031 (420,30 € HT, payée)** facturait déjà son projet.

**Corrigé en base**, pas dans l'écran : trigger `facture_consomme_bl` (une facture `solde` ou `libre`
rattachée à un projet consomme ses bons ; un acompte et un avoir n'en consomment aucun),
`facture_libere_bl` en `BEFORE DELETE` (il faut passer avant le `ON DELETE SET NULL` de la clé
étrangère, sinon le bon reste « facturé » sans facture), libération sur `status='annulee'`,
`trg_bl_facture_unique` qui lève `BL_DEJA_FACTURE` et empêche `status` et `facture_id` de diverger,
index unique `factures_un_solde_par_devis`, et verrou `FOR UPDATE` dans la récapitulative.
**Données régularisées** : BL-2026-0011 → FA-2026-0031, BL-2026-0001 remis d'accord avec son statut.

*Trouvé par le test au passage* : le verrou `FOR UPDATE` combiné à un `array_agg` est refusé par
Postgres, ce qui cassait la récapitulative. Le verrou se pose désormais en deux temps.

## R5 — La remise disparaissait du bon de livraison ✅ *(corrigé)*

`BonLivraisonEditor.tsx` redéfinissait **localement** une fonction `lignesDepuisDevis` qui, contrairement
à celle de `lib/calculs.ts`, **ne recopiait pas `meta`**. Or `estForfaitMinimum` reconnaît la ligne de
plancher uniquement par `meta.forfait_minimum`. Résultat : sur le BL, le forfait minimum retombait
dans l'assiette de remise et était remisé.

Cas réel : DV-2026-0009, 1 ligne de forfait minimum, remise 12 %, total 25,00 €. Le BL affichait
22,00 €. La reprise passe désormais par la fonction partagée, `LigneBL` porte `meta`.

## R6 — Un acompte fermait la porte au solde ✅ *(corrigé — lot 6)*

`FactureEditor:47` retirait de la liste tout devis portant **au moins une** facture. Après une
facture d'acompte, le devis disparaissait : impossible de générer le solde. Aucune déduction
d'acompte n'existait par ailleurs — `calcTotaux` ne connaissait pas la notion.

Preuve : FA-2026-0030 est un acompte de 534,67 € ; son devis n'était plus proposable.

**Corrigé** : un devis n'est fermé que par la facture qui règle le chantier (`solde` ou `libre`, non
annulée), doublé en base par un index unique. Le solde reprend le chantier et déduit les acomptes en
**ligne explicite par acompte et par taux de TVA** — un acompte à deux taux se déduit à l'identique,
sinon la ventilation du solde, le FEC et le Factur-X sortent faux. La remise ne porte pas une seconde
fois sur l'acompte déduit (même traitement hors assiette que le forfait minimum, pour la raison
inverse : la remise a déjà porté sur l'acompte le jour où il a été facturé). `facture_liee_id` est
écrite, et le PDF porte la mention attendue sur une facture de solde.

## R7 — Le paywall est armé, le tiroir-caisse ne l'est pas *(décision, avant le 12/09/2026)*

Le trigger `trg_exiger_abonnement` est **actif sur 40 tables** *(recompté le 21/08 — la ligne
annonçait 32)* et lève `ABONNEMENT_REQUIS` dès que `abonnement_ouvert()` est faux. `subscriptions` :
ThermoTest est en `trialing`, `trial_end` au **12/09/2026** (créé le 13/08 — l'essai de 30 jours
annoncé dans les CGU est bien de 30 jours). Les quatre tables jantes en font partie.

Le 13/09, cet atelier passe en lecture seule, le modal s'affiche, l'utilisateur clique « Voir les
formules » → `/abonnement` → « Souscrire » → `POST /api/billing/checkout` → **HTTP 500, « Paiement
non configuré sur le serveur »**. Cul-de-sac total, aucune issue.

Trois sorties possibles, une seule à choisir : renseigner les trois variables Stripe et créer les
quatre prix ; repousser `trial_end` ; ou désactiver les triggers `exiger_abonnement`.

## R8 — Le pointage ne se fermait jamais ✅ *(corrigé — lot 6)*

La première étape n'était jamais chronométrée (`trg_devis_signe` n'ouvre pas de ligne) et la dernière
ne se fermait jamais : `signer_bl` clôt le projet en marquant toutes les étapes d'un coup, sans
passer par `avancer_etape`. Une ligne ouverte depuis 48 h s'affichait « 48 h » sur la carte
« Temps passé » et comptait **0** dans `projet_temps_cout`.

**Corrigé sur les trois plans** : `projet_temps_cout` compte le chrono en cours
(`coalesce(minutes, temps écoulé)`), `avancer_etape` chronomètre elle-même — les trois appels
`pointer_etape` côté navigateur ont été retirés, une règle qui dépend de trois écrans n'en est pas
une — et `signer_bl` referme les chronos du projet livré. Nouvelle RPC `demarrer_etape` et bouton
« ▶ Démarrer » sur la fiche projet et le scan, affiché seulement quand rien ne tourne.

**Choix assumé** : le chrono n'est pas ouvert à la signature du devis. Un projet attend souvent des
jours en file ; ce temps d'attente n'est pas de la main d'œuvre. C'est un geste explicite de
l'opérateur — ou le démarrage d'un poste partagé (`/pointage`).

## R9 — La charge du four comptait les projets déjà cuits ✅ *(corrigé)*

`estEnCharge` n'excluait que `livre` et `annule`. Les projets au statut `pret` et à l'étape
`controle` — déjà passés au four — pesaient dans la file d'attente : 25,58 m² fantômes sur les
données réelles, et donc des dates de livraison proposées systématiquement trop lointaines.

## R10 — Le délai de paiement négocié ne survivait pas au devis PDF ✅ *(corrigé)*

`joursPaiement(client, atelier)` était appliqué à la facture, mais le PDF du devis écrivait
`atelier.delai_paiement_jours` en dur : un client à 45 jours lisait 30 jours sur son devis, puis 45
sur sa facture. *(La page publique `/d/[token]` a la même incohérence : elle nécessite d'ajouter le
champ à la RPC `devis_public` — non fait, voir « reste à faire ».)*

## R11 — Le certificat contredit le registre sur l'épaisseur *(réduit — lot 6, toujours ouvert)*

`poudres.epaisseur_um_min` / `_max` ne sont lues **qu'en affichage décoratif** sur le certificat
(« 80 à 120 µm »), alors que le verdict d'épaisseur vient exclusivement de `referentiels_qualite`
(seuil de 60 µm par défaut). Deux sources de vérité pour la même grandeur, sur deux documents que
le même auditeur lit côte à côte. Et les deux colonnes ne sont saisissables nulle part.

✅ **Lot 6** : la plage n'est plus imprimée quand aucune mesure d'épaisseur n'est retenue — seule,
elle se lisait comme une épaisseur constatée. Le conflit de sources subsiste dès qu'une mesure existe.

## R12 — La fiche de cuisson devenait injoignable ✅ *(corrigé)*

`/fournees` ne listait que les fournées `planifiee` et `en_cours`, et aucun autre écran ne pointait
vers `/fournees/[id]`. Une fois la fournée clôturée et la page quittée, le PDF de traçabilité —
pièce d'audit — n'était plus atteignable. Historique des 50 dernières ajouté.

## R13 — Un document jeté à la corbeille reste signable de l'extérieur *(trouvé le 21/08, ouvert)*

La migration `32_liens_publics_ignorent_la_corbeille` a fermé les **lecteurs**, et elle le fait
bien : `devis_public`, `facture_public`, `bl_public`, `projet_public`, `reception_public`,
`portail_client` et `portail_liste` filtrent toutes `deleted_at` — vérifié fonction par fonction sur
le source relu en base.

Elle n'a pas touché les **écrivains**. `signer_devis` et `signer_bl` — les deux RPC d'écriture
ouvertes à `anon`, par construction du mécanisme à jeton — **ne regardent pas `deleted_at`**.
Le corps de `signer_devis` tient en six lignes et ne teste que
`public_token = p_token and status = 'envoye'`.

Le scénario est banal : un devis part au client, l'atelier le jette à la corbeille (mauvais client,
doublon, erreur de prix), le client garde le lien reçu par courriel et signe. La page ne montre rien
— le lecteur est fermé — mais **la RPC répond, le devis passe en `signe`**, `trg_devis_signe` crée
le projet et envoie la notification. L'atelier voit apparaître un chantier issu d'un document qu'il
croyait supprimé, et ce document ne réapparaît dans aucune liste puisqu'il est à la corbeille.
Même chose pour `signer_bl`, avec en plus la clôture du projet et la fermeture des chronos.

**Le correctif est d'une ligne dans chacune des deux fonctions.** Le défaut contredit directement
#65, qui affirme qu'« un document jeté cesse d'exister pour le monde extérieur (lien public vide) ».

*Corollaire de méthode* : c'est la troisième fois sur ce projet qu'une règle posée sur le chemin de
lecture est absente du chemin d'écriture — R1 (le verdict qualité), R4 (le rattachement des bons),
R13 ici. Une règle qui n'existe que dans le `select` n'est pas une règle.

---

# Sécurité

*Relu le 20/08 au soir.* RLS activé sur **56/56** tables (la base est passée de 42 à 56 dans la
journée), aucune table métier sans policy, les **6 vues portent toutes `security_invoker`**
(`atelier_conformite`, `client_rentabilite`, `poudre_rendement`, `projet_revient`,
`projet_temps_cout`, `relances_envoyees`). En-têtes de sécurité vérifiés au `curl` en production le
19/08 (`frame-ancestors 'none'`, HSTS preload, `nosniff`) — non revérifiés depuis. **7 crons**
actifs désormais : les 3 historiques plus `purger-corbeille`, `purger-journal`,
`tg-recap-quotidien` et `tg-export-comptable`.

| # | Point | Traitement |
|---|---|---|
| S1 | `tva_intra_depuis_siren` avait un `search_path` mutable — seule fonction du schéma dans ce cas | ✅ **Corrigé** |
| S2 | `analytics_events` : policy `INSERT` ouverte à `anon`. ⚠️ **Reformulé le 21/08 — « `with_check = true`, sans borne » est faux.** La policy `analytics_insert` relue en base porte six bornes explicites : `event ~ '^[a-z][a-z0-9_]{2,39}$'`, `pg_column_size(props) <= 2000`, `char_length(path) <= 300`, `char_length(referrer) <= 500`, format contraint de `visitor_id` et `session_id`, et `user_id = auth.uid()` ou nul. Ce qui reste vrai, et c'est le seul point : **aucune limitation de débit**. Un anonyme peut toujours écrire autant de lignes conformes qu'il veut | Ouvert, réduit |
| S3 | `exiger_abonnement` ne couvre ni `ateliers` ni `users` : un atelier bloqué après l'essai peut toujours modifier sa fiche entreprise et gérer ses membres | Ouvert, impact faible |
| S4 | `supprimer_atelier_test()` (`SECURITY DEFINER`, `delete from ateliers`) est exécutable par `authenticated`. Gardes correctes (`is_owner()` **et** nom `TEST-AUTO-%`), non exploitable en l'état — mais c'est la suite de tests qui l'appelle, on ne peut donc pas simplement la révoquer | Ouvert, à déplacer vers `service_role` |
| S5 | Le service worker met en cache le HTML de `/dashboard`, `/projets`, `/devis`, `/clients`, `/stock` sans purge à la déconnexion. Sur une tablette d'atelier partagée, hors ligne, l'utilisateur B se voit servir le tableau de bord de A | Ouvert |
| S7 | `trg_facture_consomme_bl()` (lot 6) est née `SECURITY DEFINER` et donc exposée en RPC PostgREST à `anon` comme à `authenticated`. Non exploitable hors trigger (`TG_OP` nul), mais la règle du projet est nette | ✅ **Corrigé le jour même** — passée en `SECURITY INVOKER` (elle n'a pas besoin des droits du propriétaire : l'utilisateur possède déjà la facture et les bons du même atelier) et `EXECUTE` révoqué |
| S6 | 7 fonctions `SECURITY DEFINER` exposées à `anon` (`devis_public`, `facture_public`, `bl_public`, `projet_public`, `reception_public`, `signer_devis`, `signer_bl`) : **intentionnel et correct**, c'est le mécanisme des pages à jeton. S'y ajoutent depuis le 20/08 `portail_client`, `portail_liste` et `portail_vu`, du même mécanisme, ainsi que `recherche_globale` — qui est en `SECURITY INVOKER` et rend donc zéro ligne à un anonyme | Accepté — documenté ici pour ne plus être re-signalé |
| **S8** | **Le cron a relancé de vrais clients depuis l'atelier de démonstration.** Le 19/08 à 07 h 00 UTC, deux courriels sont partis de l'atelier `demo` vers `contact@metallerie-sud-demo.fr` et `contact@aluform-demo.fr`, statut `sent` (relu en base). Cause : `trg_interdire_ecriture_demo` lit le rôle du jeton JWT et **laisse passer quand il n'y en a pas** — ce qui est nécessaire pour les travaux de fond, et sous quoi `pg_cron` passait. Aucun test ne pouvait le voir : ils s'authentifient tous | ✅ **Corrigé dans le cron, pas dans le trigger** : `relancer_devis_et_factures()` porte `and not coalesce(at.demo, false)` dans ses deux boucles, `envoyer_recap_quotidien()` la même condition. **Reste ouvert** : rien ne garantit que le prochain travail de fond y pensera — le garde-fou est une clause répétée, pas une propriété de la base. ✅ **Confirmé par les données le 21/08** : le cron de 07 h 00 a produit **une seule** relance, `devis_relance` vers `sophie.testonne@chaudronnerie-test.fr`, atelier **ThermoTest** (`demo = false`). Aucune notification n'est partie de l'atelier `demo`, dont les deux derniers envois restent ceux du 19/08 |
| **S9** | **Aucun échappement HTML dans les modèles de courriel.** `process_notifications()` construit le HTML en concaténant `payload->>'…'`. Un nom de client contenant `<` ou `"` casse le message ; un contenu hostile fait pire | **Ouvert à 9/11.** `echapper_html(text)` existe et n'est appelée que par `recap_quotidien_html` (21 fois). Les neuf modèles historiques — `devis_signe`, `bl_signe`, `projet_etape`, `devis_relance`, `facture_emise`, `facture_relance`, `facture_payee`, `commande_poudre`, `avis_google` — concatènent toujours directement. À faire avant le premier client réel |
| **S10** | **`revoke … from public` ne suffit pas sur Supabase** : des `ALTER DEFAULT PRIVILEGES` accordent `EXECUTE` **nommément** à `anon` et `authenticated` sur toute fonction nouvelle. Trois passages de révocation ont été nécessaires le 20/08, chacun découvrant une fonction créée entre les deux précédents | ✅ **État final vérifié fonction par fonction** : `recap_quotidien_payload`, `recap_quotidien_html`, `reglages_alertes_de`, `envoyer_recap_quotidien`, `purger_journal`, `purger_corbeille`, `programmer_exports_comptables` et `trg_journal` ne sont exécutables ni par `anon` ni par `authenticated`. **Résidu, recompté le 21/08 dans `information_schema.role_table_grants`** : **cinq** tables et non quatre portent encore des `GRANT` à `anon` — `notifications`, `pieces_jointes`, `exports_comptables` et `reglages_comptable` en `SELECT/INSERT/UPDATE/DELETE`, `audit_logs` en `SELECT` seul. `reglages_comptable` manquait à la liste. Sans fuite, la RLS ne leur ouvrant aucune policy à `anon`, mais à retirer — et c'est bien la démonstration que le mécanisme continue de réarmer tout seul |
| **S11** | **`CREATE OR REPLACE VIEW` sans clause `WITH` remet les `reloptions` à zéro.** Une migration a fait perdre en silence le `security_invoker` de `client_rentabilite` — la fuite du lot 2 revenue par la porte de service. Le test « aucune ligne d'un autre atelier » **ne l'aurait pas détectée**, la clause de formule de la vue masquant la fuite | ✅ **Rattrapé** — les 6 vues portent l'option ce soir. Règle : une vue se remplace **toujours** avec sa clause `WITH (security_invoker = true)`, même quand on ne touche qu'au `select` |
| **S12** | **`supprimer_atelier_test()` ne supprimait plus rien.** Le garde-fou `DERNIER_PROPRIETAIRE` posé avec les rôles se déclenchait sur la suppression **en cascade** des `users` d'un atelier qu'on est justement en train de supprimer : la suite de tests laissait un atelier jetable derrière elle à chaque passage | ✅ **Corrigé** dans `trg_garde_role` par une exemption explicite (*« il n'y a plus d'atelier à laisser sans patron »*). **Le corollaire compte plus que le bug** : un client demandant l'effacement de ses données se serait heurté au même mur |

---

# Ce que la suite de tests couvre réellement

⚠️ **Chiffre corrigé le 21/08.** Le document annonçait « 923 tests » ; le **dernier passage réel**
de la suite, celui qui a suivi la réparation de #57, dit autre chose. `testExportGardeFou.log`,
20/08 à 19 h 28, 115,73 s : **947 passés, 4 ignorés, 951 au total, 50 fichiers**. Les 4 ignorés sont
ceux qui exigent la clé `service_role`, absente de `.env.test` : ils s'annoncent ignorés plutôt que
verts à vide — deux `describe.skip`, dans `demo-lecture-seule` et `sieges`. Progression réelle :
355 à la date de cet audit, 518 après les sièges et le Factur-X, **951** après les sept chantiers.
*(Je n'ai pas rejoué la suite non plus — un autre travail l'occupait. J'ai lu le journal du dernier
passage au lieu de recopier un compte rendu, ce qui est la seule différence.)*

Ce qu'elle couvre bien : les **contrats de RPC** et les **fonctions pures**. Les 18 tests de
`pages-publiques` figent le contrat des cinq RPC publiques — une RPC qui cesse d'exposer un champ
fait tomber un test au lieu de faire disparaître de l'argent sur l'écran d'un client. Les 27 tests
de `seuils-qualite`, les 17 de `securite-rpc` et les 9 de `demo-lecture-seule` **attaquent la base
depuis un client PostgREST ordinaire et depuis un client anonyme** : c'est la meilleure partie de
la suite, et elle vaut mieux que ce que fait la plupart des projets de cette taille.

**Ce qu'elle ne peut structurellement pas voir, et qui explique cet audit :**

1. **Aucun test de composant, aucun test de bout en bout.** Zéro rendu React dans les **50** fichiers
   *(le document disait 27 — chiffre d'une version antérieure de la suite)*. Vérifié le 21/08 :
   `package.json` ne contient **aucune** dépendance de test d'interface — ni `@testing-library`, ni
   `playwright`, ni `jsdom` ; les deux seules occurrences de `render` dans `tests/` sont
   `renderToBuffer` de `@react-pdf/renderer`, c'est-à-dire la fabrication d'un PDF, pas d'un écran.
   Les coquilles listées plus haut sont toutes de la forme « la valeur est bien enregistrée,
   personne ne la relit » — invisible pour un test qui n'ouvre jamais l'écran.
2. **Aucun test ne suit une donnée d'un écran à l'autre.** R5 (la remise perdue du BL) vivait dans
   une fonction locale de 10 lignes recopiée à côté de la bonne : chaque moitié était correcte,
   c'est la couture qui ne l'était pas.
3. **Un test vert prouve que la RPC répond, pas que quelqu'un l'appelle.** #34 (commande poudre)
   a 16 tests verts et n'a jamais été envoyée une seule fois en production. #39 (avis Google) est
   entièrement câblé et n'a jamais pu se déclencher.
4. **Les vues ne sont pas testées sur leur pertinence métier.** `calculerCharge` avait 15 tests
   verts en comptant les projets déjà cuits : les tests vérifiaient l'arithmétique, pas le
   périmètre.
5. **Un test qui se compare à lui-même ne prouve rien** *(ajouté le 20/08)*.
   `export-donnees.test.ts:63` vérifie que l'archive contient autant de tables que
   `TABLES_EXPORT.length`, et `:123` que les clés du JSON sont celles de `TABLES_EXPORT`. Les deux
   sont verts par construction, quel que soit le périmètre réel. C'est ce qui a laissé passer la
   régression du #57 : dix tables ajoutées dans la journée, aucune dans l'archive, aucun test rouge.
   Le contrôle juste se fait contre `information_schema` avec une liste d'exclusions explicite.
6. **Un test authentifié ne voit pas ce que fait un travail de fond** *(ajouté le 20/08)*. Toute la
   suite s'authentifie ; le cron, lui, s'exécute sans jeton. C'est précisément par là que les
   relances de l'atelier de démonstration sont parties (S8), et aucun test n'aurait pu le voir.

---

# Synthèse

## Le compte

L'inventaire compte **65 lignes** (61 fonctions + 1b, 1c, 11b, 21b, 28b), **71** avec la section
C10, et **83** avec les douze lignes du module jantes que le `CAHIER-DES-CHARGES-MASTER.md` §C0
portait déjà et que ce document ignorait — désormais section **C0** ci-dessus.

> ⚠️ **L'addition était fausse une deuxième fois.** Le 20/08 corrigeait déjà une erreur de somme du
> 19/08 (« les listes étaient justes, l'addition ne l'était pas »), puis annonçait **30 / 24 / 4 /
> 13**. Les listes elles-mêmes en contenaient **31 / 23 / 4 / 13**. Le total tombait juste par
> compensation. Recompté nom par nom le 21/08.

**État au 21/08/2026 au matin, sur 83 lignes :**

| | 19/08 | 20/08 *(annoncé)* | **21/08 (recompté)** | |
|---|---|---|---|---|
| **Opérationnel** | 26 | 30 → *31 réels* | **34** | 1, 1b, 1c, 3, 4, 5, 7, 8, 9, 11, 11b, 14, 18, 19, 21, 21b, 22, 23, 25\*, 28, 28b, 29, 35, 46, 54, **57**, 58, 59, 62, 63, 64, 65, **J5**, **J6** |
| **Partiel** | 20 | 24 → *23 réels* | **29** | 2, 6, 15, 16, 17, 20, 24, 26, 27, 30, 32, 34, 37, 38, 43, 44, 45, 47, 48, 53, 66†, 67†, **J1**†, **J2**†, **J3**, **J4**, **J8**†, **J9**, **J12** |
| **Coquille** | 4 | 4 | **5** | 13, 39, 52, 61, **J7** |
| **Absent** | 15 | 13 | **15** | 10, 12, 31, 33, 36, 40, 41, 42, 49, 50, 55, 56, 60, **J10**, **J11** |

*\*#25 est opérationnel en code mais mort en production faute de clé Stripe — revérifié au `curl`
le 21/08 : `POST /api/stripe/webhook` répond toujours HTTP 500 `{"error":"Stripe non configuré."}`.*
*† Complet en code, prouvé par test, **jamais exercé en production** : #66 (0 ligne de journal),
#67 (0 utilisateur comptable, 0 export remis), J1/J2/J8 (aucune donnée jantes hors atelier de
démonstration). C'est le motif exact de #34 et #39.*

**Le seul mouvement de statut du 21/08** : **#57 revient d'*Partiel* à *Opérationnel*** — la
régression annoncée le 20/08 à 18 h 53 était réparée à 19 h 05, douze minutes plus tard, et le
document n'a pas été relu depuis. Les 56 tables de la base sont couvertes, 52 exportées et 4
écartées avec motif, et le test se compare enfin à l'inventaire du schéma. **Aucun recul.**

**Le vrai mouvement de la journée n'est pas un statut, c'est un périmètre** : douze lignes qui
existaient depuis le 19/08 dans le cahier des charges viennent d'être auditées pour la première
fois, et sept d'entre elles ne tiennent pas le ✅ qu'elles portaient.

## Ce que l'inventaire ne regarde pas du tout *(21/08)*

*Un inventaire ne peut pas se contredire lui-même : il ne dit rien de ce qu'il n'a pas de ligne
pour dire. Voici ce qui manque au parcours d'un atelier, du premier contact au règlement encaissé,
et qui ne figure dans aucune des 83 lignes. Chaque point a été vérifié par absence de table, de
colonne ou de fichier, pas supposé.*

**Des pans du logiciel livré qui n'ont aucune ligne**

| Sujet | Ce qui existe déjà | Preuve |
|---|---|---|
| **Formules, droits et sièges** | Trois offres (79 / 129 / 249 € HT), `capacite_ouverte()` armée en RLS et en trigger sur 13 tables, siège supplémentaire facturé 5 €, page tarifs, comparatif. #61 ne parle que de « l'abonnement Stripe » | `src/lib/abonnement.ts`, `trg_exiger_capacite` sur 13 tables |
| **Équipe : inviter, activer, changer de rôle** | Invitations à jeton, `accept_invitation`, activation/désactivation (`users.actif`, qui ferme `current_atelier_id()` donc toute la RLS), garde-fou `DERNIER_PROPRIETAIRE`. #63 ne couvre que la RLS par rôle | `reglages:1265-1386`, `trg_garde_role` |
| **Centre d'aide et accompagnement contextuel** | `/aide`, `/aide/[slug]`, 6 tutoriels, `AstuceEcran` | `src/lib/aide.ts` |
| **Vitrine, acquisition et mesure** | 4 pages publiques, JSON-LD, `sitemap.ts`, `llms.txt`, formulaire de rappel, table `leads`, `analytics_events` | `src/app/page.tsx`, `src/app/api/leads` |
| **Réinitialisation de mot de passe** | `/mot-de-passe-oublie`, `/reinitialiser` | routes réelles |
| **Moteur d'envoi de courriels** | `process_notifications` (9 modèles), `verifier_notifications`, 18 messages partis | il n'a de ligne que par ses usages (#18, #39) |

**Ce qui manque, et que personne n'a écrit nulle part**

1. **Les achats et les fournisseurs.** Aucune facture fournisseur, aucun règlement fournisseur,
   aucun carnet de fournisseurs — `fournisseur` n'existe qu'en champ texte libre sur `poudre_lots`
   et `dechets`. Le seul circuit d'achat est la commande Thermopoudre (#34), c'est-à-dire un seul
   fournisseur. **Conséquence directe sur #43** : le prix de revient s'appuie sur un prix d'achat
   au kilo saisi à la main, que rien ne rapproche d'une facture. Un atelier ne peut pas savoir s'il
   gagne de l'argent s'il ne sait pas ce qu'il dépense.
2. **La trésorerie.** Pas d'échéancier d'encaissement, pas de prévisionnel, pas de rapprochement
   bancaire, pas de solde. `ateliers_bancaire` ne porte que l'IBAN à imprimer sur la facture.
3. **L'état de TVA.** Le FEC et le CSV sortent, la ventilation par taux existe dans
   `lib/compta/export.ts` — mais **aucun écran ne rend l'état de TVA collectée d'une période**,
   celui qu'on recopie sur la CA3. Le mot « CA3 » n'apparaît que dans un commentaire.
4. **L'exercice comptable et la clôture.** Aucune notion d'exercice, aucun verrouillage de période,
   aucun à-nouveau, **aucun stock valorisé à date** — `poudres.stock_kg` est un solde instantané,
   rien n'en garde la photo au 31/12. Un expert-comptable demandera l'inventaire de fin d'année ;
   il n'est pas dans le logiciel, et l'espace comptable (#67) ne le propose pas.
5. **Le litige.** Aucune réclamation client (les non-conformités sont un registre **interne**),
   aucun suivi de contentieux, **aucune facture de pénalités de retard** alors que
   `ateliers.penalites_taux` est imprimé sur chaque document. La relance s'arrête au plafond de 3
   et plus rien ne se passe : ni mise en demeure, ni changement d'état, ni alerte.
6. **La balance âgée**, nommée dans #26 comme un reste à faire — mais c'est plus que ça : sans elle,
   « combien on me doit et depuis quand » n'existe sur aucun écran.
7. **Le départ d'un client.** L'effacement RGPD n'a pas de bouton. La corbeille refuse — à raison —
   de jeter un client porteur de documents comptables, la politique de confidentialité renvoie à une
   adresse e-mail, et il faut donc passer par la base. La même remarque avait été faite en S12 comme
   corollaire d'un bug ; elle n'est toujours pas traitée comme une fonction.
8. **Le départ d'un salarié.** On peut le désactiver — et c'est propre, `current_atelier_id()`
   exige `actif` — mais on ne peut pas le retirer, ses pointages restent à son nom
   (`temps_etapes.user_id`, jamais affiché), et **rien ne rattrape un chrono qu'il a laissé ouvert**.
9. **Un seul taux horaire pour tout l'atelier.** `ateliers_couts.taux_horaire` est unique ;
   `users` n'a pas de taux. Dès qu'un apprenti et un chef d'atelier pointent sur le même dossier,
   le prix de revient de #43 est faux, et il l'est silencieusement.
10. **Les absences et les fermetures.** `ajouterJoursOuvres` exclut samedi et dimanche et **assume
    de ne pas gérer les jours fériés** (commentaire `capacite.ts:37-39`). Mais rien ne gère non plus
    la **fermeture annuelle**. Une date de livraison promise début août tombera en plein congé.
11. **Le transport.** Le BL porte `nb_colis` et `poids_kg`, et s'arrête là : ni transporteur, ni
    numéro de suivi, ni étiquette. Le mot « transporteur » n'existe que sur le registre des déchets.
12. **La sous-traitance sortante.** Un atelier qui confie le sablage, la galvanisation ou le
    diamantage à un tiers n'a nulle part où le tracer — ni le délai, ni le coût, ni la pièce sortie.
13. **Le motif d'un devis perdu.** `status = 'refuse'` se pose (bouton présent), mais **sans motif**.
    Aucune colonne, aucun écran : on ne saura jamais pourquoi on perd.
14. **La reprise d'une pièce.** `non_conformites.retouche` / `.rebut` existent, mais il n'y a aucun
    circuit : repasser une pièce au four sans la refacturer, et savoir ce que cette reprise a coûté.
15. **Le multi-devise.** Tout est en euros. `nature_operation` gère la TVA d'une livraison
    intracommunautaire ou d'une exportation, pas la monnaie du client.

## Les documents entre eux *(21/08)*

*Sept documents ont été confrontés. Six chiffres sont faux, et un est contractuel.*

| Écart | Ce qui est écrit | Ce qui est vrai |
|---|---|---|
| **CGU / page tarifs** ⚠️ | `src/app/legal/cgu/page.tsx` §3 : « Formules : **Solo (59 € HT/mois)** et **Atelier (89 € HT/mois)** » | Le produit vend **Atelier 79 €**, **Équipe 129 €**, **Certifié 249 €**, plus **5 € HT par siège** (`lib/abonnement.ts:30-90`, `PRIX_SIEGE_MENSUEL`). **Aucun des deux noms, aucun des deux prix des CGU n'existe dans le logiciel**, et la facturation au siège n'y figure pas du tout. C'est le document contractuel qui est faux, pas la page tarifs. |
| **CGU** | §3 : « résiliation à tout moment **depuis l'application** » | Le seul chemin est le portail Stripe (`/api/billing/portal`), et Stripe n'est pas configuré en production. Un client qui paierait ne pourrait pas résilier depuis l'application. |
| **CGU** | §5 : « Export possible à tout moment **sur demande** » | Le bouton libre-service existe (`/api/export/donnees`, #57). La CGU sous-vend une fonction livrée — inoffensif, mais c'est le même décrochage. |
| **CDC master** l. 16, 42, 222 | « 42 tables exportées pour 56 en base », « ⚠️ Retombée » | Faux depuis le 20/08 à 19 h 05 : **52 + 4 = 56**. Trois passages du document à corriger. |
| **TESTS.md** l. 125 | « périmètre des **37 tables** métier » | 52 tables exportées et 4 écartées. |
| **4 documents** *(CDC master, TESTS.md, RECETTE-CHANTIERS, celui-ci)* | « **923 tests**, 50 fichiers » | Dernier passage réel : **947 passés + 4 ignorés = 951**, 50 fichiers (`testExportGardeFou.log`, 20/08 19 h 28). |
| **MODULE-JANTES.md** §5 | « **73 tests neufs** » (39 + 34) | Passage réel : `jantes-chiffrage` **37**, `jantes-dossier` **31** = **68**. |
| **CDC master vs ce document** | Le CDC compte « 61 fonctions **+ le module jantes** » et « 30 opérationnelles et 24 partielles **sur 71**, + les 12 lignes du module jantes » | Les deux documents ne parlaient pas du même univers : 71 ici, 83 là-bas. **Corrigé** par la section C0. |
| **AUDIT-LOGICIEL-20-08** l. 44 et 82 | « 625 tests », « 50 politiques » | Chiffres d'avant les chantiers, non réactualisés : 951 tests, **90** politiques dont **49** nomment un rôle. Le document décrit un état antérieur et l'annonce, ce n'est pas une erreur — mais il ne doit pas servir de référence. |

## Pourquoi le cahier des charges comptait plus de ✅ que la réalité

Le cahier des charges comptait **32 ✅**. Il y en avait **21** au 19/08 au matin, **27** après le lot 6. L'écart tient à quatre causes : des
fonctions cochées sur l'existence de l'écran et non sur la chaîne (#2, #6, #47, #48), des fonctions
cochées sur le code et non sur l'usage (#39, #34), des fonctions cochées trop tôt (#13, #32), et
une revendication de couverture réglementaire (65 %) qui repose sur des registres à 1 ligne.

**Le 21/08 ajoute une cinquième cause, et c'est la plus coûteuse : des fonctions cochées sans
qu'aucun audit ne les regarde jamais.** Les neuf ✅ de la section C0 du cahier des charges
(J1 à J9) tenaient depuis le 19/08 sur le seul compte rendu de leur chantier. Sept d'entre eux
relèvent en réalité de la deuxième cause — cochés sur le code et non sur l'usage — parce que la
totalité des données jantes vit dans l'atelier de démonstration, où l'écriture est refusée. C'est
le même motif que #39 et #34, appliqué à un module entier plutôt qu'à une fonction.

À l'inverse, le cahier des charges **sous-estimait** le produit sur trois lignes majeures du lot 1 :
**#14 (prix au ml), #15 (tarifs client) et #16 (pièces types) sont livrés et fonctionnent**, avec
leurs écrans de réglage, leur intégration au devis et des données réelles en base. Le lot 1 est donc
bien plus avancé que ce que la roadmap laisse croire. **#23 (facture récapitulative) et #24 (bon de
livraison) étaient également marqués ⬜ alors qu'ils existent** — le premier avec un bug d'argent
qui vient d'être corrigé.

## Ce qui a été corrigé aujourd'hui

Dix corrections, `npm test` vert (308), `npx next build` sans erreur, zéro erreur TypeScript.

1. **La remise disparaissait de la facture récapitulative** — quatrième régression de remise, et la
   plus coûteuse : un client remisé était facturé plein tarif. Reportée par bon et par taux de TVA,
   en ligne explicite. 4 tests de non-régression ajoutés.
2. **La remise disparaissait du bon de livraison** — le forfait minimum était remisé faute de `meta`.
3. **Un avoir prenait un numéro `FA-`** — rejet garanti à l'export FEC.
4. **Un paiement partiel marquait la facture « payée »** — la sortant de la file de relance et du
   compteur d'impayés. Le solde restant est désormais affiché et pré-rempli.
5. **La charge du four comptait les projets déjà cuits** — toutes les dates promises étaient
   repoussées.
6. **La fiche de cuisson devenait injoignable après clôture** — le document d'audit était perdu.
7. **Le blocage « instrument non étalonné » ne regardait que l'épaisseur.**
8. **Deux poudres identiques sans cycle se déclaraient incompatibles.**
9. **Trois réglages fantômes câblés** : TVA par prestation, assujettissement à la TVA, lien vers
   `/abonnement` (un client qui paie n'avait plus aucun accès au portail Stripe).
10. **Pilotage rendu accessible sur mobile**, export total porté de 36 à 38 tables, `search_path`
    figé, index uniques posés sur les numéros de BL et de fournée, colonne `factures.recapitulatif`
    supprimée.

## Lot 6, le même jour — les quatre ruptures critiques

Détail complet dans `RECETTE-LOT6.md`. En une ligne chacune :

1. **R1 — le verdict qualité est désormais rendu par la base** (`verdict_controle` en plpgsql,
   appelée par le trigger qui fige déjà le barème). La valeur envoyée par le client est ignorée dans
   les deux sens : on n'embellit pas plus qu'on ne noircit.
2. **R2 — la suppression d'un contrôle est fermée** (plus aucune policy `DELETE`), sans casser la
   cascade référentielle ni la suite de tests.
3. **R4 — un bon de livraison ne se facture qu'une fois** : rattachement automatique à la facture
   qui le consomme, libération à la suppression ou à l'annulation, `BL_DEJA_FACTURE` en base,
   données réelles régularisées.
4. **R6 — le circuit acompte → solde fonctionne** : déduction en ligne explicite par acompte et par
   taux de TVA, `facture_liee_id` écrite, mention imprimée sur le PDF.
5. **R8 — le chronométrage tient de bout en bout** : `avancer_etape` chronomètre elle-même, un BL
   signé referme le chrono, la vue de coût compte le chrono en cours, et un bouton « Démarrer »
   ouvre la première étape.
6. **Deux besoins métier** : contrôles qualité activables par atelier (avec un certificat qui
   n'affirme plus que ce qu'il a mesuré, et un avertissement pour l'atelier labellisé qui coupe
   l'épaisseur), et temps partagé entre plusieurs pièces sur un même poste, réparti au prorata.

**+47 tests (355 au total), `npx next build` sans erreur, déployé en production.**

## Mon avis franc

**Le socle est bon et l'ingénierie de sécurité est au-dessus de la moyenne.** RLS partout, verrous
attaqués depuis l'extérieur à chaque exécution des tests, documents figés en base, PDF/A-3B validé.
Rien de tout cela n'est cosmétique.

**Ce qui ferait décrocher un atelier au bout de trois semaines, dans l'ordre :**

1. ~~**Le pointage ne se ferme jamais et la première étape n'est jamais ouverte.**~~ ✅ **Fermé par
   le lot 6.** Les deux cartes concordent, `avancer_etape` chronomètre seule, un BL signé referme le
   chrono, et le temps d'un poste partagé se répartit au prorata. Le point qui reste, mineur : rien
   ne rattrape un chrono laissé ouvert un week-end.
2. ~~**Rien n'est poussé vers l'atelier.**~~ ✅ **Constaté le 21/08 : le premier courriel est
   parti**, à 05 h 05 UTC, `sent`, vers le responsable de ThermoTest. Un seul message par jour,
   rien s'il n'y a rien à dire, contenu filtré par le rôle, désabonnement en un clic, DLU en
   approche comprise. Restent hors périmètre, et c'est ce qui compte maintenant : le bain à
   renouveler, l'étalonnage en retard, la balance âgée, **le jeu de jantes promis à 48 h**, et
   « vos pièces sont prêtes ». Et un seul abonné : aucun opérateur ne reçoit rien.
3. **La fiche client reste pauvre sur ce qui compte.** Elle est passée de 51 à 121 lignes le 20/08
   — portail, pièces jointes, journal des modifications, désarchivage — mais toujours **pas de CA,
   pas de dernière commande, pas de dernier devis**. Le journal dit qui a modifié la fiche, pas ce
   que ce client a acheté. C'est le premier écran qu'un patron ouvre quand un client appelle, et
   c'est encore le mauvais historique qui s'y trouve.
4. **Pas d'étiquette imprimable.** Le QR est prêt, la fiche suiveuse n'existe pas — or c'est le
   papier qui suit la pièce dans l'atelier. Sans lui, le pointage au scan n'a pas de support
   physique, ce qui ramène au point 1.
5. **Le mode hors-ligne est un décor.** Dans un bâtiment métallique, le scan est l'usage le plus
   fréquent et `/scan/[qr]` n'est même pas dans les routes mises en cache.
6. **Les modules réglementaires sont vides.** Registre des déchets : 1 ligne. FDS : 1 fiche. Ils
   sont bien faits et personne ne s'en sert — parce qu'ils demandent une saisie que rien ne
   déclenche. Un registre de déchets qui ne se remplit pas à la réception d'un lot de poudre ou au
   nettoyage d'une cabine ne se remplira jamais.

**Et une chose qui ne relève pas du produit :** l'essai de ThermoTest expire le **12 septembre**, le
paywall est armé et Stripe n'est pas configuré. Le jour venu, le premier atelier réel se retrouve
en lecture seule sans aucun moyen de payer. C'est trois variables d'environnement ou une date à
repousser, mais ça se décide avant, pas après.

**Ce que je ferais avant de mettre ça devant un atelier pendant trois mois** : ~~fermer R1 (le verdict
recalculé côté serveur), R4 (la double facturation), R6 (l'acompte), R8 (le pointage)~~ ✅ **faits par
le lot 6**, et livrer la fiche suiveuse — le dernier des cinq chantiers, et le seul qui reste. Le
reste — portail client, SMS, multi-sites — peut attendre un vrai retour terrain.

*(Mise à jour du 19/08 au soir : les quatre ruptures ci-dessus sont fermées et prouvées depuis un
client PostgREST externe, cf. `RECETTE-LOT6.md`. Deux besoins métier ont été livrés dans la foulée —
contrôles qualité activables par atelier, et temps partagé entre plusieurs pièces sur un même poste.)*

*(Mise à jour du 20/08 au soir : les sept chantiers de `AUDIT-LOGICIEL-20-08-2026.md` §5 sont
livrés — cf. `RECETTE-CHANTIERS-20-08-2026.md`. **Ce qu'il faut en retenir dans ce document n'est
pas la liste des fonctions, c'est ceci** : deux fonctions annoncées faisaient déjà du dégât ou rien
du tout — le cron a relancé de vrais clients depuis l'atelier de démonstration (S8), le bouton
« Prévenir le client » d'une facture ne fonctionnait pas depuis la mise en service —, trois verrous
qui avaient l'air de tenir ne tenaient pas (S10, S11, S12), et **une réversibilité promise dans les
CGU a régressé sans qu'aucun test rouge ne l'annonce (#57)**. C'est le sixième, septième et huitième
verrou de ce projet à n'avoir tenu qu'après avoir été attaqué, et rien ne dit que c'étaient les
derniers.)*

**Enfin, la recommandation qui n'a pas changé depuis le lot 2 et qui reste la plus rentable** :
faire relire le certificat de conformité, le registre des contrôles et le registre des déchets par
un responsable qualité d'atelier certifié, les trois PDF imprimés sur la table. Cet audit dit que
les documents existent et se génèrent. Il ne dit pas qu'ils passeraient un audit Qualicoat — et
c'est la seule question qui compte pour le plan à **249 €** *(corrigé le 21/08 : la qualité tracée
est dans la formule Certifié à 249 €, pas dans Équipe à 129 € — `lib/abonnement.ts:70-88`)*.

---

*(Contre-audit du 21/08 au matin. **Ce qu'il faut en retenir n'est pas la liste des corrections,
c'est la forme qu'elles prennent.** Sur les neuf erreurs trouvées, **six vont dans le sens du
pessimisme** : #57 était réparé, #30 avait tenu sa promesse, #37 accusait deux causes disparues,
#54 et #58 réclamaient une entrée existante, #22 se contredisait avec #28. Une seule allait dans le
sens de l'optimisme, et c'est la plus grave : **douze lignes de cahier des charges cochées ✅
n'avaient jamais été relues, parce que le mot qui les nomme n'apparaissait pas une fois dans ce
document.** Un audit qui se relit à partir de sa propre liste ne trouvera jamais ce qui n'y est pas.
La seule parade est de partir du parcours métier et non de l'inventaire — c'est ce qu'a fait la
section « Ce que l'inventaire ne regarde pas », et c'est de là que sortent les quinze manques qui
n'ont de ligne nulle part. Enfin, deux défauts neufs sont sortis de la reprise ligne à ligne :
**C-13** — un statut que rien ne pose, jumeau exact de C-11 corrigé la veille — et **R13** — une
règle posée sur le chemin de lecture et absente du chemin d'écriture, comme R1 et R4 avant elle.
Ce sont deux motifs déjà rencontrés sur ce projet, retrouvés ailleurs. Il vaut mieux les chercher
par motif que par écran.)*
