# Lot 6 — Recette

*19 août 2026. Quatre ruptures de chaîne de l'`AUDIT-FONCTIONNEL.md` (R1/R2, R4, R6, R8) et deux
besoins métier remontés par Alexis (contrôles activables par atelier, temps partagé entre plusieurs
pièces).*

**355 tests verts** (308 avant ce lot, +47), `npx next build` sans erreur, zéro erreur TypeScript,
déployé en production sur `thermogestion-v2.vercel.app`.

---

## Ce qui a été fermé

| # | Rupture | État | Preuve |
|---|---|---|---|
| R1 | Le verdict qualité n'était pas recalculé côté serveur | ✅ **Fermé** | `tests/verdict-qualite-serveur.test.ts` — 21 tests, attaque PostgREST authentifiée et anonyme |
| R2 | Un contrôle gênant pouvait être supprimé | ✅ **Fermé** | Policy `DELETE` retirée ; 3 tests le rejouent depuis l'extérieur |
| R4 | Un bon de livraison déjà facturé restait refacturable | ✅ **Fermé** | `tests/facturation-bl-acompte.test.ts` — 7 tests ; BL-2026-0011 régularisé en base |
| R6 | Une facture d'acompte fermait la porte au solde | ✅ **Fermé** | 6 tests, dont la déduction multi-TVA et le second solde refusé par la base |
| R8 | Le pointage n'ouvrait ni ne fermait le chronomètre | ✅ **Fermé** | `tests/pointage-partage.test.ts` — 5 tests ; vérifié à l'écran sur PR-2026-0021 |
| B1 | Contrôles qualité activables par atelier | ✅ **Livré** | 11 tests ; recette navigateur sur `/qualite/referentiels` |
| B2 | Temps partagé entre plusieurs pièces au prorata | ✅ **Livré** | 8 tests ; écran `/pointage` recetté en production |

---

## R1 — Le verdict est rendu par la base

### Ce qui était cassé

`conforme` était calculé dans le navigateur (`ControleForm.tsx:104`) et enregistré tel quel. Le
trigger figeait bien une copie du barème et refusait bien toute modification ultérieure — mais rien
ne vérifiait que le verdict correspondait aux valeurs. Un `INSERT` PostgREST portant
`conforme = true` sur une épaisseur relevée à 10 µm était accepté, figé sous un snapshot annonçant
60 µm, et le certificat de conformité imprimait « Conforme ».

Le lot 5 avait prouvé qu'un contrôle **enregistré** ne se modifie plus. Il n'avait jamais prouvé
qu'un contrôle **faux à la naissance** était refusé. C'est la différence entre l'immuabilité et
l'exactitude, et c'est la promesse centrale du produit qui reposait dessus.

### Ce qui a été fait

`public.verdict_controle(type, valeurs, seuils)` en plpgsql : réplique exacte de
`calculerConformite` (`src/lib/qualite.ts:170`), y compris le fait que le verdict d'épaisseur se
joue sur le point le plus fin et jamais sur la moyenne, et que la surépaisseur n'est sanctionnée
que si le référentiel plafonne. `trg_controle_seuils_appliques` écrase désormais
`new.conforme` **après** avoir figé le barème. La valeur envoyée par le client est ignorée, quelle
qu'elle soit.

Le helper `public._controle_num(jsonb, clé)` encaisse ce que le navigateur envoie réellement :
`"62"` en chaîne, `""`, `"  "`, ou une valeur incastable. Une conversion qui lèverait une exception
rendrait tout le contrôle irrecevable — on préfère « pas de verdict » à « verdict faux ».

### Ce que le test prouve

```
10 µm déclarés « conformes » sous un barème à 60 µm ressortent non conformes
le mensonge inverse est refusé aussi : un relevé conforme ne se déclare pas non conforme
la base et le navigateur rendent le même verdict, type par type   (10 cas, 6 types)
une mesure incomplète ne devient pas conforme parce que le client l'affirme
les valeurs arrivent en chaîne depuis le navigateur et sont jugées comme des nombres
le verdict suit le barème du référentiel, pas une constante
```

Le cas « mensonge inverse » n'était pas demandé. Il compte quand même : un atelier n'a pas plus le
droit de noircir sa production que de l'embellir — un registre qui accepte n'importe quel verdict
n'est pas un registre.

**Point de méthode.** Le fichier crée son **propre** référentiel plutôt que d'utiliser celui par
défaut : `seuils-qualite.test.ts` resserre le barème par défaut de l'atelier en cours d'exécution,
et les fichiers partagent le même atelier jetable. Un test de verdict qui dépend de l'ordre des
fichiers ne prouve rien.

---

## R2 — Un contrôle ne s'efface pas

La policy `tenant_all` `FOR ALL` sur `controles` autorisait le `DELETE`. Un contrôle non conforme
gênant s'effaçait en un appel PostgREST, et le certificat redevenait émettable.

Elle est remplacée par trois policies `SELECT` / `INSERT` / `UPDATE`. **Aucune policy `DELETE`
n'existe** : la suppression n'échoue pas, elle ne trouve simplement aucune ligne. C'est le
comportement correct de PostgREST, et c'est ce que le test vérifie — il ne cherche pas une erreur,
il vérifie que la ligne est **toujours là**.

Le correctif passe par la policy et non par un trigger `BEFORE DELETE`, délibérément : la première
version de `figer_controle` avait déjà bloqué le `ON DELETE SET NULL` d'une clé étrangère et fait
échouer silencieusement la suppression d'un référentiel. Une policy ne gêne ni la cascade
référentielle, ni `supprimer_atelier_test()` qui est `SECURITY DEFINER` et hors RLS. Les 27 tests
de `seuils-qualite` — dont celui qui supprime un référentiel et vérifie que le contrôle survit avec
son barème — sont restés verts sans retouche.

La correction d'une erreur de saisie passe par une **nouvelle mesure**, qui prime
(`controlesRetenus` retient le plus récent par type). Une pièce retouchée puis recontrôlée
redevient certifiable sans que la trace de ce qui n'allait pas disparaisse.

---

## R4 — Un bon de livraison ne se facture qu'une fois

### Le cas réel

**BL-2026-0011, 420,30 € HT, livré le 28/07, `status = 'livre'`, `facture_id` nul** — alors que
**FA-2026-0031 (420,30 € HT, payée)** facturait déjà son projet. Le compteur d'éligibilité de la
récapitulative le retenait : une récap de juillet sur ce client refacturait 420,30 €.

`bons_livraison.facture_id` n'était posé **que** par la RPC récapitulative. Une facture créée
depuis un devis ne rattachait rien.

### Ce qui a été fait

- Trigger `facture_consomme_bl` sur `factures` (`AFTER INSERT OR UPDATE OF projet_id, status, type`) :
  une facture de type `solde` ou `libre`, non récapitulative, rattachée à un projet, consomme les
  bons de ce projet. Un **acompte** n'en consomme aucun — c'est un versement anticipé, pas le
  règlement de la livraison. Un **avoir** non plus.
- Trigger `facture_libere_bl` (`BEFORE DELETE`) et branche `status = 'annulee'` : supprimer ou
  annuler une facture rend les bons disponibles. Le `BEFORE DELETE` est nécessaire — après, la clé
  étrangère `ON DELETE SET NULL` a déjà effacé le lien et le bon resterait marqué « facturé » sans
  facture.
- Trigger `bl_facture_unique` sur `bons_livraison` : rebrancher un bon déjà rattaché sur une autre
  facture lève `BL_DEJA_FACTURE`. Et `status` / `facture_id` ne peuvent plus diverger — repasser un
  bon rattaché en « livré » le remet immédiatement en « facturé ».
- Index unique `factures_un_solde_par_devis` : un devis ne se solde qu'une fois. Les acomptes et
  les avoirs en sont exclus, un chantier pouvant porter plusieurs acomptes.
- `facture_recapitulative` verrouille désormais (`FOR UPDATE`) les bons qu'elle reprend : deux
  générations lancées en même temps sur le même client ne peuvent plus embarquer le même bon.
- **Données régularisées** : BL-2026-0011 → FA-2026-0031, et BL-2026-0001 dont le statut disait
  « livré » alors que `facture_id` était renseigné.

### Un bug trouvé par le test

Le premier jet de `facture_recapitulative` posait le verrou avec
`select coalesce(array_agg(b.id), '{}') … for update`. Postgres refuse : *« FOR UPDATE is not
allowed with aggregate functions »*. La RPC récapitulative était cassée en production pendant
quelques minutes. C'est le test `et la récapitulative du mois ne le ramasse plus` qui l'a vu, pas
une relecture. Le verrou se pose maintenant en deux temps : `perform … for update`, puis collecte.

C'est exactement le motif que l'audit signalait : *« un garde-fou qui a l'air correct ne protège
pas forcément »*. Ici, il ne protégeait pas parce qu'il ne s'exécutait pas du tout.

---

## R6 — L'acompte n'interdit plus le solde

### Ce qui était cassé

`FactureEditor:47` retirait de la liste tout devis portant **au moins une** facture. Après un
acompte, le devis disparaissait : impossible de générer le solde. Preuve : FA-2026-0030 est un
acompte de 534,67 € sur DV-2026-0012, et aucun solde n'existe. `facture_liee_id` n'apparaissait que
dans `types.ts:213` — jamais lue, jamais écrite, 0 ligne en base.

### Ce qui a été fait

**L'exclusion se resserre** : ce qui ferme un devis, c'est la facture qui règle le chantier
(`solde` ou `libre`, non annulée), pas un versement anticipé. Le garde-fou est doublé en base par
l'index unique, parce qu'un filtre d'écran n'est pas un garde-fou.

**La déduction est matérialisée en lignes**, pas cachée dans un total : une ligne négative par
acompte **et par taux de TVA** (`lignesDeductionAcomptes`, `src/lib/calculs.ts`). Un acompte
portant du 20 % et du 10 % se déduit à l'identique — sinon la ventilation de TVA du solde ne
retombe pas et le FEC comme le Factur-X sortent faux. Le libellé porte le numéro et la date de
l'acompte : le client doit pouvoir rapprocher la déduction du document d'origine.

**La remise ne s'applique pas deux fois.** `calcTotaux` tenait déjà le forfait minimum hors de
l'assiette de remise ; la déduction d'acompte y entre pour une raison opposée mais de même nature :
la remise a déjà porté sur l'acompte le jour où il a été facturé. Sur un chantier de 500 € remisé
12 % avec un acompte de 132 €, l'assiette reste 500 € (remise 60 €) et non 368 €.

**`facture_liee_id` est enfin écrite**, et le PDF porte la mention attendue sur une facture de
solde : « Acompte(s) déjà facturé(s) et déduit(s) du présent solde : FA-…, pour X € HT. Seul le
solde ci-dessus reste dû. » Le bloc de totaux affiche la ligne « Acompte(s) déjà facturé(s) − X € »
et le total devient « Total TTC restant dû ».

Effet de bord bienvenu : `DuePayableAmount` du Factur-X, qui valait `total_ttc` en dur, tombe
désormais juste sur une facture de solde — la déduction est dans les lignes, donc dans le total.

---

## R8 — Le chronométrage tient de bout en bout

### Ce qui était cassé

Trois choses, dont la troisième était la seule visible pour l'atelier :

1. **La première étape n'était jamais chronométrée.** `pointer_etape` n'ouvre une ligne qu'*après*
   avoir validé la précédente — il n'y en a pas avant la première.
2. **La dernière ne se fermait jamais.** `signer_bl` clôt le projet en marquant toutes les étapes
   d'un coup, sans passer par `avancer_etape` : le chrono de la dernière étape restait ouvert pour
   toujours, et le prix de revient enflait d'heure en heure.
3. **Les deux cartes de la fiche projet se contredisaient.** « Temps passé » comptait le temps
   écoulé d'une ligne ouverte, `projet_temps_cout` ne sommait que `minutes` — null tant que le
   chrono tourne. Une ligne ouverte depuis 48 h s'affichait « 48 h » à côté de « 0 € ».

### Ce qui a été fait

- **La vue `projet_temps_cout` compte le chrono en cours** :
  `coalesce(minutes, temps écoulé depuis debut)`. Les deux cartes disent la même chose, et
  `projet_revient` avec elles. Vérifié à l'écran sur PR-2026-0021 : « Temps passé 3 h 10 » /
  « Coût main d'œuvre 152,00 € — 3 h 10 pointées ».
- **`avancer_etape` chronomètre elle-même** : elle clôt la ligne ouverte et ouvre celle de l'étape
  suivante. Les trois appels séparés à `pointer_etape` côté navigateur (scan, fiche projet, fiche
  fournée) ont été retirés. Une règle qui dépend de trois écrans n'est pas une règle : le moindre
  oubli, ou une coupure réseau entre les deux appels, laissait un chrono ouvert.
  `pointer_etape` reste appelable et devient idempotente, pour un client déployé plus ancien.
- **`signer_bl` referme les chronos** du projet qu'elle clôt.
- **Nouvelle RPC `demarrer_etape`** et bouton « ▶ Démarrer : *étape* » sur la fiche projet et sur
  l'écran de scan, affiché uniquement quand rien ne tourne, avec la phrase qui explique l'enjeu :
  *« Aucun chronométrage en cours : valider maintenant enregistrera l'étape sans temps passé. »*
  Elle passe aussi le projet de `en_attente` à `en_cours`.

**Un choix assumé** : le chrono de la première étape **n'est pas** ouvert à la signature du devis.
Le projet attend souvent plusieurs jours en file avant qu'on y touche ; ce temps d'attente n'est
pas du temps de main d'œuvre, et le compter gonflerait le prix de revient de tous les dossiers.
C'est un geste explicite de l'opérateur — un bouton, ou le démarrage d'un poste partagé.

---

## B1 — Contrôles activables par atelier

### Le besoin

Beaucoup d'ateliers ne contrôlent jamais l'épaisseur, d'autres ne font ni brillance ni Buchholz.
Les six types étaient imposés, et le certificat de conformité **exigeait** une mesure d'épaisseur :
un atelier qui n'en fait pas ne pouvait éditer aucun certificat.

### Ce qui a été fait

`referentiels_qualite.types_controle text[]`, rattachée au référentiel qualité existant plutôt qu'à
l'atelier : un atelier qui travaille sous deux cahiers des charges n'a pas les mêmes obligations sur
les deux. Contrainte en base : au moins un type, et seulement des types connus.

**Le réglage a un effet réel, aux trois endroits promis :**

- **Saisie** : `ControleForm` ne propose que les types actifs du référentiel sélectionné, et
  bascule automatiquement de type si le référentiel choisi retire celui en cours.
- **Base** : `trg_controle_seuils_appliques` lève `TYPE_CONTROLE_DESACTIVE` sur un type désactivé.
  Le réglage n'est pas qu'un filtre d'affichage.
- **Registre PDF** : le sous-titre annonçait les six contrôles quoi qu'il arrive. Sur un atelier qui
  n'en pratique que deux, il promettait à l'auditeur des mesures introuvables plus bas.
- **Certificat** : le blocage `sans_epaisseur` ne s'applique qu'à un atelier qui mesure l'épaisseur.

### Le point délicat : le certificat ne doit jamais affirmer plus qu'il n'a mesuré

C'est là que se joue l'exactitude du document opposable, et trois choses ont dû bouger :

1. **Nouveau blocage `aucun_controle`.** Rendre l'épaisseur facultative ouvrait la porte à un
   certificat sans le moindre contrôle. Il n'attesterait rien du tout. (Il n'est signalé qu'à
   défaut du blocage d'épaisseur, qui dit déjà la même chose plus précisément.)
2. **La plage d'épaisseur de la poudre n'est plus imprimée** quand aucune mesure d'épaisseur n'est
   retenue. Elle l'était en affichage décoratif — « 80 à 120 µm » — et, imprimée seule, elle se lit
   comme une épaisseur constatée. *(Cela réduit aussi R11, sans le fermer : les deux sources de
   vérité sur l'épaisseur coexistent toujours.)*
3. **Les silences du document sont nommés.** Le certificat imprime désormais : *« Contrôles non
   réalisés sur ce dossier, et donc non attestés par le présent certificat : brillance, adhérence. »*
   Et l'attestation ajoute : *« La présente attestation porte sur ces seuls contrôles, à l'exclusion
   de toute caractéristique non reportée au tableau ci-dessus. »*

### L'atelier certifié Qualicoat

Qualicoat, Qualisteelcoat, Qualimarine et Qualidéco reposent tous sur un minimum d'épaisseur
contrôlé en production. Un atelier qui revendique le label et coupe le contrôle d'épaisseur n'est
plus en règle avec son propre agrément.

**Il est averti, il n'est pas empêché** — c'est son agrément, pas le nôtre, et un atelier peut avoir
de bonnes raisons temporaires (sonde en étalonnage). L'avertissement apparaît à deux endroits :
dans le formulaire de réglage au moment où il décoche la case (vérifié en recette, capture ci-dessous
décrite), et sur la fiche projet à l'émission du certificat (`label_sans_epaisseur`).

> ⚠ **Attention :** le référentiel Qualicoat impose un contrôle d'épaisseur de film. En le
> désactivant, vos certificats resteront exacts mais n'attesteront plus l'épaisseur — un audit du
> label, lui, la réclamera.

---

## B2 — Temps partagé entre plusieurs pièces

### Le besoin

Au sablage, la cabine ne traite pas une pièce à la fois : trois ou quatre projets y passent ensemble
et l'opérateur relève **un temps global**. Il n'avait le choix qu'entre imputer tout le temps à un
seul projet ou ne rien pointer du tout — la seconde option étant celle que choisit un atelier pressé.

### Ce qui a été fait

Trois colonnes sur `temps_etapes` : `groupe_id` (le lot), `minutes_groupe` (le temps global relevé)
et `part_pct` (la part imputée). Deux RPC :

- `demarrer_pointage_lot(projets[], etape)` — ouvre une ligne par projet sous un même `groupe_id`,
  après avoir clos ce qui tournait. Refuse un lot de moins de deux projets et n'embarque que les
  projets de l'atelier.
- `arreter_pointage_lot(groupe, minutes?)` — arrête tout, répartit, et **rend le détail** pour que
  l'écran puisse l'expliquer.

**La règle de répartition**, alignée sur celle que `projet_revient` applique déjà au kWh d'une
fournée : au prorata de `projets.surface_m2` — qui porte déjà l'équivalent développé des pièces
chiffrées au mètre linéaire, posé par `trg_devis_signe` à la signature. Le métrage n'a donc pas
besoin d'un traitement séparé.

**Si un seul projet du lot n'a pas de surface renseignée, la répartition bascule à parts égales.**
Ce n'est pas la formule de `projet_revient`, qui donne `1/n` aux seuls projets sans surface et le
prorata aux autres : sur un temps, cette formule ne somme pas à 100 % et ferait disparaître ou
inventer des minutes. Sur une énergie répartie ligne à ligne, l'écart est sans conséquence ; sur du
temps facturable, il ne l'est pas.

**Les minutes restent entières et leur somme est exactement le temps relevé.** Le reliquat d'arrondi
va aux plus grosses parts (méthode du plus fort reste). 100 minutes sur trois pièces de 1 m² donnent
34 / 33 / 33, jamais 33 / 33 / 33.

### L'exemple du cahier des charges

```
60 minutes pour deux pièces de 3 m² et 1 m² → 45 minutes et 15 minutes
part_pct : 75 % et 25 %
```

Vérifié en test, et le temps réparti alimente le prix de revient comme un temps normal : sur un lot
de 120 min entre 6 m² et 2 m², `projet_temps_cout` rend 90 min / 63 € et 30 min / 21 € au taux
horaire de 42 €/h de l'atelier, et `projet_revient` reprend les 63 €.

### La lisibilité

*« L'atelier doit comprendre pourquoi son projet porte 45 minutes et pas 60 »* — trois endroits :

- **Avant** : l'écran `/pointage` annonce « 2 pièces · 44,18 m² au total, répartition au prorata des
  surfaces », ou « au moins une pièce sans surface renseignée : la répartition se fera à parts
  égales ».
- **Juste après** : un encadré vert détaille chaque projet — minutes, pourcentage, surface.
- **Plus tard, sur la fiche projet** : sous la ligne de l'étape, *« dont 45 min au titre d'un poste
  partagé : 1 h relevée pour le lot, 75 % imputés à ce projet (au prorata des surfaces) »*.

Le mécanisme vaut pour **toutes les étapes**, pas seulement le sablage : le sélecteur de poste est
alimenté par le workflow réel de l'atelier, jamais par une liste codée en dur.

---

## Recette navigateur — production, session connectée

| Écran | Vérifié |
|---|---|
| `/qualite/referentiels` | Les six contrôles pratiqués s'affichent sur la carte ; le formulaire propose six boutons à cocher ; décocher « Épaisseur » sur un référentiel Qualicoat fait apparaître l'avertissement en jaune, immédiatement |
| `/pointage` | Les projets en production sont listés avec leur surface ; cocher deux pièces affiche « 2 pièces · 44,18 m² au total, répartition au prorata des surfaces » ; le bouton reste désactivé sous deux pièces |
| `/pointage` (démo) | « Démarrer » sur l'atelier de démonstration est refusé par le verrou de lecture seule, avec le message français attendu — les nouvelles RPC `SECURITY DEFINER` passent bien par `trg_interdire_ecriture_demo` |
| `/projets` | Nouveau bouton « ⏱ Poste partagé » en tête de tableau |
| `/projets/[id]` | « ▶ Démarrer : Poudrage » apparaît quand rien ne tourne, avec l'explication ; « Temps passé 3 h 10 » et « Coût main d'œuvre 152,00 € — 3 h 10 pointées » **concordent** |
| `/projets/[id]` | Le bloc « Pas encore certifiable » liste les blocages sans doublon |
| `/factures/new` | Chargement propre, sélecteur de devis signés opérationnel |
| Console | Aucune erreur applicative (seules celles de l'extension Chrome) |

---

## Ce que la suite de tests couvre en plus

**+47 tests, 3 fichiers.**

| Fichier | Objet |
|---|---|
| `verdict-qualite-serveur.test.ts` | **Le test de sécurité du lot 6.** Le verdict est recalculé en base et la valeur du client ignorée — dans les deux sens du mensonge, sur les six types, avec des valeurs en chaîne et des mesures incomplètes ; le `DELETE` d'un contrôle ne retire rien, ni pour un compte atelier ni pour un anonyme ; un type de contrôle désactivé est refusé à l'insertion, pas seulement masqué ; un référentiel ne peut pas se retrouver sans contrôle ni porter un type inventé ; le certificat exige l'épaisseur seulement si l'atelier la mesure, refuse un dossier sans aucun contrôle, nomme ce qu'il n'atteste pas, et avertit l'atelier labellisé qui coupe l'épaisseur |
| `pointage-partage.test.ts` | La première étape est ouverte par `demarrer_etape` (idempotent, projet passé en production) ; `avancer_etape` clôt et rouvre seule ; la dernière étape se referme ; un BL signé referme le chrono ; la vue de coût compte le chrono en cours ; 60 min sur 3 m² et 1 m² donnent 45/15 à 75/25 % ; le temps réparti remonte à `projet_temps_cout` **et** à `projet_revient` ; une surface manquante bascule à parts égales ; la somme des parts est exactement le temps relevé même sur un arrondi bâtard ; un lot d'un seul projet est refusé ; un lot déjà arrêté ne se réarrête pas ; un projet étranger n'entre pas dans un lot ; anon ne peut ni démarrer ni arrêter |
| `facturation-bl-acompte.test.ts` | La facture du chantier consomme ses bons de livraison et la récapitulative ne les ramasse plus ; rebrancher un bon sur une autre facture est refusé (`BL_DEJA_FACTURE`) ; statut et rattachement ne peuvent pas diverger ; supprimer ou annuler une facture libère les bons ; un acompte n'en consomme aucun ; un devis portant un acompte reste facturable, un devis soldé ne l'est plus ; le solde déduit l'acompte au centime, TVA comprise, avec la mention et `facture_liee_id` ; la remise ne porte pas une seconde fois sur l'acompte déduit ; un acompte multi-TVA se déduit taux par taux ; un devis ne se solde pas deux fois |

**Ce que la suite ne couvre toujours pas** : aucun rendu React, aucun bout-en-bout. Les écrans
`/pointage`, le bouton « Démarrer » et l'avertissement Qualicoat relèvent de la recette manuelle
ci-dessus. La déduction d'acompte est prouvée sur les fonctions et sur la base, pas sur le PDF
rendu — le PDF est vérifié pour ses polices et sa structure, pas pour sa mise en page.

---

## Ce qui reste ouvert

**Directement lié à ce lot :**

- **R11 est réduit, pas fermé.** `poudres.epaisseur_um_min` / `_max` ne sont plus imprimées sans
  mesure d'épaisseur, mais elles restent une seconde source de vérité face à
  `referentiels_qualite`, et ne sont saisissables nulle part.
- **La désactivation d'un type ne masque pas les contrôles passés du registre.** Un atelier qui
  coupe la brillance verra encore ses relevés de brillance des mois précédents dans son registre PDF.
  C'est volontaire — effacer l'historique d'un registre d'audit serait pire — mais ça mérite d'être
  dit à l'atelier, ce que l'écran ne fait pas.
- **Aucune correction manuelle d'un pointage.** Le temps d'un lot se corrige avant l'arrêt (champ
  « temps relevé »), jamais après. Une ligne close reste close.
- **Pas de reprise après coupure sur un lot ouvert.** Un chronométrage partagé démarré puis oublié
  reste ouvert et gonfle le coût, exactement comme une ligne simple. Le garde-fou « un chrono ouvert
  depuis trop longtemps » n'existe pas.

**Non traité par ce lot** (inchangé depuis l'audit) : R7 (décision Stripe avant le 12/09/2026),
la fiche suiveuse A5/A6, les onze coquilles encore ouvertes, S2 à S5.

---

## Migrations appliquées

| Nom | Objet |
|---|---|
| `verdict_qualite_serveur_et_types_actifs` | `verdict_controle`, `_controle_num`, `types_controle`, refonte des policies `controles` |
| `pointage_coherent_et_temps_partage` | `projet_temps_cout` avec chrono en cours, `demarrer_etape`, `avancer_etape` chronométrante, `signer_bl` fermante, `demarrer_pointage_lot`, `arreter_pointage_lot` |
| `bl_rattache_a_la_facture_qui_le_consomme` | `trg_bl_facture_unique`, `trg_facture_consomme_bl`, verrou de la récapitulative, régularisation des données |
| `recap_verrou_en_deux_temps` | Correctif du `FOR UPDATE` avec agrégat, trouvé par le test |
| `un_seul_solde_par_devis` | Index unique partiel + commentaires sur `facture_liee_id` |
| `trg_facture_consomme_bl_invoker` | Le nouveau trigger était né `SECURITY DEFINER`, donc exposé en RPC PostgREST à `anon` — repassé en `SECURITY INVOKER`, `EXECUTE` révoqué |

---

## Sécurité

`get_advisors` relancé après chaque migration. **Une seule anomalie nouvelle**, trouvée et corrigée
le jour même : `trg_facture_consomme_bl()` était née `SECURITY DEFINER` et se retrouvait donc
exposée comme RPC PostgREST à `anon` et `authenticated`. Elle n'est pas exploitable hors contexte de
trigger (`TG_OP` nul), mais la règle du projet ne souffre pas d'exception. Elle n'avait de toute
façon aucun besoin des droits du propriétaire : l'utilisateur possède déjà la facture et les bons du
même atelier. Passée en `SECURITY INVOKER`, `EXECUTE` révoqué.

Les trois nouvelles RPC (`demarrer_etape`, `demarrer_pointage_lot`, `arreter_pointage_lot`) sont
`SECURITY DEFINER` — elles doivent l'être, comme `avancer_etape` — mais `EXECUTE` est révoqué de
`public` et `anon`, et accordé au seul rôle `authenticated`. Vérifié par test : un client anonyme
ne peut ni démarrer ni arrêter un chronométrage. Vérifié en recette : le verrou de lecture seule de
l'atelier de démonstration les intercepte aussi.

Le reste des avertissements (`pg_net` dans `public`, les 7 fonctions publiques à jeton, les tables
de plateforme sans policy) est inchangé et déjà documenté dans `AUDIT-FONCTIONNEL.md`.
