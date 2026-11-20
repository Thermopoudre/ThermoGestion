# Thermogestion — Positionnement de la vitrine

*19 août 2026, mis à jour le soir même après le lot 10. Ce document dit **la stratégie retenue**,
**ce qui a été écrit et mis en ligne**, et **ce qui reste à trancher**.*

> **Mise à jour du lot 10 — le tarif est tranché.** La décision n°2 du §5 est prise : trois
> formules à **79 / 129 / 249 € HT par mois** (790 / 1 290 / 2 490 € à l'année, deux mois offerts).
> Le principe de segmentation retenu par Alexis, et appliqué partout : **ce qui fait payer plus
> n'est jamais le métier, c'est le nombre de personnes et le niveau de preuve exigé par les
> clients**. Le module jantes est donc entier dans la formule d'entrée. Les droits sont désormais
> **appliqués en base et pas seulement à l'écran** — détail complet dans `RECETTE-LOT10.md`.

* Le comparatif concurrentiel qui le fonde est dans
`VEILLE-CONCURRENCE.md`. La source de vérité fonctionnelle est `AUDIT-FONCTIONNEL.md` : chaque
phrase publiée a été vérifiée contre lui, et plusieurs promesses existantes ont été retirées.*

---

# 1. La décision

**Le produit s'adresse aux deux cibles à la fois.** Ce n'est pas un arbitrage :

- **La rénovation de jantes** est le coin qui ouvre la porte. Marché vide en France (un seul
  concurrent au monde, allemand, absent du marché français), avantage adossé à un actif
  inimitable — Thermopoudre est le seul distributeur français de toutes les teintes d'origine
  constructeur — et module livré, testé, démontrable.
- **L'industrie et la sous-traitance** sont le volume. Le gisement de clients convertibles y est
  bien plus large, et le seul concurrent sérieux (COOCKPIT, 4 990 € de mise en route + 980 €/mois
  + 36 mois d'engagement) laisse tout le segment des ateliers de 1 à 15 personnes libre.

**La règle d'architecture qui en découle : l'accueil distribue, les pages de métier convertissent.**
Une page d'accueil qui ne nomme qu'un des deux métiers perd l'autre. Une page d'accueil qui les
mélange n'en convainc aucun, parce que ce sont deux vocabulaires, deux douleurs et deux façons de
chiffrer. D'où une page d'accueil qui nomme les deux et oriente en trois secondes, puis deux pages
dédiées qui portent chacune tout le poids de son métier.

## Ce qu'on n'attaque pas

**« logiciel thermolaquage » n'est pas attaqué de front.** COOCKPIT occupe la totalité de la
première page, avec un silo de quarante pages, un blog actif, cinq logos clients et deux
témoignages nommés. Aller le chercher là coûterait des mois pour une deuxième place.

Les requêtes visées sont celles qu'il **ne peut pas servir sans se contredire** :

| Page | Requêtes visées | Concurrence observée |
|---|---|---|
| `/logiciel-renovation-jantes` | logiciel rénovation jantes · logiciel atelier jantes alu · gestion atelier rénovation jantes · chiffrage rénovation jante prix au pouce · bon de prise en charge jantes · teinte d'origine constructeur jante | **Nulle en France.** Les SERP renvoient des tours à jantes et des prestataires. |
| `/logiciel-sous-traitance-thermolaquage` | logiciel thermolaquage artisan · logiciel petit atelier thermolaquage · certificat de conformité thermolaquage · registre de contrôles Qualicoat · traçabilité lot de poudre · logiciel devis au m² laquage · logiciel sablage grenaillage gestion | **Faible.** COOCKPIT vise explicitement le « sous-traitant » de taille industrielle et n'a aucune page qualité. |
| `/prix-logiciel-thermolaquage` | prix logiciel thermolaquage · combien coûte un logiciel de gestion d'atelier · logiciel thermolaquage pas cher · alternative ERP thermolaquage · comparatif logiciel thermolaquage | **Faible, et le concurrent a ouvert la porte** : il a publié lui-même l'article de comparaison où il affiche 4 990 € + 980 €. Nous sommes la réponse à sa propre page. |

---

# 2. Ce qui a été écrit et mis en ligne

## 2.1 Les pages

| Fichier | Rôle |
|---|---|
| `src/app/page.tsx` | **Accueil, réécrit.** Nomme les deux métiers dès le kicker, ajoute un bloc de réponse directe citable, une section « Deux métiers » qui distribue vers les deux pages, une section qualité entièrement nouvelle, un `FAQPage` de 9 questions, et un emplacement de rappel. |
| `src/app/logiciel-renovation-jantes/page.tsx` | **Page métier jantes.** Trois douleurs (litige, teinte, délai), le barème au pouce réel affiché depuis le code, le parcours de production en 10 étapes, le suivi roue par roue, les opérations comptées à la jante, 6 questions balisées. |
| `src/app/logiciel-sous-traitance-thermolaquage/page.tsx` | **Page métier industrie.** Quatre preuves de traçabilité (lot, cuisson, registre, certificat), le socle (chiffrer / tenir le délai / facturer), un bloc **« Ce que Thermogestion ne fait pas »**, deux colonnes « c'est pour vous / ce n'est pas pour vous », 7 questions balisées. |
| `src/app/prix-logiciel-thermolaquage/page.tsx` | **Comparatif chiffré.** Cinq catégories de solution avec coût d'entrée, coût récurrent et coût sur trois ans ; une section « quand un ERP métier est le bon choix » écrite loyalement ; 5 questions balisées. |
| `src/components/marketing/Chrome.tsx` | En-tête et pied de page communs, avec le maillage interne. |
| `src/components/marketing/EtreRappele.tsx` | **Emplacement du formulaire de rappel** (voir §4). |
| `src/app/llms.txt/route.ts` | Fiche d'identité du produit pour les moteurs de réponse. |
| `src/app/sitemap.ts` | Les trois nouvelles pages ajoutées, priorité 0,9 / 0,9 / 0,8. |
| `src/app/layout.tsx` | Titre et description par défaut du site remis à jour. |
| `src/lib/abonnement.ts` | **Source unique des trois formules** (§3 bis) : contenu, prix, clés Stripe, barème des droits par capacité. Lue par la vitrine, la page tarifs, l'écran d'abonnement, le balisage `SoftwareApplication` et `llms.txt`. |
| `src/components/VerrouPlan.tsx`, `src/components/PlanProvider.tsx` | Écrans fermés par la formule, et distribution de l'abonnement aux écrans. Le verrou réel est en base. |
| `src/lib/aide.ts`, `src/app/(app)/aide/` | Astuces de première visite et centre d'aide — six tutoriels de tâches réelles. |
| `src/lib/metier.ts` | Pré-remplissage réel des réglages selon le métier déclaré à l'inscription. |

## 2.2 Le message, en une ligne par page

- **Accueil** — « Du devis signé à la pièce livrée, sans paperasse. » Kicker :
  *Logiciel d'atelier — thermolaquage et rénovation de jantes.*
- **Jantes** — « Le seul logiciel français qui connaît la jante. »
- **Industrie** — « La preuve que votre donneur d'ordre réclame. Sans ERP à 1 000 € par mois. »
- **Prix** — « Combien coûte un logiciel de thermolaquage ? »

## 2.3 Les données structurées

| Bloc | Où | Contenu |
|---|---|---|
| `Organization` | global (`layout.tsx`, déjà en place) | SASU Royal Motorbike, SIREN, TVA, adresse, `sameAs: thermopoudre.fr` — **signal d'autorité que le concurrent n'a pas** : nous sommes du métier, pas un éditeur généraliste. |
| `SoftwareApplication` | global | `featureList` et **`offers` chiffrées** (79 / 129 / 249 € EUR, lues dans `lib/abonnement.ts`). Les moteurs de réponse citent ce qui est chiffré. |
| `FAQPage` | les 4 pages | 27 questions au total, reprenant **mot pour mot** le texte visible — sinon Google rejette le balisage. |
| `BreadcrumbList` | les 3 pages internes | Fil d'Ariane visible **et** balisé. |

## 2.4 L'AI-SEO

Ce que les moteurs de réponse récompensent, et qui a été posé :

1. **Une réponse directe extractible en tête de chaque page** — un paragraphe de 60 à 90 mots qui
   répond littéralement à la question, avant tout argumentaire, sous un `h2` qui pose la question.
2. **Des chiffres opposables partout** : 79, 129 et 249 € HT, 30 jours sans carte, 0 € de mise en route,
   barème de 70 à 130 € HT à la jante, coefficients ×1 à ×1,8, 38 tables exportées, préavis à
   90 jours, 6 types de contrôle.
3. **Un comparatif honnête chiffré** — c'est le format que les assistants reprennent le plus
   volontiers, et il inclut délibérément les cas où nous ne sommes pas le bon choix.
4. **Un bloc « ce que le produit ne fait pas »** sur la page industrie et un `llms.txt` qui en
   reprend la liste. Un modèle qui cite une limite exacte cite aussi le reste avec confiance.
5. **Les entités nommées du métier** : Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco, RAL,
   Factur-X, FEC, PDF/A-3, XML CII, TPMS, diamantage CNC, DLU, FIFO, articles L441-9, L441-10,
   R.123-237, 293 B. La vitrine n'en nommait aucune sauf RAL.
6. **`llms.txt`** servi à la racine (le matcher du middleware le laisse déjà passer).

---

# 3. Ce qui a été retiré, et pourquoi

*C'est la partie la plus importante du lot. `AUDIT-SEO-DESIGN-UX.md` §5.4 recensait treize
promesses de la vitrine ; sept ne tenaient pas. Une promesse démentie pendant une démonstration
coûte plus cher qu'une promesse absente, et ce produit en a déjà fait les frais.*

| # | Ce que la vitrine promettait | Pourquoi c'était faux | Ce qui est écrit maintenant |
|---|---|---|---|
| P1 | « **QR sur la fiche suiveuse** : un scan valide l'étape » | #13 **Coquille** : le QR marche à l'écran, **aucune fiche suiveuse imprimable n'existe** — pas de route `/api/pdf/etiquette`. | « **un QR par projet** : un scan valide l'étape et lance le chronomètre ». La fiche suiveuse n'est plus mentionnée nulle part. |
| P2 | « **alerte si la date promise approche** » | Rien n'est jamais poussé. Ni push, ni mail, ni SMS. `notifications` est écrite une fois et lue zéro fois. | « **la date promise passe au rouge sur le kanban** dès qu'elle approche » — ce qui est exactement ce qui se produit. Et la page industrie liste « les alertes poussées » dans ce que le produit ne fait pas. |
| P3 | « **réappro en 1 clic sur thermopoudre.fr** » | #34 : chaîne codée, 16 tests verts, **jamais exécutée en production**. 1 commande en base au statut `panier`, 0 notification émise. | « le **panier de réapprovisionnement se prépare tout seul**, prêt à envoyer ». Vrai, vérifié à l'écran, et n'engage pas une chaîne jamais parcourue. |
| P4 | « expédiées le **jour même avant midi** » | Engagement logistique contractuel, hors périmètre logiciel, non vérifié. | **Retiré.** |
| P5 | « **Paiement en ligne des factures** » (plan Atelier) | #25 : opérationnel en code, **mort en production**. `STRIPE_SECRET_KEY` absente, le webhook répond « Stripe non configuré ». | **Retiré de la formule**, dans `lib/abonnement.ts` — donc de la vitrine **et** de l'écran d'abonnement, qui affichaient la même liste. Remplacé par « Registre de contrôles et certificat de conformité », qui est réel. Un commentaire dit quoi remettre le jour où les clés sont posées. |
| P7 | « Sans engagement, **résiliable en 1 clic** » | Le portail Stripe existe mais Stripe n'est pas configuré : le bouton ne mène nulle part. | « **Sans engagement, vous arrêtez quand vous voulez**, et vos données restent exportables. » |
| P13 | « **−20 % à vie** » pour un client Thermopoudre | Chiffre posé en juillet, **jamais confirmé par Alexis**. Un tarif affiché engage. | « −20 % **tant que votre compte Thermopoudre est actif** » — révocable, honnête, et toujours vendeur. **À valider (§5).** |
| P9 | « Vos données exportables » | Vrai (#57, 38 tables), **mais les fichiers binaires ne sont pas dans l'archive**. | La réserve est écrite dans la FAQ et dans `llms.txt` : « les photos ne sont pas dans l'archive, seuls leurs chemins ». |

**Trois autres formulations ont été ajustées** : « En production en 10 minutes » devient « En
production le jour même » (moins invérifiable, et l'étape d'import est désormais nommée) ; le plan
Solo annonce « Stock poudres : lots, DLU, décompte à la cuisson » au lieu de « réappro 1 clic » ;
et le contraste `text-zinc-500` sur fond marine, sous le minimum WCAG AA (3,37:1), est passé en
`text-zinc-400` et `text-zinc-300` sur toutes les pages (D3).

**Ce qui a été mis en avant, et qui était sous-vendu** : le certificat de conformité opposable, le
verdict rendu par la base, l'impossibilité de supprimer un contrôle, Factur-X et l'export FEC,
l'import gratuit de vos données, et l'export total. Tout cela est opérationnel et n'était écrit
nulle part.

---

# 3 bis. Les trois formules, et pourquoi elles se tiennent

*Ajouté par le lot 10. Le détail d'implémentation est dans `RECETTE-LOT10.md` ; ici, l'argument
de vente.*

| | **Atelier** | **Équipe** | **Certifié** |
|---|---|---|---|
| Mensuel HT | **79 €** | **129 €** | **249 €** |
| Annuel HT (2 mois offerts) | **790 €** | **1 290 €** | **2 490 €** |
| Utilisateurs | 1 à 2 | illimités | illimités |
| Ce qu'on achète | le métier complet, jantes et industrie | ce que la taille impose | ce que la réglementation impose |

**La phrase qui tient tout l'édifice, et qu'il ne faut jamais abandonner en démonstration :**
*« Ce qui fait payer plus, ce n'est jamais votre métier. »* Un rénovateur de jantes qui travaille
seul a le dossier véhicule, le chiffrage au pouce, le suivi roue par roue, la teinte d'origine
constructeur et le bon de prise en charge signé — tout son métier — à 79 €. Un laqueur seul a le
devis au m² et au mètre linéaire, la production, le stock par lot, le bon de livraison signé et le
Factur-X, au même prix. Ce qui fait monter, c'est d'être plusieurs, puis d'avoir des clients qui
exigent une preuve.

**Pourquoi cette segmentation vend mieux que l'ancienne (59 / 89 €) :**

1. **Elle nous sort de la catégorie « logiciel de facturation d'artisan ».** À 59 €, la vitrine
   nous rangeait mentalement à côté de Tolteck (25 €) et Henrri (gratuit) — c'est-à-dire à côté
   d'outils qui ne connaissent ni la poudre, ni le four, ni la traçabilité. À 79 € d'entrée et
   249 € en haut, on est manifestement autre chose, et le comparatif de la page prix le démontre
   ligne par ligne.
2. **Elle rend le plan haut défendable.** 249 € reste **quatre fois moins cher que l'offre réduite**
   d'un ERP métier (680 € sous 1 M€ de CA), et il prend le seul terrain que cet ERP ne peut pas
   défendre : la qualité opposable pour un atelier de trois personnes. Aucun éditeur au monde ne
   vend ça — vérifié en France, en Allemagne, en Italie et aux États-Unis.
3. **Elle finance la roadmap.** Huit clients à 89 € faisaient 712 €/mois. Huit clients répartis
   3/3/2 sur la nouvelle grille en font 1 122 €, soit +58 % à volume identique.
4. **Elle se démontre.** L'écran fermé nomme la fonction, dit à quoi elle sert dans le métier et
   affiche son prix. Un prospect qui ouvre « Qualité » en formule Atelier comprend en dix secondes
   ce qu'il n'a pas et pourquoi il pourrait le vouloir — ce qu'un menu où la rubrique serait
   absente ne produit jamais.

**Ce que la nouvelle grille ne règle pas, et qu'il faut savoir avant de vendre :**

- **La marche 79 → 129 € se déclenche sur le mauvais événement.** Un atelier qui embauche un
  troisième opérateur paie +63 % pour un accès, et découvre qu'il achète aussi la planification des
  fournées. Un utilisateur supplémentaire facturé à part sur la formule d'entrée transformerait ce
  moment de friction en croissance de revenu.
- **La cible jantes est plafonnée à la formule basse.** Un atelier de jantes n'aura jamais besoin de
  fournées ni de registre des bains. C'est le segment où le produit est le plus différenciant et où
  il rapportera le moins, tant qu'aucune marche ne parle à ce métier — suivi de flotte pour les
  concessions, nuancier client par lien, galerie avant/après. Aucune n'existe.
- **Le plan à 249 € repose sur des documents que personne n'a fait relire par un auditeur.** Voir
  §6, la réserve n'a pas changé — elle a seulement pris de la valeur.

---

# 4. Le formulaire de rappel

`src/components/marketing/EtreRappele.tsx`, monté sur les quatre pages avec l'ancre `#rappel`.

Le lot technique en cours ayant livré `POST /api/leads` et les aides `utm()` / `track()` de
`lib/track.ts` pendant ce lot, l'emplacement prévu est devenu **un vrai formulaire** plutôt qu'un
lien `mailto:` : nom, atelier, e-mail, téléphone et message libre, envoyés à la route existante.

- **Un seul champ obligatoire, l'e-mail.** Chaque champ ajouté coûte des réponses, et un exploitant
  qui découvre le produit à 21 h ne remplit pas huit lignes.
- La prop `origine` alimente `leads.source` : on saura **laquelle des deux cibles** a écrit.
- Les paramètres de campagne sont joints via `utm()`, qui mémorise ceux du premier atterrissage —
  sans quoi le premier euro de publicité serait dépensé à l'aveugle.
- Un événement `lead_submitted` est émis pour rendre le taux de lead calculable.
- Pot de miel invisible, limite de débit et validation restent côté serveur : une validation de
  navigateur ne protège de rien.
- Le lien direct vers `contact@thermopoudre.fr` est conservé sous le bouton, ainsi que l'accès à la
  démonstration.

C'était le manque **M1** de l'audit marketing : la table `leads` existait avec sa colonne `utm` et
n'avait jamais reçu une ligne, **non par manque de trafic mais parce qu'il n'existait aucun
formulaire**. COOCKPIT n'a qu'un seul appel à l'action sur tout son site — « Demander une démo » —
et il a raison : dans ce métier, la vente se fait au téléphone.

*Note de coordination : si le lot technique produit son propre composant de formulaire partagé,
c'est ce fichier qu'il faut remplacer. L'ancre `#rappel`, la prop `origine` et les quatre appels
depuis les pages n'ont pas à bouger.*

---

# 4 bis. Recette

`npm test` : **445 tests, 33 fichiers, tous verts.** `npx next build` depuis PowerShell : compilé
sans erreur, **zéro erreur TypeScript**, 62 pages générées. Déployé en production et vérifié sur
`https://thermogestion-v2.vercel.app`.

| Vérification | Résultat |
|---|---|
| Les 4 pages répondent 200 | ✅ |
| `robots.txt`, `sitemap.xml`, `llms.txt` | ✅ 200, `x-vercel-cache: HIT` |
| Les 3 nouvelles pages dans le sitemap | ✅ |
| `title`, `description` et `canonical` propres à chaque page | ✅ vérifiés un par un |
| `Organization`, `SoftwareApplication`, `Offer`, `FAQPage`, `BreadcrumbList` | ✅ présents dans le HTML servi |
| Occurrences de « jante » sur l'accueil | **92** (contre **1** avant ce lot) |
| Occurrences de « sous-traitance / industriel » sur l'accueil | 24 (contre 0) |
| Occurrences de « Qualicoat » sur l'accueil | 8 (contre 0) |
| Aucune des 7 promesses retirées ne subsiste sur les 4 pages | ✅ vérifié par recherche sur le HTML servi |
| Formulaire de rappel — dépôt valide | ✅ HTTP 200, **première ligne de l'histoire de la table `leads`**, avec `source = "jantes"` et l'UTM |
| Formulaire — pot de miel | ✅ répond `ok` **sans rien écrire** |
| Formulaire — e-mail invalide | ✅ HTTP 400 |
| Rendu réel dans Chrome (accueil, jantes, sous-traitance, prix) | ✅ en-tête, fil d'Ariane, barème, tableau comparatif, formulaire et pied de page conformes |

**Deux réserves de recette, à connaître :**

1. **Une ligne de test subsiste dans `leads`** — `recette-vitrine@thermopoudre.fr`, atelier
   « TEST - a supprimer ». Elle prouve que la chaîne fonctionne de bout en bout ; **à supprimer à
   la main**, je ne supprime pas de données.
2. **Le rendu mobile n'a pas pu être capturé** : la fenêtre du poste ne descend pas sous 1568 px
   de viewport, contrainte déjà relevée dans `AUDIT-SEO-DESIGN-UX.md`. Le comportement mobile est
   établi par construction et non par capture : toutes les grilles empilent par défaut et ne se
   déploient qu'en `sm:` / `md:` / `lg:`, les liens secondaires de l'en-tête sont masqués sous
   `lg`, les champs du formulaire sont en `min-h-[44px]`, et le tableau du comparatif est enveloppé
   dans un `overflow-x-auto` — il défile horizontalement au lieu de casser la mise en page.
   **À revoir sur un vrai téléphone avant toute campagne.**

*Note de coordination : les trois nouvelles pages répondaient `307 → /login` au premier
déploiement, la liste blanche du middleware ne les connaissant pas. Le lot technique a basculé le
middleware d'une liste blanche vers une liste de chemins privés pendant ce lot, ce qui règle le
problème pour ces pages **et pour toutes les suivantes**. Vérifié : les trois répondent 200.*

---

# 5. Ce qui reste à trancher — décisions d'Alexis

| # | Décision | Enjeu | Ma recommandation |
|---|---|---|---|
| **1** | **Stripe** (R7) | Le 13/09/2026, le seul atelier réel passe en lecture seule et « Souscrire » répond HTTP 500. **Aucune ligne de ce document n'a d'importance si le produit se verrouille tout seul.** | Renseigner les trois variables et créer les quatre prix. À défaut, repousser `trial_end`. Ne pas laisser passer la date. |
| **2** | ~~**Le tarif**~~ ✅ **Tranché — lot 10** | — | **Fait** : 79 € (Atelier) / 129 € (Équipe) / 249 € (Certifié), en ligne. La segmentation retenue n'est pas celle qui était proposée ici : les formules ne se découpent **pas par métier** (jantes / atelier / sous-traitance) mais **par taille d'équipe et par niveau de preuve**, le métier restant entier dès la formule d'entrée. Voir §3 bis. |
| **3** | **Le « −20 % Thermopoudre »** | 214 €/an et par client sur le plan Atelier, jamais confirmé. | J'ai retiré « à vie » et écrit « tant que votre compte est actif ». À confirmer, ou à supprimer. |
| **4** | **Nommer COOCKPIT sur la page prix** | La page comparatif cite aujourd'hui « un éditeur français spécialisé » avec ses chiffres publics et la date du relevé. Le nommer ouvrirait les requêtes « COOCKPIT alternative » et « avis COOCKPIT ». | La publicité comparative est licite en France si elle est loyale et vérifiable, et elle l'est ici. **Mais c'est ton nom sur la page** : c'est à toi de décider. C'est un changement d'une ligne. |
| **5** | **Une prestation d'accompagnement optionnelle** | Le concurrent facture 4 990 € de mise en route ; c'est aussi ce qui rassure un dirigeant de 55 ans. | Proposer « reprise de données + paramétrage accompagné, **490 € HT une fois** », en option et jamais obligatoire. Dix fois moins cher parce que l'import CSV existe déjà. |

---

# 6. Mon avis franc sur la capacité de ce positionnement à convertir

**Sur les jantes : oui, et c'est la seule partie dont je sois certain.**

Il n'y a aucune concurrence éditoriale en France sur ces requêtes, la page répond à une douleur
que le prospect reconnaît en une phrase — « cette jante était déjà voilée » — et le produit tient
ce que la page promet, y compris les photos par jante, que j'ai vérifiées dans le code parce que
la même fonction est cassée ailleurs. Un garagiste qui tombe sur cette page comprend en dix
secondes que quelqu'un connaît son métier. C'est rare, et ça se sent.

La réserve, elle, n'est pas dans la page : **le volume**. « logiciel rénovation jantes » est une
requête sans concurrence *parce que peu de gens la tapent*. Ce trafic se compte en dizaines de
visites par mois, pas en centaines. La page est un excellent actif de conversion et un mauvais
moteur d'acquisition : elle transformera bien les rares personnes qui la trouvent, et il faudra
aller chercher les autres autrement — par la base clients Thermopoudre, qui est le canal le plus
rentable et n'a rien à voir avec le SEO.

**Sur l'industrie : oui sur le fond, avec une inconnue.**

Le positionnement est juste. Il ne se bat pas contre COOCKPIT sur son terrain, il prend celui
qu'il a laissé vide — l'atelier de 1 à 15 personnes, et surtout **la qualité opposable, que
personne au monde ne vend**. J'ai cherché en France, en Allemagne, en Italie et aux États-Unis :
aucun éditeur ne met Qualicoat en avant comme argument produit. Un certificat qui refuse de
s'imprimer quand la mesure manque se démontre en trente secondes, et le responsable qualité en
face comprend immédiatement ce qu'il voit. C'est le meilleur argument du dossier et il n'était
écrit nulle part.

**L'inconnue est celle que `AUDIT-FONCTIONNEL` pose depuis le lot 2, et elle n'a pas bougé :**
personne n'a jamais fait relire le certificat, le registre des contrôles et le registre des
déchets par un responsable qualité d'atelier certifié, les trois PDF imprimés sur la table. Je
viens de construire toute la page industrie sur cette promesse. Si ces documents ne passeraient
pas un audit Qualicoat, la page devient un mensonge coûteux. **C'est le rendez-vous le plus
rentable qui reste à prendre, et il devrait précéder toute publicité sur ce segment.**

**Ce qui, honnêtement, va limiter la conversion des deux cibles — et qui n'est pas dans la
vitrine :**

1. **Il n'y a toujours aucun témoignage, aucun logo, aucun nom.** Le concurrent en affiche cinq,
   avec la fonction et l'entreprise. Sur un achat à 89 € comme à 980 €, un dirigeant d'atelier
   veut savoir qui d'autre s'en sert. Un seul atelier qui accepte de dire « le bon de prise en
   charge m'a évité une engueulade de 400 € » vaut plus que les vingt-cinq requêtes du tableau de
   mots-clés. C'est le premier chantier après Stripe, et il ne demande que des appels
   téléphoniques.
2. **La fiche client fait 51 lignes.** C'est le premier écran qu'on ouvre pendant une
   démonstration quand le prospect demande « et si je veux voir ce que ce client m'a acheté ».
   Il n'y a rien. Toutes les pages du monde ne rattrapent pas ce moment-là.
3. **Rien n'est poussé.** La vitrine ne le promet plus — c'est une correction, pas une solution.
   Un atelier de trois personnes ne vient pas consulter un logiciel : il faut que l'information
   sorte. C'est la première cause d'abandon à trois semaines, et un mail quotidien de sept lignes
   la referme.

**Ce que le lot 10 a changé à ce diagnostic, et ce qu'il n'a pas changé.**

Deux des trois limites ci-dessus ont bougé. La **fiche client à 51 lignes** n'a pas bougé du tout —
c'est toujours le pire écran du produit, et toujours celui qu'un prospect demande à voir. En
revanche, l'atelier qui s'inscrit ne tombe plus sur des réglages vides : il déclare son métier et
repart avec sa grille, son barème au pouce, ses prestations et son parcours de production. Et
chaque écran s'explique à la première visite, dans la langue du métier. C'est la différence entre
un produit qu'on essaie et un produit qu'on abandonne au troisième écran.

**Ce qui n'a pas bougé d'un pouce, et qui reste la première cause d'abandon à trois semaines :
rien n'est poussé vers l'atelier.** Pas de DLU en approche, pas de bain à renouveler, pas
d'étalonnage en retard, pas de balance âgée, pas de « vos pièces sont prêtes ». La vitrine ne le
promet plus, ce qui est une correction et pas une solution. Aucun tutoriel ne remplace un mail de
sept lignes le matin. C'est une journée de travail, et c'est ce que je ferais avant tout le reste —
y compris avant le témoignage client, parce qu'un atelier qui a abandonné ne témoigne de rien.

**Et une chose qui change avec le nouveau tarif :** à 249 €, le plan Certifié n'est plus une ligne
de vitrine, c'est un engagement de 3 000 € par an. La recommandation du §6 — faire relire le
certificat, le registre des contrôles et le registre des déchets par un responsable qualité
d'atelier certifié — cesse d'être « la plus rentable » pour devenir **la plus urgente**.

**En résumé :** le positionnement est bon, il est maintenant écrit, et il est honnête — ce qui
n'était pas le cas avant, avec sept promesses qui ne tenaient pas. Il ne fera pas de trafic la
semaine prochaine. Ce qu'il fait, c'est que le jour où quelqu'un arrive, il arrive quelque part,
il comprend en dix secondes lequel des deux métiers on lui parle, et rien de ce qu'il lit ne
tombera pendant la démonstration. C'est la condition d'entrée, pas la victoire. La victoire
dépend de trois choses qui ne sont pas du marketing : que le tiroir-caisse fonctionne le
13 septembre, qu'un atelier accepte de donner son nom, et que les documents qualité passent
devant un vrai auditeur.
