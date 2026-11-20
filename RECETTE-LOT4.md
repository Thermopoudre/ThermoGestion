# Recette Lot 4 « Prêt à vendre » — Thermogestion v2

Travaux du **18/08/2026**, déployés en production (`https://thermogestion-v2.vercel.app`), base
Supabase `luujbyqenmzivzhiatze`. Ce rapport suit la même règle que le précédent : ce qui n'a pas
été vérifié est signalé comme tel, et les limites sont nommées avec ce qu'il faut pour les lever.

Deux reliquats du lot 3 sont traités en premier (A1, A2), puis les cinq chantiers du lot 4.

---

## A1. Le PDF Factur-X est maintenant un PDF/A-3 — vérifié par veraPDF

C'était le seul point bloquant restant du lot 3 : le document utilisait Helvetica, une des
14 polices standard du format PDF, que PDF/A interdit parce que leur programme n'est pas dans le
fichier.

**Ce qui a été fait.** Liberation Sans est incorporée (romain + gras), redistribuée **sans
modification** dans `src/lib/pdf/fonts/` avec sa licence (SIL Open Font License 1.1 — le nom
« Liberation » est un *Reserved Font Name*, ce qui interdit de la modifier ou de la renommer, mais
pas de la redistribuer telle quelle ni de l'incorporer). Elle est **métriquement compatible avec
Helvetica** : c'est la raison du choix, la mise en page des documents déjà émis ne bouge pas.

Les `.ttf` ne sont jamais `import`és — ils sont lus au rendu. Sans déclaration explicite, l'analyse
de dépendances de Next ne les aurait pas embarqués dans la fonction déployée : `outputFileTracingIncludes`
les ajoute aux quatre routes PDF, et `outputFileTracingRoot` empêche Next de calculer cette trace
depuis un dossier parent (un autre `package-lock.json` traîne au-dessus du projet sur le poste).

**La vérification, et c'est elle qui compte.** Le fichier contrôlé n'est pas un PDF fabriqué en
local : c'est celui que **la production** a renvoyé sur `/api/pdf/facture/<id>?facturx=1`.

| Contrôle | Outil | Résultat |
|---|---|---|
| Conformité PDF/A-3B | **veraPDF 1.30.2** (`verapdf -f 3b`) | **PASS — 146 règles, 0 en échec, 4 607 contrôles** |
| Détection automatique du profil | veraPDF sans `-f` | reconnu **3b** d'après le XMP |
| Polices embarquées | inspection du fichier | `CZZZZZ+LiberationSans-Bold`, `DZZZZZ+LiberationSans`, 2 `/FontFile2` |
| Absence des polices standard | inspection du fichier | aucune occurrence de `/Helvetica`, `/Times-Roman`, `/Courier` |
| Pièce jointe Factur-X | `facturx.get_facturx_xml_from_pdf` | `factur-x.xml` retrouvée |
| XML extrait du PDF | `facturx.xml_check_xsd` (MINIMUM) | **True** |

**Avant / après, sur le même document.** Le PDF produit avec Helvetica a été validé par le même
outil pour ne pas se contenter d'une affirmation : **FAIL**, 145 règles passées, **1 en échec** —
ISO 19005-3 clause 6.2.11.4.1, « les programmes de toutes les polices utilisées doivent être
incorporés ». C'était bien le seul obstacle, et il est levé.

Le test `tests/pdf-polices.test.ts` garde la condition (aucune police standard, un `/FontFile2` par
graisse, sur la facture **et** sur le devis) : une retouche de style qui remettrait `fontFamily:
"Helvetica"` fait échouer la suite.

> On peut désormais écrire « PDF/A-3 conforme » — en citant l'outil et sa version.

---

## A2. Commande de poudre depuis l'application

### Ce qui est livré

Un **panier de réapprovisionnement** persistant en base (`commandes_poudre` au statut `panier`,
un seul par atelier), alimenté par deux chemins :

- depuis l'écran **Stock**, le bandeau d'alerte liste chaque teinte sous le seuil et propose
  « Mettre au panier de réapprovisionnement » d'un coup, avec une quantité conseillée : de quoi
  repasser au **double du seuil**, arrondi au sac de 5 kg. Recommander exactement le manquant
  remettrait la teinte en alerte à la première fournée ;
- depuis la **fiche d'une poudre**, qu'elle soit en alerte ou non — un atelier commande aussi
  parce qu'il vient de signer un gros chantier.

L'envoi transforme le panier en **bon de commande numéroté** (`BC-2026-0001`, préfixe ajouté à la
numérotation) et l'expédie par mail au fournisseur, avec **copie à l'atelier**, par la file
`notifications` et le cron existant. Le numéro n'est attribué qu'à l'envoi : un panier abandonné ne
troue pas la série.

À la livraison, « Marquer reçue et entrer en stock » crée **un lot de poudre par ligne** (numéro de
lot dérivé du bon de commande, fournisseur, DLU) et incrémente le stock. C'est ce qui ferme la
boucle demandée par la fonction 34 du cahier des charges : la commande alimente la traçabilité, pas
seulement un compteur.

Chaque ligne porte enfin un lien **« Mettre au panier sur thermopoudre.fr »** pour l'atelier qui
préfère payer en ligne tout de suite.

### Ce qui a été vérifié

| Contrôle | Résultat |
|---|---|
| Panier unique sous deux appels concurrents | conforme (index unique partiel) |
| Ajout deux fois de la même teinte | quantités additionnées, une seule ligne |
| Envoi : numérotation + notification en file | `BC-2026-0001`, payload complet |
| Second envoi de la même commande | refusé (`COMMANDE_DEJA_ENVOYEE`) |
| Envoi d'un panier vide | refusé (`PANIER_VIDE`) |
| Adresse fournisseur invalide | refusée (`ADRESSE_FOURNISSEUR_INVALIDE`) |
| Réception : stock, lot, statut | stock augmenté du reçu, lot créé, commande `recue` |
| Seconde réception | refusée (`COMMANDE_NON_ENVOYEE`) |
| Cloisonnement | poudre d'un autre atelier refusée, lignes attachées à l'atelier |

16 tests dans `tests/commande-poudre.test.ts`. Recette en production sur ThermoTest : l'alerte
« RAL 9016 Blanc mat — 0 kg pour un seuil à 5 kg » a produit un panier de 10 kg, estimé 127,10 € HT.

**Anomalie corrigée pendant la recette** : le format de quantité du mail rendait « 20. kg »
(point traînant de `to_char`). Une facture ou un bon de commande sorti d'un logiciel ne doit pas
avoir l'air d'une sortie de programme — corrigé en `20 kg` / `12,5 kg` (fonction `quantite_fr`).

### Pourquoi la commande ne part pas dans PrestaShop, et ce qu'il faudrait

La question a été instruite, pas contournée. **La clé `TP_WS_KEY` autorise techniquement la
création d'une commande** : `GET /api/` la déclare en `post` sur `carts`, `customers`, `addresses`
et `orders`. Ce n'est donc pas un blocage d'API. C'est un choix, pour trois raisons :

1. **Le webservice ne calcule rien.** `POST /api/orders` exige qu'on lui fournisse `total_paid`,
   `total_products`, `total_shipping` et le transporteur. Le cart créé par l'API ne renvoie aucun
   total. Il faudrait donc que Thermogestion **fabrique le prix** — sans connaître la remise du
   compte client, sa tranche de port, ni son groupe tarifaire. Un écart silencieux entre le prix
   annoncé à l'atelier et celui facturé par la boutique est exactement le genre d'erreur qui se
   découvre sur une facture, un mois plus tard.
2. **La clé est la clé de travail de la boutique.** Le lot 3 signalait déjà qu'elle devait être
   remplacée par une clé en lecture seule. Lui faire créer des commandes depuis un SaaS multi-
   ateliers va dans la direction opposée.
3. **Une commande posée par API contourne le panier, les CGV et le paiement.** Elle arrive dans le
   back-office comme un impayé à relancer.

**Le repli retenu — le bon de commande par mail — n'est pas un pis-aller** : c'est ainsi que
commandent les ateliers B2B, le fournisseur chiffre lui-même, et le prix qui fait foi reste le sien.
L'estimation affichée dans le panier est explicitement annoncée comme indicative.

**Un point mérite d'être noté**, parce qu'il n'était pas acquis : le lien « panier boutique »
fonctionne. Testé sur thermopoudre.fr, `/fr/panier?add=1&id_product=453&qty=2` ajoute réellement le
produit **sans jeton de session** (le préfixe de langue `/fr/` est obligatoire : sans lui, la
boutique redirige sur l'accueil). En revanche PrestaShop n'accepte **qu'un produit par requête** :
il n'existe pas d'URL qui remplisse un panier de plusieurs lignes, d'où un lien par ligne et non un
bouton sur la commande entière.

**Ce qu'il faudrait pour aller jusqu'à la commande réelle** : un point d'entrée côté
thermopoudre.fr — un petit module ou un script PHP dédié — qui reçoive le bon de commande
(référence + quantité + identifiant atelier), construise un vrai panier **avec la tarification du
compte client**, et renvoie une URL de reprise de panier. Une demi-journée côté boutique, et la
question du prix disparaît puisque c'est PrestaShop qui le calcule.

---

## B1. Onboarding guidé

Une checklist de démarrage sur le tableau de bord, en quatre étapes dans l'ordre où elles se
débloquent : **premier client → grille tarifaire → première poudre → premier devis envoyé**. C'est
l'ordre qui compte : sans grille, l'éditeur de devis ne sait pas chiffrer, ce qui explique le mur
constaté en recette.

Chaque étape se coche sur la **donnée réelle** — un client existe, un palier de grille porte un
prix supérieur à zéro, une poudre active existe, un devis a quitté l'état brouillon. Jamais sur un
« j'ai vu l'écran » : une checklist qui se termine sans que l'atelier soit prêt à travailler ne sert
à rien. Seule l'étape en cours affiche son explication et son bouton, pour ne pas présenter quatre
appels à l'action simultanés.

Elle disparaît d'elle-même une fois les quatre étapes faites — vérifié sur ThermoTest et sur
l'atelier de démonstration, où elle ne s'affiche pas.

**Non vérifié** : le rendu sur un atelier fraîchement créé. Créer un compte réel supposait de faire
un vrai signup avec confirmation par mail ; la logique est en revanche triviale et testée dans le
sens qui compte (elle ne s'affiche pas quand tout est fait).

---

## B2. Compte de démonstration, visitable sans inscription

Depuis la page d'accueil : **« Visiter la démo — sans inscription »**, en haut et en bas de page.
Le visiteur n'obtient pas un « mode démo » de l'interface : il entre dans **le vrai produit**, avec
tous les écrans, sur un atelier réellement présent en base.

### Le verrou est en base, pas dans l'interface

C'est le point sur lequel il ne fallait pas se tromper. Un visiteur de la démonstration reçoit une
session, donc un jeton PostgREST : il peut appeler l'API directement depuis la console de son
navigateur. Un trigger `interdire_ecriture_demo` est posé sur les **34 tables** qui portent des
données d'atelier, plus `ateliers` et `users`, et refuse toute écriture sur une ligne appartenant à
un atelier marqué `demo`.

**Le contrôle porte sur le jeton, pas sur `current_user`** — et ce détail a failli tout emporter.
Une première version s'appuyait sur `current_user`, qui vaut `postgres` à l'intérieur de **toute**
fonction `SECURITY DEFINER` : la signature d'un devis, le pointage d'une étape, un mouvement de
stock seraient tous passés au travers. Corrigé avant déploiement, et le test le vérifie
explicitement sur une RPC autant que sur une table.

Vérifié depuis l'API, avec la vraie session de démonstration :

| Tentative | Résultat |
|---|---|
| Lire clients / devis / projets / poudres | autorisé |
| Lire un autre atelier | rien (RLS) |
| `INSERT` client | `DEMO_LECTURE_SEULE` |
| `UPDATE` de l'atelier | `DEMO_LECTURE_SEULE` |
| `DELETE` devis | `DEMO_LECTURE_SEULE` |
| RPC `next_numero` (SECURITY DEFINER) | `DEMO_LECTURE_SEULE` |
| RPC `mouvement_stock` (SECURITY DEFINER) | `DEMO_LECTURE_SEULE` |
| RPC `panier_poudre` | `DEMO_LECTURE_SEULE` |
| **Signature anonyme du devis de démo par son jeton public** | `DEMO_LECTURE_SEULE` |

9 tests dans `tests/demo-lecture-seule.test.ts`. Le message est le même partout, en français, et
l'interface l'affiche tel quel — vérifié en production : un clic sur « Ajouter » dans le panier de
la démo rend « *Vous visitez la démonstration : elle se consulte, elle ne s'enregistre pas.* ».

### Le jeu de données a été refait

L'atelier « Atelier Démo Thermolaquage » contenait **1 client, 1 devis, 1 projet** : ce n'est pas
une démonstration, c'est un écran vide avec un exemple. Il porte maintenant un atelier crédible :
identité légale complète, grille à 4 paliers et 9 coefficients, 5 prestations, 3 tarifs au ml,
4 pièces types, **4 clients** (menuisier alu sous contrat avec remise et facturation mensuelle,
garage jantes, métallier, particulier), **5 poudres** avec lots — dont une sous le seuil et une DLU
qui approche —, **4 devis** (brouillon, envoyé, deux signés), **4 projets** à des étapes
différentes, **3 factures** (payée, émise, en retard), un BL signé, deux réceptions, deux fournées,
quatre contrôles qualité, trois relevés de bains et une non-conformité.

L'atelier de démonstration a un abonnement `active` : le bandeau d'essai n'a pas de sens pour un
visiteur qui n'a pas de compte, et il est masqué.

---

## B3. Import CSV / Excel

Trois modèles : **clients**, **poudres**, **prestations**. Quatre temps dans cet ordre : choisir ce
qu'on importe, déposer le fichier, vérifier la correspondance des colonnes, regarder ce qui passera
— **avant** que quoi que ce soit ne soit écrit.

**On ne demande pas à l'atelier de renommer ses colonnes.** « Raison sociale », « Société »,
« Courriel », « Tél. », « Commune » sont reconnus automatiquement ; il corrige à la main ce qui
manque. Chaque ligne refusée l'est **avec son motif en français et son numéro de ligne tel qu'il
apparaît dans son tableur** (en-tête comprise) : « Ligne 14 — Garage Piston : Email : « adresse-x »
n'est pas une adresse valide ». Le rapport de rejets est téléchargeable en CSV.

Les doublons sont écartés deux fois : ceux déjà présents dans l'atelier, et ceux internes au
fichier. Un import relancé après correction ne crée donc pas de deuxième « Menuiserie Martin ».

**Détail technique assumé** : le `.xlsx` est lu **sans bibliothèque tierce**. Un `.xlsx` est une
archive ZIP de XML, et le navigateur sait décompresser (`DecompressionStream`). Les paquets de
lecture XLSX les plus répandus traînent des alertes de sécurité et pèsent quelques centaines de
kilo-octets, pour un écran utilisé une fois dans la vie d'un atelier.

Vérifié sur un **vrai classeur** produit par un tableur (`tests/fixtures/clients.xlsx`), y compris
le cas qui casse les lecteurs naïfs : une cellule vide au milieu d'une ligne, qui décale toutes les
colonnes suivantes si l'on ne repositionne pas chaque cellule par sa référence (`D3` absente).
24 tests dans `tests/import-tableur.test.ts`.

**Hors périmètre, et l'écran le dit** : les formules (on lit la valeur calculée, qu'Excel stocke à
côté), les dates (aucune colonne importée n'en contient) et les feuilles multiples — c'est la
première feuille qui est lue. L'ancien format binaire `.xls` est refusé avec la marche à suivre.

---

## B4. Demande d'avis Google, J+2

**Deux jours après la signature du bon de livraison**, et non à la signature : le client vient de
récupérer ses pièces, il ne les a pas encore reposées chez lui. Le lien de la fiche Google se règle
dans **Réglages → Atelier → Avis clients**. Sans ce lien, rien ne part.

Le mécanisme réutilise entièrement l'existant : un trigger sur `bons_livraison` pose une ligne dans
`notifications` avec `scheduled_at = now() + 2 jours`, et le cron `tg-process-notifications` s'en
occupe.

Deux garde-fous :

- **un même client n'est sollicité qu'une fois par trimestre** — un menuisier qui fait laquer dix
  lots ne reçoit pas dix demandes d'avis ;
- **l'adresse de la fiche est relue au moment de l'envoi**. Entre la livraison et J+2 l'atelier a
  pu la corriger, ou la retirer : dans ce cas la notification passe en `annulee` avec le motif,
  au lieu d'envoyer un lien mort. Le statut `annulee` a été ajouté à la contrainte de la table.

Le message propose l'avis, et — c'est volontaire — **offre une porte de sortie** : « si quelque
chose n'allait pas, répondez plutôt à ce message ». Envoyer un client mécontent directement sur
Google est le meilleur moyen de collecter une mauvaise note qu'on aurait pu traiter.

Vérifié en base : signature d'un BL → **une** notification programmée à **+48 h** ; seconde
signature du même client → aucune notification supplémentaire ; fiche Google retirée →
notification `annulee` avec le motif, aucun envoi. Les lignes de test ont été supprimées et le jeu
de démonstration remis en état.

**Non vérifié** : la réception réelle du mail dans une boîte. Le corps est construit par la même
fonction que les six autres modèles, qui, eux, sont en production depuis juillet.

---

## B5. Français / italien sur les pages que voit le client

Traduits : **devis, facture, bon de livraison, bon de réception, suivi de projet** — les cinq pages
publiques. Bascule FR/IT en haut de page, choix mémorisé, et `?lang=it` dans l'URL qui prime, pour
que l'atelier puisse envoyer directement le bon lien à un client italien. À défaut, la langue du
navigateur.

Ce qui est traduit va au-delà des étiquettes : les **formats** suivent la locale (`it-IT` pour les
montants et les dates), les unités aussi (« pièces » → « pz »), et l'invite du pavé de signature —
une invite en français au milieu d'un devis traduit est exactement ce qui fait douter un client au
moment de signer.

**Ce qui reste volontairement en français** : les mentions légales de la facture (art. 293 B du
CGI, L441-10 du code de commerce, pénalités, escompte, assurance). Ce sont des **citations de
textes français** ; une traduction libre leur ferait perdre leur valeur. C'est un choix, pas un
oubli.

Vérifié en production sur le devis `DV-2026-0014` : bascule IT → « Preventivo », « Totale
imponibile », « IVA », « Totale IVA inclusa », « Accettazione del preventivo », « Firma »,
« Accettare e firmare il preventivo », « Realizzato con Thermogestion ».

**Ce qui reste à faire** : les **écrans de l'atelier** restent en français, ainsi que les
**PDF serveur** et les **mails** — un atelier italien travaillerait donc en français tout en
envoyant des documents en ligne traduits. Le périmètre choisi est celui qui a un effet commercial
immédiat ; l'infrastructure (`src/lib/i18n.ts`, dictionnaires typés) est en place pour la suite,
mais l'extraction des chaînes des ~40 écrans de l'atelier est un chantier à part entière.

---

## Domaine propre — préparé, **pas acheté**

Rien n'a été acheté : c'est une décision et un paiement qui appartiennent à Alexis. Ce qui a été
fait côté code, pour que la bascule soit une manipulation et non une migration :

- **plus une seule URL en dur dans l'application.** Les trois pieds de page publics
  (`/d/`, `/bl/`, `/rc/`) pointaient sur `thermogestion-v2.vercel.app` en clair ; ils lisent
  désormais `SITE_URL` ;
- **plus une seule URL en dur dans les mails.** `process_notifications` écrivait l'adresse dans son
  corps. Elle lit maintenant `public.reglages_app` (clé `base_url`) via `url_de_base()` : changer
  de domaine est un `UPDATE`, pas une migration de fonction.

### Ce qu'Alexis aura à faire, dans cet ordre

1. **Acheter le domaine** (thermogestion.fr, ~12 €/an chez OVH ou Vercel).
2. **Vercel → Settings → Domains** : ajouter `thermogestion.fr` et `www.thermogestion.fr`, suivre
   les enregistrements DNS proposés.
3. **Vercel → Settings → Environment Variables** : `NEXT_PUBLIC_SITE_URL = https://thermogestion.fr`,
   puis **redéployer** (la variable est lue à la construction).
4. **Supabase → Authentication → URL Configuration** : « Site URL » à `https://thermogestion.fr`,
   et ajouter `https://thermogestion.fr/**` dans les « Redirect URLs ». Sans ça, la réinitialisation
   de mot de passe renvoie sur l'ancienne adresse.
5. **Base** : `update public.reglages_app set valeur = 'https://thermogestion.fr' where cle = 'base_url';`
6. **Le jour de l'activation du paiement** : mettre à jour l'URL de retour Stripe Connect.

Les liens déjà envoyés (devis, factures, suivis) continueront de fonctionner tant que le domaine
Vercel reste actif — il n'y a donc pas d'urgence à basculer, ni de risque à le faire.

---

## Tests

`npm test` : **174 tests, 18 fichiers, tous verts** (~28 s). Quatre fichiers ajoutés :

| Fichier | Tests | Ce qu'il verrouille |
|---|---|---|
| `pdf-polices.test.ts` | 4 | aucune police standard, programme embarqué par graisse |
| `commande-poudre.test.ts` | 16 | panier unique, numérotation, envoi, réception, cloisonnement |
| `demo-lecture-seule.test.ts` | 9 | démonstration lisible, écriture refusée y compris par RPC |
| `import-tableur.test.ts` | 24 | CSV, XLSX réel, reconnaissance de colonnes, motifs de rejet |

`npx tsc --noEmit` : aucune erreur. `npx next build` : compilé sans erreur, 48 pages.

Un réglage de la suite a été corrigé au passage : `esbuild.jsx = "automatic"` dans
`vitest.config.ts`. Sans lui, un test qui rend un document PDF échouait sur « React is not
defined » — c'est-à-dire sur la configuration, pas sur ce qu'il cherchait à prouver.

---

## Anomalies trouvées et corrigées pendant ce lot

| # | Anomalie | Criticité | Correction |
|---|---|---|---|
| 1 | **Le verrou de la démonstration s'appuyait sur `current_user`**, qui vaut `postgres` dans toute fonction `SECURITY DEFINER` : signature de devis, pointage d'étape et mouvements de stock l'auraient contourné. | **Élevée** | Contrôle porté sur le jeton (`request.jwt.claims`). Testé sur une RPC et sur la signature anonyme par jeton public. |
| 2 | Quantités du bon de commande rendues « 20. kg » | Faible | `quantite_fr()` : « 20 kg », « 12,5 kg ». |
| 3 | L'invite du pavé de signature restait en français sur un devis affiché en italien | Faible | Invite et bouton « Effacer » paramétrés par la langue. |
| 4 | `trg_exiger_abonnement()` restait appelable par `anon` via `/rest/v1/rpc` | Faible | Droits révoqués — une fonction de trigger n'a rien à faire dans l'API. |

---

## Ce qui reste ouvert

1. **Clé de webservice PrestaShop partagée.** Toujours vrai depuis le lot 3, et toujours la seule
   vraie question de sécurité de la boucle Thermopoudre : créer dans PrestaShop une clé dédiée en
   **lecture seule** (ressources `products`, `categories`, `search`) et la substituer dans Vercel.
   Cinq minutes, et ça ferme le sujet.
2. **Commande réelle dans PrestaShop** : possible seulement avec un point d'entrée côté boutique
   qui calcule le prix (cf. A2).
3. **i18n des écrans de l'atelier, des PDF et des mails** — non fait, périmètre assumé (cf. B5).
4. **Profil Factur-X BASIC WL** pour l'émission 2027, si un client réclame la ventilation de TVA.
5. **Vue `projet_revient` en `SECURITY DEFINER`** — signalée en ERROR par l'analyseur Supabase,
   antérieure à ce lot, non traitée ici. À reprendre : une vue `SECURITY DEFINER` applique les
   droits de son créateur, pas ceux de l'appelant.
6. **Le mot de passe du compte de démonstration** est dans la variable Vercel `DEMO_PASSWORD` et
   dans `.env.test` (non versionné). Il ne protège rien — le bouton est public — mais il n'a pas sa
   place dans le dépôt.

---

## Avis

Le lot 4 fait ce qu'on lui demandait : un atelier inconnu peut aujourd'hui **voir** le produit sans
créer de compte, **s'y installer** sans buter sur un tableau de bord vide, et **y amener ses
données**. Ce sont les trois marches qui manquaient entre « le logiciel marche » et « on peut le
mettre entre les mains de quelqu'un ».

Deux points que je veux nommer sans les habiller.

**Le premier est le bug le plus grave que j'aie écrit ce jour-là**, et il n'est pas dans une page
client cette fois : le verrou de la démonstration reposait sur `current_user`. Il aurait laissé
n'importe quel visiteur signer un devis, pointer une étape et bouger du stock dans la démo — pas
une catastrophe commerciale, mais exactement le genre de trou qu'on ne voit pas parce que
l'interface, elle, a l'air verrouillée. Il a été trouvé en écrivant le test qui essayait de passer
par une RPC. C'est la troisième fois sur ce projet qu'un contrôle « qui a l'air correct » ne
protège rien : la migration de juillet qui révoquait à `anon` mais pas à `PUBLIC`, la remise
invisible sur le devis client, et celui-ci. La leçon est toujours la même — **un garde-fou qui n'a
pas été attaqué par un test n'est pas un garde-fou**.

**Le second concerne la commande Thermopoudre.** J'ai vérifié que l'API le permettait avant de
choisir de ne pas le faire, et je maintiens ce choix : faire calculer par Thermogestion un prix
dont la boutique est seule à connaître les règles, c'est programmer un écart de facturation. Le
bon de commande par mail est utilisable dès aujourd'hui ; la commande réelle mérite une demi-
journée côté boutique plutôt qu'un contournement côté SaaS.

**Sur la question du pilote.** Oui, le produit peut être confié à un atelier pilote — à trois
conditions. Que ce soit **un atelier accompagné** et non un inscrit anonyme : la reprise de données
et la grille tarifaire méritent une heure au téléphone. Que l'atelier soit prévenu que **les
documents partent en français** hors des cinq pages publiques. Et que le **paiement reste coupé**,
comme prévu, parce qu'un pilote qui bute sur une fin d'essai à trente jours ne dira jamais pourquoi
il est parti.

Ce qui manque pour vendre à un atelier **non accompagné**, ce n'est plus l'onboarding — c'est le
lot 2 : cahier de contrôles Qualicoat, planification des fournées, prix de revient réel. C'est là
que se trouve la raison de payer 129 € plutôt que 59 €, et c'est le seul endroit où Thermogestion
ne ressemble à aucun autre logiciel.
