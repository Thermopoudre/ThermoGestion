# Thermogestion — Cahier des charges unifié

*Mis à jour le 20 août 2026 après les sept chantiers de l'audit logiciel. Document de référence unique : fusion du cahier des charges métier et de l'état des lieux de mise en service. Remplace `CAHIER-DES-CHARGES-METIER.md` et `ETAT-DES-LIEUX-ET-PLAN-MISE-EN-SERVICE.md`. Recettes détaillées par lot : `RECETTE-LOT2.md`, `RECETTE-LOT3.md`, `RECETTE-LOT4.md`, `RECETTE-LOT5.md`, `RECETTE-LOT6.md`, `RECETTE-LOT9.md`, `RECETTE-LOT10.md`, **`RECETTE-CHANTIERS-20-08-2026.md`**. Module jantes : `MODULE-JANTES.md`.*

> ⚠️ **Les statuts de l'inventaire du §3 ont été refaits le 19/08/2026 par un audit contradictoire,
> puis mis à jour le 20/08/2026.** Ils mentaient dans les deux sens : #14, #15, #16, #23 et #24
> étaient déclarés ⬜ alors qu'ils sont livrés et utilisés ; #13, #28, #39, #52 et #61 étaient
> déclarés ✅ ou 🔶 alors que ce sont des coquilles. **Le détail, la preuve et le reste à faire de
> chaque ligne sont dans [`AUDIT-FONCTIONNEL.md`](AUDIT-FONCTIONNEL.md)** — c'est ce document-là
> qui fait foi sur l'état réel.
>
> Le compte au **20/08/2026 au soir**, sur **71 lignes** (65 + les 6 lignes ouvertes par les sept
> chantiers) : **30 opérationnelles, 24 partielles, 4 coquilles, 13 absentes.**
>
> **Un recul à connaître** : #57, la sauvegarde et l'export total promis dans les CGU, **a
> régressé**. Le code exporte 42 tables, la base en compte 56, et les dix manquantes portent
> l'IBAN, le taux horaire, les frais généraux et le prix d'achat au kilo — colonnes déplacées dans
> des tables satellites par le chantier « rôles ». Le test ne pouvait pas le voir : il se compare
> à lui-même.

**Décision d'Alexis** : on construit le produit d'abord. Le module de paiement est codé et déployé, mais il ne sera activé qu'en dernier, quand le SaaS sera jugé satisfaisant. La roadmap ci-dessous respecte cet ordre.

---

## 1. Où on en est vraiment

Thermogestion couvre le tronc commun d'un logiciel de gestion — devis, production, stock, suivi client, facturation — et depuis aujourd'hui l'ensemble du socle légal français. Ce qui manque n'est pas de la plomberie : c'est **le métier du thermolaquage**. Un atelier ne change pas d'outil pour un devis, il change pour son cahier de contrôles Qualicoat, sa planification de fournées et sa traçabilité de lot.

Deux échéances ouvrent une fenêtre commerciale rare : la facturation électronique (réception obligatoire pour toutes les entreprises au **1er septembre 2026**, émission TPE/PME au **1er septembre 2027**) et la pression énergétique sur les fours, qui pousse les ateliers à enfin mesurer leur coût de revient.

| Indicateur | 13/08 au matin | 19/08 *(mesuré par l'audit, puis lots 6 et 8)* | **20/08 au soir *(après les 7 chantiers)*** |
|---|---|---|---|
| Couverture métier thermolaquage | ~35 % | ~60 % | **~65 %** *(30 lignes opérationnelles et 24 partielles sur 71, + les 12 lignes du module jantes)* |
| Couverture du métier **jantes** | 0 % | Le seul logiciel du marché à le traiter | **Inchangé** *(cf. C0 et `MODULE-JANTES.md`)* |
| Couverture réglementaire | ~5 % | ~45 % | **~45 %** *(inchangé : les documents se génèrent ; les registres déchets et FDS comptent 1 ligne chacun — jamais utilisés)* |
| Produit utilisable par un vrai client | **Non** | Oui, avec réserves | **Oui** *(le manque qui rendait le produit inutilisable au-delà de 200 lignes — recherche et pagination — est fermé)* |
| Produit montrable et installable sans accompagnement | Non | Partiellement | **Partiellement** *(démo, onboarding, import : opérationnels)* |
| Prêt pour un atelier certifié Qualicoat | Non | Pas encore | **Pas encore** *(R1/R2 fermés au lot 6, mais **aucun des trois PDF n'a jamais été relu par un auditeur** — c'est ce qui reste, et ce n'est pas du développement)* |
| Prêt pour une inspection ICPE 2940 | Non | Partiellement | **Partiellement** *(registre et FDS tenus par saisie manuelle que rien ne déclenche ; hors périmètre : Trackdéchets, ATEX, maintenance)* |
| **Cloisonnement par rôle** | Aucun | Aucun *(0 policy sur 50 regardait le rôle)* | **Appliqué en base** *(4 rôles, 49 policies sur 90 nomment un rôle, 4 tables satellites pour l'IBAN, le taux horaire et les prix d'achat)* |
| **Traçabilité des modifications** | Aucune | Aucune *(`audit_logs` : 0 ligne, rien ne l'écrivait)* | **Câblée, jamais exercée** *(trigger sur 15 tables, table inaltérable, rétention 730 j — et toujours 0 ligne en production)* |
| Réversibilité promise dans les CGU | Non tenue | Tenue *(38/42 tables)* | **⚠️ Retombée** *(42 tables exportées pour 56 en base ; l'archive perd l'IBAN, le taux horaire, les frais généraux et le prix d'achat au kilo — cf. AUDIT-FONCTIONNEL #57)* |

### Ce qui avait été corrigé le 18/08

Le cahier des charges du 13/08 partait d'hypothèses qui n'étaient plus vraies. Le **module facture existe** et est déployé. Surtout, trois découvertes ont changé la nature du travail :

**L'authentification était cassée pour tout le monde.** Les comptes créés par insertion SQL en juillet avaient des colonnes de jetons à `NULL`, ce qui faisait planter GoTrue sur *toute* opération — y compris l'inscription d'un nouvel utilisateur sans rapport. Personne ne s'était jamais connecté à l'application depuis sa création. Réparé et vérifié.

**N'importe qui pouvait marquer une facture comme payée.** La migration censée verrouiller la fonction révoquait les droits à `anon` et `authenticated` mais pas au rôle `PUBLIC` dont ils héritent — elle ne protégeait donc rien. Avec le seul jeton présent dans l'URL envoyée au client. Corrigé, vérifié de l'extérieur.

**La page de signature de devis était exposée au clickjacking**, faute d'en-têtes de sécurité. Corrigé.

Et en complément : réinitialisation de mot de passe (elle n'existait pas du tout), SMTP Brevo, mentions légales complètes, identité légale et facturation électronique dans l'app, bascule d'hébergement du VPS vers Vercel.

---

## 2. Le métier, pour cadrer

### Le parcours réel d'une pièce

```
Contact → Devis → Réception physique (comptage, état, photos)
   → Accrochage → Prétraitement (dégraissage / décapage / sablage / phosphatation)
   → Séchage / dégazage → Masquage → Poudrage (cabine, teinte, réglages pistolet)
   → Cuisson (courbe, sonde) → Refroidissement → Décrochage
   → Contrôles (épaisseur, brillance, adhérence, aspect) → Retouche éventuelle
   → Emballage / palettisation → BL signé → Facture → Encaissement
```

Chacune de ces étapes produit une donnée que l'atelier note aujourd'hui sur un carnet, un tableau blanc ou un Excel — et qu'il perd.

### Les six profils de clients d'un atelier

| Segment | Volume | Ce qu'il exige | Impact produit |
|---|---|---|---|
| Menuisier alu / fabricant | Fort, récurrent | Prix au **ml** négocié, BL par livraison, **facture mensuelle récapitulative** | Tarifs client, BL, facturation groupée |
| Serrurier-métallier | Moyen, récurrent | Devis rapide, délais courts | Couvert |
| Industriel / série | Fort, contractuel | Contrat-cadre, PV de contrôle, **certificat de conformité**, traçabilité lot | Qualité + contrats |
| Concession / garage (jantes) | Moyen | Teinte d'origine, 48-72 h, prix à la jante | **Module jantes dédié — cf. `MODULE-JANTES.md`** |
| Particulier | Faible, ponctuel | Devis clair, suivi, photos | Couvert |
| Collectivité / mobilier urbain | Ponctuel, gros | Marché public, garantie, Qualicoat exigé | Qualité + documents |

### Les contraintes réglementaires qui structurent l'atelier

**ICPE 2940** (application de revêtement) : déclaration ou enregistrement selon les quantités, registre et contrôles associés. **ATEX** : la cabine poudre est une zone à atmosphère explosive, vérifications périodiques et formation. **Déchets dangereux** : boues de cabine, poudre périmée, bains usés, avec registre et bordereaux Trackdéchets. **Labels Qualicoat / Qualisteelcoat / Qualimarine** : cahier de contrôles journalier conservé et présenté à l'audit annuel. **Facturation électronique** : réception au 1er septembre 2026, émission TPE/PME au 1er septembre 2027, format structuré via plateforme agréée.

---

## 3. Inventaire complet — 61 fonctions + le module jantes, avec leur statut réel *(refait le 19/08/2026, cf. `AUDIT-FONCTIONNEL.md`)*

### C0. Rénovation de jantes — *le seul métier qu'aucun concurrent ne traite*

*Livré le 19/08/2026 — conception, décisions et réserves dans [`MODULE-JANTES.md`](MODULE-JANTES.md).*

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| J1 | **Dossier jeu de jantes** rattaché au client et au véhicule, avec chaque jante et son état | ✅ | ⭐⭐⭐ | — | — |
| J2 | **Chiffrage au jeu** — palier au pouce × dessin × finition, adossé à la grille du client | ✅ *(un garage sous contrat hérite de son prix à la jante ; testé)* | ⭐⭐⭐ | — | — |
| J3 | **Teinte d'origine constructeur** mémorisée par véhicule + recherche dans le catalogue Thermopoudre | ✅ *(l'arbre OEM de la boutique remonte en tête ; saisie manuelle si `TP_WS_KEY` absente)* | ⭐⭐⭐ | — | — |
| J4 | **Reprise en un geste** — choisir le véhicule reprend le dernier jeu (diamètre, dessin, finition, teinte, TPMS) | ✅ | ⭐⭐⭐ | — | — |
| J5 | **Parcours de production dédié** — dépose pneu, décapage, dévoilage, sablage, laquage, cuisson, diamantage, vernis, repose pneu, équilibrage | ✅ *(second workflow configurable, choisi automatiquement par le devis)* | ⭐⭐⭐ | — | — |
| J6 | **Suivi jante par jante** — une jante en retouche pendant que les trois autres sont prêtes | ✅ *(règle en base : le jeu n'est pas « prêt » tant qu'une jante ne l'est pas)* | ⭐⭐⭐ | — | — |
| J7 | **Bon de prise en charge** public, signable, avec photos **par jante** + PDF serveur | ✅ | ⭐⭐⭐ | — | — |
| J8 | **Opérations mécaniques** — dévoilage, redressage, soudure, dépose/repose pneu, équilibrage, valve TPMS, diamantage | ✅ *(prestations distinctes, quantifiées au nombre de jantes concernées)* | ⭐⭐ | — | — |
| J9 | **Documents qui parlent jantes** — « Jeu de 4 jantes 19″ — BMW Série 3 — teinte d'origine Frozen Grey (C3Z) — diamantée », du devis à la facture | ✅ *(couture devis → BL → facture figée par test)* | ⭐⭐⭐ | — | — |
| J10 | Étiquette / fiche suiveuse **par jante** | ⬜ *(le QR est au niveau du projet — même chantier que #13)* | ⭐⭐ | Faible | P2 |
| J11 | Contrôle qualité rattaché à une jante et non au jeu | ⬜ | ⭐ | Faible | P3 |
| J12 | Alerte poussée sur un jeu promis à 48 h non prêt | ⬜ *(le délai est le critère de choix du garage — cf. J-5 de `MODULE-JANTES.md`)* | ⭐⭐⭐ | Moyen | **P1** |



Statut : ✅ fait · 🔶 partiel · ⬜ à faire. Priorité P1 à P3.

### C1. Qualité & certification — *le différenciateur n°1*

*Livré le 18/08/2026 — cf. `RECETTE-LOT2.md`.*

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 1 | **Cahier de contrôles journalier** — épaisseur (mini/maxi/moy.), brillance 60°, adhérence ISO 2409, Buchholz, polymérisation, aspect. Export PDF pour l'audit. | ✅ *(verdict d'épaisseur calculé sur le mini, pas sur la moyenne)* | ⭐⭐⭐ | — | — |
| 1b | **Seuils de contrôle paramétrables par atelier et par référentiel** — épaisseur mini et maxi, tolérance de brillance, classe d'adhérence, Buchholz. Valeurs Qualicoat classe 1 en défaut, explication de chaque seuil à l'écran. | ✅ *(**R1/R2 fermés par le lot 6** : le verdict est rendu par la base — `verdict_controle` en plpgsql — et la valeur envoyée par le client est ignorée dans les deux sens ; plus aucune policy `DELETE` sur `controles`)* | ⭐⭐⭐ | — | — |
| 2 | **Registre des bains** — pH, conductivité, température, titrages, alertes de renouvellement | 🔶 *(saisie et registre PDF : oui. **Aucune alerte de renouvellement** — `renouvele` est un simple booléen)* | ⭐⭐⭐ | — | — |
| 3 | **Certificat de conformité PDF** — teinte, lot poudre, épaisseurs, cuisson, label, garantie | ✅ *(4 blocages : sans épaisseur, contrôle non conforme en vigueur, cuisson non tracée, instrument non étalonné)* | ⭐⭐⭐ | — | — |
| 4 | Non-conformités & retouches, Pareto des défauts | ✅ | ⭐⭐ | — | — |
| 5 | Suivi des certifications, alertes de renouvellement | ✅ *(table `certifications` avec échéance, alerte à J-90 ; une certification expirée n'est plus imprimée)* | ⭐ | — | — |
| 6 | Étalonnage des instruments | 🔶 *(préavis 30 j : oui. Aucun historique — la date précédente est écrasée — et aucun certificat d'étalonnage attachable)* | ⭐ | — | — |

*Typologie de défauts à pré-charger : peau d'orange, cratères (silicone), piqûres/dégazage, coulure, manque d'accroche, faïençage, sur/sous-épaisseur, cage de Faraday, mélange époxy-polyester, marque de crochet, écart de teinte entre lots, brillant non conforme.*

### C2. Production & planification — *le vrai goulot*

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 7 | **Planification des fournées** — groupement par teinte et cycle compatible, jauge de remplissage | ✅ *(cycle incompatible = blocage dur ; changement de teinte = simple avertissement)* | ⭐⭐⭐ | — | — |
| 8 | **Capacité & charge** — taux de charge, date de livraison réaliste proposée | ✅ *(capacité × cycles/jour × remplissage moyen ; aucune date proposée si le four n'est pas paramétré)* | ⭐⭐⭐ | — | — |
| 9 | Fiche de cuisson tracée — n° de fournée, consigne, température relevée, opérateur | ✅ *(PDF avec écart consigne/relevé, pièces embarquées, lot poudre, cartouches de visa)* | ⭐⭐ | — | — |
| 10 | Supports/racks et **chevalets consignés** prêtés au client | ⬜ | ⭐⭐ | Moyen | P2 |
| 11 | **Temps passé par étape** — pointage au scan QR déjà en place | 🔶 *(la chaîne tourne jusqu'au prix de revient. **La 1re étape n'est jamais ouverte, le chrono ne se ferme jamais** : deux cartes de la fiche projet se contredisent — cf. R8)* | ⭐⭐ | Faible | **P1** |
| 12 | Écran atelier (TV) | ⬜ | ⭐ | Faible | P3 |
| 13 | **Étiquettes pièces / fiche suiveuse** A5-A6 avec QR | ⬜ *(**coquille** : le QR existe et le scan marche, mais aucun PDF A5/A6 n'existe — l'écran dit pourtant « imprimez ce QR sur la fiche suiveuse »)* | ⭐⭐ | Faible | **P1** |

### C3. Commercial & devis

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 14 | **Tarification au mètre linéaire** — profilés alu, surface développée | ✅ *(le ⬜ était faux : onglet de réglage, bouton `+ ml` sur le devis, surface développée, 6 tarifs en base)* | ⭐⭐⭐ | — | — |
| 15 | **Tarifs négociés par client** | 🔶 *(le ⬜ était faux : `client_tarifs` et `remise_pct` sont appliqués au devis. `clients.grille_id` reste une coquille — aucun écran ne crée de 2e grille)* | ⭐⭐⭐ | Faible | P2 |
| 16 | **Bibliothèque de pièces types** — portail 3 m, jante 19", garde-corps | 🔶 *(le ⬜ était faux : 7 pièces en base, `coef_complexite` appliqué. `longueur_ml`, `perimetre_mm` et `temps_minutes` sont des coquilles. **Les jantes ne passent plus par là** : elles ont leur barème au pouce — cf. C0)* | ⭐⭐ | Faible | P2 |
| 17 | Calculateur de surface (tube, tôle, profilé, portail à barreaux) | 🔶 *(un assistant périmètre × longueur existe, mais **il est branché sur la mauvaise branche** : le bouton `+ ml` ne le montre jamais. Ni tôle ni portail à barreaux)* | ⭐⭐ | Faible | **P1** |
| 18 | **Relances automatiques de devis** — J+7/J+15/J+30 | ✅ *(20/08 : cadence et plafond **réglables par atelier**, interrupteur par client **et** par document, écran `/relances` qui annonce la date que le cron appliquera. Le reste dû déduit les paiements — pas encore les avoirs)* | ⭐⭐⭐ | — | — |
| 19 | **Versions & duplication de devis** | ✅ *(20/08 : `dupliquer_devis` / `_facture` / `_projet`, `nouvelle_version_devis`, `rouvrir_devis`. `parent_id` et `version` ne sont plus des colonnes mortes — le chaînage se lit sur la fiche)* | ⭐ | — | — |
| 20 | Devis multilingue FR/IT/EN | ⬜ | ⭐ | Moyen | P3 |

### C4. Facturation & encaissement

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 21 | **Module facture** — acompte/solde/libre/avoir, numérotation, mentions légales complètes | ✅ *(20/08 : `annuler_facture(id, motif)` pose enfin le statut « annulée », lu partout en aval depuis l'origine ; `avoir_depuis_facture` fait l'avoir total ou partiel, avec **plafond de cumul en trigger**)* | ⭐⭐⭐ | — | — |
| 21b | **Identité légale + 4 mentions e-facture** — SIREN client, adresse de livraison, nature d'opération, TVA sur les débits | ✅ | ⭐⭐⭐ | — | — |
| 22 | **Facture électronique Factur-X** — PDF/A-3 + XML, plateforme agréée | ✅ *(profil MINIMUM ; PDF/A-3B validé veraPDF ; plateforme hors périmètre)* | ⭐⭐⭐ | — | — |
| 23 | **Facture mensuelle récapitulative** — standard absolu chez les menuisiers | ✅ *(le ⬜ était faux. **La remise des BL était perdue — corrigé le 19/08**, 4 tests posés. Reste : un BL facturé hors récap n'est pas marqué, cf. R4)* | ⭐⭐⭐ | — | — |
| 24 | **Bon de livraison + signature** à la livraison, photos de remise | 🔶 *(le ⬜ était faux : BL, PDF et signature publique opérationnels. **Photos de remise absentes** — `photos` n'a pas de `bl_id`)* | ⭐⭐⭐ | Faible | **P1** |
| 25 | Paiement en ligne des factures (Stripe Connect) | 🔶 *(code complet et correct, **mort en production** : `STRIPE_SECRET_KEY` absente. Et le lien est créé au TTC sans déduire les acomptes)* | ⭐⭐ | — | — |
| 26 | Relances impayés, balance âgée | 🔶 *(20/08 : écran `/relances` et interrupteurs livrés. **La balance âgée reste absente** — pas de tranches 0-30/30-60/60-90/90+)* | ⭐⭐ | Faible | P2 |
| 27 | Export comptable CSV/FEC + Pennylane / Axonaut | 🔶 *(20/08 : le **cabinet** a désormais son accès en lecture seule et son export FEC de période — cf. #62. Toujours aucun connecteur Pennylane ni Axonaut)* | ⭐⭐ | Moyen | P2 |
| 28 | Acomptes & situations | ✅ *(**R6 fermé par le lot 6** : le devis reste facturable après un acompte, le solde déduit les versements en ligne explicite par acompte et par taux de TVA, `facture_liee_id` est écrite. Reste : aucune facture de situation en %)* | ⭐⭐ | — | — |
| 28b | **PDF généré côté serveur** — aujourd'hui c'est l'impression navigateur | ✅ | ⭐⭐⭐ | Moyen | — |

### C5. Stock, poudres & achats — *l'axe Thermopoudre*

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 29 | **Traçabilité lot poudre → projet** | ✅ *(le 🔶 était pessimiste : 12/12 projets ont un `lot_id`, FIFO au décompte, lot repris sur le certificat)* | ⭐⭐⭐ | — | — |
| 30 | **DLU / péremption** par lot, alerte J-60 | 🔶 *(20/08 : le seuil est **réglable par atelier** (`reglages_alertes.seuil_dlu_jours`) et vit dans un seul fichier au lieu de cinq ; la DLU en approche entre dans le courriel du matin. **Mais aucun courriel n'est encore parti** — premier envoi attendu le 21/08 à 07 h 05)* | ⭐⭐ | Faible | **P1** |
| 31 | Poudre recyclée, taux de réemploi | ⬜ | ⭐⭐ | Moyen | P2 |
| 32 | **Rendement réel vs théorique** — taux de perte par teinte et opérateur | 🔶 *(par teinte : oui. Par opérateur : non. Et **sans pesée la vue est vide** — 4 poudres sur 10 ont un taux, il n'existe que 4 pesées en base)* | ⭐⭐⭐ | — | — |
| 33 | Consommables (masquage, crochets, abrasifs) | ⬜ | ⭐⭐ | Faible | P2 |
| 34 | **Commande Thermopoudre intégrée**, réception qui incrémente le stock | 🔶 *(panier + bon de commande par mail + réception en lots ; commande posée dans PrestaShop : cf. RECETTE-LOT4 §A2)* | ⭐⭐⭐ | — | P2 |
| 35 | **Catalogue teintes intégré** — RAL + origines constructeurs, import fiche poudre 1 clic | ✅ | ⭐⭐⭐ | Moyen | — |
| 36 | Nuancier client par lien | ⬜ | ⭐⭐ | Moyen | P2 |

### C6. Client & relation

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 37 | **Réception des pièces avec photos horodatées** — première cause de litige | 🔶 *(le ⬜ était faux : écrans, bon public et Storage cloisonné sont en place. **0 photo en base pour 5 réceptions** — l'erreur d'insertion est avalée, cf. AUDIT-FONCTIONNEL C6)* | ⭐⭐⭐ | Faible | **P1** |
| 38 | Portail client pro avec compte | 🔶 *(20/08 : un **espace par client à jeton révocable**, `/portail/<jeton>`, désactivé par défaut — devis, factures avec reste dû (avoirs déduits), projets, bons de livraison. **Ce n'est pas un compte** : ni identifiant, ni mot de passe, ni dépôt de document. 26 épreuves de cloisonnement)* | ⭐⭐ | Élevé | P2 |
| 39 | **Avis Google automatisé** J+2 | 🔶 *(**coquille de fait** : tout est câblé, **0 sollicitation n'a jamais pu partir** — la seule URL renseignée est sur l'atelier démo, où l'écriture est refusée)* | ⭐⭐ | — | — |
| 40 | Galerie avant/après, export réseaux sociaux | ⬜ *(0 occurrence dans le code ; seules les photos par étape existent)* | ⭐⭐ | Faible | P2 |
| 41 | Historique & relance commerciale, clients dormants | ⬜ | ⭐⭐ | Moyen | P2 |
| 42 | SMS / WhatsApp « vos pièces sont prêtes » | ⬜ | ⭐⭐ | Moyen | P2 |

### C7. Pilotage & rentabilité

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 43 | **Prix de revient réel** — poudre + main d'œuvre + énergie four + consommables | 🔶 *(poudre, main d'œuvre, énergie, frais généraux : oui. **Consommables absents** (cf. #33) et la non-qualité n'est pas imputée au projet, contrairement au client)* | ⭐⭐⭐ | — | — |
| 44 | Tableau de bord de gestion (m², CA, marge, charge four, top teintes) | 🔶 *(écran Pilotage : charge du four, rentabilité client, rendement teintes ; pas de série temporelle de CA)* | ⭐⭐ | Moyen | P2 |
| 45 | Coût énergétique par fournée | 🔶 *(kWh relevés et imputés au projet au prorata de surface ; pas valorisés en euros à l'échelle de la fournée)* | ⭐⭐ | Faible | P2 |
| 46 | Rentabilité par client | ✅ *(marge, m² moyen, délai accordé, retouches ; le coût de non-qualité est imputé au client)* | ⭐⭐⭐ | — | — |

### C8. Réglementaire & sécurité

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 47 | Registre déchets, BSD / Trackdéchets | 🔶 *(lot 5 : registre chronologique R.541-43 avec nomenclature pré-chargée, bordereaux manquants signalés, export PDF paysage. **Raccordement Trackdéchets non fait** : le n° de bordereau se saisit à la main)* | ⭐⭐ | — | — |
| 48 | Classeur FDS accessible depuis mobile | 🔶 *(lot 5 : recherche sans accent en tête d'écran, alerte sur les fiches de plus de 3 ans, rattachement facultatif à une poudre du catalogue)* | ⭐⭐ | — | — |
| 49 | Vérifications périodiques (four, ATEX, extincteurs) | ⬜ | ⭐ | Faible | P3 |
| 50 | Maintenance des équipements | ⬜ | ⭐ | Moyen | P3 |

### C9. Plateforme & technique

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 51 | Notifications push PWA | ⬜ | ⭐⭐ | Moyen | P2 |
| 52 | Mode hors-ligne réel (bâtiment métallique = mauvais réseau) | ⬜ *(**coquille** : `sw.js` existe mais ne précache rien, ne couvre que 5 routes — **pas `/scan/[qr]`** — et n'a aucune file d'écriture)* | ⭐⭐ | Élevé | P3 |
| 53 | i18n FR/IT | 🔶 *(5 pages publiques traduites ; écrans atelier, PDF et mails en français)* | ⭐⭐ | Moyen | P2 |
| 54 | **Import de données** — CSV/XLSX : clients, poudres, prestations | ✅ | ⭐⭐ | — | — |
| 55 | Multi-sites | ⬜ | ⭐ | Élevé | P3 |
| 56 | API publique + webhooks | ⬜ | ⭐ | Moyen | P3 |
| 57 | Sauvegarde / export total (promis dans les CGU) | 🔶 **⚠️ a régressé le 20/08** *(le mécanisme reste bon — archive ZIP, un CSV par table + un JSON, lecture paginée et soumise aux RLS. Mais le périmètre a décroché : **42 tables exportées pour 56 en base**, et les 10 manquantes portent l'IBAN, le taux horaire, les frais généraux et le prix d'achat au kilo. **À refermer avant tout autre chantier** : c'est un engagement contractuel)* | ⭐⭐ | Faible | **P1** |
| 58 | **Onboarding guidé** — checklist de démarrage après inscription | ✅ | ⭐⭐⭐ | — | — |
| 59 | **Compte de démonstration** accessible depuis la vitrine | ✅ *(lecture seule garantie en base)* | ⭐⭐⭐ | — | — |
| 60 | **Domaine propre** (thermogestion.fr) | ⬜ *(0 occurrence de `thermogestion.fr` dans le code : le produit tourne sur `.vercel.app`. Le code est prêt, il ne manque que l'achat et `NEXT_PUBLIC_SITE_URL`)* | ⭐⭐⭐ | Faible | **P1** |
| 61 | Abonnement Stripe — *codé, activation reportée* | 🔶 *(**le paywall est armé, le tiroir-caisse ne l'est pas** : `exiger_abonnement` actif sur 32 tables, essai ThermoTest jusqu'au 12/09/2026, Stripe non configuré → cul-de-sac. Cf. R7)* | ⭐⭐⭐ | — | **Dernier** |

### C10. Ce que les sept chantiers du 20/08 ont ouvert

*Six lignes qui n'existaient pas dans l'inventaire. Détail, preuves et défauts trouvés en chemin
dans [`RECETTE-CHANTIERS-20-08-2026.md`](RECETTE-CHANTIERS-20-08-2026.md).*

| # | Fonction | Statut | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 62 | **Recherche globale + pagination serveur** — palette ⌘K sur 9 familles, colonne de recherche générée sur 10 tables, filtre et tri en base | ✅ *(c'était le seul manque qui rendait le produit **inutilisable** au-delà de 200 lignes. Reste : la recherche ne filtre pas la corbeille)* | ⭐⭐⭐ | — | — |
| 63 | **Trois rôles appliqués en RLS** — `owner`, `bureau`, `atelier` | ✅ *(49 policies sur 90 nomment un rôle, contre 0. L'IBAN, le taux horaire, les frais généraux et les prix d'achat vivent dans 4 tables satellites : un privilège de colonne ne pouvait pas distinguer trois rôles qui partagent `authenticated`)* | ⭐⭐⭐ | — | — |
| 64 | **Pièces jointes** sur client, devis, facture, projet — bucket privé plafonné à 10 Mo | ✅ *(la borne est côté service, pas côté écran — testé en déposant directement dans le bucket)* | ⭐⭐ | — | — |
| 65 | **Corbeille, restauration et alerte de doublon** | ✅ *(purge à 30 j ; on ne jette pas ce qui soutient un document comptable émis ; 4 index uniques et une seule normalisation partagée code/base)* | ⭐⭐ | — | — |
| 66 | **Journal des modifications** — 15 tables, champs modifiés seulement, rétention 730 j, table inaltérable | 🔶 *(complet et prouvé par test, mais **`audit_logs` compte 0 ligne** : le journal n'a jamais enregistré une modification réelle. C'est aussi ce qui manquait à la formule Certifié pour tenir sa promesse de preuve opposable)* | ⭐⭐⭐ | — | — |
| 67 | **Accès expert-comptable** — rôle en lecture seule, gratuit, plafonné à 2, hors siège facturé | 🔶 *(espace `/comptable`, journal des ventes, export FEC de période, remise périodique automatique. **0 cabinet ne l'a jamais ouvert.** L'audit le décrit comme un canal de distribution plutôt qu'une fonction : c'est encore à démontrer)* | ⭐⭐⭐ | — | — |

---

## 4. Roadmap — paiement en dernier

### Lot 1 — « L'atelier quitte son Excel » (le socle métier)

Réception des pièces avec photos · Bon de livraison signé · Tarifs négociés par client · Prix au mètre linéaire · Bibliothèque de pièces types · Facture mensuelle récapitulative · PDF serveur · Traçabilité lot poudre complète · DLU · Temps par étape · Étiquettes et fiche suiveuse.

*Objectif : un atelier peut abandonner son carnet et son tableur. C'est le minimum pour ne pas rougir en démo.*

### Lot 2 — « Le fossé concurrentiel » — *livré le 18/08/2026, cf. `RECETTE-LOT2.md`*

Cahier de contrôles Qualicoat ✅ · Registre des bains ✅ · **Certificat de conformité ✅** ·
Non-conformités et Pareto ✅ · Planification des fournées ✅ · **Capacité et date de livraison
réaliste ✅** · **Fiche de cuisson PDF ✅** · **Rendement réel vs théorique par teinte ✅** ·
Prix de revient réel ✅ · **Suivi des certifications avec alerte de renouvellement ✅** ·
**Rentabilité par client ✅**.

*Objectif : devenir le seul logiciel qui fait passer l'audit Qualicoat. C'est ce qui justifie un plan Pro à 129 €.*

**Une faille de cloisonnement fermée au passage.** La vue `projet_revient`, créée en migration 21
sans `security_invoker`, s'exécutait avec les droits de `postgres` — qui ignore RLS — et était
lisible par le rôle `anon`. N'importe qui muni de la clé publique présente dans le bundle
JavaScript lisait le prix de revient de **tous les projets de tous les ateliers** (14 lignes, 2
ateliers, mesuré avant correction). Les deux autres vues de la même migration portaient bien
l'option. C'est le quatrième verrou de ce projet qui « avait l'air correct » sans rien protéger,
après le `REVOKE` sans `PUBLIC`, le contrôle sur `current_user` en `SECURITY DEFINER` et
l'immutabilité de document qui n'existait que dans React. Corrigé, et **attaqué depuis un client
anonyme à chaque exécution de la suite de tests**.

**Un quatrième réglage fantôme fermé.** `ateliers.label_qualite` s'affichait sur l'écran Qualité
et en en-tête du registre PDF, mais aucun écran ne permettait de le renseigner : la valeur ne
pouvait venir que d'un `INSERT` SQL. La colonne a été supprimée au profit d'une table
`certifications` qui porte l'organisme, le numéro d'agrément et surtout la **date d'échéance** —
sans laquelle un label affiché ne veut rien dire.

### Lot 3 — « Connecté » (la boucle Thermopoudre) — *livré le 18/08/2026, cf. `RECETTE-LOT3.md`*

Catalogue teintes intégré ✅ · Import de fiche poudre en un clic ✅ · Facture électronique Factur-X ✅
(profil MINIMUM, XML validé XSD + schematron) · Export comptable CSV et FEC ✅ · Commande Thermopoudre
depuis l'app ⬜ (le réappro renvoie désormais sur la fiche produit exacte, pas sur une recherche
par mot-clé) · Portail client pro ⬜.

*Objectif : chaque atelier abonné devient un client poudre récurrent. Le coût d'acquisition du SaaS est remboursé par la marge poudre.*

**Deux réglages fantômes fermés au passage** (ils étaient réglables, enregistrés, et sans effet) :
le **forfait minimum de facturation** de la grille — plancher sur le total HT après remise, avec
une ligne « Forfait minimum » explicite sur le devis — et le **coefficient « nombre de couches »**,
désormais sélectionnable sur chaque ligne au m² et multiplié avec la finition et la complexité.
`pieces_types.coef_complexite` a été arbitré dans le même mouvement : il majore le prix de la pièce
type, qu'il vienne du prix catalogue ou de la grille au m².

### Lot 4 — « Prêt à vendre » — *livré le 18/08/2026, cf. `RECETTE-LOT4.md`*

Compte de démonstration ✅ (visitable sans inscription, écriture refusée par un trigger sur
l'atelier marqué `demo` — y compris par les fonctions `SECURITY DEFINER` et par le jeton public
d'un devis) · Onboarding guidé ✅ (checklist en 4 étapes cochées sur la donnée réelle) ·
Import CSV/XLSX ✅ (clients, poudres, prestations, avec aperçu et rapport de rejets motivés) ·
Avis Google J+2 ✅ (file `notifications`, une sollicitation par client et par trimestre) ·
i18n FR/IT 🔶 (les 5 pages publiques ; écrans atelier, PDF et mails restent en français) ·
Domaine propre 🔶 (plus aucune URL en dur ni dans l'app ni dans les mails ; l'achat et les 6 étapes
de bascule appartiennent à Alexis).

**Reliquats du lot 3 fermés au passage.** Le **Factur-X est désormais un PDF/A-3B validé par
veraPDF** (146 règles, 0 en échec, sur le fichier renvoyé par la production) : Liberation Sans est
incorporée, la même mesure sur la version précédente rendait FAIL sur la seule règle
d'incorporation des polices. Et la **commande de poudre** existe : panier alimenté par les alertes
de seuil et par la fiche poudre, bon de commande numéroté envoyé par mail avec copie à l'atelier,
réception qui crée un lot tracé et incrémente le stock. La commande n'est volontairement pas posée
dans PrestaShop : le webservice l'autoriserait, mais il n'en calcule ni le port ni la remise du
compte client — Thermogestion fabriquerait un prix que la boutique ne reconnaîtrait pas.

### Lot 5 — « Les deux réserves, puis la conformité » — *livré le 18/08/2026, cf. `RECETTE-LOT5.md`*

**Seuils de contrôle paramétrables ✅** (par atelier et par référentiel, valeurs Qualicoat classe 1
en défaut, explication de chaque seuil à l'écran, barème imprimé sur le registre et sur le
certificat) · **Recette des cinq pages publiques ✅** (cinq défauts trouvés, cinq corrigés) ·
**Export total des données ✅** · **Registre des déchets ICPE + classeur FDS ✅**.
Portail client ⬜ et notification SMS/WhatsApp ⬜ : non commencés.

**La non-rétroactivité des verdicts, tenue en base et attaquée de l'extérieur.** Chaque contrôle
porte désormais une copie figée des seuils qui lui ont été appliqués, posée par un trigger — pas par
le navigateur, qui pourrait mentir. Un second trigger refuse toute modification du verdict, des
valeurs, des seuils, du type, de la date et du rattachement. Sept tentatives d'écriture directe
depuis un client PostgREST ordinaire sont rejouées à chaque exécution de la suite. **Le garde-fou a
d'ailleurs été pris en défaut avant d'être validé** : sa première version bloquait aussi le
`ON DELETE SET NULL` de la clé étrangère, si bien que supprimer un référentiel échouait
*silencieusement*. C'est le cinquième verrou de ce projet à n'avoir tenu qu'après avoir été attaqué.

**Une remise disparue, pour la troisième fois.** Le bon de livraison recopiait les lignes du devis
**sans sa remise** : un client contractualisé à −12 % recevait un BL annonçant 12 % de plus que la
facture du lendemain. Après la remise qui disparaissait de la facture et celle qui était invisible
sur le devis, c'est la troisième occurrence de la même famille de bug — et la raison pour laquelle
`tests/pages-publiques.test.ts` fige désormais **le contrat des cinq RPC publiques** : une RPC qui
cesse d'exposer un champ fait tomber un test au lieu de faire disparaître de l'argent sur l'écran
d'un client. Trois autres défauts fermés au passage : un avoir intitulé « Facture » avec échéance et
IBAN, une facture annulée qui proposait toujours le paiement, et un devis dont le bloc de totaux ne
tombait pas juste (`13,50 − 1,62 = 25,00`, le forfait minimum étant compté sans être annoncé).

### Lot 6 — « Encaisser » *(en dernier, sur ta décision)*

Activation des tarifs Stripe · Bascule du blocage de fin d'essai · Arbitrage de la remise Thermopoudre.

*Le code est déjà écrit et déployé : blocage en lecture seule au terme de l'essai, page d'abonnement, portail de résiliation, garde en base de données. Il ne manque que la création des quatre tarifs dans Stripe et trois variables d'environnement. Activation en une heure le jour où tu le décides.*

**⚠️ Ce lot a maintenant une date butoir subie.** Le trigger `exiger_abonnement` est déjà actif sur
32 tables et l'essai de ThermoTest expire le **12/09/2026**. Le 13, l'atelier passe en lecture seule
et le bouton « Souscrire » renvoie une erreur 500, parce que Stripe n'est pas configuré : cul-de-sac
sans issue. Trois sorties, une à choisir avant la date — configurer Stripe, repousser `trial_end`,
ou désactiver les triggers.

### Lot 8 — « Le métier que personne ne traite » — *19/08/2026, cf. `MODULE-JANTES.md`*

**Le module jantes**, conçu et construit d'une traite : véhicules avec teinte d'origine mémorisée,
dossier de jeu, jante unitaire avec état constaté et photos, barème au pouce adossé à la grille du
client, parcours de production dédié, bon de prise en charge public signable, PDF opposable.

**Rien n'a été recréé.** La ligne de jantes est une ligne libre marquée dans son `meta`, comme la
ligne au mètre linéaire : facture, bon de livraison, PDF, Factur-X, FEC et export comptable la
consomment sans une ligne de code supplémentaire. Le barème se rattache à `grilles_tarifaires`, si
bien qu'un garage sous contrat hérite de son propre prix à la jante sans réglage. Et
`meta.surface_m2` alimente le calcul de surface du projet déjà écrit — poudre, énergie, charge du
four et prix de revient suivent seuls.

**Deux défauts trouvés à l'écran, pas dans un test** : la référence constructeur accolée à une
teinte qui n'était pas celle d'origine (le code d'une autre teinte, sur le devis d'un client), et
l'explication d'un réglage imprimée sur un document commercial. Corrigés dans la fonction, pas dans
l'appelant — trois écrans construisent ce libellé.

**Deux corrections transversales au passage** : `reception_public` joignait les photos sur
`projet_id` au lieu de `reception_id` (un client sans projet n'en voyait aucune, un client à
plusieurs réceptions voyait celles des autres), et deux aides de workflow étaient exposées en RPC
PostgREST — `_workflow_jantes` à `anon` dès sa création.

**+73 tests (428 au total), `npx next build` sans erreur, recette réelle en production, déployé.**
L'atelier de démonstration a été peuplé de deux dossiers réalistes : le différenciateur commercial
n°1 ne pouvait pas être un écran vide pour un prospect.

### Lot 7 — « L'audit de vérité » — *19/08/2026, cf. `AUDIT-FONCTIONNEL.md`*

Audit contradictoire des 61 lignes de l'inventaire : lecture du code et de la base, remontée de
chaque champ modifiable jusqu'à l'endroit où sa valeur est réellement lue, vérification des chaînes
plutôt que des écrans. **Onze coquilles supplémentaires trouvées** après les cinq déjà fermées, et
**douze ruptures de chaîne**, dont sept corrigées le jour même.

**La remise a disparu une quatrième fois — deux fois, en réalité.** La facture mensuelle
récapitulative aplatissait les lignes des bons de livraison **sans jamais ouvrir leur remise** : un
client contractualisé à −12 % était facturé plein tarif, et le Factur-X derrière portait le total
plein. Et `BonLivraisonEditor` redéfinissait *localement* une reprise de lignes qui perdait `meta`,
c'est-à-dire la marque du forfait minimum — remisant le plancher sur le bon. Les deux moitiés du
code étaient justes, c'est la couture qui ne l'était pas. `tests/facture-recapitulative.test.ts`
fige désormais ce contrat.

Corrigé au passage : un avoir numéroté `FA-` (rejet garanti à l'export FEC), un paiement partiel qui
marquait la facture « payée » et la sortait de la file de relance, la charge du four qui comptait
les projets déjà cuits, la fiche de cuisson devenue injoignable une fois la fournée clôturée, le
blocage d'étalonnage qui ne regardait que l'épaisseur, deux poudres identiques déclarées
incompatibles, l'écran Pilotage inaccessible sur mobile, et trois réglages fantômes câblés (TVA par
prestation, assujettissement à la TVA, accès au portail d'abonnement pour un client qui paie).

**Ce qui reste ouvert et qui compte** : ~~le verdict qualité n'est jamais recalculé côté serveur et un
contrôle peut être supprimé (R1/R2)~~ ✅ ; ~~un bon de livraison peut être facturé deux fois (R4)~~ ✅ ;
~~un acompte ferme la porte au solde (R6)~~ ✅ ; ~~le pointage n'ouvre jamais la première étape et ne
ferme jamais la dernière (R8)~~ ✅ — **fermés par le lot 6 le soir même** ; et la fiche suiveuse
n'existe toujours pas alors que le QR l'attend.

### Chantiers du 20/08 — « le logiciel, pas le métier » — *cf. `RECETTE-CHANTIERS-20-08-2026.md`*

Les sept points de tête de `AUDIT-LOGICIEL-20-08-2026.md` §5, faits d'une traite : **recherche
globale et pagination ✅** · **trois rôles réels appliqués en RLS ✅** · **dupliquer, corriger,
annuler, faire l'avoir ✅** · **pièces jointes, corbeille et doublons ✅** · **courriel du matin et
maîtrise des relances ✅** · **journal des modifications ✅** · **accès expert-comptable et portail
client ✅**. Plus tôt dans la journée : le siège utilisateur à 5 € HT et la remontée du Factur-X du
profil MINIMUM — hors socle depuis l'arrêté du 27/07/2026 — au profil **EN16931**, validé au XSD et
au schematron officiels sur douze formes de facture.

**923 tests, 50 fichiers, 4 ignorés · 67 pages · déployé.**

**Le vrai livrable de la journée, ce sont les défauts trouvés en chemin, pas les fonctions.**
Trois méritent d'être retenus ici :

1. **Le cron a relancé de vrais clients depuis l'atelier de démonstration**, le 19/08 à 7 h. Le
   verrou de lecture seule de la démo exempte les appels sans jeton JWT — nécessaire pour les
   travaux de fond — et `pg_cron` passait dessous. Aucun test ne pouvait le voir : ils
   s'authentifient tous.
2. **Le bouton « Prévenir le client » d'une facture n'a jamais fonctionné.** L'insertion dans
   `notifications` était refusée par la RLS depuis la mise en service — d'où **zéro
   `facture_emise`** sur les seize notifications parties.
3. **Une réversibilité promise dans les CGU a régressé sans qu'aucun test ne rougisse** (#57), le
   test se comparant à lui-même.

Trois verrous qui avaient l'air de tenir ne tenaient pas : `CREATE OR REPLACE VIEW` sans clause
`WITH` remet les `reloptions` à zéro et a fait reperdre un `security_invoker` ; `revoke … from
public` ne retire pas les `EXECUTE` accordés nommément à `anon` par les `ALTER DEFAULT PRIVILEGES`
de Supabase ; et les index GIN trigrammes sont **inertes sous RLS**, `textlike` n'étant pas
*leakproof* — ce qui rend la recherche rapide est la colonne stockée, pas l'index.

**Aucune recette au clavier n'a été faite sur ces sept chantiers** au moment de la rédaction.

---

## 5. Positionnement

| Concurrent | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| Axonaut, Henrri, Sellsy | Devis et factures génériques | Aucune notion d'atelier, de four, de poudre, de contrôle |
| ERP industriels (Clipper, Silog) | Tout, mais lourd | 10 à 30 k€, mise en œuvre longue, inadapté à trois personnes |
| Excel + carnet | Gratuit, flexible | Aucune traçabilité, aucun suivi, perte d'information |
| *Tous* | — | **Aucun ne connaît la jante** : ni le pouce, ni le dessin, ni la teinte d'origine constructeur, ni le suivi roue par roue, ni le TPMS |

**Positionnement** : le seul logiciel qui parle poudre, four et Qualicoat — **et le seul qui parle
jante**. Un atelier de rénovation de jantes n'a aujourd'hui aucune alternative : ni un ERP, ni
Axonaut, ni un tableur ne savent chiffrer un jeu au pouce ni prouver l'état d'une roue à la
réception.

> ⚠️ **La grille ci-dessous est celle de juillet. Elle est périmée depuis le 20/08/2026.**
> Trois formules, et l'utilisateur supplémentaire facturé à l'unité — la grille en vigueur et le
> raisonnement qui la porte sont dans [`PLAN-COMPLET-20-08-2026.md`](PLAN-COMPLET-20-08-2026.md) §1.1.
> La source unique côté code reste `src/lib/abonnement.ts`, lue par la vitrine, la page tarifs,
> l'écran d'abonnement, le JSON-LD et `llms.txt`.

| Formule (en vigueur) | Prix HT/mois | À l'année | Utilisateurs compris |
|---|---|---|---|
| Atelier | 79 € | 790 € | 2 |
| Équipe | 129 € | 1 290 € | 5 |
| Certifié | 249 € | 2 490 € | 10 |
| Utilisateur supplémentaire | 5 € | 50 € | — |
| Remise Thermopoudre | −20 % à vie | | Client poudre actif — *toujours à valider* |

---

## 6. Décisions qui t'appartiennent

**Acheter le domaine.** thermogestion.fr, une douzaine d'euros par an. Tout est prêt côté code :
il reste six manipulations, listées dans `RECETTE-LOT4.md`. Tant que ce n'est pas fait, chaque devis
envoyé à un client porte une adresse en `.vercel.app` — ce qui, sur un document commercial, se
remarque.

**Créer une clé de webservice PrestaShop en lecture seule.** Signalé depuis le lot 3, toujours
ouvert : `TP_WS_KEY` est aujourd'hui la clé de travail de la boutique, qui ouvre aussi l'écriture.
Cinq minutes dans l'administration de thermopoudre.fr.

**Décider de la commande Thermopoudre réelle.** Le bon de commande par mail fonctionne. Pour que
l'atelier commande vraiment depuis l'app, il faut une demi-journée côté boutique : un point d'entrée
qui construise un panier avec la tarification du compte client (cf. `RECETTE-LOT4.md` §A2).

**Valider avec de vrais ateliers.** Toujours la recommandation la plus rentable de ce document,
mais elle a encore changé de nature. Le lot 2 a écrit les documents, le lot 5 a rendu les seuils
réglables : l'entretien ne sert plus ni à cadrer, ni à corriger un blocage connu. Il sert à **faire
relire le certificat de conformité, le registre des contrôles et le registre des déchets par un
responsable qualité d'atelier certifié**, les trois PDF imprimés sur la table. Ce qu'il faut lui
demander maintenant : est-ce que ces documents passeraient son audit tels quels, et qu'est-ce qu'il
y manque que son auditeur réclame chaque année.

**La remise Thermopoudre.** Les −20 % à vie affichés sur la vitrine sont un chiffre que j'ai posé en juillet et que tu n'as jamais confirmé. Sur le plan Atelier, c'est 214 € par an et par client. À confirmer, ajuster, ou retirer de la page.

**Le découpage des formules — tranché le 19/08, révisé le 20/08.** Trois formules, la qualité tracée
réservée à Certifié, l'organisation d'équipe à Équipe, et **tout le métier — thermolaquage comme
jantes — dans la formule d'entrée**. Depuis le 20/08, le nombre d'utilisateurs n'est plus une marche
entre formules mais un compteur à 5 € HT le siège : voir `PLAN-COMPLET-20-08-2026.md` §1.1 pour le
raisonnement, et §5 pour ce qui reste à valider par le marché plutôt que par le raisonnement.

**Le référentiel de contrôle s'applique par atelier, pas encore par client.** *(Réserve fermée au
lot 5 : les seuils sont réglables et l'écran l'explique.)* Ce qui reste : un atelier qui travaille
pour un donneur d'ordre exigeant la classe 0 d'adhérence doit basculer le référentiel au moment de
la saisie. Le rattacher au projet ou au client est une petite évolution — une colonne et un
sélecteur — délibérément différée pour ne pas ajouter un réglage de plus avant de l'avoir vu servir
sur le terrain. À trancher au premier atelier multi-référentiels.

**Le compte SMS reste à ouvrir.** La notification « vos pièces sont prêtes » n'est pas codée, et
elle suppose une décision qui n'est pas technique : Brevo fait aussi le SMS, ce qui éviterait un
second fournisseur et une seconde facture ; WhatsApp exige en plus un compte Business et des
modèles de message approuvés par Meta, avec un délai d'instruction de plusieurs jours. À arbitrer
avant de coder, pas après.

**Les différenciateurs jantes ne sont toujours pas sur la vitrine — et l'écart s'est creusé.** Il y a
maintenant un **module jantes complet** : chiffrage au pouce, teinte d'origine constructeur reliée à
ton catalogue, suivi roue par roue, bon de prise en charge photographié et signé, PDF opposable.
Aucun logiciel du marché ne fait ça. La page d'accueil, elle, vend toujours un outil générique.
C'est le chantier marketing le moins cher et le plus rentable du document, et il n'a pas bougé.

**Une question de segmentation qui se pose maintenant.** Le module jantes s'adresse à un métier
distinct (garages, concessions, préparateurs) avec des besoins que le laqueur de portails n'a pas.
Deux options : le laisser dans le plan Atelier à 89 € comme un module parmi d'autres, ou en faire
une option « Jantes » facturée à part. Ma recommandation : le laisser inclus **et l'utiliser comme
argument d'entrée** — un atelier de jantes qui vient pour ce module devient un client poudre, et
c'est là que se fait la marge.

**Le barème par défaut est à valider.** 70 / 85 / 100 / 130 € HT à la jante selon le diamètre,
×1,4 pour une multibranches, ×1,6 pour une diamantée : chiffres que j'ai posés comme un point de
départ crédible, pas comme un tarif de marché constaté. C'est le premier réglage qu'un atelier
regardera, et un barème visiblement faux décrédibilise le reste de l'écran.

---

**Sources réglementaires** : [Pennylane — calendrier officiel 2026-2027](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/facturation-electronique-dates-cles-et-calendrier) · [Cegid — calendrier par type d'entreprise](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/) · [Cerfrance — les 4 nouvelles mentions obligatoires](https://cerfrance22.fr/facture-electronique-nouvelles-mentions-obligatoires/)
