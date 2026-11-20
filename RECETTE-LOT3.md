# Recette Lot 3 « Connecté » — Thermogestion v2

Travaux du **18/08/2026**, déployés en production (`https://thermogestion-v2.vercel.app`) et
recettés dans le navigateur sur l'atelier de démonstration **ThermoTest**
(`atelier_id = 34be816a-97b4-44f9-a5b2-c3b0b41ce465`), chaque effet étant recontrôlé en base
Supabase (projet `luujbyqenmzivzhiatze`).

Ce rapport est écrit sans complaisance : ce qui n'a pas été vérifié est signalé comme tel, et les
limites connues sont nommées avec ce qu'il faut pour les lever.

---

## 1. Deux réglages fantômes fermés

La suite de tests avait relevé deux paramètres réglables dans l'interface, enregistrés en base, et
sans le moindre effet sur le chiffrage. Un réglage qui ne fait rien est pire qu'un réglage absent :
l'atelier croit l'avoir configuré, et découvre l'écart sur sa marge.

### 1.1 Forfait minimum de facturation

**Règle retenue** : plancher sur le **total HT du devis**, appliqué **après la remise**.

Le plancher porte sur le total et non sur la ligne, sinon un devis de dix petites pièces serait
relevé dix fois. Il s'applique après la remise parce qu'un plancher qu'on remise ensuite n'en est
plus un : le total repasserait sous le minimum annoncé.

Quand il se déclenche, une ligne **« Forfait minimum »** est matérialisée dans le devis, avec le
complément. Le client lit donc sur son document pourquoi il paie 25 € et non 13,50 €. Cette ligne
est tenue **hors de l'assiette de remise** par `calcTotaux`, elle est **recalculée** à chaque
chiffrage (jamais empilée) et elle disparaît d'elle-même dès que le devis dépasse le plancher.

Le forfait **ne s'applique pas à un devis sans aucune ligne au m²** : c'est un réglage de la grille
au m², une prestation forfaitaire de 20 € vendue seule n'a pas à être relevée.

**Vérifié en production** — devis `DV-2026-0009`, client Chaudronnerie Testonne SAS :

| Étape | Attendu | Constaté |
|---|---|---|
| Ligne 0,3 m² mat / simple / 1 couche | 0,3 × 45 € = 13,50 € | 13,50 € |
| Sans remise | complément 11,50 €, total 25,00 € HT | « Forfait minimum (25,00 €) + 11,50 € », Total HT **25,00 €**, TTC **30,00 €** |
| Avec remise 12 % | 13,50 − 1,62 = 11,88, complément 13,12 €, total 25,00 € | Sous-total 13,50 € · Remise (12 %) − 1,62 € · Forfait minimum + **13,12 €** · Total HT **25,00 €** |
| Enregistrement | 2 lignes en base, la seconde marquée `meta.forfait_minimum` | conforme (`plancher: 25`, `pu_ht: 13.12`) |
| Réouverture du devis | 1 seule ligne éditable, pas d'empilement | conforme |
| Page publique `/d/<token>` | ligne « Forfait minimum » visible par le client | conforme |

### 1.2 Coefficient « nombre de couches »

`prixM2` ne multipliait que finition × complexité. Le coefficient de catégorie `couche` est
désormais appliqué, et l'éditeur de devis porte un **sélecteur « Couches »** sur chaque ligne au m²
— affiché seulement si la grille déclare des couches, pour ne pas ajouter un champ vide à un
atelier qui laque toujours en une passe. Les grilles créées depuis les Réglages sont désormais
semées avec « 1 couche » (1,00) et « 2 couches (primaire + finition) » (1,70).

Les trois coefficients se **multiplient** entre eux : une seconde couche, c'est un second passage
en cabine et une seconde cuisson, elle majore un prix déjà majoré, elle ne s'y ajoute pas.

**Vérifié en production** : 1 m², palier 1–3 m² à 32 €/m² → **32,00 €** en 1 couche,
**51,20 €** en 2 couches (× 1,6). Le choix est enregistré dans `meta.couche` et relu à
l'ouverture du devis.

### 1.3 Arbitrage de `pieces_types.coef_complexite`

Ce réglage était lui aussi inutilisé. **Il est appliqué**, plutôt que retiré : c'est le seul endroit
où l'atelier peut dire qu'une jante à voile creux se laque plus lentement qu'une jante plate de même
surface. Il majore le prix unitaire de la ligne, que ce prix vienne du prix catalogue de la pièce ou
de la grille au m². Une mention explicite (« Coefficient de complexité de la pièce type appliqué :
×1,3 ») apparaît sur la ligne, pour qu'aucun prix ne change sans explication. L'aide des Réglages a
été réécrite en conséquence.

Sur ThermoTest, seul « TEST - Portail 2 vantaux » porte un coefficient ≠ 1 (1,30) et n'a pas de prix
catalogue : 4,2 m² → 24 €/m² × 1,30 = **31,20 €/m²**, soit 131,04 € la pièce.

### 1.4 Un devis signé n'est jamais rechiffré

Ajouté à la suite : un devis signé **avant** la mise en place du plancher (13,50 € HT, sans ligne de
forfait) reste à 13,50 € après déploiement, et la base **refuse** toute tentative de le
« régulariser » — le trigger `trg_figer_document` rejette la mise à jour des lignes et des totaux.
Le test rejoue le chiffrage d'aujourd'hui sur les mêmes lignes pour prouver qu'il donnerait 50 €, et
que le document signé, lui, n'a pas bougé.

---

## 2. Catalogue de teintes Thermopoudre intégré

L'atelier cherche une teinte depuis `/stock` et **importe la fiche poudre en un clic** : référence,
RAL, finition, type, température et durée de cuisson, rendement, prix au kg, et
`poudres.tp_product_id` qui garde le lien avec la boutique.

**Architecture** — trois couches, pour que la boutique reste remplaçable :

| Fichier | Rôle |
|---|---|
| `src/lib/thermopoudre/client.ts` | Accès bas niveau au webservice PrestaShop, délai court, erreurs explicites (`CatalogueIndisponible`) |
| `src/lib/thermopoudre/fiche.ts` | Traduction d'une fiche produit en fiche poudre d'atelier — **sans réseau**, donc testable seule |
| `src/lib/thermopoudre/catalogue.ts` | Recherche et lecture groupée |
| `src/app/api/catalogue/poudres/route.ts` | Route serveur, réservée aux utilisateurs connectés |
| `src/components/CatalogueThermopoudre.tsx` | Recherche et import, avec mode dégradé |

**La clé du webservice ne quitte jamais le serveur.** Elle est posée dans la variable
d'environnement `TP_WS_KEY` (ajoutée en production le 18/08), jamais préfixée `NEXT_PUBLIC_`, et la
route n'expose que deux opérations : recherche et lecture de fiches produit. Sans cette variable,
l'écran affiche « **Catalogue Thermopoudre non connecté** » — pas une liste vide qui ferait croire
que la boutique n'a rien en stock.

**Ce que la boutique expose, et ce qu'il a fallu en tirer.** Le webservice PrestaShop ne porte
**aucune caractéristique structurée** sur les poudres : ni RAL, ni cycle de cuisson, ni rendement.
Tout vit dans la description HTML, sous forme d'un tableau « Spécifications » et de deux phrases
normalisées. La lecture est donc textuelle, mais jamais devinée : un champ absent reste vide et
l'atelier le complète. Deux choix métier assumés :

- **cuisson** : « 180-200 °C pendant 10-15 min » est lu comme **180 °C / 15 min** — la borne basse de
  température avec la borne haute de durée, le couple qui polymérise à coup sûr dans un four
  d'atelier ;
- **rendement** : « 8-12 m²/kg » est lu comme **8 m²/kg** — sous-estimer fait commander assez de
  poudre, surestimer arrête la production.

Le prix n'est converti en €/kg que si la fiche annonce un conditionnement en kilos ; un prix porté
par la déclinaison (valeur 0) n'est pas affiché plutôt que d'afficher un prix faux.

**Vérifié en production** — recherche « RAL 9016 » : 6 résultats réels remontés de thermopoudre.fr
(Iba Kymia, polyester, 180 °C / 15 min, 8 m²/kg, 11,13 € à 13,67 €/kg). Import de « RAL 9016 Blanc
mat » → ligne créée dans `poudres` :

```
reference RAL 9016 Blanc mat · marque Iba Kymia · ral 9016 · finition mat · type polyester
prix_kg 12,71 · rendement 8 m²/kg · cuisson 180 °C / 15 min · tp_product_id 453 · stock 0 kg
```

**Teintes d'origine constructeur.** Les fiches RIMCO (arbre « Peinture jante OEM ») sont reconnues
comme une famille distincte, badgées « Teinte constructeur » et importées avec le constructeur et
le code RIMCO. Elles n'ont ni RAL ni prix de base : rien n'est inventé.

**Réapprovisionnement.** Une poudre importée du catalogue renvoie maintenant sur **sa** fiche
produit (`tp_product_id`), et non plus sur une recherche par mot-clé qui rend quarante nuances de
RAL 9005 dont l'atelier peut commander la mauvaise. Les poudres saisies à la main gardent l'ancien
comportement.

---

## 3. Facture électronique Factur-X

Profil **MINIMUM** (`urn:factur-x.eu:1p0:minimum`), généré à la demande depuis la fiche facture
(« Facture électronique (Factur-X) ») ou par `/api/pdf/facture/<id>?facturx=1`.

Le module PDF existant a été **étendu**, pas remplacé : le document imprimé est rigoureusement le
même, on n'agit que sur son enveloppe.

### Ce qui a été vérifié, et comment

**Le XML n'a pas été jugé « ressemblant », il a été validé** contre les schémas officiels
(Factur-X 1.09 MINIMUM, distribués avec la bibliothèque de référence `factur-x` de la FNFE) :

| Contrôle | Outil | Résultat |
|---|---|---|
| XSD `Factur-X_MINIMUM.xsd` | `lxml.etree.XMLSchema` | **valide** |
| Schematron `Factur-X_1.09_MINIMUM.xsl` (XSLT 2.0) | SaxonC HE | **0 règle en échec** |
| Extraction de la pièce jointe d'un PDF réellement produit | `facturx.get_facturx_xml_from_pdf` | pièce jointe **`factur-x.xml`** trouvée |
| XSD sur le XML **extrait du PDF** | `facturx.xml_check_xsd` | **True** |
| Schematron sur le XML extrait du PDF | SaxonC HE | **0 règle en échec** |

Le test `facturx.test.ts` verrouille l'égalité entre le générateur et ce fichier validé : toute
retouche de gabarit qui casserait la validité fait échouer la suite, au lieu de partir chez un
client dont la plateforme rejettera la facture.

**L'emballage PDF**, contrôlé sur le fichier produit :

- pièce jointe nommée **`factur-x.xml`** (nom imposé par la spécification) ;
- relation **`/AFRelationship /Alternative`** — le XML est une autre expression de la même facture,
  pas une annexe agrafée ;
- **`/OutputIntents`** avec `GTS_PDFA1` et un profil ICC sRGB embarqué (456 octets, Compact-ICC-Profiles, CC0) ;
- métadonnées **XMP** : `pdfaid:part 3`, `pdfaid:conformance B`, bloc `fx:` (DocumentType INVOICE,
  DocumentFileName, Version, ConformanceLevel MINIMUM) **et son schéma d'extension `pdfaExtension`**,
  sans lequel un validateur PDF/A rejette les propriétés `fx:` qu'il ne connaît pas ;
- en-tête **`%PDF-1.7`** (le moteur de rendu écrit 1.3, où les fichiers joints n'existent pas
  encore) ;
- producteur et dates cohérents entre le dictionnaire Info et le XMP — un défaut trouvé par le test,
  `pdf-lib` réécrivant silencieusement le producteur à l'enregistrement.

**Contrôles métier avant génération** : sans numéro de facture, la route refuse (409) — une facture
en brouillon n'a rien à faire dans un circuit de facturation électronique. Sans SIREN de l'atelier,
elle refuse aussi, avec le message qui dit où le renseigner. Mieux vaut un refus lisible qu'une
facture rejetée trois jours plus tard par la plateforme du client.

**Vérifié en production** : `/api/pdf/facture/<FA-2026-0004>?facturx=1` renvoie un PDF
`FA-2026-0004-facturx.pdf` qui s'ouvre normalement dans le lecteur du navigateur.

### Ce qui n'est pas fait, et ce qu'il manque

- **La conformité PDF/A-3 n'est pas certifiée.** Il manque une chose, précise et connue :
  **l'incorporation des polices**. Le document utilise Helvetica, une des 14 polices standard PDF,
  que PDF/A interdit. Pour fermer ce point il faut embarquer un fichier TTF (DejaVu Sans ou
  Liberation Sans, licences libres) et l'enregistrer auprès de `@react-pdf/renderer` — une demi-
  journée, y compris la revue de la mise en page qui bougera légèrement. Tant que ce n'est pas fait,
  un validateur veraPDF rendra un verdict négatif, **mais les lecteurs Factur-X extraient le XML
  sans difficulté** (prouvé ci-dessus avec la bibliothèque de référence).
- **Profil MINIMUM, pas BASIC WL.** MINIMUM ne porte pas la ventilation de TVA : le destinataire
  récupère l'identité des parties, les quatre totaux et la référence de commande, pas le détail par
  taux. C'est le profil attendu à la réception en France et il suffit pour l'échéance du
  1er septembre 2026. Pour l'émission TPE/PME du 1er septembre 2027, BASIC WL sera plus confortable
  pour la comptabilité du client : le générateur est prévu pour, l'ajout est une extension du même
  fichier (ventilation `ApplicableTradeTax`, conditions de paiement, moyens de règlement).
- **Le raccordement à une plateforme agréée est hors périmètre**, comme convenu.

---

## 4. Export comptable

Depuis `/factures` → « Export comptable », sur une période choisie (le mois précédent par défaut,
qui est ce que l'atelier transmet chaque mois).

La période porte sur la **date d'émission** et non sur la date de création : c'est la date d'entrée
en comptabilité. Les brouillons et les factures annulées sont exclus — une facture non émise
n'existe pas comptablement et l'inclure fausserait la TVA du mois.

**FEC** (art. A.47 A-1 du LPF) : 18 colonnes réglementaires dans l'ordre, séparateur tabulation,
montants à la virgule, dates en AAAAMMJJ, nom de fichier `<SIREN>FEC<AAAAMMJJ>.txt`.
Journal **VT** (client au débit TTC, produit et TVA au crédit) et journal **BQ** pour les
règlements (banque ou caisse selon le moyen, compte client soldé). Un avoir est écrit **en sens
inverse**, jamais en vente négative. Comptes : 411000, 706000 (services) ou 707000 (biens),
445710, 512000, 530000. Le compte auxiliaire est lisible (`MENUISERAAAA`) mais suffixé de
l'identifiant technique, sinon deux « Menuiserie Martin » fusionneraient dans un seul compte.

**CSV** : une ligne **par facture et par taux de TVA**, c'est la maille dont l'expert-comptable a
besoin pour rapprocher la déclaration. BOM UTF-8, point-virgule, virgule décimale — sans quoi Excel
en français ouvre tout dans une seule colonne et transforme « Émise » en « Ãmise ».

**Vérifié en production**, période 01/08 → 31/08/2026 sur ThermoTest :

- `900123456FEC20260831.txt` (2 755 octets) — en-tête conforme, 4 factures et leurs règlements,
  écritures équilibrées ;
- `export-comptable-2026-08-01-2026-08-31.csv` (731 octets) — BOM `EF BB BF` confirmé,
  4 lignes : FA-2026-0001 à 0004, bases et TVA exactes (203,88 / 40,78 · 65,60 / 13,12 ·
  500,98 / 100,20 · 114,05 / 22,81).

La ventilation de TVA reventile les bases **au prorata** quand une remise globale porte sur le
devis, la dernière ligne absorbant l'arrondi pour retomber exactement sur les totaux enregistrés.

**Non fait** : les connecteurs Pennylane et Axonaut (fonction 27 du cahier des charges), qui
supposent une authentification par atelier et une correspondance de plan comptable — c'est un
chantier à part entière, pas une variante d'export.

---

## 5. Anomalie découverte et corrigée pendant la recette

| # | Anomalie | Criticité | Correction |
|---|---|---|---|
| C1 | **La remise n'apparaissait nulle part sur la page publique de devis.** Le client voyait des lignes dont la somme dépassait le Total HT, sans explication — 13,50 + 13,12 = 26,62 affichés pour un total de 25,00 €. La RPC `devis_public` renvoyait pourtant déjà la remise. | Moyenne | Sous-total et remise affichés sur `/d/<token>`, calculés par le même helper que l'éditeur et le PDF. Vérifié en production : « Sous-total HT 13,50 € · Remise (12 %) − 1,62 € · Total HT 25,00 € ». |

Un helper commun `montantRemise()` a été introduit à cette occasion : le montant de la remise se
déduit désormais **de la remise elle-même**, et non de l'écart entre le brut et le total — depuis le
forfait minimum, cet écart n'est plus la remise, le complément venant s'y ajouter. Les cinq endroits
qui faisaient cette soustraction (éditeur de devis, éditeur de facture, facture publique, PDF devis,
PDF facture) ont été alignés.

---

## 6. Tests

`npm test` : **121 tests, 14 fichiers, tous verts** (~20 s). Quatre fichiers ajoutés :

| Fichier | Tests |
|---|---|
| `forfait-minimum-couches.test.ts` | 16 |
| `catalogue-thermopoudre.test.ts` | 11 |
| `facturx.test.ts` | 11 |
| `export-comptable.test.ts` | 17 |

Les tests du moteur de prix ont été **écrits avant l'implémentation**, comme demandé : ils fixent la
règle métier (plancher après remise, ligne explicite, non-empilement, exclusion des devis sans ligne
au m², intangibilité d'un devis signé) avant qu'une ligne de code ne l'applique.

`npx tsc --noEmit` : aucune erreur. `npx next build` : compilé sans erreur.
Déploiements de production : `thermogestion-v2-o32mmleew` puis correction C1.

---

## 7. Ce qui reste ouvert

1. **Polices non incorporées** dans le PDF (cf. §3) — seul obstacle restant à la conformité PDF/A-3.
2. **Profil BASIC WL** pour l'émission 2027, si un client réclame la ventilation de TVA.
3. **Clé de webservice partagée.** `TP_WS_KEY` est aujourd'hui la clé de travail de la boutique, qui
   ouvre aussi l'écriture. La route n'expose que la recherche et la lecture de fiches, et la clé ne
   sort pas du serveur — mais il faut créer dans PrestaShop une **clé dédiée en lecture seule**,
   limitée aux ressources `products`, `categories` et `search`, et la substituer dans Vercel. C'est
   cinq minutes dans l'administration de thermopoudre.fr, et cela supprime la seule vraie question de
   sécurité de ce lot.
4. **Commande Thermopoudre depuis l'app** (fonction 34) et **portail client pro** (fonction 38) :
   non traités, faute de temps sur ce lot.
5. **Dépendance au gabarit des fiches produit.** Si la présentation des fiches poudre change sur
   thermopoudre.fr, l'import continuera de fonctionner mais rendra des champs vides. Les tests
   figent le gabarit actuel sur des extraits réels ; ils ne détecteront pas un changement côté
   boutique. Un contrôle mensuel de trois références suffirait.

---

## 8. Avis

Le lot 3 fait ce qu'on lui demandait : l'atelier ne quitte plus Thermogestion pour choisir sa
poudre, et la fiche qu'il importe porte l'identifiant du produit — c'est ce lien, et non une
recherche par mot-clé, qui rend le réapprovisionnement mesurable. La boucle commerciale est en
place ; ce qui manque pour la fermer, c'est la commande elle-même.

Sur le Factur-X, mieux vaut être clair : le XML est irréprochable — validé XSD et schematron, et
relu par la bibliothèque de référence après extraction du PDF. Le PDF, lui, est un PDF/A-3 « à une
police près ». Ce n'est pas un détail cosmétique, c'est le dernier point bloquant d'une
certification, et il se ferme en une demi-journée. Tant qu'il n'est pas fermé, il ne faut pas écrire
« PDF/A-3 certifié » sur la vitrine.

Le point qui m'a le plus surpris n'est pas dans le lot 3 : **la remise n'était affichée nulle part
sur le devis que reçoit le client**. Une pièce commerciale dont le total ne se rapproche pas de la
somme de ses lignes, c'est exactement le genre de document qu'un client conteste. Il aura fallu
ajouter une ligne « Forfait minimum » pour que ça saute aux yeux. C'est la deuxième fois sur ce
projet qu'une correction en révèle une autre plus grave qu'elle — le signal, c'est qu'il faut
continuer à regarder les écrans que voit le client, pas seulement ceux que voit l'atelier.
