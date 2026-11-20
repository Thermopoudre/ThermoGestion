import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette Thermopoudre : marine profond + cyan
        brand: {
          DEFAULT: "#147085",   // cyan foncé — interactif sur fond clair (AA avec blanc)
          dark: "#0F5A6B",
          light: "#DFF3F8",
        },
        tpblue: {
          DEFAULT: "#2FB5D2",   // cyan lumineux Thermopoudre — accents sur fond marine
          soft: "#7CD0E3",
        },
        ink: {
          DEFAULT: "#11203A",   // marine profond Thermopoudre
          soft: "#16294A",
          line: "#243B63",
        },
        // Jetons sémantiques. `light`/`dark` sont les deux seules valeurs dont un écran a besoin
        // (fond + texte) ; les paliers 50/200/700 existent pour absorber les bordures des écrans
        // qui écrivent encore `border-green-200` en dur — 429 occurrences à migrer par écran.
        success: { DEFAULT: "#16A34A", 50: "#F0FDF4", light: "#DCFCE7", 200: "#BBF7D0", 700: "#15803D", dark: "#166534" },
        warning: { DEFAULT: "#D97706", 50: "#FFFBEB", light: "#FEF3C7", 200: "#FDE68A", 700: "#B45309", dark: "#92400E" },
        danger: { DEFAULT: "#DC2626", 50: "#FEF2F2", light: "#FEE2E2", 200: "#FECACA", 700: "#B91C1C", dark: "#991B1B" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "system-ui", "sans-serif"],
      },
      // 11 px : la taille réellement employée par la barre de navigation basse et les maquettes de
      // la vitrine, écrite jusqu'ici en `text-[11px]` — une échelle typographique parallèle, hors
      // du thème, donc impossible à faire évoluer d'un seul geste.
      // Audit design du 20/11/2026 : 11 px se lisait mal en plein atelier (barre du bas, raccourcis,
      // historique). Plancher à 12 px partout ; la classe reste pour ne pas toucher quatorze écrans.
      fontSize: { "2xs": ["0.75rem", { lineHeight: "1rem" }] },
      letterSpacing: { kicker: "0.14em" },
    },
  },
  plugins: [],
} satisfies Config;
