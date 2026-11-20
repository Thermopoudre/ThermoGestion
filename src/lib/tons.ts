/**
 * Les cinq tons sémantiques du produit, et eux seuls.
 *
 * Pourquoi un fichier à part plutôt que dans `ui.tsx` : les tables de statut métier
 * (`utils.ts`, `types.ts`, `jantes.ts`, `portail.ts`, `qualite.ts`, `capacite.ts`,
 * `certificat.ts`) sont lues aussi bien par un composant client que par une route serveur.
 * `ui.tsx` porte `"use client"` — l'importer depuis `lib/` ferait basculer des modules
 * serveur dans le bundle client sans raison.
 *
 * Pourquoi des tons plutôt que des classes : avant ce fichier, le vert « conforme » existait
 * en neuf déclinaisons (`green-100/700`, `green-100/800`, `green-50/700`…) pour une seule idée,
 * et l'écran qui voulait changer d'avis devait être retrouvé à la main. Un statut déclare
 * désormais ce qu'il *veut dire* ; c'est le design system qui décide de quoi ça a l'air.
 */
export type TonBadge = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Fond + texte de chaque ton, en classes Tailwind.
 *
 * **Chaque paire est vérifiée à 4,5:1 minimum (WCAG 1.4.3 Contraste, niveau AA)** — le texte
 * d'un badge est du texte petit (11-12 px), il ne bénéficie pas du seuil assoupli à 3:1 réservé
 * au « grand texte ». Rapports mesurés (voir `tests/design-system-tons.test.ts`) :
 *
 * | ton     | fond    | texte   | rapport |
 * |---------|---------|---------|---------|
 * | neutral | #F3F4F6 | #374151 | 9,37:1  |
 * | info    | #DFF3F8 | #0F5A6B | 6,80:1  |
 * | success | #DCFCE7 | #166534 | 6,49:1  |
 * | warning | #FEF3C7 | #92400E | 6,37:1  |
 * | danger  | #FEE2E2 | #991B1B | 6,80:1  |
 *
 * Le ton `neutral` remplace notamment `bg-gray-200 text-gray-500`, mesuré à **3,90:1** : c'est
 * ce que portaient « Restitué », « Livré et facturé » et « Livré » — sur le **portail client**,
 * donc sur l'écran que voit le client du client, celui qu'on ne peut pas rattraper d'un mot.
 */
export const CLASSES_TON: Record<TonBadge, string> = {
  neutral: "bg-gray-100 text-gray-700",
  info: "bg-brand-light text-brand-dark",
  success: "bg-success-light text-success-dark",
  warning: "bg-warning-light text-warning-dark",
  danger: "bg-danger-light text-danger-dark",
};

/** Les couleurs exactes derrière les classes ci-dessus, pour que le test de contraste les mesure. */
export const HEX_TON: Record<TonBadge, { fond: string; texte: string }> = {
  neutral: { fond: "#F3F4F6", texte: "#374151" },
  info: { fond: "#DFF3F8", texte: "#0F5A6B" },
  success: { fond: "#DCFCE7", texte: "#166534" },
  warning: { fond: "#FEF3C7", texte: "#92400E" },
  danger: { fond: "#FEE2E2", texte: "#991B1B" },
};

/** Luminance relative d'une couleur `#rrggbb`, au sens WCAG 2.1 (§ Relative luminance). */
export function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const canaux = [0, 1, 2].map((i) => parseInt(c.slice(i * 2, i * 2 + 2), 16) / 255);
  const lin = canaux.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Rapport de contraste entre deux couleurs, de 1:1 (identiques) à 21:1 (noir sur blanc).
 * Le seuil AA du texte courant est 4,5 ; celui du grand texte (≥ 18,66 px gras ou 24 px), 3.
 */
export function contraste(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [haut, bas] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (haut + 0.05) / (bas + 0.05);
}
