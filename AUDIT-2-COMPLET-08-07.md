# Thermogestion — Audit n°2 (08/07/2026, soir)

*Périmètre : front office (vitrine), back office (app atelier), accès client final (/d et /s). Méthode : performance-report + design-critique + ux-copy, sur captures réelles du site en prod (dont pages client testées avec le jeu de démo « Atelier Démo Thermolaquage » créé pour l'occasion — réutilisable pour tes démos commerciales : devis DV-2026-0001 à 552 €, projet PR-2026-0001 en cuisson).*

## Verdict global

Depuis l'audit n°1 ce matin : 9 points sur 12 réglés et vérifiés en prod. La vitrine est passée de « page vide » à un vrai site avec identité, preuves produit et légal. **Mais l'audit a trouvé 1 bug critique** (analytics muette) **et 2 promesses non tenues dans le produit** (multi-utilisateurs vendu mais impossible, essai 30 jours invisible).

---

## PARTIE 1 — Performance marketing (données réelles)

### Les chiffres (premiers relevés)

| Métrique | Valeur | Lecture |
|---|---|---|
| Événements analytics | **0 réel** (1 test SQL) | 🔴 **BUG TROUVÉ** : `track.ts` n'exécutait jamais l'insert (thenable non awaité). Corrigé dans le code, **à déployer** — d'ici là, le site est aveugle |
| Emails transactionnels | 1 envoyé, 0 erreur | ✅ la chaîne pg_cron → mailer fonctionne |
| Comptes réels | 1 (toi) | Normal, pré-lancement |
| Vitrine | complète (identité, vignettes produit, tarifs, légal) | ✅ vs page vide ce matin |

### Reste du funnel — état vs audit n°1

| Point audit n°1 | État |
|---|---|
| Vitrine déployée | ✅ fait (+ refonte bleue + vignettes) |
| Pages légales | ✅ en ligne — ⚠️ placeholders SIRET/adresse à remplir, relecture juridique à faire |
| Emails notifications | ✅ opérationnel |
| Analytics | 🔴 déployé mais muet (bug ci-dessus) |
| SMTP Supabase Auth | ❌ toujours par défaut (~3 mails/h) — bloquant avant d'inviter des pilotes |
| Démo vidéo, pilotes thermocrm, i18n | ❌ à venir (assumé) |

### Nouveaux constats marketing

1. **SEO on-page inexistant** : un seul `<title>` global pour tout le site — les pages publiques client affichent « Thermogestion — le logiciel des ateliers… » dans l'onglet au lieu de « Devis DV-2026-0001 — Atelier Démo ». Pas d'OG image (les partages WhatsApp/LinkedIn seront moches), pas de favicon, pas de sitemap.
2. **Boucle virale ratée** : les pages /d et /s sont vues par **les clients de tes clients** — des donneurs d'ordres qui connaissent d'autres ateliers. Aucune mention « Propulsé par Thermogestion » avec lien. C'est le canal d'acquisition gratuit le plus naturel du produit.
3. **Le plan Atelier (89 €) promet « utilisateurs illimités »** … et l'app n'a **aucun moyen d'inviter un employé**. Promesse de vente non tenue = churn assuré. À construire avant tout pilote en plan Atelier.
4. **L'essai 30 jours est invisible** dans l'app : aucun bandeau « J-23 », aucune page abonnement. L'utilisateur ne sait ni où il en est, ni comment payer. La conversion trial→payant n'a aucun mécanisme.

---

## PARTIE 2 — Critique design par zone

### Front office (vitrine) — bon niveau

Ce qui marche : hiérarchie nette, palette TP cohérente, vignettes téléphone crédibles et nettes, section tarifs lisible.

| Constat | Sévérité | Reco |
|---|---|---|
| Pas de favicon ni d'icônes PWA (onglet générique) | 🟡 | Générer favicon + icons à partir du wordmark (pastille marine, TG cyan) |
| Vignettes invisibles sur mobile dans le hero (`hidden lg:flex`) — ta cible est sur téléphone | 🟡 | Afficher le téléphone sous le CTA en mobile (plus petit) |
| Section « L'app en vrai » : 3 téléphones côte à côte passent en colonne sur mobile = page très longue | 🟢 | Carrousel scroll-snap horizontal en mobile |
| Aucune animation d'entrée (page très statique) | 🟢 | Fade-up léger au scroll sur les sections (IntersectionObserver, 200 ms) — sobre |

### Accès client final (/d, /s) — fonctionnel, pas encore « waouh »

C'est LA vitrine indirecte du produit (vue par des non-clients). Captures analysées en conditions réelles.

| Constat | Sévérité | Reco |
|---|---|---|
| **Bouton « Accepter et signer » désactivé ressemble à un bouton actif délavé** — le client tape dessus, rien ne se passe, il croit que c'est cassé | 🔴 | État désactivé franchement gris + micro-texte « Renseignez votre nom et signez pour continuer » |
| Zone de signature = grand rectangle blanc muet | 🟡 | Placeholder « ✍️ Signez ici, au doigt ou à la souris » qui disparaît au premier trait |
| « 1 forfait » en colonne Qté (libellé unité maladroit) | 🟡 | Masquer la qté pour l'unité forfait ; afficher « — » |
| Aucun branding atelier (pas de logo, pas de couleur) ni identité Thermogestion sur /d et /s | 🟡 | Logo atelier en tête + pied « Propulsé par Thermogestion » (cf. boucle virale) |
| Téléphone atelier en texte mort sur /s | 🟡 | `tel:` cliquable + bouton « Appeler l'atelier » sur mobile |
| /s : barre verte + pastilles vertes/bleues Tailwind, décalé de la palette marine/cyan | 🟢 | Passer sur les tokens (brand/tpblue) |
| /s sur desktop : colonne perdue dans le vide | 🟢 | Carte centrée max-w-md avec bord, fond zinc-50 |
| Titre d'onglet = slogan marketing sur les 2 pages | 🟡 | `generateMetadata` par page : « Devis {numero} — {atelier} » / « Suivi {numero} — {atelier} » |

### Back office (app atelier) — le retard est ici

Les fixes de l'audit n°1 sont en place (toasts, erreurs FR, modal, scan confirmé, autosave). Les manques restants sont fonctionnels plus que cosmétiques :

| Constat | Sévérité | Reco |
|---|---|---|
| **Aucune gestion d'équipe** (inviter/désactiver un employé) alors que le plan Atelier la vend | 🔴 | Écran Réglages > Équipe : invitation par email (magic link), rôle staff, désactivation |
| **Aucune visibilité abonnement/essai** (ni bandeau J-X, ni page facturation) | 🔴 | Bandeau discret « Essai : 23 jours restants » + page Réglages > Abonnement (Stripe au sprint 4) |
| Workflow d'étapes non éditable (figé sur les 7 étapes par défaut) | 🟡 | Réglages > Workflow : réordonner/renommer/ajouter (écrit dans settings.workflow_defaut) |
| Pas de changement de mot de passe / email dans l'app | 🟡 | Réglages > Compte (supabase.auth.updateUser) |
| Spinner pleine page à chaque navigation (pas de skeletons) | 🟢 | Skeletons sur listes (3 cartes grises) |
| Dashboard : 4 cartes de même poids, pas de « prochaine action » | 🟢 | Section « À faire » : devis à relancer, projets en retard, poudres sous seuil |

---

## PARTIE 3 — Audit UX copy

### Le problème n°1 : tutoiement et vouvoiement mélangés

L'app tutoie (« Ajoute ton premier client », « Vérifie ta boîte mail », « réessaie ») ; la vitrine et les pages client vouvoient. Un artisan qui montre le devis à SON client donneur d'ordres ne doit jamais exposer du tutoiement. **Règle proposée** : vouvoiement partout où un client final ou un prospect peut passer (vitrine, signup/login, /d, /s, emails) ; le tutoiement peut rester DANS l'app connectée (ton outil complice) — ou tout vouvoyer pour simplifier l'i18n. À trancher, puis passe systématique.

### Réécritures recommandées (avant → après)

| Écran | Avant | Après |
|---|---|---|
| /d bouton désactivé | (rien n'explique) | « Renseignez votre nom et signez pour continuer » |
| /d signature | *(vide)* | « ✍️ Signez ici, au doigt ou à la souris » |
| /d confirmation | « L'atelier a été prévenu et vous tiendra informé de l'avancement. » ✓ bon | + « Vous recevrez un lien de suivi par email. » (dès que l'email client est en base) |
| Signup succès | « Vérifie ta boîte mail » | « Vérifiez votre boîte mail — le lien de confirmation vient de partir. » |
| Empty devis | « Aucun devis. » | « Aucun devis pour l'instant. Le premier prend 2 minutes, chrono. » |
| Empty projets | « Les devis signés arrivent ici automatiquement. » ✓ excellent | — garder |
| Dashboard bouton | « Voir l'atelier » | « Ouvrir l'atelier » (verbe d'action) |
| Réglages grille | (champs muets qui sauvent au blur) | Hint sous le titre : « Les modifications s'enregistrent automatiquement. » |
| Scan | « Ouvrir la fiche sans valider » ✓ très bon | — garder |
| Erreur générique | « Une erreur est survenue. Réessaie… » | Vouvoyer si règle retenue ; sinon OK |
| /s pied | « Une question ? 04 91 00 00 00 » | « Une question ? **Appelez l'atelier** » (lien tel:) |
| Emails | Sujets ✓ bons (« ✍️ Devis … signé par … ») | Ajouter un pied commun : « Propulsé par Thermogestion » + lien |

Bon réflexe déjà en place à préserver : vocabulaire métier juste (« Bon pour accord », « fiche suiveuse », « RAL », « couches »), CTA verbaux et spécifiques, messages d'erreur humains.

---

## Plan d'action priorisé (lot 3)

**Immédiat (bugs + promesses)**
1. 🔴 Déployer le fix analytics (corrigé dans le code, en attente de GO)
2. 🔴 État désactivé du bouton de signature + hint (le client final croit à une panne)
3. 🔴 Gestion d'équipe (le plan 89 € la promet)
4. 🔴 Bandeau essai + page abonnement minimale

**Ensuite (conversion & viralité)**
5. 🟡 « Propulsé par Thermogestion » sur /d, /s et emails
6. 🟡 Metadata par page (titres onglet, OG image, favicon)
7. 🟡 Passe tutoiement/vouvoiement (décision à prendre)
8. 🟡 Workflow éditable + Réglages > Compte
9. 🟡 SMTP Auth (toujours en attente — 10 min ensemble dans le dashboard Supabase)

**Confort**
10. 🟢 Skeletons, section « À faire » dashboard, /s aux couleurs, vignettes mobiles, tel: cliquable

Sur ton GO, je déroule le lot immédiat (1-4) puis 5-8 dans la foulée, comme cette nuit.
