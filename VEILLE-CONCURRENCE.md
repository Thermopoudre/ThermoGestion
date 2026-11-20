# Thermogestion — Veille concurrentielle

*19 août 2026. Méthode : exploration page par page de `thermolaquage.coockpit.com` (13 pages lues
intégralement : accueil, fonctionnalités et ses 6 sous-pages, tarifs, FAQ, résultats clients,
sécurité, à propos, blog), puis balayage du marché français, allemand, italien et américain.
Chaque fonction annoncée par un concurrent est confrontée à **`AUDIT-FONCTIONNEL.md` (19/08)**,
pas au cahier des charges — le cahier des charges ment dans les deux sens, l'audit non.*

**Règle de lecture** : quand j'écris « Thermogestion ne le fait pas », c'est vérifié dans le code
ou dans la base. Quand j'écris « COOCKPIT le fait », c'est écrit sur leur site — je n'ai pas eu
accès au produit, et une page de vente n'est pas une recette. Les deux mesures ne sont donc pas
symétriques, et c'est volontairement à notre désavantage.

---

# 1. COOCKPIT Thermolaquage — la fiche

| | |
|---|---|
| **Éditeur** | COOCKPIT, 37 traverse de la Serviane, 13012 Marseille |
| **Domaine** | `thermolaquage.coockpit.com` — sous-domaine WordPress d'un éditeur généraliste |
| **En ligne depuis** | août 2025 (dates des médias) ; blog actif, 3 articles en janvier-février 2026 |
| **Cible déclarée** | « les thermolaqueurs **sous-traitants** » — le mot est dans le `<title>` de l'accueil |
| **Abonnement** | **980 € HT / mois**, facturation trimestrielle par prélèvement SEPA |
| **Offre « Start »** | **680 € HT / mois**, réservée aux ateliers de **moins de 1 M€ de CA**, 3 ans maximum |
| **Mise en route** | **4 990 € HT**, une fois — configuration, import des référentiels, formation à distance |
| **Engagement** | **36 mois** |
| **Délai de démarrage** | **8 semaines en moyenne** (leur page tarifs) / « environ 2 mois » (leur FAQ) |
| **Utilisateurs** | illimités, sans surcoût |
| **Hébergement** | France, réplication quotidienne, infogérance 24/7 |
| **Entrée en relation** | **un seul appel à l'action sur tout le site : « Demander une démo »** |
| **Preuve sociale** | 5 logos clients (ANO'TECH, APIL, Breton Industrie, SEMAS, SP Coating), 2 témoignages **nommés avec fonction**, 3 études de cas, 1 vidéo produit |
| **Chiffres avancés** | +20 % de temps gagné sur les commandes, +30 % sur le traitement des dossiers, 1,5 ETP réaffecté, +25 % de productivité chez ANO'TECH |

**Le coût réel sur 3 ans, puisque l'engagement est de 3 ans :**

| | Standard | Start (< 1 M€ de CA) |
|---|---|---|
| Mise en route | 4 990 € | 4 990 € |
| 36 mois d'abonnement | 35 280 € | 24 480 € |
| **Total 3 ans** | **40 270 € HT** | **29 470 € HT** |

Thermogestion, plan Atelier actuel à 89 € HT, sur la même durée : **3 204 € HT**. Un rapport de
**12,6 à 1**. C'est le chiffre qui structure tout ce document.

## Ce que COOCKPIT annonce, fonction par fonction

Relevé littéral de leurs pages, sans reformulation flatteuse :

- **Commandes** — suivi complet, historique, pièces jointes, instructions atelier, statut.
- **Production** — planning visuel par poste métier (grenaillage, préparation de surface,
  peinture, emballage), encours par poste, priorités modifiables en temps réel par
  glisser-déposer, ordres de production générés depuis la commande.
- **Stocks** — poudres, liquides et consommables, entrées/sorties tracées,
  **un QR code par carton de poudre**, **pesée rapide en atelier au lancement d'une commande**,
  alerte de seuil avant rupture.
- **Facturation** — facture générée depuis la commande, suivi des paiements, **relances
  intégrées**, avoirs, remises, export comptable.
- **Espace client** — **portail en ligne avec compte** : le donneur d'ordre consulte ses commandes,
  ses devis, ses BL, ses factures, et l'avancement par étape, 24 h/24.
- **Tableau de bord** — commandes à l'atelier par étape et priorité, **volumes hebdomadaires
  comparés à N-1**, temps de production moyen, retards, alertes factures en attente.
- **Indicateurs** — CA par période ou par client, **taux de transformation devis → commande**,
  historique des volumes, délai moyen de production, comparaisons dynamiques.
- **Droits** — droits personnalisés **par module et par utilisateur**.
- **Espace d'entraînement** dédié, séparé de l'espace de production, pour former les équipes.
- **Multi-procédés** — thermolaquage, peinture liquide, thermoplastie, grenaillage,
  métallisation, primaire zinc, anticorrosion.

## Ce que COOCKPIT dit lui-même de ses limites

Ce sont des citations de leur propre FAQ. Elles valent mieux que n'importe quelle critique :

> « COOCKPIT s'intègre-t-il avec d'autres logiciels ? **Non**, COOCKPIT Thermolaquage est une
> solution autonome, **sans intégration externe prévue à ce jour**. »

> « Il ne s'agit **pas d'une application mobile**, mais d'une interface optimisée pour tous les
> écrans. »

> « Par défaut, la solution démarre sur une **base neuve**. […] une reprise partielle de données
> historiques […] **cette prestation est facturée en sus, sur devis**. »

> « Nous fournissons un **export du journal de ventes** dans deux formats compatibles avec la
> majorité des logiciels. »

Trois conséquences directes, et elles sont exploitables :
1. **Pas d'API, pas de webhook, pas de connecteur** — assumé et revendiqué.
2. **Pas de PWA, pas de mode hors ligne, pas d'installation sur l'écran d'accueil.** Dans un
   bâtiment métallique, c'est une différence de nature, pas de degré.
3. **La reprise de vos données est payante.** Notre import CSV/XLSX (#54, opérationnel, 24 tests,
   3 modèles) est gratuit et se fait en dix minutes. C'est un argument de vente entier.

## Ce que COOCKPIT ne fait **pas** du tout

Vérifié par absence sur les 13 pages lues, y compris la page « fonctionnalités » exhaustive :

| Absent chez COOCKPIT | Preuve |
|---|---|
| **Signature électronique du devis par le client** | Le mot « signature » n'apparaît nulle part. Leur espace client est en **consultation**. |
| **Toute la qualité et la certification** | Aucun contrôle, aucun seuil, aucun registre de bains, aucun étalonnage d'instrument, **aucun certificat de conformité**. Leur article `/peinture-poudre/` explique ce qu'est QUALICOAT et conclut qu'un logiciel « permet de sécuriser vos certifications » — **la page produit ne le revendique jamais**. |
| **Rénovation de jantes** | Zéro occurrence. Le mot « jantes » n'apparaît qu'une fois sur tout le site, comme exemple de pièce automobile. |
| **DLU / péremption des poudres** | Ils tracent le carton par QR et alertent au seuil de quantité. Aucune date limite d'utilisation, aucun FIFO. |
| **Registre des déchets, classeur FDS** | Rien. |
| **Prix public consultable** | Ils l'ont — c'est leur force. Mais **aucun essai, aucune démo libre, aucune inscription self-service.** |
| **Traçabilité lot de poudre → pièce livrée** | Le QR sert à la pesée, pas au chaînage lot → projet → certificat. |

---

# 2. Le comparatif honnête

Confrontation ligne à ligne. Colonne Thermogestion = **`AUDIT-FONCTIONNEL.md`**, pas le cahier
des charges. Légende : ✅ opérationnel · 🔶 partiel · ⚠️ coquille (existe, sans effet) · ❌ absent.

## 2.1 Là où COOCKPIT est devant

| # | Fonction | COOCKPIT | Thermogestion | Écart réel |
|---|---|---|---|---|
| 1 | **Portail client avec compte** | ✅ annoncé, mis en avant sur 3 pages | ❌ (#38) — uniquement des liens à jeton, un par document | **Le plus gros écart fonctionnel.** Un donneur d'ordre industriel qui envoie 40 commandes par mois ne veut pas 40 liens dans sa boîte mail. |
| 2 | **Fiche client avec historique** | ✅ « historique client complet, accessible en 2 clics » | ❌ (#41) — `clients/[id]/page.tsx` fait **51 lignes** : un formulaire et un bouton « Archiver » | Aucun CA, aucune dernière commande, aucun dernier devis. C'est le premier écran qu'on ouvre quand un client appelle, et c'est le plus pauvre du produit. |
| 3 | **Planning visuel par poste, glisser-déposer** | ✅ « il la glisse sur le lendemain en un clic » | 🔶 — kanban par étape (#7 ✅), charge et date réaliste (#8 ✅), composeur de fournées (✅), mais **aucun plan de charge déplaçable par poste** | Les briques de calcul sont là et sont meilleures que les leurs (blocage dur des cycles incompatibles, jauge de remplissage). C'est la **vue** qui manque. |
| 4 | **Indicateurs de gestion** | ✅ CA par période et par client, taux de transformation devis → commande, volumes vs N-1, délai moyen | 🔶 (#44) — 3 onglets : charge du four, rentabilité client, rendement teintes. **Pas de série temporelle de CA, pas de taux de transformation, pas de comparaison N-1** | Notre rentabilité par client (#46 ✅, marge € et %, coût de non-qualité intégré) est plus fine que la leur. Mais un dirigeant demande d'abord « combien j'ai fait ce mois-ci », et nous ne savons pas le dire. |
| 5 | **Alertes au tableau de bord** | ✅ factures en attente, commandes en souffrance, échéances à venir | 🔶 — bloc « À faire » couvrant **5 sujets sur 12** ; le module jantes en est totalement absent ; **rien n'est jamais poussé** (`notifications` écrite 1 fois, lue 0 fois) | Le leur non plus n'envoie probablement rien. Mais leur écran couvre plus de sujets que le nôtre. |
| 6 | **Pilotage des relances** | ✅ « relances intégrées (mail ou export) » | 🔶 (#18/#26) — le cron tourne (41 exécutions, 0 échec, chaîne prouvée jusqu'à `sent`) mais **`relances_actives` et `relance_count` ont 0 occurrence dans `src/`** | Un atelier ne peut **ni voir ni couper** une relance envoyée en son nom. Il le découvrira chez un client. C'est le pire des trois états possibles. |
| 7 | **Droits par module et par utilisateur** | ✅ | ❌ — `users` et `invitations` existent, aucun droit granulaire | Vrai écart, faible importance sur notre cible (voir §3.2). |
| 8 | **Espace d'entraînement dédié** | ✅ séparé de la production | 🔶 — une démo publique partagée en lecture seule (#59 ✅) | Notre démo est meilleure pour **vendre**. La leur est meilleure pour **former**. |
| 9 | **Accompagnement humain** | ✅ formation, paramétrage, import, assistance renforcée, support téléphone | ❌ — self-service intégral | C'est ce qu'ils font payer 4 990 €. C'est aussi ce qui rassure un dirigeant de 55 ans. |
| 10 | **Largeur du traitement de surface** | ✅ grenaillage, métallisation, zinc, anticorrosion, thermoplastie, peinture liquide | 🔶 — centré poudre et cuisson | Réel, et volontairement non comblé (§3.2). |
| 11 | **Preuve sociale** | ✅ 5 logos, 2 témoignages nommés, 3 études de cas, 1 vidéo | ❌ — **zéro** | **Ce n'est pas une fonction, et c'est peut-être l'écart le plus coûteux du tableau.** |
| 12 | **Contenu et référencement** | ✅ ~40 pages, silo de fonctionnalités, blog actif, FAQ, page tarifs | ❌ — 1 page + 3 pages légales | Corrigé en partie par le présent lot. |
| 13 | **Encaissement qui fonctionne** | ✅ prélèvement SEPA trimestriel | ⚠️ (#61/R7) — **Stripe n'est pas configuré en production** ; `POST /api/billing/checkout` répond HTTP 500 | Ils vendent, nous non. Décision à prendre avant le 12/09/2026. |

## 2.2 Là où Thermogestion est devant

| # | Fonction | Thermogestion | COOCKPIT | Solidité de l'avantage |
|---|---|---|---|---|
| 1 | **Rénovation de jantes** | ✅ chiffrage au pouce (paliers 70 / 85 / 100 / 130 € HT), coefficients de dessin (×1 à ×1,4) et de finition (×1 à ×1,8), suivi jante par jante, statut du jeu déduit en base, opérations mécaniques comptées à la jante, teinte d'origine constructeur, bon de prise en charge signé **avec photo par jante**. 73 tests. | ❌ néant | **Inimitable à court terme, et adossé à un actif que personne n'a** : Thermopoudre est le seul distributeur français de toutes les teintes d'origine constructeur. Un concurrent peut coder le module ; il ne peut pas fabriquer le catalogue. |
| 2 | **Qualité opposable** | ✅ 6 types de contrôle, seuils figés par référentiel, **verdict recalculé par la base** (`verdict_controle` en plpgsql, attaqué depuis un client PostgREST anonyme), **aucune policy `DELETE`** sur `controles`, registre PDF, **certificat de conformité qui refuse de s'imprimer** (HTTP 409 côté serveur), certifications avec préavis J-90, étalonnage des instruments | ❌ néant | **Personne au monde ne vend Qualicoat comme argument produit** — vérifié en France, Allemagne, Italie et aux États-Unis. C'est le gisement le plus sous-exploité du dossier, et il est déjà livré. |
| 3 | **Signature électronique du devis** | ✅ page publique à jeton, signature au doigt, horodatage, IP conservée, projet créé automatiquement | ❌ | Le devis signé à distance est la différence entre « je rappelle la semaine prochaine » et une commande. |
| 4 | **Facturation française réelle** | ✅ Factur-X **PDF/A-3B validé** (profil MINIMUM, séquence CII, codes 380/381/386, `AFRelationship`, XMP `pdfaid:part 3/B`, OutputIntent ICC, polices incorporées) + **export FEC** conforme (18 colonnes, tab + CRLF, nom `<SIREN>FEC<AAAAMMJJ>.txt`, avoir en sens inverse, ventilation TVA au prorata) + mentions L441-9, L441-10, R.123-237, art. 293 B | 🔶 « déjà en conformité », **export du journal de ventes** en 2 formats | Ils affirment, nous prouvons. Et **l'export FEC est ce que réclame l'administration en contrôle**, pas un journal de ventes. |
| 5 | **Traçabilité lot poudre → pièce livrée** | ✅ (#29) 12/12 projets portent un `lot_id`, décompte FIFO à la cuisson, lot repris sur le certificat | 🔶 QR par carton + pesée | Le leur trace le **stock**. Le nôtre trace la **pièce**, jusqu'au document remis au client. |
| 6 | **DLU / péremption** | 🔶 (#30) seuil J-60 affiché sur 4 écrans, périmés servis en dernier puis FIFO par DLU | ❌ | Avantage réel mais **non poussé** : l'atelier ne le voit que s'il ouvre `/stock`. |
| 7 | **Mobile et terrain** | ✅ PWA installable, pensée pour les gants, scan QR, poste de pointage partagé avec répartition au prorata | ❌ **« il ne s'agit pas d'une application mobile »** (leur FAQ) | Différence de nature. Un atelier se pilote debout. |
| 8 | **Réglementaire** | 🔶 registre des déchets R.541-43 (#47) et classeur FDS (#48) — bien faits, **1 ligne et 1 fiche en base** | ❌ | Avantage sur le papier, pas encore dans les faits. À ne pas survendre. |
| 9 | **Réversibilité** | ✅ (#57) archive ZIP, **38 tables**, un CSV par table + un JSON, RLS attaquée depuis un client anonyme dans les tests | 🔶 export Excel/PDF | Réserve honnête : **les photos ne sont pas dans l'archive**, seuls leurs chemins. |
| 10 | **Import de vos données** | ✅ (#54) 3 modèles, aperçu avant écriture, dédoublonnage, 24 tests — **gratuit** | 🔶 **facturé en sus, sur devis** | Argument de vente direct. |
| 11 | **Lien avec le fournisseur de poudre** | 🔶 (#34) chaîne complète codée, 16 tests, **jamais exécutée en production** | ❌ | Personne d'autre ne peut le faire : l'éditeur **est** le distributeur. Mais à recetter avant d'en parler (voir §5). |
| 12 | **Prix, essai, engagement** | ✅ prix affiché, essai 30 jours sans carte, démo libre sans formulaire, sans engagement | ❌ formulaire obligatoire, 36 mois, 4 990 € d'entrée | **C'est un avantage structurel, pas tarifaire** : ils ne peuvent pas y répondre sans casser leur modèle. |

## 2.3 Les fonctions que ni l'un ni l'autre ne fait

Utile pour la roadmap, et pour ne pas croire qu'un manque est une infériorité :

racks / chevalets / crochets consignés · écran atelier TV · poudre recyclée et taux de réemploi ·
notifications push · SMS ou WhatsApp « vos pièces sont prêtes » · vérifications périodiques ATEX ·
maintenance des équipements · versions et duplication de devis · multi-sites.

---

# 3. Copier, ignorer, dépasser

## 3.1 À copier — c'est un standard attendu du métier

Rien ici n'est une idée de COOCKPIT. Ce sont les choses qu'un acheteur d'atelier considère
acquises, et dont l'absence disqualifie sans discussion.

| Priorité | Quoi | Pourquoi c'est un standard | État chez nous |
|---|---|---|---|
| **1** | **Fiche client avec historique, CA, dernier devis, dernière commande** | Tous les concurrents l'ont, y compris les logiciels de facturation à 25 €/mois. Son absence se voit en trente secondes de démonstration. | ❌ #41 — 51 lignes |
| **2** | **Portail client avec compte** | C'est l'argument que COOCKPIT met en avant sur trois pages, et celui que citent SP Coating et APIL dans leurs témoignages. Un donneur d'ordre industriel ne gère pas 40 liens à jeton. | ❌ #38 |
| **3** | **Un plan de charge visuel déplaçable par poste** | Le seul témoignage produit spontanément par SEMAS porte là-dessus : « l'outil de planification est ultra lisible, rapide à modifier, très apprécié en prod ». Nos moteurs sont plus fins ; la vue manque. | 🔶 #7/#8 |
| **4** | **Écran de pilotage des relances** | Envoyer une relance au nom d'un atelier sans qu'il puisse la couper n'est pas une fonction, c'est un risque. | 🔶 C-10 |
| **5** | **Fiche suiveuse A5/A6 imprimable** | Tout le monde en a une : *cartellino* chez CPTerzisti, étiquette code-barre chez Herakles, QR par carton chez COOCKPIT. Sans papier, le scan n'a pas de support. | ⚠️ #13 |
| **6** | **CA par mois et taux de transformation devis → commande** | Les deux premiers chiffres que regarde un dirigeant. | 🔶 #44 |
| **7** | **Séquencement des fournées par teinte** | Fait par **les trois** ERP européens sérieux (Softec, avista, CPTerzisti). Un changement de teinte en cabine coûte un nettoyage complet : c'est la première chose qu'un thermolaqueur cite quand on lui demande où il perd de l'argent. Notre composeur groupe déjà par teinte — il manque l'**ordre**. | 🔶 extension de #7 |
| **8** | **Racks, chevalets et crochets consignés** | CPTerzisti en fait un objet de premier plan (*telaio*, *gancio*). C'est le litige n°2 du sous-traitant après le délai. | ❌ #10 |
| **9** | **Poudre récupérée vs poudre neuve** | Softec le fait depuis des années. C'est 10 à 30 % de la matière d'un atelier bien tenu. | ❌ #31 |
| **10** | **Preuve sociale nommée** | Deux témoignages nommés valent plus que vingt-cinq requêtes SEO. Ce n'est pas du produit, c'est la condition d'entrée. | ❌ |

## 3.2 À ignorer — de la sur-ingénierie qui justifie 980 €

Chacun de ces points coûterait des semaines et ne ferait gagner aucun client de notre cible.
Plusieurs sont même **contre-productifs** : ils nous ramèneraient sur le terrain où COOCKPIT gagne.

| Quoi | Pourquoi ne pas le faire |
|---|---|
| **Couvrir tout le traitement de surface** (galvano, anodisation, cataphorèse, zinc, thermoplastie) | C'est le terrain de Quarks Alchemy, GALVA-9000 et Media-Soft, installés et certifiés. Chaque procédé ajouté dilue le seul message qui nous distingue. La poudre et la jante suffisent à remplir cinq ans. |
| **EDI, API publique, connecteurs comptables** (#27, #56) | COOCKPIT dit lui-même **« sans intégration externe prévue à ce jour »** et le vend 980 €. Ce n'est donc pas un critère d'achat sur ce segment. Un export FEC + CSV, qu'on a déjà, couvre 100 % des besoins d'un atelier de 3 à 15 personnes. |
| **Droits fins par module et par utilisateur** | Dans un atelier de trois personnes, tout le monde touche à tout. Cette fonction est une réponse à un organigramme, pas à un besoin. |
| **Espace d'entraînement séparé** | Notre démo publique en lecture seule (verrouillée en base par un trigger sur 38 tables) fait le travail, et en plus elle **vend**. Deux environnements par client, c'est un coût d'exploitation permanent. |
| **Mise en route accompagnée sur 8 semaines** | C'est un service facturé 4 990 € déguisé en avantage. Notre proposition est l'exacte opposée : en production le jour même. En faire une option payante à la carte, oui (§5) ; en faire un passage obligé, jamais. |
| **Multi-sites** (#55) | Un atelier multi-sites a un budget d'ERP. Ce n'est pas notre client, et le jour où il le devient, il part — c'est acceptable. |
| **Analytique avancée, comparaisons N-1, BI** | Un dirigeant d'atelier veut **six chiffres** le matin, pas un cube. Le mail quotidien coûte deux jours et rend plus de service que trois mois de tableaux croisés. |
| **Infogérance 24/7 comme argument de vente** | Supabase `eu-west-3`, RLS sur 42/42 tables, vues en `security_invoker`, en-têtes vérifiés au `curl` : c'est objectivement solide. Mais un artisan n'achète pas de la supervision, il achète de ne pas y penser. À dire autrement. |

## 3.3 À dépasser — là où nous pouvons gagner franchement

| Axe | Ce qu'on a déjà | Ce qui manque pour que ça se vende |
|---|---|---|
| **La qualité opposable** | Le verdict est rendu **par la base**, pas par le navigateur : un contrôle faux à la naissance est impossible, un contrôle gênant est indélébile (aucune policy `DELETE`), et le certificat refuse de s'imprimer si l'épaisseur manque ou si l'adhérence est en classe 4. Vérifié depuis un client PostgREST anonyme. | **Le dire.** Aucun concurrent, nulle part, ne vend la conformité au label. Et faire relire les trois PDF par un responsable qualité certifié — c'est la recommandation la plus rentable de `AUDIT-FONCTIONNEL`, et elle n'a pas bougé depuis le lot 2. |
| **La jante** | Un module complet, 73 tests, deux dossiers peuplés dans la démo, et un catalogue de teintes d'origine que personne ne peut copier. | Une page qui en parle (faite dans ce lot), et **un premier garage nommé**. |
| **La conformité française** | Factur-X PDF/A-3B validé, FEC conforme, mentions légales exactes. | C'est une **barrière naturelle** contre Softec, avista, OPT2WORK et Steelhead, qui ne l'auront jamais. À exposer comme telle, pas comme une case cochée. |
| **La transparence commerciale** | Prix affiché, démo ouverte sans formulaire, essai sans carte, sans engagement. | COOCKPIT **ne peut pas répondre** : son modèle repose sur 4 990 € + 36 mois. C'est le seul axe où il est structurellement muet. |
| **Le terrain** | PWA, gants, scan, poste partagé. | Fermer le mode hors ligne (#52, aujourd'hui un décor) et livrer la fiche suiveuse. Sans elle, l'argument mobile s'arrête à l'écran. |
| **Le fournisseur intégré** | L'éditeur **est** le distributeur de poudre. Structurellement inimitable. | Recetter la chaîne de commande une fois en vrai (#34, jamais exécutée) **avant** d'en faire un argument. |

---

# 4. Le reste du marché

Balayage France / Allemagne / Italie / États-Unis. Détail des sources dans les notes de recherche ;
seul l'essentiel est retenu ici.

## 4.1 France — les verticaux du traitement de surface

| Acteur | Positionnement | Tarif | Menace |
|---|---|---|---|
| **Quarks Alchemy** | Galvano, anodisation, connectique. Bains + SPC, REACH, IATF, EN 9100, NADCAP, ISO 27001. Partenariat UITS. | non public | **Faible.** Zéro mention de poudre, de four, de DLU ou de Qualicoat. Cible : usine certifiée aéro/auto. |
| **GALVA-9000 / Dataxiome** | ERP traitement de surface, spatial/aéro/militaire. Couvre explicitement peinture poudre et liquide, avec certificats de conformité. | non public | **Faible à moyenne.** Une seule page produit, site figé depuis avril 2025. Positionnement « exigeant », pas TPE. |
| **Helios ERP** (Forterro) | La meilleure page « traitement de surface » du marché français : modélise bains, cabines et **four** comme centres de charge, calcule le nombre de pièces par fournée à partir de la surface et de l'encombrement de l'outillage. | non public | **Faible sur notre cible, instructive sur le produit.** Cible aéronautique, cycle de vente long. Leur modèle de charge est plus fin que le nôtre. |
| **Herakles ERP GPAO** | ERP généraliste dont une page vise la sous-traitance peinture : conversion d'unités poudres/liquides, prestations chiffrées sur poids et surface, **lots et dates de péremption pour le FIFO**, douchettes et PDA. | non public | **Moyenne.** C'est le seul français dont le vocabulaire recoupe vraiment le nôtre. Mais « sous-traitance » est 1 métier sur 26, et rien n'est en SaaS. |
| **Clipper, Sylob, Silog, Open-Prod** | GPAO généralistes. Le traitement de surface y est un cas d'usage, pas un produit. | Clipper : dès 4 000 € pour 3 postes | **Faible**, sauf par défaut : ce sont eux qu'un expert-comptable recommandera. |

**Conclusion France** : entre l'ERP à 4 000 € avec projet de six mois et le logiciel de facture à
25 €/mois qui ignore le métier, **il n'y a rien, sauf COOCKPIT**. Et aucun vertical français
n'affiche de prix, n'a de démo publique, ni de parcours self-service.

## 4.2 La concurrence « par défaut » — les logiciels d'artisan

C'est contre eux que se fait l'arbitrage réel de l'artisan seul, pas contre COOCKPIT.

| Outil | Tarif public | Ce qui manque |
|---|---|---|
| **Henrri** | **gratuit** (Pro), Expert dès 17 € | Tout le métier. Mais gratuit. |
| **Tolteck** | 25 €/mois (19 € annuel) | Devis/facture artisan. Zéro production, zéro stock. |
| **Obat** | 32 €/mois, **signature électronique illimitée incluse** | Bibliothèques de prix BTP, rentabilité chantier. Rien sur une pièce, une teinte, une cuisson. |
| **Sinao** | 19 à 129 €/mois | Compta et TVA. Aucune production. |
| **Axonaut** | 97 €/mois HT 1 utilisateur (−60 % sur 3 ans), +29,99 €/utilisateur | CRM/compta/stock générique. Aucun ordre de fabrication, aucun lot poudre, aucun certificat. |
| **Batappli, Organilog, Kizeo** | 15 à 79 €/mois | Chiffrage bâtiment, interventions terrain, formulaires mobiles. Modèles inadaptés. |

**Ce que cela impose** : notre différenciation ne peut pas être « je fais des devis et des
factures ». Obat inclut la signature électronique à 32 €. Henrri facture gratuitement. **Il faut
vendre la poudre, le four, la jante et le certificat — jamais le devis.**

## 4.3 Allemagne et Italie — le marché est mûr, et il a de l'avance

- **Softec / OMNITEC** (Karlsruhe, ~190 clients) — le plus proche de nous fonctionnellement au
  monde. Gère RAL/NCS, degrés de brillance, structures, **températures de cuisson**, **distingue
  poudre neuve et poudre récupérée**, et surtout un **calculateur de surface par géométrie de
  pièce** (tôle pliée ≠ grille ≠ profilé) qui pilote le besoin en poudre. Détail parlant : l'image
  d'en-tête de leur page poudrage est **une jante**.
- **avista.ERP** — magasin de couleurs géré **par lot** (chaque carton = un lot), capacité
  exprimée en **kg de poudre/jour, mètres/heure ou balancelles/jour**, planification par ordre de
  couleur pour réduire les nettoyages de cabine.
- **CPTerzisti / CP Software** (Italie) — le seul vertical italien pour la *verniciatura c/terzi* :
  **cartellino code-barre par colis avec couleur, type de châssis et type de crochet**, capacité
  finie filtrable par couleur/client/tournée, motifs de retouche statistiques, portail client.
- **Wagner COATIFY** et **Gema GemaConnect** ne sont **pas** des concurrents : ce sont des
  plateformes IoT de supervision de ligne, sans devis ni facture. Une intégration serait un
  différenciateur, pas une menace.

Aucun de ces acteurs ne fait de Factur-X ni de FEC. **La conformité française est une barrière
naturelle à leur entrée** — et la seule que nous ayons contre eux.

## 4.4 Rénovation de jantes — un seul concurrent mondial

- **OPT2WORK / Mainhattan-Wheels** (Dietzenbach, Allemagne) — **le seul vrai concurrent du module
  jantes au monde.** ERP dédié à la *Felgenaufbereitung* : champs jante spécifiques (dimension,
  **ET/déport**, teinte constatée, fabricant, **dimension et marque du pneu**), code Datamatrix par
  jante, filtrage par poste (décapage, sablage, poudrage, tour CNC, soudure laser), statut par
  jante avec notification client, **OPT2COLOR** (base de teintes OEM par modèle de véhicule),
  **OPT2BURN** (analyse de cuisson **calibrée par four**), signature sur tablette, photos
  avant/après, **OPT2CUT** (optimisation de contour CNC). Tarif non public, absent de France.
- **France et Italie : totalement vide.** Aucun logiciel de gestion d'atelier de jantes.
- **États-Unis** — la jante y est **un template de devis parmi d'autres**, jamais un objet suivi :
  Mobile Tech RX (39 à 199 $/mois + par utilisateur, 9 métiers dont la jante), AMT/ReconPro,
  Torque360. Aucun ne suit un **jeu de quatre**.
- **Solera/Audatex, Sidexa, GT Motive** : la jante est une ligne de chiffrage sinistre avec un
  temps forfaitaire, pas un dossier.

**Réserve honnête** : qu'un seul acteur mondial existe depuis des années sans imitateur peut
signifier « marché vierge » — ou « marché trop étroit pour nourrir un éditeur dédié ». Les deux
lectures sont défendables. La nôtre tient parce que **le logiciel n'a pas besoin d'être rentable
seul** : chaque atelier de jantes est un client poudre, et c'est là qu'est la marge.

## 4.5 Ce que les moteurs et les assistants répondent aujourd'hui

Sur « quel logiciel pour gérer un atelier de thermolaquage », en français : **COOCKPIT occupe les
positions 1, 2 et 6**, et le reste de la page n'est pas du logiciel du tout — ce sont des
prestataires de thermolaquage qui répondent à « qu'est-ce que le thermolaquage ». Un assistant
interrogé ne cite **que COOCKPIT** et conclut que c'est « la solution SaaS française spécialisée
recherchée ». Ni Quarks Alchemy, ni GALVA-9000, ni Herakles, ni Helios ne remontent.

En anglais, le marché est saturé de listicles — dont le plus repris est écrit **par un éditeur qui
s'y classe lui-même n°1**. C'est exactement ce que les modèles recopient.

**Lecture** : la requête française est un monopole sur une page à moitié vide. C'est la plus
grosse opportunité du dossier, et le plus gros risque si rien ne bouge.

---

# 5. Ce que je recommande

## 5.1 Le tarif — 59/89 € est une erreur de positionnement

Ce n'est pas trop cher, c'est **trop bon marché, et ça nous range dans la mauvaise catégorie**.

Trois raisons :

1. **Ça nous met à côté de Tolteck (25 €) et Henrri (gratuit), pas à côté de COOCKPIT.** À 59 €,
   un dirigeant comprend « logiciel de facture ». Il ne cherche pas dedans un certificat de
   conformité ni un export FEC — et il ne les trouve donc pas.
2. **Ça ne finance pas la roadmap.** Huit clients à 89 € font 712 €/mois. Les dix chantiers de
   la §3.1 en demandent plus.
3. **Un prix bas ne protège de rien.** COOCKPIT ne baissera pas à 89 € ; il n'a aucune raison de
   le faire. L'écart de 12× est déjà écrasant à 129 € comme à 89 €. Autant prendre les 40 €.

**Grille proposée** — segmentée par métier, pas par nombre d'utilisateurs :

| Formule | Prix | Pour qui | Contenu |
|---|---|---|---|
| **Jantes** | **79 € HT/mois** | Garage, centre auto, préparateur, atelier jantes alu. 1 à 3 utilisateurs. | Module jantes complet, devis et signature, bon de prise en charge photographié, BL, facture, suivi client. Ni fournées, ni qualité. |
| **Atelier** | **129 € HT/mois** | Thermolaqueur artisan, 1 à 5 utilisateurs. | Tout le socle : devis m²/ml/pouce, production, fournées, stock poudre, BL, Factur-X, FEC, jantes inclus. |
| **Sous-traitance** | **249 € HT/mois** | Sous-traitant industriel de 5 à 20 personnes, atelier labellisé ou candidat. **Utilisateurs illimités.** | Tout Atelier, plus : contrôles qualité et référentiels, **certificat de conformité**, registre des bains, étalonnage, registre des déchets, classeur FDS, portail client, rentabilité par client. |

Et surtout, ce qui ne change pas et qu'il faut marteler : **0 € de mise en route, essai 30 jours
sans carte, démo ouverte sans formulaire, sans engagement, 2 mois offerts à l'année.**

**Le service, en option et jamais obligatoire** : reprise de données et paramétrage accompagné,
**490 € HT une fois**. C'est ce que COOCKPIT facture 4 990 € et que nous pouvons facturer dix
fois moins parce que l'import CSV existe déjà. C'est aussi ce qui rassure le dirigeant de 55 ans
sans nous imposer un modèle de vente à cycle long.

**Le tarif « Sous-traitance » à 249 € reste 4 fois moins cher que l'offre Start de COOCKPIT et
prend le seul terrain qu'ils ne peuvent pas défendre : la qualité.** Sur trois ans :
8 964 € contre 29 470 €.

**Deux points à trancher, et qui engagent** :
- **Le « −20 % à vie » pour un client Thermopoudre n'a jamais été confirmé** (P13). Un tarif
  affiché engage. J'ai retiré « à vie » de la vitrine et écrit « tant que votre compte
  Thermopoudre est actif » — révocable, honnête, et toujours vendeur. À valider.
- **Stripe** (R7) : le 13/09/2026, le seul atelier réel passe en lecture seule et « Souscrire »
  répond HTTP 500. Aucune ligne de ce document n'a d'importance si le produit se bloque tout seul.

## 5.2 La segmentation — deux tunnels, pas un

Les deux cibles n'achètent pas la même chose, ne cherchent pas les mêmes mots, et ne se décident
pas de la même façon. Les mélanger dans un seul entonnoir, c'est perdre les deux.

| | **Rénovation de jantes** | **Sous-traitance industrielle** |
|---|---|---|
| **Qui** | Garage indépendant, centre auto, concession, préparateur, atelier jantes alu | Thermolaqueur sous-traitant, 3 à 20 personnes, souvent labellisé ou en passe de l'être |
| **Ce qu'il cherche** | « logiciel rénovation jantes », « logiciel atelier jantes alu » — **il ne sait pas que son métier s'appelle du thermolaquage** | « logiciel thermolaquage », « certificat de conformité », « traçabilité lot de poudre » |
| **Sa douleur n°1** | **Le litige.** « Cette jante était déjà voilée. » « Vous m'avez cassé un capteur TPMS. » | **La preuve.** L'audit Qualicoat, le donneur d'ordre qui réclame un certificat, la facture électronique 2026 |
| **Son argument d'achat** | Le bon de prise en charge photographié et signé **avant démontage** | Le certificat qui **refuse de s'imprimer** quand la mesure manque |
| **Porte d'entrée** | `/logiciel-renovation-jantes` → démo directe sur un dossier jantes | `/logiciel-sous-traitance-thermolaquage` → être rappelé |
| **Comment il se décide** | Seul, le soir, en self-service | Au téléphone. **COOCKPIT n'a qu'un seul CTA sur tout son site, et il a raison.** |
| **Formule** | Jantes, 79 € | Atelier 129 € ou Sous-traitance 249 € |
| **Concurrence** | **Aucune en France** | COOCKPIT, et l'inertie d'Excel |

L'articulation à tenir : **la jante est le coin qui ouvre la porte et prouve la spécialisation,
l'industrie est le volume.** Ce n'est pas un arbitrage. Une page d'accueil qui ne nomme qu'une des
deux perd l'autre, et une page d'accueil qui les mélange n'en convainc aucune — d'où deux pages
dédiées, avec deux vocabulaires, sous un accueil qui les distribue.

## 5.3 Roadmap issue du comparatif

Ordonnée par effet sur la vente, pas par difficulté. Les cinq premières sont ce qui empêche
aujourd'hui de vendre.

| # | Chantier | Effort | Pourquoi maintenant |
|---|---|---|---|
| **1** | **Trancher Stripe** (R7) | 1 h ou une décision | 24 jours. Rien d'autre ne compte si le produit se verrouille seul. |
| **2** | **La fiche client** (#41) | 2 j | Historique, CA, dernier devis, dernière commande. C'est le premier écran ouvert quand un client appelle, et c'est le plus pauvre du produit. Tous les concurrents l'ont, y compris ceux à 25 €. |
| **3** | **Le mail quotidien de 8 h** | 2 j | Le cron tourne (12 092 succès, 0 échec), le canal e-mail marche, il manque le texte. C'est la première cause d'abandon à trois semaines. |
| **4** | **La fiche suiveuse A5 imprimable** (#13) | 2 j | Ferme la promesse P1, donne un support physique au scan, et tout le monde en a une. |
| **5** | **Un premier témoignage nommé** | quelques appels | Deux témoignages nommés valent plus que vingt-cinq requêtes SEO. La base de clients poudre de Thermopoudre est là. |
| **6** | **L'écran de pilotage des relances** (C-10) | 1 j | Un atelier ne peut pas couper une relance envoyée en son nom. Risque, pas manque. |
| **7** | **Le portail client avec compte** (#38) | 1 sem. | Le seul écart fonctionnel majeur face à COOCKPIT, et l'argument que citent leurs clients. |
| **8** | **CA mensuel + taux de transformation** (#44) | 2 j | Les deux premiers chiffres que regarde un dirigeant. |
| **9** | **Séquencement des fournées par teinte** | 3 j | Fait par les trois ERP européens sérieux. Économie immédiate et chiffrable en nettoyages de cabine. Extension d'un moteur qui existe. |
| **10** | **Racks et chevalets consignés** (#10) | 1 sem. | Litige n°2 du sous-traitant. Personne en France ne le fait à ce prix. |
| **11** | **Poudre récupérée / taux de réemploi** (#31) | 3 j | 10 à 30 % de la matière. Softec le fait, nous non. |
| **12** | **Recetter la commande poudre en vrai** (#34) | 1/2 j | 16 tests verts, jamais exécutée. On ne vend pas une chaîne qu'on n'a jamais parcourue. |
| **13** | **Faire relire les 3 PDF par un responsable qualité certifié** | 1 rendez-vous | La recommandation la plus rentable de `AUDIT-FONCTIONNEL`, inchangée depuis le lot 2. Cet audit dit que les documents se génèrent. Il ne dit pas qu'ils passeraient un audit Qualicoat — et c'est la seule question qui compte pour le plan Sous-traitance. |

**Ce que je ne mettrais pas dans la roadmap** : les procédés hors poudre, l'EDI, l'API publique,
les droits fins par module, le multi-sites, l'environnement de formation séparé, et toute forme
de BI. Voir §3.2.

---

# 6. Mon avis franc

**COOCKPIT est un bon produit, bien vendu, sur une cible qui n'est pas la nôtre — et il a six mois
d'avance sur nous en marketing, pas en logiciel.**

Leur périmètre est celui d'un ERP commercial et de production honnête : commandes, planning,
stocks, facturation, portail client, indicateurs. C'est solide, c'est ce qu'il faut à un
sous-traitant de trente personnes, et leurs témoignages sonnent vrai. Ce qu'ils vendent
réellement à 4 990 € + 980 €, c'est **de l'accompagnement et de la tranquillité**, pas des
fonctions — leur page tarifs le dit presque explicitement, et leurs deux témoignages parlent
d'abord de « quelqu'un au bout du fil ».

**Ce qui nous manque vraiment face à eux tient en trois lignes, et aucune n'est un gros
chantier** : la fiche client, le portail client, et **une preuve que quelqu'un s'en sert**. Le
reste de leur avance est du contenu.

**Ce qu'ils n'ont pas et n'auront pas de sitôt** : la jante, et la qualité opposable. La première
est adossée à un catalogue de teintes que personne ne peut fabriquer. La seconde est déjà livrée,
prouvée depuis un client PostgREST externe, et **personne au monde ne la vend** — j'ai cherché en
France, en Allemagne, en Italie et aux États-Unis. Un certificat de conformité qui refuse de
s'imprimer quand la mesure manque, c'est un argument qu'on ne peut pas contrefaire dans une
brochure : il se démontre en trente secondes de démonstration, et l'auditeur qualité en face
comprend immédiatement ce qu'il voit.

**Le vrai risque n'est pas COOCKPIT.** C'est Henrri à zéro euro et Obat à 32 € avec la signature
électronique incluse. Contre eux, « je fais des devis et des factures » ne vaut rien. Contre eux,
la poudre, le four, la jante et le certificat valent tout. C'est exactement pour ça qu'il ne faut
pas rester à 59 €.
