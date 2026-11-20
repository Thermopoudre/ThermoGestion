# Améliorations — 7 septembre 2026

*Chasse aux améliorations après l'exécution complète du cahier des charges v3 (vagues 3-4, déployées
le 04/09/2026, 1 412 tests verts). Ce document ne reprend rien de fait (`RECETTE-VAGUES-3-4-04-09-2026.md`),
rien de déjà écarté (`CAHIER-DES-CHARGES-V3-PREMIER-CLIENT.md` §10), rien de déjà consigné dans
`AUDIT-LOGICIEL-20-08-2026.md` ou `AUDIT-SECURITE-07-09-2026.md` — sauf un point (n°1), toujours
ouvert, que la mission demandait explicitement de retraiter avec une vérification réglementaire fraîche.
Chaque constat est prouvé : écran de la démo, requête SQL sur `luujbyqenmzivzhiatze`, ou source web
datée. Aucune écriture n'a été faite sur la base ni sur le code.*

---

## a. Les 10 améliorations, classées valeur/effort

### 1. Brancher un canal de réception de factures via une plateforme agréée — 1-2 j de code + 4-8 semaines de décision/intégration (hors code)

**Constat.** `grep -rn "plateforme.agr\|PDP\|Chorus\|PPF\|annuaire" src/` : deux résultats, tous deux
liés à des mentions statiques (`aide.ts`, `api/entreprise`) — **aucune intégration**. Le produit
génère un fichier Factur-X EN16931 valide (format), mais n'a aucun canal pour l'émettre ou le
recevoir via une Plateforme Agréée (canal). Or, vérifié aujourd'hui : **l'obligation de réception
est effective depuis le 1ᵉʳ septembre 2026 pour toutes les entreprises assujetties à la TVA, sans
exception de taille** ([Cegid](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/),
[Pennylane](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/facturation-electronique-dates-cles-et-calendrier)).
Un atelier qui installe Thermogestion aujourd'hui achète poudre, gaz et transport : il est **hors la
loi dès sa première facture fournisseur reçue** si personne ne lui indique quoi faire. C'est le même
point que « Point 0 » de l'audit du 20/08 et la réserve « mandat plateforme agréée » de l'audit du
07/09 — toujours sans réponse trois semaines plus tard, ce qui en fait le sujet le plus urgent de ce
document.

**Solution.** Deux temps à ne pas confondre : (1) le choix du partenaire et le mandat/KYC — décision
d'Alexis, hors code, 4 à 8 semaines, Axonaut (déjà utilisé, immatriculé PA depuis le 08/01/2026 selon
l'audit du 20/08) est le candidat le plus rapide à activer ; (2) une fois le partenaire choisi, le
code à écrire est modeste : un webhook de réception + un écran « Factures reçues » (liste, PDF/XML,
statut lu/à traiter) — 1 à 2 jours, la table `pieces_jointes` et le bucket `documents` existent déjà.
**Ne pas lancer le code avant le choix du partenaire : l'écran serait à refaire selon l'API retenue.**

**Ce que ça change pour le premier client.** Sans ça, l'atelier reçoit ses factures fournisseurs par
mail comme avant — Thermogestion ne reconnecte rien, l'Excel/la boîte mail reste la source de vérité,
et c'est exactement le mécanisme par lequel « on se fait remplacer » déjà identifié le 20/08.

---

### 2. Bloquer une fournée au-delà de la capacité du four — 0,5 j

**Constat.** Démo, `/fournees`, F-2026-0045 : 42,5 m² dans un four de 30 m² (142 %). Une barre rouge
à 142 % s'affiche à côté du bouton « Lancer la fournée », qui reste parfaitement actif et cliquable.
Le tutoriel intégré affirme lui-même que le logiciel « bloque net » deux cycles de cuisson
incompatibles — rien n'est dit sur le dépassement physique de capacité, qui n'est qu'un habillage
visuel.

**Solution.** Passer le contrôle de « avertissement » à « blocage » (RPC `lancer_fournee` + garde
côté écran), avec une dérogation explicite à cocher si l'atelier a réellement un four plus grand que
sa fiche ne le dit (dans ce cas c'est la fiche four qu'il faut corriger, pas le contrôle).

**Ce que ça change pour le premier client.** Un opérateur pressé un lundi matin peut valider une
cuisson matériellement impossible — pièces à refaire, four abîmé, journée perdue. C'est le seul
constat de ce document qui touche à la sécurité physique de l'atelier.

---

### 3. Exclure les devis expirés du chiffre « en attente de signature » du dashboard — 0,5 j

**Constat.** Démo, tableau de bord : « 2 devis en attente de signature · 6 251,18 € ». L'un des deux,
DV-2026-0016, est expiré depuis le 24/08 — sa propre fiche affiche « le client ne peut plus signer ce
devis ». Le chiffre-phare du dashboard (l'argument central du lot B4, « le chiffre du vendredi soir »)
compte un devis mort comme du pipeline chaud, sans aucune indication sur le dashboard lui-même.

**Solution.** Filtrer `status = 'envoye' and date_expiration >= now()` dans la requête du KPI (ou
équivalent vue), pas seulement `status = 'envoye'`.

**Ce que ça change pour le premier client.** C'est précisément le problème que B4 devait résoudre
(« aucun chiffre honnête sur le vendredi soir ») qui revient par la petite porte dès qu'un devis
expire — ce qui arrivera à toute l'équipe commerciale chaque semaine.

---

### 4. Peupler la démo avec la preuve des deux fonctions vedettes de la v3 et un cycle B2C signé — 0,5 j (données uniquement)

**Constat, prouvé en base (lecture seule) :**
- `select count(*) filter (where acompte_pct > 0) from devis` → **0 sur 14**. L'acompte à la
  commande (C1, l'argument de vente « 30 % à la commande ») n'a **aucune preuve visible** en démo.
- `select count(*) from users_couts` → **0 ligne**. Le taux horaire par personne (C2, « le chiffre
  qui sert d'argument de vente » selon le CDC v3 lui-même) est une table vide : rien à montrer.
- `select d.status, c.type from devis d join clients c ...` → les 7 devis signés appartiennent tous
  à des clients `pro` ; les 2 clients `particulier` n'ont que des devis `brouillon` ou `expire`.
  **Aucun devis B2C signé** — les mentions médiateur/rétractation (C6, qui a coûté une relecture
  juridique) ne se voient jamais « en marche » dans la démo.
- `bons_livraison` : 4 lignes seulement, statuts `facture` (3) et `livre` (1) — confirme l'indice de
  la recette du 04/09 : aucun BL « à livrer » ou « en préparation » à montrer, le cycle de vie visible
  en démo est tronqué à sa fin.

**Solution.** Ajouter au jeu de données de démo : un devis avec acompte encaissé (facture d'acompte
visible), quelques lignes `users_couts`, un devis signé chez un client `particulier` (avec ses
mentions), et 2-3 BL aux statuts intermédiaires. Pur travail de données, aucun code.

**Ce que ça change pour le premier client.** Ce n'est pas un bug pour l'atelier pilote lui-même — mais
c'est ce qui décide un **deuxième** client : la démo publique est aujourd'hui incapable de prouver ce
qu'on vient de construire pour vendre le produit.

---

### 5. L'onglet « Livrés » des BL doit inclure les BL facturés — 0,5 j

**Constat.** Démo, `/bl` : BL-2026-0011 (statut `facture`) n'apparaît ni dans l'onglet « À livrer » ni
dans l'onglet « Livrés » — seulement dans « Tous ». Le filtre de l'onglet « Livrés » ne couvre pas les
BL déjà passés en facturation, alors que du point de vue de l'atelier, un BL facturé **a bien été
livré**.

**Solution.** Élargir le filtre de l'onglet à `statut in ('livre', 'facture')`, comme c'est déjà fait
pour d'autres écrans du même type (D10/D12 corrigés en vague 3-4).

**Ce que ça change pour le premier client.** Un chef d'atelier qui cherche « est-ce que j'ai bien
livré ce chantier » dans l'onglet censé répondre à cette question précise ne le trouve pas.

---

### 6. Indexer les colonnes `atelier_id` sans index — 0,5 j

**Constat.** `get_advisors` (performance) liste une quinzaine de clés étrangères sans index couvrant,
dont plusieurs portent sur `atelier_id` : `jantes`, `instruments`, `grille_coefs`, `grille_paliers`,
`photos`, `fournee_projets`, `commande_poudre_lignes`. Ce n'est pas une colonne comme les autres :
c'est **la colonne que chaque policy RLS filtre en premier** sur une base multi-atelier.

**Solution.** `create index concurrently` sur les FK `atelier_id` listées par l'advisor. Migration
pure, aucun changement d'écran.

**Ce que ça change pour le premier client.** Invisible aujourd'hui (2 ateliers, quelques lignes par
table) — c'est justement pour ça qu'il faut le faire maintenant, à coût nul, avant que plusieurs
vrais ateliers cohabitent dans les mêmes tables et transforment un scan de 14 lignes en scan de
plusieurs dizaines de milliers.

---

### 7. Rappel automatique de la pesée mensuelle de rendement poudre — 1 j

**Constat.** `/pilotage` > Rendement teintes affiche « Pesée nécessaire → » pour une teinte jamais
pesée depuis le début de la démo — rien ne relance ce geste, il repose entièrement sur la mémoire du
chef d'atelier. En comparaison, **COOCKPIT** (concurrent direct identifié dans l'audit du 20/08 comme
dominant la recherche « logiciel gestion atelier thermolaquage ») fait du suivi de stock poudre par
pesée individuelle avec **alertes personnalisées** un argument produit affiché
([thermolaquage.coockpit.com/fonctionnalites/gestion-stocks](https://thermolaquage.coockpit.com/fonctionnalites/gestion-stocks/)).

**Solution.** Notification mensuelle (même mécanique que `envoyer_recap_quotidien`, déjà en place et
appelée 423 fois en base) : « Teinte X : pesée de rendement à faire, dernière le [date] ».

**Ce que ça change pour le premier client.** Le rendement réel par teinte est justement l'argument
que Thermogestion oppose aux bibliothèques de prix génériques du marché (audit du 20/08, §4) : sans
rappel, ce chiffre retombe sur la mémoire humaine, exactement ce qu'on prétend remplacer.

---

### 8. Précharger la fiche jante depuis le devis — 1 j

**Constat.** Démo : le bloc « JEU DE JANTES » du devis demande Teinte, Réf. constructeur, Dessin,
Finition. À la réception du jeu, la fiche `/jantes` (JJ-xxx) **redemande exactement les mêmes quatre
champs**, sans préremplissage visible depuis le devis d'origine.

**Solution.** Quand un jeu de jantes est créé depuis un devis signé (`jeux_jantes.devis_id` est déjà
la colonne existante), précharger ces quatre champs depuis les lignes du devis ; laisser l'atelier les
corriger si la pièce réelle diffère de ce qui a été chiffré au téléphone.

**Ce que ça change pour le premier client.** C'est de la double saisie sur le geste le plus fréquent
du métier jantes — chiffrer au téléphone, puis ressaisir à la réception physique.

---

### 9. Fiche projet contextualisée par type de pièce — 1-2 j

**Constat.** Démo, PR-2026-0021 (chantier de menuiserie, profilés fenêtre) : la fiche affiche quand
même le champ « Teinte d'origine constructeur (rénovation de jantes) » avec placeholder « ex : Gris
Nardo BMW ». Le formulaire de production n'est pas filtré par type de pièce sur un écran que
l'opérateur ouvre plusieurs fois par jour.

**Solution.** Conditionner l'affichage des blocs de champs à `projets.type_piece` (ou équivalent),
comme c'est déjà fait pour les mentions B2C par `clients.type`.

**Ce que ça change pour le premier client.** Un atelier qui traite à la fois des jantes et d'autres
pièces (menuiserie, mobilier) verra en permanence des champs qui ne le concernent pas sur son écran
de travail quotidien — confusion et perte de confiance dans l'outil.

---

### 10. Distinguer clairement les deux circuits de réception (générique vs jantes) — 1-2 j

**Constat.** Le module `/receptions` (photos, réserves, signature, bon de réception PDF) ne propose
de rattacher la réception qu'à un projet `PR-xxx`, jamais à un dossier `JJ-xxx`. Pour un jeu de
jantes, l'atelier doit deviner qu'il faut utiliser le module spécialisé `/jantes` (qui a son propre
système photo/réserve/signature et son propre PDF, le « bon de prise en charge »). Rien à l'écran
n'explique pourquoi il existe deux circuits ni lequel choisir.

**Solution.** Soit fusionner les deux (le gabarit `pdf/jantes.tsx` est déjà réutilisé ailleurs pour
ce type de document, cf. B6), soit poser un aiguillage explicite dès `/receptions` : « ce dépôt
concerne des jantes ? → `/jantes` ».

**Ce que ça change pour le premier client.** Un atelier mixte (jantes + autres pièces) perd du temps
à chaque réception à choisir le bon écran, sans indication.

---

## b. À trancher par Alexis

1. **Quel partenaire plateforme agréée**, et sous quel délai réaliste. Axonaut est déjà l'outil
   comptable de la maison et immatriculé PA — mais le mandat et le KYC du **client final** (l'atelier
   pilote) sont, comme noté dans le CDC v3, le vrai point de friction du démarrage, pas le
   développement.
2. **Faut-il un garde-fou minimal avant l'intégration complète** : un écran « Factures reçues »
   purement déclaratif (dépôt manuel du PDF/mail reçu) le temps que le partenaire soit branché, pour
   que l'atelier pilote ne reste pas plusieurs semaines sans aucune trace de réception ?
3. **Fusionner ou garder séparés les deux circuits de réception** (jantes / générique) : c'est un
   choix de produit — un atelier 100 % jantes n'a jamais besoin du circuit générique, un atelier mixte
   en a besoin des deux avec un aiguillage.
4. **Le support téléphonique affiché**, déjà recommandé par l'audit du 20/08 (effort zéro ligne de
   code, décision commerciale) : un numéro, des horaires, quelqu'un qui répond. Toujours non tranché
   trois semaines plus tard — c'est le levier de rétention le moins cher de tout ce corpus.
5. **Corriger le RLS InitPlan et les policies redondantes maintenant ou plus tard** (`users`,
   `analytics_events`, `recap_destinataires` réévaluent `auth.<fn>()` par ligne ; `notifications`,
   `pieces_jointes`, `users` ont des policies permissives dupliquées). Sans effet mesurable à la
   volumétrie actuelle (2 ateliers, quelques lignes), donc volontairement laissé hors des 10 — mais
   c'est le même défaut qui a coûté 7,5 s → 6 ms sur ThermoCRM une fois la volumétrie réelle atteinte.
   À corriger en hygiène de fond, sans urgence pour le premier client.

---

## c. Veille réglementaire — facturation électronique, état vérifié au 7 septembre 2026

- **Réception** : obligatoire et **effective depuis le 1ᵉʳ septembre 2026** pour toutes les
  entreprises assujetties à la TVA en France, quelle que soit leur taille — elles doivent pouvoir
  recevoir des factures électroniques structurées via une Plateforme Agréée.
  Sources : [Cegid](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/),
  [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/facturation-electronique-dates-cles-et-calendrier).
- **Émission** : calendrier **confirmé, aucun report**. Grandes entreprises et ETI depuis le
  1ᵉʳ septembre 2026 ; **PME et micro-entreprises au 1ᵉʳ septembre 2027**. Le ministre chargé des
  Comptes publics a réitéré début septembre 2026 le maintien des dates, avec un guide pratique DGFiP,
  une tolérance de bonne foi au démarrage et un numéro d'assistance dédié.
  Sources : [IT Social](https://itsocial.fr/metiers/metiers-actualites/facturation-electronique-la-dgfip-annonce-une-tolerance-au-demarrage-et-ouvre-un-numero-dassistance/),
  [compta-online](https://www.compta-online.com/facturation-electronique-ao5562),
  [Cyplom](https://www.cyplom.com/fr/blog/guide-pratique-demarrage-dgfip-facturation-electronique-1er-septembre-2026).
- **Le portail public de facturation (PPF)** a été abandonné comme canal de facturation dès le
  15 octobre 2024 ; il ne joue plus qu'un rôle d'**annuaire** (adresses de facturation électronique
  des entreprises) et de **concentrateur de données fiscales** vers la DGFiP. Chorus Pro subsiste en
  parallèle, mais uniquement pour le B2G. **Toute entreprise doit donc passer par une Plateforme
  Agréée commerciale**, y compris pour recevoir. Sources :
  [Pennylane — liste des PDP](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/liste-des-pdp),
  [ma-facture-electronique.org](https://ma-facture-electronique.org/portail-public-facturation/).
- **Nombre de plateformes agréées immatriculées** : entre 137 et 150 selon la source et la date de
  mise à jour fin août 2026 — la liste officielle exhaustive et datée au jour près est publiée par la
  DGFiP sur impots.gouv.fr (à consulter directement pour un chiffre exact). Sources :
  [Pennylane](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/liste-des-pdp),
  [Comparateur e-Facturation](https://comparateur-efacturation.fr/guide/liste-plateformes-agreees).
- **E-reporting** (B2C domestique et international B2B/B2C) : **même calendrier que l'émission** —
  1ᵉʳ septembre 2026 grandes entreprises/ETI, 1ᵉʳ septembre 2027 PME/micro. Fréquence hebdomadaire ou
  mensuelle selon la taille pour le B2C. Sanction : 250 €/transmission manquante, plafonnée à
  45 000 €/an. Sources : [tenorsolutions.com](https://tenorsolutions.com/tout-savoir-sur-l-e-reporting/),
  [comparatif-facture-electronique.fr](https://www.comparatif-facture-electronique.fr/e-reporting-tva/).
- **Point de vigilance sur les sources** : plusieurs guides commerciaux en ligne évoquent encore un
  « report à 2026 » — ce sont des articles anciens, non mis à jour, qui font référence au report
  décidé fin 2024 (calendrier d'origine 2024-2025, reporté à septembre 2026/2027). Au 7 septembre
  2026, ce report est **derrière nous** et aucun nouveau report n'est annoncé ; la DGFiP a au
  contraire confirmé publiquement début septembre 2026 qu'il n'y aurait « ni report général ni
  report partiel ».

**Conséquence directe pour Thermogestion** : le produit est en règle sur le **format** (Factur-X
EN16931, vérifié XSD/schematron le 20/08) mais pas sur le **canal** — voir amélioration n°1. C'est la
seule non-conformité active du produit pour un atelier qui reçoit déjà des factures de ses
fournisseurs, ce qui est le cas dès le premier jour.

---

## d. Ce qui a été écarté, et pourquoi

- **Traçabilité four/cuisson (température, durée) par pièce**, un manque relevé chez le concurrent
  américain OnRamp Solutions ([onramp-solutions.com](https://www.onramp-solutions.com/erp-software/coating/)) :
  **déjà couvert**. `fournees` porte `temp_consigne`, `temp_relevee`, `duree_min`, `conso_kwh`,
  `demarree_at`, `terminee_at`, tous alimentés dans la démo. Rien à ajouter.
- **Traçabilité par lot de poudre au niveau de la pièce**, un manque a priori suggéré par la
  comparaison avec Herakles (FIFO par lot en peinture poudre, [herakles.com](https://herakles.com/metiers/sous-traitance.html)) :
  **déjà couvert**. `projets.lot_id` est renseigné sur 12 des 14 projets de démo ; `stock_mouvements`
  porte aussi `lot_id`. La chaîne pièce → lot existe et est utilisée.
- **Étiquette ou QR gravé sur la pièce physique remise au client**, vu chez HBC System / Wheel
  Restore ([hbc-system.com](https://hbc-system.com/products/alloy-wheel-repair-systems-equipment/alloy-wheel-repair-centre-diamond-cut-machine)) :
  non retenu dans les 10. La fiche suiveuse A5 avec QR (B5, déjà livrée) répond déjà au besoin de
  traçabilité interne ; ajouter un second support physique pour le client suppose du matériel
  d'impression/gravure chez l'atelier pilote, à valider avec lui avant de coder quoi que ce soit —
  sinon c'est le gadget que la mission demande d'éviter.
- **CRM avec pipeline/scoring, emailing/SMS marketing, paie, liasse fiscale, compte bancaire
  professionnel** : déjà écartés par l'audit du 20/08 (§4), toujours valables — une TPE de 1 à 10
  personnes n'en a pas l'usage et le risque (comptes bancaires pro gelés : 61 avis sur 200 chez un
  concurrent) dépasse le bénéfice.
- **Bibliothèque de prix type Batiprix** : écartée par le même audit — l'avantage de Thermogestion
  est justement de chiffrer sur le rendement réel, pas sur une base générique à corriger.
- **Synchronisation bancaire, accès expert-comptable gratuit, portail client professionnel complet,
  pièces jointes sur devis/projet/client** : identifiés dès le 20/08 comme prioritaires n°7 à 10,
  toujours vrais (le bucket `pieces_jointes` a d'ailleurs 0 ligne, confirmé en base aujourd'hui), mais
  chacun demande plus de deux semaines — hors échelle de cette chasse, centrée sur ce qui se corrige
  en jours pour le premier client.
- **Achats et fournisseurs (hors réception de factures), clôture d'exercice, état de TVA, litige et
  pénalités, transport, sous-traitance sortante, mode kiosque, remise en banque, RGPD
  (anonymisation), multi-devise** : explicitement hors périmètre du CDC v3 §10, confirmé toujours
  hors des trente premiers jours d'un atelier de 1 à 10 personnes.
- **Support téléphonique affiché** : recommandé le 20/08, toujours vrai et toujours pas tranché — non
  compté dans les 10 parce que ce n'est pas une amélioration produit mais une décision commerciale
  (voir « à trancher », point 4).
- **Les six constats de `AUDIT-SECURITE-07-09-2026.md`** (métadonnées d'atelier lisibles en anonyme,
  pièce jointe sans borne de taille, proxys sans limitation de débit, GRANT trop larges sur
  `notifications`, fonctions exécutables par `PUBLIC`, confirmation d'e-mail désactivée) : non
  repris ici, ils sont déjà consignés avec leurs correctifs propres dans ce rapport daté d'aujourd'hui
  même — les reproposer aurait été le doublon que la mission demandait d'éviter.
- **`fournees.poudre_id`/`jeux_jantes.poudre_id` pointent la référence de poudre et non le lot
  précis** : vérifié en base, mais sans conséquence pratique puisque `projets.lot_id` porte déjà cette
  traçabilité au bon niveau (le projet, pas la fournée) — non retenu faute d'un vrai manque.
