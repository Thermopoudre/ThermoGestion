# Tests automatisés — la chaîne devis → facture, et les garde-fous de tous les lots

Suite de tests **d'intégration** : elle tape sur la vraie base Supabase (`luujbyqenmzivzhiatze`),
pas sur des mocks. C'est délibéré — les deux bugs de facturation trouvés à la main venaient de la
base et du couplage entre l'écran et le schéma, pas de la logique pure : des mocks ne les auraient
jamais vus.

## Lancer la suite

```powershell
npm test          # une passe — 923 tests, 50 fichiers, 4 ignorés
npm run test:watch
```

Prérequis : un fichier `.env.test` à la racine (jamais versionné, cf. `.gitignore`). Le modèle est
dans `.env.test.example` :

```
TEST_SUPABASE_URL=https://luujbyqenmzivzhiatze.supabase.co
TEST_SUPABASE_ANON_KEY=<clé publiable>
TEST_USER_EMAIL=<compte applicatif dédié aux tests>
TEST_USER_PASSWORD=<mot de passe>
DEMO_PASSWORD=<mot de passe du compte de démonstration, variable Vercel du même nom>
```

Sans `DEMO_PASSWORD`, le fichier `demo-lecture-seule.test.ts` est ignoré plutôt qu'en échec : le
mot de passe de la démonstration ne protège rien (le bouton est public) mais n'a pas sa place dans
le dépôt.

Aucune clé `service_role` n'est nécessaire **pour 919 des 923 tests** : la suite s'authentifie
comme un utilisateur ordinaire et subit exactement les mêmes RLS que l'application. Si le compte
de test n'existe pas encore, il est créé au premier lancement par une inscription classique.

### Les 4 tests ignorés

Quatre épreuves de `sieges.test.ts`, réparties en deux `describe` conditionnels
(`avecService = CLE_SERVICE ? describe : describe.skip`), ont besoin d'**écrire**
`subscriptions.sieges_supp` — ce que seul le webhook Stripe fait, avec la clé `service_role`. Elles
vérifient qu'un siège payé ouvre une place et une seule, et qu'un membre désactivé puis réactivé
ne contourne pas le compteur.

Elles s'annoncent **ignorées plutôt que vertes à vide**, ce qui n'est pas une commodité : le droit
qu'elles testent est précisément celui qu'on refuse à l'atelier. Un test qui n'a pas pu attaquer ne
doit jamais compter comme une preuve.

`TEST_SUPABASE_SERVICE_ROLE_KEY=` dans `.env.test` (déjà exclu de git) et elles tournent.

## Isolation — l'atelier de démo n'est jamais touché

Chaque exécution :

1. se connecte avec le compte de test ;
2. supprime l'atelier jetable resté d'une exécution interrompue, **et refuse de démarrer** si le
   compte appartient à un atelier dont le nom ne commence pas par `TEST-AUTO-` ;
3. crée un atelier `TEST-AUTO-<horodatage>` via la RPC `create_atelier` et y sème son jeu de
   données (grilles, clients, prestations, poudre…) ;
4. **supprime l'atelier à la fin, même si des tests ont échoué** (`globalSetup` de Vitest).

La suppression passe par la RPC `supprimer_atelier_test()`, qui refuse tout atelier dont le nom
n'a pas le préfixe réservé : **ThermoTest ne peut pas être supprimé par les tests, même par
accident**. Tout le reste du schéma étant en `ON DELETE CASCADE`, il ne reste aucune trace après
la passe (vérifié : nombres de lignes identiques avant/après sur `devis`, `factures`, `clients`,
`projets`, `poudre_lots`, `compteurs`).

> **Piège refermé le 20/08.** Le garde-fou « un atelier garde toujours au moins un responsable »
> (`DERNIER_PROPRIETAIRE`), posé avec les rôles, se déclenchait sur la suppression **en cascade**
> des `users` d'un atelier qu'on est justement en train de supprimer : `supprimer_atelier_test()`
> échouait, et la suite laissait un atelier jetable derrière elle à chaque passage.
> `trg_garde_role` porte désormais une exemption explicite, avec sa raison écrite dans le code.
> **Le corollaire dépasse les tests** : un client demandant l'effacement de ses données se serait
> heurté au même mur.

Ni l'atelier de test ni ses clients n'ont d'adresse e-mail : les triggers de notification ne
posent donc rien en file et le cron d'envoi ne peut expédier aucun courriel à un destinataire
fictif.

Les fichiers sont exécutés **en série** (`fileParallelism: false`) : ils partagent le même atelier
et les mêmes compteurs de numérotation.

### Trois comptes de plus, créés par `roles-rls.test.ts` et `comptable-lecture-seule.test.ts`

Prouver les rôles suppose d'avoir des sessions réelles dans le même atelier : on ne peut pas
simuler un opérateur avec le jeton du patron. Le fichier `roles-rls.test.ts` crée donc, à la
demande, deux comptes d'authentification dérivés de `TEST_USER_EMAIL` —
`…+role-bureau@…` et `…+role-atelier@…`, même mot de passe — les fait entrer dans l'atelier
jetable par une invitation portant le rôle voulu, puis **retire leurs lignes `users` en fin de
fichier**. `comptable-lecture-seule.test.ts` fait de même avec `…+role-comptable@…`.
Aucune variable d'environnement supplémentaire n'est à renseigner.

Ce nettoyage n'est pas cosmétique : `sieges.test.ts` et `droits-formules.test.ts` comptent les
places occupées, et un siège oublié les ferait échouer sans rapport avec ce qu'ils testent. Les
deux comptes d'authentification, eux, survivent d'une exécution à l'autre et sont réutilisés — ils
n'appartiennent alors plus à aucun atelier, puisque le jetable a été supprimé.

## Ce que la suite couvre

| Fichier | Objet |
|---|---|
| `totaux-devis.test.ts` | Grille à paliers (bornes incluse/exclue), coefficients finition × complexité, coefficient inconnu neutre, lignes au ml et surface développée, tarif négocié client, remise en % et en montant, remise supérieure au total, TVA multi-taux, arrondis au centime, relecture d'un devis complet en base. |
| `regression-remise-facture.test.ts` | **Le test le plus important** : devis remisé 12 % → facture → relecture → réenregistrement → relecture → facture publique. Le total reste 136,86 € et ne repasse jamais à 155,52 €. Plus un contrôle global : sur **tous** les devis et factures de l'atelier, `totaux == calcTotaux(lignes, remise)`. |
| `signature-devis.test.ts` | Signature depuis la page publique (rôle `anon`), création automatique du projet, héritage de la surface (m² + équivalent développé des ml + pièces types × quantité), numérotation `DV-` / `PR-`, refus d'une double signature et d'un devis resté brouillon. |
| `facture-depuis-devis.test.ts` | Reprise à l'identique des lignes, de la remise et des totaux ; échéance calculée sur le **délai négocié du client** (45 j) et non celui de l'atelier (30 j) ; repli sur l'atelier ; rattachement au projet issu du devis. |
| `facture-publique.test.ts` | Mentions obligatoires servies par la RPC `facture_public` : identité légale de l'atelier (SIREN, SIRET, forme, capital, RCS, TVA intra, IBAN/BIC, pénalités, escompte), SIREN du client, nature de l'opération, remise, adresse de livraison **si et seulement si** elle diffère de l'adresse de facturation. |
| `documents-figes.test.ts` | Un devis signé et une facture émise ou payée ne peuvent plus voir leurs lignes, remise, totaux, numéro, client ou échéance modifiés ; ce qui doit rester possible (statut, paiement, lien Stripe, relances, édition d'un brouillon) le reste. |
| `securite-rpc.test.ts` | `marquer_facture_payee`, `relancer_devis_et_factures`, `process_notifications`, `verifier_notifications`, `reconcilier_stock_lots`, `consommer_lots` et `receptionner_lot` sont inaccessibles à `anon` **et** à `authenticated` ; contrôle positif sur les RPC publiques ; cloisonnement par `atelier_id` en lecture et en écriture. |
| `stock-lots.test.ts` | Réception de lots, décompte automatique à la cuisson imputé au lot dont la DLU est la plus proche, traçabilité `lot_id` / `lot_numero` / `dlu` dans `stock_mouvements`, absence de double décompte, pesée et ajustement (appel court **et** complet de `mouvement_stock`), invariant `poudres.stock_kg = Σ poudre_lots.restant_kg` après chaque mouvement. |
| `chaine-bl-projet.test.ts` | Un bon de livraison signé clôt le projet rattaché (toutes les étapes faites, `status = livre`, `date_livraison` posée) et refuse une seconde signature. |
| `numerotation.test.ts` | 20 appels concurrents à `next_numero` → 20 numéros distincts et contigus ; préfixe par type de document ; compteurs indépendants ; table `compteurs` ni lisible ni forçable depuis un compte atelier. |
| `forfait-minimum-couches.test.ts` | Coefficient « nombre de couches » multiplié avec finition et complexité, neutre s'il est absent ; coefficient de complexité d'une pièce type ; forfait minimum appliqué **après** la remise, ligne explicite, jamais empilé, jamais déclenché sans ligne au m², et **un devis signé qui n'est pas rechiffré** par les nouvelles règles. |
| `catalogue-thermopoudre.test.ts` | Lecture d'une fiche produit thermopoudre.fr : tableau de spécifications, cycle de cuisson, rendement, RAL, conditionnement, prix au kg, teintes d'origine constructeur, produits hors catalogue écartés. Aucun accès réseau. |
| `facturx.test.ts` | XML CII profil MINIMUM identique au fichier validé contre le XSD et le schematron officiels ; codes de type de document ; dates sans dérive de fuseau ; échappement ; emballage PDF/A-3 (pièce jointe `factur-x.xml` en `/Alternative`, intention de sortie, XMP `pdfaid` + extension Factur-X). |
| `export-comptable.test.ts` | FEC : 18 colonnes réglementaires, journaux VT et BQ, équilibre débit/crédit, avoir en sens inverse, comptes de vente selon la nature d'opération, nom de fichier `<SIREN>FEC<AAAAMMJJ>.txt`. CSV : BOM, point-virgule, virgule décimale, échappement. Ventilation de TVA qui retombe au centime sur les totaux enregistrés. |
| `pdf-polices.test.ts` | Aucune des 14 polices standard du PDF dans les documents produits (elles sont interdites par PDF/A parce que leur programme n'est pas dans le fichier), un `/FontFile2` par graisse réellement employée, sur la facture **et** sur le devis. Le verdict de conformité vient de veraPDF ; ce test garde la condition qu'il vérifiait. |
| `commande-poudre.test.ts` | Quantité conseillée au réapprovisionnement ; un seul panier ouvert sous appels concurrents ; quantités additionnées au lieu d'un doublon ; numérotation `BC-` attribuée seulement à l'envoi ; refus d'un panier vide, d'une adresse fournisseur invalide, d'un double envoi et d'une double réception ; réception qui crée un lot tracé et incrémente le stock ; cloisonnement par atelier. |
| `demo-lecture-seule.test.ts` | L'atelier de démonstration se lit et ne s'écrit pas : `INSERT`, `UPDATE`, `DELETE` refusés, **et surtout** les fonctions `SECURITY DEFINER` (`next_numero`, `mouvement_stock`, `panier_poudre`) et la signature anonyme d'un devis par son jeton public — c'est par là qu'un contrôle fondé sur `current_user` serait passé. |
| `import-tableur.test.ts` | Lecture CSV (séparateur deviné, BOM, guillemets, CRLF) et **XLSX réel** (cellule vide au milieu d'une ligne, qui décale tout sans repositionnement par référence) ; reconnaissance des intitulés de colonnes courants ; motifs de rejet nommés — champ obligatoire vide, e-mail invalide, valeur de liste inconnue, prix négatif, doublon en base et doublon interne au fichier. |
| `lot2-rentabilite-rendement.test.ts` | **Le test de sécurité du lot 2** : les quatre vues de coût (`projet_revient`, `projet_temps_cout`, `client_rentabilite`, `poudre_rendement`) sont interrogées depuis un client PostgREST **anonyme** — celui d'un visiteur de page publique — et depuis un compte atelier réel. `projet_revient` avait été créée sans `security_invoker`, donc avec les droits de `postgres` qui ignore RLS : la clé publique du front lisait le prix de revient de tous les ateliers. Plus : revient client = somme du revient de ses projets, client jamais facturé en perte sèche sans pourcentage inventé, délai accordé et taille moyenne des séries, non-conformité chiffrée imputée à la marge du client, avoir déduit, brouillon ignoré, rendement sans pesée qui n'affiche aucun taux, pesée qui devient perte chiffrée, certifications cloisonnées par atelier. |
| `roles-rls.test.ts` | **Le test de sécurité du chantier « rôles »** : trois sessions réelles (responsable, bureau, atelier) dans le même atelier jetable, interrogées en PostgREST et non à l'écran. L'opérateur reçoit zéro ligne sur `client_rentabilite`, `projet_revient` et `poudre_rendement` là où le patron en a ; `prix_kg`, `iban` et `taux_horaire` n'existent plus comme colonnes de `poudre_lots`, `poudres` et `ateliers` ; il lit la grille mais ne peut ni la modifier ni ajouter un palier (**vérifié sur l'état après coup, pas sur le code de retour** — sans policy, PostgREST répond 204 en modifiant zéro ligne) ; il ne lit ni devis, ni factures, ni abonnement, ni journal ; il ne peut pas se promouvoir (`ROLE_RESERVE_PROPRIETAIRE`) ni changer d'atelier ; et un atelier ne peut jamais perdre son dernier responsable (`DERNIER_PROPRIETAIRE`), y compris par désactivation ou suppression. |
| `comptable-lecture-seule.test.ts` | **Le test de sécurité du chantier « accès expert-comptable »** : une session réelle de comptable dans l'atelier jetable. Il lit son journal des ventes par `journal_ventes()` (facture, client, règlement partiel) mais **trente tables lui rendent zéro ligne**, brouillons compris ; `mon_abonnement()` et `corbeille()` ne lui rendent rien ; `sieges_occupes()` sur un atelier deviné rend 0 (la branche « atelier courant nul », prévue pour l'invité sans atelier, lui était ouverte). Côté écriture : treize INSERT, cinq UPDATE, trois DELETE et quatre RPC (`mettre_a_la_corbeille`, `next_numero`, `dupliquer_facture`, `annuler_facture`) — **tous vérifiés sur l'état après coup avec le compte du responsable**, y compris l'auto-promotion en `owner` et la réécriture de l'IBAN. Plus : l'accès du cabinet ne bouge pas le compteur de sièges, le plafond de deux tient (`COMPTABLES_PLAFOND`), la trace « remis le … » est lisible des deux côtés et inaltérable, la cadence se règle côté atelier et se lit côté cabinet, `invitation_publique()` annonce l'atelier et le rôle sans ouvrir la table, et les deux nouvelles tables sont fermées à l'anonyme. |
| `capacite-livraison.test.ts` | Capacité journalière = capacité du four × cycles par jour × taux de remplissage moyen ; **aucune capacité tant qu'un des trois réglages manque** ; jours ouvrés qui sautent le week-end ; file d'attente qui ignore le livré et l'annulé ; comptage des projets dont la date promise est passée ; date tenable = file + chantier + marge de finition ; refus de proposer une date sur un four non paramétré ; surface négative qui ne raccourcit jamais le délai. |
| `certificat-conformite.test.ts` | Les garde-fous du certificat de conformité, document opposable : contrôle retenu = le plus récent par type (une pièce retouchée puis recontrôlée conforme redevient certifiable) ; cuisson attestée = fournée terminée **et** température relevée ; les quatre blocages isolément (sans épaisseur, contrôle non conforme en vigueur, cuisson non tracée, instrument non étalonné) ; un instrument « bientôt à étalonner » qui ne bloque pas ; avertissements qui informent sans bloquer ; label non imprimé s'il est expiré ; numéro stable ; fin de garantie ; certification de référence qui ignore les expirées et les inactives. |
| `pdf-qualite.test.ts` | Certificat de conformité et fiche de cuisson : PDF structurellement complet, **aucune des 14 polices standard interdites par PDF/A**, programme de police incorporé, **certificat qui tient sur une seule page même avec les six types de contrôle**, rendu d'un dossier minimal (sans label, sans lot, sans opérateur, sans numéro de projet), fournée vide, écart consigne/relevé. |
| `seuils-qualite.test.ts` | **Le test de sécurité du lot 5.** Seuils de contrôle paramétrables : le même relevé bascule de verdict selon le référentiel, plafond d'épaisseur facultatif, défauts Qualicoat classe 1 inchangés, référentiel semé à la création de l'atelier, unicité du référentiel par défaut. Et surtout la **non-rétroactivité** : la copie des seuils est posée par la base (un client ne peut pas la forger), resserrer le barème ne réévalue aucun contrôle enregistré, supprimer un référentiel n'efface pas la trace, et sept tentatives d'`UPDATE` depuis un client PostgREST ordinaire (verdict, valeurs, seuils, type, date, projet, rebranchement) sont refusées — commentaire et photo restant modifiables. |
| `pages-publiques.test.ts` | **Le contrat des cinq pages publiques.** Chaque RPC (`devis_public`, `facture_public`, `bl_public`, `projet_public`, `reception_public`) doit continuer à servir les champs dont sa page a besoin — une RPC qui cesse d'exposer `remise` fait tomber le test au lieu de faire disparaître 12 % du prix chez un client. Plus : chaîne devis remisé → BL → facture avec égalité au centime, sous-total − remise + forfait minimum = total HT, remise en montant fixe, avoir, facture annulée, montant nul, client sans adresse, atelier sans logo, jeton inconnu, tables fermées à `anon`, alignement des clés FR/IT et formatage des montants par locale. |
| `export-donnees.test.ts` | Export total (engagement des CGU) : périmètre des 37 tables métier et exclusion des mécanismes internes, **aucune ligne d'un autre atelier**, export vide pour un client anonyme, format CSV (BOM, échappement, `jsonb`, colonne tardive, table vide), JSON relisible, et l'archive ZIP validée sur ses signatures, son nombre d'entrées, la position du répertoire central, le CRC et la taille de chaque entrée. |
| `verdict-qualite-serveur.test.ts` | **Le test de sécurité du lot 6.** Le verdict qualité est recalculé **par la base** et la valeur envoyée par le client ignorée — dans les deux sens du mensonge (10 µm déclarés conformes, un relevé conforme déclaré non conforme), sur les six types, avec des valeurs en chaîne et des mesures incomplètes. La **suppression** d'un contrôle ne retire rien, ni depuis un compte atelier ni depuis un anonyme : le test ne cherche pas une erreur, il vérifie que la ligne est toujours là. Plus les contrôles activables par atelier : un type désactivé est refusé à l'insertion (`TYPE_CONTROLE_DESACTIVE`) et pas seulement masqué, un référentiel ne peut être ni vide ni porteur d'un type inventé, le certificat n'exige l'épaisseur que si l'atelier la mesure, refuse un dossier sans aucun contrôle, nomme ce qu'il n'atteste pas, et avertit l'atelier Qualicoat qui coupe l'épaisseur. |
| `pointage-partage.test.ts` | Chronométrage de bout en bout (R8) : `demarrer_etape` ouvre la première étape et met le projet en production, `avancer_etape` clôt et rouvre **seule** (plus aucun appel à ne pas oublier côté écran), la dernière étape se referme, un BL signé referme le chrono, et la vue de coût compte le chrono en cours — les deux cartes de la fiche projet cessent de se contredire. Temps partagé (B2) : 60 min sur 3 m² et 1 m² donnent 45 et 15 min à 75 / 25 % ; le temps réparti remonte à `projet_temps_cout` **et** à `projet_revient` ; une surface manquante bascule la répartition à parts égales plutôt qu'à une division par zéro ; la somme des parts est exactement le temps relevé même sur un arrondi bâtard (100 min à trois → 34/33/33) ; un lot d'un seul projet, un lot déjà arrêté, un projet étranger et un client anonyme sont tous refusés. |
| `facturation-bl-acompte.test.ts` | R4 : la facture du chantier consomme ses bons de livraison, la récapitulative ne les ramasse plus, rebrancher un bon sur une autre facture lève `BL_DEJA_FACTURE`, statut et rattachement ne peuvent pas diverger, supprimer ou annuler une facture libère les bons, et un acompte n'en consomme aucun. R6 : un devis portant un acompte reste facturable alors qu'un devis soldé ne l'est plus, le solde déduit l'acompte au centime TVA comprise avec la mention et `facture_liee_id`, la remise ne porte pas une seconde fois sur l'acompte déduit, un acompte multi-TVA se déduit taux par taux, et un devis ne se solde pas deux fois (index unique en base, pas filtre d'écran). |
| `droits-formules.test.ts` | **Le test de sécurité du lot 10.** Droits par formule : les trois formules, les six clés Stripe, le prix annuel qui vaut dix mois, le module jantes bien présent dans la formule d'entrée, et les **33 combinaisons formule × capacité comparées une par une entre le code et la base**. Puis l'attaque : en aperçu « Atelier », sept tables lèvent `PLAN_INSUFFISANT` depuis un client PostgREST ordinaire, `facture_recapitulative` est refusée par la RPC et pas par l'écran, `client_rentabilite` et `projet_revient` rendent **zéro ligne**, la troisième place d'utilisateur lève `LIMITE_UTILISATEURS` (invitations en attente comprises), et la lecture des données déjà saisies reste ouverte. Un atelier ne peut pas se hisser tout seul dans une formule payante — vérifié **sur l'état après coup**, parce que sans policy d'UPDATE PostgREST répond 204 en ayant modifié zéro ligne. Un client anonyme n'a aucune capacité, ne lit aucune rentabilité et n'apprend pas la formule d'un autre atelier. L'essai, lui, ouvre les onze capacités. |
| `rentabilite-energie-pesee.test.ts` | Les trois points laissés ouverts par le lot 2. **Coût énergétique par fournée** : aucun euro sans `prix_kwh` (un prix à zéro compte comme non renseigné), aucun euro sans consommation relevée, coût = kWh × prix, coût ramené au **m² embarqué**, fournée sous 50 % de remplissage signalée avec la chauffe payée pour du vide, four qui déborde qui ne devient jamais un gain, four non paramétré qui ne prétend rien sur le remplissage, et un aller-retour en base qui prouve que le réglage a bien un effet. **Reste à facturer** : montant exact des BL livrés non facturés (remise déduite comme le ferait la facture récapitulative), BL en brouillon ignoré, BL rattaché à une facture qui sort du reste, acompte qui ne solde pas un chantier, et `perte_reelle` vraie **uniquement** quand tout est facturé sous le prix de revient. **Pesée** : une teinte jamais pesée n'affiche aucun taux, une pesée qui tombe pile reste une mesure (0 %, pas « pesée nécessaire »). Plus l'attaque de `client_rentabilite` modifiée depuis `anon` et depuis un compte atelier — avec, écrite dans le fichier, la **limite mesurée** de cette attaque : la clause `capacite_ouverte` de la vue masque une perte de `security_invoker`, seul l'advisor Supabase la détecte. |
| `alertes-dlu-relances.test.ts` | Le seuil de DLU et la cadence des relances, **définis à un seul endroit** (`src/lib/alertes.ts`) après avoir été recopiés dans six écrans. Horloge figée : un lot dont la DLU tombe aujourd'hui n'est pas périmé à 23 h ; périmé / à écouler / sans risque selon le seuil **de l'atelier** (20 j ne colore pas ce que 60 j colorait) ; pas de DLU, pas d'alerte. Relances : la date annoncée sur la fiche est celle que le cron appliquera, une échéance déjà passée devient « au prochain passage » et non une date au passé, l'interrupteur du client prime sur celui du document, et chaque refus a son motif nommé — client coupé, document coupé, plafond, non éligible, formule fermée. Plafond à 0 = interrupteur général. |
| `recap-quotidien.test.ts` | **Le test de sécurité du courriel du matin.** `envoyer_recap_quotidien`, `recap_quotidien_payload`, `reglages_alertes_de` et `recap_quotidien_html` sont refusées à `anon` **et** à `authenticated` — la première écrit dans la file d'envoi, la deuxième prend un `atelier_id` en paramètre et rendrait le carnet de commandes de n'importe quel atelier. Les deux portes applicatives (`mes_reglages_alertes`, `mon_recap_quotidien`) répondent au compte connecté et jamais à `anon`. Le seuil de DLU se règle par atelier, se relit tel quel et refuse une valeur hors bornes. Aucun montant dans le récapitulatif d'un niveau de droit non commercial — vérifié sur la sortie, pas sur une case cochée. `notifications` n'est pas un relais de messagerie : l'insertion directe d'un e-mail arbitraire est refusée, seule une RPC qui déduit destinataire et contenu de la base fait partir un message. Et couper les relances d'une **facture émise** reste possible, parce qu'un atelier doit pouvoir arrêter ce que le logiciel écrit à son client. |
| `dechets-fds.test.ts` | Registre des déchets et classeur FDS : totaux dangereux / non dangereux avec `numeric` rendus en chaîne, bordereau manquant compté **uniquement** sur les déchets dangereux, cohérence de la nomenclature (tout code astérisqué est dangereux), refus d'une quantité nulle ou négative, détection des FDS de plus de trois ans aux bornes exactes, recherche sans accent et multi-mots, cloisonnement en lecture et en écriture. |
| `facture-recapitulative.test.ts` | Les quatre garde-fous posés après la **quatrième disparition de remise** du projet : la remise de chaque bon de livraison est reportée en ligne explicite au lieu d'être perdue, le forfait minimum reste hors de l'assiette, aucune ligne de remise n'est fabriquée quand le bon n'en porte pas, et une période sans bon à ramasser est refusée plutôt que facturée à zéro. |
| `nature-operation.test.ts` | La catégorie d'opération, qui était une **constante React** et qui est désormais déduite des lignes **côté serveur** : prestations → services, revente de valves → biens, mélange → mixte, ligne libre → service. Une correction posée par l'atelier l'emporte sur le catalogue ; **sans correction, la base écrase la valeur envoyée par le client**. Le forfait minimum et la déduction d'acompte ne font pas basculer la catégorie. Et une facture émise n'est **jamais requalifiée**, même si le catalogue change après coup. |
| `facturx-regles-en16931.test.ts` | Les quatre règles arithmétiques du schematron officiel, rejouées en TypeScript pour qu'une régression se voie **sans repasser chez le validateur** : BR-CO-11 (somme des remises déclarées = total des remises), BR-S-08 (base de chaque taux = lignes du taux − remises du taux), BR-S-09 (TVA = base × taux), BR-CO-13 et BR-CO-15 (l'assiette et le TTC se referment). Plus : le montant réellement dû est celui du document lisible, et aucune remise n'est déclarée pour un montant négatif. Les trois bugs qu'elles ferment n'avaient été vus **que** par le validateur officiel — aucun test de structure ne les avait attrapés. |
| `jantes-chiffrage.test.ts` | Le moteur de chiffrage au jeu, écrit avant l'écran : `prixJante` (palier au pouce × dessin × finition), `surfaceJante`, la ligne de devis et son libellé, les opérations mécaniques quantifiées au nombre de jantes, `positionsParDefaut`, et **le jeu qui ne peut pas être prêt avant sa dernière jante**. Plus la cohérence avec le moteur de totaux existant : la ligne de jantes est une ligne libre marquée dans son `meta`, elle ne double aucun calcul. |
| `jantes-dossier.test.ts` | Le dossier de jeu en base : numérotation, véhicule et teinte d'origine, cloisonnement, statut déduit des jantes, bon de prise en charge public, chaîne devis → projet, et **le prix que dit la base comparé à celui que dit le navigateur**. |
| `mesure-vitrine.test.ts` | Les deux tables de la plateforme ouvertes en écriture anonyme, et leurs bornes : `analytics_events` accepte un événement bien formé avec visiteur, session et UTM, **refuse d'attribuer un événement à un autre utilisateur**, et reste illisible depuis un client anonyme ; `leads` accepte une demande de rappel et **ne la rend jamais relisible, ni modifiable, ni supprimable depuis l'extérieur**. |
| `recherche-globale.test.ts` | **Ce que l'atelier tape réellement** : le nom accentué tapé sans accent et l'inverse, la ville, le téléphone dicté sans espaces, le SIREN, le numéro de devis (le cas de départ de l'audit), le nom du client qui n'est pourtant pas dans la table `devis`, l'immatriculation avec ou sans tirets. Plus : rien en dessous de deux caractères, un motif contenant `%` qui ne ramène pas tout, la limite respectée famille par famille, **zéro résultat pour un anonyme quel que soit le motif**, chaque identifiant rendu relisible par une lecture ordinaire du même compte, et la colonne technique `recherche` jamais exposée aux écrans. La normalisation est comparée entre le navigateur et la base. |
| `pagination-serveur.test.ts` | Le total exact et non le nombre de lignes de la page ; des pages qui ne se recouvrent pas et couvrent la totalité ; la dernière page qui rend le reste ; au-delà, PostgREST refuse la plage **et le composant sait le voir**. Surtout : **le filtre et le tri partent en base** — le filtre de statut porte sur la totalité et pas sur la page affichée, le tri est appliqué entre deux pages. Et les listes ne demandent que les colonnes qu'elles affichent : la liste des devis ne rapatrie ni les lignes, ni les notes, **ni le jeton public**. |
| `duplication-corrections.test.ts` | **Le test du chantier « dupliquer, corriger, annuler, avoir »**, 33 épreuves. Duplication : la copie repart en brouillon sans numéro, sans signature et **sans le jeton du client** ; une facture dupliquée ne vole ni le projet, ni le devis, ni les bons de sa jumelle ; l'échéance repart d'aujourd'hui au délai négocié ; une copie de solde perd la déduction d'acompte et ses totaux sont refaits **en base** ; un avoir ne se duplique pas. Versions : une seule par devis, un brouillon ne se versionne pas, un devis facturé non plus. Annulation : motif obligatoire, refus sur facture payée ou partiellement encaissée, **une facture annulée ne redevient jamais émise**. Avoir : le cumul ne dépasse jamais la facture d'origine et **c'est la base qui le dit**. Et les rôles : un opérateur d'atelier ne duplique ni devis ni facture — vérifié **sur l'état après coup** — mais duplique un projet, parce que la production lui appartient. |
| `pieces-jointes.test.ts` | Les bornes du navigateur comparées à celles de la base (taille, format, fichier vide, rattachement inconnu, doublon d'objet), le chemin de stockage qui commence par l'identifiant de l'atelier — c'est ce que la policy Storage regarde — et qui **ne peut pas fabriquer de sous-dossier depuis le nom du fichier**. Puis l'attaque du bucket lui-même : un format hors liste blanche et un dépôt hors du dossier de l'atelier sont refusés **par le service**, pas par l'écran. |
| `corbeille.test.ts` | Le barème du code comparé à celui de la base (six entités, délai de purge, table PostgREST de chacune). Un devis part, se retrouve, revient — **vérifié en relisant la liste, jamais le code de retour** — et un `update deleted_at` direct, lui, ne passe pas. On ne met pas à la corbeille ce qui soutient un document comptable émis : facture émise, devis porté, projet facturé, bon consommé, client porteur de pièces. **Jeter un brouillon de facture libère les bons qu'il portait.** Un client sans pièce revient **archivé, pas actif**. Un document jeté cesse d'exister pour le monde extérieur. Et la purge n'est pas exposée à l'API : c'est un travail de cron, pas un bouton. |
| `doublons.test.ts` | Une seule normalisation, partagée par le navigateur et la base et comparée chaîne à chaîne : mots vides du métier écartés, un nom fait uniquement de mots vides qui reste cherchable, au plus deux mots envoyés en base. Puis les quatre contraintes : « SARL Durand » puis « sarl durand » refusé mais « Durand SARL » accepté, le même SIRET écrit autrement refusé, une référence de poudre unique **par fournisseur**, un code de prestation unique. Et l'alerte de saisie qui retrouve ce que la contrainte laisse passer, sans ramener tout l'atelier sur un mot commun. |
| `journal-modifications.test.ts` | **Le test de sécurité du journal.** Une création laisse une ligne signée ; **seuls les champs réellement modifiés** sont enregistrés ; la colonne générée `recherche` ne pollue rien ; réécrire la même valeur n'écrit rien du tout. Puis l'essentiel : **une table de preuve où chacun écrit ne prouve rien** — le responsable ne peut pas y poser une ligne de sa main, un anonyme non plus, une ligne ne se corrige pas et **ne s'efface pas**, ce que le test vérifie en constatant que la ligne est toujours là après la tentative. Un employé qui part ne bloque rien et n'emporte rien. Enfin le rendu : des euros et des noms plutôt que du JSON, une écriture du cron attribuée à personne, la signature d'un client distinguée de celle de l'atelier, un champ qu'on ne sait pas nommer **compté et jamais affiché en technique**. |
| `portail-client.test.ts` | Le jeton n'existe pas tant que l'atelier ne l'a pas ouvert, il est long et d'une autre nature que les jetons de document, et rouvrir ne casse pas le lien déjà envoyé. **Le cloisonnement est vérifié dans les deux sens** — le porteur du lien de A ne voit aucune pièce de B, et réciproquement, avec un troisième test qui prouve que chacun voit bien les siennes, sans quoi les deux premiers ne prouveraient rien. Ne sort ni brouillon, ni note interne, ni remise négociée, ni contact, ni prix de revient, ni prix d'achat, ni marge, ni surface. Le **reste dû déduit les règlements et les avoirs**. Renouveler le lien tue immédiatement l'ancien, fermer l'espace le tue pour de bon, et mettre le client à la corbeille ferme son portail. |
| `sieges.test.ts` | Le barème des sièges dit la même chose en base et dans le code, formule par formule ; le tarif passe par une `lookup_key` et jamais par un identifiant de prix. **Un atelier ne peut pas s'attribuer des sièges tout seul** — ni par `UPDATE`, ni depuis un anonyme, ni par la porte de l'aperçu de formule. Le trigger compte les places au moment d'inviter : une invitation expirée ne consomme rien, un membre inactif non plus, **et la réactivation est refusée quand toutes les places sont prises** — c'était le contournement évident. Quatre épreuves de ce fichier sont ignorées faute de clé `service_role` (voir plus haut). |

## Ce que la suite ne couvre pas

- **L'interface** : aucun rendu React n'est monté. Les tests appellent les mêmes fonctions
  (`calcTotaux`, `prixM2`, `joursPaiement`, `lignesDepuisDevis`) et les mêmes requêtes que les
  écrans, mais un bouton mal câblé ou un champ mal désactivé passerait au travers. La saisie
  décimale au clavier (bug A2 de la recette) relève de la recette manuelle.
- **Les routes PDF** : `/api/pdf/*` n'est pas appelé par HTTP. Les **documents** eux-mêmes sont
  rendus (`pdf-polices.test.ts`, `pdf-qualite.test.ts`) : polices incorporées, nombre de pages,
  robustesse sur données incomplètes. Ce qui échappe encore à la suite, c'est le câblage
  route ↔ document et la mise en page fine, qui relèvent de la recette.
- **Stripe** : aucun webhook, aucun paiement en ligne.
- **L'envoi réel des notifications** : les triggers sont neutralisés faute d'adresse e-mail. La
  file, le cron `tg-process-notifications` et le relais mail ne sont pas testés.
- **La composition d'une fournée au clic** : le regroupement par teinte, le blocage sur cycle
  incompatible et la suggestion de remplissage sont des fonctions pures de `src/lib/fournees.ts`
  encore non couvertes ; leur effet a été vérifié en recette, pas en test.
- **Les routes PDF du lot 5** : `/api/pdf/registre-dechets` n'est pas appelé par HTTP, comme les
  autres routes PDF. Les fonctions qu'il utilise (`totauxDechets`, `bordereauManquant`) le sont.
- **L'ouverture de l'archive d'export par un décompresseur réel** : la suite vérifie la structure du
  ZIP octet par octet (signatures, CRC, tailles, répertoire central), mais c'est la recette qui a
  ouvert l'archive avec le décompresseur de Windows pour constater que les entrées se listent et
  que le CSV se relit. Une régression de format serait donc vue par la suite, un incompatibilité
  d'outil ne le serait pas.
- **Le catalogue Thermopoudre en ligne** : la traduction d'une fiche produit est testée sur des
  extraits réels (`catalogue-thermopoudre.test.ts`), mais aucun test n'appelle la boutique. Une
  refonte du gabarit de fiche côté thermopoudre.fr ne serait vue qu'à la prochaine recette.
- **La conformité PDF/A-3 elle-même** : la suite contrôle la pièce jointe, sa relation
  `/Alternative`, l'intention de sortie et les métadonnées XMP, pas le verdict d'un validateur
  PDF/A (veraPDF), qui n'a pas sa place dans une suite de tests unitaires.
- **Le schematron Factur-X.** `facturx-regles-en16931.test.ts` rejoue les quatre règles
  arithmétiques qui nous avaient piégés, pas les 200 et quelques du référentiel. Une facture d'une
  forme non prévue peut encore être rejetée par une plateforme sans qu'aucun test ne rougisse.
- **Ce que fait un travail de fond.** Toute la suite s'authentifie ; `pg_cron` s'exécute **sans
  jeton**. C'est exactement par là que les relances de l'atelier de démonstration sont parties le
  19/08, et aucun test n'aurait pu le voir. Tant qu'on n'a pas de moyen de jouer un cron dans les
  conditions du cron, cette classe de défaut reste hors de portée.
- **Le périmètre de l'export total.** `export-donnees.test.ts` compare la sortie à
  `TABLES_EXPORT` — c'est-à-dire à elle-même. Il est vert par construction, quel que soit le
  nombre de tables réellement présentes en base. C'est ce qui a laissé passer la régression du #57
  le 20/08 : dix tables ajoutées dans la journée, aucune dans l'archive, aucun test rouge. **Le
  contrôle juste se fait contre `information_schema`, avec une liste d'exclusions explicite.**
  À corriger.
- **L'échappement HTML des courriels.** Neuf des onze modèles de `process_notifications()`
  concatènent le `payload` directement dans le HTML. Aucun test ne l'attaque.

## Écrire un nouveau test

Les briques sont dans `tests/helpers/` :

- `contexte.ts` — `clientConnecte()` (compte atelier), `clientAnonyme()` (page publique), `nb()`
  pour convertir les `numeric` que PostgREST renvoie en chaîne ;
- `devis.ts` — `ligneM2`, `ligneMl`, `lignePrestation`, `lignePieceType`, `creerDevis`,
  `finaliserDevis`, `creerFactureDepuisDevis`, qui reproduisent fidèlement ce que font les écrans.

Le jeu de données semé est décrit dans `tests/setup/seed.ts` ; ses identifiants sont accessibles
via `contexte().seed`.
