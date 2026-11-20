# Module jantes — conception, décisions métier, ce qui reste ouvert

*19 août 2026. Conçu et construit d'une traite. Migration 27 (a→e), `src/lib/jantes.ts`,
quatre écrans, une page publique, un PDF, 73 tests. `npm test` : **428 verts**.*

La rénovation de jantes est le seul métier du thermolaquage qu'aucun logiciel du marché ne
traite, et c'est celui où Thermopoudre a un avantage réel : **le seul distributeur en France à
proposer toutes les teintes d'origine constructeur**. Le produit en portait des bribes —
`projets.teinte_origine` jamais lu, trois prestations « dévoilage / redressage / CNC diamant »
posées par un bouton de démarrage, une pièce type « Jante 19" ». Il n'y avait pas de module.

---

## 1. Le modèle

Quatre tables neuves, deux colonnes ajoutées à `photos`, deux catégories de plus dans
`grille_coefs`. **Aucun second moteur de prix.**

```
clients ──┬─→ vehicules ──────┐        (la teinte d'origine se retient par VOITURE)
          │                   ↓
          └─────────────→ jeux_jantes ──→ jantes (1 ligne par roue)
                              │  │            └─→ photos.jante_id
                              │  ├─→ devis_id   (chiffrage)
                              │  └─→ projet_id  (production, prix de revient, fournées)
                              └─ public_token   (bon de prise en charge signable)

grilles_tarifaires ──┬─→ grille_paliers    (prix au m²)
                     ├─→ jante_paliers     (prix au POUCE)
                     └─→ grille_coefs      (finition · complexité · couche
                                            · jante_dessin · jante_finition)
```

### Pourquoi séparer le jeu de la jante

Le devis, le suivi et la facture raisonnent en **jeu**. L'état constaté, les photos, l'opération
mécanique et la retouche sont **par jante**. Fondre les deux aurait donné soit un dossier
incapable de dire quelle jante est voilée, soit quatre dossiers qu'il faut facturer ensemble.

### Pourquoi une table `vehicules`

Un garage ne dit pas « RAL 7016 », il dit « la teinte d'origine de ma Golf 8 GTI ». Cette teinte
appartient à la voiture, pas au dossier : le même client revient avec la même voiture, et le
second jeu doit être **préchiffré tout seul**. C'est le « en un geste » demandé — choisir le
véhicule reprend diamètre, largeur, dessin, finition, teinte et TPMS du dernier jeu.

L'immatriculation est **normalisée en base** (majuscules, sans séparateur) et unique par atelier :
sans cela, « AB-123-CD » et « ab 123 cd » auraient créé deux voitures, deux teintes d'origine et
deux historiques. La normalisation est dans un trigger, pas dans l'écran — la saisie peut aussi
venir d'un import.

---

## 2. Le chiffrage

### La règle

```
prix d'UNE jante = palier au pouce × coef. de dessin × coef. de finition
prix du jeu      = prix d'une jante × nombre de jantes
                 + une ligne par opération mécanique, quantifiée au nombre de jantes concernées
```

Le palier se lit **borne basse incluse, borne haute exclue**, dernière tranche à `diametre_max`
nul — exactement comme `grille_paliers`. Une jante de 19 pouces pile tombe dans 19–21.

Barème livré par défaut : 0–17″ = 70 €, 17–19″ = 85 €, 19–21″ = 100 €, 21″+ = 130 €.
Dessin : pleine ×1, standard ×1,15, multibranches ×1,4.
Finition : unie ×1, vernis ×1,2, bicolore ×1,35, diamantée ×1,6, chrome-effet ×1,8.

### Ce qui a été réutilisé plutôt que recréé

| Existant | Réutilisé pour les jantes |
|---|---|
| `grilles_tarifaires` | Le barème jantes s'y rattache : **un garage sous contrat hérite de son propre prix à la jante**, sans réglage supplémentaire. Livré et testé. |
| `grille_coefs` | Deux catégories de plus (`jante_dessin`, `jante_finition`), une seule fonction de lecture (`coefGrille`, désormais exportée de `calculs.ts`). |
| `client_tarifs` / `prixNegocie` | Les opérations mécaniques passent par le tarif négocié du client. |
| `calcTotaux`, `montantRemise`, `appliquerForfaitMinimum` | Aucune ligne de calcul de total n'a été réécrite. |
| `DevisItem` | La ligne de jantes est une **ligne libre marquée `meta.jante`**, sur le modèle exact de la ligne au ml. Conséquence : facture, bon de livraison, PDF, Factur-X, FEC et export comptable la consomment **sans une seule ligne de code supplémentaire**. |
| `trg_devis_signe` | `meta.surface_m2` porte la surface d'UNE jante et `qte` le nombre : le calcul de surface du projet, déjà écrit, fonctionne tel quel. Poudre, énergie, charge du four et prix de revient suivent. |

**La marque est dans `meta`, jamais dans le libellé** — même raison que le forfait minimum : un
atelier retouche un libellé, et la ligne cesserait d'être reconnue.

### La surface d'une jante

`surfaceJante(d) = 0,1 × d − 0,8` m², plancher à 0,3. Calage **volontaire sur les valeurs que le
produit annonce déjà** dans sa bibliothèque de pièces types (17″ = 0,9 m², 19″ = 1,1 m²) : deux
écrans du même logiciel ne peuvent pas donner deux surfaces pour la même jante.

Le dessin n'entre pas dans la surface. Une multibranches a bien plus de surface développée qu'une
jante pleine, mais aucune règle simple ne la donne — la surface reste corrigeable à la main
plutôt que devinée par un coefficient inventé.

---

## 3. Les décisions métier, et pourquoi

**1. Les opérations mécaniques ne sont pas dans le prix à la jante.**
Elles sont des lignes de prestation séparées (`prestations.code` = `JT-DEVOILAGE`, `JT-VALVE-TPMS`…),
quantifiées **au nombre de jantes concernées**. Sur un jeu de quatre, une seule est souvent
voilée : le garage doit lire « Dévoilage × 1 » et non un prix de jeu majoré sans explication.
C'est aussi la seule façon de tracer les valves TPMS, litige le plus fréquent et le plus cher du
métier.

**2. Une opération sans prestation déclarée n'est pas facturée à zéro, elle est ignorée** — et
l'écran le dit. Une ligne à 0 € ferait croire à l'atelier qu'il l'a vendue.

**3. Le forfait minimum au m² ne relève pas un devis de jantes.**
Le plancher est un réglage de la grille au m², et la règle « il ne se déclenche que s'il y a au
moins une ligne au m² » était déjà écrite et documentée. Une jante isolée à 100 € n'a pas à être
relevée à un minimum calibré sur des portails ; un jeu de 4 est de toute façon très au-dessus.
Sur un devis **mixte** jantes + m², le plancher s'applique au total, jantes comprises.
*Comportement le moins surprenant, à revoir si un atelier le demande.*

**4. La référence constructeur n'est imprimée que si la teinte EST celle d'origine.**
Trouvé à l'écran pendant la recette : une Golf livrée en Gris Argent (LY7W) repeinte en noir mat
affichait « teinte Noir mat (LY7W) » — le code d'une autre teinte, sur le devis d'un client. Le
garde-fou est dans `libelleJeu`, pas dans l'appelant : trois écrans construisent ce libellé.
Sans drapeau explicite, c'est la présence d'une référence constructeur qui tranche — sans code
d'origine, l'atelier n'a rien qui lui permette d'écrire « teinte d'origine » à un concessionnaire.

**5. Le statut du jeu se déduit de ses jantes, sauf « livré » et « annulé ».**
Un jeu dont trois jantes sont prêtes et la quatrième en retouche **n'est pas prêt**. Annoncer
« prêt » ferait venir le garage pour rien, et c'est ce qui fait cesser de croire un tableau de
bord. La règle est **en base** (trigger `jeu_statut_depuis_jantes`) et répliquée à l'identique en
TypeScript (`statutJeuDepuisJantes`) pour l'affichage. Une jante au rebut compte comme traitée :
elle ne reviendra pas. « Livré » et « annulé » sont des décisions humaines, jamais écrasées.

**6. Un second parcours de production, pas un parcours modifié.**
Les étapes d'une jante ne sont pas celles d'un portail. L'atelier avait **un seul** workflow
configurable ; un atelier qui fait les deux métiers n'avait nulle part où pointer la dépose des
pneus. Il y a désormais `settings.workflow_jantes`, réglable dans Réglages → Étapes → Parcours
jantes, et **le devis choisit tout seul** : une seule ligne de jantes suffit à ouvrir le projet
sur le parcours jantes.

Parcours livré : réception · dépose pneu · décapage · dévoilage/redressage · sablage ·
apprêt et laquage · **cuisson** · diamantage CNC · vernis · repose pneu et équilibrage ·
**contrôle** · **prêt** · **livré**.

⚠️ Les quatre codes en gras sont conservés à l'identique : ce sont eux que `avancer_etape`
reconnaît pour décompter la poudre du lot FIFO, basculer le projet en « prêt » et notifier le
client. **Les renommer casserait la traçabilité de lot et le prix de revient en silence.** Seuls
les libellés sont modifiables à l'écran.

**7. Le dossier jantes EST le document de réception.**
Pas de ligne `receptions` en doublon : la table `receptions` ne sait pas décrire quatre pièces
avec quatre états distincts. Le dossier a son propre jeton public, sa RPC exposée à `anon`
(`jeu_jantes_public`), sa page `/jt/[token]` et sa signature (`signer_jeu_jantes`, double
signature refusée en base). C'est le seul document qui protège vraiment l'atelier : « votre jante
avant droite était déjà voilée » ne se démontre pas avec quatre photos d'un tas de jantes.

**8. Les photos sont rattachées à la jante, pas au dossier.**
`photos.jante_id` et `photos.jeu_jantes_id`. Et l'erreur d'insertion est **remontée à l'écran**,
pas avalée — c'est précisément ce qui a laissé cinq réceptions sans une seule photo exploitable
(cf. `AUDIT-FONCTIONNEL.md` #37).

**9. Une jante se compte en jantes.** `unite: "jante"` sur la ligne de devis : le garage lit
« 4 jantes », pas « 4 pièces », sur une facture qui porte aussi des prestations à la pièce.

---

## 4. Ce qui a été corrigé au passage

**La fuite de photos du bon de réception.** `reception_public` joignait les photos sur `projet_id`
alors que `photos.reception_id` est renseigné. Conséquence : un client sans projet ne voyait
aucune photo, et un client dont le projet portait plusieurs réceptions **voyait celles des
autres**. Corrigé dans la même migration, parce que la même erreur aurait été recopiée dans
`jeu_jantes_public` (qui joint strictement sur `jante_id`).

**Deux aides de workflow exposées en RPC PostgREST.** `_workflow_jantes` est née appelable par
`anon` — l'advisor l'a signalé dès sa création. `EXECUTE` révoqué, et `_workflow_defaut`, qui
traînait ouverte à `authenticated` depuis le lot 1, l'a été aussi. Deux tests de non-régression
dans `securite-rpc.test.ts`.

---

## 5. Ce qui est prouvé, et par quoi

**73 tests neufs**, 355 → 428.

`tests/jantes-chiffrage.test.ts` (39 tests, fonctions pures) : lecture des paliers aux bornes,
multiplication dessin × finition, **non-contamination entre les coefficients de jante et ceux du
m²** (les codes `unie` et `standard` existent dans les deux familles, avec des valeurs
volontairement absurdes côté m²), code absent = coefficient 1, grille dédiée du client, libellés
de document, opérations quantifiées, statut du jeu, et **cohérence avec le moteur de totaux
existant** (la remise porte bien sur le jeu, le forfait minimum ne le relève pas).

`tests/jantes-dossier.test.ts` (34 tests, **attaqués depuis un client PostgREST authentifié et
depuis un client anonyme**) : numérotation `JJ-`, normalisation et unicité de l'immatriculation,
RLS en lecture et en écriture sur les quatre tables, refus d'un `atelier_id` étranger,
non-exposition des fonctions de trigger, vocabulaire d'état et d'opération refusé hors liste,
unicité de position, **statut déduit sur données réelles** (y compris le cas « 3 prêtes + 1 en
retouche ≠ prêt » et la non-réécriture de « livré »), bon public complet et ordonné, jeton
inconnu, double signature refusée, signature sans nom refusée, **chaîne devis → projet** (bon
parcours, bons codes conservés, surface des quatre jantes, dossier raccroché), et **la couture
devis → BL → facture** : libellé, unité et remise intacts, total au centime.

`tests/demo-lecture-seule.test.ts` : les quatre tables du module sont attaquées une par une sur
l'atelier de démonstration.

**Recette réelle en production** (`/jantes`, `/jantes/[id]`, `/jt/[token]`, PDF) sur l'atelier de
démonstration, qui a été peuplé de deux dossiers réalistes — le différenciateur commercial n°1 ne
pouvait pas être un écran vide pour un prospect. **Deux défauts trouvés à l'écran et corrigés** :
la référence constructeur accolée à une teinte qui n'était pas celle d'origine (décision 4), et
« diamantée (usinage cnc de la face) » imprimé sur le titre du dossier — la parenthèse aide
l'atelier à choisir un réglage, elle encombre un devis.

---

## 6. Ce qui reste ouvert

| # | Point | Pourquoi ce n'est pas fait |
|---|---|---|
| J-1 | **Aucune étiquette ni fiche suiveuse par jante.** Le QR existe au niveau du projet, pas de la jante. | Même chantier que la fiche suiveuse générale (`AUDIT-FONCTIONNEL` #13), toujours ouverte. Une jante isolée en retouche n'a pas de support physique qui l'identifie. |
| J-2 | **La surface ne tient pas compte du dessin.** Une multibranches consomme plus de poudre qu'une jante pleine de même diamètre. | Aucune règle simple ne la donne. Corrigeable à la main sur le dossier. À calibrer sur des pesées réelles. |
| J-3 | **Le contrôle qualité ne descend pas à la jante.** `controles.projet_id` porte le jeu entier. | Un jeu passe la même fournée ; l'épaisseur se mesure par pièce. Une colonne `jante_id` sur `controles` serait la suite naturelle — à voir si un atelier certifié le réclame. |
| J-4 | **Un devis mixte jantes + portail ouvre le parcours jantes.** | Sur-ensemble d'étapes, cas rare. L'alternative — scinder en deux projets — engage la facturation et n'a pas été tranchée. |
| J-5 | **Rien n'est poussé.** Un jeu promis à 48 h et non prêt n'alerte personne : l'écran le montre en rouge, encore faut-il l'ouvrir. | Même limite que tout le produit (`AUDIT-FONCTIONNEL`, point 2 de la synthèse). C'est le chantier qui compte le plus pour ce module : le délai est le critère de choix du garage. |
| J-6 | **Aucun stock de jantes de prêt ni de consigne.** | Chevalets et racks consignés sont la ligne #10 du cahier des charges, absente. |
| J-7 | **La vitrine ne dit toujours rien des jantes.** | Chantier marketing, hors code. Déjà signalé dans le cahier des charges. |
| J-8 | **Le catalogue de teintes d'origine dépend de `TP_WS_KEY`.** Sans clé, la recherche est indisponible et l'écran le dit — la saisie manuelle n'est jamais bloquée. | Décision d'Alexis : créer une clé PrestaShop en lecture seule (signalée depuis le lot 3). |

---

## 7. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/jantes.ts` | Vocabulaire, barème, libellés de document, lignes de devis, statut déduit |
| `src/lib/calculs.ts` | `coefGrille` exporté — une seule lecture de coefficient pour les deux métiers |
| `src/lib/types.ts` | `Vehicule`, `JeuJantes`, `Jante`, `JantePalier`, `PositionJante`, `OperationJante` |
| `src/app/(app)/jantes/` | Liste triée par délai, création avec reprise du dernier jeu, fiche du dossier |
| `src/components/JanteCarte.tsx` | Une jante : état, photos, opérations, statut |
| `src/components/TeinteOrigineSelecteur.tsx` | Recherche de teinte d'origine dans le catalogue Thermopoudre (les OEM en tête) |
| `src/app/jt/[token]/` + `JeuJantesPublicClient.tsx` | Bon de prise en charge public et signature |
| `src/lib/pdf/jantes.tsx` + `src/app/api/pdf/jantes/[id]/` | Le PDF opposable, photos incluses |
| Migration `27_jantes_*` (5 parties) | Tables, RLS, verrous, numérotation `JJ-`, workflow, RPC publiques |
