import type { Capacite } from "@/lib/abonnement";

/**
 * Les contenus d'aide.
 *
 * Règle d'écriture, tenue partout dans ce fichier : **on n'explique pas le logiciel, on explique
 * le métier.** « Cliquez sur Enregistrer » n'apprend rien à personne ; « le verdict d'épaisseur se
 * joue sur le point le plus mince, parce que c'est là que la corrosion commence » apprend le
 * métier et, accessoirement, fait comprendre l'écran. Un exploitant qui lit une phrase et
 * reconnaît son atelier dedans continue à lire.
 *
 * Rien ici n'est stocké en base : ce sont des textes, ils vivent avec le code et se relisent en
 * revue comme le reste.
 */

// ── Explications de première visite ──────────────────────────────────────────

export type Astuce = {
  /** Clé stable enregistrée dans `users.aides_vues` : ne jamais la renommer, elle réafficherait l'astuce. */
  cle: string;
  titre: string;
  texte: string;
  /** Lien facultatif vers le tutoriel qui va plus loin. */
  tutoriel?: string;
  /**
   * Amélioration n°10 (07/09/2026) — aiguillage explicite entre les deux circuits de réception
   * (générique `/receptions` et jantes `/jantes`), au lieu de les fusionner : ni l'un ni l'autre
   * circuit n'est modifié, seule l'explication à l'écran change. Facultatif : seules `jantes` et
   * `receptions` en portent un, chacun pointant vers l'autre écran.
   */
  lienCroise?: { href: string; libelle: string };
};

export const ASTUCES: Record<string, Astuce> = {
  dashboard: {
    cle: "dashboard",
    titre: "Ce que vous regardez le matin",
    texte:
      "Cet écran ne sert pas à consulter : il sert à savoir par quoi commencer. Ce qui est en retard passe devant, la date promise devient rouge avant qu'elle ne soit dépassée, et les poudres en fin de vie remontent avant d'être périmées. Si tout est vide, c'est que rien n'est en cours — pas que le logiciel n'a rien vu.",
    tutoriel: "premier-devis",
  },
  devis: {
    cle: "devis",
    titre: "Un devis se chiffre, il ne se tape pas",
    texte:
      "Vous ne saisissez pas un prix : vous saisissez une surface, une finition et une complexité, et votre grille fait le prix. C'est ce qui permet de répondre à un client au téléphone sans se tromper, et de ne pas facturer deux prix différents la même pièce à deux mois d'écart. Le forfait minimum se déclenche seul quand la pièce est trop petite pour être rentable.",
    tutoriel: "premier-devis",
  },
  projets: {
    cle: "projets",
    titre: "Le tableau, c'est l'atelier",
    texte:
      "Chaque colonne est un poste réel : préparation, poudrage, cuisson, contrôle. Une pièce avance quand quelqu'un l'a physiquement avancée, pas quand on l'a décidé au bureau. C'est pour ça que l'étape se valide au scan du QR, gants aux mains, devant la pièce — et que le chronomètre part et s'arrête tout seul.",
    tutoriel: "lancer-fournee",
  },
  jantes: {
    cle: "jantes",
    titre: "Le litige se joue à la réception, pas à la livraison",
    texte:
      "Un jeu de jantes arrive presque toujours avec un défaut que le client n'a pas vu : un voile, une jante déjà réparée, un diamantage piqué. Photographiez roue par roue et faites signer avant de démonter. Trois semaines plus tard, « cette jante était déjà voilée » n'est plus une discussion, c'est une photo horodatée et une signature. Ce dossier ne sert qu'aux jantes : portail, mobilier ou pièce de menuiserie se réceptionnent depuis Réceptions.",
    tutoriel: "receptionner-jantes",
    lienCroise: { href: "/receptions", libelle: "Ce dépôt ne concerne pas des jantes ? → ouvrir les réceptions" },
  },
  receptions: {
    cle: "receptions",
    titre: "Ce que vous avez reçu, et dans quel état",
    texte:
      "La réception n'est pas de l'administratif : c'est la seule preuve de l'état des pièces au moment où elles sont entrées chez vous. Une photo prise sur le quai coûte dix secondes ; une reprise gratuite parce qu'on ne peut pas prouver l'état d'origine coûte une journée d'atelier. Un jeu de jantes a son propre dossier — roue par roue, avec bon de prise en charge — plutôt qu'une réception ici.",
    tutoriel: "receptionner-jantes",
    lienCroise: { href: "/jantes", libelle: "Ce dépôt concerne un jeu de jantes ? → ouvrir le dossier jantes" },
  },
  fournees: {
    cle: "fournees",
    titre: "Une fournée se remplit, elle ne se subit pas",
    texte:
      "Un four qui part à moitié plein coûte le même gaz qu'un four plein. On groupe donc par teinte et par cycle : deux poudres qui n'ont pas le même barème de cuisson ne partent jamais ensemble, et le logiciel refuse de les mettre dans la même fournée plutôt que de vous laisser cuire un lot à 180 °C qui en demandait 200.",
    tutoriel: "lancer-fournee",
  },
  qualite: {
    cle: "qualite",
    titre: "Ce que l'auditeur va vous demander",
    texte:
      "Un référentiel — Qualicoat, Qualisteelcoat, Qualimarine, Qualidéco — ne demande pas que vous mesuriez : il demande que vous puissiez montrer que vous avez mesuré, avec quel instrument, étalonné quand, et selon quels seuils. C'est ce que tient cet écran. Un contrôle enregistré ne peut plus être ni modifié ni supprimé : c'est ce qui lui donne sa valeur.",
    tutoriel: "sortir-certificat",
  },
  stock: {
    cle: "stock",
    titre: "La poudre se périme, et ça se voit à la cuisson",
    texte:
      "Une poudre au-delà de sa DLU ne se voit pas dans le carton : elle se voit en peau d'orange après cuisson, et c'est trop tard. Le stock sort donc au plus proche de la péremption d'abord, et le lot sorti reste attaché à la pièce — ce qui permet, six mois plus tard, de remonter d'une réclamation client jusqu'au numéro de lot du fournisseur.",
  },
  factures: {
    cle: "factures",
    titre: "Facturer une fois, au bon prix",
    texte:
      "Un bon de livraison signé ne peut être facturé qu'une seule fois : la base refuse le second. Et la remise contractuelle de votre client suit le devis, le bon, puis la facture, sans que personne ait à s'en souvenir le 31 du mois. Vos factures partent en Factur-X, le format que l'administration imposera à tous.",
    tutoriel: "facturer-le-mois",
  },
  pilotage: {
    cle: "pilotage",
    titre: "Le client qui vous coûte de l'argent",
    texte:
      "Dans presque tous les ateliers, un ou deux clients sont en marge négative sans que personne le sache : petites séries, teintes spéciales, retouches offertes. Cet écran les nomme. Le prix de revient compte la poudre au prix du lot réellement sorti, les heures réellement pointées, l'énergie du four au prorata et vos frais généraux.",
  },
  reglages: {
    cle: "reglages",
    titre: "Réglez d'abord la grille, le reste suit",
    texte:
      "Tout le chiffrage part d'ici : vos paliers de surface, vos coefficients de finition et de complexité, votre forfait minimum. Un atelier qui prend dix minutes pour poser sa grille chiffre ensuite un devis en deux minutes ; un atelier qui saute cette étape ressaisit un prix à la main à chaque fois, et se trompe.",
    tutoriel: "premier-devis",
  },
};

// ── Centre d'aide ────────────────────────────────────────────────────────────

export type Etape = { titre: string; texte: string };

export type Tutoriel = {
  slug: string;
  titre: string;
  /** La tâche réelle, dite comme l'exploitant la dirait. */
  resume: string;
  /** Public visé, pour que personne ne lise un tutoriel qui ne le concerne pas. */
  pour: "jantes" | "industrie" | "tous";
  /** Formule nécessaire, s'il y en a une. */
  capacite?: Capacite;
  duree: string;
  etapes: Etape[];
  /** Ce que les ateliers ratent, écrit franchement. */
  pieges: string[];
};

export const TUTORIELS: Tutoriel[] = [
  {
    slug: "premier-devis",
    titre: "Faire son premier devis",
    resume: "Chiffrer une pièce, l'envoyer, et la faire signer depuis le téléphone du client.",
    pour: "tous",
    duree: "10 minutes",
    etapes: [
      {
        titre: "Posez votre grille avant tout le reste",
        texte:
          "Un atelier ne vend pas un prix au mètre carré, il vend un prix par tranche de surface : une pièce de 0,4 m² coûte beaucoup plus cher au m² qu'un portail de 12 m², parce que le temps d'accrochage et de décrochage est le même. Les paliers sont là pour ça. Réglez-les avec vos vrais prix, pas avec ceux d'un confrère : c'est le seul réglage du produit qui ne peut pas être deviné à votre place.",
      },
      {
        titre: "Ajoutez le coefficient de complexité",
        texte:
          "Une tôle plate et un garde-corps à barreaux ne se poudrent pas au même rythme. Le coefficient traduit ce que votre œil sait déjà : ×1 pour du simple, ×1,2 pour du moyen, ×1,45 pour du compliqué. Réglez-le une fois, il s'appliquera à tous vos devis.",
      },
      {
        titre: "Fixez votre forfait minimum",
        texte:
          "En dessous d'un certain montant, une commande vous coûte plus cher qu'elle ne rapporte : il faut sortir la poudre, préparer le four, décrocher, emballer. Le forfait minimum relève le total à ce plancher, et il apparaît en ligne explicite sur le devis — le client voit pourquoi il paie 50 € pour une pièce à 13 €, et ça se discute très bien au téléphone.",
      },
      {
        titre: "Chiffrez la pièce",
        texte:
          "Surface, finition, complexité, nombre de couches. Si vous travaillez au mètre linéaire — garde-corps, portails, tubes — utilisez le bouton dédié : vous saisissez des mètres, le logiciel convertit en surface développée pour la consommation de poudre et la charge du four, mais facture bien au mètre.",
      },
      {
        titre: "Envoyez et laissez signer",
        texte:
          "Le client reçoit un lien. Il signe au doigt sur son téléphone, sans compte et sans application. À la seconde où il signe, le chantier existe dans votre atelier : le projet est créé, il apparaît dans la colonne de départ, et le devis ne peut plus être modifié — ce qui est précisément ce qui lui donne sa valeur juridique.",
      },
    ],
    pieges: [
      "Ne créez pas votre grille « pour voir » avec des prix ronds : vous ne la corrigerez jamais, et tous vos devis en hériteront.",
      "Un devis en brouillon n'est pas un devis envoyé. Tant qu'il est en brouillon, le client n'a rien reçu et rien ne se relance.",
      "Le prix négocié d'un client sous contrat prime toujours sur la grille. Si un montant vous surprend, regardez d'abord la fiche du client.",
    ],
  },
  {
    slug: "receptionner-jantes",
    titre: "Réceptionner un jeu de jantes",
    resume: "Prendre en charge quatre roues sans se laisser mettre un litige sur le dos.",
    pour: "jantes",
    duree: "5 minutes par jeu",
    etapes: [
      {
        titre: "Partez du véhicule, pas de la jante",
        texte:
          "Immatriculation, marque, modèle. C'est ce qui vous permettra de retrouver la teinte d'origine du constructeur — et c'est ce que le client vous dira au téléphone : il ne connaît pas la référence de ses jantes, il connaît sa voiture.",
      },
      {
        titre: "Notez l'état roue par roue, avant de démonter",
        texte:
          "Rayures, choc de trottoir, corrosion, voile, fissure, diamantage piqué. Les états sont cumulables parce qu'une jante l'est : une roue peut être rayée ET voilée. C'est la case « voile » qui vous évitera la conversation la plus désagréable du métier, celle où le client découvre au montage que sa voiture vibre à 110 km/h et vous l'attribue.",
      },
      {
        titre: "Photographiez",
        texte:
          "Une photo par jante, prise sur le quai, avant tout démontage. Ce n'est pas de la paperasse : c'est la seule chose qui fera la différence si le client conteste. Dix secondes par roue.",
      },
      {
        titre: "Faites signer le bon de prise en charge",
        texte:
          "Le garage ou le particulier signe sur votre téléphone. La signature est horodatée et l'adresse IP conservée. Ce document dit ce que vous avez reçu et dans quel état : il ferme la discussion avant qu'elle n'ait lieu.",
      },
      {
        titre: "Chiffrez au pouce",
        texte:
          "Un jeu se chiffre au diamètre, pas à la surface : 17 pouces, 19 pouces, 21 pouces. Puis on applique le dessin (une multibranches fine prend beaucoup plus de temps qu'une jante pleine) et la finition (unie, vernis, bicolore, diamantée, chrome-effet). Les opérations mécaniques — dévoilage, soudure, valve TPMS, équilibrage — se comptent à la jante et s'ajoutent.",
      },
    ],
    pieges: [
      "Ne saisissez jamais un jeu « pour aller vite » sans les états : c'est exactement le jeu qui reviendra en litige.",
      "Une jante diamantée dont le vernis est percé ne se répare pas comme une autre : il faut repasser au tour. Cochez « diamantage piqué », le chiffrage en tiendra compte.",
      "La roue de secours compte. Un jeu de cinq, ce n'est pas un jeu de quatre.",
    ],
  },
  {
    slug: "lancer-fournee",
    titre: "Lancer une fournée",
    resume: "Remplir le four sans mélanger deux cycles de cuisson incompatibles.",
    pour: "industrie",
    capacite: "fournees",
    duree: "5 minutes",
    etapes: [
      {
        titre: "Groupez par teinte",
        texte:
          "Changer de teinte, c'est purger la cabine, changer le carton, souffler le pistolet : vingt minutes qui ne se facturent à personne. Le logiciel vous propose donc d'abord les pièces qui attendent la même poudre que celle que vous venez de charger.",
      },
      {
        titre: "Vérifiez le cycle",
        texte:
          "Deux poudres qui n'ont pas le même barème de cuisson ne partent jamais ensemble : l'une sortira sous-polymérisée, l'autre jaunie. Le logiciel bloque net et ne se contente pas d'avertir. Deux pièces de la même poudre, elles, sont toujours compatibles, même si personne n'a renseigné le cycle.",
      },
      {
        titre: "Remplissez",
        texte:
          "La jauge affiche la surface chargée par rapport à la capacité de votre four. Un four à moitié plein consomme presque autant qu'un four plein : c'est la ligne de coût la plus facile à améliorer dans un atelier, et personne ne la regarde.",
      },
      {
        titre: "Relevez la température réelle",
        texte:
          "La consigne est ce que vous avez demandé, le relevé est ce que le four a fait. L'écart entre les deux est la seule information intéressante : c'est lui qui explique une adhérence ratée trois semaines plus tard, et c'est lui que l'auditeur regarde.",
      },
    ],
    pieges: [
      "Ne clôturez pas une fournée sans relevé de température : la fiche de cuisson sortira, mais elle n'attestera rien.",
      "L'opérateur enregistré est celui qui a appuyé sur « Lancer ». Si c'est l'apprenti qui appuie et le chef qui surveille, le document dira l'apprenti.",
    ],
  },
  {
    slug: "sortir-certificat",
    titre: "Sortir un certificat de conformité",
    resume: "Produire la pièce que votre donneur d'ordre joint à son propre dossier.",
    pour: "industrie",
    capacite: "certificat",
    duree: "2 minutes, si les contrôles ont été faits",
    etapes: [
      {
        titre: "Comprenez ce qu'un certificat engage",
        texte:
          "Ce document dit : cette pièce a été traitée selon ce référentiel, mesurée avec cet instrument, et voici les valeurs. Il vous engage. C'est pour ça que Thermogestion refuse de l'imprimer quand une mesure manque, plutôt que de sortir un beau papier qui n'atteste rien.",
      },
      {
        titre: "Mesurez l'épaisseur au bon endroit",
        texte:
          "Prenez plusieurs points et retenez le mini, le moyen et le maxi. Le verdict se joue sur le mini : c'est au point le plus mince que le film cède, que l'humidité passe et que la corrosion démarre. Une moyenne à 80 µm avec un point à 35 µm est une pièce non conforme, quelle que soit la moyenne. C'est aussi pour cette raison que le calcul du verdict est fait par le serveur et pas par le poste de saisie : personne, pas même vous, ne peut déclarer conforme un relevé qui ne l'est pas.",
      },
      {
        titre: "Vérifiez l'étalonnage de l'instrument",
        texte:
          "Un jauge d'épaisseur non étalonnée invalide la mesure, donc le certificat, donc l'audit. Le logiciel bloque l'émission plutôt que de vous laisser signer une mesure inexploitable, et prévient trente jours avant l'échéance.",
      },
      {
        titre: "Assurez-vous que la cuisson est tracée",
        texte:
          "Un certificat sans fiche de cuisson est un certificat qui dit « c'est conforme » sans pouvoir dire comment. La fournée doit être terminée et sa température relevée.",
      },
      {
        titre: "Éditez",
        texte:
          "Le PDF porte le référentiel, les seuils en vigueur au moment de la mesure — pas ceux d'aujourd'hui —, le lot de poudre, l'instrument, et le nom des contrôles que vous ne pratiquez pas. Cette dernière ligne est volontaire : un auditeur préfère mille fois un document qui dit ce qu'il ne couvre pas.",
      },
    ],
    pieges: [
      "Un contrôle enregistré ne s'efface pas. Une erreur de saisie se corrige par une nouvelle mesure, qui prime — c'est la règle de tous les registres opposables.",
      "Un label expiré ne s'imprime pas sur le certificat, même si la case est cochée dans vos réglages.",
      "Si vous ne mesurez pas l'épaisseur, ne revendiquez pas Qualicoat : le logiciel vous avertit, mais il ne peut pas décider à votre place.",
    ],
  },
  {
    slug: "facturer-le-mois",
    titre: "Facturer un mois de livraisons",
    resume: "Regrouper les bons d'un donneur d'ordre en une seule facture, sans perdre la remise.",
    pour: "tous",
    capacite: "facturation_mensuelle",
    duree: "3 minutes par client",
    etapes: [
      {
        titre: "Cochez le client en facturation mensuelle",
        texte:
          "Un donneur d'ordre qui vous fait livrer trois fois par semaine ne veut pas douze factures : il veut une facture et un relevé. La case est sur sa fiche.",
      },
      {
        titre: "Livrez normalement",
        texte:
          "Chaque livraison produit un bon signé. Le bon porte les lignes, la remise contractuelle et la signature du réceptionnaire. C'est lui qui fait foi si un litige de quantité apparaît en fin de mois.",
      },
      {
        titre: "Générez la récapitulative",
        texte:
          "Le logiciel reprend tous les bons livrés et non encore facturés de la période. Chaque ligne porte le numéro du bon d'origine : votre client peut rapprocher chaque montant de son propre bon de réception, ce qui est exactement ce qu'on reproche à une facture illisible.",
      },
      {
        titre: "Vérifiez la remise",
        texte:
          "La remise contractuelle apparaît en ligne négative explicite, bon par bon et par taux de TVA — pas fondue dans les prix unitaires. C'est ce qui permet à votre client de la contrôler, et à vous de prouver que vous l'avez bien appliquée.",
      },
      {
        titre: "Émettez",
        texte:
          "Une fois émise, la facture est figée et les bons qu'elle reprend ne peuvent plus être facturés ailleurs : la base le refuse. Le PDF part en Factur-X, avec les données lisibles par le logiciel comptable de votre client.",
      },
    ],
    pieges: [
      "Ne facturez pas un chantier à part si son bon est déjà dans la récapitulative : le logiciel refusera, et il aura raison.",
      "Le délai de paiement appliqué est celui négocié avec le client, pas celui de votre atelier. Vérifiez-le sur sa fiche avant de vous étonner d'une échéance.",
    ],
  },
  {
    slug: "reprendre-donnees",
    titre: "Reprendre vos données d'un tableur",
    resume: "Arriver avec ses clients, ses prix, ses impayés et son stock, plutôt que de tout ressaisir un dimanche.",
    pour: "tous",
    duree: "45 minutes",
    etapes: [
      {
        titre: "Commencez par votre numérotation",
        texte:
          "Avant tout le reste, avant même vos clients : Réglages → Numérotation. Vous n'en êtes pas à votre première facture. Si nous repartons à 0001 alors que vous en êtes à 0347, votre exercice porte deux séries pour la même année et votre comptable refusera le fichier des écritures. Cela se pose en deux minutes — et seulement avant votre première facture, jamais après.",
      },
      {
        titre: "Partez de votre fichier, pas du nôtre",
        texte:
          "Vous avez déjà vos clients quelque part : un tableur, un logiciel de facturation, un carnet exporté. Prenez ce fichier tel quel. L'import reconnaît les intitulés de colonnes courants — « Nom », « Société », « Email », « Tél » — sans que vous ayez à renommer quoi que ce soit.",
      },
      {
        titre: "Suivez l'ordre de la liste",
        texte:
          "Sept modèles, dans l'ordre où ils apparaissent : clients, prestations, poudres, grille m², tarifs négociés, lots de poudre, factures en cours. Cet ordre n'est pas décoratif : un tarif négocié se rattache à un client et à une prestation qui existent, un lot à sa poudre, une facture à son client. Une ligne dont le rattachement échoue est refusée avec son motif — elle n'invente jamais la fiche manquante.",
      },
      {
        titre: "Regardez l'aperçu avant d'écrire",
        texte:
          "Rien n'est enregistré tant que vous n'avez pas vu ce qui va l'être. Les lignes refusées sont nommées une par une avec leur motif : e-mail invalide, champ obligatoire vide, doublon, HT + TVA qui ne fait pas le TTC. Corrigez dans votre fichier et relancez, autant de fois qu'il faut.",
      },
      {
        titre: "Entrez vos impayés le premier jour",
        texte:
          "Le modèle « Factures en cours » reprend vos factures émises et pas encore soldées, avec leur numéro et leur date d'origine, et le montant déjà réglé s'il y en a un. C'est ce qui fait que votre reste dû est juste dès le premier matin, que la relance automatique n'est pas muette, et que vous n'avez pas à garder un tableur ouvert à côté.",
      },
      {
        titre: "Faites vos poudres avec le catalogue",
        texte:
          "N'entrez pas vos teintes à la main. Cherchez la référence dans le catalogue Thermopoudre : le RAL, la finition, le cycle de cuisson, le rendement et le prix au kilo arrivent avec, et ils sont justes. Ensuite seulement, importez vos lots : c'est eux qui portent la DLU, le fournisseur et le reste réel en kilos.",
      },
    ],
    pieges: [
      "La reprise des factures en cours se ferme dès que vous émettez votre première facture depuis Thermogestion : une facture antérieure ne s'intercale pas dans une série déjà ouverte.",
      "Vos factures reprises n'entrent pas dans votre export comptable : votre ancien logiciel les a déjà comptabilisées. Elles comptent en revanche dans votre reste dû, vos relances et votre courriel du matin.",
      "Importez vos poudres avant vos lots : une référence inconnue est refusée, elle n'est pas créée au passage. Une fiche poudre sans cycle de cuisson ni rendement casserait la cuisson et le prix de revient sans le dire.",
      "Un doublon interne au fichier est refusé comme un doublon en base. Ça évite de créer deux fois le même client parce qu'il apparaît deux fois dans votre tableur.",
    ],
  },
];

export function tutoriel(slug: string) {
  return TUTORIELS.find((t) => t.slug === slug);
}

/** Tutoriels pertinents pour un métier donné. Le métier « mixte » les voit tous. */
export function tutorielsPour(metier: string | null | undefined) {
  if (metier === "jantes") return TUTORIELS.filter((t) => t.pour !== "industrie");
  if (metier === "industrie") return TUTORIELS.filter((t) => t.pour !== "jantes");
  return TUTORIELS;
}
