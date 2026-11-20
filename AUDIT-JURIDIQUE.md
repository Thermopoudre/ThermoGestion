# Audit juridique et de conformité — Thermogestion

**Éditeur audité :** SASU Royal Motorbike (nom commercial Thermopoudre) — SIREN 884 381 047 — TVA FR26884381047 — 120 place des Palmiers, 83150 Bandol — RCS Toulon — capital 5 000 €
**Produit audité :** Thermogestion v2 — code `thermogestion-v2`, base Supabase `luujbyqenmzivzhiatze` (eu-west-3, Paris), production `https://thermogestion-v2.vercel.app`
**Date de l'audit :** 19 août 2026
**Périmètre :** code applicatif, schéma et fonctions de la base, PDF réellement générés, pages publiques `/d/ /bl/ /rc/ /f/ /s/`, pages `/legal/*`, chaîne Factur-X, sous-traitants techniques.
**Méthode :** lecture du code et de la base en lecture seule, recoupement avec les sources officielles à jour au 19/08/2026. Aucun code applicatif n'a été modifié.

---

## Avertissement

**Je ne suis pas avocat, ni expert-comptable, ni conseil fiscal. Ce document n'est pas une consultation juridique et n'engage aucune responsabilité professionnelle.**

Il s'agit d'un audit technique de conformité : j'ai comparé ce que le produit fait réellement avec ce que disent les textes et les sources officielles, et j'ai hiérarchisé les écarts selon le risque que j'estime réel. Certaines qualifications retenues ici sont discutables et sont explicitement signalées comme telles. Les points marqués **[AVOCAT]** ou **[EXPERT-COMPTABLE]** doivent être tranchés par un professionnel avant toute décision. La liste consolidée figure au §8.

Convention de lecture :
- **OBLIGATOIRE AUJOURD'HUI** — le manquement est sanctionnable dès maintenant
- **ÉCHÉANCE CONNUE** — le manquement deviendra sanctionnable à une date certaine
- **BONNE PRATIQUE** — pas d'obligation directe, mais exposition contractuelle, commerciale ou réputationnelle

Porteurs : **[TECH]** correction technique sans arbitrage ; **[ALEXIS]** décision de fond ou d'organisation ; **[AVOCAT]** / **[EXPERT-COMPTABLE]** validation externe.

---

## 1. État du droit applicable au 19 août 2026

### 1.1 Calendrier de la facturation électronique — confirmé, pas reporté

Le cadre réglementaire est **complet depuis le 28 juillet 2026**. Le [décret n° 2026-677](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054499487) et l'[arrêté du 27 juillet 2026](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054499535), pris pour l'application de l'article 123 de la loi de finances pour 2026 (loi n° 2026-103 du 19 février 2026), actualisent les annexes II et IV du CGI dans la continuité du décret n° 2022-1299 et de l'arrêté du 7 octobre 2022 ([Compta Online, 28/07/2026](https://www.compta-online.com/facturation-electronique-ao5562)).

| Date | Obligation | Qui |
|---|---|---|
| **1er septembre 2026** | **Recevoir** des factures électroniques via une plateforme agréée | **Toutes** les entreprises assujetties à la TVA, y compris micro-entreprises et franchise en base |
| 1er septembre 2026 | **Émettre** des factures électroniques | Grandes entreprises et ETI |
| **1er septembre 2027** | **Émettre** des factures électroniques | **TPE, PME, micro-entreprises** — c'est la cible commerciale de Thermogestion, et c'est aussi Royal Motorbike |
| 1er septembre 2026 / 2027 | **e-reporting** (B2C, B2B international, données de paiement) | Aligné sur le calendrier d'émission |

Sources : [economie.gouv.fr, mis à jour le 25/02/2026](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir) · [impots.gouv.fr, mis à jour le 10/07/2026](https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique) · [article 91 de la loi de finances pour 2024](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000048727444).

Le pilote national tourne en flux réels depuis le **27 février 2026**.

### 1.2 Rôle des plateformes — le PPF n'émet ni ne reçoit plus

Le portail public de facturation a été recentré : il n'assure **plus l'émission ni la réception** des factures. Il ne conserve que l'**annuaire central** (article 289 bis du CGI) et le **concentrateur de données** vers l'administration (article 242 nonies G de l'annexe II du CGI). La terminologie officielle est désormais **« plateforme agréée » (PA)**, en remplacement de « PDP ».

**Conséquence directe : il n'existe aucune voie gratuite. Toute entreprise doit contracter avec une plateforme agréée**, pour recevoir dès le 1er septembre 2026, pour émettre à son échéance. L'article 289 bis du CGI prévoit que l'émission, la transmission et la réception des factures électroniques s'effectuent en recourant à une plateforme agréée ([Guide pratique DGFiP de démarrage au 1er septembre 2026](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf)).

### 1.3 Statut d'un éditeur de logiciel de facturation : « opérateur de dématérialisation »

La DGFiP le dit sans ambiguïté dans sa [fiche officielle « Les opérateurs de dématérialisation (OD) », version septembre 2025](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiches_reforme/fiche-od.pdf) :

> « Un opérateur de dématérialisation est un prestataire de services qui offre des solutions informatiques de dématérialisation, par exemple des logiciels de facturation […]. En revanche, contrairement à la plateforme, **il n'est pas agréé par l'administration. Il ne peut donc ni transmettre les factures directement à l'administration fiscale, ni les e-reporting** […]. **Néanmoins, dans le cadre de la réforme, il devra obligatoirement être raccordé à une plateforme agréée** pour que les factures soient correctement transmises à compter de la mise en œuvre de la réforme. »

**Thermogestion est un opérateur de dématérialisation.** Il n'a pas d'obligation d'immatriculation, mais il a une obligation de fait : **être raccordé à au moins une plateforme agréée**, sauf à devenir lui-même PA (candidature auprès de la DGFiP, exigences de sécurité et d'audit lourdes — hors de portée à ce stade).

La DGFiP a créé un identifiant « solution compatible » encadré par une charte, pour les éditeurs raccordés. Thermogestion ne peut pas s'en prévaloir aujourd'hui.

### 1.4 Formats et profils

Le socle minimal, obligatoire en réception pour toutes les entreprises et toutes les plateformes agréées, repose sur trois formats conformes à la norme sémantique européenne **EN 16931** : **Factur-X** (PDF/A-3 + XML CII), **UBL 2.1** et **CII (UN/CEFACT)**. Ce socle est décrit par la norme expérimentale **AFNOR XP Z12-012** ([FNFE-MPE, page Factur-X, mise à jour 04/08/2026](https://fnfe-mpe.org/factur-x/) · [texte de la norme publié par impots.gouv.fr](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/specification_externes_b2b/afnor/norme-afnor-factures.pdf)).

Factur-X comporte cinq profils. Le FNFE-MPE les décrit ainsi :

| Profil | Contenu |
|---|---|
| **MINIMUM** | « données minimum exigées par la plateforme Chorus Pro, équivalent à une extraction de données d'entête et pied par OCR » |
| BASIC WL | entête et pied de facture couramment utiles |
| BASIC | BASIC WL + données essentielles de ligne |
| **EN 16931** | toutes les données prévues par la norme sémantique européenne |
| EXTENDED / **EXTENDED-CTC-FR** | EN 16931 + données additionnelles ; **EXTENDED-CTC-FR est le profil de référence français**, sous-ensemble d'EXTENDED, porteur des mentions et statuts propres au dispositif national |

La version en vigueur est **Factur-X 1.09.2 / ZUGFeRD 2.5.2**, publiée le 4 août 2026.

**Le profil MINIMUM n'est pas un profil d'émission de la réforme française.** Il ne porte ni les lignes de facture, ni la ventilation de TVA par taux, ni l'échéance, ni l'adresse et le numéro de TVA de l'acheteur — c'est-à-dire ni les données nécessaires à l'e-reporting, ni plusieurs des mentions obligatoires. Il reste lisible par une plateforme, mais il ne suffit pas à satisfaire l'obligation d'émission. *Ce point mérite d'être reconfirmé sur la version en vigueur des spécifications externes de la DGFiP au moment du chantier technique* — **[EXPERT-COMPTABLE]**.

### 1.5 Sanctions

| Manquement | Fondement | Sanction |
|---|---|---|
| Défaut de recours à une plateforme agréée **en réception** | art. 1737, IV bis CGI | **Mise en demeure, 3 mois pour se conformer**, puis amende |
| Défaut d'émission sous forme électronique | art. 1737, III CGI | **15 € par facture, plafond 15 000 €/an civil** |
| Manquement e-reporting | art. 1788 D CGI | forfait par transmission manquante ou incomplète |
| Omission / inexactitude d'une mention obligatoire | art. 1737, II CGI | **15 € par mention manquante ou inexacte**, plafonné au quart du montant facturé |
| Manquement d'une plateforme | art. 1737, IV CGI | 15 € par facture, plafond 45 000 €/an |

La DGFiP a publié en juillet 2026 un **guide pratique de démarrage** annonçant une tolérance encadrée : les sanctions ne seront pas appliquées « de manière immédiate, automatique et aveugle » à une entreprise qui rencontre « une difficulté réelle, documentée et suivie d'actions de correction », dans une logique de droit à l'erreur. **Mais l'administration précise elle-même que ce n'est « ni un report, ni une suspension »** : la tolérance se mérite en prouvant une trajectoire sérieuse de mise en conformité (choix d'une plateforme, échanges avec l'éditeur ou l'expert-comptable, tests). L'inertie ou l'évitement ne sont pas couverts. Numéro national d'assistance : 0 806 807 807.

### 1.6 Mentions obligatoires — état 2026

Aux mentions classiques (articles **242 nonies A de l'annexe II du CGI**, **289 du CGI**, **L441-9 du code de commerce**) s'ajoutent **quatre nouvelles mentions**, introduites par le décret n° 2022-1299 du 7 octobre 2022, applicables selon le calendrier d'émission — donc **au 1er septembre 2027 pour une TPE/PME** :

1. le **numéro SIREN du client** ;
2. l'**adresse de livraison des biens** lorsqu'elle diffère de l'adresse de facturation ;
3. la **catégorie de l'opération** : livraison de biens, prestation de services, ou les deux ;
4. l'**option pour le paiement de la TVA d'après les débits**, le cas échéant, avec la mention exacte *« Option pour le paiement de la taxe d'après les débits »*.

Source : [economie.gouv.fr](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir).

### 1.7 Conservation

- **10 ans** pour les factures en tant que pièces comptables — article L123-22 du code de commerce ; confirmé par economie.gouv.fr : « Les factures établies ou reçues doivent être conservées pendant **dix ans**, en leur qualité de pièces comptables. »
- **6 ans** au titre du droit de reprise fiscal — article L102 B du LPF.
- L'archivage électronique des pièces établies ou reçues sur support informatique est encadré par l'**arrêté du 22 mars 2017**, codifié à l'article **A102 B-2 du LPF**.
- **Piste d'audit fiable** : article 289, VII du CGI — l'authenticité de l'origine, l'intégrité du contenu et la lisibilité de la facture doivent être assurées à compter de son émission et jusqu'à la fin de sa période de conservation.

### 1.8 Signature électronique — eIDAS

- **Article 3.10 et 25.1 du règlement eIDAS** : une signature électronique ne peut être refusée comme preuve au seul motif qu'elle est électronique. Cela ne lui confère aucune présomption de fiabilité.
- **Article 1367 alinéa 2 du code civil** : la fiabilité du procédé est **présumée** seulement lorsque la signature est créée dans les conditions fixées par décret (décret n° 2017-1416) — c'est-à-dire pour la **signature électronique qualifiée**.
- Conséquence : pour une **signature simple ou avancée non qualifiée**, **la charge de la preuve de la fiabilité pèse sur celui qui s'en prévaut** — ici l'atelier. Voir notamment la synthèse de [Signaturit](https://www.signaturit.com/fr/blog/la-valeur-juridique-de-la-signature-electronique/) et l'[analyse Lexbase](https://www.lexbase.fr/article-juridique/133515189-observationslasignatureelectroniquealepreuvedudroitcommundelapreuve).

### 1.9 Logiciel de caisse — article 286, I, 3° bis du CGI

L'obligation d'utiliser un logiciel satisfaisant à des conditions d'inaltérabilité, sécurisation, conservation et archivage, attestées par un **certificat d'organisme accrédité** (l'auto-certification par l'éditeur a été supprimée par la loi de finances pour 2025), vise les assujettis qui enregistrent les **règlements de leurs clients particuliers** sans facture. Un logiciel de facturation **ayant une fonction de caisse** entre dans le champ ([impots.gouv.fr — champ d'application](https://www.impots.gouv.fr/professionnel/questions/quel-est-le-champ-dapplication-de-lobligation-de-detenir-un-logiciel-de) · [BOI-TVA-DECLA-30-10-30](https://bofip.impots.gouv.fr/bofip/10691-PGP.html/identifiant=BOI-TVA-DECLA-30-10-30-20251001) · [economie.gouv.fr — certification des logiciels de caisse](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/ce-quil-faut)).

**Position à trancher [AVOCAT / EXPERT-COMPTABLE] :** Thermogestion enregistre des règlements (table `paiements`, RPC `marquer_facture_payee`, liens de paiement Stripe Connect). Si un atelier client encaisse un particulier **sans émettre de facture**, la fonction devient une fonction de caisse et l'obligation de certification s'applique. Aujourd'hui le produit ne dispose d'aucun certificat, et il n'aurait aucune chance d'en obtenir un en l'état (voir §3, constat C4).

---

## 2. Ce qui est déjà bien fait

Pour situer le reste, il faut le dire : le socle technique est meilleur que la moyenne des outils métier de cette taille.

- **PDF/A-3 réellement conforme**, validé veraPDF 1.30.2 en profil 3b sur un PDF de production : 146 règles, 4 607 contrôles, **0 échec**. Polices Liberation Sans incorporées (`src/lib/pdf/polices.ts`), OutputIntent sRGB avec profil ICC embarqué, XMP avec `pdfaid:part=3`, `pdfaid:conformance=B` et schéma d'extension `pdfaExtension` complet, `/AFRelationship /Alternative`. C'est du travail sérieux, rarement bien fait.
- **XML CII valide** contre le XSD `Factur-X_MINIMUM.xsd` et le schematron `Factur-X_1.09_MINIMUM.xsl` — 0 règle en échec. Codes UNTDID corrects (380 / 386 acompte / 381 avoir), arrondis à 2 décimales conformes aux règles BR-DEC.
- **Garde-fous d'émission** : le Factur-X refuse de se générer si le numéro, le nom, le SIREN ou la TVA intracommunautaire de l'atelier manquent, avec des messages explicites (`manquesFacturX`, `src/lib/facturx/xml.ts`).
- **Cloisonnement multi-tenant** propre : RLS activée sur les 42 tables, `current_atelier_id()` et `is_owner()` en `SECURITY DEFINER STABLE`, test automatisé vérifiant qu'`anon` ne lit rien (`tests/pages-publiques.test.ts`).
- **Tokens publics à 128 bits** issus de `gen_random_bytes(16)` (pgcrypto) : non devinables, non énumérables.
- **Horodatage serveur** des signatures : `signed_at = now()` en base, indépendant de l'horloge du navigateur. Verrou anti-double-signature (`for update` + contrôle de statut).
- **Buckets privés** avec URL signées 1 h pour les photos et documents.
- **En-têtes de sécurité** posés après l'audit du 13/08 : `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Export total et export FEC** existants (`/api/export/donnees`, `/api/export/comptable`), avec pagination et RLS respectées.
- **Trigger `figer_document`** qui verrouille 14 colonnes structurantes d'un devis signé ou d'une facture émise.
- **Aucun traceur tiers** : pas de Google Analytics, pas de Sentry, analytics first-party. L'absence de bandeau cookies est cohérente avec l'architecture.

---

## 3. Constats critiques

> Un constat est classé **critique** lorsqu'il expose à une sanction fiscale ou administrative, à un rejet de comptabilité, ou qu'il rend le produit inutilisable à une échéance certaine.

---

### C1 — Royal Motorbike n'est vraisemblablement pas en capacité de recevoir des factures électroniques au 1er septembre 2026 (dans 13 jours)

**Écart.** Rien dans le périmètre audité n'atteste d'un contrat avec une plateforme agréée, ni d'une adresse de facturation déclarée à l'annuaire central pour le SIREN 884 381 047. Si c'est déjà fait, ce constat tombe — mais il doit être vérifié explicitement.

**Fondement.** Article 289 bis du CGI ; décret n° 2026-677 et arrêté du 27 juillet 2026 ; [guide pratique DGFiP](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf). L'obligation de réception vise **toutes** les entreprises assujetties, sans condition de taille.

**Conséquence.** Mise en demeure au titre de l'article 1737, IV bis du CGI, puis amende après un délai de trois mois. Surtout, effet pratique immédiat : les fournisseurs grandes entreprises et ETI de Royal Motorbike **émettront** en électronique dès le 1er septembre 2026 et adresseront leurs factures via l'annuaire. Sans plateforme déclarée, ces factures n'arriveront nulle part — retards de paiement, litiges fournisseurs, perte de droit à déduction si les factures ne sont pas récupérées.

**Action.** Contractualiser avec une plateforme agréée sous 10 jours, vérifier l'inscription du SIREN à l'annuaire, tester une réception. Le CNOEC a publié en mars 2026 un guide comparatif de 45 plateformes agréées à destination des TPE-PME. Assistance DGFiP : 0 806 807 807.
**Porteur : [ALEXIS] en urgence, avec [EXPERT-COMPTABLE].**

---

### C2 — Le produit ne permet à aucun atelier de respecter la réforme, ni en réception ni en émission

**Écart.** Thermogestion génère un fichier Factur-X **téléchargeable à la main** (`GET /api/pdf/facture/{id}?facturx=1`). Il n'existe :
- aucun raccordement à une plateforme agréée ;
- aucune consultation de l'annuaire pour résoudre l'adresse de facturation d'un client ;
- aucune gestion des **statuts du cycle de vie** (déposée, reçue, rejetée, refusée, encaissée) pourtant au cœur de la réforme et normalisés par XP Z12-014 ;
- aucune fonction de **réception** de factures fournisseurs ;
- aucun **e-reporting** (B2C, B2B international, données d'encaissement).

**Fondement.** Article 289 bis du CGI ; [fiche DGFiP « opérateurs de dématérialisation »](https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/fiches_reforme/fiche-od.pdf) : l'OD « devra obligatoirement être raccordé à une plateforme agréée ».

**Conséquence.** Au **1er septembre 2027**, un atelier qui facture depuis Thermogestion sera en infraction (amende de 15 € par facture, plafond 15 000 €/an) **sauf** à ressaisir ses factures dans un autre outil — ce qui vide le produit de son intérêt. Le risque n'est pas seulement commercial : un client qui subit une amende après avoir payé un abonnement à un « logiciel de facturation » vendu en 2026 pourra invoquer un manquement à l'obligation de conseil et de délivrance conforme (articles 1194 et 1604 et suivants du code civil).

De plus, l'atelier lui-même doit **recevoir** dès le **1er septembre 2026** : Thermogestion ne l'aide en rien sur ce volet, ce qui doit être dit clairement aux clients plutôt que laissé implicite.

**Action.**
1. **[ALEXIS]** — décision structurante : se raccorder à une plateforme agréée (voie réaliste, délai 6 à 12 mois) ou renoncer au volet facturation. Budget, contrat, API, tarification à la facture à répercuter.
2. **[TECH]** — développer le connecteur : dépôt de facture au format du socle, résolution d'adresse via l'annuaire, réception des statuts de cycle de vie, e-reporting.
3. **[ALEXIS]** — d'ici là, informer explicitement les clients : *« Thermogestion produit aujourd'hui un fichier Factur-X que vous transmettez vous-même. À compter du 1er septembre 2027, la transmission devra passer par une plateforme agréée ; le raccordement de Thermogestion est prévu pour [date]. »*

---

### C3 — Le profil Factur-X MINIMUM ne suffira pas, et ce que le produit affiche à l'utilisateur est trompeur

**Écart technique.** `src/lib/facturx/xml.ts` émet `urn:factur-x.eu:1p0:minimum`. Le XML produit ne contient **ni lignes de facture, ni ventilation de TVA (`ApplicableTradeTax`), ni date d'échéance (`DueDateDateTime`), ni conditions ou moyens de paiement, ni acomptes déduits (`TotalPrepaidAmount`), ni adresse de l'acheteur, ni numéro de TVA de l'acheteur** (`options { adresse: false, tva: false }`). `InvoiceCurrencyCode` est codé en dur à `EUR` et le pays de l'acheteur est toujours résolu en `"FR"` par `codePays()`.

**Fondement.** Norme AFNOR **XP Z12-012** ; EN 16931 ; profil de référence français **EXTENDED-CTC-FR** ([FNFE-MPE](https://fnfe-mpe.org/factur-x/)). Le profil MINIMUM est décrit par le FNFE-MPE comme « équivalent à une extraction de données d'entête et pied par OCR » — il ne porte pas les données que la réforme exige de transmettre.

**Écart d'affichage.** `src/app/(app)/factures/[id]/page.tsx:128-132` affiche à l'utilisateur :

> « Le fichier Factur-X est le même PDF, augmenté de la facture au format XML : le logiciel comptable de votre client la lit sans ressaisie. **Sa réception devient obligatoire pour toutes les entreprises au 1er septembre 2026.** »

La phrase est exacte mais incomplète, et dans son contexte — juste sous un bouton de téléchargement — elle laisse croire qu'envoyer ce fichier par e-mail satisfait l'obligation. C'est faux : une facture transmise hors plateforme agréée n'est pas une facture électronique au sens de la réforme. Le risque de qualification en **pratique commerciale trompeuse** (articles L121-2 à L121-4 du code de la consommation, applicables aux pratiques visant les professionnels par l'effet de l'article L121-5) n'est pas nul. **[AVOCAT]**

**Conséquence.** Fichier non conforme au socle d'émission ; e-reporting impossible ; message commercial exposé.

**Action.**
- **[TECH]** — passer le générateur au profil **EN 16931** (a minima BASIC WL en transition), en ajoutant : lignes de facture, `ApplicableTradeTax` par taux, `DueDateDateTime`, `SpecifiedTradePaymentTerms`, adresse et numéro de TVA de l'acheteur, `TotalPrepaidAmount` pour les factures de solde, pays réel de l'acheteur, devise paramétrable. Corriger aussi le titre XMP figé à `Facture {numero}` y compris pour un avoir (`src/lib/facturx/facture.ts:57`).
- **[TECH]** — remplacer le texte d'interface. Proposition exacte :
  > « Ce fichier Factur-X contient votre facture au format PDF **et** au format XML : le logiciel comptable de votre client peut l'intégrer sans ressaisie. Attention : à compter du 1er septembre 2027, une facture entre professionnels devra être **transmise par une plateforme agréée** pour être valable. Le téléchargement et l'envoi par e-mail ne suffiront plus. »

---

### C4 — Une facture émise peut être supprimée, et une facture figée peut être déverrouillée en une requête

**Écart.** Trois défauts cumulés, tous vérifiés en base :

1. **Le trigger `figer_document` est déclaré `BEFORE UPDATE` uniquement.** Aucun `BEFORE DELETE`. La policy RLS `tenant_all` est en `ALL` : un `DELETE /rest/v1/factures?id=eq.<uuid>` depuis le navigateur, avec la session de n'importe quel membre de l'atelier, supprime une facture émise. La contrainte `paiements_facture_id_fkey ... ON DELETE CASCADE` **supprime aussi les règlements** associés.
2. **La colonne `status` ne figure pas dans la liste `v_verrouilles`.** Contournement en deux requêtes triviales : `UPDATE factures SET status='brouillon'` (autorisé, `status` n'est pas verrouillé), puis tout redevient modifiable puisque `v_fige` est alors faux. Le même trou existe pour un devis signé.
3. Ne sont verrouillés ni `emise_at`, ni `signed_at`, ni `signed_by`, ni `signature_data`, ni `signature_ip`, ni `numero` après retour en brouillon.

Aucun **soft-delete** : pas une seule colonne `deleted_at` dans le schéma. Toute suppression est physique et irréversible.

**Fondement.** Article **289, VII du CGI** (piste d'audit fiable : intégrité du contenu depuis l'émission jusqu'à la fin de la conservation) ; article **L102 B du LPF** ; article **L123-22 du code de commerce** ; article **286, I, 3° bis du CGI** si la fonction de caisse est retenue (§1.9). L'article **1737 du CGI** sanctionne par ailleurs les infractions aux règles de facturation.

**Conséquence.** En contrôle fiscal, l'administration peut écarter la comptabilité comme non probante — c'est le scénario le plus lourd : reconstitution du chiffre d'affaires, majorations. Pour l'éditeur, c'est aussi l'impossibilité absolue d'obtenir un jour un certificat NF 203 ou équivalent, et un argument de défense difficile à tenir si un client est redressé.

**Action [TECH], prioritaire et sans arbitrage :**
- ajouter `figer_document` en `BEFORE DELETE` sur `devis`, `factures`, `paiements`, `bons_livraison`, `receptions` ;
- ajouter `status` à `v_verrouilles`, et n'autoriser que les transitions légitimes (`emise → payee`, `emise → annulee`) par une RPC dédiée ;
- interdire le `DELETE` par RLS sur les tables de documents (policy séparée `SELECT/INSERT/UPDATE` au lieu de `ALL`) ;
- verrouiller `emise_at`, `numero`, `signed_at`, `signed_by`, `signature_data`, `signature_ip` ;
- annuler exclusivement par avoir, jamais par suppression ;
- passer les tables du registre des déchets (`dechets`, conservation 5 ans, article R541-43 du code de l'environnement) au même régime — un bouton « Supprimer » existe aujourd'hui sur un registre à conservation réglementaire.

---

### C5 — La numérotation des factures n'est pas garantie continue

**Écart.** Le numéro est attribué **côté navigateur**, en deux appels HTTP non transactionnels (`src/app/(app)/factures/[id]/page.tsx:41-47`) : `supabase.rpc("next_numero")` puis `supabase.from("factures").update(...)`. Si le second échoue — RLS, trigger `ABONNEMENT_REQUIS`, coupure réseau, onglet fermé — **le compteur est incrémenté et le numéro perdu**. Aucun contrôle de continuité, aucun journal des numéros attribués. À quoi s'ajoutent les trous créés par la suppression d'une facture émise (C4), et la possibilité d'écrire un numéro arbitraire sur un brouillon.

**Fondement.** Article **242 nonies A, 2° de l'annexe II du CGI** : numéro unique fondé sur une **séquence chronologique continue**. Confirmé par [economie.gouv.fr](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir) : « un numéro unique pour chaque facture, qui est basé sur une séquence chronologique et continue ».

**Conséquence.** Amende de l'article 1737, II du CGI (15 € par mention manquante ou inexacte) et, plus sérieusement, présomption de dissimulation en contrôle : un trou de numérotation est le premier signal que cherche un vérificateur.

**Action [TECH].** Attribuer le numéro **côté serveur, dans la même transaction que le passage en `emise`** : une RPC unique `emettre_facture(p_id)` qui incrémente le compteur et met à jour la ligne, avec rollback complet en cas d'échec. Ajouter un contrôle de continuité affichable dans les réglages.

---

## 4. Constats majeurs

---

### M1 — Mentions obligatoires manquantes sur les documents générés

Analyse ligne à ligne du gabarit `src/lib/pdf/document.tsx` (et de son miroir HTML `src/components/FacturePublicClient.tsx`, qui réplique les mêmes conditions et doit être corrigé en même temps).

#### Facture — ce qui manque

| Mention manquante | Fondement | Gravité |
|---|---|---|
| **Date de la vente ou de la prestation** (date de livraison ou d'achèvement, ou date de versement de l'acompte) | art. 242 nonies A, 3° ann. II CGI | **Élevée** — c'est une mention centrale, systématiquement absente aujourd'hui : le PDF n'affiche que la date d'émission et l'échéance |
| **Numéro de TVA intracommunautaire du client assujetti** (factures > 150 € HT) | art. 242 nonies A, 6° ann. II CGI ; art. 289, II CGI | **Élevée** — le type `Client` (`src/lib/types.ts`) ne comporte **aucun champ TVA** : la mention est structurellement impossible |
| **Taux de TVA par ligne** et **ventilation des totaux par taux** | art. 242 nonies A, 8° et 11° ann. II CGI | **Élevée en cas de taux multiples** — la donnée existe (`tva: number` par ligne) mais le tableau PDF n'a pas de colonne taux et les totaux n'affichent qu'une ligne « TVA » agrégée |
| **Mention « Autoliquidation »** | art. 242 nonies A, 13° ann. II CGI ; art. 283 CGI | **Élevée** — absente et impossible : aucun mécanisme, aucun champ |
| **Mentions d'exonération** : livraison intracommunautaire (art. 262 ter, I CGI), prestation B2B UE (art. 259-1 CGI), exportation (art. 262, I CGI) | art. 242 nonies A, 12° ann. II CGI | **Élevée pour un client hors de France** — le type `Client` n'a **ni pays ni numéro de TVA** : un atelier facturant en Italie (extension annoncée) ne peut pas être conforme |
| **Référence au bon de commande** établi par l'acheteur | art. L441-9 C. com. ; economie.gouv.fr | Moyenne — le devis interne est repris en BT-13 dans le XML mais n'est pas imprimé |
| **Avoir : référence à la facture d'origine** | doctrine constante ; art. 289, I-5 CGI | Moyenne — le champ `facture_liee_id` existe mais n'est jamais imprimé |
| **Facture de solde : rappel des acomptes déjà facturés et net à payer** | art. 242 nonies A ann. II CGI | Moyenne — ni dans le PDF, ni dans le XML (`DuePayableAmount` = TTC total) |
| **Client particulier : garantie légale de conformité de 2 ans** | décret n° 2021-609 du 18 mai 2021 | Moyenne — le type `Client` distingue pourtant `particulier` |
| **Client particulier : coordonnées du médiateur de la consommation** de l'atelier | art. L616-1 et R616-1 C. conso. | Moyenne — absente ; l'atelier est en infraction sans le savoir |

#### Facture — ce qui est bien présent

Numéro, date d'émission, identité et adresse de l'émetteur, forme juridique, capital, SIREN, RCS, RM, TVA intracommunautaire de l'émetteur, identité et adresse du client, SIREN du client (si renseigné), adresse de livraison distincte, désignation / quantité / PU HT / total HT par ligne, remise, totaux HT / TVA / TTC, **nature de l'opération** (biens / services / mixte), échéance, escompte, pénalités de retard avec citation des articles L441-10 et D441-5, indemnité forfaitaire de 40 €, franchise en base (« TVA non applicable, article 293 B du CGI »), TVA sur les débits, coordonnées bancaires, assurance professionnelle paramétrable, mentions spécifiques avoir et facture annulée.

**Trois des quatre nouvelles mentions 2026 sont déjà là** (SIREN client, adresse de livraison, nature de l'opération) et la quatrième aussi (TVA sur les débits) — c'est un vrai point fort. Mais la mention TVA sur les débits est rendue en `Option pour le paiement de la TVA d'après les débits.` alors que le texte officiel est **« Option pour le paiement de la taxe d'après les débits »**. Différence mineure mais gratuite à corriger.

#### Devis

Le devis reprend une version **appauvrie** des mentions de la facture : le texte pénalités omet « à compter de la date d'émission », omet la citation « (art. L441-10 et D441-5 du code de commerce) », omet l'escompte, et ignore le délai de paiement négocié du client (`client.delai_paiement_jours`) alors que la facture le prend en compte. Ce n'est pas illégal — un devis n'est pas une facture — mais c'est une incohérence qui affaiblit l'opposabilité des conditions de paiement acceptées avec le devis.

#### Bon de livraison

Peu d'exigences légales. La formule *« Les réserves éventuelles doivent être portées sur ce bon au moment de la remise des pièces »* est appropriée. Rien à redire.

**Action [TECH] + [ALEXIS] :** ajouter au modèle de données `Client` les champs `pays` et `tva_intra` ; ajouter à `Facture` un champ `date_operation` ; ajouter un régime de TVA par facture (normal / autoliquidation / exonéré intracom / exonéré export / franchise) pilotant automatiquement la mention correspondante ; ajouter la colonne taux et la ventilation par taux dans le tableau ; imprimer la référence de la facture d'origine sur l'avoir et les acomptes déduits sur la facture de solde ; ajouter les mentions consommateur (garantie légale, médiateur) conditionnées à `client.type === "particulier"`.

---

### M2 — Le logiciel laisse saisir un délai de paiement illégal et un taux de pénalités inférieur au minimum

**Écart.** `atelier.delai_paiement_jours` et `client.delai_paiement_jours` sont des entiers libres, sans plafond. `atelier.penalites_taux` est un nombre libre, sans plancher. Un atelier peut donc éditer, en toute bonne foi, une facture portant « Paiement à 90 jours » et un taux de pénalités de 1 %.

**Fondement.** Article **L441-10 du code de commerce** : le délai convenu ne peut dépasser **60 jours à compter de la date d'émission** de la facture, ou **45 jours fin de mois** si les parties en conviennent expressément et que la clause ne constitue pas un abus manifeste. Le taux des pénalités ne peut être **inférieur à trois fois le taux d'intérêt légal** ; à défaut de stipulation, il est égal au taux de refinancement de la BCE majoré de 10 points.

**Conséquence.** Article **L441-16 du code de commerce** : amende administrative jusqu'à **75 000 € pour une personne physique et 2 000 000 € pour une personne morale** (doublée en cas de réitération), prononcée par la DGCCRF, avec publication de la décision. C'est la sanction la plus lourde du présent audit, et elle frappe l'atelier client.

**Action [TECH].** Borner la saisie (60 jours maximum, ou option « 45 jours fin de mois ») avec message explicatif, et plancher le taux de pénalités au triple du taux légal (valeur par défaut = BCE + 10 points, mise à jour semestrielle). Bloquer, ne pas seulement avertir.

---

### M3 — La politique de confidentialité contredit les mentions légales et omet la moitié des sous-traitants

**Écart.** Constaté ligne à ligne :

| Ce que dit `/legal/confidentialite` | Ce que fait le produit |
|---|---|
| Art. 5 : « **Hostinger** (hébergement applicatif) — UE » | L'application tourne sur **Vercel Inc.**, Californie (`src/lib/env.ts:8`, `thermogestion-v2.vercel.app`) — ce que reconnaissent d'ailleurs les **mentions légales**, qui citent Vercel Inc., Covina, CA. **Les deux pages se contredisent frontalement.** |
| Art. 5 : liste de 3 sous-traitants | Il en manque au moins 5 : **Stripe** (abonnement + Connect), **Vercel**, **api-adresse.data.gouv.fr**, **recherche-entreprises.api.gouv.fr**, le **serveur mailer `thermopoudre.fr/tg-mailer.php`** (appelé depuis `process_notifications()` via `pg_net`), et le **webservice PrestaShop thermopoudre.fr** (`envoyer_commande_poudre()` transmet nom, adresse, téléphone, e-mail et SIREN de l'atelier) |
| Art. 5 : « Envoi d'emails transactionnels — serveur UE (thermopoudre.fr) » | Exact, mais Brevo n'est pas utilisé ici contrairement à ce que suppose la description générique |
| Art. 2 : liste des données collectées | Ne mentionne **ni l'adresse IP du signataire, ni son user-agent, ni l'image de sa signature manuscrite** — pourtant stockés (voir M6) |
| Art. 2 : « événements de navigation internes » | La table `analytics_events` stocke `user_id` : le traitement est **nominatif**, ce que le texte ne dit pas |
| Art. 4 : « journalisation » | La table `audit_logs` contient **0 ligne** et **aucun trigger ni code applicatif ne l'alimente** (`grep -rn "audit_log" src/` → 0 résultat). Engagement non tenu. |
| Art. 6 : « journaux techniques : 12 mois », « contrat + 60 jours » | **Aucune purge n'est implémentée nulle part.** Les 3 tâches `pg_cron` actives sont `process_notifications`, `verifier_notifications` et `relancer_devis_et_factures` — aucune n'est une purge. `notifications` accumule indéfiniment les adresses e-mail des clients finaux. |
| Absence de mention des données salariés | La table `temps_etapes` (`user_id`, `debut`, `fin`, `minutes`, par étape et par projet) est un **relevé nominatif de temps de travail**, exploité dans les vues `projet_temps_cout`, `projet_revient`, `client_rentabilite` |

**Fondement.** Articles **13 et 14** du RGPD (information loyale et complète) ; article **28.2** (autorisation des sous-traitants ultérieurs, information préalable des changements) ; article **5.1.a et 5.1.e** (loyauté, limitation de conservation) ; article **30** (registre) ; article **32** (sécurité, dont journalisation).

**Conséquence.** Le manquement à une obligation d'information est un manquement autonome, sanctionnable indépendamment de tout préjudice. Il est aussi le plus facile à constater pour la CNIL : il suffit de lire la page. Une politique qui **promet une mesure qui n'existe pas** (journalisation, purge à 12 mois) est plus lourdement appréciée qu'une politique silencieuse. Enfin, l'atelier client, responsable de traitement, ne peut pas tenir son propre registre de traitements avec une liste de sous-traitants fausse.

**Action.**
- **[TECH]** — corriger la page (texte proposé au §7.1), fixer la région d'exécution Vercel (voir M4), implémenter les purges annoncées ou retirer les durées annoncées, alimenter réellement `audit_logs`.
- **[ALEXIS]** — décider si `audit_logs` doit être alimentée (recommandé : oui, c'est aussi la brique de la piste d'audit fiable) ou si la promesse de journalisation doit être retirée.

---

### M4 — Traitement de données hors Union européenne, non déclaré et non nécessaire

**Écart.** `next.config.ts` ne fixe **aucune région d'exécution** et il n'existe pas de `vercel.json`. Par défaut, [les fonctions Vercel s'exécutent à Washington D.C. (`iad1`), États-Unis](https://vercel.com/docs/security/compliance). Passent donc par les États-Unis : la génération de **tous les PDF** (identité et adresses des clients finaux, montants), l'**export ZIP complet** de l'atelier (`/api/export/donnees`, 36 tables), l'export **FEC**, la **capture de l'adresse IP** du signataire (`/api/ip`), les appels aux API `entreprise` et `adresse`.

**Fondement.** Chapitre V du RGPD (articles 44 et suivants) ; article 13.1.f (information sur les transferts). Le transfert est **licite** — [Vercel est certifiée EU-U.S. Data Privacy Framework](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf) — mais il n'est **ni déclaré, ni encadré dans la documentation**, et la politique affirme même l'inverse (« Hostinger — UE »).

**Conséquence.** Manquement à l'information (articles 13 et 14), et engagement de sous-traitance faux vis-à-vis des ateliers. Surtout : c'est un point qui bloquera commercialement dès qu'un client un peu structuré fera relire le contrat. Argument de vente inversé.

**Action [TECH], simple et à faible risque :** ajouter `export const preferredRegion = "cdg1";` (Paris) ou `"fra1"` (Francfort) sur toutes les routes `/api/**`, ou fixer `regions` globalement. Puis déclarer honnêtement dans la politique : hébergement applicatif Vercel Inc. (États-Unis), calcul exécuté dans la région Paris/Francfort, transfert encadré par le DPF et les clauses contractuelles types.

---

### M5 — Signature électronique : le niveau de preuve est faible, et le produit le survend

**Ce que fait le produit.** Pages publiques `/d/[token]`, `/bl/[token]`, `/rc/[token]`. Le signataire saisit un nom libre et trace une signature sur un canvas. Sont enregistrés en base : `signed_at` (horloge serveur), `signed_by` (texte libre), `signature_data` en JSONB (`{ image: dataURL PNG, at: horodatage navigateur, ua: user-agent, ip }`) et `signature_ip`.

**Ce que ça vaut réellement, sans complaisance.**

1. **C'est une signature électronique simple** au sens du règlement eIDAS (article 3.10). Ce n'est ni une signature avancée (article 26 : lien univoque au signataire, identification du signataire, moyen sous son contrôle exclusif, détection de toute modification ultérieure), ni *a fortiori* une signature qualifiée.
2. **Il n'y a donc aucune présomption de fiabilité.** L'article 1367 alinéa 2 du code civil ne fait jouer la présomption que dans les conditions du décret n° 2017-1416, réservées à la signature qualifiée. **La charge de la preuve pèse sur l'atelier** qui se prévaut de la signature.
3. **L'IP, le user-agent et l'horodatage `at` sont fournis par le client, pas constatés par le serveur.** Le flux est : le navigateur appelle `/api/ip`, récupère l'IP, puis la renvoie **lui-même** en paramètre `p_ip` de la RPC. La fonction `signer_devis` est `EXECUTE` pour `anon`. **N'importe qui détenant le lien peut appeler la RPC directement avec l'IP, le user-agent, le nom et l'horodatage de son choix.** La seule donnée non falsifiable est `signed_at = now()`, l'horloge Postgres.
4. **Aucun scellement.** Recherche exhaustive : pas de `sha256`, pas de `digest()`, pas de `hmac`, aucune empreinte du document signé nulle part. **Rien ne prouve que le devis affiché au signataire est celui conservé en base.** Le trigger `figer_document` compense partiellement — mais uniquement sur `devis` et `factures`, uniquement sur 14 colonnes, et il est contournable (voir C4).
5. **Les bons de livraison et les réceptions ne sont pas figés du tout** (`figer_document` renvoie `false` pour ces tables). Lignes, quantités, réserves **et image de la signature** restent modifiables après signature, sans trace. `ReceptionForm` propose même explicitement un bouton « Refaire la signature ».
6. **Aucun horodatage qualifié** (pas de jeton RFC 3161, pas d'autorité d'horodatage, pas d'ancrage externe).
7. **Aucun dossier de preuve.** `audit_logs` existe mais aucun chemin de signature ne l'alimente. Aucune conservation du document tel qu'il a été affiché au signataire. Le PDF n'incorpore même pas l'image de la signature — il affiche seulement « Signature électronique horodatée, conservée par l'atelier ».
8. **Aucune vérification d'identité, à aucun niveau.** Pas de compte, pas d'OTP, pas de lien magique, pas de re-saisie d'un élément connu. Le nom est un champ libre que rien ne compare à `clients.nom`. La seule chose prouvée est **la détention du lien** — lien transférable, retrouvable dans un historique, lisible dans un e-mail transféré.
9. **Aucune case de consentement explicite.** Le bouton se débloque dès qu'un nom est saisi et qu'un point est tracé.
10. **Tokens permanents et irrévocables.** Aucune expiration, aucune révocation : les 14 occurrences de `public_token` dans `src/` sont toutes des lectures, aucun code ne régénère un token. Et rien ne périme un devis : **un devis affiché « valable 30 jours » peut être signé trois ans plus tard**, aucun job ne bascule les devis en `expire`.
11. **Conservation des preuves à « contrat + 60 jours »** selon la politique de confidentialité — soit bien moins que la prescription commerciale de **5 ans** (article L110-4 du code de commerce) du litige que la preuve est censée trancher.
12. Détail de sécurité : `signer_bl` conserve un droit d'exécution pour le pseudo-rôle `PUBLIC` (`=X/postgres` dans `pg_proc.proacl`) — même schéma que la faille corrigée en août sur `marquer_facture_payee`.

**Verdict honnête.** En pratique, le dispositif fonctionne très bien tant que personne ne conteste, et il vaut probablement **commencement de preuve par écrit** (article 1362 du code civil) à corroborer par le reste du dossier : e-mail d'envoi, exécution du chantier, paiement d'un acompte. Devant un tribunal de commerce, face à un client qui conteste sérieusement avoir signé, **je ne parierais pas dessus** : l'atelier devrait prouver la fiabilité du procédé, et les éléments techniques qu'il produirait sont, tels quels, falsifiables par le signataire lui-même. Le mot « horodatée » employé dans l'interface et dans les PDF est exact mais laisse entendre plus qu'il n'y a.

**Action.**
- **[TECH] — indispensable et peu coûteux :**
  1. **Constater l'IP et le user-agent côté serveur.** Faire passer la signature par une route API Next.js qui lit les en-têtes et appelle la RPC en `service_role`, au lieu de laisser le navigateur les déclarer. Retirer le droit `EXECUTE` d'`anon` sur `signer_*`, et retirer le grant `PUBLIC` sur `signer_bl`.
  2. **Sceller le document.** Calculer et stocker un `SHA-256` du PDF exact affiché au signataire, avec le PDF lui-même en Storage. Un hash sans le document ne prouve rien ; le couple prouve tout.
  3. **Étendre `figer_document` aux bons de livraison et aux réceptions**, et verrouiller `signature_data`, `signed_by`, `signature_ip`.
  4. **Alimenter `audit_logs`** à chaque signature, avec un enregistrement inaltérable, et produire un **dossier de preuve exportable** (PDF scellé + hash + horodatage serveur + IP constatée + user-agent + journal).
  5. **Expirer les tokens** (durée = `validite_jours` pour un devis, plus une marge) et permettre leur **révocation** depuis la fiche.
  6. **Case à cocher explicite** : « Je reconnais avoir pris connaissance de ce devis et l'accepter » + reproduction de la mention « Bon pour accord ».
  7. **Afficher l'image de la signature** sur le PDF signé et sur les pages `/d/` et `/bl/`.
  8. **Aligner la conservation des preuves sur 5 ans**, pas 60 jours.
- **[ALEXIS]** — décider si un **horodatage qualifié** (jeton RFC 3161 auprès d'une autorité, quelques centimes par signature) est financé. Cela ferait passer le dispositif d'une signature simple mal documentée à une signature simple **bien documentée**, ce qui change la donne en pratique. Passer en signature **avancée** supposerait un prestataire tiers (Yousign, Docusign, Universign) et un coût par signature — arbitrage commercial.
- **[TECH]** — corriger le vocabulaire dans l'interface et les PDF : remplacer « Signature électronique horodatée, conservée par l'atelier » par une formule exacte, par exemple : *« Accord recueilli par voie électronique le [date] à [heure] (horloge du serveur), depuis l'adresse IP [x]. Signature électronique simple au sens du règlement eIDAS. »*

---

### M6 — Les personnes qui signent ne sont informées de rien

**Écart.** Les pages publiques `/d/`, `/bl/` et `/rc/` collectent l'adresse IP, le user-agent et l'**image d'une signature manuscrite** — trois données personnelles, dont une donnée d'identification forte, et souvent celles d'un **particulier**. Ces pages ne comportent **aucune mention d'information RGPD**, aucun lien vers une politique de confidentialité, aucune indication du responsable de traitement (l'atelier) ni de la durée de conservation.

**Fondement.** Articles **13 et 14** du RGPD. La collecte est fondée sur l'intérêt légitime (preuve de l'accord contractuel), ce qui est défendable, mais l'information reste due dans tous les cas.

**Conséquence.** Manquement caractérisé et trivial à constater. Le responsable de traitement est l'**atelier**, mais c'est Thermogestion, sous-traitant, qui conçoit la page et prive l'atelier de la possibilité de se conformer — ce qui engage sa responsabilité contractuelle envers lui.

**Action [TECH].** Ajouter sous le bouton de signature un bloc court et paramétrable. Texte proposé :

> *Vos données. En signant, [nom de l'atelier], responsable de ce traitement, enregistre votre nom, l'image de votre signature, la date et l'heure, votre adresse IP et votre navigateur, afin de conserver la preuve de votre accord (intérêt légitime, article 6.1.f du RGPD). Ces informations sont conservées 5 ans et ne sont transmises à personne d'autre. Pour y accéder, les corriger ou les faire effacer : [e-mail de l'atelier]. Réclamation possible auprès de la CNIL (cnil.fr).*

---

### M7 — La clause de sous-traitance ne remplit pas l'article 28.3 du RGPD

**Écart.** L'article 4 de la politique de confidentialité tient lieu de contrat de sous-traitance. Il couvre : instructions documentées, confidentialité et sécurité, sous-traitants ultérieurs listés, assistance aux demandes d'exercice de droits, notification de violation sous 48 h, suppression ou restitution en fin de contrat. C'est un bon début, mais il **manque** :

- l'**objet, la durée, la nature et la finalité** du traitement, les **catégories de données** et les **catégories de personnes concernées** (chapeau de l'article 28.3) ;
- le **droit d'audit** du responsable de traitement et l'obligation de mettre à disposition les informations nécessaires (article 28.3.h) ;
- l'obligation d'**informer immédiatement** le responsable si une instruction constitue une violation du RGPD (article 28.3.h, second alinéa) ;
- la **procédure d'autorisation** des sous-traitants ultérieurs : information préalable des ajouts ou remplacements et **droit d'objection** du responsable (article 28.2) ;
- l'engagement de **confidentialité formalisé** des personnes autorisées (article 28.3.b) ;
- l'assistance aux **analyses d'impact** et à la consultation préalable (article 28.3.f, articles 35 et 36) ;
- l'encadrement des **transferts hors UE** (voir M4) ;
- le **choix** entre suppression et restitution laissé au responsable, et non imposé (article 28.3.g) ;
- la mention du **registre du sous-traitant** (article 30.2).

**Fondement.** Article 28 du RGPD, dont le §3 est d'ordre public et impose un « contrat ou autre acte juridique » comportant limitativement ces clauses.

**Conséquence.** Le contrat de sous-traitance est incomplet, ce qui expose **les deux parties** : la CNIL sanctionne aussi bien le responsable qui n'a pas encadré son sous-traitant que le sous-traitant qui n'a pas fourni le cadre. Commercialement, tout client accompagné d'un DPO exigera un DPA en bonne et due forme.

**Action.** **[AVOCAT]** — faire rédiger un **DPA autonome et signable**, annexé aux CGU, avec l'annexe descriptive du traitement et la liste des sous-traitants ultérieurs tenue à jour et datée. **[TECH]** — le publier sous `/legal/sous-traitance` et le lier depuis les CGU et l'onboarding.

---

### M8 — Aucun moyen d'exercer les droits des personnes

**Écart.** Aucune RPC, aucune route API, aucun bouton, aucune colonne `anonymise_at`. `grep -rni "anonymis|effacement|purge|retention"` sur `src/` ne remonte que les pages légales et une constante liée au registre des déchets. Pire : les clés étrangères (`ON DELETE RESTRICT` sur `receptions` et `bons_livraison`, `NO ACTION` par défaut sur `devis`, `factures`, `projets`) rendent la suppression d'un client **techniquement impossible** dès qu'il a un historique. La politique promet pourtant l'effacement à `contact@thermopoudre.fr`.

**Fondement.** Articles **12, 15 à 22** du RGPD ; article **28.3.e** (le sous-traitant doit aider le responsable à répondre aux demandes). Délai de réponse : **un mois**.

**Conséquence.** Impossibilité pratique de tenir la promesse. Le point positif est que l'effacement d'un client dont les factures relèvent de la conservation de 10 ans **n'est pas dû** pour ces données (article 17.3.b : obligation légale) — mais il l'est pour tout le reste (coordonnées de contact, photos, historique de projets sans valeur comptable).

**Action [TECH].** Implémenter une **anonymisation** plutôt qu'une suppression : remplacer nom, contact, e-mail, téléphone et adresse par des valeurs neutres, conserver les documents comptables et leur numérotation, marquer `anonymise_at`. Ajouter un bouton dans la fiche client et documenter la procédure. Prévoir la même chose pour un atelier entier en fin de contrat — il n'existe aujourd'hui **aucune fonction de suppression d'un atelier réel**, seulement `supprimer_atelier_test()` limitée aux ateliers `TEST-AUTO-*`.

---

### M9 — Données de salariés traitées sans base documentée ni information

**Écart.** `temps_etapes` (`atelier_id`, `projet_id`, `etape_code`, `debut`, `fin`, `minutes`, `user_id`) constitue un **relevé nominatif du temps de travail par étape**, alimenté par `pointer_etape()`. `controles.operateur_id`, `controles_bains.operateur_id` et `fournees.operateur_id` tracent nominativement qui a fait quoi. Les vues `projet_temps_cout`, `projet_revient` et `client_rentabilite` exploitent ces données. `analytics_events.user_id` trace la navigation individuelle d'un salarié.

Rien de tout cela n'apparaît dans la politique de confidentialité. Aucune durée de conservation. Aucune notice d'information des salariés fournie à l'atelier. Aucune mention de la consultation du CSE.

**Fondement.** Articles 5, 6 et 13 du RGPD ; article **L2312-38 du code du travail** (consultation du CSE préalable à la mise en œuvre de moyens ou techniques permettant un contrôle de l'activité des salariés) ; doctrine constante de la CNIL sur le contrôle de l'activité et la géolocalisation/quantification du travail.

**Conséquence.** L'atelier qui déploie l'outil sans informer ses salariés ni consulter son CSE est en infraction, et les données de pointage seraient **inopposables** en cas de litige prud'homal. Le sujet est sensible : il ne faut pas qu'il soit découvert par un salarié plutôt que présenté par l'atelier.

**Action.**
- **[TECH]** — ajouter les traitements RH à la politique de confidentialité, fixer une durée (proposition : 3 ans, alignée sur la prescription salariale de l'article L3245-1 du code du travail), retirer `user_id` d'`analytics_events` ou le pseudonymiser.
- **[ALEXIS]** — fournir aux ateliers un **modèle de note d'information aux salariés** et un rappel de l'obligation de consultation du CSE au-delà de 11 salariés. C'est aussi un excellent argument de sérieux à la vente.

---

### M10 — Sécurité : quatre points à corriger sous 30 jours

| Point | Constat | Fondement |
|---|---|---|
| **Secret en clair** | Le token du mailer est écrit en dur dans le corps de la fonction SQL `process_notifications()` : `'token', '7da9f0e3053c481c97f8f45da983748ab2a7cca849dc9767'`. Lisible par quiconque a un `SELECT` sur `pg_proc` — y compris une connexion MCP en lecture. `supabase_vault` est installé et **inutilisé**. | art. 32 RGPD |
| **Pas de MFA** | `select count(*) from auth.mfa_factors` → **0**. Aucun facteur enrôlé, aucun code MFA dans l'application, aucun AAL2 exigé. | art. 32 RGPD ; recommandations CNIL |
| **Politique de mot de passe** | 8 caractères, contrôlés **uniquement côté client** (`signup/page.tsx:56`, `reinitialiser/page.tsx:56`). Aucune exigence de complexité. | délibération CNIL n° 2022-100 : 12 caractères, ou 8 avec mesures complémentaires (blocage après échecs, détection des mots de passe compromis) |
| **Droits résiduels** | `signer_bl` exécutable par le pseudo-rôle `PUBLIC` ; `pg_net` installé dans le schéma `public` ; `tva_intra_depuis_siren` sans `search_path` figé ; 4 policies attachées à `{public}` au lieu de `{authenticated}` | art. 32 RGPD ; advisors Supabase |

**Action [TECH].** Rotationner immédiatement le token du mailer et le déplacer dans Vault. Activer le MFA pour les comptes `owner` (au minimum en option, idéalement obligatoire). Porter la longueur minimale à 12 caractères et l'appliquer côté serveur au niveau du projet Supabase. Nettoyer les droits résiduels.

---

### M11 — Les CGU/CGV comportent des clauses fragiles, et une phrase qui les désarme

**Écart le plus immédiat.** Le layout `src/app/legal/layout.tsx` affiche en pied de **chacune** des trois pages, y compris les CGV :

> « Document fourni à titre informatif — faites-le relire par votre conseil juridique. »

**Sur des conditions générales de vente opposables à un client, cette phrase est une catastrophe contractuelle.** Elle laisse entendre que l'éditeur lui-même ne tient pas ses CGV pour un document contractuel. Un client de mauvaise foi s'en servira. **À supprimer immédiatement sur `/legal/cgu` [TECH], sans attendre le reste de l'audit.**

**Autres clauses à revoir.**

| Clause | Problème | Fondement |
|---|---|---|
| **§4 « service fourni en l'état »** + **§6 responsabilité limitée aux 12 derniers mois** | La combinaison des deux peut être analysée comme privant de sa substance l'obligation essentielle du contrat. La limitation à 12 mois de redevances est en soi usuelle et généralement admise en B2B, mais elle doit être assortie d'exclusions expresses (dol, faute lourde, dommages corporels, atteinte aux données par manquement à l'article 32 RGPD) et d'une contrepartie visible (le SLA). | art. **1170** C. civ. (clause réputée non écrite) ; art. **1171** C. civ. ; art. **L442-1, I, 2°** C. com. (déséquilibre significatif) **[AVOCAT]** |
| **§5 « suppression des données 60 jours après résiliation »** | Contradiction directe avec l'obligation de conservation de **10 ans** des factures qui pèse sur l'atelier. Un atelier qui résilie et néglige l'export perd irrémédiablement ses pièces comptables — et se retourne contre l'éditeur. | art. L123-22 C. com. ; art. L102 B LPF |
| **§5 « export possible à tout moment »** | **Inexact.** L'export exclut explicitement les **photos, le logo, les documents de certification et les PDF** (seuls les chemins de stockage sortent). L'engagement « toutes mes données » du bouton dans les réglages est donc faux. | obligation de délivrance conforme ; art. **20** RGPD (portabilité) |
| **§8 clause attributive de compétence** | Noyée dans le corps du texte. L'article **48 du CPC** exige qu'une clause dérogeant aux règles de compétence territoriale soit « spécifiée de façon très apparente » dans l'engagement de la partie à qui elle est opposée. | art. 48 CPC |
| **Droit de rétractation** | Non traité. L'article **L221-3** du code de la consommation étend le droit de rétractation de 14 jours aux professionnels employant **5 salariés ou moins**, pour les contrats conclus à distance ou hors établissement dont l'**objet n'entre pas dans le champ de l'activité principale**. Un logiciel de gestion vendu à un atelier de thermolaquage : la qualification est discutable, la jurisprudence restrictive, mais le risque existe. L'essai gratuit de 30 jours neutralise l'essentiel de l'exposition pratique. | art. L221-3 C. conso. **[AVOCAT]** |
| **Absence de clauses** | Force majeure ; propriété intellectuelle et **garantie d'éviction** (contrefaçon) ; cession du contrat ; confidentialité réciproque ; assurance ; modalités et préavis de modification des CGU ; procédure de réclamation ; langue du contrat ; clauses survivantes ; obligation de sauvegarde du client. | rédaction contractuelle |
| **CGV de l'éditeur** | Les CGU ne comportent **pas** les mentions obligatoires des CGV entre professionnels : conditions de règlement, taux des pénalités de retard, indemnité forfaitaire de 40 €. | art. **L441-1** et **L441-9** C. com. |
| **Traçabilité de l'acceptation** | `src/app/signup/page.tsx:60` : « En créant un compte, vous acceptez les CGU/CGV et la politique de confidentialité. » Pas de case à cocher, **pas d'enregistrement de la version acceptée, ni de la date**. L'opposabilité d'une version modifiée devient indémontrable. | preuve du consentement contractuel |
| **Médiation de la consommation** | Les mentions légales évoquent l'hypothèse d'un consommateur souscripteur sans **désigner de médiateur**. Si un consommateur souscrit un jour, l'absence de médiateur désigné est sanctionnée. | art. **L616-1** et **L641-1** C. conso. (15 000 € personne physique / 75 000 € personne morale) |

**Action.** **[AVOCAT]** — refonte complète des CGU/CGV et rédaction d'un DPA. **[TECH]** — suppression immédiate de la phrase du layout sur `/legal/cgu` ; case à cocher à l'inscription avec enregistrement de `cgu_version` et `cgu_acceptees_at` ; complétion de l'export (photos, logo, documents, PDF régénérés). **[ALEXIS]** — décider soit d'exclure formellement et techniquement les consommateurs (contrôle du SIREN à l'inscription), soit de désigner et de payer un médiateur de la consommation.

---

### M12 — Royal Motorbike ne pourra plus facturer ses propres clients par Stripe au 1er septembre 2027

**Écart.** L'abonnement Thermogestion est facturé via **Stripe Billing** (`src/app/api/billing/checkout/route.ts`). Stripe n'est **pas une plateforme agréée** et ne produit pas de facture au format du socle. Or les clients de Thermogestion sont des **professionnels français assujettis** : la relation est B2B domestique, donc pleinement dans le champ de l'obligation d'émission.

**Fondement.** Article 289 bis du CGI ; décret n° 2026-677.

**Conséquence.** À compter du 1er septembre 2027, chaque facture d'abonnement émise hors plateforme agréée expose à l'amende de l'article 1737, III du CGI. Sur un parc de 50 clients facturés mensuellement, cela fait 600 factures par an — soit 9 000 € d'amende théorique par an, sous le plafond de 15 000 €.

**Action.** **[ALEXIS] + [EXPERT-COMPTABLE]** — arbitrer entre facturer l'abonnement depuis un outil raccordé à une plateforme agréée, ou raccorder le flux Stripe à la plateforme retenue au titre de C1. À traiter en même temps que C1, c'est le même fournisseur.

---

## 5. Constats modérés

**MOD1 — Analytics nominatif et exemption de consentement.** L'article 8 de la politique affirme qu'il n'y a « que des cookies techniques » et en déduit l'absence de bandeau. L'analyse est globalement juste : pas de cookie tiers, mesure d'audience first-party. Mais `analytics_events` stocke `user_id`, ce qui fait sortir le traitement du périmètre exempté de consentement de l'article **82 de la loi Informatique et Libertés** tel qu'interprété par la CNIL (mesure d'audience strictement nécessaire, sans recoupement ni suivi individuel). **[TECH]** : retirer `user_id` ou le remplacer par un identifiant de session non réversible ; ajuster le texte.

**MOD2 — Registre des traitements absent.** Article **30** du RGPD : Royal Motorbike doit tenir **deux** registres — un comme responsable de traitement (prospects, clients, comptabilité, salariés) et un comme sous-traitant (article 30.2, traitements effectués pour le compte des ateliers). L'exemption des moins de 250 salariés ne joue pas ici : le traitement est régulier et porte sur des données de clients. Aucun registre n'a été trouvé. **[ALEXIS]** : à constituer, modèle CNIL disponible.

**MOD3 — Analyse d'impact.** Probablement **non requise** (pas de données sensibles, pas de traitement à grande échelle, pas de profilage produisant des effets juridiques) — mais la conclusion de non-nécessité doit être **écrite et datée** pour être opposable. **[ALEXIS]**

**MOD4 — Le registre des déchets est supprimable.** `src/app/(app)/qualite/dechets/page.tsx:111` expose un `.delete()` sur une table à conservation réglementaire de **5 ans** (article **R541-43** du code de l'environnement, arrêté du 31 mai 2021). Le PDF affiche pourtant fièrement cette obligation. **[TECH]** : passer en archivage logique.

**MOD5 — Certificat de conformité : responsabilité de l'éditeur.** Le gabarit fait attester à l'atelier que « les contrôles reportés ont été réalisés […] avec des instruments dont l'étalonnage était à jour à la date de la mesure ». C'est une attestation à portée technique et potentiellement assurantielle, générée automatiquement à partir de données saisies. Il faut une clause de non-responsabilité de l'éditeur sur le document lui-même. **[TECH]** — texte proposé, à ajouter en pied de certificat :

> *Ce certificat est établi automatiquement à partir des relevés saisis par l'atelier dans Thermogestion. Son contenu et son exactitude relèvent de la seule responsabilité de [nom de l'atelier], qui l'émet sous sa signature. L'éditeur du logiciel n'est ni auteur ni garant des constats qui y figurent.*

**MOD6 — Conformité du FEC non vérifiée.** L'export FEC existe (`src/app/api/export/comptable/route.ts`). Sa conformité aux 18 champs de l'article **A47 A-1 du LPF** n'a pas été vérifiée dans le détail. **[EXPERT-COMPTABLE]** : faire valider un fichier réel avant de le présenter comme conforme.

**MOD7 — Mentions légales incomplètes.** Article **6, III** de la LCEN et article **19** de la LCEN : manquent le **numéro de téléphone** de l'éditeur, le **téléphone de l'hébergeur** et l'adresse complète de Supabase Inc. Pour un service payant en ligne, l'article 19 impose aussi d'indiquer clairement les prix, TVA et frais compris. **[TECH]**

**MOD8 — Le schéma de base n'est pas versionné.** Le dépôt ne contient **aucun fichier `.sql`** : tout le schéma, toutes les fonctions, tous les triggers et toutes les policies vivent uniquement dans la base. C'est un risque de réversibilité et de continuité pour l'éditeur, et un point que tout auditeur relèvera. **[TECH]** : générer et versionner les migrations.

**MOD9 — Sauvegardes.** Les CGU promettent des « sauvegardes quotidiennes ». À vérifier concrètement : plan Supabase, PITR activé ou non, restauration testée. Une promesse contractuelle de sauvegarde non tenue est un manquement direct. **[ALEXIS]**

**MOD10 — Assurance responsabilité civile professionnelle de l'éditeur.** Non vérifiée dans le périmètre. Une clause de limitation de responsabilité ne remplace pas une police RC Pro couvrant l'activité d'éditeur de logiciel. **[ALEXIS]**

**MOD11 — Timeout de l'export.** `maxDuration = 60` sur `/api/export/donnees`. Sur un atelier volumineux, l'export échouera — et c'est précisément l'engagement de réversibilité des CGU. **[TECH]** : passer en génération asynchrone avec lien de téléchargement.

---

## 6. Ce qui relève des bonnes pratiques

- **Certification NF 203 / NF 525** : hors obligation aujourd'hui pour un logiciel de facturation pure, mais deviendrait un argument commercial fort et lèverait le doute du §1.9. Prérequis absolu : corriger C4 d'abord.
- **Politique de sécurité publiée** (`/legal/securite` ou `security.txt`) : attendu par les acheteurs professionnels.
- **Page « statut du service »** avec l'historique de disponibilité : rend l'engagement de 99 % vérifiable, donc crédible.
- **Procédure documentée de gestion des violations de données** (article 33 : 72 h vers la CNIL pour le responsable, « meilleurs délais » vers le responsable pour le sous-traitant — la promesse de 48 h des CGU est plus stricte que la loi, elle est tenable mais elle engage).
- **Accessibilité** : l'Acte européen sur l'accessibilité (directive 2019/882) vise les services aux consommateurs et exempte les micro-entreprises. Thermogestion est hors champ. Bonne pratique seulement.
- **NIS2, DORA** : hors champ compte tenu de la taille et du secteur.
- **Extension Italie** : nécessitera la conformité au **SdI** (Sistema di Interscambio) et au format **FatturaPA**, obligatoire depuis 2019 en B2B, transmis via un *codice destinatario* ou une PEC. Le produit n'a rien de cela. Chantier entier, à ne pas sous-estimer. **[ALEXIS]**

---

## 7. Corrections rédactionnelles proposées

Ces textes sont proposés tels quels, à intégrer sans réécriture. Ils ne remplacent pas la relecture par un avocat mais réduisent l'exposition immédiate.

### 7.1 `/legal/confidentialite` — article 5, sous-traitants et localisation

> **5. Sous-traitants et localisation des données**
>
> Nous faisons appel aux prestataires suivants, dans les limites strictement nécessaires au fonctionnement du service :
>
> - **Supabase Inc.** — base de données, authentification et stockage de fichiers. Hébergement AWS, région Paris (eu-west-3), Union européenne.
> - **Vercel Inc.** — hébergement de l'application et exécution du code serveur. Société de droit américain, certifiée au titre de l'EU-U.S. Data Privacy Framework ; les traitements sont configurés pour s'exécuter dans la région Paris. Les journaux techniques et adresses IP peuvent transiter par les États-Unis, dans le cadre du Data Privacy Framework et des clauses contractuelles types.
> - **Stripe Payments Europe Ltd (Irlande)** et **Stripe Inc.** — encaissement de votre abonnement et, si vous l'activez, encaissement en ligne de vos propres factures. Sont transmis : votre raison sociale, votre adresse, votre e-mail, votre SIREN, le numéro et le montant des factures encaissées.
> - **thermopoudre.fr** — serveur d'envoi des e-mails transactionnels, hébergé dans l'Union européenne. Sont transmis : l'adresse e-mail du destinataire et le contenu du message.
> - **api-adresse.data.gouv.fr** et **recherche-entreprises.api.gouv.fr** — services publics de l'État français, utilisés pour compléter une adresse ou retrouver une entreprise à partir de son SIREN. Les requêtes partent de nos serveurs ; votre adresse IP n'est pas transmise.
>
> Toute modification de cette liste vous sera notifiée au moins 30 jours à l'avance et vous pourrez vous y opposer.

### 7.2 `/legal/confidentialite` — article 2, données collectées, ajouts

> - **Signature de documents** : lorsqu'un de vos clients signe un devis, un bon de livraison ou une réception depuis un lien que vous lui avez transmis, nous enregistrons pour votre compte son nom, l'image de sa signature, la date et l'heure du serveur, son adresse IP et son navigateur. Ces éléments constituent votre preuve de son accord.
> - **Suivi du temps de travail** : si vous utilisez le pointage par étape, nous enregistrons pour chaque intervention l'identifiant du salarié, l'heure de début et l'heure de fin. Ces données sont utilisées pour calculer le coût de revient de vos chantiers. Il vous appartient d'informer vos salariés et, le cas échéant, de consulter votre comité social et économique avant la mise en service.

### 7.3 `/legal/cgu` — article 5, données et réversibilité

> **5. Vos données, export et restitution**
>
> Les données que vous saisissez vous appartiennent. Vous pouvez à tout moment télécharger depuis les réglages une archive complète au format CSV et JSON. Vos photos, votre logo et vos documents joints se récupèrent sur simple demande à contact@thermopoudre.fr, sous 15 jours.
>
> **Vos factures et pièces comptables doivent être conservées dix ans (article L123-22 du code de commerce). Il vous appartient de procéder à leur export et à leur archivage avant la fin de votre contrat.** Après résiliation, vos données restent accessibles en lecture et exportables pendant 90 jours. Passé ce délai, elles sont supprimées sans possibilité de récupération. Un archivage prolongé peut être convenu sur demande.

### 7.4 `/legal/cgu` — suppression et remplacement du pied de page

Supprimer, sur la page CGU uniquement, la phrase *« Document fourni à titre informatif — faites-le relire par votre conseil juridique. »* et la remplacer par :

> *Conditions générales applicables au [date de version]. Toute modification vous sera notifiée par e-mail au moins 30 jours avant son entrée en vigueur ; à défaut de résiliation de votre part avant cette date, elle vous sera opposable.*

### 7.5 Mention TVA sur les débits — libellé exact

Remplacer, dans `src/lib/pdf/document.tsx` et dans `src/components/FacturePublicClient.tsx` :

- actuel : `Option pour le paiement de la TVA d'après les débits.`
- **proposé : `Option pour le paiement de la taxe d'après les débits.`**

---

## 8. Plan d'action daté

### Avant le 1er septembre 2026 — 13 jours

| # | Action | Porteur |
|---|---|---|
| C1 | Contractualiser avec une plateforme agréée pour Royal Motorbike, vérifier l'inscription du SIREN à l'annuaire, tester une réception réelle | **ALEXIS + EXPERT-COMPTABLE** |
| M11 | Supprimer la phrase « document fourni à titre informatif » de la page CGU | TECH — 5 minutes |
| M10 | Rotationner le token du mailer, le déplacer dans Supabase Vault | TECH — 1 heure |
| C2 | Informer les clients existants, par écrit, de l'état réel du produit au regard de la réforme et du calendrier de raccordement prévu | **ALEXIS** |

### Septembre – octobre 2026

| # | Action | Porteur |
|---|---|---|
| C4 | Bloquer la suppression et le déverrouillage des documents figés (`BEFORE DELETE`, `status` verrouillé, RLS sans `ALL`, annulation par avoir) | TECH |
| C5 | Attribuer le numéro de facture côté serveur, en transaction unique | TECH |
| M4 | Fixer la région d'exécution Vercel à Paris ou Francfort | TECH — 1 heure |
| M3 | Corriger la politique de confidentialité et les mentions légales (textes du §7) | TECH |
| M6 | Ajouter l'information RGPD sur les pages publiques de signature | TECH |
| M2 | Borner le délai de paiement à 60 jours et plancher le taux de pénalités | TECH |
| M10 | Activer le MFA pour les comptes propriétaires, porter le mot de passe à 12 caractères côté serveur, nettoyer les droits résiduels | TECH |
| M5 | Constater l'IP et le user-agent côté serveur, retirer `EXECUTE` à `anon` sur `signer_*`, sceller le PDF signé par SHA-256, étendre `figer_document` aux BL et réceptions | TECH |
| MOD2 | Constituer les deux registres de traitements | ALEXIS |

### Novembre 2026 – février 2027

| # | Action | Porteur |
|---|---|---|
| M1 | Ajouter au modèle : `date_operation`, `client.pays`, `client.tva_intra`, régime de TVA par facture ; imprimer le taux par ligne et la ventilation par taux ; mentions autoliquidation, exonérations, garantie légale, médiateur | TECH + ALEXIS |
| M7 | Rédiger et publier un DPA autonome signable | **AVOCAT** + TECH |
| M11 | Refonte des CGU/CGV | **AVOCAT** + TECH |
| M8 | Implémenter l'anonymisation d'un client et la clôture d'un atelier | TECH |
| M9 | Documenter les traitements RH, fournir un modèle de note aux salariés | TECH + ALEXIS |
| M3 | Implémenter les purges annoncées (analytics, notifications, journaux) et alimenter `audit_logs` | TECH |
| M11 | Compléter l'export (photos, logo, documents, PDF) et le passer en asynchrone | TECH |
| MOD6 | Faire valider un FEC réel | **EXPERT-COMPTABLE** |

### Mars – août 2027 — chemin critique

| # | Action | Porteur |
|---|---|---|
| C2 | **Raccordement effectif à une plateforme agréée** : dépôt de facture, annuaire, statuts de cycle de vie, réception fournisseurs, e-reporting | TECH + ALEXIS |
| C3 | **Passage du Factur-X au profil EN 16931**, puis EXTENDED-CTC-FR | TECH |
| M12 | Basculer la facturation de l'abonnement Thermogestion vers la plateforme agréée | ALEXIS + EXPERT-COMPTABLE |
| — | Recette complète avec un atelier pilote, avant la rentrée 2027 | ALEXIS |

**Date butoir absolue : 1er septembre 2027.** En remontant depuis cette date, le raccordement doit être opérationnel en juin 2027 au plus tard pour laisser trois mois de recette. Ce qui signifie que la décision de C2 doit être prise **avant la fin de 2026**.

---

## 9. Ce qui doit être relu par un professionnel

### Avocat

1. **Refonte complète des CGU/CGV** — limitation de responsabilité, SLA, réversibilité, résiliation, prix et révision, propriété intellectuelle, garantie d'éviction, force majeure, compétence.
2. **Rédaction du DPA** conforme à l'article 28.3 du RGPD, avec annexe descriptive et liste des sous-traitants ultérieurs.
3. **Qualification du droit de rétractation** de l'article L221-3 du code de la consommation pour un abonnement SaaS vendu à un atelier de moins de 6 salariés.
4. **Risque de pratique commerciale trompeuse** sur la communication « Factur-X / facture électronique » (§C3), au regard des articles L121-2 à L121-5 du code de la consommation.
5. **Position sur la valeur probante du dispositif de signature** et sur le vocabulaire employé dans l'interface et les PDF (§M5) — et sur l'opportunité de passer à une signature avancée via un prestataire tiers.
6. **Exposition de l'éditeur au titre du certificat de conformité** généré automatiquement (§MOD5).
7. **Applicabilité de l'article 286, I, 3° bis du CGI** (logiciel de caisse) compte tenu de la fonction d'enregistrement des règlements (§1.9).

### Expert-comptable

1. **Confirmation du calendrier applicable à Royal Motorbike** et choix de la plateforme agréée (§C1, §M12).
2. **Validation du profil Factur-X cible** au regard de la version en vigueur des spécifications externes de la DGFiP au moment du chantier (§C3).
3. **Conformité du fichier FEC** aux 18 champs de l'article A47 A-1 du LPF (§MOD6).
4. **Validation du plan de correction de la piste d'audit fiable** (§C4, §C5) et de l'archivage à valeur probante au sens de l'arrêté du 22 mars 2017.
5. **Traitement comptable et fiscal des factures d'acompte et de solde**, et des mentions qui doivent y figurer (§M1).

### CNIL — pas une relecture, mais un point de vigilance

Aucune formalité préalable n'est due. Mais si Thermogestion se développe et qu'un client saisit la CNIL, les premiers documents demandés seront le registre des traitements, le DPA et la politique de confidentialité. Les trois doivent exister et être cohérents avec le produit avant d'aller chercher des clients plus gros.

---

## 10. Synthèse

### Les trois risques les plus sérieux

**1. Le produit ne permettra pas à ses clients de facturer légalement au 1er septembre 2027.** Ce n'est ni une nuance ni un détail technique : sans raccordement à une plateforme agréée, un logiciel de facturation vendu à des TPE françaises devient inutilisable à cette date. Le Factur-X généré aujourd'hui, en profil MINIMUM et téléchargé à la main, ne satisfait ni le format exigé ni le canal exigé. C'est le risque existentiel du produit, et il a une date.

**2. Une facture émise peut être supprimée ou déverrouillée en une requête.** `figer_document` ne couvre pas le `DELETE` et ne verrouille pas `status` : deux requêtes suffisent à ramener une facture émise à l'état de brouillon et à la réécrire, ou à la supprimer avec ses règlements. Numérotation potentiellement discontinue par-dessus. En contrôle fiscal chez un client, c'est le motif classique de rejet de comptabilité — et l'éditeur n'aura aucun argument à opposer.

**3. La documentation légale décrit un produit qui n'existe pas.** La politique de confidentialité annonce Hostinger là où le code tourne chez Vercel aux États-Unis, oublie Stripe et cinq autres sous-traitants, promet une journalisation dont la table est vide et des purges qu'aucun job n'exécute, et ne mentionne ni les données du signataire ni celles des salariés. Ce n'est pas une négligence rédactionnelle : c'est le document qui sera lu en premier par une autorité, par un acheteur professionnel ou par un adversaire dans un litige.

### Ce qui est urgent au vu du calendrier

**Sous 13 jours** — l'obligation de **réception** de factures électroniques s'applique à Royal Motorbike le 1er septembre 2026, comme à toute entreprise assujettie. Il faut une plateforme agréée et une adresse déclarée à l'annuaire. Ce n'est pas un chantier, c'est un contrat à signer. La DGFiP a annoncé une tolérance encadrée au démarrage, mais elle a précisé qu'elle « n'est ni un report, ni une suspension » et qu'elle se mérite en prouvant une trajectoire de mise en conformité. Ne rien faire n'entre pas dans la tolérance.

**Avant fin 2026** — la décision d'investissement sur le raccordement à une plateforme agréée. En remontant depuis le 1er septembre 2027 avec trois mois de recette, le développement doit démarrer au premier trimestre 2027 au plus tard.

**Immédiatement, parce que c'est gratuit** — supprimer la phrase « document fourni à titre informatif » du bas des CGV, rotationner le token du mailer en clair dans la base, fixer la région d'exécution Vercel.

### Mon avis franc sur le niveau de conformité

Le produit est **techniquement au-dessus de sa catégorie et juridiquement en dessous de ce qu'il prétend être**.

Il faut le dire honnêtement : le socle Factur-X est du travail sérieux. Un PDF/A-3 qui passe veraPDF sans une seule violation sur 4 607 contrôles, avec les polices incorporées et un schéma d'extension XMP correct, c'est rare — beaucoup de logiciels vendus comme conformes échouent là-dessus. Le cloisonnement multi-tenant est propre, les tokens sont correctement générés, l'horodatage serveur est bien pensé, l'export FEC existe. Rien de tout cela n'est du bricolage.

Mais la conformité juridique d'un logiciel de facturation ne se mesure pas à la qualité de ses PDF. Elle se mesure à trois choses : est-ce qu'une facture émise est **inaltérable** ? est-ce qu'elle part par le **bon canal** ? est-ce que la **documentation dit la vérité** ? Aujourd'hui, la réponse est non aux trois.

Je situerais le produit à environ **50 % du chemin** : les fondations sont là, les mentions obligatoires sont aux trois quarts couvertes — y compris trois des quatre nouvelles mentions 2026, ce qui est en avance sur beaucoup de concurrents — mais les verrous d'inaltérabilité sont troués, la chaîne de transmission n'existe pas, et les pages légales décrivent une autre application que celle qui tourne.

La bonne nouvelle, c'est que la répartition de l'effort est très déséquilibrée. Sur la trentaine de constats de cet audit, **une vingtaine se corrigent en quelques jours de développement** et relèvent de la rigueur, pas de l'architecture : des triggers, une transaction, une région de déploiement, des textes à réécrire. **Un seul chantier est lourd** : le raccordement à une plateforme agréée et le passage au profil EN 16931. C'est celui-là qui décide de l'avenir du produit, et il ne demande pas d'abord du code — il demande une décision d'Alexis, un contrat et un budget. Tant que cette décision n'est pas prise, le reste des corrections améliore un produit dont la date de péremption reste fixée au 1er septembre 2027.

Il y a treize mois pour le faire. C'est confortable si la décision est prise maintenant, et c'est très court si elle est prise au printemps.

---

*Audit réalisé le 19 août 2026. Sources consultées et citées en ligne. Aucun code applicatif n'a été modifié. Ce document n'est pas une consultation juridique.*
