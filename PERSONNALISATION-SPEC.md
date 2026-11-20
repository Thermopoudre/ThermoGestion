# Thermogestion — Personnalisation par niveaux (spec)

*Réponse au besoin « tout personnalisable, sur mesure pour chaque société » — architecture en 3 niveaux pour donner le sur-mesure perçu sans construire une usine à gaz impossible à maintenir.*

## Pourquoi pas du drag-and-drop généralisé

Rendre chaque élément déplaçable/redimensionnable multiplie par 5-10 le coût de chaque écran (états à persister, collisions, responsive, migrations de layouts), rend le support impossible (« mon bouton a disparu ») et casse la cohérence qui fait qu'un artisan s'y retrouve en 30 secondes. Les SaaS qui réussissent (Shine, Pennylane, Axonaut…) offrent : **identité de marque + documents configurables + modules activables**. C'est ce plan.

## Niveau 1 — Identité de l'atelier ✅ CONSTRUIT (08/07)

Logo (upload, bucket public `logos`) + couleur (color picker) dans Réglages > Atelier. Appliqués sur : page devis /d (en-tête logo, titre et bouton de signature aux couleurs), page suivi /s (logo, barre de progression, accents). À étendre ensuite : emails (bandeau couleur), PDF, en-tête de l'app connectée.

## Niveau 2 — Documents sur mesure (sprint 4, avec les factures)

Objet `ateliers.settings.doc_template` (jsonb) :

- **Blocs réordonnables** du devis/facture : en-tête, coordonnées client, tableau lignes, totaux, notes, conditions, signature — liste ordonnée on/off (même pattern UI que l'éditeur d'étapes déjà livré).
- **Colonnes du tableau** : Qté / PU / TVA / Remise visibles ou non.
- **Textes types** : notes par défaut, conditions de règlement, mention d'acompte, pied de page (assurance, SIRET…).
- **Style** : couleur (niveau 1), police (2-3 choix), densité (compact/confort).
- Aperçu en direct dans les réglages (rendu du composant réel, comme les vignettes de la vitrine).

## Niveau 3 — App modulaire (après pilotes)

- **Dashboard widgets** : chaque carte (devis en attente, retards, stock, CA du mois, à faire) activable et ordonnable — `settings.dashboard = [{widget, position}]`.
- **Étapes de production** : ✅ déjà éditables (Réglages > Étapes).
- **Champs personnalisés** (v1.2) : table `custom_fields` (entité, libellé, type) + valeurs jsonb sur clients/projets — demande récurrente probable des ateliers spécialisés (n° de châssis pour les jantes, référence chantier pour le bâtiment).
- **Modules on/off** : masquer Stock ou Devis pour les ateliers qui ne s'en servent pas (nav allégée).

## PWA ✅ CONSTRUIT (08/07)

Manifest complet (icônes 192/512 maskable, standalone, thème marine), service worker (app installable, statiques en cache, pages en network-first avec secours hors-ligne = dernier état vu), enregistrement automatique. Installation : Android → bannière « Ajouter à l'écran d'accueil » ; iPhone → Partager > « Sur l'écran d'accueil ». Pas encore : notifications push (v1.1, utile pour « devis signé »), mode hors-ligne complet avec file d'écritures (gros chantier, à valider par le besoin réel des pilotes).

## Ordre recommandé

1. Niveau 1 + PWA : **prêt à déployer** (en attente de GO).
2. Niveau 2 avec le sprint 4 factures (même moteur de rendu devis/facture/PDF).
3. Niveau 3 après retours pilotes — on construira ce qu'ils demandent vraiment, pas ce qu'on imagine.
