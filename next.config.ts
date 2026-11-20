import type { NextConfig } from "next";

// Audit n°4 (13/08/2026) : aucun en-tête de sécurité n'était envoyé à part HSTS (posé par Vercel).
// Le risque concret : la page de signature de devis /d/[token] pouvait être chargée dans une iframe
// invisible sur un site tiers (clickjacking) — un client aurait pu "signer" sans le savoir.
// frame-ancestors 'none' + X-Frame-Options DENY ferment ça.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Un autre package-lock.json traîne plus haut dans l'arborescence du poste de développement :
  // sans cette ligne, Next remonte jusqu'à lui et calcule les fichiers embarqués depuis un dossier
  // qui n'est pas le projet — les polices n'y seraient pas.
  outputFileTracingRoot: process.cwd(),
  // Les .ttf ne sont jamais `import`és : ils sont lus au moment du rendu du PDF. Sans cette
  // déclaration, l'analyse de dépendances de Next ne les embarque pas dans la fonction déployée
  // et la génération de facture échoue en production alors qu'elle marche en local.
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./src/lib/pdf/fonts/*.ttf"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Documents de clients joignables par jeton : devis, suivi, facture, bon de livraison,
      // accusé de réception, bon de prise en charge de jantes. Ils doivent rester atteignables
      // sans compte et ne jamais entrer dans un index public — d'où l'en-tête plutôt qu'une
      // interdiction dans robots.txt, que le robot ne lirait qu'en renonçant à lire la page.
      //
      // `portail` est le septième, et le plus sensible : là où les six premiers ouvrent une
      // pièce, il ouvre l'historique commercial complet d'une entreprise. Il ne doit jamais
      // entrer dans un index, ni être archivé par un cache public.
      ...["d", "s", "f", "bl", "rc", "jt", "portail"].map((prefixe) => ({
        source: `/${prefixe}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      })),
    ];
  },
};

export default nextConfig;
