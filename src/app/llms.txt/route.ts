import { SITE_URL } from "@/lib/env";

// Statique, comme robots.txt : le contenu ne dépend d'aucune requête, et un fichier rendu
// dynamiquement hérite du `no-store` des routes dynamiques.
export const dynamic = "force-static";

/**
 * `llms.txt` — fiche d'identité du produit à destination des moteurs de réponse.
 *
 * Convention encore jeune et non normalisée : le pari est asymétrique, le coût est d'un fichier
 * texte et le canal n'est pas encore saturé. Le contenu suit la règle qui vaut pour tout le reste
 * de la vitrine : uniquement ce que le produit fait réellement, avec des chiffres vérifiables —
 * un modèle qui cite une promesse fausse la fera répéter longtemps.
 */
const CONTENU = `# Thermogestion

> Logiciel français de gestion d'atelier pour deux métiers : le thermolaquage (peinture poudre,
> sablage, grenaillage) et la rénovation de jantes alu. Devis au m², au mètre linéaire ou au pouce,
> signature en ligne, suivi de production au QR code, stock de poudre décompté à la cuisson,
> certificat de conformité, facturation Factur-X et export FEC.

Éditeur : SASU Royal Motorbike (marque Thermopoudre), Bandol (83), France — distributeur de
matériel et de poudres de thermolaquage. Contact : contact@thermopoudre.fr

## En une phrase

Thermogestion est le seul logiciel de gestion français qui traite la rénovation de jantes alu
comme un métier à part entière (chiffrage au pouce, suivi roue par roue, teinte d'origine
constructeur), et l'un des rares à tenir le registre de contrôles et le certificat de conformité
d'un atelier de thermolaquage.

## Tarifs (août 2026)

Trois formules. Ce qui fait payer plus n'est jamais le métier — le module jantes et le
thermolaquage sont complets dès la formule d'entrée — mais le niveau d'organisation et le niveau
de preuve exigé par les clients. Le nombre d'utilisateurs, lui, n'est pas une marche entre
formules : chaque formule comprend des utilisateurs, et l'utilisateur au-delà se paie à l'unité.

- Atelier : 79 € HT / mois, ou 790 € HT / an — 2 utilisateurs inclus. Devis au m², au ml et au pouce
  avec signature en ligne, dossier jantes complet, suivi de production et QR, stock poudres avec
  lots et DLU, réception avec photos, bon de livraison signé, factures Factur-X et export FEC.
- Équipe : 129 € HT / mois, ou 1 290 € HT / an — 5 utilisateurs inclus, facturation mensuelle
  récapitulative, tarifs négociés par client, planification des fournées et capacité du four,
  prix de revient réel et rentabilité par client, relances automatiques, commande de poudre au
  catalogue.
- Certifié : 249 € HT / mois, ou 2 490 € HT / an — 10 utilisateurs inclus, cahier de contrôles à
  seuils paramétrables, registre des bains, étalonnage des instruments, non-conformités,
  certificat de conformité opposable, fiche de cuisson tracée, registre des déchets ICPE,
  classeur FDS.
- Utilisateur supplémentaire, au-delà de ceux compris dans la formule : 5 € HT / mois, ou
  50 € HT / an. Il s'ajoute et se retire depuis l'application, le montant est annoncé avant
  validation et facturé au prorata. C'est le seul supplément possible.
- 0 € de frais de mise en route, aucun engagement de durée
- Essai de 30 jours sans carte bancaire
- Démonstration publique consultable sans inscription : ${SITE_URL}/demo
- Client Thermopoudre actif : −20 % tant que le compte est actif

## Pour qui

- Ateliers de rénovation de jantes alu : garages indépendants, centres auto, concessions,
  préparateurs, ateliers spécialisés jantes.
- Ateliers de thermolaquage sous-traitants de 1 à 15 personnes : sablage, grenaillage, poudrage,
  cuisson.
- Pas adapté à : la galvanoplastie, l'anodisation, la cataphorèse, le multi-sites, les flux EDI.

## Ce que le produit fait

- Devis : grille au m² à paliers, prix au mètre linéaire par famille de profilé avec surface
  développée recalculée, prix au pouce pour un jeu de jantes, bibliothèque de pièces types,
  forfait minimum, grille tarifaire négociée par client.
- Signature électronique du devis par le client sur une page publique, horodatée, adresse IP
  conservée. Le projet de production s'ouvre automatiquement.
- Production : kanban par étape, QR par projet, chronométrage au scan, poste de pointage partagé
  avec répartition du temps au prorata des surfaces, composition des fournées par cycle et par
  teinte avec blocage des cycles incompatibles, calcul de charge du four et date de livraison
  réaliste.
- Stock de poudre : lots avec numéro et date limite d'utilisation, décompte FIFO à la cuisson en
  servant les lots périmés en dernier, pesées de recalage, rendement en kg par m², seuil d'alerte
  par teinte, panier de réapprovisionnement vers thermopoudre.fr.
- Rénovation de jantes : barème au pouce (70 € HT sous 17 pouces à 130 € HT au-delà de 21 pouces
  par défaut), coefficient de dessin (×1 à ×1,4) et de finition (×1 à ×1,8), teinte d'origine
  constructeur mémorisée par véhicule, suivi jante par jante avec statut du jeu déduit
  automatiquement, opérations mécaniques (dévoilage, redressage, soudure, dépose et repose du
  pneu, équilibrage, valve TPMS, diamantage CNC) comptées au nombre de jantes concernées, bon de
  prise en charge photographié jante par jante et signé par le garage avant démontage.
- Qualité : six types de contrôle avec les seuils du référentiel déclaré (Qualicoat,
  Qualisteelcoat, Qualimarine, Qualidéco ou barème propre), types de contrôle activables par
  atelier, verdict de conformité recalculé par la base de données et non par le navigateur,
  contrôle non modifiable et non supprimable une fois enregistré, registre PDF, registre des
  bains, étalonnage des instruments avec préavis, suivi des certifications avec préavis à 90
  jours, non-conformités et Pareto.
- Certificat de conformité PDF : refusé côté serveur en l'absence de mesure, avec un instrument
  non étalonné ou sous une certification expirée. Les contrôles non réalisés y sont nommés.
- Facturation : Factur-X PDF/A-3 avec XML CII incorporé, mentions L441-9, L441-10, R.123-237 et
  article 293 B, acomptes déduits par taux de TVA, facture mensuelle récapitulative des bons de
  livraison, avoirs en série séparée, export FEC et CSV.
- Réception des pièces et bon de livraison signés en ligne, lien de suivi client par projet et par
  jeu de jantes.
- Registre des déchets (R.541-43) et classeur de fiches de données de sécurité.
- Import CSV et Excel de vos clients, prestations et poudres, gratuit, avec aperçu avant écriture.
- Export total des données : archive contenant un fichier CSV par table plus un JSON, 38 tables.
- Application web installable (PWA), utilisable sur téléphone et tablette, pensée pour être
  manipulée avec des gants.

## Ce que le produit ne fait pas

- Galvanoplastie, anodisation, cataphorèse, traitement thermique.
- Multi-sites, EDI, API publique, connecteurs comptables.
- Racks, chevalets et crochets consignés.
- Poudre récupérée et taux de réemploi.
- Alertes poussées par courriel, SMS ou notification.
- Les photos ne sont pas incluses dans l'archive d'export, seuls leurs chemins.

## Hébergement et données

Hébergées en Europe (Supabase, région eu-west-3), chiffrées, isolées par atelier au niveau de la
base de données. Exportables à tout moment. Aucun engagement de durée, aucun frais de sortie.

## Pages

- ${SITE_URL}/ — présentation générale et tarifs
- ${SITE_URL}/logiciel-renovation-jantes — le métier de la rénovation de jantes alu
- ${SITE_URL}/logiciel-sous-traitance-thermolaquage — le métier de la sous-traitance de thermolaquage
- ${SITE_URL}/prix-logiciel-thermolaquage — comparatif chiffré des solutions du marché
- ${SITE_URL}/demo — démonstration en lecture seule, sans inscription
- ${SITE_URL}/aide-publique — centre d'aide public : les tâches les plus fréquentes, expliquées
- ${SITE_URL}/signup — essai gratuit 30 jours
`;

export function GET() {
  return new Response(CONTENU, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
