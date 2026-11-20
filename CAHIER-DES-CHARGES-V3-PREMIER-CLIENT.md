# Cahier des charges v3 — l'outil pour le premier client

*3 septembre 2026. Consolidation de cinq audits menés le même jour : design system, recette bouton
par bouton (66 écrans, 75 boutons, 14 formulaires), SEO et visibilité IA, analyse « premier client
réel » du jour 1 au mois 1, et conception d'un assistant IA. Tout constat cité est vérifié sur pièce.
Ce document remplace `PLAN-COMPLET-20-08-2026.md` comme feuille de route.*

---

## 0. L'objectif, en une phrase

Installer Thermogestion chez **un atelier de thermolaquage réel**, client de Thermopoudre, et qu'il
s'en serve encore au bout de trois semaines. Pas impressionné : satisfait.

Ce qui fait abandonner un logiciel d'atelier tient en trois choses, et les cinq audits les ont
toutes trouvées dans le produit tel qu'il est : **la double saisie** (sept endroits où l'atelier doit
sortir du logiciel pour finir une tâche), **le chiffre introuvable** (aucun écran ne dit combien on a
facturé ce mois, ni combien on nous doit), et **la porte d'entrée fermée** (la numérotation repart à
0001, les factures antérieures ne s'importent pas — le tableau de bord ment le premier jour).

Le socle, lui, est solide et n'a pas besoin d'être touché : Factur-X EN 16931 vérifié champ par
champ, FEC, rôles en RLS, corbeille, journal, portail client, recherche, pagination, 1 056 tests.
**Ce qui manque n'est pas de la profondeur — c'est l'entrée et la sortie.**

---

## 1. Lot A — La porte d'entrée : reprendre l'existant *(≈ 5,5 jours)*

Sans ce lot, l'installation crée un problème comptable à la première facture.

| # | Chantier | Le constat | Effort |
|---|---|---|---|
| A1 | **Reprise de la numérotation** | `_next_numero()` démarre toujours à 1, par année civile. `settings->'numerotation'` n'est écrit par aucun écran (`grep` : 0). `compteurs` n'a aucune politique. Un atelier à FA-2026-0347 émettra FA-2026-0001 : deux séries pour le même exercice, FEC refusé par le comptable. Onglet Réglages → Numérotation (préfixe + prochain numéro par type), RPC réservée au propriétaire, verrouillée dès le premier document émis. | 1 j |
| A2 | **Import de l'encours** | `MODELES` = clients, poudres, prestations. Rien d'autre. 23 factures impayées non reprises = tableau de bord à zéro et moteur de relance muet le jour 1. Un 4ᵉ modèle « factures en cours » avec numéro, date, montant, reste dû — ouvert tant qu'aucune facture n'a été émise dans l'application. | 2 j |
| A3 | **Import des lots de poudre** | Le modèle poudres pose `stock_kg` sans lot, sans DLU, sans fournisseur. Traçabilité, alerte DLU et FIFO démarrent vides. Modèle branché sur `receptionner_lot`. | 0,5 j |
| A4 | **Import des tarifs négociés et des paliers** | Aucun modèle pour `client_tarifs` ni `grille_paliers`. Le tutoriel « Reprendre vos données » (`aide.ts:341`) promet pourtant l'import des tarifs négociés — **il décrit une fonction qui n'existe pas**. | 1,5 j |
| A5 | **Seconde grille tarifaire** | Coquille C-4, ouverte depuis le lot 5 : `createGrille` force `is_default`, le bandeau « Grille dédiée appliquée » est du code mort. | 0,5 j |

Deux étapes à ajouter à la checklist de démarrage : « reprenez votre numérotation », « entrez vos
impayés ». Et une contrainte à annoncer avant le jour J, pas à découvrir : chaque opérateur a besoin
d'une adresse e-mail. Le mode « poste partagé avec sélection de l'opérateur » n'existe pas.

---

## 2. Lot B — La porte de sortie : envoyer, imprimer, lire le chiffre *(≈ 5 jours)*

| # | Chantier | Le constat | Effort |
|---|---|---|---|
| B1 | **Envoyer devis, facture et BL depuis l'application** | Les trois boutons sont des `mailto:` (`devis/[id]:262`, `factures/[id]:242`, `bl/fiche/[id]:101`). Pas de PDF joint, pas de trace, et le devis est marqué « envoyé » avant qu'aucun message ne parte. **La tuyauterie existe** (`notifications`, `process_notifications`, 8 modèles) : il manque deux modèles et une RPC. | 1 j |
| B2 | **Expéditeur = l'atelier** | `process_notifications` poste vers `thermopoudre.fr/tg-mailer.php` sans `from` ni `replyTo` (vérifié : 0 occurrence). Le client d'un atelier reçoit sa relance depuis le fournisseur de poudre de son laqueur, et sa réponse part au mauvais endroit. **Irrattrapable si on le découvre après.** | 0,5 j |
| B3 | **Le PDF en pièce jointe** | Le relais ne prend que du HTML. Le comptable du client demande « envoyez-moi le PDF » : trois sorties du logiciel. | 1 j |
| B4 | **Le chiffre du vendredi soir** | Type `Stats` du tableau de bord : aucun champ de chiffre d'affaires. `/factures` : aucun total. `/pilotage` : aucune série. Le patron rouvre son Excel, et l'Excel redevient la source de vérité. Une bande de quatre chiffres : facturé du mois, encaissé du mois, reste dû, m² produits. **La modification la moins chère et la plus décisive de ce document.** | 0,5 j |
| B5 | **Fiche suiveuse A5 avec QR** | `projets/[id]:204` dit « Imprimez ce QR sur la fiche suiveuse » — la route n'existe pas (tâche #4). Sans papier sur la pièce, personne ne scanne ; sans scan, pas de pointage ; sans pointage, le prix de revient reste théorique et **tout l'argument s'effondre**. | 1 j |
| B6 | **Bon de prise en charge hors jantes** | Le module jantes a le sien ; le thermolaquage, non. Le gabarit `pdf/jantes.tsx` se réutilise. | 0,5 j |
| B7 | **Dupliquer depuis la liste** | `dupliquer_devis` existe, mais uniquement depuis la fiche. Pour le menuisier qui refait le même portail chaque semaine : sept gestes. | 0,5 j |

---

## 3. Lot C — Le métier au quotidien *(≈ 8 jours)*

Par ordre de fréquence dans le premier mois d'un atelier de 3 à 8 personnes.

| # | Chantier | Le constat | Effort |
|---|---|---|---|
| C1 | **Acompte à la commande sur le devis** | « 30 % à la commande » : pas de champ, pas de calcul (`grep acompte DevisEditor` : 0). La facture d'acompte se crée après signature, montant tapé à la main. | 1 j |
| C2 | **Un taux horaire par personne** | `ateliers_couts.taux_horaire` : une ligne par atelier ; `users` : aucune colonne de coût. Dès qu'un apprenti et un chef pointent sur le même dossier, la marge est fausse — silencieusement. C'est le chiffre qui sert d'argument de vente. | 0,5 j |
| C3 | **Balance âgée + relevé de compte + lettre de relance papier** | Aucune tranche 0-30/30-60/90+, aucun total sur `/factures`, aucune route `api/pdf/releve`. Un impayé à 90 jours se relance par courrier. | 1 j |
| C4 | **Hors-ligne minimal sur `/scan` et `/pointage`** | `sw.js` : 26 lignes, précache vide, ni `/scan` ni `/pointage` dans le shell, aucune file d'écriture. Cabine de sablage, une barre de 4G : le temps n'est pas pointé. | 2 j |
| C5 | **Devis à options et prix par quantité** | « Avec ou sans sablage » = deux devis, deux numéros. 50 pièces au même prix unitaire que 3. Paliers au m² et au pouce seulement. | 2,5 j |
| C6 | **Mentions B2C** | `clients.type` existe et n'a d'effet que sur le SIREN Factur-X. Ni médiateur de la consommation, ni rétractation d'un devis signé hors établissement sur les documents d'un particulier. *(Décision juridique d'abord.)* | 0,5 j |
| C7 | **Non-qualité cohérente** | `client_rentabilite` intègre les retouches, `projet_revient` les ignore : deux écrans, deux chiffres pour le même chantier. Une NC sur fournée seule n'entre dans aucune rentabilité. | 0,5 j |

Et deux choses **à écrire à l'écran** plutôt qu'à coder maintenant : « ce prix de revient ne comprend
ni les consommables ni les achats », et « un client qui ne vient pas chercher reste dans À faire ».
Un chiffre honnête sur son périmètre vaut mieux qu'un chiffre complet qu'on n'a pas.

---

## 4. Lot D — Ce que la recette a trouvé en cliquant *(≈ 4 jours)*

66 écrans, 75 boutons, 14 formulaires, 12 valeurs limites. Aucune erreur JavaScript hors une
(`#418`, hydratation, `/dashboard` ↔ `/reglages`). Le refus de démonstration est correct presque
partout. Voici ce qui ne l'est pas.

### Bloquant — le client ne pourra pas travailler

| # | Constat | Correctif |
|---|---|---|
| D1 | **Remise > 100 % : le récapitulatif ne s'additionne plus.** Remise 100 % sur 64,40 € → « Remise −19,40 € · Forfait minimum +45,00 € · Total HT 45,00 € ». 64,40 − 19,40 + 45 ≠ 45. Et **remise négative acceptée** : −30 % fait passer le total à 83,72 € **sans qu'aucune ligne ne l'explique**. | Borner 0-100 en base (contrainte) et à l'écran ; ligne « Majoration » ou refus du négatif. |
| D2 | **Le message d'échec de signature ment au client.** Tout échec — réseau, RLS, démo — affiche « Le devis a peut-être déjà été traité ». Le client de votre client abandonne. | Distinguer « déjà signé / expiré » de « échec technique, réessayez ». |
| D3 | **« Paiement non configuré sur le serveur. »** sur `/abonnement`, après 4 s sans indicateur. Jargon d'administrateur lu par un prospect. | Message métier + `Button.loading`. *(Et Stripe — §8.)* |

### Gênant — il râlera

| # | Constat | Correctif |
|---|---|---|
| D4 | **« Envoyer au client » ne fait rien sur ordinateur** (`navigator.share` absent sous Windows/Firefox) — sur six fiches. | Repli explicite : copier le lien + `mailto:`. *(Disparaît avec B1.)* |
| D5 | **Bornes inertes** : `min`/`max` posés sur des `input type="text"`. Remise client 500 %, délai 999 jours (« la loi plafonne à 60 » écrit juste dessous), réception de 0 pièce, jante de 0 pouce et −5 J chiffrée à 345 € HT, surface −5 m² → « −0,00 € », fournée à 142 % lançable, encaissement supérieur au dû accepté. **Le comportement serveur est inconnu** (démo en lecture seule). | Contraintes en base sur chaque borne, et `ChampDecimal` partout. |
| D6 | **Formats anglo-saxons** : `6.8 / 25.0 kg` (`/lots`), `1.68 m²`, `pH 6.8`, `374.4` pré-rempli, coefficients `1.15`, « 2490 € », et **« 10.5 % » dans les mentions légales des documents publics**. | `nombreFr()` sur les 4 `toFixed()` recensés + relecture des pages publiques. |
| D7 | **Identifiants techniques affichés** : « rincage », « degraissage », « epaisseur », « satine », « texture », dates ISO sur `/qualite/controles`, `?? devis.status` en repli. | Dictionnaires de libellés, comme pour les statuts de la palette. |
| D8 | **Refus déguisé en succès** : l'import catalogue sur `/stock` affiche le refus de démo dans l'infobulle sombre avec ✓. | Passer par `ecrire()`. |
| D9 | **Chevron mort** sur les cartes de jante (seule la moitié gauche déplie). « Générer » du certificat est un `<span>`. | `<button>` sur toute la carte ; vrai bouton désactivé. |
| D10 | **Liens qui ne tiennent pas leur promesse** : « Voir les BL à facturer » → liste vide (filtre « À livrer » par défaut) ; « Ouvrir ma grille » → onglet Atelier. **Onglets et filtres absents de l'URL** : Précédent quitte la page, rien ne se partage. | Filtre par défaut « Tous » ; état dans l'URL. |
| D11 | **Retard invisible** : facture échue de 45 jours en gris comme les autres ; portail client « Prévu le 14/08 » en gris le 3 septembre. Le kanban, lui, passe au rouge. | Même traitement partout. |
| D12 | **Compteurs incohérents** : 3 projets en retard (tableau de bord) contre 2 (`/pilotage`) ; « 2 en cours » sur le portail, 1 dans l'onglet. | Une seule définition, une seule vue. |
| D13 | **Titre d'onglet identique** sur presque tous les écrans internes. Deux « Fermer » côte à côte sur `/factures`. Quatre formats d'heure. `/non-conformites` en 8 s, catalogue Thermopoudre en 7 s avec un bouton « … ». | `metadata` par page ; libellés ; `dateHeureFr()` unique ; requêtes à revoir. |

Douze détails supplémentaires (émojis, « Email », prime typographique, « 1 juillet », « de Atelier ») sont dans le rapport de recette et se traitent avec le lot E.

**Non vérifié et à faire sur un vrai téléphone** : la barre du bas, `/scan`, le pointage, la
signature au doigt, les cartes de jantes en 390 px. Aucun outil n'a pu redimensionner la fenêtre.
C'est le trou le plus important des deux recettes, et c'est l'écran de l'opérateur.

---

## 5. Lot E — Design system *(≈ 5 jours)*

Note : 64/100 (52 le 19/08). Le socle a progressé, **mais les quatorze chantiers récents ne l'ont pas
utilisé** : `Badge` porte des jetons et 88 % des appels les contournent ; `Button.loading` existe et
`ConfirmModal` lui-même affiche « … » ; 491 couleurs en dur (429 avant), deux échelles de gris.

**Avant installation — les cinq P0, trois jours :**

| # | Chantier | Effort |
|---|---|---|
| E1 | Socle à **44 px** (`ui.tsx:23` `py-2.5` → `py-3`) : une trentaine des 45 cibles trop petites viennent de cette ligne. `whitespace-nowrap` sur `Badge` (se coupe en deux sur `/jantes`). | 1 h |
| E2 | **Les 9 tables de statut → jetons** (`utils.ts`, `types.ts`, `jantes.ts`, `portail.ts`, `qualite.ts`, `capacite.ts`, `certificat.ts`). Corrige du même geste le contraste **3,90:1 sur le portail client** (« Restitué », « Livré et facturé ») et fait tomber ~200 couleurs en dur. | 4 h |
| E3 | **`Button.loading` sur `ConfirmModal`** (11 écrans) et sur **21 écritures muettes** — dont `JanteCarte` où un second appui sur 4G **annule le premier**. | 3 h |
| E4 | **Échap, focus initial, piège de focus** sur les 4 modales (aucune ne les a). Supprimer le `confirm()` natif de `DevisEditor:350`. | 2 h |
| E5 | **Style PDF partagé** (6 `StyleSheet` sans rien de commun, 4 pieds de page différents) + **`atelier.couleur` sur le certificat** (`pdf/qualite.tsx` code `#147085` en dur : un atelier personnalisé envoie un certificat aux couleurs de l'éditeur). | 1 j |

**Juste après — P1, deux jours :** `AstuceEcran` repliable (occupe 60-70 % du premier écran mobile
sur 12 écrans — l'atelier ne voit pas son atelier), `/projets` dans le motif de liste (seul écran
sans pagination ni gestion d'erreur : **une panne réseau s'affiche comme un atelier vide**), kanban
mobile, 14 émojis → icônes, 4 `toFixed()`, `focus-visible` sur 67 boutons natifs.

---

## 6. Lot F — L'assistant IA *(≈ 5 jours + décisions)*

**Le prototype existe et compile** : `src/lib/assistant/` (7 fichiers), `src/app/api/assistant/route.ts`,
`src/components/Assistant.tsx` non branché, 27 tests sans modèle ni base. Trois outils : devis sans
réponse, factures échues, chiffre d'affaires par période.

**Les principes, non négociables :** la route utilise la **session de l'utilisateur, jamais la clé de
service** — la RLS fait le cloisonnement ; le modèle n'écrit jamais et ne génère jamais de SQL, il
appelle un catalogue fermé d'outils adossés aux vues et RPC des écrans ; chaque chiffre vient avec
sa fiche cliquable ; les actions sont des liens vers les écrans existants ; journal des questions
avec plafond quotidien ; le prompt système est identique pour tous les ateliers.

| # | Reste à faire | Effort |
|---|---|---|
| F1 | Les 9 outils restants — le plus rentable d'abord : `journee_du_matin` sur `mon_recap_quotidien()` (existe, filtre déjà par rôle), puis signés non produits, prêts non livrés, dates promises, clients dormants, rentabilité client/projet (**avec test explicite de la formule**, sinon un atelier à 79 € s'entend dire qu'il n'a pas de marge), stock sous seuil, `recherche_fiche`. | 2 j |
| F2 | Table `assistant_journal` (DDL prête) + quota — **sans elle, le plafond n'existe pas**. | 0,5 j |
| F3 | Montage : panneau replié en tête de `/pilotage`, et bascule depuis ⌘K quand la recherche ne rend rien. Pas d'entrée de menu « chatbot ». | 1 j |
| F4 | Streaming (SSE) avant ouverture large ; cache de prompt. | 1 j |
| F5 | L'outil CA rend aussi le reste dû de la période — pour que « vous avez fait 47 000 € » ne puisse pas se dire sans « dont 12 000 pas rentrés ». **C'est le risque n°1 d'un modèle face à un artisan.** | 0,5 j |

**Coût** : ≈ 0,0075 € la question (Haiku par défaut, Sonnet sur les questions d'analyse), soit
**≈ 1,60 € HT par atelier et par mois** à 10 questions par jour ouvré ; plafond dur 15 €.
**Formule** : dans les trois, avec quota (10 / 30 / 60 par jour) — l'assistant n'est ni un nombre de
personnes ni un niveau de preuve, et la montée en gamme se fait toute seule puisque les vues de
rentabilité portent déjà leur verrou de formule.

**Bloquant avant mise en service, et ce n'est pas du code** : DPA Anthropic signé, sous-traitant ajouté
à la politique de confidentialité et au registre, mention dans les CGU. Des noms de clients et des
montants sortent du périmètre Supabase.

---

## 7. Lot G — Être trouvé *(≈ 4 jours + contenu)*

Le socle technique est propre (robots, sitemap, JSON-LD avec FAQ vérifiée mot à mot, `llms.txt`
exemplaire, trois pages de destination rendues côté serveur). **Mais le site n'est pas indexé** :
zéro résultat sur son propre nom, aucune balise Search Console, et sur « logiciel gestion atelier
thermolaquage », **sept résultats sur sept sont COOCKPIT** — que le moteur de réponse présente comme
« le seul logiciel entièrement dédié au thermolaquage ».

**Gains rapides, une demi-journée cumulée :** `thermogestion.fr` **est libre** (RDAP AFNIC vérifié,
`.it` aussi) ; Search Console à ouvrir **aujourd'hui sur le `.vercel.app`** (la migration se fait
ensuite par l'outil de changement d'adresse) ; `/` toujours dynamique (`page.tsx:140`, TTFB 480 ms
contre 170 sur ses pages filles, composant de remplacement livré le 19/08 et jamais branché) ; titres
dupliqués sur `/`, `/signup`, `/login` ; H1 de l'accueil sans mot-clé ; `lastmod` remis à « maintenant »
à chaque build ; JSON-LD sans `logo` ni réseaux sociaux ; `/demo` interdit dans `robots.txt` et
recommandé dans `llms.txt` ; **aucun lien depuis `thermopoudre.fr`** (0 occurrence).

**Investissements :** publier le centre d'aide (47 blocs de contenu métier de première main,
enfermés derrière `307 → /login`) ; cinq guides sur des requêtes vérifiées sans concurrent éditorial
(prix au m² côté atelier, barème jantes au pouce, registre Qualicoat, facturation électronique pour
un sous-traitant, DLU et rendement) ; **des images — il n'y en a aucune sur tout le site** ; une page
« Qui sommes-nous » (l'éditeur est un distributeur de poudre : le seul signal que COOCKPIT ne peut pas
copier, et il n'existe que dans `llms.txt`) ; YouTube et annuaires SaaS.

---

## 8. Ce qui vous appartient

| Décision | Pourquoi maintenant |
|---|---|
| **Choisir l'atelier pilote et la date** | Tout le calendrier en découle. Il faut ses fichiers une semaine avant : clients, tarifs négociés, factures ouvertes, stock avec lots, dernier numéro de facture. |
| **Stripe** — 8 tarifs + 3 variables | Le paywall est armé, l'essai de ThermoTest expire le 12/09. Le pilote n'a pas besoin de payer tout de suite, mais l'écran « Paiement non configuré » ne doit pas exister le jour où il regarde. |
| **`thermogestion.fr`** | 12 €, libre. Chaque devis part aujourd'hui avec `thermogestion-v2.vercel.app/d/…` — le `-v2` fait « projet en cours » sur un document commercial. |
| **Mandat plateforme agréée** | La réception est obligatoire depuis le 1er septembre. Le pilote posera la question. |
| **DPA Anthropic + clé API** | Préalable à l'assistant IA. Je ne saisis aucune clé. |
| **Relecture juridique** | CGU réécrites le 21/08 avec deux engagements retirés ; mentions B2C à trancher (C6). |
| **Un référent joignable et un rendez-vous à J+21** | C'est à trois semaines que l'abandon se décide, pas à sept jours. |

---

## 9. L'ordre que je propose

**Semaine 1 — ce qui rend l'installation possible** *(≈ 10 j, ne se découpe pas)* : Lot A entier,
B1-B2-B4-B5, D1-D2-D3, E1-E2-E3-E4. À la fin : un atelier peut reprendre son historique, envoyer un
devis depuis l'application sous son propre nom, lire son chiffre du mois, et aucun bouton ne ment.

**Semaine 2 — ce qui le fait rester** *(≈ 8 j)* : B3-B6-B7, C1-C2-C3-C4, D4 à D13, E5.

**Semaine 3 — ce qui le distingue** *(≈ 8 j)* : Lot F (l'assistant, si le DPA est signé), C5-C6-C7,
lot E-P1, gains rapides SEO.

**En continu, sans moi** : le contenu (guides, images, YouTube), le domaine, Stripe, le mandat PA.

**Puis le pilote.** Une matinée de reprise assistée, deux heures de prise en main sur les six
tutoriels existants, un référent, un rendez-vous à J+21.

---

## 10. Ce qu'on ne fait pas maintenant

Achats et fournisseurs, clôture d'exercice, état de TVA, litige et pénalités, fermeture annuelle,
transport, sous-traitance sortante, mode kiosque, remise en banque, RGPD (anonymisation), multi-devise,
italien de la vitrine. Réels, documentés, et **aucun n'arrive dans les trente premiers jours d'un
atelier de trois à huit personnes**. On les reprendra avec ce que le pilote nous aura appris.

**Total avant le pilote : environ 26 jours de développement, en trois semaines.** Les cinq rapports
d'audit détaillés sont conservés dans les comptes rendus d'agents ; ce document est leur arbitrage.
