"use client";
import "./globals.css";

/**
 * Le filet de sécurité de dernier recours : l'écran qui répond quand c'est le **gabarit racine**
 * lui-même qui échoue.
 *
 * POURQUOI un second écran de panne alors que `error.tsx` existe déjà. `error.tsx` est rendu
 * *à l'intérieur* du gabarit racine ; si c'est ce gabarit qui lève l'exception, il ne peut pas
 * s'afficher. Next.js bascule alors sur `global-error.tsx`, qui **remplace** `layout.tsx` — d'où
 * les balises `<html>` et `<body>` écrites ici à la main, seul fichier du produit où elles se
 * répètent.
 *
 * Trois contraintes qui expliquent la sobriété de ce qui suit :
 *
 *  1. **Aucun composant maison.** Si le gabarit racine est tombé, on ne sait pas ce qui reste
 *     debout. Cet écran ne dépend que de React et de la feuille de styles.
 *  2. **Aucune police chargée par `next/font`.** Elles sont déclarées dans le gabarit racine, qui
 *     n'est justement pas rendu : on retombe volontairement sur la pile système.
 *  3. **`lang="fr"`**, comme partout ailleurs. Une page d'erreur reste une page, et un lecteur
 *     d'écran doit la lire en français.
 *
 * En pratique, cet écran ne devrait jamais apparaître. C'est précisément pour cela qu'il doit
 * être écrit : le jour où il apparaît, personne n'est là pour l'écrire.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#F9FAFB" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E7EB",
              borderRadius: "1rem",
              padding: "2rem",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, letterSpacing: "-0.01em", color: "#11203A" }}>
              THERMO<span style={{ color: "#147085" }}>GESTION</span>
            </p>

            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", marginTop: "1.5rem" }}>
              Thermogestion n&apos;a pas pu démarrer
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#4B5563", marginTop: "0.5rem", lineHeight: 1.6 }}>
              Une panne est survenue avant même l&apos;affichage de l&apos;application. <b>Vos
              données sont intactes</b> — elles vivent sur nos serveurs, pas dans cette page.
              Réessayez : dans la plupart des cas, un rechargement suffit.
            </p>

            {/* Reliquat vague 3 — seul bouton de ce fichier sans indicateur de focus clavier. Une
                classe Tailwind, pas du style en ligne comme le reste de cet écran : `globals.css`
                est importé ligne 2 (c'est lui qui fournit `:focus-visible`), et les propriétés
                `outline` qu'elle pose ne recoupent aucune des propriétés fixées ci-dessous. */}
            <button
              type="button"
              onClick={reset}
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              style={{
                marginTop: "1.5rem",
                width: "100%",
                cursor: "pointer",
                backgroundColor: "#147085",
                color: "#FFFFFF",
                border: 0,
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Recharger l&apos;application
            </button>

            <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "1.25rem", lineHeight: 1.6 }}>
              Si la panne persiste, écrivez-nous à{" "}
              <a href="mailto:contact@thermopoudre.fr" style={{ color: "#147085" }}>
                contact@thermopoudre.fr
              </a>
              {error.digest ? <> en citant la référence {error.digest}.</> : <>.</>}
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
