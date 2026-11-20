# Thermogestion — Audit SEO, design system, ergonomie et mesure

*19 août 2026. Quatre audits en un. Méthode : lecture du code et de la base (projet Supabase
`luujbyqenmzivzhiatze`), parcours réel de la démonstration publique dans Chrome, requêtes `curl`
sur la production, recherche concurrentielle sur les requêtes cibles. Aucun code modifié.*

**Source de vérité fonctionnelle** : `AUDIT-FONCTIONNEL.md` (19/08). Les écarts entre ce que la
vitrine promet et ce que le produit fait sont mesurés contre ce document, pas contre le cahier
des charges.

---

# Volet 1 — SEO et AI-SEO de la vitrine

## 1.0 Le préalable qui invalide une hypothèse

> « La concurrence est quasi nulle sur ces termes, c'est une opportunité rare. »

**C'est faux sur « logiciel thermolaquage », et il fallait le vérifier.**

Un concurrent occupe **la totalité de la première page** sur cette requête et sur ses variantes :
**COOCKPIT Thermolaquage** (`thermolaquage.coockpit.com`), un sous-domaine WordPress dédié,
en ligne depuis août 2025, avec Google Tag Manager, un blog actif (publications datées du
22/01, 03/02 et 06/02/2026), une page FAQ, une page tarifs, cinq logos clients
(ANO'TECH, APIL, Breton, SEMAS, SP Coating), deux témoignages nommés et une vidéo produit.

Sur la requête « logiciel thermolaquage gestion atelier », **9 résultats sur 9 pointent vers ce
domaine**. Sur « logiciel peinture poudre atelier gestion production traçabilité SaaS France »,
il ressort encore. Sur la requête « Thermogestion logiciel atelier thermolaquage » — c'est-à-dire
**le nom du produit** — Thermogestion n'apparaît pas et COOCKPIT prend 5 résultats sur 6.

Leur périmètre fonctionnel recouvre le vôtre de très près : commandes, planification par étape
(grenaillage, préparation, peinture, emballage), suivi des poudres **avec QR codes pour la pesée
en atelier**, facturation en un clic, relances automatiques, suivi client. Les quatre briques que
la page d'accueil de Thermogestion met en avant sont exactement les quatre qu'ils annoncent.

**Mais leur page tarifs tranche le marché en deux :**

| | COOCKPIT Thermolaquage | Thermogestion |
|---|---|---|
| Mise en route | **4 990 € HT** | 0 € |
| Abonnement | **980 € / mois** | 59 € ou 89 € / mois |
| Cible déclarée | thermolaqueurs **sous-traitants** industriels | artisan seul → équipe de 10 |
| Entrée | « Demander une démo » (formulaire) | essai 30 j ou démo libre |
| Jantes | rien | module complet |

Un atelier de trois personnes ne paiera jamais 4 990 € + 980 €/mois. **Le segment est donc
réellement libre — mais pas le mot-clé.** C'est une nuance déterminante pour la stratégie :
il ne faut pas attaquer « logiciel thermolaquage » de front avec une page d'accueil unique, il
faut occuper les requêtes que COOCKPIT ne peut pas servir sans se contredire.

### Les cinq requêtes que COOCKPIT ne peut pas prendre

1. **`logiciel rénovation jantes`** / `logiciel atelier jantes alu` — aucun acteur. Les SERP
   renvoient des tours à jantes (RenovTjantes, RestorWheel), des prestataires (Jantes Alu
   Services) et des logiciels de carrosserie génériques (GT Estimate, Atelio Chiffrage,
   Atelier Gestion) qui ne savent pas ce qu'est un chiffrage au pouce. **Zéro concurrence
   éditoriale.**
2. **`logiciel thermolaquage pas cher` / `prix logiciel thermolaquage` / `alternative ERP
   thermolaquage`** — COOCKPIT a écrit lui-même l'article de comparaison
   (`/logiciel-metier/`) où il affiche 4 990 € + 980 €. Il vous ouvre la porte : vous êtes la
   réponse à sa propre page.
3. **`logiciel thermolaquage artisan` / `logiciel pour petit atelier de laquage`** — leur
   promesse (« thermolaqueurs sous-traitants », « multi-sites », « équipe administrative »)
   exclut la cible.
4. **`devis thermolaquage en ligne` / `logiciel devis au m² laquage`** — intention
   transactionnelle immédiate, produit livré et opérationnel.
5. **`certificat de conformité thermolaquage` / `registre de contrôles Qualicoat`** — requêtes
   à faible volume mais à intention d'achat maximale, et vous avez le PDF.

## 1.1 Technique — ce qui bloque, par gravité

| # | Constat | Gravité | Preuve |
|---|---|---|---|
| T1 | **`/robots.txt` répond `HTTP 307 → /login`** | **Critique** | `curl -I https://thermogestion-v2.vercel.app/robots.txt` → `307`, `location: /login`. Le fichier n'existe pas, et le `matcher` du middleware (`src/middleware.ts:54`) l'attrape : `/((?!_next/static\|_next/image\|favicon.ico\|.*\.(svg\|png\|jpg\|jpeg\|gif\|webp\|ico)$).*)`. **Même en créant `app/robots.ts`, la redirection persisterait** tant que le matcher n'est pas corrigé. Un `robots.txt` qui redirige vers du HTML est traité par Google comme « indisponible » : le crawl est ralenti ou suspendu. |
| T2 | **`/sitemap.xml` répond `HTTP 307 → /login`** | **Critique** | idem. Aucun plan de site n'existe (`find src -iname "*sitemap*"` → vide). |
| T3 | **Aucun domaine propre** — le site vit sur `thermogestion-v2.vercel.app` | **Critique** | `SITE_URL` retombe sur le sous-domaine Vercel (`AUDIT-FONCTIONNEL` #60). Un sous-domaine `.vercel.app` n'accumule aucune autorité transférable, et il apparaît **sur chaque devis et chaque facture envoyés à un client**. Une douzaine d'euros par an. |
| T4 | **Aucune donnée structurée** | **Élevée** | `grep -rn "application/ld+json\|schema.org" src/` → 0 résultat. Aucun `SoftwareApplication`, `Organization`, `FAQPage`, `Offer`. La FAQ existe pourtant en HTML (`src/app/page.tsx:20-25`, 4 questions) : c'est un balisage à 20 lignes qui déclenche un rich result. |
| T5 | **La page d'accueil n'est jamais mise en cache** | **Élevée** | 4 requêtes `curl` successives : `x-vercel-cache: MISS` à chaque fois, `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`. Cause : le middleware appelle `supabase.auth.getUser()` sur `/` avant de rendre quoi que ce soit (`middleware.ts:33-38`), donc la page marketing est rendue dynamiquement et ne peut être ni statique ni servie par l'edge. TTFB mesuré : **250 à 380 ms depuis un datacenter**. Depuis un téléphone en 4G, c'est bien pire — et c'est un signal de classement. |
| T6 | **Une seule page indexable** | **Élevée** | `/` + 3 pages légales (`/legal/mentions`, `/legal/cgu`, `/legal/confidentialite`). Tout le reste est derrière le middleware. Quatre URL en tout, dont trois juridiques. Impossible de couvrir plus d'une intention de recherche. |
| T7 | **Aucun `<h1>` sur les pages légales, `title` non normalisés** | Moyenne | `src/app/legal/*/page.tsx` exportent un `title` mais pas de `description`. |
| T8 | **Pas de `canonical`, pas de `alternate hreflang`** | Moyenne | Aucun `alternates` dans `metadata` (`src/app/layout.tsx:11-18`). L'i18n FR/IT existe côté app (`lib/i18n.ts`) mais la vitrine est mono-langue et ne le déclare pas. |
| T9 | **`opengraph-image` correct mais pas de `twitter:card`** | Faible | `src/app/opengraph-image.tsx` existe et `metadataBase` est bien posé (correctif audit n°3). Il manque `openGraph.title/description` explicites et le bloc Twitter. |
| T10 | **Aucun `llms.txt`, aucun `.well-known`** | Moyenne (AI-SEO) | Et de toute façon ils seraient interceptés par le middleware (T1). |

**Ce qui va bien, techniquement** : HTTPS, HSTS, en-têtes de sécurité complets
(`next.config.ts`), `lang="fr"`, `viewport` correct, `manifest.webmanifest` servi en 200, polices
auto-hébergées via `next/font` (pas de requête Google Fonts bloquante), aucun script tiers
bloquant. Le socle n'est pas mauvais : il est **inatteignable**.

## 1.2 On-page — la page d'accueil, ligne par ligne

| Élément | Valeur actuelle | Diagnostic |
|---|---|---|
| `title` | `Thermogestion — le logiciel des ateliers de thermolaquage` | 57 car. — bonne longueur, mot-clé présent. **Ne contient ni « gestion atelier » ni « jantes » ni de bénéfice.** |
| `description` | `Devis au m² signés en ligne, suivi de production par QR, stock de poudre décompté à la cuisson. Essai gratuit 30 jours.` | 130 car. — correcte, un peu courte, **aucun signal de prix ni de jantes** alors que le prix est votre arme n°1 contre COOCKPIT. |
| `h1` | `Du devis signé à la pièce livrée, sans paperasse.` | Excellent slogan, **zéro mot-clé**. Le mot « thermolaquage » n'apparaît que dans le kicker au-dessus (`<p>`, pas un titre). |
| `h2` | 6 : *Tout l'atelier dans votre poche · Trois écrans qui font le boulot · En production en 10 minutes · Votre poudre commandée avant d'être à sec · Simple, sans surprise · Questions fréquentes* | Aucun ne contient une requête cible. Ce sont des titres de brochure, pas des titres de page web. |
| Mot « jante » | **1 occurrence dans toute la page**, au milieu de la réponse FAQ n°1 | Voir le volet « Positionnement ». |
| Images | Aucune balise `<img>` — tout est SVG inline et composants React | Pas de risque d'`alt` manquant, mais **aucune image indexable**, donc aucun trafic Google Images et aucune vignette dans les résultats enrichis. |
| Maillage interne | 0 lien interne éditorial. Uniquement `/signup`, `/demo`, `/login`, `#tarifs`, `/legal/*` | Une page isolée ne peut pas construire d'autorité thématique. |
| Poids HTML | 101 Ko | Acceptable, mais non compressible côté cache (T5). |

## 1.3 AI-SEO — le canal réellement libre

Quand un exploitant demande à un assistant *« quel logiciel pour mon atelier de thermolaquage ? »*,
le modèle répond aujourd'hui **COOCKPIT** — c'est la seule source citable : contenu structuré,
FAQ explicite, page de comparaison chiffrée, témoignages nommés, prix publiés. Thermogestion
n'a **rien de citable** : une page de vente sans chiffres vérifiables, sans FAQ balisée, sans
comparatif, sans page « à propos », sans mention de l'éditeur.

Ce que les moteurs de réponse récompensent, et que vous n'avez pas :

1. **Une réponse directe et extractible en tête de page.** Un paragraphe de 40-60 mots qui
   répond littéralement à la question, avant tout argumentaire.
2. **Des chiffres opposables.** « 59 € HT/mois », « essai 30 jours sans carte », « barème de 70 à
   130 € HT à la jante selon le diamètre », « certificat PDF/A-3 Factur-X ». Les modèles citent
   ce qui est chiffré.
3. **Une FAQ balisée `FAQPage`** avec des questions formulées comme on les tape.
4. **Une page de comparaison honnête** — c'est le format le plus repris par les assistants.
5. **Une identité d'éditeur claire** (`Organization` + page « Qui sommes-nous ») : SASU Royal
   Motorbike / Thermopoudre, distributeur de matériel de thermolaquage depuis X années. C'est
   un signal d'autorité **que COOCKPIT n'a pas** — eux sont un éditeur de logiciel généraliste
   qui a fait un sous-domaine vertical, vous êtes du métier.
6. **Des entités nommées** : RAL, Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco, Factur-X,
   TPMS, diamantage CNC, teinte d'origine constructeur. Chaque entité citée dans un contexte
   correct augmente la probabilité de citation. Le produit les connaît toutes ; la vitrine n'en
   nomme aucune sauf RAL.

## 1.4 Table des opportunités de mots-clés

Difficulté estimée sur la base des SERP réellement observées (nombre et qualité des pages
concurrentes), pas de volumes d'outil — aucun outil SEO n'est connecté.

| # | Requête | Difficulté | Opportunité | Position actuelle | Intention | Format recommandé |
|---|---|---|---|---|---|---|
| 1 | logiciel rénovation jantes | **Très faible** | **Haute** | non classé | commerciale | **Page dédiée `/logiciel-renovation-jantes`** |
| 2 | logiciel atelier jantes alu | Très faible | Haute | non classé | commerciale | même page |
| 3 | chiffrage rénovation jante prix au pouce | Très faible | Haute | non classé | informationnelle | guide + simulateur |
| 4 | teinte d'origine constructeur jante | Très faible | Haute | non classé | informationnelle | guide (lien vers thermopoudre.fr) |
| 5 | bon de prise en charge jantes modèle | Très faible | Haute | non classé | transactionnelle | modèle PDF téléchargeable → **capture de lead** |
| 6 | prix logiciel thermolaquage | Faible | **Haute** | non classé | commerciale | **page comparatif** |
| 7 | logiciel thermolaquage pas cher | Faible | Haute | non classé | commerciale | page comparatif |
| 8 | alternative ERP thermolaquage | Faible | Haute | non classé | commerciale | page comparatif |
| 9 | logiciel devis thermolaquage | Moyenne | Haute | non classé | transactionnelle | page fonctionnalité `/devis` |
| 10 | devis au m² laquage calcul | Faible | Haute | non classé | informationnelle | guide + calculateur public |
| 11 | logiciel gestion atelier thermolaquage | **Élevée** (COOCKPIT) | Moyenne | non classé | commerciale | page d'accueil retravaillée |
| 12 | logiciel thermolaquage | **Élevée** (COOCKPIT) | Moyenne | non classé | commerciale | accueil + silo |
| 13 | logiciel atelier peinture poudre | Moyenne | Moyenne | non classé | commerciale | page fonctionnalité |
| 14 | logiciel suivi production peinture poudre | Moyenne | Moyenne | non classé | commerciale | page fonctionnalité |
| 15 | certificat de conformité thermolaquage modèle | Faible | Moyenne | non classé | transactionnelle | modèle → capture de lead |
| 16 | registre de contrôles Qualicoat | Faible | Moyenne | non classé | informationnelle | guide |
| 17 | traçabilité lot de poudre obligation | Faible | Moyenne | non classé | informationnelle | guide |
| 18 | facturation électronique 2027 artisan | Élevée | Moyenne | non classé | informationnelle | guide (vous avez le Factur-X) |
| 19 | logiciel thermolaquage artisan / petit atelier | Très faible | Moyenne | non classé | commerciale | page segment |
| 20 | combien coûte un logiciel de gestion d'atelier | Moyenne | Moyenne | non classé | informationnelle | guide |
| 21 | calcul surface développée portail à laquer | Très faible | Moyenne | non classé | informationnelle | calculateur public |
| 22 | rendement poudre kg par m² | Faible | Faible | non classé | informationnelle | guide |
| 23 | DLU poudre époxy polyester durée | Très faible | Faible | non classé | informationnelle | guide |
| 24 | valve TPMS rénovation jante responsabilité | Très faible | Faible | non classé | informationnelle | guide (angle litige) |
| 25 | logiciel sablage grenaillage gestion | Très faible | Faible | non classé | commerciale | page segment |

## 1.5 Plan d'action SEO

### Gains rapides — moins de 2 h chacun

**S1. Débloquer le crawl** *(20 min, impact critique)*
Corriger le matcher du middleware pour laisser passer les fichiers de crawl, puis créer
`src/app/robots.ts` et `src/app/sitemap.ts`.

Matcher à poser :
```
"/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"
```

**S2. Titre et description** *(10 min, impact élevé)*
```
title:       "Thermogestion — logiciel de gestion pour ateliers de thermolaquage et rénovation de jantes"
description: "Devis au m² ou au pouce, signature en ligne, suivi de production au QR, stock de poudre décompté à la cuisson. Le seul logiciel qui gère la rénovation de jantes. 59 € HT/mois, essai 30 jours sans carte."
```
*(title : 97 car. — il sera tronqué en SERP autour de 60, mais Google réécrit rarement un titre
qui contient l'entité + la requête ; l'important est que « rénovation de jantes » y soit.)*

**S3. Balisage JSON-LD** *(1 h, impact élevé)*
Trois blocs à poser dans `src/app/page.tsx` : `SoftwareApplication` avec `offers` (59 et 89 €,
`priceCurrency: EUR`), `Organization` (SASU Royal Motorbike, `sameAs: https://thermopoudre.fr`),
et `FAQPage` reprenant à l'identique les 4 questions déjà présentes.

**S4. Domaine propre** *(30 min + achat, impact critique)*
`thermogestion.fr`, `NEXT_PUBLIC_SITE_URL`, redirection 301 permanente du `.vercel.app`.
Six manipulations listées dans `RECETTE-LOT4.md`. **À faire avant toute publication de contenu** :
sinon toute l'autorité construite est à jeter.

**S5. Sortir `/` du middleware** *(15 min, impact élevé)*
La page d'accueil n'a aucune raison d'appeler `supabase.auth.getUser()`. La redirection
« utilisateur connecté → `/dashboard` » peut se faire côté page. Gain : page statique,
`x-vercel-cache: HIT`, TTFB divisé par 5.

**S6. `llms.txt`** *(20 min, impact moyen, AI-SEO)*
Un fichier texte à la racine résumant ce qu'est le produit, pour qui, à quel prix, et ce qu'il
fait que les autres ne font pas. Coût dérisoire, canal encore libre.

### Investissements structurants — ce trimestre

**S7. La page `/logiciel-renovation-jantes`** — *le seul actif SEO à créer en premier.*
Zéro concurrence, cible identifiée, produit livré et démontrable. Contenu détaillé au volet
« Positionnement » ci-dessous.

**S8. La page comparatif `/prix-logiciel-thermolaquage`.**
COOCKPIT a écrit l'article ; vous écrivez la réponse. Tableau honnête : Excel / ERP générique /
COOCKPIT (chiffres publics : 4 990 € + 980 €) / Thermogestion. Ne pas les dénigrer — dire que
c'est un très bon outil **pour un sous-traitant industriel de 30 personnes**, et que vous adressez
l'atelier de 1 à 10. C'est le format que les assistants IA reprennent le plus volontiers.

**S9. Le silo « guides ».**
Six à huit pages, une par entité métier : calcul de surface développée, rendement poudre,
DLU, chiffrage au pouce, teinte d'origine constructeur, certificat de conformité, registre
Qualicoat, TPMS et responsabilité. Chacune se termine par un outil ou un modèle téléchargeable
qui capture un e-mail.

**S10. Deux outils publics sans compte.**
Un calculateur de surface développée et un simulateur de chiffrage jantes au pouce. Ce sont les
deux pages qui attireront des liens naturels — et vous avez déjà les moteurs (`lib/calculs.ts`,
`lib/jantes.ts`). C'est le meilleur rapport travail / acquisition de tout le document.

---

# Volet 2 — Audit du design system

## 2.0 Résumé

**Composants examinés :** 11 primitives (`src/components/ui.tsx`) + 2 navigations + 25 écrans.
**Anomalies :** 14. **Note : 52 / 100.**

Le verdict tient en une phrase : **les jetons existent et ne sont pas utilisés.** La palette est
correctement déclarée dans `tailwind.config.ts` (marine `ink` #11203A, cyan `tpblue` #2FB5D2,
`brand` #147085, plus `success`/`warning`/`danger`), les polices sont bien câblées, et 98 % des
couleurs d'état de l'application sont écrites en dur avec la palette Tailwind par défaut.

## 2.1 Couverture des jetons

| Catégorie | Défini | Utilisé en dur |
|---|---|---|
| Couleurs de marque | `brand`, `brand-dark`, `brand-light`, `tpblue`, `tpblue-soft`, `ink`, `ink-soft`, `ink-line` | **223 usages** — conformes |
| Couleurs sémantiques | `success`, `warning`, `danger` (+ `-light`, `-dark`) | **9 usages des jetons** contre **429 usages en dur** (`text-red-600` ×38, `text-green-700` ×38, `text-amber-800` ×35, `bg-amber-50` ×30…). **Les jetons sémantiques sont morts à 98 %.** |
| Neutres | aucun jeton défini | **Deux échelles cohabitent** : `gray-*` **807 fois** (l'application) et `zinc-*` **49 fois** (la vitrine). Ce sont deux gris différents, sur le même produit. |
| Typographie | `font-sans` (Inter), `font-display` (Space Grotesk) | `font-display` n'apparaît que **42 fois** — la vitrine, quelques titres. Les `<h1>` d'écran (`app/(app)/dashboard/page.tsx:81`) sont en `text-xl font-bold` sans `font-display`, alors que le composant `PageTitle` de `ui.tsx` l'applique. **Deux traitements de titre selon l'écran.** |
| Échelle de texte | — | `text-xs` **447 fois**, `text-sm` **376 fois**. 82 % du produit est écrit en 12 px et 14 px. Voir volet ergonomie. |
| Rayons | — | `rounded-lg` 114, `rounded-full` 37, `rounded-xl` 21, `rounded-2xl` 4. Cohérent dans l'ensemble ; `Card` est en `rounded-xl`, les boutons en `rounded-lg`. |
| Ombres | — | `shadow-sm` 4, `shadow-xl` 3, `shadow-lg` 2, `shadow-2xl` 1, **`shadow-ink` 1** (`DemoScreens.tsx:6`) — cette dernière est une classe de *couleur* d'ombre sans ombre associée dans le même contexte, elle ne produit rien de prévisible. |
| Valeurs arbitraires | — | 47 occurrences, dont `text-[9px]` ×15 et `text-[11px]` ×13. **Une échelle typographique parallèle en dehors de Tailwind.** |
| Hex en dur (hors PDF) | — | `#147085` dupliqué dans `reglages/page.tsx:365` (valeur par défaut du sélecteur de couleur d'atelier), `#11203A` dans `layout.tsx:23` et `opengraph-image.tsx:9`, `#2FB5D2` dans `opengraph-image.tsx:11`. Les PDF ont leur propre palette entièrement en hex (normal, react-pdf ne lit pas Tailwind) mais **elle n'est reliée à aucun jeton** : `#15803d` pour « conforme », `#b91c1c` pour « non conforme ». |

## 2.2 Complétude des composants

| Composant | États | Variantes | Tailles | Doc | Note |
|---|---|---|---|---|---|
| `Button` | défaut, hover, disabled, focus-visible — **pas de `loading`** | 4 (primary / secondary / danger / ghost) | **1 seule** | ❌ | **5/10** |
| `Input` | défaut, focus, error, disabled | type=number traité à part (`ChampDecimal`, excellent) | 1 | ❌ | 7/10 |
| `Select` | défaut, focus | — | 1 | ❌ | **3/10** — pas d'état `error`, **pas d'anneau de focus** |
| `Textarea` | défaut, focus | — | 1 | ❌ | **3/10** — idem |
| `Card` | défaut, `onClick` → `active:bg-gray-50` | — | 1 | ❌ | 5/10 — `onClick` sur un `<div>`, non focusable, non activable au clavier |
| `Badge` | aucun | **aucune** — la couleur est passée en `className` à chaque appel | — | ❌ | **2/10** |
| `Empty` | — | aucune, **pas d'emplacement pour une action** | — | ❌ | **3/10** |
| `Spinner` | — | 1 taille fixe (`h-6 w-6`), `p-8` en dur | — | ❌ | 4/10 |
| `PageTitle` | — | slot `action` | — | ❌ | 6/10 |
| `Modal` | — | — | — | ❌ | à documenter |
| `Toast` | — | — | — | ❌ | à documenter |

**Aucun composant n'est documenté.** Aucun Storybook, aucun fichier de référence, aucun test de
rendu React (0 sur 428 tests, cf. `AUDIT-FONCTIONNEL`).

## 2.3 Anomalies, par gravité

| # | Anomalie | Gravité | Où | Correction |
|---|---|---|---|---|
| D1 | **`Select` et `Textarea` n'ont pas d'anneau de focus** — `focus:outline-none` sans `focus:ring`. Seule la couleur de bordure change (gris → cyan). Sur une tablette d'atelier ou au clavier, **le focus est invisible**. C'est un manquement WCAG 2.4.7 (Focus Visible, niveau AA). | **Critique (a11y)** | `ui.tsx:96, 113` | Ajouter `focus:ring-1 focus:ring-brand` comme sur `Input`. **5 minutes.** |
| D2 | **`Card` cliquable est un `<div onClick>`** — pas de `role`, pas de `tabIndex`, pas de gestion de `Enter`/`Space`. **173 usages.** Toute navigation par carte est inaccessible au clavier et au lecteur d'écran. | **Critique (a11y)** | `ui.tsx:139` | Variante `as="button"` ou envelopper dans un `<Link>` (déjà fait sur le dashboard, pas ailleurs). |
| D3 | **Contraste insuffisant sur la vitrine** : `text-zinc-500` (#71717A) sur `bg-ink` (#11203A) = **3,37:1**, sous le minimum AA de 4,5:1 pour du texte normal. Concerne : la ligne de réassurance sous le CTA principal (« Sans carte bancaire · Sans engagement · Données hébergées en Europe », `page.tsx:85`), la phrase « Un devis signé en plus par mois rembourse l'abonnement » (`:102`), **et tout le pied de page** (`:269`, en `text-xs` par-dessus le marché). | **Élevée (a11y)** | `app/page.tsx` | Remplacer par `text-zinc-400` (#A1A1AA = **6,36:1**, conforme). **10 minutes.** |
| D4 | **429 couleurs d'état en dur contre 9 usages des jetons.** Le vert « conforme » existe en `text-green-600`, `text-green-700`, `text-green-800`, `text-green-900`, `bg-green-50`, `bg-green-100`, `border-green-200`, `border-green-300`, `border-green-600` — **neuf valeurs pour une seule idée.** | Élevée | tout `src/` | Étendre les jetons (`success-50`…`success-900`) et migrer par écran. Chantier d'une journée. |
| D5 | **Deux échelles de gris.** `gray-*` (807) dans l'app, `zinc-*` (49) sur la vitrine. Les deux se touchent visuellement dans le bandeau démo et les pages publiques `/d/`, `/f/`, `/bl/`, `/jt/`. | Élevée | tout `src/` | Choisir `zinc` (plus froid, s'accorde au marine) ou `gray`, et poser un alias de jeton `neutral-*`. |
| D6 | **`Badge` sans variantes.** Chaque appelant écrit sa couleur : le badge « Prêt » vert, « En cours » cyan, « Reçu » gris sont recomposés à la main sur `/jantes`, `/projets`, `/devis`, `/factures`, `/bl`. Une divergence est garantie. | Élevée | `ui.tsx:145` | `<Badge tone="success\|warning\|danger\|info\|neutral">`. **1 h.** |
| D7 | **`Button` n'a pas d'état de chargement.** Les écrans le simulent en passant `disabled={busy}` et en réécrivant le libellé — ou pas du tout. Résultat : sur la fiche projet, appuyer sur « Valider : Poudrage » ne produit aucun retour visuel. | Élevée | `ui.tsx:5` | Prop `loading` avec spinner intégré et libellé conservé. |
| D8 | **`Empty` n'accepte pas d'action.** 23 états vides, tous en texte seul, aucun bouton. Le composant est un `<div>` avec une bordure en pointillés. | Élevée | `ui.tsx:157` | Ajouter `icon` et `action`. Voir volet ergonomie. |
| D9 | **`Wordmark` est dupliqué.** `src/components/Wordmark.tsx` et une copie locale dans `src/app/page.tsx:30-36`. Deux logos à maintenir. | Moyenne | — | Supprimer la copie locale. **2 minutes.** |
| D10 | **75 `<button>` natifs** hors du composant `Button` (contre 126 usages de `Button`). **37 % des boutons du produit échappent au design system** : pas de focus visible garanti, pas de style cohérent, pas de taille de cible garantie. | Moyenne | tout `src/` | Audit écran par écran. |
| D11 | **Formatage des nombres incohérent.** L'écran `/stock` affiche « 3.4 kg », « 12.0 kg », « 40.3 kg » (point décimal anglais) à côté de « 95,88 € » (virgule française) sur la même page. Vérifié à l'écran. | Moyenne | `app/(app)/stock/page.tsx` | Passer les kg par le même helper que les euros (`lib/utils.ts`). |
| D12 | **Émojis utilisés comme icônes.** `⚠️` et `⏳` sur `/stock`, `⏱` sur `/projets`, `▶` et `✓` dans les libellés de bouton de la fiche projet — alors que `lucide-react` est installé et utilisé partout ailleurs. Rendu différent selon l'OS, non lus correctement par les lecteurs d'écran. | Moyenne | plusieurs écrans | Remplacer par des icônes lucide avec `aria-hidden`. |
| D13 | **Échelle typographique parallèle.** `text-[9px]`, `text-[11px]`, `text-[13px]`, `text-[7px]` — 30 occurrences hors échelle. La vitrine (`DemoScreens.tsx`) est la principale coupable, mais `BottomNav` utilise `text-[11px]` pour les libellés de navigation principale. | Moyenne | — | Définir `text-2xs` (11px) dans le thème. |
| D14 | **Aucun jeton de mouvement.** `transition` seule, sans durée ni courbe, 40+ fois. Aucune `prefers-reduced-motion`. | Faible | — | Poser `duration-150 ease-out` par défaut. |

**Ce qui est bien fait, et qui mérite d'être dit** : `ChampDecimal` (`ui.tsx:29-71`) est
exemplaire — la virgule du clavier français gérée, la frappe brute conservée localement, un
commentaire qui explique pourquoi. `BottomNav` respecte `env(safe-area-inset-bottom)`, pose
`aria-current`, `aria-modal`, `aria-haspopup` et des cibles `min-h-[44px]` sur le panneau
« Plus ». Le focus visible est correctement posé sur `Button`, `Sidebar` et `BottomNav`. Ce
n'est pas un produit négligé : c'est un produit dont les bonnes pratiques ne sont appliquées
qu'aux endroits où quelqu'un y a pensé, faute de système qui les impose.

---

# Volet 3 — Ergonomie et prise en main

*Parcours réel de `/demo` dans Chrome le 19/08. La fenêtre du navigateur n'a pas pu être
redimensionnée sous 1920 px (contrainte du poste) : le comportement mobile est établi par
lecture des points de rupture Tailwind et des composants, pas par capture. Tout le reste est
constaté à l'écran.*

## 3.1 Le compte de gestes des trois tâches

### Faire un devis de jantes — **9 gestes**
`Devis` (1) → `+ Nouveau devis` (2) → ouvrir le sélecteur client (3) → choisir (4) →
`+ Jantes` (5) → ajuster diamètre (6) → ajuster dessin/finition (7) → `Enregistrer le
brouillon` (8) → sur la fiche : `Envoyer` (9).

**C'est bon.** Le bloc jantes se remplit tout seul avec un barème par défaut crédible : un appui
sur `+ Jantes` produit « 4 jantes 19″, standard, teinte unie, 126,50 €/jante, 506,00 € HT » avec
la surface calculée (4,4 m²). Chiffrer un jeu prend réellement deux appuis. C'est le meilleur
moment du produit.

**Ce qui l'abîme :**
- Les cinq boutons d'ajout sont `+ m²`, `+ ml`, `+ Jantes`, `+ Prestation`, `+ Libre`. **Un
  nouvel utilisateur ne sait pas ce qu'est « + ml » ni « + Libre ».** Libellés à écrire :
  `+ Surface (m²)`, `+ Longueur (ml)`, `+ Jeu de jantes`, `+ Prestation`, `+ Ligne libre`.
- Les champs `Teinte` et `Réf. constructeur` portent les **valeurs d'exemple en placeholder**
  (« Frozen Grey », « C3Z »). Sur un écran gris clair, un placeholder ressemble à une valeur
  saisie. C'est l'anti-patron classique : un atelier pressé enverra un devis qu'il croit rempli.
- **Le sélecteur de teinte d'origine constructeur — votre différenciateur n°1 — n'est pas
  accessible depuis le devis.** `TeinteOrigineSelecteur` n'est monté que sur `/jantes/new`
  (une seule occurrence dans tout `src/`). Au moment exact où le client demande « c'est
  possible dans la teinte d'origine de ma Golf ? », l'écran ne propose qu'un champ texte libre.
- **Aucun champ véhicule sur la ligne de devis.** La promesse « le second jeu est préchiffré
  tout seul » (`MODULE-JANTES.md` §1) ne fonctionne que depuis `/jantes/new`, pas depuis un
  devis. Deux portes d'entrée pour le même métier, une seule intelligente.
- `Enregistrer le brouillon` est **désactivé sans dire pourquoi**. Il faut deviner qu'il manque
  le client.
- `Supprimer` en rouge est placé **en haut à droite du bloc**, exactement là où l'œil se pose en
  premier, sans confirmation.

### Avancer un projet — **1 geste au scan, 5 par l'écran**
Le scan (`/scan/[qr]`) est effectivement un geste unique. **Mais le QR n'existe qu'à l'écran :**
`AUDIT-FONCTIONNEL` #13 le classe « Coquille » — il n'y a **aucune fiche suiveuse imprimable**,
pas de route `/api/pdf/etiquette`. La légende de l'écran dit pourtant « Imprimez ce QR sur la
fiche suiveuse ». Dans un atelier réel, l'opérateur n'a donc pas de support physique : il doit
passer par l'écran, soit **5 gestes**.

Par l'écran, la fiche projet pose trois problèmes sérieux :

1. **Le premier bloc sous le titre est un pavé rouge d'échec.** Sur `PR-2026-0021`, on lit :
   *« Pas encore certifiable — Aucune mesure d'épaisseur sur ce projet… Aucune fournée clôturée
   avec température relevée… »*. C'est le **certificat de conformité**, une fonction que
   l'écrasante majorité des ateliers Solo à 59 € n'utilisera jamais, et il crie en rouge en
   haut de l'écran le plus consulté du produit, **au-dessus du bouton qui sert à travailler**.
   Il faut le replier par défaut et le remonter seulement si l'atelier a coché « je délivre des
   certificats ».
2. **Deux boutons concurrents, sans hiérarchie utile.** « ▶ Démarrer : Poudrage » (secondaire,
   blanc) et « ✓ Valider : Poudrage » (primaire, teal, plus gros), suivis de trois lignes
   expliquant que valider sans démarrer perd le temps passé. **Le bouton visuellement dominant
   est celui qu'il ne faut pas presser.** Avec des gants, l'opérateur presse le gros. Inverser :
   « Démarrer » en primaire tant qu'aucun chrono ne tourne, « Valider » en secondaire.
3. **Aucun bouton « Facturer ».** `grep "factures/new" projets/[id]/page.tsx` → rien. Depuis un
   projet livré, il n'existe aucun chemin vers sa facture.

### Facturer — **8 gestes, et le mauvais chemin est le seul proposé**
`Factures` (1) → `+ Nouvelle` (2) → sélecteur devis (3) → choisir (4) → `Enregistrer le
brouillon` (5) → fiche (6) → `Émettre` (7) → `Envoyer` (8).

- L'écran ne propose **qu'un seul devis signé** dans la liste. Le chemin réel de la plupart des
  ateliers — facturer les bons de livraison du mois — existe (`facture_recapitulative`) mais
  vit sur `/factures`, pas ici, et rien ne l'annonce.
- Le champ `Type` propose **Solde / Acompte / Libre / Avoir** avec « Solde » par défaut.
  C'est du vocabulaire de comptable posé au deuxième champ d'un formulaire d'artisan.
  Écrire : `Facture (solde du chantier)` · `Facture d'acompte` · `Facture libre (sans devis)` ·
  `Avoir (annulation ou remboursement)`.
- Les 14 prestations s'affichent en **mur de pastilles grises identiques**, et « + Ligne libre »
  est noyé au milieu comme s'il s'agissait d'une quinzième prestation.

## 3.2 Ce qu'un nouvel utilisateur ne comprend pas

| Libellé actuel | Problème | Proposition prête à coller |
|---|---|---|
| `+ ml` | jargon | `+ Longueur (ml)` |
| `+ Libre` | jargon | `+ Ligne libre` |
| Type : `Solde` | jargon comptable en position 2 | `Facture (solde du chantier)` |
| `Poste partagé` (bouton `/projets`) | on ne sait pas ce que ça fait | `Chronomètre d'équipe — plusieurs pièces à la fois` |
| Titre de page `Atelier` sur `/projets` | l'entrée du menu s'appelle « Projets » | Aligner : `Projets en atelier` |
| Titre du tableau de bord = **nom de l'atelier** | ce n'est pas un titre de page | `Aujourd'hui à l'atelier` + nom en sous-titre |
| `Vide` (colonne « À démarrer » du kanban) | mot brut, décourageant | `Rien à démarrer. Les devis signés arrivent ici tout seuls.` |
| `Rien pour l'instant.` (un `Empty` sur 23) | idem | à contextualiser |
| `Réf. constructeur` avec placeholder `C3Z` | ressemble à une valeur | libellé `Réf. constructeur (ex. C3Z)` + placeholder vide |
| `Nature de l'opération` | correct mais austère | garder — l'aide en dessous est très bien écrite |

## 3.3 Les écrans denses et le poste de bureau

**Les trois écrans les plus utilisés au bureau sont plafonnés à 672 px de large.**
`app/(app)/devis/new/page.tsx:6`, `app/(app)/factures/new/page.tsx:7` et
`app/(app)/reglages/page.tsx:175` portent tous `md:max-w-2xl`, alors que la coquille
(`app/(app)/layout.tsx`) s'ouvre correctement jusqu'à `xl:max-w-[1280px]`.

Conséquence constatée à l'écran sur un moniteur 1920 px :
- l'éditeur de devis occupe **une colonne de 672 px au milieu de 1 664 px disponibles** ;
- chaque ligne de devis empile 6 champs sur 3 rangées alors qu'un tableau tiendrait sur une ;
- **la barre d'onglets des Réglages défile horizontalement** avec une flèche `▶`, cachant la
  moitié des onglets — sur un écran qui pourrait tous les afficher.

C'est l'inverse du besoin exprimé : mobile-first à l'atelier, **large au bureau pour la
facturation**. Retirer `md:max-w-2xl` de ces trois écrans est un correctif de trois lignes.

**Autres densités problématiques :**
- La fiche projet enchaîne **12 blocs** sans repli : certificat, boutons d'étape, étapes, temps
  passé, coût main d'œuvre, lot de poudre, poudre & production, surface, couches, date promise,
  teinte constructeur, photos, suivi client. Sur un téléphone, atteindre « Afficher le QR
  atelier » demande un défilement considérable — or c'est l'action d'atelier.
- Le champ `Teinte constructeur d'origine (jantes)` apparaît sur un projet de **profilés de
  fenêtre**. Il devrait être conditionné au parcours jantes.
- Le tableau de bord fait **8 requêtes Supabase séquentielles depuis le navigateur** avant
  d'afficher quoi que ce soit, et montre un spinner plein écran pendant ce temps
  (`dashboard/page.tsx:39-73`). C'est le premier écran de chaque journée.

## 3.4 Les impasses

| # | Impasse | Gravité |
|---|---|---|
| E1 | **Un appui sur le bouton principal ne produit rien du tout.** Constaté : sur la démo, `✓ Valider : Poudrage` → aucun toast, aucune erreur, aucun changement, rien en console. Cause : `avancer()` et `demarrer()` ne lisent jamais l'erreur (`projets/[id]/page.tsx:93` et `:100` — `await supabase.rpc(...)` sans destructuration). **Ce n'est pas un défaut de la démo, c'est un défaut de l'application.** En production, un réseau coupé dans un bâtiment métallique, un abonnement expiré (`ABONNEMENT_REQUIS`) ou un refus RLS produisent exactement la même absence de réaction. L'opérateur appuiera deux fois, ou croira l'étape validée. | **Critique** |
| E2 | **25 écritures Supabase sans aucune gestion d'erreur** dans les composants clients — dont l'envoi d'un devis (`devis/[id]:69`), l'émission d'une facture (`factures/[id]:54`), l'insertion d'une photo de projet (`projets/[id]:110`) et **l'insertion d'une photo de réception (`receptions/[id]:55`)**. Cette dernière est la cause racine identifiée par `AUDIT-FONCTIONNEL` #37 (« 0 photo en base pour 5 réceptions ») : **elle n'est pas corrigée dans le code.** | **Critique** |
| E3 | **Un projet prêt mais non livré cinq jours après la date promise n'apparaît nulle part dans « À faire ».** Constaté : `PR-2026-0022` est affiché en rouge « Promis le 14/08/2026 » sur le kanban, et le tableau de bord n'en dit rien — la requête de retard filtre sur `status in ('en_attente','en_cours')` (`dashboard/page.tsx:44`) et exclut donc `pret`. Deux écrans du même produit, deux vérités. | Élevée |
| E4 | **Le module jantes est totalement absent du tableau de bord.** `JJ-2026-0001` est promis pour demain avec une jante en retouche : ni le bloc « À faire », ni les 4 compteurs n'en portent trace. Le différenciateur n°1 n'existe pas sur l'écran d'accueil. | Élevée |
| E5 | **Le lien public s'affiche en URL brute avec un seul bouton « Copier le lien »** — sur `/jantes/[id]` comme sur `/projets/[id]`. Sur un téléphone, envoyer le bon de prise en charge au garage demande : copier, quitter l'app, ouvrir WhatsApp, choisir le contact, coller, envoyer. **Six gestes pour le document qui protège l'atelier.** Il manque un bouton « Envoyer » (`navigator.share`) et un QR à montrer au client présent au comptoir. | Élevée |
| E6 | **Le statut du dossier jantes propose cinq boutons dont trois sont recalculés automatiquement**, et l'explication est *sous* les boutons. On clique, puis on lit pourquoi ça n'a pas marché. Désactiver « Reçu / En cours / Prêt » et n'ouvrir que « Livré » et « Annulé ». | Moyenne |
| E7 | **Aucune recherche sur `/jantes`.** Deux onglets (En atelier / Livrés), pas de champ. Quand un garage appelle en disant « les jantes de la Golf », il faut faire défiler. L'immatriculation est pourtant normalisée en base exprès. | Moyenne |
| E8 | **La déconnexion est un lien texte au coin des Réglages.** Seul chemin. | Faible |

## 3.5 Rien n'est poussé — la mesure exacte du problème

Le constat était connu. Voici ce qu'il vaut en chiffres :

- La table `notifications` est **écrite une seule fois dans tout `src/`** (`factures/[id]:56`) et
  **lue zéro fois**. Aucun écran ne liste les notifications. Le fil d'information n'existe pas.
- Le bloc « À faire » du tableau de bord couvre **5 sujets sur au moins 12** : projets en retard,
  poudres sous seuil, lots périmés, lots proches de la DLU, factures impayées. Il ignore : les
  jeux de jantes en retard **et le module jantes entier**, les projets prêts non livrés (E3),
  les devis à relancer, les certifications qui expirent, les instruments non étalonnés, les
  bains à renouveler, la balance âgée.
- `AUDIT-FONCTIONNEL` #6 affirme que l'étalonnage des instruments est « remonté au tableau de
  bord ». **Vérification faite : ce n'est pas le cas.** `grep -rl "etalonnage"` ne renvoie que
  `qualite/*`, `reglages`, les PDF et les libs. Le tableau de bord ne le mentionne pas.
- Aucune notification push : `PushManager`, `vapid`, `showNotification` → 0 occurrence.
- Le mode hors ligne ne couvre pas `/scan/[qr]`, l'écran le plus utilisé sans réseau
  (`AUDIT-FONCTIONNEL` #52).

**Le minimum viable pour renverser ça est un mail quotidien.** Un seul, le matin :
« 2 projets en retard · 1 jeu de jantes promis aujourd'hui, 1 jante en retouche · 2 poudres sous
le seuil · 909 € en attente de règlement ». Un cron existe déjà (3 crons actifs, 12 092 succès,
0 échec) et le canal e-mail fonctionne. C'est le chantier de deux jours qui change le plus la
perception du produit.

## 3.6 Le confort en atelier — gants et lumière

| Constat | Mesure | Conséquence |
|---|---|---|
| `text-xs` (12 px) utilisé **447 fois**, `text-sm` (14 px) **376 fois** | 82 % du texte du produit | Sous une lumière de néon, à bout de bras, avec des lunettes de protection, 12 px est illisible. Les valeurs qui comptent — kg restants, m², dates promises — sont massivement en `text-xs`. |
| Cibles tactiles de 44 px : **10 occurrences** dans tout `src/` | contre 126 `Button` | `Button` fait `px-4 py-2.5 text-sm` ≈ **41 px de haut**. Sous la recommandation de 44 px, et très en dessous de ce qu'exige un doigt ganté (56 px serait raisonnable pour les actions d'atelier). |
| Libellés de la barre de navigation basse en `text-[11px]` | `BottomNav.tsx:47` | 11 px sur la navigation principale mobile. |
| `/jantes` est **derrière le bouton « Plus »** sur mobile | `BottomNav.tsx:19` | Le module différenciant est à 2 gestes sur téléphone (Plus → Jantes) alors qu'il est en position 4 sur la barre latérale de bureau. Pour un atelier de jantes, c'est l'écran principal. |
| `/scan` n'est ni dans la barre basse ni dans « Plus » | — | L'action la plus fréquente en atelier n'a pas d'entrée de navigation : on y accède uniquement en scannant un QR… qui n'est pas imprimable (#13). |

---

# Volet 4 — Rapport de lancement marketing

## 4.1 Résumé

**Il n'y a rien à mesurer, et c'est le constat lui-même.** Zéro visiteur identifiable, zéro lead,
zéro client, zéro euro encaissé. Le produit n'a jamais été mis en vente. Ce rapport n'analyse
donc pas des performances : il établit **ce qui est instrumenté, ce qui ne l'est pas, et ce
qu'il faut poser avant le premier visiteur** — parce que ce qui n'est pas mesuré au jour 1 est
perdu pour toujours.

## 4.2 État de l'instrumentation

### Ce qui existe

`analytics_events` (Supabase, table maison, premier événement le 08/07/2026) :

| Colonne | Type |
|---|---|
| `event` | text, non nul |
| `props` | jsonb, non nul |
| `path` | text |
| `referrer` | text |
| `user_id` | uuid, nul si anonyme |
| `created_at` | timestamptz |

**Contenu réel au 19/08/2026 — 21 lignes en six semaines :**

| Événement | Occurrences | `user_id` renseigné | `referrer` renseigné | Dernier |
|---|---|---|---|---|
| `visit_landing` | 6 | 0 | **0** | 18/08 |
| `devis_sent` | 5 | 1 | 0 | 18/08 |
| `devis_signed` | 4 | 1 | 0 | 18/08 |
| `signup_start` | 2 | 0 | 0 | 13/08 |
| `bl_signed` | 2 | 1 | 0 | 18/08 |
| `atelier_created` | 1 | 1 | 0 | 13/08 |
| `test_audit` | 1 | 0 | 0 | 08/07 |
| **Total** | **21** | | | |

Ces 21 lignes sont **votre propre activité de développement et de recette**, pas du trafic.

`leads` : `id`, `nom`, `email`, `telephone`, `atelier_nom`, `message`, `source`, `utm` (jsonb),
`status`, `created_at`. **0 ligne.** Et surtout : `grep -rn "leads" src/` ne renvoie qu'un
commentaire dans `lib/export/donnees.ts`. **Aucun code n'écrit jamais dans cette table.**
Elle est morte à la naissance — non pas faute de trafic, mais **parce qu'il n'existe aucun
formulaire de contact sur le site**.

### Ce qui n'existe pas

| # | Manque | Gravité | Détail |
|---|---|---|---|
| M1 | **Aucun formulaire de capture.** Les deux seuls appels à l'action sont « Essai gratuit 30 jours » (création de compte complète) et « Visiter la démo ». | **Critique** | Un exploitant d'atelier de 55 ans qui découvre le produit à 21 h ne crée pas un compte. Il veut être rappelé. **COOCKPIT n'a qu'un seul CTA sur tout son site : « Demander une démo ».** Ils ont raison : dans ce métier, la vente se fait au téléphone. La table `leads` est prête, avec sa colonne `utm`. Il manque le formulaire. |
| M2 | **Aucun identifiant de visiteur.** `analytics_events` n'a ni `session_id`, ni `visitor_id`, ni cookie first-party. `user_id` est nul pour tout ce qui précède la connexion. | **Critique** | **Le tunnel `visit_landing → signup_start → signup_done` est structurellement incalculable.** On peut compter des événements, jamais des personnes, jamais un taux de conversion. C'est le seul chiffre qui compte au lancement. |
| M3 | **Aucune capture d'UTM.** `track()` (`lib/track.ts`) enregistre `path` et `referrer`, jamais `window.location.search`. | Élevée | Impossible d'attribuer une visite à une source. Le premier euro de publicité sera dépensé à l'aveugle. |
| M4 | **`referrer` vide sur 21/21 lignes.** | Élevée | Soit personne n'est jamais arrivé d'un lien externe (le plus probable), soit la capture ne fonctionne pas. À revérifier au premier vrai visiteur. |
| M5 | **Aucun outil tiers.** `grep gtag\|googletagmanager\|plausible\|posthog\|@vercel/analytics\|matomo` → **0 résultat.** Aucune dépendance analytics dans `package.json`. | Élevée | Pas de Search Console (impossible sans domaine propre), pas de Core Web Vitals réels, pas de rapport de sources. |
| M6 | **La démo n'est pas instrumentée.** `/demo` pose une session et redirige vers `/dashboard`. Aucun événement. | Élevée | La démo est votre meilleur argument de vente et **vous ne saurez jamais combien de personnes l'ouvrent, quels écrans elles regardent, ni où elles abandonnent.** C'est l'information la plus précieuse des trois premiers mois. |
| M7 | **`analytics_events` est ouverte en écriture anonyme sans limite** (`AUDIT-FONCTIONNEL` S2 : policy `INSERT` `anon` avec `with_check = true`). | Moyenne | N'importe qui peut y injecter des lignes via l'API REST. Le jour où vous aurez des chiffres, ils seront falsifiables. À borner avant d'y croire. |
| M8 | **Aucun événement de facturation.** `subscription_started`, `trial_ended`, `payment_failed` n'existent pas. Stripe n'est pas configuré en production. | Moyenne | Aucun MRR mesurable, même à l'arrivée du premier client payant. |

## 4.3 Les indicateurs à suivre dès le premier visiteur

Ne pas construire un tableau de bord. Construire **six chiffres**, dans l'ordre du tunnel :

| # | Indicateur | Définition | Objectif à 3 mois | Comment |
|---|---|---|---|---|
| 1 | **Visiteurs uniques** | `count(distinct visitor_id)` | 300 / mois | cookie first-party + `visitor_id` sur `analytics_events` |
| 2 | **Taux d'ouverture de démo** | `demo_opened / visit_landing` | **> 15 %** | événement `demo_opened` sur `/demo` |
| 3 | **Profondeur de démo** | écrans distincts vus par session de démo | **> 4** | `TrackView` sur chaque écran quand `atelier.demo` |
| 4 | **Taux de lead** | `(lead_submitted + signup_start) / visitors` | **> 4 %** | formulaire + `leads` |
| 5 | **Taux d'activation** | ateliers ayant envoyé un devis / ateliers créés | **> 50 %** | déjà mesurable (`atelier_created` vs `devis_sent`) |
| 6 | **Conversion payante** | abonnements actifs / essais démarrés | **> 25 %** | webhook Stripe → `subscription_started` |

**Objectifs de lancement raisonnables, à 6 mois, pour un produit sans marque et sans trafic :**
300 à 800 visites organiques par mois (essentiellement sur les requêtes jantes et prix),
20 à 40 leads, 10 à 20 essais, **3 à 8 ateliers payants**. À 89 € HT/mois, cela fait 270 à 700 €
de MRR — anecdotique en soi. **La vraie valeur est ailleurs** : chacun de ces ateliers achète de
la poudre, et c'est là que se fait la marge (le cahier des charges le dit déjà, et c'est le bon
raisonnement). Il faut donc mesurer un septième indicateur, absent de tout : **combien d'ateliers
Thermogestion sont devenus clients poudre**.

## 4.4 Actions marketing, par effet

| | Effort faible | Effort élevé |
|---|---|---|
| **Effet élevé** | **À faire d'abord** — formulaire de rappel + `visitor_id` + UTM + instrumentation de la démo + `robots.txt`/`sitemap` + domaine propre + jantes sur la page d'accueil | **Sprint suivant** — page `/logiciel-renovation-jantes`, page comparatif prix, mail quotidien, fiche suiveuse imprimable |
| **Effet faible** | Si le temps le permet — `llms.txt`, `twitter:card`, page « À propos » | **À dé-prioriser** — publicité payante (aucun tunnel mesurable aujourd'hui), réseaux sociaux, multi-langue |

**Le canal le plus rentable n'est pas dans ce tableau et n'a rien à voir avec le SEO** :
vous avez déjà une base de clients poudre chez Thermopoudre. Un e-mail à ceux qui rénovent des
jantes, avec une capture d'écran du bon de prise en charge signé et la phrase « on l'a fait pour
vous, dites-moi ce qui manque », vaudra plus que six mois de référencement. Et il alimente le
seul contenu qui vous manque vraiment : **des témoignages nommés**, que COOCKPIT affiche et que
vous n'avez pas.

---

# Volet transversal — Le positionnement, et l'écart promesse / réalité

## 5.1 Le problème, en une phrase

**Le produit est le seul du marché à traiter la rénovation de jantes, et la page d'accueil vend
un outil générique de thermolaquage — sur une requête que le concurrent domine déjà.**

Le mot « jante » apparaît **une fois** dans toute la page d'accueil, au milieu de la réponse à
la première question de la FAQ. La maquette téléphone du héros affiche pourtant
« PR-2026-0042 · Jantes BMW 19″ · RAL 7016 satiné » : **le sujet est dans l'image et absent du
texte.**

Pendant ce temps, le produit contient : chiffrage au pouce adossé à la grille du client, coefficients
de dessin et de finition, teinte d'origine constructeur mémorisée par véhicule et reliée au
catalogue Thermopoudre, reprise automatique du dernier jeu d'un véhicule, parcours de production
dédié (dépose pneu → décapage → dévoilage → sablage → laquage → cuisson → diamantage CNC →
vernis → repose pneu → équilibrage), suivi jante par jante avec statut déduit en base, bon de
prise en charge public signable avec photos **par jante**, PDF opposable, opérations mécaniques
quantifiées au nombre de jantes concernées, traçabilité TPMS. 73 tests dédiés. Deux dossiers
réalistes déjà peuplés dans la démo.

## 5.2 Pour quelle cible, exactement

**Ce n'est pas la même cible que le thermolaqueur de portails.** Le rénovateur de jantes est :
un garage indépendant, un centre auto, une concession, un préparateur, ou un atelier
spécialisé « jantes alu ». Il ne cherche pas « logiciel thermolaquage » — **il ne sait
probablement pas que son métier s'appelle du thermolaquage**. Il cherche « logiciel rénovation
jantes », « logiciel atelier jantes alu », ou rien du tout.

Ses trois douleurs, dans l'ordre :
1. **Le litige.** « Cette jante était déjà voilée quand je vous l'ai déposée. » « Vous m'avez
   cassé un capteur TPMS. » Un capteur coûte 40 à 120 €, et c'est le conflit le plus fréquent
   et le plus cher du métier. **Vous avez le seul document qui le règle.**
2. **La teinte.** Le client dit « la teinte d'origine de ma Golf 8 », pas « RAL 7016 ».
   **Thermopoudre est le seul distributeur français à proposer toutes les teintes d'origine
   constructeur** — c'est un avantage que personne ne peut copier.
3. **Le délai.** Le garage a immobilisé une voiture. « C'est prêt quand ? » se pose tous les
   jours. Le lien de suivi client répond, et c'est le critère de choix du garage.

## 5.3 Ce que la page d'accueil doit dire — texte prêt à coller

**Recommandation de structure : deux portes d'entrée, pas une.** La page d'accueil garde le
thermolaquage comme sujet principal (c'est le marché le plus large et c'est votre métier), et
gagne **une section jantes visible et un lien vers une page dédiée** qui, elle, porte tout le
poids SEO sur la requête libre.

### A. Kicker et titre du héros

*Actuel :*
> LE LOGICIEL DES ATELIERS DE THERMOLAQUAGE
> Du devis signé à la pièce livrée, sans paperasse.

*Proposé :*
```
LOGICIEL D'ATELIER — THERMOLAQUAGE ET RÉNOVATION DE JANTES

Du devis signé à la pièce livrée,
sans paperasse.
```
*(Le `h1` conserve le slogan — il est bon. Le kicker prend la charge sémantique. Ajouter
« rénovation de jantes » au kicker coûte quatre mots et ouvre une requête entière.)*

### B. Sous-titre du héros

*Actuel :*
> Devis au m² en 2 minutes, signature en ligne, suivi de production par QR code et stock de poudre qui se décompte tout seul. Pensé pour le métier, utilisable avec des gants.

*Proposé :*
```
Devis au m² — ou au pouce pour un jeu de jantes — en deux minutes. Signature en
ligne, suivi de production, stock de poudre décompté à la cuisson. Pensé pour le
métier, utilisable avec des gants.
```

### C. Nouvelle section, à insérer **juste après le héros**, avant « Le produit »

*(fond `bg-ink`, pour reprendre le traitement de la section « Exclusif Thermopoudre »)*

```
RÉNOVATION DE JANTES — CE QUE PERSONNE D'AUTRE NE FAIT

Un jeu de jantes chiffré en deux appuis, et une roue qui ne se perd plus.

Aucun autre logiciel ne connaît la jante. Ni le prix au pouce, ni le coefficient
d'une multibranches, ni la teinte d'origine du constructeur, ni le capteur TPMS
qu'on vous reprochera d'avoir cassé.

・ Chiffrage au pouce — 17, 19, 21 pouces, dessin, finition, diamantage. Un appui
  sur « Jeu de jantes » et le devis est fait, au tarif que vous avez négocié avec
  ce garage.

・ La teinte d'origine constructeur — vous cherchez « Golf 8 GTI », vous trouvez
  la référence du constructeur. Thermopoudre est le seul distributeur en France à
  toutes les proposer, et elles sont dans le logiciel.

・ Le bon de prise en charge, photographié et signé — jante par jante, avant
  démontage. « Votre jante avant droite était déjà voilée » se démontre, avec la
  photo et la signature du garage. C'est le document qui vous protège.

・ Roue par roue jusqu'au bout — trois jantes prêtes et une en retouche, le jeu
  n'est pas prêt. Votre client ne se déplace pas pour rien.

・ Dévoilage, redressage, soudure, TPMS, équilibrage — comptés au nombre de jantes
  concernées. Une seule jante voilée sur quatre se facture une, pas quatre.

[ Voir un dossier jantes en démo — sans inscription ]   [ En savoir plus → ]
```

*Le premier bouton pointe directement sur `/demo` puis `/jantes/d0000000-…-b1`, pas sur le
tableau de bord. Le prospect doit atterrir sur le meilleur écran du produit, pas sur le plus
vide.*

### D. FAQ — trois questions à ajouter (et à baliser en `FAQPage`)

```
Q. Ça gère la rénovation de jantes ?
R. C'est le seul logiciel du marché qui la gère vraiment. Chiffrage au pouce avec
   coefficient de dessin et de finition, teinte d'origine constructeur mémorisée par
   véhicule, suivi roue par roue, opérations mécaniques comptées à la jante, et un bon
   de prise en charge photographié et signé par le garage avant démontage. Le tarif
   par défaut va de 70 € HT pour une jante de moins de 17 pouces à 130 € HT au-delà
   de 21 pouces, et vous ajustez tout.

Q. Combien ça coûte, par rapport à un ERP de thermolaquage ?
R. 59 € HT par mois en Solo, 89 € HT en Atelier, sans mise en route et sans engagement.
   Les ERP métier du secteur demandent couramment 5 000 € de mise en route et
   1 000 € par mois : c'est justifié pour un sous-traitant industriel de trente
   personnes, pas pour un atelier de trois.

Q. Et si mon client conteste un choc ou un capteur cassé ?
R. Le bon de prise en charge est signé en ligne par le garage, avant démontage, avec
   une photo par jante et l'état constaté roue par roue. Il est horodaté, l'adresse IP
   du signataire est conservée, et il est téléchargeable en PDF. C'est le document qui
   règle le litige le plus fréquent et le plus cher du métier.
```

## 5.4 Les promesses de la vitrine confrontées au produit réel

*C'est la partie qui coûte le plus cher : une promesse non tenue en démonstration détruit la
confiance plus sûrement qu'une promesse absente.*

| # | Ce que la vitrine promet | Réalité (`AUDIT-FONCTIONNEL`) | Verdict |
|---|---|---|---|
| P1 | « **QR sur la fiche suiveuse** : un scan valide l'étape » *(`page.tsx:9`)* | **#13 « Coquille ».** Le QR fonctionne à l'écran, `/scan/[qr]` fonctionne, mais **il n'existe aucune fiche suiveuse imprimable** — pas de route `/api/pdf/etiquette`. L'écran dit lui-même « Imprimez ce QR sur la fiche suiveuse » sans que ce document existe. | **Promesse non tenue.** À corriger dans le texte **ou** à livrer. Le livrer est mieux : c'est le point 4 du « avis franc » de `AUDIT-FONCTIONNEL`. |
| P2 | « **alerte si la date promise approche** » *(`page.tsx:9`)* | Aucune alerte poussée n'existe. Ni push, ni e-mail, ni SMS. L'écran affiche du rouge **si on l'ouvre**. Et un projet prêt-non-livré en retard n'apparaît même pas dans « À faire » (E3). | **Promesse non tenue.** Le mot « alerte » implique quelque chose qui vient à vous. |
| P3 | « **réappro en 1 clic sur thermopoudre.fr** » *(`page.tsx:10`)* et « un clic la recommande » *(`:180`)* | **#34 : la chaîne est codée et n'a jamais été exécutée.** 1 commande en base, statut `panier`, 0 notification émise. L'écran `/stock` propose bien « Mettre au panier de réapprovisionnement ». | **Non vérifiée.** À recetter de bout en bout **avant** le premier prospect, ou reformuler en « bon de commande prêt à envoyer ». |
| P4 | « **expédiées le jour même avant midi** » *(`:181`)* | Engagement logistique Thermopoudre, hors périmètre logiciel. | Vérifier que c'est tenable, sinon retirer — c'est une promesse contractuelle. |
| P5 | « **Paiement en ligne des factures** » (plan Atelier, `:28`) | **#25 : opérationnel en code, mort en production.** `STRIPE_SECRET_KEY` absente, le webhook répond `{"error":"Stripe non configuré."}`. | **Fonction vendue et indisponible.** Bloquant commercial. |
| P6 | « **Relances automatiques devis & factures** » (plan Atelier, `:28`) | **#18/#26 : le moteur tourne** (cron, 41 exécutions, 0 échec) **mais l'atelier ne peut ni les voir, ni les couper** : `relances_actives` et `relance_count` ont 0 occurrence dans `src/`. La cadence réelle est J+3 puis tous les 3 jours (max 3), pas celle annoncée au cahier des charges. | Partiellement tenue. Un atelier qui ne peut pas couper une relance envoyée en son nom finira par la découvrir chez un client. |
| P7 | « **Sans engagement, résiliable en 1 clic** » (FAQ) | Le portail Stripe existe (`/api/billing/portal`) mais Stripe n'est pas configuré (#61). **Le 13/09/2026, ThermoTest passe en lecture seule et « Souscrire » renvoie HTTP 500.** | **Promesse intenable à ce jour.** Cf. R7 — décision à prendre avant le 12/09. |
| P8 | « **Utilisateurs illimités (équipe)** » (plan Atelier) | Le multi-utilisateur existe (`users`, `invitations`), le multi-sites non (#55). | Tenue. |
| P9 | « **Vos données vous appartiennent, exportables à tout moment** » (FAQ) | **#57 : opérationnel**, 38 tables exportées, RLS testée depuis un client anonyme. **Réserve** : les fichiers binaires (photos) ne sont pas dans l'archive, seuls leurs chemins. | Tenue, avec une réserve à mentionner. |
| P10 | « **Hébergées en Europe, chiffrées, isolées par atelier** » (FAQ) | Supabase `eu-west-3`, RLS sur 42/42 tables, vues en `security_invoker`. | **Tenue, et c'est solide.** À mettre plus en avant, pas moins. |
| P11 | « **En production en 10 minutes** » (`:157`) | La checklist de démarrage est réelle et se coche sur la donnée, pas sur l'écran (#58). Mais elle ne renvoie pas vers `/import` — or un atelier qui migre depuis un tableur en a besoin à cet instant précis. | Tenue, améliorable. |
| P12 | « **Devis en 2 minutes** » | Vérifié à l'écran : 8 gestes pour un devis de jantes complet. **C'est vrai.** | **Tenue.** |
| P13 | « **−20 % à vie** pour un client Thermopoudre » | Chiffre posé en juillet, **jamais confirmé par Alexis** (`CAHIER-DES-CHARGES-MASTER` §6). 214 €/an et par client sur le plan Atelier. | **À trancher.** Un tarif affiché engage. |

**Trois de ces promesses (P1, P2, P5) portent sur des fonctions que le prospect testera en
démonstration dans les cinq premières minutes.** Ce sont elles qu'il faut fermer en premier.

---

# Les dix choses à faire, dans l'ordre

*Arbitrage entre les quatre volets. Le critère est l'effet sur la vente et sur l'usage quotidien,
pas la facilité.*

| # | Action | Volet | Effort | Pourquoi maintenant |
|---|---|---|---|---|
| **1** | **Trancher Stripe avant le 12/09/2026** | Marketing / produit | 1 h ou une décision | Dans 24 jours, le seul atelier réel passe en lecture seule et le bouton « Souscrire » répond HTTP 500. Aucun autre point de ce rapport n'a d'importance si le produit se bloque tout seul. Trois variables d'environnement, ou une date repoussée. |
| **2** | **Acheter `thermogestion.fr` et poser `NEXT_PUBLIC_SITE_URL`** | SEO | 30 min | Douze euros. **Tout ce qui suit en dépend** : aucun contenu ne doit être publié sur un `.vercel.app`, et chaque devis envoyé porte aujourd'hui cette adresse. |
| **3** | **Débloquer le crawl** — matcher du middleware, `robots.ts`, `sitemap.ts`, sortir `/` de l'auth | SEO / perf | 1 h | `robots.txt` et `sitemap.xml` redirigent vers `/login`. Le site est invisible **et** non cacheable. Une heure ferme les deux. |
| **4** | **Mettre les jantes sur la page d'accueil** | Positionnement | 2 h | Texte prêt à coller au §5.3. C'est le seul avantage que personne ne peut copier, il est livré et démontrable, et il n'est écrit nulle part. Le chantier le moins cher et le plus rentable du document — et il n'a toujours pas bougé depuis le lot 5. |
| **5** | **Poser un formulaire « Être rappelé » et remplir la table `leads`** | Marketing | 3 h | Zéro capture aujourd'hui. Le concurrent n'a **que** ce CTA, parce que dans ce métier la vente se fait au téléphone. Ajouter au passage `visitor_id`, UTM et l'instrumentation de la démo : sans ça, aucun chiffre des trois premiers mois ne voudra dire quoi que ce soit. |
| **6** | **Remonter les erreurs des 25 écritures muettes** | Ergonomie | 4 h | Constaté à l'écran : le bouton principal de la fiche projet ne dit rien quand il échoue. C'est aussi la cause racine des 5 réceptions sans photo (#37), **toujours présente dans le code**. Un logiciel d'atelier qui échoue en silence perd la confiance en une semaine. |
| **7** | **Publier `/logiciel-renovation-jantes`** | SEO | 1 journée | Zéro concurrence sur la requête, produit livré, cible identifiée. C'est l'unique actif SEO qui peut classer vite. À faire après 2, 3 et 4, jamais avant. |
| **8** | **Le mail quotidien de 8 h** | Ergonomie | 2 jours | Le cron et le canal e-mail existent et tournent sans échec. Sept lignes de texte transforment un outil qu'on ouvre quand on y pense en outil qu'on ouvre tous les matins. C'est la première cause d'abandon à trois semaines. |
| **9** | **La fiche suiveuse A5 imprimable** | Produit / promesse | 2 jours | La vitrine promet « un scan valide l'étape », le QR n'a aucun support physique. C'est le dernier des cinq chantiers du « avis franc » de `AUDIT-FONCTIONNEL`, et il ferme la promesse P1. |
| **10** | **Le lot de corrections d'ergonomie et de design** | Design / UX | 1 journée | Toutes petites, toutes visibles : anneau de focus sur `Select` et `Textarea` (D1), contraste du pied de page (D3), `md:max-w-2xl` retiré des trois écrans de bureau (§3.3), certificat replié sur la fiche projet, « Démarrer » en primaire, libellés `+ ml` / `+ Libre` / `Solde` réécrits, `Vide` remplacé, jantes ajoutées au bloc « À faire » et à la barre de navigation mobile, formatage des kg en virgule. |

**Ce que je ne ferais pas maintenant** : la refonte des jetons sémantiques (429 couleurs en dur —
vrai problème de dette, effet nul sur la vente), le silo de guides SEO, la publicité payante
(aucun tunnel mesurable), le multi-langue, les réseaux sociaux.

---

# Synthèse

## Les trois constats les plus importants

**1. Le site n'est pas indexable, et le mot-clé principal est déjà pris.**
`robots.txt` et `sitemap.xml` répondent `307 → /login` à cause du matcher du middleware ; il
n'y a pas de domaine propre, pas de donnée structurée, une seule page indexable, et la page
d'accueil n'est jamais mise en cache parce qu'elle appelle l'authentification Supabase avant de
s'afficher. Et sur « logiciel thermolaquage », **COOCKPIT Thermolaquage occupe la totalité de la
première page** avec un silo de contenu, des logos clients et des témoignages nommés. L'hypothèse
d'un marché vide était fausse — mais leur tarif (4 990 € de mise en route + 980 €/mois) laisse
tout le segment artisan libre, et **la rénovation de jantes est réellement vierge**.

**2. Le seul avantage inimitable du produit est invisible.**
Le module jantes est complet, testé (73 tests), peuplé dans la démonstration, adossé au seul
catalogue de teintes d'origine constructeur de France — et le mot « jante » apparaît **une fois**
dans la page d'accueil, dans une réponse de FAQ. La maquette du héros montre pourtant un dossier
de jantes BMW. Le sujet est dans l'image et absent du texte. Pendant ce temps, la page se bat
sur une requête tenue par un concurrent mieux référencé, avec des arguments qu'il annonce mot
pour mot.

**3. Trois promesses de la vitrine tombent dans les cinq premières minutes de démonstration.**
« Un scan valide l'étape » — le QR n'a aucune fiche suiveuse à imprimer (#13). « Alerte si la
date promise approche » — rien n'est jamais poussé, la table `notifications` est écrite une fois
et lue zéro fois, et un projet prêt cinq jours après sa date promise n'apparaît même pas dans
« À faire ». « Paiement en ligne des factures » — Stripe n'est pas configuré en production, et
le 13 septembre le seul atelier réel se retrouvera bloqué sans moyen de payer. À quoi s'ajoute
un défaut d'exécution : **le bouton principal de la fiche projet ne dit rien quand il échoue**,
parce que 25 écritures Supabase ne lisent jamais leur erreur — le même défaut qui a fait perdre
les photos de cinq réceptions.

## Si je n'avais qu'une journée

Le matin, dans l'ordre, sans rien y ajouter :
1. **Trancher Stripe** (une décision, pas du code).
2. **Acheter `thermogestion.fr`** et poser la variable.
3. **Corriger le matcher du middleware**, créer `robots.ts` et `sitemap.ts`, sortir `/` de
   l'authentification.

L'après-midi, une seule chose : **réécrire la page d'accueil pour qu'elle parle de jantes.**
Le kicker, le sous-titre du héros, la section dédiée et les trois questions de FAQ sont écrits
au §5.3 de ce rapport, prêts à coller. Ajouter les trois blocs JSON-LD dans la foulée.

Ça ne fait pas de trafic le lendemain. Ça fait que le jour où il y en a, il arrive quelque part,
et qu'il arrive sur la seule chose que personne d'autre ne vend.

## Mon avis franc sur la capacité de ce produit à se vendre en l'état

**En l'état, il ne peut pas se vendre — pour des raisons qui n'ont presque rien à voir avec le
produit.**

Le produit, lui, est bon. Meilleur que ce à quoi je m'attendais. Le module jantes est un vrai
travail de métier : la décision de ne pas facturer une opération non déclarée plutôt que de la
mettre à zéro, celle de n'imprimer la référence constructeur que si la teinte est bien celle
d'origine, celle de ne pas déclarer un jeu « prêt » tant qu'une roue est en retouche — ce sont
des décisions qu'on ne prend qu'en connaissant le métier. La microcopie de l'écran jantes
(« Faites-le signer **avant** de démonter », « une seule jante voilée sur quatre se facture 1,
pas 4 ») est meilleure que celle de la plupart des SaaS français que je vois. L'ingénierie de
sécurité — RLS sur 42 tables, verdicts recalculés en base, verrous attaqués depuis un client
PostgREST externe à chaque exécution des tests — est très au-dessus de la moyenne pour un
produit de cette taille. Ce n'est pas un logiciel « pensé par un développeur ». C'est un logiciel
pensé par quelqu'un du métier, **et emballé par un développeur**.

Le problème est là. Ce qui manque est entièrement dans la couche de vente et dans la boucle de
retour :

- **Personne ne peut le trouver** (volet 1) ;
- **celui qui le trouve ne comprend pas ce qu'il a d'unique** (volet 5) ;
- **celui qui essaie tombe sur trois promesses qui ne se vérifient pas** (P1, P2, P5) ;
- **celui qui s'abonne ne peut pas payer** (#61) ;
- **et celui qui l'adopte n'en entend plus jamais parler**, parce que rien n'est jamais poussé —
  ce qui est, d'expérience, la première cause d'abandon d'un outil d'atelier à trois semaines.

Aucun de ces cinq points n'est un chantier de refonte. Les deux premiers se règlent en une
journée. Le troisième demande une semaine (la fiche suiveuse et le mail quotidien). Le quatrième
est une décision d'une heure. Le cinquième est déjà à moitié construit — le cron tourne, le
canal e-mail marche, il manque le contenu du message.

**Ma conviction :** avec les quatre premiers points de la liste des dix faits — Stripe, domaine,
crawl, jantes sur la page d'accueil — ce produit est vendable. Pas à grande échelle, pas à
COOCKPIT sur son terrain, mais à des ateliers de jantes qui n'ont **aucune alternative** et à
des laqueurs artisans pour qui un ERP à 980 €/mois n'existe pas. Trois à huit clients à six mois
est un objectif honnête, et ce n'est pas la bonne mesure du succès : chacun d'eux est un client
poudre, et c'est là qu'est la marge. Le logiciel n'a pas besoin d'être rentable seul. Il a
besoin d'être trouvé, compris, et de tenir ce qu'il annonce le jour de la démonstration.

**Et une chose que je dirais quand même :** ne publiez pas de contenu SEO avant d'avoir un
témoignage. COOCKPIT en affiche deux, nommés, avec l'entreprise et la fonction. Vous avez une
base de clients poudre qui rénovent des jantes. Un seul atelier qui accepte de dire « le bon de
prise en charge m'a évité une engueulade de 400 € » vaut plus que les vingt-cinq requêtes du
tableau de mots-clés.

---

# Annotations — lot 9 technique (19/08/2026, fin de journée)

*Ajoutées après exécution des correctifs qui relèvent du code. Ne couvre pas le volet contenu et
positionnement (§1.2, §5.3), traité en parallèle et annoté séparément. Détail et preuves :
`RECETTE-LOT9.md`. Déployé en production, `npm test` vert (445 tests), `npx next build` sans
erreur.*

## Volet 1 — SEO technique

| Constat | État | Note |
|---|---|---|
| **T1** `/robots.txt` → 307 vers `/login` | **corrigé** | Matcher du middleware corrigé + `src/app/robots.ts`. Vérifié : HTTP 200, `x-vercel-cache: PRERENDER`. |
| **T2** `/sitemap.xml` → 307 | **corrigé** | `src/app/sitemap.ts`, statique, suit `NEXT_PUBLIC_SITE_URL`. |
| **T3** aucun domaine propre | **ouvert — Alexis** | Rien à recoder le jour venu : `robots`, `sitemap`, `llms.txt` et les JSON-LD lisent tous `NEXT_PUBLIC_SITE_URL`. |
| **T4** aucune donnée structurée | **corrigé** | `src/components/JsonLd.tsx` : `Organization` + `SoftwareApplication` avec les deux `Offer`, montés dans le layout. `faqJsonLd()` fourni et monté sur l'accueil. Vérifié en production. |
| **T5** page d'accueil jamais mise en cache | **partiellement corrigé** | Le middleware n'appelle plus `supabase.auth.getUser()` sur les chemins publics (la redirection « déjà connecté » repose sur la présence d'un cookie, sans aller-retour réseau, et n'accorde aucun accès). **Mais `/` reste dynamique** parce que `src/app/page.tsx` fait `await searchParams` — trois lignes à changer dans un fichier qui appartient à l'agent contenu, composant de remplacement livré (`AvisDemoIndisponible.tsx`), diff dans `RECETTE-LOT9.md` §1. Repère : `/legal/mentions`, statique, répond en 130 ms contre 280 ms pour `/`. |
| **T6** une seule page indexable | **corrigé côté contenu** | Trois pages de destination livrées par l'agent contenu et déclarées au plan de site. |
| **T7** pas de `description` sur les pages légales | **corrigé** | Les trois en ont une. |
| **T8** pas de `canonical` | **corrigé** | `alternates.canonical: "./"` — canonique par page, vérifiée sur `/legal/mentions`. Le `hreflang` reste sans objet : la vitrine est mono-langue. |
| **T9** pas de `twitter:card` | **corrigé** | `twitter` + `openGraph` explicites dans le layout. |
| **T10** aucun `llms.txt` | **corrigé** | `src/app/llms.txt/route.ts`, statique, contenu repris par l'agent contenu. |
| — | **ajouté** | `X-Robots-Tag: noindex, nofollow, noarchive` sur `/d/ /s/ /f/ /bl/ /rc/ /jt/` : ces chemins portent des documents de clients. Volontairement **pas** interdits dans `robots.txt` — un robot doit pouvoir lire la page pour voir l'en-tête. |

## Volet 2 — Design system

| # | État | Note |
|---|---|---|
| **D1** focus invisible sur `Select`/`Textarea` | **corrigé** | `focus:ring-1 focus:ring-brand`, plus `error` et `aria-invalid` sur les deux. |
| **D2** `Card` cliquable non accessible | **corrigé** | `Card` rend un `<button>` dès qu'un `onClick` est fourni (focus visible, clavier, `ariaLabel`). |
| **D3** contraste 3,37:1 sur la vitrine | **ouvert — agent contenu** | Le pied de page et la ligne de réassurance vivent dans `src/app/page.tsx`. Corrigé partout ailleurs (`FormulaireRappel`). `text-zinc-500` → `text-zinc-400`. |
| **D4** 429 couleurs d'état en dur | **partiel, assumé** | Paliers 50/200/700 ajoutés aux jetons `success`/`warning`/`danger` ; migration faite sur les écrans touchés. Le reste est de la dette pure, que l'audit lui-même déconseille de traiter maintenant. |
| **D5** deux échelles de gris | **ouvert, assumé** | 793 `gray` contre 195 `zinc`. Décision produit avant chantier. |
| **D6** `Badge` sans variantes | **corrigé** | `tone="success\|warning\|danger\|info\|neutral"`. |
| **D7** `Button` sans état de chargement | **corrigé** | Prop `loading` : libellé conservé, `aria-busy`, anneau. |
| **D8** `Empty` sans action | **corrigé** | `icon` + `action`, posés sur `/projets`, `/stock`, `/jantes`. |
| **D9** `Wordmark` dupliqué | **ouvert — agent contenu** | La copie est dans `src/app/page.tsx`. |
| **D10** 75 `<button>` natifs | **partiel** | Ceux touchés par le lot sont repris. |
| **D11** « 3.4 kg » à côté de « 95,88 € » | **corrigé** | `/stock` passe par `nombreFr()`. |
| **D12** émojis comme icônes | **corrigé** | 13 émojis remplacés par des icônes `lucide` `aria-hidden`, sur 9 écrans. |
| **D13** échelle typographique parallèle | **partiel** | `text-2xs` posé dans le thème, appliqué à `BottomNav`. Les `text-[9px]` de `DemoScreens` relèvent de la vitrine. |
| **D14** aucun jeton de mouvement | **corrigé** | `duration-150 ease-out` + bloc `prefers-reduced-motion` global (WCAG 2.3.3). |

## Volet 3 — Ergonomie

| # | État | Note |
|---|---|---|
| **E1** le bouton principal ne produit rien | **corrigé, prouvé à l'écran** | `ecrire()` (`src/lib/db.ts`). Recette sur la démonstration : « Valider » et « Démarrer » affichent tous deux le message `DEMO_LECTURE_SEULE` en toast rouge. |
| **E2** 25 écritures sans gestion d'erreur | **corrigé** | Reprises dans 12 fichiers, dont l'insertion de photo de réception (cause racine de #37) et le passage d'une facture en « payée ». `reglages` : 37 champs, « Enregistré » ne s'affiche plus que si la base a pris. |
| **E3** projet prêt et en retard invisible | **corrigé** | `'pret'` ajouté au filtre de retard du tableau de bord. |
| **E4** module jantes absent du tableau de bord | **corrigé** | Jeux en retard et jeux promis aujourd'hui dans « À faire », plus un compteur « Jeux de jantes en atelier ». |
| **E5** lien public en URL brute | **corrigé** | Composant `PartagerLien` : `navigator.share`, repli sur la copie, QR pour le client au comptoir. Posé sur devis, factures, BL, réceptions, jeux de jantes et suivi de projet. |
| **E6** statuts jantes recalculés mais cliquables | **corrigé** | « Reçu », « En cours » et « Prêt » désactivés et annotés « déduit des jantes » ; l'explication est passée au-dessus. |
| **E7** aucune recherche sur `/jantes` | **corrigé** | Client, marque, modèle, immatriculation normalisée, numéro, teinte. Vérifié en production (« golf », « ab-123-cd »). |
| **E8** déconnexion en lien texte | **ouvert, assumé** | Action rare, à traiter avec un vrai menu de compte. |
| §3.2 libellés jargonneux | **corrigé** | `+ ml`, `+ Libre`, `+ m²`, `+ Jantes`, `Solde`, `Poste partagé`, titre `Atelier`, titre du tableau de bord, `Vide`, placeholders « Frozen Grey » / « C3Z ». |
| §3.3 trois écrans plafonnés à 672 px | **corrigé** | `md:max-w-2xl` retiré de `devis/new`, `factures/new` et `reglages` ; la barre d'onglets ne défile plus sur grand écran. |
| §3.3 fiche projet, 12 blocs sans repli | **corrigé** | Réordonnée (QR remonté sous les boutons d'étape), certificat replié quand l'atelier ne certifie pas, champ de teinte constructeur replié hors parcours jantes. |
| §3.3 « 8 requêtes séquentielles » au tableau de bord | **inexact dans l'audit** | Elles sont déjà dans un `Promise.all`. |
| §3.6 cibles tactiles | **partiel** | Barre de navigation basse à 56 px, bouton photo à 56 px. Les 12 px de `text-xs` restent le cas général : chantier de fond. |
| §3.6 `/jantes` derrière « Plus » | **corrigé** | La barre basse promeut Jantes dès qu'un jeu existe (déduit de la donnée). |
| §3.6 `/scan` sans entrée de navigation | **ouvert** | `/scan/[qr]` exige un jeton : une entrée de menu supposerait un lecteur de QR intégré. Décision produit. |
| §3.5 rien n'est poussé | **ouvert** | Le mail quotidien de 8 h reste le chantier de deux jours le plus rentable. La table `notifications` est toujours écrite une fois et lue zéro fois. |

## Volet 4 — Mesure

| # | État | Note |
|---|---|---|
| **M1** aucun formulaire de capture | **corrigé, prêt à poser** | `FormulaireRappel` (composant autonome, variante claire et sombre) + `POST /api/leads` + policy `leads_insert_public`. Vérifié en production de bout en bout, y compris le pot de miel. |
| **M2** aucun identifiant de visiteur | **corrigé** | `analytics_events.visitor_id` et `session_id`, posés côté navigateur. Vérifié : 5/5 événements d'une visite de démonstration portent leur visiteur. |
| **M3** aucune capture d'UTM | **corrigé** | `analytics_events.utm`, capturé au premier atterrissage et mémorisé pour la session. |
| **M4** `referrer` vide sur 21/21 | **à revérifier** | La capture existe et est inchangée ; à confirmer au premier vrai visiteur externe. |
| **M5** aucun outil tiers | **ouvert, assumé** | Le socle first-party suffit aux six chiffres. Search Console attendra le domaine propre. |
| **M6** démo non instrumentée | **corrigé** | `demo_opened` (une fois par session) et `demo_screen` (chemin normalisé). Vérifié en production. |
| **M7** `analytics_events` ouverte sans limite | **corrigé** | Policy bornée : forme du nom d'événement, taille de `props` et `utm`, longueur de `path`/`referrer`, format des identifiants, interdiction d'usurper un `user_id`. **17 tests l'attaquent depuis un client PostgREST anonyme.** |
| **M8** aucun événement de facturation | **ouvert — dépend de Stripe** | Voir point 1 des dix. |

## Les dix choses à faire — où en est chacune

| # | Action | État |
|---|---|---|
| 1 | Trancher Stripe avant le 12/09 | **ouvert — Alexis** |
| 2 | Acheter `thermogestion.fr` | **ouvert — Alexis**, code prêt |
| 3 | Débloquer le crawl | **fait**, sauf `/` en statique (agent contenu, trois lignes) |
| 4 | Mettre les jantes sur l'accueil | **agent contenu** |
| 5 | Formulaire de rappel + `visitor_id` + UTM + démo instrumentée | **fait** |
| 6 | Remonter les erreurs des 25 écritures muettes | **fait, prouvé à l'écran** |
| 7 | Publier `/logiciel-renovation-jantes` | **agent contenu** (livrée, déclarée au plan de site) |
| 8 | Le mail quotidien de 8 h | **ouvert** — deux jours, le plus rentable de ce qui reste |
| 9 | La fiche suiveuse A5 imprimable | **ouvert** — deux jours. En attendant, la phrase « Imprimez ce QR sur la fiche suiveuse » a été retirée de l'écran : le produit ne promet plus un document qui n'existe pas. |
| 10 | Le lot de corrections d'ergonomie et de design | **fait** (sauf D3, D9 et le contraste de l'accueil : fichier de l'agent contenu) |
