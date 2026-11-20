# Thermogestion — Audit complet (08/07/2026)

*Triple audit : préparation marketing (performance-report adapté pré-lancement), critique design, audit du système de design. État audité : app déployée sur https://srv1325118.hstgr.cloud + code v2 + vitrine en attente de déploiement.*

---

## PARTIE 1 — Audit marketing (pré-lancement)

### Résumé exécutif

Le produit fonctionne et est en ligne, mais **le funnel d'acquisition n'existe pas encore** : zéro tracking, zéro capture de lead, pas de pages légales, et la vitrine actuellement en ligne est la version minimale (3 lignes + 2 boutons — la vraie landing attend ton GO MAJ). Point fort : le canal d'acquisition n°1 est déjà dans ta poche — ta base clients Thermopoudre (1 500+ comptes dans thermocrm) que personne d'autre ne peut toucher. Point critique : **aucun compte réel ne devrait être créé avant les pages légales et le SMTP.**

### État du funnel

| Étape | État | Constat |
|---|---|---|
| Awareness | 🔴 Inexistant | Aucun canal actif, pas de domaine, sous-domaine hstgr.cloud peu vendeur |
| Interest | 🔴 Vitrine minimale en ligne | La landing complète (ROI, modules, tarifs, FAQ) est codée mais **pas déployée** |
| Considération | 🔴 Vide | Pas de démo vidéo, pas de captures réelles, zéro preuve sociale (témoignage, logo client) |
| Conversion | 🟡 Fonctionnelle | Signup sans CB ✓, wizard 30 s ✓ — MAIS confirmation email via SMTP Supabase par défaut = **limité à ~3 emails/heure** → brancher Resend en SMTP custom AVANT tout lancement |
| Rétention | 🔴 Promesse non tenue | Les notifications (devis signé, étapes) s'empilent en base mais **ne partent pas** — l'argument « votre client est prévenu » est faux tant que l'Edge Function d'envoi n'existe pas |

### Tracking : rien n'est mesuré

Aucun analytics installé. Avant le premier euro de com', installer **Plausible** (léger, RGPD-friendly, pas de bandeau cookies nécessaire) ou GA4, avec 6 événements : `visit_landing`, `signup_start`, `signup_done`, `atelier_created`, `devis_sent`, `devis_signed`. Sans ça, impossible de savoir où le funnel fuit. UTM systématiques sur tous les liens sortants (emails TP, WhatsApp, QR salons).

### Positionnement & pricing

La promesse ROI (« un devis signé en plus rembourse l'abonnement ») est le bon angle pour du 59-89 €. Trois trous : le **différenciateur Thermopoudre est sous-exploité** (une ligne en bas de la page tarifs — c'est ton fossé concurrentiel, il mérite un bloc dédié « votre poudre commandée avant d'être à sec ») ; **pas de plan annuel** (-2 mois = trésorerie + engagement) ; **remise client TP non chiffrée** = pas actionnable en closing.

### Canaux de lancement recommandés (dans l'ordre)

1. **Base clients TP** : extraction thermocrm des ateliers FR actifs → email personnalisé + relance WhatsApp. CAC ≈ 0, confiance déjà établie. Objectif : 5 pilotes.
2. **SEO** : « logiciel thermolaquage », « logiciel atelier peinture poudre » = concurrence quasi nulle. 3-4 pages de contenu métier suffisent pour truster la requête (+ AI-SEO, skill dispo).
3. **Démo vidéo 90 s** (téléphone, vrai atelier — celui de Denis ?) sur la landing.
4. Groupes Facebook métier + bouche-à-oreille pilotes (parrainage simple).

### ⚠️ Conformité légale (bloquant avant vrais comptes)

Mentions légales, CGU/CGV SaaS, politique de confidentialité RGPD, registre des traitements, DPA pour les données clients des ateliers (tu deviens sous-traitant au sens RGPD !). Tu as déjà l'expérience thermoretract/CGV — même chantier, périmètre SaaS.

### Matrice de priorisation

| | Effort faible | Effort fort |
|---|---|---|
| **Impact fort** | Déployer la vitrine · Plausible + events · SMTP Resend · remise TP chiffrée | Envoi emails (Edge Function) · pages légales · démo vidéo + pilotes |
| **Impact faible** | Plan annuel sur la page tarifs · favicon/OG image | Blog SEO complet (après pilotes) |

---

## PARTIE 2 — Critique design

### Impression générale

Parcours mobile-first cohérent et court — c'est la vraie réussite : gros bouton « Valider l'étape », liens publics sans compte, wizard en 30 secondes. Mais l'app **parle anglais quand ça se passe mal** (erreurs Supabase brutes), utilise des `confirm()` natifs, et son iconographie emoji la fait paraître moins sérieuse que son prix (89 €/mois).

### Constats d'utilisabilité

| Constat | Sévérité | Recommandation |
|---|---|---|
| Landing live = version minimale, aucune info produit/prix | 🔴 | Déployer la vitrine (prête, en attente GO) |
| Erreurs affichées = `err.message` Supabase brut, en anglais | 🔴 | Dictionnaire d'erreurs FR + composant Toast |
| Archivage client via `confirm()` natif du navigateur | 🔴 | Modal de confirmation cohérente (réutilisable partout) |
| Scan QR valide l'étape **sans confirmation ni annulation** — un scan accidentel fausse la production et peut décrémenter le stock | 🟡 | Écran de confirmation ou undo 10 s après scan |
| Éditeur de devis : aucune sauvegarde auto, perte possible sur mobile (app passée en arrière-plan) | 🟡 | Autosave brouillon (debounce 3 s) |
| Aucun feedback de succès après enregistrement (redirection sèche) | 🟡 | Toast « Enregistré ✓ » |
| Réglages grille : sauvegarde au blur champ par champ, comportement invisible et surprenant | 🟡 | Indicateur par champ ou bouton global |
| Kanban : colonnes 280 px en scroll horizontal sans indice visuel qu'il y a d'autres colonnes | 🟡 | Peek de la colonne suivante + points de pagination |
| Suivi client public : pas de photos des pièces, pas de couleur/logo atelier | 🟢 | Ajouter photos publiques opt-in + logo (v1.1, argument de vente) |
| Dashboard : cartes cliquables sans affordance (pas de chevron/hover) | 🟢 | Chevron + hover state |

### Hiérarchie visuelle

Landing v2 : hero correct, l'œil tombe sur le bon élément (titre → CTA). L'encart ROI 💡 est l'argument le plus fort mais visuellement le plus faible (petit, gris) — le monter en bandeau coloré sous le hero. App : dashboard OK, mais les 4 cartes stats ont le même poids visuel alors que « retard » et « alerte stock » sont les seules qui demandent une action.

### Accessibilité

| Point | Verdict |
|---|---|
| Contraste brand #1d4ed8 sur blanc (~6.3:1) | ✓ |
| `text-gray-400` utilisé pour de l'info utile (~2.8:1) | ✗ — passer en gray-500 minimum |
| Touch targets nav basse et boutons (≥44 px) | ✓ |
| Labels sur tous les inputs | ✓ |
| `focus-visible` sur les boutons | ✗ — invisible au clavier |
| Emojis porteurs de sens sans `aria-label` (nav, statuts) | ✗ |
| Zoom bloqué (`maximumScale: 1`) | ✗ — pénalise les yeux fatigués en atelier, à retirer |

### Ce qui marche bien

Le parti pris « utilisable avec des gants » est tenu (gros boutons, une action par écran) ; les états vides guident (« Ajoute ton premier client pour créer un devis ») ; la grille pré-remplie en 1 clic est un excellent onboarding ; la page publique de devis est propre et imprimable.

---

## PARTIE 3 — Audit du système de design

### Synthèse

**Composants revus : 9 | Problèmes : 14 | Score : 55/100.** Base saine (composants centralisés dans `ui.tsx`, Tailwind discipliné) mais système incomplet : pas d'états d'erreur, pas de feedback, tokens sémantiques absents.

### Couverture des tokens

| Catégorie | Défini | Valeurs en dur trouvées |
|---|---|---|
| Couleurs | 1 token `brand` (3 nuances) | ~20 instances de couleurs sémantiques en dur (`bg-green-100 text-green-700`, red, amber…) dans STATUS_*, alertes, badges |
| Espacement | Échelle Tailwind standard ✓ | RAS |
| Radius | — | 4 valeurs mélangées sans règle (`lg`, `xl`, `2xl`, `full`) |
| Typo | Échelle Tailwind ✓ | Police système par défaut — OK pour v1, pas de token |

**Reco** : ajouter `success` / `warning` / `danger` dans `tailwind.config.ts` et centraliser TOUS les statuts dans un seul module (aujourd'hui STATUS_DEVIS/STATUS_PROJET dans utils + classes ad hoc ailleurs). Règle radius : `xl` cartes, `lg` inputs/boutons, `full` badges.

### Complétude des composants

| Composant | États | Variants | Manques | Score |
|---|---|---|---|---|
| Button | hover, disabled | 4 | pas de taille (sm/lg), pas d'état loading intégré (géré en texte «…» ad hoc), pas de focus-visible | 6/10 |
| Input/Select/Textarea | focus | label optionnel | **aucun état erreur** (bordure rouge + message), pas de hint | 5/10 |
| Card | onClick actif | — | pas de variant alerte (fait en classes ad hoc) | 6/10 |
| Badge | — | par classes libres | variants non contraints (n'importe quelle classe passe) | 5/10 |
| Spinner / Empty / PageTitle | — | — | OK pour leur rôle | 7/10 |
| **Modal / Dialog** | — | — | **N'existe pas** (confirm() natif utilisé) | 0/10 |
| **Toast** | — | — | **N'existe pas** (aucun feedback succès/erreur global) | 0/10 |
| Skeleton | — | — | N'existe pas (Spinner plein écran partout) | — |

### Actions prioritaires (design system)

1. **Toast + état erreur des inputs** — le manque le plus visible au quotidien ; brancher toutes les mutations dessus avec messages FR.
2. **Modal de confirmation générique** — remplace les `confirm()` (archivage client, scan QR, suppression).
3. **Tokens sémantiques + module statuts unique** — prépare aussi l'i18n (labels au même endroit).
4. **lucide-react à la place des emojis** (nav, actions) — cohérence cross-plateforme et crédibilité pro. Garder les emojis uniquement dans les textes marketing.
5. **focus-visible systématique + audit gray-400** — 30 min de travail, gros gain accessibilité.

---

## SYNTHÈSE — Le point complet, priorisé

**À faire avant d'inviter le moindre atelier pilote :**

1. 🔴 Déployer la vitrine (en attente de ton « GO MAJ »)
2. 🔴 Pages légales (mentions, CGU/CGV, RGPD + DPA) — tu deviens sous-traitant des données de tes clients
3. 🔴 SMTP Resend sur Supabase Auth (le SMTP par défaut = ~3 emails/h, le signup mourra au premier partage)
4. 🔴 Edge Function d'envoi des notifications — la file se remplit, rien ne part
5. 🔴 Plausible + 6 events funnel

**Semaine suivante (qualité perçue) :**

6. 🟡 Toast + erreurs en français + états erreur inputs
7. 🟡 Modal de confirmation + undo sur le scan QR
8. 🟡 Icônes lucide, focus-visible, contrastes, zoom débloqué
9. 🟡 Autosave devis + feedback de sauvegarde réglages

**Pré-lancement commercial :**

10. 🟡 Démo vidéo 90 s + captures réelles sur la vitrine, bloc Thermopoudre dédié, remise TP chiffrée, plan annuel
11. 🟡 Extraction thermocrm → campagne pilotes (5 ateliers)
12. 🟢 i18n (extraction des chaînes) avant l'ouverture Italie

Mon conseil d'ordre : 1-5 cette semaine (c'est le socle), 6-9 pendant que les pilotes testent, 10-12 quand le produit a encaissé leurs retours. Je peux attaquer chaque point — dis-moi lesquels tu me confies.
