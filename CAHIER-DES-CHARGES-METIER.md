# Thermogestion — Cahier des charges métier & roadmap produit

*Rédigé du point de vue d'un atelier de thermolaquage : ce qui se passe vraiment entre le camion qui dépose les pièces et la facture payée. Inclut l'audit performance produit/marché et l'inventaire complet des fonctions manquantes.*

---

# PARTIE A — Audit performance (état au 13/08/2026)

## Résumé exécutif

Thermogestion couvre aujourd'hui **le tronc commun d'un logiciel de gestion** (devis → production → stock → suivi client) mais **très peu du métier réglementaire et industriel** du thermolaquage. C'est précisément là que se joue la différenciation face à un Axonaut ou un Henrri : un atelier ne changera pas d'outil pour un devis, il changera pour son **cahier de contrôles Qualicoat**, sa **planification de fournées** et sa **traçabilité de lot poudre**.

Deux échéances rendent la fenêtre commerciale exceptionnelle : la **facturation électronique** (réception obligatoire pour toutes les entreprises au **1er septembre 2026**, émission pour les TPE/PME au **1er septembre 2027**) et la pression énergétique sur les fours qui pousse les ateliers à mesurer leur coût de revient.

| Indicateur | État | Commentaire |
|---|---|---|
| Couverture fonctionnelle métier | **~35 %** | Gestion générique OK, métier thermolaquage à peine entamé |
| Couverture réglementaire | **~5 %** | Ni Qualicoat, ni déchets, ni facture électronique |
| Différenciation vs généralistes | **Faible aujourd'hui** | Le lien Thermopoudre est le seul vrai fossé |
| Prêt pour pilotes | **Oui** en atelier « simple » (jantes, particuliers) | **Non** pour un atelier certifié Qualicoat ou un sous-traitant menuiserie |
| Funnel marketing | Instrumenté, 0 trafic | Analytics OK depuis hier, aucune campagne lancée |
| Blocage n°1 | SMTP Auth | ~3 mails/h : impossible d'ouvrir les inscriptions |

## Ce qui existe (inventaire)

Devis (grille m² à paliers + coefficients, prestations, signature en ligne), projets (workflow 7 étapes éditable, kanban, QR de validation, photos), stock poudres (mouvements, pesées, décrément à la cuisson, alerte seuil, réappro Thermopoudre), pages client sans compte (devis, suivi), équipe (invitations, rôles), essai 30 j, identité par atelier (logo + couleur), PWA, analytics, emails transactionnels, vitrine + légal.

## Ce qui manque, vu de haut

1. **Le cahier de contrôles qualité** (Qualicoat/Qualisteelcoat/Qualimarine) — obligatoire, tenu à la main dans 90 % des ateliers.
2. **La planification des fournées** — le vrai goulot d'étranglement d'un atelier, c'est le four, pas le devis.
3. **La facturation** tout court (le module n'existe pas encore) — et donc la facture électronique.
4. **La réception des pièces** avec preuve photo — la première cause de litige du métier.
5. **Le prix de revient réel** — poudre + main d'œuvre + énergie + masquage : personne ne le calcule, tout le monde le veut.
6. **Le client professionnel récurrent** (menuisier alu, serrurier) — tarifs négociés, BL, facture mensuelle récapitulative, portail de dépôt.

---

# PARTIE B — Le métier, pour cadrer les besoins

## Le parcours réel d'une pièce

```
Contact → Devis → Réception physique (comptage, état, photos)
   → Accrochage → Prétraitement (dégraissage / décapage / sablage / phosphatation)
   → Séchage / dégazage → Masquage → Poudrage (cabine, teinte, réglages pistolet)
   → Cuisson (courbe, sonde) → Refroidissement → Décrochage
   → Contrôles (épaisseur, brillance, adhérence, aspect) → Retouche éventuelle
   → Emballage / palettisation → BL signé → Facture → Encaissement
```

Chacune de ces étapes produit une donnée que l'atelier note aujourd'hui sur un carnet, un tableau blanc ou un Excel — et qu'il perd.

## Les 6 profils de clients d'un atelier (et ce qu'ils exigent)

| Segment | Volume | Ce qu'il veut | Impact produit |
|---|---|---|---|
| Menuisier alu / fabricant | Fort, récurrent | Prix au **ml** ou au m² négocié, BL par livraison, **facture mensuelle récapitulative**, délai ferme | Tarifs client, BL, facturation groupée |
| Serrurier-métallier | Moyen, récurrent | Devis rapide, dépannage, délais courts | Devis en 2 min ✅ |
| Industriel / série | Fort, contractuel | Contrat-cadre, PV de contrôle, **certificat de conformité**, traçabilité lot | Qualité + contrats |
| Concession / garage (jantes) | Moyen | Teinte d'origine constructeur, délai 48-72 h, prix à la jante | Base teintes origine ✅ (atout Thermopoudre) |
| Particulier | Faible, ponctuel | Devis clair, suivi, photos avant/après | ✅ déjà couvert |
| Collectivité / mobilier urbain | Ponctuel, gros | Marché public, garantie, Qualicoat exigé | Qualité + documents |

## Les contraintes réglementaires qui structurent l'atelier

- **ICPE 2940** (application de revêtement) : déclaration ou enregistrement selon les quantités mises en œuvre ; registre et contrôles associés.
- **ATEX** : la cabine poudre est une zone à atmosphère explosive — vérifications périodiques, formation du personnel.
- **Déchets dangereux** : boues de cabine, poudre périmée, bains de prétraitement usés → registre déchets et bordereaux (Trackdéchets).
- **Labels** : Qualicoat / Qualisteelcoat / Qualimarine imposent un **cahier de contrôles journalier** (épaisseur, brillance, adhérence, dureté, polymérisation, bains) conservé et présenté à l'audit annuel.
- **Facturation électronique** : réception obligatoire **au 1er septembre 2026**, émission TPE/PME **au 1er septembre 2027**, via plateforme agréée et format structuré (Factur-X, UBL, CII).

---

# PARTIE C — Inventaire complet des fonctions à ajouter

Notation : **Impact** (attractivité commerciale + rétention) / **Effort** (charge de dev) / **Priorité**.

## C1. Qualité & certification — *le différenciateur n°1*

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 1 | **Cahier de contrôles journalier** | Saisie mobile : épaisseur (mini/maxi/moyenne, sonde), brillance 60°, adhérence quadrillage ISO 2409, dureté Buchholz, polymérisation (test solvant), aspect. Par fournée ou par lot. Export PDF pour l'audit. | ⭐⭐⭐ | Moyen | **P1** |
| 2 | **Registre des bains de prétraitement** | pH, conductivité, température, titrages, date de renouvellement, alertes de fréquence. | ⭐⭐⭐ | Moyen | **P1** |
| 3 | **Certificat de conformité PDF** | Généré par projet : teinte, poudre + lot, épaisseurs mesurées, cuisson, label, garantie, signature atelier. | ⭐⭐⭐ | Faible | **P1** |
| 4 | **Non-conformités & retouches** | Déclarer un défaut (typologie métier ci-dessous), coût, cause, action corrective. Pareto des défauts. | ⭐⭐ | Moyen | P2 |
| 5 | **Suivi des certifications** | Dates de validité Qualicoat/QM, alertes de renouvellement, checklist de préparation d'audit. | ⭐ | Faible | P2 |
| 6 | **Étalonnage des instruments** | Sonde d'épaisseur, brillancemètre, thermomètre : dates d'étalonnage + alertes. | ⭐ | Faible | P3 |

**Typologie de défauts à pré-charger** : peau d'orange, cratères (silicone), piqûres/dégazage (fonte, alu poreux), coulure, manque d'accroche, faïençage, surépaisseur, sous-épaisseur, cage de Faraday (angles rentrants), pollution/mélange époxy-polyester, marque de crochet, différence de teinte entre lots, brillant non conforme.

## C2. Production & planification — *le vrai goulot*

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 7 | **Planification des fournées** | Le four est la ressource rare. Regrouper les projets par **teinte** (éviter les changements de cabine) et par **cycle de cuisson** (°C/durée compatibles), visualiser le remplissage (m² ou ml de balancelle), planning jour/semaine. | ⭐⭐⭐ | Élevé | **P1** |
| 8 | **Capacité & charge** | Capacité déclarée (m²/jour, dimensions utiles du four, nb de fournées/jour) → taux de charge, alerte surcharge, date de livraison réaliste proposée automatiquement. | ⭐⭐⭐ | Moyen | **P1** |
| 9 | **Fiche de cuisson tracée** | N° de fournée, projets embarqués, consigne °C/durée, température produit relevée (ou import data-logger), opérateur. Pièce maîtresse de la traçabilité. | ⭐⭐ | Moyen | P2 |
| 10 | **Gestion des supports/racks** | Types de crochets et balancelles, capacité, disponibilité, **chevalets consignés** prêtés au client (qui a quoi, depuis quand). | ⭐⭐ | Moyen | P2 |
| 11 | **Temps passé par étape** | Pointage ultra-simple (bouton départ/fin au scan QR déjà en place) → temps réel vs estimé, base du prix de revient. | ⭐⭐ | Faible | **P1** |
| 12 | **Écran atelier (TV)** | Vue plein écran des projets du jour par poste, sans interaction — affichée dans l'atelier. | ⭐ | Faible | P3 |
| 13 | **Étiquettes pièces / fiche suiveuse** | Impression A5/A6 avec QR, teinte, client, consignes de masquage, cycle de cuisson. | ⭐⭐ | Faible | **P1** |

## C3. Commercial & devis

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 14 | **Tarification au mètre linéaire** | Indispensable pour les profilés alu (menuisiers) : prix/ml par famille de profilé, ou calcul de **surface développée** (périmètre × longueur). | ⭐⭐⭐ | Faible | **P1** |
| 15 | **Tarifs négociés par client** | Grille dédiée ou remise contractuelle par client, appliquée automatiquement. Le B2B récurrent ne se chiffre pas au coup par coup. | ⭐⭐⭐ | Faible | **P1** |
| 16 | **Bibliothèque de pièces types** | « Portail 3 m », « Jante 19" », « Garde-corps 1 m » avec surface et temps pré-calculés → devis en 30 secondes. | ⭐⭐ | Faible | **P1** |
| 17 | **Calculateur de surface** | Assistant : tube rond/carré, tôle, profilé, jante, portail à barreaux (avec coefficient de vide). | ⭐⭐ | Moyen | P2 |
| 18 | **Relances automatiques de devis** | J+7 / J+15 / J+30 paramétrable (la file `notifications` existe déjà). | ⭐⭐⭐ | Faible | **P1** |
| 19 | **Versions & duplication de devis** | Champ `parent_id` déjà prévu en base — reste l'UI. | ⭐ | Faible | P2 |
| 20 | **Devis multi-langues** | FR/IT/EN pour le marché italien et les clients export. | ⭐ | Moyen | P3 |

## C4. Facturation & encaissement — *urgence réglementaire*

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 21 | **Module facture** (base) | Acompte/solde/libre/avoir, numérotation, PDF conforme. Tables déjà en base. | ⭐⭐⭐ | Moyen | **P1** |
| 22 | **Facture électronique (Factur-X)** | PDF/A-3 avec XML embarqué + connexion à une plateforme agréée. **Réception obligatoire au 01/09/2026, émission TPE/PME au 01/09/2027.** Argument de vente massif dès maintenant. | ⭐⭐⭐ | Élevé | **P1-P2** |
| 23 | **Facture mensuelle récapitulative** | Regrouper les BL du mois d'un client pro en une facture. Standard absolu chez les menuisiers. | ⭐⭐⭐ | Moyen | **P1** |
| 24 | **Bon de livraison + signature** | BL PDF, signature à la livraison (le client scanne/signe sur le téléphone), photos de remise. | ⭐⭐⭐ | Faible | **P1** |
| 25 | **Paiement en ligne** | Stripe Connect (déjà cadré au blueprint) + lien de paiement sur la facture. | ⭐⭐ | Moyen | P2 |
| 26 | **Relances impayés** | Échéancier, relances graduées, balance âgée. | ⭐⭐ | Faible | P2 |
| 27 | **Export comptable** | CSV/FEC + connecteurs Pennylane / Axonaut / Sage. | ⭐⭐ | Moyen | P2 |
| 28 | **Acomptes & situations** | Demande d'acompte à la commande (30 % classique), suivi des encaissements. | ⭐⭐ | Faible | P2 |

## C5. Stock, poudres & achats — *l'axe Thermopoudre*

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 29 | **Traçabilité lot poudre → projet** | Quel lot sur quelle pièce : indispensable en cas de réclamation ou de rappel, exigé par les labels. | ⭐⭐⭐ | Faible | **P1** |
| 30 | **DLU / péremption** | Date limite d'utilisation par lot (typiquement 6-12 mois), alerte à J-60, valorisation du stock à risque. | ⭐⭐ | Faible | **P1** |
| 31 | **Poudre recyclée** | Suivi du taux de réemploi (récupération cyclone), mélange vierge/recyclée, impact sur le rendement. | ⭐⭐ | Moyen | P2 |
| 32 | **Rendement réel vs théorique** | Conso réelle (pesée) vs théorique (surface ÷ rendement) → **taux de perte par teinte et par opérateur**. Un atelier qui passe de 35 % à 25 % de perte gagne des milliers d'euros. | ⭐⭐⭐ | Moyen | **P1** |
| 33 | **Consommables** | Masquage (bouchons silicone, ruban haute température), crochets, abrasifs, dégraissants : stock et seuils. | ⭐⭐ | Faible | P2 |
| 34 | **Commande fournisseur intégrée** | Panier multi-références → commande Thermopoudre en 1 clic (API PrestaShop), suivi de livraison, réception qui incrémente le stock. **C'est le cœur du modèle hybride.** | ⭐⭐⭐ | Élevé | **P1-P2** |
| 35 | **Catalogue teintes intégré** | Recherche RAL + teintes origine constructeurs (jantes) depuis le catalogue Thermopoudre, import de la fiche poudre en 1 clic (FT, FDS, cuisson). | ⭐⭐⭐ | Moyen | **P1** |
| 36 | **Nuancier client** | Le client choisit sa teinte depuis un lien (visuel + référence) — supprime les allers-retours téléphoniques. | ⭐⭐ | Moyen | P2 |

## C6. Client & relation — *rétention et viralité*

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 37 | **Réception des pièces avec photos** | Bon de réception : comptage, état constaté, **photos horodatées**. Première cause de litige (« ma pièce était rayée avant ! »). | ⭐⭐⭐ | Faible | **P1** |
| 38 | **Portail client pro** | Compte pour les clients récurrents : historique, dépôt de demande, BL, factures, suivi en temps réel. | ⭐⭐ | Élevé | P2 |
| 39 | **Avis Google automatisé** | Demande d'avis J+2 après livraison — les ateliers vivent du bouche-à-oreille local. | ⭐⭐ | Faible | **P1** |
| 40 | **Galerie avant/après** | Photos avec logo de l'atelier, export réseaux sociaux. Le thermolaquage est un métier visuel. | ⭐⭐ | Faible | P2 |
| 41 | **Historique & relance commerciale** | Dernière commande, panier moyen, client dormant depuis X mois → liste d'appels. | ⭐⭐ | Moyen | P2 |
| 42 | **SMS / WhatsApp** | « Vos pièces sont prêtes » — canal roi chez les artisans. Mutualisé (pas de config par atelier). | ⭐⭐ | Moyen | P2 |

## C7. Pilotage & rentabilité

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 43 | **Prix de revient réel** | Poudre + main d'œuvre (temps réel × taux horaire) + **énergie four** (kWh ou m³ gaz par fournée × prix) + consommables + amortissement → **marge par projet et par client**. | ⭐⭐⭐ | Moyen | **P1** |
| 44 | **Tableau de bord de gestion** | m² traités, CA, marge, taux de charge du four, top teintes, taux de rebut, saisonnalité. | ⭐⭐ | Moyen | P2 |
| 45 | **Coût énergétique par fournée** | Consommation du four × tarif : sujet brûlant depuis 2022, aucun logiciel ne le fait. | ⭐⭐ | Moyen | P2 |
| 46 | **Rentabilité par client** | Certains gros clients sont déficitaires (délais courts, retouches, petites séries) — le montrer noir sur blanc. | ⭐⭐⭐ | Faible | P2 |

## C8. Réglementaire & sécurité

| # | Fonction | Détail métier | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 47 | **Registre déchets** | Boues de cabine, poudre périmée, bains usés : quantités, BSD/Trackdéchets, exutoires. | ⭐⭐ | Moyen | P2 |
| 48 | **Classeur FDS** | Fiches de données de sécurité des poudres et produits chimiques, accessibles depuis mobile. | ⭐⭐ | Faible | P2 |
| 49 | **Vérifications périodiques** | Four, compresseur, ventilation/ATEX, extincteurs, électricité : échéancier + alertes. | ⭐ | Faible | P3 |
| 50 | **Maintenance des équipements** | Préventive (filtres cabine, buses, sondes) et curative, avec historique. | ⭐ | Moyen | P3 |

## C9. Plateforme & technique

| # | Fonction | Détail | Impact | Effort | Prio |
|---|---|---|---|---|---|
| 51 | **Notifications push PWA** | « Devis signé », « pièces prêtes » sur le téléphone. | ⭐⭐ | Moyen | P2 |
| 52 | **Mode hors-ligne réel** | File d'écritures locale : l'atelier a souvent un mauvais réseau (bâtiment métallique). | ⭐⭐ | Élevé | P3 |
| 53 | **i18n FR/IT** | Extraction des chaînes déjà prévue au blueprint. | ⭐⭐ | Moyen | P2 |
| 54 | **Import de données** | Reprise du fichier Excel client d'un nouvel atelier (clients, tarifs, poudres) — clé pour convertir. | ⭐⭐ | Moyen | P2 |
| 55 | **Multi-sites** | Ateliers à plusieurs implantations ou plusieurs fours. | ⭐ | Élevé | P3 |
| 56 | **API publique + webhooks** | Pour les industriels qui veulent brancher leur ERP. | ⭐ | Moyen | P3 |
| 57 | **Sauvegarde / export total** | Rassurance contractuelle (déjà promis dans les CGU). | ⭐⭐ | Faible | P2 |

---

# PARTIE D — Roadmap proposée

## v1.0 « Atelier complet » (4-6 semaines) — *ce qu'il faut pour vendre sans rougir*

Facturation de base + BL signé + facture récapitulative mensuelle · Réception avec photos · Tarifs client + prix au ml + bibliothèque de pièces types · Relances devis · Traçabilité lot poudre + DLU · Temps par étape · Étiquettes/fiche suiveuse · Avis Google · Prix de revient simple.

**Objectif** : un atelier peut abandonner son Excel et son carnet.

## v1.1 « Certifié » (6-8 semaines) — *le fossé concurrentiel*

Cahier de contrôles Qualicoat · Registre des bains · Certificat de conformité · Non-conformités & Pareto des défauts · Planification des fournées + capacité · Fiche de cuisson · Rendement réel vs théorique.

**Objectif** : devenir le seul logiciel qui fait passer l'audit Qualicoat. Justifie un plan « Pro » à 129 €/mois.

## v1.2 « Connecté » (8-10 semaines)

Facture électronique Factur-X + plateforme agréée · Commande Thermopoudre intégrée + catalogue teintes · Portail client pro · Paiement en ligne · Export comptable · Push · i18n IT.

**Objectif** : verrouiller la boucle SaaS ↔ poudre et absorber l'échéance réglementaire de septembre 2027.

## v2 « Pilotage »

Rentabilité par client, coût énergétique, maintenance, registre déchets, multi-sites, API.

---

# PARTIE E — Spécifications des 3 modules structurants

## E1. Cahier de contrôles qualité

**Tables** : `controles` (projet_id ou fournee_id, type, valeurs jsonb, conforme bool, operateur, photo, created_at), `controles_bains` (bain, ph, conductivite, temperature, titrage, action), `instruments` (nom, dernier_etalonnage, prochaine).

**UX** : formulaire mobile en 20 secondes, valeurs numériques au pavé, comparaison automatique aux seuils du label (ex. épaisseur mini 60 µm Qualicoat classe 1), verdict conforme/non conforme immédiat, photo optionnelle. Rappel quotidien à heure fixe. Export PDF « registre de contrôles » sur une période — le document que l'auditeur demande.

**Règles** : seuils paramétrables par atelier et par label ; toute non-conformité crée automatiquement une fiche de non-conformité liée au projet.

## E2. Planification des fournées

**Tables** : `fournees` (date, four_id, statut, temp_consigne, duree, temp_relevee, operateur), `fournee_projets` (fournee_id, projet_id, surface_m2, position).

**UX** : écran « Prochaine fournée » — liste des projets prêts à cuire, groupés par **teinte** puis par **cycle compatible** ; jauge de remplissage (% de la capacité déclarée) ; glisser un projet dans la fournée ; lancement = passage automatique de tous les projets à l'étape Cuisson ; clôture = relevé de température et libération.

**Intelligence** : suggestion automatique « 3 projets RAL 9005 en attente = fournée pleine à 78 %, lancer maintenant ? » et alerte « changement de teinte : prévoir nettoyage cabine ».

## E3. Prix de revient & marge

**Sources** : poudre (conso réelle × prix/kg du lot), main d'œuvre (temps pointé × taux horaire de l'atelier), énergie (kWh de la fournée ÷ nombre de projets × tarif), consommables (forfait ou réel), frais généraux (% paramétrable).

**Restitution** : bandeau discret sur la fiche projet (« Revient 182 € · Facturé 460 € · Marge 60 % »), classement des clients par marge, alerte « projet vendu sous le prix de revient » à la création du devis.

---

# PARTIE F — Positionnement et pricing (mise à jour)

| Concurrent | Ce qu'il fait | Ce qu'il ne fait pas |
|---|---|---|
| Axonaut, Henrri, Sellsy | Devis/factures génériques | Aucune notion d'atelier, de four, de poudre, de contrôle |
| ERP industriels (Clipper, Silog…) | Tout, mais lourd | Prix (10-30 k€), délai de mise en œuvre, inadapté à 3 personnes |
| Excel + carnet | Gratuit, flexible | Aucune traçabilité, aucun suivi client, perte d'information |

**Positionnement** : « le seul logiciel qui parle poudre, four et Qualicoat ».

**Grille suggérée après v1.1** :

| Formule | Prix | Cible |
|---|---|---|
| Solo | 59 €/mois | Artisan seul, jantes/particuliers |
| Atelier | 89 €/mois | Équipe, portail client, paiement en ligne |
| **Pro / Certifié** | **129 €/mois** | Cahier de contrôles, fournées, certificats, prix de revient |
| Remise Thermopoudre | −20 % à vie | Client poudre actif *(à valider)* |

---

# PARTIE G — Ce que je recommande de faire maintenant

1. **Valider ce cahier des charges avec 2-3 ateliers réels** avant d'écrire une ligne de code — dont un atelier certifié Qualicoat. Une heure d'entretien chacun ; je peux préparer le guide d'entretien.
2. **Livrer la v1.0** (facturation + réception + tarifs pro + traçabilité lot) : c'est le minimum pour qu'un atelier quitte son Excel.
3. **Faire du cahier de contrôles la signature du produit** (v1.1) et refaire la vitrine autour de cet argument.
4. **Préparer la facture électronique** dès maintenant : le marché va poser la question à chaque démo d'ici septembre.
5. En parallèle : SMTP Auth, placeholders légaux, remise Thermopoudre à confirmer.

---

**Sources réglementaires (facturation électronique)** : [Pennylane — calendrier officiel 2026-2027](https://www.pennylane.com/fr/fiches-pratiques/facture-electronique/facturation-electronique-dates-cles-et-calendrier) · [Cegid — calendrier par type d'entreprise](https://www.cegid.com/fr/facture-electronique-obligatoire/calendrier-facture-electronique/) · [CCI Haute-Savoie — obligations et calendrier](https://www.haute-savoie.cci.fr/blog/facturation-electronique-calendrier-obligations)
