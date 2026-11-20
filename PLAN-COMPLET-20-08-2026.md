# Thermogestion — plan complet au 20 août 2026

*Document de pilotage. Remplace les listes éparpillées dans les recettes de lot. Ce qui fait foi
sur l'état fonctionnel réel reste `AUDIT-FONCTIONNEL.md` ; ce qui fait foi sur le périmètre reste
`CAHIER-DES-CHARGES-MASTER.md`. Ici on répond à trois questions : ce qui a changé, ce que ça coûte,
et qui fait quoi ensuite.*

---

## 1. Ce qui a changé aujourd'hui

### 1.1 L'utilisateur supplémentaire est facturé 5 € HT par mois

C'est le changement de modèle, pas une option de plus.

**Avant** : 2 utilisateurs sur la formule d'entrée, illimités au-dessus. Un atelier qui embauchait
un troisième opérateur passait de 79 à 129 € — **63 % de plus pour un simple accès** — et découvrait
au passage qu'il achetait la planification des fournées, dont il n'avait pas encore l'usage. Cette
marche pénalisait surtout la cible jantes : le segment le plus différenciant du produit, plafonné à
79 €, sans aucune marche intermédiaire qui parle à ce métier.

**Maintenant** : le nombre de personnes n'est plus une marche entre formules, c'est un compteur.

| Formule | Prix HT / mois | À l'année | Utilisateurs compris | Utilisateur en plus |
|---|---|---|---|---|
| **Atelier** | 79 € | 790 € | 2 | 5 € HT/mois · 50 € HT/an |
| **Équipe** | 129 € | 1 290 € | 5 | idem |
| **Certifié** | 249 € | 2 490 € | 10 | idem |

Un atelier de trois personnes paie donc **84 € HT** au lieu de 129 €. Et la marche 79 → 129 € ne vend
plus qu'une chose, celle qu'elle contient vraiment : fournées planifiées, rentabilité par client,
tarifs négociés, facturation mensuelle récapitulative, relances automatiques.

**Ce qui est réellement appliqué, et où.** Le verrou est en base, pas à l'écran :

- `subscriptions.sieges_supp` porte le nombre de sièges payés. Il n'est écrit que par le webhook
  Stripe, via `service_role`.
- Le déclencheur `trg_limite_utilisateurs` refuse l'utilisateur et l'invitation au-delà de
  `sièges compris + sièges payés`, en levant `SIEGES_INSUFFISANTS`.
- Il couvre aussi la **réactivation d'un membre désactivé** — c'était le contournement évident, et il
  n'était pas fermé.
- Une invitation en attente occupe une place tant qu'elle n'a pas expiré, exactement comme à l'écran.

**Deux pièges refermés en chemin.** `subscriptions` avait `INSERT`, `UPDATE` et `DELETE` accordés à
`anon` et `authenticated` — la table ne tenait que par l'absence de politique d'écriture. Le jour où
quelqu'un ajoute une politique `FOR ALL` par commodité, un atelier s'attribue 500 sièges gratuits
depuis la console de son navigateur. Les droits ont été retirés. Et `subscriptions.plan` avait encore
`solo` pour valeur par défaut, une formule supprimée au lot 10 : un atelier créé sans formule
explicite se serait vu refuser toute invitation.

### 1.2 Les cinq points laissés ouverts par le lot 2 sont refermés

**Le kilowattheure est enfin un euro.** La fiche de cuisson et l'écran de fournée affichaient des
kWh, jamais leur valeur. Le coût de la fournée est calculé, et surtout **ramené au m² embarqué** —
c'est la seule forme dans laquelle il aide à décider. Sous 50 % de remplissage, un bandeau chiffre le
vide : « à pleine charge, le même cycle serait revenu à X €/m², soit Y € de chauffe payée pour du
vide ». Aucun euro n'est affiché si le prix du kWh n'est pas renseigné — et **un prix à zéro est
traité comme non renseigné**, un zéro oublié dans un formulaire produisant sinon un « 0,00 € »
parfaitement crédible et parfaitement faux.

**Le travail livré non facturé ne ressemble plus à une perte.** Sur la rentabilité client, un
chantier livré mais pas encore facturé apparaissait en rouge, en perte sèche. C'était exact et
illisible. Deux causes désormais distinguées : le **reste à facturer** — de la trésorerie en attente,
calculée avec la règle exacte de la facture récapitulative, remise comprise — et la **perte réelle**,
seule à rester en rouge. La colonne mène aux bons de livraison concernés.

**La pesée est expliquée là où le chiffre manque.** Un atelier qui ne pèse jamais n'aura jamais de
rendement réel : c'est volontaire, mais l'écran ne disait pas comment obtenir le chiffre ni ce qu'on
perd à ne pas l'avoir. Sur `/stock/<id>`, le panneau **disparaissait** purement et simplement.

**Une faille rouverte par une commande d'apparence anodine.** `CREATE OR REPLACE VIEW` sans clause
`WITH` remet les options de la vue à zéro : une migration a fait perdre en silence le
`security_invoker` de `client_rentabilite` — exactement la fuite du lot 2, revenue par la porte de
service. Rattrapée. Le test « aucune ligne d'un autre atelier » **ne l'aurait pas détectée**, parce
que la condition de formule masque la fuite. Mesuré en production : une vue nue rend 8 lignes de
2 ateliers, la même vue avec la condition en rend 0. L'ordre réel des protections est : le `GRANT`
d'abord, `security_invoker` ensuite, l'advisor en dernier recours.

### 1.3 Vérifications

- **518 tests verts**, 36 fichiers. 4 ignorés (voir §3.4).
- `tsc --noEmit` propre, `next build` propre, déployé en production.
- Advisors Supabase : plus aucune alerte de niveau *erreur*.
- Vérifié en base : `anon` n'a plus aucun accès à `client_rentabilite`, `poudre_rendement`,
  `projet_revient` ni `subscriptions`.

---

## 2. Ce qui vous appartient, Alexis — par échéance

### Avant le 22 août — le mandat de plateforme agréée

Axonaut est immatriculée PA depuis le 08/01/2026 et l'inclut sans surcoût. Signez le mandat, et
posez par écrit les quatre questions listées dans `PLATEFORMES-AGREEES.md` — dont **l'archivage
probant à dix ans**, qui n'est pas systématiquement couvert et qui vous engage.

### Avant le 12 septembre — les huit tarifs Stripe

L'essai de ThermoTest expire le **12/09/2026** et le paywall est armé sur 32 tables. Sans ces tarifs,
un atelier ne peut pas payer, et rien ne l'en avertit à temps.

Six tarifs de formule, à créer en produit récurrent, devise EUR, **avec la `lookup_key` exacte** :

| lookup_key | Montant HT | Périodicité |
|---|---|---|
| `thermogestion_atelier_mensuel` | 79 € | mensuelle |
| `thermogestion_atelier_annuel` | 790 € | annuelle |
| `thermogestion_equipe_mensuel` | 129 € | mensuelle |
| `thermogestion_equipe_annuel` | 1 290 € | annuelle |
| `thermogestion_certifie_mensuel` | 249 € | mensuelle |
| `thermogestion_certifie_annuel` | 2 490 € | annuelle |

Deux tarifs de siège, **en mode « quantité »** (licensed, pas metered) :

| lookup_key | Montant HT | Périodicité |
|---|---|---|
| `thermogestion_siege_mensuel` | 5 € | mensuelle |
| `thermogestion_siege_annuel` | 50 € | annuelle |

Le code ne contient aucun identifiant `price_…` : tout passe par la `lookup_key`, ce qui vous permet
de changer un tarif dans Stripe sans que je redéploie quoi que ce soit. **Une clé mal orthographiée
est le seul point de rupture** — le checkout répond alors par un message qui nomme la clé manquante.

Puis les trois variables d'environnement sur Vercel : `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. **Collez-les vous-même** — je ne
saisis aucune clé.

### Quand vous voulez, mais ça bloque

- **Acheter `thermogestion.fr`.** Le produit tourne aujourd'hui sur une adresse `vercel.app` : c'est
  ce que voit un prospect, et c'est ce que voit Google.
- **Créer une clé PrestaShop en lecture seule.** `TP_WS_KEY` a des droits d'écriture sur votre
  boutique de production, pour une fonction qui ne fait que lire le catalogue de teintes.
- **Faire relire les trois PDF qualité par un responsable qualité d'atelier certifié.** Une formule à
  249 € repose entièrement dessus, et je ne peux pas garantir qu'un auditeur Qualicoat les acceptera.
- **Confirmer ou supprimer la remise « −20 % Thermopoudre »**, aujourd'hui annoncée sur la page
  tarifs sans qu'aucun mécanisme ne l'applique.
- **Renseigner votre fiche Google** pour les demandes d'avis à J+2.

---

## 3. L'état réel du produit

### 3.1 Ce qui est solide

Le tronc commun — devis, production, stock, suivi, facturation — est complet et éprouvé. Le socle
légal français l'est aussi : Factur-X en PDF/A-3B validé veraPDF, export FEC, mentions obligatoires,
réversibilité tenue sur 38 tables. Le module jantes n'a **aucun équivalent en France**. Et le produit
refuse d'émettre un certificat de conformité sur un dossier dont l'instrument de mesure n'était pas
étalonné : c'est le genre de détail qui sépare un logiciel écrit pour le métier d'un tableur repeint.

### 3.2 Ce qui n'est pas prouvé

- **Aucune recette au clavier depuis le lot 2.** Tout est prouvé par la suite de tests, qui
  s'authentifie réellement contre la production avec un compte ordinaire soumis aux RLS — c'est plus
  fiable que des clics, mais ça ne dit rien du rendu visuel. Les écrans modifiés aujourd'hui n'ont
  pas été vus.
- **Aucune ligne de code Stripe n'est couverte par un test.** Il n'y a ni simulateur Stripe ni test
  de route dans ce projet. Le comportement des trois routes de facturation n'est garanti que par la
  lecture et le typage. C'est le trou de couverture le plus large du produit, et il porte
  précisément sur l'encaissement.
- **Les registres déchets et FDS comptent une ligne chacun.** Ils se génèrent, ils n'ont jamais servi.

### 3.3 Deux réserves de démonstration

**Sept chronomètres de pointage tournent encore**, ouverts le 17/08 sur l'atelier de démonstration.
Ils gonflent le prix de revient à chaque rafraîchissement — le total a bougé de 3 € entre deux
lectures pendant la recette. Un prospect qui compare deux captures verra deux chiffres différents.
Je ne les ai pas fermés : ce sont vos données, dites-moi si je le fais.

**La vérification du verrou de formule a demandé de basculer l'atelier de démonstration en formule
Atelier pendant moins de deux minutes**, puis de le remettre en Certifié. Un visiteur passé sur
`/demo` pendant ce laps de temps a vu une démonstration amputée de sa qualité tracée. Il faudrait un
atelier de recette distinct de l'atelier de démonstration — c'est un chantier d'une demi-journée.

### 3.4 Quatre tests dorment

Les quatre tests qui vérifient qu'un atelier **ne peut pas s'attribuer des sièges lui-même** ont
besoin d'écrire avec la clé `service_role`, absente de `.env.test`. Ils s'annoncent ignorés plutôt
que verts à vide. La propriété a été vérifiée à la main sur la vraie base, dans une transaction
annulée — c'est une preuve, mais pas une preuve rejouable.

Ajoutez `TEST_SUPABASE_SERVICE_ROLE_KEY=` à `.env.test` (fichier déjà exclu de git) et ils tournent.

---

## 4. Ce qui reste à construire, dans l'ordre où je le ferais

**1. Le courriel quotidien à l'atelier.** *Une journée.* C'est la recommandation que je répète depuis
le lot 2 et que rien n'a encore réglée : **le produit n'envoie rien**. Tout attend que l'exploitant
ouvre l'application. Aucun tutoriel ne remplace sept lignes le matin — ce qui arrive aujourd'hui, ce
qui est promis pour aujourd'hui, ce qui est en retard, ce qui manque en stock. C'est le seul chantier
qui change le taux d'usage d'un outil d'atelier, et c'est le moins cher de la liste.

**2. Un atelier de recette distinct de la démonstration.** *Une demi-journée.* Voir §3.3.

**3. Le portail client professionnel.** *Deux à trois jours.* Un donneur d'ordre qui livre trois fois
par semaine veut voir ses dossiers sans appeler. C'est aussi ce qui rend la formule Équipe évidente.

**4. La notification « vos pièces sont prêtes ».** *Deux jours.* SMS ou WhatsApp. C'est le premier
sujet qui remonte des ateliers, avant toute fonction de gestion.

**5. La fiche suiveuse A5.** *Une journée.* Le papier qui accompagne physiquement les pièces. Réclamé
par tous les ateliers, et le seul document du parcours qui manque encore.

**6. Le raccordement de Thermogestion lui-même à une plateforme agréée**, pour l'émission obligatoire
au 1er septembre 2027. Pas urgent, mais à ne pas découvrir en juillet 2027.

---

## 5. Ce que je surveillerais à votre place

**La segmentation reste à valider par le marché, pas par le raisonnement.** Le siège à 5 € règle la
friction de l'embauche, mais il déplace le problème : un atelier de jantes de six personnes paie
désormais 79 + 20 = 99 € et n'a toujours aucune raison de monter en formule. Si la cible jantes se
révèle être votre volume, il faudra une marche qui parle à ce métier — je ne sais pas encore laquelle,
et l'inventer avant d'avoir dix clients serait une erreur.

**Le paywall est armé et le tiroir-caisse est vide.** C'est la seule chose qui peut mal tourner
mécaniquement, à une date connue : le 12 septembre.
