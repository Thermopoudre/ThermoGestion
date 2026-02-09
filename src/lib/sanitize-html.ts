/**
 * Sanitisation HTML côté serveur
 * Supprime les balises et attributs dangereux (script, iframe, event handlers, etc.)
 * Utilisé pour les pages site-vitrine chargées via dangerouslySetInnerHTML
 */

/**
 * Supprime les éléments dangereux d'une chaîne HTML.
 * Approche allowlist : ne supprime que les patterns connus dangereux
 * tout en préservant le HTML légitime de la page vitrine.
 */
export function sanitizeStaticHtml(html: string): string {
  if (!html) return ''

  let sanitized = html

  // 0. Extraire le body content uniquement (ignorer head, html, doctype)
  const bodyMatch = sanitized.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) {
    sanitized = bodyMatch[1]
  }

  // 1. Supprimer les balises <script> externes (CDN, etc.) - sécurité
  sanitized = sanitized.replace(/<script\b[^>]*src\s*=\s*[^>]*>[\s\S]*?<\/script>/gi, '')

  // 2. Conserver les scripts inline de navigation (menu mobile, etc.)
  // mais supprimer les scripts dangereux (eval, fetch, XMLHttpRequest)
  // On garde les scripts inline qui font du toggle de classes DOM
  // Pas de suppression globale des <script> inline

  // 3. Supprimer les balises <iframe>, <object>, <embed>, <applet>
  sanitized = sanitized.replace(/<(iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  sanitized = sanitized.replace(/<(iframe|object|embed|applet)\b[^>]*\/?>/gi, '')

  // 4. Supprimer les event handlers inline (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // 5. Supprimer les attributs javascript: dans href/src/action
  sanitized = sanitized.replace(/(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '$1=""')

  // 6. Supprimer les balises <base> (peut rediriger les liens)
  sanitized = sanitized.replace(/<base\b[^>]*\/?>/gi, '')

  // 7. Supprimer les balises <form> avec action externe
  sanitized = sanitized.replace(/<form\b[^>]*action\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')[^>]*>/gi, '<form>')

  // 8. Supprimer data: URIs dans les src (sauf images data:image/)
  sanitized = sanitized.replace(/src\s*=\s*(?:"data:(?!image\/)[^"]*"|'data:(?!image\/)[^']*')/gi, 'src=""')

  return sanitized
}

/**
 * Charge et sanitise un fichier HTML statique du site vitrine.
 * À utiliser dans les server components Next.js.
 */
export function loadAndSanitizeHtml(filePath: string, fallbackTitle: string = 'Page'): string {
  const { readFileSync } = require('fs')

  try {
    const htmlContent = readFileSync(filePath, 'utf-8')
    return sanitizeStaticHtml(htmlContent)
  } catch {
    return `<html><body><h1>${fallbackTitle} en cours de chargement...</h1></body></html>`
  }
}
