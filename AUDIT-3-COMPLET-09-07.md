# Thermogestion — Audit n°3 (09/07/2026)

*Périmètre : suivi des promesses de vente vs code réel (lecture directe de `src/`, `package.json`, du site en prod), + volet inédit : brainstorm expert thermolaquage des features CRM/ERP absentes. Méthode : performance-report adapté pré-lancement, dans la continuité des audits n°1 (08/07 matin) et n°2 (08/07 soir).*

## Verdict global

Le lot 3 (équipe, bandeau essai, viralité, metadata) est bien en prod — vérifié en direct : bandeau "Essai gratuit : X jours restants" présent dans `layout.tsx`, invitations d'équipe câblées dans Réglages et onboarding. Bon.

Mais l'audit d'aujourd'hui trouve **un problème plus grave que ceux déjà connus** : la page tarifs vend au plan Atelier (89 €) *"Paiement en ligne des factures"* et *"Relances automatiques devis & factures"* — **aucun module Facture n'existe dans le code** (pas de `src/app/(app)/factures`, `stripe` absent de `package.json`). Ce n'est pas un bug d'UI, c'est une fonctionnalité vendue et facturée qui n'existe pas. Plus risqué que la promesse "équipe" de l'audit n°2, qui elle est réparée.

Second constat, plus petit mais concret : l'image de partage social (og:image) pointe vers `http://localhost:3000/...` en prod — un partage WhatsApp/LinkedIn du lien affichera une image cassée, ce qui neutralise le travail de viralité "Propulsé par Thermogestion" fait cette nuit.

---

## PARTIE 1 — Promesses vs code réel

| Promesse (page tarifs) | Plan | État code | Verdict |
|---|---|---|---|
| Devis illimités + signature en ligne | Solo | ✅ `devis/`, `SignaturePad.tsx`, `DevisPublicClient.tsx` | Tenue |
| Suivi de production + QR atelier | Solo | ✅ `scan/[qr]`, `projets/` | Tenue |
| Stock poudres + réappro 1 clic | Solo | ✅ `stock/`, décrément à la cuisson | Tenue |
| Lien de suivi client | Solo | ✅ `s/[token]`, `TrackView.tsx` | Tenue |
| Utilisateurs illimités (équipe) | Atelier | ✅ invitations dans Réglages + onboarding | Tenue (réparée depuis n°2) |
| **Paiement en ligne des factures** | Atelier | 🔴 aucun dossier `factures/`, `stripe` absent des dépendances | **Non tenue — vendue mais inexistante** |
| **Relances automatiques devis & factures** | Atelier | 🔴 table `relances` prévue au blueprint, non implémentée | **Non tenue** |
| Support prioritaire | Atelier | N/A (process humain, pas du code) | — |

**Recommandation immédiate** : deux options, pas de troisième. (A) Retirer ces deux lignes de la page tarifs jusqu'au sprint 4 — coûte 5 minutes, protège la confiance des premiers pilotes. (B) Accélérer le sprint 4 (factures + Stripe Connect) avant d'inviter qui que ce soit en plan Atelier. Tant que ni l'un ni l'autre n'est fait, **aucun atelier ne doit signer le plan Atelier à 89 €**.

## PARTIE 2 — Bug : image de partage cassée en prod

`opengraph-image` résout vers `localhost:3000` au lieu du domaine public (`NEXT_PUBLIC_SITE_URL` ou équivalent absent/mal résolu dans `src/lib/env.ts` ou `opengraph-image.tsx`). Effet concret : quelqu'un qui partage un lien `/d/[token]` ou la landing sur WhatsApp verra une vignette grise/cassée — direct sur le canal de viralité identifié à l'audit n°2. Fix probable : forcer une URL absolue basée sur l'env de prod plutôt que sur `metadataBase` par défaut de Next.js. Effort faible, à faire avec le point 1.

---

## PARTIE 3 — Expertise thermolaquage : les features CRM qui manquent

*Recherche croisée avec les logiciels spécialisés existants (Coockpit Thermolaquage, Steelhead Technologies), les exigences Qualicoat, et les problématiques opérationnelles réelles d'un atelier de thermolaquage/poudrage. Classé par thème, avec la valeur business et un jugement effort/pertinence pour VOTRE cible (artisans 1-10 pers., FR/IT, spécialité jantes).*

### A. Traçabilité & SAV — le plus rentable à faible effort

| Feature | Valeur business | Effort | Pertinent pour votre cible ? |
|---|---|---|---|
| **Traçabilité lot poudre** (fournisseur + n° de lot par commande, réutilise la table `poudres`/`stock_mouvements` existante) | En cas de réclamation garantie (décoloration, écaillage), vous prouvez quel lot a été utilisé — vous dégagez votre responsabilité ou celle du fournisseur en 30 secondes | 🟢 Faible | **Oui, même pour un artisan seul** — un litige client sans preuve coûte cher |
| **Statut "non-conforme / à reprendre"** sur une étape projet, avec cause (masquage raté, défaut poudre, épaisseur insuffisante) et coût de reprise masqué | Aujourd'hui les reprises sont invisibles dans le kanban — elles mangent la marge sans que personne ne le voie. Un statut dédié permet un vrai calcul de marge nette par job | 🟡 Moyen | Oui — utile dès la v1.1, révèle une perte cachée |

### B. Optimisation four & production — le vrai différenciateur métier

| Feature | Valeur business | Effort | Pertinent pour votre cible ? |
|---|---|---|---|
| **Planificateur de fournée par teinte/RAL** : regrouper automatiquement les projets "en attente poudrage" par teinte proche avant de lancer une cuisson, pour maximiser le taux de remplissage du four et limiter les nettoyages de cabine | C'est LE levier de rentabilité d'un atelier de thermolaquage — chaque changement de couleur coûte du temps de nettoyage cabine + de la poudre perdue. Personne dans votre cible (artisans/rénovateurs jantes) n'a cet outil aujourd'hui | 🟡 Moyen (réutilise `projets.etapes` jsonb + champ RAL du devis) | **Oui — c'est un argument de vente fort, en plus du différenciateur Thermopoudre** |
| **Certificat de conformité auto-généré** (PDF signé, envoyé au portail client) à partir des données déjà en base (poudre utilisée, date cuisson, opérateur) | Crédibilise l'atelier auprès de donneurs d'ordres pros (carrossiers, industriels) — un simple bouton "Générer le certificat" après la dernière étape | 🟡 Moyen | Oui pour les ateliers qui bossent avec des pros/collectivités ; moins pour du B2C jantes pur |
| **Planning de charge / capacité** : vue "semaines à venir" pour donner une date de livraison réaliste au lieu d'au doigt mouillé | Réduit les promesses non tenues ("ce sera prêt vendredi" alors que le four est plein) — argument de vente direct sur la landing ("date fiable") | 🟡 Moyen-fort | Utile dès 2-3 employés ; moins critique pour un artisan seul qui a le planning en tête |
| **Contrôle qualité par commande** (épaisseur/adhérence/brillant saisis sur tablette, seuils, alerte hors tolérance) — norme Qualicoat | Obligatoire seulement pour les ateliers certifiés Qualicoat (plutôt gros ateliers industriels, alu architecture) | 🔴 Fort | **Non prioritaire pour votre cible actuelle** (artisans + jantes) — à garder en module optionnel v2 si vous visez un jour les ateliers certifiés |

### C. Sous-traitance entre confrères

| Feature | Valeur business | Effort |
|---|---|---|
| Marquer une commande "envoyée en sous-traitance" (sablage manquant en interne, surcharge), avec coût et délai de retour, puis réintégration automatique dans le kanban à son retour | Réalité fréquente chez les petits ateliers (pas de sablage sur place, ou surcharge ponctuelle) — évite de perdre le fil d'une commande partie chez un tiers | 🟡 Moyen |

### D. Recyclage poudre / overspray

| Feature | Valeur business | Effort |
|---|---|---|
| Suivi du taux de récupération poudre (cabine à récupération) et ratio vierge/recyclé par teinte | Argument coût matière (jusqu'à 30 % d'économie poudre) ET argument écologique commercialisable auprès des clients pros | 🟢 Faible-moyen (juste un ratio calculé sur les mouvements de stock existants) |

### E. Spécifique jantes auto — votre marché prioritaire, zéro concurrent dessus

| Feature | Valeur business | Effort |
|---|---|---|
| **Champ "teinte constructeur d'origine"** distinct du RAL choisi (ex : "Gris Nardo BMW" → mappé vers votre RAL le plus proche) | Aucun logiciel spécialisé jante trouvé sur le marché — vous seriez les premiers. Se branche directement sur votre catalogue Thermopoudre (toutes teintes origine déjà en stock chez vous) | 🟢 Faible (champ texte/select + lien catalogue) |
| **Ligne de service séparée dévoilage/redressage/CNC diamant** dans le devis, avec son propre statut de production | Les rénovateurs jantes vendent souvent ces prestations en plus du thermolaquage — actuellement noyées dans les "prestations" génériques | 🟢 Faible |
| Photo par jante individuelle (pas juste par projet) avec numérotation avant/après | Utile en cas de litige sur UNE jante défectueuse dans un lot de 4 | 🟢 Faible |

### F. CRM générique — ce qui manque à tout SaaS B2B/B2C de service

| Feature | Valeur business | Effort |
|---|---|---|
| **Tableau de bord "à faire"** enrichi : devis à relancer, projets en retard, poudres sous seuil, factures en attente *(déjà recommandé à l'audit n°2, à faire maintenant que le module facture existera)* | Transforme le dashboard passif en outil de pilotage quotidien | 🟢 Faible une fois les factures là |
| **KPI taux de transformation devis → commande** sur le dashboard | Vous dites vous-même "un devis signé de plus rembourse l'abonnement" — donnez à l'atelier la preuve chiffrée que ça marche, ça retient l'abonné | 🟢 Faible |
| **Tarifs dégressifs / programme fidélité** pour clients récurrents (carrossiers, revendeurs qui reviennent chaque mois) | Un atelier B2B a souvent 3-4 clients qui font 50 % du CA — leur proposer un tarif préférentiel géré dans l'outil évite le tableau Excel à côté | 🟡 Moyen |
| **Demande d'avis post-livraison automatisée** | Vous l'avez déjà fait côté thermopoudre.fr ([[project_avis_clients]]) — même mécanique, réutilisable ici, et ça nourrit la preuve sociale qui manque à la landing | 🟢 Faible |
| **Devis récurrents / contrats-cadres** pour B2B réguliers (même client, même grille, tous les mois) | Évite de refaire le même devis à la main pour un client fidèle | 🟡 Moyen |

---

## Matrice de priorisation globale (impact × effort)

| | Effort faible | Effort fort |
|---|---|---|
| **Impact fort** | Retirer/clarifier promesse facture · fix og:image · traçabilité lot poudre · champ teinte origine jante · KPI conversion devis | Planificateur fournée par RAL · module Facture + Stripe (sprint 4) · certificat conformité |
| **Impact faible/différé** | Dashboard "à faire" enrichi · avis clients auto · ligne service dévoilage | Contrôle qualité Qualicoat (hors cible actuelle) · planning de charge · sous-traitance |

---

## Ce que je recommande, dans l'ordre

1. **Cette semaine** : décider entre retirer la promesse "paiement factures" de la page tarifs OU sprinter le module Facture — ne pas laisser cette incohérence vivre en prod. Fix og:image en même temps (5 min).
2. **Sprint 4 (déjà prévu)** : factures + Stripe Connect. Profitez-en pour caler les relances auto et le KPI conversion devis→commande sur le même chantier.
3. **Différenciateur produit** (à glisser dans le même sprint ou juste après, effort raisonnable, forte valeur de vente) : traçabilité lot poudre, champ teinte origine jante, ligne dévoilage/CNC — trois features à faible effort qui parlent directement à votre cible rénovateurs jantes et personne d'autre ne les a.
4. **v1.1, après les premiers pilotes** : planificateur de fournée par RAL (le vrai levier de rentabilité atelier), certificat de conformité, statut non-conforme/reprise, avis clients auto.
5. **Hors cible pour l'instant** : contrôle qualité façon Qualicoat, planning de charge complexe — à garder en tête si vous visez un jour des ateliers plus gros/certifiés, mais ça n'est pas ce que vend Thermogestion aujourd'hui (artisan + jantes, mobile-first, "utilisable avec des gants").

Dis-moi lesquels tu veux que j'attaque — je peux commencer par le fix og:image + la décision facture pendant que tu tries le reste.
