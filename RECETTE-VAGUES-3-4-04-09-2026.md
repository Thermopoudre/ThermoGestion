# Recette vagues 3 et 4 — 4 septembre 2026

Exécution du cahier des charges v3 (`CAHIER-DES-CHARGES-V3-PREMIER-CLIENT.md`), suite des vagues 1-2 du 3 septembre. Chaque vague : développement par agents parallèles → test back (tsc, vitest complet sur la vraie base, build, sécurité SQL) → déploiement → recette front en production.

## État final en production (https://thermogestion-v2.vercel.app)

- **1 412 tests verts / 0 rouge** (86 fichiers), `tsc` propre, build 67 pages, `/` `/aide-publique` `/login` `/signup` statiques.
- Migrations appliquées : 56 → 64.
- Deux déploiements : vague 3 (Lots C + F + 7 correctifs vague 2), vague 4 (Lot G + reliquats E + 3 correctifs vague 3).

## Vague 3 — livré

**Lot C métier** : acompte à la commande (`devis.acompte_pct`, écran/PDF/page publique, facture d'acompte en un clic — bug trouvé et corrigé : l'acompte ignorait la remise du devis) ; taux horaire par personne (`users_couts`, utilisé par `projet_temps_cout`) ; balance âgée (`balance_agee()`, `/factures`, fiche client) + relevé de compte + lettre de relance PDF (L441-10) ; hors-ligne `/scan` (SW précache réel, file IndexedDB rejouée, horodatage réel du geste — `/pointage` poste partagé volontairement exclu : répartition calculée serveur) ; devis à options + paliers de quantité ; mentions B2C (médiateur paramétrable, rétractation 14 j) ; non-qualité dans `projet_revient` au prorata de la surface + phrase « ni consommables ni achats hors poudre ».

**Lot F assistant IA** : 12 outils en lecture seule adossés aux vues/RPC (session utilisateur, jamais service_role, aucun SQL généré), `rentabilite_*` derrière `ma_capacite('rentabilite')` ; journal `assistant_journal` insert-only (trigger d'inaltérabilité vérifié réellement), quota 10/30/60 par plan appliqué **en base** (trigger vérifié : 61ᵉ insert refusé) ; panneau replié en tête de `/pilotage` (44 px) ; bascule depuis ⌘K quand la recherche ne rend rien ; streaming SSE + `cache_control` ; sans `ANTHROPIC_API_KEY` → 503 propre « pas encore activé ». Modèles `claude-haiku-4-5` / `claude-sonnet-5` confirmés dans le SDK 0.123.

**Correctifs recette vague 2** : `ateliers.delai_paiement_jours` borné 0-60 (migration 62) ; libellés bains ; 2 instruments portaient un code de contrôle au lieu d'un code d'instrument (migration 63 + CHECK) ; dates FR dans les selects ; `Card` : `border-gray-200` écrasait `border-danger` — **15 écrans** rendaient leurs bandeaux d'erreur en gris, corrigé au composant ; titres d'onglet serveur (`page.tsx` + `Contenu.tsx`) sur 25 routes ; heure unique `12h25` déterministe (plus de dépendance ICU).

**Bloquants trouvés par le test back avant déploiement, corrigés (migration 64)** : verrou démo absent sur `users_couts` et `assistant_journal` ; `signer_devis` exécutable par PUBLIC après `drop function` ; policies redondantes ; export des deux tables.

## Vague 4 — livré

**Lot G SEO** : `/` statique (TTFB 480 ms → 0), H1 métier unique, title 51 / description 144, canonical, OG ; `/login` noindex, `/signup` distinct ; sitemap avec `lastmod` stables, `/login` retiré ; robots aligné sur `PREFIXES_PRIVES` du middleware, `/demo` autorisé (il était bloqué) ; JSON-LD `Organization.logo`, `SoftwareApplication.offers` importé de `lib/abonnement.ts` (79/129/249/5 €) ; `/aide-publique` (9 questions, FAQPage) ; `llms.txt`.

**Reliquats E** : 14 émojis → icônes ; ~50 boutons natifs avec `focus-visible` ; nouveau filtre `/projets?filtre=a_facturer` (le compteur « travail pas encore facturé » comptait des projets sans BL — le lien vers `/bl` ne pouvait rien montrer) ; rétractation 14 j toujours affichée pour un particulier (elle dépendait d'un flag jamais posé) ; sw.js `tg-v3`.

## Recette front finale — tout validé sauf

- **`/bl` vide sur « Tous » vu une fois, non reproduit** au diagnostic suivant (BL-2026-0011 affiché, requêtes 200, fiche OK). Double requête au montage (filtre par défaut puis filtre URL) protégée par le garde `annule` de `useListePaginee`. À surveiller.
- Non vérifiables en démo lecture seule : facture d'acompte sur devis signé, option cochée par le client sur `/d/`, coupure réseau réelle sur `/scan`, rendu mobile (émulation viewport indisponible dans l'extension). **À tester à la main sur ThermoTest / téléphone.**

## Réserves à arbitrer (Alexis)

1. **Texte juridique C6** (médiateur, rétractation) : à faire relire.
2. **robots.txt** : `/d/`, `/f/`, `/portail/` restent hors disallow (noindex par en-tête `X-Robots-Tag`) — choix conservé, contraire à la lettre du CDC.
3. **C5** : le complément de forfait minimum n'est pas recalculé si l'acceptation d'options franchit un seuil à la signature.
4. Toujours côté Alexis : Stripe 8 tarifs + 3 vars Vercel (essai ThermoTest expire le **12/09**), domaine thermogestion.fr, mandat PA, DPA Anthropic + `ANTHROPIC_API_KEY`, relais PHP (`sender_name`/`reply_to`/`attachments`), choix de l'atelier pilote et de la date.
