# Recette Lot 9 — correctifs techniques de l'audit SEO / design / ergonomie / mesure

*19 août 2026. Périmètre : tout ce qui relève du code dans `AUDIT-SEO-DESIGN-UX.md`, hors décisions
d'Alexis (achat du domaine, configuration Stripe) et hors contenu de la vitrine (traité en
parallèle par un autre agent, qui possède `src/app/page.tsx` et les pages de destination).*

**État : `npm test` vert — 445 tests (428 avant, 17 ajoutés). `npx next build` sans erreur.
Déployé en production le 19/08 à 13 h 24 UTC.**

---

## 1. Le crawl — ce qui répondait 307 vers `/login` répond 200

### Ce qui a changé

`src/middleware.ts` est réécrit sur trois points :

1. **Les fichiers d'exploration sortent du matcher** (`robots.txt`, `sitemap.xml`, `llms.txt`),
   avec une double barrière : le matcher les exclut, et la fonction les laisse passer en tête
   même si quelqu'un retouche le matcher plus tard.
2. **Le middleware n'appelle plus `supabase.auth.getUser()` sur les chemins publics.** Il ne le
   fait que sur les routes protégées, là où la session doit réellement être validée et
   rafraîchie. Sur `/`, `/login` et `/signup`, la redirection de confort « déjà connecté →
   tableau de bord » repose sur la **présence** d'un cookie `sb-*-auth-token`, sans aller le
   faire valider : aucun accès n'est accordé sur cette base, un cookie périmé mène à
   `/dashboard` qui vérifie pour de bon et renvoie vers `/login`.
3. Le matcher exclut aussi les extensions `.txt` et `.xml`.

4. **La liste blanche est devenue une liste noire.** Le modèle était à l'envers : toute page
   ajoutée à la vitrine répondait 307 vers `/login` tant que personne ne l'avait inscrite dans
   `PUBLIC_PATHS`. C'est arrivé le jour même : `/logiciel-renovation-jantes` répondait 307 alors
   qu'elle était déjà déclarée au plan de site. Le middleware liste désormais **ce qui est
   protégé** — les écrans de `(app)`, `/onboarding` et les routes d'API qui parlent à l'atelier —
   et tout le reste est public par construction. La vraie barrière reste la RLS, attaquée depuis
   un client anonyme à chaque exécution des tests.

   *Effet de bord réparé au passage :* `/api/ip` était protégé alors qu'il est appelé par les
   pages de signature publiques pour horodater l'adresse du signataire. Un client anonyme qui
   signait un devis était redirigé vers `/login` pour cet appel, `ipPublique()` renvoyait `null`
   en silence, et l'adresse IP n'était pas conservée sur la signature. Elle l'est maintenant.

Fichiers créés : `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/llms.txt/route.ts`.
Les trois sont `force-static` et suivent `NEXT_PUBLIC_SITE_URL` — le jour où le domaine propre
est posé, ils se mettent à jour tout seuls.

### Preuve en production

```
/robots.txt   → HTTP 200, text/plain,       x-vercel-cache: PRERENDER
/sitemap.xml  → HTTP 200, application/xml,  x-vercel-cache: PRERENDER
/llms.txt     → HTTP 200, text/plain,       x-vercel-cache: PRERENDER
/legal/mentions → HTTP 200,                 x-vercel-cache: PRERENDER   TTFB 130 ms
/d/<jeton>    → HTTP 200, x-robots-tag: noindex, nofollow, noarchive
```

`robots.txt` sert bien `Sitemap:` et `Host:`, et le plan de site liste les pages publiques
réellement indexables.

### Désindexation des documents clients

Les chemins par jeton (`/d/ /s/ /f/ /bl/ /rc/ /jt/`) portent des devis, factures et bons de
livraison de clients. Ils ne sont **pas** interdits dans `robots.txt` — ils portent un en-tête
`X-Robots-Tag: noindex, nofollow, noarchive` posé dans `next.config.ts`. Les interdire des deux
côtés produirait l'inverse du but : une URL connue, jamais explorée, donc indexable sur la seule
foi d'un lien entrant.

### Données structurées

`src/components/JsonLd.tsx` expose `ORGANISATION` (SASU Royal Motorbike, SIREN, TVA, adresse,
`sameAs: thermopoudre.fr`) et `LOGICIEL` (`SoftwareApplication` avec les deux `Offer` à 59 et
89 € HT), montés dans `src/app/layout.tsx`. Il expose aussi `faqJsonLd(questions)` pour la page
qui porte réellement les questions — l'agent contenu l'a monté sur l'accueil, vérifié en
production : `Organization`, `SoftwareApplication`, `Offer`, `FAQPage`, `Question`, `Answer`.

`layout.tsx` gagne également `alternates.canonical: "./"` (canonique par page, vérifiée :
`/legal/mentions` porte bien la sienne), le bloc `openGraph` explicite et `twitter:card`.
Les trois pages légales gagnent une `description`.

### Ce qui n'est PAS fait, et pourquoi

**La page d'accueil est toujours rendue dynamiquement** (`ƒ /` au build, `x-vercel-cache: MISS`,
TTFB ~ 280 ms). Le middleware ne l'appelle plus chez Supabase, mais `src/app/page.tsx` fait
`await searchParams` pour lire `?demo=indisponible` : dès qu'une page accède à `searchParams`,
Next.js la sort du rendu statique, quelle que soit la valeur. **Poser un `Cache-Control` dans
`next.config.ts` ne sert à rien** : Next l'écrase pour les pages en production.

Le correctif tient en trois lignes mais il est **dans le fichier de l'autre agent**. Le composant
de remplacement est livré, prêt à coller : `src/components/AvisDemoIndisponible.tsx`.

```diff
- export default async function Home({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
-   const { demo } = await searchParams;
+ export default function Home() {
...
-   {demo === "indisponible" && ( … )}
+   <Suspense fallback={null}><AvisDemoIndisponible /></Suspense>
```

Attendu après ce changement : `○ /` au build, `x-vercel-cache: HIT`, TTFB divisé par ~2 (mesuré
sur `/legal/mentions`, statique : 130 ms contre 280 ms).

---

## 2. Les écritures muettes — 25 écrans qui échouaient sans rien dire

### Le motif, et pourquoi il coûtait cher

`await supabase.from(...).update(...)` sans destructuration ne lève rien. PostgREST répond 4xx,
le client range l'erreur dans `error`, personne ne la lit. À l'écran : l'atelier appuie sur
« Valider l'étape » et il ne se passe **rien** — ni changement, ni message, ni trace en console.
En production, c'est exactement ce que produisent un abonnement expiré (`ABONNEMENT_REQUIS`),
un refus RLS, ou un réseau coupé dans un bâtiment métallique.

### Le correctif

`src/lib/db.ts` — un helper unique :

```ts
export async function ecrire(requete, toast, succes?): Promise<boolean>
```

Il lit `error`, le traduit par `errorFr()`, l'affiche en toast rouge, et renvoie `false` pour que
l'appelant n'enchaîne pas sur un rechargement ou un message de succès après un échec.

### Écrans repris

| Fichier | Écritures reprises |
|---|---|
| `projets/[id]/page.tsx` | `avancer_etape`, `demarrer_etape`, insertion de photo, poudre, surface, couches, date promise, teinte d'origine |
| `receptions/[id]/page.tsx` | **insertion de la photo de réception** — cause racine des 5 réceptions sans photo (#37) |
| `devis/[id]/page.tsx` | `next_numero`, envoi, « signé verbalement », « refusé » |
| `factures/[id]/page.tsx` | `next_numero`, émission, notification client, **passage en « payée »** |
| `fournees/[id]/page.tsx` | `avancer_etape` par projet, date prévue, note |
| `commandes/page.tsx` | note du bon de commande |
| `jantes/new/page.tsx` | mise à jour de la teinte d'origine du véhicule, `next_numero` |
| `qualite/certifications`, `qualite/referentiels` | activation, référentiel par défaut |
| `ControleForm.tsx` | dépôt et rattachement de la photo de contrôle |
| `onboarding/page.tsx` | identité de l'atelier (SIREN, TVA, adresse) |
| `reglages/page.tsx` | **37 champs** — helpers locaux `sauver()` et `sauverEtRecharger()` : « Enregistré » ne s'affiche plus que si la base a pris |

`Button` gagne une prop `loading` : le libellé est conservé (l'opérateur doit savoir sur quoi il a
appuyé), le bouton devient inopérant, `aria-busy` est posé, un anneau tourne par-dessus.

### Preuve en production (Claude in Chrome, atelier de démonstration)

L'atelier de démonstration porte `demo = true` et un trigger refuse toute écriture : c'est le banc
d'essai idéal. Sur `PR-2026-0021` :

- clic sur **« Valider sans chronométrer »** → toast rouge
  *« Vous visitez la démonstration : elle se consulte, elle ne s'enregistre pas. Créez votre
  atelier pour essayer pour de vrai. »*
- clic sur **« Démarrer : Poudrage »** → même toast.

Avant le lot : aucun toast, aucune erreur, aucun changement, rien en console.

---

## 3. Design system

| Anomalie de l'audit | Traitée | Comment |
|---|---|---|
| **D1** `Select` / `Textarea` sans anneau de focus | oui | `focus:ring-1 focus:ring-brand`, même contrat que `Input` ; les deux gagnent aussi `error` + `aria-invalid` |
| **D2** `Card` cliquable = `<div onClick>` | oui | `Card` rend un vrai `<button>` dès qu'un `onClick` est fourni, avec `focus-visible`, `hover`, `active` et un `ariaLabel` optionnel |
| **D3** contraste `zinc-500` sur marine | partiel | corrigé dans `FormulaireRappel` ; **l'accueil appartient à l'agent contenu** — le pied de page et la ligne de réassurance restent à passer en `text-zinc-400` (6,36:1) |
| **D4** 429 couleurs d'état en dur | partiel | les jetons `success`/`warning`/`danger` gagnent les paliers 50/200/700 ; migration faite sur les écrans touchés (stock, projets, revient, factures, devis, réglages), pas sur les 429 |
| **D5** deux échelles de gris | non | chantier de dette pure, effet nul sur la vente — l'audit lui-même le déconseille maintenant |
| **D6** `Badge` sans variantes | oui | `<Badge tone="success\|warning\|danger\|info\|neutral">`, `className` toujours accepté pour les tables `STATUS_*` |
| **D7** `Button` sans état de chargement | oui | prop `loading` |
| **D8** `Empty` sans action | oui | `icon` + `action` ; posé sur `/projets`, `/stock`, `/jantes` |
| **D9** `Wordmark` dupliqué | non | la copie vit dans `src/app/page.tsx` — fichier de l'agent contenu |
| **D10** 75 `<button>` natifs | partiel | ceux touchés par le lot passent au design system ou reçoivent `focus-visible` |
| **D11** formatage des kg | oui | `/stock` passe par `nombreFr()` : « 3,4 kg » et non « 3.4 kg », à côté de « 95,88 € » |
| **D12** émojis comme icônes | oui | ⚠️ ⏳ ⏱ ▶ ✓ 📷 📅 📊 🛒 💡 🎉 ✅ 👋 remplacés par des icônes `lucide` avec `aria-hidden`, sur 9 écrans |
| **D13** échelle typographique parallèle | partiel | `text-2xs` (11 px) posé dans le thème et appliqué à `BottomNav` ; les `text-[9px]`/`text-[10px]` de `DemoScreens` appartiennent à la vitrine |
| **D14** aucun jeton de mouvement | oui | `duration-150 ease-out` sur les transitions touchées + bloc `prefers-reduced-motion` global dans `globals.css` (WCAG 2.3.3) |

`Spinner` gagne trois tailles et un `role="status"` avec libellé.

---

## 4. Écrans de bureau et ergonomie

- **`md:max-w-2xl` retiré** de `devis/new`, `factures/new` et `reglages`. La barre d'onglets des
  Réglages ne défile plus horizontalement sur grand écran (`md:flex-wrap md:overflow-visible`,
  `role="tablist"`, `aria-selected`).
- **Fiche projet réordonnée** : boutons d'étape → QR atelier → étapes → temps → poudre → photos →
  suivi client → facturation → revient → certificat. Le pavé rouge « Pas encore certifiable » ne
  s'affiche plus au-dessus du bouton qui sert à travailler : le bloc certificat est replié tant
  que rien n'indique que l'atelier certifie (aucune certification déclarée **et** aucun contrôle
  sur le dossier — déduit de la donnée, pas d'un réglage de plus).
- **« Démarrer » est le bouton primaire** tant qu'aucun chrono ne tourne ; « Valider sans
  chronométrer » passe en secondaire. Une fois le chrono lancé, un seul bouton : « Valider ».
- **Bouton « Facturer ce projet »** ajouté (vers `/factures/new?devis=…` quand le projet vient
  d'un devis) — il n'existait aucun chemin d'un projet livré vers sa facture.
- **`PartagerLien`** (nouveau composant) remplace « URL brute + Copier » sur devis, factures,
  bons de livraison, réceptions, jeux de jantes et suivi de projet : `navigator.share` (le
  sélecteur d'applications du téléphone, un geste au lieu de six), repli sur la copie au bureau,
  et un QR à montrer au client présent au comptoir.
- **Recherche sur `/jantes`** : client, marque, modèle, immatriculation (normalisée : « ab-123-cd »
  trouve « AB123CD »), numéro de dossier, teinte. Vérifié en production.
- **Statut du dossier jantes** : « Reçu », « En cours » et « Prêt » sont désormais non
  sélectionnables (ils sont recalculés en base) et portent la mention « déduit des jantes ».
  L'explication est passée au-dessus des choix.
- **Libellés** : `+ ml` → `+ Longueur (ml)`, `+ Libre` → `+ Ligne libre`, `+ m²` →
  `+ Surface (m²)`, `+ Jantes` → `+ Jeu de jantes`. Type de facture :
  `Facture (solde du chantier)` · `Facture d'acompte` · `Facture libre (sans devis)` ·
  `Avoir (annulation ou remboursement)`. `Poste partagé` → `Chronomètre d'équipe`, avec une
  phrase d'explication. Titre `/projets` : `Atelier` → `Projets en atelier`. Titre du tableau de
  bord : `Aujourd'hui à l'atelier`, le nom de l'atelier en sous-titre.
- **Placeholders qui ressemblaient à des valeurs** : « Frozen Grey » et « C3Z » passent dans le
  libellé (`Teinte (ex. Frozen Grey)`, `Réf. constructeur (ex. C3Z)`).
- **États vides contextualisés** : les trois colonnes du kanban disent ce qui viendra s'y ranger
  (« Rien à démarrer. Les devis signés arrivent ici tout seuls. ») ; `/projets`, `/stock` et
  `/jantes` portent une action.
- **Bouton d'enregistrement du devis** : quand il est éteint, il dit pourquoi (« Choisissez
  d'abord le client. » / « Ajoutez au moins une ligne au devis. »).
- **Suppression d'une ligne de devis** : confirmation, et le bouton n'est plus rouge en haut à
  droite du bloc.
- **Mur de pastilles de la facture** : les prestations sont annoncées, « + Ligne libre » se
  distingue (bordure pointillée) au lieu de passer pour une quinzième prestation.
- **Cibles tactiles** : barre de navigation basse à 56 px de haut, libellés en `text-2xs`
  (jeton, plus de `text-[11px]`), bouton « Photographier les pièces » à 56 px.
- **`/jantes` sort de « Plus » sur mobile** dès que l'atelier a créé un jeu : la barre devient
  Accueil · Projets · Jantes · Devis, et Factures passe dans « Plus ». Déduit de la donnée
  (`count(jeux_jantes)`), aucun réglage à cocher.

### Tableau de bord

- **E3 corrigé** : la requête de retard incluait `status in ('en_attente','en_cours')` et excluait
  donc `pret`. Un projet terminé mais non livré cinq jours après la date promise s'affichait en
  rouge sur le kanban et n'apparaissait nulle part dans « À faire ». `'pret'` est ajouté.
- **E4 corrigé** : le module jantes entre dans « À faire » (jeux en retard, jeux promis
  aujourd'hui) et gagne un compteur « Jeux de jantes en atelier ».
- *Note contre l'audit* : « 8 requêtes Supabase séquentielles » est inexact — elles sont déjà
  dans un `Promise.all`. Le spinner plein écran reste, mais il attend un seul aller-retour.

---

## 5. Mesure — de zéro chiffre exploitable à un tunnel calculable

### Migration `lot9_mesure_visiteur_et_leads`

1. `analytics_events` gagne **`visitor_id`**, **`session_id`** et **`utm`** (jsonb), plus deux
   index. Sans eux, `visit_landing → signup_start → atelier_created` n'était pas approximatif :
   il était **structurellement incalculable**.
2. La policy `analytics_insert` était `with_check = true` — n'importe qui pouvait injecter
   n'importe quoi via l'API REST. Elle borne désormais la forme du nom d'événement
   (`^[a-z][a-z0-9_]{2,39}$`), la taille de `props` (2 ko) et de `utm` (1 ko), la longueur de
   `path` et `referrer`, le format des identifiants, et **interdit d'attribuer un événement à un
   autre utilisateur** (`user_id = auth.uid()`).
3. `leads` n'avait **aucune policy** — donc aucune écriture possible, et aucun code ne l'écrivait
   faute de formulaire. Nouvelle policy `leads_insert_public` : insertion seule, e-mail validé,
   longueurs bornées, `status = 'nouveau'` imposé. **Aucune policy de lecture, de modification ni
   de suppression** : un lead déposé ne ressort jamais par l'API publique.

### Code

- `src/lib/track.ts` : `visitor_id` (localStorage), `session_id` (sessionStorage), capture des
  UTM (`utm_source/medium/campaign/content/term`, `gclid`, `fbclid`) **mémorisée pour toute la
  session** — sinon un visiteur venu d'une annonce puis passé sur `/signup` perd son origine.
  Identifiants aléatoires en base64url : ni IP, ni empreinte de navigateur, vider son navigateur
  les efface.
- `src/components/TrackDemo.tsx` : monté seulement quand `atelier.demo = true`. Émet
  `demo_opened` une fois par session et `demo_screen` à chaque écran, avec le chemin normalisé
  (`/projets/<uuid>` → `/projets/:id`) pour que la profondeur compte des rubriques et non des
  fiches.
- `src/components/FormulaireRappel.tsx` : **composant autonome, prêt à poser** dans la page
  d'accueil ou une page de destination. Variante `clair` / `sombre`, prop `source`, pot de miel,
  mention de confidentialité, et un état de succès qui dit ce qui se passe ensuite.
- `src/app/api/leads/route.ts` : validation, pot de miel (réponse « ok » sans écriture — un robot
  qui reçoit une erreur réessaie), limite de débit par IP (5 / 10 min), capture des UTM.
  Utilise la **clé anonyme**, pas la clé de service : le vrai garde-fou est la policy.

### Preuve en production

```
POST /api/leads  { email:"robot@…", societe_web:"spam" }  → {"ok":true}   0 ligne écrite
POST /api/leads  { email:"pas-un-email" }                 → 400 « Indiquez une adresse e-mail valide. »
POST /api/leads  { … complet … }                          → {"ok":true}   1 ligne, status 'nouveau', utm conservé
```

Parcours réel de la démonstration : `demo_opened` ×1, `demo_screen` ×4, **`visitor_id` renseigné
sur 5/5**, une seule `session_id`. (Ces lignes de recette ont été purgées après vérification.)

### Tests ajoutés — `tests/mesure-vitrine.test.ts` (17 tests)

Attaqués depuis un **vrai client PostgREST anonyme**, exactement ce dont dispose n'importe qui
avec la clé publique du front :

- accepte un événement bien formé avec visiteur, session et UTM ;
- refuse : nom d'événement à rallonge, avec du HTML, vide ; identifiant de visiteur fabriqué
  (`'; drop table leads; --`) ; charge utile de 5 ko ; chemin de 400 caractères ; usurpation de
  `user_id` ;
- `analytics_events` reste illisible en anonyme ;
- accepte une demande de rappel bien formée ; refuse un e-mail invalide, un message de 3 000
  caractères, et un `status = 'converti'` imposé de l'extérieur ;
- un lead n'est jamais relisible, ni modifiable, ni supprimable depuis l'extérieur.

### Les six chiffres, prêts à interroger

```sql
-- 1. Visiteurs uniques du mois
select count(distinct visitor_id) from analytics_events
where created_at >= date_trunc('month', now()) and visitor_id is not null;

-- 2. Taux d'ouverture de démo
select round(100.0 * count(distinct visitor_id) filter (where event = 'demo_opened')
           / nullif(count(distinct visitor_id) filter (where event = 'visit_landing'), 0), 1) as pct
from analytics_events where created_at >= now() - interval '30 days';

-- 3. Profondeur de démo (écrans distincts par session)
select round(avg(n), 1) from (
  select session_id, count(distinct props->>'ecran') as n
  from analytics_events where event = 'demo_screen' group by 1
) t;

-- 4. Taux de lead
select round(100.0 * count(distinct visitor_id) filter (where event in ('lead_submitted','signup_start'))
           / nullif(count(distinct visitor_id), 0), 1) as pct
from analytics_events where created_at >= now() - interval '30 days';

-- 5. Taux d'activation
select count(distinct props->>'atelier') filter (where event = 'devis_sent')::numeric
     / nullif(count(*) filter (where event = 'atelier_created'), 0) from analytics_events;

-- 6. Sources d'acquisition
select utm->>'utm_source' as source, count(distinct visitor_id)
from analytics_events where utm is not null group by 1 order by 2 desc;
```

**Hygiène** : `npm test` écrit dans les tables réelles. Purger après une exécution :

```sql
delete from analytics_events where event like 'test\_lot9\_%';
delete from leads where source = 'test-automatise';
```

---

## 6. Ce qui reste ouvert

| # | Sujet | Pourquoi ce n'est pas fait |
|---|---|---|
| 1 | **Décision Stripe avant le 12/09/2026** | Décision d'Alexis. Dans 24 jours, le seul atelier réel passe en lecture seule et « Souscrire » répond HTTP 500. |
| 2 | **Acheter `thermogestion.fr`** | Achat + variable d'environnement. `robots.ts`, `sitemap.ts`, `llms.txt` et les JSON-LD suivent déjà `NEXT_PUBLIC_SITE_URL` : rien d'autre à toucher le jour venu. |
| 3 | **`/` en statique** | Trois lignes dans `src/app/page.tsx`, fichier de l'agent contenu. Composant de remplacement livré (`AvisDemoIndisponible.tsx`), diff donné au §1. |
| 4 | **Contraste du pied de page et de la ligne de réassurance** | `src/app/page.tsx`. `text-zinc-500` → `text-zinc-400`. Dix minutes, pas les miennes. |
| 5 | **`Wordmark` dupliqué** | Copie locale dans `src/app/page.tsx`. |
| 6 | **Migration des 429 couleurs d'état** | Une journée de dette pure, effet nul sur la vente — l'audit lui-même la déconseille maintenant. Les paliers de jetons sont posés pour l'accueillir. |
| 7 | **Deux échelles de gris (`gray` 793 / `zinc` 195)** | Même raison. Décision produit à prendre d'abord : le froid `zinc` s'accorde au marine, mais 793 occurrences vivent en `gray`. |
| 8 | **Fiche suiveuse A5 imprimable (#13)** | Deux jours. La phrase « Imprimez ce QR sur la fiche suiveuse » a été retirée de l'écran en attendant : le produit ne promet plus un document qui n'existe pas. |
| 9 | **Le mail quotidien de 8 h** | Deux jours. La table `notifications` est écrite (facture émise) et lue zéro fois ; aucun écran ne la liste. Le cron et le canal e-mail existent, il manque le contenu du message et un écran de fil. |
| 10 | **Réglage « je délivre des certificats »** | Le repli du bloc certificat est déduit de la donnée (certifications déclarées ou contrôles saisis). Un vrai réglage serait plus explicite, mais c'est un réglage de plus à faire vivre — décision produit. |
| 11 | **Limite de débit de `/api/leads`** | En mémoire du conteneur : dissuasive, pas infaillible (plusieurs instances = plusieurs compteurs). Suffisant pour un site sans trafic ; à revoir si le spam arrive. |

## 7. Note de coordination

Ce lot et le lot « contenu / positionnement » avancent sur la même copie de travail. À l'heure du
déploiement, les trois pages de destination de l'autre agent
(`/logiciel-renovation-jantes`, `/logiciel-sous-traitance-thermolaquage`,
`/prix-logiciel-thermolaquage`) et son balisage `FAQPage` sont partis en production avec ce lot,
et il a repris `src/app/sitemap.ts` pour y déclarer ses pages. Rien d'autre n'est partagé :
`src/app/page.tsx` n'a pas été touché ici.

Composants laissés à sa disposition :

| Composant | Usage |
|---|---|
| `FormulaireRappel` | `<FormulaireRappel source="accueil" />`, variante `sombre` pour le fond marine |
| `faqJsonLd(questions)` | `<JsonLd data={faqJsonLd(FAQ.map(f => ({ question: f.q, reponse: f.r })))} />` |
| `AvisDemoIndisponible` | rend `/` statique (§1) |
| `PartagerLien` | partage d'un lien public, avec QR |
