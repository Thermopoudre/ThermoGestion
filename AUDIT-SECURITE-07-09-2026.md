# Audit de sécurité — Thermogestion, 7 septembre 2026

Audit du code (`src/`, `supabase/migrations/`) et de la base `luujbyqenmzivzhiatze`, plus vérification des en-têtes en production. Chaque constat a été **prouvé par une requête ou un appel réel**, pas déduit de la lecture. Aucune écriture n'a été faite en base ; les ateliers réels n'ont pas été touchés.

## Synthèse

| # | Constat | Gravité | État |
|---|---|---|---|
| 1 | Métadonnées d'atelier (plan payé, sièges, capacités) lisibles en anonyme à partir d'un UUID | Moyen | À corriger |
| 2 | Pièce jointe de notification sans borne de taille | Moyen | À corriger |
| 3 | ~~`/api/adresse` et `/api/entreprise` : proxys ouverts~~ | — | **Constat erroné** : déjà protégées par le middleware |
| 4 | `authenticated` garde INSERT/UPDATE/DELETE/TRUNCATE sur `notifications` (inopérant aujourd'hui) | Faible | Corrigé (migration 65) |
| 5 | 4 fonctions exécutables par `PUBLIC` en plus de `anon` (incohérence) | Faible | Corrigé — **27 en réalité** (migration 65) |
| 6 | Confirmation d'e-mail désactivée à l'inscription | Faible | Décision d'Alexis |

**Suites données le 7 septembre** (migration `65_durcissement_audit_securite_20260907.sql`, 1 420 tests verts) : constats 1, 2, 4 et 5 corrigés. Le balayage du constat 5 a révélé **27 fonctions** ouvertes à `PUBLIC` et non 4, et a évité une régression de justesse : en fermant `nature_operation_deduite`, on cassait le déclencheur `trg_nature_operation` — non-`SECURITY DEFINER`, donc exécuté avec les droits de l'utilisateur — et **toute création de facture** aurait échoué en production. Un filet `tests/securite-privileges.test.ts` fait désormais rougir la suite si un nouvel objet sort du cadre (aucune fonction ouverte à `PUBLIC`, liste blanche nommée des 33 fonctions accessibles en anonyme, `search_path` partout, RLS sur les 58 tables, `security_invoker` sur les 8 vues).

**Point relevé au passage, préexistant** : `mon_plan()`, `ma_capacite()` et `ma_limite_utilisateurs()` lèvent une erreur de permission au lieu de rendre `null` quand elles sont appelées en anonyme, parce que `current_atelier_id()` est fermée à `anon` depuis longtemps. Aucun impact aujourd'hui (aucun appelant anonyme), mais le raisonnement écrit dans les commentaires confond « ne fuite rien » et « ne casse pas ». À reprendre calmement.

**Verdict : oui, le produit peut aller chez un premier client.** Aucun constat critique ni élevé. Le cloisonnement entre ateliers, l'authentification des routes, les jetons publics et les en-têtes de transport sont corrects. Les six points ci-dessus sont du durcissement, pas des brèches ouvertes.

## Ce qui est solide (vérifié, pas supposé)

**Cloisonnement multi-atelier.** Toutes les tables de `public` ont la RLS activée et au moins une policy, sauf `compteurs` et `reglages_app` qui ont la RLS **sans aucune policy** — c'est-à-dire en refus total, ce qui est le comportement voulu. Toutes les vues portent `security_invoker` : aucune ne traverse la RLS avec les droits de son propriétaire, qui est le trou classique de ce type d'architecture.

**Jetons publics.** 32 caractères hexadécimaux, soit 128 bits d'entropie — pas des UUID v4 séquentiels, pas devinables. La sortie de `devis_public()` a été inspectée **clé par clé** en tant que `anon` : elle rend le document, les mentions légales de l'atelier (obligatoires sur un devis) et le nom du client, et **ni identifiant d'atelier, ni coût, ni marge, ni prix de revient, ni e-mail d'un autre client**. La chaîne « jeton public → identifiant d'atelier → constat n° 1 » n'existe donc pas.

**Routes API.** Les 26 routes qui servent des données (tous les PDF, les exports, la facturation, les notifications) vérifient la session ; la RLS fait ensuite le contrôle d'appartenance. Les six routes sans session le sont par nature et sont gardées : le webhook Stripe vérifie la signature (`constructEvent`), la désinscription valide le format du jeton avant lecture, la capture de prospects a un pot de miel plus une policy en base.

**Escalade de rôle.** La policy `users_update_self` laisse un membre modifier sa propre ligne sans protéger la colonne `role` — mais le déclencheur `garde_role` lève `ROLE_RESERVE_PROPRIETAIRE` dès que `new.role is distinct from old.role` sans `is_owner()`. La règle est bien en base, conformément à la convention du projet. La bascule d'atelier est bloquée par le `WITH CHECK` sur `atelier_id`.

**Relais e-mail.** `notifications` n'a **que des policies SELECT** : aucun `INSERT` n'est possible depuis un compte connecté, malgré le GRANT. Un compte ne peut donc pas choisir destinataire, sujet et corps d'un message partant du serveur d'envoi : tout passe par des RPC qui déduisent le destinataire de la base. Ce n'est pas un relais ouvert.

**Transport et navigateur.** `frame-ancestors 'none'` + `X-Frame-Options: DENY`, HSTS 2 ans avec `preload`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive, `nosniff`. Les pages à jeton renvoient `X-Robots-Tag: noindex, nofollow, noarchive`. Les source maps sont en 403. Un seul `dangerouslySetInnerHTML` dans tout le code, pour le JSON-LD, avec échappement du `<`. Seule variable `NEXT_PUBLIC_` sensible : la clé publiable Supabase, qui est publique par conception.

## Constats détaillés

### 1. Métadonnées d'atelier lisibles en anonyme — moyen

Cinq fonctions `SECURITY DEFINER` prennent un `atelier uuid` en paramètre et sont exécutables par `anon` sans jeton : `plan_effectif`, `sieges_occupes`, `sieges_autorises`, `capacite_ouverte`, `acces_comptables_occupes`.

Preuve, exécutée sous `set local role anon` :

```
plan_fuite | sieges | sieges_max | capacite
certifie   |      1 |         10 | true
```

Ce qu'un attaquant obtient : pour un atelier dont il connaît l'UUID, le plan payé, le nombre de sièges occupés et achetés, et les capacités ouvertes. C'est de l'information commerciale sur un client (un concurrent apprend qui paie quoi), plus une confirmation d'existence utile à un attaquant. L'exploitation suppose de connaître l'UUID, qui n'est **pas** exposé par les pages publiques — d'où la gravité moyenne et non élevée.

Correction : ces fonctions n'ont pas besoin de `anon`. Les révoquer nominativement et ne garder que `authenticated`, en vérifiant d'abord que la page d'invitation (`invitation_publique`) n'en appelle aucune avant connexion.

### 2. Pièce jointe sans borne de taille — moyen

`joindre_piece_jointe_notification` ne contient aucun contrôle de longueur (`octet_length`) et ne lève aucune exception. Un compte connecté peut attacher un base64 arbitrairement gros : ligne énorme en base, `pg_net` qui pousse le tout vers le relais PHP, coût et risque d'indisponibilité de l'envoi pour tout l'atelier.

Correction : borner à ~10 Mo par pièce et ~20 Mo par message, en base, avec un message d'erreur en français.

### 3. Proxys ouverts sans limitation de débit — ~~moyen~~ **constat erroné, corrigé le 7/09**

J'avais conclu que `/api/adresse` et `/api/entreprise` étaient ouvertes, en me fondant sur l'absence d'appel à `getUser()` dans leur code. **C'était faux** : `src/middleware.ts` les protège déjà par `PREFIXES_PRIVES` depuis le 20 août, et un `curl` anonyme en production reçoit bien une redirection vers `/login`, pas les données. La leçon vaut d'être notée : un contrôle d'accès peut vivre ailleurs que dans le fichier de la route, et lire le code d'un seul fichier ne prouve rien.

Un contrôle de session a tout de même été ajouté **dans les routes elles-mêmes**, en défense en profondeur : la protection ne dépend plus de la seule liste du middleware, qu'un oubli d'entrée suffirait à contourner.

Reste vrai, en revanche : la limitation de débit de `/api/leads` est **en mémoire du processus**, donc quasi inopérante sur des fonctions serverless où chaque instance a sa propre mémoire. Le vrai garde-fou est la policy en base, ce qui suffit aujourd'hui.

### 4. GRANT trop larges sur `notifications` — faible

`authenticated` détient INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER. Aujourd'hui sans effet, la RLS n'ayant aucune policy d'écriture. Mais le jour où quelqu'un ajoute une policy `INSERT` permissive pour une raison quelconque, le relais s'ouvre d'un coup. Révoquer ce qui ne sert pas.

### 5. Fonctions exécutables par `PUBLIC` — faible

`capacite_ouverte`, `jeu_jantes_public`, `portail_client`, `portail_vu`, `signer_bl`, `signer_jeu_jantes` sont exécutables par `PUBLIC` en plus de `anon`, contrairement à leurs voisines. C'est la trace du piège déjà rencontré et corrigé sur `signer_devis` : un `drop function` suivi d'un `create` rend `EXECUTE` à `PUBLIC` par défaut. Sans conséquence pratique (PostgREST ne route que par `anon` et `authenticated`), mais l'incohérence finira par masquer un vrai oubli.

### 6. Confirmation d'e-mail désactivée — faible, décision d'Alexis

Rappel du constat du 3 septembre, inchangé : quelqu'un peut créer un atelier avec l'adresse d'un tiers. L'impact reste faible tant que l'inscription ne déclenche pas de facturation, mais à l'ouverture de Stripe cela mérite d'être rebasculé.

## Ce que je n'ai pas pu vérifier

- Le **relais PHP** `tg-mailer.php` lui-même (hébergé sur thermopoudre.fr, hors périmètre de ce dépôt) : son secret d'appel, sa validation d'entrée et ses propres bornes.
- Les **tests d'intrusion au navigateur** (IDOR réels sur les écrans, écritures depuis la démo, comportement de `/api/assistant` sous rafale, contenu exact des réponses réseau) : l'agent qui devait les mener a été interrompu par la limite d'usage hebdomadaire. Les vérifications équivalentes ont été faites côté base et côté code, mais pas depuis un navigateur réel.
- La **limitation de débit effective** sur `/api/assistant` : le quota journalier par plan est appliqué en base et vérifié, mais rien n'empêche une rafale à l'intérieur du quota.
