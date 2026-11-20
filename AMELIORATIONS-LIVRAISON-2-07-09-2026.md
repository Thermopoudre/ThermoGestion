# Améliorations 2, 3, 4 et 8 — livrées le 7 septembre 2026

Les quatre améliorations restantes de `AMELIORATIONS-07-09-2026.md`, développées, testées et déployées. Migrations **71 à 75b**. Avec les six précédentes (`AMELIORATIONS-LIVRAISON-07-09-2026.md`), **les dix améliorations du document sont livrées**.

## N° 2 — Blocage de la capacité du four

Le seul point du corpus qui touche à la sécurité physique de l'atelier. Une fournée à 142 % de la capacité du four affichait une barre rouge à côté d'un bouton « Lancer » parfaitement actif.

**Le blocage vit dans un déclencheur, pas dans une RPC** — et c'est le point important. Il n'existait aucune RPC de lancement : l'écran faisait un `update` direct sur la table. Une RPC posée à côté n'aurait rien fermé, puisqu'on pouvait continuer d'appeler `update` depuis la console du navigateur. `trg_fournee_capacite` compare la surface embarquée à la capacité déclarée **au moment précis** où le statut passe à « en cours », et refuse.

**La dérogation est tracée par la base, pas par le client** : `auth.uid()`, l'horodatage et l'écart en m² sont posés par le déclencheur lui-même, jamais recopiés depuis ce que le navigateur envoie — une trace que l'appelant pourrait forger ne vaudrait rien. Une écriture ultérieure sans rapport (une note, la clôture) ne peut pas l'effacer.

Le message dit les deux surfaces et invite à corriger la fiche du four si le dépassement est systématique. Si la capacité n'est pas renseignée, rien n'est bloqué — on ne peut pas comparer à une valeur absente — et l'écran le dit. La clôture d'une fournée déjà lancée n'est jamais bloquée.

**Angle mort signalé, non corrigé** : rien n'empêche encore, en base, d'ajouter un projet à une fournée déjà lancée. Seul l'écran l'interdit. Hors du périmètre demandé, à traiter un jour.

## N° 3 — Devis expirés hors du chiffre « en attente »

DV-2026-0016 était expiré depuis le 24 août et comptait toujours dans « 2 devis en attente · 6 251,18 € » — le chiffre-phare du tableau de bord.

Corrigé aux **trois** endroits qui faisaient ce comptage, tous en réutilisant `devis_perime()` et son miroir TypeScript, sans jamais réécrire une seconde définition d'« expiré » : le tableau de bord, le courriel du matin (`recap_quotidien_payload`), et l'outil `devis_sans_reponse` de l'assistant — dont la description **promettait déjà** « non expirés » sans le vérifier.

Le tableau de bord montre désormais **les deux chiffres** : le pipeline chaud, et « + N expiré(s), X € à relancer autrement ». Un devis expiré n'est pas mort, il se relance ; le cacher aurait été une autre façon de mentir.

Endroits laissés tels quels, avec leur raison : `chiffres_du_mois()` (ne compte pas de devis), la liste `/devis` (chaque ligne porte déjà son badge), `/pilotage` (aucun comptage de devis), `/commandes` (statut « envoyée » d'une commande de poudre, sans rapport).

## N° 4 — Jeu de démonstration

Ce qu'on venait de construire pour vendre le produit ne se voyait nulle part : zéro devis avec acompte sur quatorze, `users_couts` vide, aucun devis signé chez un particulier, un seul bon de livraison.

Ajouté, dans le seul atelier de démonstration : DV-2026-0018 avec acompte de 30 % **et sa facture d'acompte** FA-2026-0033 (923,40 €, déduite au centime sur le solde) ; DV-2026-0019 signé hors établissement chez un particulier, qui fait enfin apparaître la mention de rétractation et le nom du médiateur ; un taux horaire personnel de 42 €/h, avec le rattachement des temps pointés sans lequel il n'aurait rien changé ; trois bons de livraison aux statuts intermédiaires, pour que les quatre onglets aient du contenu ; et un dossier de jantes issu d'un devis, cas que la recette précédente n'avait pas pu vérifier.

**Deux anomalies préexistantes corrigées au passage** : les deux réceptions de la démonstration s'appelaient `RC-2026-0018` et `RC-2026-0019` — un préfixe que le moteur de numérotation ne produit jamais (il génère `RE-`), et des rangs recopiés de la série des devis. Elles dataient du 18 août : le semis d'aujourd'hui n'y était pour rien. Renumérotées `RE-2026-0001` et `RE-2026-0002`, compteur posé.

## N° 8 — Préremplissage de la fiche jante

Le devis demandait teinte, diamètre, dessin et finition ; la fiche jantes les redemandait à la réception. Double saisie sur le geste le plus fréquent du métier.

**La table de correspondance a été établie champ par champ, et deux reprises ont été refusées** : le prix (recalculé au barème du jour — le figer romprait le principe de prix indicatif déjà en place), et surtout `teinte_reference`, un faux ami. Sur un devis c'est la teinte à appliquer ; sur une fiche jantes, `teinte_reference` est le code constructeur du véhicule, une colonne d'une autre table. Les reprendre l'une pour l'autre aurait produit une erreur silencieuse et plausible — le pire genre.

Le préremplissage n'écrase jamais une saisie déjà faite (« Des caractéristiques sont déjà saisies : rien n'a été modifié »), et une ligne déjà rattachée à un dossier n'est plus proposée — `jeux_jantes.devis_id` n'a pas de contrainte d'unicité, la reproposer créerait un second dossier pour la même jante reçue.

**Un manque trouvé par la recette et comblé** : le chemin inverse existait sans être visible. Quand les jantes arrivent d'abord et qu'on chiffre ensuite, le devis portait le lien vers son dossier sans jamais l'afficher — on allait du dossier au devis, jamais l'inverse. Un bouton « Voir le jeu de jantes » a été ajouté.

## Deux enseignements de méthode

**Un jeu de démonstration incomplet fait conclure à un bug.** La recette a d'abord jugé le n° 8 « non branché » : le seul devis de jantes de la démonstration avait déjà son dossier, donc le bouton se masquait — correctement. Le code était juste, la donnée manquait. Un devis signé avec des jantes non encore reçues a été ajouté.

**Le 503 n'existait pas.** Trois requêtes de comptage étaient rapportées en 503 sur toutes les pages, deux recettes de suite. Vérification faite : l'outil de lecture réseau rapporte mal les requêtes HTTP HEAD. Deux mesures indépendantes dans le navigateur (le statut du `fetch` et l'API Performance) donnent 200, et l'en-tête `content-range` renvoie le bon compte. Aucun correctif n'était nécessaire — il s'en est fallu de peu qu'on répare quelque chose qui fonctionnait.

## Réserves

- La signature d'un devis inséré directement en base ne crée pas de projet : le déclencheur ne réagit qu'à une mise à jour. Contourné dans le semis en rejouant la signature ; à savoir pour tout futur jeu de données.
- La finition « satinée » n'existe que dans le texte libre d'un devis, pas dans le menu déroulant (Teinte unie / Teinte + vernis / Bicolore / Diamantée). Le préremplissage est fidèle à la donnée structurée ; si « satiné » doit devenir un vrai choix, c'est le modèle qu'il faut changer.
- `fournees.derogation_par` n'a pas d'index couvrant sa clé étrangère — sans effet à la volumétrie actuelle.
