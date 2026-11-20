# Recette Lot 1 / Lot 2 — Thermogestion v2

Recette menée le **17/08/2026** en production (`https://thermogestion-v2.vercel.app`) sur l'atelier
de test **ThermoTest** (`atelier_id = 34be816a-97b4-44f9-a5b2-c3b0b41ce465`, abonnement en essai
jusqu'au 12/09/2026), écran par écran, en actionnant réellement les boutons dans le navigateur.
Chaque saisie a été recontrôlée en base Supabase (projet `luujbyqenmzivzhiatze`).

Ce rapport sert à décider si le produit est présentable à un atelier réel. Il est écrit sans
complaisance : ce qui n'a pas été vérifié est signalé comme tel.

---

## 1. Ce qui a été testé

### Réglages (tous les onglets)
| Onglet | Testé | Résultat |
|---|---|---|
| Atelier | Identité légale, siège, règlement, assurance, four & prix de revient, couleur | OK — enregistrement vérifié en base (SIREN, SIRET, forme, capital, RCS, TVA, APE, adresse, IBAN/BIC, capacité four 9 m², 18 kWh/cycle, 0,19 €/kWh, taux horaire 42 €/h, frais généraux 12 %) |
| Grille m² | Modification d'un palier (45 → 46 → 45) | OK — enregistrement automatique au blur, toast « ✓ Enregistré » |
| Prix au ml | Affichage des 3 familles + périmètres développés | OK |
| Pièces types | Affichage des 3 pièces (jante, portail, grille) | OK |
| Prestations | 5 prestations dont une en `ml` | OK |
| Équipe | Membre propriétaire + formulaire d'invitation | OK (invitation non envoyée) |
| Étapes | 7 étapes de production, réordonnancement | Affiché, non modifié |
| Compte | Abonnement, Stripe, mot de passe | OK (Stripe non connecté) |

### Devis
Devis complet créé de bout en bout pour Menuiserie Aluval (**DV-2026-0006**, 601,18 € TTC) :
- ligne **m²** : 4,2 m² × grille (palier 3–10 m² à 24 €) × coef structuré 1,15 × coef moyenne 1,2
  = 33,12 €/m² → **139,10 €** — calcul recontrôlé à la main, exact ;
- ligne **ml** : 12,5 ml × 28 €/ml = **350,00 €**, surface développée calculée **4,38 m²** ;
- ligne **prestation** : sablage à **7,20 €** au lieu de 9,00 € avec la mention
  « Tarif négocié appliqué pour ce client » (tarif négocié créé depuis la fiche client) ;
- ligne **pièce type** : jante alu 17" à 55,00 € en un clic ;
- **remise contractuelle 12 %** reprise automatiquement du client, mention explicite ;
- badges « facturation mensuelle récapitulative » et « paiement à 45 jours » repris du client ;
- enregistrement brouillon → autosave → finalisation → numérotation `DV-2026-0006` ;
- **page publique de signature** : totaux corrects, signature au doigt/souris, acceptation.
  En base : `status = signe`, `signed_by = Patrick Vidal`, `signature_data` présent,
  **projet PR-2026-0008 créé automatiquement**, notification `devis_signe` mise en file.

### Projets / production
- Fiche projet : poudre, surface (8,58 m² saisis **avec une virgule**), couches, lot de poudre.
- Validation d'étapes par bouton **et** par **scan QR** (`/scan/<qr>`) : les deux avancent l'étape
  et bornent le chronométrage (`temps_etapes`).
- **Temps passé** par étape + **coût main d'œuvre** (6 min pointées → 4,20 € à 42 €/h) : exact.
- **Rattachement du lot de poudre** après cuisson : lot TEST-LOT-7016-B décompté de
  9,000 → 7,927 kg (conso 1,073 kg) ; le lot apparaît bien dans « Projets ayant utilisé ce lot ».
- **Prix de revient** (vue `projet_revient`) : poudre 17,38 € + main d'œuvre 4,20 € + énergie
  1,71 €, total 26,09 € avec 12 % de frais généraux.
- **Page publique de suivi client** (`/s/<token>`) : timeline lisible, statut « Prêt ».

### Fournées
- Regroupement par teinte, cycle de cuisson affiché (200 °C / 18 min), **jauge de remplissage**
  du four (9 m²) : 95 % à un projet, **122 % en rouge** à deux.
- **Blocage dur** correct d'un projet dont le cycle diffère (190 °C / 15 min) : bouton désactivé
  + message explicite.
- Lancement → les 2 projets passent en cuisson ; clôture avec température relevée et
  consommation → les 2 projets passent au contrôle, **stock poudre décrémenté automatiquement**
  (8,58/8 = 1,073 kg et 2,40/8 = 0,300 kg, exact).

### Réceptions / BL / Factures
- **Réception RE-2026-0003** : 3 pièces, état « corrosion », réserves détaillées, déposant,
  signature manuscrite du déposant, page publique `/rc/<token>` conforme.
- **BL-2026-0002** : lignes, 2 colis, 46,5 kg, note ; émission → lien public ; **signature client**
  sur `/bl/<token>` → `status = livre`, `recu_par = Patrick Vidal`, horodatage.
- **FA-2026-0003** : émission, numérotation, lien public `/f/<token>` avec toutes les mentions
  légales (IBAN/BIC, SIREN, RCS, TVA, pénalités L441-10 / D441-5, escompte), enregistrement d'un
  paiement par virement → facture **payée**.
- **Facture récapitulative du mois** : regroupement du BL livré non facturé sur la période, avec
  la bonne échéance client.

### Qualité
- **Contrôle conforme** (épaisseur 72/94/83 µm) et **contrôle non conforme** (adhérence classe 4),
  avec instrument rattaché et commentaire — les deux enregistrés en base.
- **Instruments** : création d'une sonde d'épaisseur (à jour) et d'une grille de quadrillage
  (**« En retard »**) ; l'alerte « Étalonnage en retard » remonte bien dans le formulaire de contrôle.
- **Bain** : relevé Conversion Cr3 (pH 4,2 / 1850 µS/cm / 32,5 °C / titrage 2,4), verdict non
  conforme, action corrective, renouvellement coché — enregistré avec toutes les valeurs.
- **Non-conformité** : déclarée depuis le contrôle non conforme (préremplissage projet + défaut),
  cause, action corrective, coût 68,50 €, retouche — Pareto des défauts mis à jour.
- **Export PDF du registre des contrôles** : `/api/pdf/registre-controles` → HTTP 200,
  `application/pdf`, 5,3 Ko, en-tête `%PDF-1.3` valide.

### Stock / lots
- Alertes DLU : **1 lot périmé** (10/05/2026) et **1 lot à écouler sous 60 jours** (44 j),
  valorisation du stock à risque (229,65 €), pastilles sur `/stock` et `/lots`.
- Fiche lot : quantité, restant, prix/kg, valeur restante, DLU, projets consommateurs.

---

## 2. Anomalies corrigées pendant la recette

| # | Anomalie | Criticité | Correction |
|---|---|---|---|
| A1 | `/qualite/controles` : le contrôle n'était **jamais enregistré**. La contrainte `controles_cible_check` impose un projet **ou** une fournée, mais les deux champs étaient marqués « (facultatif) » et l'erreur Supabase était avalée sans aucun message. | **Bloquant** | `ControleForm.tsx` : libellé « Rattacher à un projet OU à une fournée (l'un des deux est obligatoire) », bouton désactivé tant qu'aucune cible n'est choisie, message d'aide en ambre, et toute erreur d'écriture remonte via `errorFr()` en toast **et** en message inline. |
| A2 | **Impossible de saisir une décimale** dans les champs numériques du devis, de la facture, du BL, des poudres, des lots, des réceptions… Taper « 4.2 » donnait **2** (Chrome renvoie `""` sur « 4. », le parent recalcule `Number("") = 0`, React réécrit « 0 »). La virgule du clavier français était purement refusée. Sur un outil de chiffrage, cela produit des devis faux sans que personne ne s'en aperçoive. | **Critique** | `ui.tsx` : nouveau champ interne `ChampDecimal` utilisé automatiquement par `<Input type="number">`. Il conserve la frappe brute, accepte la virgule (normalisée en point) et ne remonte au parent qu'une valeur que son `Number(...)` sait lire. Vérifié en production : « 4.2 » et « 12,5 » passent, les totaux suivent. |
| A3 | Deux fournées créées le même jour portaient **le même numéro** (`F-20260817-1`) : la numérotation ne comptait que les fournées planifiées/en cours, pas celles déjà terminées. | Majeure | `fournees/page.tsx` : relecture de tous les numéros du jour avant insertion. Vérifié : la fournée suivante est bien `F-20260817-3`. |
| A4 | Sur la fiche fournée, un projet **déjà dans la composition** restait proposé à l'ajout — il pouvait être compté deux fois dans le remplissage du four. | Moyenne | `fournees/[id]/page.tsx` : exclusion des projets de la composition courante. |
| A5 | Après finalisation d'un devis, l'éditeur restait **entièrement modifiable** (le statut n'était lu qu'au montage du composant) : on pouvait changer les prix d'un devis déjà envoyé ou signé sans que le client le voie. | Majeure | `DevisEditor` reçoit désormais le statut à jour de la page parente ; vérifié : 20 champs sur 20 désactivés sur un devis signé. |
| A6 | L'échéance de facture ignorait le **délai de paiement négocié du client** (45 j) et retombait sur celui de l'atelier (30 j) — en contradiction avec ce que le devis annonçait au même client. | Majeure | `FactureEditor` et la création de facture depuis un devis appliquent `client.delai_paiement_jours` puis celui de l'atelier. Vérifié : échéance au 01/10/2026 (45 j). |
| A7 | La facture créée depuis un devis ne portait pas de `projet_id` : l'indicateur **« Facturé » / « Marge »** de la fiche projet ne pouvait donc jamais s'alimenter. | Moyenne | Rattachement du projet issu du devis à la facture. |
| A8 | Le tableau de production et l'écran de scan affichaient les **codes techniques** des étapes (`controle`, `pret`, `cuisson`) au lieu de leurs libellés. | Mineure | Affichage du libellé de l'étape sur `/projets` et sur le message de confirmation du scan. |
| A9 | `errorFr()` renvoyait « Une erreur est survenue » pour toutes les violations de contraintes. | Mineure | Ajout des cas `controles_cible_check`, `check constraint`, `not-null`, `foreign key`. |
| A10 | `BainForm` et `NonConformiteForm` n'affichaient l'erreur qu'en inline, hors écran sur mobile. | Mineure | Erreur doublée en toast. |
| A11 | « Fait passer les 1 projet à l'étape Cuisson » | Cosmétique | Pluriel corrigé. |

Build `npx next build` sans erreur TypeScript, déployé en production (dernier déploiement
`thermogestion-v2-g91jz4qt4`), et chaque correction a été **revérifiée dans le navigateur** après
déploiement.

---

## 3. Anomalies restantes (non corrigées)

### Majeures — à traiter avant de montrer le produit à un atelier

1. **Le stock global et les lots divergent silencieusement.**
   À la clôture de la fournée, la consommation est déduite de `poudres.stock_kg` automatiquement,
   mais le lot n'est décompté que si l'opérateur pense à cliquer « Confirmer ce lot » ensuite.
   S'il oublie, les deux chiffres s'écartent définitivement. Constaté sur ThermoTest :
   `TEST-RAL7016-TEXTURE` affiche **29,067 kg** sur `/stock` (valeur poudre) alors que la somme des
   lots vaut **29,927 kg** — 0,860 kg d'écart, dont 0,300 kg créés pendant cette recette.
   Le mouvement `stock_mouvements` correspondant ne porte ni `lot_id` ni `lot_numero` : la
   traçabilité lot est incomplète. Correction attendue : affecter le lot (FIFO ou DLU la plus
   proche) au moment du décompte automatique, ou bloquer la clôture tant que le lot n'est pas
   désigné.

2. **Le bon de livraison signé ne fait pas avancer le projet.**
   BL-2026-0002 est signé et passé en `livre`, mais le projet PR-2026-0008 reste à l'étape
   « Prêt » avec `date_livraison` à `null`. L'atelier doit donc valider l'étape à la main, sinon
   son tableau de production ne se vide jamais.

3. **Aucun préremplissage du BL ni de la facture depuis le devis / le projet.**
   Sélectionner le projet sur un BL laisse le bon vide : tout est à ressaisir alors que le devis
   signé contient déjà les lignes. Même chose pour `/factures/new`, qui ne propose ni projet ni
   devis. Sur un dossier à 4 lignes, c'est de la double saisie garantie — et une source d'écart
   entre ce qui est devisé, livré et facturé.

4. **La suggestion de fournée propose la fournée la moins remplie.**
   Avec deux projets RAL 7016 en attente (2,40 m² et 8,58 m² pour un four de 9 m²), l'assistant
   propose « 1 projet … fournée pleine à **27 %** ». L'algorithme (`suggestionMeilleureFournee`)
   trie par surface croissante pour maximiser le **nombre** de projets, pas le **remplissage**.
   Pour un atelier qui paie son four au kWh, c'est le contraire de ce qu'il attend.

### Moyennes

5. **Le coût énergie n'est pas au prorata**, contrairement à ce qu'annonce l'écran de clôture
   (« réparti au prorata entre les projets de la fournée »). La vue `projet_revient` divise la
   consommation par le **nombre** de projets : 3,42 € de cuisson ont donné 1,71 € à un projet de
   8,58 m² **et** 1,71 € à un projet de 2,40 m². Correction = migration sur la vue (répartition par
   `fournee_projets.surface_m2`), donc hors du périmètre de correction directe de cette recette.

6. **Le projet créé à la signature du devis n'hérite d'aucune surface.**
   PR-2026-0008 est arrivé avec `surface_m2 = null` alors que le devis contenait 4,2 m² + 4,38 m²
   de surface développée. Sans ressaisie manuelle, la jauge de remplissage du four et le prix de
   revient restent inexploitables.

7. **`signature_ip` reste vide** sur les devis signés en ligne. Pour une signature électronique
   présentée comme « horodatée et conservée », l'absence d'adresse IP affaiblit la valeur
   probante en cas de contestation.

8. **Les notifications restent en file.** La signature du devis a bien créé une notification
   `devis_signe` en statut `pending` à destination de `contact@thermotest-test.fr`, mais aucun
   envoi n'a été observé. À vérifier côté cron / Edge Function avant mise en service.

9. **L'autocomplétion d'adresse (BAN) n'existe qu'à l'onboarding.** L'API `/api/adresse` répond
   correctement, mais ni les Réglages ni la fiche client ne l'utilisent. Sur ThermoTest, le champ
   « Ville » contenait `83150 bandol` (code postal collé dans la ville) — exactement le type de
   saisie que l'autocomplétion évite. Corrigé manuellement pendant la recette.

### Mineures / cosmétiques

10. Sur la page publique de devis, les quantités sont affichées en format anglais (`4.2 m2`,
    `12.5 ml`) alors que les montants sont en français (`139,10 €`). Idem `46.5 kg` sur le BL.
11. « 1 bon de livraison **seront** regroupés » sur la facture récapitulative.
12. Le capital social s'affiche `capital 10000` sans séparateur ni symbole sur la facture publique.
13. Onglet Réglages > Grille m² : les catégories de coefficients sont affichées avec leur code brut
    (`complexite`, `couche`, `finition`, sans accent) et dans un ordre non métier
    (Simple, Complexe, Moyenne).
14. Le tableau de bord ne relaie pas les alertes DLU / stock, pourtant présentes sur `/stock`.
15. La signature du déposant n'est pas reproduite sur le bon de réception public `/rc/<token>`.
16. Dans le sélecteur de lot, les lots ne sont pas triés par DLU : le lot qui périme dans 44 jours
    est proposé **après** celui qui périme en 2027.
17. Sur la fiche devis finalisée, la mention « Brouillon enregistré automatiquement à hh:mm:ss »
    reste affichée.

---

## 4. Jeu de données ThermoTest

Données manifestement fictives (préfixe `TEST`, emails en `@*-test.fr`), utilisables telles quelles
pour une démo :

- **1 grille au m²** (« TEST - Grille standard m2 », forfait mini 25 €) avec 4 paliers
  (0–1 : 45 €, 1–3 : 32 €, 3–10 : 24 €, 10+ : 18 €) et 8 coefficients (finition, complexité, couches).
- **5 prestations** dont « Marquage traçabilité laser » en unité `ml`.
- **3 tarifs au mètre linéaire** (garde-corps 28 €, main courante 19 €, portail 34 €) avec périmètres
  développés.
- **3 pièces types** (jante alu 17", portail 2 vantaux, grille de ventilation).
- **4 poudres** réalistes : RAL 9005 mat (190 °C / 15 min, 13,20 €/kg, 9 m²/kg), RAL 7016 texturé
  (200 °C / 18 min, 15,90 €/kg, 8 m²/kg), RAL 9010 brillant (180 °C / 15 min, 12,50 €/kg, 10 m²/kg),
  vernis transparent (190 °C / 20 min, 17,20 €/kg, 11 m²/kg).
- **6 lots** dont **TEST-LOT-9005-B périmé** (DLU 10/05/2026) et **TEST-LOT-7016-B à 44 jours**
  (DLU 30/09/2026).
- **4 clients** : un particulier (Jean Testard), un garage (Garage Testard Automobiles), une
  chaudronnerie et Menuiserie Aluval — cette dernière avec grille dédiée, remise 12 %, tarif négocié
  sur le sablage, facturation mensuelle et paiement à 45 jours.
- **5 devis** : 1 brouillon, 1 envoyé, 3 signés, dont DV-2026-0006 signé en ligne pendant la recette.
- **8 projets** couvrant toutes les étapes (attente, préparation, poudrage, cuisson, contrôle,
  prêt, livré), dont deux passés ensemble en fournée.
- **3 fournées** : deux terminées avec relevé de cuisson, une planifiée.
- **3 réceptions** avec réserves, **2 bons de livraison** dont un signé, **4 factures**
  (émise, payée, récapitulative en brouillon), **2 instruments**, **4 contrôles**, **2 relevés de
  bain**, **2 non-conformités**.

---

## 5. Avis

Le socle métier est là et il tient : chaînage devis → projet → fournée → BL → facture, signature
en ligne, décompte de poudre, chronométrage, prix de revient, registre qualité exportable en PDF.
Les calculs vérifiés à la main (grille m², coefficients, remise, surface développée, conso poudre,
coût main d'œuvre) sont tous exacts.

Deux réserves avant de le mettre entre les mains d'un atelier réel :

- Le bug de saisie décimale (A2) rendait le chiffrage silencieusement faux. Il est corrigé, mais il
  montre que les écrans n'ont jamais été utilisés en saisie clavier réelle jusqu'ici : il faut
  refaire une passe de saisie sur chaque formulaire numérique avant toute démonstration.
- Les ruptures de chaîne restantes (BL qui ne fait pas avancer le projet, BL et facture non
  préremplis depuis le devis, surface non héritée, stock/lots qui divergent) obligent à des
  ressaisies et créent des états incohérents. Ce sont elles, plus que les bugs cosmétiques, qui
  feraient décrocher un utilisateur en conditions réelles.

En l'état : **démontrable, pas encore exploitable en production sans les points majeurs 1 à 4.**

---

## 6. Reprise du 18/08/2026 — correction et vérification des points restants

Tous les points de la section 3 ont été repris, corrigés et **revérifiés en production** sur
ThermoTest, en actionnant l'interface au clavier et en recontrôlant chaque effet en base.
Chaîne complète rejouée de bout en bout : devis **DV-2026-0007** et **DV-2026-0008** →
projets **PR-2026-0009** / **PR-2026-0010** → fournée **F-20260818-1** → cuisson → BL
**BL-2026-0003** signé → facture **FA-2026-0004**.

### Majeures

| # | Anomalie | Statut | Correction | Vérification |
|---|---|---|---|---|
| 1 | Stock global et lots divergent | **Corrigée** | La RPC `avancer_etape` impute désormais la consommation de cuisson à un lot précis via `consommer_lots()` : lot déjà rattaché au projet en priorité, sinon **le plus proche de sa DLU parmi les lots valides** (les périmés en dernier recours). Un trigger `lot_sync_stock` sur `poudre_lots` maintient `poudres.stock_kg = Σ restant_kg`. `mouvement_stock` (pesée / ajustement) impute lui aussi sur les lots. La réception passe par une RPC atomique `receptionner_lot` (lot + mouvement + compteur dans une seule transaction) qui matérialise le stock antérieur non tracé en lot `STOCK-INITIAL`. Fonction de réconciliation `reconcilier_stock_lots()` exécutée : l'écart de **0,860 kg** du RAL 7016 a été imputé au lot TEST-LOT-7016-B, avec un mouvement `ajustement` explicite. | Cuisson de la fournée F-20260818-1 (2 projets) : 0,675 kg et 1,073 kg décomptés **automatiquement** du lot TEST-LOT-7016-B, `stock_mouvements` porte `lot_id`, `lot_numero` et `dlu`. Stock = 27,319 kg = somme des lots, sur les 4 poudres. Réception d'un lot TEST-LOT-7016-C de 12,5 kg → 39,819 = 39,819. Pesée à 39 kg → −0,819 kg imputés FIFO au lot B → 39,000 = 39,000. Correction manuelle de lot testée : les kg sont rendus au lot initial et repris sur le nouveau, total inchangé. |
| 2 | Le BL signé ne fait pas avancer le projet | **Corrigée** | `signer_bl` clôt le projet rattaché : toutes les étapes restantes sont marquées faites (`source: bl`), `status = livre`, `date_livraison` posée. Une notification `bl_signe` prévient l'atelier. | BL-2026-0003 signé par « Sophie Testonne » sur `/bl/<token>` → PR-2026-0010 `status = livre`, `etape_courante = livre`, `date_livraison = 18/08/2026`. Le projet a disparu du tableau de production et la page de suivi client affiche la timeline complète jusqu'à « Livré ». Rattrapage appliqué à PR-2026-0008 (BL-2026-0002 déjà signé). |
| 3 | Aucun préremplissage du BL ni de la facture | **Corrigée** | Le devis signé propose **« Créer la facture »**, **« Créer le bon de livraison »** et **« Voir le projet »**. `/bl/new?projet=…` préremplit client, projet et lignes depuis le devis (bouton « Remplacer par le devis » si le bon n'est pas vierge). `/factures/new` propose un sélecteur **« Reprendre un devis signé »** (devis déjà facturés exclus) qui reprend lignes, client, échéance négociée, remise et rattache la facture au projet. | BL-2026-0003 créé en un clic depuis DV-2026-0008 : ligne 8,58 m² à 24 € reprise telle quelle. FA-2026-0004 créée depuis DV-2026-0007 : 136,86 € TTC, **identiques au devis**, échéance au 02/10/2026 (45 j du client), `devis_id` et `projet_id` renseignés. |
| 4 | La suggestion de fournée propose la moins remplie | **Corrigée** | `suggestionMeilleureFournee` remplit désormais en partant des pièces les plus encombrantes et compare **tous** les groupes de teinte pour retenir celui qui remplit le mieux le four sans le faire déborder. | Avec 5,4 m² et 8,58 m² en attente pour un four de 9 m², l'assistant propose « 1 projet TEST-RAL7016-TEXTURE (8,58 m²) — four rempli à **95 %** ». L'ancien algorithme proposait 5,4 m² (60 %). |

### Moyennes

| # | Anomalie | Statut | Correction | Vérification |
|---|---|---|---|---|
| 5 | Coût énergie à parts égales | **Corrigée** | La vue `projet_revient` répartit la consommation au prorata de `fournee_projets.surface_m2` (repli à parts égales si la surface est absente). | Fournée à 18 kWh / 0,19 €/kWh : **2,10 €** pour le projet de 8,58 m², **1,32 €** pour celui de 5,4 m² — somme 3,42 €. |
| 6 | Le projet n'hérite pas de la surface du devis | **Corrigée** | `trg_devis_signe` calcule la surface à laquer depuis les lignes du devis (m² direct, équivalent développé des mètres linéaires, surface unitaire des pièces types × quantité). | PR-2026-0009 créé avec `surface_m2 = 5,40` (devis 5,4 m²). Rattrapage appliqué aux projets existants (PR-2026-0007 → 5,95 m²). |
| 7 | `signature_ip` vide | **Corrigée** | Route serveur `/api/ip` (le navigateur ne connaît pas son IP publique) appelée juste avant chaque signature ; colonnes `signature_ip` ajoutées sur `bons_livraison` et `receptions`. | DV-2026-0007 : `signature_ip = 90.119.33.69`, IP également conservée dans `signature_data`. BL-2026-0003 : même IP enregistrée. |
| 8 | Les notifications restent en file | **Corrigée (et faux positif partiel)** | La chaîne fonctionnait : le cron `tg-process-notifications` tourne toutes les 5 minutes, la recette avait simplement observé la file entre deux passages. Deux vrais défauts corrigés : les liens des mails pointaient vers l'ancien hébergement `srv1325118.hstgr.cloud` au lieu de la prod, et le statut passait à « envoyé » sans jamais vérifier la réponse du relais. Ajout de `notifications.http_request_id`, d'une fonction `verifier_notifications()` et d'un cron de contrôle. | Les 5 notifications produites pendant cette reprise (`devis_signe` ×2, `projet_etape` ×2, `bl_signe`) sont passées en `sent` avec **HTTP 200 `{"ok":true}`** du relais `tg-mailer.php`. |
| 9 | Autocomplétion d'adresse absente hors onboarding | **Corrigée** | `AdresseInput` (Base Adresse Nationale) branché sur le siège dans Réglages et sur les adresses de facturation et de livraison de la fiche client. La liste ne s'ouvre que pendant une saisie réelle, pas au chargement d'une fiche déjà remplie. | Saisie « 12 quai du Port » dans Réglages : suggestion « Quai du Port · 83150 Bandol », code postal et ville remplis automatiquement. |

### Mineures / cosmétiques

| # | Anomalie | Statut | Vérification |
|---|---|---|---|
| 10 | Quantités en format anglais | **Corrigée** — helpers `nombreFr` / `uniteFr` / `qteFr` dans `src/lib/utils.ts`, utilisés sur les pages publiques devis / BL / facture, dans les PDF et dans les écrans de fournée et de stock. | Devis public : « 5,4 m² ». BL public : « 8,58 m² » et « 46,5 kg ». Stock : « 39,819 kg ». |
| 11 | « 1 bon … seront regroupés » | **Corrigée** | Écran facture récapitulative : « **1 bon de livraison sera repris sur la facture.** » |
| 12 | Capital social brut | **Corrigée** — la cause réelle était `eur()` : PostgREST renvoie les `numeric` en chaîne et `"10000".toLocaleString()` ne formate rien. `eur()` coerce désormais la valeur. | Facture publique : « SARL · **au capital de 10 000,00 €** · SIREN 900123456 · RCS Toulon ». |
| 13 | Codes de coefficients bruts | **Corrigée** | Réglages > Grille m² : groupes **Finition** / **Complexité de la pièce** / **Nombre de couches**, valeurs dans l'ordre métier (Mat, Brillant, Structuré — Simple, Moyenne, Complexe). |
| 14 | Pas d'alerte DLU sur le tableau de bord | **Corrigée** | Accueil : « 1 lot de poudre périmé — rendu non garanti », « 1 lot à écouler sous 60 jours », « Stock à risque : 198,34 € ». |
| 15 | Signature du déposant absente du bon de réception public | **Corrigée** — `reception_public` expose la signature. | `/rc/<token>` de RE-2026-0003 : signature manuscrite affichée avec le nom du déposant et l'horodatage. |
| 16 | Lots non triés par DLU | **Corrigée** | Sélecteur de lot de la fiche projet : TEST-LOT-7016-B (DLU 30/09/2026) proposé **avant** TEST-LOT-7016-A (DLU 01/09/2027), avec la DLU affichée dans chaque option. |
| 17 | Mention « Brouillon enregistré » sur un devis finalisé | **Corrigée** | DV-2026-0007 finalisé : la mention a disparu, tous les champs sont désactivés. |

### Anomalies découvertes pendant cette reprise

| # | Anomalie | Criticité | Correction |
|---|---|---|---|
| B1 | **La remise contractuelle du client ne survivait pas à la facture.** Les totaux étaient bien copiés à la création depuis le devis, mais `FactureEditor` les recalculait à partir des seules lignes dès la première réouverture : une facture de 136,86 € repassait silencieusement à 155,52 €, soit le tarif plein. | **Critique** | Colonne `factures.remise` (miroir de celle du devis), reprise dans l'éditeur, dans la facture publique et dans le PDF ; rattrapage des factures existantes dont les totaux portaient déjà une remise implicite. Vérifié : FA-2026-0004 affiche « Sous-total 129,60 € · Remise (12 %) −15,55 € · Total HT 114,05 € » et reste à 136,86 € après enregistrement. |
| B2 | **La pesée et l'ajustement de stock étaient cassés** : deux surcharges de `mouvement_stock` (5 et 7 arguments) coexistaient et Postgres refusait de choisir (« Could not choose the best candidate function »). | Majeure | Surcharge à 5 arguments supprimée, la fonction unique porte des valeurs par défaut. Vérifié : pesée à 39 kg acceptée et imputée au bon lot. |
| B3 | La mention légale « Paiement à N jours » de la facture reprenait le délai de l'atelier alors que l'échéance calculée utilisait celui du client — deux chiffres contradictoires sur le même document. | Moyenne | Le délai négocié du client prime, sur la facture publique comme dans le PDF. Vérifié : « échéance 02/10/2026 » et « Paiement à **45 jours** ». |
| B4 | Sur une facture déjà créée, le sélecteur « Reprendre un devis signé » affichait « Facture libre » à tort (le devis repris n'est plus dans la liste). | Cosmétique | Le sélecteur n'apparaît qu'à la création ; une facture issue d'un devis l'indique par une mention. |

### Non traité, assumé

- **Aucun point de la section 3 n'est resté ouvert.**
- La suggestion de fournée utilise un remplissage glouton par surface décroissante, pas une
  optimisation exacte : sur des combinaisons pathologiques elle peut laisser quelques pourcents
  de four vide. C'est un choix assumé — un algorithme exact serait imprévisible pour l'opérateur,
  qui doit pouvoir anticiper ce que le logiciel va proposer.
- L'invariant stock = somme des lots ne s'applique qu'aux poudres qui **ont au moins un lot**.
  Un atelier qui ne saisit aucun lot garde son compteur global tel quel : c'est volontaire, le
  suivi par lots ne doit pas être imposé.

### Contrôles de non-régression

Rejoués après déploiement : tableau de bord, Réglages (8 onglets), création et signature de devis
(saisie décimale « 5,4 » et « 8,58 » au clavier), fiche projet et validation d'étapes, composition
et clôture de fournée, réception et pesée de stock, écrans qualité, exports PDF (devis, facture,
bon de livraison, registre des contrôles — tous `HTTP 200`, `%PDF-1.3`), pages publiques
`/d/`, `/bl/`, `/f/`, `/rc/`, `/s/`.

### Avis après reprise

Les quatre ruptures de chaîne qui rendaient le produit inexploitable sont fermées : le stock ne
dérive plus, la signature du BL clôt la production, le devis signé alimente le BL et la facture,
et la suggestion de fournée sert enfin l'intérêt de l'atelier. Deux bugs de facturation découverts
au passage (remise perdue, pesée cassée) étaient plus graves que la moitié de la liste initiale —
signe qu'il faut continuer à recetter en saisie réelle plutôt qu'en lecture de code.

**Le produit est déployable pour un premier atelier pilote accompagné.** Avant une mise en vente
large, deux réserves demeurent, hors périmètre de cette reprise : le domaine propre
(`thermogestion-v2.vercel.app` n'est pas un nom commercial) et l'absence de tests automatisés —
tout est vérifié à la main, donc toute évolution future rouvre le risque de régression.
