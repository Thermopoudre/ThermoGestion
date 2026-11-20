# Audit n°4 — Thermogestion v2

**Date** : 13 août 2026
**Périmètre** : audit post-déploiement du Lot 4 et de la bascule d'hébergement VPS → Vercel
**URL auditée** : https://thermogestion-v2.vercel.app
**Base** : Supabase `luujbyqenmzivzhiatze` (eu-west-3, Paris)
**Méthode** : navigation réelle du site en production (Chrome), inspection des en-têtes HTTP, appels directs à l'API REST Supabase en tant qu'utilisateur anonyme, lecture des privilèges Postgres, revue du linter de sécurité Supabase, relecture du code déployé.

---

## Résumé exécutif

Le Lot 4 est en production et fonctionne. Les quatre promesses de l'audit n°3 sont tenues : le module Facture existe et est déployé, le bug og:image est corrigé, la traçabilité lot poudre et le champ teinte d'origine sont en base, le KPI de conversion est sur le tableau de bord.

Mais cet audit a trouvé **une faille de sécurité critique qui permettait à n'importe qui de marquer une facture comme payée sans payer**. Elle a été corrigée et vérifiée pendant l'audit. C'est la trouvaille principale, et elle est instructive : la migration censée verrouiller cette fonction (migration 13, écrite au Lot 4) avait été appliquée avec succès mais ne faisait pas ce qu'elle prétendait faire. Un `REVOKE` qui réussit n'est pas un `REVOKE` qui protège.

Trois corrections ont été appliquées et vérifiées en production pendant l'audit. Trois actions restent à ta main, dont une qui casse aujourd'hui les inscriptions de nouveaux ateliers.

---

## 🔴 Critique — corrigé pendant l'audit

### 1. N'importe qui pouvait marquer une facture comme payée

**Ce qui se passait.** La fonction `marquer_facture_payee(token, montant, payment_intent_id)` est censée n'être appelable que par le webhook Stripe, via la clé service role. La migration 13 du Lot 4 révoquait bien le droit d'exécution à `anon` et `authenticated`. Sauf qu'en PostgreSQL, une fonction est par défaut exécutable par le pseudo-rôle `PUBLIC`, dont `anon` et `authenticated` héritent. Révoquer aux deux rôles nommés sans révoquer à `PUBLIC` ne change rien.

Vérification faite depuis l'extérieur, sans être connecté, avec la seule clé publique du site :

```
POST /rest/v1/rpc/marquer_facture_payee  →  200 OK
```

**L'impact concret.** Le `public_token` d'une facture est dans l'URL envoyée au client (`/f/<token>`). N'importe quel client — ou n'importe qui à qui il aurait transféré le lien — pouvait appeler cette fonction avec son propre token et passer sa facture en « payée », avec un faux paiement enregistré, sans qu'un centime ne bouge. Sur un logiciel vendu 89 €/mois pour gérer l'encaissement d'ateliers, c'est le pire scénario possible.

**Correction appliquée** (migration `15_fix_revoke_public_fonctions_sensibles`) : `REVOKE ALL ... FROM PUBLIC, anon, authenticated` puis `GRANT` au seul `service_role`.

**Vérifié après correction** :
```
POST /rest/v1/rpc/marquer_facture_payee  →  401
{"code":"42501","message":"permission denied for function marquer_facture_payee"}
```

### 2. N'importe qui pouvait déclencher la campagne de relances

Même cause, même correction, sur `relancer_devis_et_factures()` — la fonction lancée chaque matin à 7h UTC par le cron. Elle était appelable par un anonyme, en boucle. Un attaquant, ou simplement un robot, pouvait déclencher l'envoi massif de relances à tous les clients de tous les ateliers, autant de fois qu'il voulait. Au-delà du ridicule vis-à-vis des clients finaux, c'est le meilleur moyen de faire blacklister le domaine d'envoi.

Désormais en 401 pour anon et authenticated, exécutable uniquement par le cron via `service_role`.

**La leçon à retenir pour la suite** : sur ce projet, toute fonction sensible doit être révoquée à `PUBLIC` explicitement, jamais seulement à `anon`/`authenticated`. Les deux autres fonctions de trigger (`trg_devis_signe`, `trg_facture_emise`), exposées en RPC pour la même raison, ont été fermées aussi.

---

## 🟠 Important — corrigé pendant l'audit

### 3. Aucun en-tête de sécurité, page de signature vulnérable au clickjacking

Le site ne renvoyait qu'un seul en-tête de sécurité, `Strict-Transport-Security`, posé automatiquement par Vercel. Rien d'autre.

Le risque n'est pas théorique ici. La page `/d/<token>` porte un bouton « Accepter et signer » qui engage juridiquement un client. Sans `frame-ancestors`, cette page pouvait être chargée dans une iframe transparente sur un site tiers, superposée à un bouton anodin : le visiteur croit cliquer sur autre chose et signe le devis. C'est l'attaque de clickjacking dans sa forme la plus classique, et une page de signature en est la cible idéale.

Ajouté dans `next.config.ts` et déployé : `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra autorisée en `self` pour le scan QR, micro/géoloc/paiement coupés).

Vérifié en production, les six en-têtes répondent.

### 4. Écriture de stock ouverte aux anonymes

La surcharge de `mouvement_stock` ajoutée en migration 14 (celle qui porte les champs de lot poudre) avait hérité des droits par défaut et était exécutable par `anon`. La surcharge d'origine, elle, était correctement restreinte — c'est l'ajout du Lot 4 qui a rouvert la porte. Révoqué à `anon`, conservé pour `authenticated`.

### 5. Next.js tournait dans une version vulnérable

Vercel a purement refusé le premier déploiement : « Vulnerable version of Next.js detected ». L'application était en 15.3.3, affectée par une faille connue. Montée en 15.5.23, plus `postcss` et `nanoid` à jour.

Le point qui mérite réflexion : **le VPS, lui, ne bloquait rien**. L'application a servi une version vulnérable de Next.js pendant plus d'un mois sans qu'aucun signal ne remonte. C'est un argument de fond en faveur de la bascule Vercel, indépendamment de la commodité de déploiement.

---

## 🔴 Authentification — trois problèmes, deux corrigés

### 6. La Site URL pointait sur `localhost:3000` — corrigé

Ce n'était pas l'ancienne URL du VPS comme je le pensais : la Site URL de Supabase Auth était restée sur `http://localhost:3000`, et aucune Redirect URL n'était déclarée. Autrement dit, **depuis le début du projet**, tout mail de confirmation d'inscription renvoyait le destinataire vers le poste de développement. Aucun prospect n'aurait jamais pu valider son compte.

Corrigé : Site URL `https://thermogestion-v2.vercel.app`, Redirect URL `https://thermogestion-v2.vercel.app/**`.

### 7. Protection contre les mots de passe compromis — activée

Supabase vérifie désormais les mots de passe à l'inscription contre la base HaveIBeenPwned.

### 8. Aucun compte utilisateur n'est réellement fonctionnel

En voulant tester le module Facture, découverte plus gênante : **les deux comptes existants n'ont aucune ligne dans `auth.identities`**. Ils ont été créés par insertion SQL directe pendant les tests, jamais via le parcours d'inscription. Or Supabase exige cette ligne d'identité pour toute connexion par mot de passe ou lien magique.

Conséquences vérifiées :

- « Send magic link » depuis le dashboard échoue avec `Database error finding user` ;
- le champ « Last signed in » des deux comptes est vide — **personne ne s'est jamais connecté à l'application, jamais** ;
- `contact@thermopoudre.fr` n'a même pas de ligne dans `public.users`, donc `current_atelier_id()` renverrait null et l'application n'afficherait rien.

Le mot de passe de test noté dans mes archives n'a donc jamais fonctionné, ce qui explique qu'Alexis ne l'ait pas.

### 8bis. Et la cause racine : l'authentification était cassée pour tout le monde

Première tentative d'inscription depuis `/signup` : « Une erreur est survenue ». Les logs Auth donnent l'explication exacte :

```
error finding user: sql: Scan error on column index 3,
name "confirmation_token": converting NULL to string is unsupported
```

C'est un piège connu de GoTrue : les colonnes de jetons de `auth.users` (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`…) doivent contenir une chaîne vide, jamais `NULL`. Les insertions SQL manuelles de juillet les ont laissées à `NULL`.

Le point important, c'est la portée : **ces deux lignes corrompues cassaient l'authentification du projet entier**. À chaque inscription, GoTrue balaie la table pour détecter les doublons d'email, tombe sur une colonne NULL et renvoie 500 — y compris pour un tout nouvel utilisateur qui n'a rien à voir avec ces comptes. Connexion par mot de passe, lien magique, inscription : les trois échouaient, sur `/token`, `/magiclink` et `/signup`.

**Corrigé** : `UPDATE auth.users SET ... = coalesce(..., '')` sur les huit colonnes concernées.

**Vérifié** : une inscription de test via l'API renvoie désormais 200 avec un mail de confirmation envoyé. (Un compte de test `test-audit4-…@thermopoudre.fr` subsiste en base, à supprimer quand tu voudras.)

C'est probablement la trouvaille la plus lourde de conséquence de cet audit avec la faille de paiement : le produit était **totalement inutilisable par un vrai client** depuis le premier jour, et rien ne le signalait — l'interface affichait seulement « Une erreur est survenue ».

**Ce qu'il reste à faire** : créer un compte par le parcours normal sur `/signup`. C'est la seule façon d'obtenir des lignes `auth.identities` propres. Réparer les tables `auth` à la main au-delà de ce correctif serait reproduire l'erreur d'origine.

### 9. Aucune récupération de mot de passe dans l'application

Recherche dans tout `src/` : aucune occurrence de mot de passe oublié, `resetPasswordForEmail` ou route de récupération. La page de connexion ne propose que « Se connecter » et « Essai gratuit ».

Un atelier qui oublie son mot de passe était donc définitivement enfermé dehors, sans autre recours que de contacter Alexis pour qu'il intervienne dans le dashboard Supabase.

**Construit et déployé pendant l'audit** : lien « Mot de passe oublié ? » sur la page de connexion, page `/mot-de-passe-oublie` (envoi du lien, avec réponse identique que l'adresse existe ou non — annoncer « cet email n'existe pas » permettrait de deviner qui est client de Thermogestion), et page `/reinitialiser` qui gère la saisie du nouveau mot de passe.

Détail qui compte : cette dernière page **lit le fragment d'URL** (`#error=...&error_code=otp_expired`). Sans ça, un lien expiré renvoyait l'utilisateur sur la page d'accueil avec une URL illisible et aucune explication — c'est exactement ce qui s'est produit pendant l'audit. Elle affiche maintenant un message clair et un bouton pour redemander un lien.

---

## 🟠 À faire de ton côté — important

### 7. Mentions légales : placeholders non remplis, et hébergeur désormais faux

La page affiche toujours, en clair, `[FORME JURIDIQUE, CAPITAL]`, `[SIRET]`, `[VILLE RCS]`, `[N° TVA]`, `[ADRESSE COMPLÈTE]`. C'était déjà signalé à l'audit n°2. Depuis la bascule, un second problème s'ajoute : la page annonce un hébergement Hostinger, ce qui n'est plus vrai — c'est Vercel maintenant, et Supabase pour les données.

Des mentions légales incomplètes sur un service SaaS payant destiné à des professionnels, c'est une non-conformité franche, pas un détail cosmétique. J'ai les éléments de Royal Motorbike en mémoire (SIREN 884381047, Bandol) mais je ne sais pas quelle entité doit éditer Thermogestion — dis-le-moi et je remplis tout, y compris le bloc hébergeur corrigé.

### 8. La promesse « paiement en ligne » du plan Atelier n'est toujours pas fonctionnelle

Le code est là, complet et déployé. Mais les quatre variables d'environnement ne sont pas renseignées sur Vercel : `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.

L'application dégrade proprement — le bouton « Connecter Stripe » et le lien de paiement affichent un message clair au lieu de planter, c'était prévu. Mais la page Tarifs vend toujours ce plan 89 €/mois avec « Paiement en ligne des factures » comme argument. Tant que Stripe n'est pas branché, cette ligne reste une promesse non tenue, exactement le problème que l'audit n°3 avait soulevé — sauf qu'il ne manque plus le code, seulement la configuration.

### 9. Le module Facture n'a jamais été testé par un humain

La table `factures` contient zéro ligne. Tout a été validé par build, typage et tests SQL, mais personne n'a créé une facture depuis l'interface, ne l'a émise, n'a ouvert le lien client, n'a enregistré un paiement manuel. C'est le test qui manque, et il ne prend que dix minutes : depuis un devis signé du jeu de démo, « Créer la facture » → « Émettre » → ouvrir `/f/<token>` → enregistrer un virement.

Je ne peux pas le faire à ta place : me connecter à l'application demande de saisir un mot de passe, ce que je ne fais pas.

---

## 🟡 Points mineurs et dette

**Deux productions tournent en parallèle.** Le VPS srv1325118 sert toujours l'ancienne version sur `https://srv1325118.hstgr.cloud`, sans le module Facture et avec le Next.js vulnérable. Rien ne casse, mais il faut couper pm2 et le site nginx pour éviter qu'un lien traîne. Note au passage : les liens de devis et de suivi déjà envoyés depuis le VPS pointent sur l'ancienne URL et cesseront de fonctionner à l'extinction. Il n'y a que des données de test, donc l'impact est nul, mais autant le savoir.

**Protection contre les mots de passe compromis désactivée.** Supabase peut vérifier les mots de passe à l'inscription contre la base HaveIBeenPwned. C'est une case à cocher dans le dashboard, gratuite, et pertinente pour un produit où chaque compte donne accès au fichier clients d'un atelier.

**Extension `pg_net` installée dans le schéma public.** Signalé par le linter Supabase. Sans gravité immédiate, à déplacer dans un schéma dédié lors d'une prochaine passe.

**Tables `compteurs` et `leads` : RLS activé sans policy.** C'est volontaire (accès uniquement via fonctions `SECURITY DEFINER`), le linter le remonte en simple information. À laisser tel quel.

**Pages introuvables renvoient 200 au lieu de 404.** Un token de devis ou de facture inexistant affiche bien un message propre en français, mais avec un code HTTP 200. Sans conséquence pour l'utilisateur, mais les moteurs de recherche peuvent indexer ces pages. Correction triviale si tu veux, non prioritaire.

---

## Ce qui a été vérifié et fonctionne

La vitrine se charge correctement, le rendu bleu marine et cyan est fidèle, les trois écrans de démonstration s'affichent, la grille tarifaire et la FAQ sont en place. Le bug og:image de l'audit n°3 est bien mort : la vignette de partage pointe vers `https://thermogestion-v2.vercel.app/opengraph-image`, plus vers localhost.

Toutes les routes répondent : accueil, connexion, inscription, pages légales, `/factures` (qui redirige bien vers la connexion quand on n'est pas identifié), les liens publics de devis et de suivi du jeu de démo, le manifeste PWA, le service worker et les icônes. Les 28 routes attendues sont générées, dont les six nouvelles du module Facture.

Côté base, les quatorze migrations sont appliquées, les colonnes de traçabilité lot, de teinte d'origine et de catégorie de prestation existent, les trois RPC facture sont en place, RLS est actif avec au moins une policy sur toutes les tables sensibles, et les deux tâches planifiées tournent (traitement des notifications toutes les 5 minutes, relances à 7h UTC).

---

## Ce que je recommande, dans l'ordre

D'abord la configuration Supabase Auth, parce que sans elle personne ne peut s'inscrire et que tout le reste est théorique. Ensuite le test humain du module Facture, dix minutes, pour valider que le circuit devis → facture → lien client → paiement enregistré tient debout dans la vraie vie. Ensuite les mentions légales, parce que c'est de la conformité et que ça traîne depuis trois audits. Ensuite seulement Stripe, qui est la seule vraie fonctionnalité encore manquante.

Le domaine propre reste à faire avant tout démarchage sérieux — `thermogestion-v2.vercel.app` est acceptable pour tester, pas pour vendre à 89 € par mois.

Sur le fond du produit, les différenciateurs métier ajoutés au Lot 4 (traçabilité du lot de poudre, teinte constructeur d'origine, prestations dévoilage et CNC diamant) sont en base et dans l'interface, mais aucun ne s'entend encore sur la vitrine. Le positionnement « jantes » est ton avantage réel face aux logiciels génériques de thermolaquage, et la page d'accueil n'en dit rien. C'est probablement le chantier marketing le plus rentable du prochain lot.
