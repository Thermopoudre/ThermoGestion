import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { LogoSource } from "@/lib/pdf/document";

/**
 * Le nom de fichier finit dans un en-tête HTTP : tout ce qui n'est pas alphanumérique,
 * tiret ou point est neutralisé pour éviter une injection d'en-tête et les caractères
 * refusés par les systèmes de fichiers Windows.
 */
export function nomFichier(base: string) {
  const propre = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${propre || "document"}.pdf`;
}

/** Réponse PDF prête à être affichée dans l'onglet (inline) plutôt que téléchargée d'office. */
export async function reponsePdf(document: ReactElement<DocumentProps>, base: string) {
  return reponsePdfBinaire(await renderToBuffer(document), base);
}

/**
 * Même réponse, à partir d'un PDF déjà produit. Sert au Factur-X, dont le fichier passe par une
 * étape d'emballage (pièce jointe XML, métadonnées) après le rendu.
 */
export function reponsePdfBinaire(pdf: Uint8Array | Buffer, base: string) {
  const octets = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  return new Response(octets, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomFichier(base)}"`,
      "Content-Length": String(octets.length),
      // Un document commercial peut être corrigé puis régénéré : jamais de cache partagé.
      "Cache-Control": "private, no-store",
    },
  });
}

const FORMATS: Record<string, "png" | "jpg"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

/**
 * Le logo est téléchargé ici plutôt que laissé à @react-pdf : on maîtrise le délai et,
 * si l'URL est morte, le PDF est quand même produit sans logo au lieu d'échouer en 500.
 */
export async function chargerLogo(url: string | null | undefined): Promise<LogoSource | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const parExtension = /\.png(\?|$)/i.test(url) ? "png" : /\.jpe?g(\?|$)/i.test(url) ? "jpg" : null;
    const format = FORMATS[type] ?? parExtension;
    // @react-pdf ne sait décoder que PNG et JPEG : un SVG ou un WebP est ignoré silencieusement.
    if (!format) return null;
    return { data: Buffer.from(await res.arrayBuffer()), format };
  } catch {
    return null;
  }
}

/** Réponse d'erreur lisible par un humain — ces URL sont ouvertes directement dans le navigateur. */
export function erreurPdf(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
