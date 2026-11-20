# Lot 10 — Trois formules, droits appliqués, et prise en main

*19 août 2026. Passage de deux à trois formules, **avec des droits qui ouvrent et ferment
réellement des écrans** — en base et pas seulement dans le navigateur — et refonte du parcours de
première utilisation : choix de métier qui pré-remplit vraiment, aide contextuelle par écran,
centre d'aide, et fin d'essai expliquée.*

`npm test` : **479 tests, 34 fichiers, tous verts** (445 avant le lot, +34).
`npx next build` depuis PowerShell : compilé sans erreur, **zéro erreur TypeScript**, 63 pages.
Déployé en production et vérifié sur `https://thermogestion-v2.vercel.app`.

---

# 0. Ce qu'Alexis doit faire — les six tarifs Stripe

**À créer dans le tableau de bord Stripe, sur le compte principal Thermogestion** (pas sur un
compte connecté). Un produit par formule, deux tarifs récurrents par produit, tous en **EUR**,
**hors taxes**, et **la `lookup_key` est obligatoire** : le code ne connaît aucun identifiant
`price_…`, il retrouve le tarif par sa clé (`src/lib/abonnement.ts:lookupKey`). Sans elle, le
bouton « Choisir » répond « Tarif introuvable dans Stripe ».

| # | Produit Stripe | Montant | Périodicité | `lookup_key` **exacte** |
|---|---|---|---|---|
| 1 | Thermogestion Atelier | **79,00 €** | mensuel | `thermogestion_atelier_mensuel` |
| 2 | Thermogestion Atelier | **790,00 €** | annuel | `thermogestion_atelier_annuel` |
| 3 | Thermogestion Équipe | **129,00 €** | mensuel | `thermogestion_equipe_mensuel` |
| 4 | Thermogestion Équipe | **1 290,00 €** | annuel | `thermogestion_equipe_annuel` |
| 5 | Thermogestion Certifié | **249,00 €** | mensuel | `thermogestion_certifie_mensuel` |
| 6 | Thermogestion Certifié | **2 490,00 €** | annuel | `thermogestion_certifie_annuel` |

**Deux points à ne pas rater :**

1. **Poser `plan` dans les métadonnées du tarif** — `plan = atelier`, `equipe` ou `certifie` selon
   la ligne. Le webhook lit d'abord `subscription.metadata.plan` (que le code pose lui-même à la
   souscription), puis `price.metadata.plan`, puis déduit de la `lookup_key`. Les métadonnées sont
   une ceinture : sans elles, une `lookup_key` mal orthographiée ferait retomber l'atelier sur la
   formule d'entrée, ce qui est le repli volontaire (on n'offre jamais la formule haute par
   accident) mais qui se verrait au premier client.
2. **Les trois variables d'environnement Vercel** restent à poser, et elles conditionnent tout le
   reste : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`. Sans elles,
   `POST /api/billing/checkout` répond HTTP 500 « Paiement non configuré sur le serveur ». **Voir
   §7 : la date du 12/09/2026 n'a pas bougé.**

Rien d'autre n'est à faire côté Stripe : les six clés remplacent les quatre anciennes
(`thermogestion_solo_*` et `thermogestion_atelier_*` ancienne version), qui n'ont jamais été
créées.

---

# 1. Les trois formules

Décision d'Alexis, appliquée partout depuis une source unique (`src/lib/abonnement.ts`, lu par la
vitrine, la page tarifs, l'écran d'abonnement, le `llms.txt` et le balisage `SoftwareApplication`).

**Le principe de segmentation : ce qui fait payer plus n'est jamais le métier, c'est le nombre de
personnes et le niveau de preuve exigé par les clients.** Le module jantes est donc entier dans la
formule d'entrée — un rénovateur de jantes qui travaille seul a tout son métier à 79 €. Un test
(`droits-formules.test.ts`) fige cette règle : il vérifie que « jantes » et « pouce » sont dans la
liste de la première formule et qu'aucune capacité verrouillée ne porte sur le métier de la jante.

| | **Atelier** | **Équipe** | **Certifié** |
|---|---|---|---|
| Mensuel HT | **79 €** | **129 €** | **249 €** |
| Annuel HT (2 mois offerts) | **790 €** | **1 290 €** | **2 490 €** |
| Utilisateurs | 1 à 2 | illimités | illimités |

**Atelier — le métier complet, jantes et industrie.** Devis au m², au ml et au pouce avec signature
en ligne ; dossier jantes complet (véhicule, jeu, suivi roue par roue, teinte d'origine
constructeur, bon de prise en charge photographié) ; suivi de production et QR ; stock poudres avec
lots, DLU et décompte à la cuisson ; réception avec photos ; bon de livraison signé ; factures,
Factur-X et export comptable FEC.

**Équipe — ce que la taille impose.** Utilisateurs illimités ; facturation mensuelle
récapitulative ; tarifs négociés par client ; planification des fournées et capacité du four ; prix
de revient réel et rentabilité par client ; relances automatiques des devis et des impayés ;
commande de poudre au catalogue Thermopoudre.

**Certifié — ce que la réglementation impose.** Cahier de contrôles avec seuils paramétrables ;
registre des bains ; étalonnage des instruments ; non-conformités ; certificat de conformité
opposable ; fiche de cuisson tracée ; registre des déchets ICPE ; classeur FDS.

**Ce qui n'apparaît nulle part, volontairement** : le portail client (il n'existe pas, audit #38)
et le paiement en ligne des factures (écrit et testé, mort en production faute de clé Stripe, #25).
Un commentaire dans `lib/abonnement.ts` dit quoi remettre le jour où les clés seront posées.

---

# 2. Les droits, pour de vrai

C'était la partie qui pouvait rater. Une formule qui n'ouvre ni ne ferme rien est une coquille, et
il y en a déjà eu onze sur ce projet. La règle que je me suis donnée : **tout droit vit en base,
l'écran n'en est que la traduction lisible.**

## 2.1 Le barème, à un seul endroit et vérifié en double

| Capacité | Formule minimale | Ce qu'elle couvre |
|---|---|---|
| `tarifs_negocies` | Équipe | `client_tarifs` |
| `facturation_mensuelle` | Équipe | RPC `facture_recapitulative` |
| `fournees` | Équipe | `fournees`, `fournee_projets` |
| `rentabilite` | Équipe | vues `projet_revient`, `client_rentabilite`, écran `/pilotage` |
| `relances_auto` | Équipe | cron `relancer_devis_et_factures` |
| `commande_poudre` | Équipe | `commandes_poudre`, `commande_poudre_lignes` |
| `qualite` | Certifié | `controles`, `controles_bains`, `instruments`, `non_conformites`, `referentiels_qualite`, `certifications` |
| `certificat` | Certifié | route `/api/pdf/certificat/[id]` |
| `fiche_cuisson` | Certifié | route `/api/pdf/fournee/[id]` |
| `registre_dechets` | Certifié | `dechets`, route `/api/pdf/registre-dechets` |
| `fds` | Certifié | `fds` |

Le barème existe **deux fois** : `NIVEAU_REQUIS` dans `src/lib/abonnement.ts` et
`public.capacite_du_plan(plan, capacite)` en plpgsql. C'est une duplication assumée — le navigateur
ne peut pas appeler la base pour décider s'il grise un bouton — et un test la ferme : les 33
combinaisons (3 formules × 11 capacités) sont comparées une par une entre le code et la base à
chaque exécution de `npm test`.

**`capacite_du_plan` est en plpgsql et pas en SQL avec un `else true`** : une capacité mal
orthographiée dans un trigger lève `CAPACITE_INCONNUE` au lieu d'ouvrir la porte en silence. Une
formule inconnue lève `PLAN_INCONNU`. Les deux sont testés.

## 2.2 Quatre verrous, à quatre endroits différents

**a) Un trigger `exiger_capacite` sur 13 tables**, en `BEFORE INSERT OR UPDATE`, qui lève
`PLAN_INSUFFISANT`. Il est le pendant de `exiger_abonnement`, qui existait déjà et qui reste devant
lui dans l'ordre d'exécution.

> **Choix assumé : le verrou ne porte pas sur `DELETE`.** Une formule qu'on redescend ne doit pas
> emprisonner les données déjà saisies. L'atelier garde le droit de les lire, de les exporter et de
> les supprimer — il perd celui d'en produire de nouvelles. C'est écrit à l'écran (« Ce que vous
> avez déjà saisi reste consultable et exportable ») et testé.

**b) Les vues de coût portent la condition elles-mêmes.** `projet_revient` et `client_rentabilite`
sont interrogées **directement par le navigateur** en REST : masquer l'entrée « Pilotage » dans le
menu n'aurait rien masqué du tout. Les deux vues se terminent désormais par
`where capacite_ouverte(atelier_id, 'rentabilite')`. Un atelier en formule Atelier qui appelle
`/rest/v1/client_rentabilite` avec sa propre clé reçoit **zéro ligne**. Testé.

**c) Les routes PDF vérifient côté serveur.** Une route PDF ne fait que lire : aucun trigger ne la
couvre, et une URL connue aurait suffi à sortir un certificat de conformité sans le payer. Les
quatre routes concernées appellent `ma_capacite()` et répondent **HTTP 402** avec un message qui
nomme la formule. *(Vérifié en production : `/api/pdf/registre-controles` sur un atelier en formule
Atelier répond « Cahier de contrôles et qualité tracée — cette pièce fait partie de la formule
Certifié ».)*

**d) La RPC `facture_recapitulative` et le cron de relance** portent leur propre condition. Le cron
est le cas le plus discret : sans ça, des relances seraient parties **au nom d'un atelier dont la
formule ne les couvre pas**, et personne ne l'aurait vu passer.

## 2.3 Le piège que j'ai failli laisser, et comment il s'est refermé

`plan_effectif` et `capacite_ouverte` ont d'abord été écrites en `SECURITY DEFINER`, par mimétisme
avec `abonnement_ouvert`. Elles prennent **un atelier en argument**. Exposées en RPC PostgREST,
elles répondaient donc la formule de **n'importe quel atelier** dont on connaîtrait l'identifiant —
et un simple `revoke` ne suffisait pas, puisque les deux vues `security_invoker` en ont besoin pour
fonctionner chez l'appelant.

Les deux fonctions sont passées en **`SECURITY INVOKER`**. La RLS de `subscriptions` fait alors le
travail : appelées depuis un trigger (déjà `SECURITY DEFINER`, donc exécuté par le propriétaire),
elles voient la ligne ; appelées par un tiers, elles n'en voient aucune et retombent sur la formule
d'entrée, qui n'ouvre aucune des onze capacités. Un test anonyme le vérifie.

## 2.4 La limite d'utilisateurs

`limite_utilisateurs()` renvoie **2** en formule Atelier, `null` (illimité) au-dessus. Un trigger
`limite_utilisateurs` sur `users` **et** sur `invitations` lève `LIMITE_UTILISATEURS`.

**Les invitations en attente comptent une place** : sinon la limite se contourne en envoyant dix
invitations d'un coup. L'écran Réglages > Équipe affiche « Formule Atelier — 1 sur 2 utilisateurs,
1 invitation en attente » et grise le bouton quand il n'y a plus de place, avec la **même** règle de
calcul que le trigger — un écran qui annoncerait une place libre que la base refuse ferait croire à
un bug.

**Un atelier qui redescend de formule ne perd aucun opérateur.** La limite porte sur la création
d'un accès, jamais sur les accès existants.

## 2.5 Pendant l'essai, tout est ouvert — et l'atelier peut quand même comparer

`plan_effectif()` renvoie `certifie` pendant tout l'essai : l'atelier voit ce qu'il achète.

Mais un exploitant qui hésite entre deux formules a besoin de voir **ce qu'il perd**, pas seulement
ce qu'il gagne. D'où l'**aperçu de formule** (`apercu_formule`, colonne `subscriptions.apercu_plan`,
sélecteur sur l'écran Abonnement) : trois boutons qui font regarder son propre atelier comme dans
une formule donnée, réversibles en un clic.

C'est une fonction qui **ne peut rien ouvrir** :
- hors essai, elle lève `APERCU_HORS_ESSAI` — la formule payée fait seule autorité ;
- pendant l'essai, tout est déjà ouvert, donc poser un aperçu ne peut que restreindre ;
- elle est réservée au responsable (`is_owner()`) et révoquée pour `anon`.

**C'est aussi ce qui rend les verrous testables sans clé `service_role`.** La suite de tests
n'utilise que la clé publiable et un compte `authenticated` ordinaire (règle du projet, cf.
`TESTS.md`) : sans l'aperçu, il aurait été impossible d'attaquer les verrous depuis l'extérieur, et
on se serait contenté de tester la table des droits — c'est-à-dire rien.

---

# 3. Ce que voit l'atelier

- **Une rubrique fermée reste visible et cliquable**, avec le nom de la formule qui l'ouvre en
  pastille dans le menu (« Équipe » sur Fournées, Commandes poudre, Pilotage ; « Certifié » sur
  Qualité). La masquer serait plus propre à l'œil et catastrophique commercialement : on ne peut
  pas vouloir payer pour ce qu'on ne sait pas exister.
- **L'écran fermé nomme la fonction, dit à quoi elle sert dans le métier, affiche le prix**, et
  précise que les données déjà saisies restent consultables et exportables. Pas de « passez au plan
  supérieur ».
- **Les blocs verrouillés dans un écran ouvert** sont traités de la même façon : le panneau de
  facture récapitulative, le bloc « Tarifs négociés » d'une fiche client, le bandeau de prix de
  revient sur une fiche projet.
- **La formule en cours est marquée** sur l'écran Abonnement, et son bouton est inactif.

---

# 4. Onboarding et prise en main

## 4.1 Le choix de métier, qui écrit vraiment

Troisième question de l'écran d'inscription, sans valeur pré-cochée : **Rénovation de jantes**,
**Thermolaquage industriel**, ou **Les deux**. La réponse écrit réellement (`src/lib/metier.ts`) :

| Ce qui est posé | Jantes | Industrie | Les deux |
|---|---|---|---|
| Grille tarifaire par défaut (forfait minimum 50 €) | ✔ | ✔ | ✔ |
| Paliers de prix au m² | 1 tranche à 60 € | 4 tranches, 90 → 35 € | 4 tranches |
| Coefficients finition / complexité / couches | réduits | complets | complets |
| Barème au pouce (70 / 85 / 100 / 130 € HT) | ✔ | — | ✔ |
| Coefficients de dessin et de finition de jante (×1 à ×1,8) | ✔ | — | ✔ |
| Familles de prix au mètre linéaire | — | 3 familles | 3 familles |
| Prestations | 8 opérations de jante (codes `JT-*`) | 7 prestations d'atelier | les 15 |
| Parcours de production | 13 étapes jantes | 7 étapes | les deux |
| Référentiel qualité | contrôle interne, sans label | Qualicoat classe 1 | Qualicoat classe 1 |

Deux détails qui comptent :

- **Les prestations de jante sont créées avec leur `code`** (`JT-DEVOILAGE`, `JT-VALVE-TPMS`…),
  parce que c'est par le code — jamais par le nom — que le moteur de chiffrage les retrouve. Les
  prix indicatifs sont exactement ceux que propose déjà l'écran Réglages : deux endroits du produit
  ne peuvent pas suggérer deux tarifs différents pour le même geste.
- **Un atelier de jantes seul ne reçoit pas de référentiel Qualicoat.** Personne ne certifie
  Qualicoat une jante, et revendiquer un label qu'on n'a pas est le pire départ possible. Il reçoit
  un « Contrôle interne — jantes » limité à l'épaisseur, l'adhérence et l'aspect.

Chaque écriture est isolée : si les prestations échouent, la grille reste posée et l'atelier apprend
précisément ce qui a manqué. Une écriture muette ici recréerait exactement le problème qu'on ferme.

## 4.2 La checklist de démarrage, corrigée

Elle avait un défaut nouveau depuis le pré-remplissage : sa première étape se cochait sur
« un palier porte un prix », or **un prix existe désormais toujours**. Elle aurait donc validé des
tarifs que personne n'a lus — **une grille pré-remplie et jamais relue est plus dangereuse qu'une
grille vide**, parce que l'atelier facture au tarif de quelqu'un d'autre sans s'en apercevoir.

La première étape est devenue « **Vérifiez vos prix** », et elle se coche sur un horodatage posé par
un bouton « J'ai vérifié mes prix » qui n'apparaît qu'une fois, en tête de l'onglet Grille, sous un
avertissement explicite. La deuxième étape envoie désormais vers `/import` (« Vous arrivez d'un
tableur ? »), ce que l'audit fonctionnel réclamait au point #54.

## 4.3 L'aide contextuelle

`AstuceEcran` : une explication courte à la première visite de onze écrans (tableau de bord, devis,
projets, jantes, réceptions, fournées, qualité, stock, factures, pilotage, réglages), effaçable, et
**jamais réaffichée**.

Le « jamais plus » est porté **par l'utilisateur en base** (`users.aides_vues`), pas par le
navigateur : la tablette de l'atelier est partagée, et l'opérateur qui la prend après le chef doit
avoir droit à sa propre explication. Un repli `localStorage` double le mécanisme — sur l'atelier de
démonstration toute écriture est refusée, et sans lui le visiteur reverrait la même carte à chaque
navigation, soit exactement l'inverse de l'effet recherché.

Les textes sont écrits dans la langue du métier. Exemple, sur la qualité : *« Un référentiel ne
demande pas que vous mesuriez : il demande que vous puissiez montrer que vous avez mesuré, avec quel
instrument, étalonné quand, et selon quels seuils. »*

## 4.4 Le centre d'aide

`/aide`, accessible depuis le menu latéral, la barre basse et l'en-tête mobile. **Six tutoriels de
tâches réelles**, rangés par tâche et non par écran — personne ne cherche « module de facturation »,
on cherche « facturer le mois de mars à Dupont » :

1. **Faire son premier devis** — pourquoi une pièce de 0,4 m² coûte plus cher au m² qu'un portail de
   12 m², à quoi sert le coefficient de complexité, pourquoi le forfait minimum se discute très bien
   au téléphone.
2. **Réceptionner un jeu de jantes** — pourquoi le litige se joue à la réception, la case « voile »
   qui évite la conversation la plus désagréable du métier, le diamantage piqué qui ne se répare pas
   comme le reste.
3. **Lancer une fournée** — vingt minutes de purge qui ne se facturent à personne, le blocage dur
   sur les cycles incompatibles, l'écart consigne/relevé qui explique une adhérence ratée trois
   semaines plus tard.
4. **Sortir un certificat de conformité** — *« le verdict se joue sur le mini : c'est au point le
   plus mince que le film cède, que l'humidité passe et que la corrosion démarre. Une moyenne à
   80 µm avec un point à 35 µm est une pièce non conforme, quelle que soit la moyenne. »*
5. **Facturer un mois de livraisons** — la remise reportée bon par bon plutôt que fondue dans les
   prix unitaires, et pourquoi c'est ce que le client contrôle.
6. **Reprendre vos données d'un tableur** — partir de son fichier, pas du nôtre.

Chaque tutoriel se termine par **« Ce qui se rate le plus souvent »**, écrit franchement. Les
tutoriels sont filtrés par le métier déclaré à l'inscription, et **restent lisibles même quand la
formule ne couvre pas la fonction** : savoir ce qu'on n'a pas est la moitié de la décision d'achat.

## 4.5 La fin d'essai

- **À plus de 7 jours** : le bandeau habituel.
- **À 7 jours ou moins**, le bandeau change de ton et de couleur : « Votre essai se termine dans
  N jours — choisissez votre formule pour continuer à travailler ».
- **Sur l'écran Abonnement**, l'atelier lit ce qu'il perd **avec ses propres chiffres**, comptés en
  base : « Le 12/09/2026, votre atelier passera en lecture seule : vous garderez tout sous les yeux
  — vos 14 devis, 21 projets et 9 factures — sans pouvoir créer ni modifier. Aucune donnée n'est
  supprimée, jamais. »
- **Après la fin de l'essai**, le même écran répète le compte réel et ajoute : « Vous récupérez la
  main à la seconde où vous souscrivez, sur les mêmes données. »
- Le modal de blocage laisse désormais passer `/aide` en plus de `/abonnement` et `/reglages` : un
  atelier bloqué qui cherche à comprendre ce qui lui arrive ne doit pas se retrouver sans lecture.

---

# 5. Recette

## 5.1 Tests

**479 tests, 34 fichiers, tous verts.** Le nouveau fichier `tests/droits-formules.test.ts` en
apporte 34, sur le modèle de `verdict-qualite-serveur` : **il n'interroge pas l'écran, il attaque la
base depuis un client PostgREST ordinaire et depuis un client anonyme.**

| Ce qui est vérifié | |
|---|---|
| Les trois formules, les six prix, les six `lookup_key` | ✔ |
| Le prix annuel vaut exactement dix mois (deux mois offerts) | ✔ |
| Le module jantes est bien dans la formule d'entrée | ✔ |
| Les 33 combinaisons formule × capacité, code contre base | ✔ |
| Une capacité inventée lève `CAPACITE_INCONNUE`, une formule inventée `PLAN_INCONNU` | ✔ |
| Pendant l'essai, `mon_plan()` = `certifie` et les 11 capacités sont ouvertes | ✔ |
| En formule Atelier : 7 tables refusent l'écriture avec `PLAN_INSUFFISANT` | ✔ |
| En formule Atelier : `client_tarifs` refusé, `facture_recapitulative` refusée | ✔ |
| En formule Atelier : `client_rentabilite` et `projet_revient` rendent **0 ligne** | ✔ |
| La **lecture** des données déjà saisies reste ouverte | ✔ |
| Le métier reste entier : un client se crée toujours | ✔ |
| `ma_limite_utilisateurs()` = 2, et la 3ᵉ place est refusée, invitations comprises | ✔ |
| En formule Équipe : fournées ouvertes, utilisateurs illimités, rentabilité ouverte, qualité fermée | ✔ |
| L'aperçu refuse une formule inventée et est fermé à `anon` | ✔ |
| Le retour à l'essai complet rouvre tout | ✔ |
| **Un atelier ne peut pas se hisser tout seul dans une formule payante** — vérifié sur l'état après coup, pas sur le code de retour | ✔ |
| Un client anonyme : 0 ligne de rentabilité, 0 capacité, 6 tables fermées, aucune fuite de la formule d'un autre atelier | ✔ |

Une précaution qui vaut d'être notée : les fichiers de test partagent le même atelier jetable et
s'exécutent en série. Un aperçu de formule laissé posé ferait tomber **tous les fichiers suivants**.
`afterEach` et `afterAll` rétablissent l'essai complet systématiquement.

## 5.2 Build et déploiement

`npx tsc --noEmit` : **zéro erreur**. `npx next build` depuis PowerShell : compilé, 63 pages
générées, aucun avertissement. `vercel --prod --yes` : en ligne.

## 5.3 Recette réelle dans Chrome

| Vérification | Résultat |
|---|---|
| `/prix-logiciel-thermolaquage` affiche les trois formules avec les bons montants | ✔ |
| Le concurrent n'est nommé nulle part — « un éditeur français spécialisé » | ✔ |
| Le tableau « Ce qui fait changer de formule » est en ligne | ✔ |
| Écran Abonnement : trois cartes, « Votre formule » sur Certifié, bouton inactif | ✔ |
| **Atelier rétrogradé en formule Atelier** : `/qualite` se ferme sur la carte d'explication, avec le prix | ✔ |
| Menu latéral : pastilles « Équipe » sur Fournées / Commandes poudre / Pilotage, « Certifié » sur Qualité | ✔ |
| `/api/pdf/registre-controles` répond **402** avec le message nommant la formule | ✔ |
| Atelier remis en formule Certifié : pastilles disparues, écrans rouverts | ✔ |
| `/aide` et `/aide/sortir-certificat` répondent et s'affichent | ✔ |
| Astuce de première visite sur `/devis`, « J'ai compris », **absente après rechargement** | ✔ |

**Réserve de recette, à connaître :** la vérification du verrou a demandé de basculer
momentanément l'atelier de **démonstration** en formule Atelier, puis de le remettre en Certifié.
L'opération a duré moins de deux minutes et l'état final est vérifié — mais si un visiteur est passé
sur `/demo` pendant ce laps de temps, il a vu une démonstration amputée de sa qualité. Le prochain
lot devrait se doter d'un atelier de recette dédié plutôt que d'emprunter la démo.

---

# 6. Ce qui a changé en base

| Migration | Contenu |
|---|---|
| `lot10_trois_formules_socle` | Codes de formule migrés (`atelier` → `certifie`, `solo` → `atelier`, **dans cet ordre**), nouvelle contrainte, colonne `apercu_plan`, `niveau_plan`, `capacite_du_plan`, `plan_effectif`, `capacite_ouverte`, `ma_capacite`, `mon_plan` |
| `lot10_verrous_par_formule` | `trg_exiger_capacite` + trigger `exiger_capacite` sur 13 tables ; `limite_utilisateurs`, `ma_limite_utilisateurs`, `trg_limite_utilisateurs` sur `users` et `invitations` |
| `lot10_verrous_lecture_et_rpc` | `projet_revient` et `client_rentabilite` portent la condition de capacité |
| `lot10_capacites_en_security_invoker` | Les six fonctions de droit passent en `SECURITY INVOKER` (§2.3) |
| `lot10_create_atelier_apercu_et_rpc` | `create_atelier` sème la formule `atelier` (l'ancien `solo` violait la nouvelle contrainte), `apercu_formule`, garde de formule dans `facture_recapitulative` et dans le cron de relance |
| `lot10_revocations_postgrest` | `apercu_formule` révoquée pour `anon`, les deux fonctions de trigger révoquées pour `anon` et `authenticated` |
| `lot10_aides_vues_utilisateur` | `users.aides_vues text[]` |

**L'ordre de migration des codes de formule était le seul point réellement dangereux** : renommer
`solo` en premier aurait écrasé l'ancien `atelier`, et l'atelier de démonstration aurait perdu la
qualité. État vérifié après coup : démo en `certifie/active`, ThermoTest en `atelier/trialing`.

---

# 7. Ce qui reste à Alexis

| # | À faire | Enjeu |
|---|---|---|
| **1** | **Créer les six tarifs Stripe du §0** et poser les trois variables Vercel | **Le 13/09/2026, ThermoTest passe en lecture seule et « Souscrire » répond HTTP 500.** Rien de ce document n'a d'importance si le produit se verrouille tout seul. |
| **2** | Confirmer ou supprimer le **« −20 % client Thermopoudre »** | Toujours affiché sur la page prix, toujours jamais confirmé. À 249 €, la remise vaut 598 €/an et par client. |
| **3** | Décider si un **abonnement annuel Certifié** doit ouvrir la prestation d'accompagnement à 490 € évoquée dans `POSITIONNEMENT.md` §5 | Non implémenté, non affiché. |
| **4** | **Faire relire les trois PDF qualité par un responsable qualité d'atelier certifié** | Recommandation inchangée depuis le lot 2, et devenue plus coûteuse : c'est maintenant une formule à **249 €** qui repose dessus. |
| **5** | Supprimer la ligne de test dans `leads` (`recette-vitrine@thermopoudre.fr`) | Signalée au lot 9, toujours là. Je ne supprime pas de données. |

---

# 8. Mon avis franc

**Sur les droits : c'est solide, et pour une fois je peux le prouver.** Le verrou est en base à
quatre endroits différents, il est attaqué depuis un client PostgREST anonyme et authentifié à
chaque exécution de `npm test`, et la table des droits du navigateur est comparée à celle de la base
combinaison par combinaison. Le point qui aurait pu passer inaperçu — les vues de rentabilité
interrogées en REST — est fermé dans la vue elle-même. Et le `SECURITY DEFINER` qui aurait fait
fuiter la formule des ateliers voisins a été trouvé pendant l'écriture, pas après.

**Ce dont je ne suis pas certain, c'est la segmentation elle-même, et ce n'est pas technique.**

1. **La marche entre Atelier et Équipe est raide, et le déclencheur est le mauvais.** Un atelier de
   deux personnes qui embauche un troisième opérateur passe de 79 à 129 €, soit +63 %, pour une
   raison qu'il vivra comme une taxe à l'embauche. Ce qu'il veut vraiment à ce moment-là, c'est un
   accès de plus ; il découvre qu'il achète aussi la planification des fournées et la rentabilité
   par client, dont il n'a pas encore l'usage. **Un utilisateur supplémentaire facturé à part
   (15 ou 20 € par mois) sur la formule Atelier lisserait ça**, et transformerait un moment de
   friction en croissance de revenu.

2. **Le plan Certifié est le bon pari et le plus fragile.** Personne au monde ne vend la qualité
   opposable à un atelier de cette taille : c'est le meilleur argument du dossier. Mais 249 €, c'est
   trois fois la formule d'entrée, et ça repose entièrement sur des documents que **personne n'a
   jamais fait relire par un auditeur**. Si le certificat ne passe pas un audit Qualicoat, ce n'est
   plus une page marketing à corriger, c'est une formule à 3 000 € par an à rembourser. Le
   rendez-vous du §7-4 devrait précéder le premier euro de publicité sur ce segment.

3. **Le module jantes dans la formule d'entrée est la bonne décision, et elle coûte cher.** Un
   atelier de rénovation de jantes de cinq personnes n'aura jamais besoin de fournées, de registre
   des bains ni de certificat Qualicoat : il restera à 79 € ou passera à 129 € uniquement pour les
   utilisateurs. **La cible jantes est donc structurellement plafonnée à la formule basse**, alors
   que c'est celle où le produit est le plus différenciant et où il n'a aucune concurrence. Il
   manque une marche qui parle à ce métier — un suivi de flotte pour les concessions, un nuancier
   client par lien, une galerie avant/après — et aucune n'existe aujourd'hui.

**Sur l'onboarding : c'est mieux, et ça ne suffira pas.** Le choix de métier pose vraiment quinze
prestations, un barème au pouce et un parcours de production, et c'est une transformation réelle par
rapport à l'écran de réglages vide. Mais l'audit fonctionnel disait déjà l'essentiel et il n'a pas
bougé : **rien n'est poussé vers l'atelier.** Un exploitant de trois personnes ne vient pas
consulter un logiciel. Aucun tutoriel, aucune astuce et aucune checklist ne remplacent un mail de
sept lignes le matin qui dit « trois lots de poudre périment cette semaine, deux devis attendent
depuis dix jours, une facture est échue depuis quinze ». C'est la première cause d'abandon à trois
semaines, ça se code en une journée, et c'est ce que je ferais avant tout le reste.

**Et une inquiétude de calendrier.** Ce lot ajoute une raison de plus de ne pas rater le
12 septembre : jusqu'ici, un essai qui expirait bloquait un atelier ; désormais, un webhook Stripe
mal configuré peut aussi poser la **mauvaise formule** — le repli est volontairement la formule
d'entrée, donc un atelier qui aurait payé 249 € se retrouverait avec 79 € de droits. C'est le bon
sens du repli, mais il faut **vérifier la première souscription réelle en base** (`subscriptions.plan`)
plutôt que de la croire sur parole.
