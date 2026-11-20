# Recette Lot 2 — « Le fossé concurrentiel »

*18 août 2026. Qualité et certification, production, rentabilité. Ce document remplace la partie
« Lot 2 » de `RECETTE-LOT1-LOT2.md`, qui ne couvrait que les écrans construits en juillet.*

---

## 1. État des lieux — ce qui existait vraiment avant de commencer

Le cahier des charges affichait les 8 fonctions du lot 2 en « à faire ». C'était faux dans les deux
sens, et c'est exactement ce qui a produit des doublons sur ce projet. Vérification faite en base
(migration 21, tables et vues réelles) et écran par écran :

| Fonction | Statut réel au 18/08 au matin |
|---|---|
| Cahier de contrôles journalier | **Fait** — 6 types, verdict calculé sur le **mini** d'épaisseur, instrument rattaché, export PDF du registre |
| Registre des bains | **Fait** — pH, conductivité, température, titrage, renouvellement |
| Non-conformités & Pareto | **Fait** — typologie de 14 défauts pré-chargée, coût estimé, retouche/rebut |
| Étalonnage des instruments | **Fait** — périodicité, statut à jour / bientôt / en retard / jamais |
| Planification des fournées | **Fait** — groupement par teinte, **blocage dur** sur cycle incompatible, jauge de remplissage, suggestion de la fournée la mieux remplie |
| Fiche de cuisson tracée | **Partiel** — température relevée et kWh saisis, opérateur enregistré mais **jamais affiché**, aucun document |
| Prix de revient réel | **Fait** — vue `projet_revient` : poudre au prix du lot, main d'œuvre chronométrée, énergie au prorata de surface, frais généraux |
| Rendement réel vs théorique | **Partiel** — un panneau par poudre sur `/stock/<id>`, aucune vue transverse |
| **Certificat de conformité PDF** | **Absent** |
| **Suivi des certifications** | **Absent** — pire, `ateliers.label_qualite` s'affichait sur l'écran Qualité et en en-tête du registre PDF alors qu'**aucun écran ne permettait de le renseigner** |
| **Capacité & date de livraison réaliste** | **Absent** |
| **Rentabilité par client** | **Absent** |

Autrement dit : la moitié du lot 2 était construite et avait déjà été recettée en production le
17-18/08 (cf. `RECETTE-LOT1-LOT2.md` §6). L'autre moitié n'existait pas.

---

## 2. La faille trouvée en chemin — et c'est la quatrième du même genre

**La vue `projet_revient` laissait fuiter le prix de revient de tous les ateliers à n'importe qui.**

Une vue PostgreSQL s'exécute avec les droits de son **propriétaire** tant qu'on ne lui pose pas
l'option `security_invoker`. `projet_revient` appartient à `postgres`, qui ignore les politiques RLS.
Elle était en plus `GRANT SELECT` à `anon` — le rôle de la clé publique présente dans le bundle
JavaScript de tout visiteur.

Mesuré avant correction, en se plaçant dans le rôle `anon` :

```
select count(*), count(distinct atelier_id), sum(revient_total) from public.projet_revient;
→ 14 lignes · 2 ateliers · 238,58 €
```

Les deux autres vues créées par la **même migration 21** portaient bien `security_invoker=true`.
Celle-ci non. C'est la même famille de défaut que le `REVOKE` qui oubliait `PUBLIC`, que le contrôle
sur `current_user` inopérant en `SECURITY DEFINER`, et que l'immutabilité de document qui n'existait
que dans React.

**Correction** (migration 22) : `security_invoker=true` sur la vue, plus un `REVOKE ALL … FROM anon`
sur les trois vues d'agrégat, ceinture et bretelles. Après correction, dans le rôle `anon` :

```
ERROR: 42501: permission denied for view projet_revient
```

**Attaque conservée dans la suite de tests.** `tests/lot2-rentabilite-rendement.test.ts` interroge
les quatre vues sensibles depuis un client PostgREST **anonyme** (celui d'un visiteur de page
publique) et depuis un compte atelier réel, à chaque exécution :

- refusée à `anon` — ou, au pire, ne rend aucune ligne ;
- ne rend à un compte atelier **aucune ligne portant un autre `atelier_id`**.

---

## 3. Ce qui a été construit

### 3.1 Certificat de conformité PDF (`/api/pdf/certificat/<projet>`)

Le document qu'un industriel ou une collectivité réclame à la livraison. Une page A4 :

- **Ouvrage traité** : donneur d'ordre, dossier, surface, nombre de couches, dates de réception et de livraison
- **Revêtement appliqué** : teinte (RAL + teinte constructeur d'origine), poudre, nature, finition, **n° de lot**, fournisseur du lot, DLU du lot
- **Cycle de cuisson relevé** : n° de fournée, consigne, **température réellement relevée**, date, **opérateur four**
- **Contrôles réalisés** : le contrôle le plus récent de chaque type, sa mesure, son verdict, sa date, son opérateur, avec rappel de l'épaisseur spécifiée pour la poudre
- **Attestation** signée : label et n° d'agrément **s'ils sont encore valables**, garantie en mois avec sa date de fin, exclusions
- Cartouche de signature de l'atelier

**Il ne se génère pas sur commande.** Un certificat émis sur un dossier incomplet est pire qu'aucun
certificat, parce qu'il est opposable. Quatre blocages, repris de ce qu'un auditeur vérifie sur pièce :

| Blocage | Raison |
|---|---|
| Aucune mesure d'épaisseur | Un certificat sans épaisseur relevée n'atteste rien |
| Un contrôle en vigueur non conforme | Le contrôle **le plus récent** de chaque type fait foi : une pièce retouchée puis recontrôlée conforme redevient certifiable |
| Aucune fournée clôturée avec température relevée | Le cycle de cuisson ne peut pas être attesté |
| Épaisseur mesurée avec un instrument dont l'étalonnage est en retard ou absent | La mesure n'est pas opposable — c'est le premier point d'un audit |

Et trois avertissements qui informent sans bloquer : certification expirée (le label n'est alors pas
imprimé), absence totale de certification, absence de lot de poudre rattaché.

**Vérifié en production**, connecté sur l'atelier de démonstration :

- `PR-2026-0022` (épaisseur + brillance + adhérence conformes, fournée F-2026-0044 relevée à 182 °C, sonde Elcometer étalonnée le 12/03/2026, lot R26-0077) → PDF servi, `certificat-conformite-PR-2026-0022.pdf`, **une seule page**, contenu relu et contrôlé mot à mot ;
- `PR-2026-0021` (aucun contrôle, aucune cuisson) → **HTTP 409** avec le motif exact affiché en clair dans l'onglet : « Aucune mesure d'épaisseur sur ce projet… » et « Aucune fournée clôturée avec température relevée… » ;
- `9bea38ad-…` (projet de **ThermoTest**, autre atelier) → **« Projet introuvable. »** La route ne recopie volontairement aucun filtre `atelier_id` à la main : c'est RLS qui cloisonne, et s'appuyer dessus plutôt que sur un `.eq()` recopié évite l'oubli silencieux.

La fiche projet annonce d'avance ce qui manque, au lieu de laisser cliquer pour tomber sur un refus —
et la route refait exactement le même contrôle côté serveur, parce qu'une règle qui n'existe que
dans React n'est pas une règle.

### 3.2 Suivi des certifications, et fermeture d'un quatrième réglage fantôme

`ateliers.label_qualite` était lu à trois endroits (écran Qualité, en-tête du registre PDF, type
TypeScript) et **écrit nulle part**. Sur ThermoTest il valait `null` depuis la création ; sur l'atelier
de démonstration, il n'avait pu être posé que par un `INSERT` SQL.

Plutôt que d'ajouter un quatrième champ à un formulaire, la colonne a été **supprimée** et remplacée
par une table `certifications` qui porte ce qui manquait pour que le label veuille dire quelque chose :
organisme certificateur, n° d'agrément, date d'obtention et **date d'échéance**. Les valeurs existantes
ont été reprises avant suppression.

- Écran `/qualite/certifications` : création, désactivation, suppression, statut *Valide / À renouveler / Expirée / Sans échéance*.
- Alerte de renouvellement à **90 jours** de l'échéance, relayée sur l'écran Qualité.
- **Une certification expirée n'est plus imprimée** : ni sur le certificat de conformité, ni en en-tête du registre des contrôles. Elle n'engage plus rien, elle n'a rien à faire sur un document.

Vérifié en production : Qualicoat n° QC-1187 (échéance 28/02/2027) → *Valide* et imprimé ;
Qualimarine n° QM-0412 (échéance 15/10/2026, **58 jours**) → *À renouveler*, bandeau d'alerte.

### 3.3 Capacité, taux de charge et date de livraison réaliste

Trois réglages d'atelier (`Réglages → Atelier`), tous les trois avec un effet visible :

```
capacité du four (m²) × cycles tenus dans la journée × taux de remplissage moyen
```

Le taux de remplissage est indispensable : personne ne remplit un four à 100 %, les pièces ont des
formes. Sans cet abattement la date proposée serait systématiquement trop optimiste — et une date
trop optimiste est pire que pas de date, parce qu'elle sera annoncée au client.

- Écran **Pilotage → Charge du four** : m² engagés non livrés, projets en file, m² cuisables par jour, projets dont la date promise est déjà passée, jauge de charge, prochaine date tenable.
- Sur **chaque fiche projet**, à côté du champ « Promis le » : la date tenable au vu du carnet, un bouton « Utiliser cette date », et un **avertissement en ambre quand la date promise passe avant** la date tenable.
- **Aucune date n'est proposée si le four n'est pas paramétré** — l'écran explique quoi renseigner plutôt que d'inventer un chiffre.

Vérifié en production sur l'atelier de démonstration : four de 30 m², 3 cycles, 75 % → **67,5 m²/jour**,
49,58 m² engagés, 73 % de charge, prochaine date tenable **20/08/2026** (mardi 18 + 1 journée de four
+ 1 jour de contrôle et d'emballage, week-ends exclus). Sur `PR-2026-0022`, promis au 14/08 alors que
le carnet donne 20/08 : « La date promise (14/08/2026) passe avant : il faudra doubler des fournées
ou décaler un autre chantier. »

### 3.4 Rentabilité par client

Vue `client_rentabilite`, écran **Pilotage → Rentabilité client**, trié du plus déficitaire au plus
rentable, clients en perte surlignés.

Le sujet n'est pas « combien j'ai facturé » mais « ce client me coûte-t-il plus qu'il ne me rapporte ».
Les trois causes classiques du client déficitaire sont donc exposées **à côté** de la marge :

| Colonne | Pourquoi elle est là |
|---|---|
| m² moyen par projet | Les petites séries coûtent le même accrochage et la même cuisson qu'une grande |
| Délai accordé (moyenne réception → date promise) | Un délai court désorganise les fournées et fait cuire des fours à moitié vides |
| Retouches et leur coût | La non-qualité est un coût **du client**, produit par ses pièces : elle est imputée à sa marge |

Vérifié en production : **Julien Bernard** ressort à **−9,68 €** (5,4 m², livré, pas encore facturé) ;
**Métallerie du Sud** à +278,67 € malgré 46 € de retouche. Une facture restée en brouillon ne compte
pas ; un avoir se déduit ; sans chiffre d'affaires, le pourcentage de marge n'est pas affiché plutôt
que d'être faux.

### 3.5 Rendement réel contre théorique, par teinte

Vue `poudre_rendement`, écran **Pilotage → Rendement teintes**.

Le théorique est ce que l'application a décompté à la cuisson (surface ÷ rendement annoncé). Le réel
ne s'obtient que par la **pesée** : c'est elle qui recale le stock sur la réalité, et l'écart cumulé
des pesées est exactement la poudre partie au sol, au filtre ou en surépaisseur.

**Sans pesée sur une teinte, aucun taux de perte n'est affiché** — la ligne indique « Pesée nécessaire »
plutôt qu'un chiffre inventé.

Vérifié en production : RAL 7016 → 42,5 m² laqués, 5,31 kg théoriques, 6,25 kg réels, **rendement réel
6,8 m²/kg contre 8 annoncés, 15 % de perte, 12,60 €**. RAL 9016, jamais pesé → « Pesée nécessaire ».

### 3.6 Fiche de cuisson tracée

- L'**opérateur** est désormais affiché sur la fournée terminée (il était enregistré depuis juillet et invisible).
- L'**écart consigne / relevé** est calculé et affiché ; au-delà de 5 °C il passe en ambre avec la mention « à justifier si un auditeur reprend cette fournée ».
- **`/api/pdf/fournee/<id>`** : fiche de cuisson A4 — n° de fournée, statut, teinte, relevé complet du cycle (consigne, relevé, écart, durée, consommation, charge du four, dates), opérateur, note, tableau des pièces embarquées avec leur client, **leur lot de poudre** et leur nombre de couches, et deux cartouches de visa (opérateur four, responsable qualité).

Vérifié en production : `fiche-cuisson-F-2026-0044.pdf`, une page, contenu relu.

### 3.7 Correctifs de détail

| # | Constat | Correction |
|---|---|---|
| a | Le bandeau de prix de revient de la fiche projet détaillait poudre + main d'œuvre + énergie, dont la somme ne retombait jamais sur le total : les **frais généraux** étaient dans le total et jamais affichés | Quatrième poste ajouté au détail |
| b | Relevé de cuisson en format anglais (`10.5 kWh`, `182 °C`) | `nombreFr` appliqué, comme sur les autres écrans |
| c | Aucun accès à la rentabilité depuis la navigation | Rubrique **Pilotage** ajoutée à la barre latérale |

---

## 4. Tests automatisés

`npm test` — **234 tests, 22 fichiers, tous verts** (174 avant le lot 2).

| Fichier | Objet |
|---|---|
| `capacite-livraison.test.ts` (15) | Capacité journalière = capacité × cycles × remplissage ; aucune capacité tant qu'un des trois réglages manque ; jours ouvrés qui sautent le week-end ; file d'attente qui ignore le livré et l'annulé ; projets en retard ; date tenable = file + chantier + marge de finition ; **refus de proposer une date sur un four non paramétré** ; surface négative qui ne raccourcit jamais le délai. |
| `certificat-conformite.test.ts` (18) | Contrôle retenu = le plus récent par type (une retouche recontrôlée redevient certifiable) ; cuisson attestée = terminée **et** relevée ; les quatre blocages, chacun isolément ; un instrument « bientôt à étalonner » qui ne bloque pas ; avertissements qui informent sans bloquer ; label non imprimé s'il est expiré ; numéro de certificat stable ; fin de garantie en mois ; certification de référence qui ignore les expirées et les inactives. |
| `lot2-rentabilite-rendement.test.ts` (18) | **Attaque des quatre vues de coût depuis un client anonyme et depuis un compte atelier** ; revient client = somme du revient de ses projets ; client jamais facturé en perte sèche, sans pourcentage de marge inventé ; délai accordé et taille moyenne des séries exposés ; non-conformité chiffrée qui pèse sur la marge ; facture émise qui remonte, avoir qui redescend, brouillon qui ne compte pas ; rendement sans pesée qui n'affiche aucun taux ; pesée qui devient perte chiffrée et rendement réel dégradé ; certifications cloisonnées par atelier. |
| `pdf-qualite.test.ts` (10) | Certificat et fiche de cuisson : PDF structurellement complet, **aucune des 14 polices standard interdites par PDF/A**, programme de police incorporé, **certificat qui tient sur une seule page même avec les six types de contrôle**, rendu d'un dossier minimal (sans label, sans lot, sans opérateur, sans numéro), fournée vide, écart de température. |

Un test préexistant a été corrigé au passage : `securite-rpc.test.ts` comptait « exactement 2 clients »
dans l'atelier jetable, ce qui rendait la suite dépendante de l'ordre des fichiers. La propriété
vérifiée — aucune ligne d'un autre atelier — est conservée, sans le comptage en dur.

---

## 5. Migrations appliquées

| Version | Objet |
|---|---|
| `22_lot2_certifications_rentabilite_rendement_et_fuite_revient` | `security_invoker` sur `projet_revient` + `REVOKE` des trois vues à `anon` ; `ateliers.garantie_mois`, `four_cycles_jour`, `four_remplissage_moyen_pct` ; table `certifications` (RLS, verrou démo, garde d'abonnement) ; vues `client_rentabilite` et `poudre_rendement`, toutes deux en `security_invoker` |
| `22b_client_rentabilite_delai_moyen_simplifie` | Nettoyage d'un `nullif(x, null)` sans effet |
| `22c_supprimer_label_qualite_reglage_fantome` | Reprise des valeurs vers `certifications`, puis suppression de la colonne |

**Le verrou de l'atelier de démonstration a été attaqué depuis le navigateur sur la nouvelle table** :
suppression d'une certification depuis `/qualite/certifications` → **HTTP 400 `DEMO_LECTURE_SEULE`**,
ligne toujours en base, message en français dans l'interface.

---

## 6. Ce qui reste ouvert

1. **La recette navigateur a été faite sur l'atelier de démonstration, pas sur ThermoTest.** L'onglet
   ouvert était sur la démonstration ; en la quittant, la session a été fermée et je ne peux pas
   saisir de mot de passe. Les écritures (création d'un contrôle, d'une certification, d'une fournée)
   sont donc prouvées par la suite de tests, qui s'authentifie réellement contre la production sur un
   atelier jetable, et non par des clics. Les lectures, les PDF et les refus l'ont été au clic.
   **Une repasse au clavier sur ThermoTest reste souhaitable**, en particulier sur la création d'une
   certification et la génération d'un certificat sur un dossier fraîchement contrôlé.
2. ~~**Le taux de perte dépend entièrement de la discipline de pesée.**~~ **Refermé le 20/08** — voir §7.
3. ~~**Le coût énergétique par fournée** (fonction 45) reste au niveau du projet.~~ **Refermé le 20/08** — voir §7.
4. **Chevalets consignés, écran atelier TV, poudre recyclée, consommables** : toujours hors périmètre.
5. ~~**`marge_pct` n'est pas affiché sans chiffre d'affaires.**~~ **Refermé le 20/08** — voir §7.

---

## 7. Points 2, 3 et 5 refermés — 20 août 2026

### 7.1 Le coût énergétique descend au niveau de la fournée (fonction 45)

`src/lib/energie.ts` : `conso_kwh × prix_kwh`, puis **ramené au m² embarqué**. C'est ce dernier
chiffre qui pilote, parce qu'un four de cuisson consomme presque autant à vide qu'à plein — la
montée en température et les pertes de paroi dominent, la masse des pièces ne pèse que
marginalement. Le kWh dépensé est le même ; ce qui change, c'est le nombre de m² sur lesquels on
l'étale.

- **Écran de fournée terminée** : coût de la fournée, coût au m² embarqué, m² embarqués et taux de
  remplissage. En dessous de **50 %** de remplissage, un bandeau ambre chiffre ce que le vide a
  coûté : « à pleine charge, le même cycle serait revenu à X €/m², soit Y € de chauffe payée pour
  du vide ».
- **Fiche de cuisson PDF** (`/api/pdf/fournee/<id>`) : deux cases de plus, et le même avertissement
  de remplissage. Le document tient toujours sur **une page**.
- **Aucun euro n'est affiché sans `prix_kwh`.** L'écran dit quoi renseigner et où, avec le lien vers
  *Réglages → Atelier*, comme le fait la charge du four quand le four n'est pas paramétré. Un prix
  du kWh **à zéro est traité comme non renseigné** : un zéro laissé dans le formulaire produirait un
  « 0,00 € » parfaitement crédible et parfaitement faux.
- Le message de clôture ne promet plus « coût énergie calculé » quand il n'y a pas de prix du kWh.

### 7.2 Le chantier livré non facturé ne ressemble plus à une perte

Migration 23 : la vue `client_rentabilite` porte quatre colonnes de plus, toutes exactes.

| Colonne | Ce qu'elle vaut |
|---|---|
| `reste_a_facturer` | Montant HT des **BL livrés et non facturés**, remise déduite selon la règle exacte de la RPC `facture_recapitulative` (le forfait minimum reste hors assiette de remise). Ce n'est pas une estimation : c'est ce que produirait la facture récapitulative lancée maintenant. |
| `bl_a_facturer` | Nombre de ces bons |
| `projets_non_factures` / `revient_non_facture` | Projets non annulés dont aucune facture de solde ou libre n'est encore partie, et le revient déjà engagé dessus |
| `perte_reelle` | **Vrai uniquement** si tout est facturé (`reste_a_facturer = 0`, `projets_non_factures = 0`) et que le facturé reste sous le revient |

`marge_eur` n'est pas touché : il reste le résultat économique brut à ce jour, exact et tout compris.
Ce qui change, c'est ce que l'écran en fait : **le rouge est réservé à `perte_reelle`**, une marge
négative expliquée par du travail non facturé reste en gris, avec « dont X € de revient pas encore
facturé » sous le montant. Le bandeau « N clients en perte » devient « N clients en **perte
réelle** », doublé d'un bandeau ambre « X € de travail livré attend sa facture » qui ouvre sur `/bl`.
La colonne « Reste à facturer » est cliquable et mène à `/bl?client=<id>`, filtré sur les BL livrés.

Trois chemins de facturation sont reconnus pour dire qu'un projet est facturé : facture émise/payée
portant `projet_id`, facture de solde ou libre portant le même `devis_id`, ou BL du projet déjà
rattaché à une facture. L'**acompte est volontairement exclu** : il ne solde pas un chantier.

### 7.3 La discipline de pesée est expliquée là où le chiffre manque

- **Pilotage → Rendement teintes** : bandeau « N teintes jamais pesées — X kg décomptés sans aucun
  contrôle physique », avec l'explication métier (le rendement fournisseur est un rendement de
  laboratoire ; en cabine on perd entre 5 % et 30 %) et le chemin exact de saisie. Chaque ligne
  « Pesée nécessaire » est devenue un lien vers `/stock/<id>#pesee`.
- **`/stock/<id>`** : le même trou existait, en pire — le panneau de rendement **disparaissait**
  purement et simplement sans pesée. Il reste désormais affiché en mode « voici ce qui manque et
  comment l'obtenir ».

### 7.4 Ce qui a été trouvé de faux en chemin

1. **`CREATE OR REPLACE VIEW` sans clause `WITH` remet les `reloptions` à zéro.** La migration 23c a
   ainsi fait perdre en silence le `security_invoker = true` de `client_rentabilite` — la faille du
   §2, rouverte par une commande d'apparence anodine. Rattrapée par l'advisor Supabase
   `security_definer_view`, corrigée en 23d. **Règle : sur ce schéma, une vue se recrée avec
   `WITH (security_invoker = true)` ou suivie d'un `ALTER VIEW … SET`, jamais avec un
   `CREATE OR REPLACE` nu.**
2. **Le test « aucune ligne d'un autre atelier » ne détecte pas cette perte sur cette vue.** Mesuré
   en production avec deux vues sondes, depuis un compte authentifié n'appartenant à aucun des deux
   ateliers : une vue nue sans l'option rend **8 lignes de 2 ateliers** ; la même vue augmentée du
   `where capacite_ouverte(atelier_id, 'rentabilite')` de `client_rentabilite` en rend **0**. La
   clause de formule masque la fuite, parce que `plan_effectif` est SECURITY INVOKER et lit
   `subscriptions` sous RLS. Les vraies protections, dans l'ordre : le `GRANT` (`anon` n'a rien,
   `authenticated` n'a que SELECT), puis `security_invoker`, puis l'advisor. C'est écrit noir sur
   blanc dans le fichier de tests.
3. **`client_rentabilite` et `poudre_rendement` gardaient un `INSERT/UPDATE/DELETE` accordé à
   `authenticated`** depuis leur création (droits par défaut du schéma `public`). Retiré : SELECT
   seul (migration 23b).
4. **Deux écrans donnaient deux réponses à la même donnée.** `/stock/<id>` déclenchait son panneau
   de rendement sur la **somme des écarts de pesée** (`!== 0`) là où la vue `poudre_rendement`
   compte les **pesées**. Une pesée qui tombe pile — une mesure valide, et un excellent résultat —
   faisait disparaître le panneau d'un écran pendant que l'autre affichait 0 %. Corrigé, avec le
   test de non-régression.
5. **`/stock/<id>` affichait `toFixed()` en format anglais** (`5.31 kg`, `15 %`) au lieu de
   `nombreFr`. Même famille que le correctif §3.7 b.
6. Le panneau bornait le taux de perte à zéro (`Math.max(0, …)`) alors que la vue ne le borne pas :
   une pesée qui trouve **plus** de poudre que prévu signale un décompte trop généreux, et c'est une
   information. Aligné sur la vue.

### 7.5 Migrations et tests

| Version | Objet |
|---|---|
| `23_client_rentabilite_reste_a_facturer` | Reconstruction de la vue avec les quatre colonnes, `security_invoker`, `revoke` de `anon` et de `PUBLIC` |
| `23b_client_rentabilite_droits_lecture_seule` | SELECT seul pour `authenticated` sur `client_rentabilite` et `poudre_rendement` |
| `23c_client_rentabilite_projet_facture_par_devis` | Reconnaissance de la facture rattachée au devis ; acompte exclu |
| `23d_client_rentabilite_restaurer_security_invoker` | Réparation du `security_invoker` perdu par le `CREATE OR REPLACE` de 23c |

L'historique porte aussi `tmp_zz_sonde_security_invoker`, `tmp_zz_sonde2` et
`tmp_zz_sondes_suppression` : deux vues sondes créées et **supprimées dans la foulée** pour mesurer
le point 2 du §7.4. Il n'en reste rien en base.

`npx vitest run` — **36 fichiers, 518 tests passés, 4 ignorés (522)**, dont
`tests/rentabilite-energie-pesee.test.ts` (23 tests neufs) et deux tests ajoutés à
`tests/pdf-qualite.test.ts`. `npx tsc --noEmit` et `npx next build` : succès, aucune erreur nouvelle.

---

## 8. Avis

Le lot 2 est le premier du projet où le logiciel fait quelque chose qu'aucun outil généraliste ne
fait : il refuse d'émettre un certificat de conformité sur un dossier dont l'instrument de mesure
n'était pas étalonné. C'est le genre de détail qui distingue un logiciel écrit pour le métier d'un
tableur repeint.

Est-ce que ça vaut 129 € par mois ? Voir la synthèse remise avec ce document.
