# Audit complet — 21 août 2026

*Quatre enquêtes menées en parallèle après les sept chantiers de la veille : sécurité attaquée
depuis l'extérieur, inventaire fonctionnel contredit ligne par ligne, valeur réelle de la suite de
tests, et recette au navigateur des parcours jamais vus. Tout ce qui suit est vérifié sur pièce.
Ce qui a été corrigé dans la foulée est déployé ; la suite compte **1 056 tests verts, 54 fichiers**.*

---

## 1. Le cadre, à connaître avant de lire le reste

Deux faits déplacent la frontière entre « un anonyme » et « un compte légitime » :

- **`/demo` délivre une vraie session Supabase `authenticated`** — propriétaire de l'atelier de
  démonstration — à quiconque ouvre la page. C'est le principe de la démonstration sans compte, et
  le jeton est extractible du navigateur.
- **La confirmation d'e-mail est désactivée** : une inscription rend immédiatement un jeton d'accès.

Conclusion : **tout ce qui est ouvert au rôle `authenticated` est ouvert à qui a un navigateur.**
C'est la lunette avec laquelle tout le reste a été jugé.

---

## 2. Ce qui a été trouvé et corrigé aujourd'hui

### 2.1 Sécurité — cinq failles réelles, toutes fermées

**Un `DELETE` direct détruisait une facture émise.** Les garde-fous étaient posés sur `UPDATE`, pas
sur `DELETE`, et les politiques étaient `FOR ALL`. Mesuré : le refus de mise à la corbeille répond
« une facture émise ne se supprime pas », et trois secondes plus tard un `DELETE` par l'API la
détruit — le numéro `FA-2026-0001` manque définitivement. **C'était une rupture de la numérotation
continue de facturation**, l'exigence la plus élémentaire du CGI, et l'objet même du chantier qui
fige les documents. Fermé par un déclencheur `BEFORE DELETE` qui rejoue les règles de la corbeille,
avec deux portes de sortie prouvées : la fermeture d'atelier (engagement des CGU) et la purge.

**Un document jeté à la corbeille restait signable de l'extérieur.** Les fonctions de lecture
filtraient bien la corbeille ; les trois fonctions de signature, non. Un devis jeté était signé par
l'ancien lien, et le déclencheur créait un chantier vivant derrière. Sur un bon de livraison, cela
clôturait les pointages en cours — donc faussait le temps de main-d'œuvre. C'est **la troisième
fois** sur ce projet qu'une règle posée sur le chemin de lecture manque au chemin d'écriture.

**Le visiteur de la démonstration pouvait déposer des fichiers dans les trois buckets.** Le verrou
de lecture seule protège les tables ; le stockage n'a pas de colonne d'atelier, il n'était donc pas
couvert. Hébergement de fichiers anonyme et gratuit, sans limite de taille ni de type sur deux
buckets, et rien n'était supprimable côté `logos` faute de politique de suppression.

**Les quatre rôles s'arrêtaient à la porte du stockage.** Mesuré : le propriétaire dépose une pièce
jointe de facture, l'opérateur d'atelier — qui ne lit aucune ligne de `factures` — liste le bucket,
télécharge le fichier et le supprime. Corrigé : la décision se prend maintenant sur le dossier du
chemin, avec une liste fermée de familles.

**Le lien d'invitation était un porteur pur.** L'adresse du destinataire n'était jamais vérifiée :
un lien transféré, retrouvé dans une boîte partagée ou dans les journaux d'un relais SMTP, valait
un compte `bureau` complet pendant sept jours. La page publique livrait en prime l'adresse invitée.

**Plus, en défense en profondeur** : `anon` détenait `SELECT/INSERT/UPDATE/DELETE` sur 40 tables —
seule la politique fermait, verrou à un cran ; il n'a plus que deux insertions, celles de la
vitrine. Les fonctions publiques ne servent plus les brouillons. Les chemins de stockage sont
contraints à l'atelier. Les gardes d'abonnement ne s'ouvrent plus à un compte sans atelier.

### 2.2 Ce qui tient — parce que « rien à signaler » doit dire ce qui a été cherché

Le cloisonnement anonyme est solide : lecture vide, écriture refusée, modifications sans effet
vérifiées après coup. **Le portail client est le mieux construit de la semaine** — isolation par
client dans les deux sens, brouillons et corbeille exclus, jetons de 256 bits comparés à
l'identique, plafonds de pagination appliqués, injections sans effet. Aucune vue sans
`security_invoker`, aucune fonction `SECURITY DEFINER` sans `search_path`, aucune fonction
déclencheur exécutable depuis l'API, aucun secret en dur dans le code ni dans le bundle client.

### 2.3 Fonctionnel — l'inventaire se trompait, presque toujours dans le même sens

Sur neuf erreurs trouvées dans le document qui fait foi, **six étaient des faux négatifs** : il
décrivait un état déjà réparé. Le seul faux positif comptait double — l'export total des données
avait été réparé la veille au soir, une heure après la rédaction qui le déclarait cassé.

Deux découvertes de fond :

**Le mot « jante » n'apparaissait pas une seule fois** dans les 603 lignes de l'inventaire, alors
que douze lignes du cahier des charges le couvrent, que quatre tables et quatre écrans existent, et
que la page tarifs en fait le premier argument de la formule d'entrée. Un audit qui se relit à
partir de sa propre liste ne trouve pas ce qui n'y est pas. Et le constat qui décide de leur
statut : **100 % des données jantes sont dans l'atelier de démonstration**, aucune dans l'atelier
réel.

**Le devis promettait 30 jours de validité que rien n'appliquait.** Le statut « expiré » était lu
partout et posé nulle part : un devis de l'an dernier se signait encore aujourd'hui, au prix de
l'an dernier, et le chantier se créait derrière. Corrigé : refus en base, balayage quotidien à
6 h 50, échéance affichée sur la fiche, la liste, la page publique et le PDF, durée paramétrable
par atelier.

**Et les CGU annonçaient des formules qui n'existent pas** — « Solo 59 € » et « Atelier 89 € »
contre les trois formules réelles et le siège à 5 €. C'est contractuel. Les textes légaux ont été
repris en entier et lisent désormais les prix dans le code, plutôt que de les recopier.

### 2.4 Les tests — 72 assertions sur 72 ne prouvaient rien sur la conformité

Le fichier censé couvrir la norme EN 16931 rejouait les formules du code :
`expect(taxe).toBe(round2(base * taux / 100))` face à un code qui calcule exactement cela. Des
identités algébriques, vraies quelles que soient les valeurs, **y compris fausses**. Soixante-douze
assertions vertes qui n'auraient pas bougé si toute la ventilation de TVA avait été inversée — sur
le point le plus sensible du produit, et deux jours après la correction en urgence du profil du XML.

Réécrit : les douze factures portent désormais leurs montants **calculés à la main**, taux par taux.
La confrontation avec l'implémentation donne une coïncidence exacte sur 84 champs — le moteur
Factur-X est juste, on le sait maintenant.

Deux défauts du produit sont sortis de cette réécriture, tous deux corrigés :

- **Le bloc de totaux ne s'additionnait pas** sur une facture à plusieurs taux avec remise : le
  document imprimait une remise de 25,00 € là où le calcul en imputait 25,01 €. Le client qui refait
  l'addition trouve un centime d'écart — et le XML, lui, déclarait la bonne valeur. Le document
  lisible et sa version machine se contredisaient.
- **Une facture à 0 € réclamait un paiement** : la règle « ce document appelle-t-il un règlement ? »
  était réécrite à quatre endroits et trois oubliaient le cas du zéro. Le PDF imprimait l'IBAN et
  les pénalités de retard, le XML annonçait des conditions de règlement.

### 2.5 La recette au navigateur

L'expiration des devis s'affiche correctement sur les quatre supports, échéance comprise dans le
PDF. La recherche d'immatriculation ramène **un** résultat au lieu de sept. Les statuts sont en
français partout. Les messages d'erreur restent bien 15 secondes avec une croix. Les exports FEC et
CSV arrivent, 18 colonnes séparées par tabulations, en-tête réglementaire vérifié. Aucune erreur
JavaScript, aucune requête en échec sur les écrans parcourus. En-têtes de sécurité en place.

Trois défauts, corrigés depuis : l'écran des relances affichait « Trace incomplète » sur 100 % des
lignes sans rien expliquer — la cause était que les relances de la démonstration sont **antérieures
à la colonne de traçabilité** ajoutée l'avant-veille, et la trace a pu être reconstituée ; la page
introuvable était **en anglais, sur fond noir, sans navigation** ; et le jeu de démonstration ne
montrait ni portail ouvert, ni journal rempli, ni devis proche de l'expiration — trois nouveautés
qu'un prospect ne voyait jamais.

---

## 3. Ce qui reste ouvert

### Ce qui demande une décision, pas du code

| Sujet | La question |
|---|---|
| **La confirmation d'e-mail est désactivée** | C'est ce qui rend `authenticated` équivalent à « n'importe qui ». À vérifier dans les réglages Auth de Supabase, c'est le premier point de la liste. |
| **L'opérateur d'atelier écrit et supprime les fiches clients** | La politique n'a aucun contrôle de rôle : il modifie la remise négociée, crée et supprime des clients. Vingt et une autres tables ont la même politique. Trancher ce qui relève de la production et ce qui relève du bureau. |
| **Le bureau récupère l'IBAN** | Il ne lit pas la table qui le porte, mais il lit le jeton d'une facture, et la page publique de facture sert l'IBAN. Soit on assume, soit on retire la promesse — le pire est de garder les deux. |
| **Révoquer un portail ne révoque pas les jetons déjà récoltés** | « Je coupe l'accès de ce client » coupe l'index, pas les documents. Le dire dans l'interface, ou régénérer les jetons à la révocation. |
| **La clé `service_role` manque dans `.env.test`** | Sept tests dorment. Ils ne prouvent pas que le siège acheté ouvre **exactement** une place — c'est du chiffre d'affaires — ni que le balayage d'expiration n'expire que ce qu'il doit. |

### Ce qui n'est couvert par aucun test

**Les 23 routes d'API**, dont le webhook Stripe : vérification de signature, idempotence, pose des
sièges. C'est la porte d'entrée de l'argent, elle est entièrement non testée, et la décision Stripe
est attendue avant le 12 septembre. Et **l'effet réel de six crons sur huit** — on sait qu'ils sont
fermés, on ne sait pas qu'ils font leur travail. La relance automatique en particulier : c'est le
prédicat TypeScript d'affichage qui est testé, jamais le SQL qui envoie.

### Les manques métier, qui ne figuraient dans aucune ligne d'inventaire

Les achats et les fournisseurs — aucune facture fournisseur, alors que le prix de revient s'appuie
sur un prix d'achat que rien ne rapproche d'une facture. L'exercice comptable et la clôture : aucun
verrouillage de période, **aucun stock valorisé à date**. L'état de TVA. Le litige : aucune
réclamation, aucune facture de pénalités alors que le taux est imprimé sur chaque document. **Un
seul taux horaire pour tout l'atelier** — dès qu'un apprenti et un chef pointent sur le même
dossier, le prix de revient est faux, silencieusement. Le départ d'un client (pas d'effacement
RGPD), le départ d'un salarié, la fermeture annuelle, le transport, la sous-traitance sortante, le
motif d'un devis perdu.

---

## 4. Ce qui vous appartient

1. **Vérifier la confirmation d'e-mail** dans les réglages Auth de Supabase. C'est le point qui
   conditionne la gravité de plusieurs autres.
2. **Les huit tarifs Stripe** et les trois variables Vercel — le 12 septembre n'a pas bougé, et le
   webhook n'est couvert par aucun test.
3. **Le mandat de plateforme agréée.** La réception des factures électroniques est obligatoire pour
   toutes les entreprises dans dix jours.
4. **Faire relire les textes légaux** par un professionnel : deux engagements ont été retirés
   (sauvegardes quotidiennes, disponibilité 99 %) parce que rien ne les prouve, et la suppression
   des données en fin de contrat reste un geste manuel que rien n'exécute.
5. **Ajouter la clé `service_role` à `.env.test`** pour réveiller les sept tests.
6. **Nettoyer quatre résidus** que je ne peux pas atteindre : deux fichiers de preuve de 1 et
   8 octets dans le stockage, cinquante leads de recette dans une table sans droit de lecture, et
   treize comptes d'authentification de test orphelins.
