# Audit « logiciel pur » — 20 août 2026

*Le métier est couvert. La question posée est autre : **est-ce que c'est un bon logiciel ?**
Trois enquêtes croisées — le socle applicatif passé au crible du code et de la base, le standard
des SaaS français de facturation et de gestion (14 acteurs), et la conformité réglementaire à
12 jours de l'échéance. Tout constat ci-dessous est vérifié sur pièce.*

---

## 1. Deux non-conformités trouvées et corrigées pendant l'audit

Ce ne sont pas des fonctions manquantes. Ce sont des **factures que la plateforme du client aurait
rejetées**, et le produit les émettait depuis le lot 3.

### 1.1 Le XML était au profil MINIMUM, qui n'est plus dans le socle

Le générateur produisait `urn:factur-x.eu:1p0:minimum`. L'arrêté du 27 juillet 2026 (JORF du
28/07, art. 1er, E, 1°, b) réécrit la liste des formats opposables et la ferme : **EN16931 et
EXTENDED-CTC-FR**, en CII, en UBL et en Factur-X. MINIMUM n'y est plus.

Et ce n'était pas rattrapable en aval : une plateforme agréée doit convertir la facture dans un
format du socle, or une conversion MINIMUM → EN16931 est impossible — les lignes et la ventilation
de TVA n'existent pas dans la source. Il fallait monter le générateur.

**Fait.** Profil `urn:cen.eu:en16931:2017`, lignes détaillées avec quantité, prix unitaire, code
d'unité UN/ECE et TVA par ligne, ventilation par taux, adresses complètes des deux parties,
échéance, IBAN, remise en `SpecifiedTradeAllowanceCharge`, acompte en `TotalPrepaidAmount`.

### 1.2 Trois bugs d'arithmétique que seul le validateur officiel pouvait voir

Le XML produit a été passé dans le **XSD et le schematron officiels Factur-X 1.09 EN16931**, sur
douze factures représentatives. Trois défauts sont sortis, qu'aucun test de structure n'avait vus :

| Constat | Conséquence |
|---|---|
| Sur deux taux de TVA avec remise de pied, la remise était déclarée en **un seul bloc au taux le plus élevé** | **2 erreurs BR-S-08** — facture rejetée. Le cas est banal : revente de poudre à 5,5 %, ou 10 % sur des travaux en logement ancien |
| La déduction d'acompte entrait dans la ventilation de TVA | Le XML annonçait « remise commerciale 100 € » là où le client avait versé un acompte. Faux pour le lecteur, et **BR-CO-11** dès qu'il y a deux taux |
| La TVA était sommée puis arrondie une seule fois | 70,33 € au lieu de 70,34 € sur une facture à deux taux ; et un TTC qui ne s'additionnait pas — HT 100,36 + TVA 20,07 affichés avec TTC 120,44. **BR-CO-15**, règle dure |

**Résultat après correction : douze factures, XSD valide, schematron 0 erreur** — un seul taux,
deux taux, trois taux, remise en pourcentage, remise en montant, acompte, franchise en base, TVA
sur les débits, ligne négative. Les quatre règles arithmétiques sont rejouées en TypeScript dans
`tests/facturx-regles-en16931.test.ts`, pour qu'une régression se voie sans repasser chez le
validateur. **625 tests verts**, déployé.

### 1.3 Ce qui n'était pas un problème

Les quatre mentions obligatoires du 01/09/2026 étaient déjà portées par le modèle et par le PDF :
SIREN du client, catégorie d'opération, TVA sur les débits, adresse de livraison. Elles manquaient
seulement dans le XML — ajoutées. Au passage, la catégorie d'opération était une **constante
React** : elle se déduit maintenant des lignes, côté serveur, avec correction manuelle possible.

---

## 2. Les cinq manques qui comptent vraiment

### 2.1 Il n'y a aucune recherche. Nulle part. — 5 à 7 jours avec la pagination

`grep -rn "ilike\|textSearch"` sur tout le code : **zéro résultat**. Le seul champ « Rechercher »
de la partie atelier filtre en mémoire sur **une seule colonne**, le nom du client. Aucune
recherche sur les devis, les factures, les projets, les bons de livraison, les réceptions, les
lots, le stock. Aucun index texte en base, `pg_trgm` n'est pas installé.

Le client appelle : « c'est pour le devis 2024-0338 ». On ne peut pas le retrouver.

**Et les listes sont plafonnées à 200 lignes**, sans pagination ni tri serveur. Un seul `.range()`
dans tout le dépôt, et il sert à l'export. À 12 000 devis, l'écran en montre 200 et **les 11 800
autres sont inaccessibles depuis l'interface** — ils existent en base, ils ne sont plus dans le
logiciel. À l'inverse, l'écran clients charge **tout, sans limite**, avec `select("*")`, puis trie
dans le navigateur : à 3 000 clients, c'est 3 000 lignes téléchargées sur une 4G d'atelier pour
afficher trente cartes.

Un atelier qui fait cinq devis par jour ouvré atteint le plafond en **huit semaines**.

C'est le seul manque de tout ce rapport qui rend le produit **inutilisable**, pas seulement
pénible. Et il se voit en dix secondes de démonstration dès qu'on charge un jeu de données
réaliste. Aucune fonction métier ne compense ça.

### 2.2 Les rôles n'existent que sur le papier — 3 à 4 jours

`users.role` vaut `owner` ou `staff`, et tout employé invité arrive en `staff`. Ensuite, rien :
**aucune des 50 politiques RLS ne regarde le rôle**. Aucune route, aucune table, aucune colonne
n'est restreinte. L'écran d'invitation n'envoie même pas de rôle, il n'y a pas de sélecteur.

L'opérateur que vous facturez 5 € HT par mois pour qu'il pointe ses heures ouvre Pilotage et lit
**la marge de chacun de vos clients**, le prix d'achat au kilo de chaque lot de poudre, votre
grille tarifaire, votre taux horaire, vos frais généraux, **votre IBAN**. Et il peut les modifier.

C'est en contradiction directe avec le modèle tarifaire posé hier : vous vendez explicitement
l'invitation d'un employé. C'est la première objection d'un atelier de quatre personnes.

### 2.3 On ne peut ni dupliquer, ni corriger, ni annuler — 2 à 3 jours

Aucun bouton « Dupliquer » nulle part. C'est la fonction la plus utilisée d'un logiciel de devis.
Pire : **un devis finalisé est gelé à vie** — vingt-cinq champs passent en lecture seule et aucun
bouton ne permet de revenir en brouillon. Une virgule mal placée, et on ressaisit les douze lignes
dans un nouveau devis pendant que l'ancien reste dans la liste pour toujours. Un clic sur
« Refusé », sans confirmation, est un cul-de-sac définitif.

Côté facture, l'avoir existe mais se saisit de zéro : pas de « faire l'avoir de cette facture ».
Le statut « annulée » est lu partout — badge, mention sur le PDF, exclusion du FEC — mais **aucun
bouton ne peut le poser**.

Les colonnes `parent_id` et `version` sont déjà en base et ne sont utilisées nulle part. Il ne
manque que des boutons et deux fonctions. Meilleur rapport valeur/effort de la liste.

### 2.4 Aucun journal des modifications — 2 à 3 jours

La table `audit_logs` existe, avec son index. **Zéro ligne, et rien ne l'écrit** : aucun trigger,
aucune fonction, aucun appel. Sept tables portent un `created_by` renseigné qui n'est **affiché
nulle part**. On sait qui a créé, jamais qui a modifié.

Litige : « votre devis disait 1 400 €, la facture en fait 1 780 ». Le devis en base porte 1 780 et
rien ne dit qu'il a été modifié, par qui, quand. C'est aussi ce qui manque à la formule Certifié à
249 € pour tenir sa promesse de preuve opposable.

### 2.5 Le produit n'envoie presque rien — 2 à 3 jours

Seize notifications envoyées depuis la mise en service, un seul canal, cinq modèles. **Aucune
alerte de DLU de poudre** (le seuil de 60 jours est purement visuel, il faut ouvrir l'écran Stock
pour le voir), aucune alerte de stock bas, aucune date promise dépassée, aucun récapitulatif
quotidien, aucun rappel d'étalonnage.

Et le pire : les colonnes qui pilotent les relances automatiques sont écrites par le cron et
**n'apparaissent nulle part dans l'application**. L'atelier ne peut ni voir ni couper une relance
envoyée en son nom à son client. Le jour où un gros compte se plaint d'être relancé, il n'y a aucun
bouton.

C'est le chantier que je recommande depuis le lot 2, et il n'a toujours pas bougé.

---

## 3. Ce que font les autres et qu'on ne fait pas

Quatorze acteurs étudiés : Axonaut, Sellsy, Pennylane, Evoliz, Sinao, Henrri, Facture.net, Abby,
Indy, Tolteck, Obat, Batappli, Vertuoza, Zoho, Qonto.

### 3.1 Le seul point qui fasse perdre la vente en septembre

**Le raccordement à une plateforme agréée. Treize acteurs sur quatorze l'ont. Aucun ne le
facture.** Le Factur-X que vous produisez est un **format**, pas un **canal** : sans plateforme
agréée, votre client ne peut ni recevoir (obligatoire au 1er septembre 2026, dans douze jours) ni
émettre (au 1er septembre 2027). La DGFiP est explicite : une « solution compatible » n'est pas
autorisée à transmettre ni à recevoir des factures pour le compte de son client.

Qui fait quoi : **Axonaut est plateforme agréée n° 0110 depuis le 08/01/2026**, Pennylane depuis le
11/12/2025, Abby et Indy en janvier 2026. Evoliz passe par Chaintrust, Henrri et Tolteck par
Pennylane, Obat par Iopole, Batappli par eFacture. Sinao et Facture.net **ne disent rien** et sont
absents des deux listes officielles.

Devenir plateforme agréée soi-même est hors de portée — ISO 27001 auditée COFRAC, tests
d'interopérabilité, audits biennaux, des centaines de milliers d'euros et des années. **Il faut un
partenaire.** Compter 4 à 8 semaines d'intégration.

Deux corollaires du même chantier : la **réception des factures fournisseurs** (l'atelier achète
poudre, gaz, transport — s'il doit ouvrir un second outil pour les recevoir, il prendra le second
outil, et le second outil fait aussi des devis : c'est le mécanisme exact par lequel on se fait
remplacer), et l'**e-reporting B2C**, qui vous concerne directement puisque la jante, c'est du
particulier.

### 3.2 Ce qui fait résilier au bout de trois mois

| Manque | Qui le fait | Effort |
|---|---|---|
| **Synchronisation bancaire et rapprochement** | quasi tous, via Powens, Bridge ou Bankin' | 3-5 sem. |
| **Accès expert-comptable gratuit** | **tous sauf un** | 2-3 sem. |
| **Achats et dépenses avec lecture automatique des factures** | Evoliz, Axonaut, Pennylane, Sinao, Obat | 2-6 sem. |
| **Portail client** | Axonaut, Obat, Zoho dès le gratuit, Qonto en module à 20 € | 3-4 sem. |
| **Mobile utilisable hors réseau** | Tolteck en fait son argument central | 3-5 sem. |

Deux remarques qui changent l'arbitrage.

**La banque n'est pas un confort, c'est la crédibilité de ce que vous avez déjà construit.** Sans
rapprochement, « cette facture est-elle payée ? » reste une question manuelle — et vos relances
automatiques tournent à vide, ou relancent des clients qui ont payé.

**L'accès comptable n'est pas une fonction, c'est un canal de distribution.** Pennylane a
6 000 cabinets partenaires. Un atelier ne change pas de logiciel si son comptable râle ; à
l'inverse, un comptable qui connaît l'outil le prescrit à ses autres clients.

### 3.3 Le meilleur différenciant coûte zéro ligne de code

**Le support humain joignable au téléphone est le grief numéro un du marché en 2026, et personne
ne le corrige.** Axonaut a supprimé son SAV téléphonique. Evoliz a supprimé son numéro en mars
2026 — un client lui écrit que ça ne correspond plus à son slogan « des humains derrière la tech ».
Chez Indy, 112 avis 1 ou 2 étoiles sur 200 mentionnent le support. Chez Qonto, 74 sur 200.

À l'inverse **Obat vend son support comme une fonctionnalité** — 50 personnes, six jours sur sept,
migration Excel comprise — et affiche 4,6/5 sur 654 avis Trustpilot et 4,9/5 sur environ 2 500 avis
Google. Tolteck inclut formation et support téléphonique illimités.

Un numéro de téléphone et de la discipline. À 79 € par mois, c'est finançable, et c'est ce qui vous
distinguera le plus vite.

### 3.4 Trois arguments déjà vrais, à afficher

Votre **siège à 5 €** est le tarif le plus agressif du panel après les gratuits : 9 € chez Evoliz,
10 € chez Sinao, 19-20 € chez Batappli et Obat, **29,99 € chez Axonaut**, le prix du palier chez
Sellsy. Vos **30 jours d'essai** sont les plus longs (Sellsy en donne 14, Batappli 10, Vertuoza
aucun). Et vous êtes **sans engagement** là où Sellsy impose douze mois et Vertuoza une année payée
d'avance, non rétractable.

Pour comparaison honnête, à trois personnes : Thermogestion 89 €, Obat 109 €, Axonaut 118 €,
Sellsy 177 €.

---

## 4. Ce qu'il ne faut pas copier

**Des fonctions inutiles à un atelier de trois personnes** : le CRM avec pipeline et scoring (vous
avez trente à quatre-vingts clients récurrents, votre liste avec tarifs négociés suffit), l'emailing
et le SMS marketing, la paie et les congés, la liasse fiscale, le compte bancaire professionnel —
sur 200 avis Qonto à 1 ou 2 étoiles, **61 concernent un gel de compte** : aucune raison de porter ce
risque.

**Une bibliothèque de prix type Batiprix** n'existe pas en thermolaquage et ne peut pas exister.
C'est en réalité votre avantage : chez les outils du bâtiment, la base est générique et l'artisan
passe son démarrage à la corriger. Chez vous, le prix vient du rendement réel de la poudre, du coût
réel de la fournée et du pointage réel. **La contrainte est ailleurs : le déboursé sec doit être
visible pendant qu'on chiffre**, pas dans un tableau de bord consulté le mois suivant. C'est le
seul enseignement à prendre à ces outils.

**Des pratiques commerciales que le marché punit, et c'est mesurable** : l'engagement annuel
(Sellsy, 16,9 % d'avis à 1 ou 2 étoiles, le pire ratio du panel), la formation payante obligatoire
(Sellsy : 900 à 1 710 € HT ; Obat et Tolteck l'offrent, et ce sont les deux mieux notés), les
modules à la carte, et surtout **retirer une fonction d'une formule déjà payée** — Evoliz a fait
disparaître le multi-devises en juin 2026 sans prévenir, Henrri a mis fin à sept ans de gratuité :
ça fait partir des clients de dix ans d'ancienneté.

Corollaire pour vous : **la conformité électronique et l'accès comptable doivent être dans les
trois formules, y compris celle à 79 €.** Facturer la conformité serait immédiatement comparé, et
défavorablement.

---

## 5. L'ordre que je recommande

| # | Chantier | Effort | Pourquoi celui-là |
|---|---|---|---|
| **0** | **Choisir et intégrer une plateforme agréée** (émission + réception) | 4-8 sem. | Seule échéance dure. Sans elle le produit devient inutilisable pour ses clients |
| **1** | **Recherche globale + pagination + index** | 5-7 j | Seul manque qui rend le produit inutilisable à l'usage. Se voit en démonstration |
| **2** | **Rôles réels appliqués en RLS** | 3-4 j | Contredit directement le siège à 5 € vendu hier |
| **3** | **Dupliquer, repasser en brouillon, annuler, avoir depuis facture** | 2-3 j | Meilleur rapport valeur/effort |
| **4** | **Le courriel du matin** + interrupteur de relance par client | 2-3 j | Rien n'est poussé vers l'atelier. Sept lignes le matin valent tous les tutoriels |
| **5** | **Journal des modifications** sur huit tables + onglet Historique | 2-3 j | Litiges, contrôle fiscal, et la promesse de la formule Certifié |
| **6** | **Support téléphonique affiché** | 0 | Le grief n°1 du marché. Un numéro et de la discipline |
| 7 | Accès expert-comptable gratuit | 2-3 sem. | Canal de distribution, pas fonction |
| 8 | Portail client professionnel | 3-4 sem. | Déjà au programme |
| 9 | Synchronisation bancaire | 3-5 sem. | Fiabilise les relances déjà construites |
| 10 | Pièces jointes sur devis, projet, client | 2-3 j | Le bucket existe, vide, jamais référencé |
| 11 | Corbeille et désarchivage, doublons, hors-ligne du pointage | 4-5 j | Usure quotidienne |

Les points 1 à 6 font **trois semaines de travail** et changent le produit du tout au tout. Le
point 0 est d'une autre nature : c'est une décision et un contrat, pas un sprint.

---

## 6. Ce qui appartient à Alexis

1. **Choisir la plateforme agréée.** Axonaut, que vous utilisez déjà, est immatriculée. Iopole
   (partenaire d'Obat) et Chaintrust (Visma) sont les deux autres candidats sérieux pour un
   éditeur. Le mandat client et le KYC sont le vrai point de rupture du démarrage, pas le
   développement : prévoyez un chemin assisté par téléphone.
2. **Trancher le support téléphonique** : un numéro, des horaires affichés, et qui répond.
3. **Requalifier le catalogue de prestations** : toutes vos prestations sont marquées « service ».
   La revente de poudre, les accessoires et les valves sont des **biens** — sans ça la catégorie
   d'opération ne sortira jamais en « mixte » sur les factures concernées. C'est une décision
   métier, dans Réglages → Prestations.
4. **Compléter deux fiches clients sur huit** : sans adresse ni SIREN, la génération Factur-X est
   refusée avec un message explicite. On ne touche pas aux factures, on complète le client.
5. Les huit tarifs Stripe avant le **12 septembre**, inchangé.

---

## 7. Ce qui n'est pas prouvé

- **Le comportement sous volume n'est pas mesuré.** La base compte 8 clients et 12 devis : les
  constats du §2.1 viennent du code et des index, pas d'un jeu de données injecté.
- **Aucune recette au clavier.** Tout est prouvé par la suite de tests et par des requêtes SQL.
- **La tolérance du profil BASIC WL jusqu'en 2027**, avancée par plusieurs éditeurs, n'a pas pu
  être confirmée en source primaire. Sans effet sur la décision : MINIMUM est hors socle dans les
  deux lectures.
- **Le calendrier d'émission** (2026 pour les grandes entreprises, 2027 pour les TPE/PME) n'a pas
  été revérifié à la source dans cette session.
- Les statuts de plateforme agréée de **Sinao, Facture.net et Vertuoza** restent introuvables, y
  compris chez l'éditeur.
