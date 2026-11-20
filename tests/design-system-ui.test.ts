import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, Button, EnregistrementEnCours, Input, Select, Textarea } from "@/components/ui";
import ConfirmModal from "@/components/Modal";

/**
 * Rendu des composants du design system, sans navigateur.
 *
 * React Testing Library n'est pas installé et l'ajouter pour ce lot serait disproportionné.
 * `renderToStaticMarkup` suffit à vérifier ce qui se vérifie sur le balisage produit : les
 * classes de hauteur, les attributs ARIA, la présence du rouet de chargement. C'est
 * précisément ce qui a régressé — un `py-2.5` recopié, un `aria-busy` oublié.
 *
 * CE QUE CE FICHIER NE PEUT PAS VÉRIFIER, et qui reste à la recette navigateur :
 *   - la hauteur **calculée** des cibles (44 px et 56 px) : ici on lit les classes Tailwind,
 *     pas le résultat de la mise en page ;
 *   - Échap, le piège de focus (Tab et Maj+Tab), le focus initial et sa restitution : aucun
 *     effet React ne s'exécute en rendu statique, `usePiegeFocus` n'est donc pas éprouvé ;
 *   - le repli de `AstuceEcran`, qui dépend de `localStorage` et d'une lecture Supabase ;
 *   - l'état optimiste de `JanteCarte` sur réseau lent.
 */

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("Button — socle tactile et état de chargement", () => {
  it("rend 44 px par défaut : py-3 et non py-2.5", () => {
    const m = html(createElement(Button, { children: "Valider" }));
    expect(m).toContain("py-3");
    expect(m).not.toContain("py-2.5");
    expect(m).toContain("Valider");
  });

  it("offre une taille xl de 56 px pour les écrans d'atelier", () => {
    const m = html(createElement(Button, { taille: "xl", children: "Lancer la fournée" }));
    expect(m).toContain("py-4");
    expect(m).toContain("text-base");
  });

  it("annonce son attente et se neutralise quand `loading` est posé", () => {
    const m = html(createElement(Button, { loading: true, children: "Supprimer" }));
    expect(m).toContain('aria-busy="true"');
    // L'attribut, pas la classe `disabled:opacity-50` qui est toujours là.
    expect(m).toContain('disabled=""');
    expect(m).toContain("animate-spin");
    // Le libellé reste dans le DOM : l'opérateur doit savoir sur quoi il a appuyé.
    expect(m).toContain("Supprimer");
  });

  it("n'est ni occupé ni désactivé au repos", () => {
    const m = html(createElement(Button, { children: "Enregistrer" }));
    expect(m).not.toContain("aria-busy");
    expect(m).not.toContain("animate-spin");
  });

  it("porte un anneau de focus visible dans tous les cas", () => {
    for (const variant of ["primary", "secondary", "danger", "ghost"] as const) {
      expect(html(createElement(Button, { variant, children: "x" }))).toContain("focus-visible:outline");
    }
  });
});

describe("Badge — tons et tenue sur une ligne", () => {
  it("ne se coupe jamais en deux lignes", () => {
    expect(html(createElement(Badge, { children: "Prêt à récupérer" }))).toContain("whitespace-nowrap");
  });

  it("applique la paire de classes du ton demandé", () => {
    expect(html(createElement(Badge, { tone: "success", children: "Signé" }))).toContain("bg-success-light text-success-dark");
    expect(html(createElement(Badge, { tone: "danger", children: "Refusé" }))).toContain("bg-danger-light text-danger-dark");
    expect(html(createElement(Badge, { tone: "warning", children: "Expiré" }))).toContain("bg-warning-light text-warning-dark");
    expect(html(createElement(Badge, { tone: "info", children: "Envoyé" }))).toContain("bg-brand-light text-brand-dark");
    expect(html(createElement(Badge, { tone: "neutral", children: "Restitué" }))).toContain("bg-gray-100 text-gray-700");
  });

  it("ne pose plus le gris illisible qui servait aux statuts terminés", () => {
    for (const mot of ["Restitué", "Livré et facturé", "Facturé"]) {
      const m = html(createElement(Badge, { tone: "neutral", children: mot }));
      expect(m).not.toContain("bg-gray-200");
      expect(m).not.toContain("text-gray-500");
    }
  });

  it("laisse `className` servir à la mise en page, pas à la couleur", () => {
    const m = html(createElement(Badge, { tone: "info", className: "ml-2", children: "Récap" }));
    expect(m).toContain("ml-2");
    expect(m).toContain("bg-brand-light");
  });
});

describe("Champs de saisie — même socle de 44 px que les boutons", () => {
  it("Input, Select et Textarea sont à py-3", () => {
    for (const el of [
      createElement(Input, { placeholder: "x" }),
      createElement(Select, {}, createElement("option", { value: "1" }, "un")),
      createElement(Textarea, {}),
    ]) {
      const m = html(el);
      expect(m).toContain("py-3");
      expect(m).not.toContain("py-2.5");
    }
  });

  it("signale l'erreur au lecteur d'écran et par un jeton, pas par un rouge en dur", () => {
    const m = html(createElement(Input, { error: "Champ obligatoire" }));
    expect(m).toContain('aria-invalid="true"');
    expect(m).toContain("border-danger");
    expect(m).toContain("Champ obligatoire");
    expect(m).not.toContain("border-red-400");
  });

  it("le champ décimal accepte la virgule du clavier français", () => {
    const m = html(createElement(Input, { type: "number", defaultValue: "4,2" }));
    // React 19 conserve la casse de `inputMode` dans le balisage rendu côté serveur.
    expect(m).toContain('inputMode="decimal"');
    expect(m).toContain('type="text"');
  });
});

describe("EnregistrementEnCours — l'attente d'une écriture au blur", () => {
  it("annonce poliment, et réserve sa place quand il est muet", () => {
    const actif = html(createElement(EnregistrementEnCours, { actif: true }));
    expect(actif).toContain('aria-live="polite"');
    expect(actif).toContain("Enregistrement…");
    expect(actif).toContain("animate-spin");

    const repos = html(createElement(EnregistrementEnCours, { actif: false }));
    expect(repos).toContain('aria-live="polite"');
    expect(repos).not.toContain("Enregistrement…");
    // La hauteur est réservée : rien ne saute quand l'indicateur apparaît.
    expect(repos).toContain("h-4");
  });
});

describe("ConfirmModal — la boîte de confirmation des 11 écrans", () => {
  const base = {
    open: true,
    title: "Supprimer ce devis ?",
    message: "Il partira à la corbeille.",
    onConfirm: () => {},
    onCancel: () => {},
  };

  it("ne rend rien quand elle est fermée", () => {
    expect(html(createElement(ConfirmModal, { ...base, open: false }))).toBe("");
  });

  it("est une vraie boîte de dialogue, décrite par son titre affiché", () => {
    const m = html(createElement(ConfirmModal, base));
    expect(m).toContain('role="dialog"');
    expect(m).toContain('aria-modal="true"');
    expect(m).toContain("aria-labelledby=");
    expect(m).toContain("aria-describedby=");
    expect(m).toContain("Supprimer ce devis ?");
    expect(m).toContain("Il partira à la corbeille.");
  });

  it("vise « Annuler » au focus initial — l'issue sûre", () => {
    const m = html(createElement(ConfirmModal, base));
    const avantAnnuler = m.slice(0, m.indexOf("Annuler"));
    expect(avantAnnuler).toContain("data-focus-initial");
  });

  it("emploie `Button.loading` et n'écrit plus « … » à la place du libellé", () => {
    const m = html(createElement(ConfirmModal, { ...base, busy: true, confirmLabel: "Supprimer" }));
    expect(m).toContain('aria-busy="true"');
    expect(m).toContain("animate-spin");
    expect(m).toContain("Supprimer");
    expect(m).not.toContain(">…<");
  });

  it("teinte le bouton de confirmation en danger quand l'action est destructrice", () => {
    expect(html(createElement(ConfirmModal, { ...base, danger: true }))).toContain("bg-danger");
    expect(html(createElement(ConfirmModal, base))).toContain("bg-brand");
  });

  it("laisse les deux boutons actionnables tant qu'aucune écriture n'est partie", () => {
    const m = html(createElement(ConfirmModal, base));
    // On cherche l'attribut `disabled` du bouton, pas la classe `disabled:opacity-50` qui, elle,
    // est toujours présente : c'est le style *conditionnel* de l'état désactivé.
    expect(m).not.toContain('disabled=""');
  });
});
