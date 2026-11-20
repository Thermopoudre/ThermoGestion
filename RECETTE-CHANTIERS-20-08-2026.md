# Sept chantiers — 20 août 2026

*Les sept points de tête de `AUDIT-LOGICIEL-20-08-2026.md` §5, faits d'une traite : recherche et
pagination, rôles réels en RLS, dupliquer/corriger/annuler/avoir, pièces jointes et corbeille,
courriel du matin et maîtrise des relances, journal des modifications, accès expert-comptable et
portail client. Plus tôt dans la journée : le siège à 5 € HT et la remontée du Factur-X au profil
EN16931.*

`npm test` : **923 tests, 50 fichiers, 4 ignorés** *(chiffres du dernier passage rapporté par le
chantier ; j'ai recompté les **50 fichiers** `tests/*.test.ts` moi-même, je n'ai pas rejoué la
suite en écrivant ce document)*. Les 4 ignorés sont ceux qui exigent la clé `service_role`, absente
de `.env.test` — §9.3.
`npx next build` : **67 pages** générées, aucune erreur.
Déployé et aliasé sur `https://thermogestion-v2.vercel.app` à **18 h 33** (`deployChantiers.log`).

**Ce document ne rapporte aucune recette au clavier.** Aucun des sept chantiers n'a été vu à
l'écran au moment où j'écris — une recette est en cours en parallèle. Tout ce qui est affirmé
ci-dessous vient de la suite de tests, ou de requêtes SQL rejouées en lecture sur la base de
production `luujbyqenmzivzhiatze` pendant la rédaction. Quand une preuve manque, c'est écrit.

---

# 1. Recherche globale et pagination

## 1.1 Ce qui est en base

Une colonne **générée** `recherche` sur **dix tables**, vérifiées une par une
(`is_generated = ALWAYS`) : `clients`, `devis`, `factures`, `projets`, `bons_livraison`,
`receptions`, `poudres`, `poudre_lots`, `vehicules`, `jeux_jantes`. Elle concatène et normalise
(minuscules, accents retirés, ponctuation écartée) ce qu'un exploitant tape réellement : le nom, la
ville, le téléphone, le SIREN, le numéro de document, l'immatriculation.

`pg_trgm` et `btree_gin` sont installées, et dix index
`gin (atelier_id, recherche gin_trgm_ops)` sont posés — un par table.

`recherche_globale(q text, limite int)` est en **`SECURITY INVOKER`** : elle subit la RLS de
l'appelant. C'est pour ça qu'elle peut rester exécutable par `anon` sans rien exposer — un visiteur
non connecté obtient zéro ligne, ce que le test vérifie explicitement plutôt que de le supposer.

Deux détails de conception qui expliquent le comportement observé :

- **Plancher à deux caractères.** En dessous, le motif répond partout et la requête dégénère en
  balayage complet à chaque frappe.
- **Les documents ne portent pas le nom de leur client.** La fonction résout d'abord les clients
  qui répondent, puis tire leurs pièces par la clé étrangère. C'est ce qui permet de retrouver
  « le devis de Durand » sans jointure textuelle sur chaque table de documents.

## 1.2 Pagination, tri et filtres côté serveur

Un hook unique, `useListePaginee` (`src/components/Pagination.tsx`), consommé par **neuf listes** :
devis, factures, clients, projets (historique), bons de livraison, réceptions, stock, lots, jantes.
La corbeille et le portail client s'en servent aussi, ce qui fait onze usages au total.

Le filtre, le tri et la plage partent en base. C'est le point de fond : un tri appliqué dans le
navigateur ne trie que la page affichée, ce qui est pire que pas de tri du tout — l'écran a l'air
juste et ment. `pagination-serveur.test.ts` fige précisément ça : *« le filtre de statut porte sur
la totalité, pas sur la page affichée »*, *« le tri est appliqué par la base, y compris entre deux
pages »*.

## 1.3 Ce qui a été mesuré, et ce qui ne l'est plus

Les gains annoncés — liste clients 60,4 ms → 0,56 ms, charge utile 2 664 Ko → 4,4 Ko, recherche
client 861 ms → 2,8 ms, dernière page des devis passée d'inatteignable à 1,42 ms — ont été mesurés
**pendant le chantier**, sur un jeu injecté de 5 000 devis, 3 000 clients et 5 000 factures.

**Ce jeu n'est plus là.** La base compte aujourd'hui 8 clients, 12 devis, 8 factures et 14 projets
(compté ce soir). Je **n'ai donc pas pu rejouer ces mesures** et je ne les reprends ici que comme
un relevé daté, pas comme une propriété vérifiable. Le point du §2.1 de l'audit — « le comportement
sous volume n'est pas mesuré » — n'est donc levé que pour la journée du 20/08.

---

# 2. Trois rôles, appliqués en RLS

## 2.1 Le barème

`users.role` est contraint en base à **`owner`, `bureau`, `atelier`, `comptable`** (contrainte
`users_role_check`, relue ce soir). Le quatrième est traité au §7.

`acces_commercial()` rend vrai pour `owner` et `bureau`, faux pour `atelier`. C'est la fonction que
la quasi-totalité des politiques interroge.

## 2.2 Ce que ça donne, compté

L'audit disait : « aucune des 50 politiques RLS ne regarde le rôle ». Compté ce soir sur
`pg_policies` :

| | Nombre |
|---|---|
| Politiques du schéma `public` | **90** |
| dont **49** nomment un rôle | 41 via `acces_commercial()`, 8 via `is_owner()`, 2 via `est_comptable()` |

*(Le chantier annonçait 39 ; le compte réel après les révocations et l'ajout du rôle comptable est
de 49. C'est le chiffre mesuré qui fait foi.)*

## 2.3 Pourquoi quatre tables satellites, et pas des droits de colonne

Le sensible ne pouvait pas rester en colonnes sur les tables mères. Un `GRANT` de colonne
s'accorde à un **rôle Postgres**, or `owner`, `bureau` et `atelier` partagent tous le rôle
`authenticated` : au niveau du moteur, ce sont le même utilisateur. Il fallait donc déplacer les
colonnes dans des tables que la RLS peut fermer.

| Table | Ce qu'elle porte | Qui la lit |
|---|---|---|
| `ateliers_bancaire` | `iban`, `bic` | `is_owner()` seulement |
| `ateliers_couts` | `taux_horaire`, `frais_generaux_pct` | `acces_commercial()` |
| `poudre_couts` | `prix_kg` de la poudre | `acces_commercial()` |
| `poudre_lot_couts` | `prix_kg` du lot | `acces_commercial()` |

Vérifié ce soir : `poudres.prix_kg` et `poudre_lots.prix_kg` **n'existent plus** sur les tables
mères, et aucune des quatre satellites n'accorde le moindre droit à `anon`.

Ce déplacement a une conséquence que personne n'avait vue et qui est le point n°1 du §10 :
**l'export total des données promis dans les CGU ne les emporte plus.**

## 2.4 Comment c'est prouvé

`roles-rls.test.ts` (25,7 Ko) ouvre **trois sessions réelles** — responsable, bureau, atelier —
dans le même atelier jetable, et les interroge en PostgREST, pas à l'écran. Deux précautions y
sont écrites noir sur blanc, parce qu'elles font la différence entre un test qui prouve et un test
qui rassure :

1. **Les refus d'écriture sont vérifiés sur l'état après coup**, jamais sur le code de retour :
   sans policy d'`UPDATE`, PostgREST répond **204** en ayant modifié zéro ligne. Un test qui lit le
   code HTTP conclurait que l'attaque a réussi.
2. `duplication-corrections.test.ts` fait de même sur les nouvelles RPC : *« un opérateur d'atelier
   ne duplique ni devis ni facture, **et rien n'apparaît en base** »*.

---

# 3. Dupliquer, corriger, annuler, avoir

Sept RPC, toutes présentes en base et vérifiées ce soir :

| RPC | Ce qu'elle règle |
|---|---|
| `dupliquer_devis(id)` · `dupliquer_facture(id)` · `dupliquer_projet(id)` | La fonction la plus utilisée d'un logiciel de devis, qui n'existait nulle part |
| `nouvelle_version_devis(id)` | Fait enfin vivre `parent_id` et `version`, morts en base depuis l'origine |
| `rouvrir_devis(id)` | Un clic sur « Refusé » n'est plus un cul-de-sac définitif |
| `annuler_facture(id, motif)` | Le statut `annulee` était lu partout — badge, PDF, exclusion FEC — et **aucun bouton ne pouvait le poser** |
| `avoir_depuis_facture(id, lignes[])` | Avoir total ou partiel, avec plafond de cumul en trigger |

Les règles qui comptent, telles que les tests les figent :

- **La copie ne vole rien à l'original** : une facture dupliquée ne reprend ni le projet, ni le
  devis, ni les bons de livraison de sa jumelle. Un devis dupliqué repart en brouillon, sans
  numéro, sans signature, **et sans le jeton public du client**.
- **L'échéance de la copie repart d'aujourd'hui**, au délai négocié avec le client — pas à celui de
  l'original.
- **Une seule version par devis**, un brouillon ne se versionne pas (il se modifie), un devis
  facturé non plus (c'est un avoir qu'il faut).
- **Une facture payée ou partiellement encaissée ne s'annule pas.** Une facture annulée ne se
  modifie plus et **ne redevient jamais émise**.
- **Le cumul des avoirs ne dépasse jamais la facture d'origine — et c'est la base qui le dit**, pas
  l'écran. L'avoir d'un avoir et l'avoir d'une facture annulée sont refusés.
- Les totaux de toute pièce dérivée sont **recalculés en base**. Un test compare ligne à ligne le
  jumeau SQL de `calcTotaux` avec le TypeScript.

Le chaînage des versions est affiché en une phrase sur la fiche devis (`devis/[id]/page.tsx`) :
sans lui, `parent_id` et `version` seraient renseignés et invisibles — c'est-à-dire la définition
même d'une coquille.

---

# 4. Pièces jointes, corbeille, doublons

## 4.1 Pièces jointes

Table `pieces_jointes` (rattachement polymorphe : `entite`, `entite_id`) et bucket **`documents`**,
**privé**, plafonné à **10 Mo** par fichier — vérifié dans `storage.buckets`.

Ce qui est testé, et qui n'est pas évident : **la borne est côté service, pas côté écran.** Le test
dépose directement dans le bucket un format hors liste blanche et un fichier hors du dossier de
l'atelier, et vérifie le refus. Le chemin de stockage commence par l'identifiant de l'atelier —
c'est ce que la policy Storage regarde — et le nom du fichier ne peut pas fabriquer de sous-dossier.

## 4.2 Corbeille

`deleted_at` sur **six entités** (relu ce soir) : `clients`, `devis`, `projets`, `receptions`,
`bons_livraison`, `factures`. Écran `/corbeille`, purge à **30 jours** (`jours_corbeille()` = 30),
cron `purger-corbeille` à 03 h 30.

Trois décisions qui portent la fonction :

- **On ne jette pas ce qui soutient un document comptable émis.** Une facture émise, le devis
  qu'elle porte, le projet facturé et le bon de livraison consommé sont tous refusés, avec un
  message qui dit quoi faire à la place.
- **Jeter un brouillon de facture libère les bons qu'il portait** — sinon le bon restait bloqué au
  profit d'une facture invisible, ce qui est exactement le verrou anti-double-facturation du lot 6
  retourné contre l'atelier.
- **Un client sans pièce revient archivé, pas actif.** Il avait quitté les listes deux fois ; le
  ramener actif ferait réapparaître une fiche que l'exploitant croyait rangée.
- La purge **n'est pas exposée à l'API** : c'est un travail de cron, pas un bouton. Testé.

Et : **un document jeté cesse d'exister pour le monde extérieur** — le lien public d'une réception
mise à la corbeille ne rend plus rien.

## 4.3 Doublons

**Quatre index uniques**, relus ce soir :

| Index | Portée |
|---|---|
| `clients_nom_unique_par_atelier` | `(atelier_id, txt_normalise(nom))`, hors corbeille |
| `clients_siret_unique_par_atelier` | SIRET réduit à ses chiffres, hors corbeille |
| `poudres_reference_unique_par_atelier` | `(marque, référence)` — la même référence chez un autre fournisseur reste permise |
| `prestations_code_unique_par_atelier` | le code, jamais le libellé |

Une **seule** normalisation, partagée par le navigateur et la base, avec un test qui compare les
deux chaînes caractère par caractère. L'alerte de saisie retrouve ce que la contrainte laisse
passer — « SARL Durand Doublon » ramène « Durand Doublon SARL » — sans ramener tout l'atelier sur
un mot commun.

---

# 5. Le courriel du matin et la maîtrise des relances

## 5.1 Le courriel

Cron `tg-recap-quotidien`, **toutes les heures à :05**, actif. Le réglage vit dans
`reglages_alertes` par atelier : `recap_actif`, `recap_heure`, `recap_jours_ouvres`,
`seuil_dlu_jours`, `devis_sans_reponse_jours`, `relance_devis_jours`, `relance_facture_jours`,
`relance_max`. Les deux ateliers de production sont réglés à **7 h, jours ouvrés, DLU 60 jours**.

Cinq règles écrites dans `envoyer_recap_quotidien()` et relues ce soir :

1. **Un seul message par jour et par destinataire**, garanti par un `exists` sur les notifications
   du jour — le cron tourne toutes les heures, et sans ce verrou un changement d'heure de réglage
   en cours de journée en enverrait deux.
2. **Rien à dire, rien envoyé.** *« Un courriel "rien à signaler" tous les matins est le meilleur
   moyen de se faire ignorer le jour où il y a quelque chose. »*
3. **L'atelier de démonstration est exclu** (`not coalesce(at.demo, false)`), et un atelier dont
   l'abonnement est fermé ne reçoit rien.
4. **Le contenu dépend du rôle** : `recap_quotidien_payload(atelier, commercial)` ne met aucun
   montant dans le récapitulatif d'un opérateur. Le test le vérifie **sur la sortie**, pas sur une
   case cochée.
5. **Désabonnement en un clic** : `recap_destinataires` porte un jeton, la ligne est créée au
   premier envoi (pas à l'inscription — un atelier qui n'a jamais rien à dire n'accumule pas de
   lignes), et `/api/notifications/desinscription` la coupe.

**Ce courriel n'est jamais parti.** `recap_destinataires` compte 0 ligne, et aucune notification
`recap_quotidien` n'existe : le chantier a été déployé après 7 h. **Le premier envoi réel aura lieu
demain 21/08 vers 07 h 05, heure de Paris, à `contact@thermopoudre.fr`** — l'unique membre actif de
ThermoTest. C'est la seule vérification de bout en bout qui manque, et elle se fera toute seule.

## 5.2 Les relances

`relancer_devis_et_factures()` a été reprise. Ce qu'elle regarde désormais, vérifié dans le source :

- `at.demo = false` — voir §8.1, c'est le correctif du défaut le plus grave de la journée ;
- `d.relances_actives` **et** `c.relances_actives` : l'interrupteur du client prime sur celui du
  document ;
- `deleted_at is null` des deux côtés ;
- `f.annulee_at is null` et `type <> 'avoir'` ;
- **le reste dû**, `total_ttc − Σ paiements > 0,01` : une facture partiellement réglée n'est plus
  relancée sur son montant plein ;
- la cadence et le plafond **de l'atelier** (`reglages_alertes_de`), plus les 3 jours codés en dur
  de l'ancienne version ;
- `capacite_ouverte(atelier, 'relances_auto')`.

L'écran `/relances` (198 lignes) ferme la coquille C-10 : `relances_actives` et `relance_count`
étaient écrits par le cron et n'apparaissaient nulle part. **La date annoncée sur la fiche est
celle que le cron appliquera** — `alertes-dlu-relances.test.ts` fige cette égalité, et vérifie
qu'une échéance déjà passée devient « au prochain passage » plutôt qu'une date au passé.

---

# 6. Journal des modifications

`trg_journal` est posé sur **15 tables** (compté ce soir, hors `audit_logs` qui porte les deux
triggers d'inaltérabilité) : `ateliers`, `ateliers_couts`, `clients`, `client_tarifs`, `devis`,
`factures`, `projets`, `prestations`, `grilles_tarifaires`, `grille_paliers`, `grille_coefs`,
`poudre_couts`, `poudre_lot_couts`, `subscriptions`, `users`.

Ce qui distingue ce journal d'un log :

- **Seuls les champs réellement modifiés sont enregistrés.** Réécrire la même valeur n'écrit rien.
  La colonne générée `recherche`, recalculée toute seule, ne pollue pas le journal — sans cette
  exclusion, chaque changement de nom aurait produit deux lignes dont une illisible.
- **La table est inaltérable, y compris pour `postgres`.** Une seule policy existe sur
  `audit_logs` : `owner_select`. Il n'y a **aucune** policy `INSERT`, `UPDATE` ni `DELETE` — le
  responsable lui-même ne peut pas y poser une ligne de sa main, et le test le vérifie en relisant
  la ligne après la tentative de suppression, pas en lisant une erreur.
- **Rétention 730 jours**, `jours_journal()` relue en base, purge par le cron `purger-journal` à
  03 h 45.
- **Le panneau Historique est en français**, sur quatre fiches (client, devis, facture, projet).
  « Un total qui change » se dit avec des euros et un nom de champ, pas en JSON. Une écriture du
  cron n'est attribuée à personne ; la signature d'un client depuis le lien public se distingue de
  celle de l'atelier ; un champ qu'on ne sait pas nommer est **compté, jamais affiché en
  technique**.
- **Un employé qui part ne bloque rien et n'emporte rien** : son compte se supprime, ses devis
  restent, le journal garde la trace.

**Réserve sérieuse.** `audit_logs` compte **0 ligne** sur les deux ateliers de production, ce soir.
C'est cohérent — rien n'a été modifié depuis l'installation des triggers, et l'atelier jetable des
tests est supprimé en cascade à chaque passage — mais cela veut dire que **le journal n'a jamais
enregistré une seule modification réelle**. C'est exactement le motif de « coquille de fait » qui a
piégé l'avis Google (#39) et la commande de poudre (#34) : le code est juste, la fonction n'a
jamais été exercée. La première modification faite à l'écran lèvera le doute en une seconde.

---

# 7. Accès expert-comptable et portail client

## 7.1 Le cabinet

Rôle **`comptable`**, quatrième valeur de la contrainte `users_role_check`. Gratuit, **plafonné à
2** (`plafond_comptables()` = 2), et **hors siège facturé** : `sieges_occupes()` exclut
explicitement `role <> 'comptable'` sur les membres **et** sur les invitations en attente. Sans
cette exclusion, ouvrir l'accès à son comptable aurait coûté 5 € par mois à l'atelier — c'est-à-dire
l'inverse exact de l'argument commercial.

Ce qu'il a : un espace `/comptable` séparé (l'invité y arrive directement, sans passer une fraction
de seconde par le tableau de bord de l'atelier), la RPC `journal_ventes(début, fin)`, l'export FEC
de la période, une trace de remise (`exports_comptables`), une cadence réglable côté atelier
(`reglages_comptable`) et un cron `tg-export-comptable` à 06 h 20.

`comptable-lecture-seule.test.ts` (29,5 Ko, le plus gros fichier de la suite) l'attaque : **trente
tables lui rendent zéro ligne**, brouillons compris ; treize `INSERT`, cinq `UPDATE`, trois
`DELETE` et quatre RPC sont refusés — **tous vérifiés sur l'état après coup avec le compte du
responsable**, y compris l'auto-promotion en `owner` et la réécriture de l'IBAN.

## 7.2 Le portail client

Table `client_portail` (`client_id`, `jeton`, `ouvert_at`, `ouvert_par`, `derniere_visite_at`,
`visites`), écran public `/portail/<jeton>`. **Désactivé par défaut** — la table compte 0 ligne — et
révocable.

Le partage des droits est net et vérifié : `portail_client`, `portail_liste` et `portail_vu` sont
ouvertes à `anon` (c'est le mécanisme du lien) ; `portail_ouvrir`, `portail_regenerer` et
`portail_revoquer` ne le sont **pas**. La table elle-même n'accorde que `SELECT` à `authenticated`,
et rien à `anon` : l'atelier ne peut pas se fabriquer un jeton en écrivant directement dedans.

Ce que le portail ne sert pas, et que le test vérifie une par une : aucun brouillon, aucune note
interne, aucune remise négociée, aucun contact, aucun prix de revient, aucun prix d'achat de
poudre, aucune marge, aucune surface. Du client, **le nom, et rien d'autre de sa fiche**.

Et un point d'argent : **le reste dû déduit les règlements et les avoirs.** Le commentaire posé
dans la fonction dit pourquoi — `avoir_depuis_facture` laisse la facture d'origine en « émise » et
crée un avoir de montant positif rattaché ; sans la soustraction, le portail annoncerait au client
une dette qu'un avoir a déjà effacée, c'est-à-dire déclencherait exactement l'appel téléphonique
que ce chantier veut supprimer.

**Attention à la nomenclature.** L'audit fonctionnel appelle #38 « portail client pro **avec
compte** ». Ce qui est livré est un **lien à jeton par client**, révocable, sans mot de passe et
sans compte. C'est la bonne première marche, et ce n'est pas la ligne #38 telle qu'elle est écrite :
elle passe donc en *Partiel*, pas en *Opérationnel* (§ AUDIT-FONCTIONNEL).

---

# 8. Ce qui a été trouvé en chemin

**Cette section vaut plus que la liste des fonctions.** Sept des douze défauts ci-dessous étaient
invisibles au test **et** invisibles à l'écran : ils ne se voient qu'en interrogeant la base.

## 8.1 L'atelier de démonstration a envoyé deux vraies relances

Le 19/08 à **07 h 00 UTC**, le cron a expédié depuis l'atelier de démonstration :

| Modèle | Destinataire |
|---|---|
| `devis_relance` | `contact@metallerie-sud-demo.fr` |
| `facture_relance` | `contact@aluform-demo.fr` |

Les deux sont en statut `sent`. **Relu en base ce soir**, c'est le constat le plus dur de la
journée.

La cause est une exemption raisonnable qui s'est retournée. `trg_interdire_ecriture_demo` — le
verrou qui rend la démo consultable et jamais modifiable — commence par lire le rôle du jeton JWT
et **laisse passer quand il n'y en a pas**, ce qui est nécessaire pour ne pas casser les travaux de
fond. Le cron `pg_cron` s'exécute sans jeton. Il passait donc dessous, en toute logique, sans
qu'aucun test ne puisse le voir : les tests s'authentifient tous.

**Corrigé dans le cron, pas dans le trigger** : `relancer_devis_et_factures()` porte désormais
`and not coalesce(at.demo, false)` dans ses **deux** boucles, et `envoyer_recap_quotidien()` la même
condition. Le trigger, lui, garde son exemption — c'est le bon comportement pour un travail de
fond, et le refermer casserait les crons légitimes.

**Ce qui reste ouvert** : rien ne garantit que le *prochain* travail de fond y pensera. Le garde-fou
est aujourd'hui une clause répétée dans deux fonctions, pas une propriété de la base.

## 8.2 « Prévenir le client » n'a jamais fonctionné sur les factures

Zéro notification `facture_emise` depuis la mise en service — vérifié : sur les **16** notifications
existantes, on compte 4 `devis_signe`, 8 `projet_etape`, 2 `devis_relance`, 1 `facture_relance`,
1 `bl_signe`, et **aucune** `facture_emise`.

La cause : l'écran insérait directement dans `notifications`, et la table n'a **aucune policy
`INSERT`**. PostgREST refusait, silencieusement du point de vue de l'exploitant. Le bouton
existait, il ne faisait rien depuis le premier jour.

C'est aussi la bonne architecture : `notifications` n'est pas un relais de messagerie. Seule une
RPC qui déduit destinataire et contenu de la base fait partir un message —
`recap-quotidien.test.ts` vérifie que l'insertion directe d'un e-mail arbitraire est refusée.

## 8.3 `notifications` était lisible par le rôle atelier

Numéros de documents, montants et adresses de tous les clients relancés. La table porte maintenant
une unique policy `commercial_select` : `atelier_id = current_atelier_id() and acces_commercial()`.

## 8.4 Aucun échappement HTML — **et ce n'est refermé qu'à moitié**

Les modèles de courriel construisent le HTML par concaténation de `payload->>'…'`. Un nom de client
contenant `<` ou `"` casse le message ; un contenu hostile fait pire.

**Ce qui est fait** : `echapper_html(text)` existe, et `recap_quotidien_html` l'appelle **21 fois**.

**Ce qui ne l'est pas** : `process_notifications()` rend aujourd'hui **onze modèles**, dont neuf en
concaténant directement — `devis_signe`, `bl_signe`, `projet_etape`, `devis_relance`,
`facture_emise`, `facture_relance`, `facture_payee`, `commande_poudre`, `avis_google`. Aucun d'eux
n'appelle `echapper_html` : vérifié par recherche sur le source des fonctions, seule
`recap_quotidien_html` la référence.

**C'est donc un défaut trouvé, documenté, et ouvert.** Il est à faire avant le premier client réel,
et c'est une heure de travail.

## 8.5 `CREATE OR REPLACE VIEW` sans clause `WITH` remet les `reloptions` à zéro

Une migration a fait perdre en silence le `security_invoker` de `client_rentabilite` — exactement la
fuite du lot 2, revenue par la porte de service. Le test « aucune ligne d'un autre atelier » **ne
l'aurait pas détectée**, parce que la clause de formule de la vue masque la fuite.

**État vérifié ce soir** : les six vues du schéma portent toutes l'option
(`atelier_conformite`, `client_rentabilite`, `poudre_rendement`, `projet_revient`,
`projet_temps_cout`, `relances_envoyees`). Et les 56 tables ont toutes la RLS activée.

Règle à retenir : **une vue se remplace toujours avec sa clause `WITH (security_invoker = true)`**,
même quand on ne touche qu'au `select`.

## 8.6 `revoke … from public` ne suffit pas sur Supabase

Des `ALTER DEFAULT PRIVILEGES` accordent `EXECUTE` **nommément** à `anon` et `authenticated` sur
toute fonction nouvellement créée. Révoquer `PUBLIC` ne retire pas ces droits-là. **Trois passages
de révocation** ont été nécessaires dans la journée, chacun ayant découvert une fonction créée entre
les deux précédents.

**État final vérifié**, fonction par fonction : `recap_quotidien_payload`, `recap_quotidien_html`,
`reglages_alertes_de`, `envoyer_recap_quotidien`, `purger_journal`, `purger_corbeille`,
`programmer_exports_comptables` et `trg_journal` ne sont exécutables **ni par `anon` ni par
`authenticated`**. `portail_ouvrir`, `portail_regenerer`, `portail_revoquer`, `journal_ventes` et
`annuler_facture` sont fermées à `anon`.

**Résidu à connaître** : les *tables* `notifications`, `pieces_jointes`, `exports_comptables` et
`audit_logs` portent encore des `GRANT` à `anon` hérités du même mécanisme. Elles ne fuient pas —
aucune n'a de policy ouverte à `anon`, donc la RLS rend zéro ligne — mais ce sont des droits qui ne
servent à rien et qu'il vaudrait mieux retirer.

## 8.7 Le jeton d'invitation mourait à l'inscription

`signup` créait le compte et redirigeait vers `/onboarding` **sans repasser le paramètre `invite`**.
Or c'est `/onboarding` qui appelle `accept_invitation()`. Tout invité — employé comme cabinet — se
retrouvait donc devant le formulaire de création d'un atelier neuf, avec un essai à lui.

Autrement dit : **la fonction « inviter un collaborateur » n'a jamais pu aboutir**, et le siège à
5 € vendu ce matin reposait dessus.

## 8.8 PostgREST fait l'union des clés d'une insertion en lot

Insérer `[{a:1}, {a:2, b:3}]` en un seul appel produit deux lignes avec la colonne `b`, la première
à **NULL** — et non à sa valeur par défaut. Le défaut de la colonne n'est jamais appliqué.

C'est le genre de comportement qui produit une ligne fausse sur dix, dans un import ou un
pré-remplissage, sans erreur nulle part.

## 8.9 `acces_commercial()` rappelée à chaque ligne : 786 ms sur 5 000 lignes

Motif `auth_rls_initplan` : une fonction stable appelée dans une clause `USING` est réévaluée par
ligne au lieu d'être calculée une fois. Correction : l'envelopper dans `(select …)`, ce qui la fait
passer en sous-requête d'initialisation.

**Vérifié dans les politiques ce soir** : les policies de `notifications`, `client_portail`,
`reglages_alertes`, `poudre_couts` et `poudre_lot_couts` portent bien
`( SELECT acces_commercial() AS acces_commercial)`. Deux ne l'ont pas encore —
`ateliers_couts` et `ateliers_bancaire` appellent la fonction directement. Ces deux tables portent
**une ligne par atelier** : l'effet est nul aujourd'hui, mais l'écriture n'est pas homogène.

## 8.10 Les index GIN trigrammes sont inertes sous RLS

C'est le constat le plus contre-intuitif de la journée. `textlike` n'est pas déclaré *leakproof* ;
PostgreSQL refuse donc d'évaluer un opérateur non-leakproof avant la clause de sécurité, et
n'utilise **jamais** l'index sous une policy RLS.

Les dix index `gin_trgm_ops` posés ce matin sont donc, en l'état, **décoratifs**. Ce qui rend la
recherche rapide, c'est la **colonne générée stockée** : une chaîne unique, courte, déjà normalisée,
que le balayage séquentiel traverse cent fois plus vite que les six colonnes d'origine avec leurs
`unaccent(lower(…))` recalculés à chaque ligne.

Je n'ai **pas** rejoué de `EXPLAIN` en écrivant ce document — la conclusion vient du chantier. Elle
est cohérente avec la forme de `recherche_globale`, qui compare en `like '%motif%'` sans opérateur
trigramme explicite. Les index restent posés : ils coûtent peu, et le jour où PostgreSQL ou Supabase
changera cette règle, ils serviront.

## 8.11 `supprimer_atelier_test()` ne supprimait plus rien

Le garde-fou « un atelier garde toujours au moins un responsable » (`DERNIER_PROPRIETAIRE`, posé
avec les rôles) se déclenchait sur la suppression **en cascade** des `users` d'un atelier qu'on est
justement en train de supprimer. La suite de tests laissait donc derrière elle un atelier jetable à
chaque passage.

Corrigé dans `trg_garde_role` par une exemption explicite, avec sa raison écrite dans le code :
*« Suppression en cascade depuis `ateliers` : il n'y a plus d'atelier à laisser sans patron. »*

**Le corollaire compte plus que le bug.** Un client qui demande l'effacement de ses données se
serait heurté au même mur — le RGPD ne s'accommode pas d'un garde-fou qui empêche de partir.

## 8.12 Les avoirs n'étaient déduits d'aucun « reste dû »

Un avoir laisse la facture d'origine en « émise ». Partout où l'on affichait un impayé, l'avoir
était ignoré. Corrigé dans `portail_client` (vérifié dans le source, avec son commentaire). **La
relance, elle, ne déduit toujours que les paiements** : `total_ttc − Σ paiements`. Une facture
intégralement avoirée mais non payée reste donc relançable. À vérifier au prochain passage.

---

# 9. Recette

## 9.1 Ce qui est prouvé par la suite de tests

**923 tests, 50 fichiers.** Quinze fichiers nouveaux ou refondus aujourd'hui. Ce que je retiens de
leur forme, plus que de leur nombre :

- **Les refus sont vérifiés sur l'état après coup, jamais sur le code de retour.** C'est écrit dans
  `roles-rls`, `duplication-corrections`, `comptable-lecture-seule`, `sieges` et `corbeille`.
- **Le code et la base sont comparés là où la règle vit deux fois** : la normalisation de recherche,
  la normalisation des doublons, le barème des sièges, le barème de la corbeille, les bornes de
  taille et de format des pièces jointes, la rétention du journal, le seuil de DLU.
- **Les attaques partent d'un client PostgREST ordinaire et d'un client anonyme**, jamais de
  l'écran.

## 9.2 Build et déploiement

`npx next build` : 67 pages, aucune erreur. `vercel --prod` : en ligne à 18 h 33, aliasé sur
`thermogestion-v2.vercel.app`.

## 9.3 Quatre tests dorment

Les quatre épreuves qui vérifient qu'un atelier **ne peut pas s'attribuer des sièges lui-même** ont
besoin d'écrire `subscriptions.sieges_supp` avec la clé `service_role` — c'est le rôle du webhook
Stripe, et de lui seul. La clé est absente de `.env.test`. Elles s'annoncent **ignorées plutôt que
vertes à vide** : compté dans le fichier, ce sont bien 4 `it` sous deux `describe` conditionnels.

`TEST_SUPABASE_SERVICE_ROLE_KEY=` dans `.env.test` (déjà exclu de git) et elles tournent.

## 9.4 Ce qui n'est pas prouvé

- **Aucune recette au clavier sur ces sept chantiers** au moment où j'écris. La palette ⌘K, l'écran
  `/relances`, `/corbeille`, `/comptable`, `/portail/<jeton>`, le panneau Historique et le dépôt
  d'une pièce jointe **n'ont pas été vus**. Une recette est en cours en parallèle.
- **Le courriel du matin n'est jamais parti** (§5.1). Premier envoi attendu demain 07 h 05.
- **Le journal n'a jamais enregistré une modification réelle** : `audit_logs` compte 0 ligne (§6).
- **Le portail n'a jamais été ouvert** : `client_portail` compte 0 ligne. **Aucun accès comptable
  n'existe** : 0 utilisateur au rôle `comptable`. **Aucune pièce jointe n'a été déposée.**
- **Les mesures de performance du §1.3 ne sont pas rejouables** : le jeu de 5 000 devis n'est plus
  en base.
- **Aucun `EXPLAIN` n'a été rejoué** pour le §8.10.
- **Stripe reste entièrement non couvert.** Aucun simulateur, aucun test de route. Inchangé.

---

# 10. Ce qui reste ouvert

| # | Point | Gravité |
|---|---|---|
| **1** | **L'export total des données a régressé.** `TABLES_EXPORT` liste **42** tables ; la base en compte **56**. Les **dix** manquantes appartiennent toutes à l'atelier : `ateliers_bancaire`, `ateliers_couts`, `poudre_couts`, `poudre_lot_couts`, `pieces_jointes`, `client_portail`, `exports_comptables`, `recap_destinataires`, `reglages_alertes`, `reglages_comptable`. Concrètement, **l'archive promise dans les CGU ne contient plus l'IBAN, le taux horaire, les frais généraux, ni le prix d'achat au kilo** — ils ont quitté leurs tables mères au §2.3. | **Haute** — c'est un engagement contractuel |
| **2** | **Le test d'export ne pouvait pas le voir** : il compare la sortie à `TABLES_EXPORT`, c'est-à-dire à lui-même. Un test auto-référentiel. Il faudrait le confronter à `information_schema` avec une liste d'exclusions explicite. | **Haute** — c'est la classe de défaut n°1 de ce projet |
| **3** | **Neuf modèles d'e-mail n'échappent toujours pas le HTML** (§8.4). | Moyenne |
| 4 | `recherche_globale` **ne filtre pas `deleted_at`** : un devis mis à la corbeille remonte dans la palette. Vérifié dans le source de la fonction. | Moyenne |
| 5 | La relance ne déduit pas les avoirs du reste dû (§8.12). | Moyenne |
| 6 | Rien n'empêche structurellement un futur travail de fond d'écrire sur l'atelier de démonstration (§8.1). | Moyenne |
| 7 | `ateliers_couts` et `ateliers_bancaire` appellent `acces_commercial()` sans `(select …)` (§8.9). Sans effet mesurable, mais hétérogène. | Faible |
| 8 | Des `GRANT` résiduels à `anon` sur quatre tables (§8.6). Sans fuite, la RLS tenant. | Faible |

---

# 11. Ce qui reste à Alexis

Inchangé depuis `PLAN-COMPLET-20-08-2026.md` §2, rien de nouveau n'est apparu aujourd'hui :

1. **Les huit tarifs Stripe et les variables Vercel, avant le 12/09.** Le paywall est armé sur
   32 tables, ThermoTest expire le 12. C'est la seule chose qui peut mal tourner mécaniquement, à
   une date connue.
2. **Le mandat de plateforme agréée** (Axonaut, immatriculée depuis le 08/01/2026), avec les quatre
   questions de `PLATEFORMES-AGREEES.md` — dont l'archivage probant à dix ans.
3. **Acheter `thermogestion.fr`.**
4. **Faire relire les trois PDF qualité par un responsable qualité d'atelier certifié.** Une
   formule à 249 € repose dessus, et la recommandation n'a pas bougé depuis le lot 2.
5. **Une clé PrestaShop en lecture seule.**
6. **Renseigner la fiche Google** pour les demandes d'avis à J+2.

Et une nouveauté, demain matin : **ouvrez le courriel de 7 h 05.** C'est la seule preuve qui manque
au chantier n°5, et elle arrivera toute seule dans votre boîte.

---

# 12. Mon avis franc

**Sur les rôles et le cloisonnement : c'est du solide, et c'est prouvé de la bonne manière.** Trois
sessions réelles dans le même atelier, des refus vérifiés sur l'état de la base et pas sur un code
HTTP, quatre tables satellites parce qu'un privilège de colonne ne savait pas faire le travail. Le
raisonnement sur `authenticated` — trois rôles applicatifs, un seul rôle Postgres — est juste, et
c'est le genre de chose qu'on ne trouve qu'en essayant de faire autrement d'abord.

**Sur la journée : le vrai livrable, ce sont les douze défauts du §8, pas les sept fonctions.** Deux
d'entre eux avaient une conséquence déjà réalisée — des courriels partis d'un atelier de
démonstration, un bouton « prévenir le client » mort depuis la mise en service. Trois autres
étaient des verrous qui avaient l'air de tenir : le `security_invoker` perdu par une commande
d'apparence anodine, les `EXECUTE` que `revoke … from public` ne retire pas, les index qui ne
servent à rien sous RLS. **C'est le sixième, septième et huitième verrou de ce projet à n'avoir
tenu qu'après avoir été attaqué**, et je n'ai aucune raison de croire que c'étaient les derniers.

**Ce qui me gêne le plus, c'est le §10-1.** Sept chantiers ont ajouté dix tables, et personne — moi
compris — n'a pensé à l'export CGU avant que je le recompte ce soir. Le test existait, il était
vert, et il ne pouvait pas voir le problème parce qu'il se comparait à lui-même. C'est exactement
le motif que l'audit fonctionnel décrivait au point 3 de « ce que la suite ne peut pas voir » : *un
test vert prouve que la fonction répond, pas que son périmètre est le bon.* Une réversibilité
promise dans les CGU qui perd l'IBAN et le prix d'achat des poudres, c'est plus grave que n'importe
quelle fonction manquante de cette liste.

**Et une inquiétude de méthode.** Sept chantiers en une journée, 405 tests de plus, dix tables, une
trentaine de RPC — et **zéro clic**. La suite de tests est meilleure que la moyenne et elle attaque
la base depuis l'extérieur, mais elle n'a jamais monté un composant React. Les onze coquilles de
l'audit du 19/08 étaient toutes de la forme « la valeur est bien enregistrée, personne ne la
relit ». Rien dans ce qui a été livré aujourd'hui ne rend ce motif moins probable — au contraire :
on vient d'ajouter sept écrans. **La recette au clavier n'est pas une formalité de fin de journée
sur ce lot, c'est la seule chose qui puisse encore trouver ce qui reste.**
