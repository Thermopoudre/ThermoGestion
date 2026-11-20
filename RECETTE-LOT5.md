# Recette du lot 5 — les deux réserves qui bloquaient la vente, puis la priorité 2

*18 août 2026. Ce document rend compte de ce qui a été livré, de ce qui a été prouvé, et de ce qui
reste ouvert. Les points « prouvé » renvoient à un test qui rejoue la propriété à chaque
`npm test` ; les points « vérifié en recette » ont été constatés à la main dans le navigateur sur
la production, sans filet automatique.*

**État de la suite : 304 tests, 26 fichiers, tous verts.** (277 avant ce lot, dont 234 avant les
deux réserves.) Build `npx next build` sans erreur TypeScript, déployé sur
`https://thermogestion-v2.vercel.app`.

---

## R1 — Les seuils de contrôle qualité sont devenus paramétrables

### Le problème

Les quatre seuils qui décident du verdict « conforme / non conforme » étaient écrits en dur dans
`src/lib/qualite.ts` : 60 µm mini, ±10 unités de brillance, adhérence classe ≤ 1, Buchholz ≥ 80.
Ce sont les valeurs de la classe 1 Qualicoat. Un atelier agréé Qualisteelcoat en ambiance C4, ou
travaillant sous le cahier des charges d'un donneur d'ordre qui exige la classe 0 d'adhérence,
voyait donc des verdicts qui n'étaient pas les siens — et c'est la première question que pose un
responsable qualité en démonstration.

### Ce qui a été livré

**Une table `referentiels_qualite` par atelier** (migration 23), avec cinq seuils réglables :
épaisseur minimale, épaisseur maximale *(nouveau, facultatif — Qualicoat ne plafonne pas, certains
cahiers des charges si)*, tolérance de brillance, classe d'adhérence maximale, dureté Buchholz
minimale. Un atelier peut en tenir plusieurs et désigner celui qui s'applique par défaut ; un index
unique partiel garantit qu'il n'y en a **jamais deux** — sans quoi « le » référentiel appliqué
serait un tirage au sort silencieux.

**Les valeurs Qualicoat classe 1 en défaut, posées sans intervention.** `create_atelier` sème le
référentiel « Qualicoat classe 1 » à la création de l'atelier, et la migration l'a posé sur les
ateliers existants. Un atelier qui ne touche à rien retrouve exactement le comportement d'avant.

**Un écran `/qualite/référentiels`** avec, sous chaque champ, l'explication de ce que le seuil
signifie et de ce qu'il change : pourquoi le verdict d'épaisseur se joue sur le point le plus fin,
ce que vaut une classe ISO 2409, ce que trahit un Buchholz bas. C'est ce texte qui transforme un
formulaire en argument de vente devant un responsable qualité.

**Le barème est affiché à la saisie.** Le formulaire de contrôle annonce le référentiel appliqué
et le seuil concerné par le type de mesure en cours. S'il y a plusieurs référentiels, l'opérateur
choisit ; sinon une ligne discrète le nomme et renvoie au réglage.

**Le barème est imprimé sur les documents.** Le registre des contrôles PDF liste les barèmes
réellement appliqués sur la période — plusieurs s'il y a eu un changement en cours d'année — avec
le nombre de contrôles concernés. Le certificat de conformité porte la même mention. Un verdict
sans son barème ne se vérifie pas.

### La non-rétroactivité, et comment elle est tenue

C'est le cœur de la réserve : **un contrôle enregistré n'est jamais réévalué.**

Le mécanisme est en base, pas dans React — le projet a déjà payé une fois le prix d'une
immutabilité qui n'existait que dans l'interface. Deux triggers :

- `controle_seuils_appliques` (BEFORE INSERT) écrit sur chaque contrôle une **copie figée** des
  seuils du référentiel retenu (`controles.seuils`, jsonb) et le nom du référentiel. La copie est
  posée **par la base**, pas par le client : un navigateur qui prétendrait avoir appliqué un barème
  complaisant se la voit écraser.
- `figer_controle` (BEFORE UPDATE) refuse toute modification du type, des valeurs mesurées, du
  verdict, des seuils, du nom du référentiel, de la date de mesure, du projet, de la fournée, de
  l'instrument et de l'opérateur. Seuls le commentaire et la photo restent modifiables — annoter un
  contrôle est légitime, réécrire une mesure ne l'est pas. Message métier : *« Un contrôle
  enregistré ne se modifie pas : le verdict rendu à sa date fait foi. Refaites la mesure, le
  contrôle le plus récent prime. »*

**Le garde-fou a été attaqué avant d'être déclaré bon.** Première version : le trigger
d'immutabilité bloquait aussi le `ON DELETE SET NULL` de la clé étrangère, si bien que supprimer un
référentiel échouait **silencieusement** — la suppression paraissait passer côté écran. Le test l'a
attrapé. La règle a été corrigée : le pointeur a le droit de se dénouer vers `NULL`, jamais d'être
rebranché ailleurs, et la trace inscrite (nom + copie des seuils) ne bouge dans aucun cas.

### Ce qui est prouvé — `tests/seuils-qualite.test.ts` (27 tests)

| Propriété | Comment elle est vérifiée |
|---|---|
| Le seuil décide vraiment du verdict | Le même relevé (55 µm, brillance 66/60, adhérence classe 1, Buchholz 85) bascule conforme ↔ non conforme selon le référentiel |
| Le plafond d'épaisseur ne se déclenche que s'il existe **et** que le maxi est relevé | Trois cas séparés |
| Aucun verdict sur une mesure incomplète | `null` tant qu'il manque une valeur |
| Les défauts n'ont pas bougé | `SEUILS_QUALICOAT_CLASSE_1` comparé champ à champ ; `calculerConformite` sans seuils explicites rend le verdict d'avant le lot 5 |
| Un atelier neuf a son barème sans rien faire | Le référentiel par défaut existe à la création, aux bonnes valeurs |
| Un seul référentiel par défaut | Le second est refusé par la base |
| Le snapshot ne peut pas être forgé | Insertion d'un contrôle avec `seuils: {epaisseur_mini_um: 1}` → la base réécrit 60 |
| **Resserrer le barème ne réévalue rien** | Contrôle enregistré à 62 µm/seuil 60 → conforme ; le référentiel passe à 100 µm ; l'ancien contrôle reste conforme avec ses seuils d'origine, un contrôle identique saisi ensuite est non conforme |
| Supprimer le référentiel n'efface pas la trace | `referentiel_id` passe à `NULL`, le nom et les seuils restent, le verdict aussi |
| **Le registre ne se réécrit pas, attaqué de l'extérieur** | Sept tentatives d'`UPDATE` depuis un client PostgREST ordinaire (verdict, valeurs, seuils, nom du référentiel, type, date, projet) + rebranchement sur un autre référentiel : toutes refusées, contrôle intact après coup |
| Ce qui doit rester possible le reste | Commentaire et photo modifiables, verdict inchangé |
| Cloisonnement | Un référentiel d'un autre atelier est refusé ; `anon` ne lit rien |

### Vérifié en recette

Écran `/qualite/référentiels` en production : le référentiel Qualicoat classe 1 s'affiche avec son
résumé de seuils (`épaisseur ≥ 60 µm · brillance ± 10 UB · adhérence ≤ classe 1 · Buchholz ≥ 80`),
l'encart de non-rétroactivité est visible avant toute action, les actions Modifier / Définir par
défaut / Désactiver / Supprimer sont en place.

### Limite assumée

Le référentiel s'applique **par atelier** (avec choix possible à la saisie), pas encore **par
client ou par projet**. Un atelier qui travaille pour un donneur d'ordre exigeant la classe 0 doit
penser à basculer le référentiel au moment de la mesure. Le rattacher au projet est une petite
évolution (une colonne, un sélecteur) : elle n'a pas été faite pour ne pas ajouter un réglage de
plus sans l'avoir vu servir sur le terrain.

---

## R2 — Recette des cinq pages publiques

Périmètre : `/d/` devis · `/f/` facture · `/bl/` bon de livraison · `/rc/` bon de réception ·
`/s/` suivi. Méthode : lecture du code, vérification des montants **contre la base par requête
SQL**, puis passage en production dans le navigateur en français et en italien, en fenêtre étroite
et en fenêtre large.

### Cinq défauts trouvés, cinq corrigés

**1. La remise du devis disparaissait du bon de livraison — troisième occurrence de la même
famille de bug.**

`bons_livraison` n'avait pas de colonne `remise`, et `lignesDepuisDevis` recopiait les lignes
brutes du devis. Un client sous contrat à −12 % recevait donc un BL annonçant un total **12 % plus
élevé** que la facture émise le lendemain, sur les mêmes lignes. Le commentaire du code affirmait
pourtant que la reprise servait à éviter « l'écart entre devis, BL et facture » : c'est exactement
la remise qui créait l'écart.

Corrigé : colonne `remise` sur `bons_livraison` (migration 24), reprise automatique depuis le devis
(avec un lien « retirer » si l'atelier ne la veut pas sur ce bon), exposition par la RPC
`bl_public`, affichage sur la page client et sur le PDF du BL.

*Vérifié en production* : BL-2026-0001, sous-total 203,88 € − remise 12 % 24,47 € = 179,41 € HT,
TVA 35,88 €, **215,30 € TTC** — au centime près la valeur recalculée depuis la base.

**2. Un avoir s'intitulait « Facture ».**

Le PDF serveur écrivait bien « Avoir » ; la page web du même document écrivait « Facture », avec
une échéance de paiement, un délai de règlement, des pénalités de retard et les coordonnées
bancaires de l'atelier. Le même document disait deux choses différentes selon le canal, et invitait
le client à payer ce qu'il ne devait pas.

Corrigé sur la page **et** dans le PDF : titre selon le type (`Facture d'acompte`, `Facture de
solde`, `Facture`, `Avoir` — traduits en italien, `Nota di credito`), mention « Cet avoir vient en
déduction de votre compte », ni échéance, ni délai, ni pénalités, ni IBAN. Le titre de l'onglet et
l'aperçu de partage suivent.

**3. Une facture annulée ne se signalait nulle part.**

Aucun bandeau, l'échéance affichée, le bouton de paiement en ligne toujours proposé si un lien
Stripe existait. Corrigé : mention « — FACTURE ANNULÉE » dans le titre, bandeau rouge explicite,
plus aucune invitation à payer, mentions de paiement supprimées, `ANNULÉE` en tête du sous-titre du
PDF.

**4. Le devis affichait une addition qui ne tombait pas juste.**

Sur DV-2026-0009 : `Sous-total HT 13,50 €` − `Remise (12 %) 1,62 €` puis `Total HT 25,00 €`. Le
forfait minimum de 13,12 € était compté dans le total mais absent du raisonnement — le client ne
pouvait pas recalculer son propre devis. Arithmétiquement juste, commercialement indéfendable.

Corrigé par un bloc de totaux commun aux trois documents (`src/components/BlocTotaux.tsx`) qui
reproduit la règle de calcul réelle : sous-total remisable, remise, **puis** forfait minimum ajouté.
Même correction dans le PDF. La page affiche désormais `13,50 − 1,62 + 13,12 = 25,00`.

**5. Le devis public ne portait pas les mentions de l'émetteur.**

Ni adresse, ni forme juridique, ni SIREN, ni RCS, ni TVA intracommunautaire — alors que le PDF du
même devis les portait (art. R.123-237 du code de commerce). Corrigé : `devis_public` sert
l'identité légale (migration 25), la page affiche l'adresse en en-tête et le bloc de mentions en
pied, comme la facture.

**En prime**, deux détails relevés au passage : le capital social était formaté dans la langue
d'affichage (« au capital de 10.000,00 € » à l'italienne au milieu d'une phrase française) — il est
désormais toujours en français, puisque cette ligne cite un texte français ; et le statut d'un
devis non signable s'affichait avec son code interne (« statut : refuse ») — il est maintenant
traduit dans les deux langues.

### Impression

Aucune feuille de style d'impression n'existait. Ajoutée : fond blanc, conteneurs à défilement
horizontal rendus visibles (leur largeur minimale débordait de la page), lignes de tableau, images
et blocs de totaux protégés contre les sauts de page. Les éléments interactifs (sélecteur de langue,
bouton d'impression, pavé de signature, bouton de paiement) étaient déjà masqués à l'impression.

### Ce qui est prouvé — `tests/pages-publiques.test.ts` (18 tests)

Le fichier fige le **contrat des RPC publiques** : chaque champ dont une page a besoin est vérifié
présent. Une RPC qui cesserait d'exposer `remise` fait tomber le test au lieu de faire disparaître
12 % du prix sur l'écran d'un client — c'est précisément le mode de défaillance qui s'est produit
trois fois.

Sont couverts : la chaîne complète devis remisé → signature → projet → BL → facture avec égalité au
centime entre les trois documents ; sous-total − remise (+ forfait) = total HT ; la remise en
montant fixe (40 € retirés, pas 40 %) ; le forfait minimum ; l'avoir ; la facture annulée ; le
montant nul ; le client sans adresse ; l'atelier sans logo ; le jeton inconnu qui ne renvoie rien ;
les tables fermées à `anon` ; l'alignement des clés FR/IT (aucune retombée en français par accident)
et le formatage des montants par locale.

*Note relevée au passage* : l'italien ne groupe pas les milliers à quatre chiffres
(CLDR `minimumGroupingDigits = 2`), « 1234,50 € » est la forme correcte. C'est le test qui avait
tort, pas le code.

### Vérifié en recette, en production

| Page | FR | IT | Constat |
|---|---|---|---|
| `/f/` facture remisée | ✅ | ✅ | 129,60 − 15,55 = 114,05 HT · 22,81 TVA · 136,86 TTC — identique à la base |
| `/f/` avoir | ✅ | ✅ | « Avoir » / « Nota di credito », aucune invitation à payer |
| `/f/` annulée | ✅ | ✅ | Bandeau rouge, aucun moyen de paiement proposé |
| `/d/` devis | ✅ | — | Addition qui tombe juste, mentions légales présentes |
| `/bl/` bon de livraison | ✅ | — | Remise affichée, total égal à la facture |
| `/rc/` bon de réception | ✅ | ✅ | Réserves, état constaté et mention des 48 h traduits |
| `/s/` suivi | ✅ | ✅ | Étapes, statut et bouton d'appel traduits |

La mémorisation de la langue fonctionne : une page ouverte sans paramètre revient dans la langue
choisie la fois précédente.

### Limites assumées

- Les **libellés d'étapes** du suivi (`Préparation / sablage`) restent en français : ils sont saisis
  par l'atelier, on ne peut pas les traduire.
- Les **mentions légales** citant des textes français (293 B du CGI, L441-10 du code de commerce)
  restent en français dans les deux langues, volontairement : une traduction libre leur ferait
  perdre leur valeur.
- Un avertissement d'hydratation React (#418) a été observé **une fois**, sur une navigation
  interne, non reproductible depuis. Sans effet visible ; à surveiller.

---

## Priorité 2 — Sauvegarde et export total des données

C'était un engagement des CGU non tenu : un atelier ne pouvait récupérer ses données qu'en nous les
demandant.

**Livré** : bouton « Télécharger toutes mes données » dans Réglages → Compte, qui produit une
archive ZIP contenant, pour les **37 tables métier** de l'atelier :

- `csv/<table>.csv` — un fichier par table, point-virgule, UTF-8 avec BOM, toutes les valeurs entre
  guillemets. S'ouvre dans Excel français sans assistant d'importation. Une valeur nulle laisse la
  cellule vide sans guillemets, ce qui la distingue d'une chaîne vide réellement enregistrée ;
- `donnees.json` — la même donnée sans perte, seule forme capable de rendre les colonnes `jsonb`
  (lignes de devis, étapes de projet, valeurs de contrôle) exploitables ;
- `LISEZ-MOI.txt` — ce que contient l'archive, ce qu'elle ne contient pas, et le décompte réel
  ligne par ligne.

**Trois décisions de fond :**

*La lecture passe par la session de l'utilisateur*, donc par les RLS. Il n'y a pas de paramètre
`atelier_id` à falsifier : la fonction ne peut lire que ce que le compte peut lire. Le test lance
la même collecte depuis un client **anonyme** et vérifie qu'elle ne rapporte rien — parce qu'une
fonction qui lit toutes les tables d'un coup livrerait la base entière si elle contournait les RLS
d'une manière ou d'une autre.

*La lecture est paginée.* PostgREST plafonne les réponses à 1 000 lignes. Sans boucle, l'export
serait **silencieusement tronqué** sur `stock_mouvements` et `temps_etapes` chez un atelier de trois
ans — le pire défaut possible pour une sauvegarde.

*Le ZIP est écrit à la main* (entrées stockées, sans compression, ~80 lignes avec la table CRC32)
plutôt qu'avec une bibliothèque : pas de dépendance nouvelle à installer, et le format est lisible
par tous les systèmes.

### Ce qui est prouvé — `tests/export-donnees.test.ts` (14 tests)

Périmètre des 37 tables et exclusion explicite des mécanismes internes (compteurs de
numérotation, configuration de plateforme) ; aucune table en erreur ; **toutes les lignes exportées
portent l'`atelier_id` de l'atelier et aucun autre** ; export vide pour un client anonyme ; format
CSV (BOM, échappement des guillemets, point-virgule dans une valeur, retour à la ligne, `jsonb`
sérialisé, colonne apparue tardivement, table vide) ; JSON relisible avec les `jsonb` en objets ;
archive ZIP validée sur ses signatures (`PK\x03\x04`, `PK\x01\x02`, `PK\x05\x06`), le nombre
d'entrées déclaré, la position du répertoire central, le CRC et la taille de chaque entrée ; CRC32
contrôlé sur le vecteur de référence `123456789` → `0xCBF43926`.

### Limite assumée

Les **fichiers binaires** (photos de réception, logo, documents de certification) ne sont pas dans
l'archive : seuls leurs chemins de stockage le sont. Le LISEZ-MOI le dit, et indique qu'ils se
récupèrent sur demande. Les embarquer supposerait de télécharger chaque objet du bucket dans la
fonction serverless — faisable, mais c'est un second chantier avec ses propres limites de mémoire
et de durée.

---

## Priorité 2 — Registre des déchets et classeur FDS

Le second volet réglementaire, à côté de Qualicoat : un atelier de thermolaquage relève de la
rubrique **ICPE 2940**, et ce sont deux obligations qui reviennent à chaque inspection.

### Registre des déchets — `/qualite/déchets`

Table `dechets` (migration 26) reprenant les mentions exigées par l'art. R.541-43 du code de
l'environnement et l'arrêté du 31 mai 2021 : date d'expédition, nature, code de la nomenclature
européenne, classement dangereux/non dangereux, quantité, n° de bordereau (BSD / Trackdéchets),
transporteur, installation de destination, code de traitement (D/R).

**Douze natures pré-chargées avec leur code**, tirées du métier : boues de cabine (08 02 01), poudre
périmée, bain de dégraissage usé (11 01 13*), bain de décapage (11 01 05*), boues de traitement de
surface (11 01 09*), emballages souillés (15 01 10*), chiffons souillés (15 02 02*), solvants usés
(14 06 03*), abrasif de sablage (12 01 17), ferraille (17 04 05). Choisir la nature pré-remplit le
code et le classement ; les deux restent modifiables, parce que le code exact dépend de la chimie
réelle et que c'est le prestataire qui le tranche sur le bordereau.

**L'écran met en avant ce qu'un inspecteur cherche** : totaux dangereux / non dangereux / global sur
l'exercice, et surtout le **compte des déchets dangereux sans numéro de bordereau** — la
non-conformité la plus simple à relever, signalée en rouge sur la carte, dans un encart, sur chaque
ligne concernée et sur le PDF.

**Export PDF** `/api/pdf/registre-dechets?annee=…` : registre chronologique en paysage, en-tête
d'identité de l'exploitant avec code APE, synthèse chiffrée, colonnes dans l'ordre où l'inspecteur
les lit, bordereaux manquants en rouge, et une mention rappelant que ce registre ne se substitue ni
aux BSD ni à la déclaration annuelle.

### Classeur FDS — `/qualite/fds`

Table `fds` avec rattachement facultatif à une poudre du catalogue. L'écran est pensé pour un
téléphone dans un atelier : **le champ de recherche est le premier élément**, en grand ; la
recherche ignore les accents et la casse et croise plusieurs mots (« chimitech solvant ») ; chaque
fiche a un bouton d'ouverture de 44 px de haut. Les fiches sans date ou de plus de trois ans sont
signalées « À vérifier » — le fournisseur est tenu de rediffuser une version à jour au titre de
REACH, mais personne ne vient la chercher.

### Ce qui est prouvé — `tests/dechets-fds.test.ts` (11 tests)

Totaux séparés dangereux / non dangereux avec coercition des `numeric` rendus en chaîne par
PostgREST ; comptage des bordereaux manquants qui **ne s'applique qu'aux déchets dangereux** ;
bordereau fait d'espaces traité comme absent ; registre vide qui ne fabrique aucun chiffre ;
cohérence de la nomenclature (tout code marqué d'un astérisque est classé dangereux) ; présence de
codes de valorisation **et** d'élimination ; détection des FDS périmées aux bornes exactes ;
recherche sans accent, multi-mots, insensible à la casse ; enregistrement et relecture d'une sortie
avec ses mentions réglementaires ; refus d'une quantité nulle ou négative ; FDS rattachée à une
poudre ; cloisonnement en lecture pour `anon` et en écriture vers un autre atelier.

### Limite assumée

Aucun **raccordement à Trackdéchets** : le numéro de bordereau se saisit à la main. L'API
Trackdéchets existe et permettrait d'émettre le BSD depuis l'application ; c'est un chantier à part
entière (compte, certification, gestion des états du bordereau). Le registre tel qu'il est répond à
l'obligation de tenue ; il n'automatise pas la déclaration.

---

## Ce qui n'a pas été fait, et pourquoi

**Portail client professionnel** et **notification SMS / WhatsApp** n'ont pas été commencés. Les
quatre chantiers ci-dessus sont finis, testés, déployés et recettés ; les entamer aurait donné six
fonctions à moitié plutôt que quatre entières. Éléments de cadrage pour la suite :

- *Portail client* — le socle existe déjà : chaque devis, facture, BL, réception et projet a son
  jeton public et sa page. Ce qui manque est un compte client (authentification par lien courriel
  plutôt que mot de passe, pour ne pas gérer un second parc d'identifiants), un écran d'historique
  filtré sur `client_id`, et un formulaire de demande qui crée un devis en brouillon. Compter une
  table `client_acces`, une politique RLS dédiée et trois écrans.
- *SMS / WhatsApp* — la file `notifications` et le relais Brevo existent, le canal est à ajouter.
  Il faut un compte SMS (Brevo fait aussi le SMS, ce qui éviterait un second fournisseur) et un
  champ téléphone mobile fiable côté client. Le canal WhatsApp suppose en plus un compte WhatsApp
  Business et des modèles de message approuvés par Meta, avec un délai d'instruction : ce n'est pas
  une décision technique.

**Non repris non plus** : calculateur de surface, versions et duplication de devis, chevalets
consignés, écran atelier plein écran.

---

## Migrations posées

| Migration | Objet |
|---|---|
| `23_lot5_referentiels_qualite_seuils_parametrables` | Table `referentiels_qualite`, colonnes `referentiel_id` / `referentiel_nom` / `seuils` sur `controles` |
| `23b_lot5_referentiel_defaut_et_backfill_controles` | Référentiel par défaut sur les ateliers existants, reprise des contrôles antérieurs sous leurs seuils d'origine, `create_atelier` qui sème le référentiel |
| `23c_lot5_controle_seuils_figes` | Triggers `controle_seuils_appliques` et `figer_controle` |
| `23d_lot5_figer_controle_autoriser_denouement_referentiel` | Correction du garde-fou qui bloquait le `ON DELETE SET NULL` |
| `24_lot5_bl_remise_contractuelle` | `bons_livraison.remise` + `bl_public` qui la sert |
| `25_lot5_devis_public_mentions_emetteur` | `devis_public` qui sert l'identité légale de l'atelier |
| `26_lot5_registre_dechets_et_fds` | Tables `dechets` et `fds`, RLS, triggers d'abonnement et de démonstration |

Toutes ont été posées après vérification de l'état réel de la base (`list_tables`, colonnes,
politiques et triggers existants), et les nouvelles tables reçoivent les mêmes triggers
`exiger_abonnement` et `interdire_ecriture_demo` que les autres.

## Fichiers de test ajoutés

`tests/seuils-qualite.test.ts` (27) · `tests/pages-publiques.test.ts` (18) ·
`tests/export-donnees.test.ts` (14) · `tests/dechets-fds.test.ts` (11).
