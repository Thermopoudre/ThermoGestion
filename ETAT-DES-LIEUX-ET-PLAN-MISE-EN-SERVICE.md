# Thermogestion — état des lieux complet et plan de mise en service

*13 août 2026 — inventaire fonctionnalité par fonctionnalité, confronté au blueprint du 5 juillet.*

---

## Le constat en une phrase

Le produit est à peu près complet **fonctionnellement**, mais il lui manque la brique qui transforme un logiciel en business : **il est aujourd'hui impossible de payer un abonnement Thermogestion**. La table `subscriptions` existe, le bandeau d'essai compte les jours, la page Tarifs affiche 59 € et 89 € — mais aucun code ne prend d'argent. Le jour où un essai de 30 jours arrive à terme, il ne se passe rien.

C'est le point à traiter en premier, avant toute nouvelle fonctionnalité métier.

---

## 1. Ce qui est construit et fonctionne

### Devis
Clients avec fiche complète, éditeur de devis, calcul au m² par grille (paliers de surface × coefficients de finition et de complexité, forfait minimum), catalogue de prestations à prix fixe, remise globale, autosave toutes les 2,5 secondes. Lien public sans compte, signature au doigt sur mobile avec horodatage et adresse IP. Numérotation séquentielle par atelier et par année, sans risque de collision. Devis signé → projet créé automatiquement par déclencheur en base.

### Production
Projets avec workflow d'étapes configurable par atelier, vue kanban, QR code par projet avec écran de confirmation avant validation d'étape, photos avant/après stockées dans un bucket privé cloisonné par atelier, date promise avec alerte de retard, historique des projets livrés, page publique de suivi pour le client.

### Stock poudres
Fiches poudres avec RAL, finition, paramètres de cuisson, prix au kilo et rendement au m². Décrément automatique à la cuisson, calculé depuis la surface du projet. Pesées de recalage, seuil d'alerte par teinte, traçabilité du numéro de lot et du fournisseur à la réception. Bouton de réapprovisionnement vers thermopoudre.fr.

### Factures
Création depuis un devis signé ou en autonome, quatre types dont l'avoir, émission avec numérotation, lien public de paiement, encaissement en ligne par Stripe Connect, enregistrement des paiements manuels, relances automatiques quotidiennes. Toutes les mentions légales obligatoires, y compris les quatre nouvelles de la facturation électronique.

### Socle
Multi-utilisateurs avec invitations et rôles, cloisonnement strict par atelier vérifié en base, personnalisation couleur et logo répercutée sur les pages client, PWA installable, site vitrine complet avec tarifs et FAQ, pages légales, analytics maison, file de notifications traitée toutes les cinq minutes, réinitialisation de mot de passe.

---

## 2. Les manques, par ordre d'urgence

### 🔴 Bloquant commercial — sans ça, aucun revenu

**Encaisser l'abonnement.** Il n'existe aucun parcours de paiement pour Thermogestion lui-même. Il faut : les produits et tarifs Stripe (59 et 89 par mois, 590 et 890 par an), une page d'abonnement dans les Réglages, le tunnel Stripe Checkout, le portail client Stripe pour changer de carte ou résilier, le webhook qui met `subscriptions` à jour, et surtout **la logique de fin d'essai** — que se passe-t-il au 31e jour ? Aujourd'hui : rien. Il faut décider et implémenter le blocage en lecture seule.

**La remise clients Thermopoudre.** La vitrine annonce « −20 % à vie ». Ce chiffre a été posé par moi en juillet, tu ne l'as jamais validé, et rien ne l'applique dans le code. Soit on l'implémente avec un code promo Stripe, soit on retire la promesse.

### 🟠 Bloquant crédibilité — indispensable avant de démarcher

**Un vrai PDF.** Aujourd'hui, « Imprimer / PDF » ouvre la boîte d'impression du navigateur. Le rendu dépend du navigateur, la pagination est aléatoire, l'en-tête et le pied de page du navigateur s'impriment. Pour un document qui engage juridiquement, il faut un PDF généré côté serveur, identique partout, joint aux emails et archivé.

**Le domaine.** `thermogestion-v2.vercel.app` est acceptable pour tester, pas pour facturer 89 € par mois. C'est aussi ce qui débloque une adresse d'envoi propre et le référencement.

**Un compte de démonstration.** Le jeu de démo existe en base mais aucun parcours ne le rend accessible depuis la vitrine. Un prospect ne peut pas voir le produit sans créer un compte — c'est le principal frein à l'inscription sur ce type d'outil.

**Onboarding guidé après inscription.** L'atelier arrive sur un tableau de bord vide, sans savoir par où commencer. Il faut une liste de démarrage : créer un client, faire un devis, l'envoyer. C'est là que se joue l'activation, donc la conversion de l'essai.

### 🟡 Prévu au blueprint, jamais fait

**L'italien.** Décidé « dès le jour 1 », jamais commencé : toutes les chaînes sont en dur en français. Plus on attend, plus l'extraction coûte cher. Vu que tu vends déjà en Italie, c'est un marché accessible.

**L'intégration Thermopoudre au-delà du lien.** Le bouton de réappro fait une recherche par mot-clé sur le site. Le blueprint prévoyait un vrai chaînage : recherche du catalogue depuis Thermogestion, import d'une fiche poudre en un clic avec RAL, fiche technique et paramètres de cuisson pré-remplis, puis commande directe au compte pro. C'est ton fossé concurrentiel, et il est encore à l'état d'esquisse.

**Emails d'onboarding.** Aucune séquence après l'inscription. Sur un essai de 30 jours sans carte, c'est ce qui fait la différence entre un compte activé et un compte oublié.

### 🟢 Différenciateurs métier — ton avantage réel, absent de la vitrine

Le laquage de jantes est ton terrain, et Thermogestion en parle à peine. Ce qui existe déjà en base mais ne se voit pas : la teinte constructeur d'origine, les prestations de dévoilage, redressage et CNC diamant, la traçabilité du lot de poudre. Ce qui n'existe pas encore et te distinguerait vraiment : le **planificateur de fournée** (regrouper les projets d'une même teinte pour remplir le four — c'est le vrai levier de rentabilité d'un atelier), le **certificat de conformité** généré automatiquement, et le **contrôle qualité** avec mesures d'épaisseur.

---

## 3. Plan de mise en service proposé

**Lot A — encaisser (le plus urgent).** Stripe Billing complet, fin d'essai, arbitrage sur la remise Thermopoudre. Sans ce lot, tout le reste est du travail non monétisable.

**Lot B — présentable.** PDF serveur, domaine, compte de démonstration accessible depuis la vitrine, checklist de démarrage dans l'app.

**Lot C — activer.** Séquence d'emails d'onboarding, relances d'essai, et mise en avant des différenciateurs jantes sur la vitrine.

**Lot D — creuser le fossé.** Catalogue Thermopoudre intégré, import de fiche poudre en un clic, puis commande directe.

**Lot E — élargir.** Italien, planificateur de fournée, certificat de conformité, contrôle qualité.

Les lots A et B conditionnent le lancement. C et D font la croissance. E ouvre de nouveaux marchés.

---

## 4. Deux questions qui ne sont pas techniques

**Que se passe-t-il au 31e jour ?** Blocage sec en lecture seule, période de grâce, ou dégradation vers un plan gratuit limité ? Ça change le code et le discours commercial.

**La remise Thermopoudre : combien, et comment la vérifier ?** −20 % à vie sur un abonnement à 89 €, c'est 214 € par an et par atelier. Il faut décider du montant, et surtout comment on constate qu'un atelier est « client Thermopoudre actif » — rapprochement manuel au départ, ou lecture automatique du CRM.
