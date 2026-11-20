const MAP: [RegExp, string][] = [
  [/invalid login credentials/i, "Email ou mot de passe incorrect."],
  [/user already registered/i, "Un compte existe déjà avec cet email."],
  [/password should be at least/i, "Le mot de passe doit faire au moins 8 caractères."],
  // Levée par le trigger `exiger_abonnement` quand l'essai est terminé (migration 18).
  [/ABONNEMENT_REQUIS/i, "Votre essai est terminé — l'atelier est en lecture seule. Choisissez une formule pour reprendre la main."],
  // Levée par le trigger `limite_utilisateurs` (migration 23) à l'invitation d'un membre de plus,
  // et à la réactivation d'un membre désactivé. Le message dit le prix et le chemin : un refus qui
  // n'indique pas quoi faire ensuite est un refus qu'on appelle au téléphone.
  [/SIEGES_INSUFFISANTS/i, "Toutes les places de votre formule sont prises. Ajoutez un siège à 5 € HT par mois depuis Réglages → Équipe, ou désactivez un utilisateur pour libérer sa place."],
  // Ancien nom du même refus, avant la migration 23. Des lignes plus anciennes peuvent encore le
  // lever : le message ne promet plus « les utilisateurs sans limite » au-dessus de la formule
  // d'entrée, ce qui a cessé d'être vrai le jour où le siège est devenu un compteur linéaire.
  [/LIMITE_UTILISATEURS/i, "Toutes les places de votre formule sont prises. Ajoutez un siège à 5 € HT par mois depuis Réglages → Équipe, ou désactivez un utilisateur pour libérer sa place."],
  // Levée par le trigger `interdire_ecriture_demo` : l'atelier vitrine se visite, ne se modifie pas.
  [/DEMO_LECTURE_SEULE/i, "Vous visitez la démonstration : elle se consulte, elle ne s'enregistre pas. Créez votre atelier pour essayer pour de vrai."],
  [/ADRESSE_FOURNISSEUR_INVALIDE/i, "L'adresse du fournisseur n'est pas une adresse e-mail valide."],
  [/PANIER_VIDE/i, "Ajoutez au moins une teinte avant d'envoyer le bon de commande."],
  [/COMMANDE_DEJA_ENVOYEE/i, "Cette commande a déjà été envoyée."],
  [/COMMANDE_NON_ENVOYEE/i, "Cette commande n'est pas en attente de réception."],
  // Levée par le trigger `figer_controle` : un registre d'audit ne se réécrit pas.
  [/CONTROLE_FIGE/i, "Un contrôle enregistré ne se modifie plus : son verdict fait foi à sa date. Refaites la mesure, le contrôle le plus récent prime."],
  [/REFERENTIEL_INCONNU/i, "Ce référentiel de contrôle n'appartient pas à votre atelier."],
  [/referentiels_epaisseur_maxi_check/i, "L'épaisseur maximale doit être supérieure à l'épaisseur minimale."],
  [/referentiels_epaisseur_mini_check/i, "L'épaisseur minimale doit être un nombre de micromètres positif."],
  [/referentiels_adherence_check/i, "La classe d'adhérence se situe entre 0 et 5."],
  [/referentiels_brillance_check/i, "La tolérance de brillance doit être comprise entre 0 et 100 UB."],
  [/referentiels_buchholz_check/i, "La dureté Buchholz minimale doit être comprise entre 0 et 200."],
  [/referentiels_qualite_defaut_unique/i, "Un seul référentiel peut être appliqué par défaut."],
  // ── Chantier C3 : dupliquer, corriger, annuler, faire un avoir ────────────
  // Ces codes sont levés par les RPC `dupliquer_*`, `nouvelle_version_devis`, `rouvrir_devis`,
  // `annuler_facture` et `avoir_depuis_facture`, et par le trigger `avoir_plafond`. Chaque message
  // dit la règle **et** le chemin de sortie : un refus qui n'indique pas quoi faire ensuite est un
  // refus qu'on appelle au téléphone.
  [/ACCES_COMMERCIAL_REQUIS/i, "Devis et factures relèvent du bureau. Votre compte est un compte d'atelier : demandez au responsable de changer votre rôle depuis Réglages → Équipe."],
  [/DOCUMENT_INTROUVABLE/i, "Ce document n'existe plus, ou il n'appartient pas à votre atelier. Rechargez la page."],
  [/DEVIS_BROUILLON_MODIFIABLE/i, "Ce devis est encore un brouillon : modifiez-le directement, il n'a pas besoin d'une nouvelle version."],
  [/DEVIS_DEJA_BROUILLON/i, "Ce devis est déjà modifiable."],
  [/DEVIS_DEJA_REMPLACE/i, "Ce devis a déjà une version plus récente. Ouvrez-la : c'est elle qui fait foi."],
  [/DEVIS_SIGNE_VERROUILLE/i, "Un devis signé engage les deux parties et le projet en découle : il ne se rouvre pas. Créez-en une nouvelle version."],
  [/DEVIS_REMPLACE/i, "Ce devis a été remplacé : travaillez sur sa version la plus récente."],
  // Levée par `signer_devis` quand la durée de validité imprimée sur le devis est dépassée.
  // Le devis reste rattrapable : « Revenir au brouillon » puis refinalisation font repartir la
  // validité, et c'est ce que le message doit dire — sinon l'atelier croit le devis perdu.
  [/DEVIS_EXPIRE/i, "Ce devis a dépassé sa durée de validité : il ne peut plus être signé. Repassez-le en brouillon puis refinalisez-le pour relancer la validité, ou créez-en une nouvelle version si les prix ont changé."],
  [/DEVIS_DEJA_FACTURE/i, "Une facture a déjà été émise sur ce devis. On ne réécrit pas la pièce qui justifie une facture : corrigez la facture par un avoir."],
  [/AVOIR_NON_DUPLICABLE/i, "Un avoir n'existe que par rapport à une facture : ouvrez la facture concernée et utilisez « Faire l'avoir »."],
  [/AVOIR_SUR_AVOIR/i, "On ne fait pas l'avoir d'un avoir. Si l'avoir est faux, refaites une facture."],
  [/AVOIR_SANS_LIGNE/i, "Choisissez au moins une ligne à créditer."],
  [/AVOIR_SUPERIEUR_FACTURE/i, "Le cumul des avoirs dépasserait le montant de la facture d'origine. Vérifiez les avoirs déjà émis sur cette facture."],
  [/MOTIF_ANNULATION_REQUIS/i, "Indiquez pourquoi vous annulez cette facture : c'est ce que vous relirez dans six mois, et ce qu'un contrôle demandera."],
  [/FACTURE_DEJA_ANNULEE/i, "Cette facture est déjà annulée."],
  [/FACTURE_BROUILLON_SUPPRIMABLE/i, "Un brouillon n'a jamais existé pour votre client : il se supprime, il ne s'annule pas."],
  [/FACTURE_PAYEE_AVOIR/i, "Une facture payée ne s'annule pas — il y a de l'argent encaissé en face. Émettez un avoir : c'est la seule correction qui laisse une trace dans les comptes."],
  [/FACTURE_ENCAISSEE/i, "Un règlement a déjà été enregistré sur cette facture : elle ne s'annule plus. Émettez un avoir."],
  [/FACTURE_ANNULEE_DEFINITIVE/i, "Une facture annulée le reste, et son numéro reste consommé — une numérotation comptable ne se réutilise jamais. Créez une nouvelle facture."],
  [/FACTURE_NON_EMISE/i, "Un avoir se fait sur une facture émise : un brouillon se corrige, une facture annulée n'a rien produit."],
  // Levée par le trigger `figer_document`. Elle existait depuis le lot 4 et tombait jusqu'ici dans
  // le message générique : l'atelier voyait « une erreur est survenue » là où la base lui disait
  // précisément quoi faire.
  // Migration 77 (20/11/2026) : refus des RPC d'émission atomique.
  [/FACTURE_NON_ENCAISSABLE/i, "Cette facture n'attend plus de règlement (déjà soldée, annulée ou encore en brouillon) : rechargez la page."],
  [/PAIEMENT_SUR_AVOIR/i, "Un avoir ne s'encaisse pas : c'est vous qui remboursez le client."],
  [/PAIEMENT_MOYEN_MANQUANT/i, "Choisissez le moyen de paiement."],
  [/(FACTURE|DEVIS|BL)_DEJA_(EMISE?|EMIS|FINALISE)/i, "Ce document est déjà émis : rechargez la page."],
  [/(FACTURE|DEVIS|BL)_INTROUVABLE/i, "Document introuvable : il a peut-être été supprimé, ou il appartient à un autre atelier."],
  [/DOCUMENT_FIGE/i, "Ce document est figé : un devis signé et une facture émise ne se modifient plus. Créez une nouvelle version du devis, ou émettez un avoir sur la facture."],
  // Levées par les contraintes de longueur des conditions générales de vente (migration 76,
  // `ateliers.cgv`, `clients.cgv`, `devis.cgv_texte`, `factures.cgv_texte`) : même borne partout,
  // même message.
  [/(ateliers|clients|devis|factures)_cgv(_texte)?_longueur_check/i, "Les conditions générales de vente sont limitées à 20 000 caractères (environ 8 à 10 pages) : raccourcissez le texte, ou renvoyez vers un document externe."],
  // ── Corbeille ───────────────────────────────────────────────────────────────
  // Une pièce qui soutient un document comptable émis ne se jette pas. Le message doit dire
  // quoi faire à la place, sinon l'exploitant conclut que le logiciel est cassé et recommence.
  [/DOCUMENT_EMIS_NON_SUPPRIMABLE/i, "Une facture émise est une pièce comptable : elle ne se supprime pas. Annulez-la, ou corrigez-la par un avoir."],
  [/BL_PORTE_PAR_FACTURE/i, "Ce bon de livraison est porté par une facture. Annulez la facture ou émettez un avoir avant de le retirer."],
  [/RATTACHE_A_FACTURE_EMISE/i, "Cette pièce a déjà été facturée : la retirer effacerait la trace de ce qui a été vendu. Annulez d'abord la facture."],
  [/CLIENT_ENCORE_ACTIF/i, "Ce client porte encore des devis, des projets ou des factures. Archivez-le : il quitte les listes, son historique reste, et vous pouvez le rouvrir d'un clic."],
  [/SUPPRESSION_IMPOSSIBLE/i, "Cet élément n'existe plus, ou il est déjà à la corbeille. Rechargez la page."],
  [/RESTAURATION_IMPOSSIBLE/i, "Cet élément n'est plus dans la corbeille : il a été restauré ou purgé."],
  [/CORBEILLE_ENTITE_INCONNUE/i, "Type d'élément inconnu."],
  [/ACCES_COMMERCIAL_REQUIS/i, "Les devis et les factures appartiennent au périmètre du bureau. Demandez au responsable de l'atelier de vous changer de rôle."],
  [/ATELIER_INCONNU/i, "Votre session a expiré. Reconnectez-vous."],
  // ── Espace client (portail par jeton) ───────────────────────────────────────
  // Les codes sont préfixés `PORTAIL_` exprès : un `DROIT_REFUSE` générique finirait par être
  // levé ailleurs, et l'atelier lirait une phrase qui parle du portail sur un écran qui n'a rien
  // à voir.
  [/PORTAIL_DROIT_REFUSE/i, "Ouvrir un espace client donne accès à tout l'historique commercial de cette entreprise : seul le responsable ou le bureau peut le décider."],
  [/PORTAIL_CLIENT_INTROUVABLE/i, "Cette fiche client n'existe pas dans votre atelier, ou elle est à la corbeille."],
  [/PORTAIL_ABSENT/i, "Aucun espace client n'est ouvert pour cette fiche. Rechargez la page."],
  // ── Doublons ────────────────────────────────────────────────────────────────
  // Le message générique « cet élément existe déjà » laissait l'exploitant devant un formulaire
  // rempli sans lui dire lequel des champs pose problème, ni qu'une fiche l'attend déjà.
  [/clients_nom_unique_par_atelier/i, "Un client porte déjà ce nom. Ouvrez sa fiche plutôt que d'en créer une seconde."],
  [/clients_siret_unique_par_atelier/i, "Un client porte déjà ce SIRET."],
  [/poudres_reference_unique_par_atelier/i, "Cette référence existe déjà chez ce fournisseur."],
  [/prestations_code_unique_par_atelier/i, "Ce code de prestation est déjà utilisé."],
  // ── Lot A : la porte d'entrée (reprise de l'existant) ──────────────────────
  // Ces refus arrivent tous à l'installation, devant un exploitant qui découvre le produit et qui
  // a son ancien logiciel encore ouvert à côté. Chaque message dit la règle ET l'ordre à suivre :
  // c'est le moment du produit où un refus obscur fait renoncer.
  [/NUMEROTATION_RESERVEE_PROPRIETAIRE/i, "La numérotation engage la comptabilité de l'entreprise : seul le responsable de l'atelier peut la poser."],
  [/NUMEROTATION_DEJA_UTILISEE/i, "Un document de ce type est déjà parti cette année. Déplacer le compteur maintenant créerait un trou ou un doublon dans votre série : une numérotation se pose avant le premier document, jamais au milieu."],
  [/NUMEROTATION_PREFIXE_INVALIDE/i, "Le préfixe fait de 1 à 6 caractères, lettres non accentuées et chiffres uniquement (FA, DV, FACT…)."],
  [/NUMEROTATION_RANG_INVALIDE/i, "Le prochain numéro est un entier compris entre 1 et 999 999."],
  [/NUMEROTATION_TYPE_INCONNU/i, "Ce type de document ne porte pas de numérotation configurable."],
  [/REPRISE_RESERVEE_PROPRIETAIRE/i, "Reprendre l'encours crée des factures émises : seul le responsable de l'atelier peut le faire."],
  [/REPRISE_ENCOURS_FERMEE/i, "Vous avez déjà émis une facture depuis Thermogestion : la reprise de votre encours est close. Une facture antérieure ne s'intercale pas dans une série ouverte."],
  [/REPRISE_NUMERO_EXISTANT/i, "Une facture porte déjà ce numéro dans votre atelier."],
  [/REPRISE_NUMERO_INVALIDE/i, "Reportez le numéro exact de la facture d'origine (40 caractères au plus)."],
  [/REPRISE_CLIENT_INCONNU/i, "Ce client n'existe pas dans votre atelier. Importez vos clients avant votre encours."],
  [/REPRISE_DATE_INVALIDE/i, "La date d'émission est obligatoire et ne peut pas être dans le futur."],
  [/REPRISE_TOTAUX_INCOHERENTS/i, "HT + TVA doit égaler le TTC. Vérifiez la correspondance des colonnes de votre fichier."],
  [/REPRISE_MONTANTS_INVALIDES/i, "Les montants HT et TVA sont positifs, et le TTC est strictement supérieur à zéro."],
  [/REPRISE_REGLEMENT_INVALIDE/i, "Le montant déjà réglé est compris entre zéro et le total TTC de la facture."],
  [/REPRISE_ECHEANCE_ANTERIEURE/i, "L'échéance ne peut pas précéder la date d'émission."],
  [/LOT_POUDRE_INCONNUE/i, "Cette référence de poudre n'existe pas dans votre atelier. Importez vos poudres avant vos lots — une fiche créée à la volée n'aurait ni RAL, ni cycle de cuisson, ni rendement."],
  [/LOT_QUANTITE_INVALIDE/i, "La quantité reçue est un nombre de kilos strictement positif."],
  [/LOT_RESTANT_INVALIDE/i, "Le reste en stock est compris entre zéro et la quantité reçue."],
  [/LOT_RECEPTION_FUTURE/i, "La date de réception ne peut pas être dans le futur."],
  [/GRILLE_AUTRE_ATELIER/i, "Cette grille tarifaire n'appartient pas à votre atelier."],
  // ── Lot D (recette du 03/09) : bornes que l'écran affichait sans jamais les vérifier ──────
  [/REMISE_NEGATIVE/i, "Une remise ne peut pas être négative : elle augmenterait le total sans aucune ligne pour l'expliquer."],
  [/REMISE_SUPERIEURE_100/i, "Une remise en pourcentage ne peut pas dépasser 100 %."],
  [/REMISE_SUPERIEURE_SOUS_TOTAL/i, "Cette remise en euros dépasse le sous-total sur lequel elle porte."],
  [/LIGNE_QUANTITE_NEGATIVE/i, "Une quantité ou une surface de ligne ne peut pas être négative."],
  [/PAIEMENT_MONTANT_INVALIDE/i, "Le montant encaissé doit être strictement positif."],
  [/PAIEMENT_SUPERIEUR_RESTE_DU/i, "Ce montant dépasse le reste dû sur cette facture. Vérifiez les paiements déjà enregistrés."],
  [/PAIEMENT_FACTURE_INTROUVABLE/i, "Cette facture n'existe plus, ou pas dans votre atelier. Rechargez la page."],
  [/clients_remise_pct_check/i, "La remise d'un client est comprise entre 0 et 100 %."],
  [/clients_delai_paiement_check/i, "Le délai de paiement est compris entre 0 et 60 jours (L441-10 du code de commerce)."],
  // Migration 62 (recette navigateur, vague 2) : même règle que `clients_delai_paiement_check`,
  // mais sur le délai par défaut de l'atelier (Réglages → Atelier).
  [/ateliers_delai_paiement_check/i, "Le délai de paiement est compris entre 0 et 60 jours (L441-10 du code de commerce)."],
  // Migration 63 (recette navigateur, vague 2) : un code de type d'instrument qui n'appartient pas
  // au dictionnaire de `/qualite/instruments`.
  [/instruments_type_check/i, "Ce type d'instrument n'est pas reconnu."],
  [/receptions_nb_pieces_check/i, "Le nombre de pièces reçues doit être d'au moins 1."],
  [/jeux_jantes_diametre_pouces_check/i, "Le diamètre d'une jante est compris entre 12 et 26 pouces."],
  [/jeux_jantes_largeur_pouces_check/i, "La largeur d'une jante est d'au moins 4J."],
  [/grille_paliers_bornes_check/i, "La borne haute d'un palier doit être supérieure à sa borne basse — sinon le palier n'attrape aucune surface et le devis se chiffre à zéro."],
  [/grille_paliers_prix_check/i, "Un prix au m² ne peut pas être négatif."],
  [/client_tarifs_prix_check/i, "Un prix négocié ne peut pas être négatif."],
  [/client_tarifs_client_id_prestation_id_key/i, "Ce client a déjà un tarif négocié sur cette prestation. Modifiez-le depuis sa fiche."],
  [/grilles_une_seule_par_defaut/i, "Une seule grille peut être la grille standard de l'atelier."],
  // ── Lot B1 : envoyer devis, facture et BL depuis l'application ─────────────
  // Levés par `envoyer_document()`. `FACTURE_NON_EMISE` et `ACCES_COMMERCIAL_REQUIS` existent déjà
  // plus haut et couvrent aussi ces cas ; `ROLE_INSUFFISANT` et `CLIENT_SANS_EMAIL` étaient levés
  // par `notifier_facture_emise` depuis le lot A sans jamais avoir de traduction — l'atelier lisait
  // le message générique sur un e-mail de facture qui échouait.
  [/ROLE_INSUFFISANT/i, "Seuls le responsable et le bureau envoient un document à un client."],
  [/CLIENT_SANS_EMAIL/i, "Ce client n'a pas d'adresse e-mail. Renseignez-en une sur sa fiche, ou copiez le lien pour l'envoyer vous-même."],
  [/DOCUMENT_TYPE_INCONNU/i, "Type de document non reconnu."],
  [/DOCUMENT_NON_FINALISE/i, "Ce document n'est pas encore prêt à partir : finalisez-le (numéro et lien public) avant de l'envoyer."],
  [/DESTINATAIRE_MANQUANT/i, "Indiquez une adresse e-mail, ou copiez le lien pour l'envoyer vous-même."],
  // Levés par `joindre_piece_jointe_notification` (migration 65, audit sécurité du 07/09/2026) :
  // la pièce elle-même dépasse 10 Mo, ou le cumul des pièces déjà posées sur cette notification
  // dépasserait 20 Mo avec celle-ci en plus.
  [/PIECE_JOINTE_TROP_LOURDE/i, "Cette pièce jointe dépasse 10 Mo. Réduisez sa taille (ou compressez le PDF) avant de l'envoyer."],
  [/NOTIFICATION_PIECES_TROP_LOURDES/i, "Les pièces jointes de cet envoi dépasseraient 20 Mo au total. Retirez-en une ou compressez les documents."],
  [/rate limit|too many requests/i, "Trop de tentatives, réessayez dans quelques minutes."],
  [/duplicate key|already exists/i, "Cet élément existe déjà."],
  [/violates row-level security/i, "Action non autorisée."],
  [/network|fetch failed|failed to fetch/i, "Problème de connexion. Vérifiez votre réseau et réessayez."],
  [/not found/i, "Élément introuvable."],
  [/invalid input syntax|invalid.*format/i, "Valeur saisie invalide."],
  // Contrainte `controles_cible_check` : un contrôle doit viser un projet ou une fournée.
  [/controles_cible_check/i, "Rattachez le contrôle à un projet ou à une fournée avant d'enregistrer."],
  // Levée par le trigger `trg_fournee_capacite` (migration 71, amélioration n°2 du 07/09/2026) :
  // avant, seule une barre rouge s'affichait à côté d'un bouton « Lancer la fournée » parfaitement
  // actif. Le message dit la règle et la sortie : dérogation cochée, ou capacité du four corrigée.
  [/FOURNEE_CAPACITE_DEPASSEE/i, "Cette fournée dépasse la capacité déclarée du four : le lancement est bloqué. Cochez la dérogation si le four peut réellement contenir davantage, ou corrigez sa capacité dans Réglages → Atelier si le dépassement est systématique."],
  [/violates check constraint/i, "Une valeur saisie ne respecte pas les règles de ce formulaire."],
  [/violates not-null constraint/i, "Un champ obligatoire est vide."],
  [/violates foreign key constraint/i, "Élément lié introuvable — rechargez la page et réessayez."],
];

/**
 * Le seul refus dont le message doit porter une valeur variable : l'adresse attendue.
 *
 * `accept_invitation()` lève `INVITATION_AUTRE_ADRESSE j•••t@atelier.fr` quand le compte connecté
 * n'est pas celui qui a été invité. Un refus muet — « invitation invalide » — ferait recommencer
 * l'invité à l'infini avec un lien parfaitement valide, puis appeler l'atelier. L'adresse est
 * déjà masquée par la base : ce n'est pas à l'écran de le faire, et surtout pas à lui de
 * l'oublier.
 */
const INVITATION_AUTRE_ADRESSE = /INVITATION_AUTRE_ADRESSE\s+(\S+)/i;

export function errorFr(err: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : (err as { message?: string })?.message ?? "";
  const autreAdresse = INVITATION_AUTRE_ADRESSE.exec(msg);
  if (autreAdresse) {
    return (
      `Ce lien d'invitation a été envoyé à ${autreAdresse[1]}. Connectez-vous avec cette adresse, ` +
      "ou demandez à l'atelier de vous réinviter à celle que vous utilisez (Réglages → Équipe)."
    );
  }
  for (const [re, fr] of MAP) if (re.test(msg)) return fr;
  return "Une erreur est survenue. Réessayez, et contactez-nous si ça persiste.";
}
